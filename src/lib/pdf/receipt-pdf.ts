import { PAYMENT_METHODS } from '@/lib/db/packs';
import { civility } from '@/lib/messaging';
import { formatMoney } from '@/lib/money';
import { amountToFrenchWords } from '@/lib/number-words';
import { fmt, formatCalendarDate } from '@/lib/time';
import type { CentreSettings, Client, PackPayment } from '@/lib/types';
import { drawBrandHeader, drawFooters, loadLogo, PDF_COLORS } from './brand';
import { drawLegalFooter, drawSellerBlock, drawSignatureBox, sanitizeFileName, sellerFromSettings } from './legal';

export interface ReceiptData {
  payment: PackPayment;
  client: Pick<Client, 'first_name' | 'last_name' | 'code' | 'gender'>;
  packName: string;
  agreedPrice: number;
  /** Total paid on this pack once this payment is included. */
  paidToDate: number;
  settings: CentreSettings;
}

export async function exportReceiptPdf({ payment, client, packName, agreedPrice, paidToDate, settings }: ReceiptData) {
  const [{ default: JsPDF }, logo] = await Promise.all([import('jspdf'), loadLogo()]);
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const width = doc.internal.pageSize.getWidth();
  const currency = settings.currency_label;
  const seller = sellerFromSettings(settings);
  const money = (n: number) => formatMoney(n, currency);
  const remaining = Math.max(agreedPrice - paidToDate, 0);

  let y = drawBrandHeader(doc, {
    title: 'Reçu de paiement',
    subtitle: `N° ${payment.receipt_number}`,
    centreName: settings.centre_name,
    logo,
  });

  y = drawSellerBlock(doc, seller, 14, y, width - 28 - 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(`Émis le ${fmt(payment.created_at, 'dd/MM/yyyy')}`, width - 14, 40, { align: 'right' });
  doc.text(`Règlement du ${formatCalendarDate(payment.paid_on, 'dd/MM/yyyy')}`, width - 14, 44.6, { align: 'right' });

  y = Math.max(y, 50) + 4;
  doc.setFillColor(...PDF_COLORS.light);
  doc.setDrawColor(...PDF_COLORS.line);
  doc.roundedRect(14, y, width - 28, 15, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text('Reçu de', 18, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(`${civility(client.gender)} ${client.first_name} ${client.last_name}`, 18, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(`Code client ${client.code}`, width - 18, y + 11, { align: 'right' });
  y += 22;

  const row = (label: string, value: string, bold = false, right = width - 14) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.soft);
    doc.text(label, 14, y);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(value, right, y, { align: 'right' });
    y += 6;
  };
  row('Objet', `Règlement · ${packName}`);
  row('Mode de paiement', PAYMENT_METHODS[payment.method]);
  if (payment.note) row('Référence', payment.note);

  y += 1;
  doc.setFillColor(...PDF_COLORS.goldLight);
  doc.roundedRect(14, y, width - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text('Montant reçu', 18, y + 8.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(money(payment.amount), width - 18, y + 9.5, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  const words = doc.splitTextToSize(
    `Arrêté le présent reçu à la somme de : ${amountToFrenchWords(payment.amount, currency)}.`,
    width - 28
  ) as string[];
  doc.text(words, 14, y);
  y += 4.2 * words.length + 5;

  doc.setDrawColor(...PDF_COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(14, y - 2, width - 14, y - 2);
  y += 3;
  const top = y;
  const signatureW = 50;
  const columnRight = width - 14 - signatureW - 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text('SITUATION DU PACK', 14, y);
  y += 6;
  row('Montant convenu', money(agreedPrice), false, columnRight);
  row('Total réglé à ce jour', money(paidToDate), false, columnRight);
  row('Reste à payer', money(remaining), true, columnRight);
  drawSignatureBox(doc, width - 14 - signatureW, top - 3, signatureW);

  drawLegalFooter(doc, seller);
  drawFooters(doc, `${seller.name} — Reçu n° ${payment.receipt_number}`);
  doc.save(sanitizeFileName(`Recu_${payment.receipt_number}_${client.last_name}_${client.first_name}.pdf`));
}
