import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { chargerAutresAnnuaires } from "@/lib/queries/annuaires";
import { Card, CardContent } from "@/components/ui/card";
import { EnTeteAnnuaires } from "../en-tete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Autres — AMD Internal OS" };

/**
 * Onglet AUTRES ANNUAIRES : ceux qui ont leur propre écran ailleurs — on les NOMME et on y mène,
 * on ne les redessine pas ici (un second écran des fournisseurs ferait deux écrans qui
 * divergent). Le compte n'est calculé que si la personne a le module ; sinon la carte le dit
 * et ne mène nulle part : une porte vers un refus n'est pas une porte.
 */
export default async function AutresAnnuairesPage() {
  const user = await requireModule("DIRECTORIES");
  const droits = {
    // La page des fournisseurs Regulatory est réservée au Super Admin (comptes du portail).
    regulatorySuppliers: user.role === "SUPER_ADMIN",
    courriers: userCan(user, "MAIL_REGISTER", "VIEW"),
    stocks: userCan(user, "STOCKS", "VIEW"),
    specialites: userCan(user, "MEDICAL", "VIEW"),
  };
  const autres = await chargerAutresAnnuaires(droits);
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Les référentiels qui vivent dans leur propre module — nommés ici, tenus là-bas."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {autres.map((a) => {
          const ouvert = a.compte !== null;
          return (
            <Card key={a.cle} data-testid={`autre-annuaire-${a.cle}`}>
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{a.titre}</p>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {ouvert ? `${a.compte} fiche${a.compte === 1 ? "" : "s"}` : "accès réservé"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                {ouvert ? (
                  <Link href={a.href} className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Ouvrir <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : (
                  <p className="mt-auto text-xs text-muted-foreground">Cet annuaire dépend d&apos;un module que vous n&apos;avez pas.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
