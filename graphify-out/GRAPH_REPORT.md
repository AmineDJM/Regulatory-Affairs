# Graph Report - src  (2026-08-16)

## Corpus Check
- 1102 files · ~833,301 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6730 nodes · 26261 edges · 206 communities (201 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b432a796`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireModule
- utils.ts
- recordAudit
- button.tsx
- lib/labels.ts
- requireUser
- card.tsx
- getCurrentUser
- jobs/runner.ts
- notifyUser
- events/[id]/page.tsx
- entities.ts
- fdStr
- hasGlobalView
- aiConfigured
- congress-request-actions.ts
- anyRoleFilter
- build-facts.ts
- corpus/page.tsx
- (app)/validations/page.tsx
- [dossierId]/page.tsx
- regAudit
- getAppSettings
- meeting-actions.ts
- drive/page.tsx
- rules/engine.ts
- formatDateTime
- platform-audit/engine.ts
- training-actions.ts
- FindingInput
- mail.ts
- care-actions.ts
- agent-core.ts
- assistant-actions.ts
- risks.ts
- prisma
- ad-pro-item-actions.ts
- corpus/actions.ts
- drive-storage.ts
- lib/session.ts
- reserves/page.tsx
- onlyofficeConfigured
- mistral-ocr.ts
- library-ingest.ts
- market-research.ts
- drive-actions.ts
- promo-material-actions.ts
- upload/session.ts
- calendar.ts
- adoption.ts
- test-center/runner.ts
- budget.ts
- openai-luna.ts
- assistant.ts
- prisma.ts
- rbac.ts
- getMarketData
- (app)/layout.tsx
- object-storage.ts
- ocr-engine.ts
- test-center/page.tsx
- lib/department-budget.ts
- medical-directory.tsx
- cash-panel.tsx
- dashboard.ts
- product-explorer.tsx
- pch-tender-line-actions.ts
- workflow/engine.ts
- dashboard/page.tsx
- message-thread.tsx
- sectionByCode
- stock-board.tsx
- annuaire/page.tsx
- lib/ai.ts
- budget-forms.tsx
- onboarding-wizard.tsx
- queries/workflow.ts
- dossier-actions.ts
- queries/messaging.ts
- medical-info-actions.ts
- messaging-actions.ts
- payment-authority.ts
- upload-manager.tsx
- aiFeatureEnabled
- brain-cockpit.tsx
- scheduled.ts
- smart-mail-actions.ts
- general-means.ts
- molecule.ts
- reports.ts
- regulatory/page.tsx
- regulatory-workflow.ts
- zip-inspector.ts
- pch-detail-client.tsx
- lifecycle/actions.ts
- extract-text.ts
- migration-cert.ts
- export.ts
- enregistrement/page.tsx
- sheet-import.ts
- state-machines/explorer.ts
- directive-actions.ts
- messenger.tsx
- departments-manager.tsx
- products.ts
- mail-client.tsx
- progress/query.ts
- portfolio.ts
- invariants/registry.ts
- getBlob
- drive/upload/route.ts
- field-reports.ts
- admin-settings-forms.tsx
- molecule-panel.tsx
- document-preview.tsx
- run.ts
- departments.ts
- petty-cash.ts
- company.ts
- features.ts
- info-panel.tsx
- auth-actions.ts
- document-mirror.ts
- messaging/messages/route.ts
- support-actions.ts
- supplier-portal-actions.ts
- sidebar.tsx
- getMailAccount
- office/page.tsx
- topbar.tsx
- department-budget-actions.ts
- raw/route.ts
- self-test.ts
- org-chart-print.ts
- drive/[id]/page.tsx
- (app)/organigramme/page.tsx
- event-form.tsx
- upload-button.tsx
- anpp-process.tsx
- regulatory-actions.ts
- process-intelligence.ts
- s3-config.ts
- manifest.ts
- pch/export/route.ts
- explorer-nav.tsx
- new-conversation.tsx
- imputation.ts
- simple-pdf.ts
- stock-snapshot-actions.ts
- hr-documents.ts
- budgets/export/route.ts
- push.ts
- driver/page.tsx
- assistant-files.ts
- overview/page.tsx
- medical.ts
- background-upload.tsx
- reminder-actions.ts
- pricing.ts
- radar.ts
- regulatory-drive-mirror.ts
- company-actions.ts
- congress-workflow.tsx
- bd.ts
- grouping.ts
- calendar-view.tsx
- dossiers.ts
- training-panel.tsx
- stocks-view.tsx
- power-tools.ts
- api/workflow.ts
- auto-category.ts
- training/for-section.ts
- Adventum Autonomous Test Center — architecture
- drive-space-manager.tsx
- zip-viewer.tsx
- validation-item-review.tsx
- bars.tsx
- client-bundle-guard.test.ts
- funding-panel.tsx
- delegate-plans.tsx
- onboarding/page.tsx
- push-register.tsx
- [token]/route.ts
- user-admin-forms.tsx
- bv-requests.tsx
- employee-form.tsx
- budget-overview.integration.test.ts
- next-auth.d.ts
- events/[id]/export/route.ts
- orphans-panel.tsx
- roles-table.tsx
- attachment-validation.tsx
- app/layout.tsx
- activity-tracker.tsx
- row-grants.tsx
- mission-stops.tsx
- validation-decision.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 645 edges
2. `userCan()` - 509 edges
3. `fdStr()` - 484 edges
4. `recordAudit()` - 434 edges
5. `prisma` - 429 edges
6. `requireModule()` - 228 edges
7. `hasGlobalView()` - 192 edges
8. `Button` - 168 edges
9. `formatDate()` - 150 edges
10. `cn()` - 145 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (206 total, 5 thin omitted)

### Community 0 - "requireModule"
Cohesion: 0.03
Nodes (139): AdminValidationsPage(), dec(), MarketResearchListPage(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), Budget(), DashboardPage(), ApprovalsPage() (+131 more)

### Community 1 - "utils.ts"
Cohesion: 0.05
Nodes (101): ModuleSpec, AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), dynamic, TYPES (+93 more)

### Community 2 - "recordAudit"
Cohesion: 0.03
Nodes (130): dynamic, POST(), ActiveToggle(), ImpersonateButton(), SpaceSettingsButton(), VariationPanel(), CreateRecordButtonProps, adminResetPassword() (+122 more)

### Community 3 - "button.tsx"
Cohesion: 0.05
Nodes (73): DriveStorageSettings(), OrgBranch(), StoragePanel(), Option, RuleDTO, ROLE_OPTIONS, UserOpt, ProjectStatusBadge() (+65 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (104): AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), FieldDefDTO, CustomFieldsPage(), BudgetRow, BudgetsTable() (+96 more)

### Community 5 - "requireUser"
Cohesion: 0.04
Nodes (107): POST(), CorbeillePage(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor() (+99 more)

### Community 6 - "card.tsx"
Cohesion: 0.06
Nodes (69): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), MailTester(), CourrierAdminPage(), dynamic (+61 more)

### Community 7 - "getCurrentUser"
Cohesion: 0.04
Nodes (88): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+80 more)

### Community 8 - "jobs/runner.ts"
Cohesion: 0.04
Nodes (96): fetchBatchOutput(), getBatchStatus(), lunaCostUsd(), submitBatch(), aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt() (+88 more)

### Community 9 - "notifyUser"
Cohesion: 0.05
Nodes (87): EventDetail(), EventForm(), DriveComments(), HrDossier(), REQ_TO_CAT, RequestRow(), CancelButton(), MeetingControls() (+79 more)

### Community 10 - "events/[id]/page.tsx"
Cohesion: 0.05
Nodes (82): CongressDetailView(), CongressTable(), CongressIntlDetailPage(), CongressInternationalPage(), CongressNatDetailPage(), CongressNationalPage(), dynamic, EventDetailPage() (+74 more)

### Community 11 - "entities.ts"
Cohesion: 0.05
Nodes (71): GET, ASPECTS, GET, GET, GET, RESERVED, blockOf(), GET (+63 more)

### Community 12 - "fdStr"
Cohesion: 0.05
Nodes (81): GET(), FieldsManager(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd() (+73 more)

### Community 13 - "hasGlobalView"
Cohesion: 0.04
Nodes (84): RuleControls(), RuleEditor(), CorbeillePage(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), AdProTransferButton(), Kind (+76 more)

### Community 14 - "aiConfigured"
Cohesion: 0.06
Nodes (71): DossierChatPanel(), Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiConfigured(), AiTextResult, askDossierAction() (+63 more)

### Community 15 - "congress-request-actions.ts"
Cohesion: 0.06
Nodes (67): EditEventButton(), RegistrationsManager(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList() (+59 more)

### Community 16 - "anyRoleFilter"
Cohesion: 0.06
Nodes (62): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+54 more)

### Community 17 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 18 - "corpus/page.tsx"
Cohesion: 0.06
Nodes (63): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+55 more)

### Community 19 - "(app)/validations/page.tsx"
Cohesion: 0.05
Nodes (58): dynamic, FocusCard(), CourseDuration(), mapsUrl(), TaskItem, TaskList(), ActionRow(), MonTravailPage() (+50 more)

### Community 20 - "[dossierId]/page.tsx"
Cohesion: 0.05
Nodes (58): AgentItem, AgentsPanel(), RunState, DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime() (+50 more)

### Community 21 - "regAudit"
Cohesion: 0.06
Nodes (56): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Question (+48 more)

### Community 22 - "getAppSettings"
Cohesion: 0.06
Nodes (55): dynamic, POST(), dynamic, POST(), dynamic, POST(), PermanentDeleteButton(), PurgeOrphansButton() (+47 more)

### Community 23 - "meeting-actions.ts"
Cohesion: 0.06
Nodes (53): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), UserLite, MeetJoin(), ChatAttachment, ChatMessage (+45 more)

### Community 24 - "drive/page.tsx"
Cohesion: 0.08
Nodes (52): DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite, DriveToolbar(), SettingsIcon, DriveSpacePage() (+44 more)

### Community 25 - "rules/engine.ts"
Cohesion: 0.07
Nodes (49): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+41 more)

### Community 26 - "formatDateTime"
Cohesion: 0.05
Nodes (49): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, dynamic, TrashItem, TrashList() (+41 more)

### Community 27 - "platform-audit/engine.ts"
Cohesion: 0.07
Nodes (51): AdProList(), NewRequestPicker(), AdProPage(), dynamic, generatePlatformIdeas(), AD_PRO_KINDS, AD_PRO_STATE, AdProKind (+43 more)

### Community 28 - "training-actions.ts"
Cohesion: 0.09
Nodes (50): TrainingBoard(), TrainingParticipantRow, TrainingRow, attachFiles(), createHrTraining(), deciderFor(), decideTraining(), inviteTrainingParticipants() (+42 more)

### Community 29 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 30 - "mail.ts"
Cohesion: 0.06
Nodes (55): dynamic, POST(), acquirePooled(), acquireSlot(), addrStr(), appendToSent(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD (+47 more)

### Community 31 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 32 - "agent-core.ts"
Cohesion: 0.07
Nodes (39): lunaEmbed(), lunaEmbedModel(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn (+31 more)

### Community 33 - "assistant-actions.ts"
Cohesion: 0.09
Nodes (48): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+40 more)

### Community 34 - "risks.ts"
Cohesion: 0.07
Nodes (47): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), DENIED, updateRiskThresholds(), diff(), getPulse() (+39 more)

### Community 35 - "prisma"
Cohesion: 0.07
Nodes (28): SupportDetailPage(), assistantNudge(), actorFor(), actorFor(), OLD_HASH, actorFor(), actor(), actorFor() (+20 more)

### Community 36 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (48): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, Props, addAdProItem(), AdProModule, approveAdProItemOrder() (+40 more)

### Community 37 - "corpus/actions.ts"
Cohesion: 0.08
Nodes (40): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CorpusImport(), Row (+32 more)

### Community 38 - "drive-storage.ts"
Cohesion: 0.09
Nodes (43): blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptFileStream(), encryptWhole(), masterKey(), putBlob(), putBlobChunked() (+35 more)

### Community 39 - "lib/session.ts"
Cohesion: 0.05
Nodes (37): dynamic, EntitesPage(), dynamic, metadata, RegulatoryCorpusPage(), Breakdown(), dynamic, fmtDateTime() (+29 more)

### Community 40 - "reserves/page.tsx"
Cohesion: 0.08
Nodes (40): CorpusPage(), dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar (+32 more)

### Community 41 - "onlyofficeConfigured"
Cohesion: 0.12
Nodes (37): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+29 more)

### Community 42 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 43 - "library-ingest.ts"
Cohesion: 0.08
Nodes (36): analyzeTenderDocument(), canOcr(), IMAGE_EXTS, ocrDocument(), rasterizePdf(), asSectionHeader(), CATEGORIES, categorizeReserve() (+28 more)

### Community 44 - "market-research.ts"
Cohesion: 0.08
Nodes (38): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), analyzeMarketResearch(), buildContext() (+30 more)

### Community 45 - "drive-actions.ts"
Cohesion: 0.09
Nodes (38): DriveCanvas(), ITEMS, NewKind, ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget (+30 more)

### Community 46 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 47 - "upload/session.ts"
Cohesion: 0.09
Nodes (37): dynamic, runtime, IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx() (+29 more)

### Community 48 - "calendar.ts"
Cohesion: 0.09
Nodes (38): TodayPage(), CalendarPage(), dynamic, aiModelCheap(), askClaudeCheap(), CalendarEventDTO, CalendarInviteeDTO, EventRow (+30 more)

### Community 49 - "adoption.ts"
Cohesion: 0.09
Nodes (37): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), resetActivityTime(), saveAdoptionSettings(), ADOPTION_TARGET_FIELDS (+29 more)

### Community 50 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (34): Severity, base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+26 more)

### Community 51 - "budget.ts"
Cohesion: 0.12
Nodes (31): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, rememberBudgetEnvelope() (+23 more)

### Community 52 - "openai-luna.ts"
Cohesion: 0.09
Nodes (37): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+29 more)

### Community 53 - "assistant.ts"
Cohesion: 0.09
Nodes (39): activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool(), ExecuteResult (+31 more)

### Community 54 - "prisma.ts"
Cohesion: 0.09
Nodes (23): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+15 more)

### Community 55 - "rbac.ts"
Cohesion: 0.06
Nodes (33): dynamic, GET(), StocksPage(), SnapshotDTO, NAV_LEGACY_LABELS, getProductOptions(), ProductOption, ALL (+25 more)

### Community 56 - "getMarketData"
Cohesion: 0.10
Nodes (35): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+27 more)

### Community 57 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (27): AppLayout(), ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), CommandPalette(), Item, SearchResult, ImpersonationBanner() (+19 more)

### Community 58 - "object-storage.ts"
Cohesion: 0.13
Nodes (36): RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config(), createMultipartUpload(), _deriveSigningKeyHex(), EMPTY_SHA256 (+28 more)

### Community 59 - "ocr-engine.ts"
Cohesion: 0.11
Nodes (33): dossierCost, c(), buildPagedContent(), defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require (+25 more)

### Community 60 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (27): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+19 more)

### Community 61 - "lib/department-budget.ts"
Cohesion: 0.11
Nodes (31): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), MoyensGenerauxPage() (+23 more)

### Community 62 - "medical-directory.tsx"
Cohesion: 0.11
Nodes (34): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), Result, SECTOR_ICON, SECTOR_ORDER, SpecialtiesManager(), useSubmit() (+26 more)

### Community 63 - "cash-panel.tsx"
Cohesion: 0.15
Nodes (26): BudgetTargetField(), EditableExpense, ExpenseRowActions(), CatalogArticle, empty(), ExistingLine, ReceiptLines(), Row (+18 more)

### Community 64 - "dashboard.ts"
Cohesion: 0.12
Nodes (30): GET(), SearchPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData() (+22 more)

### Community 65 - "product-explorer.tsx"
Cohesion: 0.08
Nodes (30): AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, AggNum(), BdProjectDetailPage(), fmtDzd(), fmtDzd() (+22 more)

### Community 66 - "pch-tender-line-actions.ts"
Cohesion: 0.13
Nodes (32): analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+24 more)

### Community 67 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (32): getManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep(), countAdProItems() (+24 more)

### Community 68 - "dashboard/page.tsx"
Cohesion: 0.07
Nodes (26): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, inline(), MdTable() (+18 more)

### Community 69 - "message-thread.tsx"
Cohesion: 0.12
Nodes (28): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment (+20 more)

### Community 70 - "sectionByCode"
Cohesion: 0.10
Nodes (28): CorpusExtract, queryFor(), SECTION_HINTS, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+20 more)

### Community 71 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 72 - "annuaire/page.tsx"
Cohesion: 0.14
Nodes (28): GET(), DirectorySheetRow, DirectorySheetView(), AnnuairePage(), dynamic, DOCTOR_TITLE, MEDICAL_SECTOR, DIRECTORY_COLUMNS (+20 more)

### Community 73 - "lib/ai.ts"
Cohesion: 0.09
Nodes (24): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), analyzeFieldReport(), AnthropicBlock, apiErrorMessage(), AskOptions (+16 more)

### Community 74 - "budget-forms.tsx"
Cohesion: 0.13
Nodes (30): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+22 more)

### Community 75 - "onboarding-wizard.tsx"
Cohesion: 0.08
Nodes (20): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, AssistantPreview(), CourrierPreview() (+12 more)

### Community 76 - "queries/workflow.ts"
Cohesion: 0.11
Nodes (25): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, WorkflowActionView, WorkflowEventView (+17 more)

### Community 77 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (27): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+19 more)

### Community 78 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (26): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+18 more)

### Community 79 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+17 more)

### Community 80 - "messaging-actions.ts"
Cohesion: 0.12
Nodes (26): DOT, MyStatus(), DENIED, parseAttachments(), ParsedAttachment, parseRef(), sendMessage(), setMessagingStatus() (+18 more)

### Community 81 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 82 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 83 - "aiFeatureEnabled"
Cohesion: 0.15
Nodes (23): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+15 more)

### Community 84 - "brain-cockpit.tsx"
Cohesion: 0.10
Nodes (21): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+13 more)

### Community 85 - "scheduled.ts"
Cohesion: 0.13
Nodes (25): runPettyCashRechargeReminders(), pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled() (+17 more)

### Community 86 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 87 - "general-means.ts"
Cohesion: 0.17
Nodes (24): DepartmentBudgetsPage(), dynamic, BudgetSetter, canViewDepartmentBudget(), DeptBudgetGrant, DeptBudgetKind, editableKindsOn(), mergeGrants() (+16 more)

### Community 88 - "molecule.ts"
Cohesion: 0.18
Nodes (24): SuggestField(), marketSuggestions(), analyzeMoleculeSafe(), NomRow, canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL (+16 more)

### Community 89 - "reports.ts"
Cohesion: 0.15
Nodes (20): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+12 more)

### Community 90 - "regulatory/page.tsx"
Cohesion: 0.13
Nodes (21): RegulatoryPage(), AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryRow (+13 more)

### Community 91 - "regulatory-workflow.ts"
Cohesion: 0.14
Nodes (24): setRegulatoryStepState(), completeStepsThrough(), isRegChecklistKey(), isRegStepKey(), isRegStepState(), phaseLabel(), PRESUB_ANSWER_STEP, REG_PHASES (+16 more)

### Community 92 - "zip-inspector.ts"
Cohesion: 0.14
Nodes (24): ingestDossierZipFromFile(), BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip() (+16 more)

### Community 93 - "pch-detail-client.tsx"
Cohesion: 0.13
Nodes (21): Action, EditTenderButton(), OrdersManager(), useSubmit(), d10(), LogisticsRow(), Res, TenderLogistics() (+13 more)

### Community 94 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 95 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 96 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 97 - "export.ts"
Cohesion: 0.17
Nodes (17): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), regulatoryExportFilename() (+9 more)

### Community 98 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 99 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 100 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 101 - "directive-actions.ts"
Cohesion: 0.18
Nodes (19): DirectiveDetailPage(), MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate() (+11 more)

### Community 102 - "messenger.tsx"
Cohesion: 0.17
Nodes (20): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+12 more)

### Community 103 - "departments-manager.tsx"
Cohesion: 0.19
Nodes (20): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+12 more)

### Community 104 - "products.ts"
Cohesion: 0.17
Nodes (20): MarketProductsPage(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GALENIC_FORMS, GalenicForm, MoleculeAnalysis (+12 more)

### Community 105 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 106 - "progress/query.ts"
Cohesion: 0.16
Nodes (17): AnalysisProgressCard(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta(), pctFrac(), PHASE_LABELS (+9 more)

### Community 107 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 108 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 109 - "getBlob"
Cohesion: 0.13
Nodes (15): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+7 more)

### Community 110 - "drive/upload/route.ts"
Cohesion: 0.21
Nodes (12): mimeOf(), POST(), POST(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict, TtlCache (+4 more)

### Community 111 - "field-reports.ts"
Cohesion: 0.12
Nodes (17): dynamic, GET(), FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea() (+9 more)

### Community 112 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 113 - "molecule-panel.tsx"
Cohesion: 0.16
Nodes (15): fmtDzd(), FoundList(), MoleculePanel(), arc(), Donut(), DonutSlice, foldTail(), INK (+7 more)

### Community 114 - "document-preview.tsx"
Cohesion: 0.18
Nodes (13): FileViewer(), ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE (+5 more)

### Community 115 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 116 - "departments.ts"
Cohesion: 0.17
Nodes (18): DepartmentsPage(), buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, flattenTree(), getDepartmentMembers() (+10 more)

### Community 117 - "petty-cash.ts"
Cohesion: 0.16
Nodes (17): nextRechargeFor(), canSpendFromPettyCash(), currentPeriod(), grantedTopUpAmount(), LOW_CASH_RATIO, MAX_RECHARGE_DAY, MONTHS_FR, nextRechargeDate() (+9 more)

### Community 118 - "company.ts"
Cohesion: 0.23
Nodes (17): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+9 more)

### Community 119 - "features.ts"
Cohesion: 0.18
Nodes (15): AssistantPage(), dynamic, dynamic, RootPage(), MorningBrief(), refreshMyBrief(), sttConfigured(), CATALOG (+7 more)

### Community 120 - "info-panel.tsx"
Cohesion: 0.24
Nodes (19): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), deleteMessage() (+11 more)

### Community 121 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 122 - "document-mirror.ts"
Cohesion: 0.25
Nodes (13): POST(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder(), ensureDrivePath(), ALREADY_MIRRORED (+5 more)

### Community 123 - "messaging/messages/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), touchPresence() (+5 more)

### Community 124 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 125 - "supplier-portal-actions.ts"
Cohesion: 0.22
Nodes (13): SupplierLoginForm(), SupplierLoginPage(), SupplierLogoutButton(), supplierLogin(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier() (+5 more)

### Community 126 - "sidebar.tsx"
Cohesion: 0.21
Nodes (12): badgeFor(), FLAT_GROUPS, Sidebar(), aliasMatches(), groupIntoPoles(), itemsOfGroup(), NAV_ALIASES, NAV_POLES (+4 more)

### Community 127 - "getMailAccount"
Cohesion: 0.18
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+5 more)

### Community 128 - "office/page.tsx"
Cohesion: 0.32
Nodes (13): OfficeLauncher(), dynamic, OfficePage(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp (+5 more)

### Community 129 - "topbar.tsx"
Cohesion: 0.18
Nodes (14): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), SidebarProps (+6 more)

### Community 130 - "department-budget-actions.ts"
Cohesion: 0.32
Nodes (15): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget(), setDepartmentBudget() (+7 more)

### Community 131 - "raw/route.ts"
Cohesion: 0.23
Nodes (12): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), canViewDrive(), buildDriveZip(), Collected (+4 more)

### Community 132 - "self-test.ts"
Cohesion: 0.22
Nodes (14): dynamic, GET(), runtime, configuredEndpointHost(), deleteObject(), getObject(), putObject(), ConfigDescription (+6 more)

### Community 133 - "org-chart-print.ts"
Cohesion: 0.24
Nodes (11): OrgCanvas(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml(), OrgSvg, PRINT_BOX_H, PRINT_BOX_W (+3 more)

### Community 134 - "drive/[id]/page.tsx"
Cohesion: 0.17
Nodes (11): ConvertPdfButton(), DriveCommentItem, FileActions(), DriveFilePage(), humanSize(), CustomFieldsCard(), toDateValue(), CUSTOM_ENTITY_TYPES (+3 more)

### Community 135 - "(app)/organigramme/page.tsx"
Cohesion: 0.22
Nodes (10): OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), companyLabel(), canEditOrgChart() (+2 more)

### Community 136 - "event-form.tsx"
Cohesion: 0.19
Nodes (9): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt, CreateEventButton(), d10(), EventFields(), Result (+1 more)

### Community 137 - "upload-button.tsx"
Cohesion: 0.23
Nodes (12): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, useBackgroundUpload(), FINGERPRINT_MAX_BYTES (+4 more)

### Community 138 - "anpp-process.tsx"
Cohesion: 0.17
Nodes (13): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), presubOutcome(), REG_CHECKLIST (+5 more)

### Community 139 - "regulatory-actions.ts"
Cohesion: 0.23
Nodes (13): StatusEditor(), addRegulatoryComment(), createRegulatoryProduct(), normalizeDci(), parseProductChannel(), regSupervisorRoles(), setRegulatoryPresubOutcome(), updateRegulatoryProduct() (+5 more)

### Community 140 - "process-intelligence.ts"
Cohesion: 0.18
Nodes (14): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), label(), ModuleStat, PendingValidation, PiAlert (+6 more)

### Community 141 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 142 - "manifest.ts"
Cohesion: 0.21
Nodes (12): CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS (+4 more)

### Community 143 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 144 - "explorer-nav.tsx"
Cohesion: 0.24
Nodes (10): ShareFolderSheet(), SpaceLite, UserLite, shareNodeWithMany(), TRASH_ENTRY, ancestorsOf(), buildNavTree(), FlatFolder (+2 more)

### Community 145 - "new-conversation.tsx"
Cohesion: 0.21
Nodes (10): fd(), MemberMultiSelect(), Mode, NewConversation(), SearchBox(), createChannel(), createDirect(), createGroup() (+2 more)

### Community 146 - "imputation.ts"
Cohesion: 0.26
Nodes (10): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+2 more)

### Community 147 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 148 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 149 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 150 - "budgets/export/route.ts"
Cohesion: 0.30
Nodes (8): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, EnvelopesGrandTotal

### Community 151 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 152 - "driver/page.tsx"
Cohesion: 0.30
Nodes (8): CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DRIVER_MISSION_STATUS, getDriverMissions(), getMissionAttachments(), REQ_INCLUDE

### Community 153 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 154 - "overview/page.tsx"
Cohesion: 0.31
Nodes (9): dynamic, FieldReportsOverviewPage(), dynamic, FieldReportsPage(), FIELD_REPORT_STATUS, canViewFieldReportsOverview(), getFieldReportsOverview(), getMyFieldReports() (+1 more)

### Community 155 - "medical.ts"
Cohesion: 0.24
Nodes (10): Props, DelegatePlanDTO, DoctorDTO, getMedicalData(), InstitutionDTO, mapDoctor(), MedicalData, MedicalVisitRow (+2 more)

### Community 156 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 157 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 158 - "pricing.ts"
Cohesion: 0.27
Nodes (10): buildCompetition(), getPriceForDci(), HospitalRow, matchIqvia(), matchPch(), PriceForDci, PriceStats, pricingDciList() (+2 more)

### Community 159 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 160 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 161 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 162 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 163 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 164 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 165 - "calendar-view.tsx"
Cohesion: 0.25
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND, CALENDAR_INVITE_STATUS

### Community 166 - "dossiers.ts"
Cohesion: 0.36
Nodes (8): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), getDossiers(), isDossierMember(), scopeDossiers()

### Community 167 - "training-panel.tsx"
Cohesion: 0.28
Nodes (6): CaseDocRow, CaseRow, TrainingPanel(), UpRow, OUTCOME_ORDER, OUTCOME_TONES

### Community 168 - "stocks-view.tsx"
Cohesion: 0.22
Nodes (8): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, TabKey, TABS, todayInput(), UserOpt

### Community 169 - "power-tools.ts"
Cohesion: 0.33
Nodes (4): ClaudeToolDef, executePowerTool(), POWER_TOOLS, PowerTool

### Community 170 - "api/workflow.ts"
Cohesion: 0.31
Nodes (8): AvailableAction, genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView, RegWorkflowState

### Community 171 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 172 - "training/for-section.ts"
Cohesion: 0.28
Nodes (6): CaseExtract, OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, OUTCOME_LABELS

### Community 173 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 174 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 175 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 176 - "validation-item-review.tsx"
Cohesion: 0.32
Nodes (7): Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 177 - "bars.tsx"
Cohesion: 0.32
Nodes (7): BarRow, Bars(), COLOR, Meter(), TEXT, toneOf(), STATUS

### Community 178 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 179 - "funding-panel.tsx"
Cohesion: 0.33
Nodes (6): EventFundingPanel(), PmOpt, Props, SubmitButton(), BudgetCategoryOption, WorkflowView

### Community 180 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 181 - "onboarding/page.tsx"
Cohesion: 0.33
Nodes (6): GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage(), NAVIGATION

### Community 182 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 183 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 184 - "user-admin-forms.tsx"
Cohesion: 0.33
Nodes (5): ActiveToggle(), Profile, ProfileForm(), ResetPasswordForm(), RevokeAllButton()

### Community 185 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 186 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 187 - "budget-overview.integration.test.ts"
Cohesion: 0.33
Nodes (4): DAY, PERIOD_END, PERIOD_START, SUPER

### Community 188 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 189 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 190 - "orphans-panel.tsx"
Cohesion: 0.50
Nodes (3): OrphansPanel(), TABLES, UnattachedGroup

### Community 191 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 192 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 193 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 194 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 195 - "row-grants.tsx"
Cohesion: 0.50
Nodes (3): GrantOption, RowGrants(), RowGrantsProps

### Community 196 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 197 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

## Knowledge Gaps
- **1325 isolated node(s):** `dynamic`, `ModuleSpec`, `dynamic`, `TYPE`, `FIELD_KEY` (+1320 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma` to `requireModule`, `utils.ts`, `recordAudit`, `lib/labels.ts`, `requireUser`, `card.tsx`, `getCurrentUser`, `jobs/runner.ts`, `notifyUser`, `events/[id]/page.tsx`, `entities.ts`, `fdStr`, `hasGlobalView`, `aiConfigured`, `congress-request-actions.ts`, `anyRoleFilter`, `build-facts.ts`, `corpus/page.tsx`, `(app)/validations/page.tsx`, `[dossierId]/page.tsx`, `regAudit`, `getAppSettings`, `meeting-actions.ts`, `drive/page.tsx`, `rules/engine.ts`, `formatDateTime`, `platform-audit/engine.ts`, `training-actions.ts`, `mail.ts`, `care-actions.ts`, `agent-core.ts`, `assistant-actions.ts`, `risks.ts`, `ad-pro-item-actions.ts`, `corpus/actions.ts`, `drive-storage.ts`, `lib/session.ts`, `reserves/page.tsx`, `onlyofficeConfigured`, `library-ingest.ts`, `market-research.ts`, `drive-actions.ts`, `promo-material-actions.ts`, `upload/session.ts`, `calendar.ts`, `adoption.ts`, `test-center/runner.ts`, `budget.ts`, `openai-luna.ts`, `assistant.ts`, `prisma.ts`, `rbac.ts`, `(app)/layout.tsx`, `test-center/page.tsx`, `medical-directory.tsx`, `cash-panel.tsx`, `dashboard.ts`, `product-explorer.tsx`, `pch-tender-line-actions.ts`, `workflow/engine.ts`, `stock-board.tsx`, `annuaire/page.tsx`, `lib/ai.ts`, `queries/workflow.ts`, `dossier-actions.ts`, `queries/messaging.ts`, `medical-info-actions.ts`, `messaging-actions.ts`, `aiFeatureEnabled`, `brain-cockpit.tsx`, `scheduled.ts`, `smart-mail-actions.ts`, `general-means.ts`, `reports.ts`, `regulatory/page.tsx`, `pch-detail-client.tsx`, `lifecycle/actions.ts`, `migration-cert.ts`, `export.ts`, `state-machines/explorer.ts`, `directive-actions.ts`, `departments-manager.tsx`, `progress/query.ts`, `portfolio.ts`, `invariants/registry.ts`, `getBlob`, `drive/upload/route.ts`, `field-reports.ts`, `admin-settings-forms.tsx`, `run.ts`, `departments.ts`, `company.ts`, `features.ts`, `auth-actions.ts`, `document-mirror.ts`, `support-actions.ts`, `supplier-portal-actions.ts`, `getMailAccount`, `office/page.tsx`, `department-budget-actions.ts`, `raw/route.ts`, `drive/[id]/page.tsx`, `(app)/organigramme/page.tsx`, `regulatory-actions.ts`, `process-intelligence.ts`, `manifest.ts`, `pch/export/route.ts`, `imputation.ts`, `stock-snapshot-actions.ts`, `hr-documents.ts`, `push.ts`, `driver/page.tsx`, `medical.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `company-actions.ts`, `bd.ts`, `dossiers.ts`, `api/workflow.ts`, `training/for-section.ts`, `onboarding/page.tsx`, `[token]/route.ts`, `budget-overview.integration.test.ts`, `events/[id]/export/route.ts`, `orphans-panel.tsx`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `requireModule`, `utils.ts`, `recordAudit`, `lib/labels.ts`, `card.tsx`, `getCurrentUser`, `notifyUser`, `events/[id]/page.tsx`, `fdStr`, `hasGlobalView`, `aiConfigured`, `congress-request-actions.ts`, `corpus/page.tsx`, `regAudit`, `getAppSettings`, `meeting-actions.ts`, `rules/engine.ts`, `formatDateTime`, `platform-audit/engine.ts`, `training-actions.ts`, `care-actions.ts`, `assistant-actions.ts`, `risks.ts`, `prisma`, `ad-pro-item-actions.ts`, `corpus/actions.ts`, `lib/session.ts`, `reserves/page.tsx`, `onlyofficeConfigured`, `library-ingest.ts`, `drive-actions.ts`, `promo-material-actions.ts`, `adoption.ts`, `budget.ts`, `(app)/layout.tsx`, `test-center/page.tsx`, `medical-directory.tsx`, `cash-panel.tsx`, `dashboard.ts`, `pch-tender-line-actions.ts`, `stock-board.tsx`, `lib/ai.ts`, `budget-forms.tsx`, `dossier-actions.ts`, `medical-info-actions.ts`, `messaging-actions.ts`, `aiFeatureEnabled`, `brain-cockpit.tsx`, `smart-mail-actions.ts`, `general-means.ts`, `molecule.ts`, `reports.ts`, `regulatory-workflow.ts`, `lifecycle/actions.ts`, `directive-actions.ts`, `messenger.tsx`, `departments-manager.tsx`, `products.ts`, `mail-client.tsx`, `molecule-panel.tsx`, `run.ts`, `features.ts`, `info-panel.tsx`, `auth-actions.ts`, `support-actions.ts`, `topbar.tsx`, `department-budget-actions.ts`, `(app)/organigramme/page.tsx`, `anpp-process.tsx`, `regulatory-actions.ts`, `explorer-nav.tsx`, `new-conversation.tsx`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `company-actions.ts`, `dossiers.ts`, `validation-item-review.tsx`, `onboarding/page.tsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `userCan()` connect `requireUser` to `requireModule`, `utils.ts`, `recordAudit`, `lib/labels.ts`, `card.tsx`, `notifyUser`, `events/[id]/page.tsx`, `entities.ts`, `fdStr`, `hasGlobalView`, `congress-request-actions.ts`, `anyRoleFilter`, `(app)/validations/page.tsx`, `getAppSettings`, `meeting-actions.ts`, `drive/page.tsx`, `platform-audit/engine.ts`, `training-actions.ts`, `mail.ts`, `care-actions.ts`, `assistant-actions.ts`, `risks.ts`, `prisma`, `ad-pro-item-actions.ts`, `lib/session.ts`, `onlyofficeConfigured`, `library-ingest.ts`, `market-research.ts`, `drive-actions.ts`, `promo-material-actions.ts`, `calendar.ts`, `adoption.ts`, `assistant.ts`, `rbac.ts`, `(app)/layout.tsx`, `test-center/page.tsx`, `lib/department-budget.ts`, `medical-directory.tsx`, `dashboard.ts`, `product-explorer.tsx`, `pch-tender-line-actions.ts`, `dashboard/page.tsx`, `stock-board.tsx`, `annuaire/page.tsx`, `lib/ai.ts`, `dossier-actions.ts`, `queries/messaging.ts`, `medical-info-actions.ts`, `messaging-actions.ts`, `aiFeatureEnabled`, `general-means.ts`, `molecule.ts`, `regulatory/page.tsx`, `export.ts`, `directive-actions.ts`, `departments-manager.tsx`, `products.ts`, `mail-client.tsx`, `getBlob`, `drive/upload/route.ts`, `field-reports.ts`, `molecule-panel.tsx`, `departments.ts`, `messaging/messages/route.ts`, `support-actions.ts`, `department-budget-actions.ts`, `drive/[id]/page.tsx`, `(app)/organigramme/page.tsx`, `regulatory-actions.ts`, `pch/export/route.ts`, `new-conversation.tsx`, `stock-snapshot-actions.ts`, `budgets/export/route.ts`, `driver/page.tsx`, `reminder-actions.ts`, `company-actions.ts`, `dossiers.ts`, `power-tools.ts`, `api/workflow.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `dynamic`, `ModuleSpec`, `dynamic` to the rest of the system?**
  _1325 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.03419666690714956 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05169034786869182 - nodes in this community are weakly interconnected._
- **Should `recordAudit` be split into smaller, more focused modules?**
  _Cohesion score 0.03401759530791789 - nodes in this community are weakly interconnected._