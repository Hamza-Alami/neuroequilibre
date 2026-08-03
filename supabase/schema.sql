-- =============================================================================
-- NeuroÉquilibre — Schéma Supabase
-- Exécuter dans l'éditeur SQL Supabase (Dashboard → SQL → New query)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'client');

-- =============================================================================
-- PROFILS (liés à auth.users)
-- =============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CLIENTS (KYC)
-- =============================================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'France',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address_line TEXT,
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clients_email_unique UNIQUE (email)
);

CREATE INDEX idx_clients_last_name ON clients (last_name);
CREATE INDEX idx_clients_email ON clients (email);
CREATE INDEX idx_clients_created_at ON clients (created_at DESC);

-- =============================================================================
-- SÉANCES
-- =============================================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL,
  session_number INTEGER NOT NULL DEFAULT 1,
  status session_status NOT NULL DEFAULT 'scheduled',
  is_first_session BOOLEAN NOT NULL DEFAULT FALSE,
  duration_minutes INTEGER DEFAULT 60,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_client_number_unique UNIQUE (client_id, session_number)
);

CREATE INDEX idx_sessions_client_id ON sessions (client_id);
CREATE INDEX idx_sessions_date ON sessions (session_date DESC);
CREATE INDEX idx_sessions_status ON sessions (status);

-- Auto-incrémenter session_number par client
CREATE OR REPLACE FUNCTION set_session_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_number IS NULL OR NEW.session_number = 0 THEN
    SELECT COALESCE(MAX(session_number), 0) + 1
    INTO NEW.session_number
    FROM sessions
    WHERE client_id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_set_number
  BEFORE INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_number();

-- =============================================================================
-- ÉVALUATIONS NEUROÉQUILIBRE
-- =============================================================================

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  selected_themes TEXT[] NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessments_session_unique UNIQUE (session_id)
);

CREATE INDEX idx_assessments_client_id ON assessments (client_id);
CREATE INDEX idx_assessments_submitted_at ON assessments (submitted_at DESC);

-- =============================================================================
-- RÉPONSES PAR DIFFICULTÉ (scores 1-10)
-- =============================================================================

CREATE TABLE assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,
  difficulty_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  is_selected BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_responses_unique UNIQUE (assessment_id, difficulty_id)
);

CREATE INDEX idx_assessment_responses_assessment ON assessment_responses (assessment_id);
CREATE INDEX idx_assessment_responses_theme ON assessment_responses (theme_id);

-- =============================================================================
-- THÈMES & DIFFICULTÉS (référentiel statique, optionnel en DB)
-- =============================================================================

CREATE TABLE questionnaire_themes (
  id TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  description_fr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE questionnaire_difficulties (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL REFERENCES questionnaire_themes(id) ON DELETE CASCADE,
  label_fr TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- updated_at automatique
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- VUE : Évolution clinique par client
-- =============================================================================

CREATE OR REPLACE VIEW client_evolution_summary AS
SELECT
  c.id AS client_id,
  c.first_name,
  c.last_name,
  ar.theme_id,
  ar.difficulty_id,
  s.session_number,
  ar.score,
  a.submitted_at,
  CASE
    WHEN s.session_number = 1 THEN 'debut'
    WHEN s.session_number = 10 THEN '10_seances'
    WHEN s.session_number = 20 THEN '20_seances'
    ELSE 'intermediaire'
  END AS milestone
FROM clients c
JOIN assessments a ON a.client_id = c.id
JOIN sessions s ON s.id = a.session_id
JOIN assessment_responses ar ON ar.assessment_id = a.id
WHERE ar.is_selected = TRUE AND ar.score > 0
ORDER BY c.id, ar.difficulty_id, s.session_number;

-- =============================================================================
-- FONCTION : Créer profil admin à l'inscription
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_difficulties ENABLE ROW LEVEL SECURITY;

-- Helper : vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- CLIENTS — admins : accès complet ; clients : lecture de leur propre fiche (via email)
CREATE POLICY "clients_admin_all"
  ON clients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "clients_select_own_by_email"
  ON clients FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- SESSIONS
CREATE POLICY "sessions_admin_all"
  ON sessions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "sessions_select_own"
  ON sessions FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ASSESSMENTS
CREATE POLICY "assessments_admin_all"
  ON assessments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "assessments_client_own"
  ON assessments FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ASSESSMENT RESPONSES
CREATE POLICY "responses_admin_all"
  ON assessment_responses FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "responses_client_own"
  ON assessment_responses FOR ALL
  USING (
    assessment_id IN (
      SELECT a.id FROM assessments a
      JOIN clients c ON c.id = a.client_id
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    assessment_id IN (
      SELECT a.id FROM assessments a
      JOIN clients c ON c.id = a.client_id
      WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- QUESTIONNAIRE (lecture publique pour tous les utilisateurs authentifiés)
CREATE POLICY "themes_read_authenticated"
  ON questionnaire_themes FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "themes_admin_write"
  ON questionnaire_themes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "difficulties_read_authenticated"
  ON questionnaire_difficulties FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "difficulties_admin_write"
  ON questionnaire_difficulties FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- =============================================================================
-- SEED : Données du questionnaire NeuroÉquilibre
-- =============================================================================

INSERT INTO questionnaire_themes (id, emoji, title_fr, description_fr, sort_order) VALUES
  ('concentration', '🧠', 'Concentration, mémoire et fonctions cognitives', NULL, 1),
  ('stress', '😌', 'Stress, anxiété et équilibre émotionnel', NULL, 2),
  ('sommeil', '😴', 'Sommeil et récupération', NULL, 3),
  ('scolaire', '🎓', 'Réussite scolaire et apprentissage', NULL, 4),
  ('professionnel', '💼', 'Performance professionnelle et entrepreneuriale', NULL, 5),
  ('sport', '🏃', 'Performance sportive', NULL, 6),
  ('bien_etre', '🌿', 'Bien-être et développement personnel', NULL, 7),
  ('famille', '👨‍👩‍👧', 'Enfants, adolescents et famille', NULL, 8),
  ('optimisation', '⭐', 'Optimisation des performances', NULL, 9),
  ('sante', '🩺', 'Accompagnement de certaines problématiques de santé', 'Le neurofeedback est proposé comme un accompagnement complémentaire et ne remplace pas un suivi médical.', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO questionnaire_difficulties (id, theme_id, label_fr, sort_order) VALUES
  ('diff_concentre', 'concentration', 'Difficulté à rester concentré', 1),
  ('distraction_frequente', 'concentration', 'Distraction fréquente', 2),
  ('manque_attention', 'concentration', 'Manque d''attention', 3),
  ('difficulte_terminer_tache', 'concentration', 'Difficulté à terminer une tâche', 4),
  ('difficulte_memoriser', 'concentration', 'Difficulté à mémoriser', 5),
  ('oublis_frequents', 'concentration', 'Oublis fréquents', 6),
  ('difficulte_apprendre', 'concentration', 'Difficulté à apprendre', 7),
  ('brouillard_mental', 'concentration', 'Brouillard mental', 8),
  ('difficulte_reflechir', 'concentration', 'Difficulté à réfléchir', 9),
  ('difficulte_mots', 'concentration', 'Difficulté à trouver ses mots', 10),
  ('difficulte_organiser', 'concentration', 'Difficulté à s''organiser', 11),
  ('difficulte_prioriser', 'concentration', 'Difficulté à prioriser', 12),
  ('stress_chronique', 'stress', 'Stress chronique', 1),
  ('stress_professionnel', 'stress', 'Stress professionnel', 2),
  ('stress_scolaire', 'stress', 'Stress scolaire', 3),
  ('charge_mentale', 'stress', 'Charge mentale importante', 4),
  ('difficulte_lacher_prise', 'stress', 'Difficulté à lâcher prise', 5),
  ('anxiete', 'stress', 'Anxiété', 6),
  ('crises_angoisse', 'stress', 'Crises d''angoisse', 7),
  ('crises_panique', 'stress', 'Crises de panique', 8),
  ('inquietudes_permanentes', 'stress', 'Inquiétudes permanentes', 9),
  ('irritabilite', 'stress', 'Irritabilité', 10),
  ('coleres_frequentes', 'stress', 'Colères fréquentes', 11),
  ('impulsivite', 'stress', 'Impulsivité', 12),
  ('hypersensibilite', 'stress', 'Hypersensibilité', 13),
  ('difficulte_emotions', 'stress', 'Difficulté à gérer ses émotions', 14),
  ('burn_out', 'stress', 'Burn-out', 15),
  ('epuisement_emotionnel', 'stress', 'Épuisement émotionnel', 16),
  ('deuil_separation', 'stress', 'Deuil ou séparation difficile', 17),
  ('difficulte_endormir', 'sommeil', 'Difficulté à s''endormir', 1),
  ('reveils_nocturnes', 'sommeil', 'Réveils nocturnes', 2),
  ('reveil_trop_tot', 'sommeil', 'Réveil trop tôt', 3),
  ('sommeil_non_reparateur', 'sommeil', 'Sommeil non réparateur', 4),
  ('cauchemars', 'sommeil', 'Cauchemars', 5),
  ('terreurs_nocturnes', 'sommeil', 'Terreurs nocturnes', 6),
  ('fatigue_chronique', 'sommeil', 'Fatigue chronique', 7),
  ('manque_energie', 'sommeil', 'Manque d''énergie', 8),
  ('difficulte_recuperer', 'sommeil', 'Difficulté à récupérer', 9),
  ('somnolence_journee', 'sommeil', 'Somnolence dans la journée', 10),
  ('difficultes_scolaires', 'scolaire', 'Difficultés scolaires', 1),
  ('difficultes_apprentissage', 'scolaire', 'Difficultés d''apprentissage', 2),
  ('difficulte_suivre_classe', 'scolaire', 'Difficulté à suivre en classe', 3),
  ('difficulte_devoirs', 'scolaire', 'Difficulté à faire les devoirs', 4),
  ('difficulte_reviser', 'scolaire', 'Difficulté à réviser', 5),
  ('difficulte_examens', 'scolaire', 'Difficulté pendant les examens', 6),
  ('manque_motivation_scolaire', 'scolaire', 'Manque de motivation', 7),
  ('stress_examens', 'scolaire', 'Stress des examens', 8),
  ('fatigue_mentale', 'professionnel', 'Fatigue mentale', 1),
  ('difficulte_decisions', 'professionnel', 'Difficulté à prendre des décisions', 2),
  ('difficulte_concentre_pro', 'professionnel', 'Difficulté à rester concentré', 3),
  ('manque_creativite', 'professionnel', 'Manque de créativité', 4),
  ('perte_motivation_pro', 'professionnel', 'Perte de motivation', 5),
  ('difficulte_projets', 'professionnel', 'Difficulté à gérer plusieurs projets', 6),
  ('gestion_pression_pro', 'professionnel', 'Gestion de la pression', 7),
  ('charge_mentale_pro', 'professionnel', 'Charge mentale importante', 8),
  ('difficulte_deconnecter', 'professionnel', 'Difficulté à déconnecter du travail', 9),
  ('difficulte_concentre_sport', 'sport', 'Difficulté à rester concentré en compétition', 1),
  ('stress_competition', 'sport', 'Gestion du stress avant compétition', 2),
  ('perte_confiance_sport', 'sport', 'Perte de confiance', 3),
  ('recuperation_mentale', 'sport', 'Difficulté à récupérer mentalement', 4),
  ('gestion_pression_sport', 'sport', 'Difficulté à gérer la pression', 5),
  ('moment_present', 'sport', 'Difficulté à rester dans le moment présent', 6),
  ('manque_confiance', 'bien_etre', 'Manque de confiance en soi', 1),
  ('manque_estime', 'bien_etre', 'Manque d''estime de soi', 2),
  ('timidite', 'bien_etre', 'Timidité', 3),
  ('peur_regard', 'bien_etre', 'Peur du regard des autres', 4),
  ('difficulte_parole', 'bien_etre', 'Difficulté à prendre la parole', 5),
  ('difficulte_affirmer', 'bien_etre', 'Difficulté à s''affirmer', 6),
  ('difficulte_communiquer', 'bien_etre', 'Difficulté à communiquer', 7),
  ('difficulte_conflits', 'bien_etre', 'Difficulté à gérer les conflits', 8),
  ('difficulte_relations', 'bien_etre', 'Difficulté à créer des relations', 9),
  ('potentiel_inexploite', 'bien_etre', 'Impression de ne pas exploiter son potentiel', 10),
  ('coleres_frequentes_famille', 'famille', 'Colères fréquentes', 1),
  ('crises_emotionnelles', 'famille', 'Crises émotionnelles', 2),
  ('hyperactivite', 'famille', 'Hyperactivité', 3),
  ('difficulte_calme', 'famille', 'Difficulté à rester calme', 4),
  ('difficulte_frustration', 'famille', 'Difficulté à gérer la frustration', 5),
  ('difficultes_relationnelles_famille', 'famille', 'Difficultés relationnelles', 6),
  ('difficultes_sommeil_famille', 'famille', 'Difficultés de sommeil', 7),
  ('cauchemars_famille', 'famille', 'Cauchemars', 8),
  ('difficultes_scolaires_famille', 'famille', 'Difficultés scolaires', 9),
  ('ameliorer_concentration', 'optimisation', 'Améliorer ma concentration', 1),
  ('ameliorer_memoire', 'optimisation', 'Améliorer ma mémoire', 2),
  ('developper_creativite', 'optimisation', 'Développer ma créativité', 3),
  ('plus_performant', 'optimisation', 'Être plus performant', 4),
  ('plus_serein', 'optimisation', 'Être plus serein', 5),
  ('plus_efficace', 'optimisation', 'Être plus efficace', 6),
  ('optimiser_cognitif', 'optimisation', 'Optimiser mes performances cognitives', 7),
  ('qualite_vie', 'optimisation', 'Améliorer ma qualité de vie', 8),
  ('tdah', 'sante', 'TDAH', 1),
  ('tsa', 'sante', 'Trouble du spectre de l''autisme (TSA)', 2),
  ('migraine', 'sante', 'Migraine', 3),
  ('cephalees', 'sante', 'Céphalées', 4),
  ('acouphenes', 'sante', 'Acouphènes', 5),
  ('fibromyalgie', 'sante', 'Fibromyalgie', 6),
  ('douleurs_chroniques', 'sante', 'Douleurs chroniques', 7),
  ('syndrome_fatigue', 'sante', 'Syndrome de fatigue chronique', 8),
  ('begaiement', 'sante', 'Bégaiement', 9),
  ('hyperhidrose', 'sante', 'Hyperhidrose', 10),
  ('psoriasis', 'sante', 'Psoriasis (lorsque le stress est un facteur aggravant)', 11),
  ('maladie_meniere', 'sante', 'Maladie de Ménière', 12),
  ('commotion', 'sante', 'Commotion cérébrale / Traumatisme crânien', 13),
  ('avc', 'sante', 'AVC (en complément de la rééducation)', 14),
  ('parkinson', 'sante', 'Maladie de Parkinson (en accompagnement)', 15),
  ('epilepsie', 'sante', 'Épilepsie (avec avis du neurologue)', 16)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CRÉER UN ADMIN (à adapter après création du compte dans Auth)
-- UPDATE profiles SET role = 'admin' WHERE id = 'VOTRE-UUID-ADMIN';
-- Ou lors de l'inscription : raw_app_meta_data = {"role": "admin"}
-- =============================================================================
