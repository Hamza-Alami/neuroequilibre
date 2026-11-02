'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { cancelInvoice } from '@/lib/db/invoices';
import type { Invoice } from '@/lib/types';

export function CancelInvoiceModal({ invoice, onClose, onCancelled }: { invoice: Invoice | null; onClose: () => void; onCancelled: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  if ((invoice?.id ?? null) !== openedFor) {
    setOpenedFor(invoice?.id ?? null);
    setReason('');
    setError(null);
  }

  async function submit() {
    if (!invoice) return;
    if (!reason.trim()) return setError('Indiquez le motif de l’annulation.');
    setSaving(true);
    setError(null);
    try {
      await cancelInvoice(invoice.id, reason);
      toast.success(`Facture ${invoice.number} annulée.`);
      onCancelled();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      size="sm"
      title={`Annuler la facture ${invoice?.number ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Retour
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Annuler la facture
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-[13px] leading-relaxed text-ink-soft">
          La facture reste dans l’historique avec la mention « annulée » et son numéro n’est pas réutilisé. Vous pourrez ensuite en
          établir une nouvelle pour ce pack.
        </p>
        <Field label="Motif" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex. : erreur sur la raison sociale" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
