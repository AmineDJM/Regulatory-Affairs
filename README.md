<div align="center">

# 🏥 AMD Internal OS — Adventum Pharma

**L'« OS d'entreprise » d'un laboratoire pharmaceutique algérien : un seul outil connecté pour piloter 100 % de l'activité.**

Regulatory · Ad & Pro (Sponsoring · Congrès · Événements · Matériel promotionnel) · Budgets & enveloppes · Finances ·
Ventes · Logistique & Marchés PCH · Promotion médicale · Information médicale · Business Development (+ Pharmatool) ·
RH · Bureau du secrétariat · Messagerie · Courrier · Drive & Office · Calendrier · Réunions · Assistant IA · Adventum Brain

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
- [Glossaire métier (Algérie & pharma)](#-glossaire-métier-algérie--pharma)
- [Aperçu en un coup d'œil](#-aperçu-en-un-coup-dœil)
- [Stack technique](#-stack-technique)
- [Panorama des modules](#-panorama-des-modules)
  - [Pilotage](#pilotage) · [Pôles métier](#pôles-métier) · [Transverse](#transverse) · [Système](#système) · [Externe](#externe)
- [Interconnexions — comment les modules s'alimentent](#-interconnexions--comment-les-modules-salimentent)
- [Sécurité & contrôle d'accès (RBAC)](#-sécurité--contrôle-daccès-rbac)
- [Rôles](#-rôles)
- [Workflows critiques](#-workflows-critiques)
- [Budgets, enveloppes & sous-catégories](#-budgets-enveloppes--sous-catégories)
- [Intelligence artificielle](#-intelligence-artificielle-claude--whisper)
- [Adventum Brain](#-adventum-brain-cockpit-super-admin)
- [Score d'adoption](#-score-dadoption-super-admin--adminadoption)
- [Messagerie temps réel](#-messagerie-interne-temps-réel)
- [Courrier — webmail intégré](#-courrier--webmail-infomaniak-intégré)
- [Édition Office & impression](#-édition-office-onlyoffice--impression)
- [Modèle de données — entités clés](#-modèle-de-données--entités-clés)
- [Démarrage local](#-démarrage-local)
- [Variables d'environnement](#-variables-denvironnement)
- [Déploiement (Render)](#-déploiement--render)
- [Base de données & migrations](#-base-de-données--migrations)
- [Scripts](#-scripts)
- [Tests & qualité](#-tests--qualité)
- [Architecture du code](#-architecture-du-code)
- [Journal des évolutions récentes](#-journal-des-évolutions-récentes)
- [Feuille de route](#-feuille-de-route)
- [Conventions](#-conventions--contribution)

---

## 🎯 Vision & principes

**AMD Internal OS** est le logiciel interne **unique** d'**Adventum Pharma**. Il remplace la dispersion
e-mails / Excel / WhatsApp par **un seul environnement de travail connecté** où chaque geste métier laisse une
trace exploitable par le suivant.

- 🧩 **Tout dans un seul outil connecté** — un module en alimente un autre : une **demande** devient une
  **validation**, qui devient un **ordre de dépense**, qui devient une **écriture comptable**, qui **consomme une
  enveloppe budgétaire** et **met à jour la trésorerie**. Rien n'est ressaisi ; tout est relié par des identifiants.
- 📊 **100 % digitalisé & data-driven**, **zéro donnée simulée** : l'admin et les utilisateurs saisissent la
  **vraie donnée**. Aucune fixture de démo n'est semée — l'application démarre vide sauf le compte Super Admin.
- 🔐 **Accès ultra-granulaire piloté par l'admin** : par **utilisateur × onglet × action × ligne**. Deux
  utilisateurs d'un même rôle peuvent voir des périmètres différents ; l'admin façonne l'app compte par compte.
- 🇩🇿 **Contexte algérien de bout en bout** : devise **DZD**, fiscalité (**G50, IRG, IBS, CNAS, CASNOS**),
  réglementaire **AMM / ANPP**, client institutionnel **PCH** (Pharmacie Centrale des Hôpitaux — marchés publics),
  fuseau **Africa/Algiers**, interface **intégralement en français**.
- 🏢 **L'unique poste de travail de l'employé** : Drive, messagerie interne, **courrier (e-mail)**, **édition Office
  collaborative**, **calendrier**, **réunions**, **assistant IA** — tout intégré, aucune fenêtre à ouvrir ailleurs.
- 🖨️ **Tout est imprimable et traçable** : chaque document de la plateforme dispose d'une option **Imprimer**
  (rendu same-origin, sans dépendance externe), et chaque action sensible est **journalisée** (qui / quoi / quand /
  ancienne → nouvelle valeur / motif).
- 🧠 **Un cerveau réservé au dirigeant** : **Adventum Brain** relie les signaux faibles de tous les modules pour
  faire remonter risques et causes racines — sans dupliquer aucun workflow existant.

> **Philosophie anti-bureaucratie** : l'OS **relie** plutôt qu'il n'ajoute des étapes. Chaque circuit d'approbation
> existe pour une raison réglementaire ou financière réelle ; l'IA et le Brain **lisent, résument, expliquent et
> proposent**, ils ne créent jamais rien sans une **confirmation humaine explicite**.

---

## 📚 Glossaire métier (Algérie & pharma)

Comprendre l'OS, c'est comprendre le métier qu'il digitalise. Termes récurrents dans l'application :

| Terme | Signification |
|---|---|
| **AMM** | **Autorisation de Mise sur le Marché** — dossier réglementaire d'un médicament (module Regulatory). |
| **ANPP** | **Agence Nationale des Produits Pharmaceutiques** — autorité algérienne d'enregistrement. Le workflow Regulatory suit son **processus officiel (22 étapes / 5 phases)**. |
| **PCH** | **Pharmacie Centrale des Hôpitaux** — centrale d'achat publique. Client institutionnel majeur : **appels d'offres → bons de commande → caution**. |
| **DCI** | **Dénomination Commune Internationale** (principe actif). Un produit peut être **mono / double / triple** DCI (1, 2 ou 3 principes actifs associés). |
| **Ad & Pro** | **Advertising & Promotion** — le pôle sponsoring / congrès / événements / matériel promotionnel. |
| **KOL** | **Key Opinion Leader** — médecin leader d'opinion (segmentation « influence » élevée dans Promotion médicale). |
| **PRIM** | **Pharmacien Responsable de l'Information Médicale** — déclare aux autorités les événements pris en charge avant que la dépense ne parte au comptable. |
| **BV** | **Bon de Virement** — demande de paiement émise depuis Regulatory vers les Finances (→ ordre de dépense). |
| **Ordre de dépense** | Pièce financière émise après validation définitive ; le comptable la **règle** (sortie de trésorerie) ou demande une **révision de budget**. |
| **Enveloppe budgétaire** | Budget d'une période rattaché à un ou plusieurs modules, réparti en **catégories** et **sous-catégories**, dont la **consommation réelle** est calculée depuis les dépenses attribuées. |
| **G50** | Déclaration fiscale mensuelle algérienne (TVA, IRG salaires, TAP…). |
| **IRG / IBS** | Impôt sur le Revenu Global (personnes) / Impôt sur les Bénéfices des Sociétés. |
| **CNAS / CASNOS** | Sécurité sociale des salariés / des non-salariés (cotisations RH & paie). |
| **DZD** | Dinar algérien — devise unique de toute l'application. |
| **GMP / BPF** | Good Manufacturing Practices / Bonnes Pratiques de Fabrication (échéances qualité fournisseurs). |
| **IQVIA** | Fournisseur mondial de données de marché pharmaceutique (référentiel prévu, cf. feuille de route). |
| **National Sales** | Rôle qui **approuve la demande émanant d'un délégué et désigne le chef de produit** (étape préliminaire des circuits Ad & Pro / événements). |

---

## 👀 Aperçu en un coup d'œil

| | |
|---|---|
| **~40** modules de navigation · **94** pages applicatives | **17** rôles métier |
| **93** modèles Prisma · **86** enums | **69** migrations SQL |
| **54** fichiers de *server actions* · **27** fichiers de requêtes | **32** routes API |
| RBAC **module × action × ligne** appliqué **côté serveur** | Drive & mots de passe **chiffrés AES-256-GCM** |
| Assistant IA (boucle agent Claude) partout | Rapports terrain **vocaux** (Whisper → Claude) |
| Messagerie interne temps réel **+ notification sonore** (même en arrière-plan) | Webmail Infomaniak intégré (recherche, répondre à tous, transfert) |
| Édition Word/Excel/PowerPoint (OnlyOffice) | Aperçu **et impression** in-app PDF/Word/Excel/PPT, sans dépendance externe |
| Enveloppes budgétaires (fixe/flexible) **+ sous-catégories + vue consolidée** | Adventum Brain — cockpit Super Admin (risques, root cause, graphe) |

---

## 🧱 Stack technique

| Couche | Choix |
|---|---|
| **Framework** | Next.js 14.2 (App Router, **React Server Components**, **Server Actions**) |
| **Langage** | TypeScript strict · React 18 |
| **Base de données** | PostgreSQL + **Prisma 5.22** |
| **Auth** | **Auth.js / NextAuth v5** (Credentials, JWT, bcrypt, `trustHost`) + **sessions révocables en base** |
| **UI** | Tailwind CSS + **design system maison** (style shadcn/ui) · `lucide-react` · **Recharts** |
| **Documents** | Aperçu **embarqué** : `mammoth` (Word), `xlsx`/SheetJS (Excel), `jszip` (PowerPoint), iframe (PDF) ; **impression** via iframe same-origin |
| **E-mail** | `imapflow` (IMAP) · `nodemailer` (SMTP) · `mailparser` (MIME) |
| **IA** | Claude (Anthropic) pour le texte/agent · Whisper (OpenAI) pour la transcription vocale |
| **Édition Office** | OnlyOffice Document Server auto-hébergé (JWT HS256) |
| **Son** | **Web Audio API** — bip de notification généré à la volée (aucun fichier audio), débloqué au 1er geste |
| **QR / billetterie** | `qrcode` (inscription publique + check-in événements) |
| **Déploiement** | **Render** (Web Service + PostgreSQL managé, Blueprint `render.yaml`) |

> Tout secret (clés IA, secrets JWT, mots de passe e-mail) est **strictement côté serveur** — jamais exposé au
> navigateur, jamais committé. La clé maître de chiffrement dérive d'`AUTH_SECRET`.

---

## 🗺️ Panorama des modules

La navigation est organisée en 4 groupes. Plusieurs modules sont **fusionnés** en un seul item de sidebar avec
**onglets internes** (sans rien retirer) : **Ad & Pro** (Sponsoring · Congrès internationaux · Événements nationaux ·
Events · Matériel promotionnel), **Finances** (Finances · Espace comptable), **Logistique & Stocks PCH**,
**Mon dossier RH** (dossier RH · Mes ordres de mission), **Mon espace** (Mon travail · Mon espace · Directives).
Un onglet **n'apparaît que si l'utilisateur y a accès** (RBAC asymétrique) : la sidebar de deux personnes n'est
jamais identique.

### Pilotage

| Module | Route | Description |
|---|---|---|
| **Mon travail** *(Action Center)* | `/mon-travail` | Agrège, **selon les droits** : tâches, demandes du Bureau du secrétariat à traiter, validations en attente, paiements à régler, dossiers Regulatory, congés RH, congrès/événements à valider/analyser, **directives**, **pièces de support**, **info médicale**, notifications. Vues **en retard / bientôt / urgent**. |
| **Mon espace** | `/mon-espace` | Tâches perso, congés/absences, **avances sur salaire** (self-service), **dossiers de suivi** intégrés. |
| **Messagerie** | `/messages` | Messagerie interne complète (DM / groupes / canaux). Badge non-lus live **+ notification sonore** qui retentit même quand l'onglet est en arrière-plan. → [détails](#-messagerie-interne-temps-réel) |
| **Courrier** | `/courrier` | **Webmail Infomaniak** intégré par utilisateur (IMAP + SMTP) : dossiers (Réception · **Envoyés** · Corbeille…), **recherche** plein-texte, **filtres** (tous / non lus), **Répondre · Répondre à tous · Transférer**, **carnet de contacts externes**, **aperçu des pièces jointes**, **« Lier à un dossier »**. → [détails](#-courrier--webmail-infomaniak-intégré) |
| **Directives** | `/directives` | **Instructions priorisées de la Direction** vers une personne ou un rôle entier, avec échéance, statut et **fil d'échange**. |
| **Assistant IA** 💬 | **bulle flottante** (partout) | Chatbot interne (boucle agent Claude) **scopé par les droits**, présent sur **toutes les pages**. **Suggestions proactives** sur les messages non lus. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Mon dossier RH** | `/mon-dossier` | Documents RH personnels (contrats, bulletins, attestations) + **demandes RH** (attestation, CNAS, relevé d'émoluments, titre de congé, sortie exceptionnelle, arrêt maladie, note de frais…) + onglet **« Mes ordres de mission »** intégré. Accès **strict** à ses propres documents. |
| **Calendrier** | `/calendar` | Agenda d'entreprise (fuseau **Alger**), création de rendez-vous + invitations, **accessible à l'Assistant IA** (créer/inviter par la conversation). |
| **Réunions** | `/meetings` | Appels & réunions (lien Meet simple) + **enregistrement / transcription / compte-rendu IA** + **rappel 30 min avant** (notification planifiée). |
| **Dashboard** | `/dashboard` | KPIs & graphiques adaptés au rôle. |

### Pôles métier

| Module | Route | Description |
|---|---|---|
| **Regulatory** | `/regulatory` | Dossiers **AMM / ANPP**, **workflow 17 étapes** + **processus officiel ANPP** (22 étapes / 5 phases) + checklist de présoumission, documents par molécule, **DCI mono / double / triple**, commentaires, champs personnalisés. Catégorie **Médicament / Dispositif médical**. **Référentiel fournisseurs** créé par les responsables réglementaires (menu déroulant dans les dossiers), colonnes **Forme** (galénique) et **Dosage + unité** (mg/g/µg/UI/%…) en menus déroulants. Section **Réserves** (upload PDF). **Demande de BV** → ordre de dépense (échéance). Carte **« Vue fournisseur »** (pilote le portail externe). |
| **Ad & Pro** | `/sponsoring` (+ onglets) | Module unifié **Sponsoring · Congrès internationaux · Événements nationaux · Events · Matériel promotionnel**. Circuit de demande avec le **National Sales** (approuve + **désigne le chef de produit**), **analyse confidentielle du chef de produit**, **tierce personne** impliquée via son espace (+ dossier auto), **décision définitive de la Direction** (budget accordé visible), enchaînement **Information médicale → Finances**. **Liste des personnes prises en charge** (pièces d'identité) + **ordre de mission**. → [workflows](#-workflows-critiques) |
| **Budgets & enveloppes** | `/budgets` | **Enveloppes budgétaires** (Super Admin, délégable) : période, **modules rattachés**, **catégories + sous-catégories**, **budget total** fixe ou flexible, **allocation** des dépenses validées, **vue consolidée** du total de toutes les enveloppes, **accès par rôle ET par personne**. → [détails](#-budgets-enveloppes--sous-catégories) |
| **Finances** | `/finances` | **Solde de trésorerie initial** + calcul, livre, **paie**, **ordres de dépense**, synthèse comptable (onglet **Espace comptable** : à régler, recettes attendues, résultat mensuel). |
| **RH** | `/rh` | Employés, contrats, congés, avances, dépôt de documents et **traitement des demandes RH** (dépôt de pièces + réponse dans la demande). |
| **Ventes** | `/sales` | CA pharma/PCH, **import CSV**, type **Produit / Service**. |
| **Logistique PCH** | `/logistics` | Import / expéditions fournisseurs, dates estimées vs réelles, dédouanement. |
| **PCH — Marchés** | `/pch` | **Marchés publics gagnés** : appels d'offres → **bons de commande** + **caution** (alertes d'expiration). → [détails](#pch--marchés-publics) |
| **Stocks PCH** | `/stocks` | **Stock initial** + mouvements (entrée / sortie / ajustement) **liés aux produits Regulatory** + niveau courant par produit. |
| **Rapports terrain** | `/field-reports` | **Rapports vocaux IA** des délégués : parler → transcription → analyse → relecture → validation. Intégrés à **Promotion médicale**. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Promotion médicale** | `/medical` | **Annuaire structuré** : Spécialité → Secteur (Hôpital / Libéral) → médecins, titre/grade. **Segmentation à 5 niveaux** (Très haut / Haut / Moyen / Bas / Très bas) pour **influence**, **potentiel** et **affinité**, **par spécialité et par produit**, médecins **et** pharmaciens. Visites & tournées **scopées par délégué**, plans de tournées **duplicables**. |
| **Information médicale** | `/information-medicale` | Module du **pharmacien responsable de l'information médicale (PRIM)** : déclaration réglementaire **intercalée** entre la validation de la Direction et l'ordre de dépense ; **consultation des pièces de l'événement source**, upload de la déclaration, affichage du demandeur. → [workflow](#information-médicale--déclaration-réglementaire-prim) |
| **Business Development** | `/business-development` | **Grand tableau stratégique Projet → Gamme → Produit** (~20 colonnes), colonnes gelées, export CSV. **Intègre Pharmatool** : pipeline de données concurrentielles, **Vue d'ensemble**, **moteur de matching DCI**, **Opportunités**, **Pricing** (ville / hôpital), **Analyse produit / concurrence** (HHI, parts de marché, radar). |

### Transverse

| Module | Route | Description |
|---|---|---|
| **Demandes de validations** | `/validations` | **Bureau de validation central** : agrège **toutes les validations en attente** issues des autres modules (Bureau du secrétariat, Ad & Pro, **Finances**, information médicale…) — visible des **validateurs** (pas du demandeur). Le Super Admin définit des **règles configurables** (module, type d'objet, montant, département, rôle, priorité → 1 ou 2 validateurs, séquentiel/parallèle). → [détails](#centre-de-validation-agrégation--configurable) |
| **Documents** (Drive + Documents) | `/drive` | Stockage **chiffré et durable en base** (`FileBlob`), visionneuses PDF / Word / Excel / PowerPoint / images / vidéo / audio, **édition Office** (OnlyOffice), **impression**, versioning. **Imports larges**, **déplacer**, **corbeille en cascade**, **accès par personne** (voir / modifier) à l'import. |
| **Dossiers** | `/dossiers` | **Dossier de suivi** d'un sujet ad hoc : description, **responsable + participants**, statut, **fichiers** et **fil de discussion**. Créable **manuellement**, **proposé par l'IA**, **alimenté en liant un e-mail** depuis le Courrier, ou **créé automatiquement** quand on implique une tierce personne sur un événement. |
| **Bureau du secrétariat** | `/demandes` | « Bureau de l'assistante de direction » : **10 types** de demandes, **catalogue d'articles de fourniture**, **demandes multi-cellules**, **fenêtre de 15 min** pour que le demandeur **modifie TOUT ce qu'il a saisi** ou supprime sa demande, **suppression traçable** (corbeille + motif), **flux par demande** (achat → validation Finances → devis/facture → Fin de la demande), validations, ordres de dépense, **missions chauffeur**. → [workflow](#bureau-du-secrétariat--flux-par-demande) |
| **Demandes de support** | `/support` | Questions / **brochures** / **supports de visite** / PDF adressés au **directeur médical** ou au **chef de produit**, avec fil + pièces jointes. |
| **Feedback** | `/feedback` | Retour libre utilisateur → admin, **+ boîte de réception** : les réponses de l'administration s'affichent à l'utilisateur (avec notification). |

> **Menu simplifié** : modules fusionnés en **onglets** — « Mon espace » (Mon travail · Mon espace · Directives),
> « Ad & Pro » (Sponsoring · Congrès · Événements · Matériel promotionnel), « Documents » (Drive · Documents),
> « Mon dossier RH » (RH perso · Mes ordres de mission). **Messagerie** et **Notifications** restent accessibles
> via leurs **icônes** dans la barre du haut.

### Système

| Module | Route | Description |
|---|---|---|
| **Adventum Brain** 🧠 | `/adventum-brain` | **Super Admin uniquement — le cockpit qui voit ce que les autres ne voient pas.** War Room, Risk Radar, Root Cause, Knowledge Graph, Autopilot, Intelligence Feed + **Process Intelligence** en onglet. → [détails](#-adventum-brain-cockpit-super-admin) |
| **Administration** | `/admin` | Comptes (création, **modification e-mail/profil/rôle**), **matrice d'accès** (onglet × action × ligne), **sessions révocables**, activité, **journal d'audit** (paginé), **champs personnalisés**, règles de validation, feedback, comptes portail fournisseur, **Vue exacte** (impersonation), **Contrôle IA** + **Score d'adoption** en onglets, **limites d'upload** configurables. |
| **Recherche globale** | `/search` | RBAC-aware + **palette ⌘K**. |

### Externe

| Module | Route | Description |
|---|---|---|
| **Portail Fournisseur** | `/portail` | **Auth totalement séparée**, isolation stricte : un fournisseur ne voit QUE ses produits `portalVisible` et **seulement les champs externes**. → [détails](#portail-fournisseur-externe-sécurisé) |
| **Inscription publique** | `/inscription/[id]` | **Billetterie événements** hors authentification : formulaire d'inscription partageable, liste d'attente automatique à capacité atteinte, **QR** de check-in. |

---

## 🔗 Interconnexions — comment les modules s'alimentent

Le cœur de l'OS, ce sont les **liens** entre modules. Un même fait métier traverse la plateforme sans jamais être
ressaisi :

```
Délégué crée une demande (Sponsoring / Congrès / Événement)
   └─▶ National Sales approuve + désigne un Chef de produit
        └─▶ Chef de produit analyse (avis + budget proposé — CONFIDENTIEL)
             └─▶ Direction : décision définitive + BUDGET ACCORDÉ (visible)
                  ├─▶ Information médicale : le PRIM déclare aux autorités (si applicable)
                  │        └─▶ exige des pièces → déposées par Direction / comptable / délégué
                  └─▶ ORDRE DE DÉPENSE émis
                       └─▶ Finances : le comptable RÈGLE (facture obligatoire)
                            ├─▶ FinanceTransaction (sortie) → met à jour la TRÉSORERIE
                            └─▶ attribution AUTOMATIQUE à la CATÉGORIE budgétaire du module
                                 └─▶ consommation de l'ENVELOPPE recalculée (barres de santé)
```

Autres connexions notables :

- **Regulatory → Finances** : une **Demande de BV** émet un ordre de dépense avec échéance.
- **Regulatory → Stocks PCH** : les **mouvements de stock** sont liés aux **produits Regulatory**.
- **Bureau du secrétariat → Finances** : une demande d'achat déclenche une **validation Finances** (devis → facture).
- **Courrier → Dossiers** : un e-mail peut être **lié à un dossier de suivi** en un clic.
- **Tâches / Messages → Dossiers** : un message peut devenir une **tâche demandée** ; une tâche peut ouvrir un dossier.
- **Tierce personne → Dossiers** : impliquer quelqu'un sur un événement **crée automatiquement un dossier** (sans budget).
- **Tous les modules → Validations** : chaque circuit d'approbation remonte dans le **bureau de validation central**.
- **Tous les modules → Adventum Brain** : signaux faibles agrégés en **Risk Cards** et **Knowledge Graph**.

---

## 🔐 Sécurité & contrôle d'accès (RBAC)

Le contrôle d'accès est **dynamique, à deux couches, toujours appliqué côté serveur** :

1. **Permissions module × action** — matrice par rôle (`PERMISSIONS` dans `src/lib/rbac.ts`, **exhaustive** : ajouter
   un rôle force une entrée), affinée par des **overrides par utilisateur** (`UserAccess`) gérés depuis l'admin.
2. **Row-level scoping** — les helpers `scope*()` renvoient des **fragments Prisma `where`** : les lignes non
   autorisées **ne sont jamais envoyées au client** (filtrées en base, pas seulement masquées à l'écran).

```
getAccess(user)  →  accès EFFECTIF (caché par requête)
   ├── userCan(user, module, action)      → la page/action est-elle permise ?
   ├── hasGlobalView(role)                → Super Admin / Direction voient tout
   ├── defaultScope(role, module)         → ALL ou ASSIGNED ?
   └── scopeRegulatory / scopeSales / scopeAdminRequests / scopeMedicalInfo / … → where Prisma
canAccessEntity(user, entityType, id, action)   → contrôle d'accès POLYMORPHE par ligne
```

> **Atterrissage sûr** : si une page est refusée, l'utilisateur est renvoyé vers la **première destination
> qu'il peut réellement voir** — pas de boucle `ERR_TOO_MANY_REDIRECTS`. S'il n'a accès à rien, une page
> `/no-access` claire l'invite à contacter l'admin.

> **Exemple** : la Direction des opérations voit tout (`hasGlobalView`) ; une **assistante Regulatory** ne voit
> que les DCI qui lui sont assignées ; un **délégué** ne voit que ses propres demandes et tournées ; un **chef de
> produit** ne voit l'analyse confidentielle que sur les dossiers qu'il instruit ; le **National Sales**, doté d'une
> **portée ALL** sur les circuits Ad & Pro, voit toutes les demandes à approuver.

**Gardes serveur** : `requireModule(module, action)` protège chaque page, `requireUser()` chaque server action.
Toute action sensible est **ré-autorisée côté serveur** et **journalisée**.

**Autres mesures** :
- 🔒 **Chiffrement AES-256-GCM** des blobs Drive (adressage par contenu SHA-256) et des mots de passe e-mail, clé
  maître dérivée d'`AUTH_SECRET`.
- 🪪 **Sessions révocables** en base ; 👁️ **Vue exacte** (impersonation) honorée **uniquement** si la session
  réelle est Super Admin.
- 🧾 **Journal d'audit** complet (qui / quoi / ancienne → nouvelle valeur / date / module), y compris la
  **suppression traçable** des demandes (motif obligatoire) et la **modération** (édition/suppression de
  commentaires, pièces jointes et messages par l'admin / responsable / auteur).
- 🚧 **Anti-bruteforce** : verrouillage temporaire progressif après échecs (`LoginAttempt`), anti-énumération,
  message générique, audit. Connexion **insensible à la casse** de l'e-mail.
- 🛡️ **En-têtes de sécurité** : CSP (`frame-ancestors`, `object-src 'none'`, `base-uri`, `form-action`), **HSTS**
  (2 ans, preload), `X-Frame-Options`, `COOP`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- 🤖 **Centre de contrôle IA** (Super Admin) : interrupteur général + activation par fonction + journal d'usage.
- 🔢 Identifiants **cuid** non séquentiels ; upload contrôlé (extension + **taille configurable**) ; download
  protégé par vérification d'accès.

**Parcours de première connexion** : un nouveau compte doit **définir son mot de passe**, puis suit un
**onboarding guidé** (`/onboarding`) — coordonnées, **connexion e-mail** et **visite des onglets accessibles**
(générée à partir des droits réels). Le Super Admin peut **redéclencher le setup**. Le drapeau `mustOnboard` est
**lu à chaud en base** : la fin du parcours prend effet **immédiatement, sans reconnexion**.

---

## 👤 Rôles

**17 rôles** métier. Le Super Admin attribue/retire tout via la **matrice d'accès** (`/admin/users/[id]`) ; les
libellés français viennent de `src/lib/labels.ts`.

| Rôle | Libellé | Portée typique |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Tout + administration (permissions, comptes, sécurité, IA, Brain, enveloppes budgétaires, Vue exacte). Compte **souverain**. |
| `DIRECTION` | **Direction des opérations** | **Pair quasi-administrateur** : accès complet (gérer + valider) aux pôles, console d'admin en **lecture**. **Décision définitive** des demandes Ad & Pro (budget accordé). Attribue les dépenses aux enveloppes. Restreignable par overrides. |
| `NATIONAL_SALES` | **National Sales** | **Toutes les capacités du délégué médical** + **approbation préliminaire** des demandes Ad & Pro / événements (approuver / refuser + **désigner le chef de produit**). Portée **ALL** pour voir toutes les demandes à instruire ; **pas** de décision définitive (réservée à la Direction). |
| `MEDICAL_PROMOTION_MANAGER` | Manager Promotion Médicale | Promotion médicale, module Ad & Pro. **Peut être désigné chef de produit.** N'assure **plus** l'étape préliminaire (désormais National Sales). |
| `HEAD_OF_REGULATORY` | Responsable Réglementaire | Regulatory (gestion complète + fournisseurs). |
| `REGULATORY_ASSISTANT` | Assistante Réglementaire | Regulatory (lignes assignées). |
| `HEAD_OF_SALES` | Responsable Ventes | Ventes, PCH, Stocks. |
| `SALES_USER` | Commercial | Ventes / PCH (ses lignes). |
| `LOGISTICS_MANAGER` | Responsable Logistique | Logistique, PCH, Stocks. |
| `MEDICAL_DELEGATE` | Délégué Médical | Ses médecins, visites, demandes (scope **ASSIGNED**). Émetteur typique des demandes Ad & Pro / événements. |
| `PRODUCT_MANAGER` | **Chef de produit** | Analyse congrès / sponsoring / événements (avis + **budget proposé confidentiel**). |
| `BUSINESS_DEVELOPMENT_MANAGER` | Manager Business Development | Business Development (+ Pharmatool). |
| `FINANCE_BUDGET_MANAGER` | Responsable Finance / Budget | Finances, Budgets, ordres de dépense, **validations Finances**. |
| `MEDICAL_INFO_PHARMACIST` | Pharmacien resp. information médicale | Déclaration réglementaire des événements validés (PRIM). |
| `DIRECTION_ASSISTANT` | **Assistante de Direction** | **Bureau du secrétariat** (gère les demandes, pilote le Matériel promotionnel **sans accès au module**). |
| `COORDINATOR` | Coordination / Coursier | **Missions chauffeur / courses** (adresse Maps, durée, retard) — espace restreint. |
| `VIEWER` | Lecteur | Lecture limitée. |

> Pense à créer au moins un **National Sales**, un **Chef de produit**, un **Pharmacien information médicale**, une
> **Assistante de Direction** et un **Responsable Finance** pour que les circuits complets fonctionnent.

---

## 🔄 Workflows critiques

### Ad & Pro & Événements — circuit de prise en charge

Le **même** circuit sert le **Sponsoring**, les **Congrès internationaux/nationaux** et les **Événements** :

```
Demande (délégué + budget estimé)
   → NATIONAL SALES : approuve / refuse + DÉSIGNE le Chef de produit        ← étape préliminaire
   → Analyse + budget proposé (Chef de produit) — approuver / refuser        ← CONFIDENTIEL
   → (option) tierce personne impliquée via son espace + dossier auto (sans budget)
   → Décision DÉFINITIVE (Direction : budget accordé + avis, VISIBLES par le délégué)
   → [Information médicale : déclaration du pharmacien (PRIM)]               ← uniquement si applicable
   → Ordre de dépense → Finances / comptable (facture obligatoire à l'accord)
```

> ⚠️ **Étape préliminaire réservée au National Sales.** C'est lui — et non la Direction, ni la Direction
> Marketing — qui approuve la demande émanant d'un délégué et **choisit le chef de produit**. La **décision
> définitive** (budget accordé) reste à la **Direction** et est **visible** par le délégué.

> ⚠️ **Confidentialité impérative** — l'analyse et le budget proposé par le chef de produit **ne sont JAMAIS
> visibles par le délégué** : il ne voit que le **budget final accordé + le commentaire de la Direction**.
> Le **Sponsoring** ajoute l'**appel** : après décision, le délégué peut faire appel → nouvel avis du chef de
> produit → la Direction tranche définitivement. Pour les congrès/événements pris en charge, on saisit la **liste
> des personnes prises en charge** (avec pièces d'identité) et un **ordre de mission**.

### Impliquer une tierce personne (sans accès au module)

Sur un **sponsoring**, un **congrès** ou un **événement**, un acteur du circuit peut **impliquer une tierce
personne** (ex. l'assistante de direction) **même si elle n'a aucun accès au module** :

```
« Impliquer une tierce personne » (choix de la personne + message)
   → la personne reçoit une DEMANDE DE VALIDATION dans son espace
   → un DOSSIER DE SUIVI est créé automatiquement, indiquant DE QUEL événement il s'agit
        (SANS budget ni détail confidentiel) ; la demande pointe vers ce dossier (accessible),
        jamais vers la fiche de l'événement.
```

### Bureau du secrétariat — flux par demande

```
Demande (employé) — simple OU multi-cellules (lot), articles depuis le catalogue
   → 15 min : le demandeur peut encore MODIFIER (tous les champs saisis) ou SUPPRIMER sa demande
   → l'assistante « Commence le traitement »
   → SI ACHAT : upload du DEVIS → « Demande de validation des Finances »
        → bureau central des validations (Finances) : accord / refus / « trop cher, autre agence, réduire »
        → va-et-vient possible ; à l'accord, upload de la FACTURE finale → « Fin de la demande »
   → SINON : validation interne (opérations / autre) ou aucune, à l'estimation de l'assistante → « Fin de la demande »
```

Chaque **cellule** d'une demande multi-cellules est pilotée **indépendamment** (statut + validations). La
**suppression** par l'assistante est **traçable** (corbeille + motif + audit, restauration possible).

### Information médicale — déclaration réglementaire (PRIM)

Étape **intercalée** entre la validation définitive de la Direction et l'ordre de dépense (uniquement si un
pharmacien responsable est configuré ; sinon l'ordre part directement aux Finances) :

```
Direction valide définitivement  →  PAS encore d'ordre de dépense
   → MedicalInfoDeclaration (DIM-AAAA-NNN) notifiée au pharmacien
   → le pharmacien CONSULTE les pièces de l'événement source + déclare aux autorités
   → il EXIGE des pièces (Direction / comptable / délégué…) — non obligatoires selon le cas
   → les destinataires DÉPOSENT les pièces (visibles dans Mon travail)
   → le pharmacien VALIDE  →  l'ordre de dépense est enfin émis vers le comptable
```

### Ordres de dépense — aller-retour comptable ↔ Direction

Direction valide → **ordre de dépense** → le **comptable règle**. Le comptable peut **demander une révision**
(manque de fonds) → l'ordre remonte à la Direction qui **ajuste le montant** ou **refuse**. Au règlement, la
dépense est **attribuée automatiquement** à la **catégorie budgétaire du module** d'origine et une
**FinanceTransaction** (sortie) met à jour la trésorerie.

### Centre de validation (agrégation + configurable)

Le module **Demandes de validations** agrège **toutes les validations en attente** (Bureau du secrétariat, Ad & Pro,
Finances, information médicale…) — visible des **validateurs**, pas du demandeur. Le Super Admin définit des
**règles** : module, type d'objet, montant min/max, département, rôle, priorité → **1 ou 2 validateurs**, en
**séquentiel ou parallèle**. Une demande administrative peut être **escaladée** à la Direction.

### PCH — Marchés publics

**Appel d'offres gagné** (réf. auto `AO-année-n`) → **caution obligatoire** (montant, dates, alertes) → sous-lignes
= **bons de commande** (réf, qté, valeur, date réception, date paiement).

### Portail Fournisseur (externe sécurisé)

Comptes externes **totalement séparés** (`Supplier` / `SupplierUser`, **auth distincte** cookie HMAC scopé
`/portail`). Un fournisseur ne voit **QUE** ses produits `portalVisible` et **seulement les champs externes**.

### Vue exacte (impersonation)

Le Super Admin visualise l'OS **exactement comme** un utilisateur. Cookie honoré **uniquement** si la session
réelle est Super Admin. Bandeau permanent + « Quitter », démarrage/arrêt journalisés.

---

## 💰 Budgets, enveloppes & sous-catégories

Le module **Budgets** (`/budgets`) est un vrai système de gestion budgétaire multi-niveaux.

- **Enveloppe budgétaire** — créée / modifiée / supprimée par le **Super Admin** (délégable via le droit
  `BUDGETS:DELETE`). Chaque enveloppe porte : une **période**, **un ou plusieurs modules rattachés**, un **montant
  total**, et ses **règles d'accès**.
- **Catégories & sous-catégories** — l'enveloppe se répartit en **catégories** (ex. « Événement », rattachée à un
  module pour l'attribution automatique), chacune pouvant contenir des **sous-catégories créées à la main**
  (ex. « Table ronde » sous « Événement »). Les sous-catégories sont une **répartition interne** : l'alloué de
  l'enveloppe ne compte que les catégories de tête.
- **Budget total (au-dessus des enveloppes)** — mode **FIXE** (montant figé par le Super Admin) ou **FLEXIBLE**
  (= somme automatique des enveloppes actives visibles).
- **Attribution automatique** — quand une dépense validée est **réglée** par les Finances, elle « tombe »
  automatiquement dans la **catégorie de tête** rattachée au **module** d'origine de la demande.
- **Vue consolidée « Total des enveloppes »** — un panneau affiche le **budget cumulé, l'alloué, le consommé et le
  reste de TOUTES les enveloppes accessibles**, plus le détail par enveloppe. Réservé au Super Admin et aux
  personnes/rôles autorisés (la vue n'agrège que ce qu'on a le droit de voir).
- **Contrôle d'accès par enveloppe** — le Super Admin ouvre une enveloppe en consultation **à des rôles** (ex.
  Direction des opérations) **et/ou à des personnes nommées** (`accessUserIds`). Un non-gestionnaire ne voit qu'une
  enveloppe qui lui est ouverte.
- **Santé** — barres **Maîtrisé / À surveiller / Dépassé** par catégorie, montant **non alloué**, dépenses **non
  attribuées** à réaffecter d'un clic.

---

## 🤖 Intelligence artificielle (Claude + Whisper)

La couche IA (`src/lib/ai.ts`) est **serveur uniquement** ; sans clé, elle renvoie `configured:false` et l'UI
affiche proprement « IA non configurée » — **aucune fonctionnalité ne casse**.

- **Assistant IA** — **bulle flottante présente partout** + page plein écran `/assistant`. **Boucle agent Claude**,
  comprend l'app et les données **filtrées par les droits**. **Proactif** sur les messages non lus. Outils de
  **lecture** (annuaire, tâches, médecins, produits, **e-mails de sa boîte**, **calendrier**…) exécutés et
  **scopés** ; outils d'**écriture** **jamais** exécutés seuls → **carte de confirmation** (créer une tâche, une
  demande administrative, **envoyer un message**, **envoyer un e-mail**, créer une **demande de congrès**, créer un
  **rendez-vous**). Garde-fous : n'invente jamais médecin/produit/adresse, **avertit sur les dates passées**,
  **texte simple**, **robuste** (timeout + retry, ne lève jamais).
- **Rapports terrain vocaux** (`/field-reports`) — *Parler → Whisper → Claude (champs structurés) → relecture →
  validation*. **L'IA ne valide jamais seule.** 100 % utilisable en saisie manuelle sans clé.
- **Comptes-rendus de réunion** — transcription + synthèse IA des appels.
- **Process Intelligence** & **Adventum Brain** — synthèses et explications à la demande (Super Admin).

> Clés : `ANTHROPIC_API_KEY` (Claude), `OPENAI_API_KEY` (Whisper). Posées sur Render, jamais côté client.

### Centre de contrôle IA (Super Admin · `/admin` → onglet IA)

Pilotage de l'IA **sans toucher au code** : **interrupteur général** + **bascule par fonction**, **état des clés**
(lecture seule), **tableau de bord d'usage** (volume, taux de succès, latence, derniers échecs via `AiUsageLog`).

---

## 🧠 Adventum Brain (cockpit Super Admin)

**Une seule couche premium, visible du Super Admin uniquement** (`/adventum-brain`) — un **cockpit unique**
intégrant : **War Room** (KPIs + « ce qui mérite votre attention »), **Risk Radar** (détecteurs sur données
réelles → Risk Cards), **Root Cause** (drawer contextuel), **Knowledge Graph** (fiche 360 relationnelle, bascule
liste / graphe radial), **Autopilot Actions** (mini-confirmation, ne crée que Tâche/Notification), **Intelligence
Feed** (fil filtré par importance), **Process Intelligence** (lenteurs & blocages, charge par personne).

**Détecteurs Risk Radar (calculés à la volée — aucune table de risque)** : caution PCH proche d'expiration ·
congrès/sponsoring bloqués · médecin **KOL** non visité · ordre de dépense non réglé · **budget/enveloppe dépassé**
· information médicale en attente · directive échue · fournisseur silencieux · signal qualité/PV terrain ·
**rupture / stock bas PCH** · **retard de livraison** · **événement à faible présence**.

> **Réglage des seuils** (Super Admin), bornés et persistés (`RiskSetting`), lus à chaud. **Règle anti-bureaucratie** :
> Brain **lit, relie, résume, explique et propose** — il ne duplique aucun workflow et ne crée qu'après confirmation.

---

## 📈 Score d'adoption (Super Admin · `/admin` → onglet Adoption)

Mesure, **en temps réel** sur 30 jours glissants, à quel point chaque personne utilise réellement l'OS.
**Réservé à l'administration**, sur **données réelles**, **anti-gaming** : Régularité (jours distincts),
Interaction (signaux bilatéraux), Travail durable (réellement terminé), Étendue (rapportée aux droits),
Diversité, Temps d'activité (plafonné), Récence. Score 0–100 + libellé + tendance + classement.
**Poids & paliers configurables** (`AdoptionSetting`). **Pastille personnelle** dans la barre du haut (snapshot
mis en cache). Le Super Admin n'est pas mesuré.

---

## 💬 Messagerie interne (temps réel)

- **3 types** : message direct, **groupe** privé, **canal** d'équipe.
- markdown léger, **@mentions**, **réactions**, **réponses citées**, **épinglage**, favoris, édition/suppression,
  **pièces jointes** (Drive chiffré), **présence**, **« en train d'écrire… »**, **accusés de lecture / non-lus**,
  recherche, sourdine, rôles (OWNER/ADMIN/MEMBER).
- 🔔 **Notification sonore** à la réception d'un message — un bip généré à la volée (Web Audio API), **débloqué au
  premier geste** de l'utilisateur (politique d'autoplay) et qui **retentit même quand l'onglet AMD est en
  arrière-plan** (vous êtes sur un autre site) grâce au **polling continu**.
- 📎 **Pièces jointes** : un fichier reçu ne se télécharge plus automatiquement au clic — le nom ouvre un **aperçu**
  (inline, nouvel onglet) et une **icône dédiée** permet le **téléchargement explicite**.
- **Accès gouverné par l'appartenance** (`ConversationMember`), **jamais** par scope RBAC — **même le Super Admin
  ne lit pas par-dessus l'épaule**. Un tiers non-membre reçoit **403**.
- **Temps réel sans WebSocket** : server actions + **UI optimiste** + **polling**, présence par heartbeat.

---

## 📧 Courrier — webmail Infomaniak intégré

Boîte mail **par utilisateur**, connectée à la plateforme (une seule entité).

- **IMAP** (lecture) + **SMTP** (envoi) via `imapflow` / `nodemailer` / `mailparser`, mot de passe d'application
  **chiffré AES-256-GCM** au repos (`MailAccount`).
- Webmail **3 volets** (dossiers · liste · lecture/composition), aperçu HTML en **iframe sandbox**, **plein écran**.
- **Dossiers** commutables : **Réception · Envoyés · Corbeille · Brouillons · Indésirables · Archives**.
- 🔎 **Recherche** plein-texte (IMAP SEARCH sur expéditeur / destinataire / Cc / objet / contenu) — retrouve aussi
  les **correspondants externes** à la société.
- 🎚️ **Filtres** rapides (**Tous / Non lus**), effacement de la recherche en un clic, **limite de mails chargés élevée**.
- ↩️ **Répondre**, **Répondre à tous** (sans se ré-adresser à soi-même), **Transférer** (citation du message d'origine).
- 👥 **Carnet de contacts** (collègues + correspondants récents internes/externes) avec **autocomplétion**.
- 📎 **Aperçu des pièces jointes** (PDF / image / texte) avant téléchargement ; **« Lier à un dossier »**.
- 🛡️ **Anti double-envoi** (verrou synchrone) ; couche serveur `src/lib/mail.ts`, routes `/api/mail/{messages,message,attachment,contacts}` (auth + scoping).
- 🤖 **Connecté à l'Assistant IA** : lire / résumer / chercher dans **votre** boîte, **rédiger** un e-mail (envoyé après confirmation).

> Par défaut, les serveurs pointent sur `mail.infomaniak.com` (IMAP 993 / SMTP 465) — modifiables par utilisateur.
> Un **endpoint de diagnostic** (admin) classe les erreurs IMAP brutes d'Infomaniak pour un dépannage rapide.

---

## 📝 Édition Office (OnlyOffice) & impression

Édition **Word / Excel / PowerPoint** directement dans l'app, **sans dépendance cloud externe** — dans le **Drive**
comme sur **toutes les pièces jointes des modules**.

- Bouton **« Éditer dans Office »** sur les fichiers éditables (Drive → `/drive/[id]/edit` ; Documents → `/documents/[id]/edit`,
  **plein écran**, sauvegarde = nouvelle version). Visible uniquement aux personnes ayant le **droit de modifier**.
- **Chargement plus rapide** et **mode plein écran** de l'éditeur.
- Aperçu in-app (lecture seule) **et 🖨️ impression** conservés pour PDF / Word / Excel / PowerPoint / images **partout**
  (`src/lib/print-document.ts` : iframe same-origin, repli `window.open`).
- Config **signée en JWT HS256** (`src/lib/onlyoffice.ts`) ; le Document Server lit le fichier via un **jeton signé**
  (`edit` Drive / `docedit` Documents) et **rappelle** la sauvegarde sur `/api/onlyoffice/callback`.
- **Inerte** tant que les variables ne sont pas posées (aucun bouton « Éditer »).

> ⚠️ **Déploiement** : le Document Server doit être un **Web Service public** ; `JWT_SECRET` **identique** à
> `ONLYOFFICE_JWT_SECRET` ; `APP_URL` = URL **publique** de l'app (pour le callback).

---

## 🗃️ Modèle de données — entités clés

**93 modèles** Prisma, **86 enums**. Quelques entités structurantes (référence `prisma/schema.prisma`) :

| Domaine | Modèles clés |
|---|---|
| **Identité & accès** | `User`, `UserAccess` (overrides), `RowGrant` (grants par ligne), `Session`, `LoginAttempt`, `AppSetting`. |
| **Ad & Pro** | `SponsoringRequest`, `CongressInternational`, `CongressNational`, `Event` (+ `EventRegistration`), `PromoMaterial`, `MissionAssignment`. |
| **Budgets & Finances** | `BudgetEnvelope` (`accessRoles`, `accessUserIds`, `modules[]`), `BudgetCategoryLine` (auto-relation `parentId` = sous-catégories), `ExpenseOrder`, `FinanceTransaction`, `Payroll`, `SalaryAdvance`. |
| **Regulatory & PCH** | `RegulatoryProduct` (+ étapes/documents), `Supplier`, `PchTender` + bons de commande + caution, `StockMovement`. |
| **Information médicale** | `MedicalInfoDeclaration` (`sourceType`/`sourceId` polymorphe → événement source, clé unique). |
| **Promotion médicale** | `MedicalDoctor`, `MedicalVisit`, `DelegatePlan`, segmentation par spécialité/produit. |
| **Transverse** | `AdministrativeRequest` (+ cellules/approbations), `OfficeSupplyArticle`, `ValidationRequest` (+ steps + rules), `Dossier` (+ `DossierMessage`), `Directive`, `SupportRequest`, `Document` + `FileBlob` (chiffré), `Comment`, `AuditLog`, `Notification`. |
| **Messagerie & Courrier** | `Conversation`, `ConversationMember`, `Message` (+ réactions/attachments), `MailAccount` (chiffré). |
| **IA & Brain** | `AiUsageLog`, `RiskSetting`, `AdoptionSetting`, `FieldReport`. |
| **Externe** | `Supplier`, `SupplierUser` (auth séparée). |

> Les entités « source d'une dépense » sont **polymorphes** : `ENTITY_MODULE` (dans `entity-access.ts`) mappe chaque
> `EntityType` vers son module, ce qui permet l'attribution budgétaire automatique et le contrôle d'accès par ligne
> **sans** table de jointure dédiée par type.

---

## 🚀 Démarrage local

### Prérequis
- **Node.js ≥ 18** · une base **PostgreSQL** accessible

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

`db:bootstrap` crée **uniquement** votre Super Admin (idempotent). Connectez-vous, puis dans **Administration** :
créez les comptes de l'équipe, attribuez les accès (onglet × action × ligne), suivez connexions/sessions.

---

## 🔧 Variables d'environnement

| Variable | Requis | Description |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Chaîne de connexion PostgreSQL. |
| `AUTH_SECRET` | ✅ | Secret Auth.js (`openssl rand -base64 32`). Sert aussi de clé maître au chiffrement Drive/mail. |
| `AUTH_TRUST_HOST` | ✅ (prod) | `true` derrière un proxy (Render/Vercel). |
| `ADMIN_EMAIL` · `ADMIN_PASSWORD` · `ADMIN_NAME` | ✅ | Compte Super Admin initial créé au bootstrap. |
| `ANTHROPIC_API_KEY` | ⬜ | Active l'**Assistant IA**, l'analyse des rapports vocaux, les synthèses Brain/Process Intelligence/réunions. |
| `OPENAI_API_KEY` | ⬜ | Active la **transcription vocale** (Whisper). |
| `MAX_UPLOAD_MB` | ⬜ | Taille max d'upload par défaut (réglable aussi en base depuis l'admin). |
| `APP_URL` | ⬜* | URL **publique** de l'app — requise pour le callback OnlyOffice. |
| `ONLYOFFICE_URL` | ⬜* | URL **publique** du Document Server OnlyOffice. |
| `ONLYOFFICE_JWT_SECRET` | ⬜* | Secret JWT **identique** à celui du Document Server. |
| `MAIL_ENCRYPTION_KEY` | ⬜ | Clé dédiée au chiffrement des mots de passe e-mail (sinon retombe sur `AUTH_SECRET`). |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | ⬜ | Notifications **push** (PWA Web Push). |

> \* Requis **ensemble** uniquement pour activer l'édition Office. Côté **service OnlyOffice**, poser
> `JWT_ENABLED=true` et `JWT_SECRET=<même valeur que ONLYOFFICE_JWT_SECRET>`.

---

## ☁️ Déploiement — Render

Un **Blueprint** [`render.yaml`](render.yaml) provisionne **l'app Next.js + une base PostgreSQL managée**,
applique les migrations et crée le Super Admin (aucune donnée de démo).

1. [dashboard.render.com](https://dashboard.render.com) → **New + → Blueprint**, connecter ce dépôt.
2. Renseigner `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (`DATABASE_URL` et `AUTH_SECRET` gérés automatiquement).
3. **Apply** → Render exécute `npm install && prisma generate && prisma migrate deploy && db:bootstrap && next build`.

> **Conflit de dépendances résolu** : `imapflow` tire `nodemailer@9`, en conflit avec le peer optionnel
> `nodemailer@6` de `next-auth` (inutilisé). Le fichier **`.npmrc`** (`legacy-peer-deps=true`) règle le
> `npm install` de Render automatiquement.

### Activer OnlyOffice (optionnel)

1. Déployer le **Document Server OnlyOffice** en **Web Service public**, avec `JWT_ENABLED=true` et un `JWT_SECRET`.
2. Sur l'app : poser `ONLYOFFICE_URL`, `ONLYOFFICE_JWT_SECRET` (**le même secret**), `APP_URL`.

> 🆓 Plan gratuit Render : la base Postgres expire après ~30 jours et le service se met en veille — passer en plan
> payant pour une base durable + service always-on.

---

## 🗄️ Base de données & migrations

- **93 modèles**, **86 enums**, **69 migrations**.
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

**Chaîne (extrait récent)** : … → `doctor_segmentation` → `envelope_module` → `budget_total_access` →
`regulatory_dosage_unit` → `admin_requests_batch_g` → `envelope_multi_module` → `budget_category_module` →
`national_sales_role` → `event_request_workflow` → `budget_subcategories_user_access`.

> ⚠️ **PostgreSQL 16** : `ALTER TYPE … ADD VALUE` est transactionnel mais la nouvelle valeur d'enum **ne peut pas
> être utilisée dans la même migration**. Les migrations sont donc écrites **à la main** (SQL idempotent :
> `ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, contraintes en bloc `DO $$ … EXCEPTION …`).

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
  Postgres (mock de session) — information médicale, dossiers, directives, support, OnlyOffice (JWT), stockage
  durable, validation des imports Drive, score d'adoption anti-gaming, atterrissage sûr, matériel promotionnel,
  assistant IA, courrier, réunions. **110 passés · 23 skip propres** (sans base, CI verte partout).
- **Porte de vérification** avant chaque push (jamais contournée) :

```bash
npx tsc --noEmit && npm run build && npx vitest run
```

> Les tests d'intégration **skippent proprement** si aucune base n'est disponible (CI verte) et **s'exécutent
> tous** dès que Postgres est présent — on retombe alors sur le référentiel **110 passés / 23 skip**.

---

## 🏗️ Architecture du code

```
src/                                  # ~434 fichiers TS/TSX (hors tests) · 40 composants · 21 tests
├── app/
│   ├── (auth)/login/                  # connexion
│   ├── (app)/                         # shell authentifié (sidebar + topbar) — 86 pages
│   │   ├── mon-travail · mon-espace · messages · courrier · directives · assistant
│   │   ├── dashboard · regulatory · sponsoring · budgets · finances · rh
│   │   ├── congress-international · congress-national · events · sales · promo-material
│   │   ├── logistics · pch · stocks · medical · information-medicale · calendar · meetings
│   │   ├── business-development · validations · drive · documents · dossiers
│   │   ├── demandes (+ corbeille) · support · feedback · mon-dossier · missions
│   │   ├── adventum-brain · process-intelligence · admin · search
│   │   └── …                          # chaque module = liste + détail
│   ├── (portal)/portail/              # portail fournisseur (auth séparée)
│   ├── inscription/[id]/              # billetterie publique (hors auth)
│   └── api/                            # 32 routes
│       ├── auth/[...nextauth] · documents/[id] · drive/* · mail/*
│       ├── messaging/* · events/qr/[token] · field-reports/*
│       └── onlyoffice/{file,callback} · process-intelligence/synthesis
├── components/   ui/ · shared/ (DataTable, StatusBadge, DocumentPreview, ModuleTabs, ThirdPartyInvolveButton…) · layout/ · documents/ · dashboard/
├── lib/                                # 134 fichiers
│   ├── rbac.ts            # matrice + scoping row-level (cœur de la sécurité)
│   ├── session.ts         # requireUser / requireModule (gardes serveur)
│   ├── entity-access.ts   # contrôle d'accès par ligne (polymorphe) + ENTITY_MODULE
│   ├── refs.ts            # génération de références robuste (anti-collision P2002)
│   ├── third-party.ts     # « impliquer une tierce personne » (validation + dossier auto)
│   ├── dossiers-core.ts · medical-info.ts · expense-orders.ts · validation.ts
│   ├── audit.ts · notify.ts · labels.ts (libellés + navigation)
│   ├── ai.ts · assistant.ts          # couche IA + boucle agent
│   ├── mail.ts · onlyoffice.ts · print-document.ts · drive-storage.ts (chiffrement)
│   ├── actions/           # 54 fichiers de server actions par module
│   └── queries/           # 27 fichiers de requêtes agrégées (dashboard, action-center, budget…)
└── prisma/
    ├── schema.prisma      # 93 modèles, 86 enums, relations, index
    └── bootstrap.ts       # Super Admin initial (idempotent, aucune donnée de démo)
```

> 🐍 Un prototype historique **Streamlit + SQLite** subsiste dans [`streamlit_app/`](streamlit_app/) — l'édition
> **Next.js + PostgreSQL** (ce dossier racine) est **le** produit de référence.

---

## 🧾 Journal des évolutions récentes

Sélection des lots livrés récemment (chaque lot est vérifié `tsc` + `build` + `tests` avant push) :

- **Rôle National Sales** — nouveau rôle (capacités du délégué médical + **approbation préliminaire** des demandes
  Ad & Pro / événements avec **choix du chef de produit**). Portée ALL pour voir toutes les demandes.
- **Étape préliminaire réservée au National Sales** — le choix du chef de produit ne se fait plus via la Direction
  Marketing ; il est réservé au National Sales (Super Admin en secours). La **décision finale** reste à la Direction.
- **Workflow de prise en charge étendu aux Événements** — le module Events reçoit le **même circuit** que les
  congrès (soumission → National Sales → chef de produit → Direction → information médicale → Finances).
- **Impliquer une tierce personne** — étendu du sponsoring aux **congrès et événements**, avec **dossier de suivi
  auto-créé** indiquant l'événement (sans budget) et une demande dans l'espace de la personne.
- **Budgets** — **sous-catégories** (ex. Table ronde sous Événement), **vue consolidée du total des enveloppes**,
  **accès par personne** (en plus des rôles), attribution auto des dépenses à la catégorie du module.
- **Bureau du secrétariat** — dans la fenêtre de 15 min, le demandeur peut modifier **tous les champs** qu'il a
  saisis (plus seulement la description).
- **Messagerie** — **notification sonore** qui fonctionne en arrière-plan ; **aperçu / téléchargement** des pièces
  jointes (plus de téléchargement automatique au clic).
- **Information médicale** — le PRIM **visualise les pièces de l'événement source**, **upload** de la déclaration
  (non obligatoire), affichage du **demandeur**.

---

## 🧭 Feuille de route

**Grand chantier à venir — données de référence (master data).** Import prévu de **+600 000 produits / 7 800
sociétés pharma**, **nomenclature algérienne**, **IQVIA 2025-2026**, **achats PCH 2025** :
- Espace **« Référentiels »** dédié (Fournisseurs Monde, Produits Monde, Nomenclature DZ, Marché IQVIA, Achats PCH).
- **Pagination + recherche côté serveur** (index `pg_trgm` / full-text).
- **Pipeline d'import par lots** (worker Render) + **tâches de fond / cron** (imports, alertes d'expiration GMP/AMM/cautions).
- La valeur = la **connexion** (IQVIA → scoring BD, Nomenclature DZ → veille concurrentielle, etc.).

**Autres pistes** : reporting/BI consolidé + exports PDF/Excel planifiés · notifications e-mail/SMS · **veille des
appels d'offres PCH** · suivi des échéances documentaires · contrats/conventions/licences · objectifs commerciaux
vs réalisé · lots & péremptions / pharmacovigilance · export comptable (G50) · **PWA** · annotations PDF.

---

## 🤝 Conventions & contribution

- Développement sur la branche **`claude/hopeful-goodall-phd0nb`**.
- Tout doit être **réel et vérifié** : `typecheck` + `build` + `tests` **verts** avant de pousser. **Aucune donnée simulée.**
- Les fichiers `"use server"` n'exportent **que** des fonctions `async`.
- Migrations : SQL manuel dans `prisma/migrations/<ts>_<nom>/migration.sql` + `prisma migrate deploy` (idempotent).
- Références séquentielles via `src/lib/refs.ts` (`buildRef` + `createWithRetry`) — **jamais** `count()+1`.
- `PERMISSIONS` (rbac.ts) est **exhaustif** : tout nouveau rôle impose une entrée (le typecheck l'exige).
- Secrets **toujours côté serveur**, jamais committés ni exposés au client.

---

<div align="center">

**© 2026 Adventum Pharma — AMD Internal OS**

*Un seul outil. Toute l'entreprise. 100 % digitalisé.*

</div>
