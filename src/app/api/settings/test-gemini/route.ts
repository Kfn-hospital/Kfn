import { NextResponse } from 'next/server';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

export async function POST(request: Request) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Missing API key' }, { status: 400 });
  }

  let lastError = 'Request failed';

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }],
          }),
        }
      );

      const json = await res.json();

      if (res.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
        return NextResponse.json({ ok: true });
      }

      lastError = json.error?.message ?? `فشل مع نموذج ${model}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: 200 });
}
