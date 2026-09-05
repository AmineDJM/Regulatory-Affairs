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
import { EXTRACTION_RANK, INGEST_STAGES, type ExtractedBy, type IngestStage } from "@/lib/knowledge/contract";

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
  FAILED: "En échec",
};

const MEAN_LABEL: Record<ExtractedBy, string> = {
  metadata: "Métadonnées (gratuit)",
  native: "Parsing natif (gratuit)",
  ocr: "OCR (gratuit)",
  luna: "Luna — vision",
  terra: "Terra — escalade",
};

/** Le code est en vert, le modèle en ambre. La couleur DIT la doctrine, elle ne décore pas. */
const meanTone = (m: string): string =>
  m === "luna" || m === "terra" ? "text-amber-600" : "text-emerald-600";

export default async function KnowledgePage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  registerBuiltinWorkflows();
  const [h, workflows] = await Promise.all([knowledgeHealth(), Promise.resolve(availableWorkflows())]);

  const stages = INGEST_STAGES.map((s) => ({ stage: s, label: STAGE_LABEL[s], count: h.byStage[s] ?? 0 }));
  const means = Object.entries(h.byExtraction)
    .map(([k, v]) => ({ key: k, label: MEAN_LABEL[k as ExtractedBy] ?? k, count: v }))
    .sort((a, b) => (EXTRACTION_RANK[a.key as ExtractedBy] ?? 9) - (EXTRACTION_RANK[b.key as ExtractedBy] ?? 9));
  const meansTotal = means.reduce((n, m) => n + m.count, 0);
  const byCode = means.filter((m) => m.key !== "luna" && m.key !== "terra").reduce((n, m) => n + m.count, 0);
  const codeShare = meansTotal ? Math.round((byCode / meansTotal) * 100) : null;

  const retrievable = (h.byStage.INDEXED ?? 0) + (h.byStage.READY ?? 0) + (h.byStage.ENRICHED ?? 0);
  const embeddedShare = h.chunks.total ? Math.round((h.chunks.embedded / h.chunks.total) * 100) : null;

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={ADMIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(admin, t.module, "VIEW") }))} />

      {/* ── Ce qu'il faut savoir en deux secondes ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Documents indexés"
          value={String(h.total)}
          hint={`${retrievable} retrouvables aujourd'hui`}
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
            h.queue.oldestQueuedMin != null && h.queue.oldestQueuedMin > 0
              ? `Le plus ancien attend ${h.queue.oldestQueuedMin} min`
              : "Rien en attente"
          }
          tone={h.queue.queued > 500 ? "warning" : "ok"}
        />
        <Stat
          title="Boîte morte"
          value={String(h.queue.dead)}
          hint={h.queue.dead ? "Travaux abandonnés après plusieurs essais" : "Aucun travail abandonné"}
          tone={h.queue.dead > 0 ? "danger" : "ok"}
        />
      </div>

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
                <div key={m.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className={cn("truncate", meanTone(m.key))}>{m.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {m.count}
                    {meansTotal ? ` · ${Math.round((m.count / meansTotal) * 100)} %` : ""}
                  </span>
                </div>
              ))
            )}
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
              <div key={s.stage} className="flex items-center justify-between gap-3 text-sm">
                <span className={cn("truncate", s.stage === "FAILED" && s.count > 0 && "text-destructive")}>
                  {s.label}
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
              Vecteurs en JSONB et cosinus en mémoire : l&apos;extension pgvector n&apos;est pas
              disponible sur cette infrastructure. Sans clé OpenAI, la recherche reste lexicale —
              dégradée, jamais cassée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Morceaux de document" value={h.chunks.total} />
            <Line
              label="Morceaux vectorisés"
              value={h.chunks.embedded}
              suffix={embeddedShare == null ? undefined : `${embeddedShare} %`}
            />
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
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums">
        {value}
        {suffix ? <span className="ml-1.5 text-muted-foreground">· {suffix}</span> : null}
      </span>
    </div>
  );
}
