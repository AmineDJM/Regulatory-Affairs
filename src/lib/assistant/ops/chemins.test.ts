// L'ordre compte : `@/lib/assistant` casse le cycle d'initialisation ops → impl → actions.
import "@/lib/assistant";
import { describe, expect, it } from "vitest";
import { OPS_CATALOG } from "./catalog";
import { direOpsCouvrantes } from "./impl-capabilite";
import { CONTRAT_PAR_ID } from "@/lib/actions/contrat.genere";
import { interdictionGenerique } from "@/lib/actions/generique";
import { champsDesignables } from "@/lib/cibles/resoudre-entrees";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DEUX CHEMINS, UN SEUL GESTE — et la mesure qui a répondu « non » à une question que je m'étais
 * mal posée.
 *
 * ── LA QUESTION, ET LA RÉPONSE MESURÉE ───────────────────────────────────────────────────
 *
 * « La carte générique remplace-t-elle les 504 `propose()` écrits à la main ? » Le compte rendu
 * qui a lancé ce lot l'annonçait comme un acquis à venir. C'est FAUX, et le parc le dit :
 *
 *     520 ops déclarées (hors la générique)
 *      48  que le chemin générique n'atteint pas du tout (aucune action couverte, action
 *          illisible, ou action refusée par conception)
 *     366  qu'il atteint mais dont AU MOINS UNE référence lui est indésignable — il faudrait
 *          dicter un `cuid`
 *     106  qu'il atteint ET dont toutes les références sont désignables
 *     472  des atteignables portent des alias en FRANÇAIS, que la découverte générique — qui
 *          cherche dans les identifiants d'actions — ne reproduit pas
 *
 * La cause est structurelle et se mesure aussi : 29 modèles sur 310 ont une portée de lecture
 * déclarée. Déclarer les HUIT plus bloquants n'en débloquerait que 62 sur 366 — la queue est
 * longue, et chaque entrée est une DÉCISION DE PERMISSION, pas une ligne de tuyauterie. C'est
 * précisément le coût des « 715 fiches » que §118.73 refuse.
 *
 * Supprimer les 503 aurait donc échangé une capacité contre une régression : 366 gestes
 * repassant par un identifiant que personne ne connaît par cœur. La conclusion est écrite ICI,
 * sous forme de mesure qui tourne, et non dans un compte rendu que personne ne relira.
 *
 * ── CE QUE CE FICHIER TIENT ──────────────────────────────────────────────────────────────
 *
 * 1. Les deux chemins appellent la MÊME action canonique — jamais deux vérités (§118.5).
 * 2. Quand le générique ne sait pas désigner, son refus NOMME l'op qui sait (§118.30) — sur
 *    TOUT le parc, pas sur l'exemple que j'ai regardé.
 * 3. Un PLANCHER sur ce que le générique sait désigner : il ne peut que monter.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ops = OPS_CATALOG.filter((m) => m.op !== "run");

/** Le générique peut-il appeler TOUTES les actions que cette op couvre ? */
function atteignable(m: (typeof ops)[number]) {
  if (m.covers.length === 0) return null;
  const contrats = m.covers.map((k) => CONTRAT_PAR_ID.get(k));
  if (contrats.some((c) => !c || c.illisible || interdictionGenerique(c))) return null;
  return contrats.map((c) => c!);
}

/** Les références que le générique ne saurait PAS désigner pour cette op. */
function indesignables(m: (typeof ops)[number]) {
  const contrats = atteignable(m);
  if (!contrats) return null;
  const ok = new Set(contrats.flatMap((c) => champsDesignables(c).map((x) => x.champ)));
  return contrats.flatMap((c) => c.champs.filter((ch) => ch.type === "reference" && !ok.has(ch.nom)).map((ch) => ch.nom));
}

describe("Chemin générique et ops déclarées — deux routes, un seul geste", () => {
  it("le partage des 520 ops est MESURÉ, et ce que le générique désigne ne recule pas", () => {
    let horsAtteinte = 0, avecTrou = 0, complet = 0, avecAlias = 0;
    for (const m of ops) {
      const trous = indesignables(m);
      if (trous === null) { horsAtteinte++; continue; }
      if (m.aliases.length > 0) avecAlias++;
      if (trous.length > 0) avecTrou++; else complet++;
    }
    // PLANCHER, jamais plafond : une entité ajoutée au registre le fait monter. Une chute veut
    // dire qu'une désignation a été perdue — c'est ce que §118.49 apprend à surveiller.
    expect(complet, "ops dont TOUTES les références sont désignables").toBeGreaterThanOrEqual(100);
    expect(horsAtteinte + avecTrou + complet).toBe(ops.length);
    console.info(
      `[DEUX_CHEMINS] ${ops.length} ops : ${horsAtteinte} hors d'atteinte, ${avecTrou} avec une `
      + `référence indésignable, ${complet} entièrement désignables — ${avecAlias} portent des alias FR`,
    );
  });

  it("là où le générique ne sait pas désigner, son refus NOMME l'op qui sait", () => {
    // §118.30 sur tout le parc : un refus qui nomme la faute sans nommer le remède fait payer un
    // aller-retour. CE QUI FERAIT TOMBER : une op dont les `covers` ne remontent pas jusqu'au
    // message — c'est-à-dire un « donnez l'identifiant » sans issue.
    const muets: string[] = [];
    for (const m of ops) {
      const trous = indesignables(m);
      if (!trous || trous.length === 0) continue;
      for (const cle of m.covers) {
        if (!direOpsCouvrantes(cle).includes(`${m.tool}/${m.op}`)) muets.push(`${cle} → ${m.tool}/${m.op}`);
      }
    }
    expect(muets, "un refus sans remède").toEqual([]);
  });

  it("les deux chemins visent la MÊME action — l'op ne double jamais l'écriture", () => {
    // Une op qui couvrirait une clé absente du parc réel décrirait un geste que plus personne
    // ne peut faire : c'est le catalogue qui mentirait, et le refus enverrait dans le vide.
    const fantomes = ops.flatMap((m) => m.covers.filter((k) => !CONTRAT_PAR_ID.get(k)).map((k) => `${m.tool}/${m.op} → ${k}`));
    expect(fantomes, "une op couvre une action qui n'existe plus").toEqual([]);
  });
});
