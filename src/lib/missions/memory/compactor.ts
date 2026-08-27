import type { Reasoner } from "@/lib/missions/ports";
import type { Compacteur, Episode, Fidelite } from "@/lib/missions/memory/compact";
import { ROLE_COMPACTION } from "@/lib/missions/model/roles";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE COMPACTEUR RÉEL (§23-26) — le contexte se COMPOSE, il ne s'accumule pas.
 *
 * ── LE DÉFAUT QU'IL CORRIGE, DIT SIMPLEMENT ─────────────────────────────────────────────
 *
 * La façon naïve de garder la mémoire d'une conversation est de renvoyer tous les tours. Le
 * coût croît alors LINÉAIREMENT avec le nombre d'échanges : au centième tour, on paie cent fois
 * le premier pour redire ce qui tenait en trois phrases. Et l'on paie ce prix pour un contexte
 * de plus en plus dilué — le fait important du tour 12 est noyé sous quatre-vingt-huit
 * politesses.
 *
 * ── CE QUI EST PRÉSERVÉ, ET POURQUOI CETTE LISTE-LÀ ─────────────────────────────────────
 *
 * Identifiants, décisions, corrections, dates, montants, engagements, contraintes, questions en
 * suspens. Chacun a une raison opérationnelle : oublier une CORRECTION fait refaire l'erreur
 * qu'on venait de corriger ; oublier un MONTANT fait redemander ce qu'on savait ; oublier une
 * QUESTION EN SUSPENS fait conclure une mission qui ne l'est pas.
 *
 * Ce qui disparaît : la répétition, les formules de politesse, les reformulations, le détail
 * d'une recherche dont seul le résultat compte.
 *
 * ── LE CONTRÔLE VIT AILLEURS, ET C'EST VOULU ────────────────────────────────────────────
 *
 * Ce fichier ne vérifie RIEN. `compact.ts` compare l'avant et l'après et REFUSE la compression
 * qui a perdu un identifiant ou un montant — c'est du code déterministe, appliqué au résultat de
 * ce compacteur-ci. Un compacteur qui se contrôlerait lui-même serait juge et partie.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const SCHEMA_EPISODE: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "Le résumé. Il doit contenir MOT POUR MOT tous les montants, dates, références et pourcentages "
        + "de la liste « à préserver ». Pas de politesse, pas de reformulation, pas de méta-commentaire.",
    },
    entities: {
      type: "array",
      items: { type: "string" },
      description: "Les identités canoniques citées, sous la forme TYPE:id (« EMPLOYEE:e-42 »). Recopie CELLES de la liste à préserver, sans en retirer.",
    },
    decisions: { type: "array", items: { type: "string" }, description: "Ce qui a été DÉCIDÉ. Recopie toutes celles de la liste à préserver." },
    commitments: { type: "array", items: { type: "string" }, description: "Qui doit faire quoi, et pour quand." },
    openQuestions: { type: "array", items: { type: "string" }, description: "Ce qui reste en suspens." },
    corrections: { type: "array", items: { type: "string" }, description: "Ce que la personne a corrigé. NE JAMAIS en omettre une." },
  },
  required: ["summary", "entities", "decisions", "commitments", "openQuestions", "corrections"],
  additionalProperties: false,
};

const CONSIGNES: Record<Fidelite, string> = {
  RICH:
    "Fidélité RICHE : garde le déroulé et le ton, retire seulement les répétitions et les politesses. "
    + "Vise environ la moitié du texte d'origine.",
  STRUCTURED:
    "Fidélité STRUCTURÉE : ne garde que ce qui s'est passé et ce qui a été décidé, en phrases courtes. "
    + "Le déroulé disparaît, les faits restent. Vise environ un quart du texte d'origine.",
  FACTS:
    "Fidélité FAITS : uniquement les faits durs — montants, dates, références, identités, décisions, "
    + "corrections. Pas de narration du tout. Quelques lignes suffisent.",
};

const CONSIGNE =
  "Tu compresses la mémoire d'une conversation professionnelle (ERP pharmaceutique algérien, devise DZD).\n\n"
  + "RÈGLE ABSOLUE : tout ce qui figure dans « À PRÉSERVER » doit se retrouver dans ta réponse, à l'identique.\n"
  + "Un montant, une date, une référence ou une identité qui disparaît fait échouer la compression, et l'épisode "
  + "d'origine est conservé tel quel — tu n'auras donc rien gagné.\n\n"
  + "Tu ne résumes pas pour faire joli : tu retires la répétition, la politesse et la reformulation. "
  + "Tu ne retires JAMAIS un chiffre, une décision ou une correction.\n"
  + "Écris en français.";

/**
 * LE COMPACTEUR BRANCHÉ EN PRODUCTION.
 *
 * Il lève plutôt que de rendre un épisode dégradé quand il ne peut pas travailler : `compacter`
 * (dans `compact.ts`) attrape et rend l'épisode d'origine. Deux comportements différents pour
 * deux situations différentes — « je n'ai pas pu » n'est pas « voici une version allégée ».
 */
export class CompacteurReel implements Compacteur {
  constructor(private readonly reasoner: Reasoner) {}

  async compacter(input: { texte: string; fidelite: Fidelite; aPreserver: Episode }): Promise<Episode> {
    if (!this.reasoner.configured()) {
      throw new Error("aucun fournisseur de modèle n'est configuré : la mémoire n'est pas compactée");
    }

    const preserver = [
      input.aPreserver.entities.length > 0 ? `Identités : ${input.aPreserver.entities.join(" ; ")}` : "",
      input.aPreserver.decisions.length > 0 ? `Décisions : ${input.aPreserver.decisions.join(" ; ")}` : "",
      input.aPreserver.corrections.length > 0 ? `Corrections : ${input.aPreserver.corrections.join(" ; ")}` : "",
      input.aPreserver.commitments.length > 0 ? `Engagements : ${input.aPreserver.commitments.join(" ; ")}` : "",
      input.aPreserver.openQuestions.length > 0 ? `En suspens : ${input.aPreserver.openQuestions.join(" ; ")}` : "",
      valeursCritiques(input.texte).length > 0
        ? `Valeurs à recopier mot pour mot : ${valeursCritiques(input.texte).join(" ; ")}`
        : "",
    ].filter(Boolean).join("\n");

    const res = await this.reasoner.reason<Episode>({
      role: ROLE_COMPACTION,
      schemaName: "episode_compacte",
      schema: SCHEMA_EPISODE,
      system: `${CONSIGNE}\n\n${CONSIGNES[input.fidelite]}`,
      prompt:
        (preserver ? `À PRÉSERVER (obligatoire) :\n${preserver}\n\n` : "")
        + `TEXTE À COMPRESSER :\n${input.texte.slice(0, 60_000)}`,
      maxOutputTokens: 3000,
      purpose: "mission.memory.compact",
    });

    if (!res.ok || !res.data) {
      throw new Error(res.error ?? "le compacteur n'a rien rendu de conforme");
    }

    // ON NE FAIT PAS CONFIANCE À LA COMPLÉTUDE DE LA RÉPONSE : les listes structurées de
    // l'épisode d'origine sont RÉUNIES à celles rendues. Le modèle peut enrichir, il ne peut
    // pas retirer. Cela évite un aller-retour complet à cause d'une décision oubliée — et le
    // contrôle de `compact.ts` reste en place pour ce qui se joue dans le RÉSUMÉ.
    return {
      summary: String(res.data.summary ?? ""),
      entities: reunir(input.aPreserver.entities, res.data.entities),
      decisions: reunir(input.aPreserver.decisions, res.data.decisions),
      commitments: reunir(input.aPreserver.commitments, res.data.commitments),
      openQuestions: reunir(input.aPreserver.openQuestions, res.data.openQuestions),
      corrections: reunir(input.aPreserver.corrections, res.data.corrections),
    };
  }
}

const reunir = (avant: readonly string[], apres: unknown): string[] => {
  const rendus = Array.isArray(apres) ? apres.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  return [...new Set([...avant, ...rendus])];
};

/**
 * LES VALEURS QU'UN RÉSUMÉ N'A PAS LE DROIT DE PERDRE — montants, dates, références, taux.
 *
 * Le même repérage que `MOTIFS_CRITIQUES` dans `compact.ts`, mais utilisé ici pour AIDER le
 * modèle plutôt que pour le juger. Les deux listes doivent rester cohérentes : si celle-ci était
 * plus pauvre, le contrôle refuserait des compressions qu'on n'a pas su demander correctement.
 */
export function valeursCritiques(texte: string, limite = 40): string[] {
  const out = new Set<string>();
  const motifs = [
    /\b\d[\d  ]{2,}(?:[.,]\d+)?\s*(?:DZD|EUR|USD|€|\$)/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b[A-Z]{2,}-\d{4}-\d{2,}\b/g,
    /\b\d+(?:[.,]\d+)?\s*%/g,
  ];
  for (const m of motifs) {
    for (const t of texte.matchAll(m)) {
      out.add(t[0].trim());
      if (out.size >= limite) return [...out];
    }
  }
  return [...out];
}
