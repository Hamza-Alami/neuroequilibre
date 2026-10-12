'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-navy text-white shadow-[0_1px_2px_rgba(21,35,58,0.2)] hover:bg-navy-600 active:bg-navy-700 disabled:bg-navy/40',
  accent:
    'bg-gold text-white shadow-[0_1px_2px_rgba(169,123,44,0.3)] hover:bg-gold-700 disabled:bg-gold/40',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-ink-muted/40 hover:bg-surface-muted disabled:text-ink-muted',
  ghost: 'text-ink-soft hover:bg-navy-50 hover:text-ink disabled:text-ink-muted',
  subtle: 'bg-navy-50 text-navy hover:bg-navy-100 disabled:text-ink-muted',
  danger:
    'bg-danger text-white shadow-[0_1px_2px_rgba(180,35,24,0.25)] hover:bg-[#9a1d14] disabled:bg-danger/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-[10px] px-4 text-[14px]',
  lg: 'h-12 gap-2 rounded-xl px-6 text-[15px]',
};

interface ButtonProps {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ className?: string }>;
  iconRight?: ComponentType<{ className?: string }>;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  fullWidth?: boolean;
  form?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  type = 'button',
  href,
  onClick,
  className,
  title,
  fullWidth,
  form,
}: ButtonProps) {
  const classes = cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    !children && (size === 'sm' ? 'w-8 px-0' : size === 'md' ? 'w-10 px-0' : 'w-12 px-0'),
    fullWidth && 'w-full',
    className
  );
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const content = (
    <>
      {loading ? <Loader2 className={cn(iconClass, 'animate-spin')} /> : Icon && <Icon className={iconClass} />}
      {children}
      {IconRight && !loading && <IconRight className={iconClass} />}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={title}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
      title={title}
      aria-label={!children ? title : undefined}
      form={form}
    >
      {content}
    </button>
  );
}
