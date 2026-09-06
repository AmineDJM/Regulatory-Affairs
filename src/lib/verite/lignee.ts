/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LIGNÉE D'UN CHIFFRE (mandat 6 §46) — pur.
 *
 * ── LA DIFFÉRENCE ENTRE UNE SOURCE ET UNE LIGNÉE ────────────────────────────────────────
 *
 * La provenance (§22) répond à « d'où sort ce chiffre ? » — elle nomme la source. Elle ne répond
 * pas à « comment est-il devenu CE chiffre ? ». Or entre trois exports et le nombre affiché, il
 * s'est passé quatre choses : on a extrait, on a retiré des doublons, on a converti une devise,
 * on a consolidé. Chacune peut être fausse, et chacune a PERDU quelque chose.
 *
 * « 41,3 M$ = 3 sources → doublons supprimés → conversion → consolidation » n'est pas une jolie
 * phrase : c'est la seule forme sous laquelle un dirigeant peut contester une étape précise au
 * lieu de rejeter le chiffre entier — ou, pire, de l'accepter faute de pouvoir le discuter.
 *
 * ── CE QUE LA VÉRIFICATION REFUSE ───────────────────────────────────────────────────────
 *
 * Un résultat dont la chaîne ne remonte à AUCUNE source n'est pas un résultat : c'est une
 * affirmation. `verifier` le dit, et c'est le seul contrôle du module qui ait des dents — le
 * reste décrit, celui-là refuse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const NATURES_ETAPE = [
  /** Une source brute : un export, une table, un document, une saisie. */
  "SOURCE",
  /** On en a tiré des lignes ou des champs. */
  "EXTRACTION",
  /** On a écarté, corrigé, dédoublonné — c'est là que des lignes DISPARAISSENT. */
  "NETTOYAGE",
  /** On a changé d'unité, de devise, de granularité. */
  "TRANSFORMATION",
  /** On a calculé : somme, moyenne, projection, simulation. */
  "CALCUL",
  /** On a réuni plusieurs branches en une. */
  "CONSOLIDATION",
  /** Le chiffre montré. */
  "RESULTAT",
] as const;
export type NatureEtape = (typeof NATURES_ETAPE)[number];

export interface Etape {
  id: string;
  nature: NatureEtape;
  /** En français, ce qui a été fait : « doublons retirés sur l'empreinte du numéro de facture ». */
  libelle: string;
  /** Les identifiants des étapes dont celle-ci découle. Vide pour une SOURCE. */
  entrees: string[];
  /** La valeur à ce point de la chaîne, quand elle est connue — c'est ce qui rend l'audit possible. */
  valeur?: string | number | null;
  /** Combien de lignes entrent et sortent : l'écart EST le contrôle le moins cher qui existe. */
  lignesEntrantes?: number | null;
  lignesSortantes?: number | null;
  /** Ce que l'étape a PERDU. Une étape qui perd sans le dire est le défaut le plus coûteux ici. */
  perte?: string | null;
  quand?: Date | null;
}

export interface Lignee {
  etapes: Etape[];
  resultat: Etape | null;
}

export interface Anomalie { etape: string; quoi: string; gravite: "BLOQUANT" | "AVERTISSEMENT" }

export function construire(etapes: readonly Etape[]): Lignee {
  const liste = [...etapes];
  return { etapes: liste, resultat: liste.find((e) => e.nature === "RESULTAT") ?? null };
}

/**
 * LES DÉFAUTS D'UNE LIGNÉE — et deux d'entre eux sont BLOQUANTS.
 *
 * Bloquant veut dire : le chiffre ne doit pas être présenté comme prouvé. Un résultat qui ne
 * remonte à aucune source, ou une chaîne qui tourne en rond, ne sont pas des imprécisions.
 */
export function verifier(l: Lignee): { valide: boolean; anomalies: Anomalie[]; sources: Etape[]; profondeur: number } {
  const parId = new Map(l.etapes.map((e) => [e.id, e]));
  const anomalies: Anomalie[] = [];
  const sources = l.etapes.filter((e) => e.nature === "SOURCE");

  for (const e of l.etapes) {
    for (const entree of e.entrees) {
      if (!parId.has(entree)) anomalies.push({ etape: e.id, quoi: `entrée « ${entree} » introuvable dans la chaîne`, gravite: "BLOQUANT" });
    }
    if (e.nature !== "SOURCE" && e.entrees.length === 0) {
      anomalies.push({ etape: e.id, quoi: "aucune entrée : cette étape sort de nulle part", gravite: "BLOQUANT" });
    }
    // UNE ÉTAPE QUI PERD DES LIGNES SANS LE DIRE. Le plus fréquent, le plus silencieux, et celui
    // qui explique la plupart des écarts entre deux chiffres censés être le même.
    if (typeof e.lignesEntrantes === "number" && typeof e.lignesSortantes === "number"
      && e.lignesSortantes < e.lignesEntrantes && !e.perte) {
      anomalies.push({ etape: e.id, quoi: `${e.lignesEntrantes - e.lignesSortantes} ligne(s) perdue(s) sans explication`, gravite: "AVERTISSEMENT" });
    }
  }

  if (!l.resultat) anomalies.push({ etape: "(aucune)", quoi: "la chaîne n'a pas d'étape RESULTAT", gravite: "BLOQUANT" });
  if (sources.length === 0) anomalies.push({ etape: "(aucune)", quoi: "la chaîne ne remonte à AUCUNE source : ce n'est pas un résultat, c'est une affirmation", gravite: "BLOQUANT" });

  // CYCLE : une étape qui, en remontant, se retrouve elle-même.
  const etat = new Map<string, 0 | 1 | 2>();
  const cycle = (id: string): boolean => {
    const v = etat.get(id) ?? 0;
    if (v === 1) return true;
    if (v === 2) return false;
    etat.set(id, 1);
    for (const p of parId.get(id)?.entrees ?? []) if (parId.has(p) && cycle(p)) return true;
    etat.set(id, 2);
    return false;
  };
  for (const e of l.etapes) {
    if (cycle(e.id)) { anomalies.push({ etape: e.id, quoi: "la chaîne tourne en rond", gravite: "BLOQUANT" }); break; }
  }

  // Et les étapes qui ne mènent nulle part : sans conséquence sur le chiffre, mais elles disent
  // qu'on a lu quelque chose pour rien — ou qu'un branchement a été oublié.
  if (l.resultat) {
    const atteintes = new Set<string>();
    const remonter = (id: string) => {
      if (atteintes.has(id)) return;
      atteintes.add(id);
      for (const p of parId.get(id)?.entrees ?? []) remonter(p);
    };
    remonter(l.resultat.id);
    for (const e of l.etapes) {
      if (!atteintes.has(e.id)) anomalies.push({ etape: e.id, quoi: "cette étape ne contribue pas au résultat", gravite: "AVERTISSEMENT" });
    }
  }

  return {
    valide: !anomalies.some((a) => a.gravite === "BLOQUANT"),
    anomalies, sources,
    profondeur: profondeurDe(l),
  };
}

function profondeurDe(l: Lignee): number {
  const parId = new Map(l.etapes.map((e) => [e.id, e]));
  const vu = new Map<string, number>();
  const calc = (id: string, pile: Set<string>): number => {
    if (vu.has(id)) return vu.get(id)!;
    if (pile.has(id)) return 0;
    pile.add(id);
    const e = parId.get(id);
    const p = e && e.entrees.length ? 1 + Math.max(...e.entrees.map((x) => calc(x, pile))) : 0;
    pile.delete(id);
    vu.set(id, p);
    return p;
  };
  return l.resultat ? calc(l.resultat.id, new Set()) : 0;
}

/**
 * LA LIGNÉE EN UNE PHRASE — « 41,3 M$ = 3 sources → doublons supprimés → conversion →
 * consolidation ».
 *
 * On remonte depuis le résultat et on garde l'ordre des TRANSFORMATIONS, pas celui des étapes :
 * ce que le lecteur veut savoir, c'est ce qui est arrivé au chiffre, dans l'ordre où c'est
 * arrivé. Les sources sont comptées, pas listées — les nommer toutes noierait la phrase.
 */
export function raconter(l: Lignee): string {
  const v = verifier(l);
  if (!l.resultat) return "aucun résultat dans cette chaîne.";
  const parId = new Map(l.etapes.map((e) => [e.id, e]));

  const chemin: Etape[] = [];
  const vu = new Set<string>();
  const remonter = (id: string) => {
    if (vu.has(id)) return;
    vu.add(id);
    const e = parId.get(id);
    if (!e) return;
    for (const p of e.entrees) remonter(p);
    if (e.nature !== "SOURCE" && e.nature !== "RESULTAT") chemin.push(e);
  };
  remonter(l.resultat.id);

  const tete = l.resultat.valeur !== undefined && l.resultat.valeur !== null ? String(l.resultat.valeur) : l.resultat.libelle;
  const nSources = v.sources.length;
  const morceaux = [`${nSources} source${nSources > 1 ? "s" : ""}`, ...chemin.map((e) => e.libelle)];
  const pertes = l.etapes.filter((e) => e.perte).map((e) => `${e.libelle} : ${e.perte}`);
  return `${tete} = ${morceaux.join(" → ")}${pertes.length ? ` — écarté en chemin : ${pertes.join(" ; ")}` : ""}`;
}

/** Le détail étape par étape, pour qui veut contester UNE étape et pas le chiffre entier. */
export function detailler(l: Lignee): { etape: string; nature: NatureEtape; quoi: string; valeur: string | null; lignes: string | null; perte: string | null }[] {
  return l.etapes.map((e) => ({
    etape: e.id, nature: e.nature, quoi: e.libelle,
    valeur: e.valeur === undefined || e.valeur === null ? null : String(e.valeur),
    lignes: typeof e.lignesEntrantes === "number" || typeof e.lignesSortantes === "number"
      ? `${e.lignesEntrantes ?? "?"} → ${e.lignesSortantes ?? "?"}`
      : null,
    perte: e.perte ?? null,
  }));
}
