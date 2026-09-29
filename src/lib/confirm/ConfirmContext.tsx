'use client';

// ============================================================
// نافذة تأكيد احترافية بديلة عن window.confirm() الافتراضية للمتصفح.
// الاستخدام: const confirm = useConfirm();
//            if (!(await confirm({ message: t('...'), danger: true }))) return;
// ============================================================

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [state, setState] = useState<ConfirmState>({ open: false, message: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function handleClose(result: boolean) {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state.open && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={() => handleClose(false)}
        >
          <div
            className="bg-[var(--c-surface)] text-[var(--c-text)] rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl ${
                  state.danger ? 'bg-red-100 text-red-600' : 'bg-[var(--c-teal-100)] text-[var(--c-teal-700)]'
                }`}
              >
                {state.danger ? '🗑️' : '❓'}
              </div>
              <div className="flex-1 pt-1">
                {state.title && <h3 className="font-extrabold text-base mb-1">{state.title}</h3>}
                <p className="text-sm text-[var(--c-text-muted)] leading-relaxed">{state.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--c-surface-muted)] hover:opacity-80 transition"
              >
                {state.cancelLabel || t('cancel')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition ${
                  state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--c-teal-700)] hover:opacity-90'
                }`}
              >
                {state.confirmLabel || t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm لازم تتنادى جوّه ConfirmProvider');
  return ctx;
}
