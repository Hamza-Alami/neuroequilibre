'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-[10px] border bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-muted/70 transition-colors focus:outline-none focus:ring-[3px] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted';

function controlState(error?: string | boolean) {
  return error
    ? 'border-danger/60 focus:border-danger focus:ring-danger/15'
    : 'border-line-strong hover:border-ink-muted/50 focus:border-navy focus:ring-navy/10';
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({ label, hint, error, required, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : (
        hint && <p className="text-[12px] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: string | boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return <input ref={ref} className={cn(controlBase, 'h-10', controlState(error), className)} {...props} />;
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string | boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, 'resize-y py-2.5 leading-relaxed', controlState(error), className)}
      {...props}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { error?: string | boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, 'h-10 appearance-none pr-9', controlState(error), className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
});

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--navy)]"
      />
      <span className="min-w-0">
        <span className="block text-[14px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-navy' : 'bg-line-strong'
      )}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}
