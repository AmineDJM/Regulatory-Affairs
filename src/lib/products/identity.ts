import { moleculeStem } from "@/lib/market/galenic";
import { normText } from "@/lib/market/text";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";

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
 * ── LA CLÉ D'IDENTITÉ : CE QUI DISTINGUE DEUX ENREGISTREMENTS, ET RIEN DE MOINS ──────────
 *
 * DCI + dosage + forme + conditionnement. Deux produits qui la partagent SONT le même produit,
 * et le code les FUSIONNE — c'est donc le sens dangereux : une clé trop grossière écrit dans
 * l'ERP qu'un 500 mg est un 1 g, et personne ne le voit avant que le chiffre soit présenté.
 *
 * La première version de cette clé l'était, et c'est le portefeuille RÉEL qui l'a dit (§118.178) :
 * « LEVETIRACETAM 100 mg/ml — solution buvable — B/1 120 ML » et « … B/1 300 ML » sortaient avec
 * la MÊME clé, parce que le conditionnement ne gardait que le nombre de la boîte. Trois autres
 * fusions de même famille, mesurées sur des écritures que le menu des dossiers produit :
 *   • le DOSAGE ne gardait que le premier nombre — « 200/50 mg » et « 200/25 mg », deux
 *     associations, une seule clé ; « 20 mg/0,5 ml » et « 20 mg/1 ml », deux concentrations ;
 *   • la FORME était ramenée à sa FAMILLE de marché (`canonicalForm` : quinze familles pour
 *     l'analyse IQVIA) — « solution injectable » et « poudre pour solution injectable », « crème »,
 *     « gel » et « pommade », deux à trois formes du menu des dossiers par famille ;
 *   • la DCI gardait l'ORDRE des molécules — « A + B » et « B + A », deux clés pour une seule
 *     association, c'est-à-dire deux produits canoniques pour le même médicament.
 *
 * La règle qui en sort : la clé NORMALISE L'ÉCRITURE (casse, accents, espaces, virgule décimale,
 * unité collée ou séparée, ordre d'une association, mots du sel, « B/30 » = « Boîte de 30 »), et
 * elle ne normalise RIEN D'AUTRE. La forme se lit dans le vocabulaire des DOSSIERS (`PHARMA_FORM`,
 * le menu que l'ERP fait déjà remplir), pas dans celui du marché : rapprocher une ligne IQVIA d'un
 * produit est une RECHERCHE, qui propose ; identifier deux enregistrements est une FUSION, qui
 * agit. Le même vocabulaire ne peut pas servir les deux.
 *
 * Ce qui reste divisé à tort — « 4 mg/1 ml » et « 4 mg/ml », « flacon » et « fl » — est le sens
 * SÛR : deux produits qu'un humain réunit d'un alias, jamais un produit qu'on ne sait plus séparer.
 *
 * ── CE MODULE EST PUR ────────────────────────────────────────────────────────────────────
 *
 * Aucune lecture de base, aucun réseau. Les radicaux de molécule viennent de `market/galenic.ts`
 * (sels, « E » final français contre l'anglais d'IQVIA), les écritures de `market/text.ts`, le
 * vocabulaire des formes et des unités de `labels.ts` — le menu même des dossiers.
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
 * LA DCI COMPARABLE — chaque molécule ramenée à son radical (sans le sel), puis TRIÉES.
 *
 * Une association s'écrit « A + B », « B/A », « A, B » ou « A et B » : c'est la même. Le
 * découpage se fait AVANT `normText`, qui efface ces séparateurs.
 */
export function cleDci(raw: string | null | undefined): string {
  const molecules = String(raw ?? "")
    .split(/\s*[+/,;&]\s*|\s+(?:et|ET|and|AND)\s+/)
    .map((m) => moleculeStem(m))
    .filter(Boolean);
  return [...new Set(molecules)].sort().join("+");
}

/** Les unités de dosage, ramenées à UNE écriture — clés du menu des dossiers ET écritures libres. */
const UNITES: Record<string, string> = {
  MG: "MG", G: "G", GR: "G", MCG: "MCG", UG: "MCG", UI: "UI", IU: "UI", U: "UI",
  "%": "%", PERCENT: "%", POURCENT: "%", ML: "ML", L: "L", MEQ: "MEQ", MMOL: "MMOL",
  MGML: "MGML", MGG: "MGG", MCGML: "MCGML", UGML: "MCGML", UIML: "UIML", MGL: "MGL",
};

function uniteNormalisee(brute: string): string {
  const u = brute.replace(/[\s/]+/g, "");
  return UNITES[u] ?? u;
}

/** Une dose lue : sa valeur, et son unité quand elle est écrite. */
interface Dose { valeur: string; unite: string }

/**
 * LES DOSES D'UN DOSAGE, dans l'ordre — « 200/50 mg » rend [200 MG, 50 MG], « 20 mg/0,5 ml »
 * rend [20 MG, 0.5 ML], « 100 mg/ml » rend [100 MGML]. Un « / » suivi d'un CHIFFRE sépare deux
 * doses ; suivi d'une LETTRE, il fait partie de l'unité. Un nombre nu prend l'unité de la dose
 * qui le suit : c'est ainsi qu'on écrit une association (« 200/50 mg »).
 */
function dosesDe(value?: string | null, unit?: string | null): Dose[] {
  let s = `${value ?? ""} ${unit ?? ""}`
    // Le signe micro AVANT la normalisation Unicode : après, il est devenu un « Μ » grec (voir
    // `normText`) et « 4 µg » perdait son unité.
    .replace(/[\u00B5\u03BC\u039C]/g, "U")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/_/g, "/")
    .replace(/,/g, ".");
  // « 5 000 UI » : l'espace des milliers n'est pas un séparateur de doses. « 1.000.000 » non plus.
  s = s.replace(/(\d)\s+(?=\d{3}(?!\d))/g, "$1").replace(/\d{1,3}(?:\.\d{3}){2,}/g, (m) => m.replace(/\./g, ""));
  const doses: Dose[] = [];
  for (const part of s.split(/\s*\+\s*|\s*\/\s*(?=\d)/)) {
    const m = part.match(/(\d+(?:\.\d+)?)\s*([A-Z%]+(?:\s*\/\s*[A-Z]+)?)?/);
    if (!m) continue;
    doses.push({ valeur: String(Number(m[1])), unite: m[2] ? uniteNormalisee(m[2]) : "" });
  }
  // Un nombre nu prend l'unité de la PREMIÈRE dose suivante qui en porte une.
  let suivante = "";
  for (let i = doses.length - 1; i >= 0; i--) {
    if (doses[i].unite) suivante = doses[i].unite;
    else if (suivante) doses[i] = { ...doses[i], unite: suivante };
  }
  return doses;
}

/**
 * LE DOSAGE, RAMENÉ À UNE ÉCRITURE COMPARABLE. « 500 », « 500 mg », « 500.0 MG » : la valeur et
 * l'unité arrivent tantôt ensemble, tantôt séparées, parfois avec une virgule décimale française.
 * On ne CONVERTIT PAS entre unités (500 mg ≠ 0,5 g pour l'ANPP : ce sont deux libellés de dossier),
 * on normalise seulement l'écriture — et l'on garde TOUTES les doses d'une association.
 */
export function normalizeDosage(value?: string | null, unit?: string | null): string {
  const doses = dosesDe(value, unit);
  if (!doses.length) return normText(`${value ?? ""} ${unit ?? ""}`).replace(/\s+/g, "");
  return doses.map((d) => `${d.valeur}${d.unite}`).join("/");
}

/** Plie une forme écrite : majuscules, sans accents, chaque mot sans son « s » de pluriel. */
function plierForme(raw: string | null | undefined): string {
  return normText(raw).split(" ").filter(Boolean).map((w) => (w.length > 3 ? w.replace(/S$/, "") : w)).join(" ");
}

/** Une écriture de forme → sa clé du menu des dossiers (« Comprimé pelliculé » → COMPRIME_PELLICULE). */
const FORME_PAR_ECRITURE = new Map<string, string>(
  Object.entries(PHARMA_FORM).flatMap(([cle, libelle]) => [[plierForme(cle), cle], [plierForme(libelle), cle]] as [string, string][]),
);

/**
 * LA FORME, DANS LE VOCABULAIRE DES DOSSIERS. Une clé du menu (`COMPRIME_PELLICULE`) ou son
 * libellé (« Comprimé pelliculé ») rend la clé ; toute autre écriture se garde PLIÉE, telle
 * quelle — donc distincte. On ne devine pas qu'un « cp pell. » est un comprimé pelliculé :
 * le deviner fusionnerait, et la fusion est le sens dangereux.
 */
export function normalizeForme(raw: string | null | undefined): string {
  const t = plierForme(raw);
  if (!t) return "";
  return FORME_PAR_ECRITURE.get(t) ?? t;
}

/**
 * LE CONDITIONNEMENT, ÉCRITURE NORMALISÉE ET CONTENU GARDÉ. « B/30 », « Boîte de 30 », « BTE 30 »
 * désignent la même boîte ; « B/1 120 ML » et « B/1 300 ML » ne désignent PAS le même flacon —
 * ne garder que le nombre de la boîte, c'est ce qui les fusionnait (§118.178). « Tube 30 G »
 * n'est pas une boîte de 30.
 */
export function normalizePackaging(raw?: string | null): string {
  // Un nombre se recolle à son UNITÉ (« 120 ML » → « 120ML »), jamais à un mot : « B/1 FLACON »
  // doit rester une boîte de 1 flacon.
  const t = normText(raw).replace(/(\d)\s+(?=(?:ML|CL|L|MG|MCG|UG|G|UI|%)(?![A-Z]))/g, "$1");
  if (!t) return "";
  const boite = t.match(/^(?:B|BT|BTE|BOITE|BOITES)\s*(?:DE\s+)?(\d+)\b\s*(.*)$/);
  const reste = (s: string) => s.split(" ").filter((w) => w && !["DE", "D", "DU", "LA", "LE", "UN", "UNE"].includes(w)).join("");
  if (boite) {
    const suite = reste(boite[2] ?? "");
    return `B${Number(boite[1])}${suite ? `-${suite}` : ""}`;
  }
  return reste(t);
}

/**
 * LA CLÉ CANONIQUE — deux produits qui la partagent SONT le même produit.
 *
 * Elle est déterministe et se recalcule à volonté : c'est ce qui permet de la stocker en
 * colonne unique sans craindre qu'elle dérive de ce qu'elle indexe — et ce qui permet de
 * RETROUVER un produit dont la clé a été écrite par une version précédente de cette fonction
 * (`resolve.ts`, `retrouverParIdentite`).
 */
export function identityKey(p: ProductIdentity): string {
  const dci = cleDci(p.dci);
  if (!dci) return "";
  return [dci, normalizeDosage(p.dosage, p.dosageUnit), normalizeForme(p.form), normalizePackaging(p.packaging)].join("|");
}

// ─────────────────────────── L'identité complète ───────────────────────────

/** Les traits d'identité qu'on peut trouver manquants, dans l'ordre où l'on les demande. */
export type TraitIdentite = "DCI" | "DOSAGE" | "UNITE" | "FORME" | "CONDITIONNEMENT";

export const LIBELLE_TRAIT: Record<TraitIdentite, string> = {
  DCI: "la DCI",
  DOSAGE: "le dosage",
  UNITE: "l'unité du dosage",
  FORME: "la forme",
  CONDITIONNEMENT: "le conditionnement",
};

/**
 * CE QUI MANQUE POUR IDENTIFIER À COUP SÛR — vide quand l'identité est complète.
 *
 * Une clé se calcule dès qu'il y a une DCI ; elle n'IDENTIFIE qu'avec les quatre traits. Sans
 * le conditionnement, « LEVETIRACETAM 500 mg comprimé pelliculé » désigne la boîte de 30 ET celle
 * de 60 : rattacher là-dessus fusionnerait deux enregistrements. Un dosage sans unité (« 500 »)
 * ne se compare pas à « 500 mg » ; la forme « Autre » ne désigne aucune forme. On ne rattache
 * donc RIEN tant que cette liste n'est pas vide — et l'on DIT ce qui manque, trait par trait.
 */
export function manquesIdentite(p: ProductIdentity): TraitIdentite[] {
  const manques: TraitIdentite[] = [];
  if (!cleDci(p.dci)) manques.push("DCI");
  const doses = dosesDe(p.dosage, p.dosageUnit);
  if (!doses.length) manques.push("DOSAGE");
  else if (doses.some((d) => !d.unite)) manques.push("UNITE");
  const forme = normalizeForme(p.form);
  if (!forme || forme === "AUTRE") manques.push("FORME");
  if (!normalizePackaging(p.packaging)) manques.push("CONDITIONNEMENT");
  return manques;
}

export function identiteComplete(p: ProductIdentity): boolean {
  return manquesIdentite(p).length === 0;
}

/** « le dosage et le conditionnement » — la liste dite comme une phrase. */
export function phraseManques(manques: readonly TraitIdentite[]): string {
  const mots = manques.map((m) => LIBELLE_TRAIT[m]);
  if (mots.length <= 1) return mots[0] ?? "";
  return `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

/**
 * LE NOM D'UN PRODUIT CRÉÉ D'APRÈS SON IDENTITÉ — « LEVETIRACETAM 500 mg · Comprimé pelliculé ·
 * B/60 ». Il porte les traits qui le DISTINGUENT : neuf produits « LEVETIRACETAM » dans un menu
 * ne se choisissent pas. Une personne peut le renommer ensuite ; ce nom n'est qu'un départ.
 */
export function nomCanonique(p: ProductIdentity): string {
  const dci = String(p.dci ?? "").replace(/\s+/g, " ").trim();
  const unite = p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : "";
  const dosage = [p.dosage?.trim(), unite].filter(Boolean).join(" ");
  const forme = p.form ? PHARMA_FORM[p.form] ?? p.form.trim() : "";
  return [[dci, dosage].filter(Boolean).join(" "), forme, p.packaging?.trim()].filter(Boolean).join(" · ");
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
    // Les mots de FORME ne font pas partie de la DCI. Comparés pliés : « comprimé pelliculé »
    // laissait « é pelliculé » dans la DCI, et « PELLICUL » devenait une molécule à retrouver.
    dci: sansDosage.split(/\s+/).filter((w) => w && !MOTS_DE_FORME.has(plierForme(w))).join(" ").trim(),
    dosage: dosage ? dosage[1] : null,
    // Unité ABSENTE quand le nombre était nu : c'est un fait, pas une valeur à deviner. Le
    // rapprochement partiel compare alors sur le NOMBRE, ce qui suffit à écarter le 40 mg.
    dosageUnit: dosage && dosage[2] ? dosage[2] : null,
    // LA FORME NOMMÉE, et elle seule — pas toute la phrase. La clé compare des formes du menu
    // des dossiers : « Nivolumab 100 mg comprimé pelliculé » nomme COMPRIME_PELLICULE.
    form: formeMentionnee(t),
    packaging: null,
  };
}

/** Les MOTS qui écrivent une forme — ceux du menu des dossiers, et les quelques mots courants. */
const MOTS_DE_FORME = new Set<string>([
  ...[...FORME_PAR_ECRITURE.keys()].flatMap((e) => e.split(" ")),
  "COMPRIME", "GELULE", "SIROP", "INJECTABLE", "PERFUSION", "SACHET", "FLACON",
]);

/** Les écritures de forme du menu des dossiers, de la plus longue à la plus courte. */
const FORMES_CHERCHEES = [...FORME_PAR_ECRITURE.keys()].filter((e) => e !== "AUTRE").sort((a, b) => b.length - a.length);

/**
 * LA FORME QU'UNE MENTION NOMME — la plus longue écriture du menu qu'elle contient (« comprimé
 * pelliculé » avant « comprimé »), sinon le mot de forme qu'elle porte, sinon rien.
 */
function formeMentionnee(t: string): string | null {
  const plie = ` ${plierForme(t)} `;
  const trouvee = FORMES_CHERCHEES.find((e) => plie.includes(` ${e} `));
  if (trouvee) return FORME_PAR_ECRITURE.get(trouvee) ?? null;
  const mot = plie.match(/ (COMPRIME|GELULE|SIROP|INJECTABLE|PERFUSION|SACHET|FLACON) /);
  return mot ? mot[1] : null;
}

/** Le meilleur match CERTAIN, ou `null` — la forme dont une capability a besoin neuf fois sur dix. */
export function certainMatch(matches: ProductMatch[]): ProductMatch | null {
  const surs = matches.filter((m) => m.certain);
  // UNE seule correspondance certaine. Deux, c'est une ambiguïté réelle qui se pose à l'humain.
  return surs.length === 1 ? surs[0] : null;
}
