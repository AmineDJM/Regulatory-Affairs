# Graph Report - src  (2026-08-20)

## Corpus Check
- 1291 files · ~1,015,936 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7887 nodes · 31169 edges · 259 communities (251 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8809117e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prisma.ts
- utils.ts
- userCan
- card.tsx
- button.tsx
- lib/labels.ts
- formatDate
- requireUser
- recordAudit
- upload/session.ts
- getCurrentUser
- rbac.ts
- drive-storage.ts
- notifyUser
- brain-cockpit.tsx
- dossier-agent.ts
- admin-request-actions.ts
- batch-runner.ts
- congress-international/[id]/page.tsx
- medical-directory-actions.ts
- jobs/runner.ts
- access-actions.ts
- assistant-actions.ts
- storage.ts
- [dossierId]/page.tsx
- rules/engine.ts
- assistant.ts
- payment-request-actions.ts
- FindingInput
- budget-forms.tsx
- ad-pro-item-actions.ts
- care-actions.ts
- regAudit
- SessionUser
- build-facts.ts
- training-actions.ts
- agent-core.ts
- test-center/runner.ts
- training-board.tsx
- rh/[id]/page.tsx
- pilotage/page.tsx
- mistral-ocr.ts
- config.ts
- formatDateTime
- hasGlobalView
- pch-tender-line-actions.ts
- ocr-engine.ts
- promo-material-actions.ts
- intelligence/actions.ts
- drive/page.tsx
- folder-bar.tsx
- market-research.ts
- letterhead-manager.tsx
- entities.ts
- new-request-picker.tsx
- adoption.ts
- competition.ts
- getAppSettings
- documents/[id]/edit/page.tsx
- regulatory-workflow.ts
- topbar.tsx
- molecule.ts
- teams-manager.tsx
- lib/drive.ts
- platform-audit/engine.ts
- workflow-builder.tsx
- medical-info-actions.ts
- admin-settings-forms.tsx
- (app)/layout.tsx
- lib/department-budget.ts
- dossier-actions.ts
- product-explorer.tsx
- messaging-actions.ts
- stock-board.tsx
- features.ts
- onboarding-wizard.tsx
- workflow/engine.ts
- general-means.ts
- microsoft-mail-actions.ts
- queries/messaging.ts
- lib/ai.ts
- corpus/actions.ts
- upload-manager.tsx
- molecule-panel.tsx
- message-thread.tsx
- petty-cash-actions.ts
- sales-planning-actions.ts
- payment-authority.ts
- drive/upload/route.ts
- field-reports.ts
- update-reminder.ts
- sectionByCode
- ocrDocument
- form-fields.tsx
- document-request-actions.ts
- recruitment/request-flow.ts
- Module
- graph/provider.ts
- document-preview.tsx
- receipt-lines.tsx
- extract-facts.ts
- purchase-request-actions.ts
- lifecycle/actions.ts
- reports.ts
- regulatory-table.tsx
- departments-manager.tsx
- mail.ts
- extract-text.ts
- state-machines/explorer.ts
- messenger.tsx
- progress/query.ts
- migration-cert.ts
- supplier/actions.ts
- enregistrement/page.tsx
- library-ingest.ts
- invariants/registry.ts
- sheet-import.ts
- connection.ts
- meetings.ts
- operations.ts
- DriveTable
- field-report-actions.ts
- unified.ts
- calendar.ts
- expense-row-actions.tsx
- department-budget-actions.ts
- portfolio.ts
- read-figures.ts
- lib/messaging.ts
- api/auth.ts
- ranges-manager.tsx
- market-research-actions.ts
- drive-actions.ts
- meetings/[id]/page.tsx
- regulatory/page.tsx
- reply.ts
- process-intelligence.ts
- entity-access.ts
- http.ts
- mail-client.tsx
- drive/[id]/page.tsx
- workspace.tsx
- tasks/request-flow.ts
- validation-supervision.ts
- client.ts
- ingest-catalog.ts
- auth-actions.ts
- invoice-actions.ts
- evidence.ts
- legal/lifecycle.ts
- rag.ts
- document-mirror.ts
- openapi.ts
- test-center/page.tsx
- today.ts
- support-actions.ts
- company-access.ts
- courriers/[id]/page.tsx
- drive-space-manager.tsx
- corpus-actions.ts
- recruitment-actions.ts
- catalog-normalize.ts
- MicrosoftGraphMailProvider
- scheduled.ts
- ingest.ts
- canViewDrive
- recrutement/[id]/panels.tsx
- office-supply-actions.ts
- meeting-actions.ts
- payroll-hr-actions.ts
- departments.ts
- regulatory/export/route.ts
- rh/upload/route.ts
- corpus/page.tsx
- MailProvider
- dashboard.ts
- compare-versions.ts
- s3-config.ts
- messaging/messages/route.ts
- driver/page.tsx
- demandes/new-request.tsx
- exports.ts
- pch-tender-export.ts
- calendar-view.tsx
- promo-material.ts
- stock-snapshot-actions.ts
- background-upload.tsx
- simple-pdf.ts
- push.ts
- ai/page.tsx
- upload-button.tsx
- radar.ts
- loadInbox
- diagnostic/page.tsx
- ConsultingContractPage
- identity-board.tsx
- hr-dossier.tsx
- pch.ts
- reminder-actions.ts
- legal-actions.ts
- imputation.ts
- medical.ts
- regulatory-drive-mirror.ts
- getMessage
- congress-workflow.tsx
- workflow-panel.tsx
- training-panel.tsx
- validation-item-review.tsx
- payroll-cost.ts
- bd.ts
- catchup.ts
- grouping.ts
- mail-diagnostic/route.ts
- typing/route.ts
- dossiers.ts
- meetings/page.tsx
- supplier-auth.ts
- api/workflow.ts
- auto-category.ts
- withImap
- events.ts
- fetch-source.ts
- Adventum Autonomous Test Center — architecture
- zip-viewer.tsx
- meeting-chat.tsx
- client-bundle-guard.test.ts
- file-glyph.ts
- readers.ts
- courses-board.tsx
- employee-form.tsx
- [token]/route.ts
- RegulatoryIaAdminPage
- tender-logistics.tsx
- messages-indicator.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- orphans-panel.tsx
- roles-table.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- rbac.test.ts
- mail/attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 777 edges
2. `userCan()` - 606 edges
3. `fdStr()` - 578 edges
4. `recordAudit()` - 530 edges
5. `prisma` - 485 edges
6. `requireModule()` - 258 edges
7. `hasGlobalView()` - 213 edges
8. `Button` - 190 edges
9. `cn()` - 181 edges
10. `formatDate()` - 180 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `ProductPicker()` --calls--> `setProductsRange()`  [EXTRACTED]
  src/app/(app)/admin/gammes/ranges-manager.tsx → src/lib/actions/product-range-actions.ts
- `PersonSheet()` --calls--> `setUserRanges()`  [EXTRACTED]
  src/app/(app)/admin/gammes/ranges-manager.tsx → src/lib/actions/product-range-actions.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts

## Import Cycles
- None detected.

## Communities (259 total, 8 thin omitted)

### Community 0 - "prisma.ts"
Cohesion: 0.03
Nodes (158): dynamic, AdProOtherPage(), dynamic, AdProPage(), dynamic, ActivityPage(), fmtDuration(), dynamic (+150 more)

### Community 1 - "utils.ts"
Cohesion: 0.03
Nodes (131): ModuleSpec, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, TYPES, AdminPage() (+123 more)

### Community 2 - "userCan"
Cohesion: 0.03
Nodes (161): POST(), PresentationCard(), PresentationPanel(), Res, EditEventButton(), CheckinConfirm(), RegistrationsManager(), LegalTable() (+153 more)

### Community 3 - "card.tsx"
Cohesion: 0.04
Nodes (105): dynamic, dynamic, metadata, RegulatoryCorpusPage(), dynamic, metadata, STEP_LABELS, dynamic (+97 more)

### Community 4 - "button.tsx"
Cohesion: 0.04
Nodes (82): DriveStorageSettings(), OrgBranch(), Citation, Source, Version, ENV_LABEL, MODES, Option (+74 more)

### Community 5 - "lib/labels.ts"
Cohesion: 0.03
Nodes (95): dynamic, FeedbackStatusSelect(), BDPipeline(), STAGES, BDRow, BDTable(), LegalRow, dynamic (+87 more)

### Community 6 - "formatDate"
Cohesion: 0.03
Nodes (93): AdProOtherDetailPage(), ActivityRow, ActivityTable(), TYPE, dynamic, metadata, dynamic, FocusCard() (+85 more)

### Community 7 - "requireUser"
Cohesion: 0.04
Nodes (106): CorbeillePage(), FieldsManager(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd() (+98 more)

### Community 8 - "recordAudit"
Cohesion: 0.04
Nodes (85): PermanentDeleteButton(), PurgeOrphansButton(), EntitiesManager(), EntityRow, PALETTE, RangeSheet(), ActiveToggle(), ImpersonateButton() (+77 more)

### Community 9 - "upload/session.ts"
Cohesion: 0.04
Nodes (96): dynamic, POST(), dynamic, GET(), runtime, dynamic, runtime, dynamic (+88 more)

### Community 10 - "getCurrentUser"
Cohesion: 0.04
Nodes (83): GET(), esc(), GET(), dynamic, GET(), DELETE(), dynamic, POST() (+75 more)

### Community 11 - "rbac.ts"
Cohesion: 0.04
Nodes (77): GET(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+69 more)

### Community 12 - "drive-storage.ts"
Cohesion: 0.05
Nodes (81): dynamic, GET(), dynamic, GET(), POST(), dynamic, GET(), dynamic (+73 more)

### Community 13 - "notifyUser"
Cohesion: 0.06
Nodes (76): EventForm(), DriveComments(), RequestRow(), runAutopilot(), executeAssistantAction(), createCalendarEvent(), parseKind(), updateCalendarEvent() (+68 more)

### Community 14 - "brain-cockpit.tsx"
Cohesion: 0.05
Nodes (68): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+60 more)

### Community 15 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (71): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, ClaudeContentBlock (+63 more)

### Community 16 - "admin-request-actions.ts"
Cohesion: 0.05
Nodes (74): RuleControls(), RuleEditor(), MissionActions(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), AdProKind, closeSource() (+66 more)

### Community 17 - "batch-runner.ts"
Cohesion: 0.05
Nodes (65): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+57 more)

### Community 18 - "congress-international/[id]/page.tsx"
Cohesion: 0.06
Nodes (61): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), DeclarationDetailPage(), dynamic, MyMissionsPage() (+53 more)

### Community 19 - "medical-directory-actions.ts"
Cohesion: 0.07
Nodes (60): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, importDirectorySheet(), saveDirectoryCell() (+52 more)

### Community 20 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (64): aiConfigured(), splitTextIntoChunksWithOffsets(), buildPrompt(), reviewDocumentText(), corpusForSection(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS (+56 more)

### Community 21 - "access-actions.ts"
Cohesion: 0.05
Nodes (53): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), ModuleAccessGrid(), AccessMatrix(), GrantOption (+45 more)

### Community 22 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (55): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+47 more)

### Community 23 - "storage.ts"
Cohesion: 0.06
Nodes (55): GET(), AttachToSourceButtons(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+47 more)

### Community 24 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (53): DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT, ReserveMap, securityIcon() (+45 more)

### Community 25 - "rules/engine.ts"
Cohesion: 0.07
Nodes (49): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+41 more)

### Community 26 - "assistant.ts"
Cohesion: 0.07
Nodes (56): activeUserId(), describeChange(), parseRegFieldValue(), ParseResult, parseSettingValue(), regFieldSpec, renderSettingValue(), resolveByLabel() (+48 more)

### Community 27 - "payment-request-actions.ts"
Cohesion: 0.09
Nodes (55): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, PaymentRequestPage() (+47 more)

### Community 28 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 29 - "budget-forms.tsx"
Cohesion: 0.07
Nodes (49): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+41 more)

### Community 30 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 31 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 32 - "regAudit"
Cohesion: 0.08
Nodes (43): CaseCard(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, regAudit(), enrichFinding(), Enrichment (+35 more)

### Community 33 - "SessionUser"
Cohesion: 0.07
Nodes (36): DirectiveDetailPage(), SupportDetailPage(), assistantNudge(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+28 more)

### Community 34 - "build-facts.ts"
Cohesion: 0.08
Nodes (38): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+30 more)

### Community 35 - "training-actions.ts"
Cohesion: 0.11
Nodes (45): OtherDecisionPanel(), ConsultingActions(), ContractTask, TrainingBoard(), audit(), closeAdProOtherRequest(), createAdProOtherRequest(), decideAdProOtherRequest() (+37 more)

### Community 36 - "agent-core.ts"
Cohesion: 0.08
Nodes (32): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc, AgentFinding (+24 more)

### Community 37 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (38): LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), Certification, CertificationInput (+30 more)

### Community 38 - "training-board.tsx"
Cohesion: 0.08
Nodes (40): TrainingParticipantRow, TrainingRow, PendingLeave, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage (+32 more)

### Community 39 - "rh/[id]/page.tsx"
Cohesion: 0.07
Nodes (36): dynamic, MonDossierPage(), AdvanceItem, MyAdvances(), MonEspacePage(), CompanyAccessCard(), CompanyAccessRow, d10() (+28 more)

### Community 40 - "pilotage/page.tsx"
Cohesion: 0.09
Nodes (41): AffectationsPage(), Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft(), dynamic (+33 more)

### Community 41 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 42 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 43 - "formatDateTime"
Cohesion: 0.07
Nodes (34): AccessUser, UserModuleState, AccessByModulePage(), dynamic, AuditPanel(), AuditRow, AuditTable(), dynamic (+26 more)

### Community 44 - "hasGlobalView"
Cohesion: 0.12
Nodes (41): deleteCalendarEvent(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision() (+33 more)

### Community 45 - "pch-tender-line-actions.ts"
Cohesion: 0.11
Nodes (41): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+33 more)

### Community 46 - "ocr-engine.ts"
Cohesion: 0.09
Nodes (39): dossierCost, c(), anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash() (+31 more)

### Community 47 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (35): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+27 more)

### Community 48 - "intelligence/actions.ts"
Cohesion: 0.08
Nodes (36): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+28 more)

### Community 49 - "drive/page.tsx"
Cohesion: 0.11
Nodes (34): DriveCanvas(), ITEMS, NewKind, DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage(), dynamic (+26 more)

### Community 50 - "folder-bar.tsx"
Cohesion: 0.10
Nodes (32): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), FolderRow, LegalFolderBar(), allFolders(), companyAllowed() (+24 more)

### Community 51 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 52 - "letterhead-manager.tsx"
Cohesion: 0.11
Nodes (32): TYPES, EditSheet(), KINDS, LetterheadManager(), UploadSheet(), LetterheadChoice(), deleteLetterhead(), updateLetterhead() (+24 more)

### Community 53 - "entities.ts"
Cohesion: 0.12
Nodes (29): GET, ASPECTS, GET, GET, GET, RESERVED, GET, GET (+21 more)

### Community 54 - "new-request-picker.tsx"
Cohesion: 0.08
Nodes (29): NewRequestPicker(), NewRequestPickerProps, CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES (+21 more)

### Community 55 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 56 - "competition.ts"
Cohesion: 0.09
Nodes (36): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+28 more)

### Community 57 - "getAppSettings"
Cohesion: 0.11
Nodes (30): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, POST() (+22 more)

### Community 58 - "documents/[id]/edit/page.tsx"
Cohesion: 0.12
Nodes (29): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+21 more)

### Community 59 - "regulatory-workflow.ts"
Cohesion: 0.11
Nodes (34): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), completeStepsThrough(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP (+26 more)

### Community 60 - "topbar.tsx"
Cohesion: 0.12
Nodes (28): Company, CompanySwitcher(), isActive(), MobileTabBar(), PRIMARY, Tile(), badgeFor(), navPaths() (+20 more)

### Community 61 - "molecule.ts"
Cohesion: 0.13
Nodes (32): canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES, GALENIC_FORMS, moleculeMatches(), moleculeStem() (+24 more)

### Community 62 - "teams-manager.tsx"
Cohesion: 0.10
Nodes (29): dynamic, POST(), runtime, MailTester(), Cap, Kam, KamRow(), numOrNull() (+21 more)

### Community 63 - "lib/drive.ts"
Cohesion: 0.10
Nodes (30): DriveFilePage(), humanSize(), DriveExplorerSheet(), DrivePickerField(), DrivePickerValue, fmtSize(), browseDrive(), BrowseNode (+22 more)

### Community 64 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 65 - "workflow-builder.tsx"
Cohesion: 0.11
Nodes (29): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+21 more)

### Community 66 - "medical-info-actions.ts"
Cohesion: 0.13
Nodes (29): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+21 more)

### Community 67 - "admin-settings-forms.tsx"
Cohesion: 0.11
Nodes (31): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+23 more)

### Community 68 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (26): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+18 more)

### Community 69 - "lib/department-budget.ts"
Cohesion: 0.12
Nodes (28): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), MoyensGenerauxPage() (+20 more)

### Community 70 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (29): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+21 more)

### Community 71 - "product-explorer.tsx"
Cohesion: 0.12
Nodes (29): dynamic, metadata, ProductExplorerPage(), fmtDzd(), fmtPct(), fmtPrice(), fmtUsd(), pctTone() (+21 more)

### Community 72 - "messaging-actions.ts"
Cohesion: 0.15
Nodes (32): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+24 more)

### Community 73 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 74 - "features.ts"
Cohesion: 0.11
Nodes (26): VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic, dynamic, RootPage() (+18 more)

### Community 75 - "onboarding-wizard.tsx"
Cohesion: 0.13
Nodes (22): OfficeLauncher(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep() (+14 more)

### Community 76 - "workflow/engine.ts"
Cohesion: 0.12
Nodes (32): isManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep(), countAdProItems() (+24 more)

### Community 77 - "general-means.ts"
Cohesion: 0.14
Nodes (29): DepartmentBudgetsPage(), dynamic, myCompanyScope(), BudgetSetter, canDecideDepartmentBudgetRequest(), canManageDepartmentBudgetAccess(), canViewDepartmentBudget(), DeptBudgetKind (+21 more)

### Community 78 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 79 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+19 more)

### Community 80 - "lib/ai.ts"
Cohesion: 0.09
Nodes (22): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AnthropicBlock, apiErrorMessage(), AskOptions, callClaude() (+14 more)

### Community 81 - "corpus/actions.ts"
Cohesion: 0.13
Nodes (22): CorpusAdmin(), ACCEPT, AUTHORITIES, CorpusImport(), Row, canManage(), createCorpusSourceVersion(), importCorpusFileAction() (+14 more)

### Community 82 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 83 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (23): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+15 more)

### Community 84 - "message-thread.tsx"
Cohesion: 0.14
Nodes (23): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+15 more)

### Community 85 - "petty-cash-actions.ts"
Cohesion: 0.17
Nodes (23): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), runPettyCashRechargeReminders() (+15 more)

### Community 86 - "sales-planning-actions.ts"
Cohesion: 0.12
Nodes (26): BU, CatalogueManager(), CHANNELS, Opt, Prod, TeamsManager(), carryForwardAssignments(), createBusinessUnit() (+18 more)

### Community 87 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 88 - "drive/upload/route.ts"
Cohesion: 0.15
Nodes (17): mimeOf(), POST(), POST(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict, TtlCache (+9 more)

### Community 89 - "field-reports.ts"
Cohesion: 0.12
Nodes (23): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), dynamic (+15 more)

### Community 90 - "update-reminder.ts"
Cohesion: 0.16
Nodes (23): RegulatoryPage(), daysAgo(), LastReminder(), ReminderPerson, sendRegulatoryUpdateReminder(), productRangeScope(), regulatoryReminderBoard(), canSendUpdateReminder() (+15 more)

### Community 91 - "sectionByCode"
Cohesion: 0.12
Nodes (23): CorpusExtract, queryFor(), SECTION_HINTS, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+15 more)

### Community 92 - "ocrDocument"
Cohesion: 0.10
Nodes (18): extOf(), codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), canOcr(), ocrDocument() (+10 more)

### Community 93 - "form-fields.tsx"
Cohesion: 0.12
Nodes (20): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, NewProductButton(), UserOption, SupplierRow (+12 more)

### Community 94 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 95 - "recruitment/request-flow.ts"
Cohesion: 0.13
Nodes (23): NewRecruitmentButton(), ApprovalState, canDecideStep(), CANDIDATE_LABEL, CANDIDATE_ORDER, CANDIDATE_TONE, CandidateStatus, ChainDecider (+15 more)

### Community 96 - "Module"
Cohesion: 0.15
Nodes (24): LeaveItem, StandInState, Target, actsFor(), day(), delegatedActions(), Delegation, delegationNotice() (+16 more)

### Community 97 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 98 - "document-preview.tsx"
Cohesion: 0.14
Nodes (17): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+9 more)

### Community 99 - "receipt-lines.tsx"
Cohesion: 0.19
Nodes (22): empty(), ExistingLine, ReceiptLines(), Row, spendFromPettyCash(), readReceipt(), ReceiptDraft, saveReceiptLines() (+14 more)

### Community 100 - "extract-facts.ts"
Cohesion: 0.14
Nodes (24): AssignmentMatrix(), key(), nOr0(), bestStrengthCombo(), comboLinkOk(), CTX, DocFactHit, DOSAGE_FORMS (+16 more)

### Community 101 - "purchase-request-actions.ts"
Cohesion: 0.23
Nodes (19): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), createPurchaseRequest(), nextRef() (+11 more)

### Community 102 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 103 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 104 - "regulatory-table.tsx"
Cohesion: 0.13
Nodes (19): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryTable(), STAGE_CLASS (+11 more)

### Community 105 - "departments-manager.tsx"
Cohesion: 0.16
Nodes (23): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+15 more)

### Community 106 - "mail.ts"
Cohesion: 0.08
Nodes (25): acquireSlot(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool, imapWaiters (+17 more)

### Community 107 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 108 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 109 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+14 more)

### Community 110 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 111 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 112 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 113 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 114 - "library-ingest.ts"
Cohesion: 0.16
Nodes (20): LunaCallInput, rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve (+12 more)

### Community 115 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (14): PERMISSIONS, InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+6 more)

### Community 116 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 117 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 118 - "meetings.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), startCall(), appBaseUrlForMeet(), canViewMeeting() (+9 more)

### Community 119 - "operations.ts"
Cohesion: 0.15
Nodes (18): POST, KIND_LABEL, OrphanRow(), ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), getOperation(), OPERATIONS (+10 more)

### Community 120 - "DriveTable"
Cohesion: 0.16
Nodes (18): DriveTable(), canPasteInto(), Clipboard, CLIPBOARD_KEY, clipboardLabel(), ClipMode, clipShortcut(), parseClipboard() (+10 more)

### Community 121 - "field-report-actions.ts"
Cohesion: 0.22
Nodes (19): DoctorPicker(), ReportEditor(), Attachments(), SimpleReportEditor(), formatBytes(), analyzeFieldReportAction(), canEdit(), deleteFieldReport() (+11 more)

### Community 122 - "unified.ts"
Cohesion: 0.19
Nodes (19): AdProList(), EMPTY, Filters, AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest, adProState (+11 more)

### Community 123 - "calendar.ts"
Cohesion: 0.20
Nodes (20): CalendarPage(), CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents(), includeRel (+12 more)

### Community 124 - "expense-row-actions.tsx"
Cohesion: 0.20
Nodes (16): BudgetTargetField(), ExpensePanel(), EditableExpense, CatalogArticle, BudgetTarget, cashAvailable(), defaultSource(), PaymentSource (+8 more)

### Community 125 - "department-budget-actions.ts"
Cohesion: 0.25
Nodes (20): ExpenseRowActions(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), deleteDepartmentExpense(), grantFor(), headedDepartmentIds() (+12 more)

### Community 126 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 127 - "read-figures.ts"
Cohesion: 0.14
Nodes (20): BINDING, INGESTIBLE, sourcesForModule(), buildFigureCall(), DEFECT_KINDS, FIGURE_KINDS, FIGURE_SCHEMA, FigureKind (+12 more)

### Community 128 - "lib/messaging.ts"
Cohesion: 0.14
Nodes (17): dynamic, POST(), DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES (+9 more)

### Community 129 - "api/auth.ts"
Cohesion: 0.23
Nodes (15): GET, authenticate(), generateApiKey(), hashApiKey(), readBearer(), sameHash(), hasAllScopes(), hasScope() (+7 more)

### Community 130 - "ranges-manager.tsx"
Cohesion: 0.16
Nodes (17): PALETTE, PeoplePanel(), PersonRow, PersonSheet(), ProductOption, ProductPicker(), RangesManager(), buildRangeTree() (+9 more)

### Community 131 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 132 - "drive-actions.ts"
Cohesion: 0.21
Nodes (20): FileActions(), AccessSheet(), NodeActions(), RichUpload(), useBackgroundUpload(), BulkResult, collectSubtree(), copyNodes() (+12 more)

### Community 133 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (17): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+9 more)

### Community 134 - "regulatory/page.tsx"
Cohesion: 0.19
Nodes (16): BusinessDevelopmentPipelinePage(), RegulatoryRow, UpdateReminderButton(), DOSAGE_UNIT, effectiveTherapeuticSegments(), PHARMA_FORM, getRegulatoryRows(), isRegulatorySupervisor() (+8 more)

### Community 135 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 136 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (18): dynamic, GET(), askClaude(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis() (+10 more)

### Community 137 - "entity-access.ts"
Cohesion: 0.23
Nodes (16): GET(), SearchPage(), isRequestOwner(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone(), globalSearch() (+8 more)

### Community 138 - "http.ts"
Cohesion: 0.15
Nodes (17): blockOf(), GET, SCALARS, schema(), GET, ApiContext, requireScopes(), handle() (+9 more)

### Community 139 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 140 - "drive/[id]/page.tsx"
Cohesion: 0.14
Nodes (12): ConvertPdfButton(), DriveCommentItem, ShareItem, SharePanel(), MoveTarget, Props, UserLite, SendToLegalSheet() (+4 more)

### Community 141 - "workspace.tsx"
Cohesion: 0.28
Nodes (16): DocumentWorkspace(), OpenDoc, Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W (+8 more)

### Community 142 - "tasks/request-flow.ts"
Cohesion: 0.23
Nodes (18): TaskDossierPage(), mapsUrl(), TaskList(), ACCEPTED_STATUS, awaitingResponse(), canAttach(), canDoWork(), canRespond() (+10 more)

### Community 143 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 144 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 145 - "ingest-catalog.ts"
Cohesion: 0.19
Nodes (17): CATALOG, CatalogSource, findSource(), FIRST_WAVE, SourceAuthority, extractDocumentLinks(), ingestCatalogSource(), ingestEverything() (+9 more)

### Community 146 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 147 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 148 - "evidence.ts"
Cohesion: 0.16
Nodes (16): sttConfigured(), base, BETTER, classify(), Diff, DiffClass, differential(), DifferentialReport (+8 more)

### Community 149 - "legal/lifecycle.ts"
Cohesion: 0.23
Nodes (14): LegalSweepResult, runLegalExpirySweep(), canCancel(), daysBetween(), daysLeft(), expiryLevel, expiryMessage(), LegalDocLike (+6 more)

### Community 150 - "rag.ts"
Cohesion: 0.19
Nodes (15): lunaEmbed(), lunaEmbedModel(), searchCorpusAction(), citationsByIds(), CorpusFilters, Row, searchCorpus(), searchCorpusLexical() (+7 more)

### Community 151 - "document-mirror.ts"
Cohesion: 0.25
Nodes (13): POST(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder(), ensureDrivePath(), ALREADY_MIRRORED (+5 more)

### Community 152 - "openapi.ts"
Cohesion: 0.16
Nodes (11): GET(), API_ERROR_CODES, ApiError, ApiErrorBody, ApiErrorCode, fromActionResult(), buildOpenApi(), COMMON_ERRORS (+3 more)

### Community 153 - "test-center/page.tsx"
Cohesion: 0.15
Nodes (14): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+6 more)

### Community 154 - "today.ts"
Cohesion: 0.16
Nodes (14): TodayPage(), CalendarEventDTO, algiersDay(), BriefResult, getToday(), greetingFor(), rankToday(), reasonOf() (+6 more)

### Community 155 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 156 - "company-access.ts"
Cohesion: 0.22
Nodes (15): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+7 more)

### Community 157 - "courriers/[id]/page.tsx"
Cohesion: 0.26
Nodes (12): dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput(), dateTimeInput(), mailFields(), MAIL_DIRECTION, isLinkableSource() (+4 more)

### Community 158 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 159 - "corpus-actions.ts"
Cohesion: 0.21
Nodes (14): CorpusPanel(), IngestResults, Src, WatchFindings, guard(), IngestActionResult, ingestOneSource(), ingestWave() (+6 more)

### Community 160 - "recruitment-actions.ts"
Cohesion: 0.29
Nodes (16): addRecruitmentCandidate(), answerRecruitmentInfo(), askRecruitmentInfo(), cancelRecruitmentRequest(), closeRecruitmentRequest(), decideRecruitmentStep(), moveRecruitmentCandidate(), onboardRecruitment() (+8 more)

### Community 161 - "catalog-normalize.ts"
Cohesion: 0.24
Nodes (15): ACRONYMS, ArticleFields, capitalizeWord(), CATEGORY_ALIASES, comparable(), isCodeLike(), normalizeArticle(), normalizeArticleName() (+7 more)

### Community 162 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 163 - "scheduled.ts"
Cohesion: 0.22
Nodes (16): pollAiBatches(), catchupEnabled(), catchUpMissingAiReviews(), catchUpStalledPipelines(), expireStaleBatches(), runDueRegulatoryJobs(), pruneStaleUploadSessions(), purgeClosedSessionParts() (+8 more)

### Community 164 - "ingest.ts"
Cohesion: 0.21
Nodes (13): asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode(), decomposeReserveText(), RESERVE_TYPE_LABELS, ReservePoint (+5 more)

### Community 165 - "canViewDrive"
Cohesion: 0.23
Nodes (12): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), canViewDrive(), buildDriveZip(), Collected (+4 more)

### Community 166 - "recrutement/[id]/panels.tsx"
Cohesion: 0.24
Nodes (13): DeleteMailButton(), EditMailButton(), AddCandidateButton(), AnswerInfoForm(), CancelRequestButton(), CandidateActions(), ChainDecisionPanel(), CloseRequestButton() (+5 more)

### Community 167 - "office-supply-actions.ts"
Cohesion: 0.25
Nodes (15): NormalizePanel(), applyCatalogNormalization(), canManageCatalog(), createSupplyArticle(), DENIED, LABELS, previewCatalogNormalization(), readArticle() (+7 more)

### Community 168 - "meeting-actions.ts"
Cohesion: 0.28
Nodes (14): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+6 more)

### Community 169 - "payroll-hr-actions.ts"
Cohesion: 0.33
Nodes (13): PayrollMatrix(), ym(), canRunPayroll(), markSalaryPaid(), transferPayrollToBudget(), unmarkSalaryPaid(), updatePayrollEntry(), ym() (+5 more)

### Community 170 - "departments.ts"
Cohesion: 0.19
Nodes (13): buildTree(), DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentTree(), getDepartmentUserIds(), getManagerOf() (+5 more)

### Community 171 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 172 - "rh/upload/route.ts"
Cohesion: 0.30
Nodes (11): dynamic, POST(), HrDossier(), defaultVisibleToEmployee(), EMPLOYEE_FACING, resolveVisibility(), shouldMirrorToDrive(), visibilityLabel() (+3 more)

### Community 173 - "corpus/page.tsx"
Cohesion: 0.18
Nodes (11): OrganigrammePage(), CorpusPage(), dynamic, metadata, SourceRow(), SourceWithVersion, canEditOrgChart(), canSeeRegEnrollment() (+3 more)

### Community 175 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 176 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 177 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 178 - "messaging/messages/route.ts"
Cohesion: 0.21
Nodes (10): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+2 more)

### Community 179 - "driver/page.tsx"
Cohesion: 0.22
Nodes (12): CorbeillePage(), CoursesPage(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getAssistantData(), getDeletedRequests(), getDriverMissions() (+4 more)

### Community 180 - "demandes/new-request.tsx"
Cohesion: 0.19
Nodes (10): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, VisibleFieldDef, ouiNon (+2 more)

### Community 181 - "exports.ts"
Cohesion: 0.20
Nodes (13): buildWorkbook(), canExport(), DATASETS, DatasetSpec, ensureExportFolder(), ExportDataset, exportDatasetToDrive(), ExportResult (+5 more)

### Community 182 - "pch-tender-export.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 183 - "calendar-view.tsx"
Cohesion: 0.21
Nodes (11): CalendarView(), colorOf(), EventDetail(), MONTH_LABELS, SheetMode, WEEKDAYS, INVITE_STATUSES, respondToInvite() (+3 more)

### Community 184 - "promo-material.ts"
Cohesion: 0.23
Nodes (12): PromoMaterialDetailPage(), promoSteps(), CompanyLite, PROMO_MATERIAL_FLOW, canViewPromo(), getPromoMaterial(), getPromoMaterials(), PromoDetail (+4 more)

### Community 185 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 186 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 187 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 188 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 189 - "ai/page.tsx"
Cohesion: 0.18
Nodes (8): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), dynamic, FEATURE_LABEL, metadata

### Community 190 - "upload-button.tsx"
Cohesion: 0.30
Nodes (9): CATEGORY_SUGGESTIONS, makePreflight(), Perm, UserLite, FINGERPRINT_MAX_BYTES, FINGERPRINT_MIN_BYTES, fingerprintFile(), shouldFingerprint() (+1 more)

### Community 191 - "radar.ts"
Cohesion: 0.27
Nodes (11): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+3 more)

### Community 192 - "loadInbox"
Cohesion: 0.20
Nodes (10): dynamic, GET(), addrStr(), listingKey(), listMailboxes(), listMessages(), loadInbox(), noteMailSuccess() (+2 more)

### Community 193 - "diagnostic/page.tsx"
Cohesion: 0.25
Nodes (9): inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage(), dynamic, metadata, scoreColor() (+1 more)

### Community 194 - "ConsultingContractPage"
Cohesion: 0.35
Nodes (9): ConsultingContractPage(), billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue(), MOVES (+1 more)

### Community 195 - "identity-board.tsx"
Cohesion: 0.38
Nodes (8): IdentityBoard(), IdentityCompany, filledCount(), IDENTITY_SECTIONS, identityBlock(), IdentityField, identityFieldKeys(), IdentitySection

### Community 196 - "hr-dossier.tsx"
Cohesion: 0.22
Nodes (9): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), REQ_TO_CAT, MeetingControls(), HR_DOCUMENT_STATUSES, HR_REQUEST_TYPE (+1 more)

### Community 197 - "pch.ts"
Cohesion: 0.35
Nodes (10): PchPage(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders(), LineRow, pchSummary(), toLineDTO() (+2 more)

### Community 198 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 199 - "legal-actions.ts"
Cohesion: 0.35
Nodes (10): attachDriveNodeToLegal(), createLegalDocument(), editLegalDocument(), KINDS, parseKind(), readFields(), updateLegalDocument(), canRenew() (+2 more)

### Community 200 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 201 - "medical.ts"
Cohesion: 0.20
Nodes (10): DelegatePlanDTO, DoctorDTO, getDelegatePlans(), getMedicalData(), InstitutionDTO, mapDoctor(), MedicalData, MedicalVisitRow (+2 more)

### Community 202 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 203 - "getMessage"
Cohesion: 0.24
Nodes (9): dynamic, GET(), friendlyMailError(), getMessage(), isOverloadError(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+1 more)

### Community 204 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 205 - "workflow-panel.tsx"
Cohesion: 0.29
Nodes (8): EventFundingPanel(), PmOpt, Props, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel(), WorkflowView

### Community 206 - "training-panel.tsx"
Cohesion: 0.27
Nodes (7): CaseDocRow, CaseRow, TrainingPanel(), UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 207 - "validation-item-review.tsx"
Cohesion: 0.27
Nodes (8): ValidationAttachments(), Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 208 - "payroll-cost.ts"
Cohesion: 0.40
Nodes (8): basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost(), num(), PayrollCostInput, payrollMass()

### Community 209 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 210 - "catchup.ts"
Cohesion: 0.29
Nodes (8): AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), MAX_AI_CATCHUPS_AFTER_FAILURE, shouldCatchUpAi(), base

### Community 211 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 212 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 213 - "typing/route.ts"
Cohesion: 0.31
Nodes (7): dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation(), setTyping()

### Community 214 - "dossiers.ts"
Cohesion: 0.33
Nodes (8): DossierDetailPage(), DossiersPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), getDossiers(), isDossierMember()

### Community 215 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 216 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 217 - "api/workflow.ts"
Cohesion: 0.31
Nodes (8): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView

### Community 218 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 219 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 220 - "events.ts"
Cohesion: 0.25
Nodes (8): ACTIVE, buildStats(), EventDetail, EventListItem, EventStats, getEventDetail(), PublicEvent, RegistrationDTO

### Community 221 - "fetch-source.ts"
Cohesion: 0.44
Nodes (7): extOf(), FetchedSource, fetchSource(), findPdfLink(), get(), htmlToText(), ImportedSection

### Community 222 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 223 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 224 - "meeting-chat.tsx"
Cohesion: 0.32
Nodes (7): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), deleteMeetingMessage(), postMeetingMessage()

### Community 225 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 226 - "file-glyph.ts"
Cohesion: 0.39
Nodes (6): FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge(), fam()

### Community 227 - "readers.ts"
Cohesion: 0.39
Nodes (5): canReadLegalDocument(), isRestricted(), LegalDocumentAccess, LegalReaderContext, readersCaption()

### Community 228 - "courses-board.tsx"
Cohesion: 0.38
Nodes (6): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 229 - "employee-form.tsx"
Cohesion: 0.29
Nodes (4): EmployeeForm(), EmployeeFormValues, Option, Props

### Community 230 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 231 - "RegulatoryIaAdminPage"
Cohesion: 0.33
Nodes (6): Breakdown(), fmtDateTime(), fmtUsd(), RegulatoryIaAdminPage(), regulatoryAiSpend, listRegulatoryAudit()

### Community 232 - "tender-logistics.tsx"
Cohesion: 0.40
Nodes (5): d10(), LogisticsRow(), Res, TenderLogistics(), PchOrderDTO

### Community 233 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 236 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 237 - "orphans-panel.tsx"
Cohesion: 0.50
Nodes (3): OrphansPanel(), TABLES, UnattachedGroup

### Community 238 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 239 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 240 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 241 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 242 - "rbac.test.ts"
Cohesion: 0.50
Nodes (3): seesWholeSecretariat(), fromRole(), mkAccess()

### Community 243 - "mail/attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 244 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 245 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 246 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

## Knowledge Gaps
- **1496 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1491 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `utils.ts`, `userCan`, `card.tsx`, `lib/labels.ts`, `formatDate`, `requireUser`, `recordAudit`, `upload/session.ts`, `getCurrentUser`, `rbac.ts`, `drive-storage.ts`, `notifyUser`, `brain-cockpit.tsx`, `dossier-agent.ts`, `admin-request-actions.ts`, `batch-runner.ts`, `congress-international/[id]/page.tsx`, `medical-directory-actions.ts`, `jobs/runner.ts`, `access-actions.ts`, `assistant-actions.ts`, `storage.ts`, `[dossierId]/page.tsx`, `rules/engine.ts`, `assistant.ts`, `payment-request-actions.ts`, `budget-forms.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `regAudit`, `SessionUser`, `build-facts.ts`, `training-actions.ts`, `agent-core.ts`, `test-center/runner.ts`, `rh/[id]/page.tsx`, `pilotage/page.tsx`, `formatDateTime`, `hasGlobalView`, `pch-tender-line-actions.ts`, `promo-material-actions.ts`, `intelligence/actions.ts`, `drive/page.tsx`, `folder-bar.tsx`, `market-research.ts`, `letterhead-manager.tsx`, `entities.ts`, `adoption.ts`, `getAppSettings`, `documents/[id]/edit/page.tsx`, `molecule.ts`, `teams-manager.tsx`, `lib/drive.ts`, `platform-audit/engine.ts`, `workflow-builder.tsx`, `medical-info-actions.ts`, `admin-settings-forms.tsx`, `(app)/layout.tsx`, `dossier-actions.ts`, `messaging-actions.ts`, `stock-board.tsx`, `features.ts`, `workflow/engine.ts`, `general-means.ts`, `microsoft-mail-actions.ts`, `queries/messaging.ts`, `lib/ai.ts`, `corpus/actions.ts`, `petty-cash-actions.ts`, `sales-planning-actions.ts`, `drive/upload/route.ts`, `field-reports.ts`, `update-reminder.ts`, `ocrDocument`, `document-request-actions.ts`, `Module`, `receipt-lines.tsx`, `purchase-request-actions.ts`, `lifecycle/actions.ts`, `reports.ts`, `departments-manager.tsx`, `mail.ts`, `state-machines/explorer.ts`, `progress/query.ts`, `migration-cert.ts`, `supplier/actions.ts`, `library-ingest.ts`, `invariants/registry.ts`, `connection.ts`, `meetings.ts`, `operations.ts`, `field-report-actions.ts`, `calendar.ts`, `department-budget-actions.ts`, `portfolio.ts`, `lib/messaging.ts`, `api/auth.ts`, `market-research-actions.ts`, `drive-actions.ts`, `meetings/[id]/page.tsx`, `regulatory/page.tsx`, `process-intelligence.ts`, `entity-access.ts`, `http.ts`, `drive/[id]/page.tsx`, `ingest-catalog.ts`, `auth-actions.ts`, `invoice-actions.ts`, `legal/lifecycle.ts`, `rag.ts`, `document-mirror.ts`, `test-center/page.tsx`, `today.ts`, `support-actions.ts`, `courriers/[id]/page.tsx`, `drive-space-manager.tsx`, `recruitment-actions.ts`, `scheduled.ts`, `ingest.ts`, `canViewDrive`, `office-supply-actions.ts`, `meeting-actions.ts`, `payroll-hr-actions.ts`, `departments.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `corpus/page.tsx`, `dashboard.ts`, `compare-versions.ts`, `driver/page.tsx`, `exports.ts`, `promo-material.ts`, `stock-snapshot-actions.ts`, `push.ts`, `ai/page.tsx`, `pch.ts`, `reminder-actions.ts`, `legal-actions.ts`, `medical.ts`, `regulatory-drive-mirror.ts`, `bd.ts`, `catchup.ts`, `mail-diagnostic/route.ts`, `typing/route.ts`, `dossiers.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `api/workflow.ts`, `events.ts`, `[token]/route.ts`, `orphans-panel.tsx`, `contacts/route.ts`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `prisma.ts`, `utils.ts`, `userCan`, `card.tsx`, `lib/labels.ts`, `formatDate`, `recordAudit`, `getCurrentUser`, `rbac.ts`, `notifyUser`, `brain-cockpit.tsx`, `dossier-agent.ts`, `admin-request-actions.ts`, `congress-international/[id]/page.tsx`, `medical-directory-actions.ts`, `access-actions.ts`, `assistant-actions.ts`, `storage.ts`, `[dossierId]/page.tsx`, `rules/engine.ts`, `payment-request-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `regAudit`, `SessionUser`, `training-actions.ts`, `agent-core.ts`, `test-center/runner.ts`, `rh/[id]/page.tsx`, `config.ts`, `formatDateTime`, `hasGlobalView`, `pch-tender-line-actions.ts`, `promo-material-actions.ts`, `intelligence/actions.ts`, `drive/page.tsx`, `folder-bar.tsx`, `letterhead-manager.tsx`, `getAppSettings`, `documents/[id]/edit/page.tsx`, `topbar.tsx`, `teams-manager.tsx`, `lib/drive.ts`, `platform-audit/engine.ts`, `workflow-builder.tsx`, `medical-info-actions.ts`, `(app)/layout.tsx`, `lib/department-budget.ts`, `dossier-actions.ts`, `product-explorer.tsx`, `messaging-actions.ts`, `stock-board.tsx`, `features.ts`, `general-means.ts`, `microsoft-mail-actions.ts`, `lib/ai.ts`, `corpus/actions.ts`, `molecule-panel.tsx`, `petty-cash-actions.ts`, `sales-planning-actions.ts`, `update-reminder.ts`, `document-request-actions.ts`, `receipt-lines.tsx`, `purchase-request-actions.ts`, `lifecycle/actions.ts`, `reports.ts`, `departments-manager.tsx`, `messenger.tsx`, `supplier/actions.ts`, `meetings.ts`, `operations.ts`, `field-report-actions.ts`, `department-budget-actions.ts`, `lib/messaging.ts`, `market-research-actions.ts`, `drive-actions.ts`, `entity-access.ts`, `auth-actions.ts`, `invoice-actions.ts`, `rag.ts`, `support-actions.ts`, `drive-space-manager.tsx`, `corpus-actions.ts`, `recruitment-actions.ts`, `office-supply-actions.ts`, `meeting-actions.ts`, `payroll-hr-actions.ts`, `corpus/page.tsx`, `calendar-view.tsx`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `legal-actions.ts`, `validation-item-review.tsx`, `dossiers.ts`, `meeting-chat.tsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `prisma.ts`, `utils.ts`, `card.tsx`, `lib/labels.ts`, `formatDate`, `requireUser`, `recordAudit`, `upload/session.ts`, `getCurrentUser`, `rbac.ts`, `drive-storage.ts`, `notifyUser`, `brain-cockpit.tsx`, `admin-request-actions.ts`, `congress-international/[id]/page.tsx`, `medical-directory-actions.ts`, `access-actions.ts`, `assistant-actions.ts`, `storage.ts`, `assistant.ts`, `payment-request-actions.ts`, `budget-forms.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `SessionUser`, `training-actions.ts`, `rh/[id]/page.tsx`, `pilotage/page.tsx`, `hasGlobalView`, `pch-tender-line-actions.ts`, `promo-material-actions.ts`, `drive/page.tsx`, `folder-bar.tsx`, `market-research.ts`, `entities.ts`, `adoption.ts`, `getAppSettings`, `documents/[id]/edit/page.tsx`, `lib/drive.ts`, `medical-info-actions.ts`, `(app)/layout.tsx`, `lib/department-budget.ts`, `dossier-actions.ts`, `product-explorer.tsx`, `messaging-actions.ts`, `stock-board.tsx`, `general-means.ts`, `queries/messaging.ts`, `lib/ai.ts`, `molecule-panel.tsx`, `petty-cash-actions.ts`, `sales-planning-actions.ts`, `drive/upload/route.ts`, `update-reminder.ts`, `document-request-actions.ts`, `departments-manager.tsx`, `meetings.ts`, `operations.ts`, `field-report-actions.ts`, `calendar.ts`, `department-budget-actions.ts`, `lib/messaging.ts`, `api/auth.ts`, `market-research-actions.ts`, `drive-actions.ts`, `regulatory/page.tsx`, `process-intelligence.ts`, `entity-access.ts`, `http.ts`, `drive/[id]/page.tsx`, `invoice-actions.ts`, `test-center/page.tsx`, `support-actions.ts`, `courriers/[id]/page.tsx`, `recruitment-actions.ts`, `office-supply-actions.ts`, `meeting-actions.ts`, `payroll-hr-actions.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `corpus/page.tsx`, `dashboard.ts`, `messaging/messages/route.ts`, `driver/page.tsx`, `exports.ts`, `pch-tender-export.ts`, `promo-material.ts`, `stock-snapshot-actions.ts`, `ai/page.tsx`, `diagnostic/page.tsx`, `ConsultingContractPage`, `pch.ts`, `reminder-actions.ts`, `legal-actions.ts`, `mail-diagnostic/route.ts`, `typing/route.ts`, `dossiers.ts`, `api/workflow.ts`, `rbac.test.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1496 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.02984094052558783 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03498982853821563 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.03336617405582923 - nodes in this community are weakly interconnected._