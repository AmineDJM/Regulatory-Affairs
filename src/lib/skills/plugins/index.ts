import type { SkillManifest } from "@/lib/skills/manifest";
import { DOCUSIGN } from "./docusign";
import { SAP } from "./sap";
import { HUBSPOT } from "./hubspot";
import { IQVIA } from "./iqvia";
import { PCH } from "./pch";
import { MESSAGERIE } from "./messagerie";

/**
 * LES CONNECTEURS DÉCLARÉS (§36). Un connecteur est une LISTE DE MANIFESTES — rien d'autre. Le
 * cœur ne connaît aucun d'eux par son nom : il les découvre ici, les valide, vérifie leur
 * configuration, et les expose sous le droit que chacun déclare. Ajouter SAP, HubSpot ou l'API
 * PCH n'a modifié aucun fichier du cœur ; en ajouter un sixième non plus.
 *
 * Les URL de base et les jetons ne sont JAMAIS ici : un manifeste nomme des variables de
 * configuration (`dependances.config`), et le serveur qui ne les a pas DIT que le connecteur
 * n'est pas configuré — une limite de ressource, pas un « pas prévu ».
 */
export const PLUGINS: readonly SkillManifest[] = [...DOCUSIGN, ...SAP, ...HUBSPOT, ...IQVIA, ...PCH, ...MESSAGERIE];
export { CANAUX_MESSAGERIE, outilDeCanal, type CanalMessagerie } from "./messagerie";
