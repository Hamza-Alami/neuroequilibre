import type jsPDF from 'jspdf';
import { PAYMENT_METHODS } from '@/lib/db/packs';
import { formatMoney } from '@/lib/money';
import { amountToFrenchWords } from '@/lib/number-words';
import { fmt, formatCalendarDate } from '@/lib/time';
import type { Invoice } from '@/lib/types';
import { drawBrandHeader, drawFooters, loadLogo, PDF_COLORS } from './brand';
import { drawLegalFooter, drawSellerBlock, drawSignatureBox, sanitizeFileName } from './legal';

type DocWithTable = jsPDF & { lastAutoTable: { finalY: number } };

const formatRate = (rate: number) => `${String(rate).replace('.', ',')} %`;

export async function exportInvoicePdf(invoice: Invoice) {
  const [{ default: JsPDF, GState }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ]);
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithTable;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const seller = invoice.seller;
  const money = (n: number) => formatMoney(n, invoice.currency);
  const withTva = invoice.tva_rate > 0;
  const cancelled = invoice.status === 'cancelled';
  const remaining = Math.max(invoice.total_ttc - invoice.paid_amount, 0);
  const margin = { left: 14, right: 14, top: 40, bottom: 30 };

  const header = () =>
    drawBrandHeader(doc, {
      title: cancelled ? 'Facture (annulée)' : 'Facture',
      subtitle: `N° ${invoice.number}`,
      centreName: seller.centre_name,
      logo,
    });
  const ensure = (y: number, needed: number) => {
    if (y + needed <= height - margin.bottom) return y;
    doc.addPage();
    return header();
  };

  let y = header();
  const sellerEnd = drawSellerBlock(doc, seller, 14, y, width / 2 - 20);

  // Billed-to block
  const bx = width / 2 + 4;
  const bw = width - 14 - bx;
  const billed = [
    invoice.billed_company,
    invoice.billed_ice ? `ICE : ${invoice.billed_ice}` : '',
    invoice.billed_address,
    invoice.client_code ? `Code client : ${invoice.client_code}` : '',
  ].filter((l): l is string => Boolean(l && l.trim()));
  const billedLines = billed.flatMap((l) => doc.splitTextToSize(l, bw - 8) as string[]);
  const boxH = 13 + billedLines.length * 4.2;
  doc.setFillColor(...PDF_COLORS.light);
  doc.setDrawColor(...PDF_COLORS.line);
  doc.roundedRect(bx, y - 5, bw, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text('FACTURÉ À', bx + 4, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(invoice.billed_name, bx + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(billedLines, bx + 4, y + 10.5);

  y = Math.max(sellerEnd, y - 5 + boxH) + 8;

  // Meta
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(`Facture n° ${invoice.number}`, 14, y);
  doc.text(`Date : ${formatCalendarDate(invoice.issued_on, 'dd/MM/yyyy')}`, width - 14, y, { align: 'right' });
  y += 6;

  // Lines
  const lineRows = invoice.lines.map((l) => {
    const ht = withTva ? Math.round((l.amount / (1 + invoice.tva_rate / 100)) * 100) / 100 : l.amount;
    const detail = [
      l.detail,
      l.discount > 0 ? `Tarif de référence ${money(l.reference_price)}, remise de ${money(l.discount)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return [`${l.label}${detail ? `\n${detail}` : ''}`, String(l.quantity), money(ht / l.quantity), money(ht)];
  });
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', withTva ? 'Prix unitaire HT' : 'Prix unitaire', withTva ? 'Total HT' : 'Montant']],
    body: lineRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, lineColor: PDF_COLORS.line, lineWidth: 0.2, textColor: PDF_COLORS.ink, valign: 'top' },
    headStyles: { fillColor: PDF_COLORS.navy, textColor: PDF_COLORS.white, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center', cellWidth: 16 }, 2: { halign: 'right', cellWidth: 36 }, 3: { halign: 'right', cellWidth: 36 } },
    margin,
    didParseCell: (hook) => {
      if (hook.section === 'head' && hook.column.index > 0) hook.cell.styles.halign = hook.column.index === 1 ? 'center' : 'right';
    },
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) header();
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Totals
  y = ensure(y, 40);
  const tx = width - 14 - 80;
  const total = (label: string, value: string, strong = false) => {
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setFontSize(strong ? 10.5 : 9);
    doc.setTextColor(...(strong ? PDF_COLORS.ink : PDF_COLORS.soft));
    doc.text(label, tx, y);
    doc.text(value, width - 14, y, { align: 'right' });
    y += strong ? 7 : 5.5;
  };
  if (withTva) {
    total('Total HT', money(invoice.total_ht));
    total(`TVA ${formatRate(invoice.tva_rate)}`, money(invoice.tva_amount));
    doc.setDrawColor(...PDF_COLORS.gold);
    doc.setLineWidth(0.4);
    doc.line(tx, y - 3, width - 14, y - 3);
    y += 1.5;
    total('Total TTC', money(invoice.total_ttc), true);
  } else {
    total('Total à payer', money(invoice.total_ttc), true);
    if (seller.tva_mention?.trim()) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(seller.tva_mention.trim(), width - 14, y - 2, { align: 'right' });
      y += 3;
    }
  }

  y += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.soft);
  const words = doc.splitTextToSize(
    `Arrêtée la présente facture à la somme de : ${amountToFrenchWords(invoice.total_ttc, invoice.currency)}${withTva ? ' toutes taxes comprises' : ''}.`,
    width - 28
  ) as string[];
  doc.text(words, 14, y);
  y += 4.5 * words.length + 6;

  // Payments received at the invoice date
  y = ensure(y, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text('Règlements reçus', 14, y);
  doc.setDrawColor(...PDF_COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2, 30, y + 2);
  y += 6;
  if (invoice.payments.length) {
    autoTable(doc, {
      startY: y,
      head: [['Reçu', 'Date', 'Mode', 'Montant']],
      body: invoice.payments.map((p) => [
        p.receipt_number,
        formatCalendarDate(p.paid_on, 'dd/MM/yyyy'),
        PAYMENT_METHODS[p.method] ?? p.method,
        money(p.amount),
      ]),
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: PDF_COLORS.ink },
      headStyles: { textColor: PDF_COLORS.muted, fontStyle: 'bold', lineWidth: { bottom: 0.2 }, lineColor: PDF_COLORS.line },
      columnStyles: { 3: { halign: 'right' } },
      margin,
      didParseCell: (hook) => {
        if (hook.section === 'head' && hook.column.index === 3) hook.cell.styles.halign = 'right';
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) header();
      },
    });
    y = doc.lastAutoTable.finalY + 5;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text('Aucun règlement à la date de la facture.', 14, y + 2);
    y += 8;
  }
  y = ensure(y, 16);
  total('Total réglé', money(invoice.paid_amount));
  total('Reste à payer', money(remaining), true);

  if (invoice.notes) {
    y = ensure(y + 2, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.soft);
    const notes = doc.splitTextToSize(`Remarques : ${invoice.notes}`, width - 28) as string[];
    doc.text(notes, 14, y + 2);
    y += 4.2 * notes.length + 4;
  }

  y = ensure(y + 4, 30);
  drawSignatureBox(doc, width - 14 - 70, y, 70);

  if (cancelled) {
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setGState(new GState({ opacity: 0.18 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(64);
      doc.setTextColor(...PDF_COLORS.danger);
      doc.text('ANNULÉE', width / 2, height / 2, { align: 'center', angle: 30 });
      doc.setGState(new GState({ opacity: 1 }));
    }
    doc.setPage(doc.getNumberOfPages());
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.danger);
    const reason = `Facture annulée le ${invoice.cancelled_at ? fmt(invoice.cancelled_at, 'dd/MM/yyyy') : '—'}${invoice.cancelled_reason ? ` · Motif : ${invoice.cancelled_reason}` : ''}`;
    doc.text(reason, 14, height - 34);
  }

  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    drawLegalFooter(doc, seller);
  }
  drawFooters(doc, `${seller.name} — Facture n° ${invoice.number}`);
  doc.save(sanitizeFileName(`Facture_${invoice.number}_${invoice.billed_name}.pdf`));
}
