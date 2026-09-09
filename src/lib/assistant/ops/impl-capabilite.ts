import type { OpImpl, OpProposalDraft } from "./types";
import {
  CONTRAT_PAR_ID, CONTRATS_ACTIONS, direContrat, chercherCapacites,
  interdictionGenerique, validerEntree, executerAction, relireApresEcriture,
  resoudreEntrees, champsDesignables, type ContratAction,
} from "@/platform/in-process/capacites";
import { OPS_CATALOG } from "./catalog";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CHEMIN GÉNÉRIQUE, BRANCHÉ — l'appelant de production que §118.14 exige.
 *
 * `contrat.ts` décrit 598 actions, `generique.ts` décide lesquelles sont ouvertes, `executer.ts`
 * les appelle. Tant que rien ne les DÉCLENCHE depuis une vraie conversation, les trois sont du
 * code mort : « si quelqu'un utilise Adam normalement maintenant, ce composant peut-il être
 * déclenché et produire un effet utile ? » Ce fichier est la réponse.
 *
 * ── UNE SEULE OP, ET LE REFUS FAIT LA DÉCOUVERTE ─────────────────────────────────────────
 *
 * Le plan prévoyait trois outils — chercher, décrire, exécuter. Ils coûteraient deux
 * aller-retours de modèle avant le moindre effet. Ici, `run` accepte AUSSI une intention en
 * français : quand elle ne désigne pas une action unique, le refus LISTE les candidates avec
 * leurs champs. C'est §118.30 poussé à sa conclusion — un refus qui nomme le remède remplace
 * l'outil qu'on aurait écrit pour l'éviter.
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Il ne DEVINE pas l'action : plusieurs correspondances n'en désignent AUCUNE (§118.34) — la
 * collapser exécuterait un geste à la place d'un humain. Il n'invente aucun champ, ne
 * contourne aucune porte (l'action revérifie tout), et refuse par CONSTRUCTION les gestes
 * d'auto-escalade, Super Admin compris.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MAX_CANDIDATES = 6;

/**
 * QUELLE OP DÉCLARÉE COUVRE CETTE ACTION ? — ce qui transforme une limite en ROUTE.
 *
 * Le chemin générique ne sait désigner par leur nom que les objets dont une PORTÉE de lecture
 * est déclarée (29 sur 310 modèles) : il ne trouvera jamais « le dossier Campagne » du Drive,
 * dont l'accès se calcule nœud par nœud et ne s'écrit pas en clause Prisma. Les ops de domaine,
 * elles, le font depuis toujours — `resolveDriveNode` interroge `resolveDriveAccess` pour chaque
 * nœud. Le refus les NOMME au lieu de s'arrêter à « donnez l'identifiant » : un refus qui nomme
 * la faute sans nommer le remède fait payer un aller-retour, et tue parfois la mission (§118.30).
 *
 * Et c'est la réponse mesurée à « le chemin générique remplace-t-il les 503 propose écrits à la
 * main ? » — non : il les COMPLÈTE, et chacun est le bon chemin là où il existe.
 */
const OPS_PAR_ACTION: ReadonlyMap<string, { tool: string; op: string; uiLabel: string }[]> = (() => {
  const m = new Map<string, { tool: string; op: string; uiLabel: string }[]>();
  for (const meta of OPS_CATALOG) {
    for (const cle of meta.covers) {
      m.set(cle, [...(m.get(cle) ?? []), { tool: meta.tool, op: meta.op, uiLabel: meta.uiLabel }]);
    }
  }
  return m;
})();

export const direOpsCouvrantes = (id: string): string => {
  const ops = OPS_PAR_ACTION.get(id) ?? [];
  if (ops.length === 0) return "";
  return ` L'op ${ops.map((o) => `\`${o.tool}/${o.op}\` (« ${o.uiLabel} »)`).join(" ou ")} `
    + `résout ce nom pour vous.`;
};

/** Ce que le modèle a écrit dans `champs` — du JSON, ou rien. */
function lireChamps(brut: string): { ok: true; champs: Record<string, unknown> } | { ok: false; erreur: string } {
  const t = brut.trim();
  if (!t) return { ok: true, champs: {} };
  try {
    const v = JSON.parse(t) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, erreur: "« champs » doit être un objet JSON, par exemple {\"name\":\"Oncologie 2027\"}." };
    }
    return { ok: true, champs: v as Record<string, unknown> };
  } catch {
    return { ok: false, erreur: `« champs » n'est pas du JSON valide : ${t.slice(0, 120)}` };
  }
}

/**
 * LA FICHE D'UNE ACTION, telle qu'un modèle et un humain la lisent tous les deux — et qui DIT
 * quels champs acceptent un nom. Sans cette phrase, « reference » se lit « donne-moi un
 * identifiant », et le modèle en invente un ou renonce (§118.19).
 */
const fiche = (c: ContratAction): string => {
  const interdit = interdictionGenerique(c);
  if (interdit) return `${c.id} — REFUSÉE : ${interdit}`;
  const nommables = champsDesignables(c);
  const suffixe = nommables.length
    ? ` — vous pouvez écrire un NOM ou une référence pour ${nommables.map((n) => `${n.champ} (${n.objet})`).join(", ")}`
    : "";
  return `${direContrat(c)}${suffixe}`;
};

/**
 * DE CE QUE LE MODÈLE A ÉCRIT À UNE ACTION UNIQUE.
 *
 * Un identifiant exact tranche. Sinon on cherche, et l'on ne rend une action QUE si la
 * recherche en désigne une seule — sans quoi le refus montre les candidates.
 */
function designer(texte: string): { contrat: ContratAction } | { refus: string } {
  const q = texte.trim();
  if (!q) return { refus: "Précisez l'action : son identifiant « fichier:fonction », ou ce que vous voulez faire." };

  const exact = CONTRAT_PAR_ID.get(q);
  if (exact) return { contrat: exact };

  const trouves = chercherCapacites(CONTRATS_ACTIONS, q, MAX_CANDIDATES);
  if (trouves.length === 0) {
    return {
      refus: `Aucune action de l'ERP ne correspond à « ${q} ». Reformulez avec le geste et son objet `
        + `(« créer une demande administrative », « changer le statut d'un dossier »).`,
    };
  }
  if (trouves.length === 1) return { contrat: trouves[0]!.contrat };

  // PLUSIEURS N'EN DÉSIGNENT AUCUNE (§118.34). Le refus porte les fiches : le tour suivant
  // choisit ET connaît déjà les champs, donc il n'y a pas d'aller-retour supplémentaire.
  return {
    refus: `« ${q} » correspond à ${trouves.length} actions — précisez laquelle par son identifiant :\n`
      + trouves.map((t) => `  • ${fiche(t.contrat)}`).join("\n"),
  };
}

export const CAPABILITY_OPS_IMPL: Record<string, OpImpl> = {
  run: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const brut = typeof input.action === "string" ? input.action : "";
      const vise = designer(brut);
      if ("refus" in vise) return { error: vise.refus };
      const contrat = vise.contrat;

      // L'AUTO-ESCALADE d'abord : constater qu'une entrée est mal formée sur `updateUserRole`
      // reviendrait à dire « corrige ta saisie et réessaie » (§118.6).
      const interdit = interdictionGenerique(contrat);
      if (interdit) return { error: interdit };

      const lus = lireChamps(typeof input.champs === "string" ? input.champs : "");
      if (!lus.ok) return { error: lus.erreur };

      const refus = validerEntree(contrat, lus.champs);
      if (refus.length > 0) {
        return { error: `${refus.map((r) => r.raison).join(" ")}\nCette action attend : ${fiche(contrat)}` };
      }

      // « NIVOLEX » LÀ OÙ L'ACTION ATTEND UN `cuid` — la désignation se fait ICI, dans la
      // proposition, et son résultat part dans les `args`. Résoudre à nouveau à l'exécution
      // pourrait désigner une AUTRE ligne entre la carte et le clic : ce qu'on confirme doit
      // être ce qui sera fait (§104.7).
      const cibles = await resoudreEntrees(user, contrat, lus.champs);
      if (cibles.refus.length > 0) {
        return { error: `${cibles.refus.join("\n")}${direOpsCouvrantes(contrat.id)}` };
      }

      const valeurs = Object.entries(cibles.entree).filter(([, v]) => v !== undefined && v !== null && v !== "");
      const parChamp = new Map(cibles.substitutions.map((sub) => [sub.champ, sub]));
      const montrer = (cle: string, v: unknown): string => {
        const sub = parChamp.get(cle);
        // CE QU'ON MONTRE EST LA LIGNE, PAS L'IDENTIFIANT : une carte qui affiche
        // `cmt9k…` demande de confirmer ce qu'on ne peut pas lire (§104.16).
        if (sub) {
          const suffixe = sub.cible.sousTitre ? ` — ${sub.cible.sousTitre}` : "";
          return `« ${sub.texte} » → ${sub.objet} : ${sub.cible.titre}${suffixe}`;
        }
        return Array.isArray(v) ? v.join(", ") : String(v);
      };
      return {
        title: `${contrat.fonction} — ${contrat.porte.moduleFr ?? contrat.fichier.replace(/-actions$/, "")}`,
        fields: [
          { label: "Action", value: contrat.id },
          ...valeurs.map(([k, v]) => ({ label: k, value: montrer(k, v) })),
        ],
        warnings: [
          // La carte DIT ce qui va être touché : c'est ce qu'on confirme, pas une trace qu'on
          // déplie après coup (§118.55).
          contrat.modelesEcrits.length > 0
            ? `Écrit : ${contrat.modelesEcrits.join(", ")}.`
            : "Aucune écriture en base détectée dans cette action.",
          // CE QU'ON N'A PAS SU DÉSIGNER SE DIT, avec le geste qui le lève : le silence d'une
          // fiche se lit comme une permission de deviner (§118.26, §118.30).
          ...cibles.nonResolus.map((n) =>
            `« ${n.champ} » a été transmis tel quel : ${n.raison}.${direOpsCouvrantes(contrat.id)}`),
          "Vos droits sont revérifiés par l'action elle-même, exactement comme au clic sur le bouton.",
        ],
        args: { action: contrat.id, champs: JSON.stringify(cibles.entree) },
        successMessage: `${contrat.fonction} exécutée.`,
      };
    },

    /**
     * APRÈS L'ÉCRITURE, ON RELIT — et si l'on ne peut pas, on le DIT.
     *
     * La première version rendait `« setRegulatoryPriority exécutée. »`. La personne n'avait
     * qu'une parole : rien ne lui permettait de constater ce qui avait changé. C'est ce que
     * §104.16 interdit — et le retour de l'action, qui porte l'identifiant écrit, était jeté.
     *
     * Trois phrases possibles, et JAMAIS « fait » tout court : ce qui a été constaté, ce qui
     * a été fait sans pouvoir être constaté, ou l'échec. La distinction compte plus que la
     * relecture elle-même : une action qui rend `ok` sans qu'on puisse rien relire reste un
     * succès ANNONCÉ, et l'annoncer comme vérifié serait le faux succès qu'on vient de fermer
     * ailleurs (§118.25).
     */
    async execute(args, user) {
      const id = args.action ?? "";
      const lus = lireChamps(args.champs ?? "");
      if (!lus.ok) return { ok: false, error: lus.erreur };
      const r = await executerAction(user, id, lus.champs);
      if (!r.ok) return { ok: false, error: r.message };

      // Sur une action qui n'écrit rien, il n'y a rien à relire et ce n'est pas une lacune.
      if (!r.contrat.ecrit) return { ok: true, message: `${r.contrat.fonction} exécutée.` };

      const vu = await relireApresEcriture(user, r.contrat.modelesEcrits, lus.champs, r.retour)
        .catch(() => null);
      if (!vu) {
        return {
          ok: true,
          message: `${r.contrat.fonction} exécutée. Je n'ai PAS pu relire la ligne pour vous la `
            + `montrer — l'écriture a bien eu lieu, mais je ne la constate pas d'ici.`,
        };
      }
      const apercu = vu.champs.slice(0, 12).map((c) => `${c.nom} : ${c.valeur}`).join(" · ");
      return {
        ok: true,
        message: `${r.contrat.fonction} exécutée, et relu dans votre périmètre — `
          + `${vu.libelle} ${vu.id} → ${apercu}`,
      };
    },
  },
};
