import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { recordArtifact } from "./manifest";

/**
 * Fabrique de données synthétiques. Chaque création est IMMÉDIATEMENT inscrite au
 * manifeste (pour un nettoyage garanti). Les comptes sont créés **inactifs** et sur un
 * domaine **réservé** : même si un nettoyage échouait, ils ne pourraient ni se connecter
 * ni recevoir de vrai e-mail (défense en profondeur).
 */

const QA_DOMAIN = "qa.adventum.invalid"; // domaine non routable — jamais de vrai envoi

export interface SyntheticUser { id: string; email: string; role: UserRole }

/** Crée un compte synthétique **inactif** par rôle et l'inscrit au manifeste. */
export async function seedSyntheticUsers(testRunId: string, roles: UserRole[], active = false): Promise<SyntheticUser[]> {
  const hash = bcrypt.hashSync(`QA!${crypto.randomBytes(12).toString("hex")}`, 10);
  const out: SyntheticUser[] = [];
  for (const role of roles) {
    const email = `qa_${testRunId}_${role.toLowerCase()}@${QA_DOMAIN}`;
    const u = await prisma.user.create({
      data: { email, name: `QA ${role} [${testRunId.slice(0, 6)}]`, passwordHash: hash, role, isActive: active, mustChangePassword: true },
      select: { id: true },
    });
    await recordArtifact(testRunId, { resourceType: "user", model: "user", recordId: u.id, deleteMethod: "prisma" });
    out.push({ id: u.id, email, role });
  }
  return out;
}
