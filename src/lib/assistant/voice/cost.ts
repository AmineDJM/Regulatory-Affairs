/**
 * LE PRIX D'UNE SESSION VOCALE — texte et audio ne coûtent pas la même chose.
 *
 * Tarifs publics du temps réel (gpt-realtime-2.1, grille relevée le 2026-09-05) : texte 4 $ / 24 $
 * par million (cache 0,40 $), audio 32 $ / 64 $ par million (cache 0,40 $). Le texte vient du
 * registre (rôle `realtime`, donc surchargeable par ADAM_PRICE_REALTIME_*) ; l'audio vient de
 * ADAM_PRICE_REALTIME_AUDIO_IN / _OUT / _CACHED_IN, avec ces valeurs publiques par défaut.
 * Un tarif texte absent (modèle hors grille sans surcharge) rend le coût INCONNU — jamais zéro.
 */
import { bindingFor } from "@/lib/models/registry";

export interface UsageVocal {
  responses: number;
  inputText: number;
  inputAudio: number;
  cachedText: number;
  cachedAudio: number;
  outputText: number;
  outputAudio: number;
}

const num = (k: string, defaut: number): number => {
  const v = Number((process.env[k] ?? "").trim());
  return Number.isFinite(v) && v >= 0 && (process.env[k] ?? "").trim() !== "" ? v : defaut;
};

export function tarifsAudio(): { inPerM: number; outPerM: number; cachedInPerM: number } {
  return {
    inPerM: num("ADAM_PRICE_REALTIME_AUDIO_IN", 32),
    outPerM: num("ADAM_PRICE_REALTIME_AUDIO_OUT", 64),
    cachedInPerM: num("ADAM_PRICE_REALTIME_AUDIO_CACHED_IN", 0.4),
  };
}

export function coutSessionVocale(u: UsageVocal): { costUsd: number | null; detail: string } {
  const texte = bindingFor("realtime");
  if (texte.priceInPerM == null || texte.priceOutPerM == null) return { costUsd: null, detail: "tarif texte du temps réel inconnu" };
  const audio = tarifsAudio();
  const cachedText = Math.min(u.cachedText, u.inputText);
  const cachedAudio = Math.min(u.cachedAudio, u.inputAudio);
  const texteIn = ((u.inputText - cachedText) * texte.priceInPerM + cachedText * (texte.priceCachedInPerM ?? texte.priceInPerM)) / 1_000_000;
  const audioIn = ((u.inputAudio - cachedAudio) * audio.inPerM + cachedAudio * audio.cachedInPerM) / 1_000_000;
  const out = (u.outputText * texte.priceOutPerM + u.outputAudio * audio.outPerM) / 1_000_000;
  const total = Math.round((texteIn + audioIn + out) * 1_000_000) / 1_000_000;
  return { costUsd: total, detail: `texte ${texteIn.toFixed(4)} $ · audio entrée ${audioIn.toFixed(4)} $ · sortie ${out.toFixed(4)} $` };
}
