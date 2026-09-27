/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TOUT BON DE COMMANDE PASSE PAR UN CENTRE DE VALIDATION — la règle, pure.
 *
 * ── CE QUE LA DIRECTION A DÉCIDÉ (09/2026) ──────────────────────────────────────────────────
 *
 * « Concernant les BC, ils doivent tous passer soit par le centre de validation Ad&Pro si la
 * demande est depuis Ad&Pro, soit par le centre de validation normal, si elle provient de
 * quelque part d'autre. »
 *
 * ── CE QUE LA MESURE A TROUVÉ AVANT CETTE RÈGLE ─────────────────────────────────────────────
 *
 * Aucun bon de commande ne passait par aucun centre. Recensé chemin par chemin : un BC existait
 * sous QUATRE formes sans lien entre elles — une pièce du registre Legal (`LegalDocument` de
 * nature `PURCHASE_ORDER`, née `ACTIVE`, sans aucun état d'approbation), le visa d'un poste
 * Ad & Pro (`AdProItem.orderStage`, donné par « la Direction »), les états BC_* du matériel
 * promotionnel (validés par les FINANCES), et le chantier « bon de commande » du circuit court,
 * qu'un simple clic sans pièce refermait. `legal-chain.ts` lisait même des validateurs sur
 * `LEGAL_DOCUMENT` que personne ne créait : un lecteur sans écrivain.
 *
 * ── LA RÈGLE, EN TROIS QUESTIONS ────────────────────────────────────────────────────────────
 *
 *   1. QUEL CENTRE ? — `centreDeLOrigine` : le centre Ad & Pro dès que le chemin d'origine du BC
 *      passe par une nature Ad & Pro ou un poste ; le centre de validations sinon.
 *   2. OÙ EN EST SA PORTE ? — `PorteBC` : en attente, validée, refusée, ou à revoir. `null` = le
 *      BC n'a pas de porte, ce qui ne peut arriver qu'à un BC ANTÉRIEUR à cette règle.
 *   3. QUE FAIRE QUAND LE BC CHANGE ? — `gesteAiguillage` : poser, transférer, rouvrir,
 *      actualiser, ou ne rien faire — jamais re-juger une décision déjà prise.
 *
 * ── CE QUE LA PORTE BLOQUE ───────────────────────────────────────────────────────────────────
 *
 * Un BC qui attend son centre n'engage pas encore la société : la facture qui en DÉCOULE ne part
 * pas au règlement (`blocageParLeBC`), et la phrase qui annonce le BC le DIT (`reserveBC`) — un
 * document qui s'ouvre, s'imprime et a l'air fini, sans dire qu'il n'est pas validé, se lit
 * comme un engagement (§118.32).
 *
 * Et ce qu'elle NE bloque PAS : un BC sans porte, c'est-à-dire historique. Le bloquer gèlerait
 * rétroactivement tout le registre au déploiement — une garde qui refuse ce qu'elle ne sait pas
 * lire est désactivée dans la semaine (§118.16).
 *
 * Module PUR — zéro import, au SOCLE. Quatre couches en ont besoin sans avoir le droit de se
 * parler : les actions de Legal, la fabrique documentaire (le pont), le règlement des factures
 * (domaine `finance`) et le centre Ad & Pro (domaine `adpro`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les deux centres entre lesquels un BC s'aiguille. */
export type CentreBC = "AD_PRO" | "VALIDATION";

/** L'état de la porte d'un BC. */
export type EtatPorteBC = "EN_ATTENTE" | "VALIDE" | "REFUSE" | "A_REVOIR";

/**
 * LA PORTE D'UN BC TELLE QU'ON LA LIT.
 *
 * `source` dit OÙ vit la décision, et la distinction n'est pas un détail : le BC d'un poste Ad &
 * Pro est demandé AVANT que sa pièce existe — c'est la DEMANDE que le centre vise (montant
 * accordé, prestataire, imputation). La pièce qui arrive ensuite en est la matérialisation ; lui
 * poser une seconde porte ferait valider DEUX FOIS le même engagement, et deux vérités sur « ce
 * BC est-il validé ? » divergent toujours (§118.5).
 */
export interface PorteBC {
  centre: CentreBC;
  etat: EtatPorteBC;
  source: "DOCUMENT" | "POSTE";
  /** Le motif du centre (refus, demande de modification). */
  note?: string | null;
}

export const LIBELLE_CENTRE_BC: Record<CentreBC, string> = {
  AD_PRO: "centre de validation Ad & Pro",
  VALIDATION: "centre de validations",
};

export const LIBELLE_ETAT_BC: Record<EtatPorteBC, string> = {
  EN_ATTENTE: "En attente de validation",
  VALIDE: "Validé",
  REFUSE: "Refusé",
  A_REVOIR: "À revoir",
};

/** Le chemin vers l'écran du centre — pour les liens des refus et des notifications. */
export const CHEMIN_CENTRE_BC: Record<CentreBC, string> = {
  AD_PRO: "/centre-ad-pro",
  VALIDATION: "/centre-de-validations",
};

/**
 * QUEL CENTRE ? — la réponse est dans le CHEMIN D'ORIGINE du BC.
 *
 * Le chemin est la suite des types d'entité qu'on traverse en remontant d'où le BC vient : sa
 * source directe, la demande de pièce qui l'a fait naître, l'ordre ou le dossier qu'elle visait.
 * Il suffit qu'UN maillon soit Ad & Pro pour que la demande vienne d'Ad & Pro — un BC réclamé
 * sur le poste d'un sponsoring EST un BC du sponsoring, même s'il a transité par le secrétariat.
 *
 * Les types Ad & Pro arrivent en PARAMÈTRE : ce module est au socle et ne lit pas le registre
 * des natures (domaine `adpro`). L'appelant le dérive du registre canonique — une liste écrite ici
 * à la main serait fausse à la première nature ajoutée, en silence (§118.73).
 */
export function centreDeLOrigine(chemin: readonly string[], typesAdPro: ReadonlySet<string>): CentreBC {
  return chemin.some((t) => typesAdPro.has(t)) ? "AD_PRO" : "VALIDATION";
}

/** L'état d'une demande de validation (centre de validations) — `null` si elle a été retirée. */
export function etatDepuisValidation(status: string): EtatPorteBC | null {
  switch (status) {
    case "PENDING": return "EN_ATTENTE";
    case "APPROVED": return "VALIDE";
    case "REJECTED": return "REFUSE";
    case "CHANGES_REQUESTED": return "A_REVOIR";
    default: return null; // CANCELLED : la porte a été retirée, elle ne dit plus rien
  }
}

/** L'état d'un visa du centre Ad & Pro. Un état inconnu ATTEND — le sens sûr. */
export function etatDepuisVisa(status: string): EtatPorteBC {
  if (status === "APPROVED") return "VALIDE";
  if (status === "REFUSED") return "REFUSE";
  return "EN_ATTENTE";
}

/**
 * L'état porté par le VISA D'UN POSTE Ad & Pro — `null` quand aucun BC n'a été demandé.
 *
 * `DIRECTION_OK` garde son nom de colonne historique ; depuis cette règle, c'est le centre Ad &
 * Pro qui le pose. `ISSUED` suit un visa : l'ordre de dépense n'est émis qu'après.
 */
export function etatDepuisPoste(orderStage: string): EtatPorteBC | null {
  switch (orderStage) {
    case "REQUESTED": return "EN_ATTENTE";
    case "DIRECTION_OK":
    case "ISSUED": return "VALIDE";
    case "REFUSED": return "REFUSE";
    default: return null;
  }
}

/**
 * LA FACTURE QUI DÉCOULE DE CE BC PEUT-ELLE PARTIR AU RÈGLEMENT ? — `null` = oui.
 *
 * Le refus NOMME le BC, le centre et ce qui lève le blocage (§118.30). Un BC sans porte ne
 * bloque rien : c'est un BC d'avant la règle.
 */
export function blocageParLeBC(porte: PorteBC | null, reference: string | null): string | null {
  if (!porte || porte.etat === "VALIDE") return null;
  const bc = reference?.trim() ? `Le bon de commande ${reference.trim()}` : "Le bon de commande dont découle cette facture";
  const centre = LIBELLE_CENTRE_BC[porte.centre];
  switch (porte.etat) {
    case "EN_ATTENTE":
      return `${bc} attend encore la validation du ${centre} : la facture partira au règlement une fois le bon de commande validé.`;
    case "A_REVOIR":
      return `${bc} est à revoir à la demande du ${centre}${porte.note ? ` (« ${porte.note} »)` : ""} : corrigez-le — sa modification le renvoie au centre — avant d'envoyer la facture.`;
    case "REFUSE":
      return `${bc} a été refusé par le ${centre}${porte.note ? ` (« ${porte.note} »)` : ""} : une facture qui en découle ne part pas au règlement.`;
  }
}

/**
 * CE QUE LA PHRASE QUI ANNONCE UN BC DOIT DIRE (§118.32).
 *
 * « Bon de commande BC-2026-012 émis » sur un BC que personne n'a validé ferait envoyer la pièce
 * au fournisseur — elle s'ouvre, s'imprime, porte un numéro. La réserve entre dans la phrase, et
 * se tait quand le BC est validé : une réserve permanente cesse d'être lue.
 */
export function reserveBC(porte: PorteBC | null): string | null {
  if (!porte || porte.etat === "VALIDE") return null;
  const centre = LIBELLE_CENTRE_BC[porte.centre];
  switch (porte.etat) {
    case "EN_ATTENTE":
      return `Ce bon de commande attend la validation du ${centre} : ne l'envoyez pas au fournisseur avant.`;
    case "A_REVOIR":
      return `Le ${centre} demande de revoir ce bon de commande : il n'engage pas la société en l'état.`;
    case "REFUSE":
      return `Ce bon de commande a été refusé par le ${centre} : il n'engage pas la société.`;
  }
}

/**
 * CE QUE DIT UN AIGUILLAGE QUI N'A PAS POSÉ DE PORTE — et un seul endroit pour le dire.
 *
 * Deux causes, deux phrases : personne ne siège au centre (un Super Admin doit exister), ou
 * l'écriture de la porte a échoué (on la rattrape d'un clic, depuis la fiche). La fabrique et les
 * actions Legal portaient chacune LEUR rédaction de la première, et aucune ne connaissait la
 * seconde : un BC sans porte sortait avec une phrase qui ne disait rien (§118.5, §118.148).
 * `null` quand une porte a bien été posée — c'est alors `reserveBC` qui parle.
 */
export function reserveSansPorte(a: { sansSiege?: boolean; enEchec?: boolean }): string | null {
  if (a.sansSiege) {
    return "Aucun siège au centre de validations : ce bon de commande n'a pas pu y être adressé — il n'est PAS validé. Un Super Admin doit exister pour le valider.";
  }
  if (a.enEchec) {
    return "Ce bon de commande n'a pas pu être adressé à son centre de validation (erreur technique) : il n'est PAS validé. Rattrapez-le par « Adresser au centre », sur sa fiche Legal.";
  }
  return null;
}

/** Ce que l'aiguillage doit faire, décidé sans rien lire. */
export type GesteAiguillage =
  | { geste: "POSER" }
  | { geste: "TRANSFERER" }
  | { geste: "ROUVRIR"; motif: string }
  | { geste: "ACTUALISER" }
  | { geste: "RIEN" };

/**
 * QUE FAIRE DE LA PORTE D'UN BC QU'ON VIENT DE CRÉER OU DE TOUCHER ?
 *
 *   • aucune porte → la POSER, dans le centre de son origine ;
 *   • porte du POSTE → RIEN : c'est la demande du poste que le centre vise, la pièce n'en est
 *     que la matérialisation (voir `PorteBC.source`) ;
 *   • en attente dans l'AUTRE centre (le BC vient d'être rattaché à une fiche Ad & Pro, ou
 *     détaché) → la TRANSFÉRER — elle n'a encore été vue par personne ;
 *   • en attente dans le bon centre, montant changé → ACTUALISER le montant affiché au centre ;
 *   • VALIDÉE et montant RELEVÉ → ROUVRIR : l'empreinte réelle d'un engagement ne dépasse jamais
 *     l'empreinte validée (§118.16). Baisser le montant ne rouvre rien — c'est un geste qui
 *     RÉDUIT. Un montant d'abord INCONNU qu'on renseigne ne rouvre rien non plus : le centre a
 *     validé la PIÈCE, qui portait son montant, et la saisie ne fait que le recopier ;
 *   • À REVOIR et modifiée → ROUVRIR : c'est la resoumission que le centre a demandée ;
 *   • REFUSÉE → RIEN : un refus ne se contourne pas en retouchant la pièce, et une décision
 *     déjà prise ne se re-juge pas parce que le BC a changé de fiche.
 */
export function gesteAiguillage(input: {
  actuelle: PorteBC | null;
  centreVoulu: CentreBC;
  montantAvant?: number | null;
  montantApres?: number | null;
  /** Le BC a-t-il été modifié par la personne (et non simplement relu) ? */
  modifie?: boolean;
}): GesteAiguillage {
  const { actuelle, centreVoulu } = input;
  if (!actuelle) return { geste: "POSER" };
  if (actuelle.source === "POSTE") return { geste: "RIEN" };

  const avant = input.montantAvant ?? null;
  const apres = input.montantApres ?? null;
  const montantChange = avant !== apres;

  switch (actuelle.etat) {
    case "EN_ATTENTE":
      if (actuelle.centre !== centreVoulu) return { geste: "TRANSFERER" };
      return montantChange && input.modifie ? { geste: "ACTUALISER" } : { geste: "RIEN" };
    case "VALIDE":
      if (avant != null && apres != null && apres > avant) {
        return {
          geste: "ROUVRIR",
          motif: `Montant relevé de ${avant.toLocaleString("fr-FR")} à ${apres.toLocaleString("fr-FR")} DZD après validation.`,
        };
      }
      return { geste: "RIEN" };
    case "A_REVOIR":
      return input.modifie ? { geste: "ROUVRIR", motif: "Bon de commande corrigé à la demande du centre." } : { geste: "RIEN" };
    case "REFUSE":
      return { geste: "RIEN" };
  }
}

/**
 * LE CHANTIER « BON DE COMMANDE » D'UN DOSSIER PEUT-IL SE CLORE ?
 *
 * Il se refermait d'un clic, sans pièce : le circuit court du matériel promotionnel déclarait « BC
 * fait » sans qu'aucun BC n'existe nulle part, et donc sans qu'aucun centre l'ait vu. Il faut
 * maintenant deux faits : AU MOINS UN bon de commande enregistré depuis le dossier, et TOUS
 * validés par leur centre. Un seul BC encore en attente — ou refusé — suffit à tenir le chantier
 * ouvert : clore sur « deux sur trois » serait déclarer fait ce qui ne l'est pas.
 *
 * Un BC SANS porte (enregistré avant la règle) ne passe pas non plus : il n'a été vu par aucun
 * centre. Le refus nomme le geste qui le lui soumet — « Adresser au centre », sur sa fiche Legal.
 */
export function chantierBCClos(bcs: readonly { reference: string | null; porte: PorteBC | null }[]):
  { ok: true } | { ok: false; raison: string } {
  if (bcs.length === 0) {
    return {
      ok: false,
      raison: "Aucun bon de commande n'est enregistré sur ce dossier. Enregistrez-le depuis « Pièces liées » "
        + "(Engagement › Bon de commande) : il passera au centre de validation, et le chantier se clôt une fois le BC validé.",
    };
  }
  const nom = (r: string | null) => (r?.trim() ? r.trim() : "sans numéro");
  const sansPorte = bcs.filter((b) => !b.porte);
  if (sansPorte.length > 0) {
    return {
      ok: false,
      raison: `${sansPorte.length === 1 ? "Le bon de commande" : "Les bons de commande"} ${sansPorte.map((b) => nom(b.reference)).join(", ")} `
        + `n'${sansPorte.length === 1 ? "a" : "ont"} été vu${sansPorte.length === 1 ? "" : "s"} par aucun centre : ouvrez sa fiche Legal et « Adressez-le au centre ».`,
    };
  }
  const enAttente = bcs.filter((b) => b.porte!.etat !== "VALIDE");
  if (enAttente.length > 0) {
    const detail = enAttente.map((b) => `${nom(b.reference)} (${LIBELLE_ETAT_BC[b.porte!.etat].toLowerCase()})`).join(", ");
    return { ok: false, raison: `Bon(s) de commande pas encore validé(s) par leur centre : ${detail}. Le chantier se clôt une fois tous validés.` };
  }
  return { ok: true };
}
