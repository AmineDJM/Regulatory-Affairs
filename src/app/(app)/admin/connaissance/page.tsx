import Link from "next/link";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { ADMIN_TABS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { knowledgeHealth } from "@/lib/knowledge/worker";
import { availableWorkflows } from "@/lib/scheduler/registry";
import { registerBuiltinWorkflows } from "@/lib/scheduler/handlers";
import { EXTRACTION_RANK, INGEST_STAGES, MOYENS_MODELE, type ExtractedBy, type IngestStage } from "@/lib/knowledge/contract";
import { RelancerBouton } from "./relancer-bouton";

export const metadata = { title: "Couche de connaissance — AMD Internal OS" };
export const dynamic = "force-dynamic";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN D'OBSERVABILITÉ DE LA COUCHE DE CONNAISSANCE (§26).
 *
 * ── LA QUESTION À LAQUELLE IL RÉPOND ─────────────────────────────────────────────────────
 *
 * « Est-ce que ça marche, et est-ce que ça coûte ce que ça devrait ? » Une couche d'indexation
 * qui tourne en fond est invisible par construction : sans cet écran, une file qui s'engorge ou
 * une dérive vers les modèles chers se découvre sur une facture, des semaines plus tard.
 *
 * ── LE CHIFFRE QUI COMPTE VRAIMENT ───────────────────────────────────────────────────────
 *
 * La RÉPARTITION PAR MOYEN D'EXTRACTION. La doctrine dit « le code d'abord, le modèle seulement
 * quand le code a démontré qu'il ne suffisait pas ». Ce n'est vérifiable que par ce tableau : si
 * la part de `native` baisse et celle de `luna` monte sans qu'un nouveau type de fichier soit
 * arrivé, quelque chose a cessé de fonctionner en amont — et c'est précisément ainsi qu'a été
 * trouvé le défaut des fichiers texte partant en vision.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const STAGE_LABEL: Record<IngestStage, string> = {
  RECEIVED: "Reçu",
  PARSED: "Texte extrait",
  CLASSIFIED: "Classé",
  INDEXED: "Recherchable",
  READY: "Recherchable et relié",
  ENRICHED: "Enrichi",
  EMPTY: "Sans texte lisible",
  FAILED: "En échec (ancienne règle — réparé au fil des passages)",
};

/**
 * Pourquoi une étape reste à zéro, dit à côté d'elle. Un « 0 » sans raison se lit comme une panne ;
 * ces étapes-là sont des PASSAGES (l'élément les franchit en quelques secondes) ou n'ont pas de
 * déclencheur — et c'est ce qu'il faut savoir avant de chercher un défaut.
 */
const STAGE_NOTE: Partial<Record<IngestStage, string>> = {
  RECEIVED: "reçu sans texte, en attente de lecture",
  PARSED: "étape de passage — l'ingestion écrit directement « Recherchable »",
  CLASSIFIED: "étape de passage — la mise en relation suit dans le même passage",
  INDEXED: "étape de passage — la mise en relation suit en quelques secondes",
};

const MEAN_LABEL: Record<ExtractedBy, string> = {
  metadata: "Métadonnées (gratuit)",
  native: "Parsing natif (gratuit)",
  ocr: "OCR (gratuit)",
  luna: "Luna — vision",
  hybrid: "Hybride — parsing natif complété par Luna (vision)",
  terra: "Terra — escalade",
};

const KIND_LABEL: Record<string, string> = {
  parse: "Extraction",
  classify: "Classement",
  entities: "Mise en relation",
  embed: "Vectorisation",
  vision: "Lecture visuelle",
  enrich: "Résumé",
};

/** Le code est en vert, le modèle en ambre. La couleur DIT la doctrine, elle ne décore pas. */
const meanTone = (m: string): string =>
  MOYENS_MODELE.has(m as ExtractedBy) ? "text-amber-600" : "text-emerald-600";

const PGVECTOR_PHRASE: Record<string, string> = {
  absente: "l'extension pgvector est absente de ce serveur de base (constaté à l'instant)",
  disponible: "l'extension pgvector est disponible sur ce serveur mais pas installée (constaté à l'instant)",
  installee: "l'extension pgvector est installée, mais cette couche ne s'en sert pas encore",
  inconnu: "la présence de pgvector n'a pas pu être lue",
};

export default async function KnowledgePage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  registerBuiltinWorkflows();
  const [h, workflows] = await Promise.all([knowledgeHealth(), Promise.resolve(availableWorkflows())]);

  const stages = INGEST_STAGES
    .map((s) => ({ stage: s, label: STAGE_LABEL[s], count: h.byStage[s] ?? 0 }))
    // L'étape de l'ancienne règle ne s'affiche que tant qu'il en reste.
    .filter((s) => s.stage !== "FAILED" || s.count > 0);
  const means = Object.entries(h.byExtraction)
    .map(([k, v]) => ({ key: k, label: MEAN_LABEL[k as ExtractedBy] ?? k, count: v }))
    .sort((a, b) => (EXTRACTION_RANK[a.key as ExtractedBy] ?? 9) - (EXTRACTION_RANK[b.key as ExtractedBy] ?? 9));
  const meansTotal = means.reduce((n, m) => n + m.count, 0);
  const byCode = means.filter((m) => !MOYENS_MODELE.has(m.key as ExtractedBy)).reduce((n, m) => n + m.count, 0);
  const codeShare = meansTotal ? Math.round((byCode / meansTotal) * 100) : null;

  const embeddedShare = h.chunks.total ? Math.round((h.chunks.embedded / h.chunks.total) * 100) : null;

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={ADMIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(admin, t.module, "VIEW") }))} />

      {/* ── Ce qu'il faut savoir en deux secondes ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Documents indexés"
          value={String(h.total)}
          hint={`${h.retrouvables} retrouvables aujourd'hui sur ${h.courants} versions courantes`}
        />
        <Stat
          title="Compris par le code"
          value={codeShare == null ? "—" : `${codeShare} %`}
          hint={codeShare == null ? "Aucune extraction encore mesurée" : "Le reste a demandé un modèle"}
          tone={codeShare != null && codeShare < 60 ? "warning" : "ok"}
        />
        <Stat
          title="File d'attente"
          value={String(h.queue.queued)}
          hint={
            // `null` = file vide. Le distinguer de « 0 minute » évite d'afficher « attend depuis
            // 0 min » sur une file qui n'a rien à traiter, ce qui se lit comme une anomalie.
            h.queue.queuedModele > 0 && !h.modele.ok
              ? `${h.queue.queuedModele} attendent un modèle : ${h.modele.raison}`
              : h.queue.oldestQueuedMin != null && h.queue.oldestQueuedMin > 0
                ? `Le plus ancien attend ${h.queue.oldestQueuedMin} min`
                : "Rien en attente"
          }
          tone={h.queue.queued > 500 || (h.queue.queuedModele > 0 && !h.modele.ok) ? "warning" : "ok"}
        />
        <Stat
          title="Boîte morte"
          value={String(h.queue.dead)}
          hint={h.queue.dead ? "Travaux abandonnés après plusieurs essais — regroupés par cause ci-dessous" : "Aucun travail abandonné"}
          tone={h.queue.dead > 0 ? "danger" : "ok"}
        />
      </div>

      {/* ── LA BOÎTE MORTE, PAR CAUSE — un nombre sans cause ne se répare pas ─────────────── */}
      {h.boiteMorte.total > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Boîte morte — par cause</CardTitle>
                <CardDescription>
                  Chaque ligne est UNE cause : l&apos;étape, le motif (sans ce qui varie d&apos;un
                  document à l&apos;autre) et le type de fichier. « Panne temporaire » veut dire que
                  le document n&apos;y est pour rien — relancer suffit, maintenant que ces pannes
                  attendent au lieu d&apos;échouer. Relancer remet les essais à zéro ; ce qui
                  échoue de nouveau revient ici avec son motif.
                  {h.boiteMorte.tronque
                    ? ` Seuls les ${h.boiteMorte.groupes.reduce((n, g) => n + g.count, 0)} plus récents sur ${h.boiteMorte.total} sont regroupés ici.`
                    : ""}
                </CardDescription>
              </div>
              <RelancerBouton libelle="Tout relancer" nombre={h.boiteMorte.total} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {h.boiteMorte.groupes.map((g) => (
              <div key={g.cle} className="flex flex-col gap-2 border-t pt-3 text-sm first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-medium tabular-nums">{g.count}</span>
                    <span>{KIND_LABEL[g.kind] ?? g.kind}</span>
                    <Badge tone="neutral" dot={false}>{g.extension === "—" ? "type inconnu" : `.${g.extension}`}</Badge>
                    {g.temporaire ? <Badge tone="warning" dot={false}>panne temporaire</Badge> : null}
                  </div>
                  <p className="break-words text-xs text-muted-foreground">{g.cause}</p>
                  {g.exemples.length ? (
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      {g.exemples.map((e, i) =>
                        e.href ? (
                          <Link key={i} href={e.href} className="truncate text-primary underline-offset-2 hover:underline">{e.label}</Link>
                        ) : (
                          <span key={i} className="truncate text-muted-foreground">{e.label}</span>
                        ),
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <RelancerBouton cle={g.cle} libelle="Relancer" nombre={g.count} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── LA RÉPARTITION PAR MOYEN — le tableau de bord de la doctrine ─────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comment l&apos;information a été comprise</CardTitle>
            <CardDescription>
              Le code d&apos;abord, le modèle seulement quand le code ne suffit pas. Une dérive vers
              l&apos;ambre se voit ici avant d&apos;apparaître sur une facture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {means.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun document encore traité.</p>
            ) : (
              means.map((m) => (
                <div key={m.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className={cn("min-w-0", meanTone(m.key))}>{m.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {m.count}
                    {meansTotal ? ` · ${Math.round((m.count / meansTotal) * 100)} %` : ""}
                  </span>
                </div>
              ))
            )}
            {h.lunaNonLus > 0 ? (
              <p className="text-xs text-muted-foreground">
                Dont {h.lunaNonLus} routés vers Luna et pas encore lus : la décision est prise, la
                lecture visuelle attend son tour{h.modele.ok ? " (rattrapée par petits lots à chaque passage)" : ` — ${h.modele.raison}`}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ── OÙ EN SONT LES DOCUMENTS ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Où en sont les documents</CardTitle>
            <CardDescription>
              « Recherchable » suffit à s&apos;en servir : l&apos;enrichissement continue derrière,
              sans que personne n&apos;attende devant un écran.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.map((s) => (
              <div key={s.stage} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className={cn(s.stage === "FAILED" && s.count > 0 && "text-destructive")}>{s.label}</span>
                  {s.count === 0 && STAGE_NOTE[s.stage] ? (
                    <span className="block text-xs text-muted-foreground">{STAGE_NOTE[s.stage]}</span>
                  ) : null}
                  {s.stage === "ENRICHED" && s.count === 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      {h.enrichDemandes === 0
                        ? "aucune source ne demande encore de résumé : l'étage existe, son déclenchement est une décision de coût"
                        : "les résumés demandés n'ont pas encore abouti"}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── LE RÉFÉRENTIEL D'ENTITÉS ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Référentiel d&apos;entités</CardTitle>
            <CardDescription>
              Projeté depuis les fiches de l&apos;ERP : produits, sociétés, fournisseurs, personnes.
              Aucun nom n&apos;est inventé ici.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Entités" value={h.entities.entities} />
            <Line label="Graphies connues (alias, DCI, références, sigles)" value={h.entities.aliases} />
            <Line label="Liens document → entité" value={h.entities.links} />
          </CardContent>
        </Card>

        {/* ── LES VECTEURS ─────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recherche par le sens</CardTitle>
            <CardDescription>
              Vecteurs en JSONB et cosinus en mémoire : {PGVECTOR_PHRASE[h.pgvector]}. Sans modèle
              disponible, la recherche reste lexicale — dégradée, jamais cassée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Morceaux de document" value={h.chunks.total} />
            <Line
              label="Morceaux vectorisés"
              value={h.chunks.embedded}
              suffix={embeddedShare == null ? undefined : `${embeddedShare} %`}
            />
            <Line
              label="Restant à vectoriser (versions courantes)"
              value={h.chunks.restants}
              suffix={h.chunks.restants ? `≈ ${h.chunks.coutEstimeUsd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $ estimés` : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {h.modele.ok
                ? "Le rattrapage avance à chaque passage du battement, par petits lots (chaque travail encode au plus 32 morceaux) ; le traitement planifiable « Rattrapage d'indexation » en passe davantage."
                : `Rattrapage suspendu : ${h.modele.raison} Les travaux attendent en file, sans consommer d'essai.`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── LES TRAITEMENTS PLANIFIABLES ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Traitements planifiables</CardTitle>
          <CardDescription>
            La liste FERMÉE de ce qu&apos;une planification peut déclencher. Tous en lecture seule :
            une planification est un déclencheur, jamais une dérogation à une approbation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun traitement enregistré.</p>
          ) : (
            workflows.map((w) => (
              <div key={w.kind} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="font-medium">{w.label}</span>
                <Badge tone="neutral" dot={false}>lecture seule</Badge>
                <span className="w-full text-xs text-muted-foreground sm:w-auto">{w.description}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  title, value, hint, tone = "ok",
}: {
  title: string; value: string; hint: string; tone?: "ok" | "warning" | "danger";
}) {
  const color = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tabular-nums", color)}>{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Line({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right tabular-nums">
        {value}
        {suffix ? <span className="ml-1.5 text-muted-foreground">· {suffix}</span> : null}
      </span>
    </div>
  );
}
