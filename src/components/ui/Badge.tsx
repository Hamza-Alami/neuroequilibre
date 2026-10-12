import type { ReactNode } from 'react';
import { STATUS_LABELS } from '@/lib/status';
import type { DisplayStatus, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'navy' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-soft ring-line',
  navy: 'bg-navy-50 text-navy ring-navy-100',
  gold: 'bg-gold-50 text-gold-700 ring-gold-100',
  success: 'bg-success-50 text-success ring-success/15',
  warning: 'bg-warning-50 text-warning ring-warning/15',
  danger: 'bg-danger-50 text-danger ring-danger/15',
  info: 'bg-info-50 text-info ring-info/15',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset',
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const statusTone: Record<DisplayStatus, Tone> = {
  upcoming: 'info',
  past: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === 'admin' ? <Badge tone="gold">Administrateur</Badge> : <Badge tone="navy">Gestionnaire</Badge>;
}

export function BoxTag({ name, color, muted }: { name: string; color: string; muted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', muted ? 'text-ink-muted' : 'text-ink')}>
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {name}
    </span>
  );
}
