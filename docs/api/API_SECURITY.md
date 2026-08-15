# API_SECURITY — authentification, portées, journalisation

## 1. Le principe : deux couches, toujours cumulées

Un agent n'emprunte **jamais** un compte humain partagé. Il a sa propre identité (`ApiClient`),
et son autorisation se lit sur **deux axes qui se multiplient** :

| Couche | Question | Où c'est décidé |
|---|---|---|
| **Portées** (scopes) | Qu'est-ce que cette *intégration* a le droit de faire ? | `ApiClient.scopes` |
| **Identité** (`actAs`) | Qu'est-ce que cette *personne* voit dans l'ERP ? | RBAC existant (`rbac.ts`) |

Concrètement : une clé avec `erp.write` rattachée à une assistante ne peut écrire que ce que
cette assistante pourrait écrire à l'écran. Et une clé rattachée au Super Admin mais limitée à
`erp.read` ne peut **rien** modifier, quel que soit le pouvoir de la personne.

C'est cette séparation qui permet d'ouvrir tout l'ERP en lecture à ChatGPT sans lui donner le
moindre droit d'écriture — puis d'élargir plus tard **sans toucher aux comptes humains**.

## 2. Les portées

| Portée | Ce qu'elle ouvre |
|---|---|
| `erp.read` | Lire les objets, relations, historique, workflows. Aucune écriture. |
| `erp.search` | Recherche globale et listes filtrées. |
| `erp.write` | Créer et modifier des objets métier. |
| `erp.documents.read` | Lister les pièces et télécharger leur contenu. |
| `erp.documents.write` | Téléverser et rattacher une pièce. |
| `erp.workflow.execute` | Faire avancer un circuit (soumettre, transmettre). |
| `erp.approve` | **Décider** une validation. Séparé de `erp.write` à dessein : approuver n'est pas modifier. |
| `erp.admin` | Comptes, droits, réglages. À n'accorder qu'exceptionnellement. |

`erp.admin` **n'est pas un joker** : un agent d'administration n'obtient pas silencieusement le
droit d'approuver des validations métier.

### Profil LECTURE SEULE (recommandé par défaut)

```
erp.read, erp.search, erp.documents.read
```

Voir toute l'entreprise, ne rien pouvoir changer. `list_modules` rend `readOnly: true` — l'agent
sait qu'il est en lecture seule sans avoir à l'essayer.

## 3. La clé

- Format `amd_sk_` + 32 octets aléatoires, transmise en `Authorization: Bearer …`.
- **Seule l'empreinte SHA-256 est stockée.** La clé s'affiche une fois, à l'émission. Une clé
  relisible en base est une clé déjà compromise.
- Comparaison à **temps constant** : comparer deux empreintes avec `===` fuit leur préfixe commun.
- `keyPrefix` (8 caractères) permet de reconnaître une clé dans une liste sans la révéler.
- Expiration facultative, révocation immédiate (`isActive = false`).

### Émettre une clé

```bash
npx tsx scripts/api/issue-key.ts --name "ChatGPT lecture" --user amine@adventum.dz
# ajoute --scopes erp.read,erp.search,erp.write pour élargir
# ajoute --expires 2027-01-01 pour une clé à durée limitée
```

Sans `--scopes`, le profil lecture seule s'applique : **élargir est une décision, pas un oubli**.

## 4. Ce que l'API ne fait pas

Elle **ne réimplémente aucune règle métier**. Chaque lecture passe par les fonctions de portée de
l'ERP (`scopeRegulatory`, `scopeAdminRequests`…), chaque droit par `userCan`. Conséquence directe :
un dossier **verrouillé** au cadenas est invisible par API comme à l'écran, sans qu'une seule
ligne n'ait été écrite pour cela.

## 5. Journalisation

Chaque appel écrit une ligne `ApiCall` : client, identité, horodatage, méthode, chemin,
`operationId`, objet visé, statut, code d'erreur, durée, et — pour une écriture — l'état
**avant** et **après**.

- Un **identifiant de corrélation** est émis à l'entrée, rendu dans l'en-tête `X-Correlation-Id`
  et dans le corps d'erreur. Un agent qui signale un problème donne ce numéro ; on retrouve
  l'appel exact.
- Les actions d'agents sont **distinguables** des actions humaines : `ApiCall` d'un côté,
  `AuditLog` de l'autre, et l'historique d'un objet rend les deux **séparément**.

## 6. Idempotence

Les écritures acceptent `Idempotency-Key`. Un rejeu avec la même clé rend la **réponse
d'origine** (`Idempotency-Replayed: true`) au lieu de refaire l'action. La même clé avec un corps
**différent** est refusée (`IDEMPOTENCY_MISMATCH`) : ce n'est pas un rejeu, c'est une erreur
d'appelant, et rendre la première réponse serait mentir.

La clé n'est enregistrée qu'**après** succès : un appel qui a échoué doit pouvoir être recommencé.

## 7. Erreurs

Toute erreur porte un `code` **stable** (à tester par l'agent, jamais le message), un message en
français, et selon les cas `hint`, `requiredScopes`, `fields`.

Un objet hors portée répond **404 `NOT_FOUND`**, jamais 403 : la seconde réponse confirmerait son
existence à quelqu'un qui n'a pas le droit de la connaître.
