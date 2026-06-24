import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config shared between the middleware (edge runtime) and the
 * full Node config in `auth.ts`. It must NOT import Prisma or bcrypt.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    // Route protection. Runs in middleware on every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true; // allow the login page for anonymous users
      }

      // Everything else requires authentication.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
