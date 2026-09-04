"use client";

import * as React from "react";
import { CalendarClock, ChevronDown, ChevronRight, Loader2, Mail, Phone, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/labels";
import type { TeamMember } from "@/lib/queries/my-team";
import type { TeamKpi, TeamKpiTone } from "@/lib/hr/team-kpis";
import type { TeamMemberKpis } from "@/lib/queries/team-kpis";
import { teamMemberKpis } from "@/lib/actions/my-team-actions";

/**
 * L'ARBRE DE L'ÉQUIPE — mes N-1, leurs N-1, jusqu'en bas ; et les indicateurs au clic.
 *
 * ── POURQUOI UNE INDENTATION, ET PAS UN ORGANIGRAMME ────────────────────────────────────────
 *
 * Un organigramme dessiné (des boîtes, des traits) est superbe pour douze personnes et
 * illisible pour quarante — il faut faire défiler dans deux directions, et sur un téléphone il
 * ne tient tout simplement pas. Une liste indentée dit la même chose (qui dépend de qui, et à
 * quel rang) en se lisant de haut en bas, comme tout le reste de l'outil.
 *
 * Le serveur rend déjà les personnes DANS L'ORDRE DE L'ARBRE : un chef, puis ses gens, puis le
 * chef suivant. La page n'a donc rien à recalculer — elle décale, et c'est tout.
 *
 * ── POURQUOI LES INDICATEURS ARRIVENT AU CLIC ───────────────────────────────────────────────
 *
 * Sept compteurs pour quarante personnes, ce sont plusieurs centaines d'agrégats à l'ouverture
 * de l'écran, pour trois cartes qu'on dépliera. On charge donc quand on ouvre — et une fois
 * chargé, on garde : replier puis rouvrir ne redemande rien.
 */

const TONE_CLASS: Record<TeamKpiTone, string> = {
  default: "text-foreground",
  info: "text-blue-600",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function TeamTree({ members }: { members: TeamMember[] }) {
  return (
    <div className="space-y-2">
      {members.map((m) => <MemberRow key={m.employeeId} m={m} />)}
    </div>
  );
}

function MemberRow({ m }: { m: TeamMember }) {
  const [open, setOpen] = React.useState(false);
  const [kpis, setKpis] = React.useState<TeamMemberKpis | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const basculer = async () => {
    const ouvrir = !open;
    setOpen(ouvrir);
    // Déjà chargé : on ne redemande pas. Les compteurs d'une journée ne bougent pas entre deux
    // clics, et rappeler le serveur à chaque repli ferait clignoter la carte pour rien.
    if (!ouvrir || kpis || busy) return;
    setBusy(true); setErr(null);
    const r = await teamMemberKpis(m.employeeId).catch(() => null);
    setBusy(false);
    if (r?.ok) setKpis(r.kpis);
    else setErr(r?.error ?? "Les indicateurs n'ont pas pu être chargés.");
  };

  const finContrat = m.contractEnd ? daysUntil(m.contractEnd) : null;
  // L'indentation dit le RANG. Bornée : au-delà de cinq niveaux, la colonne de gauche mangerait
  // la carte sur un téléphone, et le rang se lit de toute façon dans la puce « N-x ».
  const decalage = Math.min(m.depth - 1, 5) * 20;

  return (
    <div style={{ marginLeft: decalage }}>
      <Card className={cn(open && "border-primary/40")}>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={basculer}
            aria-expanded={open}
            className="flex w-full items-start gap-2.5 p-4 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.fullName}</span>
                {m.depth > 1 && <Badge tone="neutral" dot={false}>N-{m.depth}</Badge>}
                {m.absentToday && <Badge tone="info" dot={false}><Plane className="mr-1 inline h-3 w-3" /> absent·e aujourd&apos;hui</Badge>}
                {m.pending > 0 && <Badge tone="warning" dot={false}>{m.pending} à décider</Badge>}
                {finContrat !== null && finContrat <= 60 && (
                  <Badge tone="danger" dot={false}>
                    <CalendarClock className="mr-1 inline h-3 w-3" />
                    contrat : {finContrat < 0 ? "échu" : `${finContrat} j`}
                  </Badge>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {[m.position, m.department].filter(Boolean).join(" · ") || "Fonction non renseignée"}
                {m.role ? ` · ${ROLE_LABELS[m.role] ?? m.role}` : ""}
              </span>
            </span>
          </button>

          {open && (
            <div className="space-y-3 border-t border-border px-4 py-3">
              {/* JOINDRE QUELQU'UN NE DOIT PAS DEMANDER UN DÉTOUR PAR LES RH. */}
              {(m.email || m.phone) && (
                <p className="flex flex-wrap items-center gap-3 text-xs">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Mail className="h-3 w-3" /> {m.email}
                    </a>
                  )}
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="h-3 w-3" /> {m.phone}
                    </a>
                  )}
                </p>
              )}

              {m.nextLeave && (
                <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                  Prochaine absence : du {formatDate(m.nextLeave.start)} au {formatDate(m.nextLeave.end)}
                </p>
              )}

              {busy && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des indicateurs…
                </p>
              )}
              {err && <p className="text-xs text-destructive">{err}</p>}
              {kpis && <KpiBlocks k={kpis} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiBlocks({ k }: { k: TeamMemberKpis }) {
  return (
    <div className="space-y-3">
      <KpiRow title="Charge de travail" kpis={k.common} />
      {k.job_.length > 0 && <KpiRow title={k.jobLabel} kpis={k.job_} />}
      {k.note && <p className="text-xs italic text-muted-foreground">{k.note}</p>}
    </div>
  );
}

function KpiRow({ title, kpis }: { title: string; kpis: TeamKpi[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2">
            <p className={cn("text-lg font-semibold tabular-nums", TONE_CLASS[kpi.tone ?? "default"])}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            {kpi.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
