# My Chief of Staff — architecture cible et état des lieux

> Le module `/chief-of-staff` (PDG + Super Admin) doit devenir l'interface intelligente centrale
> de l'entreprise : comprendre, rechercher, relier, expliquer, agir — avec preuves et sous
> permissions. Ce document est la carte : ce qui EXISTE déjà (et qu'on ne reconstruit pas), ce que
> la v1 livrée ajoute, et les phases suivantes dans l'ordre où elles paient.

## 1. Cartographie de l'existant — ce qu'on NE reconstruit PAS

L'ERP possède déjà l'essentiel du socle qu'un « AI Chief of Staff » exige. Le réutiliser n'est pas
un raccourci, c'est la condition de cohérence : deux moteurs divergeraient.

| Capacité cible (spec) | Ce qui existe déjà | Où |
|---|---|---|
| Agent loop + tool calling + streaming | Boucle d'agent multi-tours, SSE mot à mot, trace des outils | `lib/assistant.ts` (`runAssistantStream`), `/api/assistant/stream` |
| Tool registry sous permissions | `PowerTool { def, allowed, label, run }` — permission revérifiée serveur À CHAQUE appel | `lib/assistant/power-tools.ts` |
| Action preview + confirmation | `ProposedAction` (carte ACTION/TARGET/CHANGES/CONFIRM), `performAction` revérifie tout | `lib/assistant.ts` |
| Fast path métriques (masse salariale, budget, tréso, décisions en attente) | `read_budget`, `read_compta`, `read_hr_overview`, `read_action_center` — les MÊMES requêtes que les pages | `power-tools.ts` |
| Mémoire utilisateur | Mémoire personnelle cloisonnée par personne | `assistant-memory.ts` |
| Voix (dictée) | Transcription Whisper dans le chat | `/api/assistant/transcribe` |
| Emails | `list_emails` / `read_email` / `send_email` (boîte Graph de l'utilisateur) | `lib/mail/*`, tools assistant |
| Réunions / calendrier | `create_calendar_event` (invités, heure d'Alger) | tools assistant |
| Tâches / demandes / notifications / messages | `create_task`, `create_admin_request`, `create_notification` (pop-up), `send_message` | tools assistant |
| Écritures admin (réglages, Regulatory) | Liste blanche `WRITABLE_SETTINGS` + confirmation | `lib/assistant/admin-write.ts` |
| Exports | `export_excel` borné par les droits de lecture | `lib/assistant/exports.ts` |
| Jobs planifiés sans cron | `runScheduledJobs()` (heartbeat + debounce) — Legal, paie, veille ANPP, batchs IA… | `lib/scheduled.ts` |
| Audit total | `AuditLog` (acteur, entité, avant/après, résumé) sur toutes les écritures | `lib/audit.ts` |
| Recherche RBAC-aware | Recherche globale + palette ⌘K ; recherche Drive avec chemins | `/search`, `lib/queries/drive-search.ts` |
| Recherche sémantique | Embeddings (corpus + réserves Regulatory) | Lot C Regulatory |
| Extraction documentaire | PDF / Word / Excel / PowerPoint / OCR (pipeline CTD éprouvé) | `lib/assistant-files.ts`, `regulatory/intelligence/extract` |
| Cartes structurelles | `ERP_AUDIT.md` (audit exhaustif), Graphify (graphe du code), README (circuits) | racine / `graphify-out/` |

## 2. Ce que la v1 livrée ajoute (ce commit)

- **Module `CHIEF_OF_STAFF`** (RBAC : Super Admin + DIRECTION), entrée « My Chief of Staff »
  (Pilotage, icône couronne), page `/chief-of-staff` — même moteur que l'assistant, persona
  exécutif injecté PAR LE RÔLE côté serveur (`executiveBriefing`), jamais par un drapeau client.
- **`inspect_record`** — l'histoire complète d'un dossier par sa référence : fiche, TIMELINE
  reconstruite depuis le journal d'audit, VALIDATEURS nommés + dates (étapes de validation),
  pièces jointes, chaîne devis→BC→facture→règlement (Legal), état du règlement au centre de
  paiement, LIENS internes. Couvre : demandes de paiement, ordres de dépense, documents Legal,
  matériel promotionnel, demandes du secrétariat.
- **`search_drive` + `read_document`** — fouiller le Drive (chemins + liens) puis LIRE la pièce
  (PDF/Word/Excel/PowerPoint), droit vérifié NŒUD PAR NŒUD.
- **`person_report`** — bilan factuel d'une personne : tâches ouvertes/terminées/en retard,
  demandes, validations rendues, activité au journal. Faits et métriques, jamais de jugement.
- **`plan_reminder` / `list_reminders` / `cancel_reminder`** — « rappelle-moi mardi 10 h »,
  « tous les dimanches relance Regulatory » (récurrence + rôle cible relancé). Modèle
  `AssistantReminder`, balayage dans `lib/scheduled.ts`, pop-up au propriétaire.
- **`decide_payment`** — trancher un paiement au centre (autoriser / refuser / révision /
  argumentation), TOUJOURS derrière la carte de confirmation ; l'exécution repasse par l'action
  du centre (`decidePayment`) — une seule implémentation de la règle.

## 3. AI Capability Matrix (état après v1)

R = lecture outillée · S = recherche · C = création (confirmée) · U = modification (confirmée) ·
A = approbation (confirmée) · ✗ = pas encore outillé (phase indiquée)

| Domaine | R | S | C | U | A | Notes |
|---|---|---|---|---|---|---|
| Budgets / Finances / Tréso | ✔ | ✔ | ✗ (P2) | ✗ | — | `read_budget`, `read_compta` |
| Centre de paiement | ✔ (`inspect_record`) | ✔ | — | — | ✔ `decide_payment` | Niveau SENSITIVE |
| RH (effectif, masse salariale, contrats à échéance) | ✔ | ✔ | ✔ `create_hr_request` | ✗ paie (P2, niveau CRITICAL) | ✗ | |
| Tâches / demandes / projets | ✔ | ✔ | ✔ | ✗ (P2) | — | multi-personnes = N confirmations |
| Regulatory | ✔ | ✔ | — | ✔ `update_regulatory_product` | — | + corpus expert |
| Legal (devis/BC/factures/chaîne) | ✔ `inspect_record` | ✔ | ✗ (P2) | ✗ | — | chaîne d'achat lisible |
| Drive / documents | ✔ `read_document` | ✔ `search_drive` | ✗ (P3 rapport consolidé) | — | — | |
| Emails | ✔ | ✔ | ✔ `send_email` | — | — | boîte de l'utilisateur |
| Réunions / calendrier | ✗ lecture (P2) | — | ✔ | ✗ | — | |
| Notifications / relances | — | — | ✔ (pop-up, rôle, personnes) | — | — | |
| Rappels / récurrences | ✔ | — | ✔ direct (LOW RISK) | ✔ annulation | — | |
| Stocks / hôpitaux | ✗ (P2) | ✗ | ✗ | ✗ | — | modèles prêts (`StockSnapshot`) |
| Réglages plateforme | ✔ | — | — | ✔ (Super Admin) | — | liste blanche |

## 4. Niveaux d'action (implémentés / cibles)

| Niveau | Règle actuelle | Exemples |
|---|---|---|
| READ | outil direct, permission serveur | inspect_record, read_document, person_report |
| LOW RISK WRITE | outil direct, périmètre = soi | plan_reminder, cancel_reminder |
| COMMUNICATION | carte de confirmation | send_email, send_message, create_notification |
| SENSITIVE | carte de confirmation + revérification à l'exécution | decide_payment, update_platform_setting |
| CRITICAL (P2) | confirmation forte (re-saisie du montant / MFA) | paie, salaires, suppressions massives |

Principe intangible : **le LLM ne décide jamais d'un droit** — `allowed` à la proposition, regarde
à l'exécution, et les fonctions métier appelées revérifient une troisième fois (ex.
`decidePayment` → `sitsOnPaymentCentre`).

## 5. Entity map (relations que `inspect_record` parcourt déjà)

```
LegalDocument(QUOTE) ─chainFromId→ LegalDocument(PURCHASE_ORDER) ─chainFromId→ LegalDocument(INVOICE)
      │                                   │                                        │ expenseOrderId
      └── ValidationRequest.steps (validateurs, dates)                              ▼
PaymentRequest ─expenseOrderId→ ExpenseOrder(centralStatus) ← PaymentCentreMessage (fil du centre)
      │                                   │
      └── PaymentPiece / Document         └── FinanceTransaction (règlement effectif)
Toute entité ── AuditLog (timeline) ── Document (pièces) ── Notification / Task / Comment
Employee ── Department ── manager (N+1) ── Task / ValidationStep / AuditLog (bilan personne)
```

Le graphe N'EST PAS matérialisé dans une base à part : les clés étrangères existantes SONT le
graphe, et `inspect_record` les parcourt avec des requêtes bornées. Une couche de graphe
matérialisée (P3) ne se justifiera que si la traversée multi-sauts devient trop lente.

## 6. Phases suivantes (dans l'ordre où elles paient)

- **P2 — élargir le registre d'outils** : lecture stocks/hôpitaux, lecture calendrier, création
  Legal (déclarer un devis/BC/facture depuis la conversation), modification de tâches/demandes,
  paie (niveau CRITICAL avec confirmation forte), relances multi-personnes en un geste (une carte
  par destinataire), timeline sur les autres entités (recrutement, congés, courriers).
- **P3 — recherche & documents** : étendre les embeddings du corpus Regulatory à TOUT le Drive
  (ingestion : parse → OCR → chunk → embed, le pipeline existe), recherche hybride
  (lexical + vectoriel + métadonnées), `search_everything` fédéré, rapport consolidé (« regroupe
  tout sur le contrat X » → dossier + DOCX généré, le générateur DOCX existe côté Regulatory).
- **P4 — voix temps réel** : conversation vocale live (VAD, barge-in) — service à part qui parle à
  l'orchestrateur existant ; la dictée actuelle reste le repli. Ne pas mettre le raisonnement
  lourd dans le modèle temps réel.
- **P5 — proactivité & caches** : détecteurs (facture sans BC, dossier sans activité, promesse non
  tenue) branchés sur `scheduled.ts` + Adventum Pulse existant ; agrégats précalculés avec
  invalidation événementielle pour les KPIs exécutifs ; daily executive brief (le « point du
  matin » existe — l'enrichir).
- **P6 — observabilité IA** : latence par outil, coûts par modèle (le suivi `AiUsageLog` existe),
  taux de correction utilisateur, dataset d'évaluation (les 17 tests d'acceptation de la spec +
  questions réelles), tests adversariaux de permissions.

## 7. Budget de performance (cibles)

| Type | Cible | Voie |
|---|---|---|
| Métrique simple (masse salariale, budget) | < 2 s | fast path : power tool → SQL direct, pas de fouille |
| inspect_record | < 4 s | requêtes bornées, parallèles |
| Recherche Drive | < 3 s | index nom + chemins précalculés |
| Lecture d'un document | < 6 s | extraction en flux, texte plafonné (9 000 car.) |
| Investigation profonde | streaming immédiat, enrichissement progressif | multi-outils en parallèle (P2) |
| Action confirmée | < 2 s après confirmation | réutilise l'action métier existante |
