'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-[10px] border border-line bg-surface-muted p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-muted hover:text-ink'
            )}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" />}
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-navy-50 text-navy' : 'bg-line/60')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
}) {
  return (
    <div className="scrollbar-thin -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[14px] font-medium transition-colors',
              active ? 'border-navy text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="tabular rounded-full bg-surface-muted px-1.5 text-[11px] text-ink-muted ring-1 ring-line">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
