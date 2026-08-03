'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { localDb } from '@/lib/data/local-store';
import {
  splitSessionDateTime,
  validateEditSessionDate,
} from '@/lib/session-validation';
import type { Session } from '@/lib/types';

interface SessionEditModalProps {
  session: Session | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SessionEditModal({ session, open, onClose, onSaved }: SessionEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ session_date: '', session_time: '10:00', notes: '' });

  useEffect(() => {
    if (session) {
      const { date, time } = splitSessionDateTime(session.session_date);
      setForm({ session_date: date, session_time: time, notes: session.notes ?? '' });
      setError('');
    }
  }, [session]);

  if (!session) return null;

  const clientSessions = localDb.getSessionsChronological(session.client_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateEditSessionDate(
      clientSessions,
      session.id,
      form.session_date,
      form.session_time
    );
    if (!validation.valid) {
      setError(validation.message ?? 'Date invalide');
      return;
    }

    setLoading(true);
    const sessionDateTime = new Date(`${form.session_date}T${form.session_time}:00`).toISOString();
    localDb.updateSession(session.id, {
      session_date: sessionDateTime,
      notes: form.notes || null,
    });
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-[#86868B] hover:bg-black/[0.04]"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-[18px] font-medium text-[#1D1D1F]">
              Modifier la séance n°{session.session_number}
            </h3>
            <p className="mt-1 text-[13px] text-[#86868B]">
              La date doit rester dans l&apos;ordre chronologique des séances.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Date"
                  type="date"
                  value={form.session_date}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, session_date: e.target.value }));
                    setError('');
                  }}
                  required
                />
                <Input
                  label="Heure"
                  type="time"
                  value={form.session_time}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, session_time: e.target.value }));
                    setError('');
                  }}
                  required
                />
              </div>

              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Objectifs de la séance..."
              />

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit" loading={loading}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
