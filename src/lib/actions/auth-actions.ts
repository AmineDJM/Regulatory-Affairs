"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/** Server action used by the login form. Returns an error string on failure. */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws a NEXT_REDIRECT on success — let it propagate.
    if (error instanceof AuthError) {
      return "Identifiants invalides. Vérifiez votre email et votre mot de passe.";
    }
    throw error;
  }
  return undefined;
}

export async function doSignOut() {
  await signOut({ redirectTo: "/login" });
}
