'use client';

import { useState } from 'react';
import { ClientStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { listStatusChanges, setClientStatus } from '@/lib/db/status';
import { useAsync } from '@/lib/hooks';
import { fmt, formatCalendarDate, todayKey } from '@/lib/time';
import type { ClientStatusInfo, StatusMode } from '@/lib/types';

const MODE_LABELS: Record<StatusMode, string> = {
  active: 'Actif (forcé)',
  inactive: 'Inactif (forcé)',
  auto: 'Automatique',
};

export function StatusModal({
  open,
  clientId,
  clientName,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId: string;
  clientName: string;
  current: ClientStatusInfo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<StatusMode>('inactive');
  const [date, setDate] = useState(todayKey());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<boolean>(false);

  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setMode(current?.status === 'active' ? 'inactive' : current?.is_override ? 'auto' : 'active');
      setDate(todayKey());
      setReason('');
      setError(null);
    }
  }

  const history = useAsync(() => (open ? listStatusChanges(clientId) : Promise.resolve([])), [open, clientId]);

  async function submit() {
    if (!date) return setError('Indiquez la date à partir de laquelle le statut s’applique.');
    setSaving(true);
    setError(null);
    try {
      await setClientStatus(clientId, mode, date, reason);
      toast.success('Statut mis à jour.');
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statut du client"
      description={clientName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {current && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3">
            <div className="text-[13px]">
              <p className="text-ink-muted">Statut aujourd’hui</p>
              <p className="mt-0.5 text-ink">{current.reason}</p>
            </div>
            <ClientStatusBadge status={current.status} forced={current.is_override} />
          </div>
        )}

        <Alert tone="info">
          Par défaut, un client est <strong>actif</strong> tant qu’il a un pack en cours ou une séance prévue, et{' '}
          <strong>inactif</strong> sinon. Forcez le statut seulement en cas d’exception (abandon, pause, suivi hors pack…).
        </Alert>

        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Nouveau statut">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'active', label: 'Actif' },
              { value: 'inactive', label: 'Inactif' },
              { value: 'auto', label: 'Automatique' },
            ]}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="À partir du" required hint="Peut être une date passée.">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Motif" hint="Ex. : fin de suivi, abandon, pause estivale…">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </Field>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Historique</p>
          {history.loading ? (
            <Spinner className="h-4 w-4" />
          ) : !history.data?.length ? (
            <p className="text-[13px] text-ink-muted">Aucun changement manuel : statut entièrement automatique.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {history.data.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <div>
                    <p className="font-medium text-ink">{MODE_LABELS[h.mode]}</p>
                    {h.reason && <p className="text-ink-muted">{h.reason}</p>}
                  </div>
                  <div className="shrink-0 text-right text-[12px] text-ink-muted">
                    <p>dès le {formatCalendarDate(h.effective_date, 'd MMM yyyy')}</p>
                    <p>saisi le {fmt(h.created_at, 'dd/MM/yyyy')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
