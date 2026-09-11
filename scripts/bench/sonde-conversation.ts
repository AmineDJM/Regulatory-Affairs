/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SONDE DE CONVERSATION ORDINAIRE — ce qu'un dirigeant ressent, sans juge.
 *
 * Verdict du dirigeant : « je ne ressens aucune différence quand je discute avec lui, il est
 * trop faible ». Les bancs existants passent (10/10 sur les intentions, 45/48 sur les défis)
 * et ne mesurent donc PAS ce qu'il éprouve. Un banc qui passe pendant que la personne trouve
 * le produit faible mesure autre chose que l'expérience (§118.92).
 *
 * Cette sonde ne juge RIEN. Elle imprime la réponse BRUTE, les outils réellement appelés, la
 * latence et le coût — sur les phrases qu'un dirigeant tape vraiment. C'est l'observation
 * AVANT le diagnostic.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { withTurn, summarize } from "@/lib/models/telemetry";
import type { ChatTurn } from "@/lib/assistant";

const MESSAGES: { id: string; texte: string; amorce?: string }[] = [
  { id: "01-bonjour", texte: "Bonjour Adam" },
  { id: "02-ou-en-est", texte: "Où on en est ?" },
  { id: "03-a-savoir", texte: "Qu'est-ce que je dois savoir aujourd'hui ?" },
  { id: "04-urgent", texte: "Y'a quoi d'urgent ?" },
  { id: "05-bloque", texte: "Qu'est-ce qui bloque ?" },
  { id: "06-regulatory", texte: "Prépare-moi le point Regulatory pour demain" },
  { id: "07-semaine", texte: "Résume-moi la semaine" },
  { id: "08-avis", texte: "Qu'est-ce que tu en penses ?", amorce: "Où on en est sur Regulatory ?" },
  // LE CAS OÙ LE GESTE EST SANS AMBIGUÏTÉ. Les huit premiers ne le couvraient pas : sur « qu'est-ce
  // qui bloque ? », le constat le plus grave est un paiement à APPROUVER, c'est-à-dire la décision
  // d'une personne — et la consigne du prochain geste dit justement qu'on n'y propose pas de carte.
  // Un retard réglementaire, lui, attend une PIÈCE ou une RELANCE : si aucune carte n'apparaît ici
  // non plus, la cause n'est pas dans la formulation de l'exception.
  { id: "09-retards", texte: "Quels dossiers réglementaires sont en retard ?" },
];

async function main() {
  const row = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  const user = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;
  console.log(`Acteur : ${row.name} (${row.role})\n`);

  const { runAssistantStream } = await import("@/lib/assistant");
  const seul = process.env.SONDE_ONLY;

  for (const m of MESSAGES) {
    if (seul && !m.id.includes(seul)) continue;
    const historique: ChatTurn[] = [];
    if (m.amorce) {
      await withTurn("text", async () => {
        const r = await runAssistantStream(user, [{ role: "user", content: m.amorce! }], () => {}, {});
        historique.push({ role: "user", content: m.amorce! }, { role: "assistant", content: r.reply ?? "" });
        return null;
      });
    }
    const t0 = Date.now();
    let ttuv: number | null = null;
    let reponse = ""; let blocs: string[] = []; let props: string[] = [];
    const { resume, outils, refus, appels } = await withTurn("text", async (trace) => {
      const r = await runAssistantStream(user, [...historique, { role: "user", content: m.texte }], (e) => {
        if (ttuv === null && (e.type === "workspace" || e.type === "delta")) ttuv = Date.now() - t0;
        if (e.type === "workspace") blocs.push(String((e as { blocks?: unknown[] }).blocks?.length ?? "?"));
      }, {});
      reponse = r.reply ?? "";
      props = (r.proposals ?? []).map((p) => p.title);
      return { resume: summarize(trace), outils: trace.tools.map((t) => t.name), refus: trace.refus, appels: trace.calls.map((c) => ({ m: c.model, e: c.inputTokens, cache: c.cachedInputTokens, s: c.outputTokens, cout: c.costUsd })) };
    });
    const ms = Date.now() - t0;
    console.log("─".repeat(100));
    console.log(`▶ ${m.id}${m.amorce ? `  (après « ${m.amorce} »)` : ""}`);
    console.log(`  DEMANDE : « ${m.texte} »`);
    console.log(`  ⏱ ${ms} ms (TTUV ${ttuv ?? "—"} ms) · ${resume.llmCalls} appel(s) · ${resume.inputTokens} jetons d'entrée · ${resume.costUsd === null ? "—" : "$" + resume.costUsd.toFixed(4)}`);
    console.log(`  OUTILS : ${outils.length ? [...new Set(outils)].join(", ") : "AUCUN"}`);
    // PAR APPEL — sans ce détail, « 450 000 jetons d'entrée » ne dit pas si c'est le prompt de base
    // renvoyé douze fois (un défaut de CACHE) ou des résultats d'outils qui s'empilent (un défaut de PLAN).
    for (const [i, a] of appels.entries()) {
      const part = a.e > 0 ? Math.round((a.cache / a.e) * 100) : 0;
      console.log(`    #${String(i + 1).padStart(2)} ${String(a.m).padEnd(22)} entrée ${String(a.e).padStart(7)} (cache ${String(a.cache).padStart(7)} = ${String(part).padStart(3)}%) sortie ${String(a.s).padStart(5)} ${a.cout == null ? "—" : "$" + a.cout.toFixed(4)}`);
    }
    if (blocs.length) console.log(`  BLOCS D'ÉCRAN : ${blocs.join(", ")}`);
    if (props.length) console.log(`  PROPOSITIONS : ${props.join(" | ")}`);
    // UN GESTE REFUSÉ PAR LE DROIT et un geste JAMAIS TENTÉ ne se distinguent pas dans la réponse :
    // sans cette ligne, « zéro carte » pouvait aussi bien accuser le modèle que la permission (§118.98).
    if (refus.length) console.log(`  REFUS DE DROIT : ${[...new Set(refus)].join(", ")}`);
    if (!props.length) console.log(`  PROPOSITIONS : AUCUNE${refus.length ? " (voir les refus ci-dessus)" : " — aucun outil d'écriture n'a été appelé"}`);
    console.log(`  RÉPONSE :\n${reponse.split("\n").map((l) => "    " + l).join("\n")}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
