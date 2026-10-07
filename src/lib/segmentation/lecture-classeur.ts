import { normalizeHeader } from "@/lib/medical/directory-sheet";
import { segmenterPraticien } from "./moteur";
import {
  lireRegles, type Regles, type RegleProduit, type Statut, type Segment, type Comparaison, type MethodeAffinite, type ExceptionZone,
  type Grille, type GrilleFrequence, type GrilleSecteur, type CleFrequence,
} from "./regles";

/**
 * LIRE UN CLASSEUR DE SEGMENTATION — n'importe lequel, pas seulement « Segmentation Finale ».
 *
 * Les colonnes se RECONNAISSENT (« Région », « Zone », « Secteur » ; « CDR », « Établissement »,
 * « Hôpital »…), la ligne d'en-tête se TROUVE (elle n'est pas forcément la première), la colonne du
 * classement se reconnaît à ses VALEURS (A/B/C/D/H/NA), le produit se lit dans la question
 * (« … mis sous raltegravir »). Les règles écrites en tête de feuille (« à partir de 22 patients par
 * semaine », « ratio > à 10 % ») et les fréquences de la feuille des KAM sont PROPOSÉES — jamais
 * appliquées sans publication — et la méthode d'affinité est déduite des pourcentages du fichier.
 *
 * Module PUR : il reçoit les feuilles déjà lues (tableaux de cellules) et rend des lignes et une
 * proposition. Aucune base, aucun fichier.
 */

export type Feuilles = Record<string, unknown[][]>;

export type ChampClasseur =
  | "zone" | "etablissement" | "specialite" | "nom" | "prenom" | "grade" | "statut"
  | "potentiel" | "sur10" | "pourcentage" | "segment";

export interface LigneClasseur {
  /** Numéro de ligne Excel (1 = première ligne de la feuille). */
  ligne: number;
  zone: string | null;
  etablissement: string | null;
  specialite: string | null;
  nom: string;
  prenom: string | null;
  grade: string | null;
  statut: Statut | null;
  statutBrut: string | null;
  potentiel: number | null;
  sur10: number | null;
  pourcentage: number | null;
  /** Le classement porté par le fichier : A/B/C/D, H (décideur) ou NA (non applicable). */
  segmentFichier: Segment | "H" | "NA" | null;
}

export interface LectureClasseur {
  feuille: string;
  entete: { index: number; texte: string; champ: ChampClasseur | null }[];
  lignes: LigneClasseur[];
  /** Le texte libre de la feuille (consignes, définitions) — pour les règles qu'il énonce. */
  texte: string[];
  /** Le produit nommé dans la question d'affinité (« sous raltegravir » → « raltegravir »). */
  produitMentionne: string | null;
  /** La métrique du potentiel, d'après son en-tête (« patients HIV / semaine »). */
  metrique: string | null;
  anomalies: string[];
}

const clean = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();
const nombre = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = clean(v).replace(",", ".");
  return s && Number.isFinite(Number(s)) ? Number(s) : null;
};

/** Le champ que désigne un en-tête — `null` si on ne sait pas (rendu, jamais ignoré en silence). */
export function champDeLEntete(brut: unknown): ChampClasseur | null {
  const n = normalizeHeader(brut);
  if (!n) return null;
  if (n === "%" || n === "" ) return null;
  if (/\bsur 10\b/.test(n) || /sur dix/.test(n)) return "sur10";
  if (/patients?/.test(n) && /(semaine|mois|consult|jour)/.test(n)) return "potentiel";
  if (/^(region|zone|secteur|territoire|pf)$/.test(n)) return "zone";
  if (/^(cdr|etablissement|etab|hopital|structure|chu|site|centre|institution|lieu d exercice)$/.test(n)) return "etablissement";
  if (/^(specialite|specialty|specialites|service)$/.test(n)) return "specialite";
  if (/^(nom|nom de famille|last name|lastname)$/.test(n)) return "nom";
  if (/^(prenom|first name|firstname)$/.test(n)) return "prenom";
  if (/^(grade|titre|fonction|poste)$/.test(n)) return "grade";
  if (/^(statut|role|statut strategique|type)$/.test(n)) return "statut";
  if (/^(segment|segmentation|classe|classement|potentiel)$/.test(n)) return "segment";
  if (/^(pourcentage|ratio|taux|affinite)$/.test(n)) return "pourcentage";
  return null;
}

export function statutDe(brut: unknown): Statut | null {
  const n = normalizeHeader(brut);
  if (!n) return null;
  if (n.startsWith("decid")) return "DECIDEUR";
  if (n.startsWith("influen") || n === "kol") return "INFLUENCEUR";
  if (n.startsWith("refer") || n.startsWith("refe")) return "REFERENT";
  if (n.startsWith("prescri")) return "PRESCRIPTEUR";
  return null;
}

function segmentDe(brut: unknown): LigneClasseur["segmentFichier"] {
  const s = clean(brut).toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D" || s === "H") return s;
  if (s === "NA" || s === "N/A" || s === "N.A") return "NA";
  return null;
}

/** La ligne d'en-tête d'une feuille : la première qui nomme au moins un nom ET deux autres champs connus. */
function trouverEntete(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const champs = (rows[i] ?? []).map(champDeLEntete);
    if (champs.includes("nom") && champs.filter(Boolean).length >= 3) return i;
  }
  return -1;
}

/**
 * Lit la feuille de segmentation d'un classeur : celle dont l'en-tête reconnaît le PLUS de colonnes (Région, CDR, Nom,
 * Statut, Question 1…), puis la plus longue — un glossaire ou une feuille de listes déroulantes ne l'emporte jamais.
 */
export function lireClasseur(feuilles: Feuilles): LectureClasseur | null {
  const candidates = Object.entries(feuilles)
    .map(([feuille, rows], ordre) => {
      const h = trouverEntete(rows);
      const score = h < 0 ? 0 : new Set((rows[h] ?? []).map(champDeLEntete).filter(Boolean)).size;
      return { feuille, rows, h, score, ordre };
    })
    .filter((c) => c.h >= 0)
    .sort((a, b) => b.score - a.score || b.rows.length - a.rows.length || a.ordre - b.ordre);
  for (const { feuille, rows, h } of candidates) {
    const brut = rows[h] ?? [];
    const entete = brut.map((t, index) => ({ index, texte: clean(t), champ: champDeLEntete(t) }));
    const pris = new Set<ChampClasseur>();
    for (const c of entete) { if (c.champ && pris.has(c.champ)) c.champ = null; else if (c.champ) pris.add(c.champ); }
    const corps = rows.slice(h + 1);
    // La colonne du CLASSEMENT se reconnaît à ses valeurs, quel que soit son nom (« Potentiel » dans le classeur actuel).
    if (!pris.has("segment")) {
      for (const c of entete) {
        if (c.champ) continue;
        const v = corps.map((r) => segmentDe(r?.[c.index])).filter(Boolean).length;
        if (v >= Math.max(3, corps.filter((r) => clean(r?.[c.index])).length * 0.8)) { c.champ = "segment"; pris.add("segment"); break; }
      }
    }
    // « % » : la colonne immédiatement à droite de « sur 10 » sans nom reconnu, quand elle est numérique.
    if (!pris.has("pourcentage")) {
      const s10 = entete.find((c) => c.champ === "sur10");
      const voisin = s10 ? entete[s10.index + 1] : undefined;
      if (voisin && !voisin.champ && /%/.test(voisin.texte)) { voisin.champ = "pourcentage"; pris.add("pourcentage"); }
    }
    const col = (champ: ChampClasseur) => entete.find((c) => c.champ === champ)?.index ?? -1;
    const idx = Object.fromEntries((["zone", "etablissement", "specialite", "nom", "prenom", "grade", "statut", "potentiel", "sur10", "pourcentage", "segment"] as ChampClasseur[]).map((c) => [c, col(c)])) as Record<ChampClasseur, number>;
    const get = (r: unknown[] | undefined, c: ChampClasseur) => (idx[c] >= 0 ? r?.[idx[c]] : null);
    const lignes: LigneClasseur[] = [];
    const anomalies: string[] = [];
    corps.forEach((r, i) => {
      const nom = clean(get(r, "nom"));
      if (!nom) return;
      const statutBrut = clean(get(r, "statut")) || null;
      const statut = statutDe(statutBrut);
      const ligne = h + i + 2;
      if (statutBrut && !statut) anomalies.push(`Ligne ${ligne} : statut « ${statutBrut} » non reconnu.`);
      lignes.push({
        ligne, nom,
        zone: clean(get(r, "zone")) || null,
        etablissement: clean(get(r, "etablissement")) || null,
        specialite: clean(get(r, "specialite")) || null,
        prenom: clean(get(r, "prenom")) || null,
        grade: clean(get(r, "grade")) || null,
        statut, statutBrut,
        potentiel: nombre(get(r, "potentiel")),
        sur10: nombre(get(r, "sur10")),
        pourcentage: nombre(get(r, "pourcentage")),
        segmentFichier: segmentDe(get(r, "segment")),
      });
    });
    const texte = rows.slice(0, h).flat().map(clean).filter((t) => t.length > 12);
    for (const r of Object.values(feuilles)) for (const row of r.slice(0, 20)) for (const c of row ?? []) { const t = clean(c); if (t.length > 40 && !texte.includes(t)) texte.push(t); }
    const qS10 = entete.find((c) => c.champ === "sur10")?.texte ?? "";
    const m = normalizeHeader(qS10).match(/sous ([a-z0-9][a-z0-9 -]*)$/);
    const qPot = entete.find((c) => c.champ === "potentiel")?.texte ?? "";
    const mp = normalizeHeader(qPot).match(/patients?.*?(semaine|mois|jour)\s*(pour\s+)?([a-z0-9]+)?/);
    const metrique = mp ? `patients${mp[3] ? ` ${mp[3].toUpperCase()}` : ""} / ${mp[1]}` : null;
    return { feuille, entete, lignes, texte, produitMentionne: m ? m[1].trim() : null, metrique, anomalies };
  }
  return null;
}

export interface ReglesLuesDuTexte {
  seuilPotentiel: number | null;
  seuilAffinite: number | null;
  comparaisonAffinite: Comparaison;
  /** Zones que le texte déclare en exception (« exception pour le PF de l'Ouest »). */
  zonesEnException: string[];
  /** Le repère écrit (« en 2026 … en moyenne de 7,21 % ») — affiché, ne classe personne. */
  reference: { valeur: number; annee: number } | null;
  /** Le texte définit NA comme « non applicable » (le glossaire du classeur de la Direction). */
  naNonApplicable: boolean;
}

/** Les règles que la feuille ÉNONCE en toutes lettres. */
export function reglesDuTexte(texte: readonly string[]): ReglesLuesDuTexte {
  const t = texte.map((x) => normalizeHeader(x.replace(/%/g, " pourcent "))).join(" | ");
  const p = t.match(/(\d+(?:[ .]\d+)?)\s*patients?\s*par\s*semaine/);
  const a = t.match(/(?:ratio|taux|affinite)[^|]*?(>|superieur|plus de)?\s*a?\s*(\d+(?:[ .]\d+)?)\s*pourcent/);
  const strict = /(>|superieur)/.test(texte.join(" ").match(/ratio[^.]*?%/i)?.[0] ?? "") || /ratio\s*>/i.test(texte.join(" "));
  const zones = [...t.matchAll(/exception pour (?:le |la |les )?(?:pf |portefeuille |zone |region )?(?:de |d |du )?(?:l )?([a-z]+)/g)].map((m) => m[1]).filter(Boolean);
  const ref = t.match(/(?:en (20\d\d)\b[^|]*?)?moyenne (?:de |d )?(\d+(?: \d{1,2})?)\s*pourcent/);
  const refValeur = ref ? Number(ref[2].replace(" ", ".")) / 100 : null;
  return {
    reference: refValeur !== null && refValeur >= 0 && refValeur <= 1 ? { valeur: refValeur, annee: ref?.[1] ? Number(ref[1]) : new Date().getFullYear() } : null,
    naNonApplicable: /\bna\b[^|]{0,20}non applicable/.test(t),
    seuilPotentiel: p ? Number(p[1].replace(" ", ".")) : null,
    seuilAffinite: a ? Number(a[2].replace(" ", ".")) / 100 : null,
    comparaisonAffinite: strict ? ">" : ">=",
    zonesEnException: [...new Set(zones.map((z) => z.charAt(0).toUpperCase() + z.slice(1)))],
  };
}

/** La méthode d'affinité qu'appliquent les POURCENTAGES du fichier — déduite des données, pas supposée. */
export function methodeDuFichier(lignes: readonly LigneClasseur[]): { methode: MethodeAffinite | null; preuves: number } {
  let fichier = 0, sur10 = 0;
  for (const l of lignes) {
    if (l.pourcentage === null || l.sur10 === null || l.sur10 === 0) continue;
    if (l.potentiel && Math.abs(l.pourcentage - l.sur10 / l.potentiel) < 1e-6) fichier++;
    if (Math.abs(l.pourcentage - l.sur10 / 10) < 1e-6) sur10++;
  }
  if (fichier === 0 && sur10 === 0) return { methode: null, preuves: 0 };
  return fichier >= sur10 ? { methode: "RATIO_FICHIER", preuves: fichier } : { methode: "SUR_10", preuves: sur10 };
}

export interface FrequencesLues { h: number | null; groupes: { segments: Segment[]; frequence: number }[] }

/** Une fréquence lue pour UNE zone et UN côté (In = wilaya pivot du KAM, Out = les autres wilayas). */
export interface FrequenceZone { zone: string | null; inOut: "IN" | "OUT"; groupe: string; frequence: number }

/**
 * Les fréquences de visite que la feuille des KAM écrit par groupe (« H, A & B » → 2 ; « C & D » → 1), par ZONE (les
 * blocs « Centre », « Ouest », « Est ») et par côté (« In » = la wilaya pivot du KAM, « Out » = les autres). La valeur
 * la plus fréquente d'un groupe fait la règle générale ; chaque zone/côté qui s'en écarte devient une EXCEPTION.
 */
export function frequencesDesFeuilles(feuilles: Feuilles, zones: readonly string[] = []): FrequencesLues & { ecarts: string[]; parZone: FrequenceZone[] } {
  const parGroupe = new Map<string, number[]>();
  const parZone: FrequenceZone[] = [];
  const zonesConnues = new Map(zones.map((z) => [z.trim().toLowerCase(), z.trim()]));
  for (const rows of Object.values(feuilles)) {
    let groupe: string | null = null;
    let zone: string | null = null;
    for (const r of rows) {
      for (let i = 0; i < (r?.length ?? 0); i++) {
        const t = clean(r[i]);
        if (/^[HABCD](\s*[,&]\s*[HABCD])+$/i.test(t.replace(/\s+/g, " "))) { groupe = t.toUpperCase().replace(/\s+/g, ""); }
        // Un bloc de zone commence par son nom seul dans une cellule (« Centre », « Ouest », « Est »).
        const z = zonesConnues.get(t.toLowerCase());
        if (z) { zone = z; groupe = null; }
      }
      if (!groupe) continue;
      // La première valeur numérique après « In/Out » est le nombre, la suivante la fréquence.
      const nums = (r ?? []).map(nombre);
      const io = (r ?? []).findIndex((c) => /^(in|out)$/i.test(clean(c)));
      if (io < 0) continue;
      const f = nums[io + 2];
      if (f !== null && f !== undefined) {
        (parGroupe.get(groupe) ?? parGroupe.set(groupe, []).get(groupe)!).push(f);
        parZone.push({ zone, inOut: /^in$/i.test(clean(r[io])) ? "IN" : "OUT", groupe, frequence: f });
      }
    }
  }
  const mode = (xs: number[]) => { const m = new Map<number, number>(); xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)); return [...m].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null; };
  let h: number | null = null;
  const groupes: FrequencesLues["groupes"] = [];
  const ecarts: string[] = [];
  for (const [g, xs] of parGroupe) {
    const f = mode(xs);
    if (f === null) continue;
    if (new Set(xs).size > 1) ecarts.push(`Groupe ${g} : fréquences ${[...new Set(xs)].join(", ")} selon la zone ou In/Out — retenu ${f}.`);
    const segs = g.split(/[,&]/).filter((s): s is Segment => ["A", "B", "C", "D"].includes(s));
    if (g.split(/[,&]/).includes("H")) h = f;
    if (segs.length) groupes.push({ segments: segs, frequence: f });
  }
  return { h, groupes: groupes.sort((a, b) => b.frequence - a.frequence), ecarts, parZone };
}

/**
 * LES EXCEPTIONS DE FRÉQUENCE d'une feuille des KAM : chaque (zone, In/Out) dont la fréquence d'un groupe s'écarte de
 * la fréquence générale du groupe — pour les priorités qui portent ses segments, et pour H quand le groupe le nomme.
 */
export function exceptionsDeFrequence(freq: ReturnType<typeof frequencesDesFeuilles>): { zone: string | null; inOut: "IN" | "OUT"; priorite: string; frequence: number }[] {
  const generale = new Map<string, number>();
  for (const g of freq.groupes) generale.set(g.segments.join(","), g.frequence);
  const out: { zone: string | null; inOut: "IN" | "OUT"; priorite: string; frequence: number }[] = [];
  for (const x of freq.parZone) {
    const morceaux = x.groupe.split(/[,&]/);
    const segs = morceaux.filter((s) => ["A", "B", "C", "D"].includes(s)).join(",");
    const rang = freq.groupes.findIndex((g) => g.segments.join(",") === segs);
    const base = generale.get(segs);
    if (rang >= 0 && base !== undefined && x.frequence !== base) out.push({ zone: x.zone, inOut: x.inOut, priorite: `P${rang + 1}`, frequence: x.frequence });
    if (morceaux.includes("H") && freq.h !== null && x.frequence !== freq.h) out.push({ zone: x.zone, inOut: x.inOut, priorite: "H", frequence: x.frequence });
  }
  // Une même exception lue deux fois (In et Out identiques, deux tableaux) ne compte qu'une fois.
  return out.filter((e, i) => out.findIndex((o) => o.zone === e.zone && o.inOut === e.inOut && o.priorite === e.priorite) === i);
}

/**
 * LA GRILLE PAR LETTRE lue dans la feuille des KAM : H (sa fréquence), « A & B » et « C & D », In et Out. Les fréquences
 * d'une zone qui s'écartent deviennent les valeurs PROPRES du secteur de la BU du même nom ; sans un tel secteur, elles
 * sont dites (à poser dans les Règles), jamais appliquées à une zone qui n'existe pas.
 */
export function grilleDesFrequences(
  freq: ReturnType<typeof frequencesDesFeuilles>,
  exceptions: ReturnType<typeof exceptionsDeFrequence>,
  secteurDeZone: OptionsProposition["secteurDeZone"],
  provenance: string[],
): Grille | null {
  const de = (segs: Segment[]) => freq.groupes.find((g) => segs.every((s) => g.segments.includes(s)))?.frequence ?? null;
  const ab = de(["A", "B"]), cd = de(["C", "D"]), h = freq.h ?? ab;
  if (ab === null || cd === null || h === null) return null;
  const defaut: GrilleFrequence = { H_IN: h, H_OUT: h, AB_IN: ab, AB_OUT: ab, CD_IN: cd, CD_OUT: cd };
  const rangDe = (segs: Segment[]) => `P${freq.groupes.findIndex((g) => segs.every((s) => g.segments.includes(s))) + 1}`;
  const secteurs = new Map<string, GrilleSecteur>();
  for (const e of exceptions) {
    if (!e.zone) continue;
    const groupe = e.priorite === "H" ? "H" : e.priorite === rangDe(["A", "B"]) ? "AB" : e.priorite === rangDe(["C", "D"]) ? "CD" : null;
    if (!groupe) continue;
    const s = secteurDeZone?.(e.zone) ?? null;
    const cotes = e.inOut ? [e.inOut] : (["IN", "OUT"] as const);
    if (!s) {
      provenance.push(`Fréquence propre « ${e.zone} » (${groupe === "AB" ? "A & B" : groupe === "CD" ? "C & D" : "H"}, ${cotes.join(" et ")} : ${e.frequence}) — aucun secteur « ${e.zone} » dans la BU : à poser dans les Règles.`);
      continue;
    }
    const g = secteurs.get(s.id) ?? { secteurId: s.id, nom: s.nom, valeurs: {} };
    for (const c of cotes) g.valeurs[`${groupe}_${c}` as CleFrequence] = e.frequence;
    secteurs.set(s.id, g);
  }
  // H n'est jamais sous A & B : une valeur propre de A & B entraîne H avec elle.
  for (const g of secteurs.values()) for (const c of ["IN", "OUT"] as const) {
    const abv = g.valeurs[`AB_${c}`];
    if (abv !== undefined && (g.valeurs[`H_${c}`] ?? defaut[`H_${c}`]) < abv) g.valeurs[`H_${c}`] = abv;
  }
  for (const g of secteurs.values()) provenance.push(`Secteur ${g.nom} : fréquences propres ${Object.entries(g.valeurs).map(([k, v]) => `${k.replace("_", " ").replace("AB", "A & B").replace("CD", "C & D")} ${v}`).join(", ")} — lues dans la feuille des KAM.`);
  provenance.push(`Grille : H ${h}, A & B ${ab}, C & D ${cd} visite(s) par cycle — lue dans la feuille des KAM.`);
  return { defaut, secteurs: [...secteurs.values()] };
}

/** Le segment calculé pour une ligne, avec des règles données (sans dérogation) — pour comparer au fichier. */
export function segmentCalcule(l: LigneClasseur, regles: Regles): string {
  const r = segmenterPraticien({
    doctorId: String(l.ligne), statut: l.statut, zone: l.zone, derogations: [],
    observations: [{ productId: regles.produits[0].productId, potentiel: l.potentiel, prescriptionsSur10: l.sur10, observeLe: new Date(0) }],
  }, regles);
  if (r.h) return "H";
  return r.produits[0].etat;
}

/** Un classement du fichier et un calcul DISENT-ILS LA MÊME CHOSE ? (NA ≡ Non ciblé.) */
export function concorde(fichier: LigneClasseur["segmentFichier"], calcule: string): boolean {
  if (fichier === null) return true;
  if (fichier === "NA") return calcule === "NON_CIBLE" || calcule === "EN_ATTENTE";
  return fichier === calcule;
}

/**
 * L'EXCEPTION D'UNE ZONE, déduite des classements du fichier quand le texte l'annonce sans chiffre :
 * parmi des seuils plausibles (potentiels et ratios observés dans la zone, jamais plus stricts que la
 * règle générale), celui qui reproduit le plus de lignes. Rendue avec son score — c'est une PROPOSITION.
 */
export function deduireException(lignes: readonly LigneClasseur[], base: RegleProduit, regles: Regles, zone: string): { exception: ExceptionZone; avant: number; apres: number; total: number } | null {
  const z = lignes.filter((l) => (l.zone ?? "").toLowerCase() === zone.toLowerCase() && l.segmentFichier && ["A", "B", "C", "D"].includes(l.segmentFichier) && l.potentiel !== null);
  if (z.length === 0) return null;
  const score = (r: Regles) => z.filter((l) => concorde(l.segmentFichier, segmentCalcule(l, r))).length;
  const avant = score(regles);
  let best: { exception: ExceptionZone; n: number } | null = null;
  const pots = [...new Set(z.map((l) => l.potentiel!).filter((p) => p > 0 && p <= base.seuilPotentiel))].sort((a, b) => b - a);
  const affs = [...new Set([base.seuilAffinite, ...z.map((l) => (base.methodeAffinite === "SUR_10" ? (l.sur10 ?? 0) / 10 : l.potentiel ? (l.sur10 ?? 0) / l.potentiel : 0)).filter((a) => a > 0 && a <= base.seuilAffinite)])].sort((a, b) => b - a);
  for (const sp of pots) for (const sa of affs) for (const comp of [">", ">="] as Comparaison[]) {
    const exception: ExceptionZone = { zone, seuilPotentiel: sp, seuilAffinite: sa, comparaisonAffinite: comp };
    const r: Regles = { ...regles, produits: regles.produits.map((p) => (p.productId === base.productId ? { ...p, exceptions: [...p.exceptions.filter((e) => e.zone !== zone), exception] } : p)) };
    const n = score(r);
    if (!best || n > best.n) best = { exception, n };
  }
  if (!best || best.n <= avant) return null;
  return { exception: best.exception, avant, apres: best.n, total: z.length };
}

export interface PropositionRegles {
  contenu: unknown;
  erreurs: string[];
  /** D'où vient chaque valeur — ce que l'écran montre avant la publication. */
  provenance: string[];
  concordance: { total: number; identiques: number; divergences: { ligne: number; nom: string; fichier: string; calcule: string }[] };
}

/** La CAPACITÉ écrite dans la feuille des KAM : « Moyenne Contacts / Jour » → 7 ; « Cycle de 20 Jours » → 20. */
export function capaciteDesFeuilles(feuilles: Feuilles): { contactsParJour: number; joursParCycle: number } | null {
  let cj: number | null = null, jc: number | null = null;
  for (const rows of Object.values(feuilles)) {
    for (const r of rows.slice(0, 200)) {
      for (let i = 0; i < (r?.length ?? 0); i++) {
        const n = normalizeHeader(r[i]);
        if (!n) continue;
        if (cj === null && /contacts? jour/.test(n) && !/cycle/.test(n)) {
          const v = (r ?? []).slice(i + 1).map(nombre).find((x) => x !== null && x > 0);
          if (v !== undefined && v !== null) cj = v;
        }
        const m = n.match(/cycle de (\d+) jours?/);
        if (jc === null && m) jc = Number(m[1]);
      }
    }
  }
  return cj !== null && jc !== null && jc > 0 ? { contactsParJour: cj, joursParCycle: jc } : null;
}

export interface OptionsProposition {
  /** Déduire les seuils d'une zone que le texte annonce en exception sans chiffre (défaut : oui). */
  exceptionsDeduites?: boolean;
  /** Proposer aussi la GRILLE par lettre × In/Out et la capacité lues dans la feuille des KAM. */
  grille?: boolean;
  /** Le secteur de la BU qui porte le nom d'une zone du fichier (« Ouest ») — pour ses fréquences propres. */
  secteurDeZone?: (zone: string) => { id: string; nom: string } | null;
}

/** La PROPOSITION de règles v1 tirée d'un classeur — à publier par une personne, après lecture. */
export function proposerRegles(lecture: LectureClasseur, feuilles: Feuilles, productId: string, opts: OptionsProposition = {}): PropositionRegles {
  const txt = reglesDuTexte(lecture.texte);
  const meth = methodeDuFichier(lecture.lignes);
  const zones = [...new Set(lecture.lignes.map((l) => l.zone).filter((z): z is string => !!z))];
  const freq = frequencesDesFeuilles(feuilles, zones);
  const exceptionsFrequence = exceptionsDeFrequence(freq);
  const provenance: string[] = [];
  if (txt.seuilPotentiel !== null) provenance.push(`Haut potentiel : à partir de ${txt.seuilPotentiel} (${lecture.metrique ?? "potentiel"}) — lu dans la feuille.`);
  if (txt.seuilAffinite !== null) provenance.push(`Affinité : ${txt.comparaisonAffinite === ">" ? "au-delà de" : "à partir de"} ${Math.round(txt.seuilAffinite * 1000) / 10} % — lu dans la feuille.`);
  if (txt.reference) provenance.push(`Repère : moyenne ${txt.reference.annee} de ${String(Math.round(txt.reference.valeur * 10000) / 100).replace(".", ",")} % — lu dans la feuille, ne classe personne.`);
  if (meth.methode) provenance.push(`Méthode d'affinité : ${meth.methode === "RATIO_FICHIER" ? "celle du classeur (Q2 ÷ Q1, la colonne « % »)" : "part sur 10 patients"} — déduite de ${meth.preuves} pourcentage(s) du fichier.`);
  // NA = « non applicable » : 0 patient déclaré reste au panel, en NA (le glossaire), au lieu de « non ciblé ».
  const potentielNulNA = txt.naNonApplicable && lecture.lignes.some((l) => l.segmentFichier === "NA" && l.potentiel === 0);
  if (potentielNulNA) provenance.push("0 patient déclaré → NA (non applicable) — défini dans la feuille.");
  // Un statut est « H » quand ses lignes le sont (presque) toutes — un décideur l'est d'office ; une exception isolée
  // d'un autre statut reste une lettre du fichier, pas une règle.
  const hStatuts = [...new Set(lecture.lignes.filter((l) => l.segmentFichier === "H" && l.statut).map((l) => l.statut!))].filter((s) => {
    const avecLettre = lecture.lignes.filter((l) => l.statut === s && l.segmentFichier);
    return avecLettre.filter((l) => l.segmentFichier === "H").length >= avecLettre.length * 0.8;
  });
  if (hStatuts.length) provenance.push(`H = ${hStatuts.join(", ")} — d'après les lignes classées H.`);
  if (freq.h !== null) provenance.push(`Fréquence H : ${freq.h} par cycle — lue dans la feuille des KAM.`);
  freq.groupes.forEach((g, i) => provenance.push(`Priorité P${i + 1} (${g.segments.join(", ")}) : ${g.frequence} visite(s) par cycle — lue dans la feuille des KAM.`));
  // Les écarts deviennent des exceptions explicites (zone, In = wilaya pivot du KAM / Out) — pas une moyenne qui les efface.
  for (const e of exceptionsFrequence) provenance.push(`${e.priorite === "H" ? "H" : `Priorité ${e.priorite}`} — ${e.zone ?? "toutes zones"}, ${e.inOut === "IN" ? "In (wilaya pivot du KAM)" : "Out"} : ${e.frequence} visite(s) par cycle — lue dans la feuille des KAM.`);
  if (exceptionsFrequence.length === 0) provenance.push(...freq.ecarts);
  const produit: RegleProduit = {
    productId, metrique: lecture.metrique ?? "patients / semaine",
    seuilPotentiel: txt.seuilPotentiel ?? NaN, seuilAffinite: txt.seuilAffinite ?? NaN,
    comparaisonAffinite: txt.comparaisonAffinite, methodeAffinite: meth.methode ?? "SUR_10", exceptions: [],
    ...(txt.reference ? { reference: txt.reference } : {}),
  };
  const grille = opts.grille ? grilleDesFrequences(freq, exceptionsFrequence, opts.secteurDeZone, provenance) : null;
  const capacite = opts.grille ? capaciteDesFeuilles(feuilles) : null;
  if (capacite) provenance.push(`Capacité : ${capacite.contactsParJour} contacts par jour, cycle de ${capacite.joursParCycle} jours — lue dans la feuille des KAM.`);
  const contenu = {
    produits: [produit],
    ciblage: { statutsNonCibles: [], potentielNulNonCible: true, ...(potentielNulNA ? { potentielNulNA: true } : {}) },
    h: { statuts: hStatuts, frequence: freq.h },
    priorites: { regles: freq.groupes.map((g, i) => ({ priorite: `P${i + 1}`, rang1: g.segments })), repli: null },
    frequences: Object.fromEntries(freq.groupes.map((g, i) => [`P${i + 1}`, g.frequence])),
    ...(exceptionsFrequence.length ? { exceptionsFrequence } : {}),
    ...(grille ? { grille } : {}),
    ...(capacite ? { capacite } : {}),
  };
  const lu = lireRegles(contenu);
  const erreurs = lu.ok ? [] : lu.erreurs;
  if (lu.ok && opts.exceptionsDeduites === false) {
    // Le classeur de la Direction : l'exception est annoncée SANS chiffre et ses lettres ont été posées à la main.
    // Aucun seuil n'est inventé : la règle générale s'applique, et les lettres du fichier sont gardées telles quelles.
    for (const zone of txt.zonesEnException) provenance.push(`Exception ${zone} annoncée par la feuille, sans chiffre : règle générale ; les lettres de la zone qui s'en écartent sont gardées telles quelles.`);
  } else if (lu.ok) {
    // Les zones que le texte déclare en exception : seuils déduits des classements du fichier, montrés comme tels.
    for (const zone of txt.zonesEnException) {
      const d = deduireException(lecture.lignes, lu.regles.produits[0], lu.regles, zone);
      if (!d) { provenance.push(`Exception ${zone} annoncée par la feuille, sans seuil déductible : non appliquée.`); continue; }
      produit.exceptions.push(d.exception);
      lu.regles.produits[0].exceptions.push(d.exception);
      provenance.push(`Exception ${zone} (annoncée par la feuille, seuils DÉDUITS des classements) : potentiel ≥ ${d.exception.seuilPotentiel}, affinité ${d.exception.comparaisonAffinite === ">" ? ">" : "≥"} ${Math.round((d.exception.seuilAffinite ?? 0) * 1000) / 10} % — reproduit ${d.apres}/${d.total} lignes de la zone (${d.avant} sans exception).`);
    }
  }
  const divergences: PropositionRegles["concordance"]["divergences"] = [];
  let total = 0, identiques = 0;
  if (lu.ok) for (const l of lecture.lignes) {
    if (!l.segmentFichier) continue;
    total++;
    const c = segmentCalcule(l, lu.regles);
    if (concorde(l.segmentFichier, c)) identiques++;
    else divergences.push({ ligne: l.ligne, nom: [l.nom, l.prenom].filter(Boolean).join(" "), fichier: l.segmentFichier, calcule: c });
  }
  return { contenu, erreurs, provenance, concordance: { total, identiques, divergences } };
}
