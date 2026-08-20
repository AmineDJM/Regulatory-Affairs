# Graph Report - src  (2026-08-20)

## Corpus Check
- 1263 files · ~979,104 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7671 nodes · 30331 edges · 251 communities (244 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 157 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b39c116`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- requireUser
- lib/labels.ts
- status-badge.tsx
- formatDate
- requireModule
- utils.ts
- getMyCompanies
- notifyUser
- hasGlobalView
- regCan
- userCan
- Button
- assistant.ts
- admin-request-actions.ts
- workflow/engine.ts
- agent-core.ts
- calendar.ts
- build-facts.ts
- object-storage.ts
- payment-request-actions.ts
- getCurrentUser
- corpus-actions.ts
- corpus/actions.ts
- rbac.ts
- [dossierId]/page.tsx
- assistant-actions.ts
- legal/page.tsx
- entities.ts
- lib/audit.ts
- fdStr
- brain-cockpit.tsx
- batch-runner.ts
- workspace.tsx
- ad-pro-item-actions.ts
- care-actions.ts
- jobs/runner.ts
- medical-directory-actions.ts
- anyRoleFilter
- prisma.ts
- FindingInput
- onlyoffice.ts
- upload/session.ts
- test-center/runner.ts
- formatDateTime
- aiConfigured
- lib/ai.ts
- molecule.ts
- fdNum
- regAudit
- drive-actions.ts
- mistral-ocr.ts
- ingest-dossier.ts
- http.ts
- library-ingest.ts
- config.ts
- regulatory-workflow.ts
- ocr-engine.ts
- drive/page.tsx
- queries/messaging.ts
- sheet.tsx
- intelligence/actions.ts
- process-intelligence.ts
- adoption.ts
- rules/admin-actions.ts
- rules/engine.ts
- getAppSettings
- rh/[id]/page.tsx
- company.ts
- lib/department-budget.ts
- product-explorer.tsx
- topbar.tsx
- congress-request-actions.ts
- market-research.ts
- pch-tender-line-actions.ts
- platform-audit/engine.ts
- training-actions.ts
- messaging-actions.ts
- stock-board.tsx
- knowledge/actions.ts
- access-actions.ts
- budget-forms.tsx
- microsoft-mail-actions.ts
- message-thread.tsx
- petty-cash-actions.ts
- letterhead-actions.ts
- upload-manager.tsx
- src/auth.ts
- ad-pro.ts
- bd-strategic-table.tsx
- competition.ts
- companyIdForNew
- medical-info-actions.ts
- medical-actions.ts
- payment-authority.ts
- button.tsx
- molecule-panel.tsx
- drive-table.tsx
- purchase-request-actions.ts
- document-request-actions.ts
- regulatory-table.tsx
- leave-workflow.ts
- graph/provider.ts
- smart-mail-actions.ts
- (app)/organigramme/page.tsx
- (app)/layout.tsx
- review-agent.ts
- dossier-actions.ts
- expense-row-actions.tsx
- lifecycle/actions.ts
- reports.ts
- SessionUser
- mail.ts
- state-machines/explorer.ts
- migration-cert.ts
- drive/upload/route.ts
- budget-envelope-actions.ts
- invariants/registry.ts
- extract-text.ts
- scheduled.ts
- enregistrement/page.tsx
- queries/drive.ts
- mail-register-actions.ts
- sheet-import.ts
- connection.ts
- admin-settings-forms.tsx
- risks.ts
- field-reports.ts
- moyens-generaux/page.tsx
- progress/query.ts
- onboarding-wizard.tsx
- portfolio.ts
- getMarketData
- manifest.ts
- features.ts
- directive-actions.ts
- support-actions.ts
- reply.ts
- new-request-picker.tsx
- mail-client.tsx
- request-flow.ts
- regulatory/page.tsx
- department-budget-actions.ts
- budget-general-means.integration.test.ts
- client.ts
- department-budget-table.tsx
- consulting-actions.ts
- new-request.tsx
- dossiers/[id]/panel.tsx
- lib/messaging.ts
- receipt-lines.tsx
- validation-supervision.ts
- auth-actions.ts
- invoice-actions.ts
- departments.ts
- document-mirror.ts
- budget.ts
- new-conversation.tsx
- office/page.tsx
- MicrosoftGraphMailProvider
- rag.ts
- org-chart-print.ts
- driver/page.tsx
- identity-board.tsx
- pch.ts
- payroll-hr-actions.ts
- events.ts
- regulatory/export/route.ts
- ranges-manager.tsx
- paie/page.tsx
- MailProvider
- dashboard.ts
- compare-versions.ts
- budgets/export/route.ts
- pch/export/route.ts
- test-center/page.tsx
- tender-lines.tsx
- reconcile-table.tsx
- simple-pdf.ts
- product-catalog.ts
- typing/route.ts
- node-actions.tsx
- upload-button.tsx
- supplier/actions.ts
- regulatory-actions.ts
- stock-snapshot-actions.ts
- background-upload.tsx
- push.ts
- entites/page.tsx
- assistant-files.ts
- radar.ts
- loadInbox
- rh/upload/route.ts
- ConsultingContractPage
- medical-directory.tsx
- messenger.tsx
- reminder-actions.ts
- congress-beneficiary-actions.ts
- regulatory-drive-mirror.ts
- archive.ts
- getMessage
- congress-workflow.tsx
- ad-pro-transfer-actions.ts
- mail-diagnostic/route.ts
- database-admin-actions.ts
- meetings/page.tsx
- departments-manager.tsx
- supplier-auth.ts
- admin-delete-actions.ts
- api/workflow.ts
- auto-category.ts
- promo-material.ts
- withImap
- Adventum Autonomous Test Center — architecture
- calendar-view.tsx
- client-bundle-guard.test.ts
- mime.ts
- workflow-panel.tsx
- delegate-plans.tsx
- assignment-matrix.tsx
- push-register.tsx
- power-tools.ts
- [token]/route.ts
- courses-board.tsx
- bv-requests.tsx
- employee-form.tsx
- messages-indicator.tsx
- budget-overview.integration.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- events/[id]/export/route.ts
- roles-table.tsx
- test-center-client.tsx
- row-grants.tsx
- request-controls.tsx
- app/layout.tsx
- notification-chime.tsx
- mail/attachment/route.ts
- contacts/route.ts
- mission-stops.tsx
- chrome-metrics.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 758 edges
2. `userCan()` - 594 edges
3. `fdStr()` - 561 edges
4. `recordAudit()` - 511 edges
5. `prisma` - 473 edges
6. `requireModule()` - 254 edges
7. `hasGlobalView()` - 215 edges
8. `Button` - 190 edges
9. `cn()` - 182 edges
10. `formatDate()` - 180 edges

## Surprising Connections (you probably didn't know these)
- `buildFolderTree()` --indirect_call--> `node()`  [INFERRED]
  src/lib/legal/folders.ts → src/lib/org-chart-print.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (251 total, 7 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.03
Nodes (140): AdProOtherDetailPage(), dynamic, AccessUser, ModuleAccessGrid(), ModuleSpec, UserModuleState, AccessByModulePage(), dynamic (+132 more)

### Community 1 - "requireUser"
Cohesion: 0.04
Nodes (114): EntitiesManager(), FieldsManager(), SpaceSettingsButton(), ShareRow(), CancelButton(), AVATAR_COLORS, createUser(), setSecondaryRole() (+106 more)

### Community 2 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): FeedbackStatusSelect(), BDPipeline(), STAGES, BDRow, BDTable(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), NewRequestButton() (+90 more)

### Community 3 - "status-badge.tsx"
Cohesion: 0.07
Nodes (72): dynamic, TYPES, AccessMatrix(), ACTION_COLS, ModuleAccessRow, AdminValidationsPage(), dec(), dynamic (+64 more)

### Community 4 - "formatDate"
Cohesion: 0.03
Nodes (79): dynamic, FocusCard(), MarketResearchListPage(), Budget(), AssistantPage(), ExpenseAckItem, ExpenseAckList(), DemandesPage() (+71 more)

### Community 5 - "requireModule"
Cohesion: 0.05
Nodes (69): AdProPage(), dynamic, AdminWorkflowsPage(), BudgetContextBar(), dynamic, dynamic, dynamic, CongressTable() (+61 more)

### Community 6 - "utils.ts"
Cohesion: 0.04
Nodes (70): AdProList(), EMPTY, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm() (+62 more)

### Community 7 - "getMyCompanies"
Cohesion: 0.04
Nodes (70): AdProOtherPage(), NewRequestPicker(), GammesPage(), ConsultingPage(), dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput() (+62 more)

### Community 8 - "notifyUser"
Cohesion: 0.05
Nodes (80): EventDetail(), EventForm(), RevisionRequest(), RequestRow(), CancelButton(), createMission(), runAutopilot(), createCalendarEvent() (+72 more)

### Community 9 - "hasGlobalView"
Cohesion: 0.07
Nodes (72): CongressIntlDetailPage(), CongressNatDetailPage(), EventFundingPanel(), dynamic, EventDetailPage(), eventValidationSteps(), FormationsPage(), DeclarationDetailPage() (+64 more)

### Community 10 - "regCan"
Cohesion: 0.05
Nodes (66): dynamic, GET(), INLINE_MIME, runtime, dynamic, maxDuration, POST(), runtime (+58 more)

### Community 11 - "userCan"
Cohesion: 0.05
Nodes (74): dynamic, POST(), POST(), PresentationCard(), PresentationPanel(), Res, nOrNull(), PlayerEditor() (+66 more)

### Community 12 - "Button"
Cohesion: 0.06
Nodes (43): DriveStorageSettings(), OrgBranch(), Option, RuleDTO, ResearchMeta(), ProjectEditor(), ProjectStatusBadge(), ConnectMailbox() (+35 more)

### Community 13 - "assistant.ts"
Cohesion: 0.07
Nodes (74): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+66 more)

### Community 14 - "admin-request-actions.ts"
Cohesion: 0.05
Nodes (75): OtherDecisionPanel(), RuleControls(), RuleEditor(), AttachmentValidationBlock(), PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView (+67 more)

### Community 15 - "workflow/engine.ts"
Cohesion: 0.05
Nodes (69): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), Props, DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+61 more)

### Community 16 - "agent-core.ts"
Cohesion: 0.05
Nodes (56): MeetingRecorder(), pickMime(), AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn (+48 more)

### Community 17 - "calendar.ts"
Cohesion: 0.05
Nodes (61): dynamic, GET(), CalendarPage(), dynamic, externalBase(), formatDateTime(), MeetingDetailPage(), dynamic (+53 more)

### Community 18 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 19 - "object-storage.ts"
Cohesion: 0.07
Nodes (68): dynamic, GET(), runtime, POST(), RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload() (+60 more)

### Community 20 - "payment-request-actions.ts"
Cohesion: 0.07
Nodes (64): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, PaymentRequestPage() (+56 more)

### Community 21 - "getCurrentUser"
Cohesion: 0.06
Nodes (55): dynamic, GET(), GET(), DELETE(), dynamic, POST(), dynamic, GET() (+47 more)

### Community 22 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (59): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+51 more)

### Community 23 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (48): CorpusAdmin(), ACCEPT, AUTHORITIES, CorpusImport(), Row, CaseCard(), CaseDocRow, CaseRow (+40 more)

### Community 24 - "rbac.ts"
Cohesion: 0.06
Nodes (57): GET(), SearchPage(), Target, executeReadTool(), ENTITY_MODULE, isRequestOwner(), NAV_LEGACY_LABELS, DirectiveDetail (+49 more)

### Community 25 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (53): AgentItem, AgentsPanel(), RunState, DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime() (+45 more)

### Community 26 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (53): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+45 more)

### Community 27 - "legal/page.tsx"
Cohesion: 0.08
Nodes (46): FolderRow, LegalFolderBar(), LegalDocumentPage(), legalFields(), LegalRow, dynamic, LegalPage(), metadata (+38 more)

### Community 28 - "entities.ts"
Cohesion: 0.08
Nodes (43): GET, ASPECTS, GET, GET, GET, RESERVED, blockOf(), GET (+35 more)

### Community 29 - "lib/audit.ts"
Cohesion: 0.06
Nodes (45): ActiveToggle(), ImpersonateButton(), DriveComments(), CreateRecordButtonProps, RecordFormProps, updateAiSettings(), computeStatus(), createBudget() (+37 more)

### Community 30 - "fdStr"
Cohesion: 0.08
Nodes (56): ReportEditor(), SimpleReportEditor(), EditMeetingButton(), InviteResponse(), Resp, MeetingMessageItem(), ManageBar(), ProposalActions() (+48 more)

### Community 31 - "brain-cockpit.tsx"
Cohesion: 0.06
Nodes (47): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+39 more)

### Community 32 - "batch-runner.ts"
Cohesion: 0.06
Nodes (51): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+43 more)

### Community 33 - "workspace.tsx"
Cohesion: 0.07
Nodes (43): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+35 more)

### Community 34 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 35 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 36 - "jobs/runner.ts"
Cohesion: 0.09
Nodes (54): splitTextIntoChunksWithOffsets(), corpusForSection(), submitVersionReviewBatch(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiBatchDefault(), aiConcurrency(), aiMaxChunks() (+46 more)

### Community 37 - "medical-directory-actions.ts"
Cohesion: 0.09
Nodes (46): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, addDirectoryDoctor(), importDirectorySheet() (+38 more)

### Community 38 - "anyRoleFilter"
Cohesion: 0.09
Nodes (45): AffectationsPage(), dynamic, CataloguePage(), dynamic, dynamic, EquipesPage(), Draft, fmtDZD() (+37 more)

### Community 39 - "prisma.ts"
Cohesion: 0.07
Nodes (25): dynamic, GET(), dynamic, GET(), RegScopeCard(), actorFor(), actorFor(), OLD_HASH (+17 more)

### Community 40 - "FindingInput"
Cohesion: 0.10
Nodes (39): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+31 more)

### Community 41 - "onlyoffice.ts"
Cohesion: 0.10
Nodes (40): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+32 more)

### Community 42 - "upload/session.ts"
Cohesion: 0.07
Nodes (43): dynamic, runtime, DELETE(), dynamic, GET(), runtime, scope(), IngestResult (+35 more)

### Community 43 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (38): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), sttConfigured(), Severity, base, Certification (+30 more)

### Community 44 - "formatDateTime"
Cohesion: 0.06
Nodes (37): ActivityRow, ActivityTable(), TYPE, AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, AuditPanel() (+29 more)

### Community 45 - "aiConfigured"
Cohesion: 0.09
Nodes (42): aiConfigured(), ClaudeContentBlock, ClaudeMessage, addCitation(), buildUserMessage(), READABLE_STATUSES, runDossierAgent(), runTool() (+34 more)

### Community 46 - "lib/ai.ts"
Cohesion: 0.07
Nodes (35): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiModel(), aiSelfTest(), AiTextResult, analyzeFieldReport(), AnthropicBlock (+27 more)

### Community 47 - "molecule.ts"
Cohesion: 0.11
Nodes (43): MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts() (+35 more)

### Community 48 - "fdNum"
Cohesion: 0.10
Nodes (41): EditTransactionSheet(), createBD(), canManagePlan(), createDelegatePlan(), deleteDelegatePlan(), duplicateDelegatePlan(), isPlanManager(), updateDelegatePlan() (+33 more)

### Community 49 - "regAudit"
Cohesion: 0.09
Nodes (38): dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, regAudit() (+30 more)

### Community 50 - "drive-actions.ts"
Cohesion: 0.11
Nodes (37): GET(), MIME_BY_EXT, mimeByName(), mimeOf(), POST(), GET(), DriveCanvas(), ITEMS (+29 more)

### Community 51 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 52 - "ingest-dossier.ts"
Cohesion: 0.08
Nodes (43): dynamic, maxDuration, POST(), runtime, archiveQueue, attachArchive(), clampInt(), enqueueArchive() (+35 more)

### Community 53 - "http.ts"
Cohesion: 0.10
Nodes (36): GET, GET, GET, POST, ApiContext, authenticate(), generateApiKey(), hashApiKey() (+28 more)

### Community 54 - "library-ingest.ts"
Cohesion: 0.08
Nodes (36): analyzeEmployeeContract(), CONTRACT_TYPES_UP, canOcr(), ocrDocument(), rasterizePdf(), asSectionHeader(), CATEGORIES, categorizeReserve() (+28 more)

### Community 55 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 56 - "regulatory-workflow.ts"
Cohesion: 0.10
Nodes (40): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), completeStepsThrough() (+32 more)

### Community 57 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (37): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+29 more)

### Community 58 - "drive/page.tsx"
Cohesion: 0.12
Nodes (33): DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage(), dynamic, ExplorerNav(), SpaceLite, UserLite (+25 more)

### Community 59 - "queries/messaging.ts"
Cohesion: 0.10
Nodes (35): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+27 more)

### Community 60 - "sheet.tsx"
Cohesion: 0.08
Nodes (26): DeleteMailButton(), EditMailButton(), CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt, TYPES, EditLegalButton() (+18 more)

### Community 61 - "intelligence/actions.ts"
Cohesion: 0.09
Nodes (34): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+26 more)

### Community 62 - "process-intelligence.ts"
Cohesion: 0.09
Nodes (34): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+26 more)

### Community 63 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 64 - "rules/admin-actions.ts"
Cohesion: 0.10
Nodes (30): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+22 more)

### Community 65 - "rules/engine.ts"
Cohesion: 0.09
Nodes (30): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), AssessmentResult, AssessmentSummary, assessVersion() (+22 more)

### Community 66 - "getAppSettings"
Cohesion: 0.12
Nodes (28): dynamic, POST(), dynamic, POST(), ActionResult, uploadDocument(), requestBV(), attachFiles() (+20 more)

### Community 67 - "rh/[id]/page.tsx"
Cohesion: 0.08
Nodes (30): FieldDefDTO, CustomFieldsPage(), dynamic, MonDossierPage(), CompanyAccessCard(), CompanyAccessRow, EmployeeForm(), d10() (+22 more)

### Community 68 - "company.ts"
Cohesion: 0.12
Nodes (30): PeoplePanel(), AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES (+22 more)

### Community 69 - "lib/department-budget.ts"
Cohesion: 0.14
Nodes (31): DepartmentBudgetTable(), DepartmentBudgetsPage(), dynamic, allocatedOf(), BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget() (+23 more)

### Community 70 - "product-explorer.tsx"
Cohesion: 0.10
Nodes (32): AggNum(), BdProjectDetailPage(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS (+24 more)

### Community 71 - "topbar.tsx"
Cohesion: 0.12
Nodes (27): Company, CompanySwitcher(), isActive(), MobileTabBar(), PRIMARY, Tile(), badgeFor(), navPaths() (+19 more)

### Community 72 - "congress-request-actions.ts"
Cohesion: 0.16
Nodes (33): ThirdPartyInvolveButton(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision() (+25 more)

### Community 73 - "market-research.ts"
Cohesion: 0.10
Nodes (30): GET(), GET(), MarketResearchDetailPage(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd(), footer() (+22 more)

### Community 74 - "pch-tender-line-actions.ts"
Cohesion: 0.14
Nodes (32): analyzeMoleculeSafe(), analyzeTenderDocument(), analyzeTenderText(), dominantOrigin(), enrichLineById(), enrichTenderLine(), extractAndSaveLines(), int() (+24 more)

### Community 75 - "platform-audit/engine.ts"
Cohesion: 0.11
Nodes (31): DiagnosticPage(), scoreColor(), generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals (+23 more)

### Community 76 - "training-actions.ts"
Cohesion: 0.15
Nodes (30): TrainingBoard(), TrainingParticipantRow, TrainingRow, attachFiles(), createHrTraining(), deciderFor(), decideTraining(), inviteTrainingParticipants() (+22 more)

### Community 77 - "messaging-actions.ts"
Cohesion: 0.15
Nodes (32): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+24 more)

### Community 78 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 79 - "knowledge/actions.ts"
Cohesion: 0.12
Nodes (28): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, askDossierAgentAction(), loadDossierChatAction() (+20 more)

### Community 80 - "access-actions.ts"
Cohesion: 0.13
Nodes (27): ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), RevokeAllButton(), adminResetPassword(), requestOnboarding() (+19 more)

### Community 81 - "budget-forms.tsx"
Cohesion: 0.14
Nodes (29): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+21 more)

### Community 82 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 83 - "message-thread.tsx"
Cohesion: 0.13
Nodes (25): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+17 more)

### Community 84 - "petty-cash-actions.ts"
Cohesion: 0.16
Nodes (25): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+17 more)

### Community 85 - "letterhead-actions.ts"
Cohesion: 0.12
Nodes (26): EditSheet(), LetterheadManager(), UploadSheet(), deleteLetterhead(), updateLetterhead(), uploadLetterhead(), canManageLetterheads(), documentName() (+18 more)

### Community 86 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 87 - "src/auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 88 - "ad-pro.ts"
Cohesion: 0.12
Nodes (24): Filters, NewRequestPickerProps, AdProCreateData, AD_PRO_KINDS, AD_PRO_STATE, AdProKind, AdProRequest, adProState (+16 more)

### Community 89 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 90 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 91 - "companyIdForNew"
Cohesion: 0.12
Nodes (27): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+19 more)

### Community 92 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+17 more)

### Community 93 - "medical-actions.ts"
Cohesion: 0.12
Nodes (29): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+21 more)

### Community 94 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 95 - "button.tsx"
Cohesion: 0.07
Nodes (21): Citation, Source, Version, RestoreButton(), NewReportButton(), Question, Req, STATUS (+13 more)

### Community 96 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 97 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 98 - "purchase-request-actions.ts"
Cohesion: 0.21
Nodes (21): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), CatalogArticle, createPurchaseRequest() (+13 more)

### Community 99 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 100 - "regulatory-table.tsx"
Cohesion: 0.12
Nodes (20): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryTable(), STAGE_CLASS (+12 more)

### Community 101 - "leave-workflow.ts"
Cohesion: 0.11
Nodes (24): PendingLeave, LeaveItem, applyChainDecision(), canDecideChain(), ChainDecider, ChainState, ChainStatus, ChainTransition (+16 more)

### Community 102 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 103 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 104 - "(app)/organigramme/page.tsx"
Cohesion: 0.11
Nodes (19): OrgChartEditor(), OrgNode, OrgWorkspace(), dynamic, metadata, OrganigrammePage(), CorpusPage(), dynamic (+11 more)

### Community 105 - "(app)/layout.tsx"
Cohesion: 0.11
Nodes (18): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+10 more)

### Community 106 - "review-agent.ts"
Cohesion: 0.12
Nodes (20): aiChunkChars(), aiChunkPages(), chunkPageSpan(), clampInt(), OffsetChunk, splitTextIntoChunks(), AiFinding, AiFindingSchema (+12 more)

### Community 107 - "dossier-actions.ts"
Cohesion: 0.18
Nodes (23): LinkToDossier(), DossierStatusControls(), CreateDossierButton(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage() (+15 more)

### Community 108 - "expense-row-actions.tsx"
Cohesion: 0.16
Nodes (19): BudgetTargetField(), ExpensePanel(), EditableExpense, ExpenseRowActions(), ExistingLine, deleteDepartmentExpense(), BudgetTarget, cashAvailable() (+11 more)

### Community 109 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 110 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 111 - "SessionUser"
Cohesion: 0.10
Nodes (17): actor(), canViewSupport(), isSupportResponder(), SupportDetail, CONG_STAGE, CrossValidationItem, getMyValidationRequests(), getMyValidations() (+9 more)

### Community 112 - "mail.ts"
Cohesion: 0.08
Nodes (25): acquireSlot(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, DIAG_LABEL, IMAP_IDLE_MS, imapChains, imapPool, imapWaiters (+17 more)

### Community 113 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 114 - "migration-cert.ts"
Cohesion: 0.19
Nodes (21): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), infraChecks() (+13 more)

### Community 115 - "drive/upload/route.ts"
Cohesion: 0.15
Nodes (14): POST(), GB, makeTtlCache(), quotaVerdict, TtlCache, formatTiming(), Phase, slowestPhase() (+6 more)

### Community 116 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (22): addBudgetExpense(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory(), ensureCanManageEnvelope() (+14 more)

### Community 117 - "invariants/registry.ts"
Cohesion: 0.12
Nodes (15): PERMISSIONS, InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole() (+7 more)

### Community 118 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 119 - "scheduled.ts"
Cohesion: 0.15
Nodes (22): AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews(), catchUpStalledPipelines() (+14 more)

### Community 120 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 121 - "queries/drive.ts"
Cohesion: 0.15
Nodes (20): browseDrive(), BrowseNode, BrowseResult, EMPTY, DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow (+12 more)

### Community 122 - "mail-register-actions.ts"
Cohesion: 0.17
Nodes (20): createMailEntry(), editMailEntry(), fdDateTime(), parseDirection(), readFields(), describeMailChanges(), diffMailEntry(), MAIL_TRACKED_FIELDS (+12 more)

### Community 123 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 124 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 125 - "admin-settings-forms.tsx"
Cohesion: 0.13
Nodes (21): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+13 more)

### Community 126 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 127 - "field-reports.ts"
Cohesion: 0.12
Nodes (18): dynamic, GET(), FieldReportPage(), HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea() (+10 more)

### Community 128 - "moyens-generaux/page.tsx"
Cohesion: 0.16
Nodes (19): Consumption(), DepartmentSwitcher(), dynamic, metadata, MoyensGenerauxPage(), budgetHealth, consumedPercent(), currentPeriod() (+11 more)

### Community 129 - "progress/query.ts"
Cohesion: 0.16
Nodes (17): AnalysisProgressCard(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta(), pctFrac(), PHASE_LABELS (+9 more)

### Community 130 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 131 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 132 - "getMarketData"
Cohesion: 0.14
Nodes (20): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+12 more)

### Community 133 - "manifest.ts"
Cohesion: 0.16
Nodes (17): getTestCenterDashboard(), CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact() (+9 more)

### Community 134 - "features.ts"
Cohesion: 0.18
Nodes (16): VersionsPage(), AssistantPage(), dynamic, TodayPage(), dynamic, RootPage(), MorningBrief(), refreshMyBrief() (+8 more)

### Community 135 - "directive-actions.ts"
Cohesion: 0.20
Nodes (18): DirectiveDetailPage(), MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate() (+10 more)

### Community 136 - "support-actions.ts"
Cohesion: 0.21
Nodes (17): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+9 more)

### Community 137 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 138 - "new-request-picker.tsx"
Cohesion: 0.15
Nodes (13): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton() (+5 more)

### Community 139 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 140 - "request-flow.ts"
Cohesion: 0.23
Nodes (18): TaskDossierPage(), TaskWorkPanel(), respondTaskRequest(), ACCEPTED_STATUS, awaitingResponse(), canAttach(), canDoWork(), canRespond() (+10 more)

### Community 141 - "regulatory/page.tsx"
Cohesion: 0.21
Nodes (15): RegulatoryPage(), BusinessDevelopmentPipelinePage(), RegulatoryRow, SuppliersManager(), effectiveTherapeuticSegments(), getRegulatoryRows(), isRegulatorySupervisor(), effectiveStage (+7 more)

### Community 142 - "department-budget-actions.ts"
Cohesion: 0.29
Nodes (18): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget() (+10 more)

### Community 143 - "budget-general-means.integration.test.ts"
Cohesion: 0.17
Nodes (15): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+7 more)

### Community 144 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 145 - "department-budget-table.tsx"
Cohesion: 0.14
Nodes (16): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), ExpenseForm(), RequestForm(), RequestList(), decideDepartmentBudgetRequest() (+8 more)

### Community 146 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 147 - "new-request.tsx"
Cohesion: 0.14
Nodes (14): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, DriveExplorerSheet(), DrivePickerField() (+6 more)

### Community 148 - "dossiers/[id]/panel.tsx"
Cohesion: 0.15
Nodes (13): DossierAssign(), MessageAttachments(), MsgAttachment, useAction(), UserLite, DoctorPicker(), Attachments(), ChatAttachment (+5 more)

### Community 149 - "lib/messaging.ts"
Cohesion: 0.15
Nodes (16): DOT, MyStatus(), parseAttachments(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+8 more)

### Community 150 - "receipt-lines.tsx"
Cohesion: 0.30
Nodes (15): empty(), ReceiptLines(), Row, readReceipt(), ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField() (+7 more)

### Community 151 - "validation-supervision.ts"
Cohesion: 0.20
Nodes (16): SupervisionBoard(), daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, supervisionCounters, SupervisionFilter (+8 more)

### Community 152 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 153 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 154 - "departments.ts"
Cohesion: 0.18
Nodes (16): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentPath(), getDepartmentSubtreeIds() (+8 more)

### Community 155 - "document-mirror.ts"
Cohesion: 0.25
Nodes (13): POST(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference(), ensureDriveFolder(), ensureDrivePath(), ALREADY_MIRRORED (+5 more)

### Community 156 - "budget.ts"
Cohesion: 0.19
Nodes (14): BudgetExpensesPage(), BudgetsPage(), BudgetSettingsPage(), resolveBudgetEnvelope(), BudgetHealth, BudgetMonthPoint, buildMonthlySeries(), EnvelopeSummaryItem (+6 more)

### Community 157 - "new-conversation.tsx"
Cohesion: 0.15
Nodes (13): Props, Props, Props, fd(), MemberMultiSelect(), Mode, Props, SearchBox() (+5 more)

### Community 158 - "office/page.tsx"
Cohesion: 0.30
Nodes (13): OfficeLauncher(), dynamic, OfficePage(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp (+5 more)

### Community 159 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 160 - "rag.ts"
Cohesion: 0.22
Nodes (13): lunaEmbed(), citationsByIds(), CorpusFilters, Row, searchCorpus(), searchCorpusLexical(), activeStamp(), cosine() (+5 more)

### Community 161 - "org-chart-print.ts"
Cohesion: 0.24
Nodes (12): OrgCanvas(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml(), OrgSvg, PRINT_BOX_H, PRINT_BOX_W (+4 more)

### Community 162 - "driver/page.tsx"
Cohesion: 0.20
Nodes (12): ApprovalsPage(), CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), getApprovals(), getAssistantData() (+4 more)

### Community 163 - "identity-board.tsx"
Cohesion: 0.27
Nodes (12): CopyButton(), IdentityBoard(), IdentityCompany, IdentitySheet(), dynamic, LegalIdentitiesPage(), filledCount(), IDENTITY_SECTIONS (+4 more)

### Community 164 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 165 - "payroll-hr-actions.ts"
Cohesion: 0.33
Nodes (13): PayrollMatrix(), ym(), canRunPayroll(), markSalaryPaid(), transferPayrollToBudget(), unmarkSalaryPaid(), updatePayrollEntry(), ym() (+5 more)

### Community 166 - "events.ts"
Cohesion: 0.15
Nodes (14): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+6 more)

### Community 167 - "regulatory/export/route.ts"
Cohesion: 0.30
Nodes (11): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+3 more)

### Community 168 - "ranges-manager.tsx"
Cohesion: 0.29
Nodes (13): PALETTE, PersonRow, PersonSheet(), ProductOption, ProductPicker(), RangeSheet(), canManage(), createProductRange() (+5 more)

### Community 169 - "paie/page.tsx"
Cohesion: 0.25
Nodes (12): dynamic, PaiePage(), PayrollRow, basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost() (+4 more)

### Community 171 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 172 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 173 - "budgets/export/route.ts"
Cohesion: 0.26
Nodes (10): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetOverview (+2 more)

### Community 174 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 175 - "test-center/page.tsx"
Cohesion: 0.18
Nodes (12): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+4 more)

### Community 176 - "tender-lines.tsx"
Cohesion: 0.22
Nodes (12): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), deleteTenderLine() (+4 more)

### Community 177 - "reconcile-table.tsx"
Cohesion: 0.26
Nodes (11): KIND_LABEL, OrphanRow(), ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), CatalogKind, guard(), linkProductToDossierFor() (+3 more)

### Community 178 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 179 - "product-catalog.ts"
Cohesion: 0.27
Nodes (11): bestMatches(), isConfident(), MatchProposal, matchScore(), ProductIdentity, STRONG_MATCH, REG, dossierLabel() (+3 more)

### Community 180 - "typing/route.ts"
Cohesion: 0.21
Nodes (9): dynamic, GET(), dynamic, NO_CONTENT, POST(), canAccessConversation(), ConversationTyping, registry (+1 more)

### Community 181 - "node-actions.tsx"
Cohesion: 0.22
Nodes (9): ShareItem, SharePanel(), AccessSheet(), MenuItem(), MoveTarget, Props, UserLite, SendToLegalItem() (+1 more)

### Community 182 - "upload-button.tsx"
Cohesion: 0.27
Nodes (10): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), UserLite, FINGERPRINT_MAX_BYTES, FINGERPRINT_MIN_BYTES, fingerprintFile() (+2 more)

### Community 183 - "supplier/actions.ts"
Cohesion: 0.38
Nodes (11): SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier(), regenerateSupplierDraft(), remindSupplier(), requestDossierId() (+3 more)

### Community 184 - "regulatory-actions.ts"
Cohesion: 0.22
Nodes (11): StatusEditor(), normalizeDci(), parseProductChannel(), regSupervisorRoles(), setRegulatoryPresubOutcome(), updateRegulatoryProduct(), updateRegulatoryStatus(), upperMolecules() (+3 more)

### Community 185 - "stock-snapshot-actions.ts"
Cohesion: 0.23
Nodes (12): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+4 more)

### Community 186 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 187 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 188 - "entites/page.tsx"
Cohesion: 0.26
Nodes (8): EntityRow, PALETTE, OrphansPanel(), dynamic, EntitesPage(), getUnattachedInventory(), TABLES, UnattachedGroup

### Community 189 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 190 - "radar.ts"
Cohesion: 0.27
Nodes (11): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+3 more)

### Community 191 - "loadInbox"
Cohesion: 0.20
Nodes (10): dynamic, GET(), addrStr(), listingKey(), listMailboxes(), listMessages(), loadInbox(), mailBreakerRemainingMs() (+2 more)

### Community 192 - "rh/upload/route.ts"
Cohesion: 0.42
Nodes (8): dynamic, POST(), HrDossier(), defaultVisibleToEmployee(), EMPLOYEE_FACING, resolveVisibility(), shouldMirrorToDrive(), visibilityLabel()

### Community 193 - "ConsultingContractPage"
Cohesion: 0.35
Nodes (9): ConsultingContractPage(), billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue(), MOVES (+1 more)

### Community 194 - "medical-directory.tsx"
Cohesion: 0.24
Nodes (9): Props, Result, SECTOR_ICON, SECTOR_ORDER, INSTITUTION_SECTOR, INSTITUTION_TYPE, InstitutionDTO, SpecialtyDTO (+1 more)

### Community 195 - "messenger.tsx"
Cohesion: 0.33
Nodes (9): ConversationList(), relativeTime(), bumpConversation(), Messenger(), bookmarkMessage(), editMessage(), markRead(), togglePinMessage() (+1 more)

### Community 196 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 197 - "congress-beneficiary-actions.ts"
Cohesion: 0.42
Nodes (10): addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf(), removeCongressBeneficiary() (+2 more)

### Community 198 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 199 - "archive.ts"
Cohesion: 0.31
Nodes (7): GET(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), readFileByKey()

### Community 200 - "getMessage"
Cohesion: 0.24
Nodes (9): dynamic, GET(), friendlyMailError(), getMessage(), isOverloadError(), msgKey(), noteMailFailure(), noteMailSuccess() (+1 more)

### Community 201 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 202 - "ad-pro-transfer-actions.ts"
Cohesion: 0.29
Nodes (9): AdProKind, closeSource(), Common, createTarget(), isKind(), LABELS, PATHS, readSource() (+1 more)

### Community 203 - "mail-diagnostic/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, POST(), classifyMailError(), decryptSecret(), imapClient(), mailDiagnostic, masterKey(), withAccountLock()

### Community 204 - "database-admin-actions.ts"
Cohesion: 0.44
Nodes (7): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs()

### Community 205 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 206 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 207 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 208 - "admin-delete-actions.ts"
Cohesion: 0.33
Nodes (8): delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord(), superAdminDelete()

### Community 209 - "api/workflow.ts"
Cohesion: 0.31
Nodes (8): AvailableAction, availableActionsFor(), genericWorkflow(), label(), regulatoryWorkflow(), workflowOf(), WorkflowStep, WorkflowView

### Community 210 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 211 - "promo-material.ts"
Cohesion: 0.33
Nodes (8): CompanyLite, getPromoMaterial(), getPromoMaterials(), PromoDetail, PromoListItem, promoNames(), resolveNames(), scopePromoMaterial()

### Community 212 - "withImap"
Cohesion: 0.31
Nodes (9): acquirePooled(), appendToSent(), dropPooled(), evictColdest(), imapBackoff(), isTransientMailError(), keepWarm(), poolKey() (+1 more)

### Community 213 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 214 - "calendar-view.tsx"
Cohesion: 0.29
Nodes (6): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND

### Community 215 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 216 - "mime.ts"
Cohesion: 0.36
Nodes (5): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith()

### Community 217 - "workflow-panel.tsx"
Cohesion: 0.38
Nodes (5): PmOpt, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel()

### Community 218 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 219 - "assignment-matrix.tsx"
Cohesion: 0.38
Nodes (6): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod

### Community 220 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 221 - "power-tools.ts"
Cohesion: 0.38
Nodes (4): ClaudeToolDef, executePowerTool(), POWER_TOOLS, PowerTool

### Community 222 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 223 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 224 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 225 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 226 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 227 - "budget-overview.integration.test.ts"
Cohesion: 0.33
Nodes (4): DAY, PERIOD_END, PERIOD_START, SUPER

### Community 229 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 230 - "events/[id]/export/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, esc(), GET(), REGISTRATION_STATUS

### Community 231 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 232 - "test-center-client.tsx"
Cohesion: 0.50
Nodes (4): ENV_LABEL, MODES, ResumeCleanupButton(), resumeTestCleanup()

### Community 233 - "row-grants.tsx"
Cohesion: 0.50
Nodes (4): GrantOption, RowGrants(), RowGrantsProps, setRowGrants()

### Community 234 - "request-controls.tsx"
Cohesion: 0.60
Nodes (4): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 235 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 236 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 237 - "mail/attachment/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAttachment()

### Community 238 - "contacts/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), listRecentContacts()

### Community 239 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 240 - "chrome-metrics.tsx"
Cohesion: 0.83
Nodes (3): ChromeMetrics(), usePublishedHeight(), useTabBarHeight()

## Knowledge Gaps
- **1460 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1455 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `requireUser`, `lib/labels.ts`, `status-badge.tsx`, `formatDate`, `requireModule`, `utils.ts`, `getMyCompanies`, `notifyUser`, `hasGlobalView`, `regCan`, `userCan`, `assistant.ts`, `admin-request-actions.ts`, `workflow/engine.ts`, `agent-core.ts`, `calendar.ts`, `build-facts.ts`, `payment-request-actions.ts`, `getCurrentUser`, `corpus-actions.ts`, `corpus/actions.ts`, `rbac.ts`, `[dossierId]/page.tsx`, `assistant-actions.ts`, `legal/page.tsx`, `entities.ts`, `lib/audit.ts`, `fdStr`, `brain-cockpit.tsx`, `batch-runner.ts`, `ad-pro-item-actions.ts`, `care-actions.ts`, `jobs/runner.ts`, `medical-directory-actions.ts`, `anyRoleFilter`, `onlyoffice.ts`, `upload/session.ts`, `test-center/runner.ts`, `formatDateTime`, `aiConfigured`, `lib/ai.ts`, `fdNum`, `regAudit`, `drive-actions.ts`, `ingest-dossier.ts`, `http.ts`, `library-ingest.ts`, `drive/page.tsx`, `queries/messaging.ts`, `sheet.tsx`, `intelligence/actions.ts`, `process-intelligence.ts`, `adoption.ts`, `rules/admin-actions.ts`, `getAppSettings`, `rh/[id]/page.tsx`, `company.ts`, `lib/department-budget.ts`, `congress-request-actions.ts`, `market-research.ts`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `training-actions.ts`, `messaging-actions.ts`, `stock-board.tsx`, `knowledge/actions.ts`, `access-actions.ts`, `microsoft-mail-actions.ts`, `petty-cash-actions.ts`, `letterhead-actions.ts`, `src/auth.ts`, `ad-pro.ts`, `bd-strategic-table.tsx`, `companyIdForNew`, `medical-info-actions.ts`, `medical-actions.ts`, `purchase-request-actions.ts`, `document-request-actions.ts`, `regulatory-table.tsx`, `smart-mail-actions.ts`, `(app)/organigramme/page.tsx`, `(app)/layout.tsx`, `dossier-actions.ts`, `expense-row-actions.tsx`, `lifecycle/actions.ts`, `reports.ts`, `SessionUser`, `mail.ts`, `state-machines/explorer.ts`, `migration-cert.ts`, `drive/upload/route.ts`, `budget-envelope-actions.ts`, `invariants/registry.ts`, `scheduled.ts`, `queries/drive.ts`, `mail-register-actions.ts`, `connection.ts`, `admin-settings-forms.tsx`, `risks.ts`, `field-reports.ts`, `moyens-generaux/page.tsx`, `progress/query.ts`, `onboarding-wizard.tsx`, `portfolio.ts`, `manifest.ts`, `features.ts`, `directive-actions.ts`, `support-actions.ts`, `regulatory/page.tsx`, `department-budget-actions.ts`, `budget-general-means.integration.test.ts`, `consulting-actions.ts`, `lib/messaging.ts`, `receipt-lines.tsx`, `auth-actions.ts`, `invoice-actions.ts`, `departments.ts`, `document-mirror.ts`, `budget.ts`, `office/page.tsx`, `rag.ts`, `driver/page.tsx`, `identity-board.tsx`, `pch.ts`, `payroll-hr-actions.ts`, `events.ts`, `regulatory/export/route.ts`, `ranges-manager.tsx`, `paie/page.tsx`, `dashboard.ts`, `compare-versions.ts`, `pch/export/route.ts`, `reconcile-table.tsx`, `product-catalog.ts`, `typing/route.ts`, `supplier/actions.ts`, `regulatory-actions.ts`, `stock-snapshot-actions.ts`, `push.ts`, `entites/page.tsx`, `rh/upload/route.ts`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `regulatory-drive-mirror.ts`, `archive.ts`, `ad-pro-transfer-actions.ts`, `mail-diagnostic/route.ts`, `database-admin-actions.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `admin-delete-actions.ts`, `api/workflow.ts`, `promo-material.ts`, `[token]/route.ts`, `budget-overview.integration.test.ts`, `events/[id]/export/route.ts`, `contacts/route.ts`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `requireUser`, `lib/labels.ts`, `status-badge.tsx`, `formatDate`, `requireModule`, `utils.ts`, `getMyCompanies`, `notifyUser`, `hasGlobalView`, `assistant.ts`, `admin-request-actions.ts`, `calendar.ts`, `payment-request-actions.ts`, `getCurrentUser`, `rbac.ts`, `assistant-actions.ts`, `legal/page.tsx`, `entities.ts`, `lib/audit.ts`, `fdStr`, `brain-cockpit.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `medical-directory-actions.ts`, `anyRoleFilter`, `prisma.ts`, `onlyoffice.ts`, `formatDateTime`, `lib/ai.ts`, `molecule.ts`, `fdNum`, `drive-actions.ts`, `http.ts`, `library-ingest.ts`, `drive/page.tsx`, `queries/messaging.ts`, `process-intelligence.ts`, `adoption.ts`, `getAppSettings`, `rh/[id]/page.tsx`, `lib/department-budget.ts`, `product-explorer.tsx`, `congress-request-actions.ts`, `market-research.ts`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `training-actions.ts`, `messaging-actions.ts`, `stock-board.tsx`, `access-actions.ts`, `budget-forms.tsx`, `petty-cash-actions.ts`, `ad-pro.ts`, `companyIdForNew`, `medical-info-actions.ts`, `medical-actions.ts`, `document-request-actions.ts`, `(app)/organigramme/page.tsx`, `(app)/layout.tsx`, `dossier-actions.ts`, `SessionUser`, `drive/upload/route.ts`, `budget-envelope-actions.ts`, `queries/drive.ts`, `mail-register-actions.ts`, `field-reports.ts`, `moyens-generaux/page.tsx`, `directive-actions.ts`, `support-actions.ts`, `regulatory/page.tsx`, `department-budget-actions.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `driver/page.tsx`, `identity-board.tsx`, `payroll-hr-actions.ts`, `regulatory/export/route.ts`, `ranges-manager.tsx`, `paie/page.tsx`, `dashboard.ts`, `budgets/export/route.ts`, `pch/export/route.ts`, `test-center/page.tsx`, `tender-lines.tsx`, `reconcile-table.tsx`, `typing/route.ts`, `regulatory-actions.ts`, `stock-snapshot-actions.ts`, `entites/page.tsx`, `rh/upload/route.ts`, `ConsultingContractPage`, `reminder-actions.ts`, `mail-diagnostic/route.ts`, `api/workflow.ts`, `promo-material.ts`, `power-tools.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `status-badge.tsx`, `requireModule`, `utils.ts`, `getMyCompanies`, `notifyUser`, `hasGlobalView`, `regCan`, `userCan`, `assistant.ts`, `admin-request-actions.ts`, `workflow/engine.ts`, `payment-request-actions.ts`, `getCurrentUser`, `corpus-actions.ts`, `corpus/actions.ts`, `rbac.ts`, `[dossierId]/page.tsx`, `assistant-actions.ts`, `legal/page.tsx`, `lib/audit.ts`, `fdStr`, `brain-cockpit.tsx`, `workspace.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `medical-directory-actions.ts`, `onlyoffice.ts`, `test-center/runner.ts`, `formatDateTime`, `lib/ai.ts`, `molecule.ts`, `fdNum`, `regAudit`, `drive-actions.ts`, `library-ingest.ts`, `config.ts`, `regulatory-workflow.ts`, `drive/page.tsx`, `intelligence/actions.ts`, `process-intelligence.ts`, `rules/admin-actions.ts`, `getAppSettings`, `rh/[id]/page.tsx`, `lib/department-budget.ts`, `congress-request-actions.ts`, `pch-tender-line-actions.ts`, `platform-audit/engine.ts`, `training-actions.ts`, `messaging-actions.ts`, `stock-board.tsx`, `knowledge/actions.ts`, `access-actions.ts`, `budget-forms.tsx`, `microsoft-mail-actions.ts`, `petty-cash-actions.ts`, `letterhead-actions.ts`, `companyIdForNew`, `medical-info-actions.ts`, `medical-actions.ts`, `purchase-request-actions.ts`, `document-request-actions.ts`, `smart-mail-actions.ts`, `(app)/organigramme/page.tsx`, `(app)/layout.tsx`, `dossier-actions.ts`, `expense-row-actions.tsx`, `lifecycle/actions.ts`, `reports.ts`, `budget-envelope-actions.ts`, `queries/drive.ts`, `mail-register-actions.ts`, `moyens-generaux/page.tsx`, `onboarding-wizard.tsx`, `features.ts`, `directive-actions.ts`, `support-actions.ts`, `request-flow.ts`, `department-budget-actions.ts`, `department-budget-table.tsx`, `consulting-actions.ts`, `lib/messaging.ts`, `auth-actions.ts`, `invoice-actions.ts`, `payroll-hr-actions.ts`, `ranges-manager.tsx`, `tender-lines.tsx`, `reconcile-table.tsx`, `node-actions.tsx`, `supplier/actions.ts`, `regulatory-actions.ts`, `stock-snapshot-actions.ts`, `messenger.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `ad-pro-transfer-actions.ts`, `database-admin-actions.ts`, `admin-delete-actions.ts`, `test-center-client.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1460 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03179761415055533 - nodes in this community are weakly interconnected._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.04224471941007374 - nodes in this community are weakly interconnected._
- **Should `lib/labels.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.032714412024756855 - nodes in this community are weakly interconnected._