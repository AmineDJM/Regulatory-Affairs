# Audit 19 — Extraction des devis, BC et factures (lecture seule, preuves `src/` sauf mention)
Sévérités : BLOQUANT / MAJEUR / MINEUR / SUGGESTION. Rapport écourté sur ordre du coordinateur (budget).

## 1. Points d'upload — AUCUN ne produit de données plateforme (fichier stocké, chiffres ressaisis)
- Socle `persistUploadedDocument` lib/documents.ts:38-110 (blob, audit, miroir Drive :104-108, zéro extraction) ; lot app/api/documents/upload/route.ts:18-81.
- Matériel promo circuit 2 : scan du devis stocké jamais lu lib/actions/promo-devis-actions.ts:286-293 ; l'assistante RETRANSCRIT à la main (consigne :163, écran app/(app)/promo-material/[id]/quotes-card.tsx:117-122) ; facture : n°, total TTC, qtés/prix ressaisis promo-execution-actions.ts:361-424 ; ancien circuit : fichiers seuls promo-material-actions.ts:287,326, montant tapé :294.
- Ad & Pro « pièces liées » (devis/BC/facture = LegalDocument) components/shared/attach-to-source.tsx:150-200 : titre, n°, montant tapés ; facture en TEXTE libre (:197 → invoice-actions.ts:55-67) alors que devis/BC passent par l'annuaire.
- Postes Ad & Pro : devis/BC/facture encore déposables en simples fichiers components/ad-pro/items-panel.tsx:923 (la demande les exclut, ad-pro/doc-categories.ts:110).
- Secrétariat : fichiers QUOTE/INVOICE app/(app)/demandes/[id]/page.tsx:34,206 ; montants tapés admin-request-actions.ts:641,733 ; `finishRequest` exige un FICHIER INVOICE :712-715.
- /pieces : pièce classée dans Legal sans montant/réf./contrepartie document-request-actions.ts:171-172 ; factures migrées des BC idem (README:10299-10305).
- Prise en charge : CareQuote = fournisseur texte + montant, aucun champ PDF components/care/care-panel.tsx:559-596 ; `CareQuote.documentId` (prisma/schema.prisma:3211-3212) sans écrivain (care-actions.ts:354-400).
- Demandes de paiement : pièces en catégorie OTHER payment-request-actions.ts:251-263, montant/bénéficiaire tapés.
- Moyens généraux/caisse : tickets + lignes tapées department-budget-actions.ts:350-415, petty-cash-actions.ts:270-310 (Document écrit en direct : ni audit ni miroir).
- Legal (création sans `analyze`) app/(app)/legal/page.tsx:215-232 ; courriers INVOICE/PO app/(app)/courriers/[id]/page.tsx:34 ; AO PCH pch-actions.ts:67 ; Drive (indexé ensuite par le balayage).

## 2. Capacités existantes réutilisables
- Lecteur unique natif→OCR avec méthode+confiance lib/regulatory/intelligence/extract/texte-ou-ocr.ts:56-93 (utilisé seulement par corpus/entraînement — Graphify) ; extract-text.ts (PDF paginé MuPDF, DOCX, XLSX) ; OCR Mistral markdown, confiance PRÉSUMÉE 95 ocr/mistral-ocr.ts:15-21, repli Tesseract ocr-engine.ts:10-21.
- Paliers natif→OCR→vision platform/in-process/media/lecture.ts ; lecture visuelle JSON (type « facture », chiffres) lib/assistant-files.ts:90-107.
- Index texte Drive (~20 000 car., schema:5494-5520) + classification déterministe invoice/quote/purchase_order platform/doc-kind.ts ; balayage 20 fichiers ≤ 8 Mo lib/assistant/drive-ingestion.ts:22-25.
- JSON à schéma imposé + télémétrie lib/models/gateway.ts:291-306 ; gabarit d'IA hors Adam bien gardée lib/redaction-site-ia.ts:58-140 (bascule, logAiUsage, relecture, dépendances injectables, n'écrit rien).
- Précédents IA : AO PCH pch-tender-line-actions.ts:196-301 ; contrat RH hr-actions.ts:217-263 + pré-remplissage éditable `AnalyzePrefill` components/shared/create-record-button.tsx:18-26 (seul usage app/(app)/rh/page.tsx:93-101 ; champ « parties » non pré-remplissable :392).
- Format canonique + arithmétique lib/artifact/factory/commercial.ts:79-153, calculerTotaux :197-240 ; BC composé depuis lignes retenues promo-execution-actions.ts:179-195 (devis.ts:161).
- Contrôles ±1 DZD devis.ts:121-137, achats.ts:344 ; rapprochement facture↔BC ligne à ligne achats.ts:219-321 (promo seul).
- Garde-fous : wrapUntrusted lib/comms/untrusted.ts:95-115 ; cycle PROPOSÉ→CONFIRMÉ/CORRIGÉ/REJETÉ (RegulatoryFact schema:9187-9213).

## 3. Constats
- MAJEUR — Rien n'est extrait (§1) ; le composeur de BC fait tout retaper, tiers compris, sans lien au devis : components/pieces/composer-piece.tsx:77,231-242,260 (aucun chainFromId à l'écran).
- MAJEUR — AO PCH : OCR même d'un PDF natif :293 ; coupe silencieuse 24 000 car./40 p./3 500 jetons :220-221,293 ; fichier non conservé ; relance = lignes doublées :242-243 ; écriture directe sans validation.
- MAJEUR — L'interrupteur général IA ne coupe pas PCH ni RH : ai-settings.ts:1-7 promet `aiFeatureEnabled` partout, lib/ai.ts:162-176 ne le lit pas (promesse écran ai-settings-form.tsx:81).
- MAJEUR — Plafond « factures ≤ BC » seulement au promo (promo-execution-actions.ts:420-424) ; porte générique lib/finances/settlement.ts:219-247 sans comparaison de montants.
- MAJEUR — Moyens généraux : fichier validé APRÈS création de la dépense (department-budget-actions.ts:388-403, petty-cash-actions.ts:279-297) ⇒ faux échec puis doublon au renvoi ; liste blanche sans HEIC/TIFF (lib/storage.ts:56-59) ≠ liste noire (:108-122).
- MAJEUR — Contrôle ±1 DZD du devis contournable : sauté si total imprimé vide (devis.ts:122), champ facultatif (quotes-card.tsx:117) ; devis en HT, facture en TTC (schema:6586 / 6711) ; une seule TVA par devis.
- MAJEUR — Règle « doublon_factures » groupe par n° SANS fournisseur (lib/quality/rules.ts:193) : faux « quasi certain » dès que l'extraction remplira les n° ; factures sans montant/contrepartie invisibles (:205).
- MINEUR — « ANTHROPIC_API_KEY » codé en dur (pch-tender-line-actions.ts:270,282 ; hr-actions.ts:222) alors que le défaut est OpenAI (models/registry.ts:136-137) ; « analyse d'un CV » pour un contrat (rh/page.tsx:100) ; montant `step="1000"` (care-panel.tsx:570) ; import de relevés compte les échecs (finance-actions.ts:157-201).

## 4. Lentilles
- A Tests : éprouvés OCR/lecteur, contrôles promo (circuit-v2.test, achats.test, promo-achats-flow, promo-circuit-v2-flow), pièce→Legal sans montant (piece-vers-legal.test.ts:102). Rien sur analyzeTenderDocument, analyzeEmployeeContract, createCareQuote, finishRequest, importTransactions, fichier invalide en moyens généraux ; l'e2e SÈME devis/facture en base (e2e/stock-promo-sorties.spec.ts:139-187).
- B Révision : DM/DG = valider ou refus TERMINAL (promo-circuit-actions.ts:352) ; CareQuote ni modifiable ni supprimable ; paiement : montant figé même en brouillon (payment-request-actions.ts:371-402), pièce remplaçable si mise en cause seulement (:318-326). Légitime : lignes de BC validées, BC signé.
- D Managers : aucune file « pièces à compléter/confirmer » ni charge de retranscription ; bureau assistante compté sur 300 lignes (queries/admin-requests.ts:29-49).
- E README : 1587 (±1 DZD « toujours ») vs devis.ts:122 ; 2151-2155 « Mistral puis Claude » vs registry.ts:137 ; 6014-6056 (Claude/ANTHROPIC) ; 774-777 devis non exigé (admin-request-actions.ts:625-660) ; 2864-2887 « tout entre dans le Drive » vs department-budget-actions.ts:409 ; 1296 vs items-panel.tsx:923.

## 5. Architecture proposée
1. `PieceExtraite` (module pur, socle) = SpecDocumentCommercial étendu : émetteur (nom, NIF, RC, AI, RIB), n°, dates, lignes (désig., réf., qté, unité, PU HT, remise, TVA ligne), taxes, totaux IMPRIMÉS HT/TVA/taxes/timbre/TTC, confiance + page/extrait par champ.
2. Table `PieceExtraction` (documentId, sha256, statut PENDING→TEXTE→PROPOSÉE→CONFIRMÉE/CORRIGÉE/REJETÉE, méthode, coût) : journal de proposition, jamais second registre.
3. Enfilée par `persistUploadedDocument` (QUOTE, PROFORMA, PURCHASE_ORDER, INVOICE, PDF de pièce Legal), traitée par le battement en lots bornés.
4. Texte : doc-kind → lireTexteOuOcr (natif d'abord) → vision sur pages douteuses ; structuration askModelJson (rôle bulk, schéma strict, wrapUntrusted, aucune coupe silencieuse).
5. Le code recalcule (calculerTotaux) et compare aux totaux imprimés à 1 DZD (HT et TTC) ; écart = « à vérifier », jamais validé seul.
6. Fournisseur résolu par NIF/RC dans l'annuaire, jamais créé d'office.
7. Validation HUMAINE : `AnalyzePrefill` étendu (lignes, parties, confiance) pré-remplit quotes-card, pièces liées, composeur, dépôt de facture ; le clic écrit dans les tables existantes.
8. Réutilisation : BC pré-rempli depuis le devis confirmé (chainFromId au composeur, postes Ad & Pro) ; rapprochement facture↔BC en généralisant achats.ts ; plafond cumul ≤ BC dans settlement.ts.
9. Gouvernance : bascule `extraction_pieces` + masterEnabled, logAiUsage, plafond de coût, CONFIDENTIAL ⇒ OCR local seul.
10. Tests à dépendances injectées (pas de clé en test), aucune donnée simulée ; sans clé, « IA non configurée » (cleModeleRequise) et saisie manuelle intacte.
11. Risques : coût Mistral/page, fuite vers fournisseur, faux succès (total cohérent mais mal lu, « 1.234,50 »), injection, faux doublons — corriger rules.ts:193 AVANT.
12. Confirmer reste un geste d'écran (Adam EXCLUDED), comme la retranscription (README:1638-1640).
13. Rattrapage borné des factures Legal sans montant (migrées, réclamées).
14. Ordre : promo (tables prêtes) → pièces liées Ad & Pro → secrétariat/moyens généraux → paiements.
15. Écran manager « pièces à confirmer » (âge, écarts, confiance basse).

## 6. Scénarios navigateur
1. Assistante, /congress-national/[id] « Enregistrer un devis reçu », montant 452 300 → refus du navigateur (step 1000).
2. Assistante, /moyens-generaux, dépense avec ticket .heic → erreur affichée MAIS dépense créée ; renvoi → doublon.
3. Responsable PCH, /pch/[id], « Analyser le fichier » deux fois → lignes doublées.
4. Assistante, /demandes/[id] (achat) : facture via « Pièces liées › Facture » puis « Fin de la demande » → refus « uploadez la facture ».
5. Super Admin : couper l'interrupteur général IA, puis analyser un AO PCH → l'appel part quand même.
6. Assistante, promo circuit 2 : devis sans total imprimé avec une ligne fausse → « Retranscription terminée » acceptée.
