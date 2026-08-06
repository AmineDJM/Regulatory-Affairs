# Graph Report - src  (2026-08-06)

## Corpus Check
- 903 files · ~630,328 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5518 nodes · 21588 edges · 186 communities (180 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5fac2e7f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- lib/session.ts
- formatDate
- utils.ts
- getCurrentUser
- recordAudit
- brain-cockpit.tsx
- lib/labels.ts
- userCan
- requireUser
- corpus-actions.ts
- requireModule
- adoption.ts
- aiConfigured
- prisma.ts
- batch-runner.ts
- hasGlobalView
- rules/engine.ts
- [dossierId]/page.tsx
- assistant-actions.ts
- notifyRoles
- care-actions.ts
- budget-forms.tsx
- hr-document-actions.ts
- fdStr
- button.tsx
- (app)/layout.tsx
- jobs/runner.ts
- FindingInput
- regAudit
- rbac.ts
- workflow.ts
- molecule.ts
- mail.ts
- mistral-ocr.ts
- onlyofficeConfigured
- dossier-actions.ts
- promo-material-actions.ts
- pch-tender-line-actions.ts
- upload/session.ts
- assistant.ts
- dossier-chat.ts
- dashboard/page.tsx
- drive-storage.ts
- input.tsx
- departments-manager.tsx
- entity-access.ts
- intelligence/actions.ts
- test-center/runner.ts
- build-facts.ts
- queries/messaging.ts
- document-preview.tsx
- agent-core.ts
- market-research.ts
- ad-pro-item-actions.ts
- ingest-dossier.ts
- object-storage.ts
- information-medicale/[id]/page.tsx
- messaging-actions.ts
- ocr-engine.ts
- platform-audit/engine.ts
- workflow/engine.ts
- anpp-process.tsx
- drive-actions.ts
- drive/page.tsx
- generate.ts
- bd-strategic-table.tsx
- message-thread.tsx
- auth.ts
- users/[id]/page.tsx
- features.ts
- marche/page.tsx
- molecule-panel.tsx
- medical-actions.ts
- getAppSettings
- competition.ts
- validation-actions.ts
- explorer.ts
- field-reports.ts
- getMailAccount
- sectionByCode
- lifecycle/actions.ts
- regulatory/[id]/page.tsx
- migration-cert.ts
- Select
- calendar.ts
- congress-national/[id]/page.tsx
- edit-product.tsx
- enregistrement/page.tsx
- extract-text.ts
- meetings/[id]/page.tsx
- mon-espace/page.tsx
- portfolio.ts
- budget-envelope-actions.ts
- action-center.ts
- invariants/registry.ts
- event-form.tsx
- messenger.tsx
- onboarding-wizard.tsx
- manifest.ts
- library-ingest.ts
- extract-facts.ts
- meetings.ts
- upload-manager.tsx
- lib/messaging.ts
- admin-settings-forms.tsx
- product-explorer.tsx
- mail-client.tsx
- test-center/page.tsx
- auth-actions.ts
- driver/page.tsx
- field-report-actions.ts
- run.ts
- requests/page.tsx
- support-actions.ts
- storage.ts
- raw/route.ts
- corpus/actions.ts
- market-research-actions.ts
- pch.ts
- supplier/actions.ts
- regulatory-request-actions.ts
- office-templates.ts
- meeting-actions.ts
- tender-lines.tsx
- today.ts
- drive/[id]/page.tsx
- process-intelligence.ts
- compare-versions.ts
- pch/export/route.ts
- push.ts
- new-request.tsx
- medical-directory.tsx
- regulatory-actions.ts
- regulatory-table.tsx
- hr-documents.ts
- new-conversation.tsx
- stocks-view.tsx
- daily-brief.ts
- supplies-manager.tsx
- meeting-chat.tsx
- hr-dossier.tsx
- reserves/actions.ts
- background-upload.tsx
- reminder-actions.ts
- regulatory-drive-mirror.ts
- database-admin-actions.ts
- congress-workflow.tsx
- drive-space-actions.ts
- support-flow.test.ts
- radar.ts
- congress.ts
- typing/route.ts
- supplier-auth.ts
- admin-delete-actions.ts
- assistant-files.ts
- Adventum Autonomous Test Center — architecture
- org-chart-editor.tsx
- client-bundle-guard.test.ts
- scheduled.ts
- manufacturing-stage.ts
- calendar-view.tsx
- congress-request-form.tsx
- drive-space-manager.tsx
- delegate-plans.tsx
- forecast-grid.tsx
- push-register.tsx
- pipeline.e2e.test.ts
- [token]/route.ts
- courses-board.tsx
- visits-table.tsx
- v
- stocks/page.tsx
- messages-indicator.tsx
- next-auth.d.ts
- custom-fields-card.tsx
- mission-stops.tsx
- app/layout.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 587 edges
2. `userCan()` - 451 edges
3. `fdStr()` - 441 edges
4. `recordAudit()` - 381 edges
5. `prisma` - 372 edges
6. `requireModule()` - 216 edges
7. `hasGlobalView()` - 153 edges
8. `Button` - 151 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `RuleControls()` --indirect_call--> `v()`  [INFERRED]
  src/app/(app)/admin/validations/rules-admin.tsx → src/lib/regulatory/manufacturing-stage.test.ts

## Import Cycles
- None detected.

## Communities (186 total, 6 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.04
Nodes (88): ActivityTable(), ActivityPage(), fmtDuration(), MailTester(), CourrierAdminPage(), dynamic, metadata, dynamic (+80 more)

### Community 1 - "lib/session.ts"
Cohesion: 0.04
Nodes (85): dynamic, TrashItem, TrashList(), FeedbackStatusSelect(), AdminFeedbackPage(), deviceIcon(), SessionsList(), BudgetContextBar() (+77 more)

### Community 2 - "formatDate"
Cohesion: 0.04
Nodes (102): AdminValidationsPage(), dec(), dynamic, FocusCard(), TodayPage(), AggNum(), dzd(), fmtPct() (+94 more)

### Community 3 - "utils.ts"
Cohesion: 0.07
Nodes (73): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, AdminPage(), fmtBytes(), fmtWhen() (+65 more)

### Community 4 - "getCurrentUser"
Cohesion: 0.04
Nodes (85): GET(), dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET() (+77 more)

### Community 5 - "recordAudit"
Cohesion: 0.05
Nodes (75): EntitiesManager(), ImpersonateButton(), CreateRecordButtonProps, AVATAR_COLORS, createUser(), setSecondaryRole(), toggleUserActive(), updateUserRole() (+67 more)

### Community 6 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (75): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+67 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.04
Nodes (73): ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), BDPipeline(), STAGES, BDRow (+65 more)

### Community 8 - "userCan"
Cohesion: 0.07
Nodes (69): POST(), EditEventButton(), RegistrationsManager(), OpeningBalance, OpeningBalancesButton(), canManagePlan(), createDelegatePlan(), deleteDelegatePlan() (+61 more)

### Community 9 - "requireUser"
Cohesion: 0.05
Nodes (65): CorbeillePage(), PresentationCard(), PresentationPanel(), Res, BU, CatalogueManager(), CHANNELS, Opt (+57 more)

### Community 10 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (58): CorpusPanel(), IngestResults, Src, WatchFindings, CorpusPage(), dynamic, metadata, SourceRow() (+50 more)

### Community 11 - "requireModule"
Cohesion: 0.07
Nodes (57): FieldDefDTO, CustomFieldsPage(), OrganigrammePage(), dynamic, metadata, RegulatoryCorpusPage(), CheckinPage(), Assign (+49 more)

### Community 12 - "adoption.ts"
Cohesion: 0.06
Nodes (57): dynamic, POST(), runtime, AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage() (+49 more)

### Community 13 - "aiConfigured"
Cohesion: 0.05
Nodes (51): dynamic, GET(), AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), runAiHealthCheckNow() (+43 more)

### Community 14 - "prisma.ts"
Cohesion: 0.07
Nodes (28): dynamic, DirectiveDetailPage(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+20 more)

### Community 15 - "batch-runner.ts"
Cohesion: 0.06
Nodes (55): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+47 more)

### Community 16 - "hasGlobalView"
Cohesion: 0.07
Nodes (56): RequestActions(), RequesterWindow(), DriveComments(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields() (+48 more)

### Community 17 - "rules/engine.ts"
Cohesion: 0.07
Nodes (47): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+39 more)

### Community 18 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (50): AgentItem, AgentsPanel(), RunState, DossierChatPanel(), Msg, SUGGESTIONS, CostTable(), DossierDetailPage() (+42 more)

### Community 19 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (50): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+42 more)

### Community 20 - "notifyRoles"
Cohesion: 0.10
Nodes (49): AppealPanel(), ThirdPartyButton(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList() (+41 more)

### Community 21 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 22 - "budget-forms.tsx"
Cohesion: 0.08
Nodes (45): GET(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+37 more)

### Community 23 - "hr-document-actions.ts"
Cohesion: 0.07
Nodes (49): dynamic, POST(), EventDetail(), EventForm(), RequestRow(), PayrollMatrix(), createCalendarEvent(), deleteCalendarEvent() (+41 more)

### Community 24 - "fdStr"
Cohesion: 0.09
Nodes (48): FieldsManager(), ActiveToggle(), createBD(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange() (+40 more)

### Community 25 - "button.tsx"
Cohesion: 0.08
Nodes (29): DriveStorageSettings(), PALETTE, Option, RuleDTO, ProjectEditor(), ProjectStatusBadge(), U, EditField (+21 more)

### Community 26 - "(app)/layout.tsx"
Cohesion: 0.07
Nodes (36): ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), CommandPalette() (+28 more)

### Community 27 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (46): reviewDocumentText(), codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS (+38 more)

### Community 28 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 29 - "regAudit"
Cohesion: 0.08
Nodes (41): FindingEvidence(), dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar (+33 more)

### Community 30 - "rbac.ts"
Cohesion: 0.05
Nodes (43): dynamic, esc(), GET(), AccessUser, UserModuleState, AccessByModulePage(), ACTION_FR, dynamic (+35 more)

### Community 31 - "workflow.ts"
Cohesion: 0.08
Nodes (41): AdminWorkflowsPage(), dynamic, blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), Props, rolesText() (+33 more)

### Community 32 - "molecule.ts"
Cohesion: 0.10
Nodes (43): dynamic, MarketProductsPage(), analyzeMoleculeSafe(), Cache, DIR, DZD_PER_USD, IqviaRow, LabRow (+35 more)

### Community 33 - "mail.ts"
Cohesion: 0.07
Nodes (46): dynamic, POST(), acquirePooled(), acquireSlot(), addrStr(), appendToSent(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD (+38 more)

### Community 34 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 35 - "onlyofficeConfigured"
Cohesion: 0.13
Nodes (35): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+27 more)

### Community 36 - "dossier-actions.ts"
Cohesion: 0.10
Nodes (38): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+30 more)

### Community 37 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 38 - "pch-tender-line-actions.ts"
Cohesion: 0.12
Nodes (40): dominantOrigin(), enrichAllTenderLines(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), RawLine (+32 more)

### Community 39 - "upload/session.ts"
Cohesion: 0.09
Nodes (36): dynamic, POST(), runtime, IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng() (+28 more)

### Community 40 - "assistant.ts"
Cohesion: 0.09
Nodes (43): MedicalDirectory(), callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal() (+35 more)

### Community 41 - "dossier-chat.ts"
Cohesion: 0.10
Nodes (36): AiTextResult, askDossier(), buildOverview(), buildPrompt(), ChatTurn, cleanAnswer(), DossierChatResult, expandQueryTerms() (+28 more)

### Community 42 - "dashboard/page.tsx"
Cohesion: 0.06
Nodes (33): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, inline(), MdTable() (+25 more)

### Community 43 - "drive-storage.ts"
Cohesion: 0.10
Nodes (28): dynamic, GET(), dynamic, GET(), dynamic, POST(), dynamic, GET() (+20 more)

### Community 44 - "input.tsx"
Cohesion: 0.09
Nodes (25): GrantOption, RowGrantsProps, ResearchMeta(), ConnectMailbox(), CATEGORY_SUGGESTIONS, Perm, PermBtn(), UserLite (+17 more)

### Community 45 - "departments-manager.tsx"
Cohesion: 0.10
Nodes (36): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+28 more)

### Community 46 - "entity-access.ts"
Cohesion: 0.11
Nodes (35): GET(), SearchPage(), isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+27 more)

### Community 47 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (33): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+25 more)

### Community 48 - "test-center/runner.ts"
Cohesion: 0.10
Nodes (30): MODES, PHASE1_MODES, runTestCenter(), Certification, CertificationInput, CertificationResult, computeCertification(), BETTER (+22 more)

### Community 49 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 50 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (32): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, MessagesPage() (+24 more)

### Community 51 - "document-preview.tsx"
Cohesion: 0.09
Nodes (27): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+19 more)

### Community 52 - "agent-core.ts"
Cohesion: 0.10
Nodes (24): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+16 more)

### Community 53 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 54 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (28): AdProItemsPanel(), ItemRow, Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED (+20 more)

### Community 55 - "ingest-dossier.ts"
Cohesion: 0.11
Nodes (32): sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile(), IngestSummary, isStorable(), maxPgBlobBytes() (+24 more)

### Community 56 - "object-storage.ts"
Cohesion: 0.14
Nodes (32): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+24 more)

### Community 57 - "information-medicale/[id]/page.tsx"
Cohesion: 0.16
Nodes (28): DeclarationDetailPage(), dynamic, AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm() (+20 more)

### Community 58 - "messaging-actions.ts"
Cohesion: 0.15
Nodes (33): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), bookmarkMessage() (+25 more)

### Community 59 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (26): analyzeEmployeeContract(), CONTRACT_TYPES_UP, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED (+18 more)

### Community 60 - "platform-audit/engine.ts"
Cohesion: 0.11
Nodes (31): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+23 more)

### Community 61 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (34): getManagerOfUser(), isManagerOfUser(), defaultDefinition(), defaultSpine(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule() (+26 more)

### Community 62 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (30): STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), isRegChecklistKey(), isRegStepKey(), isRegStepState() (+22 more)

### Community 63 - "drive-actions.ts"
Cohesion: 0.15
Nodes (27): POST(), FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions() (+19 more)

### Community 64 - "drive/page.tsx"
Cohesion: 0.14
Nodes (27): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, NewFolderButton(), NewOfficeButton() (+19 more)

### Community 65 - "generate.ts"
Cohesion: 0.11
Nodes (24): DocgenPanel(), GenDoc, Template, generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER (+16 more)

### Community 66 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (27): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+19 more)

### Community 67 - "message-thread.tsx"
Cohesion: 0.13
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 68 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 69 - "users/[id]/page.tsx"
Cohesion: 0.14
Nodes (25): ModuleAccessGrid(), AccessMatrix(), ModuleAccessRow, ACTION_FR, ROW_SCOPED, RowGrants(), SessionItem, ActiveToggle() (+17 more)

### Community 70 - "features.ts"
Cohesion: 0.12
Nodes (23): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), dynamic, AppLayout() (+15 more)

### Community 71 - "marche/page.tsx"
Cohesion: 0.11
Nodes (26): BdProjectDetailPage(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone() (+18 more)

### Community 72 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 73 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), createVisit() (+20 more)

### Community 74 - "getAppSettings"
Cohesion: 0.15
Nodes (22): dynamic, POST(), POST(), dynamic, POST(), dynamic, POST(), DatabasesPage() (+14 more)

### Community 75 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 76 - "validation-actions.ts"
Cohesion: 0.13
Nodes (25): RuleControls(), RuleEditor(), clearValidationItem(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule(), PRIORITIES (+17 more)

### Community 77 - "explorer.ts"
Cohesion: 0.17
Nodes (21): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport (+13 more)

### Community 78 - "field-reports.ts"
Cohesion: 0.11
Nodes (21): dynamic, GET(), dynamic, POST(), dynamic, FieldReportPage(), HBars(), PALETTE (+13 more)

### Community 79 - "getMailAccount"
Cohesion: 0.12
Nodes (22): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+14 more)

### Community 80 - "sectionByCode"
Cohesion: 0.14
Nodes (21): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+13 more)

### Community 81 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 82 - "regulatory/[id]/page.tsx"
Cohesion: 0.14
Nodes (21): RegulatoryChecklist(), RegulatoryProcess(), BvItem, REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), ParticipantsPanel(), SupervisionControls() (+13 more)

### Community 83 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 84 - "Select"
Cohesion: 0.09
Nodes (16): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, EventFundingPanel(), PmOpt, SubmitButton(), BV_STATUS (+8 more)

### Community 85 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 86 - "congress-national/[id]/page.tsx"
Cohesion: 0.20
Nodes (21): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), MyMissionsPage(), SponsoringDetailPage(), promoMaterialOptions() (+13 more)

### Community 87 - "edit-product.tsx"
Cohesion: 0.14
Nodes (22): DciAssociationField(), EditProductButton(), EditProductValues, UserOption, NewProductButton(), UserOption, SelectField(), TextAreaField() (+14 more)

### Community 88 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 89 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 90 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (19): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+11 more)

### Community 91 - "mon-espace/page.tsx"
Cohesion: 0.13
Nodes (17): AdvanceItem, MyAdvances(), CancelButton(), LeaveItem, MyLeaves(), MonEspacePage(), CourseDuration(), mapsUrl() (+9 more)

### Community 92 - "portfolio.ts"
Cohesion: 0.15
Nodes (19): ProductList(), getFieldReportsAggregation(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+11 more)

### Community 93 - "budget-envelope-actions.ts"
Cohesion: 0.20
Nodes (22): addBudgetExpense(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory(), ensureCanManageEnvelope() (+14 more)

### Community 94 - "action-center.ts"
Cohesion: 0.13
Nodes (17): actor(), MEDICAL_INFO_STATUS, ActionNotification, getActionCenter(), resolve(), CONG_STAGE, CrossValidationItem, getCrossModuleValidations() (+9 more)

### Community 95 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 96 - "event-form.tsx"
Cohesion: 0.13
Nodes (16): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), PARTICIPANT_ROLE (+8 more)

### Community 97 - "messenger.tsx"
Cohesion: 0.18
Nodes (19): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+11 more)

### Community 98 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 99 - "manifest.ts"
Cohesion: 0.16
Nodes (17): getTestCenterDashboard(), CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact() (+9 more)

### Community 100 - "library-ingest.ts"
Cohesion: 0.17
Nodes (18): buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule(), parseExtraction() (+10 more)

### Community 101 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 102 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 103 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 104 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): dynamic, GET(), DOT, MyStatus(), setMessagingStatus(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 105 - "admin-settings-forms.tsx"
Cohesion: 0.15
Nodes (18): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+10 more)

### Community 106 - "product-explorer.tsx"
Cohesion: 0.18
Nodes (17): fmtDzd(), fmtPct(), fmtPrice(), fmtUsd(), pctTone(), ProductExplorer(), SuggestField(), analyzeMarketMolecule() (+9 more)

### Community 107 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 108 - "test-center/page.tsx"
Cohesion: 0.13
Nodes (16): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+8 more)

### Community 109 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 110 - "driver/page.tsx"
Cohesion: 0.18
Nodes (14): CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getAssistantData() (+6 more)

### Community 111 - "field-report-actions.ts"
Cohesion: 0.23
Nodes (16): ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment() (+8 more)

### Community 112 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 113 - "requests/page.tsx"
Cohesion: 0.25
Nodes (15): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), REG_REQUEST_CATEGORY, REG_REQUEST_STATUS, getRegRequest(), listRegRequests() (+7 more)

### Community 114 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 115 - "storage.ts"
Cohesion: 0.21
Nodes (12): GET(), probeUploads(), ALLOWED_EXTENSIONS, BLOCKED_DRIVE_EXTENSIONS, readFileByKey(), UPLOAD_DIR, validateDocumentUpload(), validateDriveUpload() (+4 more)

### Community 116 - "raw/route.ts"
Cohesion: 0.21
Nodes (13): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), resolveAttachment(), canViewDrive(), buildDriveZip() (+5 more)

### Community 117 - "corpus/actions.ts"
Cohesion: 0.22
Nodes (12): Citation, CorpusAdmin(), Source, Version, canManage(), createCorpusSourceVersion(), Result, searchCorpusAction() (+4 more)

### Community 118 - "market-research-actions.ts"
Cohesion: 0.24
Nodes (15): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+7 more)

### Community 119 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 120 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 121 - "regulatory-request-actions.ts"
Cohesion: 0.19
Nodes (14): RequestThread(), Res, markAllNotificationsRead(), markNotificationRead(), sendBroadcast(), createRegRequest(), deleteRegRequest(), loadAccessible() (+6 more)

### Community 122 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 123 - "meeting-actions.ts"
Cohesion: 0.28
Nodes (14): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+6 more)

### Community 124 - "tender-lines.tsx"
Cohesion: 0.19
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+6 more)

### Community 125 - "today.ts"
Cohesion: 0.20
Nodes (13): CalendarEventDTO, ActionItem, getToday(), greetingFor(), rankToday(), reasonOf(), REASONS, score() (+5 more)

### Community 126 - "drive/[id]/page.tsx"
Cohesion: 0.21
Nodes (10): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), CUSTOM_ENTITY_TYPES, CustomValues, getFieldDefs(), fileKind() (+2 more)

### Community 127 - "process-intelligence.ts"
Cohesion: 0.18
Nodes (14): TASK_STATUS, collectWorkItems(), daysSince(), getProcessOverview(), label(), ModuleStat, PendingValidation, PiAlert (+6 more)

### Community 128 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 129 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 130 - "push.ts"
Cohesion: 0.29
Nodes (11): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+3 more)

### Community 131 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 132 - "medical-directory.tsx"
Cohesion: 0.19
Nodes (11): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, MEDICAL_SECTOR (+3 more)

### Community 133 - "regulatory-actions.ts"
Cohesion: 0.19
Nodes (10): StatusEditor(), VariationDTO, addRegulatoryComment(), regSupervisorRoles(), setRegulatoryPresubOutcome(), updateRegulatoryStatus(), REGULATORY_STEP_ORDER, VARIATION_STATUS (+2 more)

### Community 134 - "regulatory-table.tsx"
Cohesion: 0.15
Nodes (10): CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, STAGE_CLASS, STAGE_OPTS (+2 more)

### Community 135 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 136 - "new-conversation.tsx"
Cohesion: 0.18
Nodes (7): MessageForm(), set(), StatusActions(), useAction(), MemberMultiSelect(), Mode, SearchBox()

### Community 137 - "stocks-view.tsx"
Cohesion: 0.21
Nodes (11): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, StocksView(), TabKey, TABS, todayInput() (+3 more)

### Community 138 - "daily-brief.ts"
Cohesion: 0.29
Nodes (9): askClaudeCheap(), algiersDay(), BriefResult, getDailyBrief(), AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail() (+1 more)

### Community 139 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 140 - "meeting-chat.tsx"
Cohesion: 0.24
Nodes (10): MessageAttachments(), Attachments(), ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), formatBytes() (+2 more)

### Community 141 - "hr-dossier.tsx"
Cohesion: 0.24
Nodes (8): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), REQ_TO_CAT, MeetingControls(), HR_DOCUMENT_STATUSES, HR_REQUEST_TYPE

### Community 142 - "reserves/actions.ts"
Cohesion: 0.33
Nodes (8): Cycle, Point, ReservesPanel(), approveReservePoint(), deleteReserveCycle(), guardPoint(), Result, updateReservePoint()

### Community 143 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 144 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 145 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 146 - "database-admin-actions.ts"
Cohesion: 0.40
Nodes (8): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs(), deleteFileByKey()

### Community 147 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 148 - "drive-space-actions.ts"
Cohesion: 0.36
Nodes (9): CreateSpaceButton(), SpaceSettingsButton(), archiveDriveSpace(), createDriveSpace(), deleteDriveSpace(), ensureCanManageSpace(), readIds(), updateDriveSpace() (+1 more)

### Community 149 - "support-flow.test.ts"
Cohesion: 0.33
Nodes (8): SupportDetailPage(), actorFor(), canViewSupport(), getSupportRequest(), getSupportRequests(), isSupportResponder(), SupportDetail, scopeSupport()

### Community 150 - "radar.ts"
Cohesion: 0.31
Nodes (9): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), parseDate() (+1 more)

### Community 151 - "congress.ts"
Cohesion: 0.38
Nodes (9): CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressList(), userNameMap(), scopeCongressIntl() (+1 more)

### Community 152 - "typing/route.ts"
Cohesion: 0.28
Nodes (6): dynamic, NO_CONTENT, POST(), ConversationTyping, registry, setTyping()

### Community 153 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 154 - "admin-delete-actions.ts"
Cohesion: 0.36
Nodes (8): delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord(), superAdminDelete()

### Community 155 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 156 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 157 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 158 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 159 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 160 - "manufacturing-stage.ts"
Cohesion: 0.46
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 161 - "calendar-view.tsx"
Cohesion: 0.33
Nodes (5): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS

### Community 162 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 163 - "drive-space-manager.tsx"
Cohesion: 0.29
Nodes (3): ROLE_ENTRIES, SpaceData, UserOpt

### Community 164 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 165 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 166 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 167 - "pipeline.e2e.test.ts"
Cohesion: 0.43
Nodes (6): buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs()

### Community 168 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 169 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 170 - "visits-table.tsx"
Cohesion: 0.33
Nodes (5): DeleteVisitButton(), EditVisitSheet(), Opt, Result, VisitRow

### Community 171 - "v"
Cohesion: 0.33
Nodes (6): fd(), form(), form(), fd(), fd(), v()

### Community 172 - "stocks/page.tsx"
Cohesion: 0.47
Nodes (4): StocksPage(), SnapshotDTO, getProductOptions(), ProductOption

### Community 173 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 174 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 175 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 176 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 178 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

## Knowledge Gaps
- **1114 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `lib/session.ts`, `formatDate`, `utils.ts`, `getCurrentUser`, `recordAudit`, `brain-cockpit.tsx`, `lib/labels.ts`, `userCan`, `requireUser`, `corpus-actions.ts`, `requireModule`, `adoption.ts`, `aiConfigured`, `batch-runner.ts`, `hasGlobalView`, `rules/engine.ts`, `[dossierId]/page.tsx`, `assistant-actions.ts`, `notifyRoles`, `care-actions.ts`, `budget-forms.tsx`, `hr-document-actions.ts`, `fdStr`, `(app)/layout.tsx`, `jobs/runner.ts`, `regAudit`, `rbac.ts`, `workflow.ts`, `mail.ts`, `onlyofficeConfigured`, `dossier-actions.ts`, `promo-material-actions.ts`, `pch-tender-line-actions.ts`, `upload/session.ts`, `assistant.ts`, `dossier-chat.ts`, `drive-storage.ts`, `departments-manager.tsx`, `entity-access.ts`, `intelligence/actions.ts`, `test-center/runner.ts`, `build-facts.ts`, `queries/messaging.ts`, `agent-core.ts`, `market-research.ts`, `ad-pro-item-actions.ts`, `ingest-dossier.ts`, `information-medicale/[id]/page.tsx`, `messaging-actions.ts`, `ocr-engine.ts`, `platform-audit/engine.ts`, `workflow/engine.ts`, `drive-actions.ts`, `drive/page.tsx`, `generate.ts`, `bd-strategic-table.tsx`, `auth.ts`, `users/[id]/page.tsx`, `features.ts`, `medical-actions.ts`, `getAppSettings`, `validation-actions.ts`, `explorer.ts`, `field-reports.ts`, `getMailAccount`, `lifecycle/actions.ts`, `regulatory/[id]/page.tsx`, `migration-cert.ts`, `calendar.ts`, `congress-national/[id]/page.tsx`, `meetings/[id]/page.tsx`, `mon-espace/page.tsx`, `portfolio.ts`, `budget-envelope-actions.ts`, `action-center.ts`, `invariants/registry.ts`, `event-form.tsx`, `onboarding-wizard.tsx`, `manifest.ts`, `library-ingest.ts`, `meetings.ts`, `lib/messaging.ts`, `admin-settings-forms.tsx`, `auth-actions.ts`, `driver/page.tsx`, `field-report-actions.ts`, `run.ts`, `requests/page.tsx`, `support-actions.ts`, `storage.ts`, `raw/route.ts`, `corpus/actions.ts`, `market-research-actions.ts`, `pch.ts`, `supplier/actions.ts`, `regulatory-request-actions.ts`, `meeting-actions.ts`, `drive/[id]/page.tsx`, `process-intelligence.ts`, `compare-versions.ts`, `pch/export/route.ts`, `push.ts`, `regulatory-actions.ts`, `hr-documents.ts`, `daily-brief.ts`, `supplies-manager.tsx`, `reserves/actions.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `database-admin-actions.ts`, `drive-space-actions.ts`, `support-flow.test.ts`, `congress.ts`, `supplier-auth.ts`, `admin-delete-actions.ts`, `scheduled.ts`, `pipeline.e2e.test.ts`, `[token]/route.ts`, `stocks/page.tsx`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `lib/session.ts`, `utils.ts`, `getCurrentUser`, `recordAudit`, `brain-cockpit.tsx`, `regulatory-actions.ts`, `userCan`, `corpus-actions.ts`, `supplies-manager.tsx`, `meeting-chat.tsx`, `aiConfigured`, `prisma.ts`, `adoption.ts`, `hasGlobalView`, `reminder-actions.ts`, `database-admin-actions.ts`, `assistant-actions.ts`, `notifyRoles`, `support-flow.test.ts`, `budget-forms.tsx`, `hr-document-actions.ts`, `fdStr`, `care-actions.ts`, `(app)/layout.tsx`, `admin-delete-actions.ts`, `drive-space-actions.ts`, `regAudit`, `workflow.ts`, `onlyofficeConfigured`, `dossier-actions.ts`, `promo-material-actions.ts`, `pch-tender-line-actions.ts`, `departments-manager.tsx`, `entity-access.ts`, `intelligence/actions.ts`, `test-center/runner.ts`, `document-preview.tsx`, `ad-pro-item-actions.ts`, `requireModule`, `information-medicale/[id]/page.tsx`, `messaging-actions.ts`, `ocr-engine.ts`, `platform-audit/engine.ts`, `anpp-process.tsx`, `drive-actions.ts`, `generate.ts`, `users/[id]/page.tsx`, `features.ts`, `medical-actions.ts`, `getAppSettings`, `reserves/actions.ts`, `validation-actions.ts`, `lifecycle/actions.ts`, `congress-national/[id]/page.tsx`, `edit-product.tsx`, `rules/engine.ts`, `budget-envelope-actions.ts`, `messenger.tsx`, `onboarding-wizard.tsx`, `lib/messaging.ts`, `product-explorer.tsx`, `test-center/page.tsx`, `auth-actions.ts`, `field-report-actions.ts`, `run.ts`, `requests/page.tsx`, `support-actions.ts`, `corpus/actions.ts`, `market-research-actions.ts`, `supplier/actions.ts`, `regulatory-request-actions.ts`, `meeting-actions.ts`, `tender-lines.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `card.tsx`, `pch/export/route.ts`, `lib/session.ts`, `utils.ts`, `getCurrentUser`, `formatDate`, `brain-cockpit.tsx`, `lib/labels.ts`, `recordAudit`, `requireUser`, `regulatory-actions.ts`, `requireModule`, `adoption.ts`, `aiConfigured`, `prisma.ts`, `supplies-manager.tsx`, `hasGlobalView`, `reminder-actions.ts`, `assistant-actions.ts`, `notifyRoles`, `support-flow.test.ts`, `budget-forms.tsx`, `hr-document-actions.ts`, `typing/route.ts`, `fdStr`, `(app)/layout.tsx`, `care-actions.ts`, `rbac.ts`, `mail.ts`, `onlyofficeConfigured`, `dossier-actions.ts`, `promo-material-actions.ts`, `pch-tender-line-actions.ts`, `assistant.ts`, `dashboard/page.tsx`, `drive-storage.ts`, `stocks/page.tsx`, `departments-manager.tsx`, `entity-access.ts`, `queries/messaging.ts`, `market-research.ts`, `ad-pro-item-actions.ts`, `information-medicale/[id]/page.tsx`, `messaging-actions.ts`, `ocr-engine.ts`, `drive-actions.ts`, `drive/page.tsx`, `users/[id]/page.tsx`, `features.ts`, `marche/page.tsx`, `medical-actions.ts`, `getAppSettings`, `validation-actions.ts`, `field-reports.ts`, `regulatory/[id]/page.tsx`, `calendar.ts`, `congress-national/[id]/page.tsx`, `edit-product.tsx`, `mon-espace/page.tsx`, `budget-envelope-actions.ts`, `action-center.ts`, `lib/messaging.ts`, `product-explorer.tsx`, `test-center/page.tsx`, `driver/page.tsx`, `field-report-actions.ts`, `requests/page.tsx`, `support-actions.ts`, `market-research-actions.ts`, `meeting-actions.ts`, `tender-lines.tsx`, `drive/[id]/page.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04495927218872316 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.039967484080747864 - nodes in this community are weakly interconnected._
- **Should `formatDate` be split into smaller, more focused modules?**
  _Cohesion score 0.03529411764705882 - nodes in this community are weakly interconnected._