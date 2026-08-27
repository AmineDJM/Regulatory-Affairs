/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COMPRESSION PROGRESSIVE (§92-95) — et ce qu'elle n'a PAS le droit de perdre.
 *
 * ── L'IDÉE ───────────────────────────────────────────────────────────────────────────────
 *
 * Un souvenir récent est riche ; un souvenir vieux d'un mois se résume ; un souvenir de l'an
 * dernier se réduit à des faits. C'est ainsi que fonctionne une mémoire utile, et c'est ce qui
 * permet de se souvenir de trois ans sans payer trois ans de jetons à chaque question.
 *
 * ── CE QUI REND CE FICHIER DÉLICAT ───────────────────────────────────────────────────────
 *
 * Compresser, c'est jeter. Et ce qu'on jette est irrécupérable — le tour brut aura disparu, ou
 * personne n'ira le relire. Un résumé qui perd l'identifiant du marché, le montant de la
 * facture ou la correction que l'utilisateur avait apportée est PIRE qu'aucun résumé : il donne
 * l'illusion du souvenir, et Adam répondra avec assurance sur une base fausse.
 *
 * D'où la liste des invariants, vérifiée MÉCANIQUEMENT après chaque compression. Un compacteur
 * qui perd un identifiant voit sa sortie refusée, et l'épisode reste à sa fidélité précédente.
 * Mieux vaut un souvenir trop lourd qu'un souvenir faux.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const FIDELITES = ["RICH", "STRUCTURED", "FACTS"] as const;
export type Fidelite = (typeof FIDELITES)[number];

/**
 * L'ÂGE À PARTIR DUQUEL ON DESCEND D'UN CRAN.
 *
 * Les seuils sont en jours et volontairement larges : une conversation de la semaine reste
 * lisible telle quelle, celle du mois dernier devient un résumé structuré, et au-delà d'un
 * trimestre il ne reste que les faits. Personne ne se souvient d'une phrase prononcée il y a
 * six mois ; tout le monde se souvient du montant sur lequel on s'était mis d'accord.
 */
export const SEUILS_JOURS: Record<Fidelite, number> = {
  RICH: 0,
  STRUCTURED: 14,
  FACTS: 90,
};

/** LA FIDÉLITÉ NE REMONTE JAMAIS — on ne reconstruit pas un détail qu'on a jeté. */
export function fideliteVisee(ageJours: number, actuelle: Fidelite): Fidelite {
  const visee: Fidelite = ageJours >= SEUILS_JOURS.FACTS ? "FACTS"
    : ageJours >= SEUILS_JOURS.STRUCTURED ? "STRUCTURED" : "RICH";
  const rang = (f: Fidelite) => FIDELITES.indexOf(f);
  return rang(visee) > rang(actuelle) ? visee : actuelle;
}

/** Ce qu'un épisode porte, à toute fidélité. */
export interface Episode {
  summary: string;
  /** « EMPLOYEE:e-42 », « MARCHE:PCH-2026-014 » — les identités, pas les noms seuls. */
  entities: string[];
  decisions: string[];
  commitments: string[];
  openQuestions: string[];
  /** Les corrections apportées par l'utilisateur. Les perdre fait refaire la même erreur. */
  corrections: string[];
}

/**
 * LES INVARIANTS D'UNE COMPRESSION (§94).
 *
 * ── POURQUOI ON VÉRIFIE LES IDENTIFIANTS ET PAS LE SENS ──────────────────────────────────
 *
 * Vérifier que le sens est préservé demanderait un second modèle, donc un second point de
 * défaillance, et le juge serait aussi faillible que le compacteur. Les IDENTIFIANTS, eux, se
 * vérifient par égalité : ils sont là ou ils n'y sont pas. On contrôle donc ce qui est
 * contrôlable, et l'on contrôle STRICTEMENT.
 */
export interface Perte {
  champ: keyof Episode;
  valeur: string;
}

export function pertes(avant: Episode, apres: Episode): Perte[] {
  const out: Perte[] = [];
  const champs: (keyof Episode)[] = ["entities", "decisions", "commitments", "openQuestions", "corrections"];
  for (const champ of champs) {
    const gardes = new Set((apres[champ] as string[]).map((s) => s.trim().toLowerCase()));
    for (const v of avant[champ] as string[]) {
      if (!gardes.has(v.trim().toLowerCase())) out.push({ champ, valeur: v });
    }
  }
  return out;
}

/**
 * LES MOTIFS QU'UN RÉSUMÉ NE DOIT PAS AVOIR PERDUS.
 *
 * Montants, dates, références. Ils sont détectés dans le texte d'origine et cherchés dans le
 * résumé — un résumé qui a perdu « 4 200 000 DZD » ou « PCH-2026-014 » a perdu ce sur quoi
 * porterait la prochaine question.
 */
const MOTIFS_CRITIQUES: { nom: string; re: RegExp }[] = [
  { nom: "montant", re: /\b\d[\d\s.,]{3,}\s*(?:DZD|EUR|USD|€|\$)/gi },
  { nom: "référence", re: /\b[A-Z]{2,}[-/]\d{2,}[-/]?[A-Z0-9]*\b/g },
  { nom: "date", re: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g },
  { nom: "pourcentage", re: /\b\d{1,3}(?:[.,]\d+)?\s?%/g },
];

export function critiquesPerdus(texteOrigine: string, resume: string): { nom: string; valeur: string }[] {
  const out: { nom: string; valeur: string }[] = [];
  const cible = resume.toLowerCase().replace(/\s+/g, " ");
  for (const { nom, re } of MOTIFS_CRITIQUES) {
    for (const m of texteOrigine.matchAll(re)) {
      const v = m[0].trim();
      const normalise = v.toLowerCase().replace(/\s+/g, " ");
      // On cherche la valeur telle quelle ET sans ses espaces : « 4 200 000 » et « 4200000 »
      // sont le même montant, et refuser un résumé pour cette raison serait absurde.
      const sansEspaces = normalise.replace(/\s/g, "");
      if (!cible.includes(normalise) && !cible.replace(/\s/g, "").includes(sansEspaces)) {
        out.push({ nom, valeur: v });
      }
    }
  }
  return out;
}

export interface VerdictCompression {
  acceptable: boolean;
  pertes: Perte[];
  critiques: { nom: string; valeur: string }[];
  raison: string;
}

/**
 * LA COMPRESSION EST-ELLE ACCEPTABLE ?
 *
 * Un seul « non » suffit. Il n'y a pas de compression « à 95 % correcte » : la valeur perdue
 * est précisément celle sur laquelle portera la question à laquelle on ne saura pas répondre.
 */
export function verifier(
  avant: Episode,
  apres: Episode,
  texteOrigine: string,
): VerdictCompression {
  const p = pertes(avant, apres);
  const c = critiquesPerdus(texteOrigine, apres.summary);

  if (p.length === 0 && c.length === 0) {
    return { acceptable: true, pertes: [], critiques: [], raison: "rien de ce qui compte n'a été perdu" };
  }
  return {
    acceptable: false,
    pertes: p,
    critiques: c,
    raison: [
      p.length > 0 ? `${p.length} élément(s) structuré(s) perdu(s) (${p.slice(0, 3).map((x) => x.valeur).join(", ")})` : "",
      c.length > 0 ? `${c.length} valeur(s) critique(s) absente(s) du résumé (${c.slice(0, 3).map((x) => x.valeur).join(", ")})` : "",
    ].filter(Boolean).join(" ; "),
  };
}

/**
 * LE COMPACTEUR — un PORT, et un worker BON MARCHÉ (§95).
 *
 * « Pas Terra-medium pour résumer vingt tours simples. » Résumer est un travail de rédaction,
 * pas de raisonnement : le faire faire au modèle le plus cher revient à payer un architecte
 * pour ranger une bibliothèque. Le rôle demandé est donc `cheap` — et c'est la politique de
 * modèles qui traduit ce rôle, jamais ce fichier (§11).
 */
export interface Compacteur {
  compacter(input: {
    texte: string;
    fidelite: Fidelite;
    /** Ce qui DOIT survivre — passé explicitement, pas espéré. */
    aPreserver: Episode;
  }): Promise<Episode>;
}

/**
 * COMPACTE, PUIS VÉRIFIE, ET REFUSE SI ÇA A PERDU QUELQUE CHOSE.
 *
 * Rend l'épisode d'origine quand la compression est refusée. C'est délibérément conservateur :
 * un épisode qui reste trop lourd coûte des jetons ; un épisode faux coûte une mauvaise
 * décision. Le second prix est sans commune mesure avec le premier.
 */
export async function compacter(
  compacteur: Compacteur,
  avant: Episode,
  texteOrigine: string,
  fidelite: Fidelite,
): Promise<{ episode: Episode; applique: boolean; verdict: VerdictCompression }> {
  let apres: Episode;
  try {
    apres = await compacteur.compacter({ texte: texteOrigine, fidelite, aPreserver: avant });
  } catch (e) {
    return {
      episode: avant,
      applique: false,
      verdict: {
        acceptable: false, pertes: [], critiques: [],
        raison: `le compacteur a échoué (${e instanceof Error ? e.message : "erreur"}) — l'épisode reste tel quel`,
      },
    };
  }

  const verdict = verifier(avant, apres, texteOrigine);
  return verdict.acceptable
    ? { episode: apres, applique: true, verdict }
    : { episode: avant, applique: false, verdict };
}
