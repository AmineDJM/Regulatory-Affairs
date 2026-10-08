/**
 * LES BESOINS ANNUELS DES SERVICES — la règle, PURE (aucun import), testée sans base.
 *
 * En marché d'appels d'offres, la PCH répartit entre les gagnants : la part de réceptions ne mesure pas l'effort
 * marketing. Ce qui fixe le volume de l'AO, ce sont les PRÉVISIONS que chaque service exprime — et c'est le décideur (H)
 * qui les fixe. Le KAM saisit le besoin annoncé à la visite du décideur (« Besoin annuel du service », facultatif, un
 * champ par produit) ; le cockpit marketing le montre et le laisse corriger.
 *
 * QUI ÉCRIT : le KAM pour SON panel (le décideur doit lui être ouvert) ; la Direction Marketing, le chef de produit et
 * la Direction pour tous. Un besoin se saisit en BOÎTES, entier, positif ; zéro est une réponse (« ne commandera pas »).
 */

export const QUANTITE_MAX = 10_000_000;

/** L'année que le décideur annonce : celle qui vient (l'AO se prépare l'année d'avant). */
export const anneeDuBesoin = (maintenant: Date): number => maintenant.getFullYear() + 1;

/** « 6 000 », « 4 200 boîtes » — lu tel qu'un humain l'écrit (espaces, espaces fines, points de milliers). */
export function lireQuantite(brut: unknown): { ok: true; valeur: number | null } | { ok: false; error: string } {
  if (brut === null || brut === undefined) return { ok: true, valeur: null };
  const t = String(brut).replace(/[\s  .]/g, "").replace(/bo[iî]tes?$/i, "");
  if (!t) return { ok: true, valeur: null };
  if (!/^\d+$/.test(t)) return { ok: false, error: `« ${String(brut).trim()} » n'est pas un nombre de boîtes entier.` };
  const n = Number(t);
  if (n > QUANTITE_MAX) return { ok: false, error: `${n.toLocaleString("fr-FR")} boîtes : la valeur paraît fausse.` };
  return { ok: true, valeur: n };
}

export interface BesoinLu { productId: string; quantite: number }

/**
 * LES BESOINS DU RAPPORT DE VISITE : des paires (`besoinProduitId`, `besoinQuantite`) dans l'ordre du formulaire. Une
 * case laissée vide n'écrit rien (facultatif) ; un produit répété garde la dernière saisie.
 */
export function lireBesoinsDuRapport(fd: { getAll(nom: string): unknown[] }): { ok: true; besoins: BesoinLu[] } | { ok: false; error: string } {
  const produits = fd.getAll("besoinProduitId").map((x) => String(x ?? "").trim());
  const quantites = fd.getAll("besoinQuantite");
  const parProduit = new Map<string, number>();
  for (let i = 0; i < produits.length; i++) {
    const productId = produits[i];
    if (!productId) continue;
    const q = lireQuantite(quantites[i]);
    if (!q.ok) return { ok: false, error: `Besoin annuel du service : ${q.error}` };
    if (q.valeur !== null) parProduit.set(productId, q.valeur);
  }
  return { ok: true, besoins: [...parProduit].map(([productId, quantite]) => ({ productId, quantite })) };
}

export interface FaitsDroitBesoin {
  superAdmin: boolean;
  /** Direction (vue globale). */
  vueGlobale: boolean;
  /** Le geste « modifier » sur le Marketing cockpit — la Direction Marketing par défaut. */
  cockpitModifier: boolean;
  /** Chef de produit (rôle principal ou secondaire) avec le cockpit ouvert. */
  chefDeProduit: boolean;
  /** Le droit de saisir des visites (le KAM). */
  saisitDesVisites: boolean;
  /** Le décideur est-il ouvert à la personne (son panel) ? */
  decideurOuvert: boolean;
}

/** Peut-on écrire (ou retirer) un besoin ? La Direction Marketing pour tous, le KAM pour son panel. */
export function peutEcrireBesoin(f: FaitsDroitBesoin): boolean {
  if (f.superAdmin || f.vueGlobale || f.cockpitModifier || f.chefDeProduit) return true;
  return f.saisitDesVisites && f.decideurOuvert;
}

export interface BesoinLigne {
  productId: string;
  institutionId: string;
  serviceId: string | null;
  annee: number;
  quantite: number;
}

export interface LignePrevision {
  cle: string;
  institutionId: string;
  serviceId: string | null;
  /** Le besoin de l'année affichée (N+1) — null si non saisi pour cette année. */
  actuel: number | null;
  /** Le besoin de l'année d'avant (N) — null si non saisi. */
  precedent: number | null;
  /** −0,15 = −15 % ; null sans base. */
  evolution: number | null;
}

/**
 * LES PRÉVISIONS DES SERVICES pour une année : par établissement × service, la somme des produits du périmètre pour
 * l'année et pour l'année d'avant, et l'évolution. Une ligne n'existe que si l'une des deux années est saisie.
 */
export function previsionsDesServices(lignes: readonly BesoinLigne[], annee: number): LignePrevision[] {
  const par = new Map<string, LignePrevision>();
  for (const l of lignes) {
    if (l.annee !== annee && l.annee !== annee - 1) continue;
    const cle = `${l.institutionId}|${l.serviceId ?? "-"}`;
    const x = par.get(cle) ?? { cle, institutionId: l.institutionId, serviceId: l.serviceId, actuel: null, precedent: null, evolution: null };
    if (l.annee === annee) x.actuel = (x.actuel ?? 0) + l.quantite;
    else x.precedent = (x.precedent ?? 0) + l.quantite;
    par.set(cle, x);
  }
  return [...par.values()]
    .map((x) => ({ ...x, evolution: x.actuel !== null && x.precedent !== null && x.precedent > 0 ? x.actuel / x.precedent - 1 : null }))
    .sort((a, b) => (b.actuel ?? -1) - (a.actuel ?? -1) || (b.precedent ?? -1) - (a.precedent ?? -1));
}

/** Le total exprimé pour une année — null quand rien n'est saisi (jamais 0 par défaut). */
export function totalExprime(lignes: readonly BesoinLigne[], annee: number): { total: number; services: number } | null {
  const l = lignes.filter((x) => x.annee === annee);
  if (l.length === 0) return null;
  return { total: l.reduce((s, x) => s + x.quantite, 0), services: new Set(l.map((x) => `${x.institutionId}|${x.serviceId ?? "-"}`)).size };
}
