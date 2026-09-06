import type { SkillManifest } from "@/lib/skills/manifest";

/** API PCH (Pharmacie centrale des hôpitaux) — appels d'offres ouverts, dépôt d'une offre. Configuration : PCH_BASE_URL, PCH_TOKEN. */
export const PCH: SkillManifest[] = [
  {
    id: "appels_d_offres", plugin: "pch", version: "1.0.0",
    titre: "Appels d'offres PCH",
    description: "Liste les appels d'offres de la PCH par statut (OUVERT, CLOS, ATTRIBUE) : référence, objet, date limite, lots. À utiliser pour « quels appels d'offres sont ouverts ? » — la source officielle, pas les tendances internes de l'ERP.",
    primitive: "INFORMATION", effect: "READ", domaine: "REGULATORY",
    entrees: { type: "object", properties: { statut: { type: "string", enum: ["OUVERT", "CLOS", "ATTRIBUE"] }, limite: { type: "number" } }, required: ["statut"] },
    sorties: { description: "les appels d'offres", cles: ["items"] },
    permissions: { module: "regulatory", action: "view" },
    risques: { niveau: "FAIBLE", irreversible: false, externe: true },
    cout: { latence: "MEDIUM" },
    dependances: { config: ["PCH_BASE_URL", "PCH_TOKEN"], services: ["API PCH"] },
    limites: { parMinute: 20 },
    executeur: {
      type: "http", base: "PCH_BASE_URL", methode: "GET",
      chemin: "/tenders?status={{entree.statut}}&limit={{entree.limite}}",
      auth: { type: "bearer", config: "PCH_TOKEN" },
      reponse: { chemin: "items" },
    },
  },
  {
    id: "deposer_offre", plugin: "pch", version: "1.0.0",
    titre: "Déposer une offre PCH",
    description: "Dépose une offre sur un lot d'appel d'offres PCH : référence, lot, prix unitaire, quantité, validité. Engage la société : un aperçu est rendu d'abord, le dépôt exige la confirmation de la personne.",
    primitive: "ACTION", effect: "FINANCIAL_COMMITMENT", domaine: "REGULATORY",
    entrees: {
      type: "object",
      properties: { reference: { type: "string" }, lot: { type: "string" }, prixUnitaire: { type: "number" }, quantite: { type: "number" }, validiteJours: { type: "number" } },
      required: ["reference", "lot", "prixUnitaire", "quantite"],
    },
    sorties: { description: "l'accusé de dépôt", cles: ["offerId", "receivedAt"] },
    permissions: { module: "regulatory", action: "edit", vueGlobale: true },
    risques: { niveau: "ELEVE", irreversible: true, externe: true, note: "une offre déposée engage jusqu'à la fin de sa validité" },
    cout: { latence: "HIGH" },
    dependances: { config: ["PCH_BASE_URL", "PCH_TOKEN"], services: ["API PCH"] },
    evenements: { emet: ["pch.offre-deposee"] },
    limites: { parMinute: 2, parJour: 20 },
    executeur: {
      type: "http", base: "PCH_BASE_URL", methode: "POST",
      chemin: "/tenders/{{entree.reference}}/offers",
      entetes: { "Content-Type": "application/json" },
      auth: { type: "bearer", config: "PCH_TOKEN" },
      corps: { lot: "{{entree.lot}}", unitPrice: "{{entree.prixUnitaire}}", quantity: "{{entree.quantite}}", validityDays: "{{entree.validiteJours}}" },
    },
  },
];
