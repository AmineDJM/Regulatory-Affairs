/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE DU MATÉRIEL PROMOTIONNEL — ce qu'on PEUT commander, sous une référence fixe (§118.164).
 *
 * « Le super administrateur a un catalogue de matériel promotionnel. Il peut l'ouvrir en édition
 * ou en lecture à qui il veut dans la société. » Le catalogue est la liste des TYPES de supports
 * (« Fiche posologique », « Banner roll-up 85×200 », « Stylo ») ; c'est le stock qui les
 * spécialise par produit (« Fiche posologique — Nivolex »).
 *
 * ── LA RÉFÉRENCE NE CHANGE PLUS, LE NOM SI ──────────────────────────────────────────────────
 *
 * `CAT-0042` est donnée à la création et ne bouge plus : c'est elle que citeront les demandes
 * d'achat, les stocks, les factures. Corriger une faute dans le nom ne doit pas obliger à recréer
 * l'article — et recréer ferait deux références pour la même chose, que rien ne rapprocherait.
 *
 * Le préfixe n'est pas « MP- » : les dossiers de matériel promotionnel s'écrivent déjà
 * « MP-AAAA-NNN ». Deux objets distincts sous le même préfixe, c'est la garantie qu'un jour
 * quelqu'un cherche l'un en tapant l'autre.
 *
 * Module PUR — aucune base. Testé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type PromoFamille = "CONSOMMABLE" | "DURABLE" | "NUMERIQUE";

export const FAMILLES: readonly PromoFamille[] = ["CONSOMMABLE", "DURABLE", "NUMERIQUE"];

export const FAMILLE_LABEL: Record<PromoFamille, string> = {
  CONSOMMABLE: "Consommable",
  DURABLE: "Durable",
  NUMERIQUE: "Numérique",
};

/** Ce que la famille CHANGE — dit à l'écran, sous le choix, pour que le choix soit éclairé. */
export const FAMILLE_AIDE: Record<PromoFamille, string> = {
  CONSOMMABLE: "Fiches, flyers, stylos, blocs : une quantité qui baisse à chaque remise. Un lot peut avoir une fin de validité.",
  DURABLE: "Banners, présentoirs, stands : des unités qui se prêtent et reviennent. Pas de péremption.",
  NUMERIQUE: "E-flyer, vidéo, e-ADV : pas de quantité — un lien et une période de validité.",
};

/** Un support numérique n'a rien à compter : ni lot, ni mouvement, ni transfert. */
export function familleQuantifiee(f: PromoFamille): boolean {
  return f !== "NUMERIQUE";
}

/** Un lot DURABLE ne périme pas : on ne lui propose pas de fin de validité. */
export function familleAValidite(f: PromoFamille): boolean {
  return f === "CONSOMMABLE";
}

const DURABLES = new Set(["PRESENTOIRE", "STAND_BOOTH", "BANNER"]);
const NUMERIQUES = new Set(["VIDEO"]);

/**
 * LA FAMILLE PROPOSÉE pour une nature de support — une PROPOSITION à la création, que la personne
 * peut changer. Une vidéo est proposée numérique ; une clé USB, qui contient peut-être la même
 * vidéo, est un objet qu'on remet : consommable.
 */
export function familleDuType(materialType: string | null | undefined): PromoFamille {
  if (materialType && DURABLES.has(materialType)) return "DURABLE";
  if (materialType && NUMERIQUES.has(materialType)) return "NUMERIQUE";
  return "CONSOMMABLE";
}

export const PREFIXE_REFERENCE = "CAT-";

/**
 * `CAT-0007`. Quatre chiffres AU MOINS, jamais au plus : la dix-millième référence s'écrit
 * `CAT-10000` — tronquer la ferait retomber sur `CAT-1000`, déjà prise (§118.147, le défaut de
 * `lpad`).
 */
export function referenceCatalogue(n: number): string {
  const entier = Math.max(1, Math.floor(n));
  return `${PREFIXE_REFERENCE}${String(entier).padStart(4, "0")}`;
}

/** Le numéro d'une référence `CAT-NNNN`, ou `null` si ce n'en est pas une. */
export function numeroDeReference(ref: string): number | null {
  const m = /^CAT-(\d+)$/.exec(ref.trim());
  return m ? Number(m[1]) : null;
}

/** La prochaine référence, depuis celles qui existent — le MAXIMUM, jamais le compte (trous). */
export function prochaineReference(existantes: readonly string[]): string {
  let max = 0;
  for (const r of existantes) {
    const n = numeroDeReference(r);
    if (n != null && n > max) max = n;
  }
  return referenceCatalogue(max + 1);
}

export interface SaisieArticle {
  nom: string | null;
  famille: string | null;
  materialType: string | null;
  unite: string | null;
  description: string | null;
  exigeProduit: boolean;
}

export interface ArticleValide {
  nom: string;
  famille: PromoFamille;
  materialType: string | null;
  unite: string;
  description: string | null;
  exigeProduit: boolean;
}

/**
 * VALIDER UNE SAISIE D'ARTICLE — tout ce qui manque, en une fois (§118.18).
 *
 * Un support NUMÉRIQUE n'exige pas de produit par défaut mais le peut (un e-ADV Nivolex) ; une
 * unité vide redevient « pièce » plutôt que de laisser un stock compté en rien.
 */
export function validerArticle(s: SaisieArticle, typesConnus: ReadonlySet<string>):
  { ok: true; article: ArticleValide } | { ok: false; error: string } {
  const manques: string[] = [];
  const nom = (s.nom ?? "").trim();
  if (!nom) manques.push("le nom de l'article");
  const famille = FAMILLES.find((f) => f === s.famille) ?? null;
  if (!famille) manques.push("sa famille (consommable, durable ou numérique)");
  if (manques.length) return { ok: false, error: `Il manque ${manques.join(" et ")}.` };
  const materialType = s.materialType && typesConnus.has(s.materialType) ? s.materialType : null;
  if (s.materialType && !materialType) {
    return { ok: false, error: `Nature de support inconnue : « ${s.materialType} ».` };
  }
  return {
    ok: true,
    article: {
      nom,
      famille: famille!,
      materialType,
      unite: (s.unite ?? "").trim() || "pièce",
      description: (s.description ?? "").trim() || null,
      exigeProduit: s.exigeProduit,
    },
  };
}
