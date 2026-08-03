# NeuroÉquilibre — Centre de Neural Feedback

Application web pour la gestion d'un centre de neurofeedback.

## Déploiement Vercel (recommandé)

**Supabase n'est pas obligatoire.** L'app fonctionne dès maintenant avec le stockage navigateur (localStorage) — aucune variable d'environnement requise.

### Étapes

1. Pousser le code sur GitHub
2. Importer le projet sur [vercel.com](https://vercel.com) → **Add New Project**
3. Framework : **Next.js** (détecté automatiquement)
4. Cliquer **Deploy** — c'est tout

```bash
# Ou via CLI
npm i -g vercel
vercel
```

### Données : localStorage vs Supabase

| | **localStorage (actuel)** | **Supabase** |
|---|---|---|
| Config requise | Aucune | Projet + variables d'env |
| Où sont les données | Navigateur de l'utilisateur | Cloud (PostgreSQL) |
| Multi-appareils | Non | Oui |
| Sauvegarde / restauration | Non (effacer le cache = perte) | Oui |
| Idéal pour | Demo, test, usage solo sur 1 poste | Production clinique |

**Conclusion :** vous pouvez déployer sur Vercel **sans Supabase** pour tester ou un usage solo. Pour un centre avec plusieurs praticiens ou une vraie persistance cloud, configurez Supabase plus tard (`supabase/schema.sql` + variables d'env).

Variables d'environnement Supabase (optionnelles sur Vercel) :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Développement local

```bash
npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Fonctionnalités

- Tableau de bord admin
- Formulaire KYC client
- Réservation de séances (validation chronologique)
- Questionnaire NeuroÉquilibre (3 niveaux)
- Suivi d'évolution + export PDF

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · jsPDF
