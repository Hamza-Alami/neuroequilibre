'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { localDb } from '@/lib/data/local-store';
import {
  getMinBookingDefaults,
  validateNewSessionDate,
} from '@/lib/session-validation';
import type { Client } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils';

export function SessionBookingForm({ preselectedClientId }: { preselectedClientId?: string }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [form, setForm] = useState({
    client_id: preselectedClientId ?? '',
    session_date: '',
    session_time: '10:00',
    is_first_session: false,
    notes: '',
  });

  useEffect(() => {
    setClients(localDb.getClients());
    if (preselectedClientId) {
      setForm((prev) => ({ ...prev, client_id: preselectedClientId }));
    }
  }, [preselectedClientId]);

  const clientSessions = form.client_id
    ? localDb.getSessionsChronological(form.client_id)
    : [];

  const selectedClient = clients.find((c) => c.id === form.client_id);
  const isFirstByDefault = clientSessions.length === 0;
  const latestSession = clientSessions[clientSessions.length - 1];
  const minDefaults = useMemo(
    () => (form.client_id ? getMinBookingDefaults(clientSessions) : null),
    [form.client_id, clientSessions]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.session_date) return;

    const validation = validateNewSessionDate(
      clientSessions,
      form.session_date,
      form.session_time
    );
    if (!validation.valid) {
      setDateError(validation.message ?? 'Date invalide');
      return;
    }

    setLoading(true);
    const sessionDateTime = new Date(`${form.session_date}T${form.session_time}:00`).toISOString();

    const session = localDb.createSession({
      client_id: form.client_id,
      session_date: sessionDateTime,
      is_first_session: form.is_first_session || isFirstByDefault,
      notes: form.notes || undefined,
    });

    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);

    if (session.is_first_session) {
      router.push(`/clients/${form.client_id}/onboarding/${session.id}`);
    } else {
      router.push(`/clients/${form.client_id}`);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <Select
        label="Client"
        value={form.client_id}
        onChange={(e) => {
          setForm((prev) => ({ ...prev, client_id: e.target.value }));
          setDateError('');
        }}
        options={[
          { value: '', label: 'Sélectionner un client...' },
          ...clients.map((c) => ({
            value: c.id,
            label: `${c.first_name} ${c.last_name} — ${c.email}`,
          })),
        ]}
      />

      {selectedClient && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl bg-[#E8F4FA]/40 p-4 space-y-1"
        >
          <p className="text-[13px] text-[#86868B]">
            {selectedClient.city}, {selectedClient.country} ·{' '}
            {clientSessions.length} séance{clientSessions.length !== 1 ? 's' : ''}
          </p>
          {latestSession && (
            <p className="text-[12px] text-[#5A8FA8]">
              Dernière séance : {formatDateTime(latestSession.session_date)}
              {minDefaults && (
                <span className="text-[#86868B]">
                  {' '}· Prochaine disponible après le {minDefaults.minDate} à {minDefaults.minTime}
                </span>
              )}
            </p>
          )}
        </motion.div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Date de la séance"
          type="date"
          value={form.session_date}
          min={minDefaults?.minDate}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, session_date: e.target.value }));
            setDateError('');
          }}
          error={dateError && form.session_date ? dateError : undefined}
          required
        />
        <Input
          label="Heure"
          type="time"
          value={form.session_time}
          min={
            minDefaults && form.session_date === minDefaults.minDate
              ? minDefaults.minTime
              : undefined
          }
          onChange={(e) => {
            setForm((prev) => ({ ...prev, session_time: e.target.value }));
            setDateError('');
          }}
          required
        />
      </div>

      {dateError && !form.session_date && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{dateError}</p>
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/[0.04] bg-white/60 p-4">
        <input
          type="checkbox"
          checked={form.is_first_session || isFirstByDefault}
          onChange={(e) => setForm((prev) => ({ ...prev, is_first_session: e.target.checked }))}
          disabled={isFirstByDefault}
          className="h-4 w-4 rounded border-[#D1D1D6] accent-[#7EB8DA]"
        />
        <div>
          <p className="text-[14px] font-medium text-[#1D1D1F]">Première séance</p>
          <p className="text-[12px] text-[#86868B]">
            {isFirstByDefault
              ? 'Première séance — le questionnaire d\'évaluation sera proposé'
              : 'Cocher si c\'est la première séance de ce client'}
          </p>
        </div>
      </label>

      <Textarea
        label="Notes (optionnel)"
        value={form.notes}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="Objectifs de la séance..."
      />

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={loading} disabled={!form.client_id || !form.session_date}>
          Réserver la séance
        </Button>
      </div>
    </motion.form>
  );
}

export function ClientSearchList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setClients(localDb.getClients());
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <Input
        label="Rechercher un client"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nom, prénom ou email..."
      />
      <div className="mt-4 space-y-2">
        {filtered.map((client, i) => (
          <motion.a
            key={client.id}
            href={`/clients/${client.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between rounded-2xl border border-black/[0.04] bg-white/60 p-4 transition-all hover:bg-white hover:shadow-sm"
          >
            <div>
              <p className="text-[15px] font-medium text-[#1D1D1F]">
                {client.first_name} {client.last_name}
              </p>
              <p className="text-[13px] text-[#86868B]">
                {client.email} · {client.city}
              </p>
            </div>
            <span className="text-[12px] text-[#86868B]">
              {formatDate(client.created_at)}
            </span>
          </motion.a>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-[14px] text-[#86868B]">
            Aucun client trouvé
          </p>
        )}
      </div>
    </div>
  );
}
