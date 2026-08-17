# Graph Report - src  (2026-08-17)

## Corpus Check
- 1214 files · ~930,863 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7427 nodes · 29170 edges · 228 communities (221 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 152 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `670342d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireUser
- userCan
- prisma.ts
- button.tsx
- utils.ts
- lib/labels.ts
- lib/session.ts
- hasGlobalView
- formatDate
- requireModule
- card.tsx
- notifyRoles
- regulatory/[id]/page.tsx
- brain-cockpit.tsx
- build-facts.ts
- corpus/page.tsx
- getCompanyScope
- object-storage.ts
- lib/audit.ts
- entities.ts
- getCurrentUser
- meeting-actions.ts
- budget-forms.tsx
- jobs/runner.ts
- releaseBlob
- product-explorer.tsx
- pilotage/page.tsx
- operations.ts
- assistant-actions.ts
- lib/department-budget.ts
- dossier-agent.ts
- batch-runner.ts
- upload/session.ts
- payment-request-actions.ts
- rules/engine.ts
- FindingInput
- care-actions.ts
- agent-core.ts
- onlyoffice.ts
- create-record-button.tsx
- molecule.ts
- [dossierId]/page.tsx
- regAudit
- directory-grid.ts
- drive/page.tsx
- corpus/actions.ts
- calendar.ts
- workspace.tsx
- assistant.ts
- lib/ai.ts
- mon-espace/page.tsx
- review-agent.ts
- scheduled.ts
- mistral-ocr.ts
- config.ts
- market-research.ts
- buildRef
- legal/[id]/page.tsx
- promo-material-actions.ts
- events/[id]/page.tsx
- platform-audit/engine.ts
- adoption.ts
- workflow/engine.ts
- library-actions.ts
- dashboard.ts
- medical-actions.ts
- test-center/runner.ts
- getAppSettings
- petty-cash-actions.ts
- workflow-builder.tsx
- regulatory-workflow.ts
- message-thread.tsx
- pch-tender-line-actions.ts
- test-center/page.tsx
- access-actions.ts
- stock-board.tsx
- ocr-engine.ts
- queries/messaging.ts
- messaging-actions.ts
- drive-actions.ts
- microsoft-mail-actions.ts
- upload-manager.tsx
- sectionByCode
- src/auth.ts
- progress/query.ts
- ad-pro/page.tsx
- bd-strategic-table.tsx
- drive-table.tsx
- companyIdForNew
- sales-planning-actions.ts
- aiConfigured
- items-panel.tsx
- payment-authority.ts
- competition.ts
- dossier-actions.ts
- expense-row-actions.tsx
- mail.ts
- stream/route.ts
- drive/upload/route.ts
- document-request-actions.ts
- regulatory-table.tsx
- graph/provider.ts
- smart-mail-actions.ts
- new-request-picker.tsx
- lifecycle/actions.ts
- reports.ts
- topbar.tsx
- extract-text.ts
- (app)/layout.tsx
- departments-manager.tsx
- migration-cert.ts
- medical-info-actions.ts
- budget-envelope-actions.ts
- leave-workflow.ts
- sheet-import.ts
- state-machines/explorer.ts
- connection.ts
- departments.ts
- sidebar.tsx
- library-ingest.ts
- ingest.ts
- mail-client.tsx
- drive/[id]/page.tsx
- product-catalog.ts
- portfolio.ts
- department-budget-actions.ts
- company.ts
- getMarketData
- invariants/registry.ts
- admin-settings-forms.tsx
- market-research-actions.ts
- congress.ts
- edit-product.tsx
- run.ts
- lib/ad-pro-edit.ts
- reply.ts
- org-chart-print.ts
- training-board.tsx
- orchestrator.ts
- validation-supervision.ts
- client.ts
- field-reports.ts
- messaging/messages/route.ts
- users/[id]/page.tsx
- consulting-actions.ts
- hr-dossier.tsx
- lib/messaging.ts
- quick-access-list.tsx
- onboarding-wizard.tsx
- validations.ts
- scopeRegulatory
- messenger.tsx
- office/page.tsx
- MicrosoftGraphMailProvider
- consulting/[id]/page.tsx
- events.ts
- process-intelligence.ts
- upload-button.tsx
- training-actions.ts
- tender-lines.tsx
- MailProvider
- compare-versions.ts
- manifest.ts
- pch/export/route.ts
- office-templates.ts
- simple-pdf.ts
- new-conversation.tsx
- background-upload.tsx
- training/for-section.ts
- getMailAccount
- push.ts
- regulatory/page.tsx
- stock-snapshot-actions.ts
- ai-health.ts
- multi-request.tsx
- medical-directory.tsx
- promo-material.ts
- rbac.test.ts
- reminder-actions.ts
- imputation.ts
- getMessage
- radar.ts
- regulatory-drive-mirror.ts
- entites/page.tsx
- calendar-view.tsx
- congress-workflow.tsx
- notifications/page.tsx
- stocks-view.tsx
- grouping.ts
- mail-diagnostic/route.ts
- training-panel.tsx
- supplier-auth.ts
- mobile-tabbar.tsx
- admin-delete-actions.ts
- auto-category.ts
- withImap
- manufacturing-stage.ts
- Adventum Autonomous Test Center — architecture
- drive-space-manager.tsx
- client-bundle-guard.test.ts
- delegate-plans.tsx
- (auth)/login/login-form.tsx
- change-password-form.tsx
- onboarding/page.tsx
- draft.ts
- [token]/route.ts
- step-timeline.tsx
- employee-form.tsx
- payroll-matrix.tsx
- validation-item-review.tsx
- responsive-guard.test.ts
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- mail/attachment/route.ts
- mission-stops.tsx
- logout-button.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 720 edges
2. `userCan()` - 574 edges
3. `fdStr()` - 531 edges
4. `recordAudit()` - 480 edges
5. `prisma` - 461 edges
6. `requireModule()` - 254 edges
7. `hasGlobalView()` - 211 edges
8. `Button` - 182 edges
9. `formatDate()` - 176 edges
10. `toNumber()` - 163 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts

## Import Cycles
- None detected.

## Communities (228 total, 7 thin omitted)

### Community 0 - "requireUser"
Cohesion: 0.03
Nodes (148): POST(), GET(), PermanentDeleteButton(), PurgeOrphansButton(), EntitiesManager(), FieldsManager(), SpaceSettingsButton(), AVATAR_COLORS (+140 more)

### Community 1 - "userCan"
Cohesion: 0.04
Nodes (126): ActiveToggle(), PresentationCard(), Res, EditEventButton(), CheckinConfirm(), RegistrationsManager(), EditTransactionSheet(), RevisionRequest() (+118 more)

### Community 2 - "prisma.ts"
Cohesion: 0.04
Nodes (74): dynamic, DossierDetailPage(), CataloguePage(), dynamic, SupportDetailPage(), actorFor(), actorFor(), actorFor() (+66 more)

### Community 3 - "button.tsx"
Cohesion: 0.05
Nodes (72): DriveStorageSettings(), PALETTE, OrgBranch(), Citation, Source, Version, ENV_LABEL, MODES (+64 more)

### Community 4 - "utils.ts"
Cohesion: 0.07
Nodes (77): dynamic, ModuleSpec, AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), dynamic (+69 more)

### Community 5 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): NewRequestPicker(), ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), BudgetRow (+90 more)

### Community 6 - "lib/session.ts"
Cohesion: 0.03
Nodes (77): CorbeillePage(), dynamic, TrashItem, TrashList(), MailTester(), CourrierAdminPage(), dynamic, metadata (+69 more)

### Community 7 - "hasGlobalView"
Cohesion: 0.04
Nodes (99): RuleControls(), RuleEditor(), EventDetail(), EventForm(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), DirectiveDetailPage() (+91 more)

### Community 8 - "formatDate"
Cohesion: 0.04
Nodes (87): AdProOtherDetailPage(), AdProOtherPage(), dynamic, FocusCard(), BudgetExpenses(), Budget(), CongressDetailView(), ConsultingPage() (+79 more)

### Community 9 - "requireModule"
Cohesion: 0.05
Nodes (77): AdminSuppliersPage(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic (+69 more)

### Community 10 - "card.tsx"
Cohesion: 0.05
Nodes (61): dynamic, ActivityPage(), fmtDuration(), dynamic, metadata, AiControlCenterPage(), dynamic, FEATURE_LABEL (+53 more)

### Community 11 - "notifyRoles"
Cohesion: 0.07
Nodes (79): EquipesPage(), ItemLifecycle(), addAdProItem(), AdProModule, approveAdProItemOrder(), audit(), canAllocate(), canEditItems() (+71 more)

### Community 12 - "regulatory/[id]/page.tsx"
Cohesion: 0.06
Nodes (60): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, BD_DOC_CATEGORIES, BdProjectDetailPage(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES (+52 more)

### Community 13 - "brain-cockpit.tsx"
Cohesion: 0.05
Nodes (69): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+61 more)

### Community 14 - "build-facts.ts"
Cohesion: 0.05
Nodes (62): AssignmentMatrix(), key(), nOr0(), extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema (+54 more)

### Community 15 - "corpus/page.tsx"
Cohesion: 0.05
Nodes (65): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+57 more)

### Community 16 - "getCompanyScope"
Cohesion: 0.05
Nodes (57): dynamic, GET(), INLINE_MIME, runtime, dynamic, GET(), runtime, dynamic (+49 more)

### Community 17 - "object-storage.ts"
Cohesion: 0.07
Nodes (68): dynamic, GET(), runtime, POST(), StoragePanel(), RFC-3986, abortMultipartUpload(), amzDate() (+60 more)

### Community 18 - "lib/audit.ts"
Cohesion: 0.05
Nodes (56): dynamic, POST(), ImpersonateButton(), DriveComments(), ReconcileTable(), SupportActions(), SupportMessageForm(), useAction() (+48 more)

### Community 19 - "entities.ts"
Cohesion: 0.06
Nodes (55): GET, ASPECTS, GET, GET, GET, RESERVED, blockOf(), GET (+47 more)

### Community 20 - "getCurrentUser"
Cohesion: 0.06
Nodes (55): GET(), dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET() (+47 more)

### Community 21 - "meeting-actions.ts"
Cohesion: 0.06
Nodes (55): dynamic, GET(), EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), UserLite, MeetJoin() (+47 more)

### Community 22 - "budget-forms.tsx"
Cohesion: 0.06
Nodes (56): GET(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategorySheet() (+48 more)

### Community 23 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (59): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), enrichVersionFindings(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES (+51 more)

### Community 24 - "releaseBlob"
Cohesion: 0.06
Nodes (54): dynamic, maxDuration, POST(), runtime, releaseBlob(), archiveQueue, attachArchive(), clampInt() (+46 more)

### Community 25 - "product-explorer.tsx"
Cohesion: 0.06
Nodes (53): AggNum(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone() (+45 more)

### Community 26 - "pilotage/page.tsx"
Cohesion: 0.07
Nodes (52): AffectationsPage(), dynamic, dynamic, Cap, Kam, KamRow(), numOrNull(), Opt (+44 more)

### Community 27 - "operations.ts"
Cohesion: 0.07
Nodes (46): GET, GET, GET(), POST, authenticate(), generateApiKey(), hashApiKey(), readBearer() (+38 more)

### Community 28 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (50): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+42 more)

### Community 29 - "lib/department-budget.ts"
Cohesion: 0.09
Nodes (52): DepartmentAccessSheet(), AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), DepartmentBudgetsPage() (+44 more)

### Community 30 - "dossier-agent.ts"
Cohesion: 0.07
Nodes (52): Msg, ReserveChatPanel(), SUGGESTIONS, AiTextResult, ClaudeContentBlock, ClaudeMessage, addCitation(), AgentAttachment (+44 more)

### Community 31 - "batch-runner.ts"
Cohesion: 0.07
Nodes (54): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+46 more)

### Community 32 - "upload/session.ts"
Cohesion: 0.06
Nodes (52): dynamic, maxDuration, POST(), runtime, dynamic, runtime, dynamic, maxDuration (+44 more)

### Community 33 - "payment-request-actions.ts"
Cohesion: 0.09
Nodes (55): NewPaymentButton(), AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner (+47 more)

### Community 34 - "rules/engine.ts"
Cohesion: 0.07
Nodes (47): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+39 more)

### Community 35 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 36 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 37 - "agent-core.ts"
Cohesion: 0.07
Nodes (36): lunaEmbed(), lunaEmbedModel(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn (+28 more)

### Community 38 - "onlyoffice.ts"
Cohesion: 0.10
Nodes (40): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+32 more)

### Community 39 - "create-record-button.tsx"
Cohesion: 0.06
Nodes (41): AdminValidationsPage(), dec(), dynamic, MarketResearchListPage(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), NewRequestButton(), SuppliesManager() (+33 more)

### Community 40 - "molecule.ts"
Cohesion: 0.10
Nodes (44): fmtDzd(), FoundList(), MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions() (+36 more)

### Community 41 - "[dossierId]/page.tsx"
Cohesion: 0.08
Nodes (42): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+34 more)

### Community 42 - "regAudit"
Cohesion: 0.10
Nodes (44): FindingControls(), Props, statusLabel(), Props, SupplierPanel(), Conflict, ConflictRow(), ConflictValue (+36 more)

### Community 43 - "directory-grid.ts"
Cohesion: 0.09
Nodes (42): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, saveDirectoryCell(), ALGERIA_WILAYAS (+34 more)

### Community 44 - "drive/page.tsx"
Cohesion: 0.09
Nodes (41): DriveCanvas(), ITEMS, NewKind, DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage(), dynamic (+33 more)

### Community 45 - "corpus/actions.ts"
Cohesion: 0.08
Nodes (38): CorpusAdmin(), ACCEPT, AUTHORITIES, CorpusImport(), Row, CaseCard(), canManage(), createCorpusSourceVersion() (+30 more)

### Community 46 - "calendar.ts"
Cohesion: 0.09
Nodes (40): AssistantPage(), dynamic, TodayPage(), CalendarPage(), dynamic, MorningBrief(), refreshMyBrief(), CalendarEventDTO (+32 more)

### Community 47 - "workspace.tsx"
Cohesion: 0.09
Nodes (36): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+28 more)

### Community 48 - "assistant.ts"
Cohesion: 0.08
Nodes (43): ClaudeToolDef, activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+35 more)

### Community 49 - "lib/ai.ts"
Cohesion: 0.09
Nodes (40): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+32 more)

### Community 50 - "mon-espace/page.tsx"
Cohesion: 0.07
Nodes (40): dynamic, MonDossierPage(), AdvanceItem, MyAdvances(), MonEspacePage(), CourseDuration(), mapsUrl(), TaskItem (+32 more)

### Community 51 - "review-agent.ts"
Cohesion: 0.06
Nodes (40): analyzeFieldReport(), extractJson(), CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS, DECISION_RULES, FEE_SPECIAL_CASES (+32 more)

### Community 52 - "scheduled.ts"
Cohesion: 0.08
Nodes (40): LegalSweepResult, runLegalExpirySweep(), canCancel(), canRenew(), daysBetween(), daysLeft(), expiryLevel, expiryMessage() (+32 more)

### Community 53 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 54 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 55 - "market-research.ts"
Cohesion: 0.08
Nodes (38): GET(), GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), analyzeMarketResearch(), buildContext() (+30 more)

### Community 56 - "buildRef"
Cohesion: 0.08
Nodes (39): OtherDecisionPanel(), Kind, LABELS, audit(), closeAdProOtherRequest(), createAdProOtherRequest(), decideAdProOtherRequest(), nextRef() (+31 more)

### Community 57 - "legal/[id]/page.tsx"
Cohesion: 0.09
Nodes (34): dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput(), dateTimeInput(), mailFields(), DateCell(), MailRow (+26 more)

### Community 58 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), addPromoComment(), audit(), cancelPromoMaterial() (+28 more)

### Community 59 - "events/[id]/page.tsx"
Cohesion: 0.14
Nodes (37): CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), MyMissionsPage(), AppealPanel() (+29 more)

### Community 60 - "platform-audit/engine.ts"
Cohesion: 0.08
Nodes (37): sttConfigured(), buildPrompt(), fmtFinding(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL, groupByViewSignature() (+29 more)

### Community 61 - "adoption.ts"
Cohesion: 0.09
Nodes (37): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), resetActivityTime(), saveAdoptionSettings(), ADOPTION_TARGET_FIELDS (+29 more)

### Community 62 - "workflow/engine.ts"
Cohesion: 0.10
Nodes (41): Props, getManagerOfUser(), BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, getWorkflowForEntity(), loadOutcome(), WorkflowEventView (+33 more)

### Community 63 - "library-actions.ts"
Cohesion: 0.09
Nodes (35): PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext, QualityCheck (+27 more)

### Community 64 - "dashboard.ts"
Cohesion: 0.10
Nodes (35): GET(), SearchPage(), addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData() (+27 more)

### Community 65 - "medical-actions.ts"
Cohesion: 0.10
Nodes (38): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), addCongressBeneficiary(), asList(), Benef (+30 more)

### Community 66 - "test-center/runner.ts"
Cohesion: 0.10
Nodes (31): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+23 more)

### Community 67 - "getAppSettings"
Cohesion: 0.12
Nodes (28): POST(), dynamic, POST(), dynamic, POST(), AdminSettingsPage(), ENTITIES, attachFiles() (+20 more)

### Community 68 - "petty-cash-actions.ts"
Cohesion: 0.14
Nodes (30): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), runPettyCashRechargeReminders() (+22 more)

### Community 69 - "workflow-builder.tsx"
Cohesion: 0.11
Nodes (29): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+21 more)

### Community 70 - "regulatory-workflow.ts"
Cohesion: 0.11
Nodes (32): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), isRegChecklistKey(), phaseLabel(), PRESUB_ANSWER_STEP, PRESUB_GATE_STEP (+24 more)

### Community 71 - "message-thread.tsx"
Cohesion: 0.12
Nodes (28): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment (+20 more)

### Community 72 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (31): analyzeTenderText(), dominantOrigin(), enrichLineById(), extractAndSaveLines(), int(), matchOurProduct(), MODULE, parseBoxSize() (+23 more)

### Community 73 - "test-center/page.tsx"
Cohesion: 0.09
Nodes (25): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+17 more)

### Community 74 - "access-actions.ts"
Cohesion: 0.12
Nodes (29): GrantOption, RowGrants(), RowGrantsProps, ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm() (+21 more)

### Community 75 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 76 - "ocr-engine.ts"
Cohesion: 0.12
Nodes (29): buildPagedContent(), defaultOcrLangs(), ensureLangData(), ocrCacheDir(), require, SUPPORTED, createOcrWorker(), LOW_CONFIDENCE (+21 more)

### Community 77 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (29): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), preview() (+21 more)

### Community 78 - "messaging-actions.ts"
Cohesion: 0.16
Nodes (31): AddMembers(), cid(), InfoPanel(), Row(), Messenger(), addMembers(), archiveConversation(), bookmarkMessage() (+23 more)

### Community 79 - "drive-actions.ts"
Cohesion: 0.14
Nodes (27): DriveFilePage(), humanSize(), ShareRow(), AccessSheet(), BulkResult, collectSubtree(), copyNodes(), createFolder() (+19 more)

### Community 80 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 81 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 82 - "sectionByCode"
Cohesion: 0.11
Nodes (26): dossierCost, Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase() (+18 more)

### Community 83 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 84 - "progress/query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 85 - "ad-pro/page.tsx"
Cohesion: 0.16
Nodes (25): AdProList(), EMPTY, Filters, NewRequestPickerProps, AdProPage(), dynamic, AdProCreateData, AD_PRO_KINDS (+17 more)

### Community 86 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 87 - "drive-table.tsx"
Cohesion: 0.15
Nodes (24): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, moveNodes(), canPasteInto(), Clipboard (+16 more)

### Community 88 - "companyIdForNew"
Cohesion: 0.13
Nodes (27): ReportEditor(), SimpleReportEditor(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports(), parseIds() (+19 more)

### Community 89 - "sales-planning-actions.ts"
Cohesion: 0.12
Nodes (26): BU, CatalogueManager(), CHANNELS, Opt, Prod, TeamsManager(), carryForwardAssignments(), createBusinessUnit() (+18 more)

### Community 90 - "aiConfigured"
Cohesion: 0.14
Nodes (23): DossierChatPanel(), Msg, SUGGESTIONS, analyzeTenderDocument(), aiConfigured(), askDossierAgentAction(), loadDossierChatAction(), resetDossierChatAction() (+15 more)

### Community 91 - "items-panel.tsx"
Cohesion: 0.14
Nodes (22): AdProItemsPanel(), EditItemForm(), ItemRow, PARENT_PATH, Props, AD_PRO_PARENTS, AdProParent, breakdown (+14 more)

### Community 92 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 93 - "competition.ts"
Cohesion: 0.12
Nodes (27): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+19 more)

### Community 94 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (25): DossierAssign(), DossierMessageForm(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton(), archiveDossier() (+17 more)

### Community 95 - "expense-row-actions.tsx"
Cohesion: 0.19
Nodes (21): BudgetTargetField(), EditableExpense, CatalogArticle, empty(), ExistingLine, ReceiptLines(), Row, BudgetTarget (+13 more)

### Community 96 - "mail.ts"
Cohesion: 0.08
Nodes (28): acquireSlot(), addrStr(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool (+20 more)

### Community 97 - "stream/route.ts"
Cohesion: 0.12
Nodes (22): dynamic, maxDuration, runtime, dynamic, metadata, VersionsPage(), Group(), STAGE (+14 more)

### Community 98 - "drive/upload/route.ts"
Cohesion: 0.15
Nodes (16): mimeOf(), POST(), POST(), GB, makeTtlCache(), quotaVerdict, TtlCache, formatTiming() (+8 more)

### Community 99 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 100 - "regulatory-table.tsx"
Cohesion: 0.12
Nodes (21): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryRow, RegulatoryTable() (+13 more)

### Community 101 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 102 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 103 - "new-request-picker.tsx"
Cohesion: 0.11
Nodes (17): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, DeleteMailButton() (+9 more)

### Community 104 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 105 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 106 - "topbar.tsx"
Cohesion: 0.12
Nodes (18): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), NotificationPopup() (+10 more)

### Community 107 - "extract-text.ts"
Cohesion: 0.14
Nodes (18): AI_READABLE_EXTRACTION_STATUSES, extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint() (+10 more)

### Community 108 - "(app)/layout.tsx"
Cohesion: 0.13
Nodes (18): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+10 more)

### Community 109 - "departments-manager.tsx"
Cohesion: 0.17
Nodes (22): CompanyOpt, DepartmentsManager(), DeptSheet(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun() (+14 more)

### Community 110 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 111 - "medical-info-actions.ts"
Cohesion: 0.21
Nodes (21): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+13 more)

### Community 112 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (23): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+15 more)

### Community 113 - "leave-workflow.ts"
Cohesion: 0.14
Nodes (20): applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainState, ChainStatus, ChainTransition, nextChainStage() (+12 more)

### Community 114 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 115 - "state-machines/explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 116 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 117 - "departments.ts"
Cohesion: 0.16
Nodes (19): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DeptLite, EmpLite, flattenTree() (+11 more)

### Community 118 - "sidebar.tsx"
Cohesion: 0.17
Nodes (17): badgeFor(), FLAT_GROUPS, navPaths(), Sidebar(), SidebarProps, TopbarProps, NavItem, aliasMatches() (+9 more)

### Community 119 - "library-ingest.ts"
Cohesion: 0.17
Nodes (19): rasterizePdf(), buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+11 more)

### Community 120 - "ingest.ts"
Cohesion: 0.15
Nodes (17): dynamic, maxDuration, POST(), runtime, asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType() (+9 more)

### Community 121 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 122 - "drive/[id]/page.tsx"
Cohesion: 0.13
Nodes (15): ConvertPdfButton(), DriveCommentItem, FileActions(), ShareItem, SharePanel(), MoveTarget, NodeActions(), Props (+7 more)

### Community 123 - "product-catalog.ts"
Cohesion: 0.16
Nodes (18): KIND_LABEL, OrphanRow(), moleculeStem(), SALT_WORDS, bestMatches(), isConfident(), MatchProposal, matchScore() (+10 more)

### Community 124 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 125 - "department-budget-actions.ts"
Cohesion: 0.25
Nodes (19): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget(), setDepartmentBudget() (+11 more)

### Community 126 - "company.ts"
Cohesion: 0.22
Nodes (18): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+10 more)

### Community 127 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 128 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (14): pred(), InvariantOutcome, checkRows(), Delegate, INVARIANTS, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules() (+6 more)

### Community 129 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 130 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 131 - "congress.ts"
Cohesion: 0.17
Nodes (17): CongressInternationalPage(), CongressNationalPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressFormData() (+9 more)

### Community 132 - "edit-product.tsx"
Cohesion: 0.15
Nodes (15): OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow, SelectField() (+7 more)

### Community 133 - "run.ts"
Cohesion: 0.17
Nodes (15): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict() (+7 more)

### Community 134 - "lib/ad-pro-edit.ts"
Cohesion: 0.17
Nodes (15): isKind(), TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS, describeChanges() (+7 more)

### Community 135 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 136 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 137 - "training-board.tsx"
Cohesion: 0.21
Nodes (16): TrainingParticipantRow, TrainingRow, ChainStage, ATTENDANCE_LABELS, canEditTraining(), canRespondToInvitation(), countParticipants(), grantedAmount() (+8 more)

### Community 138 - "orchestrator.ts"
Cohesion: 0.19
Nodes (15): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), agentAutoEnabled(), escalateCriticalSections() (+7 more)

### Community 139 - "validation-supervision.ts"
Cohesion: 0.19
Nodes (17): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow, supervisionCounters (+9 more)

### Community 140 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 141 - "field-reports.ts"
Cohesion: 0.12
Nodes (15): dynamic, GET(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), FieldReportAggregation (+7 more)

### Community 142 - "messaging/messages/route.ts"
Cohesion: 0.15
Nodes (14): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation() (+6 more)

### Community 143 - "users/[id]/page.tsx"
Cohesion: 0.16
Nodes (16): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, AccessMatrix(), ModuleAccessRow, AdminUserPage() (+8 more)

### Community 144 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 145 - "hr-dossier.tsx"
Cohesion: 0.15
Nodes (15): CourseDTO, CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt, CancelRequestButton(), REQ_TO_CAT (+7 more)

### Community 146 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): DOT, MyStatus(), parseAttachments(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 147 - "quick-access-list.tsx"
Cohesion: 0.18
Nodes (14): QuickRow, FileGlyph(), FileGlyphProps, LOOK, ExplorerRow, extensionOf(), SortDir, SortKey (+6 more)

### Community 148 - "onboarding-wizard.tsx"
Cohesion: 0.14
Nodes (11): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+3 more)

### Community 149 - "validations.ts"
Cohesion: 0.16
Nodes (12): actor(), CONG_STAGE, CrossValidationItem, getCrossModuleValidations(), getMyValidationRequests(), getMyValidations(), getPendingValidations(), getSupervisedValidations() (+4 more)

### Community 150 - "scopeRegulatory"
Cohesion: 0.25
Nodes (13): POST(), lockGate(), scopeRegulatory(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate() (+5 more)

### Community 151 - "messenger.tsx"
Cohesion: 0.22
Nodes (14): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Props (+6 more)

### Community 152 - "office/page.tsx"
Cohesion: 0.30
Nodes (13): OfficeLauncher(), dynamic, OfficePage(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp (+5 more)

### Community 153 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 154 - "consulting/[id]/page.tsx"
Cohesion: 0.25
Nodes (12): ConsultingContractPage(), dynamic, billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue() (+4 more)

### Community 155 - "events.ts"
Cohesion: 0.15
Nodes (14): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+6 more)

### Community 156 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 157 - "upload-button.tsx"
Cohesion: 0.23
Nodes (12): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, useBackgroundUpload(), FINGERPRINT_MAX_BYTES (+4 more)

### Community 158 - "training-actions.ts"
Cohesion: 0.37
Nodes (14): TrainingBoard(), attachFiles(), createHrTraining(), deciderFor(), decideTraining(), inviteTrainingParticipants(), isHrOf(), nextTrainingRef() (+6 more)

### Community 159 - "tender-lines.tsx"
Cohesion: 0.22
Nodes (13): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), createOrderFromLine() (+5 more)

### Community 161 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 162 - "manifest.ts"
Cohesion: 0.21
Nodes (12): CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS (+4 more)

### Community 163 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 164 - "office-templates.ts"
Cohesion: 0.23
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 165 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 166 - "new-conversation.tsx"
Cohesion: 0.22
Nodes (9): fd(), MemberMultiSelect(), Mode, NewConversation(), SearchBox(), createChannel(), createGroup(), joinChannel() (+1 more)

### Community 167 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 168 - "training/for-section.ts"
Cohesion: 0.19
Nodes (8): CaseExtract, experienceForSection(), OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, RESERVE_TXT, TRACKER_TXT

### Community 169 - "getMailAccount"
Cohesion: 0.27
Nodes (9): dynamic, GET(), dynamic, GET(), dynamic, GET(), friendlyMailError(), getMailAccount() (+1 more)

### Community 170 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 171 - "regulatory/page.tsx"
Cohesion: 0.30
Nodes (10): NewProductButton(), RegulatoryPage(), BusinessDevelopmentPipelinePage(), SuppliersManager(), DOSAGE_UNIT, effectiveTherapeuticSegments(), PHARMA_FORM, getRegulatoryRows() (+2 more)

### Community 172 - "stock-snapshot-actions.ts"
Cohesion: 0.26
Nodes (11): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+3 more)

### Community 173 - "ai-health.ts"
Cohesion: 0.29
Nodes (5): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, AiHealthRun, performAiHealthCheck()

### Community 174 - "multi-request.tsx"
Cohesion: 0.22
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, VisibleFieldDef, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 175 - "medical-directory.tsx"
Cohesion: 0.24
Nodes (9): Props, Result, SECTOR_ICON, SECTOR_ORDER, INSTITUTION_SECTOR, INSTITUTION_TYPE, InstitutionDTO, SpecialtyDTO (+1 more)

### Community 176 - "promo-material.ts"
Cohesion: 0.29
Nodes (10): PromoMaterialDetailPage(), CompanyLite, canViewPromo(), getPromoMaterial(), getPromoMaterials(), PromoDetail, PromoListItem, promoNames() (+2 more)

### Community 177 - "rbac.test.ts"
Cohesion: 0.25
Nodes (7): StocksPage(), getProductOptions(), ProductOption, PERMISSIONS, regulatoryLockWhere(), fromRole(), mkAccess()

### Community 178 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 179 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 180 - "getMessage"
Cohesion: 0.22
Nodes (11): getMessage(), isOverloadError(), listingKey(), listMailboxes(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure() (+3 more)

### Community 181 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 182 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 183 - "entites/page.tsx"
Cohesion: 0.31
Nodes (7): EntityRow, OrphansPanel(), dynamic, EntitesPage(), getUnattachedInventory(), TABLES, UnattachedGroup

### Community 184 - "calendar-view.tsx"
Cohesion: 0.24
Nodes (8): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, formatAlgiersDisplay(), CALENDAR_EVENT_KIND, CALENDAR_INVITE_STATUS

### Community 185 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 186 - "notifications/page.tsx"
Cohesion: 0.36
Nodes (8): NotificationItem, NotificationsPage(), EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 187 - "stocks-view.tsx"
Cohesion: 0.20
Nodes (9): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, SnapshotDTO, TabKey, TABS, todayInput() (+1 more)

### Community 188 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 189 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 190 - "training-panel.tsx"
Cohesion: 0.31
Nodes (6): CaseDocRow, CaseRow, UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 191 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 192 - "mobile-tabbar.tsx"
Cohesion: 0.42
Nodes (7): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY, Tile()

### Community 193 - "admin-delete-actions.ts"
Cohesion: 0.33
Nodes (8): delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord(), superAdminDelete()

### Community 194 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 195 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 196 - "manufacturing-stage.ts"
Cohesion: 0.39
Nodes (6): effectiveStage, STAGE_ORDER, stageRank(), StageSource, time(), VariationLike

### Community 197 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 198 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 199 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 200 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 201 - "(auth)/login/login-form.tsx"
Cohesion: 0.38
Nodes (3): LoginForm(), metadata, authenticate()

### Community 202 - "change-password-form.tsx"
Cohesion: 0.38
Nodes (4): ChangePasswordForm(), ChangePasswordPage(), metadata, changePassword()

### Community 203 - "onboarding/page.tsx"
Cohesion: 0.33
Nodes (6): GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage(), NAVIGATION

### Community 204 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 205 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 206 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 207 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 208 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 209 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 211 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 212 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 213 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 214 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 215 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 216 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 217 - "mail/attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 218 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 219 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

## Knowledge Gaps
- **1437 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1432 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `requireUser`, `userCan`, `utils.ts`, `lib/labels.ts`, `lib/session.ts`, `hasGlobalView`, `formatDate`, `requireModule`, `card.tsx`, `notifyRoles`, `regulatory/[id]/page.tsx`, `brain-cockpit.tsx`, `build-facts.ts`, `corpus/page.tsx`, `getCompanyScope`, `lib/audit.ts`, `entities.ts`, `getCurrentUser`, `meeting-actions.ts`, `budget-forms.tsx`, `jobs/runner.ts`, `releaseBlob`, `product-explorer.tsx`, `pilotage/page.tsx`, `operations.ts`, `assistant-actions.ts`, `lib/department-budget.ts`, `dossier-agent.ts`, `batch-runner.ts`, `upload/session.ts`, `payment-request-actions.ts`, `rules/engine.ts`, `care-actions.ts`, `agent-core.ts`, `onlyoffice.ts`, `create-record-button.tsx`, `[dossierId]/page.tsx`, `regAudit`, `directory-grid.ts`, `drive/page.tsx`, `corpus/actions.ts`, `calendar.ts`, `assistant.ts`, `lib/ai.ts`, `mon-espace/page.tsx`, `scheduled.ts`, `market-research.ts`, `buildRef`, `legal/[id]/page.tsx`, `promo-material-actions.ts`, `events/[id]/page.tsx`, `platform-audit/engine.ts`, `adoption.ts`, `workflow/engine.ts`, `library-actions.ts`, `dashboard.ts`, `medical-actions.ts`, `test-center/runner.ts`, `getAppSettings`, `petty-cash-actions.ts`, `workflow-builder.tsx`, `pch-tender-line-actions.ts`, `test-center/page.tsx`, `access-actions.ts`, `stock-board.tsx`, `queries/messaging.ts`, `messaging-actions.ts`, `drive-actions.ts`, `microsoft-mail-actions.ts`, `src/auth.ts`, `progress/query.ts`, `ad-pro/page.tsx`, `bd-strategic-table.tsx`, `companyIdForNew`, `sales-planning-actions.ts`, `aiConfigured`, `items-panel.tsx`, `dossier-actions.ts`, `expense-row-actions.tsx`, `mail.ts`, `stream/route.ts`, `drive/upload/route.ts`, `document-request-actions.ts`, `smart-mail-actions.ts`, `lifecycle/actions.ts`, `reports.ts`, `topbar.tsx`, `(app)/layout.tsx`, `departments-manager.tsx`, `migration-cert.ts`, `medical-info-actions.ts`, `budget-envelope-actions.ts`, `state-machines/explorer.ts`, `connection.ts`, `departments.ts`, `library-ingest.ts`, `ingest.ts`, `drive/[id]/page.tsx`, `product-catalog.ts`, `portfolio.ts`, `department-budget-actions.ts`, `company.ts`, `invariants/registry.ts`, `admin-settings-forms.tsx`, `market-research-actions.ts`, `congress.ts`, `run.ts`, `lib/ad-pro-edit.ts`, `orchestrator.ts`, `field-reports.ts`, `users/[id]/page.tsx`, `consulting-actions.ts`, `lib/messaging.ts`, `validations.ts`, `scopeRegulatory`, `office/page.tsx`, `consulting/[id]/page.tsx`, `events.ts`, `process-intelligence.ts`, `training-actions.ts`, `compare-versions.ts`, `manifest.ts`, `pch/export/route.ts`, `training/for-section.ts`, `getMailAccount`, `push.ts`, `regulatory/page.tsx`, `stock-snapshot-actions.ts`, `ai-health.ts`, `promo-material.ts`, `rbac.test.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `entites/page.tsx`, `notifications/page.tsx`, `mail-diagnostic/route.ts`, `supplier-auth.ts`, `admin-delete-actions.ts`, `onboarding/page.tsx`, `[token]/route.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `userCan`, `prisma.ts`, `utils.ts`, `lib/session.ts`, `hasGlobalView`, `formatDate`, `requireModule`, `card.tsx`, `notifyRoles`, `regulatory/[id]/page.tsx`, `brain-cockpit.tsx`, `corpus/page.tsx`, `getCompanyScope`, `lib/audit.ts`, `getCurrentUser`, `meeting-actions.ts`, `assistant-actions.ts`, `lib/department-budget.ts`, `payment-request-actions.ts`, `rules/engine.ts`, `care-actions.ts`, `agent-core.ts`, `onlyoffice.ts`, `molecule.ts`, `regAudit`, `directory-grid.ts`, `corpus/actions.ts`, `calendar.ts`, `lib/ai.ts`, `mon-espace/page.tsx`, `config.ts`, `buildRef`, `legal/[id]/page.tsx`, `promo-material-actions.ts`, `events/[id]/page.tsx`, `adoption.ts`, `library-actions.ts`, `dashboard.ts`, `medical-actions.ts`, `petty-cash-actions.ts`, `workflow-builder.tsx`, `pch-tender-line-actions.ts`, `test-center/page.tsx`, `access-actions.ts`, `stock-board.tsx`, `messaging-actions.ts`, `drive-actions.ts`, `microsoft-mail-actions.ts`, `drive-table.tsx`, `companyIdForNew`, `sales-planning-actions.ts`, `aiConfigured`, `dossier-actions.ts`, `stream/route.ts`, `document-request-actions.ts`, `smart-mail-actions.ts`, `lifecycle/actions.ts`, `reports.ts`, `(app)/layout.tsx`, `departments-manager.tsx`, `medical-info-actions.ts`, `budget-envelope-actions.ts`, `mail-client.tsx`, `drive/[id]/page.tsx`, `department-budget-actions.ts`, `market-research-actions.ts`, `run.ts`, `lib/ad-pro-edit.ts`, `orchestrator.ts`, `consulting-actions.ts`, `hr-dossier.tsx`, `lib/messaging.ts`, `training-actions.ts`, `tender-lines.tsx`, `new-conversation.tsx`, `stock-snapshot-actions.ts`, `ai-health.ts`, `reminder-actions.ts`, `admin-delete-actions.ts`, `change-password-form.tsx`, `onboarding/page.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `requireUser`, `prisma.ts`, `utils.ts`, `lib/labels.ts`, `lib/session.ts`, `hasGlobalView`, `formatDate`, `requireModule`, `card.tsx`, `notifyRoles`, `regulatory/[id]/page.tsx`, `brain-cockpit.tsx`, `lib/audit.ts`, `entities.ts`, `getCurrentUser`, `meeting-actions.ts`, `budget-forms.tsx`, `product-explorer.tsx`, `pilotage/page.tsx`, `operations.ts`, `assistant-actions.ts`, `lib/department-budget.ts`, `payment-request-actions.ts`, `care-actions.ts`, `onlyoffice.ts`, `create-record-button.tsx`, `molecule.ts`, `directory-grid.ts`, `drive/page.tsx`, `calendar.ts`, `assistant.ts`, `lib/ai.ts`, `mon-espace/page.tsx`, `market-research.ts`, `buildRef`, `legal/[id]/page.tsx`, `promo-material-actions.ts`, `events/[id]/page.tsx`, `adoption.ts`, `dashboard.ts`, `medical-actions.ts`, `getAppSettings`, `petty-cash-actions.ts`, `pch-tender-line-actions.ts`, `test-center/page.tsx`, `access-actions.ts`, `stock-board.tsx`, `queries/messaging.ts`, `messaging-actions.ts`, `drive-actions.ts`, `ad-pro/page.tsx`, `companyIdForNew`, `sales-planning-actions.ts`, `aiConfigured`, `dossier-actions.ts`, `stream/route.ts`, `drive/upload/route.ts`, `document-request-actions.ts`, `(app)/layout.tsx`, `departments-manager.tsx`, `medical-info-actions.ts`, `budget-envelope-actions.ts`, `departments.ts`, `mail-client.tsx`, `drive/[id]/page.tsx`, `department-budget-actions.ts`, `market-research-actions.ts`, `congress.ts`, `lib/ad-pro-edit.ts`, `field-reports.ts`, `messaging/messages/route.ts`, `consulting-actions.ts`, `hr-dossier.tsx`, `validations.ts`, `scopeRegulatory`, `consulting/[id]/page.tsx`, `training-actions.ts`, `tender-lines.tsx`, `pch/export/route.ts`, `new-conversation.tsx`, `regulatory/page.tsx`, `stock-snapshot-actions.ts`, `ai-health.ts`, `promo-material.ts`, `rbac.test.ts`, `reminder-actions.ts`, `entites/page.tsx`, `mail-diagnostic/route.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1437 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.03353057199211045 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.044420368364030335 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.035247093023255814 - nodes in this community are weakly interconnected._