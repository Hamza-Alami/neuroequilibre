'use client';

import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { addPayment, PAYMENT_METHODS } from '@/lib/db/packs';
import { formatMoney, parseAmount } from '@/lib/money';
import { todayKey } from '@/lib/time';
import type { ClientPack, PaymentMethod } from '@/lib/types';

export function PaymentModal({ pack, onClose, onSaved }: { pack: ClientPack | null; onClose: () => void; onSaved: () => void }) {
  const { settings } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayKey());
  const [method, setMethod] = useState<PaymentMethod>('especes');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  if ((pack?.id ?? null) !== openedFor) {
    setOpenedFor(pack?.id ?? null);
    if (pack) {
      setAmount(pack.remaining_amount > 0 ? String(pack.remaining_amount) : '');
      setPaidOn(todayKey());
      setMethod('especes');
      setNote('');
      setError(null);
    }
  }

  async function submit() {
    if (!pack) return;
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Saisissez un montant valide.');
    if (value > pack.remaining_amount) {
      return setError(`Le montant dépasse le reste à payer (${formatMoney(pack.remaining_amount, currency)}).`);
    }
    if (!paidOn || paidOn > todayKey()) return setError('La date de règlement ne peut pas être dans le futur.');
    setSaving(true);
    setError(null);
    try {
      await addPayment({ clientPackId: pack.id, amount: value, paidOn, method, note });
      toast.success('Règlement enregistré.');
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
      title="Enregistrer un règlement"
      description={pack ? `${pack.pack_name} · reste ${formatMoney(pack.remaining_amount, currency)}` : undefined}
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
        <Field label={`Montant (${currency})`} required>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="tabular" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date du règlement" required>
            <Input type="date" max={todayKey()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="Mode de paiement">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Remarque">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° de chèque, référence…" />
        </Field>
      </div>
    </Modal>
  );
}
