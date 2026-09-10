"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Building2, Check, ChevronDown, ChevronRight, Loader2, Map, Package, Pencil, Plus,
  Trash2, UserCog, Users, Wallet,
} from "lucide-react";
import {
  createBusinessUnit, updateBusinessUnit, deleteBusinessUnit, openBusinessUnitBudget,
  createPromoProduct, updatePromoProduct, deletePromoProduct,
  saveRepProfile, createSector, updateSector, deleteSector,
} from "@/lib/actions/sales-planning-actions";
import {
  CHANNELS, CHANNEL_LABELS, buSetupProgress, buSetupSteps, channelCovers, channelLabel,
  type Channel,
} from "@/lib/sfe-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * LE MONTAGE D'UNE BU, DE HAUT EN BAS.
 *
 * Une BU par carte, dépliable. À l'intérieur, l'ordre est celui du montage réel : identité →
 * superviseur → terrain → KAM → produits. Chaque carte fermée dit CE QUI MANQUE (« Désigner le
 * superviseur ») plutôt qu'un compteur muet : une BU sans superviseur ne prévient personne quand
 * le terrain décroche, et cette panne-là ne produit aucune erreur — juste un silence.
 *
 * Ce module n'importe que `sfe-setup` (pur) et les actions serveur : la frontière client tient.
 */

const inputCls = "h-9 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const btnCls = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60";

export interface Opt { id: string; name: string }
export interface BuRow {
  id: string; name: string; code: string | null; color: string | null;
  companyId: string | null; headId: string | null; supervisorId: string | null;
  channel: string; isActive: boolean;
  /**
   * LE SOUS-DÉPARTEMENT de la gamme, quand son budget a été ouvert. C'est lui qui porte son
   * enveloppe Ad&Pro et sa masse salariale — une BU sans département ne compte nulle part.
   */
  departmentId: string | null;
}
export interface KamRow {
  repId: string; name: string; role: string; businessUnitId: string | null; region: string | null;
  capDaysPerMonth: number | null; capVisitsPerDay: number | null; capFieldPct: number | null;
  fteBudget: number; seniority: string | null; isActive: boolean; hasProfile: boolean;
}
/**
 * UN SECTEUR — le territoire nommé d'une BU : « Est », « Oranais », « Alger ».
 *
 * C'est LUI qui donne au KAM son panel de médecins (les praticiens des établissements du
 * secteur) et qui ouvre sa planification sur la bonne ville. Il appartient à la BU et non au KAM
 * (deux KAM peuvent le couvrir, un KAM qui part n'emporte pas la carte) — voir `SalesSector`.
 */
export interface SectorRow {
  id: string; name: string; city: string | null; color: string | null; isActive: boolean;
  institutionIds: string[];
  repIds: string[];
}

export interface EtabOpt { id: string; name: string; city: string | null; type: string }

export interface ProductRow {
  id: string; name: string; code: string | null; channel: string;
  businessUnitId: string | null; managerId: string | null; isActive: boolean; dossier: string | null;
}

type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

export function BusinessUnitsManager({
  businessUnits, companies, supervisors, users, kams, products, dossiers, config,
  sectors, etablissements,
}: {
  businessUnits: BuRow[];
  companies: Opt[];
  supervisors: Opt[];
  users: Opt[];
  kams: KamRow[];
  products: ProductRow[];
  dossiers: { id: string; label: string }[];
  config: { daysPerMonth: number; visitsPerDay: number; fieldPct: number };
  /** Les secteurs de TOUTES les BU, groupés à l'affichage — comme les KAM et les produits. */
  sectors: (SectorRow & { businessUnitId: string })[];
  /** Le référentiel des établissements, à cocher. Vide → l'annuaire est vide, et on le DIT. */
  etablissements: EtabOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const run = React.useCallback(async (action: Action, fd: FormData, refresh = true) => {
    setBusy(true);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return false; }
    if (refresh) router.refresh();
    return true;
  }, [router]);

  const kamsOf = (buId: string | null) => kams.filter((k) => k.businessUnitId === buId);
  const sectorsOf = (buId: string) => sectors.filter((x) => x.businessUnitId === buId);
  const productsOf = (buId: string | null) => products.filter((p) => p.businessUnitId === buId);
  const orphelinsKam = kamsOf(null);
  const orphelinsProd = productsOf(null);

  return (
    <div className="space-y-5">
      {/* LE FORMULAIRE DE CRÉATION VIT DANS UN TIROIR, pas en tête de page. Déplié en permanence,
          il repoussait les BU existantes sous la ligne de flottaison — alors qu'on vient ici dix
          fois pour en consulter une, et une fois pour en créer une. */}
      <div className="flex justify-end">
        <Button onClick={() => { setCreating(true); }} disabled={busy}>
          <Plus className="h-4 w-4" /> Créer une BU
        </Button>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Créer une Business Unit" width="md">
        <form
          className="space-y-3"
          action={async (fd) => { if (await run(createBusinessUnit, fd)) setCreating(false); }}
        >
          <p className="text-sm text-muted-foreground">
            Une BU est une franchise ET son équipe : un superviseur, un terrain, des KAM, des
            produits. On la crée ici, puis on la déplie pour lui rattacher ses KAM et ses produits.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input name="name" required placeholder="Nom de la BU (ex. Neurologie)" className={`${inputCls} sm:col-span-2`} />
            <input name="code" placeholder="Code (facultatif)" className={inputCls} />
            <select name="supervisorId" className={inputCls} defaultValue="">
              <option value="">— Superviseur —</option>
              {supervisors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select name="channel" className={inputCls} defaultValue="BOTH">
              {CHANNELS.map((c) => <option key={c} value={c}>Terrain : {CHANNEL_LABELS[c]}</option>)}
            </select>
            <select name="companyId" className={inputCls} defaultValue="">
              <option value="">— Société —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select name="headId" className={inputCls} defaultValue="">
              <option value="">— Chef de BU (facultatif) —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input name="color" type="color" defaultValue="#2563eb" className="h-9 w-16 rounded-lg border border-input bg-background" title="Couleur" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">Annuler</button>
            <button type="submit" disabled={busy} className={btnCls}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer la BU
            </button>
          </div>
        </form>
      </Sheet>

      {businessUnits.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucune Business Unit. Commencez par en créer une — tout le reste du module s&apos;y rattache.
        </p>
      )}

      {businessUnits.map((bu) => (
        <BuCard
          key={bu.id}
          bu={bu}
          open={open[bu.id] ?? false}
          onToggle={() => setOpen((o) => ({ ...o, [bu.id]: !o[bu.id] }))}
          companies={companies}
          supervisors={supervisors}
          users={users}
          dossiers={dossiers}
          config={config}
          busy={busy}
          run={run}
          kamsInside={kamsOf(bu.id)}
          kamsFree={orphelinsKam}
          sectorsInside={sectorsOf(bu.id)}
          etablissements={etablissements}
          productsInside={productsOf(bu.id)}
          productsFree={orphelinsProd}
        />
      ))}

      {/* ─────────── CE QUI N'EST RATTACHÉ À RIEN — visible, jamais perdu ─────────── */}
      {(orphelinsKam.length > 0 || orphelinsProd.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> Sans Business Unit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Ces éléments existent mais n&apos;apparaissent nulle part au pilotage : un KAM sans BU n&apos;a
              pas de superviseur, un produit sans BU ne peut porter aucune affectation.
            </p>
            {orphelinsKam.length > 0 && (
              <p><span className="font-medium">{orphelinsKam.length} KAM</span> : {orphelinsKam.map((k) => k.name).join(", ")}</p>
            )}
            {orphelinsProd.length > 0 && (
              <p><span className="font-medium">{orphelinsProd.length} produit(s)</span> : {orphelinsProd.map((p) => p.name).join(", ")}</p>
            )}
            <p className="text-muted-foreground">Dépliez une BU ci-dessus pour les y rattacher.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BuCard({
  bu, open, onToggle, companies, supervisors, users, dossiers, config, busy, run,
  kamsInside, kamsFree, productsInside, productsFree, sectorsInside, etablissements,
}: {
  bu: BuRow; open: boolean; onToggle: () => void;
  companies: Opt[]; supervisors: Opt[]; users: Opt[];
  dossiers: { id: string; label: string }[];
  config: { daysPerMonth: number; visitsPerDay: number; fieldPct: number };
  busy: boolean; run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
  kamsInside: KamRow[]; kamsFree: KamRow[]; productsInside: ProductRow[]; productsFree: ProductRow[];
  sectorsInside: SectorRow[]; etablissements: EtabOpt[];
}) {
  // LES TROIS NOMBRES QUE L'ÉTAPE « SECTEURS » RÉCLAME, et il en faut trois : « la BU a des
  // secteurs » cache trois pannes distinctes, toutes silencieuses (voir `sfe-setup.ts`).
  const kamAvecSecteur = new Set(sectorsInside.flatMap((x) => x.repIds));
  const etat = {
    supervisorId: bu.supervisorId, channel: bu.channel,
    repCount: kamsInside.length, productCount: productsInside.length,
    sectorCount: sectorsInside.length,
    sectorsWithoutInstitution: sectorsInside.filter((x) => x.institutionIds.length === 0).length,
    repsWithSector: kamsInside.filter((k) => kamAvecSecteur.has(k.repId)).length,
  };
  const steps = buSetupSteps(etat);
  const manquantes = steps.filter((s) => !s.done);
  const { done, total } = buSetupProgress(etat);
  const superviseur = supervisors.find((u) => u.id === bu.supervisorId)?.name ?? null;

  function saveBu(patch: Partial<BuRow>) {
    const next = { ...bu, ...patch };
    const fd = new FormData();
    fd.set("id", next.id); fd.set("name", next.name); fd.set("code", next.code ?? "");
    fd.set("color", next.color ?? ""); fd.set("companyId", next.companyId ?? "");
    fd.set("headId", next.headId ?? ""); fd.set("supervisorId", next.supervisorId ?? "");
    fd.set("channel", next.channel);
    if (next.isActive) fd.set("isActive", "on");
    void run(updateBusinessUnit, fd);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
          <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bu.color ?? "#94a3b8" }} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{bu.name}</CardTitle>
              <Badge tone="neutral" dot={false}>{channelLabel(bu.channel)}</Badge>
              {!bu.isActive && <Badge tone="warning" dot={false}>Inactive</Badge>}
            </span>
            {/* CE QUI MANQUE, NOMMÉ — pas un compteur muet. */}
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {superviseur ? `Supervisée par ${superviseur}` : "Sans superviseur"}
              {" · "}{kamsInside.length} KAM{" · "}{productsInside.length} produit(s)
            </span>
            {manquantes.length > 0 && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-500">
                À faire : {manquantes.map((s) => s.label.toLowerCase()).join(", ")}.
              </span>
            )}
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{done}/{total}</span>
          {done === total && <Check className="h-4 w-4 text-emerald-600" aria-label="BU complète" />}
        </span>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5">
          {/* ── 1. Identité ─────────────────────────────────────────────── */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identité</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <input className={`${inputCls} min-w-40 flex-1`} defaultValue={bu.name} onBlur={(e) => e.target.value !== bu.name && saveBu({ name: e.target.value })} />
              <input className={`${inputCls} w-28`} defaultValue={bu.code ?? ""} placeholder="Code" onBlur={(e) => saveBu({ code: e.target.value || null })} />
              <select className={inputCls} defaultValue={bu.companyId ?? ""} onChange={(e) => saveBu({ companyId: e.target.value || null })}>
                <option value="">— Société —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={inputCls} defaultValue={bu.headId ?? ""} onChange={(e) => saveBu({ headId: e.target.value || null })}>
                <option value="">— Chef de BU —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="color" className="h-9 w-12 rounded-lg border border-input bg-background" defaultValue={bu.color ?? "#2563eb"} onBlur={(e) => saveBu({ color: e.target.value })} title="Couleur" />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" defaultChecked={bu.isActive} onChange={(e) => saveBu({ isActive: e.target.checked })} /> Active
              </label>
              {/* OUVRIR LE BUDGET DE LA GAMME — un geste explicite, pas un effet de bord de la
                  création. Créer le sous-département à chaque nouvelle BU remplirait l'arbre de
                  départements vides pour des gammes qu'on essaie, qu'on renomme et qu'on
                  supprime la semaine suivante. */}
              {bu.departmentId ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-success/30 px-2 py-1 text-xs font-medium text-success" title="Cette gamme a son sous-département : son budget et sa masse salariale se lisent dans Budgets.">
                  <Wallet className="h-3.5 w-3.5" /> Budget ouvert
                </span>
              ) : (
                <button
                  type="button"
                  title="Ouvrir le budget de cette gamme : elle devient un sous-département de la Direction commerciale, avec son enveloppe Ad&Pro et sa masse salariale."
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-secondary"
                  onClick={() => {
                    const fd = new FormData(); fd.set("id", bu.id);
                    void run(openBusinessUnitBudget, fd);
                  }}
                >
                  <Wallet className="h-3.5 w-3.5" /> Ouvrir le budget
                </button>
              )}
              <button
                type="button"
                title="Supprimer la BU"
                className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (!window.confirm(`Supprimer la BU « ${bu.name} » ?`)) return;
                  const fd = new FormData(); fd.set("id", bu.id);
                  void run(deleteBusinessUnit, fd);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* ── 2. Superviseur & terrain ────────────────────────────────── */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supervision &amp; terrain</h4>
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} defaultValue={bu.supervisorId ?? ""} onChange={(e) => saveBu({ supervisorId: e.target.value || null })}>
                <option value="">— Superviseur —</option>
                {supervisors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className={inputCls} defaultValue={bu.channel} onChange={(e) => saveBu({ channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c} value={c}>Terrain : {CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            {!bu.supervisorId && (
              <p className="text-xs text-muted-foreground">{steps.find((s) => s.key === "SUPERVISEUR")!.why}</p>
            )}
          </section>

          {/* ── 3. Les KAM ──────────────────────────────────────────────── */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> KAM de la BU ({kamsInside.length})
            </h4>
            {kamsInside.length === 0 && (
              <p className="text-xs text-muted-foreground">{steps.find((s) => s.key === "KAM")!.why}</p>
            )}
            <div className="space-y-1.5">
              {kamsInside.map((k) => (
                <KamLine key={k.repId} kam={k} buId={bu.id} config={config} busy={busy} run={run} />
              ))}
            </div>
            {kamsFree.length > 0 && (
              <form
                className="flex flex-wrap items-center gap-2"
                action={(fd) => { fd.set("businessUnitId", bu.id); void run(saveRepProfile, fd); }}
              >
                <select name="repId" required className={inputCls} defaultValue="">
                  <option value="" disabled>— Rattacher un KAM —</option>
                  {kamsFree.map((k) => <option key={k.repId} value={k.repId}>{k.name}</option>)}
                </select>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-60">
                  <Plus className="h-4 w-4" /> Rattacher
                </button>
              </form>
            )}
          </section>

          {/* ── 4. Les secteurs — le TERRITOIRE de chaque KAM ───────────── */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Map className="h-3.5 w-3.5" aria-hidden /> Secteurs de la BU ({sectorsInside.length})
            </h4>
            {/* La RAISON dit laquelle des trois pannes on tient — jamais un reproche générique. */}
            {!steps.find((x) => x.key === "SECTEURS")!.done && (
              <p className="text-xs text-muted-foreground">{steps.find((x) => x.key === "SECTEURS")!.why}</p>
            )}
            <SecteursDeLaBu
              buId={bu.id}
              secteurs={sectorsInside}
              kams={kamsInside}
              etablissements={etablissements}
              busy={busy}
              run={run}
            />
          </section>

          {/* ── 4. Les produits, DEPUIS REGULATORY ──────────────────────── */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5" aria-hidden /> Produits de la BU ({productsInside.length})
            </h4>
            {productsInside.length === 0 && (
              <p className="text-xs text-muted-foreground">{steps.find((s) => s.key === "PRODUITS")!.why}</p>
            )}
            <div className="space-y-1.5">
              {productsInside.map((p) => (
                <ProductLine key={p.id} prod={p} buChannel={bu.channel} users={users} busy={busy} run={run} />
              ))}
            </div>
            <form
              className="flex flex-wrap items-center gap-2"
              action={(fd) => { fd.set("businessUnitId", bu.id); void run(createPromoProduct, fd); }}
            >
              <select name="regulatoryProductId" required className={`${inputCls} min-w-64 flex-1`} defaultValue="">
                <option value="" disabled>— Choisir un dossier Regulatory —</option>
                {dossiers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-60">
                <Plus className="h-4 w-4" /> Ajouter le produit
              </button>
            </form>
            {/* Les produits déjà créés ailleurs se rattachent sans repasser par Regulatory. */}
            {productsFree.length > 0 && (
              <form
                className="flex flex-wrap items-center gap-2"
                action={(fd) => { fd.set("businessUnitId", bu.id); void run(updatePromoProduct, fd); }}
              >
                <select name="id" required className={inputCls} defaultValue="">
                  <option value="" disabled>— Rattacher un produit existant —</option>
                  {productsFree.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-60">
                  <Plus className="h-4 w-4" /> Rattacher
                </button>
              </form>
            )}
          </section>
        </CardContent>
      )}
    </Card>
  );
}

/** Une ligne de KAM : sa capacité, son ETP, et le bouton qui le sort de la BU. */
function KamLine({ kam, buId, config, busy, run }: {
  kam: KamRow; buId: string;
  config: { daysPerMonth: number; visitsPerDay: number; fieldPct: number };
  busy: boolean; run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
}) {
  function save(patch: Partial<KamRow>, refresh = false) {
    const next = { ...kam, ...patch };
    const fd = new FormData();
    fd.set("repId", next.repId);
    fd.set("businessUnitId", next.businessUnitId ?? "");
    fd.set("region", next.region ?? "");
    fd.set("capDaysPerMonth", next.capDaysPerMonth == null ? "" : String(next.capDaysPerMonth));
    fd.set("capVisitsPerDay", next.capVisitsPerDay == null ? "" : String(next.capVisitsPerDay));
    fd.set("capFieldPct", next.capFieldPct == null ? "" : String(next.capFieldPct));
    fd.set("fteBudget", String(next.fteBudget));
    fd.set("seniority", next.seniority ?? "");
    fd.set("isActive", next.isActive ? "on" : "off");
    void run(saveRepProfile, fd, refresh);
  }
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-1.5 text-sm">
      <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-28 flex-1 font-medium">{kam.name}</span>
      <input className={`${inputCls} w-32`} defaultValue={kam.region ?? ""} placeholder="Secteur" onBlur={(e) => save({ region: e.target.value || null })} />
      {/* La capacité vide = la valeur globale du paramétrage : le placeholder le DIT. */}
      <input className={`${inputCls} w-20`} type="number" defaultValue={kam.capDaysPerMonth ?? ""} placeholder={`${config.daysPerMonth} j`} title="Jours terrain / mois" onBlur={(e) => save({ capDaysPerMonth: num(e.target.value) })} />
      <input className={`${inputCls} w-20`} type="number" defaultValue={kam.capVisitsPerDay ?? ""} placeholder={`${config.visitsPerDay} v/j`} title="Visites / jour" onBlur={(e) => save({ capVisitsPerDay: num(e.target.value) })} />
      <input className={`${inputCls} w-20`} type="number" defaultValue={kam.capFieldPct ?? ""} placeholder={`${config.fieldPct} %`} title="% de temps terrain" onBlur={(e) => save({ capFieldPct: num(e.target.value) })} />
      <input className={`${inputCls} w-20`} type="number" step="0.1" defaultValue={kam.fteBudget} title="ETP contractuel" onBlur={(e) => save({ fteBudget: Number(e.target.value) || 1 })} />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" defaultChecked={kam.isActive} onChange={(e) => save({ isActive: e.target.checked }, true)} /> Actif
      </label>
      <button
        type="button"
        title="Retirer de la BU"
        disabled={busy}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
        onClick={() => { if (kam.businessUnitId === buId) save({ businessUnitId: null }, true); }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Une ligne de produit : son dossier d'origine, son canal, son Direction Marketing. */
function ProductLine({ prod, buChannel, users, busy, run }: {
  prod: ProductRow; buChannel: string; users: Opt[];
  busy: boolean; run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
}) {
  function save(patch: Partial<ProductRow>, refresh = false) {
    const next = { ...prod, ...patch };
    const fd = new FormData();
    fd.set("id", next.id); fd.set("name", next.name); fd.set("code", next.code ?? "");
    fd.set("channel", next.channel); fd.set("businessUnitId", next.businessUnitId ?? "");
    fd.set("managerId", next.managerId ?? "");
    if (next.isActive) fd.set("isActive", "on");
    void run(updatePromoProduct, fd, refresh);
  }
  // L'INCOHÉRENCE SE DIT, elle ne se corrige pas toute seule : c'est peut-être l'exception voulue.
  const horsTerrain = !channelCovers(buChannel, prod.channel);

  return (
    <div className="space-y-1 rounded-lg border border-border p-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input className={`${inputCls} min-w-32 flex-1`} defaultValue={prod.name} onBlur={(e) => e.target.value !== prod.name && save({ name: e.target.value })} />
        <select className={inputCls} defaultValue={prod.channel} onChange={(e) => save({ channel: e.target.value }, true)}>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c as Channel]}</option>)}
        </select>
        <select className={inputCls} defaultValue={prod.managerId ?? ""} onChange={(e) => save({ managerId: e.target.value || null })}>
          <option value="">— Référent Direction Marketing —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" defaultChecked={prod.isActive} onChange={(e) => save({ isActive: e.target.checked }, true)} /> Actif
        </label>
        <button
          type="button"
          title="Supprimer le produit"
          disabled={busy}
          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (!window.confirm(`Supprimer « ${prod.name} » du catalogue promotionnel ?`)) return;
            const fd = new FormData(); fd.set("id", prod.id);
            void run(deletePromoProduct, fd, true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="pl-6 text-xs text-muted-foreground">
        {prod.dossier ? `Dossier : ${prod.dossier}` : "Aucun dossier Regulatory rattaché."}
        {horsTerrain && (
          <span className="ml-2 text-amber-700 dark:text-amber-500">
            Ce produit ({channelLabel(prod.channel)}) sort du terrain de la BU ({channelLabel(buChannel)}).
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * LES SECTEURS D'UNE BU — un nom, des établissements cochés, des KAM affectés.
 *
 * ── POURQUOI LE FORMULAIRE PART EN UN SEUL ENVOI ────────────────────────────────────────────
 *
 * Le nom, les établissements et les KAM partent ensemble : un secteur créé dont les
 * établissements n'auraient pas été enregistrés est un NOM SANS TERRITOIRE, dont le KAM affecté
 * a un panel vide sans qu'une ligne le dise. L'action les écrit dans une transaction.
 *
 * ── LES LISTES SONT ENVOYÉES COMPLÈTES ──────────────────────────────────────────────────────
 *
 * L'action REMPLACE les deux sélections, c'est ce qui fait que décocher retire. Les cases non
 * cochées n'envoient rien : c'est exactement la sélection, et une sélection VIDE retire tout.
 *
 * ── LE COMPTE AFFICHÉ EST CE QU'ON A COCHÉ ──────────────────────────────────────────────────
 *
 * « 12 établissements · 2 KAM » se lit sur la ligne : sans lui, on ouvre les secteurs un par un
 * pour trouver celui qui est vide — et c'est précisément le vide qui casse une tournée.
 */
function SecteursDeLaBu({
  buId, secteurs, kams, etablissements, busy, run,
}: {
  buId: string;
  secteurs: SectorRow[];
  kams: KamRow[];
  etablissements: EtabOpt[];
  busy: boolean;
  run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
}) {
  const [edite, setEdite] = React.useState<SectorRow | null>(null);
  const [cree, setCree] = React.useState(false);
  const [filtre, setFiltre] = React.useState("");

  const nomEtab = (id: string) => etablissements.find((e) => e.id === id)?.name ?? "(établissement retiré)";
  const nomKam = (id: string) => kams.find((k) => k.repId === id)?.name ?? null;

  const supprimer = async (sec: SectorRow) => {
    const msg = `Supprimer le secteur « ${sec.name} » ?`
      + (sec.repIds.length > 0
        ? `\n\n• ${sec.repIds.length} KAM perdent ce territoire : sans autre secteur, leur panel devient vide et ils ne peuvent plus planifier de tournée.`
        : "\n\nLes établissements et les comptes ne bougent pas — on retire un découpage, pas un annuaire.");
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("id", sec.id);
    void run(deleteSector, fd);
  };

  const visibles = filtre.trim()
    ? etablissements.filter((e) => `${e.name} ${e.city ?? ""}`.toLowerCase().includes(filtre.trim().toLowerCase()))
    : etablissements;

  const ouvert = cree || edite !== null;

  return (
    <>
      <div className="space-y-1.5">
        {secteurs.map((sec) => (
          <div key={sec.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sec.color ?? "#94a3b8" }} />
            <span className="font-medium">{sec.name}</span>
            {sec.city && <Badge tone="neutral" dot={false}>{sec.city}</Badge>}
            <span className="text-xs text-muted-foreground">
              {sec.institutionIds.length} établissement(s) · {sec.repIds.length} KAM
            </span>
            {/* UN SECTEUR VIDE EST NOMMÉ SUR SA LIGNE : c'est là qu'on le corrige. */}
            {sec.institutionIds.length === 0 && (
              <Badge tone="warning" dot={false}>Sans établissement</Badge>
            )}
            {sec.repIds.length === 0 && <Badge tone="neutral" dot={false}>Personne ne le couvre</Badge>}
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button" onClick={() => setEdite(sec)} disabled={busy}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={`Modifier le secteur ${sec.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button" onClick={() => void supprimer(sec)} disabled={busy}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Supprimer le secteur ${sec.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
            {sec.institutionIds.length > 0 && (
              <span className="w-full text-xs text-muted-foreground">
                {sec.institutionIds.slice(0, 6).map(nomEtab).join(", ")}
                {sec.institutionIds.length > 6 ? ` … +${sec.institutionIds.length - 6}` : ""}
                {sec.repIds.length > 0 && ` — ${sec.repIds.map(nomKam).filter(Boolean).join(", ")}`}
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        type="button" onClick={() => setCree(true)} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> Découper un secteur
      </button>

      <Sheet
        open={ouvert}
        onClose={() => { setCree(false); setEdite(null); setFiltre(""); }}
        title={edite ? `Secteur « ${edite.name} »` : "Découper un secteur"}
        description="Un nom que la force de vente emploie (« Est », « Oranais », « Alger »), les établissements qu'il couvre, et les KAM qui le parcourent."
        width="lg"
      >
        <form
          className="space-y-3"
          action={async (fd) => {
            if (edite) fd.set("id", edite.id);
            else fd.set("businessUnitId", buId);
            const ok = await run(edite ? updateSector : createSector, fd);
            if (ok) { setCree(false); setEdite(null); setFiltre(""); }
          }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              name="name" required defaultValue={edite?.name ?? ""} placeholder="Nom du secteur (Est, Oranais…)"
              className={`${inputCls} sm:col-span-2`} aria-label="Nom du secteur"
            />
            <input
              name="city" defaultValue={edite?.city ?? ""} placeholder="Ville pivot (facultatif)"
              className={inputCls} aria-label="Ville pivot du secteur"
            />
          </div>
          {/* La ville pivot n'est pas décorative : c'est elle qui ouvre la planification du KAM
              sur la bonne ville sans qu'il ait à la chercher. Un secteur multi-villes la laisse
              vide, et la ville se lit alors sur chaque établissement. */}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              KAM qui couvrent ce secteur
            </p>
            {kams.length === 0
              ? <p className="text-xs text-muted-foreground">Aucun KAM rattaché à cette BU — rattachez-les d&apos;abord, le secteur pourra ensuite leur être affecté.</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {kams.map((k) => (
                    <label key={k.repId} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2 py-1 text-sm">
                      <input
                        type="checkbox" name="repIds" value={k.repId}
                        defaultChecked={edite?.repIds.includes(k.repId) ?? false}
                        className="h-4 w-4 rounded border-input"
                      />
                      {k.name}
                    </label>
                  ))}
                </div>
              )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Établissements du secteur
              </p>
              <input
                value={filtre} onChange={(e) => setFiltre(e.target.value)}
                placeholder="Filtrer par nom ou ville" className={`${inputCls} w-56`}
                aria-label="Filtrer les établissements"
              />
            </div>
            {/* L'ANNUAIRE VIDE SE DIT, avec le geste qui le remplit — un cadre de cases vide se
                lit comme « il n'y a pas d'hôpitaux », alors que la vérité est « personne n'en a
                encore saisi ». */}
            {etablissements.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                L&apos;annuaire des établissements est vide : un secteur est une sélection d&apos;hôpitaux, il n&apos;y a
                donc rien à cocher. Ajoutez-les dans <span className="font-medium">Annuaire › Établissements</span>.
              </p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {visibles.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">Aucun établissement ne correspond à ce filtre.</p>
                )}
                {visibles.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-secondary">
                    <input
                      type="checkbox" name="institutionIds" value={e.id}
                      defaultChecked={edite?.institutionIds.includes(e.id) ?? false}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{e.name}</span>
                    {e.city && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{e.city}</span>}
                  </label>
                ))}
              </div>
            )}
            {/* LE FILTRE NE DÉCOCHE PAS ce qu'il masque : les cases filtrées restent montées et
                partent avec le formulaire. Les démonter ferait qu'un filtre appliqué avant
                d'enregistrer RETIRERAIT du secteur tout ce qu'on ne voyait plus — une empreinte
                bien plus large que le geste demandé, et parfaitement silencieuse. */}
            {filtre.trim() && edite && (
              <p className="text-xs text-muted-foreground">
                Le filtre masque des lignes sans les décocher : la sélection enregistrée reste complète.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button" onClick={() => { setCree(false); setEdite(null); setFiltre(""); }}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              Annuler
            </button>
            <button type="submit" disabled={busy} className={btnCls}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {edite ? "Enregistrer" : "Créer le secteur"}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
