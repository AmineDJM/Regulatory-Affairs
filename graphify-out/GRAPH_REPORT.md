# Graph Report - src  (2026-08-24)

## Corpus Check
- 1375 files · ~1,137,806 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 8452 nodes · 33274 edges · 256 communities (248 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `33e2bd79`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- prisma.ts
- button.tsx
- utils.ts
- jobs/runner.ts
- requireModule
- userCan
- fdStr
- getCurrentUser
- getAppSettings
- requireUser
- lib/labels.ts
- notifyUser
- medical-directory-actions.ts
- toNumber
- getMyCompanies
- upload/session.ts
- resolveDriveAccess
- drive-storage.ts
- dossier-agent.ts
- assistant.ts
- [dossierId]/page.tsx
- budget-forms.tsx
- cn
- aiConfigured
- formatCurrency
- build-facts.ts
- recordAudit
- meeting-actions.ts
- training-actions.ts
- rules/engine.ts
- entities.ts
- departments.ts
- regAudit
- corpus-actions.ts
- admin-request-actions.ts
- FindingInput
- care-actions.ts
- payment-request-actions.ts
- openai-luna.ts
- workflow/engine.ts
- rbac.ts
- oauth.ts
- onlyoffice.ts
- actions/types.ts
- formatDate
- reserves/page.tsx
- agent-core.ts
- mistral-ocr.ts
- test-center/runner.ts
- ocr-engine.ts
- entity-access.ts
- calendar.ts
- drive/page.tsx
- promo-material-actions.ts
- letterhead-manager.tsx
- training-board.tsx
- legal-actions.ts
- congress-request-actions.ts
- OpenAIGptRealtime21Provider
- market-research.ts
- adoption.ts
- admin-settings-forms.tsx
- hasGlobalView
- new-request-picker.tsx
- lib/ai.ts
- lib/department-budget.ts
- topbar.tsx
- voice-realtime.ts
- dossier-actions.ts
- drive-actions.ts
- messenger.tsx
- messaging-actions.ts
- graph/provider.ts
- brain-cockpit.tsx
- (app)/layout.tsx
- regulatory-workflow.ts
- stock-board.tsx
- platform-audit/engine.ts
- demandes/page.tsx
- pilotage/page.tsx
- pch-tender-line-actions.ts
- mail.ts
- centre-board.tsx
- Module
- general-means.ts
- memory-tools.ts
- queries/messaging.ts
- create-record-button.tsx
- composer.tsx
- recruitment/request-flow.ts
- upload-manager.tsx
- replay-viewer.tsx
- api/auth.ts
- (app)/organigramme/page.tsx
- bd-strategic-table.tsx
- competition.ts
- form-fields.tsx
- microsoft-mail-actions.ts
- payment-authority.ts
- workflow-builder.tsx
- medical-info-actions.ts
- ad-pro-item-actions.ts
- drive-table.tsx
- molecule-panel.tsx
- ingest-case.ts
- items-panel.tsx
- featureEnabled
- smart-mail-actions.ts
- SessionUser
- molecule.ts
- client.ts
- extract-text.ts
- adventum-actions.ts
- onboarding-wizard.tsx
- expense-row-actions.tsx
- reports.ts
- support-actions.ts
- department-budget-actions.ts
- queries/drive.ts
- scheduled.ts
- state-machines/explorer.ts
- ad-pro.ts
- congress-international/[id]/page.tsx
- products.ts
- progress/query.ts
- update-reminder.ts
- regulatory-table.tsx
- medical-actions.ts
- zip-inspector.ts
- migration-cert.ts
- connection.ts
- corpus/actions.ts
- catalog-normalize.ts
- tasks/request-flow.ts
- company.ts
- sheet-import.ts
- test-center/types.ts
- mon-dossier/page.tsx
- invariants/registry.ts
- mail-client.tsx
- identity-board.tsx
- enregistrement/page.tsx
- portfolio.ts
- risks.ts
- deliverables.ts
- drive-search.ts
- reply.ts
- write.ts
- getMarketData
- getMailAccount
- access-actions.ts
- executive-brief-tools.ts
- gammes/page.tsx
- workspace.tsx
- recrutement/[id]/page.tsx
- legal/lifecycle.ts
- create-fields.ts
- consulting-actions.ts
- document-preview.tsx
- pch.ts
- lifecycle/actions.ts
- regulatory/page.tsx
- invoice-actions.ts
- exports.ts
- validations/paiements/[id]/page.tsx
- receipt-lines.tsx
- anyRoleFilter
- src/auth.ts
- MicrosoftGraphMailProvider
- mail-folder-bar.tsx
- upload-button.tsx
- field-report-actions.ts
- product-catalog.ts
- process-intelligence.ts
- regulatory/export/route.ts
- department-budget-table.tsx
- lib/ad-pro-edit.ts
- MailProvider
- search-everything.ts
- classify.ts
- compare-versions.ts
- s3-config.ts
- pch/export/route.ts
- radar.ts
- lib/messaging.ts
- contacts-board.tsx
- stock-snapshot-actions.ts
- structural-fields.ts
- withImap
- simple-pdf.ts
- decompose.ts
- messaging/messages/route.ts
- supplier-auth.ts
- background-upload.tsx
- pipeline-access.ts
- push.ts
- file-glyph.tsx
- reminder-actions.ts
- entites/page.tsx
- congress-workflow.tsx
- validation-item-review.tsx
- payroll-cost.ts
- rbac-sheet.test.ts
- grouping.ts
- database-admin-actions.ts
- api/workflow.ts
- assistant-files.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- calendar-view.tsx
- drive-space-manager.tsx
- zip-viewer.tsx
- teams-manager.tsx
- training-panel.tsx
- hr-dossier.tsx
- client-bundle-guard.test.ts
- readers.ts
- new-conversation.tsx
- forecast-grid.tsx
- (auth)/login/login-form.tsx
- change-password-form.tsx
- push-register.tsx
- login-throttle.ts
- courses-board.tsx
- assignment-matrix.tsx
- corpus-import.tsx
- bv-requests.tsx
- employee-form.tsx
- messages-indicator.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- admin/corbeille/page.tsx
- roles-table.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- auth-actions.ts
- geo.ts
- mission-stops.tsx
- reserves-panel.tsx
- validation-decision.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 820 edges
2. `userCan()` - 636 edges
3. `fdStr()` - 608 edges
4. `recordAudit()` - 562 edges
5. `prisma` - 519 edges
6. `requireModule()` - 262 edges
7. `hasGlobalView()` - 223 edges
8. `Button` - 200 edges
9. `cn()` - 185 edges
10. `toNumber()` - 185 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `buildFolderTree()` --indirect_call--> `node()`  [INFERRED]
  src/lib/legal/folders.ts → src/lib/org-chart-print.test.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (256 total, 8 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.03
Nodes (135): dynamic, AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, ActivityTable(), ActivityPage() (+127 more)

### Community 1 - "prisma.ts"
Cohesion: 0.03
Nodes (88): dynamic, GET(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+80 more)

### Community 2 - "button.tsx"
Cohesion: 0.04
Nodes (90): DriveStorageSettings(), PALETTE, OrgBranch(), Citation, Source, Version, StoragePanel(), ENV_LABEL (+82 more)

### Community 3 - "utils.ts"
Cohesion: 0.05
Nodes (102): dynamic, ModuleSpec, dynamic, TYPES, AdminPage(), fmtBytes(), fmtWhen(), ACTION_COLS (+94 more)

### Community 4 - "jobs/runner.ts"
Cohesion: 0.03
Nodes (120): fetchBatchOutput(), getBatchStatus(), lunaCostUsd(), lunaModel(), parseBatchOutput(), readUsage(), submitBatch(), aiChunkChars() (+112 more)

### Community 5 - "requireModule"
Cohesion: 0.04
Nodes (96): AdProPage(), dynamic, AdminWorkflowsPage(), dynamic, BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage() (+88 more)

### Community 6 - "userCan"
Cohesion: 0.03
Nodes (105): POST(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR (+97 more)

### Community 7 - "fdStr"
Cohesion: 0.05
Nodes (107): ActiveToggle(), EditTransactionSheet(), CancelButton(), CancelButton(), createMission(), updateAiSettings(), computeStatus(), createBudget() (+99 more)

### Community 8 - "getCurrentUser"
Cohesion: 0.04
Nodes (91): dynamic, GET(), dynamic, NO_CONTENT, POST(), DELETE(), dynamic, POST() (+83 more)

### Community 9 - "getAppSettings"
Cohesion: 0.04
Nodes (88): POST(), dynamic, POST(), dynamic, POST(), dynamic, POST(), DatabasesPage() (+80 more)

### Community 10 - "requireUser"
Cohesion: 0.04
Nodes (106): CorbeillePage(), FieldsManager(), ShareRow(), Messenger(), delegateOf(), deleteOwnRecord(), isKind(), restoreDeletedRecord() (+98 more)

### Community 11 - "lib/labels.ts"
Cohesion: 0.03
Nodes (92): ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), FieldDefDTO, CustomFieldsPage() (+84 more)

### Community 12 - "notifyUser"
Cohesion: 0.05
Nodes (89): EventDetail(), EventForm(), RevisionRequest(), RequestRow(), addRequestComment(), runAutopilot(), createCalendarEvent(), deleteCalendarEvent() (+81 more)

### Community 13 - "medical-directory-actions.ts"
Cohesion: 0.05
Nodes (78): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, Question, Req (+70 more)

### Community 14 - "toNumber"
Cohesion: 0.04
Nodes (83): AdProOtherDetailPage(), AdminValidationsPage(), dec(), ConsultingContractPage(), FeedbackPage(), FormationsPage(), DeclarationDetailPage(), dynamic (+75 more)

### Community 15 - "getMyCompanies"
Cohesion: 0.05
Nodes (79): AdProOtherPage(), ConsultingPage(), dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput(), dateTimeInput(), mailFields() (+71 more)

### Community 16 - "upload/session.ts"
Cohesion: 0.05
Nodes (87): dynamic, POST(), dynamic, GET(), runtime, dynamic, POST(), runtime (+79 more)

### Community 17 - "resolveDriveAccess"
Cohesion: 0.05
Nodes (60): GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), mimeOf(), POST(), POST() (+52 more)

### Community 18 - "drive-storage.ts"
Cohesion: 0.05
Nodes (67): addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), blobChunkBytes(), blobKey(), encryptFileStream() (+59 more)

### Community 19 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (70): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, ClaudeContentBlock (+62 more)

### Community 20 - "assistant.ts"
Cohesion: 0.05
Nodes (71): ClaudeToolDef, ACTION_POLICY, activeUserId(), describeChange(), parseRegFieldValue(), ParseResult, parseSettingValue(), regFieldSpec (+63 more)

### Community 21 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (64): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+56 more)

### Community 22 - "budget-forms.tsx"
Cohesion: 0.05
Nodes (62): GET(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+54 more)

### Community 23 - "cn"
Cohesion: 0.03
Nodes (61): AdProList(), AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, AiSettings (+53 more)

### Community 24 - "aiConfigured"
Cohesion: 0.07
Nodes (61): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+53 more)

### Community 25 - "formatCurrency"
Cohesion: 0.05
Nodes (57): CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt, BudgetRow, BudgetsTable(), MONTHS, Budget() (+49 more)

### Community 26 - "build-facts.ts"
Cohesion: 0.06
Nodes (58): extractLooseJson(), repairAndParse(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS (+50 more)

### Community 27 - "recordAudit"
Cohesion: 0.06
Nodes (58): EntitiesManager(), PALETTE, PersonSheet(), ProductPicker(), RangeSheet(), ImpersonateButton(), SpaceSettingsButton(), resetActivityTime() (+50 more)

### Community 28 - "meeting-actions.ts"
Cohesion: 0.05
Nodes (59): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+51 more)

### Community 29 - "training-actions.ts"
Cohesion: 0.07
Nodes (62): OtherDecisionPanel(), TrainingBoard(), DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), audit(), closeAdProOtherRequest() (+54 more)

### Community 30 - "rules/engine.ts"
Cohesion: 0.06
Nodes (53): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+45 more)

### Community 31 - "entities.ts"
Cohesion: 0.07
Nodes (49): GET, ASPECTS, GET, GET, GET, RESERVED, blockOf(), GET (+41 more)

### Community 32 - "departments.ts"
Cohesion: 0.07
Nodes (53): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), DepartmentsManager(), DeptSheet() (+45 more)

### Community 33 - "regAudit"
Cohesion: 0.07
Nodes (47): AgentItem, AgentsPanel(), RunState, FindingControls(), Props, statusLabel(), Props, Conflict (+39 more)

### Community 34 - "corpus-actions.ts"
Cohesion: 0.07
Nodes (51): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+43 more)

### Community 35 - "admin-request-actions.ts"
Cohesion: 0.06
Nodes (55): RuleControls(), RuleEditor(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+47 more)

### Community 36 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 37 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 38 - "payment-request-actions.ts"
Cohesion: 0.10
Nodes (51): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, addPaymentComment() (+43 more)

### Community 39 - "openai-luna.ts"
Cohesion: 0.07
Nodes (49): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+41 more)

### Community 40 - "workflow/engine.ts"
Cohesion: 0.07
Nodes (48): Props, isManagerOfUser(), BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), loadOutcome(), synthesizeCreationEvent() (+40 more)

### Community 41 - "rbac.ts"
Cohesion: 0.05
Nodes (44): BusinessDevelopmentPipelinePage(), StocksPage(), SnapshotDTO, NAV_LEGACY_LABELS, DirectiveDetail, getDirectives(), getProductOptions(), ProductOption (+36 more)

### Community 42 - "oauth.ts"
Cohesion: 0.09
Nodes (40): dynamic, GET(), logFailure(), Stage, dynamic, GET(), DisconnectButton(), dynamic (+32 more)

### Community 43 - "onlyoffice.ts"
Cohesion: 0.10
Nodes (40): POST(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage() (+32 more)

### Community 44 - "actions/types.ts"
Cohesion: 0.09
Nodes (41): DriveComments(), PromoCircuitCard(), Props, useRun(), deleteDriveComment(), postDriveComment(), completePromoTrack(), markQuoteReceived() (+33 more)

### Community 45 - "formatDate"
Cohesion: 0.06
Nodes (39): dynamic, FocusCard(), TodayPage(), DateCell(), AssistantPage(), dynamic, EventsPage(), LogisticsRow (+31 more)

### Community 46 - "reserves/page.tsx"
Cohesion: 0.08
Nodes (38): dynamic, metadata, PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, RegScopeCard(), enrichFinding() (+30 more)

### Community 47 - "agent-core.ts"
Cohesion: 0.07
Nodes (33): extractJson(), lunaEmbed(), lunaEmbedModel(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult (+25 more)

### Community 48 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 49 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (38): LaunchPanel(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard(), base, Certification (+30 more)

### Community 50 - "ocr-engine.ts"
Cohesion: 0.08
Nodes (38): analyzeEmployeeContract(), CONTRACT_TYPES_UP, defaultOcrLangs(), ensureLangData(), ocrCacheDir(), require, SUPPORTED, canOcr() (+30 more)

### Community 51 - "entity-access.ts"
Cohesion: 0.09
Nodes (40): GET(), SearchPage(), ENTITY_MODULE, isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection() (+32 more)

### Community 52 - "calendar.ts"
Cohesion: 0.09
Nodes (35): CalendarPage(), dynamic, EXECUTIVE_READ_TOOLS, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+27 more)

### Community 53 - "drive/page.tsx"
Cohesion: 0.11
Nodes (35): DriveCanvas(), ITEMS, NewKind, DriveSearch(), DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage() (+27 more)

### Community 54 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 55 - "letterhead-manager.tsx"
Cohesion: 0.08
Nodes (33): TYPES, EditSheet(), IconAction(), KINDS, UploadSheet(), ChoiceTile(), LetterheadChoice(), s() (+25 more)

### Community 56 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 57 - "legal-actions.ts"
Cohesion: 0.09
Nodes (39): MailPieces(), AttachToSourceButtons(), decideApproval(), decideAdvance(), attachDriveNodeToLegal(), cancelLegalDocument(), checkChainFrom(), createLegalDocument() (+31 more)

### Community 58 - "congress-request-actions.ts"
Cohesion: 0.12
Nodes (38): EditEventButton(), RegistrationsManager(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList() (+30 more)

### Community 59 - "OpenAIGptRealtime21Provider"
Cohesion: 0.08
Nodes (19): OpenAIGptRealtime21Provider, ProviderOptions, RealtimeEvent, VoiceCallState, VoiceProviderCallbacks, VoiceRealtimeProvider, VoiceSessionGrant, VoiceToolUi (+11 more)

### Community 60 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 61 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 62 - "admin-settings-forms.tsx"
Cohesion: 0.09
Nodes (34): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+26 more)

### Community 63 - "hasGlobalView"
Cohesion: 0.10
Nodes (33): CorbeillePage(), DirectiveDetailPage(), TaskWorkPanel(), CashPanel(), key(), isKind(), TARGETS, updateAdProRequest() (+25 more)

### Community 64 - "new-request-picker.tsx"
Cohesion: 0.11
Nodes (26): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton() (+18 more)

### Community 65 - "lib/ai.ts"
Cohesion: 0.09
Nodes (28): runAiHealthCheckNow(), AiHealthCheckButton(), generateBriefing(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock, apiErrorMessage() (+20 more)

### Community 66 - "lib/department-budget.ts"
Cohesion: 0.14
Nodes (31): DepartmentBudgetTable(), DepartmentBudgetsPage(), dynamic, allocatedOf(), BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget() (+23 more)

### Community 67 - "topbar.tsx"
Cohesion: 0.12
Nodes (28): Company, CompanySwitcher(), isActive(), MobileTabBar(), PRIMARY, Tile(), badgeFor(), navPaths() (+20 more)

### Community 68 - "voice-realtime.ts"
Cohesion: 0.09
Nodes (30): dynamic, EVENTS, POST(), runtime, dynamic, POST(), runtime, dynamic (+22 more)

### Community 69 - "dossier-actions.ts"
Cohesion: 0.13
Nodes (30): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+22 more)

### Community 70 - "drive-actions.ts"
Cohesion: 0.11
Nodes (26): ConvertPdfButton(), DriveCommentItem, FileActions(), ShareItem, SharePanel(), AccessSheet(), MoveTarget, NodeActions() (+18 more)

### Community 71 - "messenger.tsx"
Cohesion: 0.11
Nodes (30): SendPayload, ConvAvatar(), ConversationList(), Filter, Props, buildInlineRegex(), dayLabel(), escapeRegExp() (+22 more)

### Community 72 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (34): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+26 more)

### Community 73 - "graph/provider.ts"
Cohesion: 0.13
Nodes (27): FOLDER_LABEL, GRAPH_WELL_KNOWN, ORDER, wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw (+19 more)

### Community 74 - "brain-cockpit.tsx"
Cohesion: 0.08
Nodes (28): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+20 more)

### Community 75 - "(app)/layout.tsx"
Cohesion: 0.09
Nodes (24): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+16 more)

### Community 76 - "regulatory-workflow.ts"
Cohesion: 0.11
Nodes (31): RegulatoryProcess(), STATE_OPTS, StepNote(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP, PRESUB_GATE_STEP, presubOutcome() (+23 more)

### Community 77 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 78 - "platform-audit/engine.ts"
Cohesion: 0.11
Nodes (30): buildPrompt(), fmtFinding(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL, groupByViewSignature(), HealthProbe (+22 more)

### Community 79 - "demandes/page.tsx"
Cohesion: 0.10
Nodes (24): ApprovalButtons(), ApprovalsPage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), ExpenseAckItem, ExpenseAckList() (+16 more)

### Community 80 - "pilotage/page.tsx"
Cohesion: 0.15
Nodes (28): AffectationsPage(), dynamic, dynamic, PlanningPage(), dynamic, pct(), PilotagePage(), toneOf() (+20 more)

### Community 81 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (29): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+21 more)

### Community 82 - "mail.ts"
Cohesion: 0.07
Nodes (32): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, encryptSecret(), IMAP_IDLE_MS, imapChains (+24 more)

### Community 83 - "centre-board.tsx"
Cohesion: 0.17
Nodes (27): CentreBoard(), CentreMessage, CentreOrder, TONE, CentreDePaiementPage(), dynamic, metadata, decidePayment() (+19 more)

### Community 84 - "Module"
Cohesion: 0.13
Nodes (27): LeaveItem, StandInState, Target, actsFor(), day(), delegatedActions(), Delegation, delegationNotice() (+19 more)

### Community 85 - "general-means.ts"
Cohesion: 0.11
Nodes (27): nextRechargeFor(), runPettyCashRechargeReminders(), currentPeriod(), grantedTopUpAmount(), LOW_CASH_RATIO, MAX_RECHARGE_DAY, MONTHS_FR, nextRechargeDate() (+19 more)

### Community 86 - "memory-tools.ts"
Cohesion: 0.09
Nodes (23): excerptAround(), tokensOf(), aliasOf(), AliasPair, expandQueryWithAliases(), foldText(), isMemoryType(), MEMORY_TYPE_LABEL (+15 more)

### Community 87 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+19 more)

### Community 88 - "create-record-button.tsx"
Cohesion: 0.09
Nodes (21): EditMailButton(), Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, EditLegalButton() (+13 more)

### Community 89 - "composer.tsx"
Cohesion: 0.12
Nodes (25): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), DriveRef, Pending, Props, UploadedAttachment (+17 more)

### Community 90 - "recruitment/request-flow.ts"
Cohesion: 0.13
Nodes (26): RecruitmentPage(), NewRecruitmentButton(), ApprovalState, CANDIDATE_LABEL, CANDIDATE_ORDER, candidateRank(), CandidateStatus, ChainDecider (+18 more)

### Community 91 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 92 - "replay-viewer.tsx"
Cohesion: 0.16
Nodes (24): NO_CONTENT, POST(), asCaptured(), ICON, ReplayEvent, ReplaySession, ReplayViewer(), labelOf() (+16 more)

### Community 93 - "api/auth.ts"
Cohesion: 0.15
Nodes (21): GET, GET(), authenticate(), generateApiKey(), hashApiKey(), readBearer(), sameHash(), buildOpenApi() (+13 more)

### Community 94 - "(app)/organigramme/page.tsx"
Cohesion: 0.12
Nodes (21): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), canEditOrgChart() (+13 more)

### Community 95 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 96 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 97 - "form-fields.tsx"
Cohesion: 0.12
Nodes (21): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow (+13 more)

### Community 98 - "microsoft-mail-actions.ts"
Cohesion: 0.14
Nodes (26): AttachmentBar(), Composer(), listStamp(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm() (+18 more)

### Community 99 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 100 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 101 - "medical-info-actions.ts"
Cohesion: 0.18
Nodes (24): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+16 more)

### Community 102 - "ad-pro-item-actions.ts"
Cohesion: 0.21
Nodes (28): ItemLifecycle(), addAdProItem(), AdProModule, approveAdProItemOrder(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED (+20 more)

### Community 103 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 104 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (21): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+13 more)

### Community 105 - "ingest-case.ts"
Cohesion: 0.16
Nodes (22): CaseCard(), codeFromTitle(), CORPUS_IMPORT_EXTS, CorpusImportExt, extOf(), FileIngestResult, FileIngestStatus, isImportableExt() (+14 more)

### Community 106 - "items-panel.tsx"
Cohesion: 0.14
Nodes (21): AdProItemsPanel(), EditItemForm(), ItemRow, PARENT_PATH, Props, AD_PRO_PARENTS, AdProParent, breakdown (+13 more)

### Community 107 - "featureEnabled"
Cohesion: 0.13
Nodes (21): dynamic, maxDuration, runtime, dynamic, metadata, VersionsPage(), Group(), STAGE (+13 more)

### Community 108 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 109 - "SessionUser"
Cohesion: 0.12
Nodes (19): GET, POST, ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), describeOperations(), getOperation(), OperationDef (+11 more)

### Community 110 - "molecule.ts"
Cohesion: 0.18
Nodes (24): SuggestField(), marketSuggestions(), canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES, GALENIC_FORMS (+16 more)

### Community 111 - "client.ts"
Cohesion: 0.16
Nodes (21): buildUrl(), correlationId(), DELTA_EXPIRED, graphBinary(), graphJson(), graphRaw(), GraphRequest, HUMAN (+13 more)

### Community 112 - "extract-text.ts"
Cohesion: 0.14
Nodes (19): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+11 more)

### Community 113 - "adventum-actions.ts"
Cohesion: 0.16
Nodes (20): RelationsTab(), AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), DENIED, searchRelations(), updateRiskThresholds() (+12 more)

### Community 114 - "onboarding-wizard.tsx"
Cohesion: 0.10
Nodes (19): ConnectMailbox(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep() (+11 more)

### Community 115 - "expense-row-actions.tsx"
Cohesion: 0.16
Nodes (20): BudgetTargetField(), ExpensePanel(), EditableExpense, ExpenseRowActions(), CatalogArticle, ExistingLine, deleteDepartmentExpense(), BudgetTarget (+12 more)

### Community 116 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 117 - "support-actions.ts"
Cohesion: 0.17
Nodes (21): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+13 more)

### Community 118 - "department-budget-actions.ts"
Cohesion: 0.23
Nodes (23): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget() (+15 more)

### Community 119 - "queries/drive.ts"
Cohesion: 0.15
Nodes (22): browseDrive(), BrowseNode, BrowseResult, EMPTY, DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow (+14 more)

### Community 120 - "scheduled.ts"
Cohesion: 0.14
Nodes (23): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+15 more)

### Community 121 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 122 - "ad-pro.ts"
Cohesion: 0.18
Nodes (21): EMPTY, Filters, NewRequestPickerProps, AdProCreateData, AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest (+13 more)

### Community 123 - "congress-international/[id]/page.tsx"
Cohesion: 0.29
Nodes (22): CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), AdProEditButton(), AdProTransferButton(), promoMaterialOptions() (+14 more)

### Community 124 - "products.ts"
Cohesion: 0.16
Nodes (22): dynamic, metadata, ProductExplorerPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts() (+14 more)

### Community 125 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 126 - "update-reminder.ts"
Cohesion: 0.18
Nodes (20): RegulatoryPage(), sendRegulatoryUpdateReminder(), effectiveTherapeuticSegments(), regulatoryReminderBoard(), canSendUpdateReminder(), daysSince(), isStaleDossier(), remindedRecently() (+12 more)

### Community 127 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (18): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryTable(), STAGE_CLASS (+10 more)

### Community 128 - "medical-actions.ts"
Cohesion: 0.14
Nodes (24): createDoctor(), createInstitution(), createSpecialty(), createVisit(), deleteDoctor(), deleteInstitution(), deleteSpecialty(), deleteVisit() (+16 more)

### Community 129 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 130 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 131 - "connection.ts"
Cohesion: 0.18
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 132 - "corpus/actions.ts"
Cohesion: 0.16
Nodes (18): CorpusAdmin(), CorpusImport(), canManage(), createCorpusSourceVersion(), importCorpusFileAction(), Result, searchCorpusAction(), seedAnppCorpus() (+10 more)

### Community 133 - "catalog-normalize.ts"
Cohesion: 0.18
Nodes (22): NormalizePanel(), applyCatalogNormalization(), previewCatalogNormalization(), refresh(), ACRONYMS, ArticleFields, articleKey(), capitalizeWord() (+14 more)

### Community 134 - "tasks/request-flow.ts"
Cohesion: 0.19
Nodes (22): TaskDossierPage(), ACCEPTED_STATUS, awaitingResponse(), canAttach(), canComment(), canDoWork(), canRespond(), canSee() (+14 more)

### Community 135 - "company.ts"
Cohesion: 0.21
Nodes (19): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+11 more)

### Community 136 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 137 - "test-center/types.ts"
Cohesion: 0.14
Nodes (17): guardMode(), GuardResult, resolveEnvironment(), CleanupResult, deleteOne(), DELETERS, EXISTS, isNotFound() (+9 more)

### Community 138 - "mon-dossier/page.tsx"
Cohesion: 0.13
Nodes (20): dynamic, MonDossierPage(), LeaveRequestButton(), MyLeaves(), HrRequestThread(), HR_DOCUMENT_CATEGORY, HR_REQUEST_STATUS, HR_REQUEST_TYPE (+12 more)

### Community 139 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 140 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 141 - "identity-board.tsx"
Cohesion: 0.18
Nodes (16): CopyButton(), IdentityBoard(), IdentityCompany, IdentitySheet(), dynamic, LegalIdentitiesPage(), COMPANY_DOC_CATEGORIES, CompanyDocCategory (+8 more)

### Community 142 - "enregistrement/page.tsx"
Cohesion: 0.16
Nodes (20): dynamic, metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS, DECISION_RULES, FEE_SPECIAL_CASES (+12 more)

### Community 143 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 144 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 145 - "deliverables.ts"
Cohesion: 0.14
Nodes (16): clean(), DELIVERABLE_FORMATS, DELIVERABLE_TOOLS, DeliverableFormat, DeliverableSection, DeliverableSpec, docxP(), docxTable() (+8 more)

### Community 146 - "drive-search.ts"
Cohesion: 0.19
Nodes (18): describePath(), fold(), matchesQuery(), MIN_QUERY, normalizeQuery(), rankHit(), SearchHit, searchSummary() (+10 more)

### Community 147 - "reply.ts"
Cohesion: 0.18
Nodes (18): MailAddress, buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock() (+10 more)

### Community 148 - "write.ts"
Cohesion: 0.18
Nodes (19): describeMailChanges(), diffMailAssignments(), diffMailEntry(), MAIL_ASSIGNMENT_FIELDS, MAIL_TRACKED_FIELDS, MailAssignmentField, MailAssignments, MailChange (+11 more)

### Community 149 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 150 - "getMailAccount"
Cohesion: 0.15
Nodes (18): dynamic, GET(), dynamic, GET(), dynamic, GET(), friendlyMailError(), getAttachment() (+10 more)

### Community 151 - "access-actions.ts"
Cohesion: 0.20
Nodes (19): RowGrants(), ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), RevokeAllButton(), adminResetPassword() (+11 more)

### Community 152 - "executive-brief-tools.ts"
Cohesion: 0.12
Nodes (9): EXECUTIVE_BRIEF_TOOLS, AlertCriticality, days(), detectExecutiveAlerts(), ExecutiveAlert, RANK, monthlyPayroll(), WHAT_IF_TOOLS (+1 more)

### Community 153 - "gammes/page.tsx"
Cohesion: 0.16
Nodes (16): dynamic, GammesPage(), PeoplePanel(), PersonRow, ProductOption, RangesManager(), buildRangeTree(), canSeeProduct() (+8 more)

### Community 154 - "workspace.tsx"
Cohesion: 0.28
Nodes (16): DocumentWorkspace(), OpenDoc, Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W (+8 more)

### Community 155 - "recrutement/[id]/page.tsx"
Cohesion: 0.22
Nodes (15): APPROVAL_ICON, APPROVAL_TEXT, DOC_CATEGORIES, dynamic, AddCandidateButton(), AnswerInfoForm(), CancelRequestButton(), CandidateActions() (+7 more)

### Community 156 - "legal/lifecycle.ts"
Cohesion: 0.22
Nodes (15): LegalSweepResult, runLegalExpirySweep(), canCancel(), canRenew(), daysBetween(), daysLeft(), expiryLevel, expiryMessage() (+7 more)

### Community 157 - "create-fields.ts"
Cohesion: 0.16
Nodes (15): NewRequestPicker(), adProOtherCreateFields(), circuitFields(), consultingCreateFields(), DoctorOption, optionsOf(), PersonOption, promoMaterialCreateFields() (+7 more)

### Community 158 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 159 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 160 - "pch.ts"
Cohesion: 0.16
Nodes (17): PchTenderPage(), d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail() (+9 more)

### Community 161 - "lifecycle/actions.ts"
Cohesion: 0.23
Nodes (16): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+8 more)

### Community 162 - "regulatory/page.tsx"
Cohesion: 0.21
Nodes (14): RegulatoryRow, SuppliersManager(), UpdateReminderButton(), getRegulatoryRows(), NAMED_ON_DOSSIER(), isRegulatorySupervisor(), effectiveStage, STAGE_ORDER (+6 more)

### Community 163 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 164 - "exports.ts"
Cohesion: 0.17
Nodes (17): buildWorkbook(), canExport(), DATASETS, DatasetSpec, depositBufferToDrive(), ensurePersonalFolder(), ExportDataset, exportDatasetToDrive() (+9 more)

### Community 165 - "validations/paiements/[id]/page.tsx"
Cohesion: 0.14
Nodes (12): AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, dynamic, PaymentRequestPage(), AskChief(), getLatestAiHealth() (+4 more)

### Community 166 - "receipt-lines.tsx"
Cohesion: 0.30
Nodes (14): empty(), ReceiptLines(), Row, ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField(), parseQuantity() (+6 more)

### Community 167 - "anyRoleFilter"
Cohesion: 0.16
Nodes (14): dynamic, EquipesPage(), dynamic, ParametresPage(), Config, DEFAULTS, num(), SettingsForm() (+6 more)

### Community 168 - "src/auth.ts"
Cohesion: 0.21
Nodes (11): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+3 more)

### Community 169 - "MicrosoftGraphMailProvider"
Cohesion: 0.18
Nodes (4): draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 170 - "mail-folder-bar.tsx"
Cohesion: 0.25
Nodes (9): MailFolderRow, FolderRow, canReparent(), deletionSummary(), FolderLite, FolderNode, folderPath(), subtreeIds() (+1 more)

### Community 171 - "upload-button.tsx"
Cohesion: 0.22
Nodes (13): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload() (+5 more)

### Community 172 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (15): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+7 more)

### Community 173 - "product-catalog.ts"
Cohesion: 0.23
Nodes (13): bestMatches(), isConfident(), MatchProposal, matchScore(), ProductIdentity, STRONG_MATCH, REG, CatalogReconciliation (+5 more)

### Community 174 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 175 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 176 - "department-budget-table.tsx"
Cohesion: 0.17
Nodes (14): DepartmentAccessSheet(), AmountCell(), Consumption(), ExpenseForm(), RequestForm(), RequestList(), MoyensGenerauxPage(), budgetHealth (+6 more)

### Community 177 - "lib/ad-pro-edit.ts"
Cohesion: 0.18
Nodes (11): AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS, describeChanges(), EDITABLE_FIELDS, normalize(), direction (+3 more)

### Community 179 - "search-everything.ts"
Cohesion: 0.25
Nodes (12): capabilities(), d10(), EverythingHit, EverythingResult, familyWhere(), FUZZY_TABLES, fuzzyIds(), matchOf() (+4 more)

### Community 180 - "classify.ts"
Cohesion: 0.22
Nodes (13): dossierCost, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+5 more)

### Community 181 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 182 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 183 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 184 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 185 - "lib/messaging.ts"
Cohesion: 0.21
Nodes (12): DOT, parseAttachments(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+4 more)

### Community 186 - "contacts-board.tsx"
Cohesion: 0.25
Nodes (7): ContactRow, ContactsBoard(), CONTACT_KIND_SUGGESTIONS, groupContactsByKind(), matchesContact(), NO_KIND_LABEL, normalizeKind()

### Community 187 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 188 - "structural-fields.ts"
Cohesion: 0.24
Nodes (11): guardStructural(), canSetStructural(), STRUCTURAL_FIELDS, STRUCTURAL_LABELS, StructuralChange, structuralChanges(), StructuralField, structuralNotice() (+3 more)

### Community 189 - "withImap"
Cohesion: 0.20
Nodes (14): acquirePooled(), appendToSent(), classifyMailError(), decryptSecret(), dropPooled(), evictColdest(), imapBackoff(), imapClient() (+6 more)

### Community 190 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 191 - "decompose.ts"
Cohesion: 0.21
Nodes (12): buildUserMessage(), asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode(), decomposeReserveText(), RESERVE_TYPE_LABELS (+4 more)

### Community 192 - "messaging/messages/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+1 more)

### Community 193 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 194 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 195 - "pipeline-access.ts"
Cohesion: 0.27
Nodes (10): canManagePipeline(), canViewPipeline(), hasRole(), pipelineAccessFor(), PipelineAccessSettings, PipelinePerson, asst, boss (+2 more)

### Community 196 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 197 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 198 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 199 - "entites/page.tsx"
Cohesion: 0.31
Nodes (7): EntityRow, OrphansPanel(), dynamic, EntitesPage(), getUnattachedInventory(), TABLES, UnattachedGroup

### Community 200 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 201 - "validation-item-review.tsx"
Cohesion: 0.27
Nodes (8): ValidationAttachments(), Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 202 - "payroll-cost.ts"
Cohesion: 0.40
Nodes (8): basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost(), num(), PayrollCostInput, payrollMass()

### Community 203 - "rbac-sheet.test.ts"
Cohesion: 0.38
Nodes (8): actionsOfModule(), buildAccessSheet(), isRowScoped(), ModuleSheetSpec, PermissionMatrix, rolesReaching(), matrix, ORDER

### Community 204 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 205 - "database-admin-actions.ts"
Cohesion: 0.44
Nodes (7): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs()

### Community 206 - "api/workflow.ts"
Cohesion: 0.31
Nodes (8): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView

### Community 207 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 208 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 209 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 210 - "calendar-view.tsx"
Cohesion: 0.29
Nodes (6): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND

### Community 211 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 212 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 213 - "teams-manager.tsx"
Cohesion: 0.29
Nodes (6): Cap, Kam, KamRow(), numOrNull(), Opt, Team

### Community 214 - "training-panel.tsx"
Cohesion: 0.32
Nodes (5): CaseDocRow, CaseRow, UpRow, OUTCOME_ORDER, OUTCOME_TONES

### Community 215 - "hr-dossier.tsx"
Cohesion: 0.36
Nodes (6): REQ_TO_CAT, MeetingControls(), HR_APPROVAL_TYPES, HR_DOCUMENT_STATUSES, HR_DONE_STATUSES, hrNature

### Community 216 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 217 - "readers.ts"
Cohesion: 0.39
Nodes (5): canReadLegalDocument(), isRestricted(), LegalDocumentAccess, LegalReaderContext, readersCaption()

### Community 218 - "new-conversation.tsx"
Cohesion: 0.29
Nodes (3): MemberMultiSelect(), Mode, SearchBox()

### Community 219 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 220 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 221 - "change-password-form.tsx"
Cohesion: 0.38
Nodes (4): ChangePasswordForm(), ChangePasswordPage(), metadata, changePassword()

### Community 222 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 223 - "login-throttle.ts"
Cohesion: 0.43
Nodes (5): checkLockout(), FailureResult, LockState, MAX_FAILURES, recordFailure()

### Community 224 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 225 - "assignment-matrix.tsx"
Cohesion: 0.40
Nodes (5): Assign, AssignmentMatrix(), Kam, nOr0(), Prod

### Community 226 - "corpus-import.tsx"
Cohesion: 0.33
Nodes (4): ACCEPT, AUTHORITIES, CATEGORIES, Row

### Community 227 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 228 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 229 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 232 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 233 - "admin/corbeille/page.tsx"
Cohesion: 0.60
Nodes (3): dynamic, TrashItem, TrashList()

### Community 234 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 235 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 236 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 237 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 238 - "auth-actions.ts"
Cohesion: 0.50
Nodes (3): UserMenu(), UserMenuProps, doSignOut()

### Community 239 - "geo.ts"
Cohesion: 0.60
Nodes (4): enrichSessionGeo(), GeoInfo, geolocate(), isPrivate()

### Community 240 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 241 - "reserves-panel.tsx"
Cohesion: 0.50
Nodes (3): Cycle, Point, RESERVE_TYPES

### Community 242 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

## Knowledge Gaps
- **1590 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1585 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `utils.ts`, `jobs/runner.ts`, `requireModule`, `userCan`, `fdStr`, `getCurrentUser`, `getAppSettings`, `requireUser`, `lib/labels.ts`, `notifyUser`, `medical-directory-actions.ts`, `toNumber`, `getMyCompanies`, `upload/session.ts`, `resolveDriveAccess`, `drive-storage.ts`, `dossier-agent.ts`, `assistant.ts`, `[dossierId]/page.tsx`, `budget-forms.tsx`, `cn`, `aiConfigured`, `formatCurrency`, `build-facts.ts`, `recordAudit`, `meeting-actions.ts`, `training-actions.ts`, `rules/engine.ts`, `entities.ts`, `departments.ts`, `regAudit`, `corpus-actions.ts`, `admin-request-actions.ts`, `care-actions.ts`, `payment-request-actions.ts`, `openai-luna.ts`, `workflow/engine.ts`, `rbac.ts`, `onlyoffice.ts`, `actions/types.ts`, `formatDate`, `reserves/page.tsx`, `agent-core.ts`, `test-center/runner.ts`, `ocr-engine.ts`, `entity-access.ts`, `calendar.ts`, `drive/page.tsx`, `promo-material-actions.ts`, `letterhead-manager.tsx`, `legal-actions.ts`, `congress-request-actions.ts`, `market-research.ts`, `adoption.ts`, `admin-settings-forms.tsx`, `hasGlobalView`, `lib/ai.ts`, `lib/department-budget.ts`, `voice-realtime.ts`, `dossier-actions.ts`, `drive-actions.ts`, `messaging-actions.ts`, `brain-cockpit.tsx`, `(app)/layout.tsx`, `stock-board.tsx`, `platform-audit/engine.ts`, `demandes/page.tsx`, `pilotage/page.tsx`, `pch-tender-line-actions.ts`, `mail.ts`, `centre-board.tsx`, `Module`, `general-means.ts`, `memory-tools.ts`, `queries/messaging.ts`, `replay-viewer.tsx`, `api/auth.ts`, `(app)/organigramme/page.tsx`, `bd-strategic-table.tsx`, `microsoft-mail-actions.ts`, `workflow-builder.tsx`, `medical-info-actions.ts`, `ad-pro-item-actions.ts`, `ingest-case.ts`, `featureEnabled`, `smart-mail-actions.ts`, `SessionUser`, `adventum-actions.ts`, `onboarding-wizard.tsx`, `reports.ts`, `support-actions.ts`, `department-budget-actions.ts`, `queries/drive.ts`, `scheduled.ts`, `state-machines/explorer.ts`, `ad-pro.ts`, `congress-international/[id]/page.tsx`, `progress/query.ts`, `update-reminder.ts`, `medical-actions.ts`, `migration-cert.ts`, `connection.ts`, `corpus/actions.ts`, `company.ts`, `test-center/types.ts`, `mon-dossier/page.tsx`, `invariants/registry.ts`, `identity-board.tsx`, `portfolio.ts`, `risks.ts`, `deliverables.ts`, `drive-search.ts`, `write.ts`, `access-actions.ts`, `executive-brief-tools.ts`, `gammes/page.tsx`, `recrutement/[id]/page.tsx`, `legal/lifecycle.ts`, `consulting-actions.ts`, `pch.ts`, `lifecycle/actions.ts`, `regulatory/page.tsx`, `invoice-actions.ts`, `exports.ts`, `validations/paiements/[id]/page.tsx`, `receipt-lines.tsx`, `anyRoleFilter`, `src/auth.ts`, `field-report-actions.ts`, `product-catalog.ts`, `process-intelligence.ts`, `regulatory/export/route.ts`, `lib/ad-pro-edit.ts`, `search-everything.ts`, `compare-versions.ts`, `pch/export/route.ts`, `lib/messaging.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `push.ts`, `reminder-actions.ts`, `entites/page.tsx`, `database-admin-actions.ts`, `api/workflow.ts`, `login-throttle.ts`, `admin/corbeille/page.tsx`, `auth-actions.ts`, `geo.ts`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `prisma.ts`, `utils.ts`, `requireModule`, `userCan`, `fdStr`, `getCurrentUser`, `getAppSettings`, `notifyUser`, `medical-directory-actions.ts`, `toNumber`, `resolveDriveAccess`, `dossier-agent.ts`, `[dossierId]/page.tsx`, `aiConfigured`, `recordAudit`, `meeting-actions.ts`, `training-actions.ts`, `rules/engine.ts`, `departments.ts`, `regAudit`, `corpus-actions.ts`, `admin-request-actions.ts`, `care-actions.ts`, `payment-request-actions.ts`, `oauth.ts`, `onlyoffice.ts`, `actions/types.ts`, `reserves/page.tsx`, `test-center/runner.ts`, `ocr-engine.ts`, `entity-access.ts`, `drive/page.tsx`, `promo-material-actions.ts`, `legal-actions.ts`, `congress-request-actions.ts`, `admin-settings-forms.tsx`, `hasGlobalView`, `lib/ai.ts`, `lib/department-budget.ts`, `voice-realtime.ts`, `dossier-actions.ts`, `drive-actions.ts`, `messaging-actions.ts`, `brain-cockpit.tsx`, `(app)/layout.tsx`, `stock-board.tsx`, `pch-tender-line-actions.ts`, `centre-board.tsx`, `(app)/organigramme/page.tsx`, `microsoft-mail-actions.ts`, `workflow-builder.tsx`, `medical-info-actions.ts`, `ad-pro-item-actions.ts`, `ingest-case.ts`, `featureEnabled`, `smart-mail-actions.ts`, `SessionUser`, `molecule.ts`, `adventum-actions.ts`, `onboarding-wizard.tsx`, `expense-row-actions.tsx`, `reports.ts`, `support-actions.ts`, `department-budget-actions.ts`, `queries/drive.ts`, `congress-international/[id]/page.tsx`, `products.ts`, `update-reminder.ts`, `medical-actions.ts`, `corpus/actions.ts`, `catalog-normalize.ts`, `mon-dossier/page.tsx`, `mail-client.tsx`, `access-actions.ts`, `consulting-actions.ts`, `lifecycle/actions.ts`, `invoice-actions.ts`, `validations/paiements/[id]/page.tsx`, `field-report-actions.ts`, `department-budget-table.tsx`, `lib/messaging.ts`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `validation-item-review.tsx`, `database-admin-actions.ts`, `change-password-form.tsx`, `admin/corbeille/page.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `card.tsx`, `prisma.ts`, `utils.ts`, `requireModule`, `fdStr`, `getCurrentUser`, `getAppSettings`, `requireUser`, `lib/labels.ts`, `notifyUser`, `medical-directory-actions.ts`, `toNumber`, `getMyCompanies`, `upload/session.ts`, `resolveDriveAccess`, `assistant.ts`, `budget-forms.tsx`, `cn`, `aiConfigured`, `formatCurrency`, `recordAudit`, `meeting-actions.ts`, `training-actions.ts`, `entities.ts`, `departments.ts`, `admin-request-actions.ts`, `care-actions.ts`, `payment-request-actions.ts`, `rbac.ts`, `onlyoffice.ts`, `actions/types.ts`, `formatDate`, `ocr-engine.ts`, `entity-access.ts`, `calendar.ts`, `drive/page.tsx`, `promo-material-actions.ts`, `legal-actions.ts`, `congress-request-actions.ts`, `market-research.ts`, `adoption.ts`, `hasGlobalView`, `lib/ai.ts`, `lib/department-budget.ts`, `dossier-actions.ts`, `drive-actions.ts`, `messaging-actions.ts`, `(app)/layout.tsx`, `stock-board.tsx`, `demandes/page.tsx`, `pilotage/page.tsx`, `pch-tender-line-actions.ts`, `Module`, `general-means.ts`, `queries/messaging.ts`, `recruitment/request-flow.ts`, `api/auth.ts`, `(app)/organigramme/page.tsx`, `medical-info-actions.ts`, `ad-pro-item-actions.ts`, `featureEnabled`, `SessionUser`, `molecule.ts`, `adventum-actions.ts`, `support-actions.ts`, `department-budget-actions.ts`, `queries/drive.ts`, `ad-pro.ts`, `congress-international/[id]/page.tsx`, `products.ts`, `update-reminder.ts`, `medical-actions.ts`, `identity-board.tsx`, `write.ts`, `access-actions.ts`, `executive-brief-tools.ts`, `gammes/page.tsx`, `recrutement/[id]/page.tsx`, `consulting-actions.ts`, `pch.ts`, `regulatory/page.tsx`, `invoice-actions.ts`, `exports.ts`, `validations/paiements/[id]/page.tsx`, `anyRoleFilter`, `field-report-actions.ts`, `regulatory/export/route.ts`, `department-budget-table.tsx`, `search-everything.ts`, `pch/export/route.ts`, `stock-snapshot-actions.ts`, `messaging/messages/route.ts`, `reminder-actions.ts`, `entites/page.tsx`, `api/workflow.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1590 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.032954041672824 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.025698757763975157 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03891509433962264 - nodes in this community are weakly interconnected._