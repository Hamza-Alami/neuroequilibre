export const SCORE_LABELS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 0, label: 'Non concerné' },
  { min: 1, max: 2, label: 'Très faible' },
  { min: 3, max: 4, label: 'Léger' },
  { min: 5, max: 6, label: 'Modéré' },
  { min: 7, max: 8, label: 'Important' },
  { min: 9, max: 10, label: 'Très important / Handicapant' },
];

export function getScoreLabel(score: number): string {
  return SCORE_LABELS.find((s) => score >= s.min && score <= s.max)?.label ?? '';
}

export function scoreTone(score: number) {
  if (score <= 2) return { fg: '#2F6B4F', bg: '#E8F3EC' };
  if (score <= 4) return { fg: '#4D6B2F', bg: '#EFF4E4' };
  if (score <= 6) return { fg: '#8A6116', bg: '#FBF1DD' };
  if (score <= 8) return { fg: '#A34A1F', bg: '#FBE9DF' };
  return { fg: '#9B2C2C', bg: '#FBE4E4' };
}
