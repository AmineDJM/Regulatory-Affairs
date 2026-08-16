import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getActiveConnection, getConnectionStatus, saveConnection, disconnect, markNeedsReconnect, readDeltaToken, writeFolderState } from "./connection";
import { MailError } from "./provider";

/**
 * L'ISOLATION, VÉRIFIÉE SUR UNE VRAIE BASE.
 *
 * C'est LA garantie du module : personne ne doit pouvoir atteindre la boîte de quelqu'un d'autre.
 * Un test qui le prouve sur des objets factices ne prouverait rien — c'est la requête réelle qui
 * compte.
 */
const TAG = `mailtest-${Date.now()}`;
let amineId = "";
let karimId = "";

const tokens = (access: string, refresh: string | null, expiresInMs: number) => ({
  accessToken: access,
  refreshToken: refresh,
  expiresAt: new Date(Date.now() + expiresInMs),
  scopes: "Mail.ReadWrite Mail.Send offline_access",
});

beforeAll(async () => {
  const mk = async (email: string, name: string) =>
    (await prisma.user.create({
      data: { email: `${TAG}-${email}`, name: `${TAG} ${name}`, role: "VIEWER", passwordHash: "x", isActive: true },
      select: { id: true },
    })).id;
  amineId = await mk("amine@adventumdz.com", "Amine");
  karimId = await mk("karim@adventumdz.com", "Karim");
});

afterAll(async () => {
  await prisma.mailConnection.deleteMany({ where: { userId: { in: [amineId, karimId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [amineId, karimId] } } });
});

describe("Chacun sa boîte, et rien d'autre", () => {
  it("une connexion enregistrée n'est visible que par SON propriétaire", async () => {
    await saveConnection({
      userId: amineId, address: "amine.djouamai@adventumdz.com", displayName: "Amine",
      homeAccountId: "ms-1", tokens: tokens("jeton-amine", "refresh-amine", 3_600_000),
    });

    const mine = await getActiveConnection(amineId);
    expect(mine?.address).toBe("amine.djouamai@adventumdz.com");
    expect(mine?.accessToken).toBe("jeton-amine");

    // Karim n'a rien connecté : il n'obtient RIEN, et surtout pas la boîte d'Amine.
    expect(await getActiveConnection(karimId)).toBeNull();
  });

  it("deux boîtes coexistent sans se mélanger", async () => {
    await saveConnection({
      userId: karimId, address: "karim@adventumdz.com", displayName: "Karim",
      homeAccountId: "ms-2", tokens: tokens("jeton-karim", "refresh-karim", 3_600_000),
    });
    const a = await getActiveConnection(amineId);
    const k = await getActiveConnection(karimId);
    expect(a?.accessToken).toBe("jeton-amine");
    expect(k?.accessToken).toBe("jeton-karim");
    expect(a?.address).not.toBe(k?.address);
  });

  it("le jeton n'est JAMAIS lisible en base", async () => {
    const row = await prisma.mailConnection.findUnique({ where: { userId: amineId } });
    expect(row?.accessTokenEnc).toBeTruthy();
    expect(row?.accessTokenEnc).not.toContain("jeton-amine");
    expect(row?.refreshTokenEnc).not.toContain("refresh-amine");
  });

  it("l'état affichable ne contient aucun jeton", async () => {
    const status = await getConnectionStatus(amineId);
    expect(JSON.stringify(status)).not.toContain("jeton-amine");
    expect(status.connected).toBe(true);
    expect(status.address).toBe("amine.djouamai@adventumdz.com");
  });

  it("sans connexion, l'état le dit sans lever", async () => {
    const orphan = await prisma.user.create({
      data: { email: `${TAG}-orphan@x.dz`, name: `${TAG} Orphan`, role: "VIEWER", passwordHash: "x" },
      select: { id: true },
    });
    const s = await getConnectionStatus(orphan.id);
    expect(s.connected).toBe(false);
    expect(s.address).toBeNull();
    await prisma.user.delete({ where: { id: orphan.id } });
  });
});

describe("Le cycle de vie du jeton", () => {
  it("un jeton EXPIRÉ sans jeton de rafraîchissement demande une reconnexion", async () => {
    await saveConnection({
      userId: karimId, address: "karim@adventumdz.com", displayName: null,
      homeAccountId: null, tokens: tokens("perime", null, -1000),
    });
    await expect(getActiveConnection(karimId)).rejects.toBeInstanceOf(MailError);

    const status = await getConnectionStatus(karimId);
    // L'écran doit distinguer « en panne » de « à reconnecter » : ce ne sont pas les mêmes gestes.
    expect(status.status).toBe("needs-reconnect");
    expect(status.connected).toBe(false);
  });

  it("un jeton encore valide n'appelle pas Microsoft pour rien", async () => {
    await saveConnection({
      userId: karimId, address: "karim@adventumdz.com", displayName: null,
      homeAccountId: null, tokens: tokens("encore-bon", "r", 3_600_000),
    });
    const c = await getActiveConnection(karimId);
    expect(c?.accessToken).toBe("encore-bon");
  });

  it("marquer « à reconnecter » ne garde qu'un motif court, jamais de contenu", async () => {
    await markNeedsReconnect(karimId, "x".repeat(500));
    const row = await prisma.mailConnection.findUnique({ where: { userId: karimId } });
    expect((row?.lastError ?? "").length).toBeLessThanOrEqual(200);
  });

  it("se déconnecter EFFACE les jetons — pas seulement un drapeau", async () => {
    await disconnect(karimId);
    expect(await prisma.mailConnection.findUnique({ where: { userId: karimId } })).toBeNull();
    expect(await getActiveConnection(karimId)).toBeNull();
  });
});

describe("L'état de synchronisation d'un dossier", () => {
  it("le jeton de delta dort chiffré et se relit", async () => {
    const conn = await prisma.mailConnection.findUnique({ where: { userId: amineId }, select: { id: true } });
    await writeFolderState({ connectionId: conn!.id, folderId: "inbox", displayName: "Réception", wellKnown: "inbox", deltaToken: "delta-abc", unread: 3, total: 40 });

    expect(await readDeltaToken(conn!.id, "inbox")).toBe("delta-abc");
    const row = await prisma.mailFolderState.findUnique({
      where: { connectionId_folderId: { connectionId: conn!.id, folderId: "inbox" } },
    });
    // Un jeton de delta vaut un droit de lecture sur le dossier : il ne dort pas en clair.
    expect(row?.deltaTokenEnc).not.toContain("delta-abc");
    expect(row?.unread).toBe(3);
  });

  it("une resynchronisation efface le jeton périmé", async () => {
    const conn = await prisma.mailConnection.findUnique({ where: { userId: amineId }, select: { id: true } });
    await writeFolderState({ connectionId: conn!.id, folderId: "inbox", deltaToken: null });
    expect(await readDeltaToken(conn!.id, "inbox")).toBeNull();
  });

  it("un dossier jamais synchronisé n'a pas de jeton, sans lever", async () => {
    const conn = await prisma.mailConnection.findUnique({ where: { userId: amineId }, select: { id: true } });
    expect(await readDeltaToken(conn!.id, "jamais-vu")).toBeNull();
  });
});
