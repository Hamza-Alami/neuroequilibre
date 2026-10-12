'use client';

import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { updateClientPack } from '@/lib/db/packs';
import { formatMoney, parseAmount } from '@/lib/money';
import type { ClientPack } from '@/lib/types';

export function EditClientPackModal({ pack, onClose, onSaved }: { pack: ClientPack | null; onClose: () => void; onSaved: () => void }) {
  const { settings } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const [offered, setOffered] = useState('0');
  const [agreed, setAgreed] = useState('');
  const [soldOn, setSoldOn] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  if ((pack?.id ?? null) !== openedFor) {
    setOpenedFor(pack?.id ?? null);
    if (pack) {
      setOffered(String(pack.offered_sessions));
      setAgreed(String(pack.agreed_price));
      setSoldOn(pack.sold_on);
      setNotes(pack.notes ?? '');
      setError(null);
    }
  }

  async function submit() {
    if (!pack) return;
    const offeredN = Number(offered);
    const agreedN = parseAmount(agreed);
    if (!Number.isInteger(offeredN) || offeredN < 0) return setError('Le nombre de séances offertes doit être un entier positif ou nul.');
    if (!Number.isFinite(agreedN)) return setError('Montant convenu invalide.');
    if (agreedN < pack.paid_amount) {
      return setError(`Le montant convenu ne peut pas être inférieur au total déjà réglé (${formatMoney(pack.paid_amount, currency)}).`);
    }
    if (!soldOn) return setError('Indiquez la date de vente.');
    setSaving(true);
    setError(null);
    try {
      await updateClientPack(pack.id, { offered_sessions: offeredN, agreed_price: agreedN, sold_on: soldOn, notes: notes.trim() || null });
      toast.success('Pack mis à jour.');
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
      open={Boolean(pack)}
      onClose={onClose}
      size="sm"
      title="Modifier le pack vendu"
      description={pack ? `${pack.pack_name} · tarif de référence ${formatMoney(pack.reference_price, currency)}` : undefined}
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
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Séances offertes">
            <Input type="number" min={0} step={1} value={offered} onChange={(e) => setOffered(e.target.value)} />
          </Field>
          <Field label={`Montant convenu (${currency})`}>
            <Input inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value)} className="tabular" />
          </Field>
        </div>
        <Field label="Date de vente">
          <Input type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />
        </Field>
        <Field label="Remarques">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
