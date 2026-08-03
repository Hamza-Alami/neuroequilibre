'use client';

import { motion } from 'framer-motion';
import { getScoreLabel } from '@/lib/questionnaire/themes';
import { cn } from '@/lib/utils';

interface ScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  previousValue?: number;
}

function getScoreColor(score: number): string {
  if (score === 0) return '#9ca3af';
  if (score <= 2) return '#7eb09a';
  if (score <= 4) return '#5ba4c9';
  if (score <= 6) return '#b8a9d4';
  if (score <= 8) return '#e8a87c';
  return '#d4847c';
}

export function ScoreSlider({ value, onChange, label, previousValue }: ScoreSliderProps) {
  const color = getScoreColor(value);
  const scoreLabel = getScoreLabel(value);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group glass rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_4px_20px_-6px_rgba(91,164,201,0.15)]"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-[14px] font-medium leading-snug text-[#1D1D1F]">{label}</p>
        <div className="flex shrink-0 flex-col items-end">
          <motion.span
            key={value}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-[24px] font-light tabular-nums"
            style={{ color }}
          >
            {value}
            <span className="text-[14px] text-[#86868B]">/10</span>
          </motion.span>
          {previousValue !== undefined && previousValue !== value && (
            <span className="text-[11px] text-[#86868B]">
              Précédent : {previousValue}/10
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="score-slider w-full cursor-pointer appearance-none bg-transparent"
          style={{ '--thumb-color': color } as React.CSSProperties}
        />
        <div className="mt-1 flex justify-between px-0.5">
          {[0, 2, 4, 6, 8, 10].map((n) => (
            <span key={n} className="text-[10px] text-[#C7C7CC]">
              {n}
            </span>
          ))}
        </div>
      </div>

      <motion.p
        key={scoreLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-2 text-[12px] font-medium"
        style={{ color }}
      >
        {scoreLabel}
      </motion.p>
    </motion.div>
  );
}

interface ThemeChipProps {
  emoji: string;
  title: string;
  selected: boolean;
  onToggle: () => void;
}

export function ThemeChip({ emoji, title, selected, onToggle }: ThemeChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-300',
        selected
          ? 'border-[#5ba4c9]/35 bg-gradient-to-br from-[#8ecae6]/25 to-[#7eb09a]/15 shadow-[0_4px_20px_-6px_rgba(91,164,201,0.2)] ring-1 ring-[#5ba4c9]/20'
          : 'glass hover:border-[#5ba4c9]/20 hover:shadow-sm'
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <p className="text-[14px] font-medium leading-snug text-[#1D1D1F]">{title}</p>
      </div>
      <motion.div
        className={cn(
          'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-[#7EB8DA] bg-[#7EB8DA]' : 'border-[#D1D1D6]'
        )}
        animate={selected ? { scale: [1, 1.15, 1] } : {}}
      >
        {selected && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        )}
      </motion.div>
    </motion.button>
  );
}

interface DifficultyCheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function DifficultyCheckbox({ label, checked, onToggle }: DifficultyCheckboxProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
        checked ? 'bg-[#7EB8DA]/10' : 'hover:bg-black/[0.02]'
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
          checked ? 'border-[#7EB8DA] bg-[#7EB8DA]' : 'border-[#D1D1D6]'
        )}
      >
        {checked && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-[14px] text-[#1D1D1F]">{label}</span>
    </motion.button>
  );
}

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="h-1 flex-1 rounded-full overflow-hidden bg-black/[0.06]"
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#7EB8DA] to-[#A8C5B8]"
            initial={{ width: '0%' }}
            animate={{ width: i < current ? '100%' : i === current ? '50%' : '0%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>
      ))}
    </div>
  );
}
