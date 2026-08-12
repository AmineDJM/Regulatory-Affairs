# Graph Report - src  (2026-08-12)

## Corpus Check
- 1000 files · ~758,160 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6214 nodes · 24463 edges · 201 communities (195 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6175f49d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- requireUser
- lib/labels.ts
- department-budget-actions.ts
- card.tsx
- budget-forms.tsx
- notifyUser
- regulatory/[id]/page.tsx
- getAppSettings
- getCurrentUser
- (app)/layout.tsx
- badge.tsx
- Button
- workflow/engine.ts
- build-facts.ts
- fdNum
- rules/engine.ts
- test-center/runner.ts
- corpus-actions.ts
- assistant-actions.ts
- recordAudit
- userCan
- jobs/runner.ts
- formatCurrency
- [dossierId]/page.tsx
- prisma.ts
- formatDateTime
- dossier-agent.ts
- sponsoring-actions.ts
- utils.ts
- care-actions.ts
- ad-pro-item-actions.ts
- upload/session.ts
- toNumber
- ingest-dossier.ts
- FindingInput
- assistant.ts
- market-research.ts
- molecule.ts
- pilotage/page.tsx
- mistral-ocr.ts
- regAudit
- onlyofficeConfigured
- corpus/actions.ts
- product-explorer.tsx
- sales-planning-actions.ts
- promo-material-actions.ts
- training-board.tsx
- lib/ai.ts
- departments.ts
- openai-luna.ts
- intelligence/actions.ts
- adoption.ts
- drive/page.tsx
- batch-runner.ts
- agent-core.ts
- reports.ts
- platform-audit/engine.ts
- sectionByCode
- Select
- document-preview.tsx
- object-storage.ts
- dashboard.ts
- button.tsx
- validation-actions.ts
- pch-tender-line-actions.ts
- ocr-engine.ts
- rbac.ts
- aiConfigured
- medical-info-actions.ts
- auth.ts
- access-actions.ts
- bd-strategic-table.tsx
- competition.ts
- medical-actions.ts
- upload-manager.tsx
- queries/messaging.ts
- anyRoleFilter
- anpp-process.tsx
- smart-mail-actions.ts
- explorer.ts
- extract-text.ts
- drive/[id]/page.tsx
- ocrDocument
- medical.ts
- driver/page.tsx
- messenger.tsx
- query.ts
- lifecycle/actions.ts
- congress-request-actions.ts
- mail.ts
- scheduled.ts
- migration-cert.ts
- getBlob
- brain-cockpit.tsx
- calendar.ts
- dossiers/[id]/panel.tsx
- knowledge/actions.ts
- enregistrement/page.tsx
- risks.ts
- library-ingest.ts
- invariants/registry.ts
- sheet-import.ts
- regulatory-actions.ts
- rag.ts
- field-reports.ts
- mail-client.tsx
- edit-product.tsx
- meetings/[id]/page.tsx
- onboarding-wizard.tsx
- portfolio.ts
- getMarketData
- meetings.ts
- admin-settings-forms.tsx
- adventum-brain/page.tsx
- company.ts
- org-chart-print.ts
- validations.ts
- run.ts
- validation-supervision.ts
- aiFeatureEnabled
- info-panel.tsx
- messaging-actions.ts
- ad-pro-edit-actions.ts
- drive-actions.ts
- support-actions.ts
- molecule-panel.tsx
- meeting-actions.ts
- lib/messaging.ts
- supplier/actions.ts
- office-templates.ts
- field-report-actions.ts
- pch.ts
- today.ts
- process-intelligence.ts
- tender-lines.tsx
- regulatory-table.tsx
- SessionUser
- events.ts
- radar.ts
- event-actions.ts
- withImap
- typing/route.ts
- new-request.tsx
- medical-directory.tsx
- entrainement/page.tsx
- stock-snapshot-actions.ts
- simple-pdf.ts
- push.ts
- format.tsx
- getMessage
- feature-actions.ts
- calendar-view.tsx
- agents/actions.ts
- reminder-actions.ts
- pch-tender-export.ts
- regulatory-drive-mirror.ts
- loadInbox
- messaging/messages/route.ts
- congress-workflow.tsx
- meetings/page.tsx
- training/for-section.ts
- mail-diagnostic/route.ts
- directive-flow.test.ts
- regulatory/page.tsx
- supplier-auth.ts
- fuzz.ts
- Adventum Autonomous Test Center — architecture
- dossiers.ts
- drive-space-manager.tsx
- training-panel.tsx
- client-bundle-guard.test.ts
- manufacturing-stage.ts
- risk-settings.ts
- congress-request-form.tsx
- workflow-panel.tsx
- delegate-plans.tsx
- new-conversation.tsx
- (auth)/login/login-form.tsx
- pulse-strip.tsx
- pages.ts
- pipeline.e2e.test.ts
- [token]/route.ts
- event-form.tsx
- bv-requests.tsx
- step-timeline.tsx
- employee-form.tsx
- next-auth.d.ts
- test-center-client.tsx
- request-controls.tsx
- attachment/route.ts
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 634 edges
2. `userCan()` - 481 edges
3. `fdStr()` - 473 edges
4. `recordAudit()` - 411 edges
5. `prisma` - 402 edges
6. `requireModule()` - 220 edges
7. `hasGlobalView()` - 186 edges
8. `Button` - 163 edges
9. `formatDate()` - 146 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `form()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/budget-expense.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/reset-password.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts

## Import Cycles
- None detected.

## Communities (201 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.04
Nodes (108): dynamic, EntitesPage(), AdminPage(), fmtBytes(), fmtWhen(), dynamic, metadata, VersionsPage() (+100 more)

### Community 1 - "requireUser"
Cohesion: 0.04
Nodes (123): POST(), EntitiesManager(), FieldsManager(), ActiveToggle(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor() (+115 more)

### Community 2 - "lib/labels.ts"
Cohesion: 0.03
Nodes (108): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), dynamic (+100 more)

### Community 3 - "department-budget-actions.ts"
Cohesion: 0.06
Nodes (92): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), DepartmentBudgetsPage() (+84 more)

### Community 4 - "card.tsx"
Cohesion: 0.04
Nodes (76): ActivityPage(), fmtDuration(), AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata (+68 more)

### Community 5 - "budget-forms.tsx"
Cohesion: 0.05
Nodes (74): GET(), BudgetContextBar(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo (+66 more)

### Community 6 - "notifyUser"
Cohesion: 0.06
Nodes (78): TrainingBoard(), RequestRow(), DENIED, runAutopilot(), archiveDirective(), canManage(), canParticipate(), createDirective() (+70 more)

### Community 7 - "regulatory/[id]/page.tsx"
Cohesion: 0.06
Nodes (55): FieldDefDTO, CustomFieldsPage(), dynamic, BD_DOC_CATEGORIES, PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, DOSSIER_DOC_CATEGORIES, dynamic (+47 more)

### Community 8 - "getAppSettings"
Cohesion: 0.05
Nodes (66): GET(), POST(), POST(), dynamic, POST(), dynamic, POST(), dynamic (+58 more)

### Community 9 - "getCurrentUser"
Cohesion: 0.05
Nodes (67): DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME, runtime, dynamic (+59 more)

### Community 10 - "(app)/layout.tsx"
Cohesion: 0.04
Nodes (61): AppLayout(), ActivityTracker(), Geo, send(), UAData, BackgroundUploadProvider(), BgFile, BgJob (+53 more)

### Community 11 - "badge.tsx"
Cohesion: 0.10
Nodes (51): dynamic, TYPES, ACTION_COLS, ACTION_LABELS, AdminValidationsPage(), dec(), dynamic, Tab (+43 more)

### Community 12 - "Button"
Cohesion: 0.07
Nodes (41): DriveStorageSettings(), EntityRow, PALETTE, OrgBranch(), Option, RuleDTO, ROLE_OPTIONS, UserOpt (+33 more)

### Community 13 - "workflow/engine.ts"
Cohesion: 0.05
Nodes (69): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), Props, DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+61 more)

### Community 14 - "build-facts.ts"
Cohesion: 0.05
Nodes (62): AssignmentMatrix(), key(), nOr0(), extractLooseJson(), repairAndParse(), handleFacts(), AiFactDoc, AiFactSchema (+54 more)

### Community 15 - "fdNum"
Cohesion: 0.07
Nodes (61): CreateRecordButtonProps, resetActivityTime(), saveAdoptionSettings(), updateRiskThresholds(), updateAiSettings(), computeStatus(), createBudget(), addBudgetExpense() (+53 more)

### Community 16 - "rules/engine.ts"
Cohesion: 0.06
Nodes (56): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+48 more)

### Community 17 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (54): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), getTestCenterDashboard(), base, Certification, CertificationInput (+46 more)

### Community 18 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 19 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (54): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+46 more)

### Community 20 - "recordAudit"
Cohesion: 0.06
Nodes (57): ImpersonateButton(), SuppliesManager(), SupplyArticleRow, EditTransactionSheet(), PayButton(), changePassword(), doSignOut(), decideDepartmentBudgetRequest() (+49 more)

### Community 21 - "userCan"
Cohesion: 0.07
Nodes (60): GET(), EventForm(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), RevisionRequest(), FormationsPage(), archiveAdminRequestIfDone() (+52 more)

### Community 22 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (57): splitTextIntoChunksWithOffsets(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), enrichVersionFindings(), AI_PRIORITY_SECTIONS (+49 more)

### Community 23 - "formatCurrency"
Cohesion: 0.06
Nodes (46): BudgetRow, BudgetsTable(), MONTHS, Budget(), DashboardPage(), STATUS_COLORS, CategoryCard(), ComptaCockpit() (+38 more)

### Community 24 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (50): DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT, ReserveMap, securityIcon() (+42 more)

### Community 25 - "prisma.ts"
Cohesion: 0.07
Nodes (29): dynamic, GET(), StocksPage(), SnapshotDTO, actorFor(), form(), actorFor(), fd() (+21 more)

### Community 26 - "formatDateTime"
Cohesion: 0.05
Nodes (50): AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, CorbeillePage(), dynamic, TrashItem, TrashList() (+42 more)

### Community 27 - "dossier-agent.ts"
Cohesion: 0.07
Nodes (50): Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, parsePdfBody(), addCitation(), AgentContext, buildUserMessage() (+42 more)

### Community 28 - "sponsoring-actions.ts"
Cohesion: 0.07
Nodes (51): CreateDossierButton(), AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS (+43 more)

### Community 29 - "utils.ts"
Cohesion: 0.07
Nodes (43): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), Chip(), Composer(), Pending (+35 more)

### Community 30 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 31 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (48): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, Props, addAdProItem(), AdProModule, approveAdProItemOrder() (+40 more)

### Community 32 - "upload/session.ts"
Cohesion: 0.07
Nodes (45): dynamic, runtime, DELETE(), dynamic, GET(), runtime, scope(), ingestDossierZipFromFile() (+37 more)

### Community 33 - "toNumber"
Cohesion: 0.12
Nodes (43): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), MyMissionsPage() (+35 more)

### Community 34 - "ingest-dossier.ts"
Cohesion: 0.07
Nodes (46): dynamic, maxDuration, runtime, sha256File(), archiveQueue, attachArchive(), clampInt(), enqueueArchive() (+38 more)

### Community 35 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 36 - "assistant.ts"
Cohesion: 0.07
Nodes (45): ClaudeToolDef, activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+37 more)

### Community 37 - "market-research.ts"
Cohesion: 0.08
Nodes (39): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationCard(), PresentationPanel(), Res (+31 more)

### Community 38 - "molecule.ts"
Cohesion: 0.11
Nodes (43): MarketProductsPage(), SuggestField(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts(), analyzeMoleculeSafe() (+35 more)

### Community 39 - "pilotage/page.tsx"
Cohesion: 0.10
Nodes (40): AffectationsPage(), dynamic, Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft() (+32 more)

### Community 40 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 41 - "regAudit"
Cohesion: 0.09
Nodes (37): dynamic, metadata, PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, regAudit(), enrichFinding() (+29 more)

### Community 42 - "onlyofficeConfigured"
Cohesion: 0.12
Nodes (36): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+28 more)

### Community 43 - "corpus/actions.ts"
Cohesion: 0.09
Nodes (34): CorpusAdmin(), CorpusImport(), CaseCard(), canManage(), createCorpusSourceVersion(), importCorpusFileAction(), Result, searchCorpusAction() (+26 more)

### Community 44 - "product-explorer.tsx"
Cohesion: 0.08
Nodes (37): AggNum(), BdProjectDetailPage(), dynamic, fmtDzd(), Mode, MODES, dynamic, fmtPct() (+29 more)

### Community 45 - "sales-planning-actions.ts"
Cohesion: 0.08
Nodes (37): Assign, Kam, Prod, BU, CatalogueManager(), CHANNELS, Opt, Prod (+29 more)

### Community 46 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 47 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 48 - "lib/ai.ts"
Cohesion: 0.08
Nodes (31): dynamic, GET(), runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock (+23 more)

### Community 49 - "departments.ts"
Cohesion: 0.10
Nodes (36): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+28 more)

### Community 50 - "openai-luna.ts"
Cohesion: 0.09
Nodes (38): BATCH_MULTIPLIER, BatchOutcome, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody(), callLuna() (+30 more)

### Community 51 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 52 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 53 - "drive/page.tsx"
Cohesion: 0.11
Nodes (34): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, DriveFilePage(), humanSize() (+26 more)

### Community 54 - "batch-runner.ts"
Cohesion: 0.09
Nodes (30): BatchRequest, fetchBatchOutput(), getBatchStatus(), aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt(), OffsetChunk (+22 more)

### Community 55 - "agent-core.ts"
Cohesion: 0.10
Nodes (25): extractJson(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery() (+17 more)

### Community 56 - "reports.ts"
Cohesion: 0.10
Nodes (28): FindingsReportButton(), ReserveLetterButton(), useGenerate(), Cycle, Point, RESERVE_TYPES, ReservesPanel(), generateFindingsReportAction() (+20 more)

### Community 57 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): generatePlatformIdeas(), sttConfigured(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding (+25 more)

### Community 58 - "sectionByCode"
Cohesion: 0.09
Nodes (31): dossierCost, regulatoryAiSpend, Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+23 more)

### Community 59 - "Select"
Cohesion: 0.06
Nodes (29): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter() (+21 more)

### Community 60 - "document-preview.tsx"
Cohesion: 0.09
Nodes (27): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+19 more)

### Community 61 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 62 - "dashboard.ts"
Cohesion: 0.12
Nodes (30): GET(), SearchPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData() (+22 more)

### Community 63 - "button.tsx"
Cohesion: 0.06
Nodes (25): Citation, Source, Version, RestoreButton(), PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView (+17 more)

### Community 64 - "validation-actions.ts"
Cohesion: 0.10
Nodes (32): RuleControls(), RuleEditor(), decideAdvance(), clearValidationItem(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule() (+24 more)

### Community 65 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (31): prefillResearchRow(), analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE (+23 more)

### Community 66 - "ocr-engine.ts"
Cohesion: 0.12
Nodes (30): buildPagedContent(), defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, createOcrWorker() (+22 more)

### Community 67 - "rbac.ts"
Cohesion: 0.07
Nodes (29): dynamic, GET(), dynamic, esc(), GET(), REGISTRATION_STATUS, ALL, CONTRIBUTE (+21 more)

### Community 68 - "aiConfigured"
Cohesion: 0.12
Nodes (25): AssistantPage(), dynamic, TodayPage(), dynamic, RootPage(), MorningBrief(), refreshMyBrief(), aiConfigured() (+17 more)

### Community 69 - "medical-info-actions.ts"
Cohesion: 0.16
Nodes (27): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+19 more)

### Community 70 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 71 - "access-actions.ts"
Cohesion: 0.12
Nodes (26): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, GrantOption, RowGrants() (+18 more)

### Community 72 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 73 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 74 - "medical-actions.ts"
Cohesion: 0.12
Nodes (29): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+21 more)

### Community 75 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 76 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 77 - "anyRoleFilter"
Cohesion: 0.13
Nodes (23): CongressInternationalPage(), CongressNationalPage(), dynamic, EquipesPage(), CongressDetail, CongressListRow, CongressType, dec() (+15 more)

### Community 78 - "anpp-process.tsx"
Cohesion: 0.12
Nodes (25): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryStepNote(), isRegStepKey(), phaseLabel(), presubOutcome() (+17 more)

### Community 79 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 80 - "explorer.ts"
Cohesion: 0.17
Nodes (21): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport (+13 more)

### Community 81 - "extract-text.ts"
Cohesion: 0.14
Nodes (19): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+11 more)

### Community 82 - "drive/[id]/page.tsx"
Cohesion: 0.10
Nodes (18): ConvertPdfButton(), DriveCommentItem, FileActions(), ShareItem, SharePanel(), MoveTarget, NodeActions(), Props (+10 more)

### Community 83 - "ocrDocument"
Cohesion: 0.13
Nodes (19): analyzeEmployeeContract(), CONTRACT_TYPES_UP, analyzeTenderDocument(), canOcr(), IMAGE_EXTS, ocrDocument(), asSectionHeader(), CATEGORIES (+11 more)

### Community 84 - "medical.ts"
Cohesion: 0.11
Nodes (23): CompanyLite, companyWhere(), currentCompanyWhere(), AbsenceRow, days(), DeadlineRow, getHrPulse(), HrPulse (+15 more)

### Community 85 - "driver/page.tsx"
Cohesion: 0.13
Nodes (19): ApprovalButtons(), ApprovalsPage(), CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), RequestDetailPage() (+11 more)

### Community 86 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+14 more)

### Community 87 - "query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 88 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 89 - "congress-request-actions.ts"
Cohesion: 0.25
Nodes (23): ThirdPartyInvolveButton(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision() (+15 more)

### Community 90 - "mail.ts"
Cohesion: 0.09
Nodes (24): acquireSlot(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool, imapWaiters (+16 more)

### Community 91 - "scheduled.ts"
Cohesion: 0.15
Nodes (22): AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews(), catchUpStalledPipelines() (+14 more)

### Community 92 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 93 - "getBlob"
Cohesion: 0.16
Nodes (18): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+10 more)

### Community 94 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (19): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+11 more)

### Community 95 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 96 - "dossiers/[id]/panel.tsx"
Cohesion: 0.12
Nodes (18): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+10 more)

### Community 97 - "knowledge/actions.ts"
Cohesion: 0.18
Nodes (20): DossierChatPanel(), Msg, SUGGESTIONS, askDossierAgentAction(), loadDossierChatAction(), resetDossierChatAction(), AgentAttachment, AgentFile (+12 more)

### Community 98 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 99 - "risks.ts"
Cohesion: 0.14
Nodes (22): adminRequestRisks(), AutopilotPayload, budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks() (+14 more)

### Community 100 - "library-ingest.ts"
Cohesion: 0.16
Nodes (20): LunaCallInput, rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve (+12 more)

### Community 101 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (14): PERMISSIONS, InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+6 more)

### Community 102 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 103 - "regulatory-actions.ts"
Cohesion: 0.16
Nodes (20): normalizeDci(), parseProductChannel(), setRegulatoryChecklistItem(), setRegulatoryPresubOutcome(), setRegulatoryStepState(), updateRegulatoryProduct(), upperMolecules(), LOCAL_MANUFACTURING_VARIATIONS (+12 more)

### Community 104 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 105 - "field-reports.ts"
Cohesion: 0.12
Nodes (18): dynamic, GET(), FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea() (+10 more)

### Community 106 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 107 - "edit-product.tsx"
Cohesion: 0.15
Nodes (16): OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow, SelectField() (+8 more)

### Community 108 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (18): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+10 more)

### Community 109 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 110 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 111 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 112 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 113 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 114 - "adventum-brain/page.tsx"
Cohesion: 0.17
Nodes (18): AdventumBrainPage(), BLOCK_CATS, dynamic, diff(), getPulse(), hourBucket(), LEVEL_RANK, PulseCounts (+10 more)

### Community 115 - "company.ts"
Cohesion: 0.23
Nodes (17): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+9 more)

### Community 116 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 117 - "validations.ts"
Cohesion: 0.14
Nodes (15): fd(), form(), actor(), fd(), CONG_STAGE, CrossValidationItem, getMyValidationRequests(), getMyValidations() (+7 more)

### Community 118 - "run.ts"
Cohesion: 0.17
Nodes (14): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES (+6 more)

### Community 119 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 120 - "aiFeatureEnabled"
Cohesion: 0.21
Nodes (15): dynamic, POST(), dynamic, POST(), dynamic, POST(), assistantNudge(), AiFeature (+7 more)

### Community 121 - "info-panel.tsx"
Cohesion: 0.25
Nodes (18): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), leaveConversation() (+10 more)

### Community 122 - "messaging-actions.ts"
Cohesion: 0.19
Nodes (18): NewConversation(), createChannel(), createDirect(), createGroup(), DENIED, joinChannel(), parseAttachments(), ParsedAttachment (+10 more)

### Community 123 - "ad-pro-edit-actions.ts"
Cohesion: 0.16
Nodes (16): isKind(), Target, TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS (+8 more)

### Community 124 - "drive-actions.ts"
Cohesion: 0.25
Nodes (17): ShareRow(), AccessSheet(), collectSubtree(), createFolder(), createOfficeNode(), deleteNode(), DENIED, ensureDriveFolders() (+9 more)

### Community 125 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 126 - "molecule-panel.tsx"
Cohesion: 0.21
Nodes (12): fmtDzd(), FoundList(), MoleculePanel(), arc(), Donut(), DonutSlice, foldTail(), INK (+4 more)

### Community 127 - "meeting-actions.ts"
Cohesion: 0.26
Nodes (15): acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink() (+7 more)

### Community 128 - "lib/messaging.ts"
Cohesion: 0.16
Nodes (14): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+6 more)

### Community 129 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 130 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 131 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (15): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+7 more)

### Community 132 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 133 - "today.ts"
Cohesion: 0.18
Nodes (12): CalendarEventDTO, getActionCenter(), resolve(), getToday(), greetingFor(), rankToday(), reasonOf(), REASONS (+4 more)

### Community 134 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 135 - "tender-lines.tsx"
Cohesion: 0.22
Nodes (13): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), createOrderFromLine() (+5 more)

### Community 136 - "regulatory-table.tsx"
Cohesion: 0.15
Nodes (12): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, RegulatoryTable() (+4 more)

### Community 137 - "SessionUser"
Cohesion: 0.19
Nodes (11): SupportDetailPage(), DAY, PERIOD_END, PERIOD_START, SUPER, canViewSupport(), getSupportRequest(), isSupportResponder() (+3 more)

### Community 138 - "events.ts"
Cohesion: 0.16
Nodes (13): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_TYPE, ACTIVE, buildStats(), EventDetail, EventListItem (+5 more)

### Community 139 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 140 - "event-actions.ts"
Cohesion: 0.25
Nodes (12): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), deleteEvent(), deleteRegistration(), inEnum() (+4 more)

### Community 141 - "withImap"
Cohesion: 0.21
Nodes (12): dynamic, GET(), acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError() (+4 more)

### Community 142 - "typing/route.ts"
Cohesion: 0.21
Nodes (9): dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation(), ConversationTyping, registry (+1 more)

### Community 143 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 144 - "medical-directory.tsx"
Cohesion: 0.19
Nodes (11): MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE (+3 more)

### Community 145 - "entrainement/page.tsx"
Cohesion: 0.21
Nodes (8): dynamic, metadata, TrainingPage(), TrainingPanel(), canEditOrgChart(), canSeeRegEnrollment(), canViewOrgChart(), OrgChartAccessSettings

### Community 146 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 147 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 148 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 149 - "format.tsx"
Cohesion: 0.24
Nodes (10): buildInlineRegex(), dayLabel(), escapeRegExp(), inlineNoCode(), PRESENCE_COLOR, PresenceDot(), presenceLine(), renderRich() (+2 more)

### Community 150 - "getMessage"
Cohesion: 0.22
Nodes (10): dynamic, GET(), friendlyMailError(), getMessage(), isOverloadError(), mailBreakerRemainingMs(), MailMessage, msgKey() (+2 more)

### Community 151 - "feature-actions.ts"
Cohesion: 0.25
Nodes (9): Group(), STAGE, VersionsManager(), requireAdmin(), setFeatureStage(), Stage, STAGE_LABEL, STAGES (+1 more)

### Community 152 - "calendar-view.tsx"
Cohesion: 0.24
Nodes (9): CalendarView(), colorOf(), EventDetail(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND (+1 more)

### Community 153 - "agents/actions.ts"
Cohesion: 0.25
Nodes (8): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentRunSummary, applicableAgents()

### Community 154 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 155 - "pch-tender-export.ts"
Cohesion: 0.29
Nodes (7): boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, TenderExportHeader, TenderExportLine, header

### Community 156 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 157 - "loadInbox"
Cohesion: 0.22
Nodes (9): dynamic, GET(), addrStr(), listingKey(), listMailboxes(), loadInbox(), noteMailSuccess(), readBoxes() (+1 more)

### Community 158 - "messaging/messages/route.ts"
Cohesion: 0.31
Nodes (8): dynamic, GET(), dynamic, GET(), touchPresence(), getTyping(), getSync(), getThreadRefresh()

### Community 159 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 160 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 161 - "training/for-section.ts"
Cohesion: 0.27
Nodes (7): CaseExtract, experienceForSection(), OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, OUTCOME_LABELS

### Community 162 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 163 - "directive-flow.test.ts"
Cohesion: 0.36
Nodes (7): DirectiveDetailPage(), actorFor(), canViewDirective(), DirectiveDetail, getDirective(), getDirectives(), scopeDirectives()

### Community 164 - "regulatory/page.tsx"
Cohesion: 0.31
Nodes (8): NewProductButton(), regStage(), RegulatoryPage(), RegulatoryRow, SuppliersManager(), isRegulatorySupervisor(), regTreatmentStarted(), RegWorkflowState

### Community 165 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 166 - "fuzz.ts"
Cohesion: 0.39
Nodes (8): probeUploads(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing(), SAFE, makeRng()

### Community 167 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 168 - "dossiers.ts"
Cohesion: 0.39
Nodes (7): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), isDossierMember(), scopeDossiers()

### Community 169 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 170 - "training-panel.tsx"
Cohesion: 0.32
Nodes (5): CaseDocRow, CaseRow, UpRow, OUTCOME_ORDER, OUTCOME_TONES

### Community 171 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 172 - "manufacturing-stage.ts"
Cohesion: 0.46
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 173 - "risk-settings.ts"
Cohesion: 0.38
Nodes (5): RiskThresholdsForm(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 174 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 175 - "workflow-panel.tsx"
Cohesion: 0.38
Nodes (5): PmOpt, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel()

### Community 176 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 177 - "new-conversation.tsx"
Cohesion: 0.29
Nodes (3): MemberMultiSelect(), Mode, SearchBox()

### Community 178 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 179 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 180 - "pages.ts"
Cohesion: 0.62
Nodes (5): anchorEvidence(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash()

### Community 181 - "pipeline.e2e.test.ts"
Cohesion: 0.43
Nodes (6): buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs()

### Community 182 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 183 - "event-form.tsx"
Cohesion: 0.40
Nodes (4): CreateEventButton(), d10(), EventFields(), Result

### Community 184 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 185 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 186 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 187 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 188 - "test-center-client.tsx"
Cohesion: 0.50
Nodes (4): ENV_LABEL, MODES, ResumeCleanupButton(), resumeTestCleanup()

### Community 189 - "request-controls.tsx"
Cohesion: 0.60
Nodes (4): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 190 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 191 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1247 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1242 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `requireUser`, `lib/labels.ts`, `department-budget-actions.ts`, `card.tsx`, `budget-forms.tsx`, `notifyUser`, `regulatory/[id]/page.tsx`, `getAppSettings`, `getCurrentUser`, `(app)/layout.tsx`, `badge.tsx`, `workflow/engine.ts`, `build-facts.ts`, `fdNum`, `rules/engine.ts`, `test-center/runner.ts`, `corpus-actions.ts`, `assistant-actions.ts`, `recordAudit`, `userCan`, `jobs/runner.ts`, `formatCurrency`, `[dossierId]/page.tsx`, `formatDateTime`, `dossier-agent.ts`, `sponsoring-actions.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `upload/session.ts`, `toNumber`, `ingest-dossier.ts`, `assistant.ts`, `market-research.ts`, `pilotage/page.tsx`, `regAudit`, `onlyofficeConfigured`, `corpus/actions.ts`, `sales-planning-actions.ts`, `promo-material-actions.ts`, `lib/ai.ts`, `departments.ts`, `openai-luna.ts`, `intelligence/actions.ts`, `adoption.ts`, `drive/page.tsx`, `batch-runner.ts`, `agent-core.ts`, `reports.ts`, `platform-audit/engine.ts`, `dashboard.ts`, `validation-actions.ts`, `pch-tender-line-actions.ts`, `rbac.ts`, `aiConfigured`, `medical-info-actions.ts`, `auth.ts`, `access-actions.ts`, `bd-strategic-table.tsx`, `medical-actions.ts`, `queries/messaging.ts`, `anyRoleFilter`, `smart-mail-actions.ts`, `explorer.ts`, `drive/[id]/page.tsx`, `ocrDocument`, `medical.ts`, `driver/page.tsx`, `query.ts`, `lifecycle/actions.ts`, `congress-request-actions.ts`, `mail.ts`, `scheduled.ts`, `migration-cert.ts`, `getBlob`, `brain-cockpit.tsx`, `calendar.ts`, `knowledge/actions.ts`, `risks.ts`, `library-ingest.ts`, `invariants/registry.ts`, `regulatory-actions.ts`, `rag.ts`, `field-reports.ts`, `meetings/[id]/page.tsx`, `onboarding-wizard.tsx`, `portfolio.ts`, `meetings.ts`, `admin-settings-forms.tsx`, `adventum-brain/page.tsx`, `company.ts`, `validations.ts`, `run.ts`, `aiFeatureEnabled`, `messaging-actions.ts`, `ad-pro-edit-actions.ts`, `drive-actions.ts`, `support-actions.ts`, `meeting-actions.ts`, `lib/messaging.ts`, `supplier/actions.ts`, `field-report-actions.ts`, `pch.ts`, `process-intelligence.ts`, `SessionUser`, `events.ts`, `event-actions.ts`, `withImap`, `typing/route.ts`, `entrainement/page.tsx`, `stock-snapshot-actions.ts`, `push.ts`, `feature-actions.ts`, `agents/actions.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `meetings/page.tsx`, `training/for-section.ts`, `mail-diagnostic/route.ts`, `directive-flow.test.ts`, `regulatory/page.tsx`, `supplier-auth.ts`, `dossiers.ts`, `risk-settings.ts`, `pipeline.e2e.test.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `department-budget-actions.ts`, `card.tsx`, `budget-forms.tsx`, `notifyUser`, `regulatory/[id]/page.tsx`, `getAppSettings`, `getCurrentUser`, `(app)/layout.tsx`, `badge.tsx`, `workflow/engine.ts`, `fdNum`, `rules/engine.ts`, `test-center/runner.ts`, `corpus-actions.ts`, `assistant-actions.ts`, `recordAudit`, `userCan`, `formatDateTime`, `sponsoring-actions.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `toNumber`, `market-research.ts`, `molecule.ts`, `regAudit`, `onlyofficeConfigured`, `corpus/actions.ts`, `sales-planning-actions.ts`, `promo-material-actions.ts`, `lib/ai.ts`, `departments.ts`, `intelligence/actions.ts`, `reports.ts`, `platform-audit/engine.ts`, `document-preview.tsx`, `dashboard.ts`, `button.tsx`, `validation-actions.ts`, `pch-tender-line-actions.ts`, `aiConfigured`, `medical-info-actions.ts`, `access-actions.ts`, `medical-actions.ts`, `anpp-process.tsx`, `smart-mail-actions.ts`, `drive/[id]/page.tsx`, `ocrDocument`, `messenger.tsx`, `lifecycle/actions.ts`, `congress-request-actions.ts`, `brain-cockpit.tsx`, `dossiers/[id]/panel.tsx`, `knowledge/actions.ts`, `regulatory-actions.ts`, `mail-client.tsx`, `onboarding-wizard.tsx`, `run.ts`, `aiFeatureEnabled`, `info-panel.tsx`, `messaging-actions.ts`, `ad-pro-edit-actions.ts`, `drive-actions.ts`, `support-actions.ts`, `molecule-panel.tsx`, `meeting-actions.ts`, `lib/messaging.ts`, `supplier/actions.ts`, `field-report-actions.ts`, `tender-lines.tsx`, `SessionUser`, `event-actions.ts`, `stock-snapshot-actions.ts`, `feature-actions.ts`, `agents/actions.ts`, `reminder-actions.ts`, `directive-flow.test.ts`, `dossiers.ts`, `test-center-client.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `requireUser`, `lib/labels.ts`, `department-budget-actions.ts`, `card.tsx`, `budget-forms.tsx`, `notifyUser`, `regulatory/[id]/page.tsx`, `getAppSettings`, `SessionUser`, `(app)/layout.tsx`, `badge.tsx`, `event-actions.ts`, `tender-lines.tsx`, `typing/route.ts`, `fdNum`, `stock-snapshot-actions.ts`, `assistant-actions.ts`, `field-report-actions.ts`, `recordAudit`, `formatCurrency`, `today.ts`, `prisma.ts`, `reminder-actions.ts`, `sponsoring-actions.ts`, `utils.ts`, `messaging/messages/route.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `toNumber`, `mail-diagnostic/route.ts`, `directive-flow.test.ts`, `regulatory/page.tsx`, `market-research.ts`, `molecule.ts`, `pilotage/page.tsx`, `dossiers.ts`, `assistant.ts`, `onlyofficeConfigured`, `product-explorer.tsx`, `sales-planning-actions.ts`, `promo-material-actions.ts`, `lib/ai.ts`, `departments.ts`, `adoption.ts`, `drive/page.tsx`, `dashboard.ts`, `validation-actions.ts`, `pch-tender-line-actions.ts`, `rbac.ts`, `medical-info-actions.ts`, `access-actions.ts`, `medical-actions.ts`, `queries/messaging.ts`, `anyRoleFilter`, `drive/[id]/page.tsx`, `ocrDocument`, `medical.ts`, `driver/page.tsx`, `congress-request-actions.ts`, `getBlob`, `calendar.ts`, `regulatory-actions.ts`, `field-reports.ts`, `mail-client.tsx`, `adventum-brain/page.tsx`, `validations.ts`, `aiFeatureEnabled`, `messaging-actions.ts`, `ad-pro-edit-actions.ts`, `drive-actions.ts`, `support-actions.ts`, `molecule-panel.tsx`, `meeting-actions.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1247 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04425902412479594 - nodes in this community are weakly interconnected._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.039456597742483265 - nodes in this community are weakly interconnected._
- **Should `lib/labels.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.025836758661186142 - nodes in this community are weakly interconnected._