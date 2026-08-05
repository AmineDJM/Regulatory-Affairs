# Analyseur CTD — audit, plan de migration et sauvegarde

> Chantier « analyseur CTD réglementaire algérien : plus puissant, multimodal, traçable,
> optimisé en coût, avec apprentissage des réserves ANPP ».
> **On améliore l'existant, on ne le reconstruit pas.**

---

## 1. Point de restauration & sauvegarde

| Élément | Valeur |
|---|---|
| Commit sain avant chantier | `23d5f5b` (poussé) |
| Étiquette locale | `pre-ctd-upgrade-2026-08-05` |
| État vérifié | `typecheck` OK · `build` OK · **630 tests** |

**Revenir en arrière (code)** : `git checkout 23d5f5b`.

**Base de données** : aucune sauvegarde n'est prise depuis l'environnement de développement —
la base de production vit sur Render et n'est pas accessible d'ici. Ce n'est pas un oubli, c'est
une limite qu'il faut connaître. **Avant le déploiement**, côté Render :

```
Dashboard → base PostgreSQL → Backups → « Create backup »
```

**Pourquoi le risque reste faible malgré tout** : toutes les migrations de ce chantier sont
**additives et idempotentes** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`DO $$ … EXCEPTION WHEN duplicate_object`. Aucune colonne n'est supprimée, aucune donnée
existante n'est transformée. Un retour de code n'exige donc **pas** un retour de base : les
tables ajoutées deviennent simplement inutilisées.

---

## 2. Audit de l'existant

Le module `src/lib/regulatory/intelligence/` fait ~13 000 lignes réparties en 20 domaines.
**Il est bien plus avancé qu'un simple analyseur** — voici ce qui est déjà là, et ce qui manque.

### 2.1 Ce qui existe et fonctionne

| Domaine | État |
|---|---|
| **Téléversement** | Sessions directes en tranches, sans plafond serveur, reprise sur erreur (`upload/`, 1 235 l.) |
| **Archives** | Inspection ZIP, arborescence, anti-zip-bomb (`ingest/`, 1 080 l.) |
| **Extraction** | PDF, DOCX, XLSX, CSV/TXT/XML — parse lourd déporté en *worker thread* (`extract/`) |
| **OCR** | Mistral OCR (primaire, cloud) + repli tesseract.js local ; rastérisation PDF **robuste par page** ; découpage des PDF massifs (`ocr/`, 1 016 l.) |
| **Classification CTD** | Module + section, confiance, méthode (code-chemin / mot-clé / module seul) |
| **Moteur de règles** | Packs versionnés, administrables (`rules/`, 992 l.) |
| **Agents IA** | 14 agents de revue sourcée, orchestrateur, découpage en parts (`agents/`, 940 l.) |
| **Jumeau numérique** | Extraction de faits canoniques + **détection de conflits interdocuments** (`twin/`, 1 047 l.) |
| **Corpus** | Sources → versions → sections, **approbation humaine**, statut ACTIVE qui fait foi (`corpus/`) |
| **RAG** | Recherche **lexicale** : FTS français + repli trigram (`corpus/rag.ts`) |
| **Réserves** | Cycles par dossier, OCR de la lettre, décomposition en points, réponses (`reserves/`, 427 l.) |
| **Comparaison de versions** | `diff/compare-versions.ts` |
| **Simulateur d'examen**, **boucle fournisseur**, **génération de documents**, **cycle de vie** | présents |
| **Traçabilité** | `RegulatoryAuditLog`, sorties IA marquées `draft` tant qu'un humain n'a pas revu |
| **Garde-coût** | `REG_AI_MAX_CHUNKS`, `REG_AI_MAX_FINDINGS`, deux paliers de modèle |

**Déduplication SHA-256** : déjà en place sur `RegulatoryDocument.sha256` (indexé) et sur les
tranches de téléversement.

### 2.2 Les écarts réels avec la demande

| # | Écart | Gravité |
|---|---|---|
| **É1** | **Les réserves sont attachées à UN dossier.** Il n'existe aucune bibliothèque transverse : impossible de retrouver « la même réserve déjà reçue sur un autre produit », ni de statistiques par fournisseur / produit / module / type d'erreur. C'est le cœur de l'apprentissage demandé — et il manque. | ★★★ |
| **É2** | Les points de réserve ne portent **ni produit, ni DCI, ni forme, ni dosage, ni procédure, ni module/section CTD, ni sévérité, ni justification réglementaire, ni action demandée, ni documents correctifs, ni preuve (fichier + page + extrait)**. Les statuts se limitent à OPEN/DRAFTED/APPROVED — il manque *acceptée* et *réitérée*, qui sont précisément les signaux d'apprentissage. | ★★★ |
| **É3** | **Aucun suivi de coût par fichier, étape, modèle ou dossier.** `AiUsageLog` ne stocke ni jetons ni coût, et n'est rattaché ni au dossier ni à l'étape. Aucun budget maximum par dossier. | ★★★ |
| **É4** | **Pas de Batch.** Chaque part est un appel synchrone plein tarif, alors que l'analyse d'un dossier est par nature asynchrone et tolère 24 h. | ★★ |
| **É5** | **RAG purement lexical.** Deux réserves qui disent la même chose avec d'autres mots ne se retrouvent pas. Pour « réserves similaires », c'est éliminatoire. | ★★ |
| **É6** | **Corpus vide de l'essentiel** : les lignes directrices ANPP, ICH, WHO ne sont pas ingérées, et rien ne surveille les nouvelles publications ANPP. | ★★ |
| **É7** | **Findings incomplets** au regard de l'exigence : pas de confiance, pas de numéro de page, pas de valeurs contradictoires, pas de recommandation, pas de renvoi aux réserves similaires. | ★★ |
| **É8** | **Multimodal absent.** L'OCR rend du texte ; **les graphiques, courbes de stabilité, chromatogrammes et schémas ne sont pas lus**. Une courbe de dissolution hors spécification passe inaperçue. | ★★ |
| **É9** | Pas de **réutilisation inter-versions** des résultats d'analyse : un fichier inchangé entre v1 et v2 est ré-analysé et refacturé. | ★★ |

---

## 3. Décision de modèle

**`gpt-5.6-luna` (OpenAI)** devient le palier économique par défaut de l'analyseur CTD, sur
demande explicite. Vérifié à la source avant câblage :

| Caractéristique | Valeur |
|---|---|
| Identifiant API | `gpt-5.6-luna` |
| Entrée / sortie | **0,20 $ / 1,20 $** par million de jetons |
| Batch | **×0,5** (fenêtre 24 h) |
| Contexte / sortie max | 1 050 000 / 128 000 jetons |
| Modalités | **texte + image** |
| Sorties structurées | schéma JSON |
| Connaissances arrêtées au | 16 février 2026 |

**Pourquoi c'est le bon choix ici**, au-delà du prix : la **vision** permet d'envoyer les pages
**rastérisées** — que l'OCR réduisait à du texte — et donc de lire enfin les courbes, les
chromatogrammes et les schémas (écart É8). Le contexte d'un million de jetons supprime une
grande partie du découpage en parts.

**Ce qui ne change pas** : Claude reste le palier **qualité** (arbitrage des ambiguïtés,
findings critiques, rédaction des réponses aux réserves) et alimente le reste de la plateforme.
Mistral OCR reste le moteur OCR primaire. **Aucun retrait, aucune régression.**

---

## 4. Plan de migration — additif, par lots

Chaque lot est livrable seul, vérifié `typecheck` + `build` + tests, et **ne casse rien** :
les écrans, API et données actuels restent en place ; les nouveautés arrivent derrière les
drapeaux de version (TEST → PROD) déjà en service.

| Lot | Contenu | Écarts couverts |
|---|---|---|
| **0** | Point de restauration, procédure de sauvegarde, ce document | — |
| **1** | Client Luna (JSON schema + vision), **coût par appel** rattaché au dossier / à l'étape / au fichier, **budget par dossier**, Batch, réutilisation par SHA-256 | É3, É4, É9 |
| **2** | **Bibliothèque de réserves ANPP transverse** : modèle complet, ingestion multi-formats, preuve fichier+page+extrait, similarité, règles dérivées **validées humainement** | É1, É2 |
| **3** | Findings enrichis (règle, confiance, page, extrait, valeurs contradictoires, recommandation, réserves similaires) + probabilité de réserve | É7 |
| **4** | Corpus ANPP / ICH / WHO + veille des publications | É6, É5 (RAG) |
| **5** | Lecture **multimodale** des graphiques et images | É8 |

### Règles tenues sur tout le chantier

1. **Rien n'est supprimé.** Les modèles existants (`RegulatoryReserveCycle`, `RegulatoryReservePoint`)
   restent ; la bibliothèque transverse s'ajoute à côté et s'alimente depuis eux.
2. **Aucun apprentissage aveugle.** Une réserve historique ne devient JAMAIS une règle
   opposable sans validation Regulatory explicite. Toute règle dérivée porte un score de
   confiance, ses précédents, et un statut de validation humaine.
3. **La preuve avant l'affirmation.** Tout élément appris cite son fichier, sa page et son
   extrait exact.
4. **Licences respectées.** L'ouvrage *International Pharmaceutical Product Registration*
   (CRC Press) et la **Pharmacopée européenne** (EDQM) sont **référencés, jamais ingérés** :
   leur contenu est sous licence. Le corpus n'accueille que les textes publiés librement par
   l'ANPP, l'ICH, l'OMS et l'EMA.
5. **Le brouillon ICH M4Q(R2)** est étiqueté `DRAFT / NON OPPOSABLE` et ne peut pas fonder un
   finding bloquant.
