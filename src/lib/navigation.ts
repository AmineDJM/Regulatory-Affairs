import type { NavItem } from "@/lib/labels";

/**
 * LES PÔLES DE L'ENTREPRISE — la sidebar cesse de montrer l'architecture du logiciel.
 *
 * Treize entrées à plat sous « Pôles », c'était la carte du CODE : un module = une ligne. Une
 * direction ne lit pas son entreprise comme ça. Elle la lit en pôles : Regulatory,
 * Administration, Sales & Marketing, Business Development, Supply Chain.
 *
 * Ce module ne décide RIEN sur les droits : il reçoit les entrées **déjà filtrées** par le RBAC
 * (côté serveur, dans le layout) et se contente de les ranger. Une entrée interdite n'arrive
 * jamais jusqu'ici — donc la navigation ne peut pas devenir une seconde source de permissions.
 *
 * Module PUR — testé.
 */

export const NAV_POLES = [
  { key: "REGULATORY", label: "Regulatory", icon: "FileCheck2" },
  { key: "ADMINISTRATION", label: "Administration", icon: "Building2" },
  { key: "SALES_MARKETING", label: "Sales & Marketing", icon: "TrendingUp" },
  { key: "BUSINESS_DEV", label: "Business Development", icon: "Lightbulb" },
  { key: "SUPPLY_CHAIN", label: "Supply Chain & Logistics", icon: "Truck" },
] as const;

export type NavPoleKey = (typeof NAV_POLES)[number]["key"];

/**
 * Préférence LOCALE d'ouverture des pôles (par navigateur, donc par personne).
 *
 * La MÊME clé pour la barre latérale et pour le tiroir mobile : quelqu'un qui replie Regulatory
 * sur son ordinateur doit le retrouver replié sur son téléphone. Deux clés auraient donné deux
 * menus qui se contredisent sans que personne comprenne pourquoi.
 */
export const OPEN_POLES_KEY = "amd-open-poles";

/**
 * Au-delà de cinq sous-modules VISIBLES, un pôle déplié occupe tout l'écran et l'on ne voit
 * plus les autres. En deçà, un chevron à ouvrir n'est qu'un clic de plus pour rien.
 */
export const POLE_OPEN_THRESHOLD = 5;

export interface NavPoleGroup {
  key: NavPoleKey;
  label: string;
  icon: string;
  children: NavItem[];
  /**
   * Ouvert à l'arrivée ? Compté sur les sous-modules que CETTE personne voit — pas sur le
   * total : quelqu'un qui n'a accès qu'à deux écrans de Sales & Marketing n'a aucune raison
   * de trouver le pôle replié.
   */
  defaultOpen: boolean;
}

/**
 * Range les entrées accessibles sous leur pôle, dans l'ordre déclaré.
 *
 * Un pôle SANS enfant accessible n'existe pas : afficher un titre qui n'ouvre rien laisse croire
 * à un droit manquant alors qu'il n'y a simplement rien derrière.
 */
export function groupIntoPoles(items: NavItem[]): NavPoleGroup[] {
  return NAV_POLES.map((pole) => {
    const children = items.filter((i) => i.pole === pole.key);
    return {
      key: pole.key,
      label: pole.label,
      icon: pole.icon,
      children,
      defaultOpen: children.length > 0 && children.length <= POLE_OPEN_THRESHOLD,
    };
  }).filter((p) => p.children.length > 0);
}

/** Les groupes historiques encadrent les pôles : le personnel au-dessus, le système en bas. */
export const FLAT_GROUPS: NavItem["group"][] = ["Pilotage", "Transverse", "Système"];

/** Entrées d'un groupe historique (Pilotage / Transverse / Système) — inchangées. */
export function itemsOfGroup(items: NavItem[], group: NavItem["group"]): NavItem[] {
  return items.filter((i) => i.group === group && !i.pole);
}

/**
 * Le pôle qui contient un chemin — pour ouvrir automatiquement le bon tiroir à l'arrivée sur une
 * page. Sans cela, arriver sur `/pch` par un lien de notification laisserait le pôle replié et
 * l'utilisateur sans repère.
 */
export function poleOfPath(poles: NavPoleGroup[], path: string): NavPoleKey | null {
  let best = -1;
  let found: NavPoleKey | null = null;
  for (const p of poles) {
    for (const c of p.children) {
      // Les SOUS-MODULES comptent : arriver sur le pipeline doit ouvrir le pôle Business
      // Development, pas laisser le menu replié sur une page qu'on n'y retrouve pas.
      const kids = (c.children ?? []).flatMap((k) => [k.href, ...(k.match ?? [])]);
      for (const href of [c.href, ...(c.match ?? []), ...kids]) {
        if (href && (path === href || path.startsWith(`${href}/`)) && href.length > best) {
          best = href.length;
          found = p.key;
        }
      }
    }
  }
  return found;
}

/**
 * ALIAS DE RECHERCHE — les anciens noms ne doivent pas disparaître avec l'ancienne sidebar.
 *
 * Quelqu'un qui a appris à chercher « congrès international » pendant deux ans continuera de le
 * taper longtemps après que l'écran s'appelle autrement. Renommer sans garder le mot d'avant,
 * c'est rendre introuvable ce qui existe toujours.
 */
export const NAV_ALIASES: { terms: string[]; href: string; label: string }[] = [
  { terms: ["congrès international", "congres international", "congrès", "congres"], href: "/sponsoring", label: "Ad & Pro — Prise en charge internationale" },
  { terms: ["congrès national", "congres national"], href: "/sponsoring", label: "Ad & Pro — Prise en charge nationale" },
  { terms: ["sponsoring", "parrainage"], href: "/sponsoring", label: "Ad & Pro — Sponsoring" },
  { terms: ["événement", "evenement", "events"], href: "/sponsoring", label: "Ad & Pro — Événement" },
  { terms: ["matériel promotionnel", "materiel promotionnel", "promo"], href: "/promo-material", label: "Ad & Pro — Matériel promotionnel" },
  { terms: ["administration", "admin", "console"], href: "/admin", label: "Console d'Administration (système)" },
  // « Commandes & logistique » et « Market Intelligence » ont été RETIRÉS du service
  // (`modules-visibility.ts`) : leurs alias partent avec eux. Un raccourci qui mène à une page
  // interdite est pire qu'un raccourci absent — on tape, on est renvoyé, et l'on croit à une
  // panne de droits.
  { terms: ["pch", "appel d'offres", "appel d offres", "marché", "marche"], href: "/pch", label: "Business Development — Marchés PCH" },
  { terms: ["ctd", "enregistrement", "anpp"], href: "/regulatory/enregistrement", label: "Regulatory — Analyse CTD" },
  { terms: ["annuaire", "médecins", "medecins", "pharmaciens", "établissements", "etablissements"], href: "/medical/annuaire", label: "Annuaire — médecins & praticiens" },
  // On cherche « embauche » ou « CV » bien plus souvent que « recrutement » — et « demande de
  // recrutement » est le nom du circuit, pas celui que l'on tape.
  { terms: ["recrutement", "embauche", "cv", "candidature", "candidatures", "poste à pourvoir", "poste a pourvoir"], href: "/recrutement", label: "Recrutement — demandes, CV et intégration" },
];

/** Destinations correspondant à un terme tapé — insensible à la casse et aux accents. */
export function aliasMatches(query: string): { href: string; label: string }[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return NAV_ALIASES
    .filter((a) => a.terms.some((t) => norm(t).includes(q) || q.includes(norm(t))))
    .map((a) => ({ href: a.href, label: a.label }));
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
