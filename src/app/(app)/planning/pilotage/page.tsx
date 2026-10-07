import { redirect } from "next/navigation";

/**
 * Le PILOTAGE est l'ouverture de la Force de vente (Direction, 07/10) : il vit à `/planning`. L'ancienne adresse — celle
 * des alertes et des notifications déjà envoyées — y renvoie, cycle compris.
 */
export default function AnciennePagePilotage({ searchParams }: { searchParams?: { y?: string; m?: string; bu?: string } }) {
  const q = new URLSearchParams();
  for (const k of ["bu", "y", "m"] as const) { const v = searchParams?.[k]; if (v) q.set(k, v); }
  const s = q.toString();
  redirect(s ? `/planning?${s}` : "/planning");
}
