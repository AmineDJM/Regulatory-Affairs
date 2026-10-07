import Link from "next/link";
import { cn } from "@/lib/utils";
import { InfoBulle } from "@/components/ui/info-bulle";
import { STATUT_LABELS, type Statut } from "@/lib/segmentation/regles";
import { LettreBadge } from "@/app/(app)/segmentation/lettre-badge";
import {
  NATURE_LABELS, joursDepuis, montantDzd, pourcent, type Entonnoir, type LigneNature, type LigneSerie,
} from "@/lib/marketing-cockpit/calculs";
import type { EnveloppeCockpit, LigneLeader } from "@/lib/marketing-cockpit/donnees";
import type { SignalMarche } from "@/lib/marketing-cockpit/marche";
import { LigneLien } from "./ligne-lien";
import { Pilule } from "./pastilles";

/**
 * LES VUES DU MARKETING COCKPIT — des composants SERVEUR qui ne lisent rien : ils reçoivent des chiffres déjà calculés
 * (`marketing-cockpit/donnees.ts`, `calculs.ts`) et les montrent comme la maquette validée (07/10). Peu de texte ;
 * le « comment c'est calculé » vit derrière ⓘ.
 */

const STICKY = "sticky left-0 z-[1] bg-card group-hover:bg-secondary";
const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground";

export function Carte({ titre, sousTitre, info, action, children, className }: {
  titre: string; sousTitre?: string | null; info?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("surface min-w-0 overflow-hidden rounded-xl", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          {titre}
          {info && <InfoBulle label={`À propos : ${titre}`}>{info}</InfoBulle>}
        </h2>
        {action ?? (sousTitre ? <span className="text-[13px] text-muted-foreground">{sousTitre}</span> : null)}
      </header>
      {children}
    </section>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted-foreground">{children}</p>;
}

// ───────────────────────────── Vue d'ensemble ─────────────────────────────

export interface TuileCockpit { label: string; valeur: string; note?: string | null; ton?: "ok" | "ko" | "muet"; info?: React.ReactNode }

export function Tuiles({ tuiles }: { tuiles: TuileCockpit[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {tuiles.map((t) => (
        <div key={t.label} className="surface flex min-w-0 flex-col gap-0.5 rounded-xl px-3.5 py-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">{t.label}</span>
            {t.info && <InfoBulle label={`À propos : ${t.label}`}>{t.info}</InfoBulle>}
          </span>
          <strong className="text-[22px] font-semibold tabular-nums">{t.valeur}</strong>
          {t.note && <span className={cn("text-xs", t.ton === "ok" ? "text-success" : t.ton === "ko" ? "text-destructive" : "text-muted-foreground")}>{t.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function CarteEntonnoir({ e, sousTitre }: { e: Entonnoir & { annuaireConnu: boolean }; sousTitre: string }) {
  const marches: { label: string; n: number | null; vert?: boolean }[] = [
    { label: "Annuaire (spécialités ciblées)", n: e.annuaireConnu ? e.annuaire : null },
    { label: "Segmentés (Q1, Q2)", n: e.segmentes },
    { label: "Ciblés H · A · B", n: e.cibles },
    { label: "Vus ce cycle", n: e.vus },
    { label: "À la bonne fréquence", n: e.aFrequence },
    { label: "Avec affinité (A)", n: e.affinite, vert: true },
  ];
  const max = Math.max(1, ...marches.map((m) => m.n ?? 0));
  return (
    <Carte
      titre="De l'annuaire à la prescription"
      sousTitre={sousTitre}
      info={<>Annuaire : médecins des spécialités que le produit vise dans la BU (sinon celles de la BU). Segmentés : potentiel et affinité renseignés. Lettres et fréquences : le moteur de la Segmentation. Visites : terminées, Force de vente.</>}
    >
      <div className="flex flex-col gap-2 px-4 py-3.5">
        {marches.map((m) => (
          <div key={m.label} className="grid grid-cols-[120px_minmax(0,1fr)_50px] items-center gap-2.5 text-[13px] sm:grid-cols-[170px_minmax(0,1fr)_60px]">
            <span className="[overflow-wrap:anywhere]">{m.label}</span>
            <div className="h-[22px] rounded-md bg-muted/60">
              <div className={cn("h-full rounded-md", m.vert ? "bg-success/85" : "bg-primary/85")} style={{ width: `${m.n ? Math.max(1.5, (m.n / max) * 100) : 0}%` }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{m.n ?? "—"}</span>
          </div>
        ))}
      </div>
    </Carte>
  );
}

export interface SignalCockpit { ton: "ok" | "ko" | "w" | "i"; titre: string; detail: string; href: string }

const POINT: Record<SignalCockpit["ton"], string> = { ok: "bg-success", ko: "bg-destructive", w: "bg-warning", i: "bg-primary" };

export function CarteSignaux({ signaux }: { signaux: SignalCockpit[] }) {
  return (
    <Carte titre="Ce qui bouge">
      {signaux.length === 0 ? <Vide>Rien de notable ce cycle.</Vide> : signaux.map((s) => (
        <div key={s.titre} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-0">
          <i aria-hidden className={cn("inline-block h-2 w-2 rounded-full", POINT[s.ton])} />
          <div className="min-w-0">
            <b className="block font-medium [overflow-wrap:anywhere]">{s.titre}</b>
            <small className="block text-xs text-muted-foreground">{s.detail}</small>
          </div>
          <Link href={s.href} className="inline-flex h-9 items-center rounded-[var(--radius)] border border-border bg-card px-2.5 text-xs font-medium hover:bg-secondary sm:h-8">Voir</Link>
        </div>
      ))}
    </Carte>
  );
}

// ───────────────────────────── Leaders d'opinion ─────────────────────────────

const TON_STATUT: Record<Statut, "violet" | "info" | "muet" | "warning"> = { DECIDEUR: "violet", INFLUENCEUR: "info", REFERENT: "warning", PRESCRIPTEUR: "muet" };

export function VueLeaders({ leaders, maintenant, lienFiche }: { leaders: LigneLeader[]; maintenant: Date; lienFiche: (l: LigneLeader) => string }) {
  const investi = leaders.some((l) => l.investi !== null);
  return (
    <Carte
      titre="Leaders d'opinion"
      sousTitre="décideurs, influenceurs et référents de la segmentation"
      info={<>Statut posé dans la Segmentation. Dernière visite : visite terminée la plus récente (en rouge au-delà de 30 jours). Ad &amp; Pro : congrès où il est pris en charge ou invité, sponsoring et événements qui le nomment, sur 12 mois. Investi : prises en charge à son nom et sponsoring à son seul nom.</>}
    >
      {leaders.length === 0 ? <Vide>Aucun décideur, influenceur ni référent dans la segmentation de cette BU.</Vide> : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className={cn(TH, "sticky left-0 z-[1] bg-card")}>Praticien</th>
                <th className={TH}>Statut</th>
                <th className={cn(TH, "text-center")}>Lettre</th>
                <th className={TH}>Dernière visite</th>
                <th className={cn(TH, "text-center")}>Visites (6 mois)</th>
                <th className={TH}>Ad &amp; Pro (12 mois)</th>
                {investi && <th className={cn(TH, "text-right")}>Investi</th>}
              </tr>
            </thead>
            <tbody>
              {leaders.map((l) => {
                const j = joursDepuis(l.derniereVisite, maintenant);
                return (
                  <LigneLien key={l.doctorId} href={lienFiche(l)} label={`Ouvrir l'annuaire de ${l.nom}`}>
                    <td className={cn("max-w-[260px] px-3 py-2.5", STICKY)}>
                      <b className="block font-medium [overflow-wrap:anywhere]">{l.nom}</b>
                      <small className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{[l.etablissement, l.specialite].filter(Boolean).join(" · ") || "—"}</small>
                    </td>
                    <td className="px-3 py-2.5"><Pilule ton={TON_STATUT[l.statut]}>{STATUT_LABELS[l.statut]}</Pilule></td>
                    <td className="px-3 py-2.5 text-center"><LettreBadge lettre={l.lettre} /></td>
                    <td className={cn("whitespace-nowrap px-3 py-2.5", (j === null || j > 30) && "text-destructive")}>{j === null ? "jamais" : j === 0 ? "aujourd'hui" : `il y a ${j} j`}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.visites6}</td>
                    <td className={cn("max-w-[280px] px-3 py-2.5 [overflow-wrap:anywhere]", l.adPro.length === 0 && "text-muted-foreground")}>{l.adPro.length ? l.adPro.join(" · ") : "—"}</td>
                    {investi && <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", l.investi === null && "text-muted-foreground")}>{l.investi === null ? "—" : montantDzd(l.investi)}</td>}
                  </LigneLien>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}

// ───────────────────────────── Marché ─────────────────────────────

const COULEURS = ["hsl(var(--muted-foreground))", "hsl(var(--warning))", "hsl(var(--success))"];

/** La courbe des parts mensuelles — « nous » en trait plein, les concurrents à côté ; les trous restent des trous. */
export function Courbes({ mois, lignes, libelleMois }: { mois: string[]; lignes: LigneSerie[]; libelleMois: (m: string) => string }) {
  const x0 = 44, x1 = 510, y0 = 160, y1 = 18;
  const valeurs = lignes.flatMap((l) => l.parts.filter((v): v is number => v !== null));
  const max = Math.max(0.01, ...valeurs);
  const x = (i: number) => x0 + (mois.length > 1 ? (i * (x1 - x0)) / (mois.length - 1) : 0);
  const y = (v: number) => y0 - (v / max) * (y0 - y1);
  let autre = 0;
  const traces = lignes.map((l) => {
    const couleur = l.nous ? "hsl(var(--primary))" : COULEURS[autre++ % COULEURS.length];
    const pts = l.parts.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v })).filter((p): p is { x: number; y: number; v: number } => p !== null);
    return { l, couleur, pts, fin: pts[pts.length - 1] ?? null };
  });
  // Les étiquettes de fin ne se chevauchent pas : on les écarte de 13 px au besoin.
  const etiquettes = traces.filter((t) => t.fin).map((t) => ({ t, y: t.fin!.y - 5 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < etiquettes.length; i++) if (etiquettes[i].y - etiquettes[i - 1].y < 13) etiquettes[i].y = etiquettes[i - 1].y + 13;
  return (
    <svg viewBox="0 0 520 190" width="100%" role="img" aria-label={`Parts de marché mensuelles : ${traces.map((t) => `${t.l.nom} ${pourcent(t.fin?.v ?? null, 1)}`).join(", ")}`}>
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="hsl(var(--border))" />
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="hsl(var(--border))" strokeDasharray="2 4" />
      <text x={x0 - 6} y={y1 + 4} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="end">{pourcent(max)}</text>
      <text x={x0 - 6} y={y0 + 4} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="end">0 %</text>
      {traces.map((t) => (
        <polyline key={t.l.cle} points={t.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={t.couleur}
          strokeWidth={t.l.nous ? 2.5 : 2} strokeDasharray={t.l.nous ? undefined : "4 3"} strokeLinejoin="round" />
      ))}
      {etiquettes.map(({ t, y: ly }) => (
        <text key={t.l.cle} x={x1 + 2} y={ly} fontSize="11" fill={t.couleur} textAnchor="end" fontWeight={t.l.nous ? 600 : 400}>
          {`${t.l.nom.length > 22 ? `${t.l.nom.slice(0, 21)}…` : t.l.nom} ${pourcent(t.fin!.v, 1)}`}
        </text>
      ))}
      <text x={x0} y={178} fontSize="11" fill="hsl(var(--muted-foreground))">{libelleMois(mois[0])}</text>
      <text x={x1} y={178} fontSize="11" fill="hsl(var(--muted-foreground))" textAnchor="end">{libelleMois(mois[mois.length - 1])}</text>
    </svg>
  );
}

const POINT_MARCHE: Record<SignalMarche["ton"], string> = { ok: "bg-success", ko: "bg-destructive", w: "bg-warning", i: "bg-primary" };

export function CarteASurveiller({ signaux }: { signaux: SignalMarche[] }) {
  return (
    <Carte titre="À surveiller" sousTitre="Nomenclature, IQVIA, PCH">
      {signaux.length === 0 ? <Vide>Rien de notable dans les données marché.</Vide> : signaux.map((s) => (
        <div key={s.titre} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-0">
          <i aria-hidden className={cn("inline-block h-2 w-2 rounded-full", POINT_MARCHE[s.ton])} />
          <div className="min-w-0">
            <b className="block font-medium [overflow-wrap:anywhere]">{s.titre}</b>
            <small className="block text-xs text-muted-foreground">{s.detail}</small>
          </div>
        </div>
      ))}
    </Carte>
  );
}

// ───────────────────────────── Investissements ─────────────────────────────

export function CarteOuVaLArgent({ lignes, total }: { lignes: LigneNature[]; total: number }) {
  return (
    <Carte
      titre="Où va l'argent · 12 mois"
      sousTitre="Ad & Pro rattaché au périmètre"
      info={<>Engagé : postes accordés (congrès, sponsoring, événements) et matériel au devis retenu. Pour un produit : la part que ses imputations lui donnent, ou la règle de répartition de la BU. Lettres : praticiens nommés par la demande, au prorata. Par cible : engagé ÷ cibles H · A · B.</>}
    >
      {total === 0 ? <Vide>Aucune dépense Ad &amp; Pro rattachée sur 12 mois.</Vide> : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className={cn(TH, "sticky left-0 z-[1] bg-card")}>Nature</th>
                <th className={cn(TH, "text-right")}>Engagé</th>
                <th className={TH}>Sur quelles lettres</th>
                <th className={cn(TH, "text-right")}>Par cible H · A · B</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.nature} className="group border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className={cn("whitespace-nowrap px-3 py-2.5", STICKY)}>{NATURE_LABELS[l.nature]}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", l.engage === 0 && "text-muted-foreground")}>{l.engage ? montantDzd(l.engage) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {l.partCibles === null ? (
                      <span className="text-xs text-muted-foreground">{l.engage ? "non nominatif" : "—"}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-[110px] overflow-hidden rounded-full bg-muted">
                          <i className={cn("block h-full", l.partCibles >= 0.75 ? "bg-success" : "bg-warning")} style={{ width: `${Math.round(l.partCibles * 100)}%` }} />
                        </span>
                        <span className="text-xs text-muted-foreground">{pourcent(l.partCibles)} sur H · A · B</span>
                      </span>
                    )}
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-right tabular-nums", l.parCible === null && "text-muted-foreground")}>{l.parCible === null ? "—" : montantDzd(l.parCible)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}

export function CarteEnveloppe({ e }: { e: EnveloppeCockpit | null }) {
  if (!e) {
    return <Carte titre="Enveloppe"><Vide>Aucune enveloppe Ad &amp; Pro en cours ne vous est ouverte.</Vide></Carte>;
  }
  const taux = e.total > 0 ? e.consomme / e.total : null;
  return (
    <Carte titre={`Enveloppe ${e.annee}`} sousTitre={e.nom} info={<>Les chiffres de l&apos;écran Budgets : consommé = dépenses réglées, engagé = en attente de paiement, disponible = total − consommé − engagé.</>}>
      <div className="flex flex-col gap-2.5 px-4 py-3.5 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">Consommé</span><b className="tabular-nums">{montantDzd(e.consomme)} / {montantDzd(e.total)}</b></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <i className={cn("block h-full", taux !== null && taux > e.tempsEcoule + 0.1 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, Math.round((taux ?? 0) * 100))}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">Engagé non payé</span><b className="tabular-nums">{montantDzd(e.engage)}</b></div>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">Disponible</span><b className={cn("tabular-nums", e.disponible < 0 ? "text-destructive" : "text-success")}>{montantDzd(e.disponible)}</b></div>
      </div>
    </Carte>
  );
}
