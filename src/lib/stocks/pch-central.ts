/**
 * LE STOCK PCH CENTRAL SAISI À LA MAIN — les règles PURES (Direction, 08/10 : « les stocks PCH centrale sont remplis
 * manuellement car reçus par mail »). Aucun import : l'écran de saisie (client) et l'action serveur lisent les mêmes
 * fonctions — le collage reconnu à l'écran est exactement celui que le serveur relira.
 *
 * Un RELEVÉ = la date du mail de la PCH (AAAA-MM-JJ), éventuellement pour une annexe / DR. Les quantités sont des
 * `StockSnapshot` ordinaires (scope PCH, ou ANNEX avec son lieu) : une seule vérité sur le stock, la courbe de l'écran
 * des relevés les lit déjà.
 */

/** Au-delà, un relevé « vieillit » : il passe en orange. */
export const JOURS_FRAICHEUR = 30;

const JOUR = 86_400_000;

/** La clé d'un relevé : la date du mail, AAAA-MM-JJ. */
export function cleReleve(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export const estCleReleve = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** L'âge d'un relevé, en jours entiers — `null` sans relevé. */
export function ageEnJours(dateIso: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / JOUR));
}

export const estPerime = (age: number | null): boolean => age !== null && age > JOURS_FRAICHEUR;

/** « aujourd'hui », « il y a 6 j » — la forme courte de la colonne « Relevé ». */
export function ilYa(age: number | null): string {
  if (age === null) return "—";
  return age === 0 ? "aujourd'hui" : `il y a ${age} j`;
}

// ── LE COLLAGE (Excel, texte du mail) ──────────────────────────────────────────────────────────

export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface ProduitReconnaissable {
  id: string;
  /** Les noms sous lesquels la PCH peut l'écrire : nom de marque, DCI, code, référence, nom catalogue. */
  noms: string[];
}

export interface LigneCollee {
  /** Le texte d'origine, tel qu'on l'a collé. */
  texte: string;
  libelle: string;
  quantite: number | null;
  /** Le produit reconnu — nul si aucun, ou si plusieurs se valent (la personne choisit). */
  productId: string | null;
  /** exact | approche | aucun | ambigu */
  qualite: "exact" | "approche" | "aucun" | "ambigu";
}

/** Un nombre écrit à la française ou à l'anglaise : « 1 200 », « 1.200 », « 1,200 », « 1200 ». Entier ≥ 0, sinon null. */
export function lireNombre(brut: string): number | null {
  const t = brut.replace(/[\s  ]/g, "");
  if (!t) return null;
  // Milliers séparés par « . » ou « , » (groupes de trois chiffres) — une quantité de boîtes n'a pas de décimales.
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d+[.,]0+$/.test(t)) return Number(t.split(/[.,]/)[0]);
  return null;
}

/** Découpe une ligne collée en « libellé » + « quantité » : la quantité est la DERNIÈRE cellule (ou mot) numérique. */
export function decouperLigne(ligne: string): { libelle: string; quantite: number | null } {
  const brut = ligne.replace(/\r/g, "").trim();
  if (!brut) return { libelle: "", quantite: null };
  const cellules = brut.includes("\t") ? brut.split("\t") : brut.includes(";") ? brut.split(";") : null;
  if (cellules) {
    const vals = cellules.map((c) => c.trim());
    for (let i = vals.length - 1; i >= 0; i--) {
      const n = lireNombre(vals[i]);
      if (n !== null) {
        const libelle = vals.slice(0, i).filter((v) => v && lireNombre(v) === null).join(" ").trim();
        if (libelle) return { libelle, quantite: n };
      }
    }
    return { libelle: vals.filter(Boolean).join(" "), quantite: null };
  }
  // Texte libre du mail : « Darunavir 600 mg ....... 1 540 » — la fin numérique est la quantité.
  const m = brut.match(/^(.*?)[\s:=.\-–]+(\d{1,3}(?:[\s  .,]\d{3})+|\d+)\s*(?:u|unites|unités|boites|boîtes|bt)?\.?$/i);
  if (m && m[1].trim()) return { libelle: m[1].trim(), quantite: lireNombre(m[2]) };
  return { libelle: brut, quantite: null };
}

/**
 * Reconnaît UN libellé parmi nos produits. Égalité normalisée d'abord (« exact ») ; sinon le nom le plus long contenu
 * dans le libellé (ou l'inverse) — « approche ». Deux produits à égalité : « ambigu », la personne tranche.
 */
export function reconnaitre(libelle: string, produits: readonly ProduitReconnaissable[]): Pick<LigneCollee, "productId" | "qualite"> {
  const l = normaliser(libelle);
  if (!l) return { productId: null, qualite: "aucun" };
  const exacts = produits.filter((p) => p.noms.some((n) => normaliser(n) === l));
  if (exacts.length === 1) return { productId: exacts[0].id, qualite: "exact" };
  if (exacts.length > 1) return { productId: null, qualite: "ambigu" };
  let meilleur = 0;
  let gagnants: string[] = [];
  for (const p of produits) {
    let score = 0;
    for (const n of p.noms) {
      const nn = normaliser(n);
      if (nn.length < 3) continue;
      const contient = ` ${l} `.includes(` ${nn} `) || ` ${nn} `.includes(` ${l} `);
      if (contient) score = Math.max(score, Math.min(nn.length, l.length));
    }
    if (score > meilleur) { meilleur = score; gagnants = [p.id]; } else if (score > 0 && score === meilleur) gagnants.push(p.id);
  }
  if (gagnants.length === 1) return { productId: gagnants[0], qualite: "approche" };
  if (gagnants.length > 1) return { productId: null, qualite: "ambigu" };
  return { productId: null, qualite: "aucun" };
}

/** Le collage entier : une ligne par produit, les lignes vides et les en-têtes sans quantité écartées. */
export function analyserCollage(texte: string, produits: readonly ProduitReconnaissable[]): LigneCollee[] {
  const out: LigneCollee[] = [];
  for (const ligne of texte.split("\n")) {
    if (!ligne.trim()) continue;
    const { libelle, quantite } = decouperLigne(ligne);
    if (!libelle && quantite === null) continue;
    // Un en-tête (« Produit ; Quantité ») n'a pas de quantité ET ne reconnaît rien : on l'écarte.
    const r = reconnaitre(libelle, produits);
    if (quantite === null && r.qualite === "aucun") continue;
    out.push({ texte: ligne.trim(), libelle, quantite, ...r });
  }
  return out;
}

// ── LE CROCHET DE COUVERTURE ───────────────────────────────────────────────────────────────────

/**
 * LA CONSOMMATION MENSUELLE D'UN PRODUIT (boîtes / mois) — lue dans « Ventes PCH » : ce que les directions régionales
 * ont DISTRIBUÉ aux hôpitaux (`consommationHospitaliereMensuelle`), moyenne des 3 derniers mois COMPLETS reçus. Le
 * chargement est `queries/stock-pch.ts › chargerConsommationMensuelle` ; `null` = aucune donnée (la couverture reste « — »).
 */
export type ConsommationMensuelle = (productId: string) => number | null;

export const consommationInconnue: ConsommationMensuelle = () => null;

/** Une table produit → consommation, vue comme le crochet de couverture. */
export function consommationDepuis(table: ReadonlyMap<string, number | null>): ConsommationMensuelle {
  return (productId) => table.get(productId) ?? null;
}

/** Le nombre de mois complets dont on fait la moyenne. */
export const MOIS_DE_CONSOMMATION = 3;

/**
 * LA MOYENNE DES DERNIERS MOIS COMPLETS : les mois AVANT `moisCourant` (« AAAA-MM », le mois en cours n'est jamais
 * complet), les `n` plus récents qui ont une donnée — un mois sans fichier ne se lit pas comme une consommation nulle,
 * il est simplement absent. Plusieurs lignes d'un même mois (un établissement chacune) s'additionnent. Aucune donnée →
 * `null`. Arrondi à la boîte.
 */
export function consommationMoyenne(lignes: readonly { mois: string; livre: number }[], moisCourant: string, n = MOIS_DE_CONSOMMATION): number | null {
  const parMois = new Map<string, number>();
  for (const l of lignes) if (l.mois < moisCourant) parMois.set(l.mois, (parMois.get(l.mois) ?? 0) + Math.max(0, l.livre));
  const retenus = [...parMois.keys()].sort().slice(-Math.max(1, n));
  if (retenus.length === 0) return null;
  return Math.round(retenus.reduce((s, m) => s + parMois.get(m)!, 0) / retenus.length);
}

/** Le stock de la chaîne : la somme des maillons CONNUS (Adventum, PCH central, hôpitaux) — `null` si aucun ne l'est. */
export function stockDeLaChaine(maillons: readonly (number | null | undefined)[]): number | null {
  const connus = maillons.filter((x): x is number => typeof x === "number");
  return connus.length ? connus.reduce((a, b) => a + b, 0) : null;
}

/** Couverture de la chaîne en mois : stock total ÷ consommation mensuelle — `null` si l'un manque. */
export function couvertureEnMois(stockTotal: number | null, conso: number | null): number | null {
  if (stockTotal === null || conso === null || conso <= 0) return null;
  return Math.round((stockTotal / conso) * 10) / 10;
}

/** Sous 2 mois de couverture : rupture à 60 jours (rouge). Sous 3 mois : à surveiller (orange). */
export const SEUIL_RUPTURE_MOIS = 2;
export const SEUIL_VIGILANCE_MOIS = 3;

export type NiveauCouverture = "rupture" | "vigilance" | "ok";

export function niveauCouverture(mois: number | null): NiveauCouverture | null {
  if (mois === null) return null;
  return mois < SEUIL_RUPTURE_MOIS ? "rupture" : mois < SEUIL_VIGILANCE_MOIS ? "vigilance" : "ok";
}
