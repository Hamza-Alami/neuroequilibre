import { downloadBlob } from '@/lib/export/table';
import { drawBrandHeader, drawFooters, hexToRgb, loadLogo, PDF_COLORS } from '@/lib/pdf/brand';
import { STATUS_LABELS, displayStatus } from '@/lib/status';
import { dateKey, fmt, formatCalendarDate, formatTime, sessionEnd } from '@/lib/time';
import type { SessionWithRelations } from '@/lib/types';
import { fullName } from '@/lib/utils';

interface ExportContext {
  sessions: SessionWithRelations[];
  periodLabel: string;
  filtersLabel: string;
  centreName: string;
  fileBase: string;
}

function rows(sessions: SessionWithRelations[]) {
  return sessions.map((s) => ({
    date: fmt(s.starts_at, 'dd/MM/yyyy'),
    day: fmt(s.starts_at, 'EEEE'),
    start: formatTime(s.starts_at),
    end: formatTime(sessionEnd(s.starts_at, s.duration_minutes)),
    duration: String(s.duration_minutes),
    box: s.box?.name ?? '',
    boxColor: s.box?.color ?? '#7C8597',
    client: fullName(s.client),
    phone: s.client?.phone ?? '',
    number: s.session_number ? String(s.session_number) : '',
    status: STATUS_LABELS[displayStatus(s)],
    notes: s.notes ?? '',
    key: dateKey(s.starts_at),
  }));
}

export function exportPlanningCsv(ctx: ExportContext) {
  const header = ['Date', 'Jour', 'Début', 'Fin', 'Durée (min)', 'Box', 'Client', 'Téléphone', 'N° séance', 'Statut', 'Notes'];
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows(ctx.sessions).map((r) =>
    [r.date, r.day, r.start, r.end, r.duration, r.box, r.client, r.phone, r.number, r.status, r.notes]
      .map(escape)
      .join(';')
  );
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${ctx.fileBase}.csv`);
}

export async function exportPlanningPdf(ctx: ExportContext) {
  const [{ default: jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawBrandHeader(doc, {
    title: 'Planning des séances',
    subtitle: ctx.periodLabel,
    centreName: ctx.centreName,
    logo,
  });

  const data = rows(ctx.sessions);
  const count = (s: string) => data.filter((r) => r.status === s).length;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(
    `${data.length} séance(s) · ${count('À venir')} à venir · ${count('Réalisée')} réalisée(s) · ${count('Passée')} passée(s) · ${count('Annulée')} annulée(s)`,
    14,
    y
  );
  if (ctx.filtersLabel) {
    doc.text(ctx.filtersLabel, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
  }
  y += 6;

  const byDay = new Map<string, typeof data>();
  for (const r of data) {
    if (!byDay.has(r.key)) byDay.set(r.key, []);
    byDay.get(r.key)!.push(r);
  }

  const body: (string | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = [];
  for (const [key, list] of byDay) {
    body.push([
      {
        content: `${formatCalendarDate(key, 'EEEE d MMMM yyyy')}  ·  ${list.length} séance(s)`,
        colSpan: 8,
        styles: { fillColor: PDF_COLORS.goldLight, textColor: PDF_COLORS.ink, fontStyle: 'bold' },
      },
    ]);
    for (const r of list) {
      body.push([`${r.start} – ${r.end}`, `${r.duration} min`, r.box, r.client, r.phone, r.number, r.status, r.notes]);
    }
  }

  const boxColorByName = new Map(data.map((r) => [r.box, r.boxColor]));

  autoTable(doc, {
    startY: y,
    head: [['Horaire', 'Durée', 'Box', 'Client', 'Téléphone', 'N°', 'Statut', 'Notes']],
    body: body.length ? body : [[{ content: 'Aucune séance sur la période.', colSpan: 8, styles: { halign: 'center', textColor: PDF_COLORS.muted } }]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: PDF_COLORS.line, lineWidth: 0.2, textColor: PDF_COLORS.ink },
    headStyles: { fillColor: PDF_COLORS.navy, textColor: PDF_COLORS.white, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 18 },
      2: { cellWidth: 24 },
      3: { cellWidth: 48 },
      4: { cellWidth: 32 },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 24 },
    },
    didDrawCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 2 && typeof hook.cell.raw === 'string') {
        const color = boxColorByName.get(hook.cell.raw);
        if (color) {
          hook.doc.setFillColor(...hexToRgb(color));
          hook.doc.rect(hook.cell.x, hook.cell.y, 1.2, hook.cell.height, 'F');
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  drawFooters(doc, `${ctx.centreName} — Planning exporté le ${fmt(new Date(), "d MMMM yyyy 'à' HH:mm")}`);
  doc.save(`${ctx.fileBase}.pdf`);
}
