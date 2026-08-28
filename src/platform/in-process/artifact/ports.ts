/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE COMPOSEUR DU LIVE OFFICE — le seul endroit où `artifact/` rencontre le Drive.
 *
 * ── POURQUOI ICI, ET PAS DANS `artifact/` ───────────────────────────────────────────────
 *
 * Même dessein que `in-process/missions/` : le domaine déclare des PORTS, le pont les remplit.
 * Trois conséquences vérifiables :
 *
 *   • `artifact/` n'importe ni Prisma, ni `drive-storage` (un FOURNISSEUR au sens de
 *     `domains.ts`), ni `rbac` — donc aucune traversée de domaine, aucun cliquet ne bouge ;
 *   • le contrôle des DROITS est ici et nulle part ailleurs : un adaptateur ne peut pas lire un
 *     fichier auquel la personne n'a pas accès, parce qu'il n'a aucun moyen de lire un fichier ;
 *   • un test peut fournir un faux port et exercer tout le moteur sans base.
 *
 * ── LA RÈGLE DE DROITS, EXPLICITE ───────────────────────────────────────────────────────
 *
 * LIRE demande `canViewDrive`. ÉCRIRE demande `canEditDrive`. §74 : « mêmes droits que l'écran ».
 * Une personne qui ne peut pas modifier un fichier dans le Drive ne peut pas le modifier en
 * parlant à Adam — sinon la conversation serait une porte dérobée, ce que §7 du Mission Runtime
 * interdit déjà pour les missions et qui vaut identiquement ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getBlob, putBlob } from "@/lib/drive-storage";
import { canEditDrive, canViewDrive, resolveDriveAccess } from "@/lib/drive";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { formatDeFichier } from "@/lib/artifact/adapters/registry";
import type { FicheDocument, PortAudit, PortDocuments, PortsArtefact, VersionEcrite } from "@/lib/artifact/ports";

/** Le dossier où atterrissent les « enregistrer sous » quand la personne n'en désigne pas. */
const DOSSIER_DEFAUT = "Documents Adam";

/**
 * Le port reçoit un `userId` ; il lui faut la personne COMPLÈTE pour évaluer les droits.
 * On la relit à chaque appel plutôt que de la porter en mémoire : un rôle révoqué à 14 h doit
 * fermer la porte à 14 h, pas à la fin de la session.
 */
async function personne(userId: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!u || !u.isActive) return null;
  const access = await getAccess(u.id, u.role);
  return { id: u.id, role: access.role ?? u.role, secondaryRole: access.secondaryRole, access };
}

async function ficheDeNode(nodeId: string): Promise<FicheDocument | null> {
  const node = await prisma.driveNode.findUnique({
    where: { id: nodeId },
    select: { id: true, name: true, mimeType: true, size: true, type: true, isTrashed: true },
  });
  if (!node || node.type !== "FILE" || node.isTrashed) return null;
  const derniere = await prisma.fileVersion.findFirst({
    where: { nodeId }, orderBy: { version: "desc" }, select: { version: true },
  });
  return {
    nodeId: node.id,
    nom: node.name,
    mime: node.mimeType,
    taille: node.size,
    version: derniere?.version ?? 1,
    format: formatDeFichier(node.name, node.mimeType),
  };
}

const documents: PortDocuments = {
  async decrire(userId, nodeId) {
    const u = await personne(userId);
    if (!u) return null;
    if (!canViewDrive(await resolveDriveAccess(u, nodeId))) return null;
    return ficheDeNode(nodeId);
  },

  async lire(userId, nodeId, version) {
    const u = await personne(userId);
    if (!u) return null;
    if (!canViewDrive(await resolveDriveAccess(u, nodeId))) return null;
    const v = await prisma.fileVersion.findFirst({
      where: { nodeId, version }, select: { blobId: true },
    });
    if (!v) return null;
    return getBlob(v.blobId);
  },

  async ecrireVersion(userId, nodeId, octets, opts): Promise<VersionEcrite> {
    const u = await personne(userId);
    if (!u) throw new Error("compte introuvable ou désactivé");
    // ÉCRIRE exige le droit d'écrire. C'est la ligne qui empêche la conversation d'être une
    // porte dérobée : sans elle, « Adam, modifie ce contrat » contournerait le Drive.
    if (!canEditDrive(await resolveDriveAccess(u, nodeId))) {
      throw new Error("vous n'avez pas le droit de modifier ce document");
    }
    const { blobId, size } = await putBlob(octets);
    const derniere = await prisma.fileVersion.findFirst({
      where: { nodeId }, orderBy: { version: "desc" }, select: { version: true },
    });
    const version = (derniere?.version ?? 0) + 1;
    await prisma.fileVersion.create({
      data: { nodeId, blobId, version, size, mimeType: opts.mime, note: opts.resume.slice(0, 1000), createdById: userId },
    });
    await prisma.driveNode.update({ where: { id: nodeId }, data: { size, mimeType: opts.mime } });
    return { version, taille: size };
  },

  async creerFichier(userId, opts) {
    const u = await personne(userId);
    if (!u) throw new Error("compte introuvable ou désactivé");
    const nomDossier = opts.dossier ?? DOSSIER_DEFAUT;
    // Le fichier atterrit dans le Drive PERSONNEL de la personne : c'est là que ses droits
    // existent déjà, et cela évite qu'un « enregistrer sous » publie dans un espace partagé.
    const dossier = await prisma.driveNode.findFirst({
      where: { type: "FOLDER", name: nomDossier, ownerId: userId, spaceId: null, parentId: null, isTrashed: false },
      select: { id: true },
    }) ?? await prisma.driveNode.create({
      data: { name: nomDossier, type: "FOLDER", ownerId: userId, createdById: userId },
      select: { id: true },
    });
    const { blobId, size } = await putBlob(opts.octets);
    const node = await prisma.driveNode.create({
      data: {
        name: opts.nom, type: "FILE", parentId: dossier.id, ownerId: userId, createdById: userId,
        mimeType: opts.mime, size, category: "Document",
        versions: { create: { blobId, version: 1, size, mimeType: opts.mime, createdById: userId } },
      },
      select: { id: true },
    });
    return { nodeId: node.id, version: 1 };
  },

  async chercher(userId, requete, limite) {
    const u = await personne(userId);
    if (!u) return [];
    const mots = requete.trim().split(/\s+/).filter((m) => m.length >= 2).slice(0, 6);
    if (mots.length === 0) return [];
    const candidats = await prisma.driveNode.findMany({
      where: {
        type: "FILE",
        isTrashed: false,
        // Tous les mots doivent figurer dans le nom : « contrat consulting mouffok » ne doit pas
        // remonter tous les contrats de l'entreprise.
        AND: mots.map((m) => ({ name: { contains: m, mode: "insensitive" as const } })),
      },
      select: { id: true, name: true, mimeType: true, size: true },
      orderBy: { updatedAt: "desc" },
      take: limite * 4,
    });
    const out: FicheDocument[] = [];
    for (const c of candidats) {
      if (out.length >= limite) break;
      // Le droit se vérifie nœud par nœud : un filtre SQL approximatif laisserait fuiter des noms.
      if (!canViewDrive(await resolveDriveAccess(u, c.id))) continue;
      const fiche = await ficheDeNode(c.id);
      if (fiche) out.push(fiche);
    }
    return out;
  },
};

const audit: PortAudit = {
  async tracer(opts) {
    await recordAudit({
      actorId: opts.userId,
      action: "UPDATE",
      module: "Drive",
      entityType: "DRIVE_NODE",
      entityId: opts.cible,
      // Le détail est un RÉSUMÉ d'opérations (« ¶1 → centré »), jamais le contenu du document :
      // §77 interdit de journaliser le corps d'un contrat.
      summary: `[${opts.action}] ${opts.detail}`.slice(0, 900),
    });
  },
};

export const portsArtefact: PortsArtefact = { documents, audit };
