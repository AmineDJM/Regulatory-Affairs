import type { CurrentUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";

/**
 * CATALOGUE DES OPS DE DOMAINE — la couche SYSTÉMIQUE qui ferme les trous de parité en série.
 *
 * Une « op » = un geste métier de l'écran (bouton, menu, décision) exposé au Chief à travers un
 * OUTIL DE DOMAINE (`drive_operation`, `task_operation`, `finance_operation`…) : l'outil reçoit
 * `{ op, ...entrées humaines }`, la proposition résout et montre, l'exécution appelle L'ACTION
 * CANONIQUE de l'écran. Ce fichier ne contient QUE les MÉTADONNÉES (pur, sans Prisma ni actions
 * serveur) : le registre ZERO-GAP l'importe pour la découverte, les alias et la reclassification
 * AUTOMATIQUE de l'inventaire (chaque op déclare les server actions qu'elle couvre — les ajouter
 * ici fait passer leurs clés de GAP à NATIVE sans toucher la classification à la main).
 *
 * Les implémentations (résolution + exécution) vivent dans `impl-<domaine>.ts`, importées par
 * l'orchestrateur seulement.
 */

export type OpRisk = "NORMAL" | "SENSITIVE" | "CRITICAL";

export interface OpMeta {
  /** Outil de domaine porteur (`drive_operation`…). */
  tool: string;
  /** Valeur du champ `op` de l'outil. */
  op: string;
  /** Module d'écran, en français. */
  module: string;
  /** Le libellé du geste tel qu'il se lit à l'écran. */
  uiLabel: string;
  /** Formulations naturelles (repliées par le matcher du registre). */
  aliases: string[];
  risk: OpRisk;
  /** Effet, qui est touché, réversibilité — la sémantique. */
  summary: string;
  /** Pré-filtre synchrone (l'action canonique revérifie toujours). */
  gate: (user: CurrentUser) => boolean;
  gateNote?: string;
  /** Clés d'inventaire `fichier:fonction` que cette op rend NATIVE. */
  covers: string[];
}

const isSA = (u: CurrentUser) => u.role === "SUPER_ADMIN";

export const OPS_CATALOG: OpMeta[] = [
  // ───────────────────────────── DRIVE (écritures) ─────────────────────────────
  {
    tool: "drive_operation", op: "create_folder", module: "Drive",
    uiLabel: "Nouveau dossier",
    aliases: ["crée un dossier dans le drive", "nouveau dossier drive"],
    risk: "NORMAL",
    summary: "Crée un dossier (à la racine personnelle, dans un dossier parent ou une catégorie). Réversible (corbeille Drive).",
    gate: (u) => userCan(u, "DRIVE", "CREATE") || userCan(u, "DRIVE", "VIEW"),
    gateNote: "éditeur du dossier parent, ou droit Créer à la racine",
    covers: ["drive-actions:createFolder"],
  },
  {
    tool: "drive_operation", op: "rename", module: "Drive",
    uiLabel: "Renommer",
    aliases: ["renomme le fichier", "renomme le dossier drive"],
    risk: "NORMAL",
    summary: "Renomme un fichier ou dossier du Drive (accès éditeur requis). Réversible en renommant à nouveau.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:renameNode"],
  },
  {
    tool: "drive_operation", op: "move", module: "Drive",
    uiLabel: "Déplacer",
    aliases: ["déplace le fichier", "range ce fichier dans", "mets ce document dans le dossier"],
    risk: "NORMAL",
    summary: "Déplace un élément (et son sous-arbre) vers un autre dossier — la catégorie de destination s'applique à tout le sous-arbre.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:moveNode", "drive-actions:moveNodes"],
  },
  {
    tool: "drive_operation", op: "share", module: "Drive",
    uiLabel: "Partager",
    aliases: ["partage le dossier avec", "donne accès au fichier", "partage ce document"],
    risk: "NORMAL",
    summary: "Partage un élément avec des collègues (lecture ou modification) — chacun est notifié.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:shareNode", "drive-actions:shareNodeWithMany", "drive-actions:shareNodesWithMany"],
  },
  {
    tool: "drive_operation", op: "unshare", module: "Drive",
    uiLabel: "Retirer le partage",
    aliases: ["retire le partage", "coupe l'accès au dossier de"],
    risk: "NORMAL",
    summary: "Retire l'accès d'une personne à un élément partagé.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:unshareNode"],
  },
  {
    tool: "drive_operation", op: "trash", module: "Drive",
    uiLabel: "Mettre à la corbeille",
    aliases: ["mets à la corbeille", "corbeille ce fichier"],
    risk: "NORMAL",
    summary: "Met un élément (et son contenu) à la corbeille Drive — RESTAURABLE.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:trashNode", "drive-actions:trashNodes"],
  },
  {
    tool: "drive_operation", op: "restore", module: "Drive",
    uiLabel: "Restaurer (corbeille Drive)",
    aliases: ["restaure de la corbeille drive", "sors ce fichier de la corbeille"],
    risk: "NORMAL",
    summary: "Restaure un élément de la corbeille Drive (avec son sous-arbre) ; si son parent a disparu, il revient à la racine.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:restoreNode"],
  },
  {
    tool: "drive_operation", op: "delete", module: "Drive",
    uiLabel: "Supprimer définitivement (Drive)",
    aliases: ["supprime définitivement du drive", "efface le fichier pour de bon"],
    risk: "CRITICAL",
    summary: "Suppression RÉELLE d'un élément du Drive : fichiers et versions effacés, AUCUN retour possible.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:deleteNode"],
  },
  {
    tool: "drive_operation", op: "create_office", module: "Drive / Bureautique",
    uiLabel: "Nouveau document (Word/Excel/PowerPoint)",
    aliases: ["crée un document word", "nouveau document bureautique", "crée une feuille excel"],
    risk: "NORMAL",
    summary: "Crée un document bureautique vierge (docx/xlsx/pptx) dans le Drive, éditable dans l'app.",
    gate: (u) => userCan(u, "DRIVE", "CREATE") || userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:createOfficeNode"],
  },
  {
    tool: "drive_operation", op: "to_pdf", module: "Drive / Bureautique",
    uiLabel: "Convertir en PDF",
    aliases: ["convertis en pdf", "fais un pdf de ce document"],
    risk: "NORMAL",
    summary: "Produit un PDF à côté du document bureautique (l'original reste intact).",
    gate: (u) => userCan(u, "DRIVE", "CREATE"),
    covers: ["drive-actions:convertNodeToPdf"],
  },

  // ─────────────────────── TÂCHES — côté « moi » (répondre/faire) ───────────────────────
  {
    tool: "task_operation", op: "accept", module: "Espace de travail",
    uiLabel: "Accepter la demande de tâche",
    aliases: ["accepte la tâche", "j'accepte la demande de tâche"],
    risk: "NORMAL",
    summary: "Accepte une demande de tâche qui vous est adressée — accepter, c'est commencer (le demandeur est notifié).",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:respondTaskRequest"],
  },
  {
    tool: "task_operation", op: "refuse", module: "Espace de travail",
    uiLabel: "Refuser la demande de tâche",
    aliases: ["refuse la tâche", "décline la demande de tâche"],
    risk: "NORMAL",
    summary: "Refuse une demande de tâche (motif facultatif) — le demandeur est notifié avec le motif.",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: [],
  },
  {
    tool: "task_operation", op: "submit_work", module: "Espace de travail",
    uiLabel: "Valider mon travail",
    aliases: ["valide mon travail sur la tâche", "marque la tâche comme faite avec compte rendu", "j'ai terminé la tâche"],
    risk: "NORMAL",
    summary: "Marque la tâche FAITE avec un compte rendu (toujours modifiable ensuite) — le demandeur est notifié.",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:submitTaskWork"],
  },
  {
    tool: "task_operation", op: "reopen", module: "Espace de travail",
    uiLabel: "Rouvrir la tâche",
    aliases: ["rouvre la tâche", "la tâche n'est pas finie"],
    risk: "NORMAL",
    summary: "Rouvre une tâche marquée faite (retour En cours).",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:reopenTaskWork"],
  },
  {
    tool: "task_operation", op: "comment", module: "Espace de travail",
    uiLabel: "Commenter la tâche",
    aliases: ["commente la tâche", "ajoute un message sur la tâche"],
    risk: "NORMAL",
    summary: "Ajoute un message au fil d'échange de la tâche (visible des personnes de la tâche).",
    gate: (u) => userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:addTaskComment"],
  },

  // ───────────────────────────── FINANCES (écritures) ─────────────────────────────
  {
    tool: "finance_operation", op: "create_transaction", module: "Finances",
    uiLabel: "Nouvelle écriture (encaissement / décaissement)",
    aliases: ["enregistre un décaissement", "enregistre un encaissement", "nouvelle écriture comptable", "saisis une dépense dans les finances"],
    risk: "SENSITIVE",
    summary: "Enregistre une écriture du livre (sens, catégorie, montant DZD, statut prévu/réalisé) — une écriture RÉALISÉE impacte la trésorerie. Réversible en modifiant/annulant l'écriture.",
    gate: (u) => userCan(u, "FINANCES", "CREATE"),
    covers: ["finance-actions:createTransaction"],
  },
  {
    tool: "finance_operation", op: "quick_income", module: "Finances",
    uiLabel: "Encaissement simple",
    aliases: ["encaissement rapide", "enregistre une recette", "on a encaissé"],
    risk: "SENSITIVE",
    summary: "Enregistre une RECETTE réalisée en un geste (libellé, montant DZD, client) — impacte la trésorerie.",
    gate: (u) => userCan(u, "FINANCES", "CREATE"),
    covers: ["finance-actions:createQuickIncome"],
  },
  {
    tool: "finance_operation", op: "set_transaction_status", module: "Finances",
    uiLabel: "Statut d'une écriture (prévu / réalisé / annulé)",
    aliases: ["marque l'écriture réalisée", "annule l'écriture comptable", "passe la transaction en réalisé"],
    risk: "NORMAL",
    summary: "Change le statut d'une écriture existante — RÉALISÉ compte dans la trésorerie, ANNULÉ l'en retire.",
    gate: (u) => userCan(u, "FINANCES", "UPDATE"),
    covers: ["finance-actions:updateTransactionStatus"],
  },
  {
    tool: "finance_operation", op: "set_opening_balance", module: "Finances",
    uiLabel: "Solde d'ouverture d'un compte de trésorerie",
    aliases: ["solde d'ouverture du compte", "règle le solde initial", "fixe le solde de départ du compte"],
    risk: "SENSITIVE",
    summary: "Fixe (ou corrige) le solde d'ouverture d'un compte de trésorerie à une date donnée — tous les soldes affichés en découlent.",
    gate: (u) => userCan(u, "FINANCES", "UPDATE"),
    covers: ["finance-actions:setTreasuryOpeningBalance"],
  },
  {
    tool: "finance_operation", op: "settle_expense_order", module: "Finances → Règlements",
    uiLabel: "Régler l'ordre de dépense",
    aliases: ["règle l'ordre de dépense", "paie l'ordre", "règlement de l'ordre de dépense"],
    risk: "SENSITIVE",
    summary: "Règle un ordre de dépense EN ATTENTE : l'argent sort (écriture générée, budget imputé). Le verrou du Centre de paiement et la facture obligatoire s'appliquent tels quels.",
    gate: (u) => userCan(u, "FINANCES", "UPDATE"),
    covers: ["expense-actions:settleExpenseOrder"],
  },
  {
    tool: "finance_operation", op: "cancel_expense_order", module: "Finances → Règlements",
    uiLabel: "Annuler l'ordre de dépense",
    aliases: ["annule l'ordre de dépense", "abandonne l'ordre de paiement"],
    risk: "NORMAL",
    summary: "Annule un ordre de dépense non réglé — rien n'est décaissé.",
    gate: (u) => userCan(u, "FINANCES", "UPDATE"),
    covers: ["expense-actions:cancelExpenseOrder"],
  },
  {
    tool: "finance_operation", op: "create_invoice", module: "Finances → Factures",
    uiLabel: "Nouvelle facture",
    aliases: ["enregistre une facture", "nouvelle facture reçue", "ajoute la facture au registre"],
    risk: "NORMAL",
    summary: "Ajoute une facture au registre (reçue OUT ou émise IN, montant, échéance) — l'enregistrement ne paie rien.",
    gate: (u) => userCan(u, "FINANCES", "CREATE"),
    covers: ["invoice-actions:createInvoice"],
  },
  {
    tool: "finance_operation", op: "set_invoice_paid", module: "Finances → Factures",
    uiLabel: "Marquer la facture payée / impayée",
    aliases: ["marque la facture payée", "la facture est réglée", "facture impayée"],
    risk: "NORMAL",
    summary: "Marque une facture payée à une date (ou repasse impayée) — le registre suit le réel.",
    gate: (u) => userCan(u, "FINANCES", "UPDATE"),
    covers: ["invoice-actions:setInvoicePaid"],
  },
  {
    tool: "finance_operation", op: "decide_petty_topup", module: "Budgets → Caisse d'avance",
    uiLabel: "Trancher la rallonge de caisse",
    aliases: ["accorde la rallonge de caisse", "refuse la rallonge de caisse", "tranche la demande de rallonge"],
    risk: "SENSITIVE",
    summary: "Accorde (montant ajusté possible) ou refuse une demande de rallonge de caisse d'avance — le titulaire est notifié, le fonds du mois est augmenté d'autant.",
    gate: (u) => hasGlobalView(u) || userCan(u, "RH", "UPDATE") || userCan(u, "BUDGETS", "UPDATE") || userCan(u, "BUDGETS", "VALIDATE"),
    covers: ["petty-cash-actions:decidePettyCashTopUp"],
  },
  {
    tool: "finance_operation", op: "decide_department_budget", module: "Budgets → Départements",
    uiLabel: "Trancher la demande de budget de département",
    aliases: ["accorde le budget du département", "refuse la demande de budget", "tranche la demande de budget"],
    risk: "SENSITIVE",
    summary: "Approuve ou refuse une demande de budget de département (la rallonge s'ajoute au budget de l'année) — le demandeur est notifié.",
    gate: (u) => hasGlobalView(u) || userCan(u, "BUDGETS", "UPDATE") || userCan(u, "BUDGETS", "VALIDATE"),
    gateNote: "selon les accès Budgets réglés en Administration",
    covers: ["department-budget-actions:decideDepartmentBudgetRequest"],
  },

  // ───────────────────────────── REGULATORY (au-delà des champs) ─────────────────────────────
  {
    tool: "regulatory_operation", op: "create_product", module: "Regulatory",
    uiLabel: "Nouveau dossier réglementaire",
    aliases: ["crée un dossier réglementaire", "nouveau dossier regulatory", "ouvre un dossier amm"],
    risk: "NORMAL",
    summary: "Crée un dossier Regulatory (référence auto REG-AAAA-NNN, DCI, ENTITÉ obligatoire — elle décide qui voit le dossier — responsable, dates cibles) avec ses 17 étapes semées.",
    gate: (u) => userCan(u, "REGULATORY", "CREATE"),
    covers: ["regulatory-actions:createRegulatoryProduct"],
  },
  {
    tool: "regulatory_operation", op: "set_participants", module: "Regulatory",
    uiLabel: "Participants du dossier",
    aliases: ["participants du dossier", "donne accès au dossier réglementaire à", "ajoute au dossier regulatory"],
    risk: "NORMAL",
    summary: "REMPLACE la liste des participants d'un dossier (le responsable et l'assistant restent d'office) — c'est ce qui ouvre le dossier aux personnes nommées.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    covers: ["regulatory-actions:setRegulatoryParticipants"],
  },
  {
    tool: "regulatory_operation", op: "add_comment", module: "Regulatory",
    uiLabel: "Commenter le dossier",
    aliases: ["commente le dossier réglementaire", "ajoute une note au dossier regulatory"],
    risk: "NORMAL",
    summary: "Ajoute un commentaire au fil du dossier (visible de ceux qui voient le dossier).",
    gate: (u) => userCan(u, "REGULATORY", "VIEW"),
    covers: ["regulatory-actions:addRegulatoryComment"],
  },
  {
    tool: "regulatory_operation", op: "update_step_details", module: "Regulatory",
    uiLabel: "Détail d'une étape (dates, note, pièces manquantes)",
    aliases: ["date planifiée de l'étape", "pièces manquantes de l'étape", "détail de l'étape du dossier"],
    risk: "NORMAL",
    summary: "Met à jour le DÉTAIL d'une étape de la chronologie du dossier : statut, date planifiée/réelle, note, pièces manquantes, responsable de l'étape.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    covers: ["regulatory-actions:updateRegulatoryStep"],
  },
  {
    tool: "regulatory_operation", op: "set_checklist_item", module: "Regulatory",
    uiLabel: "Checklist de présoumission (cocher un document)",
    aliases: ["coche le document de présoumission", "document fourni dans la checklist", "checklist du dossier"],
    risk: "NORMAL",
    summary: "Coche ou décoche un document de la checklist de présoumission (note facultative) — l'avancement affiché en découle.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    covers: ["regulatory-actions:setRegulatoryChecklistItem"],
  },
  {
    tool: "regulatory_operation", op: "create_variation", module: "Regulatory",
    uiLabel: "Déposer une variation de fabrication",
    aliases: ["dépose une variation", "variation de fabrication", "variation packaging local"],
    risk: "NORMAL",
    summary: "Ouvre une variation vers un statut de fabrication supérieur (packaging secondaire/primaire/full process) — en attente jusqu'à la décision.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    covers: ["regulatory-actions:createVariation"],
  },
  {
    tool: "regulatory_operation", op: "set_variation_status", module: "Regulatory",
    uiLabel: "Statut d'une variation (obtenue / en attente / annulée)",
    aliases: ["variation obtenue", "annule la variation", "statut de la variation"],
    risk: "NORMAL",
    summary: "Change le statut d'une variation. « OBTENUE » PROMEUT le statut de fabrication du produit — réservé au Super Admin (même verrou que l'écran).",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    gateNote: "« obtenue » exige le Super Admin (statut structurel)",
    covers: ["regulatory-actions:setVariationStatus"],
  },
  {
    tool: "regulatory_operation", op: "request_bv", module: "Regulatory",
    uiLabel: "Demander un BV (ordre de dépense ANPP)",
    aliases: ["demande un bv", "paiement du bv anpp", "bulletin de versement du dossier"],
    risk: "SENSITIVE",
    summary: "Crée l'ORDRE DE DÉPENSE du BV ANPP (montant DZD, échéance) — il part dans le circuit Finances/Centre de paiement, rien n'est décaissé ici.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    covers: ["regulatory-actions:requestBV"],
  },
  {
    tool: "regulatory_operation", op: "set_classification", module: "Regulatory",
    uiLabel: "Entité & segments thérapeutiques du dossier",
    aliases: ["segments thérapeutiques du dossier", "change l'entité du dossier", "classement du dossier réglementaire"],
    risk: "NORMAL",
    summary: "Met à jour le classement d'un dossier : segments thérapeutiques (liste REMPLACÉE) et/ou entité — changer l'ENTITÉ déplace le dossier d'une société à l'autre (Super Admin, même règle que l'écran).",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
    gateNote: "le changement d'entité exige le Super Admin",
    covers: ["regulatory-actions:setRegulatoryClassification"],
  },

  // ───────────────────────────── RH (décisions & circuit) ─────────────────────────────
  {
    tool: "hr_operation", op: "decide_leave", module: "RH → Congés",
    uiLabel: "Approuver / refuser le congé",
    aliases: ["approuve le congé de", "refuse le congé de", "valide la demande de congé"],
    risk: "SENSITIVE",
    summary: "Décision sur une demande de congé EN ATTENTE — le circuit congés (N+1 → RH → direction) décide qui peut signer chaque marche ; le demandeur est notifié.",
    gate: () => true,
    gateNote: "l'autorité réelle est décidée par le circuit congés selon l'étape",
    covers: ["hr-actions:decideLeave"],
  },
  {
    tool: "hr_operation", op: "cancel_leave", module: "RH → Congés",
    uiLabel: "Annuler le congé",
    aliases: ["annule le congé de", "annulation de la demande de congé"],
    risk: "NORMAL",
    summary: "Annule une demande de congé (en attente ou accordée) — le solde repart si déjà décompté.",
    gate: () => true,
    gateNote: "le demandeur, ou les RH",
    covers: ["hr-actions:cancelLeave"],
  },
  {
    tool: "hr_operation", op: "decide_advance", module: "RH → Avances",
    uiLabel: "Trancher l'avance sur salaire",
    aliases: ["accorde l'avance sur salaire", "refuse l'avance de", "tranche l'avance sur salaire"],
    risk: "SENSITIVE",
    summary: "Approuve ou refuse une avance sur salaire EN ATTENTE — le montant partira ensuite par le circuit Finances.",
    gate: (u) => userCan(u, "RH", "VALIDATE"),
    covers: ["hr-actions:decideAdvance"],
  },
  {
    tool: "hr_operation", op: "set_employee_active", module: "RH",
    uiLabel: "Activer / désactiver la fiche employé",
    aliases: ["désactive la fiche employé", "réactive l'employé", "l'employé a quitté l'entreprise"],
    risk: "SENSITIVE",
    summary: "Active ou désactive une fiche employé (départ / retour) — la fiche sort des listes actives, rien n'est effacé.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["hr-actions:setEmployeeActive"],
  },
  {
    tool: "hr_operation", op: "process_hr_request", module: "RH → Demandes",
    uiLabel: "Traiter la demande RH (statut)",
    aliases: ["l'attestation est prête", "marque la demande rh traitée", "traite la demande rh de"],
    risk: "NORMAL",
    summary: "Fait avancer une demande RH (attestation, relevé…) : en préparation, prête, remise, accordée ou refusée — le demandeur est notifié à chaque marche.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["hr-document-actions:processHrRequest"],
  },
  {
    tool: "hr_operation", op: "decide_expense_report", module: "RH → Notes de frais",
    uiLabel: "Trancher la note de frais",
    aliases: ["approuve la note de frais", "refuse la note de frais", "note de frais sur le mois suivant"],
    risk: "SENSITIVE",
    summary: "Approuve une note de frais (sur son mois ou le mois SUIVANT) ou la refuse — l'imputation de paie suit la décision.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["hr-document-actions:decideExpenseReport"],
  },
  {
    tool: "hr_operation", op: "decide_training", module: "RH → Formations",
    uiLabel: "Trancher la demande de formation",
    aliases: ["approuve la formation", "refuse la demande de formation", "valide la formation de"],
    risk: "NORMAL",
    summary: "Décision sur une demande de formation — la chaîne de validation (N+1 / RH / administration) décide qui signe ; le demandeur est notifié.",
    gate: () => true,
    gateNote: "l'autorité réelle est décidée par la chaîne de validation",
    covers: ["training-actions:decideTraining"],
  },
  {
    tool: "hr_operation", op: "decide_recruitment_step", module: "RH → Recrutement",
    uiLabel: "Trancher l'étape de recrutement",
    aliases: ["approuve la demande de recrutement", "refuse le recrutement", "valide l'étape de recrutement"],
    risk: "SENSITIVE",
    summary: "Approuve ou refuse l'étape courante d'une demande de recrutement — la chaîne des validateurs décide qui signe ; un refus clôt la demande.",
    gate: () => true,
    gateNote: "l'autorité réelle est décidée par la chaîne des validateurs",
    covers: ["recruitment-actions:decideRecruitmentStep"],
  },

  // ───────────────────────────── RÉUNIONS ─────────────────────────────
  {
    tool: "meeting_operation", op: "create", module: "Réunions",
    uiLabel: "Planifier une réunion",
    aliases: ["planifie une réunion", "organise une réunion avec", "cale une visio"],
    risk: "NORMAL",
    summary: "Crée une réunion (visio ou présentiel, heure d'Alger) et invite les participants — chacun reçoit l'invitation et répond.",
    gate: (u) => userCan(u, "MESSAGING", "CREATE"),
    covers: ["meeting-actions:createMeeting"],
  },
  {
    tool: "meeting_operation", op: "respond_invite", module: "Réunions",
    uiLabel: "Répondre à l'invitation",
    aliases: ["accepte l'invitation à la réunion", "décline la réunion", "réponds à l'invitation"],
    risk: "NORMAL",
    summary: "Répond à une invitation de réunion qui vous est adressée (accepter / décliner / peut-être) — l'organisateur est notifié.",
    gate: () => true,
    covers: ["meeting-actions:respondToMeetingInvite"],
  },
  {
    tool: "meeting_operation", op: "add_participants", module: "Réunions",
    uiLabel: "Inviter des participants",
    aliases: ["ajoute des participants à la réunion", "invite aussi à la réunion"],
    risk: "NORMAL",
    summary: "Invite des personnes supplémentaires à une réunion (réservé à l'organisateur) — chacune est notifiée.",
    gate: (u) => userCan(u, "MESSAGING", "CREATE"),
    gateNote: "organisateur de la réunion",
    covers: ["meeting-actions:addMeetingParticipants"],
  },
  {
    tool: "meeting_operation", op: "post_message", module: "Réunions",
    uiLabel: "Écrire dans le fil de la réunion",
    aliases: ["poste un message dans la réunion", "écris dans le fil de la réunion"],
    risk: "NORMAL",
    summary: "Poste un message dans le fil d'échange de la réunion (visible des participants).",
    gate: () => true,
    covers: ["meeting-actions:postMeetingMessage"],
  },
  {
    tool: "meeting_operation", op: "end", module: "Réunions",
    uiLabel: "Terminer la réunion",
    aliases: ["termine la réunion", "clôture la réunion"],
    risk: "NORMAL",
    summary: "Marque la réunion TERMINÉE (réservé à l'organisateur) — le compte rendu peut ensuite être rédigé.",
    gate: () => true,
    gateNote: "organisateur de la réunion",
    covers: ["meeting-actions:endMeeting"],
  },
  {
    tool: "meeting_operation", op: "delete", module: "Réunions",
    uiLabel: "Supprimer la réunion",
    aliases: ["supprime la réunion", "annule et supprime la réunion"],
    risk: "SENSITIVE",
    summary: "Supprime une réunion (réservé à l'organisateur) — les invités la voient disparaître de leur agenda.",
    gate: () => true,
    gateNote: "organisateur de la réunion",
    covers: ["meeting-actions:deleteMeeting"],
  },

  // ───────────────────────────── COURRIERS (registre) ─────────────────────────────
  {
    tool: "mail_operation", op: "create_entry", module: "Courriers",
    uiLabel: "Nouveau courrier au registre",
    aliases: ["enregistre un courrier", "nouveau courrier arrivé", "ajoute au registre des courriers"],
    risk: "NORMAL",
    summary: "Ajoute un pli au registre des courriers (entrant ou sortant, expéditeur/destinataire, n° de chrono).",
    gate: (u) => userCan(u, "MAIL_REGISTER", "CREATE"),
    covers: ["mail-register-actions:createMailEntry"],
  },
  {
    tool: "mail_operation", op: "edit_entry", module: "Courriers",
    uiLabel: "Corriger un courrier du registre",
    aliases: ["corrige le courrier", "modifie l'entrée du registre des courriers"],
    risk: "NORMAL",
    summary: "Corrige un pli du registre (titre, sens, expéditeur, destinataire, chrono, notes) — les champs non cités sont préservés.",
    gate: (u) => userCan(u, "MAIL_REGISTER", "UPDATE"),
    covers: ["mail-register-actions:editMailEntry"],
  },
  {
    tool: "mail_operation", op: "move_entries", module: "Courriers",
    uiLabel: "Classer dans un dossier de courriers",
    aliases: ["classe le courrier dans le dossier", "range les courriers dans"],
    risk: "NORMAL",
    summary: "Classe un ou plusieurs plis dans un dossier du registre (« Non classés » pour les sortir d'un dossier).",
    gate: (u) => userCan(u, "MAIL_REGISTER", "UPDATE"),
    covers: ["mail-folder-actions:moveMailEntries"],
  },
  {
    tool: "mail_operation", op: "attach_drive", module: "Courriers",
    uiLabel: "Déclarer un fichier Drive en courrier",
    aliases: ["déclare ce fichier en courrier", "classe ce document dans les courriers"],
    risk: "NORMAL",
    summary: "Référence un fichier du Drive comme pli du registre (SANS copie) — un fichier déjà déclaré n'est jamais doublonné.",
    gate: (u) => userCan(u, "MAIL_REGISTER", "CREATE"),
    covers: ["mail-register-actions:attachDriveNodeToMail"],
  },

  // ───────────────────────────── LEGAL ─────────────────────────────
  {
    tool: "legal_operation", op: "renew", module: "Legal",
    uiLabel: "Renouveler le document légal",
    aliases: ["renouvelle le contrat", "renouvellement du document légal"],
    risk: "NORMAL",
    summary: "Crée le document SUIVANT de la chaîne (nouvelles dates) — l'ancien est marqué renouvelé, l'historique reste lisible.",
    gate: (u) => userCan(u, "LEGAL", "UPDATE"),
    covers: ["legal-actions:renewLegalDocument"],
  },
  {
    tool: "legal_operation", op: "cancel", module: "Legal",
    uiLabel: "Annuler le document légal",
    aliases: ["annule le contrat", "résilie le document légal"],
    risk: "SENSITIVE",
    summary: "Annule un document légal (motif conservé) — il sort des rappels d'échéance, rien n'est effacé.",
    gate: (u) => userCan(u, "LEGAL", "UPDATE"),
    covers: ["legal-actions:cancelLegalDocument"],
  },
  {
    tool: "legal_operation", op: "set_readers", module: "Legal",
    uiLabel: "Lecteurs du document légal",
    aliases: ["lecteurs du document légal", "donne accès au contrat à", "qui peut lire le contrat"],
    risk: "NORMAL",
    summary: "REMPLACE la liste des lecteurs d'un document légal (le déposant garde toujours l'accès) — nul autre ne voit.",
    gate: (u) => userCan(u, "LEGAL", "UPDATE"),
    gateNote: "le déposant du document",
    covers: ["legal-actions:setLegalReaders"],
  },
  {
    tool: "legal_operation", op: "send_invoice_settlement", module: "Legal",
    uiLabel: "Envoyer la facture au règlement",
    aliases: ["envoie la facture au règlement", "facture légale au règlement"],
    risk: "SENSITIVE",
    summary: "Crée l'ORDRE DE DÉPENSE d'une facture légale (montant requis) — il part dans le circuit Finances/Centre de paiement, rien n'est décaissé ici.",
    gate: (u) => userCan(u, "LEGAL", "UPDATE") || userCan(u, "FINANCES", "CREATE"),
    covers: ["legal-actions:sendLegalInvoiceToSettlement"],
  },

  // ─────────────────────── ADMINISTRATION STRUCTURELLE (org) ───────────────────────
  {
    tool: "org_operation", op: "create_company", module: "Administration → Entités",
    uiLabel: "Nouvelle entité",
    aliases: ["crée une entité", "nouvelle société du groupe", "ajoute l'entité"],
    risk: "SENSITIVE",
    summary: "Crée une entité du groupe (le cloisonnement par entité s'y applique aussitôt).",
    gate: isSA,
    gateNote: "administration des entités",
    covers: ["company-actions:createCompany"],
  },
  {
    tool: "org_operation", op: "toggle_company", module: "Administration → Entités",
    uiLabel: "Activer / désactiver l'entité",
    aliases: ["désactive l'entité", "réactive la société"],
    risk: "SENSITIVE",
    summary: "Active ou désactive une entité — désactivée, elle sort des menus de rattachement (rien n'est effacé).",
    gate: isSA,
    covers: ["company-actions:toggleCompany"],
  },
  {
    tool: "org_operation", op: "create_department", module: "Administration → Départements",
    uiLabel: "Nouveau département",
    aliases: ["crée un département", "nouveau sous-département"],
    risk: "NORMAL",
    summary: "Crée un département (ou sous-département : l'entité suit celle du parent) dans l'organigramme.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["department-actions:createDepartment"],
  },
  {
    tool: "org_operation", op: "assign_department", module: "Administration → Départements",
    uiLabel: "Rattacher l'employé à un département",
    aliases: ["rattache l'employé au département", "change le département de"],
    risk: "NORMAL",
    summary: "Rattache un employé à un département (ou l'en détache) — l'organigramme et les circuits N+1 suivent.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["department-actions:assignEmployeeDepartment"],
  },
  {
    tool: "org_operation", op: "assign_manager", module: "Administration → Départements",
    uiLabel: "Désigner le N+1 de l'employé",
    aliases: ["désigne le manager de", "change le n+1 de", "rattache l'employé à son responsable"],
    risk: "NORMAL",
    summary: "Désigne (ou retire) le responsable hiérarchique direct d'un employé — les circuits de validation N+1 suivent.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
    covers: ["department-actions:assignEmployeeManager"],
  },
  {
    tool: "org_operation", op: "create_supplier", module: "Administration → Fournisseurs",
    uiLabel: "Nouveau fournisseur (portail)",
    aliases: ["crée un fournisseur", "nouveau partenaire fournisseur"],
    risk: "SENSITIVE",
    summary: "Crée un fournisseur du portail externe (pays, e-mail de contact) — ses accès se gèrent ensuite fiche par fiche.",
    gate: isSA,
    covers: ["supplier-actions:createSupplier"],
  },
  {
    tool: "org_operation", op: "toggle_supplier", module: "Administration → Fournisseurs",
    uiLabel: "Activer / désactiver le fournisseur",
    aliases: ["désactive le fournisseur", "coupe l'accès du fournisseur"],
    risk: "SENSITIVE",
    summary: "Active ou désactive un fournisseur du portail — désactivé, son portail ne répond plus (réversible).",
    gate: isSA,
    covers: ["supplier-actions:toggleSupplier"],
  },
  {
    tool: "org_operation", op: "create_contact", module: "Moyens généraux → Annuaire d'entreprise",
    uiLabel: "Nouveau contact d'entreprise",
    aliases: ["ajoute un contact d'entreprise", "nouveau contact agence", "enregistre le contact de l'imprimeur"],
    risk: "NORMAL",
    summary: "Ajoute un contact à l'annuaire d'entreprise (agence, livreur, imprimeur… : nature, personne, téléphone, e-mail).",
    gate: (u) => userCan(u, "GENERAL_MEANS", "CREATE"),
    covers: ["company-contact-actions:createCompanyContact"],
  },

  // ───────────────────────────── AD & PRO / COMMERCIAL ─────────────────────────────
  {
    tool: "adpro_operation", op: "decide_item", module: "Ad & Pro",
    uiLabel: "Trancher un poste de dépense (Direction)",
    aliases: ["accorde le poste de dépense", "refuse le poste ad pro", "tranche le poste de dépense", "budget à revoir sur le poste"],
    risk: "SENSITIVE",
    summary: "Décision de la Direction sur un poste SOUMIS d'une opération Ad & Pro : accordé (montant ajustable), refusé, ou budget à revoir — le demandeur est notifié.",
    gate: (u) => isSA(u) || hasGlobalView(u),
    covers: ["ad-pro-item-actions:decideAdProItem"],
  },
  {
    tool: "adpro_operation", op: "transfer", module: "Ad & Pro",
    uiLabel: "Transférer la demande vers un autre module",
    aliases: ["transfère la demande vers", "bascule le sponsoring en prise en charge", "cette demande est en réalité un congrès"],
    risk: "SENSITIVE",
    summary: "Transfère une demande Ad & Pro (Sponsoring ↔ Prises en charge nationale/internationale) : les pièces suivent, l'ancien circuit est clos, le circuit de la destination repart du début. Refusé si un ordre de dépense a déjà été émis.",
    gate: (u) => isSA(u) || hasGlobalView(u),
    covers: ["ad-pro-transfer-actions:transferAdProRequest"],
  },
  {
    tool: "adpro_operation", op: "validate_promo_step", module: "Matériel promotionnel",
    uiLabel: "Valider l'étape du circuit promo",
    aliases: ["valide l'étape du matériel promo", "valide le devis promo", "étape suivante du circuit promo"],
    risk: "NORMAL",
    summary: "Valide l'étape COURANTE du circuit d'un dossier de matériel promotionnel — la personne de l'étape suivante est notifiée. L'étape décide qui peut valider.",
    gate: () => true,
    gateNote: "l'étape courante du circuit décide qui valide",
    covers: ["promo-circuit-actions:validatePromoStep"],
  },
  {
    tool: "adpro_operation", op: "refuse_promo_step", module: "Matériel promotionnel",
    uiLabel: "Refuser l'étape du circuit promo",
    aliases: ["refuse l'étape du matériel promo", "rejette le devis promo"],
    risk: "NORMAL",
    summary: "Refuse l'étape courante du circuit promo (motif) — le dossier revient en arrière, le demandeur est notifié.",
    gate: () => true,
    gateNote: "l'étape courante du circuit décide qui refuse",
    covers: ["promo-circuit-actions:refusePromoStep"],
  },
  {
    tool: "bd_operation", op: "create", module: "Business Development",
    uiLabel: "Nouvelle opportunité BD",
    aliases: ["crée une opportunité bd", "nouvelle opportunité business development", "ajoute au pipeline bd"],
    risk: "NORMAL",
    summary: "Crée une opportunité Business Development (produit/DCI, classe thérapeutique) — elle démarre au stade Idée.",
    gate: (u) => userCan(u, "BUSINESS_DEVELOPMENT", "CREATE"),
    covers: ["bd-actions:createBD"],
  },
  {
    tool: "bd_operation", op: "update_status", module: "Business Development",
    uiLabel: "Stade de l'opportunité BD",
    aliases: ["passe l'opportunité bd en négociation", "stade de l'opportunité bd", "l'opportunité est validée"],
    risk: "NORMAL",
    summary: "Fait avancer (ou reculer) le stade d'une opportunité BD : idée, recherche, contacté, NDA, offre reçue, négociation, validée, abandonnée.",
    gate: (u) => userCan(u, "BUSINESS_DEVELOPMENT", "UPDATE"),
    covers: ["bd-actions:updateBDStatus"],
  },
  {
    tool: "stock_operation", op: "request_state", module: "Stocks PCH",
    uiLabel: "Demander un état de stock",
    aliases: ["demande un état de stock", "demande l'état des stocks de l'hôpital", "état de stock à"],
    risk: "NORMAL",
    summary: "Demande un état de stock à une personne (hôpitaux ciblés en option) — une demande de tâche part par le circuit normal (accepter/refuser).",
    gate: (u) => isSA(u) || userCan(u, "STOCKS", "DELETE"),
    gateNote: "Direction / Super Admin",
    covers: ["stock-snapshot-actions:requestStockState"],
  },
];

/** Index par outil → op (généré une fois). */
export const OPS_BY_TOOL: Record<string, Record<string, OpMeta>> = {};
for (const m of OPS_CATALOG) {
  (OPS_BY_TOOL[m.tool] ??= {})[m.op] = m;
}

/** Toutes les clés d'inventaire couvertes par le catalogue (reclassées NATIVE par le registre). */
export function catalogCoveredKeys(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of OPS_CATALOG) for (const k of m.covers) out.set(k, `${m.tool}:${m.op}`);
  return out;
}

export const opGlobalView = hasGlobalView;
export const opIsSA = isSA;
