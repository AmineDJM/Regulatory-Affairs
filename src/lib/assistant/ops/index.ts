import type { Module } from "@/lib/rbac";
import type { ClaudeToolDef } from "@/lib/ai";
import { OPS_BY_TOOL, type OpMeta } from "./catalog";
import type { OpImpl } from "./types";
import { DRIVE_OPS_IMPL } from "./impl-drive";
import { TASK_OPS_IMPL } from "./impl-task";
import { FINANCE_OPS_IMPL } from "./impl-finance";
import { FINANCE_BUDGET_OPS_IMPL } from "./impl-finance-budget";
import { FINANCE_FLOWS_OPS_IMPL } from "./impl-finance-flows";
import { REGULATORY_OPS_IMPL } from "./impl-regulatory";
import { HR_OPS_IMPL } from "./impl-hr";
import { HR2_OPS_IMPL, ACCESS_OPS_IMPL } from "./impl-hr2";
import { RECRUIT_TRAINING_OPS_IMPL, MISSION_OPS_IMPL, DOCREQ_OPS_IMPL, MEDINFO_OPS_IMPL } from "./impl-wave2b";
import { DRIVE3_OPS_IMPL, LEGAL3_OPS_IMPL, MAIL3_OPS_IMPL } from "./impl-wave3";
import { MEETING_OPS_IMPL } from "./impl-meeting";
import { MAIL_OPS_IMPL } from "./impl-mail";
import { LEGAL_OPS_IMPL } from "./impl-legal";
import { ORG_OPS_IMPL } from "./impl-org";
import { ADPRO_OPS_IMPL, BD_OPS_IMPL, STOCK_OPS_IMPL } from "./impl-commercial";

/**
 * ASSEMBLAGE des outils de domaine : le CATALOGUE (métadonnées pures) est zippé avec les
 * IMPLÉMENTATIONS (résolution + exécution) — une op déclarée sans implémentation fait
 * échouer le chargement (donc les tests) : le catalogue ne peut pas promettre dans le vide.
 *
 * Les DÉFINITIONS d'outils Claude sont GÉNÉRÉES d'ici : ajouter une op au catalogue met à
 * jour l'énumération `op` et la description de l'outil sans toucher l'orchestrateur.
 */

export interface DomainToolSpec {
  /** Module RBAC affiché sur la carte de confirmation. */
  module: Module;
  ops: Record<string, { meta: OpMeta; impl: OpImpl }>;
  def: ClaudeToolDef;
}

function zipOps(tool: string, impls: Record<string, OpImpl>): Record<string, { meta: OpMeta; impl: OpImpl }> {
  const metas = OPS_BY_TOOL[tool] ?? {};
  const out: Record<string, { meta: OpMeta; impl: OpImpl }> = {};
  for (const [op, meta] of Object.entries(metas)) {
    const impl = impls[op];
    if (!impl) throw new Error(`Op « ${tool}/${op} » déclarée au catalogue sans implémentation.`);
    out[op] = { meta, impl };
  }
  for (const op of Object.keys(impls)) {
    if (!metas[op]) throw new Error(`Implémentation « ${tool}/${op} » absente du catalogue (découverte/classification cassées).`);
  }
  return out;
}

function opsSummary(tool: string): string {
  return Object.values(OPS_BY_TOOL[tool] ?? {})
    .map((o) => `${o.op} = ${o.uiLabel}${o.risk === "CRITICAL" ? " [CRITIQUE]" : ""}`)
    .join(" ; ");
}

const opEnum = (tool: string): string[] => Object.keys(OPS_BY_TOOL[tool] ?? {});

export const DOMAIN_TOOLS: Record<string, DomainToolSpec> = {
  drive_operation: {
    module: "DRIVE",
    ops: zipOps("drive_operation", { ...DRIVE_OPS_IMPL, ...DRIVE3_OPS_IMPL }),
    def: {
      name: "drive_operation",
      description:
        "ÉCRITURES DRIVE — les gestes de l'écran Drive, par leurs actions canoniques (ACL réelle par élément, cascades, notifications, audit). "
        + `Champ « op » : ${opsSummary("drive_operation")}. `
        + "La cible se donne par NOM (« name ») — la résolution confirme l'élément exact avant toute proposition. "
        + "Les pièces jointes déposées dans ce chat SONT des fichiers Drive : « range ce fichier… » passe par ici.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("drive_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Nom de l'élément visé — ou nom du nouveau dossier/document pour create_folder/create_office." },
          folder: { type: "string", description: "Dossier parent ou de destination, par nom (« racine » = Drive personnel ; un nom de catégorie vise sa racine)." },
          newName: { type: "string", description: "rename : le nouveau nom." },
          people: { type: "string", description: "share/unshare : noms des personnes, séparés par des virgules." },
          access: { type: "string", description: "share : « lecture » (défaut) ou « modification »." },
          kind: { type: "string", description: "create_office : word, excel ou powerpoint." },
          person: { type: "string", description: "update_space : la personne à qui donner/retirer la lecture." },
          mode: { type: "string", description: "update_space : « retirer » (accès) ; archive_space : « désarchiver » ; update_letterhead : activer/désactiver." },
          icon: { type: "string", description: "Catégories : icône (emoji)." },
          comment: { type: "string", description: "comment/delete_comment : le commentaire (ou un extrait pour le retrouver)." },
        },
        required: ["op", "name"],
      },
    },
  },
  task_operation: {
    module: "WORKSPACE",
    ops: zipOps("task_operation", { ...TASK_OPS_IMPL, ...DOCREQ_OPS_IMPL }),
    def: {
      name: "task_operation",
      description:
        "MES TÂCHES — répondre à une demande de tâche et faire avancer les siennes, par les actions canoniques de l'écran (notifications au demandeur, audit). "
        + `Champ « op » : ${opsSummary("task_operation")}. `
        + "La tâche se donne par INTITULÉ (« title ») — seules les tâches où le geste est réellement possible sont proposées. "
        + "Pour CRÉER ou demander une tâche : create_task.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("task_operation"), description: "Le geste à faire." },
          title: { type: "string", description: "Intitulé (ou morceau d'intitulé) de la tâche visée." },
          reason: { type: "string", description: "refuse : motif du refus (facultatif)." },
          note: { type: "string", description: "submit_work : compte rendu du travail (facultatif)." },
          comment: { type: "string", description: "comment : le message à poster dans le fil." },
          person: { type: "string", description: "request_document : à qui demander la pièce (nom)." },
          label: { type: "string", description: "Demandes de pièces : la pièce visée (« Devis signé »…)." },
          target: { type: "string", description: "request_document : l'entité de rattachement (nom d'événement / congrès / sponsoring) — OBLIGATOIRE." },
          kind: { type: "string", description: "request_document : type de l'entité (événement | sponsoring | congrès international | congrès national)." },
          dueDate: { type: "string", description: "request_document : échéance (AAAA-MM-JJ)." },
          decision: { type: "string", description: "decide_document_request : accepter ou refuser." },
        },
        required: ["op"],
      },
    },
  },
  finance_operation: {
    module: "FINANCES",
    ops: zipOps("finance_operation", { ...FINANCE_OPS_IMPL, ...FINANCE_BUDGET_OPS_IMPL, ...FINANCE_FLOWS_OPS_IMPL }),
    def: {
      name: "finance_operation",
      description:
        "ÉCRITURES FINANCES & BUDGETS — livre comptable (créer/modifier/supprimer), ordres de dépense (régler, facture, révision), factures, DEMANDES DE PAIEMENT (dossier + pièces + décisions), caisses d'avance, enveloppes/catégories/imputations budgétaires, budgets de département et leurs accès, paie (bulletins, paie RH, transfert budget), Centre de paiement — par les actions canoniques (verrou du Centre de paiement, facture obligatoire et chaînes de validation INCLUS). "
        + `Champ « op » : ${opsSummary("finance_operation")}. `
        + "Montants en DZD. Les cibles se donnent par référence (FIN-…, OD-…, PAY-…, n° de facture) ou libellé ; caisses et budgets par nom de département ; enveloppes/catégories/dépenses par nom ; la paie par nom d'employé + mois. Les UPDATES sont des FUSIONS : seuls les champs cités changent.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("finance_operation"), description: "Le geste à faire." },
          label: { type: "string", description: "Libellé (création) ou libellé/titre de la cible (résolution)." },
          reference: { type: "string", description: "Référence exacte de la cible (FIN-…, OD-…, PAY-…, n° de facture)." },
          amount: { type: "string", description: "Montant en DZD (ex. « 1500000 » ou « 1 500 000,50 »)." },
          direction: { type: "string", description: "create_transaction/create_invoice : encaissement/décaissement, reçue/émise." },
          category: { type: "string", description: "Catégorie : de l'écriture (loyer, salaires…) ou budgétaire par NOM (imputations, transfert de paie)." },
          status: { type: "string", description: "Statut visé (prévu / réalisé / annulé ; payée / impayée)." },
          method: { type: "string", description: "create_transaction : espèces, virement, chèque, carte." },
          counterparty: { type: "string", description: "Contrepartie / client / destinataire." },
          date: { type: "string", description: "Date (AAAA-MM-JJ)." },
          dueDate: { type: "string", description: "Échéance (AAAA-MM-JJ)." },
          department: { type: "string", description: "Nom du département (caisse, budget départemental, accès ; « tous » = règle générale)." },
          decision: { type: "string", description: "Décisions : accorder/approuver/ajuster ou refuser ; decide_payment_request : instruire | attente | reprendre | renvoyer | bon à payer | refuser." },
          account: { type: "string", description: "Nom du compte de trésorerie (set_opening_balance, delete_treasury_account)." },
          note: { type: "string", description: "Note / motif de décision (obligatoire pour attente, refus, pièces mises en cause)." },
          notes: { type: "string", description: "Notes libres." },
          name: { type: "string", description: "Nom de la cible budgétaire (enveloppe, catégorie) — création ou résolution." },
          newName: { type: "string", description: "update_envelope / update_budget_category : nouveau nom." },
          newLabel: { type: "string", description: "update_* : nouveau libellé/objet." },
          newReference: { type: "string", description: "update_budget_expense : nouvelle référence." },
          envelope: { type: "string", description: "Nom de l'enveloppe budgétaire visée." },
          expense: { type: "string", description: "Dépense visée (référence imputée ou libellé départemental)." },
          parent: { type: "string", description: "create_budget_category : catégorie parente (sous-catégorie)." },
          transaction: { type: "string", description: "attribute_transaction / update_transaction : libellé ou référence de l'écriture." },
          person: { type: "string", description: "set_department_budget_access : la personne à ajouter/retirer." },
          nature: { type: "string", description: "set_department_budget_access : accès | moyens généraux | masse salariale | activité." },
          mode: { type: "string", description: "set_department_budget_access : « retirer » pour enlever (défaut : ajouter) ; create_payment_request : « brouillon » pour ne pas transmettre." },
          kind: { type: "string", description: "Nature du budget départemental : moyens généraux (OPERATING) | masse salariale (HR) | activité (ACTIVITY)." },
          reason: { type: "string", description: "Motif (demande de budget, rallonge de caisse, révision d'ordre)." },
          holder: { type: "string", description: "Caisse d'avance : la personne détentrice (nom)." },
          period: { type: "string", description: "Caisse d'avance : la période (« 2026-08 », « août 2026 » ; défaut mois courant)." },
          day: { type: "string", description: "set_petty_cash_plan : jour de rechargement (1–28)." },
          active: { type: "string", description: "set_petty_cash_plan : « inactif » pour désactiver le rechargement." },
          payee: { type: "string", description: "create_payment_request : bénéficiaire du paiement (à qui l'argent va)." },
          recipient: { type: "string", description: "create_payment_request : interlocuteur Finances (nom, facultatif)." },
          urgency: { type: "string", description: "create_payment_request : urgent | cette semaine | ce mois | quand possible." },
          description: { type: "string", description: "create_payment_request : description du dossier." },
          message: { type: "string", description: "Message (fil du dossier de paiement, réponse au Centre de paiement)." },
          validator: { type: "string", description: "ask_payment_validation : le validateur (nom)." },
          validator2: { type: "string", description: "ask_payment_validation : second validateur (facultatif)." },
          pieces: { type: "string", description: "ask_payment_validation : pièces visées par NOM, séparées par des virgules (défaut : dossier complet)." },
          piece: { type: "string", description: "comment/review_payment_piece : la pièce visée (nom du fichier)." },
          verdict: { type: "string", description: "review_payment_piece : accepter | à revoir | refuser." },
          employee: { type: "string", description: "Paie : nom de l'employé (registre de paie)." },
          month: { type: "string", description: "Paie : mois (« août », « 8 »)." },
          year: { type: "string", description: "Année (défaut : en cours)." },
          gross: { type: "string", description: "Paie : salaire brut DZD." },
          bonuses: { type: "string", description: "create_payroll : primes DZD." },
          deductions: { type: "string", description: "create_payroll : retenues DZD." },
          employerCost: { type: "string", description: "mark_salary_paid : coût employeur DZD (brut + charges patronales — c'est lui qui pèse sur le budget)." },
          net: { type: "string", description: "mark_salary_paid : salaire net DZD (affiché au salarié)." },
          invoiceRef: { type: "string", description: "update_transaction : référence de facture liée." },
          number: { type: "string", description: "update_invoice : numéro de la facture." },
          total: { type: "string", description: "set_budget_total : total annuel DZD (mode fixe)." },
          module: { type: "string", description: "create_budget_category : module rattaché (facultatif)." },
        },
        required: ["op"],
      },
    },
  },
  regulatory_operation: {
    module: "REGULATORY",
    ops: zipOps("regulatory_operation", REGULATORY_OPS_IMPL),
    def: {
      name: "regulatory_operation",
      description:
        "DOSSIERS REGULATORY au-delà des champs simples — création de dossier, participants, commentaires, détail des étapes de la chronologie, checklist de présoumission, variations de fabrication, BV, classement (entité/segments), par les actions canoniques (verrous Super Admin inclus). "
        + `Champ « op » : ${opsSummary("regulatory_operation")}. `
        + "Le dossier se donne par référence REG-AAAA-NNN ou DCI. (Les champs simples — statut, priorité, dates, chargé du dossier, étapes ANPP — ont leurs outils dédiés : update_regulatory_product, assign_regulatory_responsible, set_regulatory_step.)",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("regulatory_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "Référence (REG-AAAA-NNN) ou DCI du dossier visé." },
          dci: { type: "string", description: "create_product : la DCI (obligatoire)." },
          entity: { type: "string", description: "Nom de l'entité (create_product : obligatoire ; set_classification : changement, Super Admin)." },
          people: { type: "string", description: "set_participants : noms séparés par des virgules (liste REMPLACÉE)." },
          comment: { type: "string", description: "add_comment : le commentaire." },
          step: { type: "string", description: "update_step_details : libellé de l'étape (ex. « Dépôt dossier », « Paiement 1er BV »)." },
          status: { type: "string", description: "Statut visé (étape : fait/en cours/bloqué/en retard ; variation : obtenue/en attente/annulée)." },
          item: { type: "string", description: "set_checklist_item : libellé du document de la checklist." },
          checked: { type: "string", description: "set_checklist_item : « décocher » pour retirer (défaut : cocher)." },
          target: { type: "string", description: "create_variation : cible (secondary/primary packaging, full process)." },
          manufacturer: { type: "string", description: "create_variation : fabricant (obligatoire pour une fabrication locale)." },
          amount: { type: "string", description: "request_bv : montant en DZD." },
          bvType: { type: "string", description: "request_bv : BV, BV1, BV2… (défaut BV)." },
          segments: { type: "string", description: "set_classification : segments thérapeutiques séparés par des virgules (liste REMPLACÉE)." },
          brandName: { type: "string", description: "create_product : nom de marque." },
          form: { type: "string", description: "create_product : forme pharmaceutique." },
          dosage: { type: "string", description: "create_product : dosage." },
          partnerLab: { type: "string", description: "create_product : laboratoire partenaire." },
          responsibleName: { type: "string", description: "create_product : chargé du dossier (nom)." },
          targetSubmissionDate: { type: "string", description: "create_product : date cible de dépôt (AAAA-MM-JJ)." },
          plannedDate: { type: "string", description: "update_step_details : date planifiée (AAAA-MM-JJ)." },
          actualDate: { type: "string", description: "update_step_details : date réelle (AAAA-MM-JJ)." },
          missingDocs: { type: "string", description: "update_step_details : pièces manquantes." },
          responsible: { type: "string", description: "update_step_details : responsable de l'étape (texte)." },
          date: { type: "string", description: "Date libre (dépôt de variation, décision…) AAAA-MM-JJ." },
          dueDate: { type: "string", description: "request_bv : échéance (AAAA-MM-JJ)." },
          note: { type: "string", description: "Note libre." },
          notes: { type: "string", description: "create_product : commentaires du dossier." },
        },
        required: ["op"],
      },
    },
  },
  hr_operation: {
    module: "RH",
    ops: zipOps("hr_operation", { ...HR_OPS_IMPL, ...HR2_OPS_IMPL, ...RECRUIT_TRAINING_OPS_IMPL }),
    def: {
      name: "hr_operation",
      description:
        "RH COMPLET — fiche employé (créer, PATCH hors salaire, rémunération dédiée), congés (déposer/corriger/décider, intérimaire), avances, notes de frais, demandes RH du dossier personnel (attestations, absences, entrevues, documents), formations, recrutement — par les actions canoniques (les CHAÎNES de validateurs restent le moteur : si ce n'est pas votre tour, l'exécution refuse en le disant). "
        + `Champ « op » : ${opsSummary("hr_operation")}. `
        + "La cible se donne par NOM D'EMPLOYÉ (« employee »). Les MODIFICATIONS de fiche sont des PATCH : seuls les champs cités changent, le reste est rejoué à l'identique (garde de fraîcheur).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("hr_operation"), description: "Le geste à faire." },
          employee: { type: "string", description: "Nom de l'employé concerné (registre RH)." },
          decision: { type: "string", description: "Décisions : approuver/accorder ou refuser (note de frais : « mois suivant » possible)." },
          status: { type: "string", description: "process_hr_request : en préparation, prête, remise, accordée, refusée ; set_employee_active : actif/inactif." },
          label: { type: "string", description: "decide_training / decide_recruitment_step : intitulé ; documents du dossier : nom du fichier." },
          reference: { type: "string", description: "decide_recruitment_step : référence exacte de la demande." },
          note: { type: "string", description: "Note / motif de la décision." },
          name: { type: "string", description: "create_employee : nom complet ; documents du dossier : nom du fichier." },
          newName: { type: "string", description: "update_employee : nouveau nom complet." },
          position: { type: "string", description: "Poste / fonction." },
          email: { type: "string", description: "E-mail de l'employé." },
          phone: { type: "string", description: "Téléphone." },
          iban: { type: "string", description: "RIB / IBAN." },
          address: { type: "string", description: "Adresse." },
          nationalId: { type: "string", description: "N° pièce d'identité." },
          cnasNumber: { type: "string", description: "N° CNAS." },
          hireDate: { type: "string", description: "Date d'embauche (AAAA-MM-JJ)." },
          birthDate: { type: "string", description: "Date de naissance (AAAA-MM-JJ)." },
          contractType: { type: "string", description: "Contrat : CDI, CDD, intérim, stage, freelance, consulting." },
          contractStart: { type: "string", description: "Début de contrat (AAAA-MM-JJ)." },
          contractEnd: { type: "string", description: "Fin de contrat (AAAA-MM-JJ)." },
          trialStart: { type: "string", description: "Début de période d'essai (AAAA-MM-JJ)." },
          trialEnd: { type: "string", description: "Fin de période d'essai (AAAA-MM-JJ)." },
          leaveBalance: { type: "string", description: "update_employee : solde de congés (jours)." },
          baseSalary: { type: "string", description: "Salaire de base DZD (création ; modification par update_employee_salary)." },
          gross: { type: "string", description: "update_employee_salary : brut DZD." },
          net: { type: "string", description: "update_employee_salary : net à payer DZD." },
          employerCost: { type: "string", description: "update_employee_salary : coût employeur DZD." },
          amount: { type: "string", description: "request_advance : montant DZD." },
          startDate: { type: "string", description: "Congé : début (AAAA-MM-JJ)." },
          endDate: { type: "string", description: "Congé : fin (AAAA-MM-JJ)." },
          days: { type: "string", description: "Congé : nombre de jours (défaut : calculé)." },
          type: { type: "string", description: "Congé : annuel, maladie, sans solde, maternité, exceptionnel, récupération ; demandes RH : type (attestation, note de frais, entrevue…)." },
          reason: { type: "string", description: "Motif (congé, avance)." },
          message: { type: "string", description: "comment_hr_request : le message." },
          date: { type: "string", description: "propose_hr_meeting : date proposée (AAAA-MM-JJ)." },
          time: { type: "string", description: "propose_hr_meeting : heure d'Alger (HH:MM, défaut 09:00)." },
          standIn: { type: "string", description: "propose_stand_in : l'intérimaire (nom) — « aucun » pour retirer." },
          mode: { type: "string", description: "set_employee_document_visibility : « masquer » ; invite_training_participants : « convoquer » (présence requise)." },
          headcount: { type: "string", description: "create_recruitment : nombre de postes (défaut 1)." },
          salaryMin: { type: "string", description: "create_recruitment : bas de fourchette DZD." },
          salaryMax: { type: "string", description: "create_recruitment : haut de fourchette DZD." },
          missions: { type: "string", description: "create_recruitment : missions du poste." },
          skills: { type: "string", description: "create_recruitment : compétences attendues." },
          candidate: { type: "string", description: "Candidat visé (nom) — move_recruitment_candidate." },
          question: { type: "string", description: "ask_recruitment_info : la question au demandeur." },
          answer: { type: "string", description: "answer_recruitment_info : la réponse." },
          provider: { type: "string", description: "Formations : organisme / formateur." },
          location: { type: "string", description: "Formations : lieu." },
          description: { type: "string", description: "Formations : descriptif." },
          people: { type: "string", description: "invite_training_participants : noms séparés par des virgules." },
          newLabel: { type: "string", description: "update_training : nouvel intitulé." },
        },
        required: ["op"],
      },
    },
  },
  meeting_operation: {
    module: "MESSAGING",
    ops: zipOps("meeting_operation", MEETING_OPS_IMPL),
    def: {
      name: "meeting_operation",
      description:
        "RÉUNIONS — planifier (visio ou présentiel, heure d'Alger), répondre à une invitation, inviter des participants, écrire dans le fil, terminer, supprimer — par les actions canoniques (les gestes de gestion sont réservés à l'ORGANISATEUR). "
        + `Champ « op » : ${opsSummary("meeting_operation")}. `
        + "La réunion se donne par TITRE. Pour un simple rendez-vous d'agenda personnel : create_calendar_event.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("meeting_operation"), description: "Le geste à faire." },
          title: { type: "string", description: "Titre de la réunion (création ou cible)." },
          date: { type: "string", description: "create : date (AAAA-MM-JJ)." },
          time: { type: "string", description: "create : heure d'Alger (HH:MM, défaut 09:00)." },
          people: { type: "string", description: "create / add_participants : noms séparés par des virgules." },
          mode: { type: "string", description: "create : « visio » (défaut) ou « présentiel »." },
          location: { type: "string", description: "create : lieu (présentiel)." },
          description: { type: "string", description: "create : ordre du jour." },
          response: { type: "string", description: "respond_invite : accepter, décliner ou peut-être." },
          comment: { type: "string", description: "post_message : le message à poster." },
        },
        required: ["op"],
      },
    },
  },
  mail_operation: {
    module: "MAIL_REGISTER",
    ops: zipOps("mail_operation", { ...MAIL_OPS_IMPL, ...MAIL3_OPS_IMPL }),
    def: {
      name: "mail_operation",
      description:
        "REGISTRE DES COURRIERS — enregistrer un pli (entrant/sortant), corriger, classer dans un dossier, déclarer un fichier Drive en courrier (référence SANS copie), par les actions canoniques (cloisonnement par entité et anti-doublon inclus). "
        + `Champ « op » : ${opsSummary("mail_operation")}. `
        + "La cible se donne par n° de chrono ou par objet.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("mail_operation"), description: "Le geste à faire." },
          label: { type: "string", description: "Objet du courrier (création) ou objet de la cible." },
          reference: { type: "string", description: "N° de chrono de la cible (move_entries : plusieurs, séparés par des virgules)." },
          direction: { type: "string", description: "entrant/arrivée ou sortant/départ." },
          sender: { type: "string", description: "Expéditeur." },
          recipient: { type: "string", description: "Destinataire." },
          folder: { type: "string", description: "move_entries : nom du dossier de classement (« Non classés » pour sortir)." },
          name: { type: "string", description: "attach_drive : nom du fichier Drive à déclarer." },
          newLabel: { type: "string", description: "edit_entry : nouvel objet." },
          newReference: { type: "string", description: "edit_entry : nouveau n° de chrono." },
          notes: { type: "string", description: "Notes." },
          kind: { type: "string", description: "set_date : « reçu le » ou « accusé de réception » ; partenaires : nature." },
          date: { type: "string", description: "set_date : la date (AAAA-MM-JJ) — « aucune » pour l'effacer." },
          parent: { type: "string", description: "create_folder : dossier parent (sous-dossier)." },
          piece: { type: "string", description: "Pièces : libellé de la pièce visée (update/delete_piece)." },
          contact: { type: "string", description: "Partenaires : personne à demander / contact." },
          message: { type: "string", description: "set_signature : la signature (« mode » = retirer pour l'effacer)." },
          mode: { type: "string", description: "update_partner : activer/désactiver ; set_signature : « retirer »." },
        },
        required: ["op"],
      },
    },
  },
  legal_operation: {
    module: "LEGAL",
    ops: zipOps("legal_operation", { ...LEGAL_OPS_IMPL, ...LEGAL3_OPS_IMPL }),
    def: {
      name: "legal_operation",
      description:
        "DOCUMENTS LÉGAUX — renouveler (chaîne), annuler, régler les LECTEURS (le déposant choisit, nul autre ne voit), envoyer une facture au règlement, par les actions canoniques. "
        + `Champ « op » : ${opsSummary("legal_operation")}. `
        + "Le document se donne par titre ou référence. (Créer/modifier un document : create_legal_document / update_legal_document.)",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("legal_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "Titre ou référence du document visé." },
          label: { type: "string", description: "Alias de reference (titre du document)." },
          startDate: { type: "string", description: "renew : début de la nouvelle période (AAAA-MM-JJ)." },
          endDate: { type: "string", description: "renew : fin de la nouvelle période (AAAA-MM-JJ)." },
          people: { type: "string", description: "set_readers : lecteurs, noms séparés par des virgules (liste REMPLACÉE)." },
          note: { type: "string", description: "cancel : motif de l'annulation." },
          notes: { type: "string", description: "renew : notes du nouveau document." },
          name: { type: "string", description: "attach_drive : nom du fichier Drive à déclarer." },
          kind: { type: "string", description: "attach_drive : type (contrat, bon de commande, assurance…)." },
          counterparty: { type: "string", description: "attach_drive : contrepartie." },
          folder: { type: "string", description: "Dossiers Legal : le dossier visé (« aucun » pour déclasser)." },
          newName: { type: "string", description: "rename_folder : nouveau nom." },
          parent: { type: "string", description: "create_folder : dossier parent." },
        },
        required: ["op"],
      },
    },
  },
  org_operation: {
    module: "ADMIN",
    ops: zipOps("org_operation", { ...ORG_OPS_IMPL, ...ACCESS_OPS_IMPL }),
    def: {
      name: "org_operation",
      description:
        "ADMINISTRATION STRUCTURELLE & COMPTES — entités du groupe, départements & organigramme, fournisseurs, annuaire d'entreprise, invitation de compte, matrice d'ACCÈS par module (Super Admin), profil de compte (nom / e-mail de connexion), sessions, setup guidé — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("org_operation")}. `
        + "Les cibles se donnent par NOM (entité, département, employé du registre RH, fournisseur, personne).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("org_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Nom de l'entité / du département / du fournisseur / du contact / de la personne (création ou cible)." },
          employee: { type: "string", description: "assign_department / assign_manager : nom de l'employé (registre RH)." },
          department: { type: "string", description: "assign_department : département de destination (« aucun » pour détacher)." },
          manager: { type: "string", description: "assign_manager : nom du N+1 (« aucun » pour retirer)." },
          parent: { type: "string", description: "create_department : département parent (sous-département)." },
          entity: { type: "string", description: "create_department : entité de rattachement (département de tête)." },
          shortName: { type: "string", description: "create_company : nom court." },
          country: { type: "string", description: "create_supplier : pays." },
          email: { type: "string", description: "create_supplier / create_contact : e-mail ; update_user_profile : NOUVEL e-mail de connexion." },
          kind: { type: "string", description: "create_contact : nature (agence, livreur, imprimeur…)." },
          contactName: { type: "string", description: "create_contact : la personne qu'on demande." },
          phone: { type: "string", description: "create_contact : téléphone." },
          address: { type: "string", description: "create_contact : adresse." },
          notes: { type: "string", description: "Notes." },
          person: { type: "string", description: "Comptes & accès : la personne visée (nom du compte)." },
          module: { type: "string", description: "set_module_access : le module (« Finances », « Drive »…)." },
          mode: { type: "string", description: "set_module_access : « défaut » (du rôle) | « bloqué » | personnalisé (via give/take)." },
          give: { type: "string", description: "set_module_access : droits à DONNER (CREATE, UPDATE, DELETE, VALIDATE, EXPORT, UPLOAD — séparés par des virgules)." },
          take: { type: "string", description: "set_module_access : droits à RETIRER (mêmes valeurs)." },
          scope: { type: "string", description: "set_module_access : portée « tout » ou « assigné »." },
          newName: { type: "string", description: "update_user_profile : nouveau nom du compte." },
          title: { type: "string", description: "update_user_profile : fonction affichée." },
          region: { type: "string", description: "update_user_profile : région." },
        },
        required: ["op"],
      },
    },
  },
  adpro_operation: {
    module: "SPONSORING",
    ops: zipOps("adpro_operation", { ...ADPRO_OPS_IMPL, ...MISSION_OPS_IMPL }),
    def: {
      name: "adpro_operation",
      description:
        "AD & PRO — trancher un poste de dépense (Direction : accordé/refusé/budget à revoir, montant ajustable), transférer une demande entre Sponsoring et Prises en charge, valider/refuser l'étape courante du circuit du matériel promotionnel, par les actions canoniques. "
        + `Champ « op » : ${opsSummary("adpro_operation")}. `
        + "Les cibles se donnent par libellé de poste ou référence (SPO-…, PCN-…, PCI-…, dossier promo).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("adpro_operation"), description: "Le geste à faire." },
          label: { type: "string", description: "decide_item / circuit promo : libellé du poste ou titre du dossier." },
          reference: { type: "string", description: "transfer / circuit promo : référence exacte de la demande ou du dossier." },
          decision: { type: "string", description: "decide_item : accorder, refuser, ou budget à revoir." },
          amount: { type: "string", description: "decide_item : montant accordé en DZD (défaut : l'estimation)." },
          to: { type: "string", description: "transfer : module de destination (sponsoring / prise en charge nationale / internationale)." },
          note: { type: "string", description: "Motif / note (obligatoire pour refuser une étape promo)." },
          target: { type: "string", description: "Missions : l'événement / congrès / sponsoring visé (nom ou référence)." },
          kind: { type: "string", description: "Missions : type de la cible (événement | sponsoring | congrès international | congrès national)." },
          person: { type: "string", description: "Missions : la personne assignée (nom)." },
          role: { type: "string", description: "assign_mission : accompagnant (défaut) ou délégué de référence." },
          message: { type: "string", description: "comment_mission : le message." },
        },
        required: ["op"],
      },
    },
  },
  medical_info_operation: {
    module: "MEDICAL_INFO",
    ops: zipOps("medical_info_operation", MEDINFO_OPS_IMPL),
    def: {
      name: "medical_info_operation",
      description:
        "INFORMATION MÉDICALE — déclarations aux autorités de santé : demander/annuler une pièce, consigner la référence de l'autorité, valider (pharmacien puis Direction), messages — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("medical_info_operation")}. `
        + "La déclaration se donne par référence ou libellé.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("medical_info_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "Référence ou libellé de la déclaration visée." },
          label: { type: "string", description: "Alias de reference." },
          piece: { type: "string", description: "La pièce demandée (libellé)." },
          person: { type: "string", description: "request_declaration_document : à qui demander (nom)." },
          authorityRef: { type: "string", description: "record_authority_declaration : la référence donnée par l'autorité." },
          message: { type: "string", description: "comment_declaration : le message." },
          note: { type: "string", description: "Note / commentaire (validation Direction)." },
          notes: { type: "string", description: "record_authority_declaration : notes de l'autorité." },
        },
        required: ["op"],
      },
    },
  },
  bd_operation: {
    module: "BUSINESS_DEVELOPMENT",
    ops: zipOps("bd_operation", BD_OPS_IMPL),
    def: {
      name: "bd_operation",
      description:
        "PIPELINE BUSINESS DEVELOPMENT — créer une opportunité et faire avancer son stade (idée → recherche → contacté → NDA → offre reçue → négociation → validée / abandonnée), par les actions canoniques. "
        + `Champ « op » : ${opsSummary("bd_operation")}.`,
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("bd_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Nom de l'opportunité (création ou cible)." },
          status: { type: "string", description: "update_status : le stade visé." },
          dci: { type: "string", description: "create : DCI du produit." },
          therapeuticClass: { type: "string", description: "create : classe thérapeutique." },
        },
        required: ["op", "name"],
      },
    },
  },
  stock_operation: {
    module: "STOCKS",
    ops: zipOps("stock_operation", STOCK_OPS_IMPL),
    def: {
      name: "stock_operation",
      description:
        "STOCKS PCH — demander un état de stock à une personne (hôpitaux ciblés en option, validés dans les lieux de stock) : une DEMANDE DE TÂCHE part par le circuit normal. "
        + `Champ « op » : ${opsSummary("stock_operation")}.`,
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("stock_operation"), description: "Le geste à faire." },
          assigneeName: { type: "string", description: "À qui demander l'état de stock." },
          hospitals: { type: "string", description: "Hôpitaux ciblés, séparés par des virgules (optionnel)." },
          note: { type: "string", description: "Précision de la demande." },
        },
        required: ["op", "assigneeName"],
      },
    },
  },
};

export const DOMAIN_TOOL_DEFS: ClaudeToolDef[] = Object.values(DOMAIN_TOOLS).map((t) => t.def);
