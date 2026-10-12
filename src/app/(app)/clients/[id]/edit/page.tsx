'use client';

import { useParams, useRouter } from 'next/navigation';
import { ClientForm } from '@/components/client/ClientForm';
import { PageHeader } from '@/components/ui/Card';
import { Alert, PageLoader } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { getClient, updateClient } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listKycSections } from '@/lib/db/kyc';
import { useAsync } from '@/lib/hooks';

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const data = useAsync(async () => {
    const [client, sections] = await Promise.all([getClient(id), listKycSections()]);
    return { client, sections };
  }, [id]);

  if (data.loading) return <PageLoader />;
  if (data.error) return <Alert tone="error">{errorMessage(data.error)}</Alert>;
  if (!data.data?.client) return <Alert tone="warning">Client introuvable.</Alert>;
  const { client, sections } = data.data;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Clients" title={`Modifier · ${client.first_name} ${client.last_name}`} />
      <ClientForm
        initial={client}
        sections={sections}
        submitLabel="Enregistrer"
        onCancel={() => router.back()}
        onSubmit={async (input) => {
          await updateClient(id, input);
          toast.success('Fiche client mise à jour.');
          router.push(`/clients/${id}?tab=infos`);
        }}
      />
    </div>
  );
}
