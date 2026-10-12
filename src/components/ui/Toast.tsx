'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { errorMessage } from '@/lib/db/errors';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (error: unknown) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = ++counter;
      setItems((all) => [...all.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (e) => push('error', typeof e === 'string' ? e : errorMessage(e)),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-pop',
                t.tone === 'error' ? 'border-danger/25' : 'border-line'
              )}
            >
              {t.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              {t.tone === 'error' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
              {t.tone === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
              <p className="flex-1 text-[13px] leading-relaxed text-ink">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink" aria-label="Fermer">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
