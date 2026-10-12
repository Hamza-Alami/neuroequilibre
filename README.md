# NeuroÉquilibre — Centre de neurofeedback

Application interne de gestion du centre : clients (KYC), réservation des séances par box, planning, questionnaire d’évaluation, suivi d’évolution et exports PDF/CSV.

## Fonctionnalités

- **Connexion par mot de passe** et deux rôles :
  - **Administrateur** : tous les droits, y compris la configuration.
  - **Gestionnaire** : crée des clients, réserve des séances, consulte les fiches et le planning.
- **Réservation** : choix obligatoire du box, jamais avant aujourd’hui, créneau déjà pris refusé, alerte si la séance démarre moins de 44 min après la précédente dans le même box (« Voulez-vous quand même réserver ? »).
- **Planning** : vues jour / semaine / mois, par box, filtres de statut (à venir, passée, annulée), accès direct au client, export CSV et PDF.
- **Administration** : boxes (ajout, désactivation, suppression), blocage d’un box ou d’un créneau, horaires d’ouverture, durée standard (33 ou 45 min), thèmes et difficultés du questionnaire, sections et champs du formulaire KYC, utilisateurs, journal des actions, paramètres généraux.
- **Suivi** : évaluation 0–10 par difficulté à chaque séance, pré-remplie depuis la séance précédente, première séance comme référence, graphiques et rapport PDF.

Les règles de réservation sont appliquées **dans la base de données** (triggers PostgreSQL) : elles ne peuvent pas être contournées.

## Mise en place

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → coller et exécuter le contenu de [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Sign In / Providers → Email** : désactiver « Allow new users to sign up » (les comptes sont créés par l’administrateur).
4. **Project Settings → API** : récupérer l’URL, la clé `anon` et la clé `service_role`.

### 2. Variables d’environnement

Copier `.env.local.example` en `.env.local` et renseigner les trois valeurs. Sur Vercel : **Settings → Environment Variables** avec les mêmes noms, puis redéployer.

### 3. Premier administrateur

```bash
npm install
npm run create-user -- admin@exemple.ma "MotDePasse!2026" admin "Nom Prénom"
```

Les autres comptes (administrateurs ou gestionnaires) se créent ensuite depuis **Administration → Utilisateurs**.

### 4. Reprise des anciennes données (optionnel)

Si l’ancienne version (stockage navigateur) a été utilisée, se connecter en administrateur **sur le même navigateur** : un bandeau propose l’import (aussi disponible dans **Administration → Paramètres**).

## Développement

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) · Framer Motion · jsPDF
