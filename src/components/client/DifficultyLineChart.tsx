'use client';

import { getScoreLabel } from '@/lib/questionnaire/scale';
import { formatDate } from '@/lib/time';
import type { DifficultyEvolution } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

const W = 640;
const H = 240;
const P = { top: 24, right: 24, bottom: 36, left: 36 };

export function DifficultyLineChart({
  evolution,
  baselineSessionNumber,
  maxSessionNumber,
}: {
  evolution: DifficultyEvolution;
  baselineSessionNumber: number;
  maxSessionNumber: number;
}) {
  const { history } = evolution;
  if (!history.length) return null;

  const min = baselineSessionNumber;
  const max = Math.max(maxSessionNumber, ...history.map((h) => h.sessionNumber));
  const range = Math.max(max - min, 1);
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;
  const toX = (n: number) => P.left + ((n - min) / range) * innerW;
  const toY = (s: number) => P.top + innerH - (s / 10) * innerH;
  const pts = history.map((h) => ({ ...h, x: toX(h.sessionNumber), y: toY(h.score) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x},${P.top + innerH} L${pts[0].x},${P.top + innerH} Z`;
  const ticks = range <= 24 ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : pts.map((p) => p.sessionNumber);
  const gradId = `area-${evolution.difficultyId}`;

  return (
    <div className="animate-in rounded-xl border border-line bg-surface-muted/50 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">{evolution.label}</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {evolution.themeEmoji} {evolution.themeTitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {evolution.debut !== undefined && (
            <Badge tone="gold">
              Référence S{baselineSessionNumber} : {evolution.debut}/10
            </Badge>
          )}
          {evolution.firstSessionNumber > baselineSessionNumber && (
            <Badge tone="info">Ajoutée en séance n°{evolution.firstSessionNumber}</Badge>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Évolution : ${evolution.label}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--navy)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--navy)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t}>
            <line x1={P.left} x2={W - P.right} y1={toY(t)} y2={toY(t)} stroke="var(--line)" strokeDasharray={t % 10 ? '3 4' : undefined} />
            <text x={P.left - 10} y={toY(t) + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">
              {t}
            </text>
          </g>
        ))}
        {ticks.map((n) => (
          <text
            key={n}
            x={toX(n)}
            y={H - 12}
            textAnchor="middle"
            fontSize="10"
            fill={n === baselineSessionNumber ? 'var(--gold-700)' : 'var(--ink-muted)'}
            fontWeight={n === baselineSessionNumber ? 600 : 400}
          >
            S{n}
          </text>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="var(--navy)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <g key={p.sessionId}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isBaseline ? 6 : 4.5}
              fill="white"
              stroke={p.isBaseline ? 'var(--gold)' : 'var(--navy)'}
              strokeWidth="2.25"
            >
              <title>
                Séance {p.sessionNumber} · {formatDate(p.sessionDate)} · {p.score}/10 ({getScoreLabel(p.score)})
              </title>
            </circle>
            <text x={p.x} y={p.y - 11} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
              {p.score}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 grid gap-1.5 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {history.map((h) => (
          <div key={h.sessionId} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[12px] ring-1 ring-line">
            <span className="text-ink-soft">
              <span className="font-semibold text-ink">S{h.sessionNumber}</span> · {formatDate(h.sessionDate)}
              {h.isBaseline && <span className="ml-1 text-gold-700">· réf.</span>}
              {h.isFirstAppearance && !h.isBaseline && <span className="ml-1 text-info">· 1re mesure</span>}
            </span>
            <span className="tabular font-semibold text-ink">{h.score}/10</span>
          </div>
        ))}
      </div>
    </div>
  );
}
