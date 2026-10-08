import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";
import { produit360ParId } from "@/lib/queries/product-360";
import { segmentationDuProduit, consommationDuProduit } from "@/lib/queries/vue-360";
import { attributionProduit } from "@/lib/queries/attribution-produit";
import { fiche360, type ASurveiller } from "@/lib/queries/produits-360";
import { chargerProduitCanonique } from "@/lib/queries/produits-canoniques";
import { sections360, peutModifierLesPrix } from "@/lib/vues-360-acces";
import { LIBELLE_PERIMETRE } from "@/lib/market/produit-marche";
import { chainesContratsPch, territoiresPch, fraicheurPch } from "@/lib/ventes-pch/requetes";
import { SOURCE_RECEPTIONS, moisCourt } from "@/lib/ventes-pch/calculs";
import { COUVERTURE_LABELS } from "@/lib/pch/rattachement-produit";
import { STATUT_PV, GRAVITE_PV, estStatutPv, estGravitePv } from "@/lib/pharmacovigilance/regles";
import { pct, ETAT_LABELS } from "@/lib/segmentation/regles";
import { montantCourt } from "@/lib/products/fiche-360";
import { REGULATORY_STATUS, PCH_LINE_STATUS, MANUFACTURING_STATUS, VARIATION_STATUS, REG_REQUEST_STATUS } from "@/lib/labels";
import { BackLink } from "@/components/shared/back-link";
import { InfoBulle } from "@/components/ui/info-bulle";
import { ProductDriveExplorer, dossierDriveAffiche } from "@/components/documents/product-drive-explorer";
import { Onglets, Pastille, Point, FriseCycle, Carte, Vide, BarreContrat, type Ton } from "@/components/produits/ui-360";
import { AliasProduit, RenommerProduit } from "./fiche-gestes";
import { RepartitionBu } from "./repartition-bu";
import { PrixProduit } from "./prix-produit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits 360 — AMD Internal OS" };

const dzd = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} DZD`;
const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const entier = (n: number) => Math.round(n).toLocaleString("fr-FR");
const signe = (n: number) => `${n > 0 ? "+" : ""}${nombre(n)} %`;
const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const ROLES: Record<string, string> = { DELEGATE: "Délégué", PRODUCT_MANAGER: "Chef de produit", NATIONAL_SALES: "National Sales", SUPERVISOR: "Superviseur" };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type Onglet = "vue" | "ventes" | "terrain" | "reglementaire" | "stock" | "couts" | "documents";

/** Un chiffre clé : libellé, valeur, et une ligne de contexte (variation, unité, source). */
function Chiffre({ label, valeur, contexte, ton }: { label: string; valeur: string; contexte?: string | null; ton?: "ok" | "ko" | null }) {
  return (
    <div className="min-w-0 border-b border-r border-border px-4 py-3 last:border-r-0">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="block truncate text-lg font-semibold tabular-nums">{valeur}</strong>
      {contexte && <em className={`block text-xs not-italic ${ton === "ok" ? "text-success" : ton === "ko" ? "text-destructive" : "text-muted-foreground"}`}>{contexte}</em>}
    </div>
  );
}

/** Mois par mois, en boîtes : nos réceptions à la PCH (sell-in, plein) à côté de la distribution aux hôpitaux (sell-out, clair). */
function BarresMensuelles({ mois, sellIn, sellOut }: { mois: string[]; sellIn: number[]; sellOut: number[] }) {
  const max = Math.max(...sellIn, ...sellOut, 0);
  if (max <= 0) return <Vide>Aucune réception ni distribution sur ces 12 mois.</Vide>;
  const W = 520; const H = 170; const base = 140; const pas = (W - 20) / mois.length; const l = Math.max(4, Math.min(13, pas / 2 - 3));
  return (
    <div className="px-4 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Réceptions PCH et distribution hospitalière, par mois">
        {mois.map((m, i) => {
          const x = 14 + i * pas;
          const hi = (sellIn[i] / max) * (base - 14);
          const ho = (sellOut[i] / max) * (base - 14);
          const k = Number(m.slice(5)) - 1;
          return (
            <g key={m}>
              <title>{`${MOIS[k]} ${m.slice(0, 4)} — nos réceptions ${entier(sellIn[i])} · distribuées ${entier(sellOut[i])} boîtes`}</title>
              <rect x={x} y={base - hi} width={l} height={hi} rx={2} fill="hsl(var(--primary))" />
              <rect x={x + l + 2} y={base - ho} width={l} height={ho} rx={2} fill="hsl(var(--primary))" opacity={0.35} />
              <text x={x + l + 1} y={base + 16} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{MOIS[k]}</text>
            </g>
          );
        })}
        <line x1={8} y1={base} x2={W - 4} y2={base} stroke="hsl(var(--border))" />
      </svg>
      <p className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />nos réceptions PCH</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/35" />distribution aux hôpitaux</span>
      </p>
    </div>
  );
}

/** Les cellules des tableaux de la fiche (au téléphone, le tableau défile et sa 1re colonne reste visible). */
const TH = "whitespace-nowrap px-3 py-2 font-medium";
const TD = "whitespace-nowrap px-3 py-2 text-right tabular-nums";

function ListeSurveiller({ items }: { items: ASurveiller[] }) {
  if (!items.length) return <Vide>Rien à signaler.</Vide>;
  return (
    <ul className="divide-y divide-border">
      {items.map((s, i) => (
        <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
          <Point ton={s.ton as Ton} />
          <div className="min-w-0"><b className="block font-medium">{s.titre}</b><small className="block truncate text-xs text-muted-foreground">{s.detail}</small></div>
          {s.href && <Link href={s.href} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Voir</Link>}
        </li>
      ))}
    </ul>
  );
}

function Dl({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words">{v ?? "—"}</dd></div>)}
    </dl>
  );
}

/**
 * LA FICHE PRODUIT 360 — LA page du produit (Direction, 07/10) : identité, cycle de vie, cinq chiffres, et un onglet par
 * métier. Le dossier réglementaire et son stock y vivent : la fiche du « catalogue produits » de Regulatory renvoie ici.
 * Chaque chiffre, chaque onglet n'apparaît qu'à qui a son module (`vues-360-acces.ts`).
 */
export default async function Produit360Page({ params, searchParams }: { params: { id: string }; searchParams?: { onglet?: string; annee?: string; dossier?: string } }) {
  const user = await requireModule("PRODUCTS");
  const voit = sections360(user);
  const maintenant = new Date();
  const f = await fiche360(user, params.id, maintenant);
  if (!f) notFound();
  const id = f.identite.id;

  const onglets: { cle: Onglet; label: string; visible: boolean }[] = [
    { cle: "vue", label: "Vue d'ensemble", visible: true },
    { cle: "ventes", label: "Ventes & marchés", visible: true },
    { cle: "terrain", label: "Terrain & marketing", visible: voit.forceDeVente || voit.segmentation || voit.marketing || voit.terrain || voit.adpro || voit.materiel },
    { cle: "reglementaire", label: "Réglementaire & qualité", visible: voit.reglementaire || voit.pharmacovigilance },
    { cle: "stock", label: "Stock", visible: voit.stock },
    { cle: "couts", label: "Coûts", visible: voit.finances },
    { cle: "documents", label: "Documents", visible: voit.reglementaire && f.dossiers.length > 0 },
  ];
  const visibles = onglets.filter((o) => o.visible);
  const demande = (searchParams?.dossier ? "documents" : searchParams?.onglet) as Onglet | undefined;
  const onglet: Onglet = visibles.some((o) => o.cle === demande) ? demande! : "vue";
  const annee = Number(searchParams?.annee) || maintenant.getUTCFullYear();

  const debut12 = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1));
  const besoinP360 = onglet === "vue" || onglet === "ventes" || onglet === "terrain";
  const [p360, segmentation, adpro12, consommation, attribution, canonique] = await Promise.all([
    besoinP360 ? produit360ParId(id) : Promise.resolve(null),
    voit.segmentation ? segmentationDuProduit(id) : Promise.resolve([]),
    voit.adpro
      ? prisma.adProProductAllocation.findMany({ where: { productId: id, item: { createdAt: { gte: debut12 } } }, select: { sharePct: true, amountAllocated: true, item: { select: { amountGranted: true } } } })
      : Promise.resolve(null),
    onglet === "ventes" && voit.consommation ? consommationDuProduit(id) : Promise.resolve(null),
    onglet === "couts" && voit.finances ? attributionProduit(id, annee) : Promise.resolve(null),
    onglet === "reglementaire" && voit.reglementaire ? chargerProduitCanonique(user, id) : Promise.resolve(null),
  ]);
  // Ventes PCH (droit Ventes PCH, porté par `f.ventes`) : la chaîne des contrats, la distribution par territoire, la fraîcheur.
  const v = f.ventes;
  const [contrats, territoires, fraicheur] = onglet === "ventes" && v
    ? await Promise.all([chainesContratsPch(null, [id]), territoiresPch(v.periode, { productId: id }), fraicheurPch()])
    : [null, null, null];
  const peutImporter = userCan(user, "PCH_VENTES", "UPLOAD");
  const periodePch = v ? `${moisCourt(v.periode.debut)} → ${moisCourt(v.periode.fin)}` : "";
  const qPch = v ? `p=12m&m=${v.periode.fin}&produit=${id}` : "";

  // ── Les cinq chiffres ──
  const prescripteursAC = voit.segmentation && segmentation.length ? segmentation.reduce((s, x) => s + x.repartition.A + x.repartition.C, 0) : null;
  const investi = adpro12 ? adpro12.reduce((s, a) => s + (a.amountAllocated !== null ? toNumber(a.amountAllocated) : a.sharePct !== null && a.item.amountGranted !== null ? Math.round(toNumber(a.item.amountGranted) * toNumber(a.sharePct) / 100) : 0), 0) : null;
  const chiffres: React.ReactNode[] = [];
  // Ventes = nos réceptions à la PCH (sell-in), seul client d'Adventum : en DZD au coût PCH, et en boîtes.
  if (v) {
    chiffres.push(<Chiffre key="v" label="Ventes 12 mois"
      valeur={v.recuNous <= 0 ? "—" : v.recuValeur !== null ? montantCourt(v.recuValeur) : `${entier(v.recuNous)} bt`}
      contexte={v.sansFournisseur ? "fournisseur à régler" : [v.recuValeur !== null && v.recuNous > 0 ? `${entier(v.recuNous)} bt` : null, v.evolRecu !== null ? signe(v.evolRecu) : "sans comparaison"].filter(Boolean).join(" · ")}
      ton={v.evolRecu === null ? null : v.evolRecu >= 0 ? "ok" : "ko"} />);
    chiffres.push(<Chiffre key="m" label="Part de marché" valeur={v.partPct !== null ? `${nombre(v.partPct)} %` : "—"} contexte={v.recuMarche > 0 ? "réceptions PCH" : "aucune réception PCH"} />);
  }
  if (prescripteursAC !== null || voit.segmentation) chiffres.push(<Chiffre key="s" label="Prescripteurs A + C" valeur={prescripteursAC !== null ? String(prescripteursAC) : "—"} contexte="segmentation" />);
  if (f.stock) chiffres.push(<Chiffre key="k" label="Stock" valeur={f.stock.couvertureMois !== null ? `${nombre(f.stock.couvertureMois)} mois` : f.stock.lieux ? `${f.stock.unites.toLocaleString("fr-FR")}` : "—"} contexte={f.stock.lieux ? `${f.stock.unites.toLocaleString("fr-FR")} boîtes` : "aucun relevé"} ton={f.stock.couvertureMois !== null && f.stock.couvertureMois < 2 ? "ko" : null} />);
  if (investi !== null) chiffres.push(<Chiffre key="a" label="Investi Ad & Pro" valeur={montantCourt(investi)} contexte="12 mois" />);

  // ── À surveiller : ce que la fiche calcule, plus les AO attribués ──
  const aSurveiller: ASurveiller[] = f.aSurveiller.map((s) => ({ ...s, href: s.href?.startsWith("?") ? `/produits/${id}${s.href}` : s.href }));
  if (voit.marches && p360) {
    for (const m of p360.marches.filter((x) => x.statut === "WON").slice(0, 2)) {
      aSurveiller.push({ ton: "info", titre: `AO ${m.marche} attribué`, detail: `${m.quantiteUnites.toLocaleString("fr-FR")} unités${m.prixAttributionDzd !== null ? ` · ${dzd(m.prixAttributionDzd)}/u` : ""}`, href: `/pch/${m.marcheId}` });
    }
  }

  const sousTitre = [`DCI ${f.identite.dci}`, f.identite.dosage, f.identite.forme?.toLowerCase(), f.identite.conditionnement, f.identite.societe].filter(Boolean).join(" · ");
  const lienOnglet = (o: Onglet) => (o === "vue" ? `/produits/${id}` : `/produits/${id}?onglet=${o}`);

  return (
    <div className="space-y-4">
      <BackLink href="/produits"><ArrowLeft className="h-4 w-4" /> Produits 360</BackLink>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-lg font-bold text-primary">{f.identite.nom.trim().charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <h1 className="break-words text-lg font-semibold sm:text-xl">{f.identite.nom}</h1>
              <p className="text-sm text-muted-foreground">{sousTitre}</p>
              {f.bus.length > 0 && (
                <p className="text-xs text-muted-foreground">BU : {f.bus.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link href={`/business-units/${b.id}`} className="hover:underline">{b.nom}</Link></span>)} · <span className="font-mono">{f.identite.code}</span></p>
              )}
            </div>
          </div>
          <FriseCycle etape={f.identite.etape} />
        </div>
        {chiffres.length > 0 && (
          <div className={`grid grid-cols-2 border-t border-border ${chiffres.length >= 5 ? "lg:grid-cols-5" : chiffres.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>{chiffres}</div>
        )}
        <div className="px-2">
          <Onglets label="Facettes du produit" actif={onglet} items={visibles.map((o) => ({ cle: o.cle, label: o.label, href: lienOnglet(o.cle) }))} />
        </div>

        <div className="space-y-4 p-4">
          {onglet === "vue" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              {v ? (
                <Carte titre="Réceptions PCH et distribution" sousTitre={`${periodePch} · boîtes`}>
                  <BarresMensuelles mois={v.mois} sellIn={v.sellIn} sellOut={v.sellOut} />
                </Carte>
              ) : (
                <Carte titre="Identité">
                  <Dl items={[["DCI", f.identite.dci], ["Dosage", f.identite.dosage], ["Forme", f.identite.forme], ["Conditionnement", f.identite.conditionnement], ["Code", f.identite.code], ["Alias", f.identite.alias.join(", ") || "—"]]} />
                </Carte>
              )}
              <Carte titre="À surveiller"><ListeSurveiller items={aSurveiller} /></Carte>
            </div>
          )}

          {onglet === "ventes" && (
            <>
              {v && contrats && territoires && (v.recuMarche + v.distribue + v.nonServi === 0 && contrats.length === 0 ? (
                <Carte titre="Ventes PCH">
                  <Vide>Aucune donnée PCH pour ce produit sur {periodePch}.{peutImporter && <> <Link href="/sales/importer" className="text-primary hover:underline">Importer des fichiers</Link></>}</Vide>
                </Carte>
              ) : (
                <>
                  <Carte titre="Réceptions PCH et distribution" sousTitre={<>{periodePch} · boîtes <InfoBulle>Nos réceptions = les réceptions fournisseur (FO) de la PCH centrale venant de nos fournisseurs : nos ventes (sell-in), valorisées au coût d&apos;achat PCH. Distribution = ce que les directions régionales ont livré aux hôpitaux, toutes origines (sell-out).</InfoBulle></>}
                    action={<Link href={`/sales?p=12m&m=${v.periode.fin}`} className="text-primary hover:underline">Ventes PCH</Link>}>
                    <Dl items={[
                      ["Nos réceptions", `${entier(v.recuNous)} boîtes${v.recuValeur !== null ? ` · ${dzd(v.recuValeur)}` : ""}`],
                      ["12 mois précédents", `${entier(v.recuNousPrecedent)} boîtes${v.evolRecu !== null ? ` · ${signe(v.evolRecu)}` : ""}`],
                      ["Distribuées aux hôpitaux", `${entier(v.distribue)} boîtes`],
                    ]} />
                    {v.sansFournisseur && <p className="border-t border-border px-4 py-2 text-xs text-warning">Aucun fournisseur « à nous » réglé : nos réceptions ne se lisent pas.{userCan(user, "PCH_VENTES", "UPDATE") && <> <Link href="/sales/importer" className="underline">Régler</Link></>}</p>}
                    <div className="border-t border-border"><BarresMensuelles mois={v.mois} sellIn={v.sellIn} sellOut={v.sellOut} /></div>
                  </Carte>

                  <Carte titre="Contrats PCH" sousTitre={<>unités du marché <InfoBulle>Attribué : les lignes du contrat (avenants compris), à défaut la quantité gagnée à l&apos;appel d&apos;offres. BC cumulés : les bons de commande de la PCH, hors annulés. Livré : les bons de livraison datés. Barre : clair = commandé, foncé = livré, orange = au-delà de l&apos;attribué.</InfoBulle></>}
                    action={<Link href="/sales/contrats" className="text-primary hover:underline">Tous les contrats</Link>}>
                    {contrats.length === 0 ? <Vide>Aucun marché gagné ni contrat.</Vide> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>
                            <th className={`sticky left-0 bg-card ${TH}`}>Marché · contrat</th><th className={TH}>Avancement</th>
                            <th className={`${TH} text-right`}>Attribué</th><th className={`${TH} text-right`}>BC cumulés</th><th className={`${TH} text-right`}>Livré</th><th className={`${TH} text-right`}>Reste</th>
                          </tr></thead>
                          <tbody>{[...contrats].sort((a, b) => Number(b.chaine.reste > 0) - Number(a.chaine.reste > 0)).map((c) => (
                            <tr key={c.cle} className="border-t border-border/60">
                              <td className="sticky left-0 max-w-[14rem] bg-card px-3 py-2">
                                <span className="block truncate">{c.marche ? (voit.marches ? <Link href={`/pch/${c.marche.id}`} className="text-primary hover:underline">{c.marche.reference}</Link> : c.marche.reference) : "—"}</span>
                                <small className="block truncate text-xs text-muted-foreground">{c.contrat ? [c.contrat.reference, c.contrat.titre].filter(Boolean).join(" · ") : "sans contrat"}</small>
                              </td>
                              <td className="px-3 py-2">
                                <BarreContrat attribue={c.chaine.attribue} commande={c.chaine.commande} livre={c.chaine.livre} className="w-28" />
                                <small className="mt-1 block whitespace-nowrap text-xs text-muted-foreground">{c.chaine.pctCommande !== null ? `${nombre(c.chaine.pctCommande)} % commandé` : "attribué inconnu"} · {c.bcs} BC</small>
                              </td>
                              <td className={TD}>{entier(c.chaine.attribue)}</td>
                              <td className={TD}>{entier(c.chaine.commande)}{c.chaine.avenant && <> <Pastille ton="warning">avenant{c.bcAvenants ? ` · ${c.bcAvenants} BC` : ""}</Pastille></>}</td>
                              <td className={TD}>{entier(c.chaine.livre)}</td>
                              <td className={TD}>{c.chaine.depassement > 0 ? <span className="text-warning">+{entier(c.chaine.depassement)}</span> : entier(c.chaine.reste)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                  </Carte>

                  <Carte titre="Distribution hospitalière" sousTitre={`${periodePch} · boîtes`} action={<Link href={`/sales/territoires?${qPch}`} className="text-primary hover:underline">Territoires</Link>}>
                    {v.nonServi > 0 && (
                      <p className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm">
                        <span>Demande non servie : <b className="font-medium text-warning">{entier(v.nonServi)} boîtes</b> · {v.etablissementsNonServis} établissement{v.etablissementsNonServis > 1 ? "s" : ""}</span>
                        <Link href={`/sales/non-servi?${qPch}`} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Voir</Link>
                      </p>
                    )}
                    {territoires.etablissements.length === 0 ? <Vide>Aucune distribution aux hôpitaux sur la période.</Vide> : (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                          {([["Direction régionale", territoires.parDr], ["Wilaya", territoires.parWilaya.slice(0, 12)]] as const).map(([titre, lignes]) => (
                            <div key={titre} className="overflow-x-auto border-border lg:odd:border-r">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className={`sticky left-0 bg-card ${TH}`}>{titre}</th><th className={`${TH} text-right`}>Livré</th><th className={`${TH} text-right`}>Non servi</th><th className={`${TH} text-right`}>Étab.</th></tr></thead>
                                <tbody>{lignes.map((t) => (
                                  <tr key={t.cle} className="border-t border-border/60"><td className="sticky left-0 max-w-[12rem] truncate bg-card px-3 py-2">{t.libelle}</td><td className={TD}>{entier(t.livre)}</td><td className={TD}>{t.nonServi > 0 ? <span className="text-warning">{entier(t.nonServi)}</span> : "—"}</td><td className={TD}>{t.etablissements}</td></tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                        <div className="overflow-x-auto border-t border-border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className={`sticky left-0 bg-card ${TH}`}>Établissement</th><th className={TH}>Wilaya</th><th className={TH}>DR</th><th className={`${TH} text-right`}>Livré</th><th className={`${TH} text-right`}>Non servi</th></tr></thead>
                            <tbody>{territoires.etablissements.slice(0, 10).map((e) => (
                              <tr key={`${e.dr}|${e.cle}`} className="border-t border-border/60">
                                <td className="sticky left-0 max-w-[16rem] truncate bg-card px-3 py-2"><Link href={`/sales/territoires?${qPch}&etab=${encodeURIComponent(e.cle)}`} className="hover:underline">{e.nom}</Link></td>
                                <td className="whitespace-nowrap px-3 py-2">{e.wilaya ?? "—"}</td><td className="whitespace-nowrap px-3 py-2">{e.dr}</td>
                                <td className={TD}>{entier(e.livre)}</td><td className={TD}>{e.nonServi > 0 ? <span className="text-warning">{entier(e.nonServi)}</span> : "—"}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Carte>
                </>
              ))}

              {voit.marches && p360 && (
                <Carte titre="Appels d'offres → marchés" sousTitre={COUVERTURE_LABELS[p360.rattachement.couverture]}>
                  {p360.rattachement.anomalies.map((a, i) => <p key={i} className="border-b border-border px-4 py-2 text-xs text-warning">{a.message}</p>)}
                  {p360.rattachement.marche && (
                    <p className="border-b border-border px-4 py-2 text-sm">Marché : <Link href={`/legal/${p360.rattachement.marche.contratId}`} className="text-primary hover:underline">{p360.rattachement.marche.contratReference ?? p360.rattachement.marche.contratTitre}</Link></p>
                  )}
                  {p360.marches.length === 0 ? <Vide>Nommé dans aucun appel d&apos;offres.</Vide> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="sticky left-0 bg-card px-3 py-2 font-medium">Appel d&apos;offres</th><th className="px-3 py-2 font-medium">Ligne</th><th className="px-3 py-2 font-medium">Statut</th><th className="px-3 py-2 text-right font-medium">Unités</th><th className="px-3 py-2 text-right font-medium">Prix attribué</th></tr></thead>
                        <tbody>{p360.marches.slice(0, 15).map((m) => (
                          <tr key={m.ligneId} className="border-t border-border/60">
                            <td className="sticky left-0 max-w-[14rem] truncate bg-card px-3 py-2"><Link href={`/pch/${m.marcheId}`} className="text-primary hover:underline">{m.marche}</Link></td>
                            <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">{m.designation}</td>
                            <td className="whitespace-nowrap px-3 py-2">{PCH_LINE_STATUS[m.statut]?.label ?? m.statut}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.quantiteUnites.toLocaleString("fr-FR")}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m.prixAttributionDzd !== null ? dzd(m.prixAttributionDzd) : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </Carte>
              )}

              {consommation && (
                <Carte titre="Consommation hospitalière" action={<Link href={`/consommation/affinite?p=${id}`} className="text-primary hover:underline">Affinité</Link>}>
                  {consommation.parEtablissement.length === 0 ? <Vide>Aucune consommation validée.</Vide> : (
                    <ul className="divide-y divide-border text-sm">
                      {consommation.parEtablissement.slice(0, 10).map((c) => (
                        <li key={`${c.institutionId}${c.unite}`} className="flex justify-between gap-3 px-4 py-2"><span className="min-w-0 truncate">{c.nom}</span><span className="whitespace-nowrap tabular-nums text-muted-foreground">{c.quantite.toLocaleString("fr-FR")} {c.unite?.toLowerCase() ?? ""}{c.affinite !== null ? ` · affinité ${pct(c.affinite)}` : ""}</span></li>
                      ))}
                    </ul>
                  )}
                </Carte>
              )}

              {(v || f.voitMarche) && (
                <Carte titre="Marché" sousTitre={v ? <>réceptions FO de la PCH · {periodePch} <InfoBulle>Toutes les réceptions fournisseur (FO) de la PCH centrale sur les postes de ce produit : même molécule, dosage et forme. Nos fournisseurs en vert ; ils se règlent dans Ventes PCH → Importer.</InfoBulle></> : null}>
                  {v && (v.fournisseurs.length === 0 ? <Vide>Aucune réception FO sur la période.</Vide> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className={`sticky left-0 bg-card ${TH}`}>Fournisseur</th><th className={`${TH} text-right`}>Quantité</th><th className={`${TH} text-right`}>Part</th></tr></thead>
                        <tbody>{v.fournisseurs.slice(0, 15).map((x) => (
                          <tr key={x.fournisseur} className={`border-t border-border/60 ${x.nous ? "bg-success/5" : ""}`}>
                            <td className={`sticky left-0 max-w-[16rem] truncate px-3 py-2 ${x.nous ? "bg-card font-semibold text-success" : "bg-card"}`}>{x.fournisseur}</td>
                            <td className={TD}>{entier(x.qte)}</td>
                            <td className={TD}>{x.partPct !== null ? `${nombre(x.partPct)} %` : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ))}
                  {f.voitMarche && (f.marche ? (
                    <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                      IQVIA ville + hôpital ({f.marche.source.periode}, {LIBELLE_PERIMETRE[f.marche.perimetre]}) : notre part {f.marche.partPct !== null ? `${nombre(f.marche.partPct)} %` : "non identifiée"} · marché {dzd(f.marche.totalDzd)}
                    </p>
                  ) : !v && <Vide>Molécule absente des données de marché.</Vide>)}
                  {f.voitMarche && f.marche && f.marche.generiquesRecents.length > 0 && (
                    <div className="border-t border-border px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Enregistrés depuis moins d&apos;un an</p>
                      {f.marche.generiquesRecents.map((g, i) => <p key={i}>{g.lab} · {g.marque} · <span className="text-muted-foreground">{jour(g.date)} · {g.origine.toLowerCase()}</span></p>)}
                    </div>
                  )}
                </Carte>
              )}

              {fraicheur && (
                <p className="text-xs text-muted-foreground">
                  Données PCH : {fraicheur.sources.filter((s) => s.source !== SOURCE_RECEPTIONS).map((s) => `${s.source} ${s.dernier ? moisCourt(s.dernier) : "—"}`).join(" · ") || "aucune DR"}
                  {(() => { const r = fraicheur.sources.find((s) => s.source === SOURCE_RECEPTIONS); return r ? ` · réceptions ${r.dernier ? `jusqu'à ${moisCourt(r.dernier)}` : "—"}${r.manquants.length ? ` (${r.manquants.length} mois manquant${r.manquants.length > 1 ? "s" : ""})` : ""}` : ""; })()}
                  {peutImporter && <> · <Link href="/sales/importer" className="text-primary hover:underline">Importer</Link></>}
                </p>
              )}

              <Carte titre="Prix" sousTitre={<InfoBulle>L&apos;Explorateur produits donne le prix observé (IQVIA ville : valeur ÷ boîtes ; réceptions PCH : prix unitaire). Une saisie l&apos;emporte à partir de sa date d&apos;effet ; l&apos;historique garde chaque ligne.</InfoBulle>}>
                <PrixProduit productId={id} prix={f.prix} historique={f.historiquePrix} peutModifier={peutModifierLesPrix(user)} />
              </Carte>
            </>
          )}

          {onglet === "terrain" && (
            <>
              {voit.forceDeVente && p360 && (
                <Carte titre="Qui le porte" sousTitre={`${p360.portefeuille.filter((x) => x.enCours).length} en cours`}>
                  {p360.portefeuille.filter((x) => x.enCours).length === 0 ? <Vide>Personne ne porte ce produit actuellement.</Vide> : (
                    <ul className="divide-y divide-border text-sm">
                      {p360.portefeuille.filter((x) => x.enCours).map((a, i) => (
                        <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-2"><span>{a.personne} <span className="text-muted-foreground">· {ROLES[a.role] ?? a.role}{a.territoire ? ` · ${a.territoire}` : ""}</span></span><span className="text-xs text-muted-foreground">{a.quotitePct !== null ? `${nombre(a.quotitePct)} % · ` : ""}depuis le {jour(a.depuis)}</span></li>
                      ))}
                    </ul>
                  )}
                </Carte>
              )}

              {voit.segmentation && (
                <Carte titre="Segmentation" action={<Link href="/segmentation" className="text-primary hover:underline">Studio</Link>}>
                  {segmentation.length === 0 ? <Vide>Classé dans aucune stratégie active.</Vide> : (
                    <ul className="divide-y divide-border text-sm">
                      {segmentation.map((s) => {
                        const total = (["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).reduce((t, k) => t + s.repartition[k], 0) || 1;
                        return (
                          <li key={s.strategieId} className="space-y-1.5 px-4 py-2.5">
                            <p><Link href={`/segmentation?s=${s.strategieId}`} className="font-medium text-primary hover:underline">{s.strategie}</Link> <span className="text-xs text-muted-foreground">· BU {s.businessUnit} · produit n°{s.rang} · {s.h} décideur(s) H</span></p>
                            <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                              {(["A", "B", "C", "D"] as const).map((k, i) => <i key={k} className="block h-full bg-primary" style={{ width: `${(s.repartition[k] / total) * 100}%`, opacity: 1 - i * 0.2 }} />)}
                            </div>
                            <p className="text-xs text-muted-foreground">{(["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).map((k) => `${ETAT_LABELS[k]} ${s.repartition[k]}`).join(" · ")}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Carte>
              )}

              {f.messages && (
                <Carte titre="Messages" sousTitre={`${f.messages.filter((m) => m.actif).length} actif(s)`}>
                  {f.messages.length === 0 ? <Vide>Aucun message pré-défini pour ce produit.</Vide> : (
                    <ul className="divide-y divide-border text-sm">{f.messages.map((m) => <li key={m.id} className={`px-4 py-2 ${m.actif ? "" : "text-muted-foreground line-through"}`}>{m.titre}</li>)}</ul>
                  )}
                </Carte>
              )}

              {voit.terrain && p360 && (
                <Carte titre="Activité terrain" sousTitre={`${p360.terrain.nombreDeVisites} visite(s)${p360.terrain.derniereVisite ? ` · dernière le ${jour(p360.terrain.derniereVisite)}` : ""}`}>
                  {p360.terrain.parDelegue.length === 0 ? <Vide>Présenté dans aucune visite.</Vide> : (
                    <ul className="divide-y divide-border text-sm">{p360.terrain.parDelegue.slice(0, 10).map((d) => <li key={d.delegue} className="flex justify-between px-4 py-2"><span>{d.delegue}</span><span className="tabular-nums text-muted-foreground">{d.visites}</span></li>)}</ul>
                  )}
                </Carte>
              )}

              {voit.adpro && p360 && (
                <Carte titre="Investissement Ad & Pro" sousTitre={`${dzd(p360.investissementAdPro.montantImputeDzd)} imputés · ${p360.investissementAdPro.nombreDePostes} poste(s)`}>
                  {p360.investissementAdPro.detail.length === 0 ? <Vide>Aucune dépense imputée à ce produit.</Vide> : (
                    <ul className="divide-y divide-border text-sm">{p360.investissementAdPro.detail.slice(0, 12).map((a) => (
                      <li key={a.itemId} className="flex flex-wrap justify-between gap-2 px-4 py-2"><span className="min-w-0 truncate">{a.poste}</span><span className="whitespace-nowrap tabular-nums text-muted-foreground">{a.partPct !== null ? `${nombre(a.partPct)} % · ` : ""}{a.montantDzd !== null ? dzd(a.montantDzd) : "part non saisie"}</span></li>
                    ))}</ul>
                  )}
                  {p360.investissementAdPro.postesSansPart > 0 && <p className="border-t border-border px-4 py-2 text-xs text-warning">{p360.investissementAdPro.postesSansPart} imputation(s) sans part ni montant : non comptée(s).</p>}
                </Carte>
              )}

              {f.materiel && (
                <Carte titre="Matériel promotionnel" sousTitre={`${f.materiel.filter((m) => m.actif).length} article(s) actif(s)`}>
                  {f.materiel.length === 0 ? <Vide>Aucun matériel promotionnel pour ce produit.</Vide> : (
                    <ul className="divide-y divide-border text-sm">{f.materiel.map((m) => <li key={m.id} className={`px-4 py-2 ${m.actif ? "" : "text-muted-foreground"}`}>{m.nom}</li>)}</ul>
                  )}
                </Carte>
              )}
            </>
          )}

          {onglet === "reglementaire" && (
            <>
              {voit.reglementaire && (f.dossiers.length === 0 ? <Carte titre="Dossier réglementaire"><Vide>Aucun dossier visible.</Vide></Carte> : f.dossiers.map((d) => (
                <Carte key={d.id} titre={`Dossier ${d.reference}`} sousTitre={<Pastille ton={REGULATORY_STATUS[d.statut]?.tone === "success" ? "success" : REGULATORY_STATUS[d.statut]?.tone === "danger" ? "danger" : "info"}>{REGULATORY_STATUS[d.statut]?.label ?? d.statut}</Pastille>} action={<Link href={`/regulatory/${d.id}`} className="text-primary hover:underline">Ouvrir le dossier</Link>}>
                  <Dl items={[
                    ["Nom commercial", d.nomCommercial],
                    ["Détenteur de la DE", d.detenteurDe],
                    ["Décision d'enregistrement", d.dateDecision ? jour(d.dateDecision) : d.statut === "DECISION_OBTAINED" ? "date non renseignée" : "—"],
                    ["Renouvellement", d.echeance ? `dépôt avant le ${jour(d.echeance.depotAvant)} · expire le ${jour(d.echeance.expiration)}` : "—"],
                    ["Cible d'enregistrement", d.cibleEnregistrement ? jour(d.cibleEnregistrement) : "—"],
                    ["Laboratoire partenaire", d.laboPartenaire],
                    ["Classe thérapeutique", d.classeTherapeutique],
                    ["Fabrication", `${MANUFACTURING_STATUS[d.statutFabrication] ?? d.statutFabrication}${d.fabricant ? ` · ${d.fabricant}` : ""}`],
                  ]} />
                  {d.variations.length > 0 && (
                    <div className="border-t border-border px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Variations</p>
                      {d.variations.map((v) => <p key={v.id}>{MANUFACTURING_STATUS[v.vers] ?? v.vers} · {VARIATION_STATUS[v.statut]?.label ?? v.statut}{v.depot ? ` · déposée le ${jour(v.depot)}` : ""}{v.decision ? ` · décision le ${jour(v.decision)}` : ""}</p>)}
                    </div>
                  )}
                  {d.demandesInfoMed.length > 0 && (
                    <div className="border-t border-border px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Information médicale — demandes</p>
                      {d.demandesInfoMed.map((r) => <p key={r.id}><span className="font-mono text-xs text-muted-foreground">{r.reference}</span> {r.sujet} · <span className="text-muted-foreground">{REG_REQUEST_STATUS[r.statut]?.label ?? r.statut}</span></p>)}
                    </div>
                  )}
                </Carte>
              )))}
              {voit.reglementaire && f.dossiersMasques > 0 && <p className="text-xs text-muted-foreground">{f.dossiersMasques} autre(s) dossier(s) hors de votre portée.</p>}

              {f.pv && (
                <Carte titre="Pharmacovigilance" sousTitre={`${f.pv.filter((c) => c.statut !== "CLOS").length} ouvert(s)`}>
                  {f.pv.length === 0 ? <Vide>Aucun cas signalé.</Vide> : (
                    <ul className="divide-y divide-border text-sm">{f.pv.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                        <span><Link href={c.href} className="font-mono text-xs text-primary hover:underline">{c.reference}</Link> <span className="text-muted-foreground">· survenu le {jour(c.survenu)}{c.gravite && estGravitePv(c.gravite) ? ` · ${GRAVITE_PV[c.gravite].label.toLowerCase()}` : ""}</span></span>
                        {estStatutPv(c.statut) && <Pastille ton={c.statut === "CLOS" ? "neutral" : "warning"}>{STATUT_PV[c.statut].label}</Pastille>}
                      </li>
                    ))}</ul>
                  )}
                </Carte>
              )}

              {canonique && (
                <Carte titre="Identité, alias et historique" sousTitre={<InfoBulle>L&apos;identité (DCI, dosage, forme, conditionnement) se corrige sur le dossier : le produit suit. Ici se règlent le nom et les alias — un alias retrouve le produit juste après sa référence.</InfoBulle>}>
                  <Dl items={[["DCI", canonique.dci], ["Dosage", f.identite.dosage], ["Forme", f.identite.forme], ["Conditionnement", canonique.packaging], ["Code", canonique.code], ["Profils BU", canonique.produitsBu.map((b) => b.bu ? `${b.name} (${b.bu})` : b.name).join(", ") || "—"]]} />
                  <div className="space-y-3 border-t border-border px-4 py-3">
                    {userCan(user, "REGULATORY", "UPDATE") ? (
                      <>
                        <RenommerProduit id={canonique.id} nom={canonique.canonicalName} />
                        <AliasProduit id={canonique.id} aliases={canonique.aliases.map((a) => ({ id: a.id, label: a.label }))} />
                      </>
                    ) : <p className="text-sm">Alias : {canonique.aliases.map((a) => a.label).join(", ") || "aucun"}</p>}
                  </div>
                  {canonique.historique.length > 0 && (
                    <details className="border-t border-border">
                      <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground">Historique ({canonique.historique.length})</summary>
                      <ul className="divide-y divide-border px-4 pb-2 text-sm">{canonique.historique.map((h) => <li key={h.id} className="py-1.5">{h.summary}<span className="block text-xs text-muted-foreground">{h.createdAt.toLocaleDateString("fr-FR")}{h.acteur ? ` · ${h.acteur}` : ""}</span></li>)}</ul>
                    </details>
                  )}
                </Carte>
              )}
            </>
          )}

          {onglet === "stock" && f.stock && (
            <Carte titre="Stock" sousTitre={<>{f.stock.date ? `dernier relevé le ${jour(f.stock.date)}` : "aucun relevé"} <InfoBulle>Le stock d&apos;un produit = le dernier relevé de chaque lieu (PCH, hôpitaux, annexes) de ses dossiers, dans votre portée. Couverture = stock ÷ écoulement mensuel : la distribution aux hôpitaux par les DR de la PCH (moyenne des 3 derniers mois reçus), à défaut les ventes saisies ou la consommation hospitalière en boîtes.</InfoBulle></>} action={<Link href="/stocks" className="text-primary hover:underline">Stocks</Link>}>
              <Dl items={[
                ["Niveau actuel", `${f.stock.unites.toLocaleString("fr-FR")} boîtes · ${f.stock.lieux} lieu(x)`],
                ["Couverture", f.stock.couvertureMois !== null ? `${nombre(f.stock.couvertureMois)} mois` : "—"],
                ["Écoulement mensuel", f.stock.ecoulementMensuel !== null ? `${f.stock.ecoulementMensuel.toLocaleString("fr-FR")} boîtes · ${f.stock.sourceEcoulement === "PCH" ? "distribution PCH" : f.stock.sourceEcoulement === "VENTES" ? "ventes" : "consommation"}` : "—"],
              ]} />
              {f.stock.releves.length > 0 && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="sticky left-0 bg-card px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Lieu</th><th className="px-3 py-2 font-medium">Portée</th><th className="px-3 py-2 text-right font-medium">Quantité</th></tr></thead>
                    <tbody>{f.stock.releves.map((r) => (
                      <tr key={r.id} className="border-t border-border/60"><td className="sticky left-0 whitespace-nowrap bg-card px-3 py-2">{jour(r.date)}</td><td className="whitespace-nowrap px-3 py-2">{r.lieu}</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{r.portee}</td><td className="px-3 py-2 text-right tabular-nums">{r.quantite.toLocaleString("fr-FR")}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Carte>
          )}

          {onglet === "couts" && attribution && (
            <CoutsProduit id={id} annee={annee} attribution={attribution} peutRepartir={userCan(user, "FINANCES", "VALIDATE")} bus={f.bus} />
          )}

          {onglet === "documents" && (
            <>
              {await Promise.all(f.dossiers.map(async (d, i) => (
                <Carte key={d.id} titre={`Fichiers — ${d.reference}`}>
                  <div className="p-4">
                    <ProductDriveExplorer user={user} rootId={await dossierDriveAffiche({ id: d.id, reference: d.reference, dci: f.identite.dci })}
                      folderId={i === 0 ? searchParams?.dossier ?? null : null} basePath={`/produits/${id}`} canEdit={userCan(user, "REGULATORY", "UPDATE")} />
                  </div>
                </Carte>
              )))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Les coûts attribués (direct, alloué, non alloué) et la répartition des coûts partagés de chaque BU — l'existant. */
async function CoutsProduit({ id, annee, attribution, peutRepartir, bus }: {
  id: string; annee: number; attribution: NonNullable<Awaited<ReturnType<typeof attributionProduit>>>; peutRepartir: boolean; bus: { id: string; nom: string }[];
}) {
  const repartitions = peutRepartir && bus.length
    ? await Promise.all(bus.map(async (b) => ({
        id: b.id, nom: b.nom,
        produits: (await prisma.promoProduct.findMany({ where: { businessUnitId: b.id, productId: { not: null } }, select: { productId: true, canonicalProduct: { select: { canonicalName: true } } } }))
          .filter((x, i, a) => a.findIndex((y) => y.productId === x.productId) === i).map((x) => ({ productId: x.productId!, nom: x.canonicalProduct?.canonicalName ?? x.productId! })),
        parts: Object.fromEntries((await prisma.coutRepartitionBu.findMany({ where: { businessUnitId: b.id, annee }, select: { productId: true, pct: true } })).map((r) => [r.productId, String(Number(r.pct))])),
      })))
    : [];
  return (
    <Carte titre={`Coûts attribués — ${annee}`} action={
      <span className="flex gap-1">{[annee - 1, annee, annee + 1].map((a) => <Link key={a} href={`/produits/${id}?onglet=couts&annee=${a}`} className={`rounded-md border px-2 py-0.5 ${a === annee ? "border-primary text-primary" : "border-border"}`}>{a}</Link>)}</span>
    }>
      <Dl items={[
        ["Coûts directs", dzd(attribution.direct)],
        ["Coûts alloués", dzd(attribution.alloue)],
        ["Total attribué", dzd(attribution.attribue)],
        ["Non alloué (BU)", dzd(attribution.nonAlloueBu)],
      ]} />
      {attribution.lignes.length > 0 && (
        <ul className="divide-y divide-border border-t border-border text-sm">{attribution.lignes.map((l) => (
          <li key={`${l.itemId}${l.nature}`} className="flex flex-wrap justify-between gap-2 px-4 py-2"><span className="min-w-0">{l.nature === "DIRECT" ? "Direct" : "Alloué"} · {l.libelle} <span className="text-xs text-muted-foreground">{l.detail}</span></span><span className="whitespace-nowrap tabular-nums">{dzd(l.montant)}</span></li>
        ))}</ul>
      )}
      {attribution.limites.map((l, i) => <p key={i} className="border-t border-border px-4 py-2 text-xs text-warning">{l}</p>)}
      {repartitions.length > 0 && <div className="px-4 pb-3">{repartitions.map((r) => <RepartitionBu key={r.id} businessUnitId={r.id} nom={r.nom} annee={annee} produits={r.produits} parts={r.parts} />)}</div>}
    </Carte>
  );
}
