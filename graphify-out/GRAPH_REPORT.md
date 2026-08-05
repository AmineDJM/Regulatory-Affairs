# Graph Report - src  (2026-08-05)

## Corpus Check
- 837 files · ~561,517 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5037 nodes · 19845 edges · 197 communities (191 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `54d17c5d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- userCan
- card.tsx
- regulatory/[id]/page.tsx
- lib/labels.ts
- getCurrentUser
- badge.tsx
- hasGlobalView
- recordAudit
- formatDate
- Button
- aiConfigured
- requireUser
- meeting-actions.ts
- lib/audit.ts
- utils.ts
- prisma.ts
- FindingInput
- drive-storage.ts
- admin-request-actions.ts
- budget-board.tsx
- [dossierId]/page.tsx
- messaging-actions.ts
- onlyofficeConfigured
- promo-material-actions.ts
- test-center/runner.ts
- anyRoleFilter
- dossier-actions.ts
- agent-core.ts
- queries/messaging.ts
- adoption.ts
- bd-strategic-table.tsx
- product-explorer.tsx
- upload/session.ts
- dashboard.ts
- assistant.ts
- jobs/runner.ts
- document-preview.tsx
- regAudit
- platform-audit/engine.ts
- object-storage.ts
- rbac.ts
- message-thread.tsx
- rules/engine.ts
- hr-document-actions.ts
- drive/page.tsx
- rules/admin-actions.ts
- Select
- pch-tender-line-actions.ts
- auth.ts
- drive-actions.ts
- medical-actions.ts
- workflow/engine.ts
- market-research.ts
- competition.ts
- mail.ts
- smart-mail-actions.ts
- workflow-builder.tsx
- manifest.ts
- getAppSettings
- button.tsx
- extract-facts.ts
- explorer.ts
- build-twin.ts
- build-facts.ts
- assistant-chat.tsx
- budget-envelope-actions.ts
- lifecycle/actions.ts
- regulatory-workflow.ts
- zip-inspector.ts
- mistral-ocr.ts
- migration-cert.ts
- field-reports.ts
- access-actions.ts
- calendar.ts
- supplier/actions.ts
- enregistrement/page.tsx
- releaseBlob
- generate.ts
- brain-cockpit.tsx
- currentCompanyWhere
- getMarketData
- entity-access.ts
- features.ts
- adventum-brain/page.tsx
- (app)/layout.tsx
- regulatory/page.tsx
- run.ts
- onboarding-wizard.tsx
- risks.ts
- invariants/registry.ts
- users/[id]/page.tsx
- admin-settings-forms.tsx
- upload-manager.tsx
- assistant-actions.ts
- departments.ts
- scheduled.ts
- admin-delete-actions.ts
- mail-client.tsx
- workflow.ts
- medical-directory.tsx
- anpp-process.tsx
- auth-actions.ts
- lib/drive.ts
- products.ts
- field-report-actions.ts
- support-actions.ts
- review-agent.ts
- ocr-engine.ts
- [versionId]/route.ts
- corpus/actions.ts
- adventum-actions.ts
- drive/[id]/page.tsx
- medical-info-actions.ts
- lib/messaging.ts
- office-templates.ts
- conversation-list.tsx
- pch.ts
- process-intelligence.ts
- ingest.ts
- mistral-ocr.test.ts
- daily-brief.ts
- radar.ts
- event-form.tsx
- regulatory-actions.ts
- department-actions.ts
- validations.ts
- compare-versions.ts
- aiModel
- stock-snapshot-actions.ts
- topbar.tsx
- sidebar.tsx
- today.ts
- extract-text.ts
- push.ts
- organigramme/page.tsx
- canAnswerRegRequests
- assistant-files.ts
- hr-documents.ts
- heavy-parse.ts
- panels.tsx
- reserves/actions.ts
- regulatory-table.tsx
- background-upload.tsx
- reminder-actions.ts
- getMessage
- mail-diagnostic/route.ts
- regulatory-corpus/page.tsx
- congress-workflow.tsx
- hasRole
- meetings/page.tsx
- support-flow.test.ts
- bd.ts
- typing/route.ts
- departments-manager.tsx
- stocks-view.tsx
- supplier-auth.ts
- mail-actions.ts
- withImap
- Adventum Autonomous Test Center — architecture
- message/route.ts
- formatAlgiers
- queries/admin-requests.ts
- drive-space-manager.tsx
- upload-button.tsx
- openPdf
- detect-conflicts.ts
- congress-request-form.tsx
- new-request.tsx
- delegate-plans.tsx
- forecast-grid.tsx
- push-register.tsx
- detect-sections.ts
- [token]/route.ts
- admin/corbeille/page.tsx
- calendar-view.tsx
- bv-requests.tsx
- step-timeline.tsx
- variation-panel.tsx
- employee-form.tsx
- next-auth.d.ts
- payroll-matrix.tsx
- activity-tracker.tsx
- custom-fields-card.tsx
- attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- request-controls.tsx
- supplier-view-card.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 553 edges
2. `userCan()` - 434 edges
3. `fdStr()` - 421 edges
4. `recordAudit()` - 374 edges
5. `prisma` - 355 edges
6. `requireModule()` - 204 edges
7. `hasGlobalView()` - 147 edges
8. `Button` - 144 edges
9. `cn()` - 142 edges
10. `formatDate()` - 124 edges

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

## Communities (197 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.05
Nodes (85): AdminFeedbackPage(), FieldDefDTO, CustomFieldsPage(), AdminSuppliersPage(), AdminWorkflowsPage(), dynamic, dynamic, MarketResearchListPage() (+77 more)

### Community 1 - "userCan"
Cohesion: 0.04
Nodes (108): EntitiesManager(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, EditEventButton() (+100 more)

### Community 2 - "card.tsx"
Cohesion: 0.04
Nodes (79): ActivityPage(), fmtDuration(), dynamic, metadata, AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata (+71 more)

### Community 3 - "regulatory/[id]/page.tsx"
Cohesion: 0.05
Nodes (78): BD_DOC_CATEGORIES, Budget(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, RequestDetailPage(), DOSSIER_DOC_CATEGORIES (+70 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (82): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BDPipeline() (+74 more)

### Community 5 - "getCurrentUser"
Cohesion: 0.05
Nodes (71): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+63 more)

### Community 6 - "badge.tsx"
Cohesion: 0.08
Nodes (57): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, ACTION_COLS, ACTION_LABELS, AdminValidationsPage() (+49 more)

### Community 7 - "hasGlobalView"
Cohesion: 0.06
Nodes (81): EventForm(), CorbeillePage(), DirectiveDetailPage(), RevisionRequest(), createMission(), runAutopilot(), createCalendarEvent(), parseKind() (+73 more)

### Community 8 - "recordAudit"
Cohesion: 0.07
Nodes (73): SuppliesManager(), PayButton(), decideApproval(), updateAiSettings(), createBD(), addBudgetExpense(), canManagePlan(), createDelegatePlan() (+65 more)

### Community 9 - "formatDate"
Cohesion: 0.05
Nodes (71): dynamic, FocusCard(), ApprovalsPage(), AssistantPage(), DemandesPage(), CategoryCard(), ComptaCockpit(), ComptaData (+63 more)

### Community 10 - "Button"
Cohesion: 0.08
Nodes (37): DriveStorageSettings(), PALETTE, Option, RuleDTO, ResearchMeta(), ProjectStatusBadge(), ConnectMailbox(), U (+29 more)

### Community 11 - "aiConfigured"
Cohesion: 0.06
Nodes (61): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+53 more)

### Community 12 - "requireUser"
Cohesion: 0.06
Nodes (64): FieldsManager(), ActiveToggle(), SpaceSettingsButton(), VariationPanel(), updateBDStatus(), addCongressBeneficiary(), asList(), Benef (+56 more)

### Community 13 - "meeting-actions.ts"
Cohesion: 0.06
Nodes (55): dynamic, GET(), EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment (+47 more)

### Community 14 - "lib/audit.ts"
Cohesion: 0.06
Nodes (46): ImpersonateButton(), EventDetail(), RequestThread(), Res, CreateRecordButtonProps, resetActivityTime(), saveAdoptionSettings(), computeStatus() (+38 more)

### Community 15 - "utils.ts"
Cohesion: 0.05
Nodes (47): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+39 more)

### Community 16 - "prisma.ts"
Cohesion: 0.08
Nodes (28): actorFor(), actorFor(), actorFor(), actorFor(), OLD_HASH, actor(), actorFor(), actorFor() (+20 more)

### Community 17 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 18 - "drive-storage.ts"
Cohesion: 0.08
Nodes (38): GET(), dynamic, GET(), POST(), dynamic, POST(), dynamic, GET() (+30 more)

### Community 19 - "admin-request-actions.ts"
Cohesion: 0.07
Nodes (53): RuleControls(), RuleEditor(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+45 more)

### Community 20 - "budget-board.tsx"
Cohesion: 0.08
Nodes (46): GET(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CreateEnvelopeButton() (+38 more)

### Community 21 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (42): AgentItem, AgentsPanel(), RunState, ApproveNameButton(), DocgenPanel(), GenDoc, Template, DeleteDossierButton() (+34 more)

### Community 22 - "messaging-actions.ts"
Cohesion: 0.11
Nodes (43): AddMembers(), cid(), InfoPanel(), Row(), bumpConversation(), Messenger(), fd(), NewConversation() (+35 more)

### Community 23 - "onlyofficeConfigured"
Cohesion: 0.12
Nodes (36): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+28 more)

### Community 24 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 25 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (34): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+26 more)

### Community 26 - "anyRoleFilter"
Cohesion: 0.12
Nodes (37): AffectationsPage(), dynamic, CataloguePage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage() (+29 more)

### Community 27 - "dossier-actions.ts"
Cohesion: 0.10
Nodes (37): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+29 more)

### Community 28 - "agent-core.ts"
Cohesion: 0.09
Nodes (28): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+20 more)

### Community 29 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (34): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+26 more)

### Community 30 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 31 - "bd-strategic-table.tsx"
Cohesion: 0.09
Nodes (36): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+28 more)

### Community 32 - "product-explorer.tsx"
Cohesion: 0.09
Nodes (34): AggNum(), BdProjectDetailPage(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS (+26 more)

### Community 33 - "upload/session.ts"
Cohesion: 0.09
Nodes (33): IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs(), uploadViaSession() (+25 more)

### Community 34 - "dashboard.ts"
Cohesion: 0.12
Nodes (32): GET(), SearchPage(), executeReadTool(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+24 more)

### Community 35 - "assistant.ts"
Cohesion: 0.08
Nodes (37): MedicalDirectory(), callClaude(), activeUserId(), AssistantActionKind, AssistantResult, asStr(), buildContext(), buildProposal() (+29 more)

### Community 36 - "jobs/runner.ts"
Cohesion: 0.12
Nodes (34): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+26 more)

### Community 37 - "document-preview.tsx"
Cohesion: 0.09
Nodes (27): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+19 more)

### Community 38 - "regAudit"
Cohesion: 0.11
Nodes (31): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+23 more)

### Community 39 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL, groupByViewSignature() (+25 more)

### Community 40 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 41 - "rbac.ts"
Cohesion: 0.06
Nodes (30): dynamic, GET(), dynamic, esc(), GET(), EntityRow, dynamic, EntitesPage() (+22 more)

### Community 42 - "message-thread.tsx"
Cohesion: 0.12
Nodes (27): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment (+19 more)

### Community 43 - "rules/engine.ts"
Cohesion: 0.11
Nodes (25): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+17 more)

### Community 44 - "hr-document-actions.ts"
Cohesion: 0.14
Nodes (26): ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), applyAnnualLeaveBalance(), archiveHrRequestIfDone(), daysInclusive() (+18 more)

### Community 45 - "drive/page.tsx"
Cohesion: 0.14
Nodes (27): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, NewFolderButton(), NewOfficeButton() (+19 more)

### Community 46 - "rules/admin-actions.ts"
Cohesion: 0.13
Nodes (24): KIND_LABEL, Pack, Rule, RulePacksAdmin(), handleRules(), canManage(), PackTestReport, Result (+16 more)

### Community 47 - "Select"
Cohesion: 0.07
Nodes (22): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter() (+14 more)

### Community 48 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (27): enrichTenderLine(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine, allowedMfg() (+19 more)

### Community 49 - "auth.ts"
Cohesion: 0.12
Nodes (20): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+12 more)

### Community 50 - "drive-actions.ts"
Cohesion: 0.17
Nodes (25): FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions(), Props (+17 more)

### Community 51 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), createVisit() (+20 more)

### Community 52 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (28): getManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), emitFinancials(), ensureInstance() (+20 more)

### Community 53 - "market-research.ts"
Cohesion: 0.12
Nodes (23): GET(), MarketResearchDetailPage(), PresentationCard(), PresentationPanel(), Res, deletePresentation(), generatePresentation(), MODULE (+15 more)

### Community 54 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 55 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 56 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 57 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (21): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+13 more)

### Community 58 - "manifest.ts"
Cohesion: 0.13
Nodes (21): MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard(), CleanupResult, cleanupRun(), deleteOne() (+13 more)

### Community 59 - "getAppSettings"
Cohesion: 0.16
Nodes (21): dynamic, POST(), dynamic, POST(), dynamic, POST(), DatabasesPage(), askBrain() (+13 more)

### Community 60 - "button.tsx"
Cohesion: 0.09
Nodes (17): RestoreButton(), MessageForm(), set(), StatusActions(), useAction(), MemberMultiSelect(), Mode, SearchBox() (+9 more)

### Community 61 - "extract-facts.ts"
Cohesion: 0.14
Nodes (23): AssignmentMatrix(), key(), nOr0(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput (+15 more)

### Community 62 - "explorer.ts"
Cohesion: 0.17
Nodes (20): ACTIONS, PERMISSIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport (+12 more)

### Community 63 - "build-twin.ts"
Cohesion: 0.13
Nodes (21): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+13 more)

### Community 64 - "build-facts.ts"
Cohesion: 0.14
Nodes (20): sectionByCode(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded() (+12 more)

### Community 65 - "assistant-chat.tsx"
Cohesion: 0.11
Nodes (20): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), MessageBubble(), Msg, nextId() (+12 more)

### Community 66 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (24): BudgetBoard(), CategorySheet(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope() (+16 more)

### Community 67 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 68 - "regulatory-workflow.ts"
Cohesion: 0.13
Nodes (23): setRegulatoryChecklistItem(), setRegulatoryStepState(), isRegChecklistKey(), isRegStepKey(), isRegStepState(), phaseLabel(), PRESUB_ANSWER_STEP, REG_CHECKLIST (+15 more)

### Community 69 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 70 - "mistral-ocr.ts"
Cohesion: 0.17
Nodes (24): backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt(), defaultMaxPages(), lowConfidenceThreshold(), maxAttempts() (+16 more)

### Community 71 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 72 - "field-reports.ts"
Cohesion: 0.12
Nodes (19): dynamic, GET(), dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle (+11 more)

### Community 73 - "access-actions.ts"
Cohesion: 0.17
Nodes (21): GrantOption, RowGrants(), RowGrantsProps, ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm() (+13 more)

### Community 74 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 75 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 76 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 77 - "releaseBlob"
Cohesion: 0.15
Nodes (18): releaseBlob(), sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile(), IngestSummary, isStorable() (+10 more)

### Community 78 - "generate.ts"
Cohesion: 0.16
Nodes (19): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+11 more)

### Community 79 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (17): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+9 more)

### Community 80 - "currentCompanyWhere"
Cohesion: 0.13
Nodes (18): StocksPage(), SnapshotDTO, CompanyLite, companyWhere(), currentCompanyWhere(), LedgerRow, MONTHS_FR, DeclarationDetail (+10 more)

### Community 81 - "getMarketData"
Cohesion: 0.13
Nodes (21): Cache, DIR, DZD_PER_USD, getMarketData(), IqviaRow, LabRow, loadNdjson(), MarketMeta (+13 more)

### Community 82 - "entity-access.ts"
Cohesion: 0.17
Nodes (16): POST(), ActionResult, uploadDocument(), PersistDocInput, persistUploadedDocument(), ENTITY_MODULE, isRequestOwner(), cleanPathSegments() (+8 more)

### Community 83 - "features.ts"
Cohesion: 0.17
Nodes (17): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), dynamic, RootPage() (+9 more)

### Community 84 - "adventum-brain/page.tsx"
Cohesion: 0.16
Nodes (19): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+11 more)

### Community 85 - "(app)/layout.tsx"
Cohesion: 0.14
Nodes (15): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), audio(), desktop(), NotificationChime() (+7 more)

### Community 86 - "regulatory/page.tsx"
Cohesion: 0.16
Nodes (18): DciAssociationField(), EditProductValues, UserOption, NewProductButton(), UserOption, regStage(), RegulatoryPage(), SupplierRow (+10 more)

### Community 87 - "run.ts"
Cohesion: 0.16
Nodes (15): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), runSimulationAction(), AiFn, dossierSummary() (+7 more)

### Community 88 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 89 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 90 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 91 - "users/[id]/page.tsx"
Cohesion: 0.13
Nodes (18): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AccessMatrix() (+10 more)

### Community 92 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 93 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 94 - "assistant-actions.ts"
Cohesion: 0.27
Nodes (18): assistantChat(), forgetMyAssistantMemory(), maybeDistillMemory(), myAssistantThread(), appendExchange(), countMessages(), createThread(), deleteThread() (+10 more)

### Community 95 - "departments.ts"
Cohesion: 0.17
Nodes (18): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentOptions() (+10 more)

### Community 96 - "scheduled.ts"
Cohesion: 0.17
Nodes (13): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiHealthRun, performAiHealthCheck(), pruneStaleUploadSessions(), accrueMonthlyLeave() (+5 more)

### Community 97 - "admin-delete-actions.ts"
Cohesion: 0.18
Nodes (17): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+9 more)

### Community 98 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 99 - "workflow.ts"
Cohesion: 0.15
Nodes (18): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), WorkflowActionView, WorkflowEventView, WorkflowOutcome (+10 more)

### Community 100 - "medical-directory.tsx"
Cohesion: 0.14
Nodes (17): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, DelegatePlanDTO (+9 more)

### Community 101 - "anpp-process.tsx"
Cohesion: 0.14
Nodes (17): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), setRegulatoryStepNote(), INTERNAL_TO_EXTERNAL (+9 more)

### Community 102 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 103 - "lib/drive.ts"
Cohesion: 0.21
Nodes (12): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), canViewDrive(), buildDriveZip(), Collected (+4 more)

### Community 104 - "products.ts"
Cohesion: 0.22
Nodes (15): dynamic, MarketProductsPage(), MarketProductSearchResult, searchMarketProducts(), clean(), getPchProducts(), MarketProduct, MarketSegment (+7 more)

### Community 105 - "field-report-actions.ts"
Cohesion: 0.23
Nodes (16): ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment() (+8 more)

### Community 106 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 107 - "review-agent.ts"
Cohesion: 0.17
Nodes (13): aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding, AiFindingSchema, AiFn, AiOutputSchema, buildPrompt() (+5 more)

### Community 108 - "ocr-engine.ts"
Cohesion: 0.20
Nodes (16): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, createOcrWorker(), LOW_CONFIDENCE (+8 more)

### Community 109 - "[versionId]/route.ts"
Cohesion: 0.23
Nodes (14): GET(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer(), header(), presentationFilename() (+6 more)

### Community 110 - "corpus/actions.ts"
Cohesion: 0.21
Nodes (12): Citation, CorpusAdmin(), Source, Version, canManage(), createCorpusSourceVersion(), Result, searchCorpusAction() (+4 more)

### Community 111 - "adventum-actions.ts"
Cohesion: 0.19
Nodes (13): RelationsTab(), RiskThresholdsForm(), DENIED, searchRelations(), updateRiskThresholds(), getProductRelations(), ProductRelations, RelationBlock (+5 more)

### Community 112 - "drive/[id]/page.tsx"
Cohesion: 0.19
Nodes (11): ConvertPdfButton(), DriveCommentItem, DriveComments(), DriveFilePage(), humanSize(), deleteDriveComment(), CUSTOM_ENTITY_TYPES, CustomValues (+3 more)

### Community 113 - "medical-info-actions.ts"
Cohesion: 0.29
Nodes (15): DeclarationDetailPage(), addMedicalInfoComment(), cancelDocRequest(), canManage(), fulfillDocRequest(), recordAuthorityDeclaration(), refreshStatus(), requestDocument() (+7 more)

### Community 114 - "lib/messaging.ts"
Cohesion: 0.16
Nodes (14): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+6 more)

### Community 115 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 116 - "conversation-list.tsx"
Cohesion: 0.17
Nodes (15): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, Props (+7 more)

### Community 117 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 118 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 119 - "ingest.ts"
Cohesion: 0.21
Nodes (9): canOcr(), IMAGE_EXTS, ocrDocument(), CATEGORIES, categorizeReserve(), decomposeReserveText(), ReservePoint, ingestReserveLetter() (+1 more)

### Community 120 - "mistral-ocr.test.ts"
Cohesion: 0.19
Nodes (9): dynamic, GET(), runtime, mistralOcrConfigured(), mistralOcrSelfTest(), ENV_KEYS, ONE_PAGE, SAMPLE (+1 more)

### Community 121 - "daily-brief.ts"
Cohesion: 0.25
Nodes (11): AssistantPage(), dynamic, TodayPage(), MorningBrief(), refreshMyBrief(), askClaudeCheap(), sttConfigured(), algiersDay() (+3 more)

### Community 122 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 123 - "event-form.tsx"
Cohesion: 0.18
Nodes (11): CreateEventButton(), d10(), EventFields(), Result, ACTIVE, buildStats(), EventDetail, EventListItem (+3 more)

### Community 124 - "regulatory-actions.ts"
Cohesion: 0.25
Nodes (12): StatusEditor(), createRegulatoryProduct(), normalizeDci(), parseProductChannel(), regSupervisorRoles(), setRegulatoryPresubOutcome(), updateRegulatoryProduct(), updateRegulatoryStatus() (+4 more)

### Community 125 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 126 - "validations.ts"
Cohesion: 0.18
Nodes (10): CONG_STAGE, CrossValidationItem, getMyValidationRequests(), getMyValidations(), getSupervisedValidations(), MyValidationItem, MyValidationStep, SPO_STAGE (+2 more)

### Community 127 - "compare-versions.ts"
Cohesion: 0.22
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 128 - "aiModel"
Cohesion: 0.26
Nodes (11): dynamic, GET(), BrainCockpit(), generateBriefing(), aiModel(), askClaude(), analyzeMarketResearch(), buildContext() (+3 more)

### Community 129 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 130 - "topbar.tsx"
Cohesion: 0.24
Nodes (10): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+2 more)

### Community 131 - "sidebar.tsx"
Cohesion: 0.21
Nodes (9): isActive(), MobileTabBar(), PRIMARY, badgeFor(), GROUP_ORDER, Sidebar(), SidebarProps, TopbarProps (+1 more)

### Community 132 - "today.ts"
Cohesion: 0.22
Nodes (10): CalendarEventDTO, greetingFor(), rankToday(), reasonOf(), REASONS, score(), day(), NOW (+2 more)

### Community 133 - "extract-text.ts"
Cohesion: 0.27
Nodes (9): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+1 more)

### Community 134 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 135 - "organigramme/page.tsx"
Cohesion: 0.29
Nodes (8): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage()

### Community 136 - "canAnswerRegRequests"
Cohesion: 0.30
Nodes (11): RegulatoryRequestDetailPage(), RegulatoryRequestsPage(), getRegRequest(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO, regRequestProductOptions() (+3 more)

### Community 137 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 138 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 139 - "heavy-parse.ts"
Cohesion: 0.30
Nodes (8): clampInt(), HeavyKind, heavyText(), parseHeavyInWorker(), parseInline(), resolveWorkerPath(), workerThresholdBytes(), workerTimeoutMs()

### Community 140 - "panels.tsx"
Cohesion: 0.29
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+1 more)

### Community 141 - "reserves/actions.ts"
Cohesion: 0.33
Nodes (8): Cycle, Point, ReservesPanel(), approveReservePoint(), deleteReserveCycle(), guardPoint(), Result, updateReservePoint()

### Community 142 - "regulatory-table.tsx"
Cohesion: 0.18
Nodes (9): CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, RegulatoryRow, STAGES (+1 more)

### Community 143 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 144 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 145 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 146 - "mail-diagnostic/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, POST(), appendToSent(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey() (+1 more)

### Community 147 - "regulatory-corpus/page.tsx"
Cohesion: 0.33
Nodes (7): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), listRulePacks(), activeRuleCount()

### Community 148 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 149 - "hasRole"
Cohesion: 0.27
Nodes (7): CongressIntlDetailPage(), CongressNatDetailPage(), getWorkflowForEntity(), loadOutcome(), hasRole(), canActOnStep(), stepBySlug()

### Community 150 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 151 - "support-flow.test.ts"
Cohesion: 0.33
Nodes (8): SupportDetailPage(), actorFor(), canViewSupport(), getSupportRequest(), getSupportRequests(), isSupportResponder(), SupportDetail, scopeSupport()

### Community 152 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 153 - "typing/route.ts"
Cohesion: 0.28
Nodes (6): dynamic, NO_CONTENT, POST(), ConversationTyping, registry, setTyping()

### Community 154 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 155 - "stocks-view.tsx"
Cohesion: 0.22
Nodes (8): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, TabKey, TABS, todayInput(), UserOpt

### Community 156 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 157 - "mail-actions.ts"
Cohesion: 0.42
Nodes (8): connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), closeMailConnection(), encryptSecret(), getMailAccount(), testImap()

### Community 158 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey(), withAccountLock() (+1 more)

### Community 159 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 160 - "message/route.ts"
Cohesion: 0.32
Nodes (6): dynamic, GET(), dynamic, GET(), friendlyMailError(), MailMessage

### Community 161 - "formatAlgiers"
Cohesion: 0.36
Nodes (7): CalendarView(), colorOf(), MeetingControls(), confirmHrMeeting(), createEventForUser(), formatAlgiers(), formatAlgiersDisplay()

### Community 162 - "queries/admin-requests.ts"
Cohesion: 0.43
Nodes (6): CourseDTO, CoursesPage(), DriverPage(), getDriverMissions(), getMissionAttachments(), REQ_INCLUDE

### Community 163 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 164 - "upload-button.tsx"
Cohesion: 0.32
Nodes (7): CATEGORY_SUGGESTIONS, Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload()

### Community 165 - "openPdf"
Cohesion: 0.32
Nodes (3): openPdf(), PdfSource, pageCountOf()

### Community 166 - "detect-conflicts.ts"
Cohesion: 0.39
Nodes (5): CRITICAL_KEYS, detectConflicts(), normVal(), SINGLE_VALUED, factLabel()

### Community 167 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 168 - "new-request.tsx"
Cohesion: 0.38
Nodes (4): Option, ouiNon, REQUEST_TYPE_FIELDS, REQUEST_TYPES

### Community 169 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 170 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 171 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 172 - "detect-sections.ts"
Cohesion: 0.43
Nodes (5): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords()

### Community 173 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 174 - "admin/corbeille/page.tsx"
Cohesion: 0.47
Nodes (4): CorbeillePage(), dynamic, TrashItem, TrashList()

### Community 175 - "calendar-view.tsx"
Cohesion: 0.33
Nodes (4): MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND

### Community 176 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 177 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 178 - "variation-panel.tsx"
Cohesion: 0.40
Nodes (5): VariationDTO, createVariation(), MANUFACTURING_STATUS, VARIATION_STATUS, VARIATION_TARGETS

### Community 179 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 180 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 181 - "payroll-matrix.tsx"
Cohesion: 0.50
Nodes (4): MONTHS, PayrollCell, PayrollMatrix(), ym()

### Community 182 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 183 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 184 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 185 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 186 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 187 - "request-controls.tsx"
Cohesion: 0.83
Nodes (3): currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 188 - "supplier-view-card.tsx"
Cohesion: 0.50
Nodes (3): Option, SupplierViewCard(), SupplierViewValues

## Knowledge Gaps
- **1010 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1005 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `userCan`, `card.tsx`, `regulatory/[id]/page.tsx`, `lib/labels.ts`, `getCurrentUser`, `badge.tsx`, `hasGlobalView`, `recordAudit`, `formatDate`, `aiConfigured`, `requireUser`, `meeting-actions.ts`, `lib/audit.ts`, `utils.ts`, `drive-storage.ts`, `admin-request-actions.ts`, `budget-board.tsx`, `[dossierId]/page.tsx`, `messaging-actions.ts`, `onlyofficeConfigured`, `promo-material-actions.ts`, `test-center/runner.ts`, `anyRoleFilter`, `dossier-actions.ts`, `agent-core.ts`, `queries/messaging.ts`, `adoption.ts`, `bd-strategic-table.tsx`, `upload/session.ts`, `dashboard.ts`, `assistant.ts`, `jobs/runner.ts`, `regAudit`, `platform-audit/engine.ts`, `rbac.ts`, `hr-document-actions.ts`, `drive/page.tsx`, `rules/admin-actions.ts`, `pch-tender-line-actions.ts`, `auth.ts`, `drive-actions.ts`, `medical-actions.ts`, `workflow/engine.ts`, `market-research.ts`, `mail.ts`, `smart-mail-actions.ts`, `workflow-builder.tsx`, `manifest.ts`, `getAppSettings`, `explorer.ts`, `build-facts.ts`, `budget-envelope-actions.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `field-reports.ts`, `access-actions.ts`, `calendar.ts`, `supplier/actions.ts`, `releaseBlob`, `generate.ts`, `currentCompanyWhere`, `entity-access.ts`, `features.ts`, `adventum-brain/page.tsx`, `(app)/layout.tsx`, `regulatory/page.tsx`, `run.ts`, `onboarding-wizard.tsx`, `risks.ts`, `invariants/registry.ts`, `users/[id]/page.tsx`, `admin-settings-forms.tsx`, `assistant-actions.ts`, `departments.ts`, `scheduled.ts`, `admin-delete-actions.ts`, `workflow.ts`, `medical-directory.tsx`, `auth-actions.ts`, `lib/drive.ts`, `field-report-actions.ts`, `support-actions.ts`, `corpus/actions.ts`, `adventum-actions.ts`, `drive/[id]/page.tsx`, `medical-info-actions.ts`, `lib/messaging.ts`, `pch.ts`, `process-intelligence.ts`, `ingest.ts`, `daily-brief.ts`, `event-form.tsx`, `regulatory-actions.ts`, `department-actions.ts`, `validations.ts`, `compare-versions.ts`, `stock-snapshot-actions.ts`, `push.ts`, `organigramme/page.tsx`, `canAnswerRegRequests`, `hr-documents.ts`, `reserves/actions.ts`, `reminder-actions.ts`, `mail-diagnostic/route.ts`, `regulatory-corpus/page.tsx`, `hasRole`, `meetings/page.tsx`, `support-flow.test.ts`, `bd.ts`, `supplier-auth.ts`, `mail-actions.ts`, `queries/admin-requests.ts`, `detect-conflicts.ts`, `[token]/route.ts`, `admin/corbeille/page.tsx`, `contacts/route.ts`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `userCan`, `card.tsx`, `regulatory/[id]/page.tsx`, `lib/labels.ts`, `aiModel`, `badge.tsx`, `hasGlobalView`, `canAnswerRegRequests`, `recordAudit`, `stock-snapshot-actions.ts`, `getCurrentUser`, `aiConfigured`, `meeting-actions.ts`, `lib/audit.ts`, `reserves/actions.ts`, `reminder-actions.ts`, `drive-storage.ts`, `admin-request-actions.ts`, `messaging-actions.ts`, `onlyofficeConfigured`, `support-flow.test.ts`, `promo-material-actions.ts`, `dossier-actions.ts`, `mail-actions.ts`, `bd-strategic-table.tsx`, `formatAlgiers`, `dashboard.ts`, `document-preview.tsx`, `regAudit`, `hr-document-actions.ts`, `admin/corbeille/page.tsx`, `rules/admin-actions.ts`, `pch-tender-line-actions.ts`, `drive-actions.ts`, `medical-actions.ts`, `variation-panel.tsx`, `market-research.ts`, `smart-mail-actions.ts`, `workflow-builder.tsx`, `manifest.ts`, `getAppSettings`, `assistant-chat.tsx`, `budget-envelope-actions.ts`, `lifecycle/actions.ts`, `regulatory-workflow.ts`, `access-actions.ts`, `supplier/actions.ts`, `entity-access.ts`, `features.ts`, `(app)/layout.tsx`, `regulatory/page.tsx`, `run.ts`, `onboarding-wizard.tsx`, `assistant-actions.ts`, `scheduled.ts`, `admin-delete-actions.ts`, `anpp-process.tsx`, `auth-actions.ts`, `products.ts`, `field-report-actions.ts`, `support-actions.ts`, `corpus/actions.ts`, `adventum-actions.ts`, `drive/[id]/page.tsx`, `medical-info-actions.ts`, `lib/messaging.ts`, `daily-brief.ts`, `regulatory-actions.ts`, `department-actions.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `aiModel`, `lib/session.ts`, `card.tsx`, `regulatory/[id]/page.tsx`, `lib/labels.ts`, `stock-snapshot-actions.ts`, `badge.tsx`, `hasGlobalView`, `recordAudit`, `formatDate`, `canAnswerRegRequests`, `requireUser`, `meeting-actions.ts`, `lib/audit.ts`, `reminder-actions.ts`, `prisma.ts`, `drive-storage.ts`, `mail-diagnostic/route.ts`, `budget-board.tsx`, `hasRole`, `admin-request-actions.ts`, `support-flow.test.ts`, `onlyofficeConfigured`, `typing/route.ts`, `anyRoleFilter`, `dossier-actions.ts`, `messaging-actions.ts`, `queries/messaging.ts`, `adoption.ts`, `bd-strategic-table.tsx`, `product-explorer.tsx`, `formatAlgiers`, `queries/admin-requests.ts`, `assistant.ts`, `dashboard.ts`, `rbac.ts`, `hr-document-actions.ts`, `drive/page.tsx`, `pch-tender-line-actions.ts`, `drive-actions.ts`, `medical-actions.ts`, `market-research.ts`, `getAppSettings`, `assistant-chat.tsx`, `budget-envelope-actions.ts`, `field-reports.ts`, `access-actions.ts`, `calendar.ts`, `currentCompanyWhere`, `entity-access.ts`, `adventum-brain/page.tsx`, `(app)/layout.tsx`, `regulatory/page.tsx`, `assistant-actions.ts`, `scheduled.ts`, `anpp-process.tsx`, `products.ts`, `field-report-actions.ts`, `support-actions.ts`, `[versionId]/route.ts`, `drive/[id]/page.tsx`, `medical-info-actions.ts`, `promo-material-actions.ts`, `regulatory-actions.ts`, `department-actions.ts`, `validations.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1010 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0531734496124031 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.04077134986225895 - nodes in this community are weakly interconnected._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03907577302072715 - nodes in this community are weakly interconnected._