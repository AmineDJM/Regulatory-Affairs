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
import { REG4_OPS_IMPL, PCH_OPS_IMPL, STOCK4_OPS_IMPL, SALES_OPS_IMPL, LOGISTICS_OPS_IMPL } from "./impl-wave4";
import { MEDICAL_OPS_IMPL, RANGE_OPS_IMPL, BD4_OPS_IMPL } from "./impl-wave4b";
import { EVENT_OPS_IMPL, ADPRO5_OPS_IMPL, CONSULTING_OPS_IMPL } from "./impl-wave5";
import { CARE_OPS_IMPL, PROMO_OPS_IMPL } from "./impl-wave5b";
import { BD6_OPS_IMPL, DOSSIER_OPS_IMPL, DIRECTIVE_OPS_IMPL, SUPPORT_OPS_IMPL, REMINDER_OPS_IMPL } from "./impl-wave6";

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
    ops: zipOps("task_operation", { ...TASK_OPS_IMPL, ...DOCREQ_OPS_IMPL, ...REMINDER_OPS_IMPL }),
    def: {
      name: "task_operation",
      description:
        "MES TÂCHES & MES RAPPELS — répondre à une demande de tâche et faire avancer les siennes, et les RAPPELS personnels de Mon espace (poser un rappel daté, le terminer, le reporter — défaut +1 jour —, l'annuler), par les actions canoniques de l'écran (notifications au demandeur, audit). "
        + `Champ « op » : ${opsSummary("task_operation")}. `
        + "La tâche se donne par INTITULÉ (« title ») — seules les tâches où le geste est réellement possible sont proposées. Le rappel se donne par son objet (« label »). "
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
          label: { type: "string", description: "Demandes de pièces : la pièce visée (« Devis signé »…) ; rappels : l'objet du rappel." },
          target: { type: "string", description: "request_document : l'entité de rattachement (nom d'événement / congrès / sponsoring) — OBLIGATOIRE." },
          kind: { type: "string", description: "request_document : type de l'entité (événement | sponsoring | congrès international | congrès national)." },
          dueDate: { type: "string", description: "request_document : échéance (AAAA-MM-JJ)." },
          date: { type: "string", description: "Rappels : la date du rappel (AAAA-MM-JJ, ou AAAA-MM-JJTHH:MM) — snooze : défaut +1 jour." },
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
    ops: zipOps("regulatory_operation", { ...REGULATORY_OPS_IMPL, ...REG4_OPS_IMPL }),
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
          step: { type: "string", description: "update_step_details / set_step_note : libellé OU numéro (1–22) de l'étape (ex. « Dépôt du dossier », « 5 »)." },
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
          note: { type: "string", description: "Note libre (set_step_note : « aucune » pour l'effacer)." },
          notes: { type: "string", description: "create_product / create_supplier : commentaires." },
          name: { type: "string", description: "create_supplier : nom du fournisseur ; link/unlink_catalog_product : produit du catalogue (DCI BD ou nom promo)." },
          country: { type: "string", description: "create_supplier : pays." },
          contact: { type: "string", description: "create_supplier : e-mail de contact." },
          kind: { type: "string", description: "link/unlink_catalog_product : catalogue visé (BD ou promotion) si le nom est ambigu." },
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
    ops: zipOps("org_operation", { ...ORG_OPS_IMPL, ...ACCESS_OPS_IMPL, ...RANGE_OPS_IMPL }),
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
          newName: { type: "string", description: "update_user_profile / update_range : nouveau nom." },
          title: { type: "string", description: "update_user_profile : fonction affichée." },
          region: { type: "string", description: "update_user_profile : région." },
          range: { type: "string", description: "Gammes : la gamme visée (create/update/delete_range, set_products_range, set_user_ranges — plusieurs séparées par des virgules ; « aucune » détache/sort)." },
          products: { type: "string", description: "set_products_range / remove_product_from_range : produits (références REG-… ou DCI, virgules)." },
          color: { type: "string", description: "Gammes : couleur." },
        },
        required: ["op"],
      },
    },
  },
  adpro_operation: {
    module: "SPONSORING",
    ops: zipOps("adpro_operation", { ...ADPRO_OPS_IMPL, ...MISSION_OPS_IMPL, ...ADPRO5_OPS_IMPL }),
    def: {
      name: "adpro_operation",
      description:
        "AD & PRO — LES CIRCUITS COMPLETS : sponsoring (préliminaire National Sales → analyse chef de produit → décision Direction → appel), congrès / événements (mêmes marches + budget accordé modifiable + personnes prises en charge), POSTES de dépense (ajout, soumission, décision, imputation budgétaire, BC visé puis émis), demandes « autres », correction de fiche par liste blanche, missions, matériel promo (étapes), par les actions canoniques. "
        + `Champ « op » : ${opsSummary("adpro_operation")}. `
        + "Le sponsoring se donne par SPO-… ou institution ; le congrès / événement par « target » (+ « kind » si ambigu) ; le poste par « label » dans son opération.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("adpro_operation"), description: "Le geste à faire." },
          label: { type: "string", description: "Postes / circuit promo : libellé du poste ou titre du dossier ; demandes « autres » : l'objet." },
          reference: { type: "string", description: "Référence exacte (SPO-…, AUT-…, dossier promo) — ou alias de « target »." },
          decision: { type: "string", description: "Décisions : approuver / accorder / valider, refuser, budget à revoir (decide_item)." },
          amount: { type: "string", description: "Montants DZD : budget proposé (analyse), budget accordé (décision finale), estimation (add_item), montant demandé (correct_request)." },
          grantedAmount: { type: "string", description: "update_item : montant AFFECTÉ par la Direction." },
          to: { type: "string", description: "transfer : module de destination (sponsoring / prise en charge nationale / internationale)." },
          note: { type: "string", description: "Motif / note (obligatoire pour les refus)." },
          target: { type: "string", description: "La cible : événement / congrès / sponsoring (nom ou référence)." },
          kind: { type: "string", description: "Type de la cible (événement | sponsoring | congrès international | congrès national) — tranche l'ambiguïté." },
          person: { type: "string", description: "La personne : chef de produit désigné, tierce personne, personne prise en charge, bénéficiaire d'une demande « autre »." },
          role: { type: "string", description: "Missions : accompagnant / délégué de référence ; personnes prises en charge : rôle libre." },
          message: { type: "string", description: "comment_mission : le message ; create_other_request : alias de notes." },
          mode: { type: "string", description: "add_item : « rallonge » si le poste est EN PLUS du budget accordé ; close_other_request : « annuler »." },
          category: { type: "string", description: "set_item_budget : la (sous-)catégorie budgétaire (nom ; « aucune » retire)." },
          material: { type: "string", description: "link_item_promo_material : le matériel promo (MP-… ou titre ; « aucun » détache)." },
          supplier: { type: "string", description: "add_item / update_item : le prestataire pressenti." },
          notes: { type: "string", description: "Notes / description (create_other_request : OBLIGATOIRE ; correct_request : description)." },
          city: { type: "string", description: "correct_request : ville." },
          specialty: { type: "string", description: "correct_request : spécialité." },
          products: { type: "string", description: "correct_request : produits." },
          startDate: { type: "string", description: "correct_request : date de début (AAAA-MM-JJ)." },
          endDate: { type: "string", description: "correct_request : date de fin (AAAA-MM-JJ)." },
        },
        required: ["op"],
      },
    },
  },
  event_operation: {
    module: "EVENTS",
    ops: zipOps("event_operation", EVENT_OPS_IMPL),
    def: {
      name: "event_operation",
      description:
        "EVENTS — la fiche d'un événement (modification en rejouant TOUT l'existant, suppression), sa soumission au circuit de prise en charge, et ses INSCRIPTIONS (ajout, statut présent/confirmé/annulé, retrait), par les actions canoniques. "
        + `Champ « op » : ${opsSummary("event_operation")}. `
        + "L'événement se donne par NOM (« target »), le participant par son nom (« person »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("event_operation"), description: "Le geste à faire." },
          target: { type: "string", description: "L'événement visé (nom)." },
          newName: { type: "string", description: "update_event : nouveau nom." },
          eventType: { type: "string", description: "update_event : congrès, séminaire, table ronde, staff hospitalier, symposium, webinaire, formation, journée scientifique, autre." },
          scope: { type: "string", description: "update_event : national / international." },
          format: { type: "string", description: "update_event : présentiel / webinaire / hybride." },
          status: { type: "string", description: "Événement : brouillon, en attente de validation, validé, en préparation, inscriptions ouvertes, complet, terminé, annulé. Participant : inscrit, confirmé, liste d'attente, refusé, présent, absent, annulé." },
          startDate: { type: "string", description: "update_event : date de début (AAAA-MM-JJ)." },
          endDate: { type: "string", description: "update_event : date de fin (AAAA-MM-JJ)." },
          location: { type: "string", description: "update_event : lieu." },
          city: { type: "string", description: "Ville." },
          country: { type: "string", description: "Pays." },
          specialty: { type: "string", description: "Spécialité (événement ou participant)." },
          institution: { type: "string", description: "add_registration : établissement du participant." },
          products: { type: "string", description: "update_event : produits présentés." },
          quantity: { type: "string", description: "update_event : capacité (places)." },
          amount: { type: "string", description: "update_event : budget estimé (DZD)." },
          person: { type: "string", description: "Participant (prénom + nom) — ou chef de produit pour submit_event_for_approval." },
          role: { type: "string", description: "add_registration : médecin, professeur, chef de service, pharmacien, autre." },
          email: { type: "string", description: "add_registration : e-mail." },
          phone: { type: "string", description: "add_registration : téléphone." },
          notes: { type: "string", description: "Description / commentaire." },
        },
        required: ["op", "target"],
      },
    },
  },
  consulting_operation: {
    module: "CONSULTING",
    ops: zipOps("consulting_operation", CONSULTING_OPS_IMPL),
    def: {
      name: "consulting_operation",
      description:
        "CONSULTING — le contrat entre deux parties : création (tâches attendues comprises), soumission au validateur désigné, validation (contrat ACTIF) ou refus, clôture / rupture, et les tâches attendues du prestataire (ajout, livrée, retrait), par les actions canoniques. "
        + `Champ « op » : ${opsSummary("consulting_operation")}. `
        + "Le contrat se donne par référence CONS-…, intitulé ou consultant.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("consulting_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "Le contrat visé (CONS-…, intitulé ou consultant)." },
          label: { type: "string", description: "create_contract : intitulé ; tâches : la tâche visée / à créer." },
          counterparty: { type: "string", description: "create_contract : le consultant ou cabinet (OBLIGATOIRE)." },
          person: { type: "string", description: "submit_contract : le validateur désigné (nom)." },
          decision: { type: "string", description: "decide_contract : valider ou refuser ; close_contract : « rompre » pour une rupture en cours de contrat." },
          amount: { type: "string", description: "create_contract : montant (DZD)." },
          startDate: { type: "string", description: "create_contract : début (AAAA-MM-JJ)." },
          endDate: { type: "string", description: "create_contract : fin (AAAA-MM-JJ)." },
          dueDate: { type: "string", description: "add_contract_task : échéance de la tâche (AAAA-MM-JJ)." },
          tasks: { type: "string", description: "create_contract : tâches attendues, séparées par des virgules." },
          paymentTerms: { type: "string", description: "create_contract : modalités de paiement." },
          note: { type: "string", description: "Décision / clôture : note ou motif." },
          notes: { type: "string", description: "create_contract : périmètre de la mission." },
        },
        required: ["op"],
      },
    },
  },
  care_operation: {
    module: "CONGRESS_NATIONAL",
    ops: zipOps("care_operation", CARE_OPS_IMPL),
    def: {
      name: "care_operation",
      description:
        "PRISES EN CHARGE d'un congrès (national ou international) — personnes (annuaire ou profil libre), avis du demandeur, DÉCISION PAR PERSONNE (Direction), besoins par personne (pièces / prestations et leurs états), devis qui couvrent N cases (garde anti double paiement), sollicitation des devis, envoi aux Finances bloqué tant qu'il manque quelque chose, rattachement d'une case au matériel promo — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("care_operation")}. `
        + "Le congrès se donne par NOM (« target », « kind » national / international si ambigu), la personne par son nom (« person »), l'élément par son libellé (« label »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("care_operation"), description: "Le geste à faire." },
          target: { type: "string", description: "Le congrès visé (nom)." },
          kind: { type: "string", description: "Congrès national / congrès international (si le nom seul est ambigu)." },
          person: { type: "string", description: "La personne prise en charge (praticien de l'annuaire ou nom libre)." },
          label: { type: "string", description: "L'élément visé (pièce / prestation) — create_care_quote : les libellés couverts (virgules)." },
          cells: { type: "string", description: "create_care_quote : synonyme de « label » (libellés couverts, virgules)." },
          decision: { type: "string", description: "Avis : favorable / défavorable / pas d'avis. Personne : accorder / écarter. Devis : accepter / refuser." },
          supplier: { type: "string", description: "Devis : le fournisseur." },
          amount: { type: "string", description: "create_care_quote : montant du devis (DZD)." },
          reference: { type: "string", description: "create_care_quote : référence du devis." },
          status: { type: "string", description: "set_care_cell_status : demandée / reçue / réglée / sans objet." },
          serviceKind: { type: "string", description: "add_care_cell : hôtel, transport, billet, restauration, inscription, matériel promotionnel, autre." },
          mode: { type: "string", description: "add_care_cell : « prestation » force une prestation (sinon : pièce à fournir)." },
          role: { type: "string", description: "add_care_person : fonction (« Professeur », « Chef de service »…)." },
          institution: { type: "string", description: "add_care_person : établissement." },
          material: { type: "string", description: "link_care_promo : le matériel promotionnel (MP-… ou titre ; « aucun » détache)." },
          note: { type: "string", description: "Note / justification." },
          notes: { type: "string", description: "add_care_cell : précisions sur l'élément." },
        },
        required: ["op", "target"],
      },
    },
  },
  promo_operation: {
    module: "PROMO_MATERIAL",
    ops: zipOps("promo_operation", PROMO_OPS_IMPL),
    def: {
      name: "promo_operation",
      description:
        "MATÉRIEL PROMOTIONNEL — le CIRCUIT COURT (lancement à N+1 figé, devis reçu sur pièce exigée, chantiers parallèles BC / paiement / visa), les marches du circuit long (devis déposés, agence retenue, BC aux Finances puis validé puis envoyé, bordereau de paiement, paiement, matériel réalisé, examen Direction, conformité + visa, BAT, livraison, facture, règlement-clôture), commentaires, annulation, et le STOCK à MOUVEMENTS (articles, entrées / distributions / pertes / corrections — jamais un champ quantité) — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("promo_operation")}. `
        + "Le dossier se donne par référence MP-… ou titre (« reference ») ; l'article de stock par son nom (« name »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("promo_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "Le dossier visé (MP-… ou titre)." },
          label: { type: "string", description: "Synonyme de « reference » (ou de « name » pour le stock)." },
          supplier: { type: "string", description: "choose_promo_agency : l'agence retenue." },
          name: { type: "string", description: "Stock : l'article visé / à créer." },
          newName: { type: "string", description: "update_stock_item : nouveau nom de l'article." },
          amount: { type: "string", description: "Montant (DZD) — agence retenue, règlement final." },
          quantity: { type: "string", description: "Stock : quantité (mouvement, ou stock initial à la création)." },
          threshold: { type: "string", description: "Stock : seuil d'alerte." },
          unit: { type: "string", description: "Stock : unité (boîte, pièce…)." },
          location: { type: "string", description: "Stock : emplacement." },
          person: { type: "string", description: "record_stock_movement : destinataire de la distribution." },
          date: { type: "string", description: "Mouvement de stock : date (AAAA-MM-JJ)." },
          mode: { type: "string", description: "start_promo_circuit : « devis en main » saute la demande ; record_stock_movement : entrée / distribution / perte / correction." },
          track: { type: "string", description: "complete_promo_track : bon de commande / demande de paiement / visa publicitaire." },
          message: { type: "string", description: "comment_promo : le commentaire ; confirm_promo_conformity : référence de l'autorité." },
          note: { type: "string", description: "Commentaire d'étape / n° de BC / référence du visa / motif du mouvement." },
          notes: { type: "string", description: "Stock : notes de la fiche article." },
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
    ops: zipOps("bd_operation", { ...BD_OPS_IMPL, ...BD4_OPS_IMPL, ...BD6_OPS_IMPL }),
    def: {
      name: "bd_operation",
      description:
        "BUSINESS DEVELOPMENT — pipeline d'opportunités (stades idée → validée / abandonnée), études de marché (lignes-molécules, acteurs, pré-remplissage, présentations IA), ET le TABLEAU STRATÉGIQUE projets → gammes → produits (fiches en FUSION, cellule par liste blanche via set_bd_cell, suppressions en cascade comptées, commentaires) — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("bd_operation")}. `
        + "L'étude se donne par TITRE (« research »), la ligne par sa molécule (« row »), l'acteur par son nom (« player ») ; le projet du tableau par NOM (« target »), la gamme par « range », le produit par « product » (DCI ou marque).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("bd_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Pipeline : nom de l'opportunité (création ou cible)." },
          status: { type: "string", description: "update_status : le stade ; update_research : brouillon / finale." },
          dci: { type: "string", description: "create : DCI du produit." },
          therapeuticClass: { type: "string", description: "create / update_research_row : classe thérapeutique." },
          research: { type: "string", description: "Études : le TITRE de l'étude visée (ou à créer)." },
          row: { type: "string", description: "Études : la ligne visée (molécule / produit)." },
          player: { type: "string", description: "Études : l'acteur visé (laboratoire)." },
          molecules: { type: "string", description: "create_research : molécules initiales, séparées par des virgules." },
          people: { type: "string", description: "set_research_participants : noms, virgules (liste REMPLACÉE ; « aucun » vide)." },
          newName: { type: "string", description: "Nouveau titre / nom (étude, ligne, acteur, présentation)." },
          quantity: { type: "string", description: "update_research_row : volume marché (unités)." },
          amount: { type: "string", description: "update_research_row : valeur marché USD ; update_research_player : part de marché." },
          price: { type: "string", description: "update_research_row : prix moyen par boîte (USD)." },
          mode: { type: "string", description: "update_research_player / produit BD (sourcing) : importation, fabrication locale, à étudier." },
          presentation: { type: "string", description: "Présentations : le titre visé (ou à donner à la nouvelle)." },
          notes: { type: "string", description: "Notes / consigne IA (generate/regenerate_presentation : l'instruction) ; tableau : description du projet." },
          sources: { type: "string", description: "update_research : sources de l'étude." },
          target: { type: "string", description: "Tableau stratégique : le PROJET visé (nom)." },
          range: { type: "string", description: "Tableau : la gamme visée (nom)." },
          product: { type: "string", description: "Tableau : le produit visé (DCI ou nom de marque)." },
          field: { type: "string", description: "set_bd_cell : la cellule (Nom, Statut, DCI, Dosage, Taille de marché DZD, Prix unitaire, Concurrents, Investissement A1…)." },
          value: { type: "string", description: "set_bd_cell : la nouvelle valeur (vide pour effacer)." },
          kind: { type: "string", description: "set_bd_cell : projet ou produit." },
          dosage: { type: "string", description: "Produit BD : dosage." },
          form: { type: "string", description: "Produit BD : forme galénique." },
          label: { type: "string", description: "Produit BD : nom de marque." },
          note: { type: "string", description: "Commentaire (projet, gamme, produit)." },
          message: { type: "string", description: "comment_bd_project : le commentaire à poser." },
        },
        required: ["op"],
      },
    },
  },
  dossier_operation: {
    module: "DOSSIERS",
    ops: zipOps("dossier_operation", DOSSIER_OPS_IMPL),
    def: {
      name: "dossier_operation",
      description:
        "PROJETS DE SUIVI — statut (ouvert → terminé / archivé), équipe (responsable + participants REJOUÉS en FUSION, « aucun » vide), fil « Suivi & discussion » (messages, mentions de MEMBRES, modification / suppression par extrait), e-mail journalisé dans le fil (projet existant ou créé à la volée), ouverture d'un projet depuis une tâche — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("dossier_operation")}. `
        + "Le projet se donne par référence ou intitulé (« target ») ; un message du fil par un extrait (« message », ou « dernier »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("dossier_operation"), description: "Le geste à faire." },
          target: { type: "string", description: "Le projet visé (référence ou intitulé)." },
          status: { type: "string", description: "set_dossier_status : ouvert, en cours, en attente, terminé, archivé." },
          person: { type: "string", description: "assign_dossier : le responsable (nom ; « aucun » retire)." },
          people: { type: "string", description: "assign_dossier : participants (noms, virgules — liste REMPLACÉE, absents rejoués, « aucun » vide) ; post_dossier_message : mentions." },
          message: { type: "string", description: "Le message à poster — ou l'EXTRAIT qui désigne un message existant (edit/delete ; « dernier » accepté)." },
          note: { type: "string", description: "edit_dossier_message : le NOUVEAU texte." },
          name: { type: "string", description: "link_email_to_dossier : intitulé du projet à CRÉER (si « target » absent)." },
          label: { type: "string", description: "link_email_to_dossier : l'OBJET de l'e-mail ; create_dossier_from_task : le titre de la tâche." },
          date: { type: "string", description: "link_email_to_dossier : date de réception (AAAA-MM-JJ)." },
        },
        required: ["op"],
      },
    },
  },
  directive_operation: {
    module: "DIRECTIVES",
    ops: zipOps("directive_operation", DIRECTIVE_OPS_IMPL),
    def: {
      name: "directive_operation",
      description:
        "DIRECTIVES de la Direction — émission référencée DIR- vers UNE personne ou UN rôle (priorité, échéance), avancement (prise en compte horodatée, terminée, ARCHIVAGE réservé à la Direction), fil émetteur ↔ destinataire — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("directive_operation")}. `
        + "La directive se donne par référence DIR-… ou titre (« target »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("directive_operation"), description: "Le geste à faire." },
          target: { type: "string", description: "La directive visée (DIR-… ou titre)." },
          label: { type: "string", description: "create_directive : le titre." },
          message: { type: "string", description: "Le contenu de la directive, ou le message à poster sur le fil." },
          person: { type: "string", description: "create_directive : destinataire nommé (prime sur le rôle)." },
          role: { type: "string", description: "create_directive : rôle destinataire (« Délégués médicaux », « National Sales »…)." },
          status: { type: "string", description: "set_directive_status : ouverte, prise en compte, en cours, terminée, archivée." },
          priority: { type: "string", description: "create_directive : basse, moyenne, haute, critique." },
          date: { type: "string", description: "create_directive : échéance (AAAA-MM-JJ)." },
        },
        required: ["op"],
      },
    },
  },
  support_operation: {
    module: "SUPPORT",
    ops: zipOps("support_operation", SUPPORT_OPS_IMPL),
    def: {
      name: "support_operation",
      description:
        "SUPPORT interne — demandes SUP- (question, support promotionnel, brochure, document) vers UNE personne ou UN rôle, prise en charge par le destinataire, fil de réponse (la réponse d'un destinataire passe la demande « répondue »), statut avec clôture ouverte au demandeur — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("support_operation")}. `
        + "La demande se donne par référence SUP-… ou objet (« target »).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("support_operation"), description: "Le geste à faire." },
          target: { type: "string", description: "La demande visée (SUP-… ou objet)." },
          label: { type: "string", description: "create_support_request : l'objet." },
          message: { type: "string", description: "Le message / la réponse." },
          person: { type: "string", description: "create_support_request : destinataire nommé (prime sur le rôle)." },
          role: { type: "string", description: "create_support_request : rôle destinataire." },
          kind: { type: "string", description: "create_support_request : question, support promotionnel, brochure, document, autre." },
          product: { type: "string", description: "create_support_request : produit concerné." },
          status: { type: "string", description: "set_support_status : ouverte, en cours, répondue, clôturée." },
        },
        required: ["op"],
      },
    },
  },
  medical_operation: {
    module: "MEDICAL",
    ops: zipOps("medical_operation", MEDICAL_OPS_IMPL),
    def: {
      name: "medical_operation",
      description:
        "ANNUAIRE MÉDICAL — praticiens (fiche complète ou cellule de la feuille, suppressions bornées par la portée), visites (planification et compte rendu champ-par-champ), établissements, spécialités, annuaires nommés (rangement + accès désignés), plans de tournée — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("medical_operation")}. `
        + "Le praticien se donne par NOM (« doctor »), la visite par praticien + date, le plan par délégué + date de début.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("medical_operation"), description: "Le geste à faire." },
          doctor: { type: "string", description: "Le praticien visé (nom) — plusieurs noms séparés par des virgules pour les gestes en lot." },
          newName: { type: "string", description: "update_doctor / update_directory : nouveau nom." },
          title: { type: "string", description: "Grade : professeur, maître de conférences, maître assistant, praticien spécialiste, assistant, résident, généraliste, pharmacien, autre." },
          specialty: { type: "string", description: "Spécialité (texte, ou cible des ops de spécialité)." },
          sector: { type: "string", description: "Secteur : hospitalier, libéral, les deux." },
          institution: { type: "string", description: "Établissement (texte, ou cible de delete_institution)." },
          city: { type: "string", description: "Ville." },
          region: { type: "string", description: "Wilaya / région (fiche, plan de tournée)." },
          phone: { type: "string", description: "Téléphone." },
          email: { type: "string", description: "E-mail." },
          influence: { type: "string", description: "Influence : très élevé / élevé / moyen / faible / très faible." },
          potential: { type: "string", description: "Potentiel (mêmes niveaux)." },
          affinity: { type: "string", description: "Affinité (mêmes niveaux)." },
          person: { type: "string", description: "Le délégué (visite, fiche, plan de tournée)." },
          people: { type: "string", description: "set_directory_access : noms, virgules (« tous » = ouvrir)." },
          field: { type: "string", description: "set_doctor_cell : la colonne (lastName, firstName, address, city, wilaya, postalCode, phone, email, title, sector, specialty, potential)." },
          value: { type: "string", description: "set_doctor_cell : la valeur (vide = effacer)." },
          lastName: { type: "string", description: "add_doctor_row : nom." },
          firstName: { type: "string", description: "add_doctor_row : prénom." },
          date: { type: "string", description: "Visites / plans : la date (AAAA-MM-JJ)." },
          newDate: { type: "string", description: "duplicate_plan : début de la nouvelle période (défaut : mois suivant)." },
          status: { type: "string", description: "update_visit : planifiée / réalisée / annulée / reportée." },
          report: { type: "string", description: "update_visit : compte rendu." },
          feedback: { type: "string", description: "update_visit : retour du médecin." },
          followUp: { type: "string", description: "update_visit : actions de suivi." },
          products: { type: "string", description: "Produits (cibles de la fiche, présentés en visite, cible du plan)." },
          quantity: { type: "string", description: "create/update_plan : visites cibles." },
          keyTargets: { type: "string", description: "create/update_plan : médecins clés cibles." },
          achieved: { type: "string", description: "update_plan : visites réalisées." },
          directory: { type: "string", description: "Annuaires nommés : l'annuaire visé (« général » pour en sortir)." },
          color: { type: "string", description: "Spécialités : couleur." },
          notes: { type: "string", description: "Notes / objectif / description / commentaire manager." },
        },
        required: ["op"],
      },
    },
  },
  stock_operation: {
    module: "STOCKS",
    ops: zipOps("stock_operation", { ...STOCK_OPS_IMPL, ...STOCK4_OPS_IMPL }),
    def: {
      name: "stock_operation",
      description:
        "STOCKS PCH — demander un état de stock à une personne, gérer les LIEUX (hôpitaux / annexes PCH, Super Admin) et enregistrer les ÉTATS DATÉS (« à cette date il reste X unités »), par les actions canoniques. "
        + `Champ « op » : ${opsSummary("stock_operation")}.`,
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("stock_operation"), description: "Le geste à faire." },
          assigneeName: { type: "string", description: "request_state : à qui demander l'état de stock." },
          hospitals: { type: "string", description: "request_state : hôpitaux ciblés, séparés par des virgules (optionnel)." },
          note: { type: "string", description: "Précision de la demande." },
          location: { type: "string", description: "Nom de l'hôpital / annexe visé(e) (création, suppression, état)." },
          product: { type: "string", description: "États : le produit (DCI ou nom commercial)." },
          kind: { type: "string", description: "record_snapshot : lieu de l'état — PCH (défaut), hôpital, ou annexe." },
          date: { type: "string", description: "États : la date de la mesure (AAAA-MM-JJ)." },
          quantity: { type: "string", description: "record_snapshot : quantité restante (unités, ≥ 0)." },
        },
        required: ["op"],
      },
    },
  },
  pch_operation: {
    module: "PCH",
    ops: zipOps("pch_operation", PCH_OPS_IMPL),
    def: {
      name: "pch_operation",
      description:
        "PCH — MARCHÉS : appels d'offres (fiche, caution rejouée), bons de commande, lignes-produits (statut Gagné/Perdu, prix), analyse IA d'un TEXTE d'AO collé, enrichissement par l'intelligence marché, suivi d'arrivée — par les actions canoniques. "
        + `Champ « op » : ${opsSummary("pch_operation")}. `
        + "Le marché se donne par référence AO-AAAA-NNN, titre ou produits ; la ligne par sa désignation ; le bon de commande par son n°.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("pch_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "L'appel d'offres visé (AO-AAAA-NNN, titre ou produits)." },
          name: { type: "string", description: "create_tender : titre du marché." },
          products: { type: "string", description: "Produits concernés (texte)." },
          supplier: { type: "string", description: "Fournisseur." },
          country: { type: "string", description: "Pays du fournisseur." },
          quantity: { type: "string", description: "Quantité (marché / bon / ligne / vente depuis ligne)." },
          amount: { type: "string", description: "Valeur en DZD (marché, bon) ou prix unitaire (ligne)." },
          status: { type: "string", description: "Statut : marché (non commencé/en cours/terminé/annulé), bon (en attente/validé/livré/payé/annulé), ligne (en attente/chiffré/soumis/gagné/perdu)." },
          date: { type: "string", description: "Date (attribution du marché, réception du bon, arrivée prévue) AAAA-MM-JJ." },
          order: { type: "string", description: "Le bon de commande visé (n° ou produits) — ou le n° à donner à un nouveau bon." },
          line: { type: "string", description: "La ligne-produit visée (désignation ou DCI)." },
          newName: { type: "string", description: "update_order / update_line : nouveau n° / nouvelle désignation." },
          dci: { type: "string", description: "update_line : DCI." },
          dosage: { type: "string", description: "update_line : dosage." },
          form: { type: "string", description: "update_line : forme galénique." },
          awardedPrice: { type: "string", description: "update_line : prix unitaire ATTRIBUÉ (DZD)." },
          paymentDate: { type: "string", description: "update_order : date de paiement (AAAA-MM-JJ)." },
          arrivedDate: { type: "string", description: "set_order_arrival : date d'arrivée RÉELLE (AAAA-MM-JJ)." },
          text: { type: "string", description: "analyze_tender_text : le texte du document d'AO, collé." },
          notes: { type: "string", description: "Notes libres." },
        },
        required: ["op"],
      },
    },
  },
  sales_operation: {
    module: "SALES",
    ops: zipOps("sales_operation", SALES_OPS_IMPL),
    def: {
      name: "sales_operation",
      description:
        "VENTES — enregistrer une vente réelle (produit ou service, quantité × prix DZD) ou importer un CSV COLLÉ de ventes, par les actions canoniques. "
        + `Champ « op » : ${opsSummary("sales_operation")}.`,
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("sales_operation"), description: "Le geste à faire." },
          product: { type: "string", description: "create_sale : le produit (ou l'intitulé du service)." },
          client: { type: "string", description: "create_sale : le client (obligatoire)." },
          quantity: { type: "string", description: "create_sale : quantité vendue." },
          amount: { type: "string", description: "create_sale : prix unitaire en DZD." },
          date: { type: "string", description: "create_sale : date de la vente (AAAA-MM-JJ, défaut aujourd'hui)." },
          kind: { type: "string", description: "create_sale : « service » si ce n'est pas un produit." },
          dci: { type: "string", description: "create_sale : DCI du produit." },
          dosage: { type: "string", description: "create_sale : dosage." },
          institution: { type: "string", description: "create_sale : établissement du client." },
          isPch: { type: "string", description: "create_sale : « oui » si vente PCH." },
          csv: { type: "string", description: "import_sales : le CSV collé (en-tête : date,produit,dci,dosage,forme,client,institution,pch,quantité,prix unitaire)." },
        },
        required: ["op"],
      },
    },
  },
  logistics_operation: {
    module: "LOGISTICS",
    ops: zipOps("logistics_operation", LOGISTICS_OPS_IMPL),
    def: {
      name: "logistics_operation",
      description:
        "LOGISTIQUE — créer une commande d'acheminement (fournisseur → PCH) et faire avancer son suivi (expédié, terminal, dédouanement, livré) en datant les jalons, par les actions canoniques. "
        + `Champ « op » : ${opsSummary("logistics_operation")}. `
        + "La commande se donne par référence CMD-AAAA-NNN ou produit.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("logistics_operation"), description: "Le geste à faire." },
          reference: { type: "string", description: "update_shipment_status : la commande (CMD-AAAA-NNN ou produit)." },
          product: { type: "string", description: "create_shipment : le produit commandé (obligatoire)." },
          dci: { type: "string", description: "create_shipment : DCI." },
          dosage: { type: "string", description: "create_shipment : dosage." },
          supplier: { type: "string", description: "create_shipment : fournisseur." },
          country: { type: "string", description: "create_shipment : pays d'origine." },
          quantity: { type: "string", description: "Quantité commandée / reçue." },
          amount: { type: "string", description: "create_shipment : valeur de la commande." },
          currency: { type: "string", description: "create_shipment : devise (défaut EUR)." },
          status: { type: "string", description: "Statut : commandé, production, expédié, arrivé au terminal, dédouanement, livré, bloqué." },
          date: { type: "string", description: "create_shipment : date de commande (AAAA-MM-JJ)." },
          departureDate: { type: "string", description: "Départ (estimé à la création ; réel au suivi) AAAA-MM-JJ." },
          arrivalDate: { type: "string", description: "Arrivée (estimée à la création ; réelle au suivi) AAAA-MM-JJ." },
          customsDate: { type: "string", description: "update_shipment_status : date de dédouanement." },
          deliveryDate: { type: "string", description: "update_shipment_status : date de livraison à la PCH." },
          carrier: { type: "string", description: "create_shipment : transporteur." },
          incoterm: { type: "string", description: "create_shipment : incoterm (CIF, FOB…)." },
        },
        required: ["op"],
      },
    },
  },
};

export const DOMAIN_TOOL_DEFS: ClaudeToolDef[] = Object.values(DOMAIN_TOOLS).map((t) => t.def);
