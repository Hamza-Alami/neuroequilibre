'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  User,
  Plus,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { PageShell } from '@/components/layout/Header';
import { Card, PageTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SessionEditModal } from '@/components/forms/SessionEditModal';
import { EvolutionChart } from '@/components/client/EvolutionChart';
import { localDb } from '@/lib/data/local-store';
import type { Client, Session } from '@/lib/types';
import { calculateAge, formatDate, formatDateTime, getInitials } from '@/lib/utils';

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refresh = useCallback(() => {
    const c = localDb.getClient(id);
    setClient(c ?? null);
    setSessions(localDb.getSessions(id));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!client) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <p className="text-[16px] text-[#86868B]">Client introuvable</p>
          <Link href="/clients" className="mt-4 inline-block text-[#7EB8DA]">
            Retour aux clients
          </Link>
        </div>
      </PageShell>
    );
  }

  const latestSession = sessions[0];
  const hasAssessment = latestSession
    ? !!localDb.getAssessmentBySession(latestSession.id)
    : false;
  const pendingOnboarding = latestSession?.is_first_session && !hasAssessment;

  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleteLoading(true);
    localDb.deleteSession(deletingSession.id);
    await new Promise((r) => setTimeout(r, 400));
    setDeleteLoading(false);
    setDeletingSession(null);
    refresh();
  };

  const handleDeleteClient = async () => {
    setDeleteLoading(true);
    localDb.deleteClient(id);
    await new Promise((r) => setTimeout(r, 400));
    setDeleteLoading(false);
    router.push('/clients');
  };

  return (
    <PageShell>
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7EB8DA] to-[#A8C5B8] text-[20px] font-light text-white"
          >
            {getInitials(client.first_name, client.last_name)}
          </motion.div>
          <div>
            <PageTitle
              title={`${client.first_name} ${client.last_name}`}
              subtitle={`${calculateAge(client.date_of_birth)} ans · Client depuis ${formatDate(client.created_at)}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/sessions/new?client=${client.id}`}>
            <Button variant="secondary" size="sm">
              <Plus className="h-4 w-4" />
              Nouvelle séance
            </Button>
          </Link>
          {pendingOnboarding && latestSession && (
            <Link href={`/clients/${client.id}/onboarding/${latestSession.id}`}>
              <Button size="sm">
                <ClipboardList className="h-4 w-4" />
                Questionnaire
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeletingClient(true)}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer le client
          </Button>
        </div>
      </div>

      {pendingOnboarding && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-[#7EB8DA]/20 bg-gradient-to-r from-[#E8F4FA]/60 to-[#F0F5F2]/60 p-5"
        >
          <p className="text-[14px] font-medium text-[#1D1D1F]">
            Première séance en attente d&apos;évaluation
          </p>
          <p className="mt-1 text-[13px] text-[#86868B]">
            Le client doit compléter le questionnaire NeuroÉquilibre avant ou pendant la séance.
          </p>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-5 text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
            Informations
          </h3>
          <div className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={Phone} label="Téléphone" value={client.phone} />
            <InfoRow
              icon={MapPin}
              label="Résidence"
              value={`${client.city}, ${client.country}`}
            />
            <InfoRow
              icon={User}
              label="Naissance"
              value={formatDate(client.date_of_birth)}
            />
            {client.emergency_contact_name && (
              <InfoRow
                icon={Phone}
                label="Urgence"
                value={`${client.emergency_contact_name} — ${client.emergency_contact_phone}`}
              />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
              Séances
            </h3>
            <span className="text-[12px] text-[#86868B]">
              {sessions.length} séance{sessions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {sessions.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-[#86868B]">
              Aucune séance planifiée
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, i) => {
                const assessment = localDb.getAssessmentBySession(session.id);
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col gap-3 rounded-2xl border border-black/[0.04] bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F4FA]">
                        <Calendar className="h-4 w-4 text-[#7EB8DA]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#1D1D1F]">
                          Séance n°{session.session_number}
                          {session.is_first_session && (
                            <span className="ml-2 rounded-full bg-[#A8C5B8]/20 px-2 py-0.5 text-[11px] font-medium text-[#5A8A72]">
                              Première
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-[#86868B]">
                          {formatDateTime(session.session_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {assessment ? (
                        <Link href={`/clients/${client.id}/onboarding/${session.id}`}>
                          <Button variant="ghost" size="sm">
                            Modifier l&apos;évaluation
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/clients/${client.id}/onboarding/${session.id}`}>
                          <Button variant="outline" size="sm">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Évaluer
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSession(session)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingSession(session)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h3 className="mb-5 text-[13px] font-medium tracking-widest text-[#86868B] uppercase">
          Évolution clinique
        </h3>
        <EvolutionChart clientId={client.id} client={client} key={sessions.length} />
      </div>

      <SessionEditModal
        session={editingSession}
        open={!!editingSession}
        onClose={() => setEditingSession(null)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!deletingSession}
        title="Supprimer cette séance ?"
        description={
          deletingSession
            ? `La séance n°${deletingSession.session_number} du ${formatDateTime(deletingSession.session_date)} sera supprimée avec son évaluation associée. Les numéros de séance seront recalculés.`
            : ''
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeletingSession(null)}
      />

      <ConfirmDialog
        open={deletingClient}
        title="Supprimer ce client ?"
        description={`Toutes les données de ${client.first_name} ${client.last_name} seront définitivement supprimées : profil, séances, évaluations et historique d'évolution.`}
        confirmLabel="Supprimer définitivement"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteClient}
        onCancel={() => setDeletingClient(false)}
      />
    </PageShell>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#86868B]" strokeWidth={1.5} />
      <div>
        <p className="text-[11px] text-[#86868B]">{label}</p>
        <p className="text-[14px] text-[#1D1D1F]">{value}</p>
      </div>
    </div>
  );
}
