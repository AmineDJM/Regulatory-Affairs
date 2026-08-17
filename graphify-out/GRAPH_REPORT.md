# Graph Report - src  (2026-08-17)

## Corpus Check
- 1162 files · ~876,398 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7103 nodes · 27727 edges · 211 communities (204 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `09050db6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- lib/session.ts
- utils.ts
- lib/labels.ts
- userCan
- prisma.ts
- getCurrentUser
- getAppSettings
- requireUser
- card.tsx
- cn
- entity-access.ts
- workflow/engine.ts
- formatDateTime
- batch-runner.ts
- promo-material-actions.ts
- fdStr
- mail.ts
- regAudit
- medical-directory.tsx
- toNumber
- ocr-engine.ts
- [dossierId]/page.tsx
- recordAudit
- object-storage.ts
- drive-storage.ts
- aiConfigured
- jobs/runner.ts
- hasGlobalView
- events/[id]/page.tsx
- workspace.tsx
- assistant-actions.ts
- lib/department-budget.ts
- FindingInput
- notifyUser
- ad-pro-item-actions.ts
- care-actions.ts
- training-panel.tsx
- budget.ts
- training-board.tsx
- molecule.ts
- admin-request-actions.ts
- anyRoleFilter
- mistral-ocr.ts
- upload/session.ts
- test-center/runner.ts
- config.ts
- market-research.ts
- notifyRoles
- scheduled.ts
- validation-actions.ts
- users/[id]/page.tsx
- features.ts
- message-thread.tsx
- (app)/layout.tsx
- library-actions.ts
- dossier-agent.ts
- dossier-chat.ts
- adoption.ts
- agent-core.ts
- calendar.ts
- assistant.ts
- http.ts
- messaging-actions.ts
- sales-planning-actions.ts
- access-actions.ts
- regulatory-workflow.ts
- platform-audit/engine.ts
- entities.ts
- lib/messaging.ts
- settings.ts
- onlyoffice.ts
- lib/ai.ts
- pch-tender-line-actions.ts
- action-center.ts
- mail-client.tsx
- microsoft-mail-actions.ts
- petty-cash-actions.ts
- sectionByCode
- adventum-brain/page.tsx
- src/auth.ts
- competition.ts
- payment-authority.ts
- field-reports.ts
- budget-forms.tsx
- queries/messaging.ts
- molecule-panel.tsx
- dossier-actions.ts
- drive-actions.ts
- graph/provider.ts
- smart-mail-actions.ts
- event-form.tsx
- promo-stock-actions.ts
- reports.ts
- review-agent.ts
- extract-text.ts
- zip-inspector.ts
- aiModel
- drive/upload/route.ts
- progress/query.ts
- lifecycle/actions.ts
- upload-manager.tsx
- migration-cert.ts
- messenger.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- portfolio.ts
- extract-facts.ts
- sheet-import.ts
- state-machines/explorer.ts
- aiFeatureEnabled
- connection.ts
- openapi.ts
- power-tools.ts
- department-budget-actions.ts
- risks.ts
- new-request-picker.tsx
- business-development/opportunites/page.tsx
- bd-strategic-table.tsx
- moyens-generaux/page.tsx
- icon.tsx
- regulatory-table.tsx
- sidebar.tsx
- getMarketData
- invariants/registry.ts
- process-intelligence.ts
- brain-cockpit.tsx
- supervision-board.tsx
- onboarding-wizard.tsx
- reply.ts
- unified.ts
- consulting-actions.ts
- rh/departements/page.tsx
- general-means.ts
- client.ts
- read-figures.ts
- test-center/page.tsx
- hr-dossier.tsx
- auth-actions.ts
- receipt-lines.tsx
- support-actions.ts
- tender-lines.tsx
- corpus-actions.ts
- meetings.ts
- departments.ts
- MicrosoftGraphMailProvider
- office-templates.ts
- canViewDrive
- org-chart-print.ts
- (app)/organigramme/page.tsx
- training-actions.ts
- doc-request.ts
- simple-pdf.ts
- event-actions.ts
- meetings/[id]/page.tsx
- company-access.ts
- MailProvider
- regulatory-ia/page.tsx
- radar.ts
- stock-snapshot-actions.ts
- fetch-source.ts
- ingest-catalog.ts
- compare-versions.ts
- ai-health.ts
- corpus/page.tsx
- push.ts
- DriveTable
- reserves/actions.ts
- budgets-table.tsx
- ConsultingContractPage
- twin-panel.tsx
- supplier-auth.ts
- background-upload.tsx
- reminder-actions.ts
- pch-tender-export.ts
- onlyoffice/callback/route.ts
- grouping.ts
- typing/route.ts
- company-actions.ts
- assistant-files.ts
- auto-category.ts
- manufacturing-stage.ts
- Adventum Autonomous Test Center — architecture
- drive/[id]/edit/page.tsx
- fingerprint.ts
- missions.ts
- entrainement/page.tsx
- client-bundle-guard.test.ts
- forecast-grid.tsx
- reserves/page.tsx
- push-register.tsx
- [token]/route.ts
- audit-table.tsx
- fields/page.tsx
- tender-logistics.tsx
- messages-indicator.tsx
- next-auth.d.ts
- admin/corbeille/page.tsx
- app/layout.tsx
- notification-chime.tsx
- events/[id]/export/route.ts
- MarketPricingPage
- TtlCache
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 682 edges
2. `userCan()` - 532 edges
3. `fdStr()` - 502 edges
4. `recordAudit()` - 451 edges
5. `prisma` - 443 edges
6. `requireModule()` - 238 edges
7. `hasGlobalView()` - 204 edges
8. `Button` - 173 edges
9. `formatDate()` - 162 edges
10. `toNumber()` - 150 edges

## Surprising Connections (you probably didn't know these)
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts
- `AutopilotConfirm()` --calls--> `runAutopilot()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/actions/adventum-actions.ts

## Import Cycles
- None detected.

## Communities (211 total, 7 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.03
Nodes (128): Citation, Source, Version, Option, RuleDTO, Action, base(), Cat (+120 more)

### Community 1 - "lib/session.ts"
Cohesion: 0.04
Nodes (137): AdProOtherDetailPage(), AdProOtherPage(), dynamic, dynamic, DiagnosticPage(), scoreColor(), FeedbackStatusSelect(), AdminFeedbackPage() (+129 more)

### Community 2 - "utils.ts"
Cohesion: 0.05
Nodes (94): ModuleSpec, TYPE, PurgeOrphansButton(), dynamic, TYPES, ACTION_COLS, STAGE, dynamic (+86 more)

### Community 3 - "lib/labels.ts"
Cohesion: 0.03
Nodes (111): dynamic, BD_DOC_CATEGORIES, ProjectEditor(), ProjectStatusBadge(), dynamic, ApprovalButtons(), PAYABLE_CATEGORIES, STATUS_BADGES (+103 more)

### Community 4 - "userCan"
Cohesion: 0.04
Nodes (102): POST(), OtherDecisionPanel(), SuppliesManager(), EditTransactionSheet(), RevisionRequest(), PayButton(), EditTenderButton(), OrdersManager() (+94 more)

### Community 5 - "prisma.ts"
Cohesion: 0.03
Nodes (77): dynamic, GET(), GET(), EntityRow, OrphansPanel(), dynamic, EntitesPage(), StocksPage() (+69 more)

### Community 6 - "getCurrentUser"
Cohesion: 0.04
Nodes (91): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+83 more)

### Community 7 - "getAppSettings"
Cohesion: 0.05
Nodes (81): GET(), dynamic, POST(), RequestRow(), MONTHS, PayrollCell, PayrollMatrix(), PayrollRow (+73 more)

### Community 8 - "requireUser"
Cohesion: 0.05
Nodes (89): FieldsManager(), EditVisitSheet(), EditProductButton(), StepNote(), VariationPanel(), updateBDStatus(), addBdProjectComment(), createBdProduct() (+81 more)

### Community 9 - "card.tsx"
Cohesion: 0.05
Nodes (65): ActivityRow, ActivityTable(), ActivityPage(), fmtDuration(), dynamic, metadata, dynamic, FEATURE_LABEL (+57 more)

### Community 10 - "cn"
Cohesion: 0.03
Nodes (67): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+59 more)

### Community 11 - "entity-access.ts"
Cohesion: 0.04
Nodes (70): POST(), GET(), BdProjectDetailPage(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), DashboardPage(), STATUS_COLORS, DocumentRow (+62 more)

### Community 12 - "workflow/engine.ts"
Cohesion: 0.05
Nodes (70): AdminWorkflowsPage(), dynamic, blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition() (+62 more)

### Community 13 - "formatDateTime"
Cohesion: 0.07
Nodes (65): CourrierAdminPage(), AdminUserPage(), SHEET, Group(), RequestDetailPage(), DriveRow, DriveToolbar(), SettingsIcon (+57 more)

### Community 14 - "batch-runner.ts"
Cohesion: 0.05
Nodes (69): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+61 more)

### Community 15 - "promo-material-actions.ts"
Cohesion: 0.08
Nodes (60): POST(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial() (+52 more)

### Community 16 - "fdStr"
Cohesion: 0.05
Nodes (68): ActiveToggle(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR (+60 more)

### Community 17 - "mail.ts"
Cohesion: 0.05
Nodes (69): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+61 more)

### Community 18 - "regAudit"
Cohesion: 0.06
Nodes (57): CorpusAdmin(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), regAudit(), canManage(), createCorpusSourceVersion() (+49 more)

### Community 19 - "medical-directory.tsx"
Cohesion: 0.06
Nodes (63): GET(), DirectorySheetRow, DirectorySheetView(), DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), MedicalDirectory(), Props (+55 more)

### Community 20 - "toNumber"
Cohesion: 0.06
Nodes (57): AdProPage(), CongressInternationalPage(), CongressNationalPage(), OrderRow, OrdersTable(), OrdresDepensePage(), dynamic, FormationsPage() (+49 more)

### Community 21 - "ocr-engine.ts"
Cohesion: 0.05
Nodes (56): MeetingRecorder(), pickMime(), analyzeEmployeeContract(), CONTRACT_TYPES_UP, dossierCost, c(), defaultOcrLangs(), ensureLangData() (+48 more)

### Community 22 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (56): AgentItem, AgentsPanel(), RunState, ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel() (+48 more)

### Community 23 - "recordAudit"
Cohesion: 0.05
Nodes (60): dynamic, POST(), PermanentDeleteButton(), RoleRow(), ImpersonateButton(), SpaceSettingsButton(), DeleteVisitButton(), CancelButton() (+52 more)

### Community 24 - "object-storage.ts"
Cohesion: 0.08
Nodes (63): dynamic, GET(), runtime, RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config() (+55 more)

### Community 25 - "drive-storage.ts"
Cohesion: 0.07
Nodes (54): dynamic, GET(), dynamic, GET(), dynamic, GET(), DatabasesPage(), blobChunkBytes() (+46 more)

### Community 26 - "aiConfigured"
Cohesion: 0.06
Nodes (48): aiConfigured(), extractLooseJson(), repairAndParse(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES (+40 more)

### Community 27 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (59): splitTextIntoChunksWithOffsets(), corpusForSection(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith() (+51 more)

### Community 28 - "hasGlobalView"
Cohesion: 0.06
Nodes (51): CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), letter(), MissionStops(), StopDTO, DriverPage() (+43 more)

### Community 29 - "events/[id]/page.tsx"
Cohesion: 0.10
Nodes (47): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), AppealPanel() (+39 more)

### Community 30 - "workspace.tsx"
Cohesion: 0.07
Nodes (44): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+36 more)

### Community 31 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (51): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+43 more)

### Community 32 - "lib/department-budget.ts"
Cohesion: 0.09
Nodes (49): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm() (+41 more)

### Community 33 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 34 - "notifyUser"
Cohesion: 0.07
Nodes (50): BulkShareSheet(), DriveCommentItem, DriveComments(), RespondPanel(), ItemAskPanel(), AdProKind, closeSource(), Common (+42 more)

### Community 35 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 36 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 37 - "training-panel.tsx"
Cohesion: 0.07
Nodes (40): CaseCard(), CaseDocRow, CaseRow, UpRow, codeFromTitle(), CORPUS_IMPORT_EXTS, CorpusImportExt, extOf() (+32 more)

### Community 38 - "budget.ts"
Cohesion: 0.10
Nodes (37): GET(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+29 more)

### Community 39 - "training-board.tsx"
Cohesion: 0.07
Nodes (42): TrainingParticipantRow, TrainingRow, PendingLeave, LeaveItem, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider (+34 more)

### Community 40 - "molecule.ts"
Cohesion: 0.11
Nodes (43): dynamic, MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult (+35 more)

### Community 41 - "admin-request-actions.ts"
Cohesion: 0.08
Nodes (44): RestoreButton(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+36 more)

### Community 42 - "anyRoleFilter"
Cohesion: 0.11
Nodes (39): AffectationsPage(), dynamic, CataloguePage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage() (+31 more)

### Community 43 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 44 - "upload/session.ts"
Cohesion: 0.09
Nodes (39): dynamic, runtime, ingestDossierZipFromFile(), IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng() (+31 more)

### Community 45 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (35): LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), computeCertification(), guardMode() (+27 more)

### Community 46 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 47 - "market-research.ts"
Cohesion: 0.08
Nodes (38): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), analyzeMarketResearch(), buildContext() (+30 more)

### Community 48 - "notifyRoles"
Cohesion: 0.12
Nodes (43): SubmitButton(), runAutopilot(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList() (+35 more)

### Community 49 - "scheduled.ts"
Cohesion: 0.08
Nodes (39): lunaEmbed(), lunaEmbedModel(), searchCorpusAction(), citationsByIds(), CorpusFilters, Row, searchCorpus(), searchCorpusLexical() (+31 more)

### Community 50 - "validation-actions.ts"
Cohesion: 0.08
Nodes (40): RuleControls(), RuleEditor(), decideApproval(), decideAdvance(), addMedicalInfoComment(), cancelDocRequest(), canManage(), fulfillDocRequest() (+32 more)

### Community 51 - "users/[id]/page.tsx"
Cohesion: 0.06
Nodes (32): RoleRowData, RolesTable(), SECONDARY_OPTIONS, AccessMatrix(), ModuleAccessRow, GrantOption, RowGrants(), RowGrantsProps (+24 more)

### Community 52 - "features.ts"
Cohesion: 0.08
Nodes (33): dynamic, metadata, VersionsPage(), VersionsManager(), AssistantPage(), dynamic, TodayPage(), dynamic (+25 more)

### Community 53 - "message-thread.tsx"
Cohesion: 0.09
Nodes (34): MessageAttachments(), Attachments(), ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), Composer() (+26 more)

### Community 54 - "(app)/layout.tsx"
Cohesion: 0.09
Nodes (30): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+22 more)

### Community 55 - "library-actions.ts"
Cohesion: 0.09
Nodes (35): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext, QualityCheck (+27 more)

### Community 56 - "dossier-agent.ts"
Cohesion: 0.10
Nodes (35): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, callClaude(), ClaudeContentBlock (+27 more)

### Community 57 - "dossier-chat.ts"
Cohesion: 0.11
Nodes (34): AiTextResult, askDossier(), buildOverview(), buildPrompt(), cleanAnswer(), DossierChatResult, expandQueryTerms(), READABLE (+26 more)

### Community 58 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 59 - "agent-core.ts"
Cohesion: 0.10
Nodes (25): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+17 more)

### Community 60 - "calendar.ts"
Cohesion: 0.11
Nodes (36): fmtWhen(), CalendarView(), colorOf(), EventForm(), CalendarPage(), dynamic, externalBase(), formatDateTime() (+28 more)

### Community 61 - "assistant.ts"
Cohesion: 0.09
Nodes (38): activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool(), ExecuteResult (+30 more)

### Community 62 - "http.ts"
Cohesion: 0.11
Nodes (28): GET, blockOf(), GET, SCALARS, schema(), GET, ApiContext, authenticate() (+20 more)

### Community 63 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+28 more)

### Community 64 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 65 - "access-actions.ts"
Cohesion: 0.11
Nodes (32): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, deviceIcon(), SessionItem, SessionsList() (+24 more)

### Community 66 - "regulatory-workflow.ts"
Cohesion: 0.08
Nodes (34): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView (+26 more)

### Community 67 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (31): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+23 more)

### Community 68 - "entities.ts"
Cohesion: 0.14
Nodes (26): ASPECTS, GET, GET, GET, RESERVED, GET, coerce(), DEFAULT_LIMIT (+18 more)

### Community 69 - "lib/messaging.ts"
Cohesion: 0.09
Nodes (26): dynamic, GET(), dynamic, GET(), dynamic, POST(), DOT, MyStatus() (+18 more)

### Community 70 - "settings.ts"
Cohesion: 0.10
Nodes (30): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+22 more)

### Community 71 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (28): DocumentEditPage(), dynamic, ENTITY_ROUTE, dynamic, OfficeEmbedPage(), convertNodeToPdf(), convertConfigured(), convertDocument() (+20 more)

### Community 72 - "lib/ai.ts"
Cohesion: 0.11
Nodes (29): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports(), parseIds() (+21 more)

### Community 73 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (29): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+21 more)

### Community 74 - "action-center.ts"
Cohesion: 0.08
Nodes (27): AdminValidationsPage(), dec(), MonTravailPage(), DIRECTIVE_STATUS, DOSSIER_STATUS, MEDICAL_INFO_STATUS, SUPPORT_STATUS, ActionItem (+19 more)

### Community 75 - "mail-client.tsx"
Cohesion: 0.10
Nodes (28): ConnectMailbox(), AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize() (+20 more)

### Community 76 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 77 - "petty-cash-actions.ts"
Cohesion: 0.16
Nodes (25): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+17 more)

### Community 78 - "sectionByCode"
Cohesion: 0.11
Nodes (26): CorpusExtract, queryFor(), SECTION_HINTS, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+18 more)

### Community 79 - "adventum-brain/page.tsx"
Cohesion: 0.11
Nodes (26): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), ageTone(), ProcessIntelligencePage(), diff(), getPulse() (+18 more)

### Community 80 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 81 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 82 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 83 - "field-reports.ts"
Cohesion: 0.10
Nodes (23): dynamic, GET(), dynamic, POST(), dynamic, FieldReportPage(), HBars(), PALETTE (+15 more)

### Community 84 - "budget-forms.tsx"
Cohesion: 0.15
Nodes (26): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard(), CategorySheet() (+18 more)

### Community 85 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 86 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (21): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+13 more)

### Community 87 - "dossier-actions.ts"
Cohesion: 0.17
Nodes (24): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, archiveDossier() (+16 more)

### Community 88 - "drive-actions.ts"
Cohesion: 0.14
Nodes (25): DriveCanvas(), ITEMS, NewKind, ExplorerNav(), SpaceLite, UserLite, FileActions(), ShareRow() (+17 more)

### Community 89 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 90 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 91 - "event-form.tsx"
Cohesion: 0.10
Nodes (22): CreateEventButton(), CreateEventForm(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm() (+14 more)

### Community 92 - "promo-stock-actions.ts"
Cohesion: 0.18
Nodes (24): StockBoard(), StockMovementRow, useRun(), createStockItem(), currentStock(), deleteStockItem(), deleteStockMovement(), KINDS (+16 more)

### Community 93 - "reports.ts"
Cohesion: 0.15
Nodes (20): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+12 more)

### Community 94 - "review-agent.ts"
Cohesion: 0.12
Nodes (20): aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt(), OffsetChunk, splitTextIntoChunks(), AiFinding, AiFindingSchema (+12 more)

### Community 95 - "extract-text.ts"
Cohesion: 0.14
Nodes (19): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+11 more)

### Community 96 - "zip-inspector.ts"
Cohesion: 0.14
Nodes (23): dynamic, maxDuration, runtime, BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf() (+15 more)

### Community 97 - "aiModel"
Cohesion: 0.11
Nodes (22): AiControlCenterPage(), aiModel(), sttConfigured(), probeAi(), base, Certification, CertificationInput, CertificationResult (+14 more)

### Community 98 - "drive/upload/route.ts"
Cohesion: 0.18
Nodes (16): mimeOf(), POST(), POST(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict, formatTiming() (+8 more)

### Community 99 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 100 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 101 - "upload-manager.tsx"
Cohesion: 0.15
Nodes (19): humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob, UploadPhase, UploadProvider() (+11 more)

### Community 102 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 103 - "messenger.tsx"
Cohesion: 0.14
Nodes (21): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+13 more)

### Community 104 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 105 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 106 - "portfolio.ts"
Cohesion: 0.16
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 107 - "extract-facts.ts"
Cohesion: 0.17
Nodes (21): bestStrengthCombo(), comboLinkOk(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText() (+13 more)

### Community 108 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 109 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 110 - "aiFeatureEnabled"
Cohesion: 0.17
Nodes (19): dynamic, POST(), dynamic, POST(), dynamic, POST(), BrainCockpit(), askBrain() (+11 more)

### Community 111 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 112 - "openapi.ts"
Cohesion: 0.17
Nodes (17): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, hasAllScopes() (+9 more)

### Community 113 - "power-tools.ts"
Cohesion: 0.12
Nodes (14): FeedbackPage(), MonEspacePage(), dynamic, metadata, NoAccessPage(), ClaudeToolDef, executePowerTool(), POWER_TOOLS (+6 more)

### Community 114 - "department-budget-actions.ts"
Cohesion: 0.26
Nodes (21): ExpenseRowActions(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), deleteDepartmentExpense(), grantFor(), headedDepartmentIds(), isMyDepartment() (+13 more)

### Community 115 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), AutopilotPayload, congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 116 - "new-request-picker.tsx"
Cohesion: 0.16
Nodes (17): NewRequestPicker(), NewRequestPickerProps, RecordForm(), AdProCreateData, adProOtherCreateFields(), circuitFields(), consultingCreateFields(), DoctorOption (+9 more)

### Community 117 - "business-development/opportunites/page.tsx"
Cohesion: 0.19
Nodes (16): BDPipeline(), STAGES, BDRow, BDTable(), BD_STATUS, BD_TYPE, PRIORITY, buildRegulatoryWorkbook() (+8 more)

### Community 118 - "bd-strategic-table.tsx"
Cohesion: 0.13
Nodes (19): AggNum(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3() (+11 more)

### Community 119 - "moyens-generaux/page.tsx"
Cohesion: 0.17
Nodes (15): BudgetTargetField(), DepartmentSwitcher(), ExpensePanel(), EditableExpense, dynamic, metadata, MoyensGenerauxPage(), CatalogArticle (+7 more)

### Community 120 - "icon.tsx"
Cohesion: 0.23
Nodes (16): OfficeLauncher(), CommandPalette(), Item, SearchResult, OfficePins(), Icon(), IconProps, appOfFile() (+8 more)

### Community 121 - "regulatory-table.tsx"
Cohesion: 0.15
Nodes (17): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryRow, RegulatoryTable() (+9 more)

### Community 122 - "sidebar.tsx"
Cohesion: 0.17
Nodes (16): badgeFor(), FLAT_GROUPS, Sidebar(), SidebarProps, TopbarProps, NavItem, aliasMatches(), groupIntoPoles() (+8 more)

### Community 123 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 124 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 125 - "process-intelligence.ts"
Cohesion: 0.15
Nodes (19): dynamic, GET(), apiErrorMessage(), askClaude(), collectWorkItems(), countMap(), daysSince(), getProcessOverview() (+11 more)

### Community 126 - "brain-cockpit.tsx"
Cohesion: 0.12
Nodes (16): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+8 more)

### Community 127 - "supervision-board.tsx"
Cohesion: 0.21
Nodes (17): SupervisionBoard(), VALIDATION_STEP_STATE, daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, supervisionCounters (+9 more)

### Community 128 - "onboarding-wizard.tsx"
Cohesion: 0.13
Nodes (14): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, OnboardingWizard(), ProfileStep() (+6 more)

### Community 129 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 130 - "unified.ts"
Cohesion: 0.23
Nodes (17): AdProList(), AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest, adProState, APPROVED, countByState() (+9 more)

### Community 131 - "consulting-actions.ts"
Cohesion: 0.31
Nodes (18): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+10 more)

### Community 132 - "rh/departements/page.tsx"
Cohesion: 0.16
Nodes (18): PchTenderPage(), DepartmentsPage(), dynamic, metadata, companyLabel(), flattenTree(), getDepartmentOptions(), getDepartmentTree() (+10 more)

### Community 133 - "general-means.ts"
Cohesion: 0.19
Nodes (16): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+8 more)

### Community 134 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 135 - "read-figures.ts"
Cohesion: 0.16
Nodes (18): BINDING, buildFigureCall(), DEFECT_KINDS, FIGURE_KINDS, FIGURE_SCHEMA, FigureKind, FigureObservation, FigureReport (+10 more)

### Community 136 - "test-center/page.tsx"
Cohesion: 0.15
Nodes (15): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+7 more)

### Community 137 - "hr-dossier.tsx"
Cohesion: 0.17
Nodes (17): HrDossier(), REQ_TO_CAT, CommentItem, MeetingControls(), HrRequestThread(), HR_DOCUMENT_CATEGORY, attachThreads(), getEmployeeHrDossier() (+9 more)

### Community 138 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 139 - "receipt-lines.tsx"
Cohesion: 0.30
Nodes (14): empty(), ReceiptLines(), Row, ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField(), parseQuantity() (+6 more)

### Community 140 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 141 - "tender-lines.tsx"
Cohesion: 0.19
Nodes (15): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+7 more)

### Community 142 - "corpus-actions.ts"
Cohesion: 0.21
Nodes (14): CorpusPanel(), IngestResults, Src, WatchFindings, guard(), IngestActionResult, ingestOneSource(), ingestWave() (+6 more)

### Community 143 - "meetings.ts"
Cohesion: 0.21
Nodes (12): dynamic, PublicMeetPage(), PublicJoin(), genPublicToken(), genSlug(), jitsiDomain(), MeetingAccessShape, publicMeetPath() (+4 more)

### Community 144 - "departments.ts"
Cohesion: 0.18
Nodes (14): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentSubtreeIds(), getDepartmentUserIds() (+6 more)

### Community 145 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 146 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 147 - "canViewDrive"
Cohesion: 0.23
Nodes (12): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), canViewDrive(), buildDriveZip(), Collected (+4 more)

### Community 148 - "org-chart-print.ts"
Cohesion: 0.24
Nodes (11): OrgCanvas(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml(), OrgSvg, PRINT_BOX_H, PRINT_BOX_W (+3 more)

### Community 149 - "(app)/organigramme/page.tsx"
Cohesion: 0.22
Nodes (10): OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), canEditOrgChart() (+2 more)

### Community 150 - "training-actions.ts"
Cohesion: 0.33
Nodes (15): TrainingBoard(), createFieldReport(), attachFiles(), createHrTraining(), deciderFor(), decideTraining(), inviteTrainingParticipants(), isHrOf() (+7 more)

### Community 151 - "doc-request.ts"
Cohesion: 0.25
Nodes (13): DocumentRequestPage(), PiecesPage(), canCancel(), canDecide(), canSubmit(), DocRequestActor, DocRequestMove, DocRequestState (+5 more)

### Community 152 - "simple-pdf.ts"
Cohesion: 0.21
Nodes (14): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+6 more)

### Community 153 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 154 - "meetings/[id]/page.tsx"
Cohesion: 0.15
Nodes (11): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+3 more)

### Community 155 - "company-access.ts"
Cohesion: 0.29
Nodes (12): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+4 more)

### Community 157 - "regulatory-ia/page.tsx"
Cohesion: 0.21
Nodes (11): BudgetRowData, DossierBudgetRow(), Breakdown(), dynamic, fmtDateTime(), fmtUsd(), metadata, RegulatoryIaAdminPage() (+3 more)

### Community 158 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 159 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 160 - "fetch-source.ts"
Cohesion: 0.27
Nodes (10): CatalogSource, extOf(), FetchedSource, fetchSource(), findPdfLink(), get(), htmlToText(), ImportedSection (+2 more)

### Community 161 - "ingest-catalog.ts"
Cohesion: 0.26
Nodes (12): findSource(), ingestCatalogSource(), ingestEverything(), ingestFirstWave(), IngestOneResult, ingestSources(), versionLabel(), watchAnppPages() (+4 more)

### Community 162 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 163 - "ai-health.ts"
Cohesion: 0.23
Nodes (7): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiHealthRun, getLatestAiHealth(), performAiHealthCheck()

### Community 164 - "corpus/page.tsx"
Cohesion: 0.19
Nodes (11): CorpusImport(), dynamic, metadata, SourceRow(), SourceWithVersion, ANPP_WATCH_PAGES, CATALOG, FIRST_WAVE (+3 more)

### Community 165 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 166 - "DriveTable"
Cohesion: 0.30
Nodes (10): DriveTable(), allSelected(), ClickModifiers, clickSelect(), EMPTY_SELECTION, isSelected(), pruneSelection(), selectAll() (+2 more)

### Community 167 - "reserves/actions.ts"
Cohesion: 0.29
Nodes (9): Cycle, Point, RESERVE_TYPES, ReservesPanel(), approveReservePoint(), deleteReserveCycle(), guardPoint(), Result (+1 more)

### Community 168 - "budgets-table.tsx"
Cohesion: 0.22
Nodes (9): BudgetRow, BudgetsTable(), MONTHS, Progress(), ProgressProps, toneClass, BUDGET_CATEGORY, BUDGET_STATUS (+1 more)

### Community 169 - "ConsultingContractPage"
Cohesion: 0.33
Nodes (9): ConsultingContractPage(), ConsultingPage(), billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isOverdue(), MOVES (+1 more)

### Community 170 - "twin-panel.tsx"
Cohesion: 0.20
Nodes (10): Conflict, ConflictRow(), ConflictValue, Fact, FactRow(), METHOD_LABEL, methodLabel(), Occurrence (+2 more)

### Community 171 - "supplier-auth.ts"
Cohesion: 0.27
Nodes (10): SupplierLoginPage(), SupplierPortalPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey() (+2 more)

### Community 172 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 173 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 174 - "pch-tender-export.ts"
Cohesion: 0.29
Nodes (7): boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, TenderExportHeader, TenderExportLine, header

### Community 175 - "onlyoffice/callback/route.ts"
Cohesion: 0.42
Nodes (7): POST(), dynamic, GET(), readDocEditToken(), readEditToken(), PREV, verifyJwt()

### Community 176 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 177 - "typing/route.ts"
Cohesion: 0.31
Nodes (7): dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation(), setTyping()

### Community 178 - "company-actions.ts"
Cohesion: 0.44
Nodes (7): EntitiesManager(), PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 179 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 180 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 181 - "manufacturing-stage.ts"
Cohesion: 0.39
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 182 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 183 - "drive/[id]/edit/page.tsx"
Cohesion: 0.32
Nodes (5): OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic

### Community 184 - "fingerprint.ts"
Cohesion: 0.50
Nodes (6): makePreflight(), FINGERPRINT_MAX_BYTES, FINGERPRINT_MIN_BYTES, fingerprintFile(), shouldFingerprint(), toHex()

### Community 185 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 186 - "entrainement/page.tsx"
Cohesion: 0.29
Nodes (6): CorpusPage(), dynamic, metadata, TrainingPage(), TrainingPanel(), canSeeRegEnrollment()

### Community 187 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 188 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 189 - "reserves/page.tsx"
Cohesion: 0.33
Nodes (3): dynamic, metadata, RegScopeCard()

### Community 190 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 191 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 192 - "audit-table.tsx"
Cohesion: 0.47
Nodes (4): AuditPanel(), AuditRow, AuditTable(), AUDIT_ACTION

### Community 193 - "fields/page.tsx"
Cohesion: 0.40
Nodes (3): FieldDefDTO, CUSTOM_ENTITY_TYPES, CustomValues

### Community 194 - "tender-logistics.tsx"
Cohesion: 0.40
Nodes (5): d10(), LogisticsRow(), Res, TenderLogistics(), PchOrderDTO

### Community 195 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 196 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 197 - "admin/corbeille/page.tsx"
Cohesion: 0.40
Nodes (4): CorbeillePage(), dynamic, TrashItem, TrashList()

### Community 198 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 199 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 200 - "events/[id]/export/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, esc(), GET()

### Community 201 - "MarketPricingPage"
Cohesion: 0.50
Nodes (4): dzd(), fmtPct(), MarketPricingPage(), StatBlock()

## Knowledge Gaps
- **1379 isolated node(s):** `dynamic`, `dynamic`, `dynamic`, `ModuleSpec`, `dynamic` (+1374 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `button.tsx`, `lib/session.ts`, `utils.ts`, `lib/labels.ts`, `userCan`, `getCurrentUser`, `getAppSettings`, `requireUser`, `card.tsx`, `entity-access.ts`, `workflow/engine.ts`, `formatDateTime`, `batch-runner.ts`, `promo-material-actions.ts`, `fdStr`, `mail.ts`, `regAudit`, `medical-directory.tsx`, `toNumber`, `ocr-engine.ts`, `[dossierId]/page.tsx`, `recordAudit`, `drive-storage.ts`, `aiConfigured`, `jobs/runner.ts`, `hasGlobalView`, `events/[id]/page.tsx`, `assistant-actions.ts`, `lib/department-budget.ts`, `notifyUser`, `ad-pro-item-actions.ts`, `care-actions.ts`, `training-panel.tsx`, `budget.ts`, `admin-request-actions.ts`, `anyRoleFilter`, `upload/session.ts`, `test-center/runner.ts`, `market-research.ts`, `notifyRoles`, `scheduled.ts`, `validation-actions.ts`, `users/[id]/page.tsx`, `features.ts`, `(app)/layout.tsx`, `library-actions.ts`, `dossier-agent.ts`, `dossier-chat.ts`, `adoption.ts`, `agent-core.ts`, `calendar.ts`, `assistant.ts`, `http.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `access-actions.ts`, `regulatory-workflow.ts`, `platform-audit/engine.ts`, `entities.ts`, `lib/messaging.ts`, `settings.ts`, `onlyoffice.ts`, `lib/ai.ts`, `pch-tender-line-actions.ts`, `action-center.ts`, `mail-client.tsx`, `microsoft-mail-actions.ts`, `petty-cash-actions.ts`, `adventum-brain/page.tsx`, `src/auth.ts`, `field-reports.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `drive-actions.ts`, `smart-mail-actions.ts`, `event-form.tsx`, `promo-stock-actions.ts`, `reports.ts`, `zip-inspector.ts`, `drive/upload/route.ts`, `progress/query.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `supplier/actions.ts`, `portfolio.ts`, `state-machines/explorer.ts`, `aiFeatureEnabled`, `connection.ts`, `power-tools.ts`, `department-budget-actions.ts`, `risks.ts`, `business-development/opportunites/page.tsx`, `moyens-generaux/page.tsx`, `invariants/registry.ts`, `process-intelligence.ts`, `brain-cockpit.tsx`, `onboarding-wizard.tsx`, `consulting-actions.ts`, `rh/departements/page.tsx`, `general-means.ts`, `test-center/page.tsx`, `hr-dossier.tsx`, `auth-actions.ts`, `receipt-lines.tsx`, `support-actions.ts`, `meetings.ts`, `departments.ts`, `canViewDrive`, `(app)/organigramme/page.tsx`, `training-actions.ts`, `event-actions.ts`, `meetings/[id]/page.tsx`, `stock-snapshot-actions.ts`, `ingest-catalog.ts`, `compare-versions.ts`, `ai-health.ts`, `corpus/page.tsx`, `push.ts`, `reserves/actions.ts`, `supplier-auth.ts`, `reminder-actions.ts`, `onlyoffice/callback/route.ts`, `typing/route.ts`, `company-actions.ts`, `missions.ts`, `entrainement/page.tsx`, `reserves/page.tsx`, `[token]/route.ts`, `fields/page.tsx`, `admin/corbeille/page.tsx`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `utils.ts`, `lib/labels.ts`, `userCan`, `prisma.ts`, `getCurrentUser`, `getAppSettings`, `card.tsx`, `cn`, `entity-access.ts`, `workflow/engine.ts`, `promo-material-actions.ts`, `fdStr`, `regAudit`, `medical-directory.tsx`, `toNumber`, `ocr-engine.ts`, `[dossierId]/page.tsx`, `recordAudit`, `drive-storage.ts`, `hasGlobalView`, `events/[id]/page.tsx`, `assistant-actions.ts`, `lib/department-budget.ts`, `notifyUser`, `ad-pro-item-actions.ts`, `care-actions.ts`, `training-panel.tsx`, `budget.ts`, `molecule.ts`, `admin-request-actions.ts`, `test-center/runner.ts`, `config.ts`, `notifyRoles`, `scheduled.ts`, `validation-actions.ts`, `features.ts`, `(app)/layout.tsx`, `library-actions.ts`, `dossier-agent.ts`, `calendar.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `access-actions.ts`, `platform-audit/engine.ts`, `lib/messaging.ts`, `settings.ts`, `onlyoffice.ts`, `lib/ai.ts`, `pch-tender-line-actions.ts`, `mail-client.tsx`, `microsoft-mail-actions.ts`, `petty-cash-actions.ts`, `dossier-actions.ts`, `drive-actions.ts`, `smart-mail-actions.ts`, `promo-stock-actions.ts`, `reports.ts`, `lifecycle/actions.ts`, `messenger.tsx`, `supplier/actions.ts`, `aiFeatureEnabled`, `power-tools.ts`, `department-budget-actions.ts`, `brain-cockpit.tsx`, `onboarding-wizard.tsx`, `consulting-actions.ts`, `auth-actions.ts`, `support-actions.ts`, `tender-lines.tsx`, `corpus-actions.ts`, `(app)/organigramme/page.tsx`, `training-actions.ts`, `doc-request.ts`, `event-actions.ts`, `stock-snapshot-actions.ts`, `ai-health.ts`, `reserves/actions.ts`, `reminder-actions.ts`, `company-actions.ts`, `drive/[id]/edit/page.tsx`, `missions.ts`, `admin/corbeille/page.tsx`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `button.tsx`, `lib/session.ts`, `utils.ts`, `lib/labels.ts`, `prisma.ts`, `getAppSettings`, `requireUser`, `card.tsx`, `cn`, `entity-access.ts`, `formatDateTime`, `promo-material-actions.ts`, `fdStr`, `mail.ts`, `medical-directory.tsx`, `toNumber`, `ocr-engine.ts`, `recordAudit`, `drive-storage.ts`, `hasGlobalView`, `events/[id]/page.tsx`, `assistant-actions.ts`, `lib/department-budget.ts`, `notifyUser`, `ad-pro-item-actions.ts`, `care-actions.ts`, `budget.ts`, `molecule.ts`, `admin-request-actions.ts`, `anyRoleFilter`, `market-research.ts`, `notifyRoles`, `validation-actions.ts`, `(app)/layout.tsx`, `adoption.ts`, `calendar.ts`, `assistant.ts`, `http.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `access-actions.ts`, `regulatory-workflow.ts`, `entities.ts`, `lib/messaging.ts`, `onlyoffice.ts`, `lib/ai.ts`, `pch-tender-line-actions.ts`, `action-center.ts`, `mail-client.tsx`, `petty-cash-actions.ts`, `adventum-brain/page.tsx`, `field-reports.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `drive-actions.ts`, `promo-stock-actions.ts`, `aiModel`, `drive/upload/route.ts`, `aiFeatureEnabled`, `openapi.ts`, `power-tools.ts`, `department-budget-actions.ts`, `business-development/opportunites/page.tsx`, `moyens-generaux/page.tsx`, `process-intelligence.ts`, `consulting-actions.ts`, `rh/departements/page.tsx`, `general-means.ts`, `test-center/page.tsx`, `support-actions.ts`, `tender-lines.tsx`, `(app)/organigramme/page.tsx`, `training-actions.ts`, `doc-request.ts`, `event-actions.ts`, `stock-snapshot-actions.ts`, `ai-health.ts`, `ConsultingContractPage`, `reminder-actions.ts`, `typing/route.ts`, `company-actions.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `dynamic`, `dynamic`, `dynamic` to the rest of the system?**
  _1379 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.029548332629801603 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03841067218676327 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05141164168699895 - nodes in this community are weakly interconnected._