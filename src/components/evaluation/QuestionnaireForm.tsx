'use client';

import { ArrowLeft, ArrowRight, Check, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { saveAssessment, type AssessmentWithResponses } from '@/lib/db/assessments';
import { SCORE_LABELS, getScoreLabel, scoreTone } from '@/lib/questionnaire/scale';
import type { AssessmentFormState, QuestionnaireTheme } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = ['Thèmes', 'Difficultés', 'Intensité'];

/** Active themes + any theme/difficulty only known from saved answers (deleted or deactivated since). */
function mergeThemes(themes: QuestionnaireTheme[], sources: (AssessmentWithResponses | null)[]) {
  const merged = themes.map((t) => ({ ...t, difficulties: [...t.difficulties] }));
  for (const source of sources) {
    for (const r of source?.responses ?? []) {
      let theme = merged.find((t) => t.id === r.theme_id);
      if (!theme) {
        theme = {
          id: r.theme_id,
          emoji: r.theme_emoji,
          title: r.theme_title || 'Thème archivé',
          description: 'Thème retiré du questionnaire, conservé pour le suivi de ce client.',
          sort_order: 999,
          is_active: false,
          difficulties: [],
        };
        merged.push(theme);
      }
      if (!theme.difficulties.some((d) => d.id === r.difficulty_id)) {
        theme.difficulties.push({
          id: r.difficulty_id,
          theme_id: r.theme_id,
          label: r.difficulty_label || r.difficulty_id,
          sort_order: 999,
          is_active: false,
        });
      }
    }
  }
  return merged;
}

function initialState(source: AssessmentWithResponses | null): AssessmentFormState {
  if (!source) return { selectedThemes: [], selectedDifficulties: {}, scores: {} };
  const selectedDifficulties: Record<string, boolean> = {};
  const scores: Record<string, number> = {};
  for (const r of source.responses) {
    selectedDifficulties[r.difficulty_id] = true;
    scores[r.difficulty_id] = r.score;
  }
  const themes = new Set([...source.selected_themes, ...source.responses.map((r) => r.theme_id)]);
  return { selectedThemes: [...themes], selectedDifficulties, scores };
}

export function QuestionnaireForm({
  sessionId,
  themes,
  current,
  previous,
  previousLabel,
  onSaved,
}: {
  sessionId: string;
  themes: QuestionnaireTheme[];
  current: AssessmentWithResponses | null;
  previous: AssessmentWithResponses | null;
  previousLabel?: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const allThemes = useMemo(() => mergeThemes(themes, [current, previous]), [themes, current, previous]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AssessmentFormState>(() => initialState(current ?? previous));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousScores = useMemo(() => {
    const map: Record<string, number> = {};
    previous?.responses.forEach((r) => (map[r.difficulty_id] = r.score));
    return map;
  }, [previous]);

  const activeThemes = allThemes.filter((t) => form.selectedThemes.includes(t.id));
  const selectedIds = activeThemes.flatMap((t) => t.difficulties.filter((d) => form.selectedDifficulties[d.id]).map((d) => d.id));

  const toggleTheme = (id: string) =>
    setForm((f) => ({
      ...f,
      selectedThemes: f.selectedThemes.includes(id) ? f.selectedThemes.filter((t) => t !== id) : [...f.selectedThemes, id],
    }));

  const toggleDifficulty = (id: string) =>
    setForm((f) => {
      const on = !f.selectedDifficulties[id];
      const scores = { ...f.scores };
      if (on && scores[id] === undefined) scores[id] = previousScores[id] ?? 5;
      return { ...f, selectedDifficulties: { ...f.selectedDifficulties, [id]: on }, scores };
    });

  const canNext = step === 0 ? form.selectedThemes.length > 0 : step === 1 ? selectedIds.length > 0 : true;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const responses = activeThemes.flatMap((t) =>
        t.difficulties
          .filter((d) => form.selectedDifficulties[d.id])
          .map((d) => ({
            theme_id: t.id,
            theme_title: t.title,
            theme_emoji: t.emoji,
            difficulty_id: d.id,
            difficulty_label: d.label,
            score: form.scores[d.id] ?? 0,
          }))
      );
      await saveAssessment(
        sessionId,
        activeThemes.map((t) => t.id),
        responses
      );
      toast.success('Évaluation enregistrée.');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={i > step && !canNext}
            onClick={() => i <= step && setStep(i)}
            className="flex flex-1 flex-col gap-2 text-left"
          >
            <span className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-navy' : 'bg-line')} />
            <span className={cn('text-[12px] font-medium', i === step ? 'text-ink' : 'text-ink-muted')}>
              {i + 1}. {label}
            </span>
          </button>
        ))}
      </div>

      {(current || previous) && step === 0 && (
        <Alert tone="info" className="mb-5">
          {current ? (
            <>Une évaluation existe déjà pour cette séance : vous la modifiez.</>
          ) : (
            <>
              Réponses pré-remplies depuis la séance précédente dans le calendrier
              {previousLabel ? ` (${previousLabel})` : ''}. Ajustez-les selon le ressenti du jour.
            </>
          )}
        </Alert>
      )}

      <Card>
        {step === 0 && (
          <div>
            <h2 className="text-[18px] font-semibold text-ink">Quels domaines souhaitez-vous travailler ?</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Sélectionnez un ou plusieurs thèmes.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {allThemes
                .filter((t) => t.is_active || form.selectedThemes.includes(t.id))
                .map((t) => {
                  const selected = form.selectedThemes.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTheme(t.id)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
                        selected ? 'border-navy bg-navy-50 ring-1 ring-navy' : 'border-line-strong hover:border-ink-muted/50 hover:bg-surface-muted'
                      )}
                    >
                      <span className="text-[20px] leading-none">{t.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium leading-snug text-ink">{t.title}</span>
                        {!t.is_active && <span className="mt-0.5 block text-[11px] text-ink-muted">Thème archivé</span>}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-navy bg-navy text-white' : 'border-line-strong'
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-7">
            <div>
              <h2 className="text-[18px] font-semibold text-ink">Quelles difficultés ressentez-vous ?</h2>
              <p className="mt-1 text-[13px] text-ink-muted">Cochez les difficultés concernées dans chaque thème.</p>
            </div>
            {activeThemes.map((t) => (
              <div key={t.id}>
                <h3 className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <span>{t.emoji}</span> {t.title}
                </h3>
                {t.description && <p className="mb-2 text-[12px] italic text-ink-muted">{t.description}</p>}
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {t.difficulties
                    .filter((d) => d.is_active || form.selectedDifficulties[d.id])
                    .map((d) => {
                      const checked = Boolean(form.selectedDifficulties[d.id]);
                      return (
                        <label
                          key={d.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors',
                            checked ? 'bg-navy-50 text-ink' : 'text-ink-soft hover:bg-surface-muted'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDifficulty(d.id)}
                            className="h-4 w-4 accent-[var(--navy)]"
                          />
                          {d.label}
                          {previousScores[d.id] !== undefined && (
                            <span className="tabular ml-auto text-[11px] text-ink-muted">préc. {previousScores[d.id]}/10</span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-ink">Évaluez l’intensité de chaque difficulté</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                {SCORE_LABELS.filter((s) => s.min > 0)
                  .map((s) => `${s.min}–${s.max} ${s.label.toLowerCase()}`)
                  .join(' · ')}
              </p>
            </div>
            {activeThemes.map((t) => {
              const items = t.difficulties.filter((d) => form.selectedDifficulties[d.id]);
              if (!items.length) return null;
              return (
                <div key={t.id}>
                  <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                    <span>{t.emoji}</span> {t.title}
                  </h3>
                  <div className="divide-y divide-line rounded-xl border border-line">
                    {items.map((d) => {
                      const value = form.scores[d.id] ?? 5;
                      const prev = previousScores[d.id];
                      const tone = scoreTone(value);
                      return (
                        <div key={d.id} className="px-4 py-4">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <p className="text-[14px] font-medium text-ink">{d.label}</p>
                            <div className="flex shrink-0 items-center gap-2">
                              {prev !== undefined && prev !== value && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                                  <History className="h-3 w-3" /> {prev} →
                                </span>
                              )}
                              <span
                                className="tabular rounded-md px-2 py-0.5 text-[14px] font-semibold"
                                style={{ color: tone.fg, background: tone.bg }}
                              >
                                {value}/10
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={1}
                            value={value}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, scores: { ...f.scores, [d.id]: Number(e.target.value) } }))
                            }
                            className="score-slider w-full cursor-pointer"
                            style={{ '--fill': `${value * 10}%` } as React.CSSProperties}
                            aria-label={d.label}
                          />
                          <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
                            <span>0</span>
                            <span className="font-medium" style={{ color: tone.fg }}>
                              {getScoreLabel(value)}
                            </span>
                            <span>10</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <Alert tone="error" className="mt-5">
            {error}
          </Alert>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            Retour
          </Button>
          {step < STEPS.length - 1 ? (
            <Button iconRight={ArrowRight} onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continuer
            </Button>
          ) : (
            <Button icon={Check} onClick={handleSave} loading={saving}>
              Enregistrer l’évaluation
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
