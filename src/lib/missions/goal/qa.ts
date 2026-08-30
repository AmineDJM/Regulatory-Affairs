import { prisma } from "@/lib/prisma";
import type { EtatMission } from "@/lib/missions/runtime/store";
import { controlerQualite, type EtapeObservee, type RapportQA } from "@/lib/missions/goal/evaluate";
import { EFFECT_RANK, capabilityMeta } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRÔLE QUALITÉ DÉTERMINISTE (§10-11) — ce qu'un modèle n'a pas à juger.
 *
 * ── POURQUOI CE FICHIER EXISTE À CÔTÉ DE `evaluate.ts` ───────────────────────────────────
 *
 * `controlerQualite` compte les étapes abouties : c'est le socle, et il reste ici la première
 * vérification. Mais « 33/33 étapes abouties » ne dit RIEN sur les questions qui font la
 * différence entre une mission réussie et une mission qui a l'air réussie :
 *
 *   — les trente-trois messages sont-ils partis à trente-trois personnes DIFFÉRENTES ?
 *   — chacun portait-il UN destinataire, ou l'un d'eux en portait-il trente-trois ?
 *   — chaque effet externe porte-t-il un REÇU, ou seulement un statut « fait » ?
 *   — deux étapes ont-elles produit le même effet deux fois ?
 *   — les fichiers annoncés existent-ils, et ont-ils été CONTRÔLÉS ?
 *
 * Aucune de ces questions ne demande un modèle. Toutes ont une réponse exacte, calculable, et
 * les faire juger par un modèle serait à la fois plus cher et moins sûr. Le contrôle sémantique
 * (§11) existe séparément et ne s'occupe QUE de ce que le code ne peut pas décider.
 *
 * ── LE SENS DE LA PRÉSÉANCE, RÉPÉTÉ PARCE QU'IL SE PERD ──────────────────────────────────
 *
 * Ce contrôle a le dernier mot dans le sens NÉGATIF uniquement. Il peut interdire de conclure ;
 * il ne peut jamais autoriser à conclure. Ce qu'il rend « ok » signifie « rien d'anormal
 * détecté », pas « l'objectif est atteint ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les catégories de vérification. Nommées, pour que le rapport dise CE QUI a échoué. */
export const CONTROLES = [
  "CARDINALITE",
  "DESTINATAIRES",
  "RECUS",
  "DOUBLONS",
  "ARTEFACTS",
  "COMPLETUDE",
] as const;
export type Controle = (typeof CONTROLES)[number];

export interface Constat {
  controle: Controle;
  ok: boolean;
  /** Ce qui a été vérifié, en français, avec les nombres. */
  message: string;
  /** Les clés d'étapes concernées — c'est ce que la réparation rejouera. */
  stepKeys: string[];
}

export interface RapportComplet {
  ok: boolean;
  /** Le comptage de base — inchangé, réutilisé, pas réécrit. */
  base: RapportQA;
  constats: Constat[];
  /** Ce qu'il faut rejouer pour réparer. Vide quand tout passe. */
  aRejouer: string[];
  resume: string;
}

const CHAMPS_DESTINATAIRES = ["to", "destinataire", "destinataires", "recipient", "recipients", "email", "userId", "toUserId"];

/** Les destinataires d'une entrée, normalisés. Une chaîne « a@x; b@y » compte pour deux. */
export function destinatairesDe(input: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const champ of CHAMPS_DESTINATAIRES) {
    const v = input[champ];
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === "string" && x.trim()) out.push(x.trim().toLowerCase());
    } else if (typeof v === "string" && v.trim()) {
      for (const p of v.split(/[;,]/)) if (p.trim()) out.push(p.trim().toLowerCase());
    }
  }
  return out;
}

const estEffetExterne = (capability: string | null): boolean => {
  if (!capability) return false;
  const m = capabilityMeta(capability);
  return EFFECT_RANK[m.effect] >= EFFECT_RANK.EXTERNAL_COMMUNICATION;
};

// MÊME VUE QUE `conclure` : les obligations du plan COURANT. Une étape contournée par un
// replan reste au dossier mais ne décide plus — et ses clés voyagent à part, pour que la
// réconciliation des éventails sache qu'une fille contournée n'est pas un trou silencieux.
const observer = (m: EtatMission): EtapeObservee[] =>
  m.steps.filter((s) => !s.contournee).map((s) => ({
    key: s.key, title: s.title, status: s.status, nodeType: s.nodeType,
    receipt: s.receipt, attempt: s.attempt, maxAttempts: s.maxAttempts, result: s.result,
  }));

const contourneesDe = (m: EtatMission): ReadonlySet<string> =>
  new Set(m.steps.filter((s) => s.contournee).map((s) => s.key));

/**
 * LE CONTRÔLE COMPLET.
 *
 * Il lit la base pour les artefacts, et rien d'autre : tout le reste est déjà dans l'état de la
 * mission qu'on lui passe. C'est délibéré — un contrôle qui refait ses propres requêtes pourrait
 * voir un état différent de celui que le moteur vient de décider.
 */
export async function controleComplet(mission: EtatMission): Promise<RapportComplet> {
  const steps = observer(mission);
  const base = controlerQualite(steps, contourneesDe(mission));
  const constats: Constat[] = [];

  // ── 1. CARDINALITÉ DES ÉVENTAILS ────────────────────────────────────────────────────
  //
  // Le modèle d'un éventail annonce un nombre ; les filles existent ou non. Un écart signifie
  // qu'une itération n'a jamais été créée — donc qu'une personne n'a jamais rien reçu, sans
  // qu'aucune étape ne soit en échec. C'est le silence le plus dangereux du runtime.
  for (const s of mission.steps) {
    if (!s.forEach) continue;
    const annonce = lireNombre(s.result, "expanded");
    const filles = mission.steps.filter((f) => f.key.startsWith(`${s.key}#`));
    if (annonce === null) continue;
    constats.push({
      controle: "CARDINALITE",
      ok: annonce === filles.length,
      message: annonce === filles.length
        ? `« ${s.title} » : ${filles.length} itérations annoncées, ${filles.length} créées.`
        : `« ${s.title} » annonce ${annonce} itérations mais ${filles.length} existent : `
          + `${Math.abs(annonce - filles.length)} personne(s) n'ont rien reçu sans qu'aucune étape n'échoue.`,
      stepKeys: annonce === filles.length ? [] : [s.key],
    });
  }

  // ── 2. DESTINATAIRES ────────────────────────────────────────────────────────────────
  //
  // Deux fautes distinctes, et il faut les deux : un envoi qui porte plusieurs destinataires
  // (tout le monde se voit), et deux envois qui portent le même (quelqu'un reçoit deux fois).
  const parDestinataire = new Map<string, string[]>();
  const multiples: string[] = [];
  for (const s of mission.steps) {
    if (s.forEach) continue; // le modèle n'envoie rien : ses filles le font
    if (!estEffetExterne(s.capability)) continue;
    const dests = destinatairesDe(s.input);
    if (dests.length > 1) multiples.push(s.key);
    for (const d of dests) {
      const cle = `${s.capability}::${d}`;
      parDestinataire.set(cle, [...(parDestinataire.get(cle) ?? []), s.key]);
    }
  }
  const doublons = [...parDestinataire.entries()].filter(([, keys]) => keys.length > 1);

  if (multiples.length > 0 || parDestinataire.size > 0) {
    constats.push({
      controle: "DESTINATAIRES",
      ok: multiples.length === 0,
      message: multiples.length === 0
        ? `${parDestinataire.size} envoi(s) individuel(s), un destinataire chacun.`
        : `${multiples.length} étape(s) d'envoi portent plusieurs destinataires : les personnes `
          + `se verraient mutuellement en copie.`,
      stepKeys: multiples,
    });
  }

  if (doublons.length > 0) {
    constats.push({
      controle: "DOUBLONS",
      ok: false,
      message: `${doublons.length} destinataire(s) apparaissent dans plusieurs envois de la même `
        + `capacité : ${doublons.slice(0, 3).map(([k, v]) => `${k.split("::")[1]} (${v.join(", ")})`).join(" ; ")}.`,
      stepKeys: doublons.flatMap(([, v]) => v.slice(1)),
    });
  }

  // ── 3. LES REÇUS ────────────────────────────────────────────────────────────────────
  //
  // Un statut DONE dit que le code est passé. Un REÇU dit que le monde a changé. Sur un effet
  // externe, seul le second compte — c'est la différence entre « on a appelé l'envoi » et
  // « le fournisseur a accepté le message ».
  const sansRecu = mission.steps
    .filter((s) => s.status === "DONE" && !s.forEach && estEffetExterne(s.capability) && !s.receipt)
    .map((s) => s.key);
  if (mission.steps.some((s) => estEffetExterne(s.capability))) {
    constats.push({
      controle: "RECUS",
      ok: sansRecu.length === 0,
      message: sansRecu.length === 0
        ? "Chaque effet externe abouti porte son reçu."
        : `${sansRecu.length} effet(s) externe(s) marqués faits SANS reçu : rien ne prouve qu'ils `
          + `soient réellement partis.`,
      stepKeys: sansRecu,
    });
  }

  // ── 4. LES ARTEFACTS ────────────────────────────────────────────────────────────────
  const attendus = artefactsAttendus(mission);
  if (attendus.length > 0) {
    const enBase = await prisma.missionArtifact.findMany({
      where: { missionId: mission.id },
      select: { key: true, status: true, byteSize: true, title: true },
    });
    const parCle = new Map(enBase.map((a) => [a.key, a]));
    const manquants = attendus.filter((k) => {
      const a = parCle.get(k);
      return !a || a.status !== "VERIFIED" || a.byteSize <= 0;
    });
    constats.push({
      controle: "ARTEFACTS",
      ok: manquants.length === 0,
      message: manquants.length === 0
        ? `${attendus.length} livrable(s) produits et contrôlés.`
        : `${manquants.length} livrable(s) annoncés ne sont pas produits ou pas contrôlés : ${manquants.join(", ")}.`,
      stepKeys: [],
    });
  }

  // ── 5. COMPLÉTUDE ───────────────────────────────────────────────────────────────────
  constats.push({
    controle: "COMPLETUDE",
    ok: base.ok,
    message: base.resume,
    stepKeys: base.manquants.map((m) => m.key),
  });

  const echecs = constats.filter((c) => !c.ok);
  const aRejouer = [...new Set(echecs.flatMap((c) => c.stepKeys))];

  return {
    ok: echecs.length === 0,
    base,
    constats,
    aRejouer,
    resume: echecs.length === 0
      ? `Contrôle complet : ${constats.length} vérifications, aucune anomalie. ${base.resume}`
      : `Contrôle complet : ${echecs.length} anomalie(s) sur ${constats.length} vérifications — `
        + echecs.map((c) => c.controle).join(", ") + `. ${base.resume}`,
  };
}

function lireNombre(v: unknown, champ: string): number | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const x = (v as Record<string, unknown>)[champ];
  return typeof x === "number" ? x : null;
}

/** Les clés de livrables annoncées par le plan — lues de `planMeta`, pas devinées. */
function artefactsAttendus(mission: EtatMission): string[] {
  const meta = mission.planMeta;
  const liste = meta && Array.isArray(meta.expectedArtifacts) ? meta.expectedArtifacts : [];
  return liste
    .map((a) => (a && typeof a === "object" ? String((a as Record<string, unknown>).key ?? "") : ""))
    .filter(Boolean);
}
