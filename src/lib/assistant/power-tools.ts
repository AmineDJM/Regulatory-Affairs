import type { ClaudeToolDef } from "@/lib/ai";
import type { CurrentUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { getEnvelopes, getEnvelopesGrandTotal, getBudgetOverview } from "@/lib/queries/budget";
import { getComptaData } from "@/lib/queries/compta";
import { getRhData, getLeavesToDecide } from "@/lib/queries/hr";
import { getActionCenter } from "@/lib/queries/action-center";
import { EXECUTIVE_TOOLS } from "@/lib/assistant/executive-tools";
import { EXECUTIVE_READ_TOOLS } from "@/lib/assistant/executive-read-tools";
import { EXECUTIVE_BRIEF_TOOLS } from "@/lib/assistant/executive-brief-tools";
import { MEMORY_TOOLS } from "@/lib/assistant/memory-tools";

/**
 * LES POUVOIRS DE L'ASSISTANT SONT **CEUX DE SON INTERLOCUTEUR** — ni plus, ni moins.
 *
 * L'assistant savait chercher un produit, un médecin, un événement… mais restait muet sur
 * l'argent : demander « où en est le budget Ad & Pro ? » ou « combien reste-t-il à encaisser ? »
 * renvoyait une invitation à ouvrir le module soi-même. Pour l'administrateur, qui voit tout
 * dans l'OS, c'était une amputation gratuite : l'assistant en savait moins que lui.
 *
 * La correction ne consiste PAS à ouvrir ces outils « à l'admin » : elle consiste à les ouvrir
 * **au droit**. Chaque outil déclare la permission qui l'active (`allowed`), lue dans la
 * matrice d'accès EFFECTIVE — celle-là même qui régit les pages. Un compte à qui le Super Admin
 * ouvre les Budgets gagne l'outil budget dans la seconde, sans toucher au code ; un compte à
 * qui on les ferme le perd tout aussi vite. Et les requêtes appelées ici sont **exactement**
 * celles des pages (`getBudgetOverview`, `getComptaData`, `getRhData`…), qui refiltrent
 * elles-mêmes par enveloppe visible et par entité : impossible de contourner un cloisonnement
 * en passant par la conversation.
 */

export interface PowerTool {
  def: ClaudeToolDef;
  /** Le droit qui ouvre l'outil — une PERMISSION, jamais un rôle en dur. */
  allowed: (user: CurrentUser) => boolean;
  /** Libellé affiché dans la trace (« ce que l'assistant a consulté »). */
  label: string;
  run: (input: Record<string, unknown>, user: CurrentUser) => Promise<string>;
}

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

/** Arrondi à l'unité : le modèle n'a que faire des centimes, et ça allège le contexte. */
const dzd = (n: number): number => Math.round(n);

export const POWER_TOOLS: PowerTool[] = [
  {
    def: {
      name: "read_budget",
      description:
        "Lit le BUDGET : enveloppes visibles par l'utilisateur avec montant total, alloué, consommé, restant et taux de consommation. " +
        "Sans `envelope`, renvoie la synthèse de TOUTES les enveloppes visibles (utiliser pour « où en est le budget ? », « combien reste-t-il ? »). " +
        "Avec `envelope` (nom ou fragment de nom), renvoie le DÉTAIL de cette enveloppe : postes/catégories, consommé par poste, dépenses non imputées. " +
        "Ne jamais inventer un montant : si l'enveloppe est introuvable ou fermée à l'utilisateur, le dire.",
      input_schema: {
        type: "object",
        properties: {
          envelope: { type: "string", description: "Nom (ou fragment) de l'enveloppe pour en obtenir le détail. Omettre pour la synthèse générale." },
        },
      },
    },
    allowed: (u) => userCan(u, "BUDGETS", "VIEW"),
    label: "Budget consulté",
    run: async (input, user) => {
      const wanted = str(input, "envelope");
      const envelopes = await getEnvelopes(user);
      if (envelopes.length === 0) return "Aucune enveloppe budgétaire ne vous est ouverte.";

      if (!wanted) {
        const total = await getEnvelopesGrandTotal(user);
        return JSON.stringify({
          enveloppesVisibles: total.count,
          totalDzd: dzd(total.total),
          alloueDzd: dzd(total.allocated),
          consommeDzd: dzd(total.consumed),
          restantDzd: dzd(total.remaining),
          parEnveloppe: total.items.map((e) => ({
            nom: e.name, totalDzd: dzd(e.total), consommeDzd: dzd(e.consumed), restantDzd: dzd(e.remaining),
          })),
        });
      }

      const needle = wanted.toLowerCase();
      const match = envelopes.find((e) => e.name.toLowerCase().includes(needle));
      if (!match) {
        return `Aucune enveloppe « ${wanted} » parmi celles qui vous sont ouvertes : ${envelopes.map((e) => e.name).join(", ")}.`;
      }
      const ov = await getBudgetOverview(user, match.id);
      if (!ov) return `L'enveloppe « ${match.name} » ne vous est pas ouverte.`;
      return JSON.stringify({
        enveloppe: ov.envelope.name,
        periode: { du: ov.period.from.slice(0, 10), au: ov.period.to.slice(0, 10) },
        totalDzd: dzd(ov.totals.total),
        alloueDzd: dzd(ov.totals.allocated),
        nonAlloueDzd: dzd(ov.totals.unallocated),
        consommeDzd: dzd(ov.totals.consumed),
        engageDzd: dzd(ov.totals.committed),
        restantDzd: dzd(ov.totals.remaining),
        tauxConsommationPct: ov.totals.pct,
        postes: ov.categories.map((c) => ({
          nom: c.name, alloueDzd: dzd(c.allocated), consommeDzd: dzd(c.consumed), restantDzd: dzd(c.remaining),
        })),
        depensesNonImputees: { nombre: ov.unattributed.count, montantDzd: dzd(ov.unattributed.total) },
      });
    },
  },
  {
    def: {
      name: "read_finances",
      description:
        "Lit la situation FINANCIÈRE de l'entité en cours : recettes et dépenses du mois, résultat, montant à encaisser, ordres de dépense à régler, retards, " +
        "décaissements à venir (salaires à part) et les principales catégories. À utiliser pour « où en est la trésorerie ? », « qu'est-ce qu'on doit payer ? », « qui nous doit de l'argent ? ».",
      input_schema: { type: "object", properties: {} },
    },
    allowed: (u) => userCan(u, "FINANCES", "VIEW"),
    label: "Situation financière consultée",
    run: async (_input, user) => {
      const d = await getComptaData(user.id);
      return JSON.stringify({
        recettesDuMoisDzd: dzd(d.recettesMois),
        depensesDuMoisDzd: dzd(d.depensesMois),
        resultatDuMoisDzd: dzd(d.resultatMois),
        aEncaisserDzd: dzd(d.aEncaisser),
        aReglerDzd: dzd(d.aReglerOrders),
        aReglerNombre: d.aReglerCount,
        enRetard: { nombre: d.enRetardCount, montantDzd: dzd(d.enRetardMontant) },
        decaissementsAVenir: {
          salairesDzd: dzd(d.depensesSalairesTotal),
          autresDzd: dzd(d.depensesAutresTotal),
        },
        depensesParCategorie: d.depByCat.slice(0, 8).map((c) => ({ categorie: c.category, montantDzd: dzd(c.amount) })),
        recettesParCategorie: d.recByCat.slice(0, 8).map((c) => ({ categorie: c.category, montantDzd: dzd(c.amount) })),
        aReglerDetail: d.ordersPending.slice(0, 15).map((o) => ({
          reference: o.reference, libelle: o.label, montantDzd: dzd(o.amount),
          beneficiaire: o.counterparty, echeance: o.date?.slice(0, 10) ?? null, enRetard: o.overdue,
        })),
      });
    },
  },
  {
    def: {
      name: "read_hr_overview",
      description:
        "Lit la situation RH : effectif total et actif, masse salariale du dernier mois de paie (avec sa source), congés en attente, avances sur salaire en attente, " +
        "contrats arrivant à échéance sous 60 jours, répartition par département. À utiliser pour « combien sommes-nous ? », « quelle est la masse salariale ? », « quels contrats expirent ? ».",
      input_schema: { type: "object", properties: {} },
    },
    allowed: (u) => userCan(u, "RH", "VIEW"),
    label: "Situation RH consultée",
    run: async (_input, user) => {
      const d = await getRhData(user.id);
      return JSON.stringify({
        effectifTotal: d.stats.total,
        effectifActif: d.stats.active,
        masseSalarialeDzd: dzd(d.stats.masseSalariale),
        masseSalarialeSource: d.stats.masseSalarialeSource,
        congesEnAttente: d.stats.pending,
        avancesEnAttente: d.stats.advances,
        contratsExpirantSous60j: d.contractsExpiring.map((e) => ({
          nom: e.fullName, fin: e.contractEnd?.toISOString().slice(0, 10) ?? null,
        })),
        parDepartement: d.byDepartment,
      });
    },
  },
  {
    def: {
      name: "list_pending_decisions",
      description:
        "Liste TOUT ce qui attend une décision ou une action DE L'UTILISATEUR, tous modules confondus : validations, dossiers Regulatory, demandes administratives, " +
        "congés à trancher… À utiliser pour « qu'est-ce qui m'attend ? », « qu'est-ce que je dois valider ? », « qu'ai-je en retard ? ». " +
        "Chaque ligne porte son module, son statut et son lien interne — les citer pour que l'utilisateur puisse cliquer.",
      input_schema: {
        type: "object",
        properties: { limit: { type: "number", description: "Nombre maximum de lignes (défaut 25, max 60)." } },
      },
    },
    allowed: () => true,
    label: "File de décisions consultée",
    run: async (input, user) => {
      const rawLimit = typeof input.limit === "number" ? input.limit : 25;
      const limit = Math.max(1, Math.min(60, Math.round(rawLimit)));
      const [center, leaves] = await Promise.all([
        getActionCenter(user),
        getLeavesToDecide(user).catch(() => []),
      ]);
      const items = center.items.slice(0, limit).map((i) => ({
        titre: i.title, detail: i.subtitle, module: i.module, statut: i.statusLabel,
        echeance: i.deadline ? i.deadline.slice(0, 10) : null, lien: i.href,
      }));
      const conges = leaves.map((l) => ({
        titre: `Congé — ${l.employee}`, detail: `${l.days} j`, module: "Ressources humaines",
        statut: l.stage === "MANAGER" ? "À valider (vous, N+1)" : l.stage === "HR" ? "À valider (RH)" : "À valider (Direction)",
        echeance: l.startDate.slice(0, 10), lien: "/mon-espace",
      }));
      if (items.length === 0 && conges.length === 0) return "Rien n'attend votre décision pour l'instant.";
      return JSON.stringify({ total: items.length + conges.length, elements: [...conges, ...items] });
    },
  },
  // LES OUTILS EXÉCUTIFS — « My Chief of Staff » (PDG + Super Admin) : fouille et lecture du
  // Drive, histoire complète d'un dossier, bilan d'une personne, rappels planifiés. Ils vivent
  // dans leur module (executive-tools.ts) et passent par la MÊME porte que les autres :
  // `allowed` revérifié à chaque appel par executePowerTool.
  ...EXECUTIVE_TOOLS,
  // Les LECTURES TRANSVERSES (recherche fédérée, calendrier, stocks, hôpitaux, paie, courriers,
  // agrégats financiers) — chacune ouverte par le DROIT de l'écran correspondant.
  ...EXECUTIVE_READ_TOOLS,
  // Le PILOTAGE PROACTIF : signaux d'alerte, point exécutif, rapport consolidé (.docx → Drive).
  ...EXECUTIVE_BRIEF_TOOLS,
  // MÉMOIRE, DÉCISIONS, ENGAGEMENTS : les registres PERSONNELS (mémoire typée, archives de
  // conversation ouvertes à tous car strictement cloisonnées par user.id ; registres de
  // décisions et d'engagements au siège exécutif). Écriture directe : rien ici ne touche
  // le monde extérieur — c'est la frontière avec ACTION_POLICY.
  ...MEMORY_TOOLS,
];

/** Les outils réellement ouverts à CETTE personne — évalués à chaque conversation. */
export function powerToolsFor(user: CurrentUser): ClaudeToolDef[] {
  return POWER_TOOLS.filter((t) => t.allowed(user)).map((t) => t.def);
}

/** Libellés de trace des outils ouverts (pour l'UI « ce que l'assistant a consulté »). */
export function powerToolLabels(): Record<string, string> {
  return Object.fromEntries(POWER_TOOLS.map((t) => [t.def.name, t.label]));
}

/**
 * Exécute un outil de pouvoir. Renvoie `null` si le nom n'en est pas un (l'appelant continue
 * son propre aiguillage). La permission est **revérifiée ici** : la liste envoyée au modèle
 * n'est pas une garantie, c'est une suggestion — seul ce contrôle fait foi.
 */
export async function executePowerTool(
  name: string,
  input: Record<string, unknown>,
  user: CurrentUser,
): Promise<string | null> {
  const tool = POWER_TOOLS.find((t) => t.def.name === name);
  if (!tool) return null;
  if (!tool.allowed(user)) return "Ce module ne vous est pas ouvert : je ne peux pas consulter cette information.";
  try {
    return await tool.run(input, user);
  } catch (err) {
    console.error(`[assistant] power tool ${name} failed`, err);
    return "La lecture a échoué (donnée indisponible). Je préfère ne rien avancer plutôt que d'inventer un chiffre.";
  }
}

/**
 * Ce que l'assistant peut consulter, en une phrase, pour le prompt système. Sans cela le
 * modèle ignore qu'il DISPOSE de ces outils et continue de renvoyer l'utilisateur vers les
 * pages — le défaut exact qu'on corrige.
 */
export function powerToolsBriefing(user: CurrentUser): string {
  const open = POWER_TOOLS.filter((t) => t.allowed(user));
  if (open.length === 0) return "";
  const lines = open.map((t) => `- \`${t.def.name}\` — ${t.label.toLowerCase()}`).join("\n");
  const global = hasGlobalView(user)
    ? "\nVous servez un compte à VUE GLOBALE : ces lectures portent sur toute l'entité en cours, pas seulement sur son périmètre personnel."
    : "";
  return `\n\nLECTURES CHIFFRÉES À VOTRE DISPOSITION (ouvertes par les droits de cette personne — les utiliser au lieu de renvoyer vers un module) :\n${lines}${global}\nNe JAMAIS avancer un montant sans avoir appelé l'outil correspondant.`;
}
