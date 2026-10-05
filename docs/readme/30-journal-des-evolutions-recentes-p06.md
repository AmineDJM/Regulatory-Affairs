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
- **Brief avant réunion** (`pre_meeting_brief`) : la réunion + les points OUVERTS avec chaque participant, à TROIS NIVEAUX appris par Teach Adam (LIGHT : tâches ouvertes ; STANDARD : + notes et actions de la dernière réunion, décisions, engagements ; CHIEF_OF_STAFF : + historique, personnes, dossiers, décisions à obtenir, risques, contradictions, engagements en retard, questions ouvertes, suivi — §32) — cloisonné à VOS réunions (organisateur ou invité).
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
