import type { Module } from "@/lib/rbac";
import type { ClaudeToolDef } from "@/lib/ai";
import { OPS_BY_TOOL, type OpMeta } from "./catalog";
import type { OpImpl } from "./types";
import { DRIVE_OPS_IMPL } from "./impl-drive";
import { TASK_OPS_IMPL } from "./impl-task";
import { FINANCE_OPS_IMPL } from "./impl-finance";
import { REGULATORY_OPS_IMPL } from "./impl-regulatory";
import { HR_OPS_IMPL } from "./impl-hr";
import { MEETING_OPS_IMPL } from "./impl-meeting";
import { MAIL_OPS_IMPL } from "./impl-mail";
import { LEGAL_OPS_IMPL } from "./impl-legal";
import { ORG_OPS_IMPL } from "./impl-org";

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
    ops: zipOps("drive_operation", DRIVE_OPS_IMPL),
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
        },
        required: ["op", "name"],
      },
    },
  },
  task_operation: {
    module: "WORKSPACE",
    ops: zipOps("task_operation", TASK_OPS_IMPL),
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
        },
        required: ["op", "title"],
      },
    },
  },
  finance_operation: {
    module: "FINANCES",
    ops: zipOps("finance_operation", FINANCE_OPS_IMPL),
    def: {
      name: "finance_operation",
      description:
        "ÉCRITURES FINANCES & BUDGETS — livre comptable, règlements d'ordres de dépense, factures, rallonges de caisse, budgets de département, par les actions canoniques (verrou du Centre de paiement et facture obligatoire INCLUS). "
        + `Champ « op » : ${opsSummary("finance_operation")}. `
        + "Montants en DZD. Les cibles se donnent par référence (FIN-…, OD-…) ou libellé ; les rallonges/budgets par nom de département.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("finance_operation"), description: "Le geste à faire." },
          label: { type: "string", description: "Libellé (création) ou libellé/titre de la cible (résolution)." },
          reference: { type: "string", description: "Référence exacte de la cible (FIN-…, OD-…, n° de facture)." },
          amount: { type: "string", description: "Montant en DZD (ex. « 1500000 » ou « 1 500 000,50 »)." },
          direction: { type: "string", description: "create_transaction/create_invoice : encaissement/décaissement, reçue/émise." },
          category: { type: "string", description: "create_transaction : catégorie (loyer, salaires, fournisseurs, impôts…)." },
          status: { type: "string", description: "Statut visé (prévu / réalisé / annulé ; payée / impayée)." },
          method: { type: "string", description: "create_transaction : espèces, virement, chèque, carte." },
          counterparty: { type: "string", description: "Contrepartie / client / destinataire." },
          date: { type: "string", description: "Date (AAAA-MM-JJ)." },
          dueDate: { type: "string", description: "Échéance (AAAA-MM-JJ)." },
          department: { type: "string", description: "decide_petty_topup / decide_department_budget : nom du département." },
          decision: { type: "string", description: "Décisions : accorder/approuver ou refuser." },
          account: { type: "string", description: "set_opening_balance : nom du compte de trésorerie." },
          note: { type: "string", description: "Note / motif de décision." },
          notes: { type: "string", description: "Notes libres de l'écriture." },
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
    ops: zipOps("hr_operation", HR_OPS_IMPL),
    def: {
      name: "hr_operation",
      description:
        "DÉCISIONS RH & fiche employé — congés, avances, notes de frais, demandes RH (attestations…), formations, recrutement, fiche active/inactive, par les actions canoniques (les CHAÎNES de validateurs restent le moteur : si ce n'est pas votre tour, l'exécution refuse en le disant). "
        + `Champ « op » : ${opsSummary("hr_operation")}. `
        + "La cible se donne par NOM D'EMPLOYÉ (« employee ») — ou par intitulé/référence pour formations et recrutements.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("hr_operation"), description: "Le geste à faire." },
          employee: { type: "string", description: "Nom de l'employé concerné (registre RH)." },
          decision: { type: "string", description: "Décisions : approuver/accorder ou refuser (note de frais : « mois suivant » possible)." },
          status: { type: "string", description: "process_hr_request : en préparation, prête, remise, accordée, refusée ; set_employee_active : actif/inactif." },
          label: { type: "string", description: "decide_training / decide_recruitment_step : intitulé de la formation ou poste du recrutement." },
          reference: { type: "string", description: "decide_recruitment_step : référence exacte de la demande." },
          note: { type: "string", description: "Note / motif de la décision." },
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
    ops: zipOps("mail_operation", MAIL_OPS_IMPL),
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
        },
        required: ["op"],
      },
    },
  },
  legal_operation: {
    module: "LEGAL",
    ops: zipOps("legal_operation", LEGAL_OPS_IMPL),
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
        },
        required: ["op"],
      },
    },
  },
  org_operation: {
    module: "ADMIN",
    ops: zipOps("org_operation", ORG_OPS_IMPL),
    def: {
      name: "org_operation",
      description:
        "ADMINISTRATION STRUCTURELLE — entités du groupe (créer, activer/désactiver), départements & organigramme (créer, rattacher un employé, désigner le N+1), fournisseurs du portail, annuaire d'entreprise, par les actions canoniques. "
        + `Champ « op » : ${opsSummary("org_operation")}. `
        + "Les cibles se donnent par NOM (entité, département, employé du registre RH, fournisseur).",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("org_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Nom de l'entité / du département / du fournisseur / du contact (création ou cible)." },
          employee: { type: "string", description: "assign_department / assign_manager : nom de l'employé (registre RH)." },
          department: { type: "string", description: "assign_department : département de destination (« aucun » pour détacher)." },
          manager: { type: "string", description: "assign_manager : nom du N+1 (« aucun » pour retirer)." },
          parent: { type: "string", description: "create_department : département parent (sous-département)." },
          entity: { type: "string", description: "create_department : entité de rattachement (département de tête)." },
          shortName: { type: "string", description: "create_company : nom court." },
          country: { type: "string", description: "create_supplier : pays." },
          email: { type: "string", description: "create_supplier / create_contact : e-mail." },
          kind: { type: "string", description: "create_contact : nature (agence, livreur, imprimeur…)." },
          contactName: { type: "string", description: "create_contact : la personne qu'on demande." },
          phone: { type: "string", description: "create_contact : téléphone." },
          address: { type: "string", description: "create_contact : adresse." },
          notes: { type: "string", description: "Notes." },
        },
        required: ["op"],
      },
    },
  },
};

export const DOMAIN_TOOL_DEFS: ClaudeToolDef[] = Object.values(DOMAIN_TOOLS).map((t) => t.def);
