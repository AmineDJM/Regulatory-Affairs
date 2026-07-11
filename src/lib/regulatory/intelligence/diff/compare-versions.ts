import { prisma } from "@/lib/prisma";

/**
 * COMPARAISON DE VERSIONS V1/V2 (G7) — met en évidence ce qui a changé entre deux versions
 * reçues d'un même dossier : fichiers inchangés/ajoutés/supprimés/remplacés (identité par
 * chemin d'archive, contenu par SHA-256), et évolution des faits du jumeau numérique.
 *
 * Objectif : concentrer la ré-évaluation humaine sur les changements réels, sans jamais
 * décider à sa place. Déterministe et pur (les fonctions de diff), testable hors base.
 */

export type FileStatus = "unchanged" | "added" | "removed" | "replaced";
export type FactStatus = "unchanged" | "added" | "removed" | "changed";

export interface DiffDoc {
  originalPath: string;
  originalFilename: string;
  sha256: string;
  ctdSection: string | null;
}

export interface FileDiffEntry {
  path: string;
  filename: string;
  status: FileStatus;
  ctdSection: string | null;
  oldSha?: string;
  newSha?: string;
}

export interface DiffFact {
  factKey: string;
  label: string;
  value: string | null;
}

export interface FactDiffEntry {
  factKey: string;
  label: string;
  status: FactStatus;
  oldValue: string | null;
  newValue: string | null;
}

export interface VersionDiff {
  hasOld: boolean;
  oldVersionNo: number | null;
  newVersionNo: number | null;
  files: FileDiffEntry[];
  facts: FactDiffEntry[]; // uniquement les faits ajoutés/supprimés/modifiés
  summary: { added: number; removed: number; replaced: number; unchanged: number; factsChanged: number };
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\/+/, "").trim().toLowerCase();

/** Diff de fichiers : identité par chemin d'archive normalisé, contenu par SHA-256. Pur. */
export function diffFiles(oldDocs: DiffDoc[], newDocs: DiffDoc[]): FileDiffEntry[] {
  const oldByPath = new Map(oldDocs.map((d) => [norm(d.originalPath), d]));
  const newByPath = new Map(newDocs.map((d) => [norm(d.originalPath), d]));
  const entries: FileDiffEntry[] = [];

  for (const d of newDocs) {
    const prev = oldByPath.get(norm(d.originalPath));
    if (!prev) {
      entries.push({ path: d.originalPath, filename: d.originalFilename, status: "added", ctdSection: d.ctdSection, newSha: d.sha256 });
    } else if (prev.sha256 !== d.sha256) {
      entries.push({ path: d.originalPath, filename: d.originalFilename, status: "replaced", ctdSection: d.ctdSection, oldSha: prev.sha256, newSha: d.sha256 });
    } else {
      entries.push({ path: d.originalPath, filename: d.originalFilename, status: "unchanged", ctdSection: d.ctdSection, oldSha: prev.sha256, newSha: d.sha256 });
    }
  }
  for (const d of oldDocs) {
    if (!newByPath.has(norm(d.originalPath))) {
      entries.push({ path: d.originalPath, filename: d.originalFilename, status: "removed", ctdSection: d.ctdSection, oldSha: d.sha256 });
    }
  }
  // Ordre : remplacés, ajoutés, supprimés, puis inchangés.
  const rank: Record<FileStatus, number> = { replaced: 0, added: 1, removed: 2, unchanged: 3 };
  return entries.sort((a, b) => rank[a.status] - rank[b.status] || a.path.localeCompare(b.path));
}

/** Diff de faits : ajouté/supprimé/modifié (valeur canonique). Ne renvoie pas les inchangés. Pur. */
export function diffFacts(oldFacts: DiffFact[], newFacts: DiffFact[]): FactDiffEntry[] {
  const oldByKey = new Map(oldFacts.map((f) => [f.factKey, f]));
  const newByKey = new Map(newFacts.map((f) => [f.factKey, f]));
  const out: FactDiffEntry[] = [];

  for (const f of newFacts) {
    const prev = oldByKey.get(f.factKey);
    const nv = (f.value ?? "").trim();
    if (!prev) {
      if (nv) out.push({ factKey: f.factKey, label: f.label, status: "added", oldValue: null, newValue: f.value });
    } else if ((prev.value ?? "").trim() !== nv) {
      out.push({ factKey: f.factKey, label: f.label, status: "changed", oldValue: prev.value, newValue: f.value });
    }
  }
  for (const f of oldFacts) {
    if (!newByKey.has(f.factKey) && (f.value ?? "").trim()) {
      out.push({ factKey: f.factKey, label: f.label, status: "removed", oldValue: f.value, newValue: null });
    }
  }
  return out;
}

/** Construit le diff entre les deux dernières versions d'un dossier (ou renvoie hasOld=false). */
export async function buildVersionDiff(dossierId: string): Promise<VersionDiff> {
  const versions = await prisma.regulatoryDossierVersion.findMany({
    where: { dossierId }, orderBy: { versionNo: "desc" }, take: 2, select: { id: true, versionNo: true },
  });
  const empty: VersionDiff = { hasOld: false, oldVersionNo: null, newVersionNo: versions[0]?.versionNo ?? null, files: [], facts: [], summary: { added: 0, removed: 0, replaced: 0, unchanged: 0, factsChanged: 0 } };
  if (versions.length < 2) return empty;

  const [newV, oldV] = versions;
  const [newDocs, oldDocs, newFacts, oldFacts] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersionId: newV.id }, select: { originalPath: true, originalFilename: true, sha256: true, ctdSection: true } }),
    prisma.regulatoryDocument.findMany({ where: { dossierVersionId: oldV.id }, select: { originalPath: true, originalFilename: true, sha256: true, ctdSection: true } }),
    prisma.regulatoryFact.findMany({ where: { dossierVersionId: newV.id }, select: { factKey: true, label: true, value: true, approvedValue: true } }),
    prisma.regulatoryFact.findMany({ where: { dossierVersionId: oldV.id }, select: { factKey: true, label: true, value: true, approvedValue: true } }),
  ]);

  const canon = (f: { value: string | null; approvedValue: string | null; factKey: string; label: string }): DiffFact => ({ factKey: f.factKey, label: f.label, value: f.approvedValue ?? f.value });
  const files = diffFiles(oldDocs, newDocs);
  const facts = diffFacts(oldFacts.map(canon), newFacts.map(canon));

  const summary = {
    added: files.filter((f) => f.status === "added").length,
    removed: files.filter((f) => f.status === "removed").length,
    replaced: files.filter((f) => f.status === "replaced").length,
    unchanged: files.filter((f) => f.status === "unchanged").length,
    factsChanged: facts.length,
  };
  return { hasOld: true, oldVersionNo: oldV.versionNo, newVersionNo: newV.versionNo, files, facts, summary };
}
