/**
 * L'ANNUAIRE DE L'ENTREPRISE — tout ce qui n'est ni un praticien, ni un salarié.
 *
 * Agence de voyage, livreur, imprimeur, agence marketing, hôtel, traiteur, transitaire, huissier.
 * Ces numéros vivent aujourd'hui dans les téléphones de trois personnes : le jour où celle qui
 * connaît l'imprimeur est en congé, on le cherche sur Internet et on rappelle un fournisseur qu'on
 * avait quitté. Un annuaire d'entreprise est exactement ce qui manque à ce moment-là.
 *
 * Les natures ci-dessous sont des SUGGESTIONS, pas une liste fermée : la réalité invente des
 * métiers plus vite qu'un menu déroulant ne les prévoit (« sérigraphie », « douanes », « standiste »).
 * Elles servent à proposer et à regrouper, jamais à refuser une saisie.
 *
 * Module PUR — testé, sans base de données.
 */

/** Les natures qu'on retrouve dans presque toutes les entreprises — proposées, jamais imposées. */
export const CONTACT_KIND_SUGGESTIONS = [
  "Agence de voyage",
  "Livreur / coursier",
  "Transitaire",
  "Imprimeur",
  "Agence marketing",
  "Agence événementielle",
  "Hôtel",
  "Traiteur",
  "Fournisseur",
  "Prestataire informatique",
  "Assurance",
  "Banque",
  "Avocat / huissier",
  "Administration",
  "Maintenance / travaux",
  "Autre",
] as const;

/** Le libellé affiché pour un contact sans nature — « — » se lit mieux qu'un vide. */
export const NO_KIND_LABEL = "Sans catégorie";

/**
 * Normalise une nature saisie à la main pour le REGROUPEMENT.
 *
 * « imprimeur », « Imprimeur » et « IMPRIMEUR  » doivent tomber dans le même groupe : sans cela,
 * l'annuaire affiche trois rubriques qui contiennent chacune un contact, et le regroupement — la
 * seule raison d'avoir une nature — ne sert plus à rien. Les accents sont conservés : « Hôtel » et
 * « Hotel » restent deux écritures d'un même mot, mais les fondre demanderait un dictionnaire.
 */
export function normalizeKind(kind: string | null | undefined): string {
  return (kind ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Le libellé de groupe : la première écriture rencontrée, pour ne pas imposer une casse. */
export function groupContactsByKind<T extends { kind: string | null }>(contacts: readonly T[]): { label: string; items: T[] }[] {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const c of contacts) {
    const key = normalizeKind(c.kind);
    const label = key ? (c.kind ?? "").trim() : NO_KIND_LABEL;
    const existing = groups.get(key);
    if (existing) existing.items.push(c);
    else groups.set(key, { label, items: [c] });
  }
  // Les contacts sans catégorie EN DERNIER : ce sont ceux qu'on n'a pas encore rangés, pas ceux
  // qu'on cherche en premier.
  return [...groups.values()].sort((a, b) => {
    if (a.label === NO_KIND_LABEL) return 1;
    if (b.label === NO_KIND_LABEL) return -1;
    return a.label.localeCompare(b.label, "fr");
  });
}

/**
 * Un contact correspond-il à une recherche ? Nom, nature, personne, téléphone, ville, e-mail.
 *
 * On cherche un imprimeur autant par « imprimeur » que par « Sarl El Bahia » ou par les quatre
 * derniers chiffres d'un numéro qu'on a sous les yeux sur une facture — les trois doivent marcher.
 */
export function matchesContact(
  c: { name: string; kind: string | null; contactName: string | null; phone: string | null; email: string | null; city: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.kind, c.contactName, c.phone, c.email, c.city]
    .some((v) => (v ?? "").toLowerCase().includes(q));
}
