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
- **Clients** : code client unique attribué automatiquement (NE-0001, NE-0002…), modification des informations par toute l’équipe, origine (« Comment le client est venu ? », liste gérée par l’administrateur).
- **Statut actif / inactif** : calculé automatiquement (actif tant qu’un pack est en cours ou qu’une séance est prévue), avec possibilité de forcer le statut à partir d’une date ; historique conservé.
- **Packs** : catalogue géré par l’administrateur (nom, nombre de séances, tarif de référence). Le gestionnaire attribue un pack à un client avec séances offertes, montant convenu, avance (montant + date) et règlements suivants ; le reste à payer est calculé automatiquement. Les séances sont décomptées des packs dans l’ordre d’achat.
- **Messages** : depuis la fiche client, WhatsApp ou e-mail à partir des modèles « Confirmation de rendez-vous », « Rappel de rendez-vous » et « Joyeux anniversaire » ; messages groupés (fête nationale, promotions, informations) rédigés par l’administrateur et envoyés par le gestionnaire (WhatsApp guidé numéro par numéro, ou e-mail en copie cachée). Chaque envoi est journalisé.
- **États** : anniversaires à venir (à partir d’aujourd’hui, mois par mois), clients actifs / inactifs à une date choisie, packs vendus avec encaissements et impayés par période (mois, trimestre, année, période personnalisée). Export CSV et PDF.

Les règles de réservation et de règlement (pas de trop-perçu, pas de date future, montant convenu ≥ montant réglé) sont appliquées **dans la base de données** (triggers PostgreSQL) : elles ne peuvent pas être contournées.

> **Messages** : la version actuelle ouvre WhatsApp / la messagerie avec le texte prêt à envoyer (gratuit, aucun compte requis). Le code est structuré pour brancher plus tard une API d’envoi automatique (WhatsApp Business, service d’e-mail) — voir `src/lib/messaging.ts`.

## Mise en place

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → coller et exécuter, dans cet ordre :
   1. [`supabase/schema.sql`](supabase/schema.sql)
   2. [`supabase/migrations/002_clients_packs_messages.sql`](supabase/migrations/002_clients_packs_messages.sql) (codes clients, statuts, packs, règlements, messages)

   Si la base existe déjà, n’exécuter que la migration 002 (une seule fois) : les clients existants reçoivent leur code par ordre de création. Tant qu’elle n’est pas exécutée, l’application affiche un écran l’indiquant.
3. **Authentication → Sign In / Providers → Email** : désactiver « Allow new users to sign up » (les comptes sont créés par l’administrateur).
4. **Project Settings → API** : récupérer l’URL, la clé `anon` et la clé `service_role`.

### 2. Variables d’environnement

Copier `.env.local.example` en `.env.local` et renseigner les trois valeurs. Sur Vercel : **Settings → Environment Variables** avec les mêmes noms, puis redéployer.

### 3. Premier administrateur

Node.js 22 ou plus récent est requis.

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
