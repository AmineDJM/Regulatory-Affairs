import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserPourEcrire } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { putBlob } from "@/lib/drive-storage";
import { validateDriveUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { canAccessConversation, signBlob } from "@/lib/messaging";
import { folderZipName, rootFolderName } from "@/lib/messaging-attachments";
import { ecrireZip, ErreurZipLimite, type EntreeZip } from "@/lib/compression/zip-ecriture";

export const dynamic = "force-dynamic";

const MAX_FICHIERS = 2000;

/**
 * ENVOYER UN DOSSIER DANS UNE CONVERSATION — l'archive est faite SUR LE SERVEUR.
 *
 * Avant, le navigateur compressait le dossier lui-même (JSZip, tout en mémoire) : sur un PC modeste, un dossier
 * de quelques centaines de Mo faisait ramer, voire planter, l'onglet. Désormais le navigateur ne fait
 * qu'ENVOYER les fichiers (avec leur chemin relatif) ; c'est le serveur qui les range dans le ZIP — avec l'écrivain
 * en flux du Drive, entrée par entrée — puis le stocke comme n'importe quelle pièce jointe (même signature).
 *
 * Mêmes portes que `/api/messaging/upload` : session d'écriture, droit d'envoyer des fichiers, conversation ouverte
 * à la personne, taille maximale des pièces jointes (sur le TOTAL du dossier), exécutables refusés.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Mot de passe à changer." }, { status: 403 });
  if (!userCan(user, "MESSAGING", "UPLOAD")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const form = await req.formData();
  const conversationId = (form.get("conversationId") as string) || null;
  if (!conversationId || !(await canAccessConversation(user.id, conversationId))) {
    return NextResponse.json({ error: "Conversation non autorisée." }, { status: 403 });
  }

  const fichiers = form.getAll("file").filter((f): f is File => f instanceof File);
  const chemins = form.getAll("path").map((p) => String(p ?? ""));
  if (fichiers.length === 0) return NextResponse.json({ error: "Dossier vide." }, { status: 400 });
  if (fichiers.length > MAX_FICHIERS) {
    return NextResponse.json({ error: `Plus de ${MAX_FICHIERS} fichiers : envoyez le dossier par parties.` }, { status: 400 });
  }

  const reglages = await getAppSettings();
  const total = fichiers.reduce((s, f) => s + f.size, 0);
  const nomArchive = folderZipName(rootFolderName(chemins) ?? "Dossier");
  const refus = validateDriveUpload(nomArchive, total, reglages.maxUploadMb);
  if (refus) return NextResponse.json({ error: refus }, { status: 400 });
  // Aucun exécutable, même dans un dossier : la règle est celle d'un fichier envoyé seul.
  for (const [i, f] of fichiers.entries()) {
    const erreur = validateDriveUpload(f.name, f.size, reglages.maxUploadMb);
    if (erreur) return NextResponse.json({ error: `« ${chemins[i] || f.name} » : ${erreur}` }, { status: 400 });
  }

  async function* entrees(): AsyncGenerator<EntreeZip> {
    for (const [i, f] of fichiers.entries()) {
      yield { chemin: chemins[i] || f.name, contenu: Buffer.from(await f.arrayBuffer()), date: new Date(f.lastModified || Date.now()) };
    }
  }
  const morceaux: Buffer[] = [];
  try {
    for await (const b of ecrireZip(entrees(), "max")) morceaux.push(b);
  } catch (e) {
    if (e instanceof ErreurZipLimite) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[messagerie] archive du dossier impossible", e);
    return NextResponse.json({ error: "Impossible de préparer l'archive du dossier." }, { status: 500 });
  }
  const { blobId, size } = await putBlob(Buffer.concat(morceaux));
  return NextResponse.json({ blobId, sig: signBlob(blobId), name: nomArchive, mime: "application/zip", size });
}
