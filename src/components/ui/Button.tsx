'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  className,
  disabled,
  type = 'button',
  onClick,
}: ButtonProps) {
  const variants = {
    primary:
      'btn-shimmer bg-gradient-to-r from-[#3d8aad] via-[#5ba4c9] to-[#4a96b8] text-white shadow-[0_4px_20px_-4px_rgba(91,164,201,0.5)] hover:shadow-[0_6px_28px_-4px_rgba(91,164,201,0.6)] hover:brightness-105',
    glow:
      'btn-shimmer bg-gradient-to-r from-[#5ba4c9] to-[#7eb09a] text-white shadow-[0_4px_24px_-4px_rgba(126,176,154,0.45)] hover:shadow-[0_8px_32px_-4px_rgba(126,176,154,0.55)]',
    secondary:
      'glass text-[#1a1d26] hover:bg-white/80 shadow-[0_2px_12px_-4px_rgba(26,29,38,0.08)]',
    ghost: 'text-[#6b7280] hover:text-[#1a1d26] hover:bg-white/40',
    outline:
      'border border-[#5ba4c9]/25 bg-white/30 text-[#1a1d26] hover:bg-white/60 hover:border-[#5ba4c9]/40 backdrop-blur-sm',
  };

  const sizes = {
    sm: 'px-4 py-2 text-[13px] rounded-full',
    md: 'px-6 py-3 text-[14px] rounded-full',
    lg: 'px-8 py-4 text-[15px] rounded-full',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={{ scale: disabled || loading ? 1 : 1.02, y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
    >
      {loading && (
        <motion.span
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {children}
    </motion.button>
  );
}
