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

export const dynamic = "force-dynamic";
export const metadata = { title: "Segmentation Studio — AMD Internal OS" };

const VUES = [
  { cle: "panel", label: "Praticiens" },
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
export default async function SegmentationPage({ searchParams }: { searchParams?: { s?: string; vue?: string; spe?: string } }) {
  const user = await requireModule("SEGMENTATION");
  const peutValider = userCan(user, "SEGMENTATION", "VALIDATE");
  const peutModifier = userCan(user, "SEGMENTATION", "UPDATE");
  const peutDeroger = userCan(user, "SEGMENTATION", "CREATE");
  const portee = user.access.modules.get("SEGMENTATION")?.scope === "ALL" ? {} : clausePanelDuKam(user.id);

  const strategies = await prisma.segmentationStrategie.findMany({
    orderBy: [{ statut: "asc" }, { createdAt: "asc" }],
    select: { id: true, nom: true, statut: true, businessUnit: { select: { name: true } } },
  });
  const choisie = strategies.find((s) => s.id === searchParams?.s) ?? strategies.find((s) => s.statut === "ACTIVE") ?? strategies[0] ?? null;
  const vue = VUES.some((v) => v.cle === searchParams?.vue) ? (searchParams!.vue as (typeof VUES)[number]["cle"]) : "panel";

  const [bus, produits] = peutValider
    ? await Promise.all([
        prisma.businessUnit.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.product.findMany({ where: { isActive: true }, select: { id: true, canonicalName: true, dci: true }, orderBy: { canonicalName: "asc" } }),
      ])
    : [[], []];

  if (!choisie) {
    return (
      <div className="space-y-5">
        <PageHeader title="Segmentation Studio" description="La segmentation de la force de vente, reliée à la BU, aux produits et à l'annuaire." />
        {peutValider ? (
          <CreerStrategie bus={bus} produits={produits.map((p) => ({ id: p.id, nom: p.canonicalName, dci: p.dci }))} />
        ) : (
          <p className="surface p-5 text-sm text-muted-foreground">Aucune stratégie de segmentation n&apos;est encore créée. La Direction ou le directeur des opérations la crée ici.</p>
        )}
      </div>
    );
  }

  const strategie = (await chargerStrategie(choisie.id))!;
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
  const href = (v: string, sp: string | null = spe) => `/segmentation?s=${strategie.id}&vue=${v}${sp ? `&spe=${sp}` : ""}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Segmentation — ${strategie.nom}`}
        description={`BU ${strategie.businessUnit.name} · ${strategie.produits.map((p) => `#${p.rang} ${p.nom}`).join(" · ") || "aucun produit classé"} · ${strategie.regle ? `règles v${strategie.regle.version}` : "règles à publier"}`}
      >
        {strategies.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {strategies.map((x) => (
              <Link key={x.id} href={`/segmentation?s=${x.id}`} className={`rounded-md border px-2 py-1 text-xs ${x.id === strategie.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                {x.nom}
              </Link>
            ))}
          </div>
        )}
      </PageHeader>

      {strategie.regle && strategie.regle.erreurs.length > 0 && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Règles v{strategie.regle.version} illisibles : {strategie.regle.erreurs.join(" ")}</p>
      )}

      {specialitesBu.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Spécialité :</span>
          <Link href={href(vue, null)} className={`rounded-md border px-2 py-1 ${!spe ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>Toutes</Link>
          {specialitesBu.map((x) => (
            <Link key={x.specialtyId} href={href(vue, x.specialtyId)} className={`rounded-md border px-2 py-1 ${spe === x.specialtyId ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{x.specialty.name}</Link>
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
            <span className="font-medium text-foreground">#{p.rang} {p.nom}</span>{" "}
            {(["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).map((k) => `${ETAT_LABELS[k]} ${m[k]}`).join(" · ")}
          </p>
        );
      })}

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {VUES.filter((v) => (v.cle === "import" || v.cle === "historique" ? peutValider : true) && (v.cle !== "regles" || peutValider || !!regles)).map((v) => (
          <Link key={v.cle} href={href(v.cle)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${vue === v.cle ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
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
            <ClassementProduits strategieId={strategie.id} actuels={strategie.produits.map((p) => p.productId)} produits={produits.map((p) => ({ id: p.id, nom: p.canonicalName, dci: p.dci }))} />
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
              <p key={v.version} className="text-sm"><span className="font-medium">v{v.version}</span> · {v.publieeLe.toLocaleDateString("fr-FR")} {v.note ? `· ${v.note}` : ""}</p>
            ))}
          </section>
          <section className="surface space-y-2 p-4">
            <h2 className="text-sm font-semibold">Imports</h2>
            {imports.length === 0 && <p className="text-sm text-muted-foreground">Aucun import.</p>}
            {imports.map((i) => (
              <p key={i.id} className="text-sm">{i.nomFichier} · feuille {i.feuille ?? "—"} · {i.createdAt.toLocaleDateString("fr-FR")}</p>
            ))}
          </section>
          {peutValider && (
            <section className="surface p-4 md:col-span-2">
              <h2 className="mb-3 text-sm font-semibold">Nouvelle stratégie</h2>
              <CreerStrategie bus={bus} produits={produits.map((p) => ({ id: p.id, nom: p.canonicalName, dci: p.dci }))} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
