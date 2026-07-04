import Link from "next/link";
import { Settings2, Activity, Columns3, MessageSquare, ShieldCheck, Factory, Bot, Gauge, Workflow } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createUser } from "@/lib/actions/admin-actions";
import { ROLE_LABELS, ADMIN_TABS } from "@/lib/labels";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { formatDateTime } from "@/lib/utils";
import { AuditPanel } from "./audit-panel";
import { RolesTable } from "./roles-table";

export default async function AdminPage() {
  const admin = await requireModule("ADMIN");
  const canManage = userCan(admin, "ADMIN", "CREATE");

  const [users, activeSessions, activityCount, auditCount] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { access: true } } } }),
    prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.activityLog.count(),
    prisma.auditLog.count(),
  ]);

  const active = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Comptes, accès, sessions, activité et journal d’audit.">
        <Link href="/admin/activity">
          <Button variant="outline"><Activity className="h-4 w-4" /> Activité</Button>
        </Link>
        {admin.role === "SUPER_ADMIN" && (
          <>
            <Link href="/admin/access">
              <Button variant="outline"><ShieldCheck className="h-4 w-4" /> Accès par module</Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="outline"><Settings2 className="h-4 w-4" /> Réglages & diffusion</Button>
            </Link>
            <Link href="/admin/workflows">
              <Button variant="outline"><Workflow className="h-4 w-4" /> Circuits de validation</Button>
            </Link>
            <Link href="/admin/adoption">
              <Button variant="outline"><Gauge className="h-4 w-4" /> Adoption</Button>
            </Link>
            <Link href="/admin/ai">
              <Button variant="outline"><Bot className="h-4 w-4" /> Contrôle IA</Button>
            </Link>
            <Link href="/admin/validations">
              <Button variant="outline"><ShieldCheck className="h-4 w-4" /> Validations</Button>
            </Link>
            <Link href="/admin/feedback">
              <Button variant="outline"><MessageSquare className="h-4 w-4" /> Feedbacks</Button>
            </Link>
            <Link href="/admin/suppliers">
              <Button variant="outline"><Factory className="h-4 w-4" /> Fournisseurs</Button>
            </Link>
          </>
        )}
        {canManage && (
          <Link href="/admin/fields">
            <Button variant="outline"><Columns3 className="h-4 w-4" /> Champs personnalisés</Button>
          </Link>
        )}
        {canManage && (
          <CreateRecordButton
            label="Nouvel utilisateur"
            title="Créer un utilisateur"
            description="Le compte devra changer son mot de passe à la première connexion."
            action={createUser}
            width="md"
            redirectBase="/admin/users"
            fields={[
              { type: "text", name: "name", label: "Nom complet", required: true, full: true },
              { type: "text", name: "email", label: "Email", required: true },
              { type: "text", name: "password", label: "Mot de passe temporaire (min. 8)", required: true },
              { type: "select", name: "role", label: "Rôle par défaut", options: optionsFromMap(ROLE_LABELS), required: true },
              { type: "text", name: "title", label: "Fonction" },
              { type: "text", name: "region", label: "Région" },
            ]}
          />
        )}
      </PageHeader>
      <ModuleTabs tabs={ADMIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(admin, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Utilisateurs" value={users.length} icon="Users" />
        <KpiCard label="Actifs" value={active} icon="UserCheck" tone="success" />
        <KpiCard label="Sessions actives" value={activeSessions} icon="MonitorSmartphone" tone="info" />
        <KpiCard label="Événements d’activité" value={activityCount} icon="Activity" />
      </div>

      <Card>
        <CardHeader><CardTitle>Comptes & accès</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Accès personnalisés</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} color={u.avatarColor} size="sm" />
                      <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge tone="neutral" dot={false}>{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell>{u._count.access > 0 ? <Badge tone="info" dot={false}>{u._count.access} règle·s</Badge> : <span className="text-xs text-muted-foreground">Rôle par défaut</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</TableCell>
                  <TableCell>{u.isActive ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="danger" dot={false}>Inactif</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {canManage ? (
                      <Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-primary hover:underline">Gérer</Link>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tableau clair : rôle principal + « autre rôle » (fonction secondaire), réglable par le Super Admin. */}
      <Card>
        <CardHeader>
          <CardTitle>Rôles principaux & secondaires</CardTitle>
          <CardDescription>
            Chaque compte a un <strong>rôle principal</strong> et, en option, un <strong>autre rôle</strong> (fonction
            secondaire : Direction, Direction Marketing, National Sales…). Le rôle secondaire <strong>cumule</strong>
            ses capacités à celles du rôle principal. Modifiable ici par le Super Admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RolesTable
            users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, secondaryRole: u.secondaryRole ?? null }))}
            canManage={userCan(admin, "ADMIN", "UPDATE")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Paramètres</CardTitle>
            <CardDescription>Configuration de l’instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {[["Société", "Adventum Pharma"], ["Devise", "DZD"], ["Création de comptes", "Admin uniquement"],
              ["Mot de passe", "Changement forcé 1ʳᵉ connexion"], ["Politique d’accès", "RBAC + overrides + lignes"],
              ["Sessions", "Révocables"], ["Connexion", "Verrouillage anti-bruteforce"], ["IA", "Pilotée (Contrôle IA)"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Journal d’audit ({auditCount})</h2>
          <AuditPanel count={auditCount} />
        </div>
      </div>
    </div>
  );
}
