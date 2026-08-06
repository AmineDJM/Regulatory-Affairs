# Graph Report - src  (2026-08-06)

## Corpus Check
- 888 files · ~610,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5388 nodes · 21055 edges · 159 communities (153 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71a977e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- requireUser
- utils.ts
- lib/labels.ts
- lib/session.ts
- requireModule
- demandes/[id]/page.tsx
- userCan
- workflow/engine.ts
- budget-forms.tsx
- getCompanyScope
- admin-request-actions.ts
- assistant-actions.ts
- mail.ts
- fdStr
- getCurrentUser
- mistral-ocr.ts
- notifyUser
- [dossierId]/page.tsx
- batch-runner.ts
- rules/engine.ts
- lib/ai.ts
- rbac.ts
- drive-storage.ts
- corpus-actions.ts
- test-center/runner.ts
- hasGlobalView
- validations.ts
- meeting-actions.ts
- FindingInput
- prisma.ts
- upload/session.ts
- library-actions.ts
- molecule.ts
- jobs/runner.ts
- onlyofficeConfigured
- promo-material-actions.ts
- assistant.ts
- anyRoleFilter
- aiConfigured
- market-research.ts
- dossier-actions.ts
- medical-directory.tsx
- ingest-dossier.ts
- adoption.ts
- sales-planning-actions.ts
- regCan
- agent-core.ts
- object-storage.ts
- platform-audit/engine.ts
- SessionUser
- (app)/layout.tsx
- build-facts.ts
- entity-access.ts
- formatDateTime
- message-thread.tsx
- anpp-process.tsx
- pch-tender-line-actions.ts
- library-ingest.ts
- users/[id]/page.tsx
- product-explorer.tsx
- drive-actions.ts
- ActionResult
- bd-strategic-table.tsx
- competition.ts
- sectionByCode
- auth.ts
- molecule-panel.tsx
- extract-facts.ts
- storage.ts
- lib/drive.ts
- onboarding-wizard.tsx
- topbar.tsx
- smart-mail-actions.ts
- queries/messaging.ts
- hr-document-actions.ts
- explorer.ts
- brain-cockpit.tsx
- messenger.tsx
- lifecycle/actions.ts
- migration-cert.ts
- enregistrement/page.tsx
- extract-text.ts
- features.ts
- adventum-brain/page.tsx
- calendar.ts
- congress.ts
- getMarketData
- intelligence/audit.ts
- invariants/registry.ts
- today.ts
- run.ts
- departments.ts
- risks.ts
- admin-settings-forms.tsx
- drive/page.tsx
- medical-info-actions.ts
- upload-manager.tsx
- mail-client.tsx
- currentCompanyWhere
- adventum-actions.ts
- field-report-actions.ts
- department-actions.ts
- lib/messaging.ts
- drive-space-manager.tsx
- pch.ts
- supplier/actions.ts
- regulatory/page.tsx
- events.ts
- office-templates.ts
- tender-lines.tsx
- process-intelligence.ts
- corpus/actions.ts
- calendar-view.tsx
- pipeline.upload.e2e.test.ts
- messaging/messages/route.ts
- radar.ts
- v
- compare-versions.ts
- pch/export/route.ts
- medical.ts
- regulatory-table.tsx
- stock-snapshot-actions.ts
- supplier-auth.ts
- hr-documents.ts
- push.ts
- queries/admin-requests.ts
- background-upload.tsx
- reminder-actions.ts
- regulatory-drive-mirror.ts
- regulatory-corpus/page.tsx
- meetings/page.tsx
- agents/actions.ts
- formatAlgiers
- fuzz.ts
- differential.ts
- Adventum Autonomous Test Center — architecture
- fields/page.tsx
- custom-field-actions.ts
- org-chart-editor.tsx
- info-panel.tsx
- client-bundle-guard.test.ts
- promo-material.ts
- scheduled.ts
- forecast-grid.tsx
- push-register.tsx
- draft.ts
- rag.ts
- next-auth.d.ts
- notification-chime.tsx
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 565 edges
2. `userCan()` - 445 edges
3. `fdStr()` - 422 edges
4. `recordAudit()` - 377 edges
5. `prisma` - 368 edges
6. `requireModule()` - 216 edges
7. `Button` - 149 edges
8. `hasGlobalView()` - 147 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `RuleControls()` --indirect_call--> `v()`  [INFERRED]
  src/app/(app)/admin/validations/rules-admin.tsx → src/lib/regulatory/manufacturing-stage.test.ts

## Import Cycles
- None detected.

## Communities (159 total, 6 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.03
Nodes (124): PALETTE, RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, Option, RuleDTO, Action (+116 more)

### Community 1 - "requireUser"
Cohesion: 0.04
Nodes (125): CorbeillePage(), EntitiesManager(), ActiveToggle(), PresentationCard(), PresentationPanel(), Res, ConnectMailbox(), EditVisitSheet() (+117 more)

### Community 2 - "utils.ts"
Cohesion: 0.06
Nodes (86): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic (+78 more)

### Community 3 - "lib/labels.ts"
Cohesion: 0.03
Nodes (104): BudgetRow, BudgetsTable(), MONTHS, BDPipeline(), STAGES, BDRow, BDTable(), CongressRequestButton() (+96 more)

### Community 4 - "lib/session.ts"
Cohesion: 0.04
Nodes (90): ActivityPage(), fmtDuration(), dynamic, metadata, MailTester(), dynamic, metadata, inline() (+82 more)

### Community 5 - "requireModule"
Cohesion: 0.05
Nodes (102): OrganigrammePage(), AdminValidationsPage(), dec(), FocusCard(), BudgetContextBar(), CategoryCard(), BudgetSettings(), BudgetTotalInfo (+94 more)

### Community 6 - "demandes/[id]/page.tsx"
Cohesion: 0.03
Nodes (84): BeneficiariesCard(), Beneficiary, Mode, Refs, Budget(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), ApprovalButtons() (+76 more)

### Community 7 - "userCan"
Cohesion: 0.06
Nodes (81): POST(), EditEventButton(), RegistrationsManager(), EditTransactionSheet(), PayButton(), CancelButton(), CancelButton(), createBD() (+73 more)

### Community 8 - "workflow/engine.ts"
Cohesion: 0.05
Nodes (79): AdminWorkflowsPage(), dynamic, blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), CongressIntlDetailPage(), CongressNatDetailPage() (+71 more)

### Community 9 - "budget-forms.tsx"
Cohesion: 0.06
Nodes (71): GET(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+63 more)

### Community 10 - "getCompanyScope"
Cohesion: 0.05
Nodes (59): dynamic, GET(), INLINE_MIME, runtime, GET(), dynamic, maxDuration, POST() (+51 more)

### Community 11 - "admin-request-actions.ts"
Cohesion: 0.06
Nodes (69): RuleControls(), RuleEditor(), RequestActions(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields() (+61 more)

### Community 12 - "assistant-actions.ts"
Cohesion: 0.06
Nodes (60): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+52 more)

### Community 13 - "mail.ts"
Cohesion: 0.05
Nodes (67): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+59 more)

### Community 14 - "fdStr"
Cohesion: 0.07
Nodes (66): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, InfoPanel(), Messenger() (+58 more)

### Community 15 - "getCurrentUser"
Cohesion: 0.06
Nodes (56): dynamic, POST(), POST(), dynamic, GET(), dynamic, POST(), dynamic (+48 more)

### Community 16 - "mistral-ocr.ts"
Cohesion: 0.06
Nodes (54): dynamic, GET(), runtime, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require (+46 more)

### Community 17 - "notifyUser"
Cohesion: 0.06
Nodes (58): set(), DriveCommentItem, DriveComments(), SubmitButton(), RevisionRequest(), RequestThread(), Res, runAutopilot() (+50 more)

### Community 18 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (55): ApproveNameButton(), DossierChatPanel(), Msg, SUGGESTIONS, DocgenPanel(), GenDoc, Template, DeleteDossierButton() (+47 more)

### Community 19 - "batch-runner.ts"
Cohesion: 0.06
Nodes (56): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+48 more)

### Community 20 - "rules/engine.ts"
Cohesion: 0.07
Nodes (48): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+40 more)

### Community 21 - "lib/ai.ts"
Cohesion: 0.05
Nodes (45): dynamic, GET(), AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), runAiHealthCheckNow() (+37 more)

### Community 22 - "rbac.ts"
Cohesion: 0.05
Nodes (48): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AdminUserPage() (+40 more)

### Community 23 - "drive-storage.ts"
Cohesion: 0.08
Nodes (38): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+30 more)

### Community 24 - "corpus-actions.ts"
Cohesion: 0.08
Nodes (46): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+38 more)

### Community 25 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (43): fmt(), pct(), TestCenterPage(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), getTestCenterDashboard() (+35 more)

### Community 26 - "hasGlobalView"
Cohesion: 0.09
Nodes (49): CorbeillePage(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision() (+41 more)

### Community 27 - "validations.ts"
Cohesion: 0.06
Nodes (40): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+32 more)

### Community 28 - "meeting-actions.ts"
Cohesion: 0.07
Nodes (46): InviteResponse(), Resp, ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), ManageBar() (+38 more)

### Community 29 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 30 - "prisma.ts"
Cohesion: 0.06
Nodes (26): dynamic, GET(), dynamic, esc(), GET(), dynamic, GET(), dynamic (+18 more)

### Community 31 - "upload/session.ts"
Cohesion: 0.08
Nodes (41): dynamic, POST(), runtime, dynamic, maxDuration, POST(), runtime, DELETE() (+33 more)

### Community 32 - "library-actions.ts"
Cohesion: 0.08
Nodes (40): FindingEvidence(), dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar (+32 more)

### Community 33 - "molecule.ts"
Cohesion: 0.11
Nodes (43): dynamic, MarketProductsPage(), SuggestField(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts() (+35 more)

### Community 34 - "jobs/runner.ts"
Cohesion: 0.09
Nodes (42): reviewDocumentText(), codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS (+34 more)

### Community 35 - "onlyofficeConfigured"
Cohesion: 0.12
Nodes (36): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+28 more)

### Community 36 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (37): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), addPromoComment(), audit(), cancelPromoMaterial() (+29 more)

### Community 37 - "assistant.ts"
Cohesion: 0.09
Nodes (43): activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool(), findDoctor() (+35 more)

### Community 38 - "anyRoleFilter"
Cohesion: 0.12
Nodes (37): AffectationsPage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage(), dynamic, ParametresPage() (+29 more)

### Community 39 - "aiConfigured"
Cohesion: 0.10
Nodes (37): aiConfigured(), AiTextResult, askDossier(), buildOverview(), buildPrompt(), ChatTurn, cleanAnswer(), DossierChatResult (+29 more)

### Community 40 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 41 - "dossier-actions.ts"
Cohesion: 0.11
Nodes (36): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+28 more)

### Community 42 - "medical-directory.tsx"
Cohesion: 0.10
Nodes (38): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), MedicalDirectory(), Result, SECTOR_ICON, SECTOR_ORDER, SpecialtiesManager() (+30 more)

### Community 43 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (36): dynamic, maxDuration, POST(), runtime, clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile() (+28 more)

### Community 44 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 45 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 46 - "regCan"
Cohesion: 0.12
Nodes (32): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+24 more)

### Community 47 - "agent-core.ts"
Cohesion: 0.10
Nodes (24): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+16 more)

### Community 48 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 49 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (31): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+23 more)

### Community 50 - "SessionUser"
Cohesion: 0.10
Nodes (25): DirectiveDetailPage(), SupportDetailPage(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+17 more)

### Community 51 - "(app)/layout.tsx"
Cohesion: 0.09
Nodes (24): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+16 more)

### Community 52 - "build-facts.ts"
Cohesion: 0.10
Nodes (26): TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded() (+18 more)

### Community 53 - "entity-access.ts"
Cohesion: 0.14
Nodes (29): GET(), SearchPage(), isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+21 more)

### Community 54 - "formatDateTime"
Cohesion: 0.08
Nodes (25): ActivityRow, ActivityTable(), TYPE, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AuditPanel() (+17 more)

### Community 55 - "message-thread.tsx"
Cohesion: 0.12
Nodes (27): MessageAttachments(), Attachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE (+19 more)

### Community 56 - "anpp-process.tsx"
Cohesion: 0.12
Nodes (30): RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryStepNote(), isRegChecklistKey(), isRegStepKey(), phaseLabel(), PRESUB_ANSWER_STEP (+22 more)

### Community 57 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (30): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+22 more)

### Community 58 - "library-ingest.ts"
Cohesion: 0.10
Nodes (29): rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+21 more)

### Community 59 - "users/[id]/page.tsx"
Cohesion: 0.13
Nodes (28): AccessMatrix(), ModuleAccessRow, ACTION_FR, ROW_SCOPED, GrantOption, RowGrants(), RowGrantsProps, deviceIcon() (+20 more)

### Community 60 - "product-explorer.tsx"
Cohesion: 0.10
Nodes (26): AggNum(), BdProjectDetailPage(), fmtDzd(), fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone() (+18 more)

### Community 61 - "drive-actions.ts"
Cohesion: 0.16
Nodes (26): POST(), FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions() (+18 more)

### Community 62 - "ActionResult"
Cohesion: 0.12
Nodes (23): ImpersonateButton(), SupportActions(), SupportMessageForm(), useAction(), CreateRecordButtonProps, updateAiSettings(), startImpersonation(), stopImpersonation() (+15 more)

### Community 63 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 64 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 65 - "sectionByCode"
Cohesion: 0.11
Nodes (24): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+16 more)

### Community 66 - "auth.ts"
Cohesion: 0.12
Nodes (20): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+12 more)

### Community 67 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 68 - "extract-facts.ts"
Cohesion: 0.12
Nodes (25): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, CTX, DocFactHit (+17 more)

### Community 69 - "storage.ts"
Cohesion: 0.13
Nodes (21): GET(), PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind() (+13 more)

### Community 70 - "lib/drive.ts"
Cohesion: 0.15
Nodes (24): DocumentsPage(), DriveSpacePage(), humanSize(), DriveFilePage(), humanSize(), DrivePage(), humanSize(), DriveAccessLevel (+16 more)

### Community 71 - "onboarding-wizard.tsx"
Cohesion: 0.10
Nodes (20): dynamic, metadata, NoAccessPage(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER (+12 more)

### Community 72 - "topbar.tsx"
Cohesion: 0.10
Nodes (20): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, Company, CompanySwitcher(), getCtx() (+12 more)

### Community 73 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 74 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (23): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+15 more)

### Community 75 - "hr-document-actions.ts"
Cohesion: 0.17
Nodes (23): HrDossier(), REQ_TO_CAT, RequestRow(), applyAnnualLeaveBalance(), archiveHrRequestIfDone(), daysInclusive(), decideExpenseReport(), decideHrLeave() (+15 more)

### Community 76 - "explorer.ts"
Cohesion: 0.17
Nodes (21): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport (+13 more)

### Community 77 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (19): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+11 more)

### Community 78 - "messenger.tsx"
Cohesion: 0.13
Nodes (18): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), bumpConversation(), Props, MyStatus() (+10 more)

### Community 79 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 80 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 81 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 82 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 83 - "features.ts"
Cohesion: 0.15
Nodes (18): dynamic, metadata, VersionsPage(), VersionsManager(), dynamic, dynamic, RootPage(), MorningBrief() (+10 more)

### Community 84 - "adventum-brain/page.tsx"
Cohesion: 0.15
Nodes (20): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+12 more)

### Community 85 - "calendar.ts"
Cohesion: 0.19
Nodes (20): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+12 more)

### Community 86 - "congress.ts"
Cohesion: 0.16
Nodes (20): CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), addMedicalInfoComment(), CongressDetail, CongressListRow, CongressType, dec() (+12 more)

### Community 87 - "getMarketData"
Cohesion: 0.13
Nodes (21): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+13 more)

### Community 88 - "intelligence/audit.ts"
Cohesion: 0.17
Nodes (17): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+9 more)

### Community 89 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 90 - "today.ts"
Cohesion: 0.16
Nodes (18): TodayPage(), CalendarEventDTO, algiersTodayYmd(), algiersDay(), BriefResult, getDailyBrief(), getActionCenter(), resolve() (+10 more)

### Community 91 - "run.ts"
Cohesion: 0.16
Nodes (15): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), runSimulationAction(), AiFn, dossierSummary() (+7 more)

### Community 92 - "departments.ts"
Cohesion: 0.15
Nodes (18): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+10 more)

### Community 93 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 94 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 95 - "drive/page.tsx"
Cohesion: 0.15
Nodes (17): DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite, dynamic, KIND_ICON, NewFolderButton() (+9 more)

### Community 96 - "medical-info-actions.ts"
Cohesion: 0.24
Nodes (18): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+10 more)

### Community 97 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 98 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 99 - "currentCompanyWhere"
Cohesion: 0.14
Nodes (16): StocksPage(), SnapshotDTO, companyWhere(), currentCompanyWhere(), getFinanceData(), LedgerRow, MONTHS_FR, AbsenceRow (+8 more)

### Community 100 - "adventum-actions.ts"
Cohesion: 0.18
Nodes (14): RelationsTab(), RiskThresholdsForm(), DENIED, searchRelations(), updateRiskThresholds(), getProductRelations(), ProductRelations, RelationBlock (+6 more)

### Community 101 - "field-report-actions.ts"
Cohesion: 0.22
Nodes (17): ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment() (+9 more)

### Community 102 - "department-actions.ts"
Cohesion: 0.24
Nodes (17): DepartmentsManager(), DeptSheet(), UnassignedPanel(), useRun(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName() (+9 more)

### Community 103 - "lib/messaging.ts"
Cohesion: 0.18
Nodes (13): dynamic, GET(), DOT, CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect, PRESENCE_LABEL (+5 more)

### Community 104 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 105 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 106 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 107 - "regulatory/page.tsx"
Cohesion: 0.19
Nodes (14): NewProductButton(), regStage(), RegulatoryPage(), RegulatoryRow, RegulatoryTable(), SuppliersManager(), isRegulatorySupervisor(), effectiveStage (+6 more)

### Community 108 - "events.ts"
Cohesion: 0.15
Nodes (15): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+7 more)

### Community 109 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 110 - "tender-lines.tsx"
Cohesion: 0.20
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+6 more)

### Community 111 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 112 - "corpus/actions.ts"
Cohesion: 0.25
Nodes (10): Citation, CorpusAdmin(), Source, Version, canManage(), createCorpusSourceVersion(), Result, seedAnppCorpus() (+2 more)

### Community 113 - "calendar-view.tsx"
Cohesion: 0.18
Nodes (13): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, INVITE_STATUSES (+5 more)

### Community 114 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.21
Nodes (13): runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs(), buildMessyDossierZip() (+5 more)

### Community 115 - "messaging/messages/route.ts"
Cohesion: 0.20
Nodes (10): dynamic, GET(), dynamic, NO_CONTENT, POST(), ConversationTyping, getTyping(), registry (+2 more)

### Community 116 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 117 - "v"
Cohesion: 0.18
Nodes (13): base(), EditGrantedBudget(), FinalDecision(), PreliminaryDecision(), ProductAnalysis(), useRun(), fd(), form() (+5 more)

### Community 118 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 119 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 120 - "medical.ts"
Cohesion: 0.21
Nodes (12): Props, MedicalPage(), DelegatePlanDTO, DoctorDTO, getDelegatePlans(), getMedicalData(), InstitutionDTO, mapDoctor() (+4 more)

### Community 121 - "regulatory-table.tsx"
Cohesion: 0.15
Nodes (10): CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, STAGE_CLASS, STAGE_OPTS (+2 more)

### Community 122 - "stock-snapshot-actions.ts"
Cohesion: 0.23
Nodes (12): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+4 more)

### Community 123 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 124 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 125 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 126 - "queries/admin-requests.ts"
Cohesion: 0.31
Nodes (9): CourseDTO, CoursesPage(), DriverPage(), getAssistantData(), getDriverMissions(), getMissionAttachments(), getRequestList(), REQ_INCLUDE (+1 more)

### Community 127 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 128 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 129 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 130 - "regulatory-corpus/page.tsx"
Cohesion: 0.33
Nodes (7): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), listRulePacks(), activeRuleCount()

### Community 131 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 132 - "agents/actions.ts"
Cohesion: 0.29
Nodes (7): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), applicableAgents()

### Community 133 - "formatAlgiers"
Cohesion: 0.36
Nodes (8): CoursesBoard(), deadlineLabel(), letter(), MeetingControls(), confirmHrMeeting(), proposeHrMeeting(), createEventForUser(), formatAlgiers()

### Community 134 - "fuzz.ts"
Cohesion: 0.39
Nodes (8): probeUploads(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing(), SAFE, makeRng()

### Community 135 - "differential.ts"
Cohesion: 0.25
Nodes (8): BETTER, classify(), Diff, DiffClass, differential(), DifferentialReport, LABEL, Metrics

### Community 136 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 137 - "fields/page.tsx"
Cohesion: 0.29
Nodes (5): FieldDefDTO, CustomFieldsPage(), CUSTOM_ENTITY_TYPES, CustomValues, ENTITY_TYPE_LABELS

### Community 138 - "custom-field-actions.ts"
Cohesion: 0.39
Nodes (7): FieldsManager(), deleteCustomFieldDef(), saveCustomValues(), slug(), upsertCustomFieldDef(), readCustomValues(), writeCustomValues()

### Community 139 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 140 - "info-panel.tsx"
Cohesion: 0.32
Nodes (7): AddMembers(), cid(), Props, Row(), CONV_MEMBER_ROLE, CONV_NOTIFY_LEVEL, ConversationDetailDTO

### Community 141 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 142 - "promo-material.ts"
Cohesion: 0.39
Nodes (7): CompanyLite, getPromoMaterials(), PromoDetail, PromoListItem, promoNames(), resolveNames(), scopePromoMaterial()

### Community 143 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 144 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 145 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 146 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 147 - "rag.ts"
Cohesion: 0.40
Nodes (4): searchCorpusAction(), CorpusFilters, Row, searchCorpus()

### Community 148 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 149 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 150 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1096 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1091 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `button.tsx`, `requireUser`, `utils.ts`, `lib/labels.ts`, `lib/session.ts`, `requireModule`, `demandes/[id]/page.tsx`, `userCan`, `workflow/engine.ts`, `budget-forms.tsx`, `getCompanyScope`, `admin-request-actions.ts`, `assistant-actions.ts`, `mail.ts`, `fdStr`, `getCurrentUser`, `notifyUser`, `[dossierId]/page.tsx`, `batch-runner.ts`, `rules/engine.ts`, `lib/ai.ts`, `rbac.ts`, `drive-storage.ts`, `corpus-actions.ts`, `test-center/runner.ts`, `hasGlobalView`, `validations.ts`, `meeting-actions.ts`, `upload/session.ts`, `library-actions.ts`, `jobs/runner.ts`, `onlyofficeConfigured`, `promo-material-actions.ts`, `assistant.ts`, `anyRoleFilter`, `aiConfigured`, `market-research.ts`, `dossier-actions.ts`, `medical-directory.tsx`, `ingest-dossier.ts`, `adoption.ts`, `sales-planning-actions.ts`, `regCan`, `agent-core.ts`, `platform-audit/engine.ts`, `SessionUser`, `(app)/layout.tsx`, `build-facts.ts`, `entity-access.ts`, `formatDateTime`, `pch-tender-line-actions.ts`, `library-ingest.ts`, `users/[id]/page.tsx`, `product-explorer.tsx`, `drive-actions.ts`, `ActionResult`, `bd-strategic-table.tsx`, `auth.ts`, `storage.ts`, `lib/drive.ts`, `onboarding-wizard.tsx`, `topbar.tsx`, `smart-mail-actions.ts`, `queries/messaging.ts`, `hr-document-actions.ts`, `explorer.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `features.ts`, `adventum-brain/page.tsx`, `calendar.ts`, `congress.ts`, `intelligence/audit.ts`, `invariants/registry.ts`, `today.ts`, `run.ts`, `departments.ts`, `risks.ts`, `admin-settings-forms.tsx`, `drive/page.tsx`, `medical-info-actions.ts`, `currentCompanyWhere`, `adventum-actions.ts`, `field-report-actions.ts`, `department-actions.ts`, `lib/messaging.ts`, `drive-space-manager.tsx`, `pch.ts`, `supplier/actions.ts`, `regulatory/page.tsx`, `events.ts`, `process-intelligence.ts`, `corpus/actions.ts`, `pipeline.upload.e2e.test.ts`, `v`, `compare-versions.ts`, `pch/export/route.ts`, `medical.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `hr-documents.ts`, `push.ts`, `queries/admin-requests.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `regulatory-corpus/page.tsx`, `meetings/page.tsx`, `agents/actions.ts`, `fields/page.tsx`, `custom-field-actions.ts`, `promo-material.ts`, `scheduled.ts`, `rag.ts`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `reminder-actions.ts`, `utils.ts`, `lib/labels.ts`, `lib/session.ts`, `requireModule`, `demandes/[id]/page.tsx`, `userCan`, `formatAlgiers`, `budget-forms.tsx`, `custom-field-actions.ts`, `admin-request-actions.ts`, `assistant-actions.ts`, `workflow/engine.ts`, `fdStr`, `getCurrentUser`, `getCompanyScope`, `notifyUser`, `rag.ts`, `rules/engine.ts`, `lib/ai.ts`, `rbac.ts`, `corpus-actions.ts`, `test-center/runner.ts`, `hasGlobalView`, `validations.ts`, `meeting-actions.ts`, `agents/actions.ts`, `library-actions.ts`, `molecule.ts`, `onlyofficeConfigured`, `promo-material-actions.ts`, `dossier-actions.ts`, `medical-directory.tsx`, `sales-planning-actions.ts`, `regCan`, `platform-audit/engine.ts`, `SessionUser`, `(app)/layout.tsx`, `entity-access.ts`, `formatDateTime`, `anpp-process.tsx`, `pch-tender-line-actions.ts`, `users/[id]/page.tsx`, `drive-actions.ts`, `ActionResult`, `molecule-panel.tsx`, `storage.ts`, `onboarding-wizard.tsx`, `topbar.tsx`, `smart-mail-actions.ts`, `hr-document-actions.ts`, `brain-cockpit.tsx`, `lifecycle/actions.ts`, `features.ts`, `congress.ts`, `run.ts`, `medical-info-actions.ts`, `adventum-actions.ts`, `field-report-actions.ts`, `department-actions.ts`, `lib/messaging.ts`, `drive-space-manager.tsx`, `supplier/actions.ts`, `tender-lines.tsx`, `corpus/actions.ts`, `calendar-view.tsx`, `stock-snapshot-actions.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `button.tsx`, `requireUser`, `utils.ts`, `lib/labels.ts`, `lib/session.ts`, `requireModule`, `demandes/[id]/page.tsx`, `formatAlgiers`, `workflow/engine.ts`, `budget-forms.tsx`, `custom-field-actions.ts`, `admin-request-actions.ts`, `assistant-actions.ts`, `mail.ts`, `fdStr`, `getCurrentUser`, `promo-material.ts`, `notifyUser`, `lib/ai.ts`, `rbac.ts`, `drive-storage.ts`, `test-center/runner.ts`, `hasGlobalView`, `reminder-actions.ts`, `meeting-actions.ts`, `validations.ts`, `prisma.ts`, `molecule.ts`, `onlyofficeConfigured`, `promo-material-actions.ts`, `assistant.ts`, `anyRoleFilter`, `market-research.ts`, `dossier-actions.ts`, `medical-directory.tsx`, `adoption.ts`, `sales-planning-actions.ts`, `SessionUser`, `(app)/layout.tsx`, `entity-access.ts`, `pch-tender-line-actions.ts`, `users/[id]/page.tsx`, `product-explorer.tsx`, `drive-actions.ts`, `ActionResult`, `molecule-panel.tsx`, `lib/drive.ts`, `queries/messaging.ts`, `hr-document-actions.ts`, `adventum-brain/page.tsx`, `calendar.ts`, `congress.ts`, `today.ts`, `departments.ts`, `drive/page.tsx`, `medical-info-actions.ts`, `currentCompanyWhere`, `field-report-actions.ts`, `department-actions.ts`, `lib/messaging.ts`, `regulatory/page.tsx`, `tender-lines.tsx`, `messaging/messages/route.ts`, `pch/export/route.ts`, `medical.ts`, `stock-snapshot-actions.ts`, `queries/admin-requests.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1096 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.030201512613572915 - nodes in this community are weakly interconnected._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.038018319708460556 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.057750759878419454 - nodes in this community are weakly interconnected._