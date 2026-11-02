'use client';

import { DatabaseBackup, Save } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { clearLegacyData, importLegacyData, useLegacyData } from '@/lib/db/legacy-import';
import { updateSettings } from '@/lib/db/settings';

const LEGAL_FIELDS = [
  { key: 'legal_ice', label: 'ICE', hint: 'Identifiant commun de l’entreprise (15 chiffres).' },
  { key: 'legal_if', label: 'Identifiant fiscal (IF)' },
  { key: 'legal_rc', label: 'Registre du commerce (RC)', hint: 'Ex. : 123456 Casablanca' },
  { key: 'legal_patente', label: 'Taxe professionnelle (patente)' },
  { key: 'legal_cnss', label: 'N° CNSS', hint: 'Facultatif.' },
] as const;

type LegalKey =
  | 'legal_name'
  | 'legal_address'
  | 'legal_phone'
  | 'legal_email'
  | (typeof LEGAL_FIELDS)[number]['key']
  | 'invoice_tva_mention'
  | 'invoice_footer';

function LegalCard() {
  const { settings, refreshConfig } = useApp();
  const toast = useToast();
  const [values, setValues] = useState<Record<LegalKey, string>>(() => ({
    legal_name: settings.legal_name ?? '',
    legal_address: settings.legal_address ?? '',
    legal_phone: settings.legal_phone ?? '',
    legal_email: settings.legal_email ?? '',
    legal_ice: settings.legal_ice ?? '',
    legal_if: settings.legal_if ?? '',
    legal_rc: settings.legal_rc ?? '',
    legal_patente: settings.legal_patente ?? '',
    legal_cnss: settings.legal_cnss ?? '',
    invoice_tva_mention: settings.invoice_tva_mention ?? '',
    invoice_footer: settings.invoice_footer ?? '',
  }));
  const [rate, setRate] = useState(String(settings.invoice_tva_rate ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: LegalKey, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const rateN = Number(rate.replace(',', '.'));

  async function save() {
    if (!Number.isFinite(rateN) || rateN < 0 || rateN > 100) return setError('Taux de TVA invalide (entre 0 et 100).');
    const ice = values.legal_ice.replace(/\s/g, '');
    if (ice && !/^\d{15}$/.test(ice)) return setError('L’ICE comporte 15 chiffres.');
    setSaving(true);
    setError(null);
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as Record<LegalKey, string>;
      await updateSettings({ ...trimmed, legal_ice: ice, invoice_tva_rate: rateN });
      await refreshConfig();
      toast.success('Mentions légales enregistrées.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="xl:col-span-2">
      <div id="facturation" className="scroll-mt-8" />
      <CardHeader
        title="Facturation et mentions légales"
        description="Imprimées sur les reçus et les factures. Une facture déjà émise garde les mentions en vigueur le jour de son émission."
      />
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Raison sociale" hint={`Si vide : « ${settings.centre_name} ».`}>
            <Input value={values.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="Ex. : NeuroÉquilibre SARL" />
          </Field>
          <Field label="Adresse">
            <Input value={values.legal_address} onChange={(e) => set('legal_address', e.target.value)} placeholder="N°, rue, quartier, ville" />
          </Field>
          <Field label="Téléphone">
            <Input value={values.legal_phone} onChange={(e) => set('legal_phone', e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={values.legal_email} onChange={(e) => set('legal_email', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LEGAL_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={'hint' in f ? f.hint : undefined}>
              <Input value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} className="tabular" />
            </Field>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          <Field label="Taux de TVA (%)" hint="0 si les prestations ne sont pas soumises à la TVA.">
            <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="tabular" />
          </Field>
          {rateN > 0 ? (
            <Alert tone="info" className="self-end">
              Les montants convenus sont considérés TTC : la facture affiche le total HT, la TVA à {rate} % et le total TTC.
            </Alert>
          ) : (
            <Field label="Mention TVA" hint="Imprimée sur la facture quand le taux est 0 %.">
              <Input value={values.invoice_tva_mention} onChange={(e) => set('invoice_tva_mention', e.target.value)} placeholder="TVA non applicable" />
            </Field>
          )}
        </div>
        <Field label="Pied de page des documents" hint="Ex. : RIB, conditions de règlement. Imprimé en bas des reçus et factures.">
          <Textarea value={values.invoice_footer} onChange={(e) => set('invoice_footer', e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end">
          <Button icon={Save} onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}

const TIMEZONES = ['Africa/Casablanca', 'Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'America/Montreal', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Dakar'];

export default function SettingsPage() {
  const { settings, refreshConfig } = useApp();
  const toast = useToast();
  const [name, setName] = useState(settings.centre_name);
  const [welcome, setWelcome] = useState(settings.welcome_message);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency_label);
  const [countryCode, setCountryCode] = useState(settings.phone_country_code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacy = useLegacyData();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError('Le nom du centre est requis.');
    const code = countryCode.replace(/\D/g, '');
    if (!/^\d{1,4}$/.test(code)) return setError('Indicatif téléphonique invalide (ex. : 212 pour le Maroc).');
    setSaving(true);
    setError(null);
    try {
      await updateSettings({
        centre_name: name.trim(),
        welcome_message: welcome.trim(),
        timezone,
        currency_label: currency.trim(),
        phone_country_code: code,
      });
      await refreshConfig();
      toast.success('Paramètres enregistrés.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function runImport() {
    if (!legacy) return;
    setImporting(true);
    try {
      const res = await importLegacyData(legacy);
      clearLegacyData();
      setImportResult(`${res.clients} client(s), ${res.sessions} séance(s) et ${res.assessments} évaluation(s) importés.`);
      toast.success('Import terminé.');
    } catch (e) {
      toast.error(e);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Administration" title="Paramètres généraux" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Centre" description="Affiché dans l’application et sur les documents exportés." />
          <div className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Nom du centre" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Message d’accueil" hint="Affiché sur le tableau de bord de toute l’équipe.">
              <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} />
            </Field>
            <Field label="Fuseau horaire" hint="Toutes les heures du planning sont exprimées dans ce fuseau.">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {[...new Set([timezone, ...TIMEZONES])].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Devise" hint="Affichée après les montants (ex. : DH, MAD, €).">
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={6} />
              </Field>
              <Field label="Indicatif WhatsApp par défaut" hint="Ajouté aux numéros locaux (06…) : 212 pour le Maroc.">
                <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} inputMode="numeric" maxLength={5} className="tabular" />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button icon={Save} onClick={save} loading={saving}>
                Enregistrer
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div id="import" className="scroll-mt-8" />
          <CardHeader
            title="Import de l’ancienne version"
            description="La première version stockait les données dans le navigateur. Importez-les une fois dans la base partagée."
          />
          {importResult ? (
            <Alert tone="success">{importResult}</Alert>
          ) : legacy ? (
            <div className="space-y-4">
              <Alert tone="info">
                Trouvé sur ce navigateur : {legacy.clients.length} client(s), {legacy.sessions.length} séance(s),{' '}
                {legacy.assessments.length} évaluation(s). Les séances seront rattachées au premier box actif. Les doublons
                éventuels sont ignorés.
              </Alert>
              <Button icon={DatabaseBackup} onClick={runImport} loading={importing}>
                Importer ces données
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">
              Aucune donnée de l’ancienne version sur ce navigateur. Ouvrez cette page depuis l’ordinateur qui utilisait l’ancienne
              version pour importer ses données.
            </p>
          )}
        </Card>

        <LegalCard />
      </div>
    </>
  );
}
