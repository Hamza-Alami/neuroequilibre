import { getScoreLabel } from '@/lib/questionnaire/scale';
import type {
  Assessment,
  AssessmentResponse,
  ClientEvolutionData,
  DifficultyEvolution,
  Session,
  SessionHistoryPoint,
  ThemeEvolution,
} from '@/lib/types';

interface EvolutionInput {
  sessions: Session[];
  assessments: (Assessment & { responses?: AssessmentResponse[] })[];
}

export function computeClientEvolution({ sessions, assessments }: EvolutionInput): ClientEvolutionData {
  const active = sessions
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const sessionsById = new Map(active.map((s) => [s.id, s]));
  const numberOf = (s: Session) => s.session_number ?? active.indexOf(s) + 1;

  const baselineSessionNumber = active[0] ? numberOf(active[0]) : 1;
  const maxSessionNumber = active.length ? numberOf(active[active.length - 1]) : baselineSessionNumber;

  const difficultyMap = new Map<string, DifficultyEvolution>();
  const themeFirstSeen = new Map<
    string,
    { sessionNumber: number; sessionDate: string; title: string; emoji: string }
  >();

  const ordered = assessments
    .filter((a) => sessionsById.has(a.session_id))
    .sort((a, b) =>
      sessionsById.get(a.session_id)!.starts_at.localeCompare(sessionsById.get(b.session_id)!.starts_at)
    );

  for (const assessment of ordered) {
    const session = sessionsById.get(assessment.session_id)!;
    const sessionNumber = numberOf(session);
    const responses = assessment.responses ?? [];

    for (const themeId of assessment.selected_themes) {
      if (!themeFirstSeen.has(themeId)) {
        const sample = responses.find((r) => r.theme_id === themeId);
        themeFirstSeen.set(themeId, {
          sessionNumber,
          sessionDate: session.starts_at,
          title: sample?.theme_title || themeId,
          emoji: sample?.theme_emoji || '',
        });
      }
    }

    for (const r of responses) {
      if (!difficultyMap.has(r.difficulty_id)) {
        difficultyMap.set(r.difficulty_id, {
          difficultyId: r.difficulty_id,
          themeId: r.theme_id,
          label: r.difficulty_label || r.difficulty_id,
          themeEmoji: r.theme_emoji,
          themeTitle: r.theme_title,
          firstSessionNumber: sessionNumber,
          firstSessionDate: session.starts_at,
          history: [],
          improvement: 0,
        });
      }
      const entry = difficultyMap.get(r.difficulty_id)!;
      const point: SessionHistoryPoint = {
        sessionId: session.id,
        sessionNumber,
        sessionDate: session.starts_at,
        score: r.score,
        isFirstAppearance: false,
        isBaseline: sessionNumber === baselineSessionNumber,
      };
      const existing = entry.history.findIndex((h) => h.sessionNumber === sessionNumber);
      if (existing >= 0) entry.history[existing] = point;
      else entry.history.push(point);
    }
  }

  const difficulties: DifficultyEvolution[] = [];
  for (const entry of difficultyMap.values()) {
    entry.history.sort((a, b) => a.sessionNumber - b.sessionNumber);
    entry.history.forEach((h, i) => (h.isFirstAppearance = i === 0));
    const first = entry.history[0];
    if (first) {
      entry.firstSessionNumber = first.sessionNumber;
      entry.firstSessionDate = first.sessionDate;
    }
    const baselinePoint = entry.history.find((h) => h.sessionNumber === baselineSessionNumber);
    const latest = entry.history[entry.history.length - 1]?.score;
    const reference = baselinePoint?.score ?? first?.score;
    entry.debut = baselinePoint?.score;
    entry.latest = latest;
    entry.seance10 = entry.history.find((h) => h.sessionNumber === 10)?.score;
    entry.seance20 = entry.history.find((h) => h.sessionNumber === 20)?.score;
    entry.improvement = reference !== undefined && latest !== undefined ? reference - latest : 0;
    entry.measuredAtBaseline = baselinePoint !== undefined;
    difficulties.push(entry);
  }

  difficulties.sort(
    (a, b) => a.firstSessionNumber - b.firstSessionNumber || b.improvement - a.improvement
  );

  const themes: ThemeEvolution[] = [...themeFirstSeen.entries()]
    .map(([themeId, seen]) => ({
      themeId,
      emoji: seen.emoji,
      title: seen.title,
      firstSessionNumber: seen.sessionNumber,
      firstSessionDate: seen.sessionDate,
      difficultyCount: difficulties.filter((d) => d.themeId === themeId).length,
      measuredAtBaseline: seen.sessionNumber === baselineSessionNumber,
    }))
    .sort((a, b) => a.firstSessionNumber - b.firstSessionNumber);

  return {
    difficulties,
    themes,
    baselineSessionNumber,
    maxSessionNumber,
    totalSessions: active.length,
  };
}

export function isNewDifficulty(evolution: DifficultyEvolution, baselineSessionNumber: number) {
  return evolution.firstSessionNumber > baselineSessionNumber;
}

export function isNewTheme(theme: ThemeEvolution, baselineSessionNumber: number) {
  return theme.firstSessionNumber > baselineSessionNumber;
}

export function formatScoreLabel(score: number) {
  return getScoreLabel(score);
}
