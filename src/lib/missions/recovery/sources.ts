/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ CHERCHER ENSUITE (§77) — le routeur de sources.
 *
 * ── LE CAS RÉEL QUI JUSTIFIE CE FICHIER ──────────────────────────────────────────────────
 *
 * « Trouve le contrat de Redouane. » Il n'est pas dans le module Legal. Un assistant naïf
 * s'arrête. Or dans cette entreprise il peut être : rangé dans le Drive sans être déclaré, en
 * pièce jointe d'un mail de mars, enregistré au registre des courriers, ou attaché à sa fiche
 * RH. Quatre endroits, tous légitimes, et l'ordre dans lequel on les visite décide de la
 * différence entre « introuvable » et « le voici ».
 *
 * ── POURQUOI L'ORDRE EST ÉCRIT ET NON DEVINÉ ─────────────────────────────────────────────
 *
 * Parce qu'il porte une connaissance de l'entreprise : un contrat est D'ABORD un objet Legal,
 * un devis est D'ABORD un objet fournisseur, un dossier réglementaire est D'ABORD dans
 * Regulatory. Demander à un modèle « où chercherais-tu ? » à chaque fois, c'est payer un appel
 * pour redécouvrir ce qu'on sait déjà, et accepter qu'il réponde autrement un jour sur trois.
 *
 * ── CE QUE CE FICHIER N'EST PAS ──────────────────────────────────────────────────────────
 *
 * Ce n'est pas une liste de macros (§110). Il ne dit pas COMMENT chercher — seulement dans quel
 * ordre visiter les greniers. La recherche elle-même reste une capacité ordinaire, soumise aux
 * mêmes droits que partout ailleurs (§48).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les greniers de l'entreprise, nommés une fois. */
export const SOURCES = [
  "LEGAL", "DRIVE", "REGULATORY", "ADPRO", "HR", "COURRIERS",
  "FINANCE", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS",
] as const;
export type Source = (typeof SOURCES)[number];

export const LIBELLE_SOURCE: Record<Source, string> = {
  LEGAL: "le module Legal",
  DRIVE: "le Drive",
  REGULATORY: "les dossiers Regulatory",
  ADPRO: "Ad&Pro",
  HR: "les RH",
  COURRIERS: "le registre des courriers",
  FINANCE: "les Finances",
  GMAIL_ATTACHMENTS: "les pièces jointes des mails",
  BUSINESS_EVENTS: "le journal des événements",
};

/**
 * CE QU'ON CHERCHE — un vocabulaire fermé, parce qu'un vocabulaire ouvert n'aurait pas d'ordre.
 */
export const CIBLES = [
  "CONTRAT", "FACTURE", "DEVIS", "BON_DE_COMMANDE", "COURRIER",
  "DOSSIER_REGLEMENTAIRE", "PIECE_RH", "DOCUMENT", "PERSONNE", "TRACE",
] as const;
export type Cible = (typeof CIBLES)[number];

/**
 * L'ORDRE DE VISITE PAR TYPE DE CIBLE.
 *
 * Le principe qui les gouverne toutes : on commence par l'endroit où la chose est CENSÉE être,
 * puis on descend vers les endroits où elle FINIT souvent. Le Drive est presque toujours en
 * deuxième position — c'est là que tout atterrit quand personne n'a rien déclaré.
 *
 * `BUSINESS_EVENTS` est systématiquement en DERNIER, et pour une bonne raison : le journal ne
 * contient pas le document, il contient la TRACE de son passage. Il ne répond donc jamais à
 * « donne-moi le contrat », mais toujours à « quelqu'un a-t-il déjà vu ce contrat ? » — ce qui
 * est la question qu'on pose quand on a épuisé le reste.
 */
export const ORDRE: Record<Cible, readonly Source[]> = {
  CONTRAT: ["LEGAL", "DRIVE", "HR", "COURRIERS", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  FACTURE: ["FINANCE", "LEGAL", "DRIVE", "COURRIERS", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  DEVIS: ["LEGAL", "ADPRO", "DRIVE", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  BON_DE_COMMANDE: ["LEGAL", "FINANCE", "DRIVE", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  COURRIER: ["COURRIERS", "DRIVE", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  DOSSIER_REGLEMENTAIRE: ["REGULATORY", "DRIVE", "COURRIERS", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  PIECE_RH: ["HR", "DRIVE", "COURRIERS", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  DOCUMENT: ["DRIVE", "LEGAL", "COURRIERS", "REGULATORY", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  PERSONNE: ["HR", "DRIVE", "COURRIERS", "GMAIL_ATTACHMENTS", "BUSINESS_EVENTS"],
  TRACE: ["BUSINESS_EVENTS", "COURRIERS", "DRIVE", "GMAIL_ATTACHMENTS"],
};

/**
 * LA PROCHAINE SOURCE À VISITER.
 *
 * `null` signifie « tous les greniers ont été ouverts » — et c'est la seule condition dans
 * laquelle « je n'ai pas trouvé » devient une réponse honnête plutôt qu'un abandon.
 */
export function prochaineSource(cible: Cible, dejaVisitees: readonly Source[]): Source | null {
  return (ORDRE[cible] ?? ORDRE.DOCUMENT).find((s) => !dejaVisitees.includes(s)) ?? null;
}

/**
 * LE COMPTE RENDU D'UNE RECHERCHE INFRUCTUEUSE.
 *
 * ── POURQUOI CE TEXTE EXISTE ─────────────────────────────────────────────────────────────
 *
 * « Je n'ai pas trouvé » est inexploitable : l'utilisateur ne sait pas s'il faut chercher
 * ailleurs, préciser sa demande, ou constater que la chose n'existe pas. En nommant les
 * greniers ouverts, la réponse devient actionnable — et vérifiable, ce qui est mieux encore.
 */
export function compteRendu(cible: Cible, visitees: readonly Source[]): string {
  if (visitees.length === 0) return "Aucune recherche n'a encore été menée.";
  const noms = visitees.map((s) => LIBELLE_SOURCE[s]).join(", ");
  const reste = prochaineSource(cible, visitees);
  return reste
    ? `Cherché dans ${noms}. Il reste ${LIBELLE_SOURCE[reste]} à explorer.`
    : `Cherché dans ${noms} — soit toutes les sources connues pour ce type. Rien n'y figure.`;
}
