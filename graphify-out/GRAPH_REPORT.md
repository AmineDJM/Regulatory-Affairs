# Graph Report - src  (2026-08-06)

## Corpus Check
- 894 files · ~617,867 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5434 nodes · 21238 edges · 180 communities (174 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f03057d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- getCurrentUser
- requireModule
- notifyUser
- regulatory/[id]/page.tsx
- fdStr
- requireUser
- lib/labels.ts
- brain-cockpit.tsx
- userCan
- Button
- drive-storage.ts
- anyRoleFilter
- rh/page.tsx
- mail.ts
- upload/session.ts
- recordAudit
- [dossierId]/page.tsx
- anpp-process.tsx
- assistant-actions.ts
- batch-runner.ts
- rules/engine.ts
- FindingInput
- rbac.ts
- corpus-actions.ts
- ocr-engine.ts
- jobs/runner.ts
- agent-core.ts
- button.tsx
- prisma.ts
- getAppSettings
- formatDate
- test-center/runner.ts
- directives/page.tsx
- utils.ts
- hasGlobalView
- mistral-ocr.ts
- promo-material-actions.ts
- library-actions.ts
- dossier-chat.ts
- market-research.ts
- regAudit
- entity-access.ts
- aiConfigured
- market/engine.ts
- adoption.ts
- build-facts.ts
- dossier-actions.ts
- assistant.ts
- hr-document-actions.ts
- onlyoffice.ts
- ad-pro-item-actions.ts
- platform-audit/engine.ts
- queries/messaging.ts
- workflow-builder.tsx
- users/[id]/page.tsx
- budget.ts
- drive-actions.ts
- medical-actions.ts
- message-thread.tsx
- bd-strategic-table.tsx
- messaging-actions.ts
- auth.ts
- molecule-panel.tsx
- congress-request-actions.ts
- workflow/engine.ts
- validation-actions.ts
- competition.ts
- mon-espace/page.tsx
- (app)/layout.tsx
- stream/route.ts
- storage.ts
- smart-mail-actions.ts
- calendar.ts
- meetings/[id]/page.tsx
- sectionByCode
- lib/messaging.ts
- explorer.ts
- settings.ts
- test-center/types.ts
- lifecycle/actions.ts
- departments-manager.tsx
- molecule.ts
- migration-cert.ts
- field-reports.ts
- workflow.ts
- budget-forms.tsx
- messenger.tsx
- validations.ts
- enregistrement/page.tsx
- zip-inspector.ts
- event-actions.ts
- departments.ts
- onboarding-wizard.tsx
- generate.ts
- invariants/registry.ts
- extract-facts.ts
- admin-settings-forms.tsx
- product-explorer.tsx
- document-preview.tsx
- meeting-actions.ts
- upload-manager.tsx
- topbar.tsx
- mail-client.tsx
- directive-actions.ts
- messaging/messages/route.ts
- process-intelligence.ts
- drive/page.tsx
- auth-actions.ts
- marche/page.tsx
- meetings.ts
- beneficiaries-card.tsx
- drive/[id]/page.tsx
- pch.ts
- supplier/actions.ts
- currentCompanyWhere
- office-templates.ts
- corpus/actions.ts
- event-form.tsx
- run.ts
- queries/drive.ts
- pipeline.upload.e2e.test.ts
- radar.ts
- compare-versions.ts
- regulatory-drive-mirror.ts
- pch/export/route.ts
- ai-health.ts
- new-request.tsx
- report-editor.tsx
- medical-directory.tsx
- new-conversation.tsx
- stock-snapshot-actions.ts
- supplier-auth.ts
- today.ts
- push.ts
- organigramme/page.tsx
- products.ts
- heavy-parse.ts
- queries/admin-requests.ts
- panels.tsx
- background-upload.tsx
- reminder-actions.ts
- data.ts
- hr-documents.ts
- meetings/page.tsx
- agents/actions.ts
- stocks-view.tsx
- scheduled.ts
- Adventum Autonomous Test Center — architecture
- callback/route.ts
- drive-space-manager.tsx
- zip-viewer.tsx
- mobile-tabbar.tsx
- client-bundle-guard.test.ts
- congress-request-form.tsx
- delegate-plans.tsx
- validation-item-review.tsx
- push-register.tsx
- [token]/route.ts
- admin/corbeille/page.tsx
- courses-board.tsx
- bv-requests.tsx
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- directives/[id]/panel.tsx
- checkin/page.tsx
- payroll-matrix.tsx
- notification-chime.tsx
- custom-fields-card.tsx
- mission-stops.tsx
- request-controls.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 572 edges
2. `userCan()` - 448 edges
3. `fdStr()` - 428 edges
4. `recordAudit()` - 379 edges
5. `prisma` - 369 edges
6. `requireModule()` - 216 edges
7. `Button` - 150 edges
8. `hasGlobalView()` - 150 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `OrganigrammePage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/page.tsx → src/lib/session.ts

## Import Cycles
- None detected.

## Communities (180 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.05
Nodes (70): ActivityPage(), fmtDuration(), dynamic, metadata, dynamic, FEATURE_LABEL, metadata, dynamic (+62 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.04
Nodes (85): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+77 more)

### Community 2 - "requireModule"
Cohesion: 0.04
Nodes (94): CourrierAdminPage(), AdminFeedbackPage(), AdminPage(), fmtBytes(), fmtWhen(), AdminSuppliersPage(), AdminValidationsPage(), dec() (+86 more)

### Community 3 - "notifyUser"
Cohesion: 0.04
Nodes (89): DriveComments(), RevisionRequest(), RequestThread(), Res, SupportActions(), SupportMessageForm(), useAction(), CreateRecordButtonProps (+81 more)

### Community 4 - "regulatory/[id]/page.tsx"
Cohesion: 0.06
Nodes (76): BD_DOC_CATEGORIES, BdProjectDetailPage(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, RequestDetailPage(), dynamic (+68 more)

### Community 5 - "fdStr"
Cohesion: 0.06
Nodes (95): PayButton(), CancelButton(), CancelButton(), updateAiSettings(), createBD(), updateBDStatus(), addBudgetExpense(), attributeTransaction() (+87 more)

### Community 6 - "requireUser"
Cohesion: 0.05
Nodes (88): FieldsManager(), ActiveToggle(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL (+80 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.03
Nodes (78): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), FieldDefDTO (+70 more)

### Community 8 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (76): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+68 more)

### Community 9 - "userCan"
Cohesion: 0.05
Nodes (68): dynamic, POST(), POST(), GET(), PresentationCard(), Res, fmt(), LINE_STATUS (+60 more)

### Community 10 - "Button"
Cohesion: 0.06
Nodes (48): DriveStorageSettings(), ENV_LABEL, MODES, Option, RuleDTO, ProjectEditor(), ProjectStatusBadge(), MONTH_LABELS (+40 more)

### Community 11 - "drive-storage.ts"
Cohesion: 0.06
Nodes (50): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+42 more)

### Community 12 - "anyRoleFilter"
Cohesion: 0.06
Nodes (62): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+54 more)

### Community 13 - "rh/page.tsx"
Cohesion: 0.10
Nodes (48): ACTION_COLS, ACTION_LABELS, Opt, TYPES, ACTION_COLS, ACTION_LABELS, dynamic, Tab (+40 more)

### Community 14 - "mail.ts"
Cohesion: 0.05
Nodes (66): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+58 more)

### Community 15 - "upload/session.ts"
Cohesion: 0.07
Nodes (61): dynamic, GET(), runtime, dynamic, runtime, RFC-3986, IngestResult, uploadViaSession() (+53 more)

### Community 16 - "recordAudit"
Cohesion: 0.06
Nodes (56): PermanentDeleteButton(), PurgeOrphansButton(), EntitiesManager(), ImpersonateButton(), SuppliesManager(), SpaceSettingsButton(), destroyDeletedRecord(), resetActivityTime() (+48 more)

### Community 17 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (56): DossierChatPanel(), Msg, SUGGESTIONS, DocgenPanel(), GenDoc, Template, CostTable(), DossierDetailPage() (+48 more)

### Community 18 - "anpp-process.tsx"
Cohesion: 0.05
Nodes (57): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), regStage(), RegulatoryPage() (+49 more)

### Community 19 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (54): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+46 more)

### Community 20 - "batch-runner.ts"
Cohesion: 0.06
Nodes (56): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+48 more)

### Community 21 - "rules/engine.ts"
Cohesion: 0.07
Nodes (48): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+40 more)

### Community 22 - "FindingInput"
Cohesion: 0.10
Nodes (43): ACTIONS, accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing() (+35 more)

### Community 23 - "rbac.ts"
Cohesion: 0.05
Nodes (51): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AdminUserPage() (+43 more)

### Community 24 - "corpus-actions.ts"
Cohesion: 0.08
Nodes (46): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+38 more)

### Community 25 - "ocr-engine.ts"
Cohesion: 0.06
Nodes (47): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr(), createOcrWorker() (+39 more)

### Community 26 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (46): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), extractPdf(), ExtractResult, extractText() (+38 more)

### Community 27 - "agent-core.ts"
Cohesion: 0.07
Nodes (35): dynamic, metadata, RegulatoryCorpusPage(), extractJson(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema (+27 more)

### Community 28 - "button.tsx"
Cohesion: 0.07
Nodes (34): PALETTE, RestoreButton(), SupplyArticleRow, TYPES, CATEGORY_SUGGESTIONS, Perm, PermBtn(), UserLite (+26 more)

### Community 29 - "prisma.ts"
Cohesion: 0.08
Nodes (25): dynamic, GET(), EntityRow, dynamic, EntitesPage(), actorFor(), actorFor(), actorFor() (+17 more)

### Community 30 - "getAppSettings"
Cohesion: 0.09
Nodes (43): POST(), dynamic, POST(), DatabasesPage(), decideAdvance(), requestHrDocument(), connectMailbox(), disconnectMailbox() (+35 more)

### Community 31 - "formatDate"
Cohesion: 0.06
Nodes (43): FocusCard(), AggNum(), MarketResearchListPage(), dzd(), fmtPct(), MarketPricingPage(), StatBlock(), AssistantPage() (+35 more)

### Community 32 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (41): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+33 more)

### Community 33 - "directives/page.tsx"
Cohesion: 0.08
Nodes (36): BudgetContextBar(), CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt, BudgetRow, BudgetsTable(), MONTHS (+28 more)

### Community 34 - "utils.ts"
Cohesion: 0.07
Nodes (35): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+27 more)

### Community 35 - "hasGlobalView"
Cohesion: 0.08
Nodes (46): EventDetail(), EventForm(), CorbeillePage(), RequestActions(), RequesterWindow(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+38 more)

### Community 36 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 37 - "promo-material-actions.ts"
Cohesion: 0.19
Nodes (35): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+27 more)

### Community 38 - "library-actions.ts"
Cohesion: 0.09
Nodes (37): FindingEvidence(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+29 more)

### Community 39 - "dossier-chat.ts"
Cohesion: 0.10
Nodes (36): AiTextResult, askDossier(), buildOverview(), buildPrompt(), ChatTurn, cleanAnswer(), DossierChatResult, expandQueryTerms() (+28 more)

### Community 40 - "market-research.ts"
Cohesion: 0.08
Nodes (35): GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), askClaude(), analyzeMarketResearch(), buildContext() (+27 more)

### Community 41 - "regAudit"
Cohesion: 0.09
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 42 - "entity-access.ts"
Cohesion: 0.11
Nodes (35): GET(), SearchPage(), isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+27 more)

### Community 43 - "aiConfigured"
Cohesion: 0.09
Nodes (35): AiControlCenterPage(), AssistantPage(), dynamic, TodayPage(), MorningBrief(), refreshMyBrief(), analyzeFieldReportAction(), aiConfigured() (+27 more)

### Community 44 - "market/engine.ts"
Cohesion: 0.12
Nodes (37): dominantOrigin(), enrichLineById(), matchOurProduct(), parseBoxSize(), DZD_PER_USD, getMarketData(), PchRow, allowedMfg() (+29 more)

### Community 45 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 46 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 47 - "dossier-actions.ts"
Cohesion: 0.12
Nodes (33): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+25 more)

### Community 48 - "assistant.ts"
Cohesion: 0.09
Nodes (37): MedicalDirectory(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+29 more)

### Community 49 - "hr-document-actions.ts"
Cohesion: 0.13
Nodes (30): ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), applyAnnualLeaveBalance(), archiveHrRequestIfDone() (+22 more)

### Community 50 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (28): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+20 more)

### Community 51 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (28): AdProItemsPanel(), Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem() (+20 more)

### Community 52 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (31): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+23 more)

### Community 53 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (31): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), parseRef(), sendMessage() (+23 more)

### Community 54 - "workflow-builder.tsx"
Cohesion: 0.11
Nodes (28): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+20 more)

### Community 55 - "users/[id]/page.tsx"
Cohesion: 0.13
Nodes (28): AccessMatrix(), ModuleAccessRow, ACTION_FR, ROW_SCOPED, GrantOption, RowGrants(), RowGrantsProps, deviceIcon() (+20 more)

### Community 56 - "budget.ts"
Cohesion: 0.11
Nodes (24): GET(), dynamic, PaiePage(), PayrollRow, budgetExportFilename(), buildBudgetWorkbook(), day(), rate() (+16 more)

### Community 57 - "drive-actions.ts"
Cohesion: 0.15
Nodes (27): POST(), FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions() (+19 more)

### Community 58 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), DeleteVisitButton(), createDoctor(), createInstitution() (+22 more)

### Community 59 - "message-thread.tsx"
Cohesion: 0.13
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 60 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 61 - "messaging-actions.ts"
Cohesion: 0.18
Nodes (28): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+20 more)

### Community 62 - "auth.ts"
Cohesion: 0.12
Nodes (20): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+12 more)

### Community 63 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 64 - "congress-request-actions.ts"
Cohesion: 0.23
Nodes (27): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+19 more)

### Community 65 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (28): AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), emitFinancials(), ensureInstance(), entityPath() (+20 more)

### Community 66 - "validation-actions.ts"
Cohesion: 0.13
Nodes (26): RuleControls(), RuleEditor(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule(), ITEM_DECISIONS, PRIORITIES (+18 more)

### Community 67 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 68 - "mon-espace/page.tsx"
Cohesion: 0.11
Nodes (22): FeedbackPage(), Opt, Result, VisitRow, VisitsTable(), AdvanceItem, MyAdvances(), LeaveItem (+14 more)

### Community 69 - "(app)/layout.tsx"
Cohesion: 0.11
Nodes (19): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+11 more)

### Community 70 - "stream/route.ts"
Cohesion: 0.13
Nodes (21): dynamic, maxDuration, runtime, dynamic, metadata, VersionsPage(), Group(), STAGE (+13 more)

### Community 71 - "storage.ts"
Cohesion: 0.12
Nodes (21): GET(), delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord() (+13 more)

### Community 72 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 73 - "calendar.ts"
Cohesion: 0.16
Nodes (24): CalendarView(), colorOf(), CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+16 more)

### Community 74 - "meetings/[id]/page.tsx"
Cohesion: 0.10
Nodes (22): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+14 more)

### Community 75 - "sectionByCode"
Cohesion: 0.13
Nodes (22): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+14 more)

### Community 76 - "lib/messaging.ts"
Cohesion: 0.12
Nodes (21): dynamic, GET(), dynamic, POST(), DOT, MyStatus(), parseAttachments(), setMessagingStatus() (+13 more)

### Community 77 - "explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 78 - "settings.ts"
Cohesion: 0.16
Nodes (18): dynamic, POST(), dynamic, POST(), dynamic, POST(), assistantNudge(), AiFeature (+10 more)

### Community 79 - "test-center/types.ts"
Cohesion: 0.12
Nodes (18): fmt(), pct(), TestCenterPage(), LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup() (+10 more)

### Community 80 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 81 - "departments-manager.tsx"
Cohesion: 0.17
Nodes (22): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+14 more)

### Community 82 - "molecule.ts"
Cohesion: 0.19
Nodes (22): analyzeMoleculeSafe(), canonicalForm(), dosageMatches(), extractDosage(), FORM_RULES, GalenicForm, moleculeMatches(), moleculeStem() (+14 more)

### Community 83 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 84 - "field-reports.ts"
Cohesion: 0.12
Nodes (19): dynamic, GET(), dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle (+11 more)

### Community 85 - "workflow.ts"
Cohesion: 0.14
Nodes (19): AdminWorkflowsPage(), dynamic, CongressIntlDetailPage(), CongressNatDetailPage(), Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView (+11 more)

### Community 86 - "budget-forms.tsx"
Cohesion: 0.18
Nodes (22): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategorySheet() (+14 more)

### Community 87 - "messenger.tsx"
Cohesion: 0.16
Nodes (21): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+13 more)

### Community 88 - "validations.ts"
Cohesion: 0.11
Nodes (19): fd(), form(), form(), fd(), actor(), fd(), CONG_STAGE, CrossValidationItem (+11 more)

### Community 89 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 90 - "zip-inspector.ts"
Cohesion: 0.16
Nodes (22): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+14 more)

### Community 91 - "event-actions.ts"
Cohesion: 0.15
Nodes (19): EditEventButton(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration(), inEnum() (+11 more)

### Community 92 - "departments.ts"
Cohesion: 0.16
Nodes (19): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DeptLite, EmpLite, flattenTree() (+11 more)

### Community 93 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (16): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+8 more)

### Community 94 - "generate.ts"
Cohesion: 0.17
Nodes (18): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+10 more)

### Community 95 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 96 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 97 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 98 - "product-explorer.tsx"
Cohesion: 0.17
Nodes (18): fmtDzd(), fmtPct(), fmtPrice(), fmtUsd(), pctTone(), ProductExplorer(), SuggestField(), analyzeMarketMolecule() (+10 more)

### Community 99 - "document-preview.tsx"
Cohesion: 0.18
Nodes (13): FileViewer(), ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE (+5 more)

### Community 100 - "meeting-actions.ts"
Cohesion: 0.19
Nodes (19): ManageBar(), ProposalActions(), ShareLink(), TranscriptPanel(), acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), DENIED (+11 more)

### Community 101 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 102 - "topbar.tsx"
Cohesion: 0.15
Nodes (15): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), NotificationPopup() (+7 more)

### Community 103 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 104 - "directive-actions.ts"
Cohesion: 0.20
Nodes (17): DirectiveDetailPage(), archiveDirective(), canManage(), canParticipate(), createDirective(), DirectiveLike, nextRef(), postDirectiveMessage() (+9 more)

### Community 105 - "messaging/messages/route.ts"
Cohesion: 0.15
Nodes (14): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+6 more)

### Community 106 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label() (+9 more)

### Community 107 - "drive/page.tsx"
Cohesion: 0.18
Nodes (16): DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite, DriveSpacePage(), dynamic, humanSize() (+8 more)

### Community 108 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 109 - "marche/page.tsx"
Cohesion: 0.19
Nodes (16): dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone(), scoreTone(), VIEWS (+8 more)

### Community 110 - "meetings.ts"
Cohesion: 0.20
Nodes (13): dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug(), jitsiDomain(), MeetingAccessShape (+5 more)

### Community 111 - "beneficiaries-card.tsx"
Cohesion: 0.25
Nodes (15): BeneficiariesCard(), Beneficiary, Mode, Refs, addCongressBeneficiary(), asList(), Benef, entityTypeOf() (+7 more)

### Community 112 - "drive/[id]/page.tsx"
Cohesion: 0.19
Nodes (10): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), CUSTOM_ENTITY_TYPES, CustomValues, getFieldDefs(), fileKind() (+2 more)

### Community 113 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 114 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 115 - "currentCompanyWhere"
Cohesion: 0.17
Nodes (13): StocksPage(), CompanyLite, companyWhere(), currentCompanyWhere(), LedgerRow, MONTHS_FR, getPromoMaterials(), PromoDetail (+5 more)

### Community 116 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 117 - "corpus/actions.ts"
Cohesion: 0.23
Nodes (11): Citation, CorpusAdmin(), Source, Version, canManage(), createCorpusSourceVersion(), Result, searchCorpusAction() (+3 more)

### Community 118 - "event-form.tsx"
Cohesion: 0.16
Nodes (12): CreateEventButton(), d10(), EventFields(), Result, PARTICIPANT_ROLE, ACTIVE, buildStats(), EventDetail (+4 more)

### Community 119 - "run.ts"
Cohesion: 0.18
Nodes (12): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), OutputSchema, PERSPECTIVES, PerspectiveSchema (+4 more)

### Community 120 - "queries/drive.ts"
Cohesion: 0.24
Nodes (14): DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow, DriveSpaceTab, getDriveListing(), getDriveSpacesForUser(), nodeArgs() (+6 more)

### Community 121 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.19
Nodes (14): failJob(), runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs() (+6 more)

### Community 122 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 123 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 124 - "regulatory-drive-mirror.ts"
Cohesion: 0.29
Nodes (10): POST(), cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult (+2 more)

### Community 125 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 126 - "ai-health.ts"
Cohesion: 0.23
Nodes (7): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiHealthRun, getLatestAiHealth(), performAiHealthCheck()

### Community 127 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 128 - "report-editor.tsx"
Cohesion: 0.32
Nodes (10): MessageAttachments(), DoctorPicker(), ReportEditor(), Attachments(), SimpleReportEditor(), formatBytes(), deleteFieldReportAttachment(), reopenFieldReport() (+2 more)

### Community 129 - "medical-directory.tsx"
Cohesion: 0.19
Nodes (11): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, MEDICAL_SECTOR (+3 more)

### Community 130 - "new-conversation.tsx"
Cohesion: 0.14
Nodes (6): MemberMultiSelect(), Mode, SearchBox(), EmployeeFormValues, Option, Props

### Community 131 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 132 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 133 - "today.ts"
Cohesion: 0.22
Nodes (10): CalendarEventDTO, greetingFor(), rankToday(), reasonOf(), REASONS, score(), day(), NOW (+2 more)

### Community 134 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 135 - "organigramme/page.tsx"
Cohesion: 0.29
Nodes (8): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage()

### Community 136 - "products.ts"
Cohesion: 0.35
Nodes (10): dynamic, MarketProductsPage(), clean(), getPchProducts(), PchProduct, productFilterOptions(), ProductSearchResult, searchProducts() (+2 more)

### Community 137 - "heavy-parse.ts"
Cohesion: 0.30
Nodes (8): clampInt(), HeavyKind, heavyText(), parseHeavyInWorker(), parseInline(), resolveWorkerPath(), workerThresholdBytes(), workerTimeoutMs()

### Community 138 - "queries/admin-requests.ts"
Cohesion: 0.31
Nodes (9): CourseDTO, CoursesPage(), DriverPage(), getAssistantData(), getDriverMissions(), getMissionAttachments(), getRequestList(), REQ_INCLUDE (+1 more)

### Community 139 - "panels.tsx"
Cohesion: 0.29
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+1 more)

### Community 140 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 141 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 142 - "data.ts"
Cohesion: 0.18
Nodes (10): Cache, DIR, IqviaRow, LabRow, loadNdjson(), MarketMeta, NomRow, SRC_IQVIA (+2 more)

### Community 143 - "hr-documents.ts"
Cohesion: 0.33
Nodes (10): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrQueueItem, HrRequestDTO, mapDoc(), mapReq() (+2 more)

### Community 144 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 145 - "agents/actions.ts"
Cohesion: 0.29
Nodes (7): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), applicableAgents()

### Community 146 - "stocks-view.tsx"
Cohesion: 0.20
Nodes (9): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, SnapshotDTO, TabKey, TABS, todayInput() (+1 more)

### Community 147 - "scheduled.ts"
Cohesion: 0.36
Nodes (9): claimNext(), runDueRegulatoryJobs(), pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications() (+1 more)

### Community 148 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 149 - "callback/route.ts"
Cohesion: 0.54
Nodes (6): POST(), dynamic, GET(), readDocEditToken(), readEditToken(), verifyJwt()

### Community 150 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 151 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 152 - "mobile-tabbar.tsx"
Cohesion: 0.46
Nodes (6): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY

### Community 153 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 154 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 155 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 156 - "validation-item-review.tsx"
Cohesion: 0.38
Nodes (6): Decision, ItemReview(), LABEL, pill(), TONE, clearValidationItem()

### Community 157 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 158 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 159 - "admin/corbeille/page.tsx"
Cohesion: 0.47
Nodes (4): CorbeillePage(), dynamic, TrashItem, TrashList()

### Community 160 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 161 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 162 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 163 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 164 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 165 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 166 - "checkin/page.tsx"
Cohesion: 0.50
Nodes (3): CheckinConfirm(), CheckinPage(), dynamic

### Community 167 - "payroll-matrix.tsx"
Cohesion: 0.50
Nodes (4): MONTHS, PayrollCell, PayrollMatrix(), ym()

### Community 168 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 169 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 170 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 171 - "request-controls.tsx"
Cohesion: 0.83
Nodes (3): currentYm(), LEAVE_TYPES, NewRequestButton()

## Knowledge Gaps
- **1102 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1097 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `getCurrentUser`, `requireModule`, `notifyUser`, `regulatory/[id]/page.tsx`, `fdStr`, `requireUser`, `lib/labels.ts`, `brain-cockpit.tsx`, `userCan`, `drive-storage.ts`, `anyRoleFilter`, `rh/page.tsx`, `mail.ts`, `upload/session.ts`, `recordAudit`, `[dossierId]/page.tsx`, `anpp-process.tsx`, `assistant-actions.ts`, `batch-runner.ts`, `rules/engine.ts`, `rbac.ts`, `corpus-actions.ts`, `ocr-engine.ts`, `jobs/runner.ts`, `agent-core.ts`, `getAppSettings`, `test-center/runner.ts`, `directives/page.tsx`, `utils.ts`, `hasGlobalView`, `promo-material-actions.ts`, `library-actions.ts`, `dossier-chat.ts`, `market-research.ts`, `regAudit`, `entity-access.ts`, `aiConfigured`, `adoption.ts`, `build-facts.ts`, `dossier-actions.ts`, `assistant.ts`, `hr-document-actions.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `platform-audit/engine.ts`, `queries/messaging.ts`, `workflow-builder.tsx`, `users/[id]/page.tsx`, `budget.ts`, `drive-actions.ts`, `medical-actions.ts`, `bd-strategic-table.tsx`, `messaging-actions.ts`, `auth.ts`, `congress-request-actions.ts`, `workflow/engine.ts`, `validation-actions.ts`, `mon-espace/page.tsx`, `(app)/layout.tsx`, `stream/route.ts`, `storage.ts`, `smart-mail-actions.ts`, `calendar.ts`, `meetings/[id]/page.tsx`, `lib/messaging.ts`, `explorer.ts`, `settings.ts`, `test-center/types.ts`, `lifecycle/actions.ts`, `departments-manager.tsx`, `migration-cert.ts`, `field-reports.ts`, `workflow.ts`, `validations.ts`, `event-actions.ts`, `departments.ts`, `onboarding-wizard.tsx`, `generate.ts`, `invariants/registry.ts`, `admin-settings-forms.tsx`, `meeting-actions.ts`, `directive-actions.ts`, `process-intelligence.ts`, `drive/page.tsx`, `auth-actions.ts`, `meetings.ts`, `beneficiaries-card.tsx`, `drive/[id]/page.tsx`, `pch.ts`, `supplier/actions.ts`, `currentCompanyWhere`, `corpus/actions.ts`, `event-form.tsx`, `run.ts`, `queries/drive.ts`, `pipeline.upload.e2e.test.ts`, `compare-versions.ts`, `regulatory-drive-mirror.ts`, `pch/export/route.ts`, `ai-health.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `push.ts`, `organigramme/page.tsx`, `queries/admin-requests.ts`, `reminder-actions.ts`, `hr-documents.ts`, `meetings/page.tsx`, `agents/actions.ts`, `scheduled.ts`, `callback/route.ts`, `[token]/route.ts`, `admin/corbeille/page.tsx`, `events/[id]/export/route.ts`, `checkin/page.tsx`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `report-editor.tsx`, `requireModule`, `notifyUser`, `regulatory/[id]/page.tsx`, `fdStr`, `stock-snapshot-actions.ts`, `getCurrentUser`, `brain-cockpit.tsx`, `userCan`, `reminder-actions.ts`, `recordAudit`, `agents/actions.ts`, `anpp-process.tsx`, `assistant-actions.ts`, `rules/engine.ts`, `rbac.ts`, `corpus-actions.ts`, `validation-item-review.tsx`, `getAppSettings`, `admin/corbeille/page.tsx`, `hasGlobalView`, `promo-material-actions.ts`, `library-actions.ts`, `regAudit`, `entity-access.ts`, `aiConfigured`, `dossier-actions.ts`, `hr-document-actions.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `platform-audit/engine.ts`, `queries/messaging.ts`, `workflow-builder.tsx`, `users/[id]/page.tsx`, `drive-actions.ts`, `medical-actions.ts`, `messaging-actions.ts`, `congress-request-actions.ts`, `validation-actions.ts`, `mon-espace/page.tsx`, `(app)/layout.tsx`, `stream/route.ts`, `storage.ts`, `smart-mail-actions.ts`, `meetings/[id]/page.tsx`, `lib/messaging.ts`, `settings.ts`, `test-center/types.ts`, `lifecycle/actions.ts`, `departments-manager.tsx`, `messenger.tsx`, `event-actions.ts`, `onboarding-wizard.tsx`, `product-explorer.tsx`, `meeting-actions.ts`, `directive-actions.ts`, `auth-actions.ts`, `beneficiaries-card.tsx`, `supplier/actions.ts`, `corpus/actions.ts`, `ai-health.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `requireModule`, `notifyUser`, `regulatory/[id]/page.tsx`, `fdStr`, `requireUser`, `lib/labels.ts`, `brain-cockpit.tsx`, `stock-snapshot-actions.ts`, `queries/admin-requests.ts`, `drive-storage.ts`, `anyRoleFilter`, `rh/page.tsx`, `reminder-actions.ts`, `recordAudit`, `anpp-process.tsx`, `assistant-actions.ts`, `rbac.ts`, `prisma.ts`, `getAppSettings`, `formatDate`, `directives/page.tsx`, `events/[id]/export/route.ts`, `hasGlobalView`, `promo-material-actions.ts`, `market-research.ts`, `entity-access.ts`, `aiConfigured`, `adoption.ts`, `dossier-actions.ts`, `assistant.ts`, `hr-document-actions.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `queries/messaging.ts`, `users/[id]/page.tsx`, `budget.ts`, `drive-actions.ts`, `medical-actions.ts`, `messaging-actions.ts`, `congress-request-actions.ts`, `validation-actions.ts`, `mon-espace/page.tsx`, `(app)/layout.tsx`, `stream/route.ts`, `calendar.ts`, `lib/messaging.ts`, `settings.ts`, `test-center/types.ts`, `departments-manager.tsx`, `field-reports.ts`, `workflow.ts`, `validations.ts`, `event-actions.ts`, `departments.ts`, `product-explorer.tsx`, `meeting-actions.ts`, `directive-actions.ts`, `messaging/messages/route.ts`, `process-intelligence.ts`, `drive/page.tsx`, `drive/[id]/page.tsx`, `currentCompanyWhere`, `queries/drive.ts`, `pch/export/route.ts`, `ai-health.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05258326776816155 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.04440581542351454 - nodes in this community are weakly interconnected._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.039414414414414414 - nodes in this community are weakly interconnected._