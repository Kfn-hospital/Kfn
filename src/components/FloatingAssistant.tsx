'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface AssistantMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'assistant';
  type: 'text' | 'voice';
  content: string | null;
  audio_url: string | null;
  duration: number | null;
  created_at: string;
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VoiceBubble({ url, duration }: { url: string; duration: number | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }

  return (
    <div className="flex items-center gap-2 min-w-[170px]">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          // إصلاح لمشكلة معروفة في كروم: ملفات webm من MediaRecorder بترجع duration = Infinity
          if (!Number.isFinite(el.duration)) {
            const fixDuration = () => {
              el.currentTime = 0;
              el.removeEventListener('timeupdate', fixDuration);
            };
            el.addEventListener('timeupdate', fixDuration);
            el.currentTime = 1e101;
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration) && el.duration > 0) setProgress(el.currentTime / el.duration);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 shrink-0 rounded-full bg-black/10 flex items-center justify-center"
      >
        {playing ? '⏸' : '▶️'}
      </button>
      <div className="flex-1 h-5 flex items-center gap-[2px] overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="w-[2px] rounded-full bg-current"
            style={{
              height: `${5 + ((i * 37) % 13)}px`,
              opacity: i / 22 <= progress ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <span className="text-[10px] shrink-0 opacity-80">{duration ? formatClock(duration) : ''}</span>
    </div>
  );
}

export default function FloatingAssistant() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const supabase = createClient();

  const [userId, setUserId] = useState('');
  const [visible, setVisible] = useState(true);
  const [iconEmoji, setIconEmoji] = useState('🤖');
  const [iconUrl, setIconUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecondsRef = useRef(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['icon_show_assistant', 'assistant_icon_emoji', 'assistant_icon_url']);
      (data as { key: string; value: string | null }[] | null)?.forEach((row) => {
        if (row.key === 'icon_show_assistant') setVisible(row.value !== 'false');
        if (row.key === 'assistant_icon_emoji' && row.value) setIconEmoji(row.value);
        if (row.key === 'assistant_icon_url' && row.value) setIconUrl(row.value);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pathname === '/assistant') setOpen(true);
  }, [pathname]);

  async function loadMessages(uid: string) {
    const { data } = await supabase
      .from('assistant_messages')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as AssistantMessage[]) || []);
  }

  useEffect(() => {
    if (userId && open) loadMessages(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function insertMessage(row: Partial<AssistantMessage>) {
    const { data } = await supabase
      .from('assistant_messages')
      .insert({ user_id: userId, ...row })
      .select()
      .single();
    if (data) setMessages((prev) => [...prev, data as AssistantMessage]);
    return data;
  }

  async function handleSend() {
    if (!text.trim() || !userId || sending) return;
    const outgoing = text.trim();
    setText('');
    setSending(true);
    await insertMessage({ sender: 'user', type: 'text', content: outgoing });
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: outgoing, userId }),
      });
      const json = await res.json();
      await insertMessage({
        sender: 'assistant',
        type: 'text',
        content: json.message || json.error || t('errorOccurred'),
      });
    } catch (err) {
      await insertMessage({
        sender: 'assistant',
        type: 'text',
        content: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordSecondsRef.current = 0;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const finalDuration = recordSecondsRef.current;
        setRecording(false);
        setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0 || !userId) return;
        const path = `${userId}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('voice-messages')
          .upload(path, blob, { contentType: 'audio/webm' });
        if (uploadError) return;
        const { data: pub } = supabase.storage.from('voice-messages').getPublicUrl(path);
        await insertMessage({ sender: 'user', type: 'voice', audio_url: pub.publicUrl, duration: finalDuration });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
      }, 1000);
    } catch {
      window.alert(t('micPermissionDenied'));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  if (!userId || !visible) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 end-5 z-40 w-[92vw] max-w-[360px] h-[70vh] max-h-[520px] bg-[var(--c-surface)] rounded-2xl shadow-2xl border border-[var(--c-border)] flex flex-col overflow-hidden">
          <div className="bg-[var(--c-teal-700)] text-white px-4 py-3 flex items-center justify-between shrink-0">
            <span className="font-extrabold text-sm flex items-center gap-1.5">
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                iconEmoji
              )}
              {t('aiAssistantTitle')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-[var(--c-bg)]">
            {!messages.length && (
              <p className="text-center text-xs text-[var(--c-text-muted)] mt-6">{t('assistantChatEmpty')}</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === 'user'
                    ? 'self-end bg-[var(--c-teal-600)] text-white rounded-br-sm'
                    : 'self-start bg-[var(--c-surface-muted)] text-[var(--c-text)] rounded-bl-sm'
                }`}
              >
                {m.type === 'voice' && m.audio_url ? (
                  <VoiceBubble url={m.audio_url} duration={m.duration} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-[var(--c-border)] bg-[var(--c-surface)] shrink-0">
            {recording ? (
              <div className="flex items-center gap-2 px-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-[var(--c-text)] flex-1">
                  {t('recordingInProgress')} · {formatClock(recordSeconds)}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-9 h-9 rounded-full bg-[var(--c-teal-700)] text-white flex items-center justify-center"
                >
                  ⏹
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t('aiAssistantPlaceholder')}
                  className="flex-1 border rounded-full px-3 py-2 text-sm"
                />
                {text.trim() ? (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending}
                    className="w-9 h-9 shrink-0 rounded-full bg-[var(--c-teal-700)] text-white flex items-center justify-center disabled:opacity-50"
                  >
                    ➤
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    title={t('recordVoice')}
                    className="w-9 h-9 shrink-0 rounded-full bg-[var(--c-teal-700)] text-white flex items-center justify-center"
                  >
                    🎙️
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t('aiAssistantTitle')}
        className="fixed bottom-5 end-5 z-40 w-14 h-14 rounded-full bg-[var(--c-teal-700)] text-white shadow-2xl flex items-center justify-center text-2xl hover:scale-105 transition-transform overflow-hidden"
      >
        {open ? (
          '×'
        ) : iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          iconEmoji
        )}
      </button>
    </>
  );
}
