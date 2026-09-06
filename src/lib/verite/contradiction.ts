/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MOTEUR DE CONTRADICTIONS (mandat 6 §46) — pur, et il ne tranche JAMAIS au hasard.
 *
 * ── LE CAS D'ÉCOLE, ET IL EST RÉEL ──────────────────────────────────────────────────────
 *
 * L'ERP dit 15 M€. Le classeur dit 17 M€. L'e-mail du directeur dit 16,5 M€. Trois chiffres
 * pour la même question, et trois façons de mal s'en sortir :
 *
 *   · prendre le premier trouvé — c'est ce que fait un système qui ne sait pas qu'il y a conflit ;
 *   · prendre le plus récent — souvent juste, parfois faux, jamais expliqué ;
 *   · faire une moyenne — la seule réponse dont on est certain qu'aucune source ne la porte.
 *
 * ── LA PREMIÈRE QUESTION N'EST PAS « QUI A RAISON » ─────────────────────────────────────
 *
 * C'est « est-ce bien la même question ». Trois chiffres qui diffèrent sont, neuf fois sur dix,
 * trois réponses à trois questions légèrement différentes : HT contre TTC, périmètre Adventum
 * contre groupe, arrêté au 30 juin contre au 31 juillet. Résoudre cela comme un conflit
 * produirait un gagnant et deux perdants là où les trois avaient raison — et surtout, cela
 * masquerait la vraie information : le CONTEXTE manquait.
 *
 * ── L'AUTORITÉ N'EST PAS GÉNÉRALE, ELLE EST PAR TYPE DE FAIT ────────────────────────────
 *
 * L'ERP fait autorité sur un montant enregistré ; le CONTRAT SIGNÉ fait autorité sur une clause,
 * même si l'ERP dit autre chose ; une personne fait autorité sur son propre engagement. Une
 * hiérarchie unique « ERP > document > e-mail » se tromperait systématiquement sur la deuxième
 * ligne. L'appelant fournit donc l'autorité applicable AU FAIT en question.
 *
 * ── ET QUAND RIEN NE DÉPARTAGE ──────────────────────────────────────────────────────────
 *
 * Deux issues, jamais un choix : À CHERCHER (le code NOMME l'information qui trancherait) ou
 * À TRANCHER (une question posée à une personne, avec les options et ce qui les distingue). Un
 * moteur qui conclurait faute de mieux serait exactement ce que le mandat interdit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** D'où vient une valeur — et c'est la nature, pas le nom, qui porte l'autorité. */
export const NATURES_SOURCE = ["ERP", "DOCUMENT_SIGNE", "DOCUMENT", "TABLEUR", "EMAIL", "PERSONNE", "CALCUL", "EXTERNE"] as const;
export type NatureSource = (typeof NATURES_SOURCE)[number];

/**
 * L'AUTORITÉ PAR DÉFAUT, et elle est assumée comme un DÉFAUT.
 *
 * Elle vaut pour un fait ordinaire : un montant, un statut, une date enregistrés dans l'outil de
 * travail. Elle est FAUSSE pour une clause contractuelle, où le document signé prime — d'où
 * `autoriteParFait`, que l'appelant fournit quand le fait le demande.
 */
export const AUTORITE_DEFAUT: Readonly<Record<NatureSource, number>> = {
  ERP: 0.9,
  DOCUMENT_SIGNE: 0.85,
  CALCUL: 0.8,
  DOCUMENT: 0.6,
  TABLEUR: 0.5,
  EMAIL: 0.45,
  PERSONNE: 0.5,
  EXTERNE: 0.4,
};

/** L'autorité qui s'inverse selon le fait — une clause contre un montant. */
export const AUTORITE_CLAUSE: Readonly<Record<NatureSource, number>> = {
  ...AUTORITE_DEFAUT,
  DOCUMENT_SIGNE: 0.98,
  ERP: 0.5,
};

export interface Source {
  id: string;
  nature: NatureSource;
  libelle: string;
}

export interface Candidat {
  /** La valeur telle qu'elle est portée par la source. */
  valeur: string | number;
  source: Source;
  /** QUAND la source a été arrêtée — la fraîcheur du CHIFFRE, pas de sa lecture. */
  observeLe: Date;
  /** La confiance propre de la lecture (OCR incertain, saisie manuelle…). */
  confiance: number;
  /**
   * LE CONTEXTE — « HT », « TTC », « périmètre Adventum », « arrêté au 30/06 ».
   *
   * C'est le champ le plus important de toute cette structure : deux valeurs de contextes
   * différents ne sont PAS en contradiction, et les traiter comme telles est l'erreur la plus
   * fréquente et la plus coûteuse d'un moteur de réconciliation.
   */
  contexte?: string | null;
  /** La transformation subie, quand la valeur est dérivée (« × 1,19 », « somme de 4 lignes »). */
  transformation?: string | null;
  /** L'identifiant du candidat dont celui-ci DÉRIVE — une dérivée n'est pas une concurrente. */
  derivéDe?: string | null;
}

export interface Ecartee { valeur: string | number; source: string; pourquoi: string }

export type Verdict =
  | { issue: "AUCUN_CONFLIT"; valeur: string | number; raison: string; sources: string[] }
  | { issue: "PAS_LA_MEME_QUESTION"; raison: string; groupes: { contexte: string; valeurs: (string | number)[]; sources: string[] }[] }
  | { issue: "RESOLUE"; retenue: Candidat; ecartees: Ecartee[]; raison: string; confiance: number }
  | { issue: "A_CHERCHER"; raison: string; quoiChercher: string[]; candidats: Candidat[] }
  | { issue: "A_TRANCHER"; raison: string; question: string; options: { valeur: string | number; source: string; pour: string }[] };

export interface Options {
  /** L'autorité applicable À CE FAIT — `AUTORITE_DEFAUT` si rien n'est fourni. */
  autorite?: Readonly<Record<NatureSource, number>>;
  /** L'écart relatif en deçà duquel deux nombres sont « la même valeur » (0,5 % par défaut). */
  tolerance?: number;
  /** L'écart d'autorité à partir duquel elle tranche seule (0,2 par défaut). */
  ecartAutorite?: number;
  /** Le nombre de jours d'écart à partir duquel la fraîcheur tranche (30 par défaut). */
  joursFraicheur?: number;
}

const nombre = (v: string | number): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const normaliserContexte = (c: string | null | undefined): string => (c ?? "").trim().toLowerCase();

/** Deux valeurs sont-elles la même ? Les nombres à la tolérance près, le texte au mot près. */
function memeValeur(a: string | number, b: string | number, tolerance: number): boolean {
  const na = nombre(a); const nb = nombre(b);
  if (na !== null && nb !== null) {
    const echelle = Math.max(Math.abs(na), Math.abs(nb));
    if (echelle === 0) return na === nb;
    return Math.abs(na - nb) / echelle <= tolerance;
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

const jours = (a: Date, b: Date): number => Math.abs(a.getTime() - b.getTime()) / 86_400_000;

/**
 * RÉCONCILIE DES VALEURS CONCURRENTES.
 *
 * L'ordre des règles EST la doctrine, et chacune existe parce que l'ignorer produit une réponse
 * qui a l'air juste :
 *
 *   0. moins de deux candidats ⇒ il n'y a rien à réconcilier ;
 *   1. toutes les valeurs coïncident ⇒ AUCUN CONFLIT (et on le dit, c'est une information) ;
 *   2. les DÉRIVÉES sont retirées de la concurrence — un chiffre calculé à partir d'un autre
 *      n'est pas un témoignage indépendant, et le compter double la voix de sa source ;
 *   3. des CONTEXTES différents ⇒ PAS LA MÊME QUESTION ;
 *   4. une AUTORITÉ nettement supérieure ⇒ résolu, et l'écart est dit ;
 *   5. à autorité égale, une FRAÎCHEUR nettement supérieure ⇒ résolu ;
 *   6. sinon : ce qui manque est NOMMÉ (À CHERCHER), ou la question est posée (À TRANCHER).
 */
export function reconcilier(candidats: readonly Candidat[], options: Options = {}): Verdict {
  const autorite = options.autorite ?? AUTORITE_DEFAUT;
  const tolerance = options.tolerance ?? 0.005;
  const ecartAutorite = options.ecartAutorite ?? 0.2;
  const joursFraicheur = options.joursFraicheur ?? 30;

  if (candidats.length === 0) return { issue: "A_CHERCHER", raison: "aucune valeur trouvée", quoiChercher: ["une source qui porte ce fait"], candidats: [] };
  if (candidats.length === 1) {
    const seul = candidats[0]!;
    return { issue: "AUCUN_CONFLIT", valeur: seul.valeur, raison: `une seule source : ${seul.source.libelle}`, sources: [seul.source.libelle] };
  }

  // ── 1. TOUT LE MONDE DIT LA MÊME CHOSE ────────────────────────────────────────────────
  const premier = candidats[0]!;
  if (candidats.every((c) => memeValeur(c.valeur, premier.valeur, tolerance))) {
    return {
      issue: "AUCUN_CONFLIT", valeur: premier.valeur,
      raison: `${candidats.length} sources concordent${tolerance > 0 ? ` (à ${(tolerance * 100).toFixed(1)} % près)` : ""}`,
      sources: candidats.map((c) => c.source.libelle),
    };
  }

  // ── 2. LES DÉRIVÉES NE SONT PAS DES TÉMOINS ───────────────────────────────────────────
  const ids = new Set(candidats.map((c) => c.source.id));
  const independants = candidats.filter((c) => !(c.derivéDe && ids.has(c.derivéDe)));
  const derivees = candidats.filter((c) => c.derivéDe && ids.has(c.derivéDe));
  if (independants.length === 1) {
    return {
      issue: "RESOLUE", retenue: independants[0]!,
      ecartees: derivees.map((d) => ({ valeur: d.valeur, source: d.source.libelle, pourquoi: `dérivée de ${d.derivéDe}${d.transformation ? ` (${d.transformation})` : ""} — ce n'est pas une source indépendante` })),
      raison: "une seule source indépendante ; les autres en dérivent",
      confiance: independants[0]!.confiance,
    };
  }

  // ── 3. EST-CE BIEN LA MÊME QUESTION ? ─────────────────────────────────────────────────
  const contextes = new Map<string, Candidat[]>();
  for (const c of independants) {
    const k = normaliserContexte(c.contexte);
    contextes.set(k, [...(contextes.get(k) ?? []), c]);
  }
  // Des contextes DIFFÉRENTS et NON VIDES : ce sont des questions distinctes, pas un conflit.
  const nonVides = [...contextes.keys()].filter((k) => k !== "");
  if (nonVides.length >= 2) {
    return {
      issue: "PAS_LA_MEME_QUESTION",
      raison: "les valeurs ne portent pas sur le même périmètre : ce n'est pas une contradiction, c'est une question mal posée",
      groupes: [...contextes.entries()].map(([contexte, liste]) => ({
        contexte: contexte || "(sans contexte déclaré)",
        valeurs: liste.map((c) => c.valeur),
        sources: liste.map((c) => c.source.libelle),
      })),
    };
  }

  // ── 4. L'AUTORITÉ, PAR TYPE DE FAIT ───────────────────────────────────────────────────
  const note = (c: Candidat): number => (autorite[c.source.nature] ?? 0.5) * c.confiance;
  const tri = [...independants].sort((a, b) => note(b) - note(a));
  const tete = tri[0]!;
  const second = tri[1]!;
  if (note(tete) - note(second) >= ecartAutorite) {
    return {
      issue: "RESOLUE", retenue: tete,
      ecartees: tri.slice(1).map((c) => ({ valeur: c.valeur, source: c.source.libelle, pourquoi: `${c.source.nature} fait moins autorité que ${tete.source.nature} sur ce fait` })),
      raison: `${tete.source.nature} (${tete.source.libelle}) fait autorité sur ce fait — écart d'autorité ${(note(tete) - note(second)).toFixed(2)}`,
      confiance: Math.min(0.95, note(tete)),
    };
  }

  // ── 5. À AUTORITÉ COMPARABLE, LA FRAÎCHEUR ────────────────────────────────────────────
  const parDate = [...independants].sort((a, b) => b.observeLe.getTime() - a.observeLe.getTime());
  const recent = parDate[0]!;
  const suivant = parDate[1]!;
  if (jours(recent.observeLe, suivant.observeLe) >= joursFraicheur) {
    return {
      issue: "RESOLUE", retenue: recent,
      ecartees: parDate.slice(1).map((c) => ({ valeur: c.valeur, source: c.source.libelle, pourquoi: `arrêté le ${c.observeLe.toISOString().slice(0, 10)}, soit ${Math.round(jours(recent.observeLe, c.observeLe))} jours plus tôt` })),
      raison: `à autorité comparable, la valeur la plus récente l'emporte (${recent.observeLe.toISOString().slice(0, 10)}, ${Math.round(jours(recent.observeLe, suivant.observeLe))} jours d'écart)`,
      confiance: Math.min(0.85, recent.confiance),
    };
  }

  // ── 6. RIEN NE DÉPARTAGE — et c'est une réponse, pas un échec ─────────────────────────
  //
  // On distingue deux cas, parce qu'ils appellent deux suites : ce qui MANQUE est parfois nommable
  // (« aucune de ces valeurs ne dit si elle est HT ou TTC »), et alors la machine peut encore
  // travailler ; sinon, c'est un arbitrage, et il revient à une personne.
  const sansContexte = independants.filter((c) => !normaliserContexte(c.contexte));
  const aChercher: string[] = [];
  if (sansContexte.length === independants.length) aChercher.push("le périmètre exact de chaque valeur (HT/TTC, société, date d'arrêté)");
  if (independants.some((c) => !c.transformation) && independants.some((c) => c.transformation)) aChercher.push("la transformation appliquée aux valeurs dérivées");
  if (independants.every((c) => jours(recent.observeLe, c.observeLe) < 1)) aChercher.push("une source arrêtée à une date différente, pour départager par la fraîcheur");

  if (aChercher.length > 0) {
    return {
      issue: "A_CHERCHER",
      raison: "les valeurs diffèrent et rien dans ce qu'on a ne les départage — mais ce qui manque est identifiable",
      quoiChercher: aChercher, candidats: independants,
    };
  }

  return {
    issue: "A_TRANCHER",
    raison: "autorités comparables, fraîcheurs comparables, contextes identiques : le départage n'est pas technique",
    question: `Quelle valeur fait foi ? ${independants.map((c) => `${c.valeur} (${c.source.libelle})`).join(" / ")}`,
    options: independants.map((c) => ({
      valeur: c.valeur, source: c.source.libelle,
      pour: `${c.source.nature}, arrêté le ${c.observeLe.toISOString().slice(0, 10)}, confiance ${c.confiance.toFixed(2)}`,
    })),
  };
}

/** Le verdict, en une phrase — celle qu'Adam dira, et elle porte toujours le POURQUOI. */
export function direVerdict(v: Verdict): string {
  switch (v.issue) {
    case "AUCUN_CONFLIT": return `${v.valeur} — ${v.raison}.`;
    case "PAS_LA_MEME_QUESTION": return `Ces chiffres ne se contredisent pas : ${v.groupes.map((g) => `${g.valeurs.join("/")} pour « ${g.contexte} »`).join(", ")}. ${v.raison}.`;
    case "RESOLUE": return `${v.retenue.valeur} (${v.retenue.source.libelle}) — ${v.raison}. Écartées : ${v.ecartees.map((e) => `${e.valeur} (${e.pourquoi})`).join(" ; ")}.`;
    case "A_CHERCHER": return `Je ne peux pas trancher sans : ${v.quoiChercher.join(" ; ")}. ${v.raison}.`;
    case "A_TRANCHER": return `${v.question} — ${v.raison}.`;
  }
}
