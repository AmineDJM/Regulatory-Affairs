import { prisma } from "@/lib/prisma";
import type { RegCaseOutcome } from "@prisma/client";
import { OUTCOME_LABELS } from "./labels";

export { OUTCOME_LABELS } from "./labels";

/**
 * L'EXPÉRIENCE INTERNE QUI S'APPLIQUE À UNE SECTION CTD — le « vécu maison » injecté dans
 * l'analyse à côté des textes opposables.
 *
 * Un texte réglementaire dit ce qui DEVRAIT être ; une étude de cas dit ce que l'ANPP a
 * RÉELLEMENT accepté ou reproché sur NOS produits. Les deux ensemble font l'évaluateur
 * expérimenté : la règle, ET la jurisprudence locale.
 *
 * Mêmes choix d'architecture que `corpusForSection`, pour les mêmes raisons :
 *   • recherche par SECTION (pas par le texte de la part) → une requête par document analysé,
 *     empreinte de cache STABLE — un document inchangé n'est jamais repayé ;
 *   • ne lève jamais : zéro étude de cas → liste vide, l'analyse continue à l'identique.
 *
 * Le RANG est une décision métier, testée à part (`rankCaseDocs`) : les issues qui portent une
 * LEÇON (accepté avec réserves, rejeté) passent devant — c'est là que l'agence a parlé.
 */

export interface CaseExtract {
  label: string;
  snippet: string;
}

/** Poids d'apprentissage d'une issue : là où l'agence a reproché, il y a une leçon. */
const OUTCOME_WEIGHT: Record<RegCaseOutcome, number> = {
  ACCEPTED_WITH_RESERVES: 3,
  REJECTED: 3,
  ACCEPTED: 2,
  UNKNOWN: 1,
};

export interface RankableCaseDoc {
  ctdSection: string | null;
  sections: string[];
  outcome: RegCaseOutcome;
  hasLesson: boolean;
  createdAt: Date;
}

/**
 * Ordonne des documents d'études de cas pour une section donnée. PUR — testé.
 * Priorités, dans l'ordre : correspondance de section exacte > par préfixe > via sections
 * détectées ; puis issue instructive ; puis leçon renseignée ; puis récence.
 */
export function rankCaseDocs<T extends RankableCaseDoc>(docs: T[], ctdSection: string | null): T[] {
  const sec = (ctdSection ?? "").trim();
  const matchScore = (d: RankableCaseDoc): number => {
    if (!sec) return 1;
    if (d.ctdSection === sec) return 4;
    if (d.ctdSection && (sec.startsWith(d.ctdSection) || d.ctdSection.startsWith(sec))) return 3;
    if (d.sections.some((x) => x === sec || sec.startsWith(x) || x.startsWith(sec))) return 2;
    return 0;
  };
  return docs
    .map((d) => ({ d, score: matchScore(d) }))
    .filter((x) => x.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      OUTCOME_WEIGHT[b.d.outcome] - OUTCOME_WEIGHT[a.d.outcome] ||
      Number(b.d.hasLesson) - Number(a.d.hasLesson) ||
      b.d.createdAt.getTime() - a.d.createdAt.getTime())
    .map((x) => x.d);
}

/** Les précédents internes applicables à une section — pour l'injection dans le prompt. */
export async function experienceForSection(ctdSection: string | null, limit = 3): Promise<CaseExtract[]> {
  try {
    const docs = await prisma.regulatoryCaseDoc.findMany({
      select: {
        filename: true, ctdSection: true, sections: true, text: true, sha256: true, createdAt: true,
        case: { select: { title: true, outcome: true, lesson: true } },
      },
      take: 400, // les études de cas se comptent en dizaines ; le tri fin se fait en mémoire
      orderBy: { createdAt: "desc" },
    });
    if (docs.length === 0) return [];

    // Dédoublonnage par EMPREINTE avant la coupe : la même pièce présente dans deux études de
    // cas n'apprend rien deux fois — et gaspillerait un des rares emplacements du prompt.
    const seen = new Set<string>();
    const ranked = rankCaseDocs(
      docs.map((d) => ({ ...d, outcome: d.case.outcome, hasLesson: Boolean(d.case.lesson?.trim()) })),
      ctdSection,
    ).filter((d) => (seen.has(d.sha256) ? false : (seen.add(d.sha256), true)))
      .slice(0, limit);

    return ranked.map((d) => ({
      label: `« ${d.case.title} » — issue réelle : ${OUTCOME_LABELS[d.case.outcome]}${d.case.lesson ? ` — leçon retenue : ${d.case.lesson.slice(0, 240)}` : ""} (pièce : ${d.filename})`,
      snippet: d.text.replace(/\s+/g, " ").trim().slice(0, 600),
    }));
  } catch (e) {
    console.error("[training] expérience par section indisponible (analyse poursuivie sans précédents)", e);
    return [];
  }
}
