/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BANC DE COUVERTURE DE PLAN — de la demande au plan compilé, SANS exécution.
 *
 *   DIAG_N=9 DIAG_FAMILLES=COMPOSITION,STATISTIQUES,REPRESENTATION npm run bench:plan
 *
 * ── POURQUOI UN BANC QUI N'EXÉCUTE RIEN ─────────────────────────────────────────────────
 *
 * Le banc d'autonomie complet exécute les missions : il mesure tout, il coûte cher, et une
 * panne de fournisseur en milieu de parcours rend la moitié des lignes illisibles. Or les
 * questions de ce chantier se tranchent AVANT l'exécution : que le code lit-il dans la demande,
 * quelles capacités montre-t-il, et le plan porte-t-il les primitives qu'il faut ?
 *
 * Un appel de modèle par mission suffit à y répondre. C'est assez bon marché pour être rejoué
 * après chaque correction, ce qu'un banc complet n'est pas — et un banc trop cher pour être
 * rejoué ne mesure rien du tout.
 *
 * ── LA PANNE DE FOURNISSEUR EST COMPTÉE À PART ──────────────────────────────────────────
 *
 * Trois colonnes, jamais deux : COMPILÉ, REFUSÉ, PANNE. Ranger une panne d'amont parmi les
 * échecs produit ferait chuter le score pour une raison qui n'est pas la nôtre — et, le jour où
 * le fournisseur va bien, ferait croire à un progrès qui n'a pas eu lieu.
 *
 * ── CE QU'IL NE MESURE PAS ──────────────────────────────────────────────────────────────
 *
 * L'EXÉCUTION. Un plan qui compile peut échouer à l'appel, rendre un classeur vide, ou ne pas
 * satisfaire le juge. Ce banc dit que le plan est bien FORMÉ et bien COUVERT, rien de plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { engendrer } from "@/lib/evals/autonomie/corpus";


async function main() {
  const { catalogueDe } = await import("@/platform/in-process/missions/catalog");
  const { prechargerCapacitesDynamiques } = await import("@/platform/in-process/skills");
  const { assurerFormes } = await import("@/platform/in-process/missions/formes");
  const { planifier } = await import("@/lib/missions/planner/plan");
  const { compile } = await import("@/lib/missions/compiler/compile");
  const { exigencesDe, exigencesFermes } = await import("@/lib/missions/planner/primitives");
  const { raisonneur } = await import("@/platform/in-process/missions/reasoner");
  const { agentPour } = await import("@/lib/missions/agent/principal");

  const row = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!row) throw new Error("pas de PDG");
  const pdg = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;
  await prechargerCapacitesDynamiques(pdg).catch(() => 0);
  await assurerFormes();

  const [employes, produits, docs, effectif] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, select: { fullName: true }, take: 20 }),
    prisma.regulatoryProduct.findMany({ select: { brandName: true, dci: true, reference: true }, take: 20 }),
    prisma.legalDocument.findMany({ where: { counterparty: { not: null } }, select: { counterparty: true }, take: 40 }),
    prisma.employee.count({ where: { isActive: true } }),
  ]);
  const dossiersRows = await prisma.regulatoryProduct.findMany({ select: { reference: true }, take: 12 });
  const monde = {
    personnes: employes.map((e) => e.fullName.trim()).filter(Boolean),
    produits: [...new Set(produits.map((p) => p.brandName || p.dci).filter((x): x is string => Boolean(x)))],
    partenaires: [...new Set(docs.map((d) => d.counterparty).filter((x): x is string => Boolean(x)))].slice(0, 15),
    wilayas: ["Alger", "Oran", "Constantine", "Annaba", "Setif", "Blida", "Tlemcen", "Batna"],
    dossiers: dossiersRows.map((d) => d.reference).filter(Boolean),
    mois: ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"],
    effectif,
  } as never;
  const familles = (process.env.DIAG_FAMILLES ?? "COMPOSITION,STATISTIQUES,REPRESENTATION").split(",");
  const corpus = engendrer(monde, { nombre: 120, graine: 43 }).filter((m) => familles.includes(m.famille));
  const n = Number(process.env.DIAG_N ?? "9");
  const choisies = corpus.slice(0, n);

  const catalogue = catalogueDe(pdg);
  const acteur = { userId: pdg.id, label: pdg.name ?? "PDG", isAgent: false };
  const agent = agentPour({ initiatedBy: pdg.id, executedBy: pdg.id, label: pdg.name });

  let ok = 0, refuse = 0, panne = 0;
  const refus: string[] = [];
  for (const m of choisies) {
    const d = m.demande;
    const ex = exigencesDe(d);
    const fermes = exigencesFermes(d);
    const p = await planifier(d, catalogue, acteur, raisonneur, {}).catch((e) => ({ ok: false, error: String(e) } as never));
    if (!p.ok) {
      panne += 1;
      console.log(`PANNE  ${m.famille.padEnd(15)} exig=[${fermes.join(",")}] · ${String(p.error).slice(0, 90)}`);
      continue;
    }
    const c = compile(p.plan, catalogue, agent, { primitivesRequises: fermes });
    const prim = new Set(p.plan.steps.map((s) => (s.nodeType === "ARTIFACT" ? "DOCUMENT" : s.capability ? catalogue.meta(s.capability).primitive : "—")));
    if (c.ok) {
      ok += 1;
      console.log(`OK     ${m.famille.padEnd(15)} exig=[${fermes.join(",")}] plan=[${[...prim].join(",")}] ${p.plan.steps.length} étapes`);
    } else {
      refuse += 1;
      const codes = c.issues.map((i) => i.code).join(",");
      refus.push(`${m.famille}: ${codes}`);
      console.log(`REFUS  ${m.famille.padEnd(15)} exig=[${fermes.join(",")}] plan=[${[...prim].join(",")}] → ${codes}`);
      for (const i of c.issues.slice(0, 2)) console.log(`         ${i.code} ${i.stepKey ?? "plan"} : ${i.message.slice(0, 160)}`);
    }
    console.log(`         demande : ${d.slice(0, 130)}`);
    if (ex.length) console.log(`         lu : ${ex.map((e) => `${e.primitive}/${e.certitude}(${e.declencheur})`).join(" ")}`);
  }
  console.log(`\n── ${ok} compilés · ${refuse} refusés · ${panne} pannes fournisseur (sur ${choisies.length})`);
  if (refus.length) console.log(`Refus : ${refus.join(" | ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
