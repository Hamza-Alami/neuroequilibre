'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/layout/Logo';

const NODES = [
  { cx: 200, cy: 95, r: 7 },
  { cx: 155, cy: 140, r: 5.5 },
  { cx: 245, cy: 140, r: 5.5 },
  { cx: 120, cy: 185, r: 5 },
  { cx: 170, cy: 200, r: 6 },
  { cx: 230, cy: 200, r: 6 },
  { cx: 280, cy: 185, r: 5 },
  { cx: 145, cy: 250, r: 5 },
  { cx: 200, cy: 265, r: 6.5 },
  { cx: 255, cy: 250, r: 5 },
  { cx: 175, cy: 310, r: 4.5 },
  { cx: 225, cy: 310, r: 4.5 },
  { cx: 200, cy: 355, r: 5 },
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6],
  [4, 7], [4, 8], [5, 8], [5, 9], [6, 9],
  [7, 10], [8, 10], [8, 11], [9, 11], [10, 12], [11, 12], [8, 9],
];

const BRAIN_PATH =
  'M200 55 C155 55 120 85 115 130 C108 155 95 175 100 210 C102 240 120 270 145 295 C165 315 185 330 200 335 C215 330 235 315 255 295 C280 270 298 240 300 210 C305 175 292 155 285 130 C280 85 245 55 200 55 Z';

export function NeuralBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Floating orbs */}
      <div className="animate-float-orb absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#8ecae6]/20 blur-3xl" />
      <div
        className="animate-float-orb absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#b8a9d4]/15 blur-3xl"
        style={{ animationDelay: '-4s' }}
      />
      <div
        className="animate-float-orb absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7eb09a]/12 blur-3xl"
        style={{ animationDelay: '-8s' }}
      />

      {/* Neural network SVG — right */}
      <svg
        viewBox="0 0 400 400"
        className="absolute -right-16 top-0 h-[85vh] w-auto opacity-[0.35]"
        aria-hidden
      >
        <defs>
          <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5ba4c9" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#7eb09a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#b8a9d4" stopOpacity="0.4" />
          </linearGradient>
          <filter id="neuralGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.path
          d={BRAIN_PATH}
          fill="none"
          stroke="url(#neuralGrad)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.25 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        />

        {CONNECTIONS.map(([a, b], i) => (
          <motion.line
            key={`syn-${i}`}
            x1={NODES[a].cx}
            y1={NODES[a].cy}
            x2={NODES[b].cx}
            y2={NODES[b].cy}
            stroke="url(#neuralGrad)"
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.2, 0.55, 0.2] }}
            transition={{
              pathLength: { duration: 2, delay: i * 0.08 },
              opacity: { duration: 3 + i * 0.2, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        ))}

        {NODES.map((node, i) => (
          <motion.circle
            key={`n-${i}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="url(#neuralGrad)"
            filter="url(#neuralGlow)"
            initial={{ scale: 0 }}
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.35, 0.85, 0.35],
            }}
            transition={{
              scale: { duration: 2.5 + i * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 },
              opacity: { duration: 2.5 + i * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 },
            }}
          />
        ))}
      </svg>

      {/* Left subtle network */}
      <svg
        viewBox="0 0 200 300"
        className="absolute -left-10 bottom-20 h-64 w-48 opacity-[0.12]"
        aria-hidden
      >
        {[...Array(6)].map((_, i) => (
          <motion.circle
            key={i}
            cx={40 + i * 25}
            cy={80 + (i % 3) * 60}
            r={3}
            fill="#5ba4c9"
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#eef2f7]/30 to-[#eef2f7]" />
    </div>
  );
}

export function PulseOrb({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-[#c5944e]/25 to-[#a5b4c4]/20 blur-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl glass-strong p-4"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Logo size="xl" />
      </motion.div>
    </div>
  );
}

interface BrainLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function BrainLogo({ size = 36, className = '', animate = true }: BrainLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5ba4c9" />
          <stop offset="50%" stopColor="#7eb09a" />
          <stop offset="100%" stopColor="#b8a9d4" />
        </linearGradient>
      </defs>
      <motion.path
        d="M24 6 C14 6 8 14 8 22 C6 26 6 30 8 34 C9 38 12 40 16 41 C18 44 21 46 24 46 C27 46 30 44 32 41 C36 40 39 38 40 34 C42 30 42 26 40 22 C40 14 34 6 24 6 Z"
        stroke="url(#brainGrad)"
        strokeWidth="1.5"
        fill="url(#brainGrad)"
        fillOpacity="0.12"
        initial={animate ? { pathLength: 0 } : false}
        animate={animate ? { pathLength: 1 } : false}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      {[
        [24, 18], [18, 24], [30, 24], [20, 32], [28, 32], [24, 28],
      ].map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={1.8}
          fill="url(#brainGrad)"
          initial={animate ? { scale: 0 } : false}
          animate={
            animate
              ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }
              : { scale: 1, opacity: 0.8 }
          }
          transition={{
            scale: { duration: 2, repeat: Infinity, delay: i * 0.25 },
            opacity: { duration: 2, repeat: Infinity, delay: i * 0.25 },
          }}
        />
      ))}
      <motion.line
        x1={18} y1={24} x2={30} y2={24}
        stroke="url(#brainGrad)" strokeWidth="0.8" strokeOpacity="0.5"
        animate={animate ? { opacity: [0.3, 0.7, 0.3] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.line
        x1={24} y1={18} x2={24} y2={32}
        stroke="url(#brainGrad)" strokeWidth="0.8" strokeOpacity="0.5"
        animate={animate ? { opacity: [0.3, 0.7, 0.3] } : {}}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />
    </svg>
  );
}
