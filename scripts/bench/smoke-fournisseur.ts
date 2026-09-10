/**
 * SMOKE DU FOURNISSEUR — par le chemin du PRODUIT, pas par curl.
 *
 * §118.84 : un 401 prouve qu'on a parlé au bon serveur avec la mauvaise identité, jamais qu'on
 * a pris la bonne route. Ce script appelle `callOpenAi` avec le MÊME binding que l'assistant,
 * et DIT si la garde de sortie est armée et par quel mandataire la requête sort.
 */
import { callOpenAi } from "@/lib/models/openai";
import { bindingFor } from "@/lib/models/registry";
import { sortiesInterdites } from "@/lib/sortie/garde";

async function main(): Promise<void> {
  const t0 = Date.now();
  console.info(`[smoke] garde de sortie armée : ${sortiesInterdites()}`);
  console.info(`[smoke] HTTPS_PROXY : ${process.env.HTTPS_PROXY ?? "(aucun)"}`);
  const binding = bindingFor("worker");
  console.info(`[smoke] binding : ${binding.provider}/${binding.model} (raisonnement ${binding.reasoning})`);
  const r = await callOpenAi(binding, [{ role: "user", content: "Réponds exactement : PRÊT" }], { maxOutputTokens: 24 });
  const ms = Date.now() - t0;
  console.info(`[smoke] ok=${r.ok} configured=${r.configured} en ${ms} ms`);
  if (r.ok) {
    const texte = r.blocks.map((b) => ("text" in b ? b.text : "")).join("").slice(0, 80);
    console.info(`[smoke] texte=${JSON.stringify(texte)} jetons=${r.usage.inputTokens}/${r.usage.outputTokens} coût=${r.usage.costUsd === null ? "inconnu" : `$${r.usage.costUsd.toFixed(6)}`}`);
  } else {
    console.info(`[smoke] ÉCHEC : ${r.error}`);
  }
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
