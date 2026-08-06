# Graph Report - src  (2026-08-06)

## Corpus Check
- 910 files · ~635,935 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5559 nodes · 21743 edges · 173 communities (167 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4cc2e301`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- userCan
- card.tsx
- utils.ts
- lib/session.ts
- getCurrentUser
- prisma.ts
- hasGlobalView
- lib/labels.ts
- toNumber
- requireUser
- Button
- corpus-actions.ts
- (app)/layout.tsx
- test-center/runner.ts
- mail.ts
- anpp-process.tsx
- mistral-ocr.ts
- batch-runner.ts
- assistant-actions.ts
- users/[id]/page.tsx
- build-facts.ts
- rules/engine.ts
- budget-forms.tsx
- drive-storage.ts
- care-actions.ts
- formatDate
- meeting-actions.ts
- dossier-chat.ts
- [dossierId]/page.tsx
- FindingInput
- notifyRoles
- jobs/runner.ts
- molecule.ts
- getAppSettings
- agent-core.ts
- regAudit
- onlyofficeConfigured
- pilotage/page.tsx
- library-actions.ts
- assistant.ts
- upload/session.ts
- promo-material-actions.ts
- market-research.ts
- ingest-dossier.ts
- sales-planning-actions.ts
- adoption.ts
- calendar.ts
- dossier-actions.ts
- platform-audit/engine.ts
- rbac.ts
- lib/messaging.ts
- object-storage.ts
- bd-strategic-table.tsx
- ad-pro-item-actions.ts
- library-ingest.ts
- drive/page.tsx
- buildRef
- sponsoring/page.tsx
- message-thread.tsx
- pch-tender-line-actions.ts
- workflow/engine.ts
- Select
- events/[id]/page.tsx
- workflow-builder.tsx
- drive-actions.ts
- medical-info-actions.ts
- queries/messaging.ts
- corpus/actions.ts
- competition.ts
- sectionByCode
- features.ts
- document-preview.tsx
- medical-actions.ts
- explorer.ts
- event-form.tsx
- brain-cockpit.tsx
- molecule-panel.tsx
- form-fields.tsx
- SessionUser
- generate.ts
- auth.ts
- smart-mail-actions.ts
- messenger.tsx
- pch.ts
- lib/ai.ts
- validations.ts
- messaging-actions.ts
- lifecycle/actions.ts
- company.ts
- migration-cert.ts
- supplier/actions.ts
- enregistrement/page.tsx
- departments.ts
- getAccess
- risks.ts
- admin-settings-forms.tsx
- button.tsx
- market-research-actions.ts
- field-report-actions.ts
- getMarketData
- adventum-brain/page.tsx
- upload-manager.tsx
- run.ts
- portfolio.ts
- budget-envelope-actions.ts
- mail-client.tsx
- drive/[id]/page.tsx
- field-reports.ts
- invariants/registry.ts
- queries/documents.ts
- upload-button.tsx
- medical-directory.tsx
- auth-actions.ts
- ocrDocument
- info-panel.tsx
- department-actions.ts
- directive-actions.ts
- drive-space-manager.tsx
- rbac.test.ts
- process-intelligence.ts
- validation-actions.ts
- hr-dossier.tsx
- onboarding-wizard.tsx
- dashboard.ts
- ai/page.tsx
- radar.ts
- compare-versions.ts
- regulatory-drive-mirror.ts
- pch/export/route.ts
- test-center/page.tsx
- new-request.tsx
- stock-snapshot-actions.ts
- supplier-auth.ts
- office-templates.ts
- push.ts
- assistant-files.ts
- hr-documents.ts
- diagnostic/page.tsx
- reminder-actions.ts
- congress-workflow.tsx
- meetings/page.tsx
- stocks-view.tsx
- bd.ts
- org-chart-editor.tsx
- calendar-view.tsx
- mail-actions.ts
- fuzz.ts
- Adventum Autonomous Test Center — architecture
- risk-settings.ts
- client-bundle-guard.test.ts
- scheduled.ts
- courses-board.tsx
- delegate-plans.tsx
- [token]/route.ts
- entities-manager.tsx
- user-admin-forms.tsx
- bv-requests.tsx
- step-timeline.tsx
- employee-form.tsx
- payroll-matrix.tsx
- validation-item-review.tsx
- defaults.ts
- next-auth.d.ts
- directives/[id]/panel.tsx
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 591 edges
2. `userCan()` - 453 edges
3. `fdStr()` - 445 edges
4. `recordAudit()` - 385 edges
5. `prisma` - 375 edges
6. `requireModule()` - 216 edges
7. `hasGlobalView()` - 157 edges
8. `Button` - 152 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Group()` --calls--> `formatDateTime()`  [EXTRACTED]
  src/app/(app)/admin/versions/versions-manager.tsx → src/lib/utils.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (173 total, 6 thin omitted)

### Community 0 - "userCan"
Cohesion: 0.04
Nodes (147): POST(), EntitiesManager(), ActiveToggle(), PresentationCard(), PresentationPanel(), Res, SuppliesManager(), EditEventButton() (+139 more)

### Community 1 - "card.tsx"
Cohesion: 0.05
Nodes (95): MailTester(), CourrierAdminPage(), dynamic, metadata, dynamic, metadata, AdminSuppliersPage(), dynamic (+87 more)

### Community 2 - "utils.ts"
Cohesion: 0.05
Nodes (98): dynamic, TYPES, AdminPage(), fmtBytes(), fmtWhen(), ACTION_COLS, ACTION_LABELS, AggNum() (+90 more)

### Community 3 - "lib/session.ts"
Cohesion: 0.04
Nodes (90): AccessByModulePage(), dynamic, TrashItem, TrashList(), AdminFeedbackPage(), FieldDefDTO, CustomFieldsPage(), OrganigrammePage() (+82 more)

### Community 4 - "getCurrentUser"
Cohesion: 0.04
Nodes (82): dynamic, GET(), dynamic, GET(), DELETE(), dynamic, POST(), dynamic (+74 more)

### Community 5 - "prisma.ts"
Cohesion: 0.04
Nodes (61): dynamic, GET(), dynamic, GET(), dynamic, lastAlertByUser, NO_CONTENT, PermanentDeleteButton() (+53 more)

### Community 6 - "hasGlobalView"
Cohesion: 0.05
Nodes (93): POST(), EventDetail(), EventForm(), CorbeillePage(), CoursesPage(), DriverPage(), RequestActions(), RequesterWindow() (+85 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.04
Nodes (78): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), AuditPanel(), AuditRow, AuditTable() (+70 more)

### Community 8 - "toNumber"
Cohesion: 0.04
Nodes (80): AdminValidationsPage(), dec(), BusinessDevelopmentOpportunitiesPage(), Budget(), RequestDetailPage(), CategoryCard(), ComptaCockpit(), ItemTable() (+72 more)

### Community 9 - "requireUser"
Cohesion: 0.06
Nodes (73): POST(), CorbeillePage(), FieldsManager(), updateBDStatus(), addBdProjectComment(), deleteBdProject(), updateBdProduct(), updateBdRange() (+65 more)

### Community 10 - "Button"
Cohesion: 0.07
Nodes (42): DriveStorageSettings(), Option, RuleDTO, ResearchMeta(), ProjectStatusBadge(), CongressRequestButton(), DoctorOpt, PM_ROLES (+34 more)

### Community 11 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (59): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+51 more)

### Community 12 - "(app)/layout.tsx"
Cohesion: 0.05
Nodes (54): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+46 more)

### Community 13 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (55): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), getTestCenterDashboard(), base, Certification, CertificationInput (+47 more)

### Community 14 - "mail.ts"
Cohesion: 0.05
Nodes (66): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+58 more)

### Community 15 - "anpp-process.tsx"
Cohesion: 0.05
Nodes (60): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), NewProductButton(), regStage() (+52 more)

### Community 16 - "mistral-ocr.ts"
Cohesion: 0.06
Nodes (52): dynamic, GET(), runtime, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require (+44 more)

### Community 17 - "batch-runner.ts"
Cohesion: 0.06
Nodes (54): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+46 more)

### Community 18 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (52): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+44 more)

### Community 19 - "users/[id]/page.tsx"
Cohesion: 0.05
Nodes (47): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, ACTION_FR, dynamic (+39 more)

### Community 20 - "build-facts.ts"
Cohesion: 0.06
Nodes (48): AssignmentMatrix(), key(), nOr0(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn (+40 more)

### Community 21 - "rules/engine.ts"
Cohesion: 0.07
Nodes (46): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+38 more)

### Community 22 - "budget-forms.tsx"
Cohesion: 0.07
Nodes (47): GET(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+39 more)

### Community 23 - "drive-storage.ts"
Cohesion: 0.07
Nodes (41): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic, GET(), dynamic (+33 more)

### Community 24 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 25 - "formatDate"
Cohesion: 0.06
Nodes (42): dynamic, FocusCard(), ApprovalButtons(), ApprovalsPage(), AssistantPage(), ExpenseAckItem, ExpenseAckList(), NewRequestButton() (+34 more)

### Community 26 - "meeting-actions.ts"
Cohesion: 0.07
Nodes (44): InviteResponse(), Resp, ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), ManageBar() (+36 more)

### Community 27 - "dossier-chat.ts"
Cohesion: 0.08
Nodes (43): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, askDossier() (+35 more)

### Community 28 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (45): DocgenPanel(), GenDoc, Template, CostTable(), DossierDetailPage(), dynamic, FindingRow, fmtDateTime() (+37 more)

### Community 29 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 30 - "notifyRoles"
Cohesion: 0.12
Nodes (46): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+38 more)

### Community 31 - "jobs/runner.ts"
Cohesion: 0.09
Nodes (44): reviewDocumentText(), codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS (+36 more)

### Community 32 - "molecule.ts"
Cohesion: 0.11
Nodes (44): MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts() (+36 more)

### Community 33 - "getAppSettings"
Cohesion: 0.09
Nodes (35): dynamic, POST(), POST(), dynamic, GET(), dynamic, POST(), dynamic (+27 more)

### Community 34 - "agent-core.ts"
Cohesion: 0.08
Nodes (30): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc, AgentFinding (+22 more)

### Community 35 - "regAudit"
Cohesion: 0.09
Nodes (36): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+28 more)

### Community 36 - "onlyofficeConfigured"
Cohesion: 0.13
Nodes (35): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+27 more)

### Community 37 - "pilotage/page.tsx"
Cohesion: 0.11
Nodes (38): AffectationsPage(), dynamic, Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft() (+30 more)

### Community 38 - "library-actions.ts"
Cohesion: 0.09
Nodes (38): FindingEvidence(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+30 more)

### Community 39 - "assistant.ts"
Cohesion: 0.07
Nodes (42): dynamic, maxDuration, runtime, MedicalDirectory(), callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind (+34 more)

### Community 40 - "upload/session.ts"
Cohesion: 0.09
Nodes (36): dynamic, runtime, IngestResult, buildMessyDossierZip(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs() (+28 more)

### Community 41 - "promo-material-actions.ts"
Cohesion: 0.20
Nodes (33): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), addPromoComment(), audit(), cancelPromoMaterial() (+25 more)

### Community 42 - "market-research.ts"
Cohesion: 0.10
Nodes (34): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+26 more)

### Community 43 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (36): dynamic, maxDuration, runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile() (+28 more)

### Community 44 - "sales-planning-actions.ts"
Cohesion: 0.09
Nodes (34): BU, CatalogueManager(), CHANNELS, Opt, Prod, dynamic, EquipesPage(), Cap (+26 more)

### Community 45 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 46 - "calendar.ts"
Cohesion: 0.11
Nodes (34): TodayPage(), CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+26 more)

### Community 47 - "dossier-actions.ts"
Cohesion: 0.12
Nodes (33): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+25 more)

### Community 48 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 49 - "rbac.ts"
Cohesion: 0.07
Nodes (32): dynamic, metadata, NoAccessPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage() (+24 more)

### Community 50 - "lib/messaging.ts"
Cohesion: 0.09
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), DOT (+19 more)

### Community 51 - "object-storage.ts"
Cohesion: 0.14
Nodes (32): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+24 more)

### Community 52 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (31): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+23 more)

### Community 53 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (27): AdProItemsPanel(), Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem() (+19 more)

### Community 54 - "library-ingest.ts"
Cohesion: 0.10
Nodes (30): LunaCallInput, rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve (+22 more)

### Community 55 - "drive/page.tsx"
Cohesion: 0.12
Nodes (29): DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite, DriveSpacePage(), dynamic, humanSize() (+21 more)

### Community 56 - "buildRef"
Cohesion: 0.10
Nodes (30): PayButton(), AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS (+22 more)

### Community 57 - "sponsoring/page.tsx"
Cohesion: 0.12
Nodes (25): CongressTable(), CongressInternationalPage(), CongressNationalPage(), SponsoringPage(), SponsoringRow, SponsoringTable(), EVENTS_TABS, SPONSORING_STATUS (+17 more)

### Community 58 - "message-thread.tsx"
Cohesion: 0.12
Nodes (26): MessageAttachments(), Attachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE (+18 more)

### Community 59 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (29): analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+21 more)

### Community 60 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (29): getManagerOfUser(), isManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep() (+21 more)

### Community 61 - "Select"
Cohesion: 0.07
Nodes (23): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ENV_LABEL, MODES, ResumeCleanupButton(), EventFundingPanel() (+15 more)

### Community 62 - "events/[id]/page.tsx"
Cohesion: 0.09
Nodes (25): AdminWorkflowsPage(), dynamic, Props, dynamic, EventDetailPage(), eventValidationSteps(), ThirdPartyInvolveButton(), ValidationStepper() (+17 more)

### Community 63 - "workflow-builder.tsx"
Cohesion: 0.12
Nodes (25): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+17 more)

### Community 64 - "drive-actions.ts"
Cohesion: 0.15
Nodes (25): FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions(), Props (+17 more)

### Community 65 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (26): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+18 more)

### Community 66 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (26): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+18 more)

### Community 67 - "corpus/actions.ts"
Cohesion: 0.12
Nodes (21): Citation, CorpusAdmin(), Source, Version, dynamic, metadata, RegulatoryCorpusPage(), canManage() (+13 more)

### Community 68 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 69 - "sectionByCode"
Cohesion: 0.11
Nodes (24): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+16 more)

### Community 70 - "features.ts"
Cohesion: 0.13
Nodes (22): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+14 more)

### Community 71 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 72 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+20 more)

### Community 73 - "explorer.ts"
Cohesion: 0.15
Nodes (23): ACTIONS, MODULES, PERMISSIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult (+15 more)

### Community 74 - "event-form.tsx"
Cohesion: 0.09
Nodes (22): dynamic, esc(), GET(), CreateEventButton(), d10(), EventFields(), Result, dynamic (+14 more)

### Community 75 - "brain-cockpit.tsx"
Cohesion: 0.10
Nodes (21): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+13 more)

### Community 76 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (21): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+13 more)

### Community 77 - "form-fields.tsx"
Cohesion: 0.13
Nodes (21): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, UserOption, SupplierRow, Field() (+13 more)

### Community 78 - "SessionUser"
Cohesion: 0.16
Nodes (23): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+15 more)

### Community 79 - "generate.ts"
Cohesion: 0.14
Nodes (20): generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate() (+12 more)

### Community 80 - "auth.ts"
Cohesion: 0.13
Nodes (19): NO_CONTENT, POST(), POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut }, clientIp(), DeviceInfo (+11 more)

### Community 81 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 82 - "messenger.tsx"
Cohesion: 0.14
Nodes (24): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+16 more)

### Community 83 - "pch.ts"
Cohesion: 0.12
Nodes (23): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), d10(), LogisticsRow(), Res (+15 more)

### Community 84 - "lib/ai.ts"
Cohesion: 0.10
Nodes (19): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AnthropicBlock, AskOptions, CallOptions, ClaudeContentBlock (+11 more)

### Community 85 - "validations.ts"
Cohesion: 0.10
Nodes (21): RuleControls(), form(), form(), fd(), fd(), getActionCenter(), resolve(), CONG_STAGE (+13 more)

### Community 86 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (21): fd(), MemberMultiSelect(), Mode, NewConversation(), SearchBox(), createChannel(), createDirect(), createGroup() (+13 more)

### Community 87 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 88 - "company.ts"
Cohesion: 0.16
Nodes (19): dynamic, metadata, SourceRow(), SourceWithVersion, AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany() (+11 more)

### Community 89 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 90 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 91 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 92 - "departments.ts"
Cohesion: 0.14
Nodes (20): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+12 more)

### Community 93 - "getAccess"
Cohesion: 0.11
Nodes (17): actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actor() (+9 more)

### Community 94 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), AutopilotPayload, congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 95 - "admin-settings-forms.tsx"
Cohesion: 0.13
Nodes (20): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+12 more)

### Community 96 - "button.tsx"
Cohesion: 0.10
Nodes (16): GrantOption, RowGrants(), RowGrantsProps, RestoreButton(), CFG, Decision, ValidationDecision(), Kind (+8 more)

### Community 97 - "market-research-actions.ts"
Cohesion: 0.16
Nodes (20): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+12 more)

### Community 98 - "field-report-actions.ts"
Cohesion: 0.22
Nodes (17): DoctorPicker(), ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport() (+9 more)

### Community 99 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 100 - "adventum-brain/page.tsx"
Cohesion: 0.17
Nodes (18): AdventumBrainPage(), BLOCK_CATS, dynamic, diff(), getPulse(), hourBucket(), LEVEL_RANK, PulseCounts (+10 more)

### Community 101 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 102 - "run.ts"
Cohesion: 0.15
Nodes (15): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), PROCEDURE_TYPE_LABELS, AiFn, dossierSummary() (+7 more)

### Community 103 - "portfolio.ts"
Cohesion: 0.17
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 104 - "budget-envelope-actions.ts"
Cohesion: 0.21
Nodes (19): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageEnvelope(), NOT_ALLOWED (+11 more)

### Community 105 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 106 - "drive/[id]/page.tsx"
Cohesion: 0.17
Nodes (12): ConvertPdfButton(), DriveCommentItem, DriveComments(), DriveFilePage(), humanSize(), deleteDriveComment(), CUSTOM_ENTITY_TYPES, CustomValues (+4 more)

### Community 107 - "field-reports.ts"
Cohesion: 0.12
Nodes (17): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation (+9 more)

### Community 108 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (12): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+4 more)

### Community 109 - "queries/documents.ts"
Cohesion: 0.24
Nodes (16): GET(), SearchPage(), executeReadTool(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone(), globalSearch() (+8 more)

### Community 110 - "upload-button.tsx"
Cohesion: 0.13
Nodes (15): CATEGORY_SUGGESTIONS, Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, BackgroundUploadProvider(), BgFile (+7 more)

### Community 111 - "medical-directory.tsx"
Cohesion: 0.15
Nodes (16): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, DelegatePlanDTO (+8 more)

### Community 112 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 113 - "ocrDocument"
Cohesion: 0.18
Nodes (12): analyzeEmployeeContract(), CONTRACT_TYPES_UP, analyzeTenderDocument(), line(), canOcr(), ocrDocument(), CATEGORIES, categorizeReserve() (+4 more)

### Community 114 - "info-panel.tsx"
Cohesion: 0.25
Nodes (17): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), leaveConversation() (+9 more)

### Community 115 - "department-actions.ts"
Cohesion: 0.24
Nodes (17): DepartmentsManager(), DeptSheet(), UnassignedPanel(), useRun(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName() (+9 more)

### Community 116 - "directive-actions.ts"
Cohesion: 0.24
Nodes (14): DirectiveDetailPage(), archiveDirective(), canManage(), canParticipate(), createDirective(), DirectiveLike, nextRef(), postDirectiveMessage() (+6 more)

### Community 117 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 118 - "rbac.test.ts"
Cohesion: 0.23
Nodes (13): RegulatoryRequestDetailPage(), RegulatoryRequestsPage(), getRegRequest(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO, regRequestProductOptions() (+5 more)

### Community 119 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 120 - "validation-actions.ts"
Cohesion: 0.19
Nodes (14): RuleEditor(), clearValidationItem(), createValidationRule(), deleteValidationRule(), ITEM_DECISIONS, PRIORITIES, priorityOrNull(), readRuleData() (+6 more)

### Community 121 - "hr-dossier.tsx"
Cohesion: 0.19
Nodes (11): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), REQ_TO_CAT, MeetingControls(), HR_APPROVAL_TYPES, HR_DOCUMENT_STATUSES (+3 more)

### Community 122 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 123 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 124 - "ai/page.tsx"
Cohesion: 0.16
Nodes (10): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+2 more)

### Community 125 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 126 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 127 - "regulatory-drive-mirror.ts"
Cohesion: 0.29
Nodes (10): POST(), cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult (+2 more)

### Community 128 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 129 - "test-center/page.tsx"
Cohesion: 0.18
Nodes (11): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+3 more)

### Community 130 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 131 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 132 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 133 - "office-templates.ts"
Cohesion: 0.22
Nodes (12): blankDocx(), blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f(), MIME (+4 more)

### Community 134 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 135 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 136 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 137 - "diagnostic/page.tsx"
Cohesion: 0.25
Nodes (9): inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage(), dynamic, metadata, scoreColor() (+1 more)

### Community 138 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 139 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 140 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 141 - "stocks-view.tsx"
Cohesion: 0.20
Nodes (9): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, SnapshotDTO, TabKey, TABS, todayInput() (+1 more)

### Community 142 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 143 - "org-chart-editor.tsx"
Cohesion: 0.39
Nodes (6): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), saveOrgPosition()

### Community 144 - "calendar-view.tsx"
Cohesion: 0.28
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND

### Community 145 - "mail-actions.ts"
Cohesion: 0.36
Nodes (8): connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), closeMailConnection(), encryptSecret(), sendMail(), testImap()

### Community 146 - "fuzz.ts"
Cohesion: 0.39
Nodes (8): probeUploads(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing(), SAFE, makeRng()

### Community 147 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 148 - "risk-settings.ts"
Cohesion: 0.36
Nodes (6): RiskThresholdsForm(), updateRiskThresholds(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 149 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 150 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 151 - "courses-board.tsx"
Cohesion: 0.38
Nodes (6): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 152 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 153 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 154 - "entities-manager.tsx"
Cohesion: 0.40
Nodes (4): EntityRow, PALETTE, dynamic, EntitesPage()

### Community 155 - "user-admin-forms.tsx"
Cohesion: 0.33
Nodes (5): ActiveToggle(), Profile, ProfileForm(), ResetPasswordForm(), RevokeAllButton()

### Community 156 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 157 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 158 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 159 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 160 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 161 - "defaults.ts"
Cohesion: 0.40
Nodes (5): DefinitionAdminView, defaultDefinition(), defaultSpine(), CATEGORY_LABELS, WorkflowCategory

### Community 162 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 163 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 164 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1124 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `userCan`, `card.tsx`, `utils.ts`, `lib/session.ts`, `getCurrentUser`, `hasGlobalView`, `lib/labels.ts`, `toNumber`, `requireUser`, `corpus-actions.ts`, `(app)/layout.tsx`, `test-center/runner.ts`, `mail.ts`, `anpp-process.tsx`, `batch-runner.ts`, `assistant-actions.ts`, `users/[id]/page.tsx`, `build-facts.ts`, `rules/engine.ts`, `budget-forms.tsx`, `drive-storage.ts`, `care-actions.ts`, `formatDate`, `meeting-actions.ts`, `dossier-chat.ts`, `[dossierId]/page.tsx`, `notifyRoles`, `jobs/runner.ts`, `getAppSettings`, `agent-core.ts`, `regAudit`, `onlyofficeConfigured`, `pilotage/page.tsx`, `library-actions.ts`, `assistant.ts`, `upload/session.ts`, `promo-material-actions.ts`, `market-research.ts`, `ingest-dossier.ts`, `sales-planning-actions.ts`, `adoption.ts`, `calendar.ts`, `dossier-actions.ts`, `platform-audit/engine.ts`, `rbac.ts`, `lib/messaging.ts`, `bd-strategic-table.tsx`, `ad-pro-item-actions.ts`, `library-ingest.ts`, `drive/page.tsx`, `buildRef`, `sponsoring/page.tsx`, `pch-tender-line-actions.ts`, `workflow/engine.ts`, `Select`, `events/[id]/page.tsx`, `workflow-builder.tsx`, `drive-actions.ts`, `medical-info-actions.ts`, `queries/messaging.ts`, `corpus/actions.ts`, `features.ts`, `medical-actions.ts`, `explorer.ts`, `event-form.tsx`, `brain-cockpit.tsx`, `SessionUser`, `generate.ts`, `auth.ts`, `smart-mail-actions.ts`, `pch.ts`, `lib/ai.ts`, `validations.ts`, `messaging-actions.ts`, `lifecycle/actions.ts`, `company.ts`, `migration-cert.ts`, `supplier/actions.ts`, `departments.ts`, `getAccess`, `risks.ts`, `admin-settings-forms.tsx`, `market-research-actions.ts`, `field-report-actions.ts`, `adventum-brain/page.tsx`, `run.ts`, `portfolio.ts`, `budget-envelope-actions.ts`, `drive/[id]/page.tsx`, `field-reports.ts`, `invariants/registry.ts`, `queries/documents.ts`, `medical-directory.tsx`, `auth-actions.ts`, `ocrDocument`, `department-actions.ts`, `directive-actions.ts`, `drive-space-manager.tsx`, `rbac.test.ts`, `process-intelligence.ts`, `validation-actions.ts`, `dashboard.ts`, `ai/page.tsx`, `compare-versions.ts`, `regulatory-drive-mirror.ts`, `pch/export/route.ts`, `stock-snapshot-actions.ts`, `supplier-auth.ts`, `push.ts`, `hr-documents.ts`, `reminder-actions.ts`, `meetings/page.tsx`, `bd.ts`, `mail-actions.ts`, `risk-settings.ts`, `scheduled.ts`, `[token]/route.ts`, `entities-manager.tsx`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `userCan`, `card.tsx`, `utils.ts`, `lib/session.ts`, `stock-snapshot-actions.ts`, `prisma.ts`, `hasGlobalView`, `lib/labels.ts`, `getCurrentUser`, `reminder-actions.ts`, `corpus-actions.ts`, `(app)/layout.tsx`, `test-center/runner.ts`, `org-chart-editor.tsx`, `anpp-process.tsx`, `mail-actions.ts`, `assistant-actions.ts`, `risk-settings.ts`, `rules/engine.ts`, `budget-forms.tsx`, `care-actions.ts`, `meeting-actions.ts`, `notifyRoles`, `molecule.ts`, `getAppSettings`, `agent-core.ts`, `regAudit`, `onlyofficeConfigured`, `library-actions.ts`, `assistant.ts`, `promo-material-actions.ts`, `sales-planning-actions.ts`, `dossier-actions.ts`, `platform-audit/engine.ts`, `rbac.ts`, `lib/messaging.ts`, `bd-strategic-table.tsx`, `ad-pro-item-actions.ts`, `buildRef`, `pch-tender-line-actions.ts`, `Select`, `workflow-builder.tsx`, `drive-actions.ts`, `medical-info-actions.ts`, `corpus/actions.ts`, `features.ts`, `medical-actions.ts`, `brain-cockpit.tsx`, `SessionUser`, `generate.ts`, `smart-mail-actions.ts`, `messenger.tsx`, `pch.ts`, `lib/ai.ts`, `messaging-actions.ts`, `lifecycle/actions.ts`, `supplier/actions.ts`, `admin-settings-forms.tsx`, `market-research-actions.ts`, `field-report-actions.ts`, `budget-envelope-actions.ts`, `drive/[id]/page.tsx`, `queries/documents.ts`, `auth-actions.ts`, `ocrDocument`, `info-panel.tsx`, `department-actions.ts`, `directive-actions.ts`, `drive-space-manager.tsx`, `rbac.test.ts`, `validation-actions.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `pch/export/route.ts`, `test-center/page.tsx`, `utils.ts`, `card.tsx`, `getCurrentUser`, `prisma.ts`, `hasGlobalView`, `lib/session.ts`, `lib/labels.ts`, `requireUser`, `diagnostic/page.tsx`, `toNumber`, `(app)/layout.tsx`, `reminder-actions.ts`, `anpp-process.tsx`, `assistant-actions.ts`, `users/[id]/page.tsx`, `stock-snapshot-actions.ts`, `budget-forms.tsx`, `drive-storage.ts`, `care-actions.ts`, `formatDate`, `entities-manager.tsx`, `meeting-actions.ts`, `notifyRoles`, `molecule.ts`, `getAppSettings`, `onlyofficeConfigured`, `pilotage/page.tsx`, `assistant.ts`, `promo-material-actions.ts`, `market-research.ts`, `sales-planning-actions.ts`, `adoption.ts`, `calendar.ts`, `dossier-actions.ts`, `rbac.ts`, `lib/messaging.ts`, `bd-strategic-table.tsx`, `ad-pro-item-actions.ts`, `drive/page.tsx`, `buildRef`, `sponsoring/page.tsx`, `pch-tender-line-actions.ts`, `events/[id]/page.tsx`, `drive-actions.ts`, `medical-info-actions.ts`, `queries/messaging.ts`, `medical-actions.ts`, `event-form.tsx`, `SessionUser`, `pch.ts`, `lib/ai.ts`, `validations.ts`, `messaging-actions.ts`, `departments.ts`, `market-research-actions.ts`, `field-report-actions.ts`, `adventum-brain/page.tsx`, `budget-envelope-actions.ts`, `drive/[id]/page.tsx`, `queries/documents.ts`, `ocrDocument`, `department-actions.ts`, `directive-actions.ts`, `rbac.test.ts`, `validation-actions.ts`, `dashboard.ts`, `ai/page.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.0435085276714236 - nodes in this community are weakly interconnected._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04799244213509683 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05390070921985816 - nodes in this community are weakly interconnected._