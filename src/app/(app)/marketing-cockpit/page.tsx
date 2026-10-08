import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { peutGererSpecialites, userCan } from "@/lib/rbac";
import { getAppSettings } from "@/lib/settings";
import { visibleTabs } from "@/lib/nav-tabs";
import { MARKETING_COCKPIT_TABS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { MenuDossier } from "@/components/shared/menu-dossier";
import { peutEcrireMessagesCockpit, peutVoirArgentCockpit, peutVoirMarcheCockpit } from "@/lib/marketing-cockpit/acces";
import {
  chargerBase, chargerBusCockpit, chargerDepenses, chargerEnveloppe, chargerLeaders, chargerMessages, choisirPerimetre,
  STATUTS_LEADERS, type BaseCockpit, type BuCockpit, type LigneMessage, type ProduitCockpit,
} from "@/lib/marketing-cockpit/donnees";
import { libelleMois, marcheDuProduit, type MarcheProduit } from "@/lib/marketing-cockpit/marche";
import { CHEMIN_BUDGET_MARKETING } from "@/lib/budget-marketing/domaine";
import {
  couvertureFrequence, entonnoir, estCible, messagePeuPorte, montantDzd, passesEnA, pourcent, prescripteursAvecAffinite,
  repartitionDepenses,
} from "@/lib/marketing-cockpit/calculs";
import { SelecteurProduit } from "./selecteur-produit";
import { MessagesManager } from "./messages-manager";
import {
  CarteASurveiller, CarteEntonnoir, CarteEnveloppe, CarteOuVaLArgent, CarteSignaux, Carte, Courbes, Tuiles, Vide, VueLeaders,
  type SignalCockpit, type TuileCockpit,
} from "./vues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing cockpit — AMD Internal OS" };

const VUES = ["ensemble", "leaders", "messages", "marche", "investissements"] as const;
type Vue = (typeof VUES)[number];

/**
 * MARKETING COCKPIT — le tableau de la Direction Marketing (maquette validée, 07/10 — « Le principe » : une seule
 * chaîne, du médecin au résultat). Par produit (ou toute la BU) : est-ce que l'effort et l'argent vont sur les bonnes
 * cibles, et le marché bouge-t-il ? Rien ne se saisit ici, sauf les messages : tout se lit dans l'annuaire, la
 * segmentation, les visites, Ad & Pro, les budgets et les données marché.
 *
 * La porte est le module MARKETING_COCKPIT ; le marché et l'argent ont chacun leur règle (`marketing-cockpit/acces.ts`).
 */
export default async function MarketingCockpitPage({ searchParams }: { searchParams?: { vue?: string; produit?: string; bu?: string } }) {
  const user = await requireModule("MARKETING_COCKPIT");
  const maintenant = new Date();
  const voitMarche = peutVoirMarcheCockpit(user);
  const voitArgent = peutVoirArgentCockpit(user);

  const bus = await chargerBusCockpit();
  const choix = choisirPerimetre(bus, searchParams ?? {});
  if (!choix) {
    return (
      <div className="space-y-4">
        <PageHeader title="Marketing cockpit" />
        <p className="surface rounded-xl p-5 text-sm text-muted-foreground">Aucune Business Unit active.</p>
      </div>
    );
  }
  const { bu } = choix;
  const produit = choix.explicite ? choix.produit : await produitParDefaut(bu);

  const demandee = (VUES as readonly string[]).includes(searchParams?.vue ?? "") ? (searchParams!.vue as Vue) : "ensemble";
  const vue: Vue = (demandee === "marche" && !voitMarche) || (demandee === "investissements" && !voitArgent) ? "ensemble" : demandee;

  const base = await chargerBase(user, bu, produit, maintenant);
  const perimetre = produit ? `produit=${produit.id}` : `bu=${bu.id}`;
  const lien = (v: Vue) => `/marketing-cockpit?${v === "ensemble" ? "" : `vue=${v}&`}${perimetre}`;
  const nomPerimetre = produit?.nom ?? "Tous les produits";

  const onglets = (await visibleTabs(user, MARKETING_COCKPIT_TABS)).filter((t) => t.show !== false).map((t) => {
    const cle = (new URLSearchParams(t.href.split("?")[1] ?? "").get("vue") ?? "ensemble") as Vue;
    return { cle, label: t.label, href: lien(cle) };
  });

  const groupes = bus.map((b) => ({ bu: { id: b.id, nom: b.nom }, produits: b.produits.map((p) => ({ id: p.id, nom: p.nom })) }));

  return (
    <div className="space-y-4">
      <PageHeader title="Marketing cockpit" description={`${nomPerimetre} · BU ${bu.nom} · ${base.cycle.libelle}`}>
        <SelecteurProduit groupes={groupes} valeur={produit ? `p:${produit.id}` : `bu:${bu.id}`} vue={vue === "ensemble" ? null : vue} />
        <MenuDossier>
          {base.strategie && userCan(user, "SEGMENTATION", "VIEW") && <MenuLien href={`/segmentation?s=${base.strategie.id}`}>Segmentation de la BU</MenuLien>}
          <MenuLien href={`/business-units/${bu.id}`}>Cockpit de la BU</MenuLien>
          {peutGererSpecialites(user, "VIEW") && <MenuLien href="/annuaires/specialites">Spécialités (Annuaires)</MenuLien>}
          {voitMarche && <MenuLien href="/business-development/marche">Intelligence marché</MenuLien>}
        </MenuDossier>
      </PageHeader>

      <nav className="-mx-3 flex gap-1 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0" aria-label="Vues du cockpit">
        {onglets.map((o) => (
          <Link key={o.cle} href={o.href} aria-current={vue === o.cle ? "page" : undefined}
            className={cn("shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors sm:py-2", vue === o.cle ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {o.label}
          </Link>
        ))}
      </nav>

      {!base.strategie && vue !== "messages" && (
        <p className="surface rounded-xl px-4 py-3 text-sm text-muted-foreground">
          La segmentation de la BU {bu.nom} n&apos;est pas activée : lettres, fréquences et leaders apparaîtront avec elle
          {userCan(user, "SEGMENTATION", "VIEW") ? <> (<Link href={`/segmentation?bu=${bu.id}`} className="text-primary underline">Segmentation</Link>)</> : null}.
        </p>
      )}
      {base.strategie && produit && !base.produitClasse && vue !== "messages" && (
        <p className="text-xs text-muted-foreground">{produit.nom} n&apos;est pas classé dans la segmentation de la BU : les lettres affichées sont celles de son produit n° 1.</p>
      )}

      {vue === "ensemble" && <VueEnsemble base={base} bu={bu} produit={produit} lien={lien} voitMarche={voitMarche} voitArgent={voitArgent} user={user} maintenant={maintenant} />}
      {vue === "leaders" && <VueLeadersSection base={base} maintenant={maintenant} />}
      {vue === "messages" && <VueMessages base={base} bus={bus} bu={bu} produit={produit} user={user} maintenant={maintenant} />}
      {vue === "marche" && <VueMarche produit={produit} />}
      {vue === "investissements" && <VueInvestissements base={base} bu={bu} produit={produit} user={user} maintenant={maintenant} />}
    </div>
  );
}

function MenuLien({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} role="menuitem" className="rounded-md px-2.5 py-2 text-sm hover:bg-secondary">{children}</Link>;
}

/** Sans choix explicite : le produit n° 1 de la segmentation de la BU, sinon son premier produit promu. */
async function produitParDefaut(bu: BuCockpit): Promise<ProduitCockpit | null> {
  if (bu.strategieId) {
    const p1 = await prisma.segmentationStrategieProduit.findFirst({ where: { strategieId: bu.strategieId, jusqua: null }, orderBy: { rang: "asc" }, select: { productId: true } });
    const trouve = bu.produits.find((p) => p.productId === p1?.productId);
    if (trouve) return trouve;
  }
  return bu.produits[0] ?? null;
}

async function marcheDe(produit: ProduitCockpit | null): Promise<MarcheProduit | null> {
  if (!produit?.productId || !produit.dci) return null;
  const alias = await prisma.productAlias.findMany({ where: { productId: produit.productId }, select: { label: true } });
  try {
    return marcheDuProduit({ nom: produit.nom, dci: produit.dci, alias: alias.map((a) => a.label) });
  } catch {
    // Les jeux de données marché absents ou illisibles : pas de marché, plutôt qu'une page cassée.
    return null;
  }
}

// ───────────────────────────── Vue d'ensemble ─────────────────────────────

async function VueEnsemble({ base, bu, produit, lien, voitMarche, voitArgent, user, maintenant }: {
  base: BaseCockpit; bu: BuCockpit; produit: ProduitCockpit | null; lien: (v: Vue) => string;
  voitMarche: boolean; voitArgent: boolean; user: Parameters<typeof chargerEnveloppe>[0]; maintenant: Date;
}) {
  const [messages, depenses, enveloppe, marche] = await Promise.all([
    chargerMessages(base, bu, produit, maintenant),
    voitArgent ? chargerDepenses(base, bu, produit, maintenant) : Promise.resolve(null),
    voitArgent ? chargerEnveloppe(user, maintenant) : Promise.resolve(null),
    voitMarche ? marcheDe(produit) : Promise.resolve(null),
  ]);
  const couverture = couvertureFrequence(base.praticiens);
  const affinite = prescripteursAvecAffinite(base.praticiens.map((p) => p.segment));
  const affiniteAvant = base.precedent ? prescripteursAvecAffinite([...base.precedent.segments.values()]) : null;
  const ecart = affiniteAvant === null ? null : affinite - affiniteAvant;
  const repartition = depenses ? repartitionDepenses(depenses, base.praticiens.filter((p) => estCible(p.lettre)).length) : null;

  const tuiles: TuileCockpit[] = [];
  if (voitMarche && produit) {
    const part = marche?.part ?? null;
    const pts = part && part.precedente !== null ? (part.actuelle - part.precedente) * 100 : null;
    tuiles.push({
      label: `Part de marché${marche?.classe ? ` (${marche.classe.replace(/^[A-Z0-9]{3,5}\s+/, "").toLowerCase()}, ville)` : " (ville)"}`,
      valeur: part ? pourcent(part.actuelle, 1) : "—",
      note: !marche ? "produit absent des données marché" : !part ? "marque non reconnue dans IQVIA" : pts === null ? "IQVIA, 12 mois glissants" : `${pts >= 0 ? "+" : "−"}${Math.abs(pts).toFixed(1).replace(".", ",")} pt sur 12 mois`,
      ton: pts === null ? "muet" : pts >= 0 ? "ok" : "ko",
      info: <>Valeur de nos marques dans leur classe IQVIA (ville), 12 mois glissants ; l&apos;écart se reconstruit par la croissance de chaque ligne.</>,
    });
  } else {
    const portes = messages.reduce((s, m) => s + m.stats.portesCycle, 0);
    tuiles.push({
      label: "Messages portés ce cycle",
      valeur: String(portes),
      note: `${messages.filter((m) => m.isActive).length} message(s) actif(s)`,
      ton: "muet",
      info: <>Visites de {base.cycle.libelle} dont le rapport porte un message du périmètre.</>,
    });
  }
  tuiles.push({
    label: "Prescripteurs avec affinité (A + C)",
    valeur: base.strategie ? String(affinite) : "—",
    note: !base.strategie ? "segmentation à activer" : ecart === null ? "pas de cycle précédent" : ecart === 0 ? "stable depuis le dernier cycle" : `${ecart > 0 ? "+" : "−"}${Math.abs(ecart)} depuis le dernier cycle`,
    ton: ecart === null || ecart === 0 ? "muet" : ecart > 0 ? "ok" : "ko",
    info: <>Segment A (fort potentiel) ou C (faible potentiel) : affinité haute pour le produit, selon les règles de la Segmentation.</>,
  });
  tuiles.push({
    label: "Cibles H · A · B vues à fréquence",
    valeur: pourcent(couverture.taux),
    note: "source : Force de vente",
    ton: "muet",
    info: <>{couverture.tenues} cible(s) sur {couverture.cibles} ont eu, pendant {base.cycle.libelle}, au moins les visites que la Segmentation requiert.</>,
  });
  if (voitArgent) {
    const taux = enveloppe && enveloppe.total > 0 ? enveloppe.consomme / enveloppe.total : null;
    tuiles.push({
      label: "Budget consommé",
      valeur: pourcent(taux),
      note: enveloppe ? `à ${pourcent(enveloppe.tempsEcoule)} de ${enveloppe.annee}` : "aucune enveloppe marketing ouverte",
      ton: "muet",
      info: enveloppe ? <>Budget Marketing, enveloppe « {enveloppe.nom} » : {montantDzd(enveloppe.consomme)} réglés sur {montantDzd(enveloppe.total)} DZD.</> : undefined,
      href: userCan(user, "BUDGET_MARKETING", "VIEW") ? `${CHEMIN_BUDGET_MARKETING}${enveloppe ? `?env=${enveloppe.id}` : ""}` : undefined,
    });
  }
  const leaders = base.panel.filter((l) => l.statut && STATUTS_LEADERS.includes(l.statut));
  const oublies = leaders.filter((l) => !(base.visites.get(l.doctorId)?.six));
  if (!voitArgent) {
    tuiles.push({
      label: "Leaders d'opinion",
      valeur: String(leaders.length),
      note: oublies.length ? `${oublies.length} sans visite depuis 6 mois` : "tous vus en 6 mois",
      ton: oublies.length ? "ko" : "muet",
    });
  }

  // CE QUI BOUGE — des signaux calculés, chacun avec la page qui le montre.
  const signaux: SignalCockpit[] = [];
  if (base.precedent) {
    const n = passesEnA(base.precedent.segments, base.segmentDe);
    if (n > 0) signaux.push({ ton: "ok", titre: `${n} médecin${n > 1 ? "s" : ""} passé${n > 1 ? "s" : ""} en A`, detail: `depuis « ${base.precedent.libelle} »`, href: base.strategie ? `/segmentation?s=${base.strategie.id}&vue=praticiens` : lien("leaders") });
  }
  const amm = marche?.nouvellesAmm[0];
  if (voitMarche && amm) {
    signaux.push({ ton: "ko", titre: `Concurrent : AMM ${amm.marque}`, detail: `${amm.labo} · Nomenclature, ${amm.le.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`, href: lien("marche") });
  }
  if (repartition?.partCDCongresEvenements) {
    signaux.push({ ton: "w", titre: `${pourcent(repartition.partCDCongresEvenements)} du budget congrès et événements sur des C et D`, detail: "dépenses nominatives, 12 mois", href: lien("investissements") });
  }
  const faible = messagePeuPorte(messages.map((m) => ({ ...m, actif: m.isActive })), base.delegues);
  if (faible) {
    signaux.push({ ton: "i", titre: `Message « ${faible.title} » peu porté`, detail: `${faible.stats.portesCycle} fois ce cycle, ${faible.stats.delegues} délégué${faible.stats.delegues > 1 ? "s" : ""} sur ${base.delegues}`, href: lien("messages") });
  }
  if (oublies.length) {
    signaux.push({ ton: "w", titre: `${oublies.length} leader${oublies.length > 1 ? "s" : ""} d'opinion sans visite depuis 6 mois`, detail: "décideurs, influenceurs, référents", href: lien("leaders") });
  }

  const e = entonnoir(base.annuaire ?? 0, base.praticiens);
  return (
    <div className="space-y-4">
      <Tuiles tuiles={tuiles} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {base.strategie
          ? <CarteEntonnoir e={{ ...e, annuaireConnu: base.annuaire !== null }} sousTitre={produit?.nom ?? `BU ${bu.nom}`} />
          : <Carte titre="De l'annuaire à la prescription"><Vide>La segmentation de la BU n&apos;est pas activée.</Vide></Carte>}
        <CarteSignaux signaux={signaux.slice(0, 5)} />
      </div>
    </div>
  );
}

// ───────────────────────────── Leaders ─────────────────────────────

async function VueLeadersSection({ base, maintenant }: { base: BaseCockpit; maintenant: Date }) {
  const leaders = await chargerLeaders(base, maintenant);
  return <VueLeaders leaders={leaders} maintenant={maintenant} lienFiche={(l) => (l.specialiteId ? `/annuaires/medecins?specialite=${l.specialiteId}` : "/annuaires/medecins")} />;
}

// ───────────────────────────── Messages ─────────────────────────────

async function VueMessages({ base, bus, bu, produit, user, maintenant }: {
  base: BaseCockpit; bus: BuCockpit[]; bu: BuCockpit; produit: ProduitCockpit | null; user: Parameters<typeof chargerEnveloppe>[0]; maintenant: Date;
}) {
  const [messages, settings] = await Promise.all([chargerMessages(base, bu, produit, maintenant), getAppSettings()]);
  const roles = settings.promoMessageAuthorRoles;
  const produits = new Map<string, string>();
  for (const b of bus) for (const p of b.produits) if (p.productId && !produits.has(p.productId)) produits.set(p.productId, p.nom);
  return (
    <MessagesManager
      titre={`Messages · ${produit?.nom ?? `BU ${bu.nom}`}`}
      messages={messages.map((m: LigneMessage) => ({
        id: m.id, title: m.title, body: m.body, businessUnitId: m.businessUnitId, productId: m.productId, portee: m.portee,
        isActive: m.isActive, sortOrder: m.sortOrder, usages: m.usages,
        portesCycle: m.stats.portesCycle, parLettre: m.stats.parLettre, delegues: m.stats.delegues, tendance: m.stats.tendance,
      }))}
      deleguesBu={base.delegues}
      droits={{
        creer: peutEcrireMessagesCockpit(user, roles, "CREATE"),
        modifier: peutEcrireMessagesCockpit(user, roles, "UPDATE"),
        retirer: peutEcrireMessagesCockpit(user, roles, "DELETE"),
      }}
      bus={bus.map((b) => ({ id: b.id, name: b.nom }))}
      produits={[...produits].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"))}
      defauts={{ businessUnitId: bu.id, productId: produit?.productId ?? null }}
      cycle={base.cycle.libelle}
    />
  );
}

// ───────────────────────────── Marché ─────────────────────────────

async function VueMarche({ produit }: { produit: ProduitCockpit | null }) {
  if (!produit) return <Carte titre="Marché"><Vide>Choisissez un produit pour lire son marché.</Vide></Carte>;
  const m = await marcheDe(produit);
  if (!m) return <Carte titre="Marché"><Vide>{produit.nom} n&apos;est pas reconnu dans les données marché (IQVIA, PCH, Nomenclature).</Vide></Carte>;
  const part = m.part;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Carte
        titre="Part de marché sur 12 mois"
        sousTitre={`${m.molecule.toLowerCase()} · réceptions hôpital (PCH)`}
        info={<>IQVIA ne donne qu&apos;un cumul annuel : la série mensuelle est celle des réceptions hospitalières PCH, part de chaque laboratoire dans la molécule. La part en ville est celle de nos marques dans leur classe IQVIA.</>}
      >
        {part && (
          <p className="border-b border-border px-4 py-2 text-sm">
            <span className="text-muted-foreground">Ville (IQVIA){m.classe ? ` · ${m.classe.toLowerCase()}` : ""} : </span>
            <b className="tabular-nums">{pourcent(part.actuelle, 1)}</b>
            {part.precedente !== null && <span className="text-muted-foreground"> · il y a un an {pourcent(part.precedente, 1)}</span>}
          </p>
        )}
        {m.serie ? (
          <div className="px-2 py-3"><Courbes mois={m.serie.mois} lignes={m.serie.lignes} libelleMois={libelleMois} /></div>
        ) : <Vide>Aucune réception hospitalière de {m.molecule.toLowerCase()} dans les données PCH.</Vide>}
        {m.serie && !m.serie.lignes.some((l) => l.nous) && (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Nos marques n&apos;apparaissent pas dans les réceptions PCH de la molécule.</p>
        )}
      </Carte>
      <CarteASurveiller signaux={m.aSurveiller} />
    </div>
  );
}

// ───────────────────────────── Investissements ─────────────────────────────

async function VueInvestissements({ base, bu, produit, user, maintenant }: {
  base: BaseCockpit; bu: BuCockpit; produit: ProduitCockpit | null; user: Parameters<typeof chargerEnveloppe>[0]; maintenant: Date;
}) {
  const [depenses, enveloppe] = await Promise.all([chargerDepenses(base, bu, produit, maintenant), chargerEnveloppe(user, maintenant)]);
  const cibles = base.praticiens.filter((p) => estCible(p.lettre)).length;
  const r = repartitionDepenses(depenses, cibles);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <CarteOuVaLArgent lignes={r.lignes} total={r.total} />
      <CarteEnveloppe e={enveloppe} lien={userCan(user, "BUDGET_MARKETING", "VIEW") ? CHEMIN_BUDGET_MARKETING : null} />
    </div>
  );
}
