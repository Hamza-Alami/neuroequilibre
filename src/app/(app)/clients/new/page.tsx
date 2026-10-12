'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ClientForm } from '@/components/client/ClientForm';
import { PageHeader } from '@/components/ui/Card';
import { Alert, PageLoader } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listKycSections } from '@/lib/db/kyc';
import { useAsync } from '@/lib/hooks';

function NewClientContent() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const sections = useAsync(() => listKycSections(), []);
  const thenBook = params.get('then') === 'book';

  if (sections.loading) return <PageLoader />;
  if (sections.error) return <Alert tone="error">{errorMessage(sections.error)}</Alert>;

  return (
    <ClientForm
      sections={sections.data ?? []}
      submitLabel={thenBook ? 'Créer et réserver une séance' : 'Créer la fiche client'}
      onCancel={() => router.back()}
      onSubmit={async (input) => {
        const client = await createClient(input);
        toast.success(`Fiche de ${client.first_name} ${client.last_name} créée.`);
        router.push(thenBook ? `/sessions/new?client=${client.id}` : `/clients/${client.id}`);
      }}
    />
  );
}

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Clients"
        title="Nouveau client"
        description="Fiche d’accueil (KYC). Les champs marqués d’un astérisque sont obligatoires."
      />
      <Suspense fallback={<PageLoader />}>
        <NewClientContent />
      </Suspense>
    </div>
  );
}
