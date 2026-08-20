"use client";

import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { createRecruitmentRequest } from "@/lib/actions/recruitment-actions";
import { CONTRACT_LABEL, RECRUITMENT_CONTRACTS } from "@/lib/recruitment/request-flow";

/** Ce qu'on dit AVANT de remplir : le circuit est long, autant qu'il ne surprenne personne. */
const CIRCUIT_HINT =
  "Votre hiérarchie valide, marche par marche, jusqu'à la direction générale. La demande part "
  + "ensuite aux RH, qui peuvent vous demander des précisions avant d'ouvrir le poste.";

/**
 * DEMANDER UN RECRUTEMENT.
 *
 * Le formulaire ne demande QUE ce qui rend la demande instruisible — poste, effectif, contrat.
 * Les missions, les compétences et la fiche de poste restent facultatives : les RH ont
 * précisément le droit de demander des précisions, et refuser d'enregistrer un besoin réel parce
 * qu'une case est vide, c'est le renvoyer vers un e-mail où plus personne ne le suivra.
 *
 * La FOURCHETTE et les DATES dépendent du contrat, et le formulaire le dit plutôt que de le
 * vérifier en silence : un CDD sans terme sera refusé, un CDI avec date de fin aussi.
 */
export function NewRecruitmentButton({
  departments, hasCompany,
}: {
  departments: { value: string; label: string }[];
  hasCompany: boolean;
}) {
  const fields: FieldDef[] = [
    { type: "text", name: "position", label: "Intitulé du poste", required: true, full: true, placeholder: "Ex. Chargé d'affaires réglementaires" },
    {
      type: "select", name: "contractType", label: "Type de contrat", required: true,
      options: RECRUITMENT_CONTRACTS.map((c) => ({ value: c, label: CONTRACT_LABEL[c] })),
      placeholder: "— Choisir —",
    },
    { type: "number", name: "headcount", label: "Nombre de postes", defaultValue: 1 },
    ...(departments.length > 0
      ? ([{
          type: "select", name: "departmentId", label: "Direction concernée", options: departments,
          placeholder: "— Aucune —",
        }] as FieldDef[])
      : []),
    { type: "number", name: "salaryMin", label: "Rémunération — minimum (DZD)", placeholder: "80000" },
    { type: "number", name: "salaryMax", label: "Rémunération — maximum (DZD)", placeholder: "110000" },
    { type: "date", name: "startDate", label: "Prise de poste souhaitée" },
    { type: "date", name: "endDate", label: "Fin de contrat (CDD, stage, consulting)" },
    { type: "textarea", name: "missions", label: "Missions", full: true, placeholder: "Ce que la personne fera au quotidien." },
    { type: "textarea", name: "skills", label: "Compétences attendues", full: true, placeholder: "Diplôme, expérience, langues, outils…" },
    { type: "textarea", name: "justification", label: "Pourquoi ce recrutement", full: true, placeholder: "Remplacement, croissance, nouveau marché… — c'est ce que vos validateurs vont peser." },
    {
      type: "file", name: "attachment", label: "Fiche de poste", multiple: true, full: true,
      hint: "Facultative. Si vous en avez une, joignez-la : les RH la reprendront pour publier l'annonce.",
    },
  ];

  return (
    <CreateRecordButton
      label="Demander un recrutement"
      title="Nouvelle demande de recrutement"
      description={`${CIRCUIT_HINT}${hasCompany ? "" : " Aucune entité n'est rattachée à votre compte : la demande sera enregistrée sans entité."}`}
      width="lg"
      action={createRecruitmentRequest}
      fields={fields}
      redirectBase="/recrutement"
    />
  );
}
