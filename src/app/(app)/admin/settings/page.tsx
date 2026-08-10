import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, SlidersHorizontal, Megaphone, MailWarning, FileCheck2, ScanSearch, ShieldCheck, MessageSquarePlus, FolderPlus, BarChart3, Network } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLimitsForm, BroadcastComposer, MailDiagnosticPanel, RegEnrollmentToggle, RegIntelligenceToggles, RegulatorySupervisorForm, DriveSpaceCreatorForm, FieldReportsOverviewForm, OrgChartViewersForm } from "./admin-settings-forms";
import { BackLink } from "@/components/shared/back-link";

export const metadata = { title: "Réglages & diffusion — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  const [settings, users, mailAccounts, companies, regFlags] = await Promise.all([
    getAppSettings(),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.mailAccount.findMany({ select: { userId: true, email: true, user: { select: { name: true } } }, orderBy: { email: "asc" } }),
    prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.regulatoryFeatureAccess.findMany({ select: { companyId: true, enabled: true } }),
  ]);
  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
  const mailboxes = mailAccounts.map((a) => ({ userId: a.userId, email: a.email, name: a.user?.name ?? a.email }));
  const regEnabled = new Map(regFlags.map((f) => [f.companyId, f.enabled]));
  const regIntelligenceCompanies = companies.map((c) => ({ id: c.id, name: c.name, enabled: regEnabled.get(c.id) ?? false }));

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Retour à l'administration
      </BackLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages & diffusion</h1>
        <p className="text-sm text-muted-foreground">Espace Super Admin : limites de l'instance et notifications diffusées.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Limites de l'instance</CardTitle>
          <p className="text-sm text-muted-foreground">Taille maximale des fichiers téléversés, par espace. S'applique immédiatement.</p>
        </CardHeader>
        <CardContent>
          <AdminLimitsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Regulatory — Enregistrement (CTD)</CardTitle>
          <p className="text-sm text-muted-foreground">Débloque l'onglet « Enregistrement » dans Regulatory : référentiel réglementaire ANPP + analyseur de dossier CTD. Masqué par défaut.</p>
        </CardHeader>
        <CardContent>
          <RegEnrollmentToggle enabled={settings.regEnrollmentEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Regulatory — Superviseurs (priorités, dates, notifications)</CardTitle>
          <p className="text-sm text-muted-foreground">Rôles autorisés (en plus du Super Admin, toujours inclus) à fixer la priorité et les dates cibles des dossiers, à recevoir les notifications (nouveau dossier / dépôt) et à demander des mises à jour de statut.</p>
        </CardHeader>
        <CardContent>
          <RegulatorySupervisorForm roles={roleOptions} selected={settings.regulatorySupervisorRoles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> Demandes à Regulatory — Émetteurs autorisés</CardTitle>
          <p className="text-sm text-muted-foreground">Rôles autorisés à créer des « Demandes à Regulatory » (en plus du PRIM et du Super Admin, toujours inclus). L&apos;équipe Regulatory répond aux demandes mais n&apos;en crée pas — sauf si vous ajoutez son rôle ici.</p>
        </CardHeader>
        <CardContent>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderPlus className="h-4 w-4" /> Drive — Créateurs de catégories</CardTitle>
          <p className="text-sm text-muted-foreground">Rôles autorisés (en plus du Super Admin, toujours inclus) à créer des « catégories » de Drive : des espaces partagés (type « Promotion Médicale ») présentés en onglets à côté de Drive et Documents. Le créateur en gère les accès (qui consulte, qui dépose).</p>
        </CardHeader>
        <CardContent>
          <DriveSpaceCreatorForm roles={roleOptions} selected={settings.driveSpaceCreatorRoles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Rapports terrain — Accès à l'onglet « Overview »</CardTitle>
          <p className="text-sm text-muted-foreground">Rôles autorisés (en plus du Super Admin, toujours inclus) à voir l'onglet « Overview » des Rapports terrain : graphes d'analyse (visites par médecin, hôpital, délégué, spécialité, tendance sur 12 mois…).</p>
        </CardHeader>
        <CardContent>
          <FieldReportsOverviewForm roles={roleOptions} selected={settings.fieldReportsOverviewRoles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Network className="h-4 w-4" /> Organigramme — Qui peut le consulter</CardTitle>
          <p className="text-sm text-muted-foreground">Rôles (les Ressources humaines au premier chef) et personnes nommées autorisés à consulter l&apos;organigramme sur <strong>/organigramme</strong> — par entité ou sur le groupe entier. Le Super Admin reste seul à réorganiser les rattachements, les postes et la carte.</p>
        </CardHeader>
        <CardContent>
          <OrgChartViewersForm roles={roleOptions} users={users} selectedRoles={settings.orgChartViewerRoles} selectedUserIds={settings.orgChartViewerUserIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanSearch className="h-4 w-4" /> Regulatory Intelligence — Analyse CTD (par entité)</CardTitle>
          <p className="text-sm text-muted-foreground">Débloque l'analyse intelligente des dossiers CTD (ingestion ZIP sécurisée, lecture, classement, contrôles réglementaires) pour chaque organisation. Verrouillé par défaut.</p>
        </CardHeader>
        <CardContent>
          <RegIntelligenceToggles companies={regIntelligenceCompanies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Diffuser une notification</CardTitle>
          <p className="text-sm text-muted-foreground">Envoyez une notification à tout le monde, à un rôle, ou à des personnes choisies. Elle apparaît dans leur cloche (et en push si activé).</p>
        </CardHeader>
        <CardContent>
          <BroadcastComposer roles={roleOptions} users={users} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MailWarning className="h-4 w-4" /> Diagnostic e-mail</CardTitle>
          <p className="text-sm text-muted-foreground">Teste une connexion IMAP réelle pour une boîte connectée et affiche l'erreur <strong>brute</strong> du fournisseur + sa cause probable (limite de connexions, IP bloquée, identifiants…). Aucune action sur la boîte.</p>
        </CardHeader>
        <CardContent>
          <MailDiagnosticPanel mailboxes={mailboxes} />
        </CardContent>
      </Card>
    </div>
  );
}
