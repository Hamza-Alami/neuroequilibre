import type jsPDF from 'jspdf';
import { getScoreLabel } from '@/lib/questionnaire/scale';
import { calculateAge, fmt, formatDate } from '@/lib/time';
import type { Client, ClientEvolutionData, DifficultyEvolution, Session } from '@/lib/types';
import { drawBrandHeader, drawFooters, loadLogo, PDF_COLORS } from './brand';

type DocWithTable = jsPDF & { lastAutoTable: { finalY: number } };

/** Helvetica has no emoji glyphs. */
function clean(text: string) {
  return text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();
}

function sectionTitle(doc: jsPDF, y: number, title: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(title, 14, y);
  doc.setDrawColor(...PDF_COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2.2, 30, y + 2.2);
  return y + 9;
}

function drawSparkline(
  doc: jsPDF,
  d: DifficultyEvolution,
  x: number,
  y: number,
  w: number,
  h: number,
  baseline: number,
  maxSession: number
) {
  doc.setDrawColor(...PDF_COLORS.line);
  doc.setLineWidth(0.2);
  doc.setFillColor(...PDF_COLORS.light);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
  const pad = 4;
  const range = Math.max(maxSession - baseline, 1);
  const toX = (n: number) => x + pad + ((n - baseline) / range) * (w - pad * 2);
  const toY = (s: number) => y + h - pad - (s / 10) * (h - pad * 2);

  doc.setDrawColor(...PDF_COLORS.line);
  [0, 5, 10].forEach((t) => doc.line(x + pad, toY(t), x + w - pad, toY(t)));

  const pts = d.history.map((p) => [toX(p.sessionNumber), toY(p.score)] as const);
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.6);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  pts.forEach(([px, py], i) => {
    const isBase = d.history[i].isBaseline;
    doc.setFillColor(...(isBase ? PDF_COLORS.gold : PDF_COLORS.navy));
    doc.circle(px, py, isBase ? 1.1 : 0.8, 'F');
  });
}

export async function exportEvolutionPdf(
  client: Client,
  evolution: ClientEvolutionData,
  sessions: Session[],
  centreName: string
) {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ]);
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const header = () =>
    drawBrandHeader(doc, {
      title: 'Rapport d’évolution',
      subtitle: `${client.first_name} ${client.last_name}`,
      centreName,
      logo,
    });
  const ensure = (y: number, needed: number) => {
    if (y + needed <= pageHeight - 22) return y;
    doc.addPage();
    return header();
  };

  let y = header();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(`${client.first_name} ${client.last_name}`, 14, y + 2);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(
    `${calculateAge(client.date_of_birth)} ans · Né(e) le ${formatDate(client.date_of_birth)} · ${client.city}, ${client.country}`,
    14,
    y
  );
  y += 4.5;
  doc.text(`${client.phone} · ${client.email}`, 14, y);
  y += 10;

  const active = sessions.filter((s) => s.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const total = evolution.difficulties.length;
  const improved = evolution.difficulties.filter((d) => d.improvement > 0).length;
  const avg = total ? evolution.difficulties.reduce((s, d) => s + d.improvement, 0) / total : 0;

  const kpis = [
    ['Séances', String(active.length)],
    ['Difficultés suivies', String(total)],
    ['En amélioration', `${improved} / ${total}`],
    ['Progression moyenne', `${avg > 0 ? '−' : avg < 0 ? '+' : ''}${Math.abs(avg).toFixed(1)} pt`],
  ];
  const boxW = (pageWidth - 28 - 9) / 4;
  kpis.forEach(([label, value], i) => {
    const x = 14 + i * (boxW + 3);
    doc.setFillColor(...(i === 0 ? PDF_COLORS.goldLight : PDF_COLORS.light));
    doc.setDrawColor(...PDF_COLORS.line);
    doc.roundedRect(x, y, boxW, 18, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(value, x + 4, y + 14);
    doc.setFont('helvetica', 'normal');
  });
  y += 26;

  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  doc.text(
    `Séance de référence : n°${evolution.baselineSessionNumber}${active[0] ? ` du ${formatDate(active[0].starts_at)}` : ''}. ` +
      'Un score qui baisse traduit une amélioration (intensité ressentie plus faible).',
    14,
    y,
    { maxWidth: pageWidth - 28 }
  );
  y += 10;

  y = sectionTitle(doc, y, 'Tableau d’évolution');
  autoTable(doc, {
    startY: y,
    head: [['Difficulté', 'Thème', `S${evolution.baselineSessionNumber} (réf.)`, 'S10', 'S20', 'Dernière', 'Évolution']],
    body: evolution.difficulties.map((d) => [
      d.label,
      clean(d.themeTitle),
      d.debut !== undefined ? `${d.debut}/10` : `— (dès S${d.firstSessionNumber})`,
      d.seance10 !== undefined ? `${d.seance10}/10` : '—',
      d.seance20 !== undefined ? `${d.seance20}/10` : '—',
      d.latest !== undefined ? `${d.latest}/10` : '—',
      d.improvement > 0 ? `−${d.improvement} pt` : d.improvement < 0 ? `+${Math.abs(d.improvement)} pt` : 'Stable',
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: PDF_COLORS.line, lineWidth: 0.2, textColor: PDF_COLORS.ink },
    headStyles: { fillColor: PDF_COLORS.navy, textColor: PDF_COLORS.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PDF_COLORS.light },
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 40 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center', fontStyle: 'bold' } },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 6) {
        const raw = String(hook.cell.raw);
        hook.cell.styles.textColor = raw.startsWith('−') ? PDF_COLORS.success : raw.startsWith('+') ? PDF_COLORS.danger : PDF_COLORS.muted;
      }
    },
    margin: { left: 14, right: 14, top: 40, bottom: 22 },
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) header();
    },
  });
  y = doc.lastAutoTable.finalY + 12;

  y = ensure(y, 30);
  y = sectionTitle(doc, y, 'Historique détaillé par difficulté');
  for (const d of evolution.difficulties) {
    y = ensure(y, 52);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(d.label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    const meta = [
      clean(d.themeTitle),
      d.measuredAtBaseline
        ? `Référence : ${d.debut}/10 (${getScoreLabel(d.debut ?? 0)})`
        : `Ajoutée en séance n°${d.firstSessionNumber} (${formatDate(d.firstSessionDate)})`,
    ].join(' · ');
    doc.text(meta, 14, y + 4.5, { maxWidth: pageWidth - 28 });

    const chartW = 62;
    drawSparkline(doc, d, 14, y + 8, chartW, 30, evolution.baselineSessionNumber, evolution.maxSessionNumber);

    autoTable(doc, {
      startY: y + 8,
      head: [['Séance', 'Date', 'Score', 'Intensité']],
      body: d.history.map((h) => [
        `S${h.sessionNumber}${h.isBaseline ? ' (réf.)' : h.isFirstAppearance ? ' (1re)' : ''}`,
        formatDate(h.sessionDate),
        `${h.score}/10`,
        getScoreLabel(h.score),
      ]),
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 1.4, textColor: PDF_COLORS.ink },
      headStyles: { textColor: PDF_COLORS.muted, fontStyle: 'bold', lineWidth: { bottom: 0.2 }, lineColor: PDF_COLORS.line },
      margin: { left: 14 + chartW + 6, right: 14, top: 40, bottom: 22 },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) header();
      },
    });
    y = Math.max(doc.lastAutoTable.finalY, y + 8 + 30) + 9;
  }

  const newThemes = evolution.themes.filter((t) => t.firstSessionNumber > evolution.baselineSessionNumber);
  if (newThemes.length) {
    y = ensure(y, 30);
    y = sectionTitle(doc, y, 'Thèmes ajoutés en cours de suivi');
    autoTable(doc, {
      startY: y,
      head: [['Thème', 'Ajouté en', 'Date', 'Difficultés']],
      body: newThemes.map((t) => [clean(t.title), `Séance n°${t.firstSessionNumber}`, formatDate(t.firstSessionDate), String(t.difficultyCount)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: PDF_COLORS.line, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.gold, textColor: PDF_COLORS.white },
      margin: { left: 14, right: 14, top: 40, bottom: 22 },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (active.length) {
    y = ensure(y, 30);
    y = sectionTitle(doc, y, 'Calendrier des séances');
    autoTable(doc, {
      startY: y,
      head: [['N°', 'Date', 'Horaire', 'Durée', 'Statut']],
      body: active.map((s) => [
        String(s.session_number ?? ''),
        fmt(s.starts_at, 'EEEE d MMMM yyyy'),
        fmt(s.starts_at, 'HH:mm'),
        `${s.duration_minutes} min`,
        s.status === 'completed' ? 'Réalisée' : new Date(s.starts_at) < new Date() ? 'Passée' : 'À venir',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: PDF_COLORS.line, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.navy, textColor: PDF_COLORS.white },
      alternateRowStyles: { fillColor: PDF_COLORS.light },
      margin: { left: 14, right: 14, top: 40, bottom: 22 },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) header();
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  y = ensure(y, 28);
  y = sectionTitle(doc, y, 'Échelle d’évaluation');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.soft);
  ['0 : Non concerné · 1–2 : Très faible · 3–4 : Léger · 5–6 : Modéré', '7–8 : Important · 9–10 : Très important / Handicapant au quotidien'].forEach((line) => {
    doc.text(line, 14, y);
    y += 4.5;
  });

  drawFooters(doc, `${centreName} — Document confidentiel — Généré le ${fmt(new Date(), "d MMMM yyyy 'à' HH:mm")}`);
  doc.save(`NeuroEquilibre_${client.last_name}_${client.first_name}_evolution.pdf`.replace(/\s+/g, '_'));
}
