import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-ink-muted', className)} />;
}

export function PageLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[13px] text-ink-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line/70', className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const alertTones = {
  error: { cls: 'border-danger/20 bg-danger-50 text-danger', Icon: AlertCircle },
  warning: { cls: 'border-warning/20 bg-warning-50 text-warning', Icon: AlertTriangle },
  success: { cls: 'border-success/20 bg-success-50 text-success', Icon: CheckCircle2 },
  info: { cls: 'border-info/20 bg-info-50 text-info', Icon: Info },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3', cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink-soft')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
