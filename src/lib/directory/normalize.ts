import { DirectoryChannel, EndpointConfidence } from "@prisma/client";

/**
 * NORMALISER UNE COORDONNÉE — pour que « Amine@Pharmagenedz.COM » et « amine@pharmagenedz.com »
 * soient reconnues comme la MÊME adresse.
 *
 * Sans cette étape, l'unicité en base ne sert à rien : on stockerait trois variantes de la même
 * boîte, chacune avec sa provenance, et le classement deviendrait un tirage au sort. La règle est
 * donc simple et sans exception — on range la forme comparable, on affiche ce qu'on veut.
 *
 * Pour les numéros, on retire tout ce qui n'est ni chiffre ni « + » : un numéro algérien s'écrit
 * de six façons différentes selon qui le tape.
 *
 * Fonctions PURES : elles vivent hors du fichier « use server » (qui ne peut exporter que de
 * l'asynchrone) et se testent sans base.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isChannel(v: string): v is DirectoryChannel {
  return v === "EMAIL" || v === "PHONE" || v === "WHATSAPP";
}

export function isConfidence(v: string): v is EndpointConfidence {
  return v === "VERIFIED_INTERNAL" || v === "VERIFIED_PROVIDER" || v === "OBSERVED_HISTORY" || v === "INFERRED";
}

/** La forme comparable — ou `null` si la valeur n'est pas utilisable telle quelle. */
export function normalizeEndpointValue(channel: DirectoryChannel | string, raw: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (channel === "EMAIL") {
    const lower = v.toLowerCase();
    return EMAIL_RE.test(lower) ? lower : null;
  }
  // Téléphone / WhatsApp : on garde les chiffres et un éventuel indicatif international.
  const digits = v.replace(/[^\d+]/g, "");
  const bare = digits.replace(/\D/g, "");
  return bare.length >= 6 ? digits : null;
}
