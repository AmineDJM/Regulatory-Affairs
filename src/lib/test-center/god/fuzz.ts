import { validateUpload, validateDriveUpload, validateDocumentUpload } from "@/lib/storage";
import type { FindingInput } from "../types";
import { makeRng } from "./property";

/**
 * Fuzzing métier (§27) sur une surface **sensible à la sécurité** : les validateurs d'upload. On
 * bombarde de noms de fichiers et tailles aléatoires (négatifs, énormes, caractères spéciaux) et on
 * vérifie deux propriétés : (1) les validateurs sont TOTAUX (ne lèvent jamais), (2) un exécutable
 * est TOUJOURS refusé par les validateurs Drive et Documents (invariant de sécurité).
 */

const EXECUTABLE = ["exe", "msi", "bat", "cmd", "com", "scr", "jar", "js", "vbs", "ps1", "sh", "dll", "apk", "dmg", "reg", "hta"];
const SAFE = ["pdf", "docx", "xlsx", "png", "jpg", "zip", "txt", "csv"];
const CHARS = "abcABC01._-/\\ éè;:'\"()[]{}~*";

export interface FuzzReport { runs: number; crashes: number; malformed: number; securityBreaches: number; findings: FindingInput[] }

export function runFuzzing(seed = 42, runs = 500): FuzzReport {
  const rng = makeRng(seed);
  let crashes = 0, malformed = 0, securityBreaches = 0;
  const breaches: string[] = [];
  const crashSamples: string[] = [];

  for (let i = 0; i < runs; i++) {
    let name = "";
    const len = Math.floor(rng() * 26);
    for (let k = 0; k < len; k++) name += CHARS[Math.floor(rng() * CHARS.length)];
    const mode = rng();
    const ext = mode < 0.4 ? EXECUTABLE[Math.floor(rng() * EXECUTABLE.length)]
      : mode < 0.8 ? SAFE[Math.floor(rng() * SAFE.length)] : "";
    const filename = ext ? `${name}.${ext}` : name;
    const size = Math.floor((rng() - 0.05) * 300 * 1024 * 1024); // parfois négatif / énorme

    try {
      const results = [validateUpload(filename, size), validateDriveUpload(filename, size), validateDocumentUpload(filename, size)];
      for (const r of results) if (!(r === null || typeof r === "string")) malformed++;
      if (ext && EXECUTABLE.includes(ext)) {
        // Invariant : Drive et Documents doivent refuser (retour non-null).
        if (results[1] === null || results[2] === null) { securityBreaches++; if (breaches.length < 5) breaches.push(filename); }
      }
    } catch {
      crashes++; if (crashSamples.length < 5) crashSamples.push(filename);
    }
  }

  const findings: FindingInput[] = [];
  if (crashes > 0) findings.push({ severity: "HIGH", category: "fuzz", module: "DRIVE", title: `Validateur d'upload non total (${crashes})`, detail: `${crashes}/${runs} entrées font lever une exception — un validateur doit être total.`, evidence: crashSamples, confidence: "high" });
  if (securityBreaches > 0) findings.push({ severity: "CRITICAL", category: "security", module: "DRIVE", title: `Exécutable accepté à l'upload (${securityBreaches})`, detail: `${securityBreaches} fichier(s) exécutable(s) ne sont pas refusés par les validateurs Drive/Documents.`, evidence: breaches, suggestion: "Renforcer la liste de blocage des exécutables.", confidence: "high" });
  if (malformed > 0) findings.push({ severity: "MEDIUM", category: "fuzz", module: "DRIVE", title: `Retour de validation mal formé (${malformed})`, detail: `${malformed} retour(s) ne sont ni null ni chaîne.`, confidence: "medium" });

  return { runs, crashes, malformed, securityBreaches, findings };
}
