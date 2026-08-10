# Graph Report - src  (2026-08-10)

## Corpus Check
- 968 files · ~704,749 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5934 nodes · 23162 edges · 198 communities (192 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9fa98ea8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/session.ts
- toNumber
- utils.ts
- formatDate
- userCan
- cn
- batch-runner.ts
- prisma.ts
- lib/labels.ts
- fdStr
- requireModule
- rules/engine.ts
- notifyRoles
- getCompanyScope
- upload/session.ts
- Button
- corpus-actions.ts
- canAccessEntity
- getCurrentUser
- jobs/runner.ts
- anpp-process.tsx
- test-center/runner.ts
- recordAudit
- requireUser
- drive-storage.ts
- mail.ts
- budget-forms.tsx
- care-actions.ts
- workflow/engine.ts
- FindingInput
- access-actions.ts
- department-budget-actions.ts
- [dossierId]/page.tsx
- regAudit
- ocr-engine.ts
- agent-core.ts
- molecule.ts
- promo-material-actions.ts
- mistral-ocr.ts
- invariants/registry.ts
- (app)/layout.tsx
- assistant.ts
- aiConfigured
- adoption.ts
- congress-national/[id]/page.tsx
- library-actions.ts
- getAppSettings
- market-research.ts
- ad-pro-item-actions.ts
- regCan
- validation-actions.ts
- product-explorer.tsx
- sales-planning-actions.ts
- platform-audit/engine.ts
- hasGlobalView
- hr-document-actions.ts
- queries/messaging.ts
- lib/ai.ts
- SessionUser
- pilotage/page.tsx
- pch-tender-line-actions.ts
- dossier-actions.ts
- medical-actions.ts
- query.ts
- workflow-builder.tsx
- bd-strategic-table.tsx
- competition.ts
- onlyoffice.ts
- message-thread.tsx
- assistant-actions.ts
- storage.ts
- molecule-panel.tsx
- congress-request-actions.ts
- upload-manager.tsx
- stream/route.ts
- Select
- smart-mail-actions.ts
- dossiers/[id]/panel.tsx
- scheduled.ts
- getBlob
- reports.ts
- sectionByCode
- company.ts
- users/[id]/page.tsx
- calendar.ts
- button.tsx
- lifecycle/actions.ts
- extract-text.ts
- zip-inspector.ts
- migration-cert.ts
- resolveDriveAccess
- rbac.test.ts
- adventum-brain/page.tsx
- assistant-chat.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- edit-product.tsx
- meetings.ts
- sponsoring-actions.ts
- portfolio.ts
- getMarketData
- rag.ts
- regulatory-ia/page.tsx
- admin-settings-forms.tsx
- event-form.tsx
- onboarding-wizard.tsx
- budget-envelope-actions.ts
- risks.ts
- extract-facts.ts
- brain-cockpit.tsx
- congress.ts
- messaging-actions.ts
- dossier-thread.ts
- build-facts.ts
- mail-client.tsx
- drive/page.tsx
- admin-delete-actions.ts
- document-preview.tsx
- support-actions.ts
- auth-actions.ts
- messenger.tsx
- info-panel.tsx
- equipes/page.tsx
- run.ts
- getMailAccount
- tender-lines.tsx
- pch.ts
- supplier-portal-actions.ts
- departments.ts
- office-templates.ts
- driver/page.tsx
- drive/[id]/page.tsx
- events/[id]/page.tsx
- process-intelligence.ts
- dossier-knowledge.ts
- today.ts
- drive-actions.ts
- event-actions.ts
- lib/messaging.ts
- dashboard.ts
- compare-versions.ts
- test-center/types.ts
- medical-directory.tsx
- training-panel.tsx
- department-actions.ts
- decompose.ts
- ai-facts.ts
- regulatory-drive-mirror.ts
- pch/export/route.ts
- new-request.tsx
- stock-snapshot-actions.ts
- sidebar.tsx
- hr-documents.ts
- simple-pdf.ts
- push.ts
- feature-actions.ts
- assistant-files.ts
- adventum-actions.ts
- supplies-manager.tsx
- background-upload.tsx
- reminder-actions.ts
- radar.ts
- company-actions.ts
- meetings/page.tsx
- validation-item-review.tsx
- regulatory-requests.ts
- departments-manager.tsx
- training/for-section.ts
- Adventum Autonomous Test Center — architecture
- org-chart-editor.tsx
- calendar-view.tsx
- drive-space-manager.tsx
- zip-viewer.tsx
- upload-button.tsx
- client-bundle-guard.test.ts
- congress-request-form.tsx
- delegate-plans.tsx
- assignment-matrix.tsx
- forecast-grid.tsx
- reserves/page.tsx
- pulse-strip.tsx
- push-register.tsx
- courses-board.tsx
- bv-requests.tsx
- employee-form.tsx
- messages-indicator.tsx
- next-auth.d.ts
- request-controls.tsx
- custom-fields-card.tsx
- mission-stops.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 610 edges
2. `userCan()` - 460 edges
3. `fdStr()` - 450 edges
4. `prisma` - 396 edges
5. `recordAudit()` - 394 edges
6. `requireModule()` - 220 edges
7. `hasGlobalView()` - 160 edges
8. `Button` - 159 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `form()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/budget-expense.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/reset-password.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts

## Import Cycles
- None detected.

## Communities (198 total, 6 thin omitted)

### Community 0 - "lib/session.ts"
Cohesion: 0.06
Nodes (81): ActivityPage(), fmtDuration(), MailTester(), CourrierAdminPage(), dynamic, metadata, dynamic, metadata (+73 more)

### Community 1 - "toNumber"
Cohesion: 0.04
Nodes (88): CorbeillePage(), dynamic, TrashItem, TrashList(), FieldDefDTO, CustomFieldsPage(), BD_DOC_CATEGORIES, BdProjectDetailPage() (+80 more)

### Community 2 - "utils.ts"
Cohesion: 0.08
Nodes (61): dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic, Mode, MODES, dynamic (+53 more)

### Community 3 - "formatDate"
Cohesion: 0.04
Nodes (87): dynamic, FocusCard(), CategoryCard(), BudgetSettings(), BudgetTotalInfo, UserOpt, ApprovalsPage(), AssistantPage() (+79 more)

### Community 4 - "userCan"
Cohesion: 0.06
Nodes (84): POST(), EditTransactionSheet(), PayButton(), CancelButton(), CancelButton(), CreateRecordButtonProps, AVATAR_COLORS, createUser() (+76 more)

### Community 5 - "cn"
Cohesion: 0.03
Nodes (75): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES (+67 more)

### Community 6 - "batch-runner.ts"
Cohesion: 0.04
Nodes (76): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+68 more)

### Community 7 - "prisma.ts"
Cohesion: 0.04
Nodes (53): dynamic, GET(), dynamic, GET(), assistantNudge(), actorFor(), form(), actorFor() (+45 more)

### Community 8 - "lib/labels.ts"
Cohesion: 0.03
Nodes (72): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), BDPipeline() (+64 more)

### Community 9 - "fdStr"
Cohesion: 0.06
Nodes (76): EventDetail(), EventForm(), RequestActions(), RequesterWindow(), DriveComments(), EditMeetingButton(), InviteResponse(), Resp (+68 more)

### Community 10 - "requireModule"
Cohesion: 0.05
Nodes (60): dynamic, EntitesPage(), AdminFeedbackPage(), OrganigrammePage(), AdminSuppliersPage(), AdminWorkflowsPage(), dynamic, BudgetContextBar() (+52 more)

### Community 11 - "rules/engine.ts"
Cohesion: 0.05
Nodes (60): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+52 more)

### Community 12 - "notifyRoles"
Cohesion: 0.05
Nodes (65): DirectiveDetailPage(), MessageForm(), set(), StatusActions(), useAction(), RevisionRequest(), RegulatoryRequestDetailPage(), RequestThread() (+57 more)

### Community 13 - "getCompanyScope"
Cohesion: 0.05
Nodes (58): dynamic, GET(), runtime, dynamic, maxDuration, POST(), runtime, dynamic (+50 more)

### Community 14 - "upload/session.ts"
Cohesion: 0.06
Nodes (62): dynamic, runtime, releaseBlob(), archiveQueue, attachArchive(), clampInt(), enqueueArchive(), flushOriginalArchives() (+54 more)

### Community 15 - "Button"
Cohesion: 0.08
Nodes (37): DriveStorageSettings(), Option, RuleDTO, ResearchMeta(), ProjectEditor(), ProjectStatusBadge(), ConnectMailbox(), U (+29 more)

### Community 16 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (60): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+52 more)

### Community 17 - "canAccessEntity"
Cohesion: 0.06
Nodes (58): GET(), FieldsManager(), BeneficiariesCard(), Beneficiary, Mode, Refs, addBdProjectComment(), createBdProduct() (+50 more)

### Community 18 - "getCurrentUser"
Cohesion: 0.05
Nodes (51): dynamic, esc(), GET(), dynamic, GET(), dynamic, POST(), dynamic (+43 more)

### Community 19 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (60): reviewDocumentText(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES (+52 more)

### Community 20 - "anpp-process.tsx"
Cohesion: 0.06
Nodes (54): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), NewProductButton(), regStage(), RegulatoryPage(), CATEGORY_OPTS (+46 more)

### Community 21 - "test-center/runner.ts"
Cohesion: 0.06
Nodes (50): getTestCenterDashboard(), base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+42 more)

### Community 22 - "recordAudit"
Cohesion: 0.07
Nodes (53): ImpersonateButton(), SpaceSettingsButton(), VariationDTO, VariationPanel(), destroyDeletedRecord(), archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+45 more)

### Community 23 - "requireUser"
Cohesion: 0.07
Nodes (50): ActiveToggle(), PresentationCard(), PresentationPanel(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor() (+42 more)

### Community 24 - "drive-storage.ts"
Cohesion: 0.09
Nodes (48): dynamic, GET(), runtime, dynamic, POST(), RFC-3986, blobChunkBytes(), blobKey() (+40 more)

### Community 25 - "mail.ts"
Cohesion: 0.06
Nodes (55): dynamic, POST(), acquirePooled(), acquireSlot(), addrStr(), appendToSent(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD (+47 more)

### Community 26 - "budget-forms.tsx"
Cohesion: 0.07
Nodes (47): GET(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+39 more)

### Community 27 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 28 - "workflow/engine.ts"
Cohesion: 0.08
Nodes (50): Props, getManagerOfUser(), isManagerOfUser(), BudgetCategoryOption, AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity() (+42 more)

### Community 29 - "FindingInput"
Cohesion: 0.10
Nodes (40): ACTIONS, accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), FuzzReport, godModeSelfValidation(), GodReport (+32 more)

### Community 30 - "access-actions.ts"
Cohesion: 0.07
Nodes (41): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), GrantOption, RowGrants(), RowGrantsProps (+33 more)

### Community 31 - "department-budget-actions.ts"
Cohesion: 0.11
Nodes (41): DepartmentAccessSheet(), ROLE_OPTIONS, UserOpt, AmountCell(), DepartmentBudgetTable(), HrConsumption(), DepartmentBudgetsPage(), dynamic (+33 more)

### Community 32 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (45): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+37 more)

### Community 33 - "regAudit"
Cohesion: 0.09
Nodes (37): Citation, CorpusAdmin(), Source, Version, CorpusImport(), CaseCard(), regAudit(), canManage() (+29 more)

### Community 34 - "ocr-engine.ts"
Cohesion: 0.07
Nodes (41): MeetingRecorder(), pickMime(), dossierCost, c(), defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir() (+33 more)

### Community 35 - "agent-core.ts"
Cohesion: 0.08
Nodes (33): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc, AgentFinding (+25 more)

### Community 36 - "molecule.ts"
Cohesion: 0.11
Nodes (43): MarketProductsPage(), SuggestField(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts(), analyzeMoleculeSafe() (+35 more)

### Community 37 - "promo-material-actions.ts"
Cohesion: 0.16
Nodes (39): fd(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial() (+31 more)

### Community 38 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 39 - "invariants/registry.ts"
Cohesion: 0.09
Nodes (33): PERMISSIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantOutcome (+25 more)

### Community 40 - "(app)/layout.tsx"
Cohesion: 0.08
Nodes (33): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+25 more)

### Community 41 - "assistant.ts"
Cohesion: 0.09
Nodes (43): callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+35 more)

### Community 42 - "aiConfigured"
Cohesion: 0.11
Nodes (38): Msg, SUGGESTIONS, aiConfigured(), parsePdfBody(), askDossierAction(), askDossierAgentAction(), askReservesAction(), parseHistory() (+30 more)

### Community 43 - "adoption.ts"
Cohesion: 0.09
Nodes (37): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), dynamic, metadata, ADOPTION_TARGET_FIELDS (+29 more)

### Community 44 - "congress-national/[id]/page.tsx"
Cohesion: 0.12
Nodes (36): CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), AdProEditButton(), AdProTransferButton() (+28 more)

### Community 45 - "library-actions.ts"
Cohesion: 0.09
Nodes (36): ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, enrichFinding(), Enrichment, EnrichmentContext (+28 more)

### Community 46 - "getAppSettings"
Cohesion: 0.10
Nodes (32): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, GET() (+24 more)

### Community 47 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 48 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (33): AdProItemsPanel(), ItemRow, Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED (+25 more)

### Community 49 - "regCan"
Cohesion: 0.11
Nodes (33): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+25 more)

### Community 50 - "validation-actions.ts"
Cohesion: 0.09
Nodes (36): RuleControls(), RuleEditor(), submitAttachmentValidation(), connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), requestBV() (+28 more)

### Community 51 - "product-explorer.tsx"
Cohesion: 0.09
Nodes (32): AggNum(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone() (+24 more)

### Community 52 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 53 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 54 - "hasGlobalView"
Cohesion: 0.09
Nodes (29): DossierDetailPage(), EquipesPage(), SupportDetailPage(), getActionCenter(), resolve(), canManageDossier(), canViewDossier(), DossierDetail (+21 more)

### Community 55 - "hr-document-actions.ts"
Cohesion: 0.14
Nodes (30): HrDossier(), REQ_TO_CAT, RequestRow(), MeetingControls(), ackExpenseOriginals(), applyAnnualLeaveBalance(), archiveHrRequestIfDone(), confirmHrMeeting() (+22 more)

### Community 56 - "queries/messaging.ts"
Cohesion: 0.11
Nodes (30): dynamic, GET(), Props, Props, Props, dynamic, MessagesPage(), Presence (+22 more)

### Community 57 - "lib/ai.ts"
Cohesion: 0.09
Nodes (23): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiTextResult, AnthropicBlock, apiErrorMessage(), AskOptions (+15 more)

### Community 58 - "SessionUser"
Cohesion: 0.16
Nodes (27): DeclarationDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+19 more)

### Community 59 - "pilotage/page.tsx"
Cohesion: 0.16
Nodes (28): AffectationsPage(), dynamic, PlanningPage(), dynamic, pct(), PilotagePage(), toneOf(), ensureCycle() (+20 more)

### Community 60 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (28): dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine (+20 more)

### Community 61 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (27): LinkToDossier(), DossierStatusControls(), CreateDossierButton(), archiveDossier(), assignDossier(), createDossier(), createDossierFromTask(), deleteDossierMessage() (+19 more)

### Community 62 - "medical-actions.ts"
Cohesion: 0.12
Nodes (30): DeleteDoctorButton(), DoctorSheet(), InstitutionsManager(), SpecialtiesManager(), useSubmit(), createDoctor(), createInstitution(), createSpecialty() (+22 more)

### Community 63 - "query.ts"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput (+15 more)

### Community 64 - "workflow-builder.tsx"
Cohesion: 0.12
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+15 more)

### Community 65 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (26): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+18 more)

### Community 66 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 67 - "onlyoffice.ts"
Cohesion: 0.16
Nodes (23): DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage(), dynamic (+15 more)

### Community 68 - "message-thread.tsx"
Cohesion: 0.14
Nodes (23): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+15 more)

### Community 69 - "assistant-actions.ts"
Cohesion: 0.17
Nodes (26): assistantChat(), forgetMyAssistantMemory(), maybeDistillMemory(), myAssistantThread(), NudgeResult, rememberExchange(), askClaudeCheap(), ExecuteResult (+18 more)

### Community 70 - "storage.ts"
Cohesion: 0.13
Nodes (21): POST(), dynamic, GET(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder() (+13 more)

### Community 71 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 72 - "congress-request-actions.ts"
Cohesion: 0.23
Nodes (27): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+19 more)

### Community 73 - "upload-manager.tsx"
Cohesion: 0.13
Nodes (22): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+14 more)

### Community 74 - "stream/route.ts"
Cohesion: 0.12
Nodes (22): dynamic, maxDuration, runtime, VersionsPage(), AssistantPage(), dynamic, dynamic, RootPage() (+14 more)

### Community 75 - "Select"
Cohesion: 0.08
Nodes (21): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ShareItem, SharePanel(), MoveTarget, Props (+13 more)

### Community 76 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 77 - "dossiers/[id]/panel.tsx"
Cohesion: 0.12
Nodes (21): DossierAssign(), DossierMessageForm(), DossierMessageItem(), MessageAttachments(), MsgAttachment, useAction(), UserLite, DoctorPicker() (+13 more)

### Community 78 - "scheduled.ts"
Cohesion: 0.14
Nodes (24): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+16 more)

### Community 79 - "getBlob"
Cohesion: 0.14
Nodes (19): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET(), dynamic (+11 more)

### Community 80 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 81 - "sectionByCode"
Cohesion: 0.13
Nodes (21): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+13 more)

### Community 82 - "company.ts"
Cohesion: 0.17
Nodes (20): dynamic, GET(), INLINE_MIME, runtime, AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany() (+12 more)

### Community 83 - "users/[id]/page.tsx"
Cohesion: 0.11
Nodes (21): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, AccessByModulePage(), ACTION_FR (+13 more)

### Community 84 - "calendar.ts"
Cohesion: 0.18
Nodes (22): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+14 more)

### Community 85 - "button.tsx"
Cohesion: 0.08
Nodes (18): RestoreButton(), AttachmentValidationBlock(), STATUS_BADGES, StepView, ValidationView, EventFundingPanel(), PmOpt, SubmitButton() (+10 more)

### Community 86 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 87 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 88 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 89 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 90 - "resolveDriveAccess"
Cohesion: 0.20
Nodes (20): POST(), createFolder(), createOfficeNode(), ensureDriveFolders(), canCreateInSpace(), DriveAccessLevel, driveBreadcrumb(), effectiveSpaceId() (+12 more)

### Community 91 - "rbac.test.ts"
Cohesion: 0.18
Nodes (19): GET(), SearchPage(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone(), globalSearch(), SearchResult (+11 more)

### Community 92 - "adventum-brain/page.tsx"
Cohesion: 0.14
Nodes (20): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+12 more)

### Community 93 - "assistant-chat.tsx"
Cohesion: 0.13
Nodes (20): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+12 more)

### Community 94 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 95 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 96 - "edit-product.tsx"
Cohesion: 0.14
Nodes (17): OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow, SelectField() (+9 more)

### Community 97 - "meetings.ts"
Cohesion: 0.16
Nodes (18): externalBase(), formatDateTime(), MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin(), appBaseUrlForMeet(), canManageMeeting() (+10 more)

### Community 98 - "sponsoring-actions.ts"
Cohesion: 0.14
Nodes (20): AppealPanel(), ThirdPartyButton(), canDoPreliminary(), isDirection(), requestThirdPartyInput(), revalidate(), sponsoringAppeal(), sponsoringFinal() (+12 more)

### Community 99 - "portfolio.ts"
Cohesion: 0.15
Nodes (19): ProductList(), getFieldReportsAggregation(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+11 more)

### Community 100 - "getMarketData"
Cohesion: 0.13
Nodes (21): Cache, DIR, getMarketData(), LabRow, loadNdjson(), MarketMeta, NomRow, PchRow (+13 more)

### Community 101 - "rag.ts"
Cohesion: 0.16
Nodes (18): lunaEmbed(), lunaEmbedModel(), CorpusExtract, corpusForSection(), queryFor(), SECTION_HINTS, citationsByIds(), CorpusFilters (+10 more)

### Community 102 - "regulatory-ia/page.tsx"
Cohesion: 0.15
Nodes (17): BudgetRowData, DossierBudgetRow(), Breakdown(), dynamic, fmtDateTime(), fmtUsd(), metadata, RegulatoryIaAdminPage() (+9 more)

### Community 103 - "admin-settings-forms.tsx"
Cohesion: 0.13
Nodes (20): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+12 more)

### Community 104 - "event-form.tsx"
Cohesion: 0.12
Nodes (17): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), PARTICIPANT_ROLE (+9 more)

### Community 105 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 106 - "budget-envelope-actions.ts"
Cohesion: 0.19
Nodes (21): addBudgetExpense(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory(), ensureCanManageEnvelope() (+13 more)

### Community 107 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 108 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 109 - "brain-cockpit.tsx"
Cohesion: 0.12
Nodes (16): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+8 more)

### Community 110 - "congress.ts"
Cohesion: 0.17
Nodes (17): CongressInternationalPage(), CongressNationalPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressFormData(), getCongressList() (+9 more)

### Community 111 - "messaging-actions.ts"
Cohesion: 0.19
Nodes (20): NewConversation(), createChannel(), createDirect(), createGroup(), DENIED, joinChannel(), parseAttachments(), ParsedAttachment (+12 more)

### Community 112 - "dossier-thread.ts"
Cohesion: 0.16
Nodes (18): DossierChatPanel(), Msg, SUGGESTIONS, loadDossierChatAction(), resetDossierChatAction(), AgentAttachment, AgentFile, appendThreadMessage() (+10 more)

### Community 113 - "build-facts.ts"
Cohesion: 0.17
Nodes (15): TEXTUAL_EXTRACTION_STATUSES, AI_FACT_PRIORITY, aiSectionPriority(), buildTwinFacts(), clampInt(), extractAiFactsBounded(), CRITICAL_KEYS, detectConflicts() (+7 more)

### Community 114 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 115 - "drive/page.tsx"
Cohesion: 0.18
Nodes (17): DocumentsPage(), DriveRow, DriveTable(), DropCategory, MoveTarget, UserLite, DriveSpacePage(), dynamic (+9 more)

### Community 116 - "admin-delete-actions.ts"
Cohesion: 0.19
Nodes (16): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY (+8 more)

### Community 117 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 118 - "support-actions.ts"
Cohesion: 0.25
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 119 - "auth-actions.ts"
Cohesion: 0.15
Nodes (10): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenu(), UserMenuProps, authenticate() (+2 more)

### Community 120 - "messenger.tsx"
Cohesion: 0.18
Nodes (15): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), bumpConversation(), Messenger() (+7 more)

### Community 121 - "info-panel.tsx"
Cohesion: 0.25
Nodes (17): AddMembers(), cid(), InfoPanel(), Row(), addMembers(), archiveConversation(), canManage(), leaveConversation() (+9 more)

### Community 122 - "equipes/page.tsx"
Cohesion: 0.14
Nodes (13): CataloguePage(), dynamic, dynamic, dynamic, ParametresPage(), Config, DEFAULTS, num() (+5 more)

### Community 123 - "run.ts"
Cohesion: 0.19
Nodes (12): extractLooseJson(), repairAndParse(), AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES, runReviewerSimulation() (+4 more)

### Community 124 - "getMailAccount"
Cohesion: 0.18
Nodes (13): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+5 more)

### Community 125 - "tender-lines.tsx"
Cohesion: 0.19
Nodes (15): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+7 more)

### Community 126 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 127 - "supplier-portal-actions.ts"
Cohesion: 0.21
Nodes (13): SupplierLoginForm(), SupplierLoginPage(), SupplierLogoutButton(), supplierLogin(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier() (+5 more)

### Community 128 - "departments.ts"
Cohesion: 0.19
Nodes (14): buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentSubtreeIds(), getDepartmentTree() (+6 more)

### Community 129 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 130 - "driver/page.tsx"
Cohesion: 0.20
Nodes (12): CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getDeletedRequests() (+4 more)

### Community 131 - "drive/[id]/page.tsx"
Cohesion: 0.22
Nodes (12): ConvertPdfButton(), DriveCommentItem, DriveFilePage(), humanSize(), convertNodeToPdf(), fileKind(), fileTypeLabel(), convertConfigured() (+4 more)

### Community 132 - "events/[id]/page.tsx"
Cohesion: 0.17
Nodes (11): dynamic, dynamic, EventsPage(), ValidationStepper(), VStep, VStepState, EVENT_FORMAT, EVENT_SCOPE (+3 more)

### Community 133 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 134 - "dossier-knowledge.ts"
Cohesion: 0.22
Nodes (14): bestValue(), DossierFact, DossierModuleNode, DossierPassage, DossierSectionNode, DossierTextHit, getApprovedFactMap(), getDossierDocuments() (+6 more)

### Community 135 - "today.ts"
Cohesion: 0.20
Nodes (12): TodayPage(), CalendarEventDTO, getToday(), greetingFor(), rankToday(), reasonOf(), REASONS, score() (+4 more)

### Community 136 - "drive-actions.ts"
Cohesion: 0.20
Nodes (14): FileActions(), ShareRow(), AccessSheet(), NodeActions(), collectSubtree(), deleteNode(), DENIED, getDriveNodeShares() (+6 more)

### Community 137 - "event-actions.ts"
Cohesion: 0.24
Nodes (13): EditEventButton(), CheckinConfirm(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration() (+5 more)

### Community 138 - "lib/messaging.ts"
Cohesion: 0.18
Nodes (12): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+4 more)

### Community 139 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 140 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 141 - "test-center/types.ts"
Cohesion: 0.23
Nodes (9): ENV_LABEL, LaunchPanel(), MODES, ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter() (+1 more)

### Community 142 - "medical-directory.tsx"
Cohesion: 0.18
Nodes (12): MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER, DOCTOR_TITLE, INSTITUTION_SECTOR, INSTITUTION_TYPE (+4 more)

### Community 143 - "training-panel.tsx"
Cohesion: 0.16
Nodes (9): ACCEPT, AUTHORITIES, Row, CaseDocRow, CaseRow, UpRow, FileIngestStatus, OUTCOME_ORDER (+1 more)

### Community 144 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 145 - "decompose.ts"
Cohesion: 0.21
Nodes (12): buildUserMessage(), asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode(), decomposeReserveText(), RESERVE_TYPE_LABELS (+4 more)

### Community 146 - "ai-facts.ts"
Cohesion: 0.23
Nodes (11): AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt(), CATALOG_KEYS, evidenceIsGrounded(), extractFactsWithAI() (+3 more)

### Community 147 - "regulatory-drive-mirror.ts"
Cohesion: 0.29
Nodes (10): POST(), cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult (+2 more)

### Community 148 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 149 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 150 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 151 - "sidebar.tsx"
Cohesion: 0.18
Nodes (9): CommandPalette(), Item, SearchResult, badgeFor(), GROUP_ORDER, Sidebar(), SidebarProps, TopbarProps (+1 more)

### Community 152 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 153 - "simple-pdf.ts"
Cohesion: 0.26
Nodes (11): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, PdfBlock (+3 more)

### Community 154 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 155 - "feature-actions.ts"
Cohesion: 0.23
Nodes (10): Group(), STAGE, VersionsManager(), requireAdmin(), setFeatureStage(), Stage, STAGE_LABEL, STAGES (+2 more)

### Community 156 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 157 - "adventum-actions.ts"
Cohesion: 0.31
Nodes (8): RiskThresholdsForm(), DENIED, updateRiskThresholds(), DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField, AutopilotPayload

### Community 158 - "supplies-manager.tsx"
Cohesion: 0.35
Nodes (9): SuppliesManager(), SupplyArticleRow, canManageCatalog(), createSupplyArticle(), DENIED, toggleSupplyArticle(), updateSupplyArticle(), SUPPLY_CATEGORY (+1 more)

### Community 159 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 160 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 161 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 162 - "company-actions.ts"
Cohesion: 0.38
Nodes (8): EntitiesManager(), EntityRow, PALETTE, canManageCompanies(), createCompany(), toggleCompany(), updateCompany(), COMPANY_COOKIE

### Community 163 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 164 - "validation-item-review.tsx"
Cohesion: 0.27
Nodes (8): ValidationAttachments(), Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 165 - "regulatory-requests.ts"
Cohesion: 0.31
Nodes (8): RegulatoryRequestsPage(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO, regRequestProductOptions(), canCreateRegRequest(), canSeeRegRequests()

### Community 166 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 167 - "training/for-section.ts"
Cohesion: 0.28
Nodes (6): CaseExtract, OUTCOME_WEIGHT, RankableCaseDoc, rankCaseDocs(), base, OUTCOME_LABELS

### Community 168 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 169 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 170 - "calendar-view.tsx"
Cohesion: 0.29
Nodes (6): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND

### Community 171 - "drive-space-manager.tsx"
Cohesion: 0.25
Nodes (4): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt

### Community 172 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 173 - "upload-button.tsx"
Cohesion: 0.32
Nodes (7): CATEGORY_SUGGESTIONS, Perm, PermBtn(), RichUpload(), UploadButton(), UserLite, useBackgroundUpload()

### Community 174 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 175 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 176 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 177 - "assignment-matrix.tsx"
Cohesion: 0.38
Nodes (6): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod

### Community 178 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 179 - "reserves/page.tsx"
Cohesion: 0.33
Nodes (3): dynamic, metadata, RegScopeCard()

### Community 180 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 181 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 182 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 183 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 184 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 185 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 186 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 187 - "request-controls.tsx"
Cohesion: 0.60
Nodes (4): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton()

### Community 188 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

### Community 189 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

## Knowledge Gaps
- **1208 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `lib/session.ts`, `toNumber`, `utils.ts`, `formatDate`, `userCan`, `cn`, `batch-runner.ts`, `lib/labels.ts`, `fdStr`, `requireModule`, `rules/engine.ts`, `notifyRoles`, `getCompanyScope`, `upload/session.ts`, `corpus-actions.ts`, `canAccessEntity`, `getCurrentUser`, `jobs/runner.ts`, `anpp-process.tsx`, `test-center/runner.ts`, `recordAudit`, `requireUser`, `drive-storage.ts`, `mail.ts`, `budget-forms.tsx`, `care-actions.ts`, `workflow/engine.ts`, `access-actions.ts`, `department-budget-actions.ts`, `[dossierId]/page.tsx`, `regAudit`, `ocr-engine.ts`, `agent-core.ts`, `promo-material-actions.ts`, `invariants/registry.ts`, `(app)/layout.tsx`, `assistant.ts`, `aiConfigured`, `adoption.ts`, `congress-national/[id]/page.tsx`, `library-actions.ts`, `getAppSettings`, `market-research.ts`, `ad-pro-item-actions.ts`, `regCan`, `validation-actions.ts`, `sales-planning-actions.ts`, `platform-audit/engine.ts`, `hasGlobalView`, `hr-document-actions.ts`, `queries/messaging.ts`, `lib/ai.ts`, `SessionUser`, `pilotage/page.tsx`, `pch-tender-line-actions.ts`, `dossier-actions.ts`, `medical-actions.ts`, `query.ts`, `workflow-builder.tsx`, `bd-strategic-table.tsx`, `onlyoffice.ts`, `assistant-actions.ts`, `storage.ts`, `congress-request-actions.ts`, `stream/route.ts`, `smart-mail-actions.ts`, `scheduled.ts`, `getBlob`, `reports.ts`, `company.ts`, `users/[id]/page.tsx`, `calendar.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `resolveDriveAccess`, `rbac.test.ts`, `adventum-brain/page.tsx`, `supplier/actions.ts`, `meetings.ts`, `sponsoring-actions.ts`, `portfolio.ts`, `rag.ts`, `regulatory-ia/page.tsx`, `admin-settings-forms.tsx`, `event-form.tsx`, `onboarding-wizard.tsx`, `budget-envelope-actions.ts`, `risks.ts`, `brain-cockpit.tsx`, `congress.ts`, `messaging-actions.ts`, `dossier-thread.ts`, `build-facts.ts`, `drive/page.tsx`, `admin-delete-actions.ts`, `support-actions.ts`, `auth-actions.ts`, `equipes/page.tsx`, `run.ts`, `getMailAccount`, `pch.ts`, `supplier-portal-actions.ts`, `departments.ts`, `driver/page.tsx`, `drive/[id]/page.tsx`, `events/[id]/page.tsx`, `process-intelligence.ts`, `dossier-knowledge.ts`, `drive-actions.ts`, `event-actions.ts`, `lib/messaging.ts`, `dashboard.ts`, `compare-versions.ts`, `department-actions.ts`, `regulatory-drive-mirror.ts`, `pch/export/route.ts`, `stock-snapshot-actions.ts`, `hr-documents.ts`, `push.ts`, `feature-actions.ts`, `adventum-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `company-actions.ts`, `meetings/page.tsx`, `regulatory-requests.ts`, `training/for-section.ts`, `reserves/page.tsx`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `toNumber`, `utils.ts`, `formatDate`, `userCan`, `prisma.ts`, `fdStr`, `requireModule`, `rules/engine.ts`, `notifyRoles`, `getCompanyScope`, `corpus-actions.ts`, `canAccessEntity`, `getCurrentUser`, `recordAudit`, `budget-forms.tsx`, `care-actions.ts`, `access-actions.ts`, `department-budget-actions.ts`, `regAudit`, `agent-core.ts`, `molecule.ts`, `promo-material-actions.ts`, `(app)/layout.tsx`, `aiConfigured`, `congress-national/[id]/page.tsx`, `library-actions.ts`, `getAppSettings`, `ad-pro-item-actions.ts`, `regCan`, `validation-actions.ts`, `sales-planning-actions.ts`, `platform-audit/engine.ts`, `hasGlobalView`, `hr-document-actions.ts`, `lib/ai.ts`, `SessionUser`, `pch-tender-line-actions.ts`, `dossier-actions.ts`, `medical-actions.ts`, `workflow-builder.tsx`, `onlyoffice.ts`, `assistant-actions.ts`, `molecule-panel.tsx`, `congress-request-actions.ts`, `stream/route.ts`, `smart-mail-actions.ts`, `dossiers/[id]/panel.tsx`, `reports.ts`, `lifecycle/actions.ts`, `resolveDriveAccess`, `rbac.test.ts`, `assistant-chat.tsx`, `supplier/actions.ts`, `sponsoring-actions.ts`, `regulatory-ia/page.tsx`, `admin-settings-forms.tsx`, `onboarding-wizard.tsx`, `budget-envelope-actions.ts`, `brain-cockpit.tsx`, `messaging-actions.ts`, `dossier-thread.ts`, `admin-delete-actions.ts`, `support-actions.ts`, `auth-actions.ts`, `messenger.tsx`, `info-panel.tsx`, `tender-lines.tsx`, `drive/[id]/page.tsx`, `drive-actions.ts`, `event-actions.ts`, `lib/messaging.ts`, `test-center/types.ts`, `department-actions.ts`, `stock-snapshot-actions.ts`, `feature-actions.ts`, `adventum-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `company-actions.ts`, `validation-item-review.tsx`, `regulatory-requests.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `lib/session.ts`, `toNumber`, `utils.ts`, `driver/page.tsx`, `drive/[id]/page.tsx`, `cn`, `events/[id]/page.tsx`, `prisma.ts`, `formatDate`, `fdStr`, `requireModule`, `drive-actions.ts`, `notifyRoles`, `event-actions.ts`, `lib/labels.ts`, `dashboard.ts`, `department-actions.ts`, `canAccessEntity`, `getCurrentUser`, `pch/export/route.ts`, `anpp-process.tsx`, `recordAudit`, `requireUser`, `drive-storage.ts`, `mail.ts`, `budget-forms.tsx`, `care-actions.ts`, `stock-snapshot-actions.ts`, `access-actions.ts`, `department-budget-actions.ts`, `supplies-manager.tsx`, `reminder-actions.ts`, `company-actions.ts`, `molecule.ts`, `promo-material-actions.ts`, `(app)/layout.tsx`, `assistant.ts`, `adoption.ts`, `congress-national/[id]/page.tsx`, `getAppSettings`, `market-research.ts`, `ad-pro-item-actions.ts`, `validation-actions.ts`, `product-explorer.tsx`, `sales-planning-actions.ts`, `hasGlobalView`, `hr-document-actions.ts`, `queries/messaging.ts`, `lib/ai.ts`, `SessionUser`, `pilotage/page.tsx`, `pch-tender-line-actions.ts`, `dossier-actions.ts`, `medical-actions.ts`, `assistant-actions.ts`, `molecule-panel.tsx`, `congress-request-actions.ts`, `stream/route.ts`, `getBlob`, `calendar.ts`, `resolveDriveAccess`, `rbac.test.ts`, `adventum-brain/page.tsx`, `assistant-chat.tsx`, `sponsoring-actions.ts`, `budget-envelope-actions.ts`, `congress.ts`, `messaging-actions.ts`, `drive/page.tsx`, `support-actions.ts`, `equipes/page.tsx`, `tender-lines.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.057545507927187316 - nodes in this community are weakly interconnected._
- **Should `toNumber` be split into smaller, more focused modules?**
  _Cohesion score 0.04292063492063492 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07614696363982486 - nodes in this community are weakly interconnected._