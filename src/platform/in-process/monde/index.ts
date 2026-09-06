import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { userCan, type Module } from "@/lib/rbac";
import { fermerIntervalles } from "@/lib/monde/temps";
import {
  changements, chronologie, contradictions, couverture, etatA, historique, auMoment, valideA, connuA,
  type Couverture, type Fait,
} from "@/lib/monde/faits";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DU MODÈLE DU MONDE (mandat 6 §45) — l'histoire déjà écrite, enfin lue comme telle.
 *
 * ── AUCUNE TABLE NOUVELLE, ET C'EST LE POINT ────────────────────────────────────────────
 *
 * Trois journaux existent déjà et personne ne les lisait comme une histoire :
 *
 *   · `AuditLog`      — « ce champ est passé de A à B, le 12 mars, par un tel ». Une suite de
 *                       ces lignes EST l'historique d'une propriété ; il suffit de fermer les
 *                       intervalles (`temps.ts`).
 *   · `BusinessEvent` — les faits métier datés, avec leur `occurredAt` distinct du `createdAt`
 *                       (le premier dit quand c'est arrivé, le second quand on l'a inscrit).
 *   · `EntityLink`    — les relations déclarées entre entités.
 *
 * Une table « WorldFact » aurait dupliqué tout cela, aurait divergé, et à la première divergence
 * personne n'aurait su laquelle croire (§17).
 *
 * ── CE QUE LE PONT AJOUTE, ET QUI NE PEUT PAS ÊTRE AILLEURS ─────────────────────────────
 *
 * Les DROITS. Le modèle du monde est une lecture transverse : sans garde, il rendrait l'histoire
 * d'un dossier Finance à qui n'a pas le module Finance. Chaque entité est donc rattachée à son
 * module, et une entité dont le module n'est pas ouvert n'est pas « vide » — elle est REFUSÉE,
 * et la réponse le dit. « Rien trouvé » et « pas le droit de regarder » ne sont pas la même
 * phrase.
 *
 * ── ET CE QU'IL NE PEUT PAS FAIRE, DIT PLUTÔT QUE MASQUÉ ────────────────────────────────
 *
 * Le journal ne contient que ce qui a été TRACÉ. Les champs jamais journalisés arrivent en
 * `histoire: "COURANTE"` : leur valeur d'aujourd'hui est connue, leur passé ne l'est pas, et
 * interroger une date antérieure rend INCONNU. C'est la seule réponse qui ne mente pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le module qui garde chaque type d'entité — la même porte que l'écran correspondant. */
const MODULE_DE: Record<string, Module> = {
  PAYMENT_REQUEST: "VALIDATIONS",
  EXPENSE_ORDER: "FINANCES",
  LEGAL_DOCUMENT: "LEGAL",
  REGULATORY_PRODUCT: "REGULATORY",
  TASK: "WORKSPACE",
  EMPLOYEE: "RH",
  DRIVE_NODE: "DRIVE",
};

/** Les prédicats qui n'admettent qu'une valeur à la fois — ceux dont un doublon est une faute. */
export const FONCTIONNELS = new Set([
  "statut", "status", "responsable", "assignedTo", "priorite", "priority", "montant", "amount",
  "prix", "price", "echeance", "dueDate", "etat", "centralStatus", "fabrication",
]);

/** Le plafond de lignes de journal lues pour un sujet. Une histoire bornée qui dit sa borne. */
export const LIGNES_MAX = 2_000;

export interface MondeSujet {
  sujet: string;
  libelle: string;
  type: string;
  lien: string;
  creeLe: Date;
  faits: Fait[];
  couverture: Couverture;
}

export type MondeReponse = MondeSujet | { erreur: string; suite?: string };

const nomActeur = (a: { name: string } | null | undefined): string | null => a?.name ?? null;

/**
 * COMPOSE LES FAITS D'UN SUJET.
 *
 * L'ordre des sources n'est pas indifférent : le journal d'audit d'abord (c'est lui qui porte
 * l'HISTOIRE), puis les valeurs actuelles pour les seuls champs qu'il ne couvre pas, puis les
 * événements métier et les relations. Prendre les valeurs actuelles en premier écraserait
 * l'histoire par le présent — exactement ce que ce module existe pour éviter.
 */
export async function faitsDe(user: CurrentUser, ref: string): Promise<MondeReponse> {
  const { resolveRecord } = await import("@/lib/assistant/time-travel");
  const rec = await resolveRecord(ref.trim());
  if (!rec) return { erreur: `Aucun dossier ne correspond à « ${ref} ».`, suite: "Donnez sa référence exacte, ou cherchez-le d'abord." };

  const module = MODULE_DE[rec.entityType];
  if (module && !userCan(user, module, "VIEW")) {
    return { erreur: `Ce dossier relève du module ${module}, qui ne vous est pas ouvert.`, suite: "Ce n'est pas une absence d'information : c'est un droit. Demandez l'accès si vous en avez besoin." };
  }

  const sujet = `${rec.entityType}:${rec.id}`;
  const lignes = await prisma.auditLog.findMany({
    where: { entityType: rec.entityType as never, entityId: rec.id, field: { not: null } },
    select: { id: true, field: true, oldValue: true, newValue: true, createdAt: true, actor: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: LIGNES_MAX,
  });

  const faits: Fait[] = [];
  const journalises = new Set<string>();

  // ── 1. L'HISTOIRE, champ par champ ────────────────────────────────────────────────────
  const parChamp = new Map<string, typeof lignes>();
  for (const l of lignes) {
    if (!l.field) continue;
    const liste = parChamp.get(l.field) ?? [];
    liste.push(l);
    parChamp.set(l.field, liste);
  }
  for (const [champ, suite] of parChamp) {
    journalises.add(champ);
    const premiere = suite[0]!;
    const tranches = fermerIntervalles(
      suite.filter((l) => l.newValue !== null).map((l) => ({
        valeur: l.newValue!, quand: l.createdAt, source: `AuditLog#${l.id}`, acteur: nomActeur(l.actor),
      })),
      {
        debut: rec.creeLe,
        // LA VALEUR D'AVANT LE PREMIER CHANGEMENT vit dans `oldValue` de la première ligne. Sans
        // elle, la période la plus longue de l'histoire — celle d'origine — disparaîtrait.
        ...(premiere.oldValue !== null ? { valeurInitiale: premiere.oldValue, sourceInitiale: `AuditLog#${premiere.id} (valeur antérieure)` } : {}),
      },
    );
    for (const t of tranches) {
      faits.push({
        sujet, sujetLibelle: rec.titre, predicat: champ, objet: t.valeur,
        depuis: t.depuis, jusqua: t.jusqua,
        // Le journal est écrit AU MOMENT du changement : validité et constat coïncident ici.
        constateLe: t.depuis ?? rec.creeLe,
        source: t.source, acteur: t.acteur, histoire: "JOURNALISEE", confiance: 1,
      });
    }
  }

  // ── 2. LES VALEURS ACTUELLES des champs SANS histoire ─────────────────────────────────
  const maintenant = new Date();
  for (const [champ, valeur] of Object.entries(rec.etatActuel)) {
    if (valeur === null || valeur === undefined || valeur === "") continue;
    if (journalises.has(champ)) continue;
    faits.push({
      sujet, sujetLibelle: rec.titre, predicat: champ, objet: String(valeur),
      depuis: null, jusqua: null, constateLe: maintenant,
      source: `ERP:${rec.entityType}.${champ} (non journalisé)`, acteur: null,
      histoire: "COURANTE", confiance: 0.7,
    });
  }

  // ── 3. LES FAITS MÉTIER — datés à `occurredAt`, jamais à leur inscription ──────────────
  const evenements = await prisma.businessEvent.findMany({
    where: { OR: [{ entityType: rec.entityType as never, entityId: rec.id }, { relatedRefs: { has: sujet } }] },
    select: { id: true, type: true, occurredAt: true, createdAt: true, sourceDomain: true, actor: { select: { name: true } } },
    orderBy: { occurredAt: "asc" },
    take: 500,
  });
  for (const e of evenements) {
    faits.push({
      sujet, sujetLibelle: rec.titre, predicat: "evenement", objet: e.type,
      // UN ÉVÉNEMENT EST PONCTUEL : il ne « dure » pas. `jusqua = depuis` le dit, plutôt qu'un
      // intervalle ouvert qui le ferait apparaître comme un état encore en cours.
      depuis: e.occurredAt, jusqua: e.occurredAt,
      constateLe: e.createdAt, source: `BusinessEvent#${e.id} (${e.sourceDomain})`,
      acteur: nomActeur(e.actor), histoire: "JOURNALISEE", confiance: 1,
    });
  }

  // ── 4. LES RELATIONS DÉCLARÉES ────────────────────────────────────────────────────────
  const liens = await prisma.entityLink.findMany({
    where: { OR: [{ fromType: rec.entityType as never, fromId: rec.id }, { toType: rec.entityType as never, toId: rec.id }] },
    select: { id: true, fromType: true, fromId: true, fromLabel: true, toType: true, toId: true, toLabel: true, note: true, createdAt: true },
    take: 200,
  });
  for (const l of liens) {
    const versMoi = l.toType === rec.entityType && l.toId === rec.id;
    const autre = versMoi ? `${l.fromType}:${l.fromId}` : `${l.toType}:${l.toId}`;
    const libelle = (versMoi ? l.fromLabel : l.toLabel) ?? autre;
    faits.push({
      sujet, sujetLibelle: rec.titre, predicat: "rattache_a", objet: `${libelle}${l.note ? ` (${l.note})` : ""}`,
      // UN LIEN N'A PAS DE FIN DÉCLARÉE dans le modèle : `jusqua` reste ouvert, et c'est honnête —
      // le jour où un lien portera une date de fin, elle se lira ici sans changer le reste.
      depuis: l.createdAt, jusqua: null, constateLe: l.createdAt,
      source: `EntityLink#${l.id}`, acteur: null, histoire: "JOURNALISEE", confiance: 1,
    });
  }

  return {
    sujet, libelle: rec.titre, type: rec.type, lien: rec.lien, creeLe: rec.creeLe,
    faits, couverture: couverture(faits),
  };
}

/** L'état d'un sujet À UNE DATE — avec ce qui reste inconnu à cette date. */
export async function etatAuMoment(user: CurrentUser, ref: string, quand: Date): Promise<MondeReponse & { etat?: ReturnType<typeof etatA> }> {
  const m = await faitsDe(user, ref);
  if ("erreur" in m) return m;
  return { ...m, etat: etatA(m.faits, m.sujet, quand) };
}

/** « Qui était responsable au moment de… » — la valeur d'UN prédicat à UN instant. */
export async function quiEtait(user: CurrentUser, ref: string, predicat: string, quand: Date): Promise<{ erreur: string } | { fait: Fait | null; histoire: Fait[]; couverture: Couverture; libelle: string }> {
  const m = await faitsDe(user, ref);
  if ("erreur" in m) return m;
  return { fait: auMoment(m.faits, m.sujet, predicat, quand), histoire: historique(m.faits, m.sujet, predicat), couverture: m.couverture, libelle: m.libelle };
}

/** « Qu'est-ce qui a changé depuis… » sur un sujet. */
export async function changementsDe(user: CurrentUser, ref: string, depuis: Date, jusqua?: Date) {
  const m = await faitsDe(user, ref);
  if ("erreur" in m) return m;
  return { libelle: m.libelle, changements: changements(m.faits, depuis, jusqua), couverture: m.couverture };
}

/** La chronologie complète, et les contradictions que le journal contient. */
export async function recitDe(user: CurrentUser, ref: string) {
  const m = await faitsDe(user, ref);
  if ("erreur" in m) return m;
  return {
    libelle: m.libelle, lien: m.lien, creeLe: m.creeLe,
    chronologie: chronologie(m.faits, m.sujet),
    contradictions: contradictions(m.faits, FONCTIONNELS),
    couverture: m.couverture,
  };
}

/** Ce qui était VRAI et ce qu'on SAVAIT à une date — les deux réponses, côte à côte. */
export async function vraiEtSu(user: CurrentUser, ref: string, quand: Date) {
  const m = await faitsDe(user, ref);
  if ("erreur" in m) return m;
  const vrai = valideA(m.faits, quand);
  const su = connuA(m.faits, quand);
  const nomsSu = new Set(su.map((f) => `${f.predicat}|${f.objet}`));
  return {
    libelle: m.libelle,
    vrai, su,
    // CE QUI ÉTAIT VRAI SANS QU'ON LE SACHE — la saisie en retard, et la seule façon de juger
    // équitablement une décision prise ce jour-là.
    vraiMaisIgnore: vrai.filter((f) => !nomsSu.has(`${f.predicat}|${f.objet}`)),
    couverture: m.couverture,
  };
}
