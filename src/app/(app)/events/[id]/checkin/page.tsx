import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CheckinConfirm } from "./checkin-confirm";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ params, searchParams }: { params: { id: string }; searchParams: { token?: string } }) {
  await requireModule("EVENTS", "UPDATE");
  const token = searchParams.token ?? null;
  const reg = token
    ? await prisma.eventRegistration.findUnique({ where: { qrToken: token }, select: { firstName: true, lastName: true, eventId: true } })
    : null;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title="Check-in" description="Scan du badge participant." />
      {!reg || reg.eventId !== params.id ? (
        <div className="surface p-6 text-center text-sm text-muted-foreground">
          QR invalide ou participant introuvable.
          <div className="mt-2"><Link href={`/events/${params.id}`} className="text-primary hover:underline">Retour à l'événement</Link></div>
        </div>
      ) : (
        <CheckinConfirm token={token!} name={`${reg.firstName} ${reg.lastName}`} eventId={params.id} />
      )}
    </div>
  );
}
