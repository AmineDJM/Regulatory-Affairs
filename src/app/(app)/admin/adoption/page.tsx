import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gauge, Trophy, ShieldAlert, Info } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getAdoptionScores } from "@/lib/adoption";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdoptionTable } from "./adoption-table";

export const metadata = { title: "Score d'adoption — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function AdoptionPage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  const { scores, average, windowDays } = await getAdoptionScores();
  const active = scores.filter((s) => s.isActive);
  const champions = active.filter((s) => s.score >= 80).length;
  const atRisk = active.filter((s) => s.score < 20).length;

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'administration
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Gauge className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Score d'adoption</h1>
          <p className="text-sm text-muted-foreground">Usage réel de l'OS sur les {windowDays} derniers jours. Temps réel, réservé à l'administration.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Score moyen" value={String(average)} sub="/ 100" icon={<Gauge className="h-4 w-4" />} />
        <Stat label="Champions (≥80)" value={String(champions)} sub={`/ ${active.length} actifs`} icon={<Trophy className="h-4 w-4" />} tone="text-success" />
        <Stat label="À risque (<20)" value={String(atRisk)} sub="comptes actifs" icon={<ShieldAlert className="h-4 w-4" />} tone="text-destructive" />
        <Stat label="Évalués" value={String(scores.length)} sub="hors Super Admin" icon={<Info className="h-4 w-4" />} />
      </div>

      <details className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Comment le score est-il calculé ? (anti-triche)</summary>
        <div className="mt-2 space-y-1.5 text-muted-foreground">
          <p>Le score combine 7 dimensions pondérées, conçues pour <strong>résister au gaming</strong> :</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Régularité (22)</strong> — jours <em>distincts</em> d'activité : un pic d'actions sur une seule journée ne compte que pour un jour.</li>
            <li><strong>Interaction (18)</strong> — fils, mentions reçues et messages : signaux en partie <em>bilatéraux</em>, difficiles à simuler seul.</li>
            <li><strong>Travail durable (15)</strong> — tâches réellement <em>terminées</em>, validations décidées, directives accusées : créer puis supprimer des tâches ne crédite rien.</li>
            <li><strong>Étendue (15)</strong> — modules réellement utilisés (rapporté aux droits du rôle).</li>
            <li><strong>Diversité (12)</strong> — variété des actions concrètes, pas la répétition d'une seule.</li>
            <li><strong>Temps d'activité (10)</strong> — durée cumulée (plafonnée pour ignorer les onglets oubliés).</li>
            <li><strong>Récence (8)</strong> — dernière présence effective.</li>
          </ul>
        </div>
      </details>

      <Card>
        <CardHeader><CardTitle>Classement par adoption</CardTitle></CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="p-3 sm:p-2">
            <AdoptionTable scores={scores} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, icon, tone }: { label: string; value: string; sub: string; icon: React.ReactNode; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className={"mt-1 text-2xl font-bold " + (tone ?? "")}>{value} <span className="text-sm font-normal text-muted-foreground">{sub}</span></p>
      </CardContent>
    </Card>
  );
}
