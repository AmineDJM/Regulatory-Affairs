# Graph Report - src  (2026-07-04)

## Corpus Check
- 457 files · ~278,751 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2628 nodes · 11625 edges · 95 communities (91 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96f61e40`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_userCan|userCan]]
- [[_COMMUNITY_engine.ts|engine.ts]]
- [[_COMMUNITY_button.tsx|button.tsx]]
- [[_COMMUNITY_labels.ts|labels.ts]]
- [[_COMMUNITY_requireModule|requireModule]]
- [[_COMMUNITY_session.ts|session.ts]]
- [[_COMMUNITY_mail.ts|mail.ts]]
- [[_COMMUNITY_rbac.ts|rbac.ts]]
- [[_COMMUNITY_status-badge.tsx|status-badge.tsx]]
- [[_COMMUNITY_canAccessEntity|canAccessEntity]]
- [[_COMMUNITY_recordAudit|recordAudit]]
- [[_COMMUNITY_utils.ts|utils.ts]]
- [[_COMMUNITY_cn|cn]]
- [[_COMMUNITY_budget-board.tsx|budget-board.tsx]]
- [[_COMMUNITY_requireUser|requireUser]]
- [[_COMMUNITY_promo-material-actions.ts|promo-material-actions.ts]]
- [[_COMMUNITY_meeting-actions.ts|meeting-actions.ts]]
- [[_COMMUNITY_hasGlobalView|hasGlobalView]]
- [[_COMMUNITY_onlyoffice.ts|onlyoffice.ts]]
- [[_COMMUNITY_assistant.ts|assistant.ts]]
- [[_COMMUNITY_adventum-actions.ts|adventum-actions.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_calendar-view.tsx|calendar-view.tsx]]
- [[_COMMUNITY_risks.ts|risks.ts]]
- [[_COMMUNITY_message-thread.tsx|message-thread.tsx]]
- [[_COMMUNITY_getCurrentUser|getCurrentUser]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_messaging-actions.ts|messaging-actions.ts]]
- [[_COMMUNITY_anpp-process.tsx|anpp-process.tsx]]
- [[_COMMUNITY_Select|Select]]
- [[_COMMUNITY_dossier-actions.ts|dossier-actions.ts]]
- [[_COMMUNITY_drive-actions.ts|drive-actions.ts]]
- [[_COMMUNITY_pch-detail-client.tsx|pch-detail-client.tsx]]
- [[_COMMUNITY_badge.tsx|badge.tsx]]
- [[_COMMUNITY_adoption.ts|adoption.ts]]
- [[_COMMUNITY_validation-actions.ts|validation-actions.ts]]
- [[_COMMUNITY_congress-detail-view.tsx|congress-detail-view.tsx]]
- [[_COMMUNITY_admin-request-actions.ts|admin-request-actions.ts]]
- [[_COMMUNITY_medical-info-actions.ts|medical-info-actions.ts]]
- [[_COMMUNITY_support-actions.ts|support-actions.ts]]
- [[_COMMUNITY_congress-request-actions.ts|congress-request-actions.ts]]
- [[_COMMUNITY_auth.ts|auth.ts]]
- [[_COMMUNITY_storage.ts|storage.ts]]
- [[_COMMUNITY_messaging.ts|messaging.ts]]
- [[_COMMUNITY_edit-product.tsx|edit-product.tsx]]
- [[_COMMUNITY_messaging.ts|messaging.ts]]
- [[_COMMUNITY_access-actions.ts|access-actions.ts]]
- [[_COMMUNITY_prisma.ts|prisma.ts]]
- [[_COMMUNITY_brain-cockpit.tsx|brain-cockpit.tsx]]
- [[_COMMUNITY_assistant-actions.ts|assistant-actions.ts]]
- [[_COMMUNITY_onboarding-wizard.tsx|onboarding-wizard.tsx]]
- [[_COMMUNITY_directive-actions.ts|directive-actions.ts]]
- [[_COMMUNITY_process-intelligence.ts|process-intelligence.ts]]
- [[_COMMUNITY_document-preview.tsx|document-preview.tsx]]
- [[_COMMUNITY_office-templates.ts|office-templates.ts]]
- [[_COMMUNITY_getAccess|getAccess]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_funding-panel.tsx|funding-panel.tsx]]
- [[_COMMUNITY_field-report-actions.ts|field-report-actions.ts]]
- [[_COMMUNITY_messenger.tsx|messenger.tsx]]
- [[_COMMUNITY_login-form.tsx|login-form.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_new-conversation.tsx|new-conversation.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_sponsoring-actions.ts|sponsoring-actions.ts]]
- [[_COMMUNITY_dashboard.ts|dashboard.ts]]
- [[_COMMUNITY_icon.tsx|icon.tsx]]
- [[_COMMUNITY_medical-actions.ts|medical-actions.ts]]
- [[_COMMUNITY_congress-beneficiary-actions.ts|congress-beneficiary-actions.ts]]
- [[_COMMUNITY_new-request.tsx|new-request.tsx]]
- [[_COMMUNITY_supplier-auth.ts|supplier-auth.ts]]
- [[_COMMUNITY_admin-settings-forms.tsx|admin-settings-forms.tsx]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_medical-directory.tsx|medical-directory.tsx]]
- [[_COMMUNITY_regulatory-actions.ts|regulatory-actions.ts]]
- [[_COMMUNITY_hr-documents.ts|hr-documents.ts]]
- [[_COMMUNITY_supplier-actions.ts|supplier-actions.ts]]
- [[_COMMUNITY_topbar.tsx|topbar.tsx]]
- [[_COMMUNITY_dossiers.ts|dossiers.ts]]
- [[_COMMUNITY_push.ts|push.ts]]
- [[_COMMUNITY_custom-field-actions.ts|custom-field-actions.ts]]
- [[_COMMUNITY_step-timeline.tsx|step-timeline.tsx]]
- [[_COMMUNITY_delegate-plans.tsx|delegate-plans.tsx]]
- [[_COMMUNITY_bv-requests.tsx|bv-requests.tsx]]
- [[_COMMUNITY_next-auth.d.ts|next-auth.d.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_ai-settings-form.tsx|ai-settings-form.tsx]]
- [[_COMMUNITY_custom-fields-card.tsx|custom-fields-card.tsx]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_{ GET, POST }|{ GET, POST }]]

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 354 edges
2. `userCan()` - 323 edges
3. `fdStr()` - 312 edges
4. `recordAudit()` - 261 edges
5. `requireModule()` - 154 edges
6. `formatDate()` - 126 edges
7. `hasGlobalView()` - 118 edges
8. `cn()` - 118 edges
9. `Button` - 99 edges
10. `formatCurrency()` - 88 edges

## Surprising Connections (you probably didn't know these)
- `CongressRequestButton()` --indirect_call--> `form()`  [INFERRED]
  src/app/(app)/congress-international/congress-request-form.tsx → src/lib/actions/promo-material-flow.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `AuditPanel()` --calls--> `load()`  [INFERRED]
  src/app/(app)/admin/audit-panel.tsx → src/lib/actions/promo-material-actions.ts
- `CustomFieldsPage()` --calls--> `requireModule()`  [EXTRACTED]
  src/app/(app)/admin/fields/page.tsx → src/lib/session.ts
- `RoleRow()` --calls--> `setSecondaryRole()`  [EXTRACTED]
  src/app/(app)/admin/roles-table.tsx → src/lib/actions/admin-actions.ts

## Import Cycles
- None detected.

## Communities (95 total, 4 thin omitted)

### Community 0 - "userCan"
Cohesion: 0.07
Nodes (78): EditEventButton(), RegistrationsManager(), SpecialtiesManager(), CancelButton(), CancelButton(), AVATAR_COLORS, createUser(), setSecondaryRole() (+70 more)

### Community 1 - "engine.ts"
Cohesion: 0.05
Nodes (77): fmtDzd(), fmtPct(), MarketCompetitionPage(), MODES, pctTone(), fmtPct(), fmtUsd(), MarketRadarPage() (+69 more)

### Community 2 - "button.tsx"
Cohesion: 0.06
Nodes (42): Option, RuleDTO, ProjectStatusBadge(), RestoreButton(), EditField, NewFolderButton(), NewOfficeButton(), TYPES (+34 more)

### Community 3 - "labels.ts"
Cohesion: 0.05
Nodes (56): ActivityRow, ActivityTable(), TYPE, AuditPanel(), AuditRow, AuditTable(), FeedbackStatusSelect(), FieldDefDTO (+48 more)

### Community 4 - "requireModule"
Cohesion: 0.05
Nodes (57): AdminFeedbackPage(), AdminPage(), AdminSuppliersPage(), AssistantPage(), BusinessDevelopmentOpportunitiesPage(), AssistantPage(), CorbeillePage(), MissionActions() (+49 more)

### Community 5 - "session.ts"
Cohesion: 0.11
Nodes (34): ActivityPage(), fmtDuration(), AdminValidationsPage(), dec(), DOSSIER_DOC_CATEGORIES, dossierTabs, MonDossierPage(), AdvanceItem (+26 more)

### Community 6 - "mail.ts"
Cohesion: 0.06
Nodes (51): POST(), GET(), GET(), GET(), GET(), ConnectMailbox(), AddressInput(), AttMeta (+43 more)

### Community 7 - "rbac.ts"
Cohesion: 0.06
Nodes (52): GET(), AccessByModulePage(), MedicalPage(), SearchPage(), ENTITY_MODULE, DirectiveDetail, getDirectives(), accessibleDocumentWhere() (+44 more)

### Community 8 - "status-badge.tsx"
Cohesion: 0.13
Nodes (37): TYPES, Mode, Tab, TABS, KIND_ICON, MONTHS, PayrollRow, PayrollTable() (+29 more)

### Community 9 - "canAccessEntity"
Cohesion: 0.07
Nodes (52): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+44 more)

### Community 10 - "recordAudit"
Cohesion: 0.08
Nodes (43): ImpersonateButton(), SuppliesManager(), OpeningBalance, OpeningBalancesButton(), PayButton(), ImpersonationBanner(), CreateRecordButtonProps, resetActivityTime() (+35 more)

### Community 11 - "utils.ts"
Cohesion: 0.07
Nodes (38): BudgetRow, BudgetsTable(), MONTHS, DashboardPage(), STATUS_COLORS, ApprovalButtons(), ApprovalsPage(), CategoryCard() (+30 more)

### Community 12 - "cn"
Cohesion: 0.08
Nodes (35): AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, AiSettingsForm(), FEATURE_LABEL, metadata, CongressTable() (+27 more)

### Community 13 - "budget-board.tsx"
Cohesion: 0.09
Nodes (48): ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), BudgetBoard(), BudgetTotalInfo, BudgetTotalSheet(), CategoryCard(), CategorySheet() (+40 more)

### Community 14 - "requireUser"
Cohesion: 0.09
Nodes (46): RevisionRequest(), addRequestComment(), decideApproval(), updateMission(), runAutopilot(), computeStatus(), createBudget(), createCalendarEvent() (+38 more)

### Community 15 - "promo-material-actions.ts"
Cohesion: 0.16
Nodes (40): CancelButton(), PromoActionPanel(), PromoFlags, Props, useRun(), ActivityTracker(), Geo, send() (+32 more)

### Community 16 - "meeting-actions.ts"
Cohesion: 0.09
Nodes (36): MeetJoin(), ManageBar(), ProposalActions(), ShareLink(), TranscriptPanel(), MeetingRecorder(), externalBase(), MeetingDetailPage() (+28 more)

### Community 17 - "hasGlobalView"
Cohesion: 0.08
Nodes (42): RequestDetailPage(), DemandesPage(), OrdresDepensePage(), DeclarationDetailPage(), fieldLabels(), ADMIN_REQUEST_STATUS, CONGRESS_REQUEST_STATUS, EXPENSE_ORDER_STATUS (+34 more)

### Community 18 - "onlyoffice.ts"
Cohesion: 0.14
Nodes (33): POST(), GET(), DocumentEditPage(), ENTITY_ROUTE, OfficeEditor(), originOf(), Window, DriveEditPage() (+25 more)

### Community 19 - "assistant.ts"
Cohesion: 0.08
Nodes (39): MedicalDirectory(), metadata, NoAccessPage(), callClaude(), activeUserId(), AssistantActionKind, asStr(), buildContext() (+31 more)

### Community 20 - "adventum-actions.ts"
Cohesion: 0.10
Nodes (37): GET(), AiControlCenterPage(), BrainCockpit(), askBrain(), DENIED, generateBriefing(), assistantChat(), assistantNudge() (+29 more)

### Community 21 - "page.tsx"
Cohesion: 0.12
Nodes (25): BD_DOC_CATEGORIES, PROMO_DOC_CATEGORIES, REQ_DOC_CATEGORIES, REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES, RegulatoryDetailPage(), DocItem, DocumentList() (+17 more)

### Community 22 - "calendar-view.tsx"
Cohesion: 0.11
Nodes (33): CalendarView(), colorOf(), EventDetail(), EventForm(), MONTH_LABELS, SheetMode, WEEKDAYS, CalendarPage() (+25 more)

### Community 23 - "risks.ts"
Cohesion: 0.10
Nodes (33): AdventumBrainPage(), BLOCK_CATS, RiskThresholdsForm(), updateRiskThresholds(), suggestRelationObjects(), DEFAULT_THRESHOLDS, getRiskThresholds(), RiskThresholds (+25 more)

### Community 24 - "message-thread.tsx"
Cohesion: 0.11
Nodes (28): Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE, QUICK_REACTIONS, buildInlineRegex() (+20 more)

### Community 25 - "getCurrentUser"
Cohesion: 0.17
Nodes (23): GET(), POST(), POST(), POST(), POST(), GET(), POST(), DELETE() (+15 more)

### Community 26 - "page.tsx"
Cohesion: 0.12
Nodes (25): CongressDetailView(), CongressIntlDetailPage(), CongressInternationalPage(), CongressNatDetailPage(), CongressNationalPage(), EventDetailPage(), eventValidationSteps(), MyMissionsPage() (+17 more)

### Community 27 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (33): AddMembers(), cid(), InfoPanel(), Row(), NewConversation(), addMembers(), archiveConversation(), canManage() (+25 more)

### Community 28 - "anpp-process.tsx"
Cohesion: 0.11
Nodes (30): RegulatoryChecklist(), RegulatoryProcess(), STATE_OPTS, RegulatoryPage(), setRegulatoryChecklistItem(), setRegulatoryStepNote(), setRegulatoryStepState(), isRegChecklistKey() (+22 more)

### Community 29 - "Select"
Cohesion: 0.08
Nodes (26): RoleRow(), RoleRowData, RolesTable(), SECONDARY_OPTIONS, CreateEventButton(), d10(), EventFields(), Result (+18 more)

### Community 30 - "dossier-actions.ts"
Cohesion: 0.15
Nodes (26): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), useAction(), UserLite, CreateDossierButton(), archiveDossier() (+18 more)

### Community 31 - "drive-actions.ts"
Cohesion: 0.13
Nodes (24): GET(), MoveTarget, NodeActions(), Props, collectSubtree(), deleteNode(), DENIED, moveNode() (+16 more)

### Community 32 - "pch-detail-client.tsx"
Cohesion: 0.13
Nodes (23): dzd(), fmtPct(), MarketPricingPage(), StatBlock(), SelectNav(), PchTenderPage(), Action, EditTenderButton() (+15 more)

### Community 33 - "badge.tsx"
Cohesion: 0.09
Nodes (24): AccessUser, ACTION_COLS, ACTION_LABELS, ModuleAccessGrid(), Opt, UserModuleState, ACTION_FR, ROW_SCOPED (+16 more)

### Community 34 - "adoption.ts"
Cohesion: 0.13
Nodes (26): AdoptionPage(), AdoptionBadge, AdoptionComponent, AdoptionHistoryPoint, AdoptionResult, AdoptionScore, AdoptionTargets, AdoptionThresholds (+18 more)

### Community 35 - "validation-actions.ts"
Cohesion: 0.14
Nodes (25): RuleControls(), RuleEditor(), createValidationRequest(), createValidationRule(), deleteValidationRule(), PRIORITIES, priorityOrNull(), readRuleData() (+17 more)

### Community 36 - "congress-detail-view.tsx"
Cohesion: 0.12
Nodes (22): BeneficiariesCard(), Budget(), Cat, CONGRESS_DOC_CATEGORIES, PM, MissionAssignmentsCard(), UserOption, MISSION_DOC_CATEGORIES (+14 more)

### Community 37 - "admin-request-actions.ts"
Cohesion: 0.15
Nodes (25): RequestActions(), U, RequesterWindow(), assignRequest(), BatchCell, collectAllFields(), collectFields(), createMission() (+17 more)

### Community 38 - "medical-info-actions.ts"
Cohesion: 0.19
Nodes (23): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), FulfillForm(), RequestDocForm(), useAction(), UserOpt, ValidateButton() (+15 more)

### Community 39 - "support-actions.ts"
Cohesion: 0.15
Nodes (23): SupportDetailPage(), SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester() (+15 more)

### Community 40 - "congress-request-actions.ts"
Cohesion: 0.23
Nodes (22): CongressRequestButton(), DoctorOpt, UserOpt, ThirdPartyInvolveButton(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor() (+14 more)

### Community 41 - "auth.ts"
Cohesion: 0.13
Nodes (16): NO_CONTENT, POST(), credentialsSchema, { handlers, auth, signIn, signOut }, clientIp(), DeviceInfo, parseDevice(), enrichSessionGeo() (+8 more)

### Community 42 - "storage.ts"
Cohesion: 0.14
Nodes (18): GET(), DeletableKind, DeleteResult, isKind(), KindSpec, REGISTRY, superAdminDelete(), ActionResult (+10 more)

### Community 43 - "messaging.ts"
Cohesion: 0.18
Nodes (20): GET(), GET(), MessagesPage(), presenceOf(), preview(), AttachmentDTO, ConversationCore, describe() (+12 more)

### Community 44 - "edit-product.tsx"
Cohesion: 0.14
Nodes (19): SupplyArticleRow, DciAssociationField(), EditProductValues, UserOption, NewProductButton(), UserOption, RegulatoryRow, SupplierRow (+11 more)

### Community 45 - "messaging.ts"
Cohesion: 0.15
Nodes (16): GET(), GET(), NO_CONTENT, POST(), blobSecret(), PRESENCE_LABEL, signBlob(), touchPresence() (+8 more)

### Community 46 - "access-actions.ts"
Cohesion: 0.17
Nodes (20): GrantOption, RowGrants(), RowGrantsProps, ActiveToggle(), Profile, ProfileForm(), RequestOnboardingButton(), ResetPasswordForm() (+12 more)

### Community 47 - "prisma.ts"
Cohesion: 0.15
Nodes (17): esc(), GET(), GET(), FieldReportPage(), SimpleReportEditor(), FieldReportsPage(), REGISTRATION_STATUS, globalForPrisma (+9 more)

### Community 48 - "brain-cockpit.tsx"
Cohesion: 0.12
Nodes (17): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+9 more)

### Community 49 - "assistant-actions.ts"
Cohesion: 0.14
Nodes (16): ActionState, AssistantChat(), cleanReply(), MessageBubble(), Msg, nextId(), SUGGESTIONS, executeAssistantAction() (+8 more)

### Community 50 - "onboarding-wizard.tsx"
Cohesion: 0.12
Nodes (13): AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, OnboardingWizard(), Props (+5 more)

### Community 51 - "directive-actions.ts"
Cohesion: 0.20
Nodes (18): DirectiveDetailPage(), MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate() (+10 more)

### Community 52 - "process-intelligence.ts"
Cohesion: 0.14
Nodes (19): AdminSettingsPage(), EmployeeForm(), SPONSORING_STATUS, TASK_STATUS, collectWorkItems(), countMap(), daysSince(), getProcessOverview() (+11 more)

### Community 53 - "document-preview.tsx"
Cohesion: 0.20
Nodes (12): FileViewer(), DocumentPreview(), extOf(), IMAGE, kindFromName(), OFFICE_EDIT, TEXTLIKE, DocxView() (+4 more)

### Community 54 - "office-templates.ts"
Cohesion: 0.16
Nodes (16): HrDossier(), RequestRow(), blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE (+8 more)

### Community 55 - "getAccess"
Cohesion: 0.16
Nodes (13): actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+5 more)

### Community 56 - "page.tsx"
Cohesion: 0.13
Nodes (14): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, metadata, DonutSlice, MiniBarChart(), Point (+6 more)

### Community 57 - "funding-panel.tsx"
Cohesion: 0.19
Nodes (15): Action, base(), Cat, EditGrantedBudget(), FinalDecision(), PM, PreliminaryDecision(), ProductAnalysis() (+7 more)

### Community 58 - "field-report-actions.ts"
Cohesion: 0.25
Nodes (15): ReportEditor(), State, STRUCT, Attachments(), NewReportButton(), formatBytes(), analyzeFieldReportAction(), canEdit() (+7 more)

### Community 59 - "messenger.tsx"
Cohesion: 0.20
Nodes (15): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), bumpConversation(), Messenger(), bookmarkMessage() (+7 more)

### Community 60 - "login-form.tsx"
Cohesion: 0.16
Nodes (9): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, UserMenuProps, authenticate(), changePassword() (+1 more)

### Community 61 - "page.tsx"
Cohesion: 0.15
Nodes (12): ConvertPdfButton(), DriveFilePage(), humanSize(), ShareItem, SharePanel(), DrivePage(), humanSize(), UploadButton() (+4 more)

### Community 62 - "page.tsx"
Cohesion: 0.23
Nodes (14): AggNum(), fmtPct(), fmtUsd(), MarketOpportunitiesPage(), MINS, pctTone(), scoreTone(), VIEWS (+6 more)

### Community 63 - "new-conversation.tsx"
Cohesion: 0.18
Nodes (11): Props, Props, MemberMultiSelect(), Mode, Props, SearchBox(), Presence, ChannelDTO (+3 more)

### Community 64 - "page.tsx"
Cohesion: 0.24
Nodes (12): PROMO_DOC_CATEGORIES, PromoMaterialDetailPage(), promoSteps(), PROMO_MATERIAL_FLOW, canViewPromo(), getPromoMaterial(), getPromoMaterials(), PromoDetail (+4 more)

### Community 65 - "sponsoring-actions.ts"
Cohesion: 0.28
Nodes (13): DecisionPanel(), isDirection(), isDirectionMarketing(), requestThirdPartyInput(), revalidate(), sponsoringAnalysis(), sponsoringAppeal(), sponsoringFinal() (+5 more)

### Community 66 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 67 - "icon.tsx"
Cohesion: 0.19
Nodes (10): CommandPalette(), Item, SearchResult, GROUP_ORDER, Sidebar(), SidebarProps, TopbarProps, Icon() (+2 more)

### Community 68 - "medical-actions.ts"
Cohesion: 0.26
Nodes (13): createDoctor(), createVisit(), parseSector(), parseSegment(), parseTitle(), SECTORS, SEGMENTS, segToInfluence (+5 more)

### Community 69 - "congress-beneficiary-actions.ts"
Cohesion: 0.36
Nodes (11): Beneficiary, addCongressBeneficiary(), asList(), Benef, entityTypeOf(), Kind, loadCongress(), pathOf() (+3 more)

### Community 70 - "new-request.tsx"
Cohesion: 0.21
Nodes (9): Article, Cell, emptyCell(), MultiRequestButton(), Option, Option, ouiNon, REQUEST_TYPE_FIELDS (+1 more)

### Community 71 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 72 - "admin-settings-forms.tsx"
Cohesion: 0.21
Nodes (10): AdminLimitsForm(), BroadcastComposer(), DIAG_TONE, DiagResult, Mailbox, MailDiagnosticPanel(), Opt, UserLite (+2 more)

### Community 73 - "layout.tsx"
Cohesion: 0.30
Nodes (9): AppLayout(), FloatingAssistant(), EnablePushButton(), getKey(), PushRegister(), subscribe(), supported(), urlB64ToUint8Array() (+1 more)

### Community 74 - "medical-directory.tsx"
Cohesion: 0.21
Nodes (10): DoctorSheet(), Props, Result, SECTOR_ICON, SECTOR_ORDER, useSubmit(), DOCTOR_TITLE, MEDICAL_SECTOR (+2 more)

### Community 75 - "regulatory-actions.ts"
Cohesion: 0.24
Nodes (9): EditProductButton(), normalizeDci(), updateRegulatoryProduct(), upperMolecules(), createExpenseOrder(), CreateExpenseOrderInput, INVOICE_REQUIRED_SOURCES, nextExpenseRef() (+1 more)

### Community 76 - "hr-documents.ts"
Cohesion: 0.33
Nodes (10): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+2 more)

### Community 77 - "supplier-actions.ts"
Cohesion: 0.31
Nodes (8): ActiveToggle(), createSupplier(), createSupplierUser(), EXTERNAL_STATUSES, SUPER_ONLY, toggleSupplier(), toggleSupplierUser(), updateSupplierView()

### Community 78 - "topbar.tsx"
Cohesion: 0.31
Nodes (8): getCtx(), MessagesIndicator(), playPing(), unlockAudio(), ADOPTION_TONE, GROUP_ORDER, Topbar(), UserMenu()

### Community 79 - "dossiers.ts"
Cohesion: 0.36
Nodes (8): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), getDossiers(), isDossierMember(), scopeDossiers()

### Community 80 - "push.ts"
Cohesion: 0.54
Nodes (6): GET(), ensureVapid(), keys(), pushConfigured(), PushPayload, vapidPublicKey()

### Community 81 - "custom-field-actions.ts"
Cohesion: 0.39
Nodes (7): FieldsManager(), deleteCustomFieldDef(), saveCustomValues(), slug(), upsertCustomFieldDef(), readCustomValues(), writeCustomValues()

### Community 82 - "step-timeline.tsx"
Cohesion: 0.29
Nodes (7): STATUS_ICON, STATUS_RING, StepItem, StepTimeline(), updateRegulatoryStep(), REGULATORY_STEP_TYPE, STEP_STATUS

### Community 83 - "delegate-plans.tsx"
Cohesion: 0.43
Nodes (6): d10(), DelegatePlans(), fmtPeriod(), nextMonthISO(), Opt, PlanItem

### Community 84 - "bv-requests.tsx"
Cohesion: 0.47
Nodes (5): BV_STATUS, BvItem, BvRequests(), fmtDate(), fmtDZD()

### Community 85 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 87 - "ai-settings-form.tsx"
Cohesion: 0.40
Nodes (4): AiSettings, FeatureKey, FEATURES, Toggle()

### Community 88 - "custom-fields-card.tsx"
Cohesion: 0.50
Nodes (4): CustomFieldDefDTO, CustomFieldsCard(), Props, toDateValue()

## Knowledge Gaps
- **434 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+429 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `userCan()` connect `userCan` to `labels.ts`, `requireModule`, `session.ts`, `mail.ts`, `rbac.ts`, `status-badge.tsx`, `canAccessEntity`, `recordAudit`, `utils.ts`, `cn`, `budget-board.tsx`, `requireUser`, `promo-material-actions.ts`, `meeting-actions.ts`, `hasGlobalView`, `onlyoffice.ts`, `assistant.ts`, `adventum-actions.ts`, `page.tsx`, `calendar-view.tsx`, `risks.ts`, `getCurrentUser`, `page.tsx`, `messaging-actions.ts`, `anpp-process.tsx`, `dossier-actions.ts`, `drive-actions.ts`, `pch-detail-client.tsx`, `adoption.ts`, `validation-actions.ts`, `admin-request-actions.ts`, `medical-info-actions.ts`, `support-actions.ts`, `congress-request-actions.ts`, `messaging.ts`, `edit-product.tsx`, `messaging.ts`, `access-actions.ts`, `prisma.ts`, `assistant-actions.ts`, `directive-actions.ts`, `page.tsx`, `field-report-actions.ts`, `page.tsx`, `page.tsx`, `sponsoring-actions.ts`, `dashboard.ts`, `medical-actions.ts`, `layout.tsx`, `regulatory-actions.ts`, `supplier-actions.ts`, `dossiers.ts`, `custom-field-actions.ts`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `userCan`, `requireModule`, `session.ts`, `rbac.ts`, `canAccessEntity`, `recordAudit`, `budget-board.tsx`, `promo-material-actions.ts`, `meeting-actions.ts`, `hasGlobalView`, `onlyoffice.ts`, `assistant.ts`, `adventum-actions.ts`, `page.tsx`, `risks.ts`, `getCurrentUser`, `page.tsx`, `messaging-actions.ts`, `anpp-process.tsx`, `Select`, `dossier-actions.ts`, `drive-actions.ts`, `validation-actions.ts`, `congress-detail-view.tsx`, `admin-request-actions.ts`, `medical-info-actions.ts`, `support-actions.ts`, `congress-request-actions.ts`, `storage.ts`, `access-actions.ts`, `brain-cockpit.tsx`, `assistant-actions.ts`, `onboarding-wizard.tsx`, `directive-actions.ts`, `getAccess`, `field-report-actions.ts`, `messenger.tsx`, `login-form.tsx`, `sponsoring-actions.ts`, `medical-actions.ts`, `congress-beneficiary-actions.ts`, `layout.tsx`, `regulatory-actions.ts`, `supplier-actions.ts`, `dossiers.ts`, `custom-field-actions.ts`, `step-timeline.tsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `fdStr()` connect `userCan` to `canAccessEntity`, `recordAudit`, `budget-board.tsx`, `requireUser`, `promo-material-actions.ts`, `meeting-actions.ts`, `onlyoffice.ts`, `adventum-actions.ts`, `page.tsx`, `messaging-actions.ts`, `dossier-actions.ts`, `drive-actions.ts`, `validation-actions.ts`, `congress-detail-view.tsx`, `admin-request-actions.ts`, `medical-info-actions.ts`, `support-actions.ts`, `congress-request-actions.ts`, `access-actions.ts`, `directive-actions.ts`, `field-report-actions.ts`, `messenger.tsx`, `sponsoring-actions.ts`, `medical-actions.ts`, `congress-beneficiary-actions.ts`, `supplier-actions.ts`, `custom-field-actions.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _434 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `userCan` be split into smaller, more focused modules?**
  _Cohesion score 0.0741901776384535 - nodes in this community are weakly interconnected._
- **Should `engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05289450484866295 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06358024691358025 - nodes in this community are weakly interconnected._