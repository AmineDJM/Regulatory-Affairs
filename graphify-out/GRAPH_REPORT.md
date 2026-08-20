# Graph Report - src  (2026-08-20)

## Corpus Check
- 1299 files · ~1,025,418 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7944 nodes · 31328 edges · 250 communities (241 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b1012d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- requireModule
- utils.ts
- userCan
- requireUser
- lib/labels.ts
- hasGlobalView
- Button
- recrutement/[id]/page.tsx
- rules/engine.ts
- toNumber
- assistant.ts
- prisma.ts
- lib/audit.ts
- batch-runner.ts
- module-tabs.tsx
- medical-directory-actions.ts
- admin-request-actions.ts
- build-facts.ts
- legal/page.tsx
- aiConfigured
- recordAudit
- dossier-agent.ts
- mail.ts
- corpus-actions.ts
- jobs/runner.ts
- corpus/actions.ts
- upload/session.ts
- regAudit
- object-storage.ts
- [dossierId]/page.tsx
- payment-request-actions.ts
- ad-pro-item-actions.ts
- care-actions.ts
- FindingInput
- getAppSettings
- assistant-actions.ts
- lib/department-budget.ts
- button.tsx
- rbac.ts
- onlyoffice.ts
- (app)/layout.tsx
- admin-settings-forms.tsx
- topbar.tsx
- drive/page.tsx
- anyRoleFilter
- mistral-ocr.ts
- rh/[id]/page.tsx
- library-ingest.ts
- config.ts
- http.ts
- promo-material-actions.ts
- sales-planning-actions.ts
- getCurrentUser
- training-board.tsx
- companyIdForNew
- budget.ts
- dashboard.ts
- product-explorer.tsx
- letterhead-manager.tsx
- library-actions.ts
- ocr-engine.ts
- message-thread.tsx
- field-reports.ts
- market-research.ts
- drive-storage.ts
- adoption.ts
- lib/ai.ts
- entities.ts
- messaging-actions.ts
- agent-core.ts
- ingest-dossier.ts
- test-center/runner.ts
- company.ts
- molecule.ts
- office-supply-actions.ts
- new-request-picker.tsx
- workflow/engine.ts
- formatDateTime
- regulatory-workflow.ts
- hr-document-actions.ts
- platform-audit/engine.ts
- test-center/page.tsx
- messenger.tsx
- lib/documents.ts
- microsoft-mail-actions.ts
- pch-tender-line-actions.ts
- queries/messaging.ts
- scheduled.ts
- upload-manager.tsx
- src/auth.ts
- progress/query.ts
- bd-strategic-table.tsx
- petty-cash-actions.ts
- payment-authority.ts
- drive/upload/route.ts
- competition.ts
- dossier-actions.ts
- classify.ts
- Module
- lib/drive.ts
- lib/messaging.ts
- drive-table.tsx
- document-request-actions.ts
- graph/provider.ts
- smart-mail-actions.ts
- meetings.ts
- ad-pro/page.tsx
- workflow-builder.tsx
- document-preview.tsx
- lifecycle/actions.ts
- reports.ts
- regulatory/page.tsx
- budget-forms.tsx
- moyens-generaux/page.tsx
- regulatory-table.tsx
- extract-text.ts
- migration-cert.ts
- calendar.ts
- driver/page.tsx
- dossiers/[id]/panel.tsx
- department-budget-actions.ts
- enregistrement/page.tsx
- budget-envelope-actions.ts
- sheet-import.ts
- state-machines/explorer.ts
- connection.ts
- access-actions.ts
- brain-cockpit.tsx
- meeting-actions.ts
- expense-row-actions.tsx
- stock-board.tsx
- update-reminder.ts
- risks.ts
- getMarketData
- adventum-brain/page.tsx
- onboarding-wizard.tsx
- portfolio.ts
- departments.ts
- drive-search.ts
- write.ts
- rag.ts
- invariants/registry.ts
- dashboard/page.tsx
- market-research-actions.ts
- purchase-section.tsx
- run.ts
- (app)/validations/page.tsx
- reply.ts
- mail-client.tsx
- receipt-lines.tsx
- supplier/actions.ts
- validation-supervision.ts
- client.ts
- openapi.ts
- consulting-actions.ts
- workspace.tsx
- auth-actions.ts
- congress-request-actions.ts
- invoice-actions.ts
- demandes/new-request.tsx
- tasks/request-flow.ts
- office/page.tsx
- pch.ts
- tender-lines.tsx
- (app)/organigramme/page.tsx
- MicrosoftGraphMailProvider
- rbac-sheet.test.ts
- create-fields.ts
- queries/workflow.ts
- field-report-actions.ts
- identity-board.tsx
- today.ts
- product-catalog.ts
- process-intelligence.ts
- regulatory/export/route.ts
- rh/upload/route.ts
- origin.ts
- upload-button.tsx
- MailProvider
- intelligence/access.ts
- s3-config.ts
- manifest.ts
- pch/export/route.ts
- calendar-view.tsx
- drive/[id]/page.tsx
- edit-product.tsx
- department-actions.ts
- products.ts
- overview/page.tsx
- background-upload.tsx
- pipeline-access.test.ts
- canViewDrive
- push.ts
- daily-brief.ts
- file-glyph.tsx
- assistant-files.ts
- radar.ts
- regulatory-ia/page.tsx
- ConsultingContractPage
- node-actions.tsx
- reminder-actions.ts
- imputation.ts
- promo/stock.ts
- congress-workflow.tsx
- meetings/page.tsx
- api/workflow.ts
- payroll-cost.ts
- grouping.ts
- database-admin-actions.ts
- departments-manager.tsx
- supplier-auth.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- workflow-panel.tsx
- client-bundle-guard.test.ts
- drive-space-manager.tsx
- forecast-grid.tsx
- pulse-strip.tsx
- [token]/route.ts
- risk-settings.ts
- courses-board.tsx
- bv-requests.tsx
- step-timeline.tsx
- stand-in-panel.tsx
- messages-indicator.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- roles-table.tsx
- directives/[id]/panel.tsx
- checkin/page.tsx
- request-controls.tsx
- corpus-import.tsx
- app/layout.tsx
- custom-fields-card.tsx
- update-reminder.tsx
- (app)/courrier/page.tsx
- invite-response.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 778 edges
2. `userCan()` - 606 edges
3. `fdStr()` - 578 edges
4. `recordAudit()` - 531 edges
5. `prisma` - 486 edges
6. `requireModule()` - 258 edges
7. `hasGlobalView()` - 213 edges
8. `Button` - 190 edges
9. `cn()` - 181 edges
10. `formatDate()` - 180 edges

## Surprising Connections (you probably didn't know these)
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (250 total, 9 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.03
Nodes (136): dynamic, AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, ActivityPage(), fmtDuration() (+128 more)

### Community 1 - "requireModule"
Cohesion: 0.03
Nodes (145): AdProList(), EMPTY, AdProOtherDetailPage(), AdProOtherPage(), dynamic, EntitesPage(), dynamic, GammesPage() (+137 more)

### Community 2 - "utils.ts"
Cohesion: 0.06
Nodes (95): dynamic, ModuleSpec, TYPES, ACTION_COLS, dynamic, dynamic, Mode, MODES (+87 more)

### Community 3 - "userCan"
Cohesion: 0.04
Nodes (124): dynamic, POST(), POST(), PresentationCard(), Res, EditEventButton(), RegistrationsManager(), EditTransactionSheet() (+116 more)

### Community 4 - "requireUser"
Cohesion: 0.04
Nodes (116): GET(), EntitiesManager(), FieldsManager(), ActiveToggle(), TaskWorkPanel(), VariationDTO, VariationPanel(), addBdProjectComment() (+108 more)

### Community 5 - "lib/labels.ts"
Cohesion: 0.03
Nodes (95): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), dynamic (+87 more)

### Community 6 - "hasGlobalView"
Cohesion: 0.05
Nodes (91): OtherDecisionPanel(), DirectiveDetailPage(), TrainingBoard(), audit(), closeAdProOtherRequest(), createAdProOtherRequest(), decideAdProOtherRequest(), nextRef() (+83 more)

### Community 7 - "Button"
Cohesion: 0.06
Nodes (52): DriveStorageSettings(), EntityRow, PALETTE, OrphansPanel(), OrgBranch(), ENV_LABEL, MODES, Option (+44 more)

### Community 8 - "recrutement/[id]/page.tsx"
Cohesion: 0.07
Nodes (72): APPROVAL_ICON, APPROVAL_TEXT, DOC_CATEGORIES, dynamic, RecruitmentPage(), AddCandidateButton(), AnswerInfoForm(), CancelRequestButton() (+64 more)

### Community 9 - "rules/engine.ts"
Cohesion: 0.05
Nodes (64): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+56 more)

### Community 10 - "toNumber"
Cohesion: 0.06
Nodes (71): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), DeclarationDetailPage(), dynamic, PROMO_DOC_CATEGORIES (+63 more)

### Community 11 - "assistant.ts"
Cohesion: 0.05
Nodes (72): dynamic, metadata, NoAccessPage(), callClaudeStream(), ClaudeToolDef, activeUserId(), describeChange(), parseRegFieldValue() (+64 more)

### Community 12 - "prisma.ts"
Cohesion: 0.05
Nodes (39): assistantNudge(), actorFor(), actorFor(), OLD_HASH, actorFor(), actor(), actorFor(), actorFor() (+31 more)

### Community 13 - "lib/audit.ts"
Cohesion: 0.05
Nodes (62): ImpersonateButton(), ReconcileTable(), CancelButton(), CreateRecordButtonProps, RecordFormProps, isKind(), TARGETS, updateAdProRequest() (+54 more)

### Community 14 - "batch-runner.ts"
Cohesion: 0.05
Nodes (66): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+58 more)

### Community 15 - "module-tabs.tsx"
Cohesion: 0.06
Nodes (55): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, fmtDzd() (+47 more)

### Community 16 - "medical-directory-actions.ts"
Cohesion: 0.07
Nodes (61): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, addDirectoryDoctor(), deleteDirectoryDoctors() (+53 more)

### Community 17 - "admin-request-actions.ts"
Cohesion: 0.05
Nodes (70): RuleControls(), RuleEditor(), letter(), MissionStops(), StopDTO, AttachmentValidationBlock(), RequestActions(), RequesterWindow() (+62 more)

### Community 18 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 19 - "legal/page.tsx"
Cohesion: 0.06
Nodes (55): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), FolderRow, LegalFolderBar(), LegalDocumentPage(), legalFields() (+47 more)

### Community 20 - "aiConfigured"
Cohesion: 0.06
Nodes (60): dynamic, maxDuration, POST(), runtime, dynamic, maxDuration, POST(), runtime (+52 more)

### Community 21 - "recordAudit"
Cohesion: 0.06
Nodes (64): PALETTE, PersonRow, PersonSheet(), ProductOption, ProductPicker(), RangeSheet(), SpaceSettingsButton(), DriveComments() (+56 more)

### Community 22 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (62): Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, ClaudeContentBlock, ClaudeMessage, A4, BASE_OF (+54 more)

### Community 23 - "mail.ts"
Cohesion: 0.05
Nodes (66): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+58 more)

### Community 24 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 25 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (63): splitTextIntoChunksWithOffsets(), buildPrompt(), reviewDocumentText(), corpusForSection(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS, MimeGuess (+55 more)

### Community 26 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (48): Citation, CorpusAdmin(), Source, Version, CorpusImport(), CaseCard(), CaseDocRow, CaseRow (+40 more)

### Community 27 - "upload/session.ts"
Cohesion: 0.06
Nodes (51): dynamic, runtime, releaseBlob(), flushOriginalArchives(), ingestDossierZip(), ingestDossierZipFromFile(), IngestResult, releaseDossierBlobs() (+43 more)

### Community 28 - "regAudit"
Cohesion: 0.07
Nodes (50): BudgetRowData, DossierBudgetRow(), BudgetForm(), DeferredReviewButton(), FindingControls(), Props, statusLabel(), Cycle (+42 more)

### Community 29 - "object-storage.ts"
Cohesion: 0.09
Nodes (56): dynamic, GET(), runtime, StoragePanel(), RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload() (+48 more)

### Community 30 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (49): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+41 more)

### Community 31 - "payment-request-actions.ts"
Cohesion: 0.09
Nodes (55): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, NewPaymentButton() (+47 more)

### Community 32 - "ad-pro-item-actions.ts"
Cohesion: 0.10
Nodes (50): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+42 more)

### Community 33 - "care-actions.ts"
Cohesion: 0.11
Nodes (48): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+40 more)

### Community 34 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 35 - "getAppSettings"
Cohesion: 0.09
Nodes (45): dynamic, POST(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm() (+37 more)

### Community 36 - "assistant-actions.ts"
Cohesion: 0.09
Nodes (47): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+39 more)

### Community 37 - "lib/department-budget.ts"
Cohesion: 0.09
Nodes (44): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList() (+36 more)

### Community 38 - "button.tsx"
Cohesion: 0.04
Nodes (36): DeleteMailButton(), EditMailButton(), RestoreButton(), PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView, NewReportButton() (+28 more)

### Community 39 - "rbac.ts"
Cohesion: 0.05
Nodes (42): dynamic, GET(), dynamic, esc(), GET(), NAV_LEGACY_LABELS, REGISTRATION_STATUS, DirectiveDetail (+34 more)

### Community 40 - "onlyoffice.ts"
Cohesion: 0.10
Nodes (39): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+31 more)

### Community 41 - "(app)/layout.tsx"
Cohesion: 0.07
Nodes (38): VersionsPage(), AppLayout(), dynamic, RootPage(), ActivityTracker(), Geo, send(), UAData (+30 more)

### Community 42 - "admin-settings-forms.tsx"
Cohesion: 0.09
Nodes (43): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+35 more)

### Community 43 - "topbar.tsx"
Cohesion: 0.09
Nodes (36): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), CommandPalette(), Item, SearchResult, Company, CompanySwitcher() (+28 more)

### Community 44 - "drive/page.tsx"
Cohesion: 0.10
Nodes (37): DriveCanvas(), ITEMS, NewKind, DriveSearch(), CreateSpaceButton(), DriveRow, DriveToolbar(), SettingsIcon (+29 more)

### Community 45 - "anyRoleFilter"
Cohesion: 0.11
Nodes (39): AffectationsPage(), dynamic, CataloguePage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage() (+31 more)

### Community 46 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 47 - "rh/[id]/page.tsx"
Cohesion: 0.07
Nodes (39): dynamic, MonDossierPage(), AdvanceItem, MyAdvances(), MonEspacePage(), CompanyAccessCard(), CompanyAccessRow, EmployeeForm() (+31 more)

### Community 48 - "library-ingest.ts"
Cohesion: 0.08
Nodes (36): LunaCallInput, canOcr(), IMAGE_EXTS, ocrDocument(), rasterizePdf(), asSectionHeader(), CATEGORIES, categorizeReserve() (+28 more)

### Community 49 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 50 - "http.ts"
Cohesion: 0.10
Nodes (36): GET, GET, POST, ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer() (+28 more)

### Community 51 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 52 - "sales-planning-actions.ts"
Cohesion: 0.08
Nodes (38): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, BU, CatalogueManager() (+30 more)

### Community 53 - "getCurrentUser"
Cohesion: 0.08
Nodes (34): dynamic, GET(), GET(), MIME_BY_EXT, mimeByName(), dynamic, GET(), dynamic (+26 more)

### Community 54 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 55 - "companyIdForNew"
Cohesion: 0.09
Nodes (39): SupportActions(), SupportMessageForm(), useAction(), AttachToSourceButtons(), attachDriveNodeToLegal(), cancelLegalDocument(), createLegalDocument(), deleteLegalDocument() (+31 more)

### Community 56 - "budget.ts"
Cohesion: 0.07
Nodes (32): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, AttributedTx (+24 more)

### Community 57 - "dashboard.ts"
Cohesion: 0.09
Nodes (37): GET(), SearchPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData() (+29 more)

### Community 58 - "product-explorer.tsx"
Cohesion: 0.08
Nodes (35): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+27 more)

### Community 59 - "letterhead-manager.tsx"
Cohesion: 0.10
Nodes (33): EditSheet(), IconAction(), KINDS, LetterheadManager(), UploadSheet(), ChoiceTile(), LetterheadChoice(), deleteLetterhead() (+25 more)

### Community 60 - "library-actions.ts"
Cohesion: 0.09
Nodes (35): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext, QualityCheck (+27 more)

### Community 61 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (35): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+27 more)

### Community 62 - "message-thread.tsx"
Cohesion: 0.11
Nodes (32): Composer(), DriveRef, Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS (+24 more)

### Community 63 - "field-reports.ts"
Cohesion: 0.08
Nodes (32): dynamic, POST(), dynamic, GET(), dynamic, POST(), dynamic, POST() (+24 more)

### Community 64 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 65 - "drive-storage.ts"
Cohesion: 0.10
Nodes (30): dynamic, POST(), DatabasesPage(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder() (+22 more)

### Community 66 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 67 - "lib/ai.ts"
Cohesion: 0.09
Nodes (28): dynamic, GET(), runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock (+20 more)

### Community 68 - "entities.ts"
Cohesion: 0.12
Nodes (28): GET, ASPECTS, GET, GET, GET, RESERVED, GET, GET (+20 more)

### Community 69 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (37): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+29 more)

### Community 70 - "agent-core.ts"
Cohesion: 0.10
Nodes (25): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+17 more)

### Community 71 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (36): archiveQueue, attachArchive(), clampInt(), enqueueArchive(), ingestCore(), ingestStoreConcurrency(), IngestSummary, isStorable() (+28 more)

### Community 72 - "test-center/runner.ts"
Cohesion: 0.10
Nodes (31): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+23 more)

### Community 73 - "company.ts"
Cohesion: 0.12
Nodes (30): PeoplePanel(), AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES (+22 more)

### Community 74 - "molecule.ts"
Cohesion: 0.12
Nodes (34): SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts(), analyzeMoleculeSafe() (+26 more)

### Community 75 - "office-supply-actions.ts"
Cohesion: 0.14
Nodes (33): NormalizePanel(), SuppliesManager(), SupplyArticleRow, applyCatalogNormalization(), canManageCatalog(), CatalogRewrite, createSupplyArticle(), DENIED (+25 more)

### Community 76 - "new-request-picker.tsx"
Cohesion: 0.08
Nodes (26): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton() (+18 more)

### Community 77 - "workflow/engine.ts"
Cohesion: 0.10
Nodes (32): getWorkflowDefinitions(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), countAdProItems(), emitFinancials() (+24 more)

### Community 78 - "formatDateTime"
Cohesion: 0.08
Nodes (28): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, CorbeillePage(), dynamic, TrashItem, TrashList() (+20 more)

### Community 79 - "regulatory-workflow.ts"
Cohesion: 0.11
Nodes (31): RegulatoryProcess(), STATE_OPTS, StepNote(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP, PRESUB_GATE_STEP, presubOutcome() (+23 more)

### Community 80 - "hr-document-actions.ts"
Cohesion: 0.11
Nodes (32): RequestRow(), createCalendarEvent(), deleteCalendarEvent(), parseKind(), updateCalendarEvent(), addHrRequestComment(), applyAnnualLeaveBalance(), archiveHrRequestIfDone() (+24 more)

### Community 81 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (31): buildPrompt(), fmtFinding(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL, groupByViewSignature(), HealthProbe (+23 more)

### Community 82 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (25): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+17 more)

### Community 83 - "messenger.tsx"
Cohesion: 0.10
Nodes (27): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+19 more)

### Community 84 - "lib/documents.ts"
Cohesion: 0.13
Nodes (25): POST(), PersistDocInput, persistUploadedDocument(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder() (+17 more)

### Community 85 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 86 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (28): dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine (+20 more)

### Community 87 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+19 more)

### Community 88 - "scheduled.ts"
Cohesion: 0.11
Nodes (27): dynamic, maxDuration, POST(), runtime, AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT (+19 more)

### Community 89 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 90 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 91 - "progress/query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 92 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 93 - "petty-cash-actions.ts"
Cohesion: 0.17
Nodes (23): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), runPettyCashRechargeReminders() (+15 more)

### Community 94 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 95 - "drive/upload/route.ts"
Cohesion: 0.15
Nodes (17): mimeOf(), POST(), POST(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict, TtlCache (+9 more)

### Community 96 - "competition.ts"
Cohesion: 0.13
Nodes (27): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+19 more)

### Community 97 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (25): LinkToDossier(), CreateDossierButton(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage(), DossierMembers (+17 more)

### Community 98 - "classify.ts"
Cohesion: 0.11
Nodes (24): MeetingRecorder(), pickMime(), dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+16 more)

### Community 99 - "Module"
Cohesion: 0.15
Nodes (25): LeaveItem, StandInState, Target, actsFor(), day(), delegatedActions(), Delegation, delegationNotice() (+17 more)

### Community 100 - "lib/drive.ts"
Cohesion: 0.14
Nodes (23): browseDrive(), BrowseNode, BrowseResult, EMPTY, canCreateInSpace(), DriveAccessLevel, driveBreadcrumb(), DriveListing (+15 more)

### Community 101 - "lib/messaging.ts"
Cohesion: 0.11
Nodes (21): dynamic, GET(), dynamic, GET(), DOT, MyStatus(), setMessagingStatus(), CHAT_STATUS_LABEL (+13 more)

### Community 102 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 103 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 104 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 105 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 106 - "meetings.ts"
Cohesion: 0.13
Nodes (21): dynamic, GET(), externalBase(), formatDateTime(), MeetingDetailPage(), CallButtons(), dynamic, PublicMeetPage() (+13 more)

### Community 107 - "ad-pro/page.tsx"
Cohesion: 0.17
Nodes (23): Filters, NewRequestPickerProps, AdProPage(), dynamic, AdProCreateData, AD_PRO_KINDS, AD_PRO_STATE, AdProKind (+15 more)

### Community 108 - "workflow-builder.tsx"
Cohesion: 0.15
Nodes (21): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+13 more)

### Community 109 - "document-preview.tsx"
Cohesion: 0.14
Nodes (19): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+11 more)

### Community 110 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 111 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 112 - "regulatory/page.tsx"
Cohesion: 0.16
Nodes (20): NewProductButton(), RegulatoryPage(), BusinessDevelopmentPipelinePage(), dynamic, RegulatoryRow, SuppliersManager(), UpdateReminderButton(), DOSAGE_UNIT (+12 more)

### Community 113 - "budget-forms.tsx"
Cohesion: 0.17
Nodes (23): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategorySheet(), CreateEnvelopeButton() (+15 more)

### Community 114 - "moyens-generaux/page.tsx"
Cohesion: 0.14
Nodes (21): Consumption(), DepartmentSwitcher(), dynamic, metadata, MoyensGenerauxPage(), budgetHealth, consumedPercent(), editableKindsOn() (+13 more)

### Community 115 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (18): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryTable(), STAGE_CLASS (+10 more)

### Community 116 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 117 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 118 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 119 - "driver/page.tsx"
Cohesion: 0.13
Nodes (18): ApprovalButtons(), ApprovalsPage(), AssistantPage(), CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage() (+10 more)

### Community 120 - "dossiers/[id]/panel.tsx"
Cohesion: 0.13
Nodes (18): DossierAssign(), DossierMessageForm(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite, DoctorPicker() (+10 more)

### Community 121 - "department-budget-actions.ts"
Cohesion: 0.24
Nodes (22): ExpenseRowActions(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), deleteDepartmentExpense(), grantFor(), headedDepartmentIds() (+14 more)

### Community 122 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 123 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (23): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+15 more)

### Community 124 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 125 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 126 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 127 - "access-actions.ts"
Cohesion: 0.18
Nodes (20): GrantOption, RowGrants(), RowGrantsProps, ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm() (+12 more)

### Community 128 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (18): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+10 more)

### Community 129 - "meeting-actions.ts"
Cohesion: 0.17
Nodes (21): EditMeetingButton(), ManageBar(), ProposalActions(), ShareLink(), TranscriptPanel(), acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting() (+13 more)

### Community 130 - "expense-row-actions.tsx"
Cohesion: 0.19
Nodes (17): BudgetTargetField(), ExpensePanel(), EditableExpense, CatalogArticle, BudgetTarget, DEPT_BUDGET_LABEL, cashAvailable(), defaultSource() (+9 more)

### Community 131 - "stock-board.tsx"
Cohesion: 0.18
Nodes (19): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+11 more)

### Community 132 - "update-reminder.ts"
Cohesion: 0.21
Nodes (18): sendRegulatoryUpdateReminder(), regulatoryReminderBoard(), canSendUpdateReminder(), daysSince(), isStaleDossier(), remindedRecently(), REMINDER_COOLDOWN_DAYS, REMINDER_ROLES (+10 more)

### Community 133 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), AutopilotPayload, congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 134 - "getMarketData"
Cohesion: 0.14
Nodes (21): Cache, DIR, getMarketData(), IqviaRow, LabRow, loadNdjson(), MarketMeta, NomRow (+13 more)

### Community 135 - "adventum-brain/page.tsx"
Cohesion: 0.16
Nodes (19): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), ageTone(), ProcessIntelligencePage(), diff(), getPulse() (+11 more)

### Community 136 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 137 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 138 - "departments.ts"
Cohesion: 0.15
Nodes (19): buildChain(), buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentPath() (+11 more)

### Community 139 - "drive-search.ts"
Cohesion: 0.19
Nodes (18): describePath(), fold(), matchesQuery(), MIN_QUERY, normalizeQuery(), rankHit(), SearchHit, searchSummary() (+10 more)

### Community 140 - "write.ts"
Cohesion: 0.18
Nodes (19): describeMailChanges(), diffMailAssignments(), diffMailEntry(), MAIL_ASSIGNMENT_FIELDS, MAIL_TRACKED_FIELDS, MailAssignmentField, MailAssignments, MailChange (+11 more)

### Community 141 - "rag.ts"
Cohesion: 0.16
Nodes (17): lunaEmbed(), lunaEmbedModel(), CorpusExtract, queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters, Row (+9 more)

### Community 142 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 143 - "dashboard/page.tsx"
Cohesion: 0.14
Nodes (16): BudgetRow, BudgetsTable(), MONTHS, DashboardPage(), STATUS_COLORS, DonutChart(), DonutSlice, MiniBarChart() (+8 more)

### Community 144 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 145 - "purchase-section.tsx"
Cohesion: 0.22
Nodes (16): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), withdrawPurchaseRequest(), canWithdraw() (+8 more)

### Community 146 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 147 - "(app)/validations/page.tsx"
Cohesion: 0.12
Nodes (14): MyRequestCard(), ValidationAttachments(), Decision, ItemReview(), LABEL, pill(), TONE, SupplierPortalPage() (+6 more)

### Community 148 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 149 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 150 - "receipt-lines.tsx"
Cohesion: 0.27
Nodes (16): empty(), ExistingLine, ReceiptLines(), Row, readReceipt(), ReceiptDraft, normalizeLines(), parseAmount() (+8 more)

### Community 151 - "supplier/actions.ts"
Cohesion: 0.24
Nodes (16): SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier(), regenerateSupplierDraft(), remindSupplier(), requestDossierId() (+8 more)

### Community 152 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 153 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 154 - "openapi.ts"
Cohesion: 0.15
Nodes (12): GET(), API_ERROR_CODES, ApiError, ApiErrorBody, ApiErrorCode, errors, fromActionResult(), buildOpenApi() (+4 more)

### Community 155 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 156 - "workspace.tsx"
Cohesion: 0.30
Nodes (15): DocumentWorkspace(), Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W, moveBy() (+7 more)

### Community 157 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 158 - "congress-request-actions.ts"
Cohesion: 0.39
Nodes (18): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+10 more)

### Community 159 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 160 - "demandes/new-request.tsx"
Cohesion: 0.15
Nodes (13): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, DriveExplorerSheet(), DrivePickerField() (+5 more)

### Community 161 - "tasks/request-flow.ts"
Cohesion: 0.25
Nodes (16): TaskDossierPage(), ACCEPTED_STATUS, awaitingResponse(), canAttach(), canDoWork(), canRespond(), canSee(), DECLINED_STATUS (+8 more)

### Community 162 - "office/page.tsx"
Cohesion: 0.32
Nodes (13): OfficeLauncher(), dynamic, OfficePage(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp (+5 more)

### Community 163 - "pch.ts"
Cohesion: 0.18
Nodes (16): PchTenderPage(), d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail() (+8 more)

### Community 164 - "tender-lines.tsx"
Cohesion: 0.18
Nodes (16): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+8 more)

### Community 165 - "(app)/organigramme/page.tsx"
Cohesion: 0.18
Nodes (11): dynamic, metadata, OrganigrammePage(), dynamic, metadata, TrainingPage(), TrainingPanel(), canEditOrgChart() (+3 more)

### Community 166 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 167 - "rbac-sheet.test.ts"
Cohesion: 0.20
Nodes (13): blockOf(), GET, SCALARS, schema(), ACTIONS, actionsOfModule(), buildAccessSheet(), isRowScoped() (+5 more)

### Community 168 - "create-fields.ts"
Cohesion: 0.18
Nodes (12): NewRequestPicker(), circuitFields(), DoctorOption, optionsOf(), PersonOption, promoMaterialCreateFields(), sponsoringCreateFields(), PM (+4 more)

### Community 169 - "queries/workflow.ts"
Cohesion: 0.17
Nodes (14): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, WorkflowActionView, WorkflowEventView, WorkflowOutcome, WorkflowView (+6 more)

### Community 170 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (15): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+7 more)

### Community 171 - "identity-board.tsx"
Cohesion: 0.27
Nodes (12): CopyButton(), IdentityBoard(), IdentityCompany, IdentitySheet(), dynamic, LegalIdentitiesPage(), filledCount(), IDENTITY_SECTIONS (+4 more)

### Community 172 - "today.ts"
Cohesion: 0.18
Nodes (13): CalendarEventDTO, getActionCenter(), resolve(), getToday(), greetingFor(), rankToday(), reasonOf(), REASONS (+5 more)

### Community 173 - "product-catalog.ts"
Cohesion: 0.25
Nodes (13): extractDosage(), bestMatches(), isConfident(), MatchProposal, matchScore(), ProductIdentity, productKey(), STRONG_MATCH (+5 more)

### Community 174 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 175 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 176 - "rh/upload/route.ts"
Cohesion: 0.30
Nodes (11): dynamic, POST(), HrDossier(), defaultVisibleToEmployee(), EMPLOYEE_FACING, resolveVisibility(), shouldMirrorToDrive(), visibilityLabel() (+3 more)

### Community 177 - "origin.ts"
Cohesion: 0.25
Nodes (12): CongressInternationalPage(), CongressNationalPage(), getCongressFormData(), adProInit, adProOriginRank(), AdProStage, AdProStatus, canChooseAnalysisAtCreation() (+4 more)

### Community 178 - "upload-button.tsx"
Cohesion: 0.23
Nodes (12): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, useBackgroundUpload(), FINGERPRINT_MAX_BYTES (+4 more)

### Community 180 - "intelligence/access.ts"
Cohesion: 0.15
Nodes (9): ASSISTANT_PERMS, DIRECTION_PERMS, HEAD_PERMS, REG_PERMISSIONS, RegPermission, regPermissions(), ROLE_REG_PERMS, RoleBearer (+1 more)

### Community 181 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 182 - "manifest.ts"
Cohesion: 0.21
Nodes (12): CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS (+4 more)

### Community 183 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 184 - "calendar-view.tsx"
Cohesion: 0.20
Nodes (12): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, INVITE_STATUSES (+4 more)

### Community 185 - "drive/[id]/page.tsx"
Cohesion: 0.24
Nodes (10): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), DriveMultiViewPage(), dynamic, OpenDoc, fileKind() (+2 more)

### Community 186 - "edit-product.tsx"
Cohesion: 0.24
Nodes (11): DciAssociationField(), EditProductValues, UserOption, UserOption, SelectField(), TextAreaField(), TextField(), ActionResult (+3 more)

### Community 187 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 188 - "products.ts"
Cohesion: 0.31
Nodes (11): dynamic, metadata, ProductExplorerPage(), clean(), getPchProducts(), PchProduct, productFilterOptions(), ProductSearchResult (+3 more)

### Community 189 - "overview/page.tsx"
Cohesion: 0.24
Nodes (11): FieldReportPage(), dynamic, FieldReportsOverviewPage(), dynamic, FieldReportsPage(), FIELD_REPORT_STATUS, canViewFieldReportsOverview(), getFieldReportDetail() (+3 more)

### Community 190 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 191 - "pipeline-access.test.ts"
Cohesion: 0.27
Nodes (10): canManagePipeline(), canViewPipeline(), hasRole(), pipelineAccessFor(), PipelineAccessSettings, PipelinePerson, asst, boss (+2 more)

### Community 192 - "canViewDrive"
Cohesion: 0.32
Nodes (9): GET(), GET(), canViewDrive(), buildDriveZip(), Collected, collectFolder(), safeName(), ZipError (+1 more)

### Community 193 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 194 - "daily-brief.ts"
Cohesion: 0.29
Nodes (9): AssistantPage(), dynamic, MorningBrief(), refreshMyBrief(), askClaudeCheap(), sttConfigured(), algiersDay(), BriefResult (+1 more)

### Community 195 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 196 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 197 - "radar.ts"
Cohesion: 0.27
Nodes (11): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+3 more)

### Community 198 - "regulatory-ia/page.tsx"
Cohesion: 0.27
Nodes (9): Breakdown(), dynamic, fmtDateTime(), fmtUsd(), metadata, RegulatoryIaAdminPage(), STEP_LABELS, regulatoryAiSpend (+1 more)

### Community 199 - "ConsultingContractPage"
Cohesion: 0.35
Nodes (9): ConsultingContractPage(), billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue(), MOVES (+1 more)

### Community 200 - "node-actions.tsx"
Cohesion: 0.22
Nodes (7): ShareItem, SharePanel(), AccessSheet(), MoveTarget, Props, UserLite, SendToLegalSheet()

### Community 201 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 202 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 203 - "promo/stock.ts"
Cohesion: 0.38
Nodes (9): canWithdraw(), deltaFor(), round3(), signOf(), StockGate, stockLevel, StockMovement, stockOf() (+1 more)

### Community 204 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 205 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 206 - "api/workflow.ts"
Cohesion: 0.27
Nodes (9): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView (+1 more)

### Community 207 - "payroll-cost.ts"
Cohesion: 0.40
Nodes (8): basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost(), num(), PayrollCostInput, payrollMass()

### Community 208 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 209 - "database-admin-actions.ts"
Cohesion: 0.44
Nodes (7): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs()

### Community 210 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 211 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 212 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 213 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 214 - "workflow-panel.tsx"
Cohesion: 0.32
Nodes (6): EventFundingPanel(), PmOpt, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel()

### Community 215 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 216 - "drive-space-manager.tsx"
Cohesion: 0.29
Nodes (3): ROLE_ENTRIES, SpaceData, UserOpt

### Community 217 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 218 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 219 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 220 - "risk-settings.ts"
Cohesion: 0.47
Nodes (4): DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 221 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 222 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 223 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 224 - "stand-in-panel.tsx"
Cohesion: 0.33
Nodes (5): StandInButton(), StandInDecision(), StandInModule, StandInPerson, TONE

### Community 225 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 228 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 229 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 230 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 231 - "checkin/page.tsx"
Cohesion: 0.50
Nodes (3): CheckinConfirm(), CheckinPage(), dynamic

### Community 232 - "request-controls.tsx"
Cohesion: 0.60
Nodes (4): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 233 - "corpus-import.tsx"
Cohesion: 0.40
Nodes (3): ACCEPT, AUTHORITIES, Row

### Community 234 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 235 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 236 - "update-reminder.tsx"
Cohesion: 0.67
Nodes (3): daysAgo(), LastReminder(), ReminderPerson

## Knowledge Gaps
- **1507 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1502 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `requireModule`, `utils.ts`, `userCan`, `requireUser`, `lib/labels.ts`, `hasGlobalView`, `recrutement/[id]/page.tsx`, `rules/engine.ts`, `toNumber`, `assistant.ts`, `lib/audit.ts`, `batch-runner.ts`, `module-tabs.tsx`, `medical-directory-actions.ts`, `admin-request-actions.ts`, `build-facts.ts`, `legal/page.tsx`, `aiConfigured`, `recordAudit`, `dossier-agent.ts`, `mail.ts`, `corpus-actions.ts`, `jobs/runner.ts`, `corpus/actions.ts`, `upload/session.ts`, `regAudit`, `[dossierId]/page.tsx`, `payment-request-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `getAppSettings`, `assistant-actions.ts`, `lib/department-budget.ts`, `rbac.ts`, `onlyoffice.ts`, `(app)/layout.tsx`, `admin-settings-forms.tsx`, `drive/page.tsx`, `anyRoleFilter`, `rh/[id]/page.tsx`, `library-ingest.ts`, `http.ts`, `promo-material-actions.ts`, `sales-planning-actions.ts`, `getCurrentUser`, `companyIdForNew`, `budget.ts`, `dashboard.ts`, `product-explorer.tsx`, `letterhead-manager.tsx`, `library-actions.ts`, `field-reports.ts`, `market-research.ts`, `drive-storage.ts`, `adoption.ts`, `lib/ai.ts`, `entities.ts`, `messaging-actions.ts`, `agent-core.ts`, `ingest-dossier.ts`, `test-center/runner.ts`, `company.ts`, `office-supply-actions.ts`, `new-request-picker.tsx`, `workflow/engine.ts`, `formatDateTime`, `hr-document-actions.ts`, `platform-audit/engine.ts`, `test-center/page.tsx`, `lib/documents.ts`, `microsoft-mail-actions.ts`, `pch-tender-line-actions.ts`, `queries/messaging.ts`, `scheduled.ts`, `src/auth.ts`, `progress/query.ts`, `bd-strategic-table.tsx`, `petty-cash-actions.ts`, `drive/upload/route.ts`, `dossier-actions.ts`, `Module`, `lib/drive.ts`, `lib/messaging.ts`, `document-request-actions.ts`, `smart-mail-actions.ts`, `meetings.ts`, `ad-pro/page.tsx`, `workflow-builder.tsx`, `lifecycle/actions.ts`, `reports.ts`, `regulatory/page.tsx`, `moyens-generaux/page.tsx`, `migration-cert.ts`, `calendar.ts`, `driver/page.tsx`, `department-budget-actions.ts`, `budget-envelope-actions.ts`, `state-machines/explorer.ts`, `connection.ts`, `access-actions.ts`, `brain-cockpit.tsx`, `meeting-actions.ts`, `stock-board.tsx`, `update-reminder.ts`, `risks.ts`, `adventum-brain/page.tsx`, `onboarding-wizard.tsx`, `portfolio.ts`, `departments.ts`, `drive-search.ts`, `write.ts`, `rag.ts`, `invariants/registry.ts`, `market-research-actions.ts`, `purchase-section.tsx`, `run.ts`, `(app)/validations/page.tsx`, `receipt-lines.tsx`, `supplier/actions.ts`, `consulting-actions.ts`, `auth-actions.ts`, `congress-request-actions.ts`, `invoice-actions.ts`, `office/page.tsx`, `pch.ts`, `(app)/organigramme/page.tsx`, `queries/workflow.ts`, `field-report-actions.ts`, `identity-board.tsx`, `product-catalog.ts`, `process-intelligence.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `intelligence/access.ts`, `manifest.ts`, `pch/export/route.ts`, `drive/[id]/page.tsx`, `department-actions.ts`, `canViewDrive`, `push.ts`, `daily-brief.ts`, `reminder-actions.ts`, `meetings/page.tsx`, `api/workflow.ts`, `database-admin-actions.ts`, `supplier-auth.ts`, `[token]/route.ts`, `risk-settings.ts`, `checkin/page.tsx`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `requireModule`, `utils.ts`, `userCan`, `hasGlobalView`, `recrutement/[id]/page.tsx`, `rules/engine.ts`, `toNumber`, `assistant.ts`, `prisma.ts`, `lib/audit.ts`, `module-tabs.tsx`, `medical-directory-actions.ts`, `admin-request-actions.ts`, `aiConfigured`, `recordAudit`, `corpus-actions.ts`, `corpus/actions.ts`, `regAudit`, `payment-request-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `getAppSettings`, `assistant-actions.ts`, `lib/department-budget.ts`, `onlyoffice.ts`, `(app)/layout.tsx`, `admin-settings-forms.tsx`, `drive/page.tsx`, `rh/[id]/page.tsx`, `config.ts`, `promo-material-actions.ts`, `sales-planning-actions.ts`, `companyIdForNew`, `dashboard.ts`, `letterhead-manager.tsx`, `library-actions.ts`, `field-reports.ts`, `drive-storage.ts`, `lib/ai.ts`, `messaging-actions.ts`, `molecule.ts`, `office-supply-actions.ts`, `formatDateTime`, `hr-document-actions.ts`, `test-center/page.tsx`, `messenger.tsx`, `microsoft-mail-actions.ts`, `pch-tender-line-actions.ts`, `petty-cash-actions.ts`, `dossier-actions.ts`, `lib/drive.ts`, `lib/messaging.ts`, `document-request-actions.ts`, `smart-mail-actions.ts`, `meetings.ts`, `workflow-builder.tsx`, `lifecycle/actions.ts`, `reports.ts`, `moyens-generaux/page.tsx`, `dossiers/[id]/panel.tsx`, `department-budget-actions.ts`, `budget-envelope-actions.ts`, `access-actions.ts`, `brain-cockpit.tsx`, `meeting-actions.ts`, `stock-board.tsx`, `update-reminder.ts`, `onboarding-wizard.tsx`, `market-research-actions.ts`, `purchase-section.tsx`, `run.ts`, `supplier/actions.ts`, `consulting-actions.ts`, `auth-actions.ts`, `congress-request-actions.ts`, `invoice-actions.ts`, `tender-lines.tsx`, `(app)/organigramme/page.tsx`, `field-report-actions.ts`, `calendar-view.tsx`, `department-actions.ts`, `daily-brief.ts`, `reminder-actions.ts`, `database-admin-actions.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `requireModule`, `utils.ts`, `requireUser`, `lib/labels.ts`, `hasGlobalView`, `recrutement/[id]/page.tsx`, `toNumber`, `assistant.ts`, `prisma.ts`, `lib/audit.ts`, `module-tabs.tsx`, `medical-directory-actions.ts`, `admin-request-actions.ts`, `legal/page.tsx`, `recordAudit`, `mail.ts`, `payment-request-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `getAppSettings`, `assistant-actions.ts`, `lib/department-budget.ts`, `rbac.ts`, `onlyoffice.ts`, `(app)/layout.tsx`, `drive/page.tsx`, `anyRoleFilter`, `rh/[id]/page.tsx`, `http.ts`, `promo-material-actions.ts`, `sales-planning-actions.ts`, `getCurrentUser`, `companyIdForNew`, `budget.ts`, `dashboard.ts`, `product-explorer.tsx`, `field-reports.ts`, `market-research.ts`, `drive-storage.ts`, `adoption.ts`, `lib/ai.ts`, `entities.ts`, `messaging-actions.ts`, `molecule.ts`, `office-supply-actions.ts`, `formatDateTime`, `hr-document-actions.ts`, `test-center/page.tsx`, `pch-tender-line-actions.ts`, `queries/messaging.ts`, `petty-cash-actions.ts`, `drive/upload/route.ts`, `dossier-actions.ts`, `lib/drive.ts`, `lib/messaging.ts`, `document-request-actions.ts`, `meetings.ts`, `ad-pro/page.tsx`, `regulatory/page.tsx`, `moyens-generaux/page.tsx`, `calendar.ts`, `driver/page.tsx`, `department-budget-actions.ts`, `budget-envelope-actions.ts`, `access-actions.ts`, `meeting-actions.ts`, `stock-board.tsx`, `adventum-brain/page.tsx`, `write.ts`, `dashboard/page.tsx`, `market-research-actions.ts`, `consulting-actions.ts`, `congress-request-actions.ts`, `invoice-actions.ts`, `pch.ts`, `tender-lines.tsx`, `(app)/organigramme/page.tsx`, `rbac-sheet.test.ts`, `field-report-actions.ts`, `identity-board.tsx`, `today.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `origin.ts`, `pch/export/route.ts`, `drive/[id]/page.tsx`, `department-actions.ts`, `ConsultingContractPage`, `reminder-actions.ts`, `api/workflow.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1507 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03281766967718859 - nodes in this community are weakly interconnected._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.025721301411909148 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05890952872377021 - nodes in this community are weakly interconnected._