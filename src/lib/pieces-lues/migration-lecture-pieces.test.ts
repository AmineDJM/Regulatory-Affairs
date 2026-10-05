import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ENTITE_DU_MODELE, REFERENTS } from "@/lib/suppression/branches";
import { inventorier } from "@/lib/suppression/lot";
import { empreinteDe, VERSION_LECTEUR } from "./lecture-fichier";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MIGRATION DU LOT D2, REJOUÉE SUR SON TEXTE RÉEL — et ce que le schéma neuf décide.
 *
 * Une migration ne se relit pas, elle se DÉPLOIE (§118.138) : ce banc joue le fichier `.sql` lui-même
 * (pas une copie qui aurait divergé), DEUX fois, sur une base telle qu'elle était AVANT le lot — un
 * schéma de passage créé dans une transaction ANNULÉE, où la vraie table `AiSetting` est recopiée sans
 * sa colonne neuve et porte déjà sa ligne. Rien n'est écrit dans la base de travail : le schéma
 * disparaît avec la transaction, et le dernier cas le vérifie.
 *
 * Puis la décision que le schéma impose au lot de suppression : une confirmation de lecture est une
 * ATTESTATION — elle ne part pas avec la pièce qu'elle désigne (HISTOIRE, `suppression/branches.ts`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const SQL = readFileSync(join(process.cwd(), "prisma", "migrations", "20270104090000_lecture_pieces", "migration.sql"), "utf8");

/**
 * Le fichier, instruction par instruction : les commentaires d'abord retirés (ils portent des « ; »),
 * puis une coupe aux « ; » HORS des blocs `DO $$ … $$` — qui en contiennent.
 */
function instructions(sql: string): string[] {
  const sansCommentaires = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  const out: string[] = [];
  let courante = "";
  let dansDollar = false;
  for (let i = 0; i < sansCommentaires.length; i++) {
    if (sansCommentaires.startsWith("$$", i)) { dansDollar = !dansDollar; courante += "$$"; i += 1; continue; }
    const c = sansCommentaires[i]!;
    if (c === ";" && !dansDollar) { if (courante.trim()) out.push(courante.trim()); courante = ""; continue; }
    courante += c;
  }
  if (courante.trim()) out.push(courante.trim());
  return out;
}

interface Constat {
  schema: string;
  aiSetting: { lecturePiecesEnabled: boolean; masterEnabled: boolean }[];
  tables: string[];
  indexUnique: string[];
  cles: { conname: string; confdeltype: string }[];
  etatParDefaut: string | null;
}

/** Joue la migration `passes` fois dans un schéma neuf, relève ce qu'elle a laissé, puis ANNULE tout. */
async function jouer(passes: number): Promise<Constat> {
  const schema = `banc_lecture_${randomBytes(5).toString("hex")}`;
  const ANNULE = new Error("annulé — le banc ne garde rien");
  let constat: Constat | null = null;
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      // La table des réglages d'IA telle qu'elle était AVANT le lot : la vraie, sans sa colonne neuve —
      // et sa ligne, déjà là (tous les interrupteurs à leur défaut : allumés).
      await tx.$executeRawUnsafe(`CREATE TABLE "AiSetting" (LIKE public."AiSetting" INCLUDING DEFAULTS)`);
      await tx.$executeRawUnsafe(`ALTER TABLE "AiSetting" DROP COLUMN IF EXISTS "lecturePiecesEnabled"`);
      await tx.$executeRawUnsafe(`INSERT INTO "AiSetting" ("id", "updatedAt") VALUES ('global', now())`);
      for (let p = 0; p < passes; p++) {
        for (const s of instructions(SQL)) await tx.$executeRawUnsafe(s);
      }
      constat = {
        schema,
        aiSetting: await tx.$queryRawUnsafe(`SELECT "lecturePiecesEnabled", "masterEnabled" FROM "AiSetting"`),
        tables: (await tx.$queryRawUnsafe<{ t: string }[]>(
          `SELECT table_name::text AS t FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`, schema)).map((x) => x.t),
        indexUnique: (await tx.$queryRawUnsafe<{ d: string }[]>(
          `SELECT indexdef AS d FROM pg_indexes WHERE schemaname = $1 AND indexname = 'LecturePiece_empreinte_versionLecteur_key'`, schema))
          .map((x) => x.d.replace(schema, "«schéma»")),
        cles: await tx.$queryRawUnsafe(
          `SELECT c.conname::text AS conname, c.confdeltype::text AS confdeltype FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
           WHERE n.nspname = $1 AND c.contype = 'f' ORDER BY 1`, schema),
        etatParDefaut: ((await tx.$queryRawUnsafe<{ d: string | null }[]>(
          `SELECT column_default::text AS d FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'LecturePiece' AND column_name = 'etat'`, schema))[0]?.d) ?? null,
      };
      throw ANNULE;
    }, { timeout: 30_000 });
  } catch (e) {
    if (e !== ANNULE) throw e;
  }
  if (!constat) throw new Error("la migration n'a rien laissé à relever");
  return constat;
}

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

describe("la migration, lue", () => {
  it("se découpe en instructions sans couper le bloc qui pose la clé étrangère", () => {
    const s = instructions(SQL);
    const bloc = s.filter((x) => x.startsWith("DO $$"));
    expect(bloc).toHaveLength(1);
    expect(bloc[0]).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$$/);
    // Rien n'est rempli : aucune instruction n'écrit une ligne.
    expect(s.some((x) => /^(INSERT|UPDATE|DELETE)\b/i.test(x))).toBe(false);
  });
});

suite("la migration du lot D2, rejouée sur son texte réel", () => {
  it("rejouée DEUX fois sur une base d'avant le lot, elle passe — et ne crée rien en double", async () => {
    const c = await jouer(2);
    expect(c.tables).toEqual(["AiSetting", "LecturePiece", "LecturePieceConfirmation"]);
    expect(c.indexUnique).toEqual(['CREATE UNIQUE INDEX "LecturePiece_empreinte_versionLecteur_key" ON «schéma»."LecturePiece" USING btree (empreinte, "versionLecteur")']);
    // UNE clé étrangère, en RESTRICT : une lecture qu'une confirmation désigne ne se purge pas.
    expect(c.cles).toEqual([{ conname: "LecturePieceConfirmation_lectureId_fkey", confdeltype: "r" }]);
    expect(c.etatParDefaut).toContain("EN_COURS");
  });

  it("une ligne AiSetting EXISTANTE reçoit `false` : la lecture des lignes par un modèle est COUPÉE par défaut", async () => {
    const c = await jouer(2);
    // Les autres interrupteurs sont restés allumés : la colonne neuve ne suit pas leur défaut.
    expect(c.aiSetting).toEqual([{ lecturePiecesEnabled: false, masterEnabled: true }]);
  });

  it("une seule passe laisse exactement ce que deux laissent", async () => {
    const [une, deux] = await Promise.all([jouer(1), jouer(2)]);
    expect({ ...une, schema: "" }).toEqual({ ...deux, schema: "" });
  });

  it("le banc ne garde rien : le schéma de passage disparaît avec la transaction", async () => {
    const c = await jouer(1);
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = ${c.schema}`;
    expect(n).toBe(0);
  });
});

suite("une confirmation de lecture est une ATTESTATION : elle ne part pas avec la pièce qu'elle désigne", () => {
  const TAG = `__lectmigr${Date.now()}__`;
  let pieceId = "";
  let lectureId = "";
  let confirmationId = "";

  beforeAll(async () => {
    const [piece, lecture] = await Promise.all([
      prisma.legalDocument.create({ data: { title: `${TAG} BC Imprimerie du Banc` }, select: { id: true } }),
      prisma.lecturePiece.create({
        data: { empreinte: empreinteDe(Buffer.from(TAG)), versionLecteur: VERSION_LECTEUR, etat: "LUE", extension: "pdf", taille: 1, creeParId: TAG },
        select: { id: true },
      }),
    ]);
    pieceId = piece.id;
    lectureId = lecture.id;
    confirmationId = (await prisma.lecturePieceConfirmation.create({
      data: { lectureId, cibleType: "LEGAL_DOCUMENT", cibleId: pieceId, confirmeeParId: TAG, lignes: [] },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    await prisma.lecturePieceConfirmation.deleteMany({ where: { id: confirmationId } });
    await Promise.all([
      prisma.lecturePiece.deleteMany({ where: { creeParId: TAG } }),
      prisma.legalDocument.deleteMany({ where: { id: pieceId } }),
    ]);
  });

  it("l'inventaire de suppression d'une pièce Legal n'emporte pas sa confirmation de lecture", async () => {
    // Prémisses : le couple est classé, et la valeur de `cibleType` est bien le type que le lot interrogerait —
    // sans elles, ce cas passerait même si la confirmation était EMPORTÉE.
    expect(REFERENTS.some((r) => r.modele === "LecturePieceConfirmation" && r.champType === "cibleType" && r.champId === "cibleId")).toBe(true);
    expect(ENTITE_DU_MODELE.LegalDocument).toBe("LEGAL_DOCUMENT");

    const inv = await inventorier("LegalDocument", pieceId);
    expect(inv).not.toBeNull();
    expect(inv!.lignes.map((l) => l.modele)).not.toContain("LecturePieceConfirmation");
    expect(await prisma.lecturePieceConfirmation.count({ where: { id: confirmationId } })).toBe(1);
  });
});
