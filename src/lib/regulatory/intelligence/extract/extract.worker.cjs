"use strict";
/*
 * WORKER THREAD d'extraction de texte — décharge le PARSE CPU-lourd (pdf-parse / mammoth / xlsx)
 * du thread principal pour que le serveur reste RÉACTIF pendant l'analyse des gros fichiers
 * (> 100 Mo). Plain CommonJS (aucune dépendance TS) : chargeable directement par worker_threads.
 *
 * Contrat : workerData = { kind: "pdf"|"docx"|"xlsx", bytes: ArrayBuffer } ;
 *           réponse    = { ok: true, text } | { ok: false, error }.
 * Ne renvoie que du TEXTE BRUT ; la logique métier (seuils, statut, plafonds) reste côté principal.
 */
const { parentPort, workerData } = require("worker_threads");

async function run() {
  const { kind, bytes } = workerData || {};
  const buffer = Buffer.from(bytes);

  if (kind === "pdf") {
    // Import PROFOND : évite le harnais de debug de l'index de pdf-parse (lecture d'un fichier test).
    const pdf = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdf(buffer);
    return data && typeof data.text === "string" ? data.text : "";
  }
  if (kind === "docx") {
    const mammoth = require("mammoth");
    const m = await mammoth.extractRawText({ buffer });
    return m && typeof m.value === "string" ? m.value : "";
  }
  if (kind === "xlsx") {
    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) parts.push("# " + name + "\n" + csv);
    }
    return parts.join("\n\n");
  }
  throw new Error("kind non pris en charge : " + kind);
}

run()
  .then((text) => parentPort.postMessage({ ok: true, text }))
  .catch((err) => parentPort.postMessage({ ok: false, error: String((err && err.message) || err) }));
