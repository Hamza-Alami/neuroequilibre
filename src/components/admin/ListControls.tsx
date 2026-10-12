'use client';

import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export function swap(ids: string[], index: number, dir: -1 | 1) {
  const next = [...ids];
  const target = index + dir;
  if (target < 0 || target >= next.length) return null;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function MoveButtons({
  index,
  count,
  onMove,
  disabled,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className="text-ink-muted hover:text-ink disabled:opacity-25"
        aria-label="Monter"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
        className="text-ink-muted hover:text-ink disabled:opacity-25"
        aria-label="Descendre"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function InlineEdit({
  value,
  onSave,
  className,
  muted,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
  muted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    const v = draft.trim();
    if (!v || v === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setSaving(true);
    try {
      await onSave(v);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') void commit();
    if (e.key === 'Escape') {
      setEditing(false);
      setDraft(value);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-1 items-center gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} autoFocus className="h-8 text-[13px]" />
        <Button size="sm" icon={Check} title="Valider" onClick={commit} loading={saving} />
        <Button
          size="sm"
          variant="ghost"
          icon={X}
          title="Annuler"
          onClick={() => {
            setEditing(false);
            setDraft(value);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`group flex min-w-0 flex-1 items-center gap-2 text-left ${className ?? ''}`}
    >
      <span className={`truncate ${muted ? 'text-ink-muted line-through' : ''}`}>{value}</span>
      <Pencil className="h-3 w-3 shrink-0 text-ink-muted opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export function DeleteButton({ onClick, title = 'Supprimer' }: { onClick: () => void; title?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={Trash2}
      title={title}
      onClick={onClick}
      className="text-ink-muted hover:bg-danger-50 hover:text-danger"
    />
  );
}
