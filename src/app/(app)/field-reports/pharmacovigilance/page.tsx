import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/session";
import { signaleDesCasPv, voitTousLesCasPv } from "@/lib/pharmacovigilance/acces";
import { compteursCasPv, listerCasPv } from "@/lib/pharmacovigilance/donnees";
import { STATUTS_PV, STATUT_PV } from "@/lib/pharmacovigilance/regles";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { ListeCasPv } from "../../regulatory/pharmacovigilance/liste-cas";

export const dynamic = "force-dynamic";

/**
 * « MES SIGNALEMENTS » — les cas de pharmacovigilance que le KAM a signalés (Direction, 06/10), dans SON espace des
 * Rapports terrain : il suit leur statut et répond aux demandes de Regulatory sans quitter son module.
 */
export default async function MesSignalementsPvPage() {
  const user = await requireUser();
  const voitTout = voitTousLesCasPv(user);
  if (!signaleDesCasPv(user) && !voitTout) redirect("/field-reports");
  const [cas, compteurs] = await Promise.all([
    listerCasPv(user, { seulementLesMiens: true }),
    compteursCasPv(user, true),
  ]);
  const enquetes = compteurs.ENQUETE;

  return (
    <div className="space-y-5">
      <BackLink href="/field-reports"><ArrowLeft className="h-4 w-4" /> Rapports terrain</BackLink>
      <PageHeader title="Mes signalements de pharmacovigilance" description="Les cas que vous avez signalés à Regulatory, leur statut et l'échange qui les suit.">
        {signaleDesCasPv(user) && (
          <Link href="/field-reports/pharmacovigilance/nouveau" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <ShieldAlert className="h-4 w-4" /> Signaler un cas
          </Link>
        )}
        {voitTout && <Link href="/regulatory/pharmacovigilance" className="text-sm text-primary hover:underline">Tous les cas (Regulatory)</Link>}
      </PageHeader>

      {enquetes > 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Regulatory attend des informations complémentaires sur {enquetes} de vos cas : ouvrez-les et répondez dans l&apos;échange.
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {STATUTS_PV.map((s) => <span key={s} className="rounded-full bg-secondary px-2.5 py-1">{STATUT_PV[s].label} : {compteurs[s]}</span>)}
      </div>

      {cas.length === 0 ? (
        <EmptyState icon="ShieldAlert" title="Aucun signalement" description="Un effet indésirable, un défaut de qualité, une erreur médicamenteuse rapportés lors d'une visite ? Signalez-le à Regulatory." />
      ) : (
        <ListeCasPv cas={cas} base="/field-reports/pharmacovigilance" avecDeclarant={false} />
      )}
    </div>
  );
}
