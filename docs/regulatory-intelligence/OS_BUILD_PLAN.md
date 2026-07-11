# OS_BUILD_PLAN — Regulatory Intelligence OS (au-delà de la fondation)

La **PHASE FOUNDATION** (Secure CTD Intake & Basic Regulatory Triage) est livrée et conservée.
Ce plan couvre les **capacités centrales restantes** (critères d'acceptation), construites par
phases G1→G14 — chacune vérifiée (tsc + tests + build), org-scopée, auditée, avec statut réel /
simulé / restant explicité (voir §15 du brief).

## Réalité d'infrastructure (vérifiée)
- **pgvector indisponible** dans ce Postgres → le RAG utilise **FTS `french` + `pg_trgm`** (réel).
  Le schéma reste prêt pour un embedding provider ultérieur (Anthropic n'expose pas d'embeddings).
- **FTS `french` opérationnel**. **tesseract.js** (OCR WASM fr/en/ar), **docxtemplater + pizzip**
  (génération docx) installables → **OCR réel** et **génération documentaire réelle** sans service tiers.
- Appels IA « live » = actifs seulement si `ANTHROPIC_API_KEY` ; sinon **abstention** honnête
  (aucune simulation). Structure + tests golden (IA mockée) livrés dans tous les cas.

## Phases
- **G1 — Digital Twin** : `RegulatoryFact` + occurrences sourcées (document/version/page/section/
  extrait/confiance/méthode/statut humain/date d'effet) ; extracteurs déterministes ; écran de revue/approbation.
- **G2 — Détection de conflits** : comparaison des occurrences d'un même fait ; `RegulatoryConflict`
  (valeurs concurrentes, sources, pages, criticité, documents, action, résolution, valeur finale).
- **G3 — Corpus versionné** : `RegulatorySource/Version/Section/Requirement/CorpusApproval` + admin
  (import, revue, approbation, activation, retrait). `anpp-knowledge.ts` = corpus legacy temporaire.
- **G4 — RAG réglementaire** : FTS `french` + `pg_trgm`, découpage article/section/annexe/exigence,
  filtres (juridiction/date/procédure/produit/CTD), reranking, **citations exactes** ; sinon
  « EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE ».
- **G5 — Rule engine administrable** : `RegulatoryRule` versionnée (code/juridiction/source/version/
  procédure/type produit/section/applicabilité/logique/criticité/date/remédiation/tests) + rule packs.
- **G6 — Agents spécialisés** : 14 agents (Algeria M1, CMC substance/produit, analytique, stabilité,
  non clinique, clinique, bioéquivalence, info produit, auditeur cohérence, recevabilité, réserves,
  fournisseur, challenger) — prompt versionné, outils limités, Zod, sources, seuil d'abstention, golden.
- **G7 — Comparaison V1/V2** : fichiers inchangés/ajoutés/supprimés/remplacés ; diff texte/tableaux/faits ;
  réévaluation ciblée ; findings proposés résolus ; nouveaux conflits ; décision humaine conservée.
- **G8 — Boucle fournisseur** : demande de documents, tableau de questions, brouillon e-mail Infomaniak
  (IA = brouillon seulement), approbation, rattachement, échéance, réponse, upload, statut, relance, historique.
- **G9 — Réserves ANPP** : upload lettre, OCR, extraction mot à mot, décomposition, catégorisation,
  assignation, réponse proposée, preuves, annexes, commentaires, approbation, export, multi-cycles.
- **G10 — Génération documentaire** : templates versionnés (pré-soumission, enregistrement, modification,
  renouvellement, transfert, note d'intérêt, courrier, structure de prix, déclaration, rapport, réponse
  réserves, matrice Q/R, checklist, index annexes) — **données issues du Digital Twin approuvé** (docxtemplater).
- **G11 — Reviewer Simulator** : stress test multi-perspectives (recevabilité/M1/CMC/analytique/stabilité/
  bioéquivalence/clinique/PV/médico-éco/commission) — **simulation interne non prédictive**.
- **G12 — Lifecycle** : soumission initiale/séquences/compléments/modifications/renouvellements/réponses,
  version approuvée, opérations NEW/REPLACE/DELETE/APPEND, obligations post-enregistrement, certificats
  expirants, analyse d'impact.
- **G13 — OCR réel** : détection couche texte, évaluation qualité, OCR par page (fr/en/ar via tesseract.js),
  rotation/nettoyage, confiance, texte par page, natif vs OCR séparés, revue humaine pages faible confiance.
- **G14 — Upload résumable gros fichiers** : session d'upload, parties, reprise, vérif taille+SHA côté
  stockage, finalisation explicite, inspection après finalisation, pas d'archive complète en RAM Next,
  nettoyage des parties, quotas par organisation, limitation de concurrence, tests de charge (50/150/300 Mo).
