import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { cleBrute } from "@/lib/consommation/lecture";
import { impactConsommation } from "@/lib/segmentation/service";
import { Revue, type GroupeARevoir } from "./revue";

export const dynamic = "force-dynamic";

const TON: Record<string, "success" | "warning" | "neutral" | "danger"> = { OK: "success", A_REVOIR: "warning", DOUBLON: "neutral", IGNOREE: "neutral" };
const LIB: Record<string, string> = { OK: "Sûre", A_REVOIR: "À revoir", DOUBLON: "Doublon", IGNOREE: "Ignorée" };

/**
 * LA REVUE D'UN IMPORT — ce qui a été lu (feuilles, colonnes et leur confiance), ce qui est sûr, ce qui reste à
 * trancher (regroupé par valeur brute : une correspondance confirmée vaut pour toutes ses lignes et s'apprend),
 * l'impact sur la segmentation, puis la validation.
 */
export default async function RevueImportPage({ params, searchParams }: { params: { id: string }; searchParams?: { statut?: string } }) {
  const user = await requireModule("CONSUMPTION");
  const imp = await prisma.consommationImport.findUnique({ where: { id: params.id }, select: { id: true, nomFichier: true, statut: true, analyse: true, createdAt: true, valideLe: true } });
  if (!imp) notFound();
  const peutRevoir = userCan(user, "CONSUMPTION", "UPDATE") && imp.statut === "EN_REVUE";
  const peutValider = userCan(user, "CONSUMPTION", "VALIDATE");
  const filtre = ["OK", "A_REVOIR", "DOUBLON", "IGNOREE"].includes(searchParams?.statut ?? "") ? searchParams!.statut! : null;
  const [lignes, compte] = await Promise.all([
    prisma.consommationLigne.findMany({
      where: { importId: imp.id, ...(filtre ? { statut: filtre } : {}) },
      orderBy: [{ feuille: "asc" }, { ligneSource: "asc" }], take: 400,
      select: {
        id: true, feuille: true, ligneSource: true, periodeDebut: true, periodeFin: true, etablissementBrut: true, produitBrut: true, molecule: true,
        quantiteSource: true, uniteSource: true, quantite: true, unite: true, confiance: true, statut: true, anomalies: true,
        institution: { select: { name: true } }, product: { select: { canonicalName: true } },
      },
    }),
    prisma.consommationLigne.groupBy({ by: ["statut"], where: { importId: imp.id }, _count: { _all: true } }),
  ]);
  const n = (s: string) => compte.find((c) => c.statut === s)?._count._all ?? 0;

  // Les valeurs brutes à trancher, regroupées : une décision par valeur, appliquée à toutes ses lignes.
  const aRevoir = imp.statut === "EN_REVUE" ? await prisma.consommationLigne.findMany({
    where: { importId: imp.id, statut: "A_REVOIR" },
    select: { etablissementBrut: true, produitBrut: true, molecule: true, institutionId: true, productId: true, anomalies: true },
  }) : [];
  const groupes = new Map<string, GroupeARevoir>();
  for (const l of aRevoir) {
    const an = (l.anomalies ?? {}) as { propositionProduit?: { id: string; nom: string; pourquoi: string } | null };
    if (!l.institutionId && l.etablissementBrut) {
      const k = `E|${cleBrute(l.etablissementBrut)}`;
      const g = groupes.get(k) ?? { nature: "ETABLISSEMENT" as const, brut: l.etablissementBrut, lignes: 0, proposition: null };
      g.lignes++; groupes.set(k, g);
    }
    const brutP = l.produitBrut ?? l.molecule;
    if (!l.productId && brutP && (an.propositionProduit || !l.molecule)) {
      const k = `P|${cleBrute(brutP)}`;
      const g = groupes.get(k) ?? { nature: "PRODUIT" as const, brut: brutP, lignes: 0, proposition: an.propositionProduit ?? null };
      g.lignes++; groupes.set(k, g);
    }
  }
  const [etablissements, produits, impact] = await Promise.all([
    groupes.size ? prisma.medicalInstitution.findMany({ where: { isActive: true }, select: { id: true, name: true, wilaya: true }, orderBy: { name: "asc" } }) : [],
    groupes.size ? prisma.product.findMany({ where: { isActive: true }, select: { id: true, canonicalName: true }, orderBy: { canonicalName: "asc" } }) : [],
    imp.statut === "EN_REVUE" ? impactConsommation(imp.id) : [],
  ]);
  const analyse = imp.analyse as { feuilles?: { feuille: string; format: string; ligneEntete: number; lignes: number; periodeFeuille: { libelle: string } | null; anomalies: string[]; colonnes: { texte: string; champ: string | null; confiance: number; origine: string; periode?: { libelle: string } }[] }[]; ignorees?: string[] };

  return (
    <div className="space-y-5">
      <PageHeader title={imp.nomFichier} description={`Importé le ${imp.createdAt.toLocaleDateString("fr-FR")} · ${n("OK")} ligne(s) sûre(s), ${n("A_REVOIR")} à revoir, ${n("DOUBLON")} doublon(s), ${n("IGNOREE")} ignorée(s)`}>
        <Link href="/consommation" className="text-sm text-primary underline">Tous les imports</Link>
      </PageHeader>

      <section className="surface space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Ce qui a été lu</h2>
        {(analyse.feuilles ?? []).map((f) => (
          <div key={f.feuille} className="space-y-1">
            <p><b>{f.feuille}</b> · en-tête ligne {f.ligneEntete} · format {f.format === "LARGE" ? "large (une colonne par période, déplié)" : "en lignes"} · {f.lignes} ligne(s){f.periodeFeuille ? ` · période de la feuille : ${f.periodeFeuille.libelle}` : ""}</p>
            <p className="text-xs text-muted-foreground">{f.colonnes.map((c) => `${c.texte.slice(0, 32)} → ${c.periode ? `période ${c.periode.libelle}` : c.champ ?? "ignorée"}${c.champ ? ` (${c.confiance} %, ${c.origine})` : ""}`).join(" · ")}</p>
            {f.anomalies.map((a, i) => <p key={i} className="text-xs text-warning">{a}</p>)}
          </div>
        ))}
        {(analyse.ignorees ?? []).length > 0 && <p className="text-xs text-muted-foreground">Feuilles sans forme de consommation (non lues) : {analyse.ignorees!.join(", ")}.</p>}
      </section>

      {impact.length > 0 && (
        <section className="surface space-y-1 p-4 text-sm">
          <h2 className="font-semibold">Impact sur la segmentation si cet import est validé</h2>
          {impact.map((x) => <p key={x.strategie}>{x.strategie} : {x.praticiens === 0 ? "aucun segment ne change." : `${x.praticiens} praticien(s), ${x.changements} segment(s) changent.`}</p>)}
        </section>
      )}

      <Revue
        importId={imp.id}
        statut={imp.statut}
        groupes={[...groupes.values()]}
        etablissements={etablissements.map((e) => ({ id: e.id, nom: e.wilaya ? `${e.name} (${e.wilaya})` : e.name }))}
        produits={produits.map((p) => ({ id: p.id, nom: p.canonicalName }))}
        peutRevoir={peutRevoir}
        peutValider={peutValider}
        aRevoir={n("A_REVOIR")}
        sures={n("OK")}
      />

      <nav className="flex flex-wrap gap-1 text-xs">
        {[null, "OK", "A_REVOIR", "DOUBLON", "IGNOREE"].map((s) => (
          <Link key={s ?? "tout"} href={`/consommation/${imp.id}${s ? `?statut=${s}` : ""}`} className={`rounded-md border px-2 py-1 ${filtre === s ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{s ? LIB[s] : "Toutes"}</Link>
        ))}
      </nav>
      <div className="surface overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr><th className="px-2 py-2">Source</th><th className="px-2 py-2">Période</th><th className="px-2 py-2">Établissement</th><th className="px-2 py-2">Produit</th><th className="px-2 py-2">Quantité source</th><th className="px-2 py-2">Normalisée</th><th className="px-2 py-2">Confiance</th><th className="px-2 py-2">Statut</th><th className="px-2 py-2">Remarques</th></tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const an = (l.anomalies ?? {}) as { messages?: string[] };
              return (
                <tr key={l.id} className="border-b border-border/60 align-top">
                  <td className="px-2 py-1">{l.feuille} · l. {l.ligneSource}</td>
                  <td className="px-2 py-1">{l.periodeDebut ? `${l.periodeDebut.toISOString().slice(0, 7)}${l.periodeFin && l.periodeFin.toISOString().slice(0, 7) !== l.periodeDebut.toISOString().slice(0, 7) ? ` → ${l.periodeFin.toISOString().slice(0, 7)}` : ""}` : "—"}</td>
                  <td className="px-2 py-1">{l.institution?.name ?? <span className="text-warning">{l.etablissementBrut ?? "—"}</span>}</td>
                  <td className="px-2 py-1">{l.product?.canonicalName ?? <span className={l.molecule ? "" : "text-warning"}>{l.produitBrut ?? l.molecule ?? "—"}{!l.product && l.molecule ? " (hors référentiel)" : ""}</span>}</td>
                  <td className="px-2 py-1">{l.quantiteSource === null ? "—" : `${Number(l.quantiteSource)} ${l.uniteSource ?? ""}`}</td>
                  <td className="px-2 py-1">{l.quantite === null ? "—" : `${Number(l.quantite)} ${l.unite ?? ""}`}</td>
                  <td className="px-2 py-1">{l.confiance} %</td>
                  <td className="px-2 py-1"><Badge tone={TON[l.statut] ?? "neutral"}>{LIB[l.statut] ?? l.statut}</Badge></td>
                  <td className="px-2 py-1 text-muted-foreground">{(an.messages ?? []).join(" ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lignes.length === 400 && <p className="p-2 text-xs text-muted-foreground">Les 400 premières lignes sont affichées ; filtrez par statut pour voir le reste.</p>}
      </div>
    </div>
  );
}
