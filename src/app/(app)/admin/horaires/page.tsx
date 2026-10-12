'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Select, Switch } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/db/errors';
import { updateSettings } from '@/lib/db/settings';
import type { OpeningHours } from '@/lib/types';
import { cn } from '@/lib/utils';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function HoursPage() {
  const { settings, refreshConfig } = useApp();
  const toast = useToast();
  const [hours, setHours] = useState<OpeningHours>(settings.opening_hours);
  const [duration, setDuration] = useState(settings.default_session_minutes);
  const [gap, setGap] = useState(settings.min_gap_minutes);
  const [step, setStep] = useState(settings.slot_step_minutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setDay = (key: string, patch: Partial<OpeningHours[string]>) =>
    setHours((h) => ({ ...h, [key]: { ...(h[key] ?? { open: '09:00', close: '18:00', closed: false }), ...patch } }));

  async function save() {
    setError(null);
    for (const [key, d] of Object.entries(hours)) {
      if (!d.closed && d.open >= d.close) {
        return setError(`${DAYS[Number(key) - 1]} : l’heure de fermeture doit être après l’ouverture.`);
      }
    }
    if (duration < 5 || duration > 240) return setError('La durée standard doit être comprise entre 5 et 240 minutes.');
    if (gap < 0 || gap > 240) return setError('Le délai minimum doit être compris entre 0 et 240 minutes.');
    setSaving(true);
    try {
      await updateSettings({
        opening_hours: hours,
        default_session_minutes: duration,
        min_gap_minutes: gap,
        slot_step_minutes: step,
      });
      await refreshConfig();
      toast.success('Horaires et règles enregistrés.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Horaires & séances"
        description="Ces règles s’appliquent à toutes les nouvelles réservations, vérifiées par la base de données."
        actions={
          <Button icon={Save} onClick={save} loading={saving}>
            Enregistrer
          </Button>
        }
      />
      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Horaires d’ouverture" description="Les créneaux proposés à la réservation suivent ces horaires." />
          <ul className="divide-y divide-line rounded-xl border border-line">
            {DAYS.map((label, i) => {
              const key = String(i + 1);
              const d = hours[key] ?? { open: '09:00', close: '18:00', closed: true };
              return (
                <li key={key} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span className="w-24 text-[14px] font-medium text-ink">{label}</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={!d.closed} onChange={(v) => setDay(key, { closed: !v })} label={`${label} ouvert`} />
                    <span className={cn('w-14 text-[13px]', d.closed ? 'text-ink-muted' : 'text-success')}>{d.closed ? 'Fermé' : 'Ouvert'}</span>
                  </div>
                  <div className={cn('flex items-center gap-2', d.closed && 'pointer-events-none opacity-40')}>
                    <Input type="time" step={900} value={d.open} onChange={(e) => setDay(key, { open: e.target.value })} className="tabular w-[120px]" />
                    <span className="text-ink-muted">–</span>
                    <Input type="time" step={900} value={d.close} onChange={(e) => setDay(key, { close: e.target.value })} className="tabular w-[120px]" />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Règles des séances" />
          <div className="space-y-5">
            <Field label="Durée standard d’une séance" hint="Proposée par défaut à la réservation (modifiable au cas par cas).">
              <div className="flex flex-wrap items-center gap-2">
                {[33, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={cn(
                      'h-10 rounded-[10px] border px-4 text-[14px] font-medium',
                      duration === m ? 'border-navy bg-navy text-white' : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                    )}
                  >
                    {m} min
                  </button>
                ))}
                <Input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="tabular w-24" />
              </div>
            </Field>
            <Field
              label="Délai minimum entre deux débuts de séance (même box)"
              hint="En dessous de ce délai, une alerte s’affiche : « La séance précédente ne sera pas encore terminée ». La réservation reste possible après confirmation."
            >
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={240} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="tabular w-24" />
                <span className="text-[13px] text-ink-muted">minutes</span>
              </div>
            </Field>
            <Field label="Pas de la grille de créneaux" hint="Intervalle entre deux horaires proposés.">
              <Select value={step} onChange={(e) => setStep(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 60].map((s) => (
                  <option key={s} value={s}>
                    {s} minutes
                  </option>
                ))}
              </Select>
            </Field>
            <Alert tone="info">
              Toujours appliqué : aucune réservation avant aujourd’hui, jamais deux séances au même horaire dans le même box,
              créneaux bloqués et horaires d’ouverture respectés.
            </Alert>
          </div>
        </Card>
      </div>
    </>
  );
}
