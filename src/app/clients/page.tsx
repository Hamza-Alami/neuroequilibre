'use client';

import { PageShell } from '@/components/layout/Header';
import { Card, PageTitle } from '@/components/ui/Card';
import { ClientSearchList } from '@/components/forms/SessionBookingForm';

export default function ClientsListPage() {
  return (
    <PageShell>
      <PageTitle
        title="Clients"
        subtitle="Recherchez et accédez aux profils de vos clients."
      />
      <Card className="max-w-2xl">
        <ClientSearchList />
      </Card>
    </PageShell>
  );
}
