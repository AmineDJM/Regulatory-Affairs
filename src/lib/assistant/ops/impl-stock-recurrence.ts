import {
  RECURRENCES_STOCK, RECURRENCE_STOCK_DEFAUT, HEURE_DEFAUT,
  apercuRecurrence, decrireRecurrence, estRecurrenceStock, libelleRecurrence,
  chercherKamStock, chercherHopitalStock, chercherRecurrenceStock, lireRecurrenceStock,
  createStockRecurrence, updateStockRecurrence, setStockRecurrenceStatus, deleteStockRecurrence,
} from "@/platform/in-process/stocks";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, fieldsOf, resolveOne } from "./helpers";

/**
 * OPS DES RÉCURRENCES DE DEMANDE D'ÉTAT DE STOCK.
 *
 * ── CE QUE LA CARTE DOIT MONTRER, ET POURQUOI ────────────────────────────────────────────
 *
 * La PHRASE de ce que la récurrence va faire, avec les hôpitaux NOMMÉS — jamais « 3 hôpitaux ».
 * Ce qu'on confirme doit être ce qui sera fait (§118.85), et un compte ne permet pas de vérifier
 * qu'on a visé les bons établissements. Sur une récurrence, l'enjeu est plus grand que sur un
 * geste ponctuel : une erreur de cible se répète tous les mois jusqu'à ce que quelqu'un la voie.
 *
 * ── TOUT PASSE PAR LE PORT ───────────────────────────────────────────────────────────────
 *
 * Actions, décisions pures et recherches arrivent par `platform/in-process/stocks` : Adam ne
 * connaît ni le dossier `actions/` de l'ERP ni le nom de ses tables (§118.114, §118.117). Ce qui
 * reste ici est la politique de résolution — exact → unique → ambiguïté LISTÉE.
 */

const resolveKam = (raw: string) =>
  resolveOne(raw, "la personne à qui demander (champ « assigneeName » — son nom)", chercherKamStock, (c) => c.label);

const resolveRecurrence = (raw: string) =>
  resolveOne(raw, "la récurrence (champ « recurrenceName » — son nom)", chercherRecurrenceStock, (c) => c.label);

/** La cadence lue dans la phrase, avec son défaut MENSUEL et un refus qui nomme les mailles. */
function cadenceVisee(input: Record<string, unknown>): { recurrence: string; hourLocal: number; dayOfWeek: number | null; dayOfMonth: number | null } | { error: string } {
  const brut = (opStr(input, "cadence") || RECURRENCE_STOCK_DEFAUT).toUpperCase();
  if (!estRecurrenceStock(brut)) {
    return {
      error: `Maille « ${brut} » inconnue. Les mailles admises sont : ${RECURRENCES_STOCK.map(libelleRecurrence).join(", ")}. `
        + "La plus fine est QUOTIDIENNE — un relevé de stock est un comptage physique, et le demander "
        + "toutes les heures produirait vingt-quatre tâches par jour que personne ne ferait.",
    };
  }
  const h = Number(opStr(input, "hourLocal"));
  const j = Number(opStr(input, "day"));
  return {
    recurrence: brut,
    hourLocal: Number.isInteger(h) && h >= 0 && h <= 23 ? h : HEURE_DEFAUT,
    dayOfWeek: brut === "WEEKLY" ? (Number.isInteger(j) && j >= 0 && j <= 6 ? j : 0) : null,
    dayOfMonth: brut === "MONTHLY" ? (Number.isInteger(j) && j >= 1 && j <= 31 ? j : 1) : null,
  };
}

/** Les hôpitaux visés — résolus par leurs NOMS, l'ambiguïté LISTÉE, jamais un `cuid` dicté. */
async function hopitauxVises(raw: string): Promise<{ ids: string[]; noms: string[] } | { error: string }> {
  const libelles = raw.split(",").map((x) => x.trim()).filter(Boolean);
  if (libelles.length === 0) return { ids: [], noms: [] };
  const ids: string[] = [];
  const noms: string[] = [];
  for (const l of libelles) {
    const hit = await resolveOne(l, `l'hôpital « ${l} »`, chercherHopitalStock, (c) => c.label);
    if ("error" in hit) return hit;
    ids.push(hit.id);
    noms.push(hit.label);
  }
  return { ids, noms };
}

export const STOCK_RECURRENCE_OPS_IMPL: Record<string, OpImpl> = {
  create_stock_recurrence: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const kam = await resolveKam(opStr(input, "assigneeName"));
      if ("error" in kam) return kam;
      const cadence = cadenceVisee(input);
      if ("error" in cadence) return cadence;
      const hop = await hopitauxVises(opStr(input, "hospitals"));
      if ("error" in hop) return hop;
      const nom = opStr(input, "recurrenceName") || `Relevé ${libelleRecurrence(cadence.recurrence as never).toLowerCase()} — ${kam.label}`;

      return {
        title: `Demande d'état de stock récurrente — ${kam.label}`,
        fields: fieldsOf([
          ["Nom", nom],
          ["Cadence", decrireRecurrence(cadence as never)],
          ["Demandé à", kam.label],
          // LES HÔPITAUX SONT NOMMÉS. Un compte ne permet pas de vérifier qu'on a visé les bons,
          // et sur une récurrence l'erreur se répète chaque mois.
          ["Hôpitaux", hop.noms.length > 0 ? hop.noms.join(", ") : "aucun ciblé — demande générale"],
          ["Précision", opStr(input, "note") || null],
        ]),
        warnings: [apercuRecurrence({ schedule: cadence as never, assigneeNom: kam.label, hopitaux: hop.noms })],
        args: {
          name: nom,
          assigneeId: kam.id,
          recurrence: cadence.recurrence,
          hourLocal: String(cadence.hourLocal),
          ...(cadence.dayOfWeek !== null ? { dayOfWeek: String(cadence.dayOfWeek) } : {}),
          ...(cadence.dayOfMonth !== null ? { dayOfMonth: String(cadence.dayOfMonth) } : {}),
          ...(hop.ids.length > 0 ? { hospitalIds: hop.ids.join(",") } : {}),
          note: opStr(input, "note"),
        },
        successMessage: `Récurrence « ${nom} » posée — ${decrireRecurrence(cadence as never)}.`,
        revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(createStockRecurrence, args, "La récurrence a été refusée.", {
      listes: ["hospitalIds"], revalidate: ["/stocks"],
    }),
  },

  update_stock_recurrence: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveRecurrence(opStr(input, "recurrenceName"));
      if ("error" in hit) return hit;
      const cur = await lireRecurrenceStock(hit.id);
      if (!cur) return { error: "Récurrence introuvable." };

      // FUSION : l'action réécrit tous les champs, donc l'existant est relu et REJOUÉ — sans
      // quoi « change la cadence » effacerait les hôpitaux et le destinataire.
      const kamRaw = opStr(input, "assigneeName");
      const kam = kamRaw ? await resolveKam(kamRaw) : null;
      if (kam && "error" in kam) return kam;
      const cadence = opStr(input, "cadence") ? cadenceVisee(input) : null;
      if (cadence && "error" in cadence) return cadence;
      const hopRaw = opStr(input, "hospitals");
      const hop = hopRaw ? await hopitauxVises(hopRaw) : null;
      if (hop && "error" in hop) return hop;

      const planning = cadence ?? {
        recurrence: cur.recurrence, hourLocal: cur.hourLocal,
        dayOfWeek: cur.dayOfWeek, dayOfMonth: cur.dayOfMonth,
      };
      const nomFinal = opStr(input, "newName") || cur.name;
      const noms = hop ? hop.noms : cur.hospitalNames;

      return {
        title: `Récurrence « ${cur.name} »`,
        fields: fieldsOf([
          ["Nom", nomFinal === cur.name ? cur.name : `${cur.name} → ${nomFinal}`],
          ["Cadence", estRecurrenceStock(planning.recurrence) ? decrireRecurrence(planning as never) : `illisible (« ${planning.recurrence} »)`],
          ["Demandé à", kam ? `${cur.assigneeName} → ${kam.label}` : cur.assigneeName],
          ["Hôpitaux", noms.length > 0 ? noms.join(", ") : "aucun ciblé"],
          ["Déjà envoyées", `${cur.runCount}`],
        ]),
        warnings: cadence
          ? ["La cadence change : la prochaine échéance est recalculée depuis maintenant."]
          : [],
        args: {
          id: cur.id,
          name: nomFinal,
          assigneeId: kam ? kam.id : cur.assigneeId,
          recurrence: planning.recurrence,
          hourLocal: String(planning.hourLocal),
          ...(planning.dayOfWeek !== null ? { dayOfWeek: String(planning.dayOfWeek) } : {}),
          ...(planning.dayOfMonth !== null ? { dayOfMonth: String(planning.dayOfMonth) } : {}),
          ...((hop ? hop.ids : cur.hospitalIds).length > 0
            ? { hospitalIds: (hop ? hop.ids : cur.hospitalIds).join(",") }
            : {}),
          note: opStr(input, "note") || (cur.note ?? ""),
        },
        successMessage: `Récurrence « ${nomFinal} » enregistrée.`,
        revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(updateStockRecurrence, args, "L'enregistrement a été refusé.", {
      listes: ["hospitalIds"], revalidate: ["/stocks"],
    }),
  },

  set_stock_recurrence_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveRecurrence(opStr(input, "recurrenceName"));
      if ("error" in hit) return hit;
      const cur = await lireRecurrenceStock(hit.id);
      if (!cur) return { error: "Récurrence introuvable." };
      // SANS CONSIGNE, ON BASCULE — c'est le geste qu'une phrase courte demande (« suspends la
      // récurrence »). Un mot explicite l'emporte.
      const dit = opStr(input, "status").toUpperCase();
      const cible = dit === "ACTIVE" || dit === "PAUSED" ? dit : (cur.status === "ACTIVE" ? "PAUSED" : "ACTIVE");
      return {
        title: `${cible === "PAUSED" ? "Suspendre" : "Reprendre"} « ${cur.name} »`,
        fields: fieldsOf([
          ["État", cur.status === "ACTIVE" ? "Active" : "En pause"],
          ["Cadence", cur.cadence],
          ["Demandé à", cur.assigneeName],
          ["Déjà envoyées", `${cur.runCount}`],
        ]),
        warnings: cible === "ACTIVE"
          ? ["La reprise repart de maintenant : les occurrences manquées ne sont pas rattrapées — un relevé de mars n'a plus d'objet en juin."]
          : ["L'historique et le compteur sont gardés : la reprise ne les efface pas."],
        args: { id: cur.id, status: cible },
        successMessage: `Récurrence « ${cur.name} » ${cible === "PAUSED" ? "mise en pause" : "reprise"}.`,
        revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(setStockRecurrenceStatus, args, "Le changement d'état a été refusé.", { revalidate: ["/stocks"] }),
  },

  delete_stock_recurrence: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveRecurrence(opStr(input, "recurrenceName"));
      if ("error" in hit) return hit;
      const cur = await lireRecurrenceStock(hit.id);
      if (!cur) return { error: "Récurrence introuvable." };
      return {
        title: `Retirer la récurrence « ${cur.name} »`,
        fields: fieldsOf([
          ["Cadence", cur.cadence],
          ["Demandé à", cur.assigneeName],
          ["Hôpitaux", cur.hospitalNames.length > 0 ? cur.hospitalNames.join(", ") : "aucun ciblé"],
          ["Demandes déjà envoyées", `${cur.runCount}`],
        ]),
        // LA CONSÉQUENCE, pas la ligne supprimée : ce qui est parti reste chez son destinataire.
        warnings: [
          `Les prochaines demandes s'arrêtent. Les ${cur.runCount} déjà envoyée(s) restent dans les `
          + `tâches de ${cur.assigneeName} — retirer la récurrence n'efface pas le passé.`,
        ],
        args: { id: cur.id },
        successMessage: `Récurrence « ${cur.name} » retirée.`,
        revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(deleteStockRecurrence, args, "Le retrait a été refusé.", { revalidate: ["/stocks"] }),
  },
};
