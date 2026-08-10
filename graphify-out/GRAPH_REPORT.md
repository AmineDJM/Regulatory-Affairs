# Graph Report - src  (2026-08-10)

## Corpus Check
- 1001 files · ~752,285 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6199 nodes · 24473 edges · 167 communities (161 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1cab24c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- button.tsx
- requireModule
- card.tsx
- lib/labels.ts
- prisma.ts
- department-budget-actions.ts
- drive-storage.ts
- userCan
- recordAudit
- rbac.ts
- fdNum
- requireUser
- batch-runner.ts
- (app)/organigramme/page.tsx
- dossier-agent.ts
- mail.ts
- build-facts.ts
- lib/audit.ts
- upload/session.ts
- corpus/actions.ts
- regulatory/[id]/page.tsx
- corpus/page.tsx
- promo-material-actions.ts
- jobs/runner.ts
- getCurrentUser
- anyRoleFilter
- users/[id]/page.tsx
- rules/engine.ts
- training-actions.ts
- meeting-actions.ts
- fdStr
- aiConfigured
- FindingInput
- getCompanyScope
- assistant-actions.ts
- care-actions.ts
- workflow.ts
- assistant.ts
- hasGlobalView
- rh/[id]/page.tsx
- agent-core.ts
- [dossierId]/page.tsx
- ocr-engine.ts
- mistral-ocr.ts
- ingest-dossier.ts
- topbar.tsx
- drive/page.tsx
- regAudit
- reserves/page.tsx
- market-research.ts
- events/[id]/page.tsx
- dossier-actions.ts
- adoption.ts
- onlyofficeConfigured
- test-center/page.tsx
- ad-pro-item-actions.ts
- platform-audit/engine.ts
- test-center/runner.ts
- workflow/engine.ts
- drive-actions.ts
- information-medicale/[id]/page.tsx
- anpp-process.tsx
- aujourdhui/page.tsx
- calendar.ts
- getBlob
- mon-espace/page.tsx
- message-thread.tsx
- budgets/page.tsx
- medical-actions.ts
- classify.ts
- competition.ts
- bd-strategic-table.tsx
- document-preview.tsx
- upload-manager.tsx
- query.ts
- (app)/layout.tsx
- pipeline.upload.e2e.test.ts
- budget.ts
- smart-mail-actions.ts
- support-actions.ts
- items-panel.tsx
- scheduled.ts
- company.ts
- notify.ts
- reports.ts
- market/engine.ts
- extract-text.ts
- product-explorer.tsx
- directive-actions.ts
- lifecycle/actions.ts
- run.ts
- migration-cert.ts
- brain-cockpit.tsx
- budget-forms.tsx
- products.ts
- congress.ts
- supplier/actions.ts
- enregistrement/page.tsx
- portfolio.ts
- molecule.ts
- risks.ts
- explorer.ts
- adventum-brain/page.tsx
- mail-client.tsx
- event-form.tsx
- rag.ts
- invariants/registry.ts
- admin-settings-forms.tsx
- messenger.tsx
- supervision-board.tsx
- onboarding-wizard.tsx
- getMarketData
- library-ingest.ts
- ingest.ts
- reglages/page.tsx
- queries/messaging.ts
- promo-material/[id]/page.tsx
- info-panel.tsx
- toNumber
- ad-pro-edit-actions.ts
- mission-item.tsx
- pch.ts
- auth-actions.ts
- field-reports.ts
- office-templates.ts
- process-intelligence.ts
- event-actions.ts
- today.ts
- access.ts
- compare-versions.ts
- stock-snapshot-actions.ts
- simple-pdf.ts
- manifest.ts
- messaging/messages/route.ts
- push.ts
- lib/messaging.ts
- background-upload.tsx
- reminder-actions.ts
- radar.ts
- pch-tender-export.ts
- regulatory-drive-mirror.ts
- database-admin-actions.ts
- meetings/page.tsx
- supplier-auth.ts
- ad-pro-transfer-actions.ts
- drive/[id]/page.tsx
- assistant-files.ts
- Adventum Autonomous Test Center — architecture
- risk-settings.ts
- field-reports/page.tsx
- missions.ts
- client-bundle-guard.test.ts
- overview-charts.tsx
- [token]/route.ts
- ai-settings-form.tsx
- next-auth.d.ts
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 643 edges
2. `userCan()` - 481 edges
3. `fdStr()` - 476 edges
4. `recordAudit()` - 414 edges
5. `prisma` - 404 edges
6. `requireModule()` - 218 edges
7. `hasGlobalView()` - 187 edges
8. `Button` - 163 edges
9. `formatDate()` - 146 edges
10. `cn()` - 143 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (167 total, 6 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.06
Nodes (95): dynamic, dynamic, TrashItem, TrashList(), TYPES, ACTION_COLS, ACTION_LABELS, dynamic (+87 more)

### Community 1 - "button.tsx"
Cohesion: 0.04
Nodes (87): Option, RuleDTO, DoctorOpt, UserOpt, RestoreButton(), CoursesBoard(), CourseStopDTO, deadlineLabel() (+79 more)

### Community 2 - "requireModule"
Cohesion: 0.03
Nodes (130): AdminFeedbackPage(), AdminSuppliersPage(), AdminUserPage(), AdminValidationsPage(), dec(), Group(), STAGE, FocusCard() (+122 more)

### Community 3 - "card.tsx"
Cohesion: 0.03
Nodes (100): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata, MailTester(), CourrierAdminPage() (+92 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (104): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), AuditPanel(), AuditRow, AuditTable() (+96 more)

### Community 5 - "prisma.ts"
Cohesion: 0.04
Nodes (53): dynamic, GET(), dynamic, GET(), GET(), dynamic, runtime, dynamic (+45 more)

### Community 6 - "department-budget-actions.ts"
Cohesion: 0.06
Nodes (84): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm() (+76 more)

### Community 7 - "drive-storage.ts"
Cohesion: 0.05
Nodes (78): GET(), POST(), dynamic, POST(), dynamic, POST(), POST(), dynamic (+70 more)

### Community 8 - "userCan"
Cohesion: 0.04
Nodes (88): POST(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR (+80 more)

### Community 9 - "recordAudit"
Cohesion: 0.05
Nodes (93): RuleControls(), RuleEditor(), EventForm(), AttachmentValidationBlock(), RequestActions(), RevisionRequest(), RequestRow(), addRequestComment() (+85 more)

### Community 10 - "rbac.ts"
Cohesion: 0.04
Nodes (81): GET(), AccessByModulePage(), Props, dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), SearchPage() (+73 more)

### Community 11 - "fdNum"
Cohesion: 0.05
Nodes (83): ConnectMailbox(), EditTransactionSheet(), PayButton(), EditTenderButton(), OrdersManager(), useSubmit(), CancelButton(), createBD() (+75 more)

### Community 12 - "requireUser"
Cohesion: 0.05
Nodes (82): CorbeillePage(), FieldsManager(), EditVisitSheet(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange() (+74 more)

### Community 13 - "batch-runner.ts"
Cohesion: 0.05
Nodes (73): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+65 more)

### Community 14 - "(app)/organigramme/page.tsx"
Cohesion: 0.05
Nodes (63): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage() (+55 more)

### Community 15 - "dossier-agent.ts"
Cohesion: 0.06
Nodes (67): Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, callClaude(), askDossierAgentAction() (+59 more)

### Community 16 - "mail.ts"
Cohesion: 0.05
Nodes (73): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+65 more)

### Community 17 - "build-facts.ts"
Cohesion: 0.05
Nodes (60): AssignmentMatrix(), key(), nOr0(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn (+52 more)

### Community 18 - "lib/audit.ts"
Cohesion: 0.05
Nodes (53): EntitiesManager(), EntityRow, PALETTE, ActiveToggle(), ImpersonateButton(), EventDetail(), CreateRecordButtonProps, resetActivityTime() (+45 more)

### Community 19 - "upload/session.ts"
Cohesion: 0.06
Nodes (65): dynamic, GET(), runtime, dynamic, POST(), runtime, dynamic, maxDuration (+57 more)

### Community 20 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (51): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CorpusImport(), Row (+43 more)

### Community 21 - "regulatory/[id]/page.tsx"
Cohesion: 0.05
Nodes (57): SuppliesManager(), SupplyArticleRow, OpeningBalance, OpeningBalancesButton(), DciAssociationField(), EditProductButton(), EditProductValues, UserOption (+49 more)

### Community 22 - "corpus/page.tsx"
Cohesion: 0.06
Nodes (61): CorpusPanel(), dynamic, metadata, SourceRow(), SourceWithVersion, LunaCallInput, ANPP_WATCH_PAGES, BINDING (+53 more)

### Community 23 - "promo-material-actions.ts"
Cohesion: 0.09
Nodes (57): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+49 more)

### Community 24 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (60): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), Enrichment, EnrichmentContext, enrichVersionFindings() (+52 more)

### Community 25 - "getCurrentUser"
Cohesion: 0.06
Nodes (51): dynamic, POST(), POST(), dynamic, esc(), GET(), dynamic, POST() (+43 more)

### Community 26 - "anyRoleFilter"
Cohesion: 0.07
Nodes (54): AffectationsPage(), dynamic, dynamic, EquipesPage(), Cap, Kam, KamRow(), numOrNull() (+46 more)

### Community 27 - "users/[id]/page.tsx"
Cohesion: 0.06
Nodes (51): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), ModuleAccessGrid(), AccessMatrix(), ModuleAccessRow (+43 more)

### Community 28 - "rules/engine.ts"
Cohesion: 0.07
Nodes (49): KIND_LABEL, Pack, Rule, RulePacksAdmin(), sectionByCode(), canManage(), PackTestReport, Result (+41 more)

### Community 29 - "training-actions.ts"
Cohesion: 0.08
Nodes (53): dynamic, FormationsPage(), metadata, TrainingBoard(), TrainingParticipantRow, TrainingRow, attachFiles(), createHrTraining() (+45 more)

### Community 30 - "meeting-actions.ts"
Cohesion: 0.07
Nodes (51): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+43 more)

### Community 31 - "fdStr"
Cohesion: 0.09
Nodes (59): SpaceSettingsButton(), ReportEditor(), SimpleReportEditor(), InfoPanel(), Messenger(), NewConversation(), archiveDriveSpace(), createDriveSpace() (+51 more)

### Community 32 - "aiConfigured"
Cohesion: 0.06
Nodes (44): dynamic, GET(), runAiHealthCheckNow(), AiHealthCheckButton(), AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata (+36 more)

### Community 33 - "FindingInput"
Cohesion: 0.10
Nodes (43): ACTIONS, accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing() (+35 more)

### Community 34 - "getCompanyScope"
Cohesion: 0.06
Nodes (48): GET(), dynamic, maxDuration, POST(), runtime, dynamic, maxDuration, POST() (+40 more)

### Community 35 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (49): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+41 more)

### Community 36 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 37 - "workflow.ts"
Cohesion: 0.07
Nodes (44): AdminWorkflowsPage(), dynamic, blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), EventFundingPanel(), PmOpt (+36 more)

### Community 38 - "assistant.ts"
Cohesion: 0.07
Nodes (46): ClaudeToolDef, activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+38 more)

### Community 39 - "hasGlobalView"
Cohesion: 0.11
Nodes (46): CorbeillePage(), ThirdPartyInvolveButton(), toggleMissionStop(), runAutopilot(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor() (+38 more)

### Community 40 - "rh/[id]/page.tsx"
Cohesion: 0.06
Nodes (37): ExpenseAckItem, ExpenseAckList(), dynamic, MonDossierPage(), CancelRequestButton(), CompanyAccessCard(), CompanyAccessRow, EmployeeForm() (+29 more)

### Community 41 - "agent-core.ts"
Cohesion: 0.08
Nodes (32): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc, AgentFinding (+24 more)

### Community 42 - "[dossierId]/page.tsx"
Cohesion: 0.08
Nodes (42): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+34 more)

### Community 43 - "ocr-engine.ts"
Cohesion: 0.09
Nodes (39): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+31 more)

### Community 44 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 45 - "ingest-dossier.ts"
Cohesion: 0.08
Nodes (43): dynamic, maxDuration, POST(), runtime, archiveQueue, attachArchive(), clampInt(), enqueueArchive() (+35 more)

### Community 46 - "topbar.tsx"
Cohesion: 0.07
Nodes (33): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), CommandPalette(), Item, SearchResult, Company, CompanySwitcher() (+25 more)

### Community 47 - "drive/page.tsx"
Cohesion: 0.08
Nodes (35): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt, DriveRow, DriveTable(), DropCategory, MoveTarget (+27 more)

### Community 48 - "regAudit"
Cohesion: 0.10
Nodes (36): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+28 more)

### Community 49 - "reserves/page.tsx"
Cohesion: 0.09
Nodes (35): dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, RegScopeCard() (+27 more)

### Community 50 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 51 - "events/[id]/page.tsx"
Cohesion: 0.16
Nodes (31): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), dynamic, EventDetailPage(), eventValidationSteps(), AppealPanel(), SPONSORING_DOC_CATEGORIES (+23 more)

### Community 52 - "dossier-actions.ts"
Cohesion: 0.11
Nodes (36): DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite (+28 more)

### Community 53 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 54 - "onlyofficeConfigured"
Cohesion: 0.14
Nodes (31): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+23 more)

### Community 55 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (29): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+21 more)

### Community 56 - "ad-pro-item-actions.ts"
Cohesion: 0.15
Nodes (35): ItemLifecycle(), addAdProItem(), AdProModule, approveAdProItemOrder(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED (+27 more)

### Community 57 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 58 - "test-center/runner.ts"
Cohesion: 0.10
Nodes (29): sttConfigured(), base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+21 more)

### Community 59 - "workflow/engine.ts"
Cohesion: 0.10
Nodes (33): getManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep(), countAdProItems() (+25 more)

### Community 60 - "drive-actions.ts"
Cohesion: 0.14
Nodes (28): FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions(), Props (+20 more)

### Community 61 - "information-medicale/[id]/page.tsx"
Cohesion: 0.16
Nodes (28): DeclarationDetailPage(), dynamic, AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm() (+20 more)

### Community 62 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (31): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), completeStepsThrough(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP (+23 more)

### Community 63 - "aujourdhui/page.tsx"
Cohesion: 0.12
Nodes (25): dynamic, metadata, VersionsPage(), VersionsManager(), AssistantPage(), dynamic, dynamic, TodayPage() (+17 more)

### Community 64 - "calendar.ts"
Cohesion: 0.12
Nodes (29): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CalendarPage(), dynamic, CalendarInviteeDTO (+21 more)

### Community 65 - "getBlob"
Cohesion: 0.11
Nodes (24): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+16 more)

### Community 66 - "mon-espace/page.tsx"
Cohesion: 0.09
Nodes (26): AccessUser, ACTION_COLS, ACTION_LABELS, Opt, UserModuleState, ACTION_FR, dynamic, ROW_SCOPED (+18 more)

### Community 67 - "message-thread.tsx"
Cohesion: 0.12
Nodes (25): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, UploadedAttachment, EMOJI_PALETTE (+17 more)

### Community 68 - "budgets/page.tsx"
Cohesion: 0.12
Nodes (23): dynamic, fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter() (+15 more)

### Community 69 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), DeleteVisitButton(), createDoctor(), createInstitution() (+22 more)

### Community 70 - "classify.ts"
Cohesion: 0.11
Nodes (25): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+17 more)

### Community 71 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 72 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (25): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+17 more)

### Community 73 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 74 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 75 - "query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 76 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (21): AppLayout(), ActivityTracker(), Geo, send(), UAData, ImpersonationBanner(), audio(), desktop() (+13 more)

### Community 77 - "pipeline.upload.e2e.test.ts"
Cohesion: 0.13
Nodes (20): flushOriginalArchives(), releaseDossierBlobs(), runRegulatoryJob(), buildDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx() (+12 more)

### Community 78 - "budget.ts"
Cohesion: 0.13
Nodes (20): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView (+12 more)

### Community 79 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 80 - "support-actions.ts"
Cohesion: 0.16
Nodes (22): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+14 more)

### Community 81 - "items-panel.tsx"
Cohesion: 0.15
Nodes (20): AdProItemsPanel(), EditItemForm(), ItemRow, Props, AD_PRO_PARENTS, AdProParent, breakdown, budgetKindLocked() (+12 more)

### Community 82 - "scheduled.ts"
Cohesion: 0.14
Nodes (24): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+16 more)

### Community 83 - "company.ts"
Cohesion: 0.17
Nodes (21): dynamic, GET(), runtime, AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany() (+13 more)

### Community 84 - "notify.ts"
Cohesion: 0.13
Nodes (20): DriveComments(), RequestThread(), Res, deleteDriveComment(), postDriveComment(), markAllNotificationsRead(), markNotificationRead(), sendBroadcast() (+12 more)

### Community 85 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 86 - "market/engine.ts"
Cohesion: 0.18
Nodes (23): dominantOrigin(), enrichLineById(), matchOurProduct(), parseBoxSize(), allowedMfg(), allTokensIn(), bucket(), CompetitionRow (+15 more)

### Community 87 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 88 - "product-explorer.tsx"
Cohesion: 0.12
Nodes (22): AggNum(), fmtDzd(), fmtDzd(), fmtPct(), fmtUsd(), MarketOverviewPage(), pctTone(), fmtDzd() (+14 more)

### Community 89 - "directive-actions.ts"
Cohesion: 0.16
Nodes (21): DirectiveDetailPage(), MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate() (+13 more)

### Community 90 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 91 - "run.ts"
Cohesion: 0.14
Nodes (17): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), runSimulationAction(), AiFn, dossierSummary() (+9 more)

### Community 92 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 93 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (18): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+10 more)

### Community 94 - "budget-forms.tsx"
Cohesion: 0.18
Nodes (22): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategorySheet() (+14 more)

### Community 95 - "products.ts"
Cohesion: 0.17
Nodes (21): dynamic, MarketProductsPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GalenicForm (+13 more)

### Community 96 - "congress.ts"
Cohesion: 0.16
Nodes (20): CongressInternationalPage(), CongressNationalPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressFormData() (+12 more)

### Community 97 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 98 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 99 - "portfolio.ts"
Cohesion: 0.16
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 100 - "molecule.ts"
Cohesion: 0.21
Nodes (21): analyzeMoleculeSafe(), canonicalForm(), dosageMatches(), extractDosage(), FORM_RULES, GALENIC_FORMS, moleculeMatches(), moleculeStem() (+13 more)

### Community 101 - "risks.ts"
Cohesion: 0.14
Nodes (22): adminRequestRisks(), AutopilotPayload, budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks() (+14 more)

### Community 102 - "explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 103 - "adventum-brain/page.tsx"
Cohesion: 0.15
Nodes (20): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+12 more)

### Community 104 - "mail-client.tsx"
Cohesion: 0.13
Nodes (20): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+12 more)

### Community 105 - "event-form.tsx"
Cohesion: 0.11
Nodes (19): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT (+11 more)

### Community 106 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 107 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (15): PERMISSIONS, pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES (+7 more)

### Community 108 - "admin-settings-forms.tsx"
Cohesion: 0.13
Nodes (20): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+12 more)

### Community 109 - "messenger.tsx"
Cohesion: 0.16
Nodes (19): SendPayload, ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, Props (+11 more)

### Community 110 - "supervision-board.tsx"
Cohesion: 0.21
Nodes (18): SupervisionBoard(), SupervisedValidationItem, daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow (+10 more)

### Community 111 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 112 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 113 - "library-ingest.ts"
Cohesion: 0.17
Nodes (18): buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule(), parseExtraction() (+10 more)

### Community 114 - "ingest.ts"
Cohesion: 0.16
Nodes (17): dynamic, maxDuration, POST(), runtime, asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType() (+9 more)

### Community 115 - "reglages/page.tsx"
Cohesion: 0.23
Nodes (16): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), BudgetSettingsPage(), dynamic, rememberBudgetEnvelope(), BUDGET_COOKIE (+8 more)

### Community 116 - "queries/messaging.ts"
Cohesion: 0.18
Nodes (19): dynamic, MessagesPage(), presenceOf(), annotateReceipts(), AttachmentDTO, ConversationCore, describe(), getConversationDetail() (+11 more)

### Community 117 - "promo-material/[id]/page.tsx"
Cohesion: 0.17
Nodes (17): dynamic, PROMO_DOC_CATEGORIES, PromoMaterialDetailPage(), promoSteps(), ValidationStepper(), VStep, VStepState, CompanyLite (+9 more)

### Community 118 - "info-panel.tsx"
Cohesion: 0.13
Nodes (13): PresenceDot(), AddMembers(), cid(), Row(), MemberMultiSelect(), Mode, SearchBox(), Avatar() (+5 more)

### Community 119 - "toNumber"
Cohesion: 0.17
Nodes (17): dynamic, PaiePage(), getActionCenter(), resolve(), getBudgetCategoryOptions(), CONG_STAGE, CrossValidationItem, getCrossModuleValidations() (+9 more)

### Community 120 - "ad-pro-edit-actions.ts"
Cohesion: 0.19
Nodes (15): isKind(), TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS, describeChanges() (+7 more)

### Community 121 - "mission-item.tsx"
Cohesion: 0.22
Nodes (16): MISSION_DOC_CATEGORIES, canManageComment(), deleteComment(), updateComment(), addMissionComment(), assignMission(), issueMissionOrder(), MISSION_ROLES (+8 more)

### Community 122 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 123 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 124 - "field-reports.ts"
Cohesion: 0.18
Nodes (12): dynamic, GET(), dynamic, FieldReportPage(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem, FieldReportsOverview (+4 more)

### Community 125 - "office-templates.ts"
Cohesion: 0.21
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 126 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 127 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 128 - "today.ts"
Cohesion: 0.19
Nodes (11): CalendarEventDTO, ActionItem, greetingFor(), rankToday(), reasonOf(), REASONS, score(), NOW (+3 more)

### Community 129 - "access.ts"
Cohesion: 0.15
Nodes (9): ASSISTANT_PERMS, DIRECTION_PERMS, HEAD_PERMS, REG_PERMISSIONS, RegPermission, regPermissions(), ROLE_REG_PERMS, RoleBearer (+1 more)

### Community 130 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 131 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 132 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 133 - "manifest.ts"
Cohesion: 0.21
Nodes (11): CleanupResult, deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS, VerifyResult (+3 more)

### Community 134 - "messaging/messages/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+1 more)

### Community 135 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 136 - "lib/messaging.ts"
Cohesion: 0.27
Nodes (9): DOT, blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect, PRESENCE_LABEL, signBlob() (+1 more)

### Community 137 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 138 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 139 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 140 - "pch-tender-export.ts"
Cohesion: 0.29
Nodes (7): boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, TenderExportHeader, TenderExportLine, header

### Community 141 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 142 - "database-admin-actions.ts"
Cohesion: 0.38
Nodes (8): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs(), formatBytes()

### Community 143 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 144 - "supplier-auth.ts"
Cohesion: 0.31
Nodes (9): SupplierLoginPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession (+1 more)

### Community 145 - "ad-pro-transfer-actions.ts"
Cohesion: 0.29
Nodes (9): AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS, readSource() (+1 more)

### Community 146 - "drive/[id]/page.tsx"
Cohesion: 0.31
Nodes (6): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), UploadButton(), fileTypeLabel()

### Community 147 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 148 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 149 - "risk-settings.ts"
Cohesion: 0.36
Nodes (6): RiskThresholdsForm(), updateRiskThresholds(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 150 - "field-reports/page.tsx"
Cohesion: 0.43
Nodes (6): NewReportButton(), dynamic, FieldReportsPage(), canViewFieldReportsOverview(), getMyFieldReports(), viewsAllReports()

### Community 151 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 152 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 153 - "overview-charts.tsx"
Cohesion: 0.29
Nodes (6): HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), NamedCount

### Community 154 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 155 - "ai-settings-form.tsx"
Cohesion: 0.33
Nodes (5): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle()

### Community 156 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 157 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1241 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1236 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `utils.ts`, `requireModule`, `card.tsx`, `lib/labels.ts`, `department-budget-actions.ts`, `drive-storage.ts`, `userCan`, `recordAudit`, `rbac.ts`, `fdNum`, `requireUser`, `batch-runner.ts`, `(app)/organigramme/page.tsx`, `dossier-agent.ts`, `mail.ts`, `build-facts.ts`, `lib/audit.ts`, `upload/session.ts`, `corpus/actions.ts`, `regulatory/[id]/page.tsx`, `corpus/page.tsx`, `promo-material-actions.ts`, `jobs/runner.ts`, `getCurrentUser`, `anyRoleFilter`, `users/[id]/page.tsx`, `rules/engine.ts`, `training-actions.ts`, `meeting-actions.ts`, `fdStr`, `aiConfigured`, `getCompanyScope`, `assistant-actions.ts`, `care-actions.ts`, `workflow.ts`, `assistant.ts`, `hasGlobalView`, `rh/[id]/page.tsx`, `agent-core.ts`, `[dossierId]/page.tsx`, `ingest-dossier.ts`, `drive/page.tsx`, `regAudit`, `reserves/page.tsx`, `market-research.ts`, `events/[id]/page.tsx`, `dossier-actions.ts`, `adoption.ts`, `onlyofficeConfigured`, `test-center/page.tsx`, `ad-pro-item-actions.ts`, `platform-audit/engine.ts`, `test-center/runner.ts`, `workflow/engine.ts`, `drive-actions.ts`, `information-medicale/[id]/page.tsx`, `aujourdhui/page.tsx`, `calendar.ts`, `getBlob`, `mon-espace/page.tsx`, `medical-actions.ts`, `bd-strategic-table.tsx`, `query.ts`, `(app)/layout.tsx`, `pipeline.upload.e2e.test.ts`, `budget.ts`, `smart-mail-actions.ts`, `support-actions.ts`, `scheduled.ts`, `company.ts`, `notify.ts`, `reports.ts`, `directive-actions.ts`, `lifecycle/actions.ts`, `run.ts`, `migration-cert.ts`, `congress.ts`, `supplier/actions.ts`, `portfolio.ts`, `risks.ts`, `explorer.ts`, `adventum-brain/page.tsx`, `event-form.tsx`, `rag.ts`, `invariants/registry.ts`, `admin-settings-forms.tsx`, `onboarding-wizard.tsx`, `library-ingest.ts`, `ingest.ts`, `reglages/page.tsx`, `queries/messaging.ts`, `promo-material/[id]/page.tsx`, `toNumber`, `ad-pro-edit-actions.ts`, `mission-item.tsx`, `pch.ts`, `auth-actions.ts`, `field-reports.ts`, `process-intelligence.ts`, `event-actions.ts`, `access.ts`, `compare-versions.ts`, `stock-snapshot-actions.ts`, `manifest.ts`, `push.ts`, `lib/messaging.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `database-admin-actions.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `ad-pro-transfer-actions.ts`, `drive/[id]/page.tsx`, `risk-settings.ts`, `missions.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `utils.ts`, `requireModule`, `card.tsx`, `lib/labels.ts`, `prisma.ts`, `department-budget-actions.ts`, `drive-storage.ts`, `userCan`, `recordAudit`, `rbac.ts`, `fdNum`, `reminder-actions.ts`, `(app)/organigramme/page.tsx`, `database-admin-actions.ts`, `mail.ts`, `ad-pro-transfer-actions.ts`, `lib/audit.ts`, `dossier-agent.ts`, `stock-snapshot-actions.ts`, `risk-settings.ts`, `corpus/actions.ts`, `missions.ts`, `promo-material-actions.ts`, `getCurrentUser`, `corpus/page.tsx`, `users/[id]/page.tsx`, `rules/engine.ts`, `training-actions.ts`, `meeting-actions.ts`, `fdStr`, `aiConfigured`, `getCompanyScope`, `assistant-actions.ts`, `care-actions.ts`, `workflow.ts`, `hasGlobalView`, `rh/[id]/page.tsx`, `agent-core.ts`, `topbar.tsx`, `regAudit`, `reserves/page.tsx`, `events/[id]/page.tsx`, `dossier-actions.ts`, `onlyofficeConfigured`, `test-center/page.tsx`, `ad-pro-item-actions.ts`, `platform-audit/engine.ts`, `drive-actions.ts`, `information-medicale/[id]/page.tsx`, `aujourdhui/page.tsx`, `medical-actions.ts`, `(app)/layout.tsx`, `smart-mail-actions.ts`, `support-actions.ts`, `notify.ts`, `reports.ts`, `directive-actions.ts`, `lifecycle/actions.ts`, `run.ts`, `brain-cockpit.tsx`, `products.ts`, `supplier/actions.ts`, `mail-client.tsx`, `onboarding-wizard.tsx`, `reglages/page.tsx`, `ad-pro-edit-actions.ts`, `mission-item.tsx`, `auth-actions.ts`, `event-actions.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `utils.ts`, `requireModule`, `card.tsx`, `lib/labels.ts`, `prisma.ts`, `messaging/messages/route.ts`, `drive-storage.ts`, `department-budget-actions.ts`, `recordAudit`, `reminder-actions.ts`, `fdNum`, `requireUser`, `rbac.ts`, `(app)/organigramme/page.tsx`, `mail.ts`, `drive/[id]/page.tsx`, `lib/audit.ts`, `stock-snapshot-actions.ts`, `regulatory/[id]/page.tsx`, `promo-material-actions.ts`, `getCurrentUser`, `anyRoleFilter`, `users/[id]/page.tsx`, `training-actions.ts`, `meeting-actions.ts`, `fdStr`, `aiConfigured`, `assistant-actions.ts`, `care-actions.ts`, `assistant.ts`, `hasGlobalView`, `rh/[id]/page.tsx`, `drive/page.tsx`, `market-research.ts`, `events/[id]/page.tsx`, `dossier-actions.ts`, `adoption.ts`, `onlyofficeConfigured`, `test-center/page.tsx`, `ad-pro-item-actions.ts`, `drive-actions.ts`, `information-medicale/[id]/page.tsx`, `calendar.ts`, `getBlob`, `mon-espace/page.tsx`, `medical-actions.ts`, `bd-strategic-table.tsx`, `(app)/layout.tsx`, `budget.ts`, `support-actions.ts`, `product-explorer.tsx`, `directive-actions.ts`, `products.ts`, `congress.ts`, `adventum-brain/page.tsx`, `mail-client.tsx`, `promo-material/[id]/page.tsx`, `toNumber`, `ad-pro-edit-actions.ts`, `field-reports.ts`, `event-actions.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05907172995780591 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04184139409188333 - nodes in this community are weakly interconnected._
- **Should `requireModule` be split into smaller, more focused modules?**
  _Cohesion score 0.03149753051905694 - nodes in this community are weakly interconnected._