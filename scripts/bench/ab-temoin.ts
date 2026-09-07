/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A/B AVEC TÉMOIN — mesurer si une optimisation coûte de la qualité, sans se mentir.
 *
 *   AB_FLAG=ADAM_MON_OPTIM_DISABLED npm run bench:ab     un coupe-circuit : allumé = défaut
 *   AB_ENV="CHIEF_ROUTER_CANARY=100" npm run bench:ab    un RÉGLAGE : allumé = la valeur donnée
 *                                                        (AB_N=2 pour deux passages)
 *
 * ── POURQUOI LE TÉMOIN, ET L'HISTOIRE QUI L'A IMPOSÉ ────────────────────────────────────
 *
 * Ce banc est né pour juger un « cliquet d'escalade » : faire tourner les rondes qui ne font
 * que DÉSIGNER LA LECTURE SUIVANTE à un étage bon marché, et ne rejouer au plein effort que la
 * ronde qui rédige. L'intuition tenait sur une mesure solide — sur cinq rondes d'une analyse,
 * trois rendaient 86, 113 et 176 jetons et payaient chacune onze secondes de raisonnement.
 *
 * Première version du banc, SANS témoin : « outils identiques 4/6, faits identiques 2/6,
 * latence −26 % ». Verdict impossible à lire. Le modèle n'est pas déterministe : deux
 * exécutions de la MÊME configuration ne choisissent pas les mêmes lectures. Sans savoir de
 * combien une configuration diffère D'ELLE-MÊME, 4/6 ne distingue pas une régression d'un
 * bruit de fond — et le −26 % était, lui aussi, du bruit.
 *
 * Avec le témoin (chaque demande jouée ÉTEINT / ÉTEINT / ALLUMÉ), le verdict s'est inversé :
 * +36 % d'appels, +19 % de latence. ET LA CAUSE VALAIT LA MESURE — à effort réduit, le modèle
 * n'appelle pas les mêmes outils moins cher, il en appelle DAVANTAGE, en plus de rondes
 * (« multi » : 3 appels → 7). Choisir la lecture suivante n'est pas une tâche mécanique : le
 * raisonnement est ce qui fait tenir un plan d'outils en peu d'étapes. Le cliquet a été
 * RETIRÉ. Ce banc reste, parce que la méthode, elle, était bonne.
 *
 * ── COMMENT S'EN SERVIR POUR LA PROCHAINE OPTIMISATION ──────────────────────────────────
 *
 * Mettre l'optimisation derrière un coupe-circuit d'environnement (`X_DISABLED=1` rend le
 * comportement historique), puis `AB_FLAG=X_DISABLED npm run bench:ab`. Chaque demande tourne
 * trois fois : éteint, éteint (TÉMOIN), allumé.
 *
 *   • accord TÉMOIN = le PLANCHER DE BRUIT du modèle sur ces demandes ;
 *   • accord OPTIM  = éteint contre allumé.
 *
 * L'optimisation est innocente tant que sa colonne n'est pas SOUS celle du témoin, et seuls
 * les écarts que le témoin n'explique pas sont imprimés en clair. Ce qui est comparé :
 *
 *   • LES OUTILS CHOISIS — le vrai risque : une réponse fondée sur d'autres données n'est pas
 *     la même réponse, même si elle se lit aussi bien. On compare les ENSEMBLES, pas l'ordre ;
 *   • LES FAITS — chiffres et références. Deux rédactions diffèrent toujours par leurs mots ;
 *     ce qui compte est qu'elles portent les mêmes nombres et les mêmes dossiers ;
 *   • les appels, les jetons, le cache, le coût, le TTFT, la latence.
 *
 * ── CE QUE CE BANC NE PROUVE TOUJOURS PAS ───────────────────────────────────────────────
 *
 * Six demandes et un passage ne font pas une distribution. Le témoin borne le bruit, il ne
 * l'annule pas : un écart isolé reste à lire, pas à trancher. AB_N monte le nombre de passages
 * quand la décision le mérite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { withTurn, summarize } from "@/lib/models/telemetry";

const DEMANDES: { id: string; texte: string }[] = [
  { id: "fait-simple", texte: "Combien de dossiers réglementaires avons-nous en cours ?" },
  { id: "fiche", texte: "Où en est le dossier réglementaire le plus en retard ?" },
  { id: "recherche", texte: "Retrouve-moi les contrats qui arrivent à échéance cette année" },
  { id: "analyse", texte: "Analyse-moi les retards Regulatory et dis-moi ce qui bloque vraiment" },
  { id: "compose", texte: "Calcule le délai moyen de traitement par service et montre-moi ça en un coup d'œil" },
  { id: "multi", texte: "Quels contrats concernent des produits dont un dossier réglementaire est en retard ?" },
];

/** Les FAITS d'une réponse : ce qui doit survivre à un changement d'étage. */
function faitsDe(texte: string): { nombres: string[]; references: string[] } {
  const nombres = [...texte.matchAll(/\b\d[\d\s.,]*\b/g)].map((m) => m[0].replace(/[\s.,]/g, "")).filter((n) => n.length > 0);
  const references = [...texte.matchAll(/\b[A-Z]{2,}-\d{4}-\d+\b/g)].map((m) => m[0]);
  return { nombres: [...new Set(nombres)].sort(), references: [...new Set(references)].sort() };
}

const memesElements = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

interface Mesure {
  outils: string[];
  reponse: string;
  appels: number;
  entree: number;
  cache: number;
  cout: number | null;
  ttft: number | null;
  total: number;
}

async function unTour(user: CurrentUser, texte: string): Promise<Mesure> {
  const { runAssistantStream } = await import("@/lib/assistant");
  const t0 = Date.now();
  let ttft: number | null = null;
  let reponse = "";
  const { resume, outils } = await withTurn("text", async (trace) => {
    const r = await runAssistantStream(user, [{ role: "user", content: texte }], (e) => {
      if (e.type === "delta" && ttft === null) ttft = Date.now() - t0;
    }, {});
    reponse = r.reply ?? "";
    return { resume: summarize(trace), outils: trace.tools.map((t) => t.name) };
  });
  return {
    outils: [...new Set(outils)].sort(), reponse, appels: resume.llmCalls,
    entree: resume.inputTokens, cache: resume.cachedInputTokens, cout: resume.costUsd,
    ttft, total: Date.now() - t0,
  };
}

const pct = (avant: number, apres: number): string => {
  if (avant === 0) return "    —";
  const d = Math.round(((apres - avant) / avant) * 100);
  return `${d > 0 ? "+" : ""}${d} %`;
};

async function main() {
  const row = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!row) throw new Error("pas de PDG en base");
  const user = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;

  const passages = Math.max(1, Number(process.env.AB_N ?? "1") || 1);
  /**
   * DEUX FORMES, PARCE QU'UNE OPTIMISATION N'EST PAS TOUJOURS UN INTERRUPTEUR.
   *
   *   • AB_FLAG=X_DISABLED  — un coupe-circuit. Le bras ÉTEINT le pose à « 1 » (comportement
   *     historique), le bras ALLUMÉ le retire (l'optimisation joue).
   *   • AB_ENV="NOM=VALEUR" — un RÉGLAGE. Le bras ÉTEINT laisse le défaut du code, le bras
   *     ALLUMÉ impose la valeur. C'est la forme qu'il faut pour juger un pourcentage de canary
   *     ou un plafond, qui n'ont pas d'état « éteint ».
   */
  const drapeau = (process.env.AB_FLAG ?? "").trim();
  const reglage = (process.env.AB_ENV ?? "").trim();
  const [reglageNom, ...reste] = reglage.split("=");
  const reglageValeur = reste.join("=");
  if (!drapeau && !(reglageNom && reglageValeur)) {
    console.error("AB_FLAG ou AB_ENV manquant : nommer ce qui distingue les deux bras.");
    console.error('  ex. AB_FLAG=ADAM_MON_OPTIM_DISABLED npm run bench:ab');
    console.error('  ex. AB_ENV="CHIEF_ROUTER_CANARY=100" npm run bench:ab');
    process.exit(2);
  }
  const eteindre = () => { if (drapeau) process.env[drapeau] = "1"; if (reglageNom) delete process.env[reglageNom]; };
  const allumer = () => { if (drapeau) delete process.env[drapeau]; if (reglageNom) process.env[reglageNom] = reglageValeur; };
  console.log(`A/B avec témoin · ${drapeau || `${reglageNom}=${reglageValeur}`} · ${DEMANDES.length} demandes × ${passages} passage(s)\n`);
  console.log("demande        étage      appels  entrée   cache   coût $   TTFT  total   outils");

  const accord = { temoinOutils: 0, temoinFaits: 0, etageOutils: 0, etageFaits: 0 };
  let comparaisons = 0;
  let totalAvant = 0;
  let totalApres = 0;
  let coutAvant = 0;
  let coutApres = 0;
  let appelsAvant = 0;
  let appelsApres = 0;
  const ecarts: string[] = [];

  /** Deux tours portent-ils les mêmes outils ? les mêmes faits ? */
  const compare = (a: Mesure, b: Mesure) => ({
    outils: memesElements(a.outils, b.outils),
    faits: (() => { const x = faitsDe(a.reponse), y = faitsDe(b.reponse);
      return memesElements(x.nombres, y.nombres) && memesElements(x.references, y.references); })(),
  });

  for (let p = 0; p < passages; p += 1) {
    for (const d of DEMANDES) {
      eteindre();
      const avant = await unTour(user, d.texte);
      const temoin = await unTour(user, d.texte);
      allumer();
      const apres = await unTour(user, d.texte);
      eteindre();

      for (const [nom, m] of [["ÉTEINT", avant], ["TÉMOIN", temoin], ["ALLUMÉ", apres]] as const) {
        console.log(`${d.id.padEnd(14)} ${nom.padEnd(9)} ${String(m.appels).padStart(6)} ${String(m.entree).padStart(7)} ${String(m.cache).padStart(7)} ${(m.cout ?? 0).toFixed(4).padStart(8)} ${String(m.ttft ?? 0).padStart(6)} ${String(m.total).padStart(6)}   ${m.outils.join(", ") || "(aucun)"}`);
      }

      comparaisons += 1;
      totalAvant += avant.total; totalApres += apres.total;
      coutAvant += avant.cout ?? 0; coutApres += apres.cout ?? 0;
      appelsAvant += avant.appels; appelsApres += apres.appels;

      const t = compare(avant, temoin);
      const e = compare(avant, apres);
      if (t.outils) accord.temoinOutils += 1;
      if (t.faits) accord.temoinFaits += 1;
      if (e.outils) accord.etageOutils += 1;
      if (e.faits) accord.etageFaits += 1;

      // On n'imprime un écart d'étage QUE si le témoin, lui, était d'accord : sinon l'écart est
      // du bruit de modèle, et le confondre avec une régression ferait renoncer pour rien.
      if (t.outils && !e.outils) ecarts.push(`${d.id} · OUTILS (témoin d'accord) : éteint [${avant.outils.join(", ")}] ≠ allumé [${apres.outils.join(", ")}]`);
      if (t.faits && !e.faits) {
        const x = faitsDe(avant.reponse), y = faitsDe(apres.reponse);
        ecarts.push(`${d.id} · FAITS (témoin d'accord) : éteint {${x.nombres.join(" ")}|${x.references.join(" ")}} ≠ allumé {${y.nombres.join(" ")}|${y.references.join(" ")}}`);
      }
    }
  }

  console.log("\n── VERDICT ─────────────────────────────────────────────────────────────────");
  console.log(`                       TÉMOIN (bruit)   OPTIM`);
  console.log(`outils identiques :        ${String(accord.temoinOutils).padStart(2)}/${comparaisons}          ${String(accord.etageOutils).padStart(2)}/${comparaisons}`);
  console.log(`faits identiques  :        ${String(accord.temoinFaits).padStart(2)}/${comparaisons}          ${String(accord.etageFaits).padStart(2)}/${comparaisons}`);
  console.log(`\nappels de modèle  : ${appelsAvant} → ${appelsApres}   ${pct(appelsAvant, appelsApres)}`);
  console.log(`latence totale    : ${totalAvant} ms → ${totalApres} ms   ${pct(totalAvant, totalApres)}`);
  console.log(`coût total        : $${coutAvant.toFixed(4)} → $${coutApres.toFixed(4)}   ${pct(coutAvant, coutApres)}`);
  console.log(`\nLECTURE : l'optimisation est innocente tant que sa colonne n'est pas SOUS celle du témoin.`);
  if (ecarts.length) {
    console.log("\n── LES ÉCARTS QUE LE TÉMOIN N'EXPLIQUE PAS — les seuls à lire ──────────────");
    for (const e of ecarts) console.log(`  ${e}`);
  } else {
    console.log("\nAucun écart que le bruit du modèle n'explique déjà.");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
