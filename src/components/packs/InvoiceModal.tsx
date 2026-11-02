'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { issueInvoice } from '@/lib/db/invoices';
import { formatMoney } from '@/lib/money';
import { exportInvoicePdf } from '@/lib/pdf/invoice-pdf';
import { todayKey } from '@/lib/time';
import type { Client, ClientPack } from '@/lib/types';

export function InvoiceModal({
  pack,
  client,
  onClose,
  onIssued,
}: {
  pack: ClientPack | null;
  client: Client;
  onClose: () => void;
  onIssued: () => void;
}) {
  const { settings, isAdmin } = useApp();
  const toast = useToast();
  const currency = settings.currency_label;
  const [issuedOn, setIssuedOn] = useState(todayKey());
  const [billedName, setBilledName] = useState('');
  const [company, setCompany] = useState('');
  const [ice, setIce] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  if ((pack?.id ?? null) !== openedFor) {
    setOpenedFor(pack?.id ?? null);
    if (pack) {
      setIssuedOn(todayKey());
      setBilledName(`${client.first_name} ${client.last_name}`);
      setCompany('');
      setIce('');
      setAddress([client.address_line, [client.postal_code, client.city].filter(Boolean).join(' '), client.country].filter((v) => v && v.trim()).join(', '));
      setNotes('');
      setError(null);
    }
  }

  const rate = Number(settings.invoice_tva_rate) || 0;
  const ttc = pack?.agreed_price ?? 0;
  const ht = Math.round((ttc / (1 + rate / 100)) * 100) / 100;
  const legalMissing = !settings.legal_ice?.trim() || !settings.legal_address?.trim();

  async function submit() {
    if (!pack) return;
    if (!billedName.trim()) return setError('Indiquez le nom du client facturé.');
    if (!issuedOn || issuedOn > todayKey()) return setError('La date de la facture ne peut pas être dans le futur.');
    if (ice.trim() && !/^\d{15}$/.test(ice.replace(/\s/g, ''))) return setError('L’ICE comporte 15 chiffres.');
    setSaving(true);
    setError(null);
    try {
      const invoice = await issueInvoice({
        clientPackId: pack.id,
        issuedOn,
        billedName,
        billedCompany: company,
        billedIce: ice.replace(/\s/g, ''),
        billedAddress: address,
        notes,
      });
      toast.success(`Facture ${invoice.number} établie.`);
      onIssued();
      onClose();
      await exportInvoicePdf(invoice);
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
      size="lg"
      title="Établir une facture"
      description={pack ? `${pack.pack_name} · ${formatMoney(ttc, currency)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={FileText} onClick={submit} loading={saving}>
            Établir et télécharger
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {legalMissing && (
          <Alert tone="warning">
            Les mentions légales du centre (adresse, ICE, IF, RC…) ne sont pas complètes.{' '}
            {isAdmin ? (
              <a href="/admin/parametres#facturation" className="font-medium underline">
                Les compléter dans Paramètres
              </a>
            ) : (
              'Demandez à l’administrateur de les compléter avant d’établir la facture.'
            )}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facturé à" required hint="Nom du client ou du payeur.">
            <Input value={billedName} onChange={(e) => setBilledName(e.target.value)} />
          </Field>
          <Field label="Date de la facture" required>
            <Input type="date" max={todayKey()} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
          </Field>
          <Field label="Société" hint="Si la facture est au nom d’une entreprise.">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="ICE du client" hint="15 chiffres, pour une entreprise.">
            <Input value={ice} onChange={(e) => setIce(e.target.value)} inputMode="numeric" className="tabular" />
          </Field>
          <Field label="Adresse de facturation" className="sm:col-span-2">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Remarques" className="sm:col-span-2" hint="Imprimées sur la facture.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>

        {pack && (
          <div className="grid gap-3 rounded-xl border border-line bg-surface-muted p-4 text-[13px] sm:grid-cols-3">
            {rate > 0 ? (
              <>
                <Summary label="Total HT" value={formatMoney(ht, currency)} />
                <Summary label={`TVA ${rate} %`} value={formatMoney(ttc - ht, currency)} />
                <Summary label="Total TTC" value={formatMoney(ttc, currency)} strong />
              </>
            ) : (
              <>
                <Summary label="Montant facturé" value={formatMoney(ttc, currency)} strong />
                <Summary label="TVA" value={settings.invoice_tva_mention || 'Taux 0 %'} />
              </>
            )}
            <Summary label="Déjà réglé" value={formatMoney(pack.paid_amount, currency)} />
          </div>
        )}
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Le numéro est attribué automatiquement dans l’ordre chronologique. Une fois établie, la facture ne peut plus être modifiée :
          en cas d’erreur, l’administrateur l’annule et une nouvelle facture est établie.
        </p>
      </div>
    </Modal>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className={strong ? 'tabular mt-0.5 text-[16px] font-semibold text-ink' : 'tabular mt-0.5 font-medium text-ink-soft'}>{value}</p>
    </div>
  );
}
