import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { nomDuTerritoire } from "./territoire-kam";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA REPRISE DES SECTEURS PARTAGÉS DANS LES TERRITOIRES PROPRES — jouée sur le TEXTE RÉEL de la
 * migration, contre des tables temporaires (§118.173 : `pg_temp` passe devant `public` pour la
 * session ; rien de la base partagée n'est lu ni écrit, et la transaction est annulée).
 *
 * Ce qu'elle doit tenir : un KAM retrouve EXACTEMENT la même couverture — l'union des
 * établissements, « tous les services » si l'un des anciens liens le disait, sinon l'union des
 * services ; ses affectations aux anciens secteurs sont retirées ; les anciens secteurs devenus sans
 * KAM sont désactivés, jamais supprimés ; un secteur inactif n'est pas repris ; et rejouée, elle ne
 * change RIEN.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const SQL = readFileSync(path.join(process.cwd(), "prisma/migrations/20270106093000_territoire_kam/migration.sql"), "utf8");

/** Les instructions du fichier, une par une — un bloc `DO $$ … $$` reste entier. */
function instructions(sql: string): string[] {
  const sansCommentaires = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const out: string[] = [];
  let cur = "";
  let dollar = false;
  for (const ligne of sansCommentaires.split("\n")) {
    if ((ligne.match(/\$\$/g) ?? []).length % 2 === 1) dollar = !dollar;
    cur += `${ligne}\n`;
    if (!dollar && ligne.trim().endsWith(";")) { if (cur.trim()) out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

interface Etat {
  secteurs: { id: string; businessUnitId: string; name: string; repId: string | null; isActive: boolean }[];
  liens: { sectorId: string; institutionId: string; tousLesServices: boolean }[];
  services: { sectorId: string; institutionId: string; serviceId: string }[];
  reps: { sectorId: string; repId: string }[];
}

async function jouer(passes: number): Promise<Etat> {
  const ANNULE = new Error("annulé — le banc ne garde rien");
  let etat: Etat | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const x = (q: string) => tx.$executeRawUnsafe(q);
      await x(`CREATE TEMP TABLE "User" ("id" text PRIMARY KEY, "name" text NOT NULL) ON COMMIT DROP`);
      await x(`CREATE TEMP TABLE "SalesSector" ("id" text PRIMARY KEY, "businessUnitId" text NOT NULL, "name" text NOT NULL, "city" text, "color" text,
        "isActive" boolean NOT NULL DEFAULT true, "createdById" text, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("businessUnitId", "name")) ON COMMIT DROP`);
      await x(`CREATE TEMP TABLE "SalesSectorInstitution" ("id" text PRIMARY KEY, "sectorId" text NOT NULL, "institutionId" text NOT NULL,
        "tousLesServices" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("sectorId", "institutionId")) ON COMMIT DROP`);
      await x(`CREATE TEMP TABLE "SalesSectorInstitutionService" ("id" text PRIMARY KEY, "sectorInstitutionId" text NOT NULL, "serviceId" text NOT NULL,
        UNIQUE ("sectorInstitutionId", "serviceId")) ON COMMIT DROP`);
      await x(`CREATE TEMP TABLE "SalesSectorRep" ("id" text PRIMARY KEY, "sectorId" text NOT NULL, "repId" text NOT NULL,
        "assignedAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("sectorId", "repId")) ON COMMIT DROP`);
      // DEUX KAM, une BU « bu1 » et une seconde « bu2 ».
      await x(`INSERT INTO "User" VALUES ('kamA', 'Amel Haddad'), ('kamB', 'Bilal Kam'), ('kamC', 'Amel Haddad')`);
      await x(`INSERT INTO "SalesSector" ("id", "businessUnitId", "name", "isActive") VALUES
        ('est', 'bu1', 'Est', true), ('ouest', 'bu1', 'Ouest', true), ('ferme', 'bu1', 'Fermé', false), ('vide', 'bu1', 'Vide', true),
        ('nord', 'bu2', 'Nord', true), ('pris', 'bu2', 'Territoire — Bilal Kam', true)`);
      await x(`INSERT INTO "SalesSectorInstitution" ("id", "sectorId", "institutionId", "tousLesServices") VALUES
        ('l1', 'est', 'chu', false), ('l2', 'est', 'eph', false), ('l3', 'ouest', 'chu', true), ('l4', 'ouest', 'eph', false),
        ('l5', 'ferme', 'clinique', true), ('l6', 'nord', 'chu', false), ('l7', 'est', 'cac', false)`);
      await x(`INSERT INTO "SalesSectorInstitutionService" ("id", "sectorInstitutionId", "serviceId") VALUES
        ('s1', 'l1', 'urg'), ('s2', 'l2', 'cardio'), ('s3', 'l4', 'onco'), ('s4', 'l6', 'pneumo')`);
      // kamA : Est + Ouest (bu1) — union ; et Fermé, inactif. kamB : Nord (bu2), et le nom de son territoire est PRIS.
      // kamC : homonyme de kamA, dans Est aussi.
      await x(`INSERT INTO "SalesSectorRep" ("id", "sectorId", "repId") VALUES
        ('r1', 'est', 'kamA'), ('r2', 'ouest', 'kamA'), ('r3', 'ferme', 'kamA'), ('r4', 'nord', 'kamB'), ('r5', 'est', 'kamC')`);
      for (let i = 0; i < passes; i++) for (const q of instructions(SQL)) await x(q);
      etat = {
        secteurs: await tx.$queryRawUnsafe(`SELECT "id", "businessUnitId", "name", "repId", "isActive" FROM "SalesSector" ORDER BY "id"`),
        liens: await tx.$queryRawUnsafe(`SELECT "sectorId", "institutionId", "tousLesServices" FROM "SalesSectorInstitution" ORDER BY "sectorId", "institutionId"`),
        services: await tx.$queryRawUnsafe(`SELECT l."sectorId", l."institutionId", s."serviceId" FROM "SalesSectorInstitutionService" s
          JOIN "SalesSectorInstitution" l ON l."id" = s."sectorInstitutionId" ORDER BY 1, 2, 3`),
        reps: await tx.$queryRawUnsafe(`SELECT "sectorId", "repId" FROM "SalesSectorRep" ORDER BY "sectorId", "repId"`),
      };
      throw ANNULE;
    }, { timeout: 30_000 });
  } catch (e) {
    if (e !== ANNULE) throw e;
  }
  return etat!;
}

suite("La reprise des secteurs partagés, jouée sur le texte réel de la migration", () => {
  const territoireDe = (e: Etat, repId: string, bu: string) => e.secteurs.find((s) => s.repId === repId && s.businessUnitId === bu);

  it("l'UNION des établissements ; « tous » si l'un des anciens liens le disait ; sinon l'union des services", async () => {
    const e = await jouer(1);
    const t = territoireDe(e, "kamA", "bu1")!;
    expect(t.isActive).toBe(true);
    const liens = e.liens.filter((l) => l.sectorId === t.id).map((l) => [l.institutionId, l.tousLesServices]);
    // chu : restreint (Est) ∪ entier (Ouest) → ENTIER. eph : restreint des deux côtés → restreint.
    // cac : restreint SANS service → reste restreint et vide (on n'élargit rien en silence).
    expect(liens).toEqual([["cac", false], ["chu", true], ["eph", false]]);
    expect(e.services.filter((s) => s.sectorId === t.id).map((s) => [s.institutionId, s.serviceId])).toEqual([["eph", "cardio"], ["eph", "onco"]]);
    // Un ancien secteur INACTIF n'est pas repris : sa clinique ne couvrait personne.
    expect(e.liens.some((l) => l.sectorId === t.id && l.institutionId === "clinique")).toBe(false);
  });

  it("le KAM est affecté à SON territoire, et ses affectations aux anciens secteurs ACTIFS sont retirées", async () => {
    const e = await jouer(1);
    const t = territoireDe(e, "kamA", "bu1")!;
    expect(e.reps.filter((r) => r.repId === "kamA").map((r) => r.sectorId).sort()).toEqual(["ferme", t.id].sort());
  });

  it("les anciens secteurs devenus sans KAM sont DÉSACTIVÉS, jamais supprimés — un inactif reste tel quel", async () => {
    const e = await jouer(1);
    const parId = new Map(e.secteurs.map((s) => [s.id, s]));
    for (const id of ["est", "ouest", "vide", "nord"]) expect(parId.get(id)?.isActive, id).toBe(false);
    expect(parId.get("ferme")?.isActive).toBe(false);
    // Le secteur dont le NOM est pris n'avait pas de KAM : désactivé lui aussi, pas supprimé.
    expect(parId.has("pris")).toBe(true);
  });

  it("LE NOM : « Territoire — <KAM> », la fin de l'identifiant quand il est pris — la MÊME règle que l'action", async () => {
    const e = await jouer(1);
    expect(territoireDe(e, "kamB", "bu2")?.name).toBe(nomDuTerritoire("Bilal Kam", "kamB", true));
    // Deux homonymes dans la même BU : aucun ne prend le nom nu — sinon l'un des deux échouerait sur l'unicité.
    expect(territoireDe(e, "kamA", "bu1")?.name).toBe(nomDuTerritoire("Amel Haddad", "kamA", true));
    expect(territoireDe(e, "kamC", "bu1")?.name).toBe(nomDuTerritoire("Amel Haddad", "kamC", true));
    // kamB : la couverture restreinte de Nord reprise telle quelle.
    const tb = territoireDe(e, "kamB", "bu2")!;
    expect(e.services.filter((s) => s.sectorId === tb.id).map((s) => s.serviceId)).toEqual(["pneumo"]);
  });

  it("rejouée, elle ne change RIEN — deux passes identiques", async () => {
    const une = await jouer(1);
    const deux = await jouer(2);
    expect(deux).toEqual(une);
  });
});
