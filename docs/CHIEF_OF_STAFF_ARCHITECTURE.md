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

### Voix
- **Conversation vocale continue** (`voice-mode.tsx`) : VAD client (RMS + hystérésis), capture à
  la prise de parole, transcription Whisper, MÊME flux SSE que le chat (le texte s'écrit en
  parallèle), réponse PARLÉE phrase par phrase (`/api/assistant/speak`, OpenAI TTS — la voix
  démarre à la première phrase), **barge-in** : parler pendant la réponse coupe la voix, parler
  pendant la réflexion interrompt la génération ; multi-tours. Les actions restent confirmées À
  LA MAIN dans le chat — jamais à la voix.
- **Dictée** (repli) : enregistrer → transcrire → texte éditable avant envoi.

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
NAVIGATEUR  /chief-of-staff (module RBAC) — chat SSE + panneau CONTEXTE + voix (VAD, barge-in)
   │  POST /api/assistant/stream   (SSE : trace, delta, source, reset, done)
   │  POST /api/assistant/transcribe (Whisper)   POST /api/assistant/speak (TTS, phrases)
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

- **Voix** : VAD à seuil d'énergie (pas un modèle neuronal) — un environnement très bruyant peut
  déclencher/gêner l'écoute ; la réponse vocale démarre après la fin de la génération du texte
  (le flux SSE nourrit l'écran en continu, la voix suit par phrases). Nécessite `OPENAI_API_KEY`.
- **Recherche documentaire** : la recherche Drive porte sur les NOMS/chemins + lecture à la
  demande ; les embeddings couvrent le corpus Regulatory (pipeline existant), pas encore tout le
  Drive — l'extension de l'ingestion est le prochain investissement utile si le besoin « retrouve
  par le contenu » se confirme à l'usage.
- **Multi-action** : plusieurs écritures s'enchaînent en plusieurs cartes (une par action) — pas
  encore une carte groupée unique.
- **`update_salary`** modifie la FICHE (base, net, brut, coût employeur) ; la ligne de paie du
  mois se corrige dans RH → Paie (`updatePayrollEntry`, avec bulletin) — voulu : le bulletin est
  une pièce.
- **Anciens enregistrements** : `inspect_record` reste best-effort sur les dossiers d'avant les
  chaînes Legal (« pièce isolée — aucun lien déclaré ») — l'incertitude est dite.

## 8. Checklist de production

- [x] `npx tsc --noEmit` — zéro erreur.
- [x] `npm run lint` — zéro erreur (config `next/core-web-vitals`, motifs maison assumés).
- [x] `npx vitest run` — 2 533+ tests verts (dont sécurité/adversariaux, rappels, recherche).
- [x] `rm -rf .next && npm run build` — build de production propre (cache vidé).
- [x] Migrations idempotentes appliquées (`search_extensions`, `reminder_target_user`,
      `ai_usage_metrics`) — rejouables, jamais bloquantes, compatibles avec l'existant.
- [x] Aucun TODO/FIXME/MOCK/PLACEHOLDER bloquant dans le code du module.
- [x] Variables d'environnement : `ANTHROPIC_API_KEY` (agent), `OPENAI_API_KEY` (voix — Whisper
      + TTS ; sans elle, la voix disparaît proprement, le reste vit).
- [x] Extensions Postgres facultatives (`unaccent`, `pg_trgm`) — sondées à l'exécution.
