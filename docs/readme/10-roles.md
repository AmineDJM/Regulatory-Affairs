## 👤 Rôles

**19 rôles** métier. Le Super Admin attribue/retire tout via la **matrice d'accès** (`/admin/users/[id]`) ; les
libellés français viennent de `src/lib/labels.ts`.

| Rôle | Libellé | Portée typique |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Tout + administration (permissions, comptes, sécurité, IA, Brain, enveloppes budgétaires, Vue exacte). Compte **souverain**. **Seul compte qui pilote les missions et surveillances d'Adam** (`peutPiloterMissionsAdam`, décision de la Direction 09/2026) : Centre de missions, `run_mission`, `watch_entity`, interrupteur global. |
| `DIRECTION` | **Direction des opérations** | **Pair quasi-administrateur** : accès complet (gérer + valider) aux pôles, **vue globale** (`hasGlobalView`) donc supervision de toutes les demandes de validation. **Valide l'opération** dans le circuit Ad & Pro (étape « Validation (Direction des opérations) », sans chiffrer) et ne **tranche** que les demandes de rang 2 — Direction Marketing, Manager Promotion médicale —, dont elle fixe alors le montant et la sous-catégorie, hérités des étapes que la route n'atteint pas (`argentEffectif`, `lib/workflow/pouvoirs-argent.ts`) ; **siège au centre de paiement** (c'est le « PDG » du centre). Attribue les dépenses aux enveloppes. Restreignable par overrides. |
| `GENERAL_MANAGER` | **Directeur Général** | **Tous les pouvoirs métier** (gère et décide sur tous les pôles, signataire des circuits Ad & Pro) mais **délibérément hors vue globale** : il ne supervise **pas** les demandes de validation de tout le monde, et les modules **personnels** (Drive, directives, dossiers, support) restent cloisonnés. Administration, IA et Process Intelligence restent au seul Super Admin. |
| `OPERATIONS_DIRECTOR` | **Directeur des Opérations** | Rôle **à part**, pas une Direction au rabais : approvisionnement (**PCH**, **stocks**), **moyens généraux**, **secrétariat**, Legal en contribution, le **stock promotionnel de ses équipes** et la **grille de coaching** ; **lit** les bons de commande sans les signer (la logistique et les ventes qu'il portait sont retirées du service). **Lit** ce dont il dépend — réglementaire, budgets, finances, RH — sans le piloter. Pas de vue globale ; les circuits Ad & Pro ne sont pas les siens. |
| `NATIONAL_SALES` | **National Sales** | **Toutes les capacités du délégué médical** + **approbation préliminaire** des demandes Ad & Pro / événements de ses KAM (approuver / refuser ; il ne désigne plus de référent Direction Marketing — les référents se configurent par gamme). Portée **ALL** pour voir toutes les demandes à instruire (le matériel promotionnel, lui, en portée « ses dossiers ») ; **pas** de décision (réservée à la Direction Marketing). |
| `MEDICAL_PROMOTION_MANAGER` | Manager Promotion Médicale | Promotion médicale, module Ad & Pro, **configuration de la force de vente** (donc des référents d'une gamme). Ne peut **pas** être désigné référent Direction Marketing : l'étape qui TRANCHE ne nomme que `PRODUCT_MANAGER`, et l'inscrire serait une attente sans pouvoir. N'assure **plus** l'étape préliminaire (désormais National Sales). |
| `HEAD_OF_REGULATORY` | Responsable Réglementaire | Regulatory (gestion complète + fournisseurs). |
| `REGULATORY_ASSISTANT` | Assistante Réglementaire | Regulatory (lignes assignées). |
| `HEAD_OF_SALES` | Responsable Ventes | PCH, Stocks (le module Ventes est retiré du service). |
| `SALES_USER` | Commercial | PCH en contribution (portée ALL), Stocks en lecture (le module Ventes est retiré du service). |
| `LOGISTICS_MANAGER` | Responsable Logistique | PCH, Stocks (la logistique est retirée du service). |
| `MEDICAL_DELEGATE` | Délégué Médical | Ses médecins, visites, demandes (scope **ASSIGNED**). Émetteur typique des demandes Ad & Pro / événements. |
| `PRODUCT_MANAGER` | **Direction Marketing** | **Tranche** toute demande Ad & Pro (« Gérer » les sept natures) : montant accordé et sous-catégorie ; pour un sponsoring, **pré-valide la tenue** puis **clôture**. Tient le **magasin central** du stock promotionnel (sa cheffe, lue sur l'organigramme), écrit les **articles du site**, lit la force de vente. |
| `BUSINESS_DEVELOPMENT_MANAGER` | Manager Business Development | **Explorateur produits** (Market Intelligence, son module d'origine, est retiré du service). |
| `FINANCE_BUDGET_MANAGER` | Responsable Finance / Budget | Finances, Budgets, ordres de dépense, **validations Finances**. |
| `MEDICAL_INFO_PHARMACIST` | Pharmacien resp. information médicale | Déclaration réglementaire des événements validés (PRIM). |
| `DIRECTION_ASSISTANT` | **Assistante de Direction** | **Bureau du secrétariat** (gère les demandes, **retranscrit les devis** du matériel promotionnel ligne à ligne et pilote son exécution — BC, factures — **sans accès au module**). |
| `COORDINATOR` | Coordination / Coursier | **Missions chauffeur / courses** (adresse Maps, durée, retard) — espace restreint. |
| `VIEWER` | Lecteur | Lecture limitée. |

> Pense à créer au moins un **National Sales**, un **Direction Marketing** (à désigner ensuite référent d'au moins une gamme), un **Pharmacien information médicale**, une
> **Assistante de Direction** et un **Responsable Finance** pour que les circuits complets fonctionnent.

---

