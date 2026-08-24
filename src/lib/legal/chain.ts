/**
 * LA CHAÎNE DU DOSSIER D'ACHAT — devis → bon de commande → facture → règlement.
 *
 * Les pièces existaient chacune dans son coin, et le rapprochement se faisait de tête : « ce BC
 * vient-il de ce devis ? cette facture est-elle celle de ce BC ? qui a validé quoi, et combien de
 * temps chaque étape a-t-elle pris ? ». La chaîne répond à ces trois questions d'un seul écran.
 *
 * Le modèle est un FIL : chaque pièce pointe vers celle dont elle découle (`chainFromId`). Un fil,
 * pas un arbre affiché : un devis peut engendrer deux BC (deux lots), et dans ce cas la fiche de
 * CHAQUE BC remonte au même devis — on lit toujours le fil de la pièce qu'on regarde, jamais un
 * graphe complet qui mélangerait deux commandes.
 *
 * Module PUR — testé, sans base.
 */

/** Les natures qui forment la chaîne, DANS L'ORDRE du dossier d'achat. */
export const CHAIN_KINDS = ["QUOTE", "PURCHASE_ORDER", "INVOICE"] as const;
export type ChainKind = (typeof CHAIN_KINDS)[number];

export const CHAIN_KIND_LABEL: Record<ChainKind, string> = {
  QUOTE: "Devis",
  PURCHASE_ORDER: "Bon de commande",
  INVOICE: "Facture",
};

/** La pièce qui SUIT naturellement celle-ci — ce qu'on propose de créer ensuite. */
export function nextChainKind(kind: string): ChainKind | null {
  const i = (CHAIN_KINDS as readonly string[]).indexOf(kind);
  if (i < 0 || i >= CHAIN_KINDS.length - 1) return null;
  return CHAIN_KINDS[i + 1];
}

export interface ChainDoc {
  id: string;
  kind: string;
  chainFromId: string | null;
}

/**
 * LE FIL D'UNE PIÈCE : ses ancêtres (jusqu'au devis) puis ses descendants, dans l'ordre.
 *
 * On remonte d'abord au premier maillon, puis on redescend. À la descente, un maillon peut avoir
 * plusieurs suites (deux BC sur un devis) : on suit LA branche qui mène à la pièce regardée, et,
 * au-delà d'elle, la suite s'il n'y en a qu'une — deux suites ex æquo ne se départagent pas, on
 * s'arrête là plutôt que d'afficher une branche choisie au hasard.
 *
 * Garde-fou : un cycle (A suit B qui suit A, possible par erreur de saisie) ne doit pas geler
 * l'écran — chaque identifiant n'est visité qu'une fois.
 */
export function chainOf(docs: readonly ChainDoc[], id: string): ChainDoc[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const start = byId.get(id);
  if (!start) return [];

  // Remonter au premier maillon.
  const up: ChainDoc[] = [];
  const seen = new Set<string>([start.id]);
  let cur: ChainDoc | undefined = start;
  while (cur?.chainFromId) {
    const parent = byId.get(cur.chainFromId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    up.unshift(parent);
    cur = parent;
  }

  // Redescendre : la branche qui mène à `id`, puis la suite unique au-delà.
  const childrenOf = (pid: string) => docs.filter((d) => d.chainFromId === pid);
  const chain = [...up, start];
  let tip = start;
  for (;;) {
    const next = childrenOf(tip.id).filter((d) => !seen.has(d.id));
    if (next.length !== 1) break;
    seen.add(next[0].id);
    chain.push(next[0]);
    tip = next[0];
  }
  return chain;
}

/** Les maillons de la chaîne d'achat qui MANQUENT encore — ce qu'il reste à produire. */
export function missingKinds(chain: readonly { kind: string }[]): ChainKind[] {
  const present = new Set(chain.map((d) => d.kind));
  return CHAIN_KINDS.filter((k) => !present.has(k));
}

/**
 * LE DÉLAI entre deux maillons, en jours pleins — la question que pose la Direction.
 *
 * « Le BC a mis onze jours après le devis » se lit ; « créé le 12, créé le 23 » se calcule de
 * tête, et on ne le fait jamais. `null` quand une des dates manque.
 */
export function delayDays(from: Date | string | null | undefined, to: Date | string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Le libellé du délai : « le jour même », « 11 j », « −2 j » (pièce antidatée — ça arrive). */
export function delayLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) return "le jour même";
  return `${days > 0 ? "+" : "−"}${Math.abs(days)} j`;
}

/**
 * L'ÉCART entre le devis et la facture, quand les deux montants existent.
 *
 * C'est LE chiffre qu'on vérifie avant de payer : une facture au-dessus du devis n'est pas
 * forcément une erreur (avenant, livraison), mais elle doit se VOIR. `null` = pas comparable.
 */
export function amountDrift(quote: number | null | undefined, invoice: number | null | undefined): number | null {
  if (quote == null || invoice == null || quote <= 0) return null;
  return invoice - quote;
}
