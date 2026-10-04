import Link from "next/link";
import { ExternalLink, UserPlus } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getAppSettings } from "@/lib/settings";
import { getMyTeam, type ChevauchementDEquipe, type TeamPending } from "@/lib/queries/my-team";
import { peutOuvrirModule } from "@/lib/queries/lien-ouvrable";
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
  RECRUITMENT: "Recrutement",
  TOUR_PLAN: "Plan de tournée",
};

/** Ce que dit l'échéance d'une ligne — un `Record` : une nature ajoutée sans sa phrase ne compile pas. */
const ECHEANCE: Record<TeamPending["kind"], string> = {
  LEAVE: "départ le ",
  PURCHASE: "le ",
  TRAINING: "le ",
  RECRUITMENT: "prise de poste souhaitée le ",
  TOUR_PLAN: "le ",
};

/**
 * UN JOUR S'AFFICHE COMME IL A ÉTÉ ÉCRIT — à minuit UTC (§118.196, lot E3, M21). Le lire dans le fuseau du serveur
 * ou du navigateur le décalerait d'un jour d'un côté de minuit.
 */
const jourLisible = (jour: string) => formatDate(`${jour}T00:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" });
const periode = (debut: string, fin: string) => (debut === fin ? `le ${jourLisible(debut)}` : `du ${jourLisible(debut)} au ${jourLisible(fin)}`);
const dateLisible = (iso: string) => formatDate(iso, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

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
 * (congés, achats, formations, plans de tournée, marches de recrutement — ce qui dort chez moi et
 * bloque quelqu'un), et **qui est là** — au jour d'Alger, avec les jours où deux personnes d'une
 * même équipe manquent ensemble (§118.196, lot E3). Ces réponses existaient déjà, éparpillées
 * dans autant d'écrans qu'il y a de circuits : on découvrait une demande de congé vieille de six
 * jours en cherchant autre chose.
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
 * **Ce qui attend ma décision, lui, suit son circuit** : un congé, un achat, une formation d'un
 * N-2 sont routés vers SON N+1 — les faire remonter ici m'afficherait une décision que je n'ai
 * pas à prendre ; une chaîne de recrutement, elle, passe par chaque échelon, et un plan escaladé
 * monte au N+2. Chaque ligne ne mène qu'à un écran qui s'ouvrira pour moi.
 *
 * ── QUELQUES INDICATEURS, AU CLIC ET SELON LE MÉTIER ────────────────────────────────────────
 *
 * On déplie une carte, on obtient sa charge de travail et les compteurs de SON métier — visites
 * pour un délégué, dossiers pour les affaires réglementaires, courses pour un coordinateur. Un
 * jeu unique pour tout le monde produirait trois zéros et une colonne vide, et des zéros qui ne
 * veulent rien dire abîment ceux qui veulent dire quelque chose. Un chiffre qui a un écran y mène
 * — et seulement si cet écran s'ouvre pour celui qui regarde.
 *
 * ── RECRUTEMENT ─────────────────────────────────────────────────────────────────────────────
 *
 * Le module a rejoint ce pôle dans le menu : recruter est le geste d'un encadrant à qui il
 * manque quelqu'un, pas une affaire d'Administration. Ses DROITS n'ont pas bougé — `RECRUITMENT`
 * reste un module à part, réglable seul dans la console, et son écran garde sa propre garde —
 * que le bouton « Demander un recrutement » rejoue, module masqué compris.
 */
export default async function MonEquipePage() {
  const user = await requireModule("MY_TEAM");
  const [{ selfEmployeeId, members, directCount, depth, pending, chevauchements, chevauchementsNonMontres }, reglages] =
    await Promise.all([getMyTeam(user), getAppSettings()]);
  // LE BOUTON REJOUE LA GARDE DE L'ÉCRAN — module masqué compris : un lien vers `?masque=` n'est pas un geste.
  const canRecruit = userCan(user, "RECRUITMENT", "CREATE") && peutOuvrirModule(user, "RECRUITMENT", reglages.hiddenModules);

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <EmptyState icon="CheckCheck" title="Rien ne vous attend" description="Les congés, achats, formations, plans de tournée et marches de recrutement de votre équipe qui attendent votre accord apparaîtront ici." />
            ) : (
              <div className="space-y-2">
                {pending.map((p) => <PendingRow key={p.id} p={p} />)}
              </div>
            )}
          </section>

          {chevauchements.length > 0 && (
            <Chevauchements periodes={chevauchements} nonMontres={chevauchementsNonMontres} />
          )}

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
            {ECHEANCE[p.kind]}{dateLisible(p.deadline)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">demandé le {formatDateTime(p.createdAt)}</span>
        {/* UN LIEN N'EST OFFERT QUE SI LA PAGE S'OUVRE ; sinon la ligne dit qui peut l'ouvrir (§118.83). */}
        {p.href ? (
          <Link
            href={p.href}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            Traiter <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : p.sansLien ? (
          <span className="basis-full text-xs text-muted-foreground">{p.sansLien}</span>
        ) : null}
        {/* M19 — QUI MANQUERA EN MÊME TEMPS dans la même équipe : la question qu'on se pose avant de signer. */}
        {p.chevauchements.length > 0 && (
          <p className="basis-full text-xs text-warning">
            Chevauche : {p.chevauchements.slice(0, 3).map((c) => `${c.nom} (${periode(c.debut, c.fin)}${c.enAttente ? ", en attente" : ""})`).join(", ")}
            {p.chevauchements.length > 3 ? ` et ${p.chevauchements.length - 3} autre(s)` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * LES ABSENCES QUI SE CHEVAUCHENT — 30 prochains jours (§118.196, lot E3, M19). Une période par
 * équipe : les jours où deux personnes au moins qui dépendent du même chef manquent ensemble. Ce
 * qui dépasse la coupe est COMPTÉ, jamais tu (§118.60).
 */
function Chevauchements({ periodes, nonMontres }: { periodes: ChevauchementDEquipe[]; nonMontres: number }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Absences qui se chevauchent — 30 prochains jours ({periodes.length + nonMontres})
      </h2>
      <div className="space-y-2">
        {periodes.map((c) => (
          <Card key={`${c.groupe ?? "moi"}-${c.debut}`}>
            <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 text-sm">
              <Badge tone="warning" dot={false}>{c.equipe}</Badge>
              <span className="font-medium">{periode(c.debut, c.fin)}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {c.personnes.map((pers) => `${pers.nom}${pers.enAttente ? " (en attente)" : ""}`).join(", ")}
              </span>
            </CardContent>
          </Card>
        ))}
        {nonMontres > 0 && (
          <p className="text-xs text-muted-foreground">Et {nonMontres} autre(s) période(s) dans les 30 prochains jours.</p>
        )}
      </div>
    </section>
  );
}
