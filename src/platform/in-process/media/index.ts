/**
 * LES MÉDIAS, côté plateforme (mandat 4 §30) — la porte par laquelle Adam LIT une image, un scan,
 * une photo : l'OCR réel de la maison (`regulatory/intelligence/ocr`, Tesseract local + secours
 * vision Luna sur les pages faibles) et l'appel vision Luna (`openai-luna`). Le pont peut connaître
 * ces modules ; `lib/assistant*` n'y ajoute pas d'import direct.
 */
export { ocrDocument, canOcr, type OcrResult, type OcrPage } from "@/lib/regulatory/intelligence/ocr/ocr-engine";
export { callLuna, lunaConfigured, lunaModel, type LunaCallInput, type LunaImage, type LunaResult } from "@/lib/openai-luna";
