# Graph Report - src  (2026-07-06)

## Corpus Check
- 493 files · ~308,102 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2830 nodes · 12535 edges · 96 communities (93 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ad5d203`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_button.tsx|button.tsx]]
- [[_COMMUNITY_labels.ts|labels.ts]]
- [[_COMMUNITY_requireUser|requireUser]]
- [[_COMMUNITY_status-badge.tsx|status-badge.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_engine.ts|engine.ts]]
- [[_COMMUNITY_hasGlobalView|hasGlobalView]]
- [[_COMMUNITY_utils.ts|utils.ts]]
- [[_COMMUNITY_fdStr|fdStr]]
- [[_COMMUNITY_formatCurrency|formatCurrency]]
- [[_COMMUNITY_admin-request-actions.ts|admin-request-actions.ts]]
- [[_COMMUNITY_session.ts|session.ts]]
- [[_COMMUNITY_mail.ts|mail.ts]]
- [[_COMMUNITY_requireModule|requireModule]]
- [[_COMMUNITY_adoption.ts|adoption.ts]]
- [[_COMMUNITY_promo-material-actions.ts|promo-material-actions.ts]]
- [[_COMMUNITY_budget-board.tsx|budget-board.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_dossier-actions.ts|dossier-actions.ts]]
- [[_COMMUNITY_getAppSettings|getAppSettings]]
- [[_COMMUNITY_audit.ts|audit.ts]]
- [[_COMMUNITY_assistant.ts|assistant.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_rbac.ts|rbac.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_ai.ts|ai.ts]]
- [[_COMMUNITY_engine.ts|engine.ts]]
- [[_COMMUNITY_bd-strategic-table.tsx|bd-strategic-table.tsx]]
- [[_COMMUNITY_format.tsx|format.tsx]]
- [[_COMMUNITY_workflow-builder.tsx|workflow-builder.tsx]]
- [[_COMMUNITY_drive-actions.ts|drive-actions.ts]]
- [[_COMMUNITY_messaging-actions.ts|messaging-actions.ts]]
- [[_COMMUNITY_auth.ts|auth.ts]]
- [[_COMMUNITY_getCurrentUser|getCurrentUser]]
- [[_COMMUNITY_messaging.ts|messaging.ts]]
- [[_COMMUNITY_assistant-actions.ts|assistant-actions.ts]]
- [[_COMMUNITY_onlyoffice.ts|onlyoffice.ts]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_optionsFromMap|optionsFromMap]]
- [[_COMMUNITY_support-actions.ts|support-actions.ts]]
- [[_COMMUNITY_adventum-actions.ts|adventum-actions.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_messenger.tsx|messenger.tsx]]
- [[_COMMUNITY_hr-document-actions.ts|hr-document-actions.ts]]
- [[_COMMUNITY_getAccess|getAccess]]
- [[_COMMUNITY_mail-client.tsx|mail-client.tsx]]
- [[_COMMUNITY_calendar.ts|calendar.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_topbar.tsx|topbar.tsx]]
- [[_COMMUNITY_onboarding-wizard.tsx|onboarding-wizard.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_formatDateTime|formatDateTime]]
- [[_COMMUNITY_formatAlgiers|formatAlgiers]]
- [[_COMMUNITY_SessionUser|SessionUser]]
- [[_COMMUNITY_workflow.ts|workflow.ts]]
- [[_COMMUNITY_document-preview.tsx|document-preview.tsx]]
- [[_COMMUNITY_meetings.ts|meetings.ts]]
- [[_COMMUNITY_risks.ts|risks.ts]]
- [[_COMMUNITY_messaging.ts|messaging.ts]]
- [[_COMMUNITY_prisma.ts|prisma.ts]]
- [[_COMMUNITY_directive-actions.ts|directive-actions.ts]]
- [[_COMMUNITY_process-intelligence.ts|process-intelligence.ts]]
- [[_COMMUNITY_new-conversation.tsx|new-conversation.tsx]]
- [[_COMMUNITY_brain-cockpit.tsx|brain-cockpit.tsx]]
- [[_COMMUNITY_meeting-actions.ts|meeting-actions.ts]]
- [[_COMMUNITY_office-templates.ts|office-templates.ts]]
- [[_COMMUNITY_dashboard.ts|dashboard.ts]]
- [[_COMMUNITY_field-reports.ts|field-reports.ts]]
- [[_COMMUNITY_assistant-chat.tsx|assistant-chat.tsx]]
- [[_COMMUNITY_calendar-view.tsx|calendar-view.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_drive.ts|drive.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_supplier-auth.ts|supplier-auth.ts]]
- [[_COMMUNITY_medical.ts|medical.ts]]
- [[_COMMUNITY_admin-settings-forms.tsx|admin-settings-forms.tsx]]
- [[_COMMUNITY_congress-workflow.tsx|congress-workflow.tsx]]
- [[_COMMUNITY_congress.ts|congress.ts]]
- [[_COMMUNITY_admin-delete-actions.ts|admin-delete-actions.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_push.ts|push.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_module-access-grid.tsx|module-access-grid.tsx]]
- [[_COMMUNITY_ai-settings-form.tsx|ai-settings-form.tsx]]
- [[_COMMUNITY_anyRoleFilter|anyRoleFilter]]
- [[_COMMUNITY_next-auth.d.ts|next-auth.d.ts]]
- [[_COMMUNITY_roles-table.tsx|roles-table.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_office-editor.tsx|office-editor.tsx]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_progress.tsx|progress.tsx]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_{ GET, POST }|{ GET, POST }]]

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 379 edges
2. `userCan()` - 339 edges
3. `fdStr()` - 331 edges
4. `recordAudit()` - 287 edges
5. `requireModule()` - 162 edges
6. `hasGlobalView()` - 128 edges
7. `cn()` - 120 edges
8. `formatDate()` - 119 edges
9. `Button` - 109 edges
10. `formatCurrency()` - 91 edges

## Surprising Connections (you probably didn't know these)
- `CongressRequestButton()` --indirect_call--> `form()`  [INFERRED]
  src/app/(app)/congress-international/congress-request-form.tsx → src/lib/actions/promo-material-flow.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts
- `AdminSettingsPage()` --indirect_call--> `label()`  [INFERRED]
  src/app/(app)/admin/settings/page.tsx → src/lib/queries/process-intelligence.ts

## Import Cycles
- None detected.

## Communities (96 total, 3 thin omitted)

### Community 0 - "button.tsx"
Cohesion: 0.04
Nodes (81): DriveStorageSettings(), EntityRow, PALETTE, GrantOption, RowGrantsProps, Option, RuleDTO, DoctorOpt (+73 more)

### Community 1 - "labels.ts"
Cohesion: 0.03
Nodes (101): ActivityRow, ActivityTable(), TYPE, BudgetRow, MONTHS, BDPipeline(), STAGES, BDRow (+93 more)

### Community 2 - "requireUser"
Cohesion: 0.06
Nodes (105): NodeActions(), RegistrationsManager(), EditTenderButton(), OrdersManager(), useSubmit(), AVATAR_COLORS, createUser(), setSecondaryRole() (+97 more)

### Community 3 - "status-badge.tsx"
Cohesion: 0.06
Nodes (62): BD_DOC_CATEGORIES, ProjectEditor(), ProjectStatusBadge(), BeneficiariesCard(), Beneficiary, Budget(), CONGRESS_DOC_CATEGORIES, CongressDetailView() (+54 more)

### Community 4 - "page.tsx"
Cohesion: 0.05
Nodes (71): SupplyArticleRow, OpeningBalance, OpeningBalancesButton(), DciAssociationField(), EditProductButton(), EditProductValues, UserOption, RegulatoryChecklist() (+63 more)

### Community 5 - "engine.ts"
Cohesion: 0.06
Nodes (74): fmtPct(), MarketCompetitionPage(), MODES, pctTone(), fmtPct(), MarketRadarPage(), ClassCompetition, ClassCompetitionSummary (+66 more)

### Community 6 - "hasGlobalView"
Cohesion: 0.07
Nodes (70): CorbeillePage(), decideApproval(), runAutopilot(), createCalendarEvent(), deleteCalendarEvent(), INVITE_STATUSES, parseKind(), respondToInvite() (+62 more)

### Community 7 - "utils.ts"
Cohesion: 0.11
Nodes (47): AdoptionTable(), TYPES, Mode, Tab, TABS, Chip(), MoveTarget, MONTHS (+39 more)

### Community 8 - "fdStr"
Cohesion: 0.07
Nodes (70): DoctorSheet(), SpecialtiesManager(), useSubmit(), createBD(), updateBDStatus(), addBdProjectComment(), createBdProduct(), createBdProject() (+62 more)

### Community 9 - "formatCurrency"
Cohesion: 0.07
Nodes (56): CategoryCard(), ComptaCockpit(), ComptaData, ItemTable(), RecettesDepensesChart(), OrdresDepensePage(), DONUT_COLORS, FinancesPage() (+48 more)

### Community 10 - "admin-request-actions.ts"
Cohesion: 0.07
Nodes (56): RuleControls(), RuleEditor(), RestoreButton(), RequestActions(), U, addRequestComment(), archiveAdminRequestIfDone(), assignRequest() (+48 more)

### Community 11 - "session.ts"
Cohesion: 0.09
Nodes (36): ACTION_FR, ROW_SCOPED, ActivityPage(), fmtDuration(), metadata, FEATURE_LABEL, metadata, AdminPage() (+28 more)

### Community 12 - "mail.ts"
Cohesion: 0.08
Nodes (46): POST(), GET(), GET(), GET(), GET(), disconnectMailbox(), sendMailAction(), acquirePooled() (+38 more)

### Community 13 - "requireModule"
Cohesion: 0.07
Nodes (37): AccessByModulePage(), CorbeillePage(), EntitesPage(), FeedbackStatusSelect(), AdminFeedbackPage(), FieldDefDTO, FieldsManager(), CustomFieldsPage() (+29 more)

### Community 14 - "adoption.ts"
Cohesion: 0.07
Nodes (46): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), MonDossierPage(), ADOPTION_TARGET_FIELDS, ADOPTION_THRESHOLD_FIELDS (+38 more)

### Community 15 - "promo-material-actions.ts"
Cohesion: 0.15
Nodes (42): AuditPanel(), CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), ActivityTracker(), Geo (+34 more)

### Community 16 - "budget-board.tsx"
Cohesion: 0.10
Nodes (42): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), BudgetBoard(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard(), CategorySheet() (+34 more)

### Community 17 - "page.tsx"
Cohesion: 0.07
Nodes (35): CreateEventButton(), d10(), EditEventButton(), EventFields(), Result, EventFundingPanel(), Props, SubmitButton() (+27 more)

### Community 18 - "dossier-actions.ts"
Cohesion: 0.12
Nodes (33): DossierDetailPage(), DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), useAction(), UserLite, archiveDossier() (+25 more)

### Community 19 - "getAppSettings"
Cohesion: 0.15
Nodes (25): POST(), POST(), POST(), POST(), POST(), POST(), destroyDeletedRecord(), ActionResult (+17 more)

### Community 20 - "audit.ts"
Cohesion: 0.10
Nodes (25): EntitiesManager(), ActiveToggle(), ImpersonateButton(), computeStatus(), createBudget(), canManageCompanies(), createCompany(), setCompanyScope() (+17 more)

### Community 21 - "assistant.ts"
Cohesion: 0.09
Nodes (34): MedicalDirectory(), callClaude(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue() (+26 more)

### Community 22 - "page.tsx"
Cohesion: 0.13
Nodes (28): AccessMatrix(), ACTION_COLS, ACTION_LABELS, ModuleAccessRow, ACTION_FR, ROW_SCOPED, RowGrants(), deviceIcon() (+20 more)

### Community 23 - "rbac.ts"
Cohesion: 0.08
Nodes (27): AdminUserPage(), NavTab, ACTIONS, ALL, can(), CONTRIBUTE, defaultScope(), DIRECTIVES_USER (+19 more)

### Community 24 - "page.tsx"
Cohesion: 0.10
Nodes (28): BudgetsTable(), AggNum(), fmtDzd(), fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone() (+20 more)

### Community 25 - "ai.ts"
Cohesion: 0.10
Nodes (29): ReportEditor(), SimpleReportEditor(), NewReportButton(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment() (+21 more)

### Community 26 - "engine.ts"
Cohesion: 0.11
Nodes (30): getWorkflowDefinitions(), defaultDefinition(), defaultSpine(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), ensureInstance() (+22 more)

### Community 27 - "bd-strategic-table.tsx"
Cohesion: 0.10
Nodes (27): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+19 more)

### Community 28 - "format.tsx"
Cohesion: 0.14
Nodes (24): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+16 more)

### Community 29 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (24): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+16 more)

### Community 30 - "drive-actions.ts"
Cohesion: 0.12
Nodes (18): ConvertPdfButton(), DriveFilePage(), humanSize(), ShareItem, SharePanel(), NewOfficeButton(), convertNodeToPdf(), createOfficeNode() (+10 more)

### Community 31 - "messaging-actions.ts"
Cohesion: 0.18
Nodes (28): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+20 more)

### Community 32 - "auth.ts"
Cohesion: 0.12
Nodes (19): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), credentialsSchema, { handlers, auth, signIn, signOut }, clientIp() (+11 more)

### Community 33 - "getCurrentUser"
Cohesion: 0.15
Nodes (20): GET(), GET(), GET(), esc(), GET(), GET(), DELETE(), POST() (+12 more)

### Community 34 - "messaging.ts"
Cohesion: 0.14
Nodes (24): GET(), GET(), GET(), MessagesPage(), presenceOf(), preview(), getTyping(), AttachmentDTO (+16 more)

### Community 35 - "assistant-actions.ts"
Cohesion: 0.15
Nodes (24): GET(), AiControlCenterPage(), BrainCockpit(), askBrain(), generateBriefing(), assistantChat(), assistantNudge(), aiConfigured() (+16 more)

### Community 36 - "onlyoffice.ts"
Cohesion: 0.19
Nodes (22): DocumentEditPage(), ENTITY_ROUTE, DriveEditPage(), convertDocument(), ConvertOpts, ConvertResponse, appBaseUrl(), b64url() (+14 more)

### Community 37 - "layout.tsx"
Cohesion: 0.12
Nodes (21): AppLayout(), CommandPalette(), Item, SearchResult, ImpersonationBanner(), EnablePushButton(), getKey(), PushRegister() (+13 more)

### Community 38 - "optionsFromMap"
Cohesion: 0.11
Nodes (22): BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), NewRequestButton(), SuppliesManager(), DossiersPage(), MedicalPage(), AdvanceItem, MyAdvances() (+14 more)

### Community 39 - "support-actions.ts"
Cohesion: 0.16
Nodes (22): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+14 more)

### Community 40 - "adventum-actions.ts"
Cohesion: 0.15
Nodes (20): RelationsTab(), AdventumBrainPage(), BLOCK_CATS, RiskThresholdsForm(), DENIED, searchRelations(), updateRiskThresholds(), getProductRelations() (+12 more)

### Community 41 - "page.tsx"
Cohesion: 0.11
Nodes (21): AdminValidationsPage(), dec(), AssistantPage(), ActionRow(), MonTravailPage(), ValidationsPage(), VALIDATION_MODE, WORKSPACE_TABS (+13 more)

### Community 42 - "messenger.tsx"
Cohesion: 0.15
Nodes (22): ConvAvatar(), ConversationList(), Filter, Props, PresenceDot(), relativeTime(), Props, bumpConversation() (+14 more)

### Community 43 - "hr-document-actions.ts"
Cohesion: 0.17
Nodes (21): CancelRequestButton(), RequestRow(), MONTHS, PayrollCell, PayrollMatrix(), PayrollRow, ym(), archiveHrRequestIfDone() (+13 more)

### Community 44 - "getAccess"
Cohesion: 0.12
Nodes (17): Msg, NudgeResult, actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+9 more)

### Community 45 - "mail-client.tsx"
Cohesion: 0.12
Nodes (19): ConnectMailbox(), AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize() (+11 more)

### Community 46 - "calendar.ts"
Cohesion: 0.21
Nodes (20): CalendarPage(), CalendarInviteeDTO, EventRow, getCalendarEvent(), getCalendarEvents(), getScheduledMeetingsAsEvents(), getUpcomingEvents(), includeRel (+12 more)

### Community 47 - "page.tsx"
Cohesion: 0.14
Nodes (15): CongressRequestButton(), CongressTable(), CongressInternationalPage(), CongressNationalPage(), DriveRow, DriveTable(), KIND_ICON, EventsPage() (+7 more)

### Community 48 - "topbar.tsx"
Cohesion: 0.13
Nodes (16): ChangePasswordForm(), ChangePasswordPage(), metadata, Company, CompanySwitcher(), getCtx(), MessagesIndicator(), playPing() (+8 more)

### Community 49 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (13): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, OnboardingWizard(), Props (+5 more)

### Community 50 - "page.tsx"
Cohesion: 0.20
Nodes (17): GET(), DocumentRow, DocumentsPage(), SearchPage(), executeReadTool(), DOCS_TABS, accessibleDocumentWhere(), ALL_ENTITY_TYPES (+9 more)

### Community 51 - "formatDateTime"
Cohesion: 0.14
Nodes (15): AuditRow, AuditTable(), TrashItem, TrashList(), RequestDetailPage(), MessageForm(), set(), StatusActions() (+7 more)

### Community 52 - "formatAlgiers"
Cohesion: 0.17
Nodes (15): CourseDTO, CoursesPage(), MissionActions(), letter(), MissionStops(), StopDTO, DriverPage(), formatDateTime() (+7 more)

### Community 53 - "SessionUser"
Cohesion: 0.26
Nodes (17): DeclarationDetailPage(), addMedicalInfoComment(), cancelDocRequest(), canManage(), fulfillDocRequest(), recordAuthorityDeclaration(), refreshStatus(), requestDocument() (+9 more)

### Community 54 - "workflow.ts"
Cohesion: 0.19
Nodes (15): CongressIntlDetailPage(), CongressNatDetailPage(), EventDetailPage(), SponsoringDetailPage(), getBudgetCategoryOptions(), getEntityMissions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView (+7 more)

### Community 55 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 56 - "meetings.ts"
Cohesion: 0.20
Nodes (14): MeetingDetailPage(), PublicMeetPage(), PublicJoin(), canManageMeeting(), canViewMeeting(), genPublicToken(), genSlug(), jitsiDomain() (+6 more)

### Community 57 - "risks.ts"
Cohesion: 0.17
Nodes (18): congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS, directiveRisks(), firstActive() (+10 more)

### Community 58 - "messaging.ts"
Cohesion: 0.18
Nodes (15): GET(), parseAttachments(), parseRef(), sendMessage(), validParent(), blobSecret(), PRESENCE_LABEL, sanitizeMentionIds() (+7 more)

### Community 59 - "prisma.ts"
Cohesion: 0.18
Nodes (10): GET(), GET(), addFile(), ArchiveAttachment, ArchiveBureau, archiveProcessedRequest(), ensureFolder(), globalForPrisma (+2 more)

### Community 60 - "directive-actions.ts"
Cohesion: 0.24
Nodes (14): DirectiveDetailPage(), archiveDirective(), canManage(), canParticipate(), createDirective(), DirectiveLike, nextRef(), postDirectiveMessage() (+6 more)

### Community 61 - "process-intelligence.ts"
Cohesion: 0.17
Nodes (16): eventValidationSteps(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label(), ModuleStat (+8 more)

### Community 62 - "new-conversation.tsx"
Cohesion: 0.15
Nodes (10): badgeTone, TONE_BAR, TONE_TEXT, MemberMultiSelect(), Mode, SearchBox(), Avatar(), AvatarProps (+2 more)

### Community 63 - "brain-cockpit.tsx"
Cohesion: 0.15
Nodes (12): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+4 more)

### Community 64 - "meeting-actions.ts"
Cohesion: 0.28
Nodes (14): addMeetingParticipants(), deleteMeeting(), DENIED, dismissMeetingProposal(), endMeeting(), loadManaged(), normalizeLink(), removeMeetingParticipant() (+6 more)

### Community 65 - "office-templates.ts"
Cohesion: 0.21
Nodes (14): Attachments(), blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT (+6 more)

### Community 66 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 67 - "field-reports.ts"
Cohesion: 0.25
Nodes (11): GET(), FieldReportPage(), FieldReportsPage(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem, getFieldReportDetail(), getFieldReportsAggregation() (+3 more)

### Community 68 - "assistant-chat.tsx"
Cohesion: 0.19
Nodes (10): ActionState, AssistantChat(), cleanReply(), MessageBubble(), nextId(), SUGGESTIONS, FloatingAssistant(), executeAssistantAction() (+2 more)

### Community 69 - "calendar-view.tsx"
Cohesion: 0.19
Nodes (12): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, CalendarEventDTO (+4 more)

### Community 70 - "page.tsx"
Cohesion: 0.16
Nodes (10): EditMeetingButton(), MeetJoin(), ManageBar(), ProposalActions(), ShareLink(), TranscriptPanel(), MeetingRecorder(), externalBase() (+2 more)

### Community 71 - "drive.ts"
Cohesion: 0.24
Nodes (12): DrivePage(), humanSize(), DriveAccessLevel, driveBreadcrumb(), DriveListing, DriveNodeRow, getDriveListing(), nodeArgs() (+4 more)

### Community 72 - "page.tsx"
Cohesion: 0.31
Nodes (9): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), FulfillForm(), RequestDocForm(), useAction(), UserOpt, ValidateButton() (+1 more)

### Community 73 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 74 - "medical.ts"
Cohesion: 0.24
Nodes (10): Props, DelegatePlanDTO, DoctorDTO, getMedicalData(), mapDoctor(), MedicalData, MedicalVisitRow, SpecialtyDTO (+2 more)

### Community 75 - "admin-settings-forms.tsx"
Cohesion: 0.20
Nodes (9): AdminLimitsForm(), BroadcastComposer(), DIAG_TONE, DiagResult, Mailbox, MailDiagnosticPanel(), Opt, UserLite (+1 more)

### Community 76 - "congress-workflow.tsx"
Cohesion: 0.38
Nodes (9): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+1 more)

### Community 77 - "congress.ts"
Cohesion: 0.38
Nodes (9): CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail(), getCongressList(), userNameMap(), scopeCongressIntl() (+1 more)

### Community 78 - "admin-delete-actions.ts"
Cohesion: 0.36
Nodes (8): delegateOf(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, restoreDeletedRecord(), superAdminDelete()

### Community 79 - "route.ts"
Cohesion: 0.32
Nodes (5): NO_CONTENT, POST(), ConversationTyping, registry, setTyping()

### Community 80 - "push.ts"
Cohesion: 0.54
Nodes (6): GET(), ensureVapid(), keys(), pushConfigured(), PushPayload, vapidPublicKey()

### Community 81 - "route.ts"
Cohesion: 0.67
Nodes (5): POST(), GET(), readDocEditToken(), readEditToken(), verifyJwt()

### Community 82 - "module-access-grid.tsx"
Cohesion: 0.29
Nodes (6): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState

### Community 83 - "ai-settings-form.tsx"
Cohesion: 0.33
Nodes (5): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle()

### Community 84 - "anyRoleFilter"
Cohesion: 0.53
Nodes (5): CreateDeclarationInput, createMedicalInfoDeclaration(), nextDeclarationRef(), anyRoleFilter(), emitFinancials()

### Community 85 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 86 - "roles-table.tsx"
Cohesion: 0.40
Nodes (4): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS

### Community 87 - "page.tsx"
Cohesion: 0.40
Nodes (3): LoginForm(), metadata, authenticate()

### Community 88 - "office-editor.tsx"
Cohesion: 0.67
Nodes (3): OfficeEditor(), originOf(), Window

### Community 90 - "progress.tsx"
Cohesion: 0.50
Nodes (3): Progress(), ProgressProps, toneClass

## Knowledge Gaps
- **465 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+460 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `userCan()` connect `requireUser` to `labels.ts`, `status-badge.tsx`, `page.tsx`, `hasGlobalView`, `utils.ts`, `fdStr`, `formatCurrency`, `admin-request-actions.ts`, `session.ts`, `mail.ts`, `requireModule`, `adoption.ts`, `promo-material-actions.ts`, `budget-board.tsx`, `page.tsx`, `dossier-actions.ts`, `getAppSettings`, `audit.ts`, `assistant.ts`, `page.tsx`, `rbac.ts`, `ai.ts`, `bd-strategic-table.tsx`, `drive-actions.ts`, `messaging-actions.ts`, `getCurrentUser`, `messaging.ts`, `assistant-actions.ts`, `layout.tsx`, `optionsFromMap`, `support-actions.ts`, `adventum-actions.ts`, `page.tsx`, `hr-document-actions.ts`, `calendar.ts`, `page.tsx`, `page.tsx`, `formatDateTime`, `formatAlgiers`, `SessionUser`, `workflow.ts`, `messaging.ts`, `directive-actions.ts`, `meeting-actions.ts`, `dashboard.ts`, `field-reports.ts`, `drive.ts`, `page.tsx`, `route.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `status-badge.tsx`, `page.tsx`, `hasGlobalView`, `fdStr`, `admin-request-actions.ts`, `session.ts`, `mail.ts`, `requireModule`, `adoption.ts`, `promo-material-actions.ts`, `budget-board.tsx`, `dossier-actions.ts`, `getAppSettings`, `audit.ts`, `page.tsx`, `ai.ts`, `workflow-builder.tsx`, `drive-actions.ts`, `messaging-actions.ts`, `assistant-actions.ts`, `onlyoffice.ts`, `layout.tsx`, `support-actions.ts`, `adventum-actions.ts`, `messenger.tsx`, `hr-document-actions.ts`, `getAccess`, `page.tsx`, `topbar.tsx`, `onboarding-wizard.tsx`, `page.tsx`, `formatDateTime`, `SessionUser`, `messaging.ts`, `directive-actions.ts`, `meeting-actions.ts`, `assistant-chat.tsx`, `page.tsx`, `admin-delete-actions.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `requireModule()` connect `requireModule` to `requireUser`, `status-badge.tsx`, `page.tsx`, `engine.ts`, `hasGlobalView`, `utils.ts`, `formatCurrency`, `session.ts`, `adoption.ts`, `page.tsx`, `page.tsx`, `rbac.ts`, `page.tsx`, `bd-strategic-table.tsx`, `drive-actions.ts`, `messaging.ts`, `assistant-actions.ts`, `optionsFromMap`, `adventum-actions.ts`, `page.tsx`, `mail-client.tsx`, `calendar.ts`, `page.tsx`, `page.tsx`, `formatDateTime`, `formatAlgiers`, `workflow.ts`, `meetings.ts`, `field-reports.ts`, `page.tsx`, `drive.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _465 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.041756118505796476 - nodes in this community are weakly interconnected._
- **Should `labels.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.028444444444444446 - nodes in this community are weakly interconnected._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.062291757207011446 - nodes in this community are weakly interconnected._