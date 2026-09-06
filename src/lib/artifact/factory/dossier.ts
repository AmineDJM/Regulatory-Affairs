/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DOSSIER À TROIS FORMATS — classeur, deck, note : produits ensemble, vérifiés ensemble.
 *
 * Le classeur est construit et RECALCULÉ par le moteur Excel (`sheets/build.ts`), le deck est
 * construit et RELU (`decks/build.ts`), la note est composée et RELUE (`factory/word.ts` puis
 * l'adaptateur). Puis la cohérence : les totaux que le classeur recalcule doivent être ceux que
 * le code a calculés depuis les données canoniques — et ce sont ces mêmes valeurs du code qui
 * figurent dans le deck et la note. Un seul chiffre différent, et `ok` est faux : l'appelant
 * n'écrit AUCUN des trois fichiers. Un dossier de comité à moitié cohérent n'existe pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { construireClasseurVerifie, type Verification } from "@/lib/artifact/sheets/build";
import { construireDeckVerifie, type VerificationDeck } from "@/lib/artifact/decks/build";
import { controlerAvantLivraison, type ControleLivraison } from "@/lib/artifact/qa/checks";
import type { DocxModel } from "@/lib/artifact/object-model/model";
import {
  verifierCoherence, verifierSpecCanon, versClasseur, versDeck, versDocument,
  type DonneesCanoniques, type RapportCoherence,
} from "@/lib/artifact/factory/canonical";
import { composerDocx } from "@/lib/artifact/factory/word";

export interface DossierConstruit {
  ok: boolean;
  /** Ce qui empêche de livrer, tous formats confondus, chacun préfixé par son format. */
  bloquants: string[];
  avertissements: string[];
  classeur: { octets: Buffer; verification: Verification | null };
  deck: { octets: Buffer; verification: VerificationDeck | null };
  note: { octets: Buffer; verification: (ControleLivraison & { paragraphes: number; tableaux: number; pages: number }) | null };
  coherence: RapportCoherence | null;
  ms: number;
}

const rien = Buffer.alloc(0);

/**
 * CONSTRUIT les trois fichiers depuis les données canoniques. Rien n'est écrit ici : les octets
 * sont rendus à l'appelant, qui décide (et ne décide que si `ok`).
 */
export async function construireDossier(
  canon: DonneesCanoniques,
  opts: { base?: Buffer | null; maintenant?: Date; police?: string | null; logo?: { octets: Buffer; png: boolean; largeurCm: number } | null } = {},
): Promise<DossierConstruit> {
  const debut = Date.now();
  const regles = verifierSpecCanon(canon);
  const vide: DossierConstruit = {
    ok: false, bloquants: regles.bloquants, avertissements: regles.avertissements,
    classeur: { octets: rien, verification: null }, deck: { octets: rien, verification: null }, note: { octets: rien, verification: null },
    coherence: null, ms: 0,
  };
  if (regles.bloquants.length > 0) return { ...vide, ms: Date.now() - debut };

  const bloquants: string[] = [];
  const avertissements: string[] = [...regles.avertissements];

  // 1 — Le classeur, recalculé par le moteur indépendant.
  let classeur: DossierConstruit["classeur"] = { octets: rien, verification: null };
  let coherence: RapportCoherence | null = null;
  const specClasseur = versClasseur(canon);
  if (specClasseur.feuilles.length > 0) {
    const c = await construireClasseurVerifie(specClasseur, { maintenant: opts.maintenant });
    classeur = { octets: c.octets, verification: c.verification };
    if (!c.verification.ok) {
      bloquants.push(...c.verification.erreurs.slice(0, 5).map((e) => `Excel ${e.ref} : =${e.formule} → ${e.erreur}`));
      bloquants.push(...c.verification.constats.slice(0, 5).map((k) => `Excel ${k.feuille}!${k.cellule} : ${k.message}`));
      if (c.verification.ecarts > 0) bloquants.push(`Excel : ${c.verification.ecarts} écart(s) entre les valeurs écrites et le recalcul.`);
    }
    coherence = verifierCoherence(canon, c.valeurs);
    if (!coherence.ok) bloquants.push(...coherence.ecarts.map((e) => `Cohérence : ${e}`));
  }

  // 2 — Le deck, relu.
  const d = await construireDeckVerifie(versDeck(canon));
  const deck = { octets: d.octets, verification: d.verification };
  if (!d.verification.ok) bloquants.push(...d.verification.bloquants.slice(0, 8).map((b) => `PowerPoint : ${b}`));
  avertissements.push(...d.verification.avertissements.slice(0, 8).map((a) => `PowerPoint : ${a}`));

  // 3 — La note, relue.
  const { octets: octetsNote } = composerDocx({
    blocs: versDocument(canon), base: opts.base ?? null, titre: canon.titre, auteur: canon.societe.nom,
    couleurTitres: canon.societe.couleur ?? undefined, police: opts.police ?? undefined,
    logo: opts.base && opts.base.length > 0 ? null : opts.logo ?? null, maintenant: opts.maintenant,
  });
  const ouvert = await adaptateurDocx.ouvrir(octetsNote);
  const m = ouvert.modele() as DocxModel;
  const controle = controlerAvantLivraison(m);
  const note = { octets: octetsNote, verification: { ...controle, paragraphes: m.paragraphs.length, tableaux: m.tables.length, pages: m.pages } };
  if (!controle.ok) bloquants.push(...controle.bloquants.slice(0, 8).map((b) => `Word : ${b}`));
  avertissements.push(...controle.avertissements.slice(0, 8).map((a) => `Word : ${a}`));
  if (!m.paragraphs.some((p) => p.text === canon.titre.trim())) bloquants.push("Word : le titre du dossier ne se lit pas dans la note produite.");

  return { ok: bloquants.length === 0, bloquants, avertissements, classeur, deck, note, coherence, ms: Date.now() - debut };
}
