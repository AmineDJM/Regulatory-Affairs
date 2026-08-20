/**
 * LA DEMANDE DE RECRUTEMENT — de l'idée d'un directeur jusqu'à l'arrivée de la personne.
 *
 * Recruter n'est pas une demande de plus : c'est un engagement pluriannuel qui n'appartient à
 * personne seul. D'où un circuit long, et volontairement long :
 *
 *   ①  Un DIRECTEUR DE DÉPARTEMENT formule le besoin — poste, missions, compétences, type de
 *      contrat, fourchette de rémunération, dates. Rien de tout cela n'est du remplissage : c'est
 *      ce que les validateurs vont peser, et ce que les RH publieront.
 *   ②  Sa HIÉRARCHIE valide, marche par marche, du N+1 jusqu'au PDG. Chaque marche voit ce qu'ont
 *      dit les précédentes. Un seul refus arrête tout : inutile de faire monter au PDG ce que le
 *      N+1 a déjà écarté, et cruel de laisser espérer deux étapes de plus.
 *   ③  Les RH reçoivent la demande. Ils peuvent DEMANDER DES PRÉCISIONS (compétences,
 *      rémunération, tâches, dates, type de contrat) autant de fois qu'il le faut — la demande
 *      revient alors au demandeur, puis repart aux RH. Ce va-et-vient est le cœur du travail RH,
 *      pas une exception.
 *   ④  Une fois les RH d'accord, le poste est OUVERT : les RH déposent les CV reçus, le DEMANDEUR
 *      présélectionne (c'est lui qui sait ce que le poste exige), et le PDG tranche — parmi les
 *      présélectionnés OU en dehors, car le dernier mot n'est pas une case à cocher.
 *   ⑤  Entretiens, décision, puis INTÉGRATION : fiche employé et compte applicatif — SAUF pour un
 *      consulting, qui reste un intervenant EXTERNE et n'entre ni dans l'effectif ni dans la paie.
 *
 * Deux choix de conception qui expliquent tout le reste :
 *
 *   • le PIPELINE DES CANDIDATS vit sur les CANDIDATS, pas sur la demande. Plusieurs personnes
 *     avancent en parallèle, à des vitesses différentes : l'une passe un entretien pendant qu'une
 *     autre vient d'arriver. Une demande qui porterait un seul état « en entretien » ne saurait
 *     pas dire de qui elle parle ;
 *   • la CHAÎNE de validation est DYNAMIQUE. Elle n'a pas trois marches comme les congés : elle
 *     en a autant que l'organigramme en compte entre le demandeur et le sommet. On la calcule à
 *     la soumission et on la fige — sans quoi une réorganisation en cours de route changerait les
 *     validateurs d'une demande déjà partie.
 *
 * Module PUR — testé, sans base de données (`formatCurrency` ne fait que mettre en forme).
 */

import { formatCurrency } from "@/lib/utils";

// ───────────────────────────── Type de contrat ─────────────────────────────

/**
 * Les contrats qu'on peut demander. Sous-ensemble volontaire de `ContractType` : on ne recrute
 * pas quelqu'un en « Autre », et l'intérim se traite par une autre voie.
 */
export const RECRUITMENT_CONTRACTS = ["CDI", "CDD", "CONSULTING", "STAGE"] as const;
export type RecruitmentContract = (typeof RECRUITMENT_CONTRACTS)[number];

export const CONTRACT_LABEL: Record<RecruitmentContract, string> = {
  CDI: "CDI",
  CDD: "CDD",
  CONSULTING: "Consulting",
  STAGE: "Stage",
};

export function isRecruitmentContract(v: string): v is RecruitmentContract {
  return (RECRUITMENT_CONTRACTS as readonly string[]).includes(v);
}

/**
 * Ce contrat exige-t-il une date de FIN ?
 *
 * Un CDD, un stage ou une mission de consulting sans terme n'existent pas — c'est le terme qui
 * les définit. Un CDI, à l'inverse, ne doit surtout pas en porter : une date de fin sur un CDI
 * serait relue, un jour, comme une échéance.
 */
export function contractNeedsEndDate(type: RecruitmentContract): boolean {
  return type !== "CDI";
}

/**
 * Ce contrat fait-il entrer la personne DANS L'EFFECTIF ?
 *
 * Non pour le consulting : un consultant est un intervenant externe. Lui créer une fiche employé
 * et un compte de salarié le ferait apparaître dans la masse salariale, dans les congés et dans
 * l'organigramme — trois endroits où il n'a rien à faire, et trois faux chiffres.
 */
export function needsOnboarding(type: RecruitmentContract): boolean {
  return type !== "CONSULTING";
}

// ───────────────────────────── Étapes de la demande ─────────────────────────────

export type RecruitmentStage =
  | "CHAIN"          // validation hiérarchique en cours (N+1 → … → PDG)
  | "HR_REVIEW"      // arrivée aux RH : « Demandes de recrutements »
  | "INFO_REQUESTED" // les RH ont demandé des précisions ; la balle est au demandeur
  | "SOURCING"       // poste ouvert : CV reçus, présélection, sélection, entretiens
  | "ONBOARDING"     // quelqu'un est retenu ; reste à l'intégrer
  | "CLOSED"         // terminé — pourvu, ou clos sans suite
  | "REJECTED"       // refusé, dans la chaîne ou par les RH
  | "CANCELLED";     // retiré par son auteur

export const STAGE_LABEL: Record<RecruitmentStage, string> = {
  CHAIN: "Validation hiérarchique",
  HR_REVIEW: "Chez les ressources humaines",
  INFO_REQUESTED: "Précisions demandées",
  SOURCING: "Recrutement ouvert",
  ONBOARDING: "Intégration",
  CLOSED: "Clôturée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const STAGE_TONE: Record<RecruitmentStage, Tone> = {
  CHAIN: "warning",
  HR_REVIEW: "warning",
  INFO_REQUESTED: "danger",
  SOURCING: "info",
  ONBOARDING: "info",
  CLOSED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/** Une demande close ne bouge plus — aucune action, quel qu'en soit l'auteur. */
export function isFinal(stage: RecruitmentStage): boolean {
  return stage === "CLOSED" || stage === "REJECTED" || stage === "CANCELLED";
}

// ───────────────────────────── Chaîne de validation ─────────────────────────────

export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface ChainStep {
  order: number;
  approverId: string;
  approverName?: string;
  status: ApprovalState;
}

/**
 * La marche ACTIVE : la première encore en attente.
 *
 * On ne se fie pas à un compteur stocké à côté. Un compteur et une liste finissent toujours par
 * diverger — il suffit d'une décision enregistrée sans que le compteur suive — et l'on se
 * retrouve alors avec une demande que plus personne ne peut valider.
 */
export function currentStep(steps: readonly ChainStep[]): ChainStep | null {
  return [...steps].sort((a, b) => a.order - b.order).find((s) => s.status === "PENDING") ?? null;
}

export interface ChainDecider {
  userId: string;
  /** Le PDG / Super Admin : il peut trancher à n'importe quelle marche. */
  isTop: boolean;
}

/**
 * Cette personne peut-elle valider MAINTENANT ?
 *
 * Le PDG passe à toute marche, et ce n'est pas un privilège de confort : sans lui, une demande
 * resterait bloquée pendant l'absence d'un N+2 — exactement la période où elles s'accumulent.
 * Le refus, lui, doit DIRE pourquoi : « non autorisé » n'apprend à personne quoi faire ensuite.
 */
export function canDecideStep(
  stage: RecruitmentStage,
  steps: readonly ChainStep[],
  decider: ChainDecider,
): { ok: boolean; reason?: string } {
  if (stage !== "CHAIN") return { ok: false, reason: "La validation hiérarchique est terminée." };
  const step = currentStep(steps);
  if (!step) return { ok: false, reason: "Plus aucune marche en attente." };
  if (step.approverId === decider.userId || decider.isTop) return { ok: true };
  return { ok: false, reason: `En attente de ${step.approverName || "la marche précédente"}.` };
}

export interface ChainOutcome {
  /** L'étape de la demande APRÈS la décision. */
  stage: RecruitmentStage;
  /** La chaîne est-elle allée jusqu'au bout ? */
  complete: boolean;
}

/**
 * L'état après une décision sur la marche active.
 *
 * Approuver fait monter d'une marche ; la dernière franchie envoie la demande aux RH. Refuser
 * clôt tout, à n'importe quelle marche.
 *
 * Quand c'est le PDG qui approuve depuis une marche intermédiaire, les marches d'en dessous sont
 * SAUTÉES et non approuvées en son nom : le journal doit dire qu'elles n'ont pas été
 * consultées — écrire qu'un N+1 a validé alors qu'il n'a rien vu serait un faux.
 */
export function applyChainDecision(
  steps: readonly ChainStep[],
  decidedOrder: number,
  decision: "APPROVED" | "REJECTED",
): { steps: ChainStep[]; outcome: ChainOutcome } {
  const next = [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      if (s.order === decidedOrder) return { ...s, status: decision as ApprovalState };
      if (s.order < decidedOrder && s.status === "PENDING") return { ...s, status: "SKIPPED" as ApprovalState };
      return { ...s };
    });
  if (decision === "REJECTED") return { steps: next, outcome: { stage: "REJECTED", complete: false } };
  const remaining = next.some((s) => s.status === "PENDING");
  return {
    steps: next,
    outcome: remaining ? { stage: "CHAIN", complete: false } : { stage: "HR_REVIEW", complete: true },
  };
}

/** Où en est la chaîne, dit en clair : « 2 / 4 — en attente de Karim Saïdi ». */
export function chainProgress(steps: readonly ChainStep[]): { done: number; total: number; waitingOn: string | null } {
  const total = steps.length;
  const done = steps.filter((s) => s.status !== "PENDING").length;
  const step = currentStep(steps);
  return { done, total, waitingOn: step ? (step.approverName || null) : null };
}

// ───────────────────────────── Les candidats ─────────────────────────────

export type CandidateStatus =
  | "RECEIVED"     // CV déposé par les RH
  | "SHORTLISTED"  // présélectionné par le demandeur
  | "SELECTED"     // retenu par le PDG (parmi les présélectionnés OU en dehors)
  | "INTERVIEWED"  // entretien passé
  | "HIRED"        // retenu — reste l'intégration
  | "DECLINED";    // écarté, à n'importe quel moment

export const CANDIDATE_LABEL: Record<CandidateStatus, string> = {
  RECEIVED: "CV reçu",
  SHORTLISTED: "Présélectionné",
  SELECTED: "Retenu par la direction",
  INTERVIEWED: "Entretien passé",
  HIRED: "Recruté",
  DECLINED: "Écarté",
};

export const CANDIDATE_TONE: Record<CandidateStatus, Tone> = {
  RECEIVED: "neutral",
  SHORTLISTED: "info",
  SELECTED: "warning",
  INTERVIEWED: "info",
  HIRED: "success",
  DECLINED: "danger",
};

/** Ordre d'avancement — sert à trier la liste et à savoir si un statut recule. */
const CANDIDATE_ORDER: Record<CandidateStatus, number> = {
  RECEIVED: 0, SHORTLISTED: 1, SELECTED: 2, INTERVIEWED: 3, HIRED: 4, DECLINED: 5,
};

export function candidateRank(s: CandidateStatus): number {
  return CANDIDATE_ORDER[s] ?? 0;
}

export interface RecruitmentActor {
  userId: string;
  /** L'auteur de la demande — c'est lui qui présélectionne. */
  isRequester: boolean;
  /** Porte la fonction RH (droit d'écrire dans le module RH). */
  isHr: boolean;
  /** PDG / Super Admin — le dernier mot. */
  isTop: boolean;
}

/**
 * Ce que cette personne peut faire, à cette étape.
 *
 * Une seule fonction plutôt qu'une garde par bouton : l'écran et le serveur posent alors
 * exactement la même question, et un bouton visible correspond toujours à une action permise.
 */
export interface RecruitmentAbilities {
  /** Demander des précisions (RH), tant que la demande est chez eux. */
  askInfo: boolean;
  /** Répondre aux précisions (le demandeur). */
  answerInfo: boolean;
  /** Ouvrir le poste : les RH valident et passent au sourcing. */
  openSourcing: boolean;
  /** Refuser la demande (RH), après examen. */
  hrReject: boolean;
  /** Déposer un CV reçu. */
  addCandidate: boolean;
  /** Présélectionner — le demandeur, parce que c'est lui qui sait ce que le poste exige. */
  shortlist: boolean;
  /** Retenir un candidat — le PDG, présélectionné ou non. */
  select: boolean;
  /** Consigner un entretien. */
  interview: boolean;
  /** Prononcer le recrutement. */
  hire: boolean;
  /** Créer la fiche employé et le compte (RH), une fois quelqu'un recruté. */
  onboard: boolean;
  /** Retirer sa demande — tant que la hiérarchie n'a pas commencé à trancher. */
  cancel: boolean;
}

export function abilities(
  stage: RecruitmentStage,
  actor: RecruitmentActor,
  opts: { chainUntouched?: boolean; hasHire?: boolean } = {},
): RecruitmentAbilities {
  const none: RecruitmentAbilities = {
    askInfo: false, answerInfo: false, openSourcing: false, hrReject: false,
    addCandidate: false, shortlist: false, select: false, interview: false,
    hire: false, onboard: false, cancel: false,
  };
  if (isFinal(stage)) return none;

  const hr = actor.isHr || actor.isTop;
  const sourcing = stage === "SOURCING";
  return {
    askInfo: hr && stage === "HR_REVIEW",
    answerInfo: stage === "INFO_REQUESTED" && (actor.isRequester || actor.isTop),
    openSourcing: hr && stage === "HR_REVIEW",
    hrReject: hr && (stage === "HR_REVIEW" || stage === "INFO_REQUESTED"),
    addCandidate: hr && sourcing,
    // Le demandeur présélectionne. Les RH ne le font pas à sa place : ils n'ont pas le poste en
    // tête, et une présélection faite par défaut ne serait qu'une file d'attente déguisée.
    shortlist: sourcing && (actor.isRequester || actor.isTop),
    select: sourcing && actor.isTop,
    interview: sourcing && (hr || actor.isRequester),
    hire: sourcing && actor.isTop,
    onboard: hr && stage === "ONBOARDING" && (opts.hasHire ?? true),
    // On retire sa demande tant que personne n'a tranché ; après, elle appartient au circuit et
    // l'effacer ferait disparaître une décision déjà prise.
    cancel: stage === "CHAIN" && (opts.chainUntouched ?? false) && (actor.isRequester || actor.isTop),
  };
}

/**
 * Le PDG peut-il retenir CE candidat ?
 *
 * Oui, présélectionné ou non — « le PDG sélectionne parmi les présélectionnés ou les autres ».
 * Restreindre aux présélectionnés ferait de la présélection un filtre opposable au dernier
 * décideur, ce qu'elle n'est pas : c'est un avis, pas un tri éliminatoire.
 */
export function canSelectCandidate(status: CandidateStatus): boolean {
  return status === "RECEIVED" || status === "SHORTLISTED";
}

// ───────────────────────────── Saisie du besoin ─────────────────────────────

export interface RequestDraft {
  position: string;
  headcount: number;
  contractType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
}

/**
 * Ce qui EMPÊCHE de soumettre — et rien d'autre.
 *
 * On ne bloque que ce qui rendrait la demande impossible à instruire. Les missions, les
 * compétences et la fiche de poste restent facultatives : les RH ont justement le droit de
 * demander des précisions, et refuser l'enregistrement d'un besoin réel parce qu'une case est
 * vide, c'est le renvoyer vers un e-mail où plus personne ne le suivra.
 */
export function validateDraft(d: RequestDraft): string | null {
  if (!d.position.trim()) return "L'intitulé du poste est obligatoire.";
  if (!Number.isFinite(d.headcount) || d.headcount < 1) return "Le nombre de postes doit être d'au moins 1.";
  if (!isRecruitmentContract(d.contractType)) return "Choisissez un type de contrat.";

  const min = d.salaryMin, max = d.salaryMax;
  if (min != null && min < 0) return "La rémunération ne peut pas être négative.";
  if (max != null && max < 0) return "La rémunération ne peut pas être négative.";
  if (min != null && max != null && min > max) {
    return "La fourchette est inversée : le minimum dépasse le maximum.";
  }

  const start = toDate(d.startDate);
  const end = toDate(d.endDate);
  if (contractNeedsEndDate(d.contractType)) {
    if (!end) return `Un ${CONTRACT_LABEL[d.contractType]} a un terme : la date de fin est obligatoire.`;
  } else if (end) {
    // Une date de fin sur un CDI serait relue un jour comme une échéance.
    return "Un CDI n'a pas de date de fin.";
  }
  if (start && end && end < start) return "La date de fin précède la date de début.";
  return null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « CDI · 1 poste · 80 000 – 110 000 DZD » — la ligne qu'on lit dans une liste. */
export function summarize(d: {
  contractType: string; headcount: number; salaryMin: number | null; salaryMax: number | null;
}): string {
  const parts: string[] = [];
  if (isRecruitmentContract(d.contractType)) parts.push(CONTRACT_LABEL[d.contractType]);
  parts.push(`${d.headcount} poste${d.headcount > 1 ? "s" : ""}`);
  const range = salaryRange(d.salaryMin, d.salaryMax);
  if (range) parts.push(range);
  return parts.join(" · ");
}

/**
 * La fourchette, écrite comme on la dit.
 *
 * `null` quand rien n'est renseigné : afficher « 0 DZD » laisserait croire à un poste non
 * rémunéré. Une seule borne s'écrit « à partir de » ou « jusqu'à » — pas « 0 – 90 000 ».
 */
export function salaryRange(min: number | null, max: number | null): string | null {
  // Le formateur COMMUN de la plateforme, pas un second : deux écritures de la monnaie côte à
  // côte sur le même écran (« 80 000 DZD » ici, « 80 000,00 DA » ailleurs) se remarquent.
  const fmt = (n: number) => formatCurrency(n);
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `à partir de ${fmt(min)}`;
  if (max != null) return `jusqu'à ${fmt(max)}`;
  return null;
}
