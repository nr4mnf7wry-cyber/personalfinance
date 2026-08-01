# Mes Finances

Plateforme personnelle de suivi financier : saisie mensuelle des revenus et
dépenses, dashboard de ratios mensuels/annuels/YoY, et suivi d'un portefeuille
d'actions cotées en bourse.

## Stack

- [Next.js 14](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) + Postgres (pensé pour **Vercel Postgres / Neon**)
- [NextAuth](https://next-auth.js.org) (email + mot de passe, compte unique)
- [Recharts](https://recharts.org) pour les graphiques
- [SheetJS (xlsx)](https://sheetjs.com) pour l'import/export Excel
- API de cours boursiers : [Finnhub](https://finnhub.io) (prioritaire) ou [Alpha Vantage](https://www.alphavantage.co) (fallback)

## Structure du projet

```
src/
  app/
    login/                  page de connexion
    (app)/dashboard/        dashboard (KPIs, graphiques, YoY)
    (app)/input/            saisie mensuelle + import Excel + historique
    (app)/investments/      portefeuille d'actions
    (app)/settings/         catégories, devise, export
    api/                    routes API (entries, dashboard, investments, ...)
  components/                composants React par section
  lib/                       logique métier (calculs, catégories, excel, stockApi...)
prisma/
  schema.prisma              modèle de données
  seed.ts                    crée ton compte + les catégories par défaut
```

## Mise en route (en local)

1. **Dépendances**
   ```bash
   npm install
   ```

2. **Variables d'environnement** — copie `.env.example` en `.env` et remplis :
   - `DATABASE_URL` : connecte une base Postgres (voir section Vercel ci-dessous, ou une base Postgres locale/Neon pour tester)
   - `NEXTAUTH_SECRET` : génère une valeur avec `openssl rand -base64 32`
   - `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` : tes identifiants de connexion
   - `FINNHUB_API_KEY` ou `ALPHA_VANTAGE_API_KEY` : au moins une des deux pour les cours boursiers (comptes gratuits)

3. **Créer les tables** (la façon la plus simple, sans historique de migration) :
   ```bash
   npx prisma db push
   ```
   *(alternative avec historique de migrations : `npx prisma migrate dev --name init`)*

4. **Créer ton compte + les catégories par défaut** :
   ```bash
   npm run seed
   ```

5. **Lancer en local** :
   ```bash
   npm run dev
   ```
   → http://localhost:3000, connecte-toi avec `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.

## Déploiement sur GitHub + Vercel

1. **GitHub** — crée un nouveau repo (vide, sans README) sur github.com, puis depuis ce dossier :
   ```bash
   git remote add origin git@github.com:<ton-user>/finance-tracker.git
   git push -u origin main
   ```

2. **Vercel** — sur [vercel.com](https://vercel.com), "Add New Project" → importe le repo GitHub.

3. **Base de données** — dans l'onglet *Storage* du projet Vercel, crée une base **Postgres** (Neon, intégré nativement). Vercel ajoute automatiquement `DATABASE_URL` (et variantes) aux variables d'environnement du projet.

4. **Variables d'environnement** — dans *Settings → Environment Variables*, ajoute :
   - `NEXTAUTH_SECRET` (même méthode que ci-dessus)
   - `NEXTAUTH_URL` = l'URL de ton déploiement (ex: `https://mes-finances.vercel.app`)
   - `SEED_USER_EMAIL`, `SEED_USER_NAME`, `SEED_USER_PASSWORD`
   - `FINNHUB_API_KEY` et/ou `ALPHA_VANTAGE_API_KEY`
   - `DEFAULT_CURRENCY` (optionnel, défaut `EUR`)

5. **Déploie**. Vercel exécute `npm install` puis `npm run build` (qui lance `prisma generate`).

6. **Créer les tables + ton compte sur la base de prod** — depuis ta machine, avec `DATABASE_URL` de prod dans ton `.env` local (récupérable dans Vercel → Storage → `.env.local` tab) :
   ```bash
   npx prisma db push
   npm run seed
   ```

7. Ton site est en ligne, protégé par login. Connecte-toi et commence par **Paramètres** (vérifier la devise et les catégories), puis **Saisie** pour ton premier mois.

## Import de ton historique Excel

Page **Saisie → Importer un Excel**. Le fichier attendu contient :
- une feuille `Entries` : colonnes `Année`, `Mois`, `Groupe` (Revenus / Dépenses fixes /
  Dépenses variables / Épargne), `Catégorie`, `Montant`, `Note` (optionnelle)
- une feuille `StartingBalance` (optionnelle) : `Année`, `Mois`, `Solde de départ`

Télécharge le modèle vierge depuis cette même fenêtre (pré-rempli avec tes
catégories actuelles) pour retrouver exactement ce format — le plus simple est
d'y recopier ton Excel existant. L'import crée automatiquement toute catégorie
qui n'existe pas encore. **Paramètres → Export des données** permet de
retélécharger toutes tes données au même format à tout moment (sauvegarde).

## Fonctionnement des pages

- **Saisie** (`/input`) : un mois à la fois. Les coûts fixes proposent en un
  clic la valeur du dernier mois renseigné. Bascule *Détaillée / Catégories
  seulement* pour replier les sous-catégories. Le bouton *Voir l'historique*
  affiche un tableau mois × catégories avec fusion des cellules identiques
  consécutives. Le montant "Investissement" propose de le lier directement à
  un achat d'actions (ticker, quantité, prix), visible ensuite sur la page
  Investissements.
- **Dashboard** (`/dashboard`) : chiffres clés du mois, répartition des
  dépenses, évolution du solde net et des flux dans le temps, taux d'épargne
  lissé, comparaison année sur année par catégorie, et un aperçu du
  portefeuille d'investissements.
- **Investissements** (`/investments`) : positions courantes avec cours en
  direct et plus/moins-value, répartition par titre, capital investi dans le
  temps, historique des transactions (ajout manuel ou lié depuis la Saisie).
- **Paramètres** (`/settings`) : devise, gestion des catégories (ajout /
  renommage / archivage), export Excel complet.

## Confidentialité

Le login (email + mot de passe) protège l'accès au site une fois déployé. Le
bouton 👁 dans la barre de navigation floute tous les montants à l'écran
(utile en partage d'écran) — préférence mémorisée dans le navigateur.

## Notes techniques

- Modèle de coût moyen pondéré pour le calcul des plus/moins-values sur les
  ventes partielles d'une position.
- Les cours boursiers sont mis en cache 5 minutes côté serveur pour rester
  sous les quotas gratuits des API.
- Compte unique : il n'y a pas de page d'inscription publique par sécurité —
  les comptes se créent via `npm run seed`.
