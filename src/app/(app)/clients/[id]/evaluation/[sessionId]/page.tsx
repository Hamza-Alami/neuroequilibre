'use client';

import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { QuestionnaireForm } from '@/components/evaluation/QuestionnaireForm';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Card';
import { Alert, PageLoader } from '@/components/ui/Feedback';
import { getPreviousAssessment, getSessionAssessment } from '@/lib/db/assessments';
import { errorMessage } from '@/lib/db/errors';
import { listThemes } from '@/lib/db/questionnaire';
import { getSession } from '@/lib/db/sessions';
import { useAsync } from '@/lib/hooks';
import { fmt, formatDate } from '@/lib/time';
import { fullName } from '@/lib/utils';

export default function EvaluationPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const router = useRouter();

  const data = useAsync(async () => {
    const session = await getSession(sessionId);
    if (!session) return null;
    const [themes, current, previous] = await Promise.all([
      listThemes(),
      getSessionAssessment(sessionId),
      getPreviousAssessment(id, session.starts_at, sessionId),
    ]);
    return { session, themes, current, previous };
  }, [id, sessionId]);

  if (data.loading) return <PageLoader />;
  if (data.error) return <Alert tone="error">{errorMessage(data.error)}</Alert>;
  if (!data.data) return <Alert tone="warning">Séance introuvable.</Alert>;

  const { session, themes, current, previous } = data.data;

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" icon={ArrowLeft} href={`/clients/${id}`}>
          {fullName(session.client)}
        </Button>
      </div>
      <PageHeader
        eyebrow="Évaluation"
        title={`Séance n°${session.session_number ?? '—'} · ${fullName(session.client)}`}
        description={`${fmt(session.starts_at, "EEEE d MMMM yyyy 'à' HH:mm")} · ${session.box?.name ?? ''}`}
      />
      {session.status === 'cancelled' ? (
        <Alert tone="warning">Cette séance est annulée : l’évaluation n’est pas disponible.</Alert>
      ) : (
        <QuestionnaireForm
          sessionId={sessionId}
          themes={themes}
          current={current}
          previous={previous}
          previousLabel={
            previous ? `séance n°${previous.session_number ?? '—'} du ${formatDate(previous.session_starts_at)}` : undefined
          }
          onSaved={() => router.push(`/clients/${id}?tab=evolution`)}
        />
      )}
    </>
  );
}
