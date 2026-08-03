'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { localDb } from '@/lib/data/local-store';

const COUNTRIES = [
  { value: 'France', label: 'France' },
  { value: 'Belgique', label: 'Belgique' },
  { value: 'Suisse', label: 'Suisse' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Maroc', label: 'Maroc' },
  { value: 'Autre', label: 'Autre' },
];

export function ClientKYCForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    city: '',
    country: 'France',
    phone: '',
    email: '',
    address_line: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.first_name.trim()) newErrors.first_name = 'Requis';
    if (!form.last_name.trim()) newErrors.last_name = 'Requis';
    if (!form.date_of_birth) newErrors.date_of_birth = 'Requis';
    if (!form.city.trim()) newErrors.city = 'Requis';
    if (!form.phone.trim()) newErrors.phone = 'Requis';
    if (!form.email.trim()) newErrors.email = 'Requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email invalide';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const client = localDb.createClient({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth,
      city: form.city.trim(),
      country: form.country,
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      address_line: form.address_line.trim() || null,
      postal_code: form.postal_code.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    });

    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    router.push(`/clients/${client.id}`);
  };

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      <section>
        <h3 className="mb-5 text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
          Identité
        </h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Prénom"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            error={errors.first_name}
            placeholder="Marie"
            required
          />
          <Input
            label="Nom"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            error={errors.last_name}
            placeholder="Dupont"
            required
          />
          <Input
            label="Date de naissance"
            type="date"
            value={form.date_of_birth}
            onChange={(e) => update('date_of_birth', e.target.value)}
            error={errors.date_of_birth}
            required
          />
        </div>
      </section>

      <section>
        <h3 className="mb-5 text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
          Coordonnées
        </h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            error={errors.email}
            placeholder="marie.dupont@email.com"
            required
          />
          <Input
            label="Téléphone"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            error={errors.phone}
            placeholder="+33 6 12 34 56 78"
            required
          />
          <Input
            label="Adresse"
            value={form.address_line}
            onChange={(e) => update('address_line', e.target.value)}
            placeholder="12 rue de la Paix"
            className="sm:col-span-2"
          />
          <Input
            label="Code postal"
            value={form.postal_code}
            onChange={(e) => update('postal_code', e.target.value)}
            placeholder="75001"
          />
          <Input
            label="Ville"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            error={errors.city}
            placeholder="Paris"
            required
          />
          <Select
            label="Pays de résidence"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            options={COUNTRIES}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-5 text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
          Contact d&apos;urgence
        </h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Nom du contact"
            value={form.emergency_contact_name}
            onChange={(e) => update('emergency_contact_name', e.target.value)}
            placeholder="Jean Dupont"
          />
          <Input
            label="Téléphone du contact"
            type="tel"
            value={form.emergency_contact_phone}
            onChange={(e) => update('emergency_contact_phone', e.target.value)}
            placeholder="+33 6 98 76 54 32"
          />
        </div>
      </section>

      <section>
        <Textarea
          label="Notes (optionnel)"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Informations complémentaires..."
        />
      </section>

      <div className="flex justify-end pt-4">
        <Button type="submit" size="lg" loading={loading}>
          Créer le profil client
        </Button>
      </div>
    </motion.form>
  );
}
