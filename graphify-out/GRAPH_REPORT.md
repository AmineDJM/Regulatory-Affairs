# Graph Report - src  (2026-08-07)

## Corpus Check
- 942 files · ~672,017 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5760 nodes · 22661 edges · 177 communities (171 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ed2b1351`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- toNumber
- utils.ts
- userCan
- lib/session.ts
- requireModule
- hasGlobalView
- prisma.ts
- getCurrentUser
- brain-cockpit.tsx
- budget-forms.tsx
- lib/labels.ts
- anyRoleFilter
- requireUser
- rbac.ts
- batch-runner.ts
- rules/engine.ts
- canAccessEntity
- lib/ai.ts
- build-facts.ts
- aiConfigured
- fdStr
- FindingInput
- jobs/runner.ts
- admin-request-actions.ts
- care-actions.ts
- access-actions.ts
- test-center/runner.ts
- entity-access.ts
- [dossierId]/page.tsx
- department-budget-actions.ts
- assistant-actions.ts
- cn
- dossier-actions.ts
- library-actions.ts
- molecule.ts
- docgen/actions.ts
- promo-material-actions.ts
- upload/session.ts
- mistral-ocr.ts
- regAudit
- assistant.ts
- market-research.ts
- ingest-dossier.ts
- adoption.ts
- message-thread.tsx
- agent-core.ts
- platform-audit/engine.ts
- messaging-actions.ts
- corpus/page.tsx
- anpp-process.tsx
- object-storage.ts
- test-center/page.tsx
- onlyoffice.ts
- currentCompanyWhere
- ad-pro-item-actions.ts
- (app)/validations/page.tsx
- medical-info-actions.ts
- ocr-engine.ts
- aujourdhui/page.tsx
- competition.ts
- drive-actions.ts
- queries/messaging.ts
- features.ts
- workflow-builder.tsx
- molecule-panel.tsx
- congress-request-actions.ts
- (app)/layout.tsx
- medical-actions.ts
- sectionByCode
- calendar.ts
- mail.ts
- smart-mail-actions.ts
- market/engine.ts
- extract-text.ts
- explorer.ts
- workflow/engine.ts
- workflow.ts
- messenger.tsx
- lifecycle/actions.ts
- departments-manager.tsx
- support-actions.ts
- portfolio.ts
- migration-cert.ts
- getBlob
- supplier/actions.ts
- enregistrement/page.tsx
- finances/page.tsx
- pch-tender-line-actions.ts
- budget-envelope-actions.ts
- rag.ts
- library-ingest.ts
- getMarketData
- read-figures.ts
- meetings.ts
- admin-settings-forms.tsx
- courses-board.tsx
- drive/page.tsx
- corpus-import.tsx
- regulatory-actions.ts
- invariants/registry.ts
- pch/export/route.ts
- mail-client.tsx
- company.ts
- document-preview.tsx
- messaging/messages/route.ts
- requests/page.tsx
- drive/[id]/page.tsx
- lib/messaging.ts
- upload-manager.tsx
- corpus/actions.ts
- directive-actions.ts
- edit-product.tsx
- run.ts
- topbar.tsx
- departments.ts
- office-templates.ts
- process-intelligence.ts
- event-actions.ts
- onboarding-wizard.tsx
- queries/drive.ts
- compare-versions.ts
- pipeline.upload.e2e.test.ts
- field-reports.ts
- regulatory-table.tsx
- stock-snapshot-actions.ts
- lib/ad-pro-edit.ts
- budgets/export/route.ts
- push.ts
- regulatory-request-actions.ts
- assistant-files.ts
- hr-documents.ts
- bd.ts
- mail-actions.ts
- background-upload.tsx
- reminder-actions.ts
- getMessage
- radar.ts
- regulatory-drive-mirror.ts
- stocks/page.tsx
- company-actions.ts
- field-reports/page.tsx
- meetings/page.tsx
- auth-actions.ts
- supplier-auth.ts
- mail-diagnostic/route.ts
- regulatory/page.tsx
- admin-delete-actions.ts
- withImap
- fetch-source.ts
- scheduled.ts
- Adventum Autonomous Test Center — architecture
- message/route.ts
- file/route.ts
- org-chart-editor.tsx
- zip-viewer.tsx
- mobile-tabbar.tsx
- client-bundle-guard.test.ts
- manufacturing-stage.ts
- ProductExplorer
- push-register.tsx
- watch-schedule.ts
- [token]/route.ts
- messages-indicator.tsx
- next-auth.d.ts
- notification-chime.tsx
- attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 605 edges
2. `userCan()` - 459 edges
3. `fdStr()` - 450 edges
4. `recordAudit()` - 393 edges
5. `prisma` - 386 edges
6. `requireModule()` - 216 edges
7. `hasGlobalView()` - 159 edges
8. `Button` - 157 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
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

## Communities (177 total, 6 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.03
Nodes (119): GrantOption, RowGrantsProps, Option, RuleDTO, MONTH_LABELS, SheetMode, WEEKDAYS, DoctorOpt (+111 more)

### Community 1 - "toNumber"
Cohesion: 0.04
Nodes (118): FieldDefDTO, CustomFieldsPage(), BD_DOC_CATEGORIES, BdProjectDetailPage(), ProjectStatusBadge(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage() (+110 more)

### Community 2 - "utils.ts"
Cohesion: 0.05
Nodes (100): ACTION_COLS, ACTION_LABELS, Opt, dynamic, CorbeillePage(), dynamic, TrashItem, TrashList() (+92 more)

### Community 3 - "userCan"
Cohesion: 0.04
Nodes (127): POST(), FieldsManager(), ActiveToggle(), ImpersonateButton(), PresentationCard(), Res, EditTransactionSheet(), PayButton() (+119 more)

### Community 4 - "lib/session.ts"
Cohesion: 0.03
Nodes (108): AccessUser, UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, ActivityPage(), fmtDuration() (+100 more)

### Community 5 - "requireModule"
Cohesion: 0.03
Nodes (117): dynamic, EntitesPage(), AdminFeedbackPage(), OrganigrammePage(), AdminSuppliersPage(), AdminValidationsPage(), dec(), AdminWorkflowsPage() (+109 more)

### Community 6 - "hasGlobalView"
Cohesion: 0.04
Nodes (98): EventDetail(), EventForm(), CorbeillePage(), DirectiveDetailPage(), SubmitButton(), RevisionRequest(), RequestRow(), AdProKind (+90 more)

### Community 7 - "prisma.ts"
Cohesion: 0.05
Nodes (64): dynamic, GET(), GET(), POST(), POST(), dynamic, dynamic, POST() (+56 more)

### Community 8 - "getCurrentUser"
Cohesion: 0.05
Nodes (74): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+66 more)

### Community 9 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (70): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+62 more)

### Community 10 - "budget-forms.tsx"
Cohesion: 0.05
Nodes (71): BudgetContextBar(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+63 more)

### Community 11 - "lib/labels.ts"
Cohesion: 0.04
Nodes (71): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BudgetRow (+63 more)

### Community 12 - "anyRoleFilter"
Cohesion: 0.06
Nodes (69): CongressRequestButton(), PM_ROLES, CongressInternationalPage(), CongressNationalPage(), AffectationsPage(), dynamic, CataloguePage(), dynamic (+61 more)

### Community 13 - "requireUser"
Cohesion: 0.05
Nodes (67): PermanentDeleteButton(), PurgeOrphansButton(), SpaceSettingsButton(), DriveComments(), BU, CatalogueManager(), CHANNELS, Opt (+59 more)

### Community 14 - "rbac.ts"
Cohesion: 0.04
Nodes (51): fd(), assistantNudge(), actorFor(), form(), actorFor(), actorFor(), form(), fd() (+43 more)

### Community 15 - "batch-runner.ts"
Cohesion: 0.05
Nodes (62): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+54 more)

### Community 16 - "rules/engine.ts"
Cohesion: 0.06
Nodes (54): KIND_LABEL, Pack, Rule, RulePacksAdmin(), codeToken(), detectContainedSections(), DetectedSection, STOP (+46 more)

### Community 17 - "canAccessEntity"
Cohesion: 0.06
Nodes (63): AggNum(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3() (+55 more)

### Community 18 - "lib/ai.ts"
Cohesion: 0.06
Nodes (52): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+44 more)

### Community 19 - "build-facts.ts"
Cohesion: 0.06
Nodes (50): AssignmentMatrix(), key(), nOr0(), extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema (+42 more)

### Community 20 - "aiConfigured"
Cohesion: 0.07
Nodes (50): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+42 more)

### Community 21 - "fdStr"
Cohesion: 0.08
Nodes (54): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, ReportEditor(), SimpleReportEditor() (+46 more)

### Community 22 - "FindingInput"
Cohesion: 0.10
Nodes (43): ACTIONS, accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing() (+35 more)

### Community 23 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (53): splitTextIntoChunksWithOffsets(), buildPrompt(), reviewDocumentText(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily() (+45 more)

### Community 24 - "admin-request-actions.ts"
Cohesion: 0.06
Nodes (55): RuleControls(), RuleEditor(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+47 more)

### Community 25 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 26 - "access-actions.ts"
Cohesion: 0.07
Nodes (44): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), ModuleAccessGrid(), AccessMatrix(), RowGrants() (+36 more)

### Community 27 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (44): Severity, base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+36 more)

### Community 28 - "entity-access.ts"
Cohesion: 0.08
Nodes (46): GET(), Props, SearchPage(), Target, executeReadTool(), isRequestOwner(), addDays(), bdSection() (+38 more)

### Community 29 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (46): AgentItem, AgentsPanel(), RunState, CostTable(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow (+38 more)

### Community 30 - "department-budget-actions.ts"
Cohesion: 0.11
Nodes (41): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), DepartmentBudgetTable(), HrConsumption(), DepartmentBudgetsPage(), dynamic (+33 more)

### Community 31 - "assistant-actions.ts"
Cohesion: 0.10
Nodes (44): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+36 more)

### Community 32 - "cn"
Cohesion: 0.06
Nodes (35): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+27 more)

### Community 33 - "dossier-actions.ts"
Cohesion: 0.09
Nodes (40): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+32 more)

### Community 34 - "library-actions.ts"
Cohesion: 0.08
Nodes (37): dynamic, metadata, PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment (+29 more)

### Community 35 - "molecule.ts"
Cohesion: 0.12
Nodes (41): MarketProductsPage(), SuggestField(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, analyzeMoleculeSafe(), canonicalForm(), dosageMatches() (+33 more)

### Community 36 - "docgen/actions.ts"
Cohesion: 0.08
Nodes (37): DocgenPanel(), GenDoc, Template, FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateDocumentAction(), generateFindingsReportAction() (+29 more)

### Community 37 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 38 - "upload/session.ts"
Cohesion: 0.09
Nodes (36): dynamic, runtime, DELETE(), dynamic, GET(), runtime, scope(), IngestResult (+28 more)

### Community 39 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (34): backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt(), defaultMaxPages(), lowConfidenceThreshold(), maxAttempts() (+26 more)

### Community 40 - "regAudit"
Cohesion: 0.10
Nodes (35): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+27 more)

### Community 41 - "assistant.ts"
Cohesion: 0.07
Nodes (40): dynamic, maxDuration, runtime, callClaudeStream(), activeUserId(), AssistantActionKind, AssistantStreamEvent, asStr() (+32 more)

### Community 42 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 43 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (36): dynamic, maxDuration, runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip(), ingestDossierZipFromFile() (+28 more)

### Community 44 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 45 - "message-thread.tsx"
Cohesion: 0.10
Nodes (32): MessageAttachments(), Attachments(), ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), Composer() (+24 more)

### Community 46 - "agent-core.ts"
Cohesion: 0.10
Nodes (26): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+18 more)

### Community 47 - "platform-audit/engine.ts"
Cohesion: 0.09
Nodes (35): GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage(), NAVIGATION, buildPrompt(), fmtFinding() (+27 more)

### Community 48 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+28 more)

### Community 49 - "corpus/page.tsx"
Cohesion: 0.11
Nodes (30): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+22 more)

### Community 50 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (33): RegulatoryChecklist(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), isRegChecklistKey(), isRegStepKey() (+25 more)

### Community 51 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 52 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (27): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+19 more)

### Community 53 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (28): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+20 more)

### Community 54 - "currentCompanyWhere"
Cohesion: 0.09
Nodes (31): d10(), LogisticsRow(), Res, TenderLogistics(), CompanyLite, companyWhere(), currentCompanyWhere(), AbsenceRow (+23 more)

### Community 55 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (27): AdProItemsPanel(), Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem() (+19 more)

### Community 56 - "(app)/validations/page.tsx"
Cohesion: 0.09
Nodes (27): FeedbackPage(), dynamic, metadata, NoAccessPage(), ValidationsPage(), ValidationAttachments(), ValidationDecision(), Decision (+19 more)

### Community 57 - "medical-info-actions.ts"
Cohesion: 0.16
Nodes (27): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+19 more)

### Community 58 - "ocr-engine.ts"
Cohesion: 0.12
Nodes (24): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+16 more)

### Community 59 - "aujourdhui/page.tsx"
Cohesion: 0.12
Nodes (22): AssistantPage(), dynamic, dynamic, TodayPage(), MorningBrief(), refreshMyBrief(), sttConfigured(), CalendarEventDTO (+14 more)

### Community 60 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 61 - "drive-actions.ts"
Cohesion: 0.16
Nodes (26): ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions(), Props, UserLite (+18 more)

### Community 62 - "queries/messaging.ts"
Cohesion: 0.13
Nodes (25): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+17 more)

### Community 63 - "features.ts"
Cohesion: 0.12
Nodes (23): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), dynamic, RootPage() (+15 more)

### Community 64 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 65 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 66 - "congress-request-actions.ts"
Cohesion: 0.23
Nodes (27): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+19 more)

### Community 67 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (20): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+12 more)

### Community 68 - "medical-actions.ts"
Cohesion: 0.13
Nodes (28): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), EditVisitSheet(), createDoctor(), createInstitution(), createSpecialty() (+20 more)

### Community 69 - "sectionByCode"
Cohesion: 0.12
Nodes (23): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+15 more)

### Community 70 - "calendar.ts"
Cohesion: 0.16
Nodes (25): CalendarView(), colorOf(), CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+17 more)

### Community 71 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 72 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 73 - "market/engine.ts"
Cohesion: 0.18
Nodes (23): dominantOrigin(), enrichLineById(), matchOurProduct(), parseBoxSize(), allowedMfg(), allTokensIn(), bucket(), CompetitionRow (+15 more)

### Community 74 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 75 - "explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 76 - "workflow/engine.ts"
Cohesion: 0.14
Nodes (25): AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), ensureInstance(), entityPath(), EntitySummary (+17 more)

### Community 77 - "workflow.ts"
Cohesion: 0.13
Nodes (20): Props, BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity(), loadOutcome() (+12 more)

### Community 78 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+14 more)

### Community 79 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 80 - "departments-manager.tsx"
Cohesion: 0.17
Nodes (22): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+14 more)

### Community 81 - "support-actions.ts"
Cohesion: 0.16
Nodes (21): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+13 more)

### Community 82 - "portfolio.ts"
Cohesion: 0.15
Nodes (20): MyPortfolioCard(), ProductList(), getFieldReportsAggregation(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT (+12 more)

### Community 83 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 84 - "getBlob"
Cohesion: 0.15
Nodes (18): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), GET() (+10 more)

### Community 85 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 86 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 87 - "finances/page.tsx"
Cohesion: 0.13
Nodes (18): ComptaCockpit(), RecettesDepensesChart(), ImportTransactionsButton(), LedgerTable(), Result, DONUT_COLORS, FINANCE_CATEGORY, FINANCE_DIRECTION (+10 more)

### Community 88 - "pch-tender-line-actions.ts"
Cohesion: 0.17
Nodes (20): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+12 more)

### Community 89 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (22): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+14 more)

### Community 90 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 91 - "library-ingest.ts"
Cohesion: 0.17
Nodes (19): rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+11 more)

### Community 92 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 93 - "read-figures.ts"
Cohesion: 0.14
Nodes (20): BINDING, INGESTIBLE, sourcesForModule(), buildFigureCall(), DEFECT_KINDS, FIGURE_KINDS, FIGURE_SCHEMA, FigureKind (+12 more)

### Community 94 - "meetings.ts"
Cohesion: 0.16
Nodes (15): dynamic, GET(), externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin() (+7 more)

### Community 95 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 96 - "courses-board.tsx"
Cohesion: 0.16
Nodes (16): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt, CoursesPage(), MissionActions() (+8 more)

### Community 97 - "drive/page.tsx"
Cohesion: 0.15
Nodes (17): DocumentRow, DocumentsTable(), DocumentsPage(), DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize() (+9 more)

### Community 98 - "corpus-import.tsx"
Cohesion: 0.19
Nodes (16): ACCEPT, AUTHORITIES, CorpusImport(), Row, importCorpusFileAction(), codeFromTitle(), CORPUS_IMPORT_EXTS, CorpusImportExt (+8 more)

### Community 99 - "regulatory-actions.ts"
Cohesion: 0.17
Nodes (18): VariationDTO, VariationPanel(), createRegulatoryProduct(), createVariation(), deleteVariation(), normalizeDci(), parseProductChannel(), regSupervisorRoles() (+10 more)

### Community 100 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): PERMISSIONS, InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+5 more)

### Community 101 - "pch/export/route.ts"
Cohesion: 0.17
Nodes (14): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+6 more)

### Community 102 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 103 - "company.ts"
Cohesion: 0.25
Nodes (16): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+8 more)

### Community 104 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 105 - "messaging/messages/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+5 more)

### Community 106 - "requests/page.tsx"
Cohesion: 0.25
Nodes (15): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), REG_REQUEST_CATEGORY, REG_REQUEST_STATUS, getRegRequest(), listRegRequests() (+7 more)

### Community 107 - "drive/[id]/page.tsx"
Cohesion: 0.18
Nodes (10): ConvertPdfButton(), DriveCommentItem, FileActions(), DriveFilePage(), humanSize(), CUSTOM_ENTITY_TYPES, CustomValues, getFieldDefs() (+2 more)

### Community 108 - "lib/messaging.ts"
Cohesion: 0.16
Nodes (14): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+6 more)

### Community 109 - "upload-manager.tsx"
Cohesion: 0.19
Nodes (13): humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob, UploadPhase, UploadProvider() (+5 more)

### Community 110 - "corpus/actions.ts"
Cohesion: 0.23
Nodes (11): Citation, CorpusAdmin(), Source, Version, canManage(), createCorpusSourceVersion(), Result, searchCorpusAction() (+3 more)

### Community 111 - "directive-actions.ts"
Cohesion: 0.26
Nodes (14): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+6 more)

### Community 112 - "edit-product.tsx"
Cohesion: 0.20
Nodes (13): DciAssociationField(), EditProductButton(), EditProductValues, UserOption, NewProductButton(), UserOption, SelectField(), ActionResult (+5 more)

### Community 113 - "run.ts"
Cohesion: 0.18
Nodes (12): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), OutputSchema, PERSPECTIVES, PerspectiveSchema (+4 more)

### Community 114 - "topbar.tsx"
Cohesion: 0.17
Nodes (11): Company, CompanySwitcher(), NotificationPopup(), Popup, ADOPTION_TONE, GROUP_ORDER, Topbar(), setCompanyScope() (+3 more)

### Community 115 - "departments.ts"
Cohesion: 0.22
Nodes (13): buildTree(), DeptLite, EmpLite, getDepartmentMembers(), getDepartmentSubtreeIds(), getDepartmentTree(), getDepartmentUserIds(), getManagementChain() (+5 more)

### Community 116 - "office-templates.ts"
Cohesion: 0.20
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 117 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 118 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 119 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 120 - "queries/drive.ts"
Cohesion: 0.25
Nodes (14): DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow, DriveSpaceTab, getDriveListing(), getDriveSpacesForUser(), nodeArgs() (+6 more)

### Community 121 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 122 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.21
Nodes (13): runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), releaseDossierBlobs(), buildMessyDossierZip() (+5 more)

### Community 123 - "field-reports.ts"
Cohesion: 0.15
Nodes (12): HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem (+4 more)

### Community 124 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (11): CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, RegulatoryRow, STAGE_CLASS (+3 more)

### Community 125 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 126 - "lib/ad-pro-edit.ts"
Cohesion: 0.19
Nodes (11): AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS, describeChanges(), EDITABLE_FIELDS, normalize(), direction (+3 more)

### Community 127 - "budgets/export/route.ts"
Cohesion: 0.30
Nodes (8): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, EnvelopesGrandTotal

### Community 128 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 129 - "regulatory-request-actions.ts"
Cohesion: 0.29
Nodes (10): RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible(), parseCategory(), parsePriority(), parseStatus() (+2 more)

### Community 130 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 131 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 132 - "bd.ts"
Cohesion: 0.25
Nodes (10): BusinessDevelopmentPage(), BdProductDTO, BdProjectDTO, BdRangeDTO, bdSummary(), dec(), getBdProject(), getBdProjects() (+2 more)

### Community 133 - "mail-actions.ts"
Cohesion: 0.33
Nodes (10): ConnectMailbox(), connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), closeMailConnection(), encryptSecret(), getMailAccount() (+2 more)

### Community 134 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 135 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 136 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 137 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 138 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 139 - "stocks/page.tsx"
Cohesion: 0.24
Nodes (7): dynamic, esc(), GET(), StocksPage(), SnapshotDTO, getProductOptions(), ProductOption

### Community 140 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 141 - "field-reports/page.tsx"
Cohesion: 0.31
Nodes (8): NewReportButton(), FieldReportsOverviewPage(), dynamic, FieldReportsPage(), canViewFieldReportsOverview(), getFieldReportsOverview(), getMyFieldReports(), viewsAllReports()

### Community 142 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 143 - "auth-actions.ts"
Cohesion: 0.22
Nodes (7): ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, changePassword(), doSignOut()

### Community 144 - "supplier-auth.ts"
Cohesion: 0.31
Nodes (9): SupplierLoginPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession (+1 more)

### Community 145 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 146 - "regulatory/page.tsx"
Cohesion: 0.39
Nodes (8): RegulatoryProcess(), regStage(), RegulatoryPage(), SuppliersManager(), isRegulatorySupervisor(), regProgress, regStepStatus(), regTreatmentStarted()

### Community 147 - "admin-delete-actions.ts"
Cohesion: 0.36
Nodes (8): delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord(), superAdminDelete()

### Community 148 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 149 - "fetch-source.ts"
Cohesion: 0.44
Nodes (7): extOf(), FetchedSource, fetchSource(), findPdfLink(), get(), htmlToText(), ImportedSection

### Community 150 - "scheduled.ts"
Cohesion: 0.42
Nodes (8): pollAiBatches(), pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 151 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 152 - "message/route.ts"
Cohesion: 0.32
Nodes (6): dynamic, GET(), dynamic, GET(), friendlyMailError(), MailMessage

### Community 153 - "file/route.ts"
Cohesion: 0.43
Nodes (7): POST(), dynamic, GET(), readDocEditToken(), readEditToken(), secret(), verifyJwt()

### Community 154 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 155 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 156 - "mobile-tabbar.tsx"
Cohesion: 0.46
Nodes (6): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY

### Community 157 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 158 - "manufacturing-stage.ts"
Cohesion: 0.46
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 159 - "ProductExplorer"
Cohesion: 0.29
Nodes (7): fmtDzd(), fmtPct(), fmtUsd(), pctTone(), ProductExplorer(), asForm(), searchMarketProducts()

### Community 160 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 161 - "watch-schedule.ts"
Cohesion: 0.48
Nodes (6): extractDocumentLinks(), watchAnppPages(), alertRegulatory(), isDue(), runAnppWatchIfDue(), watchEnabled()

### Community 162 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 163 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 164 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 165 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 166 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 167 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 168 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1153 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `toNumber`, `utils.ts`, `userCan`, `lib/session.ts`, `requireModule`, `hasGlobalView`, `getCurrentUser`, `brain-cockpit.tsx`, `budget-forms.tsx`, `lib/labels.ts`, `anyRoleFilter`, `requireUser`, `rbac.ts`, `batch-runner.ts`, `rules/engine.ts`, `canAccessEntity`, `lib/ai.ts`, `build-facts.ts`, `aiConfigured`, `fdStr`, `jobs/runner.ts`, `admin-request-actions.ts`, `care-actions.ts`, `access-actions.ts`, `test-center/runner.ts`, `entity-access.ts`, `[dossierId]/page.tsx`, `department-budget-actions.ts`, `assistant-actions.ts`, `cn`, `dossier-actions.ts`, `library-actions.ts`, `docgen/actions.ts`, `promo-material-actions.ts`, `upload/session.ts`, `regAudit`, `assistant.ts`, `market-research.ts`, `ingest-dossier.ts`, `adoption.ts`, `agent-core.ts`, `platform-audit/engine.ts`, `messaging-actions.ts`, `corpus/page.tsx`, `test-center/page.tsx`, `onlyoffice.ts`, `currentCompanyWhere`, `ad-pro-item-actions.ts`, `(app)/validations/page.tsx`, `medical-info-actions.ts`, `aujourdhui/page.tsx`, `drive-actions.ts`, `queries/messaging.ts`, `features.ts`, `workflow-builder.tsx`, `congress-request-actions.ts`, `(app)/layout.tsx`, `medical-actions.ts`, `calendar.ts`, `mail.ts`, `smart-mail-actions.ts`, `explorer.ts`, `workflow/engine.ts`, `workflow.ts`, `lifecycle/actions.ts`, `departments-manager.tsx`, `support-actions.ts`, `portfolio.ts`, `migration-cert.ts`, `getBlob`, `supplier/actions.ts`, `finances/page.tsx`, `pch-tender-line-actions.ts`, `budget-envelope-actions.ts`, `rag.ts`, `library-ingest.ts`, `meetings.ts`, `admin-settings-forms.tsx`, `courses-board.tsx`, `drive/page.tsx`, `corpus-import.tsx`, `regulatory-actions.ts`, `invariants/registry.ts`, `pch/export/route.ts`, `company.ts`, `requests/page.tsx`, `drive/[id]/page.tsx`, `lib/messaging.ts`, `corpus/actions.ts`, `directive-actions.ts`, `run.ts`, `departments.ts`, `process-intelligence.ts`, `event-actions.ts`, `queries/drive.ts`, `compare-versions.ts`, `pipeline.upload.e2e.test.ts`, `field-reports.ts`, `stock-snapshot-actions.ts`, `push.ts`, `regulatory-request-actions.ts`, `hr-documents.ts`, `bd.ts`, `mail-actions.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `stocks/page.tsx`, `company-actions.ts`, `meetings/page.tsx`, `auth-actions.ts`, `supplier-auth.ts`, `mail-diagnostic/route.ts`, `regulatory/page.tsx`, `admin-delete-actions.ts`, `scheduled.ts`, `file/route.ts`, `watch-schedule.ts`, `[token]/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `toNumber`, `utils.ts`, `userCan`, `lib/session.ts`, `requireModule`, `hasGlobalView`, `prisma.ts`, `mail-actions.ts`, `brain-cockpit.tsx`, `budget-forms.tsx`, `regulatory-request-actions.ts`, `company-actions.ts`, `reminder-actions.ts`, `rbac.ts`, `auth-actions.ts`, `getCurrentUser`, `canAccessEntity`, `lib/ai.ts`, `admin-delete-actions.ts`, `aiConfigured`, `fdStr`, `rules/engine.ts`, `admin-request-actions.ts`, `care-actions.ts`, `access-actions.ts`, `entity-access.ts`, `department-budget-actions.ts`, `assistant-actions.ts`, `ProductExplorer`, `dossier-actions.ts`, `library-actions.ts`, `molecule.ts`, `docgen/actions.ts`, `promo-material-actions.ts`, `regAudit`, `assistant.ts`, `platform-audit/engine.ts`, `messaging-actions.ts`, `corpus/page.tsx`, `anpp-process.tsx`, `test-center/page.tsx`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `(app)/validations/page.tsx`, `medical-info-actions.ts`, `aujourdhui/page.tsx`, `drive-actions.ts`, `features.ts`, `workflow-builder.tsx`, `molecule-panel.tsx`, `congress-request-actions.ts`, `(app)/layout.tsx`, `medical-actions.ts`, `smart-mail-actions.ts`, `messenger.tsx`, `lifecycle/actions.ts`, `departments-manager.tsx`, `support-actions.ts`, `supplier/actions.ts`, `pch-tender-line-actions.ts`, `budget-envelope-actions.ts`, `corpus-import.tsx`, `regulatory-actions.ts`, `requests/page.tsx`, `lib/messaging.ts`, `corpus/actions.ts`, `directive-actions.ts`, `topbar.tsx`, `event-actions.ts`, `stock-snapshot-actions.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `button.tsx`, `toNumber`, `utils.ts`, `lib/session.ts`, `requireModule`, `bd.ts`, `prisma.ts`, `hasGlobalView`, `brain-cockpit.tsx`, `budget-forms.tsx`, `stocks/page.tsx`, `lib/labels.ts`, `anyRoleFilter`, `company-actions.ts`, `reminder-actions.ts`, `requireUser`, `mail-diagnostic/route.ts`, `lib/ai.ts`, `regulatory/page.tsx`, `canAccessEntity`, `fdStr`, `rbac.ts`, `admin-request-actions.ts`, `care-actions.ts`, `access-actions.ts`, `entity-access.ts`, `department-budget-actions.ts`, `assistant-actions.ts`, `ProductExplorer`, `dossier-actions.ts`, `molecule.ts`, `promo-material-actions.ts`, `assistant.ts`, `market-research.ts`, `adoption.ts`, `messaging-actions.ts`, `test-center/page.tsx`, `onlyoffice.ts`, `currentCompanyWhere`, `ad-pro-item-actions.ts`, `(app)/validations/page.tsx`, `medical-info-actions.ts`, `drive-actions.ts`, `queries/messaging.ts`, `molecule-panel.tsx`, `congress-request-actions.ts`, `(app)/layout.tsx`, `medical-actions.ts`, `calendar.ts`, `departments-manager.tsx`, `support-actions.ts`, `getBlob`, `finances/page.tsx`, `pch-tender-line-actions.ts`, `budget-envelope-actions.ts`, `courses-board.tsx`, `drive/page.tsx`, `regulatory-actions.ts`, `pch/export/route.ts`, `messaging/messages/route.ts`, `requests/page.tsx`, `drive/[id]/page.tsx`, `directive-actions.ts`, `event-actions.ts`, `queries/drive.ts`, `stock-snapshot-actions.ts`, `budgets/export/route.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.029701492537313433 - nodes in this community are weakly interconnected._
- **Should `toNumber` be split into smaller, more focused modules?**
  _Cohesion score 0.03563664596273292 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054215428707905425 - nodes in this community are weakly interconnected._