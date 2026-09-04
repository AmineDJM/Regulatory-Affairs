import Link from "next/link";
import { ExternalLink, UserPlus } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getMyTeam, type TeamPending } from "@/lib/queries/my-team";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateTime, daysUntil } from "@/lib/utils";
import { TeamTree } from "./team-tree";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon Équipe — AMD Internal OS" };

const KIND_LABEL: Record<TeamPending["kind"], string> = {
  LEAVE: "Congé",
  PURCHASE: "Achat",
  TRAINING: "Formation",
};

/**
 * MON ÉQUIPE — l'écran de celui qui ENCADRE.
 *
 * ── CE QU'IL EST, ET CE QU'IL N'EST PAS ─────────────────────────────────────────────────────
 *
 * Ce n'est pas un mini-module RH : un encadrant n'administre pas les fiches, ne touche pas aux
 * salaires et n'ouvre pas les dossiers. Cela reste aux ressources humaines, et le recopier ici
 * ouvrirait une seconde porte sur des données qu'on a cloisonnées exprès.
 *
 * C'est l'écran de trois questions : **qui est dans mon équipe**, **qu'est-ce qui m'attend**
 * (congés, achats, formations — ce qui dort chez moi et bloque quelqu'un), et **qui est là
 * cette semaine**. Ces trois réponses existaient déjà, éparpillées dans autant d'écrans qu'il y
 * a de circuits : on découvrait une demande de congé vieille de six jours en cherchant autre
 * chose.
 *
 * ── L'ÉQUIPE SE DÉDUIT ──────────────────────────────────────────────────────────────────────
 *
 * Personne ne « déclare » son équipe : elle est l'ensemble des gens dont la cascade
 * hiérarchique dit que je suis le N+1 — la MÊME fonction qui route leurs demandes vers moi. Les
 * deux ne peuvent donc pas diverger : personne n'apparaît ici sans que ses demandes m'arrivent.
 *
 * ── ET ELLE DESCEND JUSQU'EN BAS ────────────────────────────────────────────────────────────
 *
 * L'écran s'arrêtait aux N-1. Pour un directeur, c'étaient quatre cartes qui cachaient quarante
 * personnes : celles qui font le travail sont toutes au deuxième rang, et l'on n'avait aucun
 * moyen de savoir qui — sinon en ouvrant l'organigramme des ressources humaines, c'est-à-dire un
 * écran qu'un encadrant n'a en général pas le droit d'ouvrir. On montre donc TOUT l'arbre, avec
 * son indentation : savoir que Untel dépend de Unetelle, c'est savoir à qui s'adresser.
 *
 * **Ce qui attend ma décision, lui, reste au premier rang** : la demande d'un N-2 est routée
 * vers SON N+1. La faire remonter ici m'afficherait une décision que je n'ai pas à prendre.
 *
 * ── QUELQUES INDICATEURS, AU CLIC ET SELON LE MÉTIER ────────────────────────────────────────
 *
 * On déplie une carte, on obtient sa charge de travail et les compteurs de SON métier — visites
 * pour un délégué, dossiers pour les affaires réglementaires, courses pour un coordinateur. Un
 * jeu unique pour tout le monde produirait trois zéros et une colonne vide, et des zéros qui ne
 * veulent rien dire abîment ceux qui veulent dire quelque chose.
 *
 * ── RECRUTEMENT ─────────────────────────────────────────────────────────────────────────────
 *
 * Le module a rejoint ce pôle dans le menu : recruter est le geste d'un encadrant à qui il
 * manque quelqu'un, pas une affaire d'Administration. Ses DROITS n'ont pas bougé — `RECRUITMENT`
 * reste un module à part, réglable seul dans la console, et son écran garde sa propre garde.
 */
export default async function MonEquipePage() {
  const user = await requireModule("MY_TEAM");
  const { selfEmployeeId, members, directCount, depth, pending } = await getMyTeam(user);
  const canRecruit = userCan(user, "RECRUITMENT", "CREATE");

  if (!selfEmployeeId) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mon Équipe" description="L'écran de celui qui encadre : son équipe, ce qui attend sa décision, et qui est absent." />
        <EmptyState
          icon="UserSearch"
          title="Aucune fiche employé n'est rattachée à votre compte"
          description="Votre équipe se déduit de l'organigramme. Demandez aux ressources humaines de rattacher votre fiche : sans elle, la hiérarchie ne sait pas qui vous encadrez."
        />
      </div>
    );
  }

  const absents = members.filter((m) => m.absentToday);
  // Une fin de contrat se prépare : à moins de deux mois, c'est l'encadrant qui doit lancer le
  // renouvellement ou le remplacement — les RH ne le devineront pas à sa place.
  const echeances = members.filter((m) => m.contractEnd && (daysUntil(m.contractEnd) ?? 999) <= 60);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mon Équipe"
        description="Tout votre monde, tel que l'organigramme le définit : vos N-1, leurs N-1, jusqu'en bas. Ce qui attend votre décision est en tête — c'est ce qui bloque quelqu'un. Ouvrez une personne pour voir ses indicateurs."
      >
        {canRecruit && (
          <Link
            href="/recrutement"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <UserPlus className="h-4 w-4" /> Demander un recrutement
          </Link>
        )}
      </PageHeader>

      {members.length === 0 ? (
        <EmptyState
          icon="Users"
          title="Personne ne vous est rattaché"
          description="Aucun employé n'a votre fiche pour N+1 — ni par manager explicite, ni par responsabilité de département. Si cela vous surprend, c'est l'organigramme qu'il faut corriger : c'est lui qui route aussi les demandes."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard
              label="Dans l'équipe" value={members.length} icon="Users"
              // LE TOTAL EST CELUI DE L'ARBRE ENTIER, et le premier rang se lit à côté : pour un
              // directeur, « 4 » et « 41 » ne racontent pas la même entreprise.
              hint={depth > 1 ? `dont ${directCount} en direct · ${depth} niveaux` : undefined}
            />
            <KpiCard
              label="À décider" value={pending.length} icon="ShieldCheck"
              tone={pending.length > 0 ? "warning" : "default"}
              hint={pending.length > 0 ? "Ce qui bloque quelqu'un" : undefined}
            />
            <KpiCard label="Absents aujourd'hui" value={absents.length} icon="Plane" tone={absents.length > 0 ? "info" : "default"} />
            <KpiCard
              label="Contrats à échéance" value={echeances.length} icon="CalendarClock"
              tone={echeances.length > 0 ? "danger" : "default"} hint="≤ 60 jours"
            />
          </div>

          {/* CE QUI ATTEND MA DÉCISION — en tête, parce que c'est ce qui fait attendre
              quelqu'un. La plus ancienne d'abord : c'est elle qui attend depuis le plus
              longtemps, et non la plus récente, qui se voit déjà. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              À décider ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <EmptyState icon="CheckCheck" title="Rien ne vous attend" description="Les congés, achats et formations de votre équipe qui requièrent votre accord apparaîtront ici." />
            ) : (
              <div className="space-y-2">
                {pending.map((p) => <PendingRow key={p.id} p={p} />)}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              L&apos;équipe ({members.length})
            </h2>
            <TeamTree members={members} />
          </section>
        </>
      )}
    </div>
  );
}

/** Une décision en attente, avec ce qu'il faut pour la prendre — et le lien pour la prendre. */
function PendingRow({ p }: { p: TeamPending }) {
  const jours = p.deadline ? daysUntil(p.deadline) : null;
  const imminent = jours !== null && jours <= 3;
  return (
    <Card className={imminent ? "border-warning/50" : undefined}>
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 text-sm">
        <Badge tone="neutral" dot={false}>{KIND_LABEL[p.kind]}</Badge>
        <span className="font-medium">{p.who}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {p.title}
          {p.detail ? ` · ${p.detail}` : ""}
        </span>
        {p.amount != null && <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>}
        {p.deadline && (
          <span className={`text-xs ${imminent ? "font-medium text-warning" : "text-muted-foreground"}`}>
            {p.kind === "LEAVE" ? "départ le " : "le "}{formatDate(p.deadline)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">demandé le {formatDateTime(p.createdAt)}</span>
        <Link
          href={p.href}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
        >
          Traiter <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
