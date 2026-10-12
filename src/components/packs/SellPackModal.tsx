'use client';

import { Check, Gift, Package } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { listPacks, PAYMENT_METHODS, sellPack } from '@/lib/db/packs';
import { useAsync } from '@/lib/hooks';
import { formatMoney, parseAmount } from '@/lib/money';
import { todayKey } from '@/lib/time';
import type { Pack, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SellPackModal({
  open,
  clientId,
  clientName,
  onClose,
  onSold,
}: {
  open: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSold: () => void;
}) {
  const { settings, isAdmin } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const packs = useAsync(() => (open ? listPacks() : Promise.resolve([] as Pack[])), [open]);

  const [packId, setPackId] = useState('');
  const [offered, setOffered] = useState('0');
  const [agreed, setAgreed] = useState('');
  const [soldOn, setSoldOn] = useState(todayKey());
  const [advance, setAdvance] = useState('');
  const [advanceOn, setAdvanceOn] = useState(todayKey());
  const [method, setMethod] = useState<PaymentMethod>('especes');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);

  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setPackId('');
      setOffered('0');
      setAgreed('');
      setSoldOn(todayKey());
      setAdvance('');
      setAdvanceOn(todayKey());
      setMethod('especes');
      setNotes('');
      setError(null);
    }
  }

  const pack = packs.data?.find((p) => p.id === packId) ?? null;
  const offeredN = offered.trim() === '' ? 0 : Number(offered);
  const agreedN = agreed.trim() === '' ? (pack?.reference_price ?? 0) : parseAmount(agreed);
  const advanceN = advance.trim() === '' ? 0 : parseAmount(advance);
  const discount = pack && Number.isFinite(agreedN) ? pack.reference_price - agreedN : 0;
  const remaining = Number.isFinite(agreedN) && Number.isFinite(advanceN) ? agreedN - advanceN : NaN;

  function choose(p: Pack) {
    setPackId(p.id);
    setAgreed(String(p.reference_price));
    setError(null);
  }

  async function submit() {
    if (!pack) return setError('Choisissez un pack.');
    if (!Number.isInteger(offeredN) || offeredN < 0) return setError('Le nombre de séances offertes doit être un entier positif ou nul.');
    if (!Number.isFinite(agreedN) || agreedN < 0) return setError('Montant convenu invalide.');
    if (!Number.isFinite(advanceN) || advanceN < 0) return setError('Montant de l’avance invalide.');
    if (advanceN > agreedN) return setError('L’avance ne peut pas dépasser le montant convenu.');
    if (advanceN > 0 && advanceOn > todayKey()) return setError('La date de règlement ne peut pas être dans le futur.');
    if (!soldOn) return setError('Indiquez la date de vente.');
    setSaving(true);
    setError(null);
    try {
      await sellPack({
        clientId,
        packId: pack.id,
        offeredSessions: offeredN,
        agreedPrice: agreedN,
        soldOn,
        notes,
        advance: advanceN,
        advanceOn,
        method,
      });
      toast.success(`${pack.name} attribué à ${clientName}.`);
      onSold();
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
      size="lg"
      title="Attribuer un pack"
      description={clientName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={!pack}>
            Enregistrer la vente
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <p className="mb-2.5 text-[13px] font-medium text-ink-soft">1. Choisir le pack</p>
          {packs.loading ? (
            <Spinner className="h-4 w-4" />
          ) : !packs.data?.length ? (
            <EmptyState
              icon={Package}
              title="Aucun pack disponible"
              description={isAdmin ? 'Créez vos packs depuis la page Packs.' : 'L’administrateur doit d’abord créer les packs.'}
              action={isAdmin && <Button href="/packs">Gérer les packs</Button>}
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {packs.data.map((p) => {
                const active = p.id === packId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    className={cn(
                      'relative rounded-xl border p-3.5 text-left transition-colors',
                      active ? 'border-navy bg-navy-50/60 ring-2 ring-navy/15' : 'border-line hover:border-line-strong hover:bg-surface-muted'
                    )}
                  >
                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <p className="pr-6 text-[14px] font-semibold text-ink">{p.name}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {p.session_count} séance{p.session_count > 1 ? 's' : ''}
                    </p>
                    <p className="tabular mt-2 text-[15px] font-semibold text-navy">{formatMoney(p.reference_price, currency)}</p>
                    {p.description && <p className="mt-1 line-clamp-2 text-[12px] text-ink-muted">{p.description}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {pack && (
          <>
            <section>
              <p className="mb-2.5 text-[13px] font-medium text-ink-soft">2. Conditions convenues</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Séances offertes" hint={`Total : ${pack.session_count + (Number.isInteger(offeredN) ? offeredN : 0)} séances`}>
                  <Input type="number" min={0} step={1} value={offered} onChange={(e) => setOffered(e.target.value)} />
                </Field>
                <Field
                  label={`Montant convenu (${currency})`}
                  hint={
                    discount > 0
                      ? `Remise de ${formatMoney(discount, currency)} sur le tarif`
                      : discount < 0
                        ? `${formatMoney(-discount, currency)} au-dessus du tarif`
                        : 'Tarif de référence'
                  }
                >
                  <Input inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value)} className="tabular" />
                </Field>
                <Field label="Date de vente" required>
                  <Input type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <p className="mb-2.5 text-[13px] font-medium text-ink-soft">3. Avance réglée</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={`Montant (${currency})`} hint="Laisser vide si aucune avance.">
                  <Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" className="tabular" />
                </Field>
                <Field label="Date du règlement">
                  <Input type="date" max={todayKey()} value={advanceOn} onChange={(e) => setAdvanceOn(e.target.value)} disabled={!advanceN} />
                </Field>
                <Field label="Mode de paiement">
                  <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} disabled={!advanceN}>
                    {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <Field label="Remarques">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>

            <div className="grid gap-3 rounded-xl border border-line bg-surface-muted p-4 sm:grid-cols-3">
              <Summary label="Séances" value={`${pack.session_count}${offeredN > 0 ? ` + ${offeredN}` : ''}`} icon={offeredN > 0} />
              <Summary label="Montant convenu" value={Number.isFinite(agreedN) ? formatMoney(agreedN, currency) : '—'} />
              <Summary
                label="Reste à payer"
                value={Number.isFinite(remaining) ? formatMoney(Math.max(remaining, 0), currency) : '—'}
                strong
              />
            </div>
          </>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

function Summary({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: boolean }) {
  return (
    <div>
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className={cn('tabular mt-0.5 flex items-center gap-1.5 text-[16px] font-semibold', strong ? 'text-gold-700' : 'text-ink')}>
        {value}
        {icon && <Gift className="h-4 w-4 text-gold" />}
      </p>
    </div>
  );
}
