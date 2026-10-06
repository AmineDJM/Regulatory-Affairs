import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { TeleverserConsommation } from "./televerser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consumption Intelligence — AMD Internal OS" };

const STATUT: Record<string, { label: string; tone: "warning" | "success" | "neutral" }> = {
  EN_REVUE: { label: "En revue", tone: "warning" }, VALIDE: { label: "Validé", tone: "success" }, ANNULE: { label: "Annulé", tone: "neutral" },
};

/**
 * CONSUMPTION INTELLIGENCE — les fichiers de consommation hospitalière, quels qu'en soient les colonnes, l'ordre, les
 * feuilles, les unités : importés, lus, rapprochés de l'annuaire et du référentiel produits, dédoublonnés, revus, puis
 * VALIDÉS. Seules les lignes d'un import validé comptent, et chacune remonte à sa cellule d'origine.
 */
export default async function ConsommationPage() {
  const user = await requireModule("CONSUMPTION");
  const peutImporter = userCan(user, "CONSUMPTION", "UPLOAD");
  const imports = await prisma.consommationImport.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, nomFichier: true, statut: true, createdAt: true, valideLe: true, _count: { select: { lignes: true } } },
  });
  const parStatut = await prisma.consommationLigne.groupBy({ by: ["importId", "statut"], where: { importId: { in: imports.map((i) => i.id) } }, _count: { _all: true } });
  const compte = (id: string, s: string) => parStatut.find((x) => x.importId === id && x.statut === s)?._count._all ?? 0;
  return (
    <div className="space-y-5">
      <PageHeader title="Consumption Intelligence" description="Les fichiers de consommation des établissements, rendus fiables et traçables — et l'affinité qu'on en tire.">
        <Link href="/consommation/affinite" className="text-sm text-primary underline">Affinité par établissement</Link>
      </PageHeader>
      {peutImporter && <TeleverserConsommation />}
      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Fichier</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Lignes</th><th className="px-3 py-2">Sûres</th><th className="px-3 py-2">À revoir</th><th className="px-3 py-2">Doublons</th><th className="px-3 py-2">Importé le</th></tr>
          </thead>
          <tbody>
            {imports.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-muted-foreground">Aucun fichier importé.</td></tr>}
            {imports.map((i) => (
              <tr key={i.id} className="border-b border-border/60">
                <td className="px-3 py-2"><Link href={`/consommation/${i.id}`} className="font-medium text-primary hover:underline">{i.nomFichier}</Link></td>
                <td className="px-3 py-2"><Badge tone={STATUT[i.statut]?.tone ?? "neutral"}>{STATUT[i.statut]?.label ?? i.statut}</Badge></td>
                <td className="px-3 py-2">{i._count.lignes}</td>
                <td className="px-3 py-2">{compte(i.id, "OK")}</td>
                <td className="px-3 py-2">{compte(i.id, "A_REVOIR")}</td>
                <td className="px-3 py-2">{compte(i.id, "DOUBLON")}</td>
                <td className="px-3 py-2">{i.createdAt.toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
