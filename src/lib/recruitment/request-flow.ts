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
  | "CANCELLED"      // retiré par son auteur
  | "RETURNED";      // renvoyé pour correction : la balle est au demandeur (§118.192)

export const STAGE_LABEL: Record<RecruitmentStage, string> = {
  CHAIN: "Validation hiérarchique",
  HR_REVIEW: "Chez les ressources humaines",
  INFO_REQUESTED: "Précisions demandées",
  SOURCING: "Recrutement ouvert",
  ONBOARDING: "Intégration",
  CLOSED: "Clôturée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
  RETURNED: "À corriger",
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
  RETURNED: "warning",
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
  // Renvoyée, la demande n'est pas « terminée » : elle est chez son demandeur, et elle reviendra.
  if (stage === "RETURNED") return { ok: false, reason: "La demande est chez son demandeur, pour correction : elle vous reviendra corrigée." };
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

// ───────────────────────────── Jusqu'au DG, et ce qu'il décide (Direction, 07/10) ─────────────────────────────

/**
 * QUI COMPTE COMME « LE SOMMET » QUAND IL FAUT EN AJOUTER UN — dans cet ordre : le DG d'abord (c'est lui que la
 * Direction nomme), puis la Direction, puis le Super Admin. Les mêmes rôles que `isTopManagement` (rbac.ts).
 */
export const ORDRE_DU_SOMMET = ["GENERAL_MANAGER", "DIRECTION", "SUPER_ADMIN"] as const;

export interface Maillon {
  approverId: string;
  name: string;
  /** Ce validateur est-il le sommet (`isTopManagement`) ? */
  isTop: boolean;
}

/**
 * LA CHAÎNE MONTE JUSQU'AU DG — pour tout demandeur (« ça part au N+1 et ça remonte jusqu'au DG / Super Admin »).
 *
 * L'organigramme s'arrête parfois avant : une fiche sans N+1, une branche dont le sommet est un directeur. La
 * demande partait alors aux RH sans que la direction l'ait vue. Si aucun maillon n'est le sommet, on ajoute le
 * premier SOMMET disponible (`sommets`, déjà dans l'ordre `ORDRE_DU_SOMMET`) — jamais le demandeur lui-même, jamais
 * un validateur déjà présent. Une chaîne qui contient déjà le sommet ne bouge pas : il y est à sa vraie place.
 */
export function completerJusquAuSommet(
  chaine: readonly Maillon[],
  sommets: readonly { id: string; name: string }[],
  demandeurId: string,
): { approverId: string; name: string }[] {
  const out = chaine.map((m) => ({ approverId: m.approverId, name: m.name }));
  if (chaine.some((m) => m.isTop)) return out;
  const deja = new Set([demandeurId, ...chaine.map((m) => m.approverId)]);
  const sommet = sommets.find((s) => !deja.has(s.id));
  return sommet ? [...out, { approverId: sommet.id, name: sommet.name }] : out;
}

/**
 * LA MARCHE QUE TRANCHE CETTE PERSONNE — la sienne si elle en a une en attente ; sinon, pour le sommet, la
 * DERNIÈRE (les marches d'en dessous passent « non consultées ») ; sinon la marche active. Lue par l'écran et
 * par l'action : le formulaire qui exige le N+1 et le suivi est celui que l'action exigera.
 */
export function cibleDeLaDecision(steps: readonly ChainStep[], decider: ChainDecider): ChainStep | null {
  const triees = [...steps].sort((a, b) => a.order - b.order);
  const own = triees.find((s) => s.approverId === decider.userId && s.status === "PENDING");
  return own ?? (decider.isTop ? triees[triees.length - 1] ?? null : currentStep(triees));
}

/**
 * LE DG QUI CONCLUT LA CHAÎNE DÉCIDE DU N+1 DE LA FUTURE RECRUE ET DE QUI SUIT LE RECRUTEMENT (Direction, 07/10).
 *
 * Vrai quand celui qui VALIDE est le sommet et que sa validation fait passer la demande aux RH. Le N+1 qui valide
 * une marche intermédiaire n'a rien à désigner : ce n'est pas lui qui engage l'entreprise.
 */
export function decisionDuSommetExigeSuivi(stage: RecruitmentStage, steps: readonly ChainStep[], decider: ChainDecider): boolean {
  if (!decider.isTop || stage !== "CHAIN") return false;
  const cible = cibleDeLaDecision(steps, decider);
  if (!cible || cible.status !== "PENDING") return false;
  return applyChainDecision(steps, cible.order, "APPROVED").outcome.complete;
}

/** Les identifiants désignés, nettoyés : sans vide, sans doublon, dans l'ordre de saisie. */
export function nettoyerIds(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.map((i) => (i ?? "").trim()).filter(Boolean))];
}

/**
 * CE QUI MANQUE À LA DÉCISION DU DG — `null` si rien. Le N+1 et au moins un suiveur, tous utilisateurs ACTIFS
 * (`actifs` : les identifiants que la base dit actifs). Un compte désactivé ne suivrait rien et ne recevrait rien.
 */
export function refusDesignationDuSommet(
  d: { futureManagerId: string | null; followerIds: readonly string[] },
  actifs: ReadonlySet<string>,
): string | null {
  if (!d.futureManagerId) return "Désignez le N+1 de la future recrue : c'est vous qui le décidez en validant.";
  if (!actifs.has(d.futureManagerId)) return "Le N+1 désigné n'est pas un utilisateur actif.";
  if (d.followerIds.length === 0) return "Désignez au moins une personne en charge du suivi de ce recrutement.";
  if (d.followerIds.some((id) => !actifs.has(id))) return "Une personne désignée pour le suivi n'est pas un utilisateur actif.";
  return null;
}

/**
 * QUI PRÉVENIR À CÔTÉ DU DEMANDEUR — le futur N+1 et les suiveurs, une fois chacun, jamais ceux de `sauf` (l'auteur
 * du geste, le demandeur déjà prévenu).
 */
export function suiveursAPrevenir(
  futureManagerId: string | null,
  followerIds: readonly string[],
  sauf: readonly (string | null | undefined)[],
): string[] {
  const exclus = new Set(sauf.filter((s): s is string => Boolean(s)));
  return nettoyerIds([futureManagerId, ...followerIds]).filter((id) => !exclus.has(id));
}

// ───────────────────────────── La frise et la phrase « état — chez qui » ─────────────────────────────

export interface EtapeDeLaFrise {
  cle: string;
  titre: string;
  detail: string | null;
  etat: "done" | "current" | "todo" | "rejected";
}

const RANG_ETAPE: Partial<Record<RecruitmentStage, number>> = {
  HR_REVIEW: 1, INFO_REQUESTED: 1, SOURCING: 2, ONBOARDING: 3, CLOSED: 4,
};

/**
 * LA FRISE D'UNE DEMANDE — Demande, chaque marche de la chaîne (par le nom de son validateur), les RH, le poste
 * ouvert, l'intégration, la clôture. Pure : la page la dessine telle quelle.
 */
export function friseDuRecrutement(
  stage: RecruitmentStage,
  steps: readonly ChainStep[],
  opts: { returnedFrom?: RecruitmentStage | null } = {},
): EtapeDeLaFrise[] {
  const triees = [...steps].sort((a, b) => a.order - b.order);
  const active = currentStep(triees);
  const marcheRefusee = triees.some((s) => s.status === "REJECTED");
  // Où la demande EST (ou était, si elle est renvoyée) : la chaîne (0), les RH (1), le poste ouvert (2)…
  const lieu: RecruitmentStage = stage === "RETURNED" ? (opts.returnedFrom ?? "CHAIN") : stage;
  const rang = lieu === "CHAIN" ? 0 : lieu === "REJECTED" ? (marcheRefusee ? 0 : 1) : RANG_ETAPE[lieu] ?? -1;
  const marches: EtapeDeLaFrise[] = triees.map((s) => ({
    cle: `m${s.order}`,
    titre: s.approverName || `Marche ${s.order}`,
    detail: s.status === "APPROVED" ? "a validé" : s.status === "REJECTED" ? "a refusé" : s.status === "SKIPPED" ? "non consulté" : null,
    etat: s.status === "APPROVED" || s.status === "SKIPPED" ? "done"
      : s.status === "REJECTED" ? "rejected"
        : (lieu === "CHAIN" && stage !== "CANCELLED" && s === active) ? "current" : "todo",
  }));
  const suite = (i: number, cle: string, titre: string): EtapeDeLaFrise => ({
    cle, titre, detail: null,
    etat: stage === "REJECTED" && !marcheRefusee && i === 1 ? "rejected"
      : stage === "CLOSED" || rang > i ? "done"
        : rang === i && stage !== "CANCELLED" && stage !== "REJECTED" ? "current" : "todo",
  });
  return [
    { cle: "demande", titre: "Demande", detail: null, etat: "done" },
    ...marches,
    suite(1, "rh", "RH"),
    suite(2, "ouvert", "Poste ouvert"),
    suite(3, "integration", "Intégration"),
    suite(4, "close", "Clôturée"),
  ];
}

export interface StatutDuRecrutement {
  phrase: string;
  ton: "info" | "succes" | "attente" | "refus" | "neutre";
}

/** « État — chez qui » : la phrase qui ouvre la fiche. `aVous` : c'est la personne qui regarde qu'on attend. */
export function statutDuRecrutement(
  stage: RecruitmentStage,
  f: { waitingOn: string | null; requesterName: string | null; aVous?: boolean },
): StatutDuRecrutement {
  const chez = (qui: string | null) => (f.aVous ? "à vous" : `chez ${qui ?? "—"}`);
  switch (stage) {
    case "CHAIN": return { phrase: `Validation hiérarchique — ${chez(f.waitingOn)}`, ton: "attente" };
    case "HR_REVIEW": return { phrase: `À instruire — ${f.aVous ? "à vous" : "chez les RH"}`, ton: "attente" };
    case "INFO_REQUESTED": return { phrase: `Précisions demandées — ${chez(f.requesterName)}`, ton: "attente" };
    case "RETURNED": return { phrase: `À corriger — ${chez(f.requesterName)}`, ton: "attente" };
    case "SOURCING": return { phrase: "Recrutement ouvert — diffusion et CV chez les RH", ton: "info" };
    case "ONBOARDING": return { phrase: "Intégration — chez les RH", ton: "info" };
    case "CLOSED": return { phrase: "Clôturée", ton: "succes" };
    case "REJECTED": return { phrase: "Refusée", ton: "refus" };
    case "CANCELLED": return { phrase: "Retirée par son demandeur", ton: "neutre" };
    default: return { phrase: STAGE_LABEL[stage] ?? String(stage), ton: "neutre" };
  }
}

/** Où en est la chaîne, dit en clair : « 2 / 4 — en attente de Karim Saïdi ». */
export function chainProgress(steps: readonly ChainStep[]): { done: number; total: number; waitingOn: string | null } {
  const total = steps.length;
  const done = steps.filter((s) => s.status !== "PENDING").length;
  const step = currentStep(steps);
  return { done, total, waitingOn: step ? (step.approverName || null) : null };
}

// ───────────────────────────── Corriger, rouvrir (audit 360°, R14 — §118.192) ─────────────────────────────

/**
 * LES MARCHES QUI CHANGENT — appariées par leur RANG, jamais par leur position dans un tableau.
 *
 * L'action comparait `apres[i]` (trié par rang) à `avant[i]` (dans l'ordre où la base les rendait) :
 * sans `ORDER BY`, Postgres rend volontiers une ligne MISE À JOUR après les autres. La marche 1
 * approuvée passe alors derrière la marche 2, et la décision sur la marche 2 se comparait à la
 * marche 1 — la marche décidée n'était pas écrite (la demande partait aux RH avec une marche « en
 * attente »), et la date d'une marche déjà approuvée était réécrite. Le rang est la seule clé.
 */
export function marchesChangees(avant: readonly ChainStep[], apres: readonly ChainStep[]): ChainStep[] {
  const ancien = new Map(avant.map((s) => [s.order, s.status]));
  return apres.filter((s) => ancien.get(s.order) !== s.status);
}

/** Ce qui, dans le besoin, a été PESÉ par les validateurs. */
export interface BesoinPese {
  position: string;
  headcount: number;
  contractType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  endDate: Date | string | null;
}

const plie = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

/**
 * CE QUI FAIT REPARTIR LA CHAÎNE — un accord ne couvre pas plus que ce qu'il a vu (§118.187).
 *
 * Un autre poste, un autre contrat, plus de postes, une rémunération relevée (ou un plafond retiré),
 * un contrat plus long : les validateurs n'ont pas accordé CELA, la chaîne repart de sa première
 * marche. Ce qui RÉDUIT (moins de postes, une borne baissée, un terme avancé) ou ce qui PRÉCISE sans
 * rien relever (une borne posée là où il n'y en avait aucune, une faute de frappe dans l'intitulé)
 * ne redemande rien : refaire valider une baisse, c'est faire payer une prudence.
 *
 * Rend la liste des changements, dits en clair — c'est la phrase que lira la première marche.
 */
export function changementsMateriels(avant: BesoinPese, apres: BesoinPese): string[] {
  const out: string[] = [];
  if (plie(avant.position) !== plie(apres.position)) out.push(`poste « ${avant.position.trim()} » → « ${apres.position.trim()} »`);
  if (avant.contractType !== apres.contractType) {
    const lib = (c: string) => (isRecruitmentContract(c) ? CONTRACT_LABEL[c] : c);
    out.push(`contrat ${lib(avant.contractType)} → ${lib(apres.contractType)}`);
  }
  if (apres.headcount > avant.headcount) out.push(`postes ${avant.headcount} → ${apres.headcount}`);
  const avMin = avant.salaryMin, apMin = apres.salaryMin;
  if (avMin != null && apMin != null && apMin > avMin) out.push(`rémunération minimale ${formatCurrency(avMin)} → ${formatCurrency(apMin)}`);
  const avMax = avant.salaryMax, apMax = apres.salaryMax;
  if (avMax != null && apMax == null) out.push(`plafond de rémunération ${formatCurrency(avMax)} retiré`);
  else if (avMax != null && apMax != null && apMax > avMax) out.push(`rémunération maximale ${formatCurrency(avMax)} → ${formatCurrency(apMax)}`);
  const finAv = toDate(avant.endDate), finAp = toDate(apres.endDate);
  if (finAv && finAp && finAp > finAv) out.push(`fin de contrat repoussée au ${finAp.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}`);
  return out;
}

/**
 * OÙ REPART UNE DEMANDE ROUVERTE — ou pourquoi elle ne repart pas.
 *
 * Refusée dans la CHAÎNE, elle repart à la marche qui a refusé, et à elle seule : les marches d'avant
 * ont validé, et les leur redemander ferait payer à tout le monde l'erreur d'une seule. Refusée par
 * les RH, elle leur revient. Close sans recrutement, le poste se rouvre. Une demande RETIRÉE par son
 * auteur, ou close APRÈS un recrutement, ne se rouvre pas — et le refus dit le geste qui reste.
 */
export function reouverture(
  stage: RecruitmentStage,
  steps: readonly ChainStep[],
  aRecrute: boolean,
): { vers: "CHAIN" | "HR_REVIEW" | "SOURCING"; marche: number | null } | { refus: string } {
  if (stage === "REJECTED") {
    const refusee = steps.find((s) => s.status === "REJECTED");
    return refusee ? { vers: "CHAIN", marche: refusee.order } : { vers: "HR_REVIEW", marche: null };
  }
  if (stage === "CLOSED") {
    return aRecrute
      ? { refus: "Un candidat a été recruté sur cette demande : elle ne se rouvre pas. Pour un nouveau poste, déposez une nouvelle demande." }
      : { vers: "SOURCING", marche: null };
  }
  if (stage === "CANCELLED") return { refus: "Une demande retirée par son auteur ne se rouvre pas : il en dépose une nouvelle." };
  return { refus: "Seule une demande refusée, ou close sans recrutement, se rouvre." };
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
  /** Désigné par le DG pour SUIVRE ce recrutement, ou futur N+1 de la recrue (Direction, 07/10). */
  isFollower?: boolean;
  /** Validateur de la chaîne (quelle que soit la marche). */
  isApprover?: boolean;
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
  /** Renvoyer pour correction (§118.192) — qui peut trancher la marche, ou les RH quand la demande est chez eux. */
  returnForCorrection: boolean;
  /** Corriger la demande renvoyée et la renvoyer — son demandeur (ou le sommet, qui supplée). */
  correct: boolean;
  /** Rouvrir une demande refusée, ou close sans recrutement — les RH ou le sommet, motif à l'appui. */
  reopen: boolean;
  /** Annuler une embauche avant l'intégration — les RH ou le sommet, motif à l'appui. */
  cancelHire: boolean;
  /** Écrire au fil de la demande — qui en est partie, tant qu'elle vit. */
  comment: boolean;
  /** Diffuser l'offre (site, LinkedIn, Emploitic, autre) — les RH, une fois la demande validée (Direction, 07/10). */
  diffuse: boolean;
}

/** Les étapes d'une demande pas encore exécutée — elle se retire (décision du 04/10). */
export const ETAPES_RETIRABLES: ReadonlySet<RecruitmentStage> = new Set<RecruitmentStage>([
  "CHAIN", "HR_REVIEW", "INFO_REQUESTED", "SOURCING", "RETURNED",
]);

/**
 * QUI A DÉJÀ LA DEMANDE ENTRE LES MAINS — et doit apprendre qu'elle est retirée : les marches qui se
 * sont prononcées et la marche active ; jamais celles que la demande n'a pas atteintes (du bruit sur
 * une demande qu'elles n'ont jamais vue, §118.32), jamais l'auteur du retrait. Les RH, elles, sont
 * prévenues dès que la demande les a atteintes.
 */
export function prevenusAuRetrait(
  stage: RecruitmentStage,
  marches: { order: number; approverId: string; status: string }[],
  auteurId: string,
): { approbateurs: string[]; rh: boolean } {
  const triees = [...marches].sort((a, b) => a.order - b.order);
  const active = stage === "CHAIN" ? triees.find((m) => m.status === "PENDING") : undefined;
  const approbateurs = triees
    .filter((m) => m.status !== "PENDING" || m === active)
    .map((m) => m.approverId)
    .filter((id) => id !== auteurId);
  return { approbateurs: [...new Set(approbateurs)], rh: stage === "HR_REVIEW" || stage === "INFO_REQUESTED" || stage === "SOURCING" };
}

export function abilities(
  stage: RecruitmentStage,
  actor: RecruitmentActor,
  opts: {
    chainUntouched?: boolean;
    hasHire?: boolean;
    /** Cette personne peut-elle trancher la marche ACTIVE (`canDecideStep`) ? Faux quand l'appelant ne le dit pas. */
    peutTrancherLaMarche?: boolean;
    /** Un candidat a-t-il été recruté sur cette demande ? INCONNU se lit « oui » : on ne rouvre pas à l'aveugle. */
    aRecrute?: boolean;
    /** L'embauche prononcée n'a pas encore de fiche employé — seule cette embauche-là s'annule. */
    embaucheSansFiche?: boolean;
  } = {},
): RecruitmentAbilities {
  const none: RecruitmentAbilities = {
    askInfo: false, answerInfo: false, openSourcing: false, hrReject: false,
    addCandidate: false, shortlist: false, select: false, interview: false,
    hire: false, onboard: false, cancel: false,
    returnForCorrection: false, correct: false, reopen: false, cancelHire: false,
    comment: false, diffuse: false,
  };
  const hr = actor.isHr || actor.isTop;
  // LE SUIVI DÉSIGNÉ PAR LE DG (Direction, 07/10) : ces personnes tiennent le recrutement avec les RH — elles
  // déposent des CV, consignent les entretiens et écrivent au fil. Elles ne tranchent rien : ni la présélection
  // (le demandeur), ni le choix ni le recrutement (le sommet), ni l'instruction (les RH).
  const suivi = actor.isFollower === true;
  // UNE DEMANDE CLOSE NE BOUGE PLUS — sauf pour être ROUVERTE, motif à l'appui (§118.192) : un refus
  // terminal faisait recommencer toute la chaîne pour une erreur que la personne qui a refusé
  // reconnaissait. Une demande RETIRÉE par son auteur ne se rouvre pas : il en redépose une. Une
  // demande close APRÈS un recrutement non plus — rouvrir laisserait deux recrutés sur un poste, et
  // l'intégration lirait le mauvais.
  if (isFinal(stage)) {
    return { ...none, reopen: hr && (stage === "REJECTED" || (stage === "CLOSED" && opts.aRecrute === false)) };
  }

  const sourcing = stage === "SOURCING";
  return {
    askInfo: hr && stage === "HR_REVIEW",
    answerInfo: stage === "INFO_REQUESTED" && (actor.isRequester || actor.isTop),
    openSourcing: hr && stage === "HR_REVIEW",
    hrReject: hr && (stage === "HR_REVIEW" || stage === "INFO_REQUESTED"),
    addCandidate: (hr || suivi) && sourcing,
    // Le demandeur présélectionne. Les RH ne le font pas à sa place : ils n'ont pas le poste en
    // tête, et une présélection faite par défaut ne serait qu'une file d'attente déguisée.
    shortlist: sourcing && (actor.isRequester || actor.isTop),
    select: sourcing && actor.isTop,
    interview: sourcing && (hr || actor.isRequester || suivi),
    hire: sourcing && actor.isTop,
    onboard: hr && stage === "ONBOARDING" && (opts.hasHire ?? true),
    // On retire sa demande TANT QU'ELLE N'EST PAS EXÉCUTÉE (décision de la Direction, 04/10) : jusqu'au
    // recrutement prononcé (ONBOARDING) — même si la chaîne a commencé à dire oui, même en sourcing.
    // Le retrait CLÔT (étape CANCELLED, ses accords restent au fil), il n'efface rien.
    cancel: ETAPES_RETIRABLES.has(stage) && (actor.isRequester || actor.isTop),
    // Renvoyer est un refus ADOUCI : ouvert à qui peut trancher, là où il le peut (§118.186).
    returnForCorrection: (stage === "CHAIN" && opts.peutTrancherLaMarche === true) || (stage === "HR_REVIEW" && hr),
    correct: stage === "RETURNED" && (actor.isRequester || actor.isTop),
    reopen: false,
    cancelHire: stage === "ONBOARDING" && hr && opts.embaucheSansFiche === true,
    comment: hr || suivi || actor.isRequester || actor.isApprover === true,
    // La diffusion suit la validation : chez les RH, puis poste ouvert — jamais avant que la chaîne ait dit oui.
    diffuse: hr && (stage === "HR_REVIEW" || stage === "SOURCING"),
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
