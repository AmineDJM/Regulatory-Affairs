// L'AIGUILLAGE D'ABORD : `ops/index` → `impl-wave7d` → `adventum-actions` → `assistant.ts` →
// `ops/index`. Sans cette ligne, le registre d'outils n'est pas encore peuplé quand ce module
// se charge, et `DOMAIN_TOOL_DEFS` n'est pas itérable. Cycle CONNU, remède documenté.
import "@/lib/assistant";
import { describe, expect, it } from "vitest";
import { CAPABILITY_OPS_IMPL } from "./impl-capabilite";
import {
  CONTRATS_ACTIONS, direContrat, interdictionGenerique,
  type ChampAction, type ContratAction,
} from "@/platform/in-process/capacites";
import type { CurrentUser } from "@/lib/session";

const run = CAPABILITY_OPS_IMPL.run!;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARC ENTIER PASSE PAR LA CARTE — pas quatre actions choisies.
 *
 * Le chemin générique était éprouvé sur QUATRE actions (`createRequest`, `updateRequestStatus`,
 * `markNotificationRead`, `setAdamOutboundPaused`) et ouvert sur 572. C'est le défaut nommé au
 * §118.21 : une chaîne qui marche ne prouve rien, c'est la SECONDE qui prouve le moteur — et à
 * plus forte raison les cinq cent soixante-douze suivantes. Chaque action décrite est une
 * promesse faite à un modèle ; celles qu'aucun banc n'a jamais fait passer sont des promesses
 * que personne n'a vérifiées.
 *
 * ── CE QUE CE BANC ÉPROUVE, ET CE QU'IL N'ÉCRIT PAS ──────────────────────────────────────
 *
 * Il s'arrête à `propose` : la carte se construit, RIEN n'est écrit. Exécuter 572 actions
 * toucherait des centaines de lignes et transformerait un banc de couverture en migration.
 * Ce que la proposition traverse est déjà l'essentiel du chemin — désignation, garde
 * d'auto-escalade, lecture du JSON, validation de l'entrée contre le contrat, construction de
 * la carte. C'est aussi là que vit la propriété qu'on veut : **ce que le contrat DÉCLARE
 * suffisant doit être ACCEPTÉ par la validation**. Deux lectures du même contrat qui
 * divergeraient rendraient une action décrite mais inappelable — un « je ne peux pas » né
 * d'une incohérence interne, le pire genre parce qu'il n'a aucune cause visible (§118.63).
 *
 * L'entrée est FABRIQUÉE depuis le contrat lui-même, jamais devinée : une valeur admise quand
 * l'énum est lu, sinon la forme du type. Si le contrat ne suffit pas à fabriquer un appel, ce
 * n'est pas le banc qui est en tort — c'est le contrat qui promet trop.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une valeur PLAUSIBLE pour un champ, tirée du contrat — jamais d'un catalogue écrit à part. */
function valeurPour(ch: ChampAction): unknown {
  if (ch.valeurs && ch.valeurs.length > 0) return ch.valeurs[0];
  switch (ch.type) {
    case "nombre": return "1";
    case "date": return "2026-01-01";
    case "booleen": return "true";
    case "liste": return ["ckv0000000000000000000000"];
    // Une RÉFÉRENCE prend la forme d'un cuid : c'est ce que `ressembleAUnId` reconnaît, et la
    // ligne n'existera pas — la proposition n'interroge pas la base, elle décrit un geste.
    case "reference": return "ckv0000000000000000000000";
    default: return "valeur de banc";
  }
}

const entreePour = (c: ContratAction): Record<string, unknown> =>
  Object.fromEntries(c.champs.filter((ch) => ch.obligatoire).map((ch) => [ch.nom, valeurPour(ch)]));

const ACTEUR = {
  id: "banc", name: "Banc", email: "banc@t.dz", role: "SUPER_ADMIN",
  access: {}, mustChangePassword: false,
} as unknown as CurrentUser;

describe("PARC — toute action ouverte se propose, et ce qu'elle promet suffit", () => {
  const ouvertes = CONTRATS_ACTIONS.filter((c) => !c.illisible && !interdictionGenerique(c));

  it("le parc ouvert est bien celui qu'on croit", () => {
    // Un banc qui boucle sur une liste vide passe au vert sans rien éprouver (§118.17).
    expect(ouvertes.length, "moins de 500 actions ouvertes : le parc a changé, ce banc ne prouve plus ce qu'il dit")
      .toBeGreaterThan(500);
  });

  it("CHAQUE action ouverte accepte l'entrée que SON PROPRE contrat déclare suffisante", async () => {
    const refusees: string[] = [];
    for (const c of ouvertes) {
      const r = await run.propose({ action: c.id, champs: JSON.stringify(entreePour(c)) }, ACTEUR)
        .catch((e: unknown) => ({ error: `EXCEPTION ${e instanceof Error ? e.message : String(e)}` }));
      if (r && typeof r === "object" && "error" in r) {
        refusees.push(`${c.id}\n      contrat : ${direContrat(c)}\n      refus   : ${String(r.error).slice(0, 200)}`);
      }
    }
    expect(
      refusees.slice(0, 12),
      `${refusees.length} action(s) sur ${ouvertes.length} refusent l'entrée que leur propre contrat `
        + `déclare suffisante. Le contrat et la validation lisent la même chose : elles ne peuvent pas `
        + `diverger sans rendre une action décrite mais inappelable.`,
    ).toEqual([]);
  }, 120_000);

  it("CHAQUE carte porte de quoi confirmer — l'action visée, et ce qui sera écrit", async () => {
    const muettes: string[] = [];
    for (const c of ouvertes) {
      const r = await run.propose({ action: c.id, champs: JSON.stringify(entreePour(c)) }, ACTEUR);
      if (!r || "error" in r) continue;
      const action = r.fields.find((f) => f.label === "Action")?.value;
      const dit = (r.warnings ?? []).join(" ");
      // CE QU'ON CONFIRME DOIT DIRE CE QU'ON CONFIRME : sans l'identifiant visé, deux actions
      // voisines rendent la même carte ; sans la phrase d'écriture, on valide à l'aveugle.
      if (action !== c.id) muettes.push(`${c.id} : la carte vise « ${action} »`);
      else if (!/Écrit :|Aucune écriture/.test(dit)) muettes.push(`${c.id} : la carte ne dit pas ce qu'elle touche`);
      else if (!/revérifiés par l'action/.test(dit)) muettes.push(`${c.id} : la carte ne dit pas que les droits sont revérifiés`);
    }
    expect(muettes.slice(0, 12), `${muettes.length} carte(s) incomplètes`).toEqual([]);
  }, 120_000);

  it("AUCUNE action refusée par conception ne construit de carte — la garde est AVANT", async () => {
    const interdites = CONTRATS_ACTIONS.filter((c) => !c.illisible && interdictionGenerique(c));
    expect(interdites.length, "aucune action refusée : la garde ne s'arme plus").toBeGreaterThan(10);
    const passees: string[] = [];
    for (const c of interdites) {
      const r = await run.propose({ action: c.id, champs: JSON.stringify(entreePour(c)) }, ACTEUR);
      if (r && !("error" in r)) passees.push(c.id);
    }
    expect(passees, "une action interdite a construit une carte : le geste est offert avant d'être refusé").toEqual([]);
  }, 120_000);
});
