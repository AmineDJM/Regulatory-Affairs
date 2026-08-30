import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess } from "@/lib/rbac";
import { executePowerTool } from "@/lib/assistant/power-tools";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `inspect_record` RELIT LES IDENTIFIANTS QU'IL A LUI-MÊME DISTRIBUÉS — le correctif du Run 4.
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Le pipeline direct des missions (RECHERCHER → CIBLER → LIRE) a pour consigne de recopier
 * l'identifiant EXACT rendu par une recherche — et c'est la bonne consigne : un id ne se
 * reconstruit pas. Or `inspect_record` ne cherchait que `reference` et `title`. Servi avec
 * l'id `cmt1j3mco0003nnmzjvpe2tnc` que search_courriers venait de rendre, il répondait
 * « Aucun dossier ne porte la référence » ; le juge relevait honnêtement la contradiction
 * CIBLER→LIRE, le replan ne trouvait rien à réparer (rien n'avait ÉCHOUÉ), et la mission
 * mourait BLOCKED. Mesuré au Run 4 sur COURRIERS (2×), FINANCES, LEGAL et TACHES.
 *
 * Ces épreuves partent du VRAI point d'entrée (`executePowerTool`) sur la vraie base — pas
 * d'un état injecté à la main (§14).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TAG = `insprec${Date.now().toString(36)}`;

const PDG: CurrentUser = {
  id: `${TAG}-u`, name: "PDG Banc", email: `${TAG}@t.dz`, role: "SUPER_ADMIN",
  access: { modules: new Map(), rowGrants: new Map() } as unknown as EffectiveAccess,
  mustChangePassword: false,
};

let mailId = "";
let taskId = "";

beforeAll(async () => {
  const mail = await prisma.mailEntry.create({
    data: {
      reference: `${TAG}-CHR-001`,
      title: `${TAG} 3ème relance factures impayées`,
      direction: "OUTGOING",
      sender: "Adventum Pharma",
      recipient: "NTC North Tech Construction",
    },
    select: { id: true },
  });
  mailId = mail.id;
  const task = await prisma.task.create({
    data: { title: `${TAG} marquer réserves traitement` },
    select: { id: true },
  });
  taskId = task.id;
});

afterAll(async () => {
  await prisma.mailEntry.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
  await prisma.task.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
});

describe("inspect_record — l'identifiant interne se résout comme la référence", () => {
  it("RUN 4 : l'id d'un courrier rendu par une recherche RELIT le courrier — plus jamais « aucun dossier »", async () => {
    const r = await executePowerTool("inspect_record", { reference: mailId }, PDG);
    expect(r).not.toMatch(/Aucun dossier ne porte/);
    const fiche = JSON.parse(r ?? "null") as { type: string; reference: string };
    expect(fiche.type).toBe("Courrier (registre)");
    expect(fiche.reference).toBe(`${TAG}-CHR-001`);
  });

  it("l'id d'une tâche se résout aussi (la table sans colonne référence)", async () => {
    const r = await executePowerTool("inspect_record", { reference: taskId }, PDG);
    const fiche = JSON.parse(r ?? "null") as { type: string; titre: string };
    expect(fiche.type).toBe("Tâche");
    expect(fiche.titre).toContain("marquer réserves");
  });

  it("la RÉFÉRENCE continue de primer et de fonctionner — aucune régression du chemin historique", async () => {
    const r = await executePowerTool("inspect_record", { reference: `${TAG}-CHR-001` }, PDG);
    const fiche = JSON.parse(r ?? "null") as { type: string };
    expect(fiche.type).toBe("Courrier (registre)");
  });

  it("un identifiant qui n'existe NULLE PART reste dit tel quel — l'outil n'infère pas", async () => {
    const r = await executePowerTool("inspect_record", { reference: "cmzzzzzzzzzzzzzzzzzzzzzzz" }, PDG);
    expect(r).toMatch(/Aucun dossier ne porte/);
    expect(r).toMatch(/identifiant interne/);
  });
});
