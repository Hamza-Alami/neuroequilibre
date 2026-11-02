'use client';

import { CircleCheck, Download } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/money';
import { exportReceiptPdf } from '@/lib/pdf/receipt-pdf';
import type { Client, PackPayment } from '@/lib/types';

/** Confirmation shown right after a payment, with its receipt. */
export function ReceiptReady({
  payment,
  client,
  packName,
  agreedPrice,
  paidToDate,
}: {
  payment: PackPayment;
  client: Pick<Client, 'first_name' | 'last_name' | 'code' | 'gender'>;
  packName: string;
  agreedPrice: number;
  paidToDate: number;
}) {
  const { settings } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await exportReceiptPdf({ payment, client, packName, agreedPrice, paidToDate, settings });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success">
        <CircleCheck className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-ink">{formatMoney(payment.amount, settings.currency_label)} reçus</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Reçu n° <span className="tabular font-medium text-ink-soft">{payment.receipt_number}</span> · reste à payer{' '}
          {formatMoney(Math.max(agreedPrice - paidToDate, 0), settings.currency_label)}
        </p>
      </div>
      <Button icon={Download} onClick={download} loading={busy}>
        Télécharger le reçu
      </Button>
    </div>
  );
}
