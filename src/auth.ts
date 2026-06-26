import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { clientIp, parseDevice } from "./lib/device";
import { enrichSessionGeo } from "./lib/geo";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_TTL_DAYS = 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        // Recherche insensible à la casse : un compte dont l'email contient une
        // majuscule (données importées/anciennes) doit pouvoir se connecter — sinon
        // aucun changement de mot de passe ne le débloquerait.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          orderBy: { createdAt: "asc" },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Capture device + IP, then create a revocable session row.
        const headers = (request as Request | undefined)?.headers;
        const ua = headers?.get("user-agent") ?? null;
        const ip = headers ? clientIp(headers) : null;
        const { device, os, browser } = parseDevice(ua);

        const session = await prisma.userSession.create({
          data: {
            userId: user.id,
            ipAddress: ip,
            userAgent: ua,
            device,
            os,
            browser,
            expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400000),
          },
        });
        enrichSessionGeo(session.id, ip); // background geolocation

        await prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);
        await prisma.activityLog
          .create({
            data: {
              userId: user.id,
              type: "LOGIN",
              ipAddress: ip,
              device,
              os,
              browser,
              userAgent: ua,
            },
          })
          .catch(() => undefined);
        await prisma.auditLog
          .create({
            data: {
              actorId: user.id,
              action: "LOGIN",
              module: "Authentification",
              ipAddress: ip,
              summary: `Connexion de ${user.name} (${browser} · ${os})`,
            },
          })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sid: session.id,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.sid = (user as { sid?: string }).sid;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as (typeof session.user)["role"];
        session.user.sid = token.sid as string | undefined;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
});
