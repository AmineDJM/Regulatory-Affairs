# Graph Report - src  (2026-08-24)

## Corpus Check
- 1380 files · ~1,143,314 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 8475 nodes · 33337 edges · 237 communities (229 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `79214723`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- page-header.tsx
- userCan
- button.tsx
- recordAudit
- prisma.ts
- requireModule
- lib/labels.ts
- getCurrentUser
- toNumber
- formatDate
- batch-runner.ts
- cn
- promo-material-actions.ts
- brain-cockpit.tsx
- drive-storage.ts
- getAppSettings
- regulatory-actions.ts
- regulatory/page.tsx
- build-facts.ts
- hasGlobalView
- dossier-agent.ts
- mail.ts
- test-center/runner.ts
- assistant.ts
- assistant-actions.ts
- [dossierId]/page.tsx
- object-storage.ts
- notifyUser
- requireUser
- validation-actions.ts
- power-tools.ts
- settings.ts
- directory-grid.ts
- corpus-actions.ts
- users/[id]/page.tsx
- rules/engine.ts
- FindingInput
- jobs/runner.ts
- mon-espace/page.tsx
- lib/session.ts
- regAudit
- payment-request-actions.ts
- fdDate
- ad-pro-item-actions.ts
- care-actions.ts
- budget-forms.tsx
- lib/department-budget.ts
- (app)/layout.tsx
- topbar.tsx
- oauth.ts
- storage.ts
- admin-settings-forms.tsx
- drive/page.tsx
- molecule.ts
- formatCurrency
- entity-access.ts
- lib/ai.ts
- mistral-ocr.ts
- admin-request-actions.ts
- centre-board.tsx
- message-thread.tsx
- (app)/validations/page.tsx
- ocr-engine.ts
- drive-actions.ts
- create-record-button.tsx
- letterhead-manager.tsx
- library-ingest.ts
- ad-pro/page.tsx
- calendar.ts
- mail-register-actions.ts
- OpenAIGptRealtime21Provider
- pilotage/page.tsx
- intelligence/actions.ts
- new-request-picker.tsx
- adoption.ts
- corpus/actions.ts
- aiConfigured
- upload/session.ts
- consulting/[id]/page.tsx
- queries/messaging.ts
- reports.ts
- office-supply-actions.ts
- platform-audit/engine.ts
- exports.ts
- market-research.ts
- training-board.tsx
- graph/provider.ts
- agent-core.ts
- product-explorer.tsx
- classify.ts
- messaging-actions.ts
- workflow/engine.ts
- stock-board.tsx
- what-if.ts
- voice-realtime.ts
- entities.ts
- ranges-manager.tsx
- mail-folder-bar.tsx
- meeting-actions.ts
- pch-tender-line-actions.ts
- scheduled.ts
- petty-cash-actions.ts
- upload-manager.tsx
- src/auth.ts
- replay-viewer.tsx
- workflow-builder.tsx
- bd-strategic-table.tsx
- competition.ts
- microsoft-mail-actions.ts
- legal-actions.ts
- payment-authority.ts
- lib/messaging.ts
- dossier-actions.ts
- recruitment/request-flow.ts
- drive-table.tsx
- smart-mail-actions.ts
- document-preview.tsx
- legal/[id]/page.tsx
- client.ts
- openapi.ts
- lifecycle/actions.ts
- state-machines/explorer.ts
- drive/upload/route.ts
- meetings.ts
- messenger.tsx
- expense-row-actions.tsx
- departments-manager.tsx
- extract-text.ts
- migration-cert.ts
- connection.ts
- molecule-panel.tsx
- medical-info-actions.ts
- enregistrement/page.tsx
- company.ts
- zip-inspector.ts
- sheet-import.ts
- http.ts
- purchase-section.tsx
- progress/query.ts
- portfolio.ts
- department-budget-actions.ts
- general-means.ts
- drive-search.ts
- rag.ts
- mail-client.tsx
- edit-product.tsx
- identity-board.tsx
- lib/drive.ts
- reply.ts
- getMarketData
- ingest.ts
- run.ts
- workspace.tsx
- executive-brief-tools.ts
- receipt-lines.tsx
- product-catalog.ts
- stand-in.ts
- invariants/registry.ts
- document-mirror.ts
- consulting-actions.ts
- departments.ts
- invoice-actions.ts
- support-actions.ts
- errors.ts
- legal/page.tsx
- pch.ts
- MicrosoftGraphMailProvider
- org-chart-print.ts
- doc-request.ts
- regulatory/export/route.ts
- rh/upload/route.ts
- radar.ts
- queries/workflow.ts
- MailProvider
- pch/export/route.ts
- (app)/organigramme/page.tsx
- courriers/page.tsx
- contacts-board.tsx
- apps.ts
- upload-button.tsx
- field-reports/page.tsx
- stock-snapshot-actions.ts
- file-glyph.tsx
- background-upload.tsx
- admin-delete-actions.ts
- push.ts
- api/workflow.ts
- hr-dossier.tsx
- reminder-actions.ts
- regulatory-drive-mirror.ts
- entites/page.tsx
- congress-workflow.tsx
- drive-space-actions.ts
- meetings/page.tsx
- training-panel.tsx
- grouping.ts
- calendar-view.tsx
- supplier-auth.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- workflow-panel.tsx
- new-conversation.tsx
- client-bundle-guard.test.ts
- drive-space-manager.tsx
- (auth)/login/login-form.tsx
- change-password-form.tsx
- stand-in-panel.tsx
- [token]/route.ts
- courses-board.tsx
- bv-requests.tsx
- employee-form.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- mission-stops.tsx
- validation-decision.tsx
- validation-item-review.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 820 edges
2. `userCan()` - 636 edges
3. `fdStr()` - 608 edges
4. `recordAudit()` - 562 edges
5. `prisma` - 520 edges
6. `requireModule()` - 262 edges
7. `hasGlobalView()` - 223 edges
8. `Button` - 200 edges
9. `cn()` - 185 edges
10. `toNumber()` - 185 edges

## Surprising Connections (you probably didn't know these)
- `buildFolderTree()` --indirect_call--> `node()`  [INFERRED]
  src/lib/legal/folders.ts → src/lib/org-chart-print.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (237 total, 8 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.04
Nodes (113): AdProOtherDetailPage(), dynamic, ActivityPage(), fmtDuration(), MailTester(), CourrierAdminPage(), dynamic, metadata (+105 more)

### Community 1 - "page-header.tsx"
Cohesion: 0.05
Nodes (109): dynamic, ModuleSpec, dynamic, TYPES, AdminPage(), fmtBytes(), fmtWhen(), ACTION_COLS (+101 more)

### Community 2 - "userCan"
Cohesion: 0.03
Nodes (141): POST(), POST(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor() (+133 more)

### Community 3 - "button.tsx"
Cohesion: 0.04
Nodes (80): DriveStorageSettings(), PALETTE, OrgBranch(), StoragePanel(), ENV_LABEL, MODES, ResumeCleanupButton(), GrantOption (+72 more)

### Community 4 - "recordAudit"
Cohesion: 0.04
Nodes (119): dynamic, POST(), GET(), PermanentDeleteButton(), PurgeOrphansButton(), FieldsManager(), MailPieces(), AttachToSourceButtons() (+111 more)

### Community 5 - "prisma.ts"
Cohesion: 0.03
Nodes (79): dynamic, dynamic, dynamic, dynamic, dynamic, assistantNudge(), actorFor(), actorFor() (+71 more)

### Community 6 - "requireModule"
Cohesion: 0.03
Nodes (104): GET(), AdProOtherPage(), AdminWorkflowsPage(), dynamic, BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage() (+96 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BudgetRow, BudgetsTable() (+90 more)

### Community 8 - "getCurrentUser"
Cohesion: 0.04
Nodes (95): GET(), GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+87 more)

### Community 9 - "toNumber"
Cohesion: 0.04
Nodes (98): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), DossierMessageItem(), dynamic, EventDetailPage(), eventValidationSteps(), DeclarationDetailPage() (+90 more)

### Community 10 - "formatDate"
Cohesion: 0.03
Nodes (75): ActivityTable(), CorbeillePage(), dynamic, TrashItem, TrashList(), AdminFeedbackPage(), FieldDefDTO, CustomFieldsPage() (+67 more)

### Community 11 - "batch-runner.ts"
Cohesion: 0.04
Nodes (77): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+69 more)

### Community 12 - "cn"
Cohesion: 0.03
Nodes (69): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, AiSettings, AiSettingsForm() (+61 more)

### Community 13 - "promo-material-actions.ts"
Cohesion: 0.08
Nodes (73): PromoCircuitCard(), Props, useRun(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun() (+65 more)

### Community 14 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (70): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+62 more)

### Community 15 - "drive-storage.ts"
Cohesion: 0.06
Nodes (64): GET(), GET(), addFile(), ArchiveAttachment, ArchiveBureau, ensureFolder(), blobChunkBytes(), blobKey() (+56 more)

### Community 16 - "getAppSettings"
Cohesion: 0.06
Nodes (71): POST(), DatabasesPage(), RequestRow(), PayrollMatrix(), ym(), createMission(), analyzeEmployeeContract(), cancelAdvance() (+63 more)

### Community 17 - "regulatory-actions.ts"
Cohesion: 0.05
Nodes (70): RegulatoryProcess(), STATE_OPTS, StepNote(), addRegulatoryComment(), createRegulatoryProduct(), createRegulatorySupplier(), createVariation(), deleteVariation() (+62 more)

### Community 18 - "regulatory/page.tsx"
Cohesion: 0.06
Nodes (59): NewProductButton(), RegulatoryPage(), BusinessDevelopmentPipelinePage(), dynamic, AssignableUser, CATEGORY_OPTS, Col, COLS (+51 more)

### Community 19 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 20 - "hasGlobalView"
Cohesion: 0.08
Nodes (65): GET(), FormationsPage(), EquipesPage(), updateAdProRequest(), computeStatus(), createBudget(), cancelCongressRequest(), CongressType (+57 more)

### Community 21 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (62): Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, A4, BASE_OF, buildSimplePdf(), charWidth() (+54 more)

### Community 22 - "mail.ts"
Cohesion: 0.05
Nodes (67): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+59 more)

### Community 23 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (54): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), getTestCenterDashboard(), base, Certification, CertificationInput (+46 more)

### Community 24 - "assistant.ts"
Cohesion: 0.06
Nodes (67): apiErrorMessage(), callClaude(), ACTION_POLICY, activeUserId(), describeChange(), parseRegFieldValue(), ParseResult, parseSettingValue() (+59 more)

### Community 25 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (59): dynamic, maxDuration, runtime, dynamic, maxDuration, POST(), runtime, ActionState (+51 more)

### Community 26 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (57): AgentItem, AgentsPanel(), RunState, DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime() (+49 more)

### Community 27 - "object-storage.ts"
Cohesion: 0.07
Nodes (64): dynamic, GET(), runtime, RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config() (+56 more)

### Community 28 - "notifyUser"
Cohesion: 0.07
Nodes (65): OtherDecisionPanel(), TrainingBoard(), RespondPanel(), RecruitmentPage(), ItemAskPanel(), audit(), closeAdProOtherRequest(), createAdProOtherRequest() (+57 more)

### Community 29 - "requireUser"
Cohesion: 0.06
Nodes (64): EntitiesManager(), DriveComments(), ShareRow(), ReportEditor(), SimpleReportEditor(), TaskWorkPanel(), canManageCompanies(), createCompany() (+56 more)

### Community 30 - "validation-actions.ts"
Cohesion: 0.06
Nodes (59): RuleControls(), RuleEditor(), AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS (+51 more)

### Community 31 - "power-tools.ts"
Cohesion: 0.05
Nodes (44): ClaudeToolDef, CORPUS_TOOLS, DOCUMENT_DISCOVERY_TOOLS, excerptAround(), Finding, indexDriveNodeText(), NodeText, tokensOf() (+36 more)

### Community 32 - "settings.ts"
Cohesion: 0.05
Nodes (52): dynamic, POST(), dynamic, GET(), dynamic, POST(), dynamic, dynamic (+44 more)

### Community 33 - "directory-grid.ts"
Cohesion: 0.07
Nodes (52): GET(), AddDoctorRow(), GridTable(), SelectCell, TextCell, DOCTOR_TITLE, MEDICAL_SECTOR, SEGMENT_LEVEL (+44 more)

### Community 34 - "corpus-actions.ts"
Cohesion: 0.07
Nodes (54): CorpusPanel(), IngestResults, Src, WatchFindings, LunaCallInput, ANPP_WATCH_PAGES, BINDING, CATALOG (+46 more)

### Community 35 - "users/[id]/page.tsx"
Cohesion: 0.07
Nodes (50): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, AccessMatrix(), ModuleAccessRow, ImpersonateButton() (+42 more)

### Community 36 - "rules/engine.ts"
Cohesion: 0.07
Nodes (48): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+40 more)

### Community 37 - "FindingInput"
Cohesion: 0.09
Nodes (46): probeUploads(), accrualStep(), monthsBetweenYm(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), FlakyReport, runFlakyDetection() (+38 more)

### Community 38 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (56): reviewDocumentText(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES (+48 more)

### Community 39 - "mon-espace/page.tsx"
Cohesion: 0.06
Nodes (49): AdvanceItem, MyAdvances(), MonEspacePage(), TaskDossierPage(), CourseDuration(), mapsUrl(), TaskItem, TaskList() (+41 more)

### Community 40 - "lib/session.ts"
Cohesion: 0.06
Nodes (29): CheckinConfirm(), CheckinPage(), dynamic, isKind(), Target, TARGETS, OPEN(), asUser() (+21 more)

### Community 41 - "regAudit"
Cohesion: 0.08
Nodes (50): Question, Req, STATUS, SupplierPanel(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar (+42 more)

### Community 42 - "payment-request-actions.ts"
Cohesion: 0.09
Nodes (55): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, PaymentRequestPage() (+47 more)

### Community 43 - "fdDate"
Cohesion: 0.07
Nodes (53): ActiveToggle(), updateAiSettings(), createBD(), addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetExpense() (+45 more)

### Community 44 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 45 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 46 - "budget-forms.tsx"
Cohesion: 0.07
Nodes (46): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+38 more)

### Community 47 - "lib/department-budget.ts"
Cohesion: 0.10
Nodes (46): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), DepartmentBudgetsPage() (+38 more)

### Community 48 - "(app)/layout.tsx"
Cohesion: 0.06
Nodes (40): AppLayout(), dynamic, metadata, NoAccessPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata (+32 more)

### Community 49 - "topbar.tsx"
Cohesion: 0.08
Nodes (38): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop() (+30 more)

### Community 50 - "oauth.ts"
Cohesion: 0.09
Nodes (40): dynamic, GET(), logFailure(), Stage, dynamic, GET(), DisconnectButton(), dynamic (+32 more)

### Community 51 - "storage.ts"
Cohesion: 0.10
Nodes (39): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, DriveEditPage(), dynamic (+31 more)

### Community 52 - "admin-settings-forms.tsx"
Cohesion: 0.07
Nodes (42): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+34 more)

### Community 53 - "drive/page.tsx"
Cohesion: 0.10
Nodes (38): DriveCanvas(), ITEMS, NewKind, DriveSearch(), DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage() (+30 more)

### Community 54 - "molecule.ts"
Cohesion: 0.10
Nodes (44): dynamic, metadata, ProductExplorerPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions() (+36 more)

### Community 55 - "formatCurrency"
Cohesion: 0.07
Nodes (36): Budget(), CategoryCard(), ComptaCockpit(), ComptaData, ItemTable(), InvoiceRow, InvoiceTable(), dynamic (+28 more)

### Community 56 - "entity-access.ts"
Cohesion: 0.09
Nodes (41): GET(), SearchPage(), isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData (+33 more)

### Community 57 - "lib/ai.ts"
Cohesion: 0.07
Nodes (35): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock, askClaude(), askClaudeCheap() (+27 more)

### Community 58 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 59 - "admin-request-actions.ts"
Cohesion: 0.08
Nodes (45): EventDetail(), EventForm(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest() (+37 more)

### Community 60 - "centre-board.tsx"
Cohesion: 0.11
Nodes (39): CentreBoard(), CentreMessage, CentreOrder, TONE, CentreDePaiementPage(), dynamic, metadata, decidePayment() (+31 more)

### Community 61 - "message-thread.tsx"
Cohesion: 0.09
Nodes (37): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), DriveRef, Pending, Props, SendPayload (+29 more)

### Community 62 - "(app)/validations/page.tsx"
Cohesion: 0.09
Nodes (38): MyRequestCard(), ValidationsPage(), SupervisionBoard(), ValidationAttachments(), ItemReview(), pill(), VALIDATION_MODE, VALIDATION_STATUS (+30 more)

### Community 63 - "ocr-engine.ts"
Cohesion: 0.09
Nodes (39): LunaImage, anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs() (+31 more)

### Community 64 - "drive-actions.ts"
Cohesion: 0.10
Nodes (38): GET(), MIME_BY_EXT, mimeByName(), mimeOf(), POST(), GET(), FileActions(), ShareItem (+30 more)

### Community 65 - "create-record-button.tsx"
Cohesion: 0.08
Nodes (33): EditMailButton(), Article, Cell, emptyCell(), MultiRequestButton(), Option, NewRequestButton(), Option (+25 more)

### Community 66 - "letterhead-manager.tsx"
Cohesion: 0.10
Nodes (34): TYPES, EditSheet(), IconAction(), KINDS, LetterheadManager(), UploadSheet(), ChoiceTile(), LetterheadChoice() (+26 more)

### Community 67 - "library-ingest.ts"
Cohesion: 0.08
Nodes (33): CaseCard(), canOcr(), ocrDocument(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter (+25 more)

### Community 68 - "ad-pro/page.tsx"
Cohesion: 0.11
Nodes (36): AdProList(), EMPTY, Filters, NewRequestPickerProps, AdProPage(), dynamic, CongressInternationalPage(), CongressNationalPage() (+28 more)

### Community 69 - "calendar.ts"
Cohesion: 0.09
Nodes (33): CalendarPage(), dynamic, EXECUTIVE_READ_TOOLS, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+25 more)

### Community 70 - "mail-register-actions.ts"
Cohesion: 0.09
Nodes (37): ReconcileTable(), editMailEntry(), fdDateTime(), parseDirection(), readFields(), setMailDate(), linkProductToDossier(), unlinkProductFromDossier() (+29 more)

### Community 71 - "OpenAIGptRealtime21Provider"
Cohesion: 0.08
Nodes (19): OpenAIGptRealtime21Provider, ProviderOptions, RealtimeEvent, VoiceCallState, VoiceProviderCallbacks, VoiceRealtimeProvider, VoiceSessionGrant, VoiceToolUi (+11 more)

### Community 72 - "pilotage/page.tsx"
Cohesion: 0.12
Nodes (35): AffectationsPage(), dynamic, Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft() (+27 more)

### Community 73 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 74 - "new-request-picker.tsx"
Cohesion: 0.07
Nodes (26): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton() (+18 more)

### Community 75 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 76 - "corpus/actions.ts"
Cohesion: 0.10
Nodes (30): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CATEGORIES, CorpusImport() (+22 more)

### Community 77 - "aiConfigured"
Cohesion: 0.12
Nodes (31): VersionsPage(), AssistantPage(), dynamic, dynamic, TodayPage(), ChiefOfStaffPage(), dynamic, metadata (+23 more)

### Community 78 - "upload/session.ts"
Cohesion: 0.09
Nodes (35): dynamic, POST(), runtime, DELETE(), dynamic, GET(), runtime, scope() (+27 more)

### Community 79 - "consulting/[id]/page.tsx"
Cohesion: 0.09
Nodes (30): NewRequestPicker(), ConsultingContractPage(), dynamic, ConsultingPage(), SponsoringPage(), SponsoringRow, SponsoringTable(), billingSuffix() (+22 more)

### Community 80 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (32): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+24 more)

### Community 81 - "reports.ts"
Cohesion: 0.10
Nodes (28): FindingsReportButton(), ReserveLetterButton(), useGenerate(), Cycle, Point, RESERVE_TYPES, ReservesPanel(), generateFindingsReportAction() (+20 more)

### Community 82 - "office-supply-actions.ts"
Cohesion: 0.14
Nodes (33): NormalizePanel(), SuppliesManager(), SupplyArticleRow, applyCatalogNormalization(), canManageCatalog(), CatalogRewrite, createSupplyArticle(), DENIED (+25 more)

### Community 83 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 84 - "exports.ts"
Cohesion: 0.09
Nodes (29): clean(), DELIVERABLE_FORMATS, DELIVERABLE_TOOLS, DeliverableFormat, DeliverableSection, DeliverableSpec, docxP(), docxTable() (+21 more)

### Community 85 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 86 - "training-board.tsx"
Cohesion: 0.10
Nodes (29): TrainingParticipantRow, TrainingRow, CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState, ChainStatus, ChainTransition (+21 more)

### Community 87 - "graph/provider.ts"
Cohesion: 0.13
Nodes (27): FOLDER_LABEL, GRAPH_WELL_KNOWN, ORDER, wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw (+19 more)

### Community 88 - "agent-core.ts"
Cohesion: 0.10
Nodes (23): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+15 more)

### Community 89 - "product-explorer.tsx"
Cohesion: 0.09
Nodes (30): AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, AggNum(), fmtDzd(), fmtDzd(), fmtPct() (+22 more)

### Community 90 - "classify.ts"
Cohesion: 0.09
Nodes (28): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+20 more)

### Community 91 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (33): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), deleteMessage() (+25 more)

### Community 92 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (31): isManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep(), countAdProItems() (+23 more)

### Community 93 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 94 - "what-if.ts"
Cohesion: 0.08
Nodes (22): StocksPage(), SnapshotDTO, daysSince(), paymentExecutiveState(), PaymentStateInput, RegStepInput, regulatoryExecutiveState(), RegulatoryStateInput (+14 more)

### Community 95 - "voice-realtime.ts"
Cohesion: 0.10
Nodes (27): dynamic, EVENTS, POST(), runtime, dynamic, POST(), runtime, dynamic (+19 more)

### Community 96 - "entities.ts"
Cohesion: 0.14
Nodes (24): GET, GET, GET, RESERVED, GET, coerce(), DEFAULT_LIMIT, listResult (+16 more)

### Community 97 - "ranges-manager.tsx"
Cohesion: 0.13
Nodes (27): dynamic, GammesPage(), PALETTE, PeoplePanel(), PersonRow, PersonSheet(), ProductOption, ProductPicker() (+19 more)

### Community 98 - "mail-folder-bar.tsx"
Cohesion: 0.17
Nodes (24): MailFolderBar(), MailFolderRow, FolderRow, LegalFolderBar(), allFolders(), companyAllowed(), createLegalFolder(), deleteLegalFolder() (+16 more)

### Community 99 - "meeting-actions.ts"
Cohesion: 0.11
Nodes (29): EditMeetingButton(), InviteResponse(), Resp, ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), ManageBar() (+21 more)

### Community 100 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (29): prefillResearchRow(), analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize() (+21 more)

### Community 101 - "scheduled.ts"
Cohesion: 0.12
Nodes (29): runAssistantReminders(), alertRegulatory(), isDue(), runAnppWatchIfDue(), watchEnabled(), pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS (+21 more)

### Community 102 - "petty-cash-actions.ts"
Cohesion: 0.17
Nodes (24): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+16 more)

### Community 103 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 104 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 105 - "replay-viewer.tsx"
Cohesion: 0.16
Nodes (24): NO_CONTENT, POST(), asCaptured(), ICON, ReplayEvent, ReplaySession, ReplayViewer(), labelOf() (+16 more)

### Community 106 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (24): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+16 more)

### Community 107 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 108 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 109 - "microsoft-mail-actions.ts"
Cohesion: 0.14
Nodes (26): AttachmentBar(), Composer(), listStamp(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm() (+18 more)

### Community 110 - "legal-actions.ts"
Cohesion: 0.15
Nodes (24): attachDriveNodeToLegal(), checkChainFrom(), editLegalDocument(), KINDS, parseKind(), readFields(), renewLegalDocument(), updateLegalDocument() (+16 more)

### Community 111 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 112 - "lib/messaging.ts"
Cohesion: 0.11
Nodes (22): dynamic, GET(), dynamic, NO_CONTENT, POST(), dynamic, POST(), DOT (+14 more)

### Community 113 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (25): DossierAssign(), DossierMessageForm(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton(), archiveDossier() (+17 more)

### Community 114 - "recruitment/request-flow.ts"
Cohesion: 0.12
Nodes (24): NewRecruitmentButton(), ApprovalState, CANDIDATE_LABEL, CANDIDATE_ORDER, CANDIDATE_TONE, candidateRank(), CandidateStatus, ChainDecider (+16 more)

### Community 115 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 116 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 117 - "document-preview.tsx"
Cohesion: 0.14
Nodes (19): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+11 more)

### Community 118 - "legal/[id]/page.tsx"
Cohesion: 0.14
Nodes (19): dynamic, LEGAL_DOC_CATEGORIES, LegalDocumentPage(), dateInput(), LegalTable(), URGENT, RecordDeleteButton(), LEGAL_DOC_KIND (+11 more)

### Community 119 - "client.ts"
Cohesion: 0.16
Nodes (21): buildUrl(), correlationId(), DELTA_EXPIRED, graphBinary(), graphJson(), graphRaw(), GraphRequest, HUMAN (+13 more)

### Community 120 - "openapi.ts"
Cohesion: 0.15
Nodes (19): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, getOperation() (+11 more)

### Community 121 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 122 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 123 - "drive/upload/route.ts"
Cohesion: 0.15
Nodes (14): POST(), GB, makeTtlCache(), quotaVerdict, TtlCache, formatTiming(), Phase, slowestPhase() (+6 more)

### Community 124 - "meetings.ts"
Cohesion: 0.14
Nodes (19): dynamic, GET(), externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin() (+11 more)

### Community 125 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+14 more)

### Community 126 - "expense-row-actions.tsx"
Cohesion: 0.17
Nodes (18): BudgetTargetField(), ExpensePanel(), EditableExpense, CatalogArticle, BudgetTarget, DEPT_BUDGET_LABEL, cashAvailable(), defaultSource() (+10 more)

### Community 127 - "departments-manager.tsx"
Cohesion: 0.17
Nodes (22): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+14 more)

### Community 128 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 129 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 130 - "connection.ts"
Cohesion: 0.18
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 131 - "molecule-panel.tsx"
Cohesion: 0.13
Nodes (18): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+10 more)

### Community 132 - "medical-info-actions.ts"
Cohesion: 0.21
Nodes (21): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+13 more)

### Community 133 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 134 - "company.ts"
Cohesion: 0.21
Nodes (19): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+11 more)

### Community 135 - "zip-inspector.ts"
Cohesion: 0.16
Nodes (22): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+14 more)

### Community 136 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 137 - "http.ts"
Cohesion: 0.17
Nodes (18): GET, GET, ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer(), requireScopes() (+10 more)

### Community 138 - "purchase-section.tsx"
Cohesion: 0.20
Nodes (18): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), withdrawPurchaseRequest(), getManagerOfUser() (+10 more)

### Community 139 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 140 - "portfolio.ts"
Cohesion: 0.15
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 141 - "department-budget-actions.ts"
Cohesion: 0.26
Nodes (21): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget() (+13 more)

### Community 142 - "general-means.ts"
Cohesion: 0.16
Nodes (19): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+11 more)

### Community 143 - "drive-search.ts"
Cohesion: 0.18
Nodes (19): describePath(), fold(), matchesQuery(), MIN_QUERY, normalizeQuery(), rankHit(), SearchHit, searchSummary() (+11 more)

### Community 144 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 145 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 146 - "edit-product.tsx"
Cohesion: 0.15
Nodes (16): OpeningBalance, DciAssociationField(), EditProductButton(), EditProductValues, UserOption, UserOption, SupplierRow, SelectField() (+8 more)

### Community 147 - "identity-board.tsx"
Cohesion: 0.18
Nodes (16): CopyButton(), IdentityBoard(), IdentityCompany, IdentitySheet(), dynamic, LegalIdentitiesPage(), COMPANY_DOC_CATEGORIES, CompanyDocCategory (+8 more)

### Community 148 - "lib/drive.ts"
Cohesion: 0.15
Nodes (18): browseDrive(), BrowseNode, BrowseResult, EMPTY, DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow (+10 more)

### Community 149 - "reply.ts"
Cohesion: 0.18
Nodes (18): MailAddress, buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock() (+10 more)

### Community 150 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 151 - "ingest.ts"
Cohesion: 0.15
Nodes (16): dynamic, maxDuration, POST(), runtime, asSectionHeader(), CATEGORIES, categorizeReserve(), cleanSectionCode() (+8 more)

### Community 152 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 153 - "workspace.tsx"
Cohesion: 0.28
Nodes (16): DocumentWorkspace(), OpenDoc, Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W (+8 more)

### Community 154 - "executive-brief-tools.ts"
Cohesion: 0.16
Nodes (12): LegalChainCard(), EXECUTIVE_BRIEF_TOOLS, amountDrift(), CHAIN_KIND_LABEL, CHAIN_KINDS, ChainDoc, ChainKind, chainOf() (+4 more)

### Community 155 - "receipt-lines.tsx"
Cohesion: 0.27
Nodes (16): empty(), ExistingLine, ReceiptLines(), Row, readReceipt(), ReceiptDraft, normalizeLines(), parseAmount() (+8 more)

### Community 156 - "product-catalog.ts"
Cohesion: 0.18
Nodes (16): KIND_LABEL, OrphanRow(), bestMatches(), isConfident(), MatchProposal, matchScore(), ProductIdentity, productKey() (+8 more)

### Community 157 - "stand-in.ts"
Cohesion: 0.23
Nodes (16): actsFor(), day(), delegatedActions(), delegationNotice(), delegationsFor(), inactiveReason(), isDelegatable(), isDelegationActive() (+8 more)

### Community 158 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (12): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+4 more)

### Community 159 - "document-mirror.ts"
Cohesion: 0.24
Nodes (14): POST(), ENTITIES, mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder(), ensureDrivePath() (+6 more)

### Community 160 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 161 - "departments.ts"
Cohesion: 0.18
Nodes (15): DepartmentsPage(), dynamic, metadata, buildTree(), DeptLite, EmpLite, flattenTree(), getDepartmentMembers() (+7 more)

### Community 162 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 163 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 164 - "errors.ts"
Cohesion: 0.17
Nodes (11): blockOf(), GET, SCALARS, schema(), POST, API_ERROR_CODES, ApiError, ApiErrorBody (+3 more)

### Community 165 - "legal/page.tsx"
Cohesion: 0.19
Nodes (13): legalFields(), LegalRow, dynamic, LegalPage(), metadata, effectiveStatus(), canReadLegalDocument(), isRestricted() (+5 more)

### Community 166 - "pch.ts"
Cohesion: 0.19
Nodes (15): PchTenderPage(), d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail() (+7 more)

### Community 167 - "MicrosoftGraphMailProvider"
Cohesion: 0.18
Nodes (4): draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 168 - "org-chart-print.ts"
Cohesion: 0.24
Nodes (12): OrgCanvas(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml(), OrgSvg, PRINT_BOX_H, PRINT_BOX_W (+4 more)

### Community 169 - "doc-request.ts"
Cohesion: 0.25
Nodes (13): DocumentRequestPage(), PiecesPage(), canCancel(), canDecide(), canSubmit(), DocRequestActor, DocRequestMove, DocRequestState (+5 more)

### Community 170 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 171 - "rh/upload/route.ts"
Cohesion: 0.30
Nodes (11): dynamic, POST(), HrDossier(), defaultVisibleToEmployee(), EMPLOYEE_FACING, resolveVisibility(), shouldMirrorToDrive(), visibilityLabel() (+3 more)

### Community 172 - "radar.ts"
Cohesion: 0.22
Nodes (14): fmtPct(), fmtUsd(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow (+6 more)

### Community 173 - "queries/workflow.ts"
Cohesion: 0.18
Nodes (13): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, synthesizeCreationEvent(), WorkflowEventView, WorkflowOutcome, WorkflowView (+5 more)

### Community 175 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 176 - "(app)/organigramme/page.tsx"
Cohesion: 0.23
Nodes (9): OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), canEditOrgChart(), canViewOrgChart() (+1 more)

### Community 177 - "courriers/page.tsx"
Cohesion: 0.25
Nodes (11): MailEntryPage(), dateInput(), dateTimeInput(), mailFields(), MailPartnersManager(), MailRow, CourriersPage(), dynamic (+3 more)

### Community 178 - "contacts-board.tsx"
Cohesion: 0.25
Nodes (7): ContactRow, ContactsBoard(), CONTACT_KIND_SUGGESTIONS, groupContactsByKind(), matchesContact(), NO_KIND_LABEL, normalizeKind()

### Community 179 - "apps.ts"
Cohesion: 0.37
Nodes (11): OfficeLauncher(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp, OfficeAppKey, officeHref() (+3 more)

### Community 180 - "upload-button.tsx"
Cohesion: 0.27
Nodes (10): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), UserLite, FINGERPRINT_MAX_BYTES, FINGERPRINT_MIN_BYTES, fingerprintFile() (+2 more)

### Community 181 - "field-reports/page.tsx"
Cohesion: 0.22
Nodes (11): dynamic, FieldReportPage(), FieldReportsOverviewPage(), dynamic, FieldReportsPage(), FIELD_REPORT_STATUS, canViewFieldReportsOverview(), getFieldReportDetail() (+3 more)

### Community 182 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 183 - "file-glyph.tsx"
Cohesion: 0.26
Nodes (10): FileGlyph(), FileGlyphProps, LOOK, extensionOf(), FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec (+2 more)

### Community 184 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 185 - "admin-delete-actions.ts"
Cohesion: 0.26
Nodes (12): CREATOR_DELETABLE, CREATOR_DELETE_PERMISSION, delegateOf(), DeletableKind, deleteOwnRecord(), DeleteResult, isKind(), KindSpec (+4 more)

### Community 186 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 187 - "api/workflow.ts"
Cohesion: 0.24
Nodes (10): ASPECTS, GET, AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf() (+2 more)

### Community 188 - "hr-dossier.tsx"
Cohesion: 0.20
Nodes (10): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), REQ_TO_CAT, MeetingControls(), HR_DOCUMENT_STATUSES, HR_DOCUMENT_CATEGORY (+2 more)

### Community 189 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 190 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 191 - "entites/page.tsx"
Cohesion: 0.31
Nodes (7): EntityRow, OrphansPanel(), dynamic, EntitesPage(), getUnattachedInventory(), TABLES, UnattachedGroup

### Community 192 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 193 - "drive-space-actions.ts"
Cohesion: 0.36
Nodes (9): CreateSpaceButton(), SpaceSettingsButton(), archiveDriveSpace(), createDriveSpace(), deleteDriveSpace(), ensureCanManageSpace(), readIds(), updateDriveSpace() (+1 more)

### Community 194 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 195 - "training-panel.tsx"
Cohesion: 0.27
Nodes (7): CaseDocRow, CaseRow, TrainingPanel(), UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 196 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 197 - "calendar-view.tsx"
Cohesion: 0.25
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND, CALENDAR_INVITE_STATUS

### Community 198 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 199 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 200 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 201 - "workflow-panel.tsx"
Cohesion: 0.32
Nodes (6): EventFundingPanel(), PmOpt, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel()

### Community 202 - "new-conversation.tsx"
Cohesion: 0.25
Nodes (4): fd(), MemberMultiSelect(), Mode, SearchBox()

### Community 203 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 204 - "drive-space-manager.tsx"
Cohesion: 0.29
Nodes (3): ROLE_ENTRIES, SpaceData, UserOpt

### Community 205 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 206 - "change-password-form.tsx"
Cohesion: 0.38
Nodes (4): ChangePasswordForm(), ChangePasswordPage(), metadata, changePassword()

### Community 207 - "stand-in-panel.tsx"
Cohesion: 0.29
Nodes (6): StandInButton(), StandInDecision(), StandInModule, StandInPerson, StandInState, TONE

### Community 208 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 209 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 210 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 211 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 214 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 215 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 216 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 217 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 218 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 219 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 220 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 221 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

### Community 222 - "validation-item-review.tsx"
Cohesion: 0.50
Nodes (3): Decision, LABEL, TONE

### Community 223 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

## Knowledge Gaps
- **1596 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1591 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `page-header.tsx`, `userCan`, `recordAudit`, `requireModule`, `lib/labels.ts`, `getCurrentUser`, `toNumber`, `formatDate`, `batch-runner.ts`, `cn`, `promo-material-actions.ts`, `brain-cockpit.tsx`, `drive-storage.ts`, `getAppSettings`, `regulatory-actions.ts`, `regulatory/page.tsx`, `build-facts.ts`, `hasGlobalView`, `dossier-agent.ts`, `mail.ts`, `test-center/runner.ts`, `assistant.ts`, `assistant-actions.ts`, `[dossierId]/page.tsx`, `notifyUser`, `requireUser`, `validation-actions.ts`, `power-tools.ts`, `settings.ts`, `directory-grid.ts`, `corpus-actions.ts`, `users/[id]/page.tsx`, `rules/engine.ts`, `jobs/runner.ts`, `mon-espace/page.tsx`, `lib/session.ts`, `regAudit`, `payment-request-actions.ts`, `fdDate`, `ad-pro-item-actions.ts`, `care-actions.ts`, `lib/department-budget.ts`, `(app)/layout.tsx`, `topbar.tsx`, `storage.ts`, `admin-settings-forms.tsx`, `drive/page.tsx`, `formatCurrency`, `entity-access.ts`, `lib/ai.ts`, `admin-request-actions.ts`, `centre-board.tsx`, `(app)/validations/page.tsx`, `drive-actions.ts`, `letterhead-manager.tsx`, `library-ingest.ts`, `ad-pro/page.tsx`, `calendar.ts`, `mail-register-actions.ts`, `pilotage/page.tsx`, `intelligence/actions.ts`, `adoption.ts`, `corpus/actions.ts`, `aiConfigured`, `upload/session.ts`, `consulting/[id]/page.tsx`, `queries/messaging.ts`, `reports.ts`, `office-supply-actions.ts`, `platform-audit/engine.ts`, `exports.ts`, `market-research.ts`, `agent-core.ts`, `product-explorer.tsx`, `messaging-actions.ts`, `workflow/engine.ts`, `stock-board.tsx`, `what-if.ts`, `voice-realtime.ts`, `entities.ts`, `ranges-manager.tsx`, `mail-folder-bar.tsx`, `meeting-actions.ts`, `pch-tender-line-actions.ts`, `scheduled.ts`, `petty-cash-actions.ts`, `src/auth.ts`, `replay-viewer.tsx`, `workflow-builder.tsx`, `bd-strategic-table.tsx`, `microsoft-mail-actions.ts`, `legal-actions.ts`, `lib/messaging.ts`, `dossier-actions.ts`, `smart-mail-actions.ts`, `legal/[id]/page.tsx`, `lifecycle/actions.ts`, `state-machines/explorer.ts`, `drive/upload/route.ts`, `meetings.ts`, `expense-row-actions.tsx`, `departments-manager.tsx`, `migration-cert.ts`, `connection.ts`, `medical-info-actions.ts`, `company.ts`, `http.ts`, `purchase-section.tsx`, `progress/query.ts`, `portfolio.ts`, `department-budget-actions.ts`, `general-means.ts`, `drive-search.ts`, `rag.ts`, `identity-board.tsx`, `lib/drive.ts`, `ingest.ts`, `run.ts`, `executive-brief-tools.ts`, `receipt-lines.tsx`, `product-catalog.ts`, `stand-in.ts`, `invariants/registry.ts`, `document-mirror.ts`, `consulting-actions.ts`, `departments.ts`, `invoice-actions.ts`, `support-actions.ts`, `legal/page.tsx`, `pch.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `queries/workflow.ts`, `pch/export/route.ts`, `(app)/organigramme/page.tsx`, `courriers/page.tsx`, `field-reports/page.tsx`, `stock-snapshot-actions.ts`, `admin-delete-actions.ts`, `push.ts`, `api/workflow.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `entites/page.tsx`, `drive-space-actions.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `[token]/route.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `page-header.tsx`, `userCan`, `button.tsx`, `recordAudit`, `prisma.ts`, `requireModule`, `lib/labels.ts`, `getCurrentUser`, `toNumber`, `formatDate`, `cn`, `promo-material-actions.ts`, `brain-cockpit.tsx`, `getAppSettings`, `regulatory-actions.ts`, `regulatory/page.tsx`, `hasGlobalView`, `test-center/runner.ts`, `assistant-actions.ts`, `notifyUser`, `validation-actions.ts`, `settings.ts`, `corpus-actions.ts`, `users/[id]/page.tsx`, `rules/engine.ts`, `lib/session.ts`, `regAudit`, `payment-request-actions.ts`, `fdDate`, `ad-pro-item-actions.ts`, `care-actions.ts`, `budget-forms.tsx`, `lib/department-budget.ts`, `(app)/layout.tsx`, `oauth.ts`, `storage.ts`, `drive/page.tsx`, `molecule.ts`, `entity-access.ts`, `lib/ai.ts`, `admin-request-actions.ts`, `centre-board.tsx`, `drive-actions.ts`, `letterhead-manager.tsx`, `library-ingest.ts`, `mail-register-actions.ts`, `intelligence/actions.ts`, `new-request-picker.tsx`, `corpus/actions.ts`, `aiConfigured`, `reports.ts`, `office-supply-actions.ts`, `platform-audit/engine.ts`, `product-explorer.tsx`, `messaging-actions.ts`, `stock-board.tsx`, `voice-realtime.ts`, `ranges-manager.tsx`, `mail-folder-bar.tsx`, `meeting-actions.ts`, `pch-tender-line-actions.ts`, `petty-cash-actions.ts`, `workflow-builder.tsx`, `microsoft-mail-actions.ts`, `legal-actions.ts`, `lib/messaging.ts`, `dossier-actions.ts`, `smart-mail-actions.ts`, `lifecycle/actions.ts`, `messenger.tsx`, `departments-manager.tsx`, `medical-info-actions.ts`, `purchase-section.tsx`, `department-budget-actions.ts`, `mail-client.tsx`, `lib/drive.ts`, `run.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `support-actions.ts`, `doc-request.ts`, `(app)/organigramme/page.tsx`, `stock-snapshot-actions.ts`, `admin-delete-actions.ts`, `reminder-actions.ts`, `drive-space-actions.ts`, `change-password-form.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `card.tsx`, `page-header.tsx`, `recordAudit`, `prisma.ts`, `requireModule`, `lib/labels.ts`, `getCurrentUser`, `toNumber`, `formatDate`, `cn`, `promo-material-actions.ts`, `brain-cockpit.tsx`, `drive-storage.ts`, `getAppSettings`, `regulatory-actions.ts`, `regulatory/page.tsx`, `hasGlobalView`, `assistant.ts`, `assistant-actions.ts`, `notifyUser`, `requireUser`, `validation-actions.ts`, `power-tools.ts`, `settings.ts`, `directory-grid.ts`, `users/[id]/page.tsx`, `mon-espace/page.tsx`, `lib/session.ts`, `payment-request-actions.ts`, `fdDate`, `ad-pro-item-actions.ts`, `care-actions.ts`, `lib/department-budget.ts`, `(app)/layout.tsx`, `storage.ts`, `drive/page.tsx`, `molecule.ts`, `formatCurrency`, `entity-access.ts`, `lib/ai.ts`, `admin-request-actions.ts`, `centre-board.tsx`, `(app)/validations/page.tsx`, `drive-actions.ts`, `ad-pro/page.tsx`, `calendar.ts`, `mail-register-actions.ts`, `pilotage/page.tsx`, `adoption.ts`, `aiConfigured`, `consulting/[id]/page.tsx`, `queries/messaging.ts`, `office-supply-actions.ts`, `exports.ts`, `market-research.ts`, `product-explorer.tsx`, `messaging-actions.ts`, `stock-board.tsx`, `what-if.ts`, `entities.ts`, `ranges-manager.tsx`, `mail-folder-bar.tsx`, `meeting-actions.ts`, `pch-tender-line-actions.ts`, `petty-cash-actions.ts`, `legal-actions.ts`, `lib/messaging.ts`, `dossier-actions.ts`, `legal/[id]/page.tsx`, `openapi.ts`, `drive/upload/route.ts`, `departments-manager.tsx`, `medical-info-actions.ts`, `http.ts`, `department-budget-actions.ts`, `general-means.ts`, `mail-client.tsx`, `identity-board.tsx`, `lib/drive.ts`, `executive-brief-tools.ts`, `consulting-actions.ts`, `departments.ts`, `invoice-actions.ts`, `support-actions.ts`, `errors.ts`, `legal/page.tsx`, `pch.ts`, `doc-request.ts`, `regulatory/export/route.ts`, `rh/upload/route.ts`, `pch/export/route.ts`, `(app)/organigramme/page.tsx`, `courriers/page.tsx`, `stock-snapshot-actions.ts`, `admin-delete-actions.ts`, `api/workflow.ts`, `reminder-actions.ts`, `entites/page.tsx`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1596 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.036059113300492614 - nodes in this community are weakly interconnected._
- **Should `page-header.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0499001996007984 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.032481490327203245 - nodes in this community are weakly interconnected._