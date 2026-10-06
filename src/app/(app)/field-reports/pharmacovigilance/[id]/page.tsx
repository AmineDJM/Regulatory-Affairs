import { requireUser } from "@/lib/session";
import { FicheCasPv } from "../../../regulatory/pharmacovigilance/fiche-cas";

export const dynamic = "force-dynamic";

/** La fiche d'un cas, côté KAM — dans ses Rapports terrain (Direction, 06/10). La règle de lecture est dans la fiche. */
export default async function CasPvKamPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  return (
    <FicheCasPv
      user={user} id={params.id} base="/field-reports/pharmacovigilance"
      retour={{ href: "/field-reports/pharmacovigilance", label: "Mes signalements" }}
    />
  );
}
