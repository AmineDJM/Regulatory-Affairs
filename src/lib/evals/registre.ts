/**
 * LE REGISTRE DES MESURES — une mesure par fichier, sous `bench-out/evals/`, écrite par la matrice
 * qui la produit et relue par `npm run evals:report`.
 *
 * Pourquoi un fichier et pas la base : la suite tourne en test, sur une base jetable ; une mesure
 * est un ARTEFACT de banc (comme les JSON du banc live), pas une donnée métier. Chaque cible a son
 * fichier, donc des tests en parallèle n'écrasent que la leur, et le dernier passage fait foi.
 *
 * Ce module ne lève JAMAIS : une mesure qu'on n'a pas pu écrire se dit en console, elle ne fait
 * pas échouer la preuve qu'elle accompagne. Serveur / test seulement (`node:fs`).
 */
import fs from "node:fs";
import path from "node:path";
import { CIBLES, mesurer, type Mesure, type Observation } from "./cibles";

export const DOSSIER_MESURES = path.join(process.cwd(), "bench-out", "evals");

export interface MesureEnregistree extends Mesure {
  mesureeLe: string;
  source: string | null;
}

/** Écrit la mesure (atomique : fichier temporaire puis renommage). Rend `false` si l'écriture a échoué. */
export function enregistrerMesure(m: Mesure, source?: string | null): boolean {
  try {
    fs.mkdirSync(DOSSIER_MESURES, { recursive: true });
    const ligne: MesureEnregistree = { ...m, mesureeLe: new Date().toISOString(), source: source ?? null };
    const cible = path.join(DOSSIER_MESURES, `${m.id}.json`);
    const tmp = `${cible}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ligne, null, 2));
    fs.renameSync(tmp, cible);
    return true;
  } catch (err) {
    console.warn(`[evals] mesure « ${m.id} » non enregistrée : ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** Mesurer ET enregistrer — le geste que les matrices appellent en une ligne. */
export function consignerMesure(id: string, obs: Observation, source?: string | null, detail?: string): Mesure {
  const m = mesurer(id, obs, detail);
  enregistrerMesure(m, source);
  return m;
}

/** Relit toutes les mesures enregistrées ; une cible sans fichier n'y figure pas (elle sera dite « non mesurée »). */
export function lireMesures(): MesureEnregistree[] {
  const connues = new Set(CIBLES.map((c) => c.id));
  try {
    if (!fs.existsSync(DOSSIER_MESURES)) return [];
    const out: MesureEnregistree[] = [];
    for (const f of fs.readdirSync(DOSSIER_MESURES)) {
      if (!f.endsWith(".json")) continue;
      try {
        const m = JSON.parse(fs.readFileSync(path.join(DOSSIER_MESURES, f), "utf8")) as MesureEnregistree;
        if (m && typeof m.id === "string" && connues.has(m.id)) out.push(m);
      } catch { /* un fichier illisible n'est pas une mesure */ }
    }
    return out;
  } catch {
    return [];
  }
}
