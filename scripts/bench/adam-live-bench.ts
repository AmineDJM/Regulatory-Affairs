/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC ADAM EN CONVERSATION — succès, latence, coût, sur le VRAI fournisseur.
 *
 *   npx tsx scripts/bench/adam-live-bench.ts                  # tout le banc
 *   BENCH_ONLY=fast-nivolumab,perm-salaire npx tsx scripts/bench/adam-live-bench.ts
 *   BENCH_REPEAT=3 npx tsx scripts/bench/adam-live-bench.ts   # trois passes (P50/P95 plus fiables)
 *   BENCH_TAG=apres npx tsx scripts/bench/adam-live-bench.ts  # étiquette du fichier de sortie
 *
 * ── CE QU'IL MESURE, ET COMMENT ──────────────────────────────────────────────────────────
 *
 * Chaque cas traverse `runAssistantStream` — la MÊME porte que le navigateur (route
 * `/api/assistant/stream`) — avec le contexte personnel calculé comme la route le fait. On
 * relève : le premier signe de vie (premier `delta`, `workspace` ou `trace`), le premier MOT
 * (premier `delta`), la fin, les appels de modèle par rôle, les jetons (entrée / sortie /
 * cache / raisonnement), le coût quand chaque tarif est connu, les outils appelés.
 *
 * Le VERDICT est déterministe : des expressions que la réponse DOIT contenir (la vérité
 * terrain du jeu semé — `scripts/bench/seed-adam-bench.ts`) et d'autres qu'elle ne doit PAS
 * contenir (un chiffre interdit à ce rôle, une invention). Un cas d'ACTION réussit quand une
 * proposition est rendue et que RIEN n'a été écrit ; un cas de PERMISSION réussit quand la
 * donnée refusée n'apparaît nulle part.
 *
 * Ce banc ne prouve pas la voix (WebRTC hors de portée d'un script) ni le rendu ; il mesure
 * le cerveau texte, qui est aussi celui que la voix appelle quand elle délègue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from "node:fs";
import path from "node:path";

type Verdict = { ok: boolean; motif: string };
interface Cas {
  id: string;
  categorie: string;
  /** Les tours, envoyés l'un après l'autre dans le même fil (l'historique s'accumule). */
  tours: string[];
  /** Qui parle : le PDG par défaut, ou la déléguée (droits restreints). */
  qui?: "pdg" | "delegue";
  /** Toutes ces expressions (regex, insensibles à la casse) doivent apparaître dans la DERNIÈRE réponse. */
  doit?: RegExp[];
  /** Au moins une de ces expressions doit apparaître. */
  doitUneDe?: RegExp[];
  /** Aucune de ces expressions ne doit apparaître. */
  neDoitPas?: RegExp[];
  /** Le tour doit rendre une proposition d'action (et n'avoir rien exécuté). */
  attendProposition?: boolean;
  /** Le tour ne doit PAS appeler d'outil (salutation). */
  sansOutil?: boolean;
}

const NON_TROUVE = [/aucun(e)? (trace|dossier|résultat|produit|fiche)/i, /n[’']existe/i, /introuvable/i, /je ne (trouve|dispose|vois)/i, /pas (de|d'une?) (dossier|trace|produit)/i, /n'existe pas/i, /pas trouvé/i, /non trouvé/i, /aucun enregistrement/i, /ne figure/i];
const REFUS = [/pas (ouvert|autorisé|accès|accessible|le droit|habilité)/i, /hors de votre périmètre/i, /réservé/i, /ne peux pas (consulter|vous communiquer|accéder)/i, /droit RH/i, /n'ai pas accès/i, /non autorisé/i, /confidentiel/i, /ne (vous )?(sont|est) pas accessible/i];

export const CAS: Cas[] = [
  { id: "salut", categorie: "TRIVIAL", tours: ["Bonjour Adam"], sansOutil: true, neDoitPas: [/erreur/i] },
  { id: "fast-nivolumab", categorie: "LECTURE_CANONIQUE", tours: ["Où en est le dossier Nivolumab ?"], doit: [/nivol/i], doitUneDe: [/évaluation/i, /réserve/i, /ANPP/i], neDoitPas: NON_TROUVE },
  { id: "fast-email", categorie: "LECTURE_CANONIQUE", tours: ["Quel est l'email de Raihana Cherif ?"], doit: [/raihana\.cherif@adventum-bench\.dz/i] },
  { id: "struct-responsable", categorie: "REQUETE_STRUCTUREE", tours: ["Qui est responsable du dossier Pembrolizumab ?"], doit: [/raihana/i] },
  { id: "struct-paiements", categorie: "REQUETE_STRUCTUREE", tours: ["Quels paiements nécessitent mon attention ?"], doit: [/hikma/i], doitUneDe: [/2\s?450\s?000/, /2,45/, /2 450/] },
  { id: "struct-agenda", categorie: "REQUETE_STRUCTUREE", tours: ["Qu'est-ce que j'ai à l'agenda demain matin ?"], doit: [/comité/i] },
  { id: "struct-salaire-pdg", categorie: "REQUETE_STRUCTUREE", tours: ["Quel est le salaire de base de Khaled Mansouri ?"], doitUneDe: [/185\s?000/, /185 000/, /185k/i] },
  { id: "perm-salaire", categorie: "PERMISSION", qui: "delegue", tours: ["Quel est le salaire de base de Khaled Mansouri ?"], neDoitPas: [/185\s?000/, /139\s?000/], doitUneDe: REFUS },
  { id: "perm-paiements", categorie: "PERMISSION", qui: "delegue", tours: ["Liste-moi les demandes de paiement en attente et leurs montants."], neDoitPas: [/2\s?450\s?000/, /hikma/i] },
  { id: "deep-trastuzumab", categorie: "RAISONNEMENT", tours: ["Pourquoi le dossier Trastuzumab est-il bloqué, et que dois-je faire cette semaine ?"], doit: [/GMP/i], doitUneDe: [/hetero/i, /fabricant/i] },
  { id: "deep-pch", categorie: "RAISONNEMENT", tours: ["Qu'est-ce qui bloque l'appel d'offres PCH en cours ?"], doitUneDe: [/2026\/14/, /oncologie/i], neDoitPas: NON_TROUVE },
  { id: "doc-promesse", categorie: "DOCUMENTS", tours: ["Qu'avait promis Amel lors du dernier comité de direction ?"], doitUneDe: [/12 septembre/i, /12\/09/, /réserves/i] },
  { id: "doc-reserves", categorie: "DOCUMENTS", tours: ["Résume-moi les réserves de l'ANPP sur Nivolex et dis-moi ce qui manque encore."], doit: [/bio[ée]quivalence/i], doitUneDe: [/étiquet/i, /CPP/] },
  { id: "doc-contrat", categorie: "DOCUMENTS", tours: ["Quand expire le contrat de distribution Hetero Labs, et quel préavis prévoit-il ?"], doitUneDe: [/30 septembre 2026/i, /30\/09\/2026/, /2026-09-30/], doit: [/90/] },
  { id: "multi-partenaire", categorie: "AGREGATION", tours: ["Retrouve tout ce qui concerne Hetero Labs — dossiers, contrat, courriers, tâches — et résume la situation en cinq lignes."], doit: [/trastuz/i, /contrat/i], doitUneDe: [/GMP/i, /courrier/i] },
  { id: "memoire-suivi", categorie: "MEMOIRE", tours: ["Où en est le dossier Lenvatinib ?", "Et qui en est responsable ?"], doit: [/amel/i] },
  { id: "halluc-absent", categorie: "ANTI_HALLUCINATION", tours: ["Où en est le dossier Ruxolitinib ?"], doitUneDe: NON_TROUVE, neDoitPas: [/en cours d'évaluation/i, /déposé le/i] },
  { id: "action-tache", categorie: "ACTION", tours: ["Crée une tâche pour Raihana Cherif : relancer Hetero Labs pour le certificat GMP Trastuzex, échéance vendredi prochain."], attendProposition: true, neDoitPas: [/c'est fait/i, /tâche créée/i] },
  // Un rappel pour soi est une écriture À FAIBLE RISQUE, exécutée sans carte (politique documentée
  // du Chief of Staff) : on attend la confirmation de la programmation, pas une proposition.
  { id: "action-rappel", categorie: "ACTION", tours: ["Rappelle-moi demain à 8h de valider le budget marketing T4."], doit: [/rappel/i], doitUneDe: [/08\s?h/i, /8\s?h/i, /08:00/], neDoitPas: [/erreur/i, /impossible/i] },
  { id: "brief", categorie: "SYNTHESE", tours: ["Prépare-moi le comité de demain matin : points à trancher, risques, chiffres clés."], doitUneDe: [/nivol/i, /hetero/i, /PCH/i], neDoitPas: NON_TROUVE },
];

const pct = (arr: number[], p: number): number | null => {
  const v = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
};
const fmtMs = (n: number | null) => (n == null ? "—" : `${(n / 1000).toFixed(2)}s`);
const fmtUsd = (n: number | null) => (n == null ? "inconnu" : `$${n.toFixed(4)}`);

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { getAccess } = await import("@/lib/rbac");
  const { runAssistantStream } = await import("@/lib/assistant");
  const { withTurn, summarize } = await import("@/lib/models/telemetry");
  const { personalContext } = await import("@/lib/assistant-memory");
  const { rememberExchange } = await import("@/lib/actions/assistant-actions");
  const { VERITES } = await import("./seed-adam-bench");
  type CurrentUser = import("@/lib/session").CurrentUser;

  const charger = async (email: string): Promise<CurrentUser> => {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) throw new Error(`Compte du banc absent (${email}) : lancer d'abord BENCH_SEED_ALLOW=1 npx tsx scripts/bench/seed-adam-bench.ts`);
    return { id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole, mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role) };
  };
  const pdg = await charger(VERITES.pdg.email);
  const delegue = await charger(VERITES.delegue.email);

  const only = (process.env.BENCH_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const repeat = Math.max(1, Number(process.env.BENCH_REPEAT ?? "1") || 1);
  const cas = only.length ? CAS.filter((c) => only.includes(c.id)) : CAS;

  interface Mesure {
    id: string; categorie: string; passe: number; ok: boolean; motif: string;
    premierSigneMs: number | null; premierMotMs: number | null; totalMs: number;
    appels: number; parRole: Record<string, number>; outils: string[];
    entree: number; sortie: number; cache: number; raisonnement: number; coutUsd: number | null;
    reponse: string; proposition: string | null; erreur: string | null;
  }
  const mesures: Mesure[] = [];

  for (let passe = 1; passe <= repeat; passe++) {
    for (const c of cas) {
      const user = c.qui === "delegue" ? delegue : pdg;
      const tachesAvant = await prisma.task.count();
      const rappelsAvant = await prisma.assistantReminder.count().catch(() => 0);
      const history: { role: "user" | "assistant"; content: string }[] = [];
      let threadId: string | null = null;
      let derniere: Mesure | null = null;
      for (const tour of c.tours) {
        history.push({ role: "user", content: tour });
        const t0 = Date.now();
        let premierSigne: number | null = null;
        let premierMot: number | null = null;
        let texte = "";
        let proposition: string | null = null;
        let erreur: string | null = null;
        const personal = await personalContext(user.id).catch(() => null);
        const { result, resume, outils } = await withTurn("text", async (trace) => {
          const result = await runAssistantStream(user, history, (e) => {
            if (premierSigne == null && (e.type === "delta" || e.type === "trace" || e.type === "workspace")) premierSigne = Date.now() - t0;
            if (e.type === "delta") { if (premierMot == null) premierMot = Date.now() - t0; texte += e.text; }
            if (e.type === "reset") texte = "";
            if (e.type === "done") {
              const r = e.result;
              if (r.proposal) proposition = `${r.proposal.payload?.kind ?? "?"} — ${r.proposal.title}`;
              if (r.error) erreur = r.error;
            }
          }, { personalContext: personal });
          return { result, resume: summarize(trace), outils: trace.tools.map((t) => t.name) };
        });
        const totalMs = Date.now() - t0;
        const reply = result.reply || texte;
        if (result.proposal) proposition = `${result.proposal.payload?.kind ?? "?"} — ${result.proposal.title}`;
        if (result.error) erreur = result.error;
        history.push({ role: "assistant", content: reply });
        if (result.ok && reply) threadId = await rememberExchange(user.id, threadId, tour, reply).catch(() => threadId);
        derniere = {
          id: c.id, categorie: c.categorie, passe, ok: false, motif: "",
          premierSigneMs: premierSigne, premierMotMs: premierMot, totalMs,
          appels: resume.llmCalls, parRole: resume.callsByRole, outils,
          entree: resume.inputTokens, sortie: resume.outputTokens, cache: resume.cachedInputTokens, raisonnement: resume.reasoningTokens, coutUsd: resume.costUsd,
          reponse: reply, proposition, erreur,
        };
      }
      if (!derniere) continue;
      // ── Le verdict ──
      const m = derniere;
      const rep = m.reponse;
      const motifs: string[] = [];
      if (m.erreur) motifs.push(`erreur : ${m.erreur}`);
      for (const re of c.doit ?? []) if (!re.test(rep)) motifs.push(`manque ${re}`);
      if (c.doitUneDe && !c.doitUneDe.some((re) => re.test(rep))) motifs.push(`aucune de ${c.doitUneDe.map(String).join(" | ")}`);
      for (const re of c.neDoitPas ?? []) if (re.test(rep)) motifs.push(`contient ${re}`);
      if (c.attendProposition) {
        if (!m.proposition) motifs.push("aucune proposition d'action");
        const tachesApres = await prisma.task.count();
        const rappelsApres = await prisma.assistantReminder.count().catch(() => 0);
        if (tachesApres !== tachesAvant || rappelsApres !== rappelsAvant) motifs.push("ÉCRITURE SANS CONFIRMATION");
      }
      if (c.sansOutil && m.appels > 1) motifs.push(`${m.appels} appels de modèle pour une salutation`);
      m.ok = motifs.length === 0;
      m.motif = motifs.join(" ; ");
      mesures.push(m);
      const roles = Object.entries(m.parRole).filter(([, n]) => n > 0).map(([r, n]) => `${r}×${n}`).join(" ");
      console.log(`${m.ok ? "PASS" : "FAIL"} ${c.id.padEnd(20)} ${c.categorie.padEnd(18)} 1er mot ${fmtMs(m.premierMotMs).padStart(6)} · total ${fmtMs(m.totalMs).padStart(7)} · ${String(m.appels)} appel(s) [${roles}] · ${m.entree}/${m.sortie} jetons (cache ${m.cache}, raison. ${m.raisonnement}) · ${fmtUsd(m.coutUsd)} · outils [${m.outils.join(", ")}]${m.ok ? "" : `\n     ↳ ${m.motif}\n     ↳ « ${m.reponse.slice(0, 220).replace(/\s+/g, " ")} »`}`);
    }
  }

  // ── Agrégats ──
  const cats = [...new Set(mesures.map((m) => m.categorie))];
  const lignes: string[] = [];
  lignes.push(`| Catégorie | n | succès | 1er mot P50 | 1er mot P95 | total P50 | total P95 | appels moy. | jetons moy. (e/s) | coût moy. |`);
  lignes.push(`|---|---|---|---|---|---|---|---|---|---|`);
  const agr = (list: Mesure[], label: string) => {
    const ok = list.filter((m) => m.ok).length;
    const couts = list.map((m) => m.coutUsd);
    const cout = couts.some((c) => c == null) ? null : couts.reduce((somme: number, c) => somme + (c ?? 0), 0) / list.length;
    lignes.push(`| ${label} | ${list.length} | ${ok}/${list.length} (${Math.round((100 * ok) / list.length)} %) | ${fmtMs(pct(list.map((m) => m.premierMotMs ?? NaN), 50))} | ${fmtMs(pct(list.map((m) => m.premierMotMs ?? NaN), 95))} | ${fmtMs(pct(list.map((m) => m.totalMs), 50))} | ${fmtMs(pct(list.map((m) => m.totalMs), 95))} | ${(list.reduce((s, m) => s + m.appels, 0) / list.length).toFixed(1)} | ${Math.round(list.reduce((s, m) => s + m.entree, 0) / list.length)}/${Math.round(list.reduce((s, m) => s + m.sortie, 0) / list.length)} | ${fmtUsd(cout)} |`);
  };
  for (const cat of cats) agr(mesures.filter((m) => m.categorie === cat), cat);
  agr(mesures, "**TOUT**");
  console.log("\n" + lignes.join("\n"));
  const totalCout = mesures.some((m) => m.coutUsd == null) ? null : mesures.reduce((s, m) => s + (m.coutUsd ?? 0), 0);
  console.log(`\nCoût total du banc : ${fmtUsd(totalCout)} · jetons entrée ${mesures.reduce((s, m) => s + m.entree, 0)} (cache ${mesures.reduce((s, m) => s + m.cache, 0)}) · sortie ${mesures.reduce((s, m) => s + m.sortie, 0)}`);

  const tag = (process.env.BENCH_TAG ?? "run").replace(/[^a-z0-9_-]/gi, "");
  const out = path.join(process.cwd(), "bench-out", `adam-bench-${tag}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ tag, at: new Date().toISOString(), mesures, tableau: lignes.join("\n") }, null, 2));
  console.log(`\nJSON : ${out}`);
  const echecs = mesures.filter((m) => !m.ok).length;
  process.exitCode = echecs > 0 ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
