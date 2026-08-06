# Graph Report - src  (2026-08-06)

## Corpus Check
- 894 files · ~616,439 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5427 nodes · 21214 edges · 190 communities (184 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c015323`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- requireModule
- utils.ts
- lib/session.ts
- lib/labels.ts
- userCan
- rbac.ts
- Button
- drive-storage.ts
- requireUser
- regulatory-actions.ts
- getCompanyScope
- admin-request-actions.ts
- promo-material-actions.ts
- upload/session.ts
- prisma.ts
- assistant-actions.ts
- aiConfigured
- FindingInput
- fdStr
- corpus-actions.ts
- [dossierId]/page.tsx
- users/[id]/page.tsx
- medical-directory.tsx
- getCurrentUser
- budget.ts
- marche/page.tsx
- toNumber
- test-center/runner.ts
- pilotage/page.tsx
- mistral-ocr.ts
- formatDate
- notifyUser
- regCan
- library-actions.ts
- assistant.ts
- lib/ai.ts
- onlyoffice.ts
- ingest-dossier.ts
- market-research.ts
- adoption.ts
- agent-core.ts
- messaging-actions.ts
- drive/[id]/page.tsx
- hr-document-actions.ts
- sales-planning-actions.ts
- mail.ts
- build-facts.ts
- jobs/runner.ts
- object-storage.ts
- (app)/layout.tsx
- concurrence/page.tsx
- pch-tender-line-actions.ts
- openai-luna.ts
- lib/drive.ts
- platform-audit/engine.ts
- rules/engine.ts
- product-explorer.tsx
- sectionByCode
- generate.ts
- batch-runner.ts
- auth.ts
- message-thread.tsx
- sponsoring-item-actions.ts
- rules/admin-actions.ts
- Select
- workflow-builder.tsx
- medical-actions.ts
- meetings.ts
- queries/messaging.ts
- bd-strategic-table.tsx
- medical-info-actions.ts
- regulatory-request-actions.ts
- smart-mail-actions.ts
- test-center/page.tsx
- calendar.ts
- button.tsx
- meeting-actions.ts
- workflow/engine.ts
- drive-actions.ts
- migration-cert.ts
- dossiers/[id]/panel.tsx
- messenger.tsx
- lifecycle/actions.ts
- molecule.ts
- explorer.ts
- corpus/actions.ts
- manifest.ts
- brain-cockpit.tsx
- adventum-brain/page.tsx
- budget-forms.tsx
- budget-envelope-actions.ts
- hasGlobalView
- edit-product.tsx
- enregistrement/page.tsx
- extract-text.ts
- dossier-actions.ts
- directive-actions.ts
- stocks-view.tsx
- risks.ts
- ocr-engine.ts
- extract-facts.ts
- onboarding-wizard.tsx
- congress-request-actions.ts
- getMarketData
- library-ingest.ts
- process-intelligence.ts
- market-research-actions.ts
- mail-client.tsx
- upload-manager.tsx
- invariants/registry.ts
- admin-delete-actions.ts
- admin-settings-forms.tsx
- messaging/messages/route.ts
- document-preview.tsx
- topbar.tsx
- getMailAccount
- getAppSettings
- features.ts
- tender-lines.tsx
- run.ts
- support-actions.ts
- departments.ts
- ai/page.tsx
- lib/messaging.ts
- supplier/actions.ts
- pch.ts
- supplier-auth.ts
- mobile-tabbar.tsx
- office-templates.ts
- event-form.tsx
- today.ts
- withImap
- compare-versions.ts
- radar.ts
- department-actions.ts
- pch/export/route.ts
- organigramme/page.tsx
- new-request.tsx
- field-reports.ts
- read-figures.ts
- push.ts
- hr-documents.ts
- supplies-manager.tsx
- background-upload.tsx
- reminder-actions.ts
- congress-beneficiary-actions.ts
- regulatory-drive-mirror.ts
- regulatory-corpus/page.tsx
- calendar-actions.ts
- congress-workflow.tsx
- drive-space-manager.tsx
- meetings/page.tsx
- pipeline.e2e.test.ts
- mail-actions.ts
- WorkflowView
- departments-manager.tsx
- assistant-files.ts
- Adventum Autonomous Test Center — architecture
- custom-field-actions.ts
- zip-viewer.tsx
- validation-item-review.tsx
- bars.tsx
- client-bundle-guard.test.ts
- mime.ts
- scheduled.ts
- risk-settings.ts
- congress-request-form.tsx
- courses-board.tsx
- overview-charts.tsx
- delegate-plans.tsx
- visits-table.tsx
- new-conversation.tsx
- (auth)/login/login-form.tsx
- change-password-form.tsx
- draft.ts
- [token]/route.ts
- bv-requests.tsx
- payroll-matrix.tsx
- next-auth.d.ts
- public-registration-form.tsx
- activity-tracker.tsx
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
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
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

## Communities (190 total, 6 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.05
Nodes (90): BD_DOC_CATEGORIES, BdProjectDetailPage(), BeneficiariesCard(), Beneficiary, Mode, Refs, CONGRESS_DOC_CATEGORIES, CongressDetailView() (+82 more)

### Community 1 - "requireModule"
Cohesion: 0.04
Nodes (105): AdminSuppliersPage(), AdminValidationsPage(), dec(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), Budget(), NewRequestButton(), DirectivesPage() (+97 more)

### Community 2 - "utils.ts"
Cohesion: 0.08
Nodes (66): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic (+58 more)

### Community 3 - "lib/session.ts"
Cohesion: 0.03
Nodes (76): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), CorbeillePage(), dynamic, TrashItem (+68 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (82): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, AuditPanel(), AuditRow (+74 more)

### Community 5 - "userCan"
Cohesion: 0.06
Nodes (93): POST(), POST(), EditTenderButton(), OrdersManager(), useSubmit(), AVATAR_COLORS, createUser(), setSecondaryRole() (+85 more)

### Community 6 - "rbac.ts"
Cohesion: 0.04
Nodes (60): runAutopilot(), assistantNudge(), actorFor(), actorFor(), actorFor(), completeOnboarding(), actorFor(), OLD_HASH (+52 more)

### Community 7 - "Button"
Cohesion: 0.07
Nodes (43): DriveStorageSettings(), EntityRow, PALETTE, Option, RuleDTO, ProjectEditor(), ProjectStatusBadge(), MONTH_LABELS (+35 more)

### Community 8 - "drive-storage.ts"
Cohesion: 0.06
Nodes (45): GET(), dynamic, GET(), dynamic, GET(), dynamic, POST(), dynamic (+37 more)

### Community 9 - "requireUser"
Cohesion: 0.07
Nodes (63): POST(), ActiveToggle(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange(), deleteBdProduct(), deleteBdProject() (+55 more)

### Community 10 - "regulatory-actions.ts"
Cohesion: 0.06
Nodes (60): EditProductButton(), RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), CATEGORY_OPTS, Col, COLS (+52 more)

### Community 11 - "getCompanyScope"
Cohesion: 0.05
Nodes (49): dynamic, GET(), INLINE_MIME, runtime, dynamic, maxDuration, POST(), runtime (+41 more)

### Community 12 - "admin-request-actions.ts"
Cohesion: 0.06
Nodes (59): RuleControls(), RuleEditor(), MissionActions(), letter(), MissionStops(), StopDTO, RequestActions(), RequesterWindow() (+51 more)

### Community 13 - "promo-material-actions.ts"
Cohesion: 0.11
Nodes (51): SelectNav(), fd(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), form() (+43 more)

### Community 14 - "upload/session.ts"
Cohesion: 0.06
Nodes (51): dynamic, maxDuration, POST(), runtime, dynamic, POST(), runtime, dynamic (+43 more)

### Community 15 - "prisma.ts"
Cohesion: 0.09
Nodes (25): dynamic, CreateRecordButtonProps, computeStatus(), nextFinanceRef(), Stage, STAGE_LABEL, STAGES, STATUSES (+17 more)

### Community 16 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (50): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+42 more)

### Community 17 - "aiConfigured"
Cohesion: 0.08
Nodes (47): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+39 more)

### Community 18 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 19 - "fdStr"
Cohesion: 0.06
Nodes (52): EntitiesManager(), PresentationCard(), Res, SpaceSettingsButton(), EditEventButton(), RegistrationsManager(), NewReportButton(), createBD() (+44 more)

### Community 20 - "corpus-actions.ts"
Cohesion: 0.08
Nodes (46): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+38 more)

### Community 21 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (47): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), CostTable(), DossierDetailPage(), dynamic (+39 more)

### Community 22 - "users/[id]/page.tsx"
Cohesion: 0.07
Nodes (45): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AccessMatrix() (+37 more)

### Community 23 - "medical-directory.tsx"
Cohesion: 0.07
Nodes (47): GET(), Props, Result, SECTOR_ICON, SECTOR_ORDER, SearchPage(), executeReadTool(), DOCTOR_TITLE (+39 more)

### Community 24 - "getCurrentUser"
Cohesion: 0.07
Nodes (39): dynamic, GET(), dynamic, POST(), dynamic, esc(), GET(), dynamic (+31 more)

### Community 25 - "budget.ts"
Cohesion: 0.09
Nodes (38): GET(), BudgetContextBar(), CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt, BudgetExpensesPage(), dynamic (+30 more)

### Community 26 - "marche/page.tsx"
Cohesion: 0.07
Nodes (41): AggNum(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone(), scoreTone() (+33 more)

### Community 27 - "toNumber"
Cohesion: 0.07
Nodes (43): CongressTable(), CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), LogisticsDetailPage(), PromoMaterialDetailPage(), promoSteps(), SponsoringPage() (+35 more)

### Community 28 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (36): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), Severity, base, Certification, CertificationInput (+28 more)

### Community 29 - "pilotage/page.tsx"
Cohesion: 0.10
Nodes (41): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+33 more)

### Community 30 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 31 - "formatDate"
Cohesion: 0.06
Nodes (37): dynamic, FocusCard(), dynamic, MarketResearchListPage(), AssistantPage(), DemandesPage(), DirectiveDetailPage(), EventsPage() (+29 more)

### Community 32 - "notifyUser"
Cohesion: 0.10
Nodes (31): runAiHealthCheckNow(), CheckinConfirm(), CheckinPage(), dynamic, submitEventForApproval(), canDoPreliminary(), createSponsoring(), isDirection() (+23 more)

### Community 33 - "regCan"
Cohesion: 0.10
Nodes (36): BudgetForm(), DeferredReviewButton(), Props, Conflict, ConflictRow(), ConflictValue, Fact, FactRow() (+28 more)

### Community 34 - "library-actions.ts"
Cohesion: 0.09
Nodes (37): FindingEvidence(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+29 more)

### Community 35 - "assistant.ts"
Cohesion: 0.08
Nodes (43): executeAssistantAction(), callClaude(), callClaudeStream(), ClaudeContentBlock, ClaudeMessage, ClaudeToolDef, activeUserId(), AssistantActionKind (+35 more)

### Community 36 - "lib/ai.ts"
Cohesion: 0.08
Nodes (37): AssistantPage(), dynamic, TodayPage(), MorningBrief(), refreshMyBrief(), aiModel(), aiSelfTest(), analyzeFieldReport() (+29 more)

### Community 37 - "onlyoffice.ts"
Cohesion: 0.12
Nodes (34): POST(), GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window (+26 more)

### Community 38 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (37): dynamic, maxDuration, POST(), runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip() (+29 more)

### Community 39 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 40 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 41 - "agent-core.ts"
Cohesion: 0.10
Nodes (26): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+18 more)

### Community 42 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (37): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+29 more)

### Community 43 - "drive/[id]/page.tsx"
Cohesion: 0.09
Nodes (30): FieldDefDTO, CustomFieldsPage(), DocumentsPage(), DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite (+22 more)

### Community 44 - "hr-document-actions.ts"
Cohesion: 0.12
Nodes (32): ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), ackExpenseOriginals(), applyAnnualLeaveBalance() (+24 more)

### Community 45 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 46 - "mail.ts"
Cohesion: 0.08
Nodes (37): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, getMessage(), IMAP_IDLE_MS, imapChains (+29 more)

### Community 47 - "build-facts.ts"
Cohesion: 0.10
Nodes (27): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+19 more)

### Community 48 - "jobs/runner.ts"
Cohesion: 0.13
Nodes (33): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+25 more)

### Community 49 - "object-storage.ts"
Cohesion: 0.13
Nodes (32): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+24 more)

### Community 50 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (25): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), audio(), desktop(), NotificationChime() (+17 more)

### Community 51 - "concurrence/page.tsx"
Cohesion: 0.11
Nodes (31): dynamic, fmtDzd(), fmtPct(), MarketCompetitionPage(), Mode, MODES, pctTone(), ClassCompetition (+23 more)

### Community 52 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (30): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+22 more)

### Community 53 - "openai-luna.ts"
Cohesion: 0.11
Nodes (30): BATCH_MULTIPLIER, BatchOutcome, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody(), callLuna() (+22 more)

### Community 54 - "lib/drive.ts"
Cohesion: 0.12
Nodes (25): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), canViewDrive(), DriveAccessLevel, driveBreadcrumb() (+17 more)

### Community 55 - "platform-audit/engine.ts"
Cohesion: 0.12
Nodes (29): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+21 more)

### Community 56 - "rules/engine.ts"
Cohesion: 0.11
Nodes (26): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+18 more)

### Community 57 - "product-explorer.tsx"
Cohesion: 0.13
Nodes (27): dynamic, MarketProductsPage(), fmtDzd(), fmtPct(), fmtPrice(), fmtUsd(), pctTone(), ProductExplorer() (+19 more)

### Community 58 - "sectionByCode"
Cohesion: 0.11
Nodes (26): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+18 more)

### Community 59 - "generate.ts"
Cohesion: 0.11
Nodes (24): DocgenPanel(), GenDoc, Template, generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER (+16 more)

### Community 60 - "batch-runner.ts"
Cohesion: 0.11
Nodes (26): BatchRequest, fetchBatchOutput(), getBatchStatus(), submitBatch(), aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding (+18 more)

### Community 61 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 62 - "message-thread.tsx"
Cohesion: 0.14
Nodes (23): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+15 more)

### Community 63 - "sponsoring-item-actions.ts"
Cohesion: 0.17
Nodes (22): ItemRow, Props, SponsoringItemsPanel(), addSponsoringItem(), audit(), canAllocate(), canEditItems(), DECIDED_STATUSES (+14 more)

### Community 64 - "rules/admin-actions.ts"
Cohesion: 0.13
Nodes (23): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+15 more)

### Community 65 - "Select"
Cohesion: 0.07
Nodes (19): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ENV_LABEL, MODES, EventFundingPanel(), PmOpt (+11 more)

### Community 66 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 67 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), createVisit() (+20 more)

### Community 68 - "meetings.ts"
Cohesion: 0.12
Nodes (22): dynamic, GET(), MeetingChat(), externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage() (+14 more)

### Community 69 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 70 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (24): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+16 more)

### Community 71 - "medical-info-actions.ts"
Cohesion: 0.19
Nodes (23): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+15 more)

### Community 72 - "regulatory-request-actions.ts"
Cohesion: 0.16
Nodes (23): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), RequestThread(), Res, createRegRequest(), loadAccessible() (+15 more)

### Community 73 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 74 - "test-center/page.tsx"
Cohesion: 0.10
Nodes (22): inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage(), dynamic, metadata, scoreColor() (+14 more)

### Community 75 - "calendar.ts"
Cohesion: 0.16
Nodes (24): CalendarView(), colorOf(), CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+16 more)

### Community 76 - "button.tsx"
Cohesion: 0.08
Nodes (19): RestoreButton(), ConvertPdfButton(), ShareItem, SharePanel(), AccessSheet(), MoveTarget, Props, UserLite (+11 more)

### Community 77 - "meeting-actions.ts"
Cohesion: 0.14
Nodes (24): EditMeetingButton(), InviteResponse(), Resp, MeetingMessageItem(), ManageBar(), ProposalActions(), ShareLink(), TranscriptPanel() (+16 more)

### Community 78 - "workflow/engine.ts"
Cohesion: 0.12
Nodes (26): AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), emitFinancials(), entityPath(), EntitySummary (+18 more)

### Community 79 - "drive-actions.ts"
Cohesion: 0.17
Nodes (24): POST(), DriveComments(), FileActions(), ShareRow(), NodeActions(), collectSubtree(), createFolder(), createOfficeNode() (+16 more)

### Community 80 - "migration-cert.ts"
Cohesion: 0.19
Nodes (21): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), infraChecks() (+13 more)

### Community 81 - "dossiers/[id]/panel.tsx"
Cohesion: 0.14
Nodes (19): DossierAssign(), DossierMessageForm(), DossierMessageItem(), MessageAttachments(), MsgAttachment, useAction(), UserLite, DoctorPicker() (+11 more)

### Community 82 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+14 more)

### Community 83 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 84 - "molecule.ts"
Cohesion: 0.18
Nodes (22): MoleculeAnalysisResult, dosageMatches(), extractDosage(), FORM_RULES, GalenicForm, moleculeMatches(), moleculeStem(), SALT_WORDS (+14 more)

### Community 85 - "explorer.ts"
Cohesion: 0.18
Nodes (19): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants() (+11 more)

### Community 86 - "corpus/actions.ts"
Cohesion: 0.14
Nodes (17): Citation, CorpusAdmin(), Source, Version, line(), canManage(), createCorpusSourceVersion(), Result (+9 more)

### Community 87 - "manifest.ts"
Cohesion: 0.14
Nodes (19): ResumeCleanupButton(), resumeTestCleanup(), getTestCenterDashboard(), CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS (+11 more)

### Community 88 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (18): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+10 more)

### Community 89 - "adventum-brain/page.tsx"
Cohesion: 0.14
Nodes (21): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+13 more)

### Community 90 - "budget-forms.tsx"
Cohesion: 0.17
Nodes (22): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CreateEnvelopeButton() (+14 more)

### Community 91 - "budget-envelope-actions.ts"
Cohesion: 0.17
Nodes (23): CategorySheet(), addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope() (+15 more)

### Community 92 - "hasGlobalView"
Cohesion: 0.17
Nodes (20): CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), AD_PRO_BUDGET_MODULES, getWorkflowDefinitions(), getWorkflowForEntity() (+12 more)

### Community 93 - "edit-product.tsx"
Cohesion: 0.13
Nodes (18): OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow, SuppliersManager() (+10 more)

### Community 94 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 95 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 96 - "dossier-actions.ts"
Cohesion: 0.20
Nodes (21): LinkToDossier(), DossierStatusControls(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage(), DossierMembers (+13 more)

### Community 97 - "directive-actions.ts"
Cohesion: 0.18
Nodes (19): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+11 more)

### Community 98 - "stocks-view.tsx"
Cohesion: 0.15
Nodes (21): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, SnapshotDTO, StocksView(), TabKey, TABS (+13 more)

### Community 99 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), AutopilotPayload, congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 100 - "ocr-engine.ts"
Cohesion: 0.15
Nodes (18): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr(), createOcrWorker() (+10 more)

### Community 101 - "extract-facts.ts"
Cohesion: 0.17
Nodes (20): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromDocuments(), extractFactsFromText(), FactHit (+12 more)

### Community 102 - "onboarding-wizard.tsx"
Cohesion: 0.13
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, OnboardingWizard(), ProfileStep() (+7 more)

### Community 103 - "congress-request-actions.ts"
Cohesion: 0.31
Nodes (20): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+12 more)

### Community 104 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 105 - "library-ingest.ts"
Cohesion: 0.17
Nodes (18): buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule(), parseExtraction() (+10 more)

### Community 106 - "process-intelligence.ts"
Cohesion: 0.14
Nodes (19): dynamic, GET(), SPONSORING_STATUS, TASK_STATUS, collectWorkItems(), countMap(), daysSince(), getProcessOverview() (+11 more)

### Community 107 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 108 - "mail-client.tsx"
Cohesion: 0.15
Nodes (18): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+10 more)

### Community 109 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 110 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (13): pred(), InvariantOutcome, Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+5 more)

### Community 111 - "admin-delete-actions.ts"
Cohesion: 0.18
Nodes (17): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+9 more)

### Community 112 - "admin-settings-forms.tsx"
Cohesion: 0.15
Nodes (18): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+10 more)

### Community 113 - "messaging/messages/route.ts"
Cohesion: 0.15
Nodes (14): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+6 more)

### Community 114 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 115 - "topbar.tsx"
Cohesion: 0.15
Nodes (15): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+7 more)

### Community 116 - "getMailAccount"
Cohesion: 0.17
Nodes (14): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+6 more)

### Community 117 - "getAppSettings"
Cohesion: 0.17
Nodes (16): DatabasesPage(), AdminPage(), fmtBytes(), fmtWhen(), AdminSettingsPage(), dynamic, FieldReportsOverviewPage(), dynamic (+8 more)

### Community 118 - "features.ts"
Cohesion: 0.18
Nodes (15): dynamic, metadata, VersionsPage(), VersionsManager(), dynamic, RootPage(), CATALOG, featureEnabled() (+7 more)

### Community 119 - "tender-lines.tsx"
Cohesion: 0.18
Nodes (16): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+8 more)

### Community 120 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 121 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 122 - "departments.ts"
Cohesion: 0.18
Nodes (15): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentSubtreeIds(), getDepartmentUserIds() (+7 more)

### Community 123 - "ai/page.tsx"
Cohesion: 0.15
Nodes (12): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiHealthCheckButton(), AiControlCenterPage(), dynamic (+4 more)

### Community 124 - "lib/messaging.ts"
Cohesion: 0.16
Nodes (14): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+6 more)

### Community 125 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 126 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 127 - "supplier-auth.ts"
Cohesion: 0.18
Nodes (13): SupplierLoginForm(), SupplierLoginPage(), SupplierLogoutButton(), supplierLogin(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier() (+5 more)

### Community 128 - "mobile-tabbar.tsx"
Cohesion: 0.22
Nodes (11): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY, NotificationPopup(), Popup (+3 more)

### Community 129 - "office-templates.ts"
Cohesion: 0.20
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 130 - "event-form.tsx"
Cohesion: 0.17
Nodes (12): CreateEventButton(), d10(), EventFields(), Result, ACTIVE, buildStats(), EventDetail, EventListItem (+4 more)

### Community 131 - "today.ts"
Cohesion: 0.20
Nodes (12): CalendarEventDTO, ActionItem, greetingFor(), rankToday(), reasonOf(), REASONS, score(), day() (+4 more)

### Community 132 - "withImap"
Cohesion: 0.19
Nodes (15): acquirePooled(), appendToSent(), classifyMailError(), decryptSecret(), dropPooled(), evictColdest(), imapBackoff(), imapClient() (+7 more)

### Community 133 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 134 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 135 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 136 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 137 - "organigramme/page.tsx"
Cohesion: 0.27
Nodes (9): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage() (+1 more)

### Community 138 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 139 - "field-reports.ts"
Cohesion: 0.22
Nodes (10): dynamic, FieldReportPage(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem, FieldReportsOverview, getFieldReportDetail(), managesReports() (+2 more)

### Community 140 - "read-figures.ts"
Cohesion: 0.19
Nodes (12): LunaCallInput, rasterizePdf(), buildFigureCall(), FIGURE_KINDS, FIGURE_SCHEMA, FigureKind, FigureObservation, FigureReport (+4 more)

### Community 141 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 142 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 143 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 144 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 145 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 146 - "congress-beneficiary-actions.ts"
Cohesion: 0.42
Nodes (10): addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf(), removeCongressBeneficiary() (+2 more)

### Community 147 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 148 - "regulatory-corpus/page.tsx"
Cohesion: 0.33
Nodes (7): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), listRulePacks(), activeRuleCount()

### Community 149 - "calendar-actions.ts"
Cohesion: 0.36
Nodes (9): EventDetail(), EventForm(), createCalendarEvent(), INVITE_STATUSES, parseKind(), respondToInvite(), updateCalendarEvent(), createEventForUser() (+1 more)

### Community 150 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 151 - "drive-space-manager.tsx"
Cohesion: 0.22
Nodes (6): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt, createDriveSpace(), readIds()

### Community 152 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 153 - "pipeline.e2e.test.ts"
Cohesion: 0.29
Nodes (9): failJob(), runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs() (+1 more)

### Community 154 - "mail-actions.ts"
Cohesion: 0.31
Nodes (8): ConnectMailbox(), MailboxStep(), connectMailbox(), disconnectMailbox(), closeMailConnection(), encryptSecret(), MailAttachment, masterKey()

### Community 155 - "WorkflowView"
Cohesion: 0.25
Nodes (8): Props, BudgetCategoryOption, DefinitionAdminView, WorkflowView, defaultDefinition(), defaultSpine(), CATEGORY_LABELS, WorkflowCategory

### Community 156 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 157 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 158 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 159 - "custom-field-actions.ts"
Cohesion: 0.39
Nodes (7): FieldsManager(), deleteCustomFieldDef(), saveCustomValues(), slug(), upsertCustomFieldDef(), readCustomValues(), writeCustomValues()

### Community 160 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 161 - "validation-item-review.tsx"
Cohesion: 0.32
Nodes (7): Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 162 - "bars.tsx"
Cohesion: 0.32
Nodes (7): BarRow, Bars(), COLOR, Meter(), TEXT, toneOf(), STATUS

### Community 163 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 164 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 165 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 166 - "risk-settings.ts"
Cohesion: 0.38
Nodes (5): RiskThresholdsForm(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 167 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 168 - "courses-board.tsx"
Cohesion: 0.38
Nodes (6): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 169 - "overview-charts.tsx"
Cohesion: 0.29
Nodes (6): HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), NamedCount

### Community 170 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 171 - "visits-table.tsx"
Cohesion: 0.29
Nodes (6): DeleteVisitButton(), EditVisitSheet(), Opt, Result, VisitRow, VisitsTable()

### Community 172 - "new-conversation.tsx"
Cohesion: 0.29
Nodes (3): MemberMultiSelect(), Mode, SearchBox()

### Community 173 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 174 - "change-password-form.tsx"
Cohesion: 0.38
Nodes (4): ChangePasswordForm(), ChangePasswordPage(), metadata, changePassword()

### Community 175 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 176 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 177 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 178 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 179 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 180 - "public-registration-form.tsx"
Cohesion: 0.50
Nodes (4): PublicRegistrationForm(), publicRegister(), takenSeats(), PARTICIPANT_ROLE

### Community 181 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

## Knowledge Gaps
- **1099 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1094 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `requireModule`, `utils.ts`, `lib/session.ts`, `lib/labels.ts`, `userCan`, `rbac.ts`, `drive-storage.ts`, `requireUser`, `regulatory-actions.ts`, `getCompanyScope`, `admin-request-actions.ts`, `promo-material-actions.ts`, `upload/session.ts`, `assistant-actions.ts`, `aiConfigured`, `fdStr`, `corpus-actions.ts`, `[dossierId]/page.tsx`, `users/[id]/page.tsx`, `medical-directory.tsx`, `getCurrentUser`, `budget.ts`, `marche/page.tsx`, `toNumber`, `test-center/runner.ts`, `pilotage/page.tsx`, `formatDate`, `notifyUser`, `regCan`, `library-actions.ts`, `assistant.ts`, `lib/ai.ts`, `onlyoffice.ts`, `ingest-dossier.ts`, `market-research.ts`, `adoption.ts`, `agent-core.ts`, `messaging-actions.ts`, `drive/[id]/page.tsx`, `hr-document-actions.ts`, `sales-planning-actions.ts`, `mail.ts`, `build-facts.ts`, `jobs/runner.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `openai-luna.ts`, `lib/drive.ts`, `platform-audit/engine.ts`, `generate.ts`, `batch-runner.ts`, `auth.ts`, `sponsoring-item-actions.ts`, `rules/admin-actions.ts`, `workflow-builder.tsx`, `medical-actions.ts`, `meetings.ts`, `queries/messaging.ts`, `bd-strategic-table.tsx`, `medical-info-actions.ts`, `regulatory-request-actions.ts`, `smart-mail-actions.ts`, `calendar.ts`, `meeting-actions.ts`, `workflow/engine.ts`, `drive-actions.ts`, `migration-cert.ts`, `lifecycle/actions.ts`, `explorer.ts`, `corpus/actions.ts`, `manifest.ts`, `adventum-brain/page.tsx`, `budget-envelope-actions.ts`, `hasGlobalView`, `dossier-actions.ts`, `directive-actions.ts`, `stocks-view.tsx`, `risks.ts`, `onboarding-wizard.tsx`, `congress-request-actions.ts`, `library-ingest.ts`, `process-intelligence.ts`, `market-research-actions.ts`, `invariants/registry.ts`, `admin-delete-actions.ts`, `admin-settings-forms.tsx`, `getMailAccount`, `features.ts`, `run.ts`, `support-actions.ts`, `departments.ts`, `ai/page.tsx`, `lib/messaging.ts`, `supplier/actions.ts`, `pch.ts`, `supplier-auth.ts`, `event-form.tsx`, `compare-versions.ts`, `department-actions.ts`, `pch/export/route.ts`, `organigramme/page.tsx`, `field-reports.ts`, `push.ts`, `hr-documents.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `regulatory-drive-mirror.ts`, `regulatory-corpus/page.tsx`, `calendar-actions.ts`, `meetings/page.tsx`, `pipeline.e2e.test.ts`, `mail-actions.ts`, `custom-field-actions.ts`, `scheduled.ts`, `risk-settings.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `requireModule`, `utils.ts`, `lib/session.ts`, `userCan`, `rbac.ts`, `regulatory-actions.ts`, `getCompanyScope`, `admin-request-actions.ts`, `promo-material-actions.ts`, `prisma.ts`, `assistant-actions.ts`, `aiConfigured`, `fdStr`, `corpus-actions.ts`, `users/[id]/page.tsx`, `medical-directory.tsx`, `getCurrentUser`, `toNumber`, `test-center/runner.ts`, `formatDate`, `notifyUser`, `regCan`, `library-actions.ts`, `assistant.ts`, `lib/ai.ts`, `onlyoffice.ts`, `messaging-actions.ts`, `hr-document-actions.ts`, `sales-planning-actions.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `product-explorer.tsx`, `generate.ts`, `sponsoring-item-actions.ts`, `rules/admin-actions.ts`, `workflow-builder.tsx`, `medical-actions.ts`, `meetings.ts`, `medical-info-actions.ts`, `regulatory-request-actions.ts`, `smart-mail-actions.ts`, `meeting-actions.ts`, `drive-actions.ts`, `dossiers/[id]/panel.tsx`, `messenger.tsx`, `lifecycle/actions.ts`, `corpus/actions.ts`, `manifest.ts`, `brain-cockpit.tsx`, `budget-envelope-actions.ts`, `dossier-actions.ts`, `directive-actions.ts`, `stocks-view.tsx`, `onboarding-wizard.tsx`, `congress-request-actions.ts`, `market-research-actions.ts`, `mail-client.tsx`, `admin-delete-actions.ts`, `topbar.tsx`, `getAppSettings`, `features.ts`, `tender-lines.tsx`, `run.ts`, `support-actions.ts`, `lib/messaging.ts`, `supplier/actions.ts`, `department-actions.ts`, `organigramme/page.tsx`, `supplies-manager.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `calendar-actions.ts`, `drive-space-manager.tsx`, `mail-actions.ts`, `custom-field-actions.ts`, `validation-item-review.tsx`, `change-password-form.tsx`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `card.tsx`, `requireModule`, `utils.ts`, `lib/session.ts`, `lib/labels.ts`, `rbac.ts`, `department-actions.ts`, `drive-storage.ts`, `pch/export/route.ts`, `requireUser`, `regulatory-actions.ts`, `admin-request-actions.ts`, `promo-material-actions.ts`, `prisma.ts`, `assistant-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `fdStr`, `calendar-actions.ts`, `users/[id]/page.tsx`, `medical-directory.tsx`, `getCurrentUser`, `budget.ts`, `marche/page.tsx`, `toNumber`, `pilotage/page.tsx`, `formatDate`, `notifyUser`, `custom-field-actions.ts`, `assistant.ts`, `onlyoffice.ts`, `market-research.ts`, `adoption.ts`, `messaging-actions.ts`, `drive/[id]/page.tsx`, `hr-document-actions.ts`, `sales-planning-actions.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `lib/drive.ts`, `product-explorer.tsx`, `sponsoring-item-actions.ts`, `medical-actions.ts`, `queries/messaging.ts`, `medical-info-actions.ts`, `regulatory-request-actions.ts`, `test-center/page.tsx`, `calendar.ts`, `meeting-actions.ts`, `drive-actions.ts`, `adventum-brain/page.tsx`, `budget-envelope-actions.ts`, `hasGlobalView`, `dossier-actions.ts`, `directive-actions.ts`, `stocks-view.tsx`, `congress-request-actions.ts`, `process-intelligence.ts`, `market-research-actions.ts`, `messaging/messages/route.ts`, `getAppSettings`, `tender-lines.tsx`, `support-actions.ts`, `ai/page.tsx`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1099 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04651416122004357 - nodes in this community are weakly interconnected._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.0377906976744186 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0813843236409608 - nodes in this community are weakly interconnected._