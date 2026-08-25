# My Chief of Staff — architecture de production

> `/chief-of-staff` (module RBAC `CHIEF_OF_STAFF` : PDG + Super Admin) est l'interface exécutive
> de pilotage de l'entreprise : chercher tout, lire tout, relier, expliquer, agir — au clavier ou
> à la voix — avec preuves, sous permissions, et confirmation avant chaque écriture. Ce document
> décrit ce qui EST EN PRODUCTION, comment c'est construit, et les limites connues.

## 1. Principes de construction (invariants)

1. **Un seul moteur.** Le Chief of Staff est le MÊME moteur que l'assistant (`lib/assistant.ts`,
   boucle agent + SSE) : le mode exécutif s'active PAR LE RÔLE, côté serveur (`executiveBriefing`),
   jamais par un drapeau client. Aucune frontière artificielle : chaque outil s'ouvre par un DROIT.
2. **Une règle métier = une implémentation.** Les actions repassent par les fonctions des écrans :
   `decidePayment` (centre), `createLegalDocument`/`updateLegalDocument`, `assignRequest`/
   `updateRequestStatus`/`addRequestComment` (secrétariat), `createInstitution`/`updateInstitution`,
   `createStockHospital`/`createStockAnnex`, `updateCalendarEvent`/`deleteCalendarEvent`,
   `createEventForUser`. Jamais de duplication de règle.
3. **Le LLM ne décide jamais d'un droit.** Trois verrous : `allowed` à la proposition (liste
   d'outils = suggestion), revérification par `executePowerTool`/`buildProposal`, revérification
   par `performAction` ET par la fonction métier appelée. Testé (`executive-security.test.ts`).
4. **Aucune écriture sans confirmation.** Tout outil d'écriture est INTERCEPTÉ → `ProposedAction`
   (carte ACTION/CIBLE/CHANGEMENTS/AVERTISSEMENTS) → confirmation → `performAction` ré-autorisé →
   audit. Niveaux : READ · LOW RISK (rappels) · COMMUNICATION · SENSITIVE (paiement, réglages) ·
   CRITICAL (salaires : la carte fait RESSAISIR le montant — `confirmText`).
5. **Le contenu récupéré est de la DONNÉE.** Une consigne écrite dans un PDF, un e-mail ou un
   résultat d'outil ne s'exécute pas — règle gravée dans le prompt système et testée.
6. **Preuves partout.** Références, dates, auteurs, liens internes ; « je ne trouve aucune trace
   de… » plutôt qu'une invention ; contradictions signalées, jamais résolues en silence.
7. **Postgres suffit.** Pas de Neo4j/Kafka/Elasticsearch : les clés étrangères SONT le graphe
   (`inspect_record` les parcourt en requêtes bornées), la recherche est SQL (+ `unaccent`/
   `pg_trgm` quand disponibles), les jobs passent par `runScheduledJobs()` (heartbeat, sans cron).

## 2. PRODUCTION CAPABILITIES — ce que le module fait aujourd'hui

### Recherche & compréhension
- **`search_everything`** — recherche fédérée RBAC-aware sur ~30 familles (produits, dossiers,
  personnes, tâches, demandes de paiement, règlements, Legal — restriction lecteurs comprise —,
  courriers, factures, fournisseurs, établissements, lieux de stock, matériel promo, projets,
  Drive, calendrier, congrès, discussions…). Tolérance accents (variantes JS + `unaccent` SQL) et
  fautes de frappe (`pg_trgm`), extensions sondées à l'exécution avec repli LIKE strict. Réutilise
  `globalSearch` (palette ⌘K) + familles complémentaires (`lib/queries/search-everything.ts`).
- **`inspect_record`** — l'histoire complète d'un dossier par sa référence : demande de paiement,
  règlement, document Legal (avec CHAÎNE devis→BC→facture→règlement, validateurs nommés et
  datés), matériel promo, demande du secrétariat, dossier Regulatory (étapes, chargé du dossier),
  facture Finances, courrier (pièces, accusé), projet délégué, tâche. Timeline reconstruite du
  journal d'audit, pièces jointes, liens cliquables ; « aucune trace » explicite sinon.
- **`search_drive` + `read_document`** — fouille du Drive (droit vérifié NŒUD PAR NŒUD) puis
  lecture réelle (PDF/Word/Excel/PowerPoint/OCR via le pipeline CTD, `extractAttachmentText`).
- **Pièces jointes du chat** — Excel/PPT/Word/PDF déposés ou référencés du Drive, lus avant de
  répondre (« compare-moi ces trois devis »).

### Lectures transverses (ouvertes par le DROIT de l'écran correspondant)
`read_calendar` (réunions, participants) · `find_free_slot` (créneau commun, vue globale) ·
`read_stock` (derniers relevés par produit × lieu, seuil critique) · `search_hospitals` (annuaire
médical + lieux de stock) · `read_employee` (fiche RH sans rémunération) · `read_payroll`
(salaire actuel + 6 mois, masse salariale d'un mois — RH uniquement) · `search_courriers` ·
`finance_totals` (agrégats CÔTÉ BASE : total payé à X, période vs période, détail mensuel) ·
`read_budget` / `read_finances` / `read_hr_overview` / `list_pending_decisions` (fast paths).

### Actions (toutes confirmées, toutes auditées)
`decide_payment` (SENSITIVE — centre de paiement) · `update_task` (réassigner, échéance,
priorité, statut, commentaire) · `update_request` (secrétariat, via les actions du module) ·
`create_legal_document` / `update_legal_document` (déclarer un devis/BC/facture et le CHAÎNER ;
la modification relit la fiche et n'écrase que le demandé) · `update_calendar_event` (déplacer /
annuler) · `create_hospital` (lieux de stock — Super Admin, la règle de l'écran — ou annuaire
médical) / `update_hospital` · **`update_salary` (CRITICAL)** : lire `read_payroll` d'abord, carte
avant/après/écart %, re-saisie du montant, verrou de fraîcheur à l'exécution (si la fiche a bougé
entre la carte et le clic, refus) · + tout le socle : create_task, create_admin_request,
create_dossier, send_message, send_email, create_calendar_event, create_congress_request,
create_hr_request, create_sponsoring_request, create_event_request, create_promo_material_request,
create_notification (pop-up), update_platform_setting, update_regulatory_product,
set_products_company, export_excel.

### Pilotage proactif
- **`executive_alerts`** (`lib/assistant/proactive.ts`) — détecteurs avec criticité
  (CRITICAL/IMPORTANT/WATCH/INFO), preuve et lien : paiement en attente au centre (>3 j / >7 j),
  révision/argumentation sans suite, validation en souffrance, tâche critique en retard, facture
  sans BC chaîné, BC >30 j sans facture, contrat expirant sous 30 j, dossier Regulatory sans
  activité 60 j, stock épuisé/très bas, demande de paiement sans décision.
- **`executive_brief`** — « fais-moi mon point » : à décider (validations + paiements au centre
  avec total), risques, réunions, finance, RH — assemblé en parallèle depuis les MÊMES requêtes
  que les pages. Planifiable : `plan_reminder` DAILY 08:00 + lien `/chief-of-staff` (le point du
  matin proactif existe déjà à l'ouverture de la page).
- **`create_report`** — « regroupe-moi tout sur le contrat X » : .docx consolidé (fiche, chaîne,
  validateurs, règlement, pièces, timeline) déposé dans le Drive personnel (« Rapports IA »),
  nom + lien rendus. Génération synchrone (quelques secondes) — pas de faux « travail en fond ».

### Planification
`plan_reminder` / `list_reminders` / `cancel_reminder` — « mardi 10 h », « dans 3 heures »,
« tous les dimanches relance Regulatory » (rôle) ou « relance Nesrine » (personne nommée,
résolue à la création), « chaque premier lundi du mois » (`MONTHLY_WEEKDAY` : même Nième jour de
semaine, repli sur la dernière occurrence des mois courts). Balayage dans `lib/scheduled.ts`
(état d'abord, notifications ensuite ; rattrapage borné d'un serveur éteint). Heure d'Alger
(UTC+1 sans été). Pop-up au propriétaire + relance du rôle et/ou de la personne.

### REALTIME VOICE — PRODUCTION (speech-to-speech)

**Modèle & provider.** `gpt-realtime-2.1` (surclassable par `OPENAI_REALTIME_MODEL`), via
l'API Realtime OpenAI. L'implémentation est encapsulée derrière l'interface
`VoiceRealtimeProvider` (`app/(app)/assistant/realtime-voice.ts` — implémentation actuelle
`OpenAIGptRealtime21Provider`) : AUCUNE logique métier n'est couplée au modèle — un futur
moteur (type gpt-live) se branche en réimplémentant cette interface, rien d'autre.

**Transport.** WebRTC, navigateur ↔ OpenAI EN DIRECT : le média ne transite pas par notre
backend. Micro capturé UNE fois par session (`getUserMedia` : echo cancellation, noise
suppression, auto gain) ; la réponse arrive en piste audio distante, jouée en continu
(streaming — on entend le début avant la fin de la génération). Les événements (transcriptions,
tours, outils, erreurs) passent par le data channel « oai-events ».

**Auth.** `OPENAI_API_KEY` ne quitte JAMAIS le serveur. `POST /api/assistant/voice/session`
vérifie authentification + siège exécutif + module CHIEF_OF_STAFF + assistant activé
(`canUseRealtimeVoice`), configure la session CÔTÉ SERVEUR (modèle, instructions, outils,
transcription, détection de tour) via l'endpoint officiel `/v1/realtime/client_secrets`, et ne
rend au client qu'un SECRET ÉPHÉMÈRE (10 min) — le client ne peut ni élargir les outils ni
réécrire les instructions.

**Une seule conversation.** L'appel CONTINUE le fil texte : la session s'ouvre sur le fil
courant (ou le fil principal), les derniers échanges sont injectés BORNÉS dans les
instructions (« et son salaire ? » comprend Khaled du mode texte), chaque tour vocal
(transcriptions) est persisté dans le MÊME fil par la MÊME porte (`rememberExchange` →
distillation de mémoire comprise) via `POST /api/assistant/voice/turn`. Le texte tapé PENDANT
l'appel entre dans la session vocale (réponse parlée). Instructions : `buildChiefOfStaffContext`
(la MÊME fonction que le texte, variante compacte — identité, contexte, règles de fond
anti-injection) + contexte personnel/mémoire + consignes vocales (réponse d'abord, 5-20 s,
pas de tableau lu, jamais « c'est fait » sans confirmation, pas de re-salutation).

**Outils.** Adaptateur PowerTool → schéma Realtime (`realtimeToolsFor`) : ~25 FAST PATHS
(search_everything, employee_360, read_payroll, inspect_record, find_documents, plan_reminder,
company_state…) — LE MÊME outil que le texte, filtré par les droits du compte — plus
`delegate_to_chief_of_staff` pour tout le reste : ACTIONS (l'orchestrateur texte `runAssistant`
rend des PROPOSITIONS → cartes de confirmation À L'ÉCRAN, rien d'exécuté à la voix seule ;
CRITIQUE = re-saisie, comme en texte) et ANALYSES PROFONDES (le raisonnement lourd reste dans
le moteur existant — le modèle vocal est le système nerveux conversationnel, pas le cerveau).
Chaque appel d'outil revient sur `POST /api/assistant/voice/tool` (authentifié) où
`executePowerTool` RE-VÉRIFIE le droit ; résultats bornés (~8 K) pour le budget de session ;
liens internes extraits vers le panneau CONTEXTE (compagnon visuel : la voix résume, l'écran
affiche).

**Interruptions.** Détection de tour SÉMANTIQUE côté serveur (`semantic_vad`,
`interrupt_response: true`) — silences et hésitations gérés par l'API, pas un VAD maison ; à la
prise de parole le client vide EN PLUS le tampon local (`output_audio_buffer.clear`) : le son
s'arrête net, aucun buffer périmé n'est rejoué, la nouvelle consigne prime.

**UI — mode appel** : la session vocale vit dans un provider GLOBAL du layout
(`components/layout/call-provider.tsx` — contexte React, cycle de vie, minuterie, transcript,
cartes, pont vers le chat) ; l'écran d'appel (`voice-mode.tsx` → `CallScreen`) est purement
présentationnel : orbe à états (écoute / réflexion / parole / muet), mute, raccrocher,
transcript SECONDAIRE (dernière réplique + fil sur demande). États machine :
IDLE/CONNECTING/LISTENING/USER_SPEAKING/THINKING/ASSISTANT_SPEAKING/RECONNECTING/ERROR/ENDED.
Reconnexion : chute WebRTC → nouveau secret éphémère, MÊME fil (2 tentatives), jamais une
nouvelle conversation. Échec d'ouverture → message clair + la DICTÉE proposée en repli
explicite (jamais présentée comme du temps réel).

### PREMIUM LIVE EXPERIENCE — « je suis au téléphone avec mon Chief of Staff »

**Le bouton téléphone.** Sur `/chief-of-staff`, l'icône TÉLÉPHONE ouvre l'appel temps réel
(« Appeler My Chief of Staff ») ; le micro reste la DICTÉE — deux gestes, deux intentions,
jamais confondus. Le bouton n'apparaît qu'aux détenteurs de la voix temps réel.

**Interface d'appel.** Mobile : PLEIN ÉCRAN (safe areas, gros boutons — Mute / Raccrocher /
Clavier). Desktop : modal immersif, clic hors carte = réduire. En-tête « MY CHIEF OF STAFF »,
pastille « ● LIVE » et MINUTERIE : le chrono démarre à la CONNEXION RÉELLE (premier état
d'écoute) et s'arrête au raccrochage — jamais de « Live » si la session n'est pas réellement
connectée (CONNECTING affiche « Connexion… », RECONNECTING « Reconnexion… »).

**L'appel est GLOBAL.** Monté dans le layout (`CallProvider`), il SURVIT à la navigation :
ouvrir une fiche, le Drive, un tableau — la conversation continue. Réduit = carte flottante
(état, durée, mute, restaurer, raccrocher) au-dessus de la barre mobile. Échap RÉDUIT (jamais
raccrocher accidentel) ; raccrocher coupe le média mais PRÉSERVE conversation, transcript et
actions ; Mute coupe le micro sans fermer la connexion, l'état est affiché.

**TYPE — écrire dans l'appel.** Le bouton Clavier ouvre un VRAI champ de saisie DANS l'appel :
le texte entre dans la MÊME session (l'IA peut répondre à l'oral). Le champ de la page fait
pareil pendant un appel actif : tout est UNE conversation, quel que soit le canal.

**Cartes live.** Pendant que la voix RÉSUME, l'écran AFFICHE : chaque outil qui lit un dossier
pousse sa carte (libellé + lien) dans le bandeau de l'appel — toucher une carte réduit l'appel
et ouvre la page (la conversation continue). De retour dans le chat, sources et propositions
sont réinjectées dans le panneau CONTEXTE (tamponnées si le chat était démonté).

**Contexte d'écran — sans espionnage.** JAMAIS de capture d'écran : uniquement la ROUTE et la
RÉFÉRENCE de la fiche. À l'ouverture, le client envoie le contexte (`screenContext`, borné à
300 caractères côté serveur) → bloc « CONTEXTE D'ÉCRAN » dans les instructions ; en cours
d'appel, chaque navigation pousse un item système compact (« l'utilisateur consulte /legal/… »)
— « ça », « ce dossier » se résolvent sans répéter la référence. **Appel depuis une fiche** :
« Appeler » (fiche Legal, demande de paiement) → `/chief-of-staff?call=1&ref=…` — l'appel
démarre avec le dossier en contexte, « où ça bloque ? » se résout dès la première seconde.

**Travail parallèle.** Les appels d'outils ne se sérialisent plus : une délégation lourde
(analyse, livrable) part en tâche de fond pendant que les questions rapides continuent de
recevoir leurs réponses — une seule réponse vocale active à la fois (discipline
`response.create` sur `response.done`), mais plusieurs outils en vol.

**Résumé d'appel.** Au raccrochage : durée, sujets abordés, cartes/documents affichés, outils
consultés, nombre d'actions PROPOSÉES (« rien d'exécuté sans confirmation ») — des FAITS,
aucune action créée — persisté dans le fil par la même porte que tout tour
(`rememberExchange`). Reprendre l'appel plus tard ne re-salue pas : la conversation continue.

**TIME TRAVEL** (`lib/assistant/time-travel.ts`, outil `time_travel`) — « où en était ce
dossier au 1ᵉʳ juin ? » : reconstruction de l'état PASSÉ depuis le journal d'audit — valeur des
champs à la date (dernière écriture avant / valeur remplacée juste après), événements déjà
survenus, ce qui a changé DEPUIS, état actuel en face (le « avant / maintenant » d'un coup
d'œil), étapes ANPP à la date pour un dossier Regulatory. STRICTEMENT LECTURE SEULE, à la
demande seulement ; l'outil DIT ce que le journal ne capture pas. Dossier créé après la date →
« n'existait pas encore », jamais un état inventé.

**CAPABLE ≠ EXÉCUTÉ — les familles d'intentions.** Le principe qui gouverne tout :
- **ASK / FIND / SHOW / EXPLAIN / COMPARE / ANALYZE / SIMULATE / TIME_TRAVEL / BRIEF** —
  lectures immédiates, aucune écriture, exécutées à la demande ;
- **PREPARE / GENERATE** (brouillons, livrables) — à la demande explicite, jamais envoyés
  automatiquement ;
- **REMIND / MONITOR / SCHEDULE** — uniquement sur demande explicite (« rappelle-moi… ») ;
- **ACT** — la politique d'actions complète (cartes de confirmation, niveaux, re-saisie).
La voix peut SUGGÉRER (« je peux aussi te préparer le comparatif ») — une suggestion, puis
elle ATTEND « fais-le ». Rien ne se déclenche seul : « it does nothing operationally unless
the CEO asks or confirms ».

### MAXIMUM INTELLIGENCE AT MAXIMUM SPEED — fast + smart, jamais l'un contre l'autre

Le principe : **ne jamais échanger l'intelligence contre la vitesse** — gagner les deux par
l'architecture. Le calcul déterministe fait ce qu'il sait faire parfaitement (états, délais,
chronologies) ; le modèle garde son budget de raisonnement pour ce qui demande vraiment de
l'intelligence ; et quand l'enjeu monte, on AJOUTE du calcul — on n'en retire jamais.

**États exécutifs précalculés** (`lib/assistant/executive-state.ts`) — « precompute
intelligence, not only data » : « où en est Pembro ? » ne répond pas « étape 6 » mais, D'UN
SEUL appel d'outil : étape courante et sa responsable, **BLOQUEUR dérivé** (étape bloquée /
pièces manquantes / retard / validateur en attente), **jours dans l'étape**, prochaine
échéance, prochaine étape attendue, dernier mouvement, **signaux** (étape en retard, silence
> 30 j, priorité haute qui n'avance pas, cible dépassée). Fonctions PURES calculées sur des
données que les outils lisent déjà — zéro requête ajoutée, zéro latence ajoutée. Branché en
PREMIÈRE clé de `product_360` (`syntheseExecutive`) et d'`inspect_record`
(`etatExecutif` sur paiement et règlement : QUI bloque, depuis combien de jours, prochaine
étape du circuit). Chaque champ est dérivé d'une donnée tracée — « aucun bloqueur tracé »
se dit, il ne s'invente pas.

**Raisonnement parallèle** — les appels d'outils d'un même tour du modèle s'exécutent en
`Promise.all` (texte streaming ET non-streaming ; la voix l'avait déjà) : trois lectures de
800 ms coûtent 800 ms, pas 2,4 s. Le prompt système enseigne la DÉCOMPOSITION (« analyse
Regulatory et dis-moi si je dois recruter » = charge + retards + effectif + coûts +
dépendances lancés ENSEMBLE, puis une synthèse) — et l'expansion INTELLIGENTE du contexte :
sources les plus probables d'abord, élargir seulement si la confiance est insuffisante,
s'arrêter quand une lecture de plus ne changerait ni la conclusion ni la confiance.

**Discipline de preuve** (règles de fond communes texte + voix) — qualifier quand l'enjeu le
mérite : FAIT VÉRIFIÉ / FAIT DÉRIVÉ / ESTIMATION / HYPOTHÈSE / INCONNU (« une excellente
réponse n'est pas celle qui paraît sûre — c'est celle qui sait précisément ce qu'elle
sait ») ; **hiérarchie d'autorité des sources par TYPE de donnée** (salaire actuel : paie >
avenant signé > contrat > vieux document > e-mail > mémoire — la mémoire ne remplace JAMAIS
la source métier) ; **contradiction** : jamais choisir une source en silence — chronologie
d'abord (un avenant explique souvent l'écart), sinon « j'ai une incohérence à signaler »
avec les deux valeurs. Détection DÉTERMINISTE en plus du prompt : l'écart devis → facture
d'une même chaîne d'achat est calculé (`amountDrift`) et signalé dans `inspect_record`
(`incoherences`).

**Profondeur adaptative + seconde passe critique** (`lib/assistant/reasoning.ts` +
`lib/assistant.ts`) — la profondeur suit l'ENJEU, pas la longueur de la question :
`isHighStakesQuestion` détecte (déterministe) une décision demandée, une recommandation, une
réorganisation, un recrutement, un montant en millions. Alors la conclusion substantielle est
RELUE par le même modèle en adversaire de sa propre analyse (hypothèse la plus fragile,
preuve contradictoire, explication alternative, manque décisif, chiffre non sourcé) puis
remise RÉVISÉE — un appel de plus quand ça compte, jamais un modèle de moins. En flux, le
brouillon déjà diffusé est une vraie réponse progressive ; la version relue le remplace
(`reset`) et l'étape se DIT dans la trace (« Relecture critique de la conclusion »). La
chaîne de critique n'est JAMAIS exposée ; en cas d'échec du second appel, le brouillon est
rendu — la passe ajoute, elle ne retire jamais.

**Continuité sémantique** — `conversationWorkingSet` extrait des derniers tours (fenêtre
large : 60) les ENTITÉS ACTIVES (références ERP réelles + termes cités « entre guillemets »),
les plus récentes d'abord, bornées à 8 — injectées dans le prompt texte ET les instructions
vocales : « et le fournisseur ? », « pourquoi ? », « fais pareil pour Nivo » se résolvent
sans relancer toute la compréhension.

**Voix — deux vitesses, réponse progressive** : la couche conversationnelle temps réel donne
IMMÉDIATEMENT le fait fiable disponible (« le blocage immédiat est Regulatory — je vérifie la
cause exacte ») pendant que la couche d'intelligence (délégation, lectures parallèles)
travaille ; la réponse se complète quand le résultat arrive. Jamais de silence artificiel,
jamais une invention pour meubler : tout ce qui est dit avant la fin d'une analyse est sûr,
qualifié, révisable.

### HARDENING — analyse des pannes réelles (root cause → fix → test)

Quatre défauts observés lors d'un appel réel de production sont devenus des invariants testés.

**FAILURE A — mémoire des demandes** (« je t'avais demandé quelque chose à Redouane ? » →
« aucune trace », minutes après la préparation d'une notification).
*Cause racine* : la proposition d'action ne vivait que dans l'UI — aucun objet structuré ; la
recherche sémantique du transcript ne suffisait pas.
*Correctif* : **AssistantActionIntent** — CHAQUE proposition (texte, voix via délégation,
nudge) est persistée avec un état canonique ; le bloc « ACTIONS RÉCENTES » est injecté dans le
prompt texte ET les instructions vocales ; l'outil **`action_history`** (fast path vocal) est
LA source de vérité pour « déjà demandé ? / c'est envoyé ? / qu'est-ce que je t'ai demandé
aujourd'hui ? » — et l'absence de trace y est FIABLE (rien proposé sur la période).
*Tests* : `action-intents.test.ts` (« FAILURE A »), `voice-realtime.test.ts` (« FAILURE A/B »).

**FAILURE B — état des actions** (« Message envoyé à Khaled » puis « je ne peux pas confirmer
l'envoi »). *Cause racine* : le modèle RACONTAIT l'exécution ; aucun état serveur unique.
*Correctif* : machine d'état SERVEUR unique — PROPOSED → CONFIRMED → EXECUTING → EXECUTED
(ou FAILED / CANCELLED / EXPIRED), transitions journalisées (`events` = historique
d'autorisation). Le serveur est l'AUTORITÉ : l'exécution passe par une **réclamation
atomique** (`updateMany` gardé par statut — un retry / double-clic / reconnexion ne renvoie
JAMAIS deux messages : l'action déjà EXÉCUTÉE rend son reçu d'origine) ; le payload exécuté
est celui STOCKÉ à la proposition, pas celui renvoyé par le client ; l'annulation UI transite
aussi par le serveur (`cancelAssistantAction`). Reçu canonique : ACTION EXECUTED (message,
lien, horodatage) vs ACTION PREPARED — NOT EXECUTED. Règle de fond (texte + voix) : ne JAMAIS
dire « envoyé » sans un état EXÉCUTÉE ; ne jamais dire « aucune trace » sans avoir consulté
l'état.
*Tests* : `action-intents.test.ts` (idempotence, concurrence, annulation, cloisonnement).

**FAILURE C — sémantique métier** (« les événements » compris uniquement calendrier).
*Cause racine* : résolution mot à mot, sans le vocabulaire interne.
*Correctif* : bloc **VOCABULAIRE MÉTIER** partagé texte + voix — résolution PAR LE CONTEXTE
(« en attente de règlement » → sponsoring / prises en charge / congrès ; « demain » →
calendrier), polysémies internes (fiche, BC, DE, le centre, règlement), alias appris par la
mémoire (`remember`), rapprochement PHONÉTIQUE des noms transcrits (« Radia Kebir » ↔ « Radio
Kibir ») contre le personnel RÉEL — jamais une nouvelle entité inventée d'un mot déformé.
Principe général (« contextual intent resolution »), pas une table mot → module.
*Tests* : `voice-realtime.test.ts` (« FAILURE C »).

**FAILURE D — faux barge-in** (la réponse se coupait sur clavier / toux / porte ; cascades de
« (intervention vocale) », préambules répétés, contexte pollué).
*Cause racine* : `interrupt_response: true` + purge du tampon au PREMIER `speech_started` —
le moindre faux positif du VAD annulait la réponse. Corrigé au niveau AUDIO/VAD, pas au prompt.
*Correctif* : **barge-in CONFIRMÉ** (`voice-tuning.ts` + provider) — `interrupt_response:
false` par défaut ; un début de signal pendant que l'assistant parle ouvre une fenêtre
d'évaluation : des MOTS transcrits confirment immédiatement (un vrai « Stop. » reste rapide),
une parole SOUTENUE (≥ 400 ms) confirme, un signal bref sans mots est IGNORÉ (la réponse
continue). Confirmation → `response.cancel` + `output_audio_buffer.clear` +
`conversation.item.truncate` (le contexte serveur ne compte pas comme « entendu » ce qui n'a
jamais été joué). Le transcript n'est PAS la vérité terrain : un artefact sans lettres n'entre
ni dans le fil, ni dans la mémoire, ni dans les entités (`isNoiseTranscript`). VAD pilotée par
l'environnement pour le benchmark réel (`OPENAI_VOICE_VAD_MODE` semantic_vad|server_vad,
`OPENAI_VOICE_VAD_EAGERNESS`, `OPENAI_VOICE_VAD_THRESHOLD`/`PREFIX_MS`/`SILENCE_MS`,
`OPENAI_VOICE_INTERRUPT=server` pour l'A/B). Métriques jumelles tracées :
`voice_false_barge_in_ignored` (compteur) et `voice_barge_in_confirmed` (latence) — LOW FALSE
INTERRUPTION + FAST TRUE INTERRUPTION s'optimisent ENSEMBLE. Consignes voix : pas de préambule
répété après interruption, recherche EN SILENCE, terminer par la réponse (pas de
« veux-tu que je… » systématique).
*Tests* : `voice-tuning.test.ts` (golden faux/vrai barge-in, filtre de bruit, config VAD).
*Limite honnête* : le comportement au micro réel (clavier, toux, voiture, Bluetooth) se valide
sur l'environnement déployé — la matrice de tests est dans la recette README.

### GOD MODE — la couche cognitive finale (primitives générales, pas de question codée en dur)

Le test n'est pas « les exemples du prompt marchent-ils ? » mais « une question NOUVELLE
peut-elle être résolue avec les primitives disponibles ? ». Les primitives, et où elles vivent :

- **Comprendre / résoudre le contexte** — vocabulaire métier contextuel, working set (entités
  actives), alias mémorisés, résolution phonétique (prompts + `reasoning.ts`) ;
- **Planifier / paralléliser / approfondir** — bloc PROFONDEUR & VITESSE + AUTO-CONTRÔLE
  implicite (entité résolue ? donnée fraîche ? sources en conflit ? historique en jeu ?),
  outils en `Promise.all`, seconde passe critique sur fort enjeu ;
- **Chercher / lire partout** — `search_everything`, `search_drive`, `find_documents` avec
  **ingestion Drive planifiée** (`drive-ingestion.ts` : un paquet par passage, extraction +
  **classification déterministe** `drive-classify.ts` — contrat de travail, facture, devis,
  BC… ; filtre `kind` ; index-témoin pour l'illisible ; ACL revérifiée à la recherche nœud
  par nœud ; débrayage `ASSISTANT_DRIVE_INGESTION=off`) — un document MAL NOMMÉ jamais ouvert
  se retrouve par son CONTENU ;
- **Relier / reconstruire** — `inspect_record` (chaînes devis→BC→facture→règlement),
  `product/supplier/employee_360`, `organization/process_insights` ;
- **Temporel** — `time_travel` (état passé), **`what_changed`** (« qu'est-ce qui a changé
  depuis lundi ? » / « remets-moi à niveau » : changements SIGNIFICATIFS tracés + QUI a agi +
  étapes franchies + état actuel en face — `what-changed.ts`) ;
- **Mémoire** — conversation persistée, mémoire typée (alias, préférences — jamais source de
  vérité métier), ActionIntents canoniques, **`episodic_recall`** (fédéré : actions + rappels
  + décisions + engagements + livrables — « qu'est-ce qu'on a fait/décidé ? » sans transcript) ;
- **Vérifier / réconcilier** — hiérarchie d'autorité des sources, règle de contradiction +
  écart devis→facture calculé, taxonomie FAIT VÉRIFIÉ/DÉRIVÉ/ESTIMATION/HYPOTHÈSE/INCONNU ;
- **Simuler / challenger / recommander** — `simulate_scenario` (jamais mutatif), critique
  adversariale, `ceo_attention`, briefing sur demande ;
- **Agir si autorisé seulement** — ACTION_POLICY, cartes de confirmation, machine d'état
  ActionIntent, kill-switch, RBAC revérifié à chaque appel, contenu = donnée jamais instruction.

*Limites restantes, dites* : pas de couche SQL sémantique arbitraire (les agrégats passent par
les outils validés — une question analytique hors outils reçoit un refus honnête) ; pas d'index
vectoriel du Drive (lexical replié + classification — l'infra embeddings existe côté corpus et
pourra s'étendre) ; le graphe d'entités est LOGIQUE (FK + chaînes + 360), pas un graphe
matérialisé ; « depuis notre dernière discussion » exige que le modèle fournisse la date (le
fil récent la donne).

**Benchmark qualité × latence** — ne jamais optimiser le seul TTFT. Deux étages :
1. **Golden queries déterministes** (`lib/assistant/golden-queries.test.ts`, CI) : sur les
   vraies questions du PDG (« où en est Pembro ? », « pourquoi est-il bloqué ? », « qui est
   responsable ? », « où est le paiement ? »), la couche déterministe doit livrer bloqueur /
   délais / prochaine étape / signaux EN UN APPEL — figé par test.
2. **Mesure en conditions réelles** (environnement déployé, clé active) : dérouler le corpus
   de questions golden (« quel âge a Khaled ? », « combien coûte Regulatory ? », « est-ce que
   je dois recruter ? », « de qui dépend-on trop ? », « qu'est-ce que je dois décider
   aujourd'hui ? »…) et lire `AiUsageLog` : `ttftMs` (premier mot), `latencyMs` (réponse
   complète), `turns`, `toolCalls`, `toolErrors`, `toolLatencyMs` — en face d'une évaluation
   HUMAINE de l'exactitude, des preuves citées et de l'utilité de la recommandation. Une
   amélioration de latence qui dégrade la qualité est un ÉCHEC ; l'objectif est le produit
   QUALITÉ × LATENCE.

**Observabilité.** Logs structurés serveur (`voice_session_created/connected/error`,
`voice_tool_called/completed`, `voice_reconnect`, `voice_session_closed` — reasonCode, latences,
jamais de contenu audio) + `AiUsageLog` (fonction `voice_realtime`, provider openai : durée de
session, premier audio entendu = ttftMs, tours, outils, erreurs) + carte d'état dans
Administration → IA (modèle affiché).

- **Dictée** (repli explicite, distinct du temps réel) : enregistrer → transcrire
  (`/api/assistant/transcribe`) → texte éditable avant envoi. L'ancienne chaîne
  « VAD maison → Whisper → SSE → TTS phrase par phrase » est SUPPRIMÉE
  (route `/api/assistant/speak` et `synthesizeSpeech` retirées).

### REALTIME VOICE RELIABILITY — les deux pannes bloquantes (root cause → fix → test)

Deux comportements observés en appel réel, corrigés À LA RACINE dans le pipeline d'événements
du provider (`app/(app)/assistant/realtime-voice.ts`) — pas dans les prompts, pas par des
timeouts arbitraires. Les scénarios sont REJOUÉS sur le vrai `handleEvent` (canal stubbé,
timers simulés) dans `lib/assistant/voice-pipeline.test.ts`.

**BUG 1 — « Je vais analyser… » puis silence infini (le résultat existait, personne ne le
disait ; « Alors ? » le faisait apparaître).**
- *Root cause 1 — l'intention de réponse était un tir unique.* Le résultat d'outil posait le
  `function_call_output` puis envoyait UN `response.create` et oubliait. Le suivi client
  (`activeResponse` booléen) courait derrière les réponses AUTO-créées par la VAD serveur
  (`create_response: true`) : quand notre create heurtait une réponse auto en cours de
  création, le serveur répondait `conversation_already_has_active_response` — et le handler
  d'erreur affichait un message SANS jamais replanifier. L'intention était perdue ; le
  résultat restait dans la conversation jusqu'à ce qu'une parole du PDG (« Alors ? »)
  auto-crée une réponse qui, elle, le voyait. → *Fix :* PROPRIÉTÉ DE LA RÉPONSE. Chaque
  function call crée une **obligation de restitution** (`PendingDelivery` :
  WAITING_TOOL → READY → DELIVERING) qui ne s'éteint que lorsqu'une réponse identifiée
  (`response.created` → `response.done`, suivie PAR ID) s'est terminée en ayant réellement
  PARLÉ. L'erreur codée replanifie (la réponse active couvrira, son `created` absorbe
  l'attente) au lieu de perdre. → *Test :* « collision avec la réponse AUTO de la VAD ».
- *Root cause 2 — aucun rattrapage si le create se perdait.* → *Fix :* **watchdog
  déterministe** (`deliveryWatchdogAction`, module pur) : « dépendances complètes ET aucune
  réponse en cours ET l'utilisateur ne parle pas ET grâce écoulée → relancer » — jamais un
  `setTimeout(() => speakResult(), 2000)`. Relances plafonnées (3) puis abandon HONNÊTE :
  l'échec est dit (onError) et le résultat est PERSISTÉ dans le fil. → *Tests :* « create
  perdu », « échec terminal ».
- *Root cause 3 — le piège de l'accusé muet.* Une réponse pouvait se « terminer » sans un mot
  (status completed, zéro transcript, zéro audio) : rien ne le détectait. → *Fix :* une
  réponse porteuse d'obligations qui se termine muette est détectée
  (`silent_completion_detected`), un rappel système explicite est posé (UNE fois) et la
  réponse est relancée. → *Test :* « le piège de l'accusé muet ».
- *Root cause 4 — résultat pendant la parole de l'utilisateur.* Un `response.create` partait
  en pleine phrase du PDG (parler par-dessus, ou collision avec la réponse auto de fin de
  tour). → *Fix :* RESULT_READY — l'output est posé, la création est retenue tant que
  l'utilisateur parle (`USER_SPEAKING` ou fenêtre de barge-in ouverte) ; la fin de SON tour
  déclenche la réponse (VAD auto, absorbée par `created`), le watchdog rattrape un commit qui
  n'arrive jamais. → *Test :* « RESULT_READY pendant que l'utilisateur parle ».
- *Root cause 5 — session terminée pendant le job.* `send()` dans un canal mort ne fait rien :
  le résultat s'évaporait. → *Fix :* tout résultat que la voix ne peut plus restituer
  (raccroché pendant l'analyse, restitution en échec terminal, résultats prêts au moment du
  raccrochage) est remis au FIL de conversation (`persistOrphanResult` → `/api/assistant/voice/turn`,
  `keepalive`) et au chat s'il est monté. → *Tests :* « session terminée », « échec terminal ».
  *Limite honnête :* si l'ONGLET est fermé pendant le job (pas seulement l'appel), le fetch
  du délégué meurt avec lui — ce cas exigerait une persistance côté serveur du résultat de
  délégation, non faite pour ne pas dupliquer chaque analyse dans le fil.
- *Exactly-once :* une obligation est portée par UNE réponse identifiée ; livrée = éteinte
  (metric `pending_turn_delivered` avec latence job→voix) ; une réponse annulée par le PDG
  la remet DUE sans double restitution ; le tour restitué se nomme
  « (restitution d'une analyse terminée) » — plus jamais « (intervention vocale) ».

**BUG 2 — interruptions fantômes « (intervention vocale) » persistantes.**
- *Root cause 1 — la durée seule confirmait un barge-in.* `sustained ≥ 400 ms` coupait la
  réponse même sans un mot transcrit — or pendant que le HAUT-PARLEUR joue, l'écho de la
  propre voix de l'assistant (AEC imparfaite, haut-parleur ouvert) est précisément un
  « signal de parole soutenu ». → *Fix :* AUTO-PROTECTION ÉCHO dans `bargeInDecision`
  (module pur) : haut-parleur ACTIF (`output_audio_buffer.started` sans stop) → seuls des
  MOTS transcrits confirment, un signal sans mots est ignoré quelle que soit sa durée ;
  haut-parleur MUET (réflexion — aucune source d'écho) → la durée soutenue confirme encore.
  Un « Stop. » réel reste rapide (deltas de transcription en quelques centaines de ms), et
  une transcription LENTE est rattrapée par la **confirmation tardive** : transcription
  finale avec mots pendant la MÊME réponse → coupure immédiate. → *Tests :* « golden
  fantôme », « vraie interruption », « haut-parleur muet », « confirmation tardive ».
- *Root cause 2 — événements périmés.* Après un cancel, les deltas de transcript, le
  transcript final et les événements de tampon audio de la réponse ANNULÉE continuaient
  d'arriver : texte fantôme dans le tour suivant, état rebasculé en ASSISTANT_SPEAKING.
  → *Fix :* chaque événement de contenu est LIÉ à sa réponse (`response_id`) — réponse
  marquée annulée (marqueur qui SURVIT au done, borné à 8) ou différente de l'active →
  ignoré (`stale_event_ignored`). → *Test :* « événements périmés ».
- *Root cause 3 — segments non identifiés.* Un delta de l'ANCIEN segment de parole pouvait
  confirmer la fenêtre d'un nouveau ; un même souffle pouvait produire deux confirmations.
  → *Fix :* la fenêtre d'évaluation est liée au SEGMENT (`item_id` de `speech_started`) ;
  un delta d'un autre segment ne confirme pas ; un segment déjà confirmé ne rouvre rien
  (debounce, borné). → *Tests :* « ancien segment », « debounce » (dans « vraie
  interruption »).
- *Root cause 4 — la pièce silencieuse.* Un bruit committé par la VAD auto-créait une réponse
  (« Oui ? ») et l'item de bruit restait dans la conversation (pollution de contexte, dérive
  de langue). → *Fix :* transcription finale = bruit (`isNoiseTranscript`) → l'item est
  SUPPRIMÉ (`conversation.item.delete`) et la réponse auto est annulée SI elle n'a encore
  rien joué et ne porte aucune restitution (`phantom_response_cancelled`) — une restitution
  en cours passe toujours avant l'hygiène du bruit. → *Tests :* « pièce silencieuse »,
  « le bruit n'annule jamais une restitution ».

**Observabilité & SLO** (journal `/api/assistant/voice/log`, résumé à `voice_session_closed`) :
- *SLO 1 — fiabilité de restitution ≈ 100 %* : `deliveriesReady` vs `deliveriesDone`
  (+ `voice_pending_turn_delivered` avec latence job→voix par restitution) ; les rattrapages
  se lisent (`voice_silent_completion`, `voice_watchdog_recovered`) et l'échec terminal est
  compté ET persisté (`voice_delivery_failed`).
- *SLO 2 — taux de fausses coupures ≈ 0* : `interruptions`/`bargeInLatencyMs` (les vraies)
  contre `falseBargeInsIgnored`, `phantomCancels`, `staleEventsIgnored`.
- Recette terrain (micro réel, non simulable en CI) : pièce calme 60 s → 0 intervention ;
  analyse déléguée puis silence → la voix restitue SEULE ; « Attends » en pleine phrase →
  coupure immédiate ; clavier/toux pendant la réponse → la voix ne s'arrête pas.

### UI
- Deux volets sur grand écran : conversation + **panneau CONTEXTE** (sources consultées — chaque
  dossier lu devient un lien au moment où l'outil le lit, via les événements SSE `source` —,
  actions du fil avec leur état, raccourcis). Mobile : conversation plein écran.
- **Entrée contextuelle** : `/chief-of-staff?ref=…` ou `?q=…` pré-remplit la question ; bouton
  « Demander au Chief of Staff » sur la fiche Legal et la fiche demande de paiement (rendu aux
  seuls détenteurs du module).
- Cartes d'action typées par niveau (CRITICAL rouge + re-saisie ; SENSITIVE ambre), trace des
  lectures, streaming mot à mot, interruption de génération, historique de conversations
  (mémoire strictement personnelle), suggestions.

### Observabilité
`AiUsageLog` enrichi par requête de l'assistant : latence totale, **TTFT** (délai avant le
premier mot), tours modèle↔outils, appels d'outils, erreurs d'outils, temps total passé dans les
outils — ce qui distingue « le modèle est lent » de « une requête SQL est lente ». Routage de
modèles existant (palier qualité / palier éco, `AI_MODEL` / `AI_MODEL_CHEAP`).

### Executive AI Operating System (lots A–F)

**Gouvernance des actions** (`lib/assistant.ts`, `lib/assistant/admin-write.ts`) —
`ACTION_POLICY` : registre typé `Record<AssistantActionKind, {external, level}>` (une action non
déclarée ne compile pas) ; **ARRÊT D'URGENCE** `aiExternalActionsDisabled` (AppSetting, réglable
par `update_platform_setting`) : coupe TOUTES les actions externes ET les relances de rappels —
les lectures et le pop-up au propriétaire continuent. **Confirmation groupée** : plusieurs
écritures dans le même tour = une carte par action + « Tout confirmer » (les CRITIQUES restent à
confirmer une à une, re-saisie comprise). **Surveillance conditionnelle** : `plan_reminder`
+ `watch_reference` relit l'entité à l'échéance — réglée : le dit et s'éteint ; en attente :
prévient LE PROPRIÉTAIRE SEUL (surveiller ≠ relancer).

**Mémoire & registres exécutifs** (`memory-context.ts`, `memory-tools.ts`,
`assistant-memory.ts`) — mémoire TYPÉE (`AssistantMemoryItem` : préférences, style, terminologie,
ALIAS, priorités, principes) : `remember`/`list_memories`/`forget_memory`, alias re-retenu = mis
à jour, injection BORNÉE dans le contexte, expansion d'alias dans `search_everything`
(« pembro » → Pembrolizumab), garde-fou « la mémoire n'est JAMAIS la source de vérité d'une
donnée métier ». **Fil principal** (`AssistantThread.isPrimary`) : une conversation continue par
personne, ouverte d'office, plafonnée aux 300 derniers messages ; `recall_conversation` fouille
SES archives. **Registre des décisions** (`ExecutiveDecision`) : contexte, options écartées,
attendu, relecture, puis résultat RÉEL et leçons — enregistrer n'exécute rien.
**Engagements** (`ExecutiveCommitment`) : qui a promis quoi pour quand, preuve ; un retard
remonte en alerte (`commitment_overdue`) — AUCUNE relance automatique.

**Vues 360° & insights** (`three-sixty.ts`) — `employee_360` (âge/ancienneté CALCULÉS au backend
avec leur source, contrat, salaire si module RH seulement, activité OBSERVÉE cadrée « absence de
trace ERP ≠ absence de travail », indicateurs de dépendance), `product_360`, `supplier_360`
(dépenses payées PAR ANNÉE calculées en base), `organization_insights` (étendues de contrôle,
départements sans responsable/adjoint, concentration des validations), `process_insights`
(délais RÉELS 180 j, cas clos seulement : moyennes/médianes + pires cas référencés).

**Découverte documentaire** (`document-discovery.ts`, `DriveTextIndex`) — `find_documents` pour
le Drive « sale » : métadonnées + INDEX TEXTUEL PROGRESSIF (le texte extrait à chaque lecture,
replié sans accents) + lecture bornée de vérification. Confiance HAUTE/MOYENNE/FAIBLE, preuve
citée, droits Drive revérifiés nœud par nœud. « Le nom d'un fichier est un indice, pas une
preuve. »

**Simulation & état d'entreprise** (`what-if.ts`) — `simulate_scenario` (SALARY_CHANGE,
DEPARTURE, HEADCOUNT_CHANGE, CASH_TREND) : JAMAIS MUTATIF, hypothèses DITES, confiance
FAIBLE/MODÉRÉE, « DONNÉES INSUFFISANTES » plutôt qu'une courbe inventée. `company_state` :
l'état consolidé par DROIT (une section fermée est dite fermée). `ceo_attention` : DOIT DÉCIDER /
DEVRAIT SAVOIR / SURVEILLER — peu d'éléments, bien choisis. Bandeau « Aujourd'hui » sur
`/chief-of-staff` : quatre compteurs bon marché, cliquables, disparaissent à zéro.

**Livrables universels** (`deliverables.ts`, `AssistantArtifact`) — `draft_deliverable` : de
VRAIS .docx/.xlsx/.pptx (style maison) depuis UNE spec structurée ; format ALL = les trois
fichiers de la même spec (chiffres identiques par construction) ; cellules numériques réelles
dans Excel ; PPT sans mur de texte (puces bornées, diapos « suite ») ; section Sources
obligatoire ; dépôt Drive « Livrables IA » ; registre versionné (`artifact_id` → v2) ;
`list_artifacts`.

**Corpus de connaissance** (`corpus-tools.ts` sur l'infra `regulatory/intelligence/corpus`) —
catégories (Droit du travail, Droit fiscal, ANPP, MIPH, Marchés publics/PCH…), textes ARABES
découpés par المادة comme les français par Article, langue à l'ingestion.
`search_knowledge_corpus` (hybride FTS+trigrammes+sémantique, citations texte/article/version),
`read_corpus_document` (l'article exact), `list_corpus_sources` (l'inventaire ET le manque).
Corpus muet sur un sujet → « pas encore suffisamment de sources vérifiées » — jamais un article
inventé.

**Anomalies** (`proactive.ts`) — le backend DÉTECTE à règle DITE, le modèle explique : facture
candidate au doublon (même contrepartie + même montant sous 45 j), montant inhabituel (≥ 4× la
médiane payée au bénéficiaire, min. 3 paiements de référence).

## 3. Matrice de capacités finale

R = lecture outillée · S = recherche · C = création · U = modification · A = approbation ·
(tout C/U/A est confirmé + audité) · ✗ = non outillé, avec sa raison.

| Domaine | R | S | C | U | A | Notes |
|---|---|---|---|---|---|---|
| Budgets / Finances / Tréso | ✔ | ✔ | ✗¹ | ✗¹ | — | `read_budget`, `read_finances`, `finance_totals` |
| Centre de paiement | ✔ | ✔ | — | — | ✔ `decide_payment` | SENSITIVE |
| Demandes de paiement | ✔ `inspect_record` | ✔ | ✗² | — | — | |
| RH — fiche / effectif | ✔ `read_employee` | ✔ | ✔ `create_hr_request` | — | — | |
| RH — paie / salaires | ✔ `read_payroll` | — | — | ✔ `update_salary` (CRITICAL) | — | fiche employé ; la paie mensuelle reste dans RH → Paie |
| Tâches | ✔ | ✔ | ✔ | ✔ `update_task` | — | réassigner, clore, rouvrir, commenter |
| Demandes du secrétariat | ✔ | ✔ | ✔ | ✔ `update_request` | — | via les actions du module |
| Regulatory | ✔ (étapes, chargé) | ✔ | — | ✔ `update_regulatory_product` | — | + corpus expert ANPP |
| Legal (devis/BC/factures/contrats) | ✔ chaîne complète | ✔ | ✔ `create_legal_document` | ✔ `update_legal_document` | — | chaînage à la pièce amont |
| Drive / documents | ✔ `read_document` | ✔ + fédérée | ✔ `create_report` (.docx) | — | — | ACL nœud par nœud |
| Emails | ✔ | ✔ | ✔ `send_email` | — | — | boîte de l'utilisateur |
| Calendrier / réunions | ✔ + `find_free_slot` | ✔ | ✔ | ✔ `update_calendar_event` | — | déplacement, annulation |
| Stocks | ✔ `read_stock` | ✔ | ✗³ | ✗³ | — | relevés datés — la saisie reste à l'écran |
| Hôpitaux / établissements | ✔ | ✔ `search_hospitals` | ✔ `create_hospital` | ✔ `update_hospital` | — | deux référentiels |
| Courriers | ✔ `inspect_record` | ✔ `search_courriers` | ✗⁴ | — | — | |
| Rappels / relances | ✔ | — | ✔ | ✔ annulation | — | rôle ET/OU personne nommée |
| Notifications | — | — | ✔ (pop-up) | — | — | Super Admin |
| Réglages plateforme | ✔ | — | — | ✔ (Super Admin, SENSITIVE) | — | liste blanche |
| Annuaire praticiens | ✔ | ✔ | — | — | — | cloisonnement par annuaire respecté |

Justification des ✗ (des choix, pas des oublis) :
¹ Une écriture comptable naît d'un règlement, d'une facture ou d'un transfert de paie — des
  circuits qui portent leurs pièces et leurs contrôles à l'écran ; une écriture « dictée » sans
  pièce serait un trou dans la comptabilité.
² La demande de paiement naît dans Validations avec ses PIÈCES (facture, bon…) — le dépôt de
  fichiers est le cœur du geste, il se fait à l'écran (l'assistant sait y envoyer :
  `create_admin_request` type PAYMENT pour la demande simple).
³ Un relevé de stock est une CONSTATATION sur le terrain (module Stocks, demande d'état à une
  personne) — le dicter inventerait un chiffre.
⁴ Un courrier naît avec son pli scanné (Drive → « Classer en courrier ») — même logique de pièce.

## 4. Architecture (couches)

```
NAVIGATEUR  /chief-of-staff (module RBAC) — chat SSE + panneau CONTEXTE + MODE APPEL
   │  POST /api/assistant/stream   (SSE : trace, delta, source, reset, done)
   │  VOIX : POST /api/assistant/voice/session (secret éphémère) → WebRTC DIRECT ↔ OpenAI
   │         Realtime (gpt-realtime-2.1) ; outils → POST /api/assistant/voice/tool (RBAC) ;
   │         tours → POST /api/assistant/voice/turn (même fil) ; métriques → …/voice/log
   │  POST /api/assistant/transcribe (dictée — repli explicite)
   ▼
BOUCLE AGENT  runAssistantStream (lib/assistant.ts) — MAX 16 tours, métriques (TTFT, outils)
   │  systemPrompt = persona + contexte + powerToolsBriefing + executiveBriefing (PAR LE RÔLE)
   ├─ LECTURES  executeReadTool → executePowerTool (allowed REVÉRIFIÉ à chaque appel)
   │    power-tools.ts (budget, finances, RH, décisions)
   │    executive-tools.ts (search_drive, read_document, inspect_record, person_report, rappels)
   │    executive-read-tools.ts (search_everything, calendrier, stocks, hôpitaux, paie, courriers, agrégats)
   │    executive-brief-tools.ts (executive_alerts, executive_brief, create_report)
   ├─ ÉCRITURES  interceptées → buildProposal (garde + résolution + carte) → CLIENT confirme
   │    → executeAssistantAction (« use server ») → performAction (RE-garde) → ACTION MÉTIER
   │    → AuditLog (acteur, entité, avant/après, « via l'assistant »)
   ▼
DONNÉES  Prisma/PostgreSQL (+ unaccent, pg_trgm en option) · Drive chiffré (blobs) ·
         runScheduledJobs() (rappels, échéances Legal…) · AiUsageLog (observabilité)
```

## 5. Performance

| Voie | Mécanisme | Cible |
|---|---|---|
| Métrique simple (masse salariale, budget) | fast path : power tool → SQL direct | < 2 s |
| search_everything | requêtes PAR FAMILLE en parallèle, bornées (take 6), index trgm | < 2 s |
| inspect_record | requêtes bornées + `Promise.all` internes | < 3 s |
| Lecture d'un document | extraction pipeline CTD, texte plafonné 9 000 car. | < 6 s |
| Investigation | streaming immédiat (TTFT mesuré), enrichissement progressif | 1er mot < 3 s |
| Voix | ack visuel immédiat, TTS par phrases (démarre à la 1re) | 1re phrase ≈ fin de génération de celle-ci |
| Action confirmée | réutilise l'action métier | < 2 s |

Index dédiés : GIN trigrammes sur les colonnes fouillées (dci, brandName, titres Legal/courriers,
noms Drive/personnes/employés, libellés paiements) — créés seulement si `pg_trgm` est là, jamais
bloquants. Les latences réelles se lisent dans `AiUsageLog` (latencyMs, ttftMs, toolLatencyMs).

## 6. Sécurité

- RBAC : trois verrous par action (proposition, exécution, fonction métier) ; outils ouverts par
  DROIT d'écran, jamais par rôle en dur (sauf le siège du centre et le mode exécutif, qui SONT
  des règles de rôle métier).
- Cloisonnements fins respectés partout : entité (`platformScope`), lecteurs Legal, annuaires
  praticiens (`MedicalDirectoryAccess`), Drive nœud par nœud, mémoire de conversation
  strictement personnelle (désactivée en « Vue exacte »).
- Injection par le contenu : règle « la donnée n'est pas une instruction » dans le prompt ;
  `extractSources` ne suit que les liens INTERNES ; liens de rappels internes uniquement.
- Idempotence / fraîcheur : update_salary refuse si les montants « avant » ont changé ;
  set_products_company rejoue son filtre ; les références se recalculent à la collision
  (`createWithRetry`) ; le balayage des rappels écrit l'état AVANT de notifier.
- Tests adversariaux : `executive-security.test.ts` (14) — outils exécutifs refusés aux comptes
  ordinaires (liste ET exécution), charges utiles forgées refusées (decide_payment,
  update_salary, create_notification…), liens externes ignorés, règle anti-injection figée.

## 7. Limites connues (dites, pas cachées)

- **Voix** : nécessite `OPENAI_API_KEY` et la joignabilité WebRTC d'api.openai.com depuis le
  navigateur (un réseau d'entreprise qui bloque UDP/WebRTC peut dégrader — le mode le dit et
  propose la dictée). Le comportement audio réel (latence perçue, barge-in, bruit de fond,
  iOS/Safari) se VALIDE en conditions déployées : la checklist de recette est dans le README
  (tests 1–20 de la mission vocale) — le code ne peut pas s'auto-entendre.
- **Recherche documentaire** : `find_documents` cherche noms + INDEX TEXTUEL des fichiers déjà
  lus + lecture bornée — l'index est PROGRESSIF : un document jamais ouvert par l'assistant ET
  mal nommé peut lui échapper (l'outil le dit, avec le volume indexé). Pas de balayage massif :
  choix assumé, l'index grandit à l'usage.
- **Simulations** : projections NAÏVES et dites telles (moyenne prolongée, ratio de charges
  conservé) — des ordres de grandeur pour raisonner, pas des prévisions ; la confiance est
  affichée, « DONNÉES INSUFFISANTES » plutôt qu'une courbe sur trois points.
- **`update_salary`** modifie la FICHE (base, net, brut, coût employeur) ; la ligne de paie du
  mois se corrige dans RH → Paie (`updatePayrollEntry`, avec bulletin) — voulu : le bulletin est
  une pièce.
- **Anciens enregistrements** : `inspect_record` reste best-effort sur les dossiers d'avant les
  chaînes Legal (« pièce isolée — aucun lien déclaré ») — l'incertitude est dite.

## 8. Checklist de production

- [x] `npx tsc --noEmit` — zéro erreur.
- [x] `npm run lint` — zéro erreur (config `next/core-web-vitals`, motifs maison assumés).
- [x] `npx vitest run` — 2 565+ tests verts (dont sécurité/adversariaux, kill-switch, mémoire,
      360°, découverte documentaire, livrables rouverts et relus, simulation zéro-écriture,
      corpus arabe/catégories).
- [x] `rm -rf .next && npm run build` — build de production propre (cache vidé).
- [x] Migrations idempotentes appliquées (`search_extensions`, `reminder_target_user`,
      `ai_usage_metrics`, `ai_governance`, `executive_memory`, `drive_text_index`,
      `assistant_artifacts`, `corpus_categories`) — rejouables, jamais bloquantes.
- [x] Aucun TODO/FIXME/MOCK/PLACEHOLDER bloquant dans le code du module.
- [x] Variables d'environnement : `ANTHROPIC_API_KEY` (agent), `OPENAI_API_KEY` (voix temps
      réel + dictée ; sans elle, la voix disparaît proprement, le reste vit),
      `OPENAI_REALTIME_MODEL` (optionnelle — défaut `gpt-realtime-2.1`),
      `OPENAI_TRANSCRIBE_MODEL` (optionnelle — transcription de session, défaut
      `gpt-4o-mini-transcribe`).
- [x] Extensions Postgres facultatives (`unaccent`, `pg_trgm`) — sondées à l'exécution.
