import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, SlidersHorizontal, Megaphone, MailWarning } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLimitsForm, BroadcastComposer, MailDiagnosticPanel } from "./admin-settings-forms";

export const metadata = { title: "Réglages & diffusion — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  const [settings, users, mailAccounts] = await Promise.all([
    getAppSettings(),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.mailAccount.findMany({ select: { userId: true, email: true, user: { select: { name: true } } }, orderBy: { email: "asc" } }),
  ]);
  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
  const mailboxes = mailAccounts.map((a) => ({ userId: a.userId, email: a.email, name: a.user?.name ?? a.email }));

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'administration
      </Link>

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
