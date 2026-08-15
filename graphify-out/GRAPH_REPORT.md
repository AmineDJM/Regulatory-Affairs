# Graph Report - src  (2026-08-15)

## Corpus Check
- 1061 files · ~804,802 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6541 nodes · 25580 edges · 199 communities (194 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `787c7682`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireUser
- page-header.tsx
- prisma.ts
- requireModule
- button.tsx
- getAppSettings
- regulatory/[id]/page.tsx
- badge.tsx
- fdStr
- lib/labels.ts
- userCan
- hasGlobalView
- utils.ts
- [dossierId]/page.tsx
- getCompanyScope
- notifyUser
- jobs/runner.ts
- mon-espace/page.tsx
- anyRoleFilter
- mail.ts
- upload/session.ts
- drive-storage.ts
- corpus-actions.ts
- rules/engine.ts
- ocr-engine.ts
- assistant-actions.ts
- openai-luna.ts
- drive/[id]/page.tsx
- assistant.ts
- ad-pro-item-actions.ts
- FindingInput
- care-actions.ts
- agent-core.ts
- risks.ts
- build-facts.ts
- formatDateTime
- corpus/actions.ts
- workflow/engine.ts
- getCurrentUser
- (app)/validations/page.tsx
- mistral-ocr.ts
- promo-material-actions.ts
- market-research.ts
- training-board.tsx
- dossier-chat.ts
- Select
- regAudit
- lifecycle/actions.ts
- budget.ts
- adoption.ts
- anpp-process.tsx
- batch-runner.ts
- department-budget-actions.ts
- platform-audit/engine.ts
- ROLE_LABELS
- congress-international/[id]/page.tsx
- object-storage.ts
- onlyoffice.ts
- classify.ts
- test-center/runner.ts
- annuaire/page.tsx
- dashboard.ts
- lib/department-budget.ts
- stock-board.tsx
- market/engine.ts
- field-report-actions.ts
- brain-cockpit.tsx
- pch-tender-line-actions.ts
- queries/messaging.ts
- molecule.ts
- messaging-actions.ts
- knowledge/actions.ts
- aiConfigured
- putBlob
- progress/query.ts
- payment-authority.ts
- manifest.ts
- features.ts
- medical-actions.ts
- cash-panel.tsx
- upload-manager.tsx
- process-intelligence.ts
- competition.ts
- molecule-panel.tsx
- meetings/[id]/page.tsx
- src/auth.ts
- smart-mail-actions.ts
- bd-strategic-table.tsx
- document-preview.tsx
- event-actions.ts
- message-thread.tsx
- general-means.ts
- workflow-builder.tsx
- budget-forms.tsx
- reports.ts
- extract-text.ts
- migration-cert.ts
- dossier-actions.ts
- (app)/layout.tsx
- mon-dossier/page.tsx
- lib/ai.ts
- products.ts
- calendar.ts
- supplier/actions.ts
- enregistrement/page.tsx
- medical-info-actions.ts
- extract-facts.ts
- sheet-import.ts
- explorer.ts
- meetings.ts
- admin-settings-forms.tsx
- dossier-agent.ts
- messenger.tsx
- onboarding-wizard.tsx
- sidebar.tsx
- portfolio.ts
- company.ts
- (app)/organigramme/page.tsx
- events/page.tsx
- field-reports.ts
- run.ts
- invariants/registry.ts
- mail-client.tsx
- api/query.ts
- medical-directory.tsx
- lib/messaging.ts
- departments.ts
- messaging/messages/route.ts
- driver/page.tsx
- dossiers/[id]/panel.tsx
- pch.ts
- regulatory-actions.ts
- mobile-tabbar.tsx
- entities.ts
- org-chart-print.ts
- meeting-actions.ts
- regulatory/page.tsx
- errors.ts
- regulatory-table.tsx
- topbar.tsx
- api/auth.ts
- export.ts
- adoption/page.tsx
- today.ts
- department-budget-table.tsx
- moyens-generaux/page.tsx
- pch/export/route.ts
- compare-versions.ts
- push.ts
- test-center/types.ts
- new-request.tsx
- supplier-auth.ts
- training/for-section.ts
- modules/route.ts
- panels.tsx
- agents/actions.ts
- background-upload.tsx
- reminder-actions.ts
- http.ts
- imputation.ts
- regulatory-drive-mirror.ts
- openapi.ts
- congress-workflow.tsx
- meetings/page.tsx
- api/workflow.ts
- rbac-sheet.test.ts
- grouping.ts
- calendar-view.tsx
- tender-lines.tsx
- departments-manager.tsx
- assistant-files.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- fields/page.tsx
- zip-viewer.tsx
- client-bundle-guard.test.ts
- congress-request-form.tsx
- delegate-plans.tsx
- (auth)/login/login-form.tsx
- push-register.tsx
- [token]/route.ts
- courses-board.tsx
- bv-requests.tsx
- payroll-matrix.tsx
- change-password-form.tsx
- next-auth.d.ts
- attachment-validation.tsx
- directives/[id]/panel.tsx
- support/[id]/panel.tsx
- app/layout.tsx
- mission-stops.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 642 edges
2. `userCan()` - 501 edges
3. `fdStr()` - 481 edges
4. `recordAudit()` - 427 edges
5. `prisma` - 420 edges
6. `requireModule()` - 224 edges
7. `hasGlobalView()` - 192 edges
8. `Button` - 166 edges
9. `formatDate()` - 148 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts

## Import Cycles
- None detected.

## Communities (199 total, 5 thin omitted)

### Community 0 - "requireUser"
Cohesion: 0.03
Nodes (156): POST(), runAiHealthCheckNow(), PermanentDeleteButton(), PurgeOrphansButton(), DatabasesPage(), EntitiesManager(), ActiveToggle(), PresentationCard() (+148 more)

### Community 1 - "page-header.tsx"
Cohesion: 0.04
Nodes (108): ActivityPage(), fmtDuration(), dynamic, MailTester(), dynamic, metadata, inline(), MdTable() (+100 more)

### Community 2 - "prisma.ts"
Cohesion: 0.04
Nodes (74): dynamic, dynamic, dynamic, EntityRow, dynamic, EntitesPage(), ImpersonateButton(), DirectiveDetailPage() (+66 more)

### Community 3 - "requireModule"
Cohesion: 0.04
Nodes (107): AdminValidationsPage(), dec(), AdminWorkflowsPage(), BusinessDevelopmentPage(), Budget(), CongressTable(), CongressInternationalPage(), CongressNationalPage() (+99 more)

### Community 4 - "button.tsx"
Cohesion: 0.05
Nodes (67): DriveStorageSettings(), PALETTE, OrgBranch(), ENV_LABEL, MODES, GrantOption, RowGrants(), RowGrantsProps (+59 more)

### Community 5 - "getAppSettings"
Cohesion: 0.04
Nodes (89): GET(), POST(), dynamic, POST(), dynamic, POST(), POST(), dynamic (+81 more)

### Community 6 - "regulatory/[id]/page.tsx"
Cohesion: 0.05
Nodes (76): BD_DOC_CATEGORIES, BdProjectDetailPage(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, RequestDetailPage(), DOSSIER_DOC_CATEGORIES (+68 more)

### Community 7 - "badge.tsx"
Cohesion: 0.08
Nodes (63): ModuleSpec, TYPES, ACTION_COLS, dynamic, DropCategory, MoveTarget, UserLite, ComptaData (+55 more)

### Community 8 - "fdStr"
Cohesion: 0.04
Nodes (91): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, EventDetail(), EventForm() (+83 more)

### Community 9 - "lib/labels.ts"
Cohesion: 0.04
Nodes (80): AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BudgetRow, BudgetsTable(), MONTHS, BDPipeline() (+72 more)

### Community 10 - "userCan"
Cohesion: 0.06
Nodes (87): GET(), POST(), CataloguePage(), createBD(), addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope() (+79 more)

### Community 11 - "hasGlobalView"
Cohesion: 0.05
Nodes (87): GET(), RuleControls(), RuleEditor(), AttachmentValidationBlock(), RequestActions(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+79 more)

### Community 12 - "utils.ts"
Cohesion: 0.04
Nodes (71): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), dynamic, FocusCard(), BudgetExpenses() (+63 more)

### Community 13 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (74): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), DossierDetailPage(), dynamic, FindingEvidence() (+66 more)

### Community 14 - "getCompanyScope"
Cohesion: 0.05
Nodes (59): dynamic, GET(), runtime, dynamic, maxDuration, POST(), runtime, dynamic (+51 more)

### Community 15 - "notifyUser"
Cohesion: 0.06
Nodes (70): lastAlertByUser, NO_CONTENT, TrainingBoard(), addRequestComment(), archiveDirective(), canManage(), canParticipate(), createDirective() (+62 more)

### Community 16 - "jobs/runner.ts"
Cohesion: 0.06
Nodes (67): splitTextIntoChunksWithOffsets(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, submitVersionReviewBatch(), sectionByCode(), detectMime() (+59 more)

### Community 17 - "mon-espace/page.tsx"
Cohesion: 0.06
Nodes (56): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, DirectivesPage() (+48 more)

### Community 18 - "anyRoleFilter"
Cohesion: 0.06
Nodes (60): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+52 more)

### Community 19 - "mail.ts"
Cohesion: 0.05
Nodes (67): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+59 more)

### Community 20 - "upload/session.ts"
Cohesion: 0.05
Nodes (58): dynamic, maxDuration, POST(), runtime, dynamic, POST(), runtime, dynamic (+50 more)

### Community 21 - "drive-storage.ts"
Cohesion: 0.06
Nodes (61): dynamic, maxDuration, POST(), runtime, blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptWhole() (+53 more)

### Community 22 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 23 - "rules/engine.ts"
Cohesion: 0.06
Nodes (53): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+45 more)

### Community 24 - "ocr-engine.ts"
Cohesion: 0.06
Nodes (53): analyzeTenderDocument(), LunaImage, anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash() (+45 more)

### Community 25 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (55): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+47 more)

### Community 26 - "openai-luna.ts"
Cohesion: 0.06
Nodes (57): BATCH_MULTIPLIER, BatchOutcome, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody(), callLuna() (+49 more)

### Community 27 - "drive/[id]/page.tsx"
Cohesion: 0.06
Nodes (49): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt, DriveRow, DriveTable(), DriveSpacePage(), dynamic (+41 more)

### Community 28 - "assistant.ts"
Cohesion: 0.06
Nodes (53): Msg, dynamic, metadata, NoAccessPage(), NudgeResult, callClaudeStream(), activeUserId(), AssistantActionKind (+45 more)

### Community 29 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, Props, addAdProItem(), AdProModule, approveAdProItemOrder() (+41 more)

### Community 30 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 31 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 32 - "agent-core.ts"
Cohesion: 0.07
Nodes (38): lunaEmbed(), lunaEmbedModel(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn (+30 more)

### Community 33 - "risks.ts"
Cohesion: 0.07
Nodes (44): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), diff(), getPulse(), hourBucket(), LEVEL_RANK (+36 more)

### Community 34 - "build-facts.ts"
Cohesion: 0.08
Nodes (38): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+30 more)

### Community 35 - "formatDateTime"
Cohesion: 0.06
Nodes (38): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, ActivityRow, ActivityTable(), TYPE (+30 more)

### Community 36 - "corpus/actions.ts"
Cohesion: 0.09
Nodes (37): Citation, CorpusAdmin(), Source, Version, CorpusImport(), CaseCard(), canManage(), createCorpusSourceVersion() (+29 more)

### Community 37 - "workflow/engine.ts"
Cohesion: 0.08
Nodes (44): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), loadOutcome(), WorkflowEventView, WorkflowOutcome (+36 more)

### Community 38 - "getCurrentUser"
Cohesion: 0.08
Nodes (36): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic, esc(), GET() (+28 more)

### Community 39 - "(app)/validations/page.tsx"
Cohesion: 0.08
Nodes (41): MyRequestCard(), ValidationsPage(), SupervisionBoard(), CONGRESS_REQUEST_STATUS, DOSSIER_STATUS, EXPENSE_ORDER_STATUS, PROMO_MATERIAL_STATUS, VALIDATION_MODE (+33 more)

### Community 40 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 41 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), addPromoComment(), audit(), cancelPromoMaterial() (+28 more)

### Community 42 - "market-research.ts"
Cohesion: 0.09
Nodes (37): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), analyzeMarketResearch(), buildContext() (+29 more)

### Community 43 - "training-board.tsx"
Cohesion: 0.08
Nodes (37): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+29 more)

### Community 44 - "dossier-chat.ts"
Cohesion: 0.10
Nodes (36): AiTextResult, askDossier(), buildOverview(), buildPrompt(), ChatTurn, cleanAnswer(), DossierChatResult, expandQueryTerms() (+28 more)

### Community 45 - "Select"
Cohesion: 0.05
Nodes (30): ShareItem, SharePanel(), AccessSheet(), MoveTarget, Props, UserLite, EventFundingPanel(), PmOpt (+22 more)

### Community 46 - "regAudit"
Cohesion: 0.10
Nodes (36): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, regAudit(), enrichFinding(), Enrichment, EnrichmentContext (+28 more)

### Community 47 - "lifecycle/actions.ts"
Cohesion: 0.09
Nodes (33): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, blankDocx(), blankOffice, blankPptx() (+25 more)

### Community 48 - "budget.ts"
Cohesion: 0.07
Nodes (29): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, AttributedTx (+21 more)

### Community 49 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 50 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (36): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), isRegChecklistKey() (+28 more)

### Community 51 - "batch-runner.ts"
Cohesion: 0.09
Nodes (30): BatchRequest, fetchBatchOutput(), getBatchStatus(), aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt(), OffsetChunk (+22 more)

### Community 52 - "department-budget-actions.ts"
Cohesion: 0.17
Nodes (33): CashPanel(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), decideDepartmentBudgetRequest(), deleteDepartmentExpense(), grantFor(), headedDepartmentIds() (+25 more)

### Community 53 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): DesignSignals, FORMAT_PANEL, groupByViewSignature(), HealthProbe, ModuleStat, moduleStats(), probeAccounts(), probeAi() (+25 more)

### Community 54 - "ROLE_LABELS"
Cohesion: 0.08
Nodes (29): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ActiveToggle(), Profile, ProfileForm(), ResetPasswordForm() (+21 more)

### Community 55 - "congress-international/[id]/page.tsx"
Cohesion: 0.16
Nodes (32): CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), AdProEditButton(), AdProTransferButton(), promoMaterialOptions() (+24 more)

### Community 56 - "object-storage.ts"
Cohesion: 0.14
Nodes (32): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+24 more)

### Community 57 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (27): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+19 more)

### Community 58 - "classify.ts"
Cohesion: 0.09
Nodes (29): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+21 more)

### Community 59 - "test-center/runner.ts"
Cohesion: 0.11
Nodes (27): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+19 more)

### Community 60 - "annuaire/page.tsx"
Cohesion: 0.14
Nodes (28): GET(), DirectorySheetRow, DirectorySheetView(), AnnuairePage(), dynamic, DOCTOR_TITLE, MEDICAL_SECTOR, DIRECTORY_COLUMNS (+20 more)

### Community 61 - "dashboard.ts"
Cohesion: 0.13
Nodes (30): GET(), SearchPage(), executeReadTool(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+22 more)

### Community 62 - "lib/department-budget.ts"
Cohesion: 0.16
Nodes (27): DepartmentBudgetsPage(), dynamic, BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget(), canManageDepartmentBudgetAccess(), canRequestDepartmentBudget() (+19 more)

### Community 63 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 64 - "market/engine.ts"
Cohesion: 0.10
Nodes (31): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, loadNdjson(), MarketMeta, NomRow (+23 more)

### Community 65 - "field-report-actions.ts"
Cohesion: 0.13
Nodes (28): dynamic, POST(), dynamic, POST(), dynamic, POST(), ReportEditor(), SimpleReportEditor() (+20 more)

### Community 66 - "brain-cockpit.tsx"
Cohesion: 0.09
Nodes (25): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+17 more)

### Community 67 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (29): analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+21 more)

### Community 68 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+19 more)

### Community 69 - "molecule.ts"
Cohesion: 0.17
Nodes (27): SuggestField(), marketSuggestions(), analyzeMoleculeSafe(), canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES (+19 more)

### Community 70 - "messaging-actions.ts"
Cohesion: 0.17
Nodes (29): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+21 more)

### Community 71 - "knowledge/actions.ts"
Cohesion: 0.13
Nodes (26): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, askDossierAgentAction(), loadDossierChatAction() (+18 more)

### Community 72 - "aiConfigured"
Cohesion: 0.12
Nodes (28): runPettyCashRechargeReminders(), aiConfigured(), analyzeFieldReport(), extractJson(), performAiHealthCheck(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS (+20 more)

### Community 73 - "putBlob"
Cohesion: 0.16
Nodes (26): POST(), DriveComments(), FileActions(), ShareRow(), NodeActions(), collectSubtree(), convertNodeToPdf(), createFolder() (+18 more)

### Community 74 - "progress/query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 75 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 76 - "manifest.ts"
Cohesion: 0.11
Nodes (23): LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard(), CleanupResult (+15 more)

### Community 77 - "features.ts"
Cohesion: 0.13
Nodes (22): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+14 more)

### Community 78 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), createVisit() (+20 more)

### Community 79 - "cash-panel.tsx"
Cohesion: 0.18
Nodes (20): BudgetTargetField(), EditableExpense, CatalogArticle, empty(), ExistingLine, ReceiptLines(), Row, BudgetTarget (+12 more)

### Community 80 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 81 - "process-intelligence.ts"
Cohesion: 0.11
Nodes (25): dynamic, GET(), apiErrorMessage(), askClaude(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult (+17 more)

### Community 82 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 83 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (21): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+13 more)

### Community 84 - "meetings/[id]/page.tsx"
Cohesion: 0.09
Nodes (23): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+15 more)

### Community 85 - "src/auth.ts"
Cohesion: 0.13
Nodes (19): NO_CONTENT, POST(), POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut }, clientIp(), DeviceInfo (+11 more)

### Community 86 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 87 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (24): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+16 more)

### Community 88 - "document-preview.tsx"
Cohesion: 0.13
Nodes (18): FileViewer(), ValidationAttachments(), Decision, ItemReview(), LABEL, pill(), TONE, DocumentPreview() (+10 more)

### Community 89 - "event-actions.ts"
Cohesion: 0.13
Nodes (21): EditEventButton(), CheckinConfirm(), dynamic, RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent() (+13 more)

### Community 90 - "message-thread.tsx"
Cohesion: 0.14
Nodes (21): Props, SendPayload, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex(), dayLabel(), escapeRegExp(), inlineNoCode() (+13 more)

### Community 91 - "general-means.ts"
Cohesion: 0.14
Nodes (22): nextRechargeFor(), editableKindsOn(), currentPeriod(), LOW_CASH_RATIO, MAX_RECHARGE_DAY, MONTHS_FR, nextRechargeDate(), normalizeRechargeDay() (+14 more)

### Community 92 - "workflow-builder.tsx"
Cohesion: 0.12
Nodes (21): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep(), saveWorkflowDefinition() (+13 more)

### Community 93 - "budget-forms.tsx"
Cohesion: 0.16
Nodes (24): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard(), CategorySheet() (+16 more)

### Community 94 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 95 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 96 - "migration-cert.ts"
Cohesion: 0.19
Nodes (21): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), infraChecks() (+13 more)

### Community 97 - "dossier-actions.ts"
Cohesion: 0.18
Nodes (22): LinkToDossier(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage(), DossierMembers, editDossierMessage() (+14 more)

### Community 98 - "(app)/layout.tsx"
Cohesion: 0.13
Nodes (18): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+10 more)

### Community 99 - "mon-dossier/page.tsx"
Cohesion: 0.13
Nodes (21): dynamic, HrDossier(), REQ_TO_CAT, LeaveRequestButton(), MyLeaves(), MeetingControls(), HrRequestThread(), HR_DOCUMENT_CATEGORY (+13 more)

### Community 100 - "lib/ai.ts"
Cohesion: 0.10
Nodes (18): AiHealthResult, aiSelfTest(), AnthropicBlock, AskOptions, CallOptions, ClaudeContentBlock, ClaudeMessage, ClaudeRawResult (+10 more)

### Community 101 - "products.ts"
Cohesion: 0.17
Nodes (21): dynamic, MarketProductsPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GalenicForm (+13 more)

### Community 102 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 103 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 104 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 105 - "medical-info-actions.ts"
Cohesion: 0.19
Nodes (19): addMedicalInfoComment(), cancelDocRequest(), canManage(), fulfillDocRequest(), recordAuthorityDeclaration(), refreshStatus(), requestDocument(), revalidate() (+11 more)

### Community 106 - "extract-facts.ts"
Cohesion: 0.17
Nodes (21): bestStrengthCombo(), comboLinkOk(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText() (+13 more)

### Community 107 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 108 - "explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 109 - "meetings.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), startCall(), appBaseUrlForMeet(), canViewMeeting() (+9 more)

### Community 110 - "admin-settings-forms.tsx"
Cohesion: 0.13
Nodes (21): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+13 more)

### Community 111 - "dossier-agent.ts"
Cohesion: 0.15
Nodes (20): callClaude(), A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line (+12 more)

### Community 112 - "messenger.tsx"
Cohesion: 0.16
Nodes (20): ConversationList(), Props, relativeTime(), Props, bumpConversation(), Messenger(), Props, Props (+12 more)

### Community 113 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 114 - "sidebar.tsx"
Cohesion: 0.17
Nodes (16): badgeFor(), FLAT_GROUPS, Sidebar(), SidebarProps, TopbarProps, NavItem, aliasMatches(), groupIntoPoles() (+8 more)

### Community 115 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 116 - "company.ts"
Cohesion: 0.21
Nodes (18): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+10 more)

### Community 117 - "(app)/organigramme/page.tsx"
Cohesion: 0.14
Nodes (14): OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), dynamic, metadata (+6 more)

### Community 118 - "events/page.tsx"
Cohesion: 0.13
Nodes (18): dynamic, EventsPage(), dynamic, InscriptionPage(), EVENT_FORMAT, EVENT_STATUS, EVENT_TYPE, EVENTS_TABS (+10 more)

### Community 119 - "field-reports.ts"
Cohesion: 0.13
Nodes (17): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation (+9 more)

### Community 120 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 121 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (13): pred(), InvariantOutcome, Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+5 more)

### Community 122 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 123 - "api/query.ts"
Cohesion: 0.22
Nodes (15): GET, RESERVED, GET, coerce(), DEFAULT_LIMIT, listResult, MAX_LIMIT, Page (+7 more)

### Community 124 - "medical-directory.tsx"
Cohesion: 0.15
Nodes (16): MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER, INSTITUTION_SECTOR, INSTITUTION_TYPE, DelegatePlanDTO (+8 more)

### Community 125 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (17): DOT, MyStatus(), parseAttachments(), parseRef(), sendMessage(), setMessagingStatus(), validParent(), blobSecret() (+9 more)

### Community 126 - "departments.ts"
Cohesion: 0.16
Nodes (16): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentPath(), getDepartmentSubtreeIds() (+8 more)

### Community 127 - "messaging/messages/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+5 more)

### Community 128 - "driver/page.tsx"
Cohesion: 0.18
Nodes (14): CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getAssistantData() (+6 more)

### Community 129 - "dossiers/[id]/panel.tsx"
Cohesion: 0.17
Nodes (13): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+5 more)

### Community 130 - "pch.ts"
Cohesion: 0.18
Nodes (16): PchTenderPage(), d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail() (+8 more)

### Community 131 - "regulatory-actions.ts"
Cohesion: 0.20
Nodes (16): StatusEditor(), createRegulatoryProduct(), ensureRegSupervisor(), normalizeDci(), parseProductChannel(), regSupervisorRoles(), setRegulatoryPresubOutcome(), setRegulatoryPriority() (+8 more)

### Community 132 - "mobile-tabbar.tsx"
Cohesion: 0.18
Nodes (13): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY, NotificationPopup(), Popup (+5 more)

### Community 133 - "entities.ts"
Cohesion: 0.20
Nodes (12): GET, ASPECTS, GET, GET, Target, BY_NAME, canReadEntity(), EntityDef (+4 more)

### Community 134 - "org-chart-print.ts"
Cohesion: 0.23
Nodes (12): OrgCanvas(), saveOrgPosition(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml(), OrgSvg, PRINT_BOX_H (+4 more)

### Community 135 - "meeting-actions.ts"
Cohesion: 0.26
Nodes (15): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+7 more)

### Community 136 - "regulatory/page.tsx"
Cohesion: 0.20
Nodes (13): NewProductButton(), regStage(), RegulatoryPage(), SuppliersManager(), createRegulatorySupplier(), isRegulatorySupervisor(), effectiveStage, STAGE_ORDER (+5 more)

### Community 137 - "errors.ts"
Cohesion: 0.17
Nodes (11): blockOf(), GET, SCALARS, schema(), API_ERROR_CODES, ApiError, ApiErrorBody, ApiErrorCode (+3 more)

### Community 138 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (13): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, RegulatoryRow (+5 more)

### Community 139 - "topbar.tsx"
Cohesion: 0.19
Nodes (12): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+4 more)

### Community 140 - "api/auth.ts"
Cohesion: 0.32
Nodes (12): authenticate(), generateApiKey(), hashApiKey(), readBearer(), sameHash(), hasAllScopes(), hasScope(), isReadOnly() (+4 more)

### Community 141 - "export.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), regulatoryExportFilename() (+3 more)

### Community 142 - "adoption/page.tsx"
Cohesion: 0.15
Nodes (11): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, DonutChart(), DonutSlice (+3 more)

### Community 143 - "today.ts"
Cohesion: 0.19
Nodes (12): TodayPage(), CalendarEventDTO, getToday(), greetingFor(), rankToday(), reasonOf(), REASONS, score() (+4 more)

### Community 144 - "department-budget-table.tsx"
Cohesion: 0.16
Nodes (14): DepartmentAccessSheet(), AmountCell(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), allocatedOf(), consumedOf() (+6 more)

### Community 145 - "moyens-generaux/page.tsx"
Cohesion: 0.20
Nodes (13): Consumption(), DepartmentSwitcher(), ExpensePanel(), ExpenseRowActions(), dynamic, metadata, MoyensGenerauxPage(), budgetHealth (+5 more)

### Community 146 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 147 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 148 - "push.ts"
Cohesion: 0.29
Nodes (11): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+3 more)

### Community 149 - "test-center/types.ts"
Cohesion: 0.26
Nodes (9): fmt(), pct(), TestCenterPage(), guardMode(), GuardResult, resolveEnvironment(), PRODUCTION_SAFETY_PHRASE, RunConfig (+1 more)

### Community 150 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 151 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 152 - "training/for-section.ts"
Cohesion: 0.21
Nodes (8): CaseExtract, OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 153 - "modules/route.ts"
Cohesion: 0.20
Nodes (7): GET, GET, ENTITIES, entityNames(), schema, SCOPE_DESCRIPTIONS, MODULES

### Community 154 - "panels.tsx"
Cohesion: 0.29
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+1 more)

### Community 155 - "agents/actions.ts"
Cohesion: 0.25
Nodes (8): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentRunSummary, applicableAgents()

### Community 156 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 157 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 158 - "http.ts"
Cohesion: 0.31
Nodes (10): ApiContext, requireScopes(), handle(), HandleOptions, HandlerArgs, hashBody(), json(), log() (+2 more)

### Community 159 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 160 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 161 - "openapi.ts"
Cohesion: 0.29
Nodes (7): GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, READ_ONLY_SCOPES

### Community 162 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 163 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 164 - "api/workflow.ts"
Cohesion: 0.27
Nodes (9): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView (+1 more)

### Community 165 - "rbac-sheet.test.ts"
Cohesion: 0.38
Nodes (8): actionsOfModule(), buildAccessSheet(), isRowScoped(), ModuleSheetSpec, PermissionMatrix, rolesReaching(), matrix, ORDER

### Community 166 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 167 - "calendar-view.tsx"
Cohesion: 0.28
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND

### Community 168 - "tender-lines.tsx"
Cohesion: 0.33
Nodes (7): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), deleteTenderLine(), PchTenderLineDTO

### Community 169 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 170 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 171 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 172 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 173 - "fields/page.tsx"
Cohesion: 0.29
Nodes (5): FieldDefDTO, FieldsManager(), CustomFieldsPage(), CUSTOM_ENTITY_TYPES, CustomValues

### Community 174 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 175 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 176 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 177 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 178 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 179 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 180 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 181 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 182 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 183 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 184 - "change-password-form.tsx"
Cohesion: 0.40
Nodes (3): ChangePasswordForm(), ChangePasswordPage(), metadata

### Community 185 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 186 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 187 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 188 - "support/[id]/panel.tsx"
Cohesion: 0.60
Nodes (3): SupportActions(), SupportMessageForm(), useAction()

### Community 189 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 190 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1303 isolated node(s):** `ModuleSpec`, `dynamic`, `TYPE`, `FIELD_KEY`, `TARGET_NAME` (+1298 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `requireUser`, `page-header.tsx`, `requireModule`, `getAppSettings`, `regulatory/[id]/page.tsx`, `badge.tsx`, `fdStr`, `lib/labels.ts`, `userCan`, `hasGlobalView`, `utils.ts`, `[dossierId]/page.tsx`, `getCompanyScope`, `notifyUser`, `jobs/runner.ts`, `mon-espace/page.tsx`, `anyRoleFilter`, `mail.ts`, `upload/session.ts`, `drive-storage.ts`, `corpus-actions.ts`, `rules/engine.ts`, `ocr-engine.ts`, `assistant-actions.ts`, `openai-luna.ts`, `drive/[id]/page.tsx`, `assistant.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `agent-core.ts`, `risks.ts`, `build-facts.ts`, `formatDateTime`, `corpus/actions.ts`, `workflow/engine.ts`, `getCurrentUser`, `(app)/validations/page.tsx`, `promo-material-actions.ts`, `market-research.ts`, `dossier-chat.ts`, `regAudit`, `lifecycle/actions.ts`, `budget.ts`, `adoption.ts`, `batch-runner.ts`, `department-budget-actions.ts`, `platform-audit/engine.ts`, `congress-international/[id]/page.tsx`, `onlyoffice.ts`, `test-center/runner.ts`, `annuaire/page.tsx`, `dashboard.ts`, `lib/department-budget.ts`, `stock-board.tsx`, `field-report-actions.ts`, `brain-cockpit.tsx`, `pch-tender-line-actions.ts`, `queries/messaging.ts`, `messaging-actions.ts`, `knowledge/actions.ts`, `aiConfigured`, `putBlob`, `progress/query.ts`, `manifest.ts`, `features.ts`, `medical-actions.ts`, `process-intelligence.ts`, `meetings/[id]/page.tsx`, `src/auth.ts`, `smart-mail-actions.ts`, `event-actions.ts`, `general-means.ts`, `reports.ts`, `migration-cert.ts`, `dossier-actions.ts`, `(app)/layout.tsx`, `mon-dossier/page.tsx`, `lib/ai.ts`, `calendar.ts`, `supplier/actions.ts`, `medical-info-actions.ts`, `explorer.ts`, `meetings.ts`, `admin-settings-forms.tsx`, `dossier-agent.ts`, `onboarding-wizard.tsx`, `portfolio.ts`, `company.ts`, `(app)/organigramme/page.tsx`, `events/page.tsx`, `field-reports.ts`, `run.ts`, `invariants/registry.ts`, `api/query.ts`, `medical-directory.tsx`, `lib/messaging.ts`, `departments.ts`, `driver/page.tsx`, `pch.ts`, `regulatory-actions.ts`, `entities.ts`, `meeting-actions.ts`, `regulatory/page.tsx`, `api/auth.ts`, `export.ts`, `moyens-generaux/page.tsx`, `pch/export/route.ts`, `compare-versions.ts`, `push.ts`, `supplier-auth.ts`, `training/for-section.ts`, `agents/actions.ts`, `reminder-actions.ts`, `http.ts`, `regulatory-drive-mirror.ts`, `meetings/page.tsx`, `api/workflow.ts`, `fields/page.tsx`, `[token]/route.ts`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `page-header.tsx`, `prisma.ts`, `requireModule`, `mobile-tabbar.tsx`, `getAppSettings`, `regulatory/[id]/page.tsx`, `meeting-actions.ts`, `fdStr`, `org-chart-print.ts`, `userCan`, `hasGlobalView`, `utils.ts`, `regulatory/page.tsx`, `[dossierId]/page.tsx`, `notifyUser`, `getCompanyScope`, `mon-espace/page.tsx`, `regulatory-actions.ts`, `corpus-actions.ts`, `rules/engine.ts`, `ocr-engine.ts`, `assistant-actions.ts`, `agents/actions.ts`, `assistant.ts`, `ad-pro-item-actions.ts`, `reminder-actions.ts`, `care-actions.ts`, `formatDateTime`, `corpus/actions.ts`, `tender-lines.tsx`, `promo-material-actions.ts`, `regAudit`, `lifecycle/actions.ts`, `anpp-process.tsx`, `department-budget-actions.ts`, `congress-international/[id]/page.tsx`, `change-password-form.tsx`, `onlyoffice.ts`, `dashboard.ts`, `lib/department-budget.ts`, `stock-board.tsx`, `field-report-actions.ts`, `brain-cockpit.tsx`, `pch-tender-line-actions.ts`, `molecule.ts`, `messaging-actions.ts`, `knowledge/actions.ts`, `putBlob`, `manifest.ts`, `features.ts`, `medical-actions.ts`, `meetings/[id]/page.tsx`, `smart-mail-actions.ts`, `bd-strategic-table.tsx`, `event-actions.ts`, `workflow-builder.tsx`, `reports.ts`, `dossier-actions.ts`, `(app)/layout.tsx`, `mon-dossier/page.tsx`, `products.ts`, `supplier/actions.ts`, `medical-info-actions.ts`, `meetings.ts`, `admin-settings-forms.tsx`, `messenger.tsx`, `onboarding-wizard.tsx`, `(app)/organigramme/page.tsx`, `run.ts`, `lib/messaging.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `requireUser`, `page-header.tsx`, `prisma.ts`, `requireModule`, `driver/page.tsx`, `getAppSettings`, `regulatory/[id]/page.tsx`, `badge.tsx`, `pch.ts`, `errors.ts`, `lib/labels.ts`, `hasGlobalView`, `utils.ts`, `export.ts`, `adoption/page.tsx`, `regulatory/page.tsx`, `fdStr`, `mon-espace/page.tsx`, `pch/export/route.ts`, `moyens-generaux/page.tsx`, `anyRoleFilter`, `test-center/types.ts`, `notifyUser`, `regulatory-actions.ts`, `ocr-engine.ts`, `modules/route.ts`, `assistant-actions.ts`, `drive/[id]/page.tsx`, `assistant.ts`, `ad-pro-item-actions.ts`, `reminder-actions.ts`, `care-actions.ts`, `entities.ts`, `risks.ts`, `formatDateTime`, `api/workflow.ts`, `getCurrentUser`, `(app)/validations/page.tsx`, `meeting-actions.ts`, `tender-lines.tsx`, `market-research.ts`, `promo-material-actions.ts`, `budget.ts`, `adoption.ts`, `department-budget-actions.ts`, `platform-audit/engine.ts`, `congress-international/[id]/page.tsx`, `annuaire/page.tsx`, `dashboard.ts`, `lib/department-budget.ts`, `stock-board.tsx`, `field-report-actions.ts`, `pch-tender-line-actions.ts`, `queries/messaging.ts`, `molecule.ts`, `messaging-actions.ts`, `putBlob`, `medical-actions.ts`, `process-intelligence.ts`, `bd-strategic-table.tsx`, `event-actions.ts`, `general-means.ts`, `dossier-actions.ts`, `(app)/layout.tsx`, `products.ts`, `calendar.ts`, `medical-info-actions.ts`, `meetings.ts`, `(app)/organigramme/page.tsx`, `events/page.tsx`, `lib/messaging.ts`, `messaging/messages/route.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ModuleSpec`, `dynamic`, `TYPE` to the rest of the system?**
  _1303 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.030492661281146888 - nodes in this community are weakly interconnected._
- **Should `page-header.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.037687802393684744 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03562054743157105 - nodes in this community are weakly interconnected._