import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/rbac";
import { executerSqlLectureSeule, relationsDuPlan, verifierForme, verifierVerrouLectureSeule, LIMITE_LIGNES, DELAI_MS, TABLES_AUTORISEES } from "./sql";

/**
 * LE BAC SQL — sur la VRAIE base. Ce qu'on prouve : la forme refuse ce qu'elle doit (écritures,
 * point-virgule, commentaires, fonctions système) ; le PLAN attrape une table sensible même
 * cachée dans une CTE ou un alias ; la transaction refuse d'écrire ; le délai coupe ; la limite
 * tronque et le dit ; les colonnes sensibles sont masquées même renommées ; et un compte sans
 * vue globale n'exécute rien du tout.
 */
const direction = { id: "sandbox-test-direction", role: "SUPER_ADMIN", access: { modules: new Map() } } as unknown as SessionUser;
const salarie = { id: "sandbox-test-salarie", role: "VIEWER", access: { modules: new Map() } } as unknown as SessionUser;

describe("la forme", () => {
  it("accepte SELECT et WITH, refuse le reste en nommant le motif", () => {
    expect(verifierForme('SELECT id FROM "Company"').ok).toBe(true);
    expect(verifierForme('WITH c AS (SELECT id FROM "Company") SELECT count(*) FROM c;').ok).toBe(true);
    const cas: [string, RegExp][] = [
      ["", /vide/], ['UPDATE "Company" SET name = \'x\'', /interdit : update|SELECT/i], ['SELECT 1; DROP TABLE "Company"', /point-virgule/],
      ['SELECT 1 -- commentaire', /commentaires/], ["SELECT pg_read_file('/etc/passwd')", /pg_read_file/], ["SELECT pg_sleep(10)", /pg_sleep/],
      ['SELECT * FROM "Company" WHERE id IN (DELETE FROM "Task" RETURNING id)', /delete/i], ["SELECT set_config('x', 'y', false)", /set_config/],
      ["SELECT * FROM pg_catalog.pg_tables", /pg_catalog/], ["SELECT * FROM information_schema.tables", /information_schema/],
    ];
    for (const [q, re] of cas) {
      const v = verifierForme(q);
      expect(v.ok, q).toBe(false);
      if (!v.ok) expect(v.motif, q).toMatch(re);
    }
  });
  it("lit les relations d'un plan, y compris sous les nœuds imbriqués et les fonctions", () => {
    const plan = [{ Plan: { "Node Type": "Aggregate", Plans: [{ "Node Type": "Seq Scan", "Relation Name": "Company" }, { "Node Type": "Function Scan", "Function Name": "generate_series" }] } }];
    expect(relationsDuPlan(plan).sort()).toEqual(["Company", "fn:generate_series"]);
  });
  it("la liste blanche ne contient ni les comptes, ni les jetons, ni les secrets", () => {
    for (const t of ["User", "Session", "PasswordResetToken", "PushSubscription", "GoogleToken", "ApiKey", "AccountInvitation"]) expect(TABLES_AUTORISEES.has(t), t).toBe(false);
  });
});

describe("l'exécution, sur la base", () => {
  it("un compte sans vue globale n'exécute RIEN — même un SELECT anodin", async () => {
    const r = await executerSqlLectureSeule(salarie, 'SELECT id FROM "Company" LIMIT 1');
    expect(r.ok).toBe(false);
    expect(r.erreur).toMatch(/vue globale/);
    expect(r.relations).toEqual([]);
  });
  it("la direction lit une table autorisée, et la réponse dit l'isolation obtenue et les relations du plan", async () => {
    const r = await executerSqlLectureSeule(direction, 'SELECT id, name FROM "Company" ORDER BY name LIMIT 3');
    expect(r.ok, r.erreur).toBe(true);
    expect(r.relations).toEqual(["Company"]);
    expect(["role_dedie", "transaction_lecture_seule"]).toContain(r.isolation);
    expect(r.colonnes.length === 0 || r.colonnes).toEqual(r.lignes.length ? ["id", "name"] : r.colonnes);
    expect(r.ms).toBeLessThan(DELAI_MS);
  });
  it("une table hors du bac est refusée par le PLAN — même cachée dans une CTE ou derrière un alias", async () => {
    const direct = await executerSqlLectureSeule(direction, 'SELECT email FROM "User" LIMIT 1');
    expect(direct.ok).toBe(false);
    expect(direct.erreur).toMatch(/hors du bac à sable : User/);
    const cte = await executerSqlLectureSeule(direction, 'WITH u AS (SELECT * FROM "User") SELECT count(*) FROM u');
    expect(cte.ok).toBe(false);
    expect(cte.erreur).toMatch(/User/);
    const alias = await executerSqlLectureSeule(direction, 'SELECT c.id FROM "Company" c JOIN "User" x ON x.id = c.id');
    expect(alias.ok).toBe(false);
    expect(alias.erreur).toMatch(/User/);
  });
  it("écrire est impossible : la forme d'abord, la transaction ensuite", async () => {
    const forme = await executerSqlLectureSeule(direction, 'INSERT INTO "Company" (id, name) VALUES (\'x\', \'y\')');
    expect(forme.ok).toBe(false);
    expect(forme.erreur).toMatch(/Requête refusée/);
    // LA SONDE : une écriture tentée dans la transaction MÊME du bac (READ ONLY + rôle) doit
    // échouer — mesuré, pas supposé. C'est le verrou que la forme ne couvre pas.
    const sonde = await verifierVerrouLectureSeule();
    expect(sonde.verrouille, sonde.detail).toBe(true);
    expect(sonde.detail).toMatch(/lecture seule|read-only|refusé par le rôle|permission denied/i);
    expect(["role_dedie", "transaction_lecture_seule"]).toContain(sonde.isolation);
  });
  it("les colonnes sensibles sont masquées à la sortie, même renommées", async () => {
    const r = await executerSqlLectureSeule(direction, 'SELECT name AS "iban", name AS "passwordHash", name FROM "Company" LIMIT 1');
    expect(r.ok, r.erreur).toBe(true);
    if (r.lignes.length) {
      expect(r.lignes[0].iban).toBe("•••");
      expect(r.lignes[0].passwordHash).toBe("•••");
      expect(r.lignes[0].name).not.toBe("•••");
    }
  });
  it("la limite tronque et le dit ; la limite demandée ne dépasse jamais le plafond", async () => {
    const r = await executerSqlLectureSeule(direction, "SELECT g AS n FROM generate_series(1, 1000) g", { limite: 100_000 });
    expect(r.ok, r.erreur).toBe(true);
    expect(r.lignes).toHaveLength(LIMITE_LIGNES);
    expect(r.tronque).toBe(true);
    const petit = await executerSqlLectureSeule(direction, "SELECT g AS n FROM generate_series(1, 10) g", { limite: 5 });
    expect(petit.lignes).toHaveLength(5);
    expect(petit.tronque).toBe(true);
  });
  it("le délai coupe une requête trop longue, et la réponse le dit en clair", async () => {
    const r = await executerSqlLectureSeule(direction, "SELECT count(*) FROM generate_series(1, 400000000) g");
    expect(r.ok).toBe(false);
    expect(r.erreur).toMatch(/délai dépassé/);
    expect(r.ms).toBeLessThan(DELAI_MS + 4_000);
  }, 20_000);
  it("un CTE, une fenêtre et une agrégation par mois passent — le « God Mode » est réel", async () => {
    const r = await executerSqlLectureSeule(direction, `
      WITH t AS (
        SELECT date_trunc('month', "createdAt") AS mois, count(*) AS n FROM "Task" GROUP BY 1
      )
      SELECT to_char(mois, 'YYYY-MM') AS periode, n, sum(n) OVER (ORDER BY mois) AS cumul, n - lag(n) OVER (ORDER BY mois) AS variation
      FROM t ORDER BY mois DESC LIMIT 6`);
    expect(r.ok, r.erreur).toBe(true);
    expect(r.relations).toEqual(["Task"]);
    if (r.lignes.length) expect(Object.keys(r.lignes[0])).toEqual(["periode", "n", "cumul", "variation"]);
  });
});
