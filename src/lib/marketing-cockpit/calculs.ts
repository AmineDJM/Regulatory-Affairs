import type { EtatProduit, Lettre } from "@/lib/segmentation/regles";
import type { ResultatPraticien } from "@/lib/segmentation/moteur";

/**
 * MARKETING COCKPIT — les calculs PURS (Direction, 07/10 — maquette validée « Le principe »).
 *
 * Le cockpit ne saisit rien : il LIT l'annuaire, la segmentation (la lettre H, A–D et la fréquence requise), les visites
 * de la Force de vente, les messages portés, Ad & Pro et les budgets — et il les rapporte les uns aux autres. Ces
 * fonctions reçoivent des faits déjà lus et rendent des chiffres ; elles ne touchent ni base ni session (testées seules).
 */

export const LETTRES_CIBLES: readonly Lettre[] = ["H", "A", "B"];
export const LETTRES_COMPTEES: readonly Lettre[] = ["H", "A", "B", "C", "D"];
const SEGMENTS_AFFINITE: readonly EtatProduit[] = ["A", "C"];

export const estCible = (l: Lettre | null | undefined): boolean => !!l && LETTRES_CIBLES.includes(l);

/**
 * LA LETTRE D'UN PRATICIEN POUR UN PRODUIT. Le moteur rend la lettre du produit #1 de la stratégie (`lettre`) ; pour un
 * autre produit classé, la lettre se lit sur SON segment — H restant un statut qui prime, « non ciblé » un ciblage.
 * Un produit que la stratégie ne classe pas garde la lettre de la BU (produit #1).
 */
export function lettrePourProduit(r: ResultatPraticien | null | undefined, productId: string | null): Lettre {
  if (!r) return "NA";
  const p = productId ? r.produits.find((x) => x.productId === productId) : undefined;
  if (!p || p.rang === 1) return r.lettre;
  if (!r.cible) return "NC";
  if (r.h) return "H";
  return p.etat === "NON_CIBLE" ? "NC" : p.etat === "EN_ATTENTE" ? "NA" : p.etat;
}

/** Le SEGMENT (A, B, C, D, en attente, non ciblé) du praticien pour un produit — le produit #1 à défaut. */
export function segmentPourProduit(r: ResultatPraticien | null | undefined, productId: string | null): EtatProduit | null {
  if (!r) return null;
  const p = (productId ? r.produits.find((x) => x.productId === productId) : undefined) ?? r.produits[0];
  return p?.etat ?? null;
}

/** Les deux réponses (Q1 potentiel, Q2 affinité) sont-elles là pour ce produit ? */
export function aSesDeuxReponses(r: ResultatPraticien | null | undefined, productId: string | null): boolean {
  if (!r) return false;
  const p = (productId ? r.produits.find((x) => x.productId === productId) : undefined) ?? r.produits[0];
  return !!p && p.potentiel !== null && p.affinite !== null;
}

/** La fréquence est-elle tenue ? Une cible sans fréquence publiée doit au moins avoir été vue. */
export function frequenceTenue(faites: number, requises: number): boolean {
  return requises > 0 ? faites >= Math.ceil(requises - 1e-9) : faites >= 1;
}

export interface PraticienCockpit {
  doctorId: string;
  lettre: Lettre;
  segment: EtatProduit | null;
  /** Q1 et Q2 présents pour le produit. */
  deuxReponses: boolean;
  /** Visites requises par cycle (moteur de segmentation). */
  requises: number;
  /** Visites TERMINÉES dans la fenêtre du cycle (Force de vente). */
  faitesCycle: number;
}

export interface Entonnoir {
  annuaire: number;
  segmentes: number;
  cibles: number;
  vus: number;
  aFrequence: number;
  affinite: number;
}

/**
 * DE L'ANNUAIRE À LA PRESCRIPTION — à partir de « Ciblés », chaque marche est un sous-ensemble de la précédente.
 * « Segmentés » compte le panel où Q1 et Q2 sont renseignés (il peut déborder l'annuaire visé : un praticien d'une
 * autre spécialité rangé à la main) — le chiffre est donné tel quel, jamais raboté.
 */
export function entonnoir(annuaire: number, praticiens: readonly PraticienCockpit[]): Entonnoir {
  const cibles = praticiens.filter((p) => estCible(p.lettre));
  const vus = cibles.filter((p) => p.faitesCycle >= 1);
  const aFrequence = cibles.filter((p) => frequenceTenue(p.faitesCycle, p.requises));
  return {
    annuaire,
    segmentes: praticiens.filter((p) => p.deuxReponses).length,
    cibles: cibles.length,
    vus: vus.length,
    aFrequence: aFrequence.length,
    affinite: aFrequence.filter((p) => p.segment === "A").length,
  };
}

/** « Cibles H · A · B vues à fréquence » — null quand il n'y a aucune cible. */
export function couvertureFrequence(praticiens: readonly PraticienCockpit[]): { cibles: number; tenues: number; taux: number | null } {
  const cibles = praticiens.filter((p) => estCible(p.lettre));
  const tenues = cibles.filter((p) => frequenceTenue(p.faitesCycle, p.requises)).length;
  return { cibles: cibles.length, tenues, taux: cibles.length ? tenues / cibles.length : null };
}

/** « Prescripteurs avec affinité » : segment A ou C pour le produit (haute affinité, quel que soit le potentiel). */
export function prescripteursAvecAffinite(segments: readonly (EtatProduit | null)[]): number {
  return segments.filter((s) => !!s && SEGMENTS_AFFINITE.includes(s)).length;
}

/**
 * LA LETTRE FIGÉE PAR UN CYCLE — l'instantané garde, par praticien, `affichage` (« A / B / ? », dans l'ordre des
 * produits classés), `h` et `cible`. On relit la lettre du produit voulu, sans recalculer quoi que ce soit.
 */
export function lettreFigee(p: { h: boolean; cible: boolean; affichage: string }, indexProduit: number): { lettre: Lettre; segment: EtatProduit | null } {
  const parts = p.affichage.split("/").map((x) => x.trim());
  const brut = parts[Math.max(0, indexProduit)] ?? parts[0] ?? "";
  const segment: EtatProduit | null = brut === "NC" ? "NON_CIBLE" : brut === "?" ? "EN_ATTENTE" : (["A", "B", "C", "D"] as const).find((s) => s === brut) ?? null;
  if (!p.cible) return { lettre: "NC", segment };
  if (p.h) return { lettre: "H", segment };
  return { lettre: segment === "NON_CIBLE" ? "NC" : segment === "EN_ATTENTE" || segment === null ? "NA" : segment, segment };
}

/** Combien de praticiens sont PASSÉS en A (segment) entre deux lectures — ceux qui n'étaient pas A avant. */
export function passesEnA(avant: ReadonlyMap<string, EtatProduit | null>, apres: ReadonlyMap<string, EtatProduit | null>): number {
  let n = 0;
  for (const [id, seg] of apres) {
    if (seg !== "A" || !avant.has(id)) continue;
    const a = avant.get(id);
    if (a === "B" || a === "C" || a === "D") n++;
  }
  return n;
}

// ───────────────────────────── Fenêtres de temps ─────────────────────────────

export interface Fenetre { debut: Date; fin: Date }

/** Le mois civil (UTC) qui contient `d`, fin INCLUSE au dernier jour. */
export function moisDe(d: Date): Fenetre {
  return { debut: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), fin: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)) };
}

/** Les `n` derniers mois civils, du plus ancien au mois courant. */
export function moisGlissants(maintenant: Date, n: number): Fenetre[] {
  const out: Fenetre[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(moisDe(new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i, 1))));
  return out;
}

/** La date tombe-t-elle dans la fenêtre (le dernier jour compris en entier) ? */
export function dansFenetre(d: Date, f: Fenetre): boolean {
  return d.getTime() >= f.debut.getTime() && d.getTime() < f.fin.getTime() + 86_400_000;
}

/** La part de l'année civile écoulée (0..1). */
export function partDeLAnnee(d: Date): number {
  const debut = Date.UTC(d.getUTCFullYear(), 0, 1), fin = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  return Math.min(1, Math.max(0, (d.getTime() - debut) / (fin - debut)));
}

/** Jours entiers écoulés depuis une date (null = jamais). */
export function joursDepuis(d: Date | null, maintenant: Date): number | null {
  return d ? Math.max(0, Math.floor((maintenant.getTime() - d.getTime()) / 86_400_000)) : null;
}

// ───────────────────────────── Messages ─────────────────────────────

export interface Portage {
  date: Date;
  doctorId: string | null;
  delegateId: string | null;
}

export interface StatsMessage {
  portesCycle: number;
  /** Lettres des médecins vus quand le message a été porté (ce cycle). */
  parLettre: Partial<Record<Lettre, number>>;
  /** Délégués distincts qui l'ont porté ce cycle. */
  delegues: number;
  /** Portages par mois, du plus ancien au plus récent. */
  tendance: number[];
}

/** L'EFFICACITÉ D'UN MESSAGE : combien de fois porté ce cycle, sur quelles lettres, par combien de délégués, et la pente. */
export function statsMessage(portages: readonly Portage[], cycle: Fenetre, mois: readonly Fenetre[], lettreDe: (doctorId: string) => Lettre | null): StatsMessage {
  const duCycle = portages.filter((p) => dansFenetre(p.date, cycle));
  const parLettre: Partial<Record<Lettre, number>> = {};
  for (const p of duCycle) {
    const l = p.doctorId ? lettreDe(p.doctorId) : null;
    if (l && LETTRES_COMPTEES.includes(l)) parLettre[l] = (parLettre[l] ?? 0) + 1;
  }
  return {
    portesCycle: duCycle.length,
    parLettre,
    delegues: new Set(duCycle.map((p) => p.delegateId).filter(Boolean)).size,
    tendance: mois.map((m) => portages.filter((p) => dansFenetre(p.date, m)).length),
  };
}

/** Un message déjà porté s'ARCHIVE (la cascade effacerait l'historique des visites) ; jamais porté, il se supprime. */
export function retraitDuMessage(usages: number): "ARCHIVER" | "SUPPRIMER" {
  return usages > 0 ? "ARCHIVER" : "SUPPRIMER";
}

/** Le message le moins porté parmi les actifs — porté par moins de la moitié des délégués de la BU. */
export function messagePeuPorte<T extends { actif: boolean; stats: StatsMessage }>(messages: readonly T[], delegues: number): T | null {
  if (delegues < 2) return null;
  const faibles = messages.filter((m) => m.actif && m.stats.delegues < delegues / 2);
  return faibles.sort((a, b) => a.stats.portesCycle - b.stats.portesCycle)[0] ?? null;
}

// ───────────────────────────── Investissements ─────────────────────────────

export const NATURES_AD_PRO = ["CONGRES", "SPONSORING", "EVENEMENTS", "MATERIEL"] as const;
export type NatureAdPro = (typeof NATURES_AD_PRO)[number];
export const NATURE_LABELS: Record<NatureAdPro, string> = {
  CONGRES: "Congrès (prises en charge)",
  SPONSORING: "Sponsoring",
  EVENEMENTS: "Événements",
  MATERIEL: "Matériel promotionnel",
};

export interface Depense {
  nature: NatureAdPro;
  /** Montant engagé attribué au périmètre (produit ou BU). */
  montant: number;
  /** Lettres des praticiens NOMMÉS par la demande (null = nommé mais hors panel). Vide = non nominatif. */
  lettres: (Lettre | null)[];
}

export interface LigneNature {
  nature: NatureAdPro;
  engage: number;
  /** La part du montant portée par des demandes nominatives. */
  nominatif: number;
  /** Part du nominatif allant à des H · A · B (0..1) — null si rien de nominatif. */
  partCibles: number | null;
  /** Part du nominatif allant à des C · D (0..1) — null si rien de nominatif. */
  partCD: number | null;
  /** Coût par cible H · A · B du périmètre — null sans cible. */
  parCible: number | null;
}

/**
 * OÙ VA L'ARGENT : par nature, l'engagé, et — quand la demande NOMME des praticiens — la part qui va aux cibles
 * H · A · B (au prorata des personnes nommées). Une demande sans nom (matériel, sponsoring d'un service) ne compte
 * pas dans la part : elle n'est ni bonne ni mauvaise, elle est non nominative, et l'écran le dit.
 */
export function repartitionDepenses(depenses: readonly Depense[], nbCibles: number): { lignes: LigneNature[]; total: number; partCDCongresEvenements: number | null } {
  const lignes = NATURES_AD_PRO.map((nature): LigneNature => {
    const d = depenses.filter((x) => x.nature === nature);
    let engage = 0, nominatif = 0, surCibles = 0, surCD = 0;
    for (const x of d) {
      engage += x.montant;
      if (x.lettres.length === 0) continue;
      nominatif += x.montant;
      surCibles += x.montant * (x.lettres.filter((l) => estCible(l)).length / x.lettres.length);
      surCD += x.montant * (x.lettres.filter((l) => l === "C" || l === "D").length / x.lettres.length);
    }
    return {
      nature, engage, nominatif,
      partCibles: nominatif > 0 ? surCibles / nominatif : null,
      partCD: nominatif > 0 ? surCD / nominatif : null,
      parCible: nbCibles > 0 && engage > 0 ? engage / nbCibles : null,
    };
  });
  const ce = lignes.filter((l) => l.nature === "CONGRES" || l.nature === "EVENEMENTS");
  const nomCE = ce.reduce((s, l) => s + l.nominatif, 0);
  const cdCE = ce.reduce((s, l) => s + l.nominatif * (l.partCD ?? 0), 0);
  return { lignes, total: lignes.reduce((s, l) => s + l.engage, 0), partCDCongresEvenements: nomCE > 0 ? cdCE / nomCE : null };
}

/** La part d'un poste Ad & Pro imputée au produit : montant saisi, sinon part du montant ; sans imputation, null. */
export function partImputee(montant: number, imputations: readonly { productId: string; pct: number | null; montant: number | null }[], productId: string): number | null {
  const i = imputations.find((x) => x.productId === productId);
  if (!i) return null;
  if (i.montant !== null) return i.montant;
  if (i.pct !== null) return montant * (i.pct / 100);
  return null;
}

// ───────────────────────────── Marché ─────────────────────────────

export interface LigneSerie { cle: string; nom: string; nous: boolean; parts: (number | null)[] }

/**
 * LES PARTS MENSUELLES d'un marché, acteur par acteur : pour chaque mois, la valeur de l'acteur ÷ la valeur du
 * marché ce mois-là. On garde « nous » (s'il est présent) et les `top` premiers concurrents sur la période.
 * Un mois sans aucune réception donne `null` (un trou, pas un zéro).
 */
export function partsMensuelles(
  lignes: readonly { mois: string; cle: string; nom: string; valeur: number }[],
  mois: readonly string[],
  nous: ReadonlySet<string>,
  top = 2,
): LigneSerie[] {
  const totalMois = new Map<string, number>();
  const parCle = new Map<string, { nom: string; total: number; parMois: Map<string, number> }>();
  for (const l of lignes) {
    if (!(l.valeur > 0)) continue;
    totalMois.set(l.mois, (totalMois.get(l.mois) ?? 0) + l.valeur);
    const a = parCle.get(l.cle) ?? { nom: l.nom, total: 0, parMois: new Map<string, number>() };
    a.total += l.valeur;
    a.parMois.set(l.mois, (a.parMois.get(l.mois) ?? 0) + l.valeur);
    if (l.nom.length < a.nom.length) a.nom = l.nom;
    parCle.set(l.cle, a);
  }
  const serie = (cle: string, a: { nom: string; parMois: Map<string, number> }, estNous: boolean): LigneSerie => ({
    cle, nom: a.nom, nous: estNous,
    parts: mois.map((m) => { const t = totalMois.get(m); return t ? (a.parMois.get(m) ?? 0) / t : null; }),
  });
  const nosLignes = [...parCle].filter(([cle]) => nous.has(cle)).map(([cle, a]) => serie(cle, a, true));
  const autres = [...parCle].filter(([cle]) => !nous.has(cle)).sort((x, y) => y[1].total - x[1].total).slice(0, top).map(([cle, a]) => serie(cle, a, false));
  return [...nosLignes, ...autres];
}

/** Évolution d'une valeur entre deux périodes (−0,12 = −12 %) — null si la base est nulle. */
export function evolution(avant: number, apres: number): number | null {
  return avant > 0 ? apres / avant - 1 : null;
}

// ───────────────────────────── Formats ─────────────────────────────

export const pourcent = (x: number | null, decimales = 0): string =>
  x === null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(decimales).replace(".", ",")} %`;

export const montantDzd = (n: number): string => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");

/** Les points d'une petite courbe (SVG `polyline`) — l'axe vertical inversé, une série plate au milieu. */
export function pointsSparkline(valeurs: readonly number[], largeur = 70, hauteur = 20, marge = 3): string {
  if (valeurs.length === 0) return "";
  const max = Math.max(...valeurs), min = Math.min(...valeurs);
  const pas = valeurs.length > 1 ? largeur / (valeurs.length - 1) : 0;
  return valeurs
    .map((v, i) => {
      const y = max === min ? hauteur / 2 : hauteur - marge - ((v - min) / (max - min)) * (hauteur - 2 * marge);
      return `${Math.round(i * pas * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}
