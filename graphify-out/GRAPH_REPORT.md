# Graph Report - src  (2026-08-08)

## Corpus Check
- 951 files · ~676,915 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5800 nodes · 22767 edges · 182 communities (176 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `350ee426`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- lib/session.ts
- button.tsx
- Badge
- fdStr
- userCan
- cn
- notifyUser
- requireUser
- formatCurrency
- getCurrentUser
- recordAudit
- rules/engine.ts
- batch-runner.ts
- lib/labels.ts
- getCompanyScope
- pilotage/page.tsx
- workflow/engine.ts
- corpus-actions.ts
- prisma.ts
- utils.ts
- regulatory/[id]/page.tsx
- hasGlobalView
- [dossierId]/page.tsx
- jobs/runner.ts
- agent-core.ts
- upload/session.ts
- aiConfigured
- FindingInput
- assistant-actions.ts
- care-actions.ts
- ocr-engine.ts
- build-facts.ts
- test-center/runner.ts
- formatDateTime
- getAppSettings
- regAudit
- ingest-dossier.ts
- department-budget-actions.ts
- molecule.ts
- (app)/layout.tsx
- mistral-ocr.ts
- hr-document-actions.ts
- meeting-actions.ts
- docgen/actions.ts
- Select
- promo-material-actions.ts
- assistant.ts
- calendar.ts
- library-actions.ts
- admin-request-actions.ts
- regCan
- market-research.ts
- adoption.ts
- events/[id]/page.tsx
- edit-product.tsx
- storage.ts
- lib/ai.ts
- entity-access.ts
- message-thread.tsx
- budget.ts
- rbac.ts
- features.ts
- onlyoffice.ts
- ad-pro-item-actions.ts
- drive-actions.ts
- bd-strategic-table.tsx
- dossier-actions.ts
- platform-audit/engine.ts
- extract-text.ts
- admin-settings-forms.tsx
- medical-info-actions.ts
- messaging-actions.ts
- sectionByCode
- auth.ts
- medical-actions.ts
- currentCompanyWhere
- smart-mail-actions.ts
- document-preview.tsx
- queries/messaging.ts
- budget-forms.tsx
- competition.ts
- mail.ts
- company.ts
- access-actions.ts
- support-actions.ts
- brain-cockpit.tsx
- molecule-panel.tsx
- messenger.tsx
- lifecycle/actions.ts
- portfolio.ts
- explorer.ts
- invariants/registry.ts
- migration-cert.ts
- congress.ts
- enregistrement/page.tsx
- risks.ts
- run.ts
- requests/page.tsx
- lib/drive.ts
- adventum-brain/page.tsx
- mail-client.tsx
- drive/page.tsx
- onboarding-wizard.tsx
- topbar.tsx
- pch-tender-line-actions.ts
- meetings.ts
- upload-manager.tsx
- market/engine.ts
- lib/messaging.ts
- test-center/types.ts
- field-reports.ts
- mon-dossier/page.tsx
- aiFeatureEnabled
- auth-actions.ts
- resolveDriveAccess
- office-templates.ts
- departments.ts
- field-report-actions.ts
- supplier/actions.ts
- pch.ts
- process-intelligence.ts
- new-conversation.tsx
- messaging/messages/route.ts
- radar.ts
- department-actions.ts
- getMarketData
- compare-versions.ts
- pch/export/route.ts
- new-request.tsx
- medical-directory.tsx
- stock-snapshot-actions.ts
- push.ts
- regulatory-request-actions.ts
- training/for-section.ts
- onlyofficeConfigured
- supplies-manager.tsx
- background-upload.tsx
- reminder-actions.ts
- getMessage
- regulatory-drive-mirror.ts
- congress-workflow.tsx
- meetings/page.tsx
- ad-pro-transfer-actions.ts
- mail-diagnostic/route.ts
- calendar-view.tsx
- departments-manager.tsx
- supplier-auth.ts
- assistant-files.ts
- withImap
- scheduled.ts
- Adventum Autonomous Test Center — architecture
- message/route.ts
- org-chart-editor.tsx
- dossiers.ts
- missions.ts
- client-bundle-guard.test.ts
- risk-settings.ts
- congress-request-form.tsx
- delegate-plans.tsx
- pulse-strip.tsx
- draft.ts
- [token]/route.ts
- courses-board.tsx
- bv-requests.tsx
- payroll-matrix.tsx
- next-auth.d.ts
- events/[id]/export/route.ts
- directives/[id]/panel.tsx
- attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- app/layout.tsx
- logout-button.tsx
- donut.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 607 edges
2. `userCan()` - 459 edges
3. `fdStr()` - 450 edges
4. `recordAudit()` - 393 edges
5. `prisma` - 391 edges
6. `requireModule()` - 218 edges
7. `hasGlobalView()` - 159 edges
8. `Button` - 158 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/validation-item.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `OrganigrammePage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/page.tsx → src/lib/session.ts

## Import Cycles
- None detected.

## Communities (182 total, 6 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.04
Nodes (94): AdoptionTable(), dynamic, metadata, dynamic, inline(), MdTable(), PlatformIdeas(), RichText() (+86 more)

### Community 1 - "lib/session.ts"
Cohesion: 0.04
Nodes (81): ActivityPage(), fmtDuration(), CorbeillePage(), dynamic, TrashItem, TrashList(), CourrierAdminPage(), dynamic (+73 more)

### Community 2 - "button.tsx"
Cohesion: 0.05
Nodes (62): DriveStorageSettings(), EntityRow, PALETTE, GrantOption, RowGrantsProps, Option, RuleDTO, ROLE_OPTIONS (+54 more)

### Community 3 - "Badge"
Cohesion: 0.08
Nodes (59): TYPES, AdminPage(), fmtBytes(), fmtWhen(), ACTION_COLS, ACTION_LABELS, dynamic, Mode (+51 more)

### Community 4 - "fdStr"
Cohesion: 0.06
Nodes (90): CategorySheet(), EditTransactionSheet(), RevisionRequest(), PayButton(), CancelButton(), CancelButton(), saveAdoptionSettings(), addBudgetExpense() (+82 more)

### Community 5 - "userCan"
Cohesion: 0.05
Nodes (79): POST(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR (+71 more)

### Community 6 - "cn"
Cohesion: 0.04
Nodes (67): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), dynamic, FocusCard(), CongressTable() (+59 more)

### Community 7 - "notifyUser"
Cohesion: 0.06
Nodes (79): DriveComments(), CheckinConfirm(), RegistrationsManager(), decideApproval(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor() (+71 more)

### Community 8 - "requireUser"
Cohesion: 0.06
Nodes (79): FieldsManager(), VariationPanel(), createBD(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange() (+71 more)

### Community 9 - "formatCurrency"
Cohesion: 0.05
Nodes (72): AdminValidationsPage(), dec(), BudgetSettings(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), Budget(), NewRequestButton(), DemandesPage() (+64 more)

### Community 10 - "getCurrentUser"
Cohesion: 0.06
Nodes (64): dynamic, GET(), dynamic, GET(), dynamic, POST(), dynamic, GET() (+56 more)

### Community 11 - "recordAudit"
Cohesion: 0.06
Nodes (58): EntitiesManager(), ActiveToggle(), ImpersonateButton(), SpaceSettingsButton(), CreateRecordButtonProps, Target, TARGETS, resetActivityTime() (+50 more)

### Community 12 - "rules/engine.ts"
Cohesion: 0.05
Nodes (60): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+52 more)

### Community 13 - "batch-runner.ts"
Cohesion: 0.05
Nodes (64): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+56 more)

### Community 14 - "lib/labels.ts"
Cohesion: 0.05
Nodes (59): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BDPipeline() (+51 more)

### Community 15 - "getCompanyScope"
Cohesion: 0.05
Nodes (54): dynamic, GET(), INLINE_MIME, runtime, dynamic, GET(), runtime, dynamic (+46 more)

### Community 16 - "pilotage/page.tsx"
Cohesion: 0.06
Nodes (58): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+50 more)

### Community 17 - "workflow/engine.ts"
Cohesion: 0.06
Nodes (65): blankStep(), WorkflowBuilder(), Props, PaiePage(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+57 more)

### Community 18 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 19 - "prisma.ts"
Cohesion: 0.07
Nodes (26): dynamic, GET(), actorFor(), actorFor(), actorFor(), actor(), fd(), actorFor() (+18 more)

### Community 20 - "utils.ts"
Cohesion: 0.06
Nodes (52): BudgetRow, BudgetsTable(), MONTHS, AggNum(), fmtDzd(), dynamic, fmtPct(), fmtUsd() (+44 more)

### Community 21 - "regulatory/[id]/page.tsx"
Cohesion: 0.07
Nodes (52): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), Info(), REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES, RegulatoryDetailPage() (+44 more)

### Community 22 - "hasGlobalView"
Cohesion: 0.08
Nodes (52): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), AppealPanel(), SPONSORING_DOC_CATEGORIES, SponsoringDetailPage(), ThirdPartyButton() (+44 more)

### Community 23 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (51): AgentItem, AgentsPanel(), RunState, CostTable(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow (+43 more)

### Community 24 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (53): splitTextIntoChunksWithOffsets(), corpusForSection(), submitVersionReviewBatch(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith() (+45 more)

### Community 25 - "agent-core.ts"
Cohesion: 0.07
Nodes (41): extractJson(), lunaEmbed(), lunaEmbedModel(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult (+33 more)

### Community 26 - "upload/session.ts"
Cohesion: 0.07
Nodes (48): dynamic, maxDuration, POST(), runtime, dynamic, POST(), runtime, DELETE() (+40 more)

### Community 27 - "aiConfigured"
Cohesion: 0.08
Nodes (47): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+39 more)

### Community 28 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 29 - "assistant-actions.ts"
Cohesion: 0.09
Nodes (49): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+41 more)

### Community 30 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 31 - "ocr-engine.ts"
Cohesion: 0.07
Nodes (44): LunaCallInput, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr() (+36 more)

### Community 32 - "build-facts.ts"
Cohesion: 0.07
Nodes (45): TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded() (+37 more)

### Community 33 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (45): sttConfigured(), getTestCenterDashboard(), base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER (+37 more)

### Community 34 - "formatDateTime"
Cohesion: 0.05
Nodes (44): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, AccessByModulePage(), ACTION_FR (+36 more)

### Community 35 - "getAppSettings"
Cohesion: 0.08
Nodes (45): POST(), dynamic, POST(), DatabasesPage(), RuleControls(), RuleEditor(), createMission(), connectMailbox() (+37 more)

### Community 36 - "regAudit"
Cohesion: 0.09
Nodes (38): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CorpusImport(), Row (+30 more)

### Community 37 - "ingest-dossier.ts"
Cohesion: 0.08
Nodes (43): dynamic, maxDuration, POST(), runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip() (+35 more)

### Community 38 - "department-budget-actions.ts"
Cohesion: 0.12
Nodes (39): DepartmentAccessSheet(), AmountCell(), DepartmentBudgetTable(), HrConsumption(), DepartmentBudgetsPage(), dynamic, grantFor(), setDepartmentBudget() (+31 more)

### Community 39 - "molecule.ts"
Cohesion: 0.11
Nodes (43): MarketProductsPage(), SuggestField(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts(), analyzeMoleculeSafe() (+35 more)

### Community 40 - "(app)/layout.tsx"
Cohesion: 0.08
Nodes (35): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+27 more)

### Community 41 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 42 - "hr-document-actions.ts"
Cohesion: 0.09
Nodes (42): EventDetail(), EventForm(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), HrRequestThread(), createCalendarEvent() (+34 more)

### Community 43 - "meeting-actions.ts"
Cohesion: 0.08
Nodes (40): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ChatAttachment, ChatMessage, MeetingChat() (+32 more)

### Community 44 - "docgen/actions.ts"
Cohesion: 0.09
Nodes (37): DocgenPanel(), GenDoc, Template, FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateDocumentAction(), generateFindingsReportAction() (+29 more)

### Community 45 - "Select"
Cohesion: 0.05
Nodes (33): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, Draft, ROLE_ENTRIES, PmOpt, SubmitButton() (+25 more)

### Community 46 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 47 - "assistant.ts"
Cohesion: 0.08
Nodes (42): dynamic, maxDuration, runtime, callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind, AssistantStreamEvent (+34 more)

### Community 48 - "calendar.ts"
Cohesion: 0.10
Nodes (36): TodayPage(), CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents() (+28 more)

### Community 49 - "library-actions.ts"
Cohesion: 0.09
Nodes (35): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext, QualityCheck (+27 more)

### Community 50 - "admin-request-actions.ts"
Cohesion: 0.09
Nodes (39): RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields(), collectFields() (+31 more)

### Community 51 - "regCan"
Cohesion: 0.10
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 52 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 53 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 54 - "events/[id]/page.tsx"
Cohesion: 0.08
Nodes (30): CreateEventButton(), d10(), EditEventButton(), EventFields(), Result, EventFundingPanel(), dynamic, eventValidationSteps() (+22 more)

### Community 55 - "edit-product.tsx"
Cohesion: 0.07
Nodes (30): OpeningBalance, DciAssociationField(), EditProductButton(), EditProductValues, UserOption, StatusEditor(), UserOption, CATEGORY_OPTS (+22 more)

### Community 56 - "storage.ts"
Cohesion: 0.09
Nodes (30): GET(), PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind() (+22 more)

### Community 57 - "lib/ai.ts"
Cohesion: 0.08
Nodes (28): dynamic, GET(), runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock (+20 more)

### Community 58 - "entity-access.ts"
Cohesion: 0.13
Nodes (32): GET(), SearchPage(), executeReadTool(), isRequestOwner(), addDays(), bdSection(), budgetsSection(), congressSection() (+24 more)

### Community 59 - "message-thread.tsx"
Cohesion: 0.12
Nodes (29): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+21 more)

### Community 60 - "budget.ts"
Cohesion: 0.11
Nodes (27): GET(), BudgetExpensesPage(), BudgetsPage(), BudgetSettingsPage(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate() (+19 more)

### Community 61 - "rbac.ts"
Cohesion: 0.07
Nodes (30): dynamic, GET(), DirectiveDetailPage(), actorFor(), canViewDirective(), DirectiveDetail, getDirective(), getDirectives() (+22 more)

### Community 62 - "features.ts"
Cohesion: 0.10
Nodes (27): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+19 more)

### Community 63 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (28): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+20 more)

### Community 64 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (27): AdProItemsPanel(), Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem() (+19 more)

### Community 65 - "drive-actions.ts"
Cohesion: 0.12
Nodes (25): ConvertPdfButton(), DriveCommentItem, FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget (+17 more)

### Community 66 - "bd-strategic-table.tsx"
Cohesion: 0.09
Nodes (29): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+21 more)

### Community 67 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (28): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+20 more)

### Community 68 - "platform-audit/engine.ts"
Cohesion: 0.11
Nodes (30): buildPrompt(), fmtFinding(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL, groupByViewSignature(), HealthProbe (+22 more)

### Community 69 - "extract-text.ts"
Cohesion: 0.12
Nodes (23): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+15 more)

### Community 70 - "admin-settings-forms.tsx"
Cohesion: 0.10
Nodes (29): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+21 more)

### Community 71 - "medical-info-actions.ts"
Cohesion: 0.16
Nodes (27): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+19 more)

### Community 72 - "messaging-actions.ts"
Cohesion: 0.17
Nodes (29): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), DENIED (+21 more)

### Community 73 - "sectionByCode"
Cohesion: 0.11
Nodes (25): CorpusExtract, queryFor(), SECTION_HINTS, Classification, classifyDocument(), ClassifyInput, codeHay(), dots() (+17 more)

### Community 74 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 75 - "medical-actions.ts"
Cohesion: 0.12
Nodes (29): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+21 more)

### Community 76 - "currentCompanyWhere"
Cohesion: 0.10
Nodes (25): StocksPage(), CompanyLite, companyWhere(), currentCompanyWhere(), AbsenceRow, days(), DeadlineRow, getHrPulse() (+17 more)

### Community 77 - "smart-mail-actions.ts"
Cohesion: 0.15
Nodes (23): dynamic, POST(), runtime, MailTester(), sendMail(), SendResult, smartMailStatus, buildProviderCall() (+15 more)

### Community 78 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 79 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 80 - "budget-forms.tsx"
Cohesion: 0.15
Nodes (25): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+17 more)

### Community 81 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 82 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+19 more)

### Community 83 - "company.ts"
Cohesion: 0.17
Nodes (21): dynamic, GET(), runtime, AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany() (+13 more)

### Community 84 - "access-actions.ts"
Cohesion: 0.14
Nodes (23): RowGrants(), ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), RevokeAllButton(), adminResetPassword() (+15 more)

### Community 85 - "support-actions.ts"
Cohesion: 0.17
Nodes (21): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+13 more)

### Community 86 - "brain-cockpit.tsx"
Cohesion: 0.11
Nodes (20): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+12 more)

### Community 87 - "molecule-panel.tsx"
Cohesion: 0.12
Nodes (19): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+11 more)

### Community 88 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+14 more)

### Community 89 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 90 - "portfolio.ts"
Cohesion: 0.15
Nodes (20): MyPortfolioCard(), ProductList(), getFieldReportsAggregation(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT (+12 more)

### Community 91 - "explorer.ts"
Cohesion: 0.18
Nodes (19): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants() (+11 more)

### Community 92 - "invariants/registry.ts"
Cohesion: 0.13
Nodes (15): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+7 more)

### Community 93 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 94 - "congress.ts"
Cohesion: 0.16
Nodes (20): CongressInternationalPage(), CongressNationalPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressFormData() (+12 more)

### Community 95 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 96 - "risks.ts"
Cohesion: 0.14
Nodes (22): adminRequestRisks(), AutopilotPayload, budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks() (+14 more)

### Community 97 - "run.ts"
Cohesion: 0.15
Nodes (16): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), PROCEDURE_TYPE_LABELS, runSimulationAction(), AiFn (+8 more)

### Community 98 - "requests/page.tsx"
Cohesion: 0.18
Nodes (18): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), REG_REQUEST_CATEGORY, REG_REQUEST_STATUS, getRegRequest(), listRegRequests() (+10 more)

### Community 99 - "lib/drive.ts"
Cohesion: 0.18
Nodes (18): POST(), RichUpload(), ensureDriveFolders(), canCreateInSpace(), DriveAccessLevel, driveBreadcrumb(), effectiveSpaceId(), DriveListing (+10 more)

### Community 100 - "adventum-brain/page.tsx"
Cohesion: 0.16
Nodes (19): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+11 more)

### Community 101 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 102 - "drive/page.tsx"
Cohesion: 0.17
Nodes (20): CreateSpaceButton(), DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, DriveFilePage() (+12 more)

### Community 103 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 104 - "topbar.tsx"
Cohesion: 0.13
Nodes (16): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), badgeFor() (+8 more)

### Community 105 - "pch-tender-line-actions.ts"
Cohesion: 0.22
Nodes (19): dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine (+11 more)

### Community 106 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 107 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 108 - "market/engine.ts"
Cohesion: 0.14
Nodes (19): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, MarketMeta, NomRow, PchRow (+11 more)

### Community 109 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): dynamic, GET(), DOT, MyStatus(), setMessagingStatus(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 110 - "test-center/types.ts"
Cohesion: 0.19
Nodes (14): ENV_LABEL, LaunchPanel(), MODES, ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter() (+6 more)

### Community 111 - "field-reports.ts"
Cohesion: 0.14
Nodes (17): dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation (+9 more)

### Community 112 - "mon-dossier/page.tsx"
Cohesion: 0.16
Nodes (17): dynamic, MonDossierPage(), CommentItem, CONTRACT_TYPE, HR_DOCUMENT_CATEGORY, HR_REQUEST_STATUS, attachThreads(), getEmployeeHrDossier() (+9 more)

### Community 113 - "aiFeatureEnabled"
Cohesion: 0.21
Nodes (15): dynamic, POST(), dynamic, POST(), dynamic, POST(), assistantNudge(), AiFeature (+7 more)

### Community 114 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 115 - "resolveDriveAccess"
Cohesion: 0.23
Nodes (14): GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), resolveAttachment(), canViewDrive(), resolveDriveAccess() (+6 more)

### Community 116 - "office-templates.ts"
Cohesion: 0.18
Nodes (15): createOfficeNode(), blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT (+7 more)

### Community 117 - "departments.ts"
Cohesion: 0.18
Nodes (15): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentSubtreeIds(), getDepartmentTree() (+7 more)

### Community 118 - "field-report-actions.ts"
Cohesion: 0.24
Nodes (16): ReportEditor(), Attachments(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+8 more)

### Community 119 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 120 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 121 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 122 - "new-conversation.tsx"
Cohesion: 0.19
Nodes (11): fd(), MemberMultiSelect(), Mode, NewConversation(), SearchBox(), createChannel(), createDirect(), createGroup() (+3 more)

### Community 123 - "messaging/messages/route.ts"
Cohesion: 0.20
Nodes (10): dynamic, GET(), dynamic, NO_CONTENT, POST(), ConversationTyping, getTyping(), registry (+2 more)

### Community 124 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 125 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 126 - "getMarketData"
Cohesion: 0.24
Nodes (13): getMarketData(), loadNdjson(), buildCompetition(), getPriceForDci(), HospitalRow, matchIqvia(), matchPch(), PriceForDci (+5 more)

### Community 127 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 128 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 129 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 130 - "medical-directory.tsx"
Cohesion: 0.19
Nodes (11): Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE, MEDICAL_SECTOR (+3 more)

### Community 131 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 132 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 133 - "regulatory-request-actions.ts"
Cohesion: 0.29
Nodes (10): RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible(), parseCategory(), parsePriority(), parseStatus() (+2 more)

### Community 134 - "training/for-section.ts"
Cohesion: 0.21
Nodes (8): CaseExtract, OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 135 - "onlyofficeConfigured"
Cohesion: 0.44
Nodes (8): POST(), dynamic, GET(), onlyofficeConfigured(), readDocEditToken(), readEditToken(), PREV, verifyJwt()

### Community 136 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 137 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 138 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 139 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 140 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 141 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 142 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 143 - "ad-pro-transfer-actions.ts"
Cohesion: 0.29
Nodes (9): AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS, readSource() (+1 more)

### Community 144 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 145 - "calendar-view.tsx"
Cohesion: 0.28
Nodes (7): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND

### Community 146 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 147 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 148 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 149 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 150 - "scheduled.ts"
Cohesion: 0.42
Nodes (8): pollAiBatches(), pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 151 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 152 - "message/route.ts"
Cohesion: 0.32
Nodes (6): dynamic, GET(), dynamic, GET(), friendlyMailError(), MailMessage

### Community 153 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 154 - "dossiers.ts"
Cohesion: 0.39
Nodes (7): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), isDossierMember(), scopeDossiers()

### Community 155 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 156 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 157 - "risk-settings.ts"
Cohesion: 0.38
Nodes (5): RiskThresholdsForm(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField

### Community 158 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 159 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 160 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 161 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 162 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 163 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 164 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 165 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 166 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 167 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 168 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 169 - "attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 170 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 171 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 173 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

### Community 174 - "donut.tsx"
Cohesion: 0.67
Nodes (3): arc(), Donut(), DonutSlice

## Knowledge Gaps
- **1165 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `lib/session.ts`, `Badge`, `fdStr`, `userCan`, `cn`, `notifyUser`, `requireUser`, `formatCurrency`, `getCurrentUser`, `recordAudit`, `rules/engine.ts`, `batch-runner.ts`, `lib/labels.ts`, `getCompanyScope`, `pilotage/page.tsx`, `workflow/engine.ts`, `corpus-actions.ts`, `regulatory/[id]/page.tsx`, `hasGlobalView`, `[dossierId]/page.tsx`, `jobs/runner.ts`, `agent-core.ts`, `upload/session.ts`, `aiConfigured`, `assistant-actions.ts`, `care-actions.ts`, `ocr-engine.ts`, `build-facts.ts`, `test-center/runner.ts`, `formatDateTime`, `getAppSettings`, `regAudit`, `ingest-dossier.ts`, `department-budget-actions.ts`, `(app)/layout.tsx`, `hr-document-actions.ts`, `meeting-actions.ts`, `docgen/actions.ts`, `promo-material-actions.ts`, `assistant.ts`, `calendar.ts`, `library-actions.ts`, `admin-request-actions.ts`, `regCan`, `market-research.ts`, `adoption.ts`, `events/[id]/page.tsx`, `storage.ts`, `lib/ai.ts`, `entity-access.ts`, `budget.ts`, `rbac.ts`, `features.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `drive-actions.ts`, `bd-strategic-table.tsx`, `dossier-actions.ts`, `platform-audit/engine.ts`, `admin-settings-forms.tsx`, `medical-info-actions.ts`, `messaging-actions.ts`, `auth.ts`, `medical-actions.ts`, `currentCompanyWhere`, `smart-mail-actions.ts`, `queries/messaging.ts`, `mail.ts`, `company.ts`, `access-actions.ts`, `support-actions.ts`, `brain-cockpit.tsx`, `lifecycle/actions.ts`, `portfolio.ts`, `explorer.ts`, `invariants/registry.ts`, `migration-cert.ts`, `congress.ts`, `risks.ts`, `run.ts`, `requests/page.tsx`, `lib/drive.ts`, `adventum-brain/page.tsx`, `drive/page.tsx`, `onboarding-wizard.tsx`, `pch-tender-line-actions.ts`, `meetings.ts`, `lib/messaging.ts`, `field-reports.ts`, `mon-dossier/page.tsx`, `aiFeatureEnabled`, `auth-actions.ts`, `resolveDriveAccess`, `departments.ts`, `field-report-actions.ts`, `supplier/actions.ts`, `pch.ts`, `process-intelligence.ts`, `department-actions.ts`, `compare-versions.ts`, `pch/export/route.ts`, `stock-snapshot-actions.ts`, `push.ts`, `regulatory-request-actions.ts`, `training/for-section.ts`, `onlyofficeConfigured`, `supplies-manager.tsx`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `meetings/page.tsx`, `ad-pro-transfer-actions.ts`, `mail-diagnostic/route.ts`, `supplier-auth.ts`, `scheduled.ts`, `dossiers.ts`, `missions.ts`, `risk-settings.ts`, `[token]/route.ts`, `events/[id]/export/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `lib/session.ts`, `stock-snapshot-actions.ts`, `fdStr`, `userCan`, `cn`, `notifyUser`, `supplies-manager.tsx`, `regulatory-request-actions.ts`, `reminder-actions.ts`, `recordAudit`, `rules/engine.ts`, `ad-pro-transfer-actions.ts`, `getCompanyScope`, `workflow/engine.ts`, `corpus-actions.ts`, `hasGlobalView`, `dossiers.ts`, `missions.ts`, `aiConfigured`, `assistant-actions.ts`, `care-actions.ts`, `formatDateTime`, `getAppSettings`, `regAudit`, `department-budget-actions.ts`, `molecule.ts`, `(app)/layout.tsx`, `hr-document-actions.ts`, `meeting-actions.ts`, `docgen/actions.ts`, `promo-material-actions.ts`, `assistant.ts`, `library-actions.ts`, `admin-request-actions.ts`, `regCan`, `storage.ts`, `lib/ai.ts`, `entity-access.ts`, `budget.ts`, `rbac.ts`, `features.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `drive-actions.ts`, `bd-strategic-table.tsx`, `dossier-actions.ts`, `admin-settings-forms.tsx`, `medical-info-actions.ts`, `messaging-actions.ts`, `medical-actions.ts`, `smart-mail-actions.ts`, `access-actions.ts`, `support-actions.ts`, `brain-cockpit.tsx`, `molecule-panel.tsx`, `messenger.tsx`, `lifecycle/actions.ts`, `run.ts`, `requests/page.tsx`, `lib/drive.ts`, `mail-client.tsx`, `onboarding-wizard.tsx`, `pch-tender-line-actions.ts`, `lib/messaging.ts`, `test-center/types.ts`, `mon-dossier/page.tsx`, `aiFeatureEnabled`, `auth-actions.ts`, `office-templates.ts`, `field-report-actions.ts`, `supplier/actions.ts`, `new-conversation.tsx`, `department-actions.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `pch/export/route.ts`, `card.tsx`, `lib/session.ts`, `Badge`, `fdStr`, `stock-snapshot-actions.ts`, `cn`, `notifyUser`, `requireUser`, `formatCurrency`, `getCurrentUser`, `recordAudit`, `supplies-manager.tsx`, `reminder-actions.ts`, `lib/labels.ts`, `mail-diagnostic/route.ts`, `pilotage/page.tsx`, `workflow/engine.ts`, `utils.ts`, `regulatory/[id]/page.tsx`, `hasGlobalView`, `dossiers.ts`, `assistant-actions.ts`, `care-actions.ts`, `formatDateTime`, `getAppSettings`, `department-budget-actions.ts`, `events/[id]/export/route.ts`, `(app)/layout.tsx`, `molecule.ts`, `hr-document-actions.ts`, `meeting-actions.ts`, `promo-material-actions.ts`, `assistant.ts`, `calendar.ts`, `admin-request-actions.ts`, `market-research.ts`, `adoption.ts`, `events/[id]/page.tsx`, `lib/ai.ts`, `entity-access.ts`, `budget.ts`, `rbac.ts`, `onlyoffice.ts`, `ad-pro-item-actions.ts`, `drive-actions.ts`, `bd-strategic-table.tsx`, `dossier-actions.ts`, `medical-info-actions.ts`, `messaging-actions.ts`, `medical-actions.ts`, `currentCompanyWhere`, `queries/messaging.ts`, `access-actions.ts`, `support-actions.ts`, `molecule-panel.tsx`, `congress.ts`, `requests/page.tsx`, `lib/drive.ts`, `adventum-brain/page.tsx`, `mail-client.tsx`, `drive/page.tsx`, `pch-tender-line-actions.ts`, `lib/messaging.ts`, `aiFeatureEnabled`, `office-templates.ts`, `field-report-actions.ts`, `new-conversation.tsx`, `messaging/messages/route.ts`, `department-actions.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.040575354229282955 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.041589517162797324 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05064836003051106 - nodes in this community are weakly interconnected._