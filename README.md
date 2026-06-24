# AMD Internal OS — Adventum Pharma

> Logiciel interne centralisé (ERP léger) pour piloter les pôles **Regulatory, Sponsoring,
> Budgets, Congrès, Ventes, Logistique PCH, Promotion médicale et Business Development**
> d'Adventum Pharma.

Interface premium (type Linear / Notion / Airtable), rapide, responsive et sécurisée, avec
un contrôle d'accès fin **RBAC + row-level** appliqué côté serveur.

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

# 3. Base de données : migrations + données de démonstration
npm run db:migrate     # applique le schéma
npm run db:seed        # crée les comptes & données de démo

# 4. Lancement
npm run dev            # http://localhost:3000
```

### Comptes de démonstration

Tous les comptes utilisent le mot de passe **`password123`** :

| Email | Rôle |
|-------|------|
| `direction@adventum.dz` | Direction (voit tous les pôles) |
| `regulatory@adventum.dz` | Head of Regulatory (toutes les molécules) |
| `assistante1@adventum.dz` | Assistante (uniquement ses DCI assignées) |
| `assistante2@adventum.dz` | Assistante (autres DCI) |
| `logistique@adventum.dz` | Responsable Logistique |
| `commercial1@adventum.dz` | Commercial (ses ventes uniquement) |
| `delegue1@adventum.dz` | Délégué médical Alger (ses médecins/visites) |
| `bd@adventum.dz` | Manager Business Development |
| `finance@adventum.dz` | Responsable Budget |
| `superadmin@adventum.dz` | Super Admin |

> Connectez-vous avec `assistante1` puis `regulatory` pour constater le **masquage des lignes** Regulatory.

---

## ☁️ Déploiement (Vercel + Supabase)

1. **Base de données** — créez un projet [Supabase](https://supabase.com) et récupérez la chaîne
   de connexion (pooler, port 6543). Renseignez `DATABASE_URL`.
2. **Vercel** — importez le repo. Variables d'environnement à définir :
   - `DATABASE_URL`
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` (URL de production)
   - *(optionnel)* `STORAGE_*` pour le stockage S3/R2/Supabase, `MAX_UPLOAD_MB`, `SMTP_*`
3. **Migrations** — appliquez le schéma sur la base de prod :
   ```bash
   DATABASE_URL=... npx prisma migrate deploy
   DATABASE_URL=... npm run db:seed   # optionnel : données de démo
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
| `npm run db:seed` | Données de démonstration |
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
    └── seed.ts          # données de démonstration
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
