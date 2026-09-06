import type { SkillManifest } from "@/lib/skills/manifest";

/**
 * LES CONNECTEURS DE MESSAGERIE (mandat 5 §37) — Slack, Teams, WhatsApp, SMS.
 *
 * Un même geste, « envoyer un message à quelqu'un », déclaré quatre fois sous le même nom
 * (`<canal>_envoyer_message`) et la même entrée (`destinataire`, `texte`) : c'est ce qui permet à
 * la porte d'attention de parler par le canal PRÉFÉRÉ de la personne sans connaître le canal.
 * Chaque connecteur n'existe que si sa configuration est posée ; sinon il est « non configuré »,
 * jamais « pas prévu ». Aucune URL, aucun jeton ici : des NOMS de variables.
 *
 * Les quatre sont des communications EXTERNES : dans la conversation, un aperçu est rendu et la
 * personne confirme ; dans une mission, l'accord vient de la porte d'approbation (le runner pose
 * `confirmer`) ; depuis la porte d'attention, c'est la personne elle-même qui est jointe, sur le
 * canal qu'elle a demandé par une règle enseignée.
 */
const ENTREES: SkillManifest["entrees"] = {
  type: "object",
  properties: {
    destinataire: { type: "string", description: "Le destinataire : identifiant de canal ou d'utilisateur (Slack), numéro international (WhatsApp, SMS). Teams : ignoré, le webhook est lié à un canal." },
    texte: { type: "string", description: "Le message, tel qu'il sera lu." },
  },
  required: ["destinataire", "texte"],
};

const COMMUN: Pick<SkillManifest, "primitive" | "effect" | "domaine" | "sorties" | "permissions" | "risques" | "cout" | "limites"> = {
  primitive: "ACTION", effect: "EXTERNAL_COMMUNICATION", domaine: "GENERAL",
  sorties: { description: "l'accusé du service", cles: ["ok", "id"] },
  permissions: {},
  risques: { niveau: "MOYEN", irreversible: true, externe: true, note: "un message parti ne se rappelle pas" },
  cout: { latence: "LOW" },
  limites: { parMinute: 20, parJour: 300 },
};

export const MESSAGERIE: SkillManifest[] = [
  {
    ...COMMUN, id: "envoyer_message", plugin: "slack", version: "1.0.0",
    titre: "Envoyer un message Slack",
    description: "Envoie un message dans un canal ou à une personne Slack (chat.postMessage). Configuration : SLACK_BASE_URL, SLACK_BOT_TOKEN.",
    entrees: ENTREES,
    dependances: { config: ["SLACK_BASE_URL", "SLACK_BOT_TOKEN"], services: ["Slack Web API"] },
    evenements: { emet: ["comms.message-envoye"] },
    executeur: {
      type: "http", base: "SLACK_BASE_URL", methode: "POST", chemin: "/chat.postMessage",
      auth: { type: "bearer", config: "SLACK_BOT_TOKEN" },
      corps: { channel: "{{entree.destinataire}}", text: "{{entree.texte}}" },
    },
  },
  {
    ...COMMUN, id: "envoyer_message", plugin: "teams", version: "1.0.0",
    titre: "Envoyer un message Teams",
    description: "Poste un message dans le canal Teams lié au webhook entrant configuré. Configuration : TEAMS_WEBHOOK_URL (le webhook porte le canal).",
    entrees: { ...ENTREES, required: ["texte"] },
    dependances: { config: ["TEAMS_WEBHOOK_URL"], services: ["Microsoft Teams — webhook entrant"] },
    evenements: { emet: ["comms.message-envoye"] },
    executeur: { type: "http", base: "TEAMS_WEBHOOK_URL", methode: "POST", chemin: "", corps: { text: "{{entree.texte}}" } },
  },
  {
    ...COMMUN, id: "envoyer_message", plugin: "whatsapp", version: "1.0.0",
    titre: "Envoyer un message WhatsApp",
    description: "Envoie un message texte WhatsApp (API Cloud) à un numéro international. Configuration : WHATSAPP_BASE_URL, WHATSAPP_PHONE_ID, WHATSAPP_TOKEN.",
    entrees: ENTREES,
    dependances: { config: ["WHATSAPP_BASE_URL", "WHATSAPP_PHONE_ID", "WHATSAPP_TOKEN"], services: ["WhatsApp Business Cloud API"] },
    evenements: { emet: ["comms.message-envoye"] },
    executeur: {
      type: "http", base: "WHATSAPP_BASE_URL", methode: "POST", chemin: "/{{config.WHATSAPP_PHONE_ID}}/messages",
      auth: { type: "bearer", config: "WHATSAPP_TOKEN" },
      corps: { messaging_product: "whatsapp", to: "{{entree.destinataire}}", type: "text", text: { body: "{{entree.texte}}" } },
    },
  },
  {
    ...COMMUN, id: "envoyer_message", plugin: "sms", version: "1.0.0",
    titre: "Envoyer un SMS",
    description: "Envoie un SMS à un numéro international par la passerelle configurée (API compatible Twilio : authentification basique, corps de formulaire). Configuration : SMS_BASE_URL, SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM.",
    entrees: ENTREES,
    dependances: { config: ["SMS_BASE_URL", "SMS_ACCOUNT_SID", "SMS_AUTH_TOKEN", "SMS_FROM"], services: ["passerelle SMS (Twilio-compatible)"] },
    evenements: { emet: ["comms.message-envoye"] },
    executeur: {
      type: "http", base: "SMS_BASE_URL", methode: "POST", chemin: "/2010-04-01/Accounts/{{config.SMS_ACCOUNT_SID}}/Messages.json",
      auth: { type: "basic", utilisateur: "SMS_ACCOUNT_SID", motDePasse: "SMS_AUTH_TOKEN" },
      corpsForme: "formulaire",
      corps: { To: "{{entree.destinataire}}", From: "{{config.SMS_FROM}}", Body: "{{entree.texte}}" },
    },
  },
];

/** Les canaux qu'un connecteur de messagerie peut porter — le nom d'outil est `<canal>_envoyer_message`. */
export const CANAUX_MESSAGERIE = ["slack", "teams", "whatsapp", "sms"] as const;
export type CanalMessagerie = (typeof CANAUX_MESSAGERIE)[number];
export const outilDeCanal = (canal: CanalMessagerie): string => `${canal}_envoyer_message`;
