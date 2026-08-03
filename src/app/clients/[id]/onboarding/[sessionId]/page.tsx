'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/Header';
import { PageTitle } from '@/components/ui/Card';
import { QuestionnaireForm } from '@/components/forms/QuestionnaireForm';
import { localDb } from '@/lib/data/local-store';

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = use(params);
  const router = useRouter();
  const [completed, setCompleted] = useState(false);

  const client = localDb.getClient(id);
  const session = localDb.getSession(sessionId);
  const existingAssessment = localDb.getAssessmentBySession(sessionId);

  if (!client || !session) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <p className="text-[16px] text-[#86868B]">Session introuvable</p>
          <Link href={`/clients/${id}`} className="mt-4 inline-block text-[#7EB8DA]">
            Retour au profil
          </Link>
        </div>
      </PageShell>
    );
  }

  if (completed) {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md py-20 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <CheckCircle2 className="mx-auto h-16 w-16 text-[#A8C5B8]" strokeWidth={1.5} />
          </motion.div>
          <h2 className="mt-6 text-[24px] font-light text-[#1D1D1F]">
            Évaluation enregistrée
          </h2>
          <p className="mt-2 text-[15px] text-[#86868B]">
            Les réponses de {client.first_name} ont été sauvegardées pour la séance n°{session.session_number}.
          </p>
          <Link
            href={`/clients/${id}`}
            className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-[#7EB8DA] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au profil client
          </Link>
        </motion.div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link
        href={`/clients/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-[#86868B] transition-colors hover:text-[#1D1D1F]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {client.first_name} {client.last_name}
      </Link>

      <PageTitle
        title="Questionnaire NeuroÉquilibre"
        subtitle={
          existingAssessment
            ? `Modifier l'évaluation — Séance n°${session.session_number}`
            : `Première évaluation — Séance n°${session.session_number}`
        }
      />

      <div className="rounded-3xl border border-black/[0.04] bg-white/60 p-6 md:p-10 backdrop-blur-sm">
        <QuestionnaireForm
          clientId={id}
          sessionId={sessionId}
          onComplete={() => setCompleted(true)}
        />
      </div>
    </PageShell>
  );
}
