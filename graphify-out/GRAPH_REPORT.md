# Graph Report - src  (2026-08-15)

## Corpus Check
- 1082 files · ~818,244 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6644 nodes · 25951 edges · 190 communities (185 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ec64a99`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- page-header.tsx
- lib/labels.ts
- utils.ts
- requireModule
- recordAudit
- fdStr
- getAppSettings
- dossier-agent.ts
- userCan
- getCompanyScope
- requireUser
- lib/session.ts
- budget.ts
- batch-runner.ts
- prisma.ts
- entities.ts
- (app)/organigramme/page.tsx
- build-facts.ts
- [dossierId]/page.tsx
- cn
- lib/ai.ts
- corpus/actions.ts
- anpp-process.tsx
- admin-request-actions.ts
- test-center/runner.ts
- aiConfigured
- training-actions.ts
- risks.ts
- jobs/runner.ts
- pilotage/page.tsx
- notifyUser
- rbac.ts
- rules/engine.ts
- events/[id]/page.tsx
- care-actions.ts
- ad-pro-item-actions.ts
- hasGlobalView
- toNumber
- FindingInput
- users/[id]/page.tsx
- regulatory/[id]/page.tsx
- topbar.tsx
- regAudit
- reserves/page.tsx
- object-storage.ts
- lib/audit.ts
- (app)/layout.tsx
- ocr-engine.ts
- entity-access.ts
- mon-espace/page.tsx
- promo-material-actions.ts
- ActionResult
- mistral-ocr.ts
- assistant.ts
- adoption.ts
- lib/department-budget.ts
- agent-core.ts
- bd-strategic-table.tsx
- messaging-actions.ts
- sectionByCode
- upload/session.ts
- market-research.ts
- platform-audit/engine.ts
- petty-cash-actions.ts
- platformScope
- message-thread.tsx
- corpus/page.tsx
- annuaire/page.tsx
- medical-info-actions.ts
- enregistrement/page.tsx
- onlyoffice.ts
- medical-actions.ts
- src/auth.ts
- workflow-builder.tsx
- competition.ts
- payment-authority.ts
- company.ts
- stream/route.ts
- drive-storage.ts
- regulatory-corpus/page.tsx
- budget-forms.tsx
- upload-manager.tsx
- queries/messaging.ts
- promo-stock-actions.ts
- scheduled.ts
- mail.ts
- smart-mail-actions.ts
- molecule.ts
- document-preview.tsx
- reports.ts
- market/engine.ts
- invariants/registry.ts
- extract-text.ts
- drive-actions.ts
- congress.ts
- progress/query.ts
- lifecycle/actions.ts
- migration-cert.ts
- lib/messaging.ts
- ad-pro/page.tsx
- calendar.ts
- drive/explorer.ts
- messenger.tsx
- general-means.ts
- sheet-import.ts
- state-machines/explorer.ts
- api/auth.ts
- product-explorer.tsx
- products.ts
- department-budget-actions.ts
- releaseBlob
- library-ingest.ts
- ingest.ts
- portfolio.ts
- budget-envelope-actions.ts
- getMarketData
- admin-settings-forms.tsx
- molecule-panel.tsx
- queries/drive.ts
- run.ts
- zip-inspector.ts
- field-reports.ts
- receipt-lines.tsx
- validation-supervision.ts
- company-actions.ts
- meetings.ts
- test-center/page.tsx
- support-actions.ts
- validations.ts
- ingest-dossier.ts
- pch.ts
- supplier/actions.ts
- corpus-actions.ts
- power-tools.ts
- office-templates.ts
- process-intelligence.ts
- ingest-catalog.ts
- s3-config.ts
- export.ts
- onboarding-wizard.tsx
- today.ts
- stock-snapshot-actions.ts
- storage.ts
- getMailAccount
- simple-pdf.ts
- push.ts
- assistant-files.ts
- callback/route.ts
- background-upload.tsx
- reminder-actions.ts
- getMessage
- radar.ts
- pch-tender-export.ts
- grouping.ts
- rbac-sheet.test.ts
- regulatory-drive-mirror.ts
- meetings/page.tsx
- supplier-auth.ts
- api/workflow.ts
- bd.ts
- mail-diagnostic/route.ts
- expense-row-actions.tsx
- auto-category.ts
- promo-material.ts
- withImap
- events.ts
- fetch-source.ts
- Adventum Autonomous Test Center — architecture
- missions.ts
- client-bundle-guard.test.ts
- mime.ts
- access-sheet.tsx
- meeting-chat.tsx
- draft.ts
- [token]/route.ts
- base
- next-auth.d.ts
- app/layout.tsx
- contacts/route.ts
- mission-stops.tsx
- formatAlgiersDisplay
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 644 edges
2. `userCan()` - 507 edges
3. `fdStr()` - 483 edges
4. `recordAudit()` - 431 edges
5. `prisma` - 424 edges
6. `requireModule()` - 226 edges
7. `hasGlobalView()` - 192 edges
8. `Button` - 169 edges
9. `formatDate()` - 150 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Group()` --calls--> `formatDateTime()`  [EXTRACTED]
  src/app/(app)/admin/versions/versions-manager.tsx → src/lib/utils.ts
- `recordFieldChanges()` --indirect_call--> `field()`  [INFERRED]
  src/lib/audit.ts → src/app/(app)/budgets/budget-forms.tsx
- `BudgetSettings()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/budgets/budget-settings.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts

## Import Cycles
- None detected.

## Communities (190 total, 5 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.02
Nodes (152): DriveStorageSettings(), Citation, Source, Version, GrantOption, RowGrants(), RowGrantsProps, Option (+144 more)

### Community 1 - "page-header.tsx"
Cohesion: 0.03
Nodes (119): AccessUser, ModuleAccessGrid(), UserModuleState, dynamic, ActivityTable(), ActivityPage(), fmtDuration(), dynamic (+111 more)

### Community 2 - "lib/labels.ts"
Cohesion: 0.02
Nodes (119): ActivityRow, TYPE, dynamic, metadata, dynamic, FEATURE_LABEL, metadata, AuditPanel() (+111 more)

### Community 3 - "utils.ts"
Cohesion: 0.06
Nodes (84): ModuleSpec, TYPES, StoragePanel(), ACTION_COLS, dynamic, dynamic, Mode, MODES (+76 more)

### Community 4 - "requireModule"
Cohesion: 0.04
Nodes (104): AccessByModulePage(), CustomFieldsPage(), AdminPage(), fmtBytes(), fmtWhen(), AdminValidationsPage(), dec(), AdminWorkflowsPage() (+96 more)

### Community 5 - "recordAudit"
Cohesion: 0.04
Nodes (92): dynamic, POST(), GET(), GET(), PermanentDeleteButton(), PurgeOrphansButton(), FieldsManager(), EditVisitSheet() (+84 more)

### Community 6 - "fdStr"
Cohesion: 0.05
Nodes (85): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, FileActions(), ReportEditor() (+77 more)

### Community 7 - "getAppSettings"
Cohesion: 0.05
Nodes (77): POST(), dynamic, POST(), dynamic, POST(), EventDetail(), EventForm(), ConnectMailbox() (+69 more)

### Community 8 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (73): DossierChatPanel(), Msg, SUGGESTIONS, Msg, SUGGESTIONS, AiTextResult, ClaudeContentBlock, ClaudeMessage (+65 more)

### Community 9 - "userCan"
Cohesion: 0.06
Nodes (73): POST(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), EditTransactionSheet(), RevisionRequest(), PayButton(), createBD() (+65 more)

### Community 10 - "getCompanyScope"
Cohesion: 0.04
Nodes (64): dynamic, maxDuration, POST(), runtime, dynamic, GET(), runtime, dynamic (+56 more)

### Community 11 - "requireUser"
Cohesion: 0.05
Nodes (68): CorbeillePage(), PresentationCard(), PresentationPanel(), Res, SpaceSettingsButton(), BU, CatalogueManager(), CHANNELS (+60 more)

### Community 12 - "lib/session.ts"
Cohesion: 0.05
Nodes (58): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+50 more)

### Community 13 - "budget.ts"
Cohesion: 0.06
Nodes (58): GET(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+50 more)

### Community 14 - "batch-runner.ts"
Cohesion: 0.05
Nodes (65): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+57 more)

### Community 15 - "prisma.ts"
Cohesion: 0.06
Nodes (34): dynamic, GET(), CheckinPage(), dynamic, CataloguePage(), dynamic, actorFor(), actorFor() (+26 more)

### Community 16 - "entities.ts"
Cohesion: 0.06
Nodes (54): GET, ASPECTS, GET, GET, GET, RESERVED, blockOf(), GET (+46 more)

### Community 17 - "(app)/organigramme/page.tsx"
Cohesion: 0.05
Nodes (58): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage() (+50 more)

### Community 18 - "build-facts.ts"
Cohesion: 0.06
Nodes (58): extractLooseJson(), repairAndParse(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS (+50 more)

### Community 19 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (58): AgentItem, AgentsPanel(), RunState, ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence() (+50 more)

### Community 20 - "cn"
Cohesion: 0.04
Nodes (52): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), CAT_LABEL, FeedTab(), fmtTime() (+44 more)

### Community 21 - "lib/ai.ts"
Cohesion: 0.06
Nodes (55): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+47 more)

### Community 22 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (48): CorpusAdmin(), CorpusImport(), CaseCard(), CaseDocRow, CaseRow, UpRow, analyzeEmployeeContract(), CONTRACT_TYPES_UP (+40 more)

### Community 23 - "anpp-process.tsx"
Cohesion: 0.05
Nodes (56): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), RegulatoryPage(), AssignableUser, CATEGORY_OPTS, Col (+48 more)

### Community 24 - "admin-request-actions.ts"
Cohesion: 0.05
Nodes (64): RuleControls(), RuleEditor(), AttachmentValidationBlock(), RequestActions(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+56 more)

### Community 25 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (52): LaunchPanel(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), base, Certification, CertificationInput (+44 more)

### Community 26 - "aiConfigured"
Cohesion: 0.07
Nodes (55): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+47 more)

### Community 27 - "training-actions.ts"
Cohesion: 0.08
Nodes (56): dynamic, FormationsPage(), metadata, TrainingBoard(), TrainingParticipantRow, TrainingRow, decideLeave(), attachFiles() (+48 more)

### Community 28 - "risks.ts"
Cohesion: 0.06
Nodes (54): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), ageTone(), ProcessIntelligencePage(), DENIED, searchRelations() (+46 more)

### Community 29 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (58): splitTextIntoChunksWithOffsets(), buildPrompt(), reviewDocumentText(), corpusForSection(), submitVersionReviewBatch(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiBatchDefault() (+50 more)

### Community 30 - "pilotage/page.tsx"
Cohesion: 0.07
Nodes (51): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+43 more)

### Community 31 - "notifyUser"
Cohesion: 0.06
Nodes (50): AutopilotConfirm(), MessageForm(), set(), StatusActions(), useAction(), DriveCommentItem, DriveComments(), AdProKind (+42 more)

### Community 32 - "rbac.ts"
Cohesion: 0.05
Nodes (48): dynamic, esc(), GET(), dynamic, metadata, NoAccessPage(), StocksPage(), SnapshotDTO (+40 more)

### Community 33 - "rules/engine.ts"
Cohesion: 0.07
Nodes (46): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+38 more)

### Community 34 - "events/[id]/page.tsx"
Cohesion: 0.11
Nodes (43): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), PromoMaterialDetailPage() (+35 more)

### Community 35 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 36 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (48): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, Props, addAdProItem(), AdProModule, approveAdProItemOrder() (+40 more)

### Community 37 - "hasGlobalView"
Cohesion: 0.11
Nodes (49): CorbeillePage(), DirectiveDetailPage(), SubmitButton(), dynamic, EquipesPage(), AppealPanel(), ThirdPartyButton(), cancelCongressRequest() (+41 more)

### Community 38 - "toNumber"
Cohesion: 0.08
Nodes (48): Props, PaiePage(), BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity() (+40 more)

### Community 39 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 40 - "users/[id]/page.tsx"
Cohesion: 0.06
Nodes (44): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS (+36 more)

### Community 41 - "regulatory/[id]/page.tsx"
Cohesion: 0.07
Nodes (40): SupplyArticleRow, OpeningBalance, OpeningBalancesButton(), DciAssociationField(), EditProductButton(), EditProductValues, UserOption, BvItem (+32 more)

### Community 42 - "topbar.tsx"
Cohesion: 0.06
Nodes (36): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, Company, CompanySwitcher(), getCtx() (+28 more)

### Community 43 - "regAudit"
Cohesion: 0.09
Nodes (42): FindingControls(), Props, statusLabel(), Cycle, Point, RESERVE_TYPES, ReservesPanel(), Props (+34 more)

### Community 44 - "reserves/page.tsx"
Cohesion: 0.07
Nodes (40): dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, RegScopeCard() (+32 more)

### Community 45 - "object-storage.ts"
Cohesion: 0.11
Nodes (45): dynamic, GET(), runtime, RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config() (+37 more)

### Community 46 - "lib/audit.ts"
Cohesion: 0.07
Nodes (37): ActiveToggle(), ImpersonateButton(), CancelButton(), CancelButton(), updateAiSettings(), canManage(), setCompanyAccess(), attachOrphansToCompany() (+29 more)

### Community 47 - "(app)/layout.tsx"
Cohesion: 0.07
Nodes (36): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+28 more)

### Community 48 - "ocr-engine.ts"
Cohesion: 0.08
Nodes (41): MeetingRecorder(), pickMime(), dossierCost, c(), anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset() (+33 more)

### Community 49 - "entity-access.ts"
Cohesion: 0.09
Nodes (42): GET(), Props, SearchPage(), executeReadTool(), ENTITY_MODULE, isRequestOwner(), addDays(), bdSection() (+34 more)

### Community 50 - "mon-espace/page.tsx"
Cohesion: 0.07
Nodes (40): dynamic, MonDossierPage(), CancelRequestButton(), AdvanceItem, MyAdvances(), MonEspacePage(), CourseDuration(), mapsUrl() (+32 more)

### Community 51 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 52 - "ActionResult"
Cohesion: 0.10
Nodes (36): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite (+28 more)

### Community 53 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (33): backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt(), defaultMaxPages(), lowConfidenceThreshold(), maxAttempts() (+25 more)

### Community 54 - "assistant.ts"
Cohesion: 0.09
Nodes (41): callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), ExecuteResult (+33 more)

### Community 55 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 56 - "lib/department-budget.ts"
Cohesion: 0.11
Nodes (33): AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), DepartmentBudgetsPage(), dynamic (+25 more)

### Community 57 - "agent-core.ts"
Cohesion: 0.10
Nodes (26): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+18 more)

### Community 58 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (35): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+27 more)

### Community 59 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+28 more)

### Community 60 - "sectionByCode"
Cohesion: 0.09
Nodes (29): CorpusExtract, queryFor(), SECTION_HINTS, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+21 more)

### Community 61 - "upload/session.ts"
Cohesion: 0.10
Nodes (31): ingestDossierZipFromFile(), IngestResult, DEFAULT_ZIP_LIMITS, uploadViaSession(), DirectStartResult, expectedPartsFor(), uploadAllParts(), FinalizeResult (+23 more)

### Community 62 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 63 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (31): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+23 more)

### Community 64 - "petty-cash-actions.ts"
Cohesion: 0.16
Nodes (27): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+19 more)

### Community 65 - "platformScope"
Cohesion: 0.10
Nodes (27): CourseDTO, CoursesPage(), DriverPage(), DossierDetailPage(), SupportDetailPage(), actorFor(), platformScope(), getDriverMissions() (+19 more)

### Community 66 - "message-thread.tsx"
Cohesion: 0.12
Nodes (26): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, UploadedAttachment, EMOJI_PALETTE (+18 more)

### Community 67 - "corpus/page.tsx"
Cohesion: 0.10
Nodes (29): dynamic, metadata, SourceRow(), SourceWithVersion, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+21 more)

### Community 68 - "annuaire/page.tsx"
Cohesion: 0.16
Nodes (26): GET(), DirectorySheetRow, DirectorySheetView(), AnnuairePage(), dynamic, DIRECTORY_COLUMNS, DirectoryColumn, directoryExportFilename() (+18 more)

### Community 69 - "medical-info-actions.ts"
Cohesion: 0.16
Nodes (27): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+19 more)

### Community 70 - "enregistrement/page.tsx"
Cohesion: 0.10
Nodes (28): CorpusPage(), dynamic, metadata, TrainingPage(), TrainingPanel(), dynamic, dzd(), EnregistrementPage() (+20 more)

### Community 71 - "onlyoffice.ts"
Cohesion: 0.16
Nodes (25): DocumentEditPage(), dynamic, ENTITY_ROUTE, DriveEditPage(), dynamic, convertNodeToPdf(), convertConfigured(), convertDocument() (+17 more)

### Community 72 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), DeleteVisitButton(), createDoctor(), createInstitution() (+22 more)

### Community 73 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 74 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (24): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+16 more)

### Community 75 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 76 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 77 - "company.ts"
Cohesion: 0.14
Nodes (25): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+17 more)

### Community 78 - "stream/route.ts"
Cohesion: 0.12
Nodes (23): dynamic, maxDuration, runtime, dynamic, metadata, VersionsPage(), Group(), STAGE (+15 more)

### Community 79 - "drive-storage.ts"
Cohesion: 0.15
Nodes (22): DatabasesPage(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), blobChunkBytes(), blobKey() (+14 more)

### Community 80 - "regulatory-corpus/page.tsx"
Cohesion: 0.12
Nodes (22): dynamic, metadata, RegulatoryCorpusPage(), lunaEmbed(), lunaEmbedModel(), searchCorpusAction(), listCorpusSources(), activeCorpusSize() (+14 more)

### Community 81 - "budget-forms.tsx"
Cohesion: 0.15
Nodes (26): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+18 more)

### Community 82 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 83 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 84 - "promo-stock-actions.ts"
Cohesion: 0.17
Nodes (25): PromoStockPage(), StockBoard(), StockMovementRow, useRun(), createStockItem(), currentStock(), deleteStockItem(), deleteStockMovement() (+17 more)

### Community 85 - "scheduled.ts"
Cohesion: 0.13
Nodes (25): runPettyCashRechargeReminders(), pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled() (+17 more)

### Community 86 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 87 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 88 - "molecule.ts"
Cohesion: 0.18
Nodes (24): SuggestField(), marketSuggestions(), analyzeMoleculeSafe(), canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES (+16 more)

### Community 89 - "document-preview.tsx"
Cohesion: 0.14
Nodes (19): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+11 more)

### Community 90 - "reports.ts"
Cohesion: 0.15
Nodes (20): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+12 more)

### Community 91 - "market/engine.ts"
Cohesion: 0.17
Nodes (24): dominantOrigin(), enrichLineById(), matchOurProduct(), parseBoxSize(), allowedMfg(), allTokensIn(), bucket(), CompetitionRow (+16 more)

### Community 92 - "invariants/registry.ts"
Cohesion: 0.12
Nodes (16): PERMISSIONS, pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES (+8 more)

### Community 93 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+10 more)

### Community 94 - "drive-actions.ts"
Cohesion: 0.19
Nodes (21): POST(), DriveFilePage(), humanSize(), ShareRow(), AccessSheet(), createFolder(), createOfficeNode(), DENIED (+13 more)

### Community 95 - "congress.ts"
Cohesion: 0.15
Nodes (21): CongressInternationalPage(), CongressNationalPage(), SponsoringPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail() (+13 more)

### Community 96 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 97 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 98 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 99 - "lib/messaging.ts"
Cohesion: 0.13
Nodes (19): dynamic, GET(), dynamic, GET(), DOT, MyStatus(), setMessagingStatus(), CHAT_STATUS_LABEL (+11 more)

### Community 100 - "ad-pro/page.tsx"
Cohesion: 0.18
Nodes (20): AdProList(), NewRequestPicker(), AdProPage(), dynamic, AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest (+12 more)

### Community 101 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 102 - "drive/explorer.ts"
Cohesion: 0.18
Nodes (19): DriveSpacePage(), ExplorerNav(), QuickAccessList(), QuickRow, BY_EXTENSION, DRIVE_ROOT, ExplorerRow, explorerSize() (+11 more)

### Community 103 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): SendPayload, ConversationList(), Props, relativeTime(), Props, Props, bumpConversation(), Messenger() (+14 more)

### Community 104 - "general-means.ts"
Cohesion: 0.17
Nodes (22): BudgetSetter, canViewDepartmentBudget(), DeptBudgetGrant, DeptBudgetKind, editableKindsOn(), EMPTY_GRANT, mergeGrants(), pettyCashBalance (+14 more)

### Community 105 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 106 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 107 - "api/auth.ts"
Cohesion: 0.20
Nodes (18): GET, authenticate(), generateApiKey(), hashApiKey(), readBearer(), sameHash(), HandleOptions, hasAllScopes() (+10 more)

### Community 108 - "product-explorer.tsx"
Cohesion: 0.17
Nodes (20): AggNum(), fmtDzd(), dynamic, fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone() (+12 more)

### Community 109 - "products.ts"
Cohesion: 0.17
Nodes (20): dynamic, MarketProductsPage(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GalenicForm, MoleculeAnalysis (+12 more)

### Community 110 - "department-budget-actions.ts"
Cohesion: 0.22
Nodes (20): ExpenseRowActions(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), deleteDepartmentExpense(), grantFor(), headedDepartmentIds(), isMyDepartment() (+12 more)

### Community 111 - "releaseBlob"
Cohesion: 0.17
Nodes (18): releaseBlob(), flushOriginalArchives(), releaseDossierBlobs(), runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng() (+10 more)

### Community 112 - "library-ingest.ts"
Cohesion: 0.17
Nodes (19): rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+11 more)

### Community 113 - "ingest.ts"
Cohesion: 0.15
Nodes (17): dynamic, maxDuration, POST(), runtime, asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType() (+9 more)

### Community 114 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 115 - "budget-envelope-actions.ts"
Cohesion: 0.17
Nodes (21): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+13 more)

### Community 116 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 117 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 118 - "molecule-panel.tsx"
Cohesion: 0.16
Nodes (15): fmtDzd(), FoundList(), MoleculePanel(), arc(), Donut(), DonutSlice, foldTail(), INK (+7 more)

### Community 119 - "queries/drive.ts"
Cohesion: 0.17
Nodes (19): DrivePage(), DriveAccessLevel, driveBreadcrumb(), parseView(), DriveListing, DriveNodeRow, DriveSpaceTab, driveVisibilityWhere() (+11 more)

### Community 120 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 121 - "zip-inspector.ts"
Cohesion: 0.20
Nodes (19): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+11 more)

### Community 122 - "field-reports.ts"
Cohesion: 0.13
Nodes (17): FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation, FieldReportAttachmentDTO (+9 more)

### Community 123 - "receipt-lines.tsx"
Cohesion: 0.27
Nodes (16): empty(), ExistingLine, ReceiptLines(), Row, readReceipt(), ReceiptDraft, normalizeLines(), parseAmount() (+8 more)

### Community 124 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 125 - "company-actions.ts"
Cohesion: 0.19
Nodes (14): EntitiesManager(), EntityRow, PALETTE, OrphansPanel(), dynamic, EntitesPage(), canManageCompanies(), createCompany() (+6 more)

### Community 126 - "meetings.ts"
Cohesion: 0.16
Nodes (14): externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin(), utcToAlgiersInput(), appBaseUrlForMeet() (+6 more)

### Community 127 - "test-center/page.tsx"
Cohesion: 0.15
Nodes (15): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+7 more)

### Community 128 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 129 - "validations.ts"
Cohesion: 0.16
Nodes (12): actor(), CONG_STAGE, CrossValidationItem, getCrossModuleValidations(), getMyValidationRequests(), getMyValidations(), getPendingValidations(), getSupervisedValidations() (+4 more)

### Community 130 - "ingest-dossier.ts"
Cohesion: 0.16
Nodes (17): archiveQueue, attachArchive(), clampInt(), enqueueArchive(), ingestCore(), ingestStoreConcurrency(), IngestSummary, isStorable() (+9 more)

### Community 131 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 132 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 133 - "corpus-actions.ts"
Cohesion: 0.23
Nodes (13): CorpusPanel(), IngestResults, Src, WatchFindings, guard(), IngestActionResult, ingestOneSource(), ingestWave() (+5 more)

### Community 134 - "power-tools.ts"
Cohesion: 0.17
Nodes (10): ClaudeToolDef, executePowerTool(), POWER_TOOLS, PowerTool, powerToolsBriefing(), powerToolsFor(), ComptaCategoryRow, ComptaItem (+2 more)

### Community 135 - "office-templates.ts"
Cohesion: 0.20
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 136 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 137 - "ingest-catalog.ts"
Cohesion: 0.23
Nodes (14): findSource(), extractDocumentLinks(), IngestBatchResult, ingestCatalogSource(), ingestEverything(), ingestFirstWave(), IngestOneResult, ingestSources() (+6 more)

### Community 138 - "s3-config.ts"
Cohesion: 0.25
Nodes (14): ConfigDescription, ConfigSource, describeConfig(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+6 more)

### Community 139 - "export.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), regulatoryExportFilename() (+3 more)

### Community 140 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 141 - "today.ts"
Cohesion: 0.20
Nodes (12): CalendarEventDTO, getActionCenter(), resolve(), getToday(), greetingFor(), rankToday(), reasonOf(), REASONS (+4 more)

### Community 142 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 143 - "storage.ts"
Cohesion: 0.25
Nodes (10): probeUploads(), ALLOWED_EXTENSIONS, BLOCKED_DRIVE_EXTENSIONS, UPLOAD_DIR, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing() (+2 more)

### Community 144 - "getMailAccount"
Cohesion: 0.24
Nodes (10): dynamic, GET(), dynamic, GET(), dynamic, GET(), friendlyMailError(), getAttachment() (+2 more)

### Community 145 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 146 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 147 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 148 - "callback/route.ts"
Cohesion: 0.38
Nodes (8): POST(), dynamic, GET(), readDocEditToken(), readEditToken(), PREV, verifyJwt(), readFileByKey()

### Community 149 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 150 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 151 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 152 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 153 - "pch-tender-export.ts"
Cohesion: 0.29
Nodes (7): boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, TenderExportHeader, TenderExportLine, header

### Community 154 - "grouping.ts"
Cohesion: 0.33
Nodes (8): item(), GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 155 - "rbac-sheet.test.ts"
Cohesion: 0.33
Nodes (9): MODULES, actionsOfModule(), buildAccessSheet(), isRowScoped(), ModuleSheetSpec, PermissionMatrix, rolesReaching(), matrix (+1 more)

### Community 156 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 157 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 158 - "supplier-auth.ts"
Cohesion: 0.31
Nodes (9): SupplierLoginPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession (+1 more)

### Community 159 - "api/workflow.ts"
Cohesion: 0.27
Nodes (9): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView (+1 more)

### Community 160 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 161 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 162 - "expense-row-actions.tsx"
Cohesion: 0.44
Nodes (5): BudgetTargetField(), ExpensePanel(), EditableExpense, CatalogArticle, BudgetTarget

### Community 163 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 164 - "promo-material.ts"
Cohesion: 0.33
Nodes (8): CompanyLite, getPromoMaterial(), getPromoMaterials(), PromoDetail, PromoListItem, promoNames(), resolveNames(), scopePromoMaterial()

### Community 165 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 166 - "events.ts"
Cohesion: 0.25
Nodes (8): ACTIVE, buildStats(), EventDetail, EventListItem, EventStats, getEventDetail(), PublicEvent, RegistrationDTO

### Community 167 - "fetch-source.ts"
Cohesion: 0.44
Nodes (7): extOf(), FetchedSource, fetchSource(), findPdfLink(), get(), htmlToText(), ImportedSection

### Community 168 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 169 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 170 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 171 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 172 - "access-sheet.tsx"
Cohesion: 0.33
Nodes (5): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, setDepartmentBudgetAccess(), DEPT_BUDGET_LABEL

### Community 173 - "meeting-chat.tsx"
Cohesion: 0.38
Nodes (6): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), deleteMeetingMessage(), postMeetingMessage()

### Community 174 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 175 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 176 - "base"
Cohesion: 0.53
Nodes (6): base(), EditGrantedBudget(), FinalDecision(), PreliminaryDecision(), ProductAnalysis(), useRun()

### Community 177 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 178 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 179 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 180 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 181 - "formatAlgiersDisplay"
Cohesion: 0.67
Nodes (3): CalendarView(), colorOf(), formatAlgiersDisplay()

## Knowledge Gaps
- **1316 isolated node(s):** `dynamic`, `ModuleSpec`, `dynamic`, `TYPE`, `FIELD_KEY` (+1311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `button.tsx`, `page-header.tsx`, `lib/labels.ts`, `utils.ts`, `requireModule`, `recordAudit`, `fdStr`, `getAppSettings`, `dossier-agent.ts`, `userCan`, `getCompanyScope`, `requireUser`, `lib/session.ts`, `budget.ts`, `batch-runner.ts`, `entities.ts`, `(app)/organigramme/page.tsx`, `build-facts.ts`, `[dossierId]/page.tsx`, `cn`, `lib/ai.ts`, `corpus/actions.ts`, `anpp-process.tsx`, `admin-request-actions.ts`, `test-center/runner.ts`, `aiConfigured`, `training-actions.ts`, `risks.ts`, `jobs/runner.ts`, `pilotage/page.tsx`, `notifyUser`, `rbac.ts`, `rules/engine.ts`, `events/[id]/page.tsx`, `care-actions.ts`, `ad-pro-item-actions.ts`, `hasGlobalView`, `toNumber`, `users/[id]/page.tsx`, `regulatory/[id]/page.tsx`, `topbar.tsx`, `regAudit`, `reserves/page.tsx`, `lib/audit.ts`, `(app)/layout.tsx`, `entity-access.ts`, `mon-espace/page.tsx`, `promo-material-actions.ts`, `ActionResult`, `assistant.ts`, `adoption.ts`, `lib/department-budget.ts`, `agent-core.ts`, `bd-strategic-table.tsx`, `messaging-actions.ts`, `upload/session.ts`, `market-research.ts`, `platform-audit/engine.ts`, `petty-cash-actions.ts`, `platformScope`, `corpus/page.tsx`, `annuaire/page.tsx`, `medical-info-actions.ts`, `enregistrement/page.tsx`, `onlyoffice.ts`, `medical-actions.ts`, `src/auth.ts`, `workflow-builder.tsx`, `company.ts`, `stream/route.ts`, `drive-storage.ts`, `regulatory-corpus/page.tsx`, `queries/messaging.ts`, `promo-stock-actions.ts`, `scheduled.ts`, `mail.ts`, `smart-mail-actions.ts`, `reports.ts`, `invariants/registry.ts`, `drive-actions.ts`, `congress.ts`, `progress/query.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `lib/messaging.ts`, `ad-pro/page.tsx`, `calendar.ts`, `general-means.ts`, `state-machines/explorer.ts`, `api/auth.ts`, `department-budget-actions.ts`, `releaseBlob`, `library-ingest.ts`, `ingest.ts`, `portfolio.ts`, `budget-envelope-actions.ts`, `admin-settings-forms.tsx`, `queries/drive.ts`, `run.ts`, `field-reports.ts`, `receipt-lines.tsx`, `company-actions.ts`, `meetings.ts`, `test-center/page.tsx`, `support-actions.ts`, `validations.ts`, `ingest-dossier.ts`, `pch.ts`, `supplier/actions.ts`, `power-tools.ts`, `process-intelligence.ts`, `ingest-catalog.ts`, `export.ts`, `stock-snapshot-actions.ts`, `storage.ts`, `push.ts`, `callback/route.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `api/workflow.ts`, `bd.ts`, `mail-diagnostic/route.ts`, `promo-material.ts`, `events.ts`, `missions.ts`, `[token]/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `support-actions.ts`, `page-header.tsx`, `lib/labels.ts`, `supplier/actions.ts`, `recordAudit`, `fdStr`, `getAppSettings`, `corpus-actions.ts`, `userCan`, `getCompanyScope`, `dossier-agent.ts`, `lib/session.ts`, `budget.ts`, `stock-snapshot-actions.ts`, `(app)/organigramme/page.tsx`, `[dossierId]/page.tsx`, `lib/ai.ts`, `corpus/actions.ts`, `reminder-actions.ts`, `admin-request-actions.ts`, `test-center/runner.ts`, `aiConfigured`, `training-actions.ts`, `risks.ts`, `requireModule`, `notifyUser`, `rbac.ts`, `rules/engine.ts`, `events/[id]/page.tsx`, `care-actions.ts`, `ad-pro-item-actions.ts`, `hasGlobalView`, `missions.ts`, `topbar.tsx`, `regAudit`, `access-sheet.tsx`, `meeting-chat.tsx`, `lib/audit.ts`, `(app)/layout.tsx`, `reserves/page.tsx`, `entity-access.ts`, `mon-espace/page.tsx`, `promo-material-actions.ts`, `ActionResult`, `lib/department-budget.ts`, `bd-strategic-table.tsx`, `messaging-actions.ts`, `platform-audit/engine.ts`, `petty-cash-actions.ts`, `platformScope`, `medical-info-actions.ts`, `onlyoffice.ts`, `medical-actions.ts`, `workflow-builder.tsx`, `stream/route.ts`, `drive-storage.ts`, `regulatory-corpus/page.tsx`, `promo-stock-actions.ts`, `smart-mail-actions.ts`, `molecule.ts`, `reports.ts`, `drive-actions.ts`, `lifecycle/actions.ts`, `lib/messaging.ts`, `messenger.tsx`, `products.ts`, `department-budget-actions.ts`, `budget-envelope-actions.ts`, `molecule-panel.tsx`, `run.ts`, `company-actions.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `button.tsx`, `page-header.tsx`, `lib/labels.ts`, `utils.ts`, `requireModule`, `recordAudit`, `fdStr`, `getAppSettings`, `support-actions.ts`, `power-tools.ts`, `validations.ts`, `export.ts`, `lib/session.ts`, `budget.ts`, `requireUser`, `prisma.ts`, `entities.ts`, `(app)/organigramme/page.tsx`, `stock-snapshot-actions.ts`, `today.ts`, `lib/ai.ts`, `corpus/actions.ts`, `anpp-process.tsx`, `admin-request-actions.ts`, `reminder-actions.ts`, `aiConfigured`, `training-actions.ts`, `risks.ts`, `pilotage/page.tsx`, `notifyUser`, `rbac.ts`, `mail-diagnostic/route.ts`, `events/[id]/page.tsx`, `care-actions.ts`, `ad-pro-item-actions.ts`, `hasGlobalView`, `toNumber`, `api/workflow.ts`, `promo-material.ts`, `regulatory/[id]/page.tsx`, `lib/audit.ts`, `(app)/layout.tsx`, `entity-access.ts`, `mon-espace/page.tsx`, `promo-material-actions.ts`, `ActionResult`, `assistant.ts`, `adoption.ts`, `lib/department-budget.ts`, `bd-strategic-table.tsx`, `messaging-actions.ts`, `market-research.ts`, `petty-cash-actions.ts`, `platformScope`, `annuaire/page.tsx`, `medical-info-actions.ts`, `onlyoffice.ts`, `medical-actions.ts`, `stream/route.ts`, `queries/messaging.ts`, `promo-stock-actions.ts`, `molecule.ts`, `drive-actions.ts`, `congress.ts`, `lib/messaging.ts`, `ad-pro/page.tsx`, `calendar.ts`, `general-means.ts`, `api/auth.ts`, `products.ts`, `department-budget-actions.ts`, `budget-envelope-actions.ts`, `molecule-panel.tsx`, `queries/drive.ts`, `company-actions.ts`, `test-center/page.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `dynamic`, `ModuleSpec`, `dynamic` to the rest of the system?**
  _1316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.022626354969309127 - nodes in this community are weakly interconnected._
- **Should `page-header.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03436342662862 - nodes in this community are weakly interconnected._
- **Should `lib/labels.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.023517883390494855 - nodes in this community are weakly interconnected._