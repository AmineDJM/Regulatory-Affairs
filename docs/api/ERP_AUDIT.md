# ERP_AUDIT — cartographie de AMD Internal OS

> **Généré** par `npx tsx scripts/erp-audit/run.ts` — ne pas modifier à la main.
> Toute ligne de ce document est lue dans le code : schéma Prisma, matrice RBAC, arbre
> des pages, actions serveur, routes API, planificateur, drapeaux de version.
> Dernière génération : 2026-08-15T14:35:35.003Z

## 0. Volumétrie

| Élément | Nombre |
|---|---:|
| modules | 33 |
| roles | 17 |
| pages | 134 |
| apiRoutes | 61 |
| serverActions | 494 |
| queryModules | 39 |
| queryFunctions | 115 |
| models | 195 |
| enums | 149 |
| scheduledJobs | 16 |
| featureFlags | 4 |

## 1. Modules et permissions

Actions RBAC possibles : `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `VALIDATE`, `EXPORT`, `UPLOAD`.

| Module | Rôles ayant un accès (action → rôles) |
|---|---|
| `DASHBOARD` | **VIEW** : 16 rôles · **CREATE** : SUPER_ADMIN · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : 15 rôles · **UPLOAD** : SUPER_ADMIN |
| `WORKSPACE` | **VIEW** : 17 rôles · **CREATE** : 17 rôles · **UPDATE** : 17 rôles · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : 16 rôles · **UPLOAD** : SUPER_ADMIN |
| `MESSAGING` | **VIEW** : 17 rôles · **CREATE** : 17 rôles · **UPDATE** : 17 rôles · **DELETE** : 17 rôles · **VALIDATE** : SUPER_ADMIN · **EXPORT** : SUPER_ADMIN · **UPLOAD** : 17 rôles |
| `REGULATORY` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, REGULATORY_ASSISTANT · **CREATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, REGULATORY_ASSISTANT · **UPDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, REGULATORY_ASSISTANT · **DELETE** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY · **VALIDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, REGULATORY_ASSISTANT · **UPLOAD** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, REGULATORY_ASSISTANT |
| `SPONSORING` | **VIEW** : SUPER_ADMIN, DIRECTION, NATIONAL_SALES, FINANCE_BUDGET_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, NATIONAL_SALES · **UPDATE** : SUPER_ADMIN, DIRECTION, NATIONAL_SALES · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION, NATIONAL_SALES, FINANCE_BUDGET_MANAGER, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, NATIONAL_SALES |
| `BUDGETS` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, PRODUCT_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, FINANCE_BUDGET_MANAGER · **UPDATE** : SUPER_ADMIN, FINANCE_BUDGET_MANAGER · **DELETE** : SUPER_ADMIN, FINANCE_BUDGET_MANAGER · **VALIDATE** : SUPER_ADMIN, FINANCE_BUDGET_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_REGULATORY, PRODUCT_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, FINANCE_BUDGET_MANAGER |
| `FINANCES` | **VIEW** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER |
| `RH` | **VIEW** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION · **UPDATE** : SUPER_ADMIN, DIRECTION · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION |
| `CONGRESS_INTERNATIONAL` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, PRODUCT_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, PRODUCT_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER |
| `CONGRESS_NATIONAL` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, PRODUCT_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, PRODUCT_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER |
| `EVENTS` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, PRODUCT_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, PRODUCT_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER |
| `SALES` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER · **UPDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER · **DELETE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES · **VALIDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER |
| `LOGISTICS` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER |
| `MEDICAL` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **DELETE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES |
| `FIELD_REPORTS` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **DELETE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES, PRODUCT_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES |
| `SALES_PLANNING` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, MEDICAL_DELEGATE, NATIONAL_SALES · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER |
| `BUSINESS_DEVELOPMENT` | **VIEW** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, BUSINESS_DEVELOPMENT_MANAGER |
| `PCH` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER |
| `STOCKS` | **VIEW** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, LOGISTICS_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, SALES_USER, LOGISTICS_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, HEAD_OF_SALES, LOGISTICS_MANAGER |
| `MEDICAL_INFO` | **VIEW** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, MEDICAL_INFO_PHARMACIST · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_INFO_PHARMACIST · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_INFO_PHARMACIST · **DELETE** : SUPER_ADMIN, DIRECTION, MEDICAL_INFO_PHARMACIST · **VALIDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_INFO_PHARMACIST · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_INFO_PHARMACIST · **UPLOAD** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, MEDICAL_INFO_PHARMACIST |
| `PROMO_MATERIAL` | **VIEW** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, FINANCE_BUDGET_MANAGER · **CREATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **UPDATE** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, FINANCE_BUDGET_MANAGER · **UPLOAD** : SUPER_ADMIN, DIRECTION, MEDICAL_PROMOTION_MANAGER, FINANCE_BUDGET_MANAGER |
| `GENERAL_MEANS` | **VIEW** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, DIRECTION_ASSISTANT · **CREATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, DIRECTION_ASSISTANT · **UPDATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, DIRECTION_ASSISTANT · **DELETE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **VALIDATE** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER · **EXPORT** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, DIRECTION_ASSISTANT · **UPLOAD** : SUPER_ADMIN, DIRECTION, FINANCE_BUDGET_MANAGER, DIRECTION_ASSISTANT |
| `VALIDATIONS` | **VIEW** : 16 rôles · **CREATE** : 16 rôles · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN · **UPLOAD** : SUPER_ADMIN |
| `DIRECTIVES` | **VIEW** : 17 rôles · **CREATE** : SUPER_ADMIN, DIRECTION · **UPDATE** : 17 rôles · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION · **UPLOAD** : SUPER_ADMIN, DIRECTION |
| `SUPPORT` | **VIEW** : 17 rôles · **CREATE** : 17 rôles · **UPDATE** : 17 rôles · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION · **UPLOAD** : 17 rôles |
| `DOSSIERS` | **VIEW** : 17 rôles · **CREATE** : 17 rôles · **UPDATE** : 17 rôles · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : SUPER_ADMIN, DIRECTION · **UPLOAD** : 17 rôles |
| `DOCUMENTS` | **VIEW** : 13 rôles · **CREATE** : 11 rôles · **UPDATE** : 11 rôles · **DELETE** : SUPER_ADMIN, DIRECTION · **VALIDATE** : SUPER_ADMIN, DIRECTION · **EXPORT** : 12 rôles · **UPLOAD** : 11 rôles |
| `DRIVE` | **VIEW** : 17 rôles · **CREATE** : 16 rôles · **UPDATE** : 16 rôles · **DELETE** : 16 rôles · **VALIDATE** : SUPER_ADMIN · **EXPORT** : 17 rôles · **UPLOAD** : 16 rôles |
| `ADMIN_REQUESTS` | **VIEW** : 17 rôles · **CREATE** : 17 rôles · **UPDATE** : SUPER_ADMIN, DIRECTION, DIRECTION_ASSISTANT · **DELETE** : SUPER_ADMIN, DIRECTION, DIRECTION_ASSISTANT · **VALIDATE** : SUPER_ADMIN, DIRECTION, DIRECTION_ASSISTANT · **EXPORT** : 16 rôles · **UPLOAD** : 17 rôles |
| `NOTIFICATIONS` | **VIEW** : 17 rôles · **CREATE** : SUPER_ADMIN · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : SUPER_ADMIN · **UPLOAD** : SUPER_ADMIN |
| `PROCESS_INTELLIGENCE` | **VIEW** : SUPER_ADMIN · **CREATE** : SUPER_ADMIN · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : SUPER_ADMIN · **UPLOAD** : SUPER_ADMIN |
| `ADVENTUM_BRAIN` | **VIEW** : SUPER_ADMIN · **CREATE** : SUPER_ADMIN · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : SUPER_ADMIN · **UPLOAD** : SUPER_ADMIN |
| `ADMIN` | **VIEW** : SUPER_ADMIN · **CREATE** : SUPER_ADMIN · **UPDATE** : SUPER_ADMIN · **DELETE** : SUPER_ADMIN · **VALIDATE** : SUPER_ADMIN · **EXPORT** : SUPER_ADMIN · **UPLOAD** : SUPER_ADMIN |

## 2. Rôles

| Rôle | Libellé | Modules accessibles |
|---|---|---:|
| `SUPER_ADMIN` | Super Admin | 33 |
| `DIRECTION` | Direction des opérations | 30 |
| `HEAD_OF_REGULATORY` | Responsable Réglementaire | 13 |
| `REGULATORY_ASSISTANT` | Assistante Réglementaire | 12 |
| `HEAD_OF_SALES` | Responsable Ventes | 15 |
| `SALES_USER` | Commercial | 13 |
| `LOGISTICS_MANAGER` | Responsable Logistique | 15 |
| `MEDICAL_PROMOTION_MANAGER` | Manager Promotion Médicale | 18 |
| `MEDICAL_DELEGATE` | Délégué Médical | 16 |
| `NATIONAL_SALES` | National Sales | 17 |
| `PRODUCT_MANAGER` | Chef de produit | 17 |
| `BUSINESS_DEVELOPMENT_MANAGER` | Manager Business Development | 12 |
| `FINANCE_BUDGET_MANAGER` | Responsable Finance / Budget | 22 |
| `MEDICAL_INFO_PHARMACIST` | Pharmacien resp. information médicale | 17 |
| `DIRECTION_ASSISTANT` | Assistante de Direction | 12 |
| `COORDINATOR` | Coordination / Coursier | 9 |
| `VIEWER` | Lecteur | 10 |

## 3. Pages et écrans

Chaque page déclare le module qu'elle exige à l'entrée (`requireModule`). Une page sans
garde de module est soit publique, soit protégée par une règle plus fine dans son corps.

| Route | Module exigé | Action | Fichier |
|---|---|---|---|
| `/admin` | `ADMIN` | VIEW | `src/app/(app)/admin/page.tsx` |
| `/admin/access` | `ADMIN` | UPDATE | `src/app/(app)/admin/access/page.tsx` |
| `/admin/activity` | `ADMIN` | VIEW | `src/app/(app)/admin/activity/page.tsx` |
| `/admin/adoption` | `ADMIN` | UPDATE | `src/app/(app)/admin/adoption/page.tsx` |
| `/admin/ai` | `ADMIN` | UPDATE | `src/app/(app)/admin/ai/page.tsx` |
| `/admin/bases` | — | VIEW | `src/app/(app)/admin/bases/page.tsx` |
| `/admin/corbeille` | — | VIEW | `src/app/(app)/admin/corbeille/page.tsx` |
| `/admin/courrier` | `ADMIN` | VIEW | `src/app/(app)/admin/courrier/page.tsx` |
| `/admin/diagnostic` | `ADMIN` | UPDATE | `src/app/(app)/admin/diagnostic/page.tsx` |
| `/admin/entites` | `ADMIN` | VIEW | `src/app/(app)/admin/entites/page.tsx` |
| `/admin/feedback` | `ADMIN` | VIEW | `src/app/(app)/admin/feedback/page.tsx` |
| `/admin/fields` | `ADMIN` | UPDATE | `src/app/(app)/admin/fields/page.tsx` |
| `/admin/organigramme` | — | VIEW | `src/app/(app)/admin/organigramme/page.tsx` |
| `/admin/regulatory-corpus` | `ADMIN` | UPDATE | `src/app/(app)/admin/regulatory-corpus/page.tsx` |
| `/admin/regulatory-ia` | `ADMIN` | VIEW | `src/app/(app)/admin/regulatory-ia/page.tsx` |
| `/admin/settings` | `ADMIN` | UPDATE | `src/app/(app)/admin/settings/page.tsx` |
| `/admin/suppliers` | `ADMIN` | VIEW | `src/app/(app)/admin/suppliers/page.tsx` |
| `/admin/test-center` | `ADMIN` | UPDATE | `src/app/(app)/admin/test-center/page.tsx` |
| `/admin/users/{id}` | `ADMIN` | UPDATE | `src/app/(app)/admin/users/[id]/page.tsx` |
| `/admin/validations` | `ADMIN` | VIEW | `src/app/(app)/admin/validations/page.tsx` |
| `/admin/versions` | `ADMIN` | VIEW | `src/app/(app)/admin/versions/page.tsx` |
| `/admin/workflows` | `ADMIN` | VIEW | `src/app/(app)/admin/workflows/page.tsx` |
| `/adventum-brain` | `ADVENTUM_BRAIN` | VIEW | `src/app/(app)/adventum-brain/page.tsx` |
| `/assistant` | `WORKSPACE` | VIEW | `src/app/(app)/assistant/page.tsx` |
| `/aujourdhui` | `WORKSPACE` | VIEW | `src/app/(app)/aujourdhui/page.tsx` |
| `/budgets` | `BUDGETS` | VIEW | `src/app/(app)/budgets/page.tsx` |
| `/budgets/departements` | `BUDGETS` | VIEW | `src/app/(app)/budgets/departements/page.tsx` |
| `/budgets/depenses` | `BUDGETS` | VIEW | `src/app/(app)/budgets/depenses/page.tsx` |
| `/budgets/reglages` | `BUDGETS` | VIEW | `src/app/(app)/budgets/reglages/page.tsx` |
| `/business-development` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/page.tsx` |
| `/business-development/{id}` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/[id]/page.tsx` |
| `/business-development/etudes` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/etudes/page.tsx` |
| `/business-development/etudes/{id}` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/etudes/[id]/page.tsx` |
| `/business-development/marche` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/page.tsx` |
| `/business-development/marche/concurrence` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/concurrence/page.tsx` |
| `/business-development/marche/opportunites` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/opportunites/page.tsx` |
| `/business-development/marche/pricing` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/pricing/page.tsx` |
| `/business-development/marche/produits` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/produits/page.tsx` |
| `/business-development/marche/radar` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/marche/radar/page.tsx` |
| `/business-development/opportunites` | `BUSINESS_DEVELOPMENT` | VIEW | `src/app/(app)/business-development/opportunites/page.tsx` |
| `/calendar` | `WORKSPACE` | VIEW | `src/app/(app)/calendar/page.tsx` |
| `/change-password` | — | VIEW | `src/app/change-password/page.tsx` |
| `/comptabilite` | — | VIEW | `src/app/(app)/comptabilite/page.tsx` |
| `/congress-international` | `CONGRESS_INTERNATIONAL` | VIEW | `src/app/(app)/congress-international/page.tsx` |
| `/congress-international/{id}` | `CONGRESS_INTERNATIONAL` | VIEW | `src/app/(app)/congress-international/[id]/page.tsx` |
| `/congress-national` | `CONGRESS_NATIONAL` | VIEW | `src/app/(app)/congress-national/page.tsx` |
| `/congress-national/{id}` | `CONGRESS_NATIONAL` | VIEW | `src/app/(app)/congress-national/[id]/page.tsx` |
| `/courrier` | — | VIEW | `src/app/(app)/courrier/page.tsx` |
| `/dashboard` | `DASHBOARD` | VIEW | `src/app/(app)/dashboard/page.tsx` |
| `/demandes` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/page.tsx` |
| `/demandes/{id}` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/[id]/page.tsx` |
| `/demandes/approvals` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/approvals/page.tsx` |
| `/demandes/assistant` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/assistant/page.tsx` |
| `/demandes/corbeille` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/corbeille/page.tsx` |
| `/demandes/courses` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/courses/page.tsx` |
| `/demandes/driver` | `ADMIN_REQUESTS` | VIEW | `src/app/(app)/demandes/driver/page.tsx` |
| `/directives` | `DIRECTIVES` | VIEW | `src/app/(app)/directives/page.tsx` |
| `/directives/{id}` | — | VIEW | `src/app/(app)/directives/[id]/page.tsx` |
| `/documents` | `DOCUMENTS` | VIEW | `src/app/(app)/documents/page.tsx` |
| `/documents/{id}/edit` | — | VIEW | `src/app/(app)/documents/[id]/edit/page.tsx` |
| `/dossiers` | `DOSSIERS` | VIEW | `src/app/(app)/dossiers/page.tsx` |
| `/dossiers/{id}` | — | VIEW | `src/app/(app)/dossiers/[id]/page.tsx` |
| `/drive` | `DRIVE` | VIEW | `src/app/(app)/drive/page.tsx` |
| `/drive/{id}` | `DRIVE` | VIEW | `src/app/(app)/drive/[id]/page.tsx` |
| `/drive/{id}/edit` | — | VIEW | `src/app/(app)/drive/[id]/edit/page.tsx` |
| `/drive/espace/{id}` | `DRIVE` | VIEW | `src/app/(app)/drive/espace/[id]/page.tsx` |
| `/events` | `EVENTS` | VIEW | `src/app/(app)/events/page.tsx` |
| `/events/{id}` | `EVENTS` | VIEW | `src/app/(app)/events/[id]/page.tsx` |
| `/events/{id}/checkin` | `EVENTS` | UPDATE | `src/app/(app)/events/[id]/checkin/page.tsx` |
| `/feedback` | `WORKSPACE` | VIEW | `src/app/(app)/feedback/page.tsx` |
| `/field-reports` | `FIELD_REPORTS` | VIEW | `src/app/(app)/field-reports/page.tsx` |
| `/field-reports/{id}` | `FIELD_REPORTS` | VIEW | `src/app/(app)/field-reports/[id]/page.tsx` |
| `/field-reports/overview` | `FIELD_REPORTS` | VIEW | `src/app/(app)/field-reports/overview/page.tsx` |
| `/finances` | `FINANCES` | VIEW | `src/app/(app)/finances/page.tsx` |
| `/finances/ordres-de-depense` | `FINANCES` | VIEW | `src/app/(app)/finances/ordres-de-depense/page.tsx` |
| `/finances/paie` | `FINANCES` | VIEW | `src/app/(app)/finances/paie/page.tsx` |
| `/formations` | — | VIEW | `src/app/(app)/formations/page.tsx` |
| `/information-medicale` | `MEDICAL_INFO` | VIEW | `src/app/(app)/information-medicale/page.tsx` |
| `/information-medicale/{id}` | — | VIEW | `src/app/(app)/information-medicale/[id]/page.tsx` |
| `/inscription/{id}` | — | VIEW | `src/app/inscription/[id]/page.tsx` |
| `/login` | — | VIEW | `src/app/(auth)/login/page.tsx` |
| `/logistics` | `LOGISTICS` | VIEW | `src/app/(app)/logistics/page.tsx` |
| `/logistics/{id}` | `LOGISTICS` | VIEW | `src/app/(app)/logistics/[id]/page.tsx` |
| `/medical` | `MEDICAL` | VIEW | `src/app/(app)/medical/page.tsx` |
| `/meet/{token}` | — | VIEW | `src/app/meet/[token]/page.tsx` |
| `/meetings` | `MESSAGING` | VIEW | `src/app/(app)/meetings/page.tsx` |
| `/meetings/{id}` | `MESSAGING` | VIEW | `src/app/(app)/meetings/[id]/page.tsx` |
| `/messages` | `MESSAGING` | VIEW | `src/app/(app)/messages/page.tsx` |
| `/missions` | — | VIEW | `src/app/(app)/missions/page.tsx` |
| `/mon-dossier` | — | VIEW | `src/app/(app)/mon-dossier/page.tsx` |
| `/mon-espace` | `WORKSPACE` | VIEW | `src/app/(app)/mon-espace/page.tsx` |
| `/mon-travail` | `WORKSPACE` | VIEW | `src/app/(app)/mon-travail/page.tsx` |
| `/moyens-generaux` | `GENERAL_MEANS` | VIEW | `src/app/(app)/moyens-generaux/page.tsx` |
| `/no-access` | — | VIEW | `src/app/(app)/no-access/page.tsx` |
| `/notifications` | `NOTIFICATIONS` | VIEW | `src/app/(app)/notifications/page.tsx` |
| `/onboarding` | — | VIEW | `src/app/onboarding/page.tsx` |
| `/organigramme` | — | VIEW | `src/app/(app)/organigramme/page.tsx` |
| `/page.tsx` | — | VIEW | `src/app/page.tsx` |
| `/pch` | `PCH` | VIEW | `src/app/(app)/pch/page.tsx` |
| `/pch/{id}` | `PCH` | VIEW | `src/app/(app)/pch/[id]/page.tsx` |
| `/planning` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/page.tsx` |
| `/planning/affectations` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/affectations/page.tsx` |
| `/planning/catalogue` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/catalogue/page.tsx` |
| `/planning/equipes` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/equipes/page.tsx` |
| `/planning/parametres` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/parametres/page.tsx` |
| `/planning/pilotage` | `SALES_PLANNING` | VIEW | `src/app/(app)/planning/pilotage/page.tsx` |
| `/portail` | — | VIEW | `src/app/(portal)/portail/page.tsx` |
| `/portail/login` | — | VIEW | `src/app/(portal)/portail/login/page.tsx` |
| `/process-intelligence` | `PROCESS_INTELLIGENCE` | VIEW | `src/app/(app)/process-intelligence/page.tsx` |
| `/process-intelligence/people` | `PROCESS_INTELLIGENCE` | VIEW | `src/app/(app)/process-intelligence/people/page.tsx` |
| `/promo-material` | `PROMO_MATERIAL` | VIEW | `src/app/(app)/promo-material/page.tsx` |
| `/promo-material/{id}` | `PROMO_MATERIAL` | VIEW | `src/app/(app)/promo-material/[id]/page.tsx` |
| `/regulatory` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/page.tsx` |
| `/regulatory/{id}` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/[id]/page.tsx` |
| `/regulatory/enregistrement` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/page.tsx` |
| `/regulatory/enregistrement/analyse` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/analyse/page.tsx` |
| `/regulatory/enregistrement/analyse/{dossierId}` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/analyse/[dossierId]/page.tsx` |
| `/regulatory/enregistrement/corpus` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/corpus/page.tsx` |
| `/regulatory/enregistrement/entrainement` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/entrainement/page.tsx` |
| `/regulatory/enregistrement/reserves` | `REGULATORY` | VIEW | `src/app/(app)/regulatory/enregistrement/reserves/page.tsx` |
| `/rh` | `RH` | VIEW | `src/app/(app)/rh/page.tsx` |
| `/rh/{id}` | `RH` | VIEW | `src/app/(app)/rh/[id]/page.tsx` |
| `/rh/conges` | `RH` | VIEW | `src/app/(app)/rh/conges/page.tsx` |
| `/rh/departements` | `RH` | VIEW | `src/app/(app)/rh/departements/page.tsx` |
| `/rh/equipe` | `RH` | VIEW | `src/app/(app)/rh/equipe/page.tsx` |
| `/rh/paie` | `RH` | VIEW | `src/app/(app)/rh/paie/page.tsx` |
| `/sales` | `SALES` | VIEW | `src/app/(app)/sales/page.tsx` |
| `/search` | — | VIEW | `src/app/(app)/search/page.tsx` |
| `/sponsoring` | `SPONSORING` | VIEW | `src/app/(app)/sponsoring/page.tsx` |
| `/sponsoring/{id}` | `SPONSORING` | VIEW | `src/app/(app)/sponsoring/[id]/page.tsx` |
| `/stocks` | `STOCKS` | VIEW | `src/app/(app)/stocks/page.tsx` |
| `/support` | `SUPPORT` | VIEW | `src/app/(app)/support/page.tsx` |
| `/support/{id}` | — | VIEW | `src/app/(app)/support/[id]/page.tsx` |
| `/validations` | `VALIDATIONS` | VIEW | `src/app/(app)/validations/page.tsx` |

## 4. Matrice UI → action → objet → permissions → effets

La colonne **Action serveur** est le nom exporté réellement appelé par l'écran. C'est
elle que l'API réutilise : il n'existe pas de seconde implémentation de la règle métier.

| Action serveur | Fichier | Modules exigés | Actions RBAC | Accès ligne | Écrit | Audité | Notifie | Fichiers | Objet / effet |
|---|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| `adminResetPassword` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `requestOnboarding` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | Super Admin : (re)déclenche l'onboarding guidé d'un compte. |
| `revokeAllSessions` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `revokeSession` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `saveAccessMatrix` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | Save the full per-user access matrix in one shot. |
| `saveModuleAccess` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | Vue « par module » (façon Google Drive) : enregistre, pour UN module, les accès de plusieurs comptes d'un coup. |
| `setRowGrants` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | Replace the set of granted rows for a user on one entity type. |
| `setUserActive` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `updateUserProfile` | `access-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `updateAdProRequest` | `ad-pro-edit-actions.ts` | — | — |  |  | ✔ |  |  | — |
| `addAdProItem` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `approveAdProItemOrder` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  | ✔ |  | VISA de la Direction sur la demande d'émission — puis les Finances émettent. |
| `decideAdProItem` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  | ✔ |  | DÉCISION de la Direction sur UN poste : accorder, refuser, ou demander à revoir le budget. |
| `deleteAdProItem` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `emitItemExpenseOrder` | `ad-pro-item-actions.ts` | `FINANCES` | UPDATE, VALIDATE |  | ✔ |  |  |  | Émet l'ordre de dépense d'UN poste. |
| `linkPromoMaterial` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  |  |  | Rattache un matériel promotionnel EXISTANT à un poste. |
| `promoMaterialOptions` | `ad-pro-item-actions.ts` | — | — |  |  |  |  |  | Les matériels promotionnels rattachables — pour le sélecteur, sans exposer tout le module. |
| `requestAdProItemOrder` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  | ✔ |  | DEMANDE d'émission du bon de commande d'un poste accordé (première marche du circuit). |
| `requestAdProItemQuote` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  | ✔ |  | Ouvre une DEMANDE ADMINISTRATIVE (Bureau du secrétariat) pour obtenir le devis d'un poste. |
| `setAdProItemBudget` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  |  |  | Choix du BUDGET qui portera un poste accordé (catégorie d'enveloppe) — « comme d'habitude ». |
| `submitAdProItem` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  | ✔ |  | SOUMET un poste à la Direction. |
| `updateAdProItem` | `ad-pro-item-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `transferAdProRequest` | `ad-pro-transfer-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `createUser` | `admin-actions.ts` | `ADMIN` | CREATE |  | ✔ | ✔ |  |  | — |
| `setSecondaryRole` | `admin-actions.ts` | `ADMIN` | UPDATE |  | ✔ | ✔ |  |  | Règle l'« autre rôle » (fonction secondaire) d'un utilisateur — ex. |
| `toggleUserActive` | `admin-actions.ts` | `ADMIN` | UPDATE |  | ✔ | ✔ |  |  | — |
| `updateUserRole` | `admin-actions.ts` | `ADMIN` | UPDATE |  | ✔ | ✔ |  |  | — |
| `destroyDeletedRecord` | `admin-delete-actions.ts` | — | — |  | ✔ | ✔ |  | ✔ | Destruction RÉELLE d'une entrée de la corbeille : efface aussi les fichiers stockés. |
| `restoreDeletedRecord` | `admin-delete-actions.ts` | — | — |  | ✔ | ✔ |  |  | Restaure un élément de la corbeille des suppressions définitives : la ligne principale est recréée à l'identique (mêmes id/référence), ainsi que ses pièces jointes et commentaires. |
| `superAdminDelete` | `admin-delete-actions.ts` | — | — |  | ✔ | ✔ |  |  | Suppression « définitive » d'un enregistrement par le Super Admin (et lui seul). |
| `addRequestComment` | `admin-request-actions.ts` | — | — |  | ✔ |  | ✔ |  | — |
| `assignRequest` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `cancelAttachmentValidation` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ | ✔ |  | RETIRER UNE VALIDATION DE PIÈCE EN COURS — soumise par erreur, mauvaise pièce, mauvais validateurs : tant qu'elle est EN ATTENTE, celui qui l'a soumise (ou l'assistante / un profil gestionnaire) peut la retirer. |
| `createMission` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ | ✔ | ✔ | — |
| `createRequest` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | CREATE |  | ✔ | ✔ | ✔ |  | — |
| `createRequestBatch` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | CREATE |  | ✔ | ✔ | ✔ |  | Crée plusieurs demandes en un seul envoi (cellules). |
| `decideApproval` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | VALIDATE |  | ✔ | ✔ | ✔ |  | — |
| `deleteOwnRequest` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | Le demandeur supprime sa propre demande dans les 30 minutes (soft delete tracé). |
| `deleteRequests` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ |  |  | L'assistante supprime une ou plusieurs demandes — soft delete + motif obligatoire. |
| `editOwnRequest` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | Le demandeur modifie sa propre demande dans les 30 minutes (avant traitement). |
| `finishRequest` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | « Fin de la demande ». |
| `requestApproval` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `requestFinanceValidation` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | « Demande de validation des Finances » (flux achat). |
| `requestInternalValidation` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | « Demander une validation » (flux hors achat). |
| `restoreRequest` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ |  |  | Restaure une demande supprimée (assistante / super admin). |
| `startRequestProcessing` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ |  |  | « Commencer le traitement » : passe la demande en cours et fige la fenêtre demandeur. |
| `submitAttachmentValidation` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  |  | ✔ |  |  | SOUMETTRE UNE PIÈCE JOINTE À VALIDATION — à n'importe quel moment, à une ou plusieurs personnes. |
| `toggleMissionStop` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ |  |  |  | Coche / décoche un point de passage d'une course (chauffeur assigné ou gestionnaire). |
| `updateMission` | `admin-request-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ | ✔ |  | — |
| `updateRequestStatus` | `admin-request-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `resetActivityTime` | `adoption-actions.ts` | — | — |  | ✔ | ✔ |  |  | Remet à **zéro** les temps d'activité enregistrés (champ `durationMs` des relevés) — réservé au Super Admin. |
| `saveAdoptionSettings` | `adoption-actions.ts` | — | — |  | ✔ | ✔ |  |  | Réglage du score d'adoption — **réservé au Super Admin**. |
| `askBrain` | `adventum-actions.ts` | — | — |  |  |  |  |  | Barre de commande IA d'Adventum Brain (questions d'analyse, lecture seule). |
| `generateBriefing` | `adventum-actions.ts` | — | — |  |  |  |  |  | Génère un briefing de direction synthétisant les risques du jour (IA, gracieux sans clé). |
| `runAutopilot` | `adventum-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | Autopilot — exécute une action PROPOSÉE après confirmation. |
| `searchRelations` | `adventum-actions.ts` | — | — |  |  |  |  |  | Recherche relationnelle (fiche 360) — Super Admin. |
| `updateRiskThresholds` | `adventum-actions.ts` | — | — |  | ✔ | ✔ |  |  | Réglage des seuils du Risk Radar — Super Admin. |
| `updateAiSettings` | `ai-settings-actions.ts` | `ADMIN` | UPDATE |  | ✔ | ✔ |  |  | Centre de contrôle IA — enregistre les bascules d'activation (Super Admin). |
| `assistantChat` | `assistant-actions.ts` | `WORKSPACE` | VIEW |  |  |  |  |  | Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée). |
| `assistantNudge` | `assistant-actions.ts` | — | — |  |  |  |  |  | Suggestion PROACTIVE de l'assistant flottant : analyse les messages internes NON LUS et propose, le cas échéant, UNE action à confirmer. |
| `deleteMyAssistantThread` | `assistant-actions.ts` | — | — |  |  |  |  |  | Supprime UNE de mes conversations. |
| `executeAssistantAction` | `assistant-actions.ts` | — | — |  |  |  |  |  | — |
| `forgetMyAssistantMemory` | `assistant-actions.ts` | — | — |  |  |  |  |  | Droit à l'oubli : efface TOUTE ma mémoire d'assistant (conversations + mémoire retenue). |
| `listAssistantFiles` | `assistant-actions.ts` | `DRIVE` | VIEW |  |  |  |  |  | Fichiers du Drive personnel proposés au « glisser » dans l'assistant (sélecteur) : on les référence directement, SANS téléchargement + re-téléversement. |
| `myAssistantThread` | `assistant-actions.ts` | — | — |  |  |  |  |  | Les messages d'UNE de mes conversations (null si ce n'est pas la mienne). |
| `myAssistantThreads` | `assistant-actions.ts` | — | — |  |  |  |  |  | Mes conversations passées. |
| `refreshMyBrief` | `assistant-actions.ts` | — | — |  |  |  |  |  | Régénère MON point du matin (bouton « Actualiser »). |
| `rememberExchange` | `assistant-actions.ts` | — | — |  |  |  |  |  | Mémorise un échange dans le fil de CETTE personne et renvoie l'identifiant du fil. |
| `authenticate` | `auth-actions.ts` | — | — |  |  |  |  |  | Server action used by the login form. |
| `changePassword` | `auth-actions.ts` | — | — |  | ✔ | ✔ |  |  | Self-service password change. |
| `doSignOut` | `auth-actions.ts` | — | — |  |  |  |  |  | — |
| `createBD` | `bd-actions.ts` | `BUSINESS_DEVELOPMENT` | CREATE |  | ✔ | ✔ |  |  | — |
| `updateBDStatus` | `bd-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Move an opportunity to a new pipeline stage (used by the Kanban board). |
| `addBdProjectComment` | `bd-project-actions.ts` | — | — | ✔ | ✔ |  |  |  | — |
| `createBdProduct` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `createBdProject` | `bd-project-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createBdRange` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `deleteBdProduct` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `deleteBdProject` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `deleteBdRange` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `updateBdCell` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Édition d'une cellule en place depuis le grand tableau stratégique. |
| `updateBdProduct` | `bd-project-actions.ts` | — | — | ✔ | ✔ |  |  |  | — |
| `updateBdProject` | `bd-project-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `updateBdRange` | `bd-project-actions.ts` | — | — | ✔ | ✔ |  |  |  | — |
| `createBudget` | `budget-actions.ts` | `BUDGETS` | CREATE |  | ✔ | ✔ | ✔ |  | — |
| `addBudgetExpense` | `budget-envelope-actions.ts` | — | — |  | ✔ | ✔ |  |  | AJOUT RAPIDE d'une ligne de dépense qui CONSOMME un budget, directement depuis le module Budget (référence + montant). |
| `attributeTransaction` | `budget-envelope-actions.ts` | `BUDGETS` | UPDATE |  | ✔ |  |  |  | Attribue (ou retire) une dépense à une catégorie budgétaire. |
| `createBudgetCategory` | `budget-envelope-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `createEnvelope` | `budget-envelope-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteBudgetCategory` | `budget-envelope-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteBudgetExpense` | `budget-envelope-actions.ts` | `BUDGETS` | UPDATE |  | ✔ | ✔ |  |  | Supprime une ligne de dépense purement budgétaire (BudgetExpenseLine) — la consommation de la catégorie est réajustée aussitôt. |
| `deleteEnvelope` | `budget-envelope-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `setBudgetTotal` | `budget-envelope-actions.ts` | — | — |  | ✔ |  |  |  | Règle le budget total : FIXED (montant figé) ou FLEXIBLE (= somme des enveloppes). |
| `updateBudgetCategory` | `budget-envelope-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateBudgetExpense` | `budget-envelope-actions.ts` | `BUDGETS` | UPDATE |  | ✔ | ✔ |  |  | MODIFIE une ligne de dépense purement budgétaire (BudgetExpenseLine) : référence, montant, date et, éventuellement, RÉ-IMPUTATION vers une autre (sous-)catégorie. |
| `updateEnvelope` | `budget-envelope-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `rememberBudgetEnvelope` | `budget-scope-actions.ts` | — | — |  |  |  |  |  | Retient l'enveloppe budgétaire choisie, pour la retrouver au prochain passage. |
| `createCalendarEvent` | `calendar-actions.ts` | `WORKSPACE` | CREATE |  |  | ✔ |  |  | — |
| `deleteCalendarEvent` | `calendar-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `respondToInvite` | `calendar-actions.ts` | — | — |  | ✔ |  |  |  | La personne invitée répond à l'invitation (accepte / refuse / peut-être). |
| `updateCalendarEvent` | `calendar-actions.ts` | — | — |  | ✔ |  | ✔ |  | — |
| `addCareBeneficiary` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Ajoute une personne à prendre en charge — depuis l'annuaire OU en profil libre. |
| `addCareCell` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Ajoute une case sur la ligne d'UNE personne — une pièce à fournir ou un élément à acheter. |
| `careDirectoryOptions` | `care-actions.ts` | — | — |  |  |  |  |  | L'annuaire, pour le sélecteur de personnes. |
| `carePromoOptions` | `care-actions.ts` | — | — |  |  |  |  |  | Les matériels promotionnels rattachables — pour le sélecteur. |
| `createCareQuote` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Enregistre un devis reçu par le secrétariat, en désignant **ce qu'il couvre**. |
| `decideCareBeneficiary` | `care-actions.ts` | — | — |  | ✔ |  |  |  | La décision de la Direction, PERSONNE PAR PERSONNE. |
| `decideCareQuote` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Accepte ou refuse un devis — **d'un bloc**. |
| `linkCareCellPromoMaterial` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Rattache un matériel promotionnel à la case d'UNE personne. |
| `removeCareBeneficiary` | `care-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `removeCareCell` | `care-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `requestCareQuotes` | `care-actions.ts` | — | — |  |  |  | ✔ |  | Sollicite le secrétariat pour obtenir les devis des éléments à acheter. |
| `sendCareToFinance` | `care-actions.ts` | — | — |  |  |  | ✔ |  | Envoie la demande aux Finances. |
| `setCareCellStatus` | `care-actions.ts` | — | — |  | ✔ |  |  |  | Fait avancer une case : reçue, validée, ou sans objet. |
| `setCareOpinion` | `care-actions.ts` | — | — |  | ✔ |  |  |  | L'avis du demandeur SUR CETTE PERSONNE. |
| `deleteComment` | `comment-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime un commentaire (auteur, admin ou responsable de l'objet). |
| `updateComment` | `comment-actions.ts` | — | — |  | ✔ | ✔ |  |  | Modifie un commentaire (auteur, admin ou responsable de l'objet). |
| `setCompanyAccess` | `company-access-actions.ts` | — | — |  | ✔ | ✔ |  |  | Accorde ou révoque l'accès d'une personne à une entité. |
| `createCompany` | `company-actions.ts` | — | — |  | ✔ | ✔ |  |  | Crée une nouvelle entité (dynamique : 3ᵉ société, filiale…). |
| `setCompanyScope` | `company-actions.ts` | — | — |  |  |  |  |  | Change la portée d'entité du sélecteur de la barre supérieure (cookie). |
| `toggleCompany` | `company-actions.ts` | — | — |  | ✔ | ✔ |  |  | Active / désactive une entité (une entité inactive disparaît du sélecteur). |
| `updateCompany` | `company-actions.ts` | — | — |  | ✔ | ✔ |  |  | Met à jour une entité (nom, libellé court, couleur, ordre, activation). |
| `addCongressBeneficiary` | `congress-beneficiary-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `listBeneficiaryRefs` | `congress-beneficiary-actions.ts` | — | — |  |  |  |  |  | Référentiel pour le sélecteur de praticiens / la création inline (annuaire, spécialités, établissements). |
| `removeCongressBeneficiary` | `congress-beneficiary-actions.ts` | — | — | ✔ |  | ✔ |  |  | — |
| `requestBeneficiaryIds` | `congress-beneficiary-actions.ts` | — | — | ✔ |  | ✔ | ✔ |  | Demande au demandeur de joindre les pièces d'identité des personnes prises en charge. |
| `cancelCongressRequest` | `congress-request-actions.ts` | — | — |  |  | ✔ |  |  | — |
| `createCongressRequest` | `congress-request-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `finalDecision` | `congress-request-actions.ts` | — | — |  |  | ✔ | ✔ |  | — |
| `preliminaryDecision` | `congress-request-actions.ts` | — | — |  |  | ✔ | ✔ |  | — |
| `requestThirdPartyInput` | `congress-request-actions.ts` | — | — |  |  | ✔ |  |  | Implique une tierce personne (ex. |
| `submitProductAnalysis` | `congress-request-actions.ts` | — | — |  |  | ✔ | ✔ |  | — |
| `updateGrantedBudget` | `congress-request-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | La Direction peut **modifier le montant accordé** même après la validation définitive. |
| `deleteCustomFieldDef` | `custom-field-actions.ts` | `ADMIN` | UPDATE |  | ✔ |  |  |  | — |
| `saveCustomValues` | `custom-field-actions.ts` | — | — | ✔ |  | ✔ |  |  | Save custom field values on a record (merged into its `custom` JSON). |
| `upsertCustomFieldDef` | `custom-field-actions.ts` | `ADMIN` | UPDATE |  | ✔ | ✔ |  |  | Admin: create or update a custom field definition for a module. |
| `permanentlyDeleteDocument` | `database-admin-actions.ts` | — | — |  | ✔ | ✔ |  | ✔ | Supprime DÉFINITIVEMENT un Document (bibliothèque d'un objet métier). |
| `permanentlyDeleteDriveNode` | `database-admin-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime DÉFINITIVEMENT un nœud Drive (fichier OU dossier). |
| `purgeOrphanStorage` | `database-admin-actions.ts` | — | — |  |  | ✔ |  |  | Ramasse-miettes : détruit les blobs physiques non référencés → libère l'espace disque. |
| `createDelegatePlan` | `delegate-plan-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | Crée un plan de tournée (période + cibles). |
| `deleteDelegatePlan` | `delegate-plan-actions.ts` | `MEDICAL` | DELETE |  | ✔ | ✔ |  |  | Supprime un plan (propriétaire ou manager). |
| `duplicateDelegatePlan` | `delegate-plan-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | Duplique un plan vers une nouvelle période (mensuel ou date choisie). |
| `updateDelegatePlan` | `delegate-plan-actions.ts` | `MEDICAL` | UPDATE |  | ✔ | ✔ |  |  | Modifie un plan (cibles, région, période, commentaire manager). |
| `assignEmployeeDepartment` | `department-actions.ts` | — | — |  | ✔ | ✔ |  |  | Rattache un EMPLOYÉ à un département (ou l'en détache si vide). |
| `assignEmployeeManager` | `department-actions.ts` | — | — |  | ✔ | ✔ |  |  | Définit le MANAGER explicite (N+1) d'un employé — prioritaire sur le responsable de département. |
| `createDepartment` | `department-actions.ts` | — | — |  | ✔ | ✔ |  |  | Crée un département (racine si `parentId` vide) ou un sous-département, à N niveaux. |
| `deleteDepartment` | `department-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime un département. |
| `updateDepartment` | `department-actions.ts` | — | — |  | ✔ | ✔ |  |  | Modifie un département : nom, code, description, RESPONSABLE, ADJOINT et rattachement. |
| `addDepartmentExpense` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ |  | ✔ | IMPUTER UNE DÉPENSE à un budget départemental — **avec sa pièce**. |
| `decideDepartmentBudgetRequest` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | ACCORDER OU REFUSER une dotation / rallonge — l'administration, et elle seule. |
| `deleteDepartmentExpense` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ |  | ✔ | SUPPRIMER UNE DÉPENSE IMPUTÉE — avec ses lignes et ses pièces. |
| `requestDepartmentBudget` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | DEMANDER UNE DOTATION OU UNE RALLONGE. |
| `setDepartmentBudget` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ |  |  | Règle le budget d'un département pour une année et une nature. |
| `setDepartmentBudgetAccess` | `department-budget-actions.ts` | — | — |  | ✔ | ✔ |  |  | AUTORISATIONS — qui voit, qui édite quoi, sur quel département. |
| `updateDepartmentExpense` | `department-budget-actions.ts` | — | — |  |  | ✔ |  |  | MODIFIER UNE DÉPENSE IMPUTÉE — libellé, précisions, nature, et le détail du ticket. |
| `archiveDirective` | `directive-actions.ts` | — | — |  |  |  |  |  | — |
| `createDirective` | `directive-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `postDirectiveMessage` | `directive-actions.ts` | — | — |  | ✔ |  | ✔ |  | — |
| `updateDirectiveStatus` | `directive-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `deleteDocument` | `document-actions.ts` | — | — | ✔ | ✔ | ✔ |  | ✔ | — |
| `renameDocument` | `document-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Renomme un document (corriger une erreur de saisie). |
| `uploadDocument` | `document-actions.ts` | — | — | ✔ |  |  |  |  | Téléversement d'UN document (action serveur historique, conservée pour compat). |
| `archiveDossier` | `dossier-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `assignDossier` | `dossier-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `createDossier` | `dossier-actions.ts` | `DOSSIERS` | CREATE |  |  |  |  |  | — |
| `createDossierFromTask` | `dossier-actions.ts` | `DOSSIERS` | CREATE |  |  |  |  |  | Ouvre un dossier de suivi à partir d'une tâche (reprend titre, description, responsable…). |
| `deleteDossierMessage` | `dossier-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime un message du fil d'un dossier (auteur, responsable du dossier ou admin). |
| `editDossierMessage` | `dossier-actions.ts` | — | — |  | ✔ | ✔ |  |  | Modifie un message du fil (auteur, responsable/créateur ou Super Admin/Direction). |
| `linkEmailToDossier` | `dossier-actions.ts` | `DOSSIERS` | VIEW, CREATE |  | ✔ | ✔ |  |  | Rattache un e-mail (depuis le Courrier) à un dossier — existant ou créé à la volée. |
| `listLinkableDossiers` | `dossier-actions.ts` | `DOSSIERS` | VIEW |  |  |  |  |  | Liste des dossiers auxquels l'utilisateur peut rattacher quelque chose (non archivés). |
| `postDossierMessage` | `dossier-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | Poste un message dans le fil « Suivi & discussion » — vrai chat : texte, **pièces jointes** intégrées (stockées chiffrées) et **mentions** (@) d'utilisateurs qui doivent d'abord être membres du dossier (participant / responsable / créateur). |
| `updateDossierStatus` | `dossier-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `convertNodeToPdf` | `drive-actions.ts` | `DRIVE` | CREATE |  | ✔ | ✔ |  |  | Convertit un fichier Office du Drive (docx / xlsx / pptx) en **PDF** via OnlyOffice, et range le PDF dans le Drive (à côté de la source si possible). |
| `createFolder` | `drive-actions.ts` | `DRIVE` | CREATE |  | ✔ | ✔ |  |  | — |
| `createOfficeNode` | `drive-actions.ts` | `DRIVE` | CREATE |  | ✔ | ✔ |  |  | Crée un document Office **vierge** (Word / Excel / PowerPoint) dans le Drive, puis renvoie son id pour l'ouvrir dans l'éditeur OnlyOffice. |
| `deleteNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ |  |  | Permanent delete (file or folder, recursively) — releases all underlying blobs. |
| `ensureDriveFolders` | `drive-actions.ts` | `DRIVE` | CREATE |  | ✔ |  |  |  | Import de DOSSIER (façon Google Drive) : recrée l'arborescence exacte à partir des chemins relatifs des fichiers (`webkitRelativePath`). |
| `getDriveNodeShares` | `drive-actions.ts` | — | — |  |  |  |  |  | Partages actuels d'un nœud (dossier OU fichier) pour le panneau « Gérer l'accès ». |
| `moveNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `renameNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `restoreNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `shareNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `trashNode` | `drive-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `unshareNode` | `drive-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteDriveComment` | `drive-comment-actions.ts` | — | — |  | ✔ |  |  |  | Supprime un commentaire : son AUTEUR, un ÉDITEUR du nœud, ou le Super Admin. |
| `postDriveComment` | `drive-comment-actions.ts` | — | — |  | ✔ |  | ✔ |  | Poste un commentaire sur un nœud du Drive (fichier ou dossier). |
| `archiveDriveSpace` | `drive-space-actions.ts` | — | — |  | ✔ | ✔ |  |  | Archive / désarchive une catégorie (masquée des onglets sans rien supprimer). |
| `createDriveSpace` | `drive-space-actions.ts` | — | — |  | ✔ | ✔ |  |  | Crée une CATÉGORIE (espace partagé) de Drive. |
| `deleteDriveSpace` | `drive-space-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime DÉFINITIVEMENT une catégorie et TOUT son contenu (fichiers/dossiers) — réservé au Super Admin (action destructive). |
| `updateDriveSpace` | `drive-space-actions.ts` | — | — |  | ✔ | ✔ |  |  | Met à jour une catégorie : nom, icône et listes d'accès (consultation + gestion). |
| `addRegistration` | `event-actions.ts` | `EVENTS` | UPDATE |  | ✔ |  |  |  | Ajout d'un participant en interne (staff). |
| `checkInByToken` | `event-actions.ts` | `EVENTS` | UPDATE |  | ✔ |  |  |  | Check-in par jeton QR : marque « présent ». |
| `createEvent` | `event-actions.ts` | `EVENTS` | CREATE |  | ✔ | ✔ |  |  | — |
| `deleteEvent` | `event-actions.ts` | `EVENTS` | DELETE |  | ✔ |  |  |  | — |
| `deleteRegistration` | `event-actions.ts` | `EVENTS` | UPDATE |  | ✔ |  |  |  | — |
| `publicRegister` | `event-actions.ts` | — | — |  | ✔ |  |  |  | Inscription publique (formulaire partageable, sans compte). |
| `setRegistrationStatus` | `event-actions.ts` | `EVENTS` | UPDATE |  | ✔ |  |  |  | — |
| `submitEventForApproval` | `event-actions.ts` | `EVENTS` | CREATE |  | ✔ | ✔ | ✔ |  | Soumet un événement existant au **circuit de prise en charge**, identique à celui des congrès : la demande (souvent d'un délégué) part vers le **National Sales** (approbation préliminaire + désignation du chef de produit) → analyse du chef de produit → **Direction** (décision définitive + budget accordé) → **information médicale** (PRIM). |
| `updateEvent` | `event-actions.ts` | `EVENTS` | UPDATE |  | ✔ |  |  |  | — |
| `cancelExpenseOrder` | `expense-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | Cancel a pending ordre de dépense (e.g. |
| `requestBudgetRevision` | `expense-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ | ✔ |  | Le comptable demande à la Direction de revoir le budget (manque de fonds) : l'ordre passe en « Révision budget demandée » et remonte à la Direction. |
| `requestInvoice` | `expense-actions.ts` | `FINANCES` | UPDATE |  |  | ✔ | ✔ |  | Le comptable demande la facture au demandeur (dépense événementielle sans facture). |
| `resolveBudgetRevision` | `expense-actions.ts` | `FINANCES`, `BUDGETS` | VALIDATE |  | ✔ | ✔ | ✔ |  | La Direction tranche la demande de révision : soit elle AJUSTE le montant (l'ordre repart à régler au nouveau montant), soit elle REFUSE (l'ordre repart à régler tel quel). |
| `settleExpenseOrder` | `expense-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ | ✔ |  | Comptable settles an ordre de dépense → generates the treasury OUT entry and marks the source paid. |
| `setFeatureStage` | `feature-actions.ts` | — | — |  | ✔ | ✔ |  |  | Change le stade d'une nouveauté. |
| `toggleMyTestMode` | `feature-actions.ts` | — | — |  | ✔ | ✔ |  |  | Active/désactive le MODE TEST du compte courant : voir les nouveautés encore en test. |
| `submitFeedback` | `feedback-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | N'importe quel utilisateur connecté peut envoyer un retour libre. |
| `updateFeedbackStatus` | `feedback-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | Réservé au Super Admin : marquer un feedback vu / en cours / traité. |
| `analyzeFieldReportAction` | `field-report-actions.ts` | — | — |  | ✔ |  |  |  | Analyse la transcription en champs structurés (Claude). |
| `createFieldReport` | `field-report-actions.ts` | `FIELD_REPORTS` | VIEW |  | ✔ |  |  |  | — |
| `deleteFieldReport` | `field-report-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteFieldReportAttachment` | `field-report-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `reopenFieldReport` | `field-report-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `submitFieldReport` | `field-report-actions.ts` | — | — |  | ✔ | ✔ |  |  | Envoi du compte rendu (délégué) : un seul champ **synthèse** (dicté à la voix ou saisi) + médecin(s), établissement, spécialité, date, pièces jointes. |
| `updateFieldReport` | `field-report-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `validateFieldReport` | `field-report-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createEmployee` | `finance-actions.ts` | `FINANCES` | CREATE |  | ✔ | ✔ |  |  | — |
| `createPayroll` | `finance-actions.ts` | `FINANCES` | CREATE |  | ✔ | ✔ |  |  | — |
| `createQuickIncome` | `finance-actions.ts` | `FINANCES` | CREATE |  | ✔ | ✔ |  |  | ENCAISSEMENT SIMPLE — cinq champs et c'est réglé : date, référence, libellé, montant, client. |
| `createTransaction` | `finance-actions.ts` | `FINANCES` | CREATE |  | ✔ | ✔ |  |  | — |
| `deleteTransaction` | `finance-actions.ts` | `FINANCES` | DELETE |  | ✔ | ✔ |  |  | Supprime définitivement une écriture du livre comptable (trésorerie recalculée). |
| `deleteTreasuryAccount` | `finance-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | — |
| `importTransactions` | `finance-actions.ts` | `FINANCES` | CREATE |  | ✔ | ✔ |  |  | CSV import: date,direction(IN/OUT),category,label,amount,method,account,counterparty |
| `payPayroll` | `finance-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | Mark a payslip PAID → record a treasury OUT transaction. |
| `requestTreasuryUpdate` | `finance-actions.ts` | — | — |  |  | ✔ | ✔ |  | L'ADMINISTRATEUR DEMANDE une mise à jour du solde de trésorerie. |
| `setTreasuryOpeningBalance` | `finance-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | Définit (ou met à jour) le solde d'ouverture d'un compte de trésorerie. |
| `updateTransaction` | `finance-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | Modifie une écriture du livre comptable (tous champs sauf la référence, qui reste stable). |
| `updateTransactionStatus` | `finance-actions.ts` | `FINANCES` | UPDATE |  | ✔ | ✔ |  |  | — |
| `analyzeEmployeeContract` | `hr-actions.ts` | `RH` | CREATE |  |  | ✔ |  |  | — |
| `cancelAdvance` | `hr-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ |  |  | Cancel a still-pending advance (by its author or an RH manager). |
| `cancelLeave` | `hr-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ |  |  | Cancel a still-pending leave request (by its author or an RH manager). |
| `createEmployee` | `hr-actions.ts` | `RH` | CREATE |  | ✔ | ✔ |  |  | — |
| `decideAdvance` | `hr-actions.ts` | `RH` | VALIDATE |  | ✔ | ✔ |  |  | Approve or reject a pending salary advance (RH). |
| `decideLeave` | `hr-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | DÉCISION SUR UN CONGÉ — une marche du circuit N+1 → RH → DG (cf. |
| `requestAdvance` | `hr-actions.ts` | `WORKSPACE`, `RH` | CREATE |  | ✔ | ✔ |  |  | Request a salary advance (self-service, or RH on behalf of an employee). |
| `requestLeave` | `hr-actions.ts` | `WORKSPACE`, `RH` | CREATE |  |  |  |  |  | Submit a leave request. |
| `setEmployeeActive` | `hr-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ |  |  | — |
| `updateEmployee` | `hr-actions.ts` | `RH` | UPDATE |  | ✔ |  |  |  | — |
| `updateLeaveRequest` | `hr-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ |  |  | MODIFICATION par les RH (DRH) d'une demande de congé — Y COMPRIS déjà décidée (historique) : type, dates, jours, motif, STATUT (décision) et note. |
| `ackExpenseOriginals` | `hr-document-actions.ts` | `ADMIN_REQUESTS` | UPDATE |  | ✔ | ✔ | ✔ |  | Accusé de réception des ORIGINAUX d'une note de frais par le BUREAU DU SECRÉTARIAT (droit « Modifier » sur le module Bureau du secrétariat, ou vue globale). |
| `addHrRequestComment` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ |  | ✔ |  | Échange dans une demande RH : le demandeur ou les RH y répondent (fil de discussion). |
| `confirmHrMeeting` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ | ✔ |  | ENTREVUE RH : accepter la date proposée par l'autre partie → rendez-vous au calendrier. |
| `decideExpenseReport` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ | ✔ |  | Décision RH sur une NOTE DE FRAIS : valider pour le mois demandé, valider pour le mois suivant, ou refuser. |
| `decideHrLeave` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ | ✔ |  | Décision RH sur une demande de NATURE APPROBATION (congé / absence / autorisation de sortie) : Accorder ou Refuser — pas de document à préparer. |
| `deleteEmployeeDocument` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ | ✔ |  |  | Suppression d'un document RH (RH) — libère le blob chiffré. |
| `deleteHrRequest` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ |  |  |  | Annulation/suppression d'une demande (employé sur sa demande en attente, ou RH). |
| `processHrRequest` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ |  | ✔ |  | Traitement d'une demande par les RH (statut + note). |
| `proposeHrMeeting` | `hr-document-actions.ts` | `RH` | UPDATE |  | ✔ |  | ✔ |  | ENTREVUE RH : proposer (ou contre-proposer) une date. |
| `requestHrDocument` | `hr-document-actions.ts` | — | — |  | ✔ | ✔ | ✔ | ✔ | Demande d'attestation par l'employé (acte côté « Mon dossier RH »). |
| `startImpersonation` | `impersonation-actions.ts` | — | — |  |  | ✔ |  |  | Démarre la « Vue exacte » : le Super Admin visualise l'OS comme l'utilisateur cible. |
| `stopImpersonation` | `impersonation-actions.ts` | — | — |  |  | ✔ |  |  | — |
| `createLogistics` | `logistics-actions.ts` | `LOGISTICS` | CREATE |  | ✔ | ✔ |  |  | — |
| `updateLogisticsStatus` | `logistics-actions.ts` | `LOGISTICS` | UPDATE |  | ✔ | ✔ |  |  | — |
| `connectMailbox` | `mail-actions.ts` | — | — |  | ✔ | ✔ |  |  | Connecte (ou met à jour) la boîte mail Infomaniak de l'utilisateur. |
| `disconnectMailbox` | `mail-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `sendMailAction` | `mail-actions.ts` | — | — |  |  | ✔ |  | ✔ | — |
| `updateMailSignature` | `mail-actions.ts` | — | — |  | ✔ | ✔ |  |  | Met à jour la signature e-mail de l'utilisateur (ajoutée en bas des nouveaux messages). |
| `analyzeMarketMolecule` | `market-actions.ts` | `BUSINESS_DEVELOPMENT` | VIEW |  |  |  |  |  | ANALYSE D'UNE MOLÉCULE : poids du marché, partage ville / hôpital, part de marché de chaque laboratoire, concentration, et qui est enregistré (fabriqué localement ou importé). |
| `marketSuggestions` | `market-actions.ts` | `BUSINESS_DEVELOPMENT` | VIEW |  |  |  |  |  | Suggestions pendant la frappe : molécules connues (les plus grosses d'abord) et laboratoires. |
| `searchMarketProducts` | `market-actions.ts` | `BUSINESS_DEVELOPMENT` | VIEW |  |  |  |  |  | Recherche de produits (marché ville IQVIA + marché hospitalier PCH) pour l'explorateur de l'Intelligence marché. |
| `deletePresentation` | `market-presentation-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `generatePresentation` | `market-presentation-actions.ts` | — | — |  | ✔ | ✔ |  |  | Génère une NOUVELLE présentation (première version) : analyse IA ancrée sur toute l'étude, stockée comme source de vérité. |
| `regeneratePresentation` | `market-presentation-actions.ts` | — | — |  | ✔ | ✔ |  |  | Relance l'analyse d'une présentation existante en AJOUTANT des commentaires : crée une nouvelle version historisée (autant de fois que nécessaire). |
| `renamePresentation` | `market-presentation-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `addResearchPlayer` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `addResearchRow` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `createMarketResearch` | `market-research-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteMarketResearch` | `market-research-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteResearchPlayer` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteResearchRow` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `prefillResearchRow` | `market-research-actions.ts` | — | — |  | ✔ | ✔ |  |  | Rapproche le produit de la ligne d'une DCI de l'intelligence marché (IQVIA + PCH + Nomenclature) et remplit automatiquement : marché (volume/valeur), prix moyen, et les acteurs (fabricants locaux → Fabrication, importateurs → Importation) avec l'état d'enregistrement à la nomenclature. |
| `setMarketResearchParticipants` | `market-research-actions.ts` | — | — |  | ✔ | ✔ |  |  | Participants (collaborateurs) d'une étude de marché. |
| `updateMarketResearch` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateResearchPlayer` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateResearchRow` | `market-research-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `createDoctor` | `medical-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | — |
| `createInstitution` | `medical-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | — |
| `createSpecialty` | `medical-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | — |
| `createVisit` | `medical-actions.ts` | `MEDICAL` | CREATE |  | ✔ | ✔ |  |  | — |
| `deleteDoctor` | `medical-actions.ts` | `MEDICAL` | DELETE |  | ✔ | ✔ |  |  | Supprime un médecin de l'annuaire (MEDICAL:DELETE). |
| `deleteInstitution` | `medical-actions.ts` | `MEDICAL` | DELETE |  | ✔ |  |  |  | — |
| `deleteSpecialty` | `medical-actions.ts` | `MEDICAL` | DELETE |  | ✔ |  |  |  | — |
| `deleteVisit` | `medical-actions.ts` | `MEDICAL` | DELETE |  | ✔ | ✔ |  |  | Supprime une visite (MEDICAL:DELETE, ou le délégué auteur de la visite). |
| `updateDoctor` | `medical-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `updateInstitution` | `medical-actions.ts` | `MEDICAL` | UPDATE |  | ✔ |  |  |  | — |
| `updateSpecialty` | `medical-actions.ts` | `MEDICAL` | UPDATE |  | ✔ |  |  |  | — |
| `updateVisit` | `medical-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Modifie une visite (ligne). |
| `addMedicalInfoComment` | `medical-info-actions.ts` | — | — |  | ✔ |  |  |  | Ajoute un commentaire à la déclaration (toute personne pouvant la consulter). |
| `cancelDocRequest` | `medical-info-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `fulfillDocRequest` | `medical-info-actions.ts` | — | — |  | ✔ | ✔ | ✔ | ✔ | — |
| `recordAuthorityDeclaration` | `medical-info-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `requestDocument` | `medical-info-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `validateDeclaration` | `medical-info-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | Le pharmacien responsable valide son instruction : la déclaration ne part PAS directement au comptable mais à la Direction, qui donnera la validation finale (pour le comptable). |
| `validateDeclarationByDirection` | `medical-info-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | La Direction donne la validation finale « pour le comptable », avec un commentaire facultatif (versé dans l'espace de discussion). |
| `acceptMeetingProposal` | `meeting-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | Transforme une tâche proposée en vraie tâche (Mon espace) assignée. |
| `addMeetingParticipants` | `meeting-actions.ts` | — | — |  | ✔ |  | ✔ |  | Ajoute des participants à une réunion. |
| `createMeeting` | `meeting-actions.ts` | `MESSAGING` | CREATE |  | ✔ | ✔ | ✔ |  | Crée une réunion planifiée et invite des participants. |
| `deleteMeeting` | `meeting-actions.ts` | — | — |  | ✔ | ✔ |  |  | Supprime une réunion (et libère l'audio éventuel). |
| `deleteMeetingMessage` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Supprime un message du fil d'une réunion (auteur ou organisateur/vue globale). |
| `dismissMeetingProposal` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Écarte une tâche proposée. |
| `endMeeting` | `meeting-actions.ts` | — | — |  | ✔ | ✔ |  |  | Clôt la réunion. |
| `postMeetingMessage` | `meeting-actions.ts` | — | — |  | ✔ |  | ✔ |  | Poste un message dans le fil de discussion d'une réunion — vrai chat : texte + **pièces jointes** intégrées (stockées chiffrées via le backend Drive), comme le chat des dossiers. |
| `removeMeetingParticipant` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Retire un participant. |
| `respondToMeetingInvite` | `meeting-actions.ts` | — | — |  | ✔ |  | ✔ |  | Réponse d'un INVITÉ à une réunion — accepter / refuser / peut-être (façon agenda). |
| `saveMeetingTranscript` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Enregistre une transcription saisie/collée manuellement (sans audio). |
| `setMeetingLink` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Définit / met à jour le lien de réunion (organisateur). |
| `setMeetingLive` | `meeting-actions.ts` | — | — |  | ✔ |  |  |  | Marque la réunion « en cours » (au moment où l'organisateur la démarre). |
| `startCall` | `meeting-actions.ts` | `MESSAGING` | CREATE |  | ✔ | ✔ | ✔ |  | Lance un APPEL depuis une conversation : crée une réunion instantanée avec les membres de la conversation et poste le lien de la salle dans le fil. |
| `summarizeMeeting` | `meeting-actions.ts` | — | — |  | ✔ | ✔ |  |  | Génère le compte rendu IA + des tâches proposées à partir de la transcription stockée. |
| `updateMeeting` | `meeting-actions.ts` | — | — |  | ✔ | ✔ |  |  | Modifie les informations et l'horaire d'une réunion (organisateur / vue globale). |
| `addMembers` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `archiveConversation` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `bookmarkMessage` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `createChannel` | `messaging-actions.ts` | `MESSAGING` | CREATE |  | ✔ |  |  |  | — |
| `createDirect` | `messaging-actions.ts` | `MESSAGING` | VIEW |  | ✔ |  |  |  | — |
| `createGroup` | `messaging-actions.ts` | `MESSAGING` | CREATE |  | ✔ |  |  |  | — |
| `deleteMessage` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `editMessage` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `joinChannel` | `messaging-actions.ts` | `MESSAGING` | VIEW |  | ✔ |  |  |  | — |
| `leaveConversation` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `markRead` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `removeMember` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `sendMessage` | `messaging-actions.ts` | `MESSAGING` | CREATE |  | ✔ |  | ✔ |  | — |
| `setMemberRole` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `setMessagingStatus` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | Définit/actualise le **statut de messagerie** (façon Teams) de l'utilisateur : statut manuel (Disponible / Occupé / Ne pas déranger / De retour bientôt / Absent / Hors ligne) + message personnel court. |
| `setNotifyLevel` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `toggleMute` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `togglePinConversation` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `togglePinMessage` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `toggleReaction` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateConversation` | `messaging-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `addMissionComment` | `mission-actions.ts` | — | — | ✔ | ✔ |  |  |  | Discussion sur l'assignation : la personne assignée et les responsables peuvent échanger. |
| `assignMission` | `mission-actions.ts` | — | — | ✔ | ✔ | ✔ | ✔ |  | Assigne un accompagnant ou un délégué de référence (réservé aux responsables de l'entité). |
| `issueMissionOrder` | `mission-actions.ts` | — | — | ✔ | ✔ | ✔ | ✔ |  | Le responsable émet l'ordre de mission (après l'avoir éventuellement joint en pièce). |
| `removeMission` | `mission-actions.ts` | — | — | ✔ | ✔ |  |  |  | Retire une assignation (réservé aux responsables de l'entité). |
| `requestMissionOrder` | `mission-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | La personne assignée demande un ordre de mission. |
| `markAllNotificationsRead` | `notification-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `markNotificationRead` | `notification-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `sendBroadcast` | `notification-actions.ts` | — | — |  |  | ✔ |  |  | Crée et diffuse une notification depuis l'Administration. |
| `createSupplyArticle` | `office-supply-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `toggleSupplyArticle` | `office-supply-actions.ts` | — | — |  | ✔ | ✔ |  |  | Active / désactive un article (un article retiré n'apparaît plus dans le menu). |
| `updateSupplyArticle` | `office-supply-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `completeOnboarding` | `onboarding-actions.ts` | — | — |  | ✔ | ✔ |  |  | Marque l'onboarding comme terminé. |
| `saveOnboardingProfile` | `onboarding-actions.ts` | — | — |  | ✔ |  |  |  | Self-service : l'utilisateur complète ses coordonnées pendant l'onboarding. |
| `saveOrgNode` | `org-actions.ts` | — | — |  | ✔ | ✔ |  |  | Organigramme (Administration) : réarranger la hiérarchie RH — on fixe le N+1 (managerId) d'un employé et, au passage, son poste. |
| `saveOrgPosition` | `org-actions.ts` | — | — |  | ✔ |  |  |  | Mémorise la position d'un nœud sur la CARTE de l'organigramme (glisser-déposer). |
| `markSalaryPaid` | `payroll-hr-actions.ts` | — | — |  | ✔ | ✔ |  | ✔ | Marque le salaire d'un employé « Payé » pour un mois : montant total versé + fiche de paie (déposée dans le dossier RH de l'employé, période YYYY-MM). |
| `transferPayrollToBudget` | `payroll-hr-actions.ts` | — | — |  | ✔ | ✔ |  |  | Transfère dans le BUDGET tous les salaires payés (non encore transférés) d'un mois : une écriture de trésorerie SALAIRE (sortie) par employé, imputée à la (sous-)catégorie budgétaire choisie. |
| `unmarkSalaryPaid` | `payroll-hr-actions.ts` | — | — |  | ✔ | ✔ |  |  | Annule un « Payé » (erreur de saisie) tant que la ligne n'a pas été transférée dans le budget : supprime la fiche déposée et la notification différée si elle n'est pas encore partie. |
| `createOrder` | `pch-actions.ts` | `PCH` | CREATE |  | ✔ | ✔ |  |  | — |
| `createTender` | `pch-actions.ts` | `PCH` | CREATE |  | ✔ | ✔ |  |  | — |
| `deleteOrder` | `pch-actions.ts` | `PCH` | DELETE |  | ✔ |  |  |  | — |
| `deleteTender` | `pch-actions.ts` | `PCH` | DELETE |  | ✔ | ✔ |  |  | — |
| `updateOrder` | `pch-actions.ts` | `PCH` | UPDATE |  | ✔ |  |  |  | — |
| `updateTender` | `pch-actions.ts` | `PCH` | UPDATE |  | ✔ | ✔ |  |  | — |
| `addTenderLine` | `pch-tender-line-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `analyzeTenderDocument` | `pch-tender-line-actions.ts` | — | — |  |  |  |  |  | Upload direct du document d'AO : OCR Mistral → texte → extraction IA des produits. |
| `analyzeTenderText` | `pch-tender-line-actions.ts` | — | — |  |  |  |  |  | — |
| `createOrderFromLine` | `pch-tender-line-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteTenderLine` | `pch-tender-line-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `enrichAllTenderLines` | `pch-tender-line-actions.ts` | — | — |  |  | ✔ |  |  | Ré-enrichit TOUTES les lignes d'un appel d'offres d'un seul geste. |
| `enrichTenderLine` | `pch-tender-line-actions.ts` | — | — |  |  | ✔ |  |  | — |
| `setOrderArrival` | `pch-tender-line-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `updateTenderLine` | `pch-tender-line-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `allotPettyCash` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | REMETTRE UNE SOMME (dotation initiale du mois, ou rallonge). |
| `closePettyCash` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ |  |  | Solder une caisse : ce qui reste n'est plus disponible, et le mois est clos. |
| `confirmPettyCashReceipt` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ |  |  | CONFIRMER LA RÉCEPTION — par la détentrice, et par elle seule. |
| `decidePettyCashTopUp` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | TRANCHER LA RALLONGE — les ressources humaines, au montant QU'ELLES écrivent. |
| `nextRechargeFor` | `petty-cash-actions.ts` | — | — |  |  |  |  |  | La prochaine échéance de rechargement d'un département — pour l'afficher à l'écran. |
| `requestPettyCashTopUp` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | DEMANDER UNE RALLONGE — par la détentrice, quand le fond s'épuise. |
| `runPettyCashRechargeReminders` | `petty-cash-actions.ts` | — | — |  | ✔ |  | ✔ |  | RAPPEL AUX RH, 48 H AVANT LE RECHARGEMENT — appelé par le planificateur. |
| `setPettyCashPlan` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | RÉGLER LE MONTANT MENSUEL — par les ressources humaines. |
| `spendFromPettyCash` | `petty-cash-actions.ts` | — | — |  | ✔ | ✔ | ✔ | ✔ | DÉPENSER SUR LA CAISSE — avec justificatif scanné, sans exception. |
| `generatePlatformIdeas` | `platform-audit-actions.ts` | — | — |  |  | ✔ |  |  | Génère les **idées IA** du diagnostic de plateforme. |
| `addPromoComment` | `promo-material-actions.ts` | `PROMO_MATERIAL` | VIEW |  | ✔ |  |  |  | — |
| `cancelPromoMaterial` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `chooseAgency` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `confirmBcSent` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `confirmConformity` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | Information médicale : conformité OK + dépôt → référence & visa publicitaire. |
| `confirmPayment` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `createPromoMaterial` | `promo-material-actions.ts` | `PROMO_MATERIAL` | CREATE |  |  |  |  |  | Marketing demande la prospection d'agences ; l'assistante la reçoit. |
| `directionReview` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `initiatePayment` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `recordInvoice` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `remindFinance` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | Relance des finances (système d'alerte). |
| `settle` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `startBat` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `submitBcForFinance` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `submitFinalMaterial` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `submitMaterial` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `submitQuotes` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `validateBc` | `promo-material-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `addRegulatoryComment` | `regulatory-actions.ts` | — | — | ✔ | ✔ |  |  |  | — |
| `createRegulatoryProduct` | `regulatory-actions.ts` | `REGULATORY` | CREATE |  | ✔ | ✔ | ✔ |  | — |
| `createRegulatorySupplier` | `regulatory-actions.ts` | `REGULATORY` | CREATE |  | ✔ | ✔ |  |  | Création d'un fournisseur depuis le module Regulatory (par les Responsables réglementaires). |
| `createVariation` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Ouvre une variation (dépôt) vers un statut de fabrication supérieur. |
| `deleteVariation` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Supprime une variation (responsable / privilégié). |
| `requestBV` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  | ✔ | « Demande de BV » : émet un ordre de dépense (envoyé à l'espace comptable) avec montant + échéance, et joint éventuellement un justificatif (proforma BV). |
| `requestRegulatoryStatusUpdate` | `regulatory-actions.ts` | — | — |  |  | ✔ | ✔ |  | La supervision (Super Admin / rôle configuré) DEMANDE une mise à jour de statut sur l'enregistrement d'un produit : notifie le responsable, l'assistant et les participants du dossier. |
| `setRegulatoryChecklistItem` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Coche / décoche un document de la checklist de présoumission (avec note facultative). |
| `setRegulatoryLock` | `regulatory-actions.ts` | — | — |  | ✔ | ✔ |  |  | VERROUILLER / DÉVERROUILLER un dossier — le cadenas, réservé au SUPER ADMIN. |
| `setRegulatoryParticipants` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Participants du dossier : collaborateurs qui peuvent VOIR et travailler le dossier (accès ligne via `assignedUsers`, cf. |
| `setRegulatoryPresubOutcome` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | AVIS de la réponse de présoumission (étape « presub_ans ») : Favorable → le processus CONTINUE (étape « Fait ») ; Défavorable → étape « Bloqué » (à corriger et redemander) ; En attente → étape « En cours ». |
| `setRegulatoryPriority` | `regulatory-actions.ts` | — | — |  | ✔ | ✔ |  |  | La priorité est fixée par la SUPERVISION (Super Admin + rôles configurés en Administration). |
| `setRegulatoryResponsible` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ | ✔ |  | LA PERSONNE CHARGÉE DU DOSSIER, choisie directement dans le tableau Regulatory. |
| `setRegulatoryStepNote` | `regulatory-actions.ts` | — | — | ✔ | ✔ |  |  |  | Enregistre uniquement le commentaire d'une étape ANPP (sans changer son statut). |
| `setRegulatoryStepState` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Met à jour l'état d'une étape du processus ANPP (statut + date + note) sur un produit. |
| `setRegulatoryTargetDates` | `regulatory-actions.ts` | — | — |  | ✔ | ✔ |  |  | Dates cibles (dépôt + enregistrement) — fixées par la supervision Regulatory. |
| `setVariationStatus` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | Met à jour le statut d'une variation ; si « DE obtenue », promeut le statut de fabrication du produit. |
| `unlockAllRegulatory` | `regulatory-actions.ts` | — | — |  | ✔ | ✔ |  |  | OUVRIR LE CADENAS SUR TOUT ce qui est verrouillé — un portefeuille se publie d'un geste, pas ligne par ligne sur 69 dossiers. |
| `updateRegulatoryProduct` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ | ✔ |  | Modifie les informations descriptives d'un dossier réglementaire (DCI, marque, dosage, classe, laboratoire, pays, type, responsables…). |
| `updateRegulatoryStatus` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ | ✔ |  | — |
| `updateRegulatoryStep` | `regulatory-actions.ts` | — | — | ✔ | ✔ | ✔ |  |  | — |
| `cancelReminder` | `reminder-actions.ts` | `ADMIN` | UPDATE |  | ✔ |  |  |  | — |
| `completeReminder` | `reminder-actions.ts` | `ADMIN` | UPDATE |  | ✔ |  |  |  | — |
| `createReminder` | `reminder-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `snoozeReminder` | `reminder-actions.ts` | `ADMIN` | UPDATE |  | ✔ |  |  |  | Reporte un rappel à une nouvelle date (ISO) ; par défaut +1 jour. |
| `createSale` | `sales-actions.ts` | `SALES` | CREATE |  | ✔ | ✔ |  |  | — |
| `importSales` | `sales-actions.ts` | `SALES` | CREATE |  | ✔ | ✔ |  |  | Bulk import of sales from pasted CSV. |
| `carryForwardAssignments` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | Duplique les affectations d'un cycle précédent vers le cycle courant (KAM sous ma portée). |
| `createBusinessUnit` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createPromoProduct` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createSalesTeam` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteAssignment` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteBusinessUnit` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deletePromoProduct` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `deleteRepProfile` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `deleteSalesTeam` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `ensureCycle` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | Récupère (ou crée) le cycle mensuel donné. |
| `saveAssignment` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `saveForecast` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `saveRepProfile` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `saveSfeSettings` | `sales-planning-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `updateBusinessUnit` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updatePromoProduct` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateSalesTeam` | `sales-planning-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `saveAppSettings` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Réglages d'instance (limites de taille d'upload). |
| `saveDriveStorageSettings` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Capacité globale du Drive + quota par utilisateur (Go). |
| `setDriveSpaceCreatorRoles` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Rôles autorisés à CRÉER des catégories de Drive (espaces partagés en onglets), en plus du Super Admin toujours autorisé. |
| `setFieldReportsOverviewRoles` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Rôles autorisés à voir l'onglet « Overview » des Rapports terrain (graphes d'analyse), en plus du Super Admin toujours autorisé. |
| `setOrgChartViewers` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Qui peut CONSULTER l'organigramme : rôles (ex. |
| `setRegEnrollmentEnabled` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Débloque / masque l'onglet Regulatory « Enregistrement » (analyseur CTD). |
| `setRegulatorySupervisorRoles` | `settings-actions.ts` | — | — |  | ✔ | ✔ |  |  | Rôles « superviseurs Regulatory » (en plus du Super Admin) : fixent priorité et dates cibles, reçoivent les notifications (nouveau dossier / dépôt) et demandent des MàJ de statut. |
| `sendMail` | `smart-mail-actions.ts` | — | — |  | ✔ |  |  |  | Envoie un e-mail depuis la plateforme, par API HTTPS. |
| `smartMailStatus` | `smart-mail-actions.ts` | — | — |  |  |  |  |  | État de la configuration du courrier + les derniers envois (Administration). |
| `createSponsoring` | `sponsoring-actions.ts` | `SPONSORING` | CREATE |  | ✔ | ✔ |  |  | — |
| `requestThirdPartyInput` | `sponsoring-actions.ts` | — | — |  |  | ✔ |  |  | Implique une tierce personne (ex. |
| `sponsoringAnalysis` | `sponsoring-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `sponsoringAppeal` | `sponsoring-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `sponsoringFinal` | `sponsoring-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `sponsoringPreliminary` | `sponsoring-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `createStockAnnex` | `stock-snapshot-actions.ts` | — | — |  |  |  |  |  | Crée une ANNEXE PCH (réservé au Super Admin, comme les hôpitaux). |
| `createStockHospital` | `stock-snapshot-actions.ts` | — | — |  |  |  |  |  | Crée un HÔPITAL (réservé au Super Admin). |
| `deleteStockAnnex` | `stock-snapshot-actions.ts` | — | — |  |  |  |  |  | Supprime une annexe PCH et ses états de stock (Super Admin). |
| `deleteStockHospital` | `stock-snapshot-actions.ts` | — | — |  |  |  |  |  | Supprime un hôpital et ses états de stock (Super Admin). |
| `deleteStockSnapshot` | `stock-snapshot-actions.ts` | `STOCKS` | DELETE |  | ✔ |  |  |  | Supprime un état de stock (correction). |
| `recordStockSnapshot` | `stock-snapshot-actions.ts` | `STOCKS` | CREATE, UPDATE |  | ✔ | ✔ |  |  | Enregistre un ÉTAT de stock daté : « à cette date, il reste X unités » pour un produit et un lieu (PCH / hôpital / annexe). |
| `requestStockState` | `stock-snapshot-actions.ts` | `STOCKS` | DELETE |  | ✔ | ✔ | ✔ |  | Demande d'ÉTAT DE STOCK à un instant T (Direction / Super Admin) : on charge une personne (délégué ou autre) d'aller relever et RENSEIGNER l'état actuel — pour UN OU PLUSIEURS HÔPITAUX précis (ou en général si aucun n'est ciblé). |
| `createSupplier` | `supplier-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createSupplierUser` | `supplier-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `toggleSupplier` | `supplier-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `toggleSupplierUser` | `supplier-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateSupplierView` | `supplier-actions.ts` | `REGULATORY` | UPDATE | ✔ | ✔ | ✔ |  |  | — |
| `supplierLogin` | `supplier-portal-actions.ts` | — | — |  | ✔ | ✔ |  |  | Login du portail fournisseur (auth séparée, table SupplierUser). |
| `supplierLogout` | `supplier-portal-actions.ts` | — | — |  |  |  |  |  | — |
| `answerSupportRequest` | `support-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `createSupportRequest` | `support-actions.ts` | `SUPPORT` | CREATE |  | ✔ | ✔ |  |  | — |
| `takeSupportRequest` | `support-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `updateSupportStatus` | `support-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `createTask` | `task-actions.ts` | `WORKSPACE` | CREATE |  | ✔ | ✔ |  |  | — |
| `requestTask` | `task-actions.ts` | `WORKSPACE` | CREATE |  | ✔ | ✔ |  |  | Demande de tâche (ex. |
| `respondTaskRequest` | `task-actions.ts` | — | — |  | ✔ | ✔ |  |  | Le destinataire accepte (→ TODO) ou refuse (→ DECLINED) une demande de tâche. |
| `startTask` | `task-actions.ts` | — | — |  | ✔ | ✔ |  |  | Démarre une tâche « course / déplacement » : horodate le départ (et passe en cours). |
| `updateTaskStatus` | `task-actions.ts` | `WORKSPACE` | UPDATE |  | ✔ | ✔ |  |  | Change a task's status. |
| `resumeTestCleanup` | `test-center-actions.ts` | — | — |  |  |  |  |  | — |
| `runTestCenter` | `test-center-actions.ts` | — | — |  |  |  |  |  | — |
| `createHrTraining` | `training-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | ORGANISER UNE FORMATION (RH) — même objet, autre point d'entrée. |
| `decideTraining` | `training-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | DÉCIDER — une marche du circuit. |
| `inviteTrainingParticipants` | `training-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | INVITER DES PARTICIPANTS (RH). |
| `requestTraining` | `training-actions.ts` | `WORKSPACE` | CREATE |  | ✔ | ✔ | ✔ |  | DEMANDER UNE FORMATION — ouvert à tout le monde. |
| `respondToTrainingInvitation` | `training-actions.ts` | — | — |  | ✔ |  | ✔ |  | Accepter ou décliner une invitation — par l'intéressé, et seulement s'il a le choix. |
| `updateTraining` | `training-actions.ts` | — | — |  | ✔ |  |  |  | Modifier une formation tant qu'elle n'est pas tranchée (ou toujours, pour la direction). |
| `clearValidationItem` | `validation-actions.ts` | — | — |  | ✔ |  |  |  | Retire le verdict d'un élément (le validateur revient à « non évalué »). |
| `createValidationRequest` | `validation-actions.ts` | `VALIDATIONS` | CREATE |  | ✔ | ✔ |  | ✔ | — |
| `createValidationRule` | `validation-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `decideValidation` | `validation-actions.ts` | — | — |  | ✔ | ✔ | ✔ |  | — |
| `deleteValidationRule` | `validation-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `remindValidator` | `validation-actions.ts` | — | — |  |  | ✔ | ✔ |  | RELANCER LE VALIDATEUR QUI BLOQUE — l'action qui manquait à la supervision. |
| `reviewValidationItem` | `validation-actions.ts` | — | — |  | ✔ |  |  |  | Décision GRANULAIRE d'un validateur sur UN élément de la demande : le « message » (itemKey = "MESSAGE") ou une pièce jointe précise (itemKey = id du Document). |
| `toggleValidationRule` | `validation-actions.ts` | — | — |  | ✔ |  |  |  | — |
| `updateValidationRule` | `validation-actions.ts` | — | — |  | ✔ | ✔ |  |  | — |
| `advanceWorkflow` | `workflow-actions.ts` | — | — |  |  | ✔ |  |  | Action générique : fait avancer une demande dans son circuit. |
| `resetWorkflowDefinition` | `workflow-actions.ts` | — | — |  | ✔ | ✔ |  |  | Réinitialise une catégorie au circuit par défaut (supprime la définition → re-seed lazy). |
| `saveWorkflowDefinition` | `workflow-actions.ts` | — | — |  | ✔ | ✔ |  |  | Enregistre (remplace) la définition d'une catégorie. |

## 5. Lectures réutilisables (couche requêtes)

| Module de requêtes | Fonctions exportées |
|---|---|
| `action-center.ts` | `getActionCenter` |
| `ad-pro-edit.ts` | `adProEditValues` |
| `ad-pro-items.ts` | `loadAdProItems`, `adProBudgetOptions` |
| `admin-requests.ts` | `getRequestList`, `getAssistantData`, `getDeletedRequests`, `getApprovals`, `getDriverMissions`, `getMissionAttachments` |
| `bd.ts` | `getBdProjects`, `getBdProject`, `bdSummary` |
| `budget.ts` | `buildMonthlySeries`, `getEnvelopes`, `getEnvelopesGrandTotal`, `getBudgetCategoryOptions`, `getBudgetOverview` |
| `care.ts` | `getCareDossier` |
| `compta.ts` | `getComptaData` |
| `congress.ts` | `getCongressList`, `getCongressDetail`, `getCongressFormData` |
| `dashboard.ts` | `getDashboardData` |
| `department-budget.ts` | `getDepartmentBudgets`, `getGeneralBudgetAccess`, `hasAnyDepartmentBudgetGrant`, `getDepartmentBudgetRequests`, `headedDepartmentIds` |
| `directives.ts` | `getDirectives`, `getDirective`, `canViewDirective` |
| `documents.ts` | `accessibleDocumentWhere` |
| `dossiers.ts` | `getDossiers`, `getDossier`, `canViewDossier`, `isDossierMember`, `canManageDossier` |
| `drive.ts` | `getDriveSpacesForUser`, `getDriveTabs`, `getDriveListing` |
| `events.ts` | `getEvents`, `getEventDetail`, `getPublicEvent` |
| `field-reports.ts` | `managesReports`, `viewsAllReports`, `canViewFieldReportsOverview`, `getMyFieldReports`, `getFieldReportDetail`, `getFieldReportsAggregation`, `getFieldReportsOverview` |
| `finance.ts` | `getFinanceData` |
| `general-means.ts` | `resolveGeneralMeansDepartment`, `getGeneralMeans` |
| `hr-documents.ts` | `getMyHrDossier`, `getEmployeeHrDossier`, `getHrRequestQueue` |
| `hr-pulse.ts` | `getHrPulse` |
| `hr.ts` | `getMyWorkspace`, `getRhData`, `getMyLeaveRequests`, `getLeavesToDecide` |
| `market-research.ts` | `nomenclatureDciOptions`, `listMarketResearch`, `listResearchPresentations`, `getPresentationVersionForExport`, `getMarketResearch` |
| `medical-info.ts` | `getDeclarations`, `getDeclaration`, `canViewDeclaration`, `sourceLink` |
| `medical.ts` | `getDelegatePlans`, `getMedicalData` |
| `messaging.ts` | `messageInclude`, `mapMessage`, `getTotalUnread`, `getConversationSummaries`, `getSync`, `getDirectory`, `getConversationDetail`, `getThreadRefresh`, `getDiscoverableChannels`, `getBookmarks` |
| `missions.ts` | `getEntityMissions`, `getMyMissions` |
| `pch.ts` | `getPchTenders`, `getPchTenderDetail`, `pchSummary` |
| `portfolio.ts` | `getMyPortfolio`, `selectableProducts` |
| `process-intelligence.ts` | `getProcessOverview`, `getWorkloadAnalysis` |
| `promo-material.ts` | `getPromoMaterials`, `getPromoMaterial`, `canViewPromo`, `promoNames` |
| `reminders.ts` | `listMyReminders`, `countDueReminders` |
| `search.ts` | `globalSearch` |
| `stock.ts` | `getProductOptions` |
| `support.ts` | `getSupportRequests`, `getSupportRequest`, `canViewSupport`, `isSupportResponder` |
| `test-center.ts` | `getTestCenterDashboard` |
| `today.ts` | `rankToday`, `getToday` |
| `validations.ts` | `getPendingValidations`, `getMyValidationRequests`, `getCrossModuleValidations`, `getSupervisedValidations`, `getMyValidations`, `getValidationAdminData` |
| `workflow.ts` | `getWorkflowForEntity`, `getWorkflowDefinitions` |

## 6. Routes API existantes (avant ce chantier)

| Route | Méthodes | Fichier |
|---|---|---|
| `/api/activity` | POST | `src/app/api/activity/route.ts` |
| `/api/admin/audit` | GET | `src/app/api/admin/audit/route.ts` |
| `/api/admin/mail-diagnostic` | POST | `src/app/api/admin/mail-diagnostic/route.ts` |
| `/api/assistant/stream` | POST | `src/app/api/assistant/stream/route.ts` |
| `/api/assistant/transcribe` | POST | `src/app/api/assistant/transcribe/route.ts` |
| `/api/auth/{nextauth}` |  | `src/app/api/auth/[...nextauth]/route.ts` |
| `/api/budgets/export` | GET | `src/app/api/budgets/export/route.ts` |
| `/api/documents/{id}` | GET | `src/app/api/documents/[id]/route.ts` |
| `/api/documents/upload` | POST | `src/app/api/documents/upload/route.ts` |
| `/api/dossiers/message-attachment/{id}` | GET | `src/app/api/dossiers/message-attachment/[id]/route.ts` |
| `/api/drive/{id}/raw` | GET | `src/app/api/drive/[id]/raw/route.ts` |
| `/api/drive/{id}/zip` | GET | `src/app/api/drive/[id]/zip/route.ts` |
| `/api/drive/upload` | POST | `src/app/api/drive/upload/route.ts` |
| `/api/drive/zip` | GET | `src/app/api/drive/zip/route.ts` |
| `/api/events/{id}/export` | GET | `src/app/api/events/[id]/export/route.ts` |
| `/api/events/qr/{token}` | GET | `src/app/api/events/qr/[token]/route.ts` |
| `/api/field-reports/{id}/transcribe` | POST | `src/app/api/field-reports/[id]/transcribe/route.ts` |
| `/api/field-reports/{id}/upload` | POST | `src/app/api/field-reports/[id]/upload/route.ts` |
| `/api/field-reports/attachment/{id}` | GET | `src/app/api/field-reports/attachment/[id]/route.ts` |
| `/api/mail/attachment` | GET | `src/app/api/mail/attachment/route.ts` |
| `/api/mail/contacts` | GET | `src/app/api/mail/contacts/route.ts` |
| `/api/mail/inbound` | POST | `src/app/api/mail/inbound/route.ts` |
| `/api/mail/message` | GET | `src/app/api/mail/message/route.ts` |
| `/api/mail/messages` | GET | `src/app/api/mail/messages/route.ts` |
| `/api/market-research/{id}/export` | GET | `src/app/api/market-research/[id]/export/route.ts` |
| `/api/market-research/presentation/{versionId}` | GET | `src/app/api/market-research/presentation/[versionId]/route.ts` |
| `/api/meetings/{id}/recording` | POST | `src/app/api/meetings/[id]/recording/route.ts` |
| `/api/meetings/message-attachment/{id}` | GET | `src/app/api/meetings/message-attachment/[id]/route.ts` |
| `/api/messaging/attachment/{id}` | GET | `src/app/api/messaging/attachment/[id]/route.ts` |
| `/api/messaging/bookmarks` | GET | `src/app/api/messaging/bookmarks/route.ts` |
| `/api/messaging/conversation` | GET | `src/app/api/messaging/conversation/route.ts` |
| `/api/messaging/messages` | GET | `src/app/api/messaging/messages/route.ts` |
| `/api/messaging/sync` | GET | `src/app/api/messaging/sync/route.ts` |
| `/api/messaging/typing` | POST | `src/app/api/messaging/typing/route.ts` |
| `/api/messaging/upload` | POST | `src/app/api/messaging/upload/route.ts` |
| `/api/notifications/poll` | GET | `src/app/api/notifications/poll/route.ts` |
| `/api/onlyoffice/callback` | POST | `src/app/api/onlyoffice/callback/route.ts` |
| `/api/onlyoffice/file` | GET | `src/app/api/onlyoffice/file/route.ts` |
| `/api/pch/export` | GET | `src/app/api/pch/export/route.ts` |
| `/api/process-intelligence/synthesis` | GET | `src/app/api/process-intelligence/synthesis/route.ts` |
| `/api/push/key` | GET | `src/app/api/push/key/route.ts` |
| `/api/push/subscribe` | POST, DELETE | `src/app/api/push/subscribe/route.ts` |
| `/api/regulatory/export` | POST | `src/app/api/regulatory/export/route.ts` |
| `/api/regulatory/intelligence/document/{documentId}` | GET | `src/app/api/regulatory/intelligence/document/[documentId]/route.ts` |
| `/api/regulatory/intelligence/generated/{docId}` | GET | `src/app/api/regulatory/intelligence/generated/[docId]/route.ts` |
| `/api/regulatory/intelligence/ocr/diagnose` | GET | `src/app/api/regulatory/intelligence/ocr/diagnose/route.ts` |
| `/api/regulatory/intelligence/process` | POST | `src/app/api/regulatory/intelligence/process/route.ts` |
| `/api/regulatory/intelligence/progress/{versionId}` | GET | `src/app/api/regulatory/intelligence/progress/[versionId]/route.ts` |
| `/api/regulatory/intelligence/reserves/upload` | POST | `src/app/api/regulatory/intelligence/reserves/upload/route.ts` |
| `/api/regulatory/intelligence/upload` | POST | `src/app/api/regulatory/intelligence/upload/route.ts` |
| `/api/regulatory/intelligence/upload/diagnose` | GET | `src/app/api/regulatory/intelligence/upload/diagnose/route.ts` |
| `/api/regulatory/intelligence/upload/direct/{sessionId}/finalize` | POST | `src/app/api/regulatory/intelligence/upload/direct/[sessionId]/finalize/route.ts` |
| `/api/regulatory/intelligence/upload/session` | POST | `src/app/api/regulatory/intelligence/upload/session/route.ts` |
| `/api/regulatory/intelligence/upload/session/{sessionId}` | GET, DELETE | `src/app/api/regulatory/intelligence/upload/session/[sessionId]/route.ts` |
| `/api/regulatory/intelligence/upload/session/{sessionId}/finalize` | POST | `src/app/api/regulatory/intelligence/upload/session/[sessionId]/finalize/route.ts` |
| `/api/regulatory/intelligence/upload/session/{sessionId}/part` | PUT | `src/app/api/regulatory/intelligence/upload/session/[sessionId]/part/route.ts` |
| `/api/regulatory/intelligence/version/{versionId}/original` | GET | `src/app/api/regulatory/intelligence/version/[versionId]/original/route.ts` |
| `/api/rh/document/{id}` | GET | `src/app/api/rh/document/[id]/route.ts` |
| `/api/rh/upload` | POST | `src/app/api/rh/upload/route.ts` |
| `/api/search` | GET | `src/app/api/search/route.ts` |
| `/api/security/screenshot-attempt` | POST | `src/app/api/security/screenshot-attempt/route.ts` |

## 7. Objets métier (modèles)

| Modèle | Champs | Relations | Description |
|---|---:|---|---|
| `ActivityLog` | 20 | 1 | Fine-grained activity: page views, logins, and time-on-page (from a client beacon), enriched with device, IP and geolocation. |
| `AdminApproval` | 12 | 2 | Demande de validation rattachée à une demande administrative. |
| `AdministrativeRequest` | 42 | 10 | Demande administrative transverse (« Bureau de Donna »). Tout ce qu'on demande à l'assistante devient une demande ; documents/commentaires/validations/missions/ paiements s'y rattachent. Champs spécifiques au type stockés dans `fields`. |
| `AdoptionSetting` | 22 | — | Réglage du score d'adoption — **poids** de chaque dimension et **seuils** de libellé, définis librement par le Super Admin. Le score reste calculé sur des données réelles ; ces valeurs ne font que pondérer/segmenter le résultat. Valeurs par défaut (en code) si la ligne n'existe pas encore. |
| `AdoptionSnapshot` | 8 | 1 | Historique quotidien du score d'adoption (un instantané par utilisateur et par jour). Persisté en backend pour rendre l'évolution **visible** : le score monte ET descend selon l'usage réel sur la fenêtre glissante de 30 jours. Sert aux graphiques d'évolution (moyenne d'équipe + courbe individuelle) et au calcul de la tendance (delta vs jours précédents). Calculé sur données réelles, jamais simulé. |
| `AdProItem` | 42 | 8 | UN POSTE D'UNE OPÉRATION AD & PRO — de quoi est fait le montant.  Un sponsoring ou un congrès n'est presque jamais un simple chèque : il y a l'appui à l'association ou les frais d'inscription, mais aussi le stand, le symposium, les brochures produites pour l'occasion. Les modules ne portaient qu'un montant global : on ne savait ni de quoi il était fait, ni à qui allait l'argent, et le matériel promotionnel produit pour l'événement vivait sans aucun lien.  ⚠️ Un poste n'est PAS une demande : il ne déclenche aucun circuit de validation propre. L'opération garde son circuit unique (National Sales → chef de produit → Direction) et les postes en sont la ventilation. Multiplier les circuits triplerait la bureaucratie que le moteur cherche justement à réduire.  **Deux clés étrangères plutôt qu'un couple (type, id)** : une colonne polymorphe ne peut pas porter de contrainte, donc supprimer un congrès laisserait ses postes orphelins. Ici la suppression en cascade est garantie par la base. Ajouter les congrès internationaux ou les événements se fera par une colonne de plus, pas par une refonte. Exactement UN parent est renseigné (contrainte `AdProItem_one_parent`). |
| `AdProItemDecision` | 9 | 2 | HISTORIQUE DES DÉCISIONS D'UN POSTE — « autant de fois qu'il le faut » : une demande de révision n'écrase pas la précédente, elle s'ajoute. Sans cette trace, un poste accordé au 3ᵉ tour ne dirait plus rien des deux refus qui l'ont précédé. |
| `AiHealthCheck` | 8 | — | Sonde QUOTIDIENNE de l'API IA (chatbot & fonctions IA). Le planificateur interne lance un vrai ping /v1/messages une fois par jour ; chaque résultat est journalisé ici (statut + latence + message EXACT en cas d'échec) et, si l'API est en panne, le Super Admin est alerté. Sert aussi d'historique de santé pour le Contrôle IA. |
| `AiSetting` | 10 | — | Centre de contrôle IA (réglages globaux, Super Admin uniquement). Une seule ligne (`id = "global"`). Permet d'activer/couper l'IA globalement ou par fonction sans toucher au code ni aux variables d'environnement. |
| `AiUsageLog` | 9 | — | Journal d'usage de l'IA — alimente le tableau de bord du Centre de contrôle (volume, taux de succès, latence, erreurs) par fonction et par utilisateur. Best-effort : la journalisation ne doit jamais casser un appel IA. |
| `AnppDerivedRule` | 16 | — | RÈGLE DÉRIVÉE d'un ensemble de réserves récurrentes.  C'est ici que se joue « apprendre sans apprendre aveuglément » : le système PROPOSE une règle quand il voit le même reproche revenir, mais elle reste inerte jusqu'à validation humaine. Elle cite toujours les réserves qui la fondent — on peut donc toujours remonter aux preuves. |
| `AnppReserve` | 34 | 1 | UNE RÉSERVE ANPP, normalisée et rattachée à son contexte produit et CTD. |
| `AnppReserveBatch` | 17 | 1 | LOT DE RÉSERVES — une lettre, un courriel, un tableau reçu de l'ANPP. Conserve le fichier d'origine et son empreinte : la preuve doit rester vérifiable des années plus tard. |
| `AppSetting` | 19 | — | — |
| `AssistantMemory` | 6 | 1 | MÉMOIRE DISTILLÉE d'une personne : ce que l'assistant retient d'elle sur la durée (habitudes, dossiers récurrents, préférences), régénéré à partir de ses conversations. Une ligne par compte, jamais partagée. |
| `AssistantMessage` | 7 | 1 | Message d'un fil. `userId` est VOLONTAIREMENT redondant avec `thread.userId` : il permet de filtrer par propriétaire sans jointure et rend une fuite de données structurellement impossible, même en cas d'erreur de requête. |
| `AssistantThread` | 7 | 2 | FIL DE CONVERSATION avec l'assistant — STRICTEMENT PERSONNEL. Chaque fil appartient à un compte et un seul. Toute lecture passe par un helper qui exige le `userId` (src/lib/assistant-memory.ts) : un identifiant deviné ne donne rien. |
| `AuditLog` | 13 | 1 | — |
| `BdProduct` | 29 | 1 | — |
| `BdProject` | 13 | 2 | — |
| `BdRange` | 9 | 2 | — |
| `BudgetCategoryLine` | 16 | 6 | — |
| `BudgetEnvelope` | 19 | 2 | — |
| `BudgetExpenseLine` | 9 | 1 | — |
| `BudgetLine` | 17 | 1 | — |
| `BusinessDevelopmentOpportunity` | 25 | 1 | — |
| `BusinessUnit` | 13 | 3 | — |
| `CalendarEvent` | 16 | 2 | — |
| `CalendarInvite` | 8 | 2 | — |
| `CareBeneficiary` | 22 | 3 | UNE PERSONNE À PRENDRE EN CHARGE.  Remplace le tableau JSON `beneficiaries` : une personne porte désormais un avis, une décision, et sa propre liste de cases. C'est la ligne du tableau.  Son identité vient soit de l'annuaire médecins, soit d'un profil libre saisi sur place — on ne va pas créer une fiche médecin permanente pour un intervenant vu une seule fois.  Deux clés étrangères nullables (même raison que `AdProItem`) : une colonne polymorphe ne pourrait pas porter de contrainte, et supprimer une demande laisserait ses personnes orphelines. Contrainte `CareBeneficiary_one_parent` : exactement un parent. |
| `CareCell` | 18 | 2 | UNE CASE sur la ligne d'une personne — ce qu'il faut fournir ou acheter POUR ELLE.  Chaque personne a ses propres cases : l'une a besoin d'un visa et pas l'autre, l'une loge à l'hôtel et l'autre chez elle. D'où des cases attachées à la personne, et non des colonnes communes à tout le tableau. |
| `CareQuote` | 18 | 3 | UN DEVIS reçu par le secrétariat.  Un devis couvre **ce qu'il couvre réellement** : une agence de voyage chiffre le groupe entier, pas une ligne par personne. Il est donc rattaché aux CASES qu'il couvre (relation n-n), et accepté ou refusé **d'un bloc** — accepter la moitié d'un devis n'a pas de sens commercial. |
| `CareQuoteCell` | 4 | 2 | Ce qu'un devis couvre : les cases concernées. |
| `Comment` | 8 | 1 | — |
| `Company` | 33 | 24 | — |
| `CongressInternational` | 49 | 4 | — |
| `CongressNational` | 45 | 4 | — |
| `Conversation` | 16 | 3 | — |
| `ConversationMember` | 12 | 2 | — |
| `CustomFieldDef` | 10 | — | Admin-defined extra field for a module. Values are stored in each record's `custom` JSON column keyed by `key`. |
| `DailyBrief` | 6 | 1 | Point du matin de l'assistant : un texte par personne et par jour (fuseau d'Alger). Cache indispensable — sans lui, chaque ouverture de la page relancerait un appel IA. Strictement personnel, comme le reste de la mémoire de l'assistant. |
| `DeletedRecord` | 12 | — | Réglages d'instance modifiables par le Super Admin (limites de taille d'upload, etc.). Ligne unique « global » ; valeurs par défaut (en code) si absente. Corbeille des suppressions définitives (Super Admin) : chaque suppression « définitive » y dépose un instantané (ligne principale + pièces + commentaires) restaurable, jusqu'à destruction réelle. Visible du Super Admin uniquement. |
| `Department` | 25 | 15 | Département de l'entreprise. Hiérarchie sur N NIVEAUX (« comme une vraie boîte ») : un département peut avoir un parent → ses enfants sont ses SOUS-DÉPARTEMENTS. Racine = parentId null. Chaque département porte un RESPONSABLE (head) et un éventuel ADJOINT (deputy) — ce sont eux qui incarnent le « N+1 » quand un employé n'a pas de manager explicite (voir src/lib/departments.ts). |
| `DepartmentBudget` | 11 | 2 | — |
| `DepartmentBudgetAccess` | 15 | 2 | BUDGET D'UN DÉPARTEMENT, pour une année.  Deux natures de budget, DEUX responsables — c'est tout l'intérêt du modèle : • `OPERATING` — le fonctionnement (hors employés), réglé par l'ADMINISTRATEUR ; • `HR` — la masse salariale et le recrutement, réglés par les RESSOURCES HUMAINES.  Une ligne par département, année et nature : le RH ne peut pas toucher au fonctionnement, l'administrateur ne peut pas toucher à la masse salariale, et l'un n'écrase jamais l'autre puisqu'ils n'écrivent pas la même ligne. AUTORISATIONS SUR LE BUDGET D'UN DÉPARTEMENT — réglées par le Super Admin.  Une ligne par département, plus UNE ligne générale (`departmentId = null`) qui s'applique à tous. Les deux se CUMULENT : la règle générale ouvre largement, la règle du département ajoute quelqu'un pour ce département seulement. Rien ne se soustrait — voir `department-budget.ts` pour la règle exacte et pourquoi elle est additive.  Trois portées distinctes, parce que ce ne sont pas les mêmes personnes : • `access*`    — VOIR le budget du département ; • `operating*` — ÉDITER le fonctionnement (hors employés) ; • `hr*`        — ÉDITER les employés et le recrutement. |
| `DepartmentBudgetExpense` | 17 | 5 | DÉPENSE IMPUTÉE à un budget départemental — avec sa pièce justificative (Document lié par `entityType = DEPARTMENT_EXPENSE`).  Sans elle, les moyens généraux affichaient un montant alloué et AUCUNE consommation : un budget qu'on ne peut pas confronter à ses dépenses n'est pas un budget, c'est un vœu. L'assistante de direction y classe ce qu'elle achève (fournitures, prestations) ; le directeur y voit ce que son département consomme réellement. |
| `DepartmentBudgetRequest` | 15 | 3 | DEMANDE DE DOTATION OU DE RALLONGE sur un budget départemental.  Celui qui gère le budget ne se l'accorde pas à lui-même : il le DEMANDE, l'administration tranche. C'est ce qui rend vérifiable la phrase « budget fixé par les RH, validé par l'administration » — sans ce circuit, elle ne serait qu'un usage. |
| `DepartmentExpenseLine` | 9 | 2 | UN ARTICLE D'UN TICKET DE CAISSE / D'UNE FACTURE.  Une dépense n'était qu'un libellé et un montant : « courses 12 400 DZD ». On savait ce qui était sorti de la caisse, jamais ce qui avait été acheté — donc ni ce qu'on consomme le plus, ni à quel prix, ni si le total du ticket correspond à ce qu'on y a mis. Une pièce justificative porte presque toujours PLUSIEURS articles : le modèle le dit maintenant.  Le `label` est FIGÉ à l'achat, en plus du lien vers le catalogue : un article renommé ou retiré du catalogue ne doit pas réécrire l'histoire d'un ticket déjà classé — et un achat hors catalogue (article acheté une fois) reste possible, `articleId` valant alors NULL. |
| `Directive` | 17 | 3 | — |
| `DirectiveMessage` | 7 | 2 | — |
| `Document` | 15 | 1 | — |
| `Dossier` | 18 | 4 | Dossier de suivi d'un sujet ad hoc : on délègue une recherche / analyse / tâche (ex. « rechercher des prix d'hôtels », « analyse IQVIA ») et on suit TOUT au même endroit : description, responsable + participants, statut, fil de discussion et pièces (PPT/Excel/PDF/e-mails) via Document(entityType=DOSSIER). Créable manuellement ou proposé par l'IA depuis un chat / e-mail. |
| `DossierMessage` | 9 | 3 | — |
| `DossierMessageAttachment` | 8 | 1 | Pièce jointe d'un message du fil « Suivi & discussion » (chat) — stockée chiffrée via le backend Drive (blob), comme la messagerie. Supprimée en cascade avec son message. |
| `DriveComment` | 7 | 2 | Commentaire sur un nœud du Drive (fichier ou dossier) : fil de discussion PAR document, utile notamment quand quelqu'un modifie un document (contexte, motif du changement…). Chaque document a ses propres commentaires ; visible/écrit par qui a accès au nœud. |
| `DriveNode` | 21 | 7 | Nœud de l'arborescence Drive : dossier ou fichier. Le contenu binaire vit dans FileBlob (chiffré, adressé par contenu) ; l'historique dans FileVersion. |
| `DriverMission` | 22 | 3 | Mission chauffeur / coursier (Akila), autonome ou rattachée à une demande. |
| `DriverMissionStop` | 8 | 1 | Point de passage d'une course chauffeur (point A, B, C…) : le lieu et la consigne à ce point. Le chauffeur coche chaque point au fur et à mesure. |
| `DriveShare` | 7 | 2 | Partage d'un nœud avec un utilisateur précis (droits VIEW/EDIT). |
| `DriveSpace` | 12 | 1 | Catégorie / espace PARTAGÉ du Drive (ex. « Promotion Médicale »), présenté comme un onglet à côté de « Drive » et « Documents ». Créé par le Super Admin ou un rôle qu'il a autorisé (AppSetting.driveSpaceCreatorRoles). L'accès est encadré exactement comme une enveloppe budgétaire : rôles/personnes en CONSULTATION (accessRoles/accessUserIds) et rôles/personnes GESTIONNAIRES (managerRoles/managerUserIds : déposer, organiser, supprimer, régler les accès). Le créateur est ajouté d'office aux gestionnaires. Les fichiers d'un espace sont partagés entre les personnes autorisées (DriveNode.spaceId), indépendamment de la propriété perso. |
| `Employee` | 55 | 13 | — |
| `EmployeeDocument` | 14 | 2 | — |
| `Event` | 41 | 4 | — |
| `EventRegistration` | 18 | 1 | — |
| `ExpenseOrder` | 26 | 2 | Ordre de dépense : émis automatiquement quand la Direction valide une dépense (sponsoring accepté, avance approuvée…). Le comptable l'exécute, ce qui génère l'écriture de trésorerie OUT et marque la source comme payée. |
| `FeatureFlag` | 10 | 1 | DRAPEAU DE VERSION — chaque nouveauté livrée arrive au stade TEST : elle n'est visible que des comptes en « mode test ». L'administrateur la valide depuis /admin/versions et elle passe en PROD pour tout le monde. Le retour arrière est toujours possible. Le catalogue s'auto-alimente : un drapeau inconnu est créé au premier appel (stade TEST). |
| `Feedback` | 10 | 1 | — |
| `FieldReport` | 32 | 4 | — |
| `FieldReportAttachment` | 8 | 1 | — |
| `FileBlob` | 10 | 2 | Contenu binaire chiffré (AES-256-GCM), dédupliqué par empreinte du clair (SHA-256). |
| `FileBlobChunk` | 5 | 1 | Tranche de contenu chiffré d'un gros FileBlob (data=null). Concaténées dans l'ordre `idx`, elles reforment `ciphertext \|\| tag`. Permet des fichiers jusqu'à ~1 Go en base sans encodage hex géant. |
| `FileVersion` | 11 | 2 | Version d'un fichier (historique). Pointe vers un FileBlob partagé. |
| `FinanceTransaction` | 23 | 3 | General ledger entry — the simplified accounting book + treasury source. |
| `HrDocumentRequest` | 23 | 2 | — |
| `InboundEmail` | 10 | — | COURRIER ENTRANT — messages reçus par webhook (le fournisseur pousse, on ne relève pas de boîte IMAP). La signature du fournisseur est vérifiée AVANT toute écriture. |
| `IntelligenceSnapshot` | 13 | — | Adventum Pulse — instantané périodique (au plus 1×/h) de l'état d'intelligence de la société : agrégats du Risk Radar (Adventum Brain) + de Process Intelligence. Persisté pour l'analyse EN CONTINU : tendances (deltas, courbe) affichées dans les cockpits, et alertes PROACTIVES (nouveau risque critique) envoyées au Super Admin même si personne n'ouvre le module. Calculé sur des données réelles, sans IA. Le champ `bucket` (« YYYY-MM-DDTHH ») sert de verrou : un seul instantané par heure, y compris sous concurrence (contrainte d'unicité). |
| `LeaveRequest` | 28 | 2 | Demande de congé / absence avec circuit de validation. |
| `LoginAttempt` | 7 | — | Anti-bruteforce / anti-credential-stuffing : suivi des tentatives de connexion échouées par identifiant (fenêtre glissante). Verrouillage temporaire après N échecs, réinitialisé à la première connexion réussie. Durée de blocage croissante en cas d'acharnement. Clé = e-mail tenté (en minuscules). |
| `LogisticsOrder` | 36 | 2 | — |
| `MailAccount` | 14 | 1 | Boîte mail personnelle d'un employé (Infomaniak), connectée à la plateforme. Le mot de passe d'application est chiffré (AES-256-GCM) ; IMAP (lecture) + SMTP (envoi) côté serveur uniquement. Un compte par utilisateur. |
| `MarketResearch` | 11 | 2 | — |
| `MarketResearchPlayer` | 9 | 1 | — |
| `MarketResearchPresentation` | 8 | 2 | — |
| `MarketResearchPresentationVersion` | 9 | 1 | — |
| `MarketResearchRow` | 13 | 2 | — |
| `MedicalDelegatePlan` | 14 | 1 | — |
| `MedicalDoctor` | 34 | 6 | — |
| `MedicalInfoDeclaration` | 25 | 3 | — |
| `MedicalInfoDocRequest` | 12 | 2 | — |
| `MedicalInstitution` | 16 | 1 | — |
| `MedicalSpecialty` | 8 | 1 | — |
| `MedicalVisit` | 18 | 2 | — |
| `Meeting` | 26 | 4 | — |
| `MeetingMessage` | 8 | 3 | Fil de discussion (chat) d'une réunion — texte + pièces jointes, comme le chat des dossiers. Ouvert à l'organisateur et aux participants ; supprimé en cascade avec la réunion. |
| `MeetingMessageAttachment` | 8 | 1 | Pièce jointe d'un message du fil d'une réunion — stockée chiffrée via le backend Drive (blob), comme la messagerie. Supprimée en cascade avec son message. |
| `MeetingParticipant` | 7 | 2 | — |
| `MeetingTaskProposal` | 10 | 2 | — |
| `Message` | 21 | 8 | — |
| `MessageAttachment` | 8 | 1 | — |
| `MessageBookmark` | 6 | 2 | — |
| `MessageMention` | 5 | 2 | — |
| `MessageReaction` | 7 | 2 | — |
| `MissionAssignment` | 14 | 1 | — |
| `Notification` | 10 | 1 | — |
| `OfficeSupplyArticle` | 13 | 1 | Catalogue d'articles de fourniture de bureau (Achats). Maintenu par l'assistante de direction ; alimente le menu déroulant des demandes d'achat. |
| `OutboundEmail` | 15 | 1 | COURRIER SORTANT — journal de tous les e-mails envoyés par la plateforme. L'envoi passe par l'API HTTPS d'un fournisseur (port 443, jamais 25/465/587) : c'est ce qui met fin aux blocages SMTP. Chaque envoi laisse une trace consultable, avec le motif exact en cas de refus — on ne se demande plus « est-ce parti ? ». |
| `PayrollEntry` | 21 | 1 | Monthly payslip. When PAID it links to a FinanceTransaction (treasury OUT). |
| `PchOrder` | 17 | 1 | — |
| `PchTender` | 24 | 3 | — |
| `PchTenderLine` | 33 | 1 | — |
| `PettyCashAllotment` | 16 | 5 | — |
| `PettyCashPlan` | 13 | 3 | LE RÉGLAGE MENSUEL de la caisse d'avance : combien, à qui, et quel jour du mois.  Sans ce réglage, la caisse dépendait d'un geste dont personne ne se souvenait à date fixe — et l'on ne pouvait prévenir de rien, faute de savoir quand le rechargement était attendu. C'est aussi ce qui rend possible le rappel aux ressources humaines **48 h avant**. |
| `PettyCashTopUpRequest` | 14 | 3 | — |
| `ProductForecast` | 13 | 2 | — |
| `PromoCycle` | 8 | 2 | — |
| `PromoMaterial` | 28 | 1 | — |
| `PromoProduct` | 13 | 3 | — |
| `PromotionAssignment` | 12 | 2 | — |
| `PushSubscription` | 8 | 1 | Abonnement Web Push (PWA) d'un appareil/navigateur d'un utilisateur, pour les notifications poussées sur le téléphone. Secrets propres au navigateur (pas sensibles). |
| `RegulatoryAiBatch` | 25 | — | LOT D'ANALYSE DIFFÉRÉE (Batch) — la voie à MOITIÉ PRIX.  Le fournisseur facture deux fois moins cher les analyses qu'on accepte d'attendre (jusqu'à 24 h). C'est sans intérêt pour une analyse qu'on regarde tout de suite, et très intéressant pour une RÉANALYSE COMPLÈTE de dossier — qu'on lance le soir et qu'on lit le lendemain.  `mapping` relie chaque réponse du lot au document et à la part de texte d'origine : sans lui, un résultat revenu 12 h plus tard ne serait rattachable à rien. |
| `RegulatoryAiCache` | 8 | — | RÉSULTAT D'ANALYSE MIS EN CACHE — indexé par empreinte d'entrée. C'est ce qui rend l'analyse d'une V2 quasi gratuite quand seuls quelques fichiers ont changé : tout ce qui est identique est relu ici, jamais recalculé. |
| `RegulatoryAiCall` | 19 | 1 | COÛT DE L'IA, appel par appel — la seule façon honnête de répondre à « combien coûte ce dossier ? ». Rattaché au DOSSIER, à l'ÉTAPE et au FICHIER : c'est ce niveau de détail qui permet de voir quel document ou quelle étape mange le budget, et de le corriger.  `cacheKey` est l'empreinte de l'entrée (SHA-256 du prompt + modèle + schéma) : deux analyses identiques ne sont facturées qu'une fois, et un fichier inchangé entre deux versions du dossier n'est jamais ré-analysé. |
| `RegulatoryAssessment` | 12 | 1 | Bilan de complétude/conformité d'une version (recalculé à chaque passage du moteur). `conforme` = aucun bloqueur — un score élevé NE suffit PAS si un bloqueur existe. |
| `RegulatoryAuditLog` | 10 | 1 | Journal d'audit dédié Regulatory Intelligence (qui, quoi, quand, preuve/méta). |
| `RegulatoryCaseDoc` | 10 | 1 | — |
| `RegulatoryCaseStudy` | 9 | 1 | ÉTUDE DE CAS — un produit PASSÉ, son dossier et son ISSUE RÉELLE à l'ANPP. C'est la matière d'ENTRAÎNEMENT de l'analyseur : ses extraits sont injectés dans l'analyse comme PRÉCÉDENTS (« voilà ce que l'agence a réellement accepté/reproché sur NOS produits »), jamais comme règles opposables. Alimenté et géré par le SUPER ADMIN uniquement (module Entraînement IA). |
| `RegulatoryConflict` | 15 | 1 | CONFLIT : valeurs concurrentes d'un même fait entre documents/modules. `values` = toutes les occurrences opposées (valeur, source, section, extrait). Résolution humaine → valeur finale. |
| `RegulatoryCorpusApproval` | 7 | 1 | Traçabilité d'approbation d'une version de corpus (qui a validé/activé/retiré). |
| `RegulatoryDocument` | 24 | 2 | Un document du dossier = entrée de MANIFEST immuable + statut de sécurité/extraction. L'ORIGINAL conserve toujours chemin + nom d'origine ; le renommage vise la copie de travail. |
| `RegulatoryDossier` | 20 | 9 | Un dossier réglementaire (un produit × une procédure) pour une organisation. |
| `RegulatoryDossierChatMessage` | 11 | 1 | MESSAGERIE DU DOSSIER — le fil « Discuter avec ce dossier » PERSISTE côté serveur, comme une messagerie : on quitte l'app, on revient, la discussion est là. UN fil par (dossier, utilisateur). Les pièces soumises conservent leur TEXTE EXTRAIT dans `attachments` : l'agent continue de les voir aux tours suivants (une lettre de réserves envoyée hier reste discutable aujourd'hui). |
| `RegulatoryDossierVersion` | 19 | 9 | Une version reçue du dossier (fournisseur V1, V2…). Contient l'archive ORIGINALE figée. |
| `RegulatoryExtraction` | 14 | 1 | Texte extrait d'un document (une entrée par document). Alimente règles + agents IA. Contenu plafonné (colonne Text) ; `truncated` signale une troncature. |
| `RegulatoryFact` | 15 | 2 | JUMEAU NUMÉRIQUE — un fait réglementaire canonique par (version, clé) : valeur proposée puis approuvée par un humain. Chaque valeur trouvée est une OCCURRENCE sourcée. |
| `RegulatoryFactOccurrence` | 14 | 1 | Une occurrence sourcée d'un fait : document + section (+ page quand l'OCR la fournit), extrait EXACT, confiance, méthode d'extraction, statut humain, date d'effet. |
| `RegulatoryFeatureAccess` | 6 | — | Déblocage du module Regulatory Intelligence PAR ORGANISATION (Company). Masqué par défaut. |
| `RegulatoryFinding` | 29 | 1 | Constat d'analyse (moteur de règles déterministe OU agent IA OU humain). Preuve exigée. Les constats CRITICAL marqués `blocker` verrouillent la soumission (pas de fausse conformité). |
| `RegulatoryGeneratedDoc` | 12 | 1 | GÉNÉRATION DOCUMENTAIRE (G10) — un document produit à partir d'un TEMPLATE versionné et des données du JUMEAU NUMÉRIQUE APPROUVÉ (jamais d'extraction libre). Traçable : quel template, quelle version, quel instant, quel blob produit. |
| `RegulatoryJob` | 18 | 2 | File de jobs asynchrones (Node-first, en base). Runner idempotent, reprise, progression. |
| `RegulatoryLifecycleEvent` | 11 | 1 | LIFECYCLE (G12) — chronologie réglementaire d'un dossier : soumission initiale, séquences, compléments, modifications, renouvellements, réponses, version approuvée. Opérations NEW/REPLACE/DELETE/APPEND sur les pièces. Tracé. |
| `RegulatoryObligation` | 12 | 1 | OBLIGATION post-enregistrement / certificat expirant (G12) — échéance + suivi. |
| `RegulatoryProduct` | 55 | 10 | — |
| `RegulatoryRequest` | 16 | 4 | — |
| `RegulatoryRequestMessage` | 7 | 2 | — |
| `RegulatoryReserveCycle` | 16 | 2 | RÉSERVES ANPP (G9) — un CYCLE de réserves = une lettre reçue de l'ANPP, océrisée (texte verbatim), décomposée en POINTS catégorisés, chacun avec réponse proposée puis approuvée. Multi-cycles (1ʳᵉ lettre, 2ᵉ lettre…). Traçable. |
| `RegulatoryReservePoint` | 17 | 1 | Un point de réserve décomposé : extrait verbatim, catégorie, réponse proposée/approuvée. |
| `RegulatoryRule` | 23 | 1 | Une règle exécutable, sourcée sur le corpus (citation) — appliquée par le moteur déterministe. `procedureTypes`/`productTypes` = applicabilité (vide = toutes). `tests` = cas golden (JSON). |
| `RegulatoryRulePack` | 13 | 1 | MOTEUR DE RÈGLES ADMINISTRABLE (G5) — un « rule pack » regroupe des règles versionnées, approuvées puis activées (ACTIVE = fait foi). Remplace progressivement les profils codés en dur (`requirements.ts`), conservés comme repli tant qu'aucun pack actif n'existe. |
| `RegulatorySimulation` | 8 | 1 | REVIEWER SIMULATOR (G11) — stress test MULTI-PERSPECTIVES du dossier, présenté comme une SIMULATION INTERNE NON PRÉDICTIVE (jamais une décision ANPP). Résultats par perspective (verdict simulé, questions probables, risques), tracés. |
| `RegulatorySource` | 11 | 1 | CORPUS RÉGLEMENTAIRE VERSIONNÉ — une source (texte de loi/arrêté/guideline). Remplace progressivement `anpp-knowledge.ts` (corpus legacy). Une source a plusieurs versions. |
| `RegulatorySourceSection` | 9 | 1 | Section/article d'une version — unité de découpage pour le RAG + citation exacte. |
| `RegulatorySourceVersion` | 16 | 3 | Version datée d'une source : texte original + hash, statut (ACTIVE = fait foi), approbation. |
| `RegulatoryStep` | 13 | 1 | — |
| `RegulatorySupplierQuestion` | 8 | 1 | Une question posée au fournisseur (+ réponse reçue). |
| `RegulatorySupplierRequest` | 17 | 2 | BOUCLE FOURNISSEUR (G8) — demande de compléments au fournisseur : tableau de questions, BROUILLON d'e-mail (l'IA ne crée qu'un brouillon ; l'envoi reste une action humaine), échéance, réponse, relance, historique. Rattachée au dossier. |
| `RegulatoryUploadPart` | 8 | 1 | Une partie reçue d'une session d'upload (octets chiffrés au repos non requis ici : données transitoires supprimées à la finalisation/abandon). Idempotent par index → reprise possible. |
| `RegulatoryUploadSession` | 18 | 1 | UPLOAD RÉSUMABLE DE GROS FICHIERS (G14) — session d'envoi par parties. Chaque partie est stockée séparément → le chemin d'upload ne charge JAMAIS l'archive complète en RAM. La finalisation vérifie taille + SHA-256 côté stockage puis produit un FileBlob (inspection seulement APRÈS finalisation). Quotas par organisation appliqués à la création. |
| `RegulatoryVariation` | 12 | 1 | — |
| `Reminder` | 14 | 1 | RAPPEL personnel « en un clic » posé sur n'importe quel sujet (dossier réglementaire, demande du secrétariat, e-mail, tâche, ou libre). À l'échéance (remindAt), un job planifié notifie le propriétaire. link/entityType/entityId renvoient vers l'objet concerné. |
| `RiskSetting` | 15 | — | Seuils de déclenchement du Risk Radar (Adventum Brain), ajustables par le Super Admin. Une seule ligne (`id = "global"`). Les détecteurs lisent ces valeurs ; en l'absence de ligne, des valeurs par défaut s'appliquent. |
| `RowGrant` | 6 | 1 | Explicit grant of a single row (line) to a user. Combined with UserAccess scope = ASSIGNED, this lets the admin hand-pick which lines a user can see. |
| `SalaryAdvance` | 16 | 2 | Demande d'avance sur salaire. Validée par les RH, réglée par la Comptabilité (crée alors une écriture de trésorerie OUT) et déductible d'un futur bulletin. |
| `Sale` | 29 | 2 | — |
| `SalesRepProfile` | 14 | 1 | — |
| `SalesTeam` | 12 | 2 | — |
| `SfeSettings` | 6 | — | — |
| `SponsoringRequest` | 43 | 3 | — |
| `StockAnnex` | 5 | 1 | Lieu de stockage nommé du module Stocks, géré par le Super Admin. `kind` distingue les HÔPITAUX (`HOSPITAL`) des ANNEXES PCH (`ANNEX`, sites de stockage secondaires de la PCH). Le nom « StockAnnex » est conservé (pas de renommage de table) ; il porte désormais les deux. |
| `StockMovement` | 12 | 1 | — |
| `StockOpeningLevel` | 11 | — | Stock initial d'un produit à un emplacement (PCH…). Sert de base de calcul : niveau courant = stock initial + mouvements (entrées − sorties + ajustements). Permet d'initialiser le stock à l'adoption, puis de le calculer. |
| `StockSnapshot` | 12 | 3 | — |
| `StoredFile` | 4 | — | Fichiers des **documents** (modèle Document, hors Drive) stockés de façon **durable** : le contenu vit dans `FileBlob` (chiffré, dédupliqué, en base), ce qui survit aux redéploiements (le disque local de Render est éphémère). `key` = clé opaque portée par `Document.fileKey`. |
| `Supplier` | 11 | 2 | — |
| `SupplierUser` | 11 | 1 | — |
| `SupportMessage` | 7 | 2 | — |
| `SupportRequest` | 20 | 5 | — |
| `Task` | 20 | 2 | Tâche assignable — cœur de l'espace de travail (to-do, délégation, suivi). |
| `TestArtifact` | 12 | 1 | — |
| `TestFinding` | 14 | 1 | — |
| `TestRun` | 27 | 2 | — |
| `Training` | 34 | 5 | — |
| `TrainingParticipant` | 10 | 2 | Une personne conviée à une formation organisée par les RH. Obligatoire ou volontaire — et dans le second cas, elle répond : accepter une invitation qu'on ne pouvait pas refuser n'aurait aucun sens, et le savoir change la logistique (nombre de couverts, salle). |
| `TreasuryAccount` | 8 | — | Solde d'ouverture d'un compte de trésorerie (Caisse, Banque…). Sert de base de calcul : solde courant = solde d'ouverture + flux réglés enregistrés. Permet d'initialiser la trésorerie à l'adoption de la plateforme, puis de la calculer. |
| `User` | 118 | 93 | — |
| `UserAccess` | 14 | 1 | Per-user, per-module access override. When a row exists it fully replaces the role default for that module, so an admin can grant/revoke a tab and tune exactly which actions a user may perform. |
| `UserCompanyAccess` | 9 | 2 | Entité juridique / société du groupe (Adventum Pharma, Pharmagène, …). Dimension TRANSVERSE : chaque enregistrement clé (produit, appel d'offres, employé, dépense, vente, stock…) peut être rattaché à une entité. Le sélecteur d'entité (barre supérieure) filtre toutes les vues ; « Toutes les entités » englobe l'ensemble (y compris les non rattachés). Entièrement DYNAMIQUE : on peut créer une 3ᵉ (ou Nᵉ) entité, la renommer, changer sa couleur, la désactiver — sans toucher au code. QUI A LE DROIT DE VOIR QUELLE ENTITÉ.  Le sélecteur d'entité de la barre supérieure n'était qu'une **préférence d'affichage** : il proposait toutes les entités à tout le monde, et rien n'empêchait quelqu'un d'Adventum de basculer sur Pharmagène. Pour un groupe multi-entités c'est un défaut d'étanchéité, pas un confort d'affichage.  Une personne peut être salariée d'une entité et travailler pour plusieurs : l'appartenance (`Employee.companyId`) et le DROIT D'ACCÈS sont deux choses distinctes.  `canEdit` sépare voir et modifier : on donne souvent la lecture sur une entité voisine sans le droit d'y écrire. |
| `UserSession` | 14 | 1 | A revocable session. The JWT carries this row's `id`; server-side checks reject revoked/expired sessions, giving the admin real token control. |
| `ValidationItemDecision` | 8 | 1 | — |
| `ValidationRequest` | 26 | 3 | — |
| `ValidationRule` | 20 | 1 | — |
| `ValidationStep` | 11 | 3 | — |
| `WorkflowDefinition` | 10 | 2 | — |
| `WorkflowInstance` | 14 | 2 | — |
| `WorkflowStep` | 23 | 1 | — |
| `WorkflowStepEvent` | 11 | 1 | — |

## 8. Statuts et énumérations

| Énumération | Valeurs |
|---|---|
| `AccessScope` | `ALL` · `ASSIGNED` |
| `AdminApprovalStatus` | `PENDING` · `APPROVED` · `REJECTED` · `CHANGES_REQUESTED` |
| `AdminRequestStatus` | `NEW` · `IN_PROGRESS` · `AWAITING_VALIDATION` · `AWAITING_EXTERNAL` · `AWAITING_PAYMENT` · `AWAITING_DOCUMENT` · `BLOCKED` · `DONE` · `CANCELLED` |
| `AdminRequestType` | `TRAVEL` · `MAIL` · `SIGNATURE` · `PURCHASE` · `QUOTE` · `PAYMENT` · `DRIVER` · `GUEST_VISA` · `HR_SIMPLE` · `OTHER` |
| `AdProItemBudgetKind` | `INCLUDED` · `ADDITIONAL` |
| `AdProItemKind` | `STAND` · `SYMPOSIUM` · `PROMO_MATERIAL` · `SERVICE` · `TRAVEL` · `CONSULTING` · `CATERING` · `VENUE` · `OTHER` |
| `AdProItemOrderStage` | `NONE` · `REQUESTED` · `DIRECTION_OK` · `ISSUED` · `REFUSED` |
| `AdProItemStatus` | `DRAFT` · `PENDING` · `REVISION` · `APPROVED` · `REJECTED` |
| `AdvanceStatus` | `PENDING` · `APPROVED` · `REJECTED` · `PAID` · `CANCELLED` |
| `AnppReserveSeverity` | `CRITICAL` · `MAJOR` · `MINOR` |
| `AnppReserveStatus` | `OPEN` · `ANSWERED` · `ACCEPTED` · `REITERATED` · `CLOSED` |
| `AnppRuleStatus` | `PROPOSED` · `VALIDATED` · `REJECTED` |
| `AuditAction` | `CREATE` · `UPDATE` · `DELETE` · `LOGIN` · `LOGOUT` · `EXPORT` · `IMPORT` · `UPLOAD` · `VALIDATE` · `REFUSE` |
| `BdProjectStatus` | `IDEA` · `TO_ANALYZE` · `IN_PROGRESS` · `AWAITING_SUPPLIER` · `AWAITING_INTERNAL` · `RECOMMENDATION_READY` · `VALIDATED` · `ABANDONED` · `CLOSED` |
| `BdSourcing` | `MANUFACTURED` · `IMPORTED` · `TO_STUDY` |
| `BDStatus` | `IDEA` · `RESEARCH` · `CONTACTED` · `NDA` · `OFFER_RECEIVED` · `NEGOTIATION` · `VALIDATED` · `ABANDONED` |
| `BDType` | `GENERIC` · `BIOSIMILAR` · `ORIGINATOR` · `LICENSE` · `DISTRIBUTION` · `TOLL_MANUFACTURING` |
| `BudgetCategory` | `REGULATORY` · `SPONSORING` · `CONGRESS_INTERNATIONAL` · `CONGRESS_NATIONAL` · `MEDICAL_PROMOTION` · `LOGISTICS` · `BUSINESS_DEVELOPMENT` · `MARKETING` |
| `BudgetStatus` | `ON_TRACK` · `AT_RISK` · `OVER_BUDGET` · `CLOSED` |
| `CalendarEventKind` | `APPOINTMENT` · `MEETING` · `REMINDER` · `DEADLINE` · `INFO` · `OTHER` |
| `CalendarInviteStatus` | `INVITED` · `ACCEPTED` · `DECLINED` · `TENTATIVE` |
| `CareBeneficiaryStatus` | `PROPOSED` · `APPROVED` · `REJECTED` · `WITHDRAWN` |
| `CareCellKind` | `DOCUMENT` · `SERVICE` |
| `CareCellStatus` | `REQUESTED` · `PROVIDED` · `SETTLED` · `WAIVED` |
| `CareOpinion` | `FAVORABLE` · `UNFAVORABLE` · `NONE` |
| `CareQuoteStatus` | `PENDING` · `ACCEPTED` · `REJECTED` |
| `CareServiceKind` | `HOTEL` · `TRANSPORT` · `TICKET` · `CATERING` · `REGISTRATION` · `VISA_FEE` · `PROMO_MATERIAL` · `OTHER` |
| `Confidentiality` | `INTERNAL` · `RESTRICTED` · `CONFIDENTIAL` |
| `CongressRequestStatus` | `AWAITING_PRELIMINARY` · `PRELIMINARY_APPROVED` · `AWAITING_FINAL` · `APPROVED` · `REJECTED` · `CANCELLED` · `COMPLETED` |
| `CongressStatus` | `CONSIDERED` · `VALIDATED` · `ORGANIZED` · `COMPLETED` · `CANCELLED` |
| `ContractType` | `CDI` · `CDD` · `INTERIM` · `STAGE` · `FREELANCE` · `OTHER` |
| `ConversationType` | `DIRECT` · `GROUP` · `CHANNEL` |
| `ConvMemberRole` | `OWNER` · `ADMIN` · `MEMBER` |
| `ConvNotifyLevel` | `ALL` · `MENTIONS` · `NONE` |
| `CustomFieldType` | `TEXT` · `NUMBER` · `DATE` · `BOOLEAN` · `SELECT` |
| `CycleStatus` | `OPEN` · `CLOSED` |
| `DeliveryStatus` | `PENDING` · `IN_TRANSIT` · `DELIVERED` · `RETURNED` |
| `DepartmentBudgetKind` | `OPERATING` · `HR` · `ACTIVITY` · `TRAINING` |
| `DeptBudgetRequestStatus` | `PENDING` · `APPROVED` · `REJECTED` |
| `DirectiveStatus` | `OPEN` · `ACKNOWLEDGED` · `IN_PROGRESS` · `DONE` · `ARCHIVED` |
| `DocRequestStatus` | `PENDING` · `FULFILLED` |
| `DoctorTitle` | `PROFESSEUR` · `MAITRE_CONFERENCES` · `MAITRE_ASSISTANT` · `PRATICIEN_SPECIALISTE` · `ASSISTANT` · `RESIDENT` · `GENERALISTE` · `PHARMACIEN` · `AUTRE` |
| `DocumentCategory` | `CTD_FULL` · `MODULE_1` · `MODULE_2` · `MODULE_3` · `MODULE_4` · `MODULE_5` · `GMP_CERTIFICATE` · `CPP` · `ORIGIN_AMM` · `SUBMISSION_LETTER` · `BV_RECEIPT` · `QUERY_RECEIVED` · `QUERY_RESPONSE` · `REGISTRATION_DECISION` · `PROFORMA` · `INVOICE` · `PACKING_LIST` · `BL_AWB` · `ANALYSIS_CERTIFICATE` · `ORIGIN_CERTIFICATE` · `CUSTOMS_DOCS` · `DELIVERY_NOTE` · `RECEPTION_REPORT` · `REQUEST_LETTER` · `PROGRAM` · `QUOTE` · `CONVENTION` · `SUPPORTING_DOC` · `PHOTO` · `PRESENTATION` · `POST_EVENT_REPORT` · `SUPPLIER_OFFER` · `PURCHASE_ORDER` · `PAYMENT_SLIP` · `PAYMENT_RECEIPT` · `PROMO_MATERIAL_FILE` · `AD_VISA` · `ID_DOCUMENT` · `MISSION_ORDER` · `OTHER` |
| `DossierStatus` | `OPEN` · `IN_PROGRESS` · `ON_HOLD` · `DONE` · `ARCHIVED` |
| `DriveAccess` | `VIEW` · `EDIT` |
| `DriveNodeType` | `FOLDER` · `FILE` |
| `DriverMissionStatus` | `NEW` · `ACCEPTED` · `EN_ROUTE` · `DONE` · `PROBLEM` · `CANCELLED` |
| `EntityType` | `REGULATORY_PRODUCT` · `REGULATORY_STEP` · `SPONSORING` · `BUDGET` · `CONGRESS_INTERNATIONAL` · `CONGRESS_NATIONAL` · `SALE` · `LOGISTICS` · `DOCTOR` · `VISIT` · `DELEGATE_PLAN` · `BD_OPPORTUNITY` · `BD_PROJECT` · `FINANCE_TRANSACTION` · `EMPLOYEE` · `PAYROLL` · `LEAVE_REQUEST` · `TASK` · `SALARY_ADVANCE` · `EXPENSE_ORDER` · `DRIVE_NODE` · `ADMIN_REQUEST` · `DRIVER_MISSION` · `FEEDBACK` · `VALIDATION_REQUEST` · `SUPPLIER` · `MEDICAL_INFO_DECLARATION` · `DIRECTIVE` · `SUPPORT_REQUEST` · `DOSSIER` · `PROMO_MATERIAL` · `HR_REQUEST` · `EVENT` · `MISSION_ASSIGNMENT` · `OFFICE_SUPPLY_ARTICLE` · `PCH_TENDER` · `DEPARTMENT_EXPENSE` |
| `EventFormat` | `PRESENTIAL` · `WEBINAR` · `HYBRID` |
| `EventScope` | `NATIONAL` · `INTERNATIONAL` |
| `EventStatus` | `DRAFT` · `AWAITING_VALIDATION` · `VALIDATED` · `PREPARATION` · `REGISTRATION_OPEN` · `FULL` · `COMPLETED` · `CANCELLED` |
| `EventType` | `CONGRESS` · `SEMINAR` · `ROUND_TABLE` · `HOSPITAL_STAFF` · `SYMPOSIUM` · `WEBINAR` · `TRAINING` · `SCIENTIFIC_DAY` · `OTHER` |
| `ExpenseOrderStatus` | `PENDING` · `REVISION_REQUESTED` · `PAID` · `CANCELLED` |
| `ExternalRegulatoryStatus` | `IN_PREPARATION` · `SUBMITTED` · `UNDER_REVIEW` · `INFO_REQUESTED` · `APPROVED` · `ON_HOLD` · `CLOSED` |
| `FeatureStage` | `TEST` · `PROD` · `OFF` |
| `FeedbackStatus` | `NEW` · `SEEN` · `IN_PROGRESS` · `DONE` |
| `FieldReportStatus` | `DRAFT` · `VALIDATED` · `ARCHIVED` |
| `FinanceCategory` | `RECETTE` · `CCA` · `PRET` · `REMBOURSEMENT` · `SALAIRE` · `AVANCE` · `LOYER` · `VOYAGE` · `EVENEMENT` · `BUREAUTIQUE` · `FOURNISSEUR` · `CHARGES` · `IMPOT` · `BANQUE` · `AUTRE` |
| `FinanceDirection` | `IN` · `OUT` |
| `FinanceMethod` | `CASH` · `BANK_TRANSFER` · `CHEQUE` · `CARD` · `OTHER` |
| `FinanceStatus` | `PENDING` · `SETTLED` · `CANCELLED` |
| `HrDocumentCategory` | `CONTRACT` · `AMENDMENT` · `PAYSLIP` · `WORK_CERTIFICATE` · `CNAS_CERTIFICATE` · `SALARY_STATEMENT` · `DOMICILIATION` · `ID_DOCUMENT` · `DIPLOMA` · `MEDICAL` · `OTHER` |
| `HrRequestStatus` | `PENDING` · `IN_PROGRESS` · `READY` · `DELIVERED` · `APPROVED` · `REJECTED` |
| `HrRequestType` | `WORK_CERTIFICATE` · `CNAS_CERTIFICATE` · `SALARY_STATEMENT` · `DOMICILIATION` · `LEAVE_CERTIFICATE` · `LEAVE_TITLE` · `MISSION_ORDER` · `EXPENSE_REPORT` · `EXCEPTIONAL_EXIT` · `SICK_LEAVE` · `ANNUAL_LEAVE` · `UNPAID_LEAVE` · `SPECIAL_LEAVE` · `MATERNITY_LEAVE` · `HR_INTERVIEW` · `OTHER` |
| `InfluenceLevel` | `LOW` · `MEDIUM` · `HIGH` · `KEY_OPINION_LEADER` |
| `InstitutionSector` | `PUBLIC` · `PRIVE` |
| `InstitutionType` | `CHU` · `EPH` · `EHS` · `CLINIQUE_PRIVEE` · `POLYCLINIQUE` · `CABINET` · `CENTRE_SANTE` · `PHARMACIE` · `GROSSISTE` · `AUTRE` |
| `LeaveStage` | `MANAGER` · `HR` · `DG` · `DONE` |
| `LeaveStatus` | `PENDING` · `APPROVED` · `REJECTED` · `CANCELLED` |
| `LeaveType` | `ANNUAL` · `SICK` · `UNPAID` · `MATERNITY` · `SPECIAL` · `RECOVERY` · `OTHER` |
| `LogisticsStatus` | `ORDERED` · `PRODUCTION` · `SHIPPED` · `ARRIVED_TERMINAL` · `CUSTOMS` · `DELIVERED` · `BLOCKED` |
| `ManufacturingStatus` | `IMPORTATION` · `SECONDARY_PACKAGING` · `PRIMARY_PACKAGING` · `FULL_PROCESS` |
| `MarketResearchStatus` | `DRAFT` · `FINAL` |
| `MaterialType` | `PRESENTOIRE` · `STAND_BOOTH` · `CARNET_BILAN` · `SOUS_MAINS` · `BLOC_NOTE` · `SAC_A_DOS` · `PORTE_CARTE_RDV` · `BANNER` · `FICHE_POSO` · `ADV` · `FICHE_CONSEILS` · `FICHE_GAMME` · `POSTER` · `VIDEO` · `CADEAUX_FIN_ANNEE` · `CARTES_INVITATIONS` · `STYLOS` · `CLE_USB` · `AUTRES` |
| `MedicalInfoStatus` | `AWAITING_REVIEW` · `DOCS_REQUESTED` · `READY` · `AWAITING_DIRECTION` · `VALIDATED` |
| `MedicalSector` | `HOSPITAL` · `LIBERAL` · `BOTH` |
| `MeetingKind` | `MEETING` · `CALL` |
| `MeetingStatus` | `SCHEDULED` · `LIVE` · `ENDED` |
| `MeetingTaskStatus` | `PROPOSED` · `ACCEPTED` · `DISMISSED` |
| `MessageKind` | `TEXT` · `SYSTEM` · `FILE` |
| `MissionOrderStatus` | `NONE` · `REQUESTED` · `ISSUED` |
| `MissionRole` | `ACCOMPAGNANT` · `DELEGATE_REFERENCE` |
| `NationalEventType` | `CONGRESS` · `SEMINAR` · `ROUND_TABLE` · `WEBINAR` · `WORKSHOP` · `SYMPOSIUM` · `STAFF` · `OTHER` |
| `NotificationType` | `DEADLINE_NEAR` · `LATE` · `ASSIGNMENT` · `DOCUMENT_UPLOADED` · `VALIDATION_REQUIRED` · `BUDGET_EXCEEDED` · `PCH_DELAY` · `REGULATORY_BLOCKED` · `SPONSORING_VALIDATION` · `BD_NEXT_ACTION` · `MEDICAL_TOUR` · `GENERIC` |
| `OutboundEmailStatus` | `QUEUED` · `SENT` · `FAILED` |
| `ParticipantRole` | `DOCTOR` · `PROFESSOR` · `HEAD_OF_SERVICE` · `PHARMACIST` · `OTHER` |
| `PaymentStatus` | `UNPAID` · `PARTIAL` · `PAID` · `OVERDUE` |
| `PayrollStatus` | `DRAFT` · `VALIDATED` · `PAID` |
| `PchLineStatus` | `PENDING` · `QUOTED` · `SUBMITTED` · `WON` · `LOST` |
| `PchOrderStatus` | `PENDING` · `VALIDATED` · `DELIVERED` · `PAID` · `CANCELLED` |
| `PchTenderStatus` | `NOT_STARTED` · `IN_PROGRESS` · `COMPLETED` · `CANCELLED` |
| `PettyCashStatus` | `ALLOTTED` · `RECEIVED` · `CLOSED` |
| `PettyCashTopUpStatus` | `PENDING` · `APPROVED` · `REJECTED` |
| `PlayerStatus` | `IMPORT` · `MANUFACTURING` |
| `Priority` | `LOW` · `MEDIUM` · `HIGH` · `CRITICAL` |
| `ProductChannel` | `RETAIL` · `HOSPITAL` · `BOTH` |
| `ProductType` | `IMPORTED` · `LOCALLY_MANUFACTURED` · `TOLL_MANUFACTURING` · `BIOSIMILAR` · `GENERIC` · `ORIGINATOR` |
| `PromoMaterialStatus` | `PROSPECTION_REQUESTED` · `QUOTES_UPLOADED` · `AGENCY_CHOSEN` · `BC_FINANCE_REVIEW` · `BC_VALIDATED` · `BC_SENT` · `PAYMENT_INITIATED` · `PAYMENT_DONE` · `MATERIAL_PRODUCED` · `CONFORMITY_REVIEW` · `VISA_OBTAINED` · `BAT_PRINTING` · `FINAL_MATERIAL` · `INVOICED` · `SETTLED` · `CANCELLED` |
| `RegCaseOutcome` | `ACCEPTED` · `ACCEPTED_WITH_RESERVES` · `REJECTED` · `UNKNOWN` |
| `RegConflictStatus` | `OPEN` · `RESOLVED` · `WAIVED` |
| `RegDocExtractionStatus` | `PENDING` · `TEXT_EXTRACTED` · `OCR_REQUIRED` · `OCR_COMPLETED` · `LOW_CONFIDENCE` · `CORRUPTED` · `PASSWORD_PROTECTED` · `UNSUPPORTED` · `MANUAL_REVIEW_REQUIRED` |
| `RegDocKind` | `ORIGINAL` · `WORKING` · `APPROVED` |
| `RegDocSecurityStatus` | `PENDING` · `SAFE` · `BLOCKED_EXECUTABLE` · `BLOCKED_ENCRYPTED` · `BLOCKED_PATH` · `BLOCKED_OVERSIZE` · `SUSPICIOUS` · `CORRUPTED` |
| `RegDossierStatus` | `DRAFT` · `INGESTING` · `INGESTED` · `ANALYSING` · `IN_REVIEW` · `SUPPLIER_LOOP` · `READY_FOR_REVIEW` · `SUBMITTED` · `DECISION` · `MAINTAINED` · `ARCHIVED` · `ERROR` |
| `RegFactStatus` | `PROPOSED` · `CONFIRMED` · `CORRECTED` · `REJECTED` |
| `RegFindingSeverity` | `CRITICAL` · `MAJOR` · `MINOR` · `INFO` |
| `RegFindingSource` | `RULE` · `AI` · `HUMAN` |
| `RegFindingStatus` | `OPEN` · `ACKNOWLEDGED` · `RESOLVED` · `WAIVED` |
| `RegistrationStatus` | `REGISTERED` · `CONFIRMED` · `PENDING` · `REJECTED` · `PRESENT` · `ABSENT` · `CANCELLED` |
| `RegJobStatus` | `QUEUED` · `RUNNING` · `DONE` · `FAILED` · `CANCELLED` |
| `RegJobType` | `INGEST` · `EXTRACT` · `OCR` · `CLASSIFY` · `FACTS` · `RULES` · `AI_REVIEW` · `VISION` · `CHALLENGER` · `SIMULATE` |
| `RegLifecycleKind` | `SUBMISSION` · `SEQUENCE` · `SUPPLEMENT` · `MODIFICATION` · `RENEWAL` · `RESPONSE` · `APPROVED` · `WITHDRAWAL` |
| `RegLifecycleOperation` | `NEW` · `REPLACE` · `DELETE` · `APPEND` |
| `RegObligationStatus` | `OPEN` · `DONE` · `OVERDUE` |
| `RegProcedureType` | `PRESUBMISSION` · `INITIAL_REGISTRATION` · `NEW_ACTIVE_SUBSTANCE` · `GENERIC` · `BIOSIMILAR` · `IMPORTED` · `LOCAL_MANUFACTURING` · `ADD_DOSAGE` · `ADD_PRESENTATION` · `EXTENSION_INDICATION` · `VARIATION` · `RENEWAL` · `TRANSFER` · `RESERVE_RESPONSE` · `SUPPLEMENT` · `WITHDRAWAL` · `CESSATION` · `OTHER` |
| `RegRequestCategory` | `QUESTION` · `DOCUMENT` · `STATUS_UPDATE` · `VARIATION` · `OTHER` |
| `RegRequestStatus` | `OPEN` · `IN_PROGRESS` · `ANSWERED` · `CLOSED` |
| `RegReservePointStatus` | `OPEN` · `DRAFTED` · `APPROVED` |
| `RegRuleKind` | `SECTION_REQUIRED` · `SECTION_EXPECTED` · `DOCUMENT_PRESENT` · `FACT_REQUIRED` · `CUSTOM` |
| `RegSourceStatus` | `DRAFT` · `ACTIVE` · `RETIRED` |
| `RegSupplierStatus` | `DRAFT` · `SENT` · `RESPONDED` · `CLOSED` |
| `RegulatoryCategory` | `MEDICINE` · `MEDICAL_DEVICE` |
| `RegulatoryStatus` | `PRE_SUBMISSION` · `IN_PREPARATION` · `SUBMITTED` · `AWAITING_BV_PAYMENT` · `AWAITING_ANPP` · `RESPONDING_TO_QUERIES` · `DECISION_OBTAINED` · `BLOCKED` · `CLOSED` |
| `RegulatoryStepType` | `PRE_SUBMISSION` · `CTD_PREPARATION` · `DOSSIER_REVIEW` · `DOSSIER_SUBMISSION` · `BV1_PAYMENT` · `BV1_RECEIPT` · `BV2_PAYMENT` · `BV2_RECEIPT` · `BV3_PAYMENT` · `BV3_RECEIPT` · `QUERY_RESPONSE` · `COMPLEMENTS_REQUESTED` · `COMPLEMENTS_SUBMITTED` · `COMMISSION_REVIEW` · `REGISTRATION_DECISION` · `AMM_RECEIVED` · `DOSSIER_CLOSED` |
| `RegUploadStatus` | `UPLOADING` · `FINALIZING` · `COMPLETED` · `ABORTED` |
| `ReminderStatus` | `PENDING` · `SENT` · `DONE` · `CANCELLED` |
| `SaleType` | `PRODUCT` · `SERVICE` |
| `SegmentLevel` | `VERY_HIGH` · `HIGH` · `MEDIUM` · `LOW` · `VERY_LOW` |
| `SponsoringStatus` | `RECEIVED` · `IN_ANALYSIS` · `ACCEPTED` · `REFUSED` · `AWAITING_DIRECTION` · `PAID` · `CLOSED` · `AWAITING_PRELIMINARY` · `PRELIMINARY_APPROVED` · `AWAITING_FINAL` · `APPROVED` · `APPEAL_PENDING` · `AWAITING_FINAL_APPEAL` · `CANCELLED` |
| `StepStatus` | `NOT_STARTED` · `IN_PROGRESS` · `DONE` · `BLOCKED` · `LATE` |
| `StockDirection` | `IN` · `OUT` · `ADJUST` |
| `SupportCategory` | `QUESTION` · `SUPPORT_MATERIAL` · `BROCHURE` · `DOCUMENT` · `OTHER` |
| `SupportStatus` | `OPEN` · `IN_PROGRESS` · `ANSWERED` · `CLOSED` |
| `TaskStatus` | `REQUESTED` · `TODO` · `IN_PROGRESS` · `DONE` · `CANCELLED` · `DECLINED` |
| `TestCertification` | `CERTIFIED` · `CERTIFIED_WITH_RESERVATIONS` · `BLOCKED` · `INCONCLUSIVE` |
| `TestCleanupStatus` | `NOT_REQUIRED` · `PENDING` · `RUNNING` · `DONE` · `INCOMPLETE` |
| `TestRunMode` | `READ_ONLY_AUDIT` · `SAFE_SYNTHETIC_TEST` · `STAGING_FULL_TEST` · `CHAOS_TEST` · `SECURITY_AUDIT` · `PERFORMANCE_BENCHMARK` |
| `TestRunStatus` | `PENDING` · `RUNNING` · `PASSED` · `FAILED` · `ABORTED` · `CLEANUP_INCOMPLETE` |
| `TestSeverity` | `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `INFO` |
| `TrainingAttendance` | `MANDATORY` · `VOLUNTARY` |
| `TrainingOrigin` | `EMPLOYEE` · `HR` |
| `TrainingParticipantState` | `INVITED` · `ACCEPTED` · `DECLINED` |
| `TrainingStatus` | `DRAFT` · `PENDING` · `APPROVED` · `REJECTED` · `CANCELLED` · `DONE` |
| `UserRole` | `SUPER_ADMIN` · `DIRECTION` · `HEAD_OF_REGULATORY` · `REGULATORY_ASSISTANT` · `HEAD_OF_SALES` · `SALES_USER` · `LOGISTICS_MANAGER` · `MEDICAL_PROMOTION_MANAGER` · `MEDICAL_DELEGATE` · `NATIONAL_SALES` · `PRODUCT_MANAGER` · `BUSINESS_DEVELOPMENT_MANAGER` · `FINANCE_BUDGET_MANAGER` · `MEDICAL_INFO_PHARMACIST` · `DIRECTION_ASSISTANT` · `COORDINATOR` · `VIEWER` |
| `ValidationMode` | `SEQUENTIAL` · `PARALLEL` |
| `ValidationStatus` | `PENDING` · `APPROVED` · `REJECTED` · `CHANGES_REQUESTED` · `CANCELLED` |
| `ValidationStepState` | `PENDING` · `APPROVED` · `REJECTED` · `CHANGES_REQUESTED` · `SKIPPED` |
| `VariationStatus` | `EN_ATTENTE` · `OBTENUE` · `ANNULE` |
| `VisitStatus` | `PLANNED` · `COMPLETED` · `CANCELLED` · `POSTPONED` |

## 9. Automatisations (planificateur)

Aucun cron externe : un battement interne (`src/lib/scheduled.ts`) lance ces tâches, au
plus une fois par minute, chacune idempotente.

| Tâche | Rôle |
|---|---|
| `sendDueMeetingReminders` | — |
| `sendDueReminders` | — |
| `sendDuePayrollNotifications` | — |
| `accrueMonthlyLeave` | +2,5 j/mois (idempotent) |
| `performAiHealthCheck` | test IA 1×/jour + alerte Super Admin |
| `runDueRegulatoryJobs` | — |
| `pruneStaleUploadSessions` | nettoyage des sessions d'upload incomplètes |
| `purgeClosedSessionParts` | filet : octets d'envois clos qu'un redémarrage aurait laissés |
| `runAnppWatchIfDue` | veille ANPP 1×/jour : une ligne directrice ne doit pas changer sans qu'on le sache |
| `pollAiBatches` | analyses différées (moitié prix) : récupère les lots terminés |
| `expireStaleBatches` | lots fantômes : sinon l'écran dit « sous 24 h » à vie |
| `catchUpStalledPipelines` | — |
| `catchUpMissingAiReviews` | — |
| `embedBacklog` | vecteurs sémantiques : un paquet par passage, jamais plus |
| `runIntelligencePulse` | Adventum Pulse : instantané horaire (Brain + Process Intelligence) + alerte proactive |
| `runPettyCashRechargeReminders` | — |

## 10. Drapeaux de version (test → production)

| Clé | Libellé | Description |
|---|---|---|
| `assistant_memory` | Assistant — mémoire personnelle | L'assistant se souvient des conversations passées de CHAQUE personne (fils persistants, mémoire distillée) et connaît son identité, son département et son N+1. Cloisonnement strict : personne ne peut atteindre la mémoire d'un autre. |
| `home_today` | Écran d'accueil « Aujourd'hui » | À l'ouverture, on voit ce qui nous attend (validations, tâches, échéances) au lieu d'un menu de modules. Objectif : adoption. |
| `mail_smart` | Courrier « smart » (API + webhook) | Envoi par API HTTPS et réception par webhook entrant, à la place d'IMAP/SMTP qui se bloquait. Nécessite un compte fournisseur et des enregistrements DNS. |
| `assistant_proactive` | Assistant proactif (point du matin) | Un point quotidien dans le module Assistant : ce qui attend la personne, ce qui bloque, ce qui arrive à échéance. |

## 11. Moteurs de workflow

- `src/lib/workflow/defaults.ts`
- `src/lib/workflow/engine.ts`
- `src/lib/workflow/origin.ts`
- `src/lib/workflow/types.ts`

Voir aussi `src/lib/approval-chain.ts` (chaîne à trois étages Manager → RH → Direction),
`src/lib/regulatory-workflow.ts` (17 étapes + processus ANPP) et `src/lib/hr/leave-core.ts`.
