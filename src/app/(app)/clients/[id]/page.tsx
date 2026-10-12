'use client';

import { CalendarCheck, CalendarClock, CalendarPlus, ClipboardCheck, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { SessionDetailModal } from '@/components/booking/SessionDetailModal';
import { EvolutionPanel } from '@/components/client/EvolutionPanel';
import { AgendaList } from '@/components/planning/AgendaList';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { listClientAssessments } from '@/lib/db/assessments';
import { deleteClient, getClient } from '@/lib/db/clients';
import { errorMessage } from '@/lib/db/errors';
import { listKycSections } from '@/lib/db/kyc';
import { listClientSessions } from '@/lib/db/sessions';
import { computeClientEvolution } from '@/lib/evolution';
import { useAsync } from '@/lib/hooks';
import { calculateAge, fmt, formatDate } from '@/lib/time';
import type { CustomFieldValue, SessionWithRelations } from '@/lib/types';
import { getInitials } from '@/lib/utils';

type Tab = 'sessions' | 'evolution' | 'infos';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-2.5 text-[14px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value === null || value === undefined || value === '' ? <span className="text-ink-muted/60">—</span> : value}</dd>
    </div>
  );
}

function formatCustom(value: CustomFieldValue | undefined) {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  return value ?? null;
}

function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'sessions');
  const [selected, setSelected] = useState<SessionWithRelations | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const data = useAsync(async () => {
    const [client, sessions, assessments, sections] = await Promise.all([
      getClient(id),
      listClientSessions(id),
      listClientAssessments(id),
      listKycSections({ includeInactive: true }),
    ]);
    return { client, sessions, assessments, sections };
  }, [id]);

  const evolution = useMemo(
    () => (data.data ? computeClientEvolution({ sessions: data.data.sessions, assessments: data.data.assessments }) : null),
    [data.data]
  );

  if (data.loading && !data.data) return <PageLoader />;
  if (data.error) return <Alert tone="error">{errorMessage(data.error)}</Alert>;
  if (!data.data?.client || !evolution) {
    return <EmptyState title="Client introuvable" description="Cette fiche n’existe pas ou a été supprimée." action={<Button href="/clients">Retour aux clients</Button>} />;
  }

  const { client, sessions, sections } = data.data;
  const now = new Date().toISOString();
  const active = sessions.filter((s) => s.status !== 'cancelled');
  const upcoming = sessions.filter((s) => s.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = sessions.filter((s) => s.starts_at < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const nextSession = upcoming.find((s) => s.status !== 'cancelled');
  const evaluated = sessions.filter((s) => s.has_assessment).length;
  const pendingEvaluation = past.find((s) => s.status !== 'cancelled' && !s.has_assessment);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteClient(id);
      toast.success('Client et données associées supprimés.');
      router.replace('/clients');
    } catch (e) {
      toast.error(e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-[18px] font-semibold text-white">
            {getInitials(client.first_name, client.last_name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
              {client.first_name} {client.last_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
              <span>{calculateAge(client.date_of_birth)} ans</span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {client.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {client.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {client.city}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Pencil} href={`/clients/${id}/edit`}>
            Modifier
          </Button>
          {isAdmin && (
            <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)} className="text-danger hover:bg-danger-50">
              Supprimer
            </Button>
          )}
          <Button icon={CalendarPlus} href={`/sessions/new?client=${id}`}>
            Réserver une séance
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} label="Séances" value={active.length} hint={`${evaluated} évaluée${evaluated > 1 ? 's' : ''}`} />
        <StatCard
          icon={CalendarClock}
          tone="gold"
          label="Prochaine séance"
          value={<span className="text-[16px]">{nextSession ? fmt(nextSession.starts_at, "d MMM 'à' HH:mm") : '—'}</span>}
          hint={nextSession?.box?.name}
        />
        <StatCard
          icon={ClipboardCheck}
          tone="success"
          label="Évolution"
          value={`${evolution.difficulties.filter((d) => d.improvement > 0).length} / ${evolution.difficulties.length}`}
          hint="difficultés en amélioration"
        />
      </div>

      {pendingEvaluation && (
        <Alert
          tone="warning"
          className="mb-6"
          title="Évaluation à compléter"
          action={
            <Button size="sm" variant="secondary" href={`/clients/${id}/evaluation/${pendingEvaluation.id}`}>
              Remplir l’évaluation
            </Button>
          }
        >
          La séance n°{pendingEvaluation.session_number} du {formatDate(pendingEvaluation.starts_at)} n’a pas encore d’évaluation.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'sessions', label: 'Séances', count: sessions.length },
          { value: 'evolution', label: 'Évolution', count: evolution.difficulties.length },
          { value: 'infos', label: 'Informations' },
        ]}
      />

      {tab === 'sessions' && (
        <div className="space-y-6">
          {sessions.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarPlus}
                title="Aucune séance"
                description="Réservez la première séance de ce client."
                action={<Button icon={CalendarPlus} href={`/sessions/new?client=${id}`}>Réserver</Button>}
              />
            </Card>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">À venir</h2>
                  <Card padded={false} className="overflow-hidden">
                    <AgendaList sessions={upcoming} onSelectSession={setSelected} showClient={false} />
                  </Card>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Historique</h2>
                  <Card padded={false} className="overflow-hidden">
                    <AgendaList sessions={past} onSelectSession={setSelected} showClient={false} />
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'evolution' && <EvolutionPanel client={client} evolution={evolution} sessions={sessions} />}

      {tab === 'infos' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-[15px] font-semibold text-ink">Identité & coordonnées</h2>
            <dl className="divide-y divide-line">
              <InfoRow label="Prénom" value={client.first_name} />
              <InfoRow label="Nom" value={client.last_name} />
              <InfoRow label="Date de naissance" value={`${formatDate(client.date_of_birth)} (${calculateAge(client.date_of_birth)} ans)`} />
              <InfoRow label="Téléphone" value={client.phone} />
              <InfoRow label="Email" value={client.email} />
              <InfoRow label="Adresse" value={[client.address_line, client.postal_code, client.city].filter(Boolean).join(', ')} />
              <InfoRow label="Pays" value={client.country} />
              <InfoRow label="Contact d’urgence" value={[client.emergency_contact_name, client.emergency_contact_phone].filter(Boolean).join(' · ')} />
              <InfoRow label="Client depuis" value={formatDate(client.created_at)} />
            </dl>
          </Card>
          <div className="space-y-5">
            {sections.map((s) => {
              const fields = s.fields.filter((f) => f.is_active || client.custom_fields[f.id] !== undefined);
              if (!fields.length) return null;
              return (
                <Card key={s.id}>
                  <h2 className="mb-2 text-[15px] font-semibold text-ink">{s.title}</h2>
                  <dl className="divide-y divide-line">
                    {fields.map((f) => (
                      <InfoRow key={f.id} label={f.label} value={formatCustom(client.custom_fields[f.id])} />
                    ))}
                  </dl>
                </Card>
              );
            })}
            <Card>
              <h2 className="mb-2 text-[15px] font-semibold text-ink">Notes internes</h2>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">{client.notes || '—'}</p>
            </Card>
          </div>
        </div>
      )}

      <SessionDetailModal session={selected} onClose={() => setSelected(null)} onChanged={() => data.reload({ silent: true })} />
      <ConfirmDialog
        open={confirmDelete}
        title={`Supprimer ${client.first_name} ${client.last_name} ?`}
        message="La fiche, toutes les séances et toutes les évaluations de ce client seront définitivement supprimées."
        confirmLabel="Supprimer définitivement"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ClientProfile />
    </Suspense>
  );
}
