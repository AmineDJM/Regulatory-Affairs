import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireUser } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Accès — AMD Internal OS" };
export const dynamic = "force-dynamic";

/**
 * Page d'atterrissage **sans garde de module** : affichée quand un utilisateur n'a
 * (temporairement) accès à aucun espace, ou qu'on l'a redirigé hors d'une page
 * refusée. Elle ne se refuse jamais elle-même → impossible d'y boucler.
 */
export default async function NoAccessPage() {
  const user = await requireUser();
  const count = accessibleModules(user).length;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <ShieldX className="h-7 w-7" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Aucun espace ne vous est encore attribué</h1>
        <p className="text-sm text-muted-foreground">
          Bonjour {user.name.split(" ")[0]}, votre compte est actif mais aucun module ne vous est
          ouvert pour l'instant. Contactez votre administrateur pour qu'il vous attribue les accès
          nécessaires à votre fonction.
        </p>
      </div>
      <Card className="w-full">
        <CardContent className="space-y-3 py-4 text-sm">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Compte</span><span className="font-medium">{user.email}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Modules accessibles</span><span className="font-medium">{count}</span></div>
        </CardContent>
      </Card>
      <Link href="/api/auth/signout" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        Se déconnecter
      </Link>
    </div>
  );
}
