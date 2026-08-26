# LA FRONTIÈRE ADAM ↔ ERP

*Rapport d'architecture — 26 août 2026*

---

## 1. Ce qu'on a mesuré avant de décider

Aucune ligne n'a été écrite avant l'audit. Voici l'état de départ, mesuré, pas estimé :

| | |
|---|---|
| Fichiers Adam (hors tests) | **123** — 69 384 lignes |
| Imports d'Adam vers l'ERP | **425** |
| Modules ERP distincts importés | **172** |
| Fichiers Adam concernés | **80** sur 123 |

**Par nature** — c'est ce classement qui a dicté l'architecture :

| Imports | Nature | Lecture |
|---|---|---|
| 136 | Actions serveur ERP | le chemin d'écriture |
| 105 | Autres modules ERP | utilitaires, Drive, IA, workflow |
| 84 | Sécurité / identité | `session`, `rbac`, `company` |
| 60 | Base de données | Prisma en direct |
| 16 | Requêtes métier | |
| 15 | Schéma (types générés) | `@prisma/client` |
| **9** | **Composants UI** | **déjà quasi découplé** |

Deux constats ont orienté toute la suite :

1. **Le couplage UI était déjà quasi nul** (9 imports). Ce que la mission demandait de découpler
   de ce côté-là était déjà fait.
2. **Le vrai couplage est données + actions + sécurité**, pas présentation.

`npm run adam:boundary` rejoue cet audit à tout moment.

---

## 2. Ce qu'on n'a PAS construit, et pourquoi

### Pas de microservices

La consigne finale tranchait : *« séparer c'est juste qu'il communique par API […] mais il reste
toujours là, partie intégrante »*. Adam reste donc dans le même processus. La séparation est
**dans le code**, pas dans le déploiement — et c'est ce qui permet de tenir l'exigence de latence
sans compromis.

### Pas de cache de données locales

La mission demandait « une représentation opérationnelle locale, rapide et synchronisée ». Avant
d'en construire une, on a mesuré ce qu'elle ferait gagner :

| Lecture canonique | p50 | p95 |
|---|---|---|
| `findPeople` (recherche annuaire) | **4,1 ms** | 6,6 ms |
| Registre complet, 100 personnes + coordonnées | **1,8 ms** | 2,0 ms |
| `count` employés | 0,6 ms | 0,9 ms |

Un tour d'Adam avec appel au modèle coûte de l'ordre de **la seconde**. Un cache de l'annuaire
ferait donc gagner **moins d'un demi pour cent** du temps d'un tour, en échange d'un risque de
péremption sur des adresses et des salaires.

**On ne l'a pas construit.** C'était exactement la « couche abstraite inutile » que la mission
interdit. La conclusion changerait si Adam passait derrière HTTP — le port est fait pour
l'accueillir ce jour-là, sans que le reste d'Adam le sache.

### Pas de 173 enveloppes

Envelopper les 172 modules importés aurait produit un miroir de l'ERP — plus de code, plus de
maintenance, aucune indépendance réelle. Le contrat est **sémantique et étroit** : il décrit ce
dont Adam a besoin, pas ce que l'ERP contient.

---

## 3. Architecture — avant / après

### Avant

```
   ADAM  ──────► prisma, session, rbac, actions/*, queries/*, components/*
   (123 fichiers)      425 imports, 172 cibles, aucune frontière
```

Adam lisait la base directement, appelait les actions par leur nom de fonction, et manipulait
`CurrentUser`. Rien n'empêchait un nouvel import ; rien ne disait où était la limite.

### Après

```
                    ADAM
              (intelligence, mémoire, voix, UI générative)
                        │
                        │  ne connaît QUE ceci :
                        ▼
        ┌───────────────────────────────────┐
        │   src/platform/  — LA FRONTIÈRE   │   contract.ts : ZÉRO import
        │   query · command · authorize     │   event-bus.ts · events.ts
        │   events                          │
        └───────────────────────────────────┘
                        │
                        │  un SEUL pont : in-process/adapter.ts
                        ▼
                   ERP PLATFORM
              (RH, Regulatory, Finance, Legal, Drive)
                        │
                Vérité canonique (PostgreSQL)
```

`src/platform/` **n'appartient ni à Adam ni à l'ERP**. Le placer d'un côté aurait recréé une
dépendance dans ce sens-là : l'ERP important « du Adam » pour annoncer qu'un paiement est validé
aurait été un couplage inverse, plus difficile à voir que le direct.

---

## 4. Le contrat — quatre verbes

```ts
interface PlatformPort {
  readonly contractVersion: string;                     // "1.0.0", versionné
  query(principal, query): Promise<PlatformQueryResult>; // lire l'état canonique
  command(principal, command): Promise<CommandOutcome>;  // demander une action
  authorize(principal, capability): Promise<boolean>;    // « a-t-elle le droit ? »
  subscribe(handler): Unsubscribe;                       // être prévenu des changements
}
```

`contract.ts` **n'importe rien** — ni Prisma, ni `@/lib/*`, ni un type généré. C'est la propriété
qui le rend portable : le jour où Adam devient un service à part, ce fichier part avec lui sans
modification. Un test le vérifie.

**`Principal` remplace `CurrentUser`** : id, nom, e-mail, rôle *opaque*, et un ensemble de
capacités (`RH:VIEW`, `FINANCE:EDIT`…) résolues **par la plateforme**. Adam les lit, il ne les
calcule jamais — raisonner sur le rôle reviendrait à réimplémenter le RBAC dans Adam et à le voir
diverger au premier changement de politique.

---

## 5. Comment Adam obtient ses données

**Aujourd'hui : appel de fonction.** L'adaptateur `src/platform/in-process/adapter.ts` implémente
le port par des appels directs. Pas de HTTP, pas de sérialisation, pas de réseau — **le coût par
rapport à l'existant est nul**.

C'est le cœur du compromis : on sépare le code sans séparer le déploiement, donc on gagne
l'indépendance sans jamais payer la latence des microservices.

**Demain : le même port derrière HTTP.** Adam ne change pas d'une ligne, parce qu'il ne connaît
que `PlatformPort`. Ce jour-là, les projections locales deviendront justifiées — et le port est
déjà fait pour les accueillir.

---

## 6. Comment les changements remontent à Adam

L'ERP publie des **faits** :

```ts
emit({ type: "hr.employee-added", subject: { type: "employee", id }, actorId, data: { fullName } });
```

Une ligne, un import, un nom pris dans une liste fermée de 17 types. Le coût d'instrumenter une
action est la condition pour que ce soit fait partout plutôt qu'aux trois endroits les plus visibles.

**Trois règles non négociables :**

1. **Des faits, pas des ordres.** Tous les noms sont des verbes au passé. `refresh-adam-cache`
   dirait à Adam quoi faire et ressouderait les deux systèmes — sous une couche d'événements, ce
   qui est pire que le couplage direct parce que c'est invisible.
2. **Publier ne peut RIEN casser.** Chaque abonné est isolé ; son erreur est journalisée et avalée.
   `emit` ne lève jamais. Un bus greffé sur des actions Finance et RH n'a le droit d'ajouter
   aucune nouvelle façon d'échouer.
3. **Charge utile minimale.** De quoi décider s'il faut relire — jamais l'entité complète. Un
   événement qui transporte la ligne entière devient une seconde source de vérité qui dérive :
   la « seconde base ERP concurrente » que la mission interdit.

**Instrumenté à ce jour** : `hr.employee-added`, `regulatory.owner-changed`, `mail.sent`. Un test
structurel échoue si l'un de ces `emit` disparaît — sans lui, Adam deviendrait sourd en silence.

### La projection qui en découle

Une seule, et les mesures la justifient : **le flux « quoi de neuf »**. Répondre à
« qu'est-ce qui a bougé ? » par lecture demande de balayer une dizaine de tables et de comparer
des horodatages. Par événements, c'est une lecture de tableau en mémoire — un ordre de grandeur,
et une capacité nouvelle plutôt qu'une capacité accélérée.

Elle est branchée sur l'outil `what_changed` existant, **sans ajouter un 78ᵉ outil** : les schémas
d'outils représentent déjà 85,7 % du contexte fixe d'Adam.

⚠ **Elle ne fait jamais foi.** C'est un indice (« ce dossier a bougé il y a deux minutes ») ; pour
dire ce qu'il contient, Adam relit la source canonique. Le bus est en mémoire et par processus :
avec plusieurs instances, ce flux est partiel. Un indice partiel reste utile ; une vérité
partielle serait un mensonge. La réponse le dit explicitement à l'utilisateur.

---

## 7. Comment les actions repartent vers l'ERP

```ts
command(principal, { actionId, args, idempotencyKey, origin })
```

L'adaptateur **passe le plat, et rien d'autre** : il n'évalue aucun droit, ne contourne aucune
approbation, ne fabrique aucun raccourci. `performAction` conserve l'arrêt d'urgence, les portes
RBAC, la revalidation canonique, l'audit et l'idempotence.

**L'identité est relue à la source**, jamais reconstruite depuis le `Principal` : celui-ci est une
vue, éventuellement périmée. Laisser Adam fabriquer l'utilisateur qui exécute reviendrait à lui
laisser fabriquer ses propres droits.

`idempotencyKey` est **obligatoire** dans le contrat : un « oui » redit, un rejeu de webhook et une
reprise de tâche décrivent la même action.

Le résultat distingue le **refus** (la plateforme a décidé) de la **panne** (elle n'a pas pu
décider). Les confondre produit soit des relances sur un refus définitif, soit un abandon sur une
erreur passagère.

---

## 8. Où est la vérité canonique

**Dans l'ERP, entièrement.** Adam ne détient aucune donnée métier. Le flux de changements ne
contient que des identifiants et des libellés — jamais de contenu. La règle est vérifiée par un
test qui glisse un salaire et un IBAN dans une charge utile et exige qu'ils n'apparaissent pas
dans la projection.

---

## 9. Le cliquet — ce qui rend la séparation irréversible

425 imports ne se retirent pas en un lot. Deux façons de traiter cela : une réécriture d'un bloc
(longue, risquée, invérifiable tant qu'elle n'est pas finie), ou un **cliquet**.

`src/platform/boundary.test.ts` :

1. **`src/platform/**` est à ZÉRO**, strictement, sauf le pont unique.
2. **La dette historique a un plafond de 425 qui ne peut que baisser.**
3. Le plafond doit rester **serré** (≤ 25 d'écart avec la mesure) — un plafond trop haut laisserait
   rentrer des dizaines d'imports sans rien signaler.
4. Le contrat reste **sans aucun import**.
5. Il n'y a **qu'un seul pont** — s'il y en avait deux, il n'y en aurait bientôt plus aucun.

Si le test échoue, il ne demande pas de relever le plafond : il dit qu'un nouvel import traverse
la frontière, et rappelle les trois issues (lecture → `query`, action → `command`, fait →
événement).

C'est ce qui transforme « on devrait découpler Adam » en un travail qui finira un jour.

---

## 10. Ce qui peut désormais évoluer indépendamment

| Peut changer sans toucher à l'autre | Condition |
|---|---|
| Modèles IA, Context OS, mémoire, voix, UI générative d'Adam | aucune — déjà indépendants |
| Schéma Prisma d'un domaine déjà migré | le contrat rend `PersonView`, pas `Employee` |
| Implémentation d'une action ERP | `actionId` est stable, le nom de fonction ne l'est pas |
| Transport (in-process → HTTP) | un second adaptateur, zéro ligne côté Adam |
| Ajout d'un abonné aux événements | le bus isole les abonnés |

---

## 11. Dette technique restante — dite franchement

1. **425 imports traversent encore.** La frontière existe et mord ; la migration commence. Les
   trois premières cibles à absorber, dans l'ordre du coût/bénéfice : `src/lib/prisma` (60),
   `src/lib/session` (44), `src/lib/rbac` (26).

2. **Trois lectures du contrat sont déclarées mais pas servies** (`record.get`, `record.search`,
   `pending-decisions.list`) : l'adaptateur lève une erreur explicite. Dire « pas encore servi »
   est plus honnête que rendre un tableau vide, qui se lirait « il n'y a rien ».

3. **Le bus est en mémoire et par processus.** Avec plusieurs instances, chaque instance ne voit
   que ses propres événements. Les projections sont conçues pour le tolérer (elles n'ont jamais
   autorité), et la réponse à l'utilisateur le dit. Le remplacement par un transport partagé ne
   touchera que l'intérieur d'`event-bus.ts`.

4. **Trois actions instrumentées sur des dizaines.** `hr.employee-added`,
   `regulatory.owner-changed`, `mail.sent`. Le catalogue en déclare 17 ; les autres attendent leur
   lot.

5. **`Principal` n'est pas encore utilisé par Adam.** L'adaptateur sait le produire
   (`principalOf`), mais les 123 fichiers d'Adam manipulent toujours `CurrentUser`. C'est le
   plus gros morceau de la migration (84 imports de sécurité/identité), et le plus délicat : il
   touche à toutes les portes.

---

## 12. Vérification

- `npx tsc --noEmit` — propre
- `npm run lint` — aucun avertissement
- `npx vitest run` — **3 704 tests passés**, 23 ignorés, 0 échec (dont 29 sur la frontière)
- `rm -rf .next && npm run build` — build propre
- `npx playwright test` — **13 passés**
- `npm run adam:boundary` — la dette, à jour
