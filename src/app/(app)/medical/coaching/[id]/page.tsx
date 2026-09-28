import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Printer } from "lucide-react";
import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FicheCoachingForm } from "@/components/coaching/fiche-form";
import { FicheActions } from "@/components/coaching/fiche-actions";
import { BilanLecture, EchelleNiveaux, GrilleEvaluation, TotalFiche } from "@/components/coaching/fiche-grille";
import { collaborateursCoachables, lecteurCoaching, managersPossibles } from "@/lib/coaching/serveur";
import { chargerFicheVisible } from "@/lib/coaching/fiches";
import { formaterJour, jourAlger, jourDe } from "@/lib/coaching/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de coaching — AMD Internal OS" };

/**
 * UNE FICHE DE COACHING (§118.157) — consultation, et modification (`?modifier=1`) quand la règle
 * le permet. Une fiche que la personne ne peut pas lire rend la même page qu'une fiche
 * inexistante : dire « elle existe mais vous n'y avez pas accès » apprendrait à un collègue
 * qu'une évaluation a été écrite sur quelqu'un.
 */
export default async function FicheCoachingPage({ params, searchParams }: { params: { id: string }; searchParams?: { modifier?: string } }) {
  const user = await requireModule("MEDICAL");
  const l = await lecteurCoaching(user);
  const fiche = await chargerFicheVisible(l, params.id);
  if (!fiche) notFound();
  const finalisee = fiche.status === "FINALIZED";

  if (searchParams?.modifier === "1" && fiche.gestes.modifier && fiche.grille) {
    const [coachables, managers] = await Promise.all([
      collaborateursCoachables(l),
      l.administre ? managersPossibles([user.id, ...(fiche.managerId ? [fiche.managerId] : [])]) : Promise.resolve(null),
    ]);
    // Le collaborateur de la fiche reste proposé même s'il a quitté le périmètre : on corrige
    // une fiche sur la personne qu'elle évalue, pas sur celles qu'on coache aujourd'hui.
    const collaborateurs = coachables.some((c) => c.id === fiche.collaboratorId)
      ? coachables
      : [{ id: fiche.collaboratorId, nom: fiche.collaborateur, secteur: fiche.sector ?? "" }, ...coachables];
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <BackLink href={`/medical/coaching/${fiche.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">← Retour à la fiche</BackLink>
        <PageHeader
          title={`Modifier — ${fiche.collaborateur}`}
          description={finalisee
            ? "Fiche finalisée : la modification est réservée à la direction des opérations, et le collaborateur en sera prévenu."
            : "Brouillon — vous pourrez le finaliser une fois chaque axe noté."}
        />
        <FicheCoachingForm
          mode="modification"
          ficheId={fiche.id}
          grille={fiche.grille}
          gridVersion={fiche.gridVersion}
          collaborateurs={collaborateurs}
          managers={managers}
          valeurs={{
            collaboratorId: fiche.collaboratorId,
            managerId: fiche.managerId ?? user.id,
            visitDate: jourDe(fiche.visitDate),
            sector: fiche.sector ?? "",
            notes: fiche.notes,
            strengths: fiche.strengths ?? "",
            improvements: fiche.improvements ?? "",
          }}
          finalisee={finalisee}
          peutFinaliser={fiche.gestes.finaliser}
          aujourdHui={jourAlger()}
          nomManagerParDefaut={fiche.manager ?? user.name}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink href="/medical/coaching" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">← Coaching</BackLink>
      <PageHeader
        title={`Fiche de coaching — ${fiche.collaborateur}`}
        description={`Tournée en double du ${formaterJour(fiche.visitDate)}${fiche.manager ? ` avec ${fiche.manager}` : ""}${fiche.sector ? ` · ${fiche.sector}` : ""}`}
      >
        <a href={`/api/medical/coaching/${fiche.id}/export`}>
          <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Télécharger (Excel)</Button>
        </a>
        <a href={`/impression/coaching/${fiche.id}?auto=1`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><Printer className="h-4 w-4" /> Imprimer / PDF</Button>
        </a>
        {fiche.gestes.modifier && fiche.grille && (
          <Link href={`/medical/coaching/${fiche.id}?modifier=1`}>
            <Button variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Modifier</Button>
          </Link>
        )}
        <FicheActions
          id={fiche.id}
          collaborateur={fiche.collaborateur}
          finaliser={fiche.gestes.finaliser}
          supprimer={fiche.gestes.supprimer}
          finalisee={finalisee}
          complete={fiche.complet}
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge tone={finalisee ? "success" : "warning"}>{finalisee ? "Finalisée" : "Brouillon"}</Badge>
        {finalisee && fiche.finalizedAt && (
          <span>le {fiche.finalizedAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}{fiche.finalisePar ? ` par ${fiche.finalisePar}` : ""}</span>
        )}
        <span>· grille version {fiche.gridVersion}</span>
        {fiche.creePar && <span>· saisie par {fiche.creePar}</span>}
      </div>

      {fiche.grille ? (
        <>
          <EchelleNiveaux grille={fiche.grille} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
            <GrilleEvaluation grille={fiche.grille} notes={fiche.notes} nomGroupe={fiche.id} />
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <TotalFiche grille={fiche.grille} notes={fiche.notes} />
            </aside>
          </div>
          <BilanLecture grille={fiche.grille} strengths={fiche.strengths} improvements={fiche.improvements} />
        </>
      ) : (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          La grille sous laquelle cette fiche a été remplie ne se lit plus — ses notes ne peuvent pas être affichées sans risquer de les attacher aux mauvais critères.
        </p>
      )}
    </div>
  );
}
