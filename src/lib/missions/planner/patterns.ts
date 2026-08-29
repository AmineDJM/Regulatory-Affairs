import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES FORMES DE PLANS QUI ONT RÉUSSI (§64) — une INFLUENCE, jamais une autorité.
 *
 * ── CE QU'ON RETIENT, ET CE QU'ON NE RETIENT SURTOUT PAS ─────────────────────────────────
 *
 * Jamais le contenu : pas un destinataire, pas un montant, pas une phrase. Uniquement la FORME —
 * la suite des types d'étapes et des capacités appelées (« lire l'annuaire → envoyer en
 * éventail → contrôler ») — et combien de missions DISTINCTES, jugées atteintes, l'ont portée.
 *
 * ── PAS D'APPRENTISSAGE SILENCIEUX (§12), ET POURTANT UN APPRENTISSAGE ───────────────────
 *
 * La règle « ce qu'Adam a observé n'est pas ce qu'un humain a approuvé » vise l'AUTORITÉ : une
 * observation ne doit jamais décider à la place de quelqu'un. Une forme VALIDATED ne décide
 * rien : elle est murmurée au planner comme INDICATION (« des missions semblables ont réussi
 * ainsi »), et le plan produit repasse ENTIER par le compilateur, la politique d'approbation et
 * le contrôle qualité — comme si la forme n'existait pas. Influencer un brouillon n'est pas
 * signer un acte.
 *
 * ── LA PROMOTION EST ARITHMÉTIQUE, ET IDEMPOTENTE ────────────────────────────────────────
 *
 * OBSERVED dès la première réussite, VALIDATED à partir de TROIS missions distinctes. Le rejeu
 * de la conclusion d'une même mission (redémarrage, seconde vérification) ne compte pas deux
 * fois : `dernierMissionId` fait barrage.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le seuil de promotion — trois réussites distinctes, pas une impression. */
export const SEUIL_VALIDATION = 3;

export interface EtapeDeForme {
  nodeType: string;
  capability?: string | null;
  /** L'étape est-elle issue d'un éventail (forEach) ? Les clones se replient en UNE mention. */
  enEventail?: boolean;
}

/**
 * LA FORME LISIBLE D'UN PLAN. Les clones d'éventail (« envoi:1 », « envoi:2 »…) se replient en
 * une seule mention marquée `[éventail]` : la forme de « écrire à 33 personnes » et celle de
 * « écrire à 300 personnes » sont LA MÊME forme — c'est le point de tout le registre.
 */
export function formeDuPlan(etapes: readonly EtapeDeForme[]): string[] {
  const forme: string[] = [];
  for (const e of etapes) {
    const libelle = `${e.nodeType}${e.capability ? `(${e.capability})` : ""}${e.enEventail ? "[éventail]" : ""}`;
    // Le repli : une suite d'étapes identiques (l'éventail déployé) ne compte qu'une fois.
    if (forme[forme.length - 1] !== libelle) forme.push(libelle);
  }
  return forme;
}

/** L'empreinte stable d'une forme — l'unicité en base est tenue par elle. */
export function signatureDeForme(forme: readonly string[]): string {
  return createHash("sha256").update(forme.join("→")).digest("hex").slice(0, 24);
}

/** A/B/C → le vocabulaire du triage, pour que l'indication retrouve les demandes semblables. */
export function profilDeComplexite(complexity: string | null | undefined): string {
  return complexity === "A" ? "SIMPLE" : complexity === "C" ? "COMPLEXE" : "MOYEN";
}

/**
 * ENREGISTRE LA FORME D'UNE MISSION RÉUSSIE. Appelée quand le juge conclut `goalSatisfied` —
 * et JAMAIS ailleurs : une mission finie sans objectif atteint n'apprend rien de bon.
 *
 * Ne lève jamais : le registre des formes ne doit pas pouvoir faire échouer une conclusion de
 * mission — même règle que le registre d'événements.
 */
export async function enregistrerFormeReussie(missionId: string): Promise<void> {
  try {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: {
        complexity: true,
        steps: {
          orderBy: [{ createdAt: "asc" }, { key: "asc" }],
          select: { key: true, nodeType: true, capability: true, status: true },
        },
      },
    });
    if (!mission || mission.steps.length === 0) return;

    const forme = formeDuPlan(
      mission.steps
        .filter((s) => s.status !== "SKIPPED" && s.status !== "CANCELLED")
        .map((s) => ({
          nodeType: s.nodeType,
          capability: s.capability,
          // Les clones d'éventail portent leur origine dans la clé (« envoi:3 »).
          enEventail: /:\d+$/.test(s.key),
        })),
    );
    if (forme.length === 0) return;
    const signature = signatureDeForme(forme);
    const profil = profilDeComplexite(mission.complexity);

    const existante = await prisma.missionPlanPattern.findUnique({ where: { signature } });
    if (!existante) {
      await prisma.missionPlanPattern.create({
        data: { signature, profil, forme, succes: 1, statut: "OBSERVED", dernierMissionId: missionId },
      });
      return;
    }
    // LE REJEU NE COMPTE PAS DEUX FOIS : la conclusion d'une mission peut être revérifiée après
    // un redémarrage, la forme, elle, n'a réussi qu'UNE fois.
    if (existante.dernierMissionId === missionId) return;
    const succes = existante.succes + 1;
    await prisma.missionPlanPattern.update({
      where: { signature },
      data: {
        succes,
        dernierMissionId: missionId,
        ...(succes >= SEUIL_VALIDATION ? { statut: "VALIDATED" } : {}),
      },
    });
  } catch (err) {
    console.error("[missions] forme de plan non enregistrée", missionId, err);
  }
}

/**
 * LES INDICATIONS POUR LE PLANNER — les formes VALIDATED les plus éprouvées, en phrases.
 *
 * Rendues au COMPOSEUR DE CONTEXTE, qui les encadre lui-même comme indication et non comme
 * obligation. Une liste vide est la réponse normale d'un système jeune.
 */
export async function indicesDeFormes(limite = 3): Promise<string[]> {
  try {
    const rangs = await prisma.missionPlanPattern.findMany({
      where: { statut: "VALIDATED" },
      orderBy: { succes: "desc" },
      take: Math.max(1, Math.min(limite, 5)),
      select: { forme: true, succes: true },
    });
    return rangs.map((r) => {
      const forme = Array.isArray(r.forme) ? (r.forme as string[]).join(" → ") : String(r.forme);
      return `${forme} (a réussi ${r.succes} fois)`;
    });
  } catch {
    return [];
  }
}
