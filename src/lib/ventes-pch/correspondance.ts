import { normalizePackaging } from "@/lib/products/identity";
import { cleClient, fournisseurCorrespond, memePresentation, presentationPch, presentationProduit, type Presentation } from "./normalisation";

/**
 * VENTES PCH — « TOUT CONNECTÉ » : chaque ligne des fichiers PCH rejoint l'annuaire et le catalogue (module PUR).
 *
 *   • ÉTABLISSEMENT — la MÉMOIRE d'un rattachement confirmé l'emporte ; sinon la clé normalisée du CLIENT (`cleClient`)
 *     doit désigner UN SEUL établissement actif de l'annuaire. Homonymes ou inconnu → « à rattacher » (le nom brut est
 *     gardé, un geste le rattache, et la mémoire s'en souvient pour tous les fichiers suivants).
 *   • PRODUIT — la MÉMOIRE d'un poste PCH confirmé (poste → produit) l'emporte ; sinon la PRÉSENTATION (molécule,
 *     première dose, famille de forme) doit désigner UN SEUL de nos produits — le conditionnement (UC) départage deux
 *     boîtes. Molécule à nous mais présentation différente ou ambiguë → reste au marché, listée « à rattacher ».
 *     Molécule qui n'est pas à nous → donnée de MARCHÉ (part de marché, demande non servie de la molécule).
 *   • FOURNISSEUR « À NOUS » — proposé quand un nom de fournisseur PCH reprend le laboratoire partenaire, le détenteur
 *     de la décision ou le fabricant d'un de nos dossiers ; la liste se corrige produit par produit.
 */

// ─────────────────────────── Établissements ───────────────────────────

export interface EtablissementRef { id: string; name: string; isActive: boolean; wilaya?: string | null }

export type StatutEtablissement = "MEMOIRE" | "NOM" | "AMBIGU" | "INCONNU";
export interface RattachementEtablissement { institutionId: string | null; statut: StatutEtablissement; candidats: string[] }

export function indexEtablissementsPch(etablissements: readonly EtablissementRef[], memoire: ReadonlyMap<string, string>) {
  const parCle = new Map<string, EtablissementRef[]>();
  const ids = new Set(etablissements.map((e) => e.id));
  for (const e of etablissements) {
    if (!e.isActive) continue;
    const k = cleClient(e.name);
    if (k) (parCle.get(k) ?? parCle.set(k, []).get(k)!).push(e);
  }
  return (client: string): RattachementEtablissement => {
    const cle = cleClient(client);
    const mem = memoire.get(cle);
    if (mem && ids.has(mem)) return { institutionId: mem, statut: "MEMOIRE", candidats: [] };
    const tous = parCle.get(cle) ?? [];
    if (tous.length === 1) return { institutionId: tous[0].id, statut: "NOM", candidats: [] };
    if (tous.length > 1) return { institutionId: null, statut: "AMBIGU", candidats: tous.map((e) => e.id) };
    return { institutionId: null, statut: "INCONNU", candidats: [] };
  };
}

// ─────────────────────────── Produits ───────────────────────────

export interface ProduitRef {
  id: string;
  nom: string;
  dci: string;
  dosage?: string | null;
  dosageUnit?: string | null;
  form?: string | null;
  packaging?: string | null;
}

export type StatutProduit =
  /** Poste confirmé par une personne (mémoire). */
  | "MEMOIRE"
  /** Une seule de nos présentations correspond. */
  | "IDENTITE"
  /** Plusieurs de nos produits correspondent — rien n'est choisi. */
  | "AMBIGU"
  /** Notre molécule, mais pas une de nos présentations (autre dosage, autre forme, dose illisible). */
  | "MOLECULE"
  /** Une molécule que nous ne portons pas : donnée de marché. */
  | "MARCHE";

export interface RattachementProduit { productId: string | null; statut: StatutProduit; candidats: string[]; presentation: Presentation }

export function indexProduitsPch(produits: readonly ProduitRef[], memoire: ReadonlyMap<number, string>) {
  const ids = new Set(produits.map((p) => p.id));
  const parMolecule = new Map<string, { p: ProduitRef; pr: Presentation }[]>();
  for (const p of produits) {
    const pr = presentationProduit(p);
    if (!pr.molecule) continue;
    (parMolecule.get(pr.molecule) ?? parMolecule.set(pr.molecule, []).get(pr.molecule)!).push({ p, pr });
  }
  return (poste: number | null, designation: string, uc?: string | null): RattachementProduit => {
    const presentation = presentationPch(designation);
    const mem = poste !== null ? memoire.get(poste) : undefined;
    if (mem && ids.has(mem)) return { productId: mem, statut: "MEMOIRE", candidats: [], presentation };
    const memes = parMolecule.get(presentation.molecule) ?? [];
    if (!memes.length) return { productId: null, statut: "MARCHE", candidats: [], presentation };
    let exacts = memes.filter((x) => memePresentation(x.pr, presentation));
    if (exacts.length > 1 && uc) {
      const boite = normalizePackaging(uc);
      const memeBoite = exacts.filter((x) => x.p.packaging && normalizePackaging(x.p.packaging) === boite);
      if (memeBoite.length) exacts = memeBoite;
    }
    if (exacts.length === 1) return { productId: exacts[0].p.id, statut: "IDENTITE", candidats: [], presentation };
    if (exacts.length > 1) return { productId: null, statut: "AMBIGU", candidats: exacts.map((x) => x.p.id), presentation };
    return { productId: null, statut: "MOLECULE", candidats: memes.map((x) => x.p.id), presentation };
  };
}

/**
 * LE PRODUIT D'UN POSTE PCH — le poste est le code produit de la PCH, le MÊME dans toutes les DR et dans les
 * réceptions ; c'est lui, et non le libellé (que chaque DR écrit à sa façon : « NIVOLUMAB INJ 100MG/10ML » ici,
 * « 10MG/ML » là), qui porte le rattachement.
 *   • un rattachement fait À LA MAIN ne bouge jamais ;
 *   • sinon, les libellés vus pour ce poste sont lus : s'ils désignent UN seul de nos produits, c'est lui ;
 *   • sinon le rattachement automatique d'avant reste s'il est encore l'un des candidats ;
 *   • sinon rien — et le statut dit pourquoi (ambigu, notre molécule, marché).
 */
export interface PosteExistant { productId: string | null; manuel: boolean }
export interface DecisionPoste { productId: string | null; statut: StatutProduit; candidats: string[] }

export function decisionPoste(existant: PosteExistant | undefined, lectures: readonly RattachementProduit[]): DecisionPoste {
  if (existant?.manuel) return { productId: existant.productId, statut: "MEMOIRE", candidats: [] };
  const surs = [...new Set(lectures.filter((l) => l.productId && (l.statut === "IDENTITE" || l.statut === "MEMOIRE")).map((l) => l.productId!))];
  if (surs.length === 1) return { productId: surs[0], statut: "IDENTITE", candidats: [] };
  const candidats = [...new Set([...surs, ...lectures.flatMap((l) => l.candidats)])];
  if (existant?.productId && candidats.includes(existant.productId)) return { productId: existant.productId, statut: "IDENTITE", candidats: [] };
  const statut: StatutProduit = surs.length > 1 || lectures.some((l) => l.statut === "AMBIGU") ? "AMBIGU"
    : lectures.some((l) => l.statut === "MOLECULE") ? "MOLECULE" : "MARCHE";
  return { productId: null, statut, candidats };
}

// ─────────────────────────── Fournisseurs « à nous » ───────────────────────────

/**
 * LES FOURNISSEURS PCH À PROPOSER pour un produit : parmi ceux qui ont livré sa présentation à la PCH, ceux dont le nom
 * reprend un des laboratoires de ses dossiers (partenaire, détenteur de la décision, fabricant). Les transferts entre
 * annexes et les retours ne sont pas des fournisseurs.
 */
export function proposerFournisseurs(fournisseursLivreurs: readonly string[], laboratoires: readonly (string | null | undefined)[]): string[] {
  const labos = laboratoires.filter((l): l is string => !!l && !!l.trim());
  return [...new Set(fournisseursLivreurs.filter((f) => !/^ANNEXE\b|^RETOUR\b|^CORRECTION\b/i.test(f.trim()) && labos.some((l) => fournisseurCorrespond(f, l))))];
}
