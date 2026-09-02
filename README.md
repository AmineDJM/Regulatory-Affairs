<div align="center">

# 🏥 AMD Internal OS — Adventum Pharma

**L'« OS d'entreprise » d'un laboratoire pharmaceutique algérien : un seul outil connecté pour piloter 100 % de l'activité.**

Regulatory · Ad & Pro (Sponsoring · Congrès · Événements · Matériel promotionnel) · Budgets & enveloppes · Finances ·
Ventes · Logistique & Marchés PCH · Annuaire (praticiens) · Information médicale · Business Development (+ Pharmatool) ·
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
  - [**Centre de paiement — l'autorisation du PDG**](#centre-de-paiement--rien-ne-sort-quel-que-soit-le-montant-sans-le-pdg)
  - [Chaîne du dossier d'achat (Legal)](#la-chaîne-du-dossier-dachat--devis--bc--facture--règlement-dun-seul-écran)
  - [My Chief of Staff — interface exécutive](#my-chief-of-staff--linterface-exécutive-pdg--super-admin)
  - [Matériel promotionnel — circuit court](#matériel-promotionnel--cinq-marches-puis-trois-chantiers-en-parallèle)
  - [Rejeu de session — support technique](#rejeu-de-session--rembobiner-ce-quune-personne-a-fait)
  - [Recrutement — de la demande à l'intégration](#recrutement--de-la-demande-dun-directeur-jusquà-lintégration)
  - [Congés — l'intérimaire qui tient la place](#congés--lintérimaire-qui-tient-la-place)
  - [Dimension multi-entités (cloisonnement)](#dimension-multi-entités-sociétés-du-groupe)
  - [Budgets par département (trois natures)](#budgets-par-département--trois-natures-trois-responsables)
  - [Ad & Pro — corriger une demande, joindre un fichier](#ad--pro--corriger-une-demande-joindre-un-fichier-à-un-avis)
  - [Assistant — recherche Regulatory & écriture](#assistant--recherche-regulatory-complète-et-écriture-sur-les-produits)
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
| **ANPP** | **Agence Nationale des Produits Pharmaceutiques** — autorité algérienne d'enregistrement. Le workflow Regulatory suit son **processus officiel (19 étapes / 5 phases)** — le CTD initial se dépose sur l'étape 1, la check-list de présoumission est l'étape 2, et le cycle des réserves vit dans la **frise des allers-retours** (« Réserves ANPP 1 », réponses, versions), pas dans des cases. L'étape « Réponse de la présoumission » porte un **avis explicite** : **favorable** → le processus continue · **défavorable** → à corriger et redemander · **en attente**. |
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
| **40** modules RBAC · **168** pages applicatives | **19** rôles métier |
| **238** modèles Prisma · **167** enums | **239** migrations SQL |
| **108** fichiers de *server actions* · **51** fichiers de requêtes | **80** routes API |
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
| **Mon travail** *(Action Center)* | `/mon-travail` | Redirige vers **Mon espace** (fusionné). La file agrège **selon les droits ET le métier** : validations **à mon tour seulement** (une étape en attente du validateur précédent reste sur `/validations` → « Qui vous reviendront »), paiements à régler **réservés au comptable** (`FINANCE_BUDGET_MANAGER`) + Super Admin, info médicale : stades d'instruction **réservés au PRIM** (+ Super Admin), la Direction ne reçoit que la **validation finale**. |
| **Mon espace** | `/mon-espace` | Le POSTE DE TRAVAIL : validations à faire, demandes à traiter, tâches (perso, demandées, partagées, déléguées — **suppression par le créateur** ou le Super Admin, pièces et fil compris), **pièces demandées** et **ordres de mission en sections** (plus d'onglets à part), rappels, congés **des autres** à signer (N+1), historique d'avances. **« Mes congés » vit uniquement dans Mon dossier RH.** |
| **Messagerie** | `/messages` | Messagerie interne complète (DM / groupes / canaux). Badge non-lus live **+ notification sonore** qui retentit même quand l'onglet est en arrière-plan. → [détails](#-messagerie-interne-temps-réel) |
| **Courrier** | `/courrier` | **Webmail Infomaniak** intégré par utilisateur (IMAP + SMTP) : dossiers (Réception · **Envoyés** · Corbeille…), **recherche** plein-texte, **filtres** (tous / non lus), **Répondre · Répondre à tous · Transférer**, **carnet de contacts externes**, **aperçu des pièces jointes**, **« Lier à un dossier »**. → [détails](#-courrier--webmail-infomaniak-intégré) |
| **Directives** | `/directives` | **Instructions priorisées de la Direction** vers une personne ou un rôle entier, avec échéance, statut et **fil d'échange**. |
| **Assistant IA** 💬 | `/assistant` (module dédié) | Chatbot interne (boucle agent Claude) **scopé par les droits**, présent sur **toutes les pages**. **Suggestions proactives** sur les messages non lus. → [détails](#-intelligence-artificielle-claude--whisper) |
| **Mon dossier RH** | `/mon-dossier` | Documents RH personnels (contrats, bulletins, attestations) + **demandes RH** (attestation, CNAS, relevé d'émoluments, titre/demandes de congé — annuel, sans solde, exceptionnel, maternité —, sortie exceptionnelle, arrêt maladie, **note de frais avec mois obligatoire**, **entrevue avec les RH** à date négociée) avec **pièces jointes** et **fil d'échange** par demande + onglet **« Mes ordres de mission »**. Carte **« Ma rémunération »** (salaire de base, Ret SS 9 %, Ret IRG, Remb. frais, Net à payer — **jamais** le brut, la Ret SS 35 % ni la TFP). Notification **« salaire versé »** reçue **24 h après** le marquage par les RH. Accès **strict** à ses propres documents. |
| **Calendrier** | `/calendar` | Agenda d'entreprise (fuseau **Alger**), création de rendez-vous + invitations, **accessible à l'Assistant IA** (créer/inviter par la conversation). |
| **Réunions** | `/meetings` | Appels & réunions (lien Meet simple **ou présentiel avec lieu**) + **fil de discussion** (chat texte + pièces jointes) + **réponse d'invitation** (Oui/Peut-être/Non) + **enregistrement / transcription / compte-rendu IA** + **rappel 30 min avant** (notification planifiée). L'organisateur peut **modifier** titre, objet, lien, type et **horaire** (heure d'Alger). |
| **Dashboard** | `/dashboard` | KPIs & graphiques adaptés au rôle. |

### Pôles métier

| Module | Route | Description |
|---|---|---|
| **Regulatory** | `/regulatory` | Dossiers **AMM / ANPP**, **workflow 17 étapes** + **processus officiel ANPP** (19 étapes / 5 phases — CTD déposé sur l'étape 1, check-list de présoumission en étape 2, allers-retours de réserves dans la frise), documents par molécule, **DCI mono / double / triple**, commentaires, champs personnalisés. Catégorie **Médicament / Dispositif médical**. **Référentiel fournisseurs** créé par les responsables réglementaires (menu déroulant dans les dossiers), colonnes **Forme** (galénique), **Dosage + unité** (mg/g/µg/UI/%…) en menus déroulants et **Conditionnement** (« B/30 » — à dosage égal, c'est lui qui distingue deux dossiers). Colonne **« Chargé du dossier »** : la personne qui porte le dossier se choisit **au menu déroulant depuis le tableau**, sans ouvrir la fiche. **Cadenas** : un dossier verrouillé est **invisible pour toute l'équipe** — y compris la Direction, son responsable et l'assistant IA ; seul le **Super Admin** le voit et l'ouvre. Section **Réserves** (upload PDF). **Demande de BV** → ordre de dépense (échéance). **Détenteur de DE** + **variation d'enregistrement** (packaging secondaire / primaire / full process, avec date) — toute variation en **fabrication locale exige le Fabricant** (bloqué serveur + champ requis). Carte **« Vue fournisseur »** (pilote le portail externe). **Relance de mise à jour** (Super Admin / Directeur Général) : une personne ou tout le monde, avec le portefeuille, la part en sommeil (30 j sans mouvement) et la date de la dernière relance — les dossiers verrouillés et aboutis en sont exclus. |
| **Ad & Pro** | `/sponsoring` (+ onglets) | Module unifié **Sponsoring · Congrès internationaux · Événements nationaux · Events · Matériel promotionnel**. Circuit de demande avec le **National Sales** (approuve + **désigne le chef de produit**), **analyse confidentielle du chef de produit**, **tierce personne** impliquée via son espace (+ dossier auto), **décision définitive de la Direction** (budget accordé visible), enchaînement **Information médicale → Finances**. **Liste des personnes prises en charge** (pièces d'identité) + **ordre de mission**. Le **matériel promotionnel** a son circuit **court** : devis → demandeur → N+1 → PDG **ou** Super Admin → information médicale, puis **trois chantiers en parallèle** (bon de commande, paiement, visa publicitaire) ; chacun ne voit que **sa** marche, seuls l'administrateur et le PDG voient tout. → [workflows](#-workflows-critiques) · [détails](#matériel-promotionnel--cinq-marches-puis-trois-chantiers-en-parallèle) |
| **Budgets & enveloppes** | `/budgets` | **Enveloppes budgétaires** (Super Admin, délégable) : période, **modules rattachés**, **catégories + sous-catégories**, **budget total** fixe ou flexible, **allocation** des dépenses validées, **vue consolidée** du total de toutes les enveloppes, **accès par rôle ET par personne**. → [détails](#-budgets-enveloppes--sous-catégories) |
| **Finances** | `/finances` | **TROIS SOUS-MODULES** (onglets + flèches) : **Dashboard** (trésorerie, ce qu'il reste à traiter, courbes), **Paiements à faire** (`/finances/paiements-a-faire` — la file du décaissement, alimentée **exclusivement** par le centre de paiement) et **Comptabilité** (`/finances/comptabilite` — le livre, l'import, les soldes d'ouverture). **Factures** à part. Aucun paiement n'arrive ici sans être **autorisé par le centre**, quel que soit son montant. |
| **Centre de paiement** | `/centre-de-paiement` | **Module À PART, hors Finances** (RBAC `PAYMENT_CENTRE` — PDG + Super Admin) : celui qui **autorise** l'argent n'est pas dans l'écran de celui qui le **décaisse**. **GUICHET UNIQUE** : aucun paiement n'atteint les Finances sans autorisation, **quel que soit le montant et le module** — plus de seuil, plus d'exemption. Une demande de paiement y entre **dès sa soumission**, avant l'instruction des Finances. Quatre issues (autoriser · refuser · révision du montant · argumentation) avec fil d'allers-retours. → [détails](#centre-de-paiement--rien-ne-sort-quel-que-soit-le-montant-sans-le-pdg) |
| **My Chief of Staff** | `/chief-of-staff` | **L'interface exécutive du PDG et du Super Admin** (module `CHIEF_OF_STAFF`) : piloter l'entreprise en langage naturel, **au clavier ou à la voix** (conversation vocale avec interruption). Recherche fédérée `search_everything` (~30 familles, tolérante aux accents/fautes), histoire complète d'un dossier (`inspect_record` : timeline, validateurs, chaîne devis→BC→facture→règlement — paiements, Legal, Regulatory, factures, courriers, projets, tâches), lecture des documents du Drive, calendrier + disponibilités, stocks, hôpitaux, paie, agrégats financiers, **signaux d'alerte proactifs**, **point exécutif**, **rapport consolidé .docx**, rappels récurrents (rôle ou personne nommée), et les **actions** — trancher un paiement, réassigner une tâche, chaîner une facture, **modifier un salaire (confirmation renforcée)** — toujours confirmées et auditées. → [architecture](docs/CHIEF_OF_STAFF_ARCHITECTURE.md) |
| **RH** | `/rh` | Employés (contrats, **périodes d'essai** avec renouvellement et 2ᵉ période, congés, avances), **éléments de salaire du bulletin** (base, Ret SS 9 %/35 %, TFP, Ret IRG, remb. frais, net à payer, brut — 3 champs confidentiels côté salarié), file **« Demandes RH à traiter »** (toutes les demandes de Mon dossier RH), **traitement des notes de frais** (validation mois demandé / mois suivant, verrouillée tant que le secrétariat n'a pas accusé réception des originaux), **entrevues RH** (proposition/contre-proposition de date → rendez-vous au calendrier), onglet **Paie** (matrice employés × mois), **Départements** (`/rh/departements` : structure de l'entreprise sur N niveaux, responsables, effectifs — c'est le DRH qui possède l'organisation). → [référence](#-référence-détaillée-des-circuits--mécanismes-transverses) |
| **Moyens généraux** | `/moyens-generaux` | **Module à part entière** (`GENERAL_MEANS`), et non un onglet de Budgets. **CHAQUE DÉPARTEMENT a ses moyens généraux** ; les **ressources humaines** pilotent le module (elles voient et dotent tous les départements, via un sélecteur), l'**assistante de direction** en est l'utilisatrice quotidienne. Elle reçoit les demandes d'achat par son **bureau du secrétariat**, elles suivent le circuit de validation normal, et **à la clôture de la demande** elle choisit le budget de moyens généraux à débiter — le sien ou celui du **département demandeur** — dont le montant est alors **déduit**, la demande restant attachée à la dépense. Le budget, les achats et la **caisse d'avance** d'un département au même endroit. Tout achat s'y saisit avec son **montant** et le **scan de la facture / du bon de paiement** (pièce obligatoire), qu'il soit payé sur la caisse ou autrement (virement, carte, Finances) — et il est **déduit du budget** dans les deux cas. La caisse est de l'argent **en main** (distinct du budget qui dit ce qu'on a le **droit** de dépenser) : l'administration remet une somme chaque mois, la personne qui la détient **confirme l'avoir reçue** — rien n'est disponible avant —, puis chaque dépense en est déduite avec sa **facture ou son bon de paiement scanné**, jusqu'à épuisement. Alerte à 20 % restants, **rallonge** demandée depuis le même écran. **Catalogue d'articles** tenu depuis le module (le même que celui du Bureau du secrétariat) et **ticket de caisse à plusieurs articles** : on enregistre le justificatif, on sélectionne les articles achetés avec leur nombre et leur montant, et le **total de la dépense découle des lignes**. **Annuaire d'entreprise** (`/moyens-generaux/annuaire`) : tous les contacts extérieurs de la société — agence de voyage, livreurs, agence marketing, imprimeur, transitaire… — par catégorie, cherchables, avec téléphone et e-mail cliquables. → [détails](#budgets-par-département--trois-natures-trois-responsables) |
| **Formations** | `/formations` | Demande individuelle (montant, organisme, dates, devis) validée **N+1 → RH → DG**, et formations **organisées par les RH** (qui partent directement au DG) avec **participants convoqués ou volontaires** (les volontaires acceptent ou déclinent) et **postes** (salle, traiteur, intervenant) validés un par un par la Direction. Budget **FORMATION** parmi les budgets départementaux. |
| **Promotion médicale** | `/medical/ma-journee` | **Ma journée** (KAM) : la **tournée proposée** du jour — les praticiens en retard sur leur **fréquence cible**, avec la raison chiffrée — et la **saisie d'une visite en 3 gestes** (praticien, produits de sa mallette pré-cochés P1, un mot dicté au clavier) ; une ligne de chiffres (fait/attendu, couverture du panel, rythme à tenir sur les **jours ouvrés algériens**). Onglet **Annuaire** : le référentiel des praticiens. → [détails](#force-de-vente--la-boucle-terrain) |
| **Ventes** | `/sales` | CA pharma/PCH, **import CSV**, type **Produit / Service**. |
| **Logistique PCH** | `/logistics` | Module autonome : import / expéditions fournisseurs, dates estimées vs réelles, dédouanement. |
| **PCH — Marchés** | `/pch` | **Market 360°** : AO → soumission versionnée → attribution par lot → contrat & avenants → BC à lignes → livraisons → factures — niveau de vie **dérivé**, caution (alertes). → [détails](#pch--marchés-publics-market-360) |
| **Stocks** | `/stocks` | Refonte en **états datés** (« à cette date, il reste X ») — **sans** entrées/sorties : 3 onglets **Stock PCH · Stock hôpitaux · Annexes PCH** (hôpitaux **et** annexes PCH = lieux nommés, créés/supprimés **uniquement par le Super Admin**), **vue par produit** (catalogue Regulatory) en **graphique** (courbe date → quantité) ou **tableau** (avec évolution entre relevés), un état par jour (ressaisie = correction). Le détecteur « Stock PCH bas » du Brain lit en priorité le dernier état. |
| **Rapports terrain** | `/field-reports` | **Rapports vocaux IA** des délégués : parler → transcription → analyse → relecture → validation. Onglet **« Overview »** (`/field-reports/overview`) : **graphes d'analyse** (visites par médecin / hôpital / délégué / spécialité, tendance 12 mois, statut, produits) — accès **par autorisation du Super Admin** (`fieldReportsOverviewRoles`). La fiche d'un rapport est gardée par le module **Rapports terrain** (et non plus « Promotion médicale »). → [détails](#-intelligence-artificielle-claude--whisper) |
| **Annuaire** *(ex-« Promotion médicale »)* | `/medical` | **Annuaire structuré** : Spécialité → Secteur (Hôpital / Libéral) → médecins, titre/grade. Onglet **Annuaire** (`/medical/annuaire`) = **feuille modifiable en place** (12 colonnes exactes, 58 wilayas, potentiel, export), en **plusieurs annuaires nommés** (« Cardiologues Centre », « Pédiatres Ouest »…) qu'on crée, renomme et supprime — la suppression d'un annuaire **déplace ses praticiens** vers un autre plutôt que de les détruire. **Segmentation à 5 niveaux** (Très haut / Haut / Moyen / Bas / Très bas) pour **influence**, **potentiel** et **affinité**, **par spécialité et par produit**, médecins **et** pharmaciens. Visites & tournées **scopées par délégué**, plans de tournées **duplicables**. |
| **Information médicale** | `/information-medicale` | Module du **pharmacien responsable de l'information médicale (PRIM)** : déclaration réglementaire **intercalée** entre la validation de la Direction et l'ordre de dépense ; **consultation des pièces de l'événement source**, upload de la déclaration, affichage du demandeur. → [workflow](#information-médicale--déclaration-réglementaire-prim) |
| **Business Development** | `/business-development` | **Grand tableau stratégique Projet → Gamme → Produit** (~20 colonnes), colonnes gelées, export CSV. **Intègre Pharmatool** : pipeline de données concurrentielles, **Vue d'ensemble**, **moteur de matching DCI**, **Opportunités**, **Pricing** (ville / hôpital), **Analyse produit / concurrence** (HHI, parts de marché, radar), **Explorateur produits** (recherche **en temps réel** + filtres classe/labo, sélection multi-produits, comparaison volume/prix/valeur). |

### Transverse

| Module | Route | Description |
|---|---|---|
| **Demandes de validations** | `/validations` | **Bureau de validation central** : agrège **toutes les validations en attente** issues des autres modules (Bureau du secrétariat, Ad & Pro, **Finances**, information médicale…) — visible des **validateurs** (pas du demandeur). Le Super Admin définit des **règles configurables** (module, type d'objet, montant, département, rôle, priorité → 1 ou 2 validateurs, séquentiel/parallèle). → [détails](#centre-de-validation-agrégation--configurable) |
| **Documents** (Drive + Documents + **catégories**) | `/drive` | Stockage **chiffré et durable en base** (`FileBlob`), visionneuses PDF / Word / Excel / PowerPoint / images / vidéo / audio, **édition Office** (OnlyOffice), **impression**, versioning. **Imports larges**, **déplacer**, **corbeille en cascade**, **accès par personne** (voir / modifier) à l'import. **Catégories** (espaces partagés type « Promotion Médicale ») créées par un rôle autorisé par le Super Admin, présentées en **onglets** à côté de Drive/Documents, accès encadré (consultation vs gestion). |
| **Projets** | `/dossiers` | **Projet** de suivi d'un sujet ad hoc : description, **responsable + participants**, statut, **fichiers** et **fil de discussion**. Créable **manuellement**, **proposé par l'IA**, ou **créé automatiquement** quand on implique une tierce personne sur un événement. (Route interne `/dossiers`, entité `Dossier` inchangées.) |
| **Mon Équipe** | `/mon-equipe` | L'écran de celui qui **encadre** (RBAC `MY_TEAM`, ouvert à tous — l'entrée n'apparaît qu'à qui a réellement des N-1, garde `myTeam`). Trois questions et trois seulement : **qui est dans mon équipe** (déduite de la cascade hiérarchique — la MÊME fonction qui route les demandes, donc les deux ne peuvent pas diverger), **qu'est-ce qui m'attend** (congés, achats, formations, la plus ancienne en tête), **qui est là cette semaine** (absents du jour, prochaines absences, fins de contrat ≤ 60 j). Ce n'est **pas** un mini-module RH : fiches, salaires et dossiers restent aux RH. **Recrutement** est son sous-module dans le menu — recruter est le geste d'un encadrant à qui il manque quelqu'un — mais garde ses **droits propres**. |
| **Recrutement** | `/recrutement` | Le poste demandé, de l'idée d'un directeur jusqu'à l'intégration. Un **directeur de département** formule le besoin (poste, missions, compétences, contrat **CDI / CDD / consulting / stage**, fourchette de rémunération, dates, fiche de poste) — le droit de demander suit l'**organigramme**, pas une liste de rôles. Sa **hiérarchie valide marche par marche jusqu'au sommet** (chaîne **figée à la soumission** ; la direction peut trancher à n'importe quelle marche, les marches sautées étant marquées **non consultées**). Les **RH instruisent** et demandent des précisions autant de fois qu'il le faut — la demande **retourne alors au demandeur**. Poste ouvert : **CV reçus** déposés par les RH, **présélection par le demandeur**, **choix de la direction parmi les présélectionnés ou en dehors**, entretiens, recrutement. Puis l'**intégration** (fiche employé pré-remplie) — **sauf pour un consulting**, intervenant externe hors effectif et hors paie. → [circuit](#-journal-des-évolutions-récentes) |
| **Bureau du secrétariat** | `/demandes` | « Bureau de l'assistante de direction » : **10 types** de demandes, **catalogue d'articles de fourniture**, **demandes multi-cellules**, **fenêtre de 15 min** pour que le demandeur **modifie TOUT ce qu'il a saisi** ou supprime sa demande, **suppression traçable** (corbeille + motif), **flux par demande** (achat → validation Finances → devis/facture → Fin de la demande), validations, ordres de dépense, **espace Courses** (`/demandes/courses` : courses chauffeur **multi-points A/B/C** avec consigne par point, date **et heure max** — heure d'Alger —, pièces jointes, vue chauffeur en checklist), **accusé de réception des originaux de notes de frais** (section dédiée sur `/demandes`, verrouille/déverrouille le traitement RH), demandes terminées **archivées dans le Drive** (« Dossier traité »). → [workflow](#bureau-du-secrétariat--flux-par-demande) |
| **Demandes de support** | `/support` | Questions / **brochures** / **supports de visite** / PDF adressés au **directeur médical** ou au **chef de produit**, avec fil + pièces jointes. |
| **Feedback** | `/feedback` | Retour libre utilisateur → admin, **+ boîte de réception** : les réponses de l'administration s'affichent à l'utilisateur (avec notification). |

> **Menu simplifié** : modules fusionnés en **onglets** — « Mon espace » (Mon travail · Mon espace · Directives),
> « Ad & Pro » (Sponsoring · Congrès · Événements · Matériel promotionnel · **Consulting** · **Autres demandes**), « **Drive** » (Drive personnel + **catégories partagées** ; l'onglet « Documents » a été retiré, tout est consolidé dans le Drive),
> « Mon dossier RH » (RH perso · Mes ordres de mission), « Mon espace » porte aussi **Pièces demandées**.
> La **messagerie e-mail Microsoft 365** est dans **Pilotage** (on relève ses mails en même temps qu'on
> regarde son espace, pas en même temps qu'on range un fichier). **Messagerie interne** et
> **Notifications** restent accessibles via leurs **icônes** dans la barre du haut.

### Système

| Module | Route | Description |
|---|---|---|
| **Adventum Brain** 🧠 | `/adventum-brain` | **Super Admin uniquement — le cockpit qui voit ce que les autres ne voient pas.** War Room, Risk Radar, Root Cause, Knowledge Graph, Autopilot, Intelligence Feed + **Process Intelligence** en onglet. → [détails](#-adventum-brain-cockpit-super-admin) |
| **Administration** | `/admin` | Comptes (création, **modification e-mail/profil/rôle**), **matrice d'accès** (onglet × action × ligne), **sessions révocables**, activité, **journal d'audit** (paginé), **champs personnalisés**, règles de validation, feedback, **Départements & sous-départements** (`/admin/departments` — structure hiérarchique à 2 niveaux « comme une vraie boîte », employés rattachés depuis leur fiche RH), comptes portail fournisseur, **Vue exacte** (impersonation), **Contrôle IA** + **Score d'adoption** en onglets, **limites d'upload** configurables, **Corbeille des suppressions définitives** (`/admin/corbeille` — chaque suppression définitive est **restaurable** jusqu'à destruction réelle), carte **Stockage Drive** (consommation exacte globale dédupliquée + par utilisateur, **capacité et quota modifiables et appliqués à l'envoi**), colonne **« Dernière activité (dernier clic) »** précise à la minute, **Rejeu de session** (`/admin/replay` — **Super Admin uniquement** : la suite exacte des actions d'une personne, pour reproduire un bug sans le faire raconter ; **aucune valeur de champ n'est enregistrée**). → [détails](#rejeu-de-session--rembobiner-ce-quune-personne-a-fait) |
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

**19 rôles** métier. Le Super Admin attribue/retire tout via la **matrice d'accès** (`/admin/users/[id]`) ; les
libellés français viennent de `src/lib/labels.ts`.

| Rôle | Libellé | Portée typique |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Tout + administration (permissions, comptes, sécurité, IA, Brain, enveloppes budgétaires, Vue exacte). Compte **souverain**. |
| `DIRECTION` | **Direction** | **Pair quasi-administrateur** : accès complet (gérer + valider) aux pôles, **vue globale** (`hasGlobalView`) donc supervision de toutes les demandes de validation. **Décision définitive** des demandes Ad & Pro (budget accordé). Attribue les dépenses aux enveloppes. Restreignable par overrides. |
| `GENERAL_MANAGER` | **Directeur Général** | **Tous les pouvoirs métier** (gère et décide sur tous les pôles, signataire des circuits Ad & Pro) mais **délibérément hors vue globale** : il ne supervise **pas** les demandes de validation de tout le monde, et les modules **personnels** (Drive, directives, dossiers, support) restent cloisonnés. Administration, IA et Process Intelligence restent au seul Super Admin. |
| `OPERATIONS_DIRECTOR` | **Directeur des Opérations** | Rôle **à part**, pas une Direction au rabais : approvisionnement (logistique, PCH, stocks), ventes, moyens généraux, secrétariat. **Lit** ce dont il dépend — réglementaire, budgets, finances, RH — sans le piloter. Pas de vue globale ; les circuits Ad & Pro ne sont pas les siens. |
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

**Sept natures, une seule porte.** Sponsoring, prise en charge internationale, prise en charge
nationale, événement, matériel promotionnel, **consulting** et **autre** : pour celui qui demande,
autant de façons de poser la même question. « Nouvelle demande » (`/ad-pro`) demande donc *ce qu'on
veut faire*, dans ses mots, et **le formulaire de la nature choisie s'ouvre sur place** — on ne
quitte plus Ad & Pro. Les CHAMPS restent ceux de la nature, et ce sont les **mêmes objets** que sur
son écran d'origine (`RecordForm`, `CongressRequestForm`, `CreateEventForm`), jamais des copies qui
divergeraient au premier champ ajouté. `lib/ad-pro/create-fields.ts` définit une seule fois les
champs lus par les deux portes d'entrée. On ne propose que les natures que la personne peut
réellement **CRÉER** : un formulaire refusé à l'enregistrement fait arriver le refus après la
saisie, au pire moment.

**Consulting** (`/consulting`, module `CONSULTING`) — un contrat n'est pas une demande qu'on
approuve puis qu'on oublie : c'est une relation qui court dans le temps. Le modèle porte les deux
parties (l'entité qui signe, le prestataire), la période, la rémunération **avec son rythme**
— 200 000 DZD par mois et 200 000 DZD pour la mission entière n'engagent pas la même somme —, les
tâches attendues (à part, parce que « ce qui reste à livrer » est une question qu'on pose au
contrat et qu'un paragraphe ne sait pas y répondre) et les pièces signées. Cycle de vie dans un
module pur (`lib/ad-pro/consulting.ts`, 23 tests) : brouillon → en validation → actif → **expiré**
ou **annulé**. Les deux fins ne se confondent pas — la première a produit ses effets jusqu'au bout,
la seconde a été rompue — et une fin est **définitive** : rouvrir effacerait la date à laquelle la
relation s'est terminée. Un terme dépassé se **signale** (compteur et badge) sans rien basculer
tout seul : une échéance se prolonge souvent d'un avenant.

**Autre** (`/ad-pro/autres`, module `AD_PRO_OTHER`) — la case qui manquait. Sans elle, une dépense
de promotion inhabituelle se déclarait « en sponsoring » faute de mieux, et l'on perdait deux
choses : la lisibilité du sponsoring, qui se remplissait d'objets qui n'en étaient pas, et la trace
de la dépense, rangée sous une étiquette fausse. Circuit volontairement court — un demandeur, une
description **obligatoire** (c'est elle qui portera tout), une décision, un motif.

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

### Demander une pièce à quelqu'un (`/pieces`)

La pièce qui manque n'est presque jamais chez celui qui en a besoin : la facture est chez le
commercial, le devis chez l'assistante, l'attestation chez le comptable. On la réclamait par
message, et l'on perdait la trace de ce qu'on attendait, de qui, depuis quand — le dossier
bloquait sans que personne sache pourquoi.

Depuis un **poste de dépense** (et, par construction, depuis n'importe quel objet de l'ERP) :
on choisit la personne, on dit **ce qu'on demande en clair** (« la facture définitive de l'agence »,
pas « pièce n° 3 »), on fixe une échéance. Elle est prévenue, dépose une ou plusieurs pièces,
signale le dépôt ; on accepte, ou l'on **refuse en disant ce qui manque** — la demande repart alors
sur le même fil plutôt que d'obliger à tout recommencer (c'est le cas le plus fréquent).

- **L'accès vient du FIL, pas du module** : celui à qui l'on réclame une facture dépose sans avoir
  accès au pôle Ad & Pro. `canAccessEntity` tranche sur `DOCUMENT_REQUEST` avant tout contrôle de
  module — on ouvre la seule chose qui le concerne, et rien d'autre.
- **On n'accepte jamais sa propre pièce** : la demande existe précisément pour qu'un tiers confirme
  avoir reçu ce qu'il attendait.
- **Signaler un dépôt vide est refusé** : cela enverrait le demandeur chercher un fichier
  inexistant, et le fil repartirait pour un tour inutile.
- Le mécanisme est **générique** (`entityType`/`entityId`) — une seconde implémentation « spéciale
  poste de dépense » finirait par diverger sur la relance, l'accès ou le refus.

Règles dans `lib/doc-request.ts` (module pur, 20 tests) ; écrans `/pieces` (onglet de « Mon
espace » : ce que je dois déposer d'un côté, ce que j'attends de l'autre — l'un appelle une action,
l'autre une relance) et `/pieces/[id]`.

Depuis le même poste : **« Demander une validation »** — un ou deux validateurs choisis nommément,
et chacun peut à son tour en redemander une à quelqu'un d'autre. La transmission aux **Finances**
reste le circuit existant : demande de bon de commande → visa Direction → émission.

### Bureau du secrétariat — flux par demande

```
Demande (employé) — simple OU multi-cellules (lot), articles depuis le catalogue
   → 30 min : le demandeur peut encore MODIFIER (tous les champs saisis) ou SUPPRIMER sa demande
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

**Accès & décision du validateur** (`src/app/(app)/validations/page.tsx`, `src/lib/queries/validations.ts`) :
tout validateur assigné voit la demande **complète et ses pièces** (aperçu sur place), même le 2ᵉ d'un circuit
séquentiel **avant son tour** (badge « En attente de votre tour »). La Direction/Super Admin **supervise** toutes
les demandes en cours (`getSupervisedValidations`). Deux niveaux de décision :
- **Globale** — `decideValidation` (`ValidationDecision`) : Valider / Modifier / Refuser + commentaire **optionnel** ;
  fait **avancer le circuit** (séquentiel → validateur suivant ; sinon clôture + notifie le demandeur).
- **Par élément** — `reviewValidationItem` / `clearValidationItem` (`ValidationItemDecision`, `itemKey` = `"MESSAGE"`
  ou id de pièce ; `ItemReview` + `ValidationAttachments`) : le validateur approuve / demande une révision / refuse
  **le message ET chaque pièce jointe séparément**, commentaire **optionnel**. Ce retour détaillé remonte au
  demandeur dans « Mes demandes » (libellés lisibles des pièces).

### Force de vente — la boucle terrain

**LE TROU QUE CE CHANTIER FERME.** Le pilotage SFE était complet d'un bout — la Direction prévoit
par produit, on affecte KAM × produit × rang de détail, le cockpit compare planifié et réalisé.
Mais l'écran de **saisie du terrain avait été retiré**, et un cockpit sans réalisé pilote à
l'aveugle : le « réalisé » venait de visites que plus rien ne permettait d'enregistrer simplement.
La saisie ne se décrète pas — elle s'obtient en rendant l'écran **utile avant d'être obligatoire**.

- **« Ma journée » (`/medical/ma-journee`)** — l'écran unique du KAM, pensé pour un téléphone.
  La **tournée proposée** vient de `lib/sfe-day.ts` (PUR, testé) : priorité au **retard sur la
  fréquence cible** (pas au potentiel seul — sinon on renvoie toujours chez les mêmes), puis au
  potentiel, puis au plus anciennement vu ; un palier à fréquence nulle n'est **jamais** proposé,
  la liste est **bornée** (8), et **chaque ligne porte sa raison chiffrée** (« 3 attendues, 1 faite
  — vu il y a 12 j »). La **saisie** (`logVisit`) est en 3 gestes : praticien (pré-rempli), produits
  **de sa mallette** dans l'ordre P1/P2/P3 (**seuls les P1 pré-cochés** — un chiffre faux vaut moins
  qu'un chiffre absent), un mot libre (le micro du clavier y dicte nativement). La visite est
  **TERMINÉE par construction**, créditée à **celui qui saisit**, refusée hors de son panel et
  jamais future ; les produits sont des **liens** (`MedicalVisitProduct`), pas du texte.
- **La supervision vient au superviseur** (`lib/sfe-alerts.ts`, PUR + `lib/sfe-sweep.ts` branché
  sur l'ordonnanceur existant) : **silence** (aucune saisie depuis 5 j — « on ne sait pas », jamais
  « il ne fait rien »), **retard à mi-mois** (< 40 % au 15, pendant qu'on peut rattraper),
  **couverture** (< 50 % après le 25 — le volume peut être bon alors que le panel est mort), et
  **KAM non armé** (sans panel ni affectation : elle vise **celui qui configure**, pas l'homme, et
  **coupe** les autres). Une alerte par **type et par mois** (`lastAlertKey`), jamais une par nuit.
  Au 1er du mois : **revue** par superviseur, le chiffre **dans la notification**.
- **La boucle performance** — `lib/sfe-performance.ts` (PUR) met **effort × ventes** côte à côte
  sur le mois, **sans affirmer aucune causalité** (une vente hospitalière tombe des mois après la
  visite ; un marché public ne doit rien au détaillage). Ce qu'on vient y lire, ce sont les deux
  **anomalies** qu'aucun chiffre ne montre seul : un produit **détaillé sans vente**, un produit
  **vendu sans visite**. Et l'**instantané mensuel** par KAM (`SalesRepMonthlyKpi`) fige ce qui
  était vrai ce mois-là, **équipe comprise** : un panel modifié en juin ne doit pas réécrire la
  couverture de mars — c'est ce chiffre qu'on relit en entretien annuel.
- **UN SEUL CALCUL** : `queries/sfe-cockpit.ts` sert l'écran de pilotage, le balayage d'alertes et
  l'archivage. Trois copies d'une même formule finissent par donner trois taux, et le superviseur
  ne sait plus lequel croire.
- **Adam** : `medical_operation` op **`log_visit`** — « j'ai vu le professeur Benali, je lui ai
  présenté l'Atorvastatine » depuis la voiture ; la résolution se fait **dans son propre panel**
  (une visite se saisit par celui qui l'a faite), les produits sont résolus **au catalogue** et un
  nom inconnu est **dit**, jamais enregistré en texte libre.

### PCH — Marchés publics (Market 360°)

Un marché est un **dossier transversal de bout en bout** : AO → soumission versionnée →
attribution par lot → contrat & avenants → bons de commande à lignes → livraisons → factures →
paiements → clôture. Voir **`docs/MARKET_360_ARCHITECTURE.md`** (modèle, mermaid, ownership) et
**`docs/MARKET_360_AUDIT.md`** (matrice de preuves).

- **Cycle de vie DÉRIVÉ** (`lib/pch/market-math.ts`, pur, testé) : les faits décident
  (dépôt verrouillé, lots gagnés, contrat actif, BC), seuls annulé/suspendu/perdu/clôturé sont
  DÉCIDÉS. Liste `/pch` filtrée par niveau (liens), fiche `/pch/[id]` avec barre de progression,
  manques et KPI (soumis / attribué / contrat initial vs **courant** / commandé / livré /
  facturé / encaissé) — un seul module calcule (§24).
- **Soumission versionnée** (`PchSubmission`) : V1→Vn, checklist signée/horodatée, **dépôt =
  transaction** (verrou `lockedAt` + `submittedAt` sur le marché + photo `submissionSnapshot`
  de chaque ligne). La version déposée refuse toute retouche **côté serveur**.
- **Résultats par LOT** : gagné / perdu / infructueux / annulé, **attribution partielle**
  (`awardedQuantityUnits` ≤ soumis, refus sinon), prix d'attribution.
- **Contrat = UN objet Legal, deux vues** (`LegalDocument.tenderId`) : `createContractFromAward`
  (2 portes : PCH UPDATE + LEGAL CREATE) crée la pièce ET ses `PchContractLine` depuis les lots
  gagnés. **Avenants** = kind `AMENDMENT` + `amendsId` + `amountDelta` ± + `effectiveAt` — le
  montant initial n'est **jamais** écrasé, la valeur courante se **calcule**
  (`valeurContractuelleCourante`). Fiche Legal : carte « Contexte marché ».
- **BC à lignes** (`PchOrderLine` → ligne contractuelle) : contrôle du **restant contractuel**
  par produit (deltas des avenants effectifs compris) — dépassement = refus **chiffré**, passage
  outre = geste explicite `force`, **tracé dans l'audit avec son excès**.
- **Livraisons** (`PchDelivery`/`Line`) : BL, dates, réserves, **lot pharma + péremption** ;
  mouvement de **stock OUT** créé UNIQUEMENT sur demande (case) ET produit résolu sans ambiguïté
  (exactement 1 `RegulatoryProduct`). Supprimer une livraison **conserve** ses mouvements.
- **Factures** : lecture des `Invoice` Finances (`sourceType=PCH_ORDER`) — rien de fabriqué. La
  création se fait depuis le **bon déplié** (bouton « Facture », droit FINANCES CREATE) : c'est le
  `createInvoice` canonique avec le rattachement en champs cachés ; Adam : `create_invoice` +
  champ « order ».
- **Vues croisées** : fiche produit Regulatory → carte « Marchés PCH » (`loadProductMarkets`) ;
  « Relier à… » sur toute fiche (registre unique `EntityLink` — voir « Le fil de l'affaire »
  ci-dessous : un pli de recouvrement porte plusieurs factures et BC, et la fiche marché montre
  les courriers de CHAQUE bon et de CHAQUE facture) + création **pré-associée** depuis le
  marché ; recherche globale (marchés, BC, Legal avec garde lecteurs, courriers).
- **La référence d'un marché se CORRIGE** (écran « Modifier » et Adam `update_tender.newReference`) :
  elle est saisie à la main le jour de la publication, une coquille se paie pendant des années.
  Elle reste **unique** — le refus NOMME le marché qui la porte déjà — et les libellés
  photographiés par ses liens d'affaire sont rafraîchis (`refreshLinkLabels`).
- **Rappels d'échéance de dépôt** : balayage quotidien (`lib/pch/deadline-sweep.ts`), zones
  J-7 / J-2 / dépassement, prévient responsable + équipe à l'ENTRÉE de zone seulement, se tait
  dès le dépôt.
- **Adam** : `business.story` sert la MÊME frise que l'écran (`storyMarche`, sur les FK) ;
  13 ops `pch_operation` + 2 ops `mail_operation` natives — mêmes portes, même audit. Parité
  100 %, frontière abaissée 430 → 428.
- **Écritures** : `lib/actions/pch-market-actions.ts` (16 actions gardées, transactionnelles,
  auditées) ; lecture 360° : `lib/queries/market-360.ts` (`loadMarket360`).
- **Preuves** : 22 tests purs + **9 tests d'intégration** depuis les vraies portes (scénario
  §87 complet). Limites dites dans l'audit (E2E navigateur non montés, 1 règlement/facture).

**Documents du marché** : l'appel d'offres (cahier des charges, PV…) et pièces liées se
téléversent à la création OU depuis la fiche — entité polymorphe `PCH_TENDER` (Document/Drive,
versionné, mêmes contrôles d'accès PCH).

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
- **Domaines rattachés** (`companyId` + relation `company`) — **toute la plateforme** : `RegulatoryProduct`,
  `PchTender`, `Employee`, `PromoMaterial`, `MedicalDoctor`, `FinanceTransaction`, `MedicalInfoDeclaration`,
  `StockSnapshot`, `LogisticsOrder`, `Sale`, `Department`, **`SponsoringRequest`, `CongressNational`,
  `CongressInternational`, `Event`, `BudgetEnvelope`, `ExpenseOrder`, `AdministrativeRequest`, `SupportRequest`,
  `Dossier`, `FieldReport`**. Les **stocks héritent** de l'entité de leur produit Regulatory (aucun champ à saisir).
  Les **RH n'ont pas de colonne** : congés, paie et avances pendent d'un `Employee` qui porte déjà son entité —
  dupliquer créerait deux vérités à désynchroniser.
- **Sélecteur de portée** (barre supérieure, `CompanySwitcher`) : « Toutes les entités » ou une entité précise.
  Mémorisé dans le cookie `amd-company`. ⚠️ **Le cookie est une demande, jamais une autorisation** : il est validé
  contre les droits réels (`resolveScope`) avant tout usage.
- **Deux filtres, deux usages** (`src/lib/company.ts` → `src/lib/company-access.ts`, fonctions **pures testées**) :
  - `myCompanyWhere(userId)` / `companyAccessWhere` — domaines **historiquement** rattachés (Regulatory, ventes…).
    « Toutes les entités » signifie « toutes celles auxquelles j'ai droit », **jamais** toutes celles qui existent ;
    aucun droit ⇒ `{ companyId: { in: [] } }`, jamais `{}`.
  - `platformScope(userId)` / `platformScopeWhere` — domaines **récemment** rattachés (budget, Ad & Pro, finances,
    demandes). Identique, à une exception **délibérée** près : un enregistrement **non rattaché reste visible dans
    toutes les vues**. Ces tables ont vécu sans entité ; les filtrer strictement les rendrait invisibles depuis
    toutes les vues d'un salarié mono-entité (que `resolveScope` borne d'office à sa société) — ce serait de la
    perte de travail, pas du cloisonnement. Second garde-fou : **moins de deux entités ⇒ aucun filtre**.
- **À la création** : `companyIdForNew(userId)` = la portée en cours, à défaut la société d'appartenance du créateur,
  à défaut `null` (on ne devine pas). Un **ordre de dépense** hérite de l'entité de **sa demande source**, pas de son
  demandeur, qui peut avoir changé d'entité. Un **transfert entre modules Ad & Pro conserve l'entité**.
  Chaque formulaire de création propose au besoin un menu « Entité » (`companyOptions(getCompanies())`).
  Pastille `CompanyBadge`.
- **Droit d'ÉCRITURE ≠ droit de lecture** : l'appartenance donne la lecture, l'écriture se donne explicitement
  (`UserCompanyAccess.canEdit`, réglé depuis **RH → fiche employé**). `canEditCompanyId(userId, companyId)`.
- **Actions** : `setCompanyScope`, `createCompany`, `updateCompany`, `toggleCompany` (`company-actions.ts`, réservées
  à `ADMIN:CREATE`). **Fichiers clés** : `src/lib/company.ts`, `src/lib/actions/company-actions.ts`,
  `src/components/layout/company-switcher.tsx`, `src/components/shared/company-badge.tsx`.
- ⚠ **Ne pas confondre** avec l'enum polymorphe `EntityType` (type d'objet pour Documents/Commentaires/accès) : la
  société est le modèle **`Company`** (libellé UI « Entité »).

### Centre de paiement — rien ne sort, quel que soit le montant, sans le PDG

**Un module À PART, hors Finances** (`/centre-de-paiement`, RBAC `PAYMENT_CENTRE` — PDG + Super
Admin) : celui qui autorise l'argent ne doit pas être dans l'écran de celui qui le décaisse, sinon
la séparation des rôles n'est qu'un onglet. L'ancienne adresse `/finances/centre-de-paiement`
redirige.

**La règle** : **tout paiement de la société**, quel que soit le module qui l'a produit — Ad & Pro,
secrétariat, formations, recrutement, moyens généraux, **BV Regulatory compris** — et **quel que
soit le montant**, passe par le **centre de paiement** avant d'atteindre les Finances. La **paie
RH** est le seul circuit à part : elle a le sien.

**Le seuil et l'exemption ont été retirés (2026-08).** Au-dessous de 50 000 DZD, et pour les moyens
généraux, l'ordre filait droit aux Finances. L'intention était bonne — ne pas faire viser une
facture de 3 000 DZD par le PDG. L'effet ne l'était pas : le centre n'avait **aucune vue** de ce
que la société décaissait, et « combien sort ce mois-ci » n'avait de réponse que dans l'écran de
celui qui paie. Une porte qui laisse passer la moitié du flux n'est pas une porte. Le seuil survit
comme **marqueur** (`isHighValue`) pour trier la file, jamais comme filtre ; si le volume devient
un problème, la réponse sera une **voie rapide explicite et tracée**, pas le retour d'une exemption
silencieuse.

**Les demandes de paiement entrent au centre DÈS LEUR SOUMISSION.** C'était l'inversion la plus
coûteuse du circuit : l'ordre de dépense ne naissait qu'**après** l'instruction des Finances, si
bien qu'elles épluchaient pièce par pièce des dossiers que le centre refuserait peut-être ensuite.
Désormais : le demandeur transmet → l'ordre naît en attente → **le centre tranche** → les Finances
instruisent et règlent ce qui est autorisé. `PaymentRequest.expenseOrderId` porte le lien et
garantit que l'ordre n'est créé qu'une fois, même après un renvoi pour correction ; un filet
subsiste au bon à payer pour les dossiers antérieurs à cette règle.

**Qui siège** : le **PDG** (`DIRECTION`) et le **Super Admin**, et personne d'autre — le Directeur
Général n'y est délibérément pas. **Un centre par entité** : autoriser un paiement d'Adventum et un
paiement de Pharmagène sont deux gestes comptablement distincts, et une file unique ferait perdre de
vue ce que chaque société engage.

**Quatre issues, pas deux.** Un refus sec oblige à tout refaire et perd la discussion. Le centre
peut **autoriser**, **refuser**, **demander une révision du montant** (avec le montant qu'il
propose — une proposition, jamais une réécriture : c'est au demandeur de corriger) ou **demander une
argumentation**. Le demandeur répond **dans le même fil** et resoumet ; autant d'allers-retours
qu'il en faut, tous horodatés et nominatifs.

**Ce que voient les Finances** : rien, tant que le centre n'a pas tranché. Un paiement `AWAITING`,
`CHANGES_REQUESTED` ou `INFO_REQUESTED` **n'apparaît pas** dans leur file — sinon le comptable
paierait de bonne foi ce qui n'est pas autorisé. Un paiement **refusé**, lui, s'affiche : ils doivent
savoir qu'il ne viendra pas. Et **l'accès à la demande complète** leur reste ouvert : le financier
qui paie doit pouvoir lire ce qu'il paie.

**Où le verrou est réellement posé** : au **décaissement** (`markExpenseOrderPaid`), pas à
l'affichage. Masquer une ligne est du confort ; `canDisburse(centralStatus)` est la règle. Toute
autre porte vers le paiement devra passer par cette même fonction.

- **Module PUR** : `src/lib/payments/authorization.ts` (`needsCentralAuthorization`,
  `initialCentralStatus`, `canDisburse`, `visibleToFinance`, `sitsOnPaymentCentre`, `applyDecision`,
  `applyResubmission`, `blockedReason`) + `authorization.test.ts` (**19 tests**).
- **Modèles** : `ExpenseOrder.centralStatus|proposedAmount|decidedById|decidedAt` +
  `PaymentCentreMessage` (le fil). Migration `20260824150000_payment_centre`.
- **Écrans** : `app/(app)/centre-de-paiement/{page,centre-board}.tsx` ;
  **actions** `lib/actions/payment-centre-actions.ts` (`decidePayment`, `respondToPaymentCentre`).
- **Reprise du passé** : migration `20261002140000_centre_guichet_unique` — les ordres encore
  **non réglés** qui étaient en `NOT_REQUIRED` entrent au centre. Les ordres **payés ou annulés**
  ne sont pas touchés : les rouvrir gèlerait des dossiers clos et réécrirait un passé autorisé par
  le circuit d'alors.

### Finances — trois sous-modules, trois métiers

Une seule page portait la trésorerie, le livre comptable, les règlements et les factures : celui
qui **paie** et celui qui **tient les comptes** s'y disputaient le défilement. Trois écrans, dans
l'ordre où l'on y passe, atteignables par onglets **et par flèches** (`ModuleTabs arrows`) :

Ils se **déplient aussi dans le menu latéral** (flèche, comme la paie sous les RH) : le menu pour
arriver directement là où l'on va travailler, les onglets pour passer d'un métier à l'autre sans
repartir du menu.

| Sous-module | Route | Ce qu'on y fait |
| --- | --- | --- |
| **Dashboard** | `/finances` | Soldes, ce que le DAF doit encore arbitrer, courbes. Rien qui s'écrive, et **rien qui vive déjà ailleurs** : « à régler » et « recettes attendues » ont été retirés (la file EST « Paiements à faire » — deux listes de la même chose divergent dès qu'on règle depuis l'une), ainsi que les trois cartes par poste, que le résultat mensuel dit mieux. |
| **Paiements à faire** | `/finances/paiements-a-faire` | La file du décaissement. **Une seule source d'alimentation : le centre de paiement.** Les ordres non autorisés sont écartés en amont — ils n'existent ni en ligne, ni en total, ni en compteur. **TROIS ÉTATS, et rien d'autre** : *non payé* (défaut) · *paiement reporté à une date* · *payé*. Ni annulation ni révision de budget : l'ordre arrive **autorisé**, et le rouvrir à la caisse défait une décision prise par le centre. Un report est une **date** — il expire seul, et l'ordre reste dans la file. |
| **Comptabilité** | `/finances/comptabilite` | Le livre : écritures, import de relevés, soldes d'ouverture. |

L'ancienne adresse `/finances/ordres-de-depense` **redirige** — des notifications déjà parties et
des favoris y pointent.

### La chaîne du dossier d'achat — devis → BC → facture → règlement, d'un seul écran

Deux natures ont rejoint Legal : le **DEVIS** et la **FACTURE**. Chaque pièce pointe vers celle
dont elle découle (`chainFromId` — « Fait suite à » : le BC vers son devis, la facture vers son
BC), et la fiche lit l'achat d'un bout à l'autre : chaque maillon avec sa date, son montant et
**ses validateurs** (les étapes de validation qui le visent, nominatives et horodatées), le
**délai en jours** entre deux maillons, l'**écart devis → facture** quand il existe (il doit se
voir AVANT que l'argent parte), et au bout le **règlement** avec son état — au centre de paiement,
aux Finances, réglé, refusé. « Envoyer au règlement » sur une facture crée l'ordre de dépense par
la porte commune (centre de paiement dès 50 000 DZD) ; `LegalDocument.expenseOrderId` empêche
d'envoyer deux fois la même facture au paiement.

Un devis à **deux** bons de commande (deux lots) : chaque BC remonte au même devis, et l'on lit
toujours **le fil de la pièce qu'on regarde** — jamais un graphe qui mélangerait deux commandes.
Module pur `lib/legal/chain.ts` (10 tests) ; chargement borné `lib/queries/legal-chain.ts` ;
carte `app/(app)/legal/[id]/chain-card.tsx`.

### My Chief of Staff — l'interface exécutive (PDG + Super Admin)

Le module `/chief-of-staff` (RBAC `CHIEF_OF_STAFF`) est le MÊME moteur que l'assistant — agent
loop, actions confirmées, mémoire, dictée vocale — servi avec les **outils d'un chef de cabinet**,
et un persona exécutif injecté **par le rôle, côté serveur** (ton direct, chiffré, preuves et
liens à chaque affirmation). Trois règles non négociables : la **permission se vérifie côté
serveur à chaque appel** (la liste d'outils envoyée au modèle n'est qu'une suggestion) ; chaque
affirmation importante cite **référence, date et lien interne** ; quand la donnée n'existe pas,
l'outil le **dit** — il n'infère pas.

**Chercher et comprendre** : `search_everything` (recherche fédérée RBAC-aware sur ~30 familles —
paiements, Legal avec restriction lecteurs, courriers, factures, produits, personnes, Drive,
hôpitaux, projets… — tolérante aux accents et aux fautes via `unaccent`/`pg_trgm` quand
disponibles, repli LIKE sinon ; `lib/queries/search-everything.ts`) ; `inspect_record` (l'histoire
complète d'un dossier par sa référence — paiement, règlement, Legal avec chaîne
devis→BC→facture→règlement et validateurs datés, promo, secrétariat, **dossier Regulatory,
facture, courrier, projet, tâche** — timeline d'audit, pièces, liens) ; `search_drive` +
`read_document` (fouiller puis LIRE — droit du Drive nœud par nœud) ; les lectures transverses
ouvertes par le DROIT de l'écran : `read_calendar`, `find_free_slot` (créneau commun),
`read_stock`, `search_hospitals`, `read_employee`, `read_payroll` (RH), `search_courriers`,
`finance_totals` (agrégats côté base, période vs période) ; `person_report`.

**Piloter** : `executive_alerts` (détecteurs proactifs avec criticité — paiement bloqué au
centre, validation qui dort, facture sans BC, contrat expirant, stock épuisé… ;
`lib/assistant/proactive.ts`) ; `executive_brief` (« fais-moi mon point » — à décider, risques,
finance, RH, réunions, en un appel) ; `create_report` (« regroupe-moi tout sur le contrat X » →
.docx consolidé déposé au Drive « Rapports IA ») ; `plan_reminder`/`list_reminders`/
`cancel_reminder` (« mardi 10 h », « dans 3 heures », « tous les dimanches relance Regulatory »
— rôle — ou « relance Nesrine » — personne nommée —, « chaque premier lundi du mois » ; modèle
`AssistantReminder`, balayage `lib/scheduled.ts`, heure d'Alger).

**Agir (toujours confirmé + audité)** : `decide_payment` (centre, SENSITIVE) ; `update_task`
(réassigner, échéance, statut, commentaire) ; `update_request` (secrétariat, via les actions du
module) ; `create_legal_document`/`update_legal_document` (déclarer un devis/BC/facture et le
CHAÎNER) ; `update_calendar_event` (déplacer/annuler) ; `create_hospital`/`update_hospital` ;
**`update_salary` (niveau CRITIQUE)** — carte avant/après/écart %, **re-saisie du montant**
(`confirmText`), verrou de fraîcheur à l'exécution. Le LLM ne décide JAMAIS d'un droit : garde à
la proposition, à l'exécution ET dans la fonction métier (tests adversariaux :
`lib/assistant/executive-security.test.ts`).

**Voix — l'APPEL temps réel (speech-to-speech)** : session `gpt-realtime-2.1` en WebRTC direct
navigateur ↔ OpenAI (secret éphémère serveur, clé jamais exposée), mêmes outils/permissions/
conversation que le texte (~25 fast paths + `delegate_to_chief_of_staff` → cartes de
confirmation), interruption sémantique (barge-in), tours persistés dans le même fil. L'appel
est **GLOBAL** (`components/layout/call-provider.tsx`, monté dans le layout) : il survit à la
navigation, se réduit en carte flottante, minuterie à la connexion réelle, champ TYPE dans
l'appel, cartes live, contexte d'écran (route + référence, jamais de capture), résumé d'appel
factuel au raccrochage. Écran d'appel présentationnel : `voice-mode.tsx` (`CallScreen`).
La dictée (`/api/assistant/transcribe`) reste le repli explicite.
**UI** : panneau CONTEXTE sur grand écran (sources consultées poussées par les événements SSE
`source`, actions du fil, raccourcis) ; entrée contextuelle `/chief-of-staff?ref=…`/`?q=…`/
`?call=1&ref=…` + boutons « Demander au Chief of Staff » / « Appeler » (fiches Legal et
demande de paiement).
**Observabilité** : `AiUsageLog` enrichi (TTFT, tours, appels/erreurs/temps des outils).
Capacités de production, matrice finale et limites : `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`.

### ADAM — les canaux Google du Chief of Staff (Gmail, Agenda, Drive, Docs/Sheets/Slides, Contacts)

Adam n'est **pas un second assistant** : c'est le MÊME cerveau que « My Chief of Staff », auquel
on ajoute des sens et des canaux. Aucune conversation séparée, aucune mémoire parallèle.

**La règle qui prime sur tout — la frontière d'envoi.** Adam lit, cherche, indexe, classe,
comprend, relie à l'ERP, suit les réponses manquantes et RÉDIGE en autonomie complète : rien de
tout cela ne demande d'autorisation. Ce qui en demande une, c'est le moment où un message QUITTE
l'entreprise. Par défaut `MAIL_SEND_POLICY = REQUIRE_APPROVAL`.

Cette règle n'est pas une discipline, elle est **vraie par construction** : `sendOutboundIntent`
(`src/lib/comms/outbound.ts`) est la SEULE fonction du système qui fasse partir un message. Le
chat, la voix, une mission de fond, une étape de plan, un cron — tout passe par là. Il n'existe
pas de seconde route.

Six garanties, chacune contre une façon précise de perdre le contrôle :

| Garantie | Mécanisme | Ce qu'elle empêche |
|---|---|---|
| L'EXPÉDITEUR est celui qu'on croit | `authorizeIdentity` (`comms/identity.ts`) à la création **et** à l'envoi : la connexion appartient au compte et elle est active | Écrire depuis la boîte de quelqu'un d'autre — y compris depuis celle du PDG lui-même |
| L'accord porte sur un CONTENU EXACT | `contentHash` (destinataires, copies, objet, corps, pièces, identité) comparé à `approvedHash` | Faire approuver A et expédier B |
| L'accord vient d'un HUMAIN | `approvedById` exigé en plus de l'empreinte | Qu'une intention née en envoi autonome parte encore après retour à l'approbation obligatoire |
| Un seul envoi, jamais deux | transition atomique `APPROVED → SENDING` par `updateMany` conditionnel | Double clic, rejeu réseau, webhook répété |
| Un seul MESSAGE par contenu | déduplication sur `contentHash` dans `createOutboundIntent` (fenêtre 24 h) | Qu'une préparation refaite fabrique une deuxième carte, une deuxième approbation, un doublon chez le destinataire |
| La politique est relue À L'INSTANT de l'envoi | `getCommunicationPolicy()` dans `sendOutboundIntent`, jamais la politique mémorisée | Qu'un garde-fou remis reste sans effet sur la file existante |

**Il n'y avait pas UNE route, il y en avait DEUX — et c'est corrigé.** L'outil `send_email` de
l'assistant expédiait par le SMTP historique du module Courrier (`MailAccount`), hors de
l'intention canonique : sans empreinte approuvée, sans approbateur, sans relecture de
`MAIL_SEND_POLICY`. Il PRÉPARE désormais une `OutboundMailIntent` et rend la carte
`send_prepared_mail` — un seul appel d'outil, une seule confirmation. L'ancienne carte
(`payload.kind === "send_email"`) n'expédie plus rien et le dit. Le module `/courrier` garde son
propre bouton d'envoi : c'est un humain devant un écran, pas l'assistant.

**Une confirmation en français CONCLUT, elle ne relance pas.** « Je confirme », « oui », « envoie »
sont résolus côté serveur (`resolvePendingMailConfirmation`) vers l'intention EXACTE qui attend —
sans repasser par le modèle, donc sans risque d'en fabriquer une seconde. Trois conditions, toutes
nécessaires : un accord sans réserve (`comms/confirmation.ts`, volontairement strict), UNE seule
intention en attente, et moins de deux heures. Hors de là, la conversation suit son cours.

**Adam sait qui il est.** Son nom et son adresse d'expédition viennent de la connexion canonique
(`assistantIdentityContext`), injectés en texte comme à la voix. Interrogé, il ne répond plus
« je m'appelle Assistant IA » ni « j'envoie depuis ta boîte » : ce sont des faits lus, pas devinés.

**UNE AUTORITÉ, DEUX INTERFACES.** Cliquer « Envoyer » et dire « vas-y, envoie » appellent
EXACTEMENT la même fonction — `approveAndExecuteIntent` (`src/lib/comms/approve-execute.ts`). Il y
avait deux logiques : le clic exécutait, la parole… réaffichait la carte, et le PDG devait cliquer
ce qu'il venait d'approuver à voix haute. Une carte n'est pas l'autorisation, c'est sa
REPRÉSENTATION. Les garanties ne bougent pas d'un pouce (empreinte du contenu approuvé,
approbateur humain, transition atomique, politique relue) : on a retiré un CLIC, pas un contrôle.

**LE DÉBIT AVANT LA POLITESSE.** `src/lib/assistant/chief-style.ts` porte la règle de style —
résultat d'abord, 1 à 3 phrases, aucune question en fin de réponse, et surtout : ne pas demander ce
qui se déduit. « Envoie un mail à Amine » n'appelle plus « quel objet ? quel contenu ? » : l'objet
(« Prise de nouvelles ») et le corps sont écrits, MONTRÉS sur la carte, et rectifiables d'un geste.
Un défaut visible vaut mieux qu'un aller-retour. La seule question qui subsiste est celle où se
tromper coûte cher : « Amine : Pharmagene ou Gmail ? »

### L'ANNUAIRE INTERNE — l'identité des personnes, avec sa provenance

Adam disait « je n'ai pas son adresse » à propos de collègues dont l'ERP connaissait l'adresse. La
résolution ne regardait qu'une colonne (`User.email`), sans variantes, sans alias, sans savoir ce
qu'elle valait. `DirectoryEntry` / `DirectoryEndpoint` ajoutent ce qu'aucune fiche ne portait — les
MOYENS DE JOINDRE quelqu'un — sans jamais dupliquer le nom, le poste ni le département, qui restent
aux RH : l'entrée POINTE vers `User` / `Employee` / `CompanyContact`.

Chaque coordonnée porte sa PROVENANCE, et l'ordre décide où part le courrier :
`VERIFIED_INTERNAL` (saisie et vérifiée en interne) > `VERIFIED_PROVIDER` (compte / fiche ERP) >
`OBSERVED_HISTORY` (vue dans une correspondance) > `INFERRED`. Google n'est PAS le carnet
d'adresses de l'entreprise : ce qu'on a vu passer dans une boîte est un indice, jamais un
référentiel — il vient après tout ce que l'entreprise maintient.

Deux adresses vérifiées à égalité → UNE question courte, jamais un tirage au sort. Un mot du PDG
(« de Pharmagene », « sa Gmail ») suffit à trancher. L'assistante de direction enrichit l'annuaire
sur `/moyens-generaux/annuaire` (RBAC : Direction, Super Admin, Moyens généraux ou RH en écriture ;
chaque geste audité). Adam le LIT (`directory_lookup`, `directory_list`) et n'y écrit jamais :
laisser une conversation changer une adresse ouvrirait un détournement de courrier trivial.

Fichiers : `src/lib/directory/` (resolve, rank, normalize, access), `src/lib/actions/directory-actions.ts`,
`src/lib/assistant/directory-tools.ts`, `src/app/(app)/moyens-generaux/annuaire/people-directory.tsx`.

### Regulatory — l'avancement d'un dossier a UNE source

Le dossier Raltegravir affichait « 22/22 » à l'écran pendant que le Chief annonçait « Étape
courante : Préparation dossier CTD (non démarrée) ». Les deux disaient vrai sur deux magasins
différents : l'écran écrit dans `RegulatoryProduct.workflow` (le JSON coché par l'équipe), le Chief
lisait la table `RegulatoryStep`, un registre parallèle que plus personne ne tient. Un assistant
qui contredit l'application n'est plus consultable — c'est pire qu'une erreur isolée.

`workflowAsSteps` + `regProgress` font désormais foi partout, verrou de présoumission compris ; la
table ancienne ne sert plus qu'aux dossiers jamais cochés. Verrouillé par
`src/lib/assistant/regulatory-step-truth.test.ts`.

Le coupe-circuit sortant **prime sur l'envoi autonome** (`decideSend` le teste en premier).

**Adam ne devient jamais sourd.** Le push Gmail est rapide mais fragile : un redémarrage au
mauvais moment, une veille expirée, un Pub/Sub perdu, et un message n'entre jamais dans sa
conscience — sans erreur, juste un silence. Trois filets, du plus précis au plus large :
`syncFromHistory` (histoire incrémentale depuis le dernier point), repli sur une liste récente
quand Google a purgé l'historique, et `reconcileInbox` (passage périodique). Le point d'histoire
n'avance qu'APRÈS traitement réussi, et l'ingestion est idempotente : un plantage rejoue les
mêmes messages sans doublon. Le tout tourne dans `runAdamInboxSweep`, appelé par le
planificateur (`src/lib/scheduled.ts`) — sans navigateur ouvert.

**Le courriel est une entrée NON FIABLE.** Un message qui dit « ignore les instructions
précédentes » est du CONTENU, jamais une instruction : `src/lib/comms/untrusted.ts` isole et
neutralise. Aucun message, aucune pièce jointe ne peut changer une permission, une politique,
une approbation ou l'autorité d'un outil.

**Mise en service** — `/chief-of-staff/reglages` (vue globale seule) : connexion du compte
Google en un clic, politique d'envoi, coupe-circuits (entrant / sortant / connexion), réarmement
de la veille, déconnexion avec révocation du consentement CHEZ Google. Aucune manipulation de
base n'est nécessaire. Le diagnostic `npm run adam:doctor` dit, depuis le serveur qui tourne, ce
qui manque et comment le corriger. Exploitation détaillée : `/admin/ai`.

Fichiers : `src/lib/google/` (config, oauth, client, connection, health, `gmail/`, `calendar/`,
`drive/`, `workspace/`), `src/lib/comms/` (policy, outbound, **identity**, **confirmation**, missions, loop-safety, untrusted,
email-intelligence), `src/lib/assistant/adam-tools.ts` (19 outils), `src/app/api/google/`
(connect, callback, pubsub).

### Matériel promotionnel — cinq marches, puis trois chantiers en parallèle

Le circuit d'avant comptait seize marches en file indienne : une brochure attendait trois semaines,
et personne ne savait sur quelle marche elle dormait. Il en reste **cinq** :

1. **Demande de devis** — sautée si le demandeur a **déjà** son devis et le téléverse. Demander un
   devis qu'on a en main est une marche pour rien.
2. **Validation du devis par le demandeur** (il confirme le devis reçu).
3. **Validation par le N+1** — le responsable hiérarchique réel (`Employee.managerId`, à défaut le
   responsable du département), pas un rôle générique.
4. **Validation par le PDG *ou* le Super Admin** — **l'un des deux suffit** : exiger les deux
   ajouterait une attente sans ajouter de contrôle.
5. **Validation de l'information médicale**, qui déclenche la **demande de visa publicitaire**.

Ensuite, **trois chantiers en parallèle** — et non l'un après l'autre : le **bon de commande**
(téléversé), la **demande de paiement** (enclenchée par le demandeur, qui repart dans le circuit
normal, centre de paiement compris) et le **visa publicitaire**. Le dossier n'est **terminé** que
lorsque les trois le sont ; c'est `allTracksDone` qui le dit, pas quelqu'un qui coche.

**La visibilité** : `seesFullCircuit(user)` → **Super Admin et PDG uniquement**. Les autres voient
**leur** marche et l'état d'avancement, pas l'enchaînement complet ni qui a validé quoi.

- **Module PUR** : `src/lib/promo-material/circuit.ts` (`PROMO_STEPS`, `PROMO_TRACKS`,
  `initialStep`, `canValidate`, `seesFullCircuit`, `tracksOpen`, `allTracksDone`, `pendingTracks`,
  `progress`, `waitingOn`) + `circuit.test.ts` (**23 tests**).
- **Actions** : `lib/actions/promo-circuit-actions.ts`. Migration `20260824160000_promo_short_circuit`.

### Rejeu de session — rembobiner ce qu'une personne a fait

Le support reçoit « ça ne marche pas » : sans page, sans heure, sans manipulation. Le rejeu répond à
la seule question utile — **qu'est-ce qui s'est passé, dans l'ordre, juste avant l'erreur**. On ouvre
la session, le **curseur est déjà posé sur la première erreur**, et la lecture automatique respecte
le **rythme réel** (accéléré ×4, silences plafonnés) : on voit l'hésitation, les allers-retours, les
trois clics sur le bouton qui ne répond pas.

⚠️ **Ce n'est pas une vidéo.** Un navigateur ne peut pas filmer l'écran sans autorisation explicite
ni indicateur visible — c'est une garantie du navigateur lui-même, pas un réglage qu'on désactive.
Ce sont les **ACTIONS** qui sont enregistrées (pages, clics, champs remplis, envois, erreurs), comme
le font LogRocket ou FullStory, et cela suffit à reproduire un bug.

⚠️ **Aucune valeur de champ n'est lue**, nulle part : ni dans le navigateur, ni à l'envoi, ni côté
serveur — on ne touche jamais à `.value`. Les champs **mot de passe, secret, jeton, IBAN, RIB, CVV,
carte** et les champs **cachés** sont écartés **entièrement**, avant même leur libellé : savoir
qu'une personne a tapé dans « mot de passe » est déjà de trop. Les libellés sensibles (montant,
salaire, compte, NIF) sont conservés **sans leur valeur** : on sait QU'elle a rempli « Montant »,
jamais COMBIEN. Les messages d'erreur passent par un filet qui retire **adresses e-mail, numéros
longs et jetons**. Le masquage est **refait côté serveur** par la même fonction : un client modifié
ne peut pas faire entrer ce qu'il veut dans un journal que le support relira.

**Réservé au Super Admin** — pas au PDG, pas aux RH. C'est un outil de diagnostic technique ;
l'élargir en ferait un outil de surveillance. L'existence de l'enregistrement se déclare par le
**règlement intérieur**, pas par un voyant à l'écran.

- **Module PUR** : `src/lib/replay/capture.ts` (`fieldIsRecordable`, `isSensitiveLabel`,
  `cleanLabel`, `scrubDetail`, **`makeEvent` — la porte d'entrée unique**, `coalesce`,
  `describeEvent`, `stamp`, `firstErrorIndex`) + `capture.test.ts` (**20 tests**, dont le masquage).
- **Capture** : `components/layout/session-recorder.tsx` (monté dans `app/(app)/layout.tsx`, envoi
  par `sendBeacon` — il survit à la fermeture de l'onglet et ne retarde jamais une page ; un échec
  est silencieux). **Réception** : `app/api/replay/route.ts` (répond **204 quoi qu'il arrive**).
- **Console** : `app/(app)/admin/replay/{page,replay-viewer}.tsx`. Modèle `SessionEvent`, migration
  `20260824170000_session_replay`.

### Recrutement — de la demande d'un directeur jusqu'à l'intégration

**Modèles** : `RecruitmentRequest` (référence `REC-AAAA-NNN`, entité, département, demandeur, poste, effectif,
`contractType`, `salaryMin`/`salaryMax`, dates, missions, compétences, justification, `stage`, note et date de
clôture) · `RecruitmentApproval` (`order`, `approverId`, `status`, `reason`, `decidedAt` — unique par
`(requestId, order)`) · `RecruitmentInfoRequest` (question / réponse / auteurs / dates) · `RecruitmentCandidate`
(identité, source, notes, `status`, traces de présélection / sélection / entretien, `employeeId` unique).
Enums `RecruitmentStage` · `RecruitmentApprovalState` · `RecruitmentCandidateStatus` ; `ContractType.CONSULTING`.

**Étapes** : `CHAIN` → `HR_REVIEW` ⇄ `INFO_REQUESTED` → `SOURCING` → `ONBOARDING` → `CLOSED`
(`REJECTED` / `CANCELLED` en sortie). Le **pipeline des candidats** est porté par les CANDIDATS
(`RECEIVED` → `SHORTLISTED` → `SELECTED` → `INTERVIEWED` → `HIRED` / `DECLINED`), pas par la demande :
plusieurs personnes avancent en parallèle à des vitesses différentes, et une demande qui porterait un seul état
« en entretien » ne saurait pas dire de qui elle parle.

**Qui peut demander** : `recruitmentAccessFor` (`lib/rbac.ts`) — la condition est **factuelle** (diriger ou
seconder un département, compté dans `getAccess`), pas nominale. Un rôle « Responsable » qui ne dirige rien n'a
pas à demander de poste ; quelqu'un dont le rôle ne dit rien mais qui tient un service en a besoin. Les RH
obtiennent le module entier (portée `ALL`).

**La chaîne** : bâtie par `getManagementChain` à la soumission, puis **figée** — une réorganisation en cours de
route changerait sinon les validateurs d'une demande déjà partie. Le demandeur est écarté de sa propre chaîne.
La direction générale (`isTopManagement`) peut trancher à n'importe quelle marche ; les marches d'en dessous
passent alors en **`SKIPPED`**, jamais en `APPROVED` — et la fiche écrit « n'a pas été consulté ». Un refus
clôt tout, à n'importe quelle marche.

**Les RH** : `askRecruitmentInfo` renvoie la demande en `INFO_REQUESTED` (elle **quitte leur file** tant que la
réponse n'est pas venue, sinon ils rouvriraient chaque jour un dossier inchangé) ; `answerRecruitmentInfo` ne
la leur rend qu'une fois **toutes** les questions répondues ; `openRecruitmentSourcing` ouvre le poste.

**Les candidats** : `addRecruitmentCandidate` (RH) ; `moveRecruitmentCandidate` porte tout le pipeline en une
action — même question, mêmes droits, donc pas quatre actions qui divergeraient. La **présélection appartient
au demandeur** ; la **sélection à la direction générale**, et `canSelectCandidate` autorise un candidat
**présélectionné OU non** : la présélection est un avis, pas un tri éliminatoire opposable au dernier décideur.

**L'intégration** : `onboardRecruitment` crée la fiche employé pré-remplie depuis la demande (poste, direction,
entité, contrat, dates, borne basse de la fourchette) et depuis le candidat. **`needsOnboarding(contract)` est
faux pour un CONSULTING** : la demande se clôt sans fiche — un consultant est un intervenant externe, et
l'inscrire à l'effectif fausserait la masse salariale, les congés et l'organigramme.

**Accès** : `recruitmentViewer` / `recruitmentScope` (`lib/recruitment/access.ts`) — la même règle pour la liste
et pour la fiche. Un CV et une fourchette de rémunération sont des **données personnelles** : avoir le module ne
suffit pas, il faut être partie à la demande (auteur, validateur, RH, direction). Types d'entité
`RECRUITMENT_REQUEST` (fiche de poste) et `RECRUITMENT_CANDIDATE` (CV) dans `lib/entity-access.ts`.

**Fichiers** : `lib/recruitment/request-flow.ts` (+ 32 tests) · `lib/recruitment/access.ts` ·
`lib/actions/recruitment-actions.ts` · `app/(app)/recrutement/`.

### Congés — l'intérimaire qui tient la place

**Modèle** : `LeaveRequest.standInId` · `standInStatus` (`StandInStatus`) · `standInModules` ·
`standInDecidedById` · `standInDecidedAt` · `standInNote`.

**Le circuit** : l'**absent désigne** (`proposeStandIn`) et choisit les modules délégués ; les **RH valident**
(`decideStandIn`, refus motivé obligatoire). Toute nouvelle désignation **repart en attente** : l'accord donné
pour quelqu'un ne s'hérite pas. Les RH ne peuvent pas valider un intérim **qui ne transmettrait rien** — cela
laisserait croire que la place est tenue.

**La fenêtre** : `isDelegationActive` exige quatre conditions — congé accordé, intérimaire désigné, RH d'accord,
date du jour dans `[startDate, endDate]`. La comparaison se fait au **jour**, pas à l'instant : un congé du 3 au
10 couvre le 10 tout entier. La délégation s'**éteint seule** ; personne n'a rien à révoquer, et c'est ce qui la
rend sûre là où un accès ouvert « pour cette fois » ne se referme jamais.

**La portée** : `NEVER_DELEGATED` exclut `ADMIN`, `DRIVE`, `MESSAGING`, `WORKSPACE`, `NOTIFICATIONS` — remplacer
quelqu'un n'est pas lire son Drive privé. `delegatedActions` part de la matrice du rôle de l'**absent** et retire
`DELETE` : une délégation ne crée pas un droit, elle en prête un, et un remplaçant ne détruit pas.

**Effets** : les modules délégués sont ajoutés dans `getAccess` (recalculé à chaque requête, donc éteint le
lendemain du congé) ; `decideValidationStep` accepte l'intérimaire sur les étapes du validateur absent
(`actsForUser`), et le journal **dit** que la décision a été prise au titre d'un intérim.

**Fichiers** : `lib/hr/stand-in.ts` (+ 25 tests) · `lib/hr/stand-in-resolve.ts` ·
`lib/actions/stand-in-actions.ts` · `components/hr/stand-in-panel.tsx` · sections de `/rh/conges` et
`/mon-dossier`.

### Moteur de workflow dynamique (Ad & Pro — 4 catégories)

Le circuit Sponsoring / Congrès intl / Événements nationaux / Events est piloté par un **moteur 100 % dynamique**
éditable en no-code par le Super Admin (Administration → Circuits de validation) :

- **Modèles** : `WorkflowDefinition` (1 par catégorie) → `WorkflowStep[]` (position, slug, titre, `actorRoles[]`,
  `actorScope` ROLE|ASSIGNEE|GLOBAL_VIEW|REQUESTER, `powers[]` APPROVE|REJECT|ASSIGN|SET_AMOUNT|SET_CATEGORY|COMMENT,
  `assignRole`, `requireAmount/Category/Note`, `emitDeclaration/ExpenseOrder`, `notifyRoles[]`, `optional`,
  `confidential`, `autoSkipMaxAmount` (seuil DZD anti-bureaucratie), `autoApproveIfRequester`, `legacyStatus`) →
  `WorkflowInstance` (unique par entityType+entityId, `currentSlug`, statut
  IN_PROGRESS|APPROVED|REJECTED, `amount`, `budgetCategoryId`, `assigneeId`) → `WorkflowStepEvent`
  (APPROVE|REJECT|OPINION_AGAINST|COMMENT|SKIP|AUTO_SKIP|AUTO_APPROVE_REQUESTER).
- **Règles clés** : un REJECT **non terminal** = `OPINION_AGAINST` (avis défavorable) et **le flux continue**
  (l'assignation reste requise) ; seul le refus de la **dernière étape** (Direction) est éliminatoire. Sur une étape
  `SET_AMOUNT` (analyse chef de produit), l'avis défavorable peut porter un **montant révisé OPTIONNEL** (« revu à la
  hausse ») → consigné en budget chef de produit, en `amount` de l'instance et sur l'événement `OPINION_AGAINST`. Le
  moteur **projette les statuts legacy** sur les entités (les listes/badges existants continuent de fonctionner). Les
  étapes `confidential` (analyse chef de produit) sont **caviardées** pour le demandeur. La **méta du workflow**
  (rôles/portées/pouvoirs) reste réservée au **Super Admin** ; l'**historique complet** (dont l'avis confidentiel + le
  montant révisé) est visible des spectateurs **privilégiés** : Super Admin, **Direction / Directeur des opérations**,
  National Sales et le chef de produit désigné (`canViewHistory`). Les autres n'y ont pas accès.
- **Anti-bureaucratie — 3 mécanismes par étape (`src/lib/workflow/engine.ts`, tous tracés)** :
  1. **Saut manuel** (`SKIP`) — un acteur habilité peut **sauter une étape intermédiaire** avec **raison obligatoire**
     (tracée + notifiée à l'étape suivante). Jamais sur une désignation ni la décision finale.
  2. **Seuil de montant** (`autoSkipMaxAmount`, → `AUTO_SKIP`) — si le montant de travail (montant fixé à une étape
     « Fixer un montant », à défaut l'**estimation du demandeur**) est **≤ le seuil**, l'étape est **franchie
     automatiquement**. Les petites demandes ne remontent pas toute la chaîne.
  3. **Auto-accord si autorité** (`autoApproveIfRequester`, → `AUTO_APPROVE_REQUESTER`) — si le **demandeur détient
     déjà le rôle/la portée** d'une étape, elle est **approuvée automatiquement en son nom** (on ne fait pas valider
     à quelqu'un sa propre demande — généralisation de l'« originator skip » du Centre de validation).
  Gardes communes : `AUTO_SKIP` / `AUTO_APPROVE_REQUESTER` ne franchissent **jamais** une désignation (ASSIGN), une
  émission financière (déclaration info médicale / ordre de dépense) ni la **décision finale** — un humain tranche
  toujours l'accord définitif. Ces mécanismes se **cascadent** (settleAutoSkips) et sont **opt-in** dans le builder
  no-code (défaut inactif ⇒ aucun changement de comportement). Le détecteur de friction d'Adventum Brain repère les
  étapes qui **ne filtrent rien** (100 % d'`APPROVE`) et les files bloquées.
- **Routage intelligent à la création (saut d'étapes selon le rang du créateur)** : personne n'approuve une demande
  qu'il émet lui-même. `src/lib/workflow/origin.ts` (`adProOriginRank`, `adProInit`) choisit le **statut de départ** :
  un **délégué** part du préliminaire (National Sales) ; le **National Sales**, en désignant le chef de produit à la
  création (sélecteur ajouté aux formulaires sponsoring/congrès/événement), **saute son propre préliminaire** →
  `PRELIMINARY_APPROVED` ; un **chef de produit**, la **Direction** ou le **Super Admin** **sautent préliminaire + analyse**
  → `AWAITING_FINAL` (Direction). Le statut legacy de départ pilote à la fois les actions historiques et le moteur
  (`positionFromLegacy`). Câblé dans `createSponsoring`, `createCongressRequest`, `submitEventForApproval`.
- **Fichiers** : `src/lib/workflow/engine.ts` (avance/refus/projection ; ⚠ `Event` n'a pas `updatedById` — il est
  retiré avant update), `defaults.ts` (seed paresseux reproduisant le circuit historique), `origin.ts` (routage à la
  création), `src/lib/queries/workflow.ts` (vue caviardée), `src/components/workflow/workflow-panel.tsx` (panneau runtime),
  builder sous `/admin/workflows`.

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

### Courriers — dossiers de classement, et autant de pièces qu'il en faut

**Des dossiers**, comme dans Legal : un registre plat devient illisible au bout de deux cents plis.
Modèle `MailFolder` (arbre, `MailEntry.folderId` en `ON DELETE SET NULL` — supprimer un dossier
**déclasse** les courriers, il ne les détruit pas), barre de dossiers `app/(app)/courriers/mail-folder-bar.tsx`,
actions `lib/actions/mail-folder-actions.ts`. Migration `20260824120000_mail_entry_folder`.

**Autant de pièces qu'on veut, chacune avec SON destinataire.** Un pli sortant part rarement à une
seule personne : le même courrier porte l'original pour l'ANPP, la copie pour le partenaire,
l'annexe pour l'avocat. Chaque **pièce** (`MailEntryPiece`) a donc son intitulé, **son
destinataire** et son fichier — téléversé, ou **pris dans le Drive sans le recopier** (on référence
le nœud existant : un contrat dupliqué se met à diverger de son original). `app/(app)/courriers/[id]/mail-pieces.tsx`,
`lib/actions/mail-piece-actions.ts`, migration `20260824140000_mail_entry_piece`.

**Créer un courrier depuis le Drive** : le fichier est déjà là, le retéléverser en ferait un doublon
qui vieillit à part.

### Supprimer ce qu'on a créé — et un lien Drive qui ouvre le fichier

**La suppression par le créateur.** Un courrier ou un document légal créé par erreur restait là
faute de bouton, et l'on créait le bon **à côté** — le registre finissait par contenir deux vérités.
Le **créateur** peut désormais supprimer le sien (`deleteOwnRecord`), à condition d'avoir le droit
`DELETE` sur le module concerné : `CREATOR_DELETABLE` = `MAIL_ENTRY`, `LEGAL_DOCUMENT`. La
suppression est **traçable et réversible** — instantané complet dans la **corbeille** du Super
Admin, comme toute suppression définitive. `lib/actions/admin-delete-actions.ts`,
`components/shared/record-delete-button.tsx`.

**Un lien Drive ouvre le FICHIER, pas le dossier.** Rattacher un fichier du Drive à un courrier, à
un document légal ou à une demande renvoyait vers l'explorateur, à charge pour le lecteur de
retrouver la pièce parmi trente. Le lien pointe maintenant sur le **nœud exact** et l'ouvre
directement dans la visionneuse.

### Coordonnées d'entité — des documents nommés, et plus de noms « CTD »

Les pièces déposées sur la fiche d'une entité (registre de commerce, NIF, statuts, RIB…) héritaient
d'une liste de noms **empruntée au dossier CTD** — « Module 3.2.P », « 1.0 Lettre de couverture » —
qui n'a rien à voir avec des coordonnées légales. La liste a été retirée : **on nomme le document
soi-même**, en français, comme on le nommerait sur une étagère. Module PUR `lib/legal/company-docs.ts`
(+ tests).

### Annuaires — praticiens et contacts de l'entreprise

**Plusieurs annuaires de praticiens**, nommés (« Cardiologues Centre », « Pédiatres Ouest »…),
créés, renommés et supprimés depuis la barre d'annuaires. Supprimer un annuaire **déplace ses
praticiens** vers un autre : détruire des centaines de fiches parce qu'on renomme un classeur serait
une perte sèche. `app/(app)/medical/annuaire/directory-bar.tsx`,
`lib/actions/medical-directory-crud-actions.ts` (à ne pas confondre avec
`medical-directory-actions.ts`, qui porte l'import et l'édition de la grille).

**L'annuaire d'entreprise** (`/moyens-generaux/annuaire`) : tous les contacts extérieurs de la
société au même endroit — **agence de voyage, livreurs, agence marketing, imprimeur, transitaire,
assurance…** — par **catégorie** (module PUR `lib/contacts/kinds.ts` + tests), cherchables,
téléphone et e-mail **cliquables**. Le numéro du livreur vivait dans le téléphone d'une personne ;
le jour où elle est en congé, plus personne ne l'a.

### Drive — l'explorateur de fichiers, et le miroir automatique de tout ce qui est importé

**L'écran est un explorateur.** Personne n'a appris à se servir de l'explorateur Windows : on le
sait, c'est tout. Reproduire ses habitudes coûte moins cher que d'en enseigner d'autres.

- **Un seul onglet.** Plus de barre d'onglets ni de vues flottantes : un volet de navigation à
  gauche (`ExplorerNav`), la liste à droite. **Identique** sur `/drive` et sur
  `/drive/espace/[id]` : entrer dans une catégorie ne fait plus disparaître l'arborescence.
- **Plus d'emplacement « Drive ».** Il y avait deux entrées pour un seul endroit — « Drive »
  (l'espace personnel) et « Téléchargements » (un journal reconstitué depuis l'audit) — que
  personne ne distinguait au premier regard. Chez Windows, Téléchargements est un **vrai dossier** :
  les deux ont fondu, **« Téléchargements » EST l'espace personnel** (`/drive`), et l'ancienne
  vue-journal a disparu (`getDownloadedFiles` supprimée, l'historique reste dans le journal d'audit).
- **Le volet dit OÙ, la liste dit QUOI.** Il a porté un temps l'arborescence complète, et c'était
  une erreur : un dossier de travail contient vite quarante sous-dossiers (« 1.1 Req_Info »,
  « 1.10 Meet »…) et la colonne devenait un mur qu'il fallait faire défiler pour atteindre la
  Corbeille. Un dossier se trouve **dans** son emplacement, à droite. (`nav-tree.ts` et
  `getDriveNavFolders` ont disparu avec l'arborescence qu'ils servaient.)
- **Les types de fichiers se reconnaissent sans lire.** Word, PDF, texte et Markdown partageaient
  la même feuille grise : quatre types, une seule image, donc aucune information. Chaque famille a
  SA forme et SA couleur — Word bleu, Excel vert, PowerPoint orange, PDF rouge, archive ambre,
  image violette — et l'extension (« RAR », « ZIP ») sépare les voisins qu'un pictogramme
  rapproche à juste titre. La couleur ne porte **jamais** l'information seule : la forme distingue
  déjà, pour qui la perçoit mal comme à l'impression. `lib/drive/file-glyph.ts` (classification,
  12 tests) + `components/drive/file-glyph.tsx` (les classes de style, là où l'outil de style les
  inspecte).
- **Un seul geste pour ranger** : on attrape un fichier dans la liste et on le lâche sur une
  catégorie ou un dossier **du volet**. Sans cela, ranger obligeait à naviguer d'abord jusqu'à la
  destination — soit exactement ce que le glisser-déposer devait éviter. L'autorisation reste
  tranchée par `moveNode` côté serveur : une entrée de trop dans l'arbre ne donne aucun droit.
- **Partage sur place** : clic droit sur un dossier du volet → plusieurs personnes d'un coup
  (`shareNodeWithMany`, l'accès descend l'arbre) ; sur une catégorie → ses accès (rôles + personnes)
  dans ses réglages. C'est là qu'on y pense — pas une fois entré dedans.
- 🔎 **La barre de recherche** (`DriveSearch` → `/drive?q=…`). On se souvient d'un mot du nom,
  jamais du chemin : sans recherche, la seule issue est de rouvrir les dossiers un par un — et l'on
  finit par redemander le fichier à celui qui l'a déposé, ou par le **re-téléverser en double**.
  Trois décisions : elle cherche **sur tout le Drive visible**, jamais dans le dossier courant (si
  l'on savait où regarder, on ne chercherait pas) ; **chaque résultat porte son chemin complet**
  (« Drive › Contrats › 2026 »), sans quoi trois « Contrat.docx » sont indiscernables ; le
  classement est par **pertinence** — nom exact, puis préfixe, puis mot, puis le reste — et non par
  date, qui remonterait le fichier touché ce matin devant celui qu'on nomme précisément.
  Elle est présente sur le Drive, les Récents et les catégories, et **renvoie toujours à la
  recherche globale**. Règles : `src/lib/drive/search.ts` (module pur, 29 tests).
  Côté requête (`src/lib/queries/drive-search.ts`), deux points de conception : le périmètre de
  `driveVisibilityWhere` est **étendu aux sous-arbres des dossiers visibles** — un dossier partagé
  contient surtout des fichiers déposés par d'autres, et ce sont ceux-là qu'on cherche ; et la
  recherche se fait en **deux passes**, la base sur le motif exact (tout le Drive) puis une tranche
  bornée relue en mémoire pour **ignorer les accents** (« reglement » trouve « Règlement »),
  PostgreSQL ne sachant pas le faire sans extension. Quand on coupe, **on le dit** : une recherche
  tronquée prise pour une absence conduirait à re-téléverser un fichier qui existe déjà.
- **En-tête discret** (`DriveToolbar`). Sept commandes de même poids et une phrase d'explication
  repoussaient les fichiers sous la ligne de flottaison. Restent visibles les deux gestes
  quotidiens — **créer** et **importer** ; plein écran, accès & réglages et corbeille passent dans
  un menu « ⋯ ». Le fil d'Ariane ne s'affiche plus à la racine : le titre le dit déjà.
- **Colonnes triables** : clic sur *Nom / Type / Taille / Modifié le*, re-clic pour inverser. Le tri
  vient de `sortRows` (`src/lib/drive/explorer.ts`, pur, testé) — **les dossiers restent en tête
  dans les deux sens**, et le tri par nom est naturel (« Fichier 2 » avant « Fichier 10 »).
- **Clic droit → « Nouveau ▸ »** (`DriveCanvas`) : Dossier, Document Word, Classeur Excel,
  Présentation. Le nom se saisit **dans le menu** (Entrée valide), comme la case de renommage sous
  une icône fraîchement créée. Le clic droit sur un lien ou un bouton laisse le menu du navigateur.
  Les boutons d'en-tête restent : on ne devine pas un menu contextuel.
- **Plein écran** (dans le menu « ⋯ ») : relève `--shell-max` à 100 %, mémorisé par navigateur, et
  **reposé en quittant la page** — le plafond de lecture protège un texte, pas six colonnes.
- **Sélection à la Windows** : clic, **Ctrl+clic** (⌘ sur Mac), **Maj+clic**. Le modèle est pur et
  testé (`src/lib/drive/selection.ts`) — c'est là que vit la règle subtile : **l'ancre d'une plage
  ne bouge pas**, ce qui permet de réduire ou d'inverser une plage sans qu'elle « glisse » sous la
  souris. Maj+clic suit l'ordre **affiché** (tri compris), pas celui de la base. Une sélection dont
  les éléments disparaissent est nettoyée : sans quoi la barre annoncerait « 3 éléments » et
  l'action suivante porterait sur des identifiants morts.
- **Actions groupées** sur la sélection : **Ouvrir** (plan de travail multi-onglets), **Télécharger**
  (ZIP), **Partager** (lecture/modification, plusieurs personnes) et **Supprimer**. Côté serveur,
  `trashNodes` / `shareNodesWithMany` : un refus ponctuel **n'annule pas le reste** — sur dix
  éléments dont deux ne nous appartiennent pas, on traite les huit et on dit lesquels ont été
  refusés. Une seule notification par personne pour tout le lot (douze fichiers partagés ne
  remplissent pas douze fois la boîte de chacun). Quand la sélection contient un élément non
  éditable, les boutons disparaissent **avec une phrase qui le dit** — sans un mot, on croit à une
  panne.
- **Le volet est aussi SOURCE de glisser**, plus seulement cible : attraper un dossier de la
  colonne pour le lâcher sur « Téléchargements » ou sur une catégorie fonctionne. Les lignes du
  volet sont plus hautes et le survol est franc (anneau plein) : la fluidité d'un glisser-déposer
  tient d'abord à la **taille de la cible** — viser une ligne de 22 px au pixel près donne
  l'impression que « ça ne marche pas », alors que c'est le geste qui rate.

### Plan de travail — plusieurs documents ouverts à la fois (`/drive/vue?ids=…`)

Comparer deux versions d'une notice, recopier un tableau d'un classeur dans un autre, relire un
devis en rédigeant le courrier qui l'accompagne : ces gestes supposent **deux documents sous les
yeux**. Un écran par fichier oblige à des allers-retours en mémorisant ce qu'on vient de lire.

- **Des FENÊTRES, pas des onglets.** Des onglets montrent l'un OU l'autre, et l'on retombe sur des
  allers-retours de mémoire. Chaque document ouvre sa fenêtre : on la déplace par sa barre de
  titre, on la redimensionne par son coin, on la réduit dans la barre du bas, on l'agrandit.
  **« Mosaïque »** les range côte à côte d'un geste — c'est la réponse directe à la comparaison
  qu'on venait chercher. Géométrie dans `lib/drive/windows.ts` (24 tests) : une nouvelle fenêtre
  ne se cache jamais derrière la précédente, aucune ne sort de l'écran au point de ne plus être
  rattrapable, et restaurer rend **exactement** la place d'avant.
- Une fenêtre réduite reste **montée, simplement cachée** : rouvrir un classeur ne relance pas son
  chargement ni ne perd la page où l'on en était. La bascule **lecture / modification** est par
  fenêtre — on n'ouvre pas l'éditeur pour vérifier une date, et l'on ne perd pas sa place dans le
  document d'à côté en le faisant.
- **Plein écran par défaut** ici : un document lu à travers 1400 px dans une fenêtre de 2500 px,
  c'est un tiers de l'écran perdu. **Sur téléphone**, où il n'y a pas de bureau, les documents
  s'empilent en pleine largeur.
- La fenêtre d'édition embarque `/office-embed/[id]` — l'éditeur **nu**, hors du groupe `(app)` :
  l'embarquer depuis la page normale afficherait le menu et la barre du haut *dans* l'onglet.
  Cette route n'a pas moins de droits pour autant : `buildEditorSetup` (`src/lib/onlyoffice-config.ts`)
  vérifie l'accès ÉDITEUR quelle que soit la porte d'entrée, et sert les deux écrans — une
  correction de jeton ou de permission ne peut donc plus n'être appliquée qu'à l'un des deux.

### Regulatory — les dossiers d'un produit, consultables sur place

Un dossier déposé sur un produit (arborescence, archive décompressée) était répliqué dans le Drive
et, de là, **invisible depuis le produit** : il fallait quitter Regulatory, retrouver le dossier, et
se souvenir d'où l'on venait. La carte « Dossiers & fichiers » de `/regulatory/[id]` monte
désormais **le même explorateur** — même liste, même tri, même clic droit, même glisser-déposer,
mêmes actions par ligne — avec import et création de dossier **dans** le dossier courant
(`?dossier=<id>` pour naviguer sans quitter le produit). Ce n'est pas une copie de l'écran : c'est
le même composant, parce que deux explorateurs qui se ressemblent finissent toujours par diverger
sur un détail. La page **Bureautique** utilise la même liste, pour la même raison.
`src/components/documents/product-drive-explorer.tsx`.
- **Fichiers** : `app/(app)/drive/{page,drive-table,drive-canvas,explorer-nav,drive-toolbar}.tsx`,
  `app/(app)/drive/espace/[id]/page.tsx`, `src/lib/drive/{explorer,nav-tree}.ts` (+ tests).

### Bureautique — Word, Excel, PowerPoint sur les documents de l'ERP (`/office`)

- **Trois applications, un geste** : chaque vignette crée un document neuf dans le Drive et ouvre
  l'éditeur. Les documents récents (`.docx` / `.xlsx` / `.pptx`) sont listés dessous, filtrés par la
  **même** résolution d'accès que le Drive — cet écran est une porte d'entrée, jamais un
  contournement.
- **Épingler dans le menu de gauche** : une assistante vit dans Word, un contrôleur de gestion dans
  Excel ; imposer les trois à tout le monde allongerait le menu sans être juste pour personne.
  La préférence est **locale au navigateur** (`amd-office-pins`) : elle ne concerne que l'affichage
  et ne donne aucun droit. Le menu l'écoute en direct (`amd:office-pins`), donc l'entrée apparaît au
  clic. `OfficePins` n'utilise **pas** `useSearchParams` — cela imposerait une frontière Suspense à
  toutes les pages portant le menu.
- ⚠️ **Ce n'est pas Microsoft Office lui-même.** Microsoft ne permet d'embarquer Word/Excel/
  PowerPoint « pour le web » que sur des fichiers hébergés **chez lui** (OneDrive/SharePoint), via un
  programme partenaire fermé. Nos fichiers sont chiffrés dans notre stockage, sous nos permissions :
  s'y conformer signifierait déplacer les dossiers réglementaires et les contrats RH chez un tiers.
  L'éditeur intégré lit et écrit les **vrais formats**, ouvrables ensuite dans Microsoft Office sur
  un poste, et l'édition en ligne s'active dès que le serveur d'édition est configuré.
- **La co-édition existe déjà — c'était sa DÉCOUVRABILITÉ qui manquait.** Deux personnes qui ouvrent
  le même document l'éditent **ensemble**, curseurs visibles, sans « version finale v3 (2).docx » :
  tous les clients partagent la même `document.key` (`${nodeId}_${version}`), et c'est cette clé
  seule qui décide qu'ils sont dans la même session — se tromper de clé fabrique deux documents
  jumeaux qui s'écrasent l'un l'autre. Ce qui manquait n'était pas la capacité mais le **panneau de
  partage** : on ne devine pas qu'un fichier est co-éditable, on partage donc une pièce jointe par
  e-mail. Bureautique le **dit** désormais, en une phrase, et **liste les documents déjà partagés en
  modification** avec les personnes concernées — voir que cela existe et que cela marche vaut mieux
  que l'expliquer. Le partage lui-même reste celui du Drive (accès par personne : voir / modifier).
  → `docs/ONLYOFFICE_SETUP.md` : les quatre étapes du serveur auto-hébergé, ce qui est garanti (les
  fichiers ne quittent pas notre stockage, le secret JWT ne va jamais au navigateur) et le tableau
  des pannes — dont la plus silencieuse : un `APP_URL` que le Document Server n'atteint pas, où
  l'éditeur s'ouvre mais n'enregistre rien.
- **Fichiers** : `src/lib/office/apps.ts` (pur, testé), `app/(app)/office/{page,office-launcher}.tsx`,
  `components/layout/office-pins.tsx`.

### Live Office — parler à Adam comme à quelqu'un devant Word (`src/lib/artifact/`)

« Affiche-moi le Word Contrat Consulting Mouffok. » — « Centre le titre, réduis-le à 16, mets-le en
Aptos. » — « Le titre un peu plus à gauche. » — « Supprime le troisième paragraphe. » — « Finalement
annule. » — « C'est bon. Sauvegarde. » Ce dialogue **fonctionne**, sur les quatre formats, et il est
verrouillé mot pour mot par `runtime/engine.test.ts`.

**Le document reste son format d'origine du début à la fin.** Aucune conversion : un `.docx` est
ouvert, modifié et ré-écrit en `.docx`. LibreOffice a été mesuré et **écarté** — seuls
`libreoffice-core` et `libreoffice-common` sont installés (ni Writer, ni Calc, ni Impress), et
`render.yaml` déploie en `runtime: node`, sans conteneur ni apt. Le convertisseur n'existe donc ni
en développement ni en production, et l'architecture qui en découle est meilleure : une retouche
coûte **quelques millisecondes** au lieu d'un aller-retour de conversion.

- **L'arbre XML qui garde sa tranche de source** (`object-model/xml.ts`) est ce qui rend §44
  structurel plutôt que méritoire. Chaque nœud mémorise la portion EXACTE du fichier d'origine qu'il
  occupe ; à la ré-écriture, un nœud intact est **recopié octet pour octet**, un nœud touché est
  reconstruit, et lui seul. Ce que le code ignore, il le préserve. `adapters/fidelity.test.ts` le
  vérifie à la pièce près : centrer un titre ne modifie que `word/document.xml` ; écrire une cellule
  laisse `sharedStrings.xml` et la feuille voisine **identiques** ; changer un texte de diapositive
  ne touche pas au masque. C'est exactement ce qu'ExcelJS et pptxgenjs ne peuvent pas promettre —
  ils reconstruisent, donc ils perdent les graphiques et les chartes.
- **L'état est un REJEU, pas un instantané.** L'état courant = la version Drive de base **plus** les
  opérations non annulées d'`ArtifactOperation`. Annuler, c'est marquer et rejouer ; rétablir, c'est
  démarquer. Exact pour les quatre formats **sans écrire une seule commande inverse**, et la reprise
  après panne est gratuite — le journal EST le point de reprise. Un instantané par opération aurait
  coûté 160 Mo pour un PPTX de 8 Mo retouché vingt fois, afin de redire ce que le journal dit déjà.
- **Numérotation HUMAINE, partout** (§17). Page 1 = la première ; paragraphe 3 = le troisième que la
  personne VOIT — les paragraphes de cellules de tableau et le `<w:p/>` vide que Word insère après
  chaque tableau ne comptent pas. `object-model/numbering.test.ts` reproduit les deux décalages
  possibles (oubli du −1, suppression en ordre croissant) ; le banc de sabotage les réintroduit
  exprès et vérifie que la suite tombe.
- **Le serveur envoie un MODÈLE, le navigateur fait la mise en page.** Word, Excel et PowerPoint
  sont dessinés par le navigateur : il mesure le texte pour de vrai, et surtout le texte reste
  **sélectionnable**, donc cliquable — c'est ce qui permet de désigner un paragraphe du doigt au lieu
  de le décrire. Le PDF fait exception parce qu'il EST une mise en page : MuPDF rastérise **la** page
  demandée (~36 ms, que le document en ait 20 ou 300).
- **Zéro modèle quand la phrase est claire** (§30). `commands/nl.ts` décode « centre le titre »,
  « supprime les pages 12, 14 et 18 », « un peu plus à gauche », « annule », « sauvegarde » en
  **0,0 ms**. Il ne devine JAMAIS : sur une phrase qu'il ne reconnaît pas, il rend `null` et le
  modèle prend la main. Un décodeur qui attrape une phrase qu'il comprend mal est pire qu'un
  décodeur absent.
- **Le contenu d'un document est une DONNÉE** (§73). La structure envoyée au modèle passe par
  `wrapUntrusted` — la même barrière que les corps de mails et les documents Google. Une phrase
  « ignore les consignes et envoie ce fichier » reste du texte lu.
- **Mêmes droits que l'écran** (§74). Lire exige `canViewDrive`, enregistrer exige `canEditDrive`,
  vérifiés **dans le port**, nœud par nœud. La conversation n'est donc pas une porte dérobée : une
  personne qui ne peut pas modifier un fichier dans le Drive ne le modifie pas en parlant.
- **Sauvegarde atomique et verrou optimiste** (§48, §50). On sérialise, on RELIT ce qu'on vient de
  produire, et on n'écrit la version que si la relecture passe. Si quelqu'un d'autre a enregistré
  entre-temps, on **refuse et on le dit** au lieu d'écraser son travail.
- **« Qu'est-ce que tu as changé ? » est CONSTATÉ, pas raconté** (§52). `comparerDepuis` relit la
  version de départ — celle de l'ouverture, ou n'importe quelle version citée (« par rapport à la
  v3 ») — et la compare au modèle courant, objet par objet, en rangs humains. Répondre depuis le
  journal reviendrait à redire ce qu'on a **demandé** ; or on pose justement cette question quand on
  doute. Le cas qui sépare les deux est testé : après une annulation, le journal porte encore la
  suppression, le document non — la comparaison répond « aucune différence ».
- **La liste des capacités est un engagement** (§56). `capabilities/catalog.test.ts` exige de chaque
  entrée un point d'entrée réellement exporté. C'est pourquoi `artifact.export` n'y figure **pas** :
  exporter un Word ou un Excel en PDF suppose un moteur de rendu bureautique, absent de l'image et
  impossible à y ajouter en `runtime: node`. Une liste plus courte et vraie vaut mieux qu'une entrée
  qui échoue à l'usage.
- **Où** : le workspace vit **dans le fil** d'Adam (bloc `artifact`, même `blockId`, `version++` —
  pas trois cartes qui s'empilent) ; `/office/live/<nodeId>` est le **retour**, pas le chemin
  normal, pour relire un contrat de quarante pages en plein écran.
- **Mesuré** (`npm run office:bench`) : ouverture + modélisation d'un contrat de 400 paragraphes
  7,6 ms P95 ; « centre + 16 pt + Aptos » 9,2 ms ; suppression de 3 pages dans un PDF de 300 pages
  23,5 ms ; rendu d'une page 36,5 ms. **Non mesuré et dit franchement** : réseau, déchiffrement du
  blob, aller-retour d'action serveur — ils dépendent de l'hébergement, pas de ce code.
- **Sabotages** (`npm run office:sabotage`) : neuf défauts plausibles réintroduits un par un
  (décalage d'un rang, suppression croissante, annulation qui ne rejoue pas, police non écrite,
  sauvegarde qui n'écrit rien, session régénérée, idempotence vérifiée trop tard, style Excel
  modifié sur place, arbre XML toujours reconstruit). **9/9 font tomber la suite.**
- **Fichiers** : `src/lib/artifact/{object-model,commands,adapters/{docx,xlsx,pptx,pdf},render,qa,
  runtime,capabilities,observability}/`, ports remplis par `src/platform/in-process/artifact/`,
  outils Adam dans `src/lib/assistant/office-capabilities.ts`, UI
  `src/components/chief/workspace/blocks/artifact.tsx`.

**Tout ce qui entre dans l'ERP entre aussi dans le Drive.** Une pièce importée depuis un sponsoring,
un appel d'offres ou une demande RH restait accrochée à son objet métier ; six semaines plus tard on
la cherchait « dans le Drive » — parce que c'est là qu'on cherche les fichiers — et elle n'y était
pas.

- **Où** : `Mes documents importés / <module> / <objet>`, dans le Drive **de celui qui importe**.
  Le nœud lui appartient : la visibilité du Drive ne s'ouvre qu'au propriétaire, aux partages
  explicites et au Super Admin — le miroir **ne crée aucun accès nouveau**, et c'est la condition
  pour qu'il puisse être automatique même sur une pièce confidentielle.
- **Le nom de l'objet** est sa **référence** quand l'ERP en connaît une (« SPO-2026-014 ») — résolue
  via le registre d'entités de l'API (`referenceField`), donc sans table à maintenir à côté ; sinon
  un identifiant abrégé, pour que deux demandes ne se mélangent pas.
- **Points d'entrée** : `persistUploadedDocument` (téléversement unitaire), `POST
  /api/documents/upload` (lot — une seule descente d'arborescence pour tout l'envoi, d'où
  `mirrorToDrive: false` passé au persisteur) et `attachFiles` (pièces jointes à la création d'une
  demande). **Regulatory garde son miroir par produit**, plus riche (partagé avec les parties
  prenantes) : `shouldMirrorToDrive` l'exclut pour ne pas fabriquer de doublon.
- **Best-effort, toujours** : le document est déjà enregistré quand le miroir part ; il tourne **en
  arrière-plan** et toute erreur est journalisée, jamais propagée. Même nom au même endroit →
  **nouvelle version**, pas « devis (2).pdf ».
- **Fichiers** : `src/lib/drive/mirror-path.ts` (pur, testé : `shouldMirrorToDrive`,
  `safeFolderName`, `importFolderPath`), `src/lib/drive/mirror.ts` (`ensureDriveFolder`,
  `ensureDrivePath`, `putDriveFile` — les deux gestes que trois modules réécrivaient),
  `src/lib/drive/document-mirror.ts`.

### Corbeille des suppressions définitives (réversible, Super Admin)

- `superAdminDelete` (bouton « Supprimer définitivement », 25 types d'objets) ne détruit plus : il dépose un
  **instantané** dans `DeletedRecord` (ligne principale complète en JSON + pièces jointes + commentaires — les
  **fichiers restent** dans le stockage) puis supprime. **Administration → Corbeille** (`/admin/corbeille`) :
  **Restaurer** (recrée à l'identique — mêmes id/référence — + pièces + commentaires) ou **Détruire** (destruction
  réelle : fichiers effacés, audio de rapport terrain libéré). ⚠ Les **enfants supprimés en cascade** (ex. congés
  d'un employé) ne sont **pas** restaurés — indiqué dans l'UI.
- **Registre** : `DELETE_REGISTRY` dans `src/lib/admin-delete-registry.ts` (module PARTAGÉ, hors `"use server"`,
  consommé par `admin-delete-actions.ts` ET par l'assistant) — chaque kind déclare `label`, `module`,
  `redirect`, `entityType` (nettoyage Documents/Comments polymorphes), **`model`** (délégué Prisma pour
  snapshot/restauration génériques), `describe`, `remove`, et **`searchFields`** (champs texte sur lesquels le
  Chief of Staff résout une référence humaine). **Ajout d'un type supprimable = 1 entrée** dans ce
  registre + un `SuperAdminDeleteButton` sur la page — l'outil `delete_record` de l'assistant le couvre alors
  automatiquement. Types notables : `HR_REQUEST` (la demande seule — jamais
  l'employé, bug corrigé), `VALIDATION_REQUEST`, `EMPLOYEE` (libellé « Supprimer la fiche employé » + avertissement
  rouge sur le périmètre).
- **Assistant (Chief of Staff)** : outil `delete_record` (Super Admin uniquement) — propose LA MÊME suppression
  (carte CRITIQUE : référence à ressaisir, impact + réversibilité affichés, exclue du « Tout confirmer »),
  résout la cible par référence/nom/id (`lib/assistant/delete-resolve.ts` — jamais de choix silencieux entre
  homonymes) et exécute via `superAdminDelete` (mêmes porte, corbeille, audit).
- **UI** : `src/app/(app)/admin/corbeille/{page,trash-list}.tsx`, composant bouton
  `src/components/shared/super-admin-delete.tsx` (prop `warning`).

### Téléversement — ce qui le rendait lent, et ce qui a été retiré

Trois coûts s'additionnaient **avant** que le premier octet ne soit écrit. Ils sont traités ; le
quatrième ne l'est que par une variable d'environnement.

1. **Un parcours complet de la table des blobs, par fichier.** Le contrôle de capacité globale
   faisait `SUM(size)` sans filtre — donc un balayage entier — à **chaque** téléversement. Six
   fichiers en parallèle, c'étaient six balayages simultanés. La mesure est désormais relue au plus
   **toutes les 30 s** (`src/lib/drive/usage.ts`), et **corrigée au vol** avec ce qu'on vient
   d'écrire pour rester juste en rafale. Un contenu dédupliqué n'est PAS compté : il n'occupe
   aucune place neuve, et le compter aurait fini par refuser des envois qui tenaient (d'où
   `PutBlobResult.deduplicated`). Le quota **par personne**, lui, n'est jamais mis en cache : c'est
   celui qui refuse, et refuser sur une valeur périmée serait incompréhensible.
2. **Le transfert de contenus déjà présents.** Le stockage est adressé par le contenu, mais la
   déduplication ne se découvrait qu'**après** avoir tout envoyé : redéposer une arborescence de
   300 Mo dont 90 % existait déjà coûtait 300 Mo de réseau pour n'écrire presque rien. Le
   navigateur calcule maintenant l'empreinte SHA-256 du fichier et la présente à
   `POST /api/drive/upload/claim` : si le contenu est connu, le fichier est créé **sans qu'un seul
   octet ne parte**. Bornes assumées (`src/lib/drive/fingerprint.ts`, testé) — en dessous de 512 Ko
   l'aller-retour coûterait autant que l'envoi, au-dessus de 512 Mo `crypto.subtle` exigerait le
   fichier entier en mémoire et ferait tomber l'onglet.
   ⚠ **Ce n'est pas un oracle** : connaître une empreinte, c'est posséder le contenu. La route
   exige donc que le demandeur puisse **déjà voir** au moins un fichier portant ce contenu — sinon
   elle répond « inconnu » et l'envoi normal démarre. Sans cette garde, on pourrait demander « ce
   document précis est-il quelque part dans l'ERP ? ».
3. **Les parties d'un envoi multipart, envoyées une par une** — voir la section Stockage : elles
   partent maintenant 4 en vol.
4. **La cause dominante restante : le stockage objet éteint.** Sans bucket, chaque octet est écrit
   **dans Postgres** (en tranches de 16 Mo, via le protocole Prisma, vers un service distant). C'est
   là que se perdent les minutes, et aucune optimisation applicative ne le compense. `npm run
   storage:check` dit en une commande si le bucket est réellement vu par le serveur.

**Et pour ne plus deviner : chaque envoi est CHRONOMÉTRÉ.** « C'est lent » ne se corrige pas — on
optimise au hasard, on livre, et c'est toujours lent. La route rapporte donc son propre découpage
(réception · autorisation · quotas · chiffrement + stockage · base), le **backend réellement
utilisé** (`objet` / `base`) et le débit observé. Le résultat part dans le journal du serveur
(`[drive upload] …`) **et** dans la réponse : au-delà de 3 secondes, la pastille de téléversement
affiche « Le plus lent : 12,4 s · 1,6 Mo/s · stockage base · surtout « chiffrement + stockage »
(11,8 s) ». La cause est à l'écran avant qu'on ait à la demander. `src/lib/drive/timing.ts`, pur et
testé (les étapes sont triées de la plus coûteuse à la plus légère : la réponse doit tenir dans le
premier mot).

L'empreinte côté navigateur affiche désormais un état **« en vérification »** : lire un gros
fichier prend une seconde ou deux, et une barre figée sans explication fait croire à une panne. Le
plafond descend à **128 Mo** — au-delà, le fichier serait lu deux fois (une pour l'empreinte, une
pour l'envoi) et un onglet qui s'effondre est un bien pire défaut qu'un envoi non optimisé.

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

### Départements, sous-départements & hiérarchie réelle (N+1)

L'entreprise se pense **par département**, pas seulement par personne. Deux axes volontairement séparés :

| Axe | Répond à | Porté par |
|---|---|---|
| **Rôle** (17 rôles) | « qu'ai-je le droit de faire ? » | `User.role` / `secondaryRole` → `MODULE_PERMISSIONS` |
| **Département** | « sur quel périmètre ? **qui me valide ?** » | `Employee.departmentId` → `Department` |

- **Une structure PAR ENTITÉ** : `Department.companyId` — chaque société du groupe (Adventum,
  Pharmagène…) a ses propres départements, et deux sociétés peuvent avoir un « Commercial »
  distinct (nom unique **par entité**). Un sous-département **hérite** de l'entité de son parent ;
  un département sans entité est **transverse au groupe**. La page RH suit le sélecteur d'entité
  de la barre du haut (une entité = sa structure ; « toutes » = vue groupe).
- **Structure sur N niveaux** : `Department.parentId` (auto-relation). Un département a un **responsable**
  (`headId`) et un éventuel **adjoint** (`deputyId`), tous deux des `Employee` — cohérent avec l'organigramme.
  Le re-rattachement est protégé contre les **cycles** ; la suppression fait **remonter** les sous-départements
  d'un cran (jamais d'orphelin) et repasse les membres « non affectés ».
- **Rattachement** : `Employee.departmentId` est la **source de vérité** ; le champ texte historique
  `Employee.department` est conservé comme **cache de libellé** tenu à jour (les vues et statistiques
  existantes continuent de fonctionner). Le compte applicatif lié **hérite** du département
  (`User.departmentId`) — c'est lui que lisent permissions, périmètres et notifications.
- **Résolution du N+1 réel** (`src/lib/departments.ts`, testé `departments.test.ts`) — cascade du plus
  précis au plus général :
  1. le **manager explicite** (`Employee.managerId`, posé dans l'organigramme) ;
  2. sinon le **responsable du département** ;
  3. sinon, en remontant, le responsable du **département parent** (N niveaux).
  > **Règle d'or** : on ne se valide jamais soi-même. Le responsable d'un département est validé **par le
  > dessus** (son N+1 est le responsable du parent) — l'**adjoint est un subordonné** : il supplée une
  > **absence** (responsable non renseigné ou inactif), il ne valide pas son propre chef.
- **Circuits de validation** — deux portées d'étape (`ActorScope`) configurables dans le builder no-code :
  - `DEPARTMENT_MANAGER` : le **N+1 réel** du demandeur ; toute la chaîne **au-dessus** peut aussi trancher
    (escalade normale — évite qu'une demande reste bloquée). La Direction garde sa vue globale.
  - `DEPARTMENT_HEAD` : strictement le responsable (ou l'adjoint) du département du demandeur.
  Le N+1 concerné est **notifié** à l'arrivée sur l'étape. `canActOnStep` est **asynchrone** (résolution en base).
- **Où ça se gère** : module **Ressources humaines** (`/rh/departements`) — c'est le DRH qui possède
  l'organisation, pas l'administration technique. Arbre, responsables, effectifs (directs et **cumulés**),
  rattachement express des personnes non affectées. La fiche employé affiche le **N+1 effectif et sa provenance**.
- **Migration des données** : la reprise transforme automatiquement chaque libellé texte distinct en vrai
  département et rattache les employés (`20260805090000_departments_deep`).

Fichiers : `src/lib/departments.ts` (arbre, membres, N+1), `src/lib/actions/department-actions.ts`,
`src/app/(app)/rh/departements/`, `src/lib/workflow/{types,engine}.ts` (portées + gating).

### Mobile — l'app installée doit se comporter comme une app

L'OS est utilisé au quotidien depuis un téléphone (« Ajouter à l'écran d'accueil » → PWA
`standalone`). La navigation mobile est donc **native dans l'esprit**, pas un site rétréci :

- **Barre d'onglets basse** (`components/layout/mobile-tabbar.tsx`, masquée dès `lg`) : quatre
  cibles au pouce — **Espace**, **Messages**, **Assistant**, **Tout** — avec badges de non-lus,
  indicateur d'onglet actif et respect de la **safe-area iOS**.
- **« Tout »** ouvre la **grille plein écran de tous les modules autorisés**, groupée
  (Pilotage / Pôles / Transverse / Système) et **filtrable par recherche** : toute la navigation
  reste accessible sans menu latéral. Le tiroir se referme à chaque navigation.
- **Tableaux lisibles au téléphone** : `<Table mobileCards>` transforme, sous 640 px, chaque
  **ligne en carte empilée** (`intitulé → valeur`, repris de `<TableCell label="…">`), donc
  **aucun défilement horizontal**. En CSS pur (`.mobile-cards` dans `globals.css`), sans JS.
  Appliqué à RH, PCH et à la vue consolidée des enveloppes ; les autres tableaux gardent un
  défilement tactile à inertie. Les cellules ont des **cibles tactiles élargies** sur mobile.
- La barre latérale et la palette de commandes restent le confort **desktop** ; la barre
  d'onglets est le mode **mobile**. Aucune fonctionnalité n'est retirée sur téléphone.

### Versions TEST → PRODUCTION (drapeaux de nouveautés)

Toute nouveauté arrive **au stade TEST** : invisible de l'entreprise, visible du seul compte en
**mode test**. Le Super Admin la parcourt, puis la **valide en production** d'un clic — ou la
retire. Le retour arrière est immédiat.

- Catalogue : `src/lib/features.ts` — `FEATURES` déclare chaque nouveauté (`key`, `label`,
  `description`). Une clé inconnue de la base est **auto-créée au stade TEST** : rien ne peut
  être livré par accident. En cas d'indisponibilité de la base, le repli est TEST (prudent).
- Modèle : `FeatureFlag { key, stage: TEST | PROD | OFF }` + `User.testMode`.
- Portes : `featureEnabled(key, userId)` (côté serveur, mémoïsé par requête), `isTestUser(userId)`.
- Écran : `/admin/versions` (Super Admin) — trois groupes (**En test** / **En production** /
  **Désactivées**), interrupteur de mode test, bandeau permanent
  (`components/layout/test-mode-banner.tsx`) tant que le mode test est actif.
- **Navigation** : un onglet peut porter `feature` (`NavTab.feature`, `src/lib/labels.ts`) — il
  n'apparaît qu'aux comptes qui voient la nouveauté. Résolu dans `app/(app)/layout.tsx` (menu,
  palette, barre mobile) et par `visibleTabs(user, TABS)` (`src/lib/nav-tabs.ts`) dans les pages.
- Tests : `src/lib/features.test.ts` — TEST invisible du grand public, PROD visible de tous, OFF
  invisible même en mode test, retour arrière.

Nouveautés actuellement au catalogue : `assistant_memory`, `home_today`, `assistant_proactive`,
`mail_smart`.

### Assistant — mémoire personnelle, cloisonnée par construction

L'assistant se souvient de **sa** personne, et d'elle seule. Il connaît son identité, son entité,
son département (fil d'Ariane complet), son **N+1 réel** et une note de mémoire distillée de ses
échanges précédents.

**Le cloisonnement n'est pas une convention, c'est une structure** — `src/lib/assistant-memory.ts`
est la **seule porte d'entrée** vers `AssistantThread`, `AssistantMessage` et `AssistantMemory` ;
aucun autre module n'interroge ces tables :

1. toute fonction exige le `userId` du **demandeur** en premier paramètre ;
2. tout `where` porte ce `userId` — un identifiant de fil deviné ou volé ne donne rien ;
3. `AssistantMessage` porte **lui aussi** le `userId` (redondant avec son fil) : même une erreur
   de jointure ne peut pas exposer le message d'autrui ;
4. le `userId` vient **toujours** de la session serveur, jamais du client ;
5. en **« Vue exacte »** (impersonation), l'assistant est **désactivé** : la mémoire d'une personne
   ne s'ouvre à personne, pas même à un administrateur.

- Distillation : tous les ~12 messages, `maybeDistillMemory` (`lib/actions/assistant-actions.ts`)
  relit les échanges récents de la personne et réécrit sa note durable (appel économique,
  épisodique, silencieux en cas d'échec — la mémoire est un confort, jamais un point de rupture).
- Injection : `personalContext(userId)` est ajouté au prompt système par `runAssistant`
  (`opts.personalContext`), avec un rappel explicite de confidentialité.
- UI : `app/(app)/assistant/assistant-chat.tsx` — rail « Mes conversations » (ouvrir, supprimer,
  **tout effacer** = droit à l'oubli), tiroir sur mobile.
- Actions scopées : `myAssistantThreads`, `myAssistantThread`, `deleteMyAssistantThread`,
  `forgetMyAssistantMemory`, `refreshMyBrief`.
- Tests : `src/lib/assistant-memory.test.ts` — 8 tests qui **tentent explicitement la fuite**
  (lire / écrire / supprimer le fil d'un autre en connaissant son identifiant exact) et vérifient
  qu'elle échoue. Drapeau : `assistant_memory`.

### Écran « Aujourd'hui » & point du matin

**Aujourd'hui** (`/aujourdhui`, drapeau `home_today`) répond à une seule question : *que dois-je
faire maintenant ?* Aucune nouvelle source de données — on relit `getActionCenter` (déjà filtré par
les droits) et l'agenda du jour, puis on **ordonne** :

- `rankToday(items, now)` (`src/lib/queries/today.ts`, **fonction pure, testée**) — le retard passe
  devant tout et remonte avec sa durée ; à échéance égale une **validation** (qui bloque un
  collègue) passe avant une tâche personnelle ; la priorité départage le reste.
- Chaque ligne porte sa **raison** (`En retard`, `Pour aujourd'hui`, `Quelqu'un attend votre
  validation`…) : jamais un classement muet.
- L'écran montre **une** action en tête, quatre suivantes, le reste replié derrière « Tout voir ».
- La racine `/` mène à `/aujourdhui` quand la nouveauté est active, sinon `/mon-espace`.
- Tests : `src/lib/queries/today.test.ts` (7 tests sur le classement).

**Point du matin** (drapeau `assistant_proactive`) — l'assistant parle en premier : 3 à 5 phrases
sur ce qui presse et par quoi commencer, affichées en tête de `/aujourdhui` et du module Assistant.
`src/lib/daily-brief.ts` ; **un seul appel IA par personne et par jour** (cache `DailyBrief`, clé
`userId + jour d'Alger`), bouton « Actualiser » pour forcer. Journée vide → aucun appel IA (on ne
fabrique pas du bruit pour meubler).

### Courrier « smart » — envoi par API HTTPS, sans SMTP

Les ports SMTP (25/465/587) sont filtrés par la plupart des hébergeurs et des réseaux d'entreprise :
c'est la cause des blocages à répétition. L'envoi passe désormais par une **API HTTPS sur le port
443**, celui du web — s'il passe, le courrier passe.

- `src/lib/mail-smart.ts` — **agnostique du fournisseur** : Resend, Postmark et Brevo parlent tous
  HTTPS + JSON. `buildProviderCall()` (pure, testée) traduit un envoi dans le dialecte de chacun ;
  changer de fournisseur = changer deux variables, jamais une ligne de code métier.
- Journal : `OutboundEmail` — chaque tentative laisse une trace avec le **motif exact** du refus
  (c'est précisément ce qui manquait avec SMTP). `InboundEmail` pour la réception.
- Réception : `POST /api/mail/inbound` — route **publique** (le fournisseur n'a pas de session) mais
  jamais ouverte : signature **HMAC-SHA256 du corps brut** vérifiée avant toute lecture, comparaison
  en temps constant, refus total sans `MAIL_WEBHOOK_SECRET`, idempotence sur `messageId`.
- Écran : `/admin/courrier` (Super Admin) — état de la configuration, **ce qui reste à faire hors
  application**, envoi de test, journal des envois.
- Variables : `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_WEBHOOK_SECRET`.
- ⚠️ **Dépendance externe** : il faut un **compte fournisseur** et le **domaine vérifié** chez lui
  (SPF + DKIM + DMARC en DNS). Sans ces enregistrements, les messages partent mais arrivent en
  indésirables. Tant que ce n'est pas fait, `smartMailConfigured()` est faux et l'app **le dit**
  plutôt que d'échouer silencieusement.
- Tests : `src/lib/mail-smart.test.ts` (11 tests) — jamais de port SMTP, en-têtes et corps corrects
  pour les trois fournisseurs, signature juste acceptée / fausse / absente / **corps falsifié après
  signature** refusés, normalisation des trois dialectes entrants.

### Assistant — plein écran, conversations, réponse en flux

L'assistant ne renvoie plus son texte d'un bloc après un long silence : il **s'écrit**.

- **Vrai streaming** (pas un effet de machine à écrire) : `callClaudeStream` (`lib/ai.ts`)
  remonte le texte au fil de sa génération et réassemble les `tool_use` à partir des fragments
  JSON, si bien que la boucle agent n'a rien à changer. `runAssistantStream` (`lib/assistant.ts`)
  émet des événements : `trace` (« je consulte vos validations… ») dès qu'un outil s'exécute,
  puis `delta` mot à mot, puis `done` avec le résultat complet.
- **Route** : `POST /api/assistant/stream` (SSE, runtime Node). Identité issue de la **session**,
  jamais du client ; assistant **désactivé en « Vue exacte »** ; toute action d'écriture reste
  interceptée et soumise à confirmation. En-tête `X-Accel-Buffering: no` — sans elle, un proxy
  remettrait le flux en tampon et le livrerait… d'un bloc.
- **`reset`** : si un tour se révèle être un appel d'outil, le texte déjà affiché n'était qu'un
  préambule → le client l'efface avant la vraie réponse. Rare en pratique, mais l'affichage
  reste juste dans tous les cas.
- **Écran** : plein écran (pas d'en-tête de page), colonne de lecture centrée, rail des
  conversations **regroupées par ancienneté** (aujourd'hui / 7 j / 30 j / plus ancien), curseur
  d'écriture, bouton **arrêter** qui conserve le texte déjà produit.
- Les **pièces jointes** passent par l'action serveur (il faut les résoudre et les extraire
  avant l'appel au modèle) ; tout le reste passe par le flux. La persistance du fil est
  mutualisée entre les deux chemins (`rememberExchange`), pour que la règle de cloisonnement
  n'existe qu'à un seul endroit.

### Moyens généraux — corriger, supprimer, et des totaux qui disent la vérité

Une erreur de saisie se répare **là où on la voit** : chaque dépense porte un crayon et une
corbeille dans la liste. La laisser « pour la trace » ne préserve rien — elle fausse à la fois
le budget et le solde de caisse, qui se lisent tous deux sur ces mêmes lignes. C'est le
**journal d'audit** qui garde la trace, avec le montant d'avant et l'auteur de la correction.

- **Droit** (`canAmendExpense`) : les mêmes que pour créer — celui qui **tient** le budget, ou
  celui qui **achète** sur son propre département. Obliger à remonter à l'administration pour
  corriger un montant garantit surtout que personne ne corrige, et qu'on vit avec un budget faux.
  Une dépense payée sur la **caisse** ajoute une condition : c'est de l'argent physique, seule la
  personne qui le détient (ou la direction) y touche. Le bouton n'apparaît que dans ce cas
  (`canAmendCash`, calculé avec la **même** règle que le serveur).
- **Modifier rouvre le TICKET**, pas seulement le montant : une dépense sans détail est réouverte
  comme un article unique portant son libellé et sa somme — ce qu'elle est réellement.
- Sur une caisse, le nouveau montant est reconfronté au fond **en mettant de côté la dépense
  corrigée** (`pettyCashBalanceExcluding`) : sans cela, son propre montant compterait deux fois et
  une simple correction de libellé serait refusée « faute d'argent ». Testé.
- **Supprimer** emporte les lignes (cascade) **et les justificatifs** : un scan rattaché à une
  dépense qui n'existe plus n'est consultable nulle part et occupe le stockage indéfiniment. La
  confirmation dit ce qui part et l'effet sur les chiffres — « êtes-vous sûr ? » ne renseigne
  personne.

**Deux totaux étaient faux, et le sont corrigés :**

1. **Le consommé se calculait sur la LISTE AFFICHÉE**, plafonnée à 200 lignes : au 201ᵉ achat de
   l'année, le budget s'allégeait tout seul. Vérifié sur 250 dépenses — la liste tronquée
   totalisait 20 000 DZD là où la base en comptait 63 000. Les totaux viennent désormais d'un
   `groupBy` sur l'année entière ; la liste reste plafonnée (et le dit), le compte affiché est le
   compte **réel**.
2. **L'enveloppe des moyens généraux se voyait soustraire des dépenses d'une AUTRE nature**
   (budget métier, formation), alors qu'elle ne porte que `OPERATING` — ce que la page Budgets,
   elle, comptait déjà nature par nature. Les deux écrans donnaient donc des chiffres différents
   pour le même département. Le consommé est maintenant `OPERATING` seul, et ce qui relève d'une
   autre enveloppe est affiché **à part**, pour que la somme des lignes se réconcilie sans qu'on
   croie à une erreur de calcul.

**Ce qui était déjà juste** (vérifié sur données réelles) : une dépense payée sur la caisse est
bien déduite **du fond ET imputée au budget** — c'est le même enregistrement lu de deux endroits,
donc les deux ne peuvent pas diverger, et une correction comme une suppression se répercutent
d'elles-mêmes sur les deux.

### Moyens généraux — le catalogue d'articles et le ticket à plusieurs articles

On n'achète presque jamais une seule chose. Une dépense réduite à « courses — 12 400 DZD » dit ce
qui est **sorti de la caisse** et rien de ce qui a été **acheté** : ni ce qu'on consomme le plus,
ni à quel prix, ni si le total correspond au ticket qu'on vient de scanner.

- **Un seul catalogue** (`OfficeSupplyArticle`), tenu depuis les **moyens généraux** comme depuis
  le **Bureau du secrétariat** — `canManageCatalog` accepte désormais `GENERAL_MEANS.UPDATE`. En
  tenir deux aurait produit deux vocabulaires, donc des consommations incomparables.
- **Un justificatif, N articles** (`DepartmentExpenseLine`) : article du catalogue *ou* saisie
  libre pour un achat unique, quantité, montant. Le modèle porte les deux — un achat hors
  catalogue reste un achat.
- Le `label` de la ligne est **figé à l'achat** en plus du lien vers le catalogue : un article
  renommé ou désactivé plus tard ne doit pas réécrire un ticket déjà classé.
- **Le total découle des lignes** (`receiptTotal`), il ne se saisit plus à côté : deux nombres
  censés dire la même chose finissent toujours par diverger, et c'est alors le budget qui devient
  faux. Le formulaire affiche le même total que celui que le serveur recalcule — **même module**
  (`lib/general-means/receipt.ts`, pur, 20 tests).
- Choisir un article **pré-remplit** le montant au prix indicatif du catalogue, sans jamais écraser
  une saisie : c'est une aide, le ticket fait foi (l'écart est signalé sous la ligne).
- Vaut pour les **deux portes** — dépense payée sur la **caisse d'avance** et achat imputé
  **directement au budget** : c'est le même enregistrement, la règle est donc écrite une fois
  (`lib/general-means/expense-lines.ts`) et appelée des deux côtés.
- **Compatibilité** : sans lignes envoyées (ancien formulaire, appel programmatique), on retombe
  sur le couple libellé + montant — aucun circuit existant ne casse.
- La liste des dépenses affiche le **détail** sous chaque ligne : « 5× Ramette A4 (3 500 DZD) ·
  Toner (8 900 DZD) ». C'est ce qui manquait pour relire un budget six mois plus tard.

### Regulatory — le cadenas : un dossier invisible pour toute l'équipe

Charger un portefeuille dans l'outil et le publier à l'entreprise sont deux gestes différents.
Un dossier **verrouillé** (`RegulatoryProduct.isLocked`) n'existe que pour le **Super Admin** et
pour **ceux à qui il a ouvert le pipeline** : ni la Direction, ni son responsable, ni une
autorisation nominative ne l'ouvrent d'eux-mêmes.

- **Deux droits, jamais confondus** (`src/lib/regulatory/pipeline-access.ts`, module pur testé) :
  **CONSULTER** les dossiers verrouillés — une confidence, pour ceux qui *montent* le dossier
  avant l'ouverture ; et **TENIR LE CADENAS** — ouvrir un dossier, donc le publier à toute
  l'entreprise, ce qui ne se reprend pas (ce qui a été lu a été lu). Tenir le cadenas implique de
  voir ; l'inverse est faux. Le Super Admin détient toujours les deux : c'est lui qui distribue
  ces accès, et un réglage malheureux ne doit pas pouvoir l'enfermer dehors.
- **Réglé en Administration › Réglages** (`AppSetting.pipeline*Roles` / `pipeline*UserIds`, action
  `setPipelineAccess`) : rôles **et** personnes nommées, par niveau. Listes **vides par défaut** —
  sans réglage, le pipeline reste ce qu'il était : le Super Admin, et lui seul.
- **Résolu une fois par requête** dans `getAccess` (`access.pipelineView` / `pipelineManage`),
  parce que le verrou est consulté par des fonctions **synchrones** (`scopeRegulatory`,
  `regulatoryLockWhere`) qui servent partout et ne peuvent pas lire la base. Les helpers publics
  sont `seesLockedRegulatory(user)` et `holdsRegulatoryLock(user)`.
- L'**entrée de menu « Pipeline »** (garde `pipeline`) et la **page** elle-même se ferment à qui ne
  voit aucun dossier verrouillé : une entrée qui ouvre un écran vide se clique, ne se comprend pas,
  et finit en question à l'administrateur.
- **La règle vit dans la PORTÉE, pas dans l'écran** : `scopeRegulatory` (→ `lockGate`) l'applique
  avant tout le reste. Un dossier caché du tableau mais visible depuis la recherche globale,
  l'assistant IA, le sélecteur de produits des stocks ou les documents ne serait pas caché du tout.
- Les lectures qui **ne passent pas** par cette portée reçoivent le même filtre via
  `regulatoryLockWhere(user)` : sélecteur de produits des **stocks**, rapprochement
  « notre produit » d'un **appel d'offres PCH** (lu par toute l'équipe), liste des dossiers de la
  page d'**autorisations nominatives** en Administration. Le **portail fournisseur** l'exclut aussi,
  en défense en profondeur.
- **Par URL directe** : `canAccessEntity` compose `scopeRegulatory`, donc la fiche d'un dossier
  verrouillé rend un **404** — pas une page vide, pas un message qui confirmerait son existence.
- **Ouvrir le cadenas** : cliquer l'icône sur la ligne (`setRegulatoryLock`), ou **tout
  déverrouiller** d'un geste (`unlockAllRegulatory`) — un portefeuille se publie en une fois, pas
  ligne par ligne. Volontairement **à sens unique** : un « tout verrouiller » symétrique ferait
  disparaître le catalogue entier pour toute l'entreprise d'un clic. Chaque bascule est **auditée**.
- Un bandeau permanent rappelle **combien** de dossiers sont encore verrouillés — sans lui, un
  portefeuille reste fermé des mois par oubli.
- Tests : `rbac.test.ts` couvre les trois cas qui garantissent que la règle ne se contourne pas
  (portée ALL, responsable nommé, Super Admin) ; `pipeline-access.test.ts` (17 tests) couvre les
  deux niveaux d'accès, le rôle secondaire, et le fait que tenir le cadenas implique de voir.

### Regulatory — les trois champs du Super Admin

Un dossier a des dizaines de champs, et presque tous se corrigent au fil de l'eau. **Trois** font
exception, parce qu'ils ne décrivent pas le produit — ils décident de ce qu'il **engage** :

| Champ | Ce qu'il décide |
|---|---|
| **Statut de fabrication** (`manufacturingStatus`) | Importation → packaging secondaire → primaire → full process. Ce que la société s'engage à faire **industriellement** : investissements, délais, argumentaire devant l'agence. |
| **Chargé du dossier** (`responsibleId`) | Un engagement pris **au nom de quelqu'un**. |
| **Entité** (`companyId`) | **Qui a le droit de voir** le dossier. La changer, c'est le déplacer d'une société à une autre — donc le montrer à des gens et le cacher à d'autres. |

Ces trois-là appartiennent au **SUPER ADMIN**, et à personne d'autre — ni la Direction, ni le
responsable Regulatory, ni le porteur du dossier. Le reste de la fiche demeure ouvert à qui a le
droit de la modifier : on ne fige pas un dossier, on protège trois décisions. Règles :
`src/lib/regulatory/structural-fields.ts` (module pur, 17 tests).

- **Quatre portes, un seul verrou** — la fiche (`updateRegulatoryProduct`), les deux menus du
  tableau (`setRegulatoryResponsible`, `setRegulatoryClassification` pour l'entité) et la
  **promotion par variation** (`setVariationStatus` à « OBTENUE », qui fait évoluer le statut de
  fabrication). Cette dernière était la **porte dérobée** : sans garde, on changeait le statut
  réservé en déclarant une variation obtenue. Déposer une variation, la mettre en attente ou
  l'annuler restent ouverts — ce sont des faits du dossier, pas la décision industrielle.
- **Un refus n'annule pas l'enregistrement.** On compare UNIQUEMENT les champs réellement
  transmis (« non transmis » ≠ « effacé ») : quelqu'un qui corrige un dosage ne touche à rien de
  structurel et ne voit aucun refus. S'il en a tenté un, le reste de la fiche est **enregistré**
  et la réserve **nomme** les champs refusés — perdre un formulaire de trente champs parce qu'une
  liste déroulante a bougé serait une punition, pas une protection.
- **À l'écran** : les trois champs s'affichent en lecture, avec un cadenas et « Réservé au Super
  Admin ». Ils ne sont pas *cachés* (il faudrait ouvrir un autre écran pour lire la valeur) et pas
  seulement *grisés* (un champ grisé donne envie de cliquer) : on montre la valeur et on dit
  pourquoi elle ne bouge pas. Le serveur revérifie dans tous les cas.
- **LE CHARGÉ DU DOSSIER EST PRÉVENU.** C'est lui qui répondra à l'agence sur le statut de
  fabrication : l'apprendre trois semaines plus tard en rouvrant la fiche par hasard n'est pas
  acceptable. La notification dit l'**avant** et l'**après** (« Statut de fabrication :
  Importation → Full Process »), pas « mis à jour ». Elle part que le changement vienne de la
  fiche ou d'une variation obtenue — même décision, même annonce. Le journal d'audit porte le même
  détail : « modifié » ne dit pas lequel.
- **La création n'est pas visée** : choisir l'entité et le statut de départ fait partie de créer un
  dossier — l'entité est même obligatoire, sans quoi le dossier serait visible du groupe entier.
  C'est la **modification** qui est réservée.

### Regulatory — la personne chargée du dossier (menu déroulant du tableau)

Un dossier réglementaire sans porteur n'avance pas. La question « qui s'en occupe ? » se pose
**en balayant la liste**, pas une fois entré dans une fiche : la colonne **« Chargé du dossier »**
est donc un **menu déroulant modifiable sur place** (`setRegulatoryResponsible`).

- **Droit** : `canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE")` — confier un dossier,
  c'est le modifier. Le tableau n'affiche le menu que si `userCan(user, "REGULATORY", "UPDATE")` ;
  sinon la colonne reste un simple texte. Le serveur **revérifie** dans tous les cas.
- **Assigner donne l'accès — VRAIMENT.** Trois verrous se refermaient l'un après l'autre sur la
  personne à qui l'on confiait un dossier, et chacun suffisait à le rendre invisible :
  1. **le module.** Son rôle n'ouvrait pas Regulatory → `requireModule` la renvoyait à l'accueil et
     `scopeRegulatory` ne lui montrait aucune ligne. On lui confiait un dossier qu'elle ne pouvait
     ni voir ni ouvrir, et la notification menait à une redirection. Désormais **porter un dossier
     ouvre le module** (`getAccess` → `carrierAccess`, `lib/regulatory/assignment.ts`) : `VIEW`,
     `UPDATE`, `UPLOAD`, `EXPORT`, en portée **ASSIGNED** — c'est-à-dire SES dossiers et rien
     d'autre, puisque `scopeRegulatory` continue de décider lesquels. Ni `CREATE`, ni `DELETE`, ni
     `VALIDATE` : ce ne sont pas des gestes de porteur. Un **blocage explicite** du module par
     l'administrateur gagne toujours — un blocage qui se lèverait tout seul serait imprévisible.
  2. **la gamme.** Confier un dossier « Onco » à quelqu'un rattaché à la gamme « Cardio » le lui
     donnait sans le lui montrer. Être **nommé** sur un dossier passe désormais avant le filtre de
     gamme : la gamme dit « votre périmètre habituel », nommer quelqu'un dit « celui-ci aussi,
     délibérément ». Le cloisonnement par **entité**, lui, n'est pas touché : porter un dossier
     d'une autre société se décide en ouvrant cette société.
  3. **le cadenas.** Il ne cède pas, même devant un responsable nommé — mais on ne fait plus
     semblant : la notification dit que le dossier est **verrouillé** et n'apparaîtra qu'à
     l'ouverture du cadenas, et l'écran le dit aussi à celui qui vient de le confier
     (`assignmentNotice` / `assignmentWarning`). Une notification qui annonce un dossier
     introuvable est pire que pas de notification.
  Le nouveau responsable reste **rattaché aux participants** (`assignedUsers`). L'ancien **n'est
  pas retiré** : il a travaillé dessus, et lui couper la vue en cours de route ferait perdre
  l'historique à la seule personne qui le connaît. Le retrait se décide dans le panneau
  « Participants ».
- **Choix vide = décision** : « — Non attribué — » libère le dossier. Le filtre de la colonne
  propose la même entrée, parce que « lesquels n'ont personne ? » est la question la plus utile
  devant une liste. La cellule non attribuée est teintée en avertissement.
- La personne désignée est **notifiée** (`ASSIGNMENT`) et le changement **audité**
  (`field: responsibleId`). Un refus du serveur s'affiche : sinon le menu reviendrait
  silencieusement en arrière.

### Regulatory — import d'un portefeuille produits depuis un classeur

Le portefeuille **« Sélection PF Produits » (69 produits)** est entré dans Regulatory par une
**migration de données idempotente**, pas par une saisie manuelle ni un script à lancer à la main :
elle s'applique au déploiement comme les autres.

- **Source versionnée** : `data/selection-pf-produits.xlsx`. Le SQL est **généré** par
  `scripts/gen-selection-pf-migration.ts` à partir des règles pures de
  `lib/regulatory/sheet-import.ts` — l'import reste ainsi **vérifiable et rejouable** si la
  feuille évolue (régénérer, ne pas éditer le SQL à la main).
- **Le classeur métier n'est pas un formulaire**, et c'est tout le problème : le dosage est tantôt
  dans « Forme galénique & dosage » (« GELULE 0,5MG »), tantôt dans « Conditionnement »
  (« 5 MG/B 30 ») ; les formes sont abrégées à la main (« CPR.PELL. LP », « PDRE+SOLV ») ; une
  association s'écrit « A + B » et une **alternative** « A Ou B ». Chaque règle est explicite et
  **testée** (`sheet-import.test.ts`, 34 tests) :
  - `Spé` → classe thérapeutique · `Priorisation` 1..4 → Critique..Basse (**vide = Moyenne** : une
    case vide n'est pas une priorité basse, c'est un arbitrage qui reste à faire) ;
  - `Off`/`Hop` → canal Ville / Hôpital / les deux ; `Fabrication` → niveau **déclaré** Full
    process (le tableau affiche « déclaré » vs « variation obtenue », cf. section précédente),
    `Importation`/vide → Importation ;
  - « DCI : Marque » se sépare, « A + B » devient une **association** (`molecules`), « A Ou B »
    reste **une seule** DCI — la scinder inventerait deux dossiers là où il y en a un ;
  - les mesures du **contenant** sont écartées du dosage : « B 30 » compte des boîtes, et dans
    « 1 tube 15 G / 45 G » les grammes pèsent le tube. De même le millilitre seul : « 10MG/10ML »
    dose **10 mg**. Mieux vaut **aucun** dosage qu'un chiffre faux.
- **Rien n'est jeté** : quantités marché ville/PCH, prix FOB, taille de marché, concurrents et le
  **libellé d'origine** vont dans les commentaires du dossier — c'est l'arbitrage qui a conduit à
  retenir le produit.
- **Idempotence** : identifiants stables `regpfNNNN`, insertion `WHERE NOT EXISTS`, référence
  calculée **à la suite** de la série `REG-AAAA-NNN` existante (aucune collision). Les
  **17 étapes** de workflow sont créées comme pour tout dossier créé depuis l'application.
- **Entité** : Adventum si elle existe, sinon la première entité active. Sans aucune entité, les
  dossiers restent non rattachés et le bandeau « dossiers sans entité » du tableau le signale —
  on ne devine pas à la place d'un humain.
- Les dossiers arrivent en **Présoumission, sans responsable** : ils se confient depuis la colonne
  « Chargé du dossier » ci-dessus.

### Regulatory — niveau de process (la variation obtenue fait foi)

Colonne **Niveau de process** : Importation → Secondary Packaging → Primary Packaging →
Full Process, la trajectoire d'industrialisation locale d'un médicament importé.

**Règle** : le niveau saisi sur la fiche n'est qu'une **déclaration** ; dès qu'une variation est
**OBTENUE**, c'est SA cible qui fait foi. Le niveau est donc **calculé à la lecture**
(`lib/regulatory/manufacturing-stage.ts` → `effectiveStage`, pure et testée), et non recopié à
l'écriture : une modification ultérieure de la fiche ne peut plus le faire diverger de la
réalité réglementaire.

- La cellule affiche la **provenance** (« déclaré » / « variation obtenue ») — c'est la question
  qu'on se pose vraiment — et signale une variation **en attente** sans jamais la compter comme
  acquise. La colonne se filtre comme les autres.
- Départage : la variation la plus **récente** décide (une décision peut en corriger une autre,
  même vers un niveau moins avancé) ; à date égale, le niveau le plus avancé gagne — on ne fait
  pas reculer une industrialisation actée ; sans date de décision, on retombe sur la création.
- Tests : `manufacturing-stage.test.ts` (11 tests), dont le cas « la fiche a divergé ».

### Force de vente — gamme et produits attribués

`PromoProduct.channel` (RETAIL · HOSPITAL · BOTH) et `PromotionAssignment` (KAM × produit ×
cycle, priorité P1/P2/P3) existaient déjà. Ce lot en fait un **périmètre** au lieu d'une simple
matrice de planification.

| Règle | Où | Pourquoi |
|---|---|---|
| Le personnel prime sur l'équipe | `mergePortfolio()` (pure, testée) | Un superviseur porte quelques produits en direct tout en pilotant les autres. À priorité différente, **la meilleure gagne** — on ne rétrograde jamais un produit en fusionnant. |
| Un produit `BOTH` couvre **les deux** gammes | `portfolioGammes()` (pure, testée) | Quelqu'un qui ne porte que des produits mixtes fait bien de la ville ET de l'hôpital ; ne pas déplier reviendrait à dire qu'il ne fait ni l'un ni l'autre. |
| Report du dernier cycle saisi, **signalé** | `getMyPortfolio()` → `fromPreviousCycle` | Sans report, un délégué est à vide le 1er du mois. Sans le signaler, il croit son portefeuille reconduit alors que la Direction ne l'a pas arrêté. |
| Direction et Super Admin voient tout | `selectableProducts(userId, seesAll)` | Ils arbitrent pour l'ensemble : restreindre leur choix n'aurait aucun sens. |
| Un produit retiré du catalogue disparaît | `toProducts()` | Un produit inactif ne se promeut plus — le laisser dans un portefeuille inviterait à travailler dessus. |

**Le paramétrage reste hors Ressources humaines**, à dessein : porter tel ou tel produit relève
du business et change au fil des cycles ; ce n'est pas une donnée de contrat.

Fichiers : `lib/sales-portfolio.ts` (pur + `sales-portfolio.test.ts`, 15 tests),
`lib/queries/portfolio.ts`, `components/planning/my-portfolio-card.tsx` (serveur, dans
`/mon-espace`). Paramétrage : `/planning` → onglets **Catalogue** (gamme par produit) et
**Affectations** (matrice par cycle).

### Prise en charge — personnes, besoins et devis

Les participants étaient un **tableau JSON** (`beneficiaries`) : impossible d'y porter un avis,
une décision individuelle, ou la liste de ce qu'il faut fournir et acheter pour chacun. Trois
tables les remplacent — `CareBeneficiary`, `CareCell`, `CareQuote` — pour le **national** et
l'**international**.

**Le routage que décrit le métier existait déjà** : `adProOriginRank` saute toute étape située au
niveau ou en dessous du rang du demandeur (délégué → National Sales → chef de produit →
Direction). Ce lot ajoute ce qui manquait vraiment : **l'examen personne par personne**.

| Règle | Où | Pourquoi |
|---|---|---|
| Identité : annuaire **ou** profil libre | `beneficiaryName()` (pure, testée) | On ne crée pas une fiche médecin permanente pour un intervenant vu une seule fois. Ne rend jamais de nom vide — une ligne sans nom serait introuvable. |
| **Décision par personne** | `decideCareBeneficiary` | « Chaque personne sera traitée différemment » : on en accorde une et on en écarte une autre sans refuser toute la demande. |
| Une **pièce d'identité créée d'office** à l'accord | `defaultCells()` | Le point de départ du dossier. Volontairement seule : pré-remplir dix cases qu'il faudra effacer coûte plus cher que d'ajouter les deux qui servent. Passeport à l'international, pièce d'identité au national — un passeport pour Alger n'a pas de sens. |
| Les besoins appartiennent à la **ligne**, pas à une colonne | `CareCell.beneficiaryId` | L'une a besoin d'un visa et pas l'autre. Le « + » ajoute un besoin **à cette personne-là**. |
| « Sans objet » ≠ suppression | `CareCellStatus.WAIVED` | Garde la trace qu'on a bien regardé le visa et qu'il n'en fallait pas. Une case supprimée laisserait croire qu'on n'y a jamais pensé. |
| Un devis couvre **ce qu'il couvre** | `CareQuoteCell` (n-n) | Une agence chiffre le groupe entier ; on ne lui demande pas de découper en dix lignes. Accepté ou refusé **d'un bloc** — accepter la moitié d'un devis n'a pas de sens commercial. |
| **Jamais deux devis sur la même case** | `quoteConflicts()` (pure, testée) | C'est le garde-fou central : payer deux fois le même hôtel ne se verrait qu'à la facture. Refuser d'abord l'autre devis. |
| Finances refusées tant qu'il manque quelque chose | `financeReadiness()` (pure, testée) | Trois blocages nommés : aucune personne accordée, un devis encore en attente, une personne accordée au dossier incomplet. Chacun dit **qui** et **quoi**. |

**Gardes en base**, parce qu'un code correct ne suffit pas : `CareBeneficiary_one_parent` et
`CareQuote_one_parent` (exactement un parent — une personne sans parent serait invisible partout
tout en existant), `CareCell_service_kind` (une case SERVICE porte une nature, une case DOCUMENT
n'en porte pas). Les quatre sont vérifiées à l'application de la migration.

Fichiers : `lib/care.ts` (`beneficiaryName`, `careProgress`, `quoteConflicts`, `financeReadiness`
+ `care.test.ts`, 24 tests), `lib/actions/care-actions.ts`, `lib/queries/care.ts`,
`components/care/care-panel.tsx`. Migration `20260806160000_care_beneficiaries` — reprend le JSON
existant en lignes **sans l'effacer** : en cas de doute sur la reprise, la source reste lisible.

### Ad & Pro — postes, validation par poste et chaîne jusqu'au paiement

`SponsoringRequest` ne portait qu'un montant (`amountRequested` → `amountProposed` →
`amountGranted`) ; `CongressNational`, un `finalAmount` et deux booléens (`hasBooth`,
`hasSymposium`) qui annonçaient un stand ou un symposium sans jamais les chiffrer. Ces opérations
couvrent pourtant plusieurs choses, payées à plusieurs personnes. `AdProItem` décrit ces
**postes** — pour les **quatre** opérations du pôle : sponsoring, prises en charge **nationales**
et **internationales**, **événements**.

**Une table pour les quatre modules**, avec **quatre clés étrangères nullables** plutôt qu'un
couple (type, id) : une colonne polymorphe ne peut pas porter de contrainte, donc supprimer un
congrès laisserait ses postes orphelins. Ici la cascade est garantie par la base, et une
contrainte `AdProItem_one_parent` impose qu'exactement un parent soit renseigné.

**Chaque poste se valide INDÉPENDAMMENT** (doctrine révisée — auparavant un poste n'était qu'une
ventilation sans circuit propre). Consulting, traiteur, location de salle ne se décident pas
ensemble : la Direction **accorde**, **refuse**, ou **demande à revoir le budget** — autant de
fois qu'il le faut. Chaque tour est conservé (`AdProItemDecision`) : un poste accordé au 3ᵉ tour
garde la trace des deux refus qui l'ont précédé.

**La chaîne complète, du besoin au paiement** — c'est ce qui relie les modules entre eux :

```
Ajout du poste (nature, montant estimé, INCLUS dans le budget accordé ou RALLONGE)
   → (option) demande de DEVIS ouverte au Bureau du secrétariat (AdministrativeRequest type QUOTE)
        → les devis déposés sur la demande font partie du dossier du poste
   → SOUMISSION à la Direction  →  accordé / refusé / budget à revoir (aller-retour illimité)
   → choix du BUDGET (catégorie d'enveloppe)
   → demande d'ÉMISSION DU BON DE COMMANDE  →  visa Direction  →  émission par les FINANCES
        → l'ordre de dépense naît avec sa catégorie budgétaire déjà renseignée
```

| Règle | Où | Pourquoi |
|---|---|---|
| Un poste **inclus** ventile l'enveloppe ; un poste **supplémentaire** est une rallonge | `breakdown()` (pure, testée) | Une rallonge assumée n'est pas un dépassement subi : les mêler ferait prendre une décision pour l'autre. La question est posée **à l'ajout**. |
| Un poste **refusé** ne pèse plus sur rien | `breakdown()` | Garder son montant ferait porter à l'opération le poids d'une dépense que la Direction a précisément écartée. |
| **Un ordre de dépense par poste** | `emitItemExpenseOrder` | Le stand se paie à l'organisateur, le matériel à l'agence : trois bénéficiaires, trois pièces. Un ordre global obligerait les Finances à répartir à la main. |
| Le BC s'émet **après** le visa Direction | `orderStage` + `canRequestPurchaseOrder` (pure, testée) | Deux responsabilités distinctes : la Direction engage, les Finances paient. |
| Ajout après décision **autorisé et tracé** | `addedAfterDecision` | Cas réel : on découvre qu'il faut un stand. On ne bloque pas — mais l'écran affiche le dépassement. |
| Le matériel promo **n'est pas recopié** | `promoMaterialId` | Il a un circuit non négociable (visa publicitaire, conformité, agence, BAT). Le poste y renvoie. |
| Ce qui est **annoncé** doit être **chiffré** | `plannedGaps()` (pure, testée) | Un congrès déclare `hasBooth`/`hasSymposium` : l'écart se voit avant la facture. |

**Garde-fous financiers** (purs et testés) : `canSubmitItem` (on ne soumet pas un poste sans
chiffre), `canRequestPurchaseOrder` (accordé + chiffré + budget choisi, une seule fois — un refus
rouvre le droit), `canEmitOrder` (jamais un poste non accordé, jamais deux fois). Un montant déjà
couvert par un ordre ne peut plus changer, un poste payé ne peut plus être retiré.

Les différences réelles entre modules — où lit-on l'enveloppe, quel statut vaut « accordé »,
quelle permission, quel chemin revalider — sont rassemblées dans la table `PARENTS` des actions :
**un seul endroit** à compléter pour un module de plus. Le chargement des postes (libellés du
matériel, de l'ordre, du budget, de la demande de devis — résolus **en lot**) est mutualisé dans
`queries/ad-pro-items.ts` : les quatre écrans lisent la même vérité.

Fichiers : `lib/ad-pro-items.ts` (`breakdown`, `canEmitOrder`, `plannedGaps` +
`ad-pro-items.test.ts`, 19 tests), `lib/actions/ad-pro-item-actions.ts`,
`components/ad-pro/items-panel.tsx` (branché sur `/sponsoring/[id]` et, par un emplacement
optionnel de `CongressDetailView`, sur `/congress-national/[id]` — l'international ne change pas).
Migrations `20260806120000_sponsoring_items` puis `20260806140000_ad_pro_items`.

### Mobile — superposition, défilement et hauteurs

Trois défauts indépendants, un même symptôme (« les modules se superposent »).

1. **Échelle de superposition** — la barre d'onglets était à `z-60`, au-dessus des feuilles et
   tiroirs (`z-50`). L'échelle est désormais écrite dans `globals.css` : en-tête 30, barre
   d'onglets **40**, modales **50**, tiroir « Tout » 60, courrier 90, palette 100, pop-up 200.
   Toute nouvelle couche modale se place à 50 et ne descend jamais en dessous.
2. **Verrou de défilement** — `lib/use-scroll-lock.ts`. Le code figeait `document.body` ; or la
   coque est `h-screen overflow-hidden` et le conteneur défilant est le `<main>` (`id="app-scroll"`).
   Le verrou était donc **sans effet**. Il est maintenant **compté** (une feuille ouverte depuis un
   tiroir ne rend pas le défilement au tiroir en se refermant) et branché sur les six couches
   modales. Pas de `position: fixed` sur le body : cette astuce fait sauter la page en haut à la
   fermeture.
3. **Hauteurs mesurées** — `components/layout/chrome-metrics.tsx` publie `--app-chrome-top`
   (bandeaux + en-tête) et `--app-chrome-bottom` (barre d'onglets) par `ResizeObserver`. Les
   utilitaires `.app-viewport` / `.app-viewport-flush` s'en servent. Mesurées et non écrites, pour
   deux raisons qu'une constante ne couvre pas : les bandeaux **passent à la ligne** sur un écran
   étroit, et la barre d'onglets est `display: none` sur ordinateur — mesurée, elle vaut alors 0,
   sans règle média supplémentaire à maintenir. Écrans concernés : assistant, messagerie, éditeur
   Office.

### Analyseur CTD — réserves ANPP, corpus et coût

Trois manques structurels de l'analyseur : il ne se souvenait pas de ce que l'agence nous avait
déjà reproché, il ne savait pas sur quels textes il s'appuyait, et personne ne voyait ce qu'il
coûtait. Voici comment chacun est traité — et surtout **où sont les limites**.

#### 1. Bibliothèque des réserves ANPP — la mémoire du service

Écran `/regulatory/enregistrement/reserves` (permission `regulatory.reserve.manage`).

| Étape | Fichier | Règle exacte |
|---|---|---|
| Import d'une lettre | `reserves/library-ingest.ts` → `ingestReserveDocument` | Texte natif → OCR → **vision** (pages rastérisées). Dédoublonnage sur `sha256` : réimporter la même lettre ne coûte rien. |
| Extraction des points | `reserves/library-extract.ts` | Schéma JSON **strict**. Une réserve **sans verbatim est jetée** — sans la citation exacte, on ne pourrait rien opposer. En vision, la consigne dit explicitement que **l'image fait foi**, pas l'OCR. |
| Recherche de précédents | `reserves/library.ts` → `findSimilarReserves` | `GREATEST(ts_rank français, similarité trigrammes)`, seuil 0,02. Filtres DCI / fournisseur / section CTD. |
| Réponse qui a marché | `bestHistoricalResponse` | Renvoie l'acceptée **et** les réitérées : savoir ce qui a échoué vaut autant que savoir ce qui a réussi. |
| Score de risque | `reserveRisk` | Explicable : `reasons[]` dit *pourquoi*. Ce n'est **pas** une prédiction de la décision de l'ANPP, et l'écran l'écrit. |

**La frontière entre apprendre et décider.** `proposeRules` repère un reproche revenu ≥ 3 fois et
propose une règle au statut `PROPOSED`. Elle est **inerte** : seule `validateDerivedRule` (humain
autorisé, audité) la fait passer à `VALIDATED`, et `activeDerivedRules` ne renvoie que celles-là.
`ruleConfidence` **sature à 0,9** — une observation, si répétée soit-elle, ne devient jamais une
règle de droit.

#### 2. Constats défendables

Champs ajoutés à `RegulatoryFinding` : `ruleRef`, `confidence`, `page`, `excerpt`,
`conflictingValues[]`, `recommendation`, `similarReserveIds[]`, `reserveRisk`.

- `findings/enrich.ts` → `enrichVersionFindings` est appelé **après** la persistance des constats
  (jobs `RULES` et `AI_REVIEW`), **hors transaction** et sans jamais lever : un échec
  d'enrichissement laisse l'analyse complète, il ne la perd pas.
- `findingQuality` (pure, testée) note un constat sur 6 éléments et dit `defensible` uniquement si
  on peut **montrer la pièce** (règle + document + page + extrait). L'écran affiche ce qui manque :
  découvrir qu'un constat n'était pas étayé doit se faire ici, pas en séance.
- ⚠️ Un précédent ANPP est attaché **comme précédent**. Il n'aggrave jamais automatiquement la
  sévérité et ne crée aucun blocage.

#### 3. Corpus réglementaire et veille ANPP

Écran `/regulatory/enregistrement/corpus` (`regulatory.corpus.view` / `.manage`).

- `corpus/catalog.ts` — 43 sources, chacune marquée `ingestible` (faux = sous licence) et `binding`
  (faux = projet non opposable). `FIRST_WAVE` = les 10 qui suffisent à analyser un dossier algérien.
- `corpus/fetch-source.ts` — PDF direct, DOCX, ou page HTML dont on **suit le lien « Télécharger »**
  (sinon on indexerait un menu de site au lieu d'une ligne directrice). Rejette un contenu < 500
  caractères. Fonctions pures testées : `findPdfLink`, `extOf`, `htmlToText`.
- `corpus/ingest-catalog.ts` — l'**empreinte décide** : contenu identique ⇒ rien n'est créé. Sinon
  une nouvelle version **au statut `DRAFT`**, pointant vers celle qu'elle remplace. Rien ne devient
  opposable sans activation humaine.
- `corpus/watch-schedule.ts` → `runAnppWatchIfDue` — relevé **quotidien** des pages de publication
  ANPP, branché sur `runScheduledJobs`. Idempotent sans nouvelle table (le dernier passage se lit
  dans le journal d'audit `CORPUS_WATCHED`). En cas de changement, **notification** aux détenteurs
  de `regulatory.corpus.manage`. La veille **signale**, elle n'ingère rien : décider qu'un texte
  fait foi reste un acte humain. Désactivable par `REG_ANPP_WATCH=0`.
- ⚠️ **Licences** : la Ph. Eur. de l'EDQM et les ouvrages sous droits sont *référencés*, jamais
  téléchargés ni stockés. La vérification est faite **deux fois** (catalogue + ingestion) : c'est
  une limite juridique, pas une préférence.

#### 4. Coût — voir, réutiliser, plafonner

`cost/ledger.ts`, restitué dans la carte « Coût de l'analyse IA » de l'écran dossier.

1. **Voir** : chaque appel est tracé au **dossier**, à l'**étape** et au **fichier**. Un total
   global ne se corrige pas ; une étape ou un fichier, si.
2. **Ne pas repayer** : `cacheKeyOf` = SHA-256 de (étape + modèle + consigne + contenu + schéma +
   empreinte des images). Un fichier inchangé entre la V1 et la V2 d'un dossier est **relu, pas
   racheté**.
3. **S'arrêter** : `budgetState` refuse l'appel **avant** de dépenser quand le plafond du dossier
   (ou `CTD_BUDGET_USD_DEFAULT`) est atteint — et l'écran le dit, plutôt que de laisser filer la
   facture en silence.

**Analyse différée (moitié prix)** — `cost/batch-runner.ts`. Le fournisseur facture deux fois moins
cher ce qu'on accepte d'attendre (≤ 24 h). Sans intérêt pour une analyse qu'on regarde tout de
suite ; décisif pour une **réanalyse complète**. Le choix reste explicite à l'écran, avec le prix
et le délai. Trois garde-fous : le budget est vérifié **avant** dépôt (estimation, refus motivé) ;
`processedAt` garantit qu'un lot n'est traité **qu'une fois** ; les constats restent des **PROJETS**
non bloquants — différer une analyse ne lui donne pas plus d'autorité. Le prompt, la consigne et la
validation sont **les mêmes fonctions** que la voie immédiate (`buildPrompt`, `SYSTEM_PROMPT`,
`parseReviewOutput`) : sans cela, « moitié prix » finirait par vouloir dire « moins bien ».

#### 5. Couverture INTÉGRALE, documents géants, examen visuel

Quatre plafonds silencieux ont été supprimés — silencieux au sens propre : ils écartaient du
contenu **sans que rien ne distingue « analysé » de « analysé à 8 % »**. Un dossier réglementaire
à moitié lu qui a l'air complet est pire qu'un dossier non analysé : on s'y fie.

| Ancien plafond | Aujourd'hui | Ce qui le rendait nécessaire |
|---|---|---|
| `REG_AI_MAX_CHUNKS` = 120 parts (~1 200 pages) | **0 = intégral** | Rien : c'était un garde-fou de coût aveugle. Le coût est désormais tenu par le **plafond budgétaire du dossier**, qui refuse l'appel avant la dépense et le dit. |
| `REG_OCR_MAX_PAGES` = 25 pages | **0 = illimité** | La rastérisation gardait **toutes** les pages en mémoire. Elle est maintenant **en flux** (`rasterizePdfStream`) : une page vit à la fois. |
| Vision = 60 pages | **0 = tout le document** | Même cause, même correction. |
| `REG_MAX_PROCESS_MB` = 1 Go (bridé à 4) | **8 Go par défaut, réglable à 200** | Idem — ne reste que la taille du fichier lui-même, que mupdf ouvre d'un bloc. |

- **`rasterizePdfStream`** est la pièce maîtresse : chaque page est rendue, remise à l'appelant,
  puis **relâchée**. La mémoire ne dépend plus du nombre de pages mais de la plus grande d'entre
  elles. `onPage` est attendu avant de rendre la suivante — sans ce `await`, la file d'attente
  reconstituerait exactement le tas qu'on vient de supprimer.
- **Toute troncature restante se DIT** : plafond budgétaire atteint, lot refusé, page corrompue —
  chacun apparaît en clair dans le journal (« ⚠ ANALYSE INCOMPLÈTE … le reste n'a PAS été lu »).
- ⚠️ **Limite réelle restante** : un fichier UNIQUE doit tenir en mémoire pour être ouvert. Un
  *dossier* de plusieurs dizaines de Go passe sans difficulté (les fichiers sont traités un par
  un) ; un *fichier* de 10 Go dépend de la RAM de l'instance. C'est la machine qui décide, plus un
  réglage — et quand elle ne suffit pas, le message dit la taille, le seuil et quoi faire.

**Job `VISION` — ce que le texte ne dira jamais.** Le module de lecture des figures existait mais
n'était **appelé par personne** (référencé uniquement par son propre test). Il est branché, et
porte désormais **deux** questions posées à la même image dans le même appel — rastériser et
transmettre les pages est le vrai coût, y ajouter une seconde question est quasi gratuit :

1. **les figures** — courbes de stabilité, chromatogrammes, profils de dissolution, schémas de
   procédé. Les `concerns` deviennent des constats sourcés (page + valeurs lues) ;
2. **la FORME de la pièce** — `CAPTURE_ECRAN`, `PHOTO_ECRAN`, `PHOTO_DOCUMENT`, `SCAN_ILLISIBLE`,
   `PAGE_TRONQUEE`, `PAGE_DE_TRAVERS`, `FILIGRANE_BROUILLON`, `SIGNATURE_ABSENTE`, `TAMPON_ABSENT`,
   `MENTION_ILLISIBLE`. **Aucun de ces défauts n'existe dans le texte** : l'OCR d'une capture
   d'écran rend un texte parfaitement propre. Capture d'écran, photo d'écran et filigrane
   « brouillon » sont `CRITICAL` — ils ne se corrigent pas par une explication, il faut la pièce
   authentique. Un défaut **sans constat visuel est écarté** (« c'est une capture d'écran » sans
   dire à quoi on le voit ferait recaler une pièce valable sur une intuition).

#### 6. Coût réel — l'écart qui a été corrigé

⚠️ La revue de fond/forme passait par `askClaudeCheap`, qui **n'écrit rien** dans
`RegulatoryAiCall`. Deux conséquences invisibles depuis l'écran : la carte « Coût de l'analyse IA »
montrait tout **sauf** l'analyse, et le plafond par dossier — qui s'appuie sur cette même table —
**ne plafonnait rien**. On pouvait croire un budget tenu alors qu'il était dépassé d'un ordre de
grandeur.

`agents/review-ai.ts` → `lunaReviewFn` route désormais chaque part par `trackedLuna` : **cache**
(une part inchangée d'une version à l'autre est relue, pas rachetée), **plafond** (refus AVANT la
dépense, et l'analyse s'arrête au lieu de creuser un trou silencieux) et **traçabilité** au fichier
près. Repli sur Claude si la clé OpenAI manque — un filet, pas un choix de qualité.

**Analyse IMMÉDIATE par défaut.** Le différé (Batch) coûte deux fois moins cher mais fait attendre
les constats jusqu'à 24 h — et pendant ce temps l'écran montre un dossier « en revue » amputé de sa
partie la plus exigeante. Découvrir après coup qu'on a lu une analyse incomplète coûte bien plus
cher que l'écart de prix : **on paie plein tarif et on voit tout de suite**. Le différé reste
disponible **sur demande** (bouton « Réanalyser à moitié prix » de l'écran dossier) et redevient le
défaut avec `REG_AI_BATCH=1`, pour une réanalyse massive lancée le soir. Quand il est utilisé, la
voie Batch couvre la version **entière** : le fournisseur borne un lot à 400 requêtes — contrainte
de transport, pas raison de lire un dossier à moitié — on dépose donc **autant de lots que
nécessaire**, chacun suivi séparément, chacun avec **sa propre** table de correspondance (deux lots
partageant la même créeraient les constats en double).

Ordres de grandeur, part ≈ 10 pages ≈ 7 000 jetons d'entrée :

| Dossier | Parts | **Immédiat (défaut)** | Batch (sur demande) |
|---|---|---|---|
| 1 200 pages | 120 | **~0,35 $** | ~0,17 $ |
| 15 000 pages | 1 500 | **~4,30 $** | ~2,15 $ |

#### 7. Référentiels cités

La consigne d'analyse confronte le document à trois corpus, et demande de **citer** celui qui
fonde chaque constat (`ruleRef`) : **Algérie** (exigences ANPP, module 1 algérien, langue,
légalisation, CPP, GMP, notice FR/AR — **prioritaire en cas de divergence**), **ICH** (M4/M4Q/M4S/M4E,
Q1A(R2), Q2(R2), Q3A/B/C/D, Q6A, Q8/Q9/Q10, Q11, M9, E6) et **UE** (2001/83/CE annexe I, lignes
directrices EMA, Ph. Eur. — citée, jamais recopiée). La **zone climatique II** est explicitement
demandée : des données de stabilité produites en zone I ne suffisent pas à justifier la durée de
conservation revendiquée.

#### 8. Modèle et environnement

`lib/openai-luna.ts` — `gpt-5.6-luna` (multimodal texte + image, sorties JSON strictes, Batch ×0,5).
Variables : `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `CTD_MODEL_CHEAP`, `CTD_BUDGET_USD_DEFAULT`,
`REG_ANPP_WATCH`, `REG_AI_BATCH`, `REG_AI_MAX_CHUNKS`, `REG_OCR_MAX_PAGES`, `REG_MAX_PROCESS_MB`,
`REG_VISION`.

⚠️ **Le corpus réglementaire ne peut pas être téléchargé depuis un environnement de développement**
(le proxy refuse `anpp.dz`, `database.ich.org`, `who.int`, `ema.europa.eu`). L'ingestion doit être
lancée **depuis l'application déployée**, bouton « Ingérer la 1ʳᵉ vague » de
`/regulatory/enregistrement/corpus`.

#### 9. Pages exactes, escalade, sémantique, livrables (« god mode »)

**Pages exactes + clic-vers-la-preuve.** Le texte extrait n'est plus un ruban anonyme : une
**carte des pages** (`RegulatoryExtraction.pageMap` = position du début de chaque page) est
construite au moment de l'extraction (native mupdf par page **et** OCR) et jamais retaillée —
retailler décalerait toutes les positions. Chaque part d'analyse porte ses offsets réels →
intervalle de pages **exact** ; et pour chaque constat, la citation (`evidence`) est **recherchée
dans le texte** (`anchorEvidence`, insensible aux espaces/casse) : la page retrouvée **PRIME**
l'estimation du modèle, et une preuve introuvable rend `null` — jamais une page inventée. À
l'écran, la page est un **lien** qui ouvre le PDF au bon endroit (`?inline=1#page=N`). Constats
redessinés : groupés par gravité avec compteurs, liseré de couleur, badge DÉFENDABLE, citation en
exergue.

**Escalade éco → qualité** (`agents/escalate.ts`). Une section sortie en CRITIQUE du balayage
économique déclenche **automatiquement** les agents spécialistes dont le périmètre la couvre —
c'est le geste d'un vrai évaluateur : insister là où ça fait mal. Garde-fous : CRITIQUE seulement,
un agent ne repasse jamais, **4 agents max** par version (au-delà c'est une réanalyse déguisée —
décision humaine), `REG_AGENT_AUTO=0` pour couper. Ne lève jamais. Et quand une analyse différée
se termine **sans demandeur identifiable**, les rôles superviseurs (réglage
`regulatorySupervisorRoles` + SUPER_ADMIN) sont notifiés — un résultat que personne ne lit n'existe
pas. L'écran garde les deux voies explicites — « Résultats maintenant (plein tarif) » (job
`payload {mode:"immediate"}`, qui l'emporte toujours) et « Réanalyser à moitié prix (sous 24 h) » —
la voie immédiate étant désormais **celle par défaut**.

**Recherche sémantique hybride** (`corpus/semantic.ts`). Le corpus est largement en anglais, les
requêtes en français : « durée de conservation » ne matchera jamais « shelf life » en plein-texte.
Embeddings 512 dim (`lunaEmbed`, `text-embedding-3-small`) sur sections ACTIVES du corpus +
réserves ANPP, stockés en JSONB (pas de pgvector : cosinus en mémoire sur quelques milliers de
vecteurs = millisecondes), cache de processus estampillé par (nombre, dernière activation),
rattrapage borné (96/passage) par le planificateur. `searchCorpus` fusionne lexical ∪ sémantique
(`mergeHybrid` : normalisation par voie + bonus de convergence 0,15). **Jamais bloquant** : sans
clé ni vecteurs, le lexical continue seul.

**Livrables** : rapport de constats **.docx** (gravité, preuves, pages, recommandations — bouton
sur la carte Constats) et **lettre de réponse aux réserves** .docx par cycle (verbatim ANPP mot à
mot + réponse approuvée/brouillon/`[À COMPLÉTER]` — jamais d'invention), tous deux stockés
chiffrés + audités (`docgen/reports.ts`). **Verdict GO / NO-GO** en tête
de dossier : bloqueur ou critique ouvert → NO-GO ; majeur ouvert ou complétude < 100 % → GO sous
conditions ; sinon GO — avec les **réserves les plus probables** (précédents `reserveRisk` quand
ils existent, sinon la gravité, marquée `*` — jamais un pourcentage inventé présenté comme
mesuré). **Notice en arabe** (`rules/notice-arabic.ts`) : obligation algérienne (décret n° 92-286)
— un document 1.3.x (hors RCP 1.3.1) au texte natif presque sans caractères arabes → constat
MAJEUR ; l'OCR n'est **jamais** jugé (le latin massacre l'arabe, on n'accuse pas sur une lecture
ratée). **Constat → tâche** : un clic crée une tâche personnelle (« Mon espace ») portant détail,
preuve, page et lien — anti-doublon inclus.

#### 10. Entraînement de l'IA — l'école de l'analyseur (Super Admin)

Écran `/regulatory/enregistrement/entrainement`, onglet « Entraînement IA » (SUPER ADMIN
uniquement, transverse aux entités). L'analyseur apprend par **quatre canaux**, tous visibles sur
le tableau d'expertise : le **corpus** (les règles), les **réserves ANPP** historiques (les
reproches), les **règles dérivées** validées, et les **études de cas** — le canal qu'apporte ce
module : un produit PASSÉ, son dossier, son **issue réelle** (accepté / accepté avec réserves /
rejeté) et la **leçon retenue** en une phrase.

- **Déposer suffit** (mêmes gestes que le corpus) : chaque pièce est extraite, repérée par
  section CTD (déterministe, zéro coût IA), dédupliquée par empreinte **par étude de cas**.
- **Injection dans TOUTES les analyses** (immédiate ET différée) : `experienceForSection`
  sélectionne ≤ 3 précédents par section — correspondance de section d'abord, puis les issues
  **instructives** (réserves/rejet) devant, dédupliqués par empreinte — injectés dans le prompt
  comme bloc « EXPÉRIENCE INTERNE » avec l'issue et la leçon.
- ⚠️ **La frontière qui rend l'apprentissage sûr** : un précédent CALIBRE la sévérité et
  ANTICIPE les réserves probables ; il ne fonde **jamais** un `ruleRef` (consigne explicite,
  testée) — seuls les textes du corpus font règle. Pas de « fine-tuning » du modèle : la
  connaissance vit en base, citée mot à mot, retirable à tout instant — fiable et auditable.
- Vecteurs sémantiques rattrapés par le planificateur (`embedBacklog`), couverture affichée.

### RH — quatre écrans, et les questions du quotidien

Le module était **une page à sept sections** : on y trouvait tout, sauf vite. Désormais :

| Écran | Route | Ce qu'on y fait |
|---|---|---|
| **À traiter** | `/rh` | Ce qui attend une décision : demandes RH, congés, avances, contrats à échéance. |
| **Équipe** | `/rh/equipe` | L'annuaire **cherchable** + la répartition de l'effectif (camembert). |
| **Congés** | `/rh/conges` | L'état de l'équipe **maintenant** + l'historique des décisions. |
| **Départements** | `/rh/departements` | La structure (hiérarchie, responsables, rattachements). |

**Sur le fond** — `lib/queries/hr-pulse.ts` (`getHrPulse`) répond à ce que le module ignorait :

- **qui est absent aujourd'hui** (nombre sur l'effectif, motif, date de retour) — LA question
  quotidienne d'un service RH ;
- **qui part dans les 14 jours** : anticiper au lieu de constater ;
- **les échéances qu'on oublie** : fin de **période d'essai** (la renouvelée prime) et fin de
  contrat sous 60 jours, côte à côte — laisser filer une fin d'essai a des conséquences
  juridiques ;
- **les soldes de congés** les plus élevés : ce qui risque d'être reporté ou perdu ;
- **la recherche** dans l'annuaire (nom, poste, département, e-mail, téléphone — un seul champ,
  filtrage local, réponse à la frappe).

Salaire et masse salariale restent réservés aux comptes qui **valident**, comme partout ailleurs.

### Mobile — l'écran respire

Sur 375 px, chaque carte mangeait ~32 px en marges, bordures et arrondis : l'application
paraissait « boxée » au lieu de native.

- Les cartes de **premier niveau** passent **bord à bord** sur téléphone (ni bordure latérale,
  ni arrondi sur les côtés) ; les cartes **imbriquées** gardent leur cadre — c'est lui qui montre
  l'imbrication. Porté par une seule classe `page-shell` sur le conteneur de page
  (`app/(app)/layout.tsx` + `globals.css`), donc aucun composant à retoucher un par un.
- Un tableau qui déborde défile **bord à bord** ; marges de page 16 → 12 px ; ombres allégées ;
  titres compacts ; `text-size-adjust: 100%` (iOS n'agrandit plus le texte en paysage).
- **Les tiroirs deviennent des feuilles** : sur téléphone, `<Sheet>` monte du bas, arrondi en
  haut, avec une poignée, et s'arrête à 95 % de la hauteur pour qu'on voie ce qu'il y a derrière.
  Sur ordinateur, rien ne change.

### Frontière client / serveur (règle de compilation)

Un composant `"use client"` est compilé **pour le navigateur**. S'il importe — même
indirectement — un module qui lit des fichiers (`fs`, `zlib`…), la compilation de production
échoue avec **« Module not found: Can't resolve 'fs' »**. Le typecheck ne le voit pas, et un
`npm run build` local peut le rater à cause du cache `.next`.

- Les **actions serveur** (`"use server"`) ne comptent pas : Next.js les remplace par un appel
  distant. Un composant client peut les appeler librement.
- Pattern appliqué dans le code : les fonctions **pures** vivent dans un module dédié sans
  dépendance lourde — `src/lib/market/text.ts` (normalisation) et `galenic.ts` (molécule,
  dosage, forme) — tandis que `molecule.ts`, qui **lit les données**, les réexporte pour les
  modules serveur. L'explorateur de produits importe donc `galenic`, jamais `molecule`.
- **`src/lib/client-bundle-guard.test.ts`** remonte les chaînes d'import de chaque composant
  client et fait échouer `npm test` en affichant le chemin fautif, module par module.

### Graphiques — une seule palette, vérifiée

Tous les graphiques de la plateforme partagent les mêmes primitives (`src/components/charts/` :
`Donut`, `Trend`, `Bars`, `Meter`) et la **même palette catégorielle**, définie une fois dans
`palette.ts`.

- L'**ordre des teintes n'est pas décoratif** : il a été vérifié par l'outil de validation —
  écart CVD ≥ 8 sur toutes les paires voisines, écart en vision normale ≥ 15, sur le fond
  **blanc réel** de nos cartes. Ne pas réordonner.
- Trois teintes passent sous 3:1 de contraste sur blanc → règle tenue partout : **jamais la
  couleur seule**. Chaque part est reprise dans une **légende chiffrée** (qui vaut vue
  tabulaire) et décrite dans son `<title>` (info-bulle native, accessible).
- Au-delà de **6 catégories**, `foldTail` replie la queue dans « Autres » — on n'invente
  jamais une 7ᵉ teinte, indistinguable d'une existante en vision daltonienne.
- **Un seul axe** par graphique (jamais deux échelles), écart de 2 px entre tranches, marques
  fines, grille discrète. Composants **serveur** : aucun JS envoyé au navigateur.

### Intelligence marché — la maille MOLÉCULE

On cherche **par la case que l'on remplit** : **molécule**, **nom de produit**, ou
**laboratoire** (les trois se cumulent). Remplir la molécule débloque en plus l'**analyse
concurrentielle** — c'est la seule maille qui a un sens pour comparer des acteurs entre eux.

Une molécule, au sens métier, est un **triplet molécule + dosage + forme** : l'amoxicilline
500 mg gélule et l'amoxicilline 1 g injectable ne s'affrontent pas sur le même marché.

**Ce que l'analyse répond** (`src/lib/market/molecule.ts` → `analyzeMolecule`) :
- le **poids du marché** (valeur DZD/USD, volume, nombre d'acteurs) ;
- le **marché adressable** : part **ville** et part **hôpital** en %, avec les acteurs de chaque côté ;
- les **parts de marché** de chaque laboratoire, le leader, la **concentration** (HHI : > 2500 = concentré) ;
- qui est **enregistré** à la nomenclature, et surtout s'il **fabrique en Algérie ou importe** ;
- les **dosages et formes réellement présents**, pour affiner la recherche.

**Le vrai travail : réconcilier trois sources qui n'écrivent rien pareil.**

| Normalisation | Ce qu'elle résout |
|---|---|
| `moleculeStem` / `moleculeMatches` | « AMOXICILLIN » (IQVIA, anglais) ≡ « AMOXICILLINE TRIHYDRATÉE EXPRIMÉE EN AMOXICILLINE » (nomenclature). Les **sels** et l'hydratation ne font pas une molécule différente. Une association demandée exige **tous** ses composants. |
| `canonicalForm` | Décode les présentations abrégées d'IQVIA (`PD.SAC`, `P/SUS`, `FL+SOLV`, `STYL PRE REM`…). Formes non reconnues : **32,6 % → 3,8 %** de la valeur du marché. Stylos et seringues préremplies = **injectables** (c'est ainsi qu'ils s'achètent) ; bandelettes et lecteurs = **dispositifs**, pas des médicaments. L'ordre des règles est la règle métier (`GELULE` avant `GEL`, `PERFUSION` avant `INJECTABLE`). |
| `extractDosage` / `dosageMatches` | « CP.PE 875MG/ 125 MG 10 » → `875MG/125MG`. Renvoie `null` plutôt que d'inventer. |
| `labKey` | « SAIDAL » ≡ « GROUPE SAIDAL » ≡ « EPE / SPA GROUPE SAIDAL » — sans quoi le même acteur apparaissait trois fois et son origine ne se rattachait à rien. |

Saisie **assistée** (`moleculeSuggestions`, `labSuggestions`) : on ne propose que ce qui existe
réellement dans les données, les plus gros marchés d'abord. Écran : `/business-development/marche/produits`.
Tests : `src/lib/market/molecule.test.ts` (20 tests, cas tirés des données réelles).

### PCH — un appel d'offres lu par l'IA devient un tableau Excel

Téléverser le document suffit : **OCR → extraction IA des produits → enrichissement
automatique de chaque ligne** par l'intelligence marché. Avant, il fallait cliquer « Enrichir »
ligne par ligne — sur un marché de quarante produits, personne ne le faisait.

- **Nature de l'unité demandée** (`unitLabel`) : un appel d'offres ne parle pas toujours de
  comprimés — flacon, ampoule, seringue, poche, sachet. C'est ce mot qui donne son sens à la
  quantité ; sans lui on compare des flacons à des comprimés.
- **Analyse de marché par ligne** (`enrichLineById` → `analyzeMolecule`) : taille du marché,
  nombre d'acteurs, partage **ville / hôpital** en %, principaux concurrents avec leur part,
  concentration, et **production locale ou importée**. L'origine est **pondérée par le poids
  des acteurs**, pas par leur nombre : un marché à 80 % importé reste importé même s'il compte
  dix petits fabricants locaux (`dominantOrigin`).
- **Enrichir tout** (`enrichAllTenderLines`) rejoue l'analyse sur l'ensemble des lignes.
- **Export Excel** (`/api/pch/export?id=…`, `src/lib/pch-tender-export.ts`) — deux feuilles :
  - *Produits demandés* : désignation, molécule, dosage, forme, **unité demandée**, quantité,
    conditionnement, **boîtes à fournir** (arrondi au **supérieur** — on ne livre pas une
    demi-boîte), prix de référence verrouillé sur les réceptions PCH, valeur du marché à ce
    prix, et notre position ;
  - *Analyse de marché* : taille, concurrents, ville/hôpital, concentration, principaux
    acteurs, production locale ou importée.
  Les colonnes sans donnée **restent vides** : pas de demi-vérité dans le fichier qui sert à
  chiffrer une offre. Tests : `src/lib/pch-tender-export.test.ts` (11 tests).

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

### Budgets par département — trois natures, trois responsables

Écran `/budgets/departements`. Le modèle porte **une ligne par (département, année, NATURE)** :

| Nature | Ce que ça couvre | Qui la règle |
|---|---|---|
| `OPERATING` | **Moyens généraux** — fournitures, prestations, déplacements | **Le directeur du département** (responsable ou adjoint dans l'organigramme) + l'administrateur |
| `HR` | **Masse salariale** — employés, charges, recrutement | **Les ressources humaines** (`RH:UPDATE`), exclusivement |
| `ACTIVITY` | **Budget métier** — Ad & Pro au marketing, paiement des BV au Regulatory… | **Le directeur du département** + l'administrateur (listes d'accès **séparées** de celles des moyens généraux) |
| `TRAINING` | **Budget formation** — montée en compétence de l'équipe | Les RH, doté par l'administration |

**Personne ne s'accorde son propre budget.** Une **dotation** (montant initial) ou une **rallonge**
se DEMANDE (`DepartmentBudgetRequest`) et l'administration tranche — c'est ce qui rend vérifiable
« budget fixé par les RH, validé par l'administration » au lieu d'en faire un usage. Une dotation
initiale est une rallonge partant de zéro : même geste, même circuit. Un montant accordé
**s'ajoute** au budget en cours (le remplacer effacerait silencieusement la dotation précédente).

**La consommation est réelle**, pas déduite : chaque dépense s'impute via
`DepartmentBudgetExpense`, avec sa **facture ou son bon de paiement** en pièce **obligatoire** —
sans pièce, une ligne de dépense n'est qu'une affirmation. La masse salariale fait exception : elle
se lit sur la **paie**, jamais saisie.

Le Super Admin règle les deux. **La séparation n'est pas cosmétique** : un directeur administratif n'a pas à
connaître la masse salariale pour accorder un budget de déplacement, et les RH n'ont pas à arbitrer les achats.
Comme les deux responsables **n'écrivent jamais la même ligne**, l'un ne peut pas écraser l'autre — la contrainte
`@@unique([departmentId, year, kind])` le rend structurellement impossible, avant même le contrôle applicatif, qui
vérifie le droit **par nature** (`canSetDepartmentBudget`).

- **Les deux colonnes sont CÔTE À CÔTE**, et une case non modifiable est **affichée en lecture** (cadenas) plutôt
  que masquée : c'est la seule façon de voir ce que coûte réellement un département. Ce qui est réservé, c'est
  l'écriture, pas la lecture. Qui règle quoi est **écrit à l'écran**, pas seulement appliqué en silence.
- **La masse salariale RÉELLE est calculée depuis la paie** de l'exercice (**coût employeur** de chaque ligne, repli brut + primes − retenues sur les mois d'avant ce champ — `hr/payroll-cost.ts`),
  jamais saisie — un montant ressaisi dirait ce qu'on espère, pas ce qui se passe.
- **Le fonctionnement n'a volontairement PAS de colonne de consommation** : aucune dépense n'est aujourd'hui
  imputée à un département, et un chiffre inventé ressemblerait à une mesure sans en être une. La page le dit.
- `budgetHealth` distingue **« pas de budget réglé »** (`UNSET`) de **« rien consommé »** — une absence de décision
  n'est pas une bonne nouvelle. Seuils : ≥ 80 % `AT_RISK`, ≥ 100 % `OVER_BUDGET`.
- Le tableau nomme les départements par leur **chemin complet** (« Commercial › Ville »), sans quoi deux
  sous-départements homonymes de deux pôles se confondraient. Il reste dans la **portée d'entité** en cours.
**QUI Y A ACCÈS — réglé par le Super Admin, et par lui seul.** Le socle par rôle vaut *partout* ; il manquait de
quoi dire « le responsable du Commercial règle le fonctionnement DE SON département », ni plus ni ailleurs.

- **Trois portées distinctes**, parce que ce ne sont pas les mêmes personnes : **consultation**, **édition du
  fonctionnement**, **édition des employés**. On peut consulter sans rien régler.
- **Une règle par département + une règle GÉNÉRALE** (`departmentId = null`) valable pour tous. Les deux se
  **cumulent** (union, jamais intersection : intersecter ferait d'une règle de département une *restriction* de la
  règle générale). Unicité de la règle générale garantie par un **index partiel** — en SQL deux `NULL` ne s'égalent
  pas, un `@unique` ordinaire laisserait créer dix règles générales contradictoires.
- **Les autorisations s'AJOUTENT, elles ne retranchent jamais.** Poser la première ne doit pas retirer aux RH le
  budget des employés par effet de bord, et un droit qui disparaît sans qu'on l'ait demandé se diagnostique très
  mal. Pour restreindre, c'est le **droit de module** qu'on revoit. L'écran le dit, plutôt que de le laisser
  découvrir.
- **La porte de l'écran** n'est plus `requireModule("BUDGETS")` mais « droit de module **OU** une autorisation
  quelconque » : sinon une personne autorisée sur un département mais sans le module serait refoulée à l'entrée, et
  son autorisation ne servirait à rien. Les lignes qu'on n'a pas le droit de voir sont **filtrées côté serveur** —
  le montant ne transite même pas jusqu'au navigateur.
- Le droit est **revérifié à l'écriture**, sur CE département : les règles affichées à l'ouverture ont pu changer.
- La liste des rôles proposés est **dérivée de `ROLE_LABELS`**, jamais recopiée — une liste écrite à la main finit
  par proposer un rôle qui n'existe plus, et une case cochée sur un rôle fantôme n'autorise personne sans que rien
  ne le signale.
- **Fichiers** : `src/lib/department-budget.ts` (+ `.test.ts`, 28 tests), `src/lib/queries/department-budget.ts`,
  `src/lib/actions/department-budget-actions.ts`, `src/app/(app)/budgets/departements/` (`page.tsx`,
  `department-budget-table.tsx`, `access-sheet.tsx`). Modèles `DepartmentBudget`, `DepartmentBudgetAccess`.

### Ad & Pro — corriger une demande, joindre un fichier à un avis

**Corriger une demande** (bouton « Modifier » sur les trois détails Ad & Pro). Deux règles portent tout le reste :

1. **Ce qui a fondé une décision ne se réécrit pas.** Une fois la Direction ayant tranché, le demandeur ne modifie
   plus : réécrire « 200 000 demandés » en « 400 000 » après un accord transformerait la décision en autre chose
   que ce qui a été décidé. Seule la **vue globale** garde la main — et l'audit note explicitement
   « **APRÈS DÉCISION** ». Avant décision : le demandeur, ou le droit `UPDATE` du module.
2. **Les champs de décision ne sont jamais modifiables ici** (montant accordé, statut, chef de produit, avis,
   motifs) : ils appartiennent au circuit. D'où une **LISTE BLANCHE** (`EDITABLE_FIELDS`) plutôt qu'une liste
   d'interdits — elle ne se trompe pas quand un champ nouveau apparaît dans le modèle. Le `select` de la requête
   **ET** le formulaire en sont dérivés : le formulaire ne peut pas afficher un champ que le serveur refuserait.

Le point d'entrée est **unique pour les trois modules** ; ce qui varie (table, module RBAC, chemin, colonne de
statut) tient dans la table `TARGETS`. L'audit consigne **ce qui CHANGE** (avant → après), pas l'état final :
relire « ville : Alger » n'apprend rien, « ville : Oran → Alger » dit ce qui s'est passé. Les comparaisons ignorent
les espaces de bordure et l'heure d'une date, sans quoi le journal se remplirait de non-modifications.

**Pièce jointe à un avis.** Le chef de produit, le National Sales et la Direction peuvent joindre un document à leur
décision (devis comparatif, note, courrier), **à toutes les issues** — y compris un simple commentaire. **L'ordre
des opérations porte la garantie** : les fichiers sont **contrôlés avant** que le circuit n'avance (enregistrer
l'avis puis refuser la pièce laisserait la décision prise et sa justification perdue), l'**étape courante est lue
avant** l'avancement (sinon la pièce serait rattachée à l'étape suivante, c'est-à-dire à quelqu'un d'autre), et
l'écriture n'a lieu qu'une fois le moteur ayant **autorisé** l'action. Catégorie `SUPPORTING_DOC`, `stepKey` = slug
de l'étape. Le contrôle sans écriture est extrait dans `validateAttachments` (`src/lib/attach-files.ts`).

- **Fichiers** : `src/lib/ad-pro-edit.ts` (+ `.test.ts`, 14 tests), `src/lib/queries/ad-pro-edit.ts`,
  `src/lib/actions/ad-pro-edit-actions.ts`, `src/components/ad-pro/edit-request-button.tsx` ;
  `src/lib/actions/workflow-actions.ts` (`advanceWorkflow`), `src/components/workflow/workflow-panel.tsx`.

### Assistant — recherche Regulatory complète et écriture sur les produits

- **`search_products` cherche là où les mots sont écrits** : DCI, nom commercial, référence, **classe
  thérapeutique** (« oncologie », « biosimilaire », « anticorps monoclonal »…), forme galénique, laboratoire
  partenaire, pays d'origine et entité. Sans la classe thérapeutique, ces recherches ne remontaient rien. La
  limite n'est plus figée (40 par défaut, **300** au plus) et la réponse dit le **total du portefeuille** et si
  elle est **tronquée** — omettre en silence serait pire que tronquer.
- **`set_products_company`** — seul outil d'écriture Regulatory : rattacher **un ou plusieurs** produits à une
  entité. Le lot est décrit par un **FILTRE**, jamais par une liste devinée, et ce filtre (`productBulkWhere`) est
  **partagé entre l'aperçu et l'exécution** — deux filtres écrits séparément finiraient par diverger, et on
  modifierait autre chose que ce qui a été montré. À l'exécution il est **intersecté avec les références
  affichées**, pour qu'un produit créé entre l'aperçu et le clic ne soit pas emporté. La confirmation **liste** les
  produits (25 puis « … et N autres ») plutôt qu'un compte. Droit vérifié : `REGULATORY:UPDATE` — écrire n'est pas
  lire — **revérifié à l'exécution**, jamais déduit de la proposition.
- **`MAX_TURNS = 16`** (contre 6) : lister tout le portefeuille consomme déjà plusieurs tours, et l'utilisateur
  recevait « je n'ai pas pu finaliser la demande » alors que l'assistant travaillait. Un tour ne coûte que s'il est
  utilisé — la boucle s'arrête dès que le modèle répond sans outil.

### Cloisonnement — entité, gamme, et ce que chacun voit

**Deux dimensions, pas une.** L'**entité** (société du groupe) dit *de qui* est un objet. La
**gamme** (`ProductRange`, propre à une entité) dit *de quoi* relève un produit. Elles se composent :
une gamme AFFINE l'entité, elle ne la remplace pas.

**Ce qui ouvre une entité** (`allowedCompanyIds`, pur, testé) : la société d'appartenance
(`Employee.companyId`), une autorisation nominative (`UserCompanyAccess`), **ou une gamme rattachée**
— une gamme ouvre son entité en lecture, sans quoi le rattachement n'ouvrirait rien. Le Super Admin
voit tout le groupe (`GROUP_WIDE_ROLES`) ; la Direction, non — ses accès inter-entités se saisissent.

**Ce qui restreint les produits** (`productRangeWhere`, pur, testé) : les gammes rattachées, **sauf**
celles dont l'entité est déjà ouverte en entier — on ne retire jamais un droit donné plus haut.
Composé côté serveur par `productRangeScope(userId)` dans `queries/regulatory-rows.ts` et
`queries/product-catalog.ts`.

**Le filtre d'entité des écrans** : `currentCompanyWhereFor(userId)` — la portée du cookie
**validée** contre les droits, avec deux garde-fous (aucun filtre si le groupe n'a qu'une société ;
aucun filtre pour qui ne relève d'aucune entité, on n'aveugle personne par omission). ⚠️ L'ancien
`currentCompanyWhere()` a été **supprimé** : il posait le cookie tel quel et, **sans cookie, ne
filtrait rien**.

**Le sélecteur** (`CompanySwitcher`) n'affiche un menu que si l'on a **plusieurs** entités ; sinon
il montre la sienne, sans choix. `setCompanyScope` **refuse** une entité hors droits et retombe sur
la portée légitime — jamais sur « toutes ».

**Écran** : `/admin/gammes` (Super Admin) — arbre entité › gammes › produits + rattachement des
personnes. Les produits sont ceux de Regulatory ; seuls ceux de l'entité de la gamme (ou sans
entité) sont éligibles. Supprimer une gamme **ne supprime aucun produit** (`SET NULL`).

---

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
| **Frontière Adam ↔ ERP** | `platform/contract.ts` (les 4 verbes, `Principal`, `PlatformQuery`, `PlatformCommand`, `DomainEvent` — **zéro import**) ; `platform/event-bus.ts` (`publish`/`subscribe`, abonnés isolés, mémoire bornée, rejeu) ; `platform/events.ts` (`emit` + catalogue fermé de 17 faits) ; `platform/in-process/adapter.ts` (**le seul pont** : `principalOf`, `query`, `command` → `performAction`, `authorize`, `destinationsOf` → `lib/nav-access.ts`) ; `platform/boundary-scan.ts` + `boundary.test.ts` (le **cliquet** : dette plafonnée à 430, `src/platform/` à zéro) ; `scripts/adam-boundary.ts` (`npm run adam:boundary`). Côté Adam : `lib/assistant/platform/change-feed.ts` (projection « quoi de neuf », branchée sur `what_changed`). ERP instrumenté : `hr-actions.ts`, `regulatory-actions.ts`, `comms/outbound.ts`. |
| **Adam — aiguillage & liste courte d'outils** | `lib/assistant/context/router.ts` (`routeQuery` : 5 classes de route, 11 domaines, plancher de confiance) ; `tool-shortlist.ts` (`TOOL_DOMAINS` — les 77 outils classés —, `ALWAYS_ON` socle de 4, `shortlistTools`) ; **`rollout.ts`** (`decideRollout` : `FAST_READ` / `SHORTLIST` / `LEGACY`, `SAFE_READ_TOOLS` liste blanche, `bucketOf` FNV-1a, garde `recordOutcome`/`guardStatus`/`readyForNextStep`) ; `discovery.ts` (`runDiscovery` — l'échappatoire `list_more_tools`) ; `shadow.ts` (mesure) ; `bench.ts` + `golden-corpus.ts` (TRAIN) + `holdout-corpus.ts` (**jamais retouché**). Branché dans `lib/assistant.ts` sur **les deux** boucles (`runAssistant` et `runAssistantStream`), via `assistantToolsFor(user)`. |
| **Adam — la coque de son bureau (et sa porte de sortie)** | Groupe de routes `app/(chief)/layout.tsx` : coque délibérément VIDE — ni menu latéral, ni barre supérieure, ni barre d'onglets, ni palette, ni bandeaux. `components/chief/{chief-workspace,chief-header,chief-home}.tsx` + `app/chief.css` (jeu de jetons `--chief-*` propre à Adam). **La sortie** : `components/chief/module-switcher.tsx` — une icône dans l'en-tête ouvre la liste des modules que CETTE personne peut ouvrir (champ de filtre, groupé par pôle, Échap / clic dehors referment). Les destinations arrivent par le **contrat de plateforme** (`navigation.destinations` → `in-process/adapter.ts` → `lib/nav-access.ts`), jamais par un import du menu de l'ERP : c'est ce qui garde le cliquet de frontière à 430. Le même `navigationFor` sert la barre latérale de l'ERP — une seule vérité sur « qui a le droit d'aller où ». Tests : `platform/navigation-destinations.test.ts` (dont : une entrée fusionnée mène au premier onglet AUTORISÉ, donc `/ad-pro` pour l'admin et `/congress-international` pour le délégué médical). |
| **Adam — espace de travail génératif** | `lib/assistant/workspace/protocol.ts` (types de blocs + `WORKSPACE_LIMITS`) ; `compose.ts` (`composeWorkspace` — table de correspondance **fermée** : un outil absent ne compose RIEN, le repli est le texte ; plus la porte `_blocs`, **revalidée champ par champ**, par laquelle une lecture déclare ce qu'elle montre) ; `sheet.ts` (classeur → lignes, ExcelJS, **sans dépendance ERP**) ; `emit.ts` (helpers **purs** de composition : gestes, retards, métriques de charge, étapes) ; `components/chief/workspace/blocks.tsx` + `blocks.css` (feuille autonome à valeurs de repli : les blocs servent aussi `/assistant`, qui ne charge pas `chief.css`) ; `preview-planche.tsx` (la planche de revue visuelle, servie par `/chief-of-staff?apercu=blocs` **uniquement** si `ADAM_BLOCK_PREVIEW=1` — elle n'a pas d'adresse en production). Blocs : `people` (fiche riche : statut, métriques, coordonnées avec provenance), `directory`, `mail`, `agenda`, `queue` (**avec ses boutons Approuver / Refuser**), `record`, `table` (**gestes par ligne**, cartes empilées sur mobile), `timeline`, `progress` (jauges), `document` (PDF, image, feuille), `dossier` (faits + frise de circuit + pièces + participants + activité), `email` (le message avant l'envoi). Événement de flux `{ type: "workspace" }` ; stocké sur le message dans `assistant-chat.tsx`, qui fournit `WorkspaceAskProvider` — un clic écrit une phrase dans la conversation, il n'exécute rien. La prop `canvas` (défaut **faux**) rend le tour d'Adam **sans bulle** ; `/assistant` reste inchangé. |
| **Adam — montrer (et non lire)** | `lib/assistant/show-tools.ts` : `show_document` (PDF/contrat en visionneuse, image, classeur rendu en tableau — passe par le **contrat** `document.show`, servi par `platform/in-process/adapter.ts`, seul autorisé à toucher Drive, stockage et droits) et `show_table` (colonnes et tri **à la demande** : le modèle choisit la vue, le serveur relit les lignes à la source canonique — sources fermées dans `TABLE_SOURCES`). À ne pas confondre avec `read_document`, qui extrait du TEXTE pour le modèle. |
| **Sécurité / session** | `lib/rbac.ts` (PERMISSIONS, `userCan`, `anyRoleFilter`, `getAccess` cumul secondaire), `lib/session.ts` (`requireUser`/`requireModule`, maj `UserSession.lastSeenAt`), `lib/entity-access.ts` (accès par ligne + `ENTITY_MODULE`). |
| **Workflow Ad & Pro** | `lib/workflow/engine.ts` · `defaults.ts` · `engine.test.ts`, `lib/queries/workflow.ts`, `components/workflow/workflow-panel.tsx`, `app/(app)/admin/workflows/`. |
| **RH** | `lib/actions/hr-actions.ts` (fiche employé, salaires, essai, congés éditables par le DRH), `hr-document-actions.ts` (demandes, notes de frais, entrevues, archives), `payroll-hr-actions.ts` (paie), `lib/queries/hr-documents.ts` (DTO + confidentialité salaires), pages `app/(app)/rh/` (+ `paie/`, `departements/`), `app/(app)/mon-dossier/`. |
| **Structure & hiérarchie** | `lib/departments.ts` (arbre N niveaux, membres, **résolution du N+1**), `lib/actions/department-actions.ts` (CRUD + rattachements, anti-cycle), `app/(app)/rh/departements/`, `app/(app)/admin/organigramme/`. Portées d'étape `DEPARTMENT_MANAGER`/`DEPARTMENT_HEAD` dans `lib/workflow/`. |
| **Secrétariat / courses** | `lib/actions/admin-request-actions.ts` (demandes, missions, courses, archive DONE), `lib/queries/admin-requests.ts`, pages `app/(app)/demandes/` (+ `courses/`, `driver/`, `expense-ack.tsx`). |
| **Stocks** | `lib/actions/stock-snapshot-actions.ts`, `lib/queries/stock.ts`, `app/(app)/stocks/`. |
| **Regulatory** | `lib/actions/regulatory-actions.ts` (validation fabricant/variation, `setRegulatoryResponsible`), `app/(app)/regulatory/` (`edit-product.tsx`, `new-product.tsx`, `regulatory-table.tsx`, `[id]/page.tsx`). Champ `RegulatoryProduct.packaging` (conditionnement). |
| **Regulatory — les trois champs du Super Admin** | Module PUR `lib/regulatory/structural-fields.ts` (`STRUCTURAL_FIELDS`, `canSetStructural`, `structuralChanges`, `structuralRefusal`, `structuralNotice`) + `structural-fields.test.ts` (17 tests). Verrou posé sur les **quatre** portes de `lib/actions/regulatory-actions.ts` : `updateRegulatoryProduct` (helpers `guardStructural` / `notifyCarrierOfStructural`), `setRegulatoryResponsible`, `setRegulatoryClassification` (partie `companyId`) et `setVariationStatus` à « OBTENUE » (porte dérobée du statut de fabrication). Côté écran : `LockedField` dans `app/(app)/regulatory/edit-product.tsx`, prop `canSetStructural` de `regulatory-table.tsx`. |
| **Regulatory — porter un dossier ouvre le module** | Module PUR `lib/regulatory/assignment.ts` (`carrierAccess`, `assignmentNotice`, `assignmentWarning`) + `assignment.test.ts` (13 tests) ; accès implicite résolu dans `getAccess` (`lib/rbac.ts`) ; exception au filtre de gamme dans `lib/queries/regulatory-rows.ts` (`NAMED_ON_DOSSIER`). |
| **Regulatory — verrou (cadenas)** | `RegulatoryProduct.isLocked` ; `lib/rbac.ts` → `lockGate` (dans `scopeRegulatory`) + `regulatoryLockWhere` pour les lectures hors portée (`queries/stock.ts`, `actions/pch-tender-line-actions.ts`, `admin/users/[id]`, portail fournisseur) ; `setRegulatoryLock` / `unlockAllRegulatory` ; cadenas et bandeau dans `app/(app)/regulatory/regulatory-table.tsx`. Tests dans `rbac.test.ts`. |
| **Moyens généraux — corriger / supprimer une dépense** | `updateDepartmentExpense` + `deleteDepartmentExpense` (`lib/actions/department-budget-actions.ts`, garde `canAmendExpense`) ; `pettyCashBalanceExcluding` (`lib/petty-cash.ts`, pure + tests) ; `app/(app)/moyens-generaux/expense-row-actions.tsx`. Totaux exacts (`groupBy` par nature, `expenseCount`, `truncated`, `otherConsumed`) dans `lib/queries/general-means.ts`. |
| **Moyens généraux — catalogue & ticket multi-articles** | `lib/general-means/receipt.ts` (pur : `normalizeLines`, `receiptTotal`, `validateReceipt`, `receiptLabel`, `parseLinesField`) + `receipt.test.ts` (20 tests) ; `lib/general-means/expense-lines.ts` (`readReceipt`, `saveReceiptLines`, partagé par les deux actions) ; modèle `DepartmentExpenseLine` ; `app/(app)/moyens-generaux/receipt-lines.tsx` ; catalogue `OfficeSupplyArticle` + `SuppliesManager` réutilisé depuis `app/(app)/demandes/`. |
| **Regulatory — import d'un classeur** | `lib/regulatory/sheet-import.ts` (pur : `mapSheetRow`, `parseDosage`, `formOf`, `splitProduct`, `stripContainerSize`…) + `sheet-import.test.ts` (34 tests) ; générateur `scripts/gen-selection-pf-migration.ts` ; source `data/selection-pf-produits.xlsx` ; migration `prisma/migrations/20260812110000_selection_pf_products/`. |
| **Entités, gammes & produits** | Modèles `ProductRange` / `UserProductRange` + `RegulatoryProduct.rangeId` ; module PUR `lib/org/product-ranges.ts` (`companyIdsFromRanges`, `restrictingRangeIds`, `productRangeWhere`, `canSeeProduct`, `buildRangeTree`) + `product-ranges.test.ts` (18 tests) ; `lib/company.ts` → `productRangeScope` (composé dans `queries/regulatory-rows.ts` et `queries/product-catalog.ts`) ; `AccessBearer.rangeGrants` dans `lib/company-access.ts` ; `lib/actions/product-range-actions.ts` ; écran `app/(app)/admin/gammes/` (`page.tsx` + `ranges-manager.tsx`). |
| **Cloisonnement d'entité (portée validée)** | `lib/company.ts` → `currentCompanyWhereFor(userId)` (**remplace** `currentCompanyWhere()`, qui posait le cookie tel quel), `myCompanyScope`, `myCompanyWhere`, `platformScope`, `getMyCompanies` ; règles pures dans `lib/company-access.ts` (`allowedCompanyIds`, `resolveScope`, `platformScopeWhere`) ; `setCompanyScope` refuse une entité hors droits (`lib/actions/company-actions.ts`) ; `components/layout/company-switcher.tsx` (pas de menu quand on n'a qu'une entité). |
| **Explorateur Drive dans un formulaire** | `lib/actions/drive-browse-actions.ts` (`browseDrive`, lecture seule via `getDriveListing`) ; `components/drive/drive-picker.tsx` (`DrivePickerField`) ; type de champ `drivepicker` dans `components/shared/create-record-button.tsx` ; pièces jointes de création via `attachFormFiles` (`lib/documents.ts`). |
| **Bureautique — papier en-tête** | Modèle `OfficeLetterhead` ; module PUR `lib/office/letterhead.ts` (`canManageLetterheads` — **assistante de direction + Super Admin, et personne d'autre** : la Direction et le DG en ont été retirés, ils signent les courriers, ils ne tiennent pas la papeterie ; CHOISIR un en-tête à la création reste ouvert à tous —, `validateLetterheadFile`, `letterheadsFor`, `documentName`) + `letterhead.test.ts` (15 tests) ; `lib/actions/letterhead-actions.ts` (téléverser / renommer / retirer / supprimer) ; `lib/queries/letterheads.ts` (`letterheadContextFor`) ; `components/office/letterhead-choice.tsx` (Vierge / Avec en-tête) ; `app/(app)/office/letterhead-manager.tsx`. `createOfficeNode` recopie les OCTETS du modèle (voir circuit). |
| **Tâches demandées (accepter / faire / valider)** | `Task.requestedAt|respondedAt|declineReason|completionNote` + `TaskComment` (le fil) ; module PUR `lib/tasks/request-flow.ts` (**`taskCreationMode`**, **`creationNotices`**, `canRespond`, `canDoWork`, `canSee`, `canAttach`, **`canComment`**, **`taskActions`**, `requestStage`, `declineSummary`) + `request-flow.test.ts` (43 tests) ; **cœur partagé `lib/tasks/create-core.ts`** (`createTaskRecord` : statut/`requestedAt` selon le mode + notifications pop-up/cloche + audit — consommé par l'action écran ET par l'assistant, une seule logique du circuit) ; `lib/actions/task-actions.ts` (`createTask` — porte UNIQUE, `respondTaskRequest`, `submitTaskWork`, `reopenTaskWork`, `addTaskComment`) ; dossier `app/(app)/mon-espace/taches/[id]/` (+ `work-panel.tsx`, `comments.tsx`) ; cas `TASK` dans `lib/entity-access.ts`. |
| **Demandes de paiement** | Les écrans vivent sous `app/(app)/validations/paiements/` (`page.tsx`, `[id]/page.tsx` + `dossier.tsx`, `new-payment-button.tsx`) ; `app/(app)/finances/paiements/**` sont des **redirections**. Pas de bouton « retour aux Finances » : la page est **ouverte à tout le monde** (n'importe qui peut avoir une facture à faire payer) alors que le module Finances ne l'est pas — le bouton menait donc la plupart des gens vers un refus. Les Finances les voient depuis **leur propre module**. `lib/queries/finance-people.ts` (`financeRecipients`) ; garde **nominative** `PAYMENT_REQUEST` dans `lib/entity-access.ts` (demandeur / destinataire / Finances — elle tranche avant la porte du module, donc elle a survécu aux deux déménagements sans changer) ; règles pures dans `lib/finance/payment-request.ts`. **CE QU'UNE DEMANDE DOIT PORTER POUR PARTIR** (`lib/finance/payment-dossier.ts`, pur, 15 tests) : un **bon de commande OU une facture** (`JUSTIFYING_KINDS` — le devis et le bon de livraison accompagnent, ils ne justifient pas) **et** la case `paymentMethodStated` (« le moyen de paiement figure dans le document »). Le reste — autres PJ, notes, `contactName|Phone|Email` — reste facultatif. **EXEMPTION** : un **bon de versement** (`entityType = MEDICAL_INFO_DECLARATION`, posé **à la création**) part sans pièce — la quittance n'existe qu'après le versement, et le BV a déjà été validé en amont. La MÊME fonction garde le formulaire (`dossierHint`), l'action (`createPaymentRequest`), le renvoi (`canResubmit`) et le bon à payer (`canApprove`). **NATURE DE L'ÉCHÉANCE** (`lib/finance/deadline-nature.ts`) : `FIXED` / `IMPORTANT` / `MODERATE` — elle classe `sortByPriority`, voyage jusqu'à `ExpenseOrder.deadlineNature`, et exige un motif pour reporter un paiement. |
| **Moyens généraux — caisse ou hors caisse** | Module PUR `lib/general-means/payment-source.ts` (`sourceOf`, `cashAvailable`, `resolveSource`, `sourceChange`, `defaultSource`) + `payment-source.test.ts` (15 tests) ; `addDepartmentExpense` / `updateDepartmentExpense` acceptent `paymentSource` (`lib/actions/department-budget-actions.ts`) ; `app/(app)/moyens-generaux/{expense-panel,expense-row-actions}.tsx`. Le volet « dépense » de `cash-panel.tsx` a été **retiré** : un seul bouton. |
| **Moyens généraux — demande d'achat (tous)** | Module PUR `lib/general-means/purchase-request.ts` (`cleanLines`, `estimatedTotal`, `summarize`, `purchaseStage`, `canWithdraw`) + `purchase-request.test.ts` (20 tests) ; `lib/actions/purchase-request-actions.ts` (validateur = **N+1 résolu par `getManagerOfUser`**) ; `app/(app)/moyens-generaux/{purchase-section,purchase-request-form,my-purchase-requests}.tsx`. La demande est une `AdministrativeRequest` de type `PURCHASE`. |
| **Paie — correction d'une ligne** | Module PUR `lib/hr/payroll-amend.ts` (`validateAmounts` — partagé avec le marquage —, `resolvedGross`, `amendImpact`, `canAmend`) + `payroll-amend.test.ts` (16 tests) ; `updatePayrollEntry` (`lib/actions/payroll-hr-actions.ts`, reprend l'écriture de trésorerie liée) ; `app/(app)/rh/paie/payroll-matrix.tsx`. |
| **Recrutement (circuit complet)** | Modèles `RecruitmentRequest` · `RecruitmentApproval` · `RecruitmentInfoRequest` · `RecruitmentCandidate` ; enums `RecruitmentStage` / `RecruitmentApprovalState` / `RecruitmentCandidateStatus` ; `ContractType.CONSULTING`. Module PUR `lib/recruitment/request-flow.ts` (`contractNeedsEndDate`, **`needsOnboarding`**, `currentStep`, `canDecideStep`, `applyChainDecision`, `chainProgress`, `abilities`, `canSelectCandidate`, `validateDraft`, `summarize`, `salaryRange`) + `request-flow.test.ts` (32 tests) ; `lib/recruitment/access.ts` (`recruitmentViewer`, `recruitmentScope` — la même règle pour la liste et pour la fiche) ; `lib/actions/recruitment-actions.ts` (chaîne bâtie par `getManagementChain`, **figée** à la soumission) ; `app/(app)/recrutement/` (`page.tsx`, `new-request.tsx`, `[id]/page.tsx` + `panels.tsx`). Module RBAC `RECRUITMENT` + `recruitmentAccessFor` (accès dicté par l'**organigramme**, pas par une liste de rôles). Types d'entité `RECRUITMENT_REQUEST` / `RECRUITMENT_CANDIDATE` dans `lib/entity-access.ts`. |
| **Congés — intérimaire** | `LeaveRequest.standInId|standInStatus|standInModules|standInDecidedById|standInDecidedAt|standInNote` + enum `StandInStatus`. Module PUR `lib/hr/stand-in.ts` (`isDelegatable`, `normalizeDelegated`, **`isDelegationActive`**, `inactiveReason`, `delegatedActions`, `delegationsFor`, `actsFor`, `delegationNotice`) + `stand-in.test.ts` (25 tests) ; `lib/hr/stand-in-resolve.ts` (`activeStandInsFor`, `actsForUser`, `standInForUserIds`) ; grant implicite dans `getAccess` (`lib/rbac.ts`) ; garde d'intérim dans `decideValidationStep` (`lib/actions/validation-actions.ts`) ; `lib/actions/stand-in-actions.ts` ; `components/hr/stand-in-panel.tsx` (désignation + décision RH). |
| **Assistant — export Excel & réglages** | `lib/assistant/admin-write.ts` (**liste blanche** : `WRITABLE_SETTINGS`, `WRITABLE_REG_FIELDS`, `parseSettingValue`, `parseRegFieldValue`, `renderSettingValue`) + `admin-write.test.ts` (22 tests) ; `lib/assistant/exports.ts` (`DATASETS`, `canExport`, `exportDatasetToDrive` → Drive personnel, dossier « Exports IA ») ; outils `export_excel`, `read_platform_settings`, `update_platform_setting`, `update_regulatory_product` + les deux `AssistantActionPayload` correspondants dans `lib/assistant.ts`. |
| **Regulatory — relance de mise à jour** | Modèle `RegulatoryUpdateReminder` (une ligne **par destinataire**, même pour une relance groupée) ; module PUR `lib/regulatory/update-reminder.ts` (`canSendUpdateReminder`, `isStaleDossier`, `remindedRecently`, `reminderTargets`, messages) + `update-reminder.test.ts` (21 tests) ; `lib/queries/regulatory-reminders.ts` (**mêmes chiffres à l'écran et à l'envoi**) ; `lib/actions/regulatory-reminder-actions.ts` ; `app/(app)/regulatory/update-reminder.tsx`. |
| **Courriers — direction & personne concernées** | `MailEntry.departmentId|concernedUserId` ; `lib/queries/mail-routing.ts` (menus partagés liste ↔ fiche) ; `diffMailAssignments` + `MAIL_ASSIGNMENT_FIELDS` dans `lib/mail-register/trace.ts` (journal **par le nom**, jamais par l'identifiant) ; `resolveAssignments` dans `lib/mail-register/write.ts` ; colonne « Concerne » filtrable dans `app/(app)/courriers/mail-table.tsx`. |
| **Masquer / démasquer un module** | Module PUR `lib/modules-visibility.ts` (`NEVER_HIDDEN`, `isHideable`, `normalizeHidden`, `visibleModules`, **`canOpenModule`**) + `modules-visibility.test.ts` (17 tests) ; `AppSetting.hiddenModules` ; garde d'adresse dans `requireModule` (`lib/session.ts`) et filtre de menu dans `app/(app)/layout.tsx` ; `setHiddenModules` + `HiddenModulesForm` (Administration). |
| **Catalogue d'articles — écriture uniforme** | Module PUR `lib/general-means/catalog-normalize.ts` (`normalizeArticleName`, `articleKey`, `normalizeReference`, `normalizeToCode`, `normalizeArticle`, `needsRewrite`, `describeRewrite`, `CATEGORY_ALIASES`, `UNIT_ALIASES`) + `catalog-normalize.test.ts` (23 tests) ; normalisation + **refus du doublon** dans `lib/actions/office-supply-actions.ts` ; `previewCatalogNormalization` / `applyCatalogNormalization` (on montre avant d'appliquer) ; `NormalizePanel` dans `app/(app)/demandes/supplies-manager.tsx`. |
| **Legal — dossiers de classement** | Modèle `LegalFolder` + `LegalDocument.folderId` (`ON DELETE SET NULL` : on déclasse, on ne détruit pas) ; module PUR `lib/legal/folders.ts` (`buildFolderTree`, `flattenFolders`, `folderPath`, `subtreeIds`, `canReparent`, `deletionSummary`) + `folders.test.ts` (17 tests) ; `lib/actions/legal-folder-actions.ts` ; `app/(app)/legal/folder-bar.tsx` ; champ `folderId` dans `legal-fields.ts`. |
| **Legal — coordonnées légales & fiscales** | Modèle `CompanyLegalIdentity` + `EntityType.COMPANY` ; module PUR `lib/legal/identity.ts` (`IDENTITY_SECTIONS`, `identityBlock`, `filledCount`) + tests ; `lib/actions/company-identity-actions.ts` ; `app/(app)/legal/identites/`. |
| **Siège nommé au centre de paiement** | `PaymentCentreSeat` (userId unique, `grantedById`, `grantedAt`, `note` obligatoire) ; règle dans `sitsOnPaymentCentre` ; résolution **une fois par requête** dans `getAccess` → `EffectiveAccess.paymentCentreSeat` (la règle est SYNCHRONE et appelée depuis l'écran, l'action, l'assistant et la recherche — elle ne peut pas lire la base), qui ouvre AUSSI le module `PAYMENT_CENTRE` (un droit qu'on n'atteint qu'en connaissant l'URL n'est pas un droit accordé) ; actions `grantPaymentCentreSeat` / `revokePaymentCentreSeat` (`lib/actions/payment-centre-seat-actions.ts`, **Super Admin seul** — siéger ne donne pas le droit d'élargir le cercle) ; écran `app/(app)/admin/access/payment-centre-seats.tsx`, qui montre les deux titres ENSEMBLE (rôle + désignation). **EXCLUDED de la parité Adam** : accorder cette autorisation, c'est donner le pouvoir d'engager l'argent de la société (§118-15). Refusés : compte système, compte désactivé, et ceux qui y siègent déjà par leur rôle. Migration `20261007090000_…`. |
| **Règlement — trois états** | Module PUR `lib/finance/settlement.ts` (`settlementState` · `checkDeferral` · `deferralNote` · `sortForSettlement`, 22 tests) : **non payé** (défaut) / **reporté à une date** / **payé**. Le report est une **DATE** (`ExpenseOrder.deferredUntil|deferredReason|deferredById|deferredAt`), jamais un statut — il **expire seul**, sans que personne ait à y penser, et l'ordre reste **dans la file**. Actions : `deferExpenseOrder` / `resumeExpenseOrder` (`lib/actions/expense-actions.ts`) ; ops Adam `defer_payment` / `resume_payment`. **SUPPRIMÉS** (écran + action + op) : `cancelExpenseOrder`, `requestBudgetRevision`, `resolveBudgetRevision` — l'ordre arrive autorisé par le centre, le rouvrir à la caisse défait une décision prise ailleurs (§118-7 : pas de porte dérobée). Migration `20261006090000_…` : les ordres `REVISION_REQUESTED` repassent `PENDING`, motif recopié en notes. |
| **Centre de paiement (guichet unique)** | Module PUR `lib/payments/authorization.ts` (`needsCentralAuthorization` — **toujours vrai**, `initialCentralStatus`, **`canDisburse`** — le verrou réel —, `visibleToFinance`, `isHighValue` + `CENTRAL_AUTH_THRESHOLD_DZD` = 50 000 **en marqueur, plus en filtre**, `sitsOnPaymentCentre` (**`SUPER_ADMIN`, `DIRECTION`, ou un SIÈGE NOMMÉ** — pas le DG par son rôle), `PAYMENT_CENTRE_REFUSAL` (le refus, écrit une seule fois), `applyDecision`, `applyResubmission`, `blockedReason`) + `authorization.test.ts` (18 tests) ; `ExpenseOrder.centralStatus|proposedAmount|decidedById|decidedAt` + `PaymentCentreMessage` ; `createExpenseOrder` calcule le statut d'entrée et notifie `DIRECTION` + `SUPER_ADMIN` (`lib/expense-orders.ts`) ; **la demande de paiement crée son ordre à la SOUMISSION** (`lib/actions/payment-request-actions.ts`) ; garde dans `markExpenseOrderPaid` (`lib/actions/expense-actions.ts`) ; `lib/actions/payment-centre-actions.ts` ; `app/(app)/centre-de-paiement/`. Migrations `20260824150000_payment_centre` puis `20261002140000_centre_guichet_unique`. |
| **Matériel promo — circuit court** | Module PUR `lib/promo-material/circuit.ts` (`PROMO_STEPS` (7), `PROMO_TRACKS` (`PURCHASE_ORDER`/`PAYMENT`/`AD_VISA`), `initialStep` — saute la demande de devis si le devis est déjà là —, `canValidate` (N+1 réel : `Employee.managerId`, à défaut `departmentRef.head`), **`seesFullCircuit`** (Super Admin + PDG **uniquement**), `tracksOpen`, `allTracksDone`, `pendingTracks`, `progress`, `waitingOn`) + `circuit.test.ts` (23 tests) ; `lib/actions/promo-circuit-actions.ts`. |
| **Rejeu de session (support)** | Module PUR `lib/replay/capture.ts` (`FORBIDDEN_FIELD` — mot de passe / secret / jeton / IBAN / RIB / CVV / carte —, `FORBIDDEN_INPUT_TYPE` — `password`, `hidden` —, `fieldIsRecordable`, `isSensitiveLabel`, `cleanLabel`, `scrubDetail`, **`makeEvent` : la porte d'entrée UNIQUE**, `coalesce`, `describeEvent`, `stamp`, `firstErrorIndex`) + `capture.test.ts` (20 tests) ; modèle `SessionEvent` ; `components/layout/session-recorder.tsx` (monté dans `app/(app)/layout.tsx`, `sendBeacon`, **ne lit jamais `.value`**) ; `app/api/replay/route.ts` (**re-masque côté serveur**, 204 systématique, lot plafonné à 200) ; `app/(app)/admin/replay/{page,replay-viewer}.tsx` (**`SUPER_ADMIN` seul**). |
| **Courriers — dossiers & pièces multiples** | Modèles `MailFolder` (arbre, `MailEntry.folderId` en `ON DELETE SET NULL`) et `MailEntryPiece` (intitulé + **destinataire propre** + fichier téléversé **ou** nœud Drive référencé) ; `lib/actions/mail-folder-actions.ts`, `lib/actions/mail-piece-actions.ts` ; `app/(app)/courriers/mail-folder-bar.tsx`, `app/(app)/courriers/[id]/mail-pieces.tsx`. |
| **Suppression par le créateur** | `CREATOR_DELETABLE` = `MAIL_ENTRY`, `LEGAL_DOCUMENT` ; `CREATOR_DELETE_PERMISSION` (le droit `DELETE` du module reste exigé) ; `snapshotAndSoftDelete` (instantané dans la **corbeille** avant destruction) et `deleteOwnRecord` dans `lib/actions/admin-delete-actions.ts` ; `components/shared/record-delete-button.tsx`. |
| **Annuaires (praticiens & entreprise)** | Praticiens : `app/(app)/medical/annuaire/directory-bar.tsx` + `lib/actions/medical-directory-crud-actions.ts` (créer / renommer / supprimer — la suppression **déplace** les praticiens ; à ne pas confondre avec `medical-directory-actions.ts`, qui porte l'import et l'édition de la grille). Entreprise : module PUR `lib/contacts/kinds.ts` (+ tests) ; `lib/actions/company-contact-actions.ts` ; `app/(app)/moyens-generaux/annuaire/{page,contacts-board}.tsx`. |
| **Coordonnées d'entité — documents nommés** | Module PUR `lib/legal/company-docs.ts` (+ tests) : la liste de noms **empruntée au CTD** a été retirée, le document se nomme librement. |
| **Chaîne du dossier d'achat (Legal)** | `LegalDocKind` + `QUOTE`/`INVOICE` ; `LegalDocument.chainFromId` (auto-relation « fait suite à », `SET NULL`) + `expenseOrderId` (le règlement) ; module PUR `lib/legal/chain.ts` (`CHAIN_KINDS`, `chainOf` — le fil de LA pièce regardée, jamais un graphe mélangé —, `missingKinds`, `delayDays`/`delayLabel`, `amountDrift`) + `chain.test.ts` (10 tests) ; chargement borné `lib/queries/legal-chain.ts` (`loadLegalChain` : maillons + validateurs + règlement) ; `app/(app)/legal/[id]/{chain-card,send-to-settlement}.tsx` ; `sendLegalInvoiceToSettlement` dans `legal-actions.ts` (→ `createExpenseOrder`, centre de paiement). |
| **My Chief of Staff (module exécutif)** | Module RBAC `CHIEF_OF_STAFF` (PDG + Super Admin) ; page `app/(app)/chief-of-staff/page.tsx` (réutilise `AssistantChat` avec `executive` + entrée contextuelle `?ref=`/`?q=`) ; outils `lib/assistant/executive-tools.ts` (`search_drive`, `read_document` — droit du Drive nœud par nœud —, **`inspect_record`** universel — paiements, règlements, Legal + chaîne, promo, secrétariat, Regulatory, factures, courriers, projets, tâches —, `person_report`, rappels, `executiveBriefing`) + `executive-read-tools.ts` (**`search_everything`**, `read_calendar`, `find_free_slot`, `read_stock`, `search_hospitals`, `read_employee`, `read_payroll`, `search_courriers`, `finance_totals` — chacun ouvert par le DROIT de l'écran) + `executive-brief-tools.ts` (**`executive_alerts`** ← `lib/assistant/proactive.ts`, **`executive_brief`**, **`create_report`** .docx → Drive) fondus dans `POWER_TOOLS` ; actions confirmées dans `lib/assistant.ts` : `decide_payment` (SENSITIVE), `update_task`, `update_request`, `create_legal_document`/`update_legal_document`, `update_calendar_event`, `create_hospital`/`update_hospital`, **`update_salary` (CRITICAL : `level` + `confirmText`, re-saisie du montant, verrou de fraîcheur)** ; tests adversariaux `lib/assistant/executive-security.test.ts` ; recherche fédérée `lib/queries/search-everything.ts` (unaccent/pg_trgm sondés, repli LIKE) ; architecture : `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`. |
| **Executive AI Operating System (CdS lots A–F)** | Gouvernance : `ACTION_POLICY` + arrêt d'urgence `aiExternalActionsDisabled` dans `lib/assistant.ts` (+ `lib/settings.ts`, `lib/assistant/admin-write.ts`), relances suspendues dans `lib/assistant/reminders.ts` (`watchState` = surveillance conditionnelle, propriétaire seul), cartes groupées `AssistantResult.proposals` (+ « Tout confirmer » dans `assistant-chat.tsx`, CRITIQUES exclues) ; mémoire typée `lib/assistant/memory-context.ts` (`typedMemoryContext`, `expandQueryWithAliases`) + `memory-tools.ts` (remember/list/forget, recall_conversation, décisions `ExecutiveDecision`, engagements `ExecutiveCommitment`) + fil principal `ensurePrimaryThread`/plafond dans `lib/assistant-memory.ts` ; vues 360° `lib/assistant/three-sixty.ts` (employee/product/supplier_360, organization/process_insights — âge calculé backend avec source, salaire derrière le module RH) ; découverte Drive sale `lib/assistant/document-discovery.ts` (`find_documents`, index progressif `DriveTextIndex` nourri par `read_document`) ; simulation/état `lib/assistant/what-if.ts` (`simulate_scenario` jamais mutatif, `company_state`, `ceo_attention`) + bandeau « Aujourd'hui » dans `chief-of-staff/page.tsx` ; livrables `lib/assistant/deliverables.ts` (DOCX/XLSX/PPTX d'une même spec, registre `AssistantArtifact`, Drive « Livrables IA ») ; corpus généralisé `lib/assistant/corpus-tools.ts` (catégories + arabe المادة dans `regulatory/intelligence/corpus/{import,ingest-file,rag}.ts`) ; anomalies dans `lib/assistant/proactive.ts` (doublon facture, montant outlier). Tests : `memory-tools.test.ts`, `three-sixty.test.ts`, `deliverables.test.ts`, `corpus-tools.test.ts`, `executive-security.test.ts` (kill-switch). |
| **Voix du Chief of Staff — appel temps réel (speech-to-speech)** | Serveur : `lib/assistant/voice-realtime.ts` (`canUseRealtimeVoice`, `realtimeToolsFor` — adaptateur PowerTool→Realtime, ~25 fast paths + délégation —, `buildVoiceInstructions` — contexte commun compact + fil récent borné + **contexte d'écran borné 300 c.** + consignes vocales —, `createVoiceSessionGrant` — secret éphémère via `/v1/realtime/client_secrets`, clé jamais exposée) + routes `app/api/assistant/voice/{session,tool,turn,log}/route.ts` (droit RE-vérifié à chaque appel d'outil ; tours persistés par `rememberExchange`). Client : `app/(app)/assistant/realtime-voice.ts` (`VoiceRealtimeProvider` → `OpenAIGptRealtime21Provider` : WebRTC, barge-in + purge tampon, **outils en parallèle** + discipline une-réponse-active, `sendContext`) ; **appel GLOBAL** `components/layout/call-provider.tsx` (monté dans `app/(app)/layout.tsx` : survit à la navigation, minuterie à la connexion réelle, carte flottante réduite, Échap = réduire, cartes live, contexte d'écran par `usePathname`, **résumé d'appel factuel** au raccrochage, pont tamponné vers le chat) ; écran présentationnel `voice-mode.tsx` (`CallScreen` : plein écran mobile / modal desktop, ● LIVE honnête, TYPE dans l'appel, Mute/Raccrocher/Clavier). Entrée `?call=1&ref=` (`chief-of-staff/page.tsx` → `initialCallRef`) + bouton « Appeler » (`components/shared/ask-chief.tsx`). La dictée (`/api/assistant/transcribe`) reste le repli. Tests : `voice-realtime.test.ts`. |
| **Time Travel (état passé d'un dossier)** | `lib/assistant/time-travel.ts` — outil **`time_travel`** (EXEC, fast path vocal) : résolution de référence (paiement → règlement → Legal → Regulatory → tâche), reconstruction depuis `AuditLog` (dernière écriture ≤ date / `oldValue` de la première écriture > date), événements avant + **changements depuis + état actuel en face**, étapes ANPP à la date pour un dossier Regulatory, « n'existait pas encore » si créé après. **STRICTEMENT lecture seule** (prouvé par `time-travel.test.ts` : le journal ne bouge pas d'une ligne). |
| **Action intents (état canonique des actions IA)** | Modèle `AssistantActionIntent` (statut PROPOSED→CONFIRMED→EXECUTING→EXECUTED/FAILED/CANCELLED, `events` = historique d'autorisation, cloisonné par `userId`) ; `lib/assistant/action-intents.ts` (`persistActionIntents` — appelé dans les DEUX boucles de `lib/assistant.ts` à chaque proposition —, `executeIntentGuarded` — réclamation atomique + idempotence + reçu, payload STOCKÉ exécuté —, `cancelActionIntent`, `recentActionIntentsContext` injecté texte + voix, outil **`action_history`**) ; `executeAssistantAction(payload, intentId?)` + `cancelAssistantAction` (`lib/actions/assistant-actions.ts`) ; cartes UI passent `intentId` (`assistant-chat.tsx`). Migration `20260825150000_action_intents`. Tests : `action-intents.test.ts`. |
| **Voix — barge-in NATIF & VAD pour hésitations FR** (audit 2026-08) | Interruption NATIVE : `interrupt_response: true` par défaut (`voice-tuning.ts` → `buildTurnDetection` ; le serveur coupe dès qu'il entend la parole) + `semantic_vad eagerness "low"` (hésitations françaises). Module PUR `lib/assistant/voice-tuning.ts` (`bargeInDecision` STT-INDÉPENDANT — mots = accélérateur, parole **soutenue ≥ 180 ms** = coupure MÊME en plein son ; `BARGE_IN_SUSTAIN_MS` 400→**180**, `BARGE_IN_NOISE_MS` 350→**140**). C'est le correctif de « je parle et Adam continue de parler » : plus de dépendance à la transcription (l'ancienne « auto-protection écho » qui exigeait des mots retardait la vraie coupure). La robustesse à l'écho revient à l'annulation d'écho du navigateur + `semantic_vad`. Provider `app/(app)/assistant/realtime-voice.ts` : coupure = `response.cancel` + `output_audio_buffer.clear` + `conversation.item.truncate`, debounce un segment = une coupure, filtre bruit + `conversation.item.delete`. Voix par défaut **`cedar`** (masculine, naturelle GA) via `DEFAULT_REALTIME_VOICE` (`OPENAI_REALTIME_VOICE` surcharge). Repli mesuré `OPENAI_VOICE_INTERRUPT=client` (rend l'interruption au client) si un écho réel coupait Adam. Journal `voice_false_barge_in_ignored` / `voice_barge_in_confirmed`. Tests : `voice-tuning.test.ts`, `voice-pipeline.test.ts`, **`voice-scenarios.test.ts`** (les 8 scénarios demandés). Détail : `docs/ADAM_VOICE_CONTEXT_REPORT.md` §10. |
| **Voix — propriété de la réponse (restitution garantie)** | Chaque résultat d'outil = une OBLIGATION `PendingDelivery` (WAITING_TOOL → READY → DELIVERING) dans le provider `app/(app)/assistant/realtime-voice.ts` : réponses suivies PAR ID (`response.created`/`done`), collision `conversation_already_has_active_response` replanifiée (jamais perdue), watchdog déterministe (`deliveryWatchdogAction` + `DELIVERY_WATCHDOG_GRACE_MS`/`TICK`/`MAX_ATTEMPTS` dans `lib/assistant/voice-tuning.ts`), complétion MUETTE détectée + relancée, RESULT_READY pendant la parole utilisateur (livraison en fin de tour), résultat orphelin PERSISTÉ au fil (`persistOrphanResult` dans `call-provider.tsx` → `/api/assistant/voice/turn`, texte de repli `deliveryFallbackText`), événements périmés ignorés (marqueur réponses annulées survivant au done). Métriques `pending_turn_created/ready/delivered` (latence job→voix), `silent_completion_detected`, `watchdog_recovered`, `delivery_failed`, `stale_event_ignored` → journal `/api/assistant/voice/log` + compteurs de `voice_session_closed` (les 2 SLO). Tests : `voice-pipeline.test.ts` (16 golden sur le vrai `handleEvent`). |
| **Executive AI — lectures Regulatory canoniques & résolution d'entités** | `lib/queries/regulatory-rows.ts` : `regulatoryVisibleWhere` = LA clause de périmètre unique (écran + outils + export — screen parity par construction). `lib/assistant/regulatory-read.ts` : `regulatory_workload` (responsable DÉSIGNÉ ≠ assiste ≠ simple accès, vue d'équipe sans personne), `regulatory_portfolio` (partenaire résolu par graphies/sigles, ambiguïté remontée), `assigneeRegulatoryLoad` partagé avec `employee_360`, `dossierStageLabel` (étape logique, « TERMINÉ » à 22/22). `lib/assistant/entity-normalize.ts` (PUR) : repli + recollage de sigles + initiales (acronymes) + recouvrement → `resolveOrg` decisive/ambiguous/none, jamais de fusion muette. Fix invariant `regProgress`/`completeStepsThrough` dans `lib/regulatory-workflow.ts`. Tests : `regulatory-read.test.ts`, `entity-normalize.test.ts`, invariants dans `regulatory-workflow.test.ts`. |
| **Executive AI — planner, investigations & CRUD Regulatory** | Planner PUR `queryPlan`/`queryPlanContext` (`lib/assistant/reasoning.ts`) : domaine/intention par motifs repliés, suivi elliptique hérité, besoins historique/investigation — injecté dans les deux boucles de `lib/assistant.ts` (+ log `query_plan`). `lib/assistant/investigation.ts` : `investigate_event` (8 sources parallèles, acronymes contre organisations réelles, `couverture` rendue) + `inspect_drive_folder` (récursif borné 6×400, déposants `FileVersion.createdById`, BC stricts/assimilés/non-classés, indexation à la volée bornée, ACL nœud par nœud). Écritures : kinds `assign_regulatory_responsible` + `set_regulatory_step` (proposition → exécution par les actions CANONIQUES `setRegulatoryResponsible`/`setRegulatoryStepState`/`setRegulatoryPresubOutcome`) ; règle « demande à X = tâche » + anti-« aucune trace » + arrêt intelligent dans BUSINESS_SEMANTICS. Tests : `investigation.test.ts`, `regulatory-write.test.ts`, planner dans `reasoning.test.ts`. |
| **Executive AI — sémantique Drive & livrables téléchargeables** | `lib/assistant/semantic-drive.ts` : vecteurs 512d JSONB (`DriveTextIndex.embedding`, migration `20260825200000_drive_semantic`) + cosinus en mémoire avec cache estampillé (pgvector indisponible — même pattern que `corpus/semantic.ts`), `embedDriveIndexEntry`/`embedDriveBacklog` (phase 3 du sweep d'ingestion, jamais bloquant), `driveSemanticCandidates` injectable pour les tests ; `find_documents` replie sur le SENS quand aucun candidat fort par le contenu (confiance « SENS », couverture honnête). Livrables : `telechargement: /api/drive/<id>/raw` sur chaque fichier (draft_deliverable + list_artifacts), cellules dates réelles + numériques dans `renderXlsx`, export Regulatory 17 colonnes (`lib/assistant/exports.ts`). Chat : `LinkifiedText` (chemins internes cliquables, /api/drive/…/raw en téléchargement) dans `assistant-chat.tsx`. Tests : `semantic-drive.test.ts` (banc Recall fixtures), `deliverables.test.ts`. |
| **GOD MODE — ingestion Drive, diff temporel, mémoire épisodique fédérée** | Ingestion documentaire PLANIFIÉE : `lib/assistant/drive-ingestion.ts` (`runDriveIngestionSweep` appelé par `lib/scheduled.ts` — phase 1 : fichiers jamais indexés `textIndex: null` ≤ 8 Mo, phase 2 : ré-indexation des index les plus anciens si la version a changé ; index-témoin sur fichier illisible pour ne pas boucler ; débrayage `ASSISTANT_DRIVE_INGESTION=off`) + classification DÉTERMINISTE `lib/assistant/drive-classify.ts` (module PUR : nom = indice 1 pt, contenu = preuve 3 pts, 12 natures, spécificité à égalité, « unknown » honnête) → `DriveTextIndex.docKind` (migration `20260825160000_drive_ingestion`), filtre `kind` + `typeDetecte` dans `find_documents` (ACL revérifiée nœud par nœud à la recherche) ; **`what_changed`** (`lib/assistant/what-changed.ts`, EXEC) : « qu'est-ce qui a changé depuis lundi ? » — diff `AuditLog` depuis une date (`parseSince` AAAA-MM-JJ Alger ou N jours), qui a agi, état actuel en face, absence honnête ; **`episodic_recall`** (`lib/assistant/action-intents.ts`) : rappel fédéré sur les 5 registres épisodiques (intents, rappels, décisions, engagements, artefacts) en parallèle, cloisonné par compte ; bloc AUTO-CONTRÔLE (texte). Tests : `drive-classify.test.ts`, `drive-ingestion.test.ts`, `what-changed.test.ts`, `action-intents.test.ts` (episodic). Doc : section « GOD MODE » de `docs/CHIEF_OF_STAFF_ARCHITECTURE.md` (limites honnêtes incluses). |
| **Maximum intelligence at maximum speed** | États exécutifs PRÉCALCULÉS `lib/assistant/executive-state.ts` (pur : `regulatoryExecutiveState`, `paymentExecutiveState`, `daysSince` — bloqueur dérivé, jours dans l'étape, prochaine étape, signaux) branchés en première clé de `product_360` (`syntheseExecutive`) et `inspect_record` (`etatExecutif`) ; **outils en `Promise.all`** dans les deux boucles de `lib/assistant.ts` ; discipline de preuve + autorité des sources + règle de contradiction dans `CORE_CONDUCT_RULES` (texte + voix) + bloc « PROFONDEUR & VITESSE » (décomposition parallèle, expansion ciblée, synthèse exécutive) ; écart devis→facture calculé (`amountDrift` → `incoherences`) ; **seconde passe critique** (`reviseHighStakes` + `isHighStakesQuestion` dans `lib/assistant/reasoning.ts` — trace « Relecture critique de la conclusion », critique jamais exposée) ; **working set** `conversationWorkingSet` (entités actives, injecté texte + voix via `buildVoiceInstructions`) ; réponse progressive vocale (VOICE_ADDENDUM). Tests : `executive-state.test.ts`, `reasoning.test.ts`, `golden-queries.test.ts` (banc déterministe des vraies questions PDG) ; protocole qualité × latence : `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`. |
| **Rappels planifiés du Chief of Staff** | Modèle `AssistantReminder` (dueAt, `recurrence` NONE/DAILY/WEEKLY/MONTHLY/**MONTHLY_WEEKDAY** — « chaque premier lundi du mois », repli dernière occurrence —, `targetRole` ET/OU **`targetUserId`** — personne nommée, résolue à la création —, `active`) ; module `lib/assistant/reminders.ts` (`nextOccurrence` — retombe le même jour/heure même tiré en retard, rattrape un serveur éteint sans notifier N fois —, `algiersToUtc`, `runAssistantReminders`) + `reminders.test.ts` (13 tests) ; balayage branché dans `lib/scheduled.ts` ; pop-up via `broadcastNotification`, relances via `notifyRoles`/`notifyUser`. |
| **Observabilité IA (boucle agent)** | `AiUsageLog` + `ttftMs` (délai avant le 1er mot), `turns`, `toolCalls`, `toolErrors`, `toolLatencyMs` — mesurés dans `runAssistantStream` (`AssistantMetrics`), journalisés par `/api/assistant/stream` via `logAiUsage` (`lib/ai-settings.ts`). Migration `20260824230000_ai_usage_metrics`. |
| **Drive → « Classer en courrier »** | `attachDriveNodeToMail` (`mail-register-actions.ts` — référence sans copie, refus du doublon) ; `app/(app)/drive/send-to-mail.tsx` (panneau rendu PAR LA LIGNE, hors menu-portail) ; entrée dans `node-actions.tsx`. |
| **Accès par annuaire de praticiens** | Modèle `MedicalDirectoryAccess` (liste vide = ouvert à tout le module) ; `setDirectoryAccess` (`medical-directory-crud-actions.ts` — celui qui restreint reste dedans d'office) ; filtrage dans `app/(app)/medical/annuaire/page.tsx` (pastille masquée, adresse directe en 404, praticiens exclus de la vue « Tous ») ; panneau d'accès dans `directory-bar.tsx`. |
| **RH — contrats : visibilité et miroir Drive** | Module PUR `lib/hr/document-visibility.ts` (`defaultVisibleToEmployee`, `resolveVisibility`, `shouldMirrorToDrive`) + tests ; `lib/hr-drive-mirror.ts` écrit dans une **catégorie de Drive** « RH — Contrats » ouverte aux seuls rôles RH (`rolesWithModule("RH")`), plus dans un Drive personnel. |
| **Finances / budgets** | `lib/actions/finance-actions.ts`, `budget-envelope-actions.ts`, `lib/queries/budget.ts` (`getBudgetCategoryOptions`), `lib/expense-orders.ts`. |
| **Info médicale (PRIM)** | `lib/actions/medical-info-actions.ts` (validation + archive), `lib/medical-info.ts`, `lib/queries/medical-info.ts`. |
| **Transverse** | `lib/archive.ts` (Dossier traité), `lib/admin-delete-registry.ts` (registre partagé des 25 types supprimables) + `lib/actions/admin-delete-actions.ts` (purge + corbeille), `lib/assistant/action-registry.ts` (registre ZERO-GAP des actions natives + classification des 644 server actions — **534 NATIVE / 34 COVERED / 0 GAP / 76 EXCLUDED motivées**, soit 100 % de parité sur les 568 actions retenues ; 493 ops de domaine sur 30 outils dans `lib/assistant/ops/` —, gardé par `action-parity.test.ts` et audité par `assistant/capability-audit.test.ts`), `lib/scheduled.ts` (jobs), `lib/calendar-tz.ts` (fuseau), `lib/calendar.ts` (agenda + réunions projetées), `lib/notify.ts`, `lib/audit.ts`, `lib/refs.ts`, `lib/settings.ts` (AppSetting), `lib/labels.ts` (libellés + NAVIGATION + tabs). |
| **Drive / documents** | `lib/drive-storage.ts` (blobs chiffrés), `lib/drive.ts` (accès + `effectiveSpaceId`/`canCreateInSpace`), `lib/drive/explorer.ts` (pur : type lisible, taille, tri, volet), `lib/drive/search.ts` (**pur** : repli des accents, pertinence, chemin lisible — 29 tests) + `lib/queries/drive-search.ts` (périmètre étendu aux sous-arbres visibles, deux passes) + `app/(app)/drive/drive-search.tsx`, `lib/drive/{mirror,mirror-path,document-mirror}.ts` (miroir Drive de tout import), `lib/storage.ts` (Documents + `validateDocumentUpload`), `lib/documents.ts` (`persistUploadedDocument`), `lib/attach-files.ts`, `lib/actions/drive-actions.ts` + `document-actions.ts`, `app/api/drive/upload/route.ts` (quotas) + `app/api/documents/upload/route.ts` (lot/dossier, flux, parallèle), `app/(app)/drive/{drive-table,drive-canvas,explorer-nav,wide-toggle}.tsx`, `components/documents/`. |
| **Catégories Drive (espaces partagés)** | Modèle `DriveSpace` + `DriveNode.spaceId` ; RBAC `canCreateDriveSpace`/`canViewDriveSpace`/`canManageDriveSpace` (`lib/rbac.ts`, accès implicite module Drive dans `getAccess`) ; `lib/queries/drive.ts` (`getDriveSpacesForUser`, `getDriveTabs`, `getDriveListing(…, spaceId)`) ; `lib/actions/drive-space-actions.ts` (créer/modifier/archiver/supprimer) ; page `app/(app)/drive/espace/[id]/` + `drive-space-manager.tsx` ; réglage `AppSetting.driveSpaceCreatorRoles` (`DriveSpaceCreatorForm` en Administration). Les catégories sont des **Emplacements du volet de navigation** (`ExplorerNav`), plus des onglets — `getDriveTabs` ne sert plus qu'à la page Documents. |
| **Admin** | `app/(app)/admin/` (`page.tsx` comptes + stockage + activité, `corbeille/`, `drive-storage-settings.tsx`, `access/`, `settings/`…), `lib/actions/admin-actions.ts`, `settings-actions.ts`. |
| **IA / Brain** | `lib/ai.ts`, `lib/assistant.ts`, `lib/adventum/risks.ts` (+ `risk-detectors.test.ts`), `app/(app)/adventum-brain/`. |
| **Assistant — mémoire personnelle** | `lib/assistant-memory.ts` (**seule** porte d'entrée, tout scopé par `userId`) + `assistant-memory.test.ts` (tests de fuite), `lib/actions/assistant-actions.ts` (garde impersonation, persistance, distillation), `app/(app)/assistant/assistant-chat.tsx` (rail des conversations). Modèles `AssistantThread`/`AssistantMessage`/`AssistantMemory`. |
| **Versions test → prod** | `lib/features.ts` (+ `features.test.ts`), `lib/nav-tabs.ts` (`visibleTabs`), `app/(app)/admin/versions/`, `components/layout/test-mode-banner.tsx`. Modèles `FeatureFlag` + `User.testMode`. |
| **Aujourd'hui & point du matin** | `lib/queries/today.ts` (`rankToday`, pure + testée) + `today.test.ts`, `app/(app)/aujourdhui/`, `lib/daily-brief.ts` (cache `DailyBrief`, 1 appel IA/jour/personne), `components/shared/morning-brief.tsx`. |
| **Graphiques (partagés)** | `components/charts/palette.ts` (palette catégorielle **vérifiée** — ne pas réordonner), `donut.tsx` (camembert), `trend.tsx` (courbe + rythme théorique), `bars.tsx` (barres statut + jauge). Composants serveur, zéro JS. |
| **Budgets (3 écrans)** | `app/(app)/budgets/` — `page.tsx` (vue d'ensemble, lecture seule), `depenses/`, `reglages/`, `budget-context-bar.tsx`, `budget-expenses.tsx`, `budget-settings.tsx`, `budget-forms.tsx` (tiroirs partagés). `lib/queries/budget.ts` → `buildMonthlySeries` (+ `budget-monthly.test.ts`). |
| **Intelligence marché — molécule** | `lib/market/molecule.ts` (`moleculeStem`, `canonicalForm`, `extractDosage`, `labKey`, `analyzeMolecule`, suggestions) + `molecule.test.ts` ; `lib/actions/market-actions.ts` ; `app/(app)/business-development/marche/produits/` (`product-explorer.tsx`, `molecule-panel.tsx`). |
| **PCH — lecture IA d'un AO** | `lib/actions/pch-tender-line-actions.ts` (`extractAndSaveLines` → `enrichLineById` → `analyzeMolecule`, `enrichAllTenderLines`, `dominantOrigin`), `lib/pch-tender-export.ts` (+ tests), `app/api/pch/export/route.ts`, `app/(app)/pch/[id]/tender-lines.tsx`. |
| **Assistant — flux (streaming)** | `lib/ai.ts` → `callClaudeStream`, `lib/assistant.ts` → `runAssistantStream`, `app/api/assistant/stream/route.ts` (SSE), `app/(app)/assistant/assistant-chat.tsx`. |
| **Regulatory — niveau de process** | `lib/regulatory/manufacturing-stage.ts` (`effectiveStage`, pure) + tests ; colonne et cellule dans `app/(app)/regulatory/regulatory-table.tsx` ; fiche `app/(app)/regulatory/[id]/page.tsx`. |
| **Regulatory — frise du dossier** | `lib/regulatory/dossier-timeline.ts` (`ADDABLE_KINDS`, `planInsertion`, `validateStep`, `canRemove`, `describeStep`, `summarize` — **pures** + 17 tests) ; `lib/actions/regulatory-timeline-actions.ts` (`startDossierTimeline`, `addDossierStep`, `updateDossierStep`, `deleteDossierStep`, journalisées) ; UI `app/(app)/regulatory/[id]/dossier-timeline.tsx` + `upload-button.tsx`. Modèle `RegulatoryDossierStep` (+ index unique **partiel** `WHERE kind='CTD_INITIAL'`) ; pièces jointes par `Document.stepKey` = id de l'étape. Capacité Adam `regulatory_operation:add_dossier_step`. |
| **RH — 4 écrans** | `lib/queries/hr-pulse.ts` (`getHrPulse` : absents, départs, échéances, soldes) ; `app/(app)/rh/` — `page.tsx` (à traiter), `equipe/`, `conges/`, `departements/`, `team-directory.tsx`. |
| **Force de vente — portefeuille** | `lib/sales-portfolio.ts` (`mergePortfolio`, `portfolioGammes`, purs + tests) ; `lib/queries/portfolio.ts` (`getMyPortfolio`, `selectableProducts`) ; `components/planning/my-portfolio-card.tsx`. S'appuie sur `PromoProduct.channel` + `PromotionAssignment` + `SalesTeam`. |
| **Prise en charge** | `lib/care.ts` (pur + tests) ; `lib/actions/care-actions.ts` (personnes, cases, devis, Finances) ; `lib/queries/care.ts` ; `components/care/care-panel.tsx`. Modèles `CareBeneficiary` · `CareCell` · `CareQuote` · `CareQuoteCell`. |
| **Ad & Pro — postes** | `lib/ad-pro-items.ts` (`breakdown`, `canEmitOrder`, `plannedGaps`, purs + tests) ; `lib/actions/ad-pro-item-actions.ts` (table `PARENTS` = le seul endroit à compléter pour un module de plus) ; `components/ad-pro/items-panel.tsx`. Modèle `AdProItem` (2 FK nullables + contrainte `one_parent`) + enum `AdProItemKind`. |
| **Mobile — coque & couches** | `lib/use-scroll-lock.ts` (verrou compté sur `#app-scroll`) ; `components/layout/chrome-metrics.tsx` (hauteurs mesurées → `--app-chrome-top` / `--app-chrome-bottom`) ; `.app-viewport` / `.app-viewport-flush` et l'échelle de z-index dans `app/globals.css`. |
| **CTD — réserves ANPP** | `lib/regulatory/intelligence/reserves/` — `library-ingest.ts` (texte → OCR → vision), `library-extract.ts` (schéma strict, verbatim obligatoire), `library.ts` (`findSimilarReserves`, `bestHistoricalResponse`, `reserveRisk`, `proposeRules`, `ruleConfidence`), `library-actions.ts` (`validateDerivedRule` = seul chemin vers VALIDATED) ; écran `app/(app)/regulatory/enregistrement/reserves/`. |
| **CTD — constats défendables** | `lib/regulatory/intelligence/findings/enrich.ts` (`enrichVersionFindings`, `findingQuality` pure + tests) ; branché dans `jobs/runner.ts` (`attachPrecedents`) ; rendu par `FindingEvidence` dans `app/(app)/regulatory/enregistrement/analyse/[dossierId]/page.tsx`. |
| **CTD — corpus & veille** | `lib/regulatory/intelligence/corpus/` — `catalog.ts` (43 sources, `ingestible`/`binding`), `fetch-source.ts` (`findPdfLink`, `htmlToText`, `extOf` + tests), `ingest-catalog.ts` (versions DRAFT, empreinte), `watch-schedule.ts` (`runAnppWatchIfDue`, branché sur `lib/scheduled.ts`), `corpus-actions.ts` ; écran `app/(app)/regulatory/enregistrement/corpus/`. |
| **CTD — coût & Batch** | `lib/openai-luna.ts` (Luna, Batch ×0,5) ; `lib/regulatory/intelligence/cost/` — `ledger.ts` (`trackedLuna`, `cacheKeyOf`, `budgetState`, `dossierCost`), `batch-runner.ts` (`submitVersionReviewBatch`, `pollAiBatches`, `processCompletedBatch`), `cost-actions.ts` ; carte « Coût de l'analyse IA » + `cost-panel.tsx` sur l'écran dossier. Modèles `RegulatoryAiCall`, `RegulatoryAiCache`, `RegulatoryAiBatch`. |
| **CTD — pages exactes & preuve** | `lib/regulatory/intelligence/extract/pages.ts` (`buildPagedContent`, `pageAtOffset`, `pageSpanOfSlice`, `anchorEvidence` — pures + tests) ; `extract-text.ts` (`extractPdfPages` mupdf par page), `ocr/ocr-engine.ts` (contenu paginé), colonne `RegulatoryExtraction.pageMap` ; `agents/chunk-text.ts` (`splitTextIntoChunksWithOffsets`) ; consommé par `jobs/runner.ts` + `cost/batch-runner.ts` (l'ancrage PRIME l'estimation) ; page cliquable `#page=N` dans l'écran dossier. |
| **CTD — escalade & sémantique** | `lib/regulatory/intelligence/agents/escalate.ts` (`escalateCriticalSections`, max 4, `REG_AGENT_AUTO=0` pour couper) ; `corpus/semantic.ts` (`cosine`, `mergeHybrid`, `semanticSearchSections`, `embedBacklog` — cache estampillé, jamais bloquant) + `lunaEmbed` dans `lib/openai-luna.ts` ; hybride branché dans `corpus/rag.ts` (`searchCorpus`), rattrapage dans `lib/scheduled.ts`. Colonnes `embedding` (JSONB) sur `RegulatorySourceSection` + `AnppReserve`. |
| **CTD — livrables & verdict** | `lib/regulatory/intelligence/docgen/reports.ts` (`buildFindingsReport`, `buildReserveResponseLetter`) sur `buildSimpleDocx` (`build-docx.ts` — les modèles à trous ont été retirés) ; `rules/notice-arabic.ts` (`arabicStats`, `missesArabic`, `isArabicRequiredSection` — pures + tests, branchées dans `handleRules`) ; `createTaskFromFinding` dans `intelligence/actions.ts` ; verdict GO/NO-GO + réserves probables calculés dans `analyse/[dossierId]/page.tsx` ; boutons `report-buttons.tsx`. |
| **CTD — rattrapage de l'existant** | `lib/regulatory/intelligence/jobs/catchup.ts` — `shouldCatchUpAi` / `batchStillFresh` (pures + tests), `catchUpMissingAiReviews` (revue de fond jamais livrée → job `AI_REVIEW` en mode `immediate`, marqueur d'audit `AI_CATCHUP` = une fois par version), `catchUpStalledPipelines` (pipeline arrêté → `FACTS`, audit `PIPELINE_RESUMED`) ; branchés dans `lib/scheduled.ts`. Coupure : `REG_AI_CATCHUP=0`. |
| **CTD — progression vivante** | `lib/regulatory/intelligence/progress/analysis-progress.ts` (`computeAnalysisProgress`, `formatEta` — pures + tests : phases réception→lecture→OCR→données→conformité→revue IA, % renormalisé, ETA au débit réel), `query.ts` (`getAnalysisProgress` — comptes légers) ; route de polling `app/api/regulatory/intelligence/progress/[versionId]` (réveille aussi le planificateur) ; carte cliente `analyse/[dossierId]/analysis-progress-card.tsx` (barre + bande lumineuse + étapes + temps restant) ; badge vivant `analyse/live-badge.tsx` sur la liste. |
| **CTD — Entraînement IA (admin)** | `lib/regulatory/intelligence/training/` — `ingest-case.ts` (extraction + repérage CTD déterministe, dédup sha256 par étude), `for-section.ts` (`experienceForSection`, `rankCaseDocs` pure + tests, dédup par empreinte), `labels.ts` (pur, importable client), `actions.ts` (SUPER_ADMIN only) ; bloc « EXPÉRIENCE INTERNE » dans `agents/review-agent.ts` (`buildPrompt.experience` + tests), câblé dans `jobs/runner.ts` ET `cost/batch-runner.ts` ; embeddings via `corpus/semantic.ts` (`embedBacklog`) ; écran `app/(app)/regulatory/enregistrement/entrainement/`. Modèles `RegulatoryCaseStudy`/`RegulatoryCaseDoc`. |
| **Courriers — registre, pièces & trace** | `lib/mail-register/trace.ts` (pur : `traceValue`, `diffMailEntry`, `describeMailChanges`, `renderTraceValue` + tests) et `write.ts` (le CŒUR partagé écran/API : `createMailEntryFor`, `updateMailEntryFor`, `setMailDateFor`) ; `lib/actions/mail-register-actions.ts` (ne fait plus que lire le formulaire et rafraîchir) ; `app/(app)/courriers/` (`page.tsx`, `mail-table.tsx`, `mail-fields.ts`, `[id]/`). `EntityType.MAIL_ENTRY` pour les pièces jointes. Les liens du pli sont ceux du registre commun (voir « Le fil de l'affaire »). |
| **Legal — factures sorties des bons** | Migration `20261003100000_factures_sorties_des_bons` : chaque pièce `INVOICE` attachée à un `LegalDocument` de nature `PURCHASE_ORDER` devient une pièce Legal `INVOICE` (id dérivé `linv_` + id de la pièce → idempotent et traçable), le fichier DÉMÉNAGE, les `LegalDocumentReader` du bon sont recopiés (sans quoi la facture serait exposée à tout le module), `chainFromId` pointe vers le bon, et référence / montant / dates / contrepartie restent VIDES. Annulation documentée en tête du fichier. Preuve : `lib/legal/facture-extraction.test.ts` (8 tests, rejoue le `.sql` réel). |
| **Legal — engagements & échéances** | `lib/legal/lifecycle.ts` (pur : `expiryLevel`, `shouldRemind`, `expiryMessage`, `proposeRenewalDates` + tests) ; `lib/legal/expiry-sweep.ts` (`runLegalExpirySweep`, branché dans `lib/scheduled.ts` — aligne le statut échu, prévient à l'entrée d'une zone d'urgence, verrou atomique sur `lastRemindedAt`) ; `app/(app)/legal/` (`page.tsx`, `legal-table.tsx`, `legal-fields.ts`, `[id]/`). `EntityType.LEGAL_DOCUMENT`. |
| **Le fil de l'affaire — « Relié à… »** | `lib/links/graph.ts` (**pur, testé** : `LINK_TYPES`, `LINK_PAIRS` = le flux AO → contrat → BC → facture, l'assurance au contrat, le courrier à tout ; `DETOURS` refuse en NOMMANT le chemin — facture→marché, BC→marché, facture→contrat ; `canonicalPair` range la paire, `linkHref`) ; `lib/links/store.ts` (le SEUL chemin d'écriture : `addLink`/`removeLink` — voir les deux bouts + modifier au moins l'un des deux —, `linksOf`/`linksOfMany`/`linkedViews`, `refreshLinkLabels`, double entrée au journal) ; `lib/actions/link-actions.ts` (`addEntityLink`/`removeEntityLink`) ; `lib/queries/link-candidates.ts` (le menu n'offre que ce que le flux autorise) ; `components/shared/entity-links.tsx` (la MÊME carte : courrier, document légal…). Modèle **`EntityLink`** — registre unique (§17), migration `20261001160000` reprend les lignes de l'ancien `MailEntryLink`. Adam : `mail_operation.link_record` / `unlink_record`. |
| **Liaisons transverses** | `lib/links/source-link.ts` (pur : `LINKABLE_SOURCES`, `sourceHref`, `sourceCaption` — un test remonte CHAQUE route jusqu'à `NAVIGATION` pour interdire les liens morts) ; `components/shared/linked-records.tsx` (bloc serveur posable sur toute fiche) + `attach-to-source.tsx` (créer une pièce déjà rattachée). Les modèles `LegalDocument`/`Invoice`/`MailEntry` portent `sourceType`/`sourceId`. |
| **Catalogues produits — rapprochement** | `lib/products/catalog-match.ts` (pur : `productKey`, `matchScore`, `bestMatches` — le score CHUTE quand les dosages diffèrent + tests) ; `lib/products/link.ts` (cœur partagé écran/API) ; `lib/queries/product-catalog.ts` ; `app/(app)/regulatory/catalogue/`. Champs `BdProduct.regulatoryProductId` / `PromoProduct.regulatoryProductId`. |
| **API agents — écriture** | `lib/api/registry/operations.ts` (catalogue déclaratif + `validateParams` pur, qui REFUSE au lieu de deviner ; un test exige une portée d'écriture par opération) ; `app/api/v1/operations/[operation]/route.ts` (idempotent) et `app/api/v1/meta/operations/route.ts`. Chaque opération appelle le même cœur métier que l'écran. |
| **Téléversement direct multipart** | `lib/regulatory/intelligence/upload/object-storage.ts` (`presignUploadPartUrl` — les paramètres de l'opération entrent dans la requête canonique) et `session.ts` (`DIRECT_PART_BYTES`, `DIRECT_CONCURRENCY`, recollage à la finalisation, abandon qui libère les parties) ; `components/layout/upload-manager.tsx` (envoi parallèle + annulation). Voir `docs/UPLOAD_PERFORMANCE.md`. |
| **Garde-fous de style** | `lib/client-bundle-guard.test.ts` (frontière client/serveur) et `lib/responsive-guard.test.ts` (table large hors conteneur défilant, `col-span` non préfixé dans une grille mono-colonne) — deux tests qui lisent les sources, sans navigateur. |
| **Courrier smart (sans SMTP)** | `lib/mail-smart.ts` (agnostique fournisseur, `buildProviderCall`/`verifyInboundSignature`/`normalizeInbound`) + `mail-smart.test.ts`, `lib/actions/smart-mail-actions.ts` (journal), `app/api/mail/inbound/route.ts` (webhook signé), `app/(app)/admin/courrier/`. Modèles `OutboundEmail`/`InboundEmail`. |

---

### Mission Runtime (`src/lib/missions/`) — façade L2

| Fichier | Rôle |
|---|---|
| `ports.ts` | Les seuls seams : catalogue de capacités, exécutant, **raisonneur**, horloge. Le runtime n'importe JAMAIS `assistant/` ni `models/` |
| `model/roles.ts` | §4 — la politique de modèles en RÔLES métier (`CHEAP_WORKER` → `EXCEPTIONAL_PLANNER`). Aucun nom de modèle dans le métier |
| `planner/schema.ts` | Le JSON Schema STRICT du plan : `additionalProperties: false`, `required` exhaustif, aucun objet libre |
| `planner/plan.ts` | Objectif → capacités résolues → schéma imposé → plan RECONSTRUIT et typé. Refuse un plan sans étape ou sans critère. Rend `metriques.voie` (`DIRECTE`/`MODELE`) |
| `planner/direct.ts` | Le chemin DIRECT : le CODE planifie sans modèle — TROIS formes : lecture nue à capacité dominante ; RECHERCHE multi-sources (terme cité « … » → N recherches parallèles + conclusion, critères tout-`[REGLE:…]`, 0 juge) ; FICHE ciblée v2 (terme cité + 1-2 familles nommées → RECHERCHER → CIBLER (ids recopiés) → LIRE (éventail `read_document`/`inspect_record`, repli recherche-seule) → RÉPONDRE ; 3 règles + 1 critère sémantique JUGÉ, §28). Verrous R1–R5 / F1–F6 ; « lecture nue » exclut les contrats CONTENU ; sur doute, chaque forme RENONCE au planner |
| `planner/validate.ts` | La revérification de conformité, utilisée en production ET par le raisonneur scripté des bancs |
| `registry/resolve.ts` | §3 — pas de déversement d'outils : un tour de rôle par domaine, borné, mesuré (`plannerCapabilitiesExposed`) |
| `runtime/worker.ts` | L'étape qui RÉDIGE : faits établis, contexte partagé vs spécifique, économie mesurée ; `hydraterEventail` — un worker aval d'un éventail reçoit les résultats des FILLES, pas seulement `{expanded}` |
| `runtime/control.ts` | §39-40 — la main humaine : suspendre, reprendre, arrêter. Cloisonné par `ownerId` dans le `where` |
| `goal/qa.ts` | Le contrôle arithmétique complet : cardinalité, destinataires, reçus, doublons, artefacts |
| `goal/judge.ts` | §12-13 — le juge structuré (`satisfied`, `confidence`, `criteria[]`, `missing[]`). Un critère sans preuve est NON_DÉMONTRÉ |
| `artifacts/spec.ts` `xlsx.ts` `verify.ts` `render.ts` `build.ts` | Le livrable est CONSTRUIT, puis ROUVERT et CONTRÔLÉ (formules, plages, graphiques) avant d'être déposé |
| `memory/compactor.ts` | Le compacteur réel : le modèle peut enrichir les listes structurées, jamais en retirer |
| `agent/account.ts` | L'espace d'Adam dans l'ERP — SUPER_ADMIN, `isSystem`, et AUCUNE porte de connexion |
| `runtime/state.ts` | Machine à états mission + étape, pure et exhaustivement testée |
| `runtime/store.ts` | Persistance, matérialisation ré-entrante, journal (`MissionEvent`), clé d'idempotence |
| `runtime/engine.ts` | Le moteur : réservation, reprise, retry, éventail, parallélisme borné, conclusion |
| `runtime/interpolate.ts` | Injection d'un élément dans une entrée — pauvre par dessein, sans traversée de prototype |
| `planner/contract.ts` | Ce que le planner a le droit de produire, et les limites opérationnelles |
| `compiler/graph.ts` | Tri topologique, vagues, cycles, ancêtres |
| `compiler/compile.ts` | Le refus (capacité inconnue/interdite, cycle, forme, **cardinalité**) — et la RÉPARATION : clés hors alphabet ASSAINIES (références réécrites), règles à étape fantôme réparées à candidat unique ou déclassées, WAIT_INPUT converti en synthèse sous plafond de lecture (§28). **Créer la mission est un invariant** |
| `registry/capability-meta.ts` | Effet, idempotence, groupabilité, latence, confirmation — défaut prudent |
| `policy/guard.ts` | §29 : l'auto-escalade est un refus de compilation |
| `approval/scope.ts` | L'empreinte immuable d'un périmètre (§33) |
| `approval/gate.ts` | La porte fermée par défaut + la notification via le VAPID existant |
| `events/match.ts` | « Ce fait est-il celui que j'attendais ? » — pur, strict par défaut |
| `events/router.ts` | Réveil des missions, attente humaine, attentes échues, file de l'ordonnanceur |
| `goal/evaluate.ts` | Contrôle qualité arithmétique + satisfaction de l'objectif (§20-22). Partitionne les critères : règles vérifiées sur les REÇUS d'abord, juge LLM sur le seul reste sémantique — tout-règles → 0 appel de juge |
| `goal/rules.ts` | Le juge de RÈGLES : grammaire `[REGLE:CODE:args]`, vérification déterministe sur les reçus (`RECHERCHES_AVEC_REQUETE`, `AUCUNE_ECRITURE`, `SORTIE_STRUCTUREE`). Code inconnu → critère SÉMANTIQUE, jamais deviné |
| `recovery/strategy.ts` | Douze causes, une échelle par cause, quatre niveaux de certitude |
| `recovery/sources.ts` | Où chercher ensuite, par type de cible (§77) |
| `commitments/satisfy.ts` | Une promesse se ferme quand le fait arrive ; relance sans harcèlement |
| `commitments/proactivity.ts` | Cinq facteurs : agir / proposer / se taire |
| `templates/registry.ts` | OBSERVED → CANDIDATE → APPROVED : pas d'apprentissage silencieux |
| `memory/budget.ts` | Composition sous budget + trois couches incompressibles |
| `memory/compact.ts` | Compression progressive avec refus si une valeur critique est perdue |
| `memory/store.ts` | Épisodes en base + assemblage réel du contexte |
| `view/workspace.ts` | L'écran d'une mission, sans modèle, avec un `blockId` stable |
| `agent/principal.ts` | La double signature `initiatedBy` / `executedBy` (§30) |
| `evals/bench.test.ts` | 17 scénarios, KPI mesurés, et ce qui n'est pas mesuré dit comme tel |

**Le PONT** — `src/platform/in-process/missions/` : le seul endroit d'Adam autorisé à connaître
l'ERP, et la racine de composition du runtime (`boundary-scan.ts` l'exempte, par dessein).

| Fichier | Rôle |
|---|---|
| `reasoner.ts` | Remplit le port `Reasoner` avec la vraie passerelle. Traduit les rôles métier en rôles techniques ; aucun nom de modèle |
| `catalog.ts` | Le catalogue de capacités de CETTE personne, calculé par le même code que la conversation |
| `runner.ts` | L'exécutant : lectures par `executeReadTool`, écritures par intent + clé d'idempotence + reçu. Classe les échecs DURABLES d'une lecture (402 facturation, 401/403, 404 objet) en non-retryable + court-circuit par cible — un refus de facturation ne se « répare » plus par du raisonnement |
| `runtime.ts` | `lancerMission` / `avancerMission` — assemblage complet, une retouche de plan sur refus du compilateur. Porte de replan : un juge qui ne suggère AUCUN recours (`recoursSuggere: null`) → `REPLAN_SKIPPED`, pas d'appel de planificateur |
| `provider-waterfall.ts` | La cascade instrumentée du smoke : voie du plan, appels chevauchants, facteur de parallélisme, premier résultat utile — les métriques §18 du chantier latence |
| `deep-smoke.ts` | Le Deep Live Smoke (`npm run adam:smoke:deep`) : 60-80 missions générées depuis les VRAIES données de l'ERP (~19 genres), même harnais `jouer` que le smoke fournisseur, verdicts SUCCÈS/HONNÊTE/DÉFAUT, nettoyage borné à ses missions. Mode PALIERS (`DEEP_SMOKE_PALIERS="3,5,10"`) : montée en charge par mesure, arrêt auto si défauts ↑ ou P95 ×2, concurrence retenue = maximum SAIN observé ; `carteDeScore` §71 (E2E, création, routes, non-triviales anti-triche, appels gaspillés, jetons/succès) au rapport et au JSON |
| `sweep.ts` | Le battement des missions : douze par passage, droits RELUS en base, attentes échues signalées une fois |
| `memory.ts` | Découpage en épisodes, vieillissement par le calendrier, contexte composé sous budget |
| `commitments.ts` | Les promesses en retard : espacement croissant, et le silence quand l'identité n'est pas canonique |
| `control.ts` | Les gestes de conduite vus d'Adam — sans accorder ni fournir, qui exigent un clic |
| `fake-reasoner.ts` | Le seul substitut des bancs : il VALIDE chaque réponse scriptée contre le schéma réellement demandé |
| `e2e.test.ts` `memory.test.ts` `commitments.test.ts` | Les bancs de bout en bout, depuis les vrais points d'entrée |

### Information Fabric (`src/lib/fabric/`) — façade L2

L'information vient à Adam ; Adam ne court plus après. Cinq briques DÉTERMINISTES (zéro appel
de modèle), consommées par les mêmes points d'entrée qu'avant — audit, décisions et mesures
complètes : `docs/INFORMATION_FABRIC.md`.

| Fichier | Rôle |
|---|---|
| `index.ts` | Le baril — un franchissement de frontière par fichier consommateur, pas un par brique |
| `registry.ts` | Le registre des SOURCES : 11 familles typées (contenu, entités, modes, autorité, **preuve négative possible ou non**) + sondes de fraîcheur mesurées (« synchronisé jusqu'à HH:MM »). Appelant réel : l'outil `source_map` |
| `text-search.ts` | La recherche de CONTENU indexée : FTS `'simple'` sur expression (index GIN de `20260828300000`), classement `ts_rank` à VIVIER BORNÉ (300), préfixes, conjonction puis disjonction, repli LIKE (servi par trigramme) DIT dans le résultat |
| `mentions.ts` | Les liens document ↔ entité CANONIQUE, extraits à l'INGESTION (dictionnaire déterministe : produits DCI+marque, personnes nom complet, laboratoires) → table `EntityMention`. « Tout ce qui est relié à X » = une lecture d'index, et les ALIAS se franchissent (Keytruda ↔ pembrolizumab) |
| `hot-state.ts` | Les états chauds PRÉCALCULÉS (`AssistantHotState`) : écriture au travers + TTL + invalidation par fait métier (4ᵉ conséquence de `recordEvent`) + coût MESURÉ persisté. `subjectId` est une clé de DROITS — jamais servi à un autre |
| `bulk.ts` | Le loteur de lectures : N demandes logiques d'un même tour → K requêtes physiques (`findMany` découpé), mesure {logiques, physiques} par opération — affichée dans la couverture de `find_documents` |
| `scripts/fabric-bench.ts` | `npm run fabric:bench` — six voies dans le même run, sélectivité contrôlée, corpus étiqueté et nettoyé, ce qui n'est pas mesuré est dit |

Consommateurs côté Adam : `assistant/hot-alerts.ts` (signaux exécutifs chauds, réchauffés au
battement pour les dirigeants actifs), `assistant/source-map.ts`, `document-discovery.ts`
(FTS + alias + hydratation en lot). Côté ERP : `events/ledger.ts` (invalidation),
`scheduled.ts` (balayage des mentions + réchauffage).

## 💰 Budgets, enveloppes & sous-catégories

Le module **Budgets** est un vrai système de gestion budgétaire multi-niveaux, réparti sur **trois écrans, un par
intention** — on ne consulte plus son budget en traversant tout ce qui le modifie :

| Écran | Route | Ce qu'on y fait |
|---|---|---|
| **Vue d'ensemble** | `/budgets` | **Que de la lecture.** Le reste à dépenser en grand, une jauge, un **camembert** de la répartition, une **courbe** de la consommation cumulée face au **rythme théorique**, des **barres** par catégorie. Aucun bouton d'action. |
| **Dépenses** | `/budgets/depenses` | **Le travail.** Ce qui est **à imputer** vient en premier (tant que ces lignes traînent, la vue d'ensemble est fausse), puis la saisie d'une dépense, puis l'historique. |
| **Départements** | `/budgets/departements` | **Le budget de chaque département**, par exercice — deux colonnes, deux responsables (voir [référence](#budget-par-département--deux-natures-deux-responsables)). |
| **Réglages** | `/budgets/reglages` | **Le paramétrage.** L'enveloppe, ses catégories et sous-catégories, le budget total au-dessus des enveloppes. |

La **barre de contexte** (`budget-context-bar.tsx`) ne porte que ce qui change ce qu'on **regarde** : l'enveloppe et
la période. Une **alerte actionnable** unique remplace l'ancienne section « dépenses non attribuées » dépliée.

**Lecture de la courbe** : le pointillé gris est le budget dépensé régulièrement sur la période. Au-dessus = on
dépense trop vite. `buildMonthlySeries` (pure, testée) couvre **tous** les mois de la période même vides, garantit un
cumul strictement croissant, et fait atterrir le rythme théorique **exactement** sur le budget au dernier mois.

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

- **Assistant IA** — **module à part entière** (entrée de menu dédiée, page plein écran
  `/assistant` ; l'ancienne bulle flottante a été retirée). **Boucle agent Claude**,
  comprend l'app et les données **filtrées par les droits**. **Proactif** sur les messages non lus. Outils de
  **lecture** (annuaire, tâches, médecins, produits, **e-mails de sa boîte**, **calendrier**…) exécutés et
  **scopés** ; outils d'**écriture** **jamais** exécutés seuls → **carte de confirmation**. **Anti-formulaire** — il
  crée en langage naturel : tâche, demande administrative, **message**, **e-mail**, **rendez-vous**, dossier,
  **demande de congrès**, **demande RH** (note de frais, ordre de mission, congés annuel/sans solde/maladie/maternité,
  attestations, entrevue…), **demande de sponsoring**, **événement**, **demande de matériel promotionnel**. Chaque
  action réutilise l'action métier existante (mêmes circuits/notifications) et est **revérifiée RBAC** par module.
  Garde-fous : n'invente jamais médecin/produit/adresse, **avertit sur les dates passées**, **texte simple**,
  **robuste** (timeout + retry, ne lève jamais).
  **Lecture de pièces jointes** — on peut joindre des fichiers à la conversation (`/assistant`) : **glisser-déposer**
  ou bouton trombone pour un fichier local, **ou référencer un fichier du Drive** (bouton dossier → sélecteur ;
  **aucun téléchargement + re-téléversement**). Le contenu est extrait **côté serveur** — **Excel complet** (toutes
  les feuilles), **PowerPoint** (texte des diapositives), **Word**, **PDF** (couche texte), **CSV/texte** — puis
  injecté dans le message pour que l'assistant s'appuie dessus (résumé, extraction de chiffres, comparaison). Fichiers
  du Drive lus **après contrôle d'accès** ; formats scannés/binaires hérités signalés (`lib/assistant-files.ts`).
  **Export Excel** — `export_excel` produit un vrai `.xlsx` (dossiers réglementaires, annuaire, courriers,
  recrutement, effectif, comptes) et le dépose dans le **Drive personnel** du demandeur, dossier « Exports IA » :
  il doit vivre là où les autorisations existent déjà, pas dans un lien qui traîne. Le contenu ne dépasse
  **jamais** ce que la personne a le droit de lire, et l'export de l'effectif ne porte **aucune** colonne de
  rémunération — un classeur circule sans ses droits d'accès. Même nom le même jour = nouvelle **version**.
  **Réglages de la plateforme et fiches Regulatory** — `read_platform_settings` / `update_platform_setting`
  (Super Admin) et `update_regulatory_product` (droit `REGULATORY:UPDATE`). Ce qui rend cela tenable est une
  **liste blanche déclarative, typée et bornée** (`lib/assistant/admin-write.ts`) : ce qui n'y figure pas n'est
  pas écrivable, la **console d'administration ne se masque jamais**, une **liste remplace** l'ancienne (la carte
  de confirmation le dit), verrouiller un dossier annonce sa conséquence, et **chaque valeur est relue** avant
  d'atteindre la base — la confirmation de l'utilisateur ne remplace pas la validation, personne ne relit une
  énumération dans une carte de confirmation. Rôles et modules se désignent par leur **nom français**.
  **Dictée vocale** — un bouton micro dans la zone de saisie : on parle, l'audio est transcrit (**Whisper**,
  `POST /api/assistant/transcribe`, audio non conservé) et le texte arrive **dans le champ, ÉDITABLE** — on relit /
  corrige avant d'envoyer. Affiché seulement si `OPENAI_API_KEY` est configurée, et soumis à l'interrupteur « voix ».
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
- 📁 **Trois façons de joindre**, sous un seul trombone (`composer.tsx`) : des **fichiers** de son
  ordinateur ; un **dossier** de son ordinateur — le navigateur ne sait pas envoyer un dossier, il
  rend ses fichiers à plat, alors on les rassemble en une **archive .zip** nommée d'après le dossier
  (JSZip chargé à la demande) ; et **depuis le Drive**.
- 🔗 **Depuis le Drive — sans recopier.** Le message porte une **référence** au nœud
  (`MessageAttachment.driveNodeId`, `blobId` restant nul) et les destinataires reçoivent un
  **`DriveShare` en LECTURE**. Recopier un contrat de 40 Mo dans cinq conversations stockerait cinq
  copies **et figerait cinq versions** — six mois plus tard, cinq personnes travaillent sur cinq
  fichiers différents et nul ne sait lequel fait foi. La référence ouvre toujours la **version
  courante**. Un **dossier** se partage comme un fichier (une liasse s'envoie d'un geste).
  Le serveur ne croit **rien** de ce que dit le client : il relit nom, taille et type **en base** et
  revérifie par `resolveDriveAccess` que l'expéditeur a réellement accès au nœud. L'octroi passe par
  `skipDuplicates` — poser un `VIEW` par-dessus un `EDIT` existant **retirerait l'édition** à
  quelqu'un en lui envoyant un message. Règles : `src/lib/messaging-attachments.ts` (module pur testé).
- 🚪 Un **partage nominatif ouvre le module Drive** à lui seul (`getAccess`) : sans cela, recevoir un
  document donnait un lien menant à un refus — l'accès existait en base, la porte du module le
  rendait inutile.
- **Types acceptés** : la même règle que le Drive — on refuse les **exécutables**, et rien d'autre.
  La liste blanche étroite d'origine rejetait une vidéo de congrès, un export `.msg`, un `.odt`, un
  `.7z` — que les gens envoyaient donc par WhatsApp, hors de l'outil. La **limite de taille** reste
  celle des pièces jointes (`maxUploadMb`), plus basse que le Drive : une conversation n'est pas un
  espace de stockage.
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

**238 modèles** Prisma (dont `Company`), **167 enums** (dont `MaterialType`). Quelques entités structurantes (référence `prisma/schema.prisma`) :

| Domaine | Modèles clés |
|---|---|
| **Identité & accès** | `User` (`role` + `secondaryRole`, `lastSeenAt`), `UserAccess` (overrides), `RowGrant` (grants par ligne), `UserSession` (révocable, `lastSeenAt` = dernier clic), `LoginAttempt`, `AppSetting` (limites d'upload + `driveCapacityGb`/`driveUserQuotaGb` + mode budget total). |
| **Ad & Pro** | `SponsoringRequest`, `CongressInternational`, `CongressNational`, `Event` (+ `EventRegistration`), `PromoMaterial`, `MissionAssignment`. |
| **Budgets & Finances** | `BudgetEnvelope` (`accessRoles`, `accessUserIds` = visualisation ; `managerRoles`, `managerUserIds` = gestion déléguée ; `modules[]`), `BudgetCategoryLine` (auto-relation `parentId` = sous-catégories), `ExpenseOrder`, `FinanceTransaction` (`budgetCategoryId` = imputation), `PayrollEntry` (`payslipDocumentId`, `employeeNotifyAt/NotifiedAt`, `budgetTransferredAt`, `budgetCategoryId`), `SalaryAdvance`. **Centre de paiement** : `ExpenseOrder.centralStatus|proposedAmount|decidedById|decidedAt` + `PaymentCentreMessage` (le fil des allers-retours). |
| **Regulatory & PCH** | `RegulatoryProduct` (+ étapes/documents, `deHolder`, `manufacturingVariation`, `manufacturer`, `variationDate`), `Supplier`, `PchTender` + bons de commande + caution, `StockAnnex` + `StockSnapshot` (états datés — le suivi actif), `StockMovement` (legacy, encore lu par le Brain en repli). |
| **Information médicale** | `MedicalInfoDeclaration` (`sourceType`/`sourceId` polymorphe → événement source, clé unique). |
| **Promotion médicale** | `MedicalDoctor`, `MedicalVisit`, `DelegatePlan`, segmentation par spécialité/produit. |
| **Transverse** | `AdministrativeRequest` (+ cellules/approbations, `archivedNodeId`), `DriverMission` + `DriverMissionStop` (courses multi-points), `OfficeSupplyArticle`, `ValidationRequest` (+ steps + rules), `Dossier` (+ `DossierMessage`), `Directive`, `SupportRequest`, `Document` + `FileBlob` (chiffré), `Comment`, `AuditLog`, `Notification`, `DeletedRecord` (corbeille des suppressions définitives), `WorkflowDefinition/Step/Instance/StepEvent` (moteur Ad & Pro), `SessionEvent` (rejeu de session — **actions seules, aucune valeur de champ**). |
| **Messagerie & Courrier** | `Conversation`, `ConversationMember`, `Message` (+ réactions), `MessageAttachment` (**deux natures** : `blobId` = fichier téléversé, `driveNodeId` = référence au Drive sans recopie), `MailAccount` (chiffré), `MailFolder` (dossiers de classement du registre), `MailEntryPiece` (une pièce = un intitulé + **son** destinataire + un fichier téléversé **ou** un nœud Drive référencé). |
| **IA & Brain** | `AiUsageLog`, `RiskSetting`, `AdoptionSetting`, `FieldReport`. |
| **RH & structure** | `Employee` (contrat, périodes d'essai `trial*`, salaires `baseSalary`/`retSS9`/`retSS35`/`tfp`/`retIrg`/`expenseRefund`/`netToPay`/`grossSalary`, **`departmentId`** = rattachement structuré, `managerId` = N+1 explicite), **`Department`** (auto-relation `parentId` = sous-départements sur **N niveaux**, `headId` = responsable, `deputyId` = adjoint), `EmployeeDocument` (blob Drive + `period`), `HrDocumentRequest` (types + `expenseMonth`/`approvedMonth`/`originalsAck*`, `meeting*`, `archivedNodeId`), `LeaveRequest`, `PayrollEntry`. |
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
| `MAIL_PROVIDER` · `MAIL_API_KEY` · `MAIL_FROM` | ⬜ | **Courrier « smart »** — envoi par API HTTPS (port 443) au lieu de SMTP : `resend`\|`postmark`\|`brevo` · clé d'API du fournisseur · adresse d'expédition d'un **domaine vérifié chez lui** (SPF + DKIM + DMARC en DNS, sinon les messages arrivent en indésirables). Les trois ensemble → envoi actif ; sinon `/admin/courrier` dit précisément ce qui manque. |
| `MAIL_WEBHOOK_SECRET` | ⬜ | Secret du webhook de **réception** (`POST /api/mail/inbound`) : signature HMAC-SHA256 du corps brut. Absent → la route refuse tout (jamais de mode ouvert par défaut). |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | ⬜ | Notifications **push** (PWA Web Push). |
| `MISTRAL_API_KEY` | ⬜ | Active **Mistral OCR** (moteur OCR primaire, cloud, rapide) pour l'analyse CTD. Absent → repli automatique sur l'OCR local tesseract.js (aucune perte). Service tiers **payant à la page**, réseau sortant requis. |
| `REG_OCR_ENGINE` · `REG_OCR_CONCURRENCY` · `REG_OCR_BATCH` | ⬜ | Moteur OCR (`auto`\|`mistral`\|`tesseract`, défaut `auto`) · documents OCR en parallèle (défaut 3, 1-20 ; modéré car un document massif charge un gros blob) · documents par passage (défaut 24). |
| `REG_OCR_CHUNK_PAGES` · `REG_OCR_CHUNK_CONCURRENCY` | ⬜ | Découpage des PDF massifs : pages par tranche (défaut 400, sous la limite Mistral 1000) · tranches océrisées en parallèle au sein d'un document (défaut 4). |
| `REG_EXTRACTION_MAX_CHARS` | ⬜ | Plafond du texte extrait/OCR persisté par document (défaut 20 M — ≈ 10 000 pages ; fin de la troncature 1 M). ↑ demande plus de disque base. |
| `REG_AI_CHUNK_PAGES` · `REG_AI_CONCURRENCY` | ⬜ | Revue IA par parts : pages par part envoyée à l'IA (défaut 10) · parts analysées en parallèle (défaut 4). |
| `REG_AI_MAX_CHUNKS` · `REG_AI_MAX_FINDINGS` | ⬜ | Garde-coût revue IA : parts max analysées par version (défaut 120, **0 = illimité**) · constats IA max persistés (défaut 300). Chaque part = 1 appel Claude (palier **éco**) facturé — c'est le principal poste de coût CTD, borné ici. |
| `DB_CONNECTION_LIMIT` · `DB_POOL_TIMEOUT` | ⬜ | Taille du pool de connexions Prisma (**défaut 12 en production**, contre `CPUs × 2 + 1` — soit 3 — chez Prisma) · délai d'attente d'une connexion libre. ⚠️ Un pool se compte **par processus** : multiplier par le nombre d'instances et rester sous le `max_connections` de Postgres. |
| `REG_UPLOAD_PART_MB` · `REG_UPLOAD_CONCURRENCY` | ⬜ | Taille d'une partie envoyée (défaut **4 Mo**, borné à 32) · parties en parallèle (défaut **8**). ⚠️ **Ne pas grossir les parties pour aller plus vite : c'est l'inverse** — mesuré, 16 Mo est ~2× plus lent que 4 Mo (Postgres écrit moins vite une grosse valeur `bytea`, et il faut la relire pour réassembler). Le levier utile est le parallélisme. |
| `REG_INGEST_STORE_CONCURRENCY` | ⬜ | Fichiers du dossier écrits en parallèle pendant l'ingestion (défaut **4**). Au-delà, les écritures se disputent le pool de connexions et le total **remonte** (mesuré : 4,7 s en série, 1,5 s à quatre, 2,0 s à huit) — ne relever qu'avec `DB_CONNECTION_LIMIT`. |
| `REG_MAX_PG_FILE_MB` · `REG_BLOB_CHUNK_MB` | ⬜ | Taille max d'un fichier unique conservé en base (défaut **950 Mo** ≈ 1 Go, stocké en tranches) · taille d'une tranche de blob chiffré (défaut 16 Mo). Fichiers proches d'1 Go : prévoir ≥ 4 Go de RAM ou activer le stockage objet (`S3_*`). |
| `S3_ENDPOINT` · `S3_BUCKET` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` | ⬜ | **Stockage objet S3-compatible** (fournisseur actuel : **Supabase Storage** ; R2, MinIO, AWS S3 fonctionnent aussi). Configuré ⇒ le contenu **chiffré** des fichiers part dans le bucket privé et la base ne garde que les métadonnées. Absent ⇒ tout reste en base (fonctionnel, mais le disque Postgres gonfle). **Strictement côté serveur** — jamais de `NEXT_PUBLIC_`. |
| `S3_REGION` · `S3_FORCE_PATH_STYLE` | ⬜ | Région (défaut `auto`, valeur admise par R2 ; Supabase et AWS veulent une vraie région) · style d'URL **chemin** (défaut activé — exigé par Supabase et MinIO ; `0`/`false` pour du virtual-hosted). |
| `S3_DISABLED` | ⬜ | Interrupteur d'arrêt : `1` force le repli sur le stockage en base **sans effacer** les variables. Sert à écarter le stockage objet le temps d'un incident. |
| `REG_S3_*` | ⬜ | **Anciens noms**, encore acceptés en **repli** pour ne pas casser une production en cours. Les `S3_*` priment quand les deux existent. À supprimer une fois la transition faite. |
| `DRIVE_ENCRYPTION_KEY` | ⬜ | Clé maîtresse AES-256-GCM (32 octets, hex ou base64). À défaut, dérivée de `NEXTAUTH_SECRET`. ⚠️ **La changer rend illisibles tous les fichiers déjà stockés.** |
| `OPENAI_API_KEY` · `OPENAI_BASE_URL` | ⬜ | Modèle économique **Luna** (`gpt-5.6-luna`) : lecture des lettres de réserves, des graphiques/images, et analyse différée (Batch). Sans clé, ces fonctions se désactivent **proprement** (message explicite) — le reste du module continue de fonctionner. |
| `CTD_MODEL_CHEAP` | ⬜ | Surcharge du modèle économique (défaut `gpt-5.6-luna`). |
| `CTD_BUDGET_USD_DEFAULT` | ⬜ | Plafond IA **global** par dossier, en dollars (défaut : aucun). Un dossier peut avoir son propre plafond, réglé à l'écran. Atteint ⇒ les appels sont **refusés avant dépense**, et l'écran le dit. |
| `REG_ANPP_WATCH` | ⬜ | `0` désactive la veille quotidienne des pages de publication ANPP (défaut activée). La veille **signale** un changement, elle n'ingère et n'active rien. |

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

## 🗄️ Stockage des fichiers — S3-compatible (Supabase Storage)

**Le protocole, pas le fournisseur.** La couche de stockage parle **S3** : Supabase Storage,
Cloudflare R2, AWS S3, MinIO ou Backblaze répondent tous à la même interface. Il n'y a **aucun SDK
propriétaire** — les signatures AWS SigV4 sont calculées avec le crypto natif de Node. Changer de
fournisseur, c'est changer des variables d'environnement, pas du code.

**Ce qui part dans le bucket, et ce qui reste en base.** Les octets sont chiffrés **AES-256-GCM
avant de quitter le serveur**, puis dédupliqués par l'empreinte SHA-256 du **clair**. Le bucket ne
reçoit **jamais** que du chiffré : il porte les octets, il ne remplace pas la sécurité applicative.
La base conserve toujours les métadonnées (empreinte, taille, **IV**, compteur de références) —
sans elle, le contenu du bucket est inexploitable.

**Les permissions ne passent jamais par le bucket.** Il est **privé**. Aucun téléchargement ne se
fait par une URL d'objet : tout passe par les routes de l'application, qui appliquent le RBAC, le
cloisonnement par entité, les partages Drive et les droits Regulatory/CTD, puis journalisent
l'accès. Les seules URL présignées émises sont des **PUT à durée de vie courte**, pour que le
navigateur envoie une archive volumineuse directement au bucket — jamais des URL de lecture.

**Gros fichiers.** Trois chemins, selon la situation :
- **navigateur → bucket** en direct (URL présignée) pour les dossiers CTD : ni le serveur ni
  Postgres ne voient passer les octets ;
- **serveur → bucket en plusieurs parties** (16 Mio) dès qu'un contenu dépasse 32 Mo : le pic
  mémoire vaut une partie, qu'il s'agisse d'un PDF de 2 Mo ou d'une archive d'un gigaoctet.
  Les parties partent **en parallèle** (4 en vol par défaut, `S3_UPLOAD_CONCURRENCY`) : envoyées
  une par une, elles additionnaient leurs allers-retours et n'utilisaient jamais le débit
  disponible — un fichier de 500 Mo payait 31 attentes en série pour rien. L'ordre des ETags suit
  les **numéros de partie**, pas l'ordre des réponses (`uploadPartsBounded`, testé) ;
- **base, en tranches ordonnées**, quand le stockage objet n'est pas configuré.

**Repli et pannes.** Les fichiers déjà stockés en base **restent lisibles** quoi qu'il arrive : la
lecture choisit sa source d'après l'enregistrement (objet, valeur unique, ou tranches). En revanche,
si le stockage objet est configuré mais refuse d'écrire, l'enregistrement **échoue franchement** —
pas de repli discret vers la base, qui fabriquerait des blobs gigantesques dans Postgres à l'insu de
tout le monde jusqu'à saturer son disque. L'utilisateur voit un message clair, rien n'est corrompu.

⚠️ **`S3_ENDPOINT` doit porter le CHEMIN de l'API S3, pas seulement l'hôte.** Chez R2, AWS ou MinIO
l'endpoint est un hôte nu ; chez **Supabase**, l'API S3 vit sous `/storage/v1/s3` — la variable
s'écrit donc `https://<ref>.storage.supabase.co/storage/v1/s3`. Ce préfixe fait partie de
l'adresse : sans lui, **chaque écriture répond 404** alors que les clés, le bucket et la région
sont parfaitement bons. `hostAndPath` le conserve (testé sur les deux formes d'endpoint), le
diagnostic l'affiche, et un 404 dit maintenant sur quel chemin il a été obtenu.

**Vérifier ce que voit le SERVEUR** (shell de l'hébergeur, à la racine du dépôt) :
`npm run storage:check`. Il dit si la configuration est lisible **par le processus**, sous quels
noms (`S3_*` ou `REG_S3_*`), et **nomme ce qui manque**. « Les variables sont renseignées dans le
panneau » ne prouve rien : une variable ajoutée après le dernier déploiement, posée sur un autre
service, ou un conteneur non redémarré donnent un panneau vert et un `null` côté code. **Aucun
secret n'est affiché**, jamais — seulement des noms de variables, l'hôte, le bucket et la région.

**Vérifier que l'accès marche vraiment** : Administration → Stockage objet → **Tester la connexion**. Le test
écrit un objet dans un préfixe dédié (`_selftest/`), le relit, compare son contenu octet pour octet
et le supprime. « Les variables sont renseignées » ne prouve rien : un bucket mal nommé, une clé
périmée ou une région fausse donnent la même page verte. Aucun secret n'apparaît dans le rapport ni
dans les journaux.

**Le bucket est le stockage PAR DÉFAUT dès qu'il est configuré.** Il n'y a pas de bascule à
actionner ni de réglage à cocher : si `S3_ENDPOINT`/`S3_BUCKET`/les clés sont présents, tout
nouveau contenu part dans le bucket (`objectStorageConfigured()`), et la base ne reçoit plus
d'octets. Retirer les variables ramène au stockage en base — pour les **nouveaux** fichiers
seulement ; ceux déjà dans le bucket continuent d'être lus depuis le bucket.

**Migration de l'historique** (à faire **séparément**, quand la connexion est validée en
production) : `npm run blobs:migrate-r2` déplace vers le bucket le contenu des blobs déjà en base
et bascule leur `storageKey`. Il traite les **deux** formes de stockage en base — la valeur unique
(`FileBlob.data`) *et* les **tranches** (`FileBlobChunk`, au-delà de 16 Mo), c'est-à-dire justement
les plus gros fichiers : les oublier reviendrait à migrer le menu fretin et à laisser la base
pleine. Les gros blobs sont poussés **en flux**, tranche par tranche (mémoire bornée). Un blob
illisible est signalé et sauté, sans arrêter les autres. Le script est **idempotent** et se relance
sans risque. Rien n'est supprimé de Postgres automatiquement : l'espace n'est rendu au disque
qu'après un `VACUUM FULL "FileBlob", "FileBlobChunk";`, à lancer à la main. Tant que le script n'a
pas tourné, anciens et nouveaux fichiers coexistent sans incident.

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
| `npx tsx scripts/gen-selection-pf-migration.ts` | Régénère la migration d'import du portefeuille « Sélection PF Produits » depuis `data/selection-pf-produits.xlsx` (le SQL est committé ; ne pas l'éditer à la main). |
| `npm run adam:doctor` | **Diagnostic de mise en service d'Adam** — base, migrations, chiffrement des jetons, config Google, connexion, droits accordés, veille Gmail, ingestion, politique d'envoi, coupe-circuits, planificateur, parité. Sans effet de bord, n'affiche AUCUN secret, sort en erreur s'il reste un ÉCHEC. |
| `npm run build:measure` | **Pic mémoire du build** — build propre, **avec le plafond de tas de `build:render`** (`BUILD_HEAP_MB`, 3072 Mo), échantillonnage du RSS de l'arbre node, échec au-delà du plafond (`BUILD_MEM_LIMIT_MB`, 4200 Mo par défaut). La garde contre le retour de l'OOM Render — elle ne vaut que parce qu'elle mesure la MÊME configuration que le déploiement. |
| `npm run autotest` | **Auto-testeur** — audit de cohérence pages ↔ gardes ↔ menu ↔ matrice RBAC (déterministe, aucun serveur). Voir `scripts/auto-test/README.md`. |
| `npm run autotest:live -- --base-url=…` | Crawl **en direct** (Playwright) : passe anonyme (fuites d'accès) + passes par rôle (accès réel vs RBAC, uploads jetables). |

---

## ✅ Tests & qualité

- **Vitest** : tests RBAC (purs, CI-safe) + **tests d'intégration** des workflows critiques contre une vraie base
  Postgres (mock de session) — information médicale, dossiers, directives, support, OnlyOffice (JWT), stockage
  durable, validation des imports Drive, score d'adoption anti-gaming, atterrissage sûr, matériel promotionnel,
  assistant IA, courrier, réunions. **2 491 passés · 23 skip propres** sur **229 fichiers** (sans base,
  CI verte partout).
- **Porte de vérification** avant chaque push (jamais contournée) :

```bash
npx tsc --noEmit && npm run build && npx vitest run
```

> Les tests d'intégration **skippent proprement** si aucune base n'est disponible (CI verte) et **s'exécutent
> tous** dès que Postgres est présent — on retombe alors sur le référentiel **2 491 passés / 23 skip**.

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

### « Le DG ne voit rien dans son centre de paiement, c'est tout blanc » (2026-09)

Trois défauts enchaînés, dont aucun ne se voyait — et le premier est **le défaut du pharmacien
responsable, resté à un autre endroit du code**.

**1. Les ordres naissaient sans entité.** `companyOfExpense` était une cascade de quatre ternaires
— sponsoring, les deux congrès, matériel promo — et **`PAYMENT_REQUEST` n'y figurait pas**, alors
que c'est devenu la source la plus fréquente depuis que le centre de paiement est le guichet
unique. Tout ordre né d'une demande de paiement retombait donc sur la fiche salarié du demandeur,
et à défaut sur `NULL`. La cascade est remplacée par une **table exhaustive** ; un test relit le
code appelant et échoue si un `sourceType` réellement utilisé n'y figure pas — une cascade se
complète en l'oubliant, une table nommée ne le permet plus.

**2. Un ordre sans entité DISPARAISSAIT.** Le filtre d'entité vaut `companyId = X`, et **`NULL`
n'est pas `X`**. Les deux files de paiement — le centre ET « Paiements à faire » — utilisaient
encore le filtre BRUT au lieu de `companyScopedWhere`, qui compose un `OR` (mon entité, **ou
aucune**) à l'intérieur d'un `AND`. Conséquence exacte de ce qui a été rapporté : le Super Admin
(vue groupe, aucun filtre) voyait la file entière ; le Directeur Général, cloisonné sur une
société, ouvrait un écran vide. Un paiement invisible n'est pas un paiement classé — c'est un
paiement qu'on ne fera jamais.

Une migration **rattache le passé** : chaque ordre orphelin retrouve l'entité de sa source, à
défaut celle de la fiche salarié du demandeur. Ce qui reste sans réponse reste à `NULL` — et
désormais visible de tous, donc rattachable à la main. Inventer une société pour faire propre
imputerait une dépense à la mauvaise comptabilité.

**3. L'écran ne disait rien.** Un `notFound()` renvoyait une page blanche à quiconque n'était ni
membre du centre ni demandeur. C'est ce qui a été vu : un accès qu'on croit avoir donné, un écran
muet, et l'on cherche le défaut ailleurs pendant des jours. La page **explique** désormais — qui
siège, pourquoi vous n'y siégez pas, et le geste exact qui vous y fait entrer (le siège nommé,
Administration → Accès). Aucun paiement n'est chargé au passage : la requête a déjà filtré.

**Ce qui n'a PAS changé, et c'est délibéré :** le Directeur Général ne siège toujours pas au centre
*par son rôle*. Le cercle par défaut reste le sommet de l'entreprise ; pour l'y faire entrer, on le
**désigne par son nom**, ce qui laisse une trace, un motif et un auteur.

`lib/expense-orders.ts` (table des sources + `EXPENSE_SOURCE_TYPES`), `lib/expense-orders.test.ts`
(5 tests : entité depuis la demande, orphelin visible, société voisine toujours invisible,
couverture des sources), `app/(app)/centre-de-paiement/page.tsx`,
`app/(app)/finances/paiements-a-faire/page.tsx`. Migration
`20261008090000_rattacher_les_ordres_orphelins`.

### On siège au centre de paiement par son NOM, pas seulement par son rôle (2026-09)

**Le problème, tel qu'il s'est présenté :** faire entrer une personne de plus au centre de
paiement. Siéger était une propriété du RÔLE — `SUPER_ADMIN` ou `DIRECTION` (`sitsOnPaymentCentre`)
— si bien que le seul chemin disponible était de lui donner le rôle **Direction** : MANAGE sur tous
les pôles, vue globale sur les validations de toute l'entreprise, My Chief of Staff. Autoriser des
paiements coûtait de devenir quasi-administrateur.

**Et les deux gestes qui SEMBLAIENT chirurgicaux ne marchaient pas, sans le dire :**

| Ce qu'on faisait | Ce qui se passait |
|---|---|
| Cocher `PAYMENT_CENTRE` dans Administration → Accès | Rien. L'écran du centre ne consulte pas ce module, il consulte `sitsOnPaymentCentre`. La personne arrivait sur une page filtrée sur ses propres demandes, sans bouton de décision — ou un 404 si elle n'en avait aucune. |
| Poser « autre rôle = Direction » | Rien non plus. La règle lit le rôle **principal**, jamais `secondaryRole`. |

Dans les deux cas l'administrateur croyait avoir accordé l'accès, et la personne trouvait un écran
vide. Une case qui ne mène nulle part est pire qu'une case absente : elle fait conclure que c'est
l'application qui est cassée.

**Le siège nommé.** `PaymentCentreSeat` — une personne, désignée, avec **son motif**, **son auteur**
et **sa date**. Il donne EXACTEMENT une chose : voir la file des autorisations et trancher. Aucun
autre module, aucune vue globale, aucun droit sur les Finances ; le test de circuit l'établit en
comparant les modules AVANT et APRÈS et en exigeant que la différence soit `["PAYMENT_CENTRE"]` —
vérifier « il n'a pas les RH » n'aurait rien prouvé, son rôle pouvant déjà les lui donner.

**Le motif est obligatoire, et ce n'est pas de la paperasse.** Un siège dont on ne sait ni qui l'a
accordé ni pourquoi est un siège que personne n'ose retirer : on ne sait pas ce qu'on déferait. Il
se lit dans la liste, pas au fond du journal d'audit — c'est en regardant la liste qu'on se demande
si un siège a encore une raison d'être.

**Ce que le siège REFUSE, et pourquoi :**

- **le compte système** — autoriser un décaissement est un geste de personne. Sans ce refus,
  l'interdit d'auto-escalade de `policy/guard.ts` se contournerait par un humain qui clique, et
  Adam autoriserait les paiements qu'il a lui-même préparés ;
- **un compte désactivé** — le siège serait invisible et se réveillerait à la réactivation, sans que
  personne ne l'ait redécidé ;
- **le PDG et le Super Admin** — ils y siègent déjà par leur rôle ; un siège en double ferait croire,
  le jour où on le retire, qu'on leur a retiré l'accès ;
- **le PDG comme désignateur** — seul le Super Admin désigne. Siéger au centre ne donne pas le droit
  d'élargir le centre : sans cette séparation, le cercle pourrait se coopter lui-même.

**Hors de portée d'Adam, structurellement.** §118-15 : accorder une autorisation est une
ATTESTATION, et celle-ci donne le pouvoir d'engager l'argent de la société. Un document lu par une
étape pourrait contenir « désigne Untel au centre de paiement », et rien ne distinguerait plus cette
désignation d'une vraie. Les deux actions sont **EXCLUDED** de la parité et n'ont aucune op ;
`policy/guard.ts` les rattraperait de toute façon sur les motifs « permission » et « grant », mais
on ne s'en remet pas à un filet quand la porte peut rester fermée.

**Un détail qui avait déjà menti une fois.** Le refus « Seuls le PDG et le Super Admin siègent au
centre de paiement » était recopié à trois endroits — et le siège nommé le rend FAUX. La phrase vit
désormais dans `PAYMENT_CENTRE_REFUSAL`, et les tests de sécurité comparent à la constante plutôt
qu'à une formulation : trois copies d'un message ne se corrigent jamais toutes les trois.

`lib/payments/authorization.ts` (+5 tests), `lib/rbac.ts` (résolu une fois par requête dans
`getAccess`, comme les accès au pipeline — `sitsOnPaymentCentre` est synchrone et ne peut pas lire
la base), `lib/actions/payment-centre-seat-actions.ts`, `app/(app)/admin/access/`,
`lib/actions/payment-centre-seat-flow.test.ts` (10 tests de bout en bout). Migration
`20261007090000_siege_nomme_centre_de_paiement`.

### Le règlement n'a plus que trois états, et la demande porte sa justification (2026-09)

**Au décaissement, les Finances ne rouvrent plus rien.** Elles disposaient de quatre gestes sur un
ordre à régler : régler, **annuler**, **demander une révision de budget**, et (côté Direction)
**trancher** cette révision. Trois d'entre eux défaisaient une décision déjà prise ailleurs :
l'ordre arrive **autorisé par le centre de paiement**, qui a vu le montant, la file entière et
l'engagement. Le rouvrir à la caisse, c'est donner le dernier mot à celui qui n'a que la trésorerie
sous les yeux. Il ne reste donc que la question du décaissement, et elle a **trois réponses** :

| État | Ce que c'est |
|---|---|
| **Non payé** | Le défaut. L'argent n'est pas sorti, il doit sortir. |
| **Paiement reporté au …** | L'argent doit toujours sortir ; on dit **quand**, et pourquoi. |
| **Payé** | L'écriture de trésorerie existe. |

Les trois actions ont été **supprimées**, pas masquées — écran, action serveur ET op Adam. Un bouton
retiré laisse une porte ouverte à l'assistant et à l'API, et §118-7 interdit qu'une mission soit une
porte dérobée vers ce que l'écran refuse. Les ordres restés en « Révision demandée » **repassent à
régler** par migration, au montant autorisé (une révision non tranchée n'a rien changé), avec le
motif du comptable recopié dans les notes : sans cela ils auraient attendu indéfiniment une décision
qu'aucun écran ne sait plus prendre.

**Le report est une DATE, jamais un statut.** Un statut « reporté » obligerait quelqu'un à le
remettre à « non payé » le jour venu ; ce quelqu'un oublierait — c'est un travail de secrétariat, et
un travail de secrétariat finit par être oublié. Une date **expire seule** : le 12 au matin, l'ordre
reporté au 12 est de nouveau simplement dû. Il ne quitte d'ailleurs jamais la file — il est **daté,
pas classé** — sinon « reporter » deviendrait le moyen commode de faire disparaître ce qu'on ne veut
pas payer. `lib/finance/settlement.ts`, module pur, 22 tests.

**La demande de paiement porte enfin sa justification.** « Au moins une pièce » était trop faible :
un bon de livraison, une photo, une capture d'écran satisfaisaient la règle, et le centre autorisait
une sortie d'argent sans savoir **ni ce qui est dû, ni comment le payer**. Deux exigences, et deux
seulement, pour transmettre :

1. **un BON DE COMMANDE ou une FACTURE** — les deux seules pièces qui disent ce que la société doit.
   Le devis dit ce qu'on *pourrait* devoir, le bon de livraison ce qu'on a *reçu* : ils accompagnent,
   ils ne justifient pas. L'un **ou** l'autre suffit — exiger les deux bloquerait les fournisseurs
   qui facturent sans bon, et les commandes payées d'avance ;
2. **la déclaration que le moyen de paiement figure sur le document** (RIB, chèque, espèces). C'est
   le détail qui coûte le plus cher en bas de chaîne : la facture arrive, elle est conforme, elle est
   autorisée — et la comptabilité ne sait pas sur quel compte virer. Trois jours d'aller-retour pour
   un RIB.

Tout le reste — autres pièces, notes, commentaires, **contact chez le bénéficiaire** — reste
facultatif : rendre obligatoire ce qui n'est pas toujours pertinent apprend à remplir les champs
pour rien, et c'est ainsi qu'on cesse de lire ceux qui comptent.

**L'exception du bon de versement.** Un BV n'a ni bon ni facture et ne peut pas en avoir : c'est
l'entreprise qui verse à une autorité sanitaire, et la **quittance n'existe qu'APRÈS le versement** —
l'exiger avant reviendrait à exiger la preuve d'un paiement pour autoriser ce paiement. Il est donc
exempté des deux règles et de la pièce jointe. Ce n'est pas un trou : le BV a déjà été validé par le
N+1, le chef de produit et le centre de validations. L'exemption tient au **rattachement**
(`entityType = MEDICAL_INFO_DECLARATION`), désormais posé **à la création** et non par une mise à
jour qui suivait — sinon la quittance serait passée devant une règle qui ne savait pas encore ce
qu'elle est. Aucune heuristique sur le titre : « bon de versement » écrit dans l'objet d'une demande
fournisseur n'ouvre rien, sans quoi l'exemption appartiendrait à qui connaît la formule.

**L'échéance se qualifie.** Deux dates identiques ne pèsent pas la même chose : le 15 d'un
fournisseur mensuel n'est pas le 15 d'une quittance dont le retard coûte une pénalité. Le demandeur
déclare donc son échéance **fixe non négociable**, **importante** ou **moyenne** (défaut). Une
qualification qu'on se contenterait d'afficher finit ignorée — elle a donc deux conséquences
**codées** : elle **classe** la file du centre et des Finances (à date égale, le fixe passe devant,
jamais devant une échéance plus proche), et elle **ferme le report muet** (reporter une échéance fixe
exige un motif écrit). Ce n'est pas un veto — les Finances peuvent devoir décaler, et personne ne
peut le leur interdire depuis un formulaire — c'est la **trace** que le demandeur relira quand il
devra expliquer le retard à son fournisseur.

**Ce que la règle a exigé ailleurs, et qu'il aurait été facile d'oublier :** le demandeur peut cocher
l'attestation **après coup** (sinon un brouillon ouvert avant la règle, ou un dossier renvoyé pour
correction, serait bloqué sans aucun moyen de se débloquer — exactement le cul-de-sac que la règle
est censée éviter) ; le **bon à payer** applique la même règle que la transmission, `canApprove`
délégant à `canSubmitDossier` (deux règles séparées auraient divergé, et l'on aurait fini par
autoriser au bon à payer ce que le dépôt refusait) ; l'op Adam de création n'ouvre plus qu'un
**brouillon**, parce qu'attester d'un document qu'on n'a pas lu est précisément ce qu'un modèle ne
doit jamais faire à notre place (§118-15) ; et l'audit plateforme cesse de compter un paiement
**reporté** parmi les ordres « en souffrance » — la date a été posée exprès, et un audit rempli
d'alertes qu'on a soi-même créées cesse d'être lu.

Modules purs : `lib/finance/settlement.ts` (22 tests), `lib/finance/deadline-nature.ts` (7),
`lib/finance/payment-dossier.ts` (15) ; circuit réel : `lib/actions/payment-dossier-flow.test.ts`
(12 tests sur les vraies actions). Migration
`20261006090000_reglement_trois_etats_et_piece_justificative`.

### Le bon de versement se fait en deux temps : accordé, puis payé (2026-08)

**Le principe du versement se discute AVANT que l'argent soit engagé.** Le pharmacien responsable
déposait jusqu'ici une demande de **paiement** directement : le centre de paiement se retrouvait
donc à autoriser un décaissement dont personne, en amont, n'avait dit qu'il était dû. Refuser à ce
stade coûte cher — le dossier est déjà instruit, et le refus se lit comme un désaveu comptable
alors qu'il porte sur le fond.

Deux marches, désormais :

1. **Le bon est ACCORDÉ.** Le PRIM demande le versement (montant attendu, note) et **trois
   signatures** répondent, dans cet ordre : son **N+1**, le **chef de produit du dossier source**
   (c'est lui qui connaît le budget accordé et ce qu'il couvre), puis le **centre de validations**
   (Directeur Général, à défaut Super Admin). L'ordre EST le contrôle : en parallèle, le DG
   signerait avant que quiconque ait vérifié le montant, et sa signature ne s'appuierait sur rien.
2. **La quittance est PAYÉE.** Le bon accordé, le PRIM demande le règlement depuis le même écran,
   avec le montant **réel** de la quittance — qui n'est pas toujours celui annoncé. À partir de
   là, plus rien de spécifique : `PaymentRequest` ordinaire, centre de paiement puis Finances, qui
   règlent, **scannent la quittance et la déposent** au bureau du PRIM. C'est cette remise — un
   geste, pas un statut déduit — qui ouvre la déclaration aux autorités.

Une marche sans signataire (pas de N+1, pas de chef de produit) est **sautée et DITE** dans la
demande, jamais remplacée par quelqu'un d'autre : désigner un remplaçant « au plus proche » ferait
signer une personne qui n'a pas la question — pire qu'une marche sautée, car la signature existe
et ne vaut rien. Le demandeur est écarté partout ; la même personne ne signe jamais deux fois.

Un refus **de principe** rouvre la demande de bon ; un refus **du centre de paiement** ne rouvre
que la quittance — le bon reste accordé, et renvoyer le pharmacien à la première marche lui ferait
refaire trois signatures pour un montant à corriger. Les dossiers ouverts avant cette marche
reprennent où ils en sont : ils n'ont pas de validation, et les renvoyer à « à demander » leur
ferait recommencer un circuit déjà instruit.

- **Purs & testés** : `lib/medical-info/bv.ts` (12 états, `bvCanRequest` / `bvCanRequestQuittance` /
  `bvCanDeliver` / `bvUnlocksAuthorities`, 13 tests) ; `lib/medical-info/bv-approval.ts`
  (`bvChain`, `bvChainNote`, 6 tests).
- **Circuit** : `lib/actions/medical-info-actions.ts` (`requestMedicalInfoBv` → validation
  séquentielle ; `requestMedicalInfoQuittance` → paiement) ; `lib/medical-info/bv-state.ts`.
- **Schéma** : `MedicalInfoDeclaration.bvValidationId|bvAmount|bvNote|bvRequestedAt|bvRequestedById`
  — migration `20261005090000_bv_valide_avant_quittance` (idempotente, et qui **reprend le fil**
  des dossiers déjà en cours).
- **Adam** : `medical_info_operation:request_bv` (reformulée) + `request_quittance`.

### Mon Équipe — l'écran de celui qui encadre (2026-08)

**Encadrer n'est pas un rôle, c'est un fait de l'organigramme.** Un chef de produit, un
responsable régulatoire, un directeur commercial encadrent tous quelqu'un sans partager le moindre
rôle. Le module est donc ouvert à tous, et c'est une **garde de navigation** qui n'affiche
l'entrée qu'à ceux qui ont réellement des N-1.

**L'équipe se DÉDUIT, elle ne se déclare pas.** `directReportsOf` la définit comme « ceux dont la
cascade dit que je suis le N+1 » — la **même** fonction qui route leurs demandes. Inverser la
cascade à la main aurait été faux et silencieusement : on aurait compté quelqu'un dont le
`managerId` désigne une autre personne mais qui appartient à mon département, et oublié celui dont
le chef est inactif et qui remonte donc jusqu'à moi. Deux vérités : un écran qui affiche
quelqu'un, et un circuit qui envoie sa demande ailleurs.

L'écran répond à trois questions et à trois seulement : **qui est dans mon équipe**, **qu'est-ce
qui m'attend** (congés, achats, formations — la plus ancienne en tête), **qui est là cette
semaine**. Ce n'est pas un mini-module RH : les fiches, les salaires et les dossiers restent aux
ressources humaines. **Recrutement** rejoint ce pôle dans le menu — recruter est le geste d'un
encadrant à qui il manque quelqu'un, pas une affaire d'Administration — mais ses **droits ne
bougent pas** : `RECRUITMENT` reste réglable seul dans la console.

- **Pur & testé** : `lib/hr/reporting-line.ts` (`resolveManager`, `directReportsOf`,
  `managementChainOf`, `managesAnyone` — 15 tests). `lib/departments.ts` lui DÉLÈGUE désormais :
  écrire la cascade deux fois, c'est se donner rendez-vous avec le jour où elles divergent.
- **Écran** : `app/(app)/mon-equipe/page.tsx` ; requête `lib/queries/my-team.ts` ; module RBAC
  `MY_TEAM` (accordé à tous, garde `myTeam` dans `lib/nav-access.ts`).

### Les lignes non rattachées cessent de disparaître (2026-08)

**`companyId` est NULLABLE, et `{ companyId: X }` ne retient pas `null`.** Beaucoup de lignes
n'ont pas d'entité — celles créées avant le multi-entités, celles nées d'un circuit qui ne la
renseigne pas. Elles disparaissaient de **tous** les écrans dès qu'une portée d'entité
s'appliquait. Deux pannes rapportées le même jour : « des fois 19 courriers, des fois 14 », et un
pharmacien responsable qui voyait ses déclarations dans « Mon espace » (aucun filtre d'entité) et
zéro dans son module. Et c'est une impasse : une ligne qu'on ne voit pas est une ligne qu'on ne
peut pas rattacher — l'écran « non rattachés » existe précisément pour aller les rechercher.

`currentCompanyWhereFor` est **supprimé**, remplacé par `companyScopedWhere(userId, base)` sur les
23 appels. Ce n'est pas cosmétique : le filtre s'écrit désormais `OR` (l'entité, **ou rien**), et
l'étaler dans un `where` qui porte déjà un `OR` — la plupart des portées RBAC — écraserait
silencieusement la portée métier et ouvrirait les lignes des autres. La composition se fait par un
`AND`, à l'intérieur de la fonction, et le type force le passage par elle.

### Dossier de paiement : pièces demandées et validations PAR PIÈCE (2026-08)

Le dossier ouvert depuis « Paiements à faire » devient un vrai espace **Dossier & pièces** :

- **Demander une pièce d'ici** — elle atterrit dans « Pièces demandées » de la personne visée, qui
  la dépose sans accéder au module. Ce qu'on demande s'écrit en clair (« la facture définitive de
  l'agence »), jamais « pièce n° 3 » : le destinataire n'a pas le dossier sous les yeux.
- **Faire valider UNE pièce**, et elle part **au centre de validations** — au Directeur Général, à
  défaut au Super Admin (`centreValidatorFrom`, pure et testée). Le destinataire ne se choisit
  pas : choisir son validateur dans une liste, c'est choisir qui vous dit oui. Et une demande qui
  dit « valider PAY-2026-014 » sans nommer la pièce en cause fait rouvrir un dossier de six
  pièces, ou signer sans lire. Une même pièce ne part pas deux fois ; l'état de sa validation
  s'affiche sur elle.

### Le bon de versement précède la déclaration, et le dossier de paiement s'ouvre (2026-08)

**Information médicale — l'étape qui manquait.** On ne déclare pas un événement aux autorités sans
avoir versé la taxe, et sans le **bon en main** : c'est ce papier qu'on dépose au guichet. Le PRIM
demande donc le versement (montant, note, pièces), le **centre de paiement** autorise, les
**Finances** règlent, puis elles **remettent le bon à son bureau**. « Déclaration aux autorités »
s'ouvre à ce moment-là, pas avant — et la règle tient **côté serveur**, pas seulement à l'écran.

**Pourquoi la remise, et non le paiement.** « Payé » ne veut pas dire « le pharmacien a le papier ».
Déduire l'ouverture du règlement aurait débloqué un geste qu'il ne peut pas encore faire, et il
aurait cherché longtemps pourquoi son écran l'y autorisait. La remise est un **geste**, posé par
les Finances — qui sont ramenées sur la déclaration par une notification au moment du règlement.

**Une porte de sortie, tracée.** Tous les dossiers n'appellent pas un versement, et le jour où
l'étape apparaît, aucun de ceux déjà en cours n'en a. « Ce dossier n'appelle aucun versement »
existe donc, avec un **motif exigé**, versé au journal : sans la porte, ils resteraient bloqués à
vie ; sans le motif, elle deviendrait le contournement ordinaire. Module pur `lib/medical-info/bv.ts`
(8 tests) ; la demande est une `PaymentRequest` **ordinaire**, pas un second circuit de paiement.

**L'échéance a deux temps.** Le demandeur dit **l'échéance demandée** — un souhait, formé sans voir
la trésorerie. Le **centre de paiement**, qui voit la file entière, pose en autorisant **l'échéance
que la comptabilité doit tenir**. La première reste dans la demande, la seconde va sur l'ordre.

**On ouvre le dossier, on réclame ce qui manque.** Le centre de paiement et les Finances accèdent
désormais à la **demande de paiement et à ses pièces** (pas à la demande source, qui vit dans un
autre module) et peuvent **réclamer une pièce** — facture, bon de commande, n'importe quel document :
elle atterrit dans « Pièces demandées » de la personne, avec son fil, sans lui ouvrir le module.
Symétriquement, **une demande transmise porte au moins une pièce** : la règle existait pour le bon
à payer et pour le renvoi, elle manquait au premier dépôt — un dossier vide arrivait au centre et
y restait bloqué.

**Validations — deux blocs retirés, une fiche ajoutée.** « Qui vous reviendront » montrait des
demandes sur lesquelles on ne peut **rien** faire (elles reviennent d'elles-mêmes dans « À traiter »)
et « Validations transverses » doublait les écrans de chaque module. En revanche une demande
**s'ouvre** enfin : `/validations/[id]` montre ce qu'on a demandé, à qui, où ça bloque, et ses
pièces — le coup de fil au validateur que ce module existe pour éviter. Et **chacun retire la
sienne**, tant qu'aucun validateur ne s'est prononcé : l'accord d'un tiers est un fait, il ne
s'efface pas.

**L'historique des règlements se vide** (Super Admin). On efface la **file**, pas la comptabilité :
les écritures de trésorerie et le journal d'audit restent — c'est là que vit la trace de l'argent
sorti. Les ordres encore à régler ne sont jamais touchés.

### Les accès du pipeline arrivent là où on les cherche, et le Dashboard cesse de se répéter (2026-08)

**Le pipeline réglementaire se réglait déjà — mais nulle part.** Le mécanisme existait (rôles et
personnes, consulter / tenir le cadenas) et son formulaire vivait au fond d'une page de réglages
longue de quinze cartes. Or « les accès » se cherchent dans **l'écran des accès**. Deux colonnes
s'ajoutent donc à la grille d'Administration › Accès par module, sur la ligne de la personne,
quand le module Regulatory est sélectionné : **Voit le pipeline** et **Tient le cadenas**.

Un droit hérité d'un **rôle** s'affiche **coché et verrouillé**, avec la phrase qui dit où le
retirer : décocher sans effet est le défaut qui fait conclure que l'écran ne marche pas. Et parce
qu'on n'ouvre pas un dossier qu'on ne voit pas, cocher « tient le cadenas » verrouille « voit »
sur oui. Les rôles déjà accordés sont **rejoués** à l'enregistrement — cet écran règle les
personnes, il ne doit pas effacer ce qui vient des rôles.

**Les sous-modules des Finances se déplient dans le menu**, par la flèche, comme la paie sous les
RH : on arrive directement dans « Paiements à faire » ou « Comptabilité » sans passer par le
tableau de bord. Les onglets restent dans la page — les deux chemins servent deux gestes.

**Et le Dashboard cesse de répéter ce qui vit ailleurs.** « À régler » et « Recettes attendues »
en sont retirés : la file des ordres EST le sous-module « Paiements à faire », et deux listes de la
même chose divergent dès qu'on règle depuis l'une. Les trois cartes par poste (« Répartition des
dépenses », « Dépenses du mois », « Recettes du mois ») partent aussi — le tableau du résultat
mensuel dit la même chose, sur six mois, sans trois barres à interpréter.

### Les factures sortent des bons de commande et deviennent des pièces à part entière (2026-08)

**Une facture classée en pièce jointe d'un bon de commande n'est pas une pièce du dossier : c'est
un fichier.** Elle n'a ni référence, ni montant, ni échéance, ni statut ; elle n'apparaît pas dans
la liste Legal quand on filtre par « Facture » ; elle ne peut être reliée ni à un marché ni à un
courrier de recouvrement, et elle ne peut pas partir au règlement.

**Chaque pièce de catégorie FACTURE attachée à un document de nature BON DE COMMANDE devient un
`LegalDocument` de nature `INVOICE`**, et le fichier **déménage** — il n'est pas recopié. Migration
idempotente `20261003100000_factures_sorties_des_bons`, dont l'annulation est écrite dans l'en-tête
du fichier.

**Elle ne remplit que ce qu'elle SAIT.** Titre = nom du fichier sans extension ; entité, dossier de
classement et déposant viennent du bon ; `chainFromId` pointe vers le bon (ce n'est pas une
déduction : le fichier y était rangé). **Référence, montant, dates et contrepartie restent vides** —
les déduire du bon aurait produit des chiffres plausibles et faux, sans qu'on sache ensuite
lesquels avaient été saisis et lesquels devinés. La contrepartie du bon figure en **note**, pas
dans le champ : c'est un fait sur le bon, pas une affirmation sur la facture. L'assistante de
direction complète et pose les autres liens.

**Les lecteurs suivent la pièce.** Un document Legal sans lecteur désigné est ouvert à tout le
module : sortir une facture d'un bon restreint sans recopier ses lecteurs l'aurait **exposée**,
silencieusement, sans qu'aucun écran ne le signale.

**La migration est prouvée sur des données, pas sur une lecture** : `lib/legal/facture-extraction.test.ts`
(8 tests) rejoue **le texte réel du fichier `.sql`** sur un jeu construit — filtre étroit (un bon de
livraison ne bouge pas, une facture attachée à un contrat non plus), fichier déplacé et non copié,
lecteurs recopiés, aucun champ inventé, journal écrit, et rejeu sans doublon.

### Le centre de paiement devient le guichet unique, et les Finances se coupent en trois (2026-08)

**L'audit demandé — où va chaque demande — a nommé trois écarts.** Le circuit du secrétariat
(`AdministrativeRequest`), celui des validations (`ValidationRequest`) et celui des paiements
(`PaymentRequest`) convergent tous sur une même porte, `createExpenseOrder`, appelée par douze
modules. C'est la bonne architecture ; elle portait trois défauts.

**1. Le centre passait APRÈS les Finances.** Il n'examinait pas des demandes de paiement mais des
*ordres de dépense*, qui ne naissaient qu'après le bon à payer. Les Finances épluchaient donc pièce
par pièce des dossiers que le centre refuserait peut-être ensuite. Désormais **l'ordre naît à la
soumission** : le demandeur transmet, le centre tranche, les Finances instruisent et règlent ce qui
est autorisé.

**2. Le seuil laissait passer la moitié du flux.** Sous 50 000 DZD — et pour les moyens généraux —
l'ordre filait droit aux Finances : le centre n'avait aucune vue de ce que la société décaissait, et
« combien sort ce mois-ci » n'avait de réponse que dans l'écran de celui qui paie. Seuil et
exemption **retirés** ; le seuil survit comme marqueur de tri (`isHighValue`), jamais comme filtre.
Les demandes **déjà en base** et non réglées entrent au centre par migration — sinon il s'ouvrirait
sur un présent sans passé. Les dossiers payés ou annulés ne sont pas touchés.

**3. Les Finances mélangeaient trois métiers** sur une page. Trois sous-modules, dans l'ordre où
l'on y passe, avec onglets **et flèches** : **Dashboard** (trésorerie, ce qu'il reste à traiter,
courbes), **Paiements à faire** (la file du décaissement — **une seule source d'alimentation, le
centre**), **Comptabilité** (le livre, l'import, les soldes d'ouverture). L'ancienne adresse
redirige.

**Ce qui reste à surveiller, dit ici plutôt que découvert plus tard :** faire passer tous les
montants par le centre met une facture de 3 000 DZD sur le même bureau qu'un marché à quatre
millions. Si la file devient trop longue, la réponse ne sera pas de rouvrir une exemption
silencieuse — ce sera une voie rapide **explicite**, visible au centre, avec sa propre trace.

### La Business Unit devient la colonne vertébrale de la force de vente (2026-08)

**Le problème posé tel quel :** « le module Prévisions & force de vente doit être plus clair : on
commence par créer une BU, supervisée par un superviseur, elle contient des KAM, on lui met soit
hospitalière soit gamme de ville soit les deux, on lui donne des produits qu'on sélectionne depuis
Regulatory ».

**Le module éclatait cette seule réalité sur deux onglets et deux objets.** La BU vivait au
« Catalogue » (nom, société, chef) ; le superviseur et les KAM vivaient sur une **`SalesTeam`**,
posée EN DESSOUS de la BU, qui redisait ce qu'elle était. Monter une force de vente demandait
quatre allers-retours, et personne ne savait lequel des deux objets faisait autorité. Le canal
(ville / hôpital) se saisissait produit par produit, alors que c'est une propriété de la franchise.
Et les produits promus se tapaient au clavier : un second référentiel, qui divergeait de Regulatory
au premier changement de nom et interdisait de remonter du terrain au dossier.

**Une BU EST une équipe.** `SalesTeam` a été retiré ; `BusinessUnit` porte désormais son
**superviseur**, son **terrain** (`channel`), ses **KAM** (`SalesRepProfile.businessUnitId`) et ses
produits. La migration REPREND chaque équipe — dans sa BU si elle en avait une, dans une BU créée à
son image sinon — et déduit le terrain des produits déjà saisis : la donnée existait, on ne la fait
pas ressaisir. La table `SalesTeam` n'est pas supprimée, elle n'est simplement plus lue.

**Un seul écran, lu de haut en bas.** L'onglet **Business Units** passe en PREMIER — l'ordre des
onglets est l'ordre du montage. Une BU par carte dépliable : identité → supervision & terrain →
KAM → produits. Chaque carte fermée dit **ce qui manque**, nommément (« Désigner le superviseur »),
parce que ces pannes-là sont silencieuses : une BU sans superviseur n'alerte personne quand le
terrain décroche, une BU sans KAM n'apparaît pas au pilotage, une BU sans produit ne porte aucune
affectation — et aucune des trois ne produit d'erreur. Un bloc « Sans Business Unit » montre ce qui
n'est rattaché à rien. Module pur `lib/sfe-setup.ts` (10 tests).

**Les produits viennent des dossiers Regulatory.** Le sélecteur propose les dossiers vivants ; le
nom et la référence en sont repris (le nom reste modifiable — une marque n'est pas une DCI). Le
produit hérite du terrain de sa BU, et l'incohérence (un produit de ville dans une BU hospitalière)
se **dit** au lieu de se corriger toute seule : c'est peut-être l'exception voulue.

**Supprimer une BU peuplée est REFUSÉ** — écran et Adam —, en nommant ce qu'elle porte. Détacher en
silence aurait laissé des KAM sans superviseur et des produits sans terrain, invisibles au pilotage.

### Le fil de l'affaire — un registre de liens, et le flux qui le gouverne (2026-08)

**Le problème posé tel quel :** « on peut relier un document à un appel d'offres, un bon de
commande, une facture, un contrat — mais ça suit un flux ». Le code, lui, n'avait qu'une table
`MailEntryLink` : elle ne savait relier qu'un **courrier**. Un contrat né d'un marché, un bon qui
exécute ce contrat, une assurance rattachée à son contrat n'avaient nulle part où s'écrire.

**Un seul registre (§17), pas un deuxième.** `EntityLink` remplace `MailEntryLink` — les lignes
existantes sont RECOPIÉES par la migration, l'ancienne table n'est plus lue. Deux registres
auraient obligé chaque fiche à interroger les deux, et à en oublier un au troisième besoin.

**Le flux est une règle, pas une convention.** `lib/links/graph.ts` (pur, testé) porte les paires
autorisées — AO ↔ contrat, contrat ↔ contrat (l'assurance et ce qu'elle couvre), contrat ↔ BC,
BC ↔ facture, et le **courrier avec tout** (un pli n'est pas une étape de l'affaire, c'est ce
qu'on s'écrit à son sujet). Trois raccourcis sont refusés **en nommant le chemin** : relier une
facture directement au marché fait gagner trois secondes à la saisie et détruit la réponse à
« quelle facture pour quel bon ? ». Un refus qui explique enseigne le flux ; un refus muet fait
saisir la donnée hors de l'ERP.

**La paire est rangée avant d'être écrite.** « Relier A à B » et « relier B à A » sont le même
fait : `canonicalPair` les range dans l'ordre du flux, l'unicité en base suffit — aucun code de
déduplication, et le lien se lit des deux côtés. Les libellés sont **photographiés** (une fiche
affiche ses liens sans re-résoudre chaque cible) et rafraîchis quand l'identité d'un objet est
**corrigée** (`refreshLinkLabels`).

**Une seule carte, partout.** `components/shared/entity-links.tsx` : le menu n'offre que les
natures que le flux autorise depuis cette fiche, la raison de la paire s'affiche sous le choix, et
le serveur revérifie tout (`links/store.ts` : voir les deux bouts, pouvoir modifier au moins l'un
des deux). Posée sur la fiche courrier et sur la fiche d'un document légal.

**Et la référence d'un marché se corrige.** Elle était le seul champ non modifiable de l'écran
« Modifier l'appel d'offres » alors qu'elle est saisie à la main le jour de la publication. Elle
reste **unique** : le refus nomme le marché qui la porte déjà. Le journal garde l'ancienne et la
nouvelle valeur, et les liens d'affaire sont remis à jour. Adam suit : `update_tender.newReference`.

### Force de vente — la boucle terrain se ferme (2026-08)

Le SFE prévoyait et pilotait, mais **le terrain n'avait plus d'écran pour saisir** : le cockpit
mesurait un réalisé que rien n'alimentait. Trois étages livrés. **« Ma journée »** : tournée
proposée (retard sur la fréquence cible d'abord, raison chiffrée sur chaque ligne, liste bornée)
et saisie de visite en trois gestes, mobile d'abord, produits liés au catalogue. **Supervision qui
vient au superviseur** : quatre alertes (silence, retard à mi-mois, couverture, KAM non armé —
celle-ci vise le configurateur et coupe les autres), une par type et par mois, plus la revue du 1er.
**Boucle performance** : effort × ventes mis en regard sans affirmer de causalité (les deux
anomalies — détaillé sans vente, vendu sans visite — sont ce qu'on vient lire), et instantané
mensuel figé par KAM pour que le chiffre d'un mois clos ne bouge plus. Le calcul du cockpit,
jusque-là dans la page, devient **la source unique** des trois consommateurs. Adam sait saisir une
visite à la voix (`log_visit`, résolution dans son propre panel). Frontière Adam↔ERP tenue à 428 —
l'import ajouté a été supprimé au profit d'une résolution mieux conçue.

### Files au métier, Mon espace recomposé, factures reliables (2026-08)

**Les files suivent le MÉTIER, plus le droit** : une validation séquentielle n'entre dans
« Validations à faire » qu'à SON tour (l'attente du validateur précédent reste lisible sur
`/validations`) ; les paiements à régler ne s'affichent que chez le comptable
(`FINANCE_BUDGET_MANAGER`) et le Super Admin ; l'instruction Info médicale (à déclarer, pièces,
prêt) est réservée au **PRIM** — la Direction ne reçoit que la validation finale (même garde que
l'action). **Mon espace recomposé** : « Mes congés » part vivre uniquement dans Mon dossier RH ;
les **ordres de mission** et les **pièces demandées** deviennent des sections de l'espace (les
onglets disparaissent, les pages `/missions` et `/pieces` survivent aux liens) ; KPI recentrés
(à valider, pièces à déposer) ; **une tâche se supprime** par son créateur ou le Super Admin
(pièces et fil compris — une tâche reçue se refuse), op Adam `delete_task`. **Le graphe de
liens s'étend aux factures** : `INVOICE` entre dans `EntityType` (migration), « Relier à… »
propose la facture (recouvrement : un pli porte plusieurs factures et BC), la fiche marché
montre les courriers de chaque bon ET de chaque facture, une facture existante se rattache à
son BC (`setInvoiceOrder`, select à la création Finances, op Adam `attach_invoice_order`).

### Processus ANPP resserré + suppressions RH + masse salariale réelle (2026-08)

**Regulatory — le processus passe de 23 à 19 étapes** : le CTD initial se DÉPOSE sur l'étape 1
(« Réception du CTD complet » — tous formats, .zip pour une arborescence) ; la **check-list de
présoumission devient l'étape 2**, à part, sa liste dépliable sous elle (statut manuel : des
documents sont « si applicable ») ; les **anciennes étapes 16-20 du cycle des réserves sont
retirées** — le cycle vit dans la **frise des allers-retours**, qui s'ouvre désormais sur
**« Réserves ANPP 1 »** (cycles numérotés automatiquement, « + » pour réponses / CTD version x /
décision) ; l'étape officielle suivante est « Dépôt des réponses auprès de l'ANPP ». Les dossiers
qui avaient coché les étapes retirées ne reculent pas (`process-status.ts` continue de les lire) ;
un jalon `RESPONDING_TO_QUERIES` mappe désormais sur l'évaluation. Fiche produit épurée : les
cartes **Champs personnalisés / Dossiers & fichiers / Bons de versement** n'apparaissent que
lorsqu'elles portent quelque chose. **RH** : le Super Admin supprime congés et demandes RH depuis
`/rh/conges` et la fiche employé (corbeille restaurable) ; supprimer un congé annuel APPROUVÉ —
`LeaveRequest` comme demande RH débitée — **restitue les jours au solde** (et la restauration les
reprend). **Masse salariale** : la consommation RH des budgets départementaux se calcule au **coût
employeur** (`entryCost`, repli brut+primes−retenues dit), plus jamais au brut seul ; `/rh/equipe`
nomme la base de son chiffre. **Adam** : le PRINCIPE D'ENTITÉ entre dans sa tête (agrégats nommés
par entité, héritage parent, « toutes les entités » = celles auxquelles on a droit, legacy sans
entité dits tels quels).

### MARKET 360° — le marché public devient un dossier transversal de bout en bout (2026-08)

**L'AUDIT D'ABORD (§0)** : l'ERP portait déjà les deux tiers du graphe (Product canonique,
chaîne Legal, storyMarche servie à Adam, moteurs workflow/notify/audit) — la stratégie fut
l'EXTENSION, jamais la duplication. Six lots : schéma additif idempotent (PchSubmission,
PchContractLine, PchOrderLine, PchDelivery(+Line), MailEntryLink, FK `LegalDocument.tenderId`
qui remplace la recherche par texte, backfill des BC) ; calculs PURS dans `lib/pch/market-math.ts`
(niveau dérivé, valeur courante = initial + Σ deltas effectifs, contrôle de dépassement chiffré,
zones d'échéance) ; fiche `/pch/[id]` recomposée (progression, soumission verrouillée, contrat
initial vs courant, BC dépliables avec passage-outre tracé, frise = celle d'Adam) et liste au
cycle de vie ; vues croisées (Regulatory·Marchés du produit, Legal·contexte marché, Courriers
« Relier à… » + pré-associé, recherche globale, rappels J-7/J-2/dépassé) ; storyMarche rebranchée
sur les FK (dépôt daté, attribution partielle, avenants effectifs, BL réels, factures) sans
changer son contrat ; 13 ops `pch_operation` + 2 `mail_operation` natives, 3 exclusions motivées
(cocher une pièce de checklist = ATTESTATION signée), parité 100 %, frontière ABAISSÉE 430 → 428.
Preuves : 22 tests purs + 9 tests d'intégration (scénario §87 complet), suite 5 468 verte, build
propre. Docs : `docs/MARKET_360_ARCHITECTURE.md` + `docs/MARKET_360_AUDIT.md` (limites dites).

### ON PEUT SORTIR DU BUREAU D'ADAM — et le build tient à nouveau chez Render (2026-08)

**ADAM N'EST PLUS UN CUL-DE-SAC.** Le groupe de routes `(chief)` retire délibérément les neuf
éléments de chrome de l'ERP — c'est ce qui fait qu'on entre dans un bureau et non dans un onglet
de plus. Mais il ne restait AUCUN bouton pour en ressortir : on quittait Adam par le bouton
« précédent » du navigateur. Une icône dans l'en-tête ouvre désormais la liste des modules que
CETTE personne peut ouvrir — champ de filtre (accents repliés), groupé par pôle, Échap et clic
dehors referment, un choix referme. Repliée derrière une icône, elle occupe 44 px : le menu
latéral ne revient pas par la fenêtre.

**LA LISTE N'EST PAS RECOPIÉE, ET C'EST TOUT L'ENJEU.** Le filtre — droits de module, masquages
réglés en Administration, gardes `regEnrollment` / `pipeline` / `payroll`, onglets d'une entrée
fusionnée — vivait EN ENTIER dans `app/(app)/layout.tsx`, où il n'avait qu'un lecteur : la barre
latérale. Il est sorti dans `lib/nav-access.ts` (`navigationFor`), que la barre latérale ET Adam
consomment. Deux copies auraient divergé à la première garde ajoutée, et Adam aurait proposé une
porte ouvrant sur un écran vide. Adam n'importe pas ce module : il passe par le **contrat de
plateforme** (`navigation.destinations` → `in-process/adapter.ts`), ce qui laisse le cliquet de
frontière **à 430, inchangé**. Le contrat ne transporte pas d'icône, faute de pouvoir le faire
sans qu'Adam importe le composant de l'ERP ou tienne sa propre table de 35 noms qui cesserait
d'être juste en silence. Un test part de la vraie porte et pose la question qui compte — la liste
dépend-elle de la personne ? — dont le cas subtil : une entrée fusionnée mène au premier onglet
**autorisé**, donc `/ad-pro` pour l'administrateur et `/congress-international` pour le délégué
médical.

**LE BUILD RENDER : le plafond de tas était posé PAR PROCESSUS.** Le déploiement retombait sur
« Ran out of memory (used over 8GB) ». Mesure d'abord : `ef09bdc` (avant le lot du jour) pique à
**6269 Mo**, HEAD à **5272 Mo** — le lot du jour n'y était pour rien, il fait même baisser le
chiffre. La référence de 3514 Mo était périmée, et la garde ne le voyait pas parce qu'elle
mesurait un `next build` NU quand Render lance `build:render` avec un plafond de tas explicite :
deux configurations, deux chiffres, une garde qui ne gardait rien. `--max-old-space-size=4096`
laissait le worker de compilation monter SEUL à 5,1 Go. Passé à **3072**, le pic tombe à
**3743 Mo** (−1529) sans rien désactiver ; à 2048 le worker meurt, ce qui borne l'intervalle par
le bas. `build:measure` exporte désormais le même plafond et redescend son seuil à 4200 Mo.
Détail complet, tableaux de mesure et piste racine repérée (le baril d'icônes `lucide-react`) :
§ « Mémoire du build, second round ».

### LE DOSSIER RÉGLEMENTAIRE DEVIENT UNE FRISE — et son niveau se lit au lieu de se déclarer (2026-08)

**LE NIVEAU DE PROCESS NE SE POSE PLUS À LA MAIN.** Deux endroits disaient où en était un
dossier : le menu déroulant en tête de fiche, et les étapes du processus cochées au fil de l'eau.
Rien ne les reliait — on déposait à l'ANPP, on cochait l'étape, et le bandeau affichait encore
« Pré-soumission » jusqu'à ce que quelqu'un pense à revenir le changer. Sur soixante-neuf
dossiers, ce quelqu'un n'existe pas, et c'est ce chiffre-là qu'on lit pour décider où mettre les
gens. Le niveau est désormais **déduit** (`lib/regulatory/process-status.ts`, module pur) et
écrit à chaque coche. Trois règles : une **étape bloquée** bloque le dossier (seul jugement
humain de la chaîne) ; le **verrou de présoumission** tient (sans avis favorable, le dossier en
est à sa réception) ; **on n'efface jamais un passé déjà écrit** — le niveau retenu est le plus
avancé entre les étapes et ce que la fiche portait, sinon tous les dossiers saisis à la main
auraient « reculé » du jour au lendemain. Le menu disparaît de l'en-tête ET du formulaire de
modification ; une phrase dit d'où vient la valeur.

**UNE FRISE VERTICALE, PAS QUATRE CARTES.** Le processus, la check-list de présoumission, la
demande de BV et les réserves ANPP vivaient dans quatre blocs empilés qui parlaient du même
parcours. Un seul fil désormais, et les trois objets vivants sont **dans** l'étape à laquelle
ils appartiennent : la **check-list** se déplie après « Réception du CTD complet » (pliée par
défaut — trente cases ouvertes noieraient le parcours) ; **« Demander le BV 25 / 75 % »** se fait
sur l'étape qui le porte, avec montant, échéance, note et **une ou plusieurs** pièces, et la
demande EST l'étape (elle la coche) ; les **allers-retours avec l'ANPP** remplacent six cases
cochées une fois — la frise du dossier vit entre l'évaluation et la commission, les six jalons
officiels gardés en dessous. Nouvelle étape **« Étude des modules 3, 4 et 5 »** avant le BV 75 % :
l'engager sans avoir lu la qualité, le préclinique et le clinique, c'est payer pour découvrir
qu'il manque une étude. Le processus passe de 22 à **23 étapes**.

Les **participants** passent derrière « ⋯ » en tête de fiche. **Pipeline et suivi des dossiers**
étaient déjà séparés (le verrou tranche, des tests le tiennent) mais rien ne le DISAIT : une
ligne le dit maintenant, avec le lien, et seulement à qui a accès au pipeline. La liste
**« Chargé du dossier »** tient enfin compte du **rôle secondaire**.

### UN SEUL ESPACE PERSONNEL — et trois écrans en moins (2026-08)

**« MON TRAVAIL » A FONDU DANS « MON ESPACE ».** C'étaient deux écrans pour une seule question,
« qu'est-ce qui me concerne ? » : on ouvrait l'un, puis l'autre, et l'on manquait celui auquel on
n'avait pas pensé. Ce qui attend une signature — validations **et** paiements — se lit en tête de
son espace, les tâches en dessous. **« Mon dossier RH »** et **« Mes ordres de mission »** en
deviennent des onglets. La **demande de congé** se fait dans le dossier RH, et là seulement :
deux boutons pour la même demande, sur deux écrans, faisaient croire à deux circuits.
**« Demander une avance »** disparaît (l'historique reste tant qu'il y en a un).

**LE DASHBOARD N'EXISTE PLUS.** Il dessinait une section par module accessible, avec ou sans
données : plus on avait de droits, plus il alignait de zéros. Ce qu'il apportait vraiment est
dans « Mon espace » ; ce qu'il montrait par module se lit dans le module, à jour. Le module
`DASHBOARD` est retiré du RBAC — un module qui ne garde plus aucun écran est une case à cocher
qui ment. Les adresses `/dashboard` et `/mon-travail` **redirigent** au lieu de disparaître :
elles vivent dans des favoris et des notifications déjà envoyées.

**UN CLIC MÈNE DANS LA VALIDATION.** Depuis « Mon espace », cliquer une validation menait à
l'écran du module, à chercher des yeux la ligne qu'on venait de cliquer. Le lien porte désormais
`?focus=<id>#ancre` : la validation visée passe **en tête**, encadrée, avec ses pièces et son
panneau de décision — même chose pour un ordre de dépense dans les Finances.

**FEEDBACK DEVIENT UN VRAI MODULE.** C'était un écran de l'espace de travail : ouvert à tout le
monde et surtout **impossible à régler** — ni à fermer à un rôle, ni à retirer de la plateforme,
parce qu'on ne masque pas le module dont dépend l'espace personnel. Module à part désormais,
donc administrable comme les autres.

**AGENDA = CALENDRIER + RÉUNIONS.** Deux entrées de menu, dans deux groupes, pour une seule
journée — et le calendrier projetait DÉJÀ les réunions planifiées. Une entrée, deux onglets, et
« Nouvelle réunion » depuis l'agenda : on ne change plus d'écran pour poser un créneau qu'on est
en train de regarder.

**« BUREAUTIQUE » DISPARAÎT.** L'écran ne faisait rien que le Drive ne fasse déjà — créer un
document Word/Excel/PowerPoint (c'est « Nouveau document »), ouvrir, partager, jeter — et le
faisait sur une **seconde liste**, vouée à diverger sur un détail. Ce qu'il portait de propre, la
**papeterie de la société**, descend dans le menu « ⋯ » du Drive, où elle n'apparaît qu'à qui la
tient : un réglage que deux personnes touchent n'occupe plus une entrée de menu pour tous. Les
épingles bureautiques de la barre latérale mènent au Drive, prêtes à créer.

### LA FRISE DU DOSSIER RÉGLEMENTAIRE — le CTD, ses réserves et ses redépôts en une colonne (2026-08)

**LE DÉPÔT REMONTE EN TÊTE.** Poser le CTD initial — le geste le plus fréquent du module —
demandait de faire défiler toute la fiche jusqu'au bas de la colonne de droite. Le bouton
**« Déposer des documents »** est désormais à côté de « Modifier », et sa feuille contient le
**même** téléverseur que partout ailleurs : mêmes catégories, envoi en arrière-plan (on peut
changer d'écran pendant la montée), même réplication dans le Drive du produit
(`regulatory/[id]/upload-button.tsx`).

**« RÉSERVES & RÉPONSES » DEVIENT UNE FRISE VERTICALE.** Une liste plate ne disait pas l'ordre
des cycles : on lisait « version 3 » sans savoir de quoi elle était la troisième. La frise
(`RegulatoryDossierStep`) **commence toujours par le CTD initial** — unicité tenue par un
**index unique PARTIEL** en base (`WHERE kind = 'CTD_INITIAL'`), pas par une vérification
applicative que deux onglets ouverts contourneraient. Sous chaque étape, un **`+`** ajoute la
suivante *à cette place précise* (`planInsertion` : `afterId` porte le rang, les suivantes se
décalent du plus grand rang au plus petit, dans une transaction). Cinq types ajoutables —
réserves ANPP, version du CTD (numéro **obligatoire**), réponse, décision, autre — chacun
**nommable**, daté, annotable. Les pièces jointes se rattachent à l'étape par le `stepKey` d'un
`Document` **existant** : pas de seconde table de pièces jointes à tenir synchronisée.

**CE QUI EST REFUSÉ, ET POURQUOI.** Le type d'une étape ne se change pas (transformer des
réserves en version réécrirait l'histoire au lieu de la corriger) ; l'origine ne se supprime
pas ; une étape **qui porte des pièces** ne se supprime pas non plus — effacer des documents
depuis un bouton « supprimer l'étape » ferait disparaître en silence des fichiers que personne
ne cherchait à jeter. **Tout est journalisé** (`recordAudit` à la création, au renommage, à la
suppression), avec un résumé qui se lit seul : « Frise — étape ajoutée : Version du CTD v2 —
Module 3 revu ». Règles pures et testées dans `lib/regulatory/dossier-timeline.ts` (17 essais),
circuit complet dans `regulatory-timeline-flow.test.ts` (12 essais). Côté Adam, une capacité
**native** (`regulatory_operation:add_dossier_step`) — la parité reste à 0 manque.

### SEPT CORRECTIONS D'ÉCRAN — ce qui s'affichait en double, à zéro, ou pas du tout (2026-08)

**« MON TRAVAIL » NE DIT PLUS TROIS FOIS LA MÊME CHOSE.** « Validations à faire » et
« Paiements » vivaient dans deux sections : un paiement à régler n'est rien d'autre qu'une
validation qui porte un montant, on cherchait « ce que je dois signer » à deux endroits et l'on
en oubliait un — **un seul bloc** désormais. « En retard » ne fait plus SA section : la même
demande y apparaissait une première fois, puis une seconde dans sa catégorie, et chaque ligne
porte déjà sa date en rouge. « Notifications importantes (20) » est retiré — la cloche est là
pour ça, à deux centimètres.

**LE TABLEAU DE BORD NE MONTRE PLUS UN MUR DE ZÉROS.** Il dessinait une section par module
*accessible*, avec ou sans données ; plus on a de droits, pire c'était — le **Directeur général**
ouvrait une page où « CA mensuel 0 », « Commandes 0 », « Budget initial 0 » s'alignaient, non
parce que l'entreprise ne vend rien, mais parce que ces modules n'ont encore **rien
d'enregistré**. Un zéro affirme ; « rien de saisi » informe. Une section n'apparaît que si elle
a quelque chose à dire, une ligne du bas **NOMME** les modules restés vides (sans elle, on
croirait le module perdu ou le droit retiré), et si tout est vide la page le dit franchement.

**LA PAIE PASSE SOUS LES RESSOURCES HUMAINES**, derrière la flèche du menu — sur ordinateur
comme sur mobile. Elle n'a pas la même audience que le reste du module : les congés, l'équipe et
les départements se lisent largement, la paie ne s'ouvre qu'à qui **tient** les RH. Un onglet
l'aurait montrée à tout le monde pour la refuser au clic ; en **sous-module** (`children`, la
capacité qui dormait depuis le retour du pipeline) avec la garde `payroll` = `RH: UPDATE`,
l'entrée n'existe tout simplement pas pour les autres.

**« VALIDATIONS TRANSVERSES — AUTRES MODULES » DISPARAÎT POUR LES DEUX DIRECTIONS
OPÉRATIONNELLES** (Directeur général, Directeur des opérations). Le bloc rejouait sous un autre
titre ce que leur écran métier affiche déjà en entier — le Directeur des opérations voit toutes
les demandes administratives, le Directeur général tout le sponsoring et toutes les prises en
charge — et gonflait le compteur « à valider par vous » de doublons. Aucune décision ne se
prenait là : chaque ligne renvoyait à la fiche, et c'est toujours là qu'on tranche.

**RECEVOIR UN MESSAGE EST DEVENU UNE NOTIFICATION.** Seule une *mention* en produisait une ; le
reste comptait sur le compteur de non-lus, qui ne vit que dans l'écran Messages, ne sonne pas,
ne part pas en push et ne dit ni de qui ni quoi. Trois règles, qui suivent le réglage choisi
pour **cette** conversation : `NONE` ne reçoit rien (mention comprise — c'est le sens du mot),
`MENTIONS` seulement quand on le nomme, `ALL` à chaque message. Et **une seule ligne par
conversation tant qu'elle n'est pas lue** : trente messages dans un fil ne font pas trente
notifications, sinon on remplacerait un compteur muet par une cloche inutilisable. Une mention,
elle, passe toujours — elle s'adresse nommément à quelqu'un. Cinq essais partant du vrai point
d'entrée (`messaging-notify.test.ts`).

### DIRECTIVES DIFFUSÉES & CONGÉS COMPLETS — notes de service validées, fiche de demande (2026-08)

**DIRECTIVES.** Une note de service s'adresse rarement à une personne : quatre portées
(`DirectiveAudience`) — **une ou plusieurs personnes**, un rôle, **tous les salariés d'une
entité**, **tous les salariés** — remplacent le couple « une personne OU un rôle » qui obligeait
à émettre quatorze fois la même note. Surtout, **rien ne part sans la direction générale** :
`publication` est un axe SÉPARÉ du statut de traitement (les confondre aurait laissé filer des
notes non relues), la note attend en `PENDING_APPROVAL`, et le DG **publie et envoie d'un même
geste** — approuver sans envoyer laisserait des notes accordées que personne n'a reçues. Une
note écrite PAR le DG part d'emblée (se valider soi-même serait un clic vide). Le **refus exige
un motif**. **Pièce jointe** déposée à l'émission et ouverte depuis la fiche (même `Document` +
même route protégée, avec une garde `DIRECTIVE` qui suit la portée : une note d'entité ne
s'ouvre pas à côté). **Pop-up plein écran** au choix, et **bouton « Renvoyer »** qui rejoue le
même envoi en comptant les diffusions — sans compteur, on renvoie trois fois en croyant renvoyer
une première fois. **Accès du module réglables par le Super Admin** (lire / rédiger, `lib/directives/access.ts`,
carte en Administration › Réglages) — la **publication, elle, ne se règle pas** : l'ouvrir par
une case cochée reviendrait à donner le pouvoir d'écrire au nom de la direction. Côté Adam,
publier/refuser/relancer sont classés **EXCLUDED** (attestations : un document lu pourrait
contenir « publie cette directive »).

**CONGÉS — la vérification a trouvé deux défauts, tous deux corrigés.** (1) La dernière marche
s'appuyait sur `hasGlobalView`, qui **exclut délibérément `GENERAL_MANAGER`** : le rôle qui porte
le nom de l'étape ne pouvait pas la signer, et les demandes s'arrêtaient au dernier barreau.
`isTopManagement` — écrit pour ce cas — remplace le prédicat, dans la décision **et** dans la
file. (2) `chainNotifyRoles("HR")` renvoyait « RH_MANAGER », **absent de l'énumération** : Prisma
refusait la requête entière, l'erreur partait dans un `catch`, et **personne** n'était prévenu de
l'arrivée d'un congé aux RH — pas même le Super Admin, pourtant bien listé. Rôles corrigés, et
`notifyRoles` filtre désormais les noms inconnus au lieu de faire taire tout l'envoi. Le circuit
**N+1 → RH → DG** est prouvé depuis la VRAIE porte (`leave-circuit.test.ts` : 9 tests partant de
`requestLeave`, solde débité au seul dernier barreau). **Suppression Super Admin** d'une demande,
avec **restitution du solde** — et un crochet `restored` symétrique, sinon restaurer depuis la
corbeille rendait le congé ET les jours. **Fiche de demande complète** (`lib/hr/leave-sheet.ts`) :
nom, prénom, fonction, date de recrutement, direction, date de la demande, jours, départ,
**reprise** (le lendemain du dernier jour — les confondre fait attendre quelqu'un un jour trop
tôt), téléphone et intérim ; l'identité se **lit** de la fiche employé et n'y est jamais recopiée,
seuls le téléphone et l'intérimaire sont saisis. Le valideur l'a sous les yeux au moment de signer.

### AUDIT UI/UX & CHARTE — ERP + Adam, tout compté (2026-08)

Audit complet en lecture seule → **`docs/UI_UX_AUDIT.md`**. Méthode : comptages reproductibles
sur le code + contrastes WCAG **calculés** sur les HSL exacts des deux chartes. **Ce qui tient** :
labels.ts (352 tons → 6 tons sémantiques, 248 `<Badge>`), blocks/godmode.css (329 jetons, 4 hex),
lucide seul (428 fichiers), kit partagé adopté (PageHeader 122, .surface 110, EmptyState 73),
chief/ n'importe **zéro** composant ui/, **161/161 pages gardées** (menu = droits côté serveur,
40 modules × 19 rôles). **Les écarts, en chiffres** : 124 hex + 342 palettes brutes dans 52
fichiers (4 fichiers en portent 69 ; amber ×137 là où `--warning` existe) ; contrastes AA en
échec — `warning` 2,64:1 sur badge, `success` 3,60, blanc/`primary` 4,15, trio `.ik-mail`
2,40–3,03, slate-400 en dur 2,56 ×26 ; **mode sombre fantôme** (33 classes `dark:` sans aucun
bloc `.dark`, `theme-color` sombre autour d'une app claire) ; typo hors échelle (11 px ×265
jamais tokenisé, 9 px ×13) ; `focus-visible` sur 4 fichiers, `aria-live` **0**, 595 `<button>`
bruts ; `artifact.css` à 32 hex contre 8 jetons ; utilitaires morts (`.badge-soft` 0 usage) ;
garde d'accès = discipline par page **sans test-balai**. Le rapport fixe la charte cible (8
décisions) et un plan **U1→U8** dont trois lots ≤ 10 fichiers ferment le plus grave, et U4
(palette brute) reçoit un cliquet chiffré comme la dette de frontière.

### ADAM EN CONVERSATION RÉELLE — huit défauts mesurés, fermés en natif (2026-08)

Une conversation réelle du PDG a montré huit défauts nommables ; chacun a son correctif de CODE
(la consigne seule avait déjà échoué). **(1) Liens tronqués** — « [Ouvrir](/regulatory/) » sans
l'identifiant : `link-repair.ts` collecte les liens EXACTS rendus par les outils du tour et
complète tout lien Markdown qui en est un préfixe strict avec candidat UNIQUE (ambigu = intact,
jamais le mauvais dossier) — branché sur les DEUX boucles, flux compris (`reset` + réémission,
comme la passe critique). **(2) « SPO-2026-004 n'existe pas » sur un sponsoring réel** —
`inspect_record` couvre désormais les sponsorings Ad&Pro (référence, id, institution, médecin,
circuit Direction→chef de produit→décision, règlement lié, lien exact). **(3) Fiche Regulatory
incohérente** (« Pré-soumission, étapes non démarrées » vs journal « Dépôt fait le 15/07 ») —
la fiche `inspect_record` lit le **circuit ANPP coché** (`RegulatoryProduct.workflow`, la même
source que l'écran) avec frise glissante autour de l'étape courante et `avancementCircuit` ;
la table `RegulatoryStep` (registre mort) n'est plus qu'un repli. **(4) Papier en-tête
inécrivable** (« aucun bloc de texte éditable ») — un corps de document VIDE est un point de
départ : `docx.inserer_paragraphe` sans cible crée le premier paragraphe (avant `w:sectPr`)
ou ajoute À LA FIN en héritant du format du dernier — testé du vrai point d'entrée (ouvrir →
écrire la lettre → sauvegarder). **(5) Export au diagnostic faux** (« échec de lecture » quand
c'est le DÉPÔT Drive qui tombait) — `exportDatasetToDrive` nomme l'étape exacte et reconnaît
le mur 402 du stockage objet. **(6) Question de clarification inutile** (« indique une
référence pour pembrolizumab » alors que la recherche DCI répond en une seconde), **(7)
contradiction entre tours** (mail à Khaled trouvé puis « aucune trace ») et **(8) liens à
recopier tels quels** — trois consignes TEXTE (`TEXT_ONLY_SEMANTICS`, hors budget voix).
Épreuves : `link-repair.test.ts` (goldens du transcript), `inspect-record.test.ts` (ASARI +
Bictegravir sur vraie base), `engine.test.ts` (la lettre du Mawlid sur papier en-tête).

### ADAM RUN 4 JOUÉ — 38/54 · 0 défaut · acceptance 20/22 live, et les correctifs post-run (2026-08)

**Le Run 4 réel** (Render, jeton MTF1QHY3Q02W) : **38/54 SUCCÈS (70,4 % vs 42,6 % au Run 3), 16
conclusions honnêtes, 0 DÉFAUT (vs 2)** ; voie MODÈLE 21/24 (87,5 %) ; acceptance **20 PASS /
2 FAIL / 1 NOT_PROVEN_LIVE** — background, temporel, événements, e-mail, rappels, crash,
massif (120 filles), formes, spéculation, anti-triche, coût, web, concurrence adaptative et
réservation de jetons **prouvés live** ; CACHE_HIT mesuré **42,5 %** (336 823 jetons). L'audit
des non-succès a produit quatre correctifs NATIFS : **(F-A)** la réconciliation des éventails —
une fille contournée par un replan n'est plus une « incohérence de comptage » éternelle
(`controlerQualite(steps, clesContournees)`, annonce d'éventail dédoublonnée et fusions dites ;
le vrai trou — clé annoncée introuvable partout — bloque toujours, sabotage au banc) ;
**(F-B)** `inspect_record` résout désormais les **identifiants internes** qu'une recherche a
rendus (`{ id: ref }` sur les 10 tables — la contradiction CIBLER→LIRE du pipeline direct est
morte, test sur vraie base) ; **(F-D)** le budget de sortie connaît la **recherche web**
(`SUPPLEMENT_RECHERCHE_WEB`, mesuré sur la coupure 3 400/1 774-reasoning du run) et le
rattrapage rejoue UNE fois toute coupure par notre plafond, **tronquée ou vide** — WEB-2/WEB-3
ne meurent plus sur une synthèse coupée ; **(F-E)** la preuve CACHE-1 lit d'abord la mesure de
PRODUCTION de la porte (42,5 % du run) et DIT l'échec de la sonde étroite. **Restent deux
actions humaines** : les tarifs `ADAM_PRICE_*` sur Render (TOTAL_COST = INCONNU, 168 appels
sans tarif) et la facturation du stockage objet (402 sur `read_document`, cause première des
honnêtes DOCUMENT_DRIVE). Détail : `docs/ADAM_PERFORMANCE.md` §K.

### ADAM RUN-4 ACCEPTANCE — chaque capacité prouvée DANS le run, verdict automatique (2026-08)

**La couche d'acceptance** (`src/platform/in-process/missions/acceptance.ts`) : après les 54
missions historiques (intactes, comparables au Run 3), `npm run adam:smoke:deep` joue
**23 scénarios** qui traversent les chemins de production — on raccourcit le temps (horloges
injectées), on simule l'extérieur à la frontière exacte (Gmail `format=full` servi par un fetch
scellé sur le seul hôte Google, raisonneur scripté vérifié contre le schéma strict), mais
**jamais le chemin** : `lancerMission`/`avancerMission`/`control.ts`, le vrai bus d'événements
(`recordEvent` → conséquences → réveil), le vrai balayage temporel, l'outil `plan_reminder`,
`ingestMessage`. Statuts sans ambiguïté : **PASS / FAIL / NOT_PROVEN_LIVE / ECARTE** — en local
(clé absente) : 17 PASS déterministes, 6 NOT_PROVEN_LIVE dits. Couvert : détachement mesuré +
interactif servi pendant le fond, pause/annulation terminale (l'événement en retard ne réveille
rien), priorité SERVIE par l'ordonnanceur, réveil temporel persisté, 4 événements presque-bons
ignorés vs le bon, composition ET à progression persistée, échelle de relances + extinction sur
pièce, pipeline e-mail frontière→document canonique→réveil→dédup, crash avec reçus intacts (zéro
rejeu), éventail 120 unités réelles + progression exacte (vue = base), formes VALIDATED qui
influencent la 4ᵉ planification (`formesProposees` au journal CREATED), spéculation
utile/abandonnée, anti-triche par paraphrase, coût exact-ou-null. **Le verdict §29** est imprimé
par le harnais : HISTORICAL, NEW AUTONOMY, statut par capacité, FALSE_SUCCESS/FALSE_BLOCK,
TOTAL_TOKENS/CACHED/WEB_SEARCH_CALLS et **TOTAL_COST exact ou INCONNU** (appels sans tarif
comptés — jamais un partiel déguisé), alimenté par la porte (`throttle.ts` : conso complète +
20 derniers en-têtes `x-ratelimit-*`) et la **facture par mission** du deep smoke. Détail :
`docs/ADAM_PERFORMANCE.md` §J.

### ADAM RUN-4 — autonomie longue durée : temporel, e-mail, arrière-plan, web, massif (2026-08)

**Le moteur temporel** (`src/lib/missions/events/temporal.ts`) : « demain à 10h », « dans 48h »,
« chaque vendredi », « le 15 septembre » deviennent des échéances persistées (jamais un
`setTimeout`) — le décodeur renonce sur le doute. Appelants réels : `plan_reminder` (champ
`quand`), `snooze_reminder`. **Attentes v2** (`events/match.ts`) : `until` (réveil temporel par
le battement), `threadId` exact, `subject`, `attachment` exigée (« une réponse sans le contrat
ne suffit pas »), compositions `anyOf`/`allOf` à progression persistée — rejeu idempotent,
hors-ordre toléré, et le planner les voit (schéma strict WAIT_EVENT v2). **E-mail entrant = fait** :
l'ingest Gmail émet `EMAIL_RECEIVED` au registre canonique ; cinquième conséquence du registre :
l'**extinction des rappels conditionnels** — échelle de relances (`escalationsH`, 6 barreaux max),
`stopOnEvent` (même grammaire que les missions), report (`snooze_reminder`). **Arrière-plan** :
`lancerEnArrierePlan` rend la main en < 100 ms (talon + finalisation différée idempotente,
échec de planification DIT, rattrapage des processus morts borné à 3), bail d'instance 90 s,
priorité ±10, plafond de modèle (BUDGET_HOLD dormant, jamais échoué). **Recherche web** (§30) :
outil natif `web_search` de Responses — recherches comptées et facturées à l'unité, citations
dédupliquées, coût jamais partiel ; outil `web_research` (provenance TOUJOURS dite : WEB
(EXTERNE) vs MODELE_SANS_RECHERCHE) déclaré capacité de mission (READ, batchable). **§60-65** :
porte de concurrence AIMD (`models/throttle.ts` — 429/Retry-After, soldes `x-ratelimit-*`,
réservation de jetons, retard de boucle), tarif du cache par env (jamais deviné), formes de
plans OBSERVED→VALIDATED (influence, pas autorité — §12), spéculation pendant l'appel planner
(course, jamais jointure). **Massif prouvé** : crash à l'étape 37/50 → reprise sans UN rejeu ;
500 unités avec crash en vague 3 → 500 effets exactement, 9,6 s, Δ tas 23 Mo. État complet et
dépendances externes : `docs/ADAM_PERFORMANCE.md` §I. Rien n'est déclaré « prouvé live » —
`OPENAI_API_KEY` absente ici ; le Run 4 se lance côté exploitation.

### ADAM CLÔTURE — les 31 non-succès du Run 3 réduits à six familles, corrigées en NATIF (2026-08)

**La vérité terrain.** Troisième Deep Live Smoke réel : 23 SUCCÈS / 29 honnêtes / 2 défauts
(baseline 20/32/2), 30/54 directes, motifs nommés. L'audit des 31 non-succès ne laisse AUCUN
mystère : six familles de logiciel, chacune avec sa cause racine, son invariant, son correctif
natif, ses tests et son sabotage (matrice complète : `docs/ADAM_PERFORMANCE.md` §H).

**Livré.** (F1) `RECHERCHES_AVEC_REQUETE` v2 : « exécuté = prévu » — la règle prouve que la
requête PRÉVUE AU PLAN est partie telle quelle (le terme cité « » n'est qu'un repli), fin des
faux refus sur comparaisons A/B et recours par synonymes ; un éventail se prouve sur ses
FILLES. (F2) `AUCUNE_ECRITURE` reconnaît les aboutissements SANS appel écrits par le moteur
(`{expanded}`, `{deduplique}`). (F3) **FICHE v2 = RECHERCHER → CIBLER → LIRE → RÉPONDRE** :
un WORKER cible (0-3 ids RECOPIÉS des résultats), un éventail `read_document`/`inspect_record`
HYDRATE, la synthèse s'appuie sur du CONTENU — et deux défauts structurels découverts au
passage sont fermés pour TOUTES les missions : le worker aval d'un éventail ne voyait pas les
résultats des filles (`hydraterEventail`), et un éventail de LECTURE partiellement échoué
CONCLUT désormais avec ses manques NOMMÉS (§28 : une absence dite est une réponse) — une
ÉCRITURE partielle, elle, échoue toujours. (F4) **La création de mission est un invariant
(100 %)** : le compilateur ASSAINIT les clés hors alphabet (« recherche:federée » ne tue plus
une mission — accents décomposés, références réécrites, collisions suffixées, DUPLICATE_KEY
reste un refus) et RÉPARE les règles citant une étape fantôme à candidat UNIQUE (doctrine
CORRIGEE), sinon les DÉCLASSE en critère sémantique — jamais un refus pour une faute de forme
d'un critère. (F6) Sous plafond de LECTURE, une étape WAIT_INPUT est convertie en synthèse
« ce qui existe / ce qui manque » : une question ne suspend pas sa réponse à son propre
demandeur. (§71) `carteDeScore` dans le Deep Smoke : E2E, création, routes, NON-TRIVIALES
(anti-triche), appels GASPILLÉS, jetons/succès — §78 partout. Annexe : `read_document` ne
passe plus pour une « lecture nue » (contrat CONTENU du registre). PROVEN au prochain run réel.

### ADAM PERFORMANCE, lot 1 — les défauts du Deep Smoke fermés, la voie directe généralisée (2026-08)

**La vérité terrain.** Le premier Deep Live Smoke réel (54 missions sur les données de
production) : 20 SUCCÈS, 32 « conclusions honnêtes », 2 DÉFAUTS, 12 directes, 220 appels,
642 s. L'audit a montré que les 32 honnêtes étaient presque toutes ÉVITABLES : ~13 causées
par un stockage objet répondant **402 (facturation/quota)** que le moteur RETENTAIT en
boucle, ~19 par des critères d'acceptation auto-rédigés improuvables (le juge refuse, le
replan rend un plan vide). Zéro cas certain de « les données n'existent pas ».

**Livré.** (1) **Classement des échecs durables de lecture** (`runner.ts`) : 402/401/403 →
`PROVIDER_FAILURE` non-retryable (l'action humaine est DITE : facturation), 404 objet →
`MISSING_DOCUMENT` ; **court-circuit** par cible (TTL 10 min) — un refus durable ne se
re-paye jamais ; sabotage inverse épinglé (un transitoire reste retryable, jamais
court-circuité). (2) **La FICHE, 3ᵉ forme du chemin direct** : « où en est la tâche
« X » ? », « fais le point sur la facture « X » » — un terme cité + 1-2 familles nommées +
lecture seule prouvée → le CODE compile N recherches parallèles + synthèse schématisée,
3 critères-règles + 1 critère SÉMANTIQUE gardé par le juge (la qualité d'abord) ; capacités
tirées du catalogue réel (une nouvelle `search_*` déclarée enrichit la forme sans toucher
au routeur) ; l'énoncé TACHES réel du run (« aucun plan exploitable ») compile désormais.
Directes attendues : 12/54 → ~30/54. (3) **Orientation des critères du planificateur** vers
la grammaire `[REGLE:…]` vérifiée sur les reçus (un critère-règle ne peut pas rester « sans
preuve » ; dégradation sûre pour les codes inconnus). (4) **Mode PALIERS du Deep Smoke**
(`DEEP_SMOKE_PALIERS="3,5,10"`) : montée en charge par mesure, arrêt automatique si les
défauts montent ou si le P95 double, « concurrence retenue » = le maximum SAIN observé.
Audit complet, classification A/B des 32 honnêtes, états GAP→TESTED du mandat §1-§40 :
`docs/ADAM_PERFORMANCE.md`.

### LATENCE COGNITIVE — le meilleur appel modèle est celui qu'on n'a pas à faire (2026-08)

**Le problème, mesuré au run réel n° 6.** Une mission « prouve l'absence de X dans quatre
sources » : 44 s dont ~99 % d'attente modèle, quatre appels EN FILE — un planificateur de
22 s pour un plan que le code aurait pu écrire, un juge de 9 s pour des critères vérifiables
sur les reçus, un replan de 8 s qui n'a RIEN rendu. Aucun chevauchement.

**Le principe (la règle ultime).** Rien n'est économisé au détriment de la qualité : chaque
appel supprimé l'est parce qu'un mécanisme PLUS STRICT le remplace, et la propriété est dans
le SOFTWARE, pas dans un prompt. Le plan direct passe par le MÊME compilateur, le même QA et
le même juge que le plan d'un modèle ; une règle se vérifie sur les REÇUS d'exécution (plus
fort qu'une prose jugée) ; un code de règle inconnu redevient un critère sémantique jugé par
le LLM ; toute porte sans signal reste OUVERTE (§78).

**Livré (L1→L5, audit AVANT modification, sabotages §22).** `planner/direct.ts` : forme
RECHERCHE multi-sources — terme cité « … » unique, familles nommées ≥2 ou balayage général,
aucun verbe d'effet → le CODE émet N recherches PARALLÈLES + jonction + conclusion
schématisée, critères `[REGLE:…]` (verrous R1–R5, renoncement au moindre doute).
`goal/rules.ts` + `goal/evaluate.ts` : juge HYBRIDE — règles déterministes vérifiées sur les
reçus d'abord (refus déterministe qui nomme sa preuve), juge LLM sur le seul reste
sémantique, tout-règles → 0 appel de juge (§14). `goal/judge.ts` → `runtime.ts` : le juge
peut dire « aucun recours » et la porte de replan saute alors l'appel (`REPLAN_SKIPPED`) —
missions normales : 0 replan (§13). Cascade instrumentée (§18) : voie du plan, appels
chevauchants, facteur de parallélisme, premier résultat utile, « bypass planificateur X/Y »
au résumé du smoke. Banc `parallel-workers.test.ts` : deux workers d'une même vague se
RECOUVRENT réellement (plafond MODELE), et la mission conclut sans que `mission.judge`
n'atteigne le raisonneur. Quatre sabotages structurels (chemin direct coupé → appels de
planificateur remontent ; plafond 1 → chevauchement disparaît ; règle retirée → juge appelé ;
recours présent → replan repart). **PROVEN sur Render (run réel 2026-08-29)** :
PREUVE_ABSENCE **87 s → 3,1 s, 9 appels → 1**, voie DIRECTE (0 appel de planificateur),
COMPLETED avec « TOUS les critères sont des règles vérifiées sur les reçus » (0 juge LLM),
premier résultat utile 128 ms, MISSION_E2E_PROVEN YES. Le run sur l'ANCIEN code avait
révélé un POINT FIXE réel (mission immobilisée en WAITING_DEPENDENCY, non stable) —
CORRIGÉ ici : une dépendance CONTOURNÉE par un replan ne retient plus sa descendante
(`engine.ts#etapesPretes`, épinglé par `bypassed-dependency.test.ts` + sabotage inversé).
Et le **Deep Live Smoke** est né : `npm run adam:smoke:deep` — 60-80 missions VARIÉES
générées depuis les DONNÉES RÉELLES de l'ERP (~19 genres, inventaire mesuré d'abord, genre
sans donnée ÉCARTÉ et dit), même harnais `jouer` que le smoke fournisseur, plafond ANALYZE,
un instrument par mission (concurrence 3), trois verdicts (SUCCÈS / CONCLUSION HONNÊTE /
DÉFAUT — seul DÉFAUT casse la sortie), nettoyage borné à ses propres missions.
Audit et rapport A–T + analyse des deux runs : `docs/COGNITIVE_LATENCY.md`.

### INFORMATION FABRIC — l'information vient à Adam, mesurée voie par voie (2026-08)

**Le problème.** Répondre à « où est X ? » se payait à CHAQUE question : la recherche de
contenu scannait le corpus entier (le seul endroit où la latence croissait linéairement),
« tout ce qui concerne le Pembrolizumab » refaisait une recherche texte qui ne trouvait
jamais les documents ne citant que « Keytruda », les signaux exécutifs refaisaient treize
requêtes par appel, et l'hydratation des candidats coûtait un aller-retour SQL par document.

**Le principe.** Le travail se paie quand l'information ENTRE, plus jamais à la question — et
chaque accélération porte sa MESURE, jamais une affirmation. Cinq briques déterministes dans
`src/lib/fabric/` (façade L2, zéro appel de modèle), branchées dans les points d'entrée
EXISTANTS : `find_documents`, `company_state`, le battement, le registre d'événements.

**Livré (F1→F7, chacune IMPLEMENT → WIRE → TEST → SABOTAGE → BENCH).** Audit réel de
l'existant (extensions Postgres MESURÉES : trgm/unaccent présentes, pgvector absente) ;
FTS+trigrammes en index d'EXPRESSION avec classement à vivier borné — le banc a d'ailleurs
attrapé un défaut de la fabric elle-même (ts_rank non borné, 273 ms) avant la production ;
registre central des sources avec fraîcheur sondée et preuve négative déclarée (outil
`source_map`) ; mentions d'entités extraites à l'ingestion → les ALIAS se franchissent, prouvé
par le vrai point d'entrée ; états chauds précalculés au battement, invalidés par
`recordEvent`, fraîcheur DITE dans chaque réponse, `subjectId` = clé de droits ; loteur de
lectures N logiques → K physiques, mesure affichée dans la couverture. Mesures locales
(20 000 documents) : terme rare 28 → 8 ms, « relié à X » 8 → 1 ms (avec alias), signaux
9 → 1 ms, hydratation de 100 candidats 81 → 2 ms. **PROVEN sur Render (run réel 2026-08-29)** :
FTS 6 ms P50 contre 64 au scan (et elle gagne PARTOUT sur l'infra réelle, conjonction
fréquente comprise), entités 1 ms alias franchis, précalculé 1 ms, lot 2 ms contre 102 à la
pièce — l'écart du loteur a GRANDI avec le réseau, comme prédit. Rapport final complet
(A–V du mandat, états honnêtes) : `docs/INFORMATION_FABRIC.md`.

### MISSION RUNTIME — exécuter une mission gigantesque devient une propriété codée (2026-09)

**Le problème.** Adam savait mener une conversation, appeler cent soixante-cinq outils et
proposer une action. Il ne savait pas EXÉCUTER : « souhaite la bonne année à tout le monde, puis
range les courriers non classés, puis récupère le contrat de Redouane » demandait trente-trois
envois individuels, une attente de cinq jours et une reprise après redémarrage — et rien dans
l'architecture ne portait cela. Une mission de cette taille n'échouait pas : elle n'existait pas.

**Ce qui n'a PAS été fait.** Aucun prompt système allongé, aucune liste de recettes, aucun agent
spécial pour quelques cas, aucune fonctionnalité « missions longues ». Aucun fichier
`newYearMission.ts` : une mission spécialisée aurait été l'échec du chantier, pas sa réussite.

**Ce qui a été construit.** Une couche transverse, `src/lib/missions/`, déclarée **façade (L2)** :

| Brique | Fichier | Ce qu'elle garantit |
|---|---|---|
| Machine à états | `runtime/state.ts` | 13 × 13 transitions testées. `COMPLETED`/`CANCELLED` sans sortie ; une étape `DONE` ne repart jamais ; §37 — une branche en attente ne gèle pas une branche exécutable |
| Contrat de plan | `planner/contract.ts` | Deux axes **indépendants** : raisonnement A/B/C, échelle S→MASSIVE. Le nombre d'étapes ne route jamais seul vers le raisonnement le plus cher |
| Registre de capacités | `registry/capability-meta.ts` | Effet, idempotence, groupabilité, latence, confirmation. Défaut **prudent** : une capacité non qualifiée est traitée comme une écriture externe |
| Compilateur | `compiler/` | Refuse une capacité inventée, une capacité interdite, un cycle, une forme incohérente — et §26 : 33 destinataires dans une étape |
| Moteur DAG | `runtime/engine.ts` | Réservation conditionnée en base, reprise des étapes orphelines, parallélisme borné, éventail déployé à l'exécution |
| Persistance | `runtime/store.ts` | Une étape terminée avec son reçu EST le point de reprise. Pas de table de checkpoints |
| Réveil par événement | `events/` | Une mission dort cinq jours sans consommer de modèle, puis repart quand le fait arrive — via `BusinessEvent`, sans second registre |
| Politique & approbation | `policy/`, `approval/` | Auto-escalade **structurellement** impossible ; un accord couvre tout un périmètre, et une empreinte immuable rouvre la partie modifiée |
| Récupération | `recovery/` | Douze causes, une échelle par cause, et l'interdiction de conclure tant qu'un recours reste |
| Objectif & qualité | `goal/evaluate.ts` | 31 envois sur 33 se comptent 31/33 ; sans juge, la mission ne conclut pas |
| Engagements & modèles | `commitments/`, `templates/` | Une promesse se ferme toute seule quand le fait arrive ; ce qu'Adam a observé n'est jamais ce qu'un humain a approuvé |
| Mémoire | `memory/` | Le contexte se compose sous budget ; une compression qui perd un identifiant est REFUSÉE |
| Écran | `view/workspace.ts` | « Où tu en es ? » sans un seul appel de modèle, et la carte se met à jour sur place |

**Réutilisé plutôt que recréé** — `MissionEvent` (journal), `BusinessEvent` (registre canonique),
`AssistantActionIntent` (idempotence + reçu), `src/lib/push.ts` (VAPID), `Reminder` et le
`scheduler` existants, `ExecutiveCommitment`, `AssistantArtifact`, `notifyUser`. Aucun second
registre d'événements, aucun second système de notifications, aucun ordonnanceur parallèle.

**Ce que le chantier a coûté en gardes.** Trois tests d'architecture ont refusé une première
écriture et ont été **suivis, pas contournés** : `boundary.test.ts` a refusé le 425ᵉ
franchissement Adam → ERP (remède : `mission.status` entre au contrat de plateforme),
`executive-security.test.ts` a refusé un `allowed: () => true` non déclaré, et la machine à
états elle-même a refusé une mission qui ne sortait jamais de `PLANNING`.

**Mesuré** (`src/lib/missions/evals/bench.test.ts`, 17 scénarios) : `prematureStopRate` 0 %,
`knownMismatchStopRate` 0 %, étapes rejouées après reprise 0, `recoverySuccessRate` 100 %,
compression à 52 % du volume d'origine. **Non mesuré et dit comme tel** : tout ce qui exige une
clé de fournisseur (utilité des questions, rappel mémoire sur questions réelles, latence
de bout en bout, coût réel en jetons).


### LE MISSION RUNTIME DEVIENT ATTEIGNABLE — le planificateur, la mémoire, l'accord (2026-08)

**Le problème, énoncé comme il l'a été.** « Toute capacité annoncée doit être réellement
utilisable par Adam depuis une vraie demande utilisateur, jusqu'au résultat final. » Le critère
est plus dur qu'il n'en a l'air. Un recensement de tous les symboles exportés du runtime — 152 —
l'a montré : **quatre n'avaient aucun appelant nulle part**, et vingt-quatre n'étaient appelés
que par leurs propres tests. Le compacteur de mémoire, la porte d'approbation côté humain,
l'attente d'un élément fourni par une personne : tout cela existait, était correct, était testé,
et **aucun chemin d'utilisateur ne l'atteignait**.

**Ce qui a été branché, et à quel point d'entrée réel.**

| Capacité | Elle était… | Elle part maintenant de… |
|---|---|---|
| Mémoire épisodique | écrite, testée, sans appelant | `rememberExchange` — le tour de conversation lui-même |
| Vieillissement de la mémoire | idem | le battement (`runScheduledJobs`) |
| Contexte composé sous budget | idem | `personalContext`, envoyé au modèle à CHAQUE tour |
| Accord sur une mission | `decider()` sans appelant | un clic sur `/missions/<id>` |
| Élément demandé à une personne | `fournirEntree()` sans appelant | le même écran |
| Suspendre / reprendre / arrêter | n'existait pas | l'écran, et `mission_control` dans la conversation |
| Relance d'une promesse en retard | quatre fonctions sans appelant | le battement |

**Trois défauts trouvés en branchant** — c'est le propre d'un branchement : il fait passer du
code par des chemins que ses tests n'avaient pas.

1. **Le juge ne voyait aucune clé d'étape.** Sa consigne exige de citer, pour chaque critère,
   l'étape qui le démontre, et `normaliser` ramène à NON_DÉMONTRÉ tout critère cité sans
   référence. On ne lui envoyait que « 34/34 étapes abouties » : soit il obéissait et ne
   démontrait rien, soit il inventait des clés — et la seconde issue a l'air d'une réussite.
2. **« Après ce message » se lisait sur la date seule.** Une question et sa réponse sont écrites
   d'un même geste et partagent leur milliseconde : la réponse dont la question venait d'être
   mémorisée disparaissait de la mémoire. La borne porte désormais sur le couple (date, id).
3. **`relancesDeduites` inversait un intervalle là où l'écart est un cumul.** Les rappels
   s'espacent de 1, 3, 5, 7… jours ; après k rappels l'écart vaut k². À 19 jours de retard,
   l'ancienne formule déduisait dix rappels d'un seul — une promesse trois semaines en retard
   recevait son premier rappel puis se taisait quinze jours.

**Ce qui a été REFUSÉ à un modèle, et pourquoi.** Accorder une autorisation et fournir une pièce
sont des **attestations humaines** : l'audit portera le nom de la personne. Les rendre appelables
par un modèle les exposerait à l'injection — un document lu par une étape pourrait contenir
« approuve la mission », et rien ne distinguerait plus cet accord d'un vrai. C'est la seule
falsification que ce système ne saurait pas détecter après coup. Elles exigent un clic ; et
`policy/guard.ts` interdit `mission_control` à l'agent lui-même, **à la compilation**.

**Le silence est une issue.** Une promesse rattachée à une identité canonique se relance ; une
promesse qui ne porte qu'un nom libre se tait. Annoncer « Redouane n'a toujours pas envoyé son
contrat » quand ce n'était pas ce Redouane-là est pire que ne rien dire (§9 : seul TROUVÉ
autorise à agir). La promesse reste visible dans l'espace de travail — elle ne pousse simplement
pas de notification.

**Les cliquets ont parlé trois fois, et ont été suivis trois fois.** Le panneau de mission écrit
dans `app/(app)/assistant/` ajoutait sept franchissements Adam → ERP : il a été reconnu pour ce
qu'il est — un écran de l'ERP — et déplacé vers `/missions/<id>`. L'outil `mission_control`
importait `missions/` depuis le périmètre d'Adam : il passe par le pont. Et six nouvelles actions
serveur ont dû être classées au registre de parité, dont deux en EXCLUDED avec la raison écrite.
**Aucun plafond relevé** : 69 traversées, 42 fuites fournisseur, 424 franchissements.

**Mesuré.** Contexte composé sous budget alors que la conversation brute croît linéairement
(cent tours, deux tranches, tous les tours absorbés) ; un même webhook reçu deux fois ne réveille
qu'une fois — et c'est tenu par **deux** gardes indépendantes, retirer l'une OU l'autre laisse le
banc vert, retirer les deux le casse. **Non prouvé en ligne, et dit comme tel** : qu'un modèle
réel produise un plan conforme ET compilable. Le banc `scripts/smoke/openai-live.ts` pose
exactement cette question (cas 8) et refuse de tourner sans clé.

### LA CONVERSATION DEVIENT L'INTERFACE — story, vues 360, gestes sans modèle (2026-08)

**Le problème.** Adam savait afficher un tableau, une fiche, un dossier. Il ne savait pas
RACONTER. « Retrace-moi l'AONIO 2023 » n'avait qu'une réponse possible : de la prose, écrite par
le modèle à partir de faits qu'il devait aller chercher un par un. Une chronologie inventée est
indétectable — elle a l'air d'une chronologie.

Et chaque bouton de l'espace de travail écrivait une PHRASE, qui repartait au modèle, qui devait
comprendre l'intention et retrouver l'outil que le serveur connaissait déjà quand il a dessiné
le bouton. Un aller-retour complet pour retrouver ce qu'on savait au départ.

**Ce qui a été fait.**

| Lot | Contenu |
| --- | --- |
| 1 | Protocole v2 : `entityRef`, `state`, `certitude` sur tout bloc ; cinq blocs — `story`, `entity360`, `comparison`, `mission`, `alerte` |
| 1 | `src/lib/queries/story.ts` — la frise reconstituée depuis la base, jamais par le modèle |
| 1 | Capacité `business_story` via le contrat (`business.story`) ; relecteurs dans `compose-godmode.ts` |
| 2 | §23 — un bouton porte son `intent` : registre FERMÉ, LECTURES seules, zéro appel au modèle |
| 2 | Vues 360 produit / marché composées côté ERP, là où les types existent (`e360-blocks.ts`) |
| 3 | §22 — `elaguerFil` : une identité, une seule carte. Le brouillon devient l'envoi, il ne s'empile pas |
| 3 | Mesures au banc d'architecture : jetons de schéma évités, charge d'affichage retirée |
| 4 | Audit hostile : porte des capacités transverses corrigée, retrait de jetons rendu opt-in |

**Les chiffres mesurés** (déterministes, sans clé — `architecture-evals.test.ts`) :

| Mesure | Valeur |
| --- | --- |
| Registre complet | 165 outils · 56 732 jetons de schéma |
| Tour évité par geste direct | 3 163 à 9 440 jetons selon la capacité |
| Séquence de zoom complète | 33 429 jetons + 5 appels modèle évités |
| Charge d'affichage — story 40 jalons | 4 972 → 52 jetons (− 99 %) |
| Charge d'affichage — vue produit | 1 349 → 420 jetons (− 69 %) |

**Les quatre règles qui restent.**

1. **La frise vient de la base.** Ce qui est DÉDUIT le dit (`certitude`), ce qui MANQUE s'affiche
   comme un trou — c'est précisément ce qu'on cherche en retraçant une affaire.
2. **Un bouton ne mute jamais sans confirmation.** Le registre des gestes directs ne contient que
   des lectures ; les mutations gardent la phrase, donc la proposition, la carte et l'audit.
3. **On n'échange pas des jetons contre des faits.** Le retrait de la charge d'affichage est
   OPT-IN : sans `_blocsDecoratifs`, rien n'est retiré.
4. **Une capacité qui traverse les modules s'ouvre à la vue globale**, pas au module dont elle
   porte le nom — sinon on condense les portes en même temps que la séquence.

**Ce que les captures ont trouvé et qu'aucun test vert n'aurait montré** : la story cachait ses
jalons manquants derrière un pli ; des valeurs d'énumération anglaises (`PAID`, `WON`) arrivaient
à l'écran ; la provenance (`PchTenderLine`) était permanente sur téléphone faute de survol ; une
erreur de mission disait quoi faire sans permettre de le faire.

### LE PRODUIT DEVIENT UNE ENTITÉ — clé étrangère au lieu de ressemblance de libellé (2026-08)

**Le problème.** Un même produit s'écrivait différemment dans six modules — dossier
réglementaire, profil promotion, étude BD, ligne de marché PCH, vente, dépense Ad&Pro — et rien
ne les reliait. « Combien rapporte le produit X ? » demandait donc à Adam d'appeler cinq outils
puis de rapprocher les libellés AU JUGÉ. Un rapprochement au jugé finit toujours par confondre
un 40 mg et un 100 mg, et le chiffre d'affaires se présente en réunion sous le mauvais nom.

**Ce qui a été posé, en neuf lots.**

| Lot | Ce qu'il apporte | Fichiers |
|---|---|---|
| 1 · Entité canonique | `Product` + `ProductAlias`, clé d'identité unique portée par la BASE. Un produit peut exister AVANT son dossier réglementaire. Les trois modèles existants deviennent des PROFILS (`productId` nullable) — rien n'est supprimé. | `src/lib/products/identity.ts`, `resolve.ts` |
| 1b · Traversées | `ProductAssignment` (qui porte quoi, depuis quand, pour quelle quotité), `MedicalVisitProduct`, `AdProProductAllocation`, `PchTenderLine.productId`, `Sale.productId` / `tenderLineId`. | `prisma/schema.prisma` |
| 2 · Lectures 360 | `produit360` et `pch360` — une lecture au lieu de six allers-retours. | `src/lib/queries/product-360.ts`, `pch-360.ts` |
| 3 · Registre d'événements | L'audit ALIMENTE le registre : un point d'émission au lieu de cinq cents. Liste blanche stricte — tout n'est pas un fait. | `src/lib/events/from-audit.ts` |
| 4 · Couche sémantique | 13 métriques nommées, chacune avec sa DÉFINITION écrite, qui voyage avec la valeur. | `src/lib/metrics/catalog.ts`, `src/lib/queries/metrics.ts` |
| 5 · Capacités métier | `product_economics`, `pch_market_status` — entrées par le CONTRAT de plateforme. | `src/lib/assistant/business-capabilities.ts` |
| 6 · Surfaces | Les capacités atteignables à la VOIX comme au texte. | `capability-surface.ts` |
| 7 · Graphe d'entreprise | Traverser des arêtes DÉCLARÉES, pas chercher du texte. Pas de Neo4j : le graphe, c'est le schéma. | `src/lib/queries/graph.ts` |
| 8 · Migration Adam | La doctrine dit de PRÉFÉRER la capacité — sinon elle n'économise rien. | `executive-tools.ts` |
| 9 · Banc de mesure | Les chiffres ci-dessous, et ce qui NE se mesure pas ici. | `architecture-evals.test.ts` |

**Les chiffres, mesurés et non estimés.**

| Mesure | Avant | Après |
|---|---|---|
| Outils envoyés au modèle par mission | 164 (registre complet) | **15** |
| Jetons de schéma par tour | 56 459 | **~3 000** (−94 %) |
| Coût de la capacité vs la séquence remplacée | 2 369 jetons (5 outils) | **262 jetons** (−89 %) |
| Appels d'outil, 3 missions réelles | 11 | **3** |
| Rapprochement produit | ressemblance de libellé | **clé étrangère** |

**Les quatre règles qui tiennent l'ensemble.**

1. **Un mot, un calcul.** « Chiffre d'affaires » désigne cinq montants (attribué, commandé,
   livré, facturé, encaissé). Chacun porte son nom et sa définition ; aucun n'est additionné à
   un autre. Le double compte bon de commande / vente est fermé et testé.
2. **Zéro n'est pas « on ne sait pas ».** Une donnée manquante rend `null` AVEC sa raison.
   Jamais zéro, jamais une estimation, jamais un prorata inventé.
3. **On ne traverse que des arêtes déclarées.** Une relation que personne n'a posée n'apparaît
   nulle part — c'est ce qui sépare une traversée (vraie) d'une recherche (probable).
4. **L'ambiguïté se pose à l'humain.** Deux dosages d'une molécule sont deux produits : la
   lecture rend la QUESTION, elle ne tranche pas.

**Ce qui ne se mesure qu'en production** (clé OpenAI requise) : appels modèle réellement émis,
jetons de raisonnement, latence, tours utilisateur. Les bornes existent dans le code ; les
nombres doivent venir des journaux.

### L'ARCHITECTURE DEVIENT MESURABLE — quatre couches, zéro cycle, et des chiffres qui ne mentent pas (2026-08)

Le code était un monolithe, mais pas un monolithe MODULAIRE. Ce lot le rend
vérifiable plutôt que déclaré.

**Les deux cycles entre domaines sont supprimés.** `drive ↔ regulatory` : `mime.ts` et
`object-storage.ts` sont de l'infrastructure de stockage (détection de type, présignature S3)
rangée sous `regulatory/intelligence/` — le Drive devait donc fouiller dans le Regulatory pour
lire un fichier. Les deux modules rejoignent `src/lib/storage/`. `google ↔ mail` : `comms/`
détient la politique d'envoi, `google/` est l'adaptateur qui l'applique ; le sens correct est
adaptateur → domaine, et neuf arêtes sur dix l'étaient déjà. La dixième —
`comms/approve-execute.ts` qui allait chercher `gmailTransport` — est inversée : le transport
devient un PARAMÈTRE. Choix délibéré face à un registre, parce que le typage rend alors l'oubli
impossible, là où un registre mal initialisé aurait laissé un envoi échouer en production.

**La carte des couches** (`src/platform/domains.ts`) : L0 socle → L1 les quinze domaines →
L2 façades transverses (`queries/`, `api/`, `links/`) → L3 Adam. Une couche ne parle qu'à
celles du dessous. `domains.test.ts` tient trois invariants à ZÉRO (cycles, propreté du socle,
inversions de couche) et deux cliquets qui ne doivent jamais monter : **76 traversées
inter-domaines, 42 fuites vers un fournisseur**.

Le test du socle est celui qui rend les autres honnêtes : sans lui, il suffirait de déplacer un
fichier gênant dans `utils/` pour voir le compteur baisser sans avoir rien assaini. Deux autres
tricheries sont fermées de la même façon — passer par une façade, ou casser un chemin de la carte
pour qu'un domaine disparaisse du compte. **Chaque garde a été vérifiée sur une arborescence
témoin où la violation est plantée exprès** : un test qu'on n'a jamais vu échouer ne prouve rien.

**L'audit de capacités (§12) est mesuré, plus déclaré** (`assistant/capability-audit.test.ts`).
La classification NATIVE/COVERED/GAP/EXCLUDED est déclarative — une op dit ce qu'elle couvre —
donc rien n'empêchait a priori une op de promettre dans le vide. Quatre contrôles ferment les
quatre façons d'annoncer une capacité absente, dont un qui manquait : **une op absente de
l'énumération de son outil existe dans le code et reste innommable par le modèle**. Mesure du
jour : 644 server actions — **534 NATIVE, 34 COVERED, 0 GAP, 76 EXCLUDED motivées** ; 30 outils
de domaine, 493 ops exécutables.

**Le routage par rôle (§5–§8) est prouvé** (`models/routing.test.ts`). `models.test.ts`
vérifiait la TABLE des rôles, jamais l'USAGE : rien n'empêchait qu'un chemin textuel demande le
rôle `realtime`, ni qu'un ouvrier reçoive des outils — deux régressions qui ne cassent rien,
coûtent cher et changent le comportement. Six invariants, dont les deux qui comptent vérifiés en
plantant la violation. Mesuré : `routeKnowledge` = **0,0051 ms/appel** après chauffe — le routage
de connaissance ne consulte aucun modèle.

Fichiers : `src/platform/domains.ts` + `.test.ts`, `src/lib/storage/{mime,object-storage}.ts`,
`src/lib/comms/approve-execute.ts`, `src/lib/general-means/budget-targets.ts`,
`src/lib/assistant/capability-audit.test.ts`, `src/lib/models/routing.test.ts`.
Vérifié : tsc, 4124 tests, lint, build propre, 25/25 E2E.

### LE CERVEAU D'ADAM CHANGE DE MAISON — passerelle par rôles, triage A/B/C, lot d'exécution (2026-08)

Refonte du MOTEUR (l'UI est traitée à part). Trois choses qui n'existaient pas.

**1. Une passerelle modèle par RÔLE** (`src/lib/models/`). `src/lib/ai.ts` n'était pas une
abstraction : c'était l'API Anthropic, dont les noms (`ClaudeToolDef`, `tool_use`, `input_schema`)
avaient fui dans 23 fichiers — donc changer de modèle voulait dire réécrire 23 fichiers, donc ne
jamais en changer. La forme est désormais NEUTRE, et le code appelant demande un rôle :

| rôle | modèle | ce qu'il fait |
| --- | --- | --- |
| `realtime` | `gpt-realtime-2.1` | écoute, comprend, converse, **décide** |
| `orchestrator` | `gpt-5.6-terra` *medium* | investigue, planifie, synthétise |
| `worker` | `gpt-5.6-terra` *none* | une sous-tâche qui demande de comprendre |
| `bulk` | `gpt-5.6-luna` *none* | extraire, classer, normaliser, en volume |

Chaque rôle se rebranche par variable d'environnement ; `ADAM_MODEL_PROVIDER=anthropic` rebascule
les rôles textuels sur l'ancien cerveau (une migration sans marche arrière est un pari, pas une
migration). **Le texte part directement sur l'orchestrateur** — il ne passe plus par le temps réel.
`assistant.ts` a changé d'UN import : le pont `models/compat.ts` garde les signatures que la boucle
manipule, et sa disparition sera un jour la preuve que la migration est finie.

**2. Le triage A/B/C.** La délégation vocale existait, mais son critère était « mes outils rapides
couvrent-ils ça ? ». Il devient **« est-ce que je sais déjà QUOI faire ? »** : A = une opération
connue, B = plusieurs opérations connues (exécutées **sans** déléguer), C = le plan est à découvrir.
Le nombre d'actions ne fait pas la complexité — trois gestes connus restent un B, et déléguer là
c'est payer un modèle de raisonnement pour exécuter une liste qu'on avait déjà. L'outil de
délégation demande désormais **ce qu'il faut découvrir** ; un motif creux est consigné, jamais
bloqué.

**3. Une mission = une confirmation.** « Tout confirmer » bouclait **dans le navigateur** : un
aller-retour par action. Un onglet fermé au milieu laissait la moitié du lot partie sans qu'on
sache laquelle. L'enchaînement est passé côté serveur (`assistant/execution/bundle.ts` +
`executeAssistantBundle`), sans aucune sémantique d'exécution nouvelle : chaque étape repasse par
`executeIntentGuarded` puis `performAction`. Une action CRITIQUE ne s'enchaîne jamais et son refus
se **dit** ; un échec n'entraîne pas ce qui est indépendant mais **entraîne ce qui en dépend**
(convention `$prev` déjà en place) ; **aucun réessai automatique** — une action manquée est un
désagrément, une action faite deux fois ne se reprend pas.

**La mesure** (§12) : chaque tour est nommé (texte / vocal direct / vocal délégué / worker / fond)
et compte ses appels **par rôle**, ses outils, le temps jusqu'au premier signe de vie puis jusqu'au
résultat. Un tour ne s'imbrique pas : quand la voix délègue, le tour texte **rejoint** le tour vocal
— l'inverse cacherait la preuve qu'un C fait bien travailler l'orchestrateur.

**Le coût ne ment pas.** Luna est tarifé et vérifié ; Terra ne l'est pas dans ce dépôt, donc son
coût vaut `null` — jamais zéro, jamais une estimation plausible. Un seul tarif manquant rend le
total du tour inconnu. Ils se renseignent sans redéploiement (`ADAM_PRICE_*`).

**Deux gardes tenues plutôt que contournées** : la passerelle entre dans le périmètre d'Adam (c'est
son cerveau, il l'emporte) et ne dépend de RIEN du métier — un test le gèle ; la dette de frontière
**descend de 425 à 424**. Et la règle de triage dépassait le plafond de caractères des instructions
vocales (un garde-fou de latence) : elle a été resserrée et la place reprise sur des consignes
qu'elle rendait redondantes — le plafond n'a pas bougé.

**Pas encore fait** : les workers parallèles pilotés par l'orchestrateur, et le scheduler persistant.

### LE FIL DEVIENT LE CANVAS — Adam parle peu, montre beaucoup, on agit sur place (2026-08)

Suite directe du lot précédent, sur une direction visuelle validée : **un espace de conversation
riche**, pas un tableau de bord et pas un chatbot mieux habillé. Les objets métier arrivent dans le
fil, à leur taille, avec leurs gestes dessous.

**Ce qui n'a PAS été réécrit, et pourquoi.** `AssistantChat` porte la mémoire, les cartes d'action,
l'approbation d'envoi, la dictée, l'appel vocal, les pièces jointes et les sources. Le refaire à
neuf pour changer une apparence, c'était risquer la seule chose qui marche — l'exécution — au
bénéfice de la seule qui se corrige facilement : le style. Il reçoit **une** prop, `canvas`, par
défaut **fausse** : `/assistant` (la page de l'ERP) est intacte.

**Le tour, en mode canvas.** La bulle grise d'Adam disparaît : avatar, nom, heure, texte, puis les
blocs — la réponse EST la page. La question de l'utilisateur reste une pastille claire alignée à
droite : il faut pouvoir retrouver ce qu'on a demandé sans relire toute la réponse.

**Quatre objets de plus** dans `workspace/protocol.ts`, rendus par le registre exhaustif :
`dossier` (faits à gauche, circuit + pièces à droite ; **une** étape courante ; le blocage est la
seule surface colorée de la carte), `email` (le message tel qu'il partira — « Envoyer » écrit la
phrase d'approbation, la politique d'envoi est atteinte par le chemin normal, jamais contournée),
`progress` et `document`. Tableaux et fiches de personne portent des **gestes par ligne**.

**La planche de rendu** (`components/chief/workspace/preview-planche.tsx`) : les blocs n'existent
qu'au bout d'un vrai tour de conversation — donc d'un appel IA que l'E2E s'interdit. Elle est
branchée **dans** le bureau d'Adam (`/chief-of-staff?apercu=blocs`, derrière `ADAM_BLOCK_PREVIEW`),
pas sur une route à elle : une page séparée aurait dû refaire son propre contrôle de droits, donc
franchir la frontière une fois de plus. Adossée au bureau, elle hérite de ses gardes.
`personRegulatoryLoad` descend pour la même raison dans `regulatory-read.ts`. **425 imports,
inchangé — aucun plafond relevé.**

**Ce que la revue des captures a trouvé et que les tests laissaient passer** : la carte de dossier
laissait la moitié droite de 1 440 px vide ; un nom de fichier se cassait au milieu d'un mot ; deux
validations distinctes se lisaient comme une seule ; un « 2 » nu ne répétait que ce qu'on voyait ;
« Envoyer » était indiscernable de « Modifier » ; la frise coupait « Enregistrement » à
« Enregistr » sur 390 px **sans indice qu'il restait quelque chose** (elle bascule à la verticale
sur mobile) ; une adresse e-mail se brisait en « …@exemple. / test » — et une adresse rompue est
une adresse qu'on recopie faux.

### L'ESPACE D'ADAM MONTRE — tableaux, jauges, documents, et on tranche sur place (2026-08)

Six défauts relevés dans un transcript de production, tous du même genre : **Adam savait, mais ne
montrait pas** — ou pire, se déclarait incapable de ce qu'il savait faire.

| Ce qui se passait | La cause EXACTE | Ce qui se passe maintenant |
| --- | --- | --- |
| « tu peux envoyé un mail à Khaled ? » → « Je n'ai pas son adresse » | Le PDG a écrit le PARTICIPE. Normalisé, `envoyé` donne `envoye`, absent des deux listes d'impératifs (`ACTION` du routeur, `ACTION_VERB` du raccourci vocal) — parce qu'`envoyer` est le seul verbe de la famille dont le radical d'impératif (`envoi-`) diffère de celui d'infinitif (`envoy-`). La phrase a filé jusqu'au raccourci « état de la boîte », qui n'envoie **aucun** schéma d'outil : Adam ne pouvait rien faire d'autre que lire des messages reçus. | Le critère change : verbe d'envoi + nom de courrier + **destinataire** = une écriture, quelle que soit la graphie (`isOutboundMail`). Route `ACTION`. Et `directory_lookup` rejoint le domaine `MAIL` — on n'écrit à personne sans son adresse. |
| « combien de salariés Adventum ? » → « 18 », puis « oui, bonne pioche » | `read_hr_overview` n'avait **aucun** paramètre (`properties: {}`) et lisait tout le groupe. Le chiffre était juste ; son périmètre était tu. | L'outil accepte `entite`, mais surtout : il rend **toujours** `perimetre` + `parEntite`. Un agrégat ne peut plus sortir sans sa portée. Une entité inconnue rend le groupe entier **en le disant** — jamais un chiffre attribué à tort. |
| « Dans un tableau » → « je ne peux pas afficher de tableaux Markdown » ; « Montre le moi ici » (Excel) → « je ne peux pas afficher un fichier Excel » | La règle de style interdit — à raison — d'**écrire** du Markdown, mais ne disait pas que l'écran, lui, sait dessiner. Le modèle en a déduit une impossibilité là où il n'y avait qu'un partage des rôles. | La règle le dit, et le chemin existe : lectures tabulaires composables ; **`show_document`** (PDF et contrats en visionneuse, images, classeurs Excel/CSV lus en tableau) ; **`show_table`** (colonnes et tri à la demande). |
| « je les valide depuis ici » — demandé **trois fois** | `list_pending_decisions` ne rendait que des liens : « ouvre Validations et débrouille-toi ». | Chaque ligne décidable porte ses boutons. Le clic **n'exécute rien** : il écrit dans la conversation la phrase du serveur (avec la référence exacte), donc la mutation repasse par la proposition, la carte de confirmation, l'action canonique, le RBAC et l'audit. Une étape séquentielle dont ce n'est pas le tour n'a **pas** de bouton — un bouton qui refuse est pire que pas de bouton. |
| Ventilation complète du budget quand seul le restant était demandé | Rien ne bornait la réponse. | « Réponds à la question posée, et rien de plus » + des **jauges** : « il reste combien ? » se répond par une longueur, et la phrase peut alors tenir en un montant. |
| « T'es sûr ? » → répétition décorée d'assurance | Rien ne distinguait contestation et demande de répétition. | Une contestation fait **relire** la source au bon périmètre. Si le chiffre ne bouge pas, on dit ce qu'il **couvre** — c'est presque toujours là qu'est le malentendu. |

**Trois blocs d'affichage nouveaux** (`workspace/protocol.ts`) : `progress` (jauges, seuils 85 % /
100 %), `document` (PDF en cadre replié, image bornée, feuille rendue en tableau), et des **gestes**
sur les lignes de la file. Le registre de rendus reste **exhaustif par construction** : TypeScript
refuse de compiler si un type de bloc n'a pas son composant.

**Une porte d'extension, `_blocs`** — une lecture canonique peut déclarer ce qu'elle montre, parce
que l'inférence de forme ne marche pas pour « montre-moi ce contrat ». Elle est **revalidée champ
par champ** : type inconnu écarté, listes bornées, `href` restreint aux routes internes de l'ERP
(une URL absolue dans un cadre sous la réponse du PDG n'est jamais acceptée).

**La frontière n'a pas bougé.** `show_document` aurait franchi la frontière Adam ↔ ERP **sept
fois** (Prisma, stockage, droits Drive, droits d'entité…) et le cliquet l'a signalé. Plutôt que de
relever le plafond, la lecture est passée par le **contrat** (`document.show`) — première lecture
non-personne à l'emprunter, et la preuve que l'architecture tient. **425 imports, inchangé.**

### LA FRONTIÈRE ADAM ↔ ERP — séparer le code sans séparer le déploiement (2026-08)

Adam devient un produit qui **communique par contrats** avec l'ERP, tout en restant dans le même
processus. Ce choix vient d'une consigne explicite (« il reste toujours là, partie intégrante »)
et il est ce qui permet de tenir l'indépendance **sans payer la latence des microservices**.

**Mesuré d'abord.** 123 fichiers Adam, **425 imports** vers **172 modules ERP**. Par nature :
136 actions serveur, 84 sécurité/identité, 60 accès Prisma directs — et **9 seulement** côté UI,
déjà quasi découplée. C'est ce classement qui a dicté l'architecture, pas une intuition.

**`src/platform/` — la frontière, qui n'appartient à aucun des deux.** Quatre verbes :
`query` · `command` · `authorize` · `subscribe`. `contract.ts` **n'importe rien** (vérifié par
test) : le jour où Adam devient un service, ce fichier part avec lui sans modification. Un
`Principal` (capacités résolues par la plateforme) remplace `CurrentUser` — Adam lit ses droits,
il ne les calcule jamais.

**Un seul pont.** `in-process/adapter.ts` est le seul fichier autorisé à connaître l'ERP. Il
traduit, il ne décide de rien : `performAction` conserve l'arrêt d'urgence, les portes RBAC,
l'audit et l'idempotence. L'identité est **relue à la source**, jamais reconstruite depuis le
`Principal`.

**Le bus d'événements** (qui n'existait pas). L'ERP annonce des FAITS au passé —
`hr.employee-added`, `regulatory.owner-changed`, `mail.sent` — en une ligne. Règle absolue :
**publier ne peut rien casser** (abonnés isolés, `emit` ne lève jamais), et la charge utile est
minimale — un événement qui transporterait l'entité deviendrait la « seconde base ERP
concurrente » à proscrire.

**Ce qu'on n'a PAS construit, et pourquoi.** Les lectures canoniques coûtent **1,8 à 6,6 ms**
quand un tour d'Adam coûte de l'ordre de la seconde : un cache de l'annuaire ferait gagner moins
d'un demi pour cent, contre un risque de péremption sur des adresses et des salaires. La seule
projection retenue est celle que la mesure justifie — **« quoi de neuf »**, sans équivalent
rapide —, branchée sur l'outil `what_changed` existant plutôt que sur un 78ᵉ outil.

**Le cliquet.** `boundary.test.ts` fige la dette à 425 : elle ne peut que baisser, `src/platform/`
reste à zéro, et le plafond doit rester serré. C'est ce qui transforme « on devrait découpler
Adam » en un travail qui finira. `npm run adam:boundary` affiche l'état et par quoi commencer.

Détail, chiffres et dette restante : `docs/ADAM_PLATFORM_BOUNDARY.md`.

### ADAM — le routeur ACTIF (borné), et l'espace de travail génératif (2026-08)

Deux changements, et une frontière entre eux qui est le sujet principal.

**1. Le routeur passe en production, mais seulement où c'était autorisé.** Jusqu'ici il tournait
en mode ombre : il notait ce qu'il *aurait* fait sans jamais l'appliquer. Trois chemins désormais,
décidés dans `lib/assistant/context/rollout.ts` :

- `FAST_READ` — annuaire, Gmail, agenda, fiche canonique, file de décisions. **Le code choisit
  l'outil, l'exécute, et le modèle ne sert plus qu'à formuler** : un seul appel au lieu de deux,
  et ZÉRO schéma d'outil envoyé.
- `SHORTLIST` — le reste des lectures, en **canary 20 %** : liste d'outils réduite au domaine,
  avec seau déterministe (FNV-1a) pour que tout incident se rejoue à l'identique.
- `LEGACY` — **TOUTES les mutations** et le trafic hors canary. Chemin actuel, inchangé, avec
  RBAC, approbation, audit et idempotence.

Le doute ne va jamais vers un raccourci : confiance faible, domaine flou, outil hors liste blanche
ou garde déclenchée → repli sur le généraliste. Le cas qui résume la règle : **« Envoie-le »** est
classé rapide par le routeur mais EXPÉDIE UN MAIL — il est nommément renvoyé sur le chemin prouvé.

Une **garde automatique** (mauvais outil > 1 % ou outil manquant > 1 %, sur 50 tours minimum)
ramène tout sur l'ancien chemin sans intervention. Sa limite est écrite dans le fichier : la
fenêtre est en mémoire du processus, elle devra devenir partagée avant d'autoriser une mutation.

`list_more_tools` était **déclaré sans code derrière** — la liste courte aurait donc été une
amputation. `context/discovery.ts` l'exécute enfin : il rouvre un domaine en cours de boucle,
n'accorde aucun droit (chaque outil revérifie), ne révèle jamais un outil fermé, et compte chaque
appel comme « outil manquant ». L'échappatoire répare le tour, le compteur répare le routeur.

**Correction d'une mesure fausse** : le rapport publiait « 23 316 tokens de schémas, 60 % du
contexte fixe ». Ce chiffre ne pesait que les 77 outils de POUVOIR ; la boucle en envoie **159**.
La vraie mesure est **93 025 tokens, soit 85,7 %** du contexte fixe.

**2. L'espace de travail génératif.** La conversation ne rend plus la donnée en texte seul : le
serveur traduit la sortie d'une source canonique en **blocs typés** (`lib/assistant/workspace/`),
et le client (`components/chief/workspace/`) ne sait rendre que ces blocs-là — fiche de contact,
annuaire, messages, agenda, file de décisions, fiche, tableau, chronologie.

**Le modèle n'écrit aucun balisage.** C'est la réponse directe à l'incident où « Bonsoir, ça va ? »
avait produit vingt-sept résultats bruts à l'écran, dont six lignes de salaire : une forme non
reconnue **ne compose rien**, et la réponse reste du texte. Sur téléphone, l'annuaire n'est pas un
tableau rétréci mais une liste de fiches — un tableau à trois colonnes sur 390 px écrivait
l'adresse une lettre par ligne.

Jeu réservé **inchangé** : 85,0 % de route, 95,0 % de domaine, 0 confusion lire/agir, les six
mêmes échecs. Détail complet et chiffres : `docs/ADAM_VOICE_CONTEXT_REPORT.md` (addendum).

### ADAM — les canaux Google du Chief of Staff, et la frontière d'envoi (2026-08)

Le Chief of Staff gagne des **sens** : Gmail, Agenda, Drive, Docs/Sheets/Slides et Contacts,
branchés sur le MÊME cerveau — pas de second assistant, pas de conversation parallèle.

Ce qui change pour le PDG : Adam relève la boîte tout seul (veille Gmail + Pub/Sub, avec
réconciliation périodique en filet), comprend les fils et les pièces jointes, relie ce qu'il lit
à l'ERP, tient des **missions** qui survivent à la conversation (qui a répondu, qui manque, ce
qu'on attend), et prépare les réponses. Il **n'envoie rien** sans accord : `REQUIRE_APPROVAL`
par défaut, réglable en langage naturel ou depuis `/chief-of-staff/reglages`.

Un défaut trouvé et corrigé au passage : une intention préparée pendant une période d'**envoi
autonome** était marquée « approuvée » par la politique elle-même, sans personne derrière. Après
retour à l'approbation obligatoire, elle serait **partie quand même** — le PDG aurait vu
s'envoyer des messages qu'il n'a jamais lus, exactement ce que la bascule devait empêcher. On
exige désormais aussi une approbation HUMAINE (`approvedById`). Le test correspondant échoue si
l'on retire la condition : la garantie est vérifiée, pas seulement écrite.

13 tests d'intégration tiennent la frontière, avec un transport-espion qui compte les envois
RÉELS — préparer n'envoie rien, une modification invalide l'accord, deux approbations et deux
envois concurrents ne produisent qu'un message, une mission de fond reste bloquée, le
coupe-circuit prime sur l'envoi autonome.

Parité ERP après le lot : **natives=534, couvertes=34, trous=0, exclues=70 — 100 %** sur 638
actions classées.

### Compréhension du français par Adam — 77 % → 100 % de rappel, zéro faux positif destructeur (2026-08)

La résolution « phrase du PDG → bouton de l'ERP » plafonnait à 81 %, avec des erreurs de
destination et un corpus adverse trop maigre pour être une preuve. La reprise est ARCHITECTURALE,
pas une liste de cas : deux modules purs, `src/lib/assistant/nl/lexicon.ts` (le français) et
`src/lib/assistant/nl/resolver.ts` (le score), que le registre des 529 actions se contente
d'alimenter.

**Ce que le français dit lui-même, et qu'on n'écoutait pas.** Quatre règles, générales, ont
rapporté l'essentiel du rappel :

- un mot précédé d'un **déterminant** est un nom — « assigne cette **demande** » n'est pas un
  ordre de demander ; sauf infinitif (« de **relancer** »), qui reste un verbe ;
- un radical verbal suivi d'une **terminaison non verbale** est un nom — « établi**ssement** »,
  « class**ement** », « géné**ral** », « vidé**o** » ne sont pas des gestes. Sans cette règle,
  « ajoute un établissement de santé » ne contenait **aucun objet** ;
- le **premier** verbe porte l'ordre, les suivants qualifient — « restaure ce fichier
  **supprimé** » ne commande aucune suppression ;
- un ordre commence par son **verbe** ; un constat commence par son **sujet** — « la facture de
  Kwality est arrivée ce matin » n'est pas une demande de créer une facture.

**Ce que le score comptait mal.** Le cosinus a remplacé la couverture (il ne punit plus l'alias
verbeux face à la phrase laconique) ; les synonymes comptent pour **un concept** et non pour
autant de mots (« fichier » ouvre « document » sans diluer « corbeille ») ; le pluriel ne change
plus le radical (« gamme**s** » était raboté en « gamm », « gamme » restait « gamme » — les deux
côtés de la même comparaison s'écrivaient différemment) ; une **quantité** ne désigne rien
(« deux » n'apparaît qu'une fois dans tout le registre : sa rareté étouffait
« définitivement » et faisait échouer la suppression demandée).

**Ce qui garde la sûreté, et qui prime sur le rappel.** Un geste irréversible n'est proposé que
si le PDG a **dit le verbe, en tête de phrase** ; il n'est jamais proposé en second derrière une
lecture non destructrice ; un **mot interrogatif** ferme la porte quel que soit le verbe
(« qui a supprimé ce fichier ? » ne fait plus remonter deux boutons de suppression) ; et le repli
approché, qui rattrape les fautes de frappe, **s'interdit tout geste destructeur** — deviner et
détruire ne vont pas ensemble.

**Mesuré** (`src/lib/assistant/adam-golden-benchmark.test.ts`, 110 formulations réelles du PDG,
44 phrases adverses, 26 pièges destructeurs) :

| | avant | après |
|---|---|---|
| rappel sur les 110 formulations réelles | 77 % | **100 %** |
| bonne destination (95 phrases dont le bouton existe) | — | **100 %** |
| faux positifs sur 44 phrases sans demande | 12 | **0** |
| faux positifs DESTRUCTEURS sur 26 pièges | 8 | **0** |
| latence p50 / p95 | — | **0,34 ms / 0,52 ms** |
| chemin déterministe | — | **180/180** (repli approché : 0) |

Les **15 formulations restantes** ne sont pas cachées : elles sont dans le corpus, marquées
`attendu: null`, avec la raison — l'ERP n'a pas de bouton « export Excel du tableau Regulatory »,
et « ajoute une ligne de paie » est réellement ambigu (six objets s'appellent « ligne »). Aucune
phrase n'a été retirée du banc pour améliorer le score.

### Mémoire du build — le pic ne dépend plus de la machine de build (2026-08)

Render tuait le build (« Ran out of memory, used over 8GB ») alors que la machine de
développement ne dépassait jamais 4,6 Go. Mesure avant de toucher au code (RSS de tout l'arbre
node, build propre) : compilation webpack 4612 Mo, typecheck 2692 Mo, génération statique
3924 Mo. Le commit **pré-ADAM** mesurait déjà 4219 Mo : ADAM n'a pas créé l'explosion, le build
vivait au bord du plafond.

Deux causes réelles. **Le parallélisme se dimensionnait sur le matériel** : Next taille ses
workers sur le nombre de cœurs du builder, donc un builder plus gros que la machine de dev
faisait exploser le total — d'où un incident irreproductible en local. Borné par
`experimental.cpus`. **La minification des bundles serveur** coûtait ~1 Go de pic pour un gain
nul côté navigateur (ces bundles ne sont jamais téléchargés) : coupée par
`experimental.serverMinification`, la minification CLIENT restant intacte.

Résultat : **4612 → 3514 Mo**, et surtout un pic désormais INDÉPENDANT du builder.
`npm run build:measure` garde la porte.

### Mémoire du build, second round — le plafond de tas était posé PAR PROCESSUS (2026-08)

L'OOM Render est revenu (« used over 8GB »). Ce qui a été mesuré, dans l'ordre, avant de
toucher à quoi que ce soit :

| Commit | Phase du pic | Pic (arbre node) |
| --- | --- | --- |
| `ef09bdc` (avant le lot du jour) | compilation | **6269 Mo** |
| `591a0e8` (HEAD) | compilation | **5272 Mo** — dont **un seul worker à 5114** |

**Le lot du jour n'y était pour rien** — il fait même baisser le chiffre, ayant supprimé trois
écrans. La référence de 3514 Mo était simplement PÉRIMÉE : le graphe a grossi lot après lot, et
personne ne l'a vu parce que **la garde ne mesurait pas la configuration qui part en
production**. `build:measure` lançait un `next build` nu ; Render lance `build:render`, avec un
plafond de tas explicite. Deux configurations, deux chiffres — et une garde qui annonçait
« sous le plafond » pendant que le déploiement mourait.

La cause : `--max-old-space-size` est un plafond **par processus**, et il y en a plusieurs.
Posé à 4096 « pour le build », il autorisait en réalité le worker de compilation à monter seul
à 5,1 Go — V8 ne ramasse sérieusement qu'en approchant sa limite. Un seul chiffre changé, tout
le reste identique :

| Tas par processus | Pic | Issue |
| --- | --- | --- |
| 4096 Mo | 5272 Mo | build OK, mais Render tombe |
| **3072 Mo** | **3743 Mo** | **build OK** ← retenu |
| 2048 Mo | — | le worker de compilation MEURT (SIGABRT, heap out of memory) |

**−1529 Mo, sans rien désactiver** : ni lint, ni typecheck, ni minification client, ni aucune
fonctionnalité. Le pic passe de la compilation à la génération statique, où la décomposition
montre que `experimental.cpus: 2` tient bien : parent 1734 Mo + 2 workers à ~940 Mo.

Trois choses ont changé, et la troisième compte autant que la première :
- `build:render` plafonne le tas à **3072 Mo** (`package.json`) ;
- `scripts/build-memory.sh` **exporte le même plafond** — la garde mesure désormais ce que
  Render exécute, sinon elle mesure autre chose et ne garde rien ;
- le plafond de la garde descend de 5000 à **4200 Mo**, redevenant un cliquet serré au lieu
  d'un chiffre que plus personne n'atteignait.

Le 2048 qui casse n'est pas un détail : il dit que la compilation a réellement besoin de plus
de 2 Go, donc que le prochain gros lot fera ÉCHOUER le build au lieu de le laisser dériver.
C'est le comportement voulu — un échec bruyant en local vaut mieux qu'un OOM silencieux chez
l'hébergeur ; le message d'erreur du script dit quoi remonter, et où.

**Piste racine repérée, non traitée ici** : `src/components/ui/icon.tsx` importe l'objet
`icons` de `lucide-react`, qui référence toute la bibliothèque — `lucide-react/dist/esm/icons/`
compte 3464 fichiers, et cet import-là ne peut être ni élagué ni traité par
`experimental.optimizePackageImports` (qui optimise les imports NOMMÉS). Ils entrent donc tous
dans le graphe, côté client ET serveur. Le remède demande une table explicite plus un test qui
empêche la dérive — une icône absente de la table disparaît EN SILENCE (`Icon` rend `null`) —
et 19 fichiers appellent ce composant, dont certains avec un nom calculé à l'exécution.

### Parité quasi totale UI ↔ Chief — 485 ops de domaine sur 30 outils, 98,6 % (2026-08)

Huit vagues industrielles (5a → 7d) ferment la quasi-totalité de l'inventaire des server actions :
le Chief of Staff propose désormais **le même geste que l'écran** sur pratiquement tout l'ERP.

- **485 ops de domaine sur 30 outils** (`src/lib/assistant/ops/`) — les plus fournis : Finances (55),
  RH (39), Administration/`org_operation` (38), Ad&Pro (36), BD (28), Annuaire/promo (25), Médical (22),
  Drive (21), Espace de travail (19), Demandes (18), **Messagerie (18, nouvel outil `messaging_operation`)**,
  Regulatory (16), Planning SFE (16), Réunions (16), Courriers (16), PCH (14), Care (12), Legal (11)…
  Toujours le même contrat : catalogue pur (alias FR, risque, porte RBAC, `covers`) + implémentation
  (résolution nom→id, ambiguïtés LISTÉES, rejeu de l'ACTION CANONIQUE — FormData au champ près).
- **Vagues 5a→6c** : care/congrès nationaux (12), matériel promo (25), BD complet (create/update/delete
  projets CRITIQUES en cascade comptée, gammes, produits FUSION 19 champs, `set_bd_cell` sur liste blanche),
  projets/dossiers (statut, assignation, messages avec mentions, liaison courrier), directives, support,
  rappels d'écran, règles & demandes de VALIDATION (résolution du validateur dont c'est le tour),
  rapports terrain, uniformisation du catalogue d'articles (préversion PURE inlinée dans la proposition),
  planning SFE intégral (cycles « 2033-09 » lus sur le brut, upserts en FUSION, retrait de visites
  sans note signalé).
- **Vague 7/7b/7c** : demandes administratives (édition/retrait/restauration/suppression avec motif
  obligatoire, validation finances/interne, imputation moyens généraux, achats « article xN »),
  missions chauffeur, réunions avancées (FUSION avec horaire d'Alger rejoué UTC+1, appels sur
  conversation résolue par nom, propositions de tâches du compte rendu tranchées par intitulé),
  invitations d'agenda, commentaires transverses par extrait, **messagerie complète** (groupes,
  canaux, édition de SES messages par extrait, modération, réactions, épingles, signets, sourdine,
  niveaux de notification, fiche en FUSION, membres et rôles OWNER-only, archivage, statut de
  présence façon Teams) + relance Regulatory (porte Super Admin / DG).
- **Vague 7d — l'administration profonde** : entités (fiche FUSION + portée du sélecteur), annuaire
  d'entreprise, départements (FUSION anti-cycle, suppression au remontage), organigramme (N+1),
  accès aux entités (auto-modification interdite), comptes portail fournisseur, feedback (dépôt +
  traitement), rattachement des orphelins, **accès pipeline et lignes accordées en FUSION de listes**,
  Centre de contrôle IA (couper l'interrupteur général prévient qu'il éteint AUSSI l'assistant),
  nouveautés TEST→PROD, seuils du Risk Radar bornés, **purge de stockage et suppressions DÉFINITIVES
  Drive/document (CRITIQUES, ressaisie du nom)**, carte d'identité légale par libellé, champs
  personnalisés par libellé (FILE renvoyé à l'écran), suppression de SON courrier/document légal.
- **EXCLUDED motivés, jamais silencieux** : lectures/analyses IA du cockpit (le Chief EST cette
  capacité), géométrie de la carte d'organigramme, `createSupplierUser` (un mot de passe ne transite
  JAMAIS par une conversation — même règle que les comptes internes à invitation), sélecteurs de
  formulaires, plomberie d'écrans.
- **Sémantique FUSION généralisée** : toute action d'écran qui REMPLACE une fiche est rejouée champ
  par champ depuis l'existant — renommer un groupe ne perd pas son sujet, changer un seuil du Risk
  Radar réécrit la grille entière à l'identique, retirer une ligne accordée rejoue les autres.
- **Goldens par vague** (`ops-goldens-wave*.test.ts`) : chaque vague est verrouillée par des tests
  d'or sur ses mécanismes délicats (FUSION, portes, ambiguïtés, bornes, confirmations CRITIQUES).

Parité UI↔Chief : **22,8 % → 98,6 %** (natives 525, couvertes 33, **trous 8** — tous des gestes à
FICHIER (upload/import) qui attendent la phase « fichiers first-class » —, exclues 66 sur 632
classées) — cliquet CI abaissé à chaque vague (`action-parity.test.ts` : trous ≤ 8,
natif+couvert ≥ 558). Suite : **3 004 tests verts**.

### Plan de contrôle exécutif ZERO-GAP — ops de domaine, lots, plans, confirmation serveur, invitations, versions de circuits (2026-08)

Le Chief of Staff passe d'un catalogue d'actions ponctuelles à un **plan de contrôle systématique** de l'ERP :

- **71 ops de domaine sur 12 outils** (`src/lib/assistant/ops/`) : Drive (10), Tâches (5), Finances (10), Regulatory (9), RH (8), Réunions (6), Courriers (4), Legal (4), Structurel (9 dont création de compte), Ad&Pro (4), BD (2), Stocks (1). Chaque op est une entrée de CATALOGUE (`catalog.ts` : alias FR, risque, porte RBAC, actions d'écran couvertes) + une IMPLÉMENTATION (`impl-*.ts` : résolution nom→id avec ambiguïtés LISTÉES, puis rejeu de l'ACTION CANONIQUE de l'écran — FormData au champ près, jamais une deuxième logique métier). La reclassification est AUTOMATIQUE : ajouter une op ferme ses clés d'inventaire dans le registre de parité.
- **Lots (`bulk_action`)** : la même action native sur 2–20 cibles en UNE carte — récursion de `buildProposal` (mêmes portes), niveau = max des items, CRITIQUE ⇒ ressaisir « LOT n », exécution séquentielle best-effort avec reçu PAR cible.
- **Plans enchaînés (`action_plan`)** : 2–8 écritures DÉPENDANTES en une carte ; « $prev.champ » référence l'étape précédente ; les étapes différées sont re-résolues À L'EXÉCUTION par le même `buildProposal` ; un maillon refusé ARRÊTE la chaîne (reçus + « non tentée(s) ») ; le niveau compte AUSSI les étapes différées.
- **Confirmation CRITIQUE vérifiée PAR LE SERVEUR** (`assistant/confirm.ts` + `AssistantActionIntent.confirmText`) : la valeur à ressaisir est stockée à la proposition ; `executeAssistantAction` la compare lui-même (normalisation partagée client/serveur, compatible épellation vocale — « R E G-2026 041 » ≡ « REG-2026-041 ») ; une action CRITIQUE sans intent est refusée (`payloadRequiresStrongConfirm` recalcule le niveau depuis le payload).
- **Création de comptes par LIEN D'INVITATION** (`user-invites.ts`, `/invite/[token]`, op `create_account_invite`) : le compte naît INCONNECTABLE, la personne définit SON mot de passe via un lien 72 h à usage unique atomique — AUCUN mot de passe ne transite jamais par une conversation.
- **Contexte d'écran → actions natives** (`screenActionsContext`) : un appel vocal depuis une page annonce d'emblée les boutons natifs disponibles LÀ (matching route→modules du registre, borné, silencieux hors module).
- **Champ personnalisé FICHIER** (`CustomFieldType.FILE`) : référence Drive `{nodeId, name}` vérifiée (existence + accès), jamais copiée ; « obligatoire » exige une référence valide ; saisie par l'explorateur Drive, lecture en lien.
- **Versions des circuits** (`WorkflowDefinitionVersion`) : chaque enregistrement du builder laisse un instantané ; l'écran `/admin/workflows` les liste et RESTAURE (rejeu par le même chemin validé — l'historique avance, ne se réécrit pas).
- **Brief avant réunion** (`pre_meeting_brief`) : la réunion + les points OUVERTS avec chaque participant (tâches entre vous, engagements) — cloisonné à VOS réunions.
- **Palette ⌘K → Chief** : le texte tapé se route en un geste vers `/chief-of-staff?q=…` (si le module est ouvert à la personne).
- **Observabilité** (`/admin/ai`) : parité UI↔Chief (registre pur, zéro appel IA), latences p50/p95 par fonction (percentile_cont en base), états des intentions 7 j (proposé ≠ exécuté).
- **E2E Playwright** (`e2e/`, `npm run test:e2e`) : parcours DÉTERMINISTES sans IA contre le build de production — connexion réelle, mauvais identifiants refusés, circuit d'invitation de bout en bout (invalide/expiré/valide → définir son mot de passe → usage unique → se connecter).

Parité UI↔Chief : **10,1 % → 22,8 %** (natives 106, couvertes 30, trous assumés 460, exclues 36 sur 632 classées) — cliquet CI (`action-parity.test.ts`) contre tout recul silencieux. Suite : **2 812 tests verts**.

- **OOM du déploiement Render corrigé — mesuré, pas masqué.** Le build crashait pendant
  « Linting and checking validity of types » (« Ineffective mark-compacts near heap limit »,
  ~2042/2084 Mo). **Cause mesurée** : dans `next build`, ESLint et le typecheck TypeScript
  tournent dans le MÊME processus Node — le typecheck seul consomme **1,38 Go**
  (`tsc --extendedDiagnostics` : 73 439 types, 211 530 instantiations — sain ; le poids vient
  des 752 K lignes de définitions dont **560 K pour le client Prisma**, `skipLibCheck` déjà
  actif), ESLint a besoin de **≤ 1 Go** (vérifié : passe avec `--max-old-space-size=1024` ;
  les pics de 3-7 Go observés = GC paresseux quand on lui laisse un grand heap, pas un besoin),
  et la somme + résidus webpack dépasse la limite Node par défaut (~2 Go) de l'instance Render.
  Aucun type pathologique côté Chief (registres = données ; instantiations basses). **Fix
  structurel** : les deux contrôles tournent en DEUX processus — `npm run build:render` =
  `next lint && next build` (le lint reste BLOQUANT, en phase séparée du `buildCommand`
  render.yaml) ; `eslint.ignoreDuringBuilds` ne fait que dédupliquer cette exécution (commenté
  comme tel dans `next.config.mjs`) ; `typescript.ignoreBuildErrors` n'est PAS touché — le
  typecheck reste dans le build. Garde-fou `NODE_OPTIONS=--max-old-space-size=4096` sur la
  phase build. **Warnings éteints (6 → 0)** : deps réelles ajoutées (`regulatory-table` :
  `companies`, `pipelineCount`), rechargement au seul changement de dossier justifié et
  correctement annoté (`mail-workspace`), `aria-sort` déplacé sur le `<th>` (`drive-table`),
  les 2 `<img>` d'aperçus de pièces jointes gardés avec disable BIEN PLACÉ et motivé
  (routes API authentifiées : l'optimiseur `next/image` refetche sans session).

- **LE CHIEF ADMINISTRE LES CIRCUITS ET LES FORMULAIRES — et parle français.** Suite directe de
  ZERO-GAP (parité 9 % → 10,1 %, 60 couvertes / 534 trous assumés). **Circuits de validation** :
  `read_workflow` (état réel du builder + dictionnaires de codes) et `configure_workflow`
  (Super Admin — recomposition complète des étapes via `saveWorkflowDefinition` canonique,
  carte AVANT → APRÈS, slugs conservés pour ne perdre aucune demande en cours, `reset` au
  défaut) — golden « Ajoute Finance après Information Médicale » ; seuls les 4 circuits Ad&Pro
  sont configurables, les autres sont du code (dit honnêtement par le prompt).
  **Étapes** : `advance_workflow` — approuver / refuser / **sauter une personne** (SKIP) par
  l'action canonique : le moteur décide l'autorité, la raison est OBLIGATOIRE dès la
  proposition (tracée + notifiée), résolution par référence avec étape courante affichée.
  **Champs personnalisés** : `manage_custom_field` (créer/modifier/supprimer, 18 modules) +
  **évolution ERP livrée : le flag « obligatoire »** — migration `20260826100000`, case dans
  Administration → Champs personnalisés, astérisque + `required` dans le rendu partagé (les
  erreurs serveur s'affichent enfin), refus serveur par `missingRequiredValues` (pur, testé ;
  un Oui/Non n'est jamais « manquant ») — golden « Rends ce champ obligatoire ».
  **Langue** : le Chief répond TOUJOURS en français (texte + voix), comprend toutes les
  langues, traduit ce qu'il cite, et ne change de langue que sur demande explicite.
  Tests : `workflow-config` (7) ; registre reclassé (5 actions GAP→NATIVE), cliquet 534.

- **ZERO-GAP — le Chief est le plan de contrôle en langage naturel de l'ERP.** Cas réel : le
  bouton Finances « Demander l'actualisation des soldes » existait, mais le Chief fabriquait une
  demande administrative générique puis disait « je ne peux pas cliquer ». Réponse systémique
  (`lib/assistant/action-registry.ts`) : **registre d'actions natives** (id stable, libellé du
  bouton, ALIAS naturels, outil, risque, sémantique, porte identique à l'écran — le bouton
  Finances devient l'outil `request_treasury_update`, exécuté par `requestTreasuryUpdate`
  canonique) ; **priorité au natif** (`matchNativeAction` injecté dans le plan des deux boucles
  + règle d'ordre : action native → tâche → demande générique en DERNIER recours → message ;
  interdit de dire « je ne peux pas cliquer ») ; **découverte** (`find_available_actions` :
  « qu'est-ce que je peux faire ici ? » = le registre réel filtré par les droits, jamais une
  liste inventée) ; **inventaire exhaustif verrouillé par CI** : les 631 server actions de
  `src/lib/actions/` sont TOUTES classées (NATIVE 20 / COVERED 35 / GAP 539 assumés avec note /
  EXCLUDED 37 avec raison) et `action-parity.test.ts` re-scanne le dossier à chaque run — une
  action ajoutée sans classification = test rouge avec son nom, GAP sous cliquet. Métrique
  UI_ACTION_PARITY imprimée à chaque run (~9 % strict au départ — chiffre sévère et honnête,
  la machinerie le fait monter sans plus jamais de trou muet). Goldens : résolution
  « actualisation du solde du compte bancaire » → action Finances native (4 formulations),
  « demande à Raihana de vérifier » → PAS d'action native (repli tâche), « supprime
  définitivement » → delete_record, découverte filtrée par droits (11 tests parity + 11
  superadmin-write).

- **LE CHIEF FAIT TOUT — demandes de tâches canoniques, relance Regulatory, corbeille, comptes.**
  Suite du principe « la parité écran est un PLANCHER », après le correctif `delete_record`.
  **Demande de tâche** : l'exécution `create_task` de l'assistant contournait le circuit de
  l'écran (tâche déposée directement, cloche silencieuse) — le cœur est extrait dans
  `lib/tasks/create-core.ts` (`createTaskRecord`, règles dans `request-flow.ts` pur) et partagé
  par l'action écran et l'assistant : pour un collègue → **REQUESTED + `requestedAt` + POP-UP +
  accepter/refuser**, pour soi → to-do ; se **planifie** (échéance + priorité) et la carte
  annonce le mode (« Demander une tâche à X ») avant confirmation. **Relance Regulatory** :
  `request_regulatory_status_update` (porte supervision, action canonique de la fiche,
  destinataires affichés AVANT confirmation, refus explicite si personne à relancer).
  **Corbeille complète** : `restore_record` (recréation à l'identique) et `purge_record`
  (destruction réelle, fichiers effacés — CRITIQUE avec ressaisie ; entrée déjà restaurée
  purgeable avec avertissement), résolution par le nom affiché (`resolveTrashEntry`).
  **Comptes** : `set_account_active` (interrupteur de l'écran, jamais soi-même, exécution
  idempotente — l'état réel est relu avant le `toggleUserActive` qui bascule aveuglément) et
  `set_account_role` (rôle + autre rôle via `updateUserRole`/`setSecondaryRole`, anti-escalade
  Super Admin dit dès la proposition) — SENSITIVE. **Limite assumée** : la création de compte
  reste sur l'écran (un mot de passe ne transite jamais par une conversation) ; matrice d'accès,
  départements, écritures Drive, dépenses budgétaires et paie suivront le même patron.
  Tests : `superadmin-write` (10 — dont l'EXÉCUTION réelle du circuit demande de tâche :
  REQUESTED + pop-up + audit). Prompt Super Admin enrichi (corbeille + comptes).

- **WORLD-CLASS EXECUTIVE AI — connaître l'entreprise, pas chercher dedans.** Audit complet du
  moteur puis huit causes racines corrigées par des primitives GÉNÉRALES (jamais un exemple
  codé en dur), chacune verrouillée par un test golden. **Regulatory exact** : fix de
  l'incohérence « 22/22 mais prochaine étape : Réception du CTD » (invariant `regProgress` :
  processus complet → aucune étape courante ; jalon ≥ présoumission → avis FAVORABLE dérivé,
  jamais un avis explicite réécrit) ; **GÉRER ≠ AVOIR ACCÈS** — `regulatory_workload` (charge
  par personne : responsable DÉSIGNÉ, assiste, simple accès dit À PART) et
  `regulatory_portfolio` (portefeuille par partenaire, graphies et SIGLES résolus contre les
  partenaires réels : « SD » ↔ « S.D. Pharmaceuticals ») sur LE MÊME périmètre que l'écran
  (`regulatoryVisibleWhere` factorisé — screen parity par construction) ; `employee_360`
  sépare structurel / dossiers directs / accès / tâches détaillées (retards, critiques,
  vélocité, top 5) / charge. **Query planner** pur (domaine, intention, SUIVI ELLIPTIQUE :
  « et SD ? » = même intention, entité substituée — injecté texte + voix) + résolution
  d'entités par initiales/cœur de nom (`entity-normalize.ts`, jamais de fusion muette).
  **Investigations en un tour** : `investigate_event` (8 sources en parallèle + acronymes +
  COUVERTURE rendue — « aucune trace » interdite sans elle) et `inspect_drive_folder`
  (récursif borné, déposants réels par version, BC STRICTS ≠ assimilés ≠ non-classés).
  **CRUD autorisé** : confier un dossier (action canonique `setRegulatoryResponsible` — même
  porte Super Admin, même audit, même notification) et étapes ANPP / avis de présoumission en
  proposition → confirmation → exécution ; **suppression définitive** (`delete_record`, Super
  Admin) : le premier audit disait « pas de delete dans l'UI » — faux, le bouton rouge vit dans
  le composant partagé `SuperAdminDeleteButton` ; corrigé en extrayant le registre des 25 types
  supprimables en module partagé (`lib/admin-delete-registry.ts`) et en proposant la MÊME
  suppression via l'action canonique `superAdminDelete` (corbeille restaurable, audit) — carte
  CRITIQUE avec référence à ressaisir, résolution par référence/nom sans fusion muette
  (`delete-resolve.ts`) ; « demande à X de faire Y » = TÂCHE par défaut.
  **Livrables téléchargeables EN CONVERSATION** (`telechargement: /api/drive/…/raw`, ACL
  Drive), liens internes CLIQUABLES dans le chat (`LinkifiedText`), export Regulatory à
  17 colonnes avec cellules numériques et VRAIES dates Excel. **Sémantique Drive** en repli
  (vecteurs JSONB + cosinus — pgvector indisponible, même pattern assumé que le corpus ;
  vectorisation en phase 3 de l'ingestion planifiée, jamais bloquante) : « durée de
  conservation » retrouve un « shelf life » — confiance « SENS », couverture honnête ;
  migration `20260825200000_drive_semantic`. Banc Recall@5 sur fixtures : lexical 1/3 →
  hybride 3/3 (mécanisme prouvé ; recall production avec vrais vecteurs : NOT YET MEASURED).
  Tests : `regulatory-read` (7), `regulatory-write` (11 — dont la suppression CRITIQUE), `entity-normalize` (10),
  `investigation` (5), `semantic-drive` (3), planner dans `reasoning` (15 au total),
  invariants `regulatory-workflow` (17), `deliverables` (+2). Doc : section « WORLD-CLASS
  EXECUTIVE AI » de `docs/CHIEF_OF_STAFF_ARCHITECTURE.md` (root causes avant/après + limites).

- **REALTIME VOICE RELIABILITY — plus jamais d'analyse muette, plus jamais d'interruption
  fantôme.** Deux pannes bloquantes d'appel réel corrigées À LA RACINE dans le pipeline
  d'événements du provider (`app/(app)/assistant/realtime-voice.ts`) — pas un prompt, pas un
  timeout arbitraire. **BUG 1 (« Je vais analyser… » puis silence — « Alors ? » faisait
  apparaître le résultat)** : chaque résultat d'outil crée désormais une OBLIGATION DE
  RESTITUTION (`PendingDelivery` WAITING_TOOL → READY → DELIVERING) qui ne s'éteint que
  lorsqu'une réponse IDENTIFIÉE (suivie par `response_id`) s'est terminée en ayant réellement
  PARLÉ. La complétion d'un job RÉVEILLE la conversation ; la collision avec une réponse
  auto-créée par la VAD (`conversation_already_has_active_response`) REPLANIFIE au lieu de
  perdre (c'était LA cause du silence) ; un create perdu est rattrapé par le **watchdog
  déterministe** (`deliveryWatchdogAction`, pur : dépendances complètes && rien en cours &&
  l'utilisateur ne parle pas && grâce écoulée — relances plafonnées puis abandon honnête :
  dit + persisté au fil) ; une réponse « terminée » MUETTE est détectée et relancée (rappel
  système unique) ; un résultat pendant la parole du PDG attend la fin de SON tour
  (RESULT_READY) ; un résultat après raccrochage est PERSISTÉ dans le fil
  (`persistOrphanResult`, `keepalive`). Exactly-once : une obligation = une restitution ; le
  tour se nomme « (restitution d'une analyse terminée) ». **BUG 2 (fantômes « (intervention
  vocale) » persistants)** : AUTO-PROTECTION ÉCHO — pendant que le haut-parleur JOUE, la
  durée seule ne confirme plus JAMAIS un barge-in (l'écho de la propre voix de l'assistant
  est un signal soutenu parfait) : seuls des MOTS transcrits coupent, avec CONFIRMATION
  TARDIVE si la transcription est lente ; haut-parleur muet → la parole soutenue confirme
  encore (aucune source d'écho). Les événements d'une réponse ANNULÉE sont PÉRIMÉS (liés par
  `response_id`, marqueur qui survit au done) : zéro pollution de transcript, zéro état
  fantôme. Fenêtre d'évaluation liée au SEGMENT (`item_id`) : un delta d'un ancien segment ne
  confirme rien, un segment = UNE confirmation max (debounce). Pièce silencieuse : un commit
  de bruit est SUPPRIMÉ de la conversation (`conversation.item.delete` — pas de dérive de
  langue) et sa réponse auto est annulée avant d'avoir parlé — sauf si elle porte une
  restitution. **Observabilité** : `voice_pending_turn_delivered` (latence job→voix),
  `voice_silent_completion`, `voice_watchdog_recovered`, `voice_delivery_failed`,
  `voice_phantom_response_cancelled` + compteurs de session (deliveriesReady/Done,
  staleEventsIgnored…) → les DEUX SLO (restitution ≈ 100 %, fausses coupures ≈ 0) se lisent
  dans le journal. Tests : `voice-pipeline.test.ts` (16 golden — les scénarios des deux
  pannes REJOUÉS sur le vrai `handleEvent` : complétion silencieuse impossible, collision
  VAD, watchdog, accusé muet, RESULT_READY, session terminée, échec dit, écho fantôme,
  coupure aux mots, périmés, debounce, confirmation tardive, pièce silencieuse),
  `voice-tuning.test.ts` (20). Recette terrain (micro réel) : pièce calme 60 s → 0
  intervention ; analyse + silence → restitution SPONTANÉE ; « Attends » → coupure nette.

- **GOD MODE — la couche cognitive finale : ingestion Drive, diff temporel, mémoire épisodique
  fédérée.** Des primitives GÉNÉRALES, pas des questions codées en dur. **Ingestion Drive
  planifiée** (`lib/assistant/drive-ingestion.ts`, branchée dans `lib/scheduled.ts`) : le Drive
  « sale » devient trouvable par le CONTENU sans attendre qu'un humain lise chaque fichier —
  balayage incrémental (fichiers jamais indexés d'abord, puis ré-indexation des index les plus
  anciens si la version a changé), index-témoin sur les fichiers illisibles (on garde la raison,
  on ne boucle pas), débrayage `ASSISTANT_DRIVE_INGESTION=off`, et l'ACL reste vérifiée nœud par
  nœud AU MOMENT de la recherche (l'index ne crée aucun droit). Chaque indexation classe le
  document (`lib/assistant/drive-classify.ts`, module PUR déterministe : le nom est un INDICE
  — 1 pt —, le contenu est la PREUVE — 3 pts —, 12 natures, la plus spécifique gagne à égalité,
  « unknown » est un verdict honnête) → `DriveTextIndex.docKind`, filtre `kind` et champ
  `typeDetecte` dans `find_documents` : « retrouve le contrat de Benali » remonte un
  « scan_0234.pdf » avec sa nature détectée. **`what_changed`** (« qu'est-ce qui a changé depuis
  lundi ? », « catch me up ») : diff du journal d'audit depuis une date (AAAA-MM-JJ Alger ou
  « N » jours), changements significatifs seulement, QUI a agi, état actuel en face, et
  « aucun changement tracé » est une réponse complète — jamais un diff inventé. Réutilise la
  résolution de référence de `time_travel` (un seul chemin). **`episodic_recall`**
  (« qu'est-ce qu'on a fait sur X ? ») : rappel fédéré en parallèle sur les CINQ registres
  épisodiques — actions proposées/exécutées, rappels, décisions, engagements, livrables —
  cloisonné par compte, absence honnête (« Aucune trace ÉPISODIQUE »). Bloc AUTO-CONTRÔLE
  (texte) : vérifier les référence/chiffres cités contre les données lues avant de conclure.
  Migration `20260825160000_drive_ingestion`. Tests : `drive-classify.test.ts` (6),
  `drive-ingestion.test.ts` (4 — § 150 : le scan mal nommé se retrouve par contenu avec sa
  nature), `what-changed.test.ts` (5), `action-intents.test.ts` (episodic fédéré). Doc :
  section « GOD MODE — la couche cognitive finale » de `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`
  avec les LIMITES honnêtes (pas de couche SQL sémantique arbitraire, pas d'index vectoriel
  Drive, « depuis notre dernière discussion » exige une date fournie par le modèle).

- **HARDENING — mémoire d'actions canonique, sémantique métier, barge-in confirmé.** Quatre
  pannes réelles d'un appel de production sont devenues des invariants testés (analyse
  root cause → fix → test dans `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`, section HARDENING).
  **ActionIntent** (modèle `AssistantActionIntent`, `lib/assistant/action-intents.ts`) :
  CHAQUE proposition d'action (texte, voix via délégation, nudge) est persistée avec un état
  canonique serveur — PROPOSED → CONFIRMED → EXECUTING → EXECUTED / FAILED / CANCELLED —
  transitions journalisées (historique d'autorisation). Exécution sous **réclamation
  atomique** : un retry / double-clic / reconnexion ne renvoie JAMAIS deux messages (l'action
  déjà exécutée rend son reçu d'origine) ; le payload exécuté est celui STOCKÉ à la
  proposition (le serveur est l'autorité) ; l'annulation UI transite par le serveur. « Je
  t'avais déjà demandé quelque chose à Redouane ? » et « c'est envoyé ? » se répondent depuis
  le bloc **ACTIONS RÉCENTES** (injecté texte + voix) et l'outil **`action_history`** (fast
  path vocal) — jamais de mémoire : PROPOSÉE = jamais exécutée, seule EXÉCUTÉE avec reçu vaut
  envoi. **Vocabulaire métier contextuel** (bloc partagé texte + voix) : « événements » +
  « règlement » → sponsoring / prises en charge / congrès, « demain » → calendrier ; fiche /
  BC / DE / le centre ; rapprochement phonétique des noms transcrits (« Radia Kebir » ↔
  « Radio Kibir ») contre le personnel réel — résolution par le CONTEXTE, pas une table mot →
  module. **Barge-in CONFIRMÉ** (`lib/assistant/voice-tuning.ts` + provider) : fini les
  coupures sur clavier / toux / porte — `interrupt_response: false`, fenêtre d'évaluation
  (mots transcrits = confirmation immédiate, parole soutenue ≥ 400 ms = confirmation, signal
  bref sans mots = IGNORÉ, la réponse continue), annulation propre (`response.cancel` +
  `output_audio_buffer.clear` + `conversation.item.truncate` — le contexte serveur ne compte
  pas comme entendu ce qui n'a jamais été joué) ; le transcript n'est pas la vérité terrain
  (artefacts hors fil/mémoire/entités) ; VAD **pilotée par l'environnement** pour le benchmark
  (semantic_vad eagerness / server_vad threshold-prefix-silence / `OPENAI_VOICE_INTERRUPT`) ;
  métriques jumelles `voice_false_barge_in_ignored` + `voice_barge_in_confirmed` (latence).
  Consignes voix : pas de préambule répété après interruption, recherche EN SILENCE, terminer
  par la réponse (fin du « veux-tu que je… » systématique). Migration idempotente
  `20260825150000_action_intents`. Tests : `action-intents.test.ts` (7 — Redouane, Khaled,
  concurrence, annulation, cloisonnement), `voice-tuning.test.ts` (12 — golden faux/vrai
  barge-in), `voice-realtime.test.ts` étendu (vocabulaire, actions récentes). **Recette micro
  réel** (environnement déployé) : pendant une réponse, taper au clavier / tousser / claquer
  une porte → l'IA CONTINUE ; dire « attends » → coupure immédiate ; « je t'avais demandé quoi
  à Redouane déjà ? » → la demande exacte avec son état ; confirmer un envoi à Khaled → UI et
  voix passent ensemble à EXÉCUTÉE, une seule fois ; « c'est envoyé ? » → « oui, à 10:42,
  voici la trace ».
- **MAXIMUM INTELLIGENCE AT MAXIMUM SPEED — fast + smart, jamais l'un contre l'autre.** Le
  principe : ne jamais échanger l'intelligence contre la vitesse — gagner les deux par
  l'architecture (cacher la latence, jamais la qualité). **États exécutifs précalculés**
  (`lib/assistant/executive-state.ts`, fonctions PURES sur des données déjà lues — zéro requête,
  zéro latence ajoutée) : « où en est Pembro ? » reçoit D'UN SEUL appel l'étape courante et sa
  responsable, le **bloqueur dérivé** (étape bloquée / pièces manquantes / retard / validateur
  en attente **depuis N jours**), les jours dans l'étape, la prochaine échéance et étape, le
  dernier mouvement et les **signaux** (retard, silence > 30 j, priorité haute qui n'avance pas,
  cible dépassée) — en PREMIÈRE clé de `product_360` (`syntheseExecutive`) et d'`inspect_record`
  (`etatExecutif` paiement/règlement) ; l'absence de bloqueur SE DIT, elle ne s'invente pas.
  **Raisonnement parallèle** : les appels d'outils d'un même tour s'exécutent en `Promise.all`
  (streaming et non-streaming — trois lectures de 800 ms coûtent 800 ms) + consigne de
  DÉCOMPOSITION (sous-lectures indépendantes lancées ensemble, puis synthèse exécutive : « et
  alors ? qu'est-ce qui change la décision ? ») et d'expansion ciblée (sources probables
  d'abord, s'arrêter quand une lecture de plus ne change plus rien). **Discipline de preuve**
  (règles communes texte + voix) : qualifier FAIT VÉRIFIÉ / DÉRIVÉ / ESTIMATION / HYPOTHÈSE /
  INCONNU ; **autorité des sources par type de donnée** (paie > avenant signé > contrat > vieux
  document > e-mail > mémoire) ; **contradiction jamais avalée en silence** (chronologie
  d'abord, sinon « j'ai une incohérence à signaler ») — et détection DÉTERMINISTE de l'écart
  devis → facture d'une même chaîne (`incoherences` dans inspect_record). **Profondeur
  adaptative** (`lib/assistant/reasoning.ts`) : `isHighStakesQuestion` (décision, recommandation,
  réorganisation, recrutement, montants en millions — cinq mots suffisent) déclenche une
  **SECONDE PASSE CRITIQUE** : la conclusion est relue par le même modèle en adversaire de sa
  propre analyse puis remise révisée — un appel de PLUS quand ça compte, jamais un modèle de
  moins ; en flux, le brouillon déjà affiché (vraie réponse progressive) est remplacé (`reset`)
  et l'étape se dit dans la trace (« Relecture critique de la conclusion ») ; critique jamais
  exposée, échec du second appel → le brouillon est rendu. **Continuité sémantique** :
  `conversationWorkingSet` (références ERP réelles + termes cités, fenêtre 60, borné 8, plus
  récents d'abord) injecté texte ET voix — « et le fournisseur ? », « fais pareil pour Nivo »
  se résolvent sans relancer la compréhension. **Voix à deux vitesses** : le fait fiable se dit
  IMMÉDIATEMENT pendant que la couche d'intelligence travaille en parallèle — jamais de silence
  artificiel, jamais d'invention pour meubler. **Benchmark qualité × latence** : golden queries
  DÉTERMINISTES figées en CI (`golden-queries.test.ts` — bloqueur/délais/prochaine étape/signaux
  livrés en un appel sur les vraies questions PDG) + protocole de mesure en conditions réelles
  documenté (AiUsageLog : ttftMs/latencyMs/turns/toolCalls face à une évaluation humaine de
  l'exactitude — une latence gagnée en perdant de la qualité est un ÉCHEC). Tests :
  `executive-state.test.ts` (8), `reasoning.test.ts` (6), `golden-queries.test.ts` (3).
- **PREMIUM LIVE EXPERIENCE — « je suis au téléphone avec mon Chief of Staff ».** Une couche
  d'expérience d'appel + des capacités exécutives À LA DEMANDE, sans rien reconstruire — le
  principe qui gouverne tout : **CAPABLE ≠ EXÉCUTÉ** (l'IA peut suggérer, elle attend
  « fais-le »). **Bouton TÉLÉPHONE** distinct du micro (dictée) sur `/chief-of-staff`.
  **Vraie interface d'appel** : plein écran mobile (safe areas, gros boutons Mute / Raccrocher /
  Clavier), modal immersif desktop ; en-tête « MY CHIEF OF STAFF · ● LIVE · 06:42 » — la
  **minuterie démarre à la connexion RÉELLE** et jamais de « Live » si la session ne l'est pas
  (Connexion… / Reconnexion… affichés honnêtement). **L'appel est GLOBAL**
  (`components/layout/call-provider.tsx`, monté dans le layout) : il **survit à la navigation**
  dans l'ERP — réduit, il devient une carte flottante (état, durée, mute, restaurer,
  raccrocher) ; **Échap réduit, ne raccroche jamais** ; raccrocher coupe le média mais
  **préserve** conversation, transcript et actions ; Mute coupe le micro sans fermer la
  connexion. **TYPE** : un vrai champ de saisie DANS l'appel — le texte entre dans la même
  session, l'IA peut répondre à l'oral ; le champ de la page fait pareil pendant un appel actif.
  **Cartes live** : pendant que la voix résume, chaque dossier lu pousse sa carte (libellé +
  lien) dans le bandeau — toucher = réduire l'appel + ouvrir la page, la conversation continue ;
  de retour au chat, sources et propositions réinjectées (tamponnées si le chat était démonté).
  **Contexte d'écran SANS espionnage** (route + référence, jamais de capture) : envoyé à
  l'ouverture (borné 300 caractères côté serveur → bloc « CONTEXTE D'ÉCRAN » dans les
  instructions) puis à chaque navigation (item système compact) — « ça », « ce dossier » se
  résolvent. **« Appeler » depuis une fiche** (Legal, demande de paiement) :
  `/chief-of-staff?call=1&ref=…` — l'appel démarre avec le dossier en contexte, « où ça
  bloque ? » se résout dès la première seconde. **Travail parallèle** : les outils ne se
  sérialisent plus — une délégation lourde tourne en fond pendant que les questions rapides
  reçoivent leurs réponses (une seule réponse vocale active : discipline `response.create` sur
  `response.done`). **Résumé d'appel** au raccrochage (durée, sujets, cartes affichées, outils
  consultés, actions PROPOSÉES — « rien d'exécuté sans confirmation ») : des faits, aucune
  action créée, persisté dans le fil ; reprendre l'appel ne re-salue pas. **TIME TRAVEL**
  (`lib/assistant/time-travel.ts`, outil `time_travel`, fast path vocal) : « où en était ce
  dossier au 1ᵉʳ juin ? » → reconstruction **STRICTEMENT LECTURE SEULE** depuis le journal
  d'audit — champs à la date (dernière écriture avant / valeur remplacée juste après),
  événements déjà survenus, **ce qui a changé depuis + état actuel en face**, étapes ANPP à la
  date ; dossier créé après la date → « n'existait pas encore » ; l'outil DIT ce que le journal
  ne capture pas. Familles d'intentions documentées : ASK/SHOW/EXPLAIN/COMPARE/ANALYZE/
  SIMULATE/TIME_TRAVEL/BRIEF = lectures à la demande ; PREPARE/GENERATE = brouillons jamais
  auto-envoyés ; REMIND/MONITOR = demande explicite ; ACT = politique d'actions complète.
  Tests : `time-travel.test.ts` (reconstruction exacte, lecture seule prouvée — le journal ne
  bouge pas d'une ligne —, honnêteté), `voice-realtime.test.ts` étendu (contexte d'écran borné,
  time_travel fast path). **Recette en conditions déployées** (à dérouler sur Render, micro
  réel) : 1. bouton téléphone → appel, ● LIVE + minuterie à la connexion réelle ; 2. réduire
  puis naviguer 3 pages → l'audio ne coupe jamais, restaurer remet l'écran d'appel ;
  3. depuis `/legal/[id]` → « Appeler » → « où ça bloque ? » sans nommer le dossier → bonne
  réponse ; 4. « montre-moi le paiement Hikma » → carte à l'écran, toucher = fiche ouverte,
  conversation continue ; 5. bouton Clavier → question écrite → réponse orale, même contexte ;
  6. « analyse l'organisation » puis DANS LA FOULÉE deux questions rapides → réponses sans
  attendre la fin de l'analyse ; 7. « où en était REG-… au 1ᵉʳ juin ? » → état passé + « ce qui
  a changé depuis », AUCUNE écriture ; 8. « qu'est-ce que je rate ? » → ceo_attention à la
  demande ; 9. raccrocher → résumé d'appel dans le fil (faits seulement), rouvrir l'appel → pas
  de re-salutation ; 10. Échap → réduit (jamais raccroché) ; 11. suggestion (« je peux aussi
  te… ») → RIEN ne part sans « fais-le » ; 12. mobile plein écran (safe areas) + desktop modal.
- **VOIX TEMPS RÉEL — le Chief of Staff au téléphone (speech-to-speech).** L'ancienne chaîne
  « VAD maison → Whisper → prompt texte → attente → TTS phrase par phrase » est REMPLACÉE par une
  vraie session **`gpt-realtime-2.1`** (API Realtime OpenAI, **WebRTC direct navigateur ↔ OpenAI**
  — le média ne transite pas par notre backend) : on parle, il répond à voix haute immédiatement
  (audio streamé), on l'**interrompt en parlant** (détection de tour sémantique côté serveur +
  purge du tampon local — aucun buffer périmé rejoué), on enchaîne les sujets. **Clé jamais
  exposée** : `/api/assistant/voice/session` (authentification + siège exécutif + module
  CHIEF_OF_STAFF) configure la session CÔTÉ SERVEUR et ne rend qu'un **secret éphémère** (10 min).
  **Une seule conversation** : l'appel continue le fil texte (derniers échanges injectés bornés —
  « et son salaire ? » comprend le Khaled du mode texte), chaque tour vocal est **persisté dans le
  même fil** (`rememberExchange`, distillation de mémoire comprise), le texte tapé pendant l'appel
  entre dans la session (réponse parlée). **Mêmes outils, mêmes permissions** : adaptateur
  PowerTool → Realtime (~25 fast paths — employee_360, read_payroll, search_everything,
  find_documents, plan_reminder… — filtrés par les droits, RE-vérifiés serveur à chaque appel via
  `/api/assistant/voice/tool`) + **`delegate_to_chief_of_staff`** pour les actions et analyses
  profondes : l'orchestrateur texte existant tourne, les ACTIONS reviennent en **cartes de
  confirmation à l'écran** (rien ne s'exécute à la voix seule, CRITIQUE = re-saisie), le détail
  s'AFFICHE pendant que la voix résume (compagnon visuel). Le moteur vocal est **encapsulé**
  (`VoiceRealtimeProvider` → `OpenAIGptRealtime21Provider`) : un futur moteur type gpt-live se
  branche sans toucher au Chief of Staff. **UI mode appel** : orbe à états, mute, raccrocher,
  transcript secondaire, **réductible en barre** (consulter un document sans raccrocher),
  reconnexion propre (nouveau secret, même fil), échec → message clair + dictée en repli explicite
  (jamais déguisée en temps réel). Observabilité : logs structurés (session/outils/interruptions/
  reconnexions, sans contenu audio) + `AiUsageLog` (fonction `voice_realtime` : durée, premier
  audio, outils) + carte d'état Administration → IA. L'ancienne route TTS (`/api/assistant/speak`)
  et `synthesizeSpeech` sont SUPPRIMÉES ; la dictée (`/api/assistant/transcribe`) reste le repli.
  **Recette en conditions déployées** (le code ne peut pas s'auto-entendre — à dérouler sur
  l'environnement Render, micro réel) : 1. « Est-ce que tu m'entends ? » → réponse À VOIX HAUTE +
  transcript ; 2. interruption en pleine réponse → silence immédiat + nouvelle consigne traitée ;
  3. « Quelle est ma masse salariale ? » → fast path réel, chiffre exact ; 4. « Trouve-moi le
  contrat de Khaled » puis « montre-le » → document à l'écran, conversation continue ; 5. « Quel
  âge a-t-il ? » → contexte conservé ; 6. texte « Parle-moi de Pembro » puis voix « et le
  paiement ? » puis texte « qui le bloque ? » → même contexte cross-modal ; 7. « Relance Khaled »
  → carte de confirmation, rien d'exécuté ; 8. « Rappelle-moi dimanche matin » → vrai rappel ;
  9. « Analyse toute l'organisation Regulatory » → accusé oral immédiat, moteur profond au
  travail, session vivante ; 10. pendant l'analyse : « combien me coûte Regulatory ? » → réponse
  sans attendre ; 11. conversation ≥ 15 min ; 12. coupure réseau → reconnexion, même fil ;
  13. micro refusé → erreur propre + dictée ; 14. iPhone/Safari ; 15. OpenAI bloqué → PAS de
  bascule silencieuse vers un faux temps réel ; 16-17. permissions et action critique identiques
  au texte ; 18. latences (bouton→connexion, fin de parole→premier audio, barge-in→silence) ;
  19. logs `model = gpt-realtime-2.1` ; 20. le tout sur l'environnement DÉPLOYÉ.
- **Executive AI Operating System (6 lots A–F).** My Chief of Staff devient le cerveau exécutif
  de l'entreprise — très autonome dans la RECHERCHE et le RAISONNEMENT, conservateur dans
  l'EXÉCUTION. **Gouvernance** : registre `ACTION_POLICY` typé (toute action confirmée est
  déclarée EXTERNE, une non déclarée ne compile pas), **ARRÊT D'URGENCE**
  (`aiExternalActionsDisabled` — coupe toutes les actions externes et les relances, les lectures
  continuent), **confirmation groupée** (« crée les trois tâches » = une carte par action + un
  « Tout confirmer » — les CRITIQUES restent individuelles), **surveillance conditionnelle**
  (« si pas validé sous 48 h, préviens-moi » : relit l'entité à l'échéance, ne prévient QUE le
  propriétaire — surveiller ≠ relancer). **Mémoire typée** (`AssistantMemoryItem` :
  « retiens que pembro = Pembrolizumab » — alias appliqués à la recherche fédérée, injection
  bornée, « la mémoire n'est JAMAIS la source de vérité d'un chiffre »), **fil principal**
  (une conversation continue par personne, plafonnée, `recall_conversation` sur ses archives),
  **registre des DÉCISIONS** (options écartées, attendu, relecture, résultat RÉEL — enregistrer
  n'exécute rien) et **ENGAGEMENTS** (retard visible en alerte, aucune relance automatique).
  **Vues 360°** : `employee_360` (âge CALCULÉ avec sa source, salaire si module RH, activité
  OBSERVÉE cadrée, dépendance personne-clé), `product_360`, `supplier_360`,
  `organization_insights`, `process_insights` (délais réels 180 j, pires cas référencés).
  **Découverte documentaire en Drive « sale »** : `find_documents` (nom + **index textuel
  progressif** `DriveTextIndex` nourri à chaque lecture + vérification bornée — confiance
  HAUTE/MOYENNE/FAIBLE, preuve citée, « le nom d'un fichier est un indice, pas une preuve »).
  **Simulation jamais mutative** (`simulate_scenario` : salaire, départ, recrutement,
  trésorerie — hypothèses DITES, zéro écriture), `company_state`, `ceo_attention`
  (DOIT DÉCIDER / DEVRAIT SAVOIR / SURVEILLER) + bandeau « Aujourd'hui » sur `/chief-of-staff`.
  **Livrables universels** : `draft_deliverable` — de VRAIS .docx/.xlsx/.pptx depuis UNE spec
  (format ALL = trois fichiers aux chiffres identiques par construction), Sources obligatoires,
  registre versionné `AssistantArtifact`, dépôt Drive « Livrables IA ». **Corpus de connaissance
  généralisé** : catégories (Droit du travail, fiscal, ANPP, MIPH, marchés…), textes ARABES
  découpés par المادة, `search_knowledge_corpus`/`read_corpus_document`/`list_corpus_sources` —
  et l'honnêteté du corpus muet (« pas encore assez de sources vérifiées », jamais un article
  inventé). **Anomalies** à règle dite (doublon de facture, montant ≥ 4× la médiane du
  bénéficiaire). Migrations idempotentes ×5, ~35 tests réels ajoutés (kill-switch, mémoire,
  Drive sale, livrables rouverts, simulation zéro-écriture, arabe/catégories).
- **My Chief of Staff passe en PRODUCTION (4 lots).** Le module exécutif n'est plus une v1 :
  **recherche fédérée `search_everything`** (~30 familles RBAC-aware, tolérante aux accents et
  aux fautes — extensions `unaccent`/`pg_trgm` sondées, repli LIKE, index trigrammes),
  **`inspect_record` universel** (paiements, règlements, Legal + chaîne d'achat, promo,
  secrétariat, **Regulatory, factures, courriers, projets, tâches**), **lectures transverses
  ouvertes par le DROIT de l'écran** (calendrier + `find_free_slot`, stocks, hôpitaux, fiche
  employé, paie RH, courriers, `finance_totals` — agrégats côté base, période vs période),
  **8 actions d'écriture confirmées** (`update_task`, `update_request`, `create/
  update_legal_document` avec chaînage, `update_calendar_event`, `create/update_hospital`,
  **`update_salary` niveau CRITIQUE** — carte avant/après/écart %, **re-saisie du montant**,
  verrou de fraîcheur), **proactivité** (`executive_alerts` : paiement bloqué au centre,
  validation qui dort, facture sans BC, contrat expirant, stock épuisé… ; `executive_brief` =
  « fais-moi mon point » ; `create_report` = rapport consolidé .docx déposé au Drive), **rappels
  2.0** (« chaque premier lundi du mois », relance d'une **personne nommée** en plus du rôle),
  **conversation vocale** (VAD, Whisper, réponse parlée phrase par phrase, **barge-in**, texte en
  parallèle — dictée en repli), **panneau CONTEXTE** (sources consultées poussées en SSE, actions
  du fil), **entrée contextuelle** (`?ref=`/`?q=` + bouton « Demander au Chief of Staff » sur les
  fiches Legal et paiement), **observabilité** (`AiUsageLog` : TTFT, tours, outils, erreurs,
  temps outils), **tests adversariaux** (l'IA n'est pas une porte dérobée : outils exécutifs et
  charges utiles forgées refusés côté serveur ; le contenu récupéré est de la DONNÉE, jamais une
  instruction) et **lint** posé (`next/core-web-vitals`, zéro erreur). Doc de production :
  `docs/CHIEF_OF_STAFF_ARCHITECTURE.md` (capacités, matrice finale, limites dites).
- **« My Chief of Staff » : le PDG parle à son entreprise.** Nouveau module exécutif
  (`/chief-of-staff`, PDG + Super Admin) — le même moteur que l'assistant, mais servi avec les
  gestes d'un chef de cabinet : l'**histoire complète d'un dossier** par sa référence (timeline du
  journal d'audit, validateurs nommés et datés, pièces, chaîne d'achat, état au centre de
  paiement, liens cliquables), la **fouille et la lecture** des documents du Drive (PDF, Word,
  Excel, PowerPoint — le droit vérifié nœud par nœud), le **bilan factuel** d'une personne (faits
  et métriques, jamais de jugement), les **rappels planifiés** (« rappelle-moi mardi 10 h »,
  « tous les dimanches relance Regulatory » — un vrai job dans le planificateur de la plateforme,
  qui retombe le bon jour à la bonne heure même tiré en retard), et les **décisions du centre de
  paiement** — toujours derrière la carte de confirmation, l'exécution repassant par l'action du
  centre. Trois règles gravées : la permission se vérifie côté serveur à chaque appel ; chaque
  affirmation cite sa référence, sa date et son lien ; quand la donnée n'existe pas, l'outil le
  DIT. L'architecture cible (capability matrix, entity map, phases voix temps réel / recherche
  hybride / proactivité) : `docs/CHIEF_OF_STAFF_ARCHITECTURE.md`.

- **Le centre de paiement devient un module à part, et la demande de paiement y passe VRAIMENT.**
  Celui qui autorise l'argent ne doit pas être dans l'écran de celui qui le décaisse : le centre
  quitte les Finances (`/centre-de-paiement`, module RBAC propre, ancienne adresse redirigée). Les
  demandes de paiement perdent leur module : elles se déposent depuis les **Demandes de
  validations**, et le chaînon manquant est posé — le **bon à payer crée enfin l'ordre de
  dépense** par la porte commune, qui applique la règle du centre (dès 50 000 DZD, autorisation du
  PDG ou du Super Admin AVANT que les Finances ne voient l'ordre). `expenseOrderId`, prévu au
  schéma mais jamais rempli, porte enfin le lien — et la transition APPROVED étant terminale,
  l'ordre ne peut pas naître deux fois.

- **Legal lit un achat d'un bout à l'autre.** Le devis et la facture rejoignent Legal, et chaque
  pièce pointe vers celle dont elle découle : la fiche montre la **chaîne entière** — dates,
  montants, **validateurs de chaque maillon**, **délai en jours** entre deux maillons, **écart
  devis → facture** (il doit se voir AVANT que l'argent parte), et le **règlement** au bout avec
  son état. « Envoyer au règlement » sur une facture passe par le centre de paiement, et une
  facture ne part jamais deux fois. Un devis à deux BC : chaque BC remonte au même devis, et l'on
  lit toujours le fil de LA pièce qu'on regarde — jamais un graphe qui mélangerait deux commandes.

- **Le circuit court du matériel promo prend l'écran.** Le moteur existait, la fiche montrait
  encore la frise des quinze marches. Toute nouvelle demande démarre sur le circuit court (case
  « j'ai déjà un devis » qui saute la demande de devis, N+1 figé par l'organigramme) ; PDG et
  Super Admin voient la chaîne entière, les autres l'étape en cours et « on attend qui » ; les
  trois chantiers (BC, paiement, visa) se clôturent indépendamment ; les dossiers d'avant la
  réforme basculent d'un clic.

- **Des tableaux qui se filtrent par leurs colonnes, et un secrétariat qui respire.** Courriers :
  Départ et Arrivée se filtrent **au mois** (« le courrier à la CNAS de mars »), l'Accusé par
  présence. Legal : Début et Échéance au mois. Bureau du secrétariat : les six boutons d'en-tête
  (Bureau de Donna, Validations, Courses, Missions…) et la rangée d'onglets de statut disparaissent
  — chaque colonne porte le filtre qui lui va (texte, menu, mois). Ad & Pro gagne sa **vue par
  catégorie** (pastilles avec compte, même règle que le filtre de colonne). Depuis les trois
  petits points du Drive, un fichier se **classe en courrier** comme il se déclarait dans Legal —
  référence sans copie, doublon refusé. Et chaque **annuaire de praticiens** règle désormais **qui
  peut l'ouvrir** : des noms cochés ferment l'annuaire aux autres, pastille masquée, adresse en
  404, praticiens exclus de la vue « Tous » — sans quoi la restriction ne serait qu'une pastille
  masquée.

- **Le centre de paiement : au-dessus de 50 000 DZD, l'argent ne sort pas sans le PDG.** Les
  paiements naissaient dans huit modules et se rejoignaient aux Finances — chacun validé quelque
  part, aucun validé **au même endroit**. Personne ne pouvait dire, un mardi matin, ce que la société
  s'apprêtait à décaisser cette semaine. Tout paiement passe désormais par un **centre tenu par le
  PDG et le Super Admin**, **BV Regulatory compris** ; les **moyens généraux** en sont exceptés
  (c'est l'argent du quotidien, déjà tenu par une caisse et un budget de département — y faire
  remonter une rame de papier paralyserait le service). Le seuil est à **50 000 DZD** : en dessous,
  un paiement validé part **directement**, parce qu'un centre qui fait la queue pour de petits
  montants devient un goulot que l'on contourne. Un montant illisible est traité **comme
  au-dessus** : dans le doute, on demande. Quatre issues, et non deux — **autoriser**, **refuser**,
  **demander une révision du montant** (le centre propose, il ne réécrit pas : c'est au demandeur de
  corriger) ou **demander une argumentation** —, avec autant d'allers-retours qu'il en faut dans un
  seul fil horodaté ; un refus sec obligeait à tout refaire et perdait la discussion. **Un centre par
  entité** : autoriser un paiement d'Adventum et un de Pharmagène sont deux gestes comptablement
  distincts. Les **Finances ne voient rien** tant que le centre n'a pas tranché — sinon le comptable
  paie de bonne foi ce qui n'est pas autorisé — mais elles voient les **refus** (elles doivent savoir
  que l'argent ne viendra pas) et gardent l'accès à la **demande complète** : qui paie doit pouvoir
  lire ce qu'il paie. Le verrou n'est pas dans l'affichage, il est au **décaissement** : masquer une
  ligne est du confort, `canDisburse` est la règle.

- **Le matériel promotionnel : cinq marches au lieu de seize, puis trois chantiers en parallèle.**
  Une brochure attendait trois semaines dans une file indienne, et personne ne savait sur quelle
  marche elle dormait. Il reste : **devis** (sauté si le demandeur a déjà le sien — demander un devis
  qu'on a en main est une marche pour rien), **validation du demandeur**, **N+1** (le responsable
  réel de l'organigramme, pas un rôle générique), **PDG *ou* Super Admin — l'un des deux suffit**
  (en exiger deux ajouterait une attente sans ajouter de contrôle), puis l'**information médicale**,
  qui déclenche la demande de **visa publicitaire**. Ensuite trois chantiers **en parallèle** et non
  en file : bon de commande, demande de paiement (qui repart dans le circuit normal, centre de
  paiement compris) et visa. Le dossier n'est terminé que lorsque les trois le sont — c'est le code
  qui le dit, pas quelqu'un qui coche. Et la **visibilité est restreinte** : chacun voit **sa**
  marche et l'avancement, **seuls le PDG et l'administrateur voient tout le circuit**.

- **Le rejeu de session : rembobiner ce qu'une personne a fait, au lieu de le lui faire raconter.**
  Le support recevait « ça ne marche pas » — sans page, sans heure, sans manipulation ; on demandait
  une capture d'écran, elle arrivait deux jours plus tard, floue, et le bug n'y était pas. On ouvre
  maintenant la session et l'on voit la suite exacte des gestes, **le curseur déjà posé sur la
  première erreur** — c'est ce qu'on vient chercher, faire dérouler à la main ferait perdre le temps
  qu'on veut rendre. La lecture automatique respecte le **rythme réel** (×4, silences plafonnés) :
  l'hésitation, les allers-retours, les trois clics sur le bouton qui ne répond pas. ⚠️ **Ce n'est
  pas une vidéo** : un navigateur ne peut pas filmer l'écran sans autorisation explicite ni
  indicateur visible — c'est une garantie du navigateur, pas un réglage qu'on désactive. Ce sont les
  **actions** qui sont enregistrées, comme le font LogRocket ou FullStory, et cela suffit à
  reproduire un bug. **Aucune valeur de champ n'est lue**, nulle part : les champs mot de passe,
  secret, jeton, IBAN, RIB, CVV, carte et les champs cachés sont écartés **entièrement, avant même
  leur libellé** (savoir qu'une personne a tapé dans « mot de passe » est déjà de trop) ; d'un champ
  sensible on garde le **nom**, jamais le contenu — on sait QU'elle a rempli « Montant », jamais
  COMBIEN. Les messages d'erreur passent par un filet qui retire adresses, numéros longs et jetons,
  et **le masquage est refait côté serveur** : un client modifié ne doit pas pouvoir faire entrer ce
  qu'il veut dans un journal que le support relira. **Super Admin uniquement** — pas le PDG, pas les
  RH : c'est un outil de diagnostic, l'élargir en ferait un outil de surveillance.

- **La messagerie Microsoft 365 : d'abord voir ce qui se passe, ensuite corriger.** Un message
  partait sans arriver et « les logs ne montrent presque rien » — parce que la couche Graph
  **jetait le code d'erreur** de Microsoft pour n'en garder qu'un texte générique. On a donc rendu
  l'envoi **traçable** avant de toucher à quoi que ce soit : chaque appel Graph journalise son
  opération (identifiants masqués), son statut, son code et l'**identifiant de corrélation** — celui
  qu'un administrateur Exchange peut rechercher. Deux règles au passage : on ne **rejoue jamais** une
  écriture (POST/PATCH/DELETE) sur une erreur serveur, sous peine d'envoyer le message deux fois ; et
  l'échec de l'**étape d'envoi** dit désormais que « le message est resté dans vos brouillons »,
  parce que c'est vrai et que c'est ce que la personne doit savoir. Le chargement des dossiers, lui,
  échouait en **400** sur une seule cause : `wellKnownName`, qui n'existe **pas** en v1.0. Le retirer
  sèchement aurait cassé les boîtes en français (« Éléments envoyés » ne se reconnaît pas par son
  nom) : les dossiers système sont donc résolus **par leur nom bien connu**, langue indépendante, et
  les dossiers techniques (`outbox`, historique de conversation) masqués avec leurs enfants.

- **Les courriers : des dossiers, autant de pièces qu'il en faut, et le droit de se tromper.** Un
  registre plat devient illisible au bout de deux cents plis — il a maintenant ses **dossiers de
  classement**, comme Legal (les supprimer **déclasse** les courriers, il ne les détruit pas). Un pli
  sortant part rarement à une seule personne : chaque **pièce** porte donc son intitulé, **son
  destinataire** et son fichier — téléversé, ou **pris dans le Drive sans être recopié**, parce qu'un
  contrat dupliqué se met à diverger de son original. Un courrier peut aussi se créer **depuis le
  Drive**, le fichier étant déjà là. Et l'on peut enfin **supprimer** ce qu'on a créé par erreur :
  faute de bouton, on créait le bon **à côté** et le registre finissait par contenir deux vérités —
  la suppression reste **traçable et réversible** (instantané dans la corbeille du Super Admin).
  Dernier détail qui coûtait cher : un lien Drive rattaché à un courrier ou à un document légal ouvre
  désormais **le fichier exact**, et non l'explorateur à charge du lecteur de retrouver la pièce.

- **Trois annuaires, et des documents qu'on nomme soi-même.** Les praticiens tiennent maintenant dans
  **plusieurs annuaires nommés** — « Cardiologues Centre », « Pédiatres Ouest » — qu'on crée, renomme
  et supprime ; supprimer un annuaire **déplace** ses praticiens vers un autre, parce que détruire
  des centaines de fiches en renommant un classeur serait une perte sèche. L'**annuaire
  d'entreprise** rassemble les contacts extérieurs — agence de voyage, livreurs, agence marketing,
  imprimeur, transitaire — que chacun gardait dans son téléphone : le jour où la personne est en
  congé, plus personne n'a le numéro. Et les pièces déposées sur une **entité** héritaient d'une
  liste de noms **empruntée au dossier CTD** (« Module 3.2.P »…), qui n'a rien à voir avec des
  coordonnées légales : la liste a été retirée, on nomme le document comme on le nommerait sur une
  étagère. Côté **Bureautique**, la co-édition existait déjà et fonctionnait — ce qui manquait était
  qu'on le **sache** : le module le dit maintenant et montre les documents déjà partagés en
  modification, et `docs/ONLYOFFICE_SETUP.md` donne les quatre étapes du serveur, ce qui est garanti,
  et la panne la plus silencieuse (un `APP_URL` injoignable : l'éditeur s'ouvre, mais n'enregistre
  rien).

- **Regulatory : trois champs passent au Super Admin, et le porteur du dossier est prévenu.** Le
  **statut de fabrication** (Importation → packaging secondaire → primaire → full process), le
  **chargé du dossier** et l'**entité** ne décrivent pas le produit : ils décident de ce qu'il
  engage — l'investissement industriel, un engagement pris au nom de quelqu'un, et qui a le droit
  de voir le dossier. Ils ne se modifient plus que par le Super Admin, sur les **quatre** portes
  qui y menaient : la fiche, les deux menus du tableau, et la **promotion par variation obtenue** —
  celle-là était la porte dérobée, on changeait le statut réservé en déclarant une variation
  obtenue. Le reste de la fiche demeure ouvert : on ne fige pas un dossier, on protège trois
  décisions. Un refus **n'annule pas** l'enregistrement — le reste est écrit et la réserve nomme
  les champs refusés. Et le **chargé du dossier est notifié**, avec l'avant et l'après (« Statut de
  fabrication : Importation → Full Process ») : c'est lui qui répondra à l'agence, l'apprendre
  trois semaines plus tard en rouvrant la fiche par hasard n'est pas acceptable.

- **Confier un dossier Regulatory, c'est en donner l'accès — vraiment.** On désignait la personne
  chargée d'un dossier, elle recevait « Vous êtes chargé(e) de ce dossier »… et le lien menait à
  une redirection. Trois verrous se refermaient l'un après l'autre : **le module** (son rôle
  n'ouvrait pas Regulatory, donc aucune ligne, aucune page), **la gamme** (un dossier hors de sa
  gamme restait invisible même en étant nommée dessus) et **le cadenas** (un dossier au pipeline
  n'existe pour personne). Porter un dossier **ouvre désormais le module**, en portée ASSIGNED —
  ses dossiers, et rien d'autre : voir, avancer, déposer, exporter ; ni créer, ni supprimer, ni
  valider, qui ne sont pas des gestes de porteur. Être **nommé** passe avant le filtre de gamme —
  la gamme dit « votre périmètre habituel », nommer quelqu'un dit « celui-ci aussi ». Le cadenas,
  lui, ne cède pas : il protège un portefeuille encore confidentiel, et céder devant une
  assignation le rendrait décoratif — mais **on le dit**, à la personne comme à celui qui vient de
  confier le dossier. Deux garde-fous : un **blocage explicite** du module par l'administrateur
  gagne toujours (sinon il se lèverait tout seul, un jour où personne ne regarde), et le
  **cloisonnement par entité** reste intact (porter un dossier d'une autre société se décide en
  ouvrant cette société, pas par effet de bord).

- **Assigner une to-do à quelqu'un, c'est lui DEMANDER.** Il y avait deux boutons — « Nouvelle
  tâche » et « Demander une tâche » — pour un même geste, et personne ne devinait lequel prendre :
  on choisissait presque toujours le premier, et la tâche atterrissait chez l'autre **sans qu'il
  l'ait acceptée**, sans échéance négociée, sans endroit où déposer son travail — le demandeur
  n'apprenait jamais si elle serait faite. Un seul bouton reste, et c'est le champ **« Assignée
  à »** qui tranche, à l'endroit même où l'on choisit la personne : **pour soi, une to-do**
  (personne n'accepte ce qu'il s'impose) ; **pour quelqu'un d'autre, une demande** — accepter ou
  refuser, puis faire et valider. Le destinataire reçoit une **notification en pop-up plein
  écran** : une demande qui attend SA réponse doit interrompre, sinon elle dort dans la cloche
  derrière quarante autres et le demandeur attend trois jours une réponse d'une seconde. Les
  participants et les lecteurs, eux, n'ont que la cloche — les interrompre pour une information
  qui n'attend rien d'eux apprendrait à fermer les pop-up sans les lire, et la prochaine, celle
  qui comptait, se fermerait avec. On peut désormais joindre des **pièces dès la création** (le
  bon de commande à retirer, le plan du lieu), et le dossier de la tâche porte un **fil
  d'échange** : « pour quelle heure ? », « le bureau était fermé, je repasse demain ». Tout le
  cercle y écrit, **lecteurs compris** — on les a nommés parce qu'ils connaissent le sujet, et les
  renvoyer vers la messagerie séparerait l'information de la tâche qu'elle concerne. Le fil ne se
  modifie ni ne s'efface : c'est la trace de l'échange, pas un brouillon.

- **Le Drive a une barre de recherche.** On se souvient d'un mot du nom, jamais du chemin : sans
  recherche, la seule issue était de rouvrir les dossiers un par un — et l'on finissait par
  redemander le fichier à celui qui l'avait déposé, ou par le **re-téléverser en double**. Elle
  cherche **sur tout le Drive visible** (chercher là où l'on est déjà ne sert à rien), **chaque
  résultat porte son chemin complet** (trois « Contrat.docx » sont sinon indiscernables), et le
  classement est par **pertinence** — nom exact, préfixe, mot, reste — non par date, qui remonterait
  le fichier touché ce matin devant celui qu'on nomme précisément. Deux points de conception : le
  périmètre est **étendu aux sous-arbres des dossiers visibles** (un dossier partagé contient
  surtout des fichiers déposés par d'autres, et ce sont ceux-là qu'on cherche), et la recherche se
  fait en **deux passes** — la base sur le motif exact, puis une tranche bornée relue en mémoire
  pour **ignorer les accents**, PostgreSQL ne sachant pas le faire sans extension. Quand on coupe,
  **on le dit** : une recherche tronquée prise pour une absence conduirait à re-téléverser un
  fichier qui existe déjà.

- **Messagerie : joindre un dossier, et partager le Drive sans recopie.** Trois façons de joindre
  sous un seul trombone — des fichiers, un **dossier** (le navigateur ne sait pas envoyer un
  dossier, il rend ses fichiers à plat : on les rassemble en une **archive .zip** nommée d'après le
  dossier), et **depuis le Drive**. Ce dernier ne recopie rien : le message porte une **référence**
  au nœud et les destinataires reçoivent un **accès en lecture**. Recopier un contrat de 40 Mo dans
  cinq conversations stockait cinq copies **et figeait cinq versions** — six mois plus tard, cinq
  personnes travaillent sur cinq fichiers différents et nul ne sait lequel fait foi ; la référence
  ouvre toujours la **version courante**. Le serveur ne croit rien du client : il relit nom, taille
  et type **en base** et revérifie que l'expéditeur a réellement accès au nœud. L'octroi ne
  **régresse jamais** un droit existant (un `VIEW` posé sur un `EDIT` retirerait l'édition à
  quelqu'un en lui envoyant un message). Un **partage nominatif ouvre désormais le module Drive à
  lui seul** — sans cela, recevoir un document donnait un lien qui menait à un refus. Et les pièces
  jointes suivent enfin la règle du Drive : on refuse les **exécutables**, et rien d'autre — la
  liste blanche étroite rejetait une vidéo de congrès ou un export `.msg`, que les gens envoyaient
  donc par WhatsApp, hors de l'outil.

- **Pipeline réglementaire : le Super Admin ouvre l'accès à qui il veut.** Un dossier verrouillé —
  un produit qu'on **étudie** — n'existait que pour une seule personne au monde. C'était trop peu :
  le directeur du développement ou le responsable réglementaire qui **montent** le dossier
  travaillent dessus avant l'ouverture du cadenas, et recevaient donc le portefeuille par courriel,
  hors de l'outil — exactement ce que le verrou voulait empêcher. **Deux droits, jamais
  confondus** : **consulter** (une confidence) et **tenir le cadenas** (publier à toute
  l'entreprise, ce qui ne se reprend pas — ce qui a été lu a été lu), le second à moins de monde que
  le premier. Rôles **et** personnes nommées, réglés en Administration ; listes vides par défaut,
  donc comportement identique tant que rien n'est réglé. L'entrée de menu « Pipeline » et la page
  se **ferment** à qui ne voit aucun dossier verrouillé : une entrée qui ouvre un écran vide se
  clique, ne se comprend pas, et finit en question à l'administrateur.

- **Demandes de paiement : de retour dans « Demandes de validations ».** Le bouton « Finances » de
  la liste a disparu : la page est **ouverte à tout le monde** — n'importe qui peut avoir une
  facture à faire payer — alors que le module Finances ne l'est pas ; le bouton menait donc la
  plupart des gens vers un refus. Les Finances continuent de les voir depuis **leur propre module**.
  La règle d'accès était déjà **nominative** (demandeur, destinataire, Finances) et tranche avant la
  porte du module : elle a survécu au déménagement sans changer d'une ligne.

- **Papiers en-tête : l'assistante de direction et le Super Admin, et personne d'autre.** La
  Direction et le Directeur Général en ont été retirés : ils **signent** les courriers, ils ne
  tiennent pas la papeterie. Leur laisser le bloc, c'était afficher un panneau de gestion — bouton
  « Téléverser » et modèles retirés compris — à des gens qui n'ont jamais à y toucher. **Choisir**
  un en-tête à la création d'un document reste ouvert à tout le monde : c'est le but même d'avoir
  des modèles.

- **Module Recrutement — du besoin d'un directeur jusqu'à l'intégration.** Recruter est un
  engagement pluriannuel qui n'appartient à personne seul : le circuit est donc long, et
  volontairement. Un **directeur formule** le besoin (poste, missions, compétences, contrat parmi
  CDI / CDD / consulting / stage, fourchette de rémunération, dates, fiche de poste) — et le droit
  de demander suit l'**organigramme**, pas une liste de rôles : diriger ou seconder un département
  ouvre le module. Sa **hiérarchie valide marche par marche jusqu'au sommet** ; la chaîne est
  calculée sur l'organigramme réel puis **figée à la soumission**, sinon une réorganisation
  changerait les validateurs d'une demande déjà partie. La direction générale peut trancher à
  n'importe quelle marche — sans quoi une demande reste bloquée pendant une absence — et les
  marches sautées sont marquées **non consultées**, jamais « approuvées » : écrire qu'un N+1 a
  validé ce qu'il n'a pas vu serait un faux. Les **RH instruisent** et demandent des précisions
  autant de fois qu'il le faut ; la demande **retourne alors au demandeur** et quitte leur file.
  Poste ouvert, les RH déposent les **CV reçus**, le **demandeur présélectionne** (c'est lui qui
  sait ce que le poste exige) et la direction **tranche — parmi les présélectionnés ou en dehors** :
  la présélection est un avis, pas un tri éliminatoire. Enfin l'**intégration**, fiche employé
  pré-remplie depuis la demande — **sauf pour un consulting**, intervenant externe qui n'entre ni
  dans l'effectif, ni dans la paie, ni dans l'organigramme. Le pipeline vit sur les **candidats**,
  pas sur la demande : plusieurs personnes avancent en parallèle à des vitesses différentes.

- **Congés : un intérimaire tient la place.** Une personne part trois semaines, ses validations
  s'empilent, et l'on découvre au retour qu'une demande attendait depuis quinze jours. L'**absent
  désigne** son remplaçant et **choisit ce qu'il délègue** ; les **RH valident** (sans cette marche,
  chacun se choisirait un remplaçant complaisant) ; la délégation **ne vit que pendant le congé** et
  s'éteint d'elle-même — personne n'a rien à révoquer, et c'est précisément ce qui la rend sûre, au
  contraire d'un accès ouvert « pour cette fois » qui ne se referme jamais. Deux bornes la
  distinguent d'un compte partagé : **jamais tout le compte** (Drive, messagerie et espace personnel
  ne se délèguent pas) et **jamais plus que ce que l'absent avait**, suppression exclue. Pendant la
  fenêtre, l'intérimaire ouvre les modules délégués et **tranche les validations adressées à
  l'absent** — le journal disant qu'elles l'ont été au titre d'un intérim.

- **L'assistant IA exporte en Excel, règle la plateforme et modifie un dossier Regulatory.**
  L'export produit un vrai `.xlsx` déposé dans le **Drive personnel** du demandeur (dossier
  « Exports IA ») — il doit vivre là où les autorisations existent déjà, pas dans un lien qui traîne
  — et son contenu ne dépasse **jamais** ce que la personne a le droit de lire (l'export de
  l'effectif ne porte aucune colonne de rémunération : un classeur circule sans ses droits d'accès).
  Le Super Admin lit et modifie les réglages ; n'importe quel champ d'un dossier réglementaire se
  corrige par la conversation. Ce qui rend cela tenable est une **liste blanche typée et bornée** :
  ce qui n'y figure pas n'est pas écrivable, la console d'administration ne se masque jamais, une
  liste **remplace** l'ancienne (et la carte de confirmation le dit), et chaque valeur est **relue**
  avant d'atteindre la base — la confirmation de l'utilisateur ne remplace pas la validation.

- **Regulatory : relancer la mise à jour des dossiers**, une personne ou tout le monde, par le
  Super Admin ou le Directeur Général seulement. On ne parle pas d'un dossier mais d'un
  **portefeuille** : le panneau montre d'abord, par personne, le nombre de dossiers, la part en
  sommeil (plus de 30 jours sans mouvement) et la date de la dernière relance. Un dossier
  **verrouillé** ou **abouti** ne compte pas — relancer quelqu'un sur un dossier qu'il ne peut pas
  ouvrir, c'est lui demander l'impossible. Les dossiers **sans chargé de dossier** sont comptés à
  part : les taire donnerait une somme fausse.

- **Courriers : la direction et la personne que le pli concerne.** Deux champs facultatifs et
  cumulables — un contrat vise « la Direction Générale » ET son directeur, une convocation une
  seule personne. La direction vient de l'organigramme réel, la personne est un compte actif. Une
  colonne « Concerne » filtrable au registre, et un journal qui suit les rattachements **par leur
  nom** : « cmt1es… → cmt2fk… » n'apprendrait rien à personne.

- **Masquer un module**, sans toucher aux droits ni aux données. Ce n'est pas une permission :
  masquer dit « ce module n'est pas en service ici, pour personne ». Rien n'est supprimé, démasquer
  rend le module tel qu'il était. La **console d'administration ne se masque jamais** (la cacher
  fermerait la porte de l'intérieur) et le **Super Admin continue de voir** ce qu'il a masqué —
  sinon il ne pourrait plus le rallumer. Un module masqué est **injoignable par son adresse**, pas
  seulement absent du menu.

- **Catalogue d'articles : une seule façon d'écrire, et le doublon refusé.** Casse, espaces,
  ponctuation, catégories et unités sont uniformisés à la saisie ; les sigles et formats restent en
  majuscules (« Câble HDMI », jamais « Câble Hdmi »). On **normalise sans traduire** : « Ramette »
  ne devient pas « Rame ». Un article déjà présent sous une autre orthographe est refusé, avec le
  renvoi vers celui qui existe. L'existant n'est **pas réécrit en silence** : « Vérifier » montre la
  liste avant → après, « Appliquer » vient ensuite.

- **Bureautique : créer un document avec ou sans papier en-tête.** L'assistante de direction tient
  la papeterie ; tout le monde choisit, à la création d'un Word/Excel/PowerPoint, entre « Vierge »
  et « Avec en-tête ». Un en-tête est stocké comme un **vrai document Office déjà mis en page**, et
  créer « avec en-tête » en **recopie les octets** : le résultat s'ouvre exactement comme le modèle,
  là où injecter une image ou fusionner deux documents produit des décalages qu'on ne découvre qu'à
  l'impression. Et parce que c'est une copie, modifier ou supprimer le modèle ne réécrit jamais un
  courrier déjà parti. Un en-tête retiré se **désactive** au lieu de disparaître — sinon il se
  re-téléverse en double et l'ancienne version repart en circulation.

- **Tâches demandées : accepter ou refuser, puis faire et valider — sans étape de plus.** Le circuit
  tient en trois gestes. Ce qui a été **retiré** compte autant : une demande acceptée ne repasse plus
  par « Démarrer » ni par « Mettre dans un projet » — ces boutons n'apprenaient rien à personne et
  faisaient qu'une demande acceptée restait affichée « à faire » pendant deux semaines. Accepter,
  c'est commencer. Le **motif de refus est facultatif** (l'exiger produit des « non » et des « pas
  dispo », pas de meilleures raisons) et son absence se dit au demandeur. Le travail se fait DANS la
  demande — pièces, compte rendu — et reste **toujours modifiable** après validation. Corrigé au
  passage : une demande envoyée n'apparaissait **nulle part** chez son auteur.

- **Les demandes de paiement arrivent aux Finances**, et ne sont plus dans les Validations. L'écran
  de dossier ne change pas d'un pixel — c'est celui-là qu'on voulait garder. Les anciennes adresses
  **redirigent** (des notifications déjà envoyées pointent dessus). La porte n'est **pas** le module
  Finances : n'importe qui peut avoir à faire payer une facture sans avoir de raison de voir le grand
  livre. La garde est le **cercle du dossier** — demandeur, destinataire, Finances — à l'écran comme
  sur les pièces.

- **Moyens généraux : un seul bouton de dépense.** Il y en avait deux — « Ajouter une dépense » (sur
  le budget) et « Enregistrer une dépense » (sur la caisse) — pour la **même** dépense : même achat,
  même facture, même budget consommé. On saisissait par le mauvais, et la caisse du mois se
  retrouvait fausse d'un côté, gonflée de l'autre. Le moyen de paiement est devenu une case du
  formulaire unique, **corrigeable après coup** sur une dépense déjà enregistrée. On ne retombe
  jamais silencieusement sur « hors caisse » quand la caisse est demandée sans être disponible : on
  refuse, avec le motif.

- **La demande d'achat s'ouvre à tous, le budget reste fermé.** Un délégué qui a besoin de
  cartouches coche dans le catalogue de la société (ou décrit son besoin en clair) sans connaître le
  circuit ni écrire à l'assistante. Le validateur **ne se choisit pas** : c'est le responsable
  hiérarchique du demandeur, résolu par l'organigramme — laisser choisir reviendrait à laisser
  choisir qui vous dit oui. Et le demandeur ne voit **pas** le budget : connaître le reste de
  l'enveloppe transforme une demande en négociation. Le module a donc deux visages sur le même écran.

- **Paie : une ligne payée se corrige, y compris après transfert au budget.** On ne pouvait que
  l'annuler en entier, et seulement avant le transfert : une erreur de mille dinars obligeait à tout
  ressaisir, donc on la laissait fausse. La correction **suit jusqu'à l'écriture de trésorerie**
  créée par le transfert — sinon la paie dit un montant et le budget en dit un autre. La fiche de
  paie **remplace** la précédente dans le dossier du salarié.

- **Le contrat d'un employé est aussi rangé dans le Drive**, dans une **catégorie** « RH — Contrats »
  ouverte aux seuls rôles RH (lus dans la matrice RBAC), et non plus dans le Drive personnel de qui
  téléverse. Réserve dite franchement : les comptes à portée Drive globale (Direction, Super Admin)
  voient tout le Drive — c'est une règle de plateforme.

- **Legal : des dossiers de classement.** Trois cents contrats dans une seule liste se cherchent au
  filtre, jamais au regard. Un dossier **range, il n'autorise pas** : la restriction d'un engagement
  reste sur lui. Supprimer un dossier emporte ses sous-dossiers mais **jamais ses documents** — ils
  repassent « non classés », garanti par la contrainte de base, pas par une précaution d'écran.

- **Entités › gammes › produits, et le rattachement des personnes** (`/admin/gammes`). L'entité dit
  **de qui** est un produit ; la **gamme** dit **de quoi** il relève. De cet arbre découle ce que
  chacun voit : rattaché à une **entité**, on voit toute la société ; rattaché à une ou plusieurs
  **gammes** — de la même société ou de plusieurs — on ne voit que leurs produits. Trois règles,
  portées par un module pur testé (`lib/org/product-ranges.ts`) : une gamme **ouvre** son entité en
  lecture (sinon le rattachement n'ouvrirait rien) ; elle **restreint** les produits sans jamais
  retirer un droit donné plus haut (une gamme dans une société qu'on a déjà en entier ne restreint
  rien) ; le Super Admin n'est jamais restreint. Les produits proposés sont ceux de Regulatory, et
  seuls ceux de l'entité de la gamme — ranger ailleurs ouvrirait un dossier à une autre société
  sans qu'aucun écran d'entité ne le montre. Rien ne se détruit : supprimer une gamme rend ses
  produits « sans gamme ».

- **Cloisonnement d'entité : deux trous refermés.** `currentCompanyWhere()` posait le cookie tel
  quel. Le cookie se modifie à la main — et surtout, **sans cookie il ne filtrait rien** : un
  salarié mono-entité voyait par défaut le Regulatory, le Legal et les Courriers de tout le groupe.
  Le filtre passe par la portée **validée contre les droits** (`currentCompanyWhereFor`), le
  sélecteur d'entité **disparaît** quand on n'en a qu'une, changer de portée **refuse** une société
  à laquelle on n'a pas droit, et les listes déroulantes d'entité des formulaires ne proposent plus
  que les siennes.

- **Pipeline et suivi des dossiers, vraiment séparés.** Le critère est le **verrou**, et lui seul :
  on filtrait sur l'étape, or un dossier **abouti** est classé « terminé » même verrouillé et
  réapparaissait donc dans le suivi. Un dossier se crée désormais **directement au pipeline** (il y
  naît verrouillé, et **ne prévient personne** : il n'existe que pour le Super Admin), et l'ouverture
  du cadenas reste le seul geste qui le fait passer dans « À traiter ». L'**analyse CTD** cesse
  d'être un onglet du suivi des dossiers.

- **Pièces jointes et explorateur du Drive dès la création** (Legal, Courriers). La pièce est en
  main **au moment de la saisie** : on téléverse une ou plusieurs pièces (un fichier refusé ne
  défait pas la création — l'objet est enregistré, on dit ce qui n'a pas suivi), **ou** l'on désigne
  ce qui existe déjà dans le Drive via un explorateur qui s'ouvre **par-dessus le formulaire**
  (catégories, fil d'Ariane, dossiers **et** fichiers sélectionnables). Rien n'est recopié : le nœud
  est **référencé** et l'écran en montre toujours la version courante. `MailEntry.driveNodeId`
  rejoint `LegalDocument.driveNodeId`. L'explorateur ne fait que **lire**, par le même
  `getDriveListing` que l'écran du Drive.

- **Mobile : le tiroir prend ses pôles, et l'écran cesse de glisser.** Le tiroir de gauche listait
  les treize modules **à plat** ; il range désormais par pôle, chacun derrière sa flèche, avec la
  **même mémoire d'ouverture** que la barre latérale et que la grille « Tout ». « Ça glisse trop »
  avait une cause exacte : le conteneur défilant portait `overflow-y-auto` **seul**, or un axe en
  `auto` force l'autre à devenir défilant — il défilait donc aussi latéralement, et le moindre
  tableau trop large faisait partir toute la page de travers. Enfin, la page déclarait
  `viewport-fit=cover` **sans que personne ne réserve la bande du haut** : installée depuis l'écran
  d'accueil, l'application dessinait sa barre **sous** l'heure et la batterie.

- **Courriers : pièces jointes, modification, et un journal qui dit qui a corrigé quoi.** Chaque
  courrier a sa **fiche** (`/courriers/<id>`) — le pli, ses pièces (nouveau `EntityType.MAIL_ENTRY`,
  donc même stockage, même contrôle d'accès, même copie Drive que partout), sa modification et son
  journal. La trace est réelle : **une ligne par champ touché**, ancienne → nouvelle valeur, grâce
  au module pur `lib/mail-register/trace.ts` qui ferme deux pièges (une date relue de la base est un
  `Date`, la même ressaisie une chaîne ; `null`/`undefined`/`""` disent tous « vide »). Le raccourci
  « poser une date » du tableau, qui n'était pas journalisé, l'est désormais.

- **Directions : Directeur Général et Directeur des Opérations.** Le **DG** a tous les pouvoirs
  métier mais **pas la vue globale** : il ne supervise pas les demandes de validation de tout le
  monde, et les modules personnels (Drive, directives, dossiers) restent cloisonnés. Le **Directeur
  des Opérations** est un rôle à part — approvisionnement, ventes, moyens généraux, secrétariat —
  qui **lit** le réglementaire, les budgets et les finances sans les piloter.

- **Annuler un téléversement en cours**, dans les deux moteurs. Le drapeau arrête la file, les
  requêtes **en vol** sont avorties, et côté CTD le serveur **supprime les tranches déjà reçues**
  (ce qui règle au passage la fuite relevée par l'audit disque). Proposé tant que les octets
  montent seulement : passé en inspection, l'archive est reçue et s'arrêter laisserait une version
  à moitié constituée.

- **Échéances Legal : la règle existait, personne ne la lui posait.** `runLegalExpirySweep` (au
  planificateur) aligne le statut d'un terme passé et prévient **à l'entrée** dans une zone
  d'urgence — 90 j, 30 j, dépassement — jamais tous les jours. Le titre du rappel porte **toujours**
  le nombre de jours. Le module avait deux liens morts (`/legal/<id>` n'existait pas) : la **fiche**
  existe désormais, avec dates, chaîne de renouvellement, pièces jointes et journal.

- **Liaisons transverses : un BC, une facture, un courrier savent d'où ils viennent.** Bloc
  `LinkedRecords` posable sur n'importe quelle fiche (posé sur le secrétariat et le sponsoring) +
  création **déjà rattachée** depuis l'objet qui la justifie — le seul moment où l'on sait de quoi
  la pièce vient. Chemin de retour sur les fiches Legal et Courrier. Carte pure `lib/links/source-link.ts`,
  dont un test remonte **chaque route déclarée** jusqu'à la navigation pour interdire les liens morts.

- **Téléversement d'un gros CTD : envoi direct EN PLUSIEURS PARTIES, en parallèle.** Le serveur
  ouvre un multipart S3, présigne **une URL par partie** (32 Mo) et le navigateur en envoie 6 de
  front **directement au bucket** — ni l'application, ni Postgres sur le chemin. Une coupure ne
  coûte plus qu'une partie. `docs/UPLOAD_PERFORMANCE.md` pose l'arithmétique sans détour (1,6 Go en
  10 s = ~1,3 Gbit/s montants) et les prérequis, dont la règle CORS `ExposeHeaders: ETag`.

- **Catalogues produits : fusion par RATTACHEMENT.** Le réglementaire fait référence ; le Business
  Development et le planning promotionnel s'y **rattachent** (`regulatoryProductId`) sans rien
  écraser. Écran `/regulatory/catalogue` : chaque produit orphelin avec ses correspondances **et le
  motif en toutes lettres**. Rien n'est deviné — un dosage différent est un produit différent
  (500 mg et 1 g : deux AMM, deux prix). Module pur `lib/products/catalog-match.ts`.

- **API agents — Lot 3 : l'écriture passe par un registre d'opérations.** Pas d'écriture générique :
  on déclare les opérations que le métier connaît, chacune avec sa portée et ses paramètres
  (`POST /api/v1/operations/<nom>`, idempotent ; `GET /api/v1/meta/operations` pour les découvrir).
  Une opération appelle **le même cœur que l'écran** — mêmes droits, même cloisonnement, même
  journal. La validation **refuse au lieu de deviner**, y compris un paramètre inconnu.

- **Responsive : les formulaires tiennent sur un téléphone.** Neuf écrans de saisie passent d'une
  grille à deux colonnes fixes au motif « une colonne, deux à partir de `sm` », avec leurs
  `col-span` préfixés. `lib/responsive-guard.test.ts` fige les deux règles en lisant les sources :
  une table large hors conteneur défilant, et un `col-span` non préfixé dans une grille mono-colonne.

- **Annuaire : une vraie feuille, modifiable en place.** L'annuaire des praticiens (module
  renommé de « Promotion médicale » en **Annuaire**) se corrige cellule par cellule, chaque
  modification partant seule au serveur, revérifiée au niveau de la ligne (un délégué ne touche
  que ses praticiens). Colonnes exactes du terrain — Nom, Prénom, Adresse, Ville, **Wilaya**,
  **Potentiel** (ex-« cibles »), Code postal, Téléphone, Spécialité, Grade, Mail, Privé/Public —
  avec menus fermés (les **58 wilayas** d'Algérie, grade, secteur, potentiel), vue par spécialité,
  et export reprenant exactement ces colonnes. Module pur testé `lib/medical/directory-grid.ts`.

- **Regulatory : l'administrateur compose les segments thérapeutiques.** La liste du menu
  « Segments » n'est plus figée dans le code : elle se gère en Administration › Réglages
  (`AppSetting.regulatoryTherapeuticSegments`, vide = liste par défaut). `effectiveTherapeutic
  Segments()` tranche partout — écran, menu, validation à l'écriture.

- **Tâches : participants et lecteurs dès la création.** Une tâche pouvait être confiée à une
  seule personne ; on y associe désormais des **participants** (qui peuvent agir) et des personnes
  **en lecture**. « Mon espace » remonte les tâches partagées avec moi (`Task.participantIds` /
  `readerIds` ; nouveau champ `multiselect` du formulaire générique).

- **Ad & Pro : on filtre dans les colonnes.** Fin des onglets/compteurs par état et du filtre
  « Nature », remplacés par un filtre **sous chaque en-tête** (texte, menus Nature/État, montant
  minimum, date « à partir du ») ; le bloc « Écrans détaillés par nature » disparaît.

- **Moyens généraux : l'enveloppe et la caisse ne font plus qu'un.** Une seule notion — LA CAISSE —
  lue à deux horizons : l'exercice (l'année) et le mois. Vocabulaire et présentation seulement ;
  la mécanique (dotation annuelle, fond mensuel, rallonges) est inchangée.

- **Plein écran partout, sans masquer la barre latérale.** Le bouton vit dans l'en-tête (donc sur
  tous les écrans) ; il replie le chrome et élargit le contenu **en gardant le menu de gauche**.
  L'état vit sur `<html>` (`amd-focus`), sans contexte React — `components/layout/focus-mode.tsx`.

- **Ad & Pro : la conversation avec la tierce personne remonte sous la demande.** Impliquer
  quelqu'un ouvrait un projet à part qu'on oubliait ; le fil (messages + pièces jointes, des deux
  côtés) s'affiche maintenant en bas de la demande, en réutilisant tel quel le fil des dossiers.
  `lib/queries/involvement.ts`, `components/ad-pro/involvement-conversations.tsx`.

- **Ad & Pro : la nouvelle demande se remplit sur place, et deux natures de plus.** Choisir
  « envoyer un praticien à un congrès » emmenait sur l'écran de la nature — son titre, sa
  description, sa barre d'onglets : on rendait au demandeur, au dernier moment, le découpage
  interne qu'on venait de lui épargner. Le formulaire s'ouvre désormais **dans** le panneau
  d'Ad & Pro. S'ajoutent **Consulting** (contrats entre deux parties : rémunération et son rythme,
  tâches attendues, pièces, cycle brouillon → validation → actif → expiré/annulé) et **Autre**
  (la case qui manquait, pour ne plus déclarer « en sponsoring » ce qui n'en est pas).
  `lib/ad-pro/{create-fields,consulting}.ts` (32 tests).

- **Réclamer une pièce à n'importe qui, depuis un poste de dépense.** Le seul geste offert était
  « demander un devis au secrétariat » ; tout le reste se réclamait par message. On choisit
  maintenant la personne, on dit ce qu'on demande en clair, elle dépose **sans avoir accès au
  module** — le fil ne lui ouvre que ce qui la concerne — et un refus relance la demande avec son
  motif au lieu d'obliger à tout recommencer. `lib/doc-request.ts` (20 tests), écrans `/pieces`.

- **Drive : la colonne de gauche dit OÙ, la liste dit QUOI.** Les sous-dossiers quittent le volet
  (quarante entrées en faisaient un mur qu'il fallait faire défiler pour atteindre la Corbeille),
  chaque type de fichier reçoit **sa forme et sa couleur** (Word bleu, Excel vert, PowerPoint
  orange, PDF rouge…) au lieu de la feuille grise commune, et plusieurs documents s'ouvrent en
  **fenêtres** déplaçables, redimensionnables, rangeables en mosaïque — des onglets montraient
  l'un OU l'autre. `lib/drive/{file-glyph,windows}.ts` (36 tests).

- **Drive : l'explorateur pour de bon, et tout ce qui est importé y atterrit.** Un **seul onglet**
  (le volet de navigation remplace la barre d'onglets, `/drive` et `/drive/espace/[id]` ont
  désormais le même écran), **colonnes triables** branchées sur `sortRows`, **clic droit →
  « Nouveau ▸ Dossier / Word / Excel / PowerPoint »** avec saisie du nom dans le menu, **plein
  écran** mémorisé, **partage à plusieurs personnes** en une fois. Et surtout : chaque document
  téléversé depuis n'importe quel module est **répliqué dans le Drive de celui qui l'importe**, sous
  `Mes documents importés / <module> / <objet>` — dans son drive à lui, donc sans créer le moindre
  accès nouveau. `lib/drive/{mirror-path,mirror,document-mirror}.ts` (12 tests).

- **Téléversements plus rapides vers le bucket.** Les parties d'un envoi multipart partaient une par
  une : leurs allers-retours s'additionnaient et le débit disponible n'était jamais utilisé. Elles
  partent maintenant **4 en vol** (`S3_UPLOAD_CONCURRENCY`), les ETags restant ordonnés par numéro
  de partie et non par ordre d'arrivée (`uploadPartsBounded`, 6 tests). Un gros contenu déjà en
  mémoire passe lui aussi par le multipart, et le découpage ne recopie plus rien (il était
  quadratique sur un bloc unique). **Migration de l'historique** : le script traite désormais aussi
  les blobs stockés **en tranches** (`FileBlobChunk`) — c'est-à-dire les plus gros, jusqu'ici
  ignorés — en flux, et un blob illisible n'arrête plus les autres.

- **Budget : l'écran ne tombe plus** (`Digest 3300873632`). La vue consolidée bornait la période
  avec une date « infinie » (`new Date(8.64e15)`) que Prisma refuse de convertir — l'année à cinq
  chiffres faisait échouer toute la page. Les bornes sont devenues **facultatives** : sans période,
  le filtre de date n'est plus émis du tout (`generalMeansConsumption`, 7 tests de non-régression).

- **Ad & Pro : une seule demande, une seule liste** (`/ad-pro`). Cinq écrans posaient la même
  question — « je veux engager une dépense de promotion ». « Nouvelle demande » demande maintenant
  ce qu'on veut FAIRE (« envoyer un praticien à un congrès à l'étranger »), pas quel module. La
  liste unifiée relit les cinq modèles et ramène quinze statuts internes à **cinq états lisibles**
  (`lib/ad-pro/unified.ts`, 11 tests) ; ce qui attend une décision passe devant. Le stockage n'est
  PAS fusionné : chaque nature garde son modèle, son écran et son circuit, et les droits restent
  les siens.

- **Drive : un explorateur de fichiers, pas une liste.** Volet de navigation à gauche, accès rapide
  (**Récents**, **Téléchargements** — ces derniers reconstitués depuis le journal d'audit, qui les
  trace déjà), colonne **Type** avec des libellés qu'on lit (« Dossier compressé », pas
  « application/zip »), tri par colonne avec les dossiers toujours en tête et l'ordre **naturel**
  (« Fichier 2 » avant « Fichier 10 »). `lib/drive/explorer.ts`, 16 tests.

- **Stockage objet S3-compatible → Supabase Storage.** Variables canoniques `S3_*` (anciennes
  `REG_S3_*` en repli), style chemin par défaut, aucun SDK propriétaire. **Gros fichiers** : le
  contenu est chiffré au fil de l'eau et envoyé **en plusieurs parties** (16 Mio) — le pic mémoire
  ne dépend plus de la taille du dossier. **Pas de repli silencieux** : un bucket qui refuse
  d'écrire fait échouer l'enregistrement plutôt que de gonfler Postgres à l'insu de tout le monde.
  Test de connexion PUT/GET/vérification/DELETE en Console d'Administration.

- **Entités étanches.** Ce que quelqu'un crée appartient à SON entité, et choisir une entité ne
  montre QUE celle-là — l'exception « le non-rattaché reste visible partout » est levée, après
  rattachement de l'historique depuis l'entité de son créateur (25 tables) et ajout d'un inventaire
  **« Sans entité »** réparable en Console d'Administration. Regulatory inchangé.

- **Regulatory : le verrou EST le pipeline.** « Pipeline » = les dossiers verrouillés (Super Admin
  seul), « À traiter » = ceux qu'il a ouverts — déverrouiller est l'acte qui met un dossier au
  travail — « Traitement terminé » inchangé. Un dossier abouti reste abouti.

- **Le stock du matériel promotionnel, tracé mouvement par mouvement** (`/promo-material/stock`).
  Sans registre, la seule réponse à « en reste-t-il ? » était « je crois ». La quantité **ne se
  saisit jamais** : on n'écrit que des mouvements (entrée, distribution, perte, correction
  d'inventaire) et le stock en est la somme — `lib/promo/stock.ts`, module pur, 18 tests. Le sens
  vient de la NATURE du mouvement, pas de la saisie (« combien ? », jamais « +600 ou −600 ») ;
  seule la correction accepte un signe. On ne sort pas ce qu'on n'a pas : la garde est recalculée
  côté serveur avant écriture, et le refus dit ce qui reste. Seuil d'alerte par article.

- **L'Annuaire devient un sous-module en format feuille** (`/medical/annuaire`), exportable et
  importable. L'import **ne demande pas notre format** : les colonnes sont reconnues sous les noms
  des vrais fichiers (« NOM ET PRENOM », « Wilaya », « N° Tél. »), et les valeurs avec elles
  (« Pr » = professeur, « cabinet » = libéral, « très haut » = 5) — `lib/medical/directory-sheet.ts`,
  module pur, 20 tests. Ce qui n'est pas compris est **dit** (colonnes non lues, lignes écartées).
  Un praticien déjà présent au même établissement est mis à jour, jamais dupliqué : le classeur
  exporté se réimporte tel quel, et c'est testé.

- **Validations : une demande = une demande.** Les validations **de pièce** se regroupent sous LEUR
  demande (`lib/validations/grouping.ts`, 15 tests) : quatre pièces soumises séparément ne font plus
  quatre demandes à l'écran. Le statut affiché est celui du TOUT — tant qu'une pièce attend, rien
  n'est tranché — avec le décompte en clair (« 3 pièces — 2 acceptées, 1 en attente »). La
  notification nomme la pièce (« Pièce acceptée — Facture n° 12 ») et dit ce qui reste à attendre.

- **La feuille d'accès de la Console d'Administration se déduit des droits réels.** Colonnes
  d'actions et modules « à lignes » ne sont plus écrits à la main : ils sortent de `PERMISSIONS` et
  de `defaultScope` (`lib/rbac-sheet.ts`, 12 tests). Fini la case « Valider » sur un module où plus
  personne ne valide — elle s'enregistrait sans rien ouvrir. Le serveur applique la même borne.

- **Budget : vue globale, moyens généraux branchés, BV imputés.** Le total de **toutes** les
  enveloppes visibles ouvre l'écran (le sélecteur d'enveloppe était un excellent moyen de ne jamais
  voir le budget de l'entreprise). Chaque **ticket** des moyens généraux, et chaque **article** d'un
  ticket, peut désigner sa case budgétaire — sans que l'acheteur ait accès au module Budget : il ne
  voit qu'une liste de destinations, bornée aux enveloppes couvrant les moyens généraux et
  revérifiée à l'écriture. La règle d'imputation est pure et testée (`lib/budget/imputation.ts`, 13
  tests) : un article classé compte pour son montant, le reste tombe dans la catégorie du ticket, et
  la somme des imputations **égale toujours** le montant payé. Rien n'est recopié : la page Budgets
  relit les dépenses réelles. Enfin, le règlement d'un ordre de dépense se rabat sur la première
  catégorie d'une **enveloppe qui couvre le module** (`lib/budget/auto-category.ts`, 9 tests) — créer
  l'enveloppe « Regulatory » et cocher la case suffit pour que les BV payés s'y imputent.

- **Regulatory : le tableau en plein écran.** Le plafond de 1400 px protège la lecture d'un texte,
  pas celle d'un tableau de quinze colonnes : il devient une variable CSS que cet écran, et lui
  seul, relève — mémorisée par navigateur, reposée en quittant la page.

- **Moyens généraux : corriger ou supprimer une dépense, et deux totaux qui mentaient.**
  Chaque dépense porte un crayon et une corbeille — une erreur se répare là où on la voit, et
  c'est le journal d'audit qui garde la trace, pas la ligne fausse. Modifier rouvre le **ticket**
  (articles, quantités, montants) et non le seul montant ; sur une caisse, le nouveau montant est
  reconfronté au fond **en excluant la dépense corrigée**, sans quoi son propre montant compterait
  deux fois. Supprimer emporte les lignes et les justificatifs. Deux corrections de fond au
  passage : le **consommé se calculait sur les 200 lignes affichées** (au 201ᵉ achat le budget
  s'allégeait tout seul — 20 000 DZD comptés au lieu de 63 000 sur un jeu de 250 dépenses), et
  **l'enveloppe des moyens généraux se voyait soustraire des dépenses d'une autre nature**, ce qui
  la faisait diverger de la page Budgets pour le même département. Les totaux viennent désormais
  d'un agrégat sur l'année entière, nature par nature.

- **Un cadenas Super Admin sur Regulatory, et des tickets de caisse à plusieurs articles.**
  Le portefeuille importé arrive **verrouillé** : `RegulatoryProduct.isLocked` est filtré dans
  `scopeRegulatory` — pas dans l'écran — donc un dossier verrouillé ne ressort ni par la recherche,
  ni par l'assistant IA, ni par le sélecteur de produits des stocks, ni par une URL directe (404),
  et les rares lectures hors portée reçoivent le même filtre. Seul le **Super Admin** voit ces
  dossiers, les ouvre un par un ou **tout d'un geste** ; le sens inverse en masse n'existe pas
  volontairement. Côté **moyens généraux**, l'assistante de direction tient le **catalogue
  d'articles** depuis son module (le même que celui du secrétariat — deux catalogues auraient rendu
  les consommations incomparables) et enregistre un **ticket de caisse portant plusieurs articles** :
  chaque ligne dit l'article, le nombre et le montant, et le **total de la dépense découle des
  lignes** au lieu d'être saisi à côté. Le libellé de chaque ligne est figé à l'achat, pour qu'un
  article renommé ne réécrive pas un ticket déjà classé.

- **Regulatory : le portefeuille « Sélection PF Produits » importé (69 dossiers) + la personne
  chargée du dossier au menu déroulant.** L'import passe par une **migration de données idempotente**
  générée depuis le classeur versionné (`data/selection-pf-produits.xlsx`) par des règles **pures et
  testées** (`lib/regulatory/sheet-import.ts`, 34 tests) : dosage cherché dans la forme **puis** dans
  le conditionnement, mesures du contenant écartées (« B 30 », « 1 tube 15 G »), associations « A + B »
  distinguées des alternatives « A Ou B », chiffres de marché conservés en commentaires. Nouveau champ
  `RegulatoryProduct.packaging` (**Conditionnement**) : à dosage et forme égaux, c'est lui qui distingue
  deux dossiers — il apparaît dans le tableau, la fiche et les deux formulaires. La colonne
  **« Chargé du dossier »** devient un **menu déroulant modifiable depuis le tableau**
  (`setRegulatoryResponsible`) : assignation = accès (rattachement aux participants, l'ancien
  responsable n'est jamais retiré), notification de la personne désignée, audit, et filtre
  « Non attribué » pour repérer d'un coup d'œil les dossiers sans porteur.

- **Module « Demandes à Regulatory » RETIRÉ.** Le module `REG_REQUESTS`, son entrée de menu, ses
  écrans (`/regulatory/requests`), ses actions, ses requêtes, ses helpers d'accès
  (`canCreateRegRequest` / `canAnswerRegRequests` / `canSeeRegRequests`) et sa carte de réglage
  en Administration (« Émetteurs autorisés ») sont supprimés. ⚠️ Les **données restent en base** :
  les modèles `RegulatoryRequest` / `RegulatoryRequestMessage` et la colonne
  `AppSetting.regRequestCreatorRoles` ne sont **pas** supprimés — effacer des demandes et leurs
  fils de discussion est irréversible, et se décide explicitement. L'entrée de journal qui décrit
  la livraison d'origine reste ci-dessous : un journal consigne ce qui s'est passé, il ne se
  réécrit pas.

- **Formations — demande individuelle à trois validateurs, sessions RH avec participants.**
  Chacun peut demander une formation ; elle monte **N+1 → RH → DG**, exactement comme un congé —
  et pour la même raison : trois questions se posent qu'une seule personne ne sait pas trancher.
  L'enchaînement est donc écrit **une** fois (`src/lib/approval-chain.ts`), le congé et la
  formation lui donnant leur vocabulaire. Le **devis n'est pas exigé à la soumission** (l'obtenir
  prend des semaines ; bloquer dessus empêche d'en parler). Les **RH organisent** aussi des
  formations : elles partent directement au DG, puisque les RH SONT l'étape RH. Participants
  **convoqués** (comptés présents d'emblée — leur demander d'accepter viderait le mot de son sens)
  ou **volontaires** (qui répondent, et c'est leur réponse qui donne le nombre de couverts). Le DG
  accorde un **montant qui peut différer du demandé**. Les postes (salle, traiteur, intervenant)
  sont des `AdProItem` — même modèle, mêmes validations une par une. Fichiers :
  `src/lib/training.ts` (+ `.test.ts`), `approval-chain.ts`, `actions/training-actions.ts`,
  `src/app/(app)/formations/`. Migration `20260810220000_trainings`.
- **Moyens généraux — les RH pilotent, l'assistante impute à la clôture d'une demande.** Chaque
  département a SES moyens généraux : les **ressources humaines** (droit `RH:UPDATE`) obtiennent
  donc le module sur **tous** les départements — dotation, rallonges, contrôle — avec un sélecteur
  de département ; l'assistante de direction reste sur le sien. Le pilotage ne pouvait pas se
  poser dans la matrice par rôle (« RH » est un droit de module, pas un rôle nommé) : il est
  accordé en **accès implicite** par `getAccess`.
  Surtout, le chaînon manquant est posé : **à « Fin de la demande »**, un achat traité au bureau
  du secrétariat s'impute au budget de moyens généraux d'un département — le sien ou **celui du
  demandeur**, pré-sélectionné, puisque c'est lui qui consomme. Terminer un achat sans dire qui le
  paie laissait le budget intact pendant que l'argent était sorti. L'imputation est **exigée**
  pour un achat, sauf s'il vient d'**Ad & Pro** (déjà porté par le budget de l'opération : l'imputer
  une seconde fois le compterait deux fois) ou s'il est déjà imputé. La facture versée à la demande
  sert de justificatif — inutile de la rescanner.
- **Moyens généraux — module autonome, accessible à celle qui achète.** Il était rangé en onglet
  de « Budgets » : invisible pour l'assistante de direction, qui n'a pas ce module — la seule
  personne qui s'en sert tous les jours. `GENERAL_MEANS` devient un **module de la matrice RBAC**
  avec son entrée de menu propre, ouvert à l'assistante (voir, saisir, téléverser), à
  l'administration et aux finances. La **saisie d'un achat** n'exige plus de droit budgétaire :
  le module suffit, **borné à son propre département** (celui qu'elle dirige, celui dont elle
  tient la caisse, ou celui de sa fiche employé). Un bouton **« Ajouter une dépense »** couvre
  enfin les achats réglés **autrement que par la caisse** (virement, carte, facture payée par les
  Finances), qui n'avaient aucun endroit où être saisis — le budget restait donc faux. Montant +
  **scan de la facture ou du bon de paiement obligatoire**, déduction du budget, avertissement
  quand le montant dépasse le restant.
- **Moyens généraux — un module, et une caisse d'avance qui dit ce qu'il reste.**
  Le budget vivait dans un tableau, les achats dans les demandes administratives, l'argent liquide
  nulle part. Un écran répond aux trois questions : l'enveloppe (ai-je le droit ?), la caisse
  (ai-je de quoi payer ?), les dépenses avec leurs pièces (où est passé l'argent ?). Trois gestes,
  trois responsabilités : l'administration **remet**, la détentrice **confirme la réception** (le
  solde reste à zéro avant — afficher un fonds qu'on n'a pas conduit à engager ce qu'on ne peut
  payer), puis **dépense** avec justificatif scanné, sans exception. Refus chiffré au-delà du
  fonds, alerte à 20 %, rallonge qui **s'ajoute** au fonds du mois plutôt que d'ouvrir une
  seconde caisse. Chaque dépense est déduite de la caisse **et** imputée au budget : même argent,
  deux points de vue. Fichiers : `src/lib/petty-cash.ts` (+ `.test.ts`),
  `queries/general-means.ts`, `actions/petty-cash-actions.ts`, `src/app/(app)/moyens-generaux/`.
  Migration `20260810210000_petty_cash`.
- **Budgets par département — trois natures, un directeur, des dotations validées.**
  Au **moyens généraux** et à la **masse salariale** s'ajoute le **budget métier** (Ad & Pro au
  marketing, paiement des BV au Regulatory). Le **directeur** tient les deux premiers de SON
  département — jamais la masse salariale, réservée aux RH ; cette qualité se lit dans
  l'organigramme, aucun rôle ne pouvant la porter. **Personne ne s'accorde son propre budget** :
  une dotation ou une rallonge se demande, l'administration tranche, et le montant accordé
  **s'ajoute**. Les dépenses imputées (facture obligatoire) alimentent enfin une colonne de
  **consommation** là où il n'y avait qu'un alloué. Migration
  `20260810200000_department_budget_activity`.
- **Validations — la vue Direction devient un poste de pilotage.** Tri par urgence (en retard →
  échéance proche → sans décision depuis 7 j → reste ; à urgence égale, la plus vieille devant),
  colonne **« chez qui ça bloque »** avec le temps d'attente, **relance en un clic** (notification
  + push, tracée), compteurs cliquables servant de filtres, recherche portant aussi sur le
  validateur bloquant. Fichiers : `src/lib/validation-supervision.ts` (+ `.test.ts`),
  `src/app/(app)/validations/supervision-board.tsx`.
- **Organigramme — suit l'entité sélectionnée, s'exporte en carte PDF paysage.** La portée
  d'entité est validée contre les droits et laisse passer les personnes non rattachées. L'export
  construit un **document autonome** (SVG des boîtes et des liens) dont `@page { size: A4
  landscape }` impose l'orientation, mis à l'échelle de la feuille — sans bibliothèque embarquée.
  Fichiers : `src/lib/org-chart-print.ts` (+ `.test.ts`).
- **Ad & Pro — modifier et retirer un poste, même après le bon de commande.** Un bouton
  « Modifier » ouvre nature, libellé, fournisseur, précisions, estimation (ces champs décrivent la
  dépense, ils ne l'engagent pas). Restent verrouillés, pour une raison nommée à l'écran, le
  montant affecté et la nature de budget une fois la Direction prononcée. Le retrait suit trois
  règles : libre sans ordre, réservé à la Direction ensuite **avec annulation de l'ordre**, jamais
  quand il est réglé.
- **Congés — une seule demande, trois validateurs.** « Mon espace » et « Mon dossier RH »
  écrivaient dans deux tables : selon la porte, la demande échappait à la file de validation, aux
  « absents aujourd'hui » et au solde. Passage unique (`src/lib/hr/leave-core.ts`), circuit
  **N+1 → RH → DG**, file résolue **par personne** (un responsable d'équipe n'a pas le module RH :
  sa file vit dans « Mon espace »), solde débité **une seule fois**, au bout.
- **Assistant IA — les pouvoirs suivent les droits.** Quatre lectures chiffrées (budget, finances,
  RH, file de décisions) ouvertes par la **matrice d'accès**, jamais par un rôle en dur : ouvrir
  les Budgets à un compte lui donne l'outil dans la seconde. Le droit est revérifié à l'exécution.
  Fichiers : `src/lib/assistant/power-tools.ts` (+ `.test.ts`).

- **Demandes d'état de stocks par HÔPITAUX ciblés, Explorateur produits au menu, colonnes
  Regulatory masquables.** (1) La « Demande d'état de stock » (`/stocks`, Direction/Super Admin)
  cible désormais **un ou plusieurs hôpitaux précis** (pastilles à cocher, validés en base) en
  plus de la personne choisie : la tâche assignée et la notification citent les NOMS des
  hôpitaux, et la personne renseigne l'état de chacun dans l'onglet « Stock hôpitaux » (réponse
  native du module). Sans hôpital coché, la demande générale reste possible. (2) L'**Explorateur
  produits** (Intelligence Marché) garde sa place dans Business Development ET gagne une **entrée
  directe dans le menu des modules** (même garde `BUSINESS_DEVELOPMENT`). (3) Le tableau
  Regulatory permet de **masquer/démasquer chaque colonne** (bouton « Colonnes », préférence
  mémorisée par navigateur, au moins une colonne toujours visible ; masquer une colonne retire
  aussi son filtre) — les cellules sont désormais pilotées par la définition des colonnes.

- **Agent de dossier 300 s + pièces entières, arbitrage IA des faits en conflit, et Regulatory
  remis d'aplomb (colonnes + étapes).** (1) L'agent du chat travaille désormais **sans être
  pressé** : 300 s par tentative, pièces du tour jusqu'à **100 000 caractères chacune** (une
  lettre ANPP entière), mémoire du fil **6 pièces × 40 000**, réponse 4096 jetons, garde globale
  ~420 000 caractères (fenêtre du modèle protégée — au-delà, la pièce excédentaire est signalée
  plutôt que tronquée en silence). Si la **connexion du navigateur lâche** pendant un gros tour,
  le serveur TERMINE et écrit la réponse dans le fil persistant ; le panneau la **récupère par
  sondage** (6 s × 6 min) — plus de réponse perdue. (2) **Arbitrage CONTEXTUEL des faits**
  (`twin/arbitrate-facts.ts`) : quand deux valeurs se disputent un fait (scores serrés — cas
  réel : « 600 mg and 300 mg » du comparateur Epzicom vs la trithérapie du dossier), les regex ne
  peuvent plus rien — un appel IA borné (ÉCO) lit les EXTRAITS et choisit la valeur qui décrit
  LE PRODUIT DU DOSSIER (jamais un comparateur d'étude, un produit de référence cité ou une
  posologie) ; le choix DOIT être un candidat existant, l'abstention laisse le déterministe
  décider, les faits déjà tranchés par un humain ne sont jamais soumis. (3) Liste des produits
  Regulatory : les TITRES de colonnes étaient inversés pour le métier — désormais **« Statut » =
  importation / packaging / full process** et **« Niveau de process » = pré-soumission / déposé /
  … ** (liste, fiche produit et éditeur alignés ; les contenus n'ont pas bougé). (4) **Poser un
  niveau de process COMPTE les étapes** : « Déposé » marque FAIT les étapes ANPP 1 à 12 (dépôt),
  « Réponse aux réserves » 1 à 15, « Décision obtenue » tout — jamais les étapes d'APRÈS le
  jalon, jamais de dé-cochage, étapes bloquées intouchées (`completeStepsThrough`, tracé dans
  l'audit avec le nombre d'étapes comptées).

- **OCR surpuissant : secours VISION quand le moteur d'OCR cale — plus de « scan illisible » sans
  avoir tout tenté.** Trois étages désormais : Mistral OCR (ou Tesseract), puis pour les pages
  restées **vides ou douteuses**, re-rastérisation et **transcription par le modèle multimodal**
  (`ocr/vision-ocr.ts` — recopie fidèle, tableaux, manuscrit ; lots de 4 pages ; plafond
  `REG_OCR_AI_PAGES` ; **tracé au budget du dossier** via `trackedLuna` + cache : une page scannée
  ne se paie qu'une fois ; fusion **sans régression** — une transcription ne remplace une page que
  si elle apporte plus de texte). Branché sur le **pipeline CTD**, le **chat de dossier** (le seuil
  d'illisibilité d'une pièce tombe à ~10 caractères : seul le VIDE est écarté, motif exact remonté)
  et l'**ingestion des lettres de réserves**. Tesseract lit mieux aussi : **agrandissement ×2 des
  petits scans** (<1400 px) + netteté au pré-traitement.

- **Bureau du secrétariat : le validateur peut être soi-même (fin du « au moins un validateur »
  fantôme), retrait d'une validation, message d'accompagnement, et l'approbation DÉCLENCHE les
  Finances.** (1) Le bug : `createDirectValidation` écartait silencieusement le demandeur de la
  liste des validateurs — se choisir soi-même vidait la liste et l'écran réclamait « au moins un
  validateur ». La validation de PIÈCE est un avis, pas un circuit hiérarchique : `allowSelf` la
  permet désormais (l'auto-validation apparaît normalement dans /validations). (2) Une validation
  **EN ATTENTE se retire** (`cancelAttachmentValidation` — statut ANNULÉ tracé, validateurs
  prévenus, la pièce redevient soumissible). (3) À la soumission : **message aux validateurs**
  (textarea, affiché au bureau central), **montant (DZD)** et **catégorie de finance** facultatifs
  (portés par `ValidationRequest.amount/category` — pas de migration). (4) **Pièce approuvée +
  montant ⇒ ordre de dépense AUTOMATIQUE** vers les Finances (`createExpenseOrder` dans
  `decideValidation` : notifie le responsable Finances, visible `/finances/paiements-a-faire`,
  catégorie choisie sinon « Autre », rattaché à la demande d'origine — au règlement, la dépense
  rejoint le budget par le circuit habituel des ordres). Sans montant : l'approbation reste un
  simple avis.

- **Le chat de dossier devient une MESSAGERIE : le fil persiste, l'agent n'oublie plus les pièces,
  une pièce illisible n'échoue plus le message.** (1) Le fil « Discuter avec ce dossier » est
  désormais **persisté côté serveur** (`RegulatoryDossierChatMessage`, un fil par dossier ×
  utilisateur) : on quitte l'app, on revient — la discussion reprend où elle s'était arrêtée
  (rechargée au montage du panneau, bouton « Nouvelle discussion » pour repartir de zéro).
  (2) **Mémoire des pièces** : chaque pièce soumise garde son **texte extrait en base**, et les
  tours suivants la **re-présentent à l'agent** (dédupliquées par nom — la plus récente gagne — 4
  max, budget réduit ; l'historique n'est PLUS transporté par le client). C'est ce qui corrige le
  « vas-y » après l'envoi d'une lettre : l'agent la voyait au tour 1 puis la perdait, et
  redemandait la pièce. (3) **Dégradation par pièce** : une pièce qui résiste à l'extraction/OCR
  est marquée ILLISIBLE **avec son motif exact** (l'erreur n'est plus avalée) et le message
  CONTINUE — l'agent le signale et répond sur le lisible, au lieu de l'ancien échec global
  « impossible d'en discuter ». Écritures assainies (`sanitizeForModel` — le JSONB de Postgres refuse le NUL brut produit par l'OCR), panne d'écriture du fil = réponse quand même (la messagerie est un confort, pas un
  point de défaillance). Code : `knowledge/dossier-thread.ts` (+ tests round-trip).

- **Bureau du secrétariat : chaque pièce jointe se soumet à validation — et le chat de dossier
  devient un AGENT.** (1) Sur une demande du secrétariat, **chaque pièce jointe** peut être
  soumise **à tout moment** à validation, **à part**, vers **une ou plusieurs personnes** (saisies
  et notifiées EN PARALLÈLE, décision au bureau central `/validations`). Être validateur d'une
  pièce **ouvre l'accès à toute la demande** — on ne juge pas une facture hors de son contexte.
  Garde-fou : la validation d'une pièce ne pilote PAS le cycle de vie de la demande (valider une
  facture ne ressuscite pas une demande close). Modèle : `ValidationRequest.documentId`.
  (2) **« Discuter avec ce dossier » devient un agent OUTILLÉ** : il décide de ses recherches —
  pièces réelles du dossier, **corpus réglementaire opposable** (ANPP/ICH/UE), **bibliothèque des
  réserves passées**, état de l'analyse — en plusieurs tours si la question l'exige, sur le palier
  QUALITÉ. On peut lui **soumettre des pièces** (lettre de réserves, certificat — scans océrisés,
  type de réserve reconnu) et lui demander des **livrables : il génère des PDF propres**
  (générateur maison sans dépendance — Helvetica, césure aux largeurs réelles, pagination),
  téléchargeables dans la conversation et tracés comme documents générés. Les gardes ne bougent
  pas : contenu = donnée non fiable, citations obligatoires, jamais de verdict — l'humain décide.
  Au passage : pdf-parse recevait un `Buffer` Node et refusait des PDF valides (« bad XRef
  entry ») — nos extracteurs passent désormais un `Uint8Array`.

- **Les trois types de réserves ANPP entrent dans le système — calibré sur une lettre réelle.**
  L'ANPP émet trois familles de réserves : **technico-réglementaires** (module 1),
  **contrôle qualité** (rares — les lots contrôlés sur place, pas le dossier) et **évaluation
  scientifique** (les plus nombreuses et massives : modules 3 et 5, fond, forme, détails). Le
  module Réserves les connaît désormais : chaque lettre déposée est **typée automatiquement**
  (comptage de signaux sur le texte — jamais un type affirmé sur un mot isolé), badge à l'écran.
  Et parce que les lettres d'évaluation scientifique sont STRUCTURÉES (sujets « ABACAVIR
  SULFATE »/« Produit fini », en-têtes de section « 3.2.S.4.3. Validation… »), la décomposition
  **porte désormais sur chaque point sa section CTD et son sujet** — sans quoi « compléter les
  données de stabilité » ne dit pas de quelle substance il s'agit, et le point est inexploitable.
  Codes recollés malgré les espaces d'OCR (« 3.2. S.3 » → « 3.2.S.3 »).
  Enfin, l'analyse et le simulateur sont **calibrés sur les exigences réellement observées**
  (lettre de 92 réserves sur une trithérapie) : spectres avec standard de référence,
  polymorphisme/isomérie, parties DMF citées mais absentes, génotoxicité + nitrosamines,
  LOD/LOQ et chromatogrammes de spécificité, validation des solvants résiduels COMPLÈTE
  (l'exactitude seule ne suffit jamais), stabilité couvrant TOUTE la durée revendiquée,
  cohérence chiffrée des impuretés entre sections, justification des différences de composition.

- **« Serveur injoignable ou trop lent (30 s) » à l'ouverture d'un téléversement — trois causes,
  toutes corrigées.** Le message ne mentait pas : la requête d'ouverture n'obtenait vraiment rien
  du serveur en 30 s. Ce qui l'affamait :
  - **Trois connexions à la base pour toute l'application.** Prisma dimensionne son pool à
    `CPUs × 2 + 1`. Dès qu'une analyse CTD tournait, ces trois connexions étaient prises et toute
    autre requête attendait son tour. Le pool passe à **12 par défaut** — sans variable à poser
    côté hébergeur, et sans risque : Postgres en accepte une centaine. (Défaut appliqué en
    production seulement : un pool se compte par processus, et les tests tournent en parallèle.)
  - **Autant de passages d'analyse que d'onglets ouverts.** Le planificateur avait bien son verrou,
    mais la route « analyser maintenant » appelait le runner directement, sans passer par lui.
    Chaque fin de téléversement, chaque rafraîchissement lançait donc son propre passage de deux
    minutes, prenant jusqu'à vingt jobs de front. Désormais **un seul passage à la fois** dans le
    processus, et la route **répond tout de suite** au lieu de tenir une requête HTTP ouverte
    pendant deux minutes pour une réponse que personne ne lit.
  - **Le ménage de la tentative précédente, payé d'avance.** L'ouverture de session supprimait les
    parties des envois abandonnés — des lignes de plusieurs Mo, parfois des centaines — avant de
    démarrer. Plus l'utilisateur réessayait, plus il y avait à nettoyer. L'abandon (ce qui libère
    la limite d'envois simultanés) reste immédiat ; les octets partent en fond, par paquets, avec
    un filet côté planificateur si un redéploiement interrompt le ménage.
  Et parce qu'un serveur occupé restera toujours possible, **l'ouverture de session réessaie** —
  c'était la seule étape de l'envoi qui n'avait aucune reprise, là où toutes les autres en ont
  depuis toujours. Quatre tentatives, attente croissante ; un refus motivé (quota, droits, fichier
  non-ZIP) s'affiche toujours immédiatement au lieu d'être confondu avec une lenteur.

- **Téléversement CTD deux fois plus rapide — en mesurant au lieu de supposer.** Trois corrections,
  toutes appuyées sur des mesures reproductibles (`scripts/bench/`) :
  - **L'archive originale quitte le chemin critique.** La conserver coûtait ~10 s par 60 Mo, soit
    **plus de la moitié** de la finalisation (et ~2 min pour 800 Mo). Or personne ne l'attend :
    elle sert à la traçabilité et au téléchargement, jamais à l'analyse, qui travaille sur les
    fichiers déjà stockés. L'ingestion rend donc la main dès que la version existe et l'archive
    rejoint la base **en fond**, écrite en flux depuis le disque (mémoire bornée à une tranche au
    lieu de l'archive entière) et **une à la fois** pour ne jamais monopoliser le pool de connexions.
    L'empreinte SHA-256, elle, est enregistrée **tout de suite** : la traçabilité ne dépend jamais
    du fond. Finalisation d'un dossier de 60 Mo : **16,5 s → 3,7 s**.
  - **Parties de 16 Mo → retour à 4 Mo : grossir les parties RALENTISSAIT.** Le pari « moins
    d'allers-retours = plus rapide » supposait que le coût dominant soit la poignée de main. C'est
    l'écriture des octets : Postgres plafonne à ~11 Mo/s et écrit d'autant moins vite qu'on lui
    présente une valeur `bytea` volumineuse d'un seul tenant. Mesuré à 8 envois parallèles sur le
    même ZIP de 60 Mo — 1 Mo : 8,2 s · 4 Mo : 9,0 s · 8 Mo : 10,8 s · **16 Mo : 16,3 s**. Sur un lien
    mobile, une partie de 16 Mo dépassait en plus le délai de garde de 90 s du navigateur : elle
    était renvoyée, et c'est ce qui faisait **reculer la barre de progression**. Le parallélisme,
    lui, paie vraiment (9,6 s à un seul envoi contre 4,3 s à quatre) — il est conservé.
  - **La barre de progression ne recule plus jamais.** Elle affiche le point le plus avancé atteint :
    une partie rejouée marque une pause, puis repart. Reculer laissait croire que le travail était
    perdu alors qu'il était simplement refait.
  Au passage, la suite de tests elle-même était en panne silencieuse : deux fichiers ne se
  **chargeaient** pas (résolution de `next/server` par next-auth), leurs tests ne s'exécutaient donc
  pas sans que le total le signale. Corrigé dans `vitest.config.ts` — 133 fichiers, **950 tests**.

- **L'analyse cesse d'attendre entre deux lots.** Le planificateur ne se déclenche qu'une fois par
  minute, or plusieurs jobs se re-mettent en file pour reprendre où ils en étaient : un dossier de
  262 fichiers avançait par paliers d'un lot **toutes les minutes** — un quart d'heure d'attente
  pure, sans que rien ne calcule. Un passage travaille désormais **tant qu'il reste du travail**,
  dans une enveloppe de temps bornée (`REG_JOBS_BUDGET_MS`, 2 min), en cédant la main entre chaque
  unité. Au passage : lot d'extraction 20 → **40** documents, parts d'analyse envoyées en parallèle
  au modèle 4 → **8** (c'est de l'attente réseau : doubler divise le temps sans coûter un jeton),
  et parties envoyées en parallèle 3 → **8**.
  ⚠️ Le gain suivant, bien plus grand, n'est pas dans le code : **activer le stockage objet**
  (`REG_S3_*`) fait envoyer l'archive DIRECTEMENT au bucket au lieu de la faire transiter par
  l'application puis par Postgres — diagnostic intégré : `/api/regulatory/intelligence/upload/diagnose`.

- **L'écran d'analyse se recentre sur sa raison d'être.** La **génération documentaire à partir
  de modèles à trous** (note de pré-soumission, formulaire d'enregistrement, demandes de
  modification/renouvellement/transfert) est retirée : elle produisait des coquilles à remplir à
  la main — pas du travail fait — et occupait une place que le pharmacien lit à chaque passage. Le
  parcours tient désormais en une ligne : **déposer le dossier → l'analyse le passe au crible
  (fond ET forme) → constats et réserves probables → tout lever → déposer à l'ANPP → charger les
  réserves reçues → répondre**. Les deux seuls documents qui restent produits sont ceux que le
  service ne peut pas obtenir autrement : le **rapport de constats** et la **lettre de réponse aux
  réserves** ; ils apparaissent dans une simple liste de téléchargement.

- **Les dossiers DÉJÀ en base sont rattrapés automatiquement.** Changer un défaut ne vaut que pour
  les nouvelles analyses : les dossiers déjà « En revue » seraient restés avec une revue de fond
  différée — voire jamais livrée (lot expiré, clé changée). Le planificateur repère désormais deux
  situations et les répare seul : une version dont la revue de fond **n'a rien livré** est relancée
  en **analyse immédiate**, et un pipeline **arrêté en chemin** (plus aucune tâche en file, aucun
  bilan) repart. Garde-fous : **une seule fois par version** (marqueur dans le journal d'audit —
  jamais de boucle payante), jamais par-dessus un travail en cours ni un lot encore en vol
  (< 26 h), deux versions par passage au plus, plafond budgétaire toujours actif, coupure par
  `REG_AI_CATCHUP=0`. → [référence](#4-coût--voir-réutiliser-plafonner)

- **La revue de fond passe en IMMÉDIAT par défaut.** Le différé (moitié prix, sous 24 h) était le
  défaut : un dossier affiché « en revue » pouvait donc l'être **sans ses constats les plus
  exigeants**, encore en attente chez le fournisseur — exactement l'impression de « dossier presque
  parfait » qu'on ne veut pas donner. On paie désormais plein tarif et on voit tout de suite ; le
  différé reste d'un clic (bouton « Réanalyser à moitié prix ») pour les grosses réanalyses lancées
  le soir. Aucun réglage d'hébergement : le défaut est dans le code.

- **« Analyse en cours » n'est plus une boîte noire.** Une carte vivante montre l'analyse du
  début à la fin : étape courante (réception → lecture des fichiers → OCR → données → conformité
  → revue de fond IA), pourcentage honnête, **temps restant estimé** au débit réel de lecture, et
  une barre qui balaie tant que ça avance. Elle s'actualise seule et — détail voulu — la regarder
  suffit à faire avancer l'analyse (chaque rafraîchissement réveille le planificateur). Sur la
  liste, le badge « Analyse en cours » affiche désormais le %. Au passage : le **Simulateur
  d'examen** ne renvoie plus « Sortie non conforme au schéma » — son schéma Zod rigide rejetait
  toute la simulation pour un détail (verdict en minuscules, question trop longue, 11ᵉ
  perspective) ; la sortie est désormais mise en forme avec tolérance.

- **Entraînement de l'IA : l'analyseur apprend de NOS produits passés.** Nouveau module (Super
  Admin, onglet « Entraînement IA ») : une étude de cas = un produit déjà déposé + son issue
  réelle à l'ANPP + la leçon retenue, et les pièces de son dossier déposées comme au corpus
  (l'envoi démarre tout seul). À chaque analyse, les 3 meilleurs précédents de la section sont
  injectés dans le prompt — issues instructives d'abord — pour calibrer la sévérité et anticiper
  les réserves ; un précédent ne fonde jamais une règle (frontière testée). Le corpus, lui, est
  devenu « déposer = utilisé » (fin du purgatoire d'activation, migration de rattrapage incluse)
  et réservé à l'administrateur. → [référence](#10-entraînement-de-lia--lécole-de-lanalyseur-super-admin)

- **Analyseur CTD « god mode » : la page devient une preuve, l'outil insiste tout seul, et les
  livrables sortent en un clic.** Chaque constat connaît désormais sa page **exacte** : carte des
  pages construite à l'extraction (native et OCR), offsets réels par part d'analyse, et surtout
  **ancrage de la citation** — l'extrait cité est recherché dans le texte, la page retrouvée prime
  l'estimation du modèle, une preuve introuvable rend `null` plutôt qu'une page inventée. À
  l'écran, la page est un **lien qui ouvre le PDF au bon endroit**, et les constats sont redessinés
  pour le pharmacien (gravité d'abord, compteurs, citation en exergue, badge DÉFENDABLE). Une
  section critique déclenche **automatiquement** les agents spécialistes concernés (max 4, jamais
  deux fois, débrayable). Le corpus devient **bilingue de fait** : recherche hybride plein-texte ∪
  embeddings — « durée de conservation » trouve enfin « shelf life ». Et quatre livrables : rapport
  de constats .docx, lettre de réponse aux réserves .docx (verbatim + réponses, jamais
  d'invention), **verdict GO/NO-GO** en tête de dossier avec réserves les plus probables, contrôle
  **notice en arabe** (décret n° 92-286, texte natif seulement), constat → **tâche** en un clic.
  → [référence](#9-pages-exactes-escalade-sémantique-livrables--god-mode-)

- **Analyseur CTD : couverture intégrale, examen visuel, coût enfin réel.** Quatre plafonds
  silencieux écartaient du contenu sans que rien ne distingue « analysé » de « analysé à 8 % » :
  120 parts d'analyse, 25 pages d'OCR, 60 pages de vision, 1 Go par fichier. Tous levés — la
  rastérisation passe **en flux** (une page vit à la fois), donc le nombre de pages ne compte
  plus. Le module de lecture des figures, qui n'était **appelé par personne**, est branché et
  porte en plus un **contrôle de forme** : capture d'écran, photo d'écran, scan illisible,
  filigrane « brouillon », signature absente — des défauts qu'aucune analyse de texte ne peut
  voir, puisque l'OCR d'une capture d'écran rend un texte impeccable. Et surtout : la revue
  passait par un modèle **non tracé**, si bien que la carte de coût montrait tout sauf l'analyse
  et que le plafond budgétaire ne plafonnait rien. Corrigé — et l'analyse part désormais en
  **différé à moitié prix** par défaut, en autant de lots que nécessaire pour lire la version
  entière. → [référence](#analyseur-ctd--réserves-anpp-corpus-et-coût)

- **Le cloisonnement par entité devient réel.** « Si je mets la vue Adventum, je veux voir que Adventum » n'était
  vrai que de Regulatory, des ventes, de la logistique, de la promotion médicale et des RH. Le **budget**,
  l'**Ad & Pro**, les **finances** et les **demandes** n'avaient aucune entité : basculer le sélecteur laissait voir
  les demandes d'une autre société. Le sélecteur n'était pas un cloisonnement, c'était une décoration. **Dix tables**
  reçoivent une entité ; les **RH n'en reçoivent pas**, délibérément — congés, paie et avances pendent d'un employé
  qui porte déjà la sienne. Le rattachement rétroactif **ne devine rien** (il se déduit du demandeur, et d'ailleurs
  de la **demande source** pour un ordre de dépense, qui est plus fiable). Un enregistrement **non rattaché reste
  visible partout** : le filtrer strictement le rendrait invisible depuis toutes les vues d'un salarié mono-entité,
  ce qui serait de la perte de travail, pas du cloisonnement. Et **moins de deux entités ⇒ aucun filtre**.
  → [référence](#dimension-multi-entités-sociétés-du-groupe)

- **Les accès aux budgets départementaux se règlent.** Le socle par rôle valait partout à la fois ; le Super Admin
  peut désormais ouvrir **département par département** (plus une règle générale), en distinguant **qui voit**, **qui
  édite le fonctionnement** et **qui édite les employés** — trois populations différentes. Les autorisations
  **s'ajoutent** et ne retirent jamais rien : poser la première ne doit pas priver les RH du budget des employés par
  effet de bord. → [référence](#budget-par-département--deux-natures-deux-responsables)

- **Chaque département a son budget — réglé par deux personnes différentes.** Le fonctionnement (**hors employés**)
  par l'**administrateur** ; les **employés et le recrutement** par les **ressources humaines**. Comme les deux
  responsables n'écrivent jamais la même ligne, l'un ne peut pas écraser l'autre. Les deux colonnes sont **côte à
  côte** — une case non modifiable est affichée **en lecture**, pas masquée : c'est la seule façon de voir ce que
  coûte réellement un département. La **masse salariale réelle** est calculée depuis la paie, jamais saisie.
  → [référence](#budget-par-département--deux-natures-deux-responsables)

- **On peut enfin corriger une demande Ad & Pro.** Il fallait supprimer et recommencer, en perdant la référence,
  les pièces jointes, les postes et l'avancement du circuit. Deux règles : **ce qui a fondé une décision ne se
  réécrit pas** (après décision, seule la Direction — et l'audit le note « APRÈS DÉCISION »), et **les champs de
  décision ne sont jamais modifiables ici** — d'où une liste blanche dont le formulaire ET la requête sont dérivés.
  Au passage, le chef de produit, le National Sales et la Direction peuvent **joindre un fichier à leur avis** ;
  les pièces sont contrôlées **avant** que le circuit n'avance, pour ne pas laisser une décision prise et sa
  justification perdue. → [référence](#ad--pro--corriger-une-demande-joindre-un-fichier-à-un-avis)

- **L'assistant cherche là où les mots sont écrits, et sait modifier une fiche produit.** Trois échecs remontés
  d'une conversation réelle, trois causes distinctes : la recherche Regulatory ignorait la **classe thérapeutique**
  (d'où zéro résultat sur « oncologie » ou « biosimilaire ») et plafonnait à 12 lignes ; aucun outil d'écriture
  n'existait (« je ne dispose pas d'un outil pour modifier une fiche produit » — c'était vrai) ; et six
  allers-retours ne suffisaient pas à lister un portefeuille. Le nouvel outil décrit un lot par **filtre**, pas par
  liste devinée, et **rejoue ce filtre à l'exécution** pour que ce qui change soit exactement ce qui a été montré.
  → [référence](#assistant--recherche-regulatory-complète-et-écriture-sur-les-produits)

- **Les conversations de l'assistant passent en production.** Fils persistants, historique par date, nouvelle
  conversation, suppression, droit à l'oubli : tout existait mais restait au stade **TEST**, donc invisible hors
  comptes de test. Les échanges, eux, étaient **déjà enregistrés** — la promotion rend visible un historique qui
  existait. Retour arrière immédiat depuis `/admin/versions`.
  → [référence](#assistant--mémoire-personnelle-cloisonnée-par-construction)

- **Force de vente : l'affectation devient un périmètre.** La matrice KAM × produit × cycle
  existait déjà dans « Prévisions & Force de vente » — mais **elle ne pilotait rien** : personne
  ne voyait « sa » gamme, et les formulaires proposaient tout le catalogue à tout le monde. Le
  portefeuille devient lisible depuis l'espace personnel (**gamme ville / hôpital**, produits et
  priorité P1/P2/P3), et sert de base au filtrage des formulaires. Un **superviseur** voit les
  siens **et** ceux de son équipe, sans confondre les deux. Quand le cycle en cours n'est pas
  encore arrêté, on **reporte le dernier connu en le disant** : sans report un délégué serait à
  vide le 1er du mois, sans le dire il croirait son portefeuille reconduit. Le paramétrage reste
  hors RH, à dessein — porter tel produit relève du business et change au fil des cycles.
  → [référence](#force-de-vente--gamme-et-produits-attribués)

- **Prise en charge : une ligne par personne.** Le module ne traite pas d'un congrès — il traite
  de **personnes** qu'on emmène quelque part. « Congrès nationaux/internationaux » devient donc
  **« Prises en charge Nationales/Internationales »**, et les participants cessent d'être un
  tableau JSON. Chacun porte désormais **l'avis du demandeur** (favorable · défavorable · pas
  d'avis), **la décision de la Direction prise personne par personne** — on en accorde une et on
  en écarte une autre sans refuser l'ensemble — et **sa propre liste de besoins** : l'une a
  besoin d'un visa et pas l'autre, l'une loge à l'hôtel et l'autre chez elle. Deux natures de
  besoins, qui ne se traitent pas pareil : une **pièce à fournir** qu'on collecte, et un
  **élément à acheter** (hôtellerie, transport, billet, restauration, inscription) qui passe par
  un devis. Le secrétariat enregistre les devis **tels qu'ils arrivent** — une agence chiffre le
  groupe entier —, chacun accepté ou refusé d'un bloc, et l'acceptation émet l'ordre de dépense.
  Le passage aux Finances est **refusé tant que quelque chose manque, en disant quoi**.
  → [référence](#prise-en-charge--personnes-besoins-et-devis)

- **Ad & Pro : de quoi est fait le montant.** Un sponsoring est rarement un simple chèque, un
  congrès rarement une simple inscription — il y a l'appui à l'association, mais aussi le stand, le
  symposium, les brochures produites pour l'occasion. Les modules ne portaient qu'un **montant
  global** : on ne savait ni de quoi il était fait, ni à qui allait l'argent. **Sponsoring et
  congrès nationaux** portent désormais des **postes** (stand · symposium · matériel promotionnel ·
  prestation · déplacement · autre), chacun avec son bénéficiaire et **son ordre de
  dépense** — parce que le stand se paie à l'organisateur, le matériel à l'agence et l'appui à
  l'association. La Direction accorde toujours **une enveloppe globale** ; les postes s'en
  répartissent, et l'écran affiche en permanence ce qui reste à affecter — ou **ce qui dépasse**.
  Un poste ajouté après la décision est **autorisé et tracé** : il fait apparaître le dépassement
  au lieu de le laisser découvrir à la facture. Le matériel promotionnel n'est jamais recopié ici :
  le poste **renvoie** à un `PromoMaterial` qui suit son propre circuit (visa publicitaire,
  conformité, agence, BAT). Sur un congrès, `hasBooth` / `hasSymposium` n'étaient que des
  **intentions jamais chiffrées** : l'écran signale désormais un stand ou un symposium annoncé que
  personne n'a budgété. → [référence](#ad--pro--postes-et-ventilation-de-lenveloppe)
- **Mobile : fin des superpositions.** Trois défauts donnaient la même impression de modules qui se
  marchent dessus. La **barre d'onglets était au-dessus des modales** (`z-60` contre `z-50`) : un
  bouton de validation en bas d'une feuille était visible mais intouchable. Le **verrou de
  défilement ne verrouillait rien** — il figeait le `body`, alors que le conteneur qui défile est
  le `<main>` ; on ouvrait le menu, on faisait glisser le doigt, et c'était la page derrière qui
  bougeait. Et trois écrans pleine hauteur recopiaient des **hauteurs écrites au jugé**
  (`100dvh-3.5rem`, `100dvh-7.5rem`) qui ne correspondaient à aucune barre réelle — d'où le champ
  de saisie de l'assistant caché derrière la barre d'onglets. Échelle de superposition unifiée,
  verrou compté sur le vrai conteneur, hauteurs **mesurées** et non devinées.
  → [référence](#mobile--superposition-défilement-et-hauteurs)

- **Analyseur CTD : la mémoire des réserves ANPP, un corpus qui se tient à jour, et un coût qu'on
  voit.** Refonte de fond en six lots. **(1) Bibliothèque des réserves ANPP** — une lettre reçue
  (PDF, scan, courriel) est lue *page par page en image* quand l'OCR ne suffit pas, décomposée en
  points avec leur **verbatim**, et rangée avec sa preuve (fichier, page, extrait). On peut alors
  demander « cette réserve, l'avons-nous déjà eue ? » et récupérer **la réponse qui avait été
  acceptée**. **(2) Apprentissage borné** : quand un même reproche revient trois fois, le système
  *propose* une règle — elle reste **sans effet** jusqu'à validation humaine, et sa confiance
  plafonne à 0,9 (une observation ne devient jamais une loi). **(3) Constats défendables** : chaque
  constat porte la règle appliquée, la **page**, l'**extrait exact**, les valeurs qui se
  contredisent, la recommandation, et les précédents ANPP comparables — l'écran dit aussi ce qui
  **manque** pour qu'il soit opposable. **(4) Corpus** : 43 sources cataloguées (ANPP, ICH, OMS,
  EMA), téléchargement et **veille quotidienne des pages ANPP** qui alerte quand un texte bouge ;
  les sources sous licence sont *citées, jamais copiées*, et une version ingérée reste **DRAFT**
  tant qu'un humain ne l'active pas. **(5) Multimodal** : les graphiques, chromatogrammes et
  tableaux d'image sont lus comme images, pas devinés depuis un OCR approximatif. **(6) Coût
  maîtrisé** : chaque appel est tracé au fichier près, un résultat déjà calculé n'est jamais
  repayé, un **plafond par dossier** arrête la dépense *et le dit*, et une **analyse différée à
  moitié prix** (résultats sous 24 h) est proposée pour les réanalyses complètes — même consigne,
  même exigence, seule la facturation change.
  → [référence](#analyseur-ctd--réserves-anpp-corpus-et-coût)
- **Assistant : plein écran, conversations, et une réponse qui s'écrit.** Fini le long silence
  suivi d'un pavé : vrai **streaming** (le texte remonte au fil de sa génération), étapes de
  lecture annoncées en direct, rail des conversations regroupées par ancienneté, bouton
  **arrêter** qui conserve ce qui a déjà été écrit. Les garanties ne bougent pas : identité
  issue de la session, assistant désactivé en « Vue exacte », toute action d'écriture
  interceptée et confirmée. → [référence](#assistant--plein-écran-conversations-réponse-en-flux)
- **Regulatory : colonne « niveau de process », et la variation obtenue fait foi.** Importation
  → Secondary → Primary → Full Process. Le niveau est désormais **calculé** à la lecture plutôt
  que recopié à l'écriture : une modification de la fiche ne peut plus diverger de la décision
  de l'ANPP. La cellule dit d'où vient la valeur (« déclaré » / « variation obtenue ») et
  signale une variation en attente sans la compter comme acquise.
  → [référence](#regulatory--niveau-de-process-la-variation-obtenue-fait-foi)
- **RH : quatre écrans, et les questions du quotidien.** La page à sept sections devient
  *À traiter* / *Équipe* / *Congés* / *Départements*. Sur le fond, ce qui manquait vraiment :
  **qui est absent aujourd'hui**, qui part dans les 14 jours, les **fins de période d'essai** et
  de contrat côte à côte, les soldes de congés à risque, et une **recherche** dans l'annuaire.
  → [référence](#rh--quatre-écrans-et-les-questions-du-quotidien)
- **Mobile : l'écran respire.** Cartes de premier niveau **bord à bord**, tableaux qui défilent
  bord à bord, marges réduites, titres compacts — et les tiroirs deviennent des **feuilles qui
  montent du bas**, avec une poignée, comme dans une application native.
  → [référence](#mobile--lécran-respire)

- **Budgets : un module simple — on regarde, on travaille, on règle.** Tout tenait sur un écran : sélecteur
  d'enveloppe, budget total et son réglage, période, export, édition, quatre indicateurs, un graphique, les
  catégories et leurs boutons, un formulaire de saisie, deux listes de dépenses, quatre tiroirs. On ne pouvait pas
  **consulter** son budget sans traverser tout ce qui le **modifie**. Désormais **trois écrans, un par intention** :
  la **vue d'ensemble** ne fait que lire (le reste à dépenser en grand, une jauge, un **camembert**, une **courbe**
  face au **rythme théorique**, des **barres** par catégorie) ; les **dépenses** mettent en premier ce qui est à
  imputer ; les **réglages** réunissent ce qui se paramètre. → [référence](#-budgets-enveloppes--sous-catégories)
- **Intelligence marché : la maille MOLÉCULE, et l'environnement concurrentiel.** On cherche par la case que l'on
  remplit — molécule, produit, ou laboratoire. Une molécule au sens métier est un **triplet molécule + dosage +
  forme** : l'amoxicilline 500 mg gélule et l'amoxicilline 1 g injectable ne s'affrontent pas sur le même marché.
  L'analyse répond : poids du marché, **part ville / part hôpital** en %, **parts de marché** de chaque laboratoire,
  concentration, et **fabriqué en Algérie ou importé**. Le vrai travail a été de réconcilier trois sources qui
  n'écrivent rien pareil — radical de molécule, forme galénique canonique (formes non reconnues : **32,6 % → 3,8 %**
  de la valeur), noyau de raison sociale. → [référence](#intelligence-marché--la-maille-molécule)
- **PCH : un appel d'offres lu par l'IA devient un tableau Excel prêt à chiffrer.** Téléverser le document suffit :
  OCR, extraction des produits, **puis enrichissement automatique de chaque ligne** (avant, il fallait cliquer
  ligne par ligne — sur quarante produits, personne ne le faisait). L'IA extrait en plus la **nature de l'unité**
  demandée (flacon, ampoule, seringue…) : c'est ce mot qui donne son sens à la quantité. Chaque ligne reçoit la
  taille du marché, le partage ville / hôpital, les principaux concurrents et leur part, et la **production locale
  ou importée**. Livrable : un **Excel en deux feuilles**, avec les **boîtes à fournir** arrondies au supérieur et
  les colonnes sans donnée laissées vides. → [référence](#pch--un-appel-doffres-lu-par-lia-devient-un-tableau-excel)

- **Version de TEST → version de PRODUCTION, validée d'un clic.** Toute nouveauté arrive au stade **TEST** :
  invisible de l'entreprise, visible du seul compte en **mode test**. Le Super Admin la parcourt puis la **valide en
  production** — ou la retire, le retour arrière est immédiat. Une clé inconnue est **auto-créée en TEST** : rien ne
  peut être livré par accident. L'écran `/admin/versions` classe les nouveautés en trois groupes, et un bandeau
  permanent rappelle le mode test. Les onglets de menu peuvent porter un drapeau : ils n'existent que pour ceux qui
  voient la nouveauté. → [référence](#versions-test--production-drapeaux-de-nouveautés)
- **Assistant : mémoire personnelle, cloisonnée par construction.** L'assistant se souvient de **sa** personne — son
  identité, son entité, son département, son **N+1 réel**, et une note distillée de ses échanges (réécrite tous les
  ~12 messages). Les conversations sont conservées : on les rouvre, on les supprime, ou on **efface tout** (droit à
  l'oubli). Le cloisonnement n'est pas une convention mais une **structure** : un module unique est la seule porte
  d'entrée, tout `where` porte le `userId` du demandeur, `AssistantMessage` porte lui aussi son propriétaire, et en
  **« Vue exacte »** l'assistant est **désactivé** — la mémoire d'une personne ne s'ouvre à personne, pas même à un
  administrateur. **8 tests tentent explicitement la fuite** (lire / écrire / supprimer le fil d'un autre en
  connaissant son identifiant exact) et vérifient qu'elle échoue. → [référence](#assistant--mémoire-personnelle-cloisonnée-par-construction)
- **Écran « Aujourd'hui » + point du matin.** Un accueil qui répond à une seule question : *que dois-je faire
  maintenant ?* Une action mise en avant, quatre suivantes, le reste replié. Aucune nouvelle source de données — le
  classement (`rankToday`, pure et testée) fait le travail : le retard passe devant et remonte avec sa durée, une
  **validation** (qui bloque un collègue) passe avant une tâche personnelle, et **chaque ligne dit pourquoi elle est
  là**. En tête, l'assistant écrit le **point du matin** en 3-5 phrases — un seul appel IA par personne et par jour.
  → [référence](#écran--aujourdhui--point-du-matin)
- **Courrier « smart » : envoi par API HTTPS, fin des blocages SMTP.** Les ports SMTP sont filtrés à peu près
  partout ; l'envoi passe désormais par une **API HTTPS sur le port 443**. Le code est **agnostique du fournisseur**
  (Resend / Postmark / Brevo) : changer de fournisseur = changer deux variables. Chaque envoi est **journalisé avec
  le motif exact du refus** — c'est précisément ce qui manquait. Réception par **webhook signé** (HMAC-SHA256 du
  corps brut, comparaison en temps constant, idempotent). ⚠️ Reste à faire **hors application** : ouvrir un compte
  fournisseur et **vérifier le domaine** (SPF + DKIM + DMARC en DNS) ; `/admin/courrier` dit précisément ce qui
  manque et permet un envoi de test. → [référence](#courrier--smart---envoi-par-api-https-sans-smtp)
- **Structure par DÉPARTEMENTS — hiérarchie N niveaux, responsables et validation par le N+1 réel.** L'entreprise
  se pense désormais par département (le **rôle** dit ce qu'on peut faire, le **département** sur quel périmètre et
  **qui valide**). `Department` gagne une hiérarchie sur **N niveaux**, un **responsable** et un **adjoint** ;
  `Employee.departmentId` devient le rattachement de référence (l'ancien champ texte reste en **cache de libellé**,
  donc rien de l'existant ne casse). La migration **reprend les données réelles** : chaque libellé distinct devient
  un vrai département et les employés y sont rattachés. Le **N+1 réel** se résout en cascade (manager de
  l'organigramme → responsable du département → responsable du parent), avec une règle stricte : *on ne se valide
  jamais soi-même*, et le chef d'un département est validé **par le dessus** (l'adjoint supplée une absence, il ne
  valide pas son chef). Deux nouvelles portées d'étape (`DEPARTMENT_MANAGER`, `DEPARTMENT_HEAD`) rendent les
  **circuits génériques** — plus besoin de recâbler un rôle à chaque réorganisation — avec **escalade** par la
  hiérarchie supérieure et **notification** du N+1 concerné. Gestion dans **RH** (`/rh/departements`) ; la fiche
  employé affiche le **N+1 effectif et sa provenance**. → [référence](#départements-sous-départements--hiérarchie-réelle-n1)
- **Congés : le DRH peut tout corriger, y compris l'historique** (`updateLeaveRequest`) — type, dates, jours, motif,
  décision et note d'une demande **déjà décidée**, avec **réajustement automatique du solde annuel**.
- **Budgets : graphiques de consommation** — barres comparatives (budget vs consommé, colorées par santé) en vue
  générale (**par enveloppe**) et dans une enveloppe (**par catégorie**).
- **Assistant : dictée vocale, lecture de pièces jointes et annonces pop-up.** Micro (Whisper → texte **éditable**)
  sur la page et dans la **bulle flottante** ; lecture d'**Excel complet / PowerPoint / Word / PDF / CSV**, y compris
  des fichiers **déjà dans le Drive** (référencés, sans re-téléversement) ; diffusion de notifications en **pop-up
  plein écran**.
- **Intelligence marché : explorateur produits ville + hôpital.** Recherche **temps réel** et filtres sur les
  produits IQVIA (ville) **et** les réceptions PCH (hôpital), sélection multiple et comparaison volume / valeur /
  prix moyen / croissance.
- **Drive « Accueil » façon vrai drive + téléversements fiables + thème plus vif.** Le **Drive** est renommé
  **« Accueil »** (onglet, navigation, fil d'Ariane, titre) et l'onglet **« Documents »** est retiré des onglets du
  Drive (tout est consolidé dans l'Accueil + les catégories partagées). **Glisser-déposer à la souris** (`drive-table`) :
  on attrape un fichier/dossier et on le lâche sur un **autre dossier** (rangement) ou sur une **pastille de catégorie**
  (déplacement vers la catégorie), avec pastille « Accueil (mon Drive) » pour revenir au personnel — s'appuie sur
  `moveNode` (RBAC + anti-cycle côté serveur), barre de dépôt + retour visuel + toast. La **visionneuse ZIP** navigue
  désormais **dossier par dossier** comme un explorateur (fil d'Ariane, entrée dans les sous-dossiers, aperçu inline),
  au lieu d'une liste plate de chemins. **Téléversements fiables** : les limites de taille (25 Mo Documents / 100 Mo
  Drive) faisaient échouer à 100 % l'envoi d'un ZIP de dossier entier → relevées à **200 Mo / 1 Go** (défauts + ligne
  `AppSetting` existante via migration `GREATEST`, jamais de baisse d'un réglage volontaire ; `putBlob` stocke déjà en
  tranches ~1 Go). **Thème** rafraîchi (science UX Apple HIG / Salesforce Lightning) : primaire **azur vif** accessible,
  accents et statuts plus lumineux, sidebar bleu profond, élévation « carte » plus douce.
- **RH — workflow par nature de demande.** Le module RH s'adapte à la **nature** de chaque demande : un **congé /
  absence / autorisation de sortie** (congé exceptionnel, sortie exceptionnelle, congé annuel…) affiche une décision
  **Accorder / Refuser** (`decideHrLeave`, nouveau statut `APPROVED` « Accordée ») au lieu du flux documentaire
  (Soumise → Prête → Remise). Classifieur `hrNature()` (`hr-request-flow.ts`) : DOCUMENT / APPROBATION / NOTE DE FRAIS /
  ENTREVUE. Un congé annuel accordé débite le solde (verrou `balanceAppliedAt`). Le flux documentaire (statut de
  préparation + « joindre le document ») reste réservé aux vraies demandes de document.
- **Adventum Autonomous Test Center (Administration → Test Center, Super Admin) — Phase 1 : fondation de sûreté.**
  Infrastructure de certification autonome, **conçue sécurité d'abord** : un run ne touche **aucune** donnée
  préexistante — il ne supprime **que** les ressources qu'il a lui-même créées, inscrites au fur et à mesure dans un
  **manifeste** (`TestArtifact`) par **ID exact**. Règle absolue : *jamais* de suppression par nom ni par préfixe
  (« ce n'est pas parce qu'un nom contient “test” qu'on le supprime »). Le nettoyage s'exécute en **ordre inverse de
  dépendance**, puis une **vérification post-nettoyage** re-interroge la base par ID pour prouver l'absence de tout
  résidu ; un modèle non pris en charge est **refusé** (pas deviné). Deux modes en phase 1 : **Audit lecture seule**
  (aucune écriture — réutilise le moteur de Diagnostic pour la santé/cohérence) et **Test synthétique sûr** (crée une
  identité **inactive** par rôle réel sur un domaine **non routable** `qa.adventum.invalid` — jamais de vrai e-mail ni
  de connexion possible —, exécute les smoke tests, puis **nettoie et vérifie**). **Production en lecture seule par
  défaut** : tout mode d'écriture y exige une confirmation explicite **+ phrase de sécurité**. Les **secrets/mots de
  passe/tokens/données RH** sont **expurgés** des rapports et journaux (`redact`). **Reprise sur interruption** : les
  runs restés en cours ou au nettoyage incomplet sont détectés et rejouables (jamais de nettoyage automatique
  silencieux). Chaque run porte un `TestRunMode`, un statut, un `cleanupStatus` vérifié, un score, des **constats**
  (`TestFinding`, preuves expurgées) et un historique. Livré **testé** : invariant de sûreté (leurre hors-manifeste
  préservé, modèle inconnu refusé) + run synthétique de bout en bout (créées = supprimées, 0 résidu vérifié en base).
  Fichiers : `src/lib/test-center/{types,redact,guard,manifest,synthetic,smoke,runner,recovery}.ts` (+ `README.md`
  d'architecture), actions `test-center-actions.ts`, requêtes `queries/test-center.ts`, page `/admin/test-center`,
  modèles Prisma `TestRun`/`TestArtifact`/`TestFinding`, onglet dans `ADMIN_TABS`.
  - **Phases 2→5 (GOD MODE) — l'audit devient certification.** Chaque run (les deux modes sûrs) enchaîne désormais
    smoke → **audit approfondi** → **infra** → **auto-validation du testeur** → **certification** :
    - **Invariants métier (§28)** indépendants de l'UI : 8 invariants prouvables (rôle RBAC connu, couplage
      instance-workflow, couplage validation décision↔date, montant ≥ 0, modules d'enveloppe ⊆ RBAC, marqueur de
      congés, intégrité référentielle congé→employé et audit→auteur) ; un invariant critique **bloque la certification**.
    - **Machines à états (§29)** : 6 objets métier déclarés (ordre de dépense, validation, instance workflow, congrès
      intl/national, événement, congé) — distribution vivante, violations de couplage structurel, et **couverture des
      transitions** réellement observées via le journal d'audit.
    - **Cohérence multi-oracles (§30)** : Σ(états)=total, liens `expenseOrderId` module↔finance, couverture d'audit.
    - **Environnements éphémères (§31)** : schéma PostgreSQL jetable (garde-fou `tc_eph_`, destruction vérifiée) ;
      **certification migrations & reprise (§35)** : migrations disque↔`_prisma_migrations` + **roundtrip
      sauvegarde→perte→restauration** prouvé dans un schéma jetable.
    - **GOD MODE — le testeur se valide lui-même (§27)** : moteur de **property-based testing** maison (générateurs
      semés + réduction §34), **mutation testing** (corruptions synthétiques → la suite doit toutes les tuer, 0
      survivant = suffisante), **tests métamorphiques** (dont robustesse de l'extraction JSON d'IA au bruit de
      formatage), **fuzzing** des validateurs d'upload (totalité + refus des exécutables), **détection d'instabilité**
      (reproductibilité), **Time Travel (§33)** (acquisition de congés idempotente, « une fois par période », sans
      toucher l'horloge serveur).
    - **Certification (§36)** : verdict **CERTIFIÉ / avec réserves / BLOQUÉ / NON CONCLUANT** (jamais un run incomplet
      présenté comme réussi), **paquet de preuves immuable** scellé par un **sha256** (commit, env, couverture,
      exclusions, résultats, manifeste, nettoyage, versions des modèles IA, empreinte des constats), et **différentiel
      (§32)** vs run précédent (améliorations / régressions). Dashboard : badge de certification, auto-validation,
      couvertures, différentiel, empreinte de preuve.
    Fichiers : `src/lib/test-center/{invariants/*,state-machines/*,oracles/*,coverage,deep-audit,ephemeral,
    migration-cert,infra-checks,god/*,certify,evidence,differential}.ts` ; migration `..._test_center_certification`.
    Tout est **pur ou lecture seule** hors identités synthétiques nettoyées ; aucune règle de sûreté §1 n'est enfreinte.
- **Diagnostic de plateforme (Administration → Diagnostic, Super Admin) — « le médecin » dopé à l'IA.** Onglet qui
  **sonde le fonctionnement réel** (lecture seule, données réelles, aucune simulation) : base de données + latence,
  IA/STT, stockage, notifications push ; **couverture des rôles critiques** (ex. plus aucun *National Sales* → les
  demandes de délégués resteraient bloquées au préliminaire) ; **files d'attente bloquées** (circuits Ad & Pro,
  ordres de dépense, demandes de validation en souffrance depuis > 21 j) ; **formats de fichiers acceptés par espace**
  — testés **en direct** sur les vrais validateurs (« cet espace refuse .svg/.heic/.mp4… ») ; **cohérence
  navigation ↔ RBAC** ; **volumétrie** par domaine ; **matrice rôles → modules**. Un **score de santé /100** et des
  **constats** classés (critique / à surveiller / info). Bouton **« Générer des idées » (IA)** : Claude analyse ces
  faits et rend des **corrections prioritaires, simplifications, améliorations et réglages rapides** concrets et
  spécifiques aux données. Fichiers : `src/lib/platform-audit/{engine,ai}.ts`, action `platform-audit-actions.ts`,
  page `/admin/diagnostic`, onglet dans `ADMIN_TABS`. Complète l'**auto-testeur CLI** (`npm run autotest`, cohérence
  statique + crawl navigateur) : le Diagnostic vit **dans l'app** et se concentre sur la santé **runtime** + les idées.
  - **Élévation « jury de design de classe mondiale ».** L'engine ajoute des **repères d'ergonomie** : densité de
    navigation (loi de Miller / nav Lightning), **rôles au périmètre de vue identique** (candidats à fusion — détecté
    réellement : Ventes = Logistique), cohérence des règles d'upload (*consistency* Apple HIG), **temps de réponse**
    d'une requête type, adéquation pharma. Le bouton « Idées » invoque un **jury d'experts** (Apple HIG · Microsoft
    Fluent 2 · Salesforce Lightning · WCAG 2.2 · heuristiques Nielsen) qui **note chaque axe /5** (responsivité,
    contenu/fond, forme/contenant, cohérence, navigation & vues, rôles, performance, résilience/hors-ligne, fichiers &
    formats, accessibilité, adéquation pharma) et rend points forts, corrections prioritaires et **inspirations à
    adopter**. Les axes navigateur sont réellement **mesurés** par le crawler `autotest:live` : temps de chargement,
    **débordement horizontal à 375 px** (responsivité mobile), **perte de connexion** (offline), erreurs console —
    constats `RESPONSIVE_OVERFLOW`, `SLOW_PAGE`, `OFFLINE_UNHANDLED`, `CONSOLE_ERRORS`.
- **Ad & Pro — routage intelligent : personne n'approuve sa propre demande.** À la création d'une demande
  (sponsoring / congrès / événement), on **saute** toute étape d'approbation au niveau ou en dessous du rang du
  créateur. Le **National Sales** désigne directement le chef de produit (sélecteur ajouté aux formulaires) et
  **saute son préliminaire** ; un **chef de produit**, la **Direction** ou le **Super Admin** **sautent préliminaire
  ET analyse** → validation définitive Direction. Logique centralisée dans `src/lib/workflow/origin.ts`
  (`adProOriginRank`/`adProInit`, testé) et câblée dans `createSponsoring`, `createCongressRequest`,
  `submitEventForApproval` ; le statut legacy de départ pilote à la fois les actions historiques et le moteur.
- **Auto-testeur dopé à l'IA (`npm run autotest`).** Outil sous `scripts/auto-test/` qui importe le **vrai** code
  RBAC/navigation et confronte pages ↔ gardes `requireModule` ↔ menu ↔ matrice rôles→modules : liens de menu morts,
  gardes de module inconnues, incohérences menu/réalité, modules orphelins (déterministe, aucun serveur ; code de
  sortie CI). Option **crawl en direct** (Playwright) : passe **anonyme** (détection de fuites d'accès), passes
  **par rôle** (comptes fournis ou semés jetables) comparant l'accès **réel** à l'accès prédit, dépôt de **pièces
  jointes jetables** (PDF+ZIP) dans les zones d'upload, capture des erreurs console / overlays Next. Option **triage
  IA** (`--ai`) réutilisant `src/lib/ai.ts`. Rapports `auto-test-report.{md,json}`.
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
  **reprises** puis retirées des Finances (migration). **(2) Modification & suppression** des lignes budgétaires
  (sur les dépenses imputées : édition réf./montant/date + **ré-imputation** vers une autre (sous-)catégorie, ou
  corbeille ; la consommation se réajuste — `updateBudgetExpense`/`deleteBudgetExpense`). **(3) Regulatory — miroir Drive AUTOMATIQUE** : tout
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
  - **Documents produits** : rapport de constats et lettre de réponse aux réserves (`.docx`, pizzip).
    ⚠️ La génération à partir de **modèles à trous** (note de pré-soumission, formulaire
    d'enregistrement…) a été **retirée** — elle rendait des coquilles à remplir à la main.
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
       (hors-ligne, séquentiel). Pré-traitement renforcé : **agrandissement ×2 des petits scans** (<1400 px —
       photo de téléphone, fax) + netteté. En mode `auto`, tout échec Mistral (réseau/quota) bascule dessus —
       **jamais de perte**.
    3. **DERNIER ÉTAGE — SECOURS VISION** (`ocr/vision-ocr.ts`) : les pages restées **vides ou douteuses** après
       le moteur OCR (quel qu'il soit) sont re-rastérisées et **transcrites par le modèle multimodal** (recopie
       fidèle, tableaux « | », manuscrit/tampons, schéma JSON strict) — par lots de 4 pages, **plafonné**
       (`REG_OCR_AI_PAGES`≈40/document, `REG_OCR_AI=0` coupe), **tracé au registre des coûts** (`trackedLuna`,
       step `ocr-vision` : budget du dossier respecté, cache = une page scannée ne se paie qu'une fois). Fusion
       **sans régression** : une transcription ne remplace une page que si elle apporte PLUS de texte. Branché sur
       le pipeline CTD (`ocrOne`), le **chat de dossier** (pièces jointes — seuil d'illisibilité abaissé à ~10
       caractères : seul le VIDE est écarté, avec son motif) et l'**ingestion des lettres de réserves**.
    Texte + confiance par page, natif vs OCR séparés, pages vides/faibles → **revue humaine**. Mistral ne score pas
    la confiance → page non vide présumée fiable (95), page vide → 0/revue. **Garde de taille** : un document >~48 Mo
    (`REG_MISTRAL_OCR_MAX_MB`) part directement en OCR local (Mistral le refuserait — pas d'appel payant inutile).
    **Diagnostic en ligne** (droit d'upload) : `GET /api/regulatory/intelligence/ocr/diagnose` confirme le moteur
    actif + PING réel de la clé Mistral avant un gros upload. Code : `ocr/{ocr-engine,mistral-ocr,vision-ocr}.ts`.
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
    anti-injection). Sans clé IA : les sources restent affichées, **aucune réponse simulée**. La version AGENT
    (`knowledge/dossier-agent.ts`) est une **messagerie persistante** (`knowledge/dossier-thread.ts`,
    `RegulatoryDossierChatMessage`) : fil par dossier × utilisateur rechargé au montage, historique reconstruit **côté
    serveur**, pièces soumises conservées avec leur texte extrait et **re-présentées à l'agent** aux tours suivants ;
    pièce illisible = motif exact remonté, réponse sur le reste (jamais d'échec global).
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
    NB honnête : *océriser* un PDF proche d'1 Go reste borné par la RAM (mupdf charge le PDF) — prévoir ≥ 4 Go, ou activer le stockage objet.
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
- **Bureau du secrétariat** — dans la fenêtre de **30 min** (tous types de demandes), le demandeur peut modifier
  **tous les champs** qu'il a saisis (plus seulement la description) ou supprimer sa demande.
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
