/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BAC À SABLE SQL — lire la base, jamais l'écrire (mandat 4 §25).
 *
 * ── QUATRE VERROUS, ET AUCUN N'EST UNE CONSIGNE ─────────────────────────────────────────
 *
 *   1. LA FORME : une seule instruction, qui commence par SELECT ou WITH, sans point-virgule,
 *      sans les fonctions qui touchent au système (pg_read_file, COPY, dblink, lo_*, pg_sleep,
 *      set_config, current_setting…), sans commentaires.
 *   2. LE PLAN : `EXPLAIN (FORMAT JSON)` AVANT l'exécution — les relations que Postgres va
 *      réellement toucher se lisent dans le plan, et chacune doit appartenir à la liste
 *      blanche. Une table sensible (mots de passe, jetons, clés) n'y est pas ; une table qu'un
 *      alias ou une CTE camouflerait au texte n'échappe pas au plan.
 *   3. LA TRANSACTION : `READ ONLY`, `statement_timeout` local, puis ROLLBACK. Un INSERT est
 *      refusé par Postgres lui-même ; un rôle dédié sans droit d'écriture (`amd_sandbox_ro`)
 *      est pris quand il existe, et la réponse DIT laquelle des deux isolations a servi.
 *   4. LE VOLUME : LIMIT imposé, colonnes sensibles masquées à la sortie, résultat borné.
 *
 * Réservé à la VUE GLOBALE (direction, Super Admin) : le SQL libre traverse le cloisonnement
 * par société que les outils appliquent ligne à ligne — c'est un pouvoir de direction.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";
import { hasGlobalView, type SessionUser } from "@/lib/rbac";

export const LIMITE_LIGNES = 500;
export const DELAI_MS = 5_000;

/** Les tables qu'une requête peut toucher. Tout le reste — comptes, jetons, secrets, journaux d'appels — est hors du bac. */
export const TABLES_AUTORISEES: ReadonlySet<string> = new Set([
  "Company", "Department", "Employee", "Supplier", "RegulatoryProduct", "RegulatoryDossier", "Product", "ProductAlias", "ProductRange",
  "LegalDocument", "LegalFolder", "FinanceTransaction", "ExpenseOrder", "PaymentRequest", "ValidationRequest", "ValidationStep",
  "Task", "Dossier", "MedicalDoctor", "MedicalInstitution", "PchTender", "PchOrder", "PchContractLine", "BusinessDevelopmentOpportunity",
  "BdProject", "Meeting", "MailEntry", "DriveNode", "ExecutiveDecision", "ExecutiveCommitment", "Mission", "MissionStep",
  "DataQualityFinding", "DataQualitySweep", "AssistantProvenance", "SponsoringRequest", "Event", "CongressInternational", "CongressNational",
  "BudgetEnvelope", "BudgetCategoryLine", "DepartmentBudget", "DepartmentBudgetExpense", "Sale", "FieldReport", "AuditLog",
]);

/** Les colonnes masquées à la sortie même sur une table autorisée. */
const COLONNES_MASQUEES = new Set(["passwordHash", "iban", "rib", "swift", "nationalId", "cnasNumber", "tokenVersion", "secret", "apiKey", "token", "vapidPrivateKey"]);

const INTERDITS = /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|copy|dblink|lo_import|lo_export|pg_sleep|set_config|current_setting|pg_terminate_backend|pg_cancel_backend|pg_stat_activity|pg_shadow|pg_authid|pg_user|information_schema|pg_catalog|pg_roles|txid_current|pg_advisory_lock|into\s+outfile|create|alter|drop|truncate|insert|update|delete|grant|revoke|vacuum|analyze|reindex|cluster|listen|notify|set\s+role|reset|do)\b/i;

export type VerdictForme = { ok: true; requete: string } | { ok: false; motif: string };

/** LA FORME : ce qu'on refuse avant même de demander un plan à Postgres. */
export function verifierForme(brut: string): VerdictForme {
  const q = (brut ?? "").trim().replace(/;\s*$/, "").trim();
  if (!q) return { ok: false, motif: "requête vide" };
  if (q.length > 8_000) return { ok: false, motif: "requête trop longue (8 000 caractères au plus)" };
  if (q.includes(";")) return { ok: false, motif: "une seule instruction : pas de point-virgule" };
  if (/--|\/\*/.test(q)) return { ok: false, motif: "pas de commentaires dans une requête du bac à sable" };
  if (!/^(select|with)\b/i.test(q)) return { ok: false, motif: "seul un SELECT (ou WITH … SELECT) est accepté" };
  const m = INTERDITS.exec(q);
  if (m) return { ok: false, motif: `mot ou fonction interdit : ${m[1]}` };
  return { ok: true, requete: q };
}

/** Les relations que le PLAN va toucher — la vérité, pas le texte. */
export function relationsDuPlan(plan: unknown): string[] {
  const out = new Set<string>();
  const marcher = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(marcher); return; }
    const o = n as Record<string, unknown>;
    if (typeof o["Relation Name"] === "string") out.add(o["Relation Name"] as string);
    if (typeof o["Function Name"] === "string") out.add(`fn:${o["Function Name"]}`);
    for (const v of Object.values(o)) if (v && typeof v === "object") marcher(v);
  };
  marcher(plan);
  return [...out];
}

export interface ResultatSql {
  ok: boolean;
  colonnes: string[];
  lignes: Record<string, unknown>[];
  tronque: boolean;
  ms: number;
  isolation: "role_dedie" | "transaction_lecture_seule" | null;
  relations: string[];
  erreur?: string;
}

function serialiser(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object" && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") return (v as { toNumber: () => number }).toNumber();
  return v;
}

/**
 * EXÉCUTER en lecture seule. Le résultat porte l'isolation RÉELLEMENT obtenue et les relations
 * du plan : ce que la personne lit est vérifiable, pas déclaré.
 */
export async function executerSqlLectureSeule(user: SessionUser, brut: string, opts: { limite?: number } = {}): Promise<ResultatSql> {
  const t0 = Date.now();
  const vide = (erreur: string): ResultatSql => ({ ok: false, colonnes: [], lignes: [], tronque: false, ms: Date.now() - t0, isolation: null, relations: [], erreur });
  if (!hasGlobalView(user)) return vide("Le SQL libre est réservé à la vue globale (direction, Super Admin) : il traverse le cloisonnement par société.");
  const forme = verifierForme(brut);
  if (!forme.ok) return vide(`Requête refusée — ${forme.motif}.`);
  const limite = Math.min(Math.max(opts.limite ?? LIMITE_LIGNES, 1), LIMITE_LIGNES);
  const requete = `SELECT * FROM (${forme.requete}) AS bac LIMIT ${limite + 1}`;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${DELAI_MS}`);
      let isolation: ResultatSql["isolation"] = "transaction_lecture_seule";
      try { await tx.$executeRawUnsafe("SET LOCAL ROLE amd_sandbox_ro"); isolation = "role_dedie"; } catch { /* rôle absent : la transaction en lecture seule reste le verrou */ }
      const plan = await tx.$queryRawUnsafe<{ "QUERY PLAN": unknown }[]>(`EXPLAIN (FORMAT JSON) ${requete}`);
      const relations = relationsDuPlan(plan.map((p) => p["QUERY PLAN"]));
      const interdites = relations.filter((r) => !r.startsWith("fn:") && !TABLES_AUTORISEES.has(r));
      if (interdites.length) throw new Error(`table hors du bac à sable : ${interdites.join(", ")}`);
      const fonctions = relations.filter((r) => r.startsWith("fn:")).map((r) => r.slice(3));
      if (fonctions.some((f) => /^pg_|^dblink|^lo_/i.test(f))) throw new Error(`fonction hors du bac à sable : ${fonctions.join(", ")}`);
      const brutes = await tx.$queryRawUnsafe<Record<string, unknown>[]>(requete);
      const tronque = brutes.length > limite;
      const lignes = brutes.slice(0, limite).map((l) => {
        const o: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(l)) o[k] = COLONNES_MASQUEES.has(k) ? "•••" : serialiser(v);
        return o;
      });
      const colonnes = lignes.length ? Object.keys(lignes[0]) : [];
      return { ok: true, colonnes, lignes, tronque, ms: Date.now() - t0, isolation, relations: relations.filter((r) => !r.startsWith("fn:")) };
    }, { timeout: DELAI_MS + 2_000, maxWait: 2_000 });
  } catch (e) {
    return vide(messageCourt(e));
  }
}

/** Le message qu'on rend : la cause, pas l'enrobage de Prisma (qui commence par une ligne vide). */
function messageCourt(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/canceling statement due to statement timeout|57014/i.test(msg)) return `délai dépassé (${DELAI_MS} ms)`;
  if (/read-only transaction/i.test(msg)) return "écriture refusée : transaction en lecture seule";
  if (/permission denied/i.test(msg)) return "refusé par le rôle du bac à sable (lecture seule)";
  const m = /Message: `([^`]+)`/.exec(msg);
  if (m) return m[1].slice(0, 300);
  return (msg.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "erreur").slice(0, 300);
}

/**
 * LA SONDE DU VERROU — mesurer, pas supposer : on tente une ÉCRITURE dans la même transaction
 * que le bac (READ ONLY + rôle), et on exige qu'elle échoue. Si elle passait, le bac serait une
 * porte ouverte ; ce test tourne dans la suite et peut servir de contrôle de santé.
 */
export async function verifierVerrouLectureSeule(): Promise<{ verrouille: boolean; isolation: ResultatSql["isolation"]; detail: string }> {
  let isolation: ResultatSql["isolation"] = "transaction_lecture_seule";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${DELAI_MS}`);
      try { await tx.$executeRawUnsafe("SET LOCAL ROLE amd_sandbox_ro"); isolation = "role_dedie"; } catch { /* rôle absent */ }
      await tx.$executeRawUnsafe(`INSERT INTO "DataQualitySweep" ("id", "mode") VALUES ('sonde-verrou-bac', 'SONDE')`);
      throw new Error("ÉCRITURE PASSÉE");
    }, { timeout: DELAI_MS + 2_000, maxWait: 2_000 });
    return { verrouille: false, isolation, detail: "aucune erreur : le verrou n'a pas joué" };
  } catch (e) {
    const detail = messageCourt(e);
    const passee = /ÉCRITURE PASSÉE/.test(e instanceof Error ? e.message : String(e));
    return { verrouille: !passee, isolation, detail };
  }
}
