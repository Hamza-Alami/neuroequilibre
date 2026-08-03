'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/layout/Logo';

interface NeuralLoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export function NeuralLoader({ label = 'Chargement...', fullScreen }: NeuralLoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-[#c5944e]/25"
          style={{ margin: -12 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-[#a5b4c4]/25"
          style={{ margin: -12 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.35, 0, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.35 }}
        />
        <motion.div
          className="glass-strong overflow-hidden rounded-2xl px-4 py-3"
          animate={{ opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Logo size="lg" priority />
        </motion.div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <motion.p
          className="text-[13px] font-medium tracking-wide text-[#6b7280]"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          {label}
        </motion.p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#c5944e]"
              animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="mesh-bg fixed inset-0 z-[100] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-20">{content}</div>;
}
