import type { PowerTool } from "@/lib/assistant/power-tools";
import { inProcessPlatform, principalOf } from "@/platform/in-process/adapter";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CAPACITÉS MÉTIER — une question, un appel.
 *
 * ── CE QUE C'EST, ET CE QUE CE N'EST PAS ─────────────────────────────────────────────────
 *
 * Ce ne sont pas des outils de plus. Le registre en compte déjà plus de cent, et en ajouter
 * huit rendrait Adam plus lent, pas plus intelligent. Chaque capacité ici REMPLACE une SÉQUENCE
 * que le modèle devait sinon conduire lui-même, en plusieurs allers-retours, avec à chaque pas
 * un risque de rapprochement au jugé sur des libellés texte.
 *
 * Le critère d'admission est donc strict : une capacité n'entre que si elle répond à une
 * question qu'AUCUN outil existant ne sait traiter en un appel, et qu'elle s'appuie sur des
 * relations RÉELLES (clés étrangères) plutôt que sur une correspondance de noms.
 *
 * ── CE QUI A ÉTÉ ÉCARTÉ, ET POURQUOI ─────────────────────────────────────────────────────
 *
 * « Dossiers réglementaires bloqués » n'est pas ici : `regulatory_portfolio` et
 * `regulatoryExecutiveState` le calculent déjà, et un second chemin vers le même fait est
 * exactement ce qui fait diverger deux réponses à la même question.
 * « Créances » non plus : `finance_totals` et `read_finances` couvrent la trésorerie, et la
 * créance PAR PRODUIT est déjà rendue par `product_economics` ci-dessous.
 *
 * ── POURQUOI CE FICHIER NE TOUCHE PAS L'ERP ──────────────────────────────────────────────
 *
 * Première version écrite : elle importait `queries/product-360`, `queries/pch-360`,
 * `queries/metrics` et `products/resolve` en direct. `boundary.test.ts` a échoué immédiatement
 * — 428 franchissements pour un plafond de 424 — et son message donnait le remède : « le besoin
 * est vraiment nouveau → l'ajouter au CONTRAT ». C'est ce qui a été fait : deux lectures
 * (`product.economics`, `pch.market-status`) sont entrées dans `PlatformQuery`, et tout le
 * travail vit désormais dans l'adaptateur, côté ERP.
 *
 * Le résultat n'est pas seulement conforme, il est meilleur : Adam ne sait pas qu'il existe un
 * produit canonique, une couche de métriques, ni cinq définitions du mot « chiffre d'affaires ».
 * Il pose une question métier et reçoit une vue. Le jour où Adam devient un service à part, ces
 * deux capacités partent sans une ligne à changer.
 *
 * ── LE NOM DES OUTILS ────────────────────────────────────────────────────────────────────
 *
 * Les capacités ont été spécifiées en `product.getEconomics`, `pch.getMarketStatus`. Le point
 * est INTERDIT dans un nom d'outil côté fournisseur (`^[a-zA-Z0-9_-]{1,64}$`) : elles sont donc
 * nommées en `snake_case`, dans la convention déjà en place (`product_360`, `employee_360`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

export const BUSINESS_CAPABILITIES: PowerTool[] = [
  // ───────────────────────── L'ÉCONOMIE D'UN PRODUIT ─────────────────────────
  {
    def: {
      name: "product_economics",
      description:
        "COMBIEN UN PRODUIT RAPPORTE ET COÛTE, en un appel (« le produit X est-il rentable ? », « combien a-t-on encaissé "
        + "sur Y ? », « qui le porte et pour quel coût ? »). Rend, chacun avec SA DÉFINITION : chiffre d'affaires attribué "
        + "sur marchés, commandé, ENCAISSÉ, créances ouvertes, investissement promotionnel imputé, coût humain analytique, "
        + "contribution, retard réglementaire, fréquence de visite — plus le portefeuille (qui porte le produit, depuis quand, "
        + "pour quelle quotité) et les marchés PCH où il est nommé. "
        + "REMPLACE la séquence product_360 + read_finances + sales_operation + adpro_operation + read_hr_overview, et le "
        + "rapprochement par LIBELLÉ qu'elle imposait. Un montant indisponible rend `null` avec sa raison — jamais zéro. "
        + "Si la mention désigne plusieurs produits, rend la QUESTION à poser plutôt que de trancher.",
      input_schema: {
        type: "object",
        properties: {
          produit: { type: "string", description: "Référence PRD-…, alias, ou DCI + dosage (« nivolumab 100 mg »)." },
        },
        required: ["produit"],
      },
    },
    // LES DROITS RESTENT CEUX DE L'ERP. La capacité ne crée aucun accès : elle compose des
    // lectures que l'appelant pouvait déjà faire, et le contrat revérifie de son côté.
    allowed: (u) => principalOf(u).capabilities.has("REGULATORY:VIEW"),
    label: "Économie d'un produit",
    run: async (input, user) => {
      const mention = str(input, "produit");
      if (mention.length < 2) return "Donnez la référence, l'alias ou la DCI du produit.";

      const r = await inProcessPlatform.query(principalOf(user), { kind: "product.economics", mention });
      if (r.kind !== "product.economics") return "Réponse inattendue de la plateforme.";
      // La question remonte TELLE QUELLE : elle est déjà rédigée pour être lue à l'humain.
      if (!r.data) return r.question ?? "Produit introuvable.";
      return JSON.stringify(r.data);
    },
  },

  // ───────────────────────── L'ÉTAT D'UN MARCHÉ PCH ─────────────────────────
  {
    def: {
      name: "pch_market_status",
      description:
        "OÙ EN EST UN MARCHÉ PCH, de la soumission à l'encaissement, en un appel (« où en est l'AO-2025-14 ? », "
        + "« combien nous doit encore la PCH sur ce marché ? »). Rend les CINQ MONTANTS QUI NE SE CONFONDENT PAS — attribué, "
        + "commandé, livré, encaissé, reste à encaisser — chacun avec sa définition ; l'état de la CAUTION et son échéance ; "
        + "les lignes avec leur produit canonique et leur taux de réalisation ; les bons en retard d'arrivée. "
        + "Les ventes enregistrées par les commerciaux sont rendues À PART et JAMAIS additionnées aux bons de commande : "
        + "les cumuler doublerait le chiffre d'affaires du marché. Accepte l'identifiant ou la référence.",
      input_schema: {
        type: "object",
        properties: {
          marche: { type: "string", description: "Référence du marché (« AO-2025-014 ») ou identifiant." },
        },
        required: ["marche"],
      },
    },
    allowed: (u) => principalOf(u).capabilities.has("PCH:VIEW"),
    label: "État d'un marché PCH",
    run: async (input, user) => {
      const reference = str(input, "marche");
      if (reference.length < 2) return "Donnez la référence du marché.";

      const r = await inProcessPlatform.query(principalOf(user), { kind: "pch.market-status", reference });
      if (r.kind !== "pch.market-status") return "Réponse inattendue de la plateforme.";
      if (!r.data) return r.question ?? "Marché introuvable.";
      return JSON.stringify(r.data);
    },
  },
];
