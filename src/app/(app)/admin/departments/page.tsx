import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDepartmentsTree } from "@/lib/queries/departments";
import { DepartmentsManager } from "./departments-manager";

export const metadata = { title: "Départements — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requireModule("ADMIN", "UPDATE");
  if (user.role !== "SUPER_ADMIN") redirect("/admin");

  const departments = await getDepartmentsTree();

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;administration
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Building2 className="h-6 w-6" /> Départements</h1>
        <p className="text-sm text-muted-foreground">
          Structurez l&apos;entreprise « comme une vraie boîte » : définissez les départements et leurs
          sous-départements. Les employés y sont rattachés depuis leur fiche RH.
        </p>
      </div>
      <DepartmentsManager departments={departments} />
    </div>
  );
}
