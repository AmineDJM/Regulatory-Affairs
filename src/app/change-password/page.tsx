import { requireUser } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Changer le mot de passe — AMD Internal OS" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            A
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Changer le mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            {user.mustChangePassword
              ? "Pour des raisons de sécurité, définissez un nouveau mot de passe."
              : "Mettez à jour votre mot de passe."}
          </p>
        </div>
        <ChangePasswordForm email={user.email} />
      </div>
    </div>
  );
}
