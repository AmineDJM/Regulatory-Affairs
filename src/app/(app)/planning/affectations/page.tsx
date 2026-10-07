import { redirect } from "next/navigation";

/**
 * « Affectations » est devenu l'onglet « Produits » (Direction, 07/10) : P1 / P2 / P3 par délégué, sans visites prévues
 * ni objectifs. L'ancienne adresse y renvoie, cycle compris.
 */
export default function AnciennePageAffectations({ searchParams }: { searchParams?: { y?: string; m?: string } }) {
  const q = new URLSearchParams();
  for (const k of ["y", "m"] as const) { const v = searchParams?.[k]; if (v) q.set(k, v); }
  const s = q.toString();
  redirect(s ? `/planning/produits?${s}` : "/planning/produits");
}
