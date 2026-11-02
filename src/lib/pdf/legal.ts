import type jsPDF from 'jspdf';
import type { CentreSettings, Invoice } from '@/lib/types';
import { PDF_COLORS } from './brand';

export type Seller = Invoice['seller'];

export function sellerFromSettings(s: CentreSettings): Seller {
  return {
    name: s.legal_name?.trim() || s.centre_name,
    centre_name: s.centre_name,
    address: s.legal_address ?? '',
    phone: s.legal_phone ?? '',
    email: s.legal_email ?? '',
    ice: s.legal_ice ?? '',
    if: s.legal_if ?? '',
    rc: s.legal_rc ?? '',
    patente: s.legal_patente ?? '',
    cnss: s.legal_cnss ?? '',
    tva_mention: s.invoice_tva_mention ?? '',
    footer: s.invoice_footer ?? '',
  };
}

/** "ICE : … · IF : … · RC : …" — only the identifiers that are filled in. */
export function legalIdentifiers(seller: Seller) {
  return [
    ['ICE', seller.ice],
    ['IF', seller.if],
    ['RC', seller.rc],
    ['Patente', seller.patente],
    ['CNSS', seller.cnss],
  ]
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k} : ${v.trim()}`)
    .join(' · ');
}

/** Seller name, address and contacts; returns the next y. */
export function drawSellerBlock(doc: jsPDF, seller: Seller, x: number, y: number, maxWidth: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(seller.name, x, y);
  y += 4.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  const lines = [
    seller.name !== seller.centre_name ? seller.centre_name : '',
    seller.address,
    [seller.phone && `Tél. ${seller.phone}`, seller.email].filter(Boolean).join(' · '),
  ].filter((l) => l && l.trim());
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
    doc.text(wrapped, x, y);
    y += 4 * wrapped.length;
  }
  return y;
}

/** Legal identifiers and free footer text at the bottom of the page, above the page footer. */
export function drawLegalFooter(doc: jsPDF, seller: Seller) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const ids = legalIdentifiers(seller);
  const parts = [ids, seller.footer?.trim()].filter(Boolean) as string[];
  if (!parts.length) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);
  let y = height - 20 - (parts.length - 1) * 3.6;
  for (const p of parts) {
    const wrapped = doc.splitTextToSize(p, width - 28) as string[];
    doc.text(wrapped, width / 2, y, { align: 'center' });
    y += 3.6 * wrapped.length;
  }
}

export function drawSignatureBox(doc: jsPDF, x: number, y: number, w: number, label = 'Cachet et signature') {
  doc.setDrawColor(...PDF_COLORS.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, 26, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(label, x + 3, y + 5);
  return y + 26;
}

export function sanitizeFileName(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_');
}
