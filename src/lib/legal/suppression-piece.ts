/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SUPPRIMER UNE PIÈCE LEGAL, OU SES FICHIERS — ce qui l'interdit, et le geste qui le lève (§118.209).
 *
 * « On doit pouvoir SUPPRIMER les documents dans les demandes Ad & Pro » (Direction, 05/10) : un devis
 * déposé par erreur, un BC en double, un PDF mal scanné. Ces pièces ne se géraient que dans Legal. Le
 * bloc des pièces de la demande offre désormais le geste — et c'est ICI que se décide ce qu'il ne doit
 * JAMAIS emporter : ce qui a quitté l'ERP ou engagé la société.
 *
 * ── DEUX QUESTIONS, DEUX DÉCISIONS ───────────────────────────────────────────────────────────
 *
 *   • la PIÈCE : peut-on la retirer du registre ? (corbeille, réversible) — refusée quand elle est
 *     signée, réglée, partie au règlement, validée par un centre, quand une autre pièce en découle ou
 *     qu'un poste la porte : la supprimer casserait la chaîne devis → bon de commande → facture, ou
 *     effacerait la justification d'un fait réel ;
 *   • ses FICHIERS : peut-on en retirer un ? Plus étroit que la pièce — un PDF mal scanné d'un devis qui
 *     a un BC se remplace —, mais fermé dès que la pièce est ENGAGÉE : le PDF d'un bon de commande
 *     signé EST ce qui a été signé, celui d'une facture réglée est ce qui a été payé.
 *
 * Chaque refus NOMME le geste qui reste (annuler plutôt que supprimer, annuler d'abord l'aval, retirer
 * depuis la carte du poste) : un refus qui ne dit pas quoi faire fait chercher une panne qui n'existe pas.
 *
 * Module PUR, zéro import : la lecture en base (`queries/suppression-piece.ts`), le registre de
 * suppression et l'écran de la demande lisent la même décision — deux copies de « qu'est-ce qui
 * empêche » finiraient par dire deux choses (§118.5).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FaitsPieceASupprimer {
  titre: string;
  reference: string | null;
  /** La nature (`LegalDocKind`) : « INVOICE », « PURCHASE_ORDER », « QUOTE »… */
  kind: string;
  /** La pièce porte une signature (date ou signataire). */
  signee: boolean;
  /** Une facture dont la date de règlement ou l'écriture de trésorerie est posée : l'argent est parti. */
  reglee: boolean;
  /** L'ordre de dépense ouvert pour la payer — `null` : jamais envoyée au règlement. */
  ordre: { reference: string | null; statut: "PENDING" | "REVISION_REQUESTED" | "PAID" | "CANCELLED" } | null;
  /** Les pièces qui DÉCOULENT de celle-ci (`chainFromId`) : BC d'un devis, facture d'un BC, avoir d'une facture. */
  aval: { kind: string; titre: string; reference: string | null; annulee: boolean }[];
  /** Le titre du renouvellement, s'il y en a un (le lien vers l'ancienne pièce interdit de l'effacer). */
  renouvelePar: string | null;
  /** Les postes Ad & Pro qui portent cette pièce — elle se gère depuis leur carte. */
  postes: string[];
  /** Le centre qui a VALIDÉ ce bon de commande (« centre de validation Ad & Pro »), sinon `null`. */
  valideParLeCentre: string | null;
  /** Lignes de facture dont le matériel est entré au magasin (§118.165). */
  receptionsAuStock: number;
}

const nom = (f: { titre: string; reference: string | null }) => `« ${f.reference ?? f.titre} »`;

/** La nature dans une phrase — et son GENRE : « signée » pour une facture, « signé » pour un bon de commande. */
const NATURES: Record<string, { nom: string; f: boolean }> = {
  QUOTE: { nom: "le devis", f: false },
  PURCHASE_ORDER: { nom: "le bon de commande", f: false },
  INVOICE: { nom: "la facture", f: true },
  CREDIT_NOTE: { nom: "l'avoir", f: false },
};
const natureDe = (kind: string) => NATURES[kind]?.nom ?? "la pièce";
/** « e » si la nature est féminine : une pièce inconnue est « la pièce ». */
const e = (kind: string) => (NATURES[kind]?.f ?? true ? "e" : "");
const Il = (kind: string) => (NATURES[kind]?.f ?? true ? "Elle" : "Il");
const nombrer = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

/** La liste d'au plus trois noms, le reste COMPTÉ (§118.60). */
function enumerer(noms: string[]): string {
  if (noms.length <= 3) return noms.join(", ");
  return `${noms.slice(0, 3).join(", ")} et ${nombrer(noms.length - 3, "autre", "autres")}`;
}

/** Ce qui ENGAGE la pièce — la même lecture pour la pièce et pour ses fichiers. */
export function motifDEngagement(f: FaitsPieceASupprimer): string | null {
  const sujet = `${natureDe(f.kind)} ${nom(f)}`;
  if (f.ordre?.statut === "PAID") {
    return `${sujet} est réglé${e(f.kind)} : l'ordre de dépense${f.ordre.reference ? ` ${f.ordre.reference}` : ""} a été payé — la pièce est la justification de cet argent parti`;
  }
  if (f.reglee) return `${sujet} est réglé${e(f.kind)} : la pièce est la justification de l'argent parti`;
  if (f.signee) return `${sujet} est signé${e(f.kind)} : ${Il(f.kind).toLowerCase()} a engagé la société`;
  if (f.valideParLeCentre) return `${sujet} a été validé par le ${f.valideParLeCentre} : ${Il(f.kind).toLowerCase()} engage la société`;
  if (f.ordre && f.ordre.statut !== "CANCELLED") {
    return `${sujet} est parti${e(f.kind)} au règlement (ordre de dépense ${f.ordre.reference ?? "ouvert"}) : le centre de paiement attend de ${e(f.kind) ? "la" : "le"} payer`;
  }
  return null;
}

/** Le geste qui reste quand la pièce est engagée — lu par la pièce et par ses fichiers. */
function remedeEngagement(f: FaitsPieceASupprimer): string {
  if (f.ordre?.statut === "PAID" || f.reglee) return "Une erreur se corrige par un avoir (fiche Legal › « Émettre un avoir »), jamais en effaçant la pièce.";
  if (f.ordre && f.ordre.statut !== "CANCELLED") return "Annulez la pièce, motif à l'appui (fiche Legal › Annuler) : l'annulation retire l'ordre non réglé du centre, et la pièce reste à l'historique.";
  return `Annulez-${e(f.kind) ? "la" : "le"} plutôt, motif à l'appui (fiche Legal › Annuler) : ${Il(f.kind).toLowerCase()} reste à l'historique, et ne rappelle plus rien.`;
}

/**
 * LA PIÈCE PEUT-ELLE ÊTRE SUPPRIMÉE ? `null` : oui. Sinon la phrase qui dit pourquoi, et quoi faire.
 * L'ordre des refus est celui de la gravité : ce qui a quitté l'ERP d'abord, ce qui lie ensuite.
 */
export function refusSuppressionPiece(f: FaitsPieceASupprimer): string | null {
  const engagement = motifDEngagement(f);
  if (engagement) return `${capitaliser(engagement)}. ${Il(f.kind)} ne se supprime pas. ${remedeEngagement(f)}`;

  if (f.receptionsAuStock > 0) {
    return `Du matériel de ${natureDe(f.kind)} ${nom(f)} est entré au magasin (${nombrer(f.receptionsAuStock, "ligne reçue", "lignes reçues")}) : la facture est la cause de cette entrée. Annulez d'abord la réception, depuis le dossier du matériel promotionnel.`;
  }

  if (f.aval.length > 0) {
    const noms = enumerer(f.aval.map((a) => `${a.reference ?? a.titre}${a.annulee ? " (annulé)" : ""}`));
    const genres = [...new Set(f.aval.map((a) => natureDe(a.kind).replace(/^(le|la|l') ?/, "")))];
    return `${capitaliser(natureDe(f.kind))} ${nom(f)} est la base ${f.aval.length > 1 ? `de ${f.aval.length} autres pièces` : "d'une autre pièce"} (${genres.join(", ")} : ${noms}) : la chaîne devis → bon de commande → facture ne se coupe pas par le milieu. Supprimez d'abord ${f.aval.length > 1 ? "celles-ci" : "celle-ci"}, en partant de la fin de la chaîne.`;
  }

  if (f.renouvelePar) {
    return `${capitaliser(natureDe(f.kind))} ${nom(f)} a été renouvelé${e(f.kind)} par « ${f.renouvelePar} » : le renouvellement pointe vers ${e(f.kind) ? "elle" : "lui"}. Supprimez d'abord le renouvellement.`;
  }

  if (f.postes.length > 0) {
    return `${capitaliser(natureDe(f.kind))} ${nom(f)} est rattaché${e(f.kind)} au poste « ${enumerer(f.postes)} » : une pièce de poste se retire depuis la carte de son poste, qui sait ce que le poste attend d'elle.`;
  }
  return null;
}

/**
 * UN FICHIER DE LA PIÈCE PEUT-IL ÊTRE RETIRÉ ? Plus étroit que la pièce : seul l'engagement le ferme.
 * Le PDF d'un devis qui a un BC se remplace ; celui d'un BC signé est ce qui a été signé.
 */
export function refusSuppressionFichiers(f: FaitsPieceASupprimer): string | null {
  const engagement = motifDEngagement(f);
  if (!engagement) return null;
  return `Les fichiers de cette pièce ne se suppriment pas d'ici : ${engagement} — son PDF est ce qui a été signé, validé ou payé. ${remedeEngagement(f)}`;
}

function capitaliser(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
