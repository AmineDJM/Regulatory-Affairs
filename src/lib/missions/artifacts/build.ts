import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Reasoner } from "@/lib/missions/ports";
import type { StepContext, StepOutcome } from "@/lib/missions/runtime/engine";
import { journaliser } from "@/lib/missions/runtime/store";
import { nomFichier, parserSpec, type ArtefactSpec } from "@/lib/missions/artifacts/spec";
import { rendre } from "@/lib/missions/artifacts/render";
import { controlerClasseur, type ControleArtefact } from "@/lib/missions/artifacts/verify";
import { SCHEMA_ARTEFACT } from "@/lib/missions/artifacts/schema";
import { rolePourEtape } from "@/lib/missions/model/roles";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉTAPE QUI FABRIQUE UN FICHIER (§22) — et la seule qui puisse servir de PREUVE.
 *
 * ── LA CHAÎNE COMPLÈTE, DANS L'ORDRE, ET AUCUN MAILLON N'EST FACULTATIF ─────────────────
 *
 *   spec → fabrication → CONTRÔLE → dépôt au Drive → enregistrement → aperçu dans l'écran
 *
 * Le contrôle est au milieu, et c'est délibéré : un fichier qui ne passe pas le contrôle n'est
 * PAS déposé. Déposer d'abord et contrôler ensuite laisserait dans le Drive de l'entreprise un
 * classeur cassé que quelqu'un finirait par envoyer.
 *
 * ── D'OÙ VIENT LA SPEC ──────────────────────────────────────────────────────────────────
 *
 * De deux endroits, et jamais d'ailleurs :
 *
 *   • les DONNÉES des étapes amont, quand elles portent déjà des lignes et des colonnes ;
 *   • un WORKER de mise en forme, quand il faut décider quelles colonnes et quel graphique.
 *
 * Dans les deux cas, ce sont les CHIFFRES des étapes amont qui remplissent les lignes. Un
 * modèle qui « écrirait les données » produirait un classeur plausible et faux — la faute la
 * plus coûteuse possible pour un fichier qu'on envoie à la direction.
 *
 * ── L'IDEMPOTENCE ───────────────────────────────────────────────────────────────────────
 *
 * `MissionArtifact` est unique sur (mission, clé). Une reprise REMPLACE le fichier au lieu d'en
 * empiler un second : trois reprises ne laissent pas trois « Analyse PCH.xlsx » dont personne ne
 * sait lequel fait foi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Où le fichier est rangé. Le seul point où le runtime touche au Drive — par un port. */
export interface ArtifactSink {
  deposer(input: {
    ownerId: string;
    fileName: string;
    mime: string;
    data: Buffer;
    /** Le dossier de destination, par son nom lisible. */
    folder: string;
    missionId: string;
  }): Promise<{ nodeId: string }>;
}

export interface ArtifactDeps {
  reasoner: Reasoner;
  sink?: ArtifactSink;
  /** Le dossier où déposer. Par défaut, celui des livrables de mission. */
  folder?: string;
}

export const DOSSIER_LIVRABLES = "Livrables de mission";

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/**
 * LE GESTIONNAIRE D'ÉTAPE `ARTIFACT` — branché dans `StepHandlers.ARTIFACT`.
 */
export async function executerArtefact(ctx: StepContext, deps: ArtifactDeps): Promise<StepOutcome> {
  const { mission, step } = ctx;

  const spec = await composerSpec(ctx, deps);
  if ("error" in spec) {
    return { status: "FAILED", error: spec.error, errorKind: "ARTIFACT_SPEC_INVALID", retryable: spec.retryable };
  }

  // ── 1. FABRICATION ──────────────────────────────────────────────────────────────────
  let rendu;
  try {
    rendu = await rendre(spec);
  } catch (e) {
    return {
      status: "FAILED",
      error: `la fabrication du livrable a échoué : ${e instanceof Error ? e.message : "erreur"}`,
      errorKind: "ARTIFACT_BUILD_FAILED",
      retryable: true,
    };
  }

  const fichier = nomFichier(spec);
  const ligne = await prisma.missionArtifact.upsert({
    where: { missionId_key: { missionId: mission.id, key: spec.key } },
    create: {
      missionId: mission.id, stepId: step.id, key: spec.key, title: spec.title,
      format: spec.format, fileName: fichier, byteSize: rendu.buffer.length,
      sha256: sha(rendu.buffer), spec: spec as never, status: "BUILT",
    },
    update: {
      stepId: step.id, title: spec.title, format: spec.format, fileName: fichier,
      byteSize: rendu.buffer.length, sha256: sha(rendu.buffer), spec: spec as never,
      status: "BUILT", driveNodeId: null, qaReport: undefined,
    },
    select: { id: true },
  });

  // ── 2. CONTRÔLE — AVANT le dépôt, jamais après ─────────────────────────────────────
  const controle = spec.format === "XLSX"
    ? await controlerClasseur(rendu.buffer, spec)
    : controleGenerique(rendu.buffer, spec, rendu.detail);

  if (!controle.ok) {
    await prisma.missionArtifact.update({
      where: { id: ligne.id },
      data: { status: "REJECTED", qaReport: { ...controle, detail: rendu.detail } as never },
    });
    const echecs = controle.points.filter((p) => !p.ok).map((p) => `${p.nom} : ${p.detail}`);
    return {
      status: "FAILED",
      error: `le livrable « ${spec.title} » n'a pas passé le contrôle — ${echecs.join(" ; ")}`,
      errorKind: "ARTIFACT_QA_FAILED",
      // REJOUABLE : le contrôle échoue souvent sur des données incomplètes en amont, qui
      // peuvent l'être moins au tour suivant. On ne DÉPOSE pas pour autant.
      retryable: true,
    };
  }

  // ── 3. DÉPÔT ────────────────────────────────────────────────────────────────────────
  let nodeId: string | null = null;
  if (deps.sink) {
    try {
      const r = await deps.sink.deposer({
        ownerId: mission.ownerId,
        fileName: fichier,
        mime: rendu.mime,
        data: rendu.buffer,
        folder: deps.folder ?? DOSSIER_LIVRABLES,
        missionId: mission.id,
      });
      nodeId = r.nodeId;
    } catch (e) {
      // LE DÉPÔT RATÉ N'EST PAS UNE FABRICATION RATÉE : le fichier existe, il est contrôlé, il
      // est enregistré. On échoue l'étape (le livrable n'est pas rangé), mais l'artefact reste
      // VERIFIED et une reprise ne le refabriquera pas pour rien.
      await prisma.missionArtifact.update({
        where: { id: ligne.id },
        data: { status: "VERIFIED", qaReport: { ...controle, detail: rendu.detail } as never },
      });
      return {
        status: "FAILED",
        error: `le livrable est fabriqué et contrôlé, mais son rangement au Drive a échoué : ${e instanceof Error ? e.message : "erreur"}`,
        errorKind: "ARTIFACT_STORE_FAILED",
        retryable: true,
      };
    }
  }

  await prisma.missionArtifact.update({
    where: { id: ligne.id },
    data: { status: "VERIFIED", driveNodeId: nodeId, qaReport: { ...controle, detail: rendu.detail } as never },
  });

  await journaliser(mission.id, "ARTIFACT",
    `Livrable « ${spec.title} » (${spec.format}, ${Math.round(rendu.buffer.length / 1024)} Ko) fabriqué et contrôlé.`,
    { key: spec.key, fileName: fichier, driveNodeId: nodeId, controles: controle.points.length });

  return {
    status: "DONE",
    receipt: ligne.id,
    result: {
      artifactId: ligne.id,
      key: spec.key,
      title: spec.title,
      format: spec.format,
      fileName: fichier,
      byteSize: rendu.buffer.length,
      driveNodeId: nodeId,
      controles: controle.points.length,
      ...rendu.detail,
    },
  };
}

type SpecOuErreur = ArtefactSpec | { error: string; retryable: boolean };

/**
 * COMPOSE LA SPEC — depuis l'entrée de l'étape, ou par un worker de mise en forme.
 *
 * Le chemin direct (l'entrée porte déjà `sheets`) existe pour les livrables dont la forme est
 * décidée par le plan : « exporte la liste des courriers non classés » n'a pas besoin qu'un
 * modèle décide des colonnes. Le chemin worker sert quand la mise en forme EST le travail —
 * « fais-moi l'analyse du marché », où choisir les colonnes est une décision.
 */
async function composerSpec(ctx: StepContext, deps: ArtifactDeps): Promise<SpecOuErreur> {
  const { mission, step } = ctx;
  const entree = step.input;

  if (Array.isArray(entree.sheets) || Array.isArray(entree.summary)) {
    const s = parserSpec({ key: step.key, title: step.title, format: "XLSX", ...entree });
    if ("error" in s) return { error: s.error, retryable: false };
    return s;
  }

  if (!deps.reasoner.configured()) {
    return {
      error: "aucune donnée de livrable dans l'étape et aucun fournisseur de modèle pour la composer",
      retryable: false,
    };
  }

  // LES DONNÉES VIENNENT DES ÉTAPES AMONT, et elles seules. Le worker de mise en forme reçoit
  // ces données et décide de la STRUCTURE ; il n'a rien d'autre à inventer.
  const amont: Record<string, unknown> = {};
  for (const d of step.dependsOn) {
    const s = mission.steps.find((x) => x.key === d);
    if (s?.result !== null && s?.result !== undefined) amont[d] = s.result;
  }
  if (Object.keys(amont).length === 0) {
    return {
      error: `l'étape « ${step.title} » doit produire un fichier mais ne dépend d'aucune étape qui produise des données`,
      retryable: false,
    };
  }

  const format = String(entree.format ?? step.spec?.artifactFormat ?? "XLSX").toUpperCase();
  const res = await deps.reasoner.reason<Record<string, unknown>>({
    role: rolePourEtape(step.spec?.reasoningRequirement ?? "LIGHT"),
    schemaName: "artefact_spec",
    schema: SCHEMA_ARTEFACT,
    system:
      "Tu mets en forme un livrable d'entreprise à partir de DONNÉES déjà collectées.\n\n"
      + "RÈGLES\n"
      + "1. Toutes les valeurs des lignes viennent des données fournies. N'invente AUCUN chiffre, nom ou date.\n"
      + "2. Tu n'écris JAMAIS de formule Excel : déclare `totals` et `computed`, le code écrira les formules justes.\n"
      + "3. Les colonnes numériques portent le type `number`, `money` (DZD) ou `percent` — jamais `text`.\n"
      + "4. La synthèse commence par la réponse, pas par la méthode.\n"
      + "5. Écris en français.",
    prompt:
      `OBJECTIF DE LA MISSION : ${mission.objective}\n\n`
      + `LIVRABLE DEMANDÉ : ${step.title} (format ${format})\n`
      + (step.spec?.completionCondition ? `CE QUI FERA QU'IL EST BON : ${step.spec.completionCondition}\n` : "")
      + `\nDONNÉES DISPONIBLES :\n${JSON.stringify(amont).slice(0, 40_000)}`,
    maxOutputTokens: 12_000,
    purpose: "mission.artifact",
  });

  if (!res.ok || !res.data) {
    return { error: res.error ?? "la mise en forme du livrable n'a rien rendu d'exploitable", retryable: true };
  }

  const s = parserSpec({
    ...res.data,
    key: String(res.data.key || step.key),
    format,
  });
  if ("error" in s) return { error: s.error, retryable: true };
  return s;
}

/**
 * LE CONTRÔLE DES FORMATS NON-CLASSEUR.
 *
 * Il est plus pauvre, et on le dit : on vérifie qu'un fichier existe, qu'il porte la SIGNATURE
 * de son format, et qu'il n'est pas ridiculement petit. On ne prétend pas relire un PPTX comme
 * on relit un classeur — le faire à moitié donnerait un faux sentiment de vérification.
 */
function controleGenerique(buffer: Buffer, spec: ArtefactSpec, detail: Record<string, unknown>): ControleArtefact {
  const points: ControleArtefact["points"] = [];
  const tete = buffer.subarray(0, 4);
  const signatures: Record<string, Buffer> = {
    DOCX: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    PPTX: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    ZIP: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    PDF: Buffer.from("%PDF"),
  };
  const attendue = signatures[spec.format];

  points.push({
    nom: "taille",
    ok: buffer.length > 200,
    detail: `${buffer.length} octets`,
  });
  if (attendue) {
    points.push({
      nom: "signature",
      ok: tete.equals(attendue),
      detail: tete.equals(attendue)
        ? `signature ${spec.format} correcte`
        : `signature inattendue (${tete.toString("hex")}) : le fichier n'est pas un ${spec.format} valide`,
    });
  }
  points.push({ nom: "contenu", ok: true, detail: JSON.stringify(detail) });

  return {
    ok: points.every((p) => p.ok),
    points,
    nonVerifie: [
      `Le format ${spec.format} n'est pas relu en profondeur : seules sa signature et sa taille sont vérifiées. `
      + `Seul le classeur XLSX fait l'objet d'un contrôle complet (feuilles, formules, totaux, graphiques).`,
    ],
  };
}
