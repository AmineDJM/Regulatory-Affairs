/**
 * LE BRIEFING DU MATIN — la part PURE (Adventum Brain, refonte 07/10) : forme du contenu, repli déterministe,
 * lecture STRICTE de la réponse du modèle, consigne. La génération (modèle, persistance, 7 h) est dans
 * `lib/brain-briefing.ts`.
 *
 * Chaque phrase porte ses SOURCES : des clés de risque, jamais un lien écrit par le modèle. L'écran transforme la
 * clé en puce cliquable (module → fiche) à partir de l'instantané des risques gardé avec le briefing. Une clé que
 * le modèle aurait inventée est écartée à la lecture : une source inventée est pire que pas de source.
 */

export interface BriefRisk {
  key: string;
  level: string;
  title: string;
  object: string;
  module: string;
  owner: string;
  ageDays: number | null;
  recommendation: string;
  href: string | null;
  status: string;
}

export interface BriefingSentence { text: string; refs: string[] }
export interface BriefingParagraph { sentences: BriefingSentence[] }
export interface BriefingContent {
  paragraphs: BriefingParagraph[];
  /** Depuis la veille : risques résolus, risques apparus. */
  since: { resolved: number; created: number };
  /** Décisions qui attendent (nouveaux, critiques ou élevés). */
  decisions: number;
}
/** La source d'une puce : ce que l'écran affiche et où elle mène. */
export interface BriefingRef { key: string; module: string; label: string; href: string | null }

const RANG: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const urgents = (risks: readonly BriefRisk[]) => risks.filter((r) => r.status === "NOUVEAU" && (r.level === "critical" || r.level === "high"));
const trier = (risks: readonly BriefRisk[]) => [...risks].sort((a, b) => (RANG[a.level] ?? 9) - (RANG[b.level] ?? 9) || (b.ageDays ?? 0) - (a.ageDays ?? 0));
const depuis = (r: BriefRisk) => (r.ageDays && r.ageDays > 0 ? ` depuis ${r.ageDays} j` : "");
const sansPoint = (s: string) => s.trim().replace(/[.\s]+$/, "");

/** Repli DÉTERMINISTE — quand le modèle est absent, coupé, trop lent ou rend une forme invalide. */
export function briefingDeRegles(risks: readonly BriefRisk[], since: { resolved: number; created: number }): BriefingContent {
  const ouverts = trier(risks.filter((r) => r.status === "NOUVEAU" || r.status === "PRIS_EN_CHARGE"));
  const aDecider = urgents(ouverts);
  const paragraphs: BriefingParagraph[] = [];
  if (ouverts.length === 0) {
    paragraphs.push({ sentences: [{ text: "Aucun risque ouvert ce matin.", refs: [] }] });
    return { paragraphs, since, decisions: 0 };
  }
  const p1: BriefingSentence[] = [];
  if (aDecider.length > 0) {
    p1.push({ text: `${aDecider.length} décision${aDecider.length > 1 ? "s" : ""} vous attend${aDecider.length > 1 ? "ent" : ""}.`, refs: [] });
    for (const r of aDecider.slice(0, 2)) {
      p1.push({ text: `${sansPoint(r.title)} — ${r.object}${depuis(r)} : ${sansPoint(r.recommendation).toLowerCase()}.`, refs: [r.key] });
    }
  } else {
    p1.push({ text: "Aucune décision urgente ce matin.", refs: [] });
  }
  paragraphs.push({ sentences: p1 });

  const reste = ouverts.filter((r) => !aDecider.slice(0, 2).includes(r)).slice(0, 3);
  if (reste.length) {
    paragraphs.push({ sentences: reste.map((r) => ({ text: `${r.module} : ${sansPoint(r.title).toLowerCase()} (${r.object})${depuis(r)}.`, refs: [r.key] })) });
  }
  return { paragraphs, since, decisions: aDecider.length };
}

/** Le schéma JSON STRICT demandé au modèle (sorties structurées). */
export const BRIEFING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["paragraphs"],
  properties: {
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sentences"],
        properties: {
          sentences: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "refs"],
              properties: { text: { type: "string" }, refs: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
    },
  },
};

/**
 * Lit la réponse du modèle. Rend `null` si la forme n'est pas celle demandée (le repli prend alors le relais) ;
 * écarte toute source qui n'est pas un risque connu ; borne la longueur.
 */
export function lireReponseModele(data: unknown, connus: ReadonlySet<string>): BriefingParagraph[] | null {
  if (!data || typeof data !== "object") return null;
  const ps = (data as { paragraphs?: unknown }).paragraphs;
  if (!Array.isArray(ps) || ps.length === 0) return null;
  const out: BriefingParagraph[] = [];
  for (const p of ps.slice(0, 4)) {
    const ss = (p as { sentences?: unknown })?.sentences;
    if (!Array.isArray(ss)) return null;
    const sentences: BriefingSentence[] = [];
    for (const s of ss.slice(0, 6)) {
      const text = typeof (s as { text?: unknown })?.text === "string" ? (s as { text: string }).text.trim() : "";
      if (!text) continue;
      const refs = Array.isArray((s as { refs?: unknown }).refs) ? ((s as { refs: unknown[] }).refs.filter((x): x is string => typeof x === "string" && connus.has(x))) : [];
      sentences.push({ text: text.slice(0, 400), refs: [...new Set(refs)].slice(0, 4) });
    }
    if (sentences.length) out.push({ sentences });
  }
  return out.length ? out : null;
}

/** La consigne : les risques ouverts, avec leurs clés, et la règle des sources. */
export function promptBriefing(risks: readonly BriefRisk[], since: { resolved: number; created: number }, jour: string): { system: string; user: string } {
  const lignes = trier(risks.filter((r) => r.status === "NOUVEAU" || r.status === "PRIS_EN_CHARGE")).slice(0, 30).map((r) =>
    `- clé=${r.key} | niveau=${r.level} | état=${r.status === "NOUVEAU" ? "nouveau" : "pris en charge"} | ${r.module} | ${r.title} : ${r.object}${r.ageDays ? ` | depuis ${r.ageDays} j` : ""} | chez ${r.owner} | geste : ${r.recommendation}`,
  );
  const system = [
    "Tu es l'analyste de direction d'Adventum Pharma (laboratoire pharmaceutique algérien).",
    "Tu écris le briefing du matin du Super Admin, en français, texte simple, sans markdown.",
    "Deux ou trois paragraphes courts. La première phrase dit combien de décisions attendent (risques nouveaux critiques ou élevés).",
    "Chaque phrase factuelle cite dans `refs` la ou les clés des risques dont elle parle — UNIQUEMENT des clés de la liste fournie.",
    "N'invente aucun chiffre, aucun nom, aucun fait absent de la liste. Pas de formule de politesse.",
  ].join("\n");
  const user = `Briefing du ${jour}. Depuis hier : ${since.resolved} risque(s) résolu(s), ${since.created} nouveau(x).\n\nRisques ouverts :\n${lignes.join("\n") || "(aucun)"}`;
  return { system, user };
}

/** Les puces d'un briefing : ses sources, résolues depuis l'instantané des risques gardé avec lui. */
export function refsDe(risks: readonly BriefRisk[]): BriefingRef[] {
  return risks.map((r) => ({ key: r.key, module: r.module, label: r.object, href: r.href }));
}

/** « YYYY-MM-DD » et l'heure, à Alger (UTC+1, sans heure d'été). */
export function jourAlger(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function heureAlger(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Algiers", hour: "2-digit", hour12: false }).format(d)) % 24;
}
/** Le briefing du jour est-il dû ? (7 h passées à Alger, et pas encore écrit.) */
export function briefingDu(now: Date, dernierJour: string | null, heure = 7): boolean {
  return heureAlger(now) >= heure && dernierJour !== jourAlger(now);
}
