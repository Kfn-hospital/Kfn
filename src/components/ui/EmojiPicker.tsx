'use client';

import { useEffect, useRef, useState } from 'react';

interface EmojiPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  title?: string;
}

// زر بيعرض شكل الأيقونة الحالي، وبيفتح شبكة اختيار سريعة من أشكال جاهزة.
// لسه فيه حقل كتابة يدوي جوه القائمة لمن حد عايز إيموجي مش موجود في القائمة.
export default function EmojiPicker({ value, onChange, options, className, title }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={
          className ||
          'w-10 h-10 shrink-0 rounded-lg bg-[var(--c-surface)] border border-[var(--c-border)] flex items-center justify-center text-lg hover:bg-[var(--c-surface-muted)]'
        }
      >
        {value || options[0]}
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl p-2 w-60">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-[var(--c-surface-muted)] ${
                  value === opt ? 'ring-2 ring-[var(--c-teal-600)]' : ''
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={4}
            placeholder="✏️"
            className="w-full border rounded-lg px-2 py-1 text-center text-sm"
          />
        </div>
      )}
    </div>
  );
}
