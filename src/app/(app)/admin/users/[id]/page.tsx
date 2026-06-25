import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { ImpersonateButton } from "./impersonate-button";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, defaultScope, MODULES, type Action, type Module } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { NAVIGATION, ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { AccessMatrix, type ModuleAccessRow } from "./access-matrix";
import { SessionsList, type SessionItem } from "./sessions-list";
import { RowGrants } from "./row-grants";
import { ProfileForm, ResetPasswordForm, ActiveToggle, RevokeAllButton } from "./user-admin-forms";

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  NAVIGATION.map((n) => [n.module, n.label]),
);
const ROW_SCOPED: Module[] = ["REGULATORY", "SALES", "MEDICAL", "BUSINESS_DEVELOPMENT"];
const ACTION_FR: Record<string, string> = {
  VIEW: "Voir", CREATE: "Créer", UPDATE: "Modifier", DELETE: "Supprimer",
  VALIDATE: "Valider", EXPORT: "Exporter", UPLOAD: "Upload",
};

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const admin = await requireModule("ADMIN", "UPDATE");

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { access: true, department: true },
  });
  if (!target) notFound();

  const [grants, sessions, activity, regProducts, doctors, bdOpps] = await Promise.all([
    prisma.rowGrant.findMany({ where: { userId: target.id } }),
    prisma.userSession.findMany({
      where: { userId: target.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.activityLog.findMany({ where: { userId: target.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.regulatoryProduct.findMany({ select: { id: true, reference: true, dci: true }, orderBy: { reference: "asc" } }),
    prisma.medicalDoctor.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
    prisma.businessDevelopmentOpportunity.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const overrideMap = new Map(target.access.map((a) => [a.module, a]));
  const matrixRows: ModuleAccessRow[] = MODULES.map((module) => {
    const ov = overrideMap.get(module);
    const def = PERMISSIONS[target.role]?.[module] ?? [];
    const roleSummary = def.length
      ? def.filter((a) => a !== "VIEW").map((a) => ACTION_FR[a]).join(", ") || "Voir seulement"
      : "Aucun accès";
    let mode: ModuleAccessRow["mode"] = "DEFAULT";
    const actions: Record<string, boolean> = {};
    let scope: "ALL" | "ASSIGNED" = defaultScope(target.role, module);
    if (ov) {
      mode = ov.canView ? "CUSTOM" : "BLOCKED";
      actions.CREATE = ov.canCreate; actions.UPDATE = ov.canUpdate; actions.DELETE = ov.canDelete;
      actions.VALIDATE = ov.canValidate; actions.EXPORT = ov.canExport; actions.UPLOAD = ov.canUpload;
      scope = ov.scope;
    } else {
      for (const a of def) if (a !== "VIEW") actions[a as Action] = true;
    }
    return {
      module, label: MODULE_LABEL[module] ?? module, mode, actions, scope,
      rowScoped: ROW_SCOPED.includes(module), roleSummary,
    };
  });

  const sessionItems: SessionItem[] = sessions.map((s) => ({
    id: s.id, device: s.device ?? "desktop", browser: s.browser ?? "—", os: s.os ?? "—",
    ip: s.ipAddress ?? "", location: [s.city, s.country].filter(Boolean).join(", "),
    createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(),
    current: s.id === admin.sid,
  }));

  const grantIds = (type: string) => grants.filter((g) => g.entityType === type).map((g) => g.entityId);

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l’administration
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={target.name} color={target.avatarColor} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{target.name}</h1>
          <p className="text-sm text-muted-foreground">
            {target.email} · {ROLE_LABELS[target.role] ?? target.role}
            {target.isActive ? (
              <Badge tone="success" dot={false} className="ml-2">Actif</Badge>
            ) : (
              <Badge tone="danger" dot={false} className="ml-2">Inactif</Badge>
            )}
          </p>
        </div>
        {admin.role === "SUPER_ADMIN" && target.isActive && target.id !== admin.id && (
          <ImpersonateButton userId={target.id} />
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Accès par onglet, action et lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <AccessMatrix userId={target.id} rows={matrixRows} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ProfileForm user={{ id: target.id, name: target.name, title: target.title ?? "", region: target.region ?? "", role: target.role }} />
            <div className="border-t border-border pt-3">
              <ActiveToggle userId={target.id} isActive={target.isActive} isSelf={target.id === admin.id} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Sécurité</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ResetPasswordForm userId={target.id} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Sessions actives ({sessionItems.length})</p>
                <RevokeAllButton userId={target.id} />
              </div>
              <SessionsList userId={target.id} sessions={sessionItems} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Accès à des lignes précises</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <RowGrants userId={target.id} entityType="REGULATORY_PRODUCT" title="Dossiers Regulatory"
            options={regProducts.map((p) => ({ id: p.id, label: `${p.reference} — ${p.dci}` }))} selected={grantIds("REGULATORY_PRODUCT")} />
          <RowGrants userId={target.id} entityType="DOCTOR" title="Médecins"
            options={doctors.map((d) => ({ id: d.id, label: `${d.name}${d.city ? " · " + d.city : ""}` }))} selected={grantIds("DOCTOR")} />
          <RowGrants userId={target.id} entityType="BD_OPPORTUNITY" title="Opportunités BD"
            options={bdOpps.map((o) => ({ id: o.id, label: o.name }))} selected={grantIds("BD_OPPORTUNITY")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activité récente</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>
                    <Badge tone={a.type === "LOGIN" ? "success" : "info"} dot={false}>{a.type}</Badge>
                    <span className="ml-2 text-muted-foreground">{a.path ?? a.module ?? "—"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[a.browser, a.os].filter(Boolean).join(" · ")}
                    {a.durationMs ? ` · ${Math.round(a.durationMs / 1000)}s` : ""} · {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
