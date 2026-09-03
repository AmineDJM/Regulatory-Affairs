import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { legalListScope, initialLegalListState, syncLegalListState, visibleLegalRows, type LegalListRow } from "./list-view";
import { effectiveStatus, expiryLevel, daysLeft } from "./lifecycle";

/**
 * DONNÉE ou AFFICHAGE ? La question que ces tests tranchent.
 *
 * « Les bons de commande disparaissent » peut vouloir dire deux choses très différentes : la
 * base a perdu le lien, ou l'écran ne le montre plus. Confondre les deux, c'est chercher des
 * heures du mauvais côté.
 *
 * Ici on vérifie les DEUX bouts sur les mêmes documents : le rattachement au dossier tient en
 * base à travers toute la séquence de navigation, ET la vue les rend tous visibles. Le bogue
 * était entièrement du côté affichage — ce fichier le prouve plutôt que de l'affirmer.
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const RACINE = `__legalview__${Date.now()}`;

/**
 * CHAQUE TEST POSE SON PROPRE DÉCOR.
 *
 * Ces deux tests partageaient un `cree` de module : le premier créait, le second lisait
 * `docIds[0]`. Quand le premier échouait, le tableau restait vide et le second échouait à
 * son tour sur `where: { id: undefined }` — une erreur Prisma qui ne parlait pas du vrai
 * problème. Le symptôme MASQUAIT la cause, ce qui est le pire défaut qu'un test puisse avoir.
 *
 * Désormais chaque test crée, lit et nettoie ce qu'il a créé, sous une étiquette qui n'est
 * qu'à lui. Un échec du premier laisse le second parfaitement lisible.
 */
async function poserDossier(tag: string): Promise<{ folderId: string; docIds: string[] }> {
  const folder = await prisma.legalFolder.create({ data: { name: `${tag} Bons de commande` }, select: { id: true } });
  const docIds: string[] = [];
  for (let n = 1; n <= 6; n += 1) {
    const d = await prisma.legalDocument.create({
      data: {
        title: `${tag} BC ${n}`,
        reference: `${tag}-BC-${n}`,
        kind: "PURCHASE_ORDER",
        counterparty: "Kwality",
        startDate: new Date("2026-01-05"),
        endDate: null, // sans échéance : jamais « à surveiller »
        folderId: folder.id,
      },
      select: { id: true },
    });
    docIds.push(d.id);
  }
  return { folderId: folder.id, docIds };
}

afterAll(async () => {
  if (!dbOk) return;
  await prisma.legalDocument.deleteMany({ where: { title: { startsWith: RACINE } } });
  await prisma.legalFolder.deleteMany({ where: { name: { startsWith: RACINE } } });
});

/** Le tableau du serveur, construit EXACTEMENT comme la page Legal le fait. */
function toRows(docs: { id: string; reference: string | null; title: string; kind: string; counterparty: string | null; startDate: Date | null; endDate: Date | null; status: string; cancelledAt: Date | null }[]): LegalListRow[] {
  const today = new Date();
  return docs.map((d) => ({
    id: d.id,
    reference: d.reference,
    title: d.title,
    kind: d.kind,
    counterparty: d.counterparty,
    startDate: d.startDate?.toISOString() ?? null,
    endDate: d.endDate?.toISOString() ?? null,
    status: effectiveStatus(d as never, today),
    expiry: expiryLevel(d as never, today),
    daysLeft: daysLeft(d as never, today),
    amount: null,
    driveNodeId: null,
    driveName: null,
    renewedFromTitle: null,
    restricted: false,
    paidDate: null,
    expenseOrderId: null,
  }));
}

suite("Legal — le rattachement tient en base, et la vue le montre", () => {
  it("six bons de commande rangés dans un dossier restent liés ET visibles à travers toute la navigation", async () => {
    // ── Le dossier « Bons de commande » et ses six pièces, comme sur la capture ──
    const TAG = `${RACINE}-nav`;
    const { folderId, docIds } = await poserDossier(TAG);
    const folder = { id: folderId };

    /** Ce que le SERVEUR sert pour un dossier donné — la requête de la page, à l'identique. */
    const servir = async (folderId: string | null) =>
      toRows(await prisma.legalDocument.findMany({
        where: { title: { startsWith: TAG }, ...(folderId ? { folderId } : {}) },
        orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
        select: {
          id: true, reference: true, title: true, kind: true, counterparty: true,
          startDate: true, endDate: true, status: true, cancelledAt: true,
        },
      }));

    // ── 1. Le lien EXISTE en base ──
    const lies = await prisma.legalDocument.count({ where: { folderId: folder.id, title: { startsWith: TAG } } });
    expect(lies).toBe(6);

    // ── 2. La séquence de la mission, avec l'état de vue qui accompagne la navigation ──
    const SCOPE_ECHEANCES = legalListScope({ folderId: null, fromExpiryAlert: true });
    const SCOPE_DOSSIER = legalListScope({ folderId: folder.id });
    const SCOPE_TOUS = legalListScope({ folderId: null });

    // Arrivée par un rappel d'échéance : le filtre « à surveiller » est posé.
    let vue = initialLegalListState(SCOPE_ECHEANCES, true);

    // Ouverture du dossier → les 6 doivent s'afficher.
    vue = syncLegalListState(vue, SCOPE_DOSSIER, false);
    expect(visibleLegalRows(await servir(folder.id), vue)).toHaveLength(6);

    // Onglet « Tous les engagements », puis retour.
    vue = syncLegalListState(vue, SCOPE_TOUS, false);
    expect(visibleLegalRows(await servir(null), vue)).toHaveLength(6);
    vue = syncLegalListState(vue, SCOPE_DOSSIER, false);
    expect(visibleLegalRows(await servir(folder.id), vue)).toHaveLength(6);

    // Rechargement complet (le composant remonte à neuf).
    vue = initialLegalListState(SCOPE_DOSSIER, false);
    expect(visibleLegalRows(await servir(folder.id), vue)).toHaveLength(6);

    // ── 3. Un flux de MODIFICATION : renommer un document ne détache rien ──
    await prisma.legalDocument.update({
      where: { id: docIds[0] },
      data: { title: `${TAG} BC 1 (corrigé)` },
    });
    expect(await prisma.legalDocument.count({ where: { folderId: folder.id, title: { startsWith: TAG } } })).toBe(6);
    expect(visibleLegalRows(await servir(folder.id), vue)).toHaveLength(6);

    // ── 4. Le lien tient TOUJOURS en base à la fin de la séquence ──
    const apres = await prisma.legalDocument.findMany({
      where: { id: { in: docIds } },
      select: { id: true, folderId: true },
    });
    expect(apres).toHaveLength(6);
    expect(apres.every((d) => d.folderId === folder.id)).toBe(true);
  });

  it("sortir un document du dossier le retire de la vue du dossier, pas de l'ERP", async () => {
    // La disparition LÉGITIME : c'est une règle métier, pas un bogue — et elle doit continuer
    // de marcher, sinon le correctif aurait figé la liste.
    const TAG = `${RACINE}-sortie`;
    const { folderId, docIds } = await poserDossier(TAG);

    const cible = docIds[0];
    await prisma.legalDocument.update({ where: { id: cible }, data: { folderId: null } });

    const dansLeDossier = await prisma.legalDocument.count({
      where: { folderId, title: { startsWith: TAG } },
    });
    expect(dansLeDossier).toBe(5);

    // …mais le document existe toujours, et se retrouve dans « non classés ».
    const nonClasse = await prisma.legalDocument.findUnique({ where: { id: cible }, select: { folderId: true } });
    expect(nonClasse?.folderId).toBeNull();
  });
});
