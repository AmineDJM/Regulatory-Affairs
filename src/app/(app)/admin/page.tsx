import { requireModule } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createUser } from "@/lib/actions/admin-actions";
import { ROLE_LABELS } from "@/lib/labels";
import { UsersTable, type UserRow } from "./users-table";
import { AuditTable, type AuditRow } from "./audit-table";

export default async function AdminPage() {
  const user = await requireModule("ADMIN");
  const canManage = can(user.role, "ADMIN", "CREATE");

  const [users, logs, auditCount] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } }),
    prisma.auditLog.count(),
  ]);

  const userRows: UserRow[] = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, title: u.title ?? "", region: u.region ?? "",
    isActive: u.isActive, lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  }));

  const auditRows: AuditRow[] = logs.map((l) => ({
    id: l.id, createdAt: l.createdAt.toISOString(), actor: l.actor?.name ?? "Système",
    action: l.action, module: l.module, summary: l.summary ?? "",
    field: l.field ?? "", oldValue: l.oldValue ?? "", newValue: l.newValue ?? "",
  }));

  const activeCount = userRows.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Utilisateurs, rôles, journal d'activité et paramètres de l'entreprise.">
        {canManage && (
          <CreateRecordButton
            label="Nouvel utilisateur"
            title="Créer un utilisateur"
            action={createUser}
            width="md"
            fields={[
              { type: "text", name: "name", label: "Nom complet", required: true, full: true },
              { type: "text", name: "email", label: "Email", required: true },
              { type: "text", name: "password", label: "Mot de passe (min. 8)", required: true },
              { type: "select", name: "role", label: "Rôle", options: optionsFromMap(ROLE_LABELS), required: true },
              { type: "text", name: "title", label: "Fonction" },
              { type: "text", name: "region", label: "Région" },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Utilisateurs" value={userRows.length} icon="Users" />
        <KpiCard label="Actifs" value={activeCount} icon="UserCheck" tone="success" />
        <KpiCard label="Rôles" value={Object.keys(ROLE_LABELS).length} icon="ShieldCheck" tone="info" />
        <KpiCard label="Entrées d'audit" value={auditCount} icon="ScrollText" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Utilisateurs & rôles</h2>
        <UsersTable users={userRows} canManage={canManage} />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Paramètres entreprise</CardTitle>
            <CardDescription>Configuration de l&apos;instance AMD Internal OS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Setting label="Société" value="Adventum Pharma" />
            <Setting label="Devise par défaut" value="DZD" />
            <Setting label="Seuil validation Direction" value="100 000 DZD" />
            <Setting label="Taille max upload" value={`${process.env.MAX_UPLOAD_MB ?? 25} Mo`} />
            <Setting label="Modules actifs" value="8 pôles" />
            <Setting label="Politique d'accès" value="RBAC + row-level" />
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Journal d&apos;activité (audit log)</h2>
          <AuditTable rows={auditRows} />
        </div>
      </div>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
