/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DEMANDE DE DEVIS, TELLE QUE L'ASSISTANTE DE DIRECTION LA LIT (§118.204).
 *
 * La demande de devis part désormais SANS geste séparé : à la création si la demande n'a pas de
 * validation, sinon dès qu'elle est validée. Le demandeur ne clique donc plus sur « Demander les
 * devis » — il doit VOIR, avant d'enregistrer, ce qui partira. Ce texte est écrit UNE fois et lu
 * des deux côtés : l'aperçu du formulaire (navigateur) et la demande au secrétariat (serveur). Deux
 * rédactions finiraient par montrer au demandeur autre chose que ce que l'assistante reçoit (§118.5).
 *
 * PUR, zéro import : les libellés (actions, produits promus) arrivent déjà traduits.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ArticlePourDevis {
  reference: string;
  nom: string;
  quantite: number | null;
  unite: string;
  /** « Conception », « Impression »… — déjà en libellés. */
  actions: string[];
  /** « Société en général », « Gamme Oncologie », « Nivolex »… — déjà en libellés. */
  promus: string[];
  commentaire: string | null;
}

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** Une ligne, sur plusieurs lignes de texte : ce qu'il faut faire chiffrer, et rien d'ambigu. */
export function texteArticlePourDevis(a: ArticlePourDevis, rang: number): string {
  const tete = `${rang}. ${a.reference} ${a.nom}${a.quantite != null ? ` — ${nombre(a.quantite)} ${a.unite}` : ""}`;
  return [
    tete,
    `   Ce qu'on attend du fournisseur : ${a.actions.length ? a.actions.join(", ").toLowerCase() : "—"}`,
    a.promus.length ? `   Produit(s) promu(s) : ${a.promus.join(", ")}` : null,
    a.commentaire?.trim() ? `   Précision : ${a.commentaire.trim()}` : null,
  ].filter((x): x is string => x !== null).join("\n");
}

export function texteDemandeDeDevis(d: {
  /** La référence du dossier (« MP-2026-012 ») — absente dans l'aperçu, avant la création. */
  reference: string | null;
  titre: string;
  brief: string | null;
  precisions: string | null;
  relance: boolean;
  articles: ArticlePourDevis[];
}): string {
  const dossier = d.reference ? `Dossier ${d.reference}` : "Dossier (sa référence sera attribuée à l'enregistrement)";
  return [
    d.relance
      ? "NOUVELLE DEMANDE de devis : les devis déjà reçus restent sur la fiche du dossier — cherchez ce qui est demandé ci-dessous."
      : null,
    d.precisions?.trim() ? `Précisions du demandeur : ${d.precisions.trim()}` : null,
    `Articles à faire chiffrer (${d.articles.length}) :\n${d.articles.map((a, i) => texteArticlePourDevis(a, i + 1)).join("\n")}`,
    d.brief?.trim() ? `Brief : ${d.brief.trim()}` : null,
    `${dossier} — ${d.titre}. Recevez les devis des agences, puis déposez chacun sur la fiche du dossier avec son fournisseur (choisi dans l'annuaire) et retranscrivez-le ligne à ligne (référence, unité, quantité, prix unitaire, action, article demandé).`,
  ].filter((x): x is string => Boolean(x)).join("\n\n");
}
