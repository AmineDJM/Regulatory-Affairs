/**
 * VALEURS des champs personnalisés — la part PURE, sans aucun import : chargée par les
 * composants client (carte de saisie) ET par le serveur (`custom-fields.ts` la réexporte).
 * Un composant « use client » ne doit JAMAIS importer `custom-fields.ts` (il tire Prisma →
 * « Module not found: Can't resolve 'fs' » au build de production).
 */

/** Valeur d'un champ FICHIER : la référence Drive (jamais une copie), telle que stockée. */
export interface FileFieldValue { nodeId: string; name: string }

/** Lit une valeur de champ FILE stockée — null si vide ou malformée (jamais d'exception). */
export function fileCustomValue(v: unknown): FileFieldValue | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.nodeId !== "string" || !o.nodeId) return null;
  return { nodeId: o.nodeId, name: typeof o.name === "string" && o.name ? o.name : "document" };
}
