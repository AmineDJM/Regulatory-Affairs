/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DÉCOUPER UN OBJECTIF DURABLE EN JALONS — l'appel qui rend une mission longue possible.
 *
 * ── CE QU'ON DEMANDE AU MODÈLE, ET CE QU'ON NE LUI DEMANDE PAS ──────────────────────────
 *
 * On lui demande des INTENTIONS : « collecter les prix de cession auprès des trois responsables
 * produit », et le résultat qu'on doit pouvoir constater — « les trois prix sont connus, avec
 * leur auteur et leur date ». On ne lui demande AUCUNE étape, AUCUNE capacité, AUCUN payload :
 * ça, c'est le travail du planificateur de sous-plan, appelé jalon par jalon, quand le
 * précédent a réellement produit ses résultats.
 *
 * C'est toute la différence. Un plan monolithique de mission longue écrit l'étape 200 en
 * ignorant ce que l'étape 40 aura trouvé : il invente ses références. Un découpage en jalons
 * n'invente rien — il dit ce qu'on cherche à obtenir, dans quel ordre, et il laisse le COMMENT
 * à un modèle qui, le moment venu, aura les faits sous les yeux.
 *
 * ── LE COÛT, ET POURQUOI IL EST DÉRISOIRE ───────────────────────────────────────────────
 *
 * Un découpage tient en quelques centaines de jetons de sortie : sept lignes de titre et de
 * résultat. C'est l'appel le moins cher de tout le runtime, et c'est lui qui décide si la
 * mission est exécutable ou si elle mourra d'un plan trop gros pour être juste.
 *
 * ── LE REFUS ────────────────────────────────────────────────────────────────────────────
 *
 * Un découpage est une PROPOSITION FAILLIBLE, comme un plan (§118). `incoherences()` le refuse
 * sur un cycle, une dépendance morte, un rang en double ou un résultat non constatable — et il
 * dit TOUT ce qu'il sait en une fois (§118.18), jamais une objection par tour.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { Reasoner, Situation } from "@/lib/missions/ports";
import type { JalonPropose } from "@/lib/missions/horizon/store";
import { incoherences, type IncoherenceJalon, type Jalon } from "@/lib/missions/horizon/jalon";

/**
 * COMBIEN DE JALONS AU MAXIMUM — une borne OPÉRATIONNELLE, pas d'architecture (§118.2).
 *
 * Elle ne borne pas la taille de la mission : chaque jalon porte lui-même autant d'étapes qu'il
 * faut, et un jalon peut engendrer une sous-mission. Elle borne la LARGEUR du découpage, parce
 * qu'au-delà d'une vingtaine d'intentions, ce que le modèle rend n'est plus un découpage mais
 * une liste d'étapes déguisée — c'est-à-dire exactement le plan monolithique qu'on évite.
 */
export const JALONS_MAX = 20;

export const SCHEMA_JALONS_NAME = "mission_milestones";

export const SCHEMA_JALONS: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["jalons", "raisonnement"],
  properties: {
    raisonnement: {
      type: "string",
      description:
        "En deux phrases : pourquoi ce découpage-là, et ce qui, dans la demande, impose cet ordre. "
        + "Sert à l'audit et au journal ; n'est jamais exécuté.",
    },
    jalons: {
      type: "array",
      minItems: 1,
      maxItems: JALONS_MAX,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ordre", "titre", "resultat", "dependsOn"],
        properties: {
          ordre: {
            type: "integer",
            minimum: 1,
            description: "Le rang, 1-indexé. Chaque jalon a un rang unique.",
          },
          titre: {
            type: "string",
            description: "Ce qu'on cherche à obtenir, en une ligne. Pas une étape, pas une capacité.",
          },
          resultat: {
            type: "string",
            description:
              "CE QU'ON DOIT POUVOIR CONSTATER quand ce jalon est atteint — un fait vérifiable, "
              + "pas « les étapes ont tourné ». Exemple : « les trois prix de cession sont connus, "
              + "chacun avec son auteur et sa date ». C'est ce texte que le contrôle de fin compare au réel.",
          },
          dependsOn: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            description:
              "Les RANGS des jalons qui doivent être atteints avant celui-ci. Vide quand il peut "
              + "partir tout de suite. Deux jalons indépendants avec dependsOn vides avanceront EN "
              + "PARALLÈLE : ne mettez une dépendance que lorsqu'elle existe vraiment.",
          },
        },
      },
    },
  },
};

const CONSIGNE = [
  "Tu découpes un objectif durable en JALONS. Un jalon est une INTENTION : ce qu'on cherche à",
  "obtenir, et ce qu'on doit pouvoir constater quand c'est obtenu.",
  "",
  "RÈGLES ABSOLUES :",
  "1. Tu n'écris AUCUNE étape, AUCUNE capacité, AUCUN destinataire, AUCUN paramètre. Un autre",
  "   planificateur écrira les étapes de chaque jalon, au moment où ce jalon démarre, avec les",
  "   résultats des jalons précédents sous les yeux. Écrire les étapes ici reviendrait à les",
  "   inventer sur des données qui n'existent pas encore.",
  "2. `resultat` est un FAIT VÉRIFIABLE. « Les trois prix de cession sont connus, avec leur",
  "   auteur et leur date » est un résultat. « Collecter les prix » n'en est pas un : c'est une",
  "   activité, et une activité qui a tourné ne prouve rien.",
  "3. Une dépendance se met UNIQUEMENT quand le jalon a réellement besoin du résultat de l'autre.",
  "   Deux collectes auprès de personnes différentes sont INDÉPENDANTES : les enchaîner",
  "   transformerait deux attentes parallèles en deux attentes successives.",
  "4. Le nombre de jalons suit la demande, pas une esthétique. Une demande simple en a un ou deux.",
  "   Une mission de plusieurs semaines en a cinq à douze. Découper plus fin ne rend pas la",
  "   mission plus sûre — cela la rend plus longue à conduire.",
  "5. Le DERNIER jalon porte ce que la personne recevra vraiment (le livrable, l'envoi, la",
  "   décision). Une mission dont le dernier jalon est « analyser » n'a rien rendu.",
].join("\n");

export interface ContexteJalons {
  aujourdhui?: string;
  /** La situation établie par l'enquête — le découpage s'appuie sur des faits, pas sur un nom. */
  situation?: Situation;
  /** Les contraintes que la personne vient d'énoncer. */
  contraintes?: readonly string[];
  /** Les règles de la maison qui s'appliquent (Teach Adam). */
  politiques?: readonly string[];
  /** Pour un RE-découpage : ce qui a été refusé la fois précédente. */
  refusPrecedent?: readonly string[];
}

export type ResultatDecoupage =
  | { ok: true; jalons: JalonPropose[]; raisonnement: string; usage: unknown; latencyMs: number }
  | { ok: false; error: string; refus?: IncoherenceJalon[]; usage: unknown; latencyMs: number };

/**
 * DEMANDE UN DÉCOUPAGE, ET LE REFUSE S'IL NE TIENT PAS DEBOUT.
 *
 * Un seul aller-retour de correction : le refus est renvoyé au modèle avec ce qu'il doit
 * réparer. Au-delà, ce n'est plus le découpage qui est en cause, et payer un troisième appel
 * pour la même réponse est une dépense sans contrepartie.
 */
export async function decouperEnJalons(
  objectif: string,
  reasoner: Reasoner,
  opts: { role?: string; contexte?: ContexteJalons } = {},
): Promise<ResultatDecoupage> {
  const debut = Date.now();
  if (!reasoner.configured()) {
    return {
      ok: false,
      error: "Aucun fournisseur de modèle n'est configuré : le découpage en jalons ne peut pas être demandé.",
      usage: null,
      latencyMs: Date.now() - debut,
    };
  }

  const role = opts.role ?? "COMPLEX_PLANNER";
  let refus: IncoherenceJalon[] = [];
  let usage: unknown = null;

  for (let essai = 0; essai < 2; essai++) {
    const res = await reasoner.reason<{ raisonnement: string; jalons: JalonPropose[] }>({
      role,
      schemaName: SCHEMA_JALONS_NAME,
      schema: SCHEMA_JALONS,
      system: CONSIGNE,
      prompt: composerPrompt(objectif, opts.contexte ?? {}, refus),
      purpose: "mission.decoupage_jalons",
      maxOutputTokens: 2_000,
    });
    usage = res.usage;
    if (!res.ok || !res.data) {
      return {
        ok: false,
        error: res.error ?? "Le modèle n'a rendu aucun découpage.",
        usage,
        latencyMs: Date.now() - debut,
      };
    }

    const jalons = normaliser(res.data.jalons ?? []);
    const problemes = incoherences(jalons.map(enJalon));
    if (problemes.length === 0) {
      return {
        ok: true,
        jalons,
        raisonnement: String(res.data.raisonnement ?? "").slice(0, 600),
        usage,
        latencyMs: Date.now() - debut,
      };
    }
    refus = problemes;
  }

  return {
    ok: false,
    error: `Le découpage reste incohérent après correction : ${refus.map((r) => r.message).join(" ; ")}`,
    refus,
    usage,
    latencyMs: Date.now() - debut,
  };
}

/**
 * CE QU'ON NORMALISE AVANT DE JUGER.
 *
 * Un modèle rend parfois des rangs non contigus (1, 2, 5) ou des dépendances en double. Ni l'un
 * ni l'autre n'est une FAUTE — le graphe reste juste — et refuser là-dessus ferait payer un
 * aller-retour pour une question de présentation. On renumérote donc en gardant l'ORDRE relatif,
 * et on reporte les dépendances sur les nouveaux rangs. Ce qui reste faux après ça est
 * réellement faux : un cycle, un rang qui ne désigne rien, un résultat absent.
 */
function normaliser(bruts: readonly JalonPropose[]): JalonPropose[] {
  const tries = [...bruts].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const nouveau = new Map<number, number>();
  tries.forEach((j, i) => {
    if (!nouveau.has(j.ordre)) nouveau.set(j.ordre, i + 1);
  });
  return tries.map((j, i) => ({
    ordre: i + 1,
    titre: String(j.titre ?? "").trim().slice(0, 200),
    resultat: String(j.resultat ?? "").trim().slice(0, 600),
    dependsOn: [...new Set(
      (j.dependsOn ?? [])
        .map((d) => nouveau.get(d) ?? d)
        // UNE DÉPENDANCE VERS L'AVAL EST UN CYCLE DÉGUISÉ, et le modèle en écrit quand il
        // confond « ce jalon prépare le suivant » avec « ce jalon dépend du suivant ». On la
        // laisse : `incoherences` la verra et la NOMMERA. La corriger en silence apprendrait
        // au modèle qu'il peut écrire n'importe quoi.
        .filter((d) => Number.isInteger(d) && d >= 1),
    )].sort((a, b) => a - b),
  }));
}

const enJalon = (j: JalonPropose): Jalon => ({
  ordre: j.ordre, titre: j.titre, resultat: j.resultat,
  statut: "PENDING", planVersion: 0, dependsOn: j.dependsOn,
});

function composerPrompt(objectif: string, ctx: ContexteJalons, refus: readonly IncoherenceJalon[]): string {
  const bouts: string[] = [];
  if (ctx.aujourdhui) bouts.push(`Nous sommes le ${ctx.aujourdhui}.`);
  bouts.push(`OBJECTIF DURABLE (mot pour mot) :\n${objectif}`);

  if (ctx.situation && ctx.situation.faits.length > 0) {
    bouts.push(
      "CE QUE LE CODE A DÉJÀ ÉTABLI (faits vérifiés, avec leur provenance) — ne le redemande à personne :\n"
      + ctx.situation.faits.slice(0, 20).map((f) => `• ${f.texte}`).join("\n"),
    );
  }
  if (ctx.situation && ctx.situation.entites.length > 0) {
    bouts.push(
      "ENTITÉS RECONNUES : "
      + ctx.situation.entites.slice(0, 12).map((e) => `${e.type}:${e.label}`).join(", "),
    );
  }
  if (ctx.contraintes && ctx.contraintes.length > 0) {
    bouts.push(`CONTRAINTES ÉNONCÉES :\n${ctx.contraintes.map((c) => `• ${c}`).join("\n")}`);
  }
  if (ctx.politiques && ctx.politiques.length > 0) {
    bouts.push(`RÈGLES DE LA MAISON :\n${ctx.politiques.slice(0, 10).map((p) => `• ${p}`).join("\n")}`);
  }
  if (refus.length > 0) {
    bouts.push(
      "TON DÉCOUPAGE PRÉCÉDENT A ÉTÉ REFUSÉ. Répare EXACTEMENT ceci, et rien d'autre :\n"
      + refus.map((r) => `• [${r.code}] ${r.message}`).join("\n"),
    );
  }
  if (ctx.refusPrecedent && ctx.refusPrecedent.length > 0) {
    bouts.push(`À SAVOIR :\n${ctx.refusPrecedent.map((r) => `• ${r}`).join("\n")}`);
  }
  return bouts.join("\n\n");
}
