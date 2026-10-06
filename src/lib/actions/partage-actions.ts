"use server";

import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity, ENTITY_MODULE } from "@/lib/entity-access";
import { resolveDriveAccess } from "@/lib/drive";
import { sendMessage } from "@/lib/actions/messaging-actions";
import { ROLE_LABELS } from "@/lib/labels";
import { ENTITY_TYPE_LABELS } from "@/lib/partage";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PARTAGER PAR LA MESSAGERIE — un seul geste, tous les modules.
 *
 * ── POURQUOI UNE SEULE ACTION, ET POURQUOI ELLE N'ÉCRIT PAS LE MESSAGE ELLE-MÊME ────────
 *
 * « Partager » depuis Legal, depuis Courriers, depuis Ad&Pro, depuis Regulatory, depuis le
 * Drive : cinq écrans, UN geste. Cinq implémentations divergeraient exactement là où ça coûte
 * — l'une accorderait la lecture du fichier, l'autre l'oublierait ; l'une vérifierait que
 * l'expéditeur voit l'objet, l'autre ferait confiance au formulaire.
 *
 * Et cette action-ci n'écrit PAS le message : elle prépare la conversation puis appelle
 * `sendMessage`, l'écrivain unique. C'est lui qui valide les pièces contre les droits Drive de
 * l'expéditeur, accorde la lecture aux destinataires, notifie, et émet le fait qui réveille
 * une mission en attente. Réécrire ces quatre gestes ici en ferait une seconde vérité, qui
 * prendrait du retard au premier correctif appliqué à l'autre (§118.5).
 *
 * ── CE QUE CETTE ACTION AJOUTE, ET QUE `sendMessage` NE PEUT PAS FAIRE ──────────────────
 *
 * `sendMessage` valide la FORME d'une référence (`parseRef` vérifie l'énumération) mais ne
 * vérifie pas que l'expéditeur VOIT l'enregistrement : dans la messagerie, la référence est du
 * contenu de son propre message. Ici, le partage part d'un écran métier et devient un geste de
 * diffusion — alors `canAccessEntity` répond par ENREGISTREMENT, pas par module. Un
 * utilisateur qui voit Regulatory ne voit pas forcément CE dossier : le verrou du pipeline, le
 * périmètre société, la confidentialité Legal en décident. Sans cette porte, deviner un
 * identifiant suffirait à faire apparaître le libellé d'un dossier chez quelqu'un d'autre.
 *
 * ── CE QUE ÇA N'EST PAS ─────────────────────────────────────────────────────────────────
 *
 * Pas un envoi EXTERNE : la messagerie interne écrit une ligne en base et notifie. Aucun
 * transport sortant, donc aucune interaction avec la garde de sortie.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que le panneau affiche d'une personne : de quoi la reconnaître, rien de plus. */
export interface PersonneDestinataire { id: string; name: string; role?: string | null; recent?: boolean }
/** Un groupe de la messagerie dont on est membre. */
export interface GroupePartage { id: string; title: string; memberCount: number }

export interface ResultatPartage {
  ok: boolean;
  /** La conversation où le partage a atterri — pour y emmener la personne. */
  conversationId?: string;
  error?: string;
}

const lireIds = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr)) return [...new Set(arr.filter((x): x is string => typeof x === "string" && x !== ""))];
  } catch { /* une liste séparée par des virgules reste une liste */ }
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
};

const fd = (f: FormData, k: string): string | null => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/**
 * LA CONVERSATION DIRECTE avec ce collègue — l'existante (à deux exactement), sinon une nouvelle : ouvrir un second fil
 * avec la même personne à chaque partage éparpillerait l'historique.
 */
async function conversationDirecte(expediteurId: string, autre: string): Promise<string> {
  const directes = await prisma.conversation.findMany({
    where: { type: "DIRECT", AND: [{ members: { some: { userId: expediteurId } } }, { members: { some: { userId: autre } } }] },
    select: { id: true, _count: { select: { members: true } } },
    take: 5,
  });
  const existante = directes.find((c) => c._count.members === 2);
  if (existante) return existante.id;
  const conv = await prisma.conversation.create({
    data: { type: "DIRECT", createdById: expediteurId, members: { create: [{ userId: expediteurId }, { userId: autre }] } },
    select: { id: true },
  });
  return conv.id;
}

export async function partagerParMessagerie(formData: FormData): Promise<ResultatPartage> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "CREATE")) return { ok: false, error: "Vous n'avez pas accès à la messagerie." };

  // UN GROUPE OU UN COLLÈGUE (Direction, 06/10) — pas une liste de gens qui fabrique un groupe à chaque partage.
  const groupeId = fd(formData, "groupeId");
  const collegueId = fd(formData, "collegueId");
  if (!groupeId === !collegueId) return { ok: false, error: "Choisissez un groupe OU un collègue." };
  if (collegueId) {
    if (collegueId === user.id) return { ok: false, error: "Choisissez un collègue, pas vous-même." };
    const actif = await prisma.user.findFirst({ where: { id: collegueId, isActive: true }, select: { id: true } });
    if (!actif) return { ok: false, error: "Ce collègue n'a pas de compte actif." };
  } else {
    // UN GROUPE DONT ON EST MEMBRE — la messagerie le revérifie à l'envoi (`sendMessage`).
    const groupe = await prisma.conversation.findFirst({
      where: { id: groupeId as string, type: { in: ["GROUP", "CHANNEL"] }, members: { some: { userId: user.id, leftAt: null } } },
      select: { id: true },
    });
    if (!groupe) return { ok: false, error: "Vous n'êtes pas membre de ce groupe." };
  }

  // ── L'OBJET PARTAGÉ, VÉRIFIÉ PAR ENREGISTREMENT ────────────────────────────────────────
  const typeBrut = fd(formData, "refType");
  const refId = fd(formData, "refId");
  let ref: { type: EntityType; id: string; label: string } | null = null;
  if (typeBrut && refId) {
    if (!(typeBrut in ENTITY_MODULE)) return { ok: false, error: "Type d'objet inconnu." };
    const type = typeBrut as EntityType;
    if (!(await canAccessEntity(user, type, refId, "VIEW")))
      // On ne dit pas « il n'existe pas » — on ne le sait pas, et l'affirmer serait un fait
      // non vérifié. On dit ce qu'on sait : cet élément-là ne vous est pas ouvert.
      return { ok: false, error: "Vous ne pouvez pas partager un élément auquel vous n'avez pas accès." };
    // LE DRIVE SE CONTRÔLE PAR NŒUD, ET `canAccessEntity` NE LE FAIT PAS : `DRIVE_NODE` n'a pas
    // de branche dans son aiguillage, donc il retombe sur le droit de MODULE — vrai pour tout
    // le monde dans le Drive. La porte par nœud vit dans `resolveDriveAccess`, celle-là même
    // que `sendMessage` applique aux pièces jointes ; sans cet appel, le partage d'une PIÈCE
    // serait gardé et celui de sa RÉFÉRENCE ne le serait pas — la même chose par deux portes,
    // dont une seule fermée.
    if (type === "DRIVE_NODE" && (await resolveDriveAccess(user, refId)) === "NONE")
      return { ok: false, error: "Vous ne pouvez pas partager un élément auquel vous n'avez pas accès." };
    ref = { type, id: refId, label: (fd(formData, "refLabel") ?? ENTITY_TYPE_LABELS[type] ?? "Élément").slice(0, 200) };
  }

  const driveRefs = lireIds(fd(formData, "driveRefs"));
  if (!ref && driveRefs.length === 0) return { ok: false, error: "Rien à partager." };

  const titre = ref?.label ?? "Partage";
  const conversationId = groupeId ?? (await conversationDirecte(user.id, collegueId as string));

  const note = (fd(formData, "note") ?? "").trim();
  const lien = fd(formData, "href");
  const corps = [
    note,
    ref ? `${ENTITY_TYPE_LABELS[ref.type] ?? "Élément"} : ${ref.label}${lien ? `\n${lien}` : ""}` : "",
  ].filter(Boolean).join("\n\n").trim();

  // L'ÉCRIVAIN UNIQUE. Les pièces du Drive lui sont passées TELLES QUELLES : c'est lui qui les
  // confronte aux droits réels de l'expéditeur, puis qui accorde la lecture aux destinataires.
  const envoi = new FormData();
  envoi.set("conversationId", conversationId);
  envoi.set("body", corps || `Partage : ${titre}`);
  if (driveRefs.length > 0) envoi.set("driveRefs", JSON.stringify(driveRefs));
  if (ref) {
    envoi.set("refType", ref.type);
    envoi.set("refId", ref.id);
    envoi.set("refLabel", ref.label);
  }
  const r = await sendMessage(envoi);
  if (!r.ok) return { ok: false, error: r.error ?? "Le partage n'a pas pu être envoyé." };

  return { ok: true, conversationId };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI PEUT RECEVOIR — chargé À L'OUVERTURE du panneau, jamais passé en accessoire.
 *
 * Le bouton de partage vit sur des LIGNES de tableau : Legal, Courriers, Ad&Pro, Regulatory,
 * le Drive. Faire descendre l'annuaire jusqu'à chaque ligne voudrait dire le charger une fois
 * par écran, le sérialiser dans le HTML de chaque page, et le faire traverser trois niveaux
 * d'accessoires — pour une liste que personne n'ouvre dans la très grande majorité des visites.
 *
 * On le charge donc au clic, une fois par panneau. Et c'est le MÊME annuaire que la messagerie
 * (`getDirectory`) : deux listes de « qui je peux contacter » divergeraient au premier compte
 * désactivé (§118.5). L'appelant garde le droit de fournir sa propre liste quand il en a une
 * meilleure — les responsables d'un événement, par exemple.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function listerDestinatairesPartage(): Promise<{ ok: boolean; groupes: GroupePartage[]; people: PersonneDestinataire[]; error?: string }> {
  const user = await requireUser();
  if (!userCan(user, "MESSAGING", "CREATE")) return { ok: false, groupes: [], people: [], error: "Vous n'avez pas accès à la messagerie." };
  // DEUX LECTURES LÉGÈRES (Direction, 06/10 : « le chargement ne s'arrête pas ») : les groupes dont on est membre — sans
  // leurs messages ni leurs membres —, et les collègues actifs avec, pour chacun, s'il existe déjà une conversation.
  const [groupes, collegues, directes] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: { in: ["GROUP", "CHANNEL"] }, isArchived: false, members: { some: { userId: user.id, leftAt: null } } },
      select: { id: true, title: true, _count: { select: { members: { where: { leftAt: null } } } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: { id: true, name: true, title: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.conversationMember.findMany({
      where: { conversation: { type: "DIRECT", members: { some: { userId: user.id } } }, userId: { not: user.id } },
      select: { userId: true },
    }),
  ]);
  const recents = new Set(directes.map((d) => d.userId));
  return {
    ok: true,
    groupes: groupes.map((g) => ({ id: g.id, title: g.title ?? "Groupe sans nom", memberCount: g._count.members })),
    people: collegues.map((u) => ({
      id: u.id,
      name: u.name,
      // Le titre d'abord : « Responsable Regulatory » distingue mieux deux homonymes que le
      // rôle RBAC, qui dit ce que le compte a le droit de faire, pas ce que la personne fait.
      role: u.title ?? ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? null,
      // UN COLLÈGUE AVEC QUI ON ÉCHANGE DÉJÀ est proposé d'emblée ; les autres se cherchent par leur nom.
      recent: recents.has(u.id),
    })),
  };
}