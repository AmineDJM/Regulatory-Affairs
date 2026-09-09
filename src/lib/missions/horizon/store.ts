/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PERSISTANCE DE L'HORIZON — jalons et entrées datées, et rien d'autre.
 *
 * Ce module écrit `MissionMilestone` et `MissionInput`. Il ne compile pas, il ne planifie pas,
 * il ne décide pas : `jalon.ts`, `budget.ts`, `fraicheur.ts` et `modification.ts` décident, et
 * ils sont purs pour cette raison. Ici on lit et on écrit — c'est tout, et c'est ce qui permet
 * de tester les règles sans base et la base sans modèle.
 *
 * `MissionEvent` reste LE journal (§118.5) : on n'ouvre pas un second registre pour les jalons.
 * Une transition de jalon s'y écrit comme le reste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";
import type { Jalon, StatutJalon } from "@/lib/missions/horizon/jalon";
import type { Confiance, EntreeMission } from "@/lib/missions/horizon/fraicheur";
import { empreinteDe } from "@/lib/missions/horizon/fraicheur";

/** Ce qu'un découpage propose — avant d'exister en base. */
export interface JalonPropose {
  ordre: number;
  titre: string;
  resultat: string;
  dependsOn: number[];
}

/**
 * ÉCRIT UN DÉCOUPAGE — de façon RÉ-ENTRANTE, comme `materialiser` l'est pour les étapes.
 *
 * Rejouer le même découpage ne duplique pas : la clé `(missionId, ordre)` est unique en base,
 * donc c'est la BASE qui tient l'unicité, pas la discipline de l'appelant. Un jalon déjà
 * COMPILÉ n'est jamais réécrit par un nouveau découpage : son sous-plan existe, ses étapes
 * tournent, et lui changer son résultat sous les pieds ferait juger un travail à l'aune d'une
 * autre demande.
 */
export async function ecrireJalons(missionId: string, proposes: readonly JalonPropose[]): Promise<number> {
  let ecrits = 0;
  for (const j of proposes) {
    const existant = await prisma.missionMilestone.findUnique({
      where: { missionId_ordre: { missionId, ordre: j.ordre } },
      select: { id: true, planVersion: true },
    });
    if (existant && existant.planVersion > 0) continue;
    if (existant) {
      await prisma.missionMilestone.update({
        where: { id: existant.id },
        data: { titre: j.titre, resultat: j.resultat, dependsOn: j.dependsOn },
      });
    } else {
      await prisma.missionMilestone.create({
        data: {
          missionId, ordre: j.ordre, titre: j.titre, resultat: j.resultat, dependsOn: j.dependsOn,
        },
      });
    }
    ecrits += 1;
  }
  return ecrits;
}

export interface JalonPersiste extends Jalon {
  id: string;
  replans: number;
  dernierRefus: string | null;
  /** TOUS les refus déjà rencontrés ici — le progrès se juge dessus, pas sur le seul dernier. */
  refusVus: string[];
  compiledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: Record<string, unknown>;
}

export async function lireJalons(missionId: string): Promise<JalonPersiste[]> {
  const lignes = await prisma.missionMilestone.findMany({
    where: { missionId },
    orderBy: { ordre: "asc" },
  });
  return lignes.map((l) => ({
    id: l.id,
    ordre: l.ordre,
    titre: l.titre,
    resultat: l.resultat,
    statut: l.statut as StatutJalon,
    planVersion: l.planVersion,
    dependsOn: l.dependsOn,
    replans: l.replans,
    dernierRefus: l.dernierRefus,
    refusVus: l.refusVus ?? [],
    compiledAt: l.compiledAt,
    startedAt: l.startedAt,
    completedAt: l.completedAt,
    notes: (l.notes ?? {}) as Record<string, unknown>,
  }));
}

/** Une mission a-t-elle un horizon ? Une mission courte n'en a pas, et c'est légitime. */
export async function aDesJalons(missionId: string): Promise<boolean> {
  return (await prisma.missionMilestone.count({ where: { missionId } })) > 0;
}

export async function marquerJalon(
  id: string,
  statut: StatutJalon,
  /**
   * `refusVus: null` REMET L'HISTOIRE À ZÉRO — et c'est la seule façon de le faire.
   *
   * Une modification d'objectif ou une reprise sur information neuve rend caduque toute la
   * carte des murs déjà rencontrés (§118.42) : les garder ferait refuser, comme « déjà vu »,
   * un refus qui porte désormais sur une autre demande. Passer un tableau le REMPLACE ;
   * l'omettre ne touche à rien.
   */
  extra: {
    compiledAt?: Date; planVersion?: number; dernierRefus?: string | null;
    refusVus?: readonly string[] | null; notes?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const maintenant = new Date();
  await prisma.missionMilestone.update({
    where: { id },
    data: {
      statut,
      ...(extra.planVersion !== undefined ? { planVersion: extra.planVersion } : {}),
      ...(extra.compiledAt ? { compiledAt: extra.compiledAt } : {}),
      ...(extra.dernierRefus !== undefined ? { dernierRefus: extra.dernierRefus } : {}),
      ...(extra.refusVus !== undefined ? { refusVus: { set: [...(extra.refusVus ?? [])] } } : {}),
      ...(extra.notes ? { notes: extra.notes as never } : {}),
      ...(statut === "ACTIVE" ? { startedAt: maintenant } : {}),
      ...(statut === "DONE" || statut === "SKIPPED" || statut === "CANCELLED"
        ? { completedAt: maintenant } : {}),
    },
  });
}

/** Un sous-plan de plus a été écrit pour ce jalon — le budget est LOCAL (§118.42). */
/**
 * UN SOUS-PLAN DE PLUS — et le refus qui l'a motivé entre dans l'HISTOIRE du jalon.
 *
 * `dernierRefus` répond « qu'est-ce qui vient d'être opposé ? » ; `refusVus` répond « où
 * sommes-nous déjà passés ? ». Les deux, parce qu'une oscillation A → B → A → B change à chaque
 * tour et ne progresse jamais : sans l'histoire, elle passe pour du progrès jusqu'au plafond.
 *
 * `push` ne dédoublonne pas — c'est voulu : la LISTE dit combien de fois on est repassé au même
 * endroit, et `peutReplanifier` n'a besoin que de l'appartenance. Un `Set` perdrait le compte.
 */
export async function compterReplan(id: string, signatureRefus: string | null): Promise<void> {
  await prisma.missionMilestone.update({
    where: { id },
    data: {
      replans: { increment: 1 },
      dernierRefus: signatureRefus,
      ...(signatureRefus ? { refusVus: { push: signatureRefus } } : {}),
    },
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * INSCRIRE UNE ENTRÉE — ce que la mission a lu, d'où, quand, et sous quelle empreinte.
 *
 * IDEMPOTENT PAR L'EMPREINTE : relire la même valeur ne crée pas une seconde ligne. Sans cette
 * règle, une mission qui relit son forecast à chaque tour accumulerait mille lignes identiques,
 * et la question « depuis quand connaissons-nous ce chiffre ? » n'aurait plus de réponse — la
 * date la plus ancienne serait noyée.
 *
 * Une valeur DIFFÉRENTE, elle, remplace : l'ancienne est marquée `supersededAt` (elle reste au
 * dossier, c'est ce qui permet de dire « ça a changé le 18 ») et la nouvelle est écrite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface InscriptionEntree {
  missionId: string;
  milestoneId?: string | null;
  stepKey?: string | null;
  cle: string;
  source: string;
  version?: string | null;
  valeur: unknown;
  apercu?: string | null;
  confiance?: Confiance;
  effectiveAt?: Date | null;
}

export interface ResultatInscription {
  /** `NOUVELLE` (première lecture) | `INCHANGEE` | `CHANGEE` (l'ancienne est remplacée). */
  issue: "NOUVELLE" | "INCHANGEE" | "CHANGEE";
  empreinte: string;
  ancienneEmpreinte: string | null;
  id: string;
}

export async function inscrireEntree(e: InscriptionEntree): Promise<ResultatInscription> {
  const empreinte = empreinteDe(e.valeur);
  const courante = await prisma.missionInput.findFirst({
    where: { missionId: e.missionId, cle: e.cle, supersededAt: null },
    orderBy: { retrievedAt: "desc" },
  });

  if (courante && courante.empreinte === empreinte) {
    // MÊME VALEUR : on rafraîchit la DATE DE LECTURE et rien d'autre. C'est exactement ce que
    // « je viens de vérifier, c'est toujours ça » veut dire, et ça remet le compteur d'âge à zéro
    // sans prétendre que la donnée est neuve.
    await prisma.missionInput.update({
      where: { id: courante.id },
      data: { retrievedAt: new Date(), ...(e.version ? { version: e.version } : {}) },
    });
    return { issue: "INCHANGEE", empreinte, ancienneEmpreinte: empreinte, id: courante.id };
  }

  if (courante) {
    await prisma.missionInput.update({
      where: { id: courante.id },
      data: { supersededAt: new Date() },
    });
  }
  const cree = await prisma.missionInput.create({
    data: {
      missionId: e.missionId,
      milestoneId: e.milestoneId ?? null,
      stepKey: e.stepKey ?? null,
      cle: e.cle,
      source: e.source,
      version: e.version ?? null,
      empreinte,
      apercu: (e.apercu ?? apercuDe(e.valeur)).slice(0, 400),
      confiance: e.confiance ?? "TROUVE",
      effectiveAt: e.effectiveAt ?? null,
    },
    select: { id: true },
  });
  return {
    issue: courante ? "CHANGEE" : "NOUVELLE",
    empreinte,
    ancienneEmpreinte: courante?.empreinte ?? null,
    id: cree.id,
  };
}

/** Un digest LISIBLE, borné — pour l'écran et le journal, jamais pour recalculer. */
function apercuDe(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

export async function lireEntrees(missionId: string, opts: { vivantes?: boolean } = {}): Promise<EntreeMission[]> {
  const lignes = await prisma.missionInput.findMany({
    where: { missionId, ...(opts.vivantes === false ? {} : { supersededAt: null }) },
    orderBy: { retrievedAt: "desc" },
  });
  return lignes.map((l) => ({
    cle: l.cle,
    source: l.source,
    version: l.version,
    empreinte: l.empreinte,
    confiance: l.confiance as Confiance,
    retrievedAt: l.retrievedAt,
    effectiveAt: l.effectiveAt,
    supersededAt: l.supersededAt,
    stepKey: l.stepKey,
    milestoneId: l.milestoneId,
  }));
}
