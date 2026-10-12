'use client';

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { listClients } from '@/lib/db/clients';
import { toAppError } from '@/lib/db/errors';
import { checkSlot, createSession, listSessionsBetween, updateSession } from '@/lib/db/sessions';
import { listBlocks } from '@/lib/db/settings';
import { useAsync, useDebounced } from '@/lib/hooks';
import { buildSlots, evaluateSlot } from '@/lib/slots';
import {
  addDaysToKey,
  dateKey,
  dayHours,
  formatCalendarDate,
  formatTime,
  sessionEnd,
  timeKey,
  todayKey,
  toUtcIso,
  utcBounds,
} from '@/lib/time';
import type { Session, SessionWithRelations, SlotIssue } from '@/lib/types';
import { cn, fullName } from '@/lib/utils';
import { ClientPicker } from './ClientPicker';
import { SlotGrid } from './SlotGrid';

const GAP_ALERT = 'La séance précédente ne sera pas encore terminée. Voulez-vous quand même réserver ?';

interface SessionFormProps {
  mode: 'create' | 'edit';
  session?: SessionWithRelations;
  initialClientId?: string | null;
  initialBoxId?: string | null;
  initialDate?: string | null;
  initialTime?: string | null;
  variant?: 'page' | 'modal';
  onSaved: (session: Session) => void;
  onCancel?: () => void;
}

function Section({ step, title, children, aside }: { step: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-[12px] font-semibold text-navy">
            {step}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SessionForm({
  mode,
  session,
  initialClientId,
  initialBoxId,
  initialDate,
  initialTime,
  variant = 'page',
  onSaved,
  onCancel,
}: SessionFormProps) {
  const { settings, activeBoxes, boxById } = useApp();
  const today = todayKey();

  const [clientId, setClientId] = useState<string | null>(session?.client_id ?? initialClientId ?? null);
  const [boxId, setBoxId] = useState<string | null>(session?.box_id ?? initialBoxId ?? null);
  const [date, setDate] = useState(
    session ? dateKey(session.starts_at) : initialDate && initialDate >= today ? initialDate : today
  );
  const [time, setTime] = useState(session ? timeKey(session.starts_at) : initialTime ?? '');
  const [duration, setDuration] = useState(session?.duration_minutes ?? settings.default_session_minutes);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [manualTime, setManualTime] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gapDialog, setGapDialog] = useState<string[] | null>(null);

  const clients = useAsync(() => (mode === 'create' ? listClients() : Promise.resolve([])), [mode]);

  const dayData = useAsync(async () => {
    const { start, end } = utcBounds(date, date);
    const [sessions, blocks] = await Promise.all([listSessionsBetween(start, end), listBlocks(start, end)]);
    return { sessions, blocks };
  }, [date]);

  const boxes = useMemo(() => {
    const list = [...activeBoxes];
    if (session && !list.some((b) => b.id === session.box_id)) {
      const current = boxById.get(session.box_id);
      if (current) list.push(current);
    }
    return list;
  }, [activeBoxes, boxById, session]);

  const hours = dayHours(settings.opening_hours, date);
  const daySessions = useMemo(() => dayData.data?.sessions ?? [], [dayData.data]);
  const dayBlocks = useMemo(() => dayData.data?.blocks ?? [], [dayData.data]);

  const slots = useMemo(() => {
    if (!boxId || !hours) return [];
    return buildSlots({
      dayKey: date,
      boxId,
      duration,
      settings,
      sessions: daySessions,
      blocks: dayBlocks,
      excludeId: session?.id,
    });
  }, [boxId, hours, date, duration, settings, daySessions, dayBlocks, session?.id]);

  const boxDaySessions = daySessions.filter(
    (s) => s.box_id === boxId && s.status !== 'cancelled' && s.id !== session?.id
  );
  const clientSameDay = daySessions.filter(
    (s) => s.client_id === clientId && s.status !== 'cancelled' && s.id !== session?.id
  );

  const startsAt = date && time ? toUtcIso(date, time) : null;
  const slotKey = useDebounced(boxId && startsAt ? `${boxId}|${startsAt}|${duration}` : '', 250);
  const [slotCheck, setSlotCheck] = useState<{ key: string; issues: SlotIssue[] | null } | null>(null);

  useEffect(() => {
    if (!slotKey) return;
    const [b, s, d] = slotKey.split('|');
    let cancelled = false;
    checkSlot({ boxId: b, startsAt: s, duration: Number(d), excludeId: session?.id })
      .then((res) => !cancelled && setSlotCheck({ key: slotKey, issues: res }))
      .catch(() => !cancelled && setSlotCheck({ key: slotKey, issues: null }));
    return () => {
      cancelled = true;
    };
  }, [slotKey, session?.id, dayData.data]);

  const checking = Boolean(slotKey) && slotCheck?.key !== slotKey;
  const issues = slotKey && !checking ? (slotCheck?.issues ?? null) : null;

  const unchangedSlot =
    mode === 'edit' &&
    session &&
    session.status !== 'cancelled' &&
    session.box_id === boxId &&
    startsAt === new Date(session.starts_at).toISOString() &&
    session.duration_minutes === duration;

  const errors = unchangedSlot ? [] : (issues ?? []).filter((i) => i.level === 'error');
  const gapWarnings = unchangedSlot ? [] : (issues ?? []).filter((i) => i.code.startsWith('GAP_'));
  const otherWarnings = unchangedSlot ? [] : (issues ?? []).filter((i) => i.level === 'warning' && !i.code.startsWith('GAP_'));

  const fieldErrors = {
    client: !clientId ? 'Sélectionnez un client.' : undefined,
    box: !boxId ? 'Choisissez un box.' : undefined,
    date: !date ? 'Choisissez une date.' : date < today && !unchangedSlot ? 'La date ne peut pas être antérieure à aujourd’hui.' : undefined,
    time: !time ? 'Choisissez un horaire.' : undefined,
    duration: !duration || duration < 5 ? 'Durée invalide.' : undefined,
  };
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);

  const selectedSlot =
    boxId && time && hours
      ? evaluateSlot(time, { dayKey: date, boxId, duration, settings, sessions: daySessions, blocks: dayBlocks, excludeId: session?.id })
      : null;

  async function save(override: boolean) {
    if (!clientId || !boxId || !startsAt) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        client_id: clientId,
        box_id: boxId,
        starts_at: startsAt,
        duration_minutes: duration,
        notes: notes.trim() || null,
        gap_override: override,
      };
      const saved = mode === 'create' ? await createSession(payload) : await updateSession(session!.id, payload);
      setGapDialog(null);
      onSaved(saved);
    } catch (e) {
      const err = toAppError(e);
      if (err.kind === 'gap') {
        setGapDialog([err.message]);
      } else {
        setGapDialog(null);
        setSaveError(err.message);
        if (err.kind === 'slot') void dayData.reload({ silent: true });
      }
    } finally {
      setSaving(false);
    }
  }

  function onSubmit() {
    setTouched(true);
    setSaveError(null);
    if (hasFieldErrors) return;
    if (errors.length) {
      setSaveError(errors.map((e) => e.message).join(' '));
      return;
    }
    if (gapWarnings.length) {
      setGapDialog(gapWarnings.map((w) => w.message));
      return;
    }
    void save(false);
  }

  const durationOptions = Array.from(new Set([33, 45, 60, settings.default_session_minutes])).sort((a, b) => a - b);
  const box = boxId ? boxById.get(boxId) : null;
  const client = clients.data?.find((c) => c.id === clientId) ?? session?.client ?? null;
  const end = startsAt ? sessionEnd(startsAt, duration) : null;

  const statusBlock = (
    <div className="space-y-2">
      {saveError && <Alert tone="error">{saveError}</Alert>}
      {!saveError && startsAt && boxId && (
        checking ? (
          <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification du créneau…
          </div>
        ) : errors.length ? (
          <Alert tone="error" title="Créneau indisponible">
            {errors.map((e) => (
              <p key={e.code + e.message}>{e.message}</p>
            ))}
          </Alert>
        ) : gapWarnings.length ? (
          <Alert tone="warning" title="Attention à l’enchaînement">
            {gapWarnings.map((w) => (
              <p key={w.message}>{w.message}</p>
            ))}
            <p className="mt-1">Vous pourrez confirmer la réservation malgré cette alerte.</p>
          </Alert>
        ) : issues ? (
          <Alert tone="success">Créneau disponible.</Alert>
        ) : null
      )}
      {otherWarnings.map((w) => (
        <Alert key={w.code} tone="info">
          {w.message}
        </Alert>
      ))}
      {clientSameDay.length > 0 && clientId && (
        <Alert tone="info">
          Ce client a déjà {clientSameDay.length > 1 ? 'des séances' : 'une séance'} ce jour-là :{' '}
          {clientSameDay
            .map((s) => `${formatTime(s.starts_at)} (${boxById.get(s.box_id)?.name ?? 'box'})`)
            .join(', ')}
          .
        </Alert>
      )}
    </div>
  );

  const summary = (
    <dl className="space-y-3 text-[13px]">
      {[
        ['Client', client ? fullName(client) : '—'],
        ['Box', box ? box.name : '—'],
        ['Date', date ? formatCalendarDate(date, 'EEEE d MMMM yyyy') : '—'],
        ['Horaire', time && end ? `${time} → ${formatTime(end)}` : '—'],
        ['Durée', `${duration} min`],
      ].map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="text-right font-medium text-ink first-letter:uppercase">{v}</dd>
        </div>
      ))}
    </dl>
  );

  const submitLabel = mode === 'create' ? 'Confirmer la réservation' : 'Enregistrer les modifications';

  const body = (
    <div className="space-y-8">
      {mode === 'create' ? (
        <Section step={1} title="Client">
          <ClientPicker
            clients={clients.data ?? []}
            loading={clients.loading}
            value={clientId}
            onChange={setClientId}
            error={touched ? fieldErrors.client : undefined}
          />
        </Section>
      ) : (
        session?.client && (
          <div className="rounded-xl bg-surface-muted px-4 py-3 text-[14px]">
            <span className="text-ink-muted">Client : </span>
            <span className="font-medium text-ink">{fullName(session.client)}</span>
            {session.session_number && <span className="text-ink-muted"> · Séance n°{session.session_number}</span>}
          </div>
        )
      )}

      <Section step={mode === 'create' ? 2 : 1} title="Box">
        {boxes.length === 0 ? (
          <Alert tone="warning">Aucun box actif. Un administrateur doit en activer un.</Alert>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {boxes.map((b) => {
              const count = daySessions.filter((s) => s.box_id === b.id && s.status !== 'cancelled' && s.id !== session?.id).length;
              const selected = b.id === boxId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoxId(b.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    selected ? 'border-navy bg-navy-50 ring-1 ring-navy' : 'border-line-strong bg-surface hover:border-ink-muted/50'
                  )}
                >
                  <span className="h-8 w-1.5 rounded-full" style={{ background: b.color }} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{b.name}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {!b.is_active ? 'Désactivé' : `${count} séance${count > 1 ? 's' : ''} ce jour`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {touched && fieldErrors.box && <p className="mt-1.5 text-[12px] text-danger">{fieldErrors.box}</p>}
      </Section>

      <Section step={mode === 'create' ? 3 : 2} title="Date et durée">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field error={touched ? fieldErrors.date : undefined}>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                icon={ChevronLeft}
                title="Jour précédent"
                disabled={date <= today}
                onClick={() => setDate(addDaysToKey(date, -1))}
              />
              <Input
                type="date"
                value={date}
                min={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="tabular"
              />
              <Button variant="secondary" icon={ChevronRight} title="Jour suivant" onClick={() => setDate(addDaysToKey(date, 1))} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['Aujourd’hui', today],
                ['Demain', addDaysToKey(today, 1)],
                ['Dans 7 jours', addDaysToKey(today, 7)],
              ].map(([label, key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDate(key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                    date === key ? 'border-navy bg-navy text-white' : 'border-line-strong text-ink-soft hover:bg-surface-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field hint="Durée de la séance" error={touched ? fieldErrors.duration : undefined}>
            <div className="flex flex-wrap items-center gap-1.5">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    'tabular h-10 rounded-[10px] border px-3 text-[13px] font-medium',
                    duration === d ? 'border-navy bg-navy text-white' : 'border-line-strong bg-surface text-ink hover:bg-surface-muted'
                  )}
                >
                  {d} min
                </button>
              ))}
              <Input
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="tabular w-20"
                aria-label="Durée personnalisée"
              />
            </div>
          </Field>
        </div>
        <p className="mt-3 text-[13px] capitalize text-ink-soft">{formatCalendarDate(date, 'EEEE d MMMM yyyy')}</p>
      </Section>

      <Section
        step={mode === 'create' ? 4 : 3}
        title="Horaire"
        aside={
          boxId && hours ? (
            <button
              type="button"
              onClick={() => setManualTime((v) => !v)}
              className="text-[13px] font-medium text-navy hover:underline"
            >
              {manualTime ? 'Choisir dans la grille' : 'Saisir une autre heure'}
            </button>
          ) : null
        }
      >
        {!boxId ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-muted">
            Choisissez d’abord un box pour voir les créneaux disponibles.
          </p>
        ) : !hours ? (
          <Alert tone="warning">Le centre est fermé ce jour-là. Choisissez une autre date.</Alert>
        ) : dayData.loading && !dayData.data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
          </div>
        ) : manualTime ? (
          <div className="flex items-center gap-3">
            <Input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} className="tabular w-36" />
            <span className="text-[13px] text-ink-muted">
              Ouverture {hours.open} – {hours.close}
            </span>
          </div>
        ) : (
          <SlotGrid slots={slots} value={time} onChange={setTime} />
        )}
        {touched && fieldErrors.time && <p className="mt-1.5 text-[12px] text-danger">{fieldErrors.time}</p>}
        {selectedSlot && selectedSlot.state !== 'free' && selectedSlot.state !== 'near' && manualTime && (
          <p className="mt-2 text-[12px] text-danger">{selectedSlot.reason}</p>
        )}

        {boxId && hours && boxDaySessions.length > 0 && (
          <div className="mt-5 rounded-xl bg-surface-muted p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
              <Clock3 className="h-3.5 w-3.5" /> Déjà réservé dans {box?.name} ce jour
            </p>
            <ul className="space-y-1">
              {boxDaySessions.map((s) => (
                <li key={s.id} className="tabular flex gap-3 text-[13px] text-ink-soft">
                  <span className="w-[92px] font-medium text-ink">
                    {formatTime(s.starts_at)} – {formatTime(sessionEnd(s.starts_at, s.duration_minutes))}
                  </span>
                  <span className="truncate">{fullName(s.client)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section step={mode === 'create' ? 5 : 4} title="Notes (facultatif)">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations utiles pour la séance…"
          rows={2}
        />
      </Section>
    </div>
  );

  const gapConfirm = (
    <ConfirmDialog
      open={Boolean(gapDialog)}
      tone="warning"
      title="Séance précédente non terminée"
      message={
        <div className="space-y-2">
          <p className="font-medium text-ink">{GAP_ALERT}</p>
          {gapDialog?.map((m) => (
            <p key={m} className="text-[13px] text-ink-muted">
              {m}
            </p>
          ))}
        </div>
      }
      confirmLabel="Réserver quand même"
      cancelLabel="Choisir un autre horaire"
      loading={saving}
      onConfirm={() => save(true)}
      onCancel={() => setGapDialog(null)}
    />
  );

  if (variant === 'modal') {
    return (
      <>
        {body}
        <div className="mt-8 space-y-4 border-t border-line pt-6">
          {statusBlock}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Annuler
              </Button>
            )}
            <Button onClick={onSubmit} loading={saving} disabled={checking || errors.length > 0}>
              {submitLabel}
            </Button>
          </div>
        </div>
        {gapConfirm}
      </>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>{body}</Card>
      <div className="space-y-4 lg:sticky lg:top-8">
        <Card>
          <h3 className="mb-4 text-[14px] font-semibold text-ink">Récapitulatif</h3>
          {summary}
          <div className="mt-5">{statusBlock}</div>
          <Button
            className="mt-5"
            fullWidth
            size="lg"
            onClick={onSubmit}
            loading={saving}
            disabled={checking || errors.length > 0}
            icon={gapWarnings.length ? AlertTriangle : CheckCircle2}
          >
            {submitLabel}
          </Button>
          {touched && hasFieldErrors && (
            <p className="mt-2 text-center text-[12px] text-danger">Complétez les champs requis.</p>
          )}
        </Card>
        <p className="px-1 text-[12px] leading-relaxed text-ink-muted">
          Règles : pas de date passée, un seul client par box et par horaire, {settings.min_gap_minutes} minutes minimum
          entre deux débuts de séance dans le même box (alerte confirmable).
        </p>
      </div>
      {gapConfirm}
    </div>
  );
}