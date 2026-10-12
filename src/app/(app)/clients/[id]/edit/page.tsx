'use client';

import { useParams, useRouter } from 'next/navigation';
import { ClientForm } from '@/components/client/ClientForm';
import { PageHeader } from '@/components/ui/Card';
import { Alert, PageLoader } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { getClient, updateClient } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listKycSections } from '@/lib/db/kyc';
import { listSources } from '@/lib/db/sources';
import { useAsync } from '@/lib/hooks';

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const data = useAsync(async () => {
    const [client, sections, sources] = await Promise.all([
      getClient(id),
      listKycSections(),
      listSources({ includeInactive: true }),
    ]);
    return { client, sections, sources };
  }, [id]);

  if (data.loading) return <PageLoader />;
  if (data.error) return <Alert tone="error">{errorMessage(data.error)}</Alert>;
  if (!data.data?.client) return <Alert tone="warning">Client introuvable.</Alert>;
  const { client, sections, sources } = data.data;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={`Clients · ${client.code}`}
        title={`Modifier · ${client.first_name} ${client.last_name}`}
        description="Corrigez ou mettez à jour les informations du client. Chaque modification est tracée dans le journal."
      />
      <ClientForm
        initial={client}
        sections={sections}
        sources={sources}
        submitLabel="Enregistrer les modifications"
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
