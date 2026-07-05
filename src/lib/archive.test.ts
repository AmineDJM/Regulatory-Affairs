import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBlob, releaseBlob } from "@/lib/drive-storage";
import { archiveProcessedRequest } from "@/lib/archive";

const TAG = "__test_archive__";
let userId = "";

describe("Archive « Dossier traité » (Drive)", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `${TAG}@test.local`, name: `${TAG}user`, passwordHash: "x", role: "DIRECTION_ASSISTANT" },
      select: { id: true },
    });
    userId = u.id;
  });

  afterAll(async () => {
    // Supprime l'arbre créé (cascade DriveTree) + libère les blobs + l'utilisateur.
    const root = await prisma.driveNode.findFirst({ where: { name: "Dossier traité", ownerId: userId, parentId: null } });
    if (root) {
      const versions = await prisma.fileVersion.findMany({
        where: { node: { OR: [{ id: root.id }, { parentId: root.id }, { parent: { parentId: root.id } }, { parent: { parent: { parentId: root.id } } }] } },
        select: { blobId: true },
      });
      await prisma.driveNode.delete({ where: { id: root.id } });
      for (const v of versions) await releaseBlob(v.blobId).catch(() => {});
    }
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("crée la boîte, le bureau, le dossier de demande et le récapitulatif lisible", async () => {
    const nodeId = await archiveProcessedRequest({
      bureau: "RH",
      folderName: `${TAG} note de frais`,
      summary: "Demande RH — Note de frais\nEmployé : Test",
      extraFiles: [{ name: "reponse.txt", content: Buffer.from("ok", "utf8"), mimeType: "text/plain" }],
      ownerId: userId,
    });
    expect(nodeId).toBeTruthy();

    const folder = await prisma.driveNode.findUnique({ where: { id: nodeId! }, include: { parent: { include: { parent: true } }, children: { include: { versions: true } } } });
    expect(folder?.type).toBe("FOLDER");
    expect(folder?.parent?.name).toBe("RH");
    expect(folder?.parent?.parent?.name).toBe("Dossier traité");
    expect(folder?.parent?.parent?.ownerId).toBe(userId);

    const files = folder!.children.filter((c) => c.type === "FILE").map((c) => c.name).sort();
    expect(files).toEqual(["Demande.txt", "reponse.txt"]);

    const recap = folder!.children.find((c) => c.name === "Demande.txt")!;
    const buf = await getBlob(recap.versions[0].blobId);
    expect(buf?.toString("utf8")).toContain("Note de frais");
  });

  it("réutilise la boîte et le bureau au 2ᵉ archivage (pas de doublon)", async () => {
    const nodeId = await archiveProcessedRequest({
      bureau: "RH",
      folderName: `${TAG} entrevue`,
      summary: "Demande RH — Entrevue",
      ownerId: userId,
    });
    expect(nodeId).toBeTruthy();
    const roots = await prisma.driveNode.count({ where: { name: "Dossier traité", ownerId: userId, parentId: null } });
    const bureaus = await prisma.driveNode.count({ where: { name: "RH", ownerId: userId, parent: { name: "Dossier traité" } } });
    expect(roots).toBe(1);
    expect(bureaus).toBe(1);
  });
});
