import type jsPDF from 'jspdf';

export type RGB = [number, number, number];

export const PDF_COLORS = {
  navy: [30, 48, 80] as RGB,
  navyDark: [21, 35, 58] as RGB,
  gold: [200, 150, 62] as RGB,
  goldLight: [251, 245, 234] as RGB,
  ink: [21, 35, 58] as RGB,
  soft: [70, 83, 107] as RGB,
  muted: [124, 133, 151] as RGB,
  line: [232, 229, 222] as RGB,
  light: [250, 249, 246] as RGB,
  white: [255, 255, 255] as RGB,
  success: [47, 122, 85] as RGB,
  danger: [180, 35, 24] as RGB,
  warning: [168, 112, 26] as RGB,
};

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

let logoCache: string | null | undefined;

export async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const res = await fetch('/neuroequilibre-logo.png');
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/** Brand header; returns the y position where content can start. */
export function drawBrandHeader(
  doc: jsPDF,
  options: { title: string; subtitle?: string; centreName: string; logo: string | null }
) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_COLORS.white);
  doc.rect(0, 0, width, 30, 'F');
  if (options.logo) {
    doc.addImage(options.logo, 'PNG', 14, 6, 34, 18.3);
  } else {
    doc.setTextColor(...PDF_COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(options.centreName, 14, 17);
  }
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(options.title, width - 14, 14, { align: 'right' });
  if (options.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(options.subtitle, width - 14, 20, { align: 'right' });
  }
  doc.setDrawColor(...PDF_COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(14, 30, width - 14, 30);
  return 40;
}

export function drawFooters(doc: jsPDF, label: string) {
  const total = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(14, height - 14, width - 14, height - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, 14, height - 8);
    doc.text(`Page ${i} / ${total}`, width - 14, height - 8, { align: 'right' });
  }
}
