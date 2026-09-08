import { prisma } from "@/lib/prisma";
import type { EtatMission } from "@/lib/missions/runtime/store";
import { controlerQualite, type EtapeObservee, type RapportQA } from "@/lib/missions/goal/evaluate";
import { EFFECT_RANK, capabilityMeta, type Effect } from "@/lib/missions/registry/capability-meta";
import { lireReponse } from "@/lib/missions/runtime/reponse";

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
  "RETOURS_PERDUS",
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

/**
 * « CETTE ÉTAPE A-T-ELLE UN EFFET EXTERNE ? » — le REÇU d'abord, le registre nu ensuite.
 *
 * Le reçu porte l'effet que le catalogue du composeur a déclaré au moment de l'appel : c'est
 * l'observation. `capabilityMeta(nom)` sans liste d'écritures rend le défaut prudent
 * (EXTERNAL_COMMUNICATION) pour toute lecture qu'aucun préfixe ne reconnaît — juste pour
 * demander un accord, faux pour juger un effet : une lecture `find_documents` se voyait
 * réclamer un reçu d'intent, et le contrôle comptait une anomalie sur une mission sans écriture.
 */
const estEffetExterne = (s: { capability: string | null; recu?: { effect: Effect } | null }): boolean => {
  if (!s.capability) return false;
  const effet = s.recu?.effect ?? capabilityMeta(s.capability).effect;
  return EFFECT_RANK[effet] >= EFFECT_RANK.EXTERNAL_COMMUNICATION;
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
 * CE QUE LA PERSONNE A ÉCRIT — et RIEN d'autre de l'enveloppe.
 *
 * Premier essai : les chiffres de tout le résultat sérialisé. Trois tests d'architecture sont
 * tombés, et ils avaient raison — un fait dont le payload portait `documents: ["CDI-2026-014"]`
 * se voyait reprocher la disparition de « 014 ». Une référence de pièce jointe n'est pas un
 * fait que la mission promet de reporter ; la PHRASE d'une personne, si. On ne lit donc que
 * `contenu` (corps + sujet), le champ que `lireReponse` garantit toujours présent.
 */
function paroleDe(result: unknown): string {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "";
  const o = result as Record<string, unknown>;
  if (typeof o.contenu === "string") return o.contenu;
  return lireReponse(o.payload).contenu;
}

/** Les nœuds qui recueillent la parole d'une personne. Leur résultat EST ce qu'elle a dit. */
const NOEUDS_ATTENTE = new Set(["WAIT_EVENT", "WAIT_INPUT"]);

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES FAITS CHIFFRÉS D'UN TEXTE — même lecture des deux côtés, sinon la comparaison ment.
 *
 * « 84 500 » écrit à la française se recolle sur UNE espace ; deux valeurs voisines séparées
 * par plus d'une espace ne se recollent pas en un nombre qui n'a jamais existé. Les millésimes
 * (1900-2099) sont écartés : ils sont dans la demande, les retrouver ne prouve rien. Sous trois
 * chiffres, un nombre n'identifie rien — un « 3 » se retrouve partout par hasard.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function faitsChiffres(texte: string): string[] {
  let t = texte;
  for (let k = 0; k < 4; k += 1) t = t.replace(/(\d)[   ](\d{3})(?!\d)/g, "$1$2");
  const vus = (t.match(/\d[\d.,]*/g) ?? [])
    .map((x) => x.replace(/[^0-9]/g, ""))
    .filter((x) => x.length >= 3 && !/^(19|20)\d\d$/.test(x));
  return [...new Set(vus)];
}

/**
 * LE CONTRÔLE COMPLET.
 *
 * Il lit la base pour les artefacts, et rien d'autre : tout le reste est déjà dans l'état de la
 * mission qu'on lui passe. C'est délibéré — un contrôle qui refait ses propres requêtes pourrait
 * voir un état différent de celui que le moteur vient de décider.
 */
export async function controleComplet(
  mission: EtatMission,
  opts: { portee?: ReadonlySet<string> } = {},
): Promise<RapportComplet> {
  /**
   * ── UN CONTRÔLE JUGE CE QU'IL PEUT VOIR : SES ANCÊTRES ────────────────────────────────
   *
   * MESURÉ sur la chaîne humaine live. Le plan plaçait « Vérifier la présence des deux
   * livrables » AU MILIEU du graphe, avec « Informer Yacine » APRÈS. Le contrôle a compté
   * `notification:yacine` parmi les étapes manquantes — une étape qui DÉPEND DE LUI et qui,
   * par construction, ne peut pas être finie avant qu'il ait rendu son verdict. Verdict :
   * « 15/16 étapes effectives abouties, 1 manquante », mission BLOQUÉE. Les deux fichiers
   * étaient produits et s'ouvraient.
   *
   * Un contrôle placé ailleurs qu'en dernier était donc STRUCTURELLEMENT condamné : il se
   * reprochait son propre aval. Ce n'est pas une tolérance qu'on ajoute, c'est une portée
   * qu'on corrige — un nœud QA affirme « tout ce dont je dépends a abouti », jamais « la
   * mission est finie », ce qu'il n'est pas en position de savoir.
   *
   * `portee` absente = la mission entière : c'est le contrôle de FIN, qui a le droit et le
   * devoir de tout regarder. La préséance négative (§10) ne change pas d'un iota — un contrôle
   * dans sa portée peut toujours interdire de conclure.
   */
  const dansPortee = (k: string): boolean => !opts.portee || opts.portee.has(k);
  const steps = observer(mission).filter((s) => dansPortee(s.key));
  const base = controlerQualite(steps, contourneesDe(mission));
  const constats: Constat[] = [];

  // ── 1. CARDINALITÉ DES ÉVENTAILS ────────────────────────────────────────────────────
  //
  // Le modèle d'un éventail annonce un nombre ; les filles existent ou non. Un écart signifie
  // qu'une itération n'a jamais été créée — donc qu'une personne n'a jamais rien reçu, sans
  // qu'aucune étape ne soit en échec. C'est le silence le plus dangereux du runtime.
  for (const s of mission.steps) {
    if (!s.forEach || !dansPortee(s.key)) continue;
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
    if (!dansPortee(s.key)) continue;
    if (s.forEach) continue; // le modèle n'envoie rien : ses filles le font
    if (!estEffetExterne(s)) continue;
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
    .filter((s) => dansPortee(s.key) && s.status === "DONE" && !s.forEach && estEffetExterne(s) && !s.receipt)
    .map((s) => s.key);
  if (mission.steps.some((s) => dansPortee(s.key) && estEffetExterne(s))) {
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

  /**
   * ── 4. LES ARTEFACTS — DANS LA PORTÉE, comme tout le reste ───────────────────────────
   *
   * MESURÉ sur la chaîne budgétaire : un nœud QA placé au milieu du graphe exigeait TOUS les
   * livrables annoncés par le plan, y compris ceux que produisent des étapes situées APRÈS lui.
   * « 2/2 étapes effectives abouties » et pourtant « 1 anomalie — ARTEFACTS » : le document
   * Word existait et s'ouvrait, il n'était simplement pas encore fabriqué au moment du contrôle.
   *
   * C'est le même défaut que la complétude, corrigé un cran plus loin — et il avait survécu
   * parce que ce contrôle-là ne lit pas les étapes mais `planMeta`. Un contrôle ne réclame que
   * les pièces que SES ancêtres devaient produire.
   */
  const attendus = artefactsAttendus(mission).filter((k) => {
    if (!opts.portee) return true;
    const liste = Array.isArray(mission.planMeta?.expectedArtifacts) ? mission.planMeta!.expectedArtifacts : [];
    const decl = (liste as unknown[]).find((a) =>
      a && typeof a === "object" && !Array.isArray(a) && (a as Record<string, unknown>).key === k);
    const from = decl && typeof (decl as Record<string, unknown>).fromStep === "string"
      ? String((decl as Record<string, unknown>).fromStep) : null;
    // Un livrable dont le plan ne dit PAS quelle étape le produit reste exigible partout :
    // on ne relâche jamais une exigence faute de savoir où la placer.
    return !from || opts.portee.has(from);
  });
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

  // ── 5. LES RETOURS COLLECTÉS SURVIVENT-ILS ? ────────────────────────────────────────
  //
  // ── LE FAUX SUCCÈS PARFAIT, MESURÉ SUR LA CHAÎNE HUMAINE LIVE (§89) ──────────────────
  //
  // Khaled Mansouri répond « Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD ;
  // forecast 2027 : 1 240 et 890 unités ». Sofiane Kaci répond « AO-2026-114 … AO-2026-131 ».
  // Les deux attentes se règlent, et le moteur fait EXACTEMENT son travail : l'étape de
  // consolidation reçoit les deux payloads dans son entrée — vérifié dans `WorkerRun.input`,
  // « 84 500 » y est. Sa sortie écrit pourtant :
  //
  //     « Commercial : prix de cession en DZD, forecast et hypothèses NON FOURNIS. »
  //     « Khaled Mansouri a été sollicité … ; AUCUN RETOUR n'est fourni. »
  //
  // Les deux livrables ont été bâtis là-dessus : 0 chiffre du jeu d'essai sur 6 dans le
  // classeur, 0 sur 6 dans le deck. Toutes les étapes vertes, les fichiers s'ouvrent, la QA
  // passe. C'est le faux succès le plus coûteux qui soit : la mission a dérangé quatre
  // personnes, reçu leurs réponses, et livré un document qui déclare ne rien avoir reçu.
  //
  // ── POURQUOI CE CONTRÔLE NE PEUT PAS ÊTRE UNE TAUTOLOGIE (§118.17) ───────────────────
  //
  // On ne regarde QUE des SORTIES. Chercher le chiffre dans les ENTRÉES le trouverait toujours
  // — c'est le moteur qui les y a mises, et le contrôle serait vrai garde armée ou non. La
  // seule exception est l'entrée d'une étape à effet EXTERNE qui a abouti : là, le fait a
  // quitté le système vers une personne, ce qui est bien une survie.
  //
  // Le seuil est le plus prudent qui existe : on n'exige pas que chaque chiffre survive, mais
  // qu'AU MOINS UN survive quelque part. Une consolidation choisit ce qu'elle montre ; elle ne
  // choisit pas d'oublier tout ce qu'on vient de lui donner.
  const attentes = mission.steps
    .filter((s) => dansPortee(s.key) && NOEUDS_ATTENTE.has(s.nodeType) && s.status === "DONE" && s.result)
    .map((s) => ({ step: s, apportes: faitsChiffres(paroleDe(s.result)) }));
  if (attentes.length > 0) {
    const sorties = mission.steps
      .filter((s) => dansPortee(s.key) && s.status === "DONE" && !NOEUDS_ATTENTE.has(s.nodeType))
      .map((s) => JSON.stringify(s.result ?? null)
        + (estEffetExterne(s) ? ` ${JSON.stringify(s.input ?? null)}` : ""))
      .join(" ");
    const chiffresDesSorties = new Set(faitsChiffres(sorties));
    const perdues = attentes.filter((a) =>
      a.apportes.length > 0 && !a.apportes.some((c) => chiffresDesSorties.has(c)));
    // Aucune sortie downstream du tout : il n'y a rien à reprocher, la mission n'a pas fini.
    if (sorties.length > 2) {
      constats.push({
        controle: "RETOURS_PERDUS",
        ok: perdues.length === 0,
        message: perdues.length === 0
          ? `${attentes.length} retour(s) humain(s) recueilli(s) : leurs chiffres se retrouvent en aval.`
          : `${perdues.length} retour(s) humain(s) recueilli(s) puis PERDU(S) — aucun de leurs chiffres `
            + `n'apparaît dans une seule sortie de la mission : `
            + perdues.map((a) => `« ${a.step.title} » (${a.apportes.slice(0, 4).join(", ")})`).join(" ; ")
            + `. La personne a répondu et la mission conclut sans sa réponse.`,
        stepKeys: perdues.map((a) => a.step.key),
      });
    }
  }

  // ── 6. COMPLÉTUDE ───────────────────────────────────────────────────────────────────
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
