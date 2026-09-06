import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMyCompanies } from "@/lib/company";
import { marqueDe, peutReglerMarque } from "@/platform/in-process/brand";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireMarque, FormulaireLogo } from "./marque-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marque & modèles — Administration" };

/**
 * L'ÉCRAN DU REGISTRE DE MARQUE (mandat 4 §26) — une carte par société : la charte effective
 * (accent, polices, logo, mentions, signataires) telle que la fabrique l'APPLIQUE, et le
 * formulaire pour la régler quand on tient la papeterie. Ce que l'écran montre est ce que
 * le pont a relu ; ce que le pont refuse, l'écran le dit mot pour mot.
 */
export default async function MarquePage() {
  const user = await requireUser();
  const societes = await getMyCompanies(user.id);
  const modifiable = peutReglerMarque(user);
  const lues = await Promise.all(societes.map(async (s) => ({ societe: s, r: await marqueDe(user, s.id) })));

  return (
    <div className="space-y-6">
      <PageHeader title="Marque & modèles" description="Ce que chaque société dit d'elle-même sur ses devis, bons de commande, factures et dossiers — appliqué d'office par la fabrique.">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Administration</Link>
      </PageHeader>

      {!modifiable && (
        <p className="text-sm text-muted-foreground" data-testid="marque-lecture-seule">
          Vous lisez le registre ; il se règle par la Direction et par ceux qui tiennent la papeterie (assistante de direction, Super Admin).
        </p>
      )}

      {lues.length === 0 ? (
        <EmptyState title="Aucune société dans votre périmètre" description="Le registre de marque suit les sociétés que vous voyez." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {lues.map(({ societe, r }) => (
            <Card key={societe.id} data-testid="marque-carte" data-societe={societe.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: r.ok ? `#${r.lue.charte.accent}` : undefined }} aria-hidden />
                  {societe.name}
                </CardTitle>
                {r.ok && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">accent #{r.lue.charte.accent}</Badge>
                    <Badge tone="neutral">{r.lue.charte.policeTitres}{r.lue.charte.policeTexte !== r.lue.charte.policeTitres ? ` / ${r.lue.charte.policeTexte}` : ""}</Badge>
                    <Badge tone={r.lue.marque.logo ? "info" : "warning"}>{r.lue.marque.logo ? "logo déposé" : "sans logo"}</Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!r.ok ? (
                  <p className="text-sm text-muted-foreground">{r.motif}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground" data-testid="marque-resume">{r.lue.resume}</p>
                    {r.lue.charte.alertes.length > 0 && (
                      <ul className="space-y-1 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" data-testid="marque-alertes">
                        {r.lue.charte.alertes.map((a) => <li key={a}>⚠ {a}</li>)}
                      </ul>
                    )}
                    {modifiable ? (
                      <>
                        <FormulaireLogo companyId={societe.id} logo={r.lue.marque.logo ? { nom: r.lue.marque.logo.nom, taille: r.lue.marque.logo.taille, largeurCm: r.lue.marque.logo.largeurCm } : null} />
                        <FormulaireMarque companyId={societe.id} marque={r.lue.marque} />
                      </>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
