# Graph Report - src  (2026-08-13)

## Corpus Check
- 1004 files · ~762,834 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6239 nodes · 24559 edges · 199 communities (193 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b62d4657`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- cn
- toNumber
- prisma.ts
- recordAudit
- button.tsx
- lib/labels.ts
- userCan
- getCurrentUser
- resolveRegCompanyId
- requireModule
- lib/audit.ts
- build-facts.ts
- users/[id]/page.tsx
- admin-request-actions.ts
- test-center/runner.ts
- fdNum
- mail.ts
- assistant-actions.ts
- utils.ts
- [dossierId]/page.tsx
- assistant.ts
- anyRoleFilter
- bd-strategic-table.tsx
- openai-luna.ts
- hasGlobalView
- jobs/runner.ts
- care-actions.ts
- fdStr
- drive-actions.ts
- corpus/page.tsx
- ad-pro-item-actions.ts
- drive-storage.ts
- risks.ts
- FindingInput
- budget-forms.tsx
- requireUser
- agent-core.ts
- promo-material-actions.ts
- onlyofficeConfigured
- mistral-ocr.ts
- ocr-engine.ts
- actions/types.ts
- corpus/actions.ts
- training-board.tsx
- library-actions.ts
- batch-runner.ts
- getAppSettings
- product-explorer.tsx
- events/[id]/page.tsx
- anpp-process.tsx
- adoption.ts
- lib/ai.ts
- dossier-actions.ts
- message-thread.tsx
- lib/messaging.ts
- adventum-actions.ts
- messaging-actions.ts
- regAudit
- enregistrement/page.tsx
- (app)/validations/page.tsx
- platform-audit/engine.ts
- formatDate
- market-research.ts
- object-storage.ts
- petty-cash-actions.ts
- storage.ts
- Select
- features.ts
- lib/department-budget.ts
- upload/session.ts
- (app)/layout.tsx
- pch-tender-line-actions.ts
- medical-actions.ts
- query.ts
- competition.ts
- medical-info-actions.ts
- getBlob
- queries/messaging.ts
- upload-manager.tsx
- brain-cockpit.tsx
- drive/[id]/page.tsx
- workflow/engine.ts
- smart-mail-actions.ts
- molecule.ts
- medical-directory.tsx
- topbar.tsx
- explorer.ts
- classify.ts
- mon-dossier/page.tsx
- pch-detail-client.tsx
- extract-text.ts
- scheduled.ts
- workflow-builder.tsx
- messenger.tsx
- lifecycle/actions.ts
- zip-inspector.ts
- migration-cert.ts
- calendar.ts
- congress.ts
- event-form.tsx
- congress-request-actions.ts
- sheet-import.ts
- molecule-panel.tsx
- onboarding-wizard.tsx
- rag.ts
- field-reports.ts
- products.ts
- docgen/actions.ts
- portfolio.ts
- departments.ts
- getMarketData
- admin-settings-forms.tsx
- document-preview.tsx
- meetings/[id]/page.tsx
- run.ts
- build-twin.ts
- org-chart-print.ts
- mail-client.tsx
- receipt-lines.tsx
- regulatory/[id]/page.tsx
- ad-pro-edit-actions.ts
- company.ts
- read-figures.ts
- invariants/registry.ts
- rules/admin-actions.ts
- driver/page.tsx
- supplier/actions.ts
- office-templates.ts
- department-budget-table.tsx
- edit-product.tsx
- regulatory-table.tsx
- process-intelligence.ts
- reports.ts
- calendar-view.tsx
- auth-actions.ts
- rules/engine.ts
- pch/export/route.ts
- workflow.ts
- stock-snapshot-actions.ts
- meetings.ts
- today.ts
- simple-pdf.ts
- test-center/page.tsx
- new-request.tsx
- general-means.ts
- push.ts
- decompose.ts
- background-upload.tsx
- reminder-actions.ts
- radar.ts
- regulatory-drive-mirror.ts
- rule-engine.ts
- company-actions.ts
- regulatory-corpus/page.tsx
- congress-workflow.tsx
- meetings/page.tsx
- parametres/page.tsx
- training-panel.tsx
- regulatory/page.tsx
- departments-manager.tsx
- supplier-auth.ts
- fuzz.ts
- Adventum Autonomous Test Center — architecture
- drive-space-manager.tsx
- zip-viewer.tsx
- missions.ts
- mobile-tabbar.tsx
- client-bundle-guard.test.ts
- mime.ts
- training/for-section.ts
- manufacturing-stage.ts
- congress-request-form.tsx
- delegate-plans.tsx
- push-register.tsx
- seed-packs.ts
- [token]/route.ts
- courses-board.tsx
- step-timeline.tsx
- employee-form.tsx
- validation-item-review.tsx
- workflow/engine.test.ts
- next-auth.d.ts
- test-center-client.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- bv-requests.tsx
- defaults.ts
- mission-stops.tsx
- app/layout.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 636 edges
2. `userCan()` - 481 edges
3. `fdStr()` - 473 edges
4. `recordAudit()` - 413 edges
5. `prisma` - 403 edges
6. `requireModule()` - 220 edges
7. `hasGlobalView()` - 186 edges
8. `Button` - 163 edges
9. `formatDate()` - 146 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/reset-password.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/validation-item.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts

## Import Cycles
- None detected.

## Communities (199 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.04
Nodes (91): AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, ActivityPage(), fmtDuration(), dynamic, metadata (+83 more)

### Community 1 - "cn"
Cohesion: 0.07
Nodes (81): dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic, dynamic, Mode, MODES (+73 more)

### Community 2 - "toNumber"
Cohesion: 0.03
Nodes (109): AdminPage(), fmtBytes(), fmtWhen(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), Budget(), ApprovalButtons(), ApprovalsPage() (+101 more)

### Community 3 - "prisma.ts"
Cohesion: 0.03
Nodes (74): dynamic, GET(), dynamic, esc(), GET(), DirectiveDetailPage(), SupportDetailPage(), actorFor() (+66 more)

### Community 4 - "recordAudit"
Cohesion: 0.05
Nodes (97): FieldsManager(), VariationDTO, VariationPanel(), DeptSheet(), resetActivityTime(), saveAdoptionSettings(), addBdProjectComment(), createBdProduct() (+89 more)

### Community 5 - "button.tsx"
Cohesion: 0.06
Nodes (53): DriveStorageSettings(), OrgBranch(), Citation, Source, Version, Option, RuleDTO, ROLE_OPTIONS (+45 more)

### Community 6 - "lib/labels.ts"
Cohesion: 0.03
Nodes (80): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), FieldDefDTO (+72 more)

### Community 7 - "userCan"
Cohesion: 0.04
Nodes (84): dynamic, POST(), POST(), PresentationCard(), PresentationPanel(), Res, nOrNull(), PlayerEditor() (+76 more)

### Community 8 - "getCurrentUser"
Cohesion: 0.04
Nodes (73): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+65 more)

### Community 9 - "resolveRegCompanyId"
Cohesion: 0.06
Nodes (75): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, ClaudeContentBlock (+67 more)

### Community 10 - "requireModule"
Cohesion: 0.05
Nodes (64): dynamic, EntitesPage(), AdminWorkflowsPage(), dynamic, BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage() (+56 more)

### Community 11 - "lib/audit.ts"
Cohesion: 0.05
Nodes (70): lastAlertByUser, NO_CONTENT, POST(), RequestRow(), PayrollMatrix(), CancelButton(), runAutopilot(), computeStatus() (+62 more)

### Community 12 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 13 - "users/[id]/page.tsx"
Cohesion: 0.05
Nodes (58): NO_CONTENT, POST(), AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState (+50 more)

### Community 14 - "admin-request-actions.ts"
Cohesion: 0.05
Nodes (69): RuleControls(), RuleEditor(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest() (+61 more)

### Community 15 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (55): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), getTestCenterDashboard(), base, Certification, CertificationInput (+47 more)

### Community 16 - "fdNum"
Cohesion: 0.07
Nodes (65): EditTransactionSheet(), OpeningBalance, OpeningBalancesButton(), PayButton(), createBD(), updateBDStatus(), addBudgetExpense(), attributeTransaction() (+57 more)

### Community 17 - "mail.ts"
Cohesion: 0.05
Nodes (67): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+59 more)

### Community 18 - "assistant-actions.ts"
Cohesion: 0.07
Nodes (55): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+47 more)

### Community 19 - "utils.ts"
Cohesion: 0.04
Nodes (50): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+42 more)

### Community 20 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (53): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+45 more)

### Community 21 - "assistant.ts"
Cohesion: 0.07
Nodes (56): Msg, Target, assistantNudge(), NudgeResult, aiConfigured(), ClaudeToolDef, activeUserId(), AssistantActionKind (+48 more)

### Community 22 - "anyRoleFilter"
Cohesion: 0.07
Nodes (53): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+45 more)

### Community 23 - "bd-strategic-table.tsx"
Cohesion: 0.06
Nodes (54): GET(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3() (+46 more)

### Community 24 - "openai-luna.ts"
Cohesion: 0.06
Nodes (53): BATCH_MULTIPLIER, BatchOutcome, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody(), callLuna() (+45 more)

### Community 25 - "hasGlobalView"
Cohesion: 0.08
Nodes (54): TrainingBoard(), AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS (+46 more)

### Community 26 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (56): chunkPageSpan(), splitTextIntoChunksWithOffsets(), reviewDocumentText(), corpusForSection(), submitVersionReviewBatch(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiBatchDefault() (+48 more)

### Community 27 - "care-actions.ts"
Cohesion: 0.11
Nodes (48): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+40 more)

### Community 28 - "fdStr"
Cohesion: 0.09
Nodes (49): DriveCommentItem, DriveComments(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), createCalendarEvent(), deleteCalendarEvent(), parseKind() (+41 more)

### Community 29 - "drive-actions.ts"
Cohesion: 0.10
Nodes (47): POST(), DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, ShareRow() (+39 more)

### Community 30 - "corpus/page.tsx"
Cohesion: 0.08
Nodes (46): CorpusImport(), CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow() (+38 more)

### Community 31 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (47): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), Props, addAdProItem(), AdProModule, approveAdProItemOrder(), audit() (+39 more)

### Community 32 - "drive-storage.ts"
Cohesion: 0.09
Nodes (42): blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptWhole(), masterKey(), putBlob(), putBlobChunked(), putBlobFromFile() (+34 more)

### Community 33 - "risks.ts"
Cohesion: 0.07
Nodes (46): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), updateRiskThresholds(), diff(), getPulse(), hourBucket() (+38 more)

### Community 34 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 35 - "budget-forms.tsx"
Cohesion: 0.08
Nodes (43): GET(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+35 more)

### Community 36 - "requireUser"
Cohesion: 0.08
Nodes (44): CorbeillePage(), ActiveToggle(), SpaceSettingsButton(), ReportEditor(), SimpleReportEditor(), archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+36 more)

### Community 37 - "agent-core.ts"
Cohesion: 0.08
Nodes (34): AgentItem, AgentsPanel(), RunState, extractJson(), listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc (+26 more)

### Community 38 - "promo-material-actions.ts"
Cohesion: 0.16
Nodes (40): fd(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), form(), addPromoComment() (+32 more)

### Community 39 - "onlyofficeConfigured"
Cohesion: 0.12
Nodes (38): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+30 more)

### Community 40 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 41 - "ocr-engine.ts"
Cohesion: 0.09
Nodes (37): LunaCallInput, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr() (+29 more)

### Community 42 - "actions/types.ts"
Cohesion: 0.08
Nodes (33): ImpersonateButton(), SupportActions(), SupportMessageForm(), useAction(), CreateRecordButtonProps, updateAiSettings(), canManage(), setCompanyAccess() (+25 more)

### Community 43 - "corpus/actions.ts"
Cohesion: 0.10
Nodes (32): CorpusAdmin(), CaseCard(), canManage(), createCorpusSourceVersion(), importCorpusFileAction(), Result, seedAnppCorpus(), setCorpusVersionStatus() (+24 more)

### Community 44 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 45 - "library-actions.ts"
Cohesion: 0.09
Nodes (37): ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+29 more)

### Community 46 - "batch-runner.ts"
Cohesion: 0.08
Nodes (34): BatchRequest, fetchBatchOutput(), getBatchStatus(), aiChunkChars(), aiChunkPages(), clampInt(), OffsetChunk, splitTextIntoChunks() (+26 more)

### Community 47 - "getAppSettings"
Cohesion: 0.11
Nodes (35): POST(), dynamic, POST(), DatabasesPage(), createMission(), addDepartmentExpense(), decideDepartmentBudgetRequest(), grantFor() (+27 more)

### Community 48 - "product-explorer.tsx"
Cohesion: 0.08
Nodes (36): AggNum(), BdProjectDetailPage(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS (+28 more)

### Community 49 - "events/[id]/page.tsx"
Cohesion: 0.15
Nodes (32): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), AppealPanel() (+24 more)

### Community 50 - "anpp-process.tsx"
Cohesion: 0.10
Nodes (37): RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), completeStepsThrough(), isRegChecklistKey() (+29 more)

### Community 51 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 52 - "lib/ai.ts"
Cohesion: 0.08
Nodes (29): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModelCheap(), aiSelfTest(), analyzeFieldReport(), AnthropicBlock, apiErrorMessage() (+21 more)

### Community 53 - "dossier-actions.ts"
Cohesion: 0.11
Nodes (34): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction() (+26 more)

### Community 54 - "message-thread.tsx"
Cohesion: 0.10
Nodes (32): MessageAttachments(), Attachments(), ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), Composer() (+24 more)

### Community 55 - "lib/messaging.ts"
Cohesion: 0.08
Nodes (30): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), dynamic (+22 more)

### Community 56 - "adventum-actions.ts"
Cohesion: 0.11
Nodes (29): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+21 more)

### Community 57 - "messaging-actions.ts"
Cohesion: 0.13
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+28 more)

### Community 58 - "regAudit"
Cohesion: 0.13
Nodes (33): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+25 more)

### Community 59 - "enregistrement/page.tsx"
Cohesion: 0.09
Nodes (31): CorpusPage(), dynamic, metadata, TrainingPage(), TrainingPanel(), dynamic, dzd(), EnregistrementPage() (+23 more)

### Community 60 - "(app)/validations/page.tsx"
Cohesion: 0.12
Nodes (32): ValidationsPage(), SupervisionBoard(), VALIDATION_MODE, VALIDATION_STATUS, VALIDATION_STEP_STATE, CONG_STAGE, CrossValidationItem, getMyValidationRequests() (+24 more)

### Community 61 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (33): generatePlatformIdeas(), sttConfigured(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding (+25 more)

### Community 62 - "formatDate"
Cohesion: 0.07
Nodes (30): dynamic, FocusCard(), TodayPage(), BudgetExpenses(), MarketResearchListPage(), ExpenseAckItem, ExpenseAckList(), DossiersPage() (+22 more)

### Community 63 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 64 - "object-storage.ts"
Cohesion: 0.14
Nodes (33): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+25 more)

### Community 65 - "petty-cash-actions.ts"
Cohesion: 0.16
Nodes (29): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+21 more)

### Community 66 - "storage.ts"
Cohesion: 0.10
Nodes (26): GET(), PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind() (+18 more)

### Community 67 - "Select"
Cohesion: 0.07
Nodes (26): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, PmOpt, SubmitButton(), DeleteVisitButton(), EditVisitSheet() (+18 more)

### Community 68 - "features.ts"
Cohesion: 0.10
Nodes (27): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+19 more)

### Community 69 - "lib/department-budget.ts"
Cohesion: 0.16
Nodes (28): DepartmentBudgetsPage(), dynamic, BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget(), canManageDepartmentBudgetAccess(), canRequestDepartmentBudget() (+20 more)

### Community 70 - "upload/session.ts"
Cohesion: 0.11
Nodes (31): IngestResult, buildMessyDossierZip(), makeDocx(), makePng(), makeXlsx(), uploadViaSession(), DEFAULT_PART_SIZE, DirectStartResult (+23 more)

### Community 71 - "(app)/layout.tsx"
Cohesion: 0.09
Nodes (24): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+16 more)

### Community 72 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (28): dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine (+20 more)

### Community 73 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+22 more)

### Community 74 - "query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 75 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 76 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+17 more)

### Community 77 - "getBlob"
Cohesion: 0.12
Nodes (21): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+13 more)

### Community 78 - "queries/messaging.ts"
Cohesion: 0.14
Nodes (25): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+17 more)

### Community 79 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 80 - "brain-cockpit.tsx"
Cohesion: 0.10
Nodes (21): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+13 more)

### Community 81 - "drive/[id]/page.tsx"
Cohesion: 0.10
Nodes (20): ConvertPdfButton(), FileActions(), ShareItem, SharePanel(), MoveTarget, NodeActions(), Props, UserLite (+12 more)

### Community 82 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (27): AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), countAdProItems(), emitFinancials(), ensureInstance() (+19 more)

### Community 83 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 84 - "molecule.ts"
Cohesion: 0.18
Nodes (24): SuggestField(), marketSuggestions(), analyzeMoleculeSafe(), canonicalForm(), dosageMatches(), extractDosage(), FORM_LABEL, FORM_RULES (+16 more)

### Community 85 - "medical-directory.tsx"
Cohesion: 0.10
Nodes (23): BeneficiariesCard(), Beneficiary, Mode, Refs, MedicalDirectory(), Props, Result, SECTOR_ICON (+15 more)

### Community 86 - "topbar.tsx"
Cohesion: 0.11
Nodes (20): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), NotificationPopup() (+12 more)

### Community 87 - "explorer.ts"
Cohesion: 0.17
Nodes (21): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport (+13 more)

### Community 88 - "classify.ts"
Cohesion: 0.13
Nodes (22): dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase() (+14 more)

### Community 89 - "mon-dossier/page.tsx"
Cohesion: 0.11
Nodes (22): dynamic, dynamic, MonDossierPage(), LeaveRequestButton(), MyLeaves(), HrRequestThread(), CONTRACT_TYPE, HR_DOCUMENT_CATEGORY (+14 more)

### Community 90 - "pch-detail-client.tsx"
Cohesion: 0.12
Nodes (22): PchTenderPage(), Action, EditTenderButton(), OrdersManager(), useSubmit(), d10(), LogisticsRow(), Res (+14 more)

### Community 91 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 92 - "scheduled.ts"
Cohesion: 0.14
Nodes (23): AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews(), catchUpStalledPipelines() (+15 more)

### Community 93 - "workflow-builder.tsx"
Cohesion: 0.15
Nodes (19): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+11 more)

### Community 94 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+14 more)

### Community 95 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 96 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 97 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 98 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 99 - "congress.ts"
Cohesion: 0.16
Nodes (20): CongressInternationalPage(), CongressNationalPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressFormData() (+12 more)

### Community 100 - "event-form.tsx"
Cohesion: 0.11
Nodes (19): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT (+11 more)

### Community 101 - "congress-request-actions.ts"
Cohesion: 0.27
Nodes (22): ThirdPartyInvolveButton(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision() (+14 more)

### Community 102 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 103 - "molecule-panel.tsx"
Cohesion: 0.12
Nodes (17): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+9 more)

### Community 104 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (16): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+8 more)

### Community 105 - "rag.ts"
Cohesion: 0.15
Nodes (18): lunaEmbed(), lunaEmbedModel(), searchCorpusAction(), CorpusExtract, queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 106 - "field-reports.ts"
Cohesion: 0.11
Nodes (17): dynamic, GET(), dynamic, POST(), HBars(), PALETTE, StatusDonut(), tooltipStyle (+9 more)

### Community 107 - "products.ts"
Cohesion: 0.18
Nodes (20): MarketProductsPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GalenicForm, MoleculeAnalysis (+12 more)

### Community 108 - "docgen/actions.ts"
Cohesion: 0.16
Nodes (16): FindingsReportButton(), ReserveLetterButton(), useGenerate(), Cycle, Point, RESERVE_TYPES, ReservesPanel(), generateFindingsReportAction() (+8 more)

### Community 109 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 110 - "departments.ts"
Cohesion: 0.15
Nodes (19): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentPath(), getDepartmentSubtreeIds() (+11 more)

### Community 111 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 112 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 113 - "document-preview.tsx"
Cohesion: 0.18
Nodes (13): FileViewer(), ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE (+5 more)

### Community 114 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (17): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+9 more)

### Community 115 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 116 - "build-twin.ts"
Cohesion: 0.14
Nodes (17): complete(), doc(), ADMIN_DOC_CODES, BASE_EXPECTED, BASE_REQUIRED, PROFILES, REGISTRATION_ADMIN_DOCS, Requirements (+9 more)

### Community 117 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 118 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 119 - "receipt-lines.tsx"
Cohesion: 0.27
Nodes (16): CatalogArticle, empty(), ReceiptLines(), Row, readReceipt(), ReceiptDraft, normalizeLines(), parseAmount() (+8 more)

### Community 120 - "regulatory/[id]/page.tsx"
Cohesion: 0.14
Nodes (15): RegulatoryChecklist(), BvItem, REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), ParticipantsPanel(), StatusEditor(), SupervisionControls() (+7 more)

### Community 121 - "ad-pro-edit-actions.ts"
Cohesion: 0.18
Nodes (15): isKind(), TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS, describeChanges() (+7 more)

### Community 122 - "company.ts"
Cohesion: 0.24
Nodes (16): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+8 more)

### Community 123 - "read-figures.ts"
Cohesion: 0.16
Nodes (18): INGESTIBLE, buildFigureCall(), DEFECT_KINDS, FIGURE_KINDS, FIGURE_SCHEMA, FigureKind, FigureObservation, FigureReport (+10 more)

### Community 124 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (12): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+4 more)

### Community 125 - "rules/admin-actions.ts"
Cohesion: 0.22
Nodes (14): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+6 more)

### Community 126 - "driver/page.tsx"
Cohesion: 0.20
Nodes (13): AssistantPage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getAssistantData() (+5 more)

### Community 127 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 128 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 129 - "department-budget-table.tsx"
Cohesion: 0.17
Nodes (15): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), MoyensGenerauxPage() (+7 more)

### Community 130 - "edit-product.tsx"
Cohesion: 0.21
Nodes (13): DciAssociationField(), EditProductButton(), EditProductValues, UserOption, UserOption, SelectField(), TextAreaField(), TextField() (+5 more)

### Community 131 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (13): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegStage, RegulatoryRow (+5 more)

### Community 132 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 133 - "reports.ts"
Cohesion: 0.23
Nodes (12): buildSimpleDocx(), esc(), MISSING_MARKER, paragraph(), SimplePara, buildFindingsReport(), buildReserveResponseLetter(), sanitize() (+4 more)

### Community 134 - "calendar-view.tsx"
Cohesion: 0.18
Nodes (13): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, INVITE_STATUSES (+5 more)

### Community 135 - "auth-actions.ts"
Cohesion: 0.19
Nodes (7): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, authenticate(), changePassword()

### Community 136 - "rules/engine.ts"
Cohesion: 0.22
Nodes (14): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+6 more)

### Community 137 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 138 - "workflow.ts"
Cohesion: 0.21
Nodes (13): Props, BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, loadOutcome(), WorkflowActionView, WorkflowEventView, WorkflowOutcome (+5 more)

### Community 139 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 140 - "meetings.ts"
Cohesion: 0.24
Nodes (9): dynamic, PublicMeetPage(), PublicJoin(), jitsiDomain(), MeetingAccessShape, publicMeetPath(), publicMeetUrl(), roomName() (+1 more)

### Community 141 - "today.ts"
Cohesion: 0.21
Nodes (10): CalendarEventDTO, getToday(), greetingFor(), rankToday(), reasonOf(), REASONS, score(), NOW (+2 more)

### Community 142 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 143 - "test-center/page.tsx"
Cohesion: 0.18
Nodes (11): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+3 more)

### Community 144 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 145 - "general-means.ts"
Cohesion: 0.21
Nodes (12): DeptBudgetGrant, DeptBudgetKind, EMPTY_GRANT, PettyCashStatus, DeptBudgetRequestRow, GeneralMeansCash, GeneralMeansExpense, GeneralMeansPlan (+4 more)

### Community 146 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 147 - "decompose.ts"
Cohesion: 0.24
Nodes (10): asSectionHeader(), CATEGORIES, categorizeReserve(), cleanSectionCode(), decomposeReserveText(), RESERVE_TYPE_LABELS, ReservePoint, ReserveType (+2 more)

### Community 148 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 149 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 150 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 151 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 152 - "rule-engine.ts"
Cohesion: 0.25
Nodes (5): LoadedRule, TwinDoc, loadActiveRules(), loadPresentFactKeys(), RuleTestCase

### Community 153 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 154 - "regulatory-corpus/page.tsx"
Cohesion: 0.33
Nodes (7): dynamic, metadata, RegulatoryCorpusPage(), listCorpusSources(), activeCorpusSize(), listRulePacks(), activeRuleCount()

### Community 155 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 156 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 157 - "parametres/page.tsx"
Cohesion: 0.28
Nodes (7): dynamic, ParametresPage(), Config, DEFAULTS, num(), SettingsForm(), TIERS

### Community 158 - "training-panel.tsx"
Cohesion: 0.31
Nodes (6): CaseDocRow, CaseRow, UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 159 - "regulatory/page.tsx"
Cohesion: 0.28
Nodes (8): NewProductButton(), regStage(), RegulatoryPage(), SuppliersManager(), DOSAGE_UNIT, PHARMA_FORM, isRegulatorySupervisor(), RegWorkflowState

### Community 160 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 161 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 162 - "fuzz.ts"
Cohesion: 0.39
Nodes (8): probeUploads(), BLOCKED_DRIVE_EXTENSIONS, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE, runFuzzing(), SAFE, makeRng()

### Community 163 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 164 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 165 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 166 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 167 - "mobile-tabbar.tsx"
Cohesion: 0.46
Nodes (6): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY

### Community 168 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 169 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 170 - "training/for-section.ts"
Cohesion: 0.29
Nodes (5): CaseExtract, OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base

### Community 171 - "manufacturing-stage.ts"
Cohesion: 0.46
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 172 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 173 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 174 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 175 - "seed-packs.ts"
Cohesion: 0.43
Nodes (6): factTests(), SCENARIOS, ScenarioSpec, sectionTests(), seedRulePacks(), titleFor()

### Community 176 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 177 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 178 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 179 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 180 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 181 - "workflow/engine.test.ts"
Cohesion: 0.33
Nodes (3): getWorkflowDefinitions(), getDefinition(), stepCreate()

### Community 182 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 183 - "test-center-client.tsx"
Cohesion: 0.50
Nodes (4): ENV_LABEL, MODES, ResumeCleanupButton(), resumeTestCleanup()

### Community 184 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 185 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 186 - "bv-requests.tsx"
Cohesion: 0.60
Nodes (4): BV_STATUS, BvRequests(), fmtDate(), fmtDZD()

### Community 187 - "defaults.ts"
Cohesion: 0.50
Nodes (4): defaultDefinition(), defaultSpine(), CATEGORY_LABELS, StepInput

### Community 188 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 190 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

## Knowledge Gaps
- **1249 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1244 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `cn`, `toNumber`, `recordAudit`, `lib/labels.ts`, `userCan`, `getCurrentUser`, `resolveRegCompanyId`, `requireModule`, `lib/audit.ts`, `build-facts.ts`, `users/[id]/page.tsx`, `admin-request-actions.ts`, `test-center/runner.ts`, `fdNum`, `mail.ts`, `assistant-actions.ts`, `utils.ts`, `[dossierId]/page.tsx`, `assistant.ts`, `anyRoleFilter`, `bd-strategic-table.tsx`, `openai-luna.ts`, `hasGlobalView`, `jobs/runner.ts`, `care-actions.ts`, `fdStr`, `drive-actions.ts`, `corpus/page.tsx`, `ad-pro-item-actions.ts`, `drive-storage.ts`, `risks.ts`, `budget-forms.tsx`, `requireUser`, `agent-core.ts`, `promo-material-actions.ts`, `onlyofficeConfigured`, `ocr-engine.ts`, `actions/types.ts`, `corpus/actions.ts`, `library-actions.ts`, `batch-runner.ts`, `getAppSettings`, `events/[id]/page.tsx`, `adoption.ts`, `lib/ai.ts`, `dossier-actions.ts`, `lib/messaging.ts`, `adventum-actions.ts`, `messaging-actions.ts`, `regAudit`, `enregistrement/page.tsx`, `(app)/validations/page.tsx`, `platform-audit/engine.ts`, `formatDate`, `market-research.ts`, `petty-cash-actions.ts`, `storage.ts`, `features.ts`, `lib/department-budget.ts`, `upload/session.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `medical-actions.ts`, `query.ts`, `medical-info-actions.ts`, `getBlob`, `queries/messaging.ts`, `brain-cockpit.tsx`, `drive/[id]/page.tsx`, `workflow/engine.ts`, `smart-mail-actions.ts`, `medical-directory.tsx`, `explorer.ts`, `mon-dossier/page.tsx`, `pch-detail-client.tsx`, `scheduled.ts`, `workflow-builder.tsx`, `lifecycle/actions.ts`, `migration-cert.ts`, `calendar.ts`, `congress.ts`, `event-form.tsx`, `congress-request-actions.ts`, `onboarding-wizard.tsx`, `rag.ts`, `field-reports.ts`, `docgen/actions.ts`, `portfolio.ts`, `departments.ts`, `admin-settings-forms.tsx`, `meetings/[id]/page.tsx`, `run.ts`, `receipt-lines.tsx`, `regulatory/[id]/page.tsx`, `ad-pro-edit-actions.ts`, `company.ts`, `invariants/registry.ts`, `rules/admin-actions.ts`, `driver/page.tsx`, `supplier/actions.ts`, `process-intelligence.ts`, `reports.ts`, `auth-actions.ts`, `pch/export/route.ts`, `workflow.ts`, `stock-snapshot-actions.ts`, `meetings.ts`, `general-means.ts`, `push.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `rule-engine.ts`, `company-actions.ts`, `regulatory-corpus/page.tsx`, `meetings/page.tsx`, `regulatory/page.tsx`, `supplier-auth.ts`, `missions.ts`, `training/for-section.ts`, `seed-packs.ts`, `[token]/route.ts`, `workflow/engine.test.ts`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `cn`, `toNumber`, `prisma.ts`, `recordAudit`, `calendar-view.tsx`, `userCan`, `auth-actions.ts`, `getCurrentUser`, `requireModule`, `lib/audit.ts`, `stock-snapshot-actions.ts`, `users/[id]/page.tsx`, `admin-request-actions.ts`, `test-center/runner.ts`, `fdNum`, `resolveRegCompanyId`, `assistant-actions.ts`, `utils.ts`, `assistant.ts`, `reminder-actions.ts`, `bd-strategic-table.tsx`, `hasGlobalView`, `company-actions.ts`, `care-actions.ts`, `fdStr`, `drive-actions.ts`, `corpus/page.tsx`, `ad-pro-item-actions.ts`, `risks.ts`, `agent-core.ts`, `missions.ts`, `onlyofficeConfigured`, `promo-material-actions.ts`, `actions/types.ts`, `corpus/actions.ts`, `library-actions.ts`, `getAppSettings`, `events/[id]/page.tsx`, `anpp-process.tsx`, `lib/ai.ts`, `dossier-actions.ts`, `lib/messaging.ts`, `adventum-actions.ts`, `messaging-actions.ts`, `test-center-client.tsx`, `regAudit`, `platform-audit/engine.ts`, `petty-cash-actions.ts`, `storage.ts`, `features.ts`, `lib/department-budget.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `medical-actions.ts`, `medical-info-actions.ts`, `brain-cockpit.tsx`, `drive/[id]/page.tsx`, `smart-mail-actions.ts`, `molecule.ts`, `medical-directory.tsx`, `topbar.tsx`, `mon-dossier/page.tsx`, `workflow-builder.tsx`, `messenger.tsx`, `lifecycle/actions.ts`, `congress-request-actions.ts`, `onboarding-wizard.tsx`, `rag.ts`, `products.ts`, `docgen/actions.ts`, `run.ts`, `ad-pro-edit-actions.ts`, `rules/admin-actions.ts`, `supplier/actions.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `cn`, `toNumber`, `prisma.ts`, `department-budget-table.tsx`, `recordAudit`, `lib/labels.ts`, `pch/export/route.ts`, `requireModule`, `lib/audit.ts`, `stock-snapshot-actions.ts`, `users/[id]/page.tsx`, `admin-request-actions.ts`, `test-center/page.tsx`, `fdNum`, `general-means.ts`, `assistant-actions.ts`, `utils.ts`, `reminder-actions.ts`, `anyRoleFilter`, `assistant.ts`, `bd-strategic-table.tsx`, `company-actions.ts`, `hasGlobalView`, `care-actions.ts`, `fdStr`, `drive-actions.ts`, `parametres/page.tsx`, `regulatory/page.tsx`, `ad-pro-item-actions.ts`, `risks.ts`, `budget-forms.tsx`, `requireUser`, `promo-material-actions.ts`, `onlyofficeConfigured`, `actions/types.ts`, `getAppSettings`, `product-explorer.tsx`, `events/[id]/page.tsx`, `adoption.ts`, `lib/ai.ts`, `dossier-actions.ts`, `lib/messaging.ts`, `adventum-actions.ts`, `messaging-actions.ts`, `(app)/validations/page.tsx`, `formatDate`, `market-research.ts`, `petty-cash-actions.ts`, `lib/department-budget.ts`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `medical-actions.ts`, `medical-info-actions.ts`, `getBlob`, `queries/messaging.ts`, `drive/[id]/page.tsx`, `molecule.ts`, `pch-detail-client.tsx`, `calendar.ts`, `congress.ts`, `congress-request-actions.ts`, `field-reports.ts`, `products.ts`, `regulatory/[id]/page.tsx`, `ad-pro-edit-actions.ts`, `driver/page.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1249 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0435823754789272 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06823877876509456 - nodes in this community are weakly interconnected._
- **Should `toNumber` be split into smaller, more focused modules?**
  _Cohesion score 0.030649970184853905 - nodes in this community are weakly interconnected._