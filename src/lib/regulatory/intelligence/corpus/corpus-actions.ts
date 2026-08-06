"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { regAudit } from "../audit";
import { CATALOG, FIRST_WAVE, ANPP_WATCH_PAGES, type CatalogSource } from "./catalog";
import { ingestCatalogSource, ingestSources, watchAnppPages, type IngestBatchResult, type WatchFinding } from "./ingest-catalog";

/**
 * CORPUS RÉGLEMENTAIRE — actions serveur.
 *
 * Deux gestes seulement, mais lourds de conséquences, donc gardés par
 * `regulatory.corpus.manage` et tracés :
 *   • **Ingérer** une ou plusieurs sources du catalogue (ANPP, ICH, OMS, EMA…) ;
 *   • **Relever** l'état des pages de publication de l'ANPP, pour ne pas découvrir six mois
 *     trop tard qu'une ligne directrice a changé.
 *
 * ⚠️ Deux limites tenues ici, pas ailleurs :
 *   1. Une source **sous licence** (Ph. Eur. de l'EDQM, ouvrages sous droits) est *référencée*
 *      dans le catalogue, **jamais téléchargée ni stockée**. Le catalogue le marque
 *      (`ingestible: false`) et l'ingestion le revérifie.
 *   2. Une version ingérée arrive au statut **DRAFT**. Elle ne devient opposable dans les
 *      analyses qu'après activation humaine. Aucune ligne directrice ne s'auto-proclame.
 */

interface Result { ok: boolean; error?: string; message?: string }

async function guard(): Promise<{ ok: true; userId: string; companyId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.corpus.manage") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };
  return { ok: true, userId: user.id, companyId };
}

/** Résumé lisible d'un lot d'ingestion — ce qu'on veut lire en une phrase. */
function summarize(r: IngestBatchResult): string {
  const bits: string[] = [];
  if (r.ingested > 0) bits.push(`${r.ingested} nouvelle(s) version(s) en attente d'activation`);
  if (r.unchanged > 0) bits.push(`${r.unchanged} inchangée(s)`);
  if (r.failed > 0) bits.push(`${r.failed} injoignable(s)`);
  return bits.length > 0 ? bits.join(", ") + "." : "Rien à faire.";
}

export interface IngestActionResult extends Result {
  results?: { code: string; ok: boolean; unchanged?: boolean; sections?: number; error?: string }[];
}

/**
 * Télécharge une source du catalogue. Le résultat détaille CE QUI a échoué et pourquoi :
 * une source injoignable est une information, pas un incident à masquer.
 */
export async function ingestOneSource(formData: FormData): Promise<IngestActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Source non précisée." };

  const r = await ingestCatalogSource(code, g.userId);
  await regAudit({
    companyId: g.companyId, actorId: g.userId, action: "CORPUS_INGESTED",
    detail: r.ok
      ? `Source ${code} : ${r.unchanged ? "contenu inchangé, rien créé" : `nouvelle version en DRAFT (${r.sections ?? 0} section(s))`}.`
      : `Source ${code} : échec — ${r.error}`,
  });
  revalidatePath("/regulatory/enregistrement/corpus");
  return r.ok
    ? { ok: true, message: r.unchanged ? `${code} : contenu identique, rien n'a été créé.` : `${code} : version importée (DRAFT, ${r.sections ?? 0} section(s)) — à activer.`, results: [r] }
    : { ok: false, error: `${code} : ${r.error}`, results: [r] };
}

/**
 * Télécharge un ensemble de sources : la première vague (le strict nécessaire pour analyser un
 * dossier algérien) ou tout ce qui est ingérable. Long — l'écran prévient que c'est une opération
 * de fond, et les sources sont espacées pour ne pas marteler des services publics.
 */
export async function ingestWave(formData: FormData): Promise<IngestActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  const scope = String(formData.get("scope") ?? "first");
  const sources: CatalogSource[] = scope === "all" ? CATALOG.filter((s) => s.ingestible) : FIRST_WAVE;

  const r = await ingestSources(sources.map((s) => s.code), g.userId);
  await regAudit({
    companyId: g.companyId, actorId: g.userId, action: "CORPUS_INGESTED",
    detail: `Corpus (${scope === "all" ? "tout le catalogue ingérable" : "première vague"}) : ${summarize(r)} Les nouvelles versions restent en DRAFT jusqu'à activation.`,
  });
  revalidatePath("/regulatory/enregistrement/corpus");
  return {
    ok: r.ingested + r.unchanged > 0,
    message: summarize(r),
    error: r.ingested + r.unchanged === 0 ? `Aucune source atteinte (${r.failed} échec(s)). Vérifiez l'accès réseau sortant du serveur.` : undefined,
    results: r.results.map((x) => ({ code: x.code, ok: x.ok, unchanged: x.unchanged, sections: x.sections, error: x.error })),
  };
}

export interface WatchActionResult extends Result {
  findings?: WatchFinding[];
}

/**
 * Relève les pages de publication de l'ANPP et SIGNALE ce qui a bougé.
 *
 * On ne réingère rien automatiquement : c'est à l'équipe de décider si un texte nouvellement
 * publié doit entrer au corpus. Le rôle de cette veille est de faire en sorte que personne ne
 * l'apprenne par une réserve.
 */
export async function runAnppWatch(): Promise<WatchActionResult> {
  const g = await guard();
  if (!g.ok) return g;

  const findings = await watchAnppPages(g.userId);
  const changed = findings.filter((f) => f.changed).length;
  const failed = findings.filter((f) => !f.ok).length;

  await regAudit({
    companyId: g.companyId, actorId: g.userId, action: "CORPUS_WATCHED",
    detail: `Veille ANPP sur ${findings.length} page(s) : ${changed > 0 ? `${changed} page(s) modifiée(s) depuis le dernier relevé` : "aucun changement"}${failed > 0 ? `, ${failed} injoignable(s)` : ""}.`,
  });
  revalidatePath("/regulatory/enregistrement/corpus");

  return {
    ok: failed < findings.length,
    message: changed > 0
      ? `${changed} page(s) ANPP ont changé depuis le dernier relevé — à examiner.`
      : failed === findings.length ? undefined : "Aucun changement détecté sur les pages surveillées.",
    error: failed === findings.length ? `Aucune page ANPP atteinte (${failed} échec(s)). Vérifiez l'accès réseau sortant du serveur.` : undefined,
    findings,
  };
}

/** Le catalogue tel qu'affiché : sans secret, mais lu côté serveur pour rester une seule source. */
export async function watchedPages(): Promise<typeof ANPP_WATCH_PAGES> {
  return ANPP_WATCH_PAGES;
}
