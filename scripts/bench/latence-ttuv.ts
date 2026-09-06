/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ PASSENT LES SECONDES — et à partir de quand l'utilisateur a quelque chose d'UTILE.
 *
 *   TTUV_N=3 npm run bench:latence
 *
 * ── LES DEUX TEMPS QU'IL NE FAUT JAMAIS CONFONDRE ───────────────────────────────────────
 *
 * Le TEMPS DE COMPLÉTION et le TEMPS AVANT VALEUR UTILE ne se ressemblent pas. Un calcul
 * complexe ne finira pas toujours en trois cents millisecondes ; mais rien n'oblige à laisser
 * quelqu'un devant un écran vide pendant huit secondes. Ce banc mesure les deux séparément :
 *
 *   • RÉACTION    — le premier événement, quel qu'il soit (une trace, un bloc, un mot) ;
 *   • TTFT        — le premier MOT de texte ;
 *   • TTUV        — la première INFORMATION, c'est-à-dire le premier fragment qui porte un
 *                   fait : un chiffre, un nom propre, un statut, une date, un lien. « Bien sûr,
 *                   je vais analyser… » n'en est PAS un, et c'est tout l'enjeu de la mesure —
 *                   un TTFT flatteur s'obtient en streamant de la politesse ;
 *   • TOTAL       — la fin.
 *
 * ── ET LA DÉCOMPOSITION, SANS LAQUELLE ON N'OPTIMISE QUE PAR INTUITION ──────────────────
 *
 * Les phases du tour sont nommées à la source (`telemetry.ts`) : contexte, plan_question,
 * entites, consignes, skills, catalogue, routage, resolveur, pre_lectures, outils, modele.
 * La ligne « ailleurs » est le reste par SOUSTRACTION — c'est elle qu'on regarde en premier
 * quand elle est grosse, parce qu'elle désigne du temps que personne n'a encore réclamé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { withTurn, summarize } from "@/lib/models/telemetry";

/** Les demandes du profil, du trivial au composé — c'est l'ÉVENTAIL qui informe, pas la moyenne. */
const DEMANDES: { id: string; classe: string; texte: string }[] = [
  { id: "salutation", classe: "TRIVIAL", texte: "Bonjour Adam" },
  { id: "merci", classe: "TRIVIAL", texte: "Merci, c'est parfait" },
  { id: "fait-simple", classe: "LECTURE", texte: "Combien de dossiers réglementaires avons-nous en cours ?" },
  { id: "fiche", classe: "LECTURE", texte: "Où en est le dossier réglementaire le plus en retard ?" },
  { id: "recherche", classe: "RECHERCHE", texte: "Retrouve-moi les contrats qui arrivent à échéance cette année" },
  { id: "analyse", classe: "ANALYSE", texte: "Analyse-moi les retards Regulatory et dis-moi ce qui bloque vraiment" },
  { id: "compose", classe: "COMPOSITION", texte: "Calcule le délai moyen de traitement par service et montre-moi ça en un coup d'œil" },
];

/**
 * UN FRAGMENT PORTE-T-IL UNE INFORMATION ?
 *
 * Un chiffre, une date, une référence, un nom propre, un lien, un pourcentage. Volontairement
 * strict : on préfère mesurer un TTUV trop TARD que trop tôt. Une mesure flatteuse ne sert
 * personne, et celle-ci existe précisément pour empêcher qu'un « je m'en occupe » compte comme
 * une valeur livrée.
 */
const POLITESSE = /^[\s\p{P}]*(bien s[ûu]r|d'accord|entendu|tr[èe]s bien|je vais|je m'en occupe|laisse[- ]moi|un instant|voici|alors|ok)\b/iu;
function porteUneInformation(fragment: string): boolean {
  const t = fragment.trim();
  if (t.length < 3) return false;
  if (POLITESSE.test(t)) return false;
  if (/\d/.test(t)) return true;                                  // chiffre, date, montant, référence
  if (/\/[a-z]/.test(t)) return true;                             // un lien interne
  if (/\b[A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'-]{2,}\b/.test(t.replace(/^[^\wÀ-ÿ]*/, "").slice(1))) return true; // nom propre hors début de phrase
  return false;
}

const q = (xs: number[], p: number): number => {
  if (xs.length === 0) return 0;
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.max(0, Math.round((p / 100) * (t.length - 1))))]!;
};
const ms = (n: number | null): string => (n === null ? "    —" : `${String(Math.round(n)).padStart(5)}`);

async function main() {
  const { runAssistantStream } = await import("@/lib/assistant");
  const { personalContext } = await import("@/lib/assistant-memory");

  const row = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!row) throw new Error("pas de PDG en base");
  const user = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;

  const repetitions = Math.max(1, Number(process.env.TTUV_N ?? "2") || 2);
  type Ligne = { id: string; classe: string; reaction: number | null; ttft: number | null; ttuv: number | null; total: number; phases: Record<string, number>; appels: number; entree: number; coutUsd: number | null };
  const lignes: Ligne[] = [];

  console.log(`Profil de latence · ${DEMANDES.length} demandes × ${repetitions} passage(s)\n`);
  console.log("demande         classe        réact.  TTFT   TTUV  total   appels  entrée   phases");

  for (let r = 0; r < repetitions; r += 1) {
    for (const d of DEMANDES) {
      const t0 = Date.now();
      let reaction: number | null = null;
      let ttft: number | null = null;
      let ttuv: number | null = null;
      const perso = await personalContext(user.id).catch(() => null);
      const { resume } = await withTurn("text", async (trace) => {
        await runAssistantStream(user, [{ role: "user", content: d.texte }], (e) => {
          if (reaction === null) reaction = Date.now() - t0;
          if (e.type === "delta") {
            if (ttft === null) ttft = Date.now() - t0;
            if (ttuv === null && porteUneInformation(e.text)) ttuv = Date.now() - t0;
          }
          // Un bloc d'espace de travail (tableau, graphique) EST une information livrée.
          if (e.type === "workspace" && ttuv === null) ttuv = Date.now() - t0;
        }, { personalContext: perso });
        return { resume: summarize(trace) };
      });
      const total = Date.now() - t0;
      lignes.push({
        id: d.id, classe: d.classe, reaction, ttft, ttuv, total,
        phases: resume.phases, appels: resume.llmCalls, entree: resume.inputTokens, coutUsd: resume.costUsd,
      });
      const ph = Object.entries(resume.phases).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
      console.log(`${d.id.padEnd(15)} ${d.classe.padEnd(12)} ${ms(reaction)} ${ms(ttft)} ${ms(ttuv)} ${ms(total)}  ${String(resume.llmCalls).padStart(6)} ${String(resume.inputTokens).padStart(7)}   ${ph}`);
    }
  }

  // ── LA SYNTHÈSE — percentiles, jamais la seule moyenne ────────────────────────────────
  const parClasse = new Map<string, Ligne[]>();
  for (const l of lignes) parClasse.set(l.classe, [...(parClasse.get(l.classe) ?? []), l]);
  console.log("\n── PERCENTILES PAR CLASSE (ms) ─────────────────────────────────────────────");
  console.log("classe        n   réaction P50/P95   TTFT P50/P95   TTUV P50/P95   total P50/P95");
  for (const [classe, xs] of parClasse) {
    const col = (f: (l: Ligne) => number | null) => {
      const v = xs.map(f).filter((x): x is number => x !== null);
      return v.length ? `${String(q(v, 50)).padStart(5)}/${String(q(v, 95)).padStart(5)}` : "    —/    —";
    };
    console.log(`${classe.padEnd(12)} ${String(xs.length).padStart(2)}   ${col((l) => l.reaction).padStart(15)}  ${col((l) => l.ttft).padStart(13)}  ${col((l) => l.ttuv).padStart(13)}  ${col((l) => l.total).padStart(13)}`);
  }

  // ── OÙ PASSE LE TEMPS ─────────────────────────────────────────────────────────────────
  const somme = new Map<string, number>();
  let totalToutes = 0;
  for (const l of lignes) {
    totalToutes += l.total;
    for (const [k, v] of Object.entries(l.phases)) somme.set(k, (somme.get(k) ?? 0) + v);
  }
  const comptees = [...somme.values()].reduce((a, b) => a + b, 0);
  console.log("\n── OÙ PASSE LE TEMPS (cumul sur tous les tours) ────────────────────────────");
  for (const [k, v] of [...somme.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${String(v).padStart(7)} ms  ${String(Math.round((v / totalToutes) * 100)).padStart(3)} %`);
  }
  // « ailleurs » est ce que personne n'a réclamé : c'est la ligne à regarder en premier.
  console.log(`  ${"ailleurs".padEnd(16)} ${String(Math.max(0, totalToutes - comptees)).padStart(7)} ms  ${String(Math.round((Math.max(0, totalToutes - comptees) / totalToutes) * 100)).padStart(3)} %`);

  const sansTtuv = lignes.filter((l) => l.ttuv === null).length;
  if (sansTtuv > 0) console.log(`\n⚠️  ${sansTtuv} tour(s) n'ont JAMAIS livré d'information mesurable — ni chiffre, ni nom, ni bloc.`);
  const cout = lignes.reduce<number | null>((a, l) => (a === null || l.coutUsd === null ? null : a + l.coutUsd), 0);
  console.log(`\nCoût du profil : ${cout === null ? "INCONNU (un tarif manque)" : `$${cout.toFixed(4)}`} · ${lignes.length} tours`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
