/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ENQUÊTEUR — la SITUATION d'une demande, établie par le CODE avant tout plan (port `Enqueteur`).
 *
 * ── CE QUE LE BANC A MONTRÉ ───────────────────────────────────────────────────────────────
 *
 * « Occupe-toi du dossier Trastuzumab et fais avancer le projet aussi vite que possible. » Le
 * planificateur, qui ne voyait que ces mots et un catalogue filtré par mots, a pris « dossier »
 * pour un dossier Drive, n'a reçu aucune capacité réglementaire, et a mis en première étape une
 * question au dirigeant. Rien de tout cela n'était une faute de raisonnement : c'était une
 * absence de FAITS.
 *
 * ── CE QUE FAIT CE MODULE ─────────────────────────────────────────────────────────────────
 *
 *   1. il RECONNAÎT les entités de la demande (dictionnaire canonique du Fabric : produits par
 *      DCI et marque, personnes, laboratoires) et les enregistrements que la recherche fédérée
 *      retrouve (contrats, factures, marchés, courriers, tâches…) ;
 *   2. il LIT ce qui compte, par les MÊMES outils de lecture que la conversation
 *      (`executeReadTool`, donc les mêmes droits) : la fiche de chaque entité principale, les
 *      changements récents, les documents liés ;
 *   3. il relit les ENGAGEMENTS ouverts du dirigeant qui touchent ces entités ;
 *   4. il en déduit les DOMAINES et les CAPACITÉS que le planificateur doit voir ;
 *   5. il rend une situation BORNÉE, chaque fait portant sa provenance, et dit quelles sources
 *      ont été consultées et lesquelles ont échoué — une source en échec n'est jamais une
 *      absence de fait.
 *
 * Tout est sous délai : une enquête qui ne finit pas rend ce qu'elle a, et le dit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { executeReadTool } from "@/lib/assistant";
import { searchEverything, type EverythingHit } from "@/lib/queries/search-everything";
import { resoudreEntitesDe } from "@/lib/fabric";
import { userCan } from "@/lib/rbac";
import type { Situation, SituationEntite, SituationFait } from "@/lib/missions/ports";

const DELAI_DEFAUT_MS = 9_000;
const MAX_FICHES = 3;
const MAX_HITS = 10;
const MAX_TEXTE = 700;

/** Le domaine de capacités qu'appelle une famille de résultats ou un type d'entité. PUR. */
export function domaineDe(libelle: string): string {
  const l = libelle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/produit|dossier|regul|marche|pch|appel d.offres|tender|anpp|dci/.test(l)) return "REGULATORY";
  if (/legal|contrat|avenant|juridique/.test(l)) return "LEGAL";
  if (/factur|paiement|reglement|depense|budget|fourniss|tresor|banque/.test(l)) return "FINANCE";
  if (/courrier|mail|courriel/.test(l)) return "MAIL";
  if (/calend|reunion|evenement|agenda|rendez/.test(l)) return "CALENDAR";
  if (/personne|salari|employ|rh|paie|conge/.test(l)) return "HR";
  if (/document|fichier|drive|piece/.test(l)) return "DRIVE";
  if (/tache|projet|mission|engagement|rappel/.test(l)) return "MISSION";
  if (/etablissement|hopital|client|partenaire|organisation|labo/.test(l)) return "DIRECTORY";
  return "GENERAL";
}

/**
 * LES CAPACITÉS QU'UN DOMAINE APPELLE — noms exacts du catalogue de la conversation. Le résolveur
 * ne garde que celles que la personne a réellement ; un nom inconnu tombe sans bruit.
 */
// LE SOCLE : lire, écrire à quelqu'un (en interne comme au-dehors), confier, rappeler, planifier
// un moment. « Faire avancer » un dossier passe presque toujours par une relance — interne ou
// externe — et le résolveur ne garde de toute façon que ce que la personne a le droit d'appeler.
const SOCLE = [
  "search_everything", "inspect_record", "find_documents", "read_document", "resolve_person",
  "send_message", "create_task", "plan_reminder", "gmail_prepare_mail", "send_prepared_mail", "create_calendar_event",
];
const PAR_DOMAINE: Record<string, string[]> = {
  REGULATORY: ["regulatory_operation", "pch_market_status", "what_changed", "product_360"],
  LEGAL: ["legal_operation", "what_changed"],
  FINANCE: ["read_finances", "finance_operation", "read_budget"],
  MAIL: ["gmail_search", "gmail_read_thread", "gmail_prepare_mail", "send_prepared_mail"],
  CALENDAR: ["read_calendar", "create_calendar_event", "meeting_operation"],
  HR: ["read_hr_overview", "hr_operation", "directory_lookup"],
  DRIVE: ["search_drive", "drive_operation"],
  MISSION: ["list_my_tasks", "task_operation", "update_task", "list_reminders"],
  DIRECTORY: ["directory_lookup", "directory_list"],
};

/** Les capacités suggérées pour des domaines, bornées et dans l'ordre des domaines. PUR. */
export function capacitesPour(domaines: readonly string[], max = 16): string[] {
  const out = [...SOCLE];
  for (const d of domaines) {
    for (const n of PAR_DOMAINE[d] ?? []) {
      if (!out.includes(n)) out.push(n);
      if (out.length >= max) return out;
    }
  }
  return out;
}

const court = (s: string, n = MAX_TEXTE): string => {
  const propre = s.replace(/\s+/g, " ").trim();
  return propre.length <= n ? propre : `${propre.slice(0, n - 1)}…`;
};

function faitDeHit(h: EverythingHit): SituationFait {
  const bouts = [h.titre, h.statut ? `statut ${h.statut}` : "", h.date ? `le ${h.date}` : "", h.detail].filter(Boolean);
  return { source: `recherche:${h.famille}`, texte: court(bouts.join(" — "), 260), ref: h.reference ?? null };
}

function avecDelai<T>(p: Promise<T>, ms: number, repli: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(repli), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(repli); });
  });
}

export interface OptionsEnquete { delaiMs?: number }

/**
 * ÉTABLIT LA SITUATION d'une demande pour une personne. Ne lève jamais : une base injoignable
 * rend `null` (le planificateur planifie alors comme avant, et le journal le dit).
 */
export async function enqueter(user: CurrentUser, objectif: string, opts: OptionsEnquete = {}): Promise<Situation | null> {
  const debut = Date.now();
  const delai = opts.delaiMs ?? DELAI_DEFAUT_MS;
  const restant = () => Math.max(500, delai - (Date.now() - debut));
  const sources: string[] = [];
  const enEchec: string[] = [];
  const faits: SituationFait[] = [];
  const entites: SituationEntite[] = [];
  const acteurs = new Set<string>();
  const domaines = new Set<string>();
  const refsFiche = new Set<string>();

  try {
    // ── 1. LES ENTITÉS CANONIQUES ET LA RECHERCHE FÉDÉRÉE, EN PARALLÈLE ─────────────────
    const [canoniques, recherche] = await Promise.all([
      avecDelai(resoudreEntitesDe(objectif), restant(), null),
      avecDelai(searchEverything(user as never, objectif, MAX_HITS), restant(), null),
    ]);
    if (canoniques === null) enEchec.push("dictionnaire"); else sources.push("dictionnaire");
    if (recherche === null) enEchec.push("recherche fédérée"); else sources.push("recherche fédérée");

    for (const e of canoniques ?? []) {
      const domaine = e.type === "PRODUIT" ? "REGULATORY" : e.type === "PERSONNE" ? "HR" : "DIRECTORY";
      entites.push({ type: e.type, id: e.id, label: e.label, domaine });
      domaines.add(domaine);
      if (e.type === "PERSONNE") acteurs.add(e.label);
    }
    // Les produits reconnus : leur référence ERP sert de clé de fiche. LE DROIT D'ABORD : le
    // dictionnaire reconnaît un nom pour tout le monde, mais le statut, le responsable et le
    // laboratoire d'un produit sont des données du module Regulatory — une personne qui ne le
    // voit pas à l'écran ne le voit pas davantage dans une situation de mission.
    const produits = userCan(user, "REGULATORY", "VIEW")
      ? (canoniques ?? []).filter((e) => e.type === "PRODUIT").slice(0, MAX_FICHES)
      : [];
    if (produits.length > 0) {
      const rows = await avecDelai(prisma.regulatoryProduct.findMany({
        where: { id: { in: produits.map((p) => p.id) } },
        select: { id: true, reference: true, dci: true, brandName: true, status: true, partnerLab: true, responsible: { select: { name: true } } },
      }), restant(), []);
      for (const r of rows) {
        const ent = entites.find((e) => e.id === r.id);
        if (ent) ent.ref = r.reference;
        refsFiche.add(r.reference);
        const resp = r.responsible?.name ?? null;
        if (resp) acteurs.add(`${resp} — responsable de ${r.brandName ?? r.dci}`);
        faits.push({
          source: "ERP:RegulatoryProduct",
          texte: `${r.brandName ?? r.dci} (${r.dci}) — statut ${r.status}${resp ? ` — responsable ${resp}` : ""}${r.partnerLab ? ` — laboratoire ${r.partnerLab}` : ""}`,
          ref: r.reference,
        });
      }
    }
    for (const h of (recherche?.resultats ?? []).slice(0, MAX_HITS)) {
      const d = domaineDe(h.famille);
      domaines.add(d);
      faits.push(faitDeHit(h));
      if (h.reference && refsFiche.size < MAX_FICHES && /^(REG|AO|CA|CD|CT|FA|PR|LEG|PCH)[- ]?\d/i.test(h.reference)) {
        refsFiche.add(h.reference);
      }
    }
    if (recherche?.note) faits.push({ source: "recherche fédérée", texte: court(recherche.note, 200) });

    // ── 2. LES FICHES DES ENTITÉS PRINCIPALES — même outil, mêmes droits que la conversation ──
    const fiches = await Promise.all([...refsFiche].slice(0, MAX_FICHES).map(async (ref) => {
      const texte = await avecDelai(executeReadTool("inspect_record", { reference: ref }, user), restant(), null);
      return { ref, texte };
    }));
    for (const f of fiches) {
      if (f.texte === null) { enEchec.push(`fiche ${f.ref}`); continue; }
      sources.push(`fiche ${f.ref}`);
      faits.push({ source: "fiche", texte: court(f.texte), ref: f.ref });
    }

    // ── 3. LES CHANGEMENTS RÉCENTS ET LES DOCUMENTS, sur l'entité principale ──────────────
    const principale = [...refsFiche][0] ?? entites[0]?.label ?? null;
    if (principale) {
      const [changements, documents] = await Promise.all([
        avecDelai(executeReadTool("what_changed", { reference: principale, since: "14 jours" }, user), restant(), null),
        avecDelai(executeReadTool("find_documents", { query: entites[0]?.label ?? principale, max_reads: 0 }, user), restant(), null),
      ]);
      if (changements === null) enEchec.push("changements récents"); else { sources.push("changements récents"); faits.push({ source: "what_changed:14j", texte: court(changements, 500), ref: principale }); }
      if (documents === null) enEchec.push("documents"); else { sources.push("documents"); faits.push({ source: "find_documents", texte: court(documents, 500) }); domaines.add("DRIVE"); }
    }

    // ── 4. LES ENGAGEMENTS OUVERTS DU DIRIGEANT qui touchent la demande (cloisonnés par owner) ──
    const cles = [...new Set([...entites.map((e) => e.label), ...[...refsFiche]])].filter((c) => c.length >= 4).slice(0, 6);
    if (cles.length > 0) {
      const engagements = await avecDelai(prisma.executiveCommitment.findMany({
        where: {
          ownerId: user.id, status: "OPEN",
          OR: cles.flatMap((c) => [
            { what: { contains: c, mode: "insensitive" as const } },
            { relatedRef: { contains: c, mode: "insensitive" as const } },
            { who: { contains: c, mode: "insensitive" as const } },
          ]),
        },
        select: { who: true, what: true, dueAt: true, lastNudgeAt: true },
        take: 6,
      }), restant(), null);
      if (engagements === null) enEchec.push("engagements"); else {
        sources.push("engagements");
        for (const e of engagements) {
          const retard = e.dueAt && e.dueAt.getTime() < Date.now() ? ` — EN RETARD depuis le ${e.dueAt.toLocaleDateString("fr-FR")}` : e.dueAt ? ` — échéance ${e.dueAt.toLocaleDateString("fr-FR")}` : "";
          faits.push({ source: "engagement", texte: court(`${e.who} : ${e.what}${retard}${e.lastNudgeAt ? " (déjà relancé)" : ""}`, 240) });
          acteurs.add(e.who);
          domaines.add("MISSION");
        }
      }
    }
  } catch (e) {
    enEchec.push(`enquête : ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
  }

  if (faits.length === 0 && entites.length === 0 && sources.length === 0) return null;
  const listeDomaines = [...domaines].filter((d) => d !== "GENERAL");
  return {
    entites,
    faits,
    acteurs: [...acteurs].slice(0, 8),
    domaines: listeDomaines,
    capacitesSuggerees: capacitesPour(listeDomaines),
    couverture: { sources, enEchec, ms: Date.now() - debut },
  };
}

/** Le résumé d'une situation pour le journal de mission — court, lisible, sans le détail. */
export function resumerSituation(s: Situation): string {
  const e = s.entites.slice(0, 4).map((x) => x.label).join(", ");
  return `Enquête : ${s.entites.length} entité(s)${e ? ` (${e})` : ""}, ${s.faits.length} fait(s), domaines ${s.domaines.join("+") || "aucun"}, `
    + `${s.couverture.sources.length} source(s) consultée(s)${s.couverture.enEchec.length ? `, ${s.couverture.enEchec.length} en échec` : ""}, ${s.couverture.ms} ms.`;
}
