import type { StateMachine } from "./types";

/**
 * Déclarations des machines à états des objets métier majeurs (§29), calquées sur les enums
 * Prisma et les circuits réellement codés (workflow Ad & Pro, ordres de dépense, validations,
 * congrès, événements, congés). Les points d'entrée multiples reflètent le **routage intelligent**
 * (un chef de produit / la Direction sautent des étapes → l'objet peut naître déjà avancé).
 */
export const STATE_MACHINES: StateMachine[] = [
  {
    id: "expenseOrder",
    label: "Ordre de dépense",
    module: "FINANCES",
    model: "expenseOrder",
    statusField: "status",
    states: ["PENDING", "REVISION_REQUESTED", "PAID", "CANCELLED"],
    initial: ["PENDING"],
    terminal: ["PAID", "CANCELLED"],
    transitions: [
      ["PENDING", "REVISION_REQUESTED"], ["PENDING", "PAID"], ["PENDING", "CANCELLED"],
      ["REVISION_REQUESTED", "PENDING"], ["REVISION_REQUESTED", "PAID"], ["REVISION_REQUESTED", "CANCELLED"],
    ],
  },
  {
    id: "validationRequest",
    label: "Demande de validation",
    module: "VALIDATIONS",
    model: "validationRequest",
    statusField: "status",
    states: ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED", "CANCELLED"],
    initial: ["PENDING"],
    terminal: ["APPROVED", "REJECTED", "CANCELLED"],
    transitions: [
      ["PENDING", "APPROVED"], ["PENDING", "REJECTED"], ["PENDING", "CHANGES_REQUESTED"], ["PENDING", "CANCELLED"],
      ["CHANGES_REQUESTED", "PENDING"], ["CHANGES_REQUESTED", "APPROVED"], ["CHANGES_REQUESTED", "REJECTED"], ["CHANGES_REQUESTED", "CANCELLED"],
    ],
    coupling: {
      field: "decidedAt",
      expect: "PENDING ⟹ decidedAt absent ; APPROVED/REJECTED ⟹ decidedAt présent.",
      holds: (r) => {
        const s = r.status, decided = r.decidedAt != null;
        if (s === "PENDING") return !decided;
        if (s === "APPROVED" || s === "REJECTED") return decided;
        return true;
      },
    },
  },
  {
    id: "workflowInstance",
    label: "Instance de workflow",
    module: "ADMIN",
    model: "workflowInstance",
    statusField: "status",
    states: ["IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"],
    initial: ["IN_PROGRESS"],
    terminal: ["APPROVED", "REJECTED", "CANCELLED"],
    transitions: [["IN_PROGRESS", "APPROVED"], ["IN_PROGRESS", "REJECTED"], ["IN_PROGRESS", "CANCELLED"]],
    coupling: {
      field: "currentSlug",
      expect: "IN_PROGRESS ⟺ une étape courante existe ; état terminal ⟹ plus d'étape courante.",
      holds: (r) => (r.status === "IN_PROGRESS" ? r.currentSlug != null : r.currentSlug == null),
    },
  },
  // Le champ `status` des congrès porte l'enum CongressStatus (cycle d'organisation). Le circuit
  // d'approbation (préliminaire → chef de produit → définitive) est suivi à part (WorkflowInstance).
  ...(["congressInternational", "congressNational"] as const).map((model) => ({
    id: model,
    label: model === "congressInternational" ? "Congrès international" : "Congrès national",
    module: "SPONSORING",
    model,
    statusField: "status",
    states: ["CONSIDERED", "VALIDATED", "ORGANIZED", "COMPLETED", "CANCELLED"],
    initial: ["CONSIDERED"],
    terminal: ["COMPLETED", "CANCELLED"],
    transitions: [
      ["CONSIDERED", "VALIDATED"], ["CONSIDERED", "CANCELLED"],
      ["VALIDATED", "ORGANIZED"], ["VALIDATED", "COMPLETED"], ["VALIDATED", "CANCELLED"],
      ["ORGANIZED", "COMPLETED"], ["ORGANIZED", "CANCELLED"],
    ] as [string, string][],
  })),
  {
    id: "event",
    label: "Événement national",
    module: "EVENTS",
    model: "event",
    statusField: "status",
    states: ["DRAFT", "AWAITING_VALIDATION", "VALIDATED", "PREPARATION", "REGISTRATION_OPEN", "FULL", "COMPLETED", "CANCELLED"],
    initial: ["DRAFT"],
    terminal: ["COMPLETED", "CANCELLED"],
    transitions: [
      ["DRAFT", "AWAITING_VALIDATION"], ["DRAFT", "CANCELLED"],
      ["AWAITING_VALIDATION", "VALIDATED"], ["AWAITING_VALIDATION", "DRAFT"], ["AWAITING_VALIDATION", "CANCELLED"],
      ["VALIDATED", "PREPARATION"], ["VALIDATED", "CANCELLED"],
      ["PREPARATION", "REGISTRATION_OPEN"], ["PREPARATION", "COMPLETED"], ["PREPARATION", "CANCELLED"],
      ["REGISTRATION_OPEN", "FULL"], ["REGISTRATION_OPEN", "COMPLETED"], ["REGISTRATION_OPEN", "CANCELLED"],
      ["FULL", "REGISTRATION_OPEN"], ["FULL", "COMPLETED"], ["FULL", "CANCELLED"],
    ],
  },
  {
    id: "leaveRequest",
    label: "Demande de congé",
    module: "RH",
    model: "leaveRequest",
    statusField: "status",
    states: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    initial: ["PENDING"],
    terminal: ["REJECTED", "CANCELLED"], // APPROVED peut encore être annulé
    transitions: [
      ["PENDING", "APPROVED"], ["PENDING", "REJECTED"], ["PENDING", "CANCELLED"],
      ["APPROVED", "CANCELLED"],
    ],
  },
];
