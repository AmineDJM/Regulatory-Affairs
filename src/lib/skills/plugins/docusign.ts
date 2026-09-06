import type { SkillManifest } from "@/lib/skills/manifest";

/** DocuSign — envoyer une pièce à signer, suivre une enveloppe. Configuration : DOCUSIGN_BASE_URL, DOCUSIGN_TOKEN, DOCUSIGN_ACCOUNT_ID. */
export const DOCUSIGN: SkillManifest[] = [
  {
    id: "envoyer_pour_signature", plugin: "docusign", version: "1.0.0",
    titre: "Envoyer un document à signer (DocuSign)",
    description: "Crée et envoie une enveloppe DocuSign à un signataire : nom, e-mail, objet, et l'URL du document (une pièce du Drive exposée par l'ERP). À utiliser quand la personne demande de « faire signer » un contrat ou un avenant. Rend l'identifiant d'enveloppe et son statut.",
    primitive: "ACTION", effect: "EXTERNAL_COMMUNICATION", domaine: "LEGAL",
    entrees: {
      type: "object",
      properties: {
        signataireNom: { type: "string" }, signataireEmail: { type: "string" },
        objet: { type: "string" }, message: { type: "string" },
        documentNom: { type: "string" }, documentUrl: { type: "string", description: "URL du document à signer (pièce du Drive)." },
      },
      required: ["signataireNom", "signataireEmail", "objet", "documentNom", "documentUrl"],
    },
    sorties: { description: "l'enveloppe créée", cles: ["envelopeId", "status", "statusDateTime"] },
    permissions: { module: "legal", action: "edit" },
    risques: { niveau: "ELEVE", irreversible: true, externe: true, note: "un e-mail part chez le signataire dès l'envoi" },
    cout: { latence: "HIGH", estimeUsd: 0.5, note: "facturé à l'enveloppe par DocuSign" },
    dependances: { config: ["DOCUSIGN_BASE_URL", "DOCUSIGN_TOKEN", "DOCUSIGN_ACCOUNT_ID"], services: ["DocuSign eSignature REST v2.1"] },
    evenements: { emet: ["legal.signature-envoyee"], ecoute: ["docusign.envelope-completed"] },
    limites: { parMinute: 5, parJour: 100 },
    executeur: {
      type: "http", base: "DOCUSIGN_BASE_URL", methode: "POST",
      chemin: "/accounts/{{config.DOCUSIGN_ACCOUNT_ID}}/envelopes",
      auth: { type: "bearer", config: "DOCUSIGN_TOKEN" },
      corps: {
        emailSubject: "{{entree.objet}}", emailBlurb: "{{entree.message}}", status: "sent",
        documents: [{ documentId: "1", name: "{{entree.documentNom}}", remoteUrl: "{{entree.documentUrl}}" }],
        recipients: { signers: [{ recipientId: "1", name: "{{entree.signataireNom}}", email: "{{entree.signataireEmail}}", routingOrder: "1" }] },
      },
    },
  },
  {
    id: "statut_enveloppe", plugin: "docusign", version: "1.0.0",
    titre: "Statut d'une enveloppe DocuSign",
    description: "Lit le statut d'une enveloppe DocuSign (envoyée, livrée, signée, refusée, annulée) et sa date. À utiliser pour « où en est la signature de… ».",
    primitive: "INFORMATION", effect: "READ", domaine: "LEGAL",
    entrees: { type: "object", properties: { envelopeId: { type: "string" } }, required: ["envelopeId"] },
    sorties: { description: "le statut de l'enveloppe", cles: ["envelopeId", "status", "statusDateTime", "emailSubject"] },
    permissions: { module: "legal", action: "view" },
    risques: { niveau: "FAIBLE", irreversible: false, externe: true },
    cout: { latence: "MEDIUM" },
    dependances: { config: ["DOCUSIGN_BASE_URL", "DOCUSIGN_TOKEN", "DOCUSIGN_ACCOUNT_ID"], services: ["DocuSign eSignature REST v2.1"] },
    limites: { parMinute: 30 },
    executeur: {
      type: "http", base: "DOCUSIGN_BASE_URL", methode: "GET",
      chemin: "/accounts/{{config.DOCUSIGN_ACCOUNT_ID}}/envelopes/{{entree.envelopeId}}",
      auth: { type: "bearer", config: "DOCUSIGN_TOKEN" },
    },
  },
];
