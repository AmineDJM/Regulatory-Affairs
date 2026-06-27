<div align="center">

# 🏥 AMD Internal OS — Adventum Pharma

**L'« OS d'entreprise » d'un laboratoire pharmaceutique algérien : un seul outil connecté pour piloter 100 % de l'activité.**

Regulatory · Sponsoring · Budgets & Finances · Congrès & Événements · Ventes · Logistique & Marchés PCH ·
Promotion médicale · Information médicale · Business Development · RH · Messagerie · Courrier · Drive · Assistant IA

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?logo=prisma)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-managed-336791?logo=postgresql)](https://www.postgresql.org)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-000)](https://authjs.dev)
[![Deploy](https://img.shields.io/badge/Render-Blueprint-46e3b7?logo=render)](https://render.com)

</div>

---

## 📑 Sommaire

- [Vision & principes](#-vision--principes)
- [Aperçu en un coup d'œil](#-aperçu-en-un-coup-dœil)
- [Stack technique](#-stack-technique)
- [Panorama des modules](#-panorama-des-modules-31-routes)
  - [Pilotage](#pilotage) · [Pôles métier](#pôles-métier) · [Transverse](#transverse) · [Système](#système) · [Externe](#externe)
- [Sécurité & contrôle d'accès (RBAC)](#-sécurité--contrôle-daccès-rbac)
- [Rôles](#-rôles)
- [Workflows critiques](#-workflows-critiques)
- [Intelligence artificielle](#-intelligence-artificielle-claude--whisper)
- [Messagerie temps réel](#-messagerie-interne-temps-réel)
- [Courrier — webmail intégré](#-courrier--webmail-infomaniak-intégré)
- [Édition Office (OnlyOffice)](#-édition-office-onlyoffice-auto-hébergé)
- [Démarrage local](#-démarrage-local)
- [Variables d'environnement](#-variables-denvironnement)
- [Déploiement (Render)](#-déploiement--render)
- [Base de données & migrations](#-base-de-données--migrations)
- [Scripts](#-scripts)
- [Tests & qualité](#-tests--qualité)
- [Architecture du code](#-architecture-du-code)
- [Feuille de route](#-feuille-de-route)
- [Conventions](#-conventions--contribution)

---

## 🎯 Vision & principes

**AMD Internal OS** est le logiciel interne **unique** d'**Adventum Pharma**. Il remplace la dispersion
e-mails / Excel / WhatsApp par **un seul environnement de travail connecté**.

- 🧩 **Tout dans un seul outil connecté** — un module en alimente un autre (une validation crée un ordre de dépense, qui devient une écriture comptable, etc.).
- 📊 **100 % digitalisé & data-driven**, **zéro donnée simulée** : l'admin et les utilisateurs saisissent la vraie donnée.
- 🔐 **Accès ultra-granulaire piloté par l'admin** : par **utilisateur × onglet × action × ligne**.
- 🇩🇿 **Contexte algérien** : devise **DZD**, fiscalité (G50, IRG, IBS, CNAS, CASNOS), réglementaire **AMM / ANPP**, client institutionnel **PCH** (Pharmacie Centrale des Hôpitaux — marchés publics).
- 🏢 **L'unique poste de travail de l'employé** : Drive, messagerie interne, **courrier (e-mail)**, **édition Office collaborative**, assistant IA — tout intégré.

---

## 👀 Aperçu en un coup d'œil

| | |
|---|---|
| **31** routes applicatives | **14** rôles métier |
| **72** modèles Prisma · **76** enums | **31** migrations |
| RBAC **module × action × ligne** appliqué **côté serveur** | Drive & mots de passe **chiffrés AES-256-GCM** |
| Assistant IA (boucle agent Claude) | Rapports terrain **vocaux** (Whisper → Claude) |
| Messagerie interne temps réel | Webmail Infomaniak intégré |
| Édition Word/Excel/PowerPoint (OnlyOffice) | Aperçu in-app PDF/Word/Excel/PPT, sans dépendance externe |

---

## 🧱 Stack technique

| Couche | Choix |
|---|---|
| **Framework** | Next.js 14.2 (App Router, **React Server Components**, **Server Actions**) |
| **Langage** | TypeScript strict · React 18 |
| **Base de données** | PostgreSQL + **Prisma 5.22** |
| **Auth** | **Auth.js / NextAuth v5** (Credentials, JWT, bcrypt, `trustHost`) + sessions révocables en base |
| **UI** | Tailwind CSS + **design system maison** (style shadcn/ui) · `lucide-react` · **Recharts** |
| **Documents** | Aperçu **embarqué** : `mammoth` (Word), `xlsx`/SheetJS (Excel), `jszip` (PowerPoint), iframe (PDF) |
| **E-mail** | `imapflow` (IMAP) · `nodemailer` (SMTP) · `mailparser` (MIME) |
| **IA** | Claude (Anthropic) pour le texte/agent · Whisper (OpenAI) pour la transcription vocale |
| **Édition Office** | OnlyOffice Document Server auto-hébergé (JWT HS256) |
| **QR / billetterie** | `qrcode` |
| **Déploiement** | **Render** (Web Service + PostgreSQL managé, Blueprint `render.yaml`) |

> Tout secret (clés IA, secrets JWT, mots de passe) est **strictement côté serveur** — jamais exposé au navigateur.

---

## 🗺️ Panorama des modules (31 routes)

La navigation est organisée en 4 groupes. **Trois paires sont fusionnées** en un seul item de sidebar avec
**onglets internes** (sans rien retirer) : **Finances** (Finances · Espace comptable), **Congrès**
(Internationaux · Nationaux), **Logistique & Stocks PCH** (Logistique · Stocks). Un onglet n'apparaît que si
l'utilisateur y a accès (RBAC asymétrique).

### Pilotage

| Module | Route | Description |
|---|---|---|
| **Mon travail** *(Action Center)* | `/mon-travail` | Agrège, selon les droits : tâches, demandes admin à traiter, validations en attente, paiements à régler, dossiers Regulatory, congés RH, congrès à valider/analyser, **directives**, **pièces de support**, **info médicale**, notifications. Vues en retard / bientôt / urgent. |
| **Mon espace** | `/mon-espace` | Tâches perso, congés/absences, **avances sur salaire** (self-service), activité, accès rapides. |
| **Messagerie** | `/messages` | Messagerie interne complète (DM / groupes / canaux). Badge non-lus live. → [détails](#-messagerie-interne-temps-réel) |
| **Courrier** | `/courrier` | **Webmail Infomaniak** intégré par utilisateur (IMAP + SMTP). → [détails](#-courrier--webmail-infomaniak-intégré) |
| **Directives** | `/directives` | **Instructions priorisées de la Direction** vers une personne ou un rôle entier, avec échéance, statut et **fil d'échange**. |
| **Assistant IA** | `/assistant` | Chatbot interne (boucle agent Claude) **scopé par les droits** de l'utilisateur, qui prépare des actions à confirmer. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Mon dossier RH** | `/mon-dossier` | Documents RH personnels (contrats, bulletins, attestations) + **demandes RH** (attestation de travail, CNAS, relevé d'émoluments, titre de congé, ordre de mission, note de frais…). Accès strict à ses propres documents. |
| **Dashboard** | `/dashboard` | KPIs & graphiques adaptés au rôle. |

### Pôles métier

| Module | Route | Description |
|---|---|---|
| **Regulatory** | `/regulatory` | Dossiers **AMM / ANPP**, **workflow 17 étapes**, documents par molécule, commentaires, champs personnalisés. Catégorie **Médicament / Dispositif médical**. Carte **« Vue fournisseur »** (pilote le portail externe). |
| **Sponsoring** | `/sponsoring` | Demandes avec **double validation + appel** et **confidentialité du chef de produit**. → [workflow](#sponsoring--double-validation--appel--confidentialité) |
| **Budgets** | `/budgets` | **Enveloppe budgétaire** : la Direction définit un budget total sur une période, le répartit en **catégories**, et la **consommation réelle** se calcule depuis les dépenses attribuées. Barres de santé (Maîtrisé / À surveiller / Dépassé), non-alloué, attribution des dépenses en un clic. |
| **Finances** | `/finances` | Trésorerie, livre, **paie**, **ordres de dépense**. |
| **Espace comptable** | `/comptabilite` | Synthèse légère : à régler, recettes attendues, résultat mensuel. |
| **RH** | `/rh` | Employés, contrats, congés, avances, dépôt de documents et traitement des demandes RH. |
| **Congrès internationaux** | `/congress-international` | Demande de prise en charge (double validation). |
| **Événements nationaux** | `/congress-national` | Idem, avec **type d'événement** (congrès, séminaire, table ronde, webinaire, atelier, symposium, staff…). |
| **Events** | `/events` | Gestion d'événements **de bout en bout** : statuts, **billetterie publique** (`/inscription/[id]`), **QR code par participant**, **check-in par scan**, taux de présence, export CSV. |
| **Ventes** | `/sales` | CA pharma/PCH, **import CSV**, type **Produit / Service**. |
| **Logistique PCH** | `/logistics` | Import / expéditions fournisseurs, dates estimées vs réelles, dédouanement. |
| **PCH — Marchés** | `/pch` | **Marchés publics gagnés** : appels d'offres → **bons de commande** + **caution** (alertes d'expiration). → [détails](#pch--marchés-publics) |
| **Stocks PCH** | `/stocks` | Mouvements (entrée / sortie / ajustement) + niveau courant par produit. |
| **Rapports terrain** | `/field-reports` | **Rapports vocaux IA** des délégués : parler → transcription → analyse → relecture → validation. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Promotion médicale** | `/medical` | **Annuaire structuré** : Spécialité → Secteur (Hôpital / Libéral) → médecins, avec titre/grade, influence (jusqu'à **KOL**), potentiel de prescription. Visites & tournées **scopées par délégué**. |
| **Information médicale** | `/information-medicale` | Module du **pharmacien responsable de l'information médicale** : déclaration réglementaire **intercalée** entre la validation de la Direction et l'ordre de dépense. → [workflow](#information-médicale--déclaration-réglementaire-prim) |
| **Business Development** | `/business-development` | **Grand tableau stratégique Projet → Gamme → Produit** (~20 colonnes : marché DZD/USD, prix, volumes, concurrents, investissements & revenus A1-A3), colonnes gelées, édition en place, export CSV. |

### Transverse

| Module | Route | Description |
|---|---|---|
| **Validations** | `/validations` | **Centre de validation** configurable + **agrégation transverse** de toutes les validations en attente. → [détails](#centre-de-validation-agrégation--configurable) |
| **Drive** | `/drive` | Stockage **chiffré**, visionneuses PDF / Word / Excel / PowerPoint / images / vidéo / audio, **édition Office** (OnlyOffice), versioning, partage. |
| **Demandes administratives** | `/demandes` | « Bureau de l'assistante » : 10 types, validations, ordres de dépense, missions chauffeur. |
| **Demandes de support** | `/support` | Questions / **brochures** / **supports de visite** / PDF adressés au **directeur médical** ou au **chef de produit**, avec fil + pièces jointes. |
| **Documents · Notifications · Feedback** | `/documents` `/notifications` `/feedback` | Bibliothèque filtrée par accès · alertes · retour libre utilisateur → admin. |

### Système

| Module | Route | Description |
|---|---|---|
| **Adventum Brain** 🧠 | `/adventum-brain` | **Super Admin uniquement — le cockpit qui voit ce que les autres ne voient pas.** Une seule expérience intégrant 6 fonctions. → [détails](#-adventum-brain-cockpit-super-admin) |
| **Process Intelligence** | `/process-intelligence` | **Super Admin uniquement.** Analyse des **lenteurs & blocages** (work items sans action depuis X jours, étapes les plus lentes, top blocages, alertes), onglet **People & Workload Analyzer** (charge par personne / département), **synthèse IA** à la demande. |
| **Administration** | `/admin` | Comptes, **matrice d'accès** (onglet × action × ligne), **sessions révocables**, activité, **journal d'audit**, **champs personnalisés**, règles de validation, feedback, comptes portail fournisseur, **Vue exacte** (impersonation). |
| **Recherche globale** | `/search` | RBAC-aware + **palette ⌘K**. |

### Externe

| Module | Route | Description |
|---|---|---|
| **Portail Fournisseur** | `/portail` | **Auth totalement séparée**, isolation stricte : un fournisseur ne voit QUE ses produits `portalVisible` et **seulement les champs externes**. → [détails](#portail-fournisseur-externe-sécurisé) |

---

## 🔐 Sécurité & contrôle d'accès (RBAC)

Le contrôle d'accès est **dynamique, à deux couches, toujours appliqué côté serveur** :

1. **Permissions module × action** — matrice par rôle (`PERMISSIONS` dans `src/lib/rbac.ts`), affinée par des **overrides par utilisateur** (`UserAccess`) gérés depuis l'admin.
2. **Row-level scoping** — les helpers `scope*()` renvoient des **fragments Prisma `where`** : les lignes non autorisées **ne sont jamais envoyées au client** (filtrées en base, pas seulement masquées).

```
getAccess(user)  →  accès EFFECTIF (caché par requête)
   ├── userCan(user, module, action)      → la page/action est-elle permise ?
   ├── defaultScope(role, module)         → ALL ou ASSIGNED ?
   └── scopeRegulatory / scopeSales / scopeMedicalInfo / scopeDirectives / scopeSupport / … → where Prisma
```

> **Exemple** : la Direction voit tout (`hasGlobalView`) ; une **assistante Regulatory** ne voit que les DCI
> qui lui sont assignées ; un **délégué** ne voit que ses propres demandes de congrès et ses tournées ; un
> **chef de produit** ne voit l'analyse confidentielle que sur les dossiers qu'il instruit.

**Gardes serveur** : `requireModule(module, action)` protège chaque page, `requireUser()` chaque server action.
Toute action sensible est **ré-autorisée côté serveur** (jamais sur la confiance du client) et **journalisée**.

**Autres mesures** :
- 🔒 **Chiffrement AES-256-GCM** des blobs Drive (adressage par contenu SHA-256) et des mots de passe e-mail, clé maître dérivée de `AUTH_SECRET`.
- 🪪 **Sessions révocables** en base (déconnexion forcée d'un compte ou d'un appareil depuis l'admin).
- 👁️ **Vue exacte** (impersonation) honorée **uniquement** si la session réelle est Super Admin.
- 🧾 **Journal d'audit** complet (qui / quoi / ancienne → nouvelle valeur / date / module).
- 🛡️ **En-têtes de sécurité** : `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`.
- 🔢 Identifiants **cuid** non séquentiels ; upload contrôlé (extension + taille) ; download protégé par vérification d'accès.

---

## 👤 Rôles

| Rôle | Libellé | Portée typique |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Tout + administration + Process Intelligence |
| `DIRECTION` | Direction | **Vue globale** + valide tous les pôles |
| `HEAD_OF_REGULATORY` | Responsable Réglementaire | Regulatory (gestion complète) |
| `REGULATORY_ASSISTANT` | Assistante Réglementaire | Regulatory (lignes assignées) |
| `HEAD_OF_SALES` | Responsable Ventes | Ventes, PCH, Stocks |
| `SALES_USER` | Commercial | Ventes / PCH (ses lignes) |
| `LOGISTICS_MANAGER` | Responsable Logistique | Logistique, PCH, Stocks |
| `MEDICAL_PROMOTION_MANAGER` | Manager Promotion Médicale | Promotion médicale, Events, Congrès |
| `MEDICAL_DELEGATE` | Délégué Médical | Ses médecins, visites, demandes (scope ASSIGNED) |
| `PRODUCT_MANAGER` | **Chef de produit** | Analyse congrès & sponsoring (budget proposé **confidentiel**) |
| `BUSINESS_DEVELOPMENT_MANAGER` | Manager Business Development | Business Development |
| `FINANCE_BUDGET_MANAGER` | Responsable Finance / Budget | Finances, Budgets, ordres de dépense |
| `MEDICAL_INFO_PHARMACIST` | **Pharmacien resp. information médicale** | Déclaration réglementaire des événements validés |
| `VIEWER` | Lecteur | Lecture limitée |

> Le Super Admin attribue/retire tout via la **matrice d'accès** (`/admin/users/[id]`). Pense à créer au moins
> un **Chef de produit** (validation des congrès/sponsoring) et un **Pharmacien information médicale**.

---

## 🔄 Workflows critiques

### Congrès & sponsoring — double validation

```
Demande (délégué + budget estimé)
   → Validation PRÉLIMINAIRE (Direction) + assignation d'un Chef de produit
   → Analyse + budget proposé (Chef de produit)            ← CONFIDENTIEL
   → Validation DÉFINITIVE (Direction : budget final + commentaire)
   → [Information médicale : déclaration du pharmacien]      ← uniquement si applicable
   → Ordre de dépense → Espace comptable
```

Formulaire congrès : **médecins invités via cascade Spécialité → médecins**, **participants Adventum**
multi-sélection, budget estimé, **type d'événement** (national ET international).

### Sponsoring — double validation + appel + confidentialité

Même circuit que les congrès, **plus l'appel** : après décision, le délégué peut **faire appel** → le dossier
repart au **chef de produit** pour un **nouvel avis sans budget** → la **Direction tranche définitivement**.

> ⚠️ **Confidentialité impérative** — l'**analyse et le budget proposé par le chef de produit** (et la note de
> pré-validation) **ne sont JAMAIS visibles par le délégué**. Il ne voit que le **budget final accordé + le
> commentaire de la Direction**. Vérifié e2e sur 3 rôles, **dont la confidentialité (15/15)**.

### Information médicale — déclaration réglementaire (PRIM)

Étape **intercalée** entre la validation définitive de la Direction et l'ordre de dépense :

```
Direction valide définitivement  →  PAS encore d'ordre de dépense
   → MedicalInfoDeclaration (DIM-AAAA-NNN) notifiée au pharmacien
   → le pharmacien déclare aux autorités + EXIGE des pièces (Direction / comptable / délégué…)
   → les destinataires DÉPOSENT les pièces (visibles dans Mon travail)
   → le pharmacien VALIDE  →  l'ordre de dépense est enfin émis vers le comptable
```

Statuts : *À déclarer → Pièces demandées → Prêt à valider → Validé*. Agrégé dans le **Centre de validation** et
l'**Action Center**. La personne sollicitée peut déposer **même sans accès au module** (`canViewDeclaration`).

### Ordres de dépense — aller-retour comptable ↔ Direction

Direction valide → **ordre de dépense** → le **comptable règle** (génère l'écriture de trésorerie). Le comptable
peut **demander une révision** (manque de fonds) → l'ordre passe `REVISION_REQUESTED` et remonte à la Direction,
qui **ajuste le montant** (l'ordre repart « à régler ») **ou refuse**.

### Centre de validation (agrégation + configurable)

Le module **Validations** agrège **toutes les validations en attente** issues des autres modules (demandes admin
escaladées, sponsoring, congrès, **information médicale**) — chaque ligne renvoie vers la fiche de décision. En
plus, le Super Admin définit des **règles configurables** : module, type d'objet, montant min/max, département,
rôle, priorité → routage vers **1 ou 2 validateurs**, en **séquentiel ou parallèle**.

### PCH — Marchés publics

**Appel d'offres gagné** (réf. auto `AO-année-n`, produits, fournisseur, quantité, valeur, statut) → **caution
obligatoire** (montant, dates, alertes expirée / < 30 j) → sous-lignes = **bons de commande** (réf, qté, valeur,
date réception, date paiement).

### Portail Fournisseur (externe sécurisé)

Comptes externes **totalement séparés** (`Supplier` / `SupplierUser`, **auth distincte** cookie HMAC scopé
`/portail`, revalidé en base). Un fournisseur ne voit **QUE** ses produits `portalVisible` et **seulement les
champs externes** (jamais les autres fournisseurs, le statut/notes internes, les documents, les autres modules).

### Vue exacte (impersonation)

Le Super Admin visualise l'OS **exactement comme** un utilisateur. Cookie `amd_impersonate` honoré **uniquement**
si la session réelle est Super Admin (pas d'escalade). Bandeau permanent + « Quitter », démarrage/arrêt journalisés.

---

## 🤖 Intelligence artificielle (Claude + Whisper)

La couche IA (`src/lib/ai.ts`) est **serveur uniquement** ; sans clé, elle renvoie `configured:false` et l'UI
affiche proprement « IA non configurée » — **aucune fonctionnalité ne casse**.

- **Assistant IA** (`/assistant`) — **boucle agent Claude**. Comprend l'app et les données de l'utilisateur
  **filtrées par ses droits**. Les **outils de lecture** (annuaire, tâches, médecins, produits, **e-mails de sa
  propre boîte Courrier**…) sont exécutés automatiquement et **scopés** ; les **outils d'écriture** ne sont
  **jamais** exécutés par l'IA : ils reviennent en **carte de confirmation**. Actions possibles (chacune gardée
  par son module) : créer une tâche, créer une demande administrative, **envoyer un message** interne,
  **envoyer un e-mail** (depuis sa boîte), créer une **demande de congrès**. Il peut aussi **lire / résumer /
  chercher dans ses e-mails** (« résume mes mails », « ai-je reçu un mail de la PCH ? »). Exécution
  **ré-autorisée** + **journalisée**. Garde-fous : n'invente jamais un médecin/produit/personne **ni une adresse
  e-mail**, **avertit sur les dates passées**, **sortie en texte simple**, **robuste** (timeout + retry 429/5xx,
  ne lève jamais).
- **Rapports terrain vocaux** (`/field-reports`) — *Parler → transcription (**Whisper / OpenAI**) → analyse
  (**Claude** → champs structurés : médecin, objection, question médicale, concurrent, opportunité, signalement
  qualité/PV…) → relecture/correction → validation*. **L'IA ne valide jamais seule.** Synthèse agrégée pour les
  managers. 100 % utilisable en **saisie manuelle** sans clé.
- **Process Intelligence** — **synthèse IA** à la demande des lenteurs/blocages (Super Admin).

> Clés : `ANTHROPIC_API_KEY` (Claude), `OPENAI_API_KEY` (Whisper). Posées sur Render, jamais côté client.

---

## 🧠 Adventum Brain (cockpit Super Admin)

**Une seule couche premium, visible du Super Admin uniquement** (`/adventum-brain`). Pas six modules
séparés : un **cockpit unique** intégrant six fonctions comme une seule expérience.

| Fonction | Où, dans le cockpit |
|---|---|
| **War Room** | Vue principale : KPIs (risques critiques, blocages, actions proposées, décisions, signaux terrain) + « Aujourd'hui, ce qui mérite votre attention ». |
| **Risk Radar** | Le **moteur** : des **détecteurs sur données réelles** produisent des *Risk Cards* (niveau, objet, impact, responsable, cause probable, action recommandée, preuves). |
| **Root Cause** | **Drawer contextuel** à droite quand on clique un risque — pas une page : ce qui bloque, depuis quand, délai normal, cause probable, preuves, impact, reco. |
| **Knowledge Graph** | **Fiche 360 relationnelle** (onglet Relations) : pour une molécule/produit, blocs Regulatory · PCH · Médecins/KOL · Events · Terrain — lisible, pas une toile de bulles. |
| **Autopilot Actions** | Boutons sur les cartes → **mini-confirmation** → exécution. **Ne crée que des objets existants** (Tâche, Notification). Rien n'est exécuté sans confirmation. |
| **Intelligence Feed** | Onglet Feed : un fil **filtré par importance** (les mêmes signaux, du plus récent au plus ancien) — pas un flux de tout ce qui se passe. |

Plus une **barre de commande IA** (« Pourquoi les congrès sont bloqués ? ») et un **briefing de direction**
généré à la demande.

**Détecteurs Risk Radar (réels, calculés à la volée — aucune table de risque)** : caution PCH proche
d'expiration · congrès/sponsoring bloqués (analyse chef de produit en retard) · médecin **KOL** non visité ·
ordre de dépense non réglé · budget dépassé/à surveiller · information médicale en attente · directive
échue · fournisseur silencieux · signal qualité/PV terrain.

> **Règle anti-bureaucratie** (appliquée) : Adventum Brain **lit, relie, résume, explique et propose**. Il
> ne duplique aucun workflow, ne crée aucun formulaire lourd, ne crée un objet (Tâche/Notification) qu'**après
> confirmation**. But : *le Super Admin voit ce que les autres ne voient pas* — pas ajouter du travail.

> **Aucune migration** : la couche est **100 % lecture** + réutilise Tâches/Notifications existantes.

### Assistant IA du Super Admin (le plus puissant)

Pour le Super Admin, l'Assistant IA a une **vision globale** (tous les comptes, toutes les données) et des
**outils exclusifs** : `list_accounts` (tous les comptes + charge réelle : tâches ouvertes, demandes à
traiter), et la capacité de **relancer/piloter n'importe qui** (créer une tâche pour un collaborateur, lui
envoyer un message) — toujours sous confirmation et journalisé.

---

## 💬 Messagerie interne (temps réel)

Pour favoriser l'adoption face à WhatsApp — **la donnée reste propriété de l'entreprise**.

- **3 types de conversations** : message direct (1-1), **groupe** privé, **canal** d'équipe (découvrable).
- **Fonctionnalités** : markdown léger, **@mentions**, **réactions émoji**, **réponses citées**, **épinglage**,
  **favoris**, modifier/supprimer ses messages, **pièces jointes** (Drive chiffré, blob signé HMAC), **présence**
  (en ligne/absent/hors ligne), **« en train d'écrire… »**, **accusés de lecture / non-lus**, brouillons,
  recherche, filtres, sourdine, gestion des membres & rôles (OWNER/ADMIN/MEMBER).
- **Accès gouverné par l'appartenance** (`ConversationMember`), **jamais** par scope RBAC — **même le Super Admin
  ne lit pas par-dessus l'épaule**. Un tiers non-membre reçoit **403**. Vérifié Playwright **13/13**.
- **Temps réel sans WebSocket** : server actions + **UI optimiste** + **polling** (~6 s liste, ~3,5 s fil actif),
  présence par heartbeat. Limite assumée mono-instance (évolution SSE/Redis possible).

---

## 📧 Courrier — webmail Infomaniak intégré

Boîte mail **par utilisateur**, connectée à la plateforme (une seule entité).

- **IMAP** (lecture) + **SMTP** (envoi) via `imapflow` / `nodemailer` / `mailparser`.
- Connexion par **mot de passe d'application** chiffré **AES-256-GCM** au repos (`MailAccount`).
- Webmail **3 volets** (dossiers · liste · lecture/composition), aperçu HTML en **iframe sandbox**.
- Couche serveur `src/lib/mail.ts`, routes `/api/mail/{messages,message,attachment}` (auth + scoping).
- 🤖 **Connecté à l'Assistant IA** : il peut **lire / résumer / chercher** dans **votre** boîte et **rédiger un
  e-mail** (envoyé seulement après confirmation) — voir [Assistant IA](#-intelligence-artificielle-claude--whisper).

> Par défaut, les serveurs pointent sur `mail.infomaniak.com` (IMAP 993 / SMTP 465) — modifiables par utilisateur.

---

## 📝 Édition Office (OnlyOffice auto-hébergé)

Édition **Word / Excel / PowerPoint** directement dans le Drive, **sans dépendance cloud externe**.

- Bouton **« Éditer dans Office »** sur les fichiers éditables (page `/drive/[id]/edit`).
- Config **signée en JWT HS256** (`src/lib/onlyoffice.ts`, sans dépendance) ; le Document Server lit le fichier
  via un **jeton signé** (`/api/onlyoffice/file`, sans session) et **rappelle** la sauvegarde
  (`/api/onlyoffice/callback`) → création d'une **nouvelle version** Drive (auditée).
- **Inerte** tant que les variables ne sont pas posées.

> ⚠️ **Déploiement** : le Document Server doit être un **Web Service public** (le navigateur charge `api.js`) —
> un *Private Service* ne suffit pas. Le `JWT_SECRET` du Document Server **doit être identique** à
> `ONLYOFFICE_JWT_SECRET`. `APP_URL` doit pointer l'URL **publique** de l'app (pour le callback).

---

## 🚀 Démarrage local

### Prérequis
- **Node.js ≥ 18**
- Une base **PostgreSQL** accessible

### Installation

```bash
# 1) Dépendances (le .npmrc force legacy-peer-deps : imapflow tire nodemailer 9)
npm install

# 2) Variables d'environnement
cp .env.example .env
#   → renseigner au minimum DATABASE_URL et AUTH_SECRET (openssl rand -base64 32)

# 3) Base : migrations + compte Super Admin initial (AUCUNE donnée de démo)
npm run db:deploy
ADMIN_EMAIL="vous@adventum.dz" ADMIN_PASSWORD="MotDePasse123!" npm run db:bootstrap

# 4) Lancement
npm run dev            # http://localhost:3000
```

### Premier compte

`db:bootstrap` crée **uniquement** votre Super Admin (idempotent : ne réécrit jamais un compte existant).
Connectez-vous, puis dans **Administration** : créez les comptes de l'équipe, attribuez les accès
(onglet × action × ligne), suivez connexions/sessions.

---

## 🔧 Variables d'environnement

| Variable | Requis | Description |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Chaîne de connexion PostgreSQL. |
| `AUTH_SECRET` | ✅ | Secret Auth.js (`openssl rand -base64 32`). Sert aussi de clé maître au chiffrement Drive/mail. |
| `AUTH_TRUST_HOST` | ✅ (prod) | `true` derrière un proxy (Render/Vercel). |
| `ADMIN_EMAIL` · `ADMIN_PASSWORD` · `ADMIN_NAME` | ✅ | Compte Super Admin initial créé au bootstrap. |
| `ANTHROPIC_API_KEY` | ⬜ | Active l'**Assistant IA**, l'analyse des rapports vocaux et la synthèse Process Intelligence. |
| `OPENAI_API_KEY` | ⬜ | Active la **transcription vocale** (Whisper) des rapports terrain. |
| `MAX_UPLOAD_MB` | ⬜ | Taille max d'upload (défaut 25). |
| `APP_URL` | ⬜* | URL **publique** de l'app — requise pour le callback OnlyOffice. |
| `ONLYOFFICE_URL` | ⬜* | URL **publique** du Document Server OnlyOffice. |
| `ONLYOFFICE_JWT_SECRET` | ⬜* | Secret JWT **identique** à celui du Document Server. |
| `MAIL_ENCRYPTION_KEY` | ⬜ | Clé dédiée au chiffrement des mots de passe e-mail (sinon retombe sur `AUTH_SECRET`). |

> \* Requis **ensemble** uniquement pour activer l'édition Office. Côté **service OnlyOffice**, poser
> `JWT_ENABLED=true` et `JWT_SECRET=<même valeur que ONLYOFFICE_JWT_SECRET>`.

---

## ☁️ Déploiement — Render

Un **Blueprint** [`render.yaml`](render.yaml) provisionne **l'app Next.js + une base PostgreSQL managée**,
applique les migrations et crée le Super Admin (aucune donnée de démo).

1. [dashboard.render.com](https://dashboard.render.com) → **New + → Blueprint**, connecter ce dépôt.
2. Renseigner `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (`DATABASE_URL` et `AUTH_SECRET` gérés automatiquement).
3. **Apply** → Render exécute `npm install && prisma generate && prisma migrate deploy && db:bootstrap && next build`.

> **Conflit de dépendances résolu** : `imapflow` (mail) tire `nodemailer@9`, en conflit avec le peer optionnel
> `nodemailer@6` de `next-auth` (inutilisé). Le fichier **`.npmrc`** (`legacy-peer-deps=true`) règle le
> `npm install` de Render automatiquement.

### Activer OnlyOffice (optionnel)

1. Déployer le **Document Server OnlyOffice** en **Web Service public**, avec `JWT_ENABLED=true` et un `JWT_SECRET`.
2. Sur l'app : poser `ONLYOFFICE_URL` (l'URL publique du Document Server), `ONLYOFFICE_JWT_SECRET` (**le même secret**), `APP_URL` (l'URL publique de l'app).

> 🆓 Plan gratuit Render : la base Postgres expire après ~30 jours et le service se met en veille — passer en plan
> payant pour une base durable + service always-on.

---

## 🗄️ Base de données & migrations

- **72 modèles**, **76 enums**, **31 migrations**.
- `prisma migrate deploy` s'exécute **au déploiement** (les migrations en attente s'appliquent toutes seules).
- En local, `prisma migrate dev` étant interactif, on génère le SQL ainsi :

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_ma_migration
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<dossier>/migration.sql
npx prisma migrate deploy
```

**Chaîne (extrait récent)** : … → `messaging` → `medical_specialty_structure` → `employee_hr_documents` →
`budget_envelope` → `field_reports` → `events` → `hr_request_types` → `sponsoring_validation_workflow` →
`congress_intl_event_type` → `expense_order_budget_revision` → `mail_account` → `medical_info_pharmacist` →
`directives` → `support_requests`.

---

## 📜 Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm run start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint (next lint) |
| `npm run test` | Tests Vitest |
| `npm run db:deploy` | Applique les migrations (prod) |
| `npm run db:migrate` | Migration de développement |
| `npm run db:bootstrap` | Crée le Super Admin initial |
| `npm run db:reset` | Réinitialise la base |

---

## ✅ Tests & qualité

- **Vitest** : tests RBAC (purs, CI-safe) + **tests d'intégration** des workflows critiques contre une vraie base
  Postgres (mock de session) :
  - Information médicale : déclaration → pièces → validation → **ordre de dépense déféré** (6/6)
  - Directives : émission, accès, accusé de réception, fil bidirectionnel, archivage, diffusion par rôle (5/5)
  - Demandes de support : émission, scope, prise en charge, réponse, refus d'un tiers, clôture (5/5)
  - OnlyOffice : JWT (aller-retour / falsification / expiration / mauvais secret), types éditables (7/7)
  - Assistant IA : outils RBAC, résolution, exécution + audit *(skip propre si jeu de démo absent)*
- Les tests dépendants de la base se **skippent proprement** sans base (CI verte partout).

```bash
npx tsc --noEmit && npm run build && npx vitest run
```

---

## 🏗️ Architecture du code

```
src/
├── app/
│   ├── (auth)/login/                  # connexion
│   ├── (app)/                         # shell authentifié (sidebar + topbar)
│   │   ├── mon-travail · mon-espace · messages · courrier · directives · assistant
│   │   ├── dashboard · regulatory · sponsoring · budgets · finances · rh
│   │   ├── congress-international · congress-national · events · sales
│   │   ├── logistics · pch · stocks · medical · information-medicale
│   │   ├── business-development · validations · drive · demandes · support
│   │   ├── process-intelligence · admin · search
│   │   └── …                          # chaque module = liste + détail
│   ├── (portal)/portail/              # portail fournisseur (auth séparée)
│   ├── inscription/[id]/              # billetterie publique (hors auth)
│   └── api/
│       ├── auth/[...nextauth] · documents/[id] · drive/* · mail/*
│       ├── messaging/* · events/qr/[token] · field-reports/*
│       └── onlyoffice/{file,callback} · process-intelligence/synthesis
├── components/   ui/ · shared/ (DataTable, StatusBadge, DocumentPreview…) · layout/ · documents/ · dashboard/
├── lib/
│   ├── rbac.ts            # matrice + scoping row-level (cœur de la sécurité)
│   ├── session.ts         # requireUser / requireModule (gardes serveur)
│   ├── entity-access.ts   # contrôle d'accès par ligne (polymorphe)
│   ├── audit.ts · notify.ts
│   ├── ai.ts · assistant.ts          # couche IA + boucle agent
│   ├── mail.ts · onlyoffice.ts · drive-storage.ts (chiffrement)
│   ├── medical-info.ts · expense-orders.ts · validation.ts
│   ├── actions/           # server actions par module
│   └── queries/           # requêtes agrégées (dashboard, action-center, validations…)
└── prisma/
    ├── schema.prisma      # 72 modèles, 76 enums, relations, index
    └── bootstrap.ts       # Super Admin initial (idempotent, aucune donnée de démo)
```

> 🐍 Un prototype historique **Streamlit + SQLite** subsiste dans [`streamlit_app/`](streamlit_app/) — l'édition
> **Next.js + PostgreSQL** (ce dossier racine) est **le** produit de référence.

---

## 🧭 Feuille de route

**Grand chantier à venir — données de référence (master data).** Import prévu de **+600 000 produits / 7 800
sociétés pharma**, **nomenclature algérienne**, **IQVIA 2025-2026**, **achats PCH 2025**. Ce sont des
**référentiels** à une autre échelle que les données opérationnelles ; à construire **avant** l'import :
- Espace **« Référentiels »** dédié (Fournisseurs Monde, Produits Monde, Nomenclature DZ, Marché IQVIA, Achats PCH).
- **Pagination + recherche côté serveur** (index `pg_trgm` / full-text) en remplacement du DataTable client.
- **Pipeline d'import par lots** (worker Render) + **tâches de fond / cron** (imports, alertes d'expiration GMP/AMM/cautions).
- La valeur = la **connexion** (IQVIA → scoring BD, Nomenclature DZ → veille concurrentielle, etc.).

**Autres pistes** : reporting/BI consolidé + exports PDF/Excel planifiés · notifications e-mail/SMS · **veille des
appels d'offres PCH à venir** · suivi des échéances documentaires · contrats/conventions/licences · objectifs
commerciaux vs réalisé · lots & péremptions / pharmacovigilance · export comptable (G50) · **PWA** (installable
iOS/Android sans store) · annotations PDF.

---

## 🤝 Conventions & contribution

- Développement sur la branche **`claude/hopeful-goodall-phd0nb`** (branche par défaut du dépôt).
- Tout doit être **réel et vérifié** : `typecheck` + `build` + `tests` **verts** avant de pousser. **Aucune donnée simulée.**
- Les fichiers `"use server"` n'exportent **que** des fonctions `async`.
- Secrets **toujours côté serveur**, jamais committés ni exposés au client.

---

<div align="center">

**© 2026 Adventum Pharma — AMD Internal OS**

*Un seul outil. Toute l'entreprise. 100 % digitalisé.*

</div>
