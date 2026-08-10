import { cache } from "react";
import { prisma } from "./prisma";

/**
 * Réglages d'instance modifiables par le Super Admin (limites de taille d'upload…).
 * Lecture côté serveur ; valeurs par défaut si la ligne n'existe pas (ou souci BDD).
 * Mise en cache par requête.
 */
const perRequest: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof cache === "function" ? (cache as never) : (fn) => fn;

export type BudgetTotalMode = "FIXED" | "FLEXIBLE";

export interface AppSettings {
  maxUploadMb: number;
  maxDriveUploadMb: number;
  /** Budget total : FIXED (montant figé) ou FLEXIBLE (= somme des enveloppes). */
  budgetTotalMode: BudgetTotalMode;
  budgetFixedTotal: number;
  /** Capacité globale du Drive (Go) — modifiable par le Super Admin. */
  driveCapacityGb: number;
  /** Quota Drive par utilisateur (Go) — modifiable par le Super Admin. */
  driveUserQuotaGb: number;
  /** Onglet Regulatory « Enregistrement » (analyseur CTD) — débloqué par le Super Admin. */
  regEnrollmentEnabled: boolean;
  /** Rôles superviseurs Regulatory (en plus du Super Admin) : priorité/dates, notifs, MàJ statut. */
  regulatorySupervisorRoles: string[];
  /** Rôles autorisés à CRÉER des « Demandes à Regulatory » (en plus du PRIM). Regulatory RÉPOND mais ne crée pas. */
  /** Rôles autorisés à CRÉER des catégories de Drive (espaces partagés en onglets). En plus du Super Admin. */
  driveSpaceCreatorRoles: string[];
  /** Rôles autorisés à voir l'onglet « Overview » des Rapports terrain (graphes d'analyse). En plus du Super Admin. */
  fieldReportsOverviewRoles: string[];
  /** Rôles autorisés à CONSULTER l'organigramme (toutes entités ou la sienne). En plus du Super Admin. */
  orgChartViewerRoles: string[];
  /** Rôles autorisés à voir l'onglet « Enregistrement (CTD) ». VIDE = administrateur seul. */
  regEnrollmentRoles: string[];
  /** Personnes nommément autorisées à consulter l'organigramme (en plus des rôles ci-dessus). */
  orgChartViewerUserIds: string[];
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // Limites généreuses : un ZIP de dossier entier (Documents/Regulatory/messagerie) dépasse
  // facilement les anciennes 25 Mo → l'envoi montait à 100 % puis « échec ». putBlob stocke en
  // tranches (~1 Go) donc le stockage suit. Réglable en Administration.
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? "200"),
  maxDriveUploadMb: Number(process.env.MAX_DRIVE_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB ?? "1024"),
  budgetTotalMode: "FLEXIBLE",
  budgetFixedTotal: 0,
  driveCapacityGb: 100,
  driveUserQuotaGb: 10,
  regEnrollmentEnabled: false,
  regulatorySupervisorRoles: [],
  driveSpaceCreatorRoles: [],
  fieldReportsOverviewRoles: [],
  orgChartViewerRoles: [],
  orgChartViewerUserIds: [],
  regEnrollmentRoles: [],
};

export const getAppSettings = perRequest(async (): Promise<AppSettings> => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { id: "global" } });
    if (!row) return DEFAULT_APP_SETTINGS;
    return {
      maxUploadMb: row.maxUploadMb,
      maxDriveUploadMb: row.maxDriveUploadMb,
      budgetTotalMode: row.budgetTotalMode === "FIXED" ? "FIXED" : "FLEXIBLE",
      budgetFixedTotal: Number(row.budgetFixedTotal),
      driveCapacityGb: row.driveCapacityGb,
      driveUserQuotaGb: row.driveUserQuotaGb,
      regEnrollmentEnabled: row.regEnrollmentEnabled,
      regulatorySupervisorRoles: row.regulatorySupervisorRoles ?? [],
      driveSpaceCreatorRoles: row.driveSpaceCreatorRoles ?? [],
      fieldReportsOverviewRoles: row.fieldReportsOverviewRoles ?? [],
      orgChartViewerRoles: row.orgChartViewerRoles ?? [],
      orgChartViewerUserIds: row.orgChartViewerUserIds ?? [],
      regEnrollmentRoles: row.regEnrollmentRoles ?? [],
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
});
