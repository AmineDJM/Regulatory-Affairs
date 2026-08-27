import type { CurrentUser } from "@/lib/session";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta, type CapabilityMeta } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE RÉEL — les capacités d'Adam, vues par le Mission Runtime.
 *
 * ── LA SOURCE, ET POURQUOI CELLE-LÀ ─────────────────────────────────────────────────────
 *
 * `assistantToolsFor(user)` est la liste EXACTE des outils ouverts à cette personne : la même
 * que celle envoyée au modèle en conversation, bornée par les mêmes droits, calculée par le
 * même code. En repartir garantit qu'une mission ne peut PAS atteindre ce que la conversation
 * ne pourrait pas atteindre — c'est-à-dire qu'une mission n'est pas une porte dérobée (§48).
 *
 * Écrire une seconde liste « des outils utilisables en mission » aurait été plus simple et
 * strictement faux : deux listes divergent, et celle qui diverge est toujours celle qui gardait.
 *
 * ── CE QUE LE CATALOGUE AJOUTE À LA LISTE ───────────────────────────────────────────────
 *
 * Les MÉTADONNÉES D'EXÉCUTION (effet, idempotence, groupabilité) que la conversation n'a pas
 * besoin de connaître et que le runtime ne peut pas deviner. Elles viennent de
 * `registry/capability-meta.ts`, qui est du côté du runtime — c'est-à-dire consultable par un
 * test sans base ni fournisseur.
 *
 * ── LE COÛT, ET POURQUOI IL EST PAYÉ UNE FOIS ───────────────────────────────────────────
 *
 * `assistantToolsFor` construit cent soixante-cinq définitions. Le catalogue est donc bâti UNE
 * fois par mission et réutilisé pour toute sa durée : le compilateur l'interroge à chaque
 * étape, et il est synchrone précisément pour cela.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La première phrase d'une description d'outil — c'est tout ce que le planner a besoin de lire. */
function resumer(description: string): string {
  const propre = description.replace(/\s+/g, " ").trim();
  const fin = propre.search(/\.\s/);
  const phrase = fin > 0 ? propre.slice(0, fin + 1) : propre;
  return phrase.slice(0, 220);
}

const estEcriture = (n: string): boolean => RESOLVER_WRITE_NAMES.has(n);

export interface CatalogueReel extends CapabilityCatalog {
  /** Le nombre de capacités ouvertes à cette personne — mesuré, pour l'observabilité. */
  readonly taille: number;
}

/**
 * CONSTRUIT LE CATALOGUE D'UNE PERSONNE.
 *
 * L'acteur passé à `allowed()` est comparé à celui du catalogue : un catalogue construit pour
 * quelqu'un ne peut pas servir à autoriser quelqu'un d'autre. Sans ce contrôle, un catalogue
 * mis en cache par erreur autoriserait les droits de la personne précédente — la faute exacte
 * qui produit une élévation de privilège invisible.
 */
export function catalogueDe(user: CurrentUser): CatalogueReel {
  const defs = assistantToolsFor(user);
  const parNom = new Map(defs.map((d) => [d.name, d]));
  const labels = new Map(POWER_TOOLS.map((t) => [t.def.name, t.label]));
  const metas = new Map<string, CapabilityMeta>();

  const meta = (name: string): CapabilityMeta => {
    const cache = metas.get(name);
    if (cache) return cache;
    const m = capabilityMeta(name, estEcriture);
    metas.set(name, m);
    return m;
  };

  const briefs: CapabilityBrief[] = defs.map((d) => {
    const m = meta(d.name);
    return {
      id: d.name,
      domain: m.domain,
      effect: m.effect,
      batchable: m.batchable,
      summary: resumer(labels.get(d.name) ? `${labels.get(d.name)}. ${d.description}` : d.description),
    };
  });

  return {
    taille: defs.length,
    has: (name) => parNom.has(name),
    allowed: (name, actor) => actor.userId === user.id && parNom.has(name),
    meta,
    brief: (actor, opts) => {
      if (actor.userId !== user.id) return [];
      const filtres = opts?.domains && opts.domains.length > 0
        ? briefs.filter((b) => opts.domains!.includes(b.domain))
        : briefs;
      return opts?.limit ? filtres.slice(0, opts.limit) : filtres;
    },
  };
}

/** L'acteur ERP correspondant à une personne — utilisé quand elle agit elle-même. */
export function acteurDe(user: CurrentUser): MissionActor {
  return { userId: user.id, label: user.name, isAgent: false };
}
