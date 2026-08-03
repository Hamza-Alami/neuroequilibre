import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getScoreLabel } from '@/lib/questionnaire/themes';
import type { Client, ClientEvolutionData } from '@/lib/types';
import { calculateAge, formatDate, formatDateTime } from '@/lib/utils';

const COLORS = {
  primary: [29, 29, 31] as [number, number, number],
  accent: [126, 184, 218] as [number, number, number],
  sage: [168, 197, 184] as [number, number, number],
  muted: [134, 134, 139] as [number, number, number],
  light: [247, 248, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function drawHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...COLORS.sage);
  doc.rect(0, 28, pageWidth, 3, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('NeuroÉquilibre', 14, 17);
  doc.setFontSize(9);
  doc.text('Rapport d\'évolution clinique · Neural Feedback', 14, 23);
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, pageNum: number, totalPages: number) {
  doc.setDrawColor(230, 230, 230);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text(
    `NeuroÉquilibre — Document confidentiel — Généré le ${formatDate(new Date().toISOString())}`,
    14,
    pageHeight - 10
  );
  doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 80, y + 2);
  return y + 10;
}

export function exportEvolutionPdf(
  client: Client,
  evolution: ClientEvolutionData,
  sessions: { session_number: number; session_date: string }[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 40;

  drawHeader(doc, pageWidth);

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text(`${client.first_name} ${client.last_name}`, 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${calculateAge(client.date_of_birth)} ans · ${client.city}, ${client.country} · ${client.email}`,
    14,
    y
  );
  y += 5;
  doc.text(`Téléphone : ${client.phone}`, 14, y);
  y += 12;

  y = sectionTitle(doc, y, 'Synthèse du parcours');

  const improved = evolution.difficulties.filter((d) => d.improvement > 0).length;
  const totalDiff = evolution.difficulties.length;
  const avgImprovement =
    totalDiff > 0
      ? (evolution.difficulties.reduce((s, d) => s + d.improvement, 0) / totalDiff).toFixed(1)
      : '0';

  const summaryData = [
    ['Séances réalisées', `${evolution.totalSessions}`],
    ['Séance de référence (baseline)', `Séance n°${evolution.baselineSessionNumber}`],
    ['Difficultés suivies', `${totalDiff}`],
    ['Thèmes explorés', `${evolution.themes.length}`],
    ['Améliorations constatées', `${improved} / ${totalDiff}`],
    ['Progression moyenne', `${avgImprovement} points`],
  ];

  autoTable(doc, {
    startY: y,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3, textColor: COLORS.primary },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, textColor: COLORS.muted },
      1: { cellWidth: 100 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  if (sessions.length > 0) {
    y = sectionTitle(doc, y, 'Calendrier des séances');

    autoTable(doc, {
      startY: y,
      head: [['Séance', 'Date', 'Rôle']],
      body: sessions.map((s) => [
        `Séance ${s.session_number}`,
        formatDateTime(s.session_date),
        s.session_number === evolution.baselineSessionNumber ? 'Référence (baseline)' : 'Suivi',
      ]),
      headStyles: {
        fillColor: COLORS.accent,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: COLORS.primary },
      alternateRowStyles: { fillColor: COLORS.light },
      margin: { left: 14, right: 14 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  if (y > pageHeight - 60) {
    doc.addPage();
    drawHeader(doc, pageWidth);
    y = 40;
  }

  y = sectionTitle(doc, y, 'Tableau d\'évolution par difficulté');

  const tableHead = [
    'Difficulté',
    'Thème',
    `S${evolution.baselineSessionNumber}`,
    'S10',
    'S20',
    'Dernière',
    'Δ',
  ];

  const tableBody = evolution.difficulties.map((d) => {
    const debutDisplay =
      d.debut !== undefined
        ? `${d.debut}/10`
        : d.measuredAtBaseline
          ? `${d.debut ?? '—'}`
          : `— (S${d.firstSessionNumber})`;
    return [
      d.label,
      `${d.themeEmoji} ${d.themeTitle}`.trim(),
      debutDisplay,
      d.seance10 !== undefined ? `${d.seance10}/10` : '—',
      d.seance20 !== undefined ? `${d.seance20}/10` : '—',
      d.latest !== undefined ? `${d.latest}/10` : '—',
      d.improvement > 0 ? `↓${d.improvement}` : d.improvement < 0 ? `↑${Math.abs(d.improvement)}` : '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHead],
    body: tableBody,
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.primary },
    alternateRowStyles: { fillColor: COLORS.light },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 40 },
    },
  });

  doc.addPage();
  drawHeader(doc, pageWidth);
  y = 40;
  y = sectionTitle(doc, y, 'Historique détaillé par difficulté');

  for (const d of evolution.difficulties) {
    if (y > pageHeight - 50) {
      doc.addPage();
      drawHeader(doc, pageWidth);
      y = 40;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(d.label, 14, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    const meta = [
      d.themeTitle,
      d.measuredAtBaseline
        ? `Baseline S${evolution.baselineSessionNumber} : ${d.debut}/10 (${getScoreLabel(d.debut ?? 0)})`
        : `Ajouté en séance ${d.firstSessionNumber} (${formatDate(d.firstSessionDate)})`,
      d.improvement > 0
        ? `Progression : -${d.improvement} points`
        : d.improvement < 0
          ? `Variation : +${Math.abs(d.improvement)} points`
          : 'Stable',
    ].join(' · ');
    doc.text(meta, 14, y, { maxWidth: pageWidth - 28 });
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Séance', 'Date', 'Score', 'Intensité', 'Note']],
      body: d.history.map((h) => [
        `Séance ${h.sessionNumber}`,
        formatDate(h.sessionDate),
        `${h.score}/10`,
        getScoreLabel(h.score),
        h.isBaseline
          ? 'Référence baseline'
          : h.isFirstAppearance
            ? 'Première mesure'
            : 'Suivi',
      ]),
      headStyles: {
        fillColor: COLORS.sage,
        textColor: COLORS.primary,
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 252, 250] as [number, number, number] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  const newThemes = evolution.themes.filter(
    (t) => t.firstSessionNumber > evolution.baselineSessionNumber
  );
  if (newThemes.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      drawHeader(doc, pageWidth);
      y = 40;
    }
    y = sectionTitle(doc, y, 'Thèmes ajoutés en cours de suivi');
    autoTable(doc, {
      startY: y,
      head: [['Thème', 'Séance d\'ajout', 'Date', 'Difficultés suivies']],
      body: newThemes.map((t) => [
        `${t.emoji} ${t.title}`,
        `Séance ${t.firstSessionNumber}`,
        formatDate(t.firstSessionDate),
        `${t.difficultyCount}`,
      ]),
      headStyles: { fillColor: COLORS.accent, textColor: COLORS.white, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.addPage();
  drawHeader(doc, pageWidth);
  y = 40;
  y = sectionTitle(doc, y, 'Échelle d\'évaluation NeuroÉquilibre');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const scaleLines = [
    '1-2 : Très faible · 3-4 : Léger · 5-6 : Modéré',
    '7-8 : Important · 9-10 : Très important / Handicapant au quotidien',
    '',
    'La séance de référence (S' +
      evolution.baselineSessionNumber +
      ') sert de baseline pour mesurer l\'évolution.',
    'Les difficultés ajoutées ultérieurement sont historisées depuis leur première mesure.',
  ];
  scaleLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 5;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, pageHeight, i, totalPages);
  }

  const filename = `NeuroEquilibre_${client.last_name}_${client.first_name}_evolution.pdf`;
  doc.save(filename);
}
