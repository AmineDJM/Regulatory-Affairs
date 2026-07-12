import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { regCan } from "@/lib/regulatory/intelligence/access";
import { mistralOcrConfigured, mistralOcrSelfTest } from "@/lib/regulatory/intelligence/ocr/mistral-ocr";

/**
 * DIAGNOSTIC du moteur OCR (analyse CTD) — répond, AVANT un gros upload, à « quel moteur va
 * réellement océriser, et Mistral OCR est-il joignable ? » :
 *  - `MISTRAL_API_KEY` absente / `REG_OCR_ENGINE=tesseract` → OCR LOCAL (tesseract.js), hors ligne ;
 *  - sinon → PING réel de Mistral OCR (petite image envoyée) qui prouve la clé + le réseau sortant.
 * Le repli reste automatique en production : un échec Mistral (mode auto) bascule sur Tesseract.
 * Visiter `/api/regulatory/intelligence/ocr/diagnose` (connecté, droit d'upload de dossier).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const pref = (process.env.REG_OCR_ENGINE ?? "auto").trim().toLowerCase();
  const configured = mistralOcrConfigured();
  const activeEngine = pref !== "tesseract" && configured ? "mistral" : "tesseract";

  if (activeEngine === "tesseract") {
    return NextResponse.json({
      ok: true,
      engine: "tesseract",
      enginePref: pref,
      mistralConfigured: configured,
      message:
        pref === "tesseract"
          ? "Moteur FORCÉ sur Tesseract (REG_OCR_ENGINE=tesseract) — OCR local, hors ligne."
          : "MISTRAL_API_KEY absente → OCR local Tesseract (aucune perte, mais lent : 1-3 h sur un gros dossier). Posez MISTRAL_API_KEY pour activer Mistral OCR (quelques minutes).",
    });
  }

  const selfTest = await mistralOcrSelfTest();
  return NextResponse.json({
    ok: selfTest.ok,
    engine: "mistral",
    enginePref: pref,
    mistralConfigured: true,
    selfTest,
    message: selfTest.ok
      ? `Mistral OCR opérationnel (${selfTest.engine}) — clé et réseau OK. Un dossier de 50-100 fichiers sera océrisé en quelques minutes.`
      : `Mistral OCR NON joignable : ${selfTest.error ?? "erreur inconnue"}. En mode « auto », l'app bascule automatiquement sur Tesseract (aucune perte) ; vérifiez MISTRAL_API_KEY et le réseau sortant du serveur.`,
  });
}
