import type { CurrentUser } from "@/lib/session";
import type { MissionActor, RegistreRecours } from "@/lib/missions/ports";
import { EFFECT_RANK, capabilityMeta, type Effect } from "@/lib/missions/registry/capability-meta";
import { champRequete } from "@/lib/missions/recovery/action";
import { catalogueDe } from "@/platform/in-process/missions/catalog";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « ESSAIE DANS LEGAL » — la traduction en un appel qui existe vraiment.
 *
 * ── LE DÉFAUT QUE CE FICHIER FERME ───────────────────────────────────────────────────────
 *
 * L'échelle de recours proposait un GRENIER. Le moteur l'appliquait en écrivant
 * `source: "LEGAL"` dans l'entrée de l'étape et en rejouant la MÊME capacité. Une recherche
 * exhaustive du dépôt a montré qu'aucune capacité ne lit ce champ : l'étape repartait avec un
 * appel identique et rendait le même résultat. Six greniers, six lignes au journal, zéro effet.
 *
 * Chercher ailleurs, ce n'est pas rejouer `search_drive` avec une étiquette : c'est appeler
 * `search_courriers`. Ce fichier fait cette traduction, et rien d'autre.
 *
 * ── POURQUOI LE CATALOGUE VIVANT, ET NON UNE TABLE ───────────────────────────────────────
 *
 * Une table « grenier → outil » vieillirait en silence : une capacité ajoutée un mardi resterait
 * invisible au recours jusqu'à ce que quelqu'un pense à l'y inscrire. On ne code donc en dur que
 * la traduction irréductible — le vocabulaire des greniers vers celui des DOMAINES du catalogue,
 * neuf lignes de français — et le choix de la capacité se fait sur le catalogue RÉEL de la
 * personne, à chaque appel.
 *
 * ── LES DEUX GARDES DE SÛRETÉ ────────────────────────────────────────────────────────────
 *
 * Une mission n'est pas une porte dérobée, y compris quand elle se rattrape :
 *
 *   1. la capacité de remplacement doit être OUVERTE à l'acteur — c'est `catalogue.allowed`,
 *      le même contrôle que partout ailleurs ;
 *   2. son effet ne peut pas DÉPASSER celui de l'étape d'origine. Une lecture qui échoue ne se
 *      rattrape jamais par une écriture, et une mission plafonnée en lecture seule reste
 *      plafonnée pendant son recours.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES GRENIERS, TRADUITS EN DOMAINES DU CATALOGUE.
 *
 * C'est la seule partie écrite à la main, et elle est irréductible : `Source` est le vocabulaire
 * de la recherche humaine (« regarde dans les courriers »), `domain` celui du catalogue d'outils.
 * Plusieurs domaines par grenier quand c'est la réalité — le Drive porte les fichiers ET le
 * corpus de connaissance.
 */
const DOMAINES: Record<string, readonly string[]> = {
  DRIVE: ["drive"],
  LEGAL: ["legal"],
  COURRIERS: ["legal"],
  REGULATORY: ["regulatory"],
  HR: ["hr", "directory"],
  FINANCE: ["finance"],
  ADPRO: ["tasks"],
  GMAIL_ATTACHMENTS: ["mail"],
  // Le journal des événements n'a pas de domaine propre : c'est la recherche fédérée de la
  // plateforme qui le traverse, et `inspect_record` qui reconstitue une histoire.
  BUSINESS_EVENTS: ["platform"],
};

/**
 * CE QUI FAIT QU'UNE CAPACITÉ EST UNE RECHERCHE.
 *
 * On préfère ce qui CHERCHE à ce qui LIT : `search_courriers` accepte une requête, `read_email`
 * exige un identifiant qu'on n'a pas. L'ordre est un tri, pas un filtre — si rien ne commence
 * par `search_`, une lecture large fera l'affaire.
 */
const rangDeNom = (id: string): number => {
  if (id.startsWith("search_")) return 0;
  if (id.startsWith("list_")) return 1;
  if (id.startsWith("read_")) return 2;
  return 3;
};

export function registreRecoursDe(user: CurrentUser, opts: { effetMax?: Effect } = {}): RegistreRecours {
  const catalogue = catalogueDe(user, opts.effetMax ? { effetMax: opts.effetMax } : {});

  return {
    autreSource({ source, capaciteActuelle, entree, acteur, effetMax }) {
      const domaines = DOMAINES[source];
      if (!domaines) return null;

      const plafond = EFFECT_RANK[effetMax];
      const candidates = catalogue
        .brief(acteur as MissionActor)
        .filter((b) => domaines.includes(b.domain))
        .filter((b) => b.id !== capaciteActuelle)
        // GARDE 2 : jamais au-dessus de l'effet de l'étape d'origine.
        .filter((b) => EFFECT_RANK[capabilityMeta(b.id).effect] <= plafond)
        // GARDE 1 : le droit, relu au moment d'agir et pas seulement à la compilation.
        .filter((b) => catalogue.allowed(b.id, acteur as MissionActor))
        .sort((a, b) => rangDeNom(a.id) - rangDeNom(b.id) || a.id.localeCompare(b.id));

      const retenue = candidates[0];
      if (!retenue) return null;

      /**
       * L'ENTRÉE DE LA NOUVELLE CAPACITÉ.
       *
       * On reporte le TEXTE de la recherche, pas la structure : les schémas diffèrent d'un
       * outil à l'autre (`query`, `question`, `name`, `reference`) et recopier l'entrée telle
       * quelle enverrait des champs que la nouvelle capacité ignore — ou pire, mal interprète.
       *
       * Sans texte à reporter, il n'y a rien à demander à l'autre grenier : on rend `null`
       * plutôt que d'appeler une recherche à vide, ce qui serait un faux recours de plus.
       */
      const champ = champRequete(entree);
      if (!champ) return null;
      const texte = String(entree[champ]).trim();
      if (texte === "") return null;

      return {
        capability: retenue.id,
        input: { [cibleChamp(retenue.id)]: texte },
        ceQuiChange: `${capaciteActuelle ?? "l'étape"} → ${retenue.id} (${retenue.domain})`,
      };
    },
  };
}

/**
 * LE CHAMP QUI PORTE LA REQUÊTE DANS LA CAPACITÉ VISÉE.
 *
 * Les schémas réels du dépôt utilisent quatre noms, et on les connaît : `question` pour la
 * recherche par CONTENU, `name` pour l'annuaire, `reference` pour un dossier, `query` partout
 * ailleurs. Une capacité qui n'accepterait aucun des quatre refusera l'entrée — franchement, à
 * l'appel, avec un message — plutôt que de chercher à côté en silence.
 */
function cibleChamp(id: string): string {
  if (id === "search_documents") return "question";
  if (id === "directory_lookup") return "name";
  if (id === "inspect_record") return "reference";
  return "query";
}
