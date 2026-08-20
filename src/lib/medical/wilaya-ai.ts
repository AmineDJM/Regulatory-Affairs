import { askClaudeCheap, aiConfigured } from "@/lib/ai";
import { acceptAiWilaya } from "./wilaya";
import { ALGERIA_WILAYAS } from "@/lib/labels";

/**
 * L'IA EN RENFORT SUR LA WILAYA — pour ce que la reconnaissance ne peut pas savoir.
 *
 * La reconnaissance déterministe (`wilaya.ts`) résout tout ce qui est ÉCRIT : un nom de wilaya,
 * un code postal, un numéro. Ce qu'elle ne peut pas faire, c'est de la géographie : « Rouiba »,
 * « Bab Ezzouar », « El Harrach » sont des communes d'Alger, mais rien dans leur nom ne le dit.
 * C'est exactement le travail d'un modèle — et c'est le SEUL travail qu'on lui confie ici.
 *
 * Trois garde-fous, parce qu'on remplit un champ à LISTE FERMÉE :
 *
 *   • un SEUL appel pour tout l'import, pas un par ligne — 400 appels coûteraient cher, seraient
 *     lents, et échoueraient à mi-parcours en laissant l'annuaire à moitié rempli ;
 *   • chaque réponse est REVALIDÉE contre les 58 wilayas (`acceptAiWilaya`) : une hallucination
 *     ne doit jamais entrer dans un champ dont la liste fermée existe précisément pour que le
 *     comptage par territoire reste juste ;
 *   • un échec ne casse RIEN : les fiches concernées restent sans wilaya, ce qui se voit et se
 *     corrige à la main — au contraire d'une wilaya fausse, que personne ne revérifiera.
 */

/** Au-delà, on n'envoie pas : un import massif ne doit pas se transformer en facture d'IA. */
const MAX_HINTS = 300;

/**
 * Résout des wilayas depuis des indices libres (commune, adresse, établissement).
 *
 * Rend une correspondance indice → wilaya. Les indices que le modèle ne tranche pas — ou qu'il
 * tranche mal — sont simplement absents : l'appelant laisse alors la fiche sans wilaya.
 */
export async function inferWilayas(hints: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(hints.map((h) => h.trim()).filter(Boolean))].slice(0, MAX_HINTS);
  if (unique.length === 0 || !aiConfigured()) return out;

  const prompt = [
    "Tu rattaches des lieux algériens à leur WILAYA (découpage administratif à 58 wilayas).",
    "",
    "Pour chaque ligne numérotée ci-dessous, réponds par la wilaya correspondante.",
    "Réponds UNIQUEMENT par des lignes « numéro = wilaya », sans phrase, sans explication.",
    "Si tu n'es pas certain, écris « numéro = ? » — une wilaya fausse est pire qu'une absence.",
    "",
    `Wilayas autorisées (aucune autre réponse n'est acceptée) : ${ALGERIA_WILAYAS.join(", ")}.`,
    "",
    ...unique.map((h, i) => `${i + 1}. ${h}`),
  ].join("\n");

  try {
    const res = await askClaudeCheap(prompt, { maxTokens: 2000 });
    for (const line of (res.text ?? "").split("\n")) {
      const m = line.match(/^\s*(\d+)\s*[=:.\-]\s*(.+?)\s*$/);
      if (!m) continue;
      const idx = Number(m[1]) - 1;
      const hint = unique[idx];
      const wilaya = acceptAiWilaya(m[2]);
      if (hint && wilaya) out.set(hint, wilaya);
    }
  } catch {
    // Sans IA (clé absente, quota, panne), l'import se termine normalement : les fiches restent
    // sans wilaya, et cela se voit à l'écran.
  }
  return out;
}
