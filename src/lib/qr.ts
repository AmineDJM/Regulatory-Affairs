import QRCode from "qrcode";

/** Génère un QR code (PNG) — utilisé pour les badges participants / check-in. */
export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: 360, margin: 1, errorCorrectionLevel: "M" });
}

/** Génère un QR code en data URL (à intégrer directement dans une page). */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 240, margin: 1, errorCorrectionLevel: "M" });
}
