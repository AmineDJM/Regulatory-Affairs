"use client";

import * as React from "react";
import type { EntityType } from "@prisma/client";
import { Scale, ReceiptText, Mails } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { LEGAL_DOC_KIND, MAIL_DIRECTION } from "@/lib/labels";
import { createLegalDocument } from "@/lib/actions/legal-actions";
import { createInvoice } from "@/lib/actions/invoice-actions";
import { createMailEntry } from "@/lib/actions/mail-register-actions";

/**
 * CRÉER UNE PIÈCE DÉJÀ RATTACHÉE À CETTE FICHE.
 *
 * Le rattachement ne se fait bien qu'à UN seul moment : celui où l'on crée la pièce depuis
 * l'objet qui la justifie. Demander plus tard « à quelle demande cette facture se rapporte-t-elle ? »
 * suppose de rechercher parmi des centaines d'objets — personne ne le fait, et le lien n'existe
 * jamais. Ici, le contexte est déjà là : `sourceType` / `sourceId` partent avec le formulaire, en
 * champs cachés, et le serveur les enregistre tels quels.
 *
 * Les trois natures possibles sont celles que les modèles savent rattacher : un engagement
 * (contrat, bon de commande), une facture, un courrier.
 */

type Kind = "legal" | "invoice" | "mail";

const TITLES: Record<Kind, { title: string; description: string; label: string }> = {
  legal: {
    title: "Nouvel engagement rattaché",
    description: "Contrat, bon de commande, convention… Il restera lié à cette fiche.",
    label: "Engagement",
  },
  invoice: {
    title: "Nouvelle facture rattachée",
    description: "Elle restera liée à cette fiche — on saura toujours de quoi elle vient.",
    label: "Facture",
  },
  mail: {
    title: "Nouveau courrier rattaché",
    description: "Le pli parti ou reçu pour cette affaire, inscrit au registre et lié à cette fiche.",
    label: "Courrier",
  },
};

export function AttachToSourceButtons({ entityType, entityId, reference, kinds }: {
  entityType: EntityType;
  entityId: string;
  reference: string | null;
  /** Natures proposées — par défaut les trois. Un bon de commande PCH, lui, n'appelle qu'une facture. */
  kinds?: Kind[];
}) {
  const [open, setOpen] = React.useState<Kind | null>(null);
  const offered: Kind[] = kinds ?? ["legal", "invoice", "mail"];

  // Le rattachement voyage en champs cachés : ce n'est pas un secret (le serveur revérifie ce
  // qu'il en fait), c'est un contexte que l'utilisateur n'a pas à ressaisir.
  const link: FieldDef[] = [
    { type: "hidden", name: "sourceType", value: entityType },
    { type: "hidden", name: "sourceId", value: entityId },
  ];
  // La référence de l'objet d'origine préremplit celle de la pièce : c'est ce qu'on écrirait à la
  // main, et c'est ce qui rend le rapprochement possible sur un relevé bancaire ou un tableur.
  const ref = (reference ?? "").trim() || undefined;

  // ── LE SCAN PART AVEC LA PIÈCE, ET C'EST TOUT L'INTÉRÊT ────────────────────────────────────
  //
  // On créait ici une facture ou un engagement SANS pouvoir y joindre quoi que ce soit : il
  // fallait enregistrer, retrouver la fiche dans son module, puis y téléverser le PDF. Trois
  // écrans pour une pièce qu'on a sous la main au moment où l'on saisit — donc, en pratique, un
  // PDF qui reste dans la boîte mail et une ligne d'ERP sans justificatif.
  //
  // Le champ s'appelle `attachment` : c'est le nom que `attachFormFiles` lit côté serveur, le
  // même pour les trois natures. Un second nom aurait été un second chemin à maintenir.
  const piece: FieldDef[] = [{
    type: "file", name: "attachment", label: "Pièces jointes", multiple: true, full: true,
    hint: "Le scan de la pièce — facture, bon de commande, courrier signé. Joint dès la création : c'est le seul moment où on l'a sous la main.",
  }];

  const FIELDS: Record<Kind, FieldDef[]> = {
    legal: [
      ...link,
      { type: "text", name: "title", label: "Titre exact du document", required: true, full: true },
      { type: "text", name: "reference", label: "Référence / n°", defaultValue: ref },
      { type: "select", name: "kind", label: "Nature", options: optionsFromMap(LEGAL_DOC_KIND), defaultValue: "PURCHASE_ORDER" },
      { type: "text", name: "counterparty", label: "Partie (fournisseur, prestataire)", full: true },
      { type: "date", name: "startDate", label: "Date de début (facultative)" },
      { type: "date", name: "endDate", label: "Date de fin — vide = sans échéance" },
      { type: "number", name: "amount", label: "Montant (DZD)" },
      { type: "textarea", name: "notes", label: "Notes", full: true },
      ...piece,
    ],
    invoice: [
      ...link,
      { type: "text", name: "title", label: "Objet de la facture", required: true, full: true },
      { type: "text", name: "number", label: "N° de facture" },
      { type: "number", name: "amount", label: "Montant (DZD)" },
      { type: "date", name: "issueDate", label: "Date d'émission" },
      { type: "date", name: "dueDate", label: "Échéance de règlement" },
      { type: "date", name: "paidDate", label: "Date de paiement (si déjà réglée)" },
      { type: "text", name: "recipient", label: "Destinataire (à qui elle est adressée)" },
      { type: "text", name: "payer", label: "Payeur (qui règle)" },
      { type: "textarea", name: "notes", label: "Notes", full: true },
      ...piece,
    ],
    mail: [
      ...link,
      { type: "text", name: "title", label: "Objet du courrier", required: true, full: true },
      {
        type: "select", name: "direction", label: "Sens",
        options: Object.entries(MAIL_DIRECTION).map(([value, d]) => ({ value, label: d.label })),
        defaultValue: "OUTGOING",
      },
      { type: "text", name: "reference", label: "N° de chrono", defaultValue: ref },
      { type: "text", name: "sender", label: "Expéditeur" },
      { type: "text", name: "recipient", label: "Destinataire" },
      { type: "datetime-local", name: "sentAt", label: "Départ (date et heure)" },
      { type: "date", name: "receivedAt", label: "Arrivée" },
      { type: "text", name: "carrier", label: "Porteur (poste, coursier, e-mail…)" },
      { type: "textarea", name: "notes", label: "Notes", full: true },
      ...piece,
    ],
  };

  const ACTIONS = { legal: createLegalDocument, invoice: createInvoice, mail: createMailEntry } as const;

  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        {offered.includes("legal") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("legal")}>
            <Scale className="h-3.5 w-3.5" /> Engagement
          </Button>
        )}
        {offered.includes("invoice") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("invoice")}>
            <ReceiptText className="h-3.5 w-3.5" /> Facture
          </Button>
        )}
        {offered.includes("mail") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("mail")}>
            <Mails className="h-3.5 w-3.5" /> Courrier
          </Button>
        )}
      </span>

      {open && (
        <Sheet
          open onClose={() => setOpen(null)} width="lg"
          title={TITLES[open].title} description={TITLES[open].description}
        >
          <RecordForm
            fields={FIELDS[open]}
            action={ACTIONS[open]}
            onDone={() => setOpen(null)}
            onCancel={() => setOpen(null)}
            submitLabel={`Créer ${TITLES[open].label.toLowerCase()}`}
          />
        </Sheet>
      )}
    </>
  );
}
