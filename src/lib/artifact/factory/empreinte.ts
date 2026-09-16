/**
 * L'EMPREINTE D'UNE PIÈCE COMMERCIALE — ce qui permet de reconnaître « le même bon de commande »
 * émis deux fois par une reprise après panne : même type, même société, même tiers, mêmes lignes,
 * même date. Le numéro n'en fait pas partie, précisément parce qu'il n'est attribué qu'après.
 *
 * Module à part de `commercial.ts` parce qu'il HACHE (`node:crypto`) : le reste du modèle
 * commercial est lu par l'écran de composition des Finances, et un composant client qui tirerait
 * `crypto` casse le build de production (« Module not found: Can't resolve 'crypto' »).
 */

import { createHash } from "node:crypto";
import type { SpecDocumentCommercial } from "@/lib/artifact/factory/commercial";

const normaliser = (s: string | null | undefined): string => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function empreinteDocument(spec: Omit<SpecDocumentCommercial, "numero">, societeId: string): string {
  const corps = {
    societeId, type: spec.type, date: spec.date, tiers: normaliser(spec.tiers?.nom),
    lignes: (spec.lignes ?? []).map((l) => [
      normaliser(l.designation), l.section ? "S" : l.quantite, l.section ? 0 : l.prixUnitaire, l.remise ?? 0, l.tva ?? null,
      (l.details ?? []).map(normaliser).join("|"),
    ]),
    remiseGlobale: spec.remiseGlobale ?? 0, tvaDefaut: spec.tvaDefaut ?? null, modePaiement: spec.modePaiement ?? null,
    referenceAmont: normaliser(spec.referenceAmont), objet: normaliser(spec.objet),
    taxes: (spec.taxes ?? []).map((t) => [normaliser(t.libelle), t.taux]),
    numeroClient: normaliser(spec.numeroClient),
  };
  return createHash("sha256").update(JSON.stringify(corps)).digest("hex").slice(0, 32);
}
