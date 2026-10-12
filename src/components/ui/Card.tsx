import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-card',
        padded && 'p-5 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-gold-700">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'navy' | 'gold' | 'success' | 'muted';
}) {
  const tones = {
    navy: 'bg-navy-50 text-navy',
    gold: 'bg-gold-50 text-gold-700',
    success: 'bg-success-50 text-success',
    muted: 'bg-surface-muted text-ink-muted',
  };
  return (
    <Card className="flex items-start gap-4">
      {Icon && (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[13px] text-ink-muted">{label}</p>
        <p className="tabular mt-0.5 text-[24px] font-semibold tracking-tight text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-[12px] text-ink-muted">{hint}</p>}
      </div>
    </Card>
  );
}
