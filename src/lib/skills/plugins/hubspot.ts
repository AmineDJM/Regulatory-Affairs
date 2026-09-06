import type { SkillManifest } from "@/lib/skills/manifest";

/** HubSpot CRM — retrouver un contact, ouvrir une transaction. Configuration : HUBSPOT_BASE_URL, HUBSPOT_TOKEN. */
export const HUBSPOT: SkillManifest[] = [
  {
    id: "rechercher_contact", plugin: "hubspot", version: "1.0.0",
    titre: "Rechercher un contact HubSpot",
    description: "Retrouve un contact du CRM HubSpot par son e-mail : nom, société, propriétaire, dernière activité. À utiliser quand une personne externe n'est pas dans l'annuaire de l'ERP.",
    primitive: "INFORMATION", effect: "READ", domaine: "GENERAL",
    entrees: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
    sorties: { description: "les contacts trouvés", cles: ["results"] },
    permissions: {},
    risques: { niveau: "FAIBLE", irreversible: false, externe: true },
    cout: { latence: "MEDIUM" },
    dependances: { config: ["HUBSPOT_BASE_URL", "HUBSPOT_TOKEN"], services: ["HubSpot CRM v3"] },
    limites: { parMinute: 30 },
    executeur: {
      type: "http", base: "HUBSPOT_BASE_URL", methode: "POST",
      chemin: "/crm/v3/objects/contacts/search",
      entetes: { "Content-Type": "application/json" },
      auth: { type: "bearer", config: "HUBSPOT_TOKEN" },
      corps: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: "{{entree.email}}" }] }], properties: ["firstname", "lastname", "company", "hubspot_owner_id", "lastmodifieddate"], limit: 5 },
      reponse: { chemin: "results" },
    },
  },
  {
    id: "creer_transaction", plugin: "hubspot", version: "1.0.0",
    titre: "Créer une transaction HubSpot",
    description: "Ouvre une transaction (deal) dans HubSpot : nom, montant, étape du pipeline, date de clôture prévue. Un aperçu est rendu d'abord ; la création exige la confirmation de la personne.",
    primitive: "ACTION", effect: "EXTERNAL_COMMUNICATION", domaine: "GENERAL",
    entrees: {
      type: "object",
      properties: { nom: { type: "string" }, montant: { type: "number" }, etape: { type: "string" }, clotureLe: { type: "string", description: "AAAA-MM-JJ" } },
      required: ["nom", "montant", "etape"],
    },
    sorties: { description: "la transaction créée", cles: ["id", "properties"] },
    permissions: { roles: ["SUPER_ADMIN", "DIRECTION", "GENERAL_MANAGER", "HEAD_OF_SALES", "OPERATIONS_DIRECTOR"] },
    risques: { niveau: "MOYEN", irreversible: false, externe: true, note: "supprimable dans HubSpot" },
    cout: { latence: "MEDIUM" },
    dependances: { config: ["HUBSPOT_BASE_URL", "HUBSPOT_TOKEN"], services: ["HubSpot CRM v3"] },
    evenements: { emet: ["crm.transaction-creee"] },
    limites: { parMinute: 5 },
    executeur: {
      type: "http", base: "HUBSPOT_BASE_URL", methode: "POST",
      chemin: "/crm/v3/objects/deals",
      entetes: { "Content-Type": "application/json" },
      auth: { type: "bearer", config: "HUBSPOT_TOKEN" },
      corps: { properties: { dealname: "{{entree.nom}}", amount: "{{entree.montant}}", dealstage: "{{entree.etape}}", closedate: "{{entree.clotureLe}}" } },
    },
  },
];
