'use client';

import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { exportTableCsv, exportTablePdf, type TableExport } from '@/lib/export/table';

export function ExportButtons({ build, disabled }: { build: () => TableExport; disabled?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(kind: 'csv' | 'pdf') {
    setBusy(true);
    try {
      const table = build();
      if (kind === 'csv') exportTableCsv(table);
      else await exportTablePdf(table);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => run('csv')} disabled={disabled || busy}>
        CSV
      </Button>
      <Button size="sm" variant="secondary" icon={FileDown} onClick={() => run('pdf')} loading={busy} disabled={disabled}>
        PDF
      </Button>
    </div>
  );
}
