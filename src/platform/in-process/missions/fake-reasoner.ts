import type { Reasoner, ReasonRequest, ReasonResult } from "@/lib/missions/ports";
import { resumerEcarts, verifierSchema } from "@/lib/missions/planner/validate";

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
