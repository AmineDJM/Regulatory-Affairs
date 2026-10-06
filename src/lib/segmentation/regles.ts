/**
 * LES RÈGLES DE SEGMENTATION — leur forme, et leur lecture sûre depuis la base (Segmentation Studio).
 *
 * Une version de règles est IMMUABLE (table `SegmentationRegle`) ; son contenu est ce JSON. Rien n'y est
 * codé en dur : ni « 22 patients », ni « 10 % », ni « 2 visites » — chaque valeur vient d'une version
 * publiée (par une personne, ou proposée par l'import d'un classeur puis publiée). `lireRegles` refuse un
 * contenu incohérent plutôt que de deviner une valeur manquante.
 *
 * Module PUR, zéro import : le moteur, l'import, les écrans et les tests lisent la même forme.
 */

export const SEGMENTS = ["A", "B", "C", "D"] as const;
export type Segment = (typeof SEGMENTS)[number];

/** L'état d'un praticien pour UN produit. Une donnée manquante est EN_ATTENTE — jamais D. */
export type EtatProduit = "NON_CIBLE" | "EN_ATTENTE" | Segment;

export const STATUTS = ["DECIDEUR", "INFLUENCEUR", "REFERENT", "PRESCRIPTEUR"] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABELS: Record<Statut, string> = {
  DECIDEUR: "Décideur", INFLUENCEUR: "Influenceur", REFERENT: "Référent", PRESCRIPTEUR: "Prescripteur",
};

export const ETAT_LABELS: Record<EtatProduit, string> = {
  NON_CIBLE: "Non ciblé", EN_ATTENTE: "En attente de données", A: "A", B: "B", C: "C", D: "D",
};

export type Comparaison = ">" | ">=";

/**
 * Comment l'AFFINITÉ se calcule à partir de ce que le terrain a déclaré :
 *   • SUR_10 — « sur 10 patients, combien sous le produit » ÷ 10 : la part du produit chez ce praticien ;
 *   • RATIO_FICHIER — la méthode du classeur historique : (sur 10) ÷ (patients par semaine). Gardée pour
 *     reproduire les classements existants ; elle mélange deux unités, d'où le choix laissé à la Direction.
 */
export type MethodeAffinite = "SUR_10" | "RATIO_FICHIER";
export const METHODE_LABELS: Record<MethodeAffinite, string> = {
  SUR_10: "Part du produit (sur 10 patients ÷ 10)",
  RATIO_FICHIER: "Méthode du classeur (sur 10 ÷ patients par semaine)",
};

export interface ExceptionZone {
  zone: string;
  seuilPotentiel?: number;
  seuilAffinite?: number;
  comparaisonAffinite?: Comparaison;
}

export interface RegleProduit {
  productId: string;
  /** Ce que mesure le potentiel — « patients VIH / semaine ». Affiché tel quel. */
  metrique: string;
  /** Haut potentiel si potentiel ≥ seuil. */
  seuilPotentiel: number;
  /** Haute affinité si affinité (fraction 0..1) dépasse le seuil selon `comparaisonAffinite`. */
  seuilAffinite: number;
  comparaisonAffinite: Comparaison;
  methodeAffinite: MethodeAffinite;
  exceptions: ExceptionZone[];
}

/** « Au moins N produits en A », « exactement A + B + B », « produit #1 en A ». Évaluées dans l'ordre. */
export interface ReglePriorite {
  priorite: string;
  auMoins?: { segment: Segment; nombre: number };
  combinaison?: Segment[];
  rang1?: Segment[];
}

export interface ReplisPriorite {
  scores: Record<Segment, number>;
  /** Poids du produit #1, #2, #3. */
  poidsParRang: number[];
  /** Score moyen pondéré ≥ min → priorité ; lus du plus haut au plus bas. */
  paliers: { min: number; priorite: string }[];
}

export interface Regles {
  produits: RegleProduit[];
  ciblage: {
    /** Statuts qui ne sont pas ciblés (ex. aucun par défaut). */
    statutsNonCibles: Statut[];
    /** Un potentiel DÉCLARÉ à zéro (« ne consulte pas ») rend le praticien non ciblé pour ce produit. */
    potentielNulNonCible: boolean;
  };
  /** H = décideur stratégique : SÉPARÉ de A/B/C/D, avec sa propre fréquence. */
  h: { statuts: Statut[]; frequence: number };
  priorites: { regles: ReglePriorite[]; repli: ReplisPriorite | null };
  /** Visites par cycle et par priorité (0,5 = une visite tous les deux cycles). */
  frequences: Record<string, number>;
}

export type LectureRegles = { ok: true; regles: Regles } | { ok: false; erreurs: string[] };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const estSegment = (v: unknown): v is Segment => typeof v === "string" && (SEGMENTS as readonly string[]).includes(v);
const estStatut = (v: unknown): v is Statut => typeof v === "string" && (STATUTS as readonly string[]).includes(v);

/** Lit et VALIDE un contenu de règles. Une valeur absente ou fausse est une erreur nommée — jamais un défaut inventé. */
export function lireRegles(brut: unknown): LectureRegles {
  const e: string[] = [];
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const produitsBruts = Array.isArray(o.produits) ? o.produits : [];
  if (produitsBruts.length === 0) e.push("Aucun produit n'a de règle.");
  if (produitsBruts.length > 3) e.push("Une stratégie classe au plus trois produits.");
  const produits: RegleProduit[] = [];
  const vus = new Set<string>();
  produitsBruts.forEach((p, i) => {
    const r = (p ?? {}) as Record<string, unknown>;
    const nom = `Produit #${i + 1}`;
    const productId = typeof r.productId === "string" ? r.productId : "";
    if (!productId) e.push(`${nom} : produit non désigné.`);
    if (vus.has(productId)) e.push(`${nom} : produit déjà présent.`);
    vus.add(productId);
    const seuilPotentiel = num(r.seuilPotentiel);
    const seuilAffinite = num(r.seuilAffinite);
    if (seuilPotentiel === null || seuilPotentiel < 0) e.push(`${nom} : seuil de potentiel manquant.`);
    if (seuilAffinite === null || seuilAffinite < 0 || seuilAffinite > 1) e.push(`${nom} : seuil d'affinité manquant (entre 0 et 100 %).`);
    const comparaisonAffinite: Comparaison = r.comparaisonAffinite === ">=" ? ">=" : ">";
    const methodeAffinite: MethodeAffinite = r.methodeAffinite === "RATIO_FICHIER" ? "RATIO_FICHIER" : "SUR_10";
    const exceptions: ExceptionZone[] = (Array.isArray(r.exceptions) ? r.exceptions : []).flatMap((x) => {
      const z = (x ?? {}) as Record<string, unknown>;
      const zone = typeof z.zone === "string" ? z.zone.trim() : "";
      if (!zone) return [];
      const sp = num(z.seuilPotentiel), sa = num(z.seuilAffinite);
      return [{
        zone,
        ...(sp !== null ? { seuilPotentiel: sp } : {}),
        ...(sa !== null ? { seuilAffinite: sa } : {}),
        ...(z.comparaisonAffinite === ">=" || z.comparaisonAffinite === ">" ? { comparaisonAffinite: z.comparaisonAffinite as Comparaison } : {}),
      }];
    });
    produits.push({
      productId, metrique: typeof r.metrique === "string" && r.metrique.trim() ? r.metrique.trim() : "patients / semaine",
      seuilPotentiel: seuilPotentiel ?? 0, seuilAffinite: seuilAffinite ?? 0, comparaisonAffinite, methodeAffinite, exceptions,
    });
  });
  const c = (o.ciblage ?? {}) as Record<string, unknown>;
  const ciblage = {
    statutsNonCibles: (Array.isArray(c.statutsNonCibles) ? c.statutsNonCibles : []).filter(estStatut),
    potentielNulNonCible: c.potentielNulNonCible !== false,
  };
  const h0 = (o.h ?? {}) as Record<string, unknown>;
  const hFreq = num(h0.frequence);
  if (hFreq === null || hFreq < 0) e.push("Fréquence des décideurs (H) manquante.");
  const h = { statuts: (Array.isArray(h0.statuts) ? h0.statuts : []).filter(estStatut), frequence: hFreq ?? 0 };
  const p0 = (o.priorites ?? {}) as Record<string, unknown>;
  const reglesPrio: ReglePriorite[] = (Array.isArray(p0.regles) ? p0.regles : []).flatMap((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    const priorite = typeof r.priorite === "string" ? r.priorite.trim() : "";
    if (!priorite) return [];
    const am = (r.auMoins ?? null) as Record<string, unknown> | null;
    const out: ReglePriorite = { priorite };
    if (am && estSegment(am.segment) && num(am.nombre) !== null) out.auMoins = { segment: am.segment, nombre: num(am.nombre)! };
    if (Array.isArray(r.combinaison) && r.combinaison.every(estSegment)) out.combinaison = r.combinaison as Segment[];
    if (Array.isArray(r.rang1) && r.rang1.every(estSegment)) out.rang1 = r.rang1 as Segment[];
    if (!out.auMoins && !out.combinaison && !out.rang1) { e.push(`Règle de priorité « ${priorite} » sans condition.`); return []; }
    return [out];
  });
  let repli: ReplisPriorite | null = null;
  if (p0.repli && typeof p0.repli === "object") {
    const r = p0.repli as Record<string, unknown>;
    const s = (r.scores ?? {}) as Record<string, unknown>;
    const scores = { A: num(s.A), B: num(s.B), C: num(s.C), D: num(s.D) };
    const poids = (Array.isArray(r.poidsParRang) ? r.poidsParRang : []).map(num);
    const paliers = (Array.isArray(r.paliers) ? r.paliers : []).flatMap((x) => {
      const z = (x ?? {}) as Record<string, unknown>;
      return num(z.min) !== null && typeof z.priorite === "string" && z.priorite.trim() ? [{ min: num(z.min)!, priorite: z.priorite.trim() }] : [];
    });
    if (Object.values(scores).some((v) => v === null) || poids.some((v) => v === null) || poids.length === 0 || paliers.length === 0) e.push("Score de repli incomplet.");
    else repli = { scores: scores as Record<Segment, number>, poidsParRang: poids as number[], paliers: [...paliers].sort((a, b) => b.min - a.min) };
  }
  const f0 = (o.frequences ?? {}) as Record<string, unknown>;
  const frequences: Record<string, number> = {};
  for (const [k, v] of Object.entries(f0)) { const n = num(v); if (n !== null && n >= 0) frequences[k] = n; }
  for (const r of reglesPrio) if (frequences[r.priorite] === undefined) e.push(`Fréquence de la priorité « ${r.priorite} » manquante.`);
  if (repli) for (const p of repli.paliers) if (frequences[p.priorite] === undefined) e.push(`Fréquence de la priorité « ${p.priorite} » manquante.`);
  if (e.length) return { ok: false, erreurs: [...new Set(e)] };
  return { ok: true, regles: { produits, ciblage, h, priorites: { regles: reglesPrio, repli }, frequences } };
}

/** Les seuils effectifs d'un produit pour une ZONE (l'exception de la zone l'emporte, champ par champ). */
export function seuilsPourZone(r: RegleProduit, zone: string | null | undefined): { seuilPotentiel: number; seuilAffinite: number; comparaisonAffinite: Comparaison; exception: string | null } {
  const cle = (zone ?? "").trim().toLowerCase();
  const x = cle ? r.exceptions.find((e) => e.zone.trim().toLowerCase() === cle) : undefined;
  return {
    seuilPotentiel: x?.seuilPotentiel ?? r.seuilPotentiel,
    seuilAffinite: x?.seuilAffinite ?? r.seuilAffinite,
    comparaisonAffinite: x?.comparaisonAffinite ?? r.comparaisonAffinite,
    exception: x ? x.zone : null,
  };
}

/** « 10 % », « 7,5 % » — l'affichage d'une fraction. */
export function pct(v: number): string {
  const n = Math.round(v * 1000) / 10;
  return `${String(n).replace(".", ",")} %`;
}
