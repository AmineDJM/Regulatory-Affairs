import { redirect } from "next/navigation";

/**
 * LE DASHBOARD N'EXISTE PLUS.
 *
 * Il dessinait une section par module accessible, avec ou sans données : plus on avait de
 * droits, plus il alignait de zéros. Ce qu'il apportait vraiment — ce que je dois traiter — est
 * dans « Mon espace », et ce qu'il montrait par module se lit dans le module lui-même, à jour.
 *
 * L'adresse redirige au lieu de disparaître : elle est dans des favoris.
 */
export default function DashboardRedirect() {
  redirect("/mon-espace");
}
