'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Sparkles, FileDown, X } from 'lucide-react';
import { DifficultyLineChart } from '@/components/client/DifficultyLineChart';
import { Button } from '@/components/ui/Button';
import { localDb } from '@/lib/data/local-store';
import { exportEvolutionPdf } from '@/lib/pdf/export-evolution-pdf';
import { isNewDifficulty, isNewTheme } from '@/lib/evolution';
import { cn, formatDate } from '@/lib/utils';
import type { Client } from '@/lib/types';

interface EvolutionChartProps {
  clientId: string;
  client?: Client;
}

export function EvolutionChart({ clientId, client }: EvolutionChartProps) {
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const evolution = useMemo(() => localDb.getClientEvolution(clientId), [clientId]);
  const sessions = useMemo(
    () => localDb.getSessionsChronological(clientId),
    [clientId]
  );

  const { baselineSessionNumber, maxSessionNumber } = evolution;

  const selectedEvolution = evolution.difficulties.find(
    (d) => d.difficultyId === selectedDifficultyId
  );

  const handleExportPdf = async () => {
    if (!client) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 300));
    exportEvolutionPdf(client, evolution, sessions);
    setExporting(false);
  };

  if (evolution.difficulties.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/[0.08] bg-white/40 p-12 text-center">
        <p className="text-[15px] text-[#86868B]">
          Les données d&apos;évolution apparaîtront après la première évaluation.
        </p>
      </div>
    );
  }

  const newThemes = evolution.themes.filter((t) =>
    isNewTheme(t, baselineSessionNumber)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-2xl border border-[#7EB8DA]/20 bg-[#E8F4FA]/30 px-4 py-3">
          <p className="text-[13px] text-[#1D1D1F]">
            <span className="font-medium">Référence baseline :</span> Séance n°{baselineSessionNumber}
            <span className="mx-2 text-[#C7C7CC]">·</span>
            {evolution.totalSessions} séance{evolution.totalSessions > 1 ? 's' : ''} au total
          </p>
        </div>
        {client && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            loading={exporting}
            className="shrink-0"
          >
            <FileDown className="h-4 w-4" />
            Exporter le rapport PDF
          </Button>
        )}
      </div>

      {newThemes.length > 0 && (
        <div className="rounded-2xl border border-[#C4B5D8]/25 bg-[#F0EBF5]/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7B6B9A]" />
            <p className="text-[13px] font-medium text-[#1D1D1F]">
              Thèmes ajoutés après la séance de référence
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {newThemes.map((theme) => (
              <span
                key={theme.themeId}
                className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] text-[#1D1D1F]"
              >
                {theme.emoji} {theme.title}
                <span className="ml-1.5 text-[#86868B]">
                  · séance n°{theme.firstSessionNumber} ({formatDate(theme.firstSessionDate)})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-black/[0.04] bg-white/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-black/[0.04] bg-[#F7F8FA]/80">
                <th className="px-5 py-4 text-left text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  Difficulté
                </th>
                <th className="px-3 py-4 text-center text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  S{baselineSessionNumber}
                  <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-[#7EB8DA]">
                    baseline
                  </span>
                </th>
                <th className="px-3 py-4 text-center text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  S10
                </th>
                <th className="px-3 py-4 text-center text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  S20
                </th>
                <th className="px-3 py-4 text-center text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  Dernière
                </th>
                <th className="px-3 py-4 text-center text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  Δ
                </th>
                <th className="px-4 py-4 text-right text-[10px] font-semibold tracking-widest text-[#86868B] uppercase">
                  Historique
                </th>
              </tr>
            </thead>
            <tbody>
              {evolution.difficulties.map((item, i) => {
                const isSelected = selectedDifficultyId === item.difficultyId;
                const isNew = isNewDifficulty(item, baselineSessionNumber);

                return (
                  <motion.tr
                    key={item.difficultyId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      'border-b border-black/[0.02] transition-colors last:border-0',
                      isSelected && 'bg-[#E8F4FA]/40'
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2">
                        <span className="text-[13px] font-medium text-[#1D1D1F]">{item.label}</span>
                        {isNew && (
                          <span className="shrink-0 rounded-full bg-[#C4B5D8]/20 px-2 py-0.5 text-[10px] font-medium text-[#7B6B9A]">
                            +S{item.firstSessionNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#86868B]">
                        {item.themeEmoji} {item.history.length} mesure{item.history.length > 1 ? 's' : ''}
                      </p>
                    </td>
                    <ScoreCell
                      value={item.debut}
                      placeholder={
                        !item.measuredAtBaseline && isNew
                          ? `S${item.firstSessionNumber}`
                          : undefined
                      }
                      isBaseline
                    />
                    <ScoreCell value={item.seance10} />
                    <ScoreCell value={item.seance20} />
                    <ScoreCell value={item.latest} highlight />
                    <td className="px-3 py-4 text-center">
                      <EvolutionBadge improvement={item.improvement} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDifficultyId(
                            isSelected ? null : item.difficultyId
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all',
                          isSelected
                            ? 'bg-[#1D1D1F] text-white shadow-sm'
                            : 'bg-[#E8F4FA]/60 text-[#4A7A94] hover:bg-[#7EB8DA]/25 hover:text-[#1D1D1F]'
                        )}
                      >
                        {isSelected ? (
                          <>
                            <X className="h-3.5 w-3.5" />
                            Fermer
                          </>
                        ) : (
                          <>
                            <LineChart className="h-3.5 w-3.5" />
                            Voir l&apos;historique
                          </>
                        )}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedEvolution && (
          <DifficultyLineChart
            key={selectedEvolution.difficultyId}
            evolution={selectedEvolution}
            baselineSessionNumber={baselineSessionNumber}
            maxSessionNumber={maxSessionNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreCell({
  value,
  highlight,
  placeholder,
  isBaseline,
}: {
  value?: number;
  highlight?: boolean;
  placeholder?: string;
  isBaseline?: boolean;
}) {
  if (value === undefined) {
    return (
      <td className="px-3 py-4 text-center">
        {placeholder ? (
          <span className="text-[11px] text-[#C4B5D8]">{placeholder}</span>
        ) : (
          <span className="text-[13px] text-[#C7C7CC]">—</span>
        )}
      </td>
    );
  }

  const intensity = value / 10;
  const bg = highlight
    ? `rgba(126, 184, 218, ${0.15 + (1 - intensity) * 0.25})`
    : isBaseline
      ? `rgba(126, 184, 218, ${0.12 + (1 - intensity) * 0.2})`
      : `rgba(0, 0, 0, ${0.02 + intensity * 0.04})`;

  return (
    <td className="px-3 py-4 text-center">
      <span
        className={cn(
          'inline-block min-w-[44px] rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[#1D1D1F]',
          isBaseline && 'ring-1 ring-[#7EB8DA]/30'
        )}
        style={{ backgroundColor: bg }}
      >
        {value}/10
      </span>
    </td>
  );
}

function EvolutionBadge({ improvement }: { improvement: number }) {
  if (improvement > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#A8C5B8]/25 px-2.5 py-1 text-[11px] font-semibold text-[#5A8A72]">
        ↓ {improvement}
      </span>
    );
  }
  if (improvement < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8A87C]/25 px-2.5 py-1 text-[11px] font-semibold text-[#B8734A]">
        ↑ {Math.abs(improvement)}
      </span>
    );
  }
  return <span className="text-[11px] text-[#C7C7CC]">—</span>;
}
