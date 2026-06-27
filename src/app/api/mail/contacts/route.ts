import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMailAccount, listRecentContacts } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Carnet d'adresses léger pour l'autocomplétion : collègues internes (annuaire) +
 * correspondants récents de la boîte (expéditeurs INBOX / destinataires Envoyés).
 * Chargé une fois à l'ouverture du composeur, filtré côté client.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const account = await getMailAccount(user.id);
  if (!account) return NextResponse.json({ error: "Aucune boîte connectée" }, { status: 404 });

  const byAddr = new Map<string, { name: string; address: string; source: "interne" | "recent" }>();

  // 1) Collègues internes (rapide, depuis la base).
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, email: { not: "" }, id: { not: user.id } },
      select: { name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    });
    for (const u of users) {
      const address = u.email.toLowerCase().trim();
      if (address && !byAddr.has(address)) byAddr.set(address, { name: u.name, address, source: "interne" });
    }
  } catch { /* ignore */ }

  // 2) Correspondants récents (IMAP, best-effort — ne bloque pas si indisponible).
  try {
    for (const ct of await listRecentContacts(account)) {
      const address = ct.address;
      if (address && !byAddr.has(address)) byAddr.set(address, { name: ct.name, address, source: "recent" });
    }
  } catch (e) {
    console.error("[mail] recent contacts failed", e);
  }

  return NextResponse.json({ contacts: [...byAddr.values()].slice(0, 400) });
}
