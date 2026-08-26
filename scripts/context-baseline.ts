/**
 * LA MESURE DE RÉFÉRENCE — ce qu'Adam envoie AUJOURD'HUI, avant toute optimisation.
 *
 * §1 de la mission Context OS : « MEASURE CURRENT BASELINE FIRST » et « Do not fabricate before/
 * after gains ». Ce script ne modifie rien : il construit les mêmes blocs que la vraie boucle et
 * les pèse, pour un utilisateur RÉEL de la base.
 *
 * CE QU'IL MESURE EXACTEMENT :
 *   • le prompt système du mode texte (identité + contexte + pouvoirs + doctrine) ;
 *   • le contexte compact du mode vocal ;
 *   • le POIDS DES SCHÉMAS D'OUTILS envoyés à chaque tour — le chiffre de §23, celui qu'on paie
 *     avant même que le PDG ait ouvert la bouche.
 *
 * Les caractères sont exacts ; les tokens sont estimés (cf. `context/tokens.ts`) et le script le
 * répète, parce qu'un chiffre présenté pour ce qu'il n'est pas ne vaut rien.
 *
 *   npx tsx scripts/context-baseline.ts
 */
import { PrismaClient } from "@prisma/client";
import { getAccess } from "@/lib/rbac";
import { buildChiefOfStaffContext, assistantToolsFor } from "@/lib/assistant";
import { decideRollout, configuredCanaryPercent } from "@/lib/assistant/context/rollout";
import { shortlistTools } from "@/lib/assistant/context/tool-shortlist";
import { powerToolsFor } from "@/lib/assistant/power-tools";
import { realtimeToolsFor } from "@/lib/assistant/voice-realtime";
import { measure, measureToolDefs } from "@/lib/assistant/context/tokens";
import { routeQuery } from "@/lib/assistant/context/router";
import { GOLDEN_CORPUS } from "@/lib/assistant/context/golden-corpus";
import { BUDGETS } from "@/lib/assistant/context/budget";
import type { CurrentUser } from "@/lib/session";

const prisma = new PrismaClient();

const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number) => n.toLocaleString("fr-FR");

async function main() {
  // Le PDG d'abord — c'est lui que la mission décrit. À défaut, le compte le plus puissant.
  const row = await prisma.user.findFirst({
    where: { role: { in: ["DIRECTION", "SUPER_ADMIN"] }, isActive: true },
    orderBy: { role: "asc" },
  });

  // Les droits EFFECTIFS, pas le rôle brut : c'est eux qui décident du nombre d'outils exposés,
  // et donc du poids réel du prompt. Mesurer sur un utilisateur sans droits résolus donnerait
  // un chiffre plus flatteur que la réalité.
  const user: CurrentUser | null = row
    ? {
        id: row.id, name: row.name, email: row.email, role: row.role,
        secondaryRole: row.secondaryRole, mustChangePassword: row.mustChangePassword,
        access: await getAccess(row.id, row.role),
      }
    : null;

  if (!user) {
    console.error("Aucun compte DIRECTION/SUPER_ADMIN actif : impossible de mesurer une référence réelle.");
    process.exitCode = 1;
    return;
  }

  console.log(`RÉFÉRENCE DE CONTEXTE — compte « ${user.name ?? user.email} » (${user.role})`);
  console.log("caractères = exacts · tokens = estimés (aucun tokeniseur fournisseur installé)\n");

  const texte = measure(buildChiefOfStaffContext(user));
  const voix = measure(buildChiefOfStaffContext(user, { voice: true }));

  // ⚠ CORRECTION D'UNE MESURE FAUSSE. Cette ligne pesait `powerToolsFor(user)` — les 77 outils
  // de POUVOIR seulement. Or la boucle envoie la liste ENTIÈRE (lectures + pouvoirs + export +
  // super-admin + écritures), soit 159 définitions. Le chiffre publié auparavant (~23 400
  // tokens de schémas) était donc une sous-estimation d'un facteur quatre : il décrivait un
  // sous-ensemble, pas ce qui part sur le réseau. La vraie mesure est celle-ci.
  const toutesLesDefs = assistantToolsFor(user);
  const outilsTexte = measureToolDefs(toutesLesDefs);
  const outilsPouvoir = measureToolDefs(powerToolsFor(user));
  const outilsVoix = measureToolDefs(realtimeToolsFor(user));

  const rows: [string, { chars: number; tokens: number }][] = [
    ["Prompt système — texte", texte],
    ["Schémas d'outils — texte", outilsTexte],
    ["  · dont outils de pouvoir", outilsPouvoir],
    ["TOTAL fixe par tour — texte", { chars: texte.chars + outilsTexte.chars, tokens: texte.tokens + outilsTexte.tokens }],
    ["", { chars: 0, tokens: 0 }],
    ["Contexte — voix", voix],
    ["Schémas d'outils — voix", outilsVoix],
    ["TOTAL fixe par tour — voix", { chars: voix.chars + outilsVoix.chars, tokens: voix.tokens + outilsVoix.tokens }],
  ];

  console.log(`${pad("BLOC", 32)}${pad("CARACTÈRES", 14)}TOKENS (est.)`);
  for (const [label, m] of rows) {
    if (!label) { console.log(""); continue; }
    console.log(`${pad(label, 32)}${pad(num(m.chars), 14)}${num(m.tokens)}`);
  }

  const partSchemas = outilsTexte.tokens / (texte.tokens + outilsTexte.tokens);
  console.log(`\nNombre d'outils exposés — texte : ${toutesLesDefs.length} (dont ${powerToolsFor(user).length} de pouvoir) · voix : ${realtimeToolsFor(user).length}`);
  console.log(`Part des schémas dans le contexte fixe — texte : ${(partSchemas * 100).toFixed(1)} %`);

  // ── CE QUE LE ROUTAGE CHANGERAIT (§7, §28) ────────────────────────────────────────────────
  // Aujourd'hui, CHAQUE demande paie le total fixe ci-dessus. Le routeur attribue à chacune un
  // budget. On projette ici l'écart — sans prétendre que c'est déjà en production.
  const fixe = texte.tokens + outilsTexte.tokens;
  let projete = 0;
  const parRoute = new Map<string, number>();
  for (const c of GOLDEN_CORPUS) {
    const r = routeQuery(c.utterance, c.ctx ?? {});
    parRoute.set(r.route, (parRoute.get(r.route) ?? 0) + 1);
    // Une route déterministe n'appelle aucun modèle : son coût de contexte est nul.
    projete += r.route === "FAST_DETERMINISTIC" ? 0 : BUDGETS[r.tier].max;
  }
  const n = GOLDEN_CORPUS.length;
  console.log(`\nPROJECTION SUR LE BANC (${n} demandes) — plafonds de budget, pas contexte réel :`);
  console.log(`  aujourd'hui : ${num(fixe)} tokens × ${n} = ${num(fixe * n)}`);
  console.log(`  routé       : ${num(Math.round(projete))} (moyenne ${num(Math.round(projete / n))} / tour)`);
  console.log(`  écart       : ${(100 * (1 - projete / (fixe * n))).toFixed(1)} % de contexte en moins`);
  console.log("\n  ⚠ Ce dernier chiffre est une PROJECTION calculée sur les plafonds de budget.");
  console.log("    Le gain réel se mesurera sur les tokens réellement envoyés, une fois branché.");

  for (const [route, count] of [...parRoute.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(route, 20)} ${String(count).padStart(3)}  ${((100 * count) / n).toFixed(1)} %`);
  }

  // ── CE QUI EST RÉELLEMENT BRANCHÉ ─────────────────────────────────────────────────────────
  // La projection ci-dessus porte sur des PLAFONDS de budget. Ce bloc-ci ne projette rien : il
  // pèse les schémas d'outils que `runAssistant` / `runAssistantStream` envoient VRAIMENT, en
  // rejouant la décision d'aiguillage exacte, avec le canary réellement configuré.
  const complet = assistantToolsFor(user);
  const poidsComplet = measureToolDefs(complet);

  let envoye = 0;
  const parMode = new Map<string, number>();
  for (const c of GOLDEN_CORPUS) {
    const d = decideRollout(c.utterance, { userId: user.id, ctx: c.ctx });
    parMode.set(d.mode, (parMode.get(d.mode) ?? 0) + 1);
    // FAST_READ n'envoie AUCUN schéma (le code a choisi l'outil) ; SHORTLIST envoie la liste
    // réduite du domaine ; LEGACY envoie tout, exactement comme avant.
    if (d.mode === "FAST_READ") continue;
    envoye += d.mode === "SHORTLIST"
      ? measureToolDefs(shortlistTools(complet, d.route)).tokens
      : poidsComplet.tokens;
  }
  const avant = poidsComplet.tokens * n;

  console.log(`\nSCHÉMAS D'OUTILS RÉELLEMENT ENVOYÉS (${n} demandes, canary ${configuredCanaryPercent()} %) :`);
  console.log(`  avant  : ${num(avant)} tokens (${num(poidsComplet.tokens)} × ${n}, ${complet.length} outils à chaque tour)`);
  console.log(`  après  : ${num(envoye)} tokens (moyenne ${num(Math.round(envoye / n))} / tour)`);
  console.log(`  écart  : ${(100 * (1 - envoye / avant)).toFixed(1)} % de schémas en moins`);
  for (const [mode, count] of [...parMode.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(mode, 20)} ${String(count).padStart(3)}  ${((100 * count) / n).toFixed(1)} %`);
  }
  console.log("\n  ⚠ Mesuré sur le CORPUS D'APPRENTISSAGE : sa distribution n'est pas celle de la");
  console.log("    production. Le chiffre qui comptera est celui du mode ombre en conditions réelles.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
