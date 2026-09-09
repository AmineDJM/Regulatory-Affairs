import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { canReadEntity, type EntityDef } from "@/lib/api/registry/entities";
import { porteeEntite } from "@/lib/api/registry/portee";
import { entiteDuModele } from "./modele-entite";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APRÈS AVOIR ÉCRIT, ON RELIT — « c'est fait » n'est pas une preuve.
 *
 * Le chemin générique concluait `{ ok: true, message: "setRegulatoryPriority exécutée." }`. La
 * personne n'avait qu'une PAROLE : rien à l'écran ne lui permettait de constater ce qui avait
 * changé. C'est très exactement ce que §104.16 interdit — « c'est fait » redevient une parole
 * à croire, ce qu'aucun écran de ce produit n'a le droit de demander — et le retour de
 * l'action, qui portait souvent l'identifiant écrit, était JETÉ.
 *
 * ── CE QUE CE MODULE FAIT, ET SOUS QUELS DROITS ──────────────────────────────────────────
 *
 * Il relit la ligne TOUCHÉE, par le MÊME chemin que l'écran : `porteeEntite` compose la portée
 * par ligne du module et le cloisonnement par entité. Relire avec un accès privilégié
 * montrerait à la personne une ligne qu'elle n'a pas le droit de voir — un contournement de
 * permission introduit par un geste de vérification, c'est-à-dire le pire endroit possible.
 *
 * ── CE QU'IL NE FAIT JAMAIS ──────────────────────────────────────────────────────────────
 *
 * Il ne DEVINE pas la ligne. Deux modèles écrits, aucun identifiant lisible, une entité
 * inconnue du registre : il rend `null`, et l'appelant DIT qu'il n'a pas pu constater. Rendre
 * « à peu près la bonne ligne » serait pire que ne rien rendre : la personne validerait un
 * changement en regardant un autre enregistrement (§104.7).
 *
 * Et un `null` n'annule pas l'écriture — elle a eu lieu. Ce qui change est la PHRASE : « fait,
 * voici la ligne » ou « fait, je n'ai pas pu le constater », jamais « fait » tout court.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'on a pu constater APRÈS l'écriture. Les clés sont toujours les mêmes (§118.20). */
export interface Relecture {
  entite: string;
  libelle: string;
  id: string;
  /** Les champs de détail de la ligne, tels que l'écran les montre. */
  champs: { nom: string; valeur: string }[];
}

/** L'identifiant écrit — celui que l'action REND d'abord, celui qu'on lui a DONNÉ ensuite. */
function identifiantEcrit(retour: unknown, entree: Readonly<Record<string, unknown>>): string | null {
  // LE RETOUR FAIT FOI : sur une CRÉATION, l'entrée ne porte aucun identifiant, et c'est
  // l'action qui vient de le fabriquer. Le lire ailleurs relirait la mauvaise ligne.
  if (retour && typeof retour === "object" && !Array.isArray(retour)) {
    const v = (retour as { id?: unknown }).id;
    if (typeof v === "string" && v) return v;
  }
  const donne = entree.id;
  return typeof donne === "string" && donne ? donne : null;
}

const enTexte = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(enTexte).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/**
 * RELIT LA LIGNE QUE L'ACTION VIENT D'ÉCRIRE. `null` quand on ne peut pas la désigner à coup
 * sûr, quand la personne n'a pas le droit de la lire, ou quand elle n'existe plus (suppression).
 */
export async function relireApresEcriture(
  user: SessionUser,
  modelesEcrits: readonly string[],
  entree: Readonly<Record<string, unknown>>,
  retour: unknown,
): Promise<Relecture | null> {
  const id = identifiantEcrit(retour, entree);
  if (!id) return null;

  // UN SEUL modèle écrit, sinon on ne sait pas laquelle des lignes montrer. Les actions qui en
  // touchent plusieurs (une écriture + son journal) sont fréquentes : on prend le PREMIER
  // modèle qui corresponde à une entité du registre, et si deux correspondent, on renonce.
  const candidats = modelesEcrits.map(entiteDuModele).filter((d): d is EntityDef => d !== null);
  if (candidats.length !== 1) return null;
  const def = candidats[0]!;
  if (!canReadEntity(user, def)) return null;

  const model = (prisma as unknown as Record<string, {
    findFirst: (a: unknown) => Promise<Record<string, unknown> | null>;
  }>)[def.model.charAt(0).toLowerCase() + def.model.slice(1)];
  if (!model) return null;

  const champs = def.detailFields?.length ? def.detailFields : def.listFields;
  const select = Object.fromEntries([...new Set(["id", ...champs])].map((c) => [c, true as const]));

  const portee = await porteeEntite(user, def);
  const ligne = await model.findFirst({ where: { AND: [portee, { id }] }, select }).catch(() => null);
  if (!ligne) return null;

  return {
    entite: def.name,
    libelle: def.label,
    id,
    champs: champs.filter((c) => c in ligne).map((c) => ({ nom: c, valeur: enTexte(ligne[c]) })),
  };
}
