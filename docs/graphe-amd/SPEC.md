# AMD INTERNAL OS — BUSINESS UNITS, MULTI-SPECIALTY, CONSUMPTION INTELLIGENCE, SEGMENTATION & CONNECTED OPERATING SYSTEM

> Spécification du dirigeant, reçue le 01/10/2026 en cours de session (lot 3 en clôture). Consigne : « Ajoute tout ce chantier long et complexe à ta liste ! Quand tu finis, fais le » — c'est-à-dire APRÈS les lots 3 (stock/catalogue), 5 (Ad&Pro postes) et 4 (Finances). Texte repris fidèlement, mis en forme compacte ; les numéros sont ceux du message d'origine.

## MISSION
Tu travailles sur AMD Internal OS, le système opérationnel central d'Adventum. La demande n'est PAS de créer quelques écrans indépendants ou de reproduire un Excel. Construire une architecture métier cohérente où **une donnée est créée une fois, possède une identité unique, puis est réutilisée partout où elle est pertinente**.

La plateforme doit réduire radicalement : la double saisie ; les Excel parallèles ; les demandes administratives ; les rapprochements manuels ; le reporting manuel ; les incohérences entre départements.

Philosophie : **Enter once → Link everywhere → Calculate automatically → Act → Learn from new data.** La complexité est absorbée par AMD ; l'expérience quotidienne reste extrêmement simple.

## 0. MÉTHODE OBLIGATOIRE
Ne PAS coder directement depuis cette spécification. À chaque grande phase : 1 Inspect, 2 Understand, 3 Plan, 4 Implement, 5 Test, 6 Verify, 7 Find inconsistencies, 8 Correct, 9 Re-test, 10 Confirm no regression, 11 seulement ensuite phase suivante.
Jamais « terminé » parce que ça compile. Par phase vérifier : schéma de données ; UI ; permissions ; calculs ; relations avec les autres modules ; cas nominaux ; edge cases ; données manquantes ; erreurs ; duplications ; changements de configuration ; conséquences dans les autres modules.
Un test échoue → corriger immédiatement puis refaire le test. Ne pas contourner, ne pas masquer un bug, ne pas hardcoder un résultat pour faire passer un test.

## 1. COMMENCER PAR AUDITER
1.1 Inspecter le repository complet : framework ; architecture frontend ; backend ; ORM ; base ; auth ; permissions ; design system ; composants ; services ; modules ; tables ; relations ; conventions de nommage ; historique/migrations.
1.2 Identifier les modules existants : Annuaire ; Business Units ; Regulatory ; PCH / Appels d'Offres ; Legal ; Finance ; Centre de Paiement ; Add & Pro ; RH ; Drive ; Calendar ; Tasks ; Visits ; CRM ; produits ; établissements ; fournisseurs. **NE PAS recréer un objet existant sous un autre nom.**

## 2. UNE SEULE SOURCE DE VÉRITÉ
AMD ne doit pas devenir une collection de mini-applications avec chacune leurs données. Interdit : `RegulatoryProduct`, `TenderProduct`, `MarketingProduct`, `BUProduct` = quatre fois le même médicament. À la place : `Product` à identifiant canonique unique ; Regulatory, Tender, BU, Finance, Add & Pro, Consumption référencent `product_id`. Même principe pour tous les objets importants.

## 3. CORE MASTER ENTITIES
Entités centrales robustes, minimum : Product, BusinessUnit, Specialty, HCP, HCO / Facility, Territory, Employee/User, Supplier/Partner, Tender, Contract, PurchaseOrder (ou équivalent existant), Invoice, Payment, Expense, Event, Activity, Visit, Cycle. Tous les modules pointent vers elles.

## 4. BUSINESS UNIT ≠ SPÉCIALITÉ (règle critique)
Cas simple : une spécialité. Cas avancé : plusieurs. L'UX peut encourager une spécialité principale, mais le modèle est **BusinessUnit ↔ Specialty = many-to-many**. Exemple : BU Specialty Care = Dermatologie + Neurologie + Urologie. Ne jamais construire `business_unit.specialty_id` comme unique relation obligatoire si cela empêche le multi-spécialité.

## 5. SPÉCIALITÉ PRINCIPALE ET ASSOCIÉES
Une BU a : une spécialité principale facultative ; plusieurs spécialités associées (ex. Specialty Care : principale Neurology ; associées Dermatology, Urology). La notion de principale sert à l'UX, elle ne limite pas le modèle.

## 6. LES PRODUITS PEUVENT CIBLER UNE PARTIE DES SPÉCIALITÉS DE LA BU
Produit A : Neuro seule. Produit B : Dermato. Produit C : Neuro + Urologie. Relation **Product / BU Assignment → Target Specialties**. Ne pas déduire que tous les produits ciblent toutes les spécialités de la BU.

## 7. UN PRODUIT EST UNE ENTITÉ CANONIQUE
Fiche Product centrale : nom ; DCI ; brand si applicable ; dosage ; forme ; présentation ; classe thérapeutique ; indications ; statut ; identifiants internes. Ne pas dupliquer un médicament selon les fonctions.

## 8. PRODUCT × BUSINESS UNIT
Relation avec sa propre configuration : `ProductBUAssignment` avec business_unit_id, product_id, active, ranking, target specialties, target groups, effective dates, segmentation configuration, commercial status. Un produit canonique est utilisé correctement dans différents contextes.

## 9. ANNUAIRE = MASTER DATA, PAS CARNET D'ADRESSES
L'Annuaire devient une vue sur les objets centraux.
**HCP** : identité ; spécialité principale ; spécialités secondaires éventuelles ; établissement ; service ; rôle ; territoire ; coordonnées ; historique ; BU concernées ; produits concernés ; visites ; événements ; segmentations.
**HCO / Facility** : établissement ; type ; région ; wilaya ; services ; spécialités ; HCP ; consommation ; AO liés ; activité ; autres données pertinentes.

## 10. RELIER TOUT, NE PAS DUPLIQUER
Dr X appartient au CHU Oran : ne PAS copier « CHU Oran » en texte dans 12 modules — référencer `facility_id`. Même logique pour Product, BU, Specialty, HCP, supplier, tender, contract. Labels cachés pour l'UI possibles ; l'identité métier reste unique.

## 11. VUES 360° — PRODUCT 360° (ex. Raltegravir)
BU (business unit, spécialités, ranking) · Regulatory (dossiers, statuts, échéances) · Market/Consumption (volumes, établissements, périodes, affinité) · Segmentation (HCP A/B/C/D, H, priorités BU) · Tender (AO, offres, résultats, quantités, prix) · Contractual (contrats, avenants) · Financial (revenus, coûts directs, dépenses marketing, événements, autres dépenses attribuées) · Field Force (visites, CAM, couverture, cycles). Accessible sans reconstruire manuellement le dossier.

## 12. BUSINESS UNIT 360°
Produits ; spécialités ; responsables ; CAM ; territoires ; HCP ; établissements ; segmentation ; consommation ; AO ; contrats ; revenus ; dépenses ; événements ; visites ; performance terrain.

## 13. HCP 360°
Profil ; spécialité(s) ; établissement ; rôle ; BU ; produits ; segmentation par produit ; potentiel ; affinité ; visites ; événements ; actions ; historique.

## 14. APPELS D'OFFRES
Tender / PCH jamais isolé. Tender → Tender Lines → Product → BU → Regulatory → Contract → Orders → Invoices → Payments. Un Tender Line pointe vers le vrai `product_id`.

## 15. FINANCE & COÛTS
« Combien avons-nous dépensé sur Raltegravir ? » sans fausse précision comptable. Distinguer **Direct Costs** (attribués directement), **Allocated Costs** (partagés, répartis selon une règle), **Unallocated Costs** (non affectables raisonnablement). Ex. Raltegravir 2026 : direct X, alloué partagé Y, total attribué Z, non alloué BU W. Ne jamais mélanger silencieusement.

## 16. DIMENSIONS FINANCIÈRES
Une Expense peut pointer vers : BU ; Product ; Event ; HCP/HCO si pertinent ; Tender ; Contract ; department ; project. Uniquement lorsque pertinent ; pas tous obligatoires.

## 17. RÉDUIRE LA BUREAUCRATIE
Une donnée déductible ne se redemande pas. Ex. le CAM crée une visite avec Dr X : AMD connaît établissement, territoire, BU, spécialité, produits actifs → ne redemander que le réellement nécessaire.

## 18. UNE ACTION ALIMENTE PLUSIEURS VUES
Visite + « Patients VIH/semaine = 27 » → alimente HCP history, potential history, segmentation, cycle progress, CAM activity, BU dashboard. Pas 5 saisies.

## 19. MODULE BUSINESS UNITS
Un vrai module dédié, qui gère la structure — pas un écran gigantesque contenant tous les paramètres du système.

## 20. CRÉATION D'UNE BU
Create BU → **General** (name, code, description, status) → **Specialties** (primary facultative, additional) → **Team** (BU manager, employees, CAM) → **Territories** → **Products** (catalogue products) → **Segmentation Products** (jusqu'à 3 produits actifs simultanément pour la stratégie terrain).

## 21. MAXIMUM 3 PRODUITS DE SEGMENTATION
Une BU peut avoir plus de trois produits au catalogue, mais une configuration active de segmentation / cycle utilise **maximum 3 produits** classés Product #1, #2, #3. Catalogue BU ≠ trois produits prioritaires du cycle.

## 22. LE CLASSEMENT EST TEMPOREL
Octobre : 1 RAL, 2 DTG, 3 DEL. Janvier : 1 DEL, 2 RAL, 3 DTG. Le ranking appartient à une stratégie, ou un cycle, ou une période effective. Ne pas écraser l'historique.

## 23. MODULE CONSUMPTION INTELLIGENCE
Module autonome transformant des fichiers hétérogènes de consommation hospitalière en données fiables et normalisées.

## 24. LES EXCEL NE SONT PAS STANDARDISÉS
Colonnes, ordre, noms, feuilles, dates, périodes, unités, granularité changent. `Hôpital`, `Etablissement`, `Structure`, `CHU` peuvent tous représenter un établissement. AMD doit le comprendre.

## 25. PIPELINE D'IMPORT
Upload → File analysis → Sheet detection → Header detection → Semantic mapping → Entity resolution → Unit normalization → Data validation → Anomaly detection → User review if needed → Commit → Affinity recalculation → Segmentation impact preview.

## 26. FORMAT CANONIQUE (minimum)
import_batch_id ; source_file ; source_sheet ; source_row ; period_start ; period_end ; facility_id ; facility_raw ; product_id ; product_raw ; molecule ; dosage ; presentation ; source_quantity ; source_unit ; normalized_quantity ; normalized_unit ; value ; currency ; confidence ; status.

## 27. CONSERVER LE FICHIER ORIGINAL
Jamais perdre : fichier source ; valeur source ; ligne source ; mapping ; corrections. Chaque nombre est traçable.

## 28. L'IA COMPREND, ELLE NE DÉCIDE PAS LE MÉTIER
L'IA : reconnaître colonnes ; détecter périodes ; comprendre médicaments ; rapprocher établissements ; reconnaître unités ; détecter anomalies ; proposer mappings. **A/B/C/D ne dépend jamais d'un jugement arbitraire du LLM** — moteur de règles déterministe.

## 29. MAPPING CONFIDENCE
`RAL 400MG` → Raltegravir 400mg, confidence 99 %, auto-accept possible. `R400`, confidence 55 % → Needs Review.

## 30. APPRENTISSAGE DES MAPPINGS
L'utilisateur confirme `ETAB` = Facility → réutilisé sur les fichiers similaires suivants. Une mémoire de mapping n'empêche jamais une nouvelle validation si le contexte change fortement.

## 31. DOUBLONS
Détecter : fichier déjà importé ; lignes déjà importées ; périodes chevauchantes ; mêmes produits/hôpitaux/périodes. Jamais additionner silencieusement.

## 32. AFFINITÉ PRODUIT
Calculée automatiquement : Product Consumption / Relevant Market Consumption. Dénominateur configurable.

## 33. CONFIGURATION AFFINITÉ (par produit)
**Numerator** : produit étudié. **Denominator** : classe thérapeutique ; produits sélectionnés ; marché ; indication ; custom basket. **Period** : cycle ; month ; rolling 3M/6M/12M ; custom. **High Affinity Threshold** (ex. ≥ 10 %).

## 34. RESPECTER LA GRANULARITÉ DE LA SOURCE
Consommation par établissement → afficher « Hospital Affinity ». Ne jamais inventer « HCP Affinity » sans donnée individuelle.

## 35. PROXY CONFIGURABLE
La BU peut décider d'utiliser l'affinité de l'établissement comme proxy pour les HCP de cet établissement — règle explicite, configurable, visible (ex. « Affinity source: Hospital proxy — CHU Oran »).

## 36. POTENTIEL
Vient principalement du terrain. Le CAM renseigne une valeur factuelle (ex. 27 patients VIH/semaine). Éviter « choisissez A/B/C/D » : l'utilisateur fournit la donnée, AMD calcule la conséquence.

## 37. HISTORISER LE POTENTIEL
Conserver valeur, métrique, auteur, date, source, commentaire. Jamais d'écrasement silencieux.

## 38. SEGMENTATION STUDIO
Module entièrement distinct : règles potentiel ; règles affinité ; matrice ; versions ; multi-product ; BU priorities ; visit rules.

## 39. MATRICE DE BASE
Deux axes par défaut : High Potential + High Affinity = A ; High Potential + Low Affinity = B ; Low Potential + High Affinity = C ; Low Potential + Low Affinity = D.

## 40. H N'EST PAS A++
H = Décideur stratégique, séparé de A/B/C/D. Ex. Dr X : Role H / Decision Maker ; RAL B, DTG A, DEL C ; Strategic status H.

## 41. H = FRÉQUENCE SPÉCIALE
Règle « H frequency per cycle = X », défaut configurable (ex. 2 visites/cycle). Ne jamais hardcoder 2.

## 42. SEGMENTATION PAR PRODUIT
Jamais « Dr X = A ». Écrire Dr X / RAL = A ; Dr X / DTG = B ; Dr X / DEL = A.

## 43. TARGET / NON TARGET
Avant A/B/C/D, AMD sait si le HCP est cible. États : Not Target · Pending Data · A · B · C · D. **Ne jamais transformer une donnée manquante en D.**

## 44. MULTI-SPÉCIALITÉ ET TARGETING
Un HCP est cible parce que : sa spécialité est ciblée ; son rôle est ciblé ; son établissement est ciblé ; un override approuvé le rend cible. Targeting configurable.

## 45. MULTI-PRODUCT
Maximum trois produits par stratégie active. RAL = A, DTG = B, DEL = A → affichage « A / B / A ».

## 46. BU PRIORITY
À partir des segments produit, priorité globale (A/A/A → P1 ; A/A/B → P1 ; A/B/B → P2 ; etc.). Aucune combinaison hardcodée.

## 47. PRIORITY RULE BUILDER
Interface : IF at least 2 products are A THEN Priority 1 ; IF A + B + B THEN Priority 2 ; etc.

## 48. FALLBACK
Combinaisons non spécifiées : score interne configurable (A = 4, B = 3, C = 2, D = 1 ; poids Product #1 = 1, #2 = 0,8, #3 = 0,6). **Règle BU explicite > score de repli.**

## 49. CYCLE MANAGEMENT
Module dédié. Défaut 1 cycle = 1 mois, configurable : 4 semaines ; 1 mois ; 6 semaines ; trimestre ; custom.

## 50. SNAPSHOT DU CYCLE
Au lancement, figer : produits actifs ; ranking ; segmentation rules ; BU priorities ; visit rules ; CAM assignments. Les changements ultérieurs ne détruisent pas l'historique.

## 51. VISIT RULE ENGINE
Configurable : H 2/cycle ; P1 2/cycle ; P2 1/cycle ; P3 1/2 cycles ; etc.

## 52. UNE VISITE PEUT COUVRIR PLUSIEURS PRODUITS
Pas 3 visites parce que 3 produits. Exemple : Primary RAL ; Secondary DEL ; Optional DTG.

## 53. TERRITOIRES
Supporter territory ; region ; facility ; éventuellement In/Out. Les règles de fréquence peuvent intégrer le territoire si Adventum le souhaite.

## 54. CAPACITÉ CAM
7 visites/jour × 20 jours terrain = 140 visites. Calcul automatique. Afficher required / completed / remaining / capacity / utilization.

## 55. PAS DE FAUSSE PRÉCISION
CAM à 140 de capacité théorique mais 10 jours d'absence : capacité réelle du cycle ajustable. Architecture prévue pour cette évolution.

## 56. COCKPIT BU
Comprendre la BU en quelques secondes. Top KPIs : active products ; specialties ; HCP targets ; H ; A/B/C/D per product ; P1/P2/P3 ; required visits ; completed visits ; coverage ; capacity utilization ; consumption ; market trends ; spend ; revenue si disponible.

## 57. COCKPIT MULTI-SPÉCIALITÉ
« All specialties » ou filtre Neurology / Dermatology / Urology ; mêmes KPIs selon la spécialité.

## 58. RECHERCHE GLOBALE CROSS-MODULE
« Raltegravir » retrouve : Product, Regulatory, Tender, Contract, BU, Consumption, Segmentation, Expenses, Events, Visits. Un objet retrouvable par plusieurs chemins, mais le même objet.

## 59. QUESTIONS MÉTIER À POUVOIR RÉPONDRE (à terme)
Combien dépensé sur Raltegravir cette année ? Quels coûts directs / alloués ? Quels AO concernaient Raltegravir ? Combien vendu ? Quels HCP sont A sur RAL ? Quels HCP sont A sur deux produits ? Quels H sont sous-visités ? Quel CAM a le plus de P1 ? Quelle spécialité consomme le plus de ressources dans cette BU ? Quel produit est le plus consommé à Oran ? — possible seulement si les objets sont correctement liés dès maintenant.

## 60. REPORTING AUTOMATIQUE
Ne jamais demander « remplissez un reporting hebdomadaire de ce que vous avez déjà fait dans AMD ». Les actions enregistrées génèrent le reporting.

## 61. ANTI-BUREAUCRACY
Avant d'ajouter un champ : « AMD connaît-il déjà cette information ? » Si oui, ne pas la demander (si HCP → facility existe, ne pas retaper l'établissement pendant une visite).

## 62. AUTO-PROPAGATION
Une relation change → vues dérivées mises à jour. Dr X passe d'Ouest 1 à Ouest 2 : ne pas modifier 10 fichiers, mettre à jour l'affectation centrale.

## 63. MANUAL OVERRIDES
Possibles. Toujours stocker : calculated value ; override value ; effective value ; author ; date ; reason ; expiration éventuelle.

## 64. RULE VERSIONING
Versionner : segmentation ; affinity ; potential thresholds ; priority rules ; visit rules. RAL v1 High Potential 22, RAL v2 25 — ne pas modifier rétroactivement les cycles passés.

## 65. DATA FRESHNESS
Pour toute donnée dynamique : current ; last updated ; stale ; missing (ex. Potential 25 patients/week, mis à jour il y a 12 jours).

## 66. EXPLAINABILITY — « WHY ? »
Tout calcul important répond à Why. Ex. Why A ? Potential 27 / seuil 22 → High ; Affinity 14 % / seuil 10 % → High ; donc A.

## 67. WHY P1 ?
RAL A, DTG A, DEL B ; règle matchée : « au moins 2 A → Priority 1 ».

## 68. WHY 2 VISITS ?
HCP Priority 1 ; règle de cycle « Priority 1 = 2 visites » ; Required 2.

## 69. PERMISSIONS
Super Admin : tout. Director Operations : BU + segmentation + cycles. BU Manager : sa BU. CAM : son portefeuille + mises à jour terrain. Finance : données financières. Regulatory : périmètre regulatory. Connecté ≠ tout visible.

## 70. AUDIT (minimum)
Imports ; mappings ; rule changes ; potential changes ; segment changes ; overrides ; cycle changes ; BU changes ; specialty assignments ; product ranking ; financial allocations.

## 71. IMPORT DU FICHIER DE SEGMENTATION ACTUEL
Utiliser le fichier actuel de segmentation Adventum comme référence métier, jeu de test et outil de validation. NE PAS copier aveuglément ses erreurs : il contient des règles et certaines incohérences historiques. Le nouveau moteur reproduit les règles VOULUES, pas les bugs du fichier.

## 72. MIGRATION DES DONNÉES EXISTANTES
Avant toute migration : détecter doublons ; HCP sans facility ; produits dupliqués ; normaliser ; conserver provenance ; produire un rapport. Ne pas détruire les anciennes données.

## TESTS OBLIGATOIRES (73–86)
73. **BU multi-spécialité** : BU X = Neurology + Dermatology + Urology ; Produit A = Neuro ; B = Dermato ; C = Neuro + Urologie. Vérifier targeting, filtering, dashboards, visits, segmentation, permissions.
74. **BU single specialty** : BU HIV / Infectious Diseases. Le cas simple reste extrêmement simple ; l'UX ne se complique pas parce que le backend supporte le multi.
75. **Single source of truth** : créer RAL, l'utiliser dans Regulatory, BU, Tender, Consumption ; vérifier le MÊME `product_id`.
76. **Product 360** : depuis RAL, naviguer vers BU, consumption, segmentation, tender, regulatory, information financière disponible.
77. **Double saisie** : simuler une visite ; HCP, facility, BU, territory non ressaisis.
78. **Excel hétérogène** : deux fichiers, mêmes données, colonnes différentes → même format canonique.
79. **Données ambiguës** : produit inconnu → Needs Review ; jamais de mapping inventé silencieusement.
80. **Missing data** : potentiel manquant → Pending Potential ; jamais D.
81. **H** : HCP H avec segments C/D/C → reste H ; fréquence H appliquée ; segments visibles.
82. **Multi-product** : A/A/B, règle ≥ 2 A = P1 → P1.
83. **Rule change** : High Affinity 10 → 12 ; avant application, AMD produit nombre impacté, ancien segment, nouveau segment ; aucune modification silencieuse.
84. **Historique** : fermer le cycle d'octobre, changer les règles en novembre ; octobre reste inchangé.
85. **Finance** : 1 000 € de coût produit direct ; 3 000 € de coût BU partagé ; allocation RAL 40 % → vue produit : Direct 1 000 ; Alloué 1 200 ; Attribué 2 200. Ne jamais présenter 2 200 comme totalement direct.
86. **Permissions** : un CAM de la BU HIV ne peut pas modifier les règles de segmentation, la structure BU, l'allocation financière.

## 87. PAS DE FEATURE TERMINÉE SANS TEST
Tests automatisés appropriés (unit, integration, API, database, end-to-end) — pas seulement manuel.
## 88. RE-TEST APRÈS CORRECTION
Chaque correction de bug : un test qui reproduit le bug ; la correction ; un re-test ; une vérification de non-régression.
## 89. QUALITY GATE APRÈS CHAQUE PHASE
Database (relations correctes ?) · Business Logic (calculs corrects ?) · UX (simple ?) · Security (permissions ?) · Audit (traçabilité ?) · Integration (autres modules fonctionnels ?) · Tests (tous verts ?). Sinon la phase n'est PAS terminée.

## 90. PHASAGE
Phase 0 Repository audit · 1 Canonical entities / master-data architecture · 2 Business Units + multi-specialty · 3 Product / BU / Specialty targeting · 4 Annuaire integration · 5 Consumption Intelligence · 6 Affinity engine · 7 Potential collection · 8 Segmentation Studio · 9 Multi-product priorities · 10 Cycles + visit frequency · 11 Tender / Regulatory / Finance linking · 12 360° views · 13 Cockpits · 14 AI-assisted querying / explanations.

## 91. APRÈS CHAQUE PHASE — court rapport technique
Implemented · Existing code reused · Schema changes · Tests · Bugs found · Corrections · Re-tested · Remaining risks. Puis poursuivre.

## 92. AUTONOMIE
Ne pas demander de validation humaine pour chaque petit détail. Décisions techniques évidentes : l'option robuste et cohérente avec l'existant. Si une décision modifie profondément une règle métier non définie ici : la SIGNALER explicitement au lieu de l'inventer.

## 93. INTERDICTIONS
Ne pas : créer un deuxième Product model sans justification ; dupliquer les HCP ; hardcoder les BU ; hardcoder les spécialités ; hardcoder 22 patients ; hardcoder 10 % ; hardcoder 2 visites ; considérer H comme A++ ; considérer missing comme D ; attribuer une hospital affinity directement à un HCP sans règle ; modifier rétroactivement les cycles historiques ; additionner silencieusement des imports doublons ; utiliser un LLM pour décider arbitrairement A/B/C/D ; demander à l'utilisateur une donnée déjà connue du système.

## 94. OBJECTIF UX
Le Directeur des Opérations dispose d'un cockpit extrêmement complet ; un CAM a une interface extrêmement simple. Exemple écran CAM : Dr X · Priority 1 · RAL — A · DTG — B · DEL — A · Visits required 2 · Completed 1 · Main objective RAL · [Update potential] [Complete visit]. Fin.

## 95. OBJECTIF FINAL
AMD n'est pas un ERP où les employés remplissent des formulaires pour alimenter l'administration. C'est un système opérationnel où le travail réel de l'employé crée automatiquement les données nécessaires au pilotage.

## 96. MODÈLE MENTAL FINAL
Business Unit ↕ Specialties ↕ Products ↕ HCP / Facilities ↕ Market Consumption ↕ Affinity + Potential ↕ Product Segmentation ↕ BU Priority ↕ Cycle / Visits ↕ Tender / Contract ↕ Financial Impact. Tous reliés.

## 97. NORTH STAR
**One company graph. One source of truth. Minimal manual input. Maximum automatic intelligence.** « Pourquoi dois-je saisir cette information ? » → uniquement parce qu'AMD ne peut réellement pas la connaître autrement. Tout le reste est récupéré, relié, calculé, pré-rempli ou automatisé.

## 98. DERNIÈRE CONSIGNE
Ne pas faire fonctionner les écrans individuellement : après chaque changement, tester les conséquences de bout en bout. Ex. modifier la spécialité d'un produit puis vérifier : 1 targeting ; 2 HCP concernés ; 3 segmentation ; 4 cycle ; 5 cockpit ; 6 analytics ; 7 historique ; 8 permissions. Chaque donnée centrale a des conséquences dans plusieurs modules : c'est ce qui différencie AMD d'un ensemble de CRUD indépendants. **Un système connecté, pas une collection de pages.**
