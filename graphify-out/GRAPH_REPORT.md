# Graph Report - src  (2026-08-05)

## Corpus Check
- 817 files · ~548,940 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4925 nodes · 19434 edges · 178 communities (172 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f4d750eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- requireUser
- card.tsx
- badge.tsx
- requireModule
- getCurrentUser
- lib/labels.ts
- [dossierId]/page.tsx
- upload/session.ts
- prisma.ts
- drive-storage.ts
- mail.ts
- notifyUser
- getAppSettings
- input.tsx
- fdStr
- page-header.tsx
- test-center/runner.ts
- FindingInput
- finances/page.tsx
- notifyRoles
- utils.ts
- budget-board.tsx
- lib/session.ts
- mistral-ocr.ts
- promo-material-actions.ts
- jobs/runner.ts
- onlyofficeConfigured
- assistant-actions.ts
- actions/types.ts
- adoption.ts
- canAccessEntity
- hr-document-actions.ts
- regAudit
- anpp-process.tsx
- assistant.ts
- rules/admin-actions.ts
- medical-directory.tsx
- aiConfigured
- build-facts.ts
- enregistrement/page.tsx
- sales-planning-actions.ts
- ai/page.tsx
- button.tsx
- hasGlobalView
- drive/page.tsx
- platform-audit/engine.ts
- agent-core.ts
- budget.ts
- messaging-actions.ts
- queries/messaging.ts
- dossier-actions.ts
- SessionUser
- rules/engine.ts
- storage.ts
- Select
- message-thread.tsx
- auth.ts
- lib/messaging.ts
- workflow-builder.tsx
- competition.ts
- congress-request-actions.ts
- form-fields.tsx
- document-preview.tsx
- field-report-actions.ts
- explorer.ts
- entity-access.ts
- Button
- (app)/layout.tsx
- rbac.ts
- ocr-engine.ts
- sectionByCode
- aiModel
- lib/ai.ts
- workflow.ts
- calendar.ts
- departments.ts
- lifecycle/actions.ts
- workflow/engine.ts
- migration-cert.ts
- messenger.tsx
- extract-text.ts
- market-research.ts
- adventum-brain/page.tsx
- event-form.tsx
- regulatory-actions.ts
- generate.ts
- invariants/registry.ts
- drive-actions.ts
- meetings/[id]/page.tsx
- onboarding-wizard.tsx
- risks.ts
- extract-facts.ts
- admin-settings-forms.tsx
- upload-manager.tsx
- zip-inspector.ts
- brain-cockpit.tsx
- congress.ts
- mail-client.tsx
- process-intelligence.ts
- rbac.test.ts
- review-agent.ts
- driver/page.tsx
- regulatory/page.tsx
- auth-actions.ts
- meetings.ts
- products.ts
- drive-space-manager.tsx
- meeting-actions.ts
- supplier/actions.ts
- office-templates.ts
- dossier-knowledge.ts
- test-center-client.tsx
- pch.ts
- pch-tender-line-actions.ts
- tender-lines.tsx
- dashboard.ts
- courses-board.tsx
- department-actions.ts
- topbar.tsx
- market/engine.ts
- validations.ts
- test-center/page.tsx
- adventum-actions.ts
- new-request.tsx
- supplier-auth.ts
- hr-documents.ts
- push.ts
- regulatory-request-actions.ts
- stocks-view.tsx
- directive-actions.ts
- getMarketData
- activity/page.tsx
- background-upload.tsx
- reminder-actions.ts
- congress-beneficiary-actions.ts
- radar.ts
- regulatory-drive-mirror.ts
- dossiers.ts
- WorkflowView
- new-conversation.tsx
- data.ts
- bd.ts
- market-presentation-actions.ts
- meetings/page.tsx
- departments-manager.tsx
- Adventum Autonomous Test Center — architecture
- org-chart-editor.tsx
- calendar-view.tsx
- meeting-chat.tsx
- missions.ts
- promo-material.ts
- scheduled.ts
- congress-request-form.tsx
- delegate-plans.tsx
- forecast-grid.tsx
- pulse-strip.tsx
- push-register.tsx
- draft.ts
- visits-table.tsx
- pch-detail-client.tsx
- bv-requests.tsx
- employee-form.tsx
- validation-item-review.tsx
- next-auth.d.ts
- directives/[id]/panel.tsx
- activity-tracker.tsx
- notification-chime.tsx
- mission-stops.tsx
- office-editor.tsx
- app/layout.tsx
- courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 541 edges
2. `userCan()` - 434 edges
3. `fdStr()` - 418 edges
4. `recordAudit()` - 371 edges
5. `prisma` - 347 edges
6. `requireModule()` - 198 edges
7. `hasGlobalView()` - 147 edges
8. `Button` - 142 edges
9. `cn()` - 142 edges
10. `formatDate()` - 122 edges

## Surprising Connections (you probably didn't know these)
- `pickMime()` --indirect_call--> `c()`  [INFERRED]
  src/app/(app)/meetings/[id]/meeting-recorder.tsx → src/lib/regulatory/intelligence/ctd/classify.test.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `Kpi()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/utils.ts
- `AutopilotConfirm()` --calls--> `runAutopilot()`  [EXTRACTED]
  src/app/(app)/adventum-brain/brain-cockpit.tsx → src/lib/actions/adventum-actions.ts

## Import Cycles
- None detected.

## Communities (178 total, 6 thin omitted)

### Community 0 - "requireUser"
Cohesion: 0.05
Nodes (133): CorbeillePage(), FieldsManager(), SuppliesManager(), PayButton(), DeleteDoctorButton(), CancelButton(), CancelButton(), AVATAR_COLORS (+125 more)

### Community 1 - "card.tsx"
Cohesion: 0.06
Nodes (72): dynamic, metadata, BD_DOC_CATEGORIES, BeneficiariesCard(), Beneficiary, Mode, Refs, CONGRESS_DOC_CATEGORIES (+64 more)

### Community 2 - "badge.tsx"
Cohesion: 0.07
Nodes (72): ACTION_COLS, ACTION_LABELS, Opt, dynamic, TYPES, AdminPage(), fmtBytes(), fmtWhen() (+64 more)

### Community 3 - "requireModule"
Cohesion: 0.05
Nodes (86): FieldDefDTO, CustomFieldsPage(), OrganigrammePage(), AdminValidationsPage(), dec(), CompareBars(), EnvelopesGrandTotalPanel(), BusinessDevelopmentOpportunitiesPage() (+78 more)

### Community 4 - "getCurrentUser"
Cohesion: 0.05
Nodes (75): dynamic, GET(), INLINE_MIME, runtime, dynamic, GET(), runtime, dynamic (+67 more)

### Community 5 - "lib/labels.ts"
Cohesion: 0.03
Nodes (77): AuditPanel(), AuditRow, AuditTable(), BDPipeline(), STAGES, BDRow, BDTable(), dynamic (+69 more)

### Community 6 - "[dossierId]/page.tsx"
Cohesion: 0.04
Nodes (69): AgentItem, AgentsPanel(), RunState, DossierChatPanel(), DocgenPanel(), GenDoc, Template, DeleteDossierButton() (+61 more)

### Community 7 - "upload/session.ts"
Cohesion: 0.06
Nodes (67): dynamic, GET(), runtime, dynamic, runtime, RFC-3986, IngestResult, buildMessyDossierZip() (+59 more)

### Community 8 - "prisma.ts"
Cohesion: 0.04
Nodes (46): dynamic, GET(), GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), GET() (+38 more)

### Community 9 - "drive-storage.ts"
Cohesion: 0.06
Nodes (54): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+46 more)

### Community 10 - "mail.ts"
Cohesion: 0.05
Nodes (67): dynamic, POST(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+59 more)

### Community 11 - "notifyUser"
Cohesion: 0.06
Nodes (67): RuleEditor(), RequestActions(), RequesterWindow(), addRequestComment(), archiveAdminRequestIfDone(), assignRequest(), BatchCell, collectAllFields() (+59 more)

### Community 12 - "getAppSettings"
Cohesion: 0.06
Nodes (51): dynamic, POST(), POST(), dynamic, GET(), dynamic, POST(), dynamic (+43 more)

### Community 13 - "input.tsx"
Cohesion: 0.07
Nodes (32): DriveStorageSettings(), PALETTE, Option, RuleDTO, ProjectStatusBadge(), ConnectMailbox(), U, EditField (+24 more)

### Community 14 - "fdStr"
Cohesion: 0.07
Nodes (55): EntitiesManager(), ActiveToggle(), RuleControls(), nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR (+47 more)

### Community 15 - "page-header.tsx"
Cohesion: 0.08
Nodes (49): AssistantPage(), dynamic, CheckinPage(), dynamic, Assign, AssignmentMatrix(), Kam, key() (+41 more)

### Community 16 - "test-center/runner.ts"
Cohesion: 0.07
Nodes (47): sttConfigured(), base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+39 more)

### Community 17 - "FindingInput"
Cohesion: 0.10
Nodes (42): accrualStep(), monthsBetweenYm(), FlakyReport, runFlakyDetection(), EXECUTABLE, FuzzReport, runFuzzing(), SAFE (+34 more)

### Community 18 - "finances/page.tsx"
Cohesion: 0.05
Nodes (45): AdoptionTable(), dynamic, metadata, inline(), MdTable(), PlatformIdeas(), RichText(), DiagnosticPage() (+37 more)

### Community 19 - "notifyRoles"
Cohesion: 0.07
Nodes (48): EditEventButton(), CheckinConfirm(), RegistrationsManager(), runAutopilot(), addRegistration(), checkInByToken(), createEvent(), deleteEvent() (+40 more)

### Community 20 - "utils.ts"
Cohesion: 0.06
Nodes (40): badgeTone, TONE_BAR, TONE_TEXT, AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle() (+32 more)

### Community 21 - "budget-board.tsx"
Cohesion: 0.10
Nodes (46): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetBoard(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard() (+38 more)

### Community 22 - "lib/session.ts"
Cohesion: 0.06
Nodes (37): AccessUser, ModuleAccessGrid(), UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, dynamic (+29 more)

### Community 23 - "mistral-ocr.ts"
Cohesion: 0.09
Nodes (35): dynamic, GET(), runtime, backoffMs(), blankPages(), chunkConcurrency(), chunkPageSize(), clampInt() (+27 more)

### Community 24 - "promo-material-actions.ts"
Cohesion: 0.18
Nodes (35): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), audit(), cancelPromoMaterial(), chooseAgency() (+27 more)

### Community 25 - "jobs/runner.ts"
Cohesion: 0.10
Nodes (39): codeToken(), detectContainedSections(), DetectedSection, STOP, titleWords(), detectMime(), FAMILY_EXTS, MimeGuess (+31 more)

### Community 26 - "onlyofficeConfigured"
Cohesion: 0.14
Nodes (33): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, DriveEditPage(), dynamic (+25 more)

### Community 27 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (31): ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64(), MessageBubble(), Msg, nextId() (+23 more)

### Community 28 - "actions/types.ts"
Cohesion: 0.09
Nodes (31): ImpersonateButton(), DriveComments(), SupportActions(), SupportMessageForm(), useAction(), CreateRecordButtonProps, deleteDriveComment(), postDriveComment() (+23 more)

### Community 29 - "adoption.ts"
Cohesion: 0.09
Nodes (35): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS, ADOPTION_WEIGHT_FIELDS (+27 more)

### Community 30 - "canAccessEntity"
Cohesion: 0.10
Nodes (36): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+28 more)

### Community 31 - "hr-document-actions.ts"
Cohesion: 0.10
Nodes (37): EventDetail(), EventForm(), RequestRow(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES, parseKind(), respondToInvite() (+29 more)

### Community 32 - "regAudit"
Cohesion: 0.10
Nodes (33): ApproveNameButton(), FindingControls(), Props, statusLabel(), Props, SubmissionGate(), Conflict, ConflictRow() (+25 more)

### Community 33 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (36): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, StepNote(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), isRegChecklistKey() (+28 more)

### Community 34 - "assistant.ts"
Cohesion: 0.09
Nodes (39): callClaude(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue(), executeReadTool() (+31 more)

### Community 35 - "rules/admin-actions.ts"
Cohesion: 0.10
Nodes (30): dynamic, metadata, RegulatoryCorpusPage(), KIND_LABEL, Pack, Rule, RulePacksAdmin(), listCorpusSources() (+22 more)

### Community 36 - "medical-directory.tsx"
Cohesion: 0.11
Nodes (36): DoctorSheet(), InstitutionsManager(), MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER, SpecialtiesManager() (+28 more)

### Community 37 - "aiConfigured"
Cohesion: 0.13
Nodes (30): Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiConfigured(), AiTextResult, askDossierAction(), askReservesAction() (+22 more)

### Community 38 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 39 - "enregistrement/page.tsx"
Cohesion: 0.09
Nodes (32): CorpusAdmin(), dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule (+24 more)

### Community 40 - "sales-planning-actions.ts"
Cohesion: 0.10
Nodes (32): BU, CatalogueManager(), CHANNELS, Opt, Prod, Cap, Kam, KamRow() (+24 more)

### Community 41 - "ai/page.tsx"
Cohesion: 0.08
Nodes (31): AiControlCenterPage(), dynamic, FEATURE_LABEL, metadata, AggNum(), BdProjectDetailPage(), fmtDzd(), fmtDzd() (+23 more)

### Community 42 - "button.tsx"
Cohesion: 0.06
Nodes (26): Citation, Source, Version, GrantOption, RowGrants(), RowGrantsProps, RestoreButton(), ExpenseAckItem (+18 more)

### Community 43 - "hasGlobalView"
Cohesion: 0.13
Nodes (32): DirectiveDetailPage(), AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction() (+24 more)

### Community 44 - "drive/page.tsx"
Cohesion: 0.11
Nodes (33): DriveRow, DriveTable(), DriveSpacePage(), dynamic, humanSize(), KIND_ICON, DriveFilePage(), humanSize() (+25 more)

### Community 45 - "platform-audit/engine.ts"
Cohesion: 0.10
Nodes (32): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, DesignSignals, Finding, FORMAT_PANEL (+24 more)

### Community 46 - "agent-core.ts"
Cohesion: 0.10
Nodes (24): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+16 more)

### Community 47 - "budget.ts"
Cohesion: 0.11
Nodes (26): GET(), BudgetsPage(), dynamic, dynamic, PaiePage(), PayrollRow, budgetExportFilename(), buildBudgetWorkbook() (+18 more)

### Community 48 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (34): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+26 more)

### Community 49 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (29): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, MessagesPage() (+21 more)

### Community 50 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (28): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MessageAttachments(), MsgAttachment, useAction(), UserLite (+20 more)

### Community 51 - "SessionUser"
Cohesion: 0.10
Nodes (24): SupportDetailPage(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), OLD_HASH (+16 more)

### Community 52 - "rules/engine.ts"
Cohesion: 0.11
Nodes (25): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+17 more)

### Community 53 - "storage.ts"
Cohesion: 0.11
Nodes (25): PermanentDeleteButton(), PurgeOrphansButton(), delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY (+17 more)

### Community 54 - "Select"
Cohesion: 0.08
Nodes (24): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, ActiveToggle(), Profile, ProfileForm(), ResetPasswordForm() (+16 more)

### Community 55 - "message-thread.tsx"
Cohesion: 0.13
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 56 - "auth.ts"
Cohesion: 0.12
Nodes (21): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+13 more)

### Community 57 - "lib/messaging.ts"
Cohesion: 0.10
Nodes (23): dynamic, GET(), dynamic, NO_CONTENT, POST(), DOT, MyStatus(), setMessagingStatus() (+15 more)

### Community 58 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (24): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+16 more)

### Community 59 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 60 - "congress-request-actions.ts"
Cohesion: 0.22
Nodes (28): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+20 more)

### Community 61 - "form-fields.tsx"
Cohesion: 0.13
Nodes (21): SupplyArticleRow, OpeningBalance, DciAssociationField(), EditProductValues, UserOption, UserOption, SupplierRow, Field() (+13 more)

### Community 62 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 63 - "field-report-actions.ts"
Cohesion: 0.17
Nodes (23): DoctorPicker(), dynamic, ReportEditor(), Attachments(), SimpleReportEditor(), NewReportButton(), formatBytes(), analyzeFieldReportAction() (+15 more)

### Community 64 - "explorer.ts"
Cohesion: 0.15
Nodes (23): ACTIONS, MODULES, PERMISSIONS, businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult (+15 more)

### Community 65 - "entity-access.ts"
Cohesion: 0.15
Nodes (23): GET(), SearchPage(), ENTITY_MODULE, isRequestOwner(), accessibleDocumentWhere(), ALL_ENTITY_TYPES, isAll(), isNone() (+15 more)

### Community 66 - "Button"
Cohesion: 0.12
Nodes (19): ConvertPdfButton(), DriveCommentItem, FileActions(), ShareItem, SharePanel(), MoveTarget, NodeActions(), Props (+11 more)

### Community 67 - "(app)/layout.tsx"
Cohesion: 0.11
Nodes (19): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), isActive(), MobileTabBar(), PRIMARY (+11 more)

### Community 68 - "rbac.ts"
Cohesion: 0.08
Nodes (25): DirectiveDetail, getDirective(), getDirectives(), ALL, CONTRIBUTE, DIRECTIVES_USER, DOSSIERS_USER, DRIVE_USER (+17 more)

### Community 69 - "ocr-engine.ts"
Cohesion: 0.13
Nodes (22): analyzeEmployeeContract(), CONTRACT_TYPES_UP, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require, SUPPORTED (+14 more)

### Community 70 - "sectionByCode"
Cohesion: 0.13
Nodes (22): Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm(), sanitizeBase(), squash() (+14 more)

### Community 71 - "aiModel"
Cohesion: 0.15
Nodes (22): GET(), generateBriefing(), aiModel(), askClaude(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx() (+14 more)

### Community 72 - "lib/ai.ts"
Cohesion: 0.10
Nodes (19): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AnthropicBlock, AskOptions, CallOptions, ClaudeContentBlock (+11 more)

### Community 73 - "workflow.ts"
Cohesion: 0.15
Nodes (21): AdminWorkflowsPage(), dynamic, CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), eventValidationSteps(), SponsoringDetailPage(), getEntityMissions() (+13 more)

### Community 74 - "calendar.ts"
Cohesion: 0.17
Nodes (23): CalendarPage(), dynamic, CalendarEventDTO, CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents() (+15 more)

### Community 75 - "departments.ts"
Cohesion: 0.14
Nodes (22): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+14 more)

### Community 76 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 77 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (24): getManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), entityPath(), EntitySummary (+16 more)

### Community 78 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 79 - "messenger.tsx"
Cohesion: 0.16
Nodes (21): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), Props, bumpConversation(), Messenger() (+13 more)

### Community 80 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 81 - "market-research.ts"
Cohesion: 0.14
Nodes (19): GET(), dynamic, MarketResearchDetailPage(), ResearchMeta(), PresentationPanel(), buildResearchWorkbook(), researchExportFilename(), STATUS (+11 more)

### Community 82 - "adventum-brain/page.tsx"
Cohesion: 0.15
Nodes (19): AdventumBrainPage(), BLOCK_CATS, dynamic, diff(), getPulse(), hourBucket(), LEVEL_RANK, PulseCounts (+11 more)

### Community 83 - "event-form.tsx"
Cohesion: 0.12
Nodes (18): CreateEventButton(), d10(), EventFields(), Result, dynamic, InscriptionPage(), PublicRegistrationForm(), PARTICIPANT_ROLE (+10 more)

### Community 84 - "regulatory-actions.ts"
Cohesion: 0.15
Nodes (20): StatusEditor(), VariationDTO, VariationPanel(), addRegulatoryComment(), createRegulatoryProduct(), createVariation(), deleteVariation(), normalizeDci() (+12 more)

### Community 85 - "generate.ts"
Cohesion: 0.17
Nodes (18): documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED, approvedFactMap() (+10 more)

### Community 86 - "invariants/registry.ts"
Cohesion: 0.14
Nodes (13): InvariantOutcome, checkRows(), Delegate, KNOWN_MODULES, KNOWN_ROLES, predBudgetModules(), predUserRole(), BusinessInvariant (+5 more)

### Community 87 - "drive-actions.ts"
Cohesion: 0.23
Nodes (18): POST(), ShareRow(), AccessSheet(), collectSubtree(), createFolder(), createOfficeNode(), deleteNode(), DENIED (+10 more)

### Community 88 - "meetings/[id]/page.tsx"
Cohesion: 0.11
Nodes (18): EditMeetingButton(), InviteResponse(), Resp, ManageParticipants(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink() (+10 more)

### Community 89 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (15): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep(), OnboardingWizard() (+7 more)

### Community 90 - "risks.ts"
Cohesion: 0.16
Nodes (20): adminRequestRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks() (+12 more)

### Community 91 - "extract-facts.ts"
Cohesion: 0.17
Nodes (19): CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput, extractFactsFromText(), FactHit, keywordFacts() (+11 more)

### Community 92 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 93 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 94 - "zip-inspector.ts"
Cohesion: 0.20
Nodes (19): BLOCKED_EXT, declaredSizes(), entryName(), extOf(), InspectOptions, inspectZip(), inspectZipFile(), inspectZipFileInner() (+11 more)

### Community 95 - "brain-cockpit.tsx"
Cohesion: 0.13
Nodes (16): AutopilotConfirm(), BrainCockpit(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji() (+8 more)

### Community 96 - "congress.ts"
Cohesion: 0.22
Nodes (17): CongressTable(), CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), EVENTS_TABS, CongressDetail, CongressListRow, CongressType (+9 more)

### Community 97 - "mail-client.tsx"
Cohesion: 0.15
Nodes (17): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+9 more)

### Community 98 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label() (+9 more)

### Community 99 - "rbac.test.ts"
Cohesion: 0.18
Nodes (16): RegulatoryRequestDetailPage(), RegulatoryRequestsPage(), NavTab, getRegRequest(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO (+8 more)

### Community 100 - "review-agent.ts"
Cohesion: 0.16
Nodes (14): extractJson(), aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding, AiFindingSchema, AiFn, AiOutputSchema (+6 more)

### Community 101 - "driver/page.tsx"
Cohesion: 0.18
Nodes (14): CorbeillePage(), CourseDTO, CoursesPage(), MissionActions(), DriverPage(), DemandesPage(), DRIVER_MISSION_STATUS, getAssistantData() (+6 more)

### Community 102 - "regulatory/page.tsx"
Cohesion: 0.14
Nodes (15): NewProductButton(), regStage(), RegulatoryPage(), CATEGORY_OPTS, Col, COLS, PRIORITY_CLASS, PRIORITY_OPTS (+7 more)

### Community 103 - "auth-actions.ts"
Cohesion: 0.16
Nodes (9): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenuProps, authenticate(), changePassword() (+1 more)

### Community 104 - "meetings.ts"
Cohesion: 0.20
Nodes (13): dynamic, PublicMeetPage(), PublicJoin(), canViewMeeting(), genPublicToken(), genSlug(), jitsiDomain(), MeetingAccessShape (+5 more)

### Community 105 - "products.ts"
Cohesion: 0.24
Nodes (14): dynamic, MarketProductsPage(), MarketProductSearchResult, clean(), getPchProducts(), MarketProduct, MarketSegment, PchProduct (+6 more)

### Community 106 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (12): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, SpaceSettingsButton(), UserOpt, archiveDriveSpace(), createDriveSpace(), deleteDriveSpace() (+4 more)

### Community 107 - "meeting-actions.ts"
Cohesion: 0.26
Nodes (15): acceptMeetingProposal(), addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink() (+7 more)

### Community 108 - "supplier/actions.ts"
Cohesion: 0.29
Nodes (14): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+6 more)

### Community 109 - "office-templates.ts"
Cohesion: 0.19
Nodes (14): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+6 more)

### Community 110 - "dossier-knowledge.ts"
Cohesion: 0.18
Nodes (15): bestValue(), DossierDoc, DossierFact, DossierKnowledge, DossierModuleNode, DossierPassage, DossierSectionNode, DossierTextHit (+7 more)

### Community 111 - "test-center-client.tsx"
Cohesion: 0.20
Nodes (12): ENV_LABEL, LaunchPanel(), MODES, ResumeCleanupButton(), MODES, PHASE1_MODES, resumeTestCleanup(), runTestCenter() (+4 more)

### Community 112 - "pch.ts"
Cohesion: 0.21
Nodes (14): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+6 more)

### Community 113 - "pch-tender-line-actions.ts"
Cohesion: 0.30
Nodes (14): enrichTenderLine(), int(), matchOurProduct(), MODULE, parseBoxSize(), parseLineStatus(), RawLine, allTokensIn() (+6 more)

### Community 114 - "tender-lines.tsx"
Cohesion: 0.21
Nodes (14): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+6 more)

### Community 115 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 116 - "courses-board.tsx"
Cohesion: 0.16
Nodes (12): CoursesBoard(), CourseStopDTO, deadlineLabel(), letter(), UserOpt, STATUS_ICON, STATUS_RING, StepItem (+4 more)

### Community 117 - "department-actions.ts"
Cohesion: 0.33
Nodes (13): DeptSheet(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName(), createDepartment(), deleteDepartment(), DENIED (+5 more)

### Community 118 - "topbar.tsx"
Cohesion: 0.22
Nodes (11): Company, CompanySwitcher(), getCtx(), MessagesIndicator(), notifyDesktop(), playPing(), unlockAudio(), ADOPTION_TONE (+3 more)

### Community 119 - "market/engine.ts"
Cohesion: 0.23
Nodes (13): allowedMfg(), bucket(), CompetitionRow, getOpportunities(), getRecommendations(), iqviaMarketByDci(), MarketBySource, OpportunitiesResult (+5 more)

### Community 120 - "validations.ts"
Cohesion: 0.18
Nodes (10): CONG_STAGE, CrossValidationItem, getMyValidationRequests(), getMyValidations(), getSupervisedValidations(), MyValidationItem, MyValidationStep, SPO_STAGE (+2 more)

### Community 121 - "test-center/page.tsx"
Cohesion: 0.18
Nodes (11): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+3 more)

### Community 122 - "adventum-actions.ts"
Cohesion: 0.27
Nodes (9): RiskThresholdsForm(), DENIED, updateRiskThresholds(), ProductRelations, DEFAULT_THRESHOLDS, RiskThresholds, THRESHOLD_FIELDS, ThresholdField (+1 more)

### Community 123 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 124 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 125 - "hr-documents.ts"
Cohesion: 0.27
Nodes (12): CommentItem, attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO (+4 more)

### Community 126 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 127 - "regulatory-request-actions.ts"
Cohesion: 0.29
Nodes (10): RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible(), parseCategory(), parsePriority(), parseStatus() (+2 more)

### Community 128 - "stocks-view.tsx"
Cohesion: 0.21
Nodes (11): HospitalDTO, LOC_UI, LocationDTO, ProductOpt, StocksView(), TabKey, TABS, todayInput() (+3 more)

### Community 129 - "directive-actions.ts"
Cohesion: 0.38
Nodes (10): archiveDirective(), canManage(), canParticipate(), createDirective(), DirectiveLike, nextRef(), postDirectiveMessage(), revalidate() (+2 more)

### Community 130 - "getMarketData"
Cohesion: 0.30
Nodes (11): getMarketData(), buildCompetition(), getPriceForDci(), HospitalRow, matchIqvia(), matchPch(), PriceForDci, PriceStats (+3 more)

### Community 131 - "activity/page.tsx"
Cohesion: 0.24
Nodes (9): ActivityRow, ActivityTable(), TYPE, ActivityPage(), fmtDuration(), StatusBadgeProps, BadgeProps, BadgeTone (+1 more)

### Community 132 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 133 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 134 - "congress-beneficiary-actions.ts"
Cohesion: 0.42
Nodes (10): addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf(), removeCongressBeneficiary() (+2 more)

### Community 135 - "radar.ts"
Cohesion: 0.31
Nodes (10): RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates(), getRadarExpirations(), getRadarNew() (+2 more)

### Community 136 - "regulatory-drive-mirror.ts"
Cohesion: 0.35
Nodes (9): cleanPathSegments(), ensureFolder(), EXT_MIME, mimeFromName(), MirrorEntry, mirrorRegulatoryUpload(), MirrorResult, mirrorToProductDrive() (+1 more)

### Community 137 - "dossiers.ts"
Cohesion: 0.29
Nodes (9): LinkToDossier(), DossierDetailPage(), listLinkableDossiers(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), isDossierMember() (+1 more)

### Community 138 - "WorkflowView"
Cohesion: 0.22
Nodes (9): Props, BudgetCategoryOption, DefinitionAdminView, WorkflowView, defaultDefinition(), defaultSpine(), CATEGORY_LABELS, StepInput (+1 more)

### Community 139 - "new-conversation.tsx"
Cohesion: 0.22
Nodes (6): fd(), MemberMultiSelect(), Mode, Props, SearchBox(), ChannelDTO

### Community 140 - "data.ts"
Cohesion: 0.20
Nodes (9): Cache, DIR, LabRow, loadNdjson(), MarketMeta, NomRow, PchRow, SRC_IQVIA (+1 more)

### Community 141 - "bd.ts"
Cohesion: 0.31
Nodes (9): BdProductDTO, BdProjectDTO, BdRangeDTO, dec(), getBdProject(), getBdProjects(), ProjectRow, toDTO() (+1 more)

### Community 142 - "market-presentation-actions.ts"
Cohesion: 0.36
Nodes (7): PresentationCard(), Res, deletePresentation(), generatePresentation(), MODULE, regeneratePresentation(), renamePresentation()

### Community 143 - "meetings/page.tsx"
Cohesion: 0.28
Nodes (7): MeetingsTabs(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 144 - "departments-manager.tsx"
Cohesion: 0.28
Nodes (7): CompanyOpt, DepartmentsManager(), EmpOpt, Result, SheetState, UnassignedPanel(), useRun()

### Community 145 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 146 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 147 - "calendar-view.tsx"
Cohesion: 0.29
Nodes (6): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CALENDAR_EVENT_KIND

### Community 148 - "meeting-chat.tsx"
Cohesion: 0.32
Nodes (7): ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), deleteMeetingMessage(), postMeetingMessage()

### Community 149 - "missions.ts"
Cohesion: 0.36
Nodes (7): MyMissionsPage(), getMyMissions(), hydrate(), MissionCommentDTO, pathFor(), resolveParents(), Row

### Community 150 - "promo-material.ts"
Cohesion: 0.39
Nodes (7): CompanyLite, getPromoMaterials(), PromoDetail, PromoListItem, promoNames(), resolveNames(), scopePromoMaterial()

### Community 151 - "scheduled.ts"
Cohesion: 0.46
Nodes (7): pruneStaleUploadSessions(), accrueMonthlyLeave(), algiersYm(), runScheduledJobs(), sendDueMeetingReminders(), sendDuePayrollNotifications(), sendDueReminders()

### Community 152 - "congress-request-form.tsx"
Cohesion: 0.33
Nodes (4): CongressRequestButton(), DoctorOpt, PM_ROLES, UserOpt

### Community 153 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 154 - "forecast-grid.tsx"
Cohesion: 0.43
Nodes (6): Draft, fmtDZD(), ForecastGrid(), nOr0(), Row, toDraft()

### Community 155 - "pulse-strip.tsx"
Cohesion: 0.33
Nodes (5): ago(), Delta(), Metric(), PulseStrip(), PulseView

### Community 156 - "push-register.tsx"
Cohesion: 0.57
Nodes (6): EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array()

### Community 157 - "draft.ts"
Cohesion: 0.57
Nodes (5): AiFn, buildSupplierEmailDraft(), DraftInput, draftSupplierEmail(), fmtDate()

### Community 158 - "visits-table.tsx"
Cohesion: 0.33
Nodes (5): DeleteVisitButton(), EditVisitSheet(), Opt, Result, VisitRow

### Community 159 - "pch-detail-client.tsx"
Cohesion: 0.40
Nodes (4): Action, EditTenderButton(), useSubmit(), PCH_ORDER_STATUS

### Community 160 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 161 - "employee-form.tsx"
Cohesion: 0.33
Nodes (3): EmployeeFormValues, Option, Props

### Community 162 - "validation-item-review.tsx"
Cohesion: 0.40
Nodes (5): Decision, ItemReview(), LABEL, pill(), TONE

### Community 163 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 164 - "directives/[id]/panel.tsx"
Cohesion: 0.60
Nodes (4): MessageForm(), set(), StatusActions(), useAction()

### Community 165 - "activity-tracker.tsx"
Cohesion: 0.50
Nodes (4): ActivityTracker(), Geo, send(), UAData

### Community 166 - "notification-chime.tsx"
Cohesion: 0.80
Nodes (4): audio(), desktop(), NotificationChime(), playChime()

### Community 167 - "mission-stops.tsx"
Cohesion: 0.67
Nodes (3): letter(), MissionStops(), StopDTO

### Community 168 - "office-editor.tsx"
Cohesion: 0.67
Nodes (3): OfficeEditor(), originOf(), Window

## Knowledge Gaps
- **987 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+982 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma.ts` to `requireUser`, `card.tsx`, `badge.tsx`, `requireModule`, `getCurrentUser`, `lib/labels.ts`, `[dossierId]/page.tsx`, `upload/session.ts`, `drive-storage.ts`, `mail.ts`, `notifyUser`, `getAppSettings`, `input.tsx`, `fdStr`, `page-header.tsx`, `test-center/runner.ts`, `finances/page.tsx`, `notifyRoles`, `utils.ts`, `budget-board.tsx`, `lib/session.ts`, `promo-material-actions.ts`, `jobs/runner.ts`, `onlyofficeConfigured`, `assistant-actions.ts`, `actions/types.ts`, `adoption.ts`, `canAccessEntity`, `hr-document-actions.ts`, `regAudit`, `assistant.ts`, `rules/admin-actions.ts`, `medical-directory.tsx`, `aiConfigured`, `build-facts.ts`, `enregistrement/page.tsx`, `sales-planning-actions.ts`, `ai/page.tsx`, `hasGlobalView`, `drive/page.tsx`, `platform-audit/engine.ts`, `agent-core.ts`, `budget.ts`, `messaging-actions.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `SessionUser`, `storage.ts`, `auth.ts`, `lib/messaging.ts`, `workflow-builder.tsx`, `congress-request-actions.ts`, `field-report-actions.ts`, `explorer.ts`, `entity-access.ts`, `Button`, `(app)/layout.tsx`, `rbac.ts`, `lib/ai.ts`, `workflow.ts`, `calendar.ts`, `departments.ts`, `lifecycle/actions.ts`, `workflow/engine.ts`, `migration-cert.ts`, `market-research.ts`, `adventum-brain/page.tsx`, `event-form.tsx`, `regulatory-actions.ts`, `generate.ts`, `invariants/registry.ts`, `drive-actions.ts`, `meetings/[id]/page.tsx`, `onboarding-wizard.tsx`, `risks.ts`, `admin-settings-forms.tsx`, `congress.ts`, `process-intelligence.ts`, `rbac.test.ts`, `driver/page.tsx`, `regulatory/page.tsx`, `auth-actions.ts`, `meetings.ts`, `drive-space-manager.tsx`, `meeting-actions.ts`, `supplier/actions.ts`, `dossier-knowledge.ts`, `test-center-client.tsx`, `pch.ts`, `pch-tender-line-actions.ts`, `dashboard.ts`, `department-actions.ts`, `validations.ts`, `adventum-actions.ts`, `supplier-auth.ts`, `hr-documents.ts`, `push.ts`, `regulatory-request-actions.ts`, `directive-actions.ts`, `activity/page.tsx`, `reminder-actions.ts`, `congress-beneficiary-actions.ts`, `regulatory-drive-mirror.ts`, `dossiers.ts`, `bd.ts`, `market-presentation-actions.ts`, `meetings/page.tsx`, `missions.ts`, `promo-material.ts`, `scheduled.ts`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `card.tsx`, `badge.tsx`, `directive-actions.ts`, `getCurrentUser`, `lib/labels.ts`, `congress-beneficiary-actions.ts`, `reminder-actions.ts`, `requireModule`, `dossiers.ts`, `notifyUser`, `getAppSettings`, `fdStr`, `market-presentation-actions.ts`, `notifyRoles`, `meeting-chat.tsx`, `missions.ts`, `lib/session.ts`, `budget-board.tsx`, `promo-material-actions.ts`, `onlyofficeConfigured`, `assistant-actions.ts`, `actions/types.ts`, `canAccessEntity`, `hr-document-actions.ts`, `regAudit`, `anpp-process.tsx`, `rules/admin-actions.ts`, `medical-directory.tsx`, `aiConfigured`, `enregistrement/page.tsx`, `sales-planning-actions.ts`, `hasGlobalView`, `platform-audit/engine.ts`, `messaging-actions.ts`, `dossier-actions.ts`, `SessionUser`, `storage.ts`, `lib/messaging.ts`, `workflow-builder.tsx`, `congress-request-actions.ts`, `field-report-actions.ts`, `entity-access.ts`, `Button`, `(app)/layout.tsx`, `ocr-engine.ts`, `aiModel`, `lib/ai.ts`, `lifecycle/actions.ts`, `messenger.tsx`, `regulatory-actions.ts`, `drive-actions.ts`, `onboarding-wizard.tsx`, `brain-cockpit.tsx`, `congress.ts`, `rbac.test.ts`, `auth-actions.ts`, `products.ts`, `drive-space-manager.tsx`, `meeting-actions.ts`, `supplier/actions.ts`, `test-center-client.tsx`, `pch-tender-line-actions.ts`, `tender-lines.tsx`, `courses-board.tsx`, `department-actions.ts`, `adventum-actions.ts`, `regulatory-request-actions.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `userCan()` connect `requireUser` to `card.tsx`, `badge.tsx`, `requireModule`, `directive-actions.ts`, `lib/labels.ts`, `reminder-actions.ts`, `prisma.ts`, `drive-storage.ts`, `mail.ts`, `dossiers.ts`, `getAppSettings`, `notifyUser`, `fdStr`, `page-header.tsx`, `market-presentation-actions.ts`, `finances/page.tsx`, `notifyRoles`, `utils.ts`, `budget-board.tsx`, `promo-material.ts`, `lib/session.ts`, `promo-material-actions.ts`, `onlyofficeConfigured`, `assistant-actions.ts`, `actions/types.ts`, `adoption.ts`, `canAccessEntity`, `hr-document-actions.ts`, `assistant.ts`, `medical-directory.tsx`, `sales-planning-actions.ts`, `ai/page.tsx`, `hasGlobalView`, `drive/page.tsx`, `budget.ts`, `messaging-actions.ts`, `queries/messaging.ts`, `dossier-actions.ts`, `SessionUser`, `lib/messaging.ts`, `congress-request-actions.ts`, `field-report-actions.ts`, `entity-access.ts`, `Button`, `(app)/layout.tsx`, `rbac.ts`, `ocr-engine.ts`, `aiModel`, `lib/ai.ts`, `workflow.ts`, `calendar.ts`, `departments.ts`, `market-research.ts`, `adventum-brain/page.tsx`, `regulatory-actions.ts`, `drive-actions.ts`, `congress.ts`, `process-intelligence.ts`, `rbac.test.ts`, `driver/page.tsx`, `regulatory/page.tsx`, `products.ts`, `meeting-actions.ts`, `pch-tender-line-actions.ts`, `tender-lines.tsx`, `dashboard.ts`, `department-actions.ts`, `validations.ts`, `test-center/page.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _987 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.04827466016033461 - nodes in this community are weakly interconnected._
- **Should `card.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05997001499250375 - nodes in this community are weakly interconnected._
- **Should `badge.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07169554875976894 - nodes in this community are weakly interconnected._