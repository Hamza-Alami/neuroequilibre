'use client';

import { motion } from 'framer-motion';
import { formatDate } from '@/lib/utils';
import type { DifficultyEvolution } from '@/lib/types';

interface DifficultyLineChartProps {
  evolution: DifficultyEvolution;
  baselineSessionNumber?: number;
  maxSessionNumber?: number;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 240;
const PADDING = { top: 28, right: 28, bottom: 44, left: 40 };

export function DifficultyLineChart({
  evolution,
  baselineSessionNumber = 1,
  maxSessionNumber,
}: DifficultyLineChartProps) {
  const { history } = evolution;
  if (history.length === 0) return null;

  const chartMaxSession = maxSessionNumber ?? Math.max(...history.map((h) => h.sessionNumber), baselineSessionNumber);
  const minSession = baselineSessionNumber;
  const sessionRange = Math.max(chartMaxSession - minSession, 1);

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const toX = (sessionNumber: number) =>
    PADDING.left + ((sessionNumber - minSession) / sessionRange) * innerW;

  const toY = (score: number) => PADDING.top + innerH - (score / 10) * innerH;

  const points = history.map((h) => ({
    x: toX(h.sessionNumber),
    y: toY(h.score),
    ...h,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${PADDING.top + innerH} L ${points[0].x} ${PADDING.top + innerH} Z`
      : '';

  const isNew = evolution.firstSessionNumber > baselineSessionNumber;
  const baselineScore = evolution.debut;
  const gradId = `lineGrad-${evolution.difficultyId}`;
  const areaGradId = `areaGrad-${evolution.difficultyId}`;

  const sessionTicks: number[] = [];
  for (let s = minSession; s <= chartMaxSession; s++) {
    sessionTicks.push(s);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rounded-2xl border border-[#7EB8DA]/25 bg-gradient-to-br from-[#E8F4FA]/50 via-white/90 to-[#F0F5F2]/50 p-6 shadow-[0_4px_32px_-8px_rgba(126,184,218,0.2)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[16px] font-medium text-[#1D1D1F]">{evolution.label}</p>
            <p className="mt-0.5 text-[13px] text-[#86868B]">
              {evolution.themeEmoji} {evolution.themeTitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {evolution.measuredAtBaseline && baselineScore !== undefined && (
              <span className="rounded-full bg-[#7EB8DA]/20 px-3 py-1 text-[11px] font-medium text-[#4A7A94]">
                Référence S{baselineSessionNumber} : {baselineScore}/10
              </span>
            )}
            {isNew && (
              <span className="rounded-full bg-[#C4B5D8]/25 px-3 py-1 text-[11px] font-medium text-[#7B6B9A]">
                Ajouté séance n°{evolution.firstSessionNumber}
              </span>
            )}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          aria-label={`Évolution de ${evolution.label}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7EB8DA" />
              <stop offset="100%" stopColor="#A8C5B8" />
            </linearGradient>
            <linearGradient id={areaGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7EB8DA" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7EB8DA" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 2, 4, 6, 8, 10].map((tick) => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={CHART_WIDTH - PADDING.right}
                  y2={y}
                  stroke="rgba(0,0,0,0.05)"
                  strokeDasharray={tick === 0 || tick === 10 ? '0' : '3 3'}
                />
                <text x={PADDING.left - 10} y={y + 4} textAnchor="end" className="fill-[#C7C7CC] text-[10px]">
                  {tick}
                </text>
              </g>
            );
          })}

          {sessionTicks.map((s) => {
            const x = toX(s);
            const isBaselineTick = s === baselineSessionNumber;
            return (
              <line
                key={`tick-${s}`}
                x1={x}
                y1={PADDING.top}
                x2={x}
                y2={PADDING.top + innerH}
                stroke={isBaselineTick ? 'rgba(126,184,218,0.25)' : 'rgba(0,0,0,0.03)'}
                strokeWidth={isBaselineTick ? 1.5 : 1}
              />
            );
          })}

          {areaPath && (
            <motion.path
              d={areaPath}
              fill={`url(#${areaGradId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          )}

          {linePath && (
            <motion.path
              d={linePath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          )}

          {points.map((p, i) => (
            <g key={p.sessionId}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={p.isBaseline ? 7 : p.isFirstAppearance ? 6 : 5}
                fill="white"
                stroke={p.isBaseline ? '#7EB8DA' : p.isFirstAppearance ? '#C4B5D8' : '#A8C5B8'}
                strokeWidth="2.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 + i * 0.07, type: 'spring', stiffness: 320 }}
              />
              <text
                x={toX(p.sessionNumber)}
                y={CHART_HEIGHT - 14}
                textAnchor="middle"
                className={`text-[10px] ${p.isBaseline ? 'fill-[#7EB8DA] font-semibold' : 'fill-[#86868B]'}`}
              >
                S{p.sessionNumber}
                {p.isBaseline ? ' ★' : ''}
              </text>
              <text
                x={p.x}
                y={p.y - 14}
                textAnchor="middle"
                className="fill-[#1D1D1F] text-[11px] font-semibold"
              >
                {p.score}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-4 grid gap-2 border-t border-black/[0.04] pt-4 sm:grid-cols-2">
          {history.map((h) => (
            <div
              key={h.sessionId}
              className={`rounded-xl px-3 py-2 text-[11px] ${
                h.isBaseline
                  ? 'bg-[#E8F4FA]/80 ring-1 ring-[#7EB8DA]/30'
                  : 'bg-white/60'
              }`}
            >
              <span className="font-semibold text-[#1D1D1F]">
                Séance {h.sessionNumber}
                {h.isBaseline && (
                  <span className="ml-1.5 text-[#7EB8DA]">· Référence</span>
                )}
              </span>
              <span className="text-[#86868B]"> · {formatDate(h.sessionDate)}</span>
              <span className="ml-1 font-semibold text-[#1D1D1F]">{h.score}/10</span>
              {h.isFirstAppearance && !h.isBaseline && (
                <span className="ml-1 text-[#C4B5D8]">· Première mesure</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
