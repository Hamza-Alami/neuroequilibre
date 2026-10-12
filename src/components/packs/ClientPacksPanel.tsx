'use client';

import { Gift, Package, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { deleteClientPack, deletePayment, PAYMENT_METHODS } from '@/lib/db/packs';
import { formatMoney } from '@/lib/money';
import { formatCalendarDate } from '@/lib/time';
import type { ClientPack, PackPayment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EditClientPackModal } from './EditClientPackModal';
import { PaymentModal } from './PaymentModal';
import { SellPackModal } from './SellPackModal';

export function ClientPacksPanel({
  clientId,
  clientName,
  packs,
  payments,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  packs: ClientPack[];
  payments: PackPayment[];
  onChanged: () => void;
}) {
  const { settings, isAdmin } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const [selling, setSelling] = useState(false);
  const [paying, setPaying] = useState<ClientPack | null>(null);
  const [editing, setEditing] = useState<ClientPack | null>(null);
  const [toDelete, setToDelete] = useState<ClientPack | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<PackPayment | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = packs.reduce(
    (acc, p) => ({ agreed: acc.agreed + p.agreed_price, paid: acc.paid + p.paid_amount, remaining: acc.remaining + p.remaining_amount }),
    { agreed: 0, paid: 0, remaining: 0 }
  );

  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
      setToDelete(null);
      setPaymentToDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {packs.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-muted">
            <span>
              Total convenu <strong className="tabular text-ink">{formatMoney(totals.agreed, currency)}</strong>
            </span>
            <span>
              Réglé <strong className="tabular text-success">{formatMoney(totals.paid, currency)}</strong>
            </span>
            <span>
              Reste à payer{' '}
              <strong className={cn('tabular', totals.remaining > 0 ? 'text-gold-700' : 'text-ink')}>
                {formatMoney(totals.remaining, currency)}
              </strong>
            </span>
          </div>
        ) : (
          <span />
        )}
        <Button icon={Plus} onClick={() => setSelling(true)}>
          Attribuer un pack
        </Button>
      </div>

      {packs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Aucun pack attribué"
            description="Attribuez un pack pour suivre les séances restantes, les règlements et le montant restant à payer."
            action={<Button icon={Plus} onClick={() => setSelling(true)}>Attribuer un pack</Button>}
          />
        </Card>
      ) : (
        packs.map((p) => {
          const list = payments.filter((x) => x.client_pack_id === p.id);
          const remainingSessions = Math.max(p.total_sessions - p.used_sessions, 0);
          const usedPct = p.total_sessions ? Math.min(100, (p.used_sessions / p.total_sessions) * 100) : 0;
          const bookedPct = p.total_sessions ? Math.min(100, (p.booked_sessions / p.total_sessions) * 100) : 0;
          const paidPct = p.agreed_price ? Math.min(100, (p.paid_amount / p.agreed_price) * 100) : 100;
          const finished = p.used_sessions >= p.total_sessions;
          return (
            <Card key={p.id} padded={false} className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-ink">{p.pack_name}</h3>
                    {finished ? <Badge>Terminé</Badge> : <Badge tone="success" dot>En cours</Badge>}
                    {p.remaining_amount > 0 ? (
                      <Badge tone="warning">Impayé : {formatMoney(p.remaining_amount, currency)}</Badge>
                    ) : (
                      <Badge tone="success">Soldé</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Vendu le {formatCalendarDate(p.sold_on)} · tarif de référence {formatMoney(p.reference_price, currency)}
                    {p.notes && <> · {p.notes}</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" icon={Wallet} onClick={() => setPaying(p)} disabled={p.remaining_amount <= 0}>
                    Règlement
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} title="Modifier" onClick={() => setEditing(p)} />
                  {(isAdmin || list.length === 0) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      title="Supprimer"
                      onClick={() => setToDelete(p)}
                      className="text-ink-muted hover:bg-danger-50 hover:text-danger"
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-6 px-5 py-4 md:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-ink">Séances</span>
                    <span className="tabular text-ink-muted">
                      {p.used_sessions} effectuée{p.used_sessions > 1 ? 's' : ''} / {p.total_sessions}
                    </span>
                  </div>
                  <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-line/70">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-navy-100" style={{ width: `${bookedPct}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-navy" style={{ width: `${usedPct}%` }} />
                  </div>
                  <p className="mt-2 text-[12px] text-ink-muted">
                    {p.session_count} séances du pack
                    {p.offered_sessions > 0 && (
                      <span className="text-gold-700">
                        {' '}
                        + <Gift className="inline h-3 w-3" /> {p.offered_sessions} offerte{p.offered_sessions > 1 ? 's' : ''}
                      </span>
                    )}
                    {' · '}
                    {remainingSessions} restante{remainingSessions > 1 ? 's' : ''}
                    {p.booked_sessions > p.used_sessions && ` (dont ${p.booked_sessions - p.used_sessions} déjà réservée${p.booked_sessions - p.used_sessions > 1 ? 's' : ''})`}
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-ink">Paiement</span>
                    <span className="tabular text-ink-muted">
                      {formatMoney(p.paid_amount, currency)} / {formatMoney(p.agreed_price, currency)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/70">
                    <div className="h-full rounded-full bg-success" style={{ width: `${paidPct}%` }} />
                  </div>
                  <p className="mt-2 text-[12px] text-ink-muted">
                    Reste à payer :{' '}
                    <strong className={cn('tabular', p.remaining_amount > 0 ? 'text-gold-700' : 'text-success')}>
                      {formatMoney(p.remaining_amount, currency)}
                    </strong>
                  </p>
                </div>
              </div>

              {list.length > 0 && (
                <div className="border-t border-line bg-surface-muted/50 px-5 py-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Règlements</p>
                  <ul className="divide-y divide-line">
                    {list.map((x, i) => (
                      <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                        <span className="text-ink-soft">
                          {formatCalendarDate(x.paid_on, 'dd/MM/yyyy')} · {PAYMENT_METHODS[x.method]}
                          {i === 0 && <span className="text-ink-muted"> · avance</span>}
                          {x.note && <span className="text-ink-muted"> · {x.note}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular font-medium text-ink">{formatMoney(x.amount, currency)}</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setPaymentToDelete(x)}
                              className="rounded p-1 text-ink-muted hover:bg-danger-50 hover:text-danger"
                              aria-label="Supprimer le règlement"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })
      )}

      <SellPackModal open={selling} clientId={clientId} clientName={clientName} onClose={() => setSelling(false)} onSold={onChanged} />
      <PaymentModal pack={paying} onClose={() => setPaying(null)} onSaved={onChanged} />
      <EditClientPackModal pack={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Supprimer le pack « ${toDelete?.pack_name ?? ''} » ?`}
        message="La vente et ses règlements seront supprimés. Les séances du client ne sont pas affectées."
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => toDelete && run(() => deleteClientPack(toDelete.id), 'Pack supprimé.')}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="Supprimer ce règlement ?"
        message={paymentToDelete ? `${formatMoney(paymentToDelete.amount, currency)} du ${formatCalendarDate(paymentToDelete.paid_on)}.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => paymentToDelete && run(() => deletePayment(paymentToDelete.id), 'Règlement supprimé.')}
        onCancel={() => setPaymentToDelete(null)}
      />
    </div>
  );
}
