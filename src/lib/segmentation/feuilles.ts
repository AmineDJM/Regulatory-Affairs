import * as XLSX from "xlsx";
import type { Feuilles } from "./lecture-classeur";

/**
 * LES FEUILLES D'UN CLASSEUR, en tableaux de cellules — côté SERVEUR (le fichier n'est jamais lu sur le poste).
 *
 * La PLAGE est recalculée sur les cellules réellement remplies : le classeur de la Direction déclare `A1:K1048165`
 * pour 324 lignes — la lire telle quelle fabriquerait un million de lignes vides (et figerait l'aperçu). Les numéros
 * de ligne restent ceux d'Excel : la plage part toujours de A1.
 */
export function lireFeuilles(buffer: Buffer): Feuilles {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const out: Feuilles = {};
  for (const n of wb.SheetNames) {
    const ws = wb.Sheets[n];
    const plage = plageUtile(ws);
    out[n] = plage ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: true, raw: true, range: plage }) : [];
  }
  return out;
}

/** La plage A1:… qui couvre les cellules NON VIDES d'une feuille, ou null si elle n'en a aucune. */
export function plageUtile(ws: XLSX.WorkSheet): string | null {
  let maxR = -1, maxC = -1;
  for (const k of Object.keys(ws)) {
    if (k.charCodeAt(0) === 33) continue; // « !ref », « !merges »…
    const c = ws[k] as XLSX.CellObject | undefined;
    if (!c || c.v === undefined || c.v === null || c.v === "") continue;
    const a = XLSX.utils.decode_cell(k);
    if (a.r > maxR) maxR = a.r;
    if (a.c > maxC) maxC = a.c;
  }
  return maxR < 0 ? null : XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}
