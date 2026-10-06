import {
  SEGMENTS, seuilsPourZone, pct, STATUT_LABELS,
  type EtatProduit, type Regles, type RegleProduit, type Segment, type Statut, type ReglePriorite,
} from "./regles";

/**
 * LE MOTEUR DE SEGMENTATION — déterministe, explicable, sans IA (Segmentation Studio).
 *
 * Il reçoit des FAITS (le statut stratégique du praticien, sa zone, ses observations terrain, les
 * dérogations posées à la main) et une VERSION de règles ; il rend, produit par produit, l'état
 * (Non ciblé · En attente · A · B · C · D), le statut H à part, la priorité BU, le nombre de visites
 * par cycle — et, pour chacun, le POURQUOI en phrases.
 *
 * Ce qu'il ne fait jamais :
 *   • transformer une donnée manquante en D (elle reste « En attente ») ;
 *   • traiter H comme un « A++ » (H est un statut, les segments restent visibles à côté) ;
 *   • appliquer une valeur codée en dur (tout vient de la version de règles) ;
 *   • écraser un calcul par une dérogation sans le dire (les deux valeurs restent lisibles).
 *
 * Module PUR — testé sans base.
 */

export interface Observation {
  productId: string | null;
  potentiel: number | null;
  prescriptionsSur10: number | null;
  observeLe: Date;
}

export interface Derogation {
  nature: "CIBLAGE" | "SEGMENT";
  productId: string | null;
  valeur: string;
  motif: string;
  expireLe: Date | null;
}

export interface FaitsPraticien {
  doctorId: string;
  statut: Statut | null;
  zone: string | null;
  observations: Observation[];
  derogations: Derogation[];
  /** Sa spécialité (annuaire) — pour le ciblage par produit. */
  specialiteId?: string | null;
  /** Son établissement (annuaire) — pour l'affinité « établissement » quand la règle l'autorise. */
  institutionId?: string | null;
}

/**
 * CE QUE LE MOTEUR LIT AUTOUR DES RÈGLES — relié, jamais recopié dans la règle :
 *   • les spécialités que chaque produit vise dans la BU (`PromoProductSpecialite`, vide = toutes) ;
 *   • l'affinité calculée par ÉTABLISSEMENT depuis la consommation (Consumption Intelligence).
 * Un cycle le FIGE avec la version de règles.
 */
export interface ContexteSegmentation {
  specialitesParProduit?: Record<string, string[]>;
  nomsSpecialites?: Record<string, string>;
  affiniteEtablissement?: Record<string, Record<string, { valeur: number; periode: string }>>;
  nomsEtablissements?: Record<string, string>;
}

export interface ResultatProduit {
  productId: string;
  rang: number;
  /** Ce qui s'applique (la dérogation, s'il y en a une, sinon le calcul). */
  etat: EtatProduit;
  /** Ce que les règles donnent. */
  calcule: EtatProduit;
  derogation: { valeur: string; motif: string } | null;
  potentiel: number | null;
  affinite: number | null;
  pourquoi: string[];
}

export interface ResultatPraticien {
  doctorId: string;
  cible: boolean;
  h: boolean;
  produits: ResultatProduit[];
  /** « A / B / A » — dans l'ordre du classement. */
  affichage: string;
  priorite: string | null;
  pourquoiPriorite: string;
  visites: number;
  pourquoiVisites: string;
}

const actif = (d: Derogation, maintenant: Date) => !d.expireLe || d.expireLe.getTime() > maintenant.getTime();

/** La valeur la plus récente d'un champ, pour un produit (ou, pour le potentiel, toute observation de la pathologie). */
export function derniere(obs: readonly Observation[], champ: "potentiel" | "prescriptionsSur10", productId: string): { valeur: number; le: Date } | null {
  let best: Observation | null = null;
  for (const o of obs) {
    const v = o[champ];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    // Le potentiel mesure la pathologie : une observation sans produit vaut pour tous ; l'affinité est propre au produit.
    if (champ === "prescriptionsSur10" ? o.productId !== productId : o.productId !== null && o.productId !== productId) continue;
    if (!best || o.observeLe.getTime() > best.observeLe.getTime()) best = o;
  }
  return best ? { valeur: best[champ] as number, le: best.observeLe } : null;
}

/** L'affinité selon la méthode de la règle — null si elle ne se calcule pas. */
export function affiniteDe(r: RegleProduit, potentiel: number | null, sur10: number | null): number | null {
  if (sur10 === null) return null;
  if (r.methodeAffinite === "SUR_10") return sur10 / 10;
  if (potentiel === null) return null;
  return potentiel > 0 ? sur10 / potentiel : 0;
}

function depasse(v: number, seuil: number, comp: ">" | ">="): boolean {
  // Tolérance d'arrondi : 1/10 doit valoir exactement 10 %.
  const eps = 1e-9;
  return comp === ">" ? v > seuil + eps : v >= seuil - eps;
}

/** Le segment d'UN produit, avec sa raison. */
export function segmenterProduit(
  r: RegleProduit, rang: number, f: FaitsPraticien, regles: Regles, maintenant: Date, ctx: ContexteSegmentation = {},
): ResultatProduit {
  const pourquoi: string[] = [];
  const pot = derniere(f.observations, "potentiel", r.productId);
  const s10 = derniere(f.observations, "prescriptionsSur10", r.productId);
  const potentiel = pot?.valeur ?? null;
  const declaree = affiniteDe(r, potentiel, s10?.valeur ?? null);
  const etab = f.institutionId ? ctx.affiniteEtablissement?.[f.institutionId]?.[r.productId] ?? null : null;
  const source = r.sourceAffinite ?? "DECLAREE";
  const parEtab = source === "ETABLISSEMENT" || (source === "DECLAREE_SINON_ETABLISSEMENT" && declaree === null);
  const affinite = parEtab ? etab?.valeur ?? null : declaree;
  const nomEtab = f.institutionId ? ctx.nomsEtablissements?.[f.institutionId] ?? "son établissement" : "son établissement";
  const specialitesVisees = ctx.specialitesParProduit?.[r.productId] ?? [];
  const z = seuilsPourZone(r, f.zone);
  let calcule: EtatProduit;
  if (f.statut && regles.ciblage.statutsNonCibles.includes(f.statut)) {
    calcule = "NON_CIBLE";
    pourquoi.push(`Statut ${STATUT_LABELS[f.statut]} : non ciblé par les règles.`);
  } else if (specialitesVisees.length > 0 && !f.specialiteId) {
    calcule = "EN_ATTENTE";
    pourquoi.push("Le produit vise certaines spécialités et celle du praticien n'est pas renseignée dans l'annuaire : en attente.");
  } else if (specialitesVisees.length > 0 && f.specialiteId && !specialitesVisees.includes(f.specialiteId)) {
    calcule = "NON_CIBLE";
    pourquoi.push(`Spécialité ${ctx.nomsSpecialites?.[f.specialiteId] ?? "du praticien"} non visée par ce produit (${specialitesVisees.map((s) => ctx.nomsSpecialites?.[s] ?? s).join(", ")}).`);
  } else if (potentiel === null) {
    calcule = "EN_ATTENTE";
    pourquoi.push(`Potentiel (${r.metrique}) non renseigné : en attente — jamais classé D faute de donnée.`);
  } else if (potentiel === 0 && regles.ciblage.potentielNulNonCible) {
    calcule = "NON_CIBLE";
    pourquoi.push(`Potentiel déclaré à 0 (${r.metrique}) : ne consulte pas, non ciblé.`);
  } else if (affinite === null) {
    calcule = "EN_ATTENTE";
    pourquoi.push(parEtab
      ? `Potentiel ${potentiel} ; affinité de ${nomEtab} non calculée (aucune consommation importée) : en attente.`
      : `Potentiel ${potentiel} ; affinité non renseignée : en attente.`);
  } else {
    if (parEtab && etab) pourquoi.push(`Affinité : proxy établissement — ${nomEtab}, ${pct(etab.valeur)} (${etab.periode}), règle explicite de la BU.`);
    const haut = potentiel >= z.seuilPotentiel;
    const affin = depasse(affinite, z.seuilAffinite, z.comparaisonAffinite);
    calcule = haut ? (affin ? "A" : "B") : affin ? "C" : "D";
    const zoneTxt = z.exception ? ` (exception ${z.exception})` : "";
    pourquoi.push(`Potentiel ${potentiel} ${haut ? "≥" : "<"} ${z.seuilPotentiel}${zoneTxt} → ${haut ? "haut" : "faible"} potentiel.`);
    pourquoi.push(`Affinité ${pct(affinite)} ${affin ? (z.comparaisonAffinite === ">" ? ">" : "≥") : (z.comparaisonAffinite === ">" ? "≤" : "<")} ${pct(z.seuilAffinite)}${zoneTxt} → ${affin ? "haute" : "faible"} affinité.`);
    pourquoi.push(`Donc ${calcule}.`);
  }
  const d = f.derogations.find((x) => x.nature === "SEGMENT" && x.productId === r.productId && actif(x, maintenant) && (SEGMENTS as readonly string[]).includes(x.valeur));
  if (d) pourquoi.push(`Dérogation : ${d.valeur} au lieu de ${calcule} — ${d.motif}`);
  return {
    productId: r.productId, rang, calcule, etat: d ? (d.valeur as Segment) : calcule,
    derogation: d ? { valeur: d.valeur, motif: d.motif } : null, potentiel, affinite, pourquoi,
  };
}

function regleCorrespond(r: ReglePriorite, segs: (Segment | null)[]): boolean {
  const connus = segs.filter((s): s is Segment => s !== null);
  if (r.auMoins && connus.filter((s) => s === r.auMoins!.segment).length < r.auMoins.nombre) return false;
  if (r.combinaison) {
    if (connus.length !== segs.length || r.combinaison.length !== connus.length) return false;
    const a = [...r.combinaison].sort().join(""), b = [...connus].sort().join("");
    if (a !== b) return false;
  }
  if (r.rang1 && (segs[0] === null || !r.rang1.includes(segs[0]))) return false;
  return true;
}

export function libelleRegle(r: ReglePriorite): string {
  const parts: string[] = [];
  if (r.auMoins) parts.push(`au moins ${r.auMoins.nombre} produit${r.auMoins.nombre > 1 ? "s" : ""} en ${r.auMoins.segment}`);
  if (r.combinaison) parts.push(`exactement ${r.combinaison.join(" + ")}`);
  if (r.rang1) parts.push(`produit #1 en ${r.rang1.join(" ou ")}`);
  return `Si ${parts.join(" et ")} → ${r.priorite}`;
}

/** La priorité BU depuis les segments classés : règle explicite d'abord, score de repli ensuite. */
export function prioriteDe(segs: (Segment | null)[], regles: Regles): { priorite: string | null; pourquoi: string } {
  if (segs.every((s) => s === null)) return { priorite: null, pourquoi: "Aucun segment connu : pas de priorité." };
  const r = regles.priorites.regles.find((x) => regleCorrespond(x, segs));
  const vu = segs.map((s) => s ?? "—").join(" / ");
  if (r) return { priorite: r.priorite, pourquoi: `${vu} — règle : ${libelleRegle(r)}.` };
  const rp = regles.priorites.repli;
  if (!rp) return { priorite: null, pourquoi: `${vu} — aucune règle ne s'applique et aucun score de repli n'est défini.` };
  let somme = 0, poids = 0;
  segs.forEach((s, i) => { if (s) { const w = rp.poidsParRang[i] ?? rp.poidsParRang[rp.poidsParRang.length - 1]; somme += rp.scores[s] * w; poids += w; } });
  const score = poids > 0 ? somme / poids : 0;
  const palier = rp.paliers.find((p) => score >= p.min - 1e-9);
  if (!palier) return { priorite: null, pourquoi: `${vu} — score ${score.toFixed(2)} sous tous les paliers.` };
  return { priorite: palier.priorite, pourquoi: `${vu} — aucune règle explicite ; score pondéré ${score.toFixed(2)} ≥ ${palier.min} → ${palier.priorite}.` };
}

/** Le résultat complet d'un praticien pour une stratégie. */
export function segmenterPraticien(f: FaitsPraticien, regles: Regles, maintenant: Date = new Date(), ctx: ContexteSegmentation = {}): ResultatPraticien {
  const produits = regles.produits.map((r, i) => segmenterProduit(r, i + 1, f, regles, maintenant, ctx));
  const h = !!f.statut && regles.h.statuts.includes(f.statut);
  const dc = f.derogations.find((x) => x.nature === "CIBLAGE" && actif(x, maintenant));
  const segs = produits.map((p) => ((SEGMENTS as readonly string[]).includes(p.etat) ? (p.etat as Segment) : null));
  const toutNonCible = produits.every((p) => p.etat === "NON_CIBLE");
  let cible: boolean;
  if (dc) cible = dc.valeur === "CIBLE";
  else cible = h || !toutNonCible;
  const { priorite, pourquoi: pourquoiPriorite } = cible ? prioriteDe(segs, regles) : { priorite: null, pourquoi: "Non ciblé : pas de priorité." };
  let visites = 0;
  let pourquoiVisites: string;
  if (!cible) {
    pourquoiVisites = dc ? `Non ciblé par décision : ${dc.motif}` : "Non ciblé : aucune visite requise.";
  } else {
    const fp = priorite ? regles.frequences[priorite] ?? 0 : 0;
    if (h && regles.h.frequence >= fp) { visites = regles.h.frequence; pourquoiVisites = `Décideur (H) : ${visites} visite${visites > 1 ? "s" : ""} par cycle${priorite ? ` (la priorité ${priorite} en demanderait ${fp})` : ""}.`; }
    else if (priorite) { visites = fp; pourquoiVisites = `Priorité ${priorite} : ${fp} visite${fp > 1 ? "s" : ""} par cycle.`; }
    else pourquoiVisites = "Ciblé, mais sans priorité calculable (données en attente) : 0 visite requise tant que le potentiel manque.";
  }
  return {
    doctorId: f.doctorId, cible, h, produits, priorite, pourquoiPriorite, visites, pourquoiVisites,
    affichage: produits.map((p) => (p.etat === "NON_CIBLE" ? "NC" : p.etat === "EN_ATTENTE" ? "?" : p.etat)).join(" / "),
  };
}

export interface ChangementImpact {
  doctorId: string;
  productId: string | null;
  avant: string;
  apres: string;
}

/**
 * L'IMPACT d'une nouvelle version de règles AVANT de la publier : chaque segment, priorité ou nombre de
 * visites qui changerait, praticien par praticien. Rien n'est écrit — c'est l'aperçu que la publication montre.
 */
export function impactDesRegles(faits: readonly FaitsPraticien[], avant: Regles, apres: Regles, maintenant: Date = new Date(), ctx: ContexteSegmentation = {}): { changements: ChangementImpact[]; praticiens: number } {
  const changements: ChangementImpact[] = [];
  const touches = new Set<string>();
  for (const f of faits) {
    const a = segmenterPraticien(f, avant, maintenant, ctx), b = segmenterPraticien(f, apres, maintenant, ctx);
    const ids = new Set([...a.produits.map((p) => p.productId), ...b.produits.map((p) => p.productId)]);
    for (const id of ids) {
      const x = a.produits.find((p) => p.productId === id)?.etat ?? "—";
      const y = b.produits.find((p) => p.productId === id)?.etat ?? "—";
      if (x !== y) { changements.push({ doctorId: f.doctorId, productId: id, avant: x, apres: y }); touches.add(f.doctorId); }
    }
    if ((a.priorite ?? "—") !== (b.priorite ?? "—")) { changements.push({ doctorId: f.doctorId, productId: null, avant: `Priorité ${a.priorite ?? "—"}`, apres: `Priorité ${b.priorite ?? "—"}` }); touches.add(f.doctorId); }
    if (a.visites !== b.visites) { changements.push({ doctorId: f.doctorId, productId: null, avant: `${a.visites} visite(s)`, apres: `${b.visites} visite(s)` }); touches.add(f.doctorId); }
  }
  return { changements, praticiens: touches.size };
}

export interface Synthese {
  praticiens: number;
  cibles: number;
  h: number;
  parProduit: Record<string, Record<EtatProduit, number>>;
  parPriorite: Record<string, number>;
  visitesRequises: number;
}

/** Les compteurs du cockpit — calculés sur les mêmes résultats que la liste, jamais à part. */
export function synthese(resultats: readonly ResultatPraticien[]): Synthese {
  const s: Synthese = { praticiens: resultats.length, cibles: 0, h: 0, parProduit: {}, parPriorite: {}, visitesRequises: 0 };
  for (const r of resultats) {
    if (r.cible) s.cibles++;
    if (r.h) s.h++;
    s.visitesRequises += r.visites;
    if (r.priorite) s.parPriorite[r.priorite] = (s.parPriorite[r.priorite] ?? 0) + 1;
    for (const p of r.produits) {
      const m = (s.parProduit[p.productId] ??= { NON_CIBLE: 0, EN_ATTENTE: 0, A: 0, B: 0, C: 0, D: 0 });
      m[p.etat]++;
    }
  }
  return s;
}
