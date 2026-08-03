'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  delay?: number;
}

export function Card({ children, className, hover, onClick, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        hover
          ? {
              y: -4,
              transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
            }
          : undefined
      }
      onClick={onClick}
      className={cn(
        'glass rounded-3xl p-6 transition-shadow duration-300',
        hover && 'cursor-pointer hover:shadow-[0_12px_40px_-12px_rgba(91,164,201,0.18)]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <h1 className="bg-gradient-to-br from-[#1a1d26] to-[#4a5568] bg-clip-text text-[32px] font-light tracking-tight text-transparent md:text-[42px]">
        {title}
      </h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-3 max-w-xl text-[16px] font-light leading-relaxed text-[#6b7280]"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
