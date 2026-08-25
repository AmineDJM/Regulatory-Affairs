# Graph Report - src  (2026-08-25)

## Corpus Check
- 1400 files · ~1,175,366 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 8600 nodes · 33765 edges · 253 communities (245 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 182 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2433c30`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- hasGlobalView
- button.tsx
- card.tsx
- lib/labels.ts
- notifyUser
- lib/session.ts
- recordAudit
- requireUser
- requireModule
- lib/ai.ts
- userCan
- regCan
- prisma.ts
- aiConfigured
- promo-material-actions.ts
- taches/[id]/page.tsx
- batch-runner.ts
- recrutement/[id]/page.tsx
- rbac.ts
- getCurrentUser
- formatDateTime
- brain-cockpit.tsx
- admin-request-actions.ts
- assistant.ts
- build-facts.ts
- corpus/actions.ts
- OpenAIGptRealtime21Provider
- fdStr
- (app)/layout.tsx
- corpus-actions.ts
- rules/engine.ts
- mail.ts
- [dossierId]/page.tsx
- jobs/runner.ts
- payment-request-actions.ts
- legal/[id]/page.tsx
- src/auth.ts
- sponsoring/page.tsx
- regulatory/[id]/page.tsx
- FindingInput
- pilotage/page.tsx
- ad-pro-item-actions.ts
- care-actions.ts
- storage.ts
- formatDate
- executive-tools.ts
- back-link.tsx
- hr-document-actions.ts
- regulatory-workflow.ts
- agent-core.ts
- oauth.ts
- lib/department-budget.ts
- directory-grid.ts
- admin-settings-forms.tsx
- reserves/page.tsx
- upload/session.ts
- mistral-ocr.ts
- test-center/runner.ts
- drive-actions.ts
- ROLE_LABELS
- letterhead-manager.tsx
- training-board.tsx
- regulatory-actions.ts
- ocr-engine.ts
- enregistrement/page.tsx
- market-research.ts
- (app)/validations/page.tsx
- voice-realtime.ts
- adoption.ts
- regAudit
- performAction
- platform-audit/engine.ts
- document-discovery.ts
- test-center/page.tsx
- mon-espace/page.tsx
- sales-planning-actions.ts
- object-storage.ts
- settings.ts
- lib/drive.ts
- office-supply-actions.ts
- users/[id]/page.tsx
- graph/provider.ts
- queries/messaging.ts
- dossier-actions.ts
- stock-board.tsx
- petty-cash-actions.ts
- new-request-picker.tsx
- ranges-manager.tsx
- centre-board.tsx
- market/engine.ts
- budget-forms.tsx
- products.ts
- upload-manager.tsx
- rag.ts
- releaseBlob
- entities.ts
- bd-strategic-table.tsx
- medical-info-actions.ts
- microsoft-mail-actions.ts
- messaging-actions.ts
- payment-authority.ts
- workflow/engine.ts
- workflow-builder.tsx
- drive-table.tsx
- competition.ts
- expense-row-actions.tsx
- document-request-actions.ts
- smart-mail-actions.ts
- drive-storage.ts
- purchase-request-actions.ts
- executive-brief-tools.ts
- client.ts
- scheduled.ts
- lifecycle/actions.ts
- reports.ts
- regulatory-table.tsx
- classify.ts
- state-machines/explorer.ts
- calendar.ts
- composer.tsx
- regulatory/page.tsx
- extract-text.ts
- zip-inspector.ts
- migration-cert.ts
- connection.ts
- regulatory/export/route.ts
- form-fields.tsx
- molecule.ts
- messenger.tsx
- progress/query.ts
- supplier/actions.ts
- company.ts
- sheet-import.ts
- moyens-generaux/page.tsx
- portfolio.ts
- pch-tender-line-actions.ts
- update-reminder.ts
- library-ingest.ts
- ocrDocument
- invariants/registry.ts
- openapi.ts
- budgets/page.tsx
- mail-client.tsx
- product-catalog.ts
- payroll-hr-actions.ts
- drive-search.ts
- reply.ts
- write.ts
- document-preview.tsx
- molecule-panel.tsx
- chain-card.tsx
- identity-board.tsx
- department-budget-actions.ts
- http.ts
- org-chart-print.ts
- calendar-view.tsx
- drive/explorer.ts
- meetings/[id]/page.tsx
- meetings.ts
- run.ts
- budget-general-means.integration.test.ts
- legal/lifecycle.ts
- consulting-actions.ts
- demandes/new-request.tsx
- workspace.tsx
- invoice-actions.ts
- directive-actions.ts
- message-thread.tsx
- stand-in.ts
- departments.ts
- objectStorageConfigured
- errors.ts
- tender-lines.tsx
- action-intents.ts
- MicrosoftGraphMailProvider
- features.ts
- consulting/[id]/page.tsx
- field-report-actions.ts
- meeting-actions.ts
- expense-lines.ts
- support/[id]/page.tsx
- wilaya.ts
- process-intelligence.ts
- rh/upload/route.ts
- radar.ts
- lib/messaging.ts
- office-launcher.tsx
- department-actions.ts
- onboarding-wizard.tsx
- MailProvider
- s3-config.ts
- budgets/export/route.ts
- pch/export/route.ts
- upload-button.tsx
- contacts-board.tsx
- operations.ts
- today.ts
- simple-pdf.ts
- search-everything.ts
- messaging/messages/route.ts
- supplier-auth.ts
- background-upload.tsx
- push.ts
- accessibleModules
- file-glyph.tsx
- stock-snapshot-actions.ts
- reminder-actions.ts
- budget.ts
- ai-health.ts
- congress-workflow.tsx
- meeting-chat.tsx
- meetings/page.tsx
- mail-actions.ts
- payroll-cost.ts
- grouping.ts
- departments-manager.tsx
- assistant-files.ts
- auto-category.ts
- Adventum Autonomous Test Center — architecture
- zip-viewer.tsx
- bars.tsx
- client-bundle-guard.test.ts
- readers.ts
- ENTITIES
- [operation]/route.ts
- push-register.tsx
- [token]/route.ts
- bv-requests.tsx
- employee-form.tsx
- validation-item-review.tsx
- messages-indicator.tsx
- menu-portal-guard.test.ts
- responsive-guard.test.ts
- next-auth.d.ts
- app/layout.tsx
- notification-chime.tsx
- FolderLite
- validation-decision.tsx
- (app)/courrier/page.tsx
- NewRequestButton
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 821 edges
2. `userCan()` - 638 edges
3. `fdStr()` - 608 edges
4. `recordAudit()` - 562 edges
5. `prisma` - 533 edges
6. `requireModule()` - 262 edges
7. `hasGlobalView()` - 223 edges
8. `Button` - 200 edges
9. `cn()` - 185 edges
10. `toNumber()` - 185 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `buildFolderTree()` --indirect_call--> `node()`  [INFERRED]
  src/lib/legal/folders.ts → src/lib/org-chart-print.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts

## Import Cycles
- None detected.

## Communities (253 total, 8 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.05
Nodes (122): dynamic, ModuleSpec, dynamic, DriveStorageSettings(), TYPES, StoragePanel(), ACTION_COLS, dynamic (+114 more)

### Community 1 - "hasGlobalView"
Cohesion: 0.04
Nodes (126): CONGRESS_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage(), DemandesPage(), EventFundingPanel(), PmOpt, Props (+118 more)

### Community 2 - "button.tsx"
Cohesion: 0.04
Nodes (80): PALETTE, OrgBranch(), ENV_LABEL, MODES, GrantOption, RowGrantsProps, Profile, Option (+72 more)

### Community 3 - "card.tsx"
Cohesion: 0.03
Nodes (89): dynamic, ActivityPage(), fmtDuration(), dynamic, metadata, AiSettings, AiSettingsForm(), FeatureKey (+81 more)

### Community 4 - "lib/labels.ts"
Cohesion: 0.03
Nodes (106): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FocusCard(), BudgetRow (+98 more)

### Community 5 - "notifyUser"
Cohesion: 0.05
Nodes (107): OtherDecisionPanel(), TrainingBoard(), SupportActions(), SupportMessageForm(), useAction(), audit(), closeAdProOtherRequest(), createAdProOtherRequest() (+99 more)

### Community 6 - "lib/session.ts"
Cohesion: 0.04
Nodes (58): Target, ClaudeToolDef, clean(), DELIVERABLE_FORMATS, DELIVERABLE_TOOLS, DeliverableFormat, DeliverableSection, DeliverableSpec (+50 more)

### Community 7 - "recordAudit"
Cohesion: 0.04
Nodes (87): PermanentDeleteButton(), PurgeOrphansButton(), EntitiesManager(), ImpersonateButton(), SpaceSettingsButton(), adminResetPassword(), requestOnboarding(), requireAdmin() (+79 more)

### Community 8 - "requireUser"
Cohesion: 0.04
Nodes (100): ActiveToggle(), AnnuaireGrid(), CREATOR_DELETABLE, CREATOR_DELETE_PERMISSION, delegateOf(), DeletableKind, deleteOwnRecord(), DeleteResult (+92 more)

### Community 9 - "requireModule"
Cohesion: 0.04
Nodes (88): AdProOtherDetailPage(), AdProOtherPage(), GammesPage(), AdminPage(), fmtBytes(), fmtWhen(), AdminValidationsPage(), dec() (+80 more)

### Community 10 - "lib/ai.ts"
Cohesion: 0.05
Nodes (86): DossierChatPanel(), Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiModel(), aiSelfTest(), AiTextResult (+78 more)

### Community 11 - "userCan"
Cohesion: 0.06
Nodes (90): POST(), EditEventButton(), CheckinConfirm(), RegistrationsManager(), saveAdoptionSettings(), updateRiskThresholds(), updateAiSettings(), createBD() (+82 more)

### Community 12 - "regCan"
Cohesion: 0.05
Nodes (76): dynamic, GET(), INLINE_MIME, runtime, GET(), dynamic, maxDuration, POST() (+68 more)

### Community 13 - "prisma.ts"
Cohesion: 0.04
Nodes (41): dynamic, runtime, CheckinPage(), dynamic, CataloguePage(), dynamic, StocksPage(), SnapshotDTO (+33 more)

### Community 14 - "aiConfigured"
Cohesion: 0.06
Nodes (70): dynamic, maxDuration, runtime, AiControlCenterPage(), ActionState, AssistantChat(), cleanReply(), DriveFilePicker() (+62 more)

### Community 15 - "promo-material-actions.ts"
Cohesion: 0.08
Nodes (73): PromoCircuitCard(), Props, useRun(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun() (+65 more)

### Community 16 - "taches/[id]/page.tsx"
Cohesion: 0.06
Nodes (68): POST(), DocumentEditPage(), dynamic, ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage() (+60 more)

### Community 17 - "batch-runner.ts"
Cohesion: 0.05
Nodes (73): BATCH_MULTIPLIER, BatchOutcome, BatchRequest, BatchStatus, BatchSubmitResult, buildBatchJsonl(), buildBatchLine(), buildLunaBody() (+65 more)

### Community 18 - "recrutement/[id]/page.tsx"
Cohesion: 0.07
Nodes (73): APPROVAL_ICON, APPROVAL_TEXT, DOC_CATEGORIES, dynamic, RecruitmentPage(), AddCandidateButton(), AnswerInfoForm(), CancelRequestButton() (+65 more)

### Community 19 - "rbac.ts"
Cohesion: 0.04
Nodes (71): GET(), SearchPage(), isRequestOwner(), activeStandInsFor(), standInForUserIds(), startOfDay(), NAV_LEGACY_LABELS, addDays() (+63 more)

### Community 20 - "getCurrentUser"
Cohesion: 0.05
Nodes (59): dynamic, GET(), dynamic, POST(), dynamic, POST(), dynamic, POST() (+51 more)

### Community 21 - "formatDateTime"
Cohesion: 0.06
Nodes (66): AdminSuppliersPage(), DocumentRow, DocumentsTable(), DocumentsPage(), DOSSIER_DOC_CATEGORIES, DossierDetailPage(), dynamic, DossierMessageItem() (+58 more)

### Community 22 - "brain-cockpit.tsx"
Cohesion: 0.04
Nodes (66): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+58 more)

### Community 23 - "admin-request-actions.ts"
Cohesion: 0.04
Nodes (73): RuleControls(), RuleEditor(), letter(), MissionStops(), StopDTO, AttachmentValidationBlock(), PAYABLE_CATEGORIES, STATUS_BADGES (+65 more)

### Community 24 - "assistant.ts"
Cohesion: 0.05
Nodes (71): ACTION_POLICY, activeUserId(), describeChange(), parseRegFieldValue(), ParseResult, parseSettingValue(), regFieldSpec, renderSettingValue() (+63 more)

### Community 25 - "build-facts.ts"
Cohesion: 0.06
Nodes (59): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+51 more)

### Community 26 - "corpus/actions.ts"
Cohesion: 0.06
Nodes (52): Citation, CorpusAdmin(), Source, Version, ACCEPT, AUTHORITIES, CATEGORIES, CorpusImport() (+44 more)

### Community 27 - "OpenAIGptRealtime21Provider"
Cohesion: 0.06
Nodes (33): OpenAIGptRealtime21Provider, PendingDelivery, ProviderOptions, RealtimeEvent, VoiceCallState, VoiceProviderCallbacks, VoiceRealtimeProvider, VoiceSessionGrant (+25 more)

### Community 28 - "fdStr"
Cohesion: 0.06
Nodes (62): PresentationCard(), Res, nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL (+54 more)

### Community 29 - "(app)/layout.tsx"
Cohesion: 0.06
Nodes (49): AppLayout(), ActivityTracker(), Geo, send(), UAData, ChromeMetrics(), usePublishedHeight(), useTabBarHeight() (+41 more)

### Community 30 - "corpus-actions.ts"
Cohesion: 0.06
Nodes (59): CorpusPanel(), IngestResults, Src, WatchFindings, ANPP_WATCH_PAGES, BINDING, CATALOG, CatalogSource (+51 more)

### Community 31 - "rules/engine.ts"
Cohesion: 0.06
Nodes (53): KIND_LABEL, Pack, Rule, RulePacksAdmin(), codeToken(), detectContainedSections(), DetectedSection, STOP (+45 more)

### Community 32 - "mail.ts"
Cohesion: 0.05
Nodes (62): dynamic, GET(), dynamic, GET(), dynamic, GET(), acquirePooled(), acquireSlot() (+54 more)

### Community 33 - "[dossierId]/page.tsx"
Cohesion: 0.06
Nodes (55): ApproveNameButton(), DeleteDossierButton(), DossierDetailPage(), dynamic, FindingEvidence(), FindingRow, fmtDateTime(), INLINE_EXT (+47 more)

### Community 34 - "jobs/runner.ts"
Cohesion: 0.07
Nodes (59): reviewDocumentText(), detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES (+51 more)

### Community 35 - "payment-request-actions.ts"
Cohesion: 0.09
Nodes (56): AddPiece(), EVENT_LABEL, EventView, PaymentDossier(), PieceCard(), PieceView, Runner, dynamic (+48 more)

### Community 36 - "legal/[id]/page.tsx"
Cohesion: 0.08
Nodes (47): dynamic, MAIL_DOC_CATEGORIES, MailEntryPage(), dateInput(), dateTimeInput(), mailFields(), MailFolderBar(), DateCell() (+39 more)

### Community 37 - "src/auth.ts"
Cohesion: 0.07
Nodes (45): NO_CONTENT, POST(), NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), asCaptured() (+37 more)

### Community 38 - "sponsoring/page.tsx"
Cohesion: 0.09
Nodes (46): AdProList(), EMPTY, Filters, AdProPage(), dynamic, CongressTable(), CongressInternationalPage(), CongressNationalPage() (+38 more)

### Community 39 - "regulatory/[id]/page.tsx"
Cohesion: 0.06
Nodes (44): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, BD_DOC_CATEGORIES, BdProjectDetailPage(), PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES (+36 more)

### Community 40 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 41 - "pilotage/page.tsx"
Cohesion: 0.08
Nodes (47): Assign, AssignmentMatrix(), Kam, key(), nOr0(), Prod, AffectationsPage(), dynamic (+39 more)

### Community 42 - "ad-pro-item-actions.ts"
Cohesion: 0.11
Nodes (49): AdProItemsPanel(), EditItemForm(), ItemLifecycle(), ItemRow, PARENT_PATH, Props, addAdProItem(), AdProModule (+41 more)

### Community 43 - "care-actions.ts"
Cohesion: 0.12
Nodes (47): BeneficiaryRow, CarePanel(), CellRow, Props, QuoteRow, addCareBeneficiary(), addCareCell(), audit() (+39 more)

### Community 44 - "storage.ts"
Cohesion: 0.06
Nodes (39): GET(), dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET() (+31 more)

### Community 45 - "formatDate"
Cohesion: 0.06
Nodes (46): MarketResearchListPage(), dzd(), fmtPct(), MarketPricingPage(), StatBlock(), ExpenseAckItem, ExpenseAckList(), NewRequestButton() (+38 more)

### Community 46 - "executive-tools.ts"
Cohesion: 0.06
Nodes (40): excerptAround(), tokensOf(), daysSince(), paymentExecutiveState(), PaymentStateInput, RegStepInput, regulatoryExecutiveState(), RegulatoryStateInput (+32 more)

### Community 47 - "back-link.tsx"
Cohesion: 0.06
Nodes (39): CorbeillePage(), dynamic, TrashItem, TrashList(), EntityRow, OrphansPanel(), dynamic, EntitesPage() (+31 more)

### Community 48 - "hr-document-actions.ts"
Cohesion: 0.08
Nodes (50): RequestRow(), createMission(), analyzeEmployeeContract(), cancelAdvance(), cancelLeave(), CONTRACT_TYPES_UP, daysBetween(), decideLeave() (+42 more)

### Community 49 - "regulatory-workflow.ts"
Cohesion: 0.08
Nodes (48): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), AvailableAction (+40 more)

### Community 50 - "agent-core.ts"
Cohesion: 0.08
Nodes (35): AgentItem, AgentsPanel(), RunState, extractJson(), listApplicableAgents(), runAgentAction(), scopeCompanyId(), AgentDoc (+27 more)

### Community 51 - "oauth.ts"
Cohesion: 0.09
Nodes (40): dynamic, GET(), logFailure(), Stage, dynamic, GET(), DisconnectButton(), dynamic (+32 more)

### Community 52 - "lib/department-budget.ts"
Cohesion: 0.10
Nodes (43): DepartmentAccessSheet(), AmountCell(), DepartmentBudgetTable(), ExpenseForm(), RequestForm(), RequestList(), DepartmentBudgetsPage(), dynamic (+35 more)

### Community 53 - "directory-grid.ts"
Cohesion: 0.09
Nodes (40): GET(), AddDoctorRow(), GridTable(), SelectCell, TextCell, MEDICAL_SECTOR, SEGMENT_LEVEL, ANNUAIRE_COLUMNS (+32 more)

### Community 54 - "admin-settings-forms.tsx"
Cohesion: 0.07
Nodes (42): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), HiddenModulesForm() (+34 more)

### Community 55 - "reserves/page.tsx"
Cohesion: 0.08
Nodes (39): dynamic, metadata, PrecedentSearch(), ReserveLibraryPanel(), Risk, Similar, RegScopeCard(), enrichFinding() (+31 more)

### Community 56 - "upload/session.ts"
Cohesion: 0.08
Nodes (40): dynamic, runtime, IngestResult, buildMessyDossierZip(), makeDocx(), makePng(), makeXlsx(), uploadViaSession() (+32 more)

### Community 57 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (36): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+28 more)

### Community 58 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (36): LaunchPanel(), MODES, PHASE1_MODES, runTestCenter(), base, Certification, CertificationInput, CertificationResult (+28 more)

### Community 59 - "drive-actions.ts"
Cohesion: 0.10
Nodes (36): ConvertPdfButton(), DriveCommentItem, FileActions(), humanSize(), ShareItem, SharePanel(), ShareRow(), AccessSheet() (+28 more)

### Community 60 - "ROLE_LABELS"
Cohesion: 0.05
Nodes (24): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ROLE_OPTIONS, UserOpt, CreateSpaceButton(), ROLE_ENTRIES (+16 more)

### Community 61 - "letterhead-manager.tsx"
Cohesion: 0.10
Nodes (34): TYPES, EditSheet(), IconAction(), KINDS, LetterheadManager(), UploadSheet(), ChoiceTile(), LetterheadChoice() (+26 more)

### Community 62 - "training-board.tsx"
Cohesion: 0.09
Nodes (36): TrainingParticipantRow, TrainingRow, applyChainDecision(), canDecideChain(), CHAIN_STAGE_LABELS, ChainDecider, ChainStage, ChainState (+28 more)

### Community 63 - "regulatory-actions.ts"
Cohesion: 0.09
Nodes (36): StatusEditor(), createRegulatoryProduct(), ensureRegSupervisor(), guardStructural(), normalizeDci(), notifyCarrierOfStructural(), parseProductChannel(), regSupervisorRoles() (+28 more)

### Community 64 - "ocr-engine.ts"
Cohesion: 0.10
Nodes (37): anchorEvidence(), buildPagedContent(), PAGE_SEPARATOR, pageAtOffset(), pageSpanOfSlice(), squash(), defaultOcrLangs(), ensureLangData() (+29 more)

### Community 65 - "enregistrement/page.tsx"
Cohesion: 0.08
Nodes (35): CorpusPage(), dynamic, metadata, SourceRow(), SourceWithVersion, dynamic, metadata, TrainingPage() (+27 more)

### Community 66 - "market-research.ts"
Cohesion: 0.09
Nodes (35): GET(), GET(), MarketResearchDetailPage(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum() (+27 more)

### Community 67 - "(app)/validations/page.tsx"
Cohesion: 0.10
Nodes (35): MyRequestCard(), NewPaymentButton(), SupervisionBoard(), VALIDATION_MODE, VALIDATION_STATUS, VALIDATION_STEP_STATE, financeRecipients(), CONG_STAGE (+27 more)

### Community 68 - "voice-realtime.ts"
Cohesion: 0.09
Nodes (33): dynamic, EVENTS, POST(), runtime, dynamic, POST(), runtime, dynamic (+25 more)

### Community 69 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 70 - "regAudit"
Cohesion: 0.11
Nodes (32): FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue, Fact (+24 more)

### Community 71 - "performAction"
Cohesion: 0.10
Nodes (36): MailPieces(), AttachToSourceButtons(), executeAssistantAction(), attachDriveNodeToLegal(), cancelLegalDocument(), checkChainFrom(), createLegalDocument(), deleteLegalDocument() (+28 more)

### Community 72 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (34): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+26 more)

### Community 73 - "document-discovery.ts"
Cohesion: 0.10
Nodes (26): DOCUMENT_DISCOVERY_TOOLS, ensureNodeIndexed(), Finding, NodeText, classifyDocument(), DOC_KIND_LABEL, DocKind, fold() (+18 more)

### Community 74 - "test-center/page.tsx"
Cohesion: 0.08
Nodes (31): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+23 more)

### Community 75 - "mon-espace/page.tsx"
Cohesion: 0.09
Nodes (32): dynamic, MonDossierPage(), AdvanceItem, MyAdvances(), MonEspacePage(), PendingLeave, LeaveRequestButton(), LeaveItem (+24 more)

### Community 76 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 77 - "object-storage.ts"
Cohesion: 0.13
Nodes (36): RFC-3986, abortMultipartUpload(), amzDate(), completeMultipartUpload(), config(), createMultipartUpload(), _deriveSigningKeyHex(), EMPTY_SHA256 (+28 more)

### Community 78 - "settings.ts"
Cohesion: 0.12
Nodes (27): POST(), AttachResult, PersistDocInput, persistUploadedDocument(), mirrorDocumentsToDrive(), MirrorFile, referenceFieldFor(), resolveReference() (+19 more)

### Community 79 - "lib/drive.ts"
Cohesion: 0.11
Nodes (22): mimeOf(), POST(), POST(), DriveMultiViewPage(), dynamic, OpenDoc, effectiveSpaceId(), fileKind() (+14 more)

### Community 80 - "office-supply-actions.ts"
Cohesion: 0.14
Nodes (33): NormalizePanel(), SuppliesManager(), SupplyArticleRow, applyCatalogNormalization(), canManageCatalog(), CatalogRewrite, createSupplyArticle(), DENIED (+25 more)

### Community 81 - "users/[id]/page.tsx"
Cohesion: 0.10
Nodes (31): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), dynamic, AccessMatrix(), ModuleAccessRow, AdminUserPage() (+23 more)

### Community 82 - "graph/provider.ts"
Cohesion: 0.13
Nodes (27): FOLDER_LABEL, GRAPH_WELL_KNOWN, ORDER, wellKnownFromGraph(), deltaToken(), escapeToHtml(), isRemoved(), Raw (+19 more)

### Community 83 - "queries/messaging.ts"
Cohesion: 0.11
Nodes (32): dynamic, GET(), dynamic, MessagesPage(), grantDriveRefAccess(), parseDriveRefs(), parseRef(), sendMessage() (+24 more)

### Community 84 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (28): DossierAssign(), DossierMessageForm(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+20 more)

### Community 85 - "stock-board.tsx"
Cohesion: 0.15
Nodes (28): KIND_OPTIONS, LEVEL_TONE, Result, StockBoard(), StockItemRow, StockMovementRow, useRun(), createStockItem() (+20 more)

### Community 86 - "petty-cash-actions.ts"
Cohesion: 0.16
Nodes (26): CashPanel(), allotPettyCash(), canAllot(), closePettyCash(), confirmPettyCashReceipt(), decidePettyCashTopUp(), nextRechargeFor(), requestPettyCashTopUp() (+18 more)

### Community 87 - "new-request-picker.tsx"
Cohesion: 0.09
Nodes (22): NewRequestPicker(), NewRequestPickerProps, CongressFormProps, CongressRequestButton(), CongressRequestForm(), CongressRequestFormProps, DoctorOpt, PM_ROLES (+14 more)

### Community 88 - "ranges-manager.tsx"
Cohesion: 0.13
Nodes (26): dynamic, PALETTE, PeoplePanel(), PersonRow, PersonSheet(), ProductOption, ProductPicker(), RangeSheet() (+18 more)

### Community 89 - "centre-board.tsx"
Cohesion: 0.17
Nodes (27): CentreBoard(), CentreMessage, CentreOrder, TONE, CentreDePaiementPage(), dynamic, metadata, decidePayment() (+19 more)

### Community 90 - "market/engine.ts"
Cohesion: 0.11
Nodes (29): Cache, DIR, DZD_PER_USD, getMarketData(), IqviaRow, LabRow, MarketMeta, PchRow (+21 more)

### Community 91 - "budget-forms.tsx"
Cohesion: 0.14
Nodes (28): BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+20 more)

### Community 92 - "products.ts"
Cohesion: 0.12
Nodes (28): dynamic, metadata, ProductExplorerPage(), fmtDzd(), fmtPct(), fmtUsd(), pctTone(), ProductExplorer() (+20 more)

### Community 93 - "upload-manager.tsx"
Cohesion: 0.12
Nodes (23): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadCancelled, UploadContext, UploadContextValue (+15 more)

### Community 94 - "rag.ts"
Cohesion: 0.11
Nodes (23): CORPUS_TOOLS, OPEN(), CachedVec, driveSemanticCandidates(), DriveSemanticHit, EmbedFn, loadVectors(), resetDriveSemanticCache() (+15 more)

### Community 95 - "releaseBlob"
Cohesion: 0.13
Nodes (26): releaseBlob(), archiveQueue, attachArchive(), clampInt(), enqueueArchive(), flushOriginalArchives(), ingestCore(), ingestDossierZip() (+18 more)

### Community 96 - "entities.ts"
Cohesion: 0.17
Nodes (23): ASPECTS, GET, GET, GET, RESERVED, GET, coerce(), DEFAULT_LIMIT (+15 more)

### Community 97 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (26): AggNum(), BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3() (+18 more)

### Community 98 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+17 more)

### Community 99 - "microsoft-mail-actions.ts"
Cohesion: 0.14
Nodes (26): AttachmentBar(), Composer(), listStamp(), MailWorkspace(), Pane, Props, deleteMessage(), draftFromForm() (+18 more)

### Community 100 - "messaging-actions.ts"
Cohesion: 0.17
Nodes (28): AddMembers(), cid(), InfoPanel(), Row(), fd(), NewConversation(), addMembers(), archiveConversation() (+20 more)

### Community 101 - "payment-authority.ts"
Cohesion: 0.11
Nodes (24): authoritiesOf(), HolderConfig, isNominative(), isOrphan(), orphanAuthorities(), SubjectLike, CONFIG, Advice (+16 more)

### Community 102 - "workflow/engine.ts"
Cohesion: 0.11
Nodes (28): defaultDefinition(), defaultSpine(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), countAdProItems() (+20 more)

### Community 103 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (23): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS, sanitizeStep() (+15 more)

### Community 104 - "drive-table.tsx"
Cohesion: 0.16
Nodes (23): BulkShareSheet(), DriveTable(), DropCategory, MoveTarget, UserLite, moveNodes(), canPasteInto(), Clipboard (+15 more)

### Community 105 - "competition.ts"
Cohesion: 0.13
Nodes (26): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+18 more)

### Community 106 - "expense-row-actions.tsx"
Cohesion: 0.16
Nodes (20): BudgetTargetField(), EditableExpense, CatalogArticle, empty(), ExistingLine, Row, BudgetTarget, DEPT_BUDGET_LABEL (+12 more)

### Community 107 - "document-request-actions.ts"
Cohesion: 0.17
Nodes (23): DocumentRequestPage(), RespondPanel(), PiecesPage(), ItemAskPanel(), askablePeople(), cancelDocumentRequest(), dateOf(), decideDocumentRequest() (+15 more)

### Community 108 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 109 - "drive-storage.ts"
Cohesion: 0.16
Nodes (21): DatabasesPage(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), blobChunkBytes(), blobKey() (+13 more)

### Community 110 - "purchase-request-actions.ts"
Cohesion: 0.22
Nodes (20): MyPurchaseRequests(), MyPurchaseRow, blank(), PurchaseRequestForm(), Row, PurchaseSection(), createPurchaseRequest(), nextRef() (+12 more)

### Community 111 - "executive-brief-tools.ts"
Cohesion: 0.10
Nodes (14): EXECUTIVE_BRIEF_TOOLS, AlertCriticality, days(), detectExecutiveAlerts(), ExecutiveAlert, RANK, monthlyPayroll(), WHAT_IF_TOOLS (+6 more)

### Community 112 - "client.ts"
Cohesion: 0.16
Nodes (21): buildUrl(), correlationId(), DELTA_EXPIRED, graphBinary(), graphJson(), graphRaw(), GraphRequest, HUMAN (+13 more)

### Community 113 - "scheduled.ts"
Cohesion: 0.14
Nodes (24): pollAiBatches(), AiCatchupState, BATCH_EXPIRE_MS, BATCH_FRESH_MS, BATCH_IN_FLIGHT, batchStillFresh(), catchupEnabled(), catchUpMissingAiReviews() (+16 more)

### Community 114 - "lifecycle/actions.ts"
Cohesion: 0.16
Nodes (21): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, s(), addLifecycleEvent(), addObligation() (+13 more)

### Community 115 - "reports.ts"
Cohesion: 0.16
Nodes (19): FindingsReportButton(), ReserveLetterButton(), useGenerate(), generateFindingsReportAction(), generateReserveLetterAction(), scopeCompanyId(), buildSimpleDocx(), esc() (+11 more)

### Community 116 - "regulatory-table.tsx"
Cohesion: 0.14
Nodes (19): AssignableUser, CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS, RegulatoryTable(), STAGE_CLASS (+11 more)

### Community 117 - "classify.ts"
Cohesion: 0.13
Nodes (21): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+13 more)

### Community 118 - "state-machines/explorer.ts"
Cohesion: 0.18
Nodes (20): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, pred(), InvariantsReport, runInvariants() (+12 more)

### Community 119 - "calendar.ts"
Cohesion: 0.18
Nodes (22): CalendarPage(), dynamic, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents() (+14 more)

### Community 120 - "composer.tsx"
Cohesion: 0.16
Nodes (19): Composer(), DriveRef, Pending, Props, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, Props (+11 more)

### Community 121 - "regulatory/page.tsx"
Cohesion: 0.15
Nodes (21): NewProductButton(), UserOption, RegulatoryPage(), BusinessDevelopmentPipelinePage(), dynamic, RegulatoryRow, SuppliersManager(), UpdateReminderButton() (+13 more)

### Community 122 - "extract-text.ts"
Cohesion: 0.15
Nodes (17): extractPdf(), extractPdfPages(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT (+9 more)

### Community 123 - "zip-inspector.ts"
Cohesion: 0.15
Nodes (23): BLOCKED_EXT, declaredSizes(), DEFAULT_ZIP_LIMITS, entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile() (+15 more)

### Community 124 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 125 - "connection.ts"
Cohesion: 0.18
Nodes (16): dynamic, GET(), dynamic, GET(), masterKey(), openSecret(), sealSecret(), ActiveConnection (+8 more)

### Community 126 - "regulatory/export/route.ts"
Cohesion: 0.17
Nodes (17): POST(), buildRegulatoryWorkbook(), dosageLabel(), EXPORT_COLUMNS, exportRowValues(), frDate(), label(), PRIORITY_FILL (+9 more)

### Community 127 - "form-fields.tsx"
Cohesion: 0.11
Nodes (15): EditMailButton(), OpeningBalance, DciAssociationField(), EditProductValues, UserOption, SupplierRow, Kind, TITLES (+7 more)

### Community 128 - "molecule.ts"
Cohesion: 0.19
Nodes (21): SuggestField(), marketSuggestions(), NomRow, dosageMatches(), extractDosage(), FORM_RULES, moleculeMatches(), moleculeStem() (+13 more)

### Community 129 - "messenger.tsx"
Cohesion: 0.16
Nodes (21): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+13 more)

### Community 130 - "progress/query.ts"
Cohesion: 0.13
Nodes (20): AnalysisProgressCard(), ACTIVE, LiveAnalysisBadge(), AnalysisProgress, AnalysisProgressInput, clamp01(), computeAnalysisProgress(), formatEta() (+12 more)

### Community 131 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 132 - "company.ts"
Cohesion: 0.21
Nodes (19): AccessBearer, AccessGrant, allowedCompanyIds(), canEditCompany(), canViewCompany(), companyAccessWhere(), GROUP_WIDE_ROLES, platformScopeWhere() (+11 more)

### Community 133 - "sheet-import.ts"
Cohesion: 0.22
Nodes (21): channelOf(), dosageFrom(), fixTypedZero(), FORM_RULES, formOf(), importComments(), isProductRow(), manufacturingOf() (+13 more)

### Community 134 - "moyens-generaux/page.tsx"
Cohesion: 0.15
Nodes (20): Consumption(), DepartmentSwitcher(), ExpensePanel(), ExpenseRowActions(), dynamic, metadata, MoyensGenerauxPage(), budgetHealth (+12 more)

### Community 135 - "portfolio.ts"
Cohesion: 0.15
Nodes (18): MyPortfolioCard(), ProductList(), currentCycle(), EMPTY, getMyPortfolio(), Row, SELECT, selectableProducts() (+10 more)

### Community 136 - "pch-tender-line-actions.ts"
Cohesion: 0.20
Nodes (20): analyzeMoleculeSafe(), dominantOrigin(), enrichLineById(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus() (+12 more)

### Community 137 - "update-reminder.ts"
Cohesion: 0.21
Nodes (18): sendRegulatoryUpdateReminder(), regulatoryReminderBoard(), canSendUpdateReminder(), daysSince(), isStaleDossier(), remindedRecently(), REMINDER_COOLDOWN_DAYS, REMINDER_ROLES (+10 more)

### Community 138 - "library-ingest.ts"
Cohesion: 0.16
Nodes (19): LunaCallInput, buildTextExtraction(), buildVisionExtraction(), CATEGORIES, CATEGORY_LABEL, ExtractedLetter, ExtractedReserve, normalizeModule() (+11 more)

### Community 139 - "ocrDocument"
Cohesion: 0.15
Nodes (16): canOcr(), IMAGE_EXTS, ocrDocument(), asSectionHeader(), CATEGORIES, categorizeReserve(), classifyReserveType(), cleanSectionCode() (+8 more)

### Community 140 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 141 - "openapi.ts"
Cohesion: 0.18
Nodes (16): GET, GET(), buildOpenApi(), COMMON_ERRORS, Json, ok(), PAGE_PARAMS, hasAllScopes() (+8 more)

### Community 142 - "budgets/page.tsx"
Cohesion: 0.24
Nodes (16): BudgetContextBar(), BudgetExpensesPage(), dynamic, BudgetsPage(), dynamic, BudgetSettingsPage(), dynamic, rememberBudgetEnvelope() (+8 more)

### Community 143 - "mail-client.tsx"
Cohesion: 0.14
Nodes (19): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+11 more)

### Community 144 - "product-catalog.ts"
Cohesion: 0.16
Nodes (18): ProductCatalogPage(), KIND_LABEL, OrphanRow(), canonicalForm(), bestMatches(), isConfident(), MatchProposal, matchScore() (+10 more)

### Community 145 - "payroll-hr-actions.ts"
Cohesion: 0.24
Nodes (17): MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym(), canRunPayroll(), markSalaryPaid(), transferPayrollToBudget() (+9 more)

### Community 146 - "drive-search.ts"
Cohesion: 0.19
Nodes (18): describePath(), fold(), matchesQuery(), MIN_QUERY, normalizeQuery(), rankHit(), SearchHit, searchSummary() (+10 more)

### Community 147 - "reply.ts"
Cohesion: 0.18
Nodes (18): MailAddress, buildReplyDraft(), dedupeAddresses(), forwardSubject(), norm(), parseAddressList(), previewOf(), quoteBlock() (+10 more)

### Community 148 - "write.ts"
Cohesion: 0.18
Nodes (19): describeMailChanges(), diffMailAssignments(), diffMailEntry(), MAIL_ASSIGNMENT_FIELDS, MAIL_TRACKED_FIELDS, MailAssignmentField, MailAssignments, MailChange (+11 more)

### Community 149 - "document-preview.tsx"
Cohesion: 0.18
Nodes (13): FileViewer(), ValidationAttachments(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE (+5 more)

### Community 150 - "molecule-panel.tsx"
Cohesion: 0.16
Nodes (15): fmtDzd(), FoundList(), MoleculePanel(), arc(), Donut(), DonutSlice, foldTail(), INK (+7 more)

### Community 151 - "chain-card.tsx"
Cohesion: 0.20
Nodes (15): LegalChainCard(), SendToSettlementButton(), amountDrift(), CHAIN_KIND_LABEL, CHAIN_KINDS, ChainDoc, ChainKind, chainOf() (+7 more)

### Community 152 - "identity-board.tsx"
Cohesion: 0.19
Nodes (15): CopyButton(), IdentityBoard(), IdentityCompany, IdentitySheet(), dynamic, COMPANY_DOC_CATEGORIES, CompanyDocCategory, isCompanyDocCategory() (+7 more)

### Community 153 - "department-budget-actions.ts"
Cohesion: 0.27
Nodes (19): addDepartmentExpense(), AMEND_INCLUDE, canAmendExpense(), currentCashOf(), grantFor(), headedDepartmentIds(), isMyDepartment(), requestDepartmentBudget() (+11 more)

### Community 154 - "http.ts"
Cohesion: 0.21
Nodes (16): GET, ApiContext, authenticate(), generateApiKey(), hashApiKey(), readBearer(), requireScopes(), sameHash() (+8 more)

### Community 155 - "org-chart-print.ts"
Cohesion: 0.18
Nodes (15): OrgCanvas(), OrgChartEditor(), OrgNode, OrgWorkspace(), buildOrgChartSvg(), buildPrintDocument(), clip(), escapeXml() (+7 more)

### Community 156 - "calendar-view.tsx"
Cohesion: 0.18
Nodes (17): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, createCalendarEvent() (+9 more)

### Community 157 - "drive/explorer.ts"
Cohesion: 0.17
Nodes (15): SpaceLite, UserLite, QuickRow, BY_EXTENSION, ExplorerRow, ExplorerView, extensionOf(), NavEntry (+7 more)

### Community 158 - "meetings/[id]/page.tsx"
Cohesion: 0.12
Nodes (16): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+8 more)

### Community 159 - "meetings.ts"
Cohesion: 0.19
Nodes (15): MeetingDetailPage(), dynamic, PublicMeetPage(), PublicJoin(), canManageMeeting(), canViewMeeting(), genPublicToken(), genSlug() (+7 more)

### Community 160 - "run.ts"
Cohesion: 0.17
Nodes (14): Sim, SimulatorPanel(), VERDICT, AiFn, dossierSummary(), normalizeSimulation(), normVerdict(), PERSPECTIVES (+6 more)

### Community 161 - "budget-general-means.integration.test.ts"
Cohesion: 0.17
Nodes (15): consumptionByCategory(), ImputableExpense, ImputableLine, Imputation, imputationsOf(), isFullyClassified(), round2(), unclassifiedTotal() (+7 more)

### Community 162 - "legal/lifecycle.ts"
Cohesion: 0.22
Nodes (15): LegalSweepResult, runLegalExpirySweep(), canCancel(), canRenew(), daysBetween(), daysLeft(), expiryLevel, expiryMessage() (+7 more)

### Community 163 - "consulting-actions.ts"
Cohesion: 0.33
Nodes (17): ConsultingActions(), ContractTask, addConsultingTask(), audit(), billingOf(), closeConsultingContract(), createConsultingContract(), dateOf() (+9 more)

### Community 164 - "demandes/new-request.tsx"
Cohesion: 0.14
Nodes (14): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, DriveExplorerSheet(), DrivePickerField() (+6 more)

### Community 165 - "workspace.tsx"
Cohesion: 0.30
Nodes (15): DocumentWorkspace(), Bounds, cascade(), clampToBounds(), focus(), MIN_H, MIN_W, moveBy() (+7 more)

### Community 166 - "invoice-actions.ts"
Cohesion: 0.23
Nodes (16): createInvoice(), deleteInvoice(), parseStatus(), readFields(), setInvoicePaid(), STATUSES, statusFor(), syncInvoiceSettlement() (+8 more)

### Community 167 - "directive-actions.ts"
Cohesion: 0.24
Nodes (15): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+7 more)

### Community 168 - "message-thread.tsx"
Cohesion: 0.20
Nodes (15): SendPayload, buildInlineRegex(), dayLabel(), escapeRegExp(), inlineNoCode(), PRESENCE_COLOR, PresenceDot(), presenceLine() (+7 more)

### Community 169 - "stand-in.ts"
Cohesion: 0.23
Nodes (15): StandInState, actsFor(), day(), delegatedActions(), delegationNotice(), delegationsFor(), inactiveReason(), isDelegatable() (+7 more)

### Community 170 - "departments.ts"
Cohesion: 0.17
Nodes (15): buildChain(), buildTree(), DepartmentNode, DepartmentOption, DeptLite, EmpLite, getDepartmentMembers(), getDepartmentTree() (+7 more)

### Community 171 - "objectStorageConfigured"
Cohesion: 0.22
Nodes (15): dynamic, GET(), runtime, configuredEndpointHost(), deleteObject(), getObject(), objectStorageConfigured(), putObject() (+7 more)

### Community 172 - "errors.ts"
Cohesion: 0.17
Nodes (11): GET, blockOf(), GET, SCALARS, schema(), API_ERROR_CODES, ApiError, ApiErrorBody (+3 more)

### Community 173 - "tender-lines.tsx"
Cohesion: 0.19
Nodes (15): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+7 more)

### Community 174 - "action-intents.ts"
Cohesion: 0.20
Nodes (13): ACTION_INTENT_TOOLS, ActionIntentStatus, cancelActionIntent(), executeIntentGuarded(), frDate(), INTENT_STATUS_LABEL, IntentExecuteResult, IntentSeed (+5 more)

### Community 175 - "MicrosoftGraphMailProvider"
Cohesion: 0.18
Nodes (4): draftBody(), MicrosoftGraphMailProvider, recipients(), MailDraftInput

### Community 176 - "features.ts"
Cohesion: 0.19
Nodes (13): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), CATALOG, FeatureKey (+5 more)

### Community 177 - "consulting/[id]/page.tsx"
Cohesion: 0.25
Nodes (12): ConsultingContractPage(), dynamic, billingSuffix(), ConsultingMove, ConsultingState, isAwaitingDecision(), isContractEditable(), isOverdue() (+4 more)

### Community 178 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (15): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+7 more)

### Community 179 - "meeting-actions.ts"
Cohesion: 0.28
Nodes (14): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+6 more)

### Community 180 - "expense-lines.ts"
Cohesion: 0.35
Nodes (13): ReceiptLines(), readReceipt(), ReceiptDraft, normalizeLines(), parseAmount(), parseLinesField(), parseQuantity(), receiptLabel() (+5 more)

### Community 181 - "support/[id]/page.tsx"
Cohesion: 0.22
Nodes (13): dynamic, SUPPORT_DOC_CATEGORIES, SupportDetailPage(), dynamic, SUPPORT_TARGET_ROLES, SupportPage(), SUPPORT_CATEGORY, SUPPORT_STATUS (+5 more)

### Community 182 - "wilaya.ts"
Cohesion: 0.33
Nodes (13): ALGERIA_WILAYAS, acceptAiWilaya(), inferWilayas(), ALIASES, BY_CODE, BY_FOLDED, foldText(), postalCodeInText() (+5 more)

### Community 183 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (15): collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat, PendingValidation (+7 more)

### Community 184 - "rh/upload/route.ts"
Cohesion: 0.30
Nodes (11): dynamic, POST(), HrDossier(), defaultVisibleToEmployee(), EMPLOYEE_FACING, resolveVisibility(), shouldMirrorToDrive(), visibilityLabel() (+3 more)

### Community 185 - "radar.ts"
Cohesion: 0.22
Nodes (14): fmtPct(), fmtUsd(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow (+6 more)

### Community 186 - "lib/messaging.ts"
Cohesion: 0.19
Nodes (13): DOT, MyStatus(), parseAttachments(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus (+5 more)

### Community 187 - "office-launcher.tsx"
Cohesion: 0.39
Nodes (11): OfficeLauncher(), OfficePins(), appOfFile(), OFFICE_APPS, OFFICE_PINS_KEY, officeApp, OfficeAppKey, officeHref() (+3 more)

### Community 188 - "department-actions.ts"
Cohesion: 0.30
Nodes (14): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+6 more)

### Community 189 - "onboarding-wizard.tsx"
Cohesion: 0.17
Nodes (9): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, MailboxStep(), ProfileStep(), Props (+1 more)

### Community 191 - "s3-config.ts"
Cohesion: 0.29
Nodes (13): ConfigSource, describeConfig(), disablingVar(), Env, isTruthy(), providerOf(), readVar(), REQUIRED (+5 more)

### Community 192 - "budgets/export/route.ts"
Cohesion: 0.25
Nodes (10): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview, BudgetCategoryView (+2 more)

### Community 193 - "pch/export/route.ts"
Cohesion: 0.26
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 194 - "upload-button.tsx"
Cohesion: 0.24
Nodes (11): CATEGORY_SUGGESTIONS, makePreflight(), Perm, PermBtn(), RichUpload(), UserLite, FINGERPRINT_MAX_BYTES, FINGERPRINT_MIN_BYTES (+3 more)

### Community 195 - "contacts-board.tsx"
Cohesion: 0.25
Nodes (7): ContactRow, ContactsBoard(), CONTACT_KIND_SUGGESTIONS, groupContactsByKind(), matchesContact(), NO_KIND_LABEL, normalizeKind()

### Community 196 - "operations.ts"
Cohesion: 0.26
Nodes (11): ReconcileTable(), linkProductToDossier(), unlinkProductFromDossier(), OperationDef, ParamDef, ParamType, ValidationResult, CatalogKind (+3 more)

### Community 197 - "today.ts"
Cohesion: 0.19
Nodes (11): CalendarEventDTO, greetingFor(), rankToday(), reasonOf(), REASONS, score(), item(), NOW (+3 more)

### Community 198 - "simple-pdf.ts"
Cohesion: 0.24
Nodes (12): A4, BASE_OF, buildSimplePdf(), charWidth(), esc(), HELV_WIDTHS, Line, parsePdfBody() (+4 more)

### Community 199 - "search-everything.ts"
Cohesion: 0.23
Nodes (11): capabilities(), d10(), EverythingHit, EverythingResult, familyWhere(), FUZZY_TABLES, fuzzyIds(), matchOf() (+3 more)

### Community 200 - "messaging/messages/route.ts"
Cohesion: 0.22
Nodes (9): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+1 more)

### Community 201 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 202 - "background-upload.tsx"
Cohesion: 0.18
Nodes (9): BackgroundUploadProvider(), BgCancelled, BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus (+1 more)

### Community 203 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 204 - "accessibleModules"
Cohesion: 0.21
Nodes (10): dynamic, metadata, NoAccessPage(), GuideEntry, OnboardingWizard(), DESTINATION_HELP, metadata, OnboardingPage() (+2 more)

### Community 205 - "file-glyph.tsx"
Cohesion: 0.27
Nodes (9): FileGlyph(), FileGlyphProps, LOOK, FAMILIES, FileFamily, fileGlyph(), FileGlyphSpec, badge() (+1 more)

### Community 206 - "stock-snapshot-actions.ts"
Cohesion: 0.23
Nodes (11): createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation(), deleteStockSnapshot(), LOC (+3 more)

### Community 207 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 208 - "budget.ts"
Cohesion: 0.20
Nodes (8): BudgetEnvelopeOption, BudgetHealth, BudgetMonthPoint, buildMonthlySeries(), EnvelopeSummaryItem, health(), MONTH_FR, UnattributedTx

### Community 209 - "ai-health.ts"
Cohesion: 0.33
Nodes (4): runAiHealthCheckNow(), AiHealthResult, AiHealthRun, performAiHealthCheck()

### Community 210 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 211 - "meeting-chat.tsx"
Cohesion: 0.27
Nodes (9): Attachments(), ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), formatBytes(), deleteMeetingMessage() (+1 more)

### Community 212 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 213 - "mail-actions.ts"
Cohesion: 0.38
Nodes (9): connectMailbox(), disconnectMailbox(), sendMailAction(), updateMailSignature(), closeMailConnection(), encryptSecret(), getMailAccount(), sendMail() (+1 more)

### Community 214 - "payroll-cost.ts"
Cohesion: 0.40
Nodes (8): basisLabel(), CostBasis, defaultEmployerCost(), entryBasis(), entryCost(), num(), PayrollCostInput, payrollMass()

### Community 215 - "grouping.ts"
Cohesion: 0.38
Nodes (7): GroupableValidation, groupStatus(), groupValidations(), norm(), pieceSummary(), ValidationGroup, ValidationStatusLike

### Community 216 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 217 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 218 - "auto-category.ts"
Cohesion: 0.33
Nodes (5): CategoryCandidate, EnvelopeCandidate, envelopeCovers(), pickAutoCategory(), time()

### Community 219 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 220 - "zip-viewer.tsx"
Cohesion: 0.39
Nodes (7): childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer()

### Community 221 - "bars.tsx"
Cohesion: 0.32
Nodes (7): BarRow, Bars(), COLOR, Meter(), TEXT, toneOf(), STATUS

### Community 222 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 223 - "readers.ts"
Cohesion: 0.39
Nodes (5): canReadLegalDocument(), isRestricted(), LegalDocumentAccess, LegalReaderContext, readersCaption()

### Community 224 - "ENTITIES"
Cohesion: 0.29
Nodes (4): GET, ENTITIES, entityNames(), schema

### Community 225 - "[operation]/route.ts"
Cohesion: 0.38
Nodes (5): POST, describeOperations(), getOperation(), OPERATIONS, validateParams()

### Community 226 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 227 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 228 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 229 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 230 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 231 - "messages-indicator.tsx"
Cohesion: 0.67
Nodes (5): getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio()

### Community 234 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 235 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, viewport

### Community 236 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 237 - "FolderLite"
Cohesion: 0.50
Nodes (4): MailFolderRow, FolderRow, FolderLite, FolderNode

### Community 238 - "validation-decision.tsx"
Cohesion: 0.50
Nodes (3): CFG, Decision, ValidationDecision()

### Community 240 - "NewRequestButton"
Cohesion: 0.67
Nodes (3): currentYm(), LEAVE_TYPES, NewRequestButton()

## Knowledge Gaps
- **1613 isolated node(s):** `EMPTY`, `dynamic`, `dynamic`, `dynamic`, `ModuleSpec` (+1608 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `utils.ts`, `hasGlobalView`, `card.tsx`, `lib/labels.ts`, `notifyUser`, `lib/session.ts`, `recordAudit`, `requireUser`, `requireModule`, `lib/ai.ts`, `userCan`, `regCan`, `aiConfigured`, `promo-material-actions.ts`, `taches/[id]/page.tsx`, `batch-runner.ts`, `recrutement/[id]/page.tsx`, `rbac.ts`, `getCurrentUser`, `formatDateTime`, `brain-cockpit.tsx`, `admin-request-actions.ts`, `assistant.ts`, `build-facts.ts`, `corpus/actions.ts`, `fdStr`, `(app)/layout.tsx`, `corpus-actions.ts`, `rules/engine.ts`, `mail.ts`, `[dossierId]/page.tsx`, `jobs/runner.ts`, `payment-request-actions.ts`, `legal/[id]/page.tsx`, `src/auth.ts`, `sponsoring/page.tsx`, `regulatory/[id]/page.tsx`, `pilotage/page.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `storage.ts`, `formatDate`, `executive-tools.ts`, `back-link.tsx`, `hr-document-actions.ts`, `regulatory-workflow.ts`, `agent-core.ts`, `lib/department-budget.ts`, `directory-grid.ts`, `admin-settings-forms.tsx`, `reserves/page.tsx`, `upload/session.ts`, `test-center/runner.ts`, `drive-actions.ts`, `ROLE_LABELS`, `letterhead-manager.tsx`, `regulatory-actions.ts`, `enregistrement/page.tsx`, `market-research.ts`, `(app)/validations/page.tsx`, `voice-realtime.ts`, `adoption.ts`, `regAudit`, `performAction`, `platform-audit/engine.ts`, `document-discovery.ts`, `test-center/page.tsx`, `mon-espace/page.tsx`, `sales-planning-actions.ts`, `settings.ts`, `lib/drive.ts`, `office-supply-actions.ts`, `users/[id]/page.tsx`, `queries/messaging.ts`, `dossier-actions.ts`, `stock-board.tsx`, `petty-cash-actions.ts`, `ranges-manager.tsx`, `centre-board.tsx`, `rag.ts`, `releaseBlob`, `entities.ts`, `bd-strategic-table.tsx`, `medical-info-actions.ts`, `microsoft-mail-actions.ts`, `messaging-actions.ts`, `workflow/engine.ts`, `workflow-builder.tsx`, `expense-row-actions.tsx`, `document-request-actions.ts`, `smart-mail-actions.ts`, `drive-storage.ts`, `purchase-request-actions.ts`, `executive-brief-tools.ts`, `scheduled.ts`, `lifecycle/actions.ts`, `reports.ts`, `state-machines/explorer.ts`, `calendar.ts`, `regulatory/page.tsx`, `migration-cert.ts`, `connection.ts`, `regulatory/export/route.ts`, `progress/query.ts`, `supplier/actions.ts`, `company.ts`, `moyens-generaux/page.tsx`, `portfolio.ts`, `pch-tender-line-actions.ts`, `update-reminder.ts`, `library-ingest.ts`, `ocrDocument`, `invariants/registry.ts`, `budgets/page.tsx`, `product-catalog.ts`, `payroll-hr-actions.ts`, `drive-search.ts`, `write.ts`, `chain-card.tsx`, `identity-board.tsx`, `department-budget-actions.ts`, `http.ts`, `calendar-view.tsx`, `meetings/[id]/page.tsx`, `meetings.ts`, `run.ts`, `budget-general-means.integration.test.ts`, `legal/lifecycle.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `directive-actions.ts`, `departments.ts`, `errors.ts`, `action-intents.ts`, `features.ts`, `consulting/[id]/page.tsx`, `field-report-actions.ts`, `meeting-actions.ts`, `expense-lines.ts`, `support/[id]/page.tsx`, `process-intelligence.ts`, `rh/upload/route.ts`, `lib/messaging.ts`, `department-actions.ts`, `pch/export/route.ts`, `operations.ts`, `search-everything.ts`, `supplier-auth.ts`, `push.ts`, `accessibleModules`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `budget.ts`, `ai-health.ts`, `meetings/page.tsx`, `mail-actions.ts`, `[token]/route.ts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `utils.ts`, `hasGlobalView`, `card.tsx`, `lib/labels.ts`, `notifyUser`, `lib/session.ts`, `recordAudit`, `requireModule`, `lib/ai.ts`, `userCan`, `regCan`, `prisma.ts`, `aiConfigured`, `promo-material-actions.ts`, `taches/[id]/page.tsx`, `recrutement/[id]/page.tsx`, `rbac.ts`, `getCurrentUser`, `formatDateTime`, `brain-cockpit.tsx`, `admin-request-actions.ts`, `corpus/actions.ts`, `fdStr`, `(app)/layout.tsx`, `corpus-actions.ts`, `rules/engine.ts`, `payment-request-actions.ts`, `legal/[id]/page.tsx`, `regulatory/[id]/page.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `back-link.tsx`, `hr-document-actions.ts`, `regulatory-workflow.ts`, `agent-core.ts`, `oauth.ts`, `lib/department-budget.ts`, `reserves/page.tsx`, `test-center/runner.ts`, `drive-actions.ts`, `ROLE_LABELS`, `letterhead-manager.tsx`, `regulatory-actions.ts`, `voice-realtime.ts`, `regAudit`, `performAction`, `platform-audit/engine.ts`, `test-center/page.tsx`, `mon-espace/page.tsx`, `sales-planning-actions.ts`, `office-supply-actions.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `stock-board.tsx`, `petty-cash-actions.ts`, `ranges-manager.tsx`, `centre-board.tsx`, `budget-forms.tsx`, `products.ts`, `medical-info-actions.ts`, `microsoft-mail-actions.ts`, `messaging-actions.ts`, `workflow-builder.tsx`, `drive-table.tsx`, `document-request-actions.ts`, `smart-mail-actions.ts`, `drive-storage.ts`, `purchase-request-actions.ts`, `lifecycle/actions.ts`, `reports.ts`, `regulatory/page.tsx`, `molecule.ts`, `messenger.tsx`, `supplier/actions.ts`, `moyens-generaux/page.tsx`, `pch-tender-line-actions.ts`, `update-reminder.ts`, `budgets/page.tsx`, `mail-client.tsx`, `payroll-hr-actions.ts`, `department-budget-actions.ts`, `calendar-view.tsx`, `run.ts`, `consulting-actions.ts`, `invoice-actions.ts`, `directive-actions.ts`, `tender-lines.tsx`, `field-report-actions.ts`, `meeting-actions.ts`, `support/[id]/page.tsx`, `lib/messaging.ts`, `department-actions.ts`, `operations.ts`, `accessibleModules`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `ai-health.ts`, `meeting-chat.tsx`, `mail-actions.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `utils.ts`, `hasGlobalView`, `card.tsx`, `lib/labels.ts`, `notifyUser`, `lib/session.ts`, `recordAudit`, `requireUser`, `requireModule`, `prisma.ts`, `aiConfigured`, `promo-material-actions.ts`, `taches/[id]/page.tsx`, `recrutement/[id]/page.tsx`, `rbac.ts`, `getCurrentUser`, `formatDateTime`, `brain-cockpit.tsx`, `admin-request-actions.ts`, `assistant.ts`, `fdStr`, `(app)/layout.tsx`, `payment-request-actions.ts`, `legal/[id]/page.tsx`, `sponsoring/page.tsx`, `regulatory/[id]/page.tsx`, `pilotage/page.tsx`, `ad-pro-item-actions.ts`, `care-actions.ts`, `storage.ts`, `formatDate`, `back-link.tsx`, `hr-document-actions.ts`, `regulatory-workflow.ts`, `lib/department-budget.ts`, `directory-grid.ts`, `drive-actions.ts`, `regulatory-actions.ts`, `market-research.ts`, `(app)/validations/page.tsx`, `adoption.ts`, `performAction`, `document-discovery.ts`, `test-center/page.tsx`, `mon-espace/page.tsx`, `sales-planning-actions.ts`, `lib/drive.ts`, `office-supply-actions.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `stock-board.tsx`, `petty-cash-actions.ts`, `ranges-manager.tsx`, `budget-forms.tsx`, `products.ts`, `rag.ts`, `entities.ts`, `medical-info-actions.ts`, `messaging-actions.ts`, `document-request-actions.ts`, `executive-brief-tools.ts`, `calendar.ts`, `regulatory/page.tsx`, `regulatory/export/route.ts`, `molecule.ts`, `moyens-generaux/page.tsx`, `pch-tender-line-actions.ts`, `openapi.ts`, `mail-client.tsx`, `product-catalog.ts`, `payroll-hr-actions.ts`, `write.ts`, `identity-board.tsx`, `department-budget-actions.ts`, `calendar-view.tsx`, `consulting-actions.ts`, `invoice-actions.ts`, `directive-actions.ts`, `errors.ts`, `tender-lines.tsx`, `consulting/[id]/page.tsx`, `field-report-actions.ts`, `meeting-actions.ts`, `support/[id]/page.tsx`, `rh/upload/route.ts`, `department-actions.ts`, `budgets/export/route.ts`, `pch/export/route.ts`, `operations.ts`, `search-everything.ts`, `messaging/messages/route.ts`, `stock-snapshot-actions.ts`, `reminder-actions.ts`, `ai-health.ts`, `ENTITIES`, `[operation]/route.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `EMPTY`, `dynamic`, `dynamic` to the rest of the system?**
  _1613 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.047495682210708115 - nodes in this community are weakly interconnected._
- **Should `hasGlobalView` be split into smaller, more focused modules?**
  _Cohesion score 0.03665363085652941 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.044621803011064755 - nodes in this community are weakly interconnected._