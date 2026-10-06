import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan, clausePanelDuKam } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { chargerStrategie, chargerPanel } from "@/lib/segmentation/service";
import { synthese } from "@/lib/segmentation/moteur";
import { ETAT_LABELS } from "@/lib/segmentation/regles";
import { CreerStrategie } from "./creer-strategie";
import { Panel, type LigneVue } from "./panel";
import { EditeurRegles } from "./regles-editeur";
import { ImportClasseur } from "./import-classeur";
import { ClassementProduits } from "./classement-produits";
import { SpecialitesProduits } from "./specialites-produits";
import { CyclesVue } from "./cycles-vue";
import { chargerCycle } from "@/lib/segmentation/cycle-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Segmentation Studio — AMD Internal OS" };

const VUES = [
  { cle: "panel", label: "Praticiens" },
  { cle: "cycles", label: "Cycles" },
  { cle: "regles", label: "Règles" },
  { cle: "import", label: "Import" },
  { cle: "historique", label: "Historique" },
] as const;

/**
 * SEGMENTATION STUDIO — la segmentation de la force de vente, native et reliée (Direction, 06/10).
 *
 * Une stratégie par BU, au plus trois produits CANONIQUES classés, des règles VERSIONNÉES. Les praticiens sont ceux
 * de l'annuaire ; leur segment A/B/C/D se CALCULE (moteur déterministe) depuis leur potentiel terrain historisé et les
 * règles en vigueur, et chaque résultat dit POURQUOI. Une dérogation reste possible, motivée et levable.
 *
 * Portée : le KAM (portée « ses lignes ») ne voit que son panel ; les gestes suivent le module SEGMENTATION.
 */
export default async function SegmentationPage({ searchParams }: { searchParams?: { s?: string; vue?: string; spe?: string; cycle?: string; bu?: string } }) {
  const user = await requireModule("SEGMENTATION");
  const peutValider = userCan(user, "SEGMENTATION", "VALIDATE");
  const peutModifier = userCan(user, "SEGMENTATION", "UPDATE");
  const peutDeroger = userCan(user, "SEGMENTATION", "CREATE");
  const portee = user.access.modules.get("SEGMENTATION")?.scope === "ALL" ? {} : clausePanelDuKam(user.id);

  // UNE PORTE DE VÉRITÉ (Direction, 06/10) : les BU sont celles de la FORCE DE VENTE, et chacune a AU PLUS une stratégie
  // active — on ne « crée » ni BU ni stratégie ici. Les produits classables sont ceux du CATALOGUE de la BU (Force de
  // vente › Business Units), jamais une liste parallèle.
  const bus = await prisma.businessUnit.findMany({
    where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true,
      segmentationStrategies: { where: { statut: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
      products: { where: { isActive: true, productId: { not: null } }, select: { productId: true, canonicalProduct: { select: { canonicalName: true, dci: true } } } },
    },
  });
  const catalogue = (buId: string) => {
    const b = bus.find((x) => x.id === buId);
    const vus = new Set<string>();
    return (b?.products ?? []).filter((p) => p.productId && !vus.has(p.productId) && vus.add(p.productId)).map((p) => ({ id: p.productId!, nom: p.canonicalProduct?.canonicalName ?? p.productId!, dci: p.canonicalProduct?.dci ?? "" }));
  };
  const strategieDe = (b: (typeof bus)[number]) => b.segmentationStrategies[0]?.id ?? null;
  const parStrategie = searchParams?.s ? bus.find((b) => strategieDe(b) === searchParams.s) : undefined;
  const buChoisie = parStrategie ?? bus.find((b) => b.id === searchParams?.bu) ?? bus.find((b) => strategieDe(b)) ?? bus[0] ?? null;
  const vue = VUES.some((v) => v.cle === searchParams?.vue) ? (searchParams!.vue as (typeof VUES)[number]["cle"]) : "panel";
  const barreBu = (
    <div className="flex flex-wrap gap-1 text-xs">
      {bus.map((b) => (
        <Link key={b.id} href={strategieDe(b) ? `/segmentation?s=${strategieDe(b)}` : `/segmentation?bu=${b.id}`}
          className={`rounded-md border px-3 py-2 sm:px-2 sm:py-1 ${b.id === buChoisie?.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {b.name}{strategieDe(b) ? "" : " · à activer"}
        </Link>
      ))}
    </div>
  );

  if (!buChoisie) {
    return (
      <div className="space-y-5">
        <PageHeader title="Segmentation Studio" description="La segmentation de la force de vente, reliée à la BU, aux produits et à l'annuaire." />
        <p className="surface p-5 text-sm text-muted-foreground">Aucune Business Unit active : elles se créent dans <Link href="/planning/business-units" className="text-primary underline">Force de vente › Business Units</Link>.</p>
      </div>
    );
  }
  const choisieId = strategieDe(buChoisie);
  if (!choisieId) {
    return (
      <div className="space-y-5">
        <PageHeader title={`Segmentation — BU ${buChoisie.name}`} description="La segmentation de la force de vente, reliée à la BU, aux produits et à l'annuaire." />
        {barreBu}
        {peutValider ? (
          <CreerStrategie bu={{ id: buChoisie.id, nom: buChoisie.name }} produits={catalogue(buChoisie.id)} />
        ) : (
          <p className="surface p-5 text-sm text-muted-foreground">La segmentation de cette BU n&apos;est pas encore activée. La Direction ou le directeur des opérations l&apos;active ici.</p>
        )}
      </div>
    );
  }
  const produits = catalogue(buChoisie.id);

  const strategie = (await chargerStrategie(choisieId))!;
  const panelComplet = await chargerPanel(strategie, portee);
  // COCKPIT MULTI-SPÉCIALITÉ (§57) : toutes, ou une spécialité de la BU — les mêmes indicateurs, filtrés.
  const specialitesBu = await prisma.businessUnitSpecialty.findMany({
    where: { businessUnitId: strategie.businessUnit.id }, orderBy: [{ principale: "desc" }, { specialty: { name: "asc" } }],
    select: { specialtyId: true, principale: true, specialty: { select: { name: true } } },
  });
  const spe = specialitesBu.some((x) => x.specialtyId === searchParams?.spe) ? searchParams!.spe! : null;
  const panel = spe ? panelComplet.filter((l) => l.specialiteId === spe) : panelComplet;
  const regles = strategie.regle?.regles ?? null;
  const s = synthese(panel.flatMap((l) => (l.resultat ? [l.resultat] : [])));
  const doctorIds = panel.map((l) => l.doctorId);
  const [derogations, observations, versions, imports] = await Promise.all([
    prisma.segmentationDerogation.findMany({
      where: { strategieId: strategie.id, leveeLe: null, doctorId: { in: doctorIds } },
      select: { id: true, doctorId: true, nature: true, productId: true, valeur: true, valeurCalculee: true, motif: true, expireLe: true, source: true, creeLe: true },
    }),
    prisma.hcpObservation.findMany({
      where: { doctorId: { in: doctorIds }, OR: [{ strategieId: strategie.id }, { strategieId: null }] },
      orderBy: { observeLe: "desc" },
      select: { doctorId: true, potentiel: true, prescriptionsSur10: true, source: true, observeLe: true, commentaire: true },
    }),
    vue === "historique" ? prisma.segmentationRegle.findMany({ where: { strategieId: strategie.id }, orderBy: { version: "desc" }, select: { version: true, note: true, publieeLe: true } }) : [],
    vue === "historique" ? prisma.segmentationImport.findMany({ where: { strategieId: strategie.id }, orderBy: { createdAt: "desc" }, select: { id: true, nomFichier: true, createdAt: true, feuille: true } }) : [],
  ]);
  const lignes: LigneVue[] = panel.map((l) => ({
    ...l,
    derniereObservation: l.derniereObservation?.toISOString() ?? null,
    derogations: derogations.filter((d) => d.doctorId === l.doctorId).map((d) => ({ ...d, expireLe: d.expireLe?.toISOString() ?? null, creeLe: d.creeLe.toISOString() })),
    historique: observations.filter((o) => o.doctorId === l.doctorId).slice(0, 8).map((o) => ({
      potentiel: o.potentiel === null ? null : Number(o.potentiel), sur10: o.prescriptionsSur10 === null ? null : Number(o.prescriptionsSur10),
      source: o.source, le: o.observeLe.toISOString(), commentaire: o.commentaire,
    })),
  }));
  const zones = [...new Set(panel.map((l) => l.zone).filter((z): z is string => !!z))].sort();
  const cycles = vue === "cycles" ? await prisma.segmentationCycle.findMany({ where: { strategieId: strategie.id }, orderBy: { debut: "desc" }, select: { id: true, libelle: true, statut: true, debut: true, fin: true } }) : [];
  const cycleId = cycles.find((c) => c.id === searchParams?.cycle)?.id ?? cycles.find((c) => c.statut === "OUVERT")?.id ?? cycles[0]?.id ?? null;
  const cycle = cycleId ? await chargerCycle(cycleId) : null;
  const href = (v: string, sp: string | null = spe) => `/segmentation?s=${strategie.id}&vue=${v}${sp ? `&spe=${sp}` : ""}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Segmentation — BU ${strategie.businessUnit.name}`}
        description={`${strategie.produits.map((p) => `#${p.rang} ${p.nom}`).join(" · ") || "aucun produit classé"} · ${strategie.regle ? `règles v${strategie.regle.version}` : "règles à publier"}`}
      >
        <Link href={`/business-units/${strategie.businessUnit.id}`} className="text-sm text-primary underline">Cockpit de la BU</Link>
      </PageHeader>
      {barreBu}

      {strategie.regle && strategie.regle.erreurs.length > 0 && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Règles v{strategie.regle.version} illisibles : {strategie.regle.erreurs.join(" ")}</p>
      )}

      {specialitesBu.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Spécialité :</span>
          <Link href={href(vue, null)} className={`rounded-md border px-3 py-2 sm:px-2 sm:py-1 ${!spe ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>Toutes</Link>
          {specialitesBu.map((x) => (
            <Link key={x.specialtyId} href={href(vue, x.specialtyId)} className={`rounded-md border px-3 py-2 sm:px-2 sm:py-1 ${spe === x.specialtyId ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{x.specialty.name}</Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Praticiens du panel" value={s.praticiens} icon="Users" />
        <KpiCard label="Ciblés" value={s.cibles} icon="Target" tone="success" />
        <KpiCard label="Décideurs (H)" value={s.h} icon="Crown" tone="info" />
        {Object.entries(s.parPriorite).sort().map(([p, n]) => <KpiCard key={p} label={`Priorité ${p}`} value={n} icon="Flag" />)}
        <KpiCard label="Visites requises / cycle" value={s.visitesRequises} icon="CalendarCheck" tone="warning" />
      </div>
      {strategie.produits.map((p) => {
        const m = s.parProduit[p.productId];
        if (!m) return null;
        return (
          <p key={p.productId} className="text-sm text-muted-foreground">
            <Link href={`/produits/${p.productId}`} className="font-medium text-foreground hover:underline">#{p.rang} {p.nom}</Link>{" "}
            {(["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).map((k) => `${ETAT_LABELS[k]} ${m[k]}`).join(" · ")}
          </p>
        );
      })}

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {VUES.filter((v) => (v.cle === "import" || v.cle === "historique" ? peutValider : true) && (v.cle !== "regles" || peutValider || !!regles)).map((v) => (
          <Link key={v.cle} href={href(v.cle)} className={`-mb-px border-b-2 px-3 py-2.5 text-sm sm:py-2 ${vue === v.cle ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {v.label}
          </Link>
        ))}
      </nav>

      {vue === "panel" && (
        <Panel
          strategieId={strategie.id}
          produits={strategie.produits}
          lignes={lignes}
          zones={zones}
          reglesPubliees={!!regles}
          peutModifier={peutModifier}
          peutDeroger={peutDeroger}
        />
      )}
      {vue === "cycles" && (
        <CyclesVue strategieId={strategie.id} cycles={cycles} cycle={cycle} peutGerer={peutValider} moi={user.access.modules.get("SEGMENTATION")?.scope === "ALL" ? null : user.id} />
      )}
      {vue === "regles" && (
        <div className="space-y-5">
          {peutValider && (
            <SpecialitesProduits
              strategieId={strategie.id}
              produits={strategie.produits}
              specialitesBu={specialitesBu.map((x) => ({ id: x.specialtyId, nom: x.specialty.name, principale: x.principale }))}
              cibles={strategie.contexte.specialitesParProduit ?? {}}
            />
          )}
          {peutValider && (
            <ClassementProduits strategieId={strategie.id} actuels={strategie.produits.map((p) => p.productId)} produits={produits} />
          )}
          <EditeurRegles
            strategieId={strategie.id}
            produits={strategie.produits}
            version={strategie.regle?.version ?? 0}
            contenu={strategie.regle?.regles ?? null}
            peutPublier={peutValider}
          />
        </div>
      )}
      {vue === "import" && peutValider && (
        <ImportClasseur strategieId={strategie.id} aDesRegles={!!strategie.regle} />
      )}
      {vue === "historique" && peutValider && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="surface space-y-2 p-4">
            <h2 className="text-sm font-semibold">Versions des règles</h2>
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Aucune version publiée.</p>}
            {versions.map((v) => (
              <p key={v.version} className="text-sm [overflow-wrap:anywhere]"><span className="font-medium">v{v.version}</span> · {v.publieeLe.toLocaleDateString("fr-FR")} {v.note ? `· ${v.note}` : ""}</p>
            ))}
          </section>
          <section className="surface space-y-2 p-4">
            <h2 className="text-sm font-semibold">Imports</h2>
            {imports.length === 0 && <p className="text-sm text-muted-foreground">Aucun import.</p>}
            {imports.map((i) => (
              <p key={i.id} className="text-sm [overflow-wrap:anywhere]">{i.nomFichier} · feuille {i.feuille ?? "—"} · {i.createdAt.toLocaleDateString("fr-FR")}</p>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
