'use client';

import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  MessageCircle,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { BoxTag, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { toAppError } from '@/lib/db/errors';
import { deleteSession, setSessionStatus } from '@/lib/db/sessions';
import { displayStatus } from '@/lib/status';
import { formatCalendarDate, dateKey, formatTime, sessionEnd } from '@/lib/time';
import type { SessionWithRelations } from '@/lib/types';
import { fullName } from '@/lib/utils';
import { SessionMessageModal } from '@/components/messages/SessionMessageModal';
import { SessionForm } from './SessionForm';

type Pending = 'cancel' | 'delete' | null;

export function SessionDetailModal({
  session,
  onClose,
  onChanged,
}: {
  session: SessionWithRelations | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { isAdmin, boxById } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);

  const close = () => {
    setEditing(false);
    setMessaging(false);
    setError(null);
    onClose();
  };

  if (!session) return <Modal open={false} onClose={close}>{null}</Modal>;

  const status = displayStatus(session);
  const box = session.box ?? boxById.get(session.box_id) ?? null;
  const end = sessionEnd(session.starts_at, session.duration_minutes);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success(success);
      setPending(null);
      onChanged();
      close();
    } catch (e) {
      setPending(null);
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        size={editing ? 'lg' : 'md'}
        title={editing ? 'Modifier la séance' : fullName(session.client)}
        description={
          editing
            ? `${fullName(session.client)} · ${formatCalendarDate(dateKey(session.starts_at), 'd MMMM yyyy')}`
            : session.session_number
              ? `Séance n°${session.session_number}`
              : 'Séance annulée'
        }
      >
        {editing ? (
          <SessionForm
            mode="edit"
            variant="modal"
            session={session}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              toast.success('Séance mise à jour.');
              onChanged();
              close();
            }}
          />
        ) : (
          <div className="space-y-5">
            {error && <Alert tone="error">{error}</Alert>}
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-muted p-4">
              <div>
                <p className="text-[12px] text-ink-muted">Date</p>
                <p className="mt-0.5 text-[14px] font-medium capitalize text-ink">
                  {formatCalendarDate(dateKey(session.starts_at), 'EEEE d MMMM yyyy')}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Horaire</p>
                <p className="tabular mt-0.5 text-[14px] font-medium text-ink">
                  {formatTime(session.starts_at)} – {formatTime(end)}{' '}
                  <span className="font-normal text-ink-muted">({session.duration_minutes} min)</span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Box</p>
                <div className="mt-0.5">{box ? <BoxTag name={box.name} color={box.color} /> : '—'}</div>
              </div>
              <div>
                <p className="text-[12px] text-ink-muted">Statut</p>
                <div className="mt-1">
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>

            {session.gap_override && (
              <p className="flex items-center gap-2 text-[12px] text-warning">
                <CalendarClock className="h-3.5 w-3.5" />
                Réservée malgré l’alerte d’écart entre séances.
              </p>
            )}

            {session.notes && (
              <div>
                <p className="mb-1 text-[12px] font-medium text-ink-muted">Notes</p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">{session.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={UserRound} href={`/clients/${session.client_id}`}>
                Fiche client
              </Button>
              {session.status !== 'cancelled' && (
                <Button
                  variant="subtle"
                  size="sm"
                  icon={ClipboardEdit}
                  href={`/clients/${session.client_id}/evaluation/${session.id}`}
                >
                  {session.has_assessment ? 'Voir l’évaluation' : 'Remplir l’évaluation'}
                </Button>
              )}
              {status === 'upcoming' && (
                <Button variant="secondary" size="sm" icon={MessageCircle} onClick={() => setMessaging(true)}>
                  Confirmation / rappel
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              {session.status !== 'cancelled' && (
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                  Modifier
                </Button>
              )}
              {session.status === 'scheduled' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={CheckCircle2}
                  loading={busy && pending === null}
                  onClick={() => run(() => setSessionStatus(session.id, 'completed'), 'Séance marquée comme réalisée.')}
                >
                  Marquer réalisée
                </Button>
              )}
              {session.status === 'completed' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => run(() => setSessionStatus(session.id, 'scheduled'), 'Statut remis à « planifiée ».')}
                >
                  Remettre à planifiée
                </Button>
              )}
              {session.status !== 'cancelled' ? (
                <Button variant="ghost" size="sm" icon={Ban} onClick={() => setPending('cancel')} className="text-danger hover:bg-danger-50 hover:text-danger">
                  Annuler la séance
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => run(() => setSessionStatus(session.id, 'scheduled'), 'Séance rétablie.')}
                >
                  Rétablir
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setPending('delete')}
                  className="ml-auto text-danger hover:bg-danger-50 hover:text-danger"
                >
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pending === 'cancel'}
        title="Annuler cette séance ?"
        message="Le créneau sera libéré. La séance restera visible dans l’historique avec le statut « Annulée »."
        confirmLabel="Annuler la séance"
        cancelLabel="Retour"
        loading={busy}
        onConfirm={() => run(() => setSessionStatus(session.id, 'cancelled'), 'Séance annulée.')}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'delete'}
        title="Supprimer définitivement ?"
        message="La séance et son évaluation seront supprimées. Cette action est irréversible. Préférez « Annuler » pour garder une trace."
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => run(() => deleteSession(session.id), 'Séance supprimée.')}
        onCancel={() => setPending(null)}
      />
      <SessionMessageModal session={session} open={messaging} onClose={() => setMessaging(false)} />
    </>
  );
}
