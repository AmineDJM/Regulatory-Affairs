# ADAM INFORMATION FABRIC — audit, architecture, chantier

> Objectif produit : que le problème ne soit plus jamais « où est l'information ? » mais
> seulement « qu'est-ce qu'elle signifie et quelle décision faut-il prendre ? ». L'information
> vient à Adam ; Adam ne court plus après l'information.

Ce document est vivant : la section AUDIT dit ce qui EXISTE au moment où le chantier commence
(mesuré dans le code, pas supposé), la section ARCHITECTURE dit la cible, la section CHANTIER
tient l'état exact de chaque tranche — GAP / IMPLEMENTED / WIRED / TESTED / PROVEN. « PROVEN »
n'est écrit qu'après une mesure réelle, jamais après un test local seul.

---

## A. AUDIT INITIAL (2026-08-28, HEAD `0dd67c7`)

### Infrastructure réelle — les contraintes qui décident

| Composant | État |
|---|---|
| Hébergement | Render, **un seul service web** `runtime: node` (pas de worker séparé, pas de GPU) |
| Base | PostgreSQL Render managé — la SEULE brique d'état partagé |
| `pg_trgm` | **DISPONIBLE et déjà utilisé** (migration `20260824210000_search_extensions`, création tolérante) |
| `unaccent` | **DISPONIBLE** (même migration, sondée à l'exécution) |
| `pgvector` | **INDISPONIBLE** sur cette infra — constaté, contourné par vecteurs JSONB 512d + cosinus mémoire |
| Redis / OpenSearch / Kafka / graph DB | **ABSENTS** — aucun service annexe provisionné |
| Tâches de fond | `src/lib/scheduled.ts` : battement `setInterval` DANS le process web (pas de cron) |

Conséquence assumée (§6 du mandat : la meilleure architecture, pas la plus compliquée) : la
fabric se construit sur **Postgres poussé à fond** (FTS tsvector+GIN, trigrammes, index
d'expression, agrégats set-based), **caches en processus estampillés** (pattern déjà éprouvé
dans `semantic-drive.ts`), et le **battement existant** pour tout le travail d'avance de phase.
Introduire Redis/OpenSearch sans service pour les porter serait de l'architecture de papier.

### Ce qui EXISTE déjà, composant par composant

Grille : EXISTE ? · WIRED (branché en prod) ? · INDEXÉ ? · INCRÉMENTAL ? · CACHE ? · GOULOT ?

| Composant | État mesuré |
|---|---|
| **Ingestion Drive** (`assistant/drive-ingestion.ts`) | EXISTE, WIRED (battement). 3 phases : jamais-indexés ≤ 8 Mo → ré-index si version changée → vectorisation du backlog. Index-témoin sur illisible (pas de boucle). INCRÉMENTAL par version (`DriveTextIndex.versionId`). |
| **Extraction texte** (`assistant-files.ts` + OCR CTD) | EXISTE, WIRED. PDF/DOCX/XLSX/PPTX/CSV natifs ; OCR + vision en repli (pipeline CTD). |
| **Classification doc** (`drive-classify.ts`) | EXISTE, WIRED. Déterministe (nom = indice 1 pt, contenu = preuve 3 pts, 12 natures, « unknown » honnête) → `DriveTextIndex.docKind`, indexé. |
| **Index de contenu** (`DriveTextIndex`) | EXISTE : `text` 20 k chars, `textFold` (minuscules sans accents), `docKind`, `embedding` JSONB. **GOULOT n° 1 : `textFold` est fouillé par `contains` (LIKE %…%) SANS AUCUN INDEX** — scan séquentiel du corpus entier à chaque `find_documents` / retrieval corpus. |
| **Recherche par noms** | INDEXÉE : GIN trigrammes sur 10 colonnes (DciProduit, brandName, DriveNode.name, LegalDocument.title, MailEntry.title, User/Employee, PaymentRequest, ExpenseOrder). `search_everything` sonde les extensions et replie proprement. |
| **Recherche fédérée** (`queries/search-everything.ts`) | EXISTE, WIRED. Toutes familles, RBAC par famille identique aux écrans, accents/fautes via unaccent+trgm. Pas de pagination profonde, pas de rang unifié inter-familles. |
| **Sémantique** (`semantic-drive.ts`, `corpus/semantic.ts`) | EXISTE, WIRED en REPLI de `find_documents` (confiance « SENS »). Cosinus EN MÉMOIRE sur JSONB avec cache estampillé — tient à l'échelle actuelle, ne tiendra pas à 100 k docs (chargement de tous les vecteurs). |
| **Entités canoniques** | PARTIEL. Produit = `RegulatoryProduct` (clé étrangère partout, fusion des catalogues faite). Personnes = annuaire interne avec provenance. Organisations : `entity-normalize.ts` (sigles, graphies, decisive/ambiguous/none — jamais de fusion muette). **GAP : aucun lien PERSISTÉ document ↔ entité** — « tout ce qui mentionne le Pembrolizumab » = re-recherche texte à chaque fois. |
| **Vues 360** | EXISTE, WIRED : product_360/employee_360/supplier_360/pch_market_status + états exécutifs PRÉCALCULÉS PURS (`executive-state.ts`) en première clé. Calculées à la demande (SQL ciblé) — pas persistées ; latence dominée par le nombre de requêtes, pas re-mesurée récemment. |
| **Graphe** | Graphify = graphe du CODE (architecture), PAS un graphe métier. Le « graphe d'entreprise » réel est le schéma relationnel + les liaisons transverses (BC↔facture↔règlement, Drive↔Legal↔Courriers) — traversées ad hoc par outil (`chainOf`, `investigate_event` 8 sources parallèles). |
| **What changed** (`what-changed.ts`) | EXISTE, WIRED (EXEC). Diff `AuditLog` depuis une date, qui a agi, état actuel en face. Niveau JOURNAL, pas niveau champ avant/après. |
| **Bus d'événements** (`platform/event-bus.ts`) | EXISTE : 17 faits, abonnés isolés, mémoire bornée, rejeu. Change-feed Adam branché (`change-feed.ts`). |
| **Routeur / planner requête** (`context/router.ts`, `reasoning.ts#queryPlan`) | EXISTE, WIRED, PUR (motifs, zéro modèle) : 5 classes de route, 11 domaines, working set, suivi elliptique. |
| **Liste courte d'outils** (`tool-shortlist.ts`, `rollout.ts`) | EXISTE, WIRED, avec garde de régression et corpus houdout. |
| **Caches** | En processus uniquement : cache sémantique estampillé, mémo divers. **GAP : aucune stratégie déclarée (clé de version, invalidation), aucun cache de précalcul persisté.** |
| **Fraîcheur** | PARTIELLE : `DriveTextIndex.updatedAt`, `AiUsageLog`, change-feed. **GAP : aucune réponse ne sait dire « données synchronisées jusqu'à HH:MM ».** |
| **Registre de sources** | PARTIEL et ÉPARS : `recovery-registry.ts` (greniers de recours missions), `TOOL_DOMAINS` (77 outils classés), `investigation.ts` (8 sources codées en dur). **GAP : aucun registre central disant fraîcheur / coût / modes de recherche / autorité / preuve négative par source.** |
| **Exécution massive** | Mission Runtime : ordonnanceur par classes de ressources, éventail, idempotence. **GAP : pas de primitive BULK (N ids → 1 appel physique) ; un éventail de 1 000 lectures = 1 000 appels.** |
| **Benchmarks retrieval** | `semantic-drive.test.ts` (Recall sur fixtures), golden-queries. **GAP : aucun banc de LATENCE P50/P95 sur la recherche.** |

### Les goulots, classés par levier réel

1. **Contenu sans index** — chaque recherche de contenu paie un scan séquentiel. C'est le seul
   endroit où la latence croît LINÉAIREMENT avec le corpus. Levier : FTS Postgres + trigrammes
   sur `textFold` (index d'expression, zéro changement de schéma applicatif).
2. **Aucun lien persisté document ↔ entité** — « tout sur X » re-paie l'extraction à chaque
   question. Levier : extraction d'entités À L'INGESTION (les canoniques existent), table de
   mentions indexée.
3. **Sources non déclarées** — le planner de mission et le recours devinent où chercher.
   Levier : Source Registry central typé (fraîcheur, modes, autorité, preuve négative).
4. **Sémantique en mémoire intégrale** — chargement de tous les vecteurs à chaque repli.
   Levier : pré-filtrage lexical/entités avant cosinus ; à terme candidats bornés par index.
5. **Pas de bulk** — N logiques = N physiques dans les éventails de mission.

---

## B. ARCHITECTURE CIBLE (adaptée à CE dépôt)

```
                          ADAM (conversation, voix, missions)
                                        │
                 queryPlan (PUR, existant) + Source Registry (F3)
                                        │
        ┌───────────────────┬───────────┴───────────┬────────────────────┐
        │  RECHERCHE HYBRIDE│      ENTITÉS + LIENS  │   HOT / PRÉCALCUL  │
        │  F2 : FTS + trgm  │  F4 : mentions        │  F5 : états 360    │
        │  + sémantique en  │  persistées à         │  persistés +       │
        │  repli (existant) │  l'ingestion          │  fraîcheur         │
        └───────────────────┴───────────┬───────────┴────────────────────┘
                                        │
                    INGESTION INCRÉMENTALE (existante, battement)
                    extraction → classification → entités → index → embed
                                        │
            ERP (Prisma) · Drive · Corpus · Courriers · Legal · PCH · RH · Finance
```

Décisions technologiques (§6, chacune avec sa raison) :

| Technologie | Décision | Pourquoi |
|---|---|---|
| Postgres FTS (tsvector + GIN, config `simple`) | **RETENUE** (F2) | Le contenu est déjà REPLIÉ (`textFold`) ; `simple` évite le stemming hasardeux sur un corpus FR/EN/AR mêlés ; index d'expression = zéro migration de schéma applicatif ; c'est LE levier linéaire→logarithmique. |
| `pg_trgm` sur le contenu | **RETENUE** (F2) | Accélère les `contains` EXISTANTS (LIKE %…%) sans toucher au code appelant — la ceinture pendant que la FTS devient la voie principale. |
| `pgvector` | **REJETÉE (indisponible)** | Constaté absent sur l'infra ; le pattern JSONB + cosinus borné reste, avec pré-filtrage. |
| Redis / Valkey | **REJETÉE (pour l'instant)** | Un seul process web : un cache en processus estampillé rend le même service sans réseau ni service à opérer. À réévaluer si multi-instance. |
| OpenSearch / Meilisearch / Typesense | **REJETÉE** | Postgres FTS + trgm couvre le besoin mesuré à cette échelle ; un moteur externe = un service de plus, une synchro de plus, une panne de plus. |
| Graph DB (Neo4j / AGE) | **REJETÉE** | Le graphe métier EST le schéma relationnel ; les traversées utiles se font en SQL par clés étrangères. Une table de mentions indexée (F4) donne le « relié à X » sans second système. |
| Kafka / NATS / CDC | **REJETÉE** | Le bus en mémoire + AuditLog + battement couvrent le besoin d'un monolithe mono-process. |
| Vues matérialisées / tables de précalcul | **RETENUE** (F5) | Les 360 et « ce qui a changé » reviennent sans cesse ; les payer à l'avance sur le battement. |

Invariants non négociables (§25–§27, §36) :
- **Permissions** : tout chemin rapide revérifie l'ACL au même endroit que le chemin lent
  (nœud par nœud pour le Drive) — un index n'est JAMAIS une porte dérobée.
- **Provenance** : chaque fait remonte source + horodatage ; les reçus de mission restent la
  preuve.
- **Pas de faux omniscient** : NOT_INDEXED ≠ NOT_FOUND — la réponse dit sur QUOI elle a cherché
  et jusqu'à QUAND l'index est frais.

---

## C. CHANTIER — tranches verticales et état exact

| Tranche | Contenu | État |
|---|---|---|
| **F1 — Audit** | Ce document, section A. | **TESTED** (constats vérifiés dans le code et la base) |
| **F2 — Search Fabric contenu** | Index FTS + trgm sur `DriveTextIndex.textFold` et `KnowledgeChunk.textFold` (migration `20260828300000`, idempotente, tolérante) ; primitive `fabric/text-search.ts` (FTS classée à VIVIER BORNÉ, repli LIKE dit) ; branchée dans `find_documents` ; banc `npm run fabric:bench` ; 2 sabotages EXPLAIN (index FTS, index trgm). | **TESTED + mesuré localement** (voir ci-dessous) |
| **F3 — Source Registry** | `fabric/registry.ts` : 10 familles typées (contenu, entités, modes, AUTORITÉ, preuve négative possible ou non, capacités, tables) + sondes de fraîcheur (`max(updatedAt)` mesuré pour les sources dérivées, `reltuples` étiqueté ESTIMATION). Appelant réel : outil `source_map` (enregistré, classé GENERAL) — « où vit X ? » et « synchronisé jusqu'à quand ? » deviennent des réponses de code. Cohérence testée : capacités fantômes interdites (même garde que catalog.test.ts), tables vérifiées dans le schéma. `fabric/` déclaré FAÇADE (domains.ts) ; +2 au cliquet de frontière, justifiés nommément. | **TESTED** |
| **F4 — Entités & liens** | Table `EntityMention` (migration `20260828310000`, UNIQUE(nodeId, entityType, entityId) + index (entityType, entityId)) ; `fabric/mentions.ts` : dictionnaire des CANONIQUES (produits DCI + marque → même entityId ; personnes NOM COMPLET seulement ; laboratoires partenaires), extraction DÉTERMINISTE à frontières de mots, faite À L'INGESTION (`indexDriveNodeText`), remplacement TOTAL, `mentionsAt` posé même à zéro ; rattrapage borné `balayerMentions` branché sur le battement (`scheduled.ts`, après le sweep d'ingestion) ; `find_documents` 2-ter : la requête qui NOMME une entité tire les documents liés — y compris ceux qui ne portent AUCUN terme de la requête (FRANCHISSEMENT D'ALIAS Keytruda↔pembrolizumab), confiance dédiée « ENTITÉ (lié à … ) », ACL revérifiée nœud par nœud. 9 tests (`fabric/mentions.test.ts`) dont le test-vedette PAR LE VRAI POINT D'ENTRÉE, un test ACL (le lien ne contourne pas les droits) et le sabotage de branchement (ingestion + battement). | **TESTED** |
| **F5 — Hot data & précalcul** | Table `AssistantHotState` (migration `20260828320000`, UNIQUE(kind, subjectId)) + mécanisme `fabric/hot-state.ts` : écriture au travers (`lireEtatChaud`), TTL, invalidation par fait métier (`staleAt`), coût MESURÉ persisté (`costMs`) — et `subjectId` est une clé de DROITS : l'état d'une personne n'est jamais servi à une autre (testé). Premier consommateur : les SIGNAUX EXÉCUTIFS (`assistant/hot-alerts.ts`, TTL 10 min) — branchés dans `company_state`, `ceo_attention`, `executive_alerts`, `executive_brief`, chacun DIT sa fraîcheur (« précalculés au battement, calculés à HH:MM, coût mesuré N ms »). Réchauffage au battement pour les dirigeants actifs < 3 j (droits relus en base, même geste que le balayage des missions) ; invalidation = QUATRIÈME conséquence de `recordEvent` (registre canonique — pas un bus parallèle). Les 360 par entité restent calculés à la demande : ils sont PARAMÉTRÉS (une entité précise) et bornés — précalculer toutes les entités serait du travail jeté ; la décision est dite ici. 9 tests (mécanisme + branchements réels : battement, outil, registre d'événements) + sabotage de branchement. | **TESTED** |
| **F6 — Bulk & missions** | `fabric/bulk.ts` : `creerLoteur` — rassemblement par microtâche (les demandes d'un même tour partent en UN `findMany`, découpé par `tailleMax`), dédoublonnage intra-lot, PAS un cache (deux tours = deux lectures, la fraîcheur ne se négocie pas ici), mesure {logiques, physiques, lots} par INSTANCE — donc exacte par opération. Branché où le N+1 était RÉEL : l'hydratation des candidats de `find_documents` (trois boucles faisaient un `findUnique` par candidat, EN SÉRIE ; désormais ACL en parallèle nœud par nœud + nœuds servis en un lot), et la couverture DIT la mesure (« 8 candidat(s) hydratés en 1 requête(s) »). Côté missions, l'audit a montré que l'éventail acquiert déjà sa LISTE en une lecture (expansion), et que le coût par étape d'écriture est le reçu/idempotence — une propriété de durabilité (§15 runtime), pas du gaspillage : on ne le « batche » pas, décision dite. Les étapes de LECTURE parallèles d'une vague passent par les mêmes outils que la conversation — le lot les sert au même endroit. 6 tests (mécanisme + mesure par le vrai point d'entrée — revenir aux findUnique à la pièce fait tomber le test de mesure). | **TESTED** |
| **F7 — Benchs & sabotages** | P50/P95 par voie (exact, FTS, fuzzy, hybride, 360, cross-source) ; sabotages (index retiré, cache coupé, précalcul coupé). | GAP |

Chaque tranche livre : IMPLEMENT → WIRE → TEST → SABOTAGE → BENCH, et met à jour ce tableau.

### F2 — mesures (locales, `npm run fabric:bench`, 20 000 documents synthétiques)

| Requête | AVANT (scan séquentiel, état pré-F2) | LIKE + trgm | FTS (fabric) |
|---|---|---|---|
| terme rare (0,5 %) | P50 28 ms | 24 ms | **9 ms** |
| préfixe d'un terme rare | 27 ms | 23 ms | **8 ms** |
| conjonction très fréquente (50 %) | 24 ms | 21 ms | 58 ms |
| conjonction rare | 26 ms | 24 ms | **8 ms** |

Trois constats honnêtes :
1. **La loi d'échelle a changé** : à 5 000 documents le scan séquentiel coûtait ~7 ms, à
   20 000 il en coûte ~28 — linéaire. La voie FTS reste ~8–9 ms sur les requêtes rares — le
   cas douloureux de la production (« LE contrat qui parle de X »). L'écart croît avec le
   corpus ; à 100 000 documents le scan serait à ~140 ms, la FTS toujours sous 10.
2. **Le banc a attrapé un défaut dans la fabric elle-même** : la première version payait
   `ts_rank` sur TOUTES les lignes correspondantes (273 ms sur mot fréquent). Le classement
   est désormais borné à un vivier de 300 candidats servi par l'index — un choix DIT dans le
   code.
3. **Le mot très fréquent reste plus cher en FTS (58 ms) qu'en balade de récence (21 ms)** :
   classer coûte, ne pas classer est gratuit. C'est un arbitrage assumé — la pertinence sur
   requête large vaut 40 ms — et borné, donc stable quel que soit le corpus.

Ce que le banc ne mesure pas, il le dit : réseau applicatif, ACL nœud par nœud (identique sur
les trois voies), extraction/OCR (payés à l'ingestion). PROVEN attendra une mesure sur
l'infra réelle (Shell Render : `npm run fabric:bench`).
