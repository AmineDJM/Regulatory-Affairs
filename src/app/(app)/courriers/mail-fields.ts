import type { FieldDef } from "@/components/shared/create-record-button";
import { MAIL_DIRECTION } from "@/lib/labels";

/**
 * LES CHAMPS D'UN COURRIER — une seule définition pour la création ET la modification.
 *
 * Deux listes séparées finiraient par diverger : on ajouterait un champ à la création, la fiche
 * ne saurait plus le corriger, et le registre aurait une colonne qu'on ne peut plus rectifier.
 *
 * `values` pré-remplit le formulaire quand on rouvre une fiche. Les dates y arrivent au format
 * attendu par les champs du navigateur (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`) — voir `dateInput` /
 * `dateTimeInput` côté serveur, qui les produisent dans le MÊME fuseau que celui où l'action
 * serveur les relira : sans quoi ouvrir puis enregistrer sans rien toucher décalerait l'heure.
 */
export function mailFields(values: Partial<Record<string, string>> = {}, mode: "create" | "edit" = "edit"): FieldDef[] {
  const v = (k: string) => values[k] ?? undefined;
  return [
    { type: "text", name: "title", label: "Objet du courrier", required: true, full: true, defaultValue: v("title") },
    {
      type: "select", name: "direction", label: "Sens",
      options: Object.entries(MAIL_DIRECTION).map(([value, d]) => ({ value, label: d.label })),
      defaultValue: v("direction") ?? "OUTGOING",
    },
    { type: "text", name: "reference", label: "N° de chrono", defaultValue: v("reference") },
    { type: "text", name: "sender", label: "Expéditeur", defaultValue: v("sender") },
    { type: "text", name: "recipient", label: "Destinataire", defaultValue: v("recipient") },
    // Le départ porte l'HEURE : c'est ce qui départage deux plis du même jour.
    { type: "datetime-local", name: "sentAt", label: "Départ (date et heure)", defaultValue: v("sentAt") },
    { type: "date", name: "receivedAt", label: "Arrivée", defaultValue: v("receivedAt") },
    { type: "date", name: "acknowledgedAt", label: "Accusé de réception", defaultValue: v("acknowledgedAt") },
    { type: "text", name: "carrier", label: "Porteur (poste, coursier, e-mail…)", defaultValue: v("carrier") },
    { type: "textarea", name: "notes", label: "Notes", full: true, defaultValue: v("notes") },
    // LE PLI SCANNÉ, DÈS L'ENREGISTREMENT — c'est le moment où on l'a en main. Ou bien on
    // téléverse le scan, ou bien on désigne le fichier qui est DÉJÀ dans le Drive, qui n'est
    // alors pas recopié mais référencé. La fiche porte ensuite ses propres blocs pour les deux.
    ...(mode === "create"
      ? ([
          {
            type: "file", name: "attachment", label: "Pièces jointes", multiple: true, full: true,
            hint: "Le scan du pli, l'accusé de réception… rattachés au courrier dès sa création.",
          },
          {
            type: "drivepicker", name: "driveNodeId", label: "…ou un dossier / fichier du Drive", full: true,
            hint: "Le fichier RESTE dans le Drive : le courrier le référence, il ne le duplique pas.",
          },
        ] as FieldDef[])
      : []),
  ];
}

/** Une date pour un `<input type="date">`, dans le fuseau du serveur (celui qui la relira). */
export function dateInput(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Idem pour un `<input type="datetime-local">` : « YYYY-MM-DDTHH:mm ». */
export function dateTimeInput(d: Date | null | undefined): string | undefined {
  const day = dateInput(d);
  if (!day || !d) return undefined;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
