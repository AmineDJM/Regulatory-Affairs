import {
  LIBELLE_STATUT_PROPOSITION, STATUTS_ACCEPTES, campagnePourPole, ecartPct, estDecisionLigne, estSourceLigne,
  estStatutCampagne, estStatutProposition, gestePermis, justificationRequise, montantRetenu, ouChezQui,
  valideursEnAttente, vuePoleSansCadrage,
  type CampagnePourPole, type DecisionLigne, type GesteProposition, type SourceLigne, type StatutCampagne,
  type StatutProposition,
} from "./regles";

/**
 * LES VUES DE LA CAMPAGNE — ce que chaque écran REÇOIT, construit à partir des lignes lues en base.
 *
 * La règle qui compte : la vue d'un pôle se construit par `construireVuePole`, qui passe par la LISTE BLANCHE de la
 * campagne (`campagnePourPole`) et retire le cadrage de chaque proposition (`vuePoleSansCadrage`). Le cadrage ne quitte
 * donc jamais le serveur vers un pôle — et un test le vérifie sur le JSON envoyé.
 *
 * Module PUR (aucune base, aucun import hors `regles`) : importable par les écrans clients pour ses types.
 */

// ─────────────────────────────── Entrées (lues en base, montants déjà en nombres) ───────────────────────────────

export interface RawCampagne {
  id: string; year: number; companyId: string | null; title: string; status: string;
  opensAt: Date; submitDeadline: Date; validationDeadline: Date;
  cadrageTotal: number | null; validatorMode: string; validatorIds: string[]; validatorRule: string;
  allowRectificatif: boolean; seuilJustificationPct: number;
}

export interface RawLigne {
  id: string; key: string; label: string; categoryKey: string | null; source: string;
  realise2026: number; propose: number; ajuste: number | null; decision: string | null;
  justification: string | null; attachments: unknown; sortOrder: number;
}

export interface RawProposition {
  id: string; departmentId: string | null; poleLabel: string; domaine: string; cadrage: number | null;
  status: string; currentVersion: number; estRectificatif: boolean; revisionAutorisee: boolean; envelopeId: string | null;
  responsable: string | null;
  lignes: RawLigne[];
  votes: { userId: string; decision: string; version: number; createdAt: Date }[];
  commentaires: { id: string; authorId: string | null; parLuna: boolean; body: string; createdAt: Date; lineId: string | null }[];
  versions: { version: number; submittedAt: Date; total: number; summary: string | null; summaryByLuna: boolean; rectificatif: boolean }[];
}

// ─────────────────────────────── Sorties (ce que reçoivent les écrans) ───────────────────────────────

export interface LigneVue {
  id: string; key: string; label: string; categoryKey: string | null; source: SourceLigne;
  realise2026: number; propose: number; ajuste: number | null; decision: DecisionLigne | null;
  justification: string | null; pieces: { id: string; name: string }[];
  ecart: number | null; justificationRequise: boolean; retenu: number;
}

export interface CommentaireVue { id: string; auteur: string; parLuna: boolean; body: string; createdAt: string; ligne: string | null }
export interface VersionVue { version: number; submittedAt: string; total: number; summary: string | null; summaryByLuna: boolean; rectificatif: boolean }

export interface PropositionVue {
  id: string; departmentId: string | null; pole: string; responsable: string | null; domaine: string;
  statut: StatutProposition; libelleStatut: string; ouChezQui: string; version: number;
  realise: number; demande: number; retenu: number; ecart: number | null;
  estRectificatif: boolean; revisionAutorisee: boolean; envelopeId: string | null;
  avis: { nom: string; decision: string }[];
  lignes: LigneVue[]; commentaires: CommentaireVue[]; versions: VersionVue[];
  gestes: Record<GesteProposition, boolean>;
  /** Présent dans la vue de la Direction seulement — jamais dans celle d'un pôle. */
  cadrage?: number | null;
}

export interface CampagneVueDirection extends CampagnePourPole {
  validatorMode: string; validatorRule: string; validatorIds: string[]; validateurs: { id: string; nom: string }[];
  allowRectificatif: boolean; companyId: string | null;
  /** Présent seulement pour qui voit le cadrage (DG, valideurs, Super Admin). */
  cadrageTotal?: number | null;
}

const GESTES: GesteProposition[] = ["MODIFIER", "SOUMETTRE", "DECIDER_LIGNE", "VOTER", "RENVOYER", "REPRENDRE", "AUTORISER_REVISION", "ROUVRIR_RECTIFICATIF"];

function pieces(v: unknown): { id: string; name: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => (x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string"
    ? [{ id: (x as { id: string }).id, name: String((x as { name?: unknown }).name ?? "pièce") }] : []));
}

export function construireLigne(l: RawLigne, seuil: number): LigneVue {
  return {
    id: l.id, key: l.key, label: l.label, categoryKey: l.categoryKey,
    source: estSourceLigne(l.source) ? l.source : "SAISIE",
    realise2026: l.realise2026, propose: l.propose, ajuste: l.ajuste,
    decision: estDecisionLigne(l.decision) ? l.decision : null,
    justification: l.justification, pieces: pieces(l.attachments),
    ecart: ecartPct(l.realise2026, l.propose),
    justificationRequise: justificationRequise(l.realise2026, l.propose, seuil),
    retenu: montantRetenu(l),
  };
}

/** Une proposition construite pour un écran — AVEC son cadrage ; la vue d'un pôle le retire ensuite. */
export function construireProposition(p: RawProposition, c: RawCampagne, noms: ReadonlyMap<string, string>): PropositionVue & { cadrage: number | null } {
  const statut: StatutProposition = estStatutProposition(p.status) ? p.status : "EN_PREPARATION";
  const statutCampagne: StatutCampagne = estStatutCampagne(c.status) ? c.status : "DRAFT";
  const lignes = [...p.lignes].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr")).map((l) => construireLigne(l, c.seuilJustificationPct));
  const votesVersion = p.votes.filter((v) => v.version === p.currentVersion);
  const restants = statut === "SOUMIS"
    ? valideursEnAttente(votesVersion.map((v) => ({ userId: v.userId, decision: v.decision === "REFUSE" ? "REFUSE" : "ACCEPTE", at: v.createdAt.getTime() })), c.validatorIds).map((id) => noms.get(id) ?? "un valideur")
    : [];
  const realise = lignes.reduce((a, l) => a + l.realise2026, 0);
  const demande = lignes.reduce((a, l) => a + l.propose, 0);
  const ctx = { statutCampagne, statut, revisionAutorisee: p.revisionAutorisee, allowRectificatif: c.allowRectificatif, estRectificatif: p.estRectificatif };
  const nomLigne = new Map(p.lignes.map((l) => [l.id, l.label]));
  return {
    id: p.id, departmentId: p.departmentId, pole: p.poleLabel, responsable: p.responsable, domaine: p.domaine,
    statut, libelleStatut: LIBELLE_STATUT_PROPOSITION[statut], ouChezQui: ouChezQui(statut, p.poleLabel, restants),
    version: p.currentVersion,
    realise, demande, retenu: lignes.reduce((a, l) => a + l.retenu, 0), ecart: ecartPct(realise, demande),
    estRectificatif: p.estRectificatif, revisionAutorisee: p.revisionAutorisee, envelopeId: p.envelopeId,
    avis: votesVersion.map((v) => ({ nom: noms.get(v.userId) ?? "valideur", decision: v.decision })),
    lignes,
    commentaires: [...p.commentaires].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((m) => ({
      id: m.id, auteur: m.parLuna ? "Luna" : (m.authorId ? noms.get(m.authorId) ?? "—" : "—"), parLuna: m.parLuna,
      body: m.body, createdAt: m.createdAt.toISOString(), ligne: m.lineId ? nomLigne.get(m.lineId) ?? null : null,
    })),
    versions: [...p.versions].sort((a, b) => b.version - a.version).map((v) => ({
      version: v.version, submittedAt: v.submittedAt.toISOString(), total: v.total, summary: v.summary, summaryByLuna: v.summaryByLuna, rectificatif: v.rectificatif,
    })),
    gestes: Object.fromEntries(GESTES.map((g) => [g, gestePermis(g, ctx).ok])) as Record<GesteProposition, boolean>,
    cadrage: p.cadrage,
  };
}

/**
 * LA VUE D'UN PÔLE — sans AUCUN cadrage : la campagne passe par sa liste blanche, chaque proposition perd le sien.
 * C'est la seule porte par laquelle une vue de pôle se construit.
 */
export function construireVuePole(c: RawCampagne, propositions: readonly RawProposition[], noms: ReadonlyMap<string, string>): {
  campagne: CampagnePourPole;
  propositions: Omit<PropositionVue, "cadrage">[];
} {
  return {
    campagne: campagnePourPole(c),
    propositions: propositions.map((p) => vuePoleSansCadrage(construireProposition(p, c, noms))),
  };
}

/** LA VUE DE LA DIRECTION — le cadrage n'y figure que pour qui a le droit de le voir. */
export function construireVueDirection(
  c: RawCampagne,
  propositions: readonly RawProposition[],
  noms: ReadonlyMap<string, string>,
  voitLeCadrage: boolean,
): { campagne: CampagneVueDirection; propositions: PropositionVue[] } {
  const campagne: CampagneVueDirection = {
    ...campagnePourPole(c),
    validatorMode: c.validatorMode, validatorRule: c.validatorRule, validatorIds: c.validatorIds,
    validateurs: c.validatorIds.map((id) => ({ id, nom: noms.get(id) ?? "compte retiré" })),
    allowRectificatif: c.allowRectificatif, companyId: c.companyId,
    ...(voitLeCadrage ? { cadrageTotal: c.cadrageTotal } : {}),
  };
  return {
    campagne,
    propositions: propositions.map((p) => {
      const vue = construireProposition(p, c, noms);
      return voitLeCadrage ? vue : vuePoleSansCadrage(vue);
    }),
  };
}

/** Les tuiles de la vue de la Direction (le cadrage seulement s'il est visible). */
export function tuilesDirection(propositions: readonly PropositionVue[], cadrageTotal: number | null | undefined): {
  demande: number; realise: number; retenu: number; aRevoir: number; remises: number; total: number;
  ecartCadrage: number | null; ecartRealise: number | null;
} {
  const demande = propositions.reduce((a, p) => a + p.demande, 0);
  const realise = propositions.reduce((a, p) => a + p.realise, 0);
  return {
    demande, realise,
    retenu: propositions.filter((p) => STATUTS_ACCEPTES.includes(p.statut)).reduce((a, p) => a + p.retenu, 0),
    aRevoir: propositions.filter((p) => p.statut === "A_REVOIR").length,
    remises: propositions.filter((p) => p.version > 0).length,
    total: propositions.length,
    ecartCadrage: cadrageTotal && cadrageTotal > 0 ? ecartPct(cadrageTotal, demande) : null,
    ecartRealise: ecartPct(realise, demande),
  };
}
