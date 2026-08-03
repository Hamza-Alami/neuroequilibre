'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageShell } from '@/components/layout/Header';
import { Card, PageTitle } from '@/components/ui/Card';
import { SessionBookingForm } from '@/components/forms/SessionBookingForm';

function BookingContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client') ?? undefined;

  return (
    <Card className="max-w-2xl">
      <SessionBookingForm preselectedClientId={clientId} />
    </Card>
  );
}

export default function NewSessionPage() {
  return (
    <PageShell>
      <PageTitle
        title="Réserver une séance"
        subtitle="Planifiez une nouvelle session de neurofeedback pour un client."
      />
      <Suspense fallback={<div className="max-w-2xl h-48 animate-pulse rounded-3xl bg-white/40" />}>
        <BookingContent />
      </Suspense>
    </PageShell>
  );
}
