import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment NextAuth session/user/JWT with our domain fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      sid?: string;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
    sid?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    sid?: string;
    mustChangePassword?: boolean;
  }
}
