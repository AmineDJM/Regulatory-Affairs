# AMD Internal OS — Contexte & état du projet

> Document de référence durable. Objectif : qu'on puisse reprendre le projet (ou
> le confier à un tiers / une autre IA pour brainstorming) **sans rien perdre**.
> Tenu à jour au fil des évolutions.

---

## 1. Vision

**AMD Internal OS** est le logiciel interne unique (ERP / « OS d'entreprise ») d'**Adventum Pharma**
(laboratoire pharmaceutique algérien). Principes :

- Gérer **100 % de l'entreprise** dans un seul outil connecté, **100 % digitalisé & data-driven**.
- **Aucune donnée simulée** : l'admin et les utilisateurs saisissent manuellement.
- **Accès ultra-granulaire contrôlé par l'admin** : par utilisateur × onglet × action × ligne.
- **Tout est relié** (un module alimente l'autre).
- Devise = **DZD**. Contexte fiscal algérien (G50, IRG, IBS, CNAS, CASNOS).
- Client institutionnel principal = **PCH** (Pharmacie Centrale des Hôpitaux — marchés publics).
- Réglementaire = enregistrement **AMM / ANPP**.
- Ambition : l'unique environnement de travail des employés (Drive ✓, **messagerie interne ✓** ;
  e-mail & éditeur Office collaboratif à terme).

---

## 2. Stack & déploiement

- **Next.js 14.2.x** App Router, React Server Components, **Server Actions**, TypeScript strict.
- **Prisma 5.22 + PostgreSQL**. **NextAuth v5 (beta)** — Credentials, JWT, trustHost, bcrypt.
- **Tailwind** + UI kit maison (Card, Sheet, Table, DataTable, Button, Input/Select/Textarea,
  Badge, StatusBadge, KpiCard, EmptyState, Icon via lucide, CommentThread, DocumentUpload/List,
  CreateRecordButton avec FieldDef).
- **Déploiement : Render** (Web Service + PostgreSQL managé). `prisma migrate deploy` au déploiement.
- **Branche de travail : `claude/hopeful-goodall-phd0nb`** (ne jamais pousser ailleurs sans accord ;
  pas de PR sauf demande explicite).
- Dernier commit au moment de la rédaction : `345bf22`.

---

## 3. Architecture & patterns clés

- **RBAC dynamique à 2 couches** (toujours appliqué côté serveur) :
  - `PERMISSIONS` = matrice par rôle (baseline).
  - `UserAccess` = override par utilisateur ; `RowGrant` = accès par ligne.
  - `getAccess()` (caché par requête) résout l'accès *effectif* ; `userCan()`, `defaultScope()`,
    et les helpers `scope*()` (fragments Prisma `where`) lisent cet accès.
  - `hasGlobalView` = [SUPER_ADMIN, DIRECTION].
  - `requireModule(module, action)` garde chaque page ; `requireUser()` pour les actions.
- **Fichiers `"use server"` : n'exporter QUE des fonctions async** (un export non-async a déjà
  causé un crash en prod — leçon retenue).
- **Aperçu documents in-app, partout** : `DocumentPreview` (modale) réutilise les viewers du Drive
  (`office-viewers.tsx`, partagé) — PDF/image (iframe/img), **Word** (mammoth), **Excel** (SheetJS),
  **PowerPoint** (JSZip, texte) — libs **embarquées, aucune dépendance externe**. Disponible sur toute
  `DocumentList` (sponsoring, regulatory, congrès…). Route `/api/documents/[id]` sert **inline** par défaut
  (`?dl=1` = téléchargement).
- **En-têtes de sécurité** (`next.config.mjs`) : `X-Frame-Options: SAMEORIGIN` (pas `DENY`, sinon l'aperçu
  PDF en iframe est bloqué) et `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`
  (PAS de liste vide `()`, sinon **micro/caméra désactivés** → rapports vocaux + scan QR cassés).
- **Migrations** : `prisma migrate dev` est interactif (bloqué). On fait
  `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`
  → écrire dans `prisma/migrations/<timestamp>_<nom>/migration.sql` → `prisma migrate deploy`.
- **Drive chiffré** : AES-256-GCM, adressage par contenu (SHA-256), `Bytes` Postgres, clé maître
  dérivée de `NEXTAUTH_SECRET`.
- **Document/Comment polymorphes** via `(entityType, entityId)` — réutilisés par chaque module.
- **Pattern Ordre de dépense** : validation → `createExpenseOrder()` → le comptable règle →
  `FinanceTransaction` OUT + source marquée payée.
- **Custom fields** (colonnes dynamiques admin) via `custom Json?` + `CUSTOM_ENTITY_TYPES`.
- **Audit** (`recordAudit`) + **notifications** (`notifyUser`, `notifyRoles`).
- **Couche IA** (`lib/ai.ts`) — wrappers Claude **serveur uniquement** (`askClaude` texte ; `callClaude`
  multi-tours + outils pour la boucle agent ; `aiConfigured`). La clé `ANTHROPIC_API_KEY` n'est **jamais**
  exposée au client ; sans clé, renvoie `configured:false` et l'UI affiche « IA non configurée ». Réutilisé
  par Process Intelligence (synthèse), Voix (analyse rapports) et **Assistant IA / Chatbot** (boucle agent).
  STT vocal retenu = **Whisper / OpenAI** (`OPENAI_API_KEY`, à poser sur Render).
- **Messagerie — temps réel sans WebSocket** : mutations par **server actions** + **UI optimiste**,
  réception par **polling** (`/api/messaging/sync` ~6 s pour la liste/badge ; `/api/messaging/messages`
  ~3,5 s pour le fil actif), pauses si onglet caché. **Présence** via heartbeat (`User.lastSeenAt`) ;
  **typing** in-memory best-effort (`lib/messaging-typing.ts`, OK mono-instance Render). Pièces jointes
  réutilisant le **Drive chiffré** (`putBlob`) avec **signature HMAC du blob** (interdit de référencer un
  blob arbitraire). Accès **gouverné par l'appartenance** (`ConversationMember`), jamais par scope RBAC.

---

## 4. Rôles (UserRole)

`SUPER_ADMIN`, `DIRECTION`, `HEAD_OF_REGULATORY`, `REGULATORY_ASSISTANT`, `HEAD_OF_SALES`,
`SALES_USER`, `LOGISTICS_MANAGER`, `MEDICAL_PROMOTION_MANAGER`, `MEDICAL_DELEGATE`,
**`PRODUCT_MANAGER` (Chef de produit)**, `BUSINESS_DEVELOPMENT_MANAGER`, `FINANCE_BUDGET_MANAGER`,
**`MEDICAL_INFO_PHARMACIST` (Pharmacien responsable de l'information médicale)**, `VIEWER`.

> Le Super Admin gère tout via la **matrice d'accès** (admin/users/[id]). Penser à créer au moins
> un compte **Chef de produit** (pour la validation des congrès) et à accorder les modules **PCH/STOCKS**
> aux bons profils.

---

## 5. Modules livrés (27 routes)

Groupes : **Pilotage** (Mon travail, Mon espace, **Messagerie**, **Assistant IA**, Mon dossier RH, Dashboard), **Pôles**, **Transverse**, **Système**.

> **Navigation fusionnée (`ModuleTabs`)** — trois paires sont présentées comme **un seul item de
> sidebar** avec des **onglets internes**, sans retirer aucune route ni fonctionnalité :
> **Finances** (Finances · Espace comptable), **Congrès** (Internationaux · Nationaux),
> **Logistique & Stocks PCH** (Logistique · Stocks). Chaque onglet reste sa propre route gardée par
> son propre module. Une entrée fusionnée est définie dans `NAVIGATION` via `tabs: NavTab[]` : le
> layout la montre si l'utilisateur a accès à **au moins un** onglet, résout le lien vers le premier
> onglet autorisé et renseigne `match` (préfixes des onglets) pour le surlignage. La page affiche
> `<ModuleTabs>` (composant partagé `src/components/shared/module-tabs.tsx`) avec `show` calculé par
> `userCan` — RBAC asymétrique : un onglet inaccessible n'apparaît pas (et sa route reste refusée).

### Pilotage
- **Mon travail (`/mon-travail`)** — *Action Center*. Agrège selon les droits : tâches, demandes admin
  à traiter, validations en attente, paiements à régler (comptable), dossiers Regulatory à mettre à
  jour, congés à décider (RH), **congrès à valider/analyser**, notifications. Vues : en retard / bientôt
  / urgent. Chaque ligne ouvre l'élément.
- **Mon espace (`/mon-espace`)** — tâches perso, congés/absences, avances sur salaire (self-service),
  activité, accès rapides.
- **Messagerie (`/messages`)** — messagerie interne complète (voir §6). Badge non-lus live (topbar + sidebar).
- **Courrier (`/courrier`)** — **webmail Infomaniak intégré** par utilisateur (IMAP lecture + SMTP envoi),
  une seule entité avec la plateforme. Connexion par **mot de passe d'application** chiffré AES-256-GCM
  (`MailAccount`), couche serveur `src/lib/mail.ts` (imapflow / nodemailer / mailparser), 3 volets
  (dossiers · liste · lecture/composition), aperçu HTML en `iframe` sandbox. Routes serveur
  `/api/mail/{messages,message,attachment}`. *(IMAP/SMTP testables uniquement hors sandbox réseau.)*
- **Directives (`/directives`)** — **instructions priorisées de la Direction** vers une **personne**
  (`targetUserId`) ou un **rôle entier** (`targetRole`, diffusion), avec **priorité / échéance / statut**
  (`DirectiveStatus` : À traiter → Pris en compte → En cours → Traité → Archivé) et un **espace d'échange**
  (`DirectiveMessage`). Seule la Direction émet/archive ; le destinataire accuse réception, fait évoluer le
  statut et répond dans le fil. Modèles `Directive` + `DirectiveMessage`, réf. `DIR-AAAA-NNN`. Tout employé
  a un socle `["VIEW","UPDATE"]` (scope `ASSIGNED` : ne voit que ce qui le concerne) ; surfacé dans *Mon travail*.
- **Mon dossier RH (`/mon-dossier`)** — espace RH employé : ses **documents RH** (contrats, bulletins,
  attestations déposés en PDF par les RH, chiffrés, téléchargeables) + ses **demandes RH**
  (`HrRequestType`) : attestation de travail, CNAS, relevé des émoluments, domiciliation, **attestation /
  titre de congé**, **ordre de mission**, **note de frais**, autre — avec suivi de statut. Côté RH, gestion sur
  `/rh/[id]` (dépôt de documents, traitement des demandes, pièce jointe). Accès strict : un employé ne
  voit que ses propres documents (route `/api/rh/document/[id]` contrôlée).
- **Assistant IA (`/assistant`)** — chatbot interne (boucle agent Claude). Comprend l'app + les données
  de l'utilisateur **filtrées par ses droits RBAC**, répond aux questions et **prépare des actions**.
  **Outils de lecture** exécutés automatiquement (annuaire interne, mes tâches/demandes, médecins/produits/
  events — tous scopés). **Outils d'écriture** jamais exécutés par l'IA : interceptés et renvoyés en **carte
  de confirmation** (« Confirmer chaque action avant exécution »). Actions disponibles (chacune gardée par
  le module correspondant) : **créer une tâche** (WORKSPACE), **créer une demande administrative** (TRAVEL,
  etc. — ex. billet pour un invité, avec dates), **envoyer un message** interne à un collègue (MESSAGING →
  DM + message), **créer une demande de congrès** national/international (CONGRESS_* → demande préliminaire
  + notif Direction). L'exécution (`performAction`) est **ré-autorisée** côté serveur (jamais sur la
  confiance du client) et **journalisée** (module « Assistant IA »).
  **Garde-fous :** clé `ANTHROPIC_API_KEY` serveur uniquement ; sans clé → bannière « IA non configurée ».
  N'invente jamais un médecin/produit/établissement/personne (sinon « à confirmer »). **Dates** : la date du
  jour est dans le contexte ; toute date **passée** déclenche un avertissement sur la carte (`pastWarning`)
  et l'IA doit la signaler. **Sortie en texte simple** (pas de Markdown) — prompt + nettoyage client
  `cleanReply`. **Robustesse :** la boucle + les server actions ne lèvent jamais (résultat structuré, fini
  le « Appel à l'assistant impossible ») ; `callClaude` a un timeout + 3 tentatives (retry 429/5xx/529).
  Code : `src/lib/assistant.ts` (contexte + system prompt + outils + boucle + `performAction`), `src/lib/ai.ts`
  (`callClaude` tool-use), `src/lib/actions/assistant-actions.ts` (boundary `use server`).
- **Dashboard** — KPIs & graphiques.

### Pôles
- **Regulatory (`/regulatory`)** — dossiers AMM/ANPP, workflow 17 étapes, documents, commentaires,
  champs personnalisés. **Catégorie Médicament / Dispositif médical** (badge). **Vue fournisseur**
  (pilote ce que le portail externe expose).
- **Sponsoring** — workflow demandes (budget demandé/suggéré/accordé, justificatif, facture).
- **Budgets (`/budgets`)** — **enveloppe budgétaire** : la Direction (rôle DIRECTION = MANAGE) définit un
  **budget total** sur une période, le répartit en **catégories** qu'elle crée (allocation chacune), et la
  **consommation réelle** est calculée depuis les dépenses (FinanceTransaction OUT) **attribuées** à chaque
  catégorie, sur une **période sélectionnable** (timeline Du/Au). Barres de progression, santé
  (Maîtrisé/À surveiller/Dépassé), non-alloué, **dépenses non attribuées** avec attribution en un clic.
  Modèles `BudgetEnvelope` + `BudgetCategoryLine` (+ `FinanceTransaction.budgetCategoryId`). L'ancien
  `BudgetLine` reste en base (legacy). **Finances** (trésorerie, livre, **paie**, **ordres de dépense**), **Espace comptable
  (`/comptabilite`)** — synthèse légère (à régler, recettes attendues, résultat mensuel), pas de compta complète.
- **RH (`/rh`)** — employés, contrats, congés, avances.
- **Congrès internationaux (`/congress-international`)** & **Événements nationaux (`/congress-national`)** —
  voir §6.
- **Events (`/events`)** — gestion d'événements de bout en bout : congrès, séminaires, staffs, webinars,
  symposiums… Statuts (Brouillon → Inscriptions ouvertes → Complet → Terminé). **Billetterie** : lien
  d'inscription **public partageable** (`/inscription/[id]`, exempté de l'auth), formulaire, **QR code par
  participant** (lib `qrcode`, route publique `/api/events/qr/[token]`), **check-in** (scan QR →
  `/events/[id]/checkin?token=` → « Présent », + recherche/marquage manuel), statuts participant, taux de
  présence, répartition par spécialité/rôle, **export CSV**. Lien Meet/Zoom/Teams **manuel** (auto Google
  à venir). Modèles `Event` + `EventRegistration`. Module RBAC `EVENTS` (managers médicaux + Direction).
- **Ventes (`/sales`)** — CA, import CSV. **Type Produit / Service** + client externe + description service.
- **Logistique PCH (`/logistics`)** — import / expéditions fournisseurs.
- **PCH — Marchés (`/pch`)** — voir §6.
- **Stocks PCH (`/stocks`)** — mouvements (entrée/sortie/ajustement) + niveau courant par produit.
- **Rapports terrain (`/field-reports`)** — **rapports vocaux IA** des délégués : *Parler → transcription
  (Whisper/OpenAI) → analyse IA (Claude → champs structurés) → relecture/correction → pièces jointes
  (photos, carte de visite, PDF) → validation*. **L'IA ne valide jamais seule.** Champs extraits :
  médecin, établissement, spécialité, produits, intérêt, objection, question médicale, demandes
  (document/sponsoring/prise en charge), concurrent, opportunité, **signalement qualité/PV (confirmation
  renforcée)**, prochaine action, synthèse. Modèle `FieldReport` + `FieldReportAttachment`. Délégué = ses
  rapports ; manager/Direction = tous + **synthèse agrégée** (objections, questions, concurrents,
  opportunités, qualité/PV, prochaines actions, top produits). Sans clé : workflow 100 % utilisable en
  saisie manuelle, l'IA s'active dès `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` sur Render.
- **Promotion médicale (`/medical`)** — **annuaire structuré : Spécialité → Secteur (Hôpital / Libéral /
  les deux) → médecins**, chacun avec **titre/grade** (Professeur, Maître-assistant…), **influence**
  (jusqu'à KOL) et **potentiel de prescription**. Spécialités = liste de référence gérée (modèle
  `MedicalSpecialty`). Le nom de spécialité est **dénormalisé** sur le médecin → la cascade Congrès
  (spécialité → médecins) continue de fonctionner sans changement. Visites & tournées conservées.
- **Information médicale (`/information-medicale`)** — module du **pharmacien responsable de l'information
  médicale** (`MEDICAL_INFO_PHARMACIST`). Étape réglementaire **intercalée** : à la validation définitive
  d'un sponsoring / congrès par la Direction, **aucun ordre de dépense n'est encore émis** — une
  `MedicalInfoDeclaration` (réf. `DIM-AAAA-NNN`) est créée et notifiée au pharmacien. Celui-ci **déclare
  l'événement aux autorités**, peut **exiger des pièces** de qui il choisit (Direction, comptable,
  délégué…) — chaque `MedicalInfoDocRequest` notifie le destinataire, qui **dépose** la pièce (apparaît
  aussi dans *Mon travail* + détail accessible même sans le module via `canViewDeclaration`). Quand le
  pharmacien **valide**, l'**ordre de dépense est enfin émis** vers le comptable et reporté sur
  l'événement source (interconnexion). Statuts `MedicalInfoStatus` : À déclarer → Pièces demandées →
  Prêt à valider → Validé. Agrégé aussi dans le **Centre de validation** et l'**Action Center**.
- **Business Development (`/business-development`)** — **grand tableau stratégique Projet → Gamme →
  Produit** (≈20 colonnes : marché DZD/USD, prix, volumes, concurrents, investissements & revenus
  estimés A1-A3), colonnes gelées, recherche/filtres/tri, édition de cellule en place, export CSV,
  page détail projet (statuts Idée→…→Validé/Abandonné/Clôturé). Ancien pipeline d'opportunités conservé
  sous `/business-development/opportunites`.

### Transverse
- **Validations (`/validations`)** — *Validation Center* configurable par le Super Admin (voir §6).
- **Drive (`/drive`)** — stockage chiffré, **visionneuses PDF / Word (mammoth) / Excel (SheetJS) /
  PowerPoint (JSZip, texte) / images / vidéo / audio / texte**. **Édition Office (OnlyOffice
  auto-hébergé)** : bouton « Éditer dans Office » sur un fichier Word/Excel/PowerPoint quand
  `ONLYOFFICE_URL` + `ONLYOFFICE_JWT_SECRET` sont définis. Page `/drive/[id]/edit` (config signée
  JWT), routes serveur `/api/onlyoffice/{file,callback}` : le Document Server lit le fichier via un
  **jeton signé** (sans session) et **rappelle** la sauvegarde → création d'une **nouvelle version**
  Drive. `lib/onlyoffice.ts` (JWT HS256 sans dépendance, types éditables). **Inerte tant que les
  variables ne sont pas posées.** ⚠️ **Déploiement** : le Document Server doit être un **Web Service
  public** (le navigateur charge `api.js`) — un *Private Service* Render ne suffit pas ; `APP_URL` doit
  pointer l'URL publique de l'app (joignable par le Document Server pour le callback).
- **Demandes administratives (`/demandes`)** — « Bureau de Donna » : 10 types, validations, ordres
  de dépense, missions chauffeur.
- **Demandes de support (`/support`)** — tout employé adresse une **question**, une demande de
  **support de visite**, **brochure** ou **document/PDF** au **directeur médical**, au **chef de produit**
  ou à une autre **fonction** (`targetRole`) / **personne** (`targetUserId`). Le destinataire prend en
  charge, répond dans le fil (`SupportMessage`) et **joint les pièces** (`Document` sur
  `SUPPORT_REQUEST`). Statuts `SupportStatus` (À traiter → Pris en charge → Répondu → Clôturé) ; socle
  `["VIEW","CREATE","UPDATE","UPLOAD"]` pour tous, scope `ASSIGNED` (émises / reçues / prises en charge) ;
  surfacé dans *Mon travail*. Réf. `SUP-AAAA-NNN`.
- **Documents**, **Notifications**, **Feedback (`/feedback`)** — retour libre utilisateur → `/admin/feedback`.

### Système
- **Process Intelligence (`/process-intelligence`)** — **Super Admin uniquement** (module
  `PROCESS_INTELLIGENCE` ; aucun autre rôle par défaut, l'admin peut l'accorder via UserAccess).
  Analyse des **lenteurs & blocages** : work items en cours agrégés sur Regulatory, Congrès, Sponsoring,
  Demandes admin, Validations, Tâches (statut + `updatedAt` → « sans action depuis X j »), étapes les
  plus lentes, top blocages, validations en attente, **alertes**. Onglet **People & Workload Analyzer**
  (charge par personne : tâches/demandes/regulatory/validations ouvertes, retards, actions 30 j via
  AuditLog, charge par département, inactifs). **Synthèse IA** à la demande (`/api/process-intelligence/
  synthesis`) via `lib/ai.ts` — dégrade proprement en « IA non configurée » sans `ANTHROPIC_API_KEY`.
- **Admin (`/admin`)** — comptes, **matrice d'accès** (onglet × action × ligne), sessions révocables,
  activité, journal d'audit, **champs personnalisés**, **/admin/validations** (règles), **/admin/feedback**,
  **/admin/suppliers** (comptes portail fournisseur). **Vue exacte** (impersonation, voir §6).
- **Recherche globale** (RBAC-aware) + palette **⌘K**.

### Externe (hors OS interne)
- **Portail Fournisseur (`/portail`)** — voir §6 (auth séparée, isolation stricte).

---

## 6. Workflows critiques (détails à ne pas perdre)

### Congrès (demande de prise en charge — double validation)
`Demande (délégué/superviseur + budget estimé)` → **validation PRÉLIMINAIRE (Direction)** + assignation
d'un **Chef de produit** → **analyse + budget proposé (chef de produit)** → **validation DÉFINITIVE
(Direction)** → **ordre de dépense** (catégorie Événement) émis dans l'espace comptable.
- Formulaire : **médecins invités via cascade Spécialité → médecins** (issus de Promotion médicale),
  **participants Adventum** (multi-sélection users), budget estimé. **National ET international** :
  **type d'événement** (congrès, séminaire, table ronde, webinaire, atelier, symposium, staff…).
- Deux budgets conservés côte à côte (demandeur / chef de produit). Délégués (scope ASSIGNED) ne
  voient que leurs demandes ; Direction valide ; chef de produit analyse. Vérifié bout-en-bout.

### Sponsoring (même circuit que les congrès + appel — calqué)
`Demande (délégué)` → **PRÉLIMINAIRE (Direction)** + désignation **chef de produit** → **analyse + budget
proposé (chef de produit)** → **DÉFINITIVE (Direction : budget final accordé + commentaire)** → **ordre de
dépense** (catégorie Événement) vers l'espace comptable. Le **type** de sponsoring est un **menu déroulant**.
- **Appel du délégué** (après décision) : repart au **chef de produit** pour un **nouvel avis sans budget**
  (`APPEAL_PENDING` → `AWAITING_FINAL_APPEAL`) → la **Direction tranche définitivement** (« 2ᵉ tour »).
- **CONFIDENTIALITÉ (impérative)** : l'**analyse et le budget proposé du chef de produit** (et la note de
  pré-validation) **ne sont JAMAIS visibles par le délégué** — il ne voit que le **budget final accordé +
  le commentaire de la Direction**. Filtre `canSeeInternal = Direction || chef de produit assigné`
  (`SponsoringRequest.productManagerNotes/productManagerBudget/preliminaryNote` masqués sinon).
- Statuts `SponsoringStatus` ajoutés : `AWAITING_PRELIMINARY`, `PRELIMINARY_APPROVED`, `AWAITING_FINAL`,
  `APPROVED`, `APPEAL_PENDING`, `AWAITING_FINAL_APPEAL`, `CANCELLED`. Actions : `sponsoringPreliminary`,
  `sponsoringAnalysis`, `sponsoringFinal`, `sponsoringAppeal`. Vérifié e2e 3 rôles (délégué/chef de
  produit/Direction) **dont la confidentialité** (15/15).

### Centre de validation (agrégation transverse)
Le module **Validations** (`/validations`) agrège, en plus de ses circuits génériques configurables,
**toutes les validations en attente issues des autres modules** (`getCrossModuleValidations`) : demandes
administratives **escaladées** (`AdminApproval` PENDING — l'assistante « Demander validation » → Direction),
**sponsoring** et **congrès** en attente de Direction. Chaque ligne renvoie vers la fiche où la décision se
prend réellement (« Ouvrir pour valider »). C'est le « centre où toutes les validations sont présentes ».

### Ordres de dépense — aller-retour comptable ↔ Direction
Direction valide → **ordre de dépense** → le **comptable règle** (génère l'écriture de trésorerie). Nouveauté :
le comptable peut **demander une révision de budget** (manque de fonds) → l'ordre passe
`REVISION_REQUESTED` et remonte à la **Direction**, qui **ajuste le montant** (l'ordre repart « à régler » au
nouveau montant) **ou refuse** (montant maintenu). Champs `revisionReason`/`proposedAmount`/`revisionById`,
actions `requestBudgetRevision` / `resolveBudgetRevision`.

### PCH — Marchés publics
- **Appel d'offres gagné** = une ligne (réf auto `AO-année-n`, produits, fournisseur, pays, quantité,
  valeur, client=PCH par défaut, statut : pas encore commencé / en cours / terminé).
- **Caution obligatoire** : montant, déposée O/N, dates début/fin, alertes (expirée / < 30 j).
- Sous-lignes = **bons de commande** PCH (réf, qté, valeur, statut, date réception, date paiement).
- Page liste + page détail (gestion des bons).

### Validation Center (configurable Super Admin)
- Le Super Admin définit des **règles** : module, type d'objet, montant min/max, département, rôle du
  demandeur, priorité, catégorie → routage vers **1 ou 2 validateurs**, en **séquentiel ou parallèle**.
- `/admin/validations` (config), `/validations` (« Mes validations » : Valider / Refuser / Demander
  modification — motif obligatoire). Notifications + audit. Moteur : `lib/validation.ts`.

### Portail Fournisseur (externe sécurisé) — **contraintes de sécurité à préserver**
- **Comptes externes totalement séparés** : tables `Supplier` / `SupplierUser`, **auth distincte**
  (cookie HMAC scopé `/portail`, revalidé en base à chaque requête), middleware NextAuth exempté
  pour `/portail`. Un cookie portail ne donne **aucun** accès interne, et inversement.
- Le fournisseur ne voit **QUE** : ses propres produits marqués `portalVisible`, et **seulement les
  champs externes** (statut externe simplifié ≠ statut interne, prochaine étape, action attendue,
  deadline, commentaire externe, dernière MAJ). **Jamais** : autres fournisseurs, statut/notes internes,
  documents, autres modules. IDs cuid non séquentiels. Comptes désactivables. Connexions journalisées.
- Côté Regulatory : carte « Vue fournisseur » sur le dossier (fournisseur associé, visible O/N, statut
  externe, etc.). Mapping suggéré interne→externe surchargeable.

### Vue exacte (impersonation)
- Le Super Admin visualise l'OS **exactement comme** un utilisateur (mêmes onglets/droits/données).
  Cookie `amd_impersonate` honoré **uniquement si la session réelle est Super Admin** (pas d'escalade).
  Bandeau permanent + « Quitter ». Démarrage/arrêt journalisés.

### Messagerie interne (`/messages`)
- **3 types de conversations** : **message direct** (1-1), **groupe** privé, **canal** d'équipe
  (découvrable via « Parcourir », on le rejoint). Module `MESSAGING` accordé à **tous les rôles**
  (chaque employé est joignable), retirable par override admin. **Super Admin compris : pas de
  lecture par-dessus l'épaule** — l'accès est gouverné par l'appartenance (choix produit pour
  favoriser l'adoption face à WhatsApp ; la donnée reste en base, propriété de l'entreprise).
- **Fonctionnalités** : messages texte (markdown léger `**gras**` `_italique_` `` `code` `` + liens),
  **@mentions** (autocomplétion → notification), **réactions émoji** (quick + palette), **réponses
  citées** (clic = saut au message), **épinglage** (bandeau), **messages enregistrés/favoris**,
  **modifier/supprimer** ses messages (modération OWNER/ADMIN), **pièces jointes** (Drive chiffré,
  images en aperçu, blob signé HMAC), **présence** (en ligne/absent/hors ligne), **« en train
  d'écrire… »**, **accusés de lecture / non-lus**, **brouillons** (localStorage), recherche, filtres
  (Tous/Non lus/Épinglées), **épingler/sourdine/niveau de notif** par conversation, gestion des
  membres & rôles (OWNER/ADMIN/MEMBER), renommer, quitter, archiver. Optimiste + responsive (mobile :
  bascule liste ↔ fil ; panneau détails plein écran).
- **Sécurité vérifiée (Playwright, 13/13)** : DM bidirectionnel + réaction + groupe + livraison
  croisée + badge non-lus ; **un tiers non-membre reçoit 403** sur `/api/messaging/conversation` et
  `/api/messaging/messages`, et son `typing` est neutralisé. Téléchargement de pièce jointe
  (`/api/messaging/attachment/[id]`) contrôlé par l'appartenance à la conversation.
- **Fichiers** : schéma `Conversation/ConversationMember/Message/MessageReaction/MessageAttachment/
  MessageMention/MessageBookmark` (+ `User.lastSeenAt`) ; `lib/messaging.ts` (accès/présence/signature),
  `lib/queries/messaging.ts` (DTOs + getters), `lib/actions/messaging-actions.ts`, routes
  `app/api/messaging/{sync,messages,conversation,bookmarks,typing,upload,attachment}` ; UI
  `app/(app)/messages/*` (messenger, liste, fil, message, composer, nouvelle conv, détails, format/emoji).
- **Limite assumée** : temps réel par **polling** (pas de WebSocket/SSE) + typing **in-memory**
  (mono-instance) → évolution possible vers SSE/Redis si multi-instance.

---

## 7. Migrations (appliquées en local ; s'appliquent au déploiement Render)

Principales (ordre chronologique) : init → finances → RH/Workspace → sponsoring/avance → ordres de
dépense → Drive → demandes admin → **BD (project/range/product)** → **validation_center_and_feedback** →
**supplier_portal** → **congress_request_workflow** → **regulatory_category_sale_type** → **pch_and_stocks**
→ **messaging** → **medical_specialty_structure** → **employee_hr_documents** → **budget_envelope** → **field_reports** → **events** → **hr_request_types** → **sponsoring_validation_workflow** → **congress_intl_event_type** → **expense_order_budget_revision** → **mail_account** → **medical_info_pharmacist** → **directives** → **support_requests**.

> **hr_request_types** : ajoute `LEAVE_TITLE`, `MISSION_ORDER`, `EXPENSE_REPORT` à l'enum `HrRequestType`
> (`ALTER TYPE … ADD VALUE`). La **fusion de modules** (Finances/Congrès/Logistique-Stocks) est purement
> présentationnelle : **aucune migration**.

> **mail_account** : `MailAccount` (boîte mail Infomaniak par utilisateur — IMAP/SMTP, mot de passe
> d'application chiffré AES-256-GCM). **medical_info_pharmacist** : nouveau rôle
> `MEDICAL_INFO_PHARMACIST`, entité `MEDICAL_INFO_DECLARATION`, enums `MedicalInfoStatus` /
> `DocRequestStatus`, modèles `MedicalInfoDeclaration` + `MedicalInfoDocRequest` (étape de déclaration
> réglementaire intercalée entre la validation définitive de la Direction et l'ordre de dépense).
> **directives** : module `DIRECTIVES`, enum `DirectiveStatus`, entité `DIRECTIVE`, modèles
> `Directive` + `DirectiveMessage` (instructions priorisées Direction → équipes + fil d'échange).
> **support_requests** : module `SUPPORT`, enums `SupportCategory` / `SupportStatus`, entité
> `SUPPORT_REQUEST`, modèles `SupportRequest` + `SupportMessage` (demandes de support adressées au
> directeur médical / chef de produit : question, brochure, document — fil + pièces jointes `Document`).

> L'**Assistant IA / Chatbot** n'ajoute **aucune migration** (pas de changement de schéma : il lit/écrit
> des entités existantes — `Task`, `AdministrativeRequest` — et conserve la conversation côté client).

> Au prochain déploiement Render, `migrate deploy` applique automatiquement celles en attente.

---

## 8. Vérification (commandes)

```bash
# Postgres local (machine de travail uniquement, base jetable — PAS Render)
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/amd_pgdata -o '-p 5432' start"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public"

npx tsc --noEmit                 # typecheck
npm run build                    # build prod
npx vitest run                   # 24 tests (rbac + assistant : RBAC outils, résolution, exécution+audit)
# Smoke runtime : npm run start (prod) + login curl/Playwright, puis nettoyage des comptes tmp-*.
```

**Pièges sandbox connus :**
- `prisma generate` : ajouter `NODE_OPTIONS="--unhandled-rejections=warn"` (un appel réseau de
  télémétrie est coupé par le proxy et faisait planter la génération).
- `npm install …` **élague `playwright-core`** (non listé dans package.json) → le réinstaller
  `--no-save` avant un test Playwright.
- Sortie HTTPS via proxy agent (CA `/root/.ccr/ca-bundle.crt`). `registry.npmjs.org` est en noProxy.

---

## 9. En attente / différé

- **Messagerie e-mail Infomaniak** + **éditeur Office collaboratif** : **bloqués par l'infra** du
  sandbox (IMAP/SMTP non joignables, sidecar Docker incompatible Render-only). À câbler au déploiement.
- **Annotations PDF** (pdf.js) : différé (dépendance/worker à intégrer proprement).
- **Application mobile (PWA / stores)** : **gardé de côté** à la demande. Reco retenue = PWA d'abord
  (installable iOS/Android sans store), puis éventuellement wrapper **Capacitor/TWA** pour les stores ;
  **éviter un rebuild React Native**. L'UI est déjà responsive (tiroir mobile). Manque : manifeste +
  service worker + icônes.

---

## 10. Grand chantier à venir : données de référence (analyse d'architecture)

L'utilisateur va importer dans les prochains jours : **+600 000 produits / 7 800 sociétés pharma**
(certifs, numéros, mails), la **nomenclature algérienne**, **IQVIA 2025 & 2026**, les **achats PCH 2025**.

**Constat clé :** la plateforme est conçue pour des **données opérationnelles** (centaines→milliers de
lignes). Ces datasets sont des **référentiels (master data)** à une **toute autre échelle**. Limites
actuelles à lever **avant** l'import :
1. **`DataTable` est entièrement côté client** (charge toutes les lignes au navigateur) et les requêtes
   sont plafonnées (`take: 200/500`). → Impossible avec 600k.
2. **Recherche globale en `ILIKE %terme%`** (séquentiel) → lente sur 600k sans index trigramme.
3. **Aucun pipeline d'import en masse** (seul l'import CSV des ventes existe) ni **worker/cron**.

**Recommandation (fondation à construire d'abord) :**
- Un espace **« Référentiels »** avec modules dédiés en lecture/recherche : **Fournisseurs Monde**,
  **Produits Monde**, **Nomenclature DZ**, **Marché IQVIA**, **Achats PCH 2025**.
- **Pagination + recherche côté serveur** (index `pg_trgm`/full-text Postgres) en remplacement du
  DataTable client pour les grosses tables.
- **Pipeline d'import par lots** (CSV/Excel streamé, validation, déduplication, mapping, progression) —
  via **worker Render**, pas une server action.
- **Tâches de fond / cron** : imports longs, alertes d'expiration (GMP, AMM, **cautions**), rapports.
- **NE PAS** verser les 600k produits dans le module BD actuel (tableau manuel hiérarchique) — les
  relier au BD à la place.

**La valeur = la connexion :** IQVIA → tailles de marché/scoring BD automatiques ; Nomenclature DZ →
« déjà enregistré ? concurrence ? » pour BD/Regulatory ; Fournisseurs Monde → sourcing BD + choix labo
Regulatory + Portail fournisseur ; Achats PCH 2025 → PCH/Stocks/Ventes/prévisions.

---

## 11. Autres lacunes fonctionnelles identifiées (priorisées)

Reporting/BI consolidé + exports PDF/Excel + rapports planifiés • messagerie e-mail (+ notifications
e-mail/SMS) • **veille des appels d'offres PCH à venir** (le module PCH ne gère que les marchés gagnés) •
suivi des échéances documentaires (GMP/AMM/cautions) avec alertes • contrats/conventions/licences •
objectifs commerciaux vs réalisé • lots & péremptions / qualité ; pharmacovigilance si post-market •
export comptable (G50…) • couverture de tests à renforcer (10 tests unitaires, pas d'E2E auto).

---

## 12. Contraintes opérationnelles permanentes

- Développer **uniquement** sur `claude/hopeful-goodall-phd0nb`. Pas de push ailleurs sans accord.
- **Pas de PR** sauf demande explicite.
- Dépôt GitHub en scope : `aminedjm/regulatory-affairs`.
- Tout doit être **réel et vérifié** (typecheck + build + tests + smoke), **aucune simulation**.
