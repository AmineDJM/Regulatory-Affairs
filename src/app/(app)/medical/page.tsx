import { redirect } from "next/navigation";

/**
 * « VISITES & SEGMENTATION » A ÉTÉ RETIRÉ — un autre écran sera refait, mieux pensé.
 *
 * La route reste et REDIRIGE vers l'annuaire : des favoris, des notifications et des liens
 * internes pointent ici, et les faire tomber sur une page d'erreur ferait croire à une panne.
 *
 * ⚠️ AUCUNE DONNÉE N'A ÉTÉ SUPPRIMÉE. Les visites (`MedicalVisit`) et les plans de tournée
 * (`DelegatePlan`) restent en base avec leurs actions serveur : c'est l'ÉCRAN qui disparaît, pas
 * l'historique. Détruire des visites déjà saisies pour refaire un module plus tard serait une
 * perte sèche que rien ne justifie.
 */
export default function LegacyMedicalVisitsPage() {
  redirect("/medical/annuaire");
}
