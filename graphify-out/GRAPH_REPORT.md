# Graph Report - src  (2026-08-05)

## Corpus Check
- 817 files · ~547,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4922 nodes · 19419 edges · 152 communities (146 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97714f47`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- lib/session.ts
- formatDate
- requireModule
- lib/labels.ts
- requireUser
- medical-info-actions.ts
- recordAudit
- drive-actions.ts
- brain-cockpit.tsx
- notifyUser
- fdStr
- company.ts
- prisma.ts
- regCan
- upload/session.ts
- access-actions.ts
- mail.ts
- [dossierId]/page.tsx
- FindingInput
- aiConfigured
- drive-storage.ts
- budget-board.tsx
- anyRoleFilter
- test-center/runner.ts
- rules/engine.ts
- cn
- platform-audit/engine.ts
- lib/ai.ts
- anpp-process.tsx
- lib/audit.ts
- rbac.ts
- mistral-ocr.ts
- hr-document-actions.ts
- invariants/registry.ts
- promo-material-actions.ts
- departments-manager.tsx
- getAppSettings
- getCurrentUser
- agent-core.ts
- jobs/runner.ts
- queries/messaging.ts
- adoption.ts
- regulatory/[id]/page.tsx
- build-facts.ts
- rules/admin-actions.ts
- workflow.ts
- events/[id]/page.tsx
- market-research.ts
- finances/page.tsx
- message-thread.tsx
- messaging-actions.ts
- assistant.ts
- workflow/engine.ts
- dossier-actions.ts
- competition.ts
- medical-actions.ts
- congress-request-actions.ts
- document-preview.tsx
- pch-tender-line-actions.ts
- admin-delete-actions.ts
- calendar.ts
- lib/messaging.ts
- assistant-actions.ts
- evidence.ts
- hasGlobalView
- pch.ts
- ocr-engine.ts
- migration-cert.ts
- notify.ts
- extract-facts.ts
- lifecycle/actions.ts
- (app)/layout.tsx
- messenger.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- budget-envelope-actions.ts
- generate.ts
- extract-text.ts
- zip-inspector.ts
- meetings/[id]/page.tsx
- requests/page.tsx
- onboarding-wizard.tsx
- getMarketData
- meetings.ts
- admin-settings-forms.tsx
- queries/drive.ts
- field-reports.ts
- currentCompanyWhere
- bd-strategic-table.tsx
- support-actions.ts
- process-intelligence.ts
- queries/documents.ts
- radar/page.tsx
- driver/page.tsx
- review-agent.ts
- products.ts
- directive-actions.ts
- run.ts
- getMailAccount
- drive-space-manager.tsx
- meeting-actions.ts
- upload-manager.tsx
- mon-espace/page.tsx
- validations.ts
- dashboard.ts
- topbar.tsx
- compare-versions.ts
- company-actions.ts
- stock-snapshot-actions.ts
- hr-documents.ts
- office-templates.ts
- entity-access.ts
- push.ts
- medical.ts
- payroll-hr-actions.ts
- supplies-manager.tsx
- background-upload.tsx
- reminder-actions.ts
- assistant-files.ts
- congress-beneficiary-actions.ts
- organigramme/page.tsx
- meetings/page.tsx
- auth-actions.ts
- supplier-auth.ts
- bd.ts
- regulatory-drive-mirror.ts
- typing/route.ts
- workflow-actions.ts
- Adventum Autonomous Test Center — architecture
- origin.ts
- MailClient
- mime.ts
- scheduled.ts
- beneficiaries-card.tsx
- dossiers.ts
- meeting-chat.tsx
- forecast-grid.tsx
- push-register.tsx
- [token]/route.ts
- next-auth.d.ts
- activity-tracker.tsx
- notification-chime.tsx
- app/layout.tsx
- courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 541 edges
2. `userCan()` - 434 edges
3. `fdStr()` - 418 edges
4. `recordAudit()` - 371 edges
5. `prisma` - 347 edges
6. `requireModule()` - 198 edges
7. `hasGlobalView()` - 147 edges
8. `Button` - 142 edges
9. `cn()` - 140 edges
10. `formatDate()` - 122 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `OrganigrammePage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/page.tsx → src/lib/session.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (152 total, 6 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.03
Nodes (118): DriveStorageSettings(), OrgBranch(), ENV_LABEL, MODES, Option, RuleDTO, ResearchMeta(), MONTH_LABELS (+110 more)

### Community 1 - "lib/session.ts"
Cohesion: 0.06
Nodes (104): AccessUser, ACTION_COLS, ACTION_LABELS, Opt, UserModuleState, ACTION_FR, dynamic, ROW_SCOPED (+96 more)

### Community 2 - "formatDate"
Cohesion: 0.04
Nodes (99): BD_DOC_CATEGORIES, ProjectEditor(), ProjectStatusBadge(), Budget(), CONGRESS_DOC_CATEGORIES, ApprovalButtons(), ApprovalsPage(), ExpenseAckItem (+91 more)

### Community 3 - "requireModule"
Cohesion: 0.03
Nodes (111): AccessByModulePage(), ActivityPage(), fmtDuration(), AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, AdminFeedbackPage() (+103 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BDPipeline() (+90 more)

### Community 5 - "requireUser"
Cohesion: 0.05
Nodes (89): PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL (+81 more)

### Community 6 - "medical-info-actions.ts"
Cohesion: 0.06
Nodes (70): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+62 more)

### Community 7 - "recordAudit"
Cohesion: 0.05
Nodes (79): VariationDTO, VariationPanel(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange(), deleteBdProduct() (+71 more)

### Community 8 - "drive-actions.ts"
Cohesion: 0.05
Nodes (64): inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage(), dynamic, metadata, scoreColor() (+56 more)

### Community 9 - "brain-cockpit.tsx"
Cohesion: 0.05
Nodes (69): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+61 more)

### Community 10 - "notifyUser"
Cohesion: 0.06
Nodes (71): RuleControls(), RuleEditor(), RequestActions(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields() (+63 more)

### Community 11 - "fdStr"
Cohesion: 0.08
Nodes (67): EditTenderButton(), OrdersManager(), useSubmit(), saveAdoptionSettings(), createBD(), canManagePlan(), createDelegatePlan(), deleteDelegatePlan() (+59 more)

### Community 12 - "company.ts"
Cohesion: 0.05
Nodes (55): dynamic, GET(), runtime, dynamic, maxDuration, POST(), runtime, dynamic (+47 more)

### Community 13 - "prisma.ts"
Cohesion: 0.06
Nodes (29): dynamic, GET(), dynamic, GET(), actorFor(), actorFor(), OLD_HASH, actor() (+21 more)

### Community 14 - "regCan"
Cohesion: 0.07
Nodes (49): Citation, CorpusAdmin(), Source, Version, Cycle, Point, ReservesPanel(), Props (+41 more)

### Community 15 - "upload/session.ts"
Cohesion: 0.08
Nodes (55): dynamic, GET(), runtime, dynamic, POST(), runtime, RFC-3986, IngestResult (+47 more)

### Community 16 - "access-actions.ts"
Cohesion: 0.06
Nodes (46): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), ModuleAccessGrid(), AccessMatrix(), GrantOption (+38 more)

### Community 17 - "mail.ts"
Cohesion: 0.06
Nodes (56): dynamic, POST(), acquirePooled(), acquireSlot(), addrStr(), appendToSent(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD (+48 more)

### Community 18 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (48): AgentItem, AgentsPanel(), RunState, ApproveNameButton(), DossierChatPanel(), DocgenPanel(), GenDoc, Template (+40 more)

### Community 19 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 20 - "aiConfigured"
Cohesion: 0.08
Nodes (45): Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiConfigured(), AiTextResult, askDossierAction(), askReservesAction() (+37 more)

### Community 21 - "drive-storage.ts"
Cohesion: 0.07
Nodes (41): blobChunkBytes(), encryptWhole(), masterKey(), putBlobChunked(), releaseBlob(), sha256(), clampInt(), ingestCore() (+33 more)

### Community 22 - "budget-board.tsx"
Cohesion: 0.08
Nodes (47): GET(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetBoard(), BudgetTotalInfo, BudgetTotalSheet() (+39 more)

### Community 23 - "anyRoleFilter"
Cohesion: 0.09
Nodes (45): AffectationsPage(), dynamic, CataloguePage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage() (+37 more)

### Community 24 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (39): fmt(), pct(), TestCenterPage(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard() (+31 more)

### Community 25 - "rules/engine.ts"
Cohesion: 0.07
Nodes (45): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+37 more)

### Community 26 - "cn"
Cohesion: 0.05
Nodes (41): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+33 more)

### Community 27 - "platform-audit/engine.ts"
Cohesion: 0.08
Nodes (41): GET(), generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding (+33 more)

### Community 28 - "lib/ai.ts"
Cohesion: 0.07
Nodes (41): runAiHealthCheckNow(), AiHealthCheckButton(), ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment() (+33 more)

### Community 29 - "anpp-process.tsx"
Cohesion: 0.07
Nodes (43): RegulatoryProcess(), STATE_OPTS, StepNote(), NewProductButton(), regStage(), RegulatoryPage(), CATEGORY_OPTS, Col (+35 more)

### Community 30 - "lib/audit.ts"
Cohesion: 0.08
Nodes (32): FieldsManager(), ActiveToggle(), ImpersonateButton(), resetActivityTime(), updateAiSettings(), computeStatus(), createBudget(), deleteCustomFieldDef() (+24 more)

### Community 31 - "rbac.ts"
Cohesion: 0.05
Nodes (41): dynamic, esc(), GET(), SupportDetailPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata (+33 more)

### Community 32 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 33 - "hr-document-actions.ts"
Cohesion: 0.09
Nodes (43): EventDetail(), EventForm(), RequestRow(), runAutopilot(), executeAssistantAction(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES (+35 more)

### Community 34 - "invariants/registry.ts"
Cohesion: 0.09
Nodes (33): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantOutcome (+25 more)

### Community 35 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 36 - "departments-manager.tsx"
Cohesion: 0.10
Nodes (38): DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun(), DepartmentsPage() (+30 more)

### Community 37 - "getAppSettings"
Cohesion: 0.11
Nodes (34): dynamic, POST(), POST(), dynamic, POST(), dynamic, POST(), dynamic (+26 more)

### Community 38 - "getCurrentUser"
Cohesion: 0.09
Nodes (33): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+25 more)

### Community 39 - "agent-core.ts"
Cohesion: 0.09
Nodes (27): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+19 more)

### Community 40 - "jobs/runner.ts"
Cohesion: 0.11
Nodes (37): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+29 more)

### Community 41 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (35): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+27 more)

### Community 42 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 43 - "regulatory/[id]/page.tsx"
Cohesion: 0.08
Nodes (32): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, DciAssociationField(), EditProductButton(), EditProductValues, UserOption (+24 more)

### Community 44 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 45 - "rules/admin-actions.ts"
Cohesion: 0.10
Nodes (28): RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources(), activeCorpusSize(), canManage() (+20 more)

### Community 46 - "workflow.ts"
Cohesion: 0.09
Nodes (30): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), Props, BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES (+22 more)

### Community 47 - "events/[id]/page.tsx"
Cohesion: 0.08
Nodes (29): CreateEventButton(), d10(), EventFields(), Result, EventFundingPanel(), dynamic, EventsPage(), dynamic (+21 more)

### Community 48 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 49 - "finances/page.tsx"
Cohesion: 0.08
Nodes (27): dynamic, metadata, BudgetRow, BudgetsTable(), MONTHS, DashboardPage(), STATUS_COLORS, ComptaCockpit() (+19 more)

### Community 50 - "message-thread.tsx"
Cohesion: 0.12
Nodes (28): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment (+20 more)

### Community 51 - "messaging-actions.ts"
Cohesion: 0.15
Nodes (33): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+25 more)

### Community 52 - "assistant.ts"
Cohesion: 0.09
Nodes (33): callClaude(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), findDoctor() (+25 more)

### Community 53 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (30): getManagerOfUser(), getWorkflowDefinitions(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), ensureInstance() (+22 more)

### Community 54 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (28): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite (+20 more)

### Community 55 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 56 - "medical-actions.ts"
Cohesion: 0.12
Nodes (29): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), createVisit() (+21 more)

### Community 57 - "congress-request-actions.ts"
Cohesion: 0.23
Nodes (27): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+19 more)

### Community 58 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 59 - "pch-tender-line-actions.ts"
Cohesion: 0.17
Nodes (26): enrichTenderLine(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine, allowedMfg() (+18 more)

### Community 60 - "admin-delete-actions.ts"
Cohesion: 0.13
Nodes (22): PermanentDeleteButton(), PurgeOrphansButton(), CorbeillePage(), dynamic, TrashItem, TrashList(), delegateOf(), DeletableKind (+14 more)

### Community 61 - "calendar.ts"
Cohesion: 0.16
Nodes (24): CalendarView(), colorOf(), CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent() (+16 more)

### Community 62 - "lib/messaging.ts"
Cohesion: 0.12
Nodes (21): dynamic, GET(), dynamic, POST(), DOT, MyStatus(), parseAttachments(), setMessagingStatus() (+13 more)

### Community 63 - "assistant-actions.ts"
Cohesion: 0.13
Nodes (20): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), MessageBubble(), Msg, nextId() (+12 more)

### Community 64 - "evidence.ts"
Cohesion: 0.11
Nodes (21): AssistantPage(), dynamic, sttConfigured(), base, Certification, CertificationInput, CertificationResult, BETTER (+13 more)

### Community 65 - "hasGlobalView"
Cohesion: 0.19
Nodes (23): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), DirectiveDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), CongressDetail (+15 more)

### Community 66 - "pch.ts"
Cohesion: 0.12
Nodes (23): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), d10(), LogisticsRow() (+15 more)

### Community 67 - "ocr-engine.ts"
Cohesion: 0.14
Nodes (21): analyzeEmployeeContract(), CONTRACT_TYPES_UP, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED (+13 more)

### Community 68 - "migration-cert.ts"
Cohesion: 0.19
Nodes (21): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), infraChecks() (+13 more)

### Community 69 - "notify.ts"
Cohesion: 0.14
Nodes (19): DriveComments(), RequestThread(), Res, deleteDriveComment(), postDriveComment(), markAllNotificationsRead(), sendBroadcast(), createRegRequest() (+11 more)

### Community 70 - "extract-facts.ts"
Cohesion: 0.14
Nodes (22): AssignmentMatrix(), key(), nOr0(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput (+14 more)

### Community 71 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 72 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (16): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), NotificationPopup(), Popup, ScreenGuard() (+8 more)

### Community 73 - "messenger.tsx"
Cohesion: 0.16
Nodes (21): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+13 more)

### Community 74 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 75 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 76 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (23): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+15 more)

### Community 77 - "generate.ts"
Cohesion: 0.17
Nodes (18): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+10 more)

### Community 78 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 79 - "zip-inspector.ts"
Cohesion: 0.16
Nodes (22): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+14 more)

### Community 80 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (19): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+11 more)

### Community 81 - "requests/page.tsx"
Cohesion: 0.18
Nodes (18): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), REG_REQUEST_CATEGORY, REG_REQUEST_STATUS, getRegRequest(), listRegRequests() (+10 more)

### Community 82 - "onboarding-wizard.tsx"
Cohesion: 0.13
Nodes (15): ConnectMailbox(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep() (+7 more)

### Community 83 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 84 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 85 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 86 - "queries/drive.ts"
Cohesion: 0.19
Nodes (19): DriveSpacePage(), humanSize(), DrivePage(), humanSize(), DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow (+11 more)

### Community 87 - "field-reports.ts"
Cohesion: 0.12
Nodes (18): HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportsOverviewPage(), FieldReportsPage(), canViewFieldReportsOverview() (+10 more)

### Community 88 - "currentCompanyWhere"
Cohesion: 0.14
Nodes (16): StocksPage(), SnapshotDTO, CompanyLite, companyWhere(), currentCompanyWhere(), LedgerRow, MONTHS_FR, getRhData() (+8 more)

### Community 89 - "bd-strategic-table.tsx"
Cohesion: 0.15
Nodes (17): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+9 more)

### Community 90 - "support-actions.ts"
Cohesion: 0.23
Nodes (16): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+8 more)

### Community 91 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label() (+9 more)

### Community 92 - "queries/documents.ts"
Cohesion: 0.24
Nodes (16): GET(), SearchPage(), executeReadTool(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone(), globalSearch() (+8 more)

### Community 93 - "radar/page.tsx"
Cohesion: 0.19
Nodes (17): dynamic, fmtPct(), fmtUsd(), MarketRadarPage(), Tab, TABS, RecRow, addMonths() (+9 more)

### Community 94 - "driver/page.tsx"
Cohesion: 0.17
Nodes (14): CourseDTO, CoursesBoard(), deadlineLabel(), letter(), CoursesPage(), MissionActions(), letter(), MissionStops() (+6 more)

### Community 95 - "review-agent.ts"
Cohesion: 0.16
Nodes (14): extractJson(), aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding, AiFindingSchema, AiFn, AiOutputSchema (+6 more)

### Community 96 - "products.ts"
Cohesion: 0.22
Nodes (15): dynamic, MarketProductsPage(), MarketProductSearchResult, searchMarketProducts(), clean(), getPchProducts(), MarketProduct, MarketSegment (+7 more)

### Community 97 - "directive-actions.ts"
Cohesion: 0.24
Nodes (15): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+7 more)

### Community 98 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 99 - "getMailAccount"
Cohesion: 0.18
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+5 more)

### Community 100 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 101 - "meeting-actions.ts"
Cohesion: 0.26
Nodes (15): acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink() (+7 more)

### Community 102 - "upload-manager.tsx"
Cohesion: 0.19
Nodes (13): humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob, UploadPhase, UploadProvider() (+5 more)

### Community 103 - "mon-espace/page.tsx"
Cohesion: 0.17
Nodes (13): FeedbackPage(), AdvanceItem, LeaveItem, MyLeaves(), MonEspacePage(), dynamic, metadata, NoAccessPage() (+5 more)

### Community 104 - "validations.ts"
Cohesion: 0.17
Nodes (12): CONG_STAGE, CrossValidationItem, getCrossModuleValidations(), getMyValidationRequests(), getMyValidations(), getPendingValidations(), getSupervisedValidations(), MyValidationItem (+4 more)

### Community 105 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 106 - "topbar.tsx"
Cohesion: 0.22
Nodes (11): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+3 more)

### Community 107 - "compare-versions.ts"
Cohesion: 0.22
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 108 - "company-actions.ts"
Cohesion: 0.28
Nodes (10): EntitiesManager(), EntityRow, PALETTE, dynamic, EntitesPage(), canManageCompanies(), createCompany(), toggleCompany() (+2 more)

### Community 109 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 110 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 111 - "office-templates.ts"
Cohesion: 0.22
Nodes (12): blankDocx(), blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f(), MIME (+4 more)

### Community 112 - "entity-access.ts"
Cohesion: 0.30
Nodes (8): POST(), ActionResult, uploadDocument(), PersistDocInput, persistUploadedDocument(), ENTITY_MODULE, isRequestOwner(), mirrorRegulatoryUpload()

### Community 113 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 114 - "medical.ts"
Cohesion: 0.21
Nodes (11): Props, DelegatePlanDTO, DoctorDTO, getMedicalData(), InstitutionDTO, mapDoctor(), MedicalData, MedicalVisitRow (+3 more)

### Community 115 - "payroll-hr-actions.ts"
Cohesion: 0.35
Nodes (10): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym(), canRunPayroll(), markSalaryPaid(), transferPayrollToBudget() (+2 more)

### Community 116 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 117 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 118 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 119 - "assistant-files.ts"
Cohesion: 0.29
Nodes (7): withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 120 - "congress-beneficiary-actions.ts"
Cohesion: 0.42
Nodes (10): addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf(), removeCongressBeneficiary() (+2 more)

### Community 121 - "organigramme/page.tsx"
Cohesion: 0.29
Nodes (7): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage()

### Community 122 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 123 - "auth-actions.ts"
Cohesion: 0.22
Nodes (7): ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, changePassword(), doSignOut()

### Community 124 - "supplier-auth.ts"
Cohesion: 0.31
Nodes (9): SupplierLoginPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession (+1 more)

### Community 125 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 126 - "regulatory-drive-mirror.ts"
Cohesion: 0.36
Nodes (8): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, MirrorResult, mirrorToProductDrive(), REG_DRIVE_ROOT

### Community 127 - "typing/route.ts"
Cohesion: 0.28
Nodes (6): dynamic, NO_CONTENT, POST(), ConversationTyping, registry, setTyping()

### Community 128 - "workflow-actions.ts"
Cohesion: 0.36
Nodes (8): advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep(), saveWorkflowDefinition(), WORKFLOW_ENTITIES, isWorkflowCategory()

### Community 129 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 130 - "origin.ts"
Cohesion: 0.33
Nodes (6): adProInit, adProOriginRank(), AdProStage, AdProStatus, OriginUser, PRODUCT_MANAGER_ROLES

### Community 131 - "MailClient"
Cohesion: 0.32
Nodes (8): fmtDate(), folderIcon(), folderLabel(), forwardBody(), MailClient(), quoteBody(), Reader(), replySubject()

### Community 132 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 133 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 134 - "beneficiaries-card.tsx"
Cohesion: 0.33
Nodes (6): BeneficiariesCard(), Beneficiary, Mode, Refs, listBeneficiaryRefs(), MEDICAL_SECTOR

### Community 135 - "dossiers.ts"
Cohesion: 0.48
Nodes (6): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), isDossierMember()

### Community 136 - "meeting-chat.tsx"
Cohesion: 0.38
Nodes (6): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), deleteMeetingMessage(), postMeetingMessage()

### Community 137 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 138 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 139 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 140 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 141 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 142 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

## Knowledge Gaps
- **986 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+981 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `formatDate`, `requireModule`, `lib/labels.ts`, `requireUser`, `medical-info-actions.ts`, `recordAudit`, `drive-actions.ts`, `brain-cockpit.tsx`, `notifyUser`, `fdStr`, `company.ts`, `regCan`, `upload/session.ts`, `access-actions.ts`, `mail.ts`, `[dossierId]/page.tsx`, `aiConfigured`, `drive-storage.ts`, `budget-board.tsx`, `anyRoleFilter`, `test-center/runner.ts`, `cn`, `platform-audit/engine.ts`, `lib/ai.ts`, `anpp-process.tsx`, `lib/audit.ts`, `rbac.ts`, `hr-document-actions.ts`, `invariants/registry.ts`, `promo-material-actions.ts`, `departments-manager.tsx`, `getAppSettings`, `getCurrentUser`, `agent-core.ts`, `jobs/runner.ts`, `queries/messaging.ts`, `adoption.ts`, `regulatory/[id]/page.tsx`, `build-facts.ts`, `rules/admin-actions.ts`, `workflow.ts`, `events/[id]/page.tsx`, `market-research.ts`, `finances/page.tsx`, `messaging-actions.ts`, `assistant.ts`, `workflow/engine.ts`, `dossier-actions.ts`, `medical-actions.ts`, `congress-request-actions.ts`, `pch-tender-line-actions.ts`, `admin-delete-actions.ts`, `calendar.ts`, `lib/messaging.ts`, `assistant-actions.ts`, `hasGlobalView`, `pch.ts`, `migration-cert.ts`, `notify.ts`, `lifecycle/actions.ts`, `(app)/layout.tsx`, `supplier/actions.ts`, `budget-envelope-actions.ts`, `generate.ts`, `meetings/[id]/page.tsx`, `requests/page.tsx`, `onboarding-wizard.tsx`, `meetings.ts`, `admin-settings-forms.tsx`, `queries/drive.ts`, `field-reports.ts`, `currentCompanyWhere`, `support-actions.ts`, `process-intelligence.ts`, `queries/documents.ts`, `driver/page.tsx`, `directive-actions.ts`, `run.ts`, `getMailAccount`, `drive-space-manager.tsx`, `meeting-actions.ts`, `mon-espace/page.tsx`, `validations.ts`, `dashboard.ts`, `compare-versions.ts`, `company-actions.ts`, `stock-snapshot-actions.ts`, `hr-documents.ts`, `entity-access.ts`, `push.ts`, `medical.ts`, `payroll-hr-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `organigramme/page.tsx`, `meetings/page.tsx`, `auth-actions.ts`, `supplier-auth.ts`, `bd.ts`, `regulatory-drive-mirror.ts`, `workflow-actions.ts`, `scheduled.ts`, `dossiers.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `button.tsx`, `lib/session.ts`, `formatDate`, `workflow-actions.ts`, `requireModule`, `medical-info-actions.ts`, `dossiers.ts`, `recordAudit`, `brain-cockpit.tsx`, `notifyUser`, `fdStr`, `beneficiaries-card.tsx`, `drive-actions.ts`, `meeting-chat.tsx`, `regCan`, `access-actions.ts`, `company.ts`, `aiConfigured`, `test-center/runner.ts`, `cn`, `platform-audit/engine.ts`, `lib/ai.ts`, `lib/audit.ts`, `rbac.ts`, `hr-document-actions.ts`, `promo-material-actions.ts`, `departments-manager.tsx`, `getAppSettings`, `rules/admin-actions.ts`, `messaging-actions.ts`, `dossier-actions.ts`, `medical-actions.ts`, `congress-request-actions.ts`, `pch-tender-line-actions.ts`, `admin-delete-actions.ts`, `lib/messaging.ts`, `assistant-actions.ts`, `hasGlobalView`, `pch.ts`, `ocr-engine.ts`, `notify.ts`, `lifecycle/actions.ts`, `(app)/layout.tsx`, `messenger.tsx`, `supplier/actions.ts`, `budget-envelope-actions.ts`, `requests/page.tsx`, `onboarding-wizard.tsx`, `support-actions.ts`, `queries/documents.ts`, `products.ts`, `directive-actions.ts`, `run.ts`, `drive-space-manager.tsx`, `meeting-actions.ts`, `mon-espace/page.tsx`, `topbar.tsx`, `company-actions.ts`, `stock-snapshot-actions.ts`, `entity-access.ts`, `payroll-hr-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `auth-actions.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `userCan()` connect `requireUser` to `lib/session.ts`, `formatDate`, `requireModule`, `lib/labels.ts`, `medical-info-actions.ts`, `dossiers.ts`, `drive-actions.ts`, `brain-cockpit.tsx`, `notifyUser`, `fdStr`, `recordAudit`, `prisma.ts`, `access-actions.ts`, `mail.ts`, `budget-board.tsx`, `anyRoleFilter`, `test-center/runner.ts`, `lib/ai.ts`, `anpp-process.tsx`, `lib/audit.ts`, `rbac.ts`, `hr-document-actions.ts`, `promo-material-actions.ts`, `departments-manager.tsx`, `getAppSettings`, `getCurrentUser`, `queries/messaging.ts`, `adoption.ts`, `regulatory/[id]/page.tsx`, `events/[id]/page.tsx`, `market-research.ts`, `finances/page.tsx`, `messaging-actions.ts`, `assistant.ts`, `dossier-actions.ts`, `medical-actions.ts`, `congress-request-actions.ts`, `pch-tender-line-actions.ts`, `calendar.ts`, `lib/messaging.ts`, `assistant-actions.ts`, `hasGlobalView`, `pch.ts`, `ocr-engine.ts`, `(app)/layout.tsx`, `budget-envelope-actions.ts`, `requests/page.tsx`, `queries/drive.ts`, `currentCompanyWhere`, `support-actions.ts`, `process-intelligence.ts`, `queries/documents.ts`, `driver/page.tsx`, `products.ts`, `directive-actions.ts`, `meeting-actions.ts`, `mon-espace/page.tsx`, `validations.ts`, `dashboard.ts`, `company-actions.ts`, `stock-snapshot-actions.ts`, `entity-access.ts`, `payroll-hr-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `typing/route.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _986 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.029308901039357668 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05845648604269294 - nodes in this community are weakly interconnected._
- **Should `formatDate` be split into smaller, more focused modules?**
  _Cohesion score 0.03617899079657252 - nodes in this community are weakly interconnected._