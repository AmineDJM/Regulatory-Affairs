import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { signaleDesCasPv } from "@/lib/pharmacovigilance/acces";
import { etablissementsPourSignalement, produitsPourSignalement } from "@/lib/pharmacovigilance/donnees";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { SignalerCasForm } from "./signaler-form";

export const dynamic = "force-dynamic";

/**
 * SIGNALER UN CAS DE PHARMACOVIGILANCE — depuis les Rapports terrain (Direction, 06/10). Le KAM choisit : un rapport
 * de visite, ou un signalement. Le signalement part chez Regulatory, qui l'instruit ; l'échange s'ouvre sur sa fiche.
 */
export default async function SignalerCasPvPage() {
  const user = await requireUser();
  if (!signaleDesCasPv(user)) redirect("/field-reports/pharmacovigilance");
  const [produits, etablissements] = await Promise.all([produitsPourSignalement(user.id), etablissementsPourSignalement()]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/field-reports/pharmacovigilance"><ArrowLeft className="h-4 w-4" /> Mes signalements</BackLink>
      <PageHeader
        title="Signaler un cas de pharmacovigilance"
        description="Effet indésirable, défaut de qualité, erreur médicamenteuse : dites le produit, l'établissement, la date et ce qui s'est passé. Regulatory est prévenu aussitôt."
      />
      <SignalerCasForm produits={produits} etablissements={etablissements} aujourdhui={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
