# API_COVERAGE — ce que l'API couvre, et ce qu'elle ne couvre pas encore

> **Généré** par `npx tsx scripts/api/gen-docs.ts`. Une matrice de couverture écrite à la
> main affirme ; celle-ci **mesure**, en confrontant le registre de l'API à la carte de
> l'ERP (`ERP_AUDIT.md`). Les manques ci-dessous sont donc réels, et se réduisent en
> ajoutant des entrées au registre — pas en corrigeant ce document.

## 1. Volumétrie

| Élément | ERP | Couvert par l'API | Reste |
|---|---:|---:|---:|
| Objets métier (modèles Prisma) | 195 | 26 | 169 |
| Actions serveur (écriture métier) | 494 | 0 | 494 |
| Opérations d'API exposées | — | 213 | — |

## 2. Opérations exposées

| operationId | Méthode | Chemin | Portées |
|---|---|---|---|
| `download_document_content` | GET | `/api/v1/documents/{id}/content` | `erp.documents.read` |
| `get_admin_request` | GET | `/api/v1/entities/admin_request/{id}` | `erp.read` |
| `get_admin_request_available_actions` | GET | `/api/v1/entities/admin_request/{id}/available-actions` | `erp.read` |
| `get_admin_request_history` | GET | `/api/v1/entities/admin_request/{id}/history` | `erp.read` |
| `get_admin_request_related` | GET | `/api/v1/entities/admin_request/{id}/related` | `erp.read` |
| `get_admin_request_workflow` | GET | `/api/v1/entities/admin_request/{id}/workflow` | `erp.read` |
| `get_audit_log` | GET | `/api/v1/entities/audit_log/{id}` | `erp.read` |
| `get_audit_log_available_actions` | GET | `/api/v1/entities/audit_log/{id}/available-actions` | `erp.read` |
| `get_audit_log_history` | GET | `/api/v1/entities/audit_log/{id}/history` | `erp.read` |
| `get_audit_log_related` | GET | `/api/v1/entities/audit_log/{id}/related` | `erp.read` |
| `get_audit_log_workflow` | GET | `/api/v1/entities/audit_log/{id}/workflow` | `erp.read` |
| `get_company` | GET | `/api/v1/entities/company/{id}` | `erp.read` |
| `get_company_available_actions` | GET | `/api/v1/entities/company/{id}/available-actions` | `erp.read` |
| `get_company_history` | GET | `/api/v1/entities/company/{id}/history` | `erp.read` |
| `get_company_related` | GET | `/api/v1/entities/company/{id}/related` | `erp.read` |
| `get_company_workflow` | GET | `/api/v1/entities/company/{id}/workflow` | `erp.read` |
| `get_congress_international` | GET | `/api/v1/entities/congress_international/{id}` | `erp.read` |
| `get_congress_international_available_actions` | GET | `/api/v1/entities/congress_international/{id}/available-actions` | `erp.read` |
| `get_congress_international_history` | GET | `/api/v1/entities/congress_international/{id}/history` | `erp.read` |
| `get_congress_international_related` | GET | `/api/v1/entities/congress_international/{id}/related` | `erp.read` |
| `get_congress_international_workflow` | GET | `/api/v1/entities/congress_international/{id}/workflow` | `erp.read` |
| `get_congress_national` | GET | `/api/v1/entities/congress_national/{id}` | `erp.read` |
| `get_congress_national_available_actions` | GET | `/api/v1/entities/congress_national/{id}/available-actions` | `erp.read` |
| `get_congress_national_history` | GET | `/api/v1/entities/congress_national/{id}/history` | `erp.read` |
| `get_congress_national_related` | GET | `/api/v1/entities/congress_national/{id}/related` | `erp.read` |
| `get_congress_national_workflow` | GET | `/api/v1/entities/congress_national/{id}/workflow` | `erp.read` |
| `get_department` | GET | `/api/v1/entities/department/{id}` | `erp.read` |
| `get_department_available_actions` | GET | `/api/v1/entities/department/{id}/available-actions` | `erp.read` |
| `get_department_budget` | GET | `/api/v1/entities/department_budget/{id}` | `erp.read` |
| `get_department_budget_available_actions` | GET | `/api/v1/entities/department_budget/{id}/available-actions` | `erp.read` |
| `get_department_budget_history` | GET | `/api/v1/entities/department_budget/{id}/history` | `erp.read` |
| `get_department_budget_related` | GET | `/api/v1/entities/department_budget/{id}/related` | `erp.read` |
| `get_department_budget_workflow` | GET | `/api/v1/entities/department_budget/{id}/workflow` | `erp.read` |
| `get_department_expense` | GET | `/api/v1/entities/department_expense/{id}` | `erp.read` |
| `get_department_expense_available_actions` | GET | `/api/v1/entities/department_expense/{id}/available-actions` | `erp.read` |
| `get_department_expense_history` | GET | `/api/v1/entities/department_expense/{id}/history` | `erp.read` |
| `get_department_expense_related` | GET | `/api/v1/entities/department_expense/{id}/related` | `erp.read` |
| `get_department_expense_workflow` | GET | `/api/v1/entities/department_expense/{id}/workflow` | `erp.read` |
| `get_department_history` | GET | `/api/v1/entities/department/{id}/history` | `erp.read` |
| `get_department_related` | GET | `/api/v1/entities/department/{id}/related` | `erp.read` |
| `get_department_workflow` | GET | `/api/v1/entities/department/{id}/workflow` | `erp.read` |
| `get_doctor` | GET | `/api/v1/entities/doctor/{id}` | `erp.read` |
| `get_doctor_available_actions` | GET | `/api/v1/entities/doctor/{id}/available-actions` | `erp.read` |
| `get_doctor_history` | GET | `/api/v1/entities/doctor/{id}/history` | `erp.read` |
| `get_doctor_related` | GET | `/api/v1/entities/doctor/{id}/related` | `erp.read` |
| `get_doctor_workflow` | GET | `/api/v1/entities/doctor/{id}/workflow` | `erp.read` |
| `get_document` | GET | `/api/v1/entities/document/{id}` | `erp.read` |
| `get_document_available_actions` | GET | `/api/v1/entities/document/{id}/available-actions` | `erp.read` |
| `get_document_history` | GET | `/api/v1/entities/document/{id}/history` | `erp.read` |
| `get_document_related` | GET | `/api/v1/entities/document/{id}/related` | `erp.read` |
| `get_document_workflow` | GET | `/api/v1/entities/document/{id}/workflow` | `erp.read` |
| `get_dossier` | GET | `/api/v1/entities/dossier/{id}` | `erp.read` |
| `get_dossier_available_actions` | GET | `/api/v1/entities/dossier/{id}/available-actions` | `erp.read` |
| `get_dossier_history` | GET | `/api/v1/entities/dossier/{id}/history` | `erp.read` |
| `get_dossier_related` | GET | `/api/v1/entities/dossier/{id}/related` | `erp.read` |
| `get_dossier_workflow` | GET | `/api/v1/entities/dossier/{id}/workflow` | `erp.read` |
| `get_employee` | GET | `/api/v1/entities/employee/{id}` | `erp.read` |
| `get_employee_available_actions` | GET | `/api/v1/entities/employee/{id}/available-actions` | `erp.read` |
| `get_employee_history` | GET | `/api/v1/entities/employee/{id}/history` | `erp.read` |
| `get_employee_related` | GET | `/api/v1/entities/employee/{id}/related` | `erp.read` |
| `get_employee_workflow` | GET | `/api/v1/entities/employee/{id}/workflow` | `erp.read` |
| `get_entity_schema` | GET | `/api/v1/meta/entities/{entity}` | `erp.read` |
| `get_event` | GET | `/api/v1/entities/event/{id}` | `erp.read` |
| `get_event_available_actions` | GET | `/api/v1/entities/event/{id}/available-actions` | `erp.read` |
| `get_event_history` | GET | `/api/v1/entities/event/{id}/history` | `erp.read` |
| `get_event_related` | GET | `/api/v1/entities/event/{id}/related` | `erp.read` |
| `get_event_workflow` | GET | `/api/v1/entities/event/{id}/workflow` | `erp.read` |
| `get_expense_order` | GET | `/api/v1/entities/expense_order/{id}` | `erp.read` |
| `get_expense_order_available_actions` | GET | `/api/v1/entities/expense_order/{id}/available-actions` | `erp.read` |
| `get_expense_order_history` | GET | `/api/v1/entities/expense_order/{id}/history` | `erp.read` |
| `get_expense_order_related` | GET | `/api/v1/entities/expense_order/{id}/related` | `erp.read` |
| `get_expense_order_workflow` | GET | `/api/v1/entities/expense_order/{id}/workflow` | `erp.read` |
| `get_leave_request` | GET | `/api/v1/entities/leave_request/{id}` | `erp.read` |
| `get_leave_request_available_actions` | GET | `/api/v1/entities/leave_request/{id}/available-actions` | `erp.read` |
| `get_leave_request_history` | GET | `/api/v1/entities/leave_request/{id}/history` | `erp.read` |
| `get_leave_request_related` | GET | `/api/v1/entities/leave_request/{id}/related` | `erp.read` |
| `get_leave_request_workflow` | GET | `/api/v1/entities/leave_request/{id}/workflow` | `erp.read` |
| `get_medical_info_declaration` | GET | `/api/v1/entities/medical_info_declaration/{id}` | `erp.read` |
| `get_medical_info_declaration_available_actions` | GET | `/api/v1/entities/medical_info_declaration/{id}/available-actions` | `erp.read` |
| `get_medical_info_declaration_history` | GET | `/api/v1/entities/medical_info_declaration/{id}/history` | `erp.read` |
| `get_medical_info_declaration_related` | GET | `/api/v1/entities/medical_info_declaration/{id}/related` | `erp.read` |
| `get_medical_info_declaration_workflow` | GET | `/api/v1/entities/medical_info_declaration/{id}/workflow` | `erp.read` |
| `get_medical_visit` | GET | `/api/v1/entities/medical_visit/{id}` | `erp.read` |
| `get_medical_visit_available_actions` | GET | `/api/v1/entities/medical_visit/{id}/available-actions` | `erp.read` |
| `get_medical_visit_history` | GET | `/api/v1/entities/medical_visit/{id}/history` | `erp.read` |
| `get_medical_visit_related` | GET | `/api/v1/entities/medical_visit/{id}/related` | `erp.read` |
| `get_medical_visit_workflow` | GET | `/api/v1/entities/medical_visit/{id}/workflow` | `erp.read` |
| `get_notification` | GET | `/api/v1/entities/notification/{id}` | `erp.read` |
| `get_notification_available_actions` | GET | `/api/v1/entities/notification/{id}/available-actions` | `erp.read` |
| `get_notification_history` | GET | `/api/v1/entities/notification/{id}/history` | `erp.read` |
| `get_notification_related` | GET | `/api/v1/entities/notification/{id}/related` | `erp.read` |
| `get_notification_workflow` | GET | `/api/v1/entities/notification/{id}/workflow` | `erp.read` |
| `get_pch_tender` | GET | `/api/v1/entities/pch_tender/{id}` | `erp.read` |
| `get_pch_tender_available_actions` | GET | `/api/v1/entities/pch_tender/{id}/available-actions` | `erp.read` |
| `get_pch_tender_history` | GET | `/api/v1/entities/pch_tender/{id}/history` | `erp.read` |
| `get_pch_tender_related` | GET | `/api/v1/entities/pch_tender/{id}/related` | `erp.read` |
| `get_pch_tender_workflow` | GET | `/api/v1/entities/pch_tender/{id}/workflow` | `erp.read` |
| `get_regulatory_dossier` | GET | `/api/v1/entities/regulatory_dossier/{id}` | `erp.read` |
| `get_regulatory_dossier_available_actions` | GET | `/api/v1/entities/regulatory_dossier/{id}/available-actions` | `erp.read` |
| `get_regulatory_dossier_history` | GET | `/api/v1/entities/regulatory_dossier/{id}/history` | `erp.read` |
| `get_regulatory_dossier_related` | GET | `/api/v1/entities/regulatory_dossier/{id}/related` | `erp.read` |
| `get_regulatory_dossier_workflow` | GET | `/api/v1/entities/regulatory_dossier/{id}/workflow` | `erp.read` |
| `get_sale` | GET | `/api/v1/entities/sale/{id}` | `erp.read` |
| `get_sale_available_actions` | GET | `/api/v1/entities/sale/{id}/available-actions` | `erp.read` |
| `get_sale_history` | GET | `/api/v1/entities/sale/{id}/history` | `erp.read` |
| `get_sale_related` | GET | `/api/v1/entities/sale/{id}/related` | `erp.read` |
| `get_sale_workflow` | GET | `/api/v1/entities/sale/{id}/workflow` | `erp.read` |
| `get_sponsoring` | GET | `/api/v1/entities/sponsoring/{id}` | `erp.read` |
| `get_sponsoring_available_actions` | GET | `/api/v1/entities/sponsoring/{id}/available-actions` | `erp.read` |
| `get_sponsoring_history` | GET | `/api/v1/entities/sponsoring/{id}/history` | `erp.read` |
| `get_sponsoring_related` | GET | `/api/v1/entities/sponsoring/{id}/related` | `erp.read` |
| `get_sponsoring_workflow` | GET | `/api/v1/entities/sponsoring/{id}/workflow` | `erp.read` |
| `get_stock_snapshot` | GET | `/api/v1/entities/stock_snapshot/{id}` | `erp.read` |
| `get_stock_snapshot_available_actions` | GET | `/api/v1/entities/stock_snapshot/{id}/available-actions` | `erp.read` |
| `get_stock_snapshot_history` | GET | `/api/v1/entities/stock_snapshot/{id}/history` | `erp.read` |
| `get_stock_snapshot_related` | GET | `/api/v1/entities/stock_snapshot/{id}/related` | `erp.read` |
| `get_stock_snapshot_workflow` | GET | `/api/v1/entities/stock_snapshot/{id}/workflow` | `erp.read` |
| `get_supplier` | GET | `/api/v1/entities/supplier/{id}` | `erp.read` |
| `get_supplier_available_actions` | GET | `/api/v1/entities/supplier/{id}/available-actions` | `erp.read` |
| `get_supplier_history` | GET | `/api/v1/entities/supplier/{id}/history` | `erp.read` |
| `get_supplier_related` | GET | `/api/v1/entities/supplier/{id}/related` | `erp.read` |
| `get_supplier_workflow` | GET | `/api/v1/entities/supplier/{id}/workflow` | `erp.read` |
| `get_task` | GET | `/api/v1/entities/task/{id}` | `erp.read` |
| `get_task_available_actions` | GET | `/api/v1/entities/task/{id}/available-actions` | `erp.read` |
| `get_task_history` | GET | `/api/v1/entities/task/{id}/history` | `erp.read` |
| `get_task_related` | GET | `/api/v1/entities/task/{id}/related` | `erp.read` |
| `get_task_workflow` | GET | `/api/v1/entities/task/{id}/workflow` | `erp.read` |
| `get_user` | GET | `/api/v1/entities/user/{id}` | `erp.read` |
| `get_user_available_actions` | GET | `/api/v1/entities/user/{id}/available-actions` | `erp.read` |
| `get_user_history` | GET | `/api/v1/entities/user/{id}/history` | `erp.read` |
| `get_user_related` | GET | `/api/v1/entities/user/{id}/related` | `erp.read` |
| `get_user_workflow` | GET | `/api/v1/entities/user/{id}/workflow` | `erp.read` |
| `list_admin_request` | GET | `/api/v1/entities/admin_request` | `erp.read` |
| `list_admin_request_comments` | GET | `/api/v1/entities/admin_request/{id}/comments` | `erp.read` |
| `list_admin_request_documents` | GET | `/api/v1/entities/admin_request/{id}/documents` | `erp.documents.read` |
| `list_audit_log` | GET | `/api/v1/entities/audit_log` | `erp.read` |
| `list_audit_log_comments` | GET | `/api/v1/entities/audit_log/{id}/comments` | `erp.read` |
| `list_audit_log_documents` | GET | `/api/v1/entities/audit_log/{id}/documents` | `erp.documents.read` |
| `list_company` | GET | `/api/v1/entities/company` | `erp.read` |
| `list_company_comments` | GET | `/api/v1/entities/company/{id}/comments` | `erp.read` |
| `list_company_documents` | GET | `/api/v1/entities/company/{id}/documents` | `erp.documents.read` |
| `list_congress_international` | GET | `/api/v1/entities/congress_international` | `erp.read` |
| `list_congress_international_comments` | GET | `/api/v1/entities/congress_international/{id}/comments` | `erp.read` |
| `list_congress_international_documents` | GET | `/api/v1/entities/congress_international/{id}/documents` | `erp.documents.read` |
| `list_congress_national` | GET | `/api/v1/entities/congress_national` | `erp.read` |
| `list_congress_national_comments` | GET | `/api/v1/entities/congress_national/{id}/comments` | `erp.read` |
| `list_congress_national_documents` | GET | `/api/v1/entities/congress_national/{id}/documents` | `erp.documents.read` |
| `list_department` | GET | `/api/v1/entities/department` | `erp.read` |
| `list_department_budget` | GET | `/api/v1/entities/department_budget` | `erp.read` |
| `list_department_budget_comments` | GET | `/api/v1/entities/department_budget/{id}/comments` | `erp.read` |
| `list_department_budget_documents` | GET | `/api/v1/entities/department_budget/{id}/documents` | `erp.documents.read` |
| `list_department_comments` | GET | `/api/v1/entities/department/{id}/comments` | `erp.read` |
| `list_department_documents` | GET | `/api/v1/entities/department/{id}/documents` | `erp.documents.read` |
| `list_department_expense` | GET | `/api/v1/entities/department_expense` | `erp.read` |
| `list_department_expense_comments` | GET | `/api/v1/entities/department_expense/{id}/comments` | `erp.read` |
| `list_department_expense_documents` | GET | `/api/v1/entities/department_expense/{id}/documents` | `erp.documents.read` |
| `list_doctor` | GET | `/api/v1/entities/doctor` | `erp.read` |
| `list_doctor_comments` | GET | `/api/v1/entities/doctor/{id}/comments` | `erp.read` |
| `list_doctor_documents` | GET | `/api/v1/entities/doctor/{id}/documents` | `erp.documents.read` |
| `list_document` | GET | `/api/v1/entities/document` | `erp.read` |
| `list_document_comments` | GET | `/api/v1/entities/document/{id}/comments` | `erp.read` |
| `list_document_documents` | GET | `/api/v1/entities/document/{id}/documents` | `erp.documents.read` |
| `list_dossier` | GET | `/api/v1/entities/dossier` | `erp.read` |
| `list_dossier_comments` | GET | `/api/v1/entities/dossier/{id}/comments` | `erp.read` |
| `list_dossier_documents` | GET | `/api/v1/entities/dossier/{id}/documents` | `erp.documents.read` |
| `list_employee` | GET | `/api/v1/entities/employee` | `erp.read` |
| `list_employee_comments` | GET | `/api/v1/entities/employee/{id}/comments` | `erp.read` |
| `list_employee_documents` | GET | `/api/v1/entities/employee/{id}/documents` | `erp.documents.read` |
| `list_entities` | GET | `/api/v1/meta/entities` | `erp.read` |
| `list_event` | GET | `/api/v1/entities/event` | `erp.read` |
| `list_event_comments` | GET | `/api/v1/entities/event/{id}/comments` | `erp.read` |
| `list_event_documents` | GET | `/api/v1/entities/event/{id}/documents` | `erp.documents.read` |
| `list_expense_order` | GET | `/api/v1/entities/expense_order` | `erp.read` |
| `list_expense_order_comments` | GET | `/api/v1/entities/expense_order/{id}/comments` | `erp.read` |
| `list_expense_order_documents` | GET | `/api/v1/entities/expense_order/{id}/documents` | `erp.documents.read` |
| `list_leave_request` | GET | `/api/v1/entities/leave_request` | `erp.read` |
| `list_leave_request_comments` | GET | `/api/v1/entities/leave_request/{id}/comments` | `erp.read` |
| `list_leave_request_documents` | GET | `/api/v1/entities/leave_request/{id}/documents` | `erp.documents.read` |
| `list_medical_info_declaration` | GET | `/api/v1/entities/medical_info_declaration` | `erp.read` |
| `list_medical_info_declaration_comments` | GET | `/api/v1/entities/medical_info_declaration/{id}/comments` | `erp.read` |
| `list_medical_info_declaration_documents` | GET | `/api/v1/entities/medical_info_declaration/{id}/documents` | `erp.documents.read` |
| `list_medical_visit` | GET | `/api/v1/entities/medical_visit` | `erp.read` |
| `list_medical_visit_comments` | GET | `/api/v1/entities/medical_visit/{id}/comments` | `erp.read` |
| `list_medical_visit_documents` | GET | `/api/v1/entities/medical_visit/{id}/documents` | `erp.documents.read` |
| `list_modules` | GET | `/api/v1/meta/modules` | `erp.read` |
| `list_notification` | GET | `/api/v1/entities/notification` | `erp.read` |
| `list_notification_comments` | GET | `/api/v1/entities/notification/{id}/comments` | `erp.read` |
| `list_notification_documents` | GET | `/api/v1/entities/notification/{id}/documents` | `erp.documents.read` |
| `list_pch_tender` | GET | `/api/v1/entities/pch_tender` | `erp.read` |
| `list_pch_tender_comments` | GET | `/api/v1/entities/pch_tender/{id}/comments` | `erp.read` |
| `list_pch_tender_documents` | GET | `/api/v1/entities/pch_tender/{id}/documents` | `erp.documents.read` |
| `list_regulatory_dossier` | GET | `/api/v1/entities/regulatory_dossier` | `erp.read` |
| `list_regulatory_dossier_comments` | GET | `/api/v1/entities/regulatory_dossier/{id}/comments` | `erp.read` |
| `list_regulatory_dossier_documents` | GET | `/api/v1/entities/regulatory_dossier/{id}/documents` | `erp.documents.read` |
| `list_sale` | GET | `/api/v1/entities/sale` | `erp.read` |
| `list_sale_comments` | GET | `/api/v1/entities/sale/{id}/comments` | `erp.read` |
| `list_sale_documents` | GET | `/api/v1/entities/sale/{id}/documents` | `erp.documents.read` |
| `list_sponsoring` | GET | `/api/v1/entities/sponsoring` | `erp.read` |
| `list_sponsoring_comments` | GET | `/api/v1/entities/sponsoring/{id}/comments` | `erp.read` |
| `list_sponsoring_documents` | GET | `/api/v1/entities/sponsoring/{id}/documents` | `erp.documents.read` |
| `list_stock_snapshot` | GET | `/api/v1/entities/stock_snapshot` | `erp.read` |
| `list_stock_snapshot_comments` | GET | `/api/v1/entities/stock_snapshot/{id}/comments` | `erp.read` |
| `list_stock_snapshot_documents` | GET | `/api/v1/entities/stock_snapshot/{id}/documents` | `erp.documents.read` |
| `list_supplier` | GET | `/api/v1/entities/supplier` | `erp.read` |
| `list_supplier_comments` | GET | `/api/v1/entities/supplier/{id}/comments` | `erp.read` |
| `list_supplier_documents` | GET | `/api/v1/entities/supplier/{id}/documents` | `erp.documents.read` |
| `list_task` | GET | `/api/v1/entities/task` | `erp.read` |
| `list_task_comments` | GET | `/api/v1/entities/task/{id}/comments` | `erp.read` |
| `list_task_documents` | GET | `/api/v1/entities/task/{id}/documents` | `erp.documents.read` |
| `list_user` | GET | `/api/v1/entities/user` | `erp.read` |
| `list_user_comments` | GET | `/api/v1/entities/user/{id}/comments` | `erp.read` |
| `list_user_documents` | GET | `/api/v1/entities/user/{id}/documents` | `erp.documents.read` |
| `search_erp` | GET | `/api/v1/search` | `erp.search` |

## 3. Objets couverts

Chaque objet expose : liste + filtres, fiche, historique, commentaires, pièces jointes,
objets liés, circuit et actions disponibles — soit **8 opérations** par objet.

| Objet d'API | Modèle | Module | Portée par ligne |
|---|---|---|:-:|
| `regulatory_dossier` | `RegulatoryProduct` | REGULATORY | ✔ |
| `supplier` | `Supplier` | REGULATORY | — |
| `company` | `Company` | DASHBOARD | — |
| `department` | `Department` | RH | — |
| `employee` | `Employee` | RH | — |
| `leave_request` | `LeaveRequest` | RH | — |
| `admin_request` | `AdministrativeRequest` | ADMIN_REQUESTS | ✔ |
| `sponsoring` | `SponsoringRequest` | SPONSORING | — |
| `congress_international` | `CongressInternational` | CONGRESS_INTERNATIONAL | — |
| `congress_national` | `CongressNational` | CONGRESS_NATIONAL | — |
| `event` | `Event` | EVENTS | — |
| `expense_order` | `ExpenseOrder` | FINANCES | — |
| `department_budget` | `DepartmentBudget` | BUDGETS | — |
| `department_expense` | `DepartmentBudgetExpense` | BUDGETS | — |
| `stock_snapshot` | `StockSnapshot` | STOCKS | — |
| `pch_tender` | `PchTender` | PCH | — |
| `doctor` | `MedicalDoctor` | MEDICAL | ✔ |
| `medical_visit` | `MedicalVisit` | MEDICAL | ✔ |
| `medical_info_declaration` | `MedicalInfoDeclaration` | MEDICAL_INFO | ✔ |
| `sale` | `Sale` | SALES | ✔ |
| `dossier` | `Dossier` | DOSSIERS | — |
| `task` | `Task` | WORKSPACE | — |
| `document` | `Document` | DOCUMENTS | — |
| `user` | `User` | ADMIN | — |
| `audit_log` | `AuditLog` | ADMIN | — |
| `notification` | `Notification` | NOTIFICATIONS | — |

## 4. GAPS — ce qui n'est PAS encore accessible par API

### 4.1 Écriture métier

Les **494 actions serveur** de l'ERP ne sont pas encore exposées. La couche
d'authentification, de portées, d'idempotence et de journalisation qui les recevra est en
place et testée ; il reste à **déclarer** chaque action dans un registre d'opérations qui
appellera la fonction existante — jamais une copie. Les actions les plus attendues :

| Action serveur | Fichier | Effet |
|---|---|---|
| `saveAccessMatrix` | `access-actions.ts` | Save the full per-user access matrix in one shot. |
| `saveModuleAccess` | `access-actions.ts` | Vue « par module » (façon Google Drive) : enregistre, pour UN module, les accès de plusieurs comptes d'un coup. |
| `setRowGrants` | `access-actions.ts` | Replace the set of granted rows for a user on one entity type. |
| `adminResetPassword` | `access-actions.ts` | — |
| `updateUserProfile` | `access-actions.ts` | — |
| `setUserActive` | `access-actions.ts` | — |
| `revokeSession` | `access-actions.ts` | — |
| `requestOnboarding` | `access-actions.ts` | Super Admin : (re)déclenche l'onboarding guidé d'un compte. |
| `revokeAllSessions` | `access-actions.ts` | — |
| `addAdProItem` | `ad-pro-item-actions.ts` | — |
| `updateAdProItem` | `ad-pro-item-actions.ts` | — |
| `deleteAdProItem` | `ad-pro-item-actions.ts` | — |
| `emitItemExpenseOrder` | `ad-pro-item-actions.ts` | Émet l'ordre de dépense d'UN poste. |
| `linkPromoMaterial` | `ad-pro-item-actions.ts` | Rattache un matériel promotionnel EXISTANT à un poste. |
| `submitAdProItem` | `ad-pro-item-actions.ts` | SOUMET un poste à la Direction. |
| `decideAdProItem` | `ad-pro-item-actions.ts` | DÉCISION de la Direction sur UN poste : accorder, refuser, ou demander à revoir le budget. |
| `setAdProItemBudget` | `ad-pro-item-actions.ts` | Choix du BUDGET qui portera un poste accordé (catégorie d'enveloppe) — « comme d'habitude ». |
| `requestAdProItemQuote` | `ad-pro-item-actions.ts` | Ouvre une DEMANDE ADMINISTRATIVE (Bureau du secrétariat) pour obtenir le devis d'un poste. |
| `requestAdProItemOrder` | `ad-pro-item-actions.ts` | DEMANDE d'émission du bon de commande d'un poste accordé (première marche du circuit). |
| `approveAdProItemOrder` | `ad-pro-item-actions.ts` | VISA de la Direction sur la demande d'émission — puis les Finances émettent. |
| `transferAdProRequest` | `ad-pro-transfer-actions.ts` | — |
| `createUser` | `admin-actions.ts` | — |
| `toggleUserActive` | `admin-actions.ts` | — |
| `updateUserRole` | `admin-actions.ts` | — |
| `setSecondaryRole` | `admin-actions.ts` | Règle l'« autre rôle » (fonction secondaire) d'un utilisateur — ex. |
| `superAdminDelete` | `admin-delete-actions.ts` | Suppression « définitive » d'un enregistrement par le Super Admin (et lui seul). |
| `restoreDeletedRecord` | `admin-delete-actions.ts` | Restaure un élément de la corbeille des suppressions définitives : la ligne principale est recréée à l'identique (mêmes id/référence), ainsi que ses pièces jointes et commentaires. |
| `destroyDeletedRecord` | `admin-delete-actions.ts` | Destruction RÉELLE d'une entrée de la corbeille : efface aussi les fichiers stockés. |
| `createRequest` | `admin-request-actions.ts` | — |
| `updateRequestStatus` | `admin-request-actions.ts` | — |
| `assignRequest` | `admin-request-actions.ts` | — |
| `requestApproval` | `admin-request-actions.ts` | — |
| `decideApproval` | `admin-request-actions.ts` | — |
| `createMission` | `admin-request-actions.ts` | — |
| `toggleMissionStop` | `admin-request-actions.ts` | Coche / décoche un point de passage d'une course (chauffeur assigné ou gestionnaire). |
| `updateMission` | `admin-request-actions.ts` | — |
| `addRequestComment` | `admin-request-actions.ts` | — |
| `createRequestBatch` | `admin-request-actions.ts` | Crée plusieurs demandes en un seul envoi (cellules). |
| `editOwnRequest` | `admin-request-actions.ts` | Le demandeur modifie sa propre demande dans les 30 minutes (avant traitement). |
| `deleteOwnRequest` | `admin-request-actions.ts` | Le demandeur supprime sa propre demande dans les 30 minutes (soft delete tracé). |

### 4.2 Objets non encore déclarés

169 modèles ne sont pas exposés. La plupart sont des tables techniques
(sessions, caches, vecteurs, pièces de téléversement) qui n'ont pas de sens pour un agent ;
les objets métier restants s'ajoutent au registre une ligne à la fois.

### 4.3 Non couvert par choix

| Sujet | Raison |
|---|---|
| Webhooks (émission) | Les tables sont en place ; l'émetteur et les signatures restent à brancher. |
| Téléversement de pièces | Nécessite `erp.documents.write` et un contrôle antivirus : lot suivant. |
| Circuits Ad & Pro / congés détaillés | Rendus en mode générique (statut + actions) tant que leurs étapes ne sont pas modélisées. |
| Administration (comptes, droits) | Volontairement hors de portée par défaut : exige `erp.admin`. |
