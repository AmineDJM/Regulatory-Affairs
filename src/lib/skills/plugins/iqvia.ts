import type { SkillManifest } from "@/lib/skills/manifest";

/** IQVIA — les ventes de marché par molécule. Configuration : IQVIA_BASE_URL, IQVIA_API_KEY. */
export const IQVIA: SkillManifest[] = [
  {
    id: "ventes_molecule", plugin: "iqvia", version: "1.0.0",
    titre: "Ventes de marché d'une molécule (IQVIA)",
    description: "Lit les ventes de marché d'une molécule (unités, valeur, parts par laboratoire) sur une période, depuis IQVIA. À utiliser pour une part de marché, une tendance de classe ou un concurrent — jamais pour les ventes internes, qui sont dans l'ERP.",
    primitive: "INFORMATION", effect: "READ", domaine: "REGULATORY",
    entrees: {
      type: "object",
      properties: { molecule: { type: "string" }, periode: { type: "string", description: "AAAA-MM ou AAAA-TN" }, pays: { type: "string", description: "Code pays, DZ par défaut." } },
      required: ["molecule", "periode"],
    },
    sorties: { description: "les ventes de marché", cles: ["molecule", "periode", "unites", "valeur", "parts"] },
    permissions: { module: "regulatory", action: "view" },
    risques: { niveau: "FAIBLE", irreversible: false, externe: true, note: "données sous licence : ne pas les recopier hors de l'ERP" },
    cout: { latence: "HIGH", estimeUsd: 0.2, note: "chaque requête consomme le quota de licence" },
    dependances: { config: ["IQVIA_BASE_URL", "IQVIA_API_KEY"], services: ["IQVIA Market Data API"] },
    limites: { parMinute: 10, parJour: 200 },
    executeur: {
      type: "http", base: "IQVIA_BASE_URL", methode: "GET",
      chemin: "/v1/sales?molecule={{entree.molecule}}&period={{entree.periode}}&country={{entree.pays}}",
      auth: { type: "entete", nom: "x-api-key", config: "IQVIA_API_KEY" },
      reponse: { chemin: "data" },
    },
  },
];
