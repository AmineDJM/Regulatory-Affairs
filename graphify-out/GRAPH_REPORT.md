# Graph Report - src  (2026-08-16)

## Corpus Check
- 1089 files · ~824,003 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6671 nodes · 26048 edges · 211 communities (206 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2542994c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireModule
- prisma.ts
- utils.ts
- hasGlobalView
- button.tsx
- notifyUser
- userCan
- lib/labels.ts
- formatCurrency
- recordAudit
- drive/page.tsx
- regCan
- brain-cockpit.tsx
- promo-material-actions.ts
- canAccessEntity
- corpus/actions.ts
- calendar.ts
- assistant-actions.ts
- formatDateTime
- access-actions.ts
- rules/engine.ts
- requireUser
- jobs/runner.ts
- getAppSettings
- lib/department-budget.ts
- FindingInput
- product-explorer.tsx
- care-actions.ts
- ad-pro-item-actions.ts
- batch-runner.ts
- getCurrentUser
- object-storage.ts
- regulatory-actions.ts
- ocr-engine.ts
- optionsFromMap
- [dossierId]/page.tsx
- agent-core.ts
- assistant.ts
- drive-storage.ts
- drive-actions.ts
- molecule.ts
- mistral-ocr.ts
- mail.ts
- regAudit
- lib/ai.ts
- upload/session.ts
- openai-luna.ts
- market-research.ts
- hr-document-actions.ts
- adoption.ts
- aiConfigured
- petty-cash-actions.ts
- mon-espace/page.tsx
- reports.ts
- messaging-actions.ts
- test-center/runner.ts
- training-actions.ts
- directory-sheet.ts
- entities.ts
- dossier-actions.ts
- stock-board.tsx
- budget.ts
- meeting-actions.ts
- anyRoleFilter
- pch-tender-line-actions.ts
- classify.ts
- platform-audit/engine.ts
- competition.ts
- congress-request-actions.ts
- field-reports.ts
- message-thread.tsx
- payment-authority.ts
- admin-request-actions.ts
- pilotage/page.tsx
- upload-manager.tsx
- queries/messaging.ts
- workflow-builder.tsx
- medical-actions.ts
- workflow/engine.ts
- smart-mail-actions.ts
- medical.ts
- extract-text.ts
- budget-forms.tsx
- messenger.tsx
- ocrDocument
- state-machines/explorer.ts
- meetings.ts
- medical-info-actions.ts
- (app)/layout.tsx
- lifecycle/actions.ts
- zip-inspector.ts
- migration-cert.ts
- budgets/page.tsx
- knowledge/actions.ts
- enregistrement/page.tsx
- portfolio.ts
- extract-facts.ts
- sheet-import.ts
- progress/query.ts
- supervision-board.tsx
- leave-workflow.ts
- company.ts
- market/engine.ts
- library-ingest.ts
- invariants/registry.ts
- openapi.ts
- test-center/page.tsx
- mail-client.tsx
- ad-pro-edit-actions.ts
- regulatory-table.tsx
- departments.ts
- onboarding-wizard.tsx
- sidebar.tsx
- dossier-chat.ts
- lib/messaging.ts
- department-budget-actions.ts
- market-research-actions.ts
- document-preview.tsx
- build-facts.ts
- http.ts
- org-chart-print.ts
- field-report-actions.ts
- run.ts
- expense-lines.ts
- office-templates.ts
- auth-actions.ts
- manifest.ts
- mail-diagnostic/route.ts
- corpus-actions.ts
- budget-envelope-actions.ts
- rag.ts
- archive.ts
- s3-config.ts
- admin-settings-forms.tsx
- supplier/actions.ts
- ingest-catalog.ts
- dossier-knowledge.ts
- event-form.tsx
- pch.ts
- mobile-tabbar.tsx
- process-intelligence.ts
- export.ts
- errors.ts
- driver/page.tsx
- tender-lines.tsx
- unified.ts
- dashboard.ts
- arbitrate-facts.ts
- compare-versions.ts
- messaging/messages/route.ts
- expense-row-actions.tsx
- department-actions.ts
- topbar.tsx
- test-center/types.ts
- imputation.ts
- scheduled.ts
- ai-facts.ts
- simple-pdf.ts
- catchup.ts
- getMailAccount
- push.ts
- api/workflow.ts
- ai-health.ts
- pch-tender-export.ts
- dossier-agent.ts
- cost-actions.ts
- medical-directory.tsx
- twin-panel.tsx
- background-upload.tsx
- reminder-actions.ts
- radar.ts
- company-actions.ts
- meetings/page.tsx
- departments-manager.tsx
- supplier-auth.ts
- auto-category.ts
- fetch-source.ts
- manufacturing-stage.ts
- Adventum Autonomous Test Center — architecture
- [sessionId]/route.ts
- drive-space-manager.tsx
- zip-viewer.tsx
- validation-item-review.tsx
- bars.tsx
- client-bundle-guard.test.ts
- mime.ts
- funding-panel.tsx
- delegate-plans.tsx
- forecast-grid.tsx
- ChatCitation
- push-register.tsx
- watch-schedule.ts
- [token]/route.ts
- ai-settings-form.tsx
- budget-overview.integration.test.ts
- next-auth.d.ts
- roles-table.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- mission-stops.tsx
- logout-button.tsx
- trend.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 645 edges
2. `userCan()` - 507 edges
3. `fdStr()` - 484 edges
4. `recordAudit()` - 432 edges
5. `prisma` - 426 edges
6. `requireModule()` - 226 edges
7. `hasGlobalView()` - 192 edges
8. `Button` - 169 edges
9. `formatDate()` - 150 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Group()` --calls--> `formatDateTime()`  [EXTRACTED]
  src/app/(app)/admin/versions/versions-manager.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (211 total, 5 thin omitted)

### Community 0 - "requireModule"
Cohesion: 0.02
Nodes (151): AccessUser, UserModuleState, dynamic, ActivityPage(), fmtDuration(), PermanentDeleteButton(), PurgeOrphansButton(), dynamic (+143 more)

### Community 1 - "prisma.ts"
Cohesion: 0.02
Nodes (119): dynamic, dynamic, dynamic, dynamic, dynamic, dynamic, AccessByModulePage(), dynamic (+111 more)

### Community 2 - "utils.ts"
Cohesion: 0.04
Nodes (119): ModuleSpec, TYPES, StoragePanel(), ACTION_COLS, dynamic, FocusCard(), dynamic, Mode (+111 more)

### Community 3 - "hasGlobalView"
Cohesion: 0.04
Nodes (131): CONGRESS_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, RequestDetailPage(), DemandesPage() (+123 more)

### Community 4 - "button.tsx"
Cohesion: 0.04
Nodes (83): NewRequestPicker(), DriveStorageSettings(), OrphansPanel(), OrgBranch(), Citation, Source, Version, Option (+75 more)

### Community 5 - "notifyUser"
Cohesion: 0.04
Nodes (105): RuleEditor(), SupportActions(), SupportMessageForm(), useAction(), AdProKind, closeSource(), Common, createTarget() (+97 more)

### Community 6 - "userCan"
Cohesion: 0.06
Nodes (106): POST(), FieldsManager(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), finishRequest(), requestApproval(), createBD() (+98 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.03
Nodes (97): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BDPipeline() (+89 more)

### Community 8 - "formatCurrency"
Cohesion: 0.04
Nodes (79): dynamic, metadata, CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt, BudgetRow, BudgetsTable() (+71 more)

### Community 9 - "recordAudit"
Cohesion: 0.05
Nodes (73): dynamic, POST(), GET(), ActiveToggle(), ImpersonateButton(), SuppliesManager(), SpaceSettingsButton(), AVATAR_COLORS (+65 more)

### Community 10 - "drive/page.tsx"
Cohesion: 0.06
Nodes (70): POST(), DriveCanvas(), ITEMS, NewKind, DriveRow, DriveTable(), DropCategory, MoveTarget (+62 more)

### Community 11 - "regCan"
Cohesion: 0.05
Nodes (67): dynamic, maxDuration, POST(), runtime, dynamic, GET(), runtime, dynamic (+59 more)

### Community 12 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (70): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+62 more)

### Community 13 - "promo-material-actions.ts"
Cohesion: 0.08
Nodes (61): POST(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial() (+53 more)

### Community 14 - "canAccessEntity"
Cohesion: 0.05
Nodes (68): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+60 more)

### Community 15 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (50): CorpusAdmin(), ACCEPT, AUTHORITIES, CorpusImport(), Row, CaseCard(), CaseDocRow, CaseRow (+42 more)

### Community 16 - "calendar.ts"
Cohesion: 0.06
Nodes (57): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, CalendarPage() (+49 more)

### Community 17 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (55): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+47 more)

### Community 18 - "formatDateTime"
Cohesion: 0.04
Nodes (51): AdProList(), AdProPage(), dynamic, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiControlCenterPage() (+43 more)

### Community 19 - "access-actions.ts"
Cohesion: 0.06
Nodes (52): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), ModuleAccessGrid(), AccessMatrix(), GrantOption (+44 more)

### Community 20 - "rules/engine.ts"
Cohesion: 0.06
Nodes (51): KIND_LABEL, Pack, Rule, RulePacksAdmin(), codeToken(), detectContainedSections(), DetectedSection, STOP (+43 more)

### Community 21 - "requireUser"
Cohesion: 0.06
Nodes (56): RuleControls(), PresentationCard(), PresentationPanel(), Res, DriveComments(), BU, CatalogueManager(), CHANNELS (+48 more)

### Community 22 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (60): splitTextIntoChunksWithOffsets(), enrichVersionFindings(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiBatchDefault(), aiConcurrency(), aiMaxChunks(), aiMaxFindings() (+52 more)

### Community 23 - "getAppSettings"
Cohesion: 0.07
Nodes (49): dynamic, POST(), dynamic, POST(), DatabasesPage(), delegateOf(), DeletableKind, DeleteResult (+41 more)

### Community 24 - "lib/department-budget.ts"
Cohesion: 0.10
Nodes (49): Consumption(), DepartmentBudgetTable(), RequestList(), DepartmentBudgetsPage(), dynamic, MoyensGenerauxPage(), allocatedOf(), budgetHealth (+41 more)

### Community 25 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 26 - "product-explorer.tsx"
Cohesion: 0.06
Nodes (44): AggNum(), fmtDzd(), fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone(), fmtDzd() (+36 more)

### Community 27 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 28 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (48): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, Props, addAdProItem(), AdProModule, approveAdProItemOrder() (+40 more)

### Community 29 - "batch-runner.ts"
Cohesion: 0.07
Nodes (41): BatchRequest, fetchBatchOutput(), getBatchStatus(), aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt(), OffsetChunk (+33 more)

### Community 30 - "getCurrentUser"
Cohesion: 0.07
Nodes (43): GET(), GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), esc() (+35 more)

### Community 31 - "object-storage.ts"
Cohesion: 0.10
Nodes (49): dynamic, GET(), runtime, RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config() (+41 more)

### Community 32 - "regulatory-actions.ts"
Cohesion: 0.09
Nodes (47): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), normalizeDci(), parseProductChannel(), setRegulatoryChecklistItem(), setRegulatoryPresubOutcome() (+39 more)

### Community 33 - "ocr-engine.ts"
Cohesion: 0.07
Nodes (46): defaultOcrLangs(), ensureLangData(), ocrCacheDir(), require, SUPPORTED, createOcrWorker(), LOW_CONFIDENCE, MAX_PAGES (+38 more)

### Community 34 - "optionsFromMap"
Cohesion: 0.07
Nodes (39): BusinessDevelopmentPage(), RequesterWindow(), Article, Cell, emptyCell(), MultiRequestButton(), Option, NewRequestButton() (+31 more)

### Community 35 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (43): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), DossierDetailPage(), dynamic, FindingEvidence() (+35 more)

### Community 36 - "agent-core.ts"
Cohesion: 0.08
Nodes (33): AgentItem, AgentsPanel(), RunState, extractJson(), listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc (+25 more)

### Community 37 - "assistant.ts"
Cohesion: 0.07
Nodes (44): ClaudeContentBlock, ClaudeMessage, ClaudeToolDef, activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal() (+36 more)

### Community 38 - "drive-storage.ts"
Cohesion: 0.10
Nodes (39): dynamic, POST(), blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptFileStream(), encryptWhole(), masterKey() (+31 more)

### Community 39 - "drive-actions.ts"
Cohesion: 0.09
Nodes (39): DocumentEditPage(), ConvertPdfButton(), DriveCommentItem, DriveEditPage(), FileActions(), DriveFilePage(), humanSize(), ShareItem (+31 more)

### Community 40 - "molecule.ts"
Cohesion: 0.12
Nodes (43): MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts() (+35 more)

### Community 41 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 42 - "mail.ts"
Cohesion: 0.07
Nodes (43): dynamic, GET(), acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, friendlyMailError() (+35 more)

### Community 43 - "regAudit"
Cohesion: 0.09
Nodes (37): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, setRegIntelligenceEnabled(), regAudit(), enrichFinding(), Enrichment (+29 more)

### Community 44 - "lib/ai.ts"
Cohesion: 0.09
Nodes (37): dynamic, POST(), dynamic, POST(), dynamic, GET(), BrainCockpit(), askBrain() (+29 more)

### Community 45 - "upload/session.ts"
Cohesion: 0.09
Nodes (35): dynamic, runtime, IngestResult, buildMessyDossierZip(), makeDocx(), makePng(), makeXlsx(), uploadViaSession() (+27 more)

### Community 46 - "openai-luna.ts"
Cohesion: 0.08
Nodes (39): BATCH_MULTIPLIER, BatchOutcome, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody(), callLuna() (+31 more)

### Community 47 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 48 - "hr-document-actions.ts"
Cohesion: 0.11
Nodes (36): CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), ackExpenseOriginals(), addHrRequestComment(), applyAnnualLeaveBalance(), archiveHrRequestIfDone() (+28 more)

### Community 49 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 50 - "aiConfigured"
Cohesion: 0.10
Nodes (31): VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic, TodayPage(), dynamic (+23 more)

### Community 51 - "petty-cash-actions.ts"
Cohesion: 0.14
Nodes (33): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+25 more)

### Community 52 - "mon-espace/page.tsx"
Cohesion: 0.09
Nodes (31): dynamic, MonDossierPage(), AdvanceItem, MyAdvances(), MonEspacePage(), TaskItem, PendingLeave, LeaveRequestButton() (+23 more)

### Community 53 - "reports.ts"
Cohesion: 0.10
Nodes (29): FindingsReportButton(), ReserveLetterButton(), useGenerate(), Cycle, Point, RESERVE_TYPES, ReservesPanel(), generateFindingsReportAction() (+21 more)

### Community 54 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+28 more)

### Community 55 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (31): sttConfigured(), Severity, base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER (+23 more)

### Community 56 - "training-actions.ts"
Cohesion: 0.16
Nodes (31): TrainingBoard(), TrainingParticipantRow, TrainingRow, attachFiles(), createHrTraining(), deciderFor(), decideTraining(), inviteTrainingParticipants() (+23 more)

### Community 57 - "directory-sheet.ts"
Cohesion: 0.14
Nodes (28): GET(), DirectorySheetRow, DirectorySheetView(), importDirectorySheet(), DOCTOR_TITLE, MEDICAL_SECTOR, DIRECTORY_COLUMNS, DirectoryColumn (+20 more)

### Community 58 - "entities.ts"
Cohesion: 0.14
Nodes (25): GET, GET, GET, RESERVED, GET, coerce(), DEFAULT_LIMIT, listResult (+17 more)

### Community 59 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (28): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+20 more)

### Community 60 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 61 - "budget.ts"
Cohesion: 0.11
Nodes (25): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView (+17 more)

### Community 62 - "meeting-actions.ts"
Cohesion: 0.11
Nodes (29): EditMeetingButton(), InviteResponse(), Resp, ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments() (+21 more)

### Community 63 - "anyRoleFilter"
Cohesion: 0.15
Nodes (25): CongressTable(), CongressInternationalPage(), CongressNationalPage(), SponsoringPage(), EVENTS_TABS, SPONSORING_TYPES, CongressDetail, CongressListRow (+17 more)

### Community 64 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (29): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+21 more)

### Community 65 - "classify.ts"
Cohesion: 0.10
Nodes (25): MeetingRecorder(), pickMime(), dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+17 more)

### Community 66 - "platform-audit/engine.ts"
Cohesion: 0.12
Nodes (28): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+20 more)

### Community 67 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 68 - "congress-request-actions.ts"
Cohesion: 0.22
Nodes (28): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+20 more)

### Community 69 - "field-reports.ts"
Cohesion: 0.12
Nodes (24): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), dynamic (+16 more)

### Community 70 - "message-thread.tsx"
Cohesion: 0.14
Nodes (23): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+15 more)

### Community 71 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 72 - "admin-request-actions.ts"
Cohesion: 0.11
Nodes (28): AttachmentValidationBlock(), RequestActions(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, cancelAttachmentValidation(), collectAllFields() (+20 more)

### Community 73 - "pilotage/page.tsx"
Cohesion: 0.16
Nodes (26): AffectationsPage(), PlanningPage(), dynamic, pct(), PilotagePage(), toneOf(), ensureCycle(), assignmentEffort() (+18 more)

### Community 74 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 75 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 76 - "workflow-builder.tsx"
Cohesion: 0.11
Nodes (22): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionAdminView, WorkflowActionView, WorkflowStepView, defaultDefinition() (+14 more)

### Community 77 - "medical-actions.ts"
Cohesion: 0.14
Nodes (27): DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty(), deleteDoctor() (+19 more)

### Community 78 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (27): AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), countAdProItems(), emitFinancials(), ensureInstance() (+19 more)

### Community 79 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 80 - "medical.ts"
Cohesion: 0.15
Nodes (23): GET(), SearchPage(), executeReadTool(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone(), DelegatePlanDTO (+15 more)

### Community 81 - "extract-text.ts"
Cohesion: 0.14
Nodes (19): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+11 more)

### Community 82 - "budget-forms.tsx"
Cohesion: 0.16
Nodes (24): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategorySheet() (+16 more)

### Community 83 - "messenger.tsx"
Cohesion: 0.14
Nodes (23): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+15 more)

### Community 84 - "ocrDocument"
Cohesion: 0.13
Nodes (19): analyzeEmployeeContract(), CONTRACT_TYPES_UP, analyzeTenderDocument(), canOcr(), IMAGE_EXTS, ocrDocument(), asSectionHeader(), CATEGORIES (+11 more)

### Community 85 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 86 - "meetings.ts"
Cohesion: 0.14
Nodes (19): dynamic, GET(), externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin() (+11 more)

### Community 87 - "medical-info-actions.ts"
Cohesion: 0.21
Nodes (21): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+13 more)

### Community 88 - "(app)/layout.tsx"
Cohesion: 0.13
Nodes (18): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+10 more)

### Community 89 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 90 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 91 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 92 - "budgets/page.tsx"
Cohesion: 0.21
Nodes (17): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, ModuleTab (+9 more)

### Community 93 - "knowledge/actions.ts"
Cohesion: 0.18
Nodes (20): DossierChatPanel(), Msg, SUGGESTIONS, askDossierAgentAction(), loadDossierChatAction(), resetDossierChatAction(), AgentAttachment, AgentFile (+12 more)

### Community 94 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 95 - "portfolio.ts"
Cohesion: 0.16
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 96 - "extract-facts.ts"
Cohesion: 0.17
Nodes (21): bestStrengthCombo(), comboLinkOk(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText() (+13 more)

### Community 97 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 98 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 99 - "supervision-board.tsx"
Cohesion: 0.19
Nodes (19): SupervisionBoard(), VALIDATION_STEP_STATE, SupervisedValidationItem, daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS (+11 more)

### Community 100 - "leave-workflow.ts"
Cohesion: 0.15
Nodes (19): applyChainDecision(), canDecideChain(), ChainDecider, ChainState, ChainStatus, ChainTransition, nextChainStage(), applyLeaveDecision() (+11 more)

### Community 101 - "company.ts"
Cohesion: 0.20
Nodes (19): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+11 more)

### Community 102 - "market/engine.ts"
Cohesion: 0.12
Nodes (20): Cache, DIR, LabRow, loadNdjson(), MarketMeta, NomRow, PchRow, SRC_IQVIA (+12 more)

### Community 103 - "library-ingest.ts"
Cohesion: 0.17
Nodes (19): rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+11 more)

### Community 104 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 105 - "openapi.ts"
Cohesion: 0.18
Nodes (16): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, hasAllScopes() (+8 more)

### Community 106 - "test-center/page.tsx"
Cohesion: 0.13
Nodes (18): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+10 more)

### Community 107 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 108 - "ad-pro-edit-actions.ts"
Cohesion: 0.13
Nodes (19): AssignmentMatrix(), key(), nOr0(), isKind(), Target, TARGETS, updateAdProRequest(), AdProEditor (+11 more)

### Community 109 - "regulatory-table.tsx"
Cohesion: 0.15
Nodes (17): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryRow, RegulatoryTable() (+9 more)

### Community 110 - "departments.ts"
Cohesion: 0.16
Nodes (19): DepartmentsPage(), buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, flattenTree(), getDepartmentMembers() (+11 more)

### Community 111 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 112 - "sidebar.tsx"
Cohesion: 0.17
Nodes (16): badgeFor(), FLAT_GROUPS, Sidebar(), SidebarProps, TopbarProps, NavItem, aliasMatches(), groupIntoPoles() (+8 more)

### Community 113 - "dossier-chat.ts"
Cohesion: 0.19
Nodes (18): AiTextResult, askDossier(), buildOverview(), buildPrompt(), DossierChatResult, expandQueryTerms(), READABLE, SHORT_KEEP (+10 more)

### Community 114 - "lib/messaging.ts"
Cohesion: 0.14
Nodes (17): dynamic, POST(), DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES (+9 more)

### Community 115 - "department-budget-actions.ts"
Cohesion: 0.20
Nodes (19): DepartmentAccessSheet(), AmountCell(), ExpenseForm(), RequestForm(), ExpensePanel(), ExpenseRowActions(), addDepartmentExpense(), AMEND_INCLUDE (+11 more)

### Community 116 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 117 - "document-preview.tsx"
Cohesion: 0.18
Nodes (13): FileViewer(), ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE (+5 more)

### Community 118 - "build-facts.ts"
Cohesion: 0.17
Nodes (15): FactCandidate, AI_FACT_PRIORITY, aiSectionPriority(), buildTwinFacts(), clampInt(), extractAiFactsBounded(), CRITICAL_KEYS, detectConflicts() (+7 more)

### Community 119 - "http.ts"
Cohesion: 0.21
Nodes (16): GET, ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer(), requireScopes(), sameHash() (+8 more)

### Community 120 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 121 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (16): DoctorPicker(), ReportEditor(), Attachments(), SimpleReportEditor(), formatBytes(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment() (+8 more)

### Community 122 - "run.ts"
Cohesion: 0.17
Nodes (14): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES (+6 more)

### Community 123 - "expense-lines.ts"
Cohesion: 0.25
Nodes (16): readReceipt(), ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField(), parseQuantity(), receiptLabel(), ReceiptLine (+8 more)

### Community 124 - "office-templates.ts"
Cohesion: 0.17
Nodes (15): TYPES, blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT (+7 more)

### Community 125 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 126 - "manifest.ts"
Cohesion: 0.18
Nodes (15): CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS (+7 more)

### Community 127 - "mail-diagnostic/route.ts"
Cohesion: 0.15
Nodes (17): dynamic, POST(), acquirePooled(), appendToSent(), classifyMailError(), decryptSecret(), dropPooled(), evictColdest() (+9 more)

### Community 128 - "corpus-actions.ts"
Cohesion: 0.20
Nodes (15): CorpusPanel(), IngestResults, Src, WatchFindings, CatalogSource, guard(), IngestActionResult, ingestOneSource() (+7 more)

### Community 129 - "budget-envelope-actions.ts"
Cohesion: 0.25
Nodes (17): createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory(), ensureCanManageEnvelope(), NOT_ALLOWED, readAccessRoles() (+9 more)

### Community 130 - "rag.ts"
Cohesion: 0.20
Nodes (14): lunaEmbed(), lunaEmbedModel(), citationsByIds(), CorpusFilters, Row, searchCorpus(), searchCorpusLexical(), activeStamp() (+6 more)

### Community 131 - "archive.ts"
Cohesion: 0.21
Nodes (13): GET(), POST(), dynamic, GET(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest() (+5 more)

### Community 132 - "s3-config.ts"
Cohesion: 0.23
Nodes (15): AdminPage(), fmtBytes(), fmtWhen(), ConfigSource, describeConfig(), Env, isTruthy(), providerOf() (+7 more)

### Community 133 - "admin-settings-forms.tsx"
Cohesion: 0.12
Nodes (16): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+8 more)

### Community 134 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 135 - "ingest-catalog.ts"
Cohesion: 0.24
Nodes (14): ANPP_WATCH_PAGES, BINDING, CATALOG, findSource(), FIRST_WAVE, INGESTIBLE, SourceAuthority, sourcesForModule() (+6 more)

### Community 136 - "dossier-knowledge.ts"
Cohesion: 0.19
Nodes (15): bestValue(), DossierDoc, DossierFact, DossierKnowledge, DossierModuleNode, DossierPassage, DossierSectionNode, DossierTextHit (+7 more)

### Community 137 - "event-form.tsx"
Cohesion: 0.17
Nodes (10): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt, CreateEventButton(), d10(), EventFields(), Result (+2 more)

### Community 138 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 139 - "mobile-tabbar.tsx"
Cohesion: 0.22
Nodes (11): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY, NotificationPopup(), Popup (+3 more)

### Community 140 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 141 - "export.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), regulatoryExportFilename() (+3 more)

### Community 142 - "errors.ts"
Cohesion: 0.19
Nodes (10): blockOf(), GET, SCALARS, schema(), API_ERROR_CODES, ApiError, ApiErrorBody, ApiErrorCode (+2 more)

### Community 143 - "driver/page.tsx"
Cohesion: 0.22
Nodes (11): ApprovalsPage(), CorbeillePage(), CoursesPage(), MissionActions(), DriverPage(), getApprovals(), getAssistantData(), getDeletedRequests() (+3 more)

### Community 144 - "tender-lines.tsx"
Cohesion: 0.21
Nodes (13): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderText() (+5 more)

### Community 145 - "unified.ts"
Cohesion: 0.25
Nodes (13): AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest, adProState, APPROVED, DONE, DRAFT (+5 more)

### Community 146 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 147 - "arbitrate-facts.ts"
Cohesion: 0.27
Nodes (11): extractLooseJson(), repairAndParse(), AmbiguousFact, arbitrateAmbiguousFacts(), ArbitrationSchema, buildArbitrationPrompt(), isAmbiguous(), parseArbitration() (+3 more)

### Community 148 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 149 - "messaging/messages/route.ts"
Cohesion: 0.21
Nodes (10): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+2 more)

### Community 150 - "expense-row-actions.tsx"
Cohesion: 0.33
Nodes (9): BudgetTargetField(), EditableExpense, CatalogArticle, empty(), ExistingLine, ReceiptLines(), Row, BudgetTarget (+1 more)

### Community 151 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 152 - "topbar.tsx"
Cohesion: 0.22
Nodes (11): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+3 more)

### Community 153 - "test-center/types.ts"
Cohesion: 0.25
Nodes (9): MODES, PHASE1_MODES, runTestCenter(), guardMode(), GuardResult, resolveEnvironment(), PRODUCTION_SAFETY_PHRASE, RunConfig (+1 more)

### Community 154 - "imputation.ts"
Cohesion: 0.26
Nodes (10): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+2 more)

### Community 155 - "scheduled.ts"
Cohesion: 0.26
Nodes (13): pollAiBatches(), expireStaleBatches(), runDueRegulatoryJobs(), pruneStaleUploadSessions(), purgeClosedSessionParts(), accrueMonthlyLeave(), algiersYm(), armHeartbeat() (+5 more)

### Community 156 - "ai-facts.ts"
Cohesion: 0.23
Nodes (11): AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded(), extractFactsWithAI() (+3 more)

### Community 157 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 158 - "catchup.ts"
Cohesion: 0.24
Nodes (11): AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews(), catchUpStalledPipelines() (+3 more)

### Community 159 - "getMailAccount"
Cohesion: 0.24
Nodes (9): dynamic, GET(), dynamic, GET(), dynamic, GET(), getAttachment(), getMailAccount() (+1 more)

### Community 160 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 161 - "api/workflow.ts"
Cohesion: 0.24
Nodes (10): ASPECTS, GET, AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf() (+2 more)

### Community 162 - "ai-health.ts"
Cohesion: 0.26
Nodes (6): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiHealthRun, performAiHealthCheck()

### Community 163 - "pch-tender-export.ts"
Cohesion: 0.27
Nodes (8): boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine, header

### Community 164 - "dossier-agent.ts"
Cohesion: 0.24
Nodes (10): parsePdfBody(), addCitation(), buildUserMessage(), READABLE_STATUSES, runDossierAgent(), runTool(), SYSTEM, TOOLS (+2 more)

### Community 165 - "cost-actions.ts"
Cohesion: 0.33
Nodes (8): BudgetRowData, DossierBudgetRow(), BudgetForm(), DeferredReviewButton(), Result, setDossierBudget(), submitDeferredReview(), submitImmediateReview()

### Community 166 - "medical-directory.tsx"
Cohesion: 0.24
Nodes (9): Props, Result, SECTOR_ICON, SECTOR_ORDER, INSTITUTION_SECTOR, INSTITUTION_TYPE, InstitutionDTO, SpecialtyDTO (+1 more)

### Community 167 - "twin-panel.tsx"
Cohesion: 0.20
Nodes (10): Conflict, ConflictRow(), ConflictValue, Fact, FactRow(), METHOD_LABEL, methodLabel(), Occurrence (+2 more)

### Community 168 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 169 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 170 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 171 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 172 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 173 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 174 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 175 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 176 - "fetch-source.ts"
Cohesion: 0.44
Nodes (7): extOf(), FetchedSource, fetchSource(), findPdfLink(), get(), htmlToText(), ImportedSection

### Community 177 - "manufacturing-stage.ts"
Cohesion: 0.39
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 178 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 179 - "[sessionId]/route.ts"
Cohesion: 0.39
Nodes (7): DELETE(), dynamic, GET(), runtime, scope(), abortUploadSession(), uploadSessionStatus()

### Community 180 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 181 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 182 - "validation-item-review.tsx"
Cohesion: 0.32
Nodes (7): Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 183 - "bars.tsx"
Cohesion: 0.32
Nodes (7): BarRow, Bars(), COLOR, Meter(), TEXT, toneOf(), STATUS

### Community 184 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 185 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 186 - "funding-panel.tsx"
Cohesion: 0.33
Nodes (6): EventFundingPanel(), PmOpt, Props, SubmitButton(), BudgetCategoryOption, WorkflowView

### Community 187 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 188 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 189 - "ChatCitation"
Cohesion: 0.33
Nodes (6): Msg, ReserveChatPanel(), SUGGESTIONS, AgentContext, DossierAgentResult, ChatCitation

### Community 190 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 191 - "watch-schedule.ts"
Cohesion: 0.48
Nodes (6): extractDocumentLinks(), watchAnppPages(), alertRegulatory(), isDue(), runAnppWatchIfDue(), watchEnabled()

### Community 192 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 193 - "ai-settings-form.tsx"
Cohesion: 0.33
Nodes (5): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle()

### Community 194 - "budget-overview.integration.test.ts"
Cohesion: 0.33
Nodes (4): DAY, PERIOD_END, PERIOD_START, SUPER

### Community 195 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 196 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 197 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 198 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 199 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 200 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 201 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

### Community 202 - "trend.tsx"
Cohesion: 0.50
Nodes (3): PAD, Trend(), TrendPoint

## Knowledge Gaps
- **1318 isolated node(s):** `dynamic`, `ModuleSpec`, `dynamic`, `TYPE`, `FIELD_KEY` (+1313 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `requireModule`, `utils.ts`, `hasGlobalView`, `notifyUser`, `userCan`, `lib/labels.ts`, `formatCurrency`, `recordAudit`, `drive/page.tsx`, `regCan`, `brain-cockpit.tsx`, `promo-material-actions.ts`, `canAccessEntity`, `corpus/actions.ts`, `calendar.ts`, `assistant-actions.ts`, `formatDateTime`, `access-actions.ts`, `rules/engine.ts`, `requireUser`, `jobs/runner.ts`, `getAppSettings`, `lib/department-budget.ts`, `product-explorer.tsx`, `care-actions.ts`, `ad-pro-item-actions.ts`, `batch-runner.ts`, `getCurrentUser`, `regulatory-actions.ts`, `[dossierId]/page.tsx`, `agent-core.ts`, `assistant.ts`, `drive-storage.ts`, `drive-actions.ts`, `mail.ts`, `regAudit`, `lib/ai.ts`, `upload/session.ts`, `openai-luna.ts`, `market-research.ts`, `hr-document-actions.ts`, `adoption.ts`, `aiConfigured`, `petty-cash-actions.ts`, `mon-espace/page.tsx`, `reports.ts`, `messaging-actions.ts`, `test-center/runner.ts`, `training-actions.ts`, `directory-sheet.ts`, `entities.ts`, `dossier-actions.ts`, `stock-board.tsx`, `budget.ts`, `meeting-actions.ts`, `anyRoleFilter`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `congress-request-actions.ts`, `field-reports.ts`, `admin-request-actions.ts`, `pilotage/page.tsx`, `queries/messaging.ts`, `medical-actions.ts`, `workflow/engine.ts`, `smart-mail-actions.ts`, `medical.ts`, `ocrDocument`, `state-machines/explorer.ts`, `meetings.ts`, `medical-info-actions.ts`, `(app)/layout.tsx`, `lifecycle/actions.ts`, `migration-cert.ts`, `budgets/page.tsx`, `knowledge/actions.ts`, `portfolio.ts`, `progress/query.ts`, `company.ts`, `library-ingest.ts`, `invariants/registry.ts`, `test-center/page.tsx`, `ad-pro-edit-actions.ts`, `departments.ts`, `onboarding-wizard.tsx`, `dossier-chat.ts`, `lib/messaging.ts`, `department-budget-actions.ts`, `market-research-actions.ts`, `build-facts.ts`, `http.ts`, `field-report-actions.ts`, `run.ts`, `expense-lines.ts`, `auth-actions.ts`, `manifest.ts`, `mail-diagnostic/route.ts`, `budget-envelope-actions.ts`, `rag.ts`, `archive.ts`, `supplier/actions.ts`, `ingest-catalog.ts`, `dossier-knowledge.ts`, `pch.ts`, `process-intelligence.ts`, `export.ts`, `driver/page.tsx`, `dashboard.ts`, `compare-versions.ts`, `department-actions.ts`, `imputation.ts`, `scheduled.ts`, `catchup.ts`, `getMailAccount`, `push.ts`, `api/workflow.ts`, `ai-health.ts`, `dossier-agent.ts`, `cost-actions.ts`, `reminder-actions.ts`, `company-actions.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `watch-schedule.ts`, `[token]/route.ts`, `budget-overview.integration.test.ts`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `requireModule`, `prisma.ts`, `utils.ts`, `hasGlobalView`, `notifyUser`, `userCan`, `lib/labels.ts`, `recordAudit`, `drive/page.tsx`, `regCan`, `brain-cockpit.tsx`, `promo-material-actions.ts`, `canAccessEntity`, `corpus/actions.ts`, `calendar.ts`, `assistant-actions.ts`, `formatDateTime`, `access-actions.ts`, `rules/engine.ts`, `getAppSettings`, `lib/department-budget.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `regulatory-actions.ts`, `agent-core.ts`, `drive-actions.ts`, `molecule.ts`, `regAudit`, `lib/ai.ts`, `hr-document-actions.ts`, `aiConfigured`, `petty-cash-actions.ts`, `mon-espace/page.tsx`, `reports.ts`, `messaging-actions.ts`, `training-actions.ts`, `directory-sheet.ts`, `dossier-actions.ts`, `stock-board.tsx`, `meeting-actions.ts`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `congress-request-actions.ts`, `admin-request-actions.ts`, `medical-actions.ts`, `smart-mail-actions.ts`, `medical.ts`, `budget-forms.tsx`, `messenger.tsx`, `ocrDocument`, `medical-info-actions.ts`, `(app)/layout.tsx`, `lifecycle/actions.ts`, `budgets/page.tsx`, `knowledge/actions.ts`, `test-center/page.tsx`, `mail-client.tsx`, `ad-pro-edit-actions.ts`, `onboarding-wizard.tsx`, `lib/messaging.ts`, `department-budget-actions.ts`, `market-research-actions.ts`, `field-report-actions.ts`, `run.ts`, `auth-actions.ts`, `corpus-actions.ts`, `budget-envelope-actions.ts`, `supplier/actions.ts`, `tender-lines.tsx`, `department-actions.ts`, `topbar.tsx`, `test-center/types.ts`, `ai-health.ts`, `cost-actions.ts`, `reminder-actions.ts`, `company-actions.ts`, `validation-item-review.tsx`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `requireModule`, `prisma.ts`, `utils.ts`, `hasGlobalView`, `notifyUser`, `lib/labels.ts`, `formatCurrency`, `recordAudit`, `drive/page.tsx`, `brain-cockpit.tsx`, `promo-material-actions.ts`, `canAccessEntity`, `calendar.ts`, `assistant-actions.ts`, `formatDateTime`, `access-actions.ts`, `requireUser`, `getAppSettings`, `lib/department-budget.ts`, `product-explorer.tsx`, `care-actions.ts`, `ad-pro-item-actions.ts`, `getCurrentUser`, `regulatory-actions.ts`, `optionsFromMap`, `assistant.ts`, `drive-storage.ts`, `drive-actions.ts`, `molecule.ts`, `lib/ai.ts`, `market-research.ts`, `hr-document-actions.ts`, `adoption.ts`, `petty-cash-actions.ts`, `mon-espace/page.tsx`, `messaging-actions.ts`, `training-actions.ts`, `directory-sheet.ts`, `entities.ts`, `dossier-actions.ts`, `stock-board.tsx`, `budget.ts`, `meeting-actions.ts`, `anyRoleFilter`, `pch-tender-line-actions.ts`, `congress-request-actions.ts`, `admin-request-actions.ts`, `pilotage/page.tsx`, `queries/messaging.ts`, `medical-actions.ts`, `medical.ts`, `budget-forms.tsx`, `ocrDocument`, `medical-info-actions.ts`, `(app)/layout.tsx`, `budgets/page.tsx`, `openapi.ts`, `test-center/page.tsx`, `mail-client.tsx`, `ad-pro-edit-actions.ts`, `departments.ts`, `lib/messaging.ts`, `department-budget-actions.ts`, `market-research-actions.ts`, `http.ts`, `field-report-actions.ts`, `mail-diagnostic/route.ts`, `budget-envelope-actions.ts`, `s3-config.ts`, `export.ts`, `errors.ts`, `driver/page.tsx`, `tender-lines.tsx`, `dashboard.ts`, `messaging/messages/route.ts`, `department-actions.ts`, `api/workflow.ts`, `ai-health.ts`, `reminder-actions.ts`, `company-actions.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `dynamic`, `ModuleSpec`, `dynamic` to the rest of the system?**
  _1318 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.024864159965224952 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.02442505947660587 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04475443185120605 - nodes in this community are weakly interconnected._