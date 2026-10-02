# Scan déterministe du code (zéro modèle)

- Routes d'API : 99 — sans authentification visible : **19** ; lisant un identifiant sans garde par enregistrement : **17**
- Fiches [id] chargées par identifiant sans garde par enregistrement visible : **2**
- findMany sans borne (pages + chargeurs) : **441** dans 152 fichiers
- Erreurs avalées dans les actions : **93** dans 39 fichiers
- Messages de refus distincts : 1152 — en anglais : **3** ; génériques/courts : **96**
- Texte d'interface en anglais : **1** ; codes bruts affichés (candidats) : **113**
- Segments sans error.tsx : **66** / sans loading.tsx : **66** ; racine : {'src/app/(app)/error.tsx': True, 'src/app/error.tsx': False, 'src/app/global-error.tsx': False, 'src/app/not-found.tsx': True, 'src/app/(app)/not-found.tsx': True, 'src/app/(app)/loading.tsx': False}
- README : 291 chemins cités, **4 absents** ; 136 routes citées, **4 sans page**
- Menu : 87 adresses, **0 sans page** ; router.refresh() à nu : 349

## api_sans_auth (19)
- src/app/api/v1/search/route.ts
- src/app/api/v1/openapi.json/route.ts
- src/app/api/v1/meta/modules/route.ts
- src/app/api/v1/meta/operations/route.ts
- src/app/api/v1/meta/entities/route.ts
- src/app/api/v1/meta/entities/[entity]/route.ts
- src/app/api/v1/operations/[operation]/route.ts
- src/app/api/v1/entities/[entity]/route.ts
- src/app/api/v1/entities/[entity]/[id]/route.ts
- src/app/api/v1/entities/[entity]/[id]/[aspect]/route.ts
- src/app/api/v1/documents/[id]/content/route.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/app/api/onlyoffice/file/route.ts
- src/app/api/site-web/v1/candidatures/route.ts
- src/app/api/site-web/v1/contenus/route.ts
- src/app/api/google/pubsub/route.ts
- src/app/api/events/qr/[token]/route.ts
- src/app/api/events/inbound/[source]/route.ts
- src/app/api/push/key/route.ts

## api_id_sans_garde_ligne (17)
- src/app/api/marque/[companyId]/logo/route.ts
- src/app/api/regulatory/intelligence/generated/[docId]/route.ts
- src/app/api/regulatory/intelligence/document/[documentId]/route.ts
- src/app/api/regulatory/intelligence/progress/[versionId]/route.ts
- src/app/api/regulatory/intelligence/upload/direct/[sessionId]/finalize/route.ts
- src/app/api/regulatory/intelligence/upload/session/[sessionId]/route.ts
- src/app/api/regulatory/intelligence/upload/session/[sessionId]/part/route.ts
- src/app/api/regulatory/intelligence/upload/session/[sessionId]/finalize/route.ts
- src/app/api/regulatory/intelligence/version/[versionId]/original/route.ts
- src/app/api/onlyoffice/callback/route.ts
- src/app/api/legal/[id]/fichier/route.ts
- src/app/api/mail/ms/data/route.ts
- src/app/api/mail/attachment/route.ts
- src/app/api/mail/message/route.ts
- src/app/api/messaging/attachment/[id]/route.ts
- src/app/api/artifact/[id]/page/[n]/route.ts
- src/app/api/artifact/[id]/image/[imageId]/route.ts

## fiches_findUnique_sans_garde (2)
- {"page": "src/app/(app)/drive/espace/[id]/page.tsx", "line": 48, "autreChargeur": false}
- {"page": "src/app/(app)/validations/[id]/page.tsx", "line": 31, "autreChargeur": false}

## findMany_sans_take (152)
- {"fichier": "src/lib/queries/promo-stock.ts", "n": 14, "lignes": [43, 51, 86]}
- {"fichier": "src/app/(app)/planning/business-units/page.tsx", "n": 12, "lignes": [33, 44, 46]}
- {"fichier": "src/lib/queries/ad-pro-items.ts", "n": 12, "lignes": [56, 59, 65]}
- {"fichier": "src/lib/queries/ad-pro-centre.ts", "n": 12, "lignes": [121, 125, 129]}
- {"fichier": "src/lib/queries/process-intelligence.ts", "n": 10, "lignes": [54, 68, 72]}
- {"fichier": "src/lib/queries/annuaires.ts", "n": 10, "lignes": [52, 91, 147]}
- {"fichier": "src/lib/queries/tour-schedule.ts", "n": 9, "lignes": [125, 130, 138]}
- {"fichier": "src/lib/queries/missions.ts", "n": 9, "lignes": [49, 54, 59]}
- {"fichier": "src/app/(app)/demandes/[id]/page.tsx", "n": 8, "lignes": [60, 81, 82]}
- {"fichier": "src/lib/queries/stock-portee.ts", "n": 7, "lignes": [32, 34, 50]}
- {"fichier": "src/lib/queries/hr.ts", "n": 7, "lignes": [109, 115, 126]}
- {"fichier": "src/app/(app)/promo-material/[id]/page.tsx", "n": 6, "lignes": [117, 126, 166]}
- {"fichier": "src/lib/queries/medical.ts", "n": 6, "lignes": [152, 175, 180]}
- {"fichier": "src/lib/queries/messaging.ts", "n": 6, "lignes": [377, 382, 435]}
- {"fichier": "src/lib/queries/ad-pro.ts", "n": 6, "lignes": [96, 206, 212]}
- {"fichier": "src/lib/queries/drive.ts", "n": 6, "lignes": [43, 144, 157]}
- {"fichier": "src/lib/queries/department-budget.ts", "n": 6, "lignes": [36, 49, 54]}
- {"fichier": "src/lib/queries/budget.ts", "n": 6, "lignes": [183, 197, 260]}
- {"fichier": "src/app/(app)/admin/users/[id]/page.tsx", "n": 5, "lignes": [47, 48, 55]}
- {"fichier": "src/app/(app)/planning/affectations/page.tsx", "n": 5, "lignes": [28, 29, 33]}
- {"fichier": "src/app/(app)/regulatory/[id]/page.tsx", "n": 5, "lignes": [94, 99, 105]}
- {"fichier": "src/app/(app)/pch/[id]/page.tsx", "n": 5, "lignes": [50, 55, 85]}
- {"fichier": "src/lib/queries/sfe-cockpit.ts", "n": 5, "lignes": [86, 99, 100]}
- {"fichier": "src/lib/queries/congress.ts", "n": 5, "lignes": [28, 36, 37]}
- {"fichier": "src/lib/queries/validations.ts", "n": 5, "lignes": [95, 165, 291]}

## erreurs_avalees_actions (39)
- {"fichier": "src/lib/actions/ad-pro-item-actions.ts", "n": 15}
- {"fichier": "src/lib/actions/payroll-hr-actions.ts", "n": 7}
- {"fichier": "src/lib/actions/task-actions.ts", "n": 5}
- {"fichier": "src/lib/actions/care-actions.ts", "n": 4}
- {"fichier": "src/lib/actions/expense-actions.ts", "n": 4}
- {"fichier": "src/lib/actions/ad-pro-centre-actions.ts", "n": 4}
- {"fichier": "src/lib/actions/meeting-actions.ts", "n": 4}
- {"fichier": "src/lib/actions/finance-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/hr-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/feedback-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/ad-pro-transfer-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/petty-cash-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/mission-actions.ts", "n": 3}
- {"fichier": "src/lib/actions/promo-devis-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/sponsoring-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/promo-material-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/admin-delete-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/promo-execution-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/training-actions.ts", "n": 2}
- {"fichier": "src/lib/actions/assistant-actions.ts", "n": 1}
- {"fichier": "src/lib/actions/reminder-actions.ts", "n": 1}
- {"fichier": "src/lib/actions/medical-info-actions.ts", "n": 1}
- {"fichier": "src/lib/actions/department-budget-actions.ts", "n": 1}
- {"fichier": "src/lib/actions/bc-signature-actions.ts", "n": 1}
- {"fichier": "src/lib/actions/letterhead-actions.ts", "n": 1}

## refus_anglais (3)
- {"msg": "Scan « ${scan.name} » : ${r.error ??", "n": 1, "ou": "src/lib/actions/promo-devis-actions.ts:291"}
- {"msg": "Envoi impossible : ${(e as Error)?.message ??", "n": 1, "ou": "src/lib/actions/mail-actions.ts:86"}
- {"msg": "Fichier « ${file.name} » : ${piece.error ??", "n": 1, "ou": "src/lib/actions/promo-execution-actions.ts:466"}

## refus_generiques (96)
- {"msg": "Non autorisé.", "n": 267, "ou": "src/lib/actions/market-presentation-actions.ts:22"}
- {"msg": "L", "n": 48, "ou": "src/lib/actions/care-actions.ts:295"}
- {"msg": "Vous n", "n": 15, "ou": "src/lib/actions/mail-piece-actions.ts:59"}
- {"msg": "Réservé à l", "n": 14, "ou": "src/lib/actions/company-actions.ts:48"}
- {"msg": "Ce devis n", "n": 11, "ou": "src/lib/actions/promo-devis-actions.ts:257"}
- {"msg": "Choisissez l", "n": 11, "ou": "src/lib/actions/promo-comptage-actions.ts:368"}
- {"msg": "Appel d", "n": 11, "ou": "src/lib/actions/pch-actions.ts:86"}
- {"msg": "Cette entité n", "n": 10, "ou": "src/lib/actions/company-contact-actions.ts:62"}
- {"msg": "Le nom de l", "n": 9, "ou": "src/lib/actions/company-actions.ts:50"}
- {"msg": "La décision n", "n": 7, "ou": "src/lib/actions/care-actions.ts:229"}
- {"msg": "Introuvable.", "n": 7, "ou": "src/lib/actions/bd-actions.ts:60"}
- {"msg": "La demande n", "n": 5, "ou": "src/lib/actions/promo-devis-actions.ts:109"}
- {"msg": "Ce dossier n", "n": 5, "ou": "src/lib/actions/promo-devis-actions.ts:357"}
- {"msg": "Indiquez l", "n": 5, "ou": "src/lib/actions/validation-actions.ts:117"}
- {"msg": "Date invalide.", "n": 4, "ou": "src/lib/actions/reminder-actions.ts:93"}
- {"msg": "Message vide.", "n": 4, "ou": "src/lib/actions/support-actions.ts:102"}
- {"msg": "Le circuit n", "n": 4, "ou": "src/lib/actions/promo-circuit-actions.ts:187"}
- {"msg": "Seul l", "n": 4, "ou": "src/lib/actions/calendar-actions.ts:63"}
- {"msg": "Ce service n", "n": 4, "ou": "src/lib/actions/etablissement-services-actions.ts:140"}
- {"msg": "Type d", "n": 4, "ou": "src/lib/actions/partage-actions.ts:148"}
- {"msg": "Ce plan n", "n": 3, "ou": "src/lib/actions/tour-plan-actions.ts:122"}
- {"msg": "Ce paiement n", "n": 3, "ou": "src/lib/actions/expense-actions.ts:409"}
- {"msg": "Le poste n", "n": 3, "ou": "src/lib/actions/ad-pro-item-actions.ts:512"}
- {"msg": "Cette ligne n", "n": 3, "ou": "src/lib/actions/promo-execution-actions.ts:526"}
- {"msg": "Ce contact n", "n": 2, "ou": "src/lib/actions/company-contact-actions.ts:87"}

## ui_anglais (1)
- src/app/(app)/regulatory/enregistrement/analyse/[dossierId]/lifecycle-panel.tsx:86 → placeholder="Type (CPP, GMP, AMM…)"

## codes_bruts_candidats (113)
- src/app/meet/[token]/page.tsx:31 → >{meeting.title}<
- src/app/meet/[token]/page.tsx:37 → >{meeting.title}<
- src/app/(app)/demandes/requests-table.tsx:109 → >{r.title}<
- src/app/(app)/demandes/driver/page.tsx:40 → >{m.title}<
- src/app/(app)/demandes/driver/page.tsx:99 → >{m.title}<
- src/app/(app)/demandes/[id]/page.tsx:124 → >{req.title}<
- src/app/(app)/demandes/[id]/page.tsx:329 → >{m.title}<
- src/app/(app)/demandes/approvals/page.tsx:36 → >{a.request.title}<
- src/app/(app)/demandes/courses/courses-board.tsx:84 → >{c.title}<
- src/app/(app)/demandes/courses/courses-board.tsx:134 → >{c.title}<
- src/app/(app)/demandes/assistant/page.tsx:54 → >{r.title}<
- src/app/(app)/demandes/corbeille/page.tsx:50 → >{r.title} <
- src/app/(app)/courriers/mail-table.tsx:183 → >{r.title}<
- src/app/(app)/courriers/mail-partners.tsx:95 → >{p.kind}<
- src/app/(app)/courriers/[id]/page.tsx:170 → >{entry.title}<
- src/app/(app)/admin/regulatory-ia/budget-row.tsx:61 → >{row.title}<
- src/app/(app)/admin/ai/page.tsx:307 → >{b.role}<
- src/app/(app)/admin/users/[id]/page.tsx:187 → >{a.type}<
- src/app/(app)/admin/access/payment-centre-seats.tsx:89 → >{u.role}<
- src/app/(app)/admin/access/payment-centre-seats.tsx:105 → >{s.role}<
- src/app/(app)/admin/achats/purchase-journal-table.tsx:90 → >{r.title}<
- src/app/(app)/admin/validations/page.tsx:135 → >{r.title}<
- src/app/(app)/admin/test-center/page.tsx:147 → >{f.title}<
- src/app/(app)/admin/test-center/page.tsx:148 → >{f.category}<
- src/app/(app)/admin/regulatory-corpus/rule-packs-admin.tsx:73 → >{p.status}<

## segments_sans_error (66)
- ad-pro
- admin
- adventum-brain
- annuaires
- assistant
- aujourdhui
- bons-de-commande
- budgets
- business-development
- calendar
- centre-ad-pro
- centre-de-missions
- centre-de-paiement
- centre-de-validations
- chief-of-staff
- comptabilite
- congress-international
- congress-national
- consulting
- courrier
- courriers
- dashboard
- demandes
- directives
- documents

## readme_chemins_absents (4)
- docs/ERP-INTEGRATION.md
- docs/openapi.yaml
- e2e/inbox
- src/lib/missions/events/temporal.ts

## readme_routes_absentes (4)
- /admin/departments
- /carrieres
- /e360
- /storage/v1/s3

## menu_sans_page (0)
