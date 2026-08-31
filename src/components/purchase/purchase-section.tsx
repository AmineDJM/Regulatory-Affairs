import { prisma } from "@/lib/prisma";
import { getManagerOfUser } from "@/lib/departments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { purchaseStage, summarize, type PurchaseLine } from "@/lib/general-means/purchase-request";
import { PurchaseRequestForm } from "./purchase-request-form";
import { MyPurchaseRequests, type MyPurchaseRow } from "./my-purchase-requests";
import type { CatalogArticle } from "@/app/(app)/moyens-generaux/receipt-lines";

/**
 * MES DEMANDES D'ACHAT — le bloc a quitté les Moyens généraux pour « Mon espace ».
 *
 * DEMANDER un stylo et TENIR la caisse du département sont deux métiers. Les Moyens généraux
 * sont l'écran de ceux qui achètent et qui décaissent ; demander ce dont on a besoin pour
 * travailler est un geste de tout le monde, au même titre que demander un congé ou une
 * formation. Le mettre dans un module que la plupart des gens n'ouvrent jamais, c'était le
 * rendre introuvable pour ceux à qui il est destiné.
 *
 * Le circuit ne change pas d'un iota : le responsable hiérarchique valide, et l'achat suit.
 * C'est l'ENDROIT qui change, pas la règle.
 */
export async function PurchaseSection({
  userId, articles,
}: {
  userId: string;
  articles: CatalogArticle[];
}) {
  const [manager, requests] = await Promise.all([
    getManagerOfUser(userId),
    prisma.administrativeRequest.findMany({
      where: { requesterId: userId, type: "PURCHASE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, reference: true, title: true, status: true, createdAt: true, fields: true,
        validator: { select: { name: true } },
        approvals: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, comment: true, decidedAt: true } },
      },
    }),
  ]);

  const rows: MyPurchaseRow[] = requests.map((r) => {
    const fields = (r.fields as Record<string, unknown> | null) ?? {};
    const lines = Array.isArray(fields.purchaseLines) ? (fields.purchaseLines as PurchaseLine[]) : [];
    const approval = r.approvals[0] ?? null;
    const stage = purchaseStage(r.status, approval);
    return {
      id: r.id,
      reference: r.reference,
      title: r.title,
      summary: lines.length > 0 ? summarize(lines) : "—",
      createdAt: r.createdAt.toISOString(),
      stage,
      validatorName: r.validator?.name ?? null,
      estimated: typeof fields.estimatedTotal === "number" ? fields.estimatedTotal : null,
      // On ne montre le commentaire du validateur qu'une fois qu'il a DÉCIDÉ : avant, le champ
      // porte l'estimation catalogue, qui n'est pas un avis et se lirait comme tel.
      decisionNote: approval?.decidedAt ? approval.comment : null,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes demandes d&apos;achat</CardTitle>
        <p className="text-xs text-muted-foreground">
          {manager
            ? <>Ce dont vous avez besoin, validé par <strong>{manager.fullName}</strong>. Choisissez dans le catalogue de la société, ou décrivez ce qui n&apos;y figure pas.</>
            : <>Aucun responsable hiérarchique n&apos;est rattaché à votre fiche employé : demandez aux ressources humaines de la compléter, sinon la demande n&apos;aurait personne à qui aller.</>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <PurchaseRequestForm articles={articles} managerName={manager?.fullName ?? null} />
        <MyPurchaseRequests rows={rows} />
      </CardContent>
    </Card>
  );
}
