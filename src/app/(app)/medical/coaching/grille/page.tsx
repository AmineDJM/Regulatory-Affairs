import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { InfoBulle } from "@/components/ui/info-bulle";
import { EditeurGrille } from "@/components/coaching/grille-editor";
import { BilanLecture, EchelleNiveaux, GrilleEvaluation } from "@/components/coaching/fiche-grille";
import { grilleCourante, historiqueDesGrilles, lecteurCoaching } from "@/lib/coaching/serveur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grille de coaching — AMD Internal OS" };

/**
 * LA GRILLE DE COACHING (§118.157) — consultée par tous ceux qui ont la Promotion médicale (un
 * KAM doit savoir sur quoi on l'évalue), ADMINISTRÉE par le directeur des opérations : chaque
 * publication crée une version, et l'historique dit qui a changé quoi, quand, et combien de
 * fiches portent chaque version.
 */
export default async function GrilleCoachingPage() {
  const user = await requireModule("MEDICAL");
  const l = await lecteurCoaching(user);
  const [courante, historique] = await Promise.all([grilleCourante(), historiqueDesGrilles()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink href="/medical/coaching" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">← Coaching</BackLink>
      {/* Le comment de la grille passe derrière le ⓘ, plus en description (Direction, 07/10). */}
      <PageHeader title={`Grille d'évaluation${courante.version > 0 ? ` · v${courante.version}` : ""}`}>
        <InfoBulle label="À propos de la grille">
          {l.administre
            ? "Chaque publication crée une nouvelle version : les fiches déjà remplies gardent la grille sous laquelle elles l'ont été."
            : "La grille sur laquelle les tournées en double sont évaluées, administrée par le directeur des opérations."}
        </InfoBulle>
      </PageHeader>

      {courante.version === 0 && (
        <p className="flex items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <span className="min-w-0 flex-1">Grille non publiée — chez la direction des opérations</span>
          <InfoBulle label="Conséquence">
            Aucune version enregistrée ne se lit : la grille d&apos;origine est affichée, et les nouvelles fiches sont refusées tant
            qu&apos;une version n&apos;est pas publiée.
          </InfoBulle>
        </p>
      )}

      {l.administre ? (
        <EditeurGrille initiale={courante.grille} version={courante.version} />
      ) : (
        <div className="space-y-5">
          <EchelleNiveaux grille={courante.grille} />
          <GrilleEvaluation grille={courante.grille} notes={{}} nomGroupe="grille" />
          <BilanLecture grille={courante.grille} strengths={null} improvements={null} />
        </div>
      )}

      {historique.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique des versions</h2>
          <ul className="surface divide-y divide-border">
            {historique.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold tabular-nums">Version {v.version}</span>
                {v.version === courante.version && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">en vigueur</span>}
                <span className="text-muted-foreground">{v.createdAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}{v.auteur ? ` · ${v.auteur}` : ""}</span>
                <span className="text-muted-foreground">· {v.grille.axes.length} axes · {v.fiches} fiche(s)</span>
                {v.note && <span className="w-full text-xs italic text-muted-foreground">{v.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
