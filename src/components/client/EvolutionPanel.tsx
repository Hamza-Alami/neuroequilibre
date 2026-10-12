'use client';

import { ChevronDown, FileDown, LineChart, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { isNewDifficulty, isNewTheme } from '@/lib/evolution';
import { exportEvolutionPdf } from '@/lib/pdf/export-evolution-pdf';
import { scoreTone } from '@/lib/questionnaire/scale';
import { formatDate } from '@/lib/time';
import type { Client, ClientEvolutionData, Session } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DifficultyLineChart } from './DifficultyLineChart';

function ScoreCell({ value, placeholder }: { value?: number; placeholder?: string }) {
  if (value === undefined) {
    return <span className="text-[12px] text-ink-muted/60">{placeholder ?? '—'}</span>;
  }
  const tone = scoreTone(value);
  return (
    <span className="tabular inline-block min-w-[42px] rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ color: tone.fg, background: tone.bg }}>
      {value}/10
    </span>
  );
}

function Delta({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success">
        <TrendingDown className="h-3.5 w-3.5" /> −{value}
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger">
        <TrendingUp className="h-3.5 w-3.5" /> +{Math.abs(value)}
      </span>
    );
  return <span className="text-[12px] text-ink-muted">Stable</span>;
}

export function EvolutionPanel({
  client,
  evolution,
  sessions,
}: {
  client: Client;
  evolution: ClientEvolutionData;
  sessions: Session[];
}) {
  const { settings } = useApp();
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { baselineSessionNumber, maxSessionNumber } = evolution;

  if (!evolution.difficulties.length) {
    return (
      <Card>
        <EmptyState
          icon={LineChart}
          title="Pas encore d’évaluation"
          description="L’évolution apparaîtra après la première évaluation. La première séance évaluée sert de référence."
        />
      </Card>
    );
  }

  const improved = evolution.difficulties.filter((d) => d.improvement > 0).length;
  const newThemes = evolution.themes.filter((t) => isNewTheme(t, baselineSessionNumber));

  async function exportPdf() {
    setExporting(true);
    try {
      await exportEvolutionPdf(client, evolution, sessions, settings.centre_name);
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-soft">
          Référence : <span className="font-medium text-ink">séance n°{baselineSessionNumber}</span> ·{' '}
          {evolution.totalSessions} séance{evolution.totalSessions > 1 ? 's' : ''} ·{' '}
          <span className="text-success">{improved}</span> / {evolution.difficulties.length} difficultés en amélioration
        </p>
        <Button variant="secondary" size="sm" icon={FileDown} onClick={exportPdf} loading={exporting}>
          Rapport PDF
        </Button>
      </div>

      {newThemes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-info/15 bg-info-50 px-4 py-3">
          <Sparkles className="h-4 w-4 text-info" />
          <span className="text-[13px] font-medium text-ink">Thèmes ajoutés en cours de suivi :</span>
          {newThemes.map((t) => (
            <span key={t.themeId} className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] text-ink-soft ring-1 ring-line">
              {t.emoji} {t.title} · S{t.firstSessionNumber} ({formatDate(t.firstSessionDate)})
            </span>
          ))}
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">Difficulté</th>
                <th className="px-3 py-3 text-center">
                  S{baselineSessionNumber} <span className="font-normal normal-case text-gold-700">réf.</span>
                </th>
                <th className="px-3 py-3 text-center">S10</th>
                <th className="px-3 py-3 text-center">S20</th>
                <th className="px-3 py-3 text-center">Dernière</th>
                <th className="px-3 py-3 text-center">Évolution</th>
                <th className="px-5 py-3 text-right">Historique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {evolution.difficulties.map((d) => {
                const open = openId === d.difficultyId;
                const isNew = isNewDifficulty(d, baselineSessionNumber);
                return (
                  <Fragment key={d.difficultyId}>
                    <tr className={cn('transition-colors', open ? 'bg-navy-50/50' : 'hover:bg-surface-muted/60')}>
                      <td className="px-5 py-3">
                        <p className="text-[13px] font-medium text-ink">
                          {d.label}
                          {isNew && (
                            <span className="ml-2 rounded-full bg-info-50 px-1.5 py-0.5 text-[10px] font-semibold text-info">
                              +S{d.firstSessionNumber}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {d.themeEmoji} {d.themeTitle} · {d.history.length} mesure{d.history.length > 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreCell value={d.debut} placeholder={isNew ? `dès S${d.firstSessionNumber}` : undefined} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreCell value={d.seance10} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreCell value={d.seance20} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreCell value={d.latest} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Delta value={d.improvement} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : d.difficultyId)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                            open ? 'bg-navy text-white' : 'text-navy hover:bg-navy-50'
                          )}
                        >
                          <LineChart className="h-3.5 w-3.5" />
                          {open ? 'Masquer' : 'Courbe'}
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="px-5 py-4">
                          <DifficultyLineChart
                            evolution={d}
                            baselineSessionNumber={baselineSessionNumber}
                            maxSessionNumber={maxSessionNumber}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
