import { redirect } from "next/navigation";
import { getSupplierSession } from "@/lib/supplier-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SupplierLoginForm } from "./login-form";

export default async function SupplierLoginPage() {
  // Déjà connecté → aller au portail.
  if (await getSupplierSession()) redirect("/portail");

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <p className="text-sm font-semibold tracking-tight text-primary">Adventum Pharma</p>
          <CardTitle>Portail Fournisseur</CardTitle>
          <CardDescription>Suivez l'état d'enregistrement de vos produits.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierLoginForm />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accès réservé aux partenaires d'Adventum Pharma. Pour toute question, contactez votre interlocuteur réglementaire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
