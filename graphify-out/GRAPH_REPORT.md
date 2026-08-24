# Graph Report - src  (2026-08-24)

## Corpus Check
- 1366 files · ~1,126,063 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 8372 nodes · 33027 edges · 260 communities (252 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e30d7f88`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- userCan
- requireUser
- button.tsx
- recordAudit
- badge.tsx
- notifyUser
- power-tools.ts
- lib/labels.ts
- getAppSettings
- lib/session.ts
- promo-material-actions.ts
- getCurrentUser
- assistant.ts
- aiConfigured
- prisma.ts
- brain-cockpit.tsx
- batch-runner.ts
- cn
- formatDate
- [dossierId]/page.tsx
- build-facts.ts
- budget.ts
- jobs/runner.ts
- toNumber
- product-explorer.tsx
- corpus-actions.ts
- meeting-actions.ts
- admin-settings-forms.tsx
- workflow/engine.ts
- formatCurrency
- rules/engine.ts
- validation-actions.ts
- FindingInput
- ad-pro-item-actions.ts
- care-actions.ts
- SessionUser
- object-storage.ts
- department-budget-actions.ts
- corpus/actions.ts
- oauth.ts
- upload/session.ts
- test-center/runner.ts
- lib/ai.ts
- (app)/validations/page.tsx
- mistral-ocr.ts
- scopeRegulatory
- rbac.ts
- message-thread.tsx
- letterhead-manager.tsx
- library-ingest.ts
- adoption.ts
- ROLE_LABELS
- create-record-button.tsx
- onlyoffice.ts
- training-board.tsx
- topbar.tsx
- messaging-actions.ts
- ocr-engine.ts
- hasGlobalView
- regAudit
- pilotage/page.tsx
- intelligence/actions.ts
- entities.ts
- platform-audit/engine.ts
- queries/messaging.ts
- stock-board.tsx
- agent-core.ts
- test-center/page.tsx
- office-supply-actions.ts
- market-research.ts
- aujourdhui/page.tsx
- regulatory-workflow.ts
- payment-request-actions.ts
- graph/provider.ts
- molecule.ts
- taches/[id]/page.tsx
- petty-cash-actions.ts
- replay/page.tsx
- drive/page.tsx
- releaseBlob
- field-reports.ts
- create-fields.ts
- access-actions.ts
- pch-tender-line-actions.ts
- settings.ts
- directory-grid.ts
- assistant-chat.tsx
- sectionByCode
- assistant-actions.ts
- lib/messaging.ts
- upload-manager.tsx
- platformScope
- src/auth.ts
- drive/upload/route.ts
- ad-pro/page.tsx
- calendar.ts
- anyRoleFilter
- medical-info-actions.ts
- microsoft-mail-actions.ts
- receipt-lines.tsx
- sales-planning-actions.ts
- payment-authority.ts
- drive-storage.ts
- moyens-generaux/page.tsx
- competition.ts
- (app)/layout.tsx
- bd-strategic-table.tsx
- courriers/page.tsx
- admin-request-actions.ts
- drive-table.tsx
- regulatory-table.tsx
- drive/[id]/page.tsx
- reserves/page.tsx
- document-request-actions.ts
- recruitment/request-flow.ts
- smart-mail-actions.ts
- reports.ts
- update-reminder.ts
- validations/paiements/[id]/page.tsx
- client.ts
- scheduled.ts
- lifecycle/actions.ts
- mail.ts
- extract-text.ts
- data-table.tsx
- form-fields.tsx
- executeReadTool
- invariants/registry.ts
- migration-cert.ts
- connection.ts
- openapi.ts
- expense-row-actions.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- portfolio.ts
- company.ts
- sheet-import.ts
- state-machines/explorer.ts
- drive-search.ts
- products.ts
- messenger.tsx
- getMarketData
- rag.ts
- features.ts
- chain-card.tsx
- purchase-section.tsx
- progress/query.ts
- regulatory/page.tsx
- reply.ts
- write.ts
- operations.ts
- ranges-manager.tsx
- market-research-actions.ts
- field-report-actions.ts
- lib/ad-pro-edit.ts
- zip-inspector.ts
- org-chart-print.ts
- mail-client.tsx
- dossier-actions.ts
- workspace.tsx
- legal/[id]/page.tsx
- pch.ts
- run.ts
- support-actions.ts
- departments.ts
- new-request-picker.tsx
- consulting-actions.ts
- document-preview.tsx
- invoice-actions.ts
- legal/lifecycle.ts
- directory-sheet.ts
- document-mirror.ts
- getMessage
- identity-board.tsx
- http.ts
- storage.ts
- budget-forms.tsx
- upload-button.tsx
- askClaudeCheap
- MicrosoftGraphMailProvider
- events.ts
- exports.ts
- stand-in.ts
- s3-config.ts
- regulatory/export/route.ts
- errors.ts
- workflow-builder.tsx
- drive-actions.ts
- onboarding-wizard.tsx
- withImap
- MailProvider
- search-everything.ts
- pch/export/route.ts
- regulatory-ia/page.tsx
- getMyCompanies
- contacts-board.tsx
- apps.ts
- department-actions.ts
- node-actions.tsx
- portail/page.tsx
- background-upload.tsx
- admin-delete-actions.ts
- simple-pdf.ts
- push.ts
- reserves/actions.ts
- file-glyph.tsx
- reminder-actions.ts
- assistant-files.ts
- imputation.ts
- radar.ts
- regulatory-drive-mirror.ts
- congress-workflow.tsx
- MailEntryPage
- product-catalog.ts
- training-panel.tsx
- payroll-cost.ts
- grouping.ts
- dossiers.ts
- departments-manager.tsx
- api/workflow.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- regulatory-corpus/page.tsx
- impersonation-actions.ts
- calendar-view.tsx
- zip-viewer.tsx
- teams-manager.tsx
- stand-in-panel.tsx
- useScrollLock
- client-bundle-guard.test.ts
- dossiers/[id]/panel.tsx
- forecast-grid.tsx
- employee-form.tsx
- corpus-import.tsx
- messages-indicator.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- mail/attachment/route.ts
- contacts/route.ts
- validation-item-review.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- listMessages
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 814 edges
2. `userCan()` - 638 edges
3. `fdStr()` - 608 edges
4. `recordAudit()` - 562 edges
5. `prisma` - 516 edges
6. `requireModule()` - 262 edges
7. `hasGlobalView()` - 223 edges
8. `Button` - 200 edges
9. `cn()` - 185 edges
10. `toNumber()` - 183 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `buildFolderTree()` --indirect_call--> `node()`  [INFERRED]
  src/lib/legal/folders.ts → src/lib/org-chart-print.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `ProductPicker()` --calls--> `setProductsRange()`  [EXTRACTED]
  src/app/(app)/admin/gammes/ranges-manager.tsx → src/lib/actions/product-range-actions.ts
- `PersonSheet()` --calls--> `setUserRanges()`  [EXTRACTED]
  src/app/(app)/admin/gammes/ranges-manager.tsx → src/lib/actions/product-range-actions.ts

## Import Cycles
- None detected.

## Communities (260 total, 8 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.04
Nodes (116): AdProOtherDetailPage(), dynamic, AccessUser, UserModuleState, AccessByModulePage(), dynamic, PermanentDeleteButton(), PurgeOrphansButton() (+108 more)

### Community 1 - "userCan"
Cohesion: 0.04
Nodes (155): POST(), POST(), ActiveToggle(), RuleEditor(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), fmt() (+147 more)

### Community 2 - "requireUser"
Cohesion: 0.03
Nodes (126): FieldsManager(), FileActions(), ShareRow(), NodeActions(), AttachToSourceButtons(), updateBDStatus(), addBdProjectComment(), createBdProduct() (+118 more)

### Community 3 - "button.tsx"
Cohesion: 0.05
Nodes (72): DriveStorageSettings(), EntityRow, PALETTE, OrphansPanel(), OrgBranch(), Citation, Source, Version (+64 more)

### Community 4 - "recordAudit"
Cohesion: 0.04
Nodes (107): dynamic, POST(), EntitiesManager(), RangeSheet(), PresentationCard(), Res, MailPieces(), SpaceSettingsButton() (+99 more)

### Community 5 - "badge.tsx"
Cohesion: 0.06
Nodes (85): dynamic, ModuleSpec, FieldDefDTO, TYPES, AdminPage(), fmtBytes(), fmtWhen(), StoragePanel() (+77 more)

### Community 6 - "notifyUser"
Cohesion: 0.04
Nodes (108): OtherDecisionPanel(), DriveComments(), TrainingBoard(), Kind, LABELS, audit(), closeAdProOtherRequest(), createAdProOtherRequest() (+100 more)

### Community 7 - "power-tools.ts"
Cohesion: 0.03
Nodes (74): ClaudeToolDef, CORPUS_TOOLS, OPEN(), clean(), DELIVERABLE_FORMATS, DELIVERABLE_TOOLS, DeliverableFormat, DeliverableSection (+66 more)

### Community 8 - "lib/labels.ts"
Cohesion: 0.03
Nodes (99): FeedbackStatusSelect(), BDPipeline(), STAGES, BDRow, BDTable(), ApprovalButtons(), ApprovalsPage(), EMPTY (+91 more)

### Community 9 - "getAppSettings"
Cohesion: 0.05
Nodes (96): POST(), dynamic, POST(), DatabasesPage(), ExpenseAckItem, ExpenseAckList(), CancelRequestButton(), HrDossier() (+88 more)

### Community 10 - "lib/session.ts"
Cohesion: 0.04
Nodes (71): dynamic, EntitesPage(), CustomFieldsPage(), dynamic, GammesPage(), AdminWorkflowsPage(), dynamic, dynamic (+63 more)

### Community 11 - "promo-material-actions.ts"
Cohesion: 0.07
Nodes (82): PromoCircuitCard(), Props, useRun(), PromoMaterialDetailPage(), CancelButton(), PromoActionPanel(), PromoFlags, Props (+74 more)

### Community 12 - "getCurrentUser"
Cohesion: 0.05
Nodes (73): GET(), GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+65 more)

### Community 13 - "assistant.ts"
Cohesion: 0.04
Nodes (80): EventDetail(), EventForm(), addRequestComment(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES, parseKind(), respondToInvite() (+72 more)

### Community 14 - "aiConfigured"
Cohesion: 0.06
Nodes (71): DossierChatPanel(), Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiConfigured(), AiTextResult, parsePdfBody() (+63 more)

### Community 15 - "prisma.ts"
Cohesion: 0.04
Nodes (36): dynamic, dynamic, dynamic, dynamic, esc(), GET(), dynamic, GET() (+28 more)

### Community 16 - "brain-cockpit.tsx"
Cohesion: 0.05
Nodes (67): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+59 more)

### Community 17 - "batch-runner.ts"
Cohesion: 0.05
Nodes (67): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+59 more)

### Community 18 - "cn"
Cohesion: 0.04
Nodes (62): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+54 more)

### Community 19 - "formatDate"
Cohesion: 0.05
Nodes (59): AdminValidationsPage(), dec(), FocusCard(), dynamic, MarketResearchListPage(), AssistantPage(), DirectivesPage(), dynamic (+51 more)

### Community 20 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (60): AgentItem, AgentsPanel(), RunState, DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime() (+52 more)

### Community 21 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 22 - "budget.ts"
Cohesion: 0.06
Nodes (55): GET(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+47 more)

### Community 23 - "jobs/runner.ts"
Cohesion: 0.06
Nodes (65): splitTextIntoChunksWithOffsets(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), enrichVersionFindings() (+57 more)

### Community 24 - "toNumber"
Cohesion: 0.08
Nodes (58): Budget(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), DossierMessageItem(), EventFundingPanel(), dynamic (+50 more)

### Community 25 - "product-explorer.tsx"
Cohesion: 0.05
Nodes (57): AggNum(), fmtDzd(), dynamic, fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone() (+49 more)

### Community 26 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (59): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+51 more)

### Community 27 - "meeting-actions.ts"
Cohesion: 0.06
Nodes (53): dynamic, GET(), EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatMessage (+45 more)

### Community 28 - "admin-settings-forms.tsx"
Cohesion: 0.06
Nodes (55): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+47 more)

### Community 29 - "workflow/engine.ts"
Cohesion: 0.06
Nodes (56): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), synthesizeCreationEvent(), WorkflowActionView, WorkflowEventView (+48 more)

### Community 30 - "formatCurrency"
Cohesion: 0.05
Nodes (48): BudgetExpenses(), AddExpenseRow(), BudgetTotalSheet(), CategoryCard(), CategorySheet(), useRun(), BudgetSettings(), BudgetTotalInfo (+40 more)

### Community 31 - "rules/engine.ts"
Cohesion: 0.07
Nodes (48): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+40 more)

### Community 32 - "validation-actions.ts"
Cohesion: 0.07
Nodes (51): RuleControls(), CentreBoard(), CentreOrder, CentreDePaiementPage(), dynamic, metadata, decideApproval(), cancelExpenseOrder() (+43 more)

### Community 33 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 34 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 35 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 36 - "SessionUser"
Cohesion: 0.08
Nodes (42): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic, GET(), DriveRow (+34 more)

### Community 37 - "object-storage.ts"
Cohesion: 0.09
Nodes (50): dynamic, GET(), runtime, RFC-3986, amzDate(), completeMultipartUpload(), config(), configuredEndpointHost() (+42 more)

### Community 38 - "department-budget-actions.ts"
Cohesion: 0.11
Nodes (46): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), addDepartmentExpense() (+38 more)

### Community 39 - "corpus/actions.ts"
Cohesion: 0.08
Nodes (39): CorpusAdmin(), CorpusImport(), CaseCard(), canManage(), createCorpusSourceVersion(), importCorpusFileAction(), Result, searchCorpusAction() (+31 more)

### Community 40 - "oauth.ts"
Cohesion: 0.09
Nodes (40): dynamic, GET(), logFailure(), Stage, dynamic, GET(), DisconnectButton(), dynamic (+32 more)

### Community 41 - "upload/session.ts"
Cohesion: 0.08
Nodes (43): dynamic, runtime, ingestDossierZipFromFile(), IngestResult, DEFAULT_ZIP_LIMITS, buildMessyDossierZip(), drainJobs(), makeDocx() (+35 more)

### Community 42 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (42): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+34 more)

### Community 43 - "lib/ai.ts"
Cohesion: 0.07
Nodes (38): dynamic, maxDuration, POST(), runtime, runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel() (+30 more)

### Community 44 - "(app)/validations/page.tsx"
Cohesion: 0.08
Nodes (38): MyRequestCard(), ValidationsPage(), SupervisionBoard(), ValidationAttachments(), ValidationDecision(), ItemReview(), pill(), VALIDATION_MODE (+30 more)

### Community 45 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 46 - "scopeRegulatory"
Cohesion: 0.09
Nodes (40): GET(), SearchPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData() (+32 more)

### Community 47 - "rbac.ts"
Cohesion: 0.06
Nodes (39): dynamic, metadata, RecrutementPage(), BusinessDevelopmentPipelinePage(), dynamic, dec(), getBdProject(), getBdProjects() (+31 more)

### Community 48 - "message-thread.tsx"
Cohesion: 0.09
Nodes (37): MessageAttachments(), MessageAttachments(), Composer(), DriveRef, Pending, Props, SendPayload, UploadedAttachment (+29 more)

### Community 49 - "letterhead-manager.tsx"
Cohesion: 0.10
Nodes (34): TYPES, EditSheet(), IconAction(), KINDS, LetterheadManager(), UploadSheet(), ChoiceTile(), LetterheadChoice() (+26 more)

### Community 50 - "library-ingest.ts"
Cohesion: 0.08
Nodes (34): canOcr(), ocrDocument(), rasterizePdf(), asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode() (+26 more)

### Community 51 - "adoption.ts"
Cohesion: 0.09
Nodes (37): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), dynamic, metadata, ADOPTION_TARGET_FIELDS (+29 more)

### Community 52 - "ROLE_LABELS"
Cohesion: 0.05
Nodes (24): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ROLE_OPTIONS, UserOpt, CreateSpaceButton(), ROLE_ENTRIES (+16 more)

### Community 53 - "create-record-button.tsx"
Cohesion: 0.08
Nodes (32): Article, Cell, emptyCell(), MultiRequestButton(), Option, NewRequestButton(), Option, AddCandidateButton() (+24 more)

### Community 54 - "onlyoffice.ts"
Cohesion: 0.11
Nodes (34): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+26 more)

### Community 55 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 56 - "topbar.tsx"
Cohesion: 0.10
Nodes (32): CommandPalette(), Item, SearchResult, Company, CompanySwitcher(), isActive(), MobileTabBar(), PRIMARY (+24 more)

### Community 57 - "messaging-actions.ts"
Cohesion: 0.11
Nodes (41): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+33 more)

### Community 58 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (36): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+28 more)

### Community 59 - "hasGlobalView"
Cohesion: 0.13
Nodes (39): GET(), CorbeillePage(), DirectiveDetailPage(), FormationsPage(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor() (+31 more)

### Community 60 - "regAudit"
Cohesion: 0.10
Nodes (35): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, regAudit(), enrichFinding(), Enrichment, EnrichmentContext (+27 more)

### Community 61 - "pilotage/page.tsx"
Cohesion: 0.13
Nodes (34): AffectationsPage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage(), dynamic, pct() (+26 more)

### Community 62 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 63 - "entities.ts"
Cohesion: 0.12
Nodes (29): GET, ASPECTS, GET, GET, GET, RESERVED, GET, GET (+21 more)

### Community 64 - "platform-audit/engine.ts"
Cohesion: 0.09
Nodes (35): PlatformIdeas(), generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding (+27 more)

### Community 65 - "queries/messaging.ts"
Cohesion: 0.09
Nodes (33): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+25 more)

### Community 66 - "stock-board.tsx"
Cohesion: 0.13
Nodes (31): dynamic, PromoStockPage(), KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow (+23 more)

### Community 67 - "agent-core.ts"
Cohesion: 0.11
Nodes (24): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+16 more)

### Community 68 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (27): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+19 more)

### Community 69 - "office-supply-actions.ts"
Cohesion: 0.14
Nodes (33): NormalizePanel(), SuppliesManager(), SupplyArticleRow, applyCatalogNormalization(), canManageCatalog(), CatalogRewrite, createSupplyArticle(), DENIED (+25 more)

### Community 70 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 71 - "aujourdhui/page.tsx"
Cohesion: 0.11
Nodes (27): AssistantPage(), dynamic, dynamic, TodayPage(), ChiefOfStaffPage(), dynamic, metadata, MorningBrief() (+19 more)

### Community 72 - "regulatory-workflow.ts"
Cohesion: 0.11
Nodes (32): RegulatoryProcess(), STATE_OPTS, StepNote(), completeStepsThrough(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP, PRESUB_GATE_STEP (+24 more)

### Community 73 - "payment-request-actions.ts"
Cohesion: 0.17
Nodes (34): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, NewPaymentButton() (+26 more)

### Community 74 - "graph/provider.ts"
Cohesion: 0.13
Nodes (27): FOLDER_LABEL, GRAPH_WELL_KNOWN, ORDER, wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw (+19 more)

### Community 75 - "molecule.ts"
Cohesion: 0.14
Nodes (30): SuggestField(), marketSuggestions(), canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES, GALENIC_FORMS (+22 more)

### Community 76 - "taches/[id]/page.tsx"
Cohesion: 0.13
Nodes (29): TaskCommentItem, TaskComments(), dynamic, TaskDossierPage(), CourseDuration(), CreateDossierButton(), mapsUrl(), TaskList() (+21 more)

### Community 77 - "petty-cash-actions.ts"
Cohesion: 0.14
Nodes (28): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), runPettyCashRechargeReminders() (+20 more)

### Community 78 - "replay/page.tsx"
Cohesion: 0.13
Nodes (27): NO_CONTENT, POST(), dynamic, metadata, ReplayPage(), asCaptured(), ICON, ReplayEvent (+19 more)

### Community 79 - "drive/page.tsx"
Cohesion: 0.14
Nodes (27): DriveCanvas(), ITEMS, NewKind, NewFolderButton(), NewOfficeButton(), DrivePage(), QuickAccessList(), QuickRow (+19 more)

### Community 80 - "releaseBlob"
Cohesion: 0.11
Nodes (29): releaseBlob(), archiveQueue, attachArchive(), clampInt(), enqueueArchive(), flushOriginalArchives(), ingestCore(), ingestDossierZip() (+21 more)

### Community 81 - "field-reports.ts"
Cohesion: 0.10
Nodes (26): dynamic, GET(), dynamic, dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut() (+18 more)

### Community 82 - "create-fields.ts"
Cohesion: 0.10
Nodes (27): AdProOtherPage(), NewRequestPicker(), ConsultingContractPage(), ConsultingPage(), PromoMaterialPage(), billingSuffix(), ConsultingMove, ConsultingState (+19 more)

### Community 83 - "access-actions.ts"
Cohesion: 0.12
Nodes (29): ModuleAccessGrid(), AccessMatrix(), RowGrants(), ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm() (+21 more)

### Community 84 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (29): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+21 more)

### Community 85 - "settings.ts"
Cohesion: 0.12
Nodes (24): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+16 more)

### Community 86 - "directory-grid.ts"
Cohesion: 0.12
Nodes (25): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, MEDICAL_SECTOR, SEGMENT_LEVEL (+17 more)

### Community 87 - "assistant-chat.tsx"
Cohesion: 0.09
Nodes (26): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+18 more)

### Community 88 - "sectionByCode"
Cohesion: 0.11
Nodes (27): dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase() (+19 more)

### Community 89 - "assistant-actions.ts"
Cohesion: 0.16
Nodes (27): dynamic, maxDuration, runtime, assistantChat(), forgetMyAssistantMemory(), maybeDistillMemory(), myAssistantThread(), myAssistantThreads() (+19 more)

### Community 90 - "lib/messaging.ts"
Cohesion: 0.10
Nodes (24): dynamic, GET(), dynamic, NO_CONTENT, POST(), dynamic, POST(), DOT (+16 more)

### Community 91 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 92 - "platformScope"
Cohesion: 0.10
Nodes (16): StocksPage(), EXECUTIVE_BRIEF_TOOLS, AlertCriticality, days(), detectExecutiveAlerts(), ExecutiveAlert, RANK, WHAT_IF_TOOLS (+8 more)

### Community 93 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 94 - "drive/upload/route.ts"
Cohesion: 0.14
Nodes (18): mimeOf(), POST(), POST(), canCreateInSpace(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict (+10 more)

### Community 95 - "ad-pro/page.tsx"
Cohesion: 0.16
Nodes (25): AdProList(), EMPTY, Filters, NewRequestPickerProps, AdProPage(), dynamic, AdProCreateData, AD_PRO_KINDS (+17 more)

### Community 96 - "calendar.ts"
Cohesion: 0.14
Nodes (22): CalendarPage(), dynamic, EXECUTIVE_READ_TOOLS, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents() (+14 more)

### Community 97 - "anyRoleFilter"
Cohesion: 0.16
Nodes (23): CongressRequestButton(), CongressInternationalPage(), CongressNationalPage(), SponsoringPage(), SponsoringRow, CongressListRow, CongressType, dec() (+15 more)

### Community 98 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+17 more)

### Community 99 - "microsoft-mail-actions.ts"
Cohesion: 0.14
Nodes (26): AttachmentBar(), Composer(), listStamp(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm() (+18 more)

### Community 100 - "receipt-lines.tsx"
Cohesion: 0.17
Nodes (25): empty(), ExistingLine, ReceiptLines(), Row, currentCashOf(), updateDepartmentExpense(), spendFromPettyCash(), readReceipt() (+17 more)

### Community 101 - "sales-planning-actions.ts"
Cohesion: 0.12
Nodes (26): BU, CatalogueManager(), CHANNELS, Opt, Prod, TeamsManager(), carryForwardAssignments(), createBusinessUnit() (+18 more)

### Community 102 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 103 - "drive-storage.ts"
Cohesion: 0.15
Nodes (23): addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), blobChunkBytes(), blobKey(), countOrphanBlobs() (+15 more)

### Community 104 - "moyens-generaux/page.tsx"
Cohesion: 0.16
Nodes (24): DepartmentBudgetsPage(), dynamic, DepartmentSwitcher(), dynamic, metadata, MoyensGenerauxPage(), canViewDepartmentBudget(), DeptBudgetKind (+16 more)

### Community 105 - "competition.ts"
Cohesion: 0.13
Nodes (27): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+19 more)

### Community 106 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (22): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+14 more)

### Community 107 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (25): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+17 more)

### Community 108 - "courriers/page.tsx"
Cohesion: 0.19
Nodes (20): mailFields(), MailFolderBar(), MailFolderRow, MailPartnersManager(), MailRow, CourriersPage(), dynamic, metadata (+12 more)

### Community 109 - "admin-request-actions.ts"
Cohesion: 0.12
Nodes (27): AttachmentValidationBlock(), RequestActions(), RequesterWindow(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, cancelAttachmentValidation(), collectAllFields() (+19 more)

### Community 110 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 111 - "regulatory-table.tsx"
Cohesion: 0.12
Nodes (20): DriveToolbar(), SettingsIcon, AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS (+12 more)

### Community 112 - "drive/[id]/page.tsx"
Cohesion: 0.11
Nodes (23): DriveCommentItem, DriveFilePage(), humanSize(), d10(), EmployeeDetailPage(), CommentItem, CustomFieldsCard(), toDateValue() (+15 more)

### Community 113 - "reserves/page.tsx"
Cohesion: 0.10
Nodes (17): dynamic, metadata, OrganigrammePage(), CorpusPage(), dynamic, metadata, SourceWithVersion, dynamic (+9 more)

### Community 114 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 115 - "recruitment/request-flow.ts"
Cohesion: 0.13
Nodes (23): NewRecruitmentButton(), ApprovalState, CANDIDATE_LABEL, CANDIDATE_ORDER, CANDIDATE_TONE, CandidateStatus, ChainDecider, ChainOutcome (+15 more)

### Community 116 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 117 - "reports.ts"
Cohesion: 0.15
Nodes (20): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+12 more)

### Community 118 - "update-reminder.ts"
Cohesion: 0.17
Nodes (21): daysAgo(), LastReminder(), ReminderPerson, sendRegulatoryUpdateReminder(), regulatoryReminderBoard(), canSendUpdateReminder(), daysSince(), isStaleDossier() (+13 more)

### Community 119 - "validations/paiements/[id]/page.tsx"
Cohesion: 0.14
Nodes (21): dynamic, PaymentRequestPage(), PaymentRequestsPage(), AskChief(), canApprove(), canResubmit(), deadlineLabel(), isOverdue() (+13 more)

### Community 120 - "client.ts"
Cohesion: 0.16
Nodes (21): buildUrl(), correlationId(), DELTA_EXPIRED, graphBinary(), graphJson(), graphRaw(), GraphRequest, HUMAN (+13 more)

### Community 121 - "scheduled.ts"
Cohesion: 0.14
Nodes (24): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+16 more)

### Community 122 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 123 - "mail.ts"
Cohesion: 0.08
Nodes (25): acquireSlot(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool, imapWaiters (+17 more)

### Community 124 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 125 - "data-table.tsx"
Cohesion: 0.13
Nodes (18): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), AuditPanel(), AuditRow, AuditTable() (+10 more)

### Community 126 - "form-fields.tsx"
Cohesion: 0.15
Nodes (18): OpeningBalance, DciAssociationField(), EditProductValues, UserOption, UserOption, SupplierRow, Field(), FieldProps (+10 more)

### Community 127 - "executeReadTool"
Cohesion: 0.11
Nodes (23): dynamic, metadata, NoAccessPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage() (+15 more)

### Community 128 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (15): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+7 more)

### Community 129 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 130 - "connection.ts"
Cohesion: 0.18
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 131 - "openapi.ts"
Cohesion: 0.17
Nodes (17): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, hasAllScopes() (+9 more)

### Community 132 - "expense-row-actions.tsx"
Cohesion: 0.18
Nodes (18): BudgetTargetField(), ExpensePanel(), EditableExpense, ExpenseRowActions(), CatalogArticle, deleteDepartmentExpense(), BudgetTarget, cashAvailable() (+10 more)

### Community 133 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 134 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 135 - "portfolio.ts"
Cohesion: 0.16
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 136 - "company.ts"
Cohesion: 0.21
Nodes (19): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+11 more)

### Community 137 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 138 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 139 - "drive-search.ts"
Cohesion: 0.18
Nodes (18): DriveSearch(), describePath(), fold(), matchesQuery(), MIN_QUERY, rankHit(), SearchHit, sortHits() (+10 more)

### Community 140 - "products.ts"
Cohesion: 0.17
Nodes (21): ProductExplorerPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GalenicForm, labKey() (+13 more)

### Community 141 - "messenger.tsx"
Cohesion: 0.17
Nodes (20): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+12 more)

### Community 142 - "getMarketData"
Cohesion: 0.14
Nodes (21): Cache, DIR, getMarketData(), IqviaRow, LabRow, loadNdjson(), MarketMeta, NomRow (+13 more)

### Community 143 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 144 - "features.ts"
Cohesion: 0.16
Nodes (17): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), dynamic, RootPage() (+9 more)

### Community 145 - "chain-card.tsx"
Cohesion: 0.19
Nodes (16): LegalChainCard(), SendToSettlementButton(), amountDrift(), CHAIN_KIND_LABEL, CHAIN_KINDS, ChainDoc, ChainKind, chainOf() (+8 more)

### Community 146 - "purchase-section.tsx"
Cohesion: 0.23
Nodes (16): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), withdrawPurchaseRequest(), canWithdraw() (+8 more)

### Community 147 - "progress/query.ts"
Cohesion: 0.16
Nodes (17): AnalysisProgressCard(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta(), pctFrac(), PHASE_LABELS (+9 more)

### Community 148 - "regulatory/page.tsx"
Cohesion: 0.18
Nodes (17): NewProductButton(), RegulatoryPage(), RegulatoryRow, SuppliersManager(), UpdateReminderButton(), effectiveTherapeuticSegments(), getRegulatoryRows(), NAMED_ON_DOSSIER() (+9 more)

### Community 149 - "reply.ts"
Cohesion: 0.18
Nodes (18): MailAddress, buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock() (+10 more)

### Community 150 - "write.ts"
Cohesion: 0.18
Nodes (19): describeMailChanges(), diffMailAssignments(), diffMailEntry(), MAIL_ASSIGNMENT_FIELDS, MAIL_TRACKED_FIELDS, MailAssignmentField, MailAssignments, MailChange (+11 more)

### Community 151 - "operations.ts"
Cohesion: 0.17
Nodes (16): GET, POST, ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), describeOperations(), getOperation(), OPERATIONS (+8 more)

### Community 152 - "ranges-manager.tsx"
Cohesion: 0.16
Nodes (17): PALETTE, PeoplePanel(), PersonRow, PersonSheet(), ProductOption, ProductPicker(), RangesManager(), buildRangeTree() (+9 more)

### Community 153 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 154 - "field-report-actions.ts"
Cohesion: 0.23
Nodes (16): DoctorPicker(), ReportEditor(), Attachments(), SimpleReportEditor(), NewReportButton(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment() (+8 more)

### Community 155 - "lib/ad-pro-edit.ts"
Cohesion: 0.16
Nodes (16): isKind(), Target, TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS (+8 more)

### Community 156 - "zip-inspector.ts"
Cohesion: 0.20
Nodes (19): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+11 more)

### Community 157 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (15): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+7 more)

### Community 158 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 159 - "dossier-actions.ts"
Cohesion: 0.20
Nodes (19): LinkToDossier(), DossierStatusControls(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage(), DossierMembers (+11 more)

### Community 160 - "workspace.tsx"
Cohesion: 0.28
Nodes (16): DocumentWorkspace(), OpenDoc, Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W (+8 more)

### Community 161 - "legal/[id]/page.tsx"
Cohesion: 0.17
Nodes (14): EditLegalButton(), dynamic, LEGAL_DOC_CATEGORIES, LegalDocumentPage(), dateInput(), legalFields(), RecordDeleteButton(), LEGAL_DOC_KIND (+6 more)

### Community 162 - "pch.ts"
Cohesion: 0.16
Nodes (18): PchTenderPage(), d10(), LogisticsRow(), Res, TenderLogistics(), PchPage(), dec(), fetchTenders() (+10 more)

### Community 163 - "run.ts"
Cohesion: 0.17
Nodes (14): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES (+6 more)

### Community 164 - "support-actions.ts"
Cohesion: 0.23
Nodes (16): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+8 more)

### Community 165 - "departments.ts"
Cohesion: 0.16
Nodes (16): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentOptions() (+8 more)

### Community 166 - "new-request-picker.tsx"
Cohesion: 0.16
Nodes (12): CongressFormProps, CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton(), CreateEventForm() (+4 more)

### Community 167 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 168 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 169 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 170 - "legal/lifecycle.ts"
Cohesion: 0.22
Nodes (14): LegalSweepResult, runLegalExpirySweep(), canCancel(), daysBetween(), daysLeft(), effectiveStatus(), expiryLevel, expiryMessage() (+6 more)

### Community 171 - "directory-sheet.ts"
Cohesion: 0.27
Nodes (16): DIRECTORY_COLUMNS, DirectoryColumn, DirectoryField, directoryHeaderRow(), DirectoryImportRow, levelFrom(), mapHeaderRow(), matchColumn() (+8 more)

### Community 172 - "document-mirror.ts"
Cohesion: 0.25
Nodes (13): POST(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder(), ensureDrivePath(), ALREADY_MIRRORED (+5 more)

### Community 173 - "getMessage"
Cohesion: 0.16
Nodes (16): dynamic, GET(), dynamic, GET(), friendlyMailError(), getMessage(), isOverloadError(), listingKey() (+8 more)

### Community 174 - "identity-board.tsx"
Cohesion: 0.21
Nodes (13): CopyButton(), IdentityBoard(), IdentitySheet(), COMPANY_DOC_CATEGORIES, CompanyDocCategory, isCompanyDocCategory(), suggestDocumentName(), filledCount() (+5 more)

### Community 175 - "http.ts"
Cohesion: 0.24
Nodes (15): ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer(), requireScopes(), sameHash(), handle() (+7 more)

### Community 176 - "storage.ts"
Cohesion: 0.23
Nodes (11): GET(), POST(), dynamic, GET(), readDocEditToken(), readEditToken(), verifyJwt(), ALLOWED_EXTENSIONS (+3 more)

### Community 177 - "budget-forms.tsx"
Cohesion: 0.22
Nodes (16): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), BudgetTotalInfo, CreateEnvelopeButton(), d10(), EnvelopeSheet(), ExpenseEditSheet() (+8 more)

### Community 178 - "upload-button.tsx"
Cohesion: 0.21
Nodes (14): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload() (+6 more)

### Community 179 - "askClaudeCheap"
Cohesion: 0.30
Nodes (14): askClaudeCheap(), ALGERIA_WILAYAS, acceptAiWilaya(), inferWilayas(), ALIASES, BY_CODE, BY_FOLDED, foldText() (+6 more)

### Community 180 - "MicrosoftGraphMailProvider"
Cohesion: 0.18
Nodes (4): draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 181 - "events.ts"
Cohesion: 0.15
Nodes (14): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+6 more)

### Community 182 - "exports.ts"
Cohesion: 0.17
Nodes (15): buildWorkbook(), canExport(), DATASETS, DatasetSpec, depositBufferToDrive(), ensurePersonalFolder(), ExportDataset, exportDatasetToDrive() (+7 more)

### Community 183 - "stand-in.ts"
Cohesion: 0.27
Nodes (13): actsFor(), day(), delegatedActions(), delegationNotice(), delegationsFor(), inactiveReason(), isDelegatable(), isDelegationActive() (+5 more)

### Community 184 - "s3-config.ts"
Cohesion: 0.26
Nodes (14): ConfigDescription, ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar() (+6 more)

### Community 185 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 186 - "errors.ts"
Cohesion: 0.17
Nodes (10): blockOf(), GET, SCALARS, schema(), API_ERROR_CODES, ApiError, ApiErrorBody, ApiErrorCode (+2 more)

### Community 187 - "workflow-builder.tsx"
Cohesion: 0.15
Nodes (9): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), PmOpt, SubmitButton(), STATUS_TONE, POWER_LABELS (+1 more)

### Community 188 - "drive-actions.ts"
Cohesion: 0.19
Nodes (12): ExplorerNav(), SpaceLite, UserLite, ConvertPdfButton(), BulkResult, collectSubtree(), copyNodes(), DENIED (+4 more)

### Community 189 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 190 - "withImap"
Cohesion: 0.18
Nodes (15): acquirePooled(), appendToSent(), classifyMailError(), decryptSecret(), dropPooled(), evictColdest(), imapBackoff(), imapClient() (+7 more)

### Community 192 - "search-everything.ts"
Cohesion: 0.25
Nodes (12): capabilities(), d10(), EverythingHit, EverythingResult, familyWhere(), FUZZY_TABLES, fuzzyIds(), matchOf() (+4 more)

### Community 193 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 194 - "regulatory-ia/page.tsx"
Cohesion: 0.21
Nodes (11): BudgetRowData, DossierBudgetRow(), Breakdown(), dynamic, fmtDateTime(), fmtUsd(), metadata, RegulatoryIaAdminPage() (+3 more)

### Community 195 - "getMyCompanies"
Cohesion: 0.27
Nodes (13): LegalIdentitiesPage(), LegalRow, dynamic, LegalPage(), metadata, AnnuairePage(), CompanyContactsPage(), OfficePage() (+5 more)

### Community 196 - "contacts-board.tsx"
Cohesion: 0.25
Nodes (7): ContactRow, ContactsBoard(), CONTACT_KIND_SUGGESTIONS, groupContactsByKind(), matchesContact(), NO_KIND_LABEL, normalizeKind()

### Community 197 - "apps.ts"
Cohesion: 0.37
Nodes (11): OfficeLauncher(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp, OfficeAppKey, officeHref() (+3 more)

### Community 198 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 199 - "node-actions.tsx"
Cohesion: 0.19
Nodes (9): ShareItem, SharePanel(), AccessSheet(), MoveTarget, Props, UserLite, SendToLegalSheet(), SendToMailSheet() (+1 more)

### Community 200 - "portail/page.tsx"
Cohesion: 0.24
Nodes (10): SupplierLoginPage(), SupplierPortalPage(), EXTERNAL_REGULATORY_STATUS, getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey() (+2 more)

### Community 201 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 202 - "admin-delete-actions.ts"
Cohesion: 0.26
Nodes (12): CREATOR_DELETABLE, CREATOR_DELETE_PERMISSION, delegateOf(), DeletableKind, deleteOwnRecord(), DeleteResult, isKind(), KindSpec (+4 more)

### Community 203 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 204 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 205 - "reserves/actions.ts"
Cohesion: 0.29
Nodes (9): Cycle, Point, RESERVE_TYPES, ReservesPanel(), approveReservePoint(), deleteReserveCycle(), guardPoint(), Result (+1 more)

### Community 206 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 207 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 208 - "assistant-files.ts"
Cohesion: 0.29
Nodes (7): withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 209 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 210 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 211 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 212 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 213 - "MailEntryPage"
Cohesion: 0.40
Nodes (8): MailEntryPage(), dateInput(), dateTimeInput(), isLinkableSource(), LINKABLE_SOURCES, sourceCaption(), sourceHref(), sourceLabel()

### Community 214 - "product-catalog.ts"
Cohesion: 0.27
Nodes (8): KIND_LABEL, OrphanRow(), MatchProposal, CatalogReconciliation, dossierLabel(), DossierOption, getCatalogReconciliation(), OrphanProduct

### Community 215 - "training-panel.tsx"
Cohesion: 0.27
Nodes (7): CaseDocRow, CaseRow, TrainingPanel(), UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 216 - "payroll-cost.ts"
Cohesion: 0.40
Nodes (8): basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost(), num(), PayrollCostInput, payrollMass()

### Community 217 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 218 - "dossiers.ts"
Cohesion: 0.33
Nodes (8): DossierDetailPage(), DossiersPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), getDossiers(), isDossierMember()

### Community 219 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 220 - "api/workflow.ts"
Cohesion: 0.31
Nodes (8): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView

### Community 221 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 222 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 223 - "regulatory-corpus/page.tsx"
Cohesion: 0.39
Nodes (7): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), listRulePacks(), activeRuleCount()

### Community 224 - "impersonation-actions.ts"
Cohesion: 0.36
Nodes (5): ImpersonateButton(), ImpersonationBanner(), startImpersonation(), stopImpersonation(), IMPERSONATE_COOKIE

### Community 225 - "calendar-view.tsx"
Cohesion: 0.32
Nodes (6): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay()

### Community 226 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 227 - "teams-manager.tsx"
Cohesion: 0.29
Nodes (6): Cap, Kam, KamRow(), numOrNull(), Opt, Team

### Community 228 - "stand-in-panel.tsx"
Cohesion: 0.29
Nodes (7): StandInButton(), StandInDecision(), StandInModule, StandInPerson, StandInState, TONE, StandInStatus

### Community 229 - "useScrollLock"
Cohesion: 0.36
Nodes (5): NotificationPopup(), Popup, APP_SCROLL_ID, lock(), useScrollLock()

### Community 230 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 231 - "dossiers/[id]/panel.tsx"
Cohesion: 0.38
Nodes (5): DossierAssign(), DossierMessageForm(), MsgAttachment, useAction(), UserLite

### Community 232 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 233 - "employee-form.tsx"
Cohesion: 0.29
Nodes (4): EmployeeForm(), EmployeeFormValues, Option, Props

### Community 234 - "corpus-import.tsx"
Cohesion: 0.33
Nodes (4): ACCEPT, AUTHORITIES, CATEGORIES, Row

### Community 235 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 238 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 239 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 240 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 241 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 242 - "mail/attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 243 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 244 - "validation-item-review.tsx"
Cohesion: 0.50
Nodes (3): Decision, LABEL, TONE

### Community 245 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

### Community 248 - "listMessages"
Cohesion: 0.67
Nodes (3): addrStr(), listMessages(), readEnvelopes()

## Knowledge Gaps
- **1573 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1568 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `utils.ts`, `userCan`, `requireUser`, `recordAudit`, `badge.tsx`, `notifyUser`, `power-tools.ts`, `lib/labels.ts`, `getAppSettings`, `lib/session.ts`, `promo-material-actions.ts`, `getCurrentUser`, `assistant.ts`, `aiConfigured`, `brain-cockpit.tsx`, `batch-runner.ts`, `cn`, `formatDate`, `[dossierId]/page.tsx`, `build-facts.ts`, `budget.ts`, `jobs/runner.ts`, `toNumber`, `product-explorer.tsx`, `corpus-actions.ts`, `meeting-actions.ts`, `admin-settings-forms.tsx`, `workflow/engine.ts`, `formatCurrency`, `rules/engine.ts`, `validation-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `SessionUser`, `department-budget-actions.ts`, `corpus/actions.ts`, `upload/session.ts`, `test-center/runner.ts`, `lib/ai.ts`, `(app)/validations/page.tsx`, `scopeRegulatory`, `rbac.ts`, `letterhead-manager.tsx`, `library-ingest.ts`, `adoption.ts`, `ROLE_LABELS`, `onlyoffice.ts`, `messaging-actions.ts`, `hasGlobalView`, `regAudit`, `pilotage/page.tsx`, `intelligence/actions.ts`, `entities.ts`, `platform-audit/engine.ts`, `queries/messaging.ts`, `stock-board.tsx`, `agent-core.ts`, `test-center/page.tsx`, `office-supply-actions.ts`, `market-research.ts`, `aujourdhui/page.tsx`, `payment-request-actions.ts`, `taches/[id]/page.tsx`, `petty-cash-actions.ts`, `replay/page.tsx`, `drive/page.tsx`, `releaseBlob`, `field-reports.ts`, `access-actions.ts`, `pch-tender-line-actions.ts`, `settings.ts`, `directory-grid.ts`, `assistant-actions.ts`, `lib/messaging.ts`, `platformScope`, `src/auth.ts`, `drive/upload/route.ts`, `ad-pro/page.tsx`, `calendar.ts`, `anyRoleFilter`, `medical-info-actions.ts`, `microsoft-mail-actions.ts`, `receipt-lines.tsx`, `sales-planning-actions.ts`, `drive-storage.ts`, `moyens-generaux/page.tsx`, `(app)/layout.tsx`, `courriers/page.tsx`, `admin-request-actions.ts`, `drive/[id]/page.tsx`, `reserves/page.tsx`, `document-request-actions.ts`, `smart-mail-actions.ts`, `reports.ts`, `update-reminder.ts`, `validations/paiements/[id]/page.tsx`, `scheduled.ts`, `lifecycle/actions.ts`, `mail.ts`, `data-table.tsx`, `executeReadTool`, `invariants/registry.ts`, `migration-cert.ts`, `connection.ts`, `supplier/actions.ts`, `portfolio.ts`, `company.ts`, `state-machines/explorer.ts`, `drive-search.ts`, `rag.ts`, `features.ts`, `chain-card.tsx`, `purchase-section.tsx`, `progress/query.ts`, `regulatory/page.tsx`, `write.ts`, `operations.ts`, `market-research-actions.ts`, `field-report-actions.ts`, `lib/ad-pro-edit.ts`, `dossier-actions.ts`, `legal/[id]/page.tsx`, `pch.ts`, `run.ts`, `support-actions.ts`, `departments.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `legal/lifecycle.ts`, `document-mirror.ts`, `http.ts`, `storage.ts`, `events.ts`, `exports.ts`, `regulatory/export/route.ts`, `drive-actions.ts`, `search-everything.ts`, `pch/export/route.ts`, `getMyCompanies`, `department-actions.ts`, `portail/page.tsx`, `admin-delete-actions.ts`, `push.ts`, `reserves/actions.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `product-catalog.ts`, `dossiers.ts`, `api/workflow.ts`, `impersonation-actions.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `utils.ts`, `userCan`, `recordAudit`, `badge.tsx`, `notifyUser`, `lib/labels.ts`, `getAppSettings`, `lib/session.ts`, `promo-material-actions.ts`, `getCurrentUser`, `assistant.ts`, `aiConfigured`, `prisma.ts`, `brain-cockpit.tsx`, `cn`, `formatDate`, `[dossierId]/page.tsx`, `budget.ts`, `toNumber`, `corpus-actions.ts`, `meeting-actions.ts`, `rules/engine.ts`, `validation-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `SessionUser`, `department-budget-actions.ts`, `corpus/actions.ts`, `oauth.ts`, `lib/ai.ts`, `scopeRegulatory`, `letterhead-manager.tsx`, `ROLE_LABELS`, `onlyoffice.ts`, `messaging-actions.ts`, `hasGlobalView`, `regAudit`, `intelligence/actions.ts`, `platform-audit/engine.ts`, `stock-board.tsx`, `test-center/page.tsx`, `office-supply-actions.ts`, `aujourdhui/page.tsx`, `payment-request-actions.ts`, `molecule.ts`, `petty-cash-actions.ts`, `replay/page.tsx`, `drive/page.tsx`, `access-actions.ts`, `pch-tender-line-actions.ts`, `settings.ts`, `assistant-chat.tsx`, `assistant-actions.ts`, `lib/messaging.ts`, `medical-info-actions.ts`, `microsoft-mail-actions.ts`, `receipt-lines.tsx`, `sales-planning-actions.ts`, `moyens-generaux/page.tsx`, `(app)/layout.tsx`, `bd-strategic-table.tsx`, `admin-request-actions.ts`, `reserves/page.tsx`, `document-request-actions.ts`, `smart-mail-actions.ts`, `reports.ts`, `update-reminder.ts`, `validations/paiements/[id]/page.tsx`, `lifecycle/actions.ts`, `executeReadTool`, `expense-row-actions.tsx`, `supplier/actions.ts`, `products.ts`, `messenger.tsx`, `features.ts`, `purchase-section.tsx`, `operations.ts`, `market-research-actions.ts`, `field-report-actions.ts`, `lib/ad-pro-edit.ts`, `dossier-actions.ts`, `run.ts`, `support-actions.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `upload-button.tsx`, `drive-actions.ts`, `department-actions.ts`, `node-actions.tsx`, `admin-delete-actions.ts`, `reserves/actions.ts`, `reminder-actions.ts`, `dossiers.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `utils.ts`, `requireUser`, `recordAudit`, `badge.tsx`, `notifyUser`, `power-tools.ts`, `lib/labels.ts`, `getAppSettings`, `lib/session.ts`, `promo-material-actions.ts`, `getCurrentUser`, `assistant.ts`, `prisma.ts`, `brain-cockpit.tsx`, `cn`, `formatDate`, `budget.ts`, `toNumber`, `product-explorer.tsx`, `meeting-actions.ts`, `formatCurrency`, `validation-actions.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `SessionUser`, `department-budget-actions.ts`, `lib/ai.ts`, `(app)/validations/page.tsx`, `scopeRegulatory`, `rbac.ts`, `adoption.ts`, `onlyoffice.ts`, `messaging-actions.ts`, `hasGlobalView`, `pilotage/page.tsx`, `entities.ts`, `queries/messaging.ts`, `stock-board.tsx`, `test-center/page.tsx`, `office-supply-actions.ts`, `market-research.ts`, `aujourdhui/page.tsx`, `payment-request-actions.ts`, `molecule.ts`, `petty-cash-actions.ts`, `drive/page.tsx`, `field-reports.ts`, `create-fields.ts`, `access-actions.ts`, `pch-tender-line-actions.ts`, `settings.ts`, `directory-grid.ts`, `assistant-chat.tsx`, `assistant-actions.ts`, `lib/messaging.ts`, `platformScope`, `drive/upload/route.ts`, `ad-pro/page.tsx`, `calendar.ts`, `anyRoleFilter`, `medical-info-actions.ts`, `sales-planning-actions.ts`, `moyens-generaux/page.tsx`, `(app)/layout.tsx`, `bd-strategic-table.tsx`, `courriers/page.tsx`, `admin-request-actions.ts`, `drive/[id]/page.tsx`, `reserves/page.tsx`, `document-request-actions.ts`, `validations/paiements/[id]/page.tsx`, `executeReadTool`, `openapi.ts`, `products.ts`, `regulatory/page.tsx`, `write.ts`, `operations.ts`, `market-research-actions.ts`, `field-report-actions.ts`, `lib/ad-pro-edit.ts`, `dossier-actions.ts`, `legal/[id]/page.tsx`, `pch.ts`, `support-actions.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `upload-button.tsx`, `exports.ts`, `regulatory/export/route.ts`, `errors.ts`, `drive-actions.ts`, `search-everything.ts`, `pch/export/route.ts`, `getMyCompanies`, `department-actions.ts`, `admin-delete-actions.ts`, `reminder-actions.ts`, `MailEntryPage`, `dossiers.ts`, `api/workflow.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1573 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03684729064039409 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.035706914344685245 - nodes in this community are weakly interconnected._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.03476176206173209 - nodes in this community are weakly interconnected._