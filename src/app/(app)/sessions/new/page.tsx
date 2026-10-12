'use client';

import { CalendarDays, CalendarPlus, CheckCircle2, ClipboardEdit, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { SessionForm } from '@/components/booking/SessionForm';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Feedback';
import { dateKey, formatCalendarDate, formatTime } from '@/lib/time';
import type { Session } from '@/lib/types';

function BookingContent() {
  const params = useSearchParams();
  const { boxById } = useApp();
  const [saved, setSaved] = useState<Session | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (saved) {
    const box = boxById.get(saved.box_id);
    const day = dateKey(saved.starts_at);
    return (
      <Card className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-ink">Séance réservée</h2>
        <p className="mt-2 text-[14px] capitalize text-ink-soft">
          {formatCalendarDate(day, 'EEEE d MMMM yyyy')} à {formatTime(saved.starts_at)} · {box?.name}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" icon={UserRound} href={`/clients/${saved.client_id}`}>
            Fiche client
          </Button>
          <Button variant="secondary" icon={ClipboardEdit} href={`/clients/${saved.client_id}/evaluation/${saved.id}`}>
            Évaluation
          </Button>
          <Button variant="secondary" icon={CalendarDays} href={`/planning?view=day&date=${day}`}>
            Voir le planning
          </Button>
          <Button
            icon={CalendarPlus}
            onClick={() => {
              setSaved(null);
              setFormKey((k) => k + 1);
            }}
          >
            Nouvelle réservation
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <SessionForm
      key={formKey}
      mode="create"
      initialClientId={params.get('client')}
      initialBoxId={params.get('box')}
      initialDate={params.get('date')}
      initialTime={params.get('time')}
      onSaved={setSaved}
    />
  );
}

export default function NewSessionPage() {
  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Réserver une séance"
        description="Choisissez le client, le box et un créneau libre. Les règles du centre sont vérifiées en temps réel."
      />
      <Suspense fallback={<PageLoader />}>
        <BookingContent />
      </Suspense>
    </>
  );
}
