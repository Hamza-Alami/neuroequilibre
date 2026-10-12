import { drawBrandHeader, drawFooters, loadLogo, PDF_COLORS } from '@/lib/pdf/brand';
import { fmt } from '@/lib/time';

export interface TableColumn {
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

/** A data row, or a group heading spanning the whole table (PDF only). */
export type TableRow = string[] | { group: string };

export interface TableExport {
  title: string;
  subtitle: string;
  centreName: string;
  fileBase: string;
  columns: TableColumn[];
  rows: TableRow[];
  /** Key figures printed above the table. */
  summary?: string[];
  /** Optional totals row printed at the bottom. */
  footer?: string[];
  orientation?: 'portrait' | 'landscape';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const toPdfText = (v: string) => v.replace(/\u202f/g, ' ');

export function exportTableCsv(t: TableExport) {
  const escape = (v: string) => {
    const s = v.replace(/[\u00a0\u202f]/g, ' ');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = t.rows.filter((r): r is string[] => Array.isArray(r)).map((r) => r.map(escape).join(';'));
  if (t.footer) lines.push(t.footer.map(escape).join(';'));
  const csv = '\uFEFF' + [t.columns.map((c) => escape(c.header)).join(';'), ...lines].join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${t.fileBase}.csv`);
}

export async function exportTablePdf(t: TableExport) {
  const [{ default: jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ]);
  const doc = new jsPDF({ orientation: t.orientation ?? 'portrait', unit: 'mm', format: 'a4' });
  let y = drawBrandHeader(doc, { title: t.title, subtitle: t.subtitle, centreName: t.centreName, logo });

  if (t.summary?.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.soft);
    doc.text(t.summary.map(toPdfText).join('   ·   '), 14, y);
    y += 6;
  }

  const span = t.columns.length;
  const body = t.rows.map((r) =>
    Array.isArray(r)
      ? r.map(toPdfText)
      : [{ content: toPdfText(r.group), colSpan: span, styles: { fillColor: PDF_COLORS.goldLight, fontStyle: 'bold' as const } }]
  );

  autoTable(doc, {
    startY: y,
    head: [t.columns.map((c) => c.header)],
    body: body.length
      ? body
      : [[{ content: 'Aucune donnée sur la période.', colSpan: span, styles: { halign: 'center', textColor: PDF_COLORS.muted } }]],
    foot: t.footer ? [t.footer.map(toPdfText)] : undefined,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: PDF_COLORS.line, lineWidth: 0.2, textColor: PDF_COLORS.ink },
    headStyles: { fillColor: PDF_COLORS.navy, textColor: PDF_COLORS.white, fontStyle: 'bold' },
    footStyles: { fillColor: PDF_COLORS.light, textColor: PDF_COLORS.ink, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      t.columns.map((c, i) => [i, { ...(c.width ? { cellWidth: c.width } : {}), halign: c.align ?? 'left' }])
    ),
    margin: { left: 14, right: 14, bottom: 20 },
  });

  drawFooters(doc, `${t.centreName} — ${t.title} — exporté le ${fmt(new Date(), "d MMMM yyyy 'à' HH:mm")}`);
  doc.save(`${t.fileBase}.pdf`);
}
