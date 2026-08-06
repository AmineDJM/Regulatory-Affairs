# Graph Report - src  (2026-08-06)

## Corpus Check
- 924 files · ~648,550 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5631 nodes · 22210 edges · 204 communities (198 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4ecfc35e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- userCan
- card.tsx
- lib/session.ts
- lib/labels.ts
- utils.ts
- button.tsx
- notifyUser
- requireModule
- getCompanyScope
- requireUser
- budget-forms.tsx
- toNumber
- hasGlobalView
- prisma.ts
- [dossierId]/page.tsx
- batch-runner.ts
- anpp-process.tsx
- fdStr
- upload/session.ts
- rules/engine.ts
- corpus/page.tsx
- FindingInput
- notifyRoles
- care-actions.ts
- aiConfigured
- drive-storage.ts
- assistant-actions.ts
- dossier-chat.ts
- workflow/engine.ts
- test-center/runner.ts
- sponsoring/[id]/page.tsx
- users/[id]/page.tsx
- getCurrentUser
- mistral-ocr.ts
- promo-material-actions.ts
- regCan
- library-actions.ts
- onlyofficeConfigured
- calendar.ts
- formatCurrency
- medical-directory.tsx
- jobs/runner.ts
- build-facts.ts
- rbac.ts
- messaging-actions.ts
- sales-planning-actions.ts
- platform-audit/engine.ts
- assistant.ts
- dossier-actions.ts
- entity-access.ts
- ingest-dossier.ts
- product-explorer.tsx
- library-ingest.ts
- getAppSettings
- drive-actions.ts
- create-record-button.tsx
- pilotage/page.tsx
- ocr-engine.ts
- generate.ts
- medical-actions.ts
- auth.ts
- adoption.ts
- budgets/page.tsx
- bd-strategic-table.tsx
- message-thread.tsx
- releaseBlob
- validation-actions.ts
- budgets/departements/page.tsx
- getMarketData
- pipeline.upload.e2e.test.ts
- queries/messaging.ts
- brain-cockpit.tsx
- events/[id]/page.tsx
- form-fields.tsx
- espace/[id]/page.tsx
- mail.ts
- smart-mail-actions.ts
- (app)/layout.tsx
- meetings/[id]/page.tsx
- market/engine.ts
- field-reports.ts
- lib/ai.ts
- messenger.tsx
- company.ts
- classify.ts
- lifecycle/actions.ts
- portfolio.ts
- explorer.ts
- invariants/registry.ts
- migration-cert.ts
- enregistrement/page.tsx
- extract-text.ts
- competition.ts
- pch-tender-line-actions.ts
- molecule.ts
- mail-client.tsx
- validations.ts
- risks.ts
- extract-facts.ts
- evidence.ts
- meetings.ts
- workflow-builder.tsx
- adventum-brain/page.tsx
- promo-material/[id]/page.tsx
- upload-manager.tsx
- lib/messaging.ts
- molecule-panel.tsx
- supplier/actions.ts
- budget-envelope-actions.ts
- departments.ts
- stream/route.ts
- market-research.ts
- congress.ts
- document-preview.tsx
- zip-viewer.tsx
- run.ts
- support-actions.ts
- topbar.tsx
- ad-pro-item-actions.ts
- [versionId]/route.ts
- beneficiaries-card.tsx
- payroll-hr-actions.ts
- drive-space-manager.tsx
- pch.ts
- supplier-portal-actions.ts
- items-panel.tsx
- stocks-view.tsx
- onboarding-wizard.tsx
- event-actions.ts
- compare-versions.ts
- messaging/messages/route.ts
- drive/[id]/page.tsx
- event-form.tsx
- department-actions.ts
- office-templates.ts
- process-intelligence.ts
- getMailAccount
- pch/export/route.ts
- adoption-settings.tsx
- products.ts
- new-request.tsx
- push.ts
- daily-brief.ts
- stock-snapshot-actions.ts
- hr-documents.ts
- org-chart-editor.tsx
- aiModel
- adventum-actions.ts
- panels.tsx
- reserves/actions.ts
- regulatory-requests.ts
- background-upload.tsx
- reminder-actions.ts
- getMessage
- radar.ts
- regulatory-drive-mirror.ts
- overview/page.tsx
- meetings/page.tsx
- mail-diagnostic/route.ts
- calendar-view.tsx
- report-editor.tsx
- departments-manager.tsx
- support-flow.test.ts
- mail-actions.ts
- assistant-files.ts
- withImap
- Adventum Autonomous Test Center — architecture
- impersonation-actions.ts
- dossiers.ts
- upload-button.tsx
- hr-dossier.tsx
- mobile-tabbar.tsx
- client-bundle-guard.test.ts
- scheduled.ts
- congress-request-form.tsx
- new-conversation.tsx
- assignment-matrix.tsx
- forecast-grid.tsx
- (auth)/login/login-form.tsx
- change-password-form.tsx
- push-register.tsx
- [token]/route.ts
- step-timeline.tsx
- employee-form.tsx
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- directives/[id]/panel.tsx
- request-controls.tsx
- activity-tracker.tsx
- custom-fields-card.tsx
- contacts/route.ts
- mission-stops.tsx
- office-editor.tsx
- validation-decision.tsx
- validation-item-review.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 597 edges
2. `userCan()` - 459 edges
3. `fdStr()` - 449 edges
4. `recordAudit()` - 390 edges
5. `prisma` - 380 edges
6. `requireModule()` - 218 edges
7. `hasGlobalView()` - 159 edges
8. `Button` - 153 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `form()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/budget-expense.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/reset-password.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `RuleControls()` --indirect_call--> `v()`  [INFERRED]
  src/app/(app)/admin/validations/rules-admin.tsx → src/lib/regulatory/manufacturing-stage.test.ts

## Import Cycles
- None detected.

## Communities (204 total, 6 thin omitted)

### Community 0 - "userCan"
Cohesion: 0.05
Nodes (114): POST(), GET(), FieldsManager(), PresentationCard(), PresentationPanel(), Res, SuppliesManager(), EditTransactionSheet() (+106 more)

### Community 1 - "card.tsx"
Cohesion: 0.05
Nodes (84): MailTester(), dynamic, metadata, inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage() (+76 more)

### Community 2 - "lib/session.ts"
Cohesion: 0.07
Nodes (71): ACTION_COLS, ACTION_LABELS, Opt, dynamic, dynamic, dynamic, FieldDefDTO, TYPES (+63 more)

### Community 3 - "lib/labels.ts"
Cohesion: 0.03
Nodes (81): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), AuditPanel(), AuditRow, AuditTable() (+73 more)

### Community 4 - "utils.ts"
Cohesion: 0.04
Nodes (74): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+66 more)

### Community 5 - "button.tsx"
Cohesion: 0.07
Nodes (52): DriveStorageSettings(), EntityRow, PALETTE, Citation, Source, Version, ENV_LABEL, MODES (+44 more)

### Community 6 - "notifyUser"
Cohesion: 0.05
Nodes (83): dynamic, POST(), EventDetail(), EventForm(), RequestActions(), RequesterWindow(), RequestRow(), addRequestComment() (+75 more)

### Community 7 - "requireModule"
Cohesion: 0.04
Nodes (75): CourrierAdminPage(), EntitesPage(), AdminFeedbackPage(), CustomFieldsPage(), OrganigrammePage(), AdminPage(), fmtBytes(), fmtWhen() (+67 more)

### Community 8 - "getCompanyScope"
Cohesion: 0.04
Nodes (65): dynamic, GET(), INLINE_MIME, runtime, dynamic, GET(), runtime, dynamic (+57 more)

### Community 9 - "requireUser"
Cohesion: 0.06
Nodes (74): CorbeillePage(), EntitiesManager(), VariationPanel(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange() (+66 more)

### Community 10 - "budget-forms.tsx"
Cohesion: 0.06
Nodes (62): GET(), BudgetContextBar(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo (+54 more)

### Community 11 - "toNumber"
Cohesion: 0.05
Nodes (61): dynamic, metadata, CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata (+53 more)

### Community 12 - "hasGlobalView"
Cohesion: 0.07
Nodes (67): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+59 more)

### Community 13 - "prisma.ts"
Cohesion: 0.07
Nodes (32): StocksPage(), SnapshotDTO, actorFor(), form(), actorFor(), actorFor(), fd(), OLD_HASH (+24 more)

### Community 14 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (53): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), CostTable(), DossierDetailPage(), dynamic (+45 more)

### Community 15 - "batch-runner.ts"
Cohesion: 0.06
Nodes (54): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+46 more)

### Community 16 - "anpp-process.tsx"
Cohesion: 0.06
Nodes (53): RegulatoryProcess(), STATE_OPTS, StepNote(), NewProductButton(), regStage(), RegulatoryPage(), CATEGORY_OPTS, Col (+45 more)

### Community 17 - "fdStr"
Cohesion: 0.07
Nodes (54): ActiveToggle(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, DriveComments() (+46 more)

### Community 18 - "upload/session.ts"
Cohesion: 0.07
Nodes (55): dynamic, GET(), runtime, dynamic, POST(), runtime, RFC-3986, IngestResult (+47 more)

### Community 19 - "rules/engine.ts"
Cohesion: 0.07
Nodes (46): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+38 more)

### Community 20 - "corpus/page.tsx"
Cohesion: 0.08
Nodes (47): CorpusPanel(), IngestResults, Src, WatchFindings, CorpusPage(), dynamic, metadata, SourceRow() (+39 more)

### Community 21 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 22 - "notifyRoles"
Cohesion: 0.07
Nodes (48): RequestThread(), Res, AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS (+40 more)

### Community 23 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 24 - "aiConfigured"
Cohesion: 0.07
Nodes (37): AgentItem, AgentsPanel(), RunState, aiConfigured(), extractJson(), listApplicableAgents(), runAgentAction(), scopeCompanyId() (+29 more)

### Community 25 - "drive-storage.ts"
Cohesion: 0.08
Nodes (39): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+31 more)

### Community 26 - "assistant-actions.ts"
Cohesion: 0.09
Nodes (47): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+39 more)

### Community 27 - "dossier-chat.ts"
Cohesion: 0.08
Nodes (44): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, sectionByCode() (+36 more)

### Community 28 - "workflow/engine.ts"
Cohesion: 0.08
Nodes (45): Props, BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity(), loadOutcome() (+37 more)

### Community 29 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (38): LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard(), computeCertification() (+30 more)

### Community 30 - "sponsoring/[id]/page.tsx"
Cohesion: 0.11
Nodes (39): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), AppealPanel(), SPONSORING_DOC_CATEGORIES, SponsoringDetailPage(), ThirdPartyButton(), AdProEditButton() (+31 more)

### Community 31 - "users/[id]/page.tsx"
Cohesion: 0.08
Nodes (41): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AccessMatrix() (+33 more)

### Community 32 - "getCurrentUser"
Cohesion: 0.09
Nodes (39): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+31 more)

### Community 33 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 34 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (37): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), addPromoComment(), audit(), cancelPromoMaterial() (+29 more)

### Community 35 - "regCan"
Cohesion: 0.10
Nodes (36): CorpusAdmin(), Props, Conflict, ConflictRow(), ConflictValue, Fact, FactRow(), METHOD_LABEL (+28 more)

### Community 36 - "library-actions.ts"
Cohesion: 0.09
Nodes (38): FindingEvidence(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+30 more)

### Community 37 - "onlyofficeConfigured"
Cohesion: 0.14
Nodes (32): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, DriveEditPage(), dynamic (+24 more)

### Community 38 - "calendar.ts"
Cohesion: 0.10
Nodes (35): CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents() (+27 more)

### Community 39 - "formatCurrency"
Cohesion: 0.08
Nodes (32): DossiersPage(), EventsPage(), CategoryCard(), ComptaCockpit(), ComptaData, ItemTable(), RecettesDepensesChart(), LedgerTable() (+24 more)

### Community 40 - "medical-directory.tsx"
Cohesion: 0.08
Nodes (34): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem, MedicalDirectory(), Props (+26 more)

### Community 41 - "jobs/runner.ts"
Cohesion: 0.11
Nodes (35): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+27 more)

### Community 42 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 43 - "rbac.ts"
Cohesion: 0.06
Nodes (33): dynamic, GET(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage(), NAVIGATION (+25 more)

### Community 44 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+28 more)

### Community 45 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 46 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+25 more)

### Community 47 - "assistant.ts"
Cohesion: 0.09
Nodes (37): callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue() (+29 more)

### Community 48 - "dossier-actions.ts"
Cohesion: 0.12
Nodes (32): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+24 more)

### Community 49 - "entity-access.ts"
Cohesion: 0.13
Nodes (31): GET(), SearchPage(), executeReadTool(), ENTITY_MODULE, isRequestOwner(), addDays(), bdSection(), budgetsSection() (+23 more)

### Community 50 - "ingest-dossier.ts"
Cohesion: 0.11
Nodes (32): sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile(), IngestSummary, isStorable(), maxPgBlobBytes() (+24 more)

### Community 51 - "product-explorer.tsx"
Cohesion: 0.09
Nodes (31): AggNum(), BdProjectDetailPage(), fmtDzd(), fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone() (+23 more)

### Community 52 - "library-ingest.ts"
Cohesion: 0.10
Nodes (30): LunaCallInput, rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve (+22 more)

### Community 53 - "getAppSettings"
Cohesion: 0.10
Nodes (29): POST(), DatabasesPage(), AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm() (+21 more)

### Community 54 - "drive-actions.ts"
Cohesion: 0.13
Nodes (27): POST(), FileActions(), ShareItem, SharePanel(), ShareRow(), NewOfficeButton(), AccessSheet(), MoveTarget (+19 more)

### Community 55 - "create-record-button.tsx"
Cohesion: 0.11
Nodes (24): BDPipeline(), STAGES, BDRow, BDTable(), FeedbackPage(), dynamic, metadata, NoAccessPage() (+16 more)

### Community 56 - "pilotage/page.tsx"
Cohesion: 0.16
Nodes (29): AffectationsPage(), dynamic, dynamic, PlanningPage(), dynamic, pct(), PilotagePage(), toneOf() (+21 more)

### Community 57 - "ocr-engine.ts"
Cohesion: 0.11
Nodes (24): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr(), createOcrWorker() (+16 more)

### Community 58 - "generate.ts"
Cohesion: 0.12
Nodes (23): DocgenPanel(), GenDoc, Template, generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER (+15 more)

### Community 59 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+22 more)

### Community 60 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 61 - "adoption.ts"
Cohesion: 0.13
Nodes (26): AdoptionPage(), AdoptionBadge, AdoptionComponent, AdoptionHistoryPoint, AdoptionResult, AdoptionScore, AdoptionTargets, AdoptionThresholds (+18 more)

### Community 62 - "budgets/page.tsx"
Cohesion: 0.11
Nodes (22): dynamic, MoleculePanel(), dynamic, metadata, ReserveLibraryPage(), BarRow, Bars(), COLOR (+14 more)

### Community 63 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 64 - "message-thread.tsx"
Cohesion: 0.14
Nodes (23): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+15 more)

### Community 65 - "releaseBlob"
Cohesion: 0.12
Nodes (21): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+13 more)

### Community 66 - "validation-actions.ts"
Cohesion: 0.12
Nodes (27): RuleControls(), RuleEditor(), clearValidationItem(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule(), ITEM_DECISIONS (+19 more)

### Community 67 - "budgets/departements/page.tsx"
Cohesion: 0.18
Nodes (22): AmountCell(), DepartmentBudgetTable(), HrConsumption(), DepartmentBudgetsPage(), dynamic, setDepartmentBudget(), setterOf(), budgetHealth (+14 more)

### Community 68 - "getMarketData"
Cohesion: 0.17
Nodes (26): dominantOrigin(), enrichLineById(), matchOurProduct(), parseBoxSize(), getMarketData(), allTokensIn(), buildCompetition(), iqviaMarketByDci() (+18 more)

### Community 69 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.12
Nodes (22): failJob(), runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs() (+14 more)

### Community 70 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 71 - "brain-cockpit.tsx"
Cohesion: 0.10
Nodes (21): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+13 more)

### Community 72 - "events/[id]/page.tsx"
Cohesion: 0.10
Nodes (21): Budget(), CONGRESS_DOC_CATEGORIES, EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), MyMissionsPage(), MissionAssignmentsCard() (+13 more)

### Community 73 - "form-fields.tsx"
Cohesion: 0.13
Nodes (21): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, UserOption, SupplierRow, Field() (+13 more)

### Community 74 - "espace/[id]/page.tsx"
Cohesion: 0.16
Nodes (24): DriveSpacePage(), dynamic, humanSize(), KIND_ICON, NewFolderButton(), DrivePage(), humanSize(), canCreateInSpace() (+16 more)

### Community 75 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 76 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 77 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (19): AppLayout(), CommandPalette(), Item, SearchResult, audio(), desktop(), NotificationChime(), playChime() (+11 more)

### Community 78 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (20): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+12 more)

### Community 79 - "market/engine.ts"
Cohesion: 0.11
Nodes (24): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, loadNdjson(), MarketMeta, PchRow (+16 more)

### Community 80 - "field-reports.ts"
Cohesion: 0.11
Nodes (21): dynamic, GET(), dynamic, POST(), dynamic, FieldReportPage(), HBars(), PALETTE (+13 more)

### Community 81 - "lib/ai.ts"
Cohesion: 0.10
Nodes (19): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AnthropicBlock, AskOptions, CallOptions, ClaudeContentBlock (+11 more)

### Community 82 - "messenger.tsx"
Cohesion: 0.14
Nodes (23): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+15 more)

### Community 83 - "company.ts"
Cohesion: 0.17
Nodes (21): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+13 more)

### Community 84 - "classify.ts"
Cohesion: 0.13
Nodes (21): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+13 more)

### Community 85 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 86 - "portfolio.ts"
Cohesion: 0.15
Nodes (20): MyPortfolioCard(), ProductList(), getFieldReportsAggregation(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT (+12 more)

### Community 87 - "explorer.ts"
Cohesion: 0.18
Nodes (19): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants() (+11 more)

### Community 88 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (15): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+7 more)

### Community 89 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 90 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 91 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 92 - "competition.ts"
Cohesion: 0.16
Nodes (22): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+14 more)

### Community 93 - "pch-tender-line-actions.ts"
Cohesion: 0.17
Nodes (20): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+12 more)

### Community 94 - "molecule.ts"
Cohesion: 0.22
Nodes (20): analyzeMoleculeSafe(), NomRow, canonicalForm(), dosageMatches(), extractDosage(), FORM_RULES, moleculeMatches(), moleculeStem() (+12 more)

### Community 95 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 96 - "validations.ts"
Cohesion: 0.12
Nodes (17): fd(), form(), actor(), fd(), CONG_STAGE, CrossValidationItem, getMyValidationRequests(), getMyValidations() (+9 more)

### Community 97 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 98 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 99 - "evidence.ts"
Cohesion: 0.13
Nodes (18): base, Certification, CertificationInput, CertificationResult, BETTER, classify(), Diff, DiffClass (+10 more)

### Community 100 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 101 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (16): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), WorkflowActionView, WorkflowStepView, ACTOR_SCOPES, ActorScope (+8 more)

### Community 102 - "adventum-brain/page.tsx"
Cohesion: 0.17
Nodes (18): AdventumBrainPage(), BLOCK_CATS, dynamic, diff(), getPulse(), hourBucket(), LEVEL_RANK, PulseCounts (+10 more)

### Community 103 - "promo-material/[id]/page.tsx"
Cohesion: 0.17
Nodes (17): dynamic, PROMO_DOC_CATEGORIES, PromoMaterialDetailPage(), promoSteps(), ValidationStepper(), VStep, VStepState, CompanyLite (+9 more)

### Community 104 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 105 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): dynamic, GET(), DOT, MyStatus(), setMessagingStatus(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 106 - "molecule-panel.tsx"
Cohesion: 0.14
Nodes (16): fmtDzd(), FoundList(), SuggestField(), SERIES, analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions() (+8 more)

### Community 107 - "supplier/actions.ts"
Cohesion: 0.24
Nodes (16): SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier(), regenerateSupplierDraft(), remindSupplier(), requestDossierId() (+8 more)

### Community 108 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (19): attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory(), ensureCanManageEnvelope(), NOT_ALLOWED (+11 more)

### Community 109 - "departments.ts"
Cohesion: 0.17
Nodes (17): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentOptions() (+9 more)

### Community 110 - "stream/route.ts"
Cohesion: 0.18
Nodes (15): dynamic, maxDuration, runtime, dynamic, RootPage(), AssistantStreamEvent, ChatTurn, CATALOG (+7 more)

### Community 111 - "market-research.ts"
Cohesion: 0.16
Nodes (16): GET(), MarketResearchDetailPage(), buildResearchWorkbook(), researchExportFilename(), STATUS, DEFAULT_RESEARCH_SOURCES, getMarketResearch(), listResearchPresentations() (+8 more)

### Community 112 - "congress.ts"
Cohesion: 0.20
Nodes (16): CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail() (+8 more)

### Community 113 - "document-preview.tsx"
Cohesion: 0.19
Nodes (13): ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, NotificationPopup() (+5 more)

### Community 114 - "zip-viewer.tsx"
Cohesion: 0.18
Nodes (12): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+4 more)

### Community 115 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 116 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 117 - "topbar.tsx"
Cohesion: 0.17
Nodes (13): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+5 more)

### Community 118 - "ad-pro-item-actions.ts"
Cohesion: 0.25
Nodes (17): addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem(), emitItemExpenseOrder(), isParent() (+9 more)

### Community 119 - "[versionId]/route.ts"
Cohesion: 0.23
Nodes (14): GET(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer(), header(), presentationFilename() (+6 more)

### Community 120 - "beneficiaries-card.tsx"
Cohesion: 0.25
Nodes (15): BeneficiariesCard(), Beneficiary, Mode, Refs, addCongressBeneficiary(), asList(), Benef, entityTypeOf() (+7 more)

### Community 121 - "payroll-hr-actions.ts"
Cohesion: 0.24
Nodes (14): ExpenseAckItem, ExpenseAckList(), MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym(), ackExpenseOriginals() (+6 more)

### Community 122 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 123 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 124 - "supplier-portal-actions.ts"
Cohesion: 0.22
Nodes (13): SupplierLoginForm(), SupplierLoginPage(), SupplierLogoutButton(), supplierLogin(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier() (+5 more)

### Community 125 - "items-panel.tsx"
Cohesion: 0.22
Nodes (10): AdProItemsPanel(), Props, AdProParent, breakdown, canEmitOrder(), ITEM_KIND_LABELS, ITEM_KINDS, ItemAmounts (+2 more)

### Community 126 - "stocks-view.tsx"
Cohesion: 0.13
Nodes (14): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt, HospitalDTO, LOC_UI (+6 more)

### Community 127 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (10): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+2 more)

### Community 128 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 129 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 130 - "messaging/messages/route.ts"
Cohesion: 0.20
Nodes (10): dynamic, GET(), dynamic, NO_CONTENT, POST(), ConversationTyping, getTyping(), registry (+2 more)

### Community 131 - "drive/[id]/page.tsx"
Cohesion: 0.21
Nodes (9): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), CUSTOM_ENTITY_TYPES, CustomValues, getFieldDefs(), fileTypeLabel() (+1 more)

### Community 132 - "event-form.tsx"
Cohesion: 0.18
Nodes (11): CreateEventButton(), d10(), EventFields(), Result, ACTIVE, buildStats(), EventDetail, EventListItem (+3 more)

### Community 133 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 134 - "office-templates.ts"
Cohesion: 0.23
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 135 - "process-intelligence.ts"
Cohesion: 0.20
Nodes (13): collectWorkItems(), daysSince(), getProcessOverview(), label(), ModuleStat, PendingValidation, PiAlert, ProcessOverview (+5 more)

### Community 136 - "getMailAccount"
Cohesion: 0.24
Nodes (10): dynamic, GET(), dynamic, GET(), dynamic, GET(), friendlyMailError(), getAttachment() (+2 more)

### Community 137 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 138 - "adoption-settings.tsx"
Cohesion: 0.21
Nodes (11): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, resetActivityTime(), saveAdoptionSettings(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS (+3 more)

### Community 139 - "products.ts"
Cohesion: 0.28
Nodes (12): MarketProductsPage(), GalenicForm, MoleculeSearchInput, clean(), getPchProducts(), PchProduct, productFilterOptions(), ProductSearchInput (+4 more)

### Community 140 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 141 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 142 - "daily-brief.ts"
Cohesion: 0.29
Nodes (9): AssistantPage(), dynamic, MorningBrief(), refreshMyBrief(), askClaudeCheap(), sttConfigured(), algiersDay(), BriefResult (+1 more)

### Community 143 - "stock-snapshot-actions.ts"
Cohesion: 0.26
Nodes (11): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+3 more)

### Community 144 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 145 - "org-chart-editor.tsx"
Cohesion: 0.36
Nodes (7): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), saveOrgNode(), saveOrgPosition()

### Community 146 - "aiModel"
Cohesion: 0.31
Nodes (10): BrainCockpit(), askBrain(), generateBriefing(), aiModel(), askClaude(), analyzeMarketResearch(), buildContext(), extractJson() (+2 more)

### Community 147 - "adventum-actions.ts"
Cohesion: 0.31
Nodes (8): RiskThresholdsForm(), DENIED, updateRiskThresholds(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField, AutopilotPayload

### Community 148 - "panels.tsx"
Cohesion: 0.29
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+1 more)

### Community 149 - "reserves/actions.ts"
Cohesion: 0.33
Nodes (8): Cycle, Point, ReservesPanel(), approveReservePoint(), deleteReserveCycle(), guardPoint(), Result, updateReservePoint()

### Community 150 - "regulatory-requests.ts"
Cohesion: 0.25
Nodes (10): RegulatoryRequestDetailPage(), RegulatoryRequestsPage(), getRegRequest(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO, regRequestProductOptions() (+2 more)

### Community 151 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 152 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 153 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 154 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 155 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 156 - "overview/page.tsx"
Cohesion: 0.31
Nodes (8): dynamic, FieldReportsOverviewPage(), dynamic, FieldReportsPage(), FIELD_REPORT_STATUS, canViewFieldReportsOverview(), getFieldReportsOverview(), getMyFieldReports()

### Community 157 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 158 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 159 - "calendar-view.tsx"
Cohesion: 0.25
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND, CALENDAR_INVITE_STATUS

### Community 160 - "report-editor.tsx"
Cohesion: 0.36
Nodes (6): MessageAttachments(), DoctorPicker(), Attachments(), MessageAttachments(), formatBytes(), FieldReportDetail

### Community 161 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 162 - "support-flow.test.ts"
Cohesion: 0.36
Nodes (7): SupportDetailPage(), actorFor(), canViewSupport(), getSupportRequest(), isSupportResponder(), SupportDetail, scopeSupport()

### Community 163 - "mail-actions.ts"
Cohesion: 0.36
Nodes (8): connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), closeMailConnection(), encryptSecret(), sendMail(), testImap()

### Community 164 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 165 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 166 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 167 - "impersonation-actions.ts"
Cohesion: 0.36
Nodes (5): ImpersonateButton(), ImpersonationBanner(), startImpersonation(), stopImpersonation(), IMPERSONATE_COOKIE

### Community 168 - "dossiers.ts"
Cohesion: 0.39
Nodes (7): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), isDossierMember(), scopeDossiers()

### Community 169 - "upload-button.tsx"
Cohesion: 0.32
Nodes (7): CATEGORY_SUGGESTIONS, Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload()

### Community 170 - "hr-dossier.tsx"
Cohesion: 0.36
Nodes (6): REQ_TO_CAT, MeetingControls(), HR_APPROVAL_TYPES, HR_DOCUMENT_STATUSES, HR_DONE_STATUSES, hrNature

### Community 171 - "mobile-tabbar.tsx"
Cohesion: 0.46
Nodes (6): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY

### Community 172 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 173 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 174 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 175 - "new-conversation.tsx"
Cohesion: 0.29
Nodes (3): MemberMultiSelect(), Mode, SearchBox()

### Community 176 - "assignment-matrix.tsx"
Cohesion: 0.38
Nodes (6): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod

### Community 177 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 178 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 179 - "change-password-form.tsx"
Cohesion: 0.38
Nodes (4): ChangePasswordForm(), ChangePasswordPage(), metadata, changePassword()

### Community 180 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 181 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 182 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 183 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 184 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 185 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 186 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 187 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 188 - "request-controls.tsx"
Cohesion: 0.60
Nodes (4): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 189 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 190 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 191 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 192 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 193 - "office-editor.tsx"
Cohesion: 0.67
Nodes (3): OfficeEditor(), originOf(), Window

### Community 194 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

### Community 195 - "validation-item-review.tsx"
Cohesion: 0.50
Nodes (3): Decision, LABEL, TONE

## Knowledge Gaps
- **1134 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1129 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `userCan`, `card.tsx`, `lib/session.ts`, `lib/labels.ts`, `utils.ts`, `notifyUser`, `requireModule`, `getCompanyScope`, `requireUser`, `budget-forms.tsx`, `toNumber`, `hasGlobalView`, `[dossierId]/page.tsx`, `batch-runner.ts`, `anpp-process.tsx`, `fdStr`, `upload/session.ts`, `rules/engine.ts`, `corpus/page.tsx`, `notifyRoles`, `care-actions.ts`, `aiConfigured`, `drive-storage.ts`, `assistant-actions.ts`, `dossier-chat.ts`, `workflow/engine.ts`, `test-center/runner.ts`, `sponsoring/[id]/page.tsx`, `users/[id]/page.tsx`, `getCurrentUser`, `promo-material-actions.ts`, `regCan`, `library-actions.ts`, `onlyofficeConfigured`, `calendar.ts`, `formatCurrency`, `medical-directory.tsx`, `jobs/runner.ts`, `build-facts.ts`, `rbac.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `platform-audit/engine.ts`, `assistant.ts`, `dossier-actions.ts`, `entity-access.ts`, `ingest-dossier.ts`, `library-ingest.ts`, `getAppSettings`, `drive-actions.ts`, `create-record-button.tsx`, `pilotage/page.tsx`, `ocr-engine.ts`, `generate.ts`, `medical-actions.ts`, `auth.ts`, `adoption.ts`, `budgets/page.tsx`, `bd-strategic-table.tsx`, `releaseBlob`, `validation-actions.ts`, `budgets/departements/page.tsx`, `pipeline.upload.e2e.test.ts`, `queries/messaging.ts`, `brain-cockpit.tsx`, `events/[id]/page.tsx`, `espace/[id]/page.tsx`, `mail.ts`, `smart-mail-actions.ts`, `(app)/layout.tsx`, `meetings/[id]/page.tsx`, `field-reports.ts`, `lib/ai.ts`, `company.ts`, `lifecycle/actions.ts`, `portfolio.ts`, `explorer.ts`, `invariants/registry.ts`, `migration-cert.ts`, `pch-tender-line-actions.ts`, `validations.ts`, `risks.ts`, `meetings.ts`, `adventum-brain/page.tsx`, `promo-material/[id]/page.tsx`, `lib/messaging.ts`, `supplier/actions.ts`, `budget-envelope-actions.ts`, `departments.ts`, `stream/route.ts`, `market-research.ts`, `congress.ts`, `run.ts`, `support-actions.ts`, `topbar.tsx`, `ad-pro-item-actions.ts`, `beneficiaries-card.tsx`, `payroll-hr-actions.ts`, `drive-space-manager.tsx`, `pch.ts`, `supplier-portal-actions.ts`, `event-actions.ts`, `compare-versions.ts`, `drive/[id]/page.tsx`, `event-form.tsx`, `department-actions.ts`, `process-intelligence.ts`, `pch/export/route.ts`, `adoption-settings.tsx`, `push.ts`, `daily-brief.ts`, `stock-snapshot-actions.ts`, `hr-documents.ts`, `org-chart-editor.tsx`, `adventum-actions.ts`, `reserves/actions.ts`, `regulatory-requests.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `meetings/page.tsx`, `mail-diagnostic/route.ts`, `support-flow.test.ts`, `mail-actions.ts`, `impersonation-actions.ts`, `dossiers.ts`, `scheduled.ts`, `[token]/route.ts`, `events/[id]/export/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `userCan`, `card.tsx`, `lib/session.ts`, `lib/labels.ts`, `utils.ts`, `notifyUser`, `requireModule`, `getCompanyScope`, `budget-forms.tsx`, `hasGlobalView`, `anpp-process.tsx`, `fdStr`, `rules/engine.ts`, `corpus/page.tsx`, `notifyRoles`, `care-actions.ts`, `aiConfigured`, `assistant-actions.ts`, `test-center/runner.ts`, `sponsoring/[id]/page.tsx`, `users/[id]/page.tsx`, `getCurrentUser`, `promo-material-actions.ts`, `regCan`, `library-actions.ts`, `onlyofficeConfigured`, `rbac.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `platform-audit/engine.ts`, `dossier-actions.ts`, `entity-access.ts`, `getAppSettings`, `drive-actions.ts`, `create-record-button.tsx`, `generate.ts`, `medical-actions.ts`, `releaseBlob`, `validation-actions.ts`, `budgets/departements/page.tsx`, `brain-cockpit.tsx`, `events/[id]/page.tsx`, `smart-mail-actions.ts`, `(app)/layout.tsx`, `lib/ai.ts`, `messenger.tsx`, `lifecycle/actions.ts`, `pch-tender-line-actions.ts`, `mail-client.tsx`, `lib/messaging.ts`, `molecule-panel.tsx`, `supplier/actions.ts`, `budget-envelope-actions.ts`, `stream/route.ts`, `congress.ts`, `run.ts`, `support-actions.ts`, `ad-pro-item-actions.ts`, `beneficiaries-card.tsx`, `payroll-hr-actions.ts`, `drive-space-manager.tsx`, `onboarding-wizard.tsx`, `event-actions.ts`, `department-actions.ts`, `adoption-settings.tsx`, `daily-brief.ts`, `stock-snapshot-actions.ts`, `org-chart-editor.tsx`, `aiModel`, `adventum-actions.ts`, `reserves/actions.ts`, `regulatory-requests.ts`, `reminder-actions.ts`, `support-flow.test.ts`, `mail-actions.ts`, `dossiers.ts`, `change-password-form.tsx`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `event-actions.ts`, `card.tsx`, `messaging/messages/route.ts`, `lib/session.ts`, `utils.ts`, `drive/[id]/page.tsx`, `notifyUser`, `requireModule`, `lib/labels.ts`, `pch/export/route.ts`, `budget-forms.tsx`, `toNumber`, `hasGlobalView`, `prisma.ts`, `requireUser`, `stock-snapshot-actions.ts`, `anpp-process.tsx`, `fdStr`, `notifyRoles`, `care-actions.ts`, `reminder-actions.ts`, `drive-storage.ts`, `assistant-actions.ts`, `mail-diagnostic/route.ts`, `sponsoring/[id]/page.tsx`, `getCurrentUser`, `users/[id]/page.tsx`, `support-flow.test.ts`, `department-actions.ts`, `promo-material-actions.ts`, `onlyofficeConfigured`, `calendar.ts`, `formatCurrency`, `dossiers.ts`, `medical-directory.tsx`, `rbac.ts`, `messaging-actions.ts`, `sales-planning-actions.ts`, `assistant.ts`, `dossier-actions.ts`, `entity-access.ts`, `product-explorer.tsx`, `drive-actions.ts`, `create-record-button.tsx`, `pilotage/page.tsx`, `events/[id]/export/route.ts`, `medical-actions.ts`, `adoption.ts`, `validation-actions.ts`, `budgets/departements/page.tsx`, `queries/messaging.ts`, `events/[id]/page.tsx`, `espace/[id]/page.tsx`, `(app)/layout.tsx`, `field-reports.ts`, `lib/ai.ts`, `pch-tender-line-actions.ts`, `mail-client.tsx`, `validations.ts`, `adventum-brain/page.tsx`, `promo-material/[id]/page.tsx`, `lib/messaging.ts`, `molecule-panel.tsx`, `budget-envelope-actions.ts`, `stream/route.ts`, `market-research.ts`, `congress.ts`, `support-actions.ts`, `ad-pro-item-actions.ts`, `[versionId]/route.ts`, `payroll-hr-actions.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1134 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.04875621890547264 - nodes in this community are weakly interconnected._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04515255905511811 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06910569105691057 - nodes in this community are weakly interconnected._