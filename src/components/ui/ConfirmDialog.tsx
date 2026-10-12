'use client';

import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const iconTone =
    tone === 'danger' ? 'bg-danger-50 text-danger' : tone === 'warning' ? 'bg-warning-50 text-warning' : 'bg-navy-50 text-navy';
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : tone === 'warning' ? 'accent' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 pt-1">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <div className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{message}</div>
        </div>
      </div>
    </Modal>
  );
}
