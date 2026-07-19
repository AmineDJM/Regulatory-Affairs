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
- [**Référence détaillée des circuits & mécanismes transverses**](#-référence-détaillée-des-circuits--mécanismes-transverses)
- [Carte du code — fichiers clés par domaine](#-carte-du-code--fichiers-clés-par-domaine)
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
Events · Matériel promotionnel), **Finances** (Finances · Espace comptable),
**Mon dossier RH** (dossier RH · Mes ordres de mission), **Mon espace** (Mon travail · Mon espace · Directives).
**Logistique** et **Stocks** sont deux modules distincts de la sidebar (séparés depuis la refonte Stocks).
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
| **Mon dossier RH** | `/mon-dossier` | Documents RH personnels (contrats, bulletins, attestations) + **demandes RH** (attestation, CNAS, relevé d'émoluments, titre/demandes de congé — annuel, sans solde, exceptionnel, maternité —, sortie exceptionnelle, arrêt maladie, **note de frais avec mois obligatoire**, **entrevue avec les RH** à date négociée) avec **pièces jointes** et **fil d'échange** par demande + onglet **« Mes ordres de mission »**. Carte **« Ma rémunération »** (salaire de base, Ret SS 9 %, Ret IRG, Remb. frais, Net à payer — **jamais** le brut, la Ret SS 35 % ni la TFP). Notification **« salaire versé »** reçue **24 h après** le marquage par les RH. Accès **strict** à ses propres documents. |
| **Calendrier** | `/calendar` | Agenda d'entreprise (fuseau **Alger**), création de rendez-vous + invitations, **accessible à l'Assistant IA** (créer/inviter par la conversation). |
| **Réunions** | `/meetings` | Appels & réunions (lien Meet simple **ou présentiel avec lieu**) + **fil de discussion** (chat texte + pièces jointes) + **réponse d'invitation** (Oui/Peut-être/Non) + **enregistrement / transcription / compte-rendu IA** + **rappel 30 min avant** (notification planifiée). L'organisateur peut **modifier** titre, objet, lien, type et **horaire** (heure d'Alger). |
| **Dashboard** | `/dashboard` | KPIs & graphiques adaptés au rôle. |

### Pôles métier

| Module | Route | Description |
|---|---|---|
| **Regulatory** | `/regulatory` | Dossiers **AMM / ANPP**, **workflow 17 étapes** + **processus officiel ANPP** (22 étapes / 5 phases) + checklist de présoumission, documents par molécule, **DCI mono / double / triple**, commentaires, champs personnalisés. Catégorie **Médicament / Dispositif médical**. **Référentiel fournisseurs** créé par les responsables réglementaires (menu déroulant dans les dossiers), colonnes **Forme** (galénique) et **Dosage + unité** (mg/g/µg/UI/%…) en menus déroulants. Section **Réserves** (upload PDF). **Demande de BV** → ordre de dépense (échéance). **Détenteur de DE** + **variation d'enregistrement** (packaging secondaire / primaire / full process, avec date) — toute variation en **fabrication locale exige le Fabricant** (bloqué serveur + champ requis). Carte **« Vue fournisseur »** (pilote le portail externe). |
| **Ad & Pro** | `/sponsoring` (+ onglets) | Module unifié **Sponsoring · Congrès internationaux · Événements nationaux · Events · Matériel promotionnel**. Circuit de demande avec le **National Sales** (approuve + **désigne le chef de produit**), **analyse confidentielle du chef de produit**, **tierce personne** impliquée via son espace (+ dossier auto), **décision définitive de la Direction** (budget accordé visible), enchaînement **Information médicale → Finances**. **Liste des personnes prises en charge** (pièces d'identité) + **ordre de mission**. → [workflows](#-workflows-critiques) |
| **Budgets & enveloppes** | `/budgets` | **Enveloppes budgétaires** (Super Admin, délégable) : période, **modules rattachés**, **catégories + sous-catégories**, **budget total** fixe ou flexible, **allocation** des dépenses validées, **vue consolidée** du total de toutes les enveloppes, **accès par rôle ET par personne**. → [détails](#-budgets-enveloppes--sous-catégories) |
| **Finances** | `/finances` | **Solde de trésorerie initial** + calcul, livre, **paie**, **ordres de dépense**, synthèse comptable (onglet **Espace comptable** : à régler, recettes attendues, résultat mensuel). |
| **RH** | `/rh` | Employés (contrats, **périodes d'essai** avec renouvellement et 2ᵉ période, congés, avances), **éléments de salaire du bulletin** (base, Ret SS 9 %/35 %, TFP, Ret IRG, remb. frais, net à payer, brut — 3 champs confidentiels côté salarié), file **« Demandes RH à traiter »** (toutes les demandes de Mon dossier RH), **traitement des notes de frais** (validation mois demandé / mois suivant, verrouillée tant que le secrétariat n'a pas accusé réception des originaux), **entrevues RH** (proposition/contre-proposition de date → rendez-vous au calendrier), onglet **Paie** (matrice employés × mois). → [référence](#-référence-détaillée-des-circuits--mécanismes-transverses) |
| **Ventes** | `/sales` | CA pharma/PCH, **import CSV**, type **Produit / Service**. |
| **Logistique PCH** | `/logistics` | Module autonome : import / expéditions fournisseurs, dates estimées vs réelles, dédouanement. |
| **PCH — Marchés** | `/pch` | **Marchés publics gagnés** : appels d'offres → **bons de commande** + **caution** (alertes d'expiration). → [détails](#pch--marchés-publics) |
| **Stocks** | `/stocks` | Refonte en **états datés** (« à cette date, il reste X ») — **sans** entrées/sorties : 3 onglets **Stock PCH · Stock hôpitaux · Annexes PCH** (hôpitaux **et** annexes PCH = lieux nommés, créés/supprimés **uniquement par le Super Admin**), **vue par produit** (catalogue Regulatory) en **graphique** (courbe date → quantité) ou **tableau** (avec évolution entre relevés), un état par jour (ressaisie = correction). Le détecteur « Stock PCH bas » du Brain lit en priorité le dernier état. |
| **Rapports terrain** | `/field-reports` | **Rapports vocaux IA** des délégués : parler → transcription → analyse → relecture → validation. Intégrés à **Promotion médicale**. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Promotion médicale** | `/medical` | **Annuaire structuré** : Spécialité → Secteur (Hôpital / Libéral) → médecins, titre/grade. **Segmentation à 5 niveaux** (Très haut / Haut / Moyen / Bas / Très bas) pour **influence**, **potentiel** et **affinité**, **par spécialité et par produit**, médecins **et** pharmaciens. Visites & tournées **scopées par délégué**, plans de tournées **duplicables**. |
| **Information médicale** | `/information-medicale` | Module du **pharmacien responsable de l'information médicale (PRIM)** : déclaration réglementaire **intercalée** entre la validation de la Direction et l'ordre de dépense ; **consultation des pièces de l'événement source**, upload de la déclaration, affichage du demandeur. → [workflow](#information-médicale--déclaration-réglementaire-prim) |
| **Business Development** | `/business-development` | **Grand tableau stratégique Projet → Gamme → Produit** (~20 colonnes), colonnes gelées, export CSV. **Intègre Pharmatool** : pipeline de données concurrentielles, **Vue d'ensemble**, **moteur de matching DCI**, **Opportunités**, **Pricing** (ville / hôpital), **Analyse produit / concurrence** (HHI, parts de marché, radar). |

### Transverse

| Module | Route | Description |
|---|---|---|
| **Demandes de validations** | `/validations` | **Bureau de validation central** : agrège **toutes les validations en attente** issues des autres modules (Bureau du secrétariat, Ad & Pro, **Finances**, information médicale…) — visible des **validateurs** (pas du demandeur). Le Super Admin définit des **règles configurables** (module, type d'objet, montant, département, rôle, priorité → 1 ou 2 validateurs, séquentiel/parallèle). → [détails](#centre-de-validation-agrégation--configurable) |
| **Documents** (Drive + Documents) | `/drive` | Stockage **chiffré et durable en base** (`FileBlob`), visionneuses PDF / Word / Excel / PowerPoint / images / vidéo / audio, **édition Office** (OnlyOffice), **impression**, versioning. **Imports larges**, **déplacer**, **corbeille en cascade**, **accès par personne** (voir / modifier) à l'import. |
| **Projets** | `/dossiers` | **Projet** de suivi d'un sujet ad hoc : description, **responsable + participants**, statut, **fichiers** et **fil de discussion**. Créable **manuellement**, **proposé par l'IA**, ou **créé automatiquement** quand on implique une tierce personne sur un événement. (Route interne `/dossiers`, entité `Dossier` inchangées.) |
| **Bureau du secrétariat** | `/demandes` | « Bureau de l'assistante de direction » : **10 types** de demandes, **catalogue d'articles de fourniture**, **demandes multi-cellules**, **fenêtre de 15 min** pour que le demandeur **modifie TOUT ce qu'il a saisi** ou supprime sa demande, **suppression traçable** (corbeille + motif), **flux par demande** (achat → validation Finances → devis/facture → Fin de la demande), validations, ordres de dépense, **espace Courses** (`/demandes/courses` : courses chauffeur **multi-points A/B/C** avec consigne par point, date **et heure max** — heure d'Alger —, pièces jointes, vue chauffeur en checklist), **accusé de réception des originaux de notes de frais** (section dédiée sur `/demandes`, verrouille/déverrouille le traitement RH), demandes terminées **archivées dans le Drive** (« Dossier traité »). → [workflow](#bureau-du-secrétariat--flux-par-demande) |
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
| **Administration** | `/admin` | Comptes (création, **modification e-mail/profil/rôle**), **matrice d'accès** (onglet × action × ligne), **sessions révocables**, activité, **journal d'audit** (paginé), **champs personnalisés**, règles de validation, feedback, comptes portail fournisseur, **Vue exacte** (impersonation), **Contrôle IA** + **Score d'adoption** en onglets, **limites d'upload** configurables, **Corbeille des suppressions définitives** (`/admin/corbeille` — chaque suppression définitive est **restaurable** jusqu'à destruction réelle), carte **Stockage Drive** (consommation exacte globale dédupliquée + par utilisateur, **capacité et quota modifiables et appliqués à l'envoi**), colonne **« Dernière activité (dernier clic) »** précise à la minute. |
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
- **Tâches / Messages → Projets** : un message peut devenir une **tâche demandée** ; une tâche peut ouvrir un projet.
- **Tierce personne → Projets** : impliquer quelqu'un sur un événement **crée automatiquement un projet** (sans budget).
- **Tous les modules → Validations** : chaque circuit d'approbation remonte dans le **bureau de validation central**.
- **RH (Paie) → Finances & Budgets** : « Transférer dans le budget » crée **une écriture Salaire (sortie) par employé** imputée à la (sous-)catégorie choisie ; la fiche de paie part dans le **dossier RH** de l'employé ; l'employé est notifié **24 h après** (tâches planifiées internes).
- **Notes de frais : RH ⇄ Bureau du secrétariat** : le traitement RH est **verrouillé** tant que le secrétariat n'a pas **accusé réception des originaux** (accusé tracé, visible des deux côtés, notifié).
- **Demandes traitées → Drive (« Dossier traité »)** : demandes RH, demandes administratives (Terminée) et déclarations PRIM sont **auto-archivées** (récapitulatif + copie des pièces) dans la boîte Drive du traitant, reclassable librement.
- **Réunions planifiées → Calendrier** : les réunions apparaissent dans le calendrier (heure d'Alger) avec lien « Rejoindre ».
- **Suppression définitive → Corbeille Super Admin** : instantané restaurable (ligne + pièces + commentaires) au lieu d'une destruction directe.
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
- 🔢 Identifiants **cuid** non séquentiels ; upload contrôlé (**exécutables bloqués** + **taille configurable**,
  tous autres types acceptés) ; download protégé par vérification d'accès.

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

> Depuis le **moteur de workflow no-code**, le circuit Ad & Pro ci-dessous est la **configuration PAR DÉFAUT**
> (seed automatique) : le Super Admin peut le remodeler étape par étape dans Administration → Circuits de
> validation. Détails d'implémentation : [référence détaillée](#-référence-détaillée-des-circuits--mécanismes-transverses).

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

**Appel d'offres** (réf. auto `AO-année-n`) → **lignes-produits** (`PchTenderLine`) → **caution obligatoire**
(montant, dates, alertes) → **bons de commande** (réf, qté, valeur, date réception, date paiement).

**Chaîne d'automatisation d'une ligne-produit** (`src/lib/actions/pch-tender-line-actions.ts`,
`src/lib/market/pch-lookup.ts`, RBAC `PCH`/`UPDATE`) :
1. **Extraction** — `analyzeTenderDocument` (upload PDF/image → **OCR Mistral** `ocrDocument` → Claude) ou
   `analyzeTenderText` (texte collé → Claude) ; helper commun `extractAndSaveLines` (désignation, DCI, dosage,
   forme, quantité en unités, `unitsPerBox`). Nombre de boîtes = ⌈unités / `unitsPerBox`⌉.
2. **Enrichir** (`enrichTenderLine`) — **verrou prix** depuis les **réceptions PCH 2025** (`pchReceptionPrice`,
   vérifie DCI + dosage + forme → `refPriceDzd` + `refPriceSource`) ; **nomenclature** (`nomenclatureMatch`) ;
   **notre produit** (`matchOurProduct` sur `RegulatoryProduct` → `ourProductId`, `registeredOurs`, `haveProduct`) ;
   **concurrents** + **estimation marché** (`getRecommendations`).
3. **Suivi commercial** : `PchLineStatus` PENDING → QUOTED → SUBMITTED → **WON** → LOST (+ `awardedUnitPriceDzd`).
4. **Ventes réelles** — une ligne **WON** génère des **bons de commande** = **fractions** (`createOrderFromLine`,
   `PchOrder.lineId`) ; **taux de réalisation** = Σ quantités des bons / quantité attribuée.
5. **Logistique** — chaque bon de commande porte `expectedArrival` / `arrivedDate` (`setOrderArrival`).

### Portail Fournisseur (externe sécurisé)

Comptes externes **totalement séparés** (`Supplier` / `SupplierUser`, **auth distincte** cookie HMAC scopé
`/portail`). Un fournisseur ne voit **QUE** ses produits `portalVisible` et **seulement les champs externes**.

### Vue exacte (impersonation)

Le Super Admin visualise l'OS **exactement comme** un utilisateur. Cookie honoré **uniquement** si la session
réelle est Super Admin. Bandeau permanent + « Quitter », démarrage/arrêt journalisés.

---

## 📖 Référence détaillée des circuits & mécanismes transverses

> **Section de référence pour le développement** (humain ou IA) : chaque circuit est décrit avec ses **règles
> exactes telles que codées**, ses **gardes RBAC**, ses **modèles Prisma** et ses **fichiers sources**. À lire avec
> `CLAUDE.md` (règles Graphify) : cette section évite de relire le code pour comprendre un flux.

### Dimension multi-entités (sociétés du groupe)

Le groupe compte **plusieurs sociétés** (par défaut **Adventum Pharma** et **Pharmagène**, plus toute entité créée
ensuite). C'est une **dimension transverse** appliquée à tout le logiciel :

- **Modèle** : `Company` (`name` unique, `shortName`, `color`, `isActive`, `sortOrder`) — entièrement **dynamique**
  (création / renommage / couleur / désactivation dans **Administration → Entités**, `src/app/(app)/admin/entites/`).
  Chaque enregistrement clé porte un `companyId?` **nullable** (non rattaché = visible en vue « Toutes »).
- **Domaines rattachés** (`companyId` + relation `company`) : `RegulatoryProduct`, `PchTender` (appels d'offres),
  `Employee`, `PromoMaterial` (Ad & Pro), `MedicalDoctor` (promotion médicale), `FinanceTransaction`,
  `MedicalInfoDeclaration`, `StockSnapshot`, `LogisticsOrder`, `Sale`. Les **stocks héritent** de l'entité de leur
  produit Regulatory (aucun champ à saisir).
- **Sélecteur de portée** (barre supérieure, `CompanySwitcher`) : « Toutes les entités » (aucun filtre) ou une entité
  précise. Mémorisé dans le cookie `amd-company` ; helper serveur `getCompanyScope()` + `currentCompanyWhere()`
  (`src/lib/company.ts`, défensif hors requête → aucun filtre en test). Chaque **liste** de domaine applique
  `...currentCompanyWhere()` sur son `where`; chaque **formulaire de création** propose un menu « Entité »
  (`companyOptions(getCompanies())`). Pastille `CompanyBadge`.
- **Actions** : `setCompanyScope`, `createCompany`, `updateCompany`, `toggleCompany` (`company-actions.ts`, réservées
  à `ADMIN:CREATE`). **Fichiers clés** : `src/lib/company.ts`, `src/lib/actions/company-actions.ts`,
  `src/components/layout/company-switcher.tsx`, `src/components/shared/company-badge.tsx`.
- ⚠ **Ne pas confondre** avec l'enum polymorphe `EntityType` (type d'objet pour Documents/Commentaires/accès) : la
  société est le modèle **`Company`** (libellé UI « Entité »).

### Moteur de workflow dynamique (Ad & Pro — 4 catégories)

Le circuit Sponsoring / Congrès intl / Événements nationaux / Events est piloté par un **moteur 100 % dynamique**
éditable en no-code par le Super Admin (Administration → Circuits de validation) :

- **Modèles** : `WorkflowDefinition` (1 par catégorie) → `WorkflowStep[]` (position, slug, titre, `actorRoles[]`,
  `actorScope` ROLE|ASSIGNEE|GLOBAL_VIEW|REQUESTER, `powers[]` APPROVE|REJECT|ASSIGN|SET_AMOUNT|SET_CATEGORY|COMMENT,
  `assignRole`, `requireAmount/Category/Note`, `emitDeclaration/ExpenseOrder`, `notifyRoles[]`, `optional`,
  `confidential`, `legacyStatus`) → `WorkflowInstance` (unique par entityType+entityId, `currentSlug`, statut
  IN_PROGRESS|APPROVED|REJECTED, `amount`, `budgetCategoryId`, `assigneeId`) → `WorkflowStepEvent`
  (APPROVE|REJECT|OPINION_AGAINST|COMMENT).
- **Règles clés** : un REJECT **non terminal** = `OPINION_AGAINST` (avis défavorable) et **le flux continue**
  (l'assignation reste requise) ; seul le refus de la **dernière étape** (Direction) est éliminatoire. Le moteur
  **projette les statuts legacy** sur les entités (les listes/badges existants continuent de fonctionner). Les
  étapes `confidential` (analyse chef de produit) sont **caviardées** pour le demandeur. Méta du workflow +
  **historique complet** visibles **uniquement du Super Admin**.
- **Fichiers** : `src/lib/workflow/engine.ts` (avance/refus/projection ; ⚠ `Event` n'a pas `updatedById` — il est
  retiré avant update), `defaults.ts` (seed paresseux reproduisant le circuit historique), `src/lib/queries/workflow.ts`
  (vue caviardée), `src/components/workflow/workflow-panel.tsx` (panneau runtime), builder sous `/admin/workflows`.

### RH — pré-remplissage IA du contrat + congés (acquisition & consommation)

- **Contrat → fiche employé (IA)** : `analyzeEmployeeContract` (`src/lib/actions/hr-actions.ts`, gate `RH:CREATE`)
  fait **OCR Mistral** (`ocrDocument`, fr/en/ar) puis **Claude** pour renvoyer un objet de champs (nom, poste,
  type de contrat ∈ CDI/CDD/INTERIM/STAGE/FREELANCE/OTHER, dates ISO, salaire, NIN, CNAS…). **Ne persiste rien** :
  les valeurs pré-remplissent le formulaire (prop `analyze` de `CreateRecordButton`, re-montage des champs par
  `key`), le RH corrige puis enregistre via `createEmployee`.
- **Acquisition automatique — +2,5 j/mois** : `accrueMonthlyLeave()` (`src/lib/scheduled.ts`, appelée par
  `runScheduledJobs`, ~1×/min). Marqueur `Employee.leaveAccruedThrough` (« YYYY-MM » Alger). Idempotent : crédite
  `2,5 × nombre de mois` écoulés puis avance le marqueur ; **amorçage sans rétro-crédit** (marqueur posé au mois
  courant, solde préservé). **Modif manuelle** : champ `leaveBalanceDays` de la fiche (`updateEmployee`).
- **Consommation du solde** : à l'approbation d'un **congé annuel** — via `LeaveRequest`/`decideLeave` (Mon espace)
  **ou** via `HrDocumentRequest` type `ANNUAL_LEAVE` passé à READY (`processHrRequest`) — le solde est **débité une
  fois** (verrou `balanceAppliedAt` côté demande RH). Les congés **sans solde / exceptionnel / maternité** ne
  débitent pas.
- **Demandes RH par type** (`requestHrDocument`) : les types congé (`ANNUAL_LEAVE`, `UNPAID_LEAVE`, `SPECIAL_LEAVE`,
  `MATERNITY_LEAVE`, `SICK_LEAVE`) exigent `periodStart` + `periodEnd` (jours calculés, calendaires inclusifs) ;
  `EXCEPTIONAL_EXIT` n'exige que `periodStart` ; `EXPENSE_REPORT` garde son `expenseMonth` ; `HR_INTERVIEW` sa
  négociation de date. Formulaire type-aware : `src/app/(app)/mon-dossier/request-controls.tsx`.

### Notes de frais (Mon dossier RH → RH, avec verrou secrétariat)

1. **Employé** (`/mon-dossier`) : type « Note de frais » → **mois concerné obligatoire** (`expenseMonth` YYYY-MM),
   scans en pièces jointes ; avertissement bloquant affiché : *les ORIGINAUX doivent être déposés au bureau du
   secrétariat*.
2. **Bureau du secrétariat** (`/demandes`, section « Notes de frais — originaux à réceptionner ») : bouton
   **Accuser réception** (`ackExpenseOriginals`, gate `hasGlobalView || ADMIN_REQUESTS:UPDATE`) → `originalsAckAt/ById`
   tracés, notification employé + RH.
3. **RH** (`/rh/[employé]`) : traitement **verrouillé tant que `originalsAckAt` est nul** (refus serveur + boutons
   désactivés avec bandeau). Trois décisions : **Valider (mois demandé)** / **Valider pour le mois suivant**
   (`nextMonthYm`, passage d'année géré) / **Refuser** — `decideExpenseReport` fixe `approvedMonth` + statut
   READY|REJECTED, notifie l'employé avec le mois d'imputation. Le commentaire libre passe par le fil de la demande.
- **Fichiers** : `src/lib/actions/hr-document-actions.ts` (toutes les actions), `src/app/(app)/rh/[id]/hr-dossier.tsx`
  (UI RH), `src/app/(app)/demandes/expense-ack.tsx` (accusé secrétariat), helpers mois `formatMonth`/`nextMonthYm`
  dans `src/lib/utils.ts` (testés).

### Entrevue avec les RH (type de demande négocié)

- Type `HR_INTERVIEW` : l'employé décrit l'objet (obligatoire) ; **les RH proposent une date/heure (Alger)** ;
  l'autre partie **accepte** ou **contre-propose** (chaque proposition remplace la précédente, dates passées
  refusées). À l'acceptation (`confirmHrMeeting`) : statut READY + **rendez-vous créé au calendrier des deux**
  (organisateur = côté RH, via `createEventForUser`). Champs `meetingAt`, `meetingProposedById`, `meetingConfirmedAt`.
- **Fichiers** : actions dans `hr-document-actions.ts` (`proposeHrMeeting`/`confirmHrMeeting`), composant partagé
  `src/components/shared/hr-meeting-controls.tsx` (utilisé côté employé ET côté RH).

### Paie RH (matrice mensuelle → budget)

- **Page** `/rh/paie` (gate `RH:UPDATE`) : **matrice employés × 12 mois**, navigation par année.
- **Marquer payé** (`markSalaryPaid`) : montant total (pré-rempli avec le **Net à payer** de la fiche) + **fiche de
  paie obligatoire** → `EmployeeDocument` (catégorie PAYSLIP, période YYYY-MM, visible du salarié) ; l'entrée
  `PayrollEntry` passe PAID avec `employeeNotifyAt = now + 24 h`. **Annulable** (`unmarkSalaryPaid`, survol de la
  cellule) tant que `budgetTransferredAt` est nul — supprime la fiche et la notification programmée.
- **Notification différée** : `sendDuePayrollNotifications()` dans `src/lib/scheduled.ts` notifie l'employé
  (« Votre salaire a été versé ») **24 h après**, une seule fois (verrou `updateMany`).
- **Transférer dans le budget** (`transferPayrollToBudget`) : assistant en 2 étapes — (1) mois + (sous-)catégorie
  budgétaire exacte, (2) **résumé complet** (liste, total) avec « Retour / modifier » — puis crée **une
  `FinanceTransaction` Salaire (OUT, SETTLED, compte Banque) par employé**, imputée `budgetCategoryId`, et
  **verrouille** les lignes (`budgetTransferredAt`).
- **Éléments de salaire** sur `Employee` : `baseSalary`, `retSS9`, `retSS35`, `tfp`, `retIrg`, `expenseRefund`,
  `netToPay`, `grossSalary`. **Confidentialité** : le salarié ne voit JAMAIS `grossSalary`, `retSS35`, `tfp`
  (exclus de la requête `getMyHrDossier`, pas seulement masqués).
- **Fichiers** : `src/lib/actions/payroll-hr-actions.ts`, `src/app/(app)/rh/paie/{page,payroll-matrix}.tsx`.
  L'ancien flux comptable (`createPayroll`/`payPayroll` dans `finance-actions.ts`) reste disponible côté Finances.

### Courses chauffeur (multi-points)

- **Création** `/demandes/courses` (gate `hasGlobalView || ADMIN_REQUESTS:UPDATE` — secrétariat, super admin,
  Direction ; extensible en accordant « Modifier » sur le module) : points de passage **ordonnés A/B/C…**
  (`DriverMissionStop` : position, lieu, consigne, done/doneAt), **date ET heure max** (datetime-local interprété
  **heure d'Alger** via `algiersInputToUtc`), contact sur place, instructions, **pièces jointes** (Documents
  `DRIVER_MISSION`), assignation (coordinateurs proposés en premier, notification immédiate).
- **Vue chauffeur** `/demandes/driver` : cartes lisibles — échéance en bandeau (rouge si dépassée), **checklist des
  points à cocher** (`toggleMissionStop`, assigné ou gestionnaire), téléphone cliquable, pièces téléchargeables,
  boutons Accepter / En route / Terminé / Problème. Suivi x/y points + annulation côté demandeur.
- **Fichiers** : `src/lib/actions/admin-request-actions.ts` (`createMission` étendu — points + fichiers + échéance
  datetime, rétro-compatible avec le mini-formulaire des demandes —, `toggleMissionStop`),
  `src/app/(app)/demandes/courses/{page,courses-board}.tsx`, `driver/{page,mission-stops}.tsx`.

### Stocks (états datés)

- **Principe** : plus d'entrées/sorties — un **état daté** par (produit, lieu, jour) : « à cette date, il reste X ».
  Ressaisir la même date **corrige** la valeur (remplacement jour). Lieux : `PCH` | `HOSPITAL` | `ANNEX` ;
  hôpitaux et **annexes PCH** sont des `StockAnnex` (discriminés par `kind`), **créés/supprimés par le Super
  Admin uniquement** (`createStockHospital`/`createStockAnnex`). Produits = catalogue **Regulatory** (`getProductOptions`).
- **UI** `/stocks` : 3 onglets (PCH · hôpitaux · annexes PCH), sélecteur produit, **graphique** (recharts, courbe
  date → quantité) ou **tableau** (delta entre relevés), formulaire inline date + quantité. Suppression d'un relevé :
  droit DELETE ou auteur. Panneau de gestion des lieux nommés (ajout/suppression) réservé au Super Admin.
- **Brain** : `pchStockRisks` lit **en priorité le dernier état PCH par produit**, avec repli sur les anciens
  mouvements pour les produits sans relevé (transition sans perte).
- **Fichiers** : `src/lib/actions/stock-snapshot-actions.ts`, `src/app/(app)/stocks/{page,stocks-view}.tsx`,
  `src/lib/adventum/risks.ts`. Modèles `StockAnnex` (`kind` = HOSPITAL | ANNEX), `StockSnapshot` (index produit+scope+annexe+date).

### Archives « Dossier traité » (Drive)

- Toute demande **traitée** est archivée automatiquement dans le Drive **du traitant** : racine « **Dossier
  traité** » → sous-dossier par bureau (**RH** / **Bureau du secrétariat** / **Information médicale**) → un dossier
  par demande contenant `Demande.txt` (récapitulatif complet) + **copie des pièces jointes** (et du document RH
  déposé en réponse). Dossiers réels du Drive → **reclassables/renommables** librement.
- **Déclencheurs** : demandes RH aux statuts Prête/Remise/Refusée (décision note de frais, traitement générique,
  entrevue confirmée — archive côté RH), demandes administratives au statut **Terminée**, déclarations info
  médicale à la **validation du PRIM**. Une seule fois par demande (`archivedNodeId`), best-effort (n'échoue
  jamais le traitement), lien « Dossier traité » affiché sur la demande RH archivée.
- **Fichiers** : `src/lib/archive.ts` (`archiveProcessedRequest` — testé sur base réelle dans `archive.test.ts`),
  appels dans `hr-document-actions.ts`, `admin-request-actions.ts`, `medical-info-actions.ts`.

### Corbeille des suppressions définitives (réversible, Super Admin)

- `superAdminDelete` (bouton « Supprimer définitivement », ~23 types d'objets) ne détruit plus : il dépose un
  **instantané** dans `DeletedRecord` (ligne principale complète en JSON + pièces jointes + commentaires — les
  **fichiers restent** dans le stockage) puis supprime. **Administration → Corbeille** (`/admin/corbeille`) :
  **Restaurer** (recrée à l'identique — mêmes id/référence — + pièces + commentaires) ou **Détruire** (destruction
  réelle : fichiers effacés, audio de rapport terrain libéré). ⚠ Les **enfants supprimés en cascade** (ex. congés
  d'un employé) ne sont **pas** restaurés — indiqué dans l'UI.
- **Registre** : `REGISTRY` dans `src/lib/actions/admin-delete-actions.ts` — chaque kind déclare `label`, `module`,
  `redirect`, `entityType` (nettoyage Documents/Comments polymorphes), **`model`** (délégué Prisma pour
  snapshot/restauration génériques), `describe`, `remove`. **Ajout d'un type supprimable = 1 entrée** dans ce
  registre + un `SuperAdminDeleteButton` sur la page. Types notables : `HR_REQUEST` (la demande seule — jamais
  l'employé, bug corrigé), `VALIDATION_REQUEST`, `EMPLOYEE` (libellé « Supprimer la fiche employé » + avertissement
  rouge sur le périmètre).
- **UI** : `src/app/(app)/admin/corbeille/{page,trash-list}.tsx`, composant bouton
  `src/components/shared/super-admin-delete.tsx` (prop `warning`).

### Stockage Drive : mesure exacte + quotas appliqués

- **Mesure** : physique = `FileBlob` agrégé (chiffré AES-256-GCM, **dédupliqué** par SHA-256 du clair) ; logique =
  `FileVersion` agrégé (toutes versions) ; par utilisateur = `DriveNode` FILE non corbeille groupé par `ownerId`.
- **Réglages** (`AppSetting.driveCapacityGb` / `driveUserQuotaGb`, action `saveDriveStorageSettings`, Super Admin)
  affichés dans la carte « Stockage Drive » de `/admin` (barres de progression, % par user).
- **Application** : `POST /api/drive/upload` refuse si (usage utilisateur + fichier) > quota, ou si (physique
  global + fichier) > capacité — messages explicites.

### Fuseau horaire (Africa/Algiers, UTC+1 sans DST)

- **Règle absolue** : tout instant est stocké **UTC** ; toute **saisie** `datetime-local` est interprétée à
  l'heure d'Alger via `algiersInputToUtc` ; tout **affichage** horaire passe par `formatAlgiers` /
  `algiersYmd` / `algiersTime` (`src/lib/calendar-tz.ts`, pur, client-safe). Appliqué au **calendrier**, aux
  **réunions** (création + liste + détail — fix du bug « 10 h affiché 11 h »), aux **courses** (heure max), aux
  **entrevues RH**. ⚠ `fdDate` (= `new Date(str)`) ne doit **jamais** parser un datetime-local directement :
  toujours `algiersInputToUtc(raw) ?? fdDate(...)`.

### Tâches planifiées sans cron (`src/lib/scheduled.ts`)

- `runScheduledJobs()` est déclenché par le **polling messagerie** (`/api/messaging/sync`), débounce 1 min,
  verrou process-wide, ne lève jamais. Jobs : **rappels de réunion** (30 min avant, `reminderSentAt`) et
  **notifications de paie différées** (24 h, `employeeNotifyAt`/`employeeNotifiedAt`). Chaque envoi est protégé par
  un **claim `updateMany`** anti-concurrence. Cloche + push (même téléphone hors ligne). Ajouter un job = une
  fonction appelée dans `runScheduledJobs`.

### Rôles secondaires & résolution d'accès

- Chaque `User` a un `role` principal + `secondaryRole` optionnel (tableau éditable dans `/admin`). Le rôle
  secondaire **cumule toujours** (union des actions, portée la plus large ALL > ASSIGNED), **y compris par-dessus
  les overrides `UserAccess`** (l'override ne prime que sur les défauts du rôle principal).
- **Toute sélection d'utilisateurs par rôle** (notifications, candidats, annuaires) DOIT passer par
  `anyRoleFilter(roles)` (`{ OR: [{ role: { in } }, { secondaryRole: { in } }] }`) — jamais `role: { in }` seul.
  `hasRole`/`hasGlobalView` acceptent les deux rôles. Fichier : `src/lib/rbac.ts` (testé `rbac-access.test.ts`).

### Pièces jointes (pattern standard)

Téléversement **en lot** (plusieurs fichiers **ou un dossier entier**, tous types sauf exécutables,
**sans limite de nombre**, **en parallèle**) : composant `components/documents/document-upload.tsx` →
route en flux `POST /api/documents/upload` → `persistUploadedDocument` (`src/lib/documents.ts`), logique
partagée avec l'action serveur historique `uploadDocument` (compat).

```ts
const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
// persistUploadedDocument(userId, { entityType, entityId, category, confidentiality, stepKey, file, maxUploadMb })
//   → validateDocumentUpload(name, size, maxMb)  (bloque seulement les exécutables ; taille réglable)
//   → clé `${ENTITY}/${id}/${randomUUID()}__${name}` ; saveFile(key, buffer) en try/catch (métadonnées quand même)
//   → prisma.document.create({ name, category, entityType, entityId, stepKey, fileKey, mimeType, sizeBytes, version, confidentiality, uploadedById })
```
Téléchargement : `/api/documents/[id]?dl=1`. Le **Drive** utilise un stockage distinct (`putBlob`/`getBlob`/`releaseBlob`
— blobs chiffrés dédupliqués + `FileVersion`). La fiche de paie utilise `EmployeeDocument` (blob Drive + `period`).

### Accusés, verrous & confidentialité — règles éparses à ne pas casser

- Événements (`Event`) n'a **pas** de champ `updatedById` → le moteur de workflow le retire avant `update`.
- `PERMISSIONS` (rbac.ts) est exhaustif par rôle — tout nouveau rôle casse le typecheck tant qu'il n'a pas son entrée.
- Références séquentielles : `buildRef`/`createWithRetry` (`src/lib/refs.ts`) — jamais `count()+1`.
- Suppression d'une demande RH par les RH : corbeille par demande (`deleteHrRequest`) — le bouton employé de la
  fiche est réservé à la **fiche complète** et l'annonce clairement.
- La **dernière activité** admin = max(`UserSession.lastSeenAt` groupé, `User.lastSeenAt` heartbeat, `lastLoginAt`).

---

## 🗂️ Carte du code — fichiers clés par domaine

> Compléments de `graphify-out/` (la carte AST interrogeable — voir `CLAUDE.md`). Chemins relatifs à `src/`.

| Domaine | Fichiers clés |
|---|---|
| **Sécurité / session** | `lib/rbac.ts` (PERMISSIONS, `userCan`, `anyRoleFilter`, `getAccess` cumul secondaire), `lib/session.ts` (`requireUser`/`requireModule`, maj `UserSession.lastSeenAt`), `lib/entity-access.ts` (accès par ligne + `ENTITY_MODULE`). |
| **Workflow Ad & Pro** | `lib/workflow/engine.ts` · `defaults.ts` · `engine.test.ts`, `lib/queries/workflow.ts`, `components/workflow/workflow-panel.tsx`, `app/(app)/admin/workflows/`. |
| **RH** | `lib/actions/hr-actions.ts` (fiche employé, salaires, essai), `hr-document-actions.ts` (demandes, notes de frais, entrevues, archives), `payroll-hr-actions.ts` (paie), `lib/queries/hr-documents.ts` (DTO + confidentialité salaires), pages `app/(app)/rh/` (+ `paie/`), `app/(app)/mon-dossier/`. |
| **Secrétariat / courses** | `lib/actions/admin-request-actions.ts` (demandes, missions, courses, archive DONE), `lib/queries/admin-requests.ts`, pages `app/(app)/demandes/` (+ `courses/`, `driver/`, `expense-ack.tsx`). |
| **Stocks** | `lib/actions/stock-snapshot-actions.ts`, `lib/queries/stock.ts`, `app/(app)/stocks/`. |
| **Regulatory** | `lib/actions/regulatory-actions.ts` (validation fabricant/variation), `app/(app)/regulatory/` (`edit-product.tsx`, `new-product.tsx`, `[id]/page.tsx`). |
| **Finances / budgets** | `lib/actions/finance-actions.ts`, `budget-envelope-actions.ts`, `lib/queries/budget.ts` (`getBudgetCategoryOptions`), `lib/expense-orders.ts`. |
| **Info médicale (PRIM)** | `lib/actions/medical-info-actions.ts` (validation + archive), `lib/medical-info.ts`, `lib/queries/medical-info.ts`. |
| **Transverse** | `lib/archive.ts` (Dossier traité), `lib/actions/admin-delete-actions.ts` (purge + corbeille), `lib/scheduled.ts` (jobs), `lib/calendar-tz.ts` (fuseau), `lib/calendar.ts` (agenda + réunions projetées), `lib/notify.ts`, `lib/audit.ts`, `lib/refs.ts`, `lib/settings.ts` (AppSetting), `lib/labels.ts` (libellés + NAVIGATION + tabs). |
| **Drive / documents** | `lib/drive-storage.ts` (blobs chiffrés), `lib/drive.ts` (accès), `lib/storage.ts` (Documents + `validateDocumentUpload`), `lib/documents.ts` (`persistUploadedDocument`), `lib/actions/drive-actions.ts` + `document-actions.ts`, `app/api/drive/upload/route.ts` (quotas) + `app/api/documents/upload/route.ts` (lot/dossier, flux, parallèle), `components/documents/`. |
| **Admin** | `app/(app)/admin/` (`page.tsx` comptes + stockage + activité, `corbeille/`, `drive-storage-settings.tsx`, `access/`, `settings/`…), `lib/actions/admin-actions.ts`, `settings-actions.ts`. |
| **IA / Brain** | `lib/ai.ts`, `lib/assistant.ts`, `lib/adventum/risks.ts` (+ `risk-detectors.test.ts`), `app/(app)/adventum-brain/`. |

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
**rupture / stock bas PCH** · **retard de livraison** · **événement à faible présence** · **demande du secrétariat
en retard**.

> **Analyse EN CONTINU — Adventum Pulse** (`src/lib/adventum/pulse.ts`, table `IntelligenceSnapshot`) : un
> **instantané horaire** (au plus 1×/h, verrou de bucket) des agrégats Risk Radar + Process Intelligence est
> persisté par le **tick planifié** (`runScheduledJobs`) tant qu'un utilisateur est actif — et garanti frais à
> l'ouverture des cockpits. Deux effets : (1) **tendances** (deltas + mini-courbe) affichées via le bandeau
> `PulseStrip` en tête de Brain **et** de Process Intelligence ; (2) **alerte proactive** — dès qu'un **nouveau
> risque critique** apparaît vs l'instantané précédent, le Super Admin est notifié (cloche + push) même si
> personne n'a ouvert le module. Pur calcul déterministe, sans IA ni donnée simulée.

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
- ⚡ **Connexion IMAP réutilisée (pool par compte, `withImap`)** : la boîte reste connectée entre deux actions
  (TTL ~90 s) au lieu de se reconnecter (TLS + login) à **chaque** lecture / actualisation / ouverture — chargement
  quasi instantané, et **moins** de « too many connections » (c'est l'ouvrir/fermer en rafale qui les provoque).
- 🧯 **Robustesse anti « command failed »** (IP partagée de l'hébergeur) : **plafond global** de connexions IMAP
  simultanées tous comptes confondus (`MAIL_MAX_CONCURRENCY`, file d'attente au-delà) + **plafond de connexions
  chaudes** (`MAIL_MAX_POOL`, éviction LRU) → l'IP ne sature jamais les limites Infomaniak ; **revalidation NOOP**
  d'une connexion inactive avant réutilisation ; **réessais à back-off exponentiel** sur erreur transitoire
  (limite de connexions / IP momentanément bloquée) → l'immense majorité se résorbe sans erreur visible.
- 🛡️ **Disjoncteur + cache (solution définitive anti-blocage)** : quand Infomaniak sature (≥ N échecs), un
  **disjoncteur** s'ouvre et on **cesse totalement** de le solliciter pendant un temps de repos
  (`MAIL_BREAKER_COOLDOWN_MS`) — c'est le fait d'insister qui prolonge un blocage IP ; l'IP « refroidit » et se
  débloque seule. Pendant ce temps, la boîte est servie depuis un **cache mémoire** (dernier contenu synchronisé,
  liste + messages déjà ouverts) → l'utilisateur **voit toujours ses mails**, avec un bandeau ambre « dernière
  synchronisation » et **nouvelle tentative automatique**. Le cache frais (`MAIL_CACHE_FRESH_MS`) **fusionne** aussi
  les chargements rapprochés (moins de connexions). Résultat : plus de blocage bloquant, jamais.
- 🎨 **Thème Infomaniak exact** (scopé `.ik-mail` dans `globals.css`, couleurs kMail open-source : rose `#BC0055`
  par défaut ou bleu `#0098FF` au choix, container/statuts exacts) — boutons et états de sélection façon Infomaniak Mail.
- Webmail **3 volets** (dossiers · liste · lecture/composition), aperçu HTML en **iframe sandbox**, **grand écran
  immersif** (superpose l'app **+** plein écran natif du navigateur : on ne voit que l'interface e-mail).
- **Dossiers** commutables : **Réception · Envoyés · Corbeille · Brouillons · Indésirables · Archives**.
- 🔎 **Recherche** plein-texte (IMAP SEARCH sur expéditeur / destinataire / Cc / objet / contenu) — retrouve aussi
  les **correspondants externes** à la société.
- 🎚️ **Filtres** rapides (**Tous / Non lus**), effacement de la recherche en un clic, **limite de mails chargés élevée**.
- ↩️ **Répondre**, **Répondre à tous** (sans se ré-adresser à soi-même), **Transférer** (citation du message d'origine).
- 👥 **Carnet de contacts** (collègues + correspondants récents internes/externes) avec **autocomplétion**.
- 📎 **Pièces jointes** : **à l'envoi** (bouton « Joindre », multi-fichiers, retrait/tailles, validées comme les
  téléversements Drive/Documents), et **aperçu** des pièces reçues (PDF / image / texte) avant téléchargement ; **« Lier à un dossier »**.
- ✍️ **Signature** personnalisable (bouton « Signature », aperçu en direct) — insérée automatiquement en bas des
  nouveaux messages, réponses et transferts (au-dessus de la citation).
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

**102 modèles** Prisma (dont `Company`), **87 enums** (dont `MaterialType`). Quelques entités structurantes (référence `prisma/schema.prisma`) :

| Domaine | Modèles clés |
|---|---|
| **Identité & accès** | `User` (`role` + `secondaryRole`, `lastSeenAt`), `UserAccess` (overrides), `RowGrant` (grants par ligne), `UserSession` (révocable, `lastSeenAt` = dernier clic), `LoginAttempt`, `AppSetting` (limites d'upload + `driveCapacityGb`/`driveUserQuotaGb` + mode budget total). |
| **Ad & Pro** | `SponsoringRequest`, `CongressInternational`, `CongressNational`, `Event` (+ `EventRegistration`), `PromoMaterial`, `MissionAssignment`. |
| **Budgets & Finances** | `BudgetEnvelope` (`accessRoles`, `accessUserIds` = visualisation ; `managerRoles`, `managerUserIds` = gestion déléguée ; `modules[]`), `BudgetCategoryLine` (auto-relation `parentId` = sous-catégories), `ExpenseOrder`, `FinanceTransaction` (`budgetCategoryId` = imputation), `PayrollEntry` (`payslipDocumentId`, `employeeNotifyAt/NotifiedAt`, `budgetTransferredAt`, `budgetCategoryId`), `SalaryAdvance`. |
| **Regulatory & PCH** | `RegulatoryProduct` (+ étapes/documents, `deHolder`, `manufacturingVariation`, `manufacturer`, `variationDate`), `Supplier`, `PchTender` + bons de commande + caution, `StockAnnex` + `StockSnapshot` (états datés — le suivi actif), `StockMovement` (legacy, encore lu par le Brain en repli). |
| **Information médicale** | `MedicalInfoDeclaration` (`sourceType`/`sourceId` polymorphe → événement source, clé unique). |
| **Promotion médicale** | `MedicalDoctor`, `MedicalVisit`, `DelegatePlan`, segmentation par spécialité/produit. |
| **Transverse** | `AdministrativeRequest` (+ cellules/approbations, `archivedNodeId`), `DriverMission` + `DriverMissionStop` (courses multi-points), `OfficeSupplyArticle`, `ValidationRequest` (+ steps + rules), `Dossier` (+ `DossierMessage`), `Directive`, `SupportRequest`, `Document` + `FileBlob` (chiffré), `Comment`, `AuditLog`, `Notification`, `DeletedRecord` (corbeille des suppressions définitives), `WorkflowDefinition/Step/Instance/StepEvent` (moteur Ad & Pro). |
| **Messagerie & Courrier** | `Conversation`, `ConversationMember`, `Message` (+ réactions/attachments), `MailAccount` (chiffré). |
| **IA & Brain** | `AiUsageLog`, `RiskSetting`, `AdoptionSetting`, `FieldReport`. |
| **RH** | `Employee` (contrat, périodes d'essai `trial*`, salaires `baseSalary`/`retSS9`/`retSS35`/`tfp`/`retIrg`/`expenseRefund`/`netToPay`/`grossSalary`), `EmployeeDocument` (blob Drive + `period`), `HrDocumentRequest` (types + `expenseMonth`/`approvedMonth`/`originalsAck*`, `meeting*`, `archivedNodeId`), `LeaveRequest`, `PayrollEntry`. |
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
| `AI_MODEL` · `AI_MODEL_CHEAP` | ⬜ | Les **deux paliers** de modèle IA (maîtrise du coût). Palier **qualité** (défaut `claude-sonnet-4-6`) : revue CTD sourcée (14 agents), simulateur d'examen, réponse aux réserves, assistant conversationnel, Adventum Brain. Palier **éco** (défaut `claude-haiku-4-5`, ≈ 3× moins cher) : tâches **mécaniques** — revue de fond/forme par parts, extraction de faits & de rapports vocaux, résumés de réunion, brouillons fournisseur, Q&R de dossier, suggestion proactive. Baisser encore le coût = pointer `AI_MODEL` vers le palier éco. |
| `OPENAI_API_KEY` | ⬜ | Active la **transcription vocale** (Whisper). |
| `MAX_UPLOAD_MB` | ⬜ | Taille max d'upload par défaut (réglable aussi en base depuis l'admin). |
| `APP_URL` | ⬜* | URL **publique** de l'app — requise pour le callback OnlyOffice. |
| `ONLYOFFICE_URL` | ⬜* | URL **publique** du Document Server OnlyOffice. |
| `ONLYOFFICE_JWT_SECRET` | ⬜* | Secret JWT **identique** à celui du Document Server. |
| `MAIL_ENCRYPTION_KEY` | ⬜ | Clé dédiée au chiffrement des mots de passe e-mail (sinon retombe sur `AUTH_SECRET`). |
| `MAIL_MAX_CONCURRENCY` | ⬜ | Connexions IMAP simultanées **max, tous comptes** (défaut 3). ↓ si Infomaniak renvoie « command failed » sur IP partagée. |
| `MAIL_MAX_POOL` · `MAIL_IMAP_IDLE_MS` | ⬜ | Plafond de connexions IMAP chaudes (défaut 8) · durée de maintien au chaud en ms (défaut 90000). |
| `MAIL_BREAKER_THRESHOLD` · `MAIL_BREAKER_COOLDOWN_MS` | ⬜ | Disjoncteur mail : nb d'échecs avant ouverture (défaut 3) · temps de repos sans solliciter Infomaniak (défaut 30000 ms). |
| `MAIL_CACHE_FRESH_MS` · `MAIL_CACHE_STALE_MS` | ⬜ | Cache boîte mail : fenêtre « frais » servie sans IMAP (défaut 10000) · repli max sur cache si saturé (défaut 900000). |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | ⬜ | Notifications **push** (PWA Web Push). |
| `MISTRAL_API_KEY` | ⬜ | Active **Mistral OCR** (moteur OCR primaire, cloud, rapide) pour l'analyse CTD. Absent → repli automatique sur l'OCR local tesseract.js (aucune perte). Service tiers **payant à la page**, réseau sortant requis. |
| `REG_OCR_ENGINE` · `REG_OCR_CONCURRENCY` · `REG_OCR_BATCH` | ⬜ | Moteur OCR (`auto`\|`mistral`\|`tesseract`, défaut `auto`) · documents OCR en parallèle (défaut 3, 1-20 ; modéré car un document massif charge un gros blob) · documents par passage (défaut 24). |
| `REG_OCR_CHUNK_PAGES` · `REG_OCR_CHUNK_CONCURRENCY` | ⬜ | Découpage des PDF massifs : pages par tranche (défaut 400, sous la limite Mistral 1000) · tranches océrisées en parallèle au sein d'un document (défaut 4). |
| `REG_EXTRACTION_MAX_CHARS` | ⬜ | Plafond du texte extrait/OCR persisté par document (défaut 20 M — ≈ 10 000 pages ; fin de la troncature 1 M). ↑ demande plus de disque base. |
| `REG_AI_CHUNK_PAGES` · `REG_AI_CONCURRENCY` | ⬜ | Revue IA par parts : pages par part envoyée à l'IA (défaut 10) · parts analysées en parallèle (défaut 4). |
| `REG_AI_MAX_CHUNKS` · `REG_AI_MAX_FINDINGS` | ⬜ | Garde-coût revue IA : parts max analysées par version (défaut 120, **0 = illimité**) · constats IA max persistés (défaut 300). Chaque part = 1 appel Claude (palier **éco**) facturé — c'est le principal poste de coût CTD, borné ici. |
| `REG_MAX_PG_FILE_MB` · `REG_BLOB_CHUNK_MB` | ⬜ | Taille max d'un fichier unique conservé en base (défaut **950 Mo** ≈ 1 Go, stocké en tranches) · taille d'une tranche de blob chiffré (défaut 16 Mo). Fichiers proches d'1 Go : prévoir ≥ 4 Go de RAM ou activer R2. |

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

- **Perf disque — écritures `lastSeenAt` throttlées (fin des pics « Disk Operations » réguliers).**
  `lastSeenAt` (session + présence messagerie) était réécrit **à chaque requête** ET **à chaque
  battement de polling** (~6 s) → un flux constant d'UPDATE Postgres (WAL) visible en pics réguliers
  sur l'hébergeur, même sans activité réelle. Un garde process-wide (`src/lib/touch-throttle.ts`) limite
  ces écritures à **≈ 1×/min** par session/utilisateur (granularité largement suffisante pour la présence
  et le « dernier clic ») — appliqué dans `session.ts` et `messaging.ts` (`touchPresence`).
- **Organigramme — vue « Carte » en glisser-déposer** (en plus de l'« Arbre ») : boîtes reliées par des
  connecteurs, placement automatique puis **positions mémorisées** (`Employee.orgX/orgY`), clic = fiche RH.
- **Lot « supervision & durcissement » (budget, paie, réunions, Regulatory, organigramme, annuaire).**
  ① **Budget — accès enveloppe STRICT** : la gouvernance globale (voir/gérer toutes les enveloppes) n'est
  plus conférée par un simple droit de module (`BUDGETS:DELETE` du bundle `MANAGE`) — seul le Super Admin ;
  sinon, strictement les listes d'accès par enveloppe (fuite corrigée, régression verrouillée). ② **Paie** :
  la fiche de paie devient **facultative** comme fichier. ③ **Réunions & appels** : onglet **« Passées »** —
  une réunion planifiée dont l'heure est dépassée quitte le listing actif (mais reste au Calendrier).
  ④ **Regulatory — supervision** : bascule *Nouveau→En cours* dès l'**étape 3 de la préparation** (« Demande
  du BV 25 % » de présoumission) faite ; **priorités colorées** ; **date cible de dépôt** + d'enregistrement ;
  **rôles superviseurs configurables** en Administration (Super Admin toujours inclus) — eux seuls priorisent/datent,
  sont notifiés (nouveau dossier / dépôt) et **demandent des MàJ de statut**. ⑤ **Administration — Organigramme** :
  arbre hiérarchique **éditable** branché sur RH (`Employee.managerId`), rattachement (N+1) + poste modifiables,
  garde anti-boucle. ⑥ **Annuaire médecins & pharmaciens** : filtre **Médecins / Pharmaciens** sur l'annuaire médical
  (le pharmacien = grade « Pharmacien »).
- **Fix accès (RBAC) : un « accès personnalisé » ne rétrécit plus la portée native d'un rôle.** Bug observé :
  un **National Sales** ne voyait « des fois » **pas** les demandes de **congrès internationaux à pré-valider**.
  Cause : dès qu'un compte recevait un **override** d'accès (matrice « façon Google Drive »), celui-ci **remplaçait**
  le défaut du rôle et retombait sur une portée `ASSIGNED` (le sélecteur de portée retombe sur ASSIGNED s'il n'est
  pas repositionné) — or `saveAccessMatrix`/`saveModuleAccess` par défaut à `ASSIGNED`. Le National Sales, qui a
  nativement la portée **ALL** sur les congrès (`defaultScope`), perdait donc sa visibilité et, à l'étape
  préliminaire, n'étant ni demandeur ni chef de produit, ne voyait plus rien. Correctif dans `getAccess`
  (`src/lib/rbac.ts`) : un override ne peut plus **rétrécir silencieusement** une portée que le rôle possède
  nativement en `ALL` (symétrique de la règle déjà en place pour le rôle secondaire). Test de non-régression
  ajouté (`rbac-access.test.ts`, cas National Sales en rôle principal + override).
- **RH « la totale » : contrat de travail pré-rempli par IA + acquisition automatique des congés + demandes par type.**
  **(1) Pré-remplissage du dossier employé depuis un contrat** — à la création d'un employé, un bloc
  **« Pré-remplir depuis un contrat de travail (IA) »** permet de téléverser le contrat (PDF ou image) :
  **OCR Mistral** (`ocrDocument`) puis **Claude** (`analyzeEmployeeContract`) extraient nom, poste, département,
  type de contrat, dates (embauche, début/fin de contrat, naissance), salaire de base, NIN, CNAS, coordonnées…
  Les champs se **pré-remplissent** dans le formulaire et **restent tous modifiables** avant l'enregistrement
  (rien n'est persisté tant que le RH n'a pas validé). Aucun document n'est stocké par l'IA — **les RH versent
  eux-mêmes les pièces**. Mécanique réutilisable : nouvelle prop `analyze` du composant `CreateRecordButton`.
  **(2) Acquisition automatique des congés — +2,5 j / mois** (barème algérien 30 j/an) : `accrueMonthlyLeave()`
  dans `src/lib/scheduled.ts` crédite chaque employé actif au passage d'un nouveau mois, de façon **idempotente**
  (marqueur `Employee.leaveAccruedThrough`), sans rétro-crédit à l'amorçage (le solde manuel existant est
  préservé). Le **solde reste modifiable manuellement** par les RH (champ « Solde congés » de la fiche).
  **(3) Chaque demande RH a son workflow selon le type** — le formulaire « Nouvelle demande » (Mon dossier RH)
  s'adapte : **congés** (annuel / sans solde / exceptionnel / maternité / arrêt maladie) demandent une **période**
  (début + fin, durée calculée) ; **arrêt maladie** rappelle de joindre le **certificat** ; **sortie exceptionnelle**
  ne demande qu'une **date** ; **note de frais** garde son mois + dépôt des originaux au **secrétariat** (accusé de
  réception verrouillant) ; **entrevue RH** garde la négociation de date ; **documents** (attestations…) restent
  simples. À l'approbation d'un **congé annuel**, le solde est **débité une seule fois** (verrou
  `HrDocumentRequest.balanceAppliedAt`). Champs `periodStart` / `periodEnd` / `periodDays` / `balanceAppliedAt` +
  `Employee.leaveAccruedThrough` (migration `20260717180000_rh_totale`).
- **PCH — Marché public : la chaîne complète appel d'offres → ventes réelles (OCR Mistral + IA + verrou prix).**
  Un appel d'offres se décompose en **lignes-produits** (`PchTenderLine`). Le bouton **« Analyser le
  document (IA) »** offre deux entrées : (a) **téléverser directement le document** (PDF ou image) —
  **OCR Mistral automatique** (`ocrDocument`, `analyzeTenderDocument`) puis extraction IA ; (b) coller un
  **texte** déjà extrait (`analyzeTenderText`). Dans les deux cas Claude **extrait** la liste des produits
  (désignation, DCI, dosage, forme, quantités) de façon ancrée, sans invention (helper commun
  `extractAndSaveLines`). Chaque ligne gère le **conditionnement** — quantité demandée en **unités** →
  **« boîte de N » → nombre de boîtes calculé** (⌈unités / N⌉, `parseBoxSize` déduit N du conditionnement
  reçu) —, un indicateur **« nous l'avons »**, notre **prix unitaire**, nos **fournisseurs**, et un **suivi
  commercial** (À étudier → Chiffré → Soumissionné → **Gagné** → Perdu) avec **prix d'attribution**. Le
  bouton **« Enrichir »** fait tout d'un coup (`src/lib/market/pch-lookup.ts`) : **① verrou prix** — le
  **prix unitaire de référence** est **verrouillé depuis les réceptions PCH 2025** (données réelles
  Pharmatool) en **vérifiant DCI + dosage + forme** (`pchReceptionPrice` → `refPriceDzd` + `refPriceSource`) ;
  **② présence à la nomenclature** vérifiée dosage + forme (`nomenclatureMatch`) ; **③ auto-détection de
  notre produit** dans le catalogue Regulatory (`matchOurProduct` → `ourProductId`, `registeredOurs`,
  « nous l'avons ») ; **④ concurrents** + **estimation de marché** via l'intelligence marché
  (`getRecommendations`). Une fois une ligne **Gagnée**, le bloc **« Ventes réelles »** permet de saisir
  les **bons de commande** comme **fractions** de la quantité attribuée (`createOrderFromLine` — chaque bon
  = une vente réelle, `PchOrder.lineId`), avec un **taux de réalisation** (unités vendues / attribuées, %).
  Chaque bon de commande alimente le bloc **Logistique** (dates d'**arrivée prévue / réelle**, client = PCH).
  Champs `refPriceDzd` / `refPriceSource` / `registeredOurs` + `PchOrder.lineId` (migration
  `20260717170000_pch_tender_totale`, après `20260717160000_pch_tender_lines`).
- **Information médicale (PRIM) → demandes à Regulatory.** Le pharmacien responsable de l'information
  médicale peut désormais **adresser des demandes** à l'équipe Regulatory (question réglementaire,
  demande de document, point sur un statut d'enregistrement, variation…), **rattachables à un dossier
  produit**, avec un **fil de discussion** et un cycle de statut **Ouverte → En cours → Répondue →
  Clôturée**. L'équipe Regulatory **prend en charge** (assignation auto au premier répondant), **répond**
  et change le statut ; des **notifications** préviennent l'équipe à la création et le demandeur à chaque
  réponse/changement de statut. Accès strict : le PRIM ne voit que **ses** demandes, Regulatory les voit
  **toutes** (helpers `canCreateRegRequest` / `canAnswerRegRequests` / `canSeeRegRequests`). Nouveaux
  modèles `RegulatoryRequest` / `RegulatoryRequestMessage` (migration `20260717150000_regulatory_request`),
  espace `/regulatory/requests` (entrée de menu côté information médicale + lien depuis le module
  Regulatory), référence `RRQ-AAAA-NNN`.
  **Émission réservée (configurable).** Seuls **le PRIM**, **le Super Admin** et les **rôles désignés en
  Administration** (`AppSetting.regRequestCreatorRoles`, carte « Demandes à Regulatory — Émetteurs
  autorisés » dans `/admin/settings`, action `setRegRequestCreatorRoles`) peuvent **créer** une demande —
  rôle porté en **principal OU secondaire**. L'équipe **Regulatory répond** aux demandes mais **n'en crée
  pas** (sauf si l'admin ajoute explicitement son rôle à la liste) : `canCreateRegRequest(user, creatorRoles)`
  ignore désormais `hasGlobalView`/`MEDICAL_INFO:CREATE` et s'appuie sur la liste configurée
  (migration `20260719120000_reg_request_creators`). Le bouton « Nouvelle demande » et la porte de création
  de l'action sont gardés par ce même helper.
- **Produits — canal de distribution Ville / Hôpital / les deux.** Nouvel attribut **canal**
  (`ProductChannel` : `RETAIL` = ville/officine, `HOSPITAL` = hospitalier, `BOTH` = les deux) porté par
  les **produits promus** (`PromoProduct`, catalogue Force de vente) et les **produits réglementaires**
  (`RegulatoryProduct`, registre). Sélecteur de canal dans le catalogue promo (création + édition en
  ligne) et dans les formulaires produit Regulatory (création + édition), badge de canal sur la fiche
  dossier. Libellés `PRODUCT_CHANNEL` (`src/lib/labels.ts`), migration
  `20260717140000_product_channel`. Base du filtrage ville/hôpital en segmentation et prise en charge.
- **Budgets — accès par enveloppe STRICTEMENT encadrés (visualisation vs gestion).** La **gouvernance
  globale** (créer / supprimer une enveloppe, régler le budget total et **décider qui voit ou gère
  chaque enveloppe**) est **exclusivement au Super Admin** (`canManageEnvelopes`). Les accès à une
  enveloppe sont à **deux niveaux**, **par rôle ET par personne précise** : **Visualisation** (consulter
  l'enveloppe et ses chiffres — `accessRoles` / `accessUserIds`) et **Gestion déléguée** (gérer le
  contenu de CETTE enveloppe : catégories, allocations, dépenses budgétaires — `managerRoles` /
  `managerUserIds`). Par défaut une enveloppe est **invisible** de tous **sauf du Super Admin**
  (encadrement strict). ⚠️ **Correctif de fuite** : un droit large sur le *module* Budget
  (`BUDGETS:DELETE`, présent dans le bundle `MANAGE` du rôle Finance/Budget et cochable dans la matrice
  d'accès) **ne confère PLUS** la visibilité de toutes les enveloppes — il fallait auparavant y être
  listé nommément ou par rôle, mais `canManageEnvelopes` retombait sur `BUDGETS:DELETE` et
  court-circuitait les listes. La délégation est **désormais uniquement par enveloppe** (listes ci-dessus).
  Un gestionnaire délégué gère le contenu **sans** pouvoir toucher au **montant**, à la **période** ni
  aux **listes d'accès** — modifier l'enveloppe elle-même et ses accès reste réservé au Super Admin. Toute
  modification des accès est **journalisée** (audit). Helpers `canViewEnvelope` / `canManageEnvelope`
  (`src/lib/rbac.ts`, régression verrouillée dans `rbac.test.ts`), enforcement dans `queries/budget.ts`
  (y c. `getBudgetCategoryOptions(viewer)` sur la Paie) + `budget-envelope-actions.ts`, éditeur d'accès
  dans `budget-board.tsx` (migration `20260717130000_budget_envelope_managers`).
- **Drive & Projets — confidentialité STRICTE (privés par conception).** Le **Drive** (fichiers) et les
  **Projets** (`DOSSIERS`) sont **cloisonnés** : chacun ne voit que **ses propres** fichiers / projets +
  ceux qu'on lui a **explicitement partagés ou confiés** (participation) — jamais l'ensemble de la
  société. Seule la **vue globale** (Super Admin / Direction) voit tout. ⚠️ **Correctif de fuite** :
  un compte ordinaire (ex. l'**Assistante de Direction**) pouvait se retrouver avec la portée **« tout »**
  sur ces deux modules via un **override de la matrice d'accès** (mode « personnalisé » réglé sur *toutes
  les lignes*), et voir alors **l'intégralité** des drives / projets. `getAccess` **neutralise désormais
  toute portée `ALL`** sur `DRIVE` et `DOSSIERS` **hors vue globale** (ramenée à `ASSIGNED`), quelle que
  soit son origine (override, réglage hérité, rôle secondaire). Les matrices d'accès (par utilisateur et
  « par module ») affichent ces deux modules comme **« Privé (assignées) »** — l'option *toutes les lignes*
  n'y est plus proposée (elle serait de toute façon ignorée). Enforcement : `getAccess` (`src/lib/rbac.ts`)
  + `scopeDossiers` / `getDriveListing` / `resolveDriveAccess` ; régression verrouillée dans
  `queries/drive-dossiers-scope.test.ts`. La délégation fine reste possible **par partage explicite**
  (Drive : lecteurs/éditeurs par fichier ; Projets : responsable/participants).
- **Drive — l'accès ÉDITEUR donne un vrai pouvoir d'écriture + commentaires par document.**
  **(1) Éditeur = écriture complète.** Ajouter quelqu'un en **« Éditeur »** sur un dossier ou un fichier
  lui permet désormais de **modifier, supprimer, renommer, déplacer ET téléverser / créer** dans l'élément
  partagé — même si le **rôle** de la personne n'a pas le droit module « Téléverser » / « Créer ». Un accès
  ÉDITEUR explicite (`DriveShare.access = EDIT`, hérité en descendant l'arbre) **suffit** : les actions
  d'écriture (`renameNode` / `moveNode` / `trashNode` / `deleteNode`, édition OnlyOffice, route
  `/api/drive/upload`, `createFolder` / `createOfficeNode` / `ensureDriveFolders`) s'appuient sur
  `resolveDriveAccess(...) === "EDIT"` ; le droit **module** n'est requis que pour créer/téléverser **à la
  racine** (espace perso). La page d'un document offre aussi **Renommer / Corbeille** aux éditeurs
  (`file-actions.tsx`). **(2) Commentaires par document.** Chaque fichier a son **fil de commentaires**
  (`DriveComment`, migration `20260719140000_drive_comments`) — utile pour tracer le **motif d'une
  modification**. Toute personne **ayant accès** au document peut commenter ; l'auteur (ou un éditeur /
  Super Admin) peut supprimer ; le **propriétaire est notifié**. UI `DriveComments` sur `/drive/[id]`,
  actions `drive-comment-actions.ts` (`postDriveComment` / `deleteDriveComment`).
- **Business Development — Présentation stratégique PPTX générée par IA (Claude).** Sur une étude de
  marché, un panneau **« Présentations stratégiques (IA) »** permet de **générer une présentation
  PowerPoint (.pptx)** analysée par Claude : l'IA reçoit **tout le contexte** de l'étude (toutes les
  lignes, acteurs, chiffres, commentaires) et renvoie une **analyse structurée ancrée** — synthèse
  factuelle, panorama, analyse **par produit**, paysage concurrentiel, opportunités/risques, **opinion**
  argumentée et **recommandation**. Garde-fous : l'IA **n'invente aucun chiffre** (droit au but, elle
  s'en tient aux données), et son **avis n'apparaît que** dans les champs « opinion / recommandation ».
  Un **angle/consignes** optionnel oriente l'analyse. Le fichier est **construit à la demande** au
  téléchargement (`pptxgenjs` : page de titre, tableau du marché, graphe des valeurs, une diapo par
  produit avec camembert des parts de marché, diapo opinion) — **téléchargeable et modifiable** dans
  PowerPoint. Enfin, on peut **ré-analyser en ajoutant des commentaires autant de fois que nécessaire** :
  chaque relance crée une **nouvelle version historisée** (téléchargeable individuellement). Modèles
  `MarketResearchPresentation` / `MarketResearchPresentationVersion` (migration
  `20260717120000_market_presentation`) ; analyse via le palier QUALITÉ (`askClaude`, surchargable
  `AI_MODEL`) ; route `/api/market-research/presentation/[versionId]`.
- **Business Development — Études de marché (Market Research).** Nouveau sous-espace `/business-development/etudes` :
  bouton **« New market research »** (titre + une ou plusieurs **molécules**, une par ligne → une ligne de
  tableau créée par molécule) puis un **tableau éditable façon tableur** aux colonnes exactes demandées —
  Classe thérapeutique, N, Produit, Marché (volume), Marché ($), Prix moyen/boîte $, **Nombre d'acteurs**,
  puis les **acteurs** (Player 1/2/3…, **non plafonnés**) avec **part de marché** et **statut
  Importation/Fabrication**, et Commentaires. **Enregistrement automatique** à la sortie de chaque champ,
  ajout/suppression de lignes et d'acteurs. Modèles `MarketResearch` / `MarketResearchRow` /
  `MarketResearchPlayer` (migration `20260717110000_market_research`).
  **Pré-remplissage Pharmatool + « Voir plus de détails » + export Excel.** Chaque ligne gagne un bouton
  **« Pré-remplir »** (✨) qui rapproche le produit d'une **DCI de l'intelligence marché** (IQVIA + PCH +
  Nomenclature via `getRecommendations()`) et remplit automatiquement **volume, valeur $, prix moyen/boîte**,
  un **commentaire nomenclature** (lignes enregistrées · fabricants/importateurs · recommandation) et les
  **acteurs** détectés (laboratoires **fabricants → Fabrication**, **importateurs → Importation**, seulement
  si la ligne n'en a pas encore). Le bouton **« Voir plus de détails »** déplie une **vue parts de marché**
  (barres de répartition par acteur, part cumulée) sous la ligne. Enfin un **export Excel (.xlsx)** au
  **format exact du modèle** (colonnes dynamiques `Player i / Market Share Player i (value) / Status Player i`)
  via `/api/market-research/[id]/export`. Prochain lot : **génération de présentation PPTX par IA (Claude)**.
- **Congrès — praticiens pris en charge reliés à l'annuaire.** La liste des personnes prises en charge
  d'un congrès (national/international) n'est plus une simple saisie libre : le panneau **« Personnes
  prises en charge »** propose trois modes — **« Depuis l'annuaire »** (recherche + sélection d'un
  praticien existant), **« Nouveau médecin »** (création *inline* d'un profil `MedicalDoctor` — nom,
  spécialité, secteur, **établissement** — directement rattaché, sans quitter le congrès) et **« Personne
  libre »** (comme avant). Chaque bénéficiaire issu de l'annuaire affiche son **établissement** et un
  badge « annuaire », et le profil créé est **réutilisable partout** (segmentation, tournées, historique).
  Le référentiel (annuaire, spécialités, établissements) est chargé à la demande via une action serveur ;
  les pièces d'identité et la demande de pièces restent inchangées.
- **Établissements médicaux (référentiel structuré).** L'« hôpital / clinique » d'un praticien
  n'est plus un simple texte libre : nouvelle entité **`MedicalInstitution`** (type — CHU, EPH, EHS,
  clinique privée, polyclinique, cabinet, centre de santé, pharmacie, grossiste… — secteur public/privé,
  wilaya, ville, adresse, contacts). Le médecin porte un **`institutionId`** (FK `SetNull`, libellé
  dénormalisé conservé pour la rétrocompatibilité). La **migration backfill** crée automatiquement un
  établissement par libellé distinct existant et rattache les praticiens (idempotente). L'annuaire
  Promotion médicale gagne un bouton **« Établissements »** (gestion CRUD complète, compteur de
  praticiens) et le formulaire médecin un **sélecteur d'établissement**. Socle du rattachement
  praticien→établissement réutilisé ensuite dans la prise en charge des congrès.
- **Force de vente — hiérarchie, affectations par KAM & pilotage terrain (SFE Phase 2/3).**
  Extension profonde du module `SALES_PLANNING` : on descend de la prévision produit jusqu'au **KAM
  individuel** et jusqu'au **réalisé terrain**. Trois nouveaux modèles — **`SalesTeam`** (équipe pilotée
  par un **superviseur national**, rattachable à une BU ou transverse), **`SalesRepProfile`**
  (**configuration individuelle** de chaque KAM : équipe, **capacité surchargée** jours×visites×%terrain,
  **ETP contractuel**, secteur, statut) et **`PromotionAssignment`** (matrice **KAM × produit × cycle**
  avec **rang de détail P1/P2/P3** et visites prévues, transverse aux BU). Trois onglets s'ajoutent :
  **(2) Affectations** — par KAM (groupé par équipe), on affecte des produits à un rang de détail avec un
  nombre de visites ; le **FTE et la charge** se calculent en direct (barre de charge, alerte surcharge),
  avec **synthèse par produit** et bouton **« Reporter le mois précédent »**. **(3) Équipes & KAM** —
  gestion des équipes (superviseur, BU, couleur) et **tableau de configuration de tous les KAM**.
  **(4) Pilotage** — cockpit **planifié vs réalisé** : par KAM (et sous-totaux d'équipe), capacité, panel
  (praticiens par palier de potentiel, **réutilise l'annuaire médical existant** `MedicalDoctor`),
  **fréquence cible** (Σ fréquence×effectif du panel selon le paramétrage), visites planifiées, **visites
  réellement réalisées le mois** (dérivées des `MedicalVisit` `COMPLETED`), **taux de réalisation** et
  **couverture** (praticiens visités / panel). Le **FTE affecté remonte automatiquement dans les
  Prévisions** (nouvelle colonne « FTE affecté » + écart vs FTE cible) : la boucle Direction → KAM →
  terrain est bouclée. **Profondeur d'accès** : les onglets et les données sont filtrés par rôle —
  configurateur (Direction / Manager promo / Super Admin) voit et édite tout ; **superviseur national**
  (`NATIONAL_SALES`, `SALES_PLANNING:READ`) voit et édite **ses équipes** (autorisation métier
  `canEditRep`, sans droit de configuration globale) ; **KAM** (`MEDICAL_DELEGATE`) voit **son** Pilotage.
  Tout reste **non bureaucratique** : le terrain ne saisit que ses visites, le reste est dérivé. Helpers
  purs testés (`src/lib/sfe.ts` : `repCapacity`, `assignmentEffort`, `fteFromEffort`, `panelRequiredVisits`,
  `resolveRepScope`, `canEditRep` — `src/lib/sfe.test.ts`). Migration idempotente `20260717090000_sfe_force_hierarchy`.
- **Nouveau module « Prévisions & Force de vente » (SFE) — l'espace prévisionnel de la Direction.**
  Première pierre d'un modèle **Société → BU (franchise) → Produit** pour piloter la force de vente.
  Nouveau module RBAC **`SALES_PLANNING`** (route `/planning`, accordé par défaut à la Direction et au
  Manager promotion médicale, ouvrable à tout rôle par le Super Admin dans Administration). Trois onglets :
  **(1) Prévisions** — une **grille façon tableur, par produit et par mois** (cycle mensuel `PromoCycle`),
  où la Direction saisit **FTE cible, couverture %, visites prévues, budget (DZD) et note** ; lignes
  **regroupées par BU** avec sous-totaux + total, **enregistrement automatique** à la sortie de chaque
  champ, KPIs (FTE cible total, ETP KAM disponibles, visites, capacité/KAM) et navigateur mois précédent/
  suivant. **(2) Catalogue** — gestion des **Business Units** (franchises : société, chef de BU, couleur)
  et des **produits promus** (BU + chef de produit), un produit étant l'**unité atomique d'affectation**
  (un KAM peut porter des produits de plusieurs BU). **(3) Paramètres** — **100 % configurables** :
  **capacité terrain** (jours/mois × visites/jour × % terrain, avec aperçu de la capacité nette), **poids
  des positions** de détail (P1/P2/P3) et **fréquence cible par palier de potentiel** (Très fort → Très
  faible). Modèles : `BusinessUnit`, `PromoProduct`, `PromoCycle`, `ProductForecast`, `SfeSettings`
  (migration idempotente `20260715080000_sfe_foundation`) ; helpers `src/lib/sfe.ts` (config fusionnée
  aux valeurs par défaut + `fieldVisitsCapacity`) ; actions `src/lib/actions/sales-planning-actions.ts`.
  **Vision (non bureaucratique)** : la Direction *prévoit* ici par produit ; le terrain ne saisira que ses
  **visites**, d'où le FTE/couverture *réels* seront **dérivés** — d'où la feuille de route **Phase 2**
  (matrice d'affectation KAM × produit × position × FTE, transversale aux BU) et **Phase 3** (panel par
  médecin + tournée assistée + FTE réel calculé à partir des visites).
- **Regulatory — « Statut de fabrication » + cycle de vie des variations.** La forme pharmaceutique
  gagne **« Capsule molle »**. L'ancien champ **« Type de produit » devient « Statut de fabrication »**
  avec 4 valeurs — **Importation, Secondary Packaging, Primary Packaging, Full Process** (nouveau champ
  `RegulatoryProduct.manufacturingStatus`, l'ancien `productType` conservé mais masqué). Nouveau **cycle
  de vie de variation** (`RegulatoryVariation`) : après la DE, un bouton **« Variation »** ouvre un dépôt
  vers un statut supérieur (date de dépôt, fabricant, note), suivi d'un statut **En attente → DE de
  variation obtenue / Annulé** ; à l'obtention, le **statut de fabrication du produit est promu** à la
  cible. Chaînable dans le temps (Importation → Secondary → Primary → Full Process). Panneau
  « Variations de fabrication » sur la fiche + colonne « Statut fab. » dans la liste.
- **Web Push (VAPID) auto-configuré + intégré partout.** Le push (gratuit et illimité — il passe
  par les services push des navigateurs) n'est **plus inerte** : si l'environnement ne fournit pas de
  clés `VAPID_*`, le serveur **génère une paire une seule fois et la persiste** (`AppSetting.vapidPublicKey`
  / `vapidPrivateKey`, clé privée jamais exposée). Il suffit à chaque utilisateur d'**activer les
  notifications** une fois (bouton dans le module Notifications) pour recevoir sur son appareil **même
  plateforme fermée** : **appels & appels vidéo** (notification qui **reste affichée + vibre**, façon
  sonnerie, un tag par appel), **messages**, **toutes les notifications** (validations, rappels
  « Me rappeler », affectations…) et les **pop-up d'annonce** de l'Administration — tout ce qui passe par
  `notifyUser` / `broadcastNotification` pousse désormais réellement. `PushPayload` gagne `tag` +
  `requireInteraction` (honorés par le service worker). Les variables d'environnement `VAPID_*` restent
  prioritaires si on veut fixer soi-même les clés.
- **Notifications en pop-up plein écran (depuis l'Administration).** Le compositeur de diffusion
  (Administration → Réglages) gagne une case **« Afficher en pop-up plein écran »** : la notification
  s'affiche alors dans une **grande fenêtre centrée** au milieu de l'écran du destinataire (façon alerte
  importante), en plus de la cloche. Elle **reste jusqu'à l'accusé de réception** (« J'ai compris »),
  s'enchaîne si plusieurs, et propose « Ouvrir » si un lien est fourni. Nouveau champ `Notification.popup`
  (migration idempotente), l'endpoint `/api/notifications/poll` renvoie aussi les pop-up non lues, et le
  composant `NotificationPopup` (monté dans le layout) les affiche et les marque lues à l'accusé.
- **Drive — un seul bouton « Importer » (UI).** Les deux boutons « Importer » et « Importer un dossier »
  sont **fusionnés** en un seul bouton **« Importer »** qui ouvre un petit menu (façon Google Drive) :
  **Fichiers ou ZIP** (un ou plusieurs fichiers, ZIP inclus — avec classement + accès) ou **Dossier**
  (arborescence exacte recréée dans le Drive). Composant `import-folder-button.tsx` retiré, sa logique
  repliée dans `upload-button.tsx`.
- **Module « Dossiers » renommé « Projets » · Stocks ouverts à tous les produits (2 sujets).**
  **(1) « Dossiers » → « Projets »** — le module de suivi de sujets ad hoc s'appelle désormais
  **Projets** partout dans l'interface (menu, titres, KPIs, création, notifications, journal d'audit,
  onboarding, assistant IA, suppression Super Admin). Seuls les **libellés utilisateur** changent : la
  **route `/dossiers`**, l'**entité `Dossier`**, la **clé RBAC `DOSSIERS`** et les liens existants
  restent inchangés (aucune migration, aucun lien cassé). Le mot « dossier » employé ailleurs (Drive,
  Mon dossier RH, dossiers Regulatory) n'est **pas** touché. **(2) Stocks — tous les produits** : la
  saisie d'un état de stock propose de nouveau **tous les produits Regulatory** (on a retiré le filtre
  « Décision obtenue »), quel que soit leur statut d'enregistrement.
- **Réunions (gestion des participants) · Courrier retiré · statut Teams · carillon de rappel · clic
  notif = lu (8 sujets, dont 3 déjà couverts).** **(1) Gestion des participants d'une réunion** —
  l'organisateur (et le Super Admin) peut **ajouter** (multi-sélection avec recherche), **retirer** des
  participants après création via un panneau **« Gérer les participants »** dans l'en-tête de la carte
  Participants (`manage-participants.tsx` → `addMeetingParticipants` / `removeMeetingParticipant`).
  **(2) Documents — visualiser / modifier / imprimer / supprimer** : déjà en place — `DocumentPreview`
  offre l'aperçu, l'impression (icône imprimante), le renommage, l'édition Office et la suppression,
  aussi bien dans le module **Documents** que sur les fichiers du **Drive** (visionneuse + actions de
  nœud). **(3) Accès (Administration) réellement connecté** : déjà le cas — `getAccess` lit
  `userAccess` **en direct à chaque requête** (`session.ts` l'appelle systématiquement, le JWT ne met
  **pas** l'accès en cache) ; une modification d'accès prend donc effet **au prochain chargement de
  page** de l'utilisateur concerné (il peut devoir rafraîchir). **(4) Drive = disque de l'ordinateur en
  temps réel** : impossible en application **web pure** (un navigateur ne peut pas lire en continu un
  dossier local en arrière-plan) ; on fournit l'**import de dossier** (arborescence exacte, déjà livré)
  et une resynchro « dossier vivant » tant que l'onglet est ouvert — une vraie synchro permanente
  exigerait un **agent bureau natif** (projet séparé). **(5) Boîte mail « Courrier » retirée** —
  entièrement supprimée du menu et de la plateforme (`/courrier` redirige vers Mon espace) ; Infomaniak
  reste dans son app dédiée. **(6) Statut façon Teams** — chaque utilisateur choisit son statut
  (Disponible, Occupé, Ne pas déranger, De retour bientôt, Absent, Hors ligne) **et** un message perso
  court, affiché dans la messagerie (en-tête de conversation + sélecteur en tête de liste) ; « Auto »
  repasse en présence automatique (`User.chatStatus` / `statusMessage`, `setMessagingStatus`).
  **(7) Carillon de rappel** — une **notification sonore** discrète et pro (petit arpège) + une notif
  bureau se déclenchent quand une notification non lue arrive (rappels « Me rappeler » compris)
  (`notification-chime.tsx` interroge `/api/notifications/poll`). **(8) Clic sur une notif = lu** —
  cliquer une notification la marque **lue** (et suit son lien) ; plus besoin de la coche par élément
  (« Tout marquer comme lu » conservé).
- **Drive (accès dossiers + import de dossier + fiabilité) · réunions verrouillées · téléversement
  déplaçable · rapports terrain épurés (6 sujets).** **(1) Accès des dossiers Drive éditables** — un
  bouton **« Gérer l'accès »** sur chaque dossier **et** fichier (pas seulement à l'import) ouvre le
  partage Lecture / Éditeur / Aucun ; l'accès posé sur un dossier est **hérité** par tout son contenu
  (résolution en remontant l'arbre, façon Google Drive). **(2) Import de DOSSIER** (sans ZIP) — on
  choisit un dossier de l'ordinateur, son **arborescence exacte** (dossiers dans dossiers…) est
  recréée dans le Drive puis chaque fichier téléversé au bon endroit (`webkitdirectory` →
  `ensureDriveFolders` recrée l'arbre sans doublon → envoi par fichier). **(3) Fiabilité des envois** —
  bouton **« Réessayer »** sur un lot en échec (relance seulement les fichiers ratés, sans perdre la
  file) + retentes portées à 5 avec backoff 0,5 → 4 s. **(4) Réunions** — seuls **l'organisateur**
  (et le Super Admin) peuvent modifier les paramètres/infos d'une réunion (plus la Direction).
  **(5) Fenêtre flottante de téléversement** — **déplaçable** partout à l'écran (glisser l'en-tête) et
  **réductible** en une petite bulle. **(6) Rapports terrain épurés** — même en vue Direction, plus de
  listes agrégées (pharmacovigilance, opportunités, objections…) : **juste les rapports, les uns après
  les autres**. Côté délégué, **hôpital/établissement** et **médecin** sont **optionnels** (champ libre).
- **Messagerie façon WhatsApp + Stocks affinés (3 sujets).** **(1) Présence en ligne / hors ligne
  avec heure exacte** — l'en-tête d'une conversation directe affiche **« En ligne »** (point vert) ou,
  hors ligne, **« Vu à HH:MM »** (heure exacte du dernier passage, « hier » / date au-delà), mis à jour
  en direct via le heartbeat existant (`lastSeenAt`). **(2) Accusés de lecture (coches)** — sur MES
  messages : **une coche** = envoyé, **deux coches** = distribué (le destinataire a synchronisé),
  **deux coches bleues** = lu ; calculé à partir de `ConversationMember.lastReadAt` (lu) et `lastSeenAt`
  (distribué), en groupe il faut que **tout le monde** ait vu/lu (aucune migration, données déjà là).
  **(3) Stocks — produits filtrés** : seuls les produits Regulatory au statut **« Décision obtenue »**
  (`DECISION_OBTAINED`) sont proposés pour saisir un état de stock (on ne suit que des produits
  réellement enregistrés).
- **Chat de réunion + validation à commentaire optionnel + badges de menu + « Mon dossier RH » autonome
  + Annexes PCH de retour (5 sujets).** **(1) Fil de discussion dans la réunion** — chaque réunion a
  désormais un **vrai chat** (comme les autres discussions) : **texte + pièces jointes intégrées**
  (stockées chiffrées via le backend Drive), ouvert à l'organisateur et aux participants ; les membres
  sont notifiés, l'auteur (ou l'organisateur) peut supprimer un message. Nouveaux `MeetingMessage` +
  `MeetingMessageAttachment`, route de service protégée par l'accès à la réunion. **(2) Décision de
  validation à commentaire OPTIONNEL** — Valider / Demander une modification / Refuser s'accompagnent d'un
  **commentaire facultatif** (le motif n'est **plus obligatoire**, même en cas de refus). **(3) Badges de
  notification par module** dans le menu — chaque entrée de la barre latérale affiche une **pastille** du
  nombre de notifications non lues **routées vers ce module** (via le lien de la notif → `moduleForPath`),
  qui décroît à mesure qu'on les lit. **(4) « Mon dossier RH » ressort de « Mon espace »** — de nouveau
  une **entrée de menu dédiée** (avec « Mes ordres de mission » en onglet), retirée des onglets de l'espace
  personnel. **(5) « Annexes PCH » de retour dans les Stocks** — 3ᵉ onglet **Stock annexes PCH** à côté de
  PCH et hôpitaux ; hôpitaux et annexes sont des **lieux nommés** (`StockAnnex.kind` = HOSPITAL | ANNEX)
  créés/supprimés **uniquement par le Super Admin** (comme les hôpitaux).
- **Liste de documents épurée + réunions présentiel & réponses d'invitation + Calendrier autonome
  (5 sujets).** **(1) Liste de documents refondue** — plus de badge « Interne » ni de rangée d'icônes
  entassées (qui débordaient dans les colonnes étroites) : le **nom** (plus petit) est **cliquable** et
  ouvre l'aperçu ; **toutes les actions** (imprimer, modifier dans l'éditeur Office, renommer,
  enregistrer/télécharger, supprimer) vivent dans la **barre d'outils de l'aperçu**. **(2) Réunions en
  PRÉSENTIEL** — à la création (et à la modification) on choisit **En ligne (lien)** ou **Présentiel** ;
  en présentiel on saisit un **lieu** (pas de lien) — nouveaux champs `Meeting.inPerson` + `location`.
  **(3) Réponse d'invitation façon agenda** — chaque invité peut répondre **Oui / Peut-être / Non** ;
  l'organisateur est notifié et voit le statut de chacun (nouveau `MeetingParticipant.response`, réutilise
  l'enum `CalendarInviteStatus`). **(4) Cartes de réunion** — titres et badges **bornés/tronqués** (fini le
  débordement hors des cartes « À venir »). **(5) « Calendrier »** ressort de « Mon espace » comme **module
  autonome** (entrée de menu dédiée).
- **Upload « Fichiers ou ZIP » partout + visionneuse ZIP dans le Drive + notifications bureau + écran
  anti-capture retiré (4 sujets).** **(1) Upload simplifié** — le composant de dépôt de documents
  (partagé par tous les modules) ne propose plus que **« Fichier(s) (tout type) »** ou **« ZIP »**
  (le mode « Dossier » webkitdirectory est retiré ; pour un dossier entier, on l'envoie compressé en
  .zip), avec un libellé clair. En **Regulatory**, tout dépôt reste répliqué automatiquement dans le
  **dossier Drive du produit** (le ZIP y est conservé **entier**). **(2) Visionneuse ZIP dans le Drive**
  — ouvrir un fichier `.zip` du Drive affiche désormais son **contenu** (liste des entrées + recherche)
  et permet de **visualiser** chaque fichier interne (image, PDF, texte, vidéo, audio) **inline** ou de
  le télécharger, sans décompresser l'archive (extraction serveur d'une entrée à la demande, bornée en
  taille, accès hérité de l'arbre Drive). **(3) Notifications sur l'ordinateur** — à la réception d'un
  message, si l'onglet n'est pas au premier plan, une **notification bureau** s'affiche (en plus du son) ;
  le bouton « Activer les notifications » fonctionne même sans clés VAPID (le Web Push reste le
  complément « navigateur fermé » quand `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` sont posées). **(4) Écran
  anti-capture retiré** — le voile plein écran « capture surveillée » (au raccourci ET à chaque perte de
  focus) est supprimé ; seule l'**alerte Super Admin** (audit + notification) est conservée.
- **« Mon dossier RH » intégré à « Mon espace » + coût IA Claude réduit drastiquement (2 sujets).**
  **(1) « Mon dossier RH » rejoint « Mon espace »** — plus d'entrée de menu séparée : « Mon dossier RH »
  et « Mes ordres de mission » deviennent des **onglets** de l'espace personnel (aux côtés de Mon travail,
  Mon espace, Dashboard, Calendrier, Directives), gardés par leur module comme avant. **(2) Conso de
  crédits Claude fortement réduite, à qualité préservée** — deux **paliers** de modèle (`ai.ts`) : palier
  **qualité** (`claude-sonnet-4-6`) réservé à ce qui l'exige vraiment (14 agents CTD sourcés, simulateur
  d'examen, réponse aux réserves, assistant conversationnel, Adventum Brain) ; palier **éco**
  (`claude-haiku-4-5`, ≈ 3× moins cher) pour les tâches **mécaniques**. Le **principal poste de coût** —
  la **revue de fond/forme par parts** (jusqu'à `REG_AI_MAX_CHUNKS`, défaut **120 appels/version**) —
  bascule sur le palier éco ; idem extraction de faits (jumeau), analyse des rapports vocaux, résumés de
  réunion, brouillons fournisseur, Q&R de dossier et suggestion proactive (nudge). **Prompt caching** du
  bloc system stable ajouté à `askClaude` (préfixe relu à ~0,1×). Garde-fous inchangés (sortie Zod,
  ancrage des preuves, citations RAG, constats PROJET non bloquants, contrôles critiques déterministes).
  Réglable par `AI_MODEL` / `AI_MODEL_CHEAP`.
- **Navigation, modules & flux de travail — téléversements non bloquants, séparation Rapports terrain,
  réorganisation Mon espace, chat de dossier (4 sujets).** **(1) Téléversements EN ARRIÈRE-PLAN,
  globaux** — un envoi bloquait la page et changer de module l'annulait ; un `BackgroundUploadProvider`
  monté dans la mise en page prend en charge **tous** les téléversements (Documents — utilisé dans
  ~16 pages —, Drive import simple **et** riche) : dès le clic « Téléverser », on peut **naviguer et
  continuer à travailler**, les fichiers montent **en parallèle** (XHR + progression réelle, retente
  réseau/5xx/429), une pastille flottante suit la progression partout. Le dossier CTD garde son moteur
  résumable par parties. **(2) Rapports terrain = module autonome** — séparé de Promotion médicale
  (nouveau module RBAC `FIELD_REPORTS`, **accès configurables séparément** dans Administration ; deux
  entrées de menu distinctes). Le **superviseur national** (National Sales) voit **tous** les rapports
  des délégués ; le délégué ne voit que les siens. **Saisie manuelle du nom du médecin** dans le compte
  rendu (jamais écrasée par l'IA). **(3) « Mon espace » réorganisé** — regroupe Mon travail, Mon espace,
  **Dashboard**, **Calendrier** et Directives (onglets) ; **« Dossiers » sort** comme module à part
  entière. **(4) « Suivi & discussion » d'un dossier = vrai chat** — pièces jointes **intégrées au fil**
  (comme la messagerie, stockées chiffrées), et **mentions (@)** limitées aux **participants** du
  dossier (notification dédiée). Nouveaux : `DossierMessage.mentionIds` + table
  `DossierMessageAttachment`, route de service protégée par l'appartenance.
- **Expérience & intelligence — chatbots propres, réserves, stocks, recherche, rappels, cerveau continu
  (9 sujets).** **(1) Chatbot « Discuter avec ce dossier » — réponse propre** : sortie nettoyée de tout
  markdown/caractère spécial (titres `##`, gras `**`, citations `>`, `---`, puces, émojis, `[P]/[C]`) tout en
  **préservant les citations numériques `[n]`** et la ponctuation française. **(2) Réserves ANPP — « Discuter
  avec les réserves »** : chat qui **rédige des réponses exigeantes**, scientifiquement/réglementairement
  justes, **uniquement à partir du dossier** ; **s'abstient** sur le prix / le commercial, **signale ce qu'il
  faut demander au fournisseur** — sourcé, texte brut, n'invente rien. **(3) Stocks — refonte** : fin des
  « annexes » (deux périmètres, **Stock PCH** + **Stock hôpitaux**) ; **hôpitaux créés par le Super Admin**, les
  autres rôles **enregistrent seulement des états** ; enregistrement pour un hôpital exigeant l'hôpital
  concerné (**corrige le « ça marche pas »**) ; **demande d'état de stock à un instant T** (Direction / Super
  Admin → délégué : tâche assignée + notification). **(4) Upload CTD illimité & rapide** : aucun plafond serveur
  sur le nombre de fichiers par module ; les échecs transitoires par fichier sont **réessayés avec backoff**.
  **(5) Bug création de demande via chatbot** : la référence utilisait `count()+1` (collision avec l'unicité
  après purge Corbeille) → **`buildRef` (max) + `createWithRetry` (P2002)**, généralisé aux **12 générateurs de
  références**. **(6) OCR Mistral vraiment utilisé** : la méthode d'extraction est **taguée** (`ocr-mistral` /
  `ocr-tesseract`) et un **diagnostic en ligne** le confirme — Mistral ne tourne que sur les scans (les PDF
  natifs n'en consomment pas). **(7) Recherche globale ultra-smart** : multi-termes (AND de OR insensible à la
  casse) couvrant dossiers CTD, discussions/messages, demandes du secrétariat, congrès, événements, directives.
  **(8) Rappels en un clic** (`Reminder` + sweep planifié) sur un dossier, un sujet ou une demande du
  secrétariat — notification cloche + push à l'échéance. **(9) Adventum Brain + Process Intelligence — analyse
  EN CONTINU (« Adventum Pulse »)** : instantané horaire persisté (`IntelligenceSnapshot`) des agrégats
  Risk Radar + Process Intelligence, **tendances** (bandeau `PulseStrip` : deltas + mini-courbe) et **alerte
  proactive** au Super Admin sur tout **nouveau risque critique** — même module fermé ; nouveau détecteur
  **« demande du secrétariat en retard »**.
- **Analyse CTD — jumeau numérique par IA, analyse plus exigeante, pièces admin hors CTD, gros fichiers
  blindés (5 sujets).** **(1) Compréhension par IA du jumeau numérique** — le jumeau n'est plus seulement
  déterministe (regex) : une couche IA **comprend le sens** et propose les faits que les règles ne savent pas
  saisir (composition, indications, posologie, spécifications, stabilité, procédé, adresses de site…). Chaque
  fait proposé cite une **preuve** dont on **vérifie l'ancrage** (l'extrait figure réellement dans le
  document → jamais d'invention), la clé est **bornée au catalogue**, la confiance est **plafonnée** (le
  déterministe prime à valeur égale), l'appel est **borné** (sections porteuses, un seul appel quel que soit
  le volume) et **non bloquant**. Tout fait reste **PROPOSED → revue humaine** (marqué « IA » dans les
  sources). **(2) Analyse beaucoup plus exigeante** — la revue de fond/forme et les 14 agents adoptent la
  posture d'un examinateur ANPP **sévère** : checklist explicite **fond** (cohérence ANPP/ICH, éléments
  manquants, incohérences DCI/dosage/lot/dates/unités, données non étayées, références périmées) **et forme**
  (signatures/dates/cachets, pagination, numérotation CTD, langue/traductions fr-ar, qualité scans/OCR,
  formats). Garde-fous inchangés (preuve exacte, Zod, jamais bloquant, abstention). **(3) Pièces
  administratives hors CTD** — `1.0` lettre d'accompagnement, `1.2` formulaire, `1.2.1` bordereau de
  versement sont fournies **de notre côté** (portail ANPP en ligne) : elles ne **pénalisent plus** la
  complétude CTD ni ne créent de bloqueur (filtrées du scoring, y compris des packs déjà amorcés — aucune
  migration), et apparaissent dans une **checklist séparée « Documents obligatoires pour l'enregistrement
  (hors CTD) »**. **(4) « Réponse IA non exploitable » corrigé** (simulateur d'examen & agents) — cause n°1 =
  réponse IA **tronquée** au plafond de jetons : extracteur JSON **tolérant** partagé (referme chaînes/
  structures ouvertes) + plafonds de jetons relevés. **(5) Worker thread pour les gros fichiers (>100 Mo)** —
  le parse natif (pdf-parse/mammoth/xlsx) tournait **synchronement** sur le thread du serveur → un fichier
  >100 Mo **figeait toute l'app** ; il est désormais **déchargé dans un worker thread** (transfert zéro-copie,
  timeout, **repli en ligne** si indisponible), les petits fichiers restant en ligne.
- **Analyse CTD — correctifs (crash Bases de données, classification « Module N », fluidité).** **(1)** Le
  crash serveur de **Administration → Bases de données** (`fmtBytes` exporté d'un composant client puis appelé
  côté serveur) est corrigé via un utilitaire **server-safe** (`formatBytes`). **(2)** Un fichier nommé
  **« Module 2 »** n'est plus classé en 3.2.x : le **module du nom de fichier prime** sur les mots-clés du
  contenu (un QOS cite des sections 3.2 sans en être). **(3)** L'app reste **fluide pendant l'extraction et
  l'analyse** : cession de la boucle d'événements (`setImmediate`) entre documents/lots (le thread n'est plus
  monopolisé).
- **Lot budgets/finances/regulatory/admin/perf (12 sujets).** **(1) Budgets découplés des Finances** — une
  ligne de dépense ajoutée depuis le module Budget (« + » réf. + montant) crée désormais une **ligne purement
  budgétaire** (`BudgetExpenseLine`) qui consomme la catégorie **sans** toucher la trésorerie ; le financier
  enregistre le mouvement réel s'il le souhaite. Les anciennes lignes (créées comme FinanceTransaction) sont
  **reprises** puis retirées des Finances (migration). **(2) Suppression** des lignes budgétaires (corbeille sur
  les dépenses imputées ; la consommation se réajuste). **(3) Regulatory — miroir Drive AUTOMATIQUE** : tout
  document officiellement téléversé sur un produit est répliqué dans le Drive (dossier du produit, partagé), **en
  arrière-plan** (upload ressenti instantané) — fin du bouton manuel. **(4) Finances & Promotion médicale —
  lignes modifiables + supprimables** (livre comptable : `updateTransaction`/`deleteTransaction`, trésorerie
  recalculée ; visites : édition complète de la ligne). **(5) Administration → onglet « Bases de données »**
  (Super Admin) : liste des bases porteuses de stockage + suppression **définitive** de fichiers/documents/dossiers
  + **ramasse-miettes** des blobs orphelins qui **libère réellement** l'espace disque (contenu dédupliqué).
  **(6) Process Intelligence — statuts corrigés** : états terminaux sponsoring (ANNULÉE/APPROUVÉE) exclus, et
  demandes administratives **supprimées** (suppression douce `deletedAt`) enfin masquées. **(7) Analyse CTD —
  ranking sémantique fin** : colonne **tsvector indexée (GIN, « french »)** générée à l'extraction ; la recherche
  du chatbot départage par `ts_rank_cd` (racinisation, fréquence, densité). **(8) Analyse CTD** — retrait du
  **formulaire de pré-soumission** (tout se fait sur la plateforme ANPP en ligne). **(9) Performance / upload** :
  lecture unique du binaire, miroir Drive non bloquant, concurrence d'upload 6, `getCompanies` mémoïsé par requête.
- **Budgets : catégories modifiables, attribution scopée & ré-attribuable, export Excel.** Le **module
  d'une catégorie de tête** est désormais **modifiable et ré-enregistrable** (un bug le laissait figé après
  création). À la **validation définitive** d'une dépense, la Direction choisit la **(sous-)catégorie**
  uniquement parmi les **enveloppes qui lui sont accessibles** (ouvertes par le Super Admin) ; et **toute
  dépense reste RÉ-ATTRIBUABLE** à une autre (sous-)catégorie à tout moment depuis le tableau des budgets.
  Enfin, **export Excel (.xlsx)** du budget avec le **taux de consommation** par catégorie + une feuille
  « Total enveloppes ». +6 tests (export relu par SheetJS, scoping des options par accès).
- **Validations, santé du chatbot, dépôt Drive Regulatory & lisibilité.** Cinq sujets. **(1) Accès
  temporaire de validation** — un validateur (ex. un chef de produit recevant un bon de commande à
  valider) obtient, LE TEMPS de décider, une LECTURE du module concerné (résolu depuis le libellé
  stocké OU l'URL de l'objet) + l'accès à la ligne liée, révoqué dès la décision ; et il **voit/prévisualise
  l'original SUR PLACE** dans la carte « À valider ». **(2) Test IA quotidien** — le planificateur interne
  ping l'API du chatbot une fois par jour (`aiSelfTest` → message d'erreur EXACT : clé/crédit/HTTP/réseau),
  journalise (`AiHealthCheck`) et **alerte tous les Super Admins** en cas de panne (message de rétablissement
  au retour) ; carte « Santé du chatbot » + bouton « Tester maintenant » au Centre de contrôle IA. **(3) Dépôt
  Regulatory → miroir Drive** — depuis une fiche produit, déposer un/plusieurs **fichiers**, un **dossier**
  entier ou une **archive ZIP** : le contenu est répliqué dans le Drive sous un dossier **nommé d'après le
  produit**, en conservant l'**arborescence exacte** (ZIP décompressé via l'inspecteur sécurisé ; re-dépôt =
  nouvelle version, pas de doublon ; dossier partagé en lecture avec les parties prenantes). **(4) Lisibilité
  Drive** — type de fichier **humain** (« Document Word » au lieu du MIME brut) et fin du débordement du
  panneau d'infos. +19 tests ciblés.
- **Analyse CTD — fin des fausses « sections manquantes », faits plus propres, chatbot de dossier musclé.**
  Trois chantiers sur un vrai dossier de 459 Mo (11 fichiers, dont un « Module 3.pdf » de 381 Mo). **(A)** Un PDF de
  module **consolidé** est désormais reconnu comme couvrant **plusieurs sous-sections** (`ctd/detect-sections.ts` :
  code CTD **corroboré par son titre**, frontières de mot ; un renvoi « voir 3.2.P.8 » ne compte pas) → stockées
  dans `containedSections`, la complétude **cesse de signaler ces sections comme manquantes à tort**. **(B)** Extraction
  de faits **anti-bruit** (`twin/extract-facts.ts`) : mot entier (« gel » ≠ « angel ») + **contexte borné à la phrase**
  qui écarte une voie « Intravenous » de canule PK, un stockage d'**échantillons** à –70 °C, une forme issue de
  « gélatine » ; **associations** de teneurs « 50 mg / 300 mg » captées (INN accentués compris). **(C)** Le chatbot
  **« Discuter avec ce dossier »** répond **sourcé (fichier · section · page EXACTE)** : décomposition question →
  termes + **synonymes FR/EN** + codes CTD, **récupération multi-termes classée**, **page résolue par décalage →
  `ocrPages.chars`** (sans ré-océrisation — la résolution précédente, basée sur un champ inexistant, ne marchait pas),
  **contexte enrichi** (faits, sections manquantes, inventaire) + **historique** pour les questions de suivi, citations
  `[n]` et **abstention** stricte. +32 tests ciblés.
- **Stockage des fichiers déporté vers S3/R2 — le disque Postgres arrête de gonfler.** Le backend de blobs
  (`lib/drive-storage.ts`, point unique qui touche les octets) stocke désormais le contenu **chiffré (AES-256-GCM,
  inchangé)** dans un **bucket S3/R2** quand `REG_S3_*` est configuré ; la base ne garde plus que les métadonnées
  (IV + SHA-256 + taille + compteur de refs + clé objet). **Rétrocompatible** : les blobs déjà en base restent lus
  depuis la colonne `data` (`storageKey` NULL) ; sans config, tout reste en base. Cela répond à la saturation du
  disque de la base (`No space left on device`) causée par le stockage des dossiers en base. Client objet S3
  **sans SDK** (SigV4 fait main) étendu avec `putObject`. Migration `FileBlob` (`data` nullable + `storageKey`).
  **Récupération de l'espace existant** : `npm run blobs:migrate-r2` déplace les blobs historiques vers R2 (un par
  un, mémoire bornée) puis `VACUUM FULL "FileBlob";` rend l'espace au disque. Test : aller-retour chiffré via un
  magasin objet en mémoire (`drive-storage.r2.test.ts`).
- **Regulatory Intelligence OS — téléversement « ultra-rapide » : upload DIRECT S3/R2 + pool DB réglable.**
  Deux leviers de vitesse, activés par variables d'environnement (absents → comportement inchangé, aucune régression) :
  - **Chantier 1 — envoi DIRECT (navigateur → bucket S3/R2), bypass serveur + Postgres.** Signatures **AWS SigV4
    faites main** (aucune dépendance SDK ; clé de signature vérifiée contre un vecteur connu), URL PUT présignée,
    puis le serveur **lit l'objet** pour l'inspecter/ingérer et **supprime l'archive temporaire**. Repli automatique
    sur l'upload résumable en base si non configuré. Env : `REG_S3_ENDPOINT`, `REG_S3_BUCKET`, `REG_S3_ACCESS_KEY_ID`,
    `REG_S3_SECRET_ACCESS_KEY`, `REG_S3_REGION` (défaut `auto`), `REG_S3_FORCE_PATH_STYLE` (défaut `1`).
    **À provisionner côté fournisseur** : le bucket + une règle **CORS** autorisant `PUT` depuis l'origine de l'app.
    Fichiers : `intelligence/upload/object-storage.ts`, `…/session.ts` (`startDirectUploadSession`/`finalizeDirectUploadSession`),
    route `api/…/upload/direct/[sessionId]/finalize`, `…/upload/session` (aiguillage direct/résumable), `ctd-upload.tsx`.
  - **Chantier 2 — pool de connexions DB + concurrence réglables.** `DB_CONNECTION_LIMIT` (+ `DB_POOL_TIMEOUT`) élargit
    le pool Prisma (défaut ~3 sur 1 vCPU → cause des 500 sous forte concurrence) ; `REG_UPLOAD_CONCURRENCY` aligne le
    nombre de parties envoyées en parallèle (surfacé au client). Fichiers : `lib/prisma.ts`, `…/upload/session.ts`.
  - Réglages d'envoi (déjà en place) : `REG_UPLOAD_PART_MB` (4 Mo), `REG_ZIP_MAX_ARCHIVE_MB` (4 Go), reprise résumable.
- **Regulatory Intelligence OS — pipeline CTD prouvé de bout en bout + correctif « les scans sont lus jusqu'au
  bout ».** Test d'intégration **réel** (base + OCR + moteur, aucune simulation) qui télécharge un dossier ZIP
  multi-formats (txt, docx, xlsx, **scan PNG océrisé**, exécutable **bloqué**) et observe **chaque** étape :
  décomposition sécurisée → **lecture de TOUS les fichiers** (texte natif *et* OCR réel du scan → « AMOXICILLINE »
  extrait) → classification CTD (1.0/1.2/3.2.P.8/1.4) → **jumeau numérique** (faits sourcés) → conflits → **règles**
  (bilan + constats) → `IN_REVIEW`, tous les jobs `DONE`. **Correctif de fond** : le contenu **océrisé** des scans
  alimente désormais réellement le jumeau, la revue IA et les agents (les statuts `OCR_COMPLETED`/`LOW_CONFIDENCE`
  étaient auparavant ignorés en aval — seul `TEXT_EXTRACTED` était lu) ; provenance OCR pondérée à la baisse pour
  départager les conflits en faveur de la couche texte native. Fichiers : `intelligence/pipeline.e2e.test.ts`,
  `intelligence/twin/build-facts.ts`, `intelligence/extract/extract-text.ts` (statuts textuels partagés),
  `intelligence/jobs/runner.ts`, `intelligence/agents/orchestrator.ts`.
- **Regulatory Intelligence OS — capacités centrales (G1→G14, au-delà de la fondation).** La fondation
  « Secure CTD Intake » (ci-dessous, phases 0→6) est conservée ; ce lot livre les **critères d'acceptation**
  du Regulatory Intelligence OS, chacun vérifié (tsc + tests + build), org-scopé, audité, avec **statut réel /
  simulé / restant** explicité :
  - **Jumeau numérique sourcé (G1)** : ~30 faits réglementaires (`RegulatoryFact` + occurrences avec document/
    section/extrait exact/confiance/méthode/statut humain) ; écran de revue/approbation.
  - **Détection de conflits (G2)** : comparaison des occurrences d'un même fait entre documents → `RegulatoryConflict`
    (valeurs concurrentes, criticité, action, valeur finale approuvée).
  - **Corpus versionné (G3)** + **RAG réel (G4)** : `RegulatorySource/Version/Section/CorpusApproval` administrables
    (import/approuver/activer/retirer) ; recherche **FTS `french` + trigram `pg_trgm`** sur le corpus **ACTIF** avec
    **citations exactes** (pgvector indisponible ici → socle prêt pour embeddings). Sans source active :
    « EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE ».
  - **Moteur de règles administrable (G5)** : `RegulatoryRulePack`/`RegulatoryRule` versionnés, testables (cas golden),
    sourçables ; 8 rule packs ANPP amorçables ; **repli** sur les profils codés tant qu'aucun pack actif (aucune régression).
  - **14 agents spécialisés (G6)** : prompt versionné, périmètre limité, **Zod**, sources autorisées, **citations RAG**,
    **abstention** (aucune source active → pas d'invention), tests golden ; orchestrateur + panneau à la demande.
  - **Comparaison V1/V2 (G7)** : fichiers inchangés/ajoutés/supprimés/remplacés (chemin + SHA-256), diff de faits.
  - **Boucle fournisseur (G8)** : questions + **BROUILLON** d'e-mail (IA ou modèle, **jamais envoyé auto**), échéance,
    statut, relance, historique.
  - **Réserves ANPP (G9)** : lettre → **OCR réel** → décomposition en points (verbatim) → catégorisation → réponse
    proposée → **approbation** → multi-cycles.
  - **Génération documentaire (G10)** : 10 templates `.docx` versionnés (pizzip + docxtemplater), données du
    **jumeau APPROUVÉ uniquement** (non approuvé → « [À COMPLÉTER] »).
  - **Reviewer Simulator (G11)** : stress test 10 perspectives — **simulation interne NON prédictive**.
  - **OCR RÉEL (G13)** — **deux moteurs, contrat commun** (`REG_OCR_ENGINE` = `auto`|`mistral`|`tesseract`) :
    1. **PRIMAIRE — Mistral OCR** (`mistral-ocr-latest`, cloud) quand `MISTRAL_API_KEY` est présent : **un appel
       réseau par document** (multi-pages géré côté serveur), rapide et précis. Le runner **parallélise** l'OCR
       (pool document `REG_OCR_CONCURRENCY`, lot `REG_OCR_BATCH`≈24) → dossier de 50-100 fichiers en **quelques
       minutes** (au lieu de 1-3 h). **Documents MASSIFS (8 000–10 000 pages) : DÉCOUPAGE automatique par tranches**
       de pages (`REG_OCR_CHUNK_PAGES`≈400, sous les limites Mistral 1000 pages/50 Mo) via mupdf (`ocr/pdf-split.ts`),
       tranches océrisées **en parallèle** (`REG_OCR_CHUNK_CONCURRENCY`≈4) puis **fusionnées** dans l'ordre. Une
       tranche qui échoue → pages vides signalées (revue), les autres passent ; toutes en échec → repli Tesseract.
       Service **tiers payant à la page**, réseau sortant requis.
    2. **REPLI/AUTO-HÉBERGÉ — tesseract.js** + mupdf (rastérisation PDF) + sharp, langue **locale** fr/en/ar
       (hors-ligne, séquentiel). En mode `auto`, tout échec Mistral (réseau/quota) bascule dessus — **jamais de perte**.
    Texte + confiance par page, natif vs OCR séparés, pages vides/faibles → **revue humaine**. Mistral ne score pas
    la confiance → page non vide présumée fiable (95), page vide → 0/revue. **Garde de taille** : un document >~48 Mo
    (`REG_MISTRAL_OCR_MAX_MB`) part directement en OCR local (Mistral le refuserait — pas d'appel payant inutile).
    **Diagnostic en ligne** (droit d'upload) : `GET /api/regulatory/intelligence/ocr/diagnose` confirme le moteur
    actif + PING réel de la clé Mistral avant un gros upload. Code : `ocr/{ocr-engine,mistral-ocr}.ts`.
  - **Upload résumable (G14)** : session + parties (chemin d'upload borné à **une partie** en RAM), reprise,
    vérif taille + **SHA-256**, finalisation explicite (assemblage en flux), quotas org, concurrence, nettoyage.
    Charge mesurée (RSS) : 50/150/300 Mo — pic UPLOAD ≈ une partie ; pic FINALISATION croît avec la taille.
  - **Lifecycle (G12)** : chronologie (soumission/séquences/modifications/renouvellements/version approuvée),
    opérations NEW/REPLACE/DELETE/APPEND, **analyse d'impact déterministe**, obligations & certificats expirants.
  - **PERSISTENCE & RÉUTILISATION** — tout ce que l'analyse produit reste durablement en base (aucune purge
    après traitement) : documents classés CTD, **texte extrait/OCR** (`RegulatoryExtraction`), **faits du jumeau**
    + occurrences sourcées (`RegulatoryFact`/`…Occurrence`, décisions humaines incluses), **bilan** (`RegulatoryAssessment`)
    et **constats** (`RegulatoryFinding`), archive d'origine figée (SHA-256). Une **couche de connaissance**
    (`knowledge/dossier-knowledge.ts`) expose une surface de LECTURE stable pour la suite — **pré-remplissage de
    formulaire de présoumission**, **préparation automatique de dossier**, **réponses aux réserves** — et pour
    l'**interrogation par le chatbot** : `getDossierKnowledge` (snapshot), `getApprovedFactMap` (faits validés →
    formulaire), `getDossierDocuments` (par module/section CTD), `searchDossierContent` (recherche plein texte,
    **extrait calculé côté base** → tient même sur un document océrisé de 10 000 pages).
  - **« Discuter avec ce dossier » — chatbot SOURCÉ (fichier · section · page)** (`knowledge/dossier-chat.ts`,
    panneau `chat-panel.tsx`) : à chaque question, on **décompose** la question en termes saillants + **synonymes
    FR/EN** du domaine + codes CTD (`expandQueryTerms`), on **récupère multi-termes classé** les passages des
    documents réellement lus (`searchDossierPassages` — score = nb de termes distincts, extrait ET décalage du 1ᵉʳ
    terme calculés **côté base**), et on résout la **PAGE EXACTE** de chaque extrait par le **décalage → `ocrPages.chars`**
    (`pageForOffset`, sans ré-océrisation). Le modèle ne reçoit que ces extraits + un **CONTEXTE structuré** (faits
    avec valeur retenue/conflit, complétude, **sections requises encore manquantes**, inventaire des documents avec
    sous-sections contenues et état d'extraction) et l'**historique récent** (questions de suivi) ; il doit **citer
    [n]**, distinguer proposé/confirmé, et **s'abstenir** si l'info n'y est pas (contenu traité en donnée non fiable —
    anti-injection). Sans clé IA : les sources restent affichées, **aucune réponse simulée**.
  - **PDF de module CONSOLIDÉ → détection MULTI-SECTIONS** (`ctd/detect-sections.ts`) : un « Module 3.pdf » couvre
    en réalité 3.2.S / 3.2.P / 3.2.P.5 / 3.2.P.8… Un balayage précis (code CTD **corroboré par son titre** à ≤90 car.,
    frontières de mot — un simple renvoi « voir 3.2.P.8 » ne compte pas) renseigne `RegulatoryDocument.containedSections`
    (persisté, backfillé à la relance) ; la complétude et le jumeau **cessent de signaler ces sous-sections comme
    « manquantes » à tort**.
  - **Extraction de faits — anti-bruit** (`twin/extract-facts.ts`) : recherche par **mot entier** (« gel » ne matche
    plus « angel ») + **contexte borné à la phrase** (`localCtx`) qui **écarte** une voie « Intravenous » venant d'une
    canule/prélèvement PK, un stockage d'**échantillons** à –70 °C (≠ conservation du produit), une forme issue de
    « gélatine »… et **capte les associations** de teneurs « 50 mg / 300 mg » (y compris rédigées « … et … », INN
    accentués compris) sans confondre avec une posologie.
  - **Stockage blobs — jusqu'à ~1 Go/fichier** : contenu chiffré AES-256-GCM ; un gros fichier est écrit **EN
    TRANCHES** ordonnées (`FileBlobChunk`, `REG_BLOB_CHUNK_MB`≈16) plutôt qu'en un bytea unique — pas d'encodage
    hex géant → mémoire bornée en écriture **et** lecture. Plafond par fichier `REG_MAX_PG_FILE_MB` (défaut **950 Mo**).
    NB honnête : *océriser* un PDF proche d'1 Go reste borné par la RAM (mupdf charge le PDF) — prévoir ≥ 4 Go, ou activer R2.
  - Réalités infra assumées : stockage = **blobs Postgres chiffrés** (pas S3) ; IA = **opt-in sur clé** (abstention
    honnête sinon, aucune simulation). Code : `src/lib/regulatory/intelligence/{twin,corpus,rules,agents,diff,ocr,
    upload,docgen,reserves,supplier,simulator,lifecycle,knowledge}` ; admin corpus/règles `src/app/(app)/admin/regulatory-corpus/`.
- **Regulatory Intelligence OS** — **analyseur de dossier CTD (phases 0→6).** Onglet **Analyse CTD**
  sous Regulatory → Enregistrement, débloqué **par organisation** par le Super Admin
  (`RegulatoryFeatureAccess`, bascule dans Administration → Réglages). Circuit : dépôt d'un **dossier CTD
  en ZIP** → **inspection sécurisée** (anti ZIP-bomb, path traversal, exécutables/macros refusés, chemins
  vérifiés) → chaque fichier **conservé chiffré** (blob SHA-256), **archive originale figée** → **extraction
  de texte** (txt/docx/xlsx ; PDF via pdf-parse ; scans → OCR requis) + **détection MIME** (octets magiques)
  → **classification CTD déterministe** (module 1 Algérie + 2-5 ICH ; code/mots-clés/module, avec évidence)
  + **nom de fichier proposé** → **moteur de règles déterministe** : complétude par type de procédure,
  **bloqueurs critiques** (section obligatoire manquante, dossier vide), **jamais de fausse conformité**
  (un score élevé ne rachète pas un bloqueur) → **constats** (sécurité/complétude/extraction/classification)
  + **bilan de conformité** → **revue IA optionnelle** (fond/forme) **encadrée** : sortie **validée par Zod**,
  **anti-injection de prompt**, statut **PROJET — REVUE HUMAINE REQUISE**, **jamais bloquante**, active
  seulement si `ANTHROPIC_API_KEY` (aucune simulation sinon). **Analyse PAR PARTS de ~10 pages** (`agents/chunk-text.ts`)
  sur **TOUS** les documents lisibles (natif + OCR), sections prioritaires d'abord, **parallélisée**
  (`REG_AI_CONCURRENCY`) et **robuste** (une part en échec n'arrête pas les autres) ; bornée en coût
  (`REG_AI_MAX_CHUNKS` parts/version, 0 = illimité) et en volume de constats (`REG_AI_MAX_FINDINGS`, plus
  sévères d'abord) → **revue humaine** (constat pris en compte /
  résolu / **levé avec justification** par un rôle d'approbation ; nom proposé **approuvé**) → **porte de
  soumission** (« prêt pour revue »/« soumis » **verrouillés** tant qu'un bloqueur reste ouvert). Traitement
  **asynchrone Node-first** (`RegulatoryJob` + runner : verrou, reprise, lots, réessais) branché sur le
  planificateur interne (+ déclenchement immédiat après upload). Tout est **org-scopé**, **audité**
  (`RegulatoryAuditLog`), **testé** (inspecteur ZIP, ingestion, extraction, MIME, classification golden,
  moteur de règles, agent IA, porte de soumission). Cartographie détaillée : `docs/regulatory-intelligence/`.
  Code : `src/lib/regulatory/intelligence/` (`access`, `ingest`, `extract`, `ctd`, `rules`, `twin`, `agents`,
  `jobs`, `lifecycle`) + workspace `src/app/(app)/regulatory/enregistrement/analyse/`.
- **Lot T** — **Regulatory : Enregistrement ANPP (phase 1 — base de connaissance + expertise du bot).**
  **Base de connaissance réglementaire** algérienne intégrée (`src/lib/regulatory/anpp-knowledge.ts`) : droits
  d'enregistrement (bordereaux de versement), délais légaux par phase, pièces, **dossier CTD (5 modules ICH)**,
  formulaire de pré-soumission, modifications (mineure/modérée/majeure), décision (validité 5 ans), motifs de refus,
  références légales (décret 20-325 ; arrêtés 10/05/2021 et 03/10/2021). **L'assistant IA devient EXPERT** de ce
  cadre pour tout utilisateur ayant accès à Regulatory (digest injecté dans le system prompt — réponses fondées sur
  les articles, sans invention). **Onglet « Enregistrement (CTD) »** sous Regulatory, **masqué** tant que le Super
  Admin ne l'a pas débloqué (`AppSetting.regEnrollmentEnabled`, bascule dans Administration → Réglages) ; il affiche
  le **référentiel** complet. *Phase 2 à venir : analyseur de dossier CTD (décompression ZIP → lecture/renommage →
  analyse IA fond/forme vs loi algérienne + UE → préparation des formulaires).*
- **Lot S** — **Anti-blocage Infomaniak définitif : disjoncteur + cache.** Complète le Lot R. Quand Infomaniak
  sature (≥ `MAIL_BREAKER_THRESHOLD` échecs), un **disjoncteur** s'ouvre et la plateforme **arrête totalement** de
  le contacter pendant un temps de repos (`MAIL_BREAKER_COOLDOWN_MS`) — insister aggrave/prolonge le blocage IP ;
  au repos, l'IP se débloque seule. Pendant ce temps, la boîte est servie depuis un **cache mémoire** (dernière
  liste synchronisée + messages déjà ouverts) → l'utilisateur **voit toujours ses mails**, bandeau ambre « dernière
  synchronisation » + **nouvelle tentative auto**. Le **cache frais** fusionne aussi les chargements rapprochés
  (moins de connexions). `src/lib/mail.ts` (`loadInbox`/`getMessage` cache-aware, disjoncteur), route
  `/api/mail/messages` (`stale`/`syncedAt`), `courrier/mail-client.tsx` (bandeau + retry). Purge du cache à la
  déconnexion de la boîte.
- **Lot R** — **Fiabilité e-mail : fin des « command failed » à répétition.** Cause : sur l'hébergeur, **toutes** les
  boîtes sortent par la **même IP** ; Infomaniak limite les connexions IMAP **par IP** — plusieurs utilisateurs
  actifs (ou une rafale de reconnexions) saturaient l'IP → erreur en continu. Le verrou par compte existant ne
  bornait pas la concurrence **globale**. Ajouts (`src/lib/mail.ts`) : **plafond global** de connexions IMAP
  simultanées (`MAIL_MAX_CONCURRENCY`, défaut 3, file d'attente au-delà) · **plafond de connexions chaudes**
  (`MAIL_MAX_POOL`, éviction LRU) · **revalidation NOOP** d'une connexion inactive avant réutilisation (plus de
  « command failed » sur socket mort) · **réessais à back-off exponentiel** (0,4 → 0,8 → 1,6 s) sur erreur
  transitoire. Résultat : l'écrasante majorité des aléas fournisseur se résorbent **sans erreur visible**.
- **Lot Q** — **Téléversement de documents refondu** (dossiers CTD & tous objets métier). Avant : **un** fichier à
  la fois via action serveur (lent, re-rendu complet à chaque envoi, whitelist d'extensions restrictive → l'import
  « s'arrêtait » au bout de quelques fichiers). Désormais : **plusieurs fichiers OU un dossier entier**
  (`webkitdirectory`), **tous types** sauf exécutables (`validateDocumentUpload`), **sans limite de nombre**,
  envoyés **en parallèle** (concurrence 4) via une **route en flux** `POST /api/documents/upload` (hors limite des
  Server Actions) → **beaucoup plus rapide**, avec **file d'attente** et état par fichier (⏳/✓/✗ + réessai).
  Logique de persistance partagée `persistUploadedDocument` (`src/lib/documents.ts`). Amélioration **transverse** :
  le composant `DocumentUpload` est partagé par ~15 modules (Regulatory, Demandes, Dossiers, Sponsoring, Congrès,
  Logistique, Finances, Info médicale, RH, Missions…).
- **Lot P** — **Signature e-mail** (`MailAccount.signature`) : éditable depuis le Courrier (bouton « Signature »
  dans la barre latérale, aperçu en direct), **insérée automatiquement** en bas des nouveaux messages, réponses et
  transferts (au-dessus de la citation, curseur au début) — pas de double-ajout côté serveur. **Réunions
  modifiables** : l'organisateur (ou une vue globale) peut **modifier titre, objet, lien, type (vidéo/audio) et
  horaire** d'une réunion non terminée (`updateMeeting`, bouton « Modifier ») ; changer l'horaire **ré-arme** le
  rappel « 30 min avant ». Horaire saisi/affiché à l'heure d'Alger.
- **Lot O** — **Drive : téléchargement dossiers & sélection multiple en ZIP**. Télécharger un **dossier** génère
  désormais une **archive ZIP** de tout son contenu (récursif, arborescence préservée) au lieu d'une erreur ·
  **cases à cocher** sur chaque ligne + « Tout sélectionner » → **« Télécharger (ZIP) »** regroupe plusieurs
  fichiers **et/ou** dossiers en une seule archive (`/api/drive/zip?ids=…`) · accès vérifié sur chaque élément de
  tête (`resolveDriveAccess` + `canViewDrive`), descendants hérités, éléments en corbeille ignorés, garde-fou
  mémoire 800 Mo, journal d'audit `EXPORT`. Pièces jointes d'e-mail : la composition accepte déjà l'ajout de
  fichiers (bouton « Joindre » + validation des limites d'upload).
- **Lot N** — **Compteur d'activité** : pause après **10 min** sans interaction (au lieu de 60 s), reprise au
  mouvement (alimente le score d'adoption) · **Garde anti-capture** (`ScreenGuard`) : flou dissuasif à la détection
  d'une capture (Impr.écran, raccourcis macOS/Windows) et à la perte de focus, **alerte Super Admin** (notification
  + journal d'audit module « Sécurité » : qui, quoi, où). NB : un navigateur ne peut pas *empêcher* une capture —
  couche dissuasive + traçable (blocage dur = app bureau native).
- **Lot M** — **Courrier plus rapide & aux couleurs d'Infomaniak** : **pool de connexions IMAP** par compte (boîte
  gardée au chaud → chargement/lecture quasi instantanés, moins de « too many connections ») · **thème Infomaniak
  exact** (couleurs kMail : rose `#BC0055` / bleu `#0098FF` au choix) scopé au module · **grand écran immersif**
  (superposition app + plein écran natif du navigateur : on ne voit que l'e-mail).
- **Lot L** — **Dimension multi-entités** (sociétés du groupe) : modèle `Company` dynamique (Adventum, Pharmagène +
  Nᵉ entité), **sélecteur d'entité** dans la barre supérieure (Toutes / une entité), `companyId` sur 10 domaines
  (Regulatory, appels d'offres PCH, RH, Ad & Pro, promotion médicale, Finances, Information médicale, Stocks,
  Logistique, Ventes), filtre de liste + menu « Entité » sur les formulaires, **gestion en Administration → Entités**.
  Ad & Pro : **type de matériel** (Présentoir, Stand/Booth, Poster, Vidéo, … ; enum `MaterialType`).
- **Lot K** — Regulatory : **Détenteur de DE** + **variation d'enregistrement** (fabricant obligatoire en
  fabrication locale) · **Corbeille des suppressions définitives** (restaurable, Super Admin) + purge des
  **demandes de validation** · Administration : **Stockage Drive exact** (capacité/quota modifiables et appliqués)
  + **dernière activité au clic près** · **Paie RH** (matrice × mois, fiche de paie, notification employé à +24 h,
  transfert budget avec résumé) · **éléments de salaire** de l'employé (3 champs confidentiels) · FIX **fuseau des
  réunions** (10 h ≠ 11 h).
- **Lot J** — **Verrou notes de frais** (traitement RH bloqué avant l'accusé de réception des originaux par le
  secrétariat) · archives **« Dossier traité »** dans le Drive (RH, secrétariat, PRIM) · FIX grave : supprimer des
  demandes RH effaçait l'employé (corbeille par demande + type dédié + avertissement).
- **Lot I** — **Notes de frais** (mois obligatoire, validation mois demandé/suivant, avertissement originaux) ·
  **Entrevue avec les RH** (dates négociées → rendez-vous au calendrier).
- **Lot H** — **Logistique / Stocks séparés** + refonte Stocks en **états datés** (3 onglets, graphique/tableau) ·
  module **Courses** multi-points (secrétariat → chauffeur, checklist) · demandes de Mon dossier RH **traitées
  dans RH** · suppression médecin/visite · méta documents sur une ligne · **périodes d'essai**.
- **Moteur de workflow no-code** (4 catégories Ad & Pro) : étapes/pouvoirs/notifications éditables par le Super
  Admin, avis défavorables non éliminatoires, méta + historique réservés au Super Admin, rôles secondaires
  cumulés partout (`anyRoleFilter`).
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
