'use client';

import { Compass, Contact, HeartPulse, MapPin, StickyNote, UserRound } from 'lucide-react';
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { todayKey } from '@/lib/time';
import type { AcquisitionSource, Client, ClientInput, CustomFieldValue, KycField, KycSection } from '@/lib/types';

const COUNTRIES = ['Maroc', 'France', 'Belgique', 'Suisse', 'Canada', 'Espagne', 'Tunisie', 'Algérie', 'Sénégal', 'Côte d’Ivoire', 'Autre'];

type Errors = Partial<Record<string, string>>;

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function emptyInput(): ClientInput {
  return {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    city: '',
    country: 'Maroc',
    phone: '',
    email: '',
    address_line: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    source_id: null,
    custom_fields: {},
  };
}

function CustomFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: KycField;
  value: CustomFieldValue | undefined;
  onChange: (v: CustomFieldValue) => void;
  error?: string;
}) {
  const wide = field.field_type === 'textarea';
  if (field.field_type === 'checkbox') {
    return (
      <div className="flex items-end sm:col-span-1">
        <Checkbox checked={Boolean(value)} onChange={onChange} label={field.label} />
      </div>
    );
  }
  return (
    <Field label={field.label} required={field.is_required} error={error} className={wide ? 'sm:col-span-2' : undefined}>
      {field.field_type === 'textarea' ? (
        <Textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? undefined} error={error} />
      ) : field.field_type === 'select' ? (
        <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} error={error}>
          <option value="">Sélectionner…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) =>
            onChange(field.field_type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)
          }
          placeholder={field.placeholder ?? undefined}
          error={error}
        />
      )}
    </Field>
  );
}

export function ClientForm({
  initial,
  sections,
  sources,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Client;
  sections: KycSection[];
  sources: AcquisitionSource[];
  submitLabel: string;
  onSubmit: (input: ClientInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<ClientInput>(() => {
    if (!initial) return emptyInput();
    const { id: _id, code: _code, created_at: _c, updated_at: _u, ...rest } = initial;
    void _id;
    void _code;
    void _c;
    void _u;
    return { ...emptyInput(), ...rest, custom_fields: { ...(rest.custom_fields ?? {}) } };
  });
  const sourceOptions = sources.filter((s) => s.is_active || s.id === initial?.source_id);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setCustom = (id: string, value: CustomFieldValue) => {
    setForm((f) => ({ ...f, custom_fields: { ...f.custom_fields, [id]: value } }));
    setErrors((e) => ({ ...e, [`cf_${id}`]: undefined }));
  };

  function validate(): Errors {
    const e: Errors = {};
    if (!form.first_name.trim()) e.first_name = 'Le prénom est requis.';
    if (!form.last_name.trim()) e.last_name = 'Le nom est requis.';
    if (!form.date_of_birth) e.date_of_birth = 'La date de naissance est requise.';
    else if (form.date_of_birth > todayKey()) e.date_of_birth = 'La date de naissance ne peut pas être dans le futur.';
    if (!form.phone.trim()) e.phone = 'Le téléphone est requis.';
    else if (!/^[+\d][\d\s().-]{5,}$/.test(form.phone.trim())) e.phone = 'Numéro de téléphone invalide.';
    if (!form.email.trim()) e.email = 'L’email est requis.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Adresse email invalide.';
    if (!form.city.trim()) e.city = 'La ville est requise.';
    if (!form.source_id) e.source_id = 'Indiquez comment le client est venu au centre.';
    for (const s of sections) {
      for (const f of s.fields) {
        const v = form.custom_fields[f.id];
        if (f.is_required && f.field_type !== 'checkbox' && (v === undefined || v === null || String(v).trim() === '')) {
          e[`cf_${f.id}`] = `« ${f.label} » est requis.`;
        }
      }
    }
    return e;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      setSubmitError('Certains champs sont incomplets ou invalides. Vérifiez les champs signalés en rouge.');
      return;
    }
    setSaving(true);
    try {
      const trimOrNull = (v: string | null) => (v && v.trim() ? v.trim() : null);
      await onSubmit({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        address_line: trimOrNull(form.address_line),
        postal_code: trimOrNull(form.postal_code),
        emergency_contact_name: trimOrNull(form.emergency_contact_name),
        emergency_contact_phone: trimOrNull(form.emergency_contact_phone),
        notes: trimOrNull(form.notes),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Section icon={UserRound} title="Identité">
        <Field label="Prénom" required error={errors.first_name}>
          <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} autoFocus />
        </Field>
        <Field label="Nom" required error={errors.last_name}>
          <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
        </Field>
        <Field label="Date de naissance" required error={errors.date_of_birth}>
          <Input
            type="date"
            max={todayKey()}
            value={form.date_of_birth}
            onChange={(e) => set('date_of_birth', e.target.value)}
            error={errors.date_of_birth}
          />
        </Field>
        {initial && (
          <Field label="Code client" hint="Attribué automatiquement, non modifiable.">
            <Input value={initial.code} disabled className="tabular" />
          </Field>
        )}
      </Section>

      <Section icon={Compass} title="Origine" description="Permet de suivre d’où viennent les nouveaux clients.">
        <Field label="Comment le client est venu ?" required error={errors.source_id}>
          <Select value={form.source_id ?? ''} onChange={(e) => set('source_id', e.target.value || null)} error={errors.source_id}>
            <option value="">Sélectionner…</option>
            {sourceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section icon={Contact} title="Coordonnées">
        <Field label="Téléphone" required error={errors.phone}>
          <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+212 6 12 34 56 78" error={errors.phone} />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="nom@exemple.com" error={errors.email} />
        </Field>
      </Section>

      <Section icon={MapPin} title="Adresse">
        <Field label="Adresse" className="sm:col-span-2">
          <Input value={form.address_line ?? ''} onChange={(e) => set('address_line', e.target.value)} />
        </Field>
        <Field label="Ville" required error={errors.city}>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" error={errors.city} />
        </Field>
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <Field label="Code postal">
            <Input value={form.postal_code ?? ''} onChange={(e) => set('postal_code', e.target.value)} />
          </Field>
          <Field label="Pays de résidence">
            <Select value={form.country} onChange={(e) => set('country', e.target.value)}>
              {[...new Set([form.country, ...COUNTRIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section icon={HeartPulse} title="Contact d’urgence">
        <Field label="Nom du contact">
          <Input value={form.emergency_contact_name ?? ''} onChange={(e) => set('emergency_contact_name', e.target.value)} />
        </Field>
        <Field label="Téléphone du contact">
          <Input type="tel" value={form.emergency_contact_phone ?? ''} onChange={(e) => set('emergency_contact_phone', e.target.value)} />
        </Field>
      </Section>

      {sections
        .filter((s) => s.fields.length)
        .map((s) => (
          <Section key={s.id} icon={StickyNote} title={s.title} description={s.description}>
            {s.fields.map((f) => (
              <CustomFieldInput
                key={f.id}
                field={f}
                value={form.custom_fields[f.id]}
                onChange={(v) => setCustom(f.id, v)}
                error={errors[`cf_${f.id}`]}
              />
            ))}
          </Section>
        ))}

      <Card>
        <Field label="Notes internes" hint="Visibles uniquement par l’équipe du centre.">
          <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </Field>
      </Card>

      {submitError && <Alert tone="error">{submitError}</Alert>}

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 bg-gradient-to-t from-bg via-bg to-bg/0 px-1 pb-2 pt-6">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" size="lg" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
