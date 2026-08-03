'use client';

import { cn } from '@/lib/utils';

const inputClass = cn(
  'w-full rounded-2xl px-5 py-3.5 text-[15px] text-[#1a1d26]',
  'glass border-white/60 placeholder:text-[#9ca3af]',
  'transition-all duration-300',
  'focus:border-[#5ba4c9]/40 focus:bg-white/80 focus:outline-none focus:ring-4 focus:ring-[#5ba4c9]/12'
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-medium text-[#6b7280]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(inputClass, error && 'border-red-300 focus:border-red-400 focus:ring-red-100', className)}
        {...props}
      />
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-medium text-[#6b7280]">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(inputClass, 'min-h-[100px] resize-none', className)}
        {...props}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-medium text-[#6b7280]">
          {label}
        </label>
      )}
      <select id={inputId} className={cn(inputClass, 'cursor-pointer', className)} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
