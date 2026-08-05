# Graph Report - src  (2026-08-05)

## Corpus Check
- 863 files · ~581,389 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5181 nodes · 20422 edges · 161 communities (155 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad2cbc8d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- button.tsx
- lib/session.ts
- userCan
- demandes/[id]/page.tsx
- prisma
- formatCurrency
- lib/labels.ts
- requireUser
- requireModule
- getCurrentUser
- notifyUser
- recordAudit
- mistral-ocr.ts
- aiConfigured
- getCompanyScope
- drive-actions.ts
- anyRoleFilter
- prisma.ts
- getBlob
- FindingInput
- assistant-actions.ts
- [dossierId]/page.tsx
- promo-material-actions.ts
- meeting-actions.ts
- regulatory/[id]/page.tsx
- upload/session.ts
- storage.ts
- notifyRoles
- molecule.ts
- formatDateTime
- regCan
- mail.ts
- adoption.ts
- hasGlobalView
- anpp-process.tsx
- test-center/runner.ts
- (app)/layout.tsx
- market/engine.ts
- messaging-actions.ts
- zip-inspector.ts
- build-facts.ts
- jobs/runner.ts
- drive-storage.ts
- message-thread.tsx
- agent-core.ts
- object-storage.ts
- build-twin.ts
- assistant.ts
- calendar.ts
- users/[id]/page.tsx
- dossier-actions.ts
- rules/engine.ts
- test-center/page.tsx
- rules/admin-actions.ts
- workflow-builder.tsx
- aujourdhui/page.tsx
- competition.ts
- medical-info-actions.ts
- invariants/registry.ts
- validation-actions.ts
- molecule-panel.tsx
- document-preview.tsx
- workflow/engine.ts
- queries/messaging.ts
- brain-cockpit.tsx
- medical-directory.tsx
- topbar.tsx
- smart-mail-actions.ts
- bd-strategic-table.tsx
- onboarding-wizard.tsx
- rh/[id]/page.tsx
- generate.ts
- auth.ts
- mail-client.tsx
- workflow.ts
- extract-facts.ts
- lifecycle/actions.ts
- departments.ts
- migration-cert.ts
- entity-access.ts
- finances/page.tsx
- pch-tender-line-actions.ts
- supplier/actions.ts
- enregistrement/page.tsx
- company.ts
- platform-audit/engine.ts
- extract-text.ts
- explorer.ts
- market-presentation.ts
- adventum-brain/page.tsx
- new-conversation.tsx
- budget-envelope-actions.ts
- risks.ts
- features.ts
- medical-actions.ts
- admin-settings-forms.tsx
- market-research-actions.ts
- upload-manager.tsx
- market-research.ts
- process-intelligence.ts
- review-agent.ts
- manifest.ts
- getMailAccount
- access/page.tsx
- beneficiaries-card.tsx
- lib/messaging.ts
- run.ts
- support-actions.ts
- pch.ts
- department-actions.ts
- adventum-actions.ts
- directive-actions.ts
- field-report-actions.ts
- congress.ts
- regulatory-request-actions.ts
- dashboard.ts
- messaging/messages/route.ts
- ai/page.tsx
- radar.ts
- field-reports.ts
- stock-snapshot-actions.ts
- compare-versions.ts
- pch/export/route.ts
- drive-space-manager.tsx
- supplier-auth.ts
- push.ts
- ai-health.ts
- hr-documents.ts
- budgets/export/route.ts
- background-upload.tsx
- reminder-actions.ts
- database-admin-actions.ts
- events.ts
- meetings/page.tsx
- agents/actions.ts
- data.ts
- dossiers.ts
- regulatory-requests.ts
- platform-audit/ai.ts
- assistant-files.ts
- getMessage
- Adventum Autonomous Test Center — architecture
- custom-field-actions.ts
- org-chart-editor.tsx
- impersonation-actions.ts
- teams-manager.tsx
- client-bundle-guard.test.ts
- overview-charts.tsx
- conversation-list.tsx
- [token]/route.ts
- next-auth.d.ts
- geo.ts
- app/layout.tsx
- (app)/courrier/page.tsx
- (portal)/layout.tsx
- extract.worker.cjs
- pdf-parse.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 558 edges
2. `userCan()` - 445 edges
3. `fdStr()` - 422 edges
4. `recordAudit()` - 377 edges
5. `prisma` - 357 edges
6. `requireModule()` - 212 edges
7. `hasGlobalView()` - 147 edges
8. `Button` - 146 edges
9. `cn()` - 139 edges
10. `formatDate()` - 133 edges

## Surprising Connections (you probably didn't know these)
- `fd()` --indirect_call--> `v()`  [INFERRED]
  src/lib/actions/reset-password.test.ts → src/lib/regulatory/manufacturing-stage.test.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/app/(app)/admin/ai/ai-settings-form.tsx → src/lib/utils.ts
- `CorbeillePage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/admin/corbeille/page.tsx → src/lib/session.ts
- `OrgBranch()` --calls--> `saveOrgNode()`  [EXTRACTED]
  src/app/(app)/admin/organigramme/org-chart-editor.tsx → src/lib/actions/org-actions.ts
- `RuleControls()` --indirect_call--> `v()`  [INFERRED]
  src/app/(app)/admin/validations/rules-admin.tsx → src/lib/regulatory/manufacturing-stage.test.ts

## Import Cycles
- None detected.

## Communities (161 total, 6 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.04
Nodes (121): ACTION_COLS, ACTION_LABELS, Opt, TYPES, ACTION_COLS, ACTION_LABELS, FocusCard(), AggNum() (+113 more)

### Community 1 - "button.tsx"
Cohesion: 0.04
Nodes (103): PALETTE, Citation, Source, Version, Option, RuleDTO, DoctorOpt, UserOpt (+95 more)

### Community 2 - "lib/session.ts"
Cohesion: 0.03
Nodes (103): ActivityPage(), fmtDuration(), dynamic, metadata, dynamic, MailTester(), dynamic, metadata (+95 more)

### Community 3 - "userCan"
Cohesion: 0.05
Nodes (114): POST(), PresentationCard(), Res, EditEventButton(), SubmitButton(), RegistrationsManager(), EditTransactionSheet(), PayButton() (+106 more)

### Community 4 - "demandes/[id]/page.tsx"
Cohesion: 0.05
Nodes (76): BD_DOC_CATEGORIES, BdProjectDetailPage(), ProjectEditor(), ProjectStatusBadge(), CONGRESS_DOC_CATEGORIES, CongressDetailView(), CongressIntlDetailPage(), CongressNatDetailPage() (+68 more)

### Community 5 - "prisma"
Cohesion: 0.04
Nodes (68): DirectiveDetailPage(), SupportDetailPage(), assistantNudge(), actorFor(), actorFor(), actorFor(), actorFor(), actorFor() (+60 more)

### Community 6 - "formatCurrency"
Cohesion: 0.05
Nodes (77): BudgetContextBar(), BudgetExpenses(), ACCESS_ROLE_OPTIONS, accessRolesField(), accessUsersField(), AddExpenseRow(), BudgetTotalInfo, BudgetTotalSheet() (+69 more)

### Community 7 - "lib/labels.ts"
Cohesion: 0.03
Nodes (78): AuditPanel(), AuditRow, AuditTable(), BDPipeline(), STAGES, BDRow, BDTable(), DoctorRow (+70 more)

### Community 8 - "requireUser"
Cohesion: 0.06
Nodes (80): SpaceSettingsButton(), FileActions(), NodeActions(), EditVisitSheet(), VariationDTO, VariationPanel(), updateBDStatus(), addBdProjectComment() (+72 more)

### Community 9 - "requireModule"
Cohesion: 0.05
Nodes (68): CustomFieldsPage(), OrganigrammePage(), AdminValidationsPage(), dec(), AdminWorkflowsPage(), BusinessDevelopmentOpportunitiesPage(), BusinessDevelopmentPage(), NewRequestButton() (+60 more)

### Community 10 - "getCurrentUser"
Cohesion: 0.06
Nodes (56): dynamic, GET(), dynamic, POST(), dynamic, POST(), dynamic, esc() (+48 more)

### Community 11 - "notifyUser"
Cohesion: 0.06
Nodes (69): EventForm(), ExpenseAckItem, ExpenseAckList(), RequestActions(), RequesterWindow(), RequestRow(), addRequestComment(), archiveAdminRequestIfDone() (+61 more)

### Community 12 - "recordAudit"
Cohesion: 0.06
Nodes (56): EntitiesManager(), RoleRow(), ActiveToggle(), EventDetail(), CreateRecordButtonProps, AVATAR_COLORS, createUser(), setSecondaryRole() (+48 more)

### Community 13 - "mistral-ocr.ts"
Cohesion: 0.06
Nodes (55): dynamic, GET(), runtime, defaultOcrLangs(), ensureLangData(), findTrainedData(), ocrCacheDir(), require (+47 more)

### Community 14 - "aiConfigured"
Cohesion: 0.06
Nodes (57): Msg, SUGGESTIONS, Msg, SUGGESTIONS, aiConfigured(), AiTextResult, AnthropicBlock, AskOptions (+49 more)

### Community 15 - "getCompanyScope"
Cohesion: 0.05
Nodes (52): dynamic, GET(), INLINE_MIME, runtime, dynamic, maxDuration, POST(), runtime (+44 more)

### Community 16 - "drive-actions.ts"
Cohesion: 0.08
Nodes (48): POST(), dynamic, GET(), DocumentEditPage(), dynamic, ENTITY_ROUTE, ConvertPdfButton(), DriveCommentItem (+40 more)

### Community 17 - "anyRoleFilter"
Cohesion: 0.07
Nodes (50): CourseDTO, CoursesBoard(), deadlineLabel(), letter(), CoursesPage(), MissionActions(), letter(), MissionStops() (+42 more)

### Community 18 - "prisma.ts"
Cohesion: 0.05
Nodes (35): dynamic, maxDuration, POST(), runtime, RegulatoryCorpusPage(), CheckinConfirm(), CheckinPage(), dynamic (+27 more)

### Community 19 - "getBlob"
Cohesion: 0.07
Nodes (47): dynamic, GET(), GET(), GET(), MIME_BY_EXT, mimeByName(), POST(), GET() (+39 more)

### Community 20 - "FindingInput"
Cohesion: 0.10
Nodes (44): ACTIONS, pruneStaleUploadSessions(), accrualStep(), accrueMonthlyLeave(), algiersYm(), monthsBetweenYm(), runScheduledJobs(), sendDueMeetingReminders() (+36 more)

### Community 21 - "assistant-actions.ts"
Cohesion: 0.08
Nodes (50): dynamic, maxDuration, runtime, ActionState, AssistantChat(), cleanReply(), DriveFilePicker(), fileToBase64() (+42 more)

### Community 22 - "[dossierId]/page.tsx"
Cohesion: 0.07
Nodes (45): ApproveNameButton(), DossierChatPanel(), DocgenPanel(), GenDoc, Template, DeleteDossierButton(), DossierDetailPage(), dynamic (+37 more)

### Community 23 - "promo-material-actions.ts"
Cohesion: 0.14
Nodes (45): base(), EditGrantedBudget(), FinalDecision(), PreliminaryDecision(), ProductAnalysis(), useRun(), CancelButton(), PromoActionPanel() (+37 more)

### Community 24 - "meeting-actions.ts"
Cohesion: 0.07
Nodes (44): InviteResponse(), Resp, ChatAttachment, ChatMessage, MeetingChat(), MeetingMessageItem(), MessageAttachments(), ManageBar() (+36 more)

### Community 25 - "regulatory/[id]/page.tsx"
Cohesion: 0.07
Nodes (42): DciAssociationField(), EditProductButton(), EditProductValues, UserOption, RegulatoryChecklist(), BvItem, REG_DOC_CATEGORIES, REG_RESERVE_CATEGORIES (+34 more)

### Community 26 - "upload/session.ts"
Cohesion: 0.07
Nodes (43): dynamic, POST(), runtime, dynamic, maxDuration, POST(), runtime, dynamic (+35 more)

### Community 27 - "storage.ts"
Cohesion: 0.07
Nodes (38): GET(), POST(), delegateOf(), DeletableKind, DeleteResult, destroyDeletedRecord(), isKind(), KindSpec (+30 more)

### Community 28 - "notifyRoles"
Cohesion: 0.08
Nodes (42): RevisionRequest(), runAutopilot(), executeAssistantAction(), cancelExpenseOrder(), nextFinanceRef(), requestBudgetRevision(), requestInvoice(), resolveBudgetRevision() (+34 more)

### Community 29 - "molecule.ts"
Cohesion: 0.11
Nodes (43): MarketProductsPage(), SuggestField(), asForm(), MarketProductSearchResult, marketSuggestions(), MoleculeAnalysisResult, searchMarketProducts(), analyzeMoleculeSafe() (+35 more)

### Community 30 - "formatDateTime"
Cohesion: 0.07
Nodes (37): ActivityRow, ActivityTable(), TYPE, AdoptionTable(), badgeTone, TONE_BAR, TONE_TEXT, CorbeillePage() (+29 more)

### Community 31 - "regCan"
Cohesion: 0.09
Nodes (39): CorpusAdmin(), FindingControls(), Props, statusLabel(), Props, Conflict, ConflictRow(), ConflictValue (+31 more)

### Community 32 - "mail.ts"
Cohesion: 0.07
Nodes (44): acquirePooled(), acquireSlot(), addrStr(), appendToSent(), BREAKER_COOLDOWN_MS, BREAKER_THRESHOLD, classifyMailError(), decryptSecret() (+36 more)

### Community 33 - "adoption.ts"
Cohesion: 0.09
Nodes (37): AdoptionSettingsForm(), FIELD_KEY, ResetActivityTimeButton(), TARGET_NAME, AdoptionPage(), resetActivityTime(), saveAdoptionSettings(), ADOPTION_TARGET_FIELDS (+29 more)

### Community 34 - "hasGlobalView"
Cohesion: 0.13
Nodes (37): CorbeillePage(), restoreRequest(), toggleMissionStop(), cancelCongressRequest(), CongressType, createCongressRequest(), entityFor(), EVENT_TYPES (+29 more)

### Community 35 - "anpp-process.tsx"
Cohesion: 0.09
Nodes (36): RegulatoryProcess(), STATE_OPTS, StepNote(), regStage(), RegulatoryPage(), effectiveStage, STAGE_ORDER, stageRank() (+28 more)

### Community 36 - "test-center/runner.ts"
Cohesion: 0.09
Nodes (33): Severity, base, Certification, CertificationInput, CertificationResult, computeCertification(), BETTER, classify() (+25 more)

### Community 37 - "(app)/layout.tsx"
Cohesion: 0.08
Nodes (30): AppLayout(), ActivityTracker(), Geo, send(), UAData, CommandPalette(), Item, SearchResult (+22 more)

### Community 38 - "market/engine.ts"
Cohesion: 0.13
Nodes (36): fmtPct(), MarketPricingPage(), enrichLineById(), matchOurProduct(), getMarketData(), PchRow, allowedMfg(), allTokensIn() (+28 more)

### Community 39 - "messaging-actions.ts"
Cohesion: 0.14
Nodes (36): AddMembers(), cid(), InfoPanel(), Row(), bumpConversation(), Messenger(), addMembers(), archiveConversation() (+28 more)

### Community 40 - "zip-inspector.ts"
Cohesion: 0.09
Nodes (34): blankDocx(), blankOffice, blankPptx(), blankXlsx(), crc32(), CRC_TABLE, EXT, f() (+26 more)

### Community 41 - "build-facts.ts"
Cohesion: 0.09
Nodes (28): extractLooseJson(), repairAndParse(), TEXTUAL_EXTRACTION_STATUSES, AiFactDoc, AiFactSchema, AiFactsOutputSchema, AiFn, buildPrompt() (+20 more)

### Community 42 - "jobs/runner.ts"
Cohesion: 0.11
Nodes (35): detectMime(), FAMILY_EXTS, MimeGuess, sniffFamily(), startsWith(), AI_PRIORITY_SECTIONS, AI_REVIEWABLE_STATUSES, aiConcurrency() (+27 more)

### Community 43 - "drive-storage.ts"
Cohesion: 0.10
Nodes (27): DatabasesPage(), blobChunkBytes(), blobKey(), countOrphanBlobs(), encryptWhole(), masterKey(), putBlobChunked(), { store } (+19 more)

### Community 44 - "message-thread.tsx"
Cohesion: 0.11
Nodes (30): MessageAttachments(), Attachments(), Composer(), Pending, Props, SendPayload, UploadedAttachment, EMOJI_PALETTE (+22 more)

### Community 45 - "agent-core.ts"
Cohesion: 0.10
Nodes (24): AgentDoc, AgentFinding, AgentFindingSchema, AgentOutputSchema, AgentResult, AiFn, ragQuery(), runAgent() (+16 more)

### Community 46 - "object-storage.ts"
Cohesion: 0.13
Nodes (32): dynamic, GET(), runtime, RFC-3986, amzDate(), config(), configuredEndpointHost(), deleteObject() (+24 more)

### Community 47 - "build-twin.ts"
Cohesion: 0.09
Nodes (28): MeetingRecorder(), pickMime(), Classification, classifyDocument(), ClassifyInput, codeHay(), dots(), norm() (+20 more)

### Community 48 - "assistant.ts"
Cohesion: 0.10
Nodes (34): callClaude(), callClaudeStream(), activeUserId(), AssistantActionKind, asStr(), buildContext(), buildProposal(), dateValue() (+26 more)

### Community 49 - "calendar.ts"
Cohesion: 0.12
Nodes (29): CalendarView(), colorOf(), MONTH_LABELS, SheetMode, WEEKDAYS, CalendarPage(), dynamic, CalendarInviteeDTO (+21 more)

### Community 50 - "users/[id]/page.tsx"
Cohesion: 0.13
Nodes (28): ModuleAccessGrid(), AccessMatrix(), ModuleAccessRow, ACTION_FR, ROW_SCOPED, GrantOption, RowGrants(), RowGrantsProps (+20 more)

### Community 51 - "dossier-actions.ts"
Cohesion: 0.14
Nodes (27): DossierAssign(), DossierMessageForm(), DossierMessageItem(), DossierStatusControls(), MsgAttachment, useAction(), UserLite, CreateDossierButton() (+19 more)

### Community 52 - "rules/engine.ts"
Cohesion: 0.11
Nodes (25): AssessmentResult, AssessmentSummary, assessVersion(), covered(), evaluateRule(), FindingInput, isBlockedSec(), isSectionKind() (+17 more)

### Community 53 - "test-center/page.tsx"
Cohesion: 0.10
Nodes (23): CERT, CLEANUP, DifferentialJson, dynamic, fmt(), metadata, pct(), SEV (+15 more)

### Community 54 - "rules/admin-actions.ts"
Cohesion: 0.13
Nodes (24): KIND_LABEL, Pack, Rule, RulePacksAdmin(), sectionByCode(), canManage(), PackTestReport, Result (+16 more)

### Community 55 - "workflow-builder.tsx"
Cohesion: 0.13
Nodes (24): blankStep(), Draft, ROLE_ENTRIES, WorkflowBuilder(), advanceWorkflow(), DefinitionPayload, resetWorkflowDefinition(), ROLE_KEYS (+16 more)

### Community 56 - "aujourdhui/page.tsx"
Cohesion: 0.12
Nodes (22): AssistantPage(), dynamic, dynamic, TodayPage(), MorningBrief(), refreshMyBrief(), sttConfigured(), CalendarEventDTO (+14 more)

### Community 57 - "competition.ts"
Cohesion: 0.12
Nodes (28): fmtPct(), MarketCompetitionPage(), pctTone(), ClassCompetition, ClassCompetitionSummary, classList(), clean(), CompLabRow (+20 more)

### Community 58 - "medical-info-actions.ts"
Cohesion: 0.17
Nodes (25): AuthorityForm(), CancelRequestButton(), DirectionValidateButton(), DocIcon, FulfillForm(), RequestDocForm(), useAction(), UserOpt (+17 more)

### Community 59 - "invariants/registry.ts"
Cohesion: 0.09
Nodes (20): pred(), MutationOp, MutationOpReport, OPS, Predicate, predicatesFor(), Row, InvariantOutcome (+12 more)

### Community 60 - "validation-actions.ts"
Cohesion: 0.12
Nodes (27): RuleControls(), RuleEditor(), clearValidationItem(), createValidationRequest(), createValidationRule(), decideValidation(), deleteValidationRule(), ITEM_DECISIONS (+19 more)

### Community 61 - "molecule-panel.tsx"
Cohesion: 0.11
Nodes (22): fmtDzd(), FoundList(), MoleculePanel(), BarRow, Bars(), COLOR, Meter(), TEXT (+14 more)

### Community 62 - "document-preview.tsx"
Cohesion: 0.13
Nodes (20): FileViewer(), childrenOf(), extOf(), humanSize(), previewKind(), ZipEntry, ZipList, ZipViewer() (+12 more)

### Community 63 - "workflow/engine.ts"
Cohesion: 0.13
Nodes (28): getManagerOfUser(), AdvanceInput, AdvanceResult, advanceWorkflowInstance(), auditModule(), autoSkipEligible(), canActOnStep(), emitFinancials() (+20 more)

### Community 64 - "queries/messaging.ts"
Cohesion: 0.12
Nodes (24): dynamic, GET(), dynamic, GET(), dynamic, MessagesPage(), presenceOf(), annotateReceipts() (+16 more)

### Community 65 - "brain-cockpit.tsx"
Cohesion: 0.10
Nodes (21): AutopilotConfirm(), CAT_LABEL, FeedTab(), fmtTime(), Kpi(), Kpis, levelEmoji(), LEVELS (+13 more)

### Community 66 - "medical-directory.tsx"
Cohesion: 0.11
Nodes (25): MedicalDirectory(), Props, Result, SECTOR_ICON, SECTOR_ORDER, SpecialtiesManager(), MedicalPage(), createSpecialty() (+17 more)

### Community 67 - "topbar.tsx"
Cohesion: 0.10
Nodes (20): LoginForm(), metadata, ChangePasswordForm(), ChangePasswordPage(), metadata, Company, CompanySwitcher(), getCtx() (+12 more)

### Community 68 - "smart-mail-actions.ts"
Cohesion: 0.16
Nodes (22): dynamic, POST(), runtime, sendMail(), SendResult, smartMailStatus, buildProviderCall(), cleanRecipients() (+14 more)

### Community 69 - "bd-strategic-table.tsx"
Cohesion: 0.11
Nodes (23): BdStrategicTable(), DATA_COLS, DataCol, downloadCsv(), EditableCell(), fd(), inv3(), NumKey (+15 more)

### Community 70 - "onboarding-wizard.tsx"
Cohesion: 0.10
Nodes (20): ConnectMailbox(), AssistantPreview(), CourrierPreview(), DossierPreview(), SearchPreview(), GROUP_ORDER, GuideEntry, MailboxStep() (+12 more)

### Community 71 - "rh/[id]/page.tsx"
Cohesion: 0.10
Nodes (19): dynamic, MonDossierPage(), CancelRequestButton(), currentYm(), LEAVE_TYPES, NewRequestButton(), EmployeeForm(), EmployeeFormValues (+11 more)

### Community 72 - "generate.ts"
Cohesion: 0.15
Nodes (19): generateDocumentAction(), documentXml(), esc(), MISSING_MARKER, paragraph(), RenderResult, renderTemplate(), APPROVED (+11 more)

### Community 73 - "auth.ts"
Cohesion: 0.15
Nodes (17): NO_CONTENT, POST(), lastAlertByUser, NO_CONTENT, POST(), authConfig, credentialsSchema, { handlers, auth, signIn, signOut } (+9 more)

### Community 74 - "mail-client.tsx"
Cohesion: 0.12
Nodes (22): AddressInput(), AttMeta, Composer(), Contact, Envelope, fmtDate(), fmtSize(), Folder (+14 more)

### Community 75 - "workflow.ts"
Cohesion: 0.13
Nodes (20): Props, BudgetCategoryOption, getBudgetCategoryOptions(), AD_PRO_BUDGET_MODULES, DefinitionAdminView, getWorkflowDefinitions(), getWorkflowForEntity(), loadOutcome() (+12 more)

### Community 76 - "extract-facts.ts"
Cohesion: 0.14
Nodes (22): AssignmentMatrix(), key(), nOr0(), CTX, DocFactHit, DOSAGE_FORMS, escapeRe(), ExtractDocInput (+14 more)

### Community 77 - "lifecycle/actions.ts"
Cohesion: 0.17
Nodes (20): Event, KINDS, LifecyclePanel(), OB_STATUS, Obligation, addLifecycleEvent(), addObligation(), completeObligation() (+12 more)

### Community 78 - "departments.ts"
Cohesion: 0.14
Nodes (21): DepartmentsPage(), dynamic, metadata, companyLabel(), buildTree(), DepartmentNode, DepartmentOption, DeptLite (+13 more)

### Community 79 - "migration-cert.ts"
Cohesion: 0.20
Nodes (20): assertEphemeralName(), countInEphemeral(), createEphemeralSchema(), destroyEphemeralSchema(), ephemeralSchemaName(), execInEphemeral(), schemaExists(), InfraChecksResult (+12 more)

### Community 80 - "entity-access.ts"
Cohesion: 0.19
Nodes (20): GET(), SearchPage(), executeReadTool(), ENTITY_MODULE, isRequestOwner(), getRequestList(), accessibleDocumentWhere(), ALL_ENTITY_TYPES (+12 more)

### Community 81 - "finances/page.tsx"
Cohesion: 0.13
Nodes (19): CategoryCard(), ComptaCockpit(), ComptaData, ItemTable(), RecettesDepensesChart(), ImportTransactionsButton(), LedgerTable(), Result (+11 more)

### Community 82 - "pch-tender-line-actions.ts"
Cohesion: 0.16
Nodes (21): fmt(), LINE_STATUS, LineCard(), Res, SalesBlock(), TenderLines(), addTenderLine(), analyzeTenderDocument() (+13 more)

### Community 83 - "supplier/actions.ts"
Cohesion: 0.20
Nodes (19): Question, Req, STATUS, SupplierPanel(), createSupplierRequest(), deleteSupplierRequest(), guard(), ownsDossier() (+11 more)

### Community 84 - "enregistrement/page.tsx"
Cohesion: 0.15
Nodes (22): dynamic, dzd(), EnregistrementPage(), metadata, CTD_MODULES, CTD_RULES, CtdModule, DECISION_MENTIONS (+14 more)

### Community 85 - "company.ts"
Cohesion: 0.13
Nodes (20): COMPANY_COOKIE, CompanyLite, companyWhere(), currentCompanyWhere(), getFinanceData(), LedgerRow, MONTHS_FR, AbsenceRow (+12 more)

### Community 86 - "platform-audit/engine.ts"
Cohesion: 0.16
Nodes (22): DesignSignals, FORMAT_PANEL, groupByViewSignature(), HealthProbe, ModuleStat, moduleStats(), probeAccounts(), probeAi() (+14 more)

### Community 87 - "extract-text.ts"
Cohesion: 0.16
Nodes (16): extractPdf(), ExtractResult, extractText(), IMAGE_EXT, pack(), pdfTextHint(), SHEET_EXT, TEXT_EXT (+8 more)

### Community 88 - "explorer.ts"
Cohesion: 0.20
Nodes (18): businessObjectCoverage, Matrix, rbacCoverage, deepAudit(), DeepAuditResult, InvariantsReport, runInvariants(), Delegate (+10 more)

### Community 89 - "market-presentation.ts"
Cohesion: 0.17
Nodes (19): GET(), analyzeMarketResearch(), buildContext(), extractJson(), buildPresentationPptx(), fmtNum(), fmtPrice(), fmtUsd() (+11 more)

### Community 90 - "adventum-brain/page.tsx"
Cohesion: 0.15
Nodes (20): AdventumBrainPage(), BLOCK_CATS, dynamic, ageTone(), ProcessIntelligencePage(), diff(), getPulse(), hourBucket() (+12 more)

### Community 91 - "new-conversation.tsx"
Cohesion: 0.13
Nodes (19): Props, Props, fd(), MemberMultiSelect(), Mode, NewConversation(), Props, SearchBox() (+11 more)

### Community 92 - "budget-envelope-actions.ts"
Cohesion: 0.18
Nodes (22): addBudgetExpense(), attributeTransaction(), createBudgetCategory(), createEnvelope(), deleteBudgetCategory(), deleteBudgetExpense(), deleteEnvelope(), ensureCanManageCategory() (+14 more)

### Community 93 - "risks.ts"
Cohesion: 0.15
Nodes (21): adminRequestRisks(), budgetRisks(), congressLikeRisks(), CongressRow, daysSince(), daysUntil(), deliveryDelayRisks(), DETECTORS (+13 more)

### Community 94 - "features.ts"
Cohesion: 0.17
Nodes (17): dynamic, metadata, VersionsPage(), Group(), STAGE, VersionsManager(), dynamic, RootPage() (+9 more)

### Community 95 - "medical-actions.ts"
Cohesion: 0.19
Nodes (21): DoctorSheet(), InstitutionsManager(), useSubmit(), createDoctor(), createInstitution(), deleteInstitution(), INSTITUTION_TYPES, institutionName() (+13 more)

### Community 96 - "admin-settings-forms.tsx"
Cohesion: 0.14
Nodes (19): AdminLimitsForm(), BroadcastComposer(), CompanyFlag, DIAG_TONE, DiagResult, DriveSpaceCreatorForm(), FieldReportsOverviewForm(), Mailbox (+11 more)

### Community 97 - "market-research-actions.ts"
Cohesion: 0.17
Nodes (19): nOrNull(), PlayerEditor(), ResearchTable(), RowEditor(), STATUS_COLOR, STATUS_LABEL, addResearchPlayer(), addResearchRow() (+11 more)

### Community 98 - "upload-manager.tsx"
Cohesion: 0.16
Nodes (16): CtdUpload(), humanSize(), humanSize(), postJsonWithRetry(), putPartXhr(), UploadContext, UploadContextValue, UploadJob (+8 more)

### Community 99 - "market-research.ts"
Cohesion: 0.16
Nodes (16): GET(), MarketResearchDetailPage(), buildResearchWorkbook(), researchExportFilename(), STATUS, DEFAULT_RESEARCH_SOURCES, getMarketResearch(), listResearchPresentations() (+8 more)

### Community 100 - "process-intelligence.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), collectWorkItems(), countMap(), daysSince(), getProcessOverview(), getWorkloadAnalysis(), label() (+9 more)

### Community 101 - "review-agent.ts"
Cohesion: 0.16
Nodes (14): extractJson(), aiChunkChars(), clampInt(), splitTextIntoChunks(), AiFinding, AiFindingSchema, AiFn, AiOutputSchema (+6 more)

### Community 102 - "manifest.ts"
Cohesion: 0.18
Nodes (15): CleanupResult, cleanupRun(), deleteOne(), DELETERS, EXISTS, isNotFound(), recordArtifact(), SUPPORTED_MODELS (+7 more)

### Community 103 - "getMailAccount"
Cohesion: 0.17
Nodes (14): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+6 more)

### Community 104 - "access/page.tsx"
Cohesion: 0.15
Nodes (14): AccessUser, UserModuleState, AccessByModulePage(), ACTION_FR, dynamic, ROW_SCOPED, AdminUserPage(), MODULE_LABELS (+6 more)

### Community 105 - "beneficiaries-card.tsx"
Cohesion: 0.23
Nodes (16): BeneficiariesCard(), Beneficiary, Mode, Refs, addCongressBeneficiary(), asList(), Benef, entityTypeOf() (+8 more)

### Community 106 - "lib/messaging.ts"
Cohesion: 0.16
Nodes (15): DOT, MyStatus(), setMessagingStatus(), blobSecret(), CHAT_STATUS_LABEL, CHAT_STATUSES, ChatStatus, messagingUserSelect (+7 more)

### Community 107 - "run.ts"
Cohesion: 0.19
Nodes (13): Sim, SimulatorPanel(), VERDICT, runSimulationAction(), AiFn, dossierSummary(), OutputSchema, PERSPECTIVES (+5 more)

### Community 108 - "support-actions.ts"
Cohesion: 0.24
Nodes (15): SupportActions(), SupportMessageForm(), useAction(), answerSupportRequest(), CATEGORIES, createSupportRequest(), isRequester(), isResponder() (+7 more)

### Community 109 - "pch.ts"
Cohesion: 0.19
Nodes (15): d10(), LogisticsRow(), Res, TenderLogistics(), dec(), fetchTenders(), getPchTenderDetail(), getPchTenders() (+7 more)

### Community 110 - "department-actions.ts"
Cohesion: 0.26
Nodes (16): DepartmentsManager(), DeptSheet(), UnassignedPanel(), useRun(), assignEmployeeDepartment(), assignEmployeeManager(), canManageStructure(), codeFromName() (+8 more)

### Community 111 - "adventum-actions.ts"
Cohesion: 0.23
Nodes (13): BrainCockpit(), RiskThresholdsForm(), askBrain(), DENIED, generateBriefing(), updateRiskThresholds(), DEFAULT_THRESHOLDS, RiskThresholds (+5 more)

### Community 112 - "directive-actions.ts"
Cohesion: 0.26
Nodes (14): MessageForm(), set(), StatusActions(), useAction(), archiveDirective(), canManage(), canParticipate(), createDirective() (+6 more)

### Community 113 - "field-report-actions.ts"
Cohesion: 0.26
Nodes (15): ReportEditor(), SimpleReportEditor(), analyzeFieldReportAction(), canEdit(), createFieldReport(), deleteFieldReport(), deleteFieldReportAttachment(), managesReports() (+7 more)

### Community 114 - "congress.ts"
Cohesion: 0.24
Nodes (14): CongressInternationalPage(), CongressNationalPage(), DeclarationDetailPage(), CongressDetail, CongressListRow, CongressType, dec(), getCongressDetail() (+6 more)

### Community 115 - "regulatory-request-actions.ts"
Cohesion: 0.26
Nodes (13): RegulatoryRequestDetailPage(), RequestThread(), Res, createRegRequest(), deleteRegRequest(), loadAccessible(), parseCategory(), parsePriority() (+5 more)

### Community 116 - "dashboard.ts"
Cohesion: 0.25
Nodes (14): addDays(), bdSection(), budgetsSection(), congressSection(), DashboardData, getDashboardData(), logisticsSection(), medicalSection() (+6 more)

### Community 117 - "messaging/messages/route.ts"
Cohesion: 0.21
Nodes (10): dynamic, GET(), dynamic, GET(), touchPresence(), ConversationTyping, getTyping(), registry (+2 more)

### Community 118 - "ai/page.tsx"
Cohesion: 0.16
Nodes (10): AiSettings, AiSettingsForm(), FeatureKey, FEATURES, Toggle(), AiControlCenterPage(), dynamic, FEATURE_LABEL (+2 more)

### Community 119 - "radar.ts"
Cohesion: 0.24
Nodes (13): fmtPct(), MarketRadarPage(), RecRow, addMonths(), addYears(), DciDate, ExpirationRow, getDciDates() (+5 more)

### Community 120 - "field-reports.ts"
Cohesion: 0.19
Nodes (12): FieldReportsOverviewPage(), FieldReportsPage(), canViewFieldReportsOverview(), FieldReportAggregation, FieldReportAttachmentDTO, FieldReportListItem, FieldReportsOverview, getFieldReportsOverview() (+4 more)

### Community 121 - "stock-snapshot-actions.ts"
Cohesion: 0.22
Nodes (13): StocksView(), todayInput(), createStockAnnex(), createStockHospital(), createStockLocation(), deleteStockAnnex(), deleteStockHospital(), deleteStockLocation() (+5 more)

### Community 122 - "compare-versions.ts"
Cohesion: 0.20
Nodes (10): DiffDoc, DiffFact, diffFacts(), diffFiles(), FactDiffEntry, FactStatus, FileDiffEntry, FileStatus (+2 more)

### Community 123 - "pch/export/route.ts"
Cohesion: 0.29
Nodes (9): GET(), boxesNeeded(), buildTenderWorkbook(), concentrationLabel(), ORIGIN_LABEL, tenderExportFilename(), TenderExportHeader, TenderExportLine (+1 more)

### Community 124 - "drive-space-manager.tsx"
Cohesion: 0.21
Nodes (8): CreateSpaceButton(), ROLE_ENTRIES, SpaceData, UserOpt, createDriveSpace(), ensureCanManageSpace(), readIds(), canCreateDriveSpace()

### Community 125 - "supplier-auth.ts"
Cohesion: 0.23
Nodes (11): SupplierLoginPage(), SupplierLogoutButton(), supplierLogout(), clearSupplierSession(), getSupplierSession(), requireSupplier(), setSupplierSession(), sign() (+3 more)

### Community 126 - "push.ts"
Cohesion: 0.32
Nodes (10): dynamic, GET(), ensureVapid(), envKeys(), getKeys(), loadOrCreateKeys(), pushConfigured(), PushPayload (+2 more)

### Community 127 - "ai-health.ts"
Cohesion: 0.26
Nodes (6): runAiHealthCheckNow(), AiHealthCheckButton(), AiHealthResult, aiSelfTest(), AiHealthRun, performAiHealthCheck()

### Community 128 - "hr-documents.ts"
Cohesion: 0.29
Nodes (11): attachThreads(), getEmployeeHrDossier(), getHrRequestQueue(), getMyHrDossier(), HrDocumentDTO, HrQueueItem, HrRequestDTO, mapDoc() (+3 more)

### Community 129 - "budgets/export/route.ts"
Cohesion: 0.33
Nodes (7): GET(), budgetExportFilename(), buildBudgetWorkbook(), day(), rate(), grand, overview

### Community 130 - "background-upload.tsx"
Cohesion: 0.22
Nodes (8): BackgroundUploadProvider(), BgFile, BgJob, BgUploadContext, Ctx, EnqueueSpec, FileStatus, postFormXhr()

### Community 131 - "reminder-actions.ts"
Cohesion: 0.38
Nodes (9): MyReminders(), ReminderRow, asEntityType(), cancelReminder(), completeReminder(), createReminder(), ownedReminder(), REMINDER_ENTITY_TYPES (+1 more)

### Community 132 - "database-admin-actions.ts"
Cohesion: 0.38
Nodes (8): PermanentDeleteButton(), PurgeOrphansButton(), NOT_ALLOWED, permanentlyDeleteDocument(), permanentlyDeleteDriveNode(), purgeOrphanStorage(), purgeOrphanBlobs(), formatBytes()

### Community 133 - "events.ts"
Cohesion: 0.24
Nodes (9): EventsPage(), ACTIVE, buildStats(), EventDetail, EventListItem, EventStats, getEvents(), PublicEvent (+1 more)

### Community 134 - "meetings/page.tsx"
Cohesion: 0.24
Nodes (8): MeetingsTabs(), NewMeetingButton(), dynamic, fmtMeeting(), MeetingsPage(), Row, Section(), STATUS

### Community 135 - "agents/actions.ts"
Cohesion: 0.29
Nodes (7): AgentItem, AgentsPanel(), RunState, listApplicableAgents(), runAgentAction(), scopeCompanyId(), applicableAgents()

### Community 136 - "data.ts"
Cohesion: 0.20
Nodes (9): Cache, DIR, LabRow, loadNdjson(), MarketMeta, NomRow, SRC_IQVIA, SRC_PCH (+1 more)

### Community 137 - "dossiers.ts"
Cohesion: 0.36
Nodes (8): DossierDetailPage(), canManageDossier(), canViewDossier(), DossierDetail, getDossier(), getDossiers(), isDossierMember(), scopeDossiers()

### Community 138 - "regulatory-requests.ts"
Cohesion: 0.31
Nodes (8): RegulatoryRequestsPage(), listRegRequests(), RegRequestDetail, RegRequestListItem, RegRequestMessageDTO, regRequestProductOptions(), canCreateRegRequest(), canSeeRegRequests()

### Community 139 - "platform-audit/ai.ts"
Cohesion: 0.33
Nodes (7): generatePlatformIdeas(), buildPrompt(), fmtFinding(), generateIdeas(), IdeasResult, Finding, PlatformDiagnostic

### Community 140 - "assistant-files.ts"
Cohesion: 0.33
Nodes (5): AttachmentText, cap(), extOf(), extractAttachmentText(), extractPptx()

### Community 141 - "getMessage"
Cohesion: 0.28
Nodes (9): getMessage(), isOverloadError(), listingKey(), loadInbox(), mailBreakerRemainingMs(), msgKey(), noteMailFailure(), noteMailSuccess() (+1 more)

### Community 142 - "Adventum Autonomous Test Center — architecture"
Cohesion: 0.22
Nodes (8): 1. Cartographie de l'existant (réel, vérifié), 2. Risques identifiés (et parades), 3. Architecture (modulaire, typée), 4. Schéma Prisma (phase 1), 5. Plan de phases, 6. Preuve de couverture, 7. Protocole de nettoyage (garanti), Adventum Autonomous Test Center — architecture

### Community 143 - "custom-field-actions.ts"
Cohesion: 0.39
Nodes (7): FieldsManager(), deleteCustomFieldDef(), saveCustomValues(), slug(), upsertCustomFieldDef(), readCustomValues(), writeCustomValues()

### Community 144 - "org-chart-editor.tsx"
Cohesion: 0.43
Nodes (5): OrgCanvas(), OrgBranch(), OrgChartEditor(), OrgNode, OrgWorkspace()

### Community 145 - "impersonation-actions.ts"
Cohesion: 0.36
Nodes (5): ImpersonateButton(), ImpersonationBanner(), startImpersonation(), stopImpersonation(), IMPERSONATE_COOKIE

### Community 146 - "teams-manager.tsx"
Cohesion: 0.29
Nodes (6): Cap, Kam, KamRow(), numOrNull(), Opt, Team

### Community 147 - "client-bundle-guard.test.ts"
Cohesion: 0.36
Nodes (5): importsOf(), isServerAction(), nodeOnlyPath(), resolve(), SRC

### Community 148 - "overview-charts.tsx"
Cohesion: 0.29
Nodes (6): HBars(), PALETTE, StatusDonut(), tooltipStyle, TrendArea(), NamedCount

### Community 149 - "conversation-list.tsx"
Cohesion: 0.38
Nodes (6): ConvAvatar(), ConversationList(), Filter, Props, relativeTime(), ConversationSummaryDTO

### Community 150 - "[token]/route.ts"
Cohesion: 0.47
Nodes (3): dynamic, GET(), qrPng()

### Community 151 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 152 - "geo.ts"
Cohesion: 0.60
Nodes (4): enrichSessionGeo(), GeoInfo, geolocate(), isPrivate()

## Knowledge Gaps
- **1042 isolated node(s):** `ACTION_COLS`, `ACTION_LABELS`, `Opt`, `ROW_SCOPED`, `ACTION_FR` (+1037 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `prisma` to `utils.ts`, `lib/session.ts`, `userCan`, `demandes/[id]/page.tsx`, `formatCurrency`, `lib/labels.ts`, `requireUser`, `requireModule`, `getCurrentUser`, `notifyUser`, `recordAudit`, `aiConfigured`, `getCompanyScope`, `drive-actions.ts`, `anyRoleFilter`, `prisma.ts`, `getBlob`, `FindingInput`, `assistant-actions.ts`, `[dossierId]/page.tsx`, `promo-material-actions.ts`, `meeting-actions.ts`, `regulatory/[id]/page.tsx`, `upload/session.ts`, `storage.ts`, `notifyRoles`, `formatDateTime`, `regCan`, `mail.ts`, `adoption.ts`, `hasGlobalView`, `test-center/runner.ts`, `(app)/layout.tsx`, `messaging-actions.ts`, `build-facts.ts`, `jobs/runner.ts`, `drive-storage.ts`, `agent-core.ts`, `assistant.ts`, `calendar.ts`, `users/[id]/page.tsx`, `dossier-actions.ts`, `test-center/page.tsx`, `rules/admin-actions.ts`, `workflow-builder.tsx`, `aujourdhui/page.tsx`, `medical-info-actions.ts`, `invariants/registry.ts`, `validation-actions.ts`, `workflow/engine.ts`, `queries/messaging.ts`, `brain-cockpit.tsx`, `medical-directory.tsx`, `topbar.tsx`, `smart-mail-actions.ts`, `bd-strategic-table.tsx`, `onboarding-wizard.tsx`, `rh/[id]/page.tsx`, `generate.ts`, `auth.ts`, `workflow.ts`, `lifecycle/actions.ts`, `departments.ts`, `migration-cert.ts`, `entity-access.ts`, `finances/page.tsx`, `pch-tender-line-actions.ts`, `supplier/actions.ts`, `company.ts`, `platform-audit/engine.ts`, `explorer.ts`, `adventum-brain/page.tsx`, `budget-envelope-actions.ts`, `risks.ts`, `features.ts`, `medical-actions.ts`, `admin-settings-forms.tsx`, `market-research-actions.ts`, `market-research.ts`, `process-intelligence.ts`, `manifest.ts`, `getMailAccount`, `access/page.tsx`, `beneficiaries-card.tsx`, `lib/messaging.ts`, `run.ts`, `support-actions.ts`, `pch.ts`, `department-actions.ts`, `adventum-actions.ts`, `directive-actions.ts`, `field-report-actions.ts`, `congress.ts`, `regulatory-request-actions.ts`, `dashboard.ts`, `ai/page.tsx`, `field-reports.ts`, `stock-snapshot-actions.ts`, `compare-versions.ts`, `pch/export/route.ts`, `drive-space-manager.tsx`, `supplier-auth.ts`, `push.ts`, `ai-health.ts`, `hr-documents.ts`, `reminder-actions.ts`, `database-admin-actions.ts`, `events.ts`, `meetings/page.tsx`, `agents/actions.ts`, `dossiers.ts`, `regulatory-requests.ts`, `custom-field-actions.ts`, `impersonation-actions.ts`, `[token]/route.ts`, `geo.ts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `requireUser` to `lib/session.ts`, `userCan`, `demandes/[id]/page.tsx`, `prisma`, `database-admin-actions.ts`, `reminder-actions.ts`, `agents/actions.ts`, `dossiers.ts`, `regulatory-requests.ts`, `notifyUser`, `recordAudit`, `getCurrentUser`, `platform-audit/ai.ts`, `custom-field-actions.ts`, `drive-actions.ts`, `aiConfigured`, `prisma.ts`, `getBlob`, `getCompanyScope`, `assistant-actions.ts`, `promo-material-actions.ts`, `meeting-actions.ts`, `storage.ts`, `notifyRoles`, `molecule.ts`, `formatDateTime`, `regCan`, `adoption.ts`, `hasGlobalView`, `(app)/layout.tsx`, `messaging-actions.ts`, `drive-storage.ts`, `requireModule`, `users/[id]/page.tsx`, `dossier-actions.ts`, `test-center/page.tsx`, `rules/admin-actions.ts`, `workflow-builder.tsx`, `aujourdhui/page.tsx`, `medical-info-actions.ts`, `validation-actions.ts`, `molecule-panel.tsx`, `brain-cockpit.tsx`, `medical-directory.tsx`, `topbar.tsx`, `smart-mail-actions.ts`, `onboarding-wizard.tsx`, `rh/[id]/page.tsx`, `generate.ts`, `mail-client.tsx`, `lifecycle/actions.ts`, `entity-access.ts`, `pch-tender-line-actions.ts`, `supplier/actions.ts`, `new-conversation.tsx`, `budget-envelope-actions.ts`, `features.ts`, `medical-actions.ts`, `market-research-actions.ts`, `beneficiaries-card.tsx`, `lib/messaging.ts`, `run.ts`, `support-actions.ts`, `department-actions.ts`, `adventum-actions.ts`, `directive-actions.ts`, `field-report-actions.ts`, `congress.ts`, `regulatory-request-actions.ts`, `stock-snapshot-actions.ts`, `drive-space-manager.tsx`, `ai-health.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `userCan()` connect `userCan` to `utils.ts`, `budgets/export/route.ts`, `lib/session.ts`, `button.tsx`, `demandes/[id]/page.tsx`, `prisma`, `formatCurrency`, `lib/labels.ts`, `events.ts`, `requireModule`, `getCurrentUser`, `dossiers.ts`, `recordAudit`, `notifyUser`, `requireUser`, `custom-field-actions.ts`, `drive-actions.ts`, `anyRoleFilter`, `prisma.ts`, `getBlob`, `reminder-actions.ts`, `assistant-actions.ts`, `promo-material-actions.ts`, `meeting-actions.ts`, `regulatory/[id]/page.tsx`, `notifyRoles`, `molecule.ts`, `formatDateTime`, `adoption.ts`, `hasGlobalView`, `anpp-process.tsx`, `(app)/layout.tsx`, `messaging-actions.ts`, `assistant.ts`, `calendar.ts`, `users/[id]/page.tsx`, `dossier-actions.ts`, `test-center/page.tsx`, `medical-info-actions.ts`, `validation-actions.ts`, `molecule-panel.tsx`, `queries/messaging.ts`, `medical-directory.tsx`, `rh/[id]/page.tsx`, `mail-client.tsx`, `departments.ts`, `entity-access.ts`, `finances/page.tsx`, `pch-tender-line-actions.ts`, `company.ts`, `market-presentation.ts`, `adventum-brain/page.tsx`, `new-conversation.tsx`, `budget-envelope-actions.ts`, `medical-actions.ts`, `market-research-actions.ts`, `market-research.ts`, `process-intelligence.ts`, `access/page.tsx`, `support-actions.ts`, `department-actions.ts`, `directive-actions.ts`, `field-report-actions.ts`, `congress.ts`, `regulatory-request-actions.ts`, `dashboard.ts`, `messaging/messages/route.ts`, `ai/page.tsx`, `stock-snapshot-actions.ts`, `pch/export/route.ts`, `ai-health.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `ACTION_COLS`, `ACTION_LABELS`, `Opt` to the rest of the system?**
  _1042 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.044131622713233544 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.035454545454545454 - nodes in this community are weakly interconnected._
- **Should `lib/session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03436241610738255 - nodes in this community are weakly interconnected._