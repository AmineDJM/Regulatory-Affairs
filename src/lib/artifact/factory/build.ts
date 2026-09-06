/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONSTRUCTEUR DE PIÈCES COMMERCIALES — un devis, un bon de commande ou une facture,
 * composé par le code, relu par l'adaptateur, contrôlé avant d'exister.
 *
 * ── LA MISE EN PAGE EST DU CODE, PAS UN GABARIT À TROUS ─────────────────────────────────
 *
 * Un gabarit Word à remplir laisse des « [CLIENT] » quand un champ manque, et personne ne le
 * voit avant l'envoi. Ici la pièce est COMPOSÉE : chaque bloc n'apparaît que si sa donnée
 * existe, les colonnes du tableau se décident d'après les lignes (pas de colonne « Remise » vide
 * sur trente lignes), et les montants viennent de `commercial.ts`, jamais de la spécification.
 *
 * ── CE QU'ON LIVRE EST CE QU'ON A RELU ──────────────────────────────────────────────────
 *
 * Le `.docx` produit est ROUVERT par l'adaptateur du Live Office — le même que pour éditer un
 * contrat — et le contrôle avant livraison tourne sur ce modèle relu. On y vérifie en plus que
 * le numéro, le nom du tiers, le total TTC et le montant en lettres s'y LISENT. Si l'un manque,
 * `ok` est faux et l'appelant n'écrit rien.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { controlerAvantLivraison, type ControleLivraison } from "@/lib/artifact/qa/checks";
import type { DocxModel } from "@/lib/artifact/object-model/model";
import {
  ajouterJours, calculerTotaux, formaterDateFr, formaterDzd, formaterMontant, formaterQuantite, formaterTaux,
  LIBELLE_MODE, LIBELLE_TYPE, verifierSpecCommerciale,
  type PartieCommerciale, type SpecDocumentCommercial, type TotauxCommerciaux,
} from "@/lib/artifact/factory/commercial";
import { composerDocx, paragraphe, tableau, vide, type Cellule, type ColonneTableau, type Fragment } from "@/lib/artifact/factory/word";

export interface VerificationDocument extends ControleLivraison {
  /** Ce que la relecture du fichier produit a trouvé — des faits, pas des intentions. */
  relu: { paragraphes: number; tableaux: number; pages: number; numero: boolean; tiers: boolean; ttc: boolean; lettres: boolean };
}

export interface DocumentCommercialConstruit {
  octets: Buffer;
  verification: VerificationDocument;
  /** `null` quand la spécification est refusée avant tout calcul. */
  totaux: TotauxCommerciaux | null;
  surPapierEnTete: boolean;
  ms: number;
}

const LARGEUR_CM = 16;
const GRIS = "595959";
const NBSP = "\u00a0";
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const present = (v: string | null | undefined): v is string => !!v && v.trim() !== "";

/** Le bloc d'identité d'une partie, en fragments : nom en gras, puis les lignes qui existent. */
function blocPartie(titre: string, p: PartieCommerciale, accent: string, compact: boolean): Fragment[] {
  const lignes: string[] = [];
  if (!compact) {
    const forme = [p.formeJuridique, p.capital ? `au capital de ${p.capital}` : null].filter(present).join(" ");
    if (forme) lignes.push(forme);
    if (present(p.adresse)) lignes.push(p.adresse);
  }
  const ids1 = [p.rc ? `RC ${p.rc}` : null, p.nif ? `NIF ${p.nif}` : null].filter(present).join(" — ");
  const ids2 = [p.ai ? `AI ${p.ai}` : null, p.nis ? `NIS ${p.nis}` : null].filter(present).join(" — ");
  if (ids1) lignes.push(ids1);
  if (ids2) lignes.push(ids2);
  if (!compact) {
    const contact = [p.telephone ? `Tél. ${p.telephone}` : null, p.email].filter(present).join(" — ");
    if (contact) lignes.push(contact);
  }
  return [
    { texte: `${titre}\n`, gras: true, couleur: accent, taillePt: 8 },
    { texte: `${p.nom.trim()}${lignes.length ? "\n" : ""}`, gras: true },
    ...(lignes.length ? [{ texte: lignes.join("\n"), taillePt: 9 }] : []),
  ];
}

/** LES BLOCS DE LA PIÈCE, dans l'ordre de lecture. Exporté pour le banc et les tests. */
export function blocsCommerciaux(spec: SpecDocumentCommercial, t: TotauxCommerciaux): string[] {
  const accent = (spec.couleur ?? "0B2545").replace(/^#/, "");
  const libelle = LIBELLE_TYPE[spec.type];
  const blocs: string[] = [];

  // 1 — Le titre, et les parties face à face.
  blocs.push(paragraphe(`${libelle.toUpperCase()} N° ${spec.numero}`, { style: "Titre", couleur: accent }));
  if (present(spec.objet)) blocs.push(paragraphe([{ texte: "Objet : ", gras: true }, { texte: spec.objet }], { apresPt: 6 }));
  const roleTiers = spec.type === "BON_DE_COMMANDE" ? "FOURNISSEUR" : "CLIENT";
  blocs.push(tableau(
    [[blocPartie("ÉMETTEUR", spec.emetteur, accent, !!spec.surPapierEnTete), blocPartie(roleTiers, spec.tiers, accent, false)]],
    { colonnes: [{ largeurCm: LARGEUR_CM / 2 }, { largeurCm: LARGEUR_CM / 2 }], bordures: false, taillePt: 10 },
  ));
  blocs.push(vide(4));

  // 2 — Les références : seulement les lignes qui ont une valeur.
  const refs: [string, string][] = [["Date d'émission", formaterDateFr(spec.date)]];
  if (spec.type === "FACTURE") refs.push(["Échéance de règlement", spec.echeance ? formaterDateFr(spec.echeance) : "À réception"]);
  if (spec.type === "DEVIS") {
    const jours = spec.validiteJours ?? 30;
    refs.push(["Validité", `${jours} jours — jusqu'au ${formaterDateFr(ajouterJours(spec.date, jours))}`]);
  }
  if (spec.type === "BON_DE_COMMANDE") {
    if (present(spec.livraison?.delai)) refs.push(["Livraison souhaitée", spec.livraison!.delai!]);
    if (present(spec.livraison?.adresse)) refs.push(["Adresse de livraison", spec.livraison!.adresse!]);
  }
  if (present(spec.referenceAmont)) refs.push(["Référence", spec.referenceAmont]);
  if (spec.modePaiement) refs.push(["Mode de paiement", LIBELLE_MODE[spec.modePaiement]]);
  if (present(spec.conditionsPaiement)) refs.push(["Conditions de paiement", spec.conditionsPaiement]);
  blocs.push(tableau(refs.map(([k, v]) => [{ contenu: k, gras: true, couleur: GRIS }, v]), {
    colonnes: [{ largeurCm: 4.5 }, { largeurCm: LARGEUR_CM - 4.5 }], bordures: false, taillePt: 9.5,
  }));
  blocs.push(vide(6));

  // 3 — Les lignes : les colonnes se décident d'après ce qu'il y a à montrer.
  const avecUnite = t.lignes.some((l) => present(l.unite));
  const avecRemise = t.lignes.some((l) => l.remiseMontant > 0);
  const tauxDistincts = new Set(t.lignes.map((l) => l.taux)).size > 1;
  const colonnes: (ColonneTableau & { cle: string; titre: string })[] = [
    { cle: "n", titre: "N°", largeurCm: 0.9, alignement: "center" },
    { cle: "designation", titre: "Désignation", largeurCm: 0 },
    { cle: "qte", titre: "Qté", largeurCm: 1.5, alignement: "right" },
    ...(avecUnite ? [{ cle: "unite", titre: "Unité", largeurCm: 1.5, alignement: "center" as const }] : []),
    { cle: "pu", titre: `P.U. HT`, largeurCm: 2.5, alignement: "right" },
    ...(avecRemise ? [{ cle: "remise", titre: "Remise", largeurCm: 1.5, alignement: "right" as const }] : []),
    ...(tauxDistincts ? [{ cle: "tva", titre: "TVA", largeurCm: 1.3, alignement: "right" as const }] : []),
    { cle: "ht", titre: "Total HT", largeurCm: 2.7, alignement: "right" },
  ];
  const fixe = colonnes.reduce((s, c) => s + c.largeurCm, 0);
  colonnes.find((c) => c.cle === "designation")!.largeurCm = Math.round((LARGEUR_CM - fixe) * 100) / 100;
  const lignes: Cellule[][] = [colonnes.map((c) => c.titre)];
  for (const l of t.lignes) {
    const designation: Fragment[] = [{ texte: l.designation.trim() }];
    if (present(l.reference)) designation.push({ texte: `\nRéf. ${l.reference}`, taillePt: 8, couleur: GRIS });
    const cellule: Record<string, Cellule> = {
      n: String(l.n), designation, qte: formaterQuantite(l.quantite), unite: l.unite ?? "",
      pu: formaterMontant(l.prixUnitaire), remise: l.remiseMontant > 0 ? formaterTaux(l.remise ?? 0) : "—",
      tva: formaterTaux(l.taux), ht: formaterMontant(l.ht),
    };
    lignes.push(colonnes.map((c) => cellule[c.cle]));
  }
  blocs.push(tableau(lignes, { colonnes, entete: true, couleurEntete: accent, taillePt: 9.5 }));
  blocs.push(vide(4));

  // 4 — Les totaux, à droite, puis la somme en lettres.
  const totaux: Cellule[][] = [];
  const remises = t.remisesLignes > 0 || t.remiseGlobale > 0;
  if (remises) totaux.push(["Total HT brut", formaterMontant(t.totalHtBrut)]);
  if (t.remisesLignes > 0) totaux.push(["Remises sur lignes", `-${NBSP}${formaterMontant(t.remisesLignes)}`]);
  if (t.remiseGlobale > 0) totaux.push([`Remise globale (${formaterTaux(spec.remiseGlobale ?? 0)})`, `-${NBSP}${formaterMontant(t.remiseGlobale)}`]);
  totaux.push([remises ? "Total HT net" : "Total HT", formaterMontant(t.totalHt)]);
  for (const x of t.tva) totaux.push([`TVA ${formaterTaux(x.taux)}${tauxDistincts ? ` (base ${formaterMontant(x.base)})` : ""}`, formaterMontant(x.montant)]);
  if (t.timbre > 0) totaux.push(["Droit de timbre (règlement en espèces)", formaterMontant(t.timbre)]);
  totaux.push([{ contenu: "TOTAL TTC", gras: true }, { contenu: formaterDzd(t.totalTtc), gras: true }]);
  blocs.push(tableau(totaux, {
    colonnes: [{ largeurCm: 6.5 }, { largeurCm: 3.5, alignement: "right" }], position: "right", taillePt: 10,
    lignesEnGras: [totaux.length - 1], fondLignes: { [totaux.length - 1]: "E8EEF5" },
  }));
  blocs.push(vide(4));
  const arrete = spec.type === "FACTURE" ? "Arrêtée la présente facture" : spec.type === "DEVIS" ? "Arrêté le présent devis" : "Arrêté le présent bon de commande";
  blocs.push(paragraphe([{ texte: `${arrete} à la somme de : ` }, { texte: `${cap(t.enLettres)}.`, gras: true }], { apresPt: 8 }));

  // 5 — Conditions, notes, signatures.
  if (spec.type === "DEVIS") blocs.push(paragraphe(`Ce devis est valable ${spec.validiteJours ?? 30} jours à compter de sa date d'émission. Les prix s'entendent hors taxes, TVA en sus au taux en vigueur.`, { taillePt: 9, couleur: GRIS }));
  if (spec.type === "BON_DE_COMMANDE") blocs.push(paragraphe("Merci de rappeler le numéro de ce bon de commande sur le bon de livraison et sur la facture.", { taillePt: 9, couleur: GRIS }));
  if (present(spec.notes)) blocs.push(paragraphe(spec.notes.trim(), { taillePt: 9.5 }));
  blocs.push(vide(10));
  const gauche = spec.type === "DEVIS" ? "Bon pour accord\n(date, signature et cachet du client)" : spec.type === "BON_DE_COMMANDE" ? "Le fournisseur\n(accusé de réception)" : "";
  const droite = [`Pour ${spec.emetteur.nom.trim()}`, spec.signataire?.nom, spec.signataire?.qualite, "", "", "Signature et cachet"].filter((x) => x !== undefined && x !== null).join("\n");
  blocs.push(tableau([[{ contenu: gauche, couleur: GRIS }, { contenu: droite, alignement: "center" }]], {
    colonnes: [{ largeurCm: LARGEUR_CM / 2 }, { largeurCm: LARGEUR_CM / 2 }], bordures: false, taillePt: 9.5,
  }));

  // 6 — Les mentions de pied : l'identité complète, la banque pour une facture, le reste.
  const e = spec.emetteur;
  const mentions: string[] = [];
  if (!spec.surPapierEnTete) mentions.push([e.nom.trim(), e.formeJuridique, e.capital ? `au capital de ${e.capital}` : null, e.adresse].filter(present).join(" — "));
  const ids = [e.rc ? `RC ${e.rc}` : null, e.nif ? `NIF ${e.nif}` : null, e.ai ? `AI ${e.ai}` : null, e.nis ? `NIS ${e.nis}` : null].filter(present).join(" — ");
  if (ids) mentions.push(ids);
  if (spec.type === "FACTURE" && (present(e.banque) || present(e.rib))) mentions.push([e.banque ? `Banque : ${e.banque}` : null, e.rib ? `RIB ${e.rib}` : null].filter(present).join(" — "));
  for (const m of spec.piedDePage ?? []) if (present(m)) mentions.push(m.trim());
  if (mentions.length) {
    blocs.push(vide(8));
    blocs.push(paragraphe(mentions.join("\n"), { taillePt: 7.5, couleur: GRIS, alignement: "center" }));
  }
  return blocs;
}

/**
 * CONSTRUIT la pièce : vérifie la spécification, calcule, compose, RELIT et contrôle.
 * `ok` est faux si une règle bloque, si le fichier relu porte un défaut, ou si l'une des quatre
 * lectures de contrôle (numéro, tiers, TTC, lettres) échoue.
 */
export async function construireDocumentCommercial(
  spec: SpecDocumentCommercial,
  opts: { base?: Buffer | null; maintenant?: Date; police?: string | null; logo?: { octets: Buffer; png: boolean; largeurCm: number } | null } = {},
): Promise<DocumentCommercialConstruit> {
  const debut = Date.now();
  const regles = verifierSpecCommerciale(spec);
  const reluVide = { paragraphes: 0, tableaux: 0, pages: 0, numero: false, tiers: false, ttc: false, lettres: false };
  if (regles.bloquants.length > 0) {
    return { octets: Buffer.alloc(0), totaux: null, surPapierEnTete: false, ms: Date.now() - debut, verification: { ok: false, bloquants: regles.bloquants, avertissements: regles.avertissements, relu: reluVide } };
  }
  const totaux = calculerTotaux(spec);
  const specEffective: SpecDocumentCommercial = { ...spec, surPapierEnTete: !!opts.base && opts.base.length > 0 };
  const { octets, surPapierEnTete } = composerDocx({
    blocs: blocsCommerciaux(specEffective, totaux),
    base: opts.base ?? null,
    titre: `${LIBELLE_TYPE[spec.type]} ${spec.numero}`,
    auteur: spec.emetteur.nom,
    couleurTitres: spec.couleur ?? undefined,
    police: opts.police ?? undefined,
    logo: opts.base && opts.base.length > 0 ? null : opts.logo ?? null,
    maintenant: opts.maintenant,
  });

  // ── LA RELECTURE ─────────────────────────────────────────────────────────────────────
  const ouvert = await adaptateurDocx.ouvrir(octets);
  const m = ouvert.modele() as DocxModel;
  const controle = controlerAvantLivraison(m);
  const texte = [...m.paragraphs.map((p) => p.text), ...m.tables.flatMap((t) => t.cells.map((c) => c.text))].join("\n");
  const relu = {
    paragraphes: m.paragraphs.length,
    tableaux: m.tables.length,
    pages: m.pages,
    numero: texte.includes(spec.numero),
    tiers: texte.includes(spec.tiers.nom.trim()),
    ttc: texte.includes(formaterDzd(totaux.totalTtc)),
    lettres: texte.toLowerCase().includes(totaux.enLettres),
  };
  const bloquants = [...controle.bloquants];
  if (!relu.numero) bloquants.push(`Le numéro ${spec.numero} ne se lit pas dans le fichier produit.`);
  if (!relu.tiers) bloquants.push(`Le nom du tiers « ${spec.tiers.nom} » ne se lit pas dans le fichier produit.`);
  if (!relu.ttc) bloquants.push(`Le total TTC ${formaterDzd(totaux.totalTtc)} ne se lit pas dans le fichier produit.`);
  if (!relu.lettres) bloquants.push("Le montant en lettres ne se lit pas dans le fichier produit.");
  const avertissements = [...regles.avertissements, ...controle.avertissements];
  return {
    octets, totaux, surPapierEnTete, ms: Date.now() - debut,
    verification: { ok: bloquants.length === 0, bloquants, avertissements, relu },
  };
}
