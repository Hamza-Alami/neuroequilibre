'use client';

import { AlertCircle, Banknote, Package, Percent } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { Card, CardHeader, StatCard } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { listClients } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listPackSales, listPaymentsBetween, PAYMENT_METHODS } from '@/lib/db/packs';
import { useAsync } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { monthsBetween, PERIOD_PRESETS, periodLabel, presetRange, type PeriodPreset } from '@/lib/periods';
import { formatCalendarDate, todayKey } from '@/lib/time';
import type { Client } from '@/lib/types';
import { cn } from '@/lib/utils';

type View = 'payments' | 'unpaid' | 'sales';

export default function PacksReportPage() {
  const { settings } = useApp();
  const currency = settings.currency_label;
  const money = (n: number) => formatMoney(n, currency);
  const today = todayKey();

  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [custom, setCustom] = useState(() => presetRange('this_month', today));
  const [view, setView] = useState<View>('payments');

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const validRange = range.from && range.to && range.from <= range.to;

  const base = useAsync(async () => {
    const [clients, sales] = await Promise.all([listClients(), listPackSales()]);
    return { clients: new Map(clients.map((c) => [c.id, c])), sales };
  }, []);
  const payments = useAsync(
    () => (validRange ? listPaymentsBetween(range.from, range.to) : Promise.resolve([])),
    [range.from, range.to, validRange]
  );

  const clientOf = (id: string): Client | undefined => base.data?.clients.get(id);
  const periodSales = useMemo(
    () => (base.data?.sales ?? []).filter((s) => validRange && s.sold_on >= range.from && s.sold_on <= range.to),
    [base.data, range.from, range.to, validRange]
  );
  const unpaid = periodSales.filter((s) => s.remaining_amount > 0).sort((a, b) => b.remaining_amount - a.remaining_amount);
  const globalOutstanding = (base.data?.sales ?? []).reduce((sum, s) => sum + s.remaining_amount, 0);

  const totals = {
    salesCount: periodSales.length,
    agreed: periodSales.reduce((s, p) => s + p.agreed_price, 0),
    collected: (payments.data ?? []).reduce((s, p) => s + p.amount, 0),
    unpaid: unpaid.reduce((s, p) => s + p.remaining_amount, 0),
    paidOnSales: periodSales.reduce((s, p) => s + p.paid_amount, 0),
  };
  const recovery = totals.agreed > 0 ? Math.round((totals.paidOnSales / totals.agreed) * 100) : null;

  const months = useMemo(() => {
    if (!validRange) return [];
    const keys = monthsBetween(range.from, range.to);
    if (keys.length < 2 || keys.length > 24) return [];
    return keys.map((m) => {
      const sales = periodSales.filter((s) => s.sold_on.startsWith(m));
      return {
        month: m,
        agreed: sales.reduce((s, p) => s + p.agreed_price, 0),
        collected: (payments.data ?? []).filter((p) => p.paid_on.startsWith(m)).reduce((s, p) => s + p.amount, 0),
        unpaid: sales.reduce((s, p) => s + p.remaining_amount, 0),
      };
    });
  }, [validRange, range.from, range.to, periodSales, payments.data]);
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.agreed, m.collected)));

  const label = validRange ? periodLabel(range.from, range.to) : '';

  function buildExport() {
    const common = { centreName: settings.centre_name, subtitle: label[0]?.toUpperCase() + label.slice(1), orientation: 'landscape' as const };
    if (view === 'payments') {
      const list = payments.data ?? [];
      return {
        ...common,
        title: 'Encaissements',
        fileBase: `encaissements-${range.from}_${range.to}`,
        columns: [
          { header: 'Date', width: 26 },
          { header: 'Code', width: 24 },
          { header: 'Client' },
          { header: 'Pack' },
          { header: 'Mode', width: 32 },
          { header: 'Remarque' },
          { header: 'Montant', width: 34, align: 'right' as const },
        ],
        rows: list.map((p) => [
          formatCalendarDate(p.paid_on, 'dd/MM/yyyy'),
          p.client_pack?.client?.code ?? '',
          p.client_pack?.client ? `${p.client_pack.client.first_name} ${p.client_pack.client.last_name}` : '',
          p.client_pack?.pack_name ?? '',
          PAYMENT_METHODS[p.method],
          p.note ?? '',
          money(p.amount),
        ]),
        summary: [`${list.length} règlement(s)`, `Total encaissé : ${money(totals.collected)}`],
        footer: ['Total', '', '', '', '', '', money(totals.collected)],
      };
    }
    const list = view === 'unpaid' ? unpaid : periodSales;
    return {
      ...common,
      title: view === 'unpaid' ? 'Impayés des packs vendus' : 'Packs vendus',
      fileBase: `${view === 'unpaid' ? 'impayes' : 'packs-vendus'}-${range.from}_${range.to}`,
      columns: [
        { header: 'Vendu le', width: 24 },
        { header: 'Code', width: 22 },
        { header: 'Client' },
        { header: 'Pack' },
        { header: 'Séances', width: 20, align: 'center' as const },
        { header: 'Convenu', width: 30, align: 'right' as const },
        { header: 'Réglé', width: 30, align: 'right' as const },
        { header: 'Reste', width: 30, align: 'right' as const },
      ],
      rows: list.map((s) => {
        const c = clientOf(s.client_id);
        return [
          formatCalendarDate(s.sold_on, 'dd/MM/yyyy'),
          c?.code ?? '',
          c ? `${c.first_name} ${c.last_name}` : '',
          s.pack_name,
          `${s.session_count}${s.offered_sessions ? ` + ${s.offered_sessions}` : ''}`,
          money(s.agreed_price),
          money(s.paid_amount),
          money(s.remaining_amount),
        ];
      }),
      summary:
        view === 'unpaid'
          ? [`${list.length} pack(s) non soldé(s)`, `Total impayé : ${money(totals.unpaid)}`]
          : [`${list.length} pack(s) vendu(s)`, `Total convenu : ${money(totals.agreed)}`],
      footer: [
        'Total',
        '',
        '',
        '',
        '',
        money(list.reduce((s, p) => s + p.agreed_price, 0)),
        money(list.reduce((s, p) => s + p.paid_amount, 0)),
        money(list.reduce((s, p) => s + p.remaining_amount, 0)),
      ],
    };
  }

  if (base.loading) return <PageLoader />;
  if (base.error) return <Alert tone="error">{errorMessage(base.error)}</Alert>;

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <Field label="Période" className="md:w-56">
            <Select
              value={preset}
              onChange={(e) => {
                const next = e.target.value as PeriodPreset;
                if (next === 'custom') setCustom(range);
                setPreset(next);
              }}
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          {preset === 'custom' ? (
            <>
              <Field label="Du" className="md:w-44">
                <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </Field>
              <Field label="Au" className="md:w-44">
                <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </Field>
            </>
          ) : (
            <p className="pb-2.5 text-[14px] text-ink-soft">{label}</p>
          )}
        </div>
        {!validRange && <Alert tone="warning" className="mt-4">La date de fin doit être postérieure à la date de début.</Alert>}
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Packs vendus" value={totals.salesCount} hint={`Montant convenu : ${money(totals.agreed)}`} />
        <StatCard icon={Banknote} tone="success" label="Encaissé sur la période" value={<span className="text-[20px]">{money(totals.collected)}</span>} hint={`${payments.data?.length ?? 0} règlement(s)`} />
        <StatCard
          icon={AlertCircle}
          tone="gold"
          label="Impayés (packs de la période)"
          value={<span className="text-[20px]">{money(totals.unpaid)}</span>}
          hint={`Encours global : ${money(globalOutstanding)}`}
        />
        <StatCard icon={Percent} tone="muted" label="Taux de recouvrement" value={recovery === null ? '—' : `${recovery} %`} hint="Réglé / convenu, packs de la période" />
      </div>

      {months.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="Évolution mensuelle"
            description="Ventes (montant convenu des packs vendus dans le mois), encaissements du mois et impayés restants sur ces ventes."
          />
          <div className="space-y-3">
            {months.map((m) => (
              <div key={m.month} className="grid grid-cols-[110px_1fr] items-center gap-4 text-[13px]">
                <span className="capitalize text-ink-soft">{formatCalendarDate(`${m.month}-01`, 'MMM yyyy')}</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-navy" style={{ width: `${(m.agreed / maxMonth) * 100}%`, minWidth: m.agreed ? 4 : 0 }} />
                    <span className="tabular text-[12px] text-ink-muted">Ventes {money(m.agreed)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-success" style={{ width: `${(m.collected / maxMonth) * 100}%`, minWidth: m.collected ? 4 : 0 }} />
                    <span className="tabular text-[12px] text-ink-muted">
                      Encaissé {money(m.collected)}
                      {m.unpaid > 0 && <span className="text-gold-700"> · impayé {money(m.unpaid)}</span>}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'payments', label: 'Encaissements', count: payments.data?.length ?? 0 },
              { value: 'unpaid', label: 'Impayés', count: unpaid.length },
              { value: 'sales', label: 'Ventes', count: periodSales.length },
            ]}
          />
          <ExportButtons build={buildExport} disabled={!validRange || payments.loading} />
        </div>

        {view === 'payments' ? (
          payments.loading ? (
            <PageLoader />
          ) : payments.error ? (
            <div className="p-5">
              <Alert tone="error">{errorMessage(payments.error)}</Alert>
            </div>
          ) : !payments.data?.length ? (
            <EmptyState icon={Banknote} title="Aucun encaissement" description="Aucun règlement enregistré sur cette période." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Pack</th>
                    <th className="px-3 py-3">Mode</th>
                    <th className="px-5 py-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.data.map((p) => (
                    <tr key={p.id}>
                      <td className="tabular px-5 py-2.5 text-[13px] text-ink-soft">{formatCalendarDate(p.paid_on, 'dd/MM/yyyy')}</td>
                      <td className="px-3 py-2.5 text-[14px]">
                        {p.client_pack?.client ? (
                          <Link href={`/clients/${p.client_pack.client.id}?tab=packs`} className="font-medium text-ink hover:text-navy hover:underline">
                            {p.client_pack.client.first_name} {p.client_pack.client.last_name}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <span className="tabular ml-2 text-[12px] text-ink-muted">{p.client_pack?.client?.code}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-soft">{p.client_pack?.pack_name}</td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-soft">
                        {PAYMENT_METHODS[p.method]}
                        {p.note && <span className="text-ink-muted"> · {p.note}</span>}
                      </td>
                      <td className="tabular px-5 py-2.5 text-right text-[14px] font-medium text-ink">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-muted">
                    <td colSpan={4} className="px-5 py-3 text-[13px] font-semibold text-ink">
                      Total encaissé
                    </td>
                    <td className="tabular px-5 py-3 text-right text-[14px] font-semibold text-success">{money(totals.collected)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        ) : (
          (() => {
            const list = view === 'unpaid' ? unpaid : periodSales;
            if (!list.length) {
              return (
                <EmptyState
                  icon={Package}
                  title={view === 'unpaid' ? 'Aucun impayé' : 'Aucune vente'}
                  description={view === 'unpaid' ? 'Tous les packs vendus sur la période sont soldés.' : 'Aucun pack vendu sur cette période.'}
                />
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="px-5 py-3">Vendu le</th>
                      <th className="px-3 py-3">Client</th>
                      <th className="px-3 py-3">Pack</th>
                      <th className="px-3 py-3 text-center">Séances</th>
                      <th className="px-3 py-3 text-right">Convenu</th>
                      <th className="px-3 py-3 text-right">Réglé</th>
                      <th className="px-5 py-3 text-right">Reste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((s) => {
                      const c = clientOf(s.client_id);
                      return (
                        <tr key={s.id}>
                          <td className="tabular px-5 py-2.5 text-[13px] text-ink-soft">{formatCalendarDate(s.sold_on, 'dd/MM/yyyy')}</td>
                          <td className="px-3 py-2.5 text-[14px]">
                            {c ? (
                              <Link href={`/clients/${c.id}?tab=packs`} className="font-medium text-ink hover:text-navy hover:underline">
                                {c.first_name} {c.last_name}
                              </Link>
                            ) : (
                              '—'
                            )}
                            <span className="tabular ml-2 text-[12px] text-ink-muted">{c?.code}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[13px] text-ink-soft">{s.pack_name}</td>
                          <td className="tabular px-3 py-2.5 text-center text-[13px] text-ink-soft">
                            {s.used_sessions}/{s.total_sessions}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right text-[13px] text-ink">{money(s.agreed_price)}</td>
                          <td className="tabular px-3 py-2.5 text-right text-[13px] text-success">{money(s.paid_amount)}</td>
                          <td
                            className={cn(
                              'tabular px-5 py-2.5 text-right text-[14px] font-medium',
                              s.remaining_amount > 0 ? 'text-gold-700' : 'text-ink-muted'
                            )}
                          >
                            {money(s.remaining_amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-muted text-[13px] font-semibold">
                      <td colSpan={4} className="px-5 py-3 text-ink">
                        Total
                      </td>
                      <td className="tabular px-3 py-3 text-right text-ink">{money(list.reduce((a, s) => a + s.agreed_price, 0))}</td>
                      <td className="tabular px-3 py-3 text-right text-success">{money(list.reduce((a, s) => a + s.paid_amount, 0))}</td>
                      <td className="tabular px-5 py-3 text-right text-gold-700">{money(list.reduce((a, s) => a + s.remaining_amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()
        )}
      </Card>
    </>
  );
}
