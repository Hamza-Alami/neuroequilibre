import { getDifficultyLabel, getThemeById, getScoreLabel } from '@/lib/questionnaire/themes';
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
  assessments: Assessment[];
  responses: AssessmentResponse[];
}

export function computeClientEvolution(input: EvolutionInput): ClientEvolutionData {
  const { sessions, assessments, responses } = input;
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));

  const chronologicalSessions = [...sessions].sort(
    (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  );

  const baselineSessionNumber = chronologicalSessions[0]?.session_number ?? 1;
  const maxSessionNumber =
    chronologicalSessions[chronologicalSessions.length - 1]?.session_number ?? baselineSessionNumber;

  const difficultyMap = new Map<string, DifficultyEvolution>();
  const themeFirstSeen = new Map<string, { sessionNumber: number; sessionDate: string }>();

  const sortedAssessments = [...assessments].sort((a, b) => {
    const sessionA = sessionsById.get(a.session_id);
    const sessionB = sessionsById.get(b.session_id);
    return (
      (sessionA ? new Date(sessionA.session_date).getTime() : 0) -
      (sessionB ? new Date(sessionB.session_date).getTime() : 0)
    );
  });

  for (const assessment of sortedAssessments) {
    const session = sessionsById.get(assessment.session_id);
    if (!session) continue;

    for (const themeId of assessment.selected_themes) {
      if (!themeFirstSeen.has(themeId)) {
        themeFirstSeen.set(themeId, {
          sessionNumber: session.session_number,
          sessionDate: session.session_date,
        });
      }
    }

    const assessmentResponses = responses.filter(
      (r) => r.assessment_id === assessment.id && r.is_selected
    );

    for (const r of assessmentResponses) {
      if (!difficultyMap.has(r.difficulty_id)) {
        const theme = getThemeById(r.theme_id);
        difficultyMap.set(r.difficulty_id, {
          difficultyId: r.difficulty_id,
          themeId: r.theme_id,
          label: getDifficultyLabel(r.difficulty_id),
          themeEmoji: theme?.emoji ?? '',
          themeTitle: theme?.title ?? '',
          firstSessionNumber: session.session_number,
          firstSessionDate: session.session_date,
          history: [],
          improvement: 0,
        });
      }

      const entry = difficultyMap.get(r.difficulty_id)!;
      const existingIdx = entry.history.findIndex(
        (h) => h.sessionNumber === session.session_number
      );

      const point: SessionHistoryPoint = {
        sessionId: session.id,
        sessionNumber: session.session_number,
        sessionDate: session.session_date,
        score: r.score,
        isFirstAppearance: false,
        isBaseline: session.session_number === baselineSessionNumber,
      };

      if (existingIdx >= 0) {
        entry.history[existingIdx] = point;
      } else {
        entry.history.push(point);
      }
    }
  }

  const difficulties: DifficultyEvolution[] = [];

  for (const entry of difficultyMap.values()) {
    entry.history.sort((a, b) => a.sessionNumber - b.sessionNumber);

    const firstPoint = entry.history[0];
    if (firstPoint) {
      entry.firstSessionNumber = firstPoint.sessionNumber;
      entry.firstSessionDate = firstPoint.sessionDate;
    }

    for (let i = 0; i < entry.history.length; i++) {
      entry.history[i].isFirstAppearance = i === 0;
    }

    const baselinePoint = entry.history.find(
      (h) => h.sessionNumber === baselineSessionNumber
    );
    const debut = baselinePoint?.score;
    const latest = entry.history[entry.history.length - 1]?.score;
    const referenceScore = debut ?? entry.history[0]?.score;

    entry.debut = debut;
    entry.latest = latest;
    entry.seance10 = entry.history.find((h) => h.sessionNumber === 10)?.score;
    entry.seance20 = entry.history.find((h) => h.sessionNumber === 20)?.score;
    entry.improvement =
      referenceScore !== undefined && latest !== undefined ? referenceScore - latest : 0;
    entry.measuredAtBaseline = baselinePoint !== undefined;

    difficulties.push(entry);
  }

  difficulties.sort((a, b) => {
    if (a.firstSessionNumber !== b.firstSessionNumber) {
      return a.firstSessionNumber - b.firstSessionNumber;
    }
    return b.improvement - a.improvement;
  });

  const themes: ThemeEvolution[] = [];
  for (const [themeId, firstSeen] of themeFirstSeen) {
    const theme = getThemeById(themeId);
    themes.push({
      themeId,
      emoji: theme?.emoji ?? '',
      title: theme?.title ?? themeId,
      firstSessionNumber: firstSeen.sessionNumber,
      firstSessionDate: firstSeen.sessionDate,
      difficultyCount: difficulties.filter((d) => d.themeId === themeId).length,
      measuredAtBaseline: firstSeen.sessionNumber === baselineSessionNumber,
    });
  }

  themes.sort((a, b) => a.firstSessionNumber - b.firstSessionNumber);

  return {
    difficulties,
    themes,
    baselineSessionNumber,
    maxSessionNumber,
    totalSessions: chronologicalSessions.length,
  };
}

export function getDifficultyEvolution(
  data: ClientEvolutionData,
  difficultyId: string
): DifficultyEvolution | undefined {
  return data.difficulties.find((d) => d.difficultyId === difficultyId);
}

export function isNewDifficulty(
  evolution: DifficultyEvolution,
  baselineSessionNumber: number
): boolean {
  return evolution.firstSessionNumber > baselineSessionNumber;
}

export function isNewTheme(theme: ThemeEvolution, baselineSessionNumber: number): boolean {
  return theme.firstSessionNumber > baselineSessionNumber;
}

export function formatScoreLabel(score: number): string {
  return getScoreLabel(score);
}
