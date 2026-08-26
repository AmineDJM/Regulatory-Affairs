import { normalizeUtterance } from "@/lib/assistant/voice/fast-path";
import type { VoiceRouteKind } from "@/lib/assistant/voice/fast-path";
import type { Domain, RouterContext } from "./router";

/**
 * CE QUE LA CONVERSATION SAIT DÉJÀ — minuscule, vivant, et suffisant.
 *
 * LE DÉFAUT QU'ON FERME. « Relance-la. » Trois mots, et Adam ne sait pas qui est « la ». Il
 * repart alors chercher dans toute l'entreprise, ou pire, il demande. Un chef de cabinet à qui
 * l'on doit répéter le nom de la personne dont on parlait il y a dix secondes n'est pas un chef
 * de cabinet.
 *
 * CE QUE CE MODULE N'EST PAS. Ce n'est pas une mémoire : la mémoire persiste ailleurs, avec sa
 * provenance et ses droits. C'est un TAMPON DE QUELQUES LIGNES qui suit la conversation en cours.
 * §15 le dit — « a tiny live WorkingSet » — et la petitesse est une propriété, pas une limite :
 * un jeu de travail qui grossit redevient ce qu'on cherchait à éviter, un gros bloc versé dans
 * chaque prompt.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * LES BRANCHES (§16) — la partie qui demande de la retenue.
 *
 * Le PDG parle de Nintedanib, bifurque sur les finances, puis dit « Revenons à Deepak ». Trois
 * fils vivent en parallèle dans sa tête. La tentation serait de tout garder et de tout verser au
 * modèle « au cas où » : c'est exactement ce que §16 interdit — « Do not carry every prior branch
 * into every prompt ».
 *
 * D'où le compromis tenu ici : PLUSIEURS branches sont CONSERVÉES, UNE SEULE est ACTIVE, et seule
 * l'active est versée au contexte. Les autres attendent qu'on les rappelle par leur nom. Une
 * branche suspendue ne coûte rien au prompt ; elle ne coûte qu'un peu de mémoire serveur.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Ce qu'un pronom peut désigner. */
export type ReferentKind = "person" | "record" | "document" | "mission" | "thread";

export interface Referent {
  kind: ReferentKind;
  /** L'identifiant canonique quand on l'a — c'est lui qui permet d'agir sans re-chercher. */
  id?: string | null;
  /** Ce que le PDG a dit ou entendu : « Raihana », « Raltegravir ». */
  label: string;
  /** Le domaine dont il relève — sert à orienter le routeur au tour suivant. */
  domain?: Domain;
  /** Dernière mention. Le plus récent l'emporte pour résoudre un pronom. */
  at: number;
}

export interface Branch {
  /** Le nom du fil, normalisé : « deepak », « nintedanib », « tresorerie ». */
  topic: string;
  /** Ce dont on parle dans CE fil — borné, le plus récent d'abord. */
  referents: Referent[];
  /** La dernière forme empruntée ici — « et X ? » la reprend. */
  lastKind?: VoiceRouteKind | null;
  openedAt: number;
  touchedAt: number;
}

export interface WorkingSet {
  /** Le fil actif. C'est le SEUL versé au contexte. */
  current: string;
  branches: Branch[];
  /** Une intention d'envoi préparée attend-elle une approbation ? (le serveur le sait) */
  pendingMailIntentId?: string | null;
  /** Un résultat est-il en cours de production ? (« alors ? » n'a de sens que si oui) */
  openDeliveryId?: string | null;
}

/** Deux garde-fous de taille. Les dépasser, c'est retomber dans le gros bloc générique. */
export const MAX_BRANCHES = 5;
export const MAX_REFERENTS_PER_BRANCH = 6;

export const emptyWorkingSet = (now: number = Date.now()): WorkingSet => ({
  current: "general",
  branches: [{ topic: "general", referents: [], lastKind: null, openedAt: now, touchedAt: now }],
});

const findBranch = (ws: WorkingSet, topic: string): Branch | undefined =>
  ws.branches.find((b) => b.topic === topic);

export const currentBranch = (ws: WorkingSet): Branch =>
  findBranch(ws, ws.current) ?? ws.branches[0];

/**
 * « REVENONS À DEEPAK. » — la reprise explicite d'un fil suspendu.
 *
 * Reconnue par la forme, pas devinée : le PDG le dit clairement quand il le fait, et une reprise
 * inventée (« il a changé de sujet, je restaure une vieille branche ») serait bien plus
 * déroutante qu'une reprise manquée.
 */
const RESUME = /\b(revenons|reviens|reprenons|reprends|on reprend|pour en revenir)\s+(?:a|au|aux|sur|sur le|sur la|sur les)\s+(.+)$/;

/** Les mots de liaison qui restent collés au sujet — « reprenons SUR LE Nintedanib ». */
const TOPIC_NOISE = /^(?:(?:sur|a|au|aux|de|du|des|le|la|les|l|mon|ma|mes|ce|cet|cette|notre|nos)\s+)+/;

export function detectBranchResume(utterance: string): string | null {
  const m = RESUME.exec(normalizeUtterance(utterance));
  if (!m) return null;
  const topic = m[2].trim().replace(TOPIC_NOISE, "").trim();
  return topic.length >= 3 ? topic : null;
}

/**
 * ENREGISTRER CE QUE CE TOUR A APPRIS.
 *
 * Trois choses seulement : sur quel fil on est, qui/quoi vient d'être nommé, et quelle forme on a
 * empruntée. Le reste — la réponse, les preuves, les outils appelés — n'a pas sa place ici : ce
 * sont des résultats, pas du contexte de conversation.
 */
export function observe(
  ws: WorkingSet,
  input: {
    utterance: string;
    referents?: Referent[];
    lastKind?: VoiceRouteKind | null;
    /** Le fil auquel rattacher ce tour. Par défaut : le fil actif. */
    topic?: string | null;
  },
  now: number = Date.now(),
): WorkingSet {
  // Une reprise explicite change de fil AVANT d'enregistrer quoi que ce soit.
  const resumed = detectBranchResume(input.utterance);
  let next = resumed ? switchBranch(ws, resumed, now) : ws;

  const topic = input.topic ?? next.current;
  if (topic !== next.current) next = switchBranch(next, topic, now);

  const branches = next.branches.map((b) => {
    if (b.topic !== next.current) return b;
    const merged = [...(input.referents ?? []).map((r) => ({ ...r, at: now })), ...b.referents];
    // Un même libellé ne compte qu'une fois : c'est la mention la PLUS RÉCENTE qui gagne, parce
    // que c'est elle que « la » ou « lui » désigne.
    const seen = new Set<string>();
    const referents: Referent[] = [];
    for (const r of merged) {
      const key = `${r.kind}:${r.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      referents.push(r);
      if (referents.length >= MAX_REFERENTS_PER_BRANCH) break;
    }
    return { ...b, referents, lastKind: input.lastKind ?? b.lastKind, touchedAt: now };
  });

  return compact({ ...next, branches }, now);
}

/** Ouvrir ou reprendre un fil. Un fil déjà connu garde ce qu'il savait — c'est tout l'intérêt. */
export function switchBranch(ws: WorkingSet, topic: string, now: number = Date.now()): WorkingSet {
  const key = normalizeUtterance(topic) || "general";
  const existing = findBranch(ws, key);
  if (existing) {
    return {
      ...ws, current: key,
      branches: ws.branches.map((b) => (b.topic === key ? { ...b, touchedAt: now } : b)),
    };
  }
  return {
    ...ws, current: key,
    branches: [...ws.branches, { topic: key, referents: [], lastKind: null, openedAt: now, touchedAt: now }],
  };
}

/**
 * BORNER. On garde les fils les plus récemment touchés, jamais plus de `MAX_BRANCHES`.
 *
 * Le fil ACTIF et le fil « general » survivent toujours : perdre l'actif en pleine phrase serait
 * absurde, et « general » est le point de repli quand tout le reste a expiré.
 */
export function compact(ws: WorkingSet, now: number = Date.now(), max: number = MAX_BRANCHES): WorkingSet {
  if (ws.branches.length <= max) return ws;
  const protege = new Set([ws.current, "general"]);
  const tries = [...ws.branches].sort((a, b) => b.touchedAt - a.touchedAt);
  const kept: Branch[] = [];
  for (const b of tries) {
    if (kept.length < max || protege.has(b.topic)) kept.push(b);
  }
  void now;
  return { ...ws, branches: kept };
}

/**
 * RÉSOUDRE « LA », « LUI », « CELUI-LÀ ».
 *
 * Le genre du pronom sert de filtre quand il apporte quelque chose, mais il ne fait pas loi : les
 * prénoms de ce registre sont algériens, indiens, français, et rien ne garantit qu'un prénom
 * révèle un genre. En cas de doute, on rend le référent le plus récent DU BON TYPE plutôt que
 * rien — un chef de cabinet qui hésite sur le genre mais désigne la bonne personne est utile ;
 * un chef de cabinet qui ne désigne personne ne l'est pas.
 */
const PRONOUN_TO_KIND: [RegExp, ReferentKind[]][] = [
  [/\b(la|le|lui|leur|les|l)\b\s*$/, ["person", "record", "document", "mission", "thread"]],
  [/\b(celui la|celle la|celui ci|celle ci|ce dernier|cette derniere)\b/, ["record", "document", "person"]],
  [/\b(il|elle|ils|elles)\b/, ["person"]],
];

export function resolveReferent(ws: WorkingSet, utterance: string): Referent | null {
  const text = normalizeUtterance(utterance);
  const branch = currentBranch(ws);
  if (!branch || branch.referents.length === 0) return null;

  for (const [re, kinds] of PRONOUN_TO_KIND) {
    if (!re.test(text)) continue;
    const hit = branch.referents.find((r) => kinds.includes(r.kind));
    if (hit) return hit;
  }
  return null;
}

/** Le référent le plus récent d'un type donné — pour « et X ? » et pour l'aiguillage. */
export function latest(ws: WorkingSet, kind: ReferentKind): Referent | null {
  return currentBranch(ws)?.referents.find((r) => r.kind === kind) ?? null;
}

/**
 * CE QUE LE ROUTEUR REÇOIT — et rien de plus.
 *
 * Le jeu de travail connaît plusieurs fils ; le routeur n'en voit qu'un. C'est la traduction
 * concrète de « ne pas porter toutes les branches dans chaque prompt ».
 */
export function toRouterContext(ws: WorkingSet): RouterContext {
  const branch = currentBranch(ws);
  const person = latest(ws, "person");
  const record = latest(ws, "record") ?? latest(ws, "document");
  return {
    lastPerson: person?.label ?? null,
    lastSubject: record?.label ?? null,
    lastKind: branch?.lastKind ?? null,
    hasPendingMail: Boolean(ws.pendingMailIntentId),
    hasOpenDelivery: Boolean(ws.openDeliveryId),
    knownEntities: branch?.referents
      .filter((r) => r.domain)
      .map((r) => ({ name: r.label, domain: r.domain as Domain })),
  };
}

/**
 * Le jeu de travail, écrit pour le prompt. Volontairement TRÈS court — quelques dizaines de
 * tokens : c'est un rappel, pas un dossier.
 */
export function renderWorkingSet(ws: WorkingSet): string {
  const branch = currentBranch(ws);
  if (!branch || branch.referents.length === 0) return "";
  const items = branch.referents.slice(0, 4).map((r) => r.label).join(", ");
  const suspendues = ws.branches.filter((b) => b.topic !== ws.current && b.referents.length > 0);
  const rappel = suspendues.length > 0
    ? ` — fils en attente : ${suspendues.map((b) => b.topic).slice(0, 3).join(", ")}`
    : "";
  return `EN COURS : ${items}${rappel}`;
}
