import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere } from "@/lib/company";
import { legalReaderWhere } from "@/lib/lecteurs/legal";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { LEGAL_DOC_KIND } from "@/lib/labels";
import type { AccesPiecesLiees } from "@/components/shared/linked-records";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UNE FICHE Ad & Pro A LE DROIT DE MONTRER DE SES PIÈCES LIÉES — calculé UNE fois.
 *
 * Trois écrans Ad & Pro montent le bloc des pièces liées (sponsoring, prises en charge,
 * événements) et un quatrième arrive tôt ou tard. Chacun aurait épelé les mêmes droits à sa
 * façon, et chaque orthographe en oublie un : c'est le défaut mesuré de `ad-pro/attachments.ts`
 * (« chacun l'épelait à sa façon, et chaque orthographe oubliait quelqu'un, qui envoyait alors
 * la facture par mail avec un dossier vide »). La règle vit donc ici, et les écrans la lisent.
 *
 * ── LES DEUX CHOSES QU'ELLE RÉPOND ──────────────────────────────────────────────────────
 *
 *   • `acces` — peut-on OUVRIR les documents d'un engagement, d'une facture, d'un courrier
 *     rattachés ? Ces fichiers appartiennent à LEUR module : quelqu'un qui a Ad & Pro sans Legal
 *     voit déjà le titre et le montant de l'engagement, lui ouvrir ses pièces lui donnerait le
 *     contrat. Sans le droit, les documents ne sont pas même CHARGÉS.
 *
 *   • `candidatsLegal` — quels documents Legal peut-on RATTACHER ? La liste est cloisonnée
 *     EXACTEMENT comme celle de l'écran Legal : portée d'entité (`companyScopedWhere`) plus les
 *     lecteurs désignés (`legalReaderWhere`). Une liste plus large proposerait un document que
 *     le serveur refuserait ensuite — un geste offert puis retiré, la pire façon de refuser.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PiecesLieesContexte {
  acces: AccesPiecesLiees;
  candidatsLegal: { value: string; label: string }[];
}

/**
 * `moduleAdPro` est le module de la FICHE (SPONSORING, EVENTS, CONGRESS…) : c'est lui qui dit si
 * la personne peut modifier CE dossier, donc lui rattacher quelque chose. Les droits sur les
 * documents des pièces, eux, viennent de Legal et de Courriers — jamais du module de la fiche.
 */
export async function contextePiecesLiees(
  user: SessionUser,
  moduleAdPro: Parameters<typeof userCan>[1],
): Promise<PiecesLieesContexte> {
  const peutLireLegal = userCan(user, "LEGAL", "VIEW") || userCan(user, "FINANCES", "VIEW");
  const peutLireCourriers = userCan(user, "MAIL_REGISTER", "VIEW");
  const peutModifierLegal = userCan(user, "LEGAL", "UPDATE") || userCan(user, "FINANCES", "UPDATE");

  const acces: AccesPiecesLiees = {
    legal: peutLireLegal,
    courriers: peutLireCourriers,
    // RENOMMER ET SUPPRIMER suivent le module de la PIÈCE, pas celui de la fiche : le droit de
    // décider d'un sponsoring n'est pas le droit de supprimer la pièce d'un contrat.
    peutRenommer: peutModifierLegal,
    peutSupprimer: userCan(user, "LEGAL", "DELETE") || userCan(user, "FINANCES", "DELETE"),
    peutEditer: onlyofficeConfigured() && peutModifierLegal,
  };

  // RATTACHER exige les deux droits : modifier la fiche cible, et voir le document. Sans l'un ou
  // l'autre, la liste est vide et le bouton ne s'affiche pas — plutôt qu'un geste qui échoue.
  const peutRattacher = userCan(user, moduleAdPro, "UPDATE") && peutLireLegal;
  if (!peutRattacher) return { acces, candidatsLegal: [] };

  const lecteurs = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  const libres = await prisma.legalDocument.findMany({
    where: await companyScopedWhere(user.id, {
      // LIBRES : on ne propose pas ce qui est déjà rattaché ailleurs. Le serveur refuserait, en
      // nommant la fiche qui le porte — mais le proposer d'abord ferait chercher pourquoi.
      sourceId: null,
      ...(lecteurs ? { AND: [lecteurs] } : {}),
    }),
    select: { id: true, title: true, reference: true, kind: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return {
    acces,
    candidatsLegal: libres.map((d) => ({
      value: d.id,
      label: [d.reference, d.title, LEGAL_DOC_KIND[d.kind] ?? d.kind].filter(Boolean).join(" · "),
    })),
  };
}
