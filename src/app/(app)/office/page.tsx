import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/utils";
import { explorerSize } from "@/lib/drive/explorer";
import { appOfFile, OFFICE_APPS, type OfficeAppKey } from "@/lib/office/apps";
import { OfficeLauncher } from "./office-launcher";

export const dynamic = "force-dynamic";

/** Assez pour couvrir « ce sur quoi je travaille en ce moment », sans devenir une seconde liste. */
const RECENT_TAKE = 60;
const RECENT_SHOWN = 15;

/**
 * BUREAUTIQUE — Word, Excel, PowerPoint, sur les documents de l'ERP.
 *
 * Les fichiers restent dans le Drive : mêmes droits, même cloisonnement par entité, même journal
 * d'audit, même chiffrement. L'éditeur lit et écrit les VRAIS formats (`.docx`, `.xlsx`, `.pptx`),
 * ouvrables ensuite dans Microsoft Office sur un poste.
 */
export default async function OfficePage({ searchParams }: { searchParams: { app?: string } }) {
  const user = await requireModule("DRIVE");
  const focus = OFFICE_APPS.find((a) => a.key === searchParams.app)?.key as OfficeAppKey | undefined;

  // Les documents bureautiques récents, filtrés par la MÊME résolution d'accès que le Drive :
  // cet écran est une porte d'entrée, jamais un contournement.
  const candidates = await prisma.driveNode.findMany({
    where: {
      type: "FILE", isTrashed: false,
      OR: [
        { name: { endsWith: ".docx", mode: "insensitive" } },
        { name: { endsWith: ".xlsx", mode: "insensitive" } },
        { name: { endsWith: ".pptx", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, size: true, updatedAt: true, owner: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: RECENT_TAKE,
  });

  const visible: typeof candidates = [];
  for (const n of candidates) {
    if (visible.length >= RECENT_SHOWN) break;
    if (canViewDrive(await resolveDriveAccess(user, n.id))) visible.push(n);
  }

  const officeEnabled = onlyofficeConfigured();

  return (
    <div className="space-y-5">
      <PageHeader title="Bureautique" description="Word, Excel et PowerPoint sur vos documents — ils restent dans le Drive, avec ses droits." />

      <OfficeLauncher officeEnabled={officeEnabled} focus={focus} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documents récents</h2>
        {visible.length === 0 ? (
          <EmptyState
            icon="FileText"
            title="Aucun document bureautique"
            description="Créez un document ci-dessus, ou importez un fichier Word, Excel ou PowerPoint dans le Drive."
          />
        ) : (
          <div className="surface divide-y divide-border">
            {visible.map((n) => {
              const app = appOfFile(n.name);
              return (
                <Link
                  key={n.id}
                  href={officeEnabled ? `/drive/${n.id}/edit` : `/drive/${n.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/50"
                >
                  <Icon name={app?.icon ?? "File"} className={`h-4 w-4 shrink-0 ${app?.tone ?? "text-muted-foreground"}`} />
                  <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{n.owner?.name ?? "—"}</span>
                  <span className="hidden shrink-0 tabular-nums text-xs text-muted-foreground sm:block">{explorerSize(n.size, true)}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(n.updatedAt)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!officeEnabled && (
        <p className="surface p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Édition dans le navigateur non activée sur ce serveur.</strong> Les documents
          se créent et se téléchargent normalement ; l&apos;édition en ligne s&apos;ouvrira dès que le serveur d&apos;édition
          sera configuré (Administration).
        </p>
      )}
    </div>
  );
}
