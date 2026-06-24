# AMD Internal OS — Adventum Pharma

> Logiciel interne centralisé (ERP léger) pour piloter les pôles **Regulatory, Sponsoring,
> Budgets, Congrès, Ventes, Logistique PCH, Promotion médicale et Business Development**
> d'Adventum Pharma.

Interface premium (type Linear / Notion / Airtable), rapide, responsive et sécurisée, avec
un contrôle d'accès fin **RBAC + row-level** appliqué côté serveur.

> 🐍 **Deux éditions disponibles :**
> - **Next.js + PostgreSQL** (ce dossier racine) — production, déploiement Vercel/Supabase.
> - **Streamlit + SQLite** ([`streamlit_app/`](streamlit_app/)) — lancement immédiat en Python,
>   base autonome. Voir [`streamlit_app/README.md`](streamlit_app/README.md).

---

## ✨ Fonctionnalités

| Pôle | Points clés |
|------|-------------|
| **Dashboard** | KPI temps réel par pôle, courbes, donut, barres, progress bars — adaptés au rôle |
| **Regulatory** | Molécules/DCI, **workflow 17 étapes** configurable, documents par molécule, timeline, commentaires, audit |
| **Sponsoring** | Demandes, workflow de validation (routage Direction si montant > seuil), accepté/refusé/payé |
| **Budgets** | Prévu vs réel, consommé/restant, alertes de dépassement, vue par département |
| **Congrès internationaux / nationaux** | Organisation, budgets, stands/symposiums, statuts |
| **Ventes** | CA pharma/PCH, **import CSV / export Excel**, KPI, statuts paiement & livraison |
| **Logistique PCH** | Commandes, **dates estimées vs réelles**, dédouanement, timeline, alertes retard |
| **Promotion médicale** | Médecins, visites & tournées **scopées par délégué**, objectifs |
| **Business Development** | **Pipeline Kanban**, scoring, suivi fournisseurs |
| **Documents** | Bibliothèque centralisée, filtrée selon les accès, versioning, confidentialité |
| **Notifications** | Échéances, validations, retards, assignations |
| **Administration** | Utilisateurs, rôles, **journal d'audit complet**, paramètres |

Transverses sur chaque module : table avancée (recherche, tri, pagination, colonnes), filtres,
badges de statut/priorité colorés, export CSV, upload drag & drop, commentaires, **audit log**.

---

## 🧱 Stack technique

- **Next.js 14** (App Router) · **React 18** · **TypeScript** (strict)
- **Tailwind CSS** + design system maison (style shadcn/ui)
- **PostgreSQL** + **Prisma** ORM
- **Auth.js (NextAuth v5)** — credentials, sessions JWT, hash bcrypt
- **Recharts** (graphiques) · **lucide-react** (icônes)
- Stockage fichiers **S3-compatible** (Supabase Storage / Cloudflare R2 / S3), fallback local
- Déployable sur **Vercel + Supabase/Postgres** (ou Docker)

---

## 🔐 Sécurité & RBAC

Deux couches, **toutes appliquées côté serveur** :

1. **Permissions module/action** — matrice statique typée (`src/lib/rbac.ts`), fonction `can(role, module, action)`.
2. **Row-level scoping** — les helpers `scope*` renvoient des filtres Prisma `where`, de sorte que les
   lignes non autorisées **ne sont jamais envoyées au client** (filtrées en base).

> Exemple : la **Head of Regulatory** voit toutes les molécules ; une **assistante** ne voit que les
> DCI qui lui sont assignées (`assignedUsers` / `responsibleId` / `assistantId`) — les autres lignes
> sont **totalement masquées**, pas seulement désactivées.

Autres mesures : authentification obligatoire (middleware), validation serveur (zod), upload contrôlé
(extension + taille), download protégé par vérification d'accès, en-têtes de sécurité (CSP-friendly,
X-Frame-Options, nosniff), **audit log** (qui / quoi / ancienne → nouvelle valeur / date / module).

### Rôles

`SUPER_ADMIN`, `DIRECTION`, `HEAD_OF_REGULATORY`, `REGULATORY_ASSISTANT`, `HEAD_OF_SALES`,
`SALES_USER`, `LOGISTICS_MANAGER`, `MEDICAL_PROMOTION_MANAGER`, `MEDICAL_DELEGATE`,
`BUSINESS_DEVELOPMENT_MANAGER`, `FINANCE_BUDGET_MANAGER`, `VIEWER`.

---

## 🚀 Démarrage local

### Prérequis
- Node.js ≥ 18
- Une base **PostgreSQL** accessible

### Installation

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env
#   → renseignez DATABASE_URL et AUTH_SECRET (openssl rand -base64 32)

# 3. Base de données : migrations + compte admin initial (aucune donnée de démo)
npm run db:migrate
ADMIN_EMAIL="vous@exemple.com" ADMIN_PASSWORD="MotDePasse123!" npm run db:bootstrap

# 4. Lancement
npm run dev            # http://localhost:3000
```

### Premier compte

**Aucune donnée simulée** : `db:bootstrap` crée uniquement votre **Super Admin** (depuis
`ADMIN_EMAIL` / `ADMIN_PASSWORD`, défaut `admin@adventum.dz` / `ChangeMe123!`).

Connectez-vous, puis dans **Administration** :

- **créez les comptes** de votre équipe (mot de passe temporaire, changé à la 1ʳᵉ connexion) ;
- **attribuez/retirez les accès** par onglet, par action et par **ligne** pour chaque utilisateur
  (page « Gérer » d'un utilisateur → matrice d'accès) ;
- suivez **connexions, pages visitées, temps, appareil, IP/localisation** et gérez les **sessions**.

---

## ☁️ Déploiement — Render (recommandé)

Un **Blueprint** [`render.yaml`](render.yaml) provisionne **l'app Next.js + une base PostgreSQL gérée**,
applique les migrations et crée ton compte Super Admin (aucune donnée de démo).

1. Sur [dashboard.render.com](https://dashboard.render.com) : **New +  →  Blueprint**.
2. Connecte ce dépôt et **sélectionne la branche `claude/hopeful-goodall-phd0nb`**.
3. Renseigne les variables demandées : **`ADMIN_EMAIL`**, **`ADMIN_PASSWORD`** (ta première connexion),
   `ADMIN_NAME`. (`DATABASE_URL` et `AUTH_SECRET` sont gérés automatiquement.)
4. **Apply**. Render crée la base, exécute `prisma migrate deploy` + `db:bootstrap`, build et démarre.

→ Ouvre l'URL → connecte-toi avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` → crée tes comptes dans **Administration**.

> ⚠️ Plan gratuit : la base Postgres expire après ~30 jours et le service se met en veille
> (1ᵉʳ accès ensuite ~50 s). Passe en plan payant pour une base durable + service always-on.

### Vercel + Postgres (alternative)

1. Base **Postgres** (Neon/Supabase) → `DATABASE_URL`.
2. **Vercel** : importer le repo. Variables : `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`),
   `AUTH_TRUST_HOST=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Migrations + admin :
   ```bash
   DATABASE_URL=... npx prisma migrate deploy
   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:bootstrap
   ```
4. Le `build` exécute automatiquement `prisma generate`.

### Stockage des fichiers

Par défaut (MVP), les fichiers sont écrits sous `./uploads` (dev). En production, configurez
`STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY`
et implémentez l'adaptateur S3 dans [`src/lib/storage.ts`](src/lib/storage.ts) (point d'extension
balisé). La couche métier (upload contrôlé, versioning, permissions, download sécurisé) est déjà en place.

---

## 📜 Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm run start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run test` | Tests (Vitest) |
| `npm run db:migrate` | Migrations de développement |
| `npm run db:deploy` | Applique les migrations (prod) |
| `npm run db:bootstrap` | Crée le Super Admin initial |
| `npm run db:reset` | Réinitialise la base |

---

## 🗂️ Architecture

```
src/
├── app/
│   ├── (auth)/login/         # page de connexion
│   ├── (app)/                # shell authentifié (sidebar + topbar)
│   │   ├── dashboard/        # KPI globaux par pôle
│   │   ├── regulatory/       # liste + détail (steps, docs, commentaires)
│   │   ├── sponsoring/ …     # un dossier par pôle
│   │   └── admin/            # utilisateurs, rôles, audit
│   └── api/
│       ├── auth/[...nextauth]/   # handlers Auth.js
│       └── documents/[id]/       # download sécurisé
├── components/   # ui/ (design system), shared/ (DataTable, badges…), layout/, dashboard/, documents/
├── lib/
│   ├── rbac.ts          # matrice de permissions + scoping row-level
│   ├── auth.ts          # configuration NextAuth
│   ├── session.ts       # requireUser / requireModule (gardes serveur)
│   ├── audit.ts         # journal d'audit
│   ├── entity-access.ts # contrôle d'accès par ligne (polymorphe)
│   ├── actions/         # server actions par module
│   └── queries/         # requêtes agrégées (dashboard, documents)
└── prisma/
    ├── schema.prisma    # 22 modèles, enums, index, relations
    └── bootstrap.ts     # crée le Super Admin initial (aucune donnée de démo)
```

---

## ✅ Critères d'acceptation (couverture)

1. ✅ Connexion utilisateur — Auth.js + bcrypt
2. ✅ La Direction voit tous les modules — RBAC
3. ✅ La Head of Regulatory voit toutes les lignes — `scopeRegulatory` (vue globale)
4. ✅ Une assistante ne voit que ses DCI — scoping row-level (lignes masquées)
5. ✅ Documents uploadés par molécule — upload drag & drop + bibliothèque
6. ✅ Commandes PCH suivies (dates estimées/réelles) — module Logistique + timeline
7. ✅ Sponsoring validé/refusé — workflow de décision
8. ✅ Budgets consommé/restant — module Budgets + alertes
9. ✅ Ventes importables/exportables — import CSV + export
10. ✅ Délégués voient leurs tournées — visites scopées
11. ✅ Pipeline BD clair — Kanban
12. ✅ Actions importantes loggées — audit log
13. ✅ Interface rapide, moderne, claire
14. ✅ Code propre, typé, testé, déployable

---

© 2026 Adventum Pharma — AMD Internal OS · v0.1
