/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UNE LIGNE DE MATÉRIEL PROMEUT (§118.204).
 *
 * « Produit(s) promu(s) » affichait « Aucun produit actif dans le référentiel » : la liste lisait
 * le produit CANONIQUE (`Product`), que rien ne crée encore en production (§118.178), alors que les
 * produits que la force de vente PROMEUT sont ceux des Business Units (`PromoProduct`). Une ligne
 * promeut désormais, au choix et cumulables : la SOCIÉTÉ en général, une ou plusieurs GAMMES (une
 * Business Unit), un ou plusieurs PRODUITS d'une BU — sans nommer la BU —, et « Autre », en clair.
 *
 * Le choix se STOCKE LISIBLE (`PromoRequestItem.promus`, JSON) : l'assistante qui cherche les
 * devis, le tableau des devis et la fiche le lisent tel quel, sans relire l'annuaire des BU — un
 * produit renommé ou archivé demain ne réécrit pas ce qui a été demandé hier.
 *
 * PUR, zéro import : le formulaire (navigateur) code ses options, le serveur les décode.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PromusChoisis {
  societe: boolean;
  gammes: { id: string; nom: string }[];
  produits: { id: string; nom: string }[];
  autre: string | null;
}

/** Les CODES d'option du sélecteur — une valeur sans préfixe est un produit canonique (lignes d'avant). */
export const CODE_SOCIETE = "societe";
export const codeGamme = (businessUnitId: string) => `gamme:${businessUnitId}`;
export const codeProduitBu = (promoProductId: string) => `bu:${promoProductId}`;

export const LIBELLE_SOCIETE = "Société en général";

export type CodeLu =
  | { type: "SOCIETE" }
  | { type: "GAMME"; id: string }
  | { type: "PRODUIT_BU"; id: string }
  | { type: "CANONIQUE"; id: string };

/** Lire un code ; `null` sur ce qui ne se lit pas à coup sûr (un préfixe sans identifiant). */
export function lireCode(brut: string): CodeLu | null {
  const v = brut.trim();
  if (!v) return null;
  if (v === CODE_SOCIETE) return { type: "SOCIETE" };
  if (v.startsWith("gamme:")) { const id = v.slice(6).trim(); return id ? { type: "GAMME", id } : null; }
  if (v.startsWith("bu:")) { const id = v.slice(3).trim(); return id ? { type: "PRODUIT_BU", id } : null; }
  if (v.includes(":")) return null;
  return { type: "CANONIQUE", id: v };
}

export const aucunPromu = (p: PromusChoisis | null): boolean =>
  !p || (!p.societe && p.gammes.length === 0 && p.produits.length === 0 && !p.autre);

/** Un article « par produit » (fiche posologique) exige un PRODUIT désigné — un produit d'une BU, ou « Autre ». */
export const designeUnProduit = (p: PromusChoisis): boolean => p.produits.length > 0 || Boolean(p.autre);

/** Les libellés, dans l'ordre où on les lit : « Société en général », « Gamme Oncologie », « Nivolex », « Autre : … ». */
export function libellesPromus(p: PromusChoisis | null): string[] {
  if (!p) return [];
  return [
    ...(p.societe ? [LIBELLE_SOCIETE] : []),
    ...p.gammes.map((g) => `Gamme ${g.nom}`),
    ...p.produits.map((x) => x.nom),
    ...(p.autre ? [`Autre : ${p.autre}`] : []),
  ];
}

/** Les codes d'un choix enregistré — pour présélectionner le sélecteur à la correction. */
export function codesPromus(p: PromusChoisis | null): string[] {
  if (!p) return [];
  return [
    ...(p.societe ? [CODE_SOCIETE] : []),
    ...p.gammes.map((g) => codeGamme(g.id)),
    // Un produit est stocké sous son CODE (« bu:… », ou l'identifiant canonique d'une ligne d'avant).
    ...p.produits.map((x) => x.id),
  ];
}

const paires = (x: unknown): { id: string; nom: string }[] =>
  Array.isArray(x)
    ? x.flatMap((y) => {
        const o = y && typeof y === "object" ? (y as Record<string, unknown>) : null;
        return o && typeof o.id === "string" && typeof o.nom === "string" && o.id && o.nom ? [{ id: o.id, nom: o.nom }] : [];
      })
    : [];

/** Relire la colonne JSON ; `null` quand elle est vide ou illisible — la ligne retombe sur ses produits canoniques. */
export function lirePromusStockes(json: unknown): PromusChoisis | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const p: PromusChoisis = {
    societe: o.societe === true,
    gammes: paires(o.gammes),
    produits: paires(o.produits),
    autre: typeof o.autre === "string" && o.autre.trim() ? o.autre.trim() : null,
  };
  return aucunPromu(p) ? null : p;
}
