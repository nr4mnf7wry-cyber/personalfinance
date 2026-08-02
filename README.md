# Budget & Patrimoine

Application de suivi financier personnel : saisie mensuelle, dashboard, et suivi des investissements.

Stack : **Next.js 14 (App Router)** · **Vercel Postgres (Neon)** · **Prisma** · **NextAuth (credentials)** · **Recharts** · **Finnhub** (cours boursiers) · **xlsx** (import Excel)

## 1. Installation locale

```bash
npm install
cp .env.example .env
```

Remplis `.env` :
- `DATABASE_URL` / `DIRECT_URL` : depuis Vercel Postgres (Storage → créer une base Postgres → onglet `.env.local`)
- `NEXTAUTH_SECRET` : `openssl rand -base64 32`
- `NEXTAUTH_URL` : `http://localhost:3000` en local
- `FINNHUB_API_KEY` : clé gratuite sur https://finnhub.io (60 requêtes/minute gratuites)

```bash
npx prisma db push   # crée les tables
npm run dev           # http://localhost:3000
```

## 2. Déploiement sur Vercel

1. Pousse ce projet sur un repo GitHub.
2. Sur [vercel.com](https://vercel.com) → **New Project** → importe le repo.
3. Onglet **Storage** → **Create Database** → Postgres (Neon) → connecte-la au projet (les variables `DATABASE_URL`/`DIRECT_URL` sont injectées automatiquement).
4. Ajoute dans **Settings → Environment Variables** :
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` = url de production (ex: `https://ton-projet.vercel.app`)
   - `FINNHUB_API_KEY`
5. Déploie. Chaque push sur `main` redéploie automatiquement (déploiement continu déjà natif à Vercel + GitHub).
6. Après le premier déploiement, exécute une fois `npx prisma db push` (en local, pointé sur la base de prod) pour créer les tables — ou ajoute-le au script `build` (déjà fait avec `postinstall`/`build` qui lance `prisma generate`; pense à lancer `db push` manuellement au moins une fois).

## 3. Structure du projet

```
app/
  login/, register/        pages d'authentification
  input/                   saisie mensuelle (formulaire, historique, import Excel)
  dashboard/                vue mensuelle, évolution, annuelle, YoY, widget investissements
  investments/              positions, cours live, historique, allocation
  api/
    auth/[...nextauth]/     NextAuth
    register/               création de compte
    entries/                CRUD des lignes budgétaires mensuelles
    investments/             transactions boursières
    stock-price/             proxy Finnhub (cours en temps quasi réel)
    import-excel/            parsing + mapping automatique d'un .xlsx
lib/
  categories.ts             source unique de vérité des catégories/groupes
  aggregate.ts               calculs (totaux mensuels, YoY, cumul YTD, moyenne mobile...)
  auth.ts, prisma.ts
components/
  InputClient.tsx, HistoryTable.tsx, ExcelImport.tsx
  DashboardClient.tsx, StatTile.tsx
  InvestmentsClient.tsx
  BlurToggle.tsx             toggle "flouter les chiffres" (CSS blur), contexte React
prisma/schema.prisma
```

## 4. Notes d'implémentation

- **Catégories** : centralisées dans `lib/categories.ts`. Pour ajouter/renommer un poste, modifie uniquement ce fichier — formulaire, dashboard et import Excel suivent automatiquement.
- **Lien Saisie → Investissements** : quand tu remplis la catégorie "Investissement" en vue détaillée, un encart apparaît pour préciser ticker/quantité/prix. À l'enregistrement, une `Transaction` est créée et liée à la ligne (`MonthEntry.transactionId`), donc traçable jusqu'à `/investments`.
- **Fusion visuelle du tableau historique** : `HistoryTable.tsx` calcule des "runs" de valeurs consécutives identiques par catégorie et les affiche avec `colSpan`.
- **Flouter les chiffres** : `BlurProvider` pose une classe CSS sur un conteneur ; tout montant doit être rendu via le composant `<Money value={...} />` pour hériter du flou.
- **Import Excel** : `/api/import-excel` ne fait *que* l'aperçu (aucune écriture) ; la confirmation appelle ensuite `/api/entries` pour chaque mois détecté.
- **Cours boursiers** : proxy `/api/stock-price` avec cache 60s pour ménager le quota gratuit Finnhub. Pour basculer sur Alpha Vantage, voir le commentaire en bas de ce fichier.

## 5. Pistes d'extension

- Heatmap dépenses × catégorie × année (actuellement : bar chart annuel groupé — une vraie heatmap peut être ajoutée avec une grille colorée custom).
- Édition/suppression fine d'une transaction d'investissement depuis l'UI (l'API le permet déjà via Prisma, il manque juste les boutons).
- Regroupement des sous-catégories dans le formulaire détaillé (le modèle Prisma les supporte déjà via `subCategory`).
- Tests (Vitest/Playwright) et validation serveur plus poussée avec `zod` sur toutes les routes.
