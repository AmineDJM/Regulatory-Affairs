# ERP_API_GAP_ANALYSIS — l'UI face à l'API

> Comparaison entre ce qu'un humain autorisé peut faire dans l'ERP et ce qu'un agent peut faire
> par API. Les chiffres viennent de `ERP_AUDIT.md` (généré) et `API_COVERAGE.md` (généré).

## 1. Vue d'ensemble

| Capacité | UI | API | État |
|---|:-:|:-:|---|
| Lire les objets métier | ✔ | ✔ | **26 objets** exposés, portée de l'ERP appliquée |
| Filtrer, trier, paginer | ✔ | ✔ | Filtres structurés, lots jusqu'à 500 |
| Recherche globale | ✔ | ✔ | Transverse à tous les objets lisibles |
| Découvrir la structure | ✘ (implicite) | ✔ | `/meta/*` — l'API va **plus loin** que l'UI |
| Historique d'un objet | ✔ | ✔ | Humains **et** agents, distingués |
| Pièces jointes (lecture) | ✔ | ✔ | Téléchargement contrôlé par identifiant |
| Circuit et blocages | partiel | ✔ | `/workflow` **consolide** ce qui est éclaté dans l'UI |
| Actions disponibles | implicite | ✔ | `/available-actions` avec la raison des refus |
| **Créer / modifier** | ✔ | ✘ | **Gap principal** — voir § 2 |
| **Décider une validation** | ✔ | ✘ | Gap — portée `erp.approve` prévue |
| **Téléverser une pièce** | ✔ | ✘ | Gap — portée `erp.documents.write` prévue |
| Exports Excel / PDF | ✔ | ✘ | Gap mineur : l'agent lit les données brutes |
| Webhooks | — | socle | Tables migrées, émetteur à brancher |

## 2. Le gap principal : l'écriture

**494 actions serveur** portent l'écriture de l'ERP. Aucune n'est encore exposée.

Ce n'est pas un oubli de conception : la couche qui les recevra est **en place et vérifiée**
(authentification machine, portées, idempotence, journalisation avant/après, corrélation). Ce qui
reste est **déclaratif** — inscrire chaque action dans un registre d'opérations qui appelle la
fonction existante.

Le point qui compte, et qui est déjà tenu : **l'API n'aura jamais sa propre logique métier.**
Elle appellera `setRegulatoryResponsible`, `addDepartmentExpense`, `decideValidation`… c'est-à-dire
exactement ce que l'écran appelle. Il ne peut donc pas exister deux comportements divergents.

### Ordre de livraison proposé

1. Regulatory (assignation, statut, étapes, priorité, dates) — le module à plus forte valeur.
2. Validations et circuits Ad & Pro (`erp.approve`, `erp.workflow.execute`).
3. Budgets et moyens généraux (dépenses, tickets).
4. RH (congés) et secrétariat (demandes).
5. Téléversement de pièces.
6. Administration (`erp.admin`), en dernier et à part.

## 3. Gaps assumés (et pourquoi)

| Sujet | Décision |
|---|---|
| **Dossiers verrouillés** | Invisibles par API comme à l'écran. Ce n'est pas un gap : c'est la règle. |
| **Administration** | Hors portée par défaut. Un agent qui peut créer des comptes peut tout. |
| **Assistant IA interne** | Non exposé : un agent pilotant un autre agent rend l'audit illisible. |
| **Circuits Ad & Pro / congés détaillés** | Rendus en mode générique (statut + actions) tant que leurs étapes ne sont pas modélisées comme celles de Regulatory. Un circuit partiel et honnête vaut mieux qu'un circuit inventé. |
| **Exports Excel** | L'agent lit les données ; produire un classeur n'apporte rien à une IA. |

## 4. Réponse au critère final

> « Existe-t-il une information, un workflow ou une action significative qu'un utilisateur
> autorisé peut voir ou effectuer dans l'ERP, mais que l'agent ne peut ni découvrir ni utiliser
> via l'API ? »

**Oui, et c'est documenté** :

- **En lecture** : les 26 objets exposés couvrent les modules structurants. Les objets restants
  (§ 4.2 de `API_COVERAGE.md`) sont majoritairement techniques ; ceux qui sont métier s'ajoutent
  une ligne à la fois au registre. **Aucun blocage technique.**
- **En écriture** : gap complet et assumé pour ce lot, avec le socle prêt et l'ordre de livraison
  ci-dessus.
- **Découverte** : l'agent découvre modules, objets, champs, énumérations, relations, permissions
  et opérations **sans documentation écrite**. Ce critère est rempli.
