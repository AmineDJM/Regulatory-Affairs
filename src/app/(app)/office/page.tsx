import { redirect } from "next/navigation";

/**
 * « BUREAUTIQUE » N'EXISTE PLUS — TOUT SE FAIT DEPUIS LE DRIVE.
 *
 * Cet écran ne faisait rien que le Drive ne fasse déjà, et le faisait sur une SECONDE liste :
 * créer un document Word/Excel/PowerPoint (c'est le bouton « Nouveau document » du Drive),
 * ouvrir, partager, mettre à la corbeille. Un module de menu pour une porte d'entrée en double,
 * et deux listes vouées à diverger sur un détail — c'est ce détail qu'on remarque.
 *
 * Ce qu'il portait de réellement propre, la PAPETERIE de la société, est descendu dans le menu
 * « ⋯ » du Drive, où il n'apparaît qu'à qui la tient (assistante de direction, Super Admin) :
 * un réglage que deux personnes touchent n'a pas à occuper une entrée de menu pour tous.
 *
 * L'adresse redirige plutôt que de disparaître : elle vit dans des favoris.
 */
export default function OfficeRedirect() {
  redirect("/drive");
}
