import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyRequestCreated } from '@/lib/email/notifications';
import { requireUser } from '@/lib/auth/apiGuards';
import { DEFAULT_BOOKING_POLICY_MESSAGE_AR } from '@/lib/bookingPolicy';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// نجرب النماذج دي بالترتيب - لو واحد اتوقف بيجرب اللي بعده تلقائيًا
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

async function callGeminiText(apiKey: string, prompt: string): Promise<string> {
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const json = await res.json();
      if (res.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text as string;
      }
      lastError = json.error?.message || `فشل مع نموذج ${model}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'خطأ غير معروف';
    }
  }
  throw new Error(lastError || 'كل نماذج Gemini المتاحة فشلت');
}

async function callGeminiAudio(
  apiKey: string,
  promptText: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: audioBase64 } }],
              },
            ],
          }),
        }
      );
      const json = await res.json();
      if (res.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text as string;
      }
      lastError = json.error?.message || `فشل مع نموذج ${model}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'خطأ غير معروف';
    }
  }
  throw new Error(lastError || 'كل نماذج Gemini المتاحة فشلت مع الرسالة الصوتية');
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const userId = guard.user.id; // مصدر الهوية الوحيد هو الجلسة نفسها، مش أي قيمة جاية من العميل

  const { message, audioBase64, mimeType, pendingBooking } = await request.json();

  if (!message && !audioBase64) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const [{ data: secretRows }, { data: rooms }, { data: categories }, { data: assistantSettings }] = await Promise.all([
    supabaseAdmin.from('app_secrets').select('key, value').eq('key', 'gemini_api_key'),
    supabaseAdmin.from('rooms').select('id, name, name_en, booking_policy_message').eq('status', 'active'),
    supabaseAdmin.from('request_categories').select('id, name'),
    supabaseAdmin.from('app_settings').select('key, value').in('key', ['ai_assistant_name', 'ai_instructions']),
  ]);

  const geminiKey = secretRows?.[0]?.value as string | undefined;
  const assistantName =
    (assistantSettings ?? []).find((r) => r.key === 'ai_assistant_name')?.value || 'المساعد الذكي';
  const customInstructions =
    (assistantSettings ?? []).find((r) => r.key === 'ai_instructions')?.value || '';
  if (!geminiKey) {
    return NextResponse.json({
      ok: false,
      error: 'مفتاح Gemini غير مضاف بعد. أضِفه من صفحة إعدادات البرنامج (/admin/settings) أولًا.',
    });
  }

  // ---- تأكيد حجز معلّق: المستخدم فعلاً شاف رسالة سياسة القاعة وبنستنى منه رد نعم/لا ----
  if (pendingBooking && typeof pendingBooking === 'object') {
    let replyText = (message || '').toString();
    let confirmTranscript = '';
    if (!replyText.trim() && audioBase64) {
      try {
        replyText = await callGeminiAudio(
          geminiKey,
          'اكتب فقط، بدون أي إضافة أو تعليق، النص الذي قاله المستخدم في هذه الرسالة الصوتية بنفس لغته.',
          audioBase64,
          mimeType || 'audio/webm'
        );
        confirmTranscript = replyText;
      } catch {
        replyText = '';
      }
    }

    const normalized = replyText.trim().toLowerCase();
    const yesWords = ['نعم', 'ايوه', 'ايوة', 'اه', 'آه', 'موافق', 'أوافق', 'اوافق', 'تمام', 'اكيد', 'أكيد', 'yes', 'y', 'ok', 'okay', 'confirm'];
    const noWords = ['لا', 'لأ', 'الغاء', 'إلغاء', 'cancel', 'no', 'n'];
    const isYes = yesWords.some((w) => normalized === w || normalized.includes(w));
    const isNo = noWords.some((w) => normalized === w || normalized.includes(w));

    const pb = pendingBooking as {
      room_id?: string;
      title?: string;
      date?: string;
      start_time?: string;
      end_time?: string;
    };

    if (isYes && !isNo && pb.room_id && pb.date && pb.start_time && pb.end_time) {
      const { error } = await supabaseAdmin.from('bookings').insert({
        room_id: pb.room_id,
        title: pb.title || 'حجز عبر المساعد الذكي',
        booking_date: pb.date,
        start_time: pb.start_time,
        end_time: pb.end_time,
        booked_by: userId,
        status: 'pending',
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message, transcript: confirmTranscript });
      }

      return NextResponse.json({
        ok: true,
        transcript: confirmTranscript,
        message: `✅ تم تأكيد وإرسال طلب حجز "${pb.title || ''}" بتاريخ ${pb.date} من ${pb.start_time} إلى ${pb.end_time}، وهو الآن قيد مراجعة الأدمن.`,
      });
    }

    if (isNo) {
      return NextResponse.json({
        ok: true,
        transcript: confirmTranscript,
        message: 'تم إلغاء طلب الحجز. تقدر تطلب حجز جديد في أي وقت.',
      });
    }

    return NextResponse.json({
      ok: false,
      transcript: confirmTranscript,
      pendingBooking,
      message: 'من فضلك أجب بـ "نعم" للتأكيد أو "لا" للإلغاء.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const roomsList = (rooms ?? []).map((r) => `- ${r.name} (id: ${r.id})`).join('\n');
  const categoriesList = (categories ?? []).map((c) => `- ${c.name} (id: ${c.id})`).join('\n');

  const prompt = `أنت مساعد ذكي اسمه "${assistantName}" في بوابة خورفكان الإدارية. تاريخ اليوم: ${today}
${customInstructions ? `\nتعليمات إضافية من الإدارة يجب الالتزام بها:\n${customInstructions}\n` : ''}

القاعات المتاحة لحجزها:
${roomsList}

فئات طلبات مكتب التنسيق والمتابعة المتاحة:
${categoriesList}

${
  audioBase64
    ? 'الطلب مُرسَل كرسالة صوتية. استمع لها جيدًا، افهم المطلوب منها، واكتب في transcript نص كلام المستخدم بالحرف كما سمعته (بنفس اللغة اللي اتكلم بيها).'
    : ''
}

اقرأ طلب المستخدم وحدد intent واحد من دول:
- "booking": حجز قاعة من القائمة فوق — لازم يكون واضح فيه القاعة والتاريخ والوقت
- "request": أي طلب تاني لمكتب التنسيق والمتابعة (صيانة، تنسيق فعالية، طلب إداري...) — حاول تحدد أقرب فئة من القائمة فوق
- "clarify": لو المعلومات ناقصة أو الطلب غامض (حدد إيه الناقص بالظبط في clarify_message)

أرجع رد بصيغة JSON فقط بدون أي نص أو علامات كود خارج الـ JSON، بالشكل ده بالظبط (لازم يكون فيه transcript دايمًا):

لحجز قاعة:
{"intent":"booking","room_id":"...","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","title":"...","clarify_message":"","transcript":""}

لطلب تنسيق ومتابعة:
{"intent":"request","category_id":"...","title":"عنوان مختصر للطلب","description":"وصف الطلب بالتفصيل","clarify_message":"","transcript":""}

للتوضيح:
{"intent":"clarify","clarify_message":"سؤال التوضيح هنا","transcript":""}

${message ? `طلب المستخدم: "${message}"` : ''}`;

  let parsed: {
    intent: 'booking' | 'request' | 'clarify';
    room_id?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    title?: string;
    category_id?: string;
    description?: string;
    clarify_message?: string;
    transcript?: string;
  };

  try {
    const text = audioBase64
      ? await callGeminiAudio(geminiKey, prompt, audioBase64, mimeType || 'audio/webm')
      : await callGeminiText(geminiKey, prompt);
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return NextResponse.json({
      ok: false,
      error: `تعذر ${audioBase64 ? 'تحليل الرسالة الصوتية' : 'الاتصال بالمساعد الذكي'}: ${msg || 'حاول تصيغ طلبك بشكل أوضح'}`,
    });
  }

  const transcript = parsed.transcript || '';

  if (parsed.intent === 'clarify') {
    return NextResponse.json({ ok: false, message: parsed.clarify_message || 'محتاج توضيح أكتر لطلبك.', transcript });
  }

  if (parsed.intent === 'booking') {
    if (!parsed.room_id || !parsed.date || !parsed.start_time || !parsed.end_time) {
      return NextResponse.json({ ok: false, message: 'محتاج تحدد القاعة والتاريخ والوقت بوضوح أكتر.', transcript });
    }

    const room = (rooms as { id: string; booking_policy_message?: string | null }[] | null)?.find(
      (r) => r.id === parsed.room_id
    );
    const policyMessage = room?.booking_policy_message?.trim() || DEFAULT_BOOKING_POLICY_MESSAGE_AR;

    return NextResponse.json({
      ok: false,
      transcript,
      pendingBooking: {
        room_id: parsed.room_id,
        title: parsed.title || 'حجز عبر المساعد الذكي',
        date: parsed.date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
      },
      message: `📋 ${policyMessage}\n\nهل توافق على الحجز بهذا الشرط؟ اكتب "نعم" للتأكيد أو "لا" للإلغاء.`,
    });
  }

  if (parsed.intent === 'request') {
    if (!parsed.title) {
      return NextResponse.json({ ok: false, message: 'محتاج توضح طلبك أكتر شوية.', transcript });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('requests')
      .insert({
        title: parsed.title,
        description: parsed.description || null,
        category_id: parsed.category_id || null,
        created_by: userId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, transcript });
    }

    if (inserted?.id) {
      notifyRequestCreated(inserted.id).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      transcript,
      message: `✅ تم إرسال طلبك "${parsed.title}" لمكتب التنسيق والمتابعة، وهيتم متابعته قريبًا. هيوصلك إيميل تأكيد وإيميل تاني لما يخلص التنفيذ.`,
    });
  }

  return NextResponse.json({ ok: false, message: 'لم أفهم طلبك، حاول تصيغه بشكل مختلف.', transcript });
}
