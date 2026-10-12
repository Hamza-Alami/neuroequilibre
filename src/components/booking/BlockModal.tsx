'use client';

import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { toAppError } from '@/lib/db/errors';
import { createBlock } from '@/lib/db/settings';
import { todayKey, toUtcIso } from '@/lib/time';

export interface BlockDraft {
  boxId: string | null;
  date: string;
  start: string;
  end: string;
}

export function BlockModal({
  draft,
  onClose,
  onCreated,
}: {
  draft: BlockDraft | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { boxes } = useApp();
  const toast = useToast();
  const [boxId, setBoxId] = useState('');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [loadedDraft, setLoadedDraft] = useState<BlockDraft | null>(null);
  if (draft && draft !== loadedDraft) {
    setLoadedDraft(draft);
    setBoxId(draft.boxId ?? '');
    setStartDate(draft.date);
    setEndDate(draft.date);
    setStart(draft.start);
    setEnd(draft.end);
    setReason('');
    setError(null);
  }

  async function submit() {
    setError(null);
    const startsAt = toUtcIso(startDate, start);
    const endsAt = toUtcIso(endDate, end);
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('La fin du blocage doit être après son début.');
      return;
    }
    setSaving(true);
    try {
      await createBlock({ box_id: boxId || null, starts_at: startsAt, ends_at: endsAt, reason: reason.trim() || null });
      toast.success('Créneau bloqué.');
      onCreated();
      onClose();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(draft)}
      onClose={onClose}
      title="Bloquer un créneau"
      description="Aucune réservation ne pourra être faite pendant cette période (le créneau apparaît grisé)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Bloquer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Box concerné">
          <Select value={boxId} onChange={(e) => setBoxId(e.target.value)}>
            <option value="">Tout le centre (tous les boxes)</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {!b.is_active ? ' (désactivé)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Date de début">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          </Field>
          <Field label="Heure">
            <Input type="time" value={start} step={300} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Date de fin">
            <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Heure">
            <Input type="time" value={end} step={300} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Motif" hint="Visible dans le planning (ex. maintenance, formation, congé).">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance du matériel" />
        </Field>
      </div>
    </Modal>
  );
}
