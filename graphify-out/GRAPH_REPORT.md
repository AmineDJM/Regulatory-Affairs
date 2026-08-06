# Graph Report - src  (2026-08-06)

## Corpus Check
- 899 files · ~627,210 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5492 nodes · 21512 edges · 180 communities (174 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96e70550`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- card.tsx
- hasGlobalView
- userCan
- lib/labels.ts
- badge.tsx
- prisma.ts
- brain-cockpit.tsx
- regulatory-actions.ts
- utils.ts
- rbac.ts
- mail.ts
- requireUser
- notifyUser
- formatCurrency
- getCurrentUser
- input.tsx
- getCompanyScope
- fdStr
- [dossierId]/page.tsx
- batch-runner.ts
- rules/engine.ts
- corpus-actions.ts
- pilotage/page.tsx
- ocr-engine.ts
- FindingInput
- formatDate
- jobs/runner.ts
- assistant-actions.ts
- care-actions.ts
- upload/session.ts
- aiConfigured
- requireModule
- test-center/runner.ts
- promo-material-actions.ts
- library-actions.ts
- regCan
- medical-directory.tsx
- entity-access.ts
- mistral-ocr.ts
- molecule.ts
- market-research.ts
- assistant.ts
- process-intelligence.ts
- object-storage.ts
- onlyoffice.ts
- ingest-dossier.ts
- lib/ai.ts
- adoption.ts
- platform-audit/engine.ts
- getBlob
- product-explorer.tsx
- build-facts.ts
- sales-planning-actions.ts
- market/engine.ts
- messaging-actions.ts
- agent-core.ts
- button.tsx
- dossier-actions.ts
- drive/page.tsx
- ad-pro-item-actions.ts
- message-thread.tsx
- new-conversation.tsx
- generate.ts
- workflow/engine.ts
- drive-actions.ts
- features.ts
- budget-forms.tsx
- competition.ts
- workflow-builder.tsx
- regulatory-request-actions.ts
- bd-strategic-table.tsx
- form-fields.tsx
- onboarding-wizard.tsx
- smart-mail-actions.ts
- validation-actions.ts
- buildRef
- (app)/layout.tsx
- messenger.tsx
- explorer.ts
- sectionByCode
- admin-delete-actions.ts
- pch-tender-line-actions.ts
- departments.ts
- queries/messaging.ts
- calendar.ts
- lifecycle/actions.ts
- migration-cert.ts
- test-center/page.tsx
- mon-dossier/page.tsx
- supplier/actions.ts
- enregistrement/page.tsx
- extract-text.ts
- Select
- topbar.tsx
- budget-envelope-actions.ts
- invariants/registry.ts
- budget.ts
- dashboard/page.tsx
- budgets/page.tsx
- mail-client.tsx
- extract-facts.ts
- evidence.ts
- admin-settings-forms.tsx
- meetings/[id]/page.tsx
- upload-manager.tsx
- market-research-actions.ts
- meetings.ts
- pch-tender-export.ts
- congress-request-actions.ts
- access-actions.ts
- zip-viewer.tsx
- field-report-actions.ts
- run.ts
- support-actions.ts
- auth.ts
- department-actions.ts
- document-preview.tsx
- pch.ts
- office-templates.ts
- meeting-actions.ts
- auth-actions.ts
- compare-versions.ts
- access/page.tsx
- radar.ts
- supplier-portal-actions.ts
- messaging/messages/route.ts
- push.ts
- users/[id]/page.tsx
- new-request.tsx
- event-actions.ts
- lib/messaging.ts
- stock-snapshot-actions.ts
- today.ts
- reglages/page.tsx
- field-reports.ts
- hr-dossier.tsx
- assistant-files.ts
- workflow-panel.tsx
- panels.tsx
- background-upload.tsx
- reminder-actions.ts
- regulatory-drive-mirror.ts
- molecule-panel.tsx
- congress-workflow.tsx
- budget-export.test.ts
- data.ts
- scheduled.ts
- org-chart-editor.tsx
- meetings/page.tsx
- stocks-view.tsx
- Adventum Autonomous Test Center — architecture
- validation-item-review.tsx
- mobile-tabbar.tsx
- client-bundle-guard.test.ts
- login-throttle.ts
- calendar-view.tsx
- delegate-plans.tsx
- visits-table.tsx
- meeting-chat.tsx
- feature-actions.ts
- defaults.ts
- [token]/route.ts
- courses-board.tsx
- event-form.tsx
- employee-form.tsx
- next-auth.d.ts
- postDriveComment
- payroll-matrix.tsx
- notification-chime.tsx
- geo.ts
- events/[id]/export/route.ts
- workflows/page.tsx
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 585 edges
2. `userCan()` - 451 edges
3. `fdStr()` - 440 edges
4. `recordAudit()` - 381 edges
5. `prisma` - 371 edges
6. `requireModule()` - 216 edges
7. `hasGlobalView()` - 153 edges
8. `Button` - 151 edges
9. `cn()` - 139 edges
10. `formatDate()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (180 total, 6 thin omitted)

### Community 0 - "card.tsx"
Cohesion: 0.04
Nodes (101): ActivityTable(), ActivityPage(), fmtDuration(), AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, dynamic (+93 more)

### Community 1 - "hasGlobalView"
Cohesion: 0.04
Nodes (94): CongressDetailView(), CongressTable(), CongressIntlDetailPage(), CongressInternationalPage(), CongressNatDetailPage(), CongressNationalPage(), DemandesPage(), DirectiveDetailPage() (+86 more)

### Community 2 - "userCan"
Cohesion: 0.06
Nodes (95): POST(), PresentationCard(), EditTenderButton(), OrdersManager(), useSubmit(), createUser(), setSecondaryRole(), toggleUserActive() (+87 more)

### Community 3 - "lib/labels.ts"
Cohesion: 0.03
Nodes (81): ActivityRow, TYPE, AuditPanel(), AuditRow, AuditTable(), BDPipeline(), STAGES, BDRow (+73 more)

### Community 4 - "badge.tsx"
Cohesion: 0.08
Nodes (58): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, ACTION_COLS, ACTION_LABELS, dynamic (+50 more)

### Community 5 - "prisma.ts"
Cohesion: 0.06
Nodes (43): dynamic, GET(), dynamic, GET(), dynamic, runtime, dynamic, CheckinConfirm() (+35 more)

### Community 6 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (71): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+63 more)

### Community 7 - "regulatory-actions.ts"
Cohesion: 0.05
Nodes (71): EditProductButton(), RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), NewProductButton(), regStage(), RegulatoryPage() (+63 more)

### Community 8 - "utils.ts"
Cohesion: 0.07
Nodes (54): FeedbackStatusSelect(), AdminPage(), fmtBytes(), fmtWhen(), dynamic, BusinessDevelopmentPage(), Chip(), dynamic (+46 more)

### Community 9 - "rbac.ts"
Cohesion: 0.05
Nodes (47): actorFor(), addMedicalInfoComment(), actorFor(), completeOnboarding(), actorFor(), OLD_HASH, actorFor(), actor() (+39 more)

### Community 10 - "mail.ts"
Cohesion: 0.05
Nodes (72): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+64 more)

### Community 11 - "requireUser"
Cohesion: 0.06
Nodes (70): resetActivityTime(), addBdProjectComment(), createBdProduct(), createBdProject(), createBdRange(), deleteBdProduct(), deleteBdProject(), deleteBdRange() (+62 more)

### Community 12 - "notifyUser"
Cohesion: 0.06
Nodes (69): EventDetail(), EventForm(), RequestRow(), runAutopilot(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES, parseKind() (+61 more)

### Community 13 - "formatCurrency"
Cohesion: 0.06
Nodes (62): AdminValidationsPage(), dec(), NewRequestButton(), SuppliesManager(), CategoryCard(), ComptaCockpit(), RecettesDepensesChart(), LedgerTable() (+54 more)

### Community 14 - "getCurrentUser"
Cohesion: 0.07
Nodes (49): POST(), dynamic, GET(), dynamic, POST(), dynamic, POST(), dynamic (+41 more)

### Community 15 - "input.tsx"
Cohesion: 0.07
Nodes (37): DriveStorageSettings(), EntityRow, PALETTE, Option, RuleDTO, ResearchMeta(), ProjectEditor(), ProjectStatusBadge() (+29 more)

### Community 16 - "getCompanyScope"
Cohesion: 0.05
Nodes (53): dynamic, GET(), INLINE_MIME, runtime, GET(), dynamic, maxDuration, POST() (+45 more)

### Community 17 - "fdStr"
Cohesion: 0.06
Nodes (59): EntitiesManager(), ActiveToggle(), letter(), MissionStops(), StopDTO, RequestActions(), RequesterWindow(), SpaceSettingsButton() (+51 more)

### Community 18 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (51): ApproveNameButton(), DeleteDossierButton(), FindingControls(), Props, statusLabel(), CostTable(), DossierDetailPage(), dynamic (+43 more)

### Community 19 - "batch-runner.ts"
Cohesion: 0.06
Nodes (52): extractJson(), BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine() (+44 more)

### Community 20 - "rules/engine.ts"
Cohesion: 0.07
Nodes (48): KIND_LABEL, Pack, Rule, RulePacksAdmin(), canManage(), PackTestReport, Result, runRulePackTests() (+40 more)

### Community 21 - "corpus-actions.ts"
Cohesion: 0.07
Nodes (48): CorpusPanel(), IngestResults, Src, WatchFindings, dynamic, metadata, SourceRow(), SourceWithVersion (+40 more)

### Community 22 - "pilotage/page.tsx"
Cohesion: 0.08
Nodes (49): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+41 more)

### Community 23 - "ocr-engine.ts"
Cohesion: 0.06
Nodes (48): LunaCallInput, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED, canOcr() (+40 more)

### Community 24 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 25 - "formatDate"
Cohesion: 0.06
Nodes (42): dynamic, FocusCard(), MarketResearchListPage(), ExpenseAckItem, ExpenseAckList(), ItemTable(), LogisticsDetailPage(), AdvanceItem (+34 more)

### Community 26 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (50): reviewDocumentText(), codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS (+42 more)

### Community 27 - "assistant-actions.ts"
Cohesion: 0.09
Nodes (48): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), groupThreads(), MessageBubble(), Msg (+40 more)

### Community 28 - "care-actions.ts"
Cohesion: 0.11
Nodes (46): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+38 more)

### Community 29 - "upload/session.ts"
Cohesion: 0.07
Nodes (46): dynamic, POST(), runtime, dynamic, maxDuration, POST(), runtime, DELETE() (+38 more)

### Community 30 - "aiConfigured"
Cohesion: 0.08
Nodes (44): DossierChatPanel(), Msg, SUGGESTIONS, Msg, ReserveChatPanel(), SUGGESTIONS, aiConfigured(), AiTextResult (+36 more)

### Community 31 - "requireModule"
Cohesion: 0.06
Nodes (42): EntitesPage(), FieldDefDTO, FieldsManager(), CustomFieldsPage(), OrganigrammePage(), dynamic, metadata, RegulatoryCorpusPage() (+34 more)

### Community 32 - "test-center/runner.ts"
Cohesion: 0.08
Nodes (40): ENV_LABEL, LaunchPanel(), MODES, ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter() (+32 more)

### Community 33 - "promo-material-actions.ts"
Cohesion: 0.14
Nodes (44): fd(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), form(), audit() (+36 more)

### Community 34 - "library-actions.ts"
Cohesion: 0.08
Nodes (40): FindingEvidence(), dynamic, metadata, ReserveLibraryPage(), PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar (+32 more)

### Community 35 - "regCan"
Cohesion: 0.09
Nodes (40): CorpusAdmin(), BudgetForm(), DeferredReviewButton(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+32 more)

### Community 36 - "medical-directory.tsx"
Cohesion: 0.08
Nodes (45): DoctorSheet(), InstitutionsManager(), Props, Result, SECTOR_ICON, SECTOR_ORDER, SpecialtiesManager(), useSubmit() (+37 more)

### Community 37 - "entity-access.ts"
Cohesion: 0.09
Nodes (39): POST(), GET(), SearchPage(), ActionResult, uploadDocument(), executeReadTool(), PersistDocInput, persistUploadedDocument() (+31 more)

### Community 38 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 39 - "molecule.ts"
Cohesion: 0.11
Nodes (41): dynamic, MarketProductsPage(), SuggestField(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, canonicalForm(), dosageMatches() (+33 more)

### Community 40 - "market-research.ts"
Cohesion: 0.08
Nodes (38): GET(), GET(), MarketResearchDetailPage(), PresentationPanel(), Res, analyzeMarketResearch(), buildContext(), extractJson() (+30 more)

### Community 41 - "assistant.ts"
Cohesion: 0.08
Nodes (43): MedicalDirectory(), callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal() (+35 more)

### Community 42 - "process-intelligence.ts"
Cohesion: 0.08
Nodes (38): dynamic, maxDuration, runtime, dynamic, POST(), dynamic, GET(), BrainCockpit() (+30 more)

### Community 43 - "object-storage.ts"
Cohesion: 0.11
Nodes (38): dynamic, GET(), runtime, dynamic, maxDuration, POST(), runtime, RFC-3986 (+30 more)

### Community 44 - "onlyoffice.ts"
Cohesion: 0.13
Nodes (33): POST(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage() (+25 more)

### Community 45 - "ingest-dossier.ts"
Cohesion: 0.10
Nodes (37): dynamic, maxDuration, POST(), runtime, sha256(), clampInt(), ingestCore(), ingestDossierZip() (+29 more)

### Community 46 - "lib/ai.ts"
Cohesion: 0.07
Nodes (30): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), runAiHealthCheckNow(), AiHealthCheckButton(), AiControlCenterPage() (+22 more)

### Community 47 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 48 - "platform-audit/engine.ts"
Cohesion: 0.09
Nodes (35): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+27 more)

### Community 49 - "getBlob"
Cohesion: 0.09
Nodes (28): GET(), dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET() (+20 more)

### Community 50 - "product-explorer.tsx"
Cohesion: 0.09
Nodes (33): AggNum(), fmtDzd(), dynamic, fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone() (+25 more)

### Community 51 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 52 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 53 - "market/engine.ts"
Cohesion: 0.14
Nodes (33): prefillResearchRow(), matchOurProduct(), getMarketData(), allowedMfg(), allTokensIn(), bucket(), buildCompetition(), CompetitionRow (+25 more)

### Community 54 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (34): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+26 more)

### Community 55 - "agent-core.ts"
Cohesion: 0.11
Nodes (23): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+15 more)

### Community 56 - "button.tsx"
Cohesion: 0.08
Nodes (24): Citation, Source, Version, GrantOption, RowGrantsProps, RestoreButton(), ConvertPdfButton(), CATEGORY_SUGGESTIONS (+16 more)

### Community 57 - "dossier-actions.ts"
Cohesion: 0.13
Nodes (29): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+21 more)

### Community 58 - "drive/page.tsx"
Cohesion: 0.13
Nodes (30): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, NewFolderButton(), NewOfficeButton() (+22 more)

### Community 59 - "ad-pro-item-actions.ts"
Cohesion: 0.14
Nodes (27): AdProItemsPanel(), Props, addAdProItem(), audit(), canAllocate(), canEditItems(), CONGRESS_DECIDED, deleteAdProItem() (+19 more)

### Community 60 - "message-thread.tsx"
Cohesion: 0.12
Nodes (26): MessageAttachments(), Attachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE (+18 more)

### Community 61 - "new-conversation.tsx"
Cohesion: 0.06
Nodes (19): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt (+11 more)

### Community 62 - "generate.ts"
Cohesion: 0.11
Nodes (24): DocgenPanel(), GenDoc, Template, generateDocumentAction(), scopeCompanyId(), documentXml(), esc(), MISSING_MARKER (+16 more)

### Community 63 - "workflow/engine.ts"
Cohesion: 0.12
Nodes (31): createMedicalInfoDeclaration(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), emitFinancials(), ensureInstance() (+23 more)

### Community 64 - "drive-actions.ts"
Cohesion: 0.15
Nodes (27): FileActions(), ShareItem, SharePanel(), ShareRow(), AccessSheet(), MoveTarget, NodeActions(), Props (+19 more)

### Community 65 - "features.ts"
Cohesion: 0.12
Nodes (23): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), AssistantPage(), dynamic (+15 more)

### Community 66 - "budget-forms.tsx"
Cohesion: 0.15
Nodes (27): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+19 more)

### Community 67 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 68 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 69 - "regulatory-request-actions.ts"
Cohesion: 0.15
Nodes (23): dynamic, RegulatoryRequestDetailPage(), dynamic, RegulatoryRequestsPage(), createRegRequest(), loadAccessible(), parseCategory(), parsePriority() (+15 more)

### Community 70 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (24): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+16 more)

### Community 71 - "form-fields.tsx"
Cohesion: 0.13
Nodes (20): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, StatusEditor(), UserOption, SupplierRow (+12 more)

### Community 72 - "onboarding-wizard.tsx"
Cohesion: 0.10
Nodes (20): dynamic, metadata, NoAccessPage(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER (+12 more)

### Community 73 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 74 - "validation-actions.ts"
Cohesion: 0.13
Nodes (25): RuleControls(), RuleEditor(), clearValidationItem(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule(), PRIORITIES (+17 more)

### Community 75 - "buildRef"
Cohesion: 0.14
Nodes (21): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), DirectiveLike (+13 more)

### Community 76 - "(app)/layout.tsx"
Cohesion: 0.12
Nodes (20): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+12 more)

### Community 77 - "messenger.tsx"
Cohesion: 0.14
Nodes (24): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+16 more)

### Community 78 - "explorer.ts"
Cohesion: 0.17
Nodes (21): ACTIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport (+13 more)

### Community 79 - "sectionByCode"
Cohesion: 0.13
Nodes (22): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+14 more)

### Community 80 - "admin-delete-actions.ts"
Cohesion: 0.14
Nodes (21): PermanentDeleteButton(), PurgeOrphansButton(), CorbeillePage(), dynamic, TrashItem, TrashList(), delegateOf(), DeletableKind (+13 more)

### Community 81 - "pch-tender-line-actions.ts"
Cohesion: 0.15
Nodes (23): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeMoleculeSafe() (+15 more)

### Community 82 - "departments.ts"
Cohesion: 0.14
Nodes (22): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+14 more)

### Community 83 - "queries/messaging.ts"
Cohesion: 0.15
Nodes (22): dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts(), AttachmentDTO, ConversationCore (+14 more)

### Community 84 - "calendar.ts"
Cohesion: 0.18
Nodes (22): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+14 more)

### Community 85 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 86 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 87 - "test-center/page.tsx"
Cohesion: 0.11
Nodes (20): PlatformIdeas(), DiagnosticPage(), dynamic, metadata, scoreColor(), SEV, CERT, CLEANUP (+12 more)

### Community 88 - "mon-dossier/page.tsx"
Cohesion: 0.12
Nodes (20): dynamic, MyMissionsPage(), dynamic, MonDossierPage(), MissionItem(), HrRequestThread(), HR_DOCUMENT_CATEGORY, MON_DOSSIER_TABS (+12 more)

### Community 89 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 90 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 91 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 92 - "Select"
Cohesion: 0.10
Nodes (17): Props, StatusUpdate(), BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD(), ParticipantsPanel() (+9 more)

### Community 93 - "topbar.tsx"
Cohesion: 0.13
Nodes (17): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), badgeFor() (+9 more)

### Community 94 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (22): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+14 more)

### Community 95 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 96 - "budget.ts"
Cohesion: 0.15
Nodes (17): GET(), BudgetsPage(), dynamic, PaiePage(), PayrollRow, budgetExportFilename(), BudgetHealth, BudgetMonthPoint (+9 more)

### Community 97 - "dashboard/page.tsx"
Cohesion: 0.13
Nodes (17): BudgetRow, BudgetsTable(), MONTHS, DashboardPage(), STATUS_COLORS, DonutChart(), DonutSlice, MiniBarChart() (+9 more)

### Community 98 - "budgets/page.tsx"
Cohesion: 0.15
Nodes (17): dynamic, BarRow, Bars(), COLOR, Meter(), TEXT, toneOf(), arc() (+9 more)

### Community 99 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 100 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 101 - "evidence.ts"
Cohesion: 0.13
Nodes (18): base, Certification, CertificationInput, CertificationResult, BETTER, classify(), Diff, DiffClass (+10 more)

### Community 102 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 103 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (17): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+9 more)

### Community 104 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 105 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (18): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+10 more)

### Community 106 - "meetings.ts"
Cohesion: 0.19
Nodes (15): MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin(), canManageMeeting(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 107 - "pch-tender-export.ts"
Cohesion: 0.17
Nodes (14): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+6 more)

### Community 108 - "congress-request-actions.ts"
Cohesion: 0.39
Nodes (18): cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES, fdList(), finalDecision(), loadCongress() (+10 more)

### Community 109 - "access-actions.ts"
Cohesion: 0.24
Nodes (16): ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm(), adminResetPassword(), requestOnboarding(), requireAdmin() (+8 more)

### Community 110 - "zip-viewer.tsx"
Cohesion: 0.18
Nodes (12): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+4 more)

### Community 111 - "field-report-actions.ts"
Cohesion: 0.23
Nodes (16): ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment() (+8 more)

### Community 112 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 113 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 114 - "auth.ts"
Cohesion: 0.21
Nodes (11): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+3 more)

### Community 115 - "department-actions.ts"
Cohesion: 0.26
Nodes (16): DepartmentsManager(), DeptSheet(), UnassignedPanel(), useRun(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName() (+8 more)

### Community 116 - "document-preview.tsx"
Cohesion: 0.21
Nodes (12): DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, NotificationPopup(), Popup (+4 more)

### Community 117 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 118 - "office-templates.ts"
Cohesion: 0.20
Nodes (13): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+5 more)

### Community 119 - "meeting-actions.ts"
Cohesion: 0.29
Nodes (13): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+5 more)

### Community 120 - "auth-actions.ts"
Cohesion: 0.19
Nodes (7): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, authenticate(), changePassword()

### Community 121 - "compare-versions.ts"
Cohesion: 0.20
Nodes (11): buildVersionDiff(), DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry (+3 more)

### Community 122 - "access/page.tsx"
Cohesion: 0.15
Nodes (13): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AdminUserPage() (+5 more)

### Community 123 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 124 - "supplier-portal-actions.ts"
Cohesion: 0.25
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 125 - "messaging/messages/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+1 more)

### Community 126 - "push.ts"
Cohesion: 0.29
Nodes (11): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+3 more)

### Community 127 - "users/[id]/page.tsx"
Cohesion: 0.18
Nodes (11): AccessMatrix(), ModuleAccessRow, ImpersonateButton(), ACTION_FR, ROW_SCOPED, RowGrants(), deviceIcon(), SessionItem (+3 more)

### Community 128 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 129 - "event-actions.ts"
Cohesion: 0.27
Nodes (12): EditEventButton(), RegistrationsManager(), addRegistration(), checkInByToken(), createEvent(), deleteEvent(), deleteRegistration(), inEnum() (+4 more)

### Community 130 - "lib/messaging.ts"
Cohesion: 0.22
Nodes (11): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+3 more)

### Community 131 - "stock-snapshot-actions.ts"
Cohesion: 0.24
Nodes (12): StocksView(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot() (+4 more)

### Community 132 - "today.ts"
Cohesion: 0.22
Nodes (10): CalendarEventDTO, greetingFor(), rankToday(), reasonOf(), REASONS, score(), day(), NOW (+2 more)

### Community 133 - "reglages/page.tsx"
Cohesion: 0.30
Nodes (9): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetSettingsPage(), dynamic, BUDGET_TABS, BudgetEnvelopeOption, getEnvelopes() (+1 more)

### Community 134 - "field-reports.ts"
Cohesion: 0.20
Nodes (9): dynamic, FieldReportPage(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem, FieldReportsOverview, getFieldReportDetail(), MONTHS_FR (+1 more)

### Community 135 - "hr-dossier.tsx"
Cohesion: 0.24
Nodes (9): CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), HrDossier(), REQ_TO_CAT, MeetingControls(), deleteHrRequest() (+1 more)

### Community 136 - "assistant-files.ts"
Cohesion: 0.26
Nodes (8): resolveAttachment(), withAttachmentContext(), AttachmentText, buildAttachmentContext(), cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 137 - "workflow-panel.tsx"
Cohesion: 0.25
Nodes (9): EventFundingPanel(), PmOpt, Props, SubmitButton(), rolesText(), STATUS_TONE, WorkflowPanel(), BudgetCategoryOption (+1 more)

### Community 138 - "panels.tsx"
Cohesion: 0.29
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+1 more)

### Community 139 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 140 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 141 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 142 - "molecule-panel.tsx"
Cohesion: 0.33
Nodes (7): fmtDzd(), FoundList(), MoleculePanel(), foldTail(), seriesColor(), analyzeMarketMolecule(), asForm()

### Community 143 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 144 - "budget-export.test.ts"
Cohesion: 0.29
Nodes (7): buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView, EnvelopesGrandTotal

### Community 145 - "data.ts"
Cohesion: 0.20
Nodes (9): Cache, DIR, LabRow, loadNdjson(), MarketMeta, NomRow, PchRow, SRC_IQVIA (+1 more)

### Community 146 - "scheduled.ts"
Cohesion: 0.36
Nodes (9): getBatchStatus(), pollAiBatches(), pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications() (+1 more)

### Community 147 - "org-chart-editor.tsx"
Cohesion: 0.39
Nodes (6): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace(), saveOrgPosition()

### Community 148 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), Row, Section(), STATUS

### Community 149 - "stocks-view.tsx"
Cohesion: 0.22
Nodes (8): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, TabKey, TABS, todayInput(), UserOpt

### Community 150 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 151 - "validation-item-review.tsx"
Cohesion: 0.32
Nodes (7): Decision, ItemReview(), LABEL, pill(), TONE, ITEM_DECISIONS, reviewValidationItem()

### Community 152 - "mobile-tabbar.tsx"
Cohesion: 0.46
Nodes (6): ChromeMetrics(), usePublishedHeight(), useTabBarHeight(), isActive(), MobileTabBar(), PRIMARY

### Community 153 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 154 - "login-throttle.ts"
Cohesion: 0.39
Nodes (6): checkLockout(), clearAttempts(), FailureResult, LockState, MAX_FAILURES, recordFailure()

### Community 155 - "calendar-view.tsx"
Cohesion: 0.33
Nodes (5): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS

### Community 156 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 157 - "visits-table.tsx"
Cohesion: 0.29
Nodes (6): DeleteVisitButton(), EditVisitSheet(), Opt, Result, VisitRow, VisitsTable()

### Community 158 - "meeting-chat.tsx"
Cohesion: 0.33
Nodes (6): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), deleteMeetingMessage()

### Community 159 - "feature-actions.ts"
Cohesion: 0.38
Nodes (6): requireAdmin(), setFeatureStage(), Stage, STAGE_LABEL, STAGES, toggleMyTestMode()

### Community 160 - "defaults.ts"
Cohesion: 0.33
Nodes (6): DefinitionAdminView, defaultDefinition(), defaultSpine(), CATEGORY_LABELS, StepInput, WorkflowCategory

### Community 161 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 162 - "courses-board.tsx"
Cohesion: 0.47
Nodes (5): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt

### Community 163 - "event-form.tsx"
Cohesion: 0.40
Nodes (4): CreateEventButton(), d10(), EventFields(), Result

### Community 164 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 165 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 166 - "postDriveComment"
Cohesion: 0.60
Nodes (4): DriveCommentItem, DriveComments(), deleteDriveComment(), postDriveComment()

### Community 167 - "payroll-matrix.tsx"
Cohesion: 0.50
Nodes (4): MONTHS, PayrollCell, PayrollMatrix(), ym()

### Community 168 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 169 - "geo.ts"
Cohesion: 0.60
Nodes (4): enrichSessionGeo(), GeoInfo, geolocate(), isPrivate()

### Community 170 - "events/[id]/export/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, esc(), GET()

### Community 171 - "workflows/page.tsx"
Cohesion: 0.67
Nodes (3): AdminWorkflowsPage(), dynamic, getWorkflowDefinitions()

## Knowledge Gaps
- **1110 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `card.tsx`, `hasGlobalView`, `userCan`, `lib/labels.ts`, `badge.tsx`, `brain-cockpit.tsx`, `regulatory-actions.ts`, `utils.ts`, `rbac.ts`, `mail.ts`, `requireUser`, `notifyUser`, `formatCurrency`, `getCurrentUser`, `getCompanyScope`, `fdStr`, `[dossierId]/page.tsx`, `batch-runner.ts`, `rules/engine.ts`, `corpus-actions.ts`, `pilotage/page.tsx`, `ocr-engine.ts`, `formatDate`, `jobs/runner.ts`, `assistant-actions.ts`, `care-actions.ts`, `upload/session.ts`, `aiConfigured`, `requireModule`, `test-center/runner.ts`, `promo-material-actions.ts`, `library-actions.ts`, `regCan`, `medical-directory.tsx`, `entity-access.ts`, `market-research.ts`, `assistant.ts`, `process-intelligence.ts`, `onlyoffice.ts`, `ingest-dossier.ts`, `lib/ai.ts`, `adoption.ts`, `platform-audit/engine.ts`, `getBlob`, `build-facts.ts`, `sales-planning-actions.ts`, `messaging-actions.ts`, `agent-core.ts`, `dossier-actions.ts`, `drive/page.tsx`, `ad-pro-item-actions.ts`, `generate.ts`, `workflow/engine.ts`, `drive-actions.ts`, `features.ts`, `workflow-builder.tsx`, `regulatory-request-actions.ts`, `bd-strategic-table.tsx`, `onboarding-wizard.tsx`, `smart-mail-actions.ts`, `validation-actions.ts`, `buildRef`, `(app)/layout.tsx`, `explorer.ts`, `admin-delete-actions.ts`, `pch-tender-line-actions.ts`, `departments.ts`, `queries/messaging.ts`, `calendar.ts`, `lifecycle/actions.ts`, `migration-cert.ts`, `mon-dossier/page.tsx`, `supplier/actions.ts`, `budget-envelope-actions.ts`, `invariants/registry.ts`, `budget.ts`, `admin-settings-forms.tsx`, `meetings/[id]/page.tsx`, `market-research-actions.ts`, `meetings.ts`, `congress-request-actions.ts`, `access-actions.ts`, `field-report-actions.ts`, `run.ts`, `support-actions.ts`, `auth.ts`, `department-actions.ts`, `pch.ts`, `meeting-actions.ts`, `auth-actions.ts`, `compare-versions.ts`, `access/page.tsx`, `supplier-portal-actions.ts`, `push.ts`, `users/[id]/page.tsx`, `event-actions.ts`, `lib/messaging.ts`, `stock-snapshot-actions.ts`, `reglages/page.tsx`, `field-reports.ts`, `reminder-actions.ts`, `regulatory-drive-mirror.ts`, `scheduled.ts`, `meetings/page.tsx`, `login-throttle.ts`, `feature-actions.ts`, `[token]/route.ts`, `geo.ts`, `events/[id]/export/route.ts`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `hasGlobalView`, `userCan`, `event-actions.ts`, `badge.tsx`, `prisma.ts`, `brain-cockpit.tsx`, `hr-dossier.tsx`, `lib/messaging.ts`, `rbac.ts`, `mail.ts`, `regulatory-actions.ts`, `notifyUser`, `reminder-actions.ts`, `getCurrentUser`, `molecule-panel.tsx`, `getCompanyScope`, `fdStr`, `org-chart-editor.tsx`, `stock-snapshot-actions.ts`, `corpus-actions.ts`, `rules/engine.ts`, `validation-item-review.tsx`, `aiConfigured`, `assistant-actions.ts`, `care-actions.ts`, `meeting-chat.tsx`, `feature-actions.ts`, `requireModule`, `promo-material-actions.ts`, `test-center/runner.ts`, `regCan`, `medical-directory.tsx`, `entity-access.ts`, `postDriveComment`, `molecule.ts`, `library-actions.ts`, `process-intelligence.ts`, `onlyoffice.ts`, `lib/ai.ts`, `platform-audit/engine.ts`, `product-explorer.tsx`, `sales-planning-actions.ts`, `market/engine.ts`, `messaging-actions.ts`, `dossier-actions.ts`, `ad-pro-item-actions.ts`, `generate.ts`, `drive-actions.ts`, `features.ts`, `workflow-builder.tsx`, `regulatory-request-actions.ts`, `onboarding-wizard.tsx`, `smart-mail-actions.ts`, `validation-actions.ts`, `buildRef`, `(app)/layout.tsx`, `messenger.tsx`, `admin-delete-actions.ts`, `pch-tender-line-actions.ts`, `lifecycle/actions.ts`, `mon-dossier/page.tsx`, `supplier/actions.ts`, `topbar.tsx`, `budget-envelope-actions.ts`, `mail-client.tsx`, `market-research-actions.ts`, `congress-request-actions.ts`, `access-actions.ts`, `field-report-actions.ts`, `run.ts`, `support-actions.ts`, `department-actions.ts`, `meeting-actions.ts`, `auth-actions.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `card.tsx`, `hasGlobalView`, `event-actions.ts`, `lib/labels.ts`, `badge.tsx`, `prisma.ts`, `brain-cockpit.tsx`, `regulatory-actions.ts`, `utils.ts`, `hr-dossier.tsx`, `mail.ts`, `requireUser`, `notifyUser`, `formatCurrency`, `getCurrentUser`, `molecule-panel.tsx`, `rbac.ts`, `fdStr`, `reminder-actions.ts`, `stock-snapshot-actions.ts`, `pilotage/page.tsx`, `formatDate`, `assistant-actions.ts`, `care-actions.ts`, `requireModule`, `promo-material-actions.ts`, `medical-directory.tsx`, `entity-access.ts`, `molecule.ts`, `market-research.ts`, `assistant.ts`, `process-intelligence.ts`, `events/[id]/export/route.ts`, `onlyoffice.ts`, `lib/ai.ts`, `adoption.ts`, `getBlob`, `product-explorer.tsx`, `sales-planning-actions.ts`, `market/engine.ts`, `messaging-actions.ts`, `dossier-actions.ts`, `drive/page.tsx`, `ad-pro-item-actions.ts`, `drive-actions.ts`, `regulatory-request-actions.ts`, `validation-actions.ts`, `buildRef`, `(app)/layout.tsx`, `pch-tender-line-actions.ts`, `departments.ts`, `queries/messaging.ts`, `calendar.ts`, `test-center/page.tsx`, `budget-envelope-actions.ts`, `budget.ts`, `dashboard/page.tsx`, `mail-client.tsx`, `market-research-actions.ts`, `pch-tender-export.ts`, `congress-request-actions.ts`, `access-actions.ts`, `field-report-actions.ts`, `support-actions.ts`, `department-actions.ts`, `meeting-actions.ts`, `messaging/messages/route.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.03943278943278943 - nodes in this community are weakly interconnected._
- **Should `hasGlobalView` be split into smaller, more focused modules?**
  _Cohesion score 0.041979010494752625 - nodes in this community are weakly interconnected._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.05998835177635411 - nodes in this community are weakly interconnected._