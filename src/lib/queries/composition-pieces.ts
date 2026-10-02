import { userCan } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { getMyCompanies, companyLabel, companyIdForNew } from "@/lib/company";
import { legalWriteAllowed } from "@/lib/legal/invoices";
import { letterheadContextFor } from "@/lib/queries/letterheads";
import { canManageLetterheads } from "@/lib/office/letterhead";
import type { TypePieceComposable } from "@/components/pieces/composer-piece";

/**
 * CE QU'IL FAUT POUR COMPOSER UNE PIÈCE — les natures qu'on a le droit d'émettre, les sociétés
 * qu'on peut engager, la papeterie Word, et le droit de régler la numérotation.
 *
 * Deux écrans portent le bouton « Composer » : Legal, et le module « Bons de commande » (§118.149
 * — « même chose pour les financiers dans les finances » ; module à part depuis §118.176). Ils calculaient chacun leurs droits et
 * leur papeterie ; deux calculs de « qui peut émettre un BC » finissent par diverger, et le
 * symptôme serait un bouton qu'une action refuse (§118.5). La règle d'émission est celle de la
 * fabrique et d'Adam (`legalWriteAllowed`), rejouée par le serveur au moment d'émettre : l'écran
 * ne fait que la LIRE pour savoir quoi proposer.
 *
 * `null` : cette personne ne peut rien émettre — aucun bouton, et rien n'est chargé.
 */
export interface CompositionPieces {
  types: TypePieceComposable[];
  societes: { id: string; label: string }[];
  societeParDefaut: string | null;
  letterheads: { id: string; name: string; companyId: string | null; companyLabel: string | null }[];
  peutReglerNumerotation: boolean;
}

const NATURES: readonly (readonly ["INVOICE" | "PURCHASE_ORDER" | "QUOTE", TypePieceComposable])[] = [
  ["INVOICE", "FACTURE"], ["PURCHASE_ORDER", "BON_DE_COMMANDE"], ["QUOTE", "DEVIS"],
];

export async function compositionDesPieces(user: CurrentUser): Promise<CompositionPieces | null> {
  const droits = { onLegal: userCan(user, "LEGAL", "CREATE"), onFinances: userCan(user, "FINANCES", "CREATE") };
  const types = NATURES.filter(([kind]) => legalWriteAllowed({ ...droits, kind })).map(([, type]) => type);
  if (types.length === 0) return null;
  const [societes, ctx, societeParDefaut] = await Promise.all([
    getMyCompanies(user.id), letterheadContextFor(user.id), companyIdForNew(user.id),
  ]);
  return {
    types,
    societes: societes.map((c) => ({ id: c.id, label: companyLabel(c) })),
    societeParDefaut,
    letterheads: ctx.letterheads.filter((l) => l.kind === "word").map((l) => ({ id: l.id, name: l.name, companyId: l.companyId, companyLabel: l.companyLabel })),
    peutReglerNumerotation: canManageLetterheads(user),
  };
}
