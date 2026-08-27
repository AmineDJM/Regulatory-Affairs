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
 * ── LA PORTE : VUE GLOBALE, ET PAS UN MODULE ─────────────────────────────────────────────
 *
 * Première version : `REGULATORY:VIEW` pour l'économie d'un produit, `PCH:VIEW` pour l'état
 * d'un marché. Ça paraissait juste — chaque capacité gardée par le module dont elle parle.
 *
 * C'était FAUX, et l'audit hostile l'a montré. Ces capacités ne parlent pas d'un module : elles
 * TRAVERSENT. `product_economics` rend le chiffre d'affaires encaissé, la créance ouverte, le
 * coût humain analytique et l'investissement promotionnel — c'est-à-dire de la finance et de la
 * RH — à quiconque possède `REGULATORY:VIEW`, ce qu'a n'importe quel assistant réglementaire.
 * La séquence d'outils qu'elles remplacent, elle, était gardée outil par outil : chacun refusait
 * ce que l'appelant n'avait pas le droit de lire. En la condensant, on avait condensé les portes.
 *
 * Et le CLOISONNEMENT PAR ENTITÉ ne peut pas non plus être tenu ici : le `Principal` du contrat
 * ne porte pas les sociétés de l'appelant, à dessein — Adam ne raisonne pas sur le RBAC. Une
 * capacité qui agrège sur toute la base ne peut donc s'ouvrir qu'à qui voit déjà toute la base.
 *
 * La porte est donc la VUE GLOBALE (PDG, Super Admin, direction), plus le module concerné comme
 * plancher. C'est plus restrictif que ce que la mission demandait, et c'est volontaire : §45 dit
 * qu'Adam est un outil de direction. Un employé garde ses écrans métier, qui sont cloisonnés.
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

/**
 * QUI PEUT INTERROGER UNE VUE TRANSVERSE.
 *
 * Vue globale OU Super Admin, ET le module concerné. Le module seul ne suffit pas : ces
 * capacités agrègent finance, RH et réglementaire en une réponse, et aucune d'elles ne sait
 * cloisonner par entité — le contrat ne transporte pas les sociétés de l'appelant.
 */
const vueTransverse = (u: Parameters<PowerTool["allowed"]>[0], module: string): boolean => {
  const p = principalOf(u);
  const global = p.capabilities.has("platform:global-view") || p.capabilities.has("platform:super-admin");
  return global && p.capabilities.has(`${module}:VIEW`);
};

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
    allowed: (u) => vueTransverse(u, "REGULATORY"),
    label: "Économie d'un produit",
    run: async (input, user) => {
      const mention = str(input, "produit");
      if (mention.length < 2) return "Donnez la référence, l'alias ou la DCI du produit.";

      const r = await inProcessPlatform.query(principalOf(user), { kind: "product.economics", mention });
      if (r.kind !== "product.economics") return "Réponse inattendue de la plateforme.";
      // La question remonte TELLE QUELLE : elle est déjà rédigée pour être lue à l'humain.
      if (!r.data) return r.question ?? "Produit introuvable.";
      // La vue 360 est un RANGEMENT des champs qui suivent — métriques, portefeuille, marchés,
      // ventes, limites. Le modèle a les faits ; l'écran a la mise en forme.
      return JSON.stringify({ ...r.data, _blocsDecoratifs: true });
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
    allowed: (u) => vueTransverse(u, "PCH"),
    label: "État d'un marché PCH",
    run: async (input, user) => {
      const reference = str(input, "marche");
      if (reference.length < 2) return "Donnez la référence du marché.";

      const r = await inProcessPlatform.query(principalOf(user), { kind: "pch.market-status", reference });
      if (r.kind !== "pch.market-status") return "Réponse inattendue de la plateforme.";
      if (!r.data) return r.question ?? "Marché introuvable.";
      return JSON.stringify({ ...r.data, _blocsDecoratifs: true });
    },
  },

  // ───────────────────────── L'HISTOIRE D'UNE AFFAIRE ─────────────────────────
  /**
   * « RETRACE-MOI X » — et pourquoi le modèle NE CONSTRUIT PAS la frise.
   *
   * Une chronologie inventée est indétectable : elle a l'air d'une chronologie. Un jalon
   * plausible mais absent de la base — « facture émise en mars » — se lit exactement comme un
   * fait, et personne ne remonte à la source pour vérifier une frise qui semble cohérente.
   *
   * Les jalons viennent donc TOUS d'une lecture : un PchOrder est un bon de commande, un
   * MailEntry est un courrier, un LegalDocument est un contrat. Ce qui est DÉDUIT (la date de
   * soumission, inférée de la publication) le dit dans `certitude`, et ce qui MANQUE — la
   * facture jamais émise — est affiché comme un trou, parce que c'est précisément ce qu'on
   * cherche en retraçant une affaire.
   *
   * Le modèle reçoit les KPI et les limites ; il LIT l'histoire, il ne l'écrit pas.
   */
  {
    def: {
      name: "business_story",
      description:
        "RETRACE UNE AFFAIRE DE BOUT EN BOUT (« retrace-moi l'AONIO 2023 », « raconte-moi l'histoire du Nivolumab », "
        + "« où ça a bloqué sur ce marché ? »). Reconstitue la CHRONOLOGIE RÉELLE depuis la base : publication, "
        + "soumission, attribution et ses lots, contrat et avenants, chaque bon de commande avec sa livraison, sa facture "
        + "et son paiement, les courriers, la clôture. Rend aussi les KPI de l'affaire (attribué, commandé, livré, encaissé, "
        + "délai moyen de paiement, retards) et ce qui MANQUE — un paiement jamais reçu apparaît comme un jalon absent. "
        + "N'INVENTE AUCUN JALON : chaque jalon porte sa PROVENANCE (l'enregistrement d'où il vient) et sa certitude — "
        + "fait ou déduit — de sorte que la DÉFINITION de ce qu'on montre voyage avec la donnée au lieu d'être supposée. "
        + "Accepte une référence de marché ou un nom de produit ; si la mention est ambiguë, rend la question à poser.",
      input_schema: {
        type: "object",
        properties: {
          affaire: { type: "string", description: "Référence de marché (« AO-2025-014 ») ou nom / DCI d'un produit." },
        },
        required: ["affaire"],
      },
    },
    // Une histoire d'affaire traverse marchés, contrats et paiements : la voir suppose la vue
    // PCH, qui est la porte d'entrée de ces objets. La plateforme revérifie de son côté.
    // L'ANCRE PEUT ÊTRE UN MARCHÉ **OU** UN PRODUIT, et la frise d'un produit montre ses
    // dossiers réglementaires. L'un des deux modules suffit donc — sous vue globale, qui reste
    // la vraie porte.
    allowed: (u) => vueTransverse(u, "PCH") || vueTransverse(u, "REGULATORY"),
    label: "Histoire d'une affaire",
    run: async (input, user) => {
      const ancre = str(input, "affaire");
      if (ancre.length < 2) return "De quelle affaire — marché, produit ?";

      const r = await inProcessPlatform.query(principalOf(user), { kind: "business.story", ancre });
      if (r.kind !== "business.story") return "Réponse inattendue de la plateforme.";
      if (!r.data) return r.question ?? "Affaire introuvable.";

      const st = r.data;
      // CE QUE LE MODÈLE LIT RESTE COURT — les chiffres et les manques, de quoi commenter. La
      // frise elle-même part dans `_blocs`, vers l'écran, et n'est pas relue par le modèle.
      return JSON.stringify({
        affaire: st.titre,
        precision: st.sousTitre,
        jalons: st.events.length,
        kpis: st.kpis,
        limites: st.limites,
        // TOUT CE DONT LE MODÈLE A BESOIN EST CI-DESSUS : le titre, le nombre de jalons, les
        // KPI et les limites. La frise, elle, est de l'affichage — quatre-vingts jalons avec
        // leurs pièces et leurs participants qu'il n'utiliserait pas. Ce drapeau l'en dispense.
        _blocsDecoratifs: true,
        _blocs: [{
          kind: "story",
          title: st.titre,
          subtitle: st.sousTitre,
          kpis: st.kpis,
          events: st.events,
          threads: st.threads,
          limites: st.limites,
          // L'IDENTITÉ DU BLOC EST STABLE : redemander la même affaire remplace la carte au lieu
          // d'en empiler une seconde dont on ne saurait plus laquelle fait foi.
          blockId: `story:${st.ancre.type}:${st.ancre.id}`,
          entityRef: st.ancre,
          state: "complete",
          certitude: "fait",
        }],
      });
    },
  },
  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * « OÙ TU EN ES ? » — §46.
   *
   * ── POURQUOI CETTE CAPACITÉ NE RAISONNE PAS ─────────────────────────────────────────
   *
   * L'état d'une mission est EN BASE, exactement. Le faire décrire par un raisonnement long
   * coûterait une seconde et demie et introduirait le risque qu'il se trompe sur un compte
   * qu'un `SELECT` donne juste. Elle lit, elle compose, elle rend — et la carte se met à jour
   * SUR PLACE grâce à un `blockId` stable (§43), au lieu d'empiler une carte par instant.
   *
   * ── LA PORTE ────────────────────────────────────────────────────────────────────────
   *
   * Une mission appartient à quelqu'un. La requête filtre par `ownerId` : ce n'est pas un
   * contrôle de confort, c'est le cloisonnement — personne ne lit la mission d'un autre, même
   * en connaissant son identifiant.
   * ═══════════════════════════════════════════════════════════════════════════════════════
   */
  {
    def: {
      name: "mission_status",
      description:
        "OÙ EN EST UNE MISSION EN COURS (« où tu en es ? », « ça avance ? », « quelles missions tournent ? »). "
        + "Rend l'état RÉEL lu en base : chaque étape avec son état et son reçu, les éventails repliés avec leur "
        + "compte (« 31/33 effectuées »), les sous-missions, et ce qui attend une action de votre part. "
        + "DÉFINITION : l'avancement compte les étapes RÉELLEMENT exécutées — les itérations d'un éventail, pas leur "
        + "modèle — de sorte que 31 envois sur 33 s'affichent 31/33 et jamais 1/1. Sans identifiant, rend les "
        + "missions en cours. N'INVENTE RIEN : une étape sautée n'est jamais présentée comme faite.",
      input_schema: {
        type: "object",
        properties: {
          mission: { type: "string", description: "Identifiant de la mission. Omis : les missions en cours." },
        },
      },
    },
    // OUVERTE PAR DESSEIN, et cloisonnée PAR REQUÊTE — même design qu'`action_history` : la
    // lecture filtre sur `ownerId`, donc chacun ne voit que SES missions. Exiger en plus un
    // droit de module fermerait à quelqu'un l'accès à une mission qu'Adam a menée POUR LUI,
    // ce qui ne protège rien et retire une capacité. Le test de sécurité l'exige déclarée.
    allowed: () => true,
    label: "État d'une mission",
    run: async (input, user) => {
      const id = str(input, "mission");
      const r = await inProcessPlatform.query(principalOf(user), {
        kind: "mission.status", ...(id ? { mission: id } : {}),
      });
      if (r.kind !== "mission.status") return "Réponse inattendue de la plateforme.";

      if (!id) {
        const liste = r.missions ?? [];
        if (liste.length === 0) return JSON.stringify({ missions: [], message: "Aucune mission en cours." });
        return JSON.stringify({ missions: liste });
      }
      if (!r.data) return "Mission introuvable, ou elle ne vous appartient pas.";

      const v = r.data;
      return JSON.stringify({
        titre: v.titre,
        etat: v.etat,
        avancement: v.avancement,
        enAttenteDeVous: v.enAttenteDeVous,
        sousMissions: v.sousMissions,
        // LE DÉTAIL DES ÉTAPES PART À L'ÉCRAN, pas au modèle : trente lignes d'état qu'il ne
        // commenterait pas une par une, et dont il n'a pas besoin pour répondre.
        _blocsDecoratifs: true,
        _blocs: [v.bloc],
      });
    },
  },
];
