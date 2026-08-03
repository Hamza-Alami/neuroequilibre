'use client';

import { PageShell } from '@/components/layout/Header';
import { Card, PageTitle } from '@/components/ui/Card';
import { ClientKYCForm } from '@/components/forms/ClientKYCForm';

export default function NewClientPage() {
  return (
    <PageShell>
      <PageTitle
        title="Nouveau client"
        subtitle="Créez un profil client en complétant le formulaire d'identification (KYC)."
      />
      <Card className="max-w-3xl">
        <ClientKYCForm />
      </Card>
    </PageShell>
  );
}
