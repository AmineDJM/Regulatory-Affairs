# AGENT_API_GUIDE — guide pour un agent IA qui ne connaît rien à cet ERP

## 1. L'entreprise

**Adventum Pharma** est un groupe pharmaceutique **algérien**. Il enregistre, fabrique ou
importe des médicaments, les vend en ville (officines) et à l'hôpital, et répond aux appels
d'offres de la **PCH** (Pharmacie Centrale des Hôpitaux). Le groupe compte plusieurs **entités**
juridiques (Adventum, Pharmagène…). La monnaie est le **dinar algérien (DZD)**. Tout est en
français.

## 2. Ce que fait l'ERP

**AMD Internal OS** couvre l'entreprise entière : dossiers réglementaires, achats, budgets,
finances, RH, force de vente, congrès et événements, information médicale, stocks, secrétariat.
33 modules, 195 objets métier.

Le cœur du métier est le module **Regulatory** : faire enregistrer un médicament auprès de
l'**ANPP** (Agence Nationale des Produits Pharmaceutiques) jusqu'à obtenir sa **DE** (décision
d'enregistrement). C'est long, jalonné, et c'est là que l'agent apporte le plus de valeur.

## 3. Vocabulaire indispensable

| Terme | Sens |
|---|---|
| **DCI** | Dénomination Commune Internationale — la molécule (« PARACÉTAMOL »). Une *association* s'écrit « A + B ». |
| **ANPP** | L'autorité algérienne d'enregistrement. |
| **DE** | Décision d'Enregistrement — l'autorisation finale. L'objectif de tout dossier. |
| **AMM** | Autorisation de Mise sur le Marché. |
| **BV** | Bon de Virement — paiement dû à l'ANPP, émis depuis Regulatory vers les Finances. |
| **CTD** | Le dossier technique déposé (format international). |
| **Réserve** | Objection de l'ANPP à laquelle il faut répondre. |
| **Présoumission** | Avis préalable de l'ANPP : *favorable* → on continue, *défavorable* → corriger et redemander. |
| **Variation** | Passage de l'importation vers la fabrication locale (packaging secondaire → primaire → full process). |
| **PCH** | Pharmacie Centrale des Hôpitaux — le grand acheteur public. |
| **Moyens généraux** | Le budget « fournitures et frais » d'un département. |
| **Caisse d'avance** | Argent liquide confié à l'assistante de direction, distinct du budget. |

⚠️ **Budget ≠ caisse.** Le budget dit ce qu'on a le **droit** de dépenser ; la caisse, ce qu'on a
**en main**. Ne jamais confondre les deux dans une analyse.

## 4. Les trois appels par lesquels commencer

```http
GET /api/v1/meta/modules        # que puis-je faire, et au nom de qui ?
GET /api/v1/search?q=…          # trouver quelque chose
GET /api/v1/entities/{objet}/{id}/workflow   # où en est-on, qu'est-ce qui bloque ?
```

`list_modules` rend les droits **effectifs** de l'identité au nom de laquelle tu agis, action par
action, et dit si tu es en **lecture seule**. Commence toujours par là : cela t'évite de tenter
une action vouée au refus.

## 5. Comment fonctionne l'autorisation (à comprendre absolument)

Deux couches **cumulées** :

1. Les **portées** de ta clé — ce que l'intégration a le droit de faire.
2. L'**identité** au nom de laquelle tu agis — ce que cette personne voit dans l'ERP.

Tu ne peux jamais dépasser ni l'une ni l'autre. Un refus te dit **laquelle** manque :
`MISSING_SCOPE` (demander une portée) ou `FORBIDDEN` (la personne n'a pas ce droit). Ce ne sont
pas les mêmes suites à donner.

**Un objet hors de ta portée répond 404, pas 403.** Ne conclus donc jamais « cet objet n'existe
pas » : conclus « il n'existe pas *pour moi* ».

**Les totaux sont toujours ceux de ta portée.** `page.total` n'est pas le total absolu de
l'entreprise. Ne présente jamais un total comme exhaustif sans cette réserve.

## 6. Trouver une information

```http
GET /api/v1/search?q=cladribine
GET /api/v1/search?q=cladribine&entities=regulatory_dossier,sale&from=2026-01-01
```

La recherche traverse tous les objets que tu peux lire. Chaque résultat porte son `path` :
enchaîne dessus, ne devine jamais une URL.

Pour une liste filtrée précise :

```http
GET /api/v1/entities/regulatory_dossier?status=in:SUBMITTED,AWAITING_ANPP&priority=CRITICAL&sort=targetDate:asc&limit=200
```

Syntaxe des filtres : `champ=valeur`, `in:A,B`, `gte:2026-01-01`, `lte:…`, `contains:texte`,
`startsWith:…`, `not:…`, `null`. Un champ inconnu est **refusé** (jamais ignoré) : une liste
silencieusement non filtrée te ferait prendre une partie pour le tout.

Pour savoir quels champs existent : `GET /api/v1/meta/entities/{objet}`.

## 7. Suivre un dossier et dire ce qui le bloque

```http
GET /api/v1/entities/regulatory_dossier/{id}/workflow
```

Réponse (extrait réel) :

```json
{
  "workflow": "regulatory_anpp_17_steps",
  "status": "PRE_SUBMISSION",
  "progress": { "done": 0, "total": 22, "percent": 0 },
  "currentStep": { "label": "Réception du CTD complet", "responsible": "Fournisseur / RA" },
  "owner": { "userId": null, "name": null },
  "deadlines": [ { "label": "Date cible de dépôt", "date": null, "overdue": false } ],
  "blockers": [
    { "code": "NO_OWNER", "message": "Aucune personne chargée du dossier : personne ne le porte." },
    { "code": "NO_TARGET_DATE", "message": "Aucune date cible de dépôt fixée par la supervision." },
    { "code": "NO_DOCUMENTS", "message": "Aucune pièce déposée sur le dossier." }
  ]
}
```

**C'est la réponse à « qu'est-ce qui bloque ? »** : `blockers` liste des faits vérifiés, pas des
suppositions. `currentStep.responsible` dit **qui** doit agir. `owner` dit **qui porte** le
dossier — et `owner.name = null` est en soi un problème à signaler.

## 8. Savoir ce que tu peux faire

```http
GET /api/v1/entities/{objet}/{id}/available-actions
```

Chaque action rend `allowed: true|false` et, si `false`, la **raison** : portée manquante ou
droit refusé. Rapporte cette raison à l'utilisateur au lieu d'échouer silencieusement.

## 9. Historique — humains et agents séparés

```http
GET /api/v1/entities/{objet}/{id}/history
```

Rend `humanActions` (journal d'audit : qui a changé quoi) **et** `agentCalls` (appels d'API).
Les deux sont distincts à dessein : « l'agent l'a fait » et « une personne l'a fait » ne
s'interprètent pas pareil.

## 10. Pièces jointes

```http
GET /api/v1/entities/{objet}/{id}/documents     # métadonnées + downloadPath
GET /api/v1/documents/{id}/content              # le contenu
```

Aucun chemin de fichier interne n'est jamais exposé. Le droit se lit sur l'**objet porteur** :
c'est l'accès au dossier qui donne accès à sa facture.

## 11. Écriture (à venir)

Les écritures passeront par un registre d'opérations appelant **les mêmes fonctions métier que
les écrans**. Elles exigeront `Idempotency-Key` : rejoue une requête perdue **avec la même clé**
plutôt que de la refaire, sinon tu crées deux dossiers ou valides deux fois.

## 12. Trois exemples complets

### « Où en est notre portefeuille réglementaire ? »

```http
GET /api/v1/entities/regulatory_dossier?limit=500&sort=priority:desc
```
Puis, pour les dossiers critiques, `…/{id}/workflow`. Regroupe par `blockers[].code` : tu obtiens
« 41 dossiers sans responsable, 69 sans date cible » — un constat actionnable, pas une liste.

### « Qui doit agir sur REG-2026-004 ? »

```http
GET /api/v1/search?q=REG-2026-004&entities=regulatory_dossier
GET /api/v1/entities/regulatory_dossier/{id}/workflow
```
→ `owner.name` (qui porte) et `currentStep.responsible` (qui doit agir à cette étape). Si
`owner.name` est nul, c'est **le** blocage à remonter.

### « Combien a-t-on dépensé en moyens généraux cette année ? »

```http
GET /api/v1/entities/department_budget?year=2026&kind=OPERATING
GET /api/v1/entities/department_expense?year=2026&kind=OPERATING&limit=500
```
Somme les `amount`. ⚠️ Ne mélange pas les `kind` : l'enveloppe « moyens généraux » (`OPERATING`)
ne porte pas le budget métier (`ACTIVITY`). Et rappelle que le total est **celui de ta portée**.

## 13. Règles de conduite

1. **Ne présente jamais un total comme exhaustif** — il est borné par ta portée.
2. **Ne conclus pas d'un 404 qu'un objet n'existe pas.**
3. **Ne devine jamais une URL** : suis les `links` et `path` rendus.
4. **Cite le `correlationId`** quand tu signales une erreur.
5. **N'invente aucun chiffre.** Un champ vide reste vide : c'est une information, pas un trou à
   combler.
6. **Distingue déclaré et acquis** : un statut de fabrication « déclaré » n'est pas une variation
   obtenue ; un budget alloué n'est pas une dépense.
