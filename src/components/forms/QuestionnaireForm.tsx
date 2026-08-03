'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScoreSlider, ThemeChip, DifficultyCheckbox, StepIndicator } from '@/components/ui/ScoreSlider';
import { QUESTIONNAIRE_THEMES, SCORE_LABELS } from '@/lib/questionnaire/themes';
import type { AssessmentFormState } from '@/lib/types';
import { localDb } from '@/lib/data/local-store';

interface QuestionnaireFormProps {
  clientId: string;
  sessionId: string;
  onComplete: () => void;
}

const STEPS = ['Thèmes', 'Difficultés', 'Évaluation'];

export function QuestionnaireForm({ clientId, sessionId, onComplete }: QuestionnaireFormProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AssessmentFormState>({
    selectedThemes: [],
    selectedDifficulties: {},
    scores: {},
  });
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const latest = localDb.getLatestAssessment(clientId, sessionId);
    if (latest) {
      const responses = localDb.getAssessmentResponses(latest.id);
      const prevThemes = latest.selected_themes;
      const prevDifficulties: Record<string, boolean> = {};
      const prevScores: Record<string, number> = {};

      for (const r of responses) {
        if (r.is_selected) {
          prevDifficulties[r.difficulty_id] = true;
          prevScores[r.difficulty_id] = r.score;
        }
      }

      setForm({
        selectedThemes: prevThemes,
        selectedDifficulties: prevDifficulties,
        scores: { ...prevScores },
      });
      setPreviousScores(prevScores);
    }
  }, [clientId, sessionId]);

  const toggleTheme = (themeId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedThemes: prev.selectedThemes.includes(themeId)
        ? prev.selectedThemes.filter((t) => t !== themeId)
        : [...prev.selectedThemes, themeId],
    }));
  };

  const toggleDifficulty = (difficultyId: string) => {
    setForm((prev) => {
      const isSelected = !prev.selectedDifficulties[difficultyId];
      const newDifficulties = { ...prev.selectedDifficulties, [difficultyId]: isSelected };
      const newScores = { ...prev.scores };
      if (isSelected && newScores[difficultyId] === undefined) {
        newScores[difficultyId] = previousScores[difficultyId] ?? 5;
      }
      return { ...prev, selectedDifficulties: newDifficulties, scores: newScores };
    });
  };

  const setScore = (difficultyId: string, score: number) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [difficultyId]: score },
    }));
  };

  const activeThemes = QUESTIONNAIRE_THEMES.filter((t) =>
    form.selectedThemes.includes(t.id)
  );

  const selectedDifficultyIds = Object.entries(form.selectedDifficulties)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const canProceed = useCallback(() => {
    if (step === 0) return form.selectedThemes.length > 0;
    if (step === 1) return selectedDifficultyIds.length > 0;
    return true;
  }, [step, form.selectedThemes, selectedDifficultyIds]);

  const handleSave = async () => {
    setSaving(true);
    const responses = selectedDifficultyIds.map((difficultyId) => {
      const theme = QUESTIONNAIRE_THEMES.find((t) =>
        t.difficulties.some((d) => d.id === difficultyId)
      );
      return {
        theme_id: theme?.id ?? '',
        difficulty_id: difficultyId,
        score: form.scores[difficultyId] ?? 0,
        is_selected: true,
      };
    });

    localDb.saveAssessment(
      {
        client_id: clientId,
        session_id: sessionId,
        selected_themes: form.selectedThemes,
      },
      responses
    );

    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onComplete();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current={step} total={STEPS.length} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-[#86868B] uppercase">
            Étape {step + 1} — {STEPS[step]}
          </p>
          <h2 className="mt-1 text-[22px] font-light text-[#1D1D1F]">
            {step === 0 && 'Quels domaines souhaitez-vous explorer ?'}
            {step === 1 && 'Quelles difficultés ressentez-vous ?'}
            {step === 2 && 'Évaluez l\'intensité de chaque difficulté'}
          </h2>
        </div>
        {Object.keys(previousScores).length > 0 && step === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded-full bg-[#A8C5B8]/20 px-3 py-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#5A8A72]" />
            <span className="text-[11px] font-medium text-[#5A8A72]">
              Pré-rempli depuis la séance précédente (par date)
            </span>
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {QUESTIONNAIRE_THEMES.map((theme) => (
              <ThemeChip
                key={theme.id}
                emoji={theme.emoji}
                title={theme.title}
                selected={form.selectedThemes.includes(theme.id)}
                onToggle={() => toggleTheme(theme.id)}
              />
            ))}
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {activeThemes.map((theme) => (
              <div key={theme.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">{theme.emoji}</span>
                  <h3 className="text-[15px] font-medium text-[#1D1D1F]">{theme.title}</h3>
                </div>
                {theme.description && (
                  <p className="mb-3 text-[12px] text-[#86868B] italic">{theme.description}</p>
                )}
                <div className="space-y-1 rounded-2xl border border-black/[0.04] bg-white/40 p-2">
                  {theme.difficulties.map((d) => (
                    <DifficultyCheckbox
                      key={d.id}
                      label={d.label}
                      checked={!!form.selectedDifficulties[d.id]}
                      onToggle={() => toggleDifficulty(d.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#E8F4FA]/60 to-[#F0EBF5]/60 p-4">
              <p className="text-[13px] text-[#86868B]">
                <strong className="font-medium text-[#1D1D1F]">Échelle :</strong>{' '}
                {SCORE_LABELS.filter((s) => s.min > 0)
                  .map((s) => `${s.min}-${s.max} : ${s.label}`)
                  .join(' · ')}
              </p>
            </div>

            {selectedDifficultyIds.map((difficultyId) => {
              const theme = QUESTIONNAIRE_THEMES.find((t) =>
                t.difficulties.some((d) => d.id === difficultyId)
              );
              const diff = theme?.difficulties.find((d) => d.id === difficultyId);
              if (!diff) return null;
              return (
                <ScoreSlider
                  key={difficultyId}
                  label={diff.label}
                  value={form.scores[difficultyId] ?? 5}
                  onChange={(v) => setScore(difficultyId, v)}
                  previousValue={previousScores[difficultyId]}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
            Continuer
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} loading={saving}>
            <Check className="h-4 w-4" />
            Enregistrer l&apos;évaluation
          </Button>
        )}
      </div>
    </div>
  );
}
