# Graph Report - src  (2026-08-05)

## Corpus Check
- 853 files · ~573,567 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5130 nodes · 20196 edges · 179 communities (173 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0bf2a0d7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- formatDate
- utils.ts
- rbac.ts
- userCan
- lib/labels.ts
- promo-material-actions.ts
- card.tsx
- lib/session.ts
- regCan
- test-center/runner.ts
- notifyUser
- formatDateTime
- mon-espace/page.tsx
- mistral-ocr.ts
- button.tsx
- rules/engine.ts
- meeting-actions.ts
- prisma.ts
- fdStr
- getBlob
- aiConfigured
- users/[id]/page.tsx
- FindingInput
- requireUser
- assistant-actions.ts
- upload/session.ts
- medical-directory.tsx
- [dossierId]/page.tsx
- sales-planning-actions.ts
- canAccessEntity
- anpp-process.tsx
- input.tsx
- queries/messaging.ts
- drive-actions.ts
- adoption.ts
- intelligence/actions.ts
- build-facts.ts
- message-thread.tsx
- assistant.ts
- agent-core.ts
- molecule.ts
- platform-audit/engine.ts
- jobs/runner.ts
- market-research.ts
- entity-access.ts
- ingest-dossier.ts
- brain-cockpit.tsx
- regulatory/page.tsx
- workflow/engine.ts
- object-storage.ts
- lib/ai.ts
- dossier-actions.ts
- storage.ts
- features.ts
- lib/messaging.ts
- messaging-actions.ts
- auth.ts
- settings.ts
- hr-document-actions.ts
- (app)/layout.tsx
- market/engine.ts
- getAppSettings
- rules/admin-actions.ts
- Select
- adventum-brain/page.tsx
- molecule-panel.tsx
- admin-request-actions.ts
- document-preview.tsx
- corpus/actions.ts
- competition.ts
- congress-request-actions.ts
- mail.ts
- getCurrentUser
- smart-mail-actions.ts
- departments-manager.tsx
- pch-tender-line-actions.ts
- budget.ts
- calendar.ts
- workflow.ts
- lifecycle/actions.ts
- regAudit
- explorer.ts
- migration-cert.ts
- event-form.tsx
- enregistrement/page.tsx
- regulatory-request-actions.ts
- onboarding-wizard.tsx
- extract-text.ts
- field-reports.ts
- budget-forms.tsx
- budget-envelope-actions.ts
- regulatory/[id]/page.tsx
- regulatory-actions.ts
- extract-facts.ts
- risks.ts
- generate.ts
- invariants/registry.ts
- upload-manager.tsx
- product-explorer.tsx
- congress.ts
- mail-client.tsx
- support-actions.ts
- process-intelligence.ts
- payroll-hr-actions.ts
- auth-actions.ts
- review-agent.ts
- workflow-builder.tsx
- directive-actions.ts
- new-conversation.tsx
- run.ts
- departments.ts
- validation-actions.ts
- drive-space-manager.tsx
- office-templates.ts
- messenger.tsx
- tender-lines.tsx
- pch.ts
- today.ts
- pch/export/route.ts
- event-actions.ts
- pipeline.upload.e2e.test.ts
- compare-versions.ts
- new-request.tsx
- stock-snapshot-actions.ts
- supplier-auth.ts
- topbar.tsx
- hr-documents.ts
- push.ts
- organigramme/page.tsx
- node-actions.tsx
- supplies-manager.tsx
- background-upload.tsx
- reminder-actions.ts
- congress-beneficiary-actions.ts
- getMessage
- radar.ts
- regulatory-drive-mirror.ts
- congress-workflow.tsx
- bd.ts
- mail-diagnostic/route.ts
- database-admin-actions.ts
- meetings/page.tsx
- workflow-actions.ts
- assistant-files.ts
- withImap
- fuzz.ts
- Adventum Autonomous Test Center — architecture
- message/route.ts
- formatAlgiers
- upload-button.tsx
- step-timeline.tsx
- scheduled.ts
- congress-request-form.tsx
- courses-board.tsx
- delegate-plans.tsx
- forecast-grid.tsx
- push-register.tsx
- [token]/route.ts
- pch-detail-client.tsx
- payroll-matrix.tsx
- validation-item-review.tsx
- assistant-nudge.test.ts
- decompose.ts
- next-auth.d.ts
- ai-settings-form.tsx
- bv-requests.tsx
- activity-tracker.tsx
- notification-chime.tsx
- attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 556 edges
2. `userCan()` - 439 edges
3. `fdStr()` - 422 edges
4. `recordAudit()` - 377 edges
5. `prisma` - 356 edges
6. `requireModule()` - 208 edges
7. `hasGlobalView()` - 147 edges
8. `Button` - 145 edges
9. `cn()` - 139 edges
10. `formatDate()` - 129 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `OrganigrammePage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/page.tsx → src/lib/session.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (179 total, 6 thin omitted)

### Community 0 - "formatDate"
Cohesion: 0.03
Nodes (117): AdminValidationsPage(), dec(), dynamic, FocusCard(), CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt (+109 more)

### Community 1 - "utils.ts"
Cohesion: 0.06
Nodes (90): dynamic, dynamic, TrashItem, TrashList(), TYPES, AdminPage(), fmtBytes(), fmtWhen() (+82 more)

### Community 2 - "rbac.ts"
Cohesion: 0.04
Nodes (98): BD_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), CorbeillePage(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, DirectiveDetailPage() (+90 more)

### Community 3 - "userCan"
Cohesion: 0.05
Nodes (107): FieldsManager(), ImpersonateButton(), PayButton(), CancelButton(), CancelButton(), CreateRecordButtonProps, AVATAR_COLORS, createUser() (+99 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.04
Nodes (72): ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BudgetRow, MONTHS (+64 more)

### Community 5 - "promo-material-actions.ts"
Cohesion: 0.07
Nodes (72): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+64 more)

### Community 6 - "card.tsx"
Cohesion: 0.04
Nodes (66): ActivityPage(), fmtDuration(), dynamic, metadata, AiSettingsForm(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+58 more)

### Community 7 - "lib/session.ts"
Cohesion: 0.05
Nodes (70): dynamic, EntitesPage(), FieldDefDTO, CustomFieldsPage(), AdminWorkflowsPage(), dynamic, dynamic, MarketResearchListPage() (+62 more)

### Community 8 - "regCan"
Cohesion: 0.05
Nodes (61): dynamic, GET(), INLINE_MIME, runtime, dynamic, GET(), runtime, dynamic (+53 more)

### Community 9 - "test-center/runner.ts"
Cohesion: 0.05
Nodes (60): fmt(), pct(), TestCenterPage(), LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup() (+52 more)

### Community 10 - "notifyUser"
Cohesion: 0.06
Nodes (68): RevisionRequest(), decideApproval(), runAutopilot(), submitEventForApproval(), cancelExpenseOrder(), nextFinanceRef(), requestBudgetRevision(), requestInvoice() (+60 more)

### Community 11 - "formatDateTime"
Cohesion: 0.05
Nodes (57): ActivityTable(), AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, MailTester(), CourrierAdminPage(), dynamic (+49 more)

### Community 12 - "mon-espace/page.tsx"
Cohesion: 0.06
Nodes (51): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, DirectivesPage() (+43 more)

### Community 13 - "mistral-ocr.ts"
Cohesion: 0.06
Nodes (52): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, backoffMs(), blankPages() (+44 more)

### Community 14 - "button.tsx"
Cohesion: 0.07
Nodes (38): Option, RuleDTO, ProjectStatusBadge(), MONTH_LABELS, SheetMode, WEEKDAYS, RestoreButton(), U (+30 more)

### Community 15 - "rules/engine.ts"
Cohesion: 0.06
Nodes (52): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+44 more)

### Community 16 - "meeting-actions.ts"
Cohesion: 0.06
Nodes (52): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+44 more)

### Community 17 - "prisma.ts"
Cohesion: 0.08
Nodes (28): dynamic, GET(), dynamic, addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder() (+20 more)

### Community 18 - "fdStr"
Cohesion: 0.07
Nodes (55): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, ShareRow(), ReportEditor() (+47 more)

### Community 19 - "getBlob"
Cohesion: 0.08
Nodes (45): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), POST(), GET() (+37 more)

### Community 20 - "aiConfigured"
Cohesion: 0.08
Nodes (47): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+39 more)

### Community 21 - "users/[id]/page.tsx"
Cohesion: 0.07
Nodes (44): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, AccessByModulePage(), ACTION_FR (+36 more)

### Community 22 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 23 - "requireUser"
Cohesion: 0.07
Nodes (42): CorbeillePage(), EntitiesManager(), ActiveToggle(), PresentationCard(), PresentationPanel(), Res, EventDetail(), EventForm() (+34 more)

### Community 24 - "assistant-actions.ts"
Cohesion: 0.10
Nodes (40): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), MessageBubble(), Msg, nextId() (+32 more)

### Community 25 - "upload/session.ts"
Cohesion: 0.08
Nodes (39): dynamic, POST(), runtime, dynamic, maxDuration, POST(), runtime, dynamic (+31 more)

### Community 26 - "medical-directory.tsx"
Cohesion: 0.08
Nodes (43): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER (+35 more)

### Community 27 - "[dossierId]/page.tsx"
Cohesion: 0.08
Nodes (40): AgentItem, AgentsPanel(), RunState, DocgenPanel(), GenDoc, Template, DossierDetailPage(), dynamic (+32 more)

### Community 28 - "sales-planning-actions.ts"
Cohesion: 0.08
Nodes (38): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, BU, CatalogueManager() (+30 more)

### Community 29 - "canAccessEntity"
Cohesion: 0.09
Nodes (39): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+31 more)

### Community 30 - "anpp-process.tsx"
Cohesion: 0.10
Nodes (39): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryPresubOutcome(), setRegulatoryStepNote(), setRegulatoryStepState() (+31 more)

### Community 31 - "input.tsx"
Cohesion: 0.09
Nodes (23): DriveStorageSettings(), EntityRow, PALETTE, Citation, Source, Version, ENV_LABEL, MODES (+15 more)

### Community 32 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (35): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+27 more)

### Community 33 - "drive-actions.ts"
Cohesion: 0.13
Nodes (31): DocumentEditPage(), dynamic, ENTITY_ROUTE, ConvertPdfButton(), OfficeEditor(), originOf(), Window, DriveEditPage() (+23 more)

### Community 34 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 35 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (33): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+25 more)

### Community 36 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, handleFacts(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn (+20 more)

### Community 37 - "message-thread.tsx"
Cohesion: 0.11
Nodes (30): MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS (+22 more)

### Community 38 - "assistant.ts"
Cohesion: 0.08
Nodes (37): callClaude(), activeUserId(), AssistantActionKind, AssistantActionPayload, AssistantResult, asStr(), buildContext(), buildProposal() (+29 more)

### Community 39 - "agent-core.ts"
Cohesion: 0.10
Nodes (25): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+17 more)

### Community 40 - "molecule.ts"
Cohesion: 0.13
Nodes (33): dynamic, MarketProductsPage(), analyzeMoleculeSafe(), NomRow, Agg, analyzeMolecule(), canonicalForm(), clean() (+25 more)

### Community 41 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 42 - "jobs/runner.ts"
Cohesion: 0.12
Nodes (33): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+25 more)

### Community 43 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 44 - "entity-access.ts"
Cohesion: 0.13
Nodes (31): GET(), SearchPage(), executeReadTool(), ENTITY_MODULE, addDays(), bdSection(), budgetsSection(), congressSection() (+23 more)

### Community 45 - "ingest-dossier.ts"
Cohesion: 0.11
Nodes (33): sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile(), IngestSummary, isStorable(), maxPgBlobBytes() (+25 more)

### Community 46 - "brain-cockpit.tsx"
Cohesion: 0.09
Nodes (27): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+19 more)

### Community 47 - "regulatory/page.tsx"
Cohesion: 0.09
Nodes (29): DciAssociationField(), EditProductButton(), EditProductValues, UserOption, NewProductButton(), UserOption, regStage(), RegulatoryPage() (+21 more)

### Community 48 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (31): getManagerOfUser(), getWorkflowDefinitions(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep() (+23 more)

### Community 49 - "object-storage.ts"
Cohesion: 0.14
Nodes (31): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+23 more)

### Community 50 - "lib/ai.ts"
Cohesion: 0.09
Nodes (26): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock, askClaude(), AskOptions (+18 more)

### Community 51 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (29): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite (+21 more)

### Community 52 - "storage.ts"
Cohesion: 0.12
Nodes (24): GET(), POST(), dynamic, GET(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord() (+16 more)

### Community 53 - "features.ts"
Cohesion: 0.12
Nodes (25): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+17 more)

### Community 54 - "lib/messaging.ts"
Cohesion: 0.10
Nodes (24): dynamic, NO_CONTENT, POST(), dynamic, POST(), DOT, MyStatus(), setMessagingStatus() (+16 more)

### Community 55 - "messaging-actions.ts"
Cohesion: 0.17
Nodes (29): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), createChannel() (+21 more)

### Community 56 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 57 - "settings.ts"
Cohesion: 0.12
Nodes (26): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+18 more)

### Community 58 - "hr-document-actions.ts"
Cohesion: 0.14
Nodes (25): ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), applyAnnualLeaveBalance(), archiveHrRequestIfDone(), daysInclusive() (+17 more)

### Community 59 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (20): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), isActive(), MobileTabBar(), PRIMARY (+12 more)

### Community 60 - "market/engine.ts"
Cohesion: 0.11
Nodes (27): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, MarketMeta, PchRow, SRC_IQVIA (+19 more)

### Community 61 - "getAppSettings"
Cohesion: 0.14
Nodes (22): dynamic, POST(), POST(), dynamic, POST(), dynamic, POST(), DatabasesPage() (+14 more)

### Community 62 - "rules/admin-actions.ts"
Cohesion: 0.13
Nodes (23): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+15 more)

### Community 63 - "Select"
Cohesion: 0.07
Nodes (22): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, DeleteVisitButton(), EditVisitSheet(), Opt, Result (+14 more)

### Community 64 - "adventum-brain/page.tsx"
Cohesion: 0.13
Nodes (23): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), updateRiskThresholds(), diff(), getPulse(), hourBucket() (+15 more)

### Community 65 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 66 - "admin-request-actions.ts"
Cohesion: 0.12
Nodes (28): RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields(), collectFields() (+20 more)

### Community 67 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 68 - "corpus/actions.ts"
Cohesion: 0.12
Nodes (19): CorpusAdmin(), dynamic, metadata, RegulatoryCorpusPage(), canManage(), createCorpusSourceVersion(), Result, searchCorpusAction() (+11 more)

### Community 69 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 70 - "congress-request-actions.ts"
Cohesion: 0.22
Nodes (24): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+16 more)

### Community 71 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 72 - "getCurrentUser"
Cohesion: 0.10
Nodes (21): dynamic, GET(), dynamic, esc(), GET(), dynamic, GET(), DELETE() (+13 more)

### Community 73 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 74 - "departments-manager.tsx"
Cohesion: 0.16
Nodes (23): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+15 more)

### Community 75 - "pch-tender-line-actions.ts"
Cohesion: 0.19
Nodes (24): analyzeTenderDocument(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+16 more)

### Community 76 - "budget.ts"
Cohesion: 0.13
Nodes (18): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView (+10 more)

### Community 77 - "calendar.ts"
Cohesion: 0.18
Nodes (22): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+14 more)

### Community 78 - "workflow.ts"
Cohesion: 0.13
Nodes (22): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, WorkflowActionView, WorkflowEventView, WorkflowOutcome, WorkflowStepView (+14 more)

### Community 79 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 80 - "regAudit"
Cohesion: 0.20
Nodes (20): Question, Req, STATUS, SupplierPanel(), regAudit(), createSupplierRequest(), deleteSupplierRequest(), guard() (+12 more)

### Community 81 - "explorer.ts"
Cohesion: 0.18
Nodes (19): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants() (+11 more)

### Community 82 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 83 - "event-form.tsx"
Cohesion: 0.12
Nodes (18): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), PARTICIPANT_ROLE (+10 more)

### Community 84 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 85 - "regulatory-request-actions.ts"
Cohesion: 0.17
Nodes (21): RegulatoryRequestDetailPage(), RegulatoryRequestsPage(), RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible(), parseCategory() (+13 more)

### Community 86 - "onboarding-wizard.tsx"
Cohesion: 0.11
Nodes (17): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+9 more)

### Community 87 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 88 - "field-reports.ts"
Cohesion: 0.12
Nodes (18): dynamic, POST(), dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle (+10 more)

### Community 89 - "budget-forms.tsx"
Cohesion: 0.18
Nodes (21): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CreateEnvelopeButton() (+13 more)

### Community 90 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (22): CategorySheet(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+14 more)

### Community 91 - "regulatory/[id]/page.tsx"
Cohesion: 0.12
Nodes (18): BvItem, Info(), REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), ParticipantsPanel(), SupervisionControls(), SupplierViewCard() (+10 more)

### Community 92 - "regulatory-actions.ts"
Cohesion: 0.14
Nodes (20): StatusEditor(), VariationDTO, VariationPanel(), createVariation(), deleteVariation(), ensureRegSupervisor(), normalizeDci(), parseProductChannel() (+12 more)

### Community 93 - "extract-facts.ts"
Cohesion: 0.17
Nodes (20): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromDocuments(), extractFactsFromText(), FactHit (+12 more)

### Community 94 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 95 - "generate.ts"
Cohesion: 0.18
Nodes (17): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+9 more)

### Community 96 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 97 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 98 - "product-explorer.tsx"
Cohesion: 0.18
Nodes (17): fmtDzd(), fmtPct(), fmtPrice(), fmtUsd(), pctTone(), ProductExplorer(), SuggestField(), analyzeMarketMolecule() (+9 more)

### Community 99 - "congress.ts"
Cohesion: 0.22
Nodes (17): CongressTable(), CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), EVENTS_TABS, CongressDetail, CongressListRow, CongressType (+9 more)

### Community 100 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 101 - "support-actions.ts"
Cohesion: 0.23
Nodes (16): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+8 more)

### Community 102 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label() (+9 more)

### Community 103 - "payroll-hr-actions.ts"
Cohesion: 0.20
Nodes (17): POST(), connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), canRunPayroll(), markSalaryPaid(), transferPayrollToBudget() (+9 more)

### Community 104 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 105 - "review-agent.ts"
Cohesion: 0.16
Nodes (14): extractJson(), aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding, AiFindingSchema, AiFn, AiOutputSchema (+6 more)

### Community 106 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (12): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), EventFundingPanel(), PmOpt, SubmitButton(), rolesText() (+4 more)

### Community 107 - "directive-actions.ts"
Cohesion: 0.24
Nodes (15): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+7 more)

### Community 108 - "new-conversation.tsx"
Cohesion: 0.16
Nodes (14): Props, Props, fd(), MemberMultiSelect(), Mode, NewConversation(), Props, SearchBox() (+6 more)

### Community 109 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 110 - "departments.ts"
Cohesion: 0.20
Nodes (15): buildTree(), DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentOptions(), getDepartmentPath(), getDepartmentTree() (+7 more)

### Community 111 - "validation-actions.ts"
Cohesion: 0.17
Nodes (16): RuleControls(), RuleEditor(), clearValidationItem(), createValidationRule(), decideValidation(), deleteValidationRule(), ITEM_DECISIONS, PRIORITIES (+8 more)

### Community 112 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 113 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 114 - "messenger.tsx"
Cohesion: 0.23
Nodes (13): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), bumpConversation(), Messenger(), bookmarkMessage() (+5 more)

### Community 115 - "tender-lines.tsx"
Cohesion: 0.20
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderText() (+6 more)

### Community 116 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 117 - "today.ts"
Cohesion: 0.20
Nodes (13): CalendarEventDTO, ActionItem, getToday(), greetingFor(), rankToday(), reasonOf(), REASONS, score() (+5 more)

### Community 118 - "pch/export/route.ts"
Cohesion: 0.24
Nodes (11): GET(), loadNdjson(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader (+3 more)

### Community 119 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 120 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.21
Nodes (13): runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs(), buildMessyDossierZip() (+5 more)

### Community 121 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 122 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 123 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 124 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 125 - "topbar.tsx"
Cohesion: 0.24
Nodes (10): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+2 more)

### Community 126 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 127 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 128 - "organigramme/page.tsx"
Cohesion: 0.29
Nodes (8): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage()

### Community 129 - "node-actions.tsx"
Cohesion: 0.23
Nodes (8): FileActions(), ShareItem, SharePanel(), MoveTarget, NodeActions(), Props, UserLite, renameNode()

### Community 130 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 131 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 132 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 133 - "congress-beneficiary-actions.ts"
Cohesion: 0.42
Nodes (10): addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf(), removeCongressBeneficiary() (+2 more)

### Community 134 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 135 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 136 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 137 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 138 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 139 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 140 - "database-admin-actions.ts"
Cohesion: 0.44
Nodes (7): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs()

### Community 141 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), Row, Section(), STATUS

### Community 142 - "workflow-actions.ts"
Cohesion: 0.36
Nodes (8): advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep(), saveWorkflowDefinition(), WORKFLOW_ENTITIES, isWorkflowCategory()

### Community 143 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 144 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 145 - "fuzz.ts"
Cohesion: 0.39
Nodes (8): probeUploads(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing(), SAFE, makeRng()

### Community 146 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 147 - "message/route.ts"
Cohesion: 0.32
Nodes (6): dynamic, GET(), dynamic, GET(), friendlyMailError(), MailMessage

### Community 148 - "formatAlgiers"
Cohesion: 0.36
Nodes (7): CalendarView(), colorOf(), MeetingControls(), confirmHrMeeting(), createEventForUser(), formatAlgiers(), formatAlgiersDisplay()

### Community 149 - "upload-button.tsx"
Cohesion: 0.32
Nodes (7): CATEGORY_SUGGESTIONS, Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload()

### Community 150 - "step-timeline.tsx"
Cohesion: 0.29
Nodes (7): STATUS_ICON, STATUS_RING, StepItem, StepTimeline(), updateRegulatoryStep(), REGULATORY_STEP_TYPE, STEP_STATUS

### Community 151 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 152 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 153 - "courses-board.tsx"
Cohesion: 0.38
Nodes (6): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 154 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 155 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 156 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 157 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 158 - "pch-detail-client.tsx"
Cohesion: 0.40
Nodes (4): Action, EditTenderButton(), useSubmit(), PCH_ORDER_STATUS

### Community 159 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 160 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 161 - "assistant-nudge.test.ts"
Cohesion: 0.47
Nodes (4): assistantNudge(), getUnreadDigest(), InboxDigest, actorFor()

### Community 162 - "decompose.ts"
Cohesion: 0.53
Nodes (4): CATEGORIES, categorizeReserve(), decomposeReserveText(), ReservePoint

### Community 163 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 164 - "ai-settings-form.tsx"
Cohesion: 0.40
Nodes (4): AiSettings, FeatureKey, FEATURES, Toggle()

### Community 165 - "bv-requests.tsx"
Cohesion: 0.60
Nodes (4): BV_STATUS, BvRequests(), fmtDate(), fmtDZD()

### Community 166 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 167 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 168 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 169 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 170 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1029 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1024 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `formatDate`, `utils.ts`, `rbac.ts`, `userCan`, `lib/labels.ts`, `promo-material-actions.ts`, `card.tsx`, `lib/session.ts`, `regCan`, `test-center/runner.ts`, `notifyUser`, `formatDateTime`, `mon-espace/page.tsx`, `meeting-actions.ts`, `fdStr`, `getBlob`, `aiConfigured`, `users/[id]/page.tsx`, `requireUser`, `assistant-actions.ts`, `upload/session.ts`, `medical-directory.tsx`, `[dossierId]/page.tsx`, `sales-planning-actions.ts`, `canAccessEntity`, `queries/messaging.ts`, `drive-actions.ts`, `adoption.ts`, `intelligence/actions.ts`, `build-facts.ts`, `assistant.ts`, `agent-core.ts`, `platform-audit/engine.ts`, `jobs/runner.ts`, `market-research.ts`, `entity-access.ts`, `ingest-dossier.ts`, `brain-cockpit.tsx`, `regulatory/page.tsx`, `workflow/engine.ts`, `lib/ai.ts`, `dossier-actions.ts`, `storage.ts`, `features.ts`, `lib/messaging.ts`, `messaging-actions.ts`, `auth.ts`, `settings.ts`, `hr-document-actions.ts`, `(app)/layout.tsx`, `getAppSettings`, `rules/admin-actions.ts`, `adventum-brain/page.tsx`, `admin-request-actions.ts`, `corpus/actions.ts`, `congress-request-actions.ts`, `mail.ts`, `getCurrentUser`, `smart-mail-actions.ts`, `departments-manager.tsx`, `pch-tender-line-actions.ts`, `budget.ts`, `calendar.ts`, `workflow.ts`, `lifecycle/actions.ts`, `regAudit`, `explorer.ts`, `migration-cert.ts`, `event-form.tsx`, `regulatory-request-actions.ts`, `onboarding-wizard.tsx`, `field-reports.ts`, `budget-envelope-actions.ts`, `regulatory/[id]/page.tsx`, `regulatory-actions.ts`, `risks.ts`, `generate.ts`, `invariants/registry.ts`, `congress.ts`, `support-actions.ts`, `process-intelligence.ts`, `payroll-hr-actions.ts`, `auth-actions.ts`, `directive-actions.ts`, `run.ts`, `departments.ts`, `validation-actions.ts`, `drive-space-manager.tsx`, `pch.ts`, `pch/export/route.ts`, `event-actions.ts`, `pipeline.upload.e2e.test.ts`, `compare-versions.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `hr-documents.ts`, `push.ts`, `organigramme/page.tsx`, `supplies-manager.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `regulatory-drive-mirror.ts`, `bd.ts`, `mail-diagnostic/route.ts`, `database-admin-actions.ts`, `meetings/page.tsx`, `workflow-actions.ts`, `scheduled.ts`, `[token]/route.ts`, `assistant-nudge.test.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `utils.ts`, `rbac.ts`, `userCan`, `lib/labels.ts`, `congress-beneficiary-actions.ts`, `card.tsx`, `node-actions.tsx`, `promo-material-actions.ts`, `supplies-manager.tsx`, `notifyUser`, `formatDateTime`, `mon-espace/page.tsx`, `database-admin-actions.ts`, `test-center/runner.ts`, `workflow-actions.ts`, `meeting-actions.ts`, `regCan`, `fdStr`, `getBlob`, `formatAlgiers`, `users/[id]/page.tsx`, `step-timeline.tsx`, `aiConfigured`, `assistant-actions.ts`, `reminder-actions.ts`, `medical-directory.tsx`, `sales-planning-actions.ts`, `canAccessEntity`, `anpp-process.tsx`, `drive-actions.ts`, `assistant-nudge.test.ts`, `intelligence/actions.ts`, `lib/session.ts`, `platform-audit/engine.ts`, `entity-access.ts`, `brain-cockpit.tsx`, `lib/ai.ts`, `dossier-actions.ts`, `storage.ts`, `features.ts`, `lib/messaging.ts`, `messaging-actions.ts`, `settings.ts`, `hr-document-actions.ts`, `(app)/layout.tsx`, `getAppSettings`, `rules/admin-actions.ts`, `adventum-brain/page.tsx`, `admin-request-actions.ts`, `corpus/actions.ts`, `congress-request-actions.ts`, `smart-mail-actions.ts`, `departments-manager.tsx`, `pch-tender-line-actions.ts`, `lifecycle/actions.ts`, `regAudit`, `regulatory-request-actions.ts`, `onboarding-wizard.tsx`, `budget-envelope-actions.ts`, `regulatory/[id]/page.tsx`, `regulatory-actions.ts`, `product-explorer.tsx`, `congress.ts`, `support-actions.ts`, `payroll-hr-actions.ts`, `auth-actions.ts`, `directive-actions.ts`, `new-conversation.tsx`, `run.ts`, `validation-actions.ts`, `drive-space-manager.tsx`, `messenger.tsx`, `tender-lines.tsx`, `event-actions.ts`, `stock-snapshot-actions.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `formatDate`, `utils.ts`, `rbac.ts`, `supplies-manager.tsx`, `lib/labels.ts`, `promo-material-actions.ts`, `card.tsx`, `lib/session.ts`, `reminder-actions.ts`, `test-center/runner.ts`, `notifyUser`, `mail-diagnostic/route.ts`, `formatDateTime`, `mon-espace/page.tsx`, `meeting-actions.ts`, `prisma.ts`, `fdStr`, `getBlob`, `formatAlgiers`, `users/[id]/page.tsx`, `requireUser`, `assistant-actions.ts`, `medical-directory.tsx`, `sales-planning-actions.ts`, `canAccessEntity`, `queries/messaging.ts`, `drive-actions.ts`, `adoption.ts`, `assistant.ts`, `market-research.ts`, `entity-access.ts`, `regulatory/page.tsx`, `lib/ai.ts`, `dossier-actions.ts`, `lib/messaging.ts`, `messaging-actions.ts`, `hr-document-actions.ts`, `(app)/layout.tsx`, `getAppSettings`, `adventum-brain/page.tsx`, `admin-request-actions.ts`, `congress-request-actions.ts`, `getCurrentUser`, `departments-manager.tsx`, `pch-tender-line-actions.ts`, `budget.ts`, `calendar.ts`, `regulatory-request-actions.ts`, `field-reports.ts`, `budget-envelope-actions.ts`, `regulatory/[id]/page.tsx`, `regulatory-actions.ts`, `product-explorer.tsx`, `congress.ts`, `support-actions.ts`, `process-intelligence.ts`, `payroll-hr-actions.ts`, `directive-actions.ts`, `new-conversation.tsx`, `validation-actions.ts`, `tender-lines.tsx`, `pch/export/route.ts`, `event-actions.ts`, `stock-snapshot-actions.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1029 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `formatDate` be split into smaller, more focused modules?**
  _Cohesion score 0.029449423815621 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06389505976938538 - nodes in this community are weakly interconnected._
- **Should `rbac.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03887795275590551 - nodes in this community are weakly interconnected._