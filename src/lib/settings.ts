import { cache } from "react";
import { prisma } from "./prisma";

/**
 * Réglages d'instance modifiables par le Super Admin (limites de taille d'upload…).
 * Lecture côté serveur ; valeurs par défaut si la ligne n'existe pas (ou souci BDD).
 * Mise en cache par requête.
 */
const perRequest: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof cache === "function" ? (cache as never) : (fn) => fn;

export interface AppSettings {
  maxUploadMb: number;
  maxDriveUploadMb: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? "25"),
  maxDriveUploadMb: Number(process.env.MAX_DRIVE_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB ?? "100"),
};

export const getAppSettings = perRequest(async (): Promise<AppSettings> => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { id: "global" } });
    if (!row) return DEFAULT_APP_SETTINGS;
    return { maxUploadMb: row.maxUploadMb, maxDriveUploadMb: row.maxDriveUploadMb };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
});
