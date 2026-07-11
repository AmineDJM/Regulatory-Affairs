# GAP_ANALYSIS — Regulatory Intelligence OS

> Phase 0. Écart entre l'état réel (voir `CURRENT_STATE_AUDIT.md`) et le niveau cible du brief.
> Niveaux cibles : **P1** fondations · **P2** documents · **P3** CTD · **P4** twin · **P5** corpus/RAG · **P6** règles · **P7** agents · **P8** fournisseur · **P9** docs/soumission · **P10** réserves · **P11** cycle de vie · **P12** validation.

| Capacité | État actuel | Niveau cible | Écart | Action (phase) |
|---|---|---|---|---|
| Feature flag par organisation | Flag **global** `AppSetting.regEnrollmentEnabled` | `REGULATORY_INTELLIGENCE_ENABLED` par `Company` (Adventum/Pharmagen/…) | Moyen | Table `RegulatoryFeatureAccess(companyId, enabled)` + bascule Super Admin par org (P1) |
| Permissions fines `regulatory.*` | RBAC module×action (`REGULATORY`,`VIEW/CREATE/...`) ; rôles secondaires OK | ~30 permissions (`regulatory.dossier.upload`, `.finding.approve`…) | Élevé | Couche permissions Regulatory mappée sur rôles + `UserAccess`/`RowGrant` + **tests rôle secondaire** (P1) |
| Isolation org (tenant) partout | `Company` + `currentCompanyWhere()` par domaine | `organizationId` sur **toutes** les entités RI + tests d'isolation | Élevé | `organizationId` obligatoire sur chaque modèle + garde systématique (P1) |
| Original immuable | Blobs chiffrés existants, mais pas de notion ORIGINAL/WORKING/APPROVED | 3 états, chemin/nom d'origine conservés, SHA-256 avant transformation | Moyen | `RegulatoryDocument.kind` + `sha256` + réutilise `putBlob` (P1) |
| Ingestion ZIP sécurisée | `drive-zip` = **téléchargement** en mémoire ; aucun contrôle d'ingestion | Anti-bomb, path traversal, ratio, profondeur, exécutables, chiffrement, timeout, quotas, AV | **Critique** | Service d'ingestion durci + manifest (P1) |
| Traitement isolé (hors process web) | Tout en process web ; aucune file | Worker/queue, idempotence, reprise, progression, annulation | **Critique** | Infra jobs (`RegulatoryJob` + runner) — **décision infra** (P1) |
| Manifest immuable + hash | Absent | `RegulatoryManifestEntry` (sha256, mime réel, statut, ratio) | Élevé | Modèle + calcul au dépôt (P1) |
| Extraction texte PDF | **Absente** (PDF rendus, jamais lus) | PDF texte + par page + tableaux | **Critique** | Ajouter extraction PDF (P2) — **décision dépendance** |
| Extraction DOCX/XLSX | `mammoth`/`xlsx` présents (non branchés RI) | Idem + tableaux, positions | Faible | Réutiliser (P2) |
| OCR réel (fr/en/ar) | **Absent** (ni détection, ni moteur) | Pipeline OCR + scores + langue + tampons/dates | **Critique** | Moteur OCR — **décision infra** (P2) |
| Statuts d'extraction | Absent | `TEXT_EXTRACTED`/`OCR_REQUIRED`/`LOW_CONFIDENCE`/… | Moyen | Enum + gating « jamais analyser un doc mal extrait » (P2) |
| Taxonomie CTD versionnée | KB statique (5 modules, hints) | Modules/sections/sous-sections, obligatoire/conditionnel, alias, applicabilité | Élevé | Taxonomie versionnée + `CtdNode` (P3) |
| Classification persistée | Absente (design uniquement) | Section proposée + score + justification + alternatives, révisable | Élevé | Classifieur (règles+IA) + revue humaine (P3) |
| Jumeau réglementaire (Digital Twin) | Absent | Faits structurés sourcés (`RegulatoryFact`) + occurrences + impact | **Critique** | Extraction de faits + modèle (P4) |
| Détection de conflits | Absente | Moteur de comparaison inter-documents, toutes occurrences | Élevé | Moteur conflits (P4) |
| Corpus réglementaire versionné | `anpp-knowledge.ts` **statique** | `RegulatorySource(+Version/Section)`, statuts, hiérarchie, approbation | Élevé | Modèles + migration de la KB (P5) |
| RAG (recherche + citations) | `ILIKE` Prisma ; pas d'embeddings | FTS + **pgvector** + filtres + reranking + citations exactes | Élevé | RAG hybride — **décision pgvector** (P5) |
| Moteur de règles déterministe | Absent (rien de déterministe) | Règles versionnées, sévérité, preuves, reproductibles | **Critique** | `RegulatoryRule(+Version/Run)` + exécuteurs (P6) |
| Agents IA spécialisés | 1 assistant généraliste ; pas d'agents RI | 12 agents + orchestration + budgets/timeouts/journal | Élevé | Orchestrateur + agents (P7) |
| Sorties IA structurées (Zod) | Aucune validation ; `zod` dispo | Toutes sorties IA validées, réparation, sinon `MANUAL_REVIEW` | Élevé | Schémas Zod + wrapper (P7) |
| Routage modèles | `AI_MODEL` unique | `FAST`/`EXPERT`/`CHALLENGER`/`TRANSLATION` + registre | Moyen | Registre modèles + env (P7) |
| Protection prompt-injection | Aucune (docs jamais lus par l'IA) | Contenu doc = non fiable ; consignes + tests | **Critique** | Garde-fous + tests d'injection (P7) |
| Findings + preuves | Absent | `RegulatoryFinding` + `RegulatoryEvidence` (doc/page/section/extrait) | Élevé | Modèles + UI (P6-P7) |
| Comparaison de versions | Absente | Diff fichiers/faits/findings V1→V2, côte à côte | Élevé | `RegulatoryDossierVersion` + diff (P8) |
| Demandes fournisseur + e-mails | Mail réutilisable ; rien de RI | Génération demandes + **brouillon** e-mail (jamais auto) | Moyen | Générateur + `mail-actions` (P8) |
| Portail fournisseur | `SupplierPortal` externe existe (Regulatory) | Upload par demande, cloisonné, comparaison | Moyen | Étendre le portail existant (P8) |
| Documents générés (OnlyOffice) | OnlyOffice réutilisable ; pas de templates RI | Templates versionnés + filigrane DRAFT + traçabilité | Moyen | `RegulatoryTemplate`/`GeneratedDocument` (P9) |
| Final Submission Gate | Absent | Blocage réel si bloqueur critique ; validation pharmacien DT | **Critique** | Gate + approbations versionnées (P9) |
| Bordereau de versement | Estimation statique (KB) | Estimation vs demande vs BV officiel vs quittance ; règle tarifaire versionnée | Moyen | Séparer les 4 notions (P9) |
| Réserves ANPP | Absent | Extraction exacte + matrice + réponses + annexes + statuts | Élevé | `RegulatoryReserve(+Item/Response)` (P10) |
| Cycle de vie eCTD | Absent | Séquences, NEW/REPLACE/DELETE/APPEND/REFERENCE, obligations | Élevé | `RegulatorySequence`/`Obligation` (P11) |
| Moteur de précédents | Absent | Réserves/réponses passées, suggestions non auto | Moyen | `RegulatoryPrecedent` (P11) |
| Reviewer ANPP simulator | Absent | Stress-test multi-évaluateurs, non prédictif | Moyen | Agent dédié (P11) |
| Change intelligence | Absent | Détection versions de sources + impact sur dossiers/produits | Moyen | `RegulatoryChangeEvent` (P11) |
| Audit trail complet | `recordAudit` générique | Journal RI exhaustif (upload/OCR/règle/IA/finding/décision) + méta IA | Moyen | `RegulatoryAuditLog` + hooks (transversal) |
| Statut « DRAFT — HUMAN REVIEW » | Absent | Sur **toute** production IA | Moyen | Statut systématique (transversal) |
| Tests (sécurité/RBAC/CTD/règles/IA/E2E) | ~130 tests généraux ; 0 RI | Suites dédiées + golden dataset annoté | Élevé | À chaque phase + P12 |
| Observabilité (coûts IA, jobs, OCR) | Aucune pour RI | Logs structurés + métriques + dashboard admin | Moyen | P12 |
| Validation (URS/FRS/…) | Absent | Jeu documentaire complet | Moyen | P12 |

## Écarts « critiques » (bloquants pour un usage réel)

1. **Ingestion ZIP sécurisée + isolation des traitements** (sans quoi risque de sécurité et d'indisponibilité).
2. **Extraction PDF + OCR** (sans quoi « lire les documents » est faux).
3. **Digital twin + moteur de règles déterministe** (sans quoi les contrôles critiques dépendraient de l'IA — interdit §3.3).
4. **Protection prompt-injection** (documents fournisseurs non fiables).
5. **Final Submission Gate + statut DRAFT/HUMAN REVIEW** (sans quoi faux sentiment de conformité — interdit §3.1/§3.5).

## Décisions d'infrastructure requises (voir TARGET_ARCHITECTURE §Décisions)

- **File de jobs** : Redis+BullMQ (add-on Render) **ou** file en base (`RegulatoryJob`) déclenchée par runner interne.
- **OCR** : service/dépendance Node **ou** microservice Python **ou** API OCR externe.
- **Extraction PDF** : dépendance Node (`pdfjs`/`unpdf`) **ou** le même service documentaire.
- **pgvector** : activation de l'extension sur le Postgres Render.
- **Budget IA** : plafond de coût par dossier/organisation.
