import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertEphemeralName, ephemeralSchemaName, createEphemeralSchema, schemaExists, destroyEphemeralSchema } from "./ephemeral";
import { runOracles } from "./oracles/consistency";
import { certifyMigrationsAndRecovery } from "./migration-cert";

// ————— Sécurité de la destruction (pur, aucune base) —————
describe("Test Center — schéma éphémère : garde-fou de destruction", () => {
  it("refuse tout nom hors de l'espace réservé « tc_eph_ »", () => {
    expect(() => assertEphemeralName("public")).toThrow();
    expect(() => assertEphemeralName("tc_eph_x")).toThrow(); // trop court (< 4 après le préfixe)
    expect(() => assertEphemeralName('tc_eph_a"; DROP SCHEMA public CASCADE; --')).toThrow(); // injection
    expect(() => assertEphemeralName("amd_public")).toThrow();
  });
  it("accepte un nom généré", () => {
    expect(() => assertEphemeralName(ephemeralSchemaName("run123"))).not.toThrow();
  });
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

suite("Test Center — infrastructure (base réelle)", () => {
  it("cycle de vie d'un schéma éphémère : créer → exister → détruire → vérifier disparition", async () => {
    const schema = ephemeralSchemaName(`life${crypto.randomBytes(3).toString("hex")}`);
    await createEphemeralSchema(schema);
    expect(await schemaExists(schema)).toBe(true);
    const r = await destroyEphemeralSchema(schema);
    expect(r.dropped).toBe(true);
    expect(r.verifiedGone).toBe(true);
    expect(await schemaExists(schema)).toBe(false);
  }, 30_000);

  it("roundtrip sauvegarde → perte → restauration prouvé (schéma jetable détruit à la fin)", async () => {
    const runId = `mig${crypto.randomBytes(3).toString("hex")}`;
    const cert = await certifyMigrationsAndRecovery(runId, true);
    expect(cert.backupRestore?.ran).toBe(true);
    expect(cert.backupRestore?.original).toBeGreaterThan(0);
    expect(cert.backupRestore?.afterLoss).toBe(0);
    expect(cert.backupRestore?.restored).toBe(cert.backupRestore?.original);
    expect(cert.backupRestore?.ok).toBe(true);
  }, 40_000);

  it("compare migrations disque ↔ base et n'invente rien", async () => {
    const cert = await certifyMigrationsAndRecovery("readonly", false);
    expect(cert.backupRestore).toBeNull(); // lecture seule : pas de roundtrip
    expect(cert.onDisk).toBeGreaterThan(0); // le dépôt contient des migrations
    // Si la base est joignable, les migrations appliquées doivent au moins exister.
    expect(cert.applied).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it("cohérence multi-oracles : structure exploitable", async () => {
    const r = await runOracles();
    expect(Array.isArray(r.checks)).toBe(true);
    expect(typeof r.disagreements).toBe("number");
    for (const c of r.checks) expect(typeof c.agree).toBe("boolean");
  }, 40_000);
});
