/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CALIBRATION DE CONFIANCE (mandat 4 §29) — pure, sans import.
 *
 * Ce qu'Adam sait se range en cinq états, et chacun COMMANDE une conduite :
 *
 *   CERTAIN        → AGIR       (lu dans l'ERP ou calculé par le code, frais, sous droits)
 *   PROBABLE       → VÉRIFIER   (un document indexé, une lecture OCR, une déduction)
 *   HYPOTHÈSE      → CHERCHER   (la mémoire d'un modèle, le web, une estimation)
 *   MANQUANT       → DEMANDER   (aucun fait pour ce que la question exige)
 *   CONTRADICTION  → ARBITRER   (deux sources, deux valeurs, un même libellé)
 *
 * La règle est ARITHMÉTIQUE et se relit : le maillon le plus faible gouverne. Vingt faits
 * certains et un fait de mémoire font une réponse « hypothèse » — parce que c'est celui-là qu'on
 * aurait cité sans le savoir. Elle ne remplace ni la vérification indépendante des missions
 * critiques (§49) ni l'échelle des recours (§118 : TROUVÉ / DÉDUIT / CANDIDAT / INCONNU) : elle
 * parle le même vocabulaire, à l'échelle d'un tour de conversation ou d'un rapport de spécialiste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Certitude = "CERTAIN" | "PROBABLE" | "HYPOTHESE" | "MANQUANT" | "CONTRADICTION";
export type Conduite = "AGIR" | "VERIFIER" | "CHERCHER" | "DEMANDER" | "ARBITRER";
export type Enjeu = "FAIBLE" | "NORMAL" | "ELEVE";

export const CERTITUDES: readonly Certitude[] = ["CERTAIN", "PROBABLE", "HYPOTHESE", "MANQUANT", "CONTRADICTION"];
export const CONDUITE_PAR_CERTITUDE: Record<Certitude, Conduite> = { CERTAIN: "AGIR", PROBABLE: "VERIFIER", HYPOTHESE: "CHERCHER", MANQUANT: "DEMANDER", CONTRADICTION: "ARBITRER" };
export const LIBELLE_CERTITUDE: Record<Certitude, string> = { CERTAIN: "certain", PROBABLE: "probable", HYPOTHESE: "hypothèse", MANQUANT: "manquant", CONTRADICTION: "contradiction" };
export const LIBELLE_CONDUITE: Record<Conduite, string> = { AGIR: "agir", VERIFIER: "vérifier avant d'agir", CHERCHER: "chercher encore", DEMANDER: "demander à la personne", ARBITRER: "arbitrer la contradiction" };
/** Le même état, dans les autres vocabulaires de la maison : l'étiquette de réponse, l'échelle des missions. */
export const EQUIVALENCES: Record<Certitude, { reponse: string; mission: string }> = {
  CERTAIN: { reponse: "FAIT VÉRIFIÉ", mission: "TROUVÉ" }, PROBABLE: { reponse: "FAIT DÉRIVÉ", mission: "DÉDUIT" }, HYPOTHESE: { reponse: "ESTIMATION / HYPOTHÈSE", mission: "CANDIDAT" },
  MANQUANT: { reponse: "INCONNU", mission: "INCONNU" }, CONTRADICTION: { reponse: "INCOHÉRENCE À SIGNALER", mission: "—" },
};

/** Ce qu'un fait doit dire pour être calibré — la forme de `FaitSource` (F8), sans dépendre d'elle. */
export interface FaitCalibrable {
  id: string;
  libelle: string;
  valeur: string | null;
  /** ERP, DOCUMENT, EMAIL, CALCUL, EXTERNE… */
  nature: string;
  outil: string;
  confiance: number;
  /** metadata, native, ocr, luna, terra, calcul, externe, declare. */
  base: string;
  fraicheur: string;
  horodatage: string | null;
  preuveNegative: boolean | null;
}

export interface Contradiction { libelle: string; valeurs: string[]; outils: string[] }

export interface Calibration {
  certitude: Certitude;
  conduite: Conduite;
  motif: string;
  enjeu: Enjeu;
  faits: number;
  parCertitude: Record<"CERTAIN" | "PROBABLE" | "HYPOTHESE", number>;
  contradictions: Contradiction[];
  manquants: string[];
}

const plier = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const chiffres = (s: string): string => s.replace(/[^0-9]/g, "");

/** LA CERTITUDE D'UN FAIT : d'où il vient et à quel point la source le tient. */
export function certitudeDuFait(f: Pick<FaitCalibrable, "confiance" | "base" | "nature">): "CERTAIN" | "PROBABLE" | "HYPOTHESE" {
  const base = (f.base || "").toLowerCase();
  // Une lecture de modèle (Luna / Terra) ou le web n'est JAMAIS certaine : au mieux probable.
  if (base === "luna" || base === "terra" || base === "externe" || f.nature === "EXTERNE") return f.confiance >= 0.9 ? "PROBABLE" : "HYPOTHESE";
  if (f.confiance >= 0.85 && (base === "metadata" || base === "native" || base === "calcul" || base === "declare")) return "CERTAIN";
  if (f.confiance >= 0.6) return "PROBABLE";
  return "HYPOTHESE";
}

/** DEUX VALEURS POUR UN MÊME LIBELLÉ : la contradiction se constate, elle ne se tranche pas ici. */
export function contradictionsDe(faits: readonly FaitCalibrable[]): Contradiction[] {
  const groupes = new Map<string, { libelle: string; valeurs: Map<string, string>; outils: Set<string> }>();
  for (const f of faits) {
    if (f.preuveNegative || !f.valeur || !f.libelle) continue;
    const cle = plier(f.libelle);
    if (!cle) continue;
    const g = groupes.get(cle) ?? { libelle: f.libelle, valeurs: new Map(), outils: new Set() };
    const v = plier(f.valeur).replace(/\s+/g, "");
    if (v) { if (!g.valeurs.has(v)) g.valeurs.set(v, f.valeur); g.outils.add(f.outil); }
    groupes.set(cle, g);
  }
  return [...groupes.values()].filter((g) => g.valeurs.size > 1).map((g) => ({ libelle: g.libelle, valeurs: [...g.valeurs.values()], outils: [...g.outils] }));
}

/** CE QUE LA QUESTION EXIGE ET QU'AUCUN FAIT NE PORTE : nombres ou noms ancrés dans la question. */
export function manquantsDe(faits: readonly FaitCalibrable[], requis: readonly string[]): string[] {
  const textes = faits.map((f) => `${plier(f.libelle)} ${plier(f.valeur ?? "")}`);
  const nombres = faits.map((f) => chiffres(`${f.libelle} ${f.valeur ?? ""}`));
  return requis.filter((r) => {
    const rp = plier(r);
    if (!rp) return false;
    const rn = chiffres(r);
    if (rn.length >= 2 && nombres.some((n) => n.includes(rn))) return false;
    return !textes.some((t) => t.includes(rp));
  });
}

const RANG: Record<Certitude, number> = { CERTAIN: 0, PROBABLE: 1, HYPOTHESE: 2, MANQUANT: 3, CONTRADICTION: 4 };
export const plusFaible = (a: Certitude, b: Certitude): Certitude => (RANG[a] >= RANG[b] ? a : b);

/**
 * CALIBRER un lot de faits — pour un tour, un rapport de spécialiste, une étape de mission.
 * `requis` : les ancres de la question (montant, référence, nom) ; sans fait qui les porte, MANQUANT.
 */
export function calibrer(faits: readonly FaitCalibrable[], opts: { requis?: readonly string[]; enjeu?: Enjeu } = {}): Calibration {
  const enjeu = opts.enjeu ?? "NORMAL";
  const utiles = faits.filter((f) => !f.preuveNegative);
  const parCertitude = { CERTAIN: 0, PROBABLE: 0, HYPOTHESE: 0 };
  for (const f of utiles) parCertitude[certitudeDuFait(f)] += 1;
  const contradictions = contradictionsDe(utiles);
  const manquants = manquantsDe(faits, opts.requis ?? []);
  let certitude: Certitude;
  let motif: string;
  if (contradictions.length) {
    const c = contradictions[0];
    certitude = "CONTRADICTION";
    motif = `contradiction sur « ${c.libelle} » : ${c.valeurs.slice(0, 3).join(" ≠ ")} (${c.outils.join(", ")})${contradictions.length > 1 ? ` — et ${contradictions.length - 1} autre(s)` : ""}`;
  } else if (!utiles.length) {
    certitude = "MANQUANT";
    motif = faits.length ? "seules des preuves négatives ont été lues : rien d'établi" : "aucun fait lu par un outil : rien n'est établi";
  } else if (manquants.length) {
    certitude = "MANQUANT";
    motif = `aucun fait lu ne porte ${manquants.slice(0, 3).map((m) => `« ${m} »`).join(", ")}${manquants.length > 3 ? "…" : ""}`;
  } else if (parCertitude.HYPOTHESE > 0) {
    certitude = "HYPOTHESE";
    motif = `${parCertitude.HYPOTHESE} fait(s) de mémoire, du web ou à faible confiance dans le lot (${parCertitude.CERTAIN} certain(s), ${parCertitude.PROBABLE} probable(s)) : le maillon faible gouverne`;
  } else if (parCertitude.PROBABLE > 0) {
    certitude = "PROBABLE";
    motif = `${parCertitude.PROBABLE} fait(s) lus dans un document ou déduits, ${parCertitude.CERTAIN} certain(s)`;
  } else {
    certitude = "CERTAIN";
    motif = `${parCertitude.CERTAIN} fait(s) lus dans l'ERP ou calculés par le code`;
  }
  let conduite = CONDUITE_PAR_CERTITUDE[certitude];
  // Un enjeu FAIBLE (une lecture sans conséquence) ne fait pas vérifier un fait probable ; un enjeu
  // ÉLEVÉ ne fait pas agir sur une hypothèse — la table dit déjà CHERCHER.
  if (certitude === "PROBABLE" && enjeu === "FAIBLE") conduite = "AGIR";
  return { certitude, conduite, motif, enjeu, faits: faits.length, parCertitude, contradictions, manquants };
}

/** L'ENJEU d'une demande, depuis ce qu'on en sait : une action proposée ou un montant fort pèse ; une question courte pèse peu. */
export function enjeuDe(question: string, ctx: { propositions?: number; montantMax?: number | null } = {}): Enjeu {
  const q = plier(question);
  if ((ctx.propositions ?? 0) > 0) return "ELEVE";
  if ((ctx.montantMax ?? 0) >= 1_000_000) return "ELEVE";
  if (/\b(paie|payer|paiement|virement|vire|signe|signer|supprime|supprimer|envoie|envoyer|valide|valider|approuve|approuver|refuse|refuser|annule|annuler|resilie|resilier|denonce|denoncer)\b/.test(q)) return "ELEVE";
  if (q.length <= 60 && /^(quel|quelle|quels|quelles|combien|ou|qui|quand|c est quoi|liste|montre)\b/.test(q)) return "FAIBLE";
  return "NORMAL";
}

/** Une ligne pour la trace et l'écran : ce qu'on sait, pourquoi, et ce que ça commande. */
export function expliquerCalibration(c: Calibration): string {
  return `Certitude : ${LIBELLE_CERTITUDE[c.certitude]} — ${c.motif} → ${LIBELLE_CONDUITE[c.conduite]}`;
}
