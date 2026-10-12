'use client';

import { SLOT_STYLES, isSelectable, type Slot } from '@/lib/slots';
import { cn } from '@/lib/utils';

const LEGEND: { cls: string; label: string }[] = [
  { cls: 'border border-line-strong bg-surface', label: 'Libre' },
  { cls: 'border border-warning/30 bg-warning-50', label: 'Écart < délai minimum' },
  { cls: 'bg-surface-muted', label: 'Réservé' },
  { cls: 'hatched bg-surface-muted', label: 'Bloqué' },
];

export function SlotGrid({
  slots,
  value,
  onChange,
}: {
  slots: Slot[];
  value: string;
  onChange: (time: string) => void;
}) {
  const groups = [
    { label: 'Matin', slots: slots.filter((s) => s.time < '12:00') },
    { label: 'Après-midi', slots: slots.filter((s) => s.time >= '12:00' && s.time < '17:00') },
    { label: 'Soir', slots: slots.filter((s) => s.time >= '17:00') },
  ].filter((g) => g.slots.length);

  return (
    <div>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[12px] font-medium text-ink-muted">{group.label}</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-8">
              {group.slots.map((slot) => {
                const selected = slot.time === value;
                const selectable = isSelectable(slot.state);
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!selectable}
                    title={slot.reason}
                    onClick={() => onChange(slot.time)}
                    className={cn(
                      'tabular h-9 rounded-lg border text-[13px] font-medium transition-colors',
                      selected
                        ? 'border-navy bg-navy text-white hover:bg-navy'
                        : SLOT_STYLES[slot.state]
                    )}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className={cn('h-3 w-3 rounded', l.cls)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
