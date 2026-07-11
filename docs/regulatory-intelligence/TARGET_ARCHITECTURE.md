# TARGET_ARCHITECTURE — Regulatory Intelligence OS

> Phase 0. Architecture cible **réconciliée avec la stack réelle** (Next.js 14 + Prisma + Postgres + blobs chiffrés + IA via HTTP + Render single-service). Le brief suppose S3/R2, un microservice Python et Redis : ces choix sont traités en **Décisions** ci-dessous, avec un chemin **Node-first pragmatique** par défaut.

## 1. Principe directeur

Un **noyau Algérie-first** (règles + corpus + taxonomie CTD algériens) exposé via une **couche de capacités** (ingestion, extraction, classification, twin, règles, agents, findings, documents, réserves, cycle de vie), pensée pour accueillir des **rule packs internationaux** sans réécrire le cœur. UI **simple** ; complexité **absorbée par l'architecture**.

Boucle utilisateur : `Recevoir → Importer → Analyser → Corriger → Valider → Soumettre → Répondre → Maintenir`.

## 2. Couches

```
UI (Next.js RSC + volets)  ── simple, guidée, responsive
        │
Couche services Regulatory (lib/regulatory/*)  ── logique métier, RBAC, org-scope
        │
   ┌────┴──────────────────────────────────────────┐
Moteur déterministe (règles)      Orchestrateur IA (agents)   ← séparés (§3.3)
   │                                   │
Corpus versionné + RAG        Sorties structurées (Zod) + garde-fous injection
        │
Modèle de données (Prisma/Postgres)  ── organizationId, versionné, audité
        │
Infra transverse : blobs chiffrés · jobs asynchrones · audit · mail · OnlyOffice · notifications · tâches
```

**Séparation non négociable** : un contrôle critique (CPP présent, date expirée, dosage divergent…) est exécuté par le **moteur de règles déterministe**. L'IA **explique** et **enrichit**, mais ne **remplace jamais** le résultat déterministe.

## 3. Découpage code (nouveau)

```
src/lib/regulatory/
  anpp-knowledge.ts          (existant → migré vers corpus en P5, conservé comme seed)
  intelligence/
    access.ts                feature flag par org + permissions regulatory.*
    ingest/                  sécurité ZIP, manifest, hash, quarantaine
    extract/                 PDF/DOCX/XLSX/OCR + statuts + confiance
    ctd/                     taxonomie + classification
    twin/                    extraction de faits + conflits + impact
    corpus/                  sources versionnées + RAG (FTS/pgvector)
    rules/                   moteur déterministe + exécuteurs
    agents/                  orchestrateur + 12 agents + schémas Zod + model routing
    findings/               findings + evidence
    reserves/                réserves + réponses
    documents/               templates + génération OnlyOffice + submission gate
    lifecycle/               séquences, obligations, précédents
    jobs/                    définitions + runner
    audit.ts                 journal RI
src/app/(app)/regulatory/intelligence/*   (routes UI, gardées par flag+perms)
src/app/api/regulatory/*                  (routes internes, gardées)
```

## 4. Modèle de données (résumé — détail en Phase 1)

Groupes (`organizationId` + audit + version sur **tous**) :
- **Accès** : `RegulatoryFeatureAccess`, `RegulatoryWorkspace`.
- **Produit** : `RegulatoryProductProfile` (lié à `RegulatoryProduct` existant), `RegulatoryDigitalTwin`.
- **Dossier** : `RegulatoryProcedure`, `RegulatoryDossier`, `RegulatoryDossierVersion`, `RegulatorySubmission`, `RegulatorySequence`.
- **Documents** : `RegulatoryDocument`(kind ORIGINAL/WORKING/APPROVED), `RegulatoryDocumentVersion`, `RegulatoryDocumentPage`, `RegulatoryManifestEntry`, `CtdNode`, `CtdDocumentMapping`.
- **Faits** : `ExtractedRegulatoryFact`, `RegulatoryFactOccurrence`, `RegulatoryFactConflict`, `RegulatoryImpactAnalysis`.
- **Corpus** : `RegulatorySource`, `RegulatorySourceVersion`, `RegulatorySourceSection`, `RegulatoryRequirement`, `RegulatoryInterpretation`, `RegulatoryCorpusApproval`.
- **Règles** : `RegulatoryRule`, `RegulatoryRuleVersion`, `RegulatoryRuleRun`, `RegulatoryFinding`, `RegulatoryEvidence`.
- **Fournisseur** : `RegulatorySupplierRequest`, `RegulatorySupplierResponse`.
- **Réserves** : `RegulatoryReserve`, `RegulatoryReserveItem`, `RegulatoryResponse`.
- **Production** : `RegulatoryTemplate`, `RegulatoryContentBlock`, `RegulatoryGeneratedDocument`, `RegulatoryApproval`.
- **IA & jobs** : `RegulatoryModelRun`, `RegulatoryPromptVersion`, `RegulatoryJob`.
- **Cycle de vie** : `RegulatoryObligation`, `RegulatoryPrecedent`, `RegulatoryChangeEvent`.
- **Transverse** : `RegulatoryAuditLog`.

Stockage binaire : **réutilise `FileBlob`/`putBlob`** (chiffré, dédup). L'ORIGINAL n'est **jamais** ré-écrit ; copies de travail = nouveaux blobs.

## 5. Orchestration IA (P7)

- Un **orchestrateur** séquence les agents (§16), chacun : prompt **versionné**, **schéma Zod** de sortie, **outils limités**, **budget/timeout**, **journal** (`RegulatoryModelRun`).
- **Toute** sortie IA validée par Zod ; échec → une réparation → sinon `MANUAL_REVIEW_REQUIRED` (pas de boucle infinie).
- **Agent 12 (Challenger)** obligatoire avant tout rapport final.
- **Model routing** : `REGULATORY_MODEL_FAST|EXPERT|CHALLENGER|TRANSLATION` (env), registre unique.
- **Prompt-injection** : le contenu documentaire est passé comme **donnée non fiable** (jamais comme instructions), consigne système explicite, tests dédiés.
- **RAG** : chaque exigence citée renvoie source+version+section+extrait+lien interne ; sinon `EXIGENCE NON CONFIRMÉE — REVUE HUMAINE`.

## 6. Jobs asynchrones (P1)

Pipeline : `UPLOADED → SECURITY_SCAN → MANIFEST_CREATED → EXTRACTING → OCR → PARSING → CLASSIFYING → FACTS_EXTRACTING → RULES_RUNNING → AI_REVIEW → CHALLENGER_REVIEW → HUMAN_REVIEW → COMPLETED`. Idempotent, repris, progression, annulation, retry borné. **Aucun** fichier inchangé n'est re-analysé (hash).

## 7. Décisions d'infrastructure (à trancher avec le métier)

| Sujet | Option A (Node-first, défaut recommandé) | Option B (brief) | Recommandation |
|---|---|---|---|
| File de jobs | `RegulatoryJob` en Postgres + runner interne (extension de `scheduled.ts`), 1 worker | Redis + BullMQ (add-on Render) | **A** pour démarrer ; **B** si volume élevé |
| Traitement lourd | Route/worker Node isolé + limites strictes | Microservice Python FastAPI | **A** d'abord (même déploiement) ; **B** si OCR massif |
| Extraction PDF | Dépendance Node (`unpdf`/`pdfjs-dist`) | Service Python | **A** |
| OCR | API OCR externe (précise, multi-langue dont **arabe**) **ou** `tesseract` Node | Tesseract dans microservice | **API externe** pour l'arabe/qualité ; sinon `tesseract` |
| RAG vectoriel | FTS Postgres d'abord | pgvector | Activer **pgvector** en P5 (extension Postgres) |
| Stockage | `FileBlob` chiffré (existant) | S3/R2 | **Rester `FileBlob`** ; S3 seulement si taille l'exige |
| Budget IA | Plafond configurable par organisation/dossier | — | Obligatoire (coût + DoS) |

Ces choix impactent surtout P2 (OCR), P5 (pgvector) et l'infra jobs. **Décisions à confirmer avant P2/P5** ; P1 (fondations) avance sans elles.

## 8. Intégration ERP (ne pas créer une app parallèle)

Réutilise : `User`/RBAC (rôles secondaires), `Company`, `RegulatoryProduct` + workflow 22 étapes, `Supplier` + portail fournisseur existant, `FileBlob`/Drive, OnlyOffice, mail Infomaniak, notifications, tâches, `recordAudit`. Le dossier RI **alimente** le circuit ANPP existant (création produit + demande de B.V.), il ne le duplique pas.
