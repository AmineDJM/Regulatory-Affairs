/**
 * LE CIRCUIT DU MATÉRIEL PROMOTIONNEL — cinq étapes au lieu de seize.
 *
 * L'ancien circuit enchaînait seize statuts en file indienne : prospection, devis, choix d'agence,
 * bon de commande, validation finances, envoi, bordereau, paiement, production, conformité, visa,
 * BAT, matériel final, facture, règlement. Chacun attendait le précédent. Un poster mettait deux
 * mois à sortir, et personne ne savait jamais chez qui il dormait.
 *
 * Le nouveau circuit tient en une chaîne de validation courte, puis OUVRE trois chemins qui
 * avancent EN MÊME TEMPS. C'est le vrai gain : le bon de commande, le paiement et le visa
 * publicitaire n'ont aucune raison de s'attendre les uns les autres.
 *
 *   Devis demandé  →  1. demandeur  →  2. N+1  →  3. PDG *ou* Super Admin  →  4. Information
 *   médicale  →  [ bon de commande ‖ demande de paiement ‖ demande de visa ]  →  terminé
 *
 * Deux raccourcis voulus :
 *   • qui a DÉJÀ un devis en main le dépose et saute la demande de devis — c'est le cas le plus
 *     fréquent, et le faire passer par une prospection fictive ne trompait personne ;
 *   • la troisième validation est satisfaite par le PDG **ou** le Super Admin, un seul suffit :
 *     exiger les deux, c'est bloquer sur un congé.
 *
 * Module PUR — testé, sans base de données.
 */

/** Les étapes du circuit court. L'ordre de ce tableau EST le circuit. */
export const PROMO_STEPS = [
  "QUOTE_REQUESTED",     // devis demandé aux agences
  "REVIEW_REQUESTER",    // 1. le demandeur valide le devis reçu
  "REVIEW_MANAGER",      // 2. le N+1 valide
  "REVIEW_EXECUTIVE",    // 3. le PDG OU le Super Admin valide (un seul suffit)
  "REVIEW_MEDICAL_INFO", // 4. l'information médicale valide
  "IN_EXECUTION",        // les trois chemins parallèles courent
  "COMPLETED",
] as const;

export type PromoStep = (typeof PROMO_STEPS)[number];
export type PromoState = PromoStep | "REFUSED";

export const PROMO_STEP_LABEL: Record<PromoState, string> = {
  QUOTE_REQUESTED: "Devis demandé",
  REVIEW_REQUESTER: "Validation du demandeur",
  REVIEW_MANAGER: "Validation du N+1",
  REVIEW_EXECUTIVE: "Validation PDG / Super Admin",
  REVIEW_MEDICAL_INFO: "Validation information médicale",
  IN_EXECUTION: "En exécution (BC · paiement · visa)",
  COMPLETED: "Terminé",
  REFUSED: "Refusé",
};

/** Les trois chantiers qui avancent EN PARALLÈLE une fois toutes les validations obtenues. */
export const PROMO_TRACKS = ["PURCHASE_ORDER", "PAYMENT", "AD_VISA"] as const;
export type PromoTrack = (typeof PROMO_TRACKS)[number];

export const PROMO_TRACK_LABEL: Record<PromoTrack, string> = {
  PURCHASE_ORDER: "Bon de commande",
  PAYMENT: "Demande de paiement",
  AD_VISA: "Demande de visa publicitaire",
};

/** Le rôle attendu à chaque étape de validation. */
export type Actor = "REQUESTER" | "MANAGER" | "EXECUTIVE" | "MEDICAL_INFO";

const STEP_ACTOR: Partial<Record<PromoStep, Actor>> = {
  REVIEW_REQUESTER: "REQUESTER",
  REVIEW_MANAGER: "MANAGER",
  REVIEW_EXECUTIVE: "EXECUTIVE",
  REVIEW_MEDICAL_INFO: "MEDICAL_INFO",
};

/**
 * L'étape de départ. Un devis DÉJÀ en main saute la demande de devis.
 *
 * C'est le cas le plus fréquent — on a appelé l'imprimeur avant d'ouvrir l'ERP — et le faire
 * passer par une prospection fictive n'ajoutait qu'un clic et un mensonge dans l'historique.
 */
export function initialStep(input: { hasQuote: boolean }): PromoStep {
  return input.hasQuote ? "REVIEW_REQUESTER" : "QUOTE_REQUESTED";
}

/** L'étape suivante dans la chaîne, ou `null` si l'on est au bout. */
export function nextStep(current: PromoStep): PromoStep | null {
  const i = PROMO_STEPS.indexOf(current);
  if (i < 0 || i >= PROMO_STEPS.length - 1) return null;
  return PROMO_STEPS[i + 1];
}

/**
 * Qui peut valider CETTE étape ?
 *
 * La troisième validation est satisfaite par le PDG **ou** le Super Admin — un seul suffit. Le
 * Super Admin peut de toute façon débloquer n'importe quelle étape : c'est ce qui évite qu'un
 * circuit s'arrête parce qu'une personne est absente, et c'est tracé au journal comme le reste.
 */
export function canValidate(
  user: { id: string; role: string },
  state: PromoState,
  ctx: { requesterId: string | null; managerId: string | null },
): boolean {
  if (state === "REFUSED" || state === "COMPLETED" || state === "IN_EXECUTION") return false;
  if (state === "QUOTE_REQUESTED") return false; // il faut d'abord déposer un devis
  const actor = STEP_ACTOR[state];
  if (!actor) return false;

  if (user.role === "SUPER_ADMIN") return true;
  switch (actor) {
    case "REQUESTER": return user.id === ctx.requesterId;
    case "MANAGER": return user.id === ctx.managerId;
    case "EXECUTIVE": return user.role === "DIRECTION";
    case "MEDICAL_INFO": return user.role === "MEDICAL_INFO_PHARMACIST";
  }
}

/**
 * QUI VOIT QUOI — et c'est la partie qui compte autant que le circuit lui-même.
 *
 * Le circuit COMPLET n'est visible que de l'administrateur et du PDG. Les autres voient l'étape
 * en cours et ce qui les concerne : un délégué n'a pas à savoir que la comptabilité a mis onze
 * jours à signer, et afficher toute la chaîne à tout le monde transforme un outil de travail en
 * tableau de surveillance mutuelle.
 */
export function seesFullCircuit(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "DIRECTION";
}

/**
 * Les étapes qu'une personne donnée peut lire.
 *
 * Pour qui ne voit pas tout : l'étape en cours seulement — assez pour savoir où en est le dossier,
 * pas assez pour reconstituer qui a traîné.
 */
export function visibleSteps(user: { role: string }, state: PromoState): PromoState[] {
  if (seesFullCircuit(user)) return [...PROMO_STEPS];
  return [state];
}

/** Les chemins parallèles sont-ils ouverts ? Seulement une fois TOUTES les validations obtenues. */
export function tracksOpen(state: PromoState): boolean {
  return state === "IN_EXECUTION";
}

/**
 * Le dossier est-il terminé ? Quand les trois chantiers sont clos.
 *
 * Ils avancent indépendamment : c'est tout l'intérêt. Mais le dossier n'est fini que lorsque le
 * dernier l'est — sans quoi on classerait une commande dont le visa n'est jamais arrivé.
 */
export function allTracksDone(done: readonly PromoTrack[]): boolean {
  return PROMO_TRACKS.every((t) => done.includes(t));
}

/** Ce qu'il reste à faire, nommé — « en exécution » tout seul ne dit pas quoi relancer. */
export function pendingTracks(done: readonly PromoTrack[]): PromoTrack[] {
  return PROMO_TRACKS.filter((t) => !done.includes(t));
}

/**
 * La progression, en pas franchis sur le total — pour une barre honnête.
 *
 * `IN_EXECUTION` compte les chantiers clos : rester bloqué à « 5/7 » pendant trois semaines
 * pendant que deux chantiers sur trois sont finis donnerait une image fausse de l'avancement.
 */
export function progress(state: PromoState, done: readonly PromoTrack[]): { step: number; total: number } {
  const total = PROMO_STEPS.length;
  if (state === "REFUSED") return { step: 0, total };
  if (state === "COMPLETED") return { step: total, total };
  const i = PROMO_STEPS.indexOf(state) + 1;
  if (state !== "IN_EXECUTION") return { step: i, total };
  // Entre « en exécution » et « terminé », on répartit selon les chantiers clos.
  const share = done.length / PROMO_TRACKS.length;
  return { step: Math.round(i + share), total };
}

/** Le libellé de l'attente : « on attend qui ? », la seule question qu'on pose à un circuit. */
export function waitingOn(state: PromoState, done: readonly PromoTrack[]): string {
  if (state === "REFUSED") return "Dossier refusé";
  if (state === "COMPLETED") return "Rien — dossier terminé";
  if (state === "QUOTE_REQUESTED") return "Le devis de l'agence";
  if (state === "IN_EXECUTION") {
    const rest = pendingTracks(done);
    return rest.length === 0 ? "Rien — clôture en cours" : rest.map((t) => PROMO_TRACK_LABEL[t]).join(" · ");
  }
  return PROMO_STEP_LABEL[state];
}
