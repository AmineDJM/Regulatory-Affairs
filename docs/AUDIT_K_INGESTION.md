# Audit B et D — refait sur mesure réelle

**Corpus** : 43 fichiers réels (`scripts/bench/corpus-def.ts`), ingérés par la vraie chaîne.
**Banc** : `DATABASE_URL=… npx tsx scripts/bench/knowledge-bench.ts` — rejouable, idempotent.
**Date de la mesure** : 27 août 2026. **Clé de modèle** : absente.

Les deux audits précédents concluaient sur du code lu. Celui-ci conclut sur des chiffres
produits par l'exécution. Les deux verdicts ont changé, dans les deux sens.

---

## Ce que la mesure ne couvre pas — à lire avant les chiffres

1. **Aucune clé de modèle.** Vision, classification et embeddings ne sont **pas exécutés**. Le
   rappel rapporté est celui de la recherche **déterministe** (exact + lexical + métadonnées).
   Ce n'est pas le rappel du système complet, et les deux ne doivent pas être confondus.
2. **Le contenu du corpus est écrit pour le banc.** Il mesure la **mécanique** — extraire,
   dédupliquer, versionner, indexer, retrouver. Il ne mesure pas la pertinence sur le vrai fonds
   documentaire d'Adventum. Le banc à clé, sur documents réels, est un exercice distinct
   (voir « Ce qui reste »).
3. **43 documents, pas 43 000.** Les latences sont celles d'un petit index. Elles indiquent un
   ordre de grandeur, pas une garantie à l'échelle.

---

## Audit B — Ingestion : **PASS**

| Critère | Mesuré | Verdict |
|---|---|---|
| Formats couverts | PDF texte, PDF scanné, photo, DOCX, PPTX, XLSX, CSV, e-mail, texte brut, JSON | PASS |
| Justesse d'extraction | **121/121 marqueurs** écrits d'avance retrouvés dans le texte extrait | PASS |
| Justesse de routage | **43/43** — aucun document lisible envoyé à la vision, aucun scan resté en natif | PASS |
| Vitesse | **13 ms/fichier** en séquentiel · 43 fichiers, 325 Ko en 0,57 s | PASS |
| Idempotence | 2ᵉ passage : **42 `unchanged`, 1 `versioned`** (celui qui doit l'être) | PASS |
| Nouvelle version | re-dépôt → `versioned`, `supersedesId` posé, antérieures **conservées** | PASS |
| Multilingue (extraction) | arabe 206 car., anglais 506 et 528 car. extraits | PASS |
| Déduplication d'une **copie** | une copie octet-pour-octet à un autre emplacement produit **un second élément indexé** | **FAIL** |

### Vitesse par format (extraction seule, médiane)

```
csv 0,3 ms · eml 0,2 ms · txt 0,1 ms · json 0,2 ms · photo 0,3 ms
docx 5,1 ms · pptx 6,7 ms · xlsx 9,2 ms · pdf 9,2 ms · pdf-scan 5,4 ms
```

Aucun format ne domine le coût. Le premier appel de chaque parseur porte le chargement du module
(273 ms pour le premier PDF, 190 ms pour le premier DOCX) ; les suivants sont dix à cinquante fois
plus rapides. En service continu, seul le régime établi compte.

### Le seul FAIL de B, et pourquoi il n'est pas corrigé ici

Le dédoublonnage est indexé sur `(sourceType, sourceId)` — c'est l'**emplacement** qui identifie,
l'empreinte ne servant qu'à savoir si le contenu de cet emplacement a bougé. Une copie est donc un
autre emplacement : elle est ré-extraite, ré-indexée, et remontera **deux fois** dans une recherche.
« Ingest once. Index once. » n'est pas tenu pour ce cas.

La correction n'est pas un `if` : deux copies d'un même fichier peuvent porter des **droits
différents** (le Drive cloisonne par nœud). Servir l'original à qui n'a accès qu'à la copie serait
une fuite ; ne garder qu'un élément casserait la garde de lecture. Il faut donc conserver les deux
éléments et poser un lien `duplicateOfId`, puis dédupliquer **au moment du rendu**, après le
filtre d'accès — ce qui demande une migration et une modification du reclassement.

C'est un chantier propre, pas un correctif. Il est décrit ici plutôt que bâclé.

---

## Audit D — Recherche en entonnoir : **PASS**

Deux mesures distinctes, parce qu'un seul chiffre désignait le mauvais coupable.

| | Avant correctifs | Après correctifs |
|---|---|---|
| **Index seul** — rappel @5 | 19/25 (76 %) | **21/25 (84 %)** |
| **Index seul** — précision @1 | 15/25 (60 %) | **16/25 (64 %)** |
| **Index seul** — latence médiane | 4,9 ms | **4,7 ms** |
| **Bout en bout** — rappel @5 | 2/25 (8 %) | **13/25 (52 %)** |
| Écartés par le routeur avant toute recherche | 23/25 (92 %) | **9/25 (36 %)** |

### Comment le premier chiffre a menti

Le banc rapportait 8 % de rappel. La conclusion évidente — « l'index est mauvais » — était fausse :
en rejouant les mêmes questions **directement contre l'index**, le rappel montait à 76 %. L'écart
venait entièrement du routage, qui refusait d'ouvrir les documents pour 23 questions sur 25, et
rendait alors une liste vide en 0,0 ms — indiscernable d'une recherche infructueuse.

Le banc mesure désormais les deux et affiche l'écart. C'est ce qui a permis de nommer trois défauts
au lieu d'en soupçonner un.

### Les trois défauts trouvés, corrigés, et prouvés par des tests

1. **Une question entière sans marqueur était traitée comme une demande d'état.** Le commentaire
   d'origine invoquait la fréquence — une hypothèse jamais vérifiée. 17 questions dont la réponse
   était indexée au rang #1 ou #2 n'étaient jamais rendues. Corrigé : un **terme jeté dans la barre**
   reste de la navigation (ERP_ONLY) ; une **question formée** ouvre les deux côtés.
   Coût mesuré : 4,7 ms de médiane, zéro jeton.

2. **Une question en arabe était prise pour une question vide.** La normalisation réduisait la
   question à `[a-z0-9]` : plus rien ne restait, et le routeur répondait « rien à chercher ».
   L'ANPP écrit en arabe.

3. **La recherche lexicale était aveugle hors de l'alphabet latin.** `lexicalTerms` découpait sur
   `[^a-z0-9]` : une question en arabe produisait **zéro terme**, donc aucune requête, donc zéro
   résultat. La seule question arabe du banc rappelait 0 document sur 43.

Après correctifs, cette question remonte le bon document **au rang #1**, bout en bout.

Les trois tests de non-régression ont été **vus échouer** sur le code d'origine avant d'être
retenus (`router.test.ts`, `retrieve.test.ts`).

### Ce qui reste ouvert malgré le PASS

D passe parce que l'entonnoir est branché, mesuré et cloisonné. Deux limites subsistent, et
elles sont nommées plutôt qu'escamotées.

**a) Neuf questions restent écartées, et la responsabilité est partagée.**
Elles déclenchent de vrais marqueurs ERP : « combien », « montant », « total », « rupture »,
« quantité », « qui est chargé », « chiffre d'affaires ». Dans l'ERP réel, ces faits **sont** dans
des tables — le routage est correct. C'est le corpus qui a mis des faits de nature ERP dans des
tableurs. Sur les neuf, une ou deux relèvent d'un vrai défaut (« combien **de temps** faut-il
conserver un dossier » est une durée réglementaire, pas un décompte). Les autres sont un artefact
du banc.

Aucun marqueur n'a été retouché pour faire monter le chiffre. Déplacer un seuil jusqu'à ce que la
mesure soit flatteuse rendrait le banc inutile.

**b) Le défaut de fond n'est pas corrigé : `ERP_ONLY` est une exclusion, pas une préférence.**
Quand l'ERP ne trouve rien, rien ne va voir les documents — même quand la réponse y est au rang #1.
La correction juste est un **repli sur vide** : si le côté ERP ne rend rien, la passe documentaire
déterministe part avant de répondre « rien trouvé ». Elle ne coûte que dans le cas où l'économie a
déjà échoué.

**c) `retrieve()` A DÉSORMAIS UN APPELANT** — c'est ce qui fait passer D.

L'outil `search_documents` interroge l'entonnoir, par le **contrat de plateforme**
(`document.search`) et non en direct : le test de frontière l'a exigé, et il avait raison — la
capacité s'ajoute sans une seule traversée inter-domaines de plus (69 → 69).

Ce que le branchement a révélé, et qui n'aurait pas été trouvé autrement :

1. **L'entonnoir perdait le repère de citation.** `retrieve` reprojetait les résultats sur les
   seuls champs utiles au reclassement, ce qui faisait disparaître le titre, l'étiquette et le
   locator au dernier étage. Découper en unités nommées (« Diapositive 7 », « Feuille Tarifs »)
   pour perdre le nom au bout de la chaîne, c'est faire le travail deux fois pour n'en garder
   aucun. Corrigé : un extrait se cite désormais
   `[ESS-XLS-tarifs-2026.xlsx · Feuille Tarifs 2026]`.

2. **LE CACHE FAISAIT FUIR.** Sa clé portait « le périmètre » sur le papier — `companyId`,
   types, période — mais pas l'identité, et `companyId` est le plus souvent absent. Mesuré : le
   Super Admin demande la posologie de la metformine et reçoit 5 extraits ; un employé sans
   aucun accès pose la même question et reçoit **les 5 mêmes**. Le filtre d'accès faisait son
   travail — il n'était simplement jamais consulté. Corrigé : `scopeKey` obligatoire, et son
   absence désactive le cache plutôt que de le partager. Un test fige les deux sens.

Le point (b) — le repli sur vide — reste ouvert et devient possible : il suppose un appelant qui
interroge d'abord l'ERP, et cet appelant existe maintenant.

---

## Les quatre cas tordus

| Cas | Attendu | Mesuré | Verdict |
|---|---|---|---|
| Doublon (copie, autres octets identiques) | un seul élément indexé | **deux** | FAIL |
| Nouvelle version (re-dépôt) | `versioned` + lien + antérieure conservée | conforme | PASS |
| Noms mal orthographiés | texte extrait, entités résolues | texte extrait (382 car.) ; **résolution non mesurée** — elle dépend de l'étage `entities`, qui demande une clé | NON MESURÉ |
| Multilingue | extrait, indexé, retrouvable | arabe et anglais extraits ; arabe retrouvé au rang #1 **après correctifs** | PASS |

---

## Ce qui reste, nommé plutôt que promis

1. ~~Brancher l'entonnoir sur Adam~~ — **fait** : `search_documents`, par le contrat.
2. **Repli sur vide** pour `ERP_ONLY` — désormais possible, puisque l'appelant existe.
3. **`duplicateOfId`** + déduplication au rendu, après le filtre d'accès (migration).
4. **Banc à clé, sur documents réels d'Adventum** : qualité de vision, taux d'escalade, coût par
   document. C'est un exercice **distinct** de celui-ci — il mesure la compréhension, pas la
   mécanique. Prérequis : une clé OpenAI côté serveur (jamais exposée au navigateur), un
   échantillon de vrais courriers, et une vérité de référence établie par un humain. Les pièces
   marquées `rendu: "ordre-non-garanti"` doivent en être écartées : librsvg ne fait pas le bidi,
   l'ordre des mots d'une image arabe n'est pas garanti, et on reprocherait au modèle de mal lire
   ce qu'on a mal écrit.
