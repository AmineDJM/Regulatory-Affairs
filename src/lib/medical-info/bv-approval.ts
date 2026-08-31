/**
 * QUI SIGNE LE BON DE VERSEMENT — et dans quel ordre.
 *
 * ── LES TROIS SIGNATURES ────────────────────────────────────────────────────────────────────
 *
 * Trois personnes, trois questions différentes, et c'est pourquoi aucune ne remplace les autres :
 *
 *   1. le **N+1 du pharmacien** — « ce versement relève-t-il bien de son travail ? » ;
 *   2. le **chef de produit du dossier** — « le montant correspond-il à cet événement ? » ; c'est
 *      lui qui connaît le budget accordé et ce qu'il couvre ;
 *   3. le **centre de validations** (Directeur Général, à défaut Super Admin) — « engage-t-on la
 *      société ? ».
 *
 * ── POURQUOI SÉQUENTIEL, ET NON EN PARALLÈLE ────────────────────────────────────────────────
 *
 * En parallèle, les trois reçoivent la demande en même temps et le Directeur Général signe avant
 * que quiconque ait vérifié le montant : sa signature ne vaut alors plus rien, puisqu'elle ne
 * s'appuie sur aucune vérification. L'ordre EST le contrôle — chaque marche s'appuie sur la
 * précédente, et le centre ne voit que ce que deux personnes ont déjà tenu pour juste.
 *
 * ── CE QU'ON FAIT DES SIGNATAIRES MANQUANTS ─────────────────────────────────────────────────
 *
 * Un pharmacien sans N+1 dans l'organigramme, un événement sans chef de produit : cela arrive, et
 * ce n'est pas une raison de bloquer le dossier. La marche absente est SAUTÉE, jamais remplacée
 * par quelqu'un d'autre — désigner un remplaçant « au plus proche » ferait signer une personne
 * qui n'a pas la question. Le centre, lui, n'est jamais sauté : sans lui, personne n'engage la
 * société, et la demande n'aurait plus aucun validateur.
 *
 * Module PUR : cette règle décide qui engage l'argent de la société, elle doit se lire sans rien
 * exécuter. Testé.
 */

export interface BvSigners {
  /** Le N+1 du pharmacien, tel que l'organigramme le résout. */
  managerUserId: string | null;
  /** Le chef de produit du dossier source (sponsoring, congrès, événement). */
  productManagerUserId: string | null;
  /** Le siège du centre de validations — Directeur Général, à défaut Super Admin. */
  centreUserId: string | null;
  /** Le demandeur : il ne se valide jamais lui-même. */
  requesterId: string;
}

export interface BvChain {
  /** Les validateurs, DANS L'ORDRE. Vide si personne ne peut signer. */
  validatorIds: string[];
  /** Ce qui manque, pour le dire à l'écran plutôt que de le taire. */
  missing: ("MANAGER" | "PRODUCT_MANAGER" | "CENTRE")[];
}

/**
 * LA CHAÎNE DE SIGNATURES, dans l'ordre, dédoublonnée.
 *
 * Le dédoublonnage n'est pas cosmétique : quand le chef de produit EST le N+1 du pharmacien —
 * cela se produit — la même personne recevrait deux fois la même demande et devrait signer
 * deux fois pour la faire avancer. Elle signe une fois, à sa première place.
 *
 * Le demandeur est écarté partout : un pharmacien qui serait aussi chef de produit du dossier
 * s'auto-validerait, et la marche perdrait son sens.
 */
export function bvChain(s: BvSigners): BvChain {
  const missing: BvChain["missing"] = [];
  const ids: string[] = [];
  const ajouter = (id: string | null, quoi: BvChain["missing"][number]) => {
    if (!id || id === s.requesterId) { missing.push(quoi); return; }
    if (!ids.includes(id)) ids.push(id);
  };
  ajouter(s.managerUserId, "MANAGER");
  ajouter(s.productManagerUserId, "PRODUCT_MANAGER");
  ajouter(s.centreUserId, "CENTRE");
  return { validatorIds: ids, missing };
}

const MANQUE: Record<BvChain["missing"][number], string> = {
  MANAGER: "aucun responsable hiérarchique",
  PRODUCT_MANAGER: "aucun chef de produit sur le dossier",
  CENTRE: "aucun Directeur Général ni Super Admin actif",
};

/**
 * CE QU'ON DIT QUAND IL MANQUE QUELQU'UN — ou `null` quand la chaîne est complète.
 *
 * Taire une marche sautée serait le pire des deux mondes : la demande part, elle est signée par
 * moins de gens qu'annoncé, et personne ne le sait. On l'écrit donc dans la demande elle-même.
 */
export function bvChainNote(c: BvChain): string | null {
  if (c.missing.length === 0) return null;
  return `Étape(s) sautée(s) faute de signataire : ${c.missing.map((m) => MANQUE[m]).join(", ")}.`;
}
