import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";

/**
 * Navigation DANS une archive .zip du Drive (sans la décompresser durablement) :
 *  - sans `?path=` → **liste des entrées** (JSON) pour l'affichage de l'arborescence ;
 *  - avec `?path=` → **flux d'UNE entrée** (aperçu inline, ou `?dl=1` pour télécharger).
 * Accès contrôlé EXACTEMENT comme /raw (résolution héritée de l'arbre Drive). L'archive est
 * chargée en mémoire (JSZip) → bornée en taille : au-delà, l'aperçu est refusé (téléchargez).
 */

const MAX_ZIP_PREVIEW_BYTES = 300 * 1024 * 1024; // 300 Mo : au-delà, on n'ouvre pas en mémoire
const MAX_ENTRIES = 5000; // borne la taille de la réponse « liste »

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
  txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8", md: "text/plain; charset=utf-8", log: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const mimeByName = (name: string) => MIME_BY_EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Non authentifié." }, { status: 401 });
  if (!canViewDrive(await resolveDriveAccess(user, params.id))) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });

  const node = await prisma.driveNode.findUnique({ where: { id: params.id }, select: { name: true, size: true, type: true } });
  if (!node || node.type === "FOLDER") return NextResponse.json({ ok: false, error: "Élément introuvable." }, { status: 404 });
  if (!/\.zip$/i.test(node.name)) return NextResponse.json({ ok: false, error: "Ce fichier n'est pas une archive ZIP." }, { status: 400 });
  if (node.size > MAX_ZIP_PREVIEW_BYTES) {
    return NextResponse.json({ ok: false, error: `Archive trop volumineuse pour l'aperçu (${Math.round(node.size / (1024 * 1024))} Mo). Téléchargez-la pour l'ouvrir.` }, { status: 413 });
  }

  const version = await prisma.fileVersion.findFirst({ where: { nodeId: params.id }, orderBy: { version: "desc" }, select: { blobId: true } });
  const bytes = version ? await getBlob(version.blobId) : null;
  if (!bytes) return NextResponse.json({ ok: false, error: "Contenu indisponible." }, { status: 404 });

  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); }
  catch { return NextResponse.json({ ok: false, error: "Archive illisible ou corrompue." }, { status: 422 }); }

  const path = req.nextUrl.searchParams.get("path");

  // ───────── Flux d'UNE entrée (aperçu inline / téléchargement) ─────────
  if (path) {
    const entry = zip.file(path);
    if (!entry || entry.dir) return NextResponse.json({ ok: false, error: "Entrée introuvable dans l'archive." }, { status: 404 });
    let content: Buffer;
    try { content = await entry.async("nodebuffer"); }
    catch { return NextResponse.json({ ok: false, error: "Entrée illisible." }, { status: 422 }); }
    const base = path.split("/").pop() || "fichier";
    const dl = req.nextUrl.searchParams.get("dl") === "1";
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": mimeByName(base),
        "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(base)}`,
        "Content-Length": String(content.length),
        "Cache-Control": "private, no-store",
      },
    });
  }

  // ───────── Liste des entrées (fichiers uniquement ; l'arborescence est dérivée côté client) ─────────
  const entries: { path: string; size: number | null }[] = [];
  let truncated = false;
  for (const f of Object.values(zip.files)) {
    if (f.dir) continue;
    if (entries.length >= MAX_ENTRIES) { truncated = true; break; }
    const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? null;
    entries.push({ path: f.name, size });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, "fr"));
  return NextResponse.json({ ok: true, name: node.name, count: entries.length, truncated, entries });
}
