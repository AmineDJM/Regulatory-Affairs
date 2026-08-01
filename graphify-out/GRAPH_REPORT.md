# Graph Report - src  (2026-08-01)

## Corpus Check
- 803 files · ~531,933 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4808 nodes · 18969 edges · 173 communities (167 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `08d2e3ed`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- button.tsx
- formatDate
- hasGlobalView
- page-header.tsx
- userCan
- lib/labels.ts
- getCurrentUser
- workflow/engine.ts
- brain-cockpit.tsx
- recordAudit
- requireModule
- regulatory/[id]/page.tsx
- requireUser
- assistant.ts
- [dossierId]/page.tsx
- utils.ts
- test-center/runner.ts
- FindingInput
- cn
- budget-board.tsx
- dossier-chat.ts
- admin-request-actions.ts
- (app)/validations/page.tsx
- upload/session.ts
- regulatory-actions.ts
- drive-storage.ts
- mistral-ocr.ts
- jobs/runner.ts
- promo-material-actions.ts
- prisma.ts
- onlyofficeConfigured
- ingest-dossier.ts
- enregistrement/page.tsx
- market-research.ts
- adoption.ts
- dossier-actions.ts
- platform-audit/engine.ts
- build-facts.ts
- field-report-actions.ts
- entity-access.ts
- document-preview.tsx
- sales-planning-actions.ts
- regAudit
- getAppSettings
- aiConfigured
- object-storage.ts
- pch-tender-line-actions.ts
- agent-core.ts
- SessionUser
- messaging-actions.ts
- rules/engine.ts
- hr-document-actions.ts
- generate.ts
- queries/messaging.ts
- drive/page.tsx
- medical-info-actions.ts
- message-thread.tsx
- auth.ts
- bd-strategic-table.tsx
- medical-actions.ts
- regulatory-request-actions.ts
- sectionByCode
- rules/admin-actions.ts
- competition.ts
- mail.ts
- rbac.ts
- calendar.ts
- lifecycle/actions.ts
- (app)/layout.tsx
- messenger.tsx
- extract-text.ts
- migration-cert.ts
- drive-actions.ts
- ocr-engine.ts
- marche/page.tsx
- meetings/[id]/page.tsx
- budget-envelope-actions.ts
- access-actions.ts
- pilotage/page.tsx
- onboarding-wizard.tsx
- extract-facts.ts
- explorer.ts
- invariants/registry.ts
- market-research-actions.ts
- upload-manager.tsx
- admin-delete-actions.ts
- admin-settings-forms.tsx
- mail-client.tsx
- drive/[id]/page.tsx
- field-reports.ts
- medical-directory.tsx
- meeting-actions.ts
- lib/messaging.ts
- evidence.ts
- messaging/messages/route.ts
- support-actions.ts
- auth-actions.ts
- data.ts
- events.ts
- meetings.ts
- office-templates.ts
- supplies-manager.tsx
- pch.ts
- process-intelligence.ts
- regulatory-corpus/page.tsx
- tender-lines.tsx
- anyRoleFilter
- topbar.tsx
- calendar-actions.ts
- new-request.tsx
- supplier/actions.ts
- stock-snapshot-actions.ts
- supplier-auth.ts
- hr-documents.ts
- review-agent.ts
- compare-versions.ts
- push.ts
- radar.ts
- ai-health.ts
- planning/page.tsx
- background-upload.tsx
- reminder-actions.ts
- getMessage
- regulatory-drive-mirror.ts
- mail-diagnostic/route.ts
- archive.ts
- congress-workflow.tsx
- report-editor.tsx
- meetings/page.tsx
- support-flow.test.ts
- ingest.ts
- calendar-view.tsx
- stocks-view.tsx
- sidebar.tsx
- withImap
- Adventum Autonomous Test Center — architecture
- message/route.ts
- org-chart-editor.tsx
- queries/admin-requests.ts
- drive-space-manager.tsx
- workflow-panel.tsx
- teams-manager.tsx
- scheduled.ts
- congress-request-form.tsx
- delegate-plans.tsx
- new-conversation.tsx
- forecast-grid.tsx
- push-register.tsx
- [token]/route.ts
- meetings/message-attachment/[id]/route.ts
- courses-board.tsx
- settings-form.tsx
- step-timeline.tsx
- employee-form.tsx
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- directives/[id]/panel.tsx
- chunk-text.ts
- attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- office-editor.tsx
- app/layout.tsx
- courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 529 edges
2. `userCan()` - 423 edges
3. `fdStr()` - 409 edges
4. `recordAudit()` - 362 edges
5. `prisma` - 341 edges
6. `requireModule()` - 194 edges
7. `hasGlobalView()` - 146 edges
8. `cn()` - 139 edges
9. `Button` - 138 edges
10. `formatDate()` - 122 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts
- `AutopilotConfirm()` --calls--> `runAutopilot()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/actions/adventum-actions.ts

## Import Cycles
- None detected.

## Communities (173 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.05
Nodes (80): ActivityPage(), fmtDuration(), dynamic, metadata, BD_DOC_CATEGORIES, BeneficiariesCard(), Beneficiary, Mode (+72 more)

### Community 1 - "button.tsx"
Cohesion: 0.05
Nodes (67): DriveStorageSettings(), PALETTE, ENV_LABEL, MODES, GrantOption, RowGrantsProps, Option, RuleDTO (+59 more)

### Community 2 - "formatDate"
Cohesion: 0.04
Nodes (88): dzd(), fmtPct(), MarketPricingPage(), StatBlock(), Budget(), ApprovalButtons(), ApprovalsPage(), RequestDetailPage() (+80 more)

### Community 3 - "hasGlobalView"
Cohesion: 0.05
Nodes (90): CorbeillePage(), addRequestComment(), decideApproval(), updateMission(), runAutopilot(), executeAssistantAction(), cancelCongressRequest(), CongressType (+82 more)

### Community 4 - "page-header.tsx"
Cohesion: 0.09
Nodes (58): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic (+50 more)

### Community 5 - "userCan"
Cohesion: 0.06
Nodes (88): PresentationCard(), Res, EditEventButton(), RegistrationsManager(), EditTransactionSheet(), RevisionRequest(), PayButton(), CancelButton() (+80 more)

### Community 6 - "lib/labels.ts"
Cohesion: 0.04
Nodes (76): AuditPanel(), AuditRow, AuditTable(), BudgetRow, BudgetsTable(), MONTHS, BDPipeline(), STAGES (+68 more)

### Community 7 - "getCurrentUser"
Cohesion: 0.05
Nodes (68): DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME, runtime, dynamic (+60 more)

### Community 8 - "workflow/engine.ts"
Cohesion: 0.05
Nodes (71): AdminWorkflowsPage(), dynamic, blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), Props, advanceWorkflow() (+63 more)

### Community 9 - "brain-cockpit.tsx"
Cohesion: 0.05
Nodes (69): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+61 more)

### Community 10 - "recordAudit"
Cohesion: 0.06
Nodes (64): EntitiesManager(), ActiveToggle(), ImpersonateButton(), SpaceSettingsButton(), CreateRecordButtonProps, resetActivityTime(), saveAdoptionSettings(), updateAiSettings() (+56 more)

### Community 11 - "requireModule"
Cohesion: 0.05
Nodes (63): FieldDefDTO, CustomFieldsPage(), OrganigrammePage(), AdminPage(), fmtBytes(), fmtWhen(), AdminValidationsPage(), dec() (+55 more)

### Community 12 - "regulatory/[id]/page.tsx"
Cohesion: 0.05
Nodes (55): OpeningBalance, DciAssociationField(), EditProductButton(), EditProductValues, UserOption, BV_STATUS, BvItem, BvRequests() (+47 more)

### Community 13 - "requireUser"
Cohesion: 0.07
Nodes (61): CorbeillePage(), FieldsManager(), VariationPanel(), createBD(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject() (+53 more)

### Community 14 - "assistant.ts"
Cohesion: 0.05
Nodes (57): ActionState, AssistantChat(), cleanReply(), MessageBubble(), Msg, nextId(), SUGGESTIONS, MedicalDirectory() (+49 more)

### Community 15 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (50): AgentItem, AgentsPanel(), RunState, ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, fmtDateTime() (+42 more)

### Community 16 - "utils.ts"
Cohesion: 0.06
Nodes (47): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, ActivityRow (+39 more)

### Community 17 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (45): fmt(), pct(), TestCenterPage(), LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup() (+37 more)

### Community 18 - "FindingInput"
Cohesion: 0.10
Nodes (43): accrualStep(), monthsBetweenYm(), validateDocumentUpload(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing() (+35 more)

### Community 19 - "cn"
Cohesion: 0.04
Nodes (45): AdoptionTable(), dynamic, metadata, AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle() (+37 more)

### Community 20 - "budget-board.tsx"
Cohesion: 0.07
Nodes (48): GET(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetBoard(), BudgetTotalInfo, BudgetTotalSheet() (+40 more)

### Community 21 - "dossier-chat.ts"
Cohesion: 0.08
Nodes (46): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, askDossierAction() (+38 more)

### Community 22 - "admin-request-actions.ts"
Cohesion: 0.07
Nodes (52): RuleControls(), RuleEditor(), RequestActions(), RequesterWindow(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields() (+44 more)

### Community 23 - "(app)/validations/page.tsx"
Cohesion: 0.06
Nodes (44): AssistantPage(), AdvanceItem, MyAdvances(), LeaveItem, MyLeaves(), MonEspacePage(), CourseDuration(), mapsUrl() (+36 more)

### Community 24 - "upload/session.ts"
Cohesion: 0.08
Nodes (42): dynamic, runtime, DELETE(), dynamic, GET(), runtime, scope(), IngestResult (+34 more)

### Community 25 - "regulatory-actions.ts"
Cohesion: 0.09
Nodes (44): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), SupervisionControls(), createRegulatoryProduct(), ensureRegSupervisor(), normalizeDci() (+36 more)

### Community 26 - "drive-storage.ts"
Cohesion: 0.08
Nodes (34): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+26 more)

### Community 27 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 28 - "jobs/runner.ts"
Cohesion: 0.09
Nodes (40): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS, MimeGuess (+32 more)

### Community 29 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 30 - "prisma.ts"
Cohesion: 0.07
Nodes (23): dynamic, GET(), dynamic, GET(), EntityRow, dynamic, EntitesPage(), CheckinConfirm() (+15 more)

### Community 31 - "onlyofficeConfigured"
Cohesion: 0.14
Nodes (33): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, DriveEditPage(), dynamic (+25 more)

### Community 32 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (36): dynamic, maxDuration, runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile() (+28 more)

### Community 33 - "enregistrement/page.tsx"
Cohesion: 0.09
Nodes (34): Citation, CorpusAdmin(), Source, Version, dynamic, dzd(), EnregistrementPage(), metadata (+26 more)

### Community 34 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 35 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 36 - "dossier-actions.ts"
Cohesion: 0.11
Nodes (35): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment (+27 more)

### Community 37 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+25 more)

### Community 38 - "build-facts.ts"
Cohesion: 0.10
Nodes (27): extractLooseJson(), repairAndParse(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS (+19 more)

### Community 39 - "field-report-actions.ts"
Cohesion: 0.11
Nodes (30): dynamic, POST(), dynamic, POST(), AiControlCenterPage(), ReportEditor(), SimpleReportEditor(), NewReportButton() (+22 more)

### Community 40 - "entity-access.ts"
Cohesion: 0.13
Nodes (32): GET(), SearchPage(), executeReadTool(), ENTITY_MODULE, isRequestOwner(), addDays(), bdSection(), budgetsSection() (+24 more)

### Community 41 - "document-preview.tsx"
Cohesion: 0.09
Nodes (27): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+19 more)

### Community 42 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, BU, CatalogueManager() (+24 more)

### Community 43 - "regAudit"
Cohesion: 0.11
Nodes (31): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+23 more)

### Community 44 - "getAppSettings"
Cohesion: 0.12
Nodes (26): POST(), dynamic, POST(), dynamic, POST(), dynamic, POST(), DatabasesPage() (+18 more)

### Community 45 - "aiConfigured"
Cohesion: 0.10
Nodes (31): dynamic, GET(), generateBriefing(), aiConfigured(), aiModel(), aiSelfTest(), analyzeFieldReport(), AnthropicBlock (+23 more)

### Community 46 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 47 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (33): enrichTenderLine(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine, getMarketData() (+25 more)

### Community 48 - "agent-core.ts"
Cohesion: 0.11
Nodes (23): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+15 more)

### Community 49 - "SessionUser"
Cohesion: 0.10
Nodes (18): DirectiveDetailPage(), actorFor(), actorFor(), actorFor(), actor(), actorFor(), actorFor(), actorFor() (+10 more)

### Community 50 - "messaging-actions.ts"
Cohesion: 0.15
Nodes (33): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+25 more)

### Community 51 - "rules/engine.ts"
Cohesion: 0.11
Nodes (25): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+17 more)

### Community 52 - "hr-document-actions.ts"
Cohesion: 0.14
Nodes (27): ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), applyAnnualLeaveBalance(), archiveHrRequestIfDone() (+19 more)

### Community 53 - "generate.ts"
Cohesion: 0.12
Nodes (23): DocgenPanel(), GenDoc, Template, generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER (+15 more)

### Community 54 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+19 more)

### Community 55 - "drive/page.tsx"
Cohesion: 0.12
Nodes (28): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, NewFolderButton(), NewOfficeButton() (+20 more)

### Community 56 - "medical-info-actions.ts"
Cohesion: 0.15
Nodes (26): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+18 more)

### Community 57 - "message-thread.tsx"
Cohesion: 0.13
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 58 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 59 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 60 - "medical-actions.ts"
Cohesion: 0.12
Nodes (29): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+21 more)

### Community 61 - "regulatory-request-actions.ts"
Cohesion: 0.15
Nodes (24): RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible() (+16 more)

### Community 62 - "sectionByCode"
Cohesion: 0.12
Nodes (25): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+17 more)

### Community 63 - "rules/admin-actions.ts"
Cohesion: 0.13
Nodes (23): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+15 more)

### Community 64 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 65 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 66 - "rbac.ts"
Cohesion: 0.08
Nodes (25): ACTIONS, ALL, CONTRIBUTE, DIRECTIVES_USER, DOSSIERS_USER, DRIVE_USER, DriveSpaceAccessBearer, EffectiveModuleAccess (+17 more)

### Community 67 - "calendar.ts"
Cohesion: 0.17
Nodes (23): CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents() (+15 more)

### Community 68 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, d(), addLifecycleEvent(), addObligation() (+13 more)

### Community 69 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (18): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+10 more)

### Community 70 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+14 more)

### Community 71 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+9 more)

### Community 72 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 73 - "drive-actions.ts"
Cohesion: 0.21
Nodes (20): POST(), FileActions(), AccessSheet(), NodeActions(), collectSubtree(), createFolder(), createOfficeNode(), deleteNode() (+12 more)

### Community 74 - "ocr-engine.ts"
Cohesion: 0.15
Nodes (19): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr(), createOcrWorker() (+11 more)

### Community 75 - "marche/page.tsx"
Cohesion: 0.13
Nodes (21): AggNum(), BdProjectDetailPage(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS (+13 more)

### Community 76 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (19): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatMessage, ManageBar(), ProposalActions() (+11 more)

### Community 77 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (22): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+14 more)

### Community 78 - "access-actions.ts"
Cohesion: 0.18
Nodes (17): RowGrants(), ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), RevokeAllButton(), adminResetPassword() (+9 more)

### Community 79 - "pilotage/page.tsx"
Cohesion: 0.16
Nodes (19): dynamic, pct(), PilotagePage(), toneOf(), assignmentEffort(), DEFAULT_CAPACITY, DEFAULT_FREQUENCY_BY_TIER, DEFAULT_POSITION_WEIGHTS (+11 more)

### Community 80 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 81 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 82 - "explorer.ts"
Cohesion: 0.20
Nodes (17): businessObjectCoverage, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate, exploreOne() (+9 more)

### Community 83 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 84 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 85 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 86 - "admin-delete-actions.ts"
Cohesion: 0.18
Nodes (17): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+9 more)

### Community 87 - "admin-settings-forms.tsx"
Cohesion: 0.15
Nodes (18): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+10 more)

### Community 88 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 89 - "drive/[id]/page.tsx"
Cohesion: 0.16
Nodes (14): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), ShareItem, SharePanel(), ShareRow(), shareNode() (+6 more)

### Community 90 - "field-reports.ts"
Cohesion: 0.13
Nodes (16): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation (+8 more)

### Community 91 - "medical-directory.tsx"
Cohesion: 0.15
Nodes (16): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, DelegatePlanDTO (+8 more)

### Community 92 - "meeting-actions.ts"
Cohesion: 0.23
Nodes (17): MeetingMessageItem(), acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), deleteMeetingMessage(), DENIED, dismissMeetingProposal(), endMeeting() (+9 more)

### Community 93 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): DOT, MyStatus(), parseAttachments(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 94 - "evidence.ts"
Cohesion: 0.16
Nodes (16): sttConfigured(), base, BETTER, classify(), Diff, DiffClass, differential(), DifferentialReport (+8 more)

### Community 95 - "messaging/messages/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+5 more)

### Community 96 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 97 - "auth-actions.ts"
Cohesion: 0.16
Nodes (9): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenuProps, authenticate(), changePassword() (+1 more)

### Community 98 - "data.ts"
Cohesion: 0.13
Nodes (16): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, loadNdjson(), MarketMeta, NomRow (+8 more)

### Community 99 - "events.ts"
Cohesion: 0.15
Nodes (15): EventsPage(), dynamic, InscriptionPage(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+7 more)

### Community 100 - "meetings.ts"
Cohesion: 0.21
Nodes (12): dynamic, PublicMeetPage(), PublicJoin(), genPublicToken(), genSlug(), jitsiDomain(), MeetingAccessShape, publicMeetPath() (+4 more)

### Community 101 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 102 - "supplies-manager.tsx"
Cohesion: 0.23
Nodes (12): SuppliesManager(), SupplyArticleRow, DriveComments(), deleteDriveComment(), postDriveComment(), canManageCatalog(), createSupplyArticle(), DENIED (+4 more)

### Community 103 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 104 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 105 - "regulatory-corpus/page.tsx"
Cohesion: 0.21
Nodes (10): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), CorpusFilters, Row, searchCorpus() (+2 more)

### Community 106 - "tender-lines.tsx"
Cohesion: 0.21
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+6 more)

### Community 107 - "anyRoleFilter"
Cohesion: 0.20
Nodes (11): CataloguePage(), dynamic, dynamic, EquipesPage(), dynamic, ParametresPage(), PlanningTabs(), PlanningTabsProps (+3 more)

### Community 108 - "topbar.tsx"
Cohesion: 0.22
Nodes (11): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+3 more)

### Community 109 - "calendar-actions.ts"
Cohesion: 0.24
Nodes (12): EventDetail(), EventForm(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES, parseKind(), respondToInvite(), updateCalendarEvent() (+4 more)

### Community 110 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 111 - "supplier/actions.ts"
Cohesion: 0.38
Nodes (11): SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier(), regenerateSupplierDraft(), remindSupplier(), requestDossierId() (+3 more)

### Community 112 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 113 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 114 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 115 - "review-agent.ts"
Cohesion: 0.21
Nodes (10): AiFinding, AiFindingSchema, AiFn, AiOutputSchema, buildPrompt(), reviewDocumentText(), ReviewResult, SYSTEM_PROMPT (+2 more)

### Community 116 - "compare-versions.ts"
Cohesion: 0.22
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 117 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 118 - "radar.ts"
Cohesion: 0.27
Nodes (11): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+3 more)

### Community 119 - "ai-health.ts"
Cohesion: 0.29
Nodes (5): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, AiHealthRun, performAiHealthCheck()

### Community 120 - "planning/page.tsx"
Cohesion: 0.42
Nodes (9): AffectationsPage(), dynamic, dynamic, PlanningPage(), ensureCycle(), fieldVisitsCapacity(), monthLabel(), repCapacity() (+1 more)

### Community 121 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 122 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 123 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 124 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 125 - "mail-diagnostic/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, POST(), appendToSent(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey() (+1 more)

### Community 126 - "archive.ts"
Cohesion: 0.31
Nodes (7): GET(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), readFileByKey()

### Community 127 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 128 - "report-editor.tsx"
Cohesion: 0.33
Nodes (6): DoctorPicker(), Attachments(), ChatAttachment, MessageAttachments(), formatBytes(), FieldReportDetail

### Community 129 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 130 - "support-flow.test.ts"
Cohesion: 0.33
Nodes (8): SupportDetailPage(), actorFor(), canViewSupport(), getSupportRequest(), getSupportRequests(), isSupportResponder(), SupportDetail, scopeSupport()

### Community 131 - "ingest.ts"
Cohesion: 0.33
Nodes (6): CATEGORIES, categorizeReserve(), decomposeReserveText(), ReservePoint, ingestReserveLetter(), ReserveIngestResult

### Community 132 - "calendar-view.tsx"
Cohesion: 0.28
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND

### Community 133 - "stocks-view.tsx"
Cohesion: 0.22
Nodes (8): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, TabKey, TABS, todayInput(), UserOpt

### Community 134 - "sidebar.tsx"
Cohesion: 0.28
Nodes (6): badgeFor(), GROUP_ORDER, Sidebar(), SidebarProps, TopbarProps, NavItem

### Community 135 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey(), withAccountLock() (+1 more)

### Community 136 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 137 - "message/route.ts"
Cohesion: 0.32
Nodes (6): dynamic, GET(), dynamic, GET(), friendlyMailError(), MailMessage

### Community 138 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 139 - "queries/admin-requests.ts"
Cohesion: 0.43
Nodes (6): CourseDTO, CoursesPage(), DriverPage(), getDriverMissions(), getMissionAttachments(), REQ_INCLUDE

### Community 140 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 141 - "workflow-panel.tsx"
Cohesion: 0.32
Nodes (6): EventFundingPanel(), PmOpt, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel()

### Community 142 - "teams-manager.tsx"
Cohesion: 0.29
Nodes (6): Cap, Kam, KamRow(), numOrNull(), Opt, Team

### Community 143 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 144 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 145 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 146 - "new-conversation.tsx"
Cohesion: 0.29
Nodes (3): MemberMultiSelect(), Mode, SearchBox()

### Community 147 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 148 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 149 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 150 - "meetings/message-attachment/[id]/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), MeetingChat(), postMeetingMessage(), canViewMeeting()

### Community 151 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 152 - "settings-form.tsx"
Cohesion: 0.40
Nodes (5): Config, DEFAULTS, num(), SettingsForm(), TIERS

### Community 153 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 154 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 155 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 156 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 157 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 158 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 159 - "chunk-text.ts"
Cohesion: 0.70
Nodes (3): aiChunkChars(), clampInt(), splitTextIntoChunks()

### Community 160 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 161 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 162 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 163 - "office-editor.tsx"
Cohesion: 0.67
Nodes (3): OfficeEditor(), originOf(), Window

## Knowledge Gaps
- **969 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+964 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `formatDate`, `hasGlobalView`, `page-header.tsx`, `userCan`, `lib/labels.ts`, `getCurrentUser`, `workflow/engine.ts`, `brain-cockpit.tsx`, `recordAudit`, `requireModule`, `regulatory/[id]/page.tsx`, `requireUser`, `assistant.ts`, `[dossierId]/page.tsx`, `utils.ts`, `test-center/runner.ts`, `cn`, `budget-board.tsx`, `dossier-chat.ts`, `admin-request-actions.ts`, `(app)/validations/page.tsx`, `upload/session.ts`, `regulatory-actions.ts`, `drive-storage.ts`, `jobs/runner.ts`, `promo-material-actions.ts`, `onlyofficeConfigured`, `ingest-dossier.ts`, `enregistrement/page.tsx`, `market-research.ts`, `adoption.ts`, `dossier-actions.ts`, `platform-audit/engine.ts`, `build-facts.ts`, `field-report-actions.ts`, `entity-access.ts`, `sales-planning-actions.ts`, `regAudit`, `getAppSettings`, `pch-tender-line-actions.ts`, `agent-core.ts`, `SessionUser`, `messaging-actions.ts`, `hr-document-actions.ts`, `generate.ts`, `queries/messaging.ts`, `drive/page.tsx`, `medical-info-actions.ts`, `auth.ts`, `bd-strategic-table.tsx`, `medical-actions.ts`, `regulatory-request-actions.ts`, `rules/admin-actions.ts`, `mail.ts`, `rbac.ts`, `calendar.ts`, `lifecycle/actions.ts`, `(app)/layout.tsx`, `migration-cert.ts`, `drive-actions.ts`, `meetings/[id]/page.tsx`, `budget-envelope-actions.ts`, `access-actions.ts`, `pilotage/page.tsx`, `onboarding-wizard.tsx`, `explorer.ts`, `invariants/registry.ts`, `market-research-actions.ts`, `admin-delete-actions.ts`, `admin-settings-forms.tsx`, `drive/[id]/page.tsx`, `field-reports.ts`, `medical-directory.tsx`, `meeting-actions.ts`, `lib/messaging.ts`, `support-actions.ts`, `auth-actions.ts`, `events.ts`, `meetings.ts`, `supplies-manager.tsx`, `pch.ts`, `process-intelligence.ts`, `regulatory-corpus/page.tsx`, `anyRoleFilter`, `calendar-actions.ts`, `supplier/actions.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `hr-documents.ts`, `compare-versions.ts`, `push.ts`, `ai-health.ts`, `planning/page.tsx`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `mail-diagnostic/route.ts`, `archive.ts`, `meetings/page.tsx`, `support-flow.test.ts`, `ingest.ts`, `queries/admin-requests.ts`, `scheduled.ts`, `[token]/route.ts`, `meetings/message-attachment/[id]/route.ts`, `events/[id]/export/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `formatDate`, `support-flow.test.ts`, `page-header.tsx`, `userCan`, `lib/labels.ts`, `hasGlobalView`, `workflow/engine.ts`, `brain-cockpit.tsx`, `recordAudit`, `getCurrentUser`, `regulatory/[id]/page.tsx`, `requireModule`, `assistant.ts`, `utils.ts`, `test-center/runner.ts`, `dossier-chat.ts`, `admin-request-actions.ts`, `meetings/message-attachment/[id]/route.ts`, `regulatory-actions.ts`, `promo-material-actions.ts`, `onlyofficeConfigured`, `enregistrement/page.tsx`, `dossier-actions.ts`, `platform-audit/engine.ts`, `field-report-actions.ts`, `entity-access.ts`, `document-preview.tsx`, `sales-planning-actions.ts`, `regAudit`, `getAppSettings`, `aiConfigured`, `pch-tender-line-actions.ts`, `SessionUser`, `messaging-actions.ts`, `hr-document-actions.ts`, `generate.ts`, `medical-info-actions.ts`, `medical-actions.ts`, `regulatory-request-actions.ts`, `rules/admin-actions.ts`, `lifecycle/actions.ts`, `(app)/layout.tsx`, `messenger.tsx`, `drive-actions.ts`, `budget-envelope-actions.ts`, `access-actions.ts`, `onboarding-wizard.tsx`, `market-research-actions.ts`, `admin-delete-actions.ts`, `drive/[id]/page.tsx`, `meeting-actions.ts`, `lib/messaging.ts`, `support-actions.ts`, `auth-actions.ts`, `supplies-manager.tsx`, `tender-lines.tsx`, `calendar-actions.ts`, `supplier/actions.ts`, `stock-snapshot-actions.ts`, `ai-health.ts`, `reminder-actions.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `formatDate`, `hasGlobalView`, `page-header.tsx`, `support-flow.test.ts`, `lib/labels.ts`, `brain-cockpit.tsx`, `recordAudit`, `requireModule`, `queries/admin-requests.ts`, `regulatory/[id]/page.tsx`, `assistant.ts`, `requireUser`, `test-center/runner.ts`, `cn`, `budget-board.tsx`, `admin-request-actions.ts`, `(app)/validations/page.tsx`, `regulatory-actions.ts`, `drive-storage.ts`, `events/[id]/export/route.ts`, `promo-material-actions.ts`, `prisma.ts`, `onlyofficeConfigured`, `market-research.ts`, `adoption.ts`, `dossier-actions.ts`, `field-report-actions.ts`, `entity-access.ts`, `sales-planning-actions.ts`, `getAppSettings`, `aiConfigured`, `pch-tender-line-actions.ts`, `SessionUser`, `messaging-actions.ts`, `hr-document-actions.ts`, `queries/messaging.ts`, `drive/page.tsx`, `medical-info-actions.ts`, `medical-actions.ts`, `regulatory-request-actions.ts`, `rbac.ts`, `calendar.ts`, `(app)/layout.tsx`, `drive-actions.ts`, `marche/page.tsx`, `budget-envelope-actions.ts`, `access-actions.ts`, `pilotage/page.tsx`, `market-research-actions.ts`, `drive/[id]/page.tsx`, `meeting-actions.ts`, `messaging/messages/route.ts`, `support-actions.ts`, `events.ts`, `supplies-manager.tsx`, `tender-lines.tsx`, `anyRoleFilter`, `calendar-actions.ts`, `stock-snapshot-actions.ts`, `ai-health.ts`, `planning/page.tsx`, `reminder-actions.ts`, `mail-diagnostic/route.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _969 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052296436797181954 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052743652743652746 - nodes in this community are weakly interconnected._
- **Should `formatDate` be split into smaller, more focused modules?**
  _Cohesion score 0.03996723996723997 - nodes in this community are weakly interconnected._