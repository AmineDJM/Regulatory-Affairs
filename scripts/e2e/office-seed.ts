/**
 * LE DÉCOR DU LIVE OFFICE POUR L'E2E — de vrais fichiers, par le chemin normal.
 *
 * ── POURQUOI UN SCRIPT SÉPARÉ PLUTÔT QU'UN BOUT DE `global-setup.ts` ────────────────────
 *
 * Le chargeur TypeScript de Playwright n'honore pas les alias `@/` du `tsconfig` : tout ce que
 * `globalSetup` importe doit être résolu en chemins relatifs, de proche en proche, jusqu'au
 * bout de la chaîne. Les adaptateurs et le stockage chiffré en comptent des dizaines.
 *
 * Ce script tourne donc sous `tsx`, qui résout les alias, et rend son résultat en JSON sur la
 * sortie standard. `globalSetup` l'appelle et lit ce JSON — une frontière de processus vaut
 * mieux qu'une centaine d'imports réécrits, et cela garantit que le seed utilise EXACTEMENT le
 * code de production (`putBlob`, `fixtures.ts`), pas une copie.
 *
 *   npx tsx scripts/e2e/office-seed.ts <userId>
 */

import { prisma } from "@/lib/prisma";
import { putBlob, getBlob } from "@/lib/drive-storage";
import { docxDeParagraphes, pdfNumerote } from "@/lib/artifact/adapters/fixtures";

const DOSSIER = "__e2e__ Live Office";
const NOM_DOCX = "__e2e__ Contrat Consulting Mouffok.docx";
const NOM_PDF = "__e2e__ Dossier ANPP.pdf";
const PAGES_PDF = 10;

async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) throw new Error("usage : office-seed.ts <userId>");

  // Nettoyage d'un run précédent. Les blobs devenus orphelins sont traités plus bas, à la
  // relecture : les retirer ici ne suffirait pas, et la raison mérite d'être écrite.
  await prisma.driveNode.deleteMany({ where: { name: { startsWith: "__e2e__ " } } });

  const dossier = await prisma.driveNode.create({
    data: { name: DOSSIER, type: "FOLDER", ownerId: userId, createdById: userId },
    select: { id: true },
  });

  /**
   * DÉPOSE UN FICHIER — ET VÉRIFIE QU'IL SE RELIT.
   *
   * ── LE DÉFAUT QUE CETTE RELECTURE ATTRAPE ───────────────────────────────────────────────
   *
   * `putBlob` DÉDUPLIQUE par empreinte du CLAIR, et les deux fixtures sont déterministes : à
   * contenu inchangé, l'empreinte ne bouge pas d'un run à l'autre. Un blob écrit par un run
   * ANTÉRIEUR est donc retrouvé et réutilisé — avec le chiffré qu'il portait alors. Si ce run-là
   * n'avait pas le même `NEXTAUTH_SECRET` (c'est de lui que `drive-storage` dérive la clé faute
   * de `DRIVE_ENCRYPTION_KEY`), le serveur ne sait plus le déchiffrer, et le document s'ouvre
   * sur « Unsupported state or unable to authenticate data ».
   *
   * Supprimer les nœuds `__e2e__` ne répare rien : le teardown les a DÉJÀ supprimés, et c'est le
   * blob — orphelin, invisible, mais toujours indexé par son empreinte — qui survit et se fait
   * réutiliser. Chercher les blobs « des anciens nœuds » ne trouve donc plus personne.
   *
   * ── POURQUOI RELIRE PLUTÔT QUE DEVINER ──────────────────────────────────────────────────
   *
   * Ce script tourne avec le `NEXTAUTH_SECRET` du run (`global-setup` le lui passe), donc avec
   * la MÊME clé que le serveur qui servira la page. Relire ici, c'est poser exactement la
   * question qui compte — « ce que je viens de déposer, le serveur saura-t-il l'ouvrir ? » — au
   * lieu d'énumérer les causes possibles de l'inverse. Un blob illisible est réécrit ; le geste
   * reste BORNÉ : on ne supprime qu'un blob qu'AUCUNE version ne référence plus.
   *
   * Et cela vaut au-delà du décor : le seed cesse de pouvoir mentir. S'il rend un identifiant de
   * nœud, les octets derrière sont lisibles.
   */
  const deposer = async (nom: string, octets: Buffer, mime: string): Promise<string> => {
    let { blobId, size } = await putBlob(octets);

    const relu = await getBlob(blobId).catch(() => null);
    if (!relu || !relu.equals(octets)) {
      await prisma.fileBlob.deleteMany({ where: { id: blobId, versions: { none: {} } } });
      ({ blobId, size } = await putBlob(octets));
      const revenu = await getBlob(blobId).catch(() => null);
      if (!revenu || !revenu.equals(octets)) {
        throw new Error(`Le blob de « ${nom} » ne se relit pas après réécriture — le décor E2E serait faux.`);
      }
    }

    const node = await prisma.driveNode.create({
      data: {
        name: nom, type: "FILE", parentId: dossier.id, ownerId: userId, createdById: userId,
        mimeType: mime, size, category: "Document",
        versions: { create: { blobId, version: 1, size, mimeType: mime, createdById: userId } },
      },
      select: { id: true },
    });
    return node.id;
  };

  const docxNode = await deposer(
    NOM_DOCX,
    await docxDeParagraphes(
      ["Contrat Consulting Mouffok", "Article 1 — Objet", "Article 2 — Durée", "Article 3 — Rémunération", "Article 4 — Confidentialité"],
      { premierEstTitre: true, tableau: [["Poste", "Montant"], ["Conseil", "120 000 DZD"]] },
    ),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const pdfNode = await deposer(NOM_PDF, await pdfNumerote(PAGES_PDF), "application/pdf");

  process.stdout.write(JSON.stringify({ docxNode, pdfNode }));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    await prisma.$disconnect();
    console.error(e);
    process.exit(1);
  });
