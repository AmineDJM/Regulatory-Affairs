import { requireModule } from "@/lib/session";
import { getMailAccount } from "@/lib/mail";
import { PageHeader } from "@/components/shared/page-header";
import { ConnectMailbox } from "./connect-mailbox";
import { MailClient } from "./mail-client";

export const dynamic = "force-dynamic";

export default async function CourrierPage() {
  const user = await requireModule("WORKSPACE");
  const account = await getMailAccount(user.id);

  if (!account) {
    return (
      <div className="ik-mail space-y-5">
        <PageHeader title="Courrier" description="Votre boîte mail Infomaniak, intégrée à la plateforme — tout au même endroit." />
        <ConnectMailbox defaultEmail={user.email} defaultName={user.name} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <PageHeader title="Courrier" description={`Connecté : ${account.email}`} />
      <MailClient email={account.email} signature={account.signature ?? ""} />
    </div>
  );
}
