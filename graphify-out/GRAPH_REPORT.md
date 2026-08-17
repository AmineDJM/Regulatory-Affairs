# Graph Report - src  (2026-08-17)

## Corpus Check
- 1178 files · ~897,658 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7234 nodes · 28351 edges · 230 communities (223 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 146 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3de33c75`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- userCan
- lib/session.ts
- getCurrentUser
- recordAudit
- utils.ts
- lib/labels.ts
- requireModule
- cn
- prisma
- button.tsx
- rules/engine.ts
- notifyUser
- jobs/runner.ts
- aiConfigured
- batch-runner.ts
- mail.ts
- payment-request-actions.ts
- getAppSettings
- build-facts.ts
- corpus/actions.ts
- formatDateTime
- requireUser
- entity-access.ts
- (app)/layout.tsx
- admin-request-actions.ts
- hr-document-actions.ts
- product-explorer.tsx
- pilotage/page.tsx
- assistant-actions.ts
- http.ts
- demandes/[id]/page.tsx
- regAudit
- ad-pro-item-actions.ts
- care-actions.ts
- risks.ts
- assistant.ts
- FindingInput
- regulatory-workflow.ts
- test-center/runner.ts
- new-request-picker.tsx
- events/[id]/page.tsx
- workflow/engine.ts
- agent-core.ts
- directory-grid.ts
- molecule.ts
- onlyoffice.ts
- config.ts
- upload/session.ts
- promo-material-actions.ts
- regulatory/page.tsx
- library-ingest.ts
- training-board.tsx
- upload-manager.tsx
- library-actions.ts
- scheduled.ts
- adventum-actions.ts
- market-research.ts
- lib/ai.ts
- workflow-builder.tsx
- lib/department-budget.ts
- drive/page.tsx
- [dossierId]/page.tsx
- adoption.ts
- platform-audit/engine.ts
- prisma.ts
- lib/messaging.ts
- toNumber
- sales-planning-actions.ts
- message-thread.tsx
- object-storage.ts
- petty-cash-actions.ts
- budget-forms.tsx
- information-medicale/[id]/page.tsx
- lib/drive.ts
- stock-board.tsx
- mistral-ocr.ts
- queries/messaging.ts
- drive-storage.ts
- dossier-actions.ts
- microsoft-mail-actions.ts
- releaseBlob
- medical-actions.ts
- messaging-actions.ts
- hasGlobalView
- payment-authority.ts
- ingest-catalog.ts
- smart-mail-actions.ts
- access-actions.ts
- brain-cockpit.tsx
- document-preview.tsx
- drive-table.tsx
- graph/provider.ts
- Select
- support-actions.ts
- department-budget-table.tsx
- state-machines/explorer.ts
- field-reports.ts
- test-center/types.ts
- congress.ts
- lifecycle/actions.ts
- run.ts
- market/engine.ts
- zip-inspector.ts
- migration-cert.ts
- export.ts
- calendar.ts
- supplier/actions.ts
- sheet-import.ts
- connection.ts
- competition.ts
- meeting-actions.ts
- departments.ts
- department-budget-actions.ts
- pch-tender-line-actions.ts
- progress/query.ts
- corpus/page.tsx
- enregistrement/page.tsx
- onboarding-wizard.tsx
- sidebar.tsx
- portfolio.ts
- budget.ts
- read-figures.ts
- s3-config.ts
- meetings.ts
- dashboard/page.tsx
- meetings/[id]/page.tsx
- validation-supervision.ts
- lib/ad-pro-edit.ts
- budget-envelope-actions.ts
- reply.ts
- org-chart-print.ts
- features.ts
- mail-client.tsx
- new-conversation.tsx
- client.ts
- invariants/registry.ts
- consulting-actions.ts
- workspace.tsx
- messenger.tsx
- congress-request-actions.ts
- queries/drive.ts
- vision-ocr.ts
- event-form.tsx
- office/page.tsx
- reports.ts
- expense-lines.ts
- tender-lines.tsx
- pch.ts
- MicrosoftGraphMailProvider
- ocr-engine.ts
- storage.ts
- consulting/[id]/page.tsx
- doc-request.ts
- events.ts
- today.ts
- validations.ts
- drive/[id]/page.tsx
- upload-button.tsx
- department-actions.ts
- auth-actions.ts
- MailProvider
- dashboard.ts
- budgets/export/route.ts
- pch/export/route.ts
- mistral-ocr.test.ts
- test-center/page.tsx
- simple-pdf.ts
- calendar-view.tsx
- hr-documents.ts
- getMarketData
- canViewDrive
- push.ts
- document-request-actions.ts
- file-glyph.tsx
- assistant-files.ts
- medical-directory.tsx
- expense-row-actions.tsx
- background-upload.tsx
- reminder-actions.ts
- imputation.ts
- radar.ts
- regulatory-drive-mirror.ts
- company-actions.ts
- market-presentation-actions.ts
- congress-workflow.tsx
- (app)/organigramme/page.tsx
- entrainement/page.tsx
- bd.ts
- grouping.ts
- meetings/page.tsx
- training-panel.tsx
- departments-manager.tsx
- stocks-view.tsx
- supplier-auth.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- drive-space-manager.tsx
- client-bundle-guard.test.ts
- multi-request.tsx
- delegate-plans.tsx
- push-register.tsx
- feature-actions.ts
- archive.ts
- events/[id]/export/route.ts
- [token]/route.ts
- courses-board.tsx
- bv-requests.tsx
- step-timeline.tsx
- employee-form.tsx
- payroll-matrix.tsx
- validation-item-review.tsx
- next-auth.d.ts
- row-grants.tsx
- attachment-validation.tsx
- directives/[id]/panel.tsx
- app/layout.tsx
- mission-stops.tsx
- reserves-panel.tsx
- validation-decision.tsx
- logout-button.tsx
- comment-thread.tsx
- (app)/courrier/page.tsx
- NewRequestButton
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 699 edges
2. `userCan()` - 542 edges
3. `fdStr()` - 514 edges
4. `recordAudit()` - 458 edges
5. `prisma` - 449 edges
6. `requireModule()` - 244 edges
7. `hasGlobalView()` - 211 edges
8. `Button` - 175 edges
9. `formatDate()` - 164 edges
10. `toNumber()` - 157 edges

## Surprising Connections (you probably didn't know these)
- `groupValidations()` --indirect_call--> `item()`  [INFERRED]
  src/lib/validations/grouping.ts → src/lib/queries/today.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (230 total, 7 thin omitted)

### Community 0 - "userCan"
Cohesion: 0.04
Nodes (138): POST(), FieldsManager(), ActiveToggle(), ImpersonateButton(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), EditTransactionSheet() (+130 more)

### Community 1 - "lib/session.ts"
Cohesion: 0.04
Nodes (101): dynamic, ActivityPage(), fmtDuration(), dynamic, metadata, dynamic, dynamic, metadata (+93 more)

### Community 2 - "getCurrentUser"
Cohesion: 0.04
Nodes (105): dynamic, GET(), DELETE(), dynamic, POST(), dynamic, GET(), INLINE_MIME (+97 more)

### Community 3 - "recordAudit"
Cohesion: 0.04
Nodes (114): dynamic, POST(), PermanentDeleteButton(), PurgeOrphansButton(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv() (+106 more)

### Community 4 - "utils.ts"
Cohesion: 0.04
Nodes (92): AdProOtherPage(), ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), dynamic, FocusCard() (+84 more)

### Community 5 - "lib/labels.ts"
Cohesion: 0.03
Nodes (98): FeedbackStatusSelect(), BDPipeline(), STAGES, BDRow, BDTable(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), MissionActions() (+90 more)

### Community 6 - "requireModule"
Cohesion: 0.04
Nodes (85): CustomFieldsPage(), AdminWorkflowsPage(), BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage() (+77 more)

### Community 7 - "cn"
Cohesion: 0.08
Nodes (70): dynamic, ModuleSpec, TYPES, AdminPage(), fmtBytes(), fmtWhen(), StoragePanel(), ACTION_COLS (+62 more)

### Community 8 - "prisma"
Cohesion: 0.04
Nodes (73): dynamic, GET(), Msg, DirectiveDetailPage(), StocksPage(), SnapshotDTO, SupportDetailPage(), assistantNudge() (+65 more)

### Community 9 - "button.tsx"
Cohesion: 0.07
Nodes (45): DriveStorageSettings(), OrgBranch(), Option, RuleDTO, ResearchMeta(), ProjectEditor(), ProjectStatusBadge(), ConnectMailbox() (+37 more)

### Community 10 - "rules/engine.ts"
Cohesion: 0.04
Nodes (75): KIND_LABEL, Pack, Rule, RulePacksAdmin(), pickMime(), CorpusExtract, queryFor(), SECTION_HINTS (+67 more)

### Community 11 - "notifyUser"
Cohesion: 0.06
Nodes (80): OtherDecisionPanel(), RevisionRequest(), TrainingBoard(), audit(), closeAdProOtherRequest(), createAdProOtherRequest(), decideAdProOtherRequest(), nextRef() (+72 more)

### Community 12 - "jobs/runner.ts"
Cohesion: 0.05
Nodes (78): dynamic, GET(), GET(), MIME_BY_EXT, mimeByName(), dynamic, GET(), getBlob() (+70 more)

### Community 13 - "aiConfigured"
Cohesion: 0.06
Nodes (76): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+68 more)

### Community 14 - "batch-runner.ts"
Cohesion: 0.04
Nodes (73): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+65 more)

### Community 15 - "mail.ts"
Cohesion: 0.05
Nodes (69): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+61 more)

### Community 16 - "payment-request-actions.ts"
Cohesion: 0.07
Nodes (67): NewPaymentButton(), AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner (+59 more)

### Community 17 - "getAppSettings"
Cohesion: 0.06
Nodes (59): POST(), dynamic, POST(), AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult (+51 more)

### Community 18 - "build-facts.ts"
Cohesion: 0.06
Nodes (57): TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded() (+49 more)

### Community 19 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (49): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CorpusImport(), Row (+41 more)

### Community 20 - "formatDateTime"
Cohesion: 0.04
Nodes (56): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, ActivityTable(), AdoptionTable(), badgeTone (+48 more)

### Community 21 - "requireUser"
Cohesion: 0.07
Nodes (60): CorbeillePage(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, BeneficiariesCard() (+52 more)

### Community 22 - "entity-access.ts"
Cohesion: 0.07
Nodes (51): GET(), GET, ASPECTS, GET, GET, GET, RESERVED, GET (+43 more)

### Community 23 - "(app)/layout.tsx"
Cohesion: 0.06
Nodes (47): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+39 more)

### Community 24 - "admin-request-actions.ts"
Cohesion: 0.06
Nodes (60): RuleControls(), RuleEditor(), AttachmentValidationBlock(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest() (+52 more)

### Community 25 - "hr-document-actions.ts"
Cohesion: 0.08
Nodes (56): EventForm(), CancelRequestButton(), REQ_TO_CAT, RequestRow(), MeetingControls(), createCalendarEvent(), deleteCalendarEvent(), parseKind() (+48 more)

### Community 26 - "product-explorer.tsx"
Cohesion: 0.05
Nodes (51): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+43 more)

### Community 27 - "pilotage/page.tsx"
Cohesion: 0.08
Nodes (48): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+40 more)

### Community 28 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (48): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+40 more)

### Community 29 - "http.ts"
Cohesion: 0.08
Nodes (43): blockOf(), GET, SCALARS, schema(), GET, GET(), ApiContext, authenticate() (+35 more)

### Community 30 - "demandes/[id]/page.tsx"
Cohesion: 0.06
Nodes (43): PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, RequestDetailPage(), DemandesPage(), dynamic, dynamic, MonDossierPage(), AdvanceItem (+35 more)

### Community 31 - "regAudit"
Cohesion: 0.07
Nodes (45): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict (+37 more)

### Community 32 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 33 - "care-actions.ts"
Cohesion: 0.12
Nodes (46): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+38 more)

### Community 34 - "risks.ts"
Cohesion: 0.07
Nodes (45): AdventumBrainPage(), BLOCK_CATS, dynamic, RiskThresholdsForm(), diff(), getPulse(), hourBucket(), LEVEL_RANK (+37 more)

### Community 35 - "assistant.ts"
Cohesion: 0.08
Nodes (47): MedicalDirectory(), ClaudeToolDef, activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue() (+39 more)

### Community 36 - "FindingInput"
Cohesion: 0.11
Nodes (38): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport, MetamorphicReport (+30 more)

### Community 37 - "regulatory-workflow.ts"
Cohesion: 0.08
Nodes (47): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryStepNote(), setRegulatoryStepState(), AvailableAction, availableActionsFor() (+39 more)

### Community 38 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (41): base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify(), Diff (+33 more)

### Community 39 - "new-request-picker.tsx"
Cohesion: 0.09
Nodes (41): AdProList(), EMPTY, Filters, NewRequestPicker(), NewRequestPickerProps, AdProPage(), dynamic, CreateEventForm() (+33 more)

### Community 40 - "events/[id]/page.tsx"
Cohesion: 0.07
Nodes (40): AdProOtherDetailPage(), Budget(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), dynamic, eventValidationSteps(), MyMissionsPage(), dynamic (+32 more)

### Community 41 - "workflow/engine.ts"
Cohesion: 0.09
Nodes (45): getManagerOfUser(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity(), loadOutcome(), WorkflowEventView, WorkflowOutcome (+37 more)

### Community 42 - "agent-core.ts"
Cohesion: 0.08
Nodes (33): AgentItem, AgentsPanel(), RunState, extractJson(), listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc (+25 more)

### Community 43 - "directory-grid.ts"
Cohesion: 0.09
Nodes (40): GET(), AddDoctorRow(), AnnuaireGrid(), GridTable(), SelectCell, TextCell, ALGERIA_WILAYAS, DOCTOR_TITLE (+32 more)

### Community 44 - "molecule.ts"
Cohesion: 0.11
Nodes (44): MarketProductsPage(), SuggestField(), analyzeMarketMolecule(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts() (+36 more)

### Community 45 - "onlyoffice.ts"
Cohesion: 0.10
Nodes (36): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf() (+28 more)

### Community 46 - "config.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, GET(), DisconnectButton(), dynamic, MessageriePage(), disconnectMicrosoftMail() (+28 more)

### Community 47 - "upload/session.ts"
Cohesion: 0.09
Nodes (38): dynamic, runtime, IngestResult, buildMessyDossierZip(), drainJobs(), makeDocx(), makePng(), makeXlsx() (+30 more)

### Community 48 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (36): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+28 more)

### Community 49 - "regulatory/page.tsx"
Cohesion: 0.08
Nodes (35): BusinessDevelopmentPipelinePage(), dynamic, MedicalInfoPage(), AnnuairePage(), RegulatoryPage(), AssignableUser, CATEGORY_OPTS, Col (+27 more)

### Community 50 - "library-ingest.ts"
Cohesion: 0.08
Nodes (34): canOcr(), ocrDocument(), rasterizePdf(), asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode() (+26 more)

### Community 51 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 52 - "upload-manager.tsx"
Cohesion: 0.08
Nodes (33): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+25 more)

### Community 53 - "library-actions.ts"
Cohesion: 0.09
Nodes (37): ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+29 more)

### Community 54 - "scheduled.ts"
Cohesion: 0.09
Nodes (36): lunaEmbed(), lunaEmbedModel(), citationsByIds(), CorpusFilters, Row, searchCorpus(), searchCorpusLexical(), activeStamp() (+28 more)

### Community 55 - "adventum-actions.ts"
Cohesion: 0.09
Nodes (36): dynamic, POST(), dynamic, POST(), dynamic, GET(), BrainCockpit(), askBrain() (+28 more)

### Community 56 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 57 - "lib/ai.ts"
Cohesion: 0.08
Nodes (32): runAiHealthCheckNow(), AiHealthCheckButton(), ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), deleteFieldReport(), deleteFieldReportAttachment() (+24 more)

### Community 58 - "workflow-builder.tsx"
Cohesion: 0.09
Nodes (34): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), EventFundingPanel(), PmOpt, Props, SubmitButton() (+26 more)

### Community 59 - "lib/department-budget.ts"
Cohesion: 0.13
Nodes (34): DepartmentBudgetsPage(), dynamic, BudgetSetter, canDecideDepartmentBudgetRequest(), canEditAnyKind(), canEditDepartmentBudget(), canManageDepartmentBudgetAccess(), canRequestDepartmentBudget() (+26 more)

### Community 60 - "drive/page.tsx"
Cohesion: 0.12
Nodes (32): DriveCanvas(), ITEMS, NewKind, DriveRow, DriveToolbar(), SettingsIcon, DriveSpacePage(), dynamic (+24 more)

### Community 61 - "[dossierId]/page.tsx"
Cohesion: 0.09
Nodes (37): DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT, ReserveMap, securityIcon() (+29 more)

### Community 62 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 63 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (34): generatePlatformIdeas(), sttConfigured(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding (+26 more)

### Community 64 - "prisma.ts"
Cohesion: 0.09
Nodes (23): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+15 more)

### Community 65 - "lib/messaging.ts"
Cohesion: 0.08
Nodes (29): dynamic, GET(), dynamic, GET(), dynamic, NO_CONTENT, POST(), dynamic (+21 more)

### Community 66 - "toNumber"
Cohesion: 0.18
Nodes (29): CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), PaiePage(), AppealPanel(), SPONSORING_DOC_CATEGORIES, SponsoringDetailPage(), ThirdPartyButton() (+21 more)

### Community 67 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 68 - "message-thread.tsx"
Cohesion: 0.11
Nodes (30): MessageAttachments(), Attachments(), MessageAttachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment (+22 more)

### Community 69 - "object-storage.ts"
Cohesion: 0.14
Nodes (35): RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config(), createMultipartUpload(), _deriveSigningKeyHex(), EMPTY_SHA256 (+27 more)

### Community 70 - "petty-cash-actions.ts"
Cohesion: 0.14
Nodes (29): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+21 more)

### Community 71 - "budget-forms.tsx"
Cohesion: 0.13
Nodes (32): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+24 more)

### Community 72 - "information-medicale/[id]/page.tsx"
Cohesion: 0.16
Nodes (28): DeclarationDetailPage(), dynamic, AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm() (+20 more)

### Community 73 - "lib/drive.ts"
Cohesion: 0.13
Nodes (20): mimeOf(), POST(), POST(), canCreateInSpace(), effectiveSpaceId(), GB, makeTtlCache(), quotaVerdict (+12 more)

### Community 74 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 75 - "mistral-ocr.ts"
Cohesion: 0.12
Nodes (27): backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt(), defaultMaxPages(), lowConfidenceThreshold(), maxAttempts() (+19 more)

### Community 76 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (27): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, MessagesPage() (+19 more)

### Community 77 - "drive-storage.ts"
Cohesion: 0.14
Nodes (27): dynamic, GET(), runtime, DatabasesPage(), blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptFileStream() (+19 more)

### Community 78 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (28): LinkToDossier(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite (+20 more)

### Community 79 - "microsoft-mail-actions.ts"
Cohesion: 0.13
Nodes (27): AttachmentBar(), Composer(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm(), fail() (+19 more)

### Community 80 - "releaseBlob"
Cohesion: 0.12
Nodes (27): releaseBlob(), archiveQueue, attachArchive(), clampInt(), enqueueArchive(), flushOriginalArchives(), ingestCore(), ingestDossierZip() (+19 more)

### Community 81 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), DeleteVisitButton(), createDoctor(), createInstitution() (+22 more)

### Community 82 - "messaging-actions.ts"
Cohesion: 0.16
Nodes (29): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), DENIED (+21 more)

### Community 83 - "hasGlobalView"
Cohesion: 0.12
Nodes (26): CourseDTO, CoursesPage(), DriverPage(), DossierDetailPage(), FormationsPage(), AdProKind, closeSource(), Common (+18 more)

### Community 84 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 85 - "ingest-catalog.ts"
Cohesion: 0.14
Nodes (25): ANPP_WATCH_PAGES, CATALOG, CatalogSource, findSource(), FIRST_WAVE, SourceAuthority, extOf(), FetchedSource (+17 more)

### Community 86 - "smart-mail-actions.ts"
Cohesion: 0.15
Nodes (23): dynamic, POST(), runtime, MailTester(), sendMail(), SendResult, smartMailStatus, buildProviderCall() (+15 more)

### Community 87 - "access-actions.ts"
Cohesion: 0.15
Nodes (25): ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), RevokeAllButton(), adminResetPassword(), requestOnboarding() (+17 more)

### Community 88 - "brain-cockpit.tsx"
Cohesion: 0.09
Nodes (22): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+14 more)

### Community 89 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 90 - "drive-table.tsx"
Cohesion: 0.16
Nodes (22): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, canPasteInto(), Clipboard, CLIPBOARD_KEY (+14 more)

### Community 91 - "graph/provider.ts"
Cohesion: 0.19
Nodes (20): wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw, skipToken(), toAddress(), toAddressList() (+12 more)

### Community 92 - "Select"
Cohesion: 0.09
Nodes (19): OrphansPanel(), RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ShareItem, SharePanel(), AccessSheet() (+11 more)

### Community 93 - "support-actions.ts"
Cohesion: 0.15
Nodes (22): SupportActions(), SupportMessageForm(), useAction(), addDirectoryDoctor(), importDirectorySheet(), saveDirectoryCell(), segToPriority, answerSupportRequest() (+14 more)

### Community 94 - "department-budget-table.tsx"
Cohesion: 0.11
Nodes (23): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), Consumption(), DepartmentBudgetTable(), ExpenseForm(), RequestForm() (+15 more)

### Community 95 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 96 - "field-reports.ts"
Cohesion: 0.10
Nodes (19): dynamic, GET(), dynamic, POST(), dynamic, POST(), HBars(), PALETTE (+11 more)

### Community 97 - "test-center/types.ts"
Cohesion: 0.15
Nodes (17): ENV_LABEL, LaunchPanel(), MODES, ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter() (+9 more)

### Community 98 - "congress.ts"
Cohesion: 0.15
Nodes (21): CongressInternationalPage(), CongressNationalPage(), SponsoringPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail() (+13 more)

### Community 99 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 100 - "run.ts"
Cohesion: 0.14
Nodes (17): Sim, SimulatorPanel(), VERDICT, extractLooseJson(), repairAndParse(), runSimulationAction(), AiFn, dossierSummary() (+9 more)

### Community 101 - "market/engine.ts"
Cohesion: 0.12
Nodes (22): Cache, DIR, DZD_PER_USD, IqviaRow, LabRow, MarketMeta, PchRow, SRC_IQVIA (+14 more)

### Community 102 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 103 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 104 - "export.ts"
Cohesion: 0.17
Nodes (17): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), regulatoryExportFilename() (+9 more)

### Community 105 - "calendar.ts"
Cohesion: 0.19
Nodes (21): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+13 more)

### Community 106 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 107 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 108 - "connection.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 109 - "competition.ts"
Cohesion: 0.16
Nodes (22): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+14 more)

### Community 110 - "meeting-actions.ts"
Cohesion: 0.18
Nodes (20): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), addMeetingParticipants(), deleteMeeting(), deleteMeetingMessage(), DENIED (+12 more)

### Community 111 - "departments.ts"
Cohesion: 0.15
Nodes (19): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+11 more)

### Community 112 - "department-budget-actions.ts"
Cohesion: 0.25
Nodes (20): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget(), setDepartmentBudget() (+12 more)

### Community 113 - "pch-tender-line-actions.ts"
Cohesion: 0.21
Nodes (20): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+12 more)

### Community 114 - "progress/query.ts"
Cohesion: 0.16
Nodes (17): AnalysisProgressCard(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta(), pctFrac(), PHASE_LABELS (+9 more)

### Community 115 - "corpus/page.tsx"
Cohesion: 0.15
Nodes (18): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+10 more)

### Community 116 - "enregistrement/page.tsx"
Cohesion: 0.16
Nodes (20): dynamic, metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS, DECISION_RULES, FEE_SPECIAL_CASES (+12 more)

### Community 117 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 118 - "sidebar.tsx"
Cohesion: 0.17
Nodes (16): badgeFor(), FLAT_GROUPS, Sidebar(), SidebarProps, TopbarProps, NavItem, aliasMatches(), groupIntoPoles() (+8 more)

### Community 119 - "portfolio.ts"
Cohesion: 0.16
Nodes (17): ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts(), teamMemberIds() (+9 more)

### Community 120 - "budget.ts"
Cohesion: 0.13
Nodes (17): BudgetEnvelopeOption, BudgetHealth, BudgetMonthPoint, buildMonthlySeries(), EnvelopeSummaryItem, envelopeVisible(), EMPTY, GeneralMeansAttribution (+9 more)

### Community 121 - "read-figures.ts"
Cohesion: 0.14
Nodes (20): BINDING, INGESTIBLE, sourcesForModule(), buildFigureCall(), DEFECT_KINDS, FIGURE_KINDS, FIGURE_SCHEMA, FigureKind (+12 more)

### Community 122 - "s3-config.ts"
Cohesion: 0.17
Nodes (19): ConfigDescription, ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar() (+11 more)

### Community 123 - "meetings.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET(), dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 124 - "dashboard/page.tsx"
Cohesion: 0.13
Nodes (16): BudgetRow, BudgetsTable(), MONTHS, STATUS_COLORS, DonutChart(), DonutSlice, MiniBarChart(), Point (+8 more)

### Community 125 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (17): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+9 more)

### Community 126 - "validation-supervision.ts"
Cohesion: 0.18
Nodes (18): SupervisionBoard(), SupervisedValidationItem, daysLeft(), daysSince(), filterSupervised(), sortByUrgency(), STALLED_DAYS, SupervisedRow (+10 more)

### Community 127 - "lib/ad-pro-edit.ts"
Cohesion: 0.17
Nodes (16): AdProEditButton(), isKind(), TARGETS, updateAdProRequest(), AdProEditor, AdProEditTarget, AdProKind, DECIDED_STATUS (+8 more)

### Community 128 - "budget-envelope-actions.ts"
Cohesion: 0.23
Nodes (18): addBudgetExpense(), createEnvelope(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageEnvelope(), NOT_ALLOWED, readAccessRoles(), readAccessUserIds() (+10 more)

### Community 129 - "reply.ts"
Cohesion: 0.19
Nodes (17): buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock(), replySubject() (+9 more)

### Community 130 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (14): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+6 more)

### Community 131 - "features.ts"
Cohesion: 0.19
Nodes (15): VersionsPage(), AssistantPage(), dynamic, dynamic, RootPage(), MorningBrief(), refreshMyBrief(), CATALOG (+7 more)

### Community 132 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 133 - "new-conversation.tsx"
Cohesion: 0.15
Nodes (16): Props, Props, fd(), MemberMultiSelect(), Mode, NewConversation(), Props, SearchBox() (+8 more)

### Community 134 - "client.ts"
Cohesion: 0.18
Nodes (15): buildUrl(), DELTA_EXPIRED, graphBinary(), graphRaw(), GraphRequest, HUMAN, kindOf(), toError() (+7 more)

### Community 135 - "invariants/registry.ts"
Cohesion: 0.15
Nodes (12): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+4 more)

### Community 136 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 137 - "workspace.tsx"
Cohesion: 0.30
Nodes (15): DocumentWorkspace(), Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W, moveBy() (+7 more)

### Community 138 - "messenger.tsx"
Cohesion: 0.18
Nodes (16): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), bumpConversation(), Messenger() (+8 more)

### Community 139 - "congress-request-actions.ts"
Cohesion: 0.39
Nodes (18): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+10 more)

### Community 140 - "queries/drive.ts"
Cohesion: 0.19
Nodes (16): DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow, DriveSpaceTab, driveVisibilityWhere(), getDriveListing(), getDriveSpacesForUser() (+8 more)

### Community 141 - "vision-ocr.ts"
Cohesion: 0.20
Nodes (16): OcrPage, OcrResult, AI_RESCUE_CONFIDENCE, aiRescueEnabled(), aiRescueMaxPages(), applyAiRescue(), buildTranscriptionCall(), mergeRescuedPages() (+8 more)

### Community 142 - "event-form.tsx"
Cohesion: 0.16
Nodes (12): CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES, UserOpt, CreateEventButton() (+4 more)

### Community 143 - "office/page.tsx"
Cohesion: 0.32
Nodes (13): OfficeLauncher(), dynamic, OfficePage(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp (+5 more)

### Community 144 - "reports.ts"
Cohesion: 0.20
Nodes (14): buildSimpleDocx(), esc(), MISSING_MARKER, paragraph(), SimplePara, buildFindingsReport(), buildReserveResponseLetter(), GenerateResult (+6 more)

### Community 145 - "expense-lines.ts"
Cohesion: 0.32
Nodes (14): empty(), ReceiptLines(), readReceipt(), ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField(), parseQuantity() (+6 more)

### Community 146 - "tender-lines.tsx"
Cohesion: 0.19
Nodes (15): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+7 more)

### Community 147 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 148 - "MicrosoftGraphMailProvider"
Cohesion: 0.21
Nodes (5): graphJson(), draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 149 - "ocr-engine.ts"
Cohesion: 0.21
Nodes (15): defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, createOcrWorker(), IMAGE_EXTS (+7 more)

### Community 150 - "storage.ts"
Cohesion: 0.23
Nodes (11): GET(), ALLOWED_EXTENSIONS, BLOCKED_DRIVE_EXTENSIONS, readFileByKey(), UPLOAD_DIR, validateDocumentUpload(), validateDriveUpload(), EXECUTABLE (+3 more)

### Community 151 - "consulting/[id]/page.tsx"
Cohesion: 0.25
Nodes (12): ConsultingContractPage(), dynamic, billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue() (+4 more)

### Community 152 - "doc-request.ts"
Cohesion: 0.25
Nodes (13): DocumentRequestPage(), PiecesPage(), canCancel(), canDecide(), canSubmit(), DocRequestActor, DocRequestMove, DocRequestState (+5 more)

### Community 153 - "events.ts"
Cohesion: 0.15
Nodes (14): dynamic, InscriptionPage(), PublicRegistrationForm(), EVENT_FORMAT, EVENT_TYPE, ACTIVE, buildStats(), EventDetail (+6 more)

### Community 154 - "today.ts"
Cohesion: 0.18
Nodes (13): CalendarEventDTO, getActionCenter(), resolve(), getToday(), greetingFor(), rankToday(), reasonOf(), REASONS (+5 more)

### Community 155 - "validations.ts"
Cohesion: 0.17
Nodes (12): CONG_STAGE, CrossValidationItem, getCrossModuleValidations(), getMyValidationRequests(), getMyValidations(), getPendingValidations(), getSupervisedValidations(), MyValidationItem (+4 more)

### Community 156 - "drive/[id]/page.tsx"
Cohesion: 0.23
Nodes (11): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), DriveMultiViewPage(), dynamic, OpenDoc, fileKind() (+3 more)

### Community 157 - "upload-button.tsx"
Cohesion: 0.23
Nodes (12): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, useBackgroundUpload(), FINGERPRINT_MAX_BYTES (+4 more)

### Community 158 - "department-actions.ts"
Cohesion: 0.30
Nodes (14): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+6 more)

### Community 159 - "auth-actions.ts"
Cohesion: 0.19
Nodes (7): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, authenticate(), changePassword()

### Community 161 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 162 - "budgets/export/route.ts"
Cohesion: 0.25
Nodes (10): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView (+2 more)

### Community 163 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 164 - "mistral-ocr.test.ts"
Cohesion: 0.19
Nodes (9): dynamic, GET(), runtime, mistralOcrConfigured(), mistralOcrSelfTest(), ENV_KEYS, ONE_PAGE, SAMPLE (+1 more)

### Community 165 - "test-center/page.tsx"
Cohesion: 0.18
Nodes (12): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+4 more)

### Community 166 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 167 - "calendar-view.tsx"
Cohesion: 0.21
Nodes (11): CalendarView(), colorOf(), EventDetail(), MONTH_LABELS, SheetMode, WEEKDAYS, INVITE_STATUSES, respondToInvite() (+3 more)

### Community 168 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 169 - "getMarketData"
Cohesion: 0.27
Nodes (12): getMarketData(), loadNdjson(), buildCompetition(), getPriceForDci(), HospitalRow, matchIqvia(), matchPch(), PriceForDci (+4 more)

### Community 170 - "canViewDrive"
Cohesion: 0.32
Nodes (9): GET(), GET(), canViewDrive(), buildDriveZip(), Collected, collectFolder(), safeName(), ZipError (+1 more)

### Community 171 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 172 - "document-request-actions.ts"
Cohesion: 0.36
Nodes (10): RespondPanel(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest(), nextRef(), requestDocument() (+2 more)

### Community 173 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 174 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 175 - "medical-directory.tsx"
Cohesion: 0.24
Nodes (9): Props, Result, SECTOR_ICON, SECTOR_ORDER, INSTITUTION_SECTOR, INSTITUTION_TYPE, InstitutionDTO, SpecialtyDTO (+1 more)

### Community 176 - "expense-row-actions.tsx"
Cohesion: 0.42
Nodes (6): BudgetTargetField(), EditableExpense, CatalogArticle, ExistingLine, Row, BudgetTarget

### Community 177 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 178 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 179 - "imputation.ts"
Cohesion: 0.36
Nodes (8): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal()

### Community 180 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 181 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 182 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 183 - "market-presentation-actions.ts"
Cohesion: 0.31
Nodes (8): PresentationCard(), PresentationPanel(), Res, deletePresentation(), generatePresentation(), MODULE, regeneratePresentation(), renamePresentation()

### Community 184 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 185 - "(app)/organigramme/page.tsx"
Cohesion: 0.33
Nodes (6): dynamic, metadata, OrganigrammePage(), canEditOrgChart(), canViewOrgChart(), OrgChartAccessSettings

### Community 186 - "entrainement/page.tsx"
Cohesion: 0.22
Nodes (8): CorpusPage(), dynamic, metadata, TrainingPage(), TrainingPanel(), dzd(), EnregistrementPage(), canSeeRegEnrollment()

### Community 187 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 188 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 189 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 190 - "training-panel.tsx"
Cohesion: 0.31
Nodes (6): CaseDocRow, CaseRow, UpRow, OUTCOME_LABELS, OUTCOME_ORDER, OUTCOME_TONES

### Community 191 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 192 - "stocks-view.tsx"
Cohesion: 0.22
Nodes (8): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, TabKey, TABS, todayInput(), UserOpt

### Community 193 - "supplier-auth.ts"
Cohesion: 0.36
Nodes (8): SupplierLoginPage(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign(), signingKey(), SupplierSession, verifyToken()

### Community 194 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 195 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 196 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 197 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 198 - "multi-request.tsx"
Cohesion: 0.33
Nodes (6): Article, Cell, emptyCell(), MultiRequestButton(), Option, REQUEST_TYPES

### Community 199 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 200 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 201 - "feature-actions.ts"
Cohesion: 0.38
Nodes (6): requireAdmin(), setFeatureStage(), Stage, STAGE_LABEL, STAGES, toggleMyTestMode()

### Community 202 - "archive.ts"
Cohesion: 0.43
Nodes (5): addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder()

### Community 203 - "events/[id]/export/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, esc(), GET(), PARTICIPANT_ROLE, REGISTRATION_STATUS

### Community 204 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 205 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 206 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 207 - "step-timeline.tsx"
Cohesion: 0.33
Nodes (5): STATUS_ICON, STATUS_RING, StepItem, REGULATORY_STEP_TYPE, STEP_STATUS

### Community 208 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 209 - "payroll-matrix.tsx"
Cohesion: 0.40
Nodes (5): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym()

### Community 210 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 211 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 212 - "row-grants.tsx"
Cohesion: 0.50
Nodes (4): GrantOption, RowGrants(), RowGrantsProps, setRowGrants()

### Community 213 - "attachment-validation.tsx"
Cohesion: 0.40
Nodes (4): PAYABLE_CATEGORIES, STATUS_BADGES, StepView, ValidationView

### Community 214 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 215 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 216 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 217 - "reserves-panel.tsx"
Cohesion: 0.50
Nodes (3): Cycle, Point, RESERVE_TYPES

### Community 218 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

### Community 219 - "logout-button.tsx"
Cohesion: 0.67
Nodes (3): SupplierLogoutButton(), supplierLogout(), clearSupplierSession()

### Community 222 - "NewRequestButton"
Cohesion: 0.67
Nodes (3): currentYm(), LEAVE_TYPES, NewRequestButton()

## Knowledge Gaps
- **1401 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1396 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma` to `userCan`, `lib/session.ts`, `getCurrentUser`, `recordAudit`, `utils.ts`, `lib/labels.ts`, `requireModule`, `cn`, `rules/engine.ts`, `notifyUser`, `jobs/runner.ts`, `aiConfigured`, `batch-runner.ts`, `mail.ts`, `payment-request-actions.ts`, `getAppSettings`, `build-facts.ts`, `corpus/actions.ts`, `formatDateTime`, `requireUser`, `entity-access.ts`, `(app)/layout.tsx`, `admin-request-actions.ts`, `hr-document-actions.ts`, `product-explorer.tsx`, `pilotage/page.tsx`, `assistant-actions.ts`, `http.ts`, `demandes/[id]/page.tsx`, `regAudit`, `ad-pro-item-actions.ts`, `care-actions.ts`, `risks.ts`, `assistant.ts`, `regulatory-workflow.ts`, `test-center/runner.ts`, `new-request-picker.tsx`, `events/[id]/page.tsx`, `workflow/engine.ts`, `agent-core.ts`, `directory-grid.ts`, `onlyoffice.ts`, `upload/session.ts`, `promo-material-actions.ts`, `regulatory/page.tsx`, `library-ingest.ts`, `upload-manager.tsx`, `library-actions.ts`, `scheduled.ts`, `adventum-actions.ts`, `market-research.ts`, `lib/ai.ts`, `workflow-builder.tsx`, `lib/department-budget.ts`, `drive/page.tsx`, `[dossierId]/page.tsx`, `adoption.ts`, `platform-audit/engine.ts`, `prisma.ts`, `lib/messaging.ts`, `toNumber`, `sales-planning-actions.ts`, `petty-cash-actions.ts`, `information-medicale/[id]/page.tsx`, `lib/drive.ts`, `stock-board.tsx`, `queries/messaging.ts`, `drive-storage.ts`, `dossier-actions.ts`, `microsoft-mail-actions.ts`, `releaseBlob`, `medical-actions.ts`, `messaging-actions.ts`, `hasGlobalView`, `ingest-catalog.ts`, `smart-mail-actions.ts`, `access-actions.ts`, `brain-cockpit.tsx`, `Select`, `support-actions.ts`, `state-machines/explorer.ts`, `field-reports.ts`, `test-center/types.ts`, `congress.ts`, `lifecycle/actions.ts`, `run.ts`, `migration-cert.ts`, `export.ts`, `calendar.ts`, `supplier/actions.ts`, `connection.ts`, `meeting-actions.ts`, `departments.ts`, `department-budget-actions.ts`, `pch-tender-line-actions.ts`, `progress/query.ts`, `corpus/page.tsx`, `onboarding-wizard.tsx`, `portfolio.ts`, `budget.ts`, `meetings.ts`, `meetings/[id]/page.tsx`, `lib/ad-pro-edit.ts`, `budget-envelope-actions.ts`, `features.ts`, `invariants/registry.ts`, `consulting-actions.ts`, `congress-request-actions.ts`, `queries/drive.ts`, `office/page.tsx`, `reports.ts`, `expense-lines.ts`, `pch.ts`, `storage.ts`, `consulting/[id]/page.tsx`, `events.ts`, `validations.ts`, `drive/[id]/page.tsx`, `department-actions.ts`, `auth-actions.ts`, `dashboard.ts`, `pch/export/route.ts`, `hr-documents.ts`, `canViewDrive`, `push.ts`, `document-request-actions.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `company-actions.ts`, `market-presentation-actions.ts`, `(app)/organigramme/page.tsx`, `entrainement/page.tsx`, `bd.ts`, `meetings/page.tsx`, `supplier-auth.ts`, `feature-actions.ts`, `archive.ts`, `events/[id]/export/route.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `userCan`, `lib/session.ts`, `getCurrentUser`, `recordAudit`, `requireModule`, `cn`, `prisma`, `rules/engine.ts`, `notifyUser`, `aiConfigured`, `payment-request-actions.ts`, `getAppSettings`, `corpus/actions.ts`, `formatDateTime`, `entity-access.ts`, `(app)/layout.tsx`, `admin-request-actions.ts`, `hr-document-actions.ts`, `assistant-actions.ts`, `demandes/[id]/page.tsx`, `regAudit`, `ad-pro-item-actions.ts`, `care-actions.ts`, `regulatory-workflow.ts`, `events/[id]/page.tsx`, `agent-core.ts`, `molecule.ts`, `onlyoffice.ts`, `config.ts`, `promo-material-actions.ts`, `library-actions.ts`, `adventum-actions.ts`, `lib/ai.ts`, `workflow-builder.tsx`, `lib/department-budget.ts`, `platform-audit/engine.ts`, `lib/messaging.ts`, `toNumber`, `sales-planning-actions.ts`, `petty-cash-actions.ts`, `budget-forms.tsx`, `information-medicale/[id]/page.tsx`, `stock-board.tsx`, `drive-storage.ts`, `dossier-actions.ts`, `microsoft-mail-actions.ts`, `medical-actions.ts`, `messaging-actions.ts`, `hasGlobalView`, `smart-mail-actions.ts`, `access-actions.ts`, `brain-cockpit.tsx`, `support-actions.ts`, `department-budget-table.tsx`, `test-center/types.ts`, `lifecycle/actions.ts`, `run.ts`, `supplier/actions.ts`, `meeting-actions.ts`, `department-budget-actions.ts`, `pch-tender-line-actions.ts`, `corpus/page.tsx`, `onboarding-wizard.tsx`, `lib/ad-pro-edit.ts`, `budget-envelope-actions.ts`, `features.ts`, `new-conversation.tsx`, `consulting-actions.ts`, `messenger.tsx`, `congress-request-actions.ts`, `tender-lines.tsx`, `doc-request.ts`, `department-actions.ts`, `auth-actions.ts`, `calendar-view.tsx`, `document-request-actions.ts`, `reminder-actions.ts`, `company-actions.ts`, `market-presentation-actions.ts`, `(app)/organigramme/page.tsx`, `feature-actions.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `recordAudit`, `utils.ts`, `lib/labels.ts`, `requireModule`, `cn`, `prisma`, `notifyUser`, `jobs/runner.ts`, `mail.ts`, `payment-request-actions.ts`, `getAppSettings`, `formatDateTime`, `requireUser`, `entity-access.ts`, `(app)/layout.tsx`, `admin-request-actions.ts`, `hr-document-actions.ts`, `product-explorer.tsx`, `pilotage/page.tsx`, `assistant-actions.ts`, `http.ts`, `demandes/[id]/page.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `risks.ts`, `assistant.ts`, `regulatory-workflow.ts`, `new-request-picker.tsx`, `events/[id]/page.tsx`, `directory-grid.ts`, `molecule.ts`, `promo-material-actions.ts`, `regulatory/page.tsx`, `adventum-actions.ts`, `market-research.ts`, `lib/ai.ts`, `lib/department-budget.ts`, `drive/page.tsx`, `adoption.ts`, `lib/messaging.ts`, `toNumber`, `sales-planning-actions.ts`, `petty-cash-actions.ts`, `budget-forms.tsx`, `information-medicale/[id]/page.tsx`, `lib/drive.ts`, `stock-board.tsx`, `queries/messaging.ts`, `dossier-actions.ts`, `medical-actions.ts`, `messaging-actions.ts`, `hasGlobalView`, `access-actions.ts`, `support-actions.ts`, `department-budget-table.tsx`, `field-reports.ts`, `congress.ts`, `export.ts`, `calendar.ts`, `meeting-actions.ts`, `departments.ts`, `department-budget-actions.ts`, `pch-tender-line-actions.ts`, `dashboard/page.tsx`, `lib/ad-pro-edit.ts`, `budget-envelope-actions.ts`, `new-conversation.tsx`, `consulting-actions.ts`, `congress-request-actions.ts`, `queries/drive.ts`, `tender-lines.tsx`, `consulting/[id]/page.tsx`, `doc-request.ts`, `today.ts`, `validations.ts`, `drive/[id]/page.tsx`, `department-actions.ts`, `dashboard.ts`, `budgets/export/route.ts`, `pch/export/route.ts`, `test-center/page.tsx`, `reminder-actions.ts`, `company-actions.ts`, `market-presentation-actions.ts`, `(app)/organigramme/page.tsx`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1401 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.03994158451989777 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03781055900621118 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.03649237472766884 - nodes in this community are weakly interconnected._