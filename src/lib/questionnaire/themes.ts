import type { QuestionnaireTheme } from '@/lib/types';

export const SCORE_LABELS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 0, label: 'Non concerné' },
  { min: 1, max: 2, label: 'Très faible' },
  { min: 3, max: 4, label: 'Léger' },
  { min: 5, max: 6, label: 'Modéré' },
  { min: 7, max: 8, label: 'Important' },
  { min: 9, max: 10, label: 'Très important / Handicapant' },
];

export function getScoreLabel(score: number): string {
  const match = SCORE_LABELS.find((s) => score >= s.min && score <= s.max);
  return match?.label ?? '';
}

export const QUESTIONNAIRE_THEMES: QuestionnaireTheme[] = [
  {
    id: 'concentration',
    emoji: '🧠',
    title: 'Concentration, mémoire et fonctions cognitives',
    difficulties: [
      { id: 'diff_concentre', themeId: 'concentration', label: 'Difficulté à rester concentré' },
      { id: 'distraction_frequente', themeId: 'concentration', label: 'Distraction fréquente' },
      { id: 'manque_attention', themeId: 'concentration', label: "Manque d'attention" },
      { id: 'difficulte_terminer_tache', themeId: 'concentration', label: 'Difficulté à terminer une tâche' },
      { id: 'difficulte_memoriser', themeId: 'concentration', label: 'Difficulté à mémoriser' },
      { id: 'oublis_frequents', themeId: 'concentration', label: 'Oublis fréquents' },
      { id: 'difficulte_apprendre', themeId: 'concentration', label: 'Difficulté à apprendre' },
      { id: 'brouillard_mental', themeId: 'concentration', label: 'Brouillard mental' },
      { id: 'difficulte_reflechir', themeId: 'concentration', label: 'Difficulté à réfléchir' },
      { id: 'difficulte_mots', themeId: 'concentration', label: 'Difficulté à trouver ses mots' },
      { id: 'difficulte_organiser', themeId: 'concentration', label: "Difficulté à s'organiser" },
      { id: 'difficulte_prioriser', themeId: 'concentration', label: 'Difficulté à prioriser' },
    ],
  },
  {
    id: 'stress',
    emoji: '😌',
    title: 'Stress, anxiété et équilibre émotionnel',
    difficulties: [
      { id: 'stress_chronique', themeId: 'stress', label: 'Stress chronique' },
      { id: 'stress_professionnel', themeId: 'stress', label: 'Stress professionnel' },
      { id: 'stress_scolaire', themeId: 'stress', label: 'Stress scolaire' },
      { id: 'charge_mentale', themeId: 'stress', label: 'Charge mentale importante' },
      { id: 'difficulte_lacher_prise', themeId: 'stress', label: 'Difficulté à lâcher prise' },
      { id: 'anxiete', themeId: 'stress', label: 'Anxiété' },
      { id: 'crises_angoisse', themeId: 'stress', label: "Crises d'angoisse" },
      { id: 'crises_panique', themeId: 'stress', label: 'Crises de panique' },
      { id: 'inquietudes_permanentes', themeId: 'stress', label: 'Inquiétudes permanentes' },
      { id: 'irritabilite', themeId: 'stress', label: 'Irritabilité' },
      { id: 'coleres_frequentes', themeId: 'stress', label: 'Colères fréquentes' },
      { id: 'impulsivite', themeId: 'stress', label: 'Impulsivité' },
      { id: 'hypersensibilite', themeId: 'stress', label: 'Hypersensibilité' },
      { id: 'difficulte_emotions', themeId: 'stress', label: 'Difficulté à gérer ses émotions' },
      { id: 'burn_out', themeId: 'stress', label: 'Burn-out' },
      { id: 'epuisement_emotionnel', themeId: 'stress', label: 'Épuisement émotionnel' },
      { id: 'deuil_separation', themeId: 'stress', label: 'Deuil ou séparation difficile' },
    ],
  },
  {
    id: 'sommeil',
    emoji: '😴',
    title: 'Sommeil et récupération',
    difficulties: [
      { id: 'difficulte_endormir', themeId: 'sommeil', label: "Difficulté à s'endormir" },
      { id: 'reveils_nocturnes', themeId: 'sommeil', label: 'Réveils nocturnes' },
      { id: 'reveil_trop_tot', themeId: 'sommeil', label: 'Réveil trop tôt' },
      { id: 'sommeil_non_reparateur', themeId: 'sommeil', label: 'Sommeil non réparateur' },
      { id: 'cauchemars', themeId: 'sommeil', label: 'Cauchemars' },
      { id: 'terreurs_nocturnes', themeId: 'sommeil', label: 'Terreurs nocturnes' },
      { id: 'fatigue_chronique', themeId: 'sommeil', label: 'Fatigue chronique' },
      { id: 'manque_energie', themeId: 'sommeil', label: "Manque d'énergie" },
      { id: 'difficulte_recuperer', themeId: 'sommeil', label: 'Difficulté à récupérer' },
      { id: 'somnolence_journee', themeId: 'sommeil', label: 'Somnolence dans la journée' },
    ],
  },
  {
    id: 'scolaire',
    emoji: '🎓',
    title: 'Réussite scolaire et apprentissage',
    difficulties: [
      { id: 'difficultes_scolaires', themeId: 'scolaire', label: 'Difficultés scolaires' },
      { id: 'difficultes_apprentissage', themeId: 'scolaire', label: "Difficultés d'apprentissage" },
      { id: 'difficulte_suivre_classe', themeId: 'scolaire', label: 'Difficulté à suivre en classe' },
      { id: 'difficulte_devoirs', themeId: 'scolaire', label: 'Difficulté à faire les devoirs' },
      { id: 'difficulte_reviser', themeId: 'scolaire', label: 'Difficulté à réviser' },
      { id: 'difficulte_examens', themeId: 'scolaire', label: 'Difficulté pendant les examens' },
      { id: 'manque_motivation_scolaire', themeId: 'scolaire', label: 'Manque de motivation' },
      { id: 'stress_examens', themeId: 'scolaire', label: 'Stress des examens' },
    ],
  },
  {
    id: 'professionnel',
    emoji: '💼',
    title: 'Performance professionnelle et entrepreneuriale',
    difficulties: [
      { id: 'fatigue_mentale', themeId: 'professionnel', label: 'Fatigue mentale' },
      { id: 'difficulte_decisions', themeId: 'professionnel', label: 'Difficulté à prendre des décisions' },
      { id: 'difficulte_concentre_pro', themeId: 'professionnel', label: 'Difficulté à rester concentré' },
      { id: 'manque_creativite', themeId: 'professionnel', label: 'Manque de créativité' },
      { id: 'perte_motivation_pro', themeId: 'professionnel', label: 'Perte de motivation' },
      { id: 'difficulte_projets', themeId: 'professionnel', label: 'Difficulté à gérer plusieurs projets' },
      { id: 'gestion_pression_pro', themeId: 'professionnel', label: 'Gestion de la pression' },
      { id: 'charge_mentale_pro', themeId: 'professionnel', label: 'Charge mentale importante' },
      { id: 'difficulte_deconnecter', themeId: 'professionnel', label: 'Difficulté à déconnecter du travail' },
    ],
  },
  {
    id: 'sport',
    emoji: '🏃',
    title: 'Performance sportive',
    difficulties: [
      { id: 'difficulte_concentre_sport', themeId: 'sport', label: 'Difficulté à rester concentré en compétition' },
      { id: 'stress_competition', themeId: 'sport', label: 'Gestion du stress avant compétition' },
      { id: 'perte_confiance_sport', themeId: 'sport', label: 'Perte de confiance' },
      { id: 'recuperation_mentale', themeId: 'sport', label: 'Difficulté à récupérer mentalement' },
      { id: 'gestion_pression_sport', themeId: 'sport', label: 'Difficulté à gérer la pression' },
      { id: 'moment_present', themeId: 'sport', label: 'Difficulté à rester dans le moment présent' },
    ],
  },
  {
    id: 'bien_etre',
    emoji: '🌿',
    title: 'Bien-être et développement personnel',
    difficulties: [
      { id: 'manque_confiance', themeId: 'bien_etre', label: 'Manque de confiance en soi' },
      { id: 'manque_estime', themeId: 'bien_etre', label: "Manque d'estime de soi" },
      { id: 'timidite', themeId: 'bien_etre', label: 'Timidité' },
      { id: 'peur_regard', themeId: 'bien_etre', label: 'Peur du regard des autres' },
      { id: 'difficulte_parole', themeId: 'bien_etre', label: 'Difficulté à prendre la parole' },
      { id: 'difficulte_affirmer', themeId: 'bien_etre', label: "Difficulté à s'affirmer" },
      { id: 'difficulte_communiquer', themeId: 'bien_etre', label: 'Difficulté à communiquer' },
      { id: 'difficulte_conflits', themeId: 'bien_etre', label: 'Difficulté à gérer les conflits' },
      { id: 'difficulte_relations', themeId: 'bien_etre', label: 'Difficulté à créer des relations' },
      { id: 'potentiel_inexploite', themeId: 'bien_etre', label: 'Impression de ne pas exploiter son potentiel' },
    ],
  },
  {
    id: 'famille',
    emoji: '👨‍👩‍👧',
    title: 'Enfants, adolescents et famille',
    difficulties: [
      { id: 'coleres_frequentes_famille', themeId: 'famille', label: 'Colères fréquentes' },
      { id: 'crises_emotionnelles', themeId: 'famille', label: 'Crises émotionnelles' },
      { id: 'hyperactivite', themeId: 'famille', label: 'Hyperactivité' },
      { id: 'difficulte_calme', themeId: 'famille', label: 'Difficulté à rester calme' },
      { id: 'difficulte_frustration', themeId: 'famille', label: 'Difficulté à gérer la frustration' },
      { id: 'difficultes_relationnelles_famille', themeId: 'famille', label: 'Difficultés relationnelles' },
      { id: 'difficultes_sommeil_famille', themeId: 'famille', label: 'Difficultés de sommeil' },
      { id: 'cauchemars_famille', themeId: 'famille', label: 'Cauchemars' },
      { id: 'difficultes_scolaires_famille', themeId: 'famille', label: 'Difficultés scolaires' },
    ],
  },
  {
    id: 'optimisation',
    emoji: '⭐',
    title: 'Optimisation des performances',
    difficulties: [
      { id: 'ameliorer_concentration', themeId: 'optimisation', label: 'Améliorer ma concentration' },
      { id: 'ameliorer_memoire', themeId: 'optimisation', label: 'Améliorer ma mémoire' },
      { id: 'developper_creativite', themeId: 'optimisation', label: 'Développer ma créativité' },
      { id: 'plus_performant', themeId: 'optimisation', label: 'Être plus performant' },
      { id: 'plus_serein', themeId: 'optimisation', label: 'Être plus serein' },
      { id: 'plus_efficace', themeId: 'optimisation', label: 'Être plus efficace' },
      { id: 'optimiser_cognitif', themeId: 'optimisation', label: 'Optimiser mes performances cognitives' },
      { id: 'qualite_vie', themeId: 'optimisation', label: 'Améliorer ma qualité de vie' },
    ],
  },
  {
    id: 'sante',
    emoji: '🩺',
    title: 'Accompagnement de certaines problématiques de santé',
    description:
      'Le neurofeedback est proposé comme un accompagnement complémentaire et ne remplace pas un suivi médical.',
    difficulties: [
      { id: 'tdah', themeId: 'sante', label: 'TDAH' },
      { id: 'tsa', themeId: 'sante', label: "Trouble du spectre de l'autisme (TSA)" },
      { id: 'migraine', themeId: 'sante', label: 'Migraine' },
      { id: 'cephalees', themeId: 'sante', label: 'Céphalées' },
      { id: 'acouphenes', themeId: 'sante', label: 'Acouphènes' },
      { id: 'fibromyalgie', themeId: 'sante', label: 'Fibromyalgie' },
      { id: 'douleurs_chroniques', themeId: 'sante', label: 'Douleurs chroniques' },
      { id: 'syndrome_fatigue', themeId: 'sante', label: 'Syndrome de fatigue chronique' },
      { id: 'begaiement', themeId: 'sante', label: 'Bégaiement' },
      { id: 'hyperhidrose', themeId: 'sante', label: 'Hyperhidrose' },
      { id: 'psoriasis', themeId: 'sante', label: 'Psoriasis (lorsque le stress est un facteur aggravant)' },
      { id: 'maladie_meniere', themeId: 'sante', label: 'Maladie de Ménière' },
      { id: 'commotion', themeId: 'sante', label: 'Commotion cérébrale / Traumatisme crânien' },
      { id: 'avc', themeId: 'sante', label: 'AVC (en complément de la rééducation)' },
      { id: 'parkinson', themeId: 'sante', label: 'Maladie de Parkinson (en accompagnement)' },
      { id: 'epilepsie', themeId: 'sante', label: 'Épilepsie (avec avis du neurologue)' },
    ],
  },
];

export function getThemeById(id: string): QuestionnaireTheme | undefined {
  return QUESTIONNAIRE_THEMES.find((t) => t.id === id);
}

export function getDifficultyLabel(difficultyId: string): string {
  for (const theme of QUESTIONNAIRE_THEMES) {
    const diff = theme.difficulties.find((d) => d.id === difficultyId);
    if (diff) return diff.label;
  }
  return difficultyId;
}

export function getDifficultyThemeId(difficultyId: string): string {
  for (const theme of QUESTIONNAIRE_THEMES) {
    if (theme.difficulties.some((d) => d.id === difficultyId)) {
      return theme.id;
    }
  }
  return '';
}
