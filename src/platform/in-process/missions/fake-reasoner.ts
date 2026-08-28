import type { Reasoner, ReasonRequest, ReasonResult } from "@/lib/missions/ports";
import { resumerEcarts, verifierSchema } from "@/lib/missions/planner/validate";
import { VARIANTES_ETAPE } from "@/lib/missions/planner/schema";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN RAISONNEUR SCRIPTÉ — le SEUL substitut d'un banc d'essai de bout en bout, et ce qu'il vaut.
 *
 * ── CE QU'IL REMPLACE, EXACTEMENT ───────────────────────────────────────────────────────
 *
 * La traversée du réseau, et rien d'autre. Le résolveur de capacités, la composition du
 * contexte, le schéma imposé, la RECONSTRUCTION du plan typé, le compilateur, la
 * matérialisation, le moteur, les workers, l'éventail, l'idempotence, le contrôle qualité, le
 * juge, les artefacts et l'approbation tournent tous POUR DE VRAI dans un banc qui l'utilise.
 *
 * ── POURQUOI CE N'EST PAS « UN PLAN ÉCRIT À LA MAIN » ───────────────────────────────────
 *
 * Parce qu'il ne rend pas un `MissionPlan`. Il rend la forme BRUTE que le fournisseur produit —
 * listes de champs typés, `null` explicites, valeurs d'énumérés — que le planificateur doit
 * ensuite reconstruire. Un banc qui injecterait un `MissionPlan` sauterait précisément l'étape
 * où l'on se trompe le plus.
 *
 * ── LA GARANTIE QUI EMPÊCHE CE FICHIER D'ÊTRE UN DÉCOR ─────────────────────────────────
 *
 * Chaque réponse scriptée est VÉRIFIÉE contre le schéma que l'appelant a réellement demandé,
 * avec le MÊME code que le raisonneur de production. Une réponse qu'un fournisseur en mode
 * strict n'aurait pas pu produire fait ÉCHOUER le banc au lieu de le faire passer.
 *
 * C'est ce qui distingue un banc d'essai d'un théâtre : ici, on ne peut pas faire réussir un
 * scénario en écrivant une réponse impossible.
 *
 * ── CE QU'IL NE PROUVE PAS, ET IL FAUT LE DIRE ─────────────────────────────────────────
 *
 * Il ne prouve pas qu'un modèle réel produirait CE plan-là. Cette question-là ne se répond
 * qu'avec une clé de fournisseur, par le smoke test dédié — et tant qu'elle n'a pas de réponse,
 * l'état honnête est « NON PROUVÉ EN LIGNE ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une réponse scriptée : soit un objet, soit un échec délibéré. */
export type ReponseScriptee =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/** La fonction qui décide de la réponse, d'après la demande RÉELLE que le runtime a émise. */
export type Script = (req: ReasonRequest, appel: number) => ReponseScriptee | undefined;

export class RaisonneurScripte implements Reasoner {
  /** Toutes les demandes reçues — le banc y lit ce que le runtime a réellement demandé. */
  readonly demandes: ReasonRequest[] = [];
  private compteurs = new Map<string, number>();

  constructor(private readonly scripts: readonly Script[]) {}

  configured(): boolean {
    return true;
  }

  /** Combien d'appels pour un usage donné — sert à vérifier qu'un éventail appelle N fois. */
  appelsPour(purpose: string): number {
    return this.demandes.filter((d) => d.purpose === purpose).length;
  }

  async reason<T>(req: ReasonRequest): Promise<ReasonResult<T>> {
    this.demandes.push(req);
    const n = (this.compteurs.get(req.purpose) ?? 0) + 1;
    this.compteurs.set(req.purpose, n);

    for (const script of this.scripts) {
      const r = script(req, n);
      if (!r) continue;
      if (!r.ok) return { ok: false, data: null, error: r.error, usage: null, latencyMs: 1 };

      // LA VÉRIFICATION QUI FAIT LA VALEUR DE CE FICHIER. Même code qu'en production.
      const ecarts = verifierSchema(r.data, req.schema);
      if (ecarts.length > 0) {
        throw new Error(
          `réponse scriptée IMPOSSIBLE pour « ${req.purpose} » (schéma ${req.schemaName}) : `
          + `${resumerEcarts(ecarts)}. Un fournisseur en mode strict ne l'aurait jamais produite — `
          + `le banc refuse de valider un scénario sur une réponse irréelle.`,
        );
      }
      return { ok: true, data: r.data as T, usage: { inputTokens: 0, outputTokens: 0, model: "scripté" }, latencyMs: 1 };
    }

    return {
      ok: false,
      data: null,
      error: `aucun script ne répond à « ${req.purpose} » — le banc ne prétend pas savoir répondre`,
      usage: null,
      latencyMs: 1,
    };
  }
}

/** Un script qui ne répond qu'à un usage donné. */
export const pour = (purpose: string, f: (req: ReasonRequest, n: number) => ReponseScriptee): Script =>
  (req, n) => (req.purpose === purpose ? f(req, n) : undefined);

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN PLAN SCRIPTÉ, MIS À LA FORME EXACTE DE SA VARIANTE.
 *
 * ── POURQUOI CE HELPER EXISTE ────────────────────────────────────────────────────────────
 *
 * Le schéma d'étape est passé d'une forme unique à vingt-et-un champs à sept variantes
 * discriminées par `nodeType` : une CAPABILITY ne porte plus les cinq champs d'attente, une
 * JOIN ne porte que le tronc commun. Le mode strict INTERDISANT les champs en trop, un plan de
 * banc écrit à l'ancienne devient une réponse qu'aucun fournisseur ne produirait — et
 * `verifierSchema` le refuse, à raison.
 *
 * Réécrire trente objets d'étape à la main aurait marché une fois, puis aurait dérivé au premier
 * champ ajouté. Ce helper prend la description NATURELLE d'une étape — tout ce qu'on veut dire —
 * et n'en garde que ce que sa variante autorise. Les bancs disent l'intention ; la forme suit.
 *
 * Il ne rend pas les tests plus permissifs : ce qu'il produit passe par le MÊME
 * `verifierSchema` que la production, et un champ manquant tombe toujours.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'une variante accepte, dérivé du schéma lui-même — jamais d'une liste recopiée. */
function champsDe(nodeType: string): Set<string> {
  for (const v of Object.values(VARIANTES_ETAPE)) {
    const props = (v.properties ?? {}) as Record<string, Record<string, unknown>>;
    const types = (props.nodeType?.enum ?? []) as string[];
    if (types.includes(nodeType)) return new Set(Object.keys(props));
  }
  return new Set<string>();
}

/** Les valeurs par défaut d'un champ, quand le banc ne l'a pas dit et que la variante l'exige. */
const DEFAUTS: Record<string, unknown> = {
  workstream: null, dependsOn: [], inputs: [], forEach: null, outputFields: [],
  approvalRequirement: "NONE", reasoningRequirement: "NONE", maxAttempts: null,
  waitFrom: null, waitEntity: null, waitWithinDays: null,
};

type EtapeLibre = Record<string, unknown>;

/**
 * NORMALISE UN PLAN SCRIPTÉ. Chaque étape est ramenée à sa variante, champ par champ.
 *
 * L'éventail accepte les deux écritures — l'objet `forEach` et les trois anciennes chaînes —
 * pour qu'un banc écrit avant le découpage reste lisible sans être réécrit ligne à ligne.
 */
export function planScripte<T extends { steps?: unknown[] }>(plan: T): T {
  const etapes = ((plan.steps ?? []) as EtapeLibre[]);
  return {
    ...plan,
    steps: etapes.map((brute) => {
      const nodeType = String(brute.nodeType ?? "CAPABILITY");
      const permis = champsDe(nodeType);
      const source: EtapeLibre = { ...brute };

      // Les trois anciennes chaînes deviennent l'objet — ou `null` si elles étaient vides.
      if (permis.has("forEach") && source.forEach === undefined) {
        source.forEach = source.forEachFrom && source.forEachPath && source.forEachAs
          ? { from: source.forEachFrom, path: source.forEachPath, as: source.forEachAs }
          : null;
      }

      const sortie: EtapeLibre = {};
      for (const champ of permis) {
        sortie[champ] = source[champ] !== undefined
          ? source[champ]
          : (champ in DEFAUTS ? DEFAUTS[champ] : null);
      }
      return sortie;
    }),
  };
}
