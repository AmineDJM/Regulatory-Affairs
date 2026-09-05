import PptxGenJS from "pptxgenjs";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { controlerAvantLivraison, type ControleLivraison } from "@/lib/artifact/qa/checks";
import type { PptxModel } from "@/lib/artifact/object-model/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONSTRUCTEUR DE DECKS « UNE IDÉE PAR DIAPOSITIVE » — cent diapositives, chacune vérifiée.
 *
 * ── LA RÈGLE ÉDITORIALE, TENUE PAR LE CODE ──────────────────────────────────────────────
 *
 * Un deck de comité se lit en projection, à trois mètres, en trente secondes par diapositive.
 * D'où des bornes qui ne sont pas des goûts : un titre d'une ligne (≤ 14 mots), au plus 6 puces
 * de 25 mots, jamais une diapositive vide, jamais un tableau de 40 lignes. Le modèle qui écrit la
 * spécification peut se tromper ; le constructeur REFUSE alors de livrer et dit quelle
 * diapositive viole quelle règle — au lieu de produire un deck que personne ne présentera.
 *
 * ── CE QUI EST VÉRIFIÉ SUR LE FICHIER PRODUIT, PAS SUR L'INTENTION ───────────────────────
 *
 * Le `.pptx` est RELU par l'adaptateur (le même que pour l'édition), et le contrôle avant
 * livraison tourne sur ce modèle relu : débordements, formes hors cadre, titres dupliqués,
 * espaces réservés. Ce qu'on livre est ce qu'on a relu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface SpecDiapo {
  titre: string;
  /** Les puces — l'idée, déclinée en au plus 6 points. */
  puces?: string[];
  /** Un court texte libre (≤ 90 mots), à la place ou en dessous des puces. */
  texte?: string;
  /** Un chiffre clé mis en avant : « 41,3 M DZD », « +12 % ». */
  chiffre?: { valeur: string; legende: string };
  tableau?: { colonnes: string[]; lignes: (string | number)[][] };
  /** Notes du présentateur. */
  notes?: string;
}

export interface SpecDeck {
  titre: string;
  sousTitre?: string;
  auteur?: string;
  diapos: SpecDiapo[];
  theme?: { couleur?: string; couleurTexte?: string; police?: string };
}

export interface VerificationDeck extends ControleLivraison {
  diapos: number;
}

export interface DeckConstruit {
  octets: Buffer;
  verification: VerificationDeck;
  ms: number;
}

const MAX_DIAPOS = 250;
const MAX_PUCES = 6;
const MAX_MOTS_PUCE = 25;
const MAX_MOTS_TITRE = 14;
const MAX_MOTS_TEXTE = 90;
const MAX_LIGNES_TABLEAU = 12;
const MAX_COLONNES_TABLEAU = 8;

const mots = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

/** Les règles éditoriales, jugées sur la SPÉCIFICATION — avant de dessiner quoi que ce soit. */
export function verifierSpecDeck(spec: SpecDeck): { bloquants: string[]; avertissements: string[] } {
  const bloquants: string[] = [];
  const avertissements: string[] = [];
  if (!spec.titre?.trim()) bloquants.push("Le deck n'a pas de titre.");
  if (!Array.isArray(spec.diapos) || spec.diapos.length === 0) bloquants.push("Le deck n'a aucune diapositive.");
  if ((spec.diapos?.length ?? 0) > MAX_DIAPOS) bloquants.push(`${spec.diapos.length} diapositives : au-delà de ${MAX_DIAPOS}, ce n'est plus une présentation.`);
  const titres = new Map<string, number[]>();
  (spec.diapos ?? []).forEach((d, i) => {
    const n = i + 1;
    const titre = (d.titre ?? "").trim();
    if (!titre) bloquants.push(`Diapo ${n} : pas de titre.`);
    else {
      titres.set(titre.toLowerCase(), [...(titres.get(titre.toLowerCase()) ?? []), n]);
      if (mots(titre) > MAX_MOTS_TITRE) bloquants.push(`Diapo ${n} : titre de ${mots(titre)} mots (maximum ${MAX_MOTS_TITRE}) — une idée par diapositive tient en une ligne.`);
    }
    const puces = (d.puces ?? []).map((p) => String(p ?? "").trim()).filter(Boolean);
    const texte = (d.texte ?? "").trim();
    const aContenu = puces.length > 0 || texte || d.chiffre || (d.tableau && d.tableau.lignes?.length);
    if (!aContenu) bloquants.push(`Diapo ${n} « ${titre || "sans titre"} » : vide (ni puces, ni texte, ni chiffre, ni tableau).`);
    if (puces.length > MAX_PUCES) bloquants.push(`Diapo ${n} : ${puces.length} puces (maximum ${MAX_PUCES}) — scinder en deux diapositives.`);
    puces.forEach((p, k) => { if (mots(p) > MAX_MOTS_PUCE) bloquants.push(`Diapo ${n}, puce ${k + 1} : ${mots(p)} mots (maximum ${MAX_MOTS_PUCE}).`); });
    if (texte && mots(texte) > MAX_MOTS_TEXTE) bloquants.push(`Diapo ${n} : texte de ${mots(texte)} mots (maximum ${MAX_MOTS_TEXTE}) — un mur de texte ne se projette pas.`);
    if (d.tableau) {
      if ((d.tableau.lignes?.length ?? 0) > MAX_LIGNES_TABLEAU) bloquants.push(`Diapo ${n} : tableau de ${d.tableau.lignes.length} lignes (maximum ${MAX_LIGNES_TABLEAU}) — un tableau long va dans l'annexe Excel.`);
      if ((d.tableau.colonnes?.length ?? 0) > MAX_COLONNES_TABLEAU) bloquants.push(`Diapo ${n} : tableau de ${d.tableau.colonnes.length} colonnes (maximum ${MAX_COLONNES_TABLEAU}).`);
    }
    if (puces.some((p) => mots(p) < 2)) avertissements.push(`Diapo ${n} : une puce d'un seul mot — dit-elle quelque chose ?`);
  });
  for (const [t, idx] of titres) if (idx.length > 1) avertissements.push(`Le titre « ${t} » revient sur les diapos ${idx.join(", ")}.`);
  return { bloquants, avertissements };
}

/**
 * CONSTRUIT le deck (pptxgenjs, 16:9), le RELIT avec l'adaptateur et le CONTRÔLE. `ok` est faux
 * si la spécification viole une règle éditoriale ou si le fichier relu a un défaut bloquant.
 */
export async function construireDeckVerifie(spec: SpecDeck): Promise<DeckConstruit> {
  const debut = Date.now();
  const regles = verifierSpecDeck(spec);
  if (regles.bloquants.length > 0) {
    return { octets: Buffer.alloc(0), verification: { diapos: spec.diapos?.length ?? 0, bloquants: regles.bloquants, avertissements: regles.avertissements, ok: false }, ms: Date.now() - debut };
  }
  const couleur = (spec.theme?.couleur ?? "0B2545").replace(/^#/, "");
  const texte = (spec.theme?.couleurTexte ?? "26313D").replace(/^#/, "");
  const police = spec.theme?.police ?? "Calibri";
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = spec.auteur ?? "Adam";
  pptx.title = spec.titre;

  const couverture = pptx.addSlide();
  couverture.background = { color: couleur };
  couverture.addText(spec.titre, { x: 0.6, y: 1.9, w: 8.8, h: 1.3, fontSize: 34, bold: true, color: "FFFFFF", fontFace: police });
  if (spec.sousTitre) couverture.addText(spec.sousTitre, { x: 0.6, y: 3.2, w: 8.8, h: 0.8, fontSize: 18, color: "DCE6F0", fontFace: police });

  for (const d of spec.diapos) {
    const s = pptx.addSlide();
    s.addText(d.titre.trim(), { x: 0.5, y: 0.35, w: 9, h: 0.9, fontSize: 26, bold: true, color: couleur, fontFace: police });
    let y = 1.4;
    if (d.chiffre) {
      s.addText(d.chiffre.valeur, { x: 0.5, y, w: 9, h: 1.3, fontSize: 48, bold: true, color: couleur, fontFace: police, align: "center" });
      s.addText(d.chiffre.legende, { x: 0.5, y: y + 1.3, w: 9, h: 0.6, fontSize: 16, color: texte, fontFace: police, align: "center" });
      y += 2.1;
    }
    const puces = (d.puces ?? []).map((p) => String(p).trim()).filter(Boolean);
    if (puces.length > 0) {
      const h = Math.min(3.6, 0.55 * puces.length + 0.2);
      s.addText(puces.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.7, y, w: 8.6, h, fontSize: puces.length > 4 ? 16 : 18, color: texte, fontFace: police, valign: "top" });
      y += h + 0.1;
    }
    if (d.texte?.trim()) {
      s.addText(d.texte.trim(), { x: 0.7, y, w: 8.6, h: 1.6, fontSize: 16, color: texte, fontFace: police, valign: "top" });
      y += 1.7;
    }
    if (d.tableau && d.tableau.lignes.length > 0) {
      const entete = d.tableau.colonnes.map((c) => ({ text: String(c), options: { bold: true, color: "FFFFFF", fill: { color: couleur } } }));
      const corps = d.tableau.lignes.map((l) => l.map((v) => ({ text: String(v ?? "") })));
      s.addTable([entete, ...corps], { x: 0.5, y: Math.min(y, 3.6), w: 9, fontSize: 11, fontFace: police, border: { pt: 0.5, color: "D5DAE0" } });
    }
    if (d.notes) s.addNotes(d.notes);
  }
  const octets = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  // RELECTURE : ce qu'on livre est ce qu'on a relu.
  const relu = await adaptateurPptx.ouvrir(octets);
  const modele = relu.modele() as PptxModel;
  const controle = controlerAvantLivraison(modele);
  const validation = await relu.valider();
  const bloquants = [...controle.bloquants, ...validation.problemes];
  return {
    octets,
    verification: { diapos: modele.slides.length, bloquants, avertissements: [...regles.avertissements, ...controle.avertissements], ok: bloquants.length === 0 },
    ms: Date.now() - debut,
  };
}
