import { moleculeStem, canonicalForm, type GalenicForm } from "@/lib/market/galenic";
import { normText } from "@/lib/market/text";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ CANONIQUE D'UN PRODUIT — et pourquoi elle n'est pas `RegulatoryProduct`.
 *
 * ── LA DÉCISION, ET CE QUI L'IMPOSE ──────────────────────────────────────────────────────
 *
 * `RegulatoryProduct` est le dossier le plus riche du produit, et il ressemblait au candidat
 * naturel pour porter l'identité. Une contrainte métier l'interdit : **un produit doit pouvoir
 * exister AVANT son enregistrement**. Un `BdProduct` en `sourcing: TO_STUDY` n'a légitimement
 * aucun dossier — c'est d'ailleurs pour cela que son `regulatoryProductId` est nullable depuis
 * le début. Faire du dossier l'identité, c'était refuser une identité à tout produit à l'étude.
 *
 * `Product` est donc introduit AU-DESSUS. Mince, volontairement : il ne porte que le TUPLE
 * D'IDENTITÉ, pas une copie des quarante champs du dossier. Les modèles existants
 * (`RegulatoryProduct`, `PromoProduct`, `BdProduct`) deviennent des PROFILS qui le référencent,
 * et aucun n'est détruit.
 *
 * ── POURQUOI LE DOSSIER GARDE SES PROPRES CHAMPS ─────────────────────────────────────────
 *
 * On pourrait croire à une duplication : `Product.dci` et `RegulatoryProduct.dci` disent la même
 * chose. Ils ne la disent pas au même titre. Le dossier porte ce qui a été DÉPOSÉ à l'ANPP —
 * y compris une coquille, y compris une orthographe qui ne se corrige plus une fois le dossier
 * soumis. `Product` porte ce que l'entreprise reconnaît comme LE produit. Les aligner de force
 * obligerait un jour à falsifier l'un des deux.
 *
 * ── LA CLÉ D'IDENTITÉ : QUATRE CHAMPS, ET PAS UN DE MOINS ────────────────────────────────
 *
 * DCI + dosage + unité + forme + conditionnement. Le conditionnement EN FAIT PARTIE, et c'est
 * un fait du métier écrit noir sur blanc dans le schéma : « à dosage et forme identiques, c'est
 * LUI qui distingue deux dossiers — une boîte de 28 et une boîte de 56 sont deux
 * enregistrements ». Une clé qui l'omettrait fusionnerait deux produits distincts.
 *
 * ── CE MODULE EST PUR ────────────────────────────────────────────────────────────────────
 *
 * Aucune lecture de base, aucun réseau. La normalisation pharma vient de `market/galenic.ts` et
 * `market/text.ts`, qui existent, sont éprouvés, et gèrent déjà les sels, les radicals français
 * contre l'anglais d'IQVIA, et les abréviations de présentation réelles. Les réécrire aurait
 * produit un second vocabulaire qui diverge du premier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les traits qui, ensemble, DÉSIGNENT un produit. Tout le reste est de l'attribut. */
export interface ProductIdentity {
  dci: string;
  dosage?: string | null;
  dosageUnit?: string | null;
  form?: string | null;
  packaging?: string | null;
}

/**
 * LE DOSAGE, RAMENÉ À UN NOMBRE COMPARABLE. « 500 », « 500 mg », « 0,5 g » : la valeur et
 * l'unité arrivent tantôt ensemble, tantôt séparées, et parfois avec une virgule décimale
 * française. On ne convertit PAS entre unités (500 mg ≠ 0,5 g pour l'ANPP : ce sont deux
 * libellés de dossier), on normalise seulement l'écriture.
 */
export function normalizeDosage(value?: string | null, unit?: string | null): string {
  const brut = `${value ?? ""} ${unit ?? ""}`.trim();
  if (!brut) return "";
  const m = brut.replace(/,/g, ".").match(/(\d+(?:\.\d+)?)\s*([a-zA-Zµ%/]+)?/);
  if (!m) return normText(brut);
  const nombre = String(Number(m[1])); // « 500.0 » → « 500 », « 0.50 » → « 0.5 »
  const u = normText(m[2] ?? "").replace(/\s+/g, "");
  return u ? `${nombre}${u}` : nombre;
}

/**
 * LE CONDITIONNEMENT, RAMENÉ À SA QUANTITÉ. « B/30 », « Boîte de 30 », « BTE 30 » désignent la
 * même chose ; « Tube 30 G » n'est pas une boîte de 30. On extrait donc le NOMBRE avec son
 * contexte, sans prétendre comprendre au-delà.
 */
export function normalizePackaging(raw?: string | null): string {
  const t = normText(raw);
  if (!t) return "";
  // « B/30 », « BTE 30 », « BOITE DE 30 » → « B30 ». Le reste est normalisé tel quel.
  const boite = t.match(/\b(?:B|BTE|BOITE|BOITES)\s*(?:\/|DE)?\s*(\d+)\b/);
  if (boite) return `B${Number(boite[1])}`;
  return t.replace(/\s+/g, "");
}

/**
 * LA CLÉ CANONIQUE — deux produits qui la partagent SONT le même produit.
 *
 * Elle est déterministe et se recalcule à volonté : c'est ce qui permet de la stocker en
 * colonne unique sans craindre qu'elle dérive de ce qu'elle indexe.
 */
export function identityKey(p: ProductIdentity): string {
  const dci = moleculeStem(p.dci);
  if (!dci) return "";
  const forme: GalenicForm | "" = p.form ? canonicalForm(p.form) : "";
  return [dci, normalizeDosage(p.dosage, p.dosageUnit), forme, normalizePackaging(p.packaging)]
    .join("|");
}

/**
 * UN ALIAS NORMALISÉ — « Nivo », « nivolumab 100 », « NIVOLUMAB100MG » se ramènent à la même
 * chaîne cherchable. Sert de clé d'index, jamais d'affichage.
 */
export function aliasKey(raw: string | null | undefined): string {
  return normText(raw).replace(/\s+/g, " ").trim();
}

// ─────────────────────────── La résolution, par degrés ───────────────────────────

/**
 * COMMENT UN PRODUIT A ÉTÉ RECONNU — et ce que chaque degré autorise.
 *
 * L'ordre est la règle : on ne descend d'un degré que si le précédent n'a rien rendu. Un
 * rapprochement flou qui l'emporterait sur une référence exacte serait exactement l'inverse de
 * ce qu'on veut, et c'est ce que fait un moteur qui score tout à plat.
 */
export type MatchKind =
  /** 1. Une RÉFÉRENCE explicite (`PRD-2026-014`, un id). Aucune ambiguïté possible. */
  | "reference"
  /** 2. Un ALIAS enregistré par un humain (« Nivo » → ce produit). Une décision, pas une mesure. */
  | "alias"
  /** 3. La CLÉ D'IDENTITÉ complète. Déterministe : même DCI, dosage, forme, conditionnement. */
  | "identity"
  /** 4. Un rapprochement PARTIEL (DCI seule, ou DCI + dosage). Proposé, jamais appliqué seul. */
  | "partial";

export interface ProductCandidate {
  id: string;
  code: string;
  canonicalName: string;
  identityKey: string;
  dci: string;
  dosage?: string | null;
  dosageUnit?: string | null;
  form?: string | null;
  packaging?: string | null;
  aliases?: string[];
}

export interface ProductMatch {
  product: ProductCandidate;
  kind: MatchKind;
  /**
   * PEUT-ON AGIR SANS DEMANDER ? Vrai seulement aux degrés 1 à 3. Un `partial` remonte comme
   * une PROPOSITION : c'est la règle « aucun rapprochement automatique dangereux en cas
   * d'ambiguïté », et c'est aussi celle qui empêche de confondre un 500 mg et un 1 g.
   */
  certain: boolean;
  /** Ce qui a permis de reconnaître — affiché à l'humain qui arbitre, jamais réinterprété. */
  why: string;
}

const REFERENCE_RE = /^(?:PRD|REG)-\d{4}-\d{1,6}$/i;

/**
 * RÉSOUT UNE MENTION LIBRE VERS UN PRODUIT — pure, sur un lot de candidats déjà chargé.
 *
 * La séparation est volontaire : la DÉCISION est ici (testable au cas près, sans base), la
 * LECTURE est dans `resolve.ts`. Mélanger les deux rendrait la règle vérifiable seulement à
 * travers une base de test — c'est-à-dire mal.
 *
 * Rend TOUTES les correspondances du meilleur degré atteint. Plusieurs résultats à un degré
 * certain = une AMBIGUÏTÉ RÉELLE (deux produits portent le même alias) : l'appelant doit
 * demander, pas choisir.
 */
export function resolveProduct(mention: string, candidates: ProductCandidate[]): ProductMatch[] {
  const brut = (mention ?? "").trim();
  if (!brut) return [];
  const cle = aliasKey(brut);

  // ── 1. RÉFÉRENCE EXPLICITE ────────────────────────────────────────────────────────────
  if (REFERENCE_RE.test(brut)) {
    const exact = candidates.filter((c) => c.code.toUpperCase() === brut.toUpperCase());
    if (exact.length) {
      return exact.map((p) => ({ product: p, kind: "reference", certain: true, why: `Référence ${p.code}` }));
    }
    // Une référence qui ne résout pas est une ERREUR, pas une invitation à chercher par
    // ressemblance : « PRD-2026-999 » ne doit jamais rendre « PRD-2026-99 ».
    return [];
  }

  // ── 2. ALIAS ENREGISTRÉ ───────────────────────────────────────────────────────────────
  const parAlias = candidates.filter((c) => (c.aliases ?? []).some((a) => aliasKey(a) === cle));
  if (parAlias.length) {
    return parAlias.map((p) => ({ product: p, kind: "alias", certain: true, why: `Alias « ${brut} »` }));
  }

  // Le NOM canonique compte comme un alias implicite — personne ne devrait avoir à enregistrer
  // « Nivolumab » comme alias du produit qui s'appelle Nivolumab.
  const parNom = candidates.filter((c) => aliasKey(c.canonicalName) === cle);
  if (parNom.length) {
    return parNom.map((p) => ({ product: p, kind: "alias", certain: true, why: `Nom du produit` }));
  }

  // ── 3. CLÉ D'IDENTITÉ COMPLÈTE ────────────────────────────────────────────────────────
  const demande = parseMention(brut);
  const cleDemandee = identityKey(demande);
  if (cleDemandee && demande.dosage) {
    const parIdentite = candidates.filter((c) => c.identityKey === cleDemandee);
    if (parIdentite.length) {
      return parIdentite.map((p) => ({
        product: p, kind: "identity", certain: true,
        why: `DCI, dosage et forme identiques`,
      }));
    }
  }

  // ── 4. PARTIEL — proposé, jamais appliqué ─────────────────────────────────────────────
  const radical = moleculeStem(demande.dci);
  if (radical.length < 3) return [];
  const partiels = candidates.filter((c) => {
    const s = moleculeStem(c.dci);
    if (!s) return false;
    return radical.split(" ").every((w) => s.split(" ").some((x) => x.startsWith(w) || w.startsWith(x)));
  });
  if (!partiels.length) return [];

  // Un dosage MENTIONNÉ resserre le partiel : « nivolumab 100 » ne doit pas remonter le 40 mg.
  const avecDosage = demande.dosage
    ? partiels.filter((c) => normalizeDosage(c.dosage, c.dosageUnit).startsWith(normalizeDosage(demande.dosage, demande.dosageUnit)))
    : partiels;
  const retenus = avecDosage.length ? avecDosage : partiels;

  return retenus.map((p) => ({
    product: p, kind: "partial", certain: false,
    why: demande.dosage ? `DCI et dosage compatibles` : `DCI compatible — dosage non précisé`,
  }));
}

/**
 * CE QU'UNE MENTION LIBRE CONTIENT. « Nivolumab 100 mg comprimé » porte trois traits ; « Nivo »
 * n'en porte qu'un. On extrait ce qui est là, on n'invente pas ce qui manque.
 */
export function parseMention(mention: string): ProductIdentity {
  const t = (mention ?? "").trim();
  // AVEC UNITÉ D'ABORD — « 100 mg » est sans ambiguïté.
  let dosage = t.replace(/,/g, ".").match(/\b(\d+(?:\.\d+)?)\s*(mg|g|ui|ml|mcg|µg|%)\b/i);
  // PUIS LE NOMBRE NU. « nivolumab 100 » est la façon dont on parle réellement d'un produit à
  // l'oral et dans une demande écrite ; refuser de l'entendre laissait remonter le 40 mg à côté
  // du 100 mg — c'est-à-dire proposer le mauvais produit sur une mention pourtant précise.
  // On n'accepte le nombre nu que s'il SUIT du texte : « 100 » seul ne désigne rien.
  if (!dosage) {
    const nu = t.replace(/,/g, ".").match(/[A-Za-zÀ-ÿ]\s+(\d+(?:\.\d+)?)\s*$/);
    if (nu) dosage = [nu[0], nu[1], ""] as unknown as RegExpMatchArray;
  }
  // Le DCI est ce qui reste une fois le dosage et la forme retirés.
  const sansDosage = dosage ? t.replace(dosage[0], " ") : t;
  return {
    dci: sansDosage.replace(/\b(comprime?s?|gelules?|sirop|injectable|perfusion|sachets?|flacons?)\b/gi, " ").trim(),
    dosage: dosage ? dosage[1] : null,
    // Unité ABSENTE quand le nombre était nu : c'est un fait, pas une valeur à deviner. Le
    // rapprochement partiel compare alors sur le NOMBRE, ce qui suffit à écarter le 40 mg.
    dosageUnit: dosage && dosage[2] ? dosage[2] : null,
    form: /\b(comprime?s?|gelules?|sirop|injectable|perfusion|sachets?|flacons?)\b/i.test(t) ? t : null,
    packaging: null,
  };
}

/** Le meilleur match CERTAIN, ou `null` — la forme dont une capability a besoin neuf fois sur dix. */
export function certainMatch(matches: ProductMatch[]): ProductMatch | null {
  const surs = matches.filter((m) => m.certain);
  // UNE seule correspondance certaine. Deux, c'est une ambiguïté réelle qui se pose à l'humain.
  return surs.length === 1 ? surs[0] : null;
}
