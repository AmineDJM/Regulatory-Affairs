import type { SkillManifest } from "@/lib/skills/manifest";

/** SAP S/4HANA (OData) — lire une commande d'achat, en créer une. Configuration : SAP_BASE_URL, SAP_TOKEN. */
export const SAP: SkillManifest[] = [
  {
    id: "lire_commande_achat", plugin: "sap", version: "1.0.0",
    titre: "Lire une commande d'achat SAP",
    description: "Lit une commande d'achat dans SAP (fournisseur, organisation d'achat, montant, statut) à partir de son numéro. À utiliser quand une question porte sur une commande qui vit dans SAP et non dans l'ERP.",
    primitive: "INFORMATION", effect: "READ", domaine: "FINANCE",
    entrees: { type: "object", properties: { numero: { type: "string", description: "Numéro de commande SAP (10 chiffres)." } }, required: ["numero"] },
    sorties: { description: "la commande d'achat", cles: ["PurchaseOrder", "Supplier", "PurchasingOrganization", "PurchaseOrderDate", "DocumentCurrency"] },
    permissions: { module: "finance", action: "view" },
    risques: { niveau: "FAIBLE", irreversible: false, externe: true },
    cout: { latence: "MEDIUM" },
    dependances: { config: ["SAP_BASE_URL", "SAP_TOKEN"], services: ["SAP S/4HANA API_PURCHASEORDER_PROCESS_SRV"] },
    limites: { parMinute: 30 },
    executeur: {
      type: "http", base: "SAP_BASE_URL", methode: "GET",
      chemin: "/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('{{entree.numero}}')",
      entetes: { Accept: "application/json" },
      auth: { type: "bearer", config: "SAP_TOKEN" },
      reponse: { chemin: "d" },
    },
  },
  {
    id: "creer_commande_achat", plugin: "sap", version: "1.0.0",
    titre: "Créer une commande d'achat SAP",
    description: "Crée une commande d'achat dans SAP pour un fournisseur et une organisation d'achat, avec ses lignes (article, quantité, prix). Engage la société : un aperçu est rendu d'abord, l'envoi exige la confirmation de la personne.",
    primitive: "ACTION", effect: "FINANCIAL_COMMITMENT", domaine: "FINANCE",
    entrees: {
      type: "object",
      properties: {
        fournisseur: { type: "string" }, organisationAchat: { type: "string" }, societe: { type: "string" }, devise: { type: "string" },
        lignes: { type: "array", items: { type: "object", properties: { article: { type: "string" }, quantite: { type: "number" }, prixUnitaire: { type: "number" } } } },
      },
      required: ["fournisseur", "organisationAchat", "societe", "lignes"],
    },
    sorties: { description: "la commande créée", cles: ["PurchaseOrder", "PurchaseOrderDate"] },
    permissions: { module: "finance", action: "edit" },
    risques: { niveau: "ELEVE", irreversible: false, externe: true, note: "annulable dans SAP tant qu'aucune réception n'est saisie" },
    cout: { latence: "HIGH" },
    dependances: { config: ["SAP_BASE_URL", "SAP_TOKEN"], services: ["SAP S/4HANA API_PURCHASEORDER_PROCESS_SRV"] },
    evenements: { emet: ["finance.commande-achat-creee"] },
    limites: { parMinute: 3, parJour: 50 },
    executeur: {
      type: "http", base: "SAP_BASE_URL", methode: "POST",
      chemin: "/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder",
      entetes: { Accept: "application/json", "Content-Type": "application/json" },
      auth: { type: "bearer", config: "SAP_TOKEN" },
      corps: { Supplier: "{{entree.fournisseur}}", PurchasingOrganization: "{{entree.organisationAchat}}", CompanyCode: "{{entree.societe}}", DocumentCurrency: "{{entree.devise}}", to_PurchaseOrderItem: "{{entree.lignes}}" },
      reponse: { chemin: "d" },
    },
  },
];
