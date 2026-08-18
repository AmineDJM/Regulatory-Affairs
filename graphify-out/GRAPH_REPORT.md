# Graph Report - src  (2026-08-18)

## Corpus Check
- 1221 files · ~943,028 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7475 nodes · 29395 edges · 231 communities (224 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d04d8d92`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- button.tsx
- utils.ts
- prisma.ts
- getCurrentUser
- lib/labels.ts
- regulatory/[id]/page.tsx
- notifyUser
- recordAudit
- requireUser
- requireModule
- formatDate
- promo-material-actions.ts
- batch-runner.ts
- page-header.tsx
- userCan
- cn
- regulatory-actions.ts
- corpus/actions.ts
- events/[id]/page.tsx
- aiConfigured
- regulatory/page.tsx
- fdStr
- corpus-actions.ts
- hr-document-actions.ts
- hasGlobalView
- rules/engine.ts
- jobs/runner.ts
- drive-storage.ts
- object-storage.ts
- FindingInput
- care-actions.ts
- ad-pro-item-actions.ts
- toNumber
- [dossierId]/page.tsx
- onlyofficeConfigured
- training-board.tsx
- mon-espace/page.tsx
- assistant-actions.ts
- directory-grid.ts
- kpi-card.tsx
- test-center/runner.ts
- storage.ts
- mistral-ocr.ts
- drive/page.tsx
- regAudit
- config.ts
- anyRoleFilter
- companyIdForNew
- library-actions.ts
- upload/session.ts
- budget.ts
- lib/department-budget.ts
- ocr-engine.ts
- market-research.ts
- lib/ai.ts
- adoption.ts
- agent-core.ts
- dossier-actions.ts
- sales-planning-actions.ts
- users/[id]/page.tsx
- platform-audit/engine.ts
- assistant.ts
- optionsFromMap
- expense-row-actions.tsx
- petty-cash-actions.ts
- molecule.ts
- pch-tender-line-actions.ts
- stream/route.ts
- settings.ts
- reserves/page.tsx
- regulatory-corpus/page.tsx
- payment-request-actions.ts
- classify.ts
- queries/messaging.ts
- (app)/layout.tsx
- microsoft-mail-actions.ts
- drive/upload/route.ts
- budget-forms.tsx
- congress-request-actions.ts
- drive-actions.ts
- medical-actions.ts
- message-thread.tsx
- upload-manager.tsx
- reports.ts
- field-reports.ts
- entities.ts
- mobile-tabbar.tsx
- library-ingest.ts
- payment-authority.ts
- getAppSettings
- lib/messaging.ts
- workflow-builder.tsx
- competition.ts
- legal/page.tsx
- messaging-actions.ts
- drive-table.tsx
- lib/drive.ts
- regulatory-table.tsx
- mail.ts
- graph/provider.ts
- smart-mail-actions.ts
- messenger.tsx
- scheduled.ts
- src/auth.ts
- access/page.tsx
- validation-actions.ts
- promo-stock-actions.ts
- migration-cert.ts
- state-machines/explorer.ts
- medical-directory.tsx
- progress/query.ts
- lifecycle/actions.ts
- departments-manager.tsx
- payment-request.ts
- extract-text.ts
- zip-inspector.ts
- regulatory/export/route.ts
- molecule-panel.tsx
- legal/[id]/page.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- extract-facts.ts
- sheet-import.ts
- connection.ts
- moyens-generaux/page.tsx
- products.ts
- dashboard.ts
- field-report-actions.ts
- risks.ts
- invariants/registry.ts
- openapi.ts
- operations.ts
- regulatory-ia/page.tsx
- meetings/[id]/page.tsx
- icon.tsx
- portfolio.ts
- company.ts
- getMarketData
- meetings.ts
- adventum-brain/page.tsx
- run.ts
- departments.ts
- reply.ts
- org-chart-print.ts
- department-budget-actions.ts
- mail-client.tsx
- workspace.tsx
- validation-supervision.ts
- client.ts
- consulting-actions.ts
- document-preview.tsx
- evidence.ts
- calendar.ts
- test-center/page.tsx
- brain-cockpit.tsx
- support-actions.ts
- http.ts
- ai-facts.ts
- errors.ts
- adventum-actions.ts
- meeting-actions.ts
- validations.ts
- MicrosoftGraphMailProvider
- office-templates.ts
- getMessage
- directive-actions.ts
- tender-lines.tsx
- pch.ts
- doc-request.ts
- process-intelligence.ts
- ingest.ts
- upload-button.tsx
- (app)/feedback/page.tsx
- onboarding-wizard.tsx
- MailProvider
- compare-versions.ts
- s3-config.ts
- pch/export/route.ts
- product-ranges.ts
- radar.ts
- today.ts
- typing/route.ts
- background-upload.tsx
- topbar.tsx
- simple-pdf.ts
- detect-conflicts.ts
- push.ts
- file-glyph.tsx
- assistant-files.ts
- business-development/page.tsx
- ConsultingContractPage
- reminder-actions.ts
- imputation.ts
- withImap
- trace.ts
- regulatory-drive-mirror.ts
- arbitrate-facts.ts
- entites/page.tsx
- meetings/page.tsx
- supplier-auth.ts
- grouping.ts
- auto-category.ts
- promo-material.ts
- events.ts
- build-facts.ts
- Adventum Autonomous Test Center — architecture
- MODULES
- zip-viewer.tsx
- meeting-chat.tsx
- client-bundle-guard.test.ts
- assignment-matrix.tsx
- forecast-grid.tsx
- portail/page.tsx
- pulse-strip.tsx
- push-register.tsx
- courriers/page.tsx
- sendMail
- responsive-guard.test.ts
- next-auth.d.ts
- app/layout.tsx
- mail/attachment/route.ts
- contacts/route.ts
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- listMessages
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 729 edges
2. `userCan()` - 580 edges
3. `fdStr()` - 538 edges
4. `recordAudit()` - 487 edges
5. `prisma` - 463 edges
6. `requireModule()` - 256 edges
7. `hasGlobalView()` - 211 edges
8. `Button` - 184 edges
9. `formatDate()` - 176 edges
10. `cn()` - 167 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (231 total, 7 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.03
Nodes (114): DriveStorageSettings(), PALETTE, PALETTE, ENV_LABEL, MODES, Option, RuleDTO, ROLE_OPTIONS (+106 more)

### Community 1 - "utils.ts"
Cohesion: 0.04
Nodes (127): dynamic, ModuleSpec, PurgeOrphansButton(), dynamic, MailTester(), dynamic, metadata, inline() (+119 more)

### Community 2 - "prisma.ts"
Cohesion: 0.03
Nodes (88): dynamic, dynamic, esc(), GET(), dynamic, GET(), dynamic, StocksPage() (+80 more)

### Community 3 - "getCurrentUser"
Cohesion: 0.04
Nodes (95): GET(), dynamic, GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), GET() (+87 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): ActivityTable(), TYPE, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic, metadata (+90 more)

### Community 5 - "regulatory/[id]/page.tsx"
Cohesion: 0.04
Nodes (85): dynamic, TrashList(), CourrierAdminPage(), Group(), STAGE, VersionsManager(), BD_DOC_CATEGORIES, ProjectEditor() (+77 more)

### Community 6 - "notifyUser"
Cohesion: 0.04
Nodes (102): lastAlertByUser, NO_CONTENT, POST(), OtherDecisionPanel(), SubmitButton(), RevisionRequest(), TrainingBoard(), RespondPanel() (+94 more)

### Community 7 - "recordAudit"
Cohesion: 0.04
Nodes (89): dynamic, POST(), dynamic, POST(), PermanentDeleteButton(), EntitiesManager(), OrgBranch(), ImpersonateButton() (+81 more)

### Community 8 - "requireUser"
Cohesion: 0.05
Nodes (89): FieldsManager(), ActiveToggle(), EditVisitSheet(), ChangePasswordPage(), metadata, delegateOf(), DeletableKind, DeleteResult (+81 more)

### Community 9 - "requireModule"
Cohesion: 0.04
Nodes (64): ActivityRow, ActivityPage(), fmtDuration(), CorbeillePage(), dynamic, TrashItem, FeedbackStatusSelect(), AdminFeedbackPage() (+56 more)

### Community 10 - "formatDate"
Cohesion: 0.04
Nodes (67): AdProList(), EMPTY, AdProOtherDetailPage(), AdProOtherPage(), FocusCard(), CongressTable(), AssistantPage(), PAYABLE_CATEGORIES (+59 more)

### Community 11 - "promo-material-actions.ts"
Cohesion: 0.07
Nodes (68): Filters, NewRequestPicker(), NewRequestPickerProps, CongressRequestForm(), PM_ROLES, CreateEventForm(), CancelButton(), PromoActionPanel() (+60 more)

### Community 12 - "batch-runner.ts"
Cohesion: 0.05
Nodes (71): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+63 more)

### Community 13 - "page-header.tsx"
Cohesion: 0.07
Nodes (54): BudgetContextBar(), dynamic, BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+46 more)

### Community 14 - "userCan"
Cohesion: 0.07
Nodes (72): POST(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), EditTransactionSheet(), createBD(), addBudgetExpense(), createBudgetCategory() (+64 more)

### Community 15 - "cn"
Cohesion: 0.03
Nodes (63): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+55 more)

### Community 16 - "regulatory-actions.ts"
Cohesion: 0.06
Nodes (67): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), createRegulatoryProduct(), ensureRegSupervisor() (+59 more)

### Community 17 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (53): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CorpusImport(), Row (+45 more)

### Community 18 - "events/[id]/page.tsx"
Cohesion: 0.08
Nodes (56): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), MyMissionsPage() (+48 more)

### Community 19 - "aiConfigured"
Cohesion: 0.06
Nodes (62): Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult, ClaudeContentBlock, ClaudeMessage, parsePdfBody() (+54 more)

### Community 20 - "regulatory/page.tsx"
Cohesion: 0.05
Nodes (56): GET(), ConsultingPage(), LogisticsRow, LogisticsPage(), AnnuairePage(), dynamic, MedicalDirectory(), MedicalPage() (+48 more)

### Community 21 - "fdStr"
Cohesion: 0.06
Nodes (61): PersonSheet(), ProductPicker(), RangeSheet(), PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable() (+53 more)

### Community 22 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 23 - "hr-document-actions.ts"
Cohesion: 0.06
Nodes (63): EventDetail(), EventForm(), CancelButton(), RequestRow(), CancelButton(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES (+55 more)

### Community 24 - "hasGlobalView"
Cohesion: 0.07
Nodes (59): CorbeillePage(), AttachmentValidationBlock(), RequestActions(), DirectiveDetailPage(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell (+51 more)

### Community 25 - "rules/engine.ts"
Cohesion: 0.07
Nodes (49): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+41 more)

### Community 26 - "jobs/runner.ts"
Cohesion: 0.08
Nodes (55): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiBatchDefault() (+47 more)

### Community 27 - "drive-storage.ts"
Cohesion: 0.08
Nodes (49): dynamic, POST(), dynamic, POST(), dynamic, POST(), ensureDriveFolder(), ensureDrivePath() (+41 more)

### Community 28 - "object-storage.ts"
Cohesion: 0.09
Nodes (55): dynamic, GET(), runtime, RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config() (+47 more)

### Community 29 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 30 - "care-actions.ts"
Cohesion: 0.11
Nodes (48): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+40 more)

### Community 31 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 32 - "toNumber"
Cohesion: 0.08
Nodes (50): Props, PaiePage(), getManagerOfUser(), BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions() (+42 more)

### Community 33 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (47): AgentItem, AgentsPanel(), RunState, DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime() (+39 more)

### Community 34 - "onlyofficeConfigured"
Cohesion: 0.10
Nodes (42): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+34 more)

### Community 35 - "training-board.tsx"
Cohesion: 0.07
Nodes (44): dynamic, FormationsPage(), metadata, TrainingParticipantRow, TrainingRow, PendingLeave, LeaveItem, applyChainDecision() (+36 more)

### Community 36 - "mon-espace/page.tsx"
Cohesion: 0.06
Nodes (43): ExpenseAckItem, ExpenseAckList(), dynamic, MonDossierPage(), CancelRequestButton(), AdvanceItem, MyAdvances(), MonEspacePage() (+35 more)

### Community 37 - "assistant-actions.ts"
Cohesion: 0.10
Nodes (42): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+34 more)

### Community 38 - "directory-grid.ts"
Cohesion: 0.09
Nodes (39): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, ALGERIA_WILAYAS, ANNUAIRE_COLUMNS (+31 more)

### Community 39 - "kpi-card.tsx"
Cohesion: 0.10
Nodes (37): AdProPage(), dynamic, CongressRequestButton(), CongressInternationalPage(), CongressNationalPage(), OrderRow, OrdresDepensePage(), SponsoringPage() (+29 more)

### Community 40 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (38): LaunchPanel(), ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter(), Certification, CertificationInput (+30 more)

### Community 41 - "storage.ts"
Cohesion: 0.09
Nodes (36): GET(), POST(), ConnectMailbox(), connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), canRunPayroll() (+28 more)

### Community 42 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 43 - "drive/page.tsx"
Cohesion: 0.10
Nodes (37): DriveCanvas(), ITEMS, NewKind, DriveRow, DriveToolbar(), SettingsIcon, dynamic, ExplorerNav() (+29 more)

### Community 44 - "regAudit"
Cohesion: 0.09
Nodes (37): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+29 more)

### Community 45 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 46 - "anyRoleFilter"
Cohesion: 0.12
Nodes (37): AffectationsPage(), dynamic, dynamic, EquipesPage(), dynamic, PlanningPage(), dynamic, ParametresPage() (+29 more)

### Community 47 - "companyIdForNew"
Cohesion: 0.08
Nodes (37): GET(), GET(), AttachToSourceButtons(), createFieldReport(), createInvoice(), deleteInvoice(), parseStatus(), readFields() (+29 more)

### Community 48 - "library-actions.ts"
Cohesion: 0.09
Nodes (36): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext, enrichVersionFindings() (+28 more)

### Community 49 - "upload/session.ts"
Cohesion: 0.09
Nodes (36): IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx(), uploadViaSession(), DEFAULT_PART_SIZE (+28 more)

### Community 50 - "budget.ts"
Cohesion: 0.08
Nodes (30): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetEnvelopeOption (+22 more)

### Community 51 - "lib/department-budget.ts"
Cohesion: 0.13
Nodes (34): DepartmentBudgetTable(), DepartmentBudgetsPage(), allocatedOf(), BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget(), canManageDepartmentBudgetAccess() (+26 more)

### Community 52 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (34): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+26 more)

### Community 53 - "market-research.ts"
Cohesion: 0.09
Nodes (33): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildPresentationPptx(), fmtNum() (+25 more)

### Community 54 - "lib/ai.ts"
Cohesion: 0.09
Nodes (29): dynamic, GET(), runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AnthropicBlock (+21 more)

### Community 55 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 56 - "agent-core.ts"
Cohesion: 0.10
Nodes (26): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+18 more)

### Community 57 - "dossier-actions.ts"
Cohesion: 0.12
Nodes (33): LinkToDossier(), DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction() (+25 more)

### Community 58 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 59 - "users/[id]/page.tsx"
Cohesion: 0.07
Nodes (28): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, AccessMatrix(), ModuleAccessRow, GrantOption, RowGrants() (+20 more)

### Community 60 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 61 - "assistant.ts"
Cohesion: 0.09
Nodes (36): activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), ExecuteResult, findPeople() (+28 more)

### Community 62 - "optionsFromMap"
Cohesion: 0.08
Nodes (31): AdminPage(), fmtBytes(), fmtWhen(), AdminValidationsPage(), dec(), RequesterWindow(), emptyCell(), MultiRequestButton() (+23 more)

### Community 63 - "expense-row-actions.tsx"
Cohesion: 0.15
Nodes (27): BudgetTargetField(), EditableExpense, ExpenseRowActions(), CatalogArticle, empty(), ExistingLine, ReceiptLines(), Row (+19 more)

### Community 64 - "petty-cash-actions.ts"
Cohesion: 0.15
Nodes (29): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+21 more)

### Community 65 - "molecule.ts"
Cohesion: 0.14
Nodes (30): SuggestField(), marketSuggestions(), canonicalForm(), dosageMatches(), extractDosage(), FORM_RULES, moleculeMatches(), moleculeStem() (+22 more)

### Community 66 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (31): analyzeMoleculeSafe(), analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE (+23 more)

### Community 67 - "stream/route.ts"
Cohesion: 0.11
Nodes (27): dynamic, maxDuration, runtime, VersionsPage(), AssistantPage(), dynamic, TodayPage(), dynamic (+19 more)

### Community 68 - "settings.ts"
Cohesion: 0.11
Nodes (30): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+22 more)

### Community 69 - "reserves/page.tsx"
Cohesion: 0.09
Nodes (22): dynamic, metadata, OrganigrammePage(), CorpusPage(), dynamic, metadata, SourceRow(), SourceWithVersion (+14 more)

### Community 70 - "regulatory-corpus/page.tsx"
Cohesion: 0.11
Nodes (25): dynamic, metadata, RegulatoryCorpusPage(), lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor() (+17 more)

### Community 71 - "payment-request-actions.ts"
Cohesion: 0.18
Nodes (31): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, addPaymentComment() (+23 more)

### Community 72 - "classify.ts"
Cohesion: 0.10
Nodes (27): dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase() (+19 more)

### Community 73 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (28): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+20 more)

### Community 74 - "(app)/layout.tsx"
Cohesion: 0.10
Nodes (22): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+14 more)

### Community 75 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 76 - "drive/upload/route.ts"
Cohesion: 0.14
Nodes (19): mimeOf(), POST(), POST(), ensureDriveFolders(), canCreateInSpace(), effectiveSpaceId(), GB, makeTtlCache() (+11 more)

### Community 77 - "budget-forms.tsx"
Cohesion: 0.14
Nodes (28): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+20 more)

### Community 78 - "congress-request-actions.ts"
Cohesion: 0.20
Nodes (29): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+21 more)

### Community 79 - "drive-actions.ts"
Cohesion: 0.14
Nodes (26): ConvertPdfButton(), DriveCommentItem, FileActions(), DriveFilePage(), humanSize(), ShareItem, SharePanel(), ShareRow() (+18 more)

### Community 80 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), DeleteVisitButton(), createDoctor(), createInstitution() (+22 more)

### Community 81 - "message-thread.tsx"
Cohesion: 0.13
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 82 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 83 - "reports.ts"
Cohesion: 0.12
Nodes (23): FindingsReportButton(), ReserveLetterButton(), useGenerate(), Cycle, Point, RESERVE_TYPES, generateFindingsReportAction(), generateReserveLetterAction() (+15 more)

### Community 84 - "field-reports.ts"
Cohesion: 0.11
Nodes (24): dynamic, dynamic, FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea() (+16 more)

### Community 85 - "entities.ts"
Cohesion: 0.17
Nodes (23): ASPECTS, GET, GET, GET, RESERVED, GET, coerce(), DEFAULT_LIMIT (+15 more)

### Community 86 - "mobile-tabbar.tsx"
Cohesion: 0.15
Nodes (23): isActive(), MobileTabBar(), PRIMARY, Tile(), badgeFor(), navPaths(), Sidebar(), SidebarProps (+15 more)

### Community 87 - "library-ingest.ts"
Cohesion: 0.12
Nodes (23): analyzeTenderDocument(), canOcr(), IMAGE_EXTS, ocrDocument(), rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES (+15 more)

### Community 88 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 89 - "getAppSettings"
Cohesion: 0.14
Nodes (22): dynamic, POST(), dynamic, POST(), dynamic, POST(), DatabasesPage(), assistantNudge() (+14 more)

### Community 90 - "lib/messaging.ts"
Cohesion: 0.10
Nodes (24): dynamic, GET(), dynamic, GET(), DOT, MyStatus(), parseAttachments(), setMessagingStatus() (+16 more)

### Community 91 - "workflow-builder.tsx"
Cohesion: 0.14
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 92 - "competition.ts"
Cohesion: 0.12
Nodes (27): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+19 more)

### Community 93 - "legal/page.tsx"
Cohesion: 0.15
Nodes (23): LegalDocumentPage(), legalFields(), LegalRow, dynamic, LegalPage(), metadata, LegalSweepResult, runLegalExpirySweep() (+15 more)

### Community 94 - "messaging-actions.ts"
Cohesion: 0.18
Nodes (27): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+19 more)

### Community 95 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 96 - "lib/drive.ts"
Cohesion: 0.14
Nodes (23): DriveSpacePage(), DriveExplorerSheet(), fmtSize(), browseDrive(), BrowseNode, BrowseResult, EMPTY, DriveAccessLevel (+15 more)

### Community 97 - "regulatory-table.tsx"
Cohesion: 0.12
Nodes (21): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryRow, RegulatoryTable() (+13 more)

### Community 98 - "mail.ts"
Cohesion: 0.08
Nodes (27): acquireSlot(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool, imapWaiters (+19 more)

### Community 99 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 100 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 101 - "messenger.tsx"
Cohesion: 0.14
Nodes (24): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+16 more)

### Community 102 - "scheduled.ts"
Cohesion: 0.14
Nodes (24): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+16 more)

### Community 103 - "src/auth.ts"
Cohesion: 0.13
Nodes (18): NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut }, clientIp(), DeviceInfo, parseDevice() (+10 more)

### Community 104 - "access/page.tsx"
Cohesion: 0.13
Nodes (21): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, AdminUserPage(), SHEET, ACTIONS (+13 more)

### Community 105 - "validation-actions.ts"
Cohesion: 0.11
Nodes (24): RuleControls(), RuleEditor(), decideApproval(), decideAdvance(), clearValidationItem(), createValidationRule(), decideValidation(), deleteValidationRule() (+16 more)

### Community 106 - "promo-stock-actions.ts"
Cohesion: 0.18
Nodes (23): StockBoard(), StockMovementRow, useRun(), createStockItem(), currentStock(), deleteStockItem(), deleteStockMovement(), KINDS (+15 more)

### Community 107 - "migration-cert.ts"
Cohesion: 0.19
Nodes (21): s(), assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists() (+13 more)

### Community 108 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 109 - "medical-directory.tsx"
Cohesion: 0.09
Nodes (20): BeneficiariesCard(), Beneficiary, Mode, Refs, Budget(), CONGRESS_DOC_CATEGORIES, Props, Result (+12 more)

### Community 110 - "progress/query.ts"
Cohesion: 0.13
Nodes (19): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+11 more)

### Community 111 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 112 - "departments-manager.tsx"
Cohesion: 0.17
Nodes (22): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+14 more)

### Community 113 - "payment-request.ts"
Cohesion: 0.17
Nodes (22): PaymentRequestPage(), PaymentRequestsPage(), canApprove(), canResubmit(), deadlineLabel(), isClosed(), isOverdue(), isWithFinance() (+14 more)

### Community 114 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 115 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 116 - "regulatory/export/route.ts"
Cohesion: 0.17
Nodes (17): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+9 more)

### Community 117 - "molecule-panel.tsx"
Cohesion: 0.12
Nodes (18): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+10 more)

### Community 118 - "legal/[id]/page.tsx"
Cohesion: 0.15
Nodes (17): DeleteMailButton(), EditMailButton(), dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput(), dateTimeInput(), EditLegalButton() (+9 more)

### Community 119 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 120 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 121 - "extract-facts.ts"
Cohesion: 0.17
Nodes (21): bestStrengthCombo(), comboLinkOk(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText() (+13 more)

### Community 122 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 123 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 124 - "moyens-generaux/page.tsx"
Cohesion: 0.15
Nodes (20): Consumption(), DepartmentSwitcher(), ExpensePanel(), dynamic, metadata, MoyensGenerauxPage(), budgetHealth, consumedPercent() (+12 more)

### Community 125 - "products.ts"
Cohesion: 0.17
Nodes (21): MarketProductsPage(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, MoleculeAnalysisResult, searchMarketProducts(), GALENIC_FORMS, GalenicForm (+13 more)

### Community 126 - "dashboard.ts"
Cohesion: 0.16
Nodes (21): BusinessDevelopmentOpportunitiesPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection() (+13 more)

### Community 127 - "field-report-actions.ts"
Cohesion: 0.22
Nodes (19): DoctorPicker(), ReportEditor(), Attachments(), SimpleReportEditor(), formatBytes(), analyzeFieldReportAction(), canEdit(), deleteFieldReport() (+11 more)

### Community 128 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 129 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 130 - "openapi.ts"
Cohesion: 0.18
Nodes (16): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, hasAllScopes() (+8 more)

### Community 131 - "operations.ts"
Cohesion: 0.17
Nodes (16): GET, POST, ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), describeOperations(), getOperation(), OPERATIONS (+8 more)

### Community 132 - "regulatory-ia/page.tsx"
Cohesion: 0.15
Nodes (17): BudgetRowData, DossierBudgetRow(), Breakdown(), dynamic, fmtDateTime(), fmtUsd(), metadata, RegulatoryIaAdminPage() (+9 more)

### Community 133 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (18): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+10 more)

### Community 134 - "icon.tsx"
Cohesion: 0.23
Nodes (16): OfficeLauncher(), CommandPalette(), Item, SearchResult, OfficePins(), Icon(), IconProps, appOfFile() (+8 more)

### Community 135 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 136 - "company.ts"
Cohesion: 0.22
Nodes (17): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+9 more)

### Community 137 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 138 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 139 - "adventum-brain/page.tsx"
Cohesion: 0.16
Nodes (19): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+11 more)

### Community 140 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 141 - "departments.ts"
Cohesion: 0.18
Nodes (18): d10(), EmployeeDetailPage(), buildTree(), DeptLite, EmpLite, flattenTree(), getDepartmentMembers(), getDepartmentOptions() (+10 more)

### Community 142 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 143 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 144 - "department-budget-actions.ts"
Cohesion: 0.23
Nodes (18): DepartmentAccessSheet(), AmountCell(), ExpenseForm(), RequestForm(), RequestList(), addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense() (+10 more)

### Community 145 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 146 - "workspace.tsx"
Cohesion: 0.28
Nodes (16): DocumentWorkspace(), OpenDoc, Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W (+8 more)

### Community 147 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 148 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 149 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 150 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 151 - "evidence.ts"
Cohesion: 0.16
Nodes (16): sttConfigured(), base, BETTER, classify(), Diff, DiffClass, differential(), DifferentialReport (+8 more)

### Community 152 - "calendar.ts"
Cohesion: 0.21
Nodes (17): CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents(), includeRel, NewCalendarEvent (+9 more)

### Community 153 - "test-center/page.tsx"
Cohesion: 0.15
Nodes (14): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+6 more)

### Community 154 - "brain-cockpit.tsx"
Cohesion: 0.14
Nodes (14): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+6 more)

### Community 155 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 156 - "http.ts"
Cohesion: 0.24
Nodes (15): ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer(), requireScopes(), sameHash(), handle() (+7 more)

### Community 157 - "ai-facts.ts"
Cohesion: 0.19
Nodes (13): extractLooseJson(), repairAndParse(), AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS (+5 more)

### Community 158 - "errors.ts"
Cohesion: 0.17
Nodes (11): GET, blockOf(), GET, SCALARS, schema(), API_ERROR_CODES, ApiError, ApiErrorBody (+3 more)

### Community 159 - "adventum-actions.ts"
Cohesion: 0.19
Nodes (13): RelationsTab(), RiskThresholdsForm(), DENIED, searchRelations(), updateRiskThresholds(), getProductRelations(), ProductRelations, RelationBlock (+5 more)

### Community 160 - "meeting-actions.ts"
Cohesion: 0.26
Nodes (15): acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink() (+7 more)

### Community 161 - "validations.ts"
Cohesion: 0.18
Nodes (11): CONG_STAGE, CrossValidationItem, getCrossModuleValidations(), getMyValidationRequests(), getMyValidations(), getPendingValidations(), getSupervisedValidations(), MyValidationItem (+3 more)

### Community 162 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 163 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 164 - "getMessage"
Cohesion: 0.18
Nodes (14): dynamic, GET(), dynamic, GET(), friendlyMailError(), getMessage(), isOverloadError(), listingKey() (+6 more)

### Community 165 - "directive-actions.ts"
Cohesion: 0.26
Nodes (14): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+6 more)

### Community 166 - "tender-lines.tsx"
Cohesion: 0.20
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), createOrderFromLine() (+6 more)

### Community 167 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 168 - "doc-request.ts"
Cohesion: 0.25
Nodes (13): DocumentRequestPage(), PiecesPage(), canCancel(), canDecide(), canSubmit(), DocRequestActor, DocRequestMove, DocRequestState (+5 more)

### Community 169 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 170 - "ingest.ts"
Cohesion: 0.22
Nodes (13): asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode(), decomposeReserveText(), RESERVE_TYPE_LABELS, ReservePoint (+5 more)

### Community 171 - "upload-button.tsx"
Cohesion: 0.23
Nodes (12): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, useBackgroundUpload(), FINGERPRINT_MAX_BYTES (+4 more)

### Community 172 - "(app)/feedback/page.tsx"
Cohesion: 0.18
Nodes (12): FeedbackPage(), dynamic, metadata, NoAccessPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata (+4 more)

### Community 173 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 175 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 176 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 177 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 178 - "product-ranges.ts"
Cohesion: 0.24
Nodes (11): PeoplePanel(), buildRangeTree(), canSeeProduct(), companyIdsFromRanges(), CompanyRangeTree, describeAttachment(), productRangeWhere(), RangeBearer (+3 more)

### Community 179 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 180 - "today.ts"
Cohesion: 0.21
Nodes (11): CalendarEventDTO, ActionItem, rankToday(), reasonOf(), REASONS, score(), item(), NOW (+3 more)

### Community 181 - "typing/route.ts"
Cohesion: 0.21
Nodes (9): dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation(), ConversationTyping, registry (+1 more)

### Community 182 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 183 - "topbar.tsx"
Cohesion: 0.24
Nodes (9): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+1 more)

### Community 184 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 185 - "detect-conflicts.ts"
Cohesion: 0.22
Nodes (8): CRITICAL_KEYS, detectConflicts(), normVal(), SINGLE_VALUED, BY_KEY, FACT_CATALOG, FactDef, factLabel()

### Community 186 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 187 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 188 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 189 - "business-development/page.tsx"
Cohesion: 0.35
Nodes (9): BdProjectDetailPage(), BusinessDevelopmentPage(), bdSummary(), dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 190 - "ConsultingContractPage"
Cohesion: 0.35
Nodes (9): ConsultingContractPage(), billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue(), MOVES (+1 more)

### Community 191 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 192 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 193 - "withImap"
Cohesion: 0.25
Nodes (11): acquirePooled(), classifyMailError(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), mailDiagnostic (+3 more)

### Community 194 - "trace.ts"
Cohesion: 0.31
Nodes (9): describeMailChanges(), diffMailEntry(), MAIL_TRACKED_FIELDS, MailChange, MailField, MailSnapshot, MailTraceValue, renderTraceValue() (+1 more)

### Community 195 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 196 - "arbitrate-facts.ts"
Cohesion: 0.36
Nodes (9): AmbiguousFact, arbitrateAmbiguousFacts(), ArbitrationSchema, buildArbitrationPrompt(), isAmbiguous(), parseArbitration(), selectAmbiguousFacts(), SYSTEM (+1 more)

### Community 197 - "entites/page.tsx"
Cohesion: 0.31
Nodes (7): EntityRow, OrphansPanel(), dynamic, EntitesPage(), getUnattachedInventory(), TABLES, UnattachedGroup

### Community 198 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 199 - "supplier-auth.ts"
Cohesion: 0.31
Nodes (9): SupplierLoginPage(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession (+1 more)

### Community 200 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 201 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 202 - "promo-material.ts"
Cohesion: 0.33
Nodes (8): CompanyLite, getPromoMaterial(), getPromoMaterials(), PromoDetail, PromoListItem, promoNames(), resolveNames(), scopePromoMaterial()

### Community 203 - "events.ts"
Cohesion: 0.25
Nodes (8): ACTIVE, buildStats(), EventDetail, EventListItem, EventStats, getEventDetail(), PublicEvent, RegistrationDTO

### Community 204 - "build-facts.ts"
Cohesion: 0.39
Nodes (8): TEXTUAL_EXTRACTION_STATUSES, FactCandidate, AI_FACT_PRIORITY, aiSectionPriority(), buildTwinFacts(), clampInt(), extractAiFactsBounded(), extractFactsFromDocuments()

### Community 205 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 206 - "MODULES"
Cohesion: 0.25
Nodes (5): GET, ENTITIES, entityNames(), schema, MODULES

### Community 207 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 208 - "meeting-chat.tsx"
Cohesion: 0.32
Nodes (7): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), deleteMeetingMessage(), postMeetingMessage()

### Community 209 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 210 - "assignment-matrix.tsx"
Cohesion: 0.38
Nodes (6): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod

### Community 211 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 212 - "portail/page.tsx"
Cohesion: 0.38
Nodes (4): SupplierLogoutButton(), SupplierPortalPage(), supplierLogout(), EXTERNAL_REGULATORY_STATUS

### Community 213 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 214 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 215 - "courriers/page.tsx"
Cohesion: 0.40
Nodes (5): mailFields(), MailRow, CourriersPage(), dynamic, metadata

### Community 216 - "sendMail"
Cohesion: 0.33
Nodes (6): appendToSent(), decryptSecret(), encryptSecret(), imapClient(), masterKey(), sendMail()

### Community 218 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 219 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 220 - "mail/attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 221 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 224 - "listMessages"
Cohesion: 0.67
Nodes (3): addrStr(), listMessages(), readEnvelopes()

## Knowledge Gaps
- **1441 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1436 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `utils.ts`, `getCurrentUser`, `lib/labels.ts`, `regulatory/[id]/page.tsx`, `notifyUser`, `recordAudit`, `requireUser`, `requireModule`, `formatDate`, `promo-material-actions.ts`, `batch-runner.ts`, `page-header.tsx`, `userCan`, `cn`, `regulatory-actions.ts`, `corpus/actions.ts`, `events/[id]/page.tsx`, `aiConfigured`, `regulatory/page.tsx`, `fdStr`, `corpus-actions.ts`, `hr-document-actions.ts`, `hasGlobalView`, `rules/engine.ts`, `jobs/runner.ts`, `drive-storage.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `toNumber`, `[dossierId]/page.tsx`, `onlyofficeConfigured`, `training-board.tsx`, `mon-espace/page.tsx`, `assistant-actions.ts`, `directory-grid.ts`, `kpi-card.tsx`, `test-center/runner.ts`, `storage.ts`, `drive/page.tsx`, `regAudit`, `anyRoleFilter`, `companyIdForNew`, `library-actions.ts`, `upload/session.ts`, `budget.ts`, `lib/department-budget.ts`, `market-research.ts`, `lib/ai.ts`, `adoption.ts`, `agent-core.ts`, `dossier-actions.ts`, `sales-planning-actions.ts`, `users/[id]/page.tsx`, `platform-audit/engine.ts`, `assistant.ts`, `expense-row-actions.tsx`, `petty-cash-actions.ts`, `pch-tender-line-actions.ts`, `stream/route.ts`, `settings.ts`, `reserves/page.tsx`, `regulatory-corpus/page.tsx`, `payment-request-actions.ts`, `queries/messaging.ts`, `(app)/layout.tsx`, `microsoft-mail-actions.ts`, `drive/upload/route.ts`, `congress-request-actions.ts`, `drive-actions.ts`, `medical-actions.ts`, `reports.ts`, `field-reports.ts`, `entities.ts`, `library-ingest.ts`, `getAppSettings`, `lib/messaging.ts`, `workflow-builder.tsx`, `legal/page.tsx`, `messaging-actions.ts`, `lib/drive.ts`, `mail.ts`, `smart-mail-actions.ts`, `scheduled.ts`, `src/auth.ts`, `access/page.tsx`, `validation-actions.ts`, `promo-stock-actions.ts`, `migration-cert.ts`, `state-machines/explorer.ts`, `progress/query.ts`, `lifecycle/actions.ts`, `departments-manager.tsx`, `regulatory/export/route.ts`, `legal/[id]/page.tsx`, `supplier/actions.ts`, `connection.ts`, `moyens-generaux/page.tsx`, `dashboard.ts`, `field-report-actions.ts`, `risks.ts`, `invariants/registry.ts`, `operations.ts`, `regulatory-ia/page.tsx`, `meetings/[id]/page.tsx`, `portfolio.ts`, `company.ts`, `meetings.ts`, `adventum-brain/page.tsx`, `run.ts`, `departments.ts`, `department-budget-actions.ts`, `consulting-actions.ts`, `calendar.ts`, `test-center/page.tsx`, `support-actions.ts`, `http.ts`, `errors.ts`, `adventum-actions.ts`, `meeting-actions.ts`, `validations.ts`, `directive-actions.ts`, `pch.ts`, `process-intelligence.ts`, `ingest.ts`, `(app)/feedback/page.tsx`, `compare-versions.ts`, `pch/export/route.ts`, `typing/route.ts`, `detect-conflicts.ts`, `push.ts`, `business-development/page.tsx`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `entites/page.tsx`, `meetings/page.tsx`, `supplier-auth.ts`, `promo-material.ts`, `events.ts`, `build-facts.ts`, `portail/page.tsx`, `courriers/page.tsx`, `contacts/route.ts`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `utils.ts`, `prisma.ts`, `getCurrentUser`, `regulatory/[id]/page.tsx`, `notifyUser`, `recordAudit`, `requireModule`, `promo-material-actions.ts`, `page-header.tsx`, `userCan`, `regulatory-actions.ts`, `corpus/actions.ts`, `events/[id]/page.tsx`, `regulatory/page.tsx`, `fdStr`, `corpus-actions.ts`, `hr-document-actions.ts`, `hasGlobalView`, `rules/engine.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `[dossierId]/page.tsx`, `onlyofficeConfigured`, `training-board.tsx`, `mon-espace/page.tsx`, `assistant-actions.ts`, `test-center/runner.ts`, `storage.ts`, `drive/page.tsx`, `regAudit`, `config.ts`, `companyIdForNew`, `library-actions.ts`, `lib/department-budget.ts`, `lib/ai.ts`, `dossier-actions.ts`, `sales-planning-actions.ts`, `platform-audit/engine.ts`, `expense-row-actions.tsx`, `petty-cash-actions.ts`, `molecule.ts`, `pch-tender-line-actions.ts`, `stream/route.ts`, `settings.ts`, `reserves/page.tsx`, `payment-request-actions.ts`, `(app)/layout.tsx`, `microsoft-mail-actions.ts`, `drive/upload/route.ts`, `congress-request-actions.ts`, `drive-actions.ts`, `medical-actions.ts`, `reports.ts`, `library-ingest.ts`, `getAppSettings`, `lib/messaging.ts`, `workflow-builder.tsx`, `messaging-actions.ts`, `lib/drive.ts`, `smart-mail-actions.ts`, `messenger.tsx`, `validation-actions.ts`, `promo-stock-actions.ts`, `lifecycle/actions.ts`, `departments-manager.tsx`, `supplier/actions.ts`, `products.ts`, `field-report-actions.ts`, `operations.ts`, `regulatory-ia/page.tsx`, `run.ts`, `department-budget-actions.ts`, `consulting-actions.ts`, `brain-cockpit.tsx`, `support-actions.ts`, `adventum-actions.ts`, `meeting-actions.ts`, `directive-actions.ts`, `tender-lines.tsx`, `doc-request.ts`, `(app)/feedback/page.tsx`, `reminder-actions.ts`, `meeting-chat.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `utils.ts`, `prisma.ts`, `getCurrentUser`, `lib/labels.ts`, `regulatory/[id]/page.tsx`, `notifyUser`, `recordAudit`, `requireUser`, `requireModule`, `formatDate`, `promo-material-actions.ts`, `page-header.tsx`, `cn`, `regulatory-actions.ts`, `events/[id]/page.tsx`, `regulatory/page.tsx`, `fdStr`, `hr-document-actions.ts`, `hasGlobalView`, `drive-storage.ts`, `care-actions.ts`, `ad-pro-item-actions.ts`, `toNumber`, `onlyofficeConfigured`, `training-board.tsx`, `mon-espace/page.tsx`, `assistant-actions.ts`, `directory-grid.ts`, `kpi-card.tsx`, `storage.ts`, `drive/page.tsx`, `anyRoleFilter`, `companyIdForNew`, `budget.ts`, `lib/department-budget.ts`, `market-research.ts`, `lib/ai.ts`, `adoption.ts`, `dossier-actions.ts`, `sales-planning-actions.ts`, `assistant.ts`, `optionsFromMap`, `petty-cash-actions.ts`, `molecule.ts`, `pch-tender-line-actions.ts`, `stream/route.ts`, `reserves/page.tsx`, `payment-request-actions.ts`, `queries/messaging.ts`, `(app)/layout.tsx`, `drive/upload/route.ts`, `congress-request-actions.ts`, `drive-actions.ts`, `medical-actions.ts`, `field-reports.ts`, `entities.ts`, `library-ingest.ts`, `getAppSettings`, `lib/messaging.ts`, `legal/page.tsx`, `messaging-actions.ts`, `lib/drive.ts`, `messenger.tsx`, `access/page.tsx`, `validation-actions.ts`, `promo-stock-actions.ts`, `departments-manager.tsx`, `payment-request.ts`, `regulatory/export/route.ts`, `legal/[id]/page.tsx`, `moyens-generaux/page.tsx`, `products.ts`, `dashboard.ts`, `field-report-actions.ts`, `openapi.ts`, `operations.ts`, `adventum-brain/page.tsx`, `departments.ts`, `department-budget-actions.ts`, `consulting-actions.ts`, `test-center/page.tsx`, `support-actions.ts`, `errors.ts`, `meeting-actions.ts`, `validations.ts`, `directive-actions.ts`, `tender-lines.tsx`, `doc-request.ts`, `pch/export/route.ts`, `typing/route.ts`, `business-development/page.tsx`, `ConsultingContractPage`, `reminder-actions.ts`, `entites/page.tsx`, `promo-material.ts`, `MODULES`, `courriers/page.tsx`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1441 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03064041221935959 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04186289900575615 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03136549795225252 - nodes in this community are weakly interconnected._