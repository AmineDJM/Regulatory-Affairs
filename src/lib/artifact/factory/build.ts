/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONSTRUCTEUR DE PIÈCES COMMERCIALES — un devis, un bon de commande ou une facture,
 * composé par le code, relu par l'adaptateur, contrôlé avant d'exister.
 *
 * ── LA MISE EN PAGE EST CELLE DES PIÈCES RÉELLES DE LA SOCIÉTÉ ──────────────────────────
 *
 * Deux pièces de référence ont été remises par la Direction (septembre 2026) et ce module les
 * reproduit trait pour trait — parce qu'une facture « générique », même juste au centime, n'est
 * pas la facture de la société : le comptable du client la compare à la précédente.
 *
 *   • LA FACTURE (modèle Pharmagène) : le nom de la société en grand à gauche avec son siège,
 *     « Facture » à droite avec le numéro de client, le numéro et la date ; une bande
 *     « Facturer à : » au-dessus du client (et ses RC / NIF / AI en face) ; « Document Ref : » ;
 *     un tableau sans filets (Description · Quantité · Prix unitaire HT · Prix total HT) où une
 *     ligne de SECTION s'écrit en gras sans chiffre ; en bas, la bande « Arrêtée la présente
 *     facture à la somme de : », le montant, la somme en lettres EN CAPITALES, et à droite
 *     SOUS-TOTAL · TAUX DE TVA · MONTANT TVA · TOTAL TTC · SOMME À PAYER ; puis le mode de
 *     paiement en capitales, centré.
 *
 *   • LE BON DE COMMANDE (modèle Adventum) : « B.C : N° … » ; deux blocs face à face — « A : »
 *     (le fournisseur) et « Adresse de livraison : » (le siège de la société) ; une bande de
 *     références (Date · Contact · Devis N° · Modalités de paiement) ; un tableau
 *     (Désignation · Qte · PU HT · Total HT) où la désignation est en gras et ses LIGNES DE
 *     DÉTAIL en dessous, où « Offert » remplace un prix nul, où une SECTION est une ligne grisée
 *     (« Campagne Raltégravir »), et dont les DERNIÈRES lignes sont les totaux à droite — Total
 *     HT, taxes additionnelles (« Taxe Pub 2 % »), « Frais TVA 19 % », Montant TTC — fermées par
 *     un seul filet ; puis « Arrêté le présent bon de commande à la somme de : » et les lettres.
 *     Le DEVIS emprunte cette mise en page (c'est la même famille de pièce), avec la validité à
 *     la place du devis amont et un « Bon pour accord ».
 *
 * Un gabarit Word à remplir laisserait des « [CLIENT] » quand un champ manque ; ici chaque bloc
 * n'apparaît que si sa donnée existe, les colonnes optionnelles (Unité, Remise, TVA) ne se
 * montrent que si une ligne les porte, et les montants viennent de `commercial.ts`, jamais de la
 * spécification. L'en-tête graphique (logo) et le pied officiel viennent du PAPIER EN-TÊTE de la
 * société quand il existe ; sans papier, l'identité légale est imprimée en pied par le code.
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
  type LigneCalculee, type PartieCommerciale, type SpecDocumentCommercial, type TotauxCommerciaux,
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
const GRIS_TITRE = "404040";
const GRIS_SECTION = "E7E6E6";
const NBSP = " ";
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const present = (v: string | null | undefined): v is string => !!v && v.trim() !== "";
const lignesDe = (s: string): string[] => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** La couleur d'accent de la pièce : celle de la charte de la société, sinon le bleu de la maison. */
const accentDe = (spec: SpecDocumentCommercial): string => (spec.couleur ?? "0B2545").replace(/^#/, "");

/** « 145 000,00 DZD », ou « Offert » quand le prix est nul — c'est ainsi que la société l'écrit. */
const montantOuOffert = (montant: number, prixUnitaire: number, avecDevise: boolean): string =>
  prixUnitaire === 0 ? "Offert" : avecDevise ? formaterDzd(montant) : formaterMontant(montant);

/** Le mode de règlement en capitales — « PAIEMENT PAR CHÈQUE OU VIREMENT BANCAIRE » sur la référence. */
function phrasePaiement(spec: SpecDocumentCommercial): string[] {
  const out: string[] = [];
  const mode = spec.modePaiement;
  if (mode === "VIREMENT") out.push("PAIEMENT PAR VIREMENT BANCAIRE");
  else if (mode === "CHEQUE") out.push("PAIEMENT PAR CHÈQUE");
  else if (mode === "ESPECES") out.push("PAIEMENT EN ESPÈCES");
  if (present(spec.conditionsPaiement)) out.push(spec.conditionsPaiement.trim().toUpperCase());
  return out;
}

/** Les identifiants fiscaux d'une partie, en une ligne (« RC N° : … | NIF : … | AI : … | NIS : … »). */
function ligneIdentifiants(p: PartieCommerciale): string {
  return [p.rc ? `RC N° : ${p.rc}` : null, p.nif ? `NIF : ${p.nif}` : null, p.ai ? `AI : ${p.ai}` : null, p.nis ? `NIS : ${p.nis}` : null]
    .filter(present).join("  |  ");
}

/**
 * LES COLONNES DU TABLEAU DES LIGNES — fixes dans l'ordre de la pièce de référence, avec les
 * trois colonnes OPTIONNELLES (Unité, Remise, TVA) qui n'apparaissent que si une ligne les porte.
 */
interface Colonne extends ColonneTableau { cle: "designation" | "unite" | "qte" | "remise" | "tva" | "pu" | "ht"; titre: string }

function colonnesLignes(t: TotauxCommerciaux, titres: Record<Colonne["cle"], string>, largeurs: Record<Exclude<Colonne["cle"], "designation">, number>): Colonne[] {
  const chiffrees = t.lignes.filter((l) => !l.section);
  const avecUnite = chiffrees.some((l) => present(l.unite));
  const avecRemise = chiffrees.some((l) => l.remiseMontant > 0);
  const tauxDistincts = new Set(chiffrees.map((l) => l.taux)).size > 1;
  const colonnes: Colonne[] = [
    { cle: "designation", titre: titres.designation, largeurCm: 0 },
    ...(avecUnite ? [{ cle: "unite" as const, titre: titres.unite, largeurCm: largeurs.unite, alignement: "center" as const }] : []),
    { cle: "qte", titre: titres.qte, largeurCm: largeurs.qte, alignement: "center" },
    ...(avecRemise ? [{ cle: "remise" as const, titre: titres.remise, largeurCm: largeurs.remise, alignement: "center" as const }] : []),
    ...(tauxDistincts ? [{ cle: "tva" as const, titre: titres.tva, largeurCm: largeurs.tva, alignement: "center" as const }] : []),
    { cle: "pu", titre: titres.pu, largeurCm: largeurs.pu, alignement: "right" },
    { cle: "ht", titre: titres.ht, largeurCm: largeurs.ht, alignement: "right" },
  ];
  const fixe = colonnes.reduce((s, c) => s + c.largeurCm, 0);
  colonnes[0].largeurCm = Math.round((LARGEUR_CM - fixe) * 100) / 100;
  return colonnes;
}

/** La désignation et ses lignes de détail, dans une seule cellule. */
function celluleDesignation(l: LigneCalculee, o: { grasDesignation: boolean; detailsTaillePt: number; detailsCouleur?: string }): Fragment[] {
  const frags: Fragment[] = [{ texte: l.designation.trim(), gras: o.grasDesignation }];
  for (const d of l.details ?? []) if (present(d)) frags.push({ texte: `\n${d.trim()}`, gras: false, taillePt: o.detailsTaillePt, couleur: o.detailsCouleur });
  if (present(l.reference)) frags.push({ texte: `\nRéf. ${l.reference.trim()}`, gras: false, taillePt: 8, couleur: GRIS });
  return frags;
}

/** La cellule d'une colonne chiffrée pour une ligne. */
function celluleChiffree(cle: Colonne["cle"], l: LigneCalculee, avecDevise: boolean): Cellule {
  switch (cle) {
    case "unite": return l.unite ?? "";
    case "qte": return formaterQuantite(l.quantite);
    case "remise": return l.remiseMontant > 0 ? formaterTaux(l.remise ?? 0) : "—";
    case "tva": return formaterTaux(l.taux);
    case "pu": return montantOuOffert(l.prixUnitaire, l.prixUnitaire, avecDevise);
    case "ht": return montantOuOffert(l.ht, l.prixUnitaire, avecDevise);
    default: return "";
  }
}

/** Le bloc du signataire, à droite — seulement quand la société en a désigné un. */
function blocSignataire(spec: SpecDocumentCommercial, gauche: string): string[] {
  if (!spec.signataire && !gauche) return [];
  const droite = spec.signataire
    ? [`Pour ${spec.emetteur.nom.trim()}`, spec.signataire.nom, spec.signataire.qualite, "", "", "Signature et cachet"].filter((x): x is string => typeof x === "string").join("\n")
    : "";
  return [
    vide(10),
    tableau([[{ contenu: gauche, couleur: GRIS }, { contenu: droite, alignement: "center" }]], {
      colonnes: [{ largeurCm: LARGEUR_CM / 2 }, { largeurCm: LARGEUR_CM / 2 }], bordures: false, taillePt: 9.5,
    }),
  ];
}

/** Le pied d'identité que le code imprime QUAND il n'y a pas de papier en-tête pour le porter. */
function piedIdentite(spec: SpecDocumentCommercial): string[] {
  const e = spec.emetteur;
  const lignes: string[] = [];
  if (!spec.surPapierEnTete) {
    const siege = [e.nom.trim(), e.formeJuridique, e.capital ? `au capital de ${e.capital}` : null, e.adresse ? `Siège Social : ${e.adresse}` : null, e.telephone ? `Tél. ${e.telephone}` : null, e.email]
      .filter(present).join(" — ");
    if (siege) lignes.push(siege);
    const ids = ligneIdentifiants(e);
    if (ids) lignes.push(ids);
  }
  if (spec.type === "FACTURE" && (present(e.banque) || present(e.rib))) lignes.push([e.banque ? `Banque : ${e.banque}` : null, e.rib ? `RIB ${e.rib}` : null].filter(present).join(" — "));
  for (const m of spec.piedDePage ?? []) if (present(m)) lignes.push(m.trim());
  if (!lignes.length) return [];
  return [vide(8), paragraphe(lignes.join("\n"), { taillePt: 7.5, couleur: GRIS, alignement: "center" })];
}

// ═══════════════════════════════ LA FACTURE ═══════════════════════════════

function blocsFacture(spec: SpecDocumentCommercial, t: TotauxCommerciaux): string[] {
  const accent = accentDe(spec);
  const e = spec.emetteur;
  const c = spec.tiers;
  const blocs: string[] = [];

  // 1 — L'émetteur en grand à gauche ; « Facture » et ses références à droite.
  const refs: [string, string][] = [
    ["Numéro de client :", present(spec.numeroClient) ? spec.numeroClient.trim() : "—"],
    ["Numéro de facture :", spec.numero],
    ["Date de facture :", formaterDateFr(spec.date)],
  ];
  if (spec.echeance) refs.push(["Échéance :", formaterDateFr(spec.echeance)]);
  const gauche: Cellule[] = [
    { contenu: [{ texte: e.nom.trim(), gras: true, taillePt: 16, couleur: accent }], fusion: 2 },
    { contenu: present(e.adresse) ? [{ texte: "Siège Social : ", gras: false }, { texte: e.adresse.trim() }] : "", fusion: 2 },
  ];
  const lignesEntete: Cellule[][] = [[gauche[0], { contenu: [{ texte: "Facture", taillePt: 18, couleur: GRIS_TITRE }], fusion: 2 }]];
  refs.forEach(([k, v], i) => lignesEntete.push([gauche[i + 1] ?? { contenu: "", fusion: 2 }, { contenu: k, couleur: GRIS }, { contenu: v, alignement: "center" }]));
  blocs.push(tableau(lignesEntete, {
    colonnes: [{ largeurCm: 4.6 }, { largeurCm: 4.6 }, { largeurCm: 3.6 }, { largeurCm: 3.2, alignement: "center" }], bordures: false, taillePt: 10,
  }));
  blocs.push(vide(6));

  // 2 — « Facturer à : » — la bande, puis le client à gauche et ses identifiants en face.
  const colsClient: ColonneTableau[] = [{ largeurCm: 8.4 }, { largeurCm: 0.8 }, { largeurCm: 6.8 }];
  blocs.push(tableau([[{ contenu: [{ texte: "Facturer à :", gras: true, couleur: "FFFFFF" }], fond: accent }, "", { contenu: "", fond: accent }]], { colonnes: colsClient, bordures: false, taillePt: 10 }));
  const client: Fragment[] = [{ texte: c.nom.trim(), gras: true, taillePt: 10.5 }];
  if (present(c.adresse)) for (const l of lignesDe(c.adresse)) client.push({ texte: `\n${l}` });
  if (present(c.telephone)) client.push({ texte: "\nTél/Fax : ", gras: true }, { texte: c.telephone.trim() });
  if (present(c.email)) client.push({ texte: `\n${c.email.trim()}` });
  const ids: Fragment[] = [
    { texte: `RC : ${present(c.rc) ? c.rc.trim() : "—"}` },
    { texte: `\nNIF : ${present(c.nif) ? c.nif.trim() : "—"}` },
    { texte: `\nAI : ${present(c.ai) ? c.ai.trim() : "—"}` },
    ...(present(c.nis) ? [{ texte: `\nNIS : ${c.nis.trim()}` }] : []),
  ];
  blocs.push(tableau([[client, "", ids]], { colonnes: colsClient, bordures: false, taillePt: 10 }));
  blocs.push(vide(8));

  // 3 — « Document Ref : » — l'objet, ou la pièce amont.
  const ref = [spec.objet, spec.referenceAmont ? `${spec.referenceAmont}${spec.referenceAmontDate ? ` du ${formaterDateFr(spec.referenceAmontDate)}` : ""}` : null].filter(present).join(" — ");
  blocs.push(paragraphe([{ texte: "Document Ref : ", couleur: GRIS }, { texte: ref }], { taillePt: 10, apresPt: 2 }));

  // 4 — Les lignes : sans filets, la bande d'en-tête à la couleur de la société.
  const colonnes = colonnesLignes(t,
    { designation: "Description", unite: "Unité", qte: "Quantité", remise: "Remise", tva: "TVA", pu: "Prix unitaire HT", ht: "Prix total HT" },
    { unite: 1.6, qte: 2.0, remise: 1.6, tva: 1.4, pu: 3.2, ht: 3.0 });
  const lignes: Cellule[][] = [colonnes.map((col) => col.titre)];
  for (const l of t.lignes) {
    if (l.section) {
      lignes.push(colonnes.map((col) => (col.cle === "designation" ? celluleDesignation(l, { grasDesignation: true, detailsTaillePt: 9 }) : col.cle === "ht" ? "-" : "")));
      continue;
    }
    lignes.push(colonnes.map((col) => (col.cle === "designation" ? celluleDesignation(l, { grasDesignation: false, detailsTaillePt: 9, detailsCouleur: GRIS }) : celluleChiffree(col.cle, l, false))));
  }
  blocs.push(tableau(lignes, { colonnes, entete: true, couleurEntete: accent, bordures: false, taillePt: 10 }));
  blocs.push(vide(10));

  // 5 — En bas : la somme arrêtée à gauche, les totaux à droite — dans un seul tableau, pour
  //     qu'ils restent face à face quelle que soit la police du lecteur.
  const remises = t.remisesLignes > 0 || t.remiseGlobale > 0;
  const droite: [string, string, boolean?][] = [];
  if (remises) {
    droite.push(["SOUS-TOTAL BRUT :", formaterMontant(t.totalHtBrut)]);
    if (t.remisesLignes > 0) droite.push(["REMISES SUR LIGNES :", `-${NBSP}${formaterMontant(t.remisesLignes)}`]);
    if (t.remiseGlobale > 0) droite.push([`REMISE GLOBALE (${formaterTaux(spec.remiseGlobale ?? 0)}) :`, `-${NBSP}${formaterMontant(t.remiseGlobale)}`]);
    droite.push(["SOUS-TOTAL NET :", formaterMontant(t.totalHt)]);
  } else droite.push(["SOUS-TOTAL :", formaterMontant(t.totalHt)]);
  for (const x of t.taxes) droite.push([`${x.libelle.toUpperCase()} ${formaterTaux(x.taux)} :`, formaterMontant(x.montant)]);
  if (t.tva.length === 1) {
    droite.push(["TAUX DE TVA :", formaterTaux(t.tva[0].taux)]);
    droite.push(["MONTANT TVA :", formaterMontant(t.tva[0].montant)]);
  } else {
    for (const x of t.tva) droite.push([`TVA ${formaterTaux(x.taux)} (base ${formaterMontant(x.base)}) :`, formaterMontant(x.montant)]);
    droite.push(["MONTANT TVA :", formaterMontant(t.totalTva)]);
  }
  if (t.timbre > 0) droite.push(["DROIT DE TIMBRE :", formaterMontant(t.timbre)]);
  droite.push(["TOTAL TTC :", formaterMontant(t.totalTtc)]);
  droite.push(["SOMME À PAYER :", formaterMontant(t.totalTtc), true]);
  const gaucheBas: Cellule[] = [
    { contenu: [{ texte: "Arrêtée la présente facture à la somme de :", gras: true, couleur: "FFFFFF" }], fond: accent },
    { contenu: formaterMontant(t.totalTtc), alignement: "right", gras: true },
    { contenu: t.enLettres.toUpperCase() },
  ];
  const nb = Math.max(gaucheBas.length, droite.length);
  const bas: Cellule[][] = [];
  for (let i = 0; i < nb; i++) {
    const d = droite[i];
    bas.push([
      gaucheBas[i] ?? "",
      "",
      d ? { contenu: d[0], alignement: "right", gras: true, couleur: d[2] ? undefined : GRIS } : "",
      d ? { contenu: d[1], alignement: "right", gras: !!d[2] } : "",
    ]);
  }
  blocs.push(tableau(bas, { colonnes: [{ largeurCm: 8.4 }, { largeurCm: 0.8 }, { largeurCm: 4.0 }, { largeurCm: 2.8 }], bordures: false, taillePt: 10 }));
  blocs.push(vide(10));

  // 6 — Le règlement, en capitales et centré ; puis les notes.
  const paiement = phrasePaiement(spec);
  if (paiement.length) blocs.push(paragraphe(paiement.join("\n"), { taillePt: 9, gras: true, couleur: GRIS, alignement: "center" }));
  if (present(spec.notes)) blocs.push(paragraphe(spec.notes.trim(), { taillePt: 9.5 }));

  // 7 — Signataire (s'il y en a un), pied d'identité (sans papier en-tête), banque.
  blocs.push(...blocSignataire(spec, ""));
  blocs.push(...piedIdentite(spec));
  return blocs;
}

// ═══════════════════ LE BON DE COMMANDE — ET LE DEVIS, SA FAMILLE ═══════════════════

function blocsCommande(spec: SpecDocumentCommercial, t: TotauxCommerciaux): string[] {
  const accent = accentDe(spec);
  const estDevis = spec.type === "DEVIS";
  const e = spec.emetteur;
  const c = spec.tiers;
  const blocs: string[] = [];

  // 1 — « B.C : N° 012/DG/2026 ».
  blocs.push(paragraphe([{ texte: estDevis ? "DEVIS" : "B.C", gras: true, couleur: accent }, { texte: ` : N° ${spec.numero}` }], { taillePt: 10.5, apresPt: 12 }));

  // 2 — « A : » le fournisseur (ou le client) ; en face, l'adresse de livraison (ou l'émetteur).
  const gauche: Fragment[] = [{ texte: estDevis ? "Client :" : "A :", gras: true }, { texte: "\nSociété : ", gras: true }, { texte: c.nom.trim() }];
  if (present(c.adresse)) { const [premiere, ...suite] = lignesDe(c.adresse); gauche.push({ texte: "\nAdresse : ", gras: true }, { texte: premiere }); for (const l of suite) gauche.push({ texte: `\n${l}` }); }
  if (present(c.telephone)) gauche.push({ texte: `\n${c.telephone.trim()}`, gras: true });
  if (present(c.email)) gauche.push({ texte: `\n${c.email.trim()}` });
  const idsTiers = [c.rc ? `RC : ${c.rc}` : null, c.nif ? `NIF : ${c.nif}` : null, c.ai ? `AI : ${c.ai}` : null].filter(present).join("  |  ");
  if (idsTiers) gauche.push({ texte: `\n${idsTiers}`, taillePt: 8.5, couleur: GRIS });
  const droite: Fragment[] = [];
  if (estDevis) {
    droite.push({ texte: "Émetteur :", gras: true }, { texte: `\n${e.nom.trim()}`, gras: true });
    if (present(e.adresse)) droite.push({ texte: "\nSiège Social : ", gras: true }, { texte: e.adresse.trim() });
    if (present(e.telephone)) droite.push({ texte: "\nTEL : ", gras: true }, { texte: e.telephone.trim(), gras: true });
    if (present(e.email)) droite.push({ texte: `\n${e.email.trim()}` });
  } else {
    const adresseLivraison = present(spec.livraison?.adresse) ? spec.livraison!.adresse!.trim() : (present(e.adresse) ? e.adresse.trim() : "");
    droite.push({ texte: "Adresse de livraison :", gras: true });
    if (adresseLivraison) droite.push({ texte: "\nSiège Social : ", gras: true }, { texte: adresseLivraison });
    droite.push({ texte: `\n${e.nom.trim()}` });
    if (present(e.telephone)) droite.push({ texte: "\nTEL : ", gras: true }, { texte: e.telephone.trim(), gras: true });
    if (present(spec.livraison?.delai)) droite.push({ texte: "\nDélai : ", gras: true }, { texte: spec.livraison!.delai!.trim() });
  }
  blocs.push(tableau([[gauche, droite]], { colonnes: [{ largeurCm: LARGEUR_CM / 2 }, { largeurCm: LARGEUR_CM / 2 }], bordures: false, taillePt: 10 }));

  // 3 — La bande des références : Date · Contact · Devis N° (ou Validité) · Modalités de paiement.
  const contact = [present(spec.contact?.nom) ? spec.contact!.nom!.trim() : null, present(spec.contact?.telephone) ? `Tel ${spec.contact!.telephone!.trim()}` : null].filter(present).join("\n") || "—";
  const jours = spec.validiteJours ?? 30;
  const troisieme: [string, string] = estDevis
    ? ["Validité", `${jours} jours\njusqu'au ${formaterDateFr(ajouterJours(spec.date, jours))}`]
    : present(spec.referenceAmont)
      ? ["Devis N°", `${spec.referenceAmont.trim()}${spec.referenceAmontDate ? `\nDu ${formaterDateFr(spec.referenceAmontDate)}` : ""}`]
      : ["Référence", present(spec.objet) ? spec.objet.trim() : "—"];
  const modalites = [spec.modePaiement ? LIBELLE_MODE[spec.modePaiement] : null, present(spec.conditionsPaiement) ? spec.conditionsPaiement.trim() : null].filter(present).join("\n") || "—";
  blocs.push(tableau([["Date", "Contact", troisieme[0], "Modalités de paiement"], [formaterDateFr(spec.date), contact, troisieme[1], modalites]], {
    colonnes: [{ largeurCm: 3.0, alignement: "center" }, { largeurCm: 4.6, alignement: "center" }, { largeurCm: 3.6, alignement: "center" }, { largeurCm: 4.8, alignement: "center" }],
    entete: true, couleurEntete: accent, bordures: false, taillePt: 9.5,
  }));

  // 4 — Les lignes, et les totaux dans les dernières lignes du même tableau, fermé par un filet.
  const colonnes = colonnesLignes(t,
    { designation: "Désignation", unite: "Unité", qte: "Qte", remise: "Remise", tva: "TVA", pu: "PU HT", ht: "Total HT" },
    { unite: 1.6, qte: 1.5, remise: 1.6, tva: 1.4, pu: 3.2, ht: 3.2 });
  const lignes: Cellule[][] = [colonnes.map((col) => col.titre)];
  for (const l of t.lignes) {
    if (l.section) {
      lignes.push(colonnes.map((col) => (col.cle === "designation" ? { contenu: celluleDesignation(l, { grasDesignation: true, detailsTaillePt: 9.5 }), fond: GRIS_SECTION } : "")));
      continue;
    }
    lignes.push(colonnes.map((col) => (col.cle === "designation" ? celluleDesignation(l, { grasDesignation: true, detailsTaillePt: 10 }) : celluleChiffree(col.cle, l, true))));
  }
  const remises = t.remisesLignes > 0 || t.remiseGlobale > 0;
  const totaux: [string, string, boolean?][] = [];
  if (remises) {
    totaux.push(["Total HT brut", formaterDzd(t.totalHtBrut)]);
    if (t.remisesLignes > 0) totaux.push(["Remises sur lignes", `-${NBSP}${formaterDzd(t.remisesLignes)}`]);
    if (t.remiseGlobale > 0) totaux.push([`Remise globale ${formaterTaux(spec.remiseGlobale ?? 0)}`, `-${NBSP}${formaterDzd(t.remiseGlobale)}`]);
    totaux.push(["Total HT net", formaterDzd(t.totalHt)]);
  } else totaux.push(["Total HT", formaterDzd(t.totalHt)]);
  for (const x of t.taxes) totaux.push([`${x.libelle} ${formaterTaux(x.taux)}`, formaterDzd(x.montant)]);
  for (const x of t.tva) totaux.push([`Frais TVA ${formaterTaux(x.taux)}`, formaterDzd(x.montant)]);
  if (t.timbre > 0) totaux.push(["Droit de timbre", formaterDzd(t.timbre)]);
  totaux.push(["Montant TTC", formaterDzd(t.totalTtc), true]);
  for (const [k, v, gras] of totaux) {
    lignes.push([{ contenu: k, fusion: colonnes.length - 1, alignement: "right", gras: true, couleur: accent }, { contenu: v, alignement: "right", gras: !!gras, couleur: gras ? accent : undefined }]);
  }
  blocs.push(tableau(lignes, { colonnes, entete: true, couleurEntete: accent, bordures: { bas: true }, couleurBordure: accent, taillePt: 10 }));

  // 5 — « Arrêté le présent bon de commande à la somme de : » et les lettres.
  blocs.push(paragraphe(`Arrêté le présent ${estDevis ? "devis" : "bon de commande"} à la somme de :`, { gras: true, taillePt: 10, avantPt: 6, apresPt: 2 }));
  blocs.push(paragraphe(`${cap(t.enLettres)}.`, { taillePt: 10, apresPt: 8 }));

  // 6 — Conditions et notes ; le devis porte sa clause de validité et un « Bon pour accord ».
  if (estDevis) blocs.push(paragraphe(`Ce devis est valable ${jours} jours à compter de sa date d'émission. Les prix s'entendent hors taxes, TVA en sus au taux en vigueur.`, { taillePt: 9, couleur: GRIS }));
  if (present(spec.notes)) blocs.push(paragraphe(spec.notes.trim(), { taillePt: 9.5 }));
  blocs.push(...blocSignataire(spec, estDevis ? "Bon pour accord\n(date, signature et cachet du client)" : ""));
  blocs.push(...piedIdentite(spec));
  return blocs;
}

/** LES BLOCS DE LA PIÈCE, dans l'ordre de lecture — la mise en page de la maison, par nature. */
export function blocsCommerciaux(spec: SpecDocumentCommercial, t: TotauxCommerciaux): string[] {
  return spec.type === "FACTURE" ? blocsFacture(spec, t) : blocsCommande(spec, t);
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
  const texte = [...m.paragraphs.map((p) => p.text), ...m.tables.flatMap((tb) => tb.cells.map((c) => c.text))].join("\n");
  // Le TTC se cherche comme NOMBRE formaté : la facture l'écrit sans devise (« 8 925 000,00 »),
  // le bon de commande avec (« 961 345,00 DZD ») — les deux portent le nombre.
  const relu = {
    paragraphes: m.paragraphs.length,
    tableaux: m.tables.length,
    pages: m.pages,
    numero: texte.includes(spec.numero),
    tiers: texte.includes(spec.tiers.nom.trim()),
    ttc: texte.includes(formaterMontant(totaux.totalTtc)),
    lettres: texte.toLowerCase().includes(totaux.enLettres.toLowerCase()),
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
