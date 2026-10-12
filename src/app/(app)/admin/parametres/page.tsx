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

const TIMEZONES = ['Africa/Casablanca', 'Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'America/Montreal', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Dakar'];

export default function SettingsPage() {
  const { settings, refreshConfig } = useApp();
  const toast = useToast();
  const [name, setName] = useState(settings.centre_name);
  const [welcome, setWelcome] = useState(settings.welcome_message);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacy = useLegacyData();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError('Le nom du centre est requis.');
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ centre_name: name.trim(), welcome_message: welcome.trim(), timezone });
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
      </div>
    </>
  );
}
