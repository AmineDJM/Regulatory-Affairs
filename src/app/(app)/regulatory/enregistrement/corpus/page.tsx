import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Lock, ShieldCheck } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canSeeRegEnrollment } from "@/lib/org-chart-access";
import { getAppSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { CATALOG, FIRST_WAVE, ANPP_WATCH_PAGES } from "@/lib/regulatory/intelligence/corpus/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CorpusPanel } from "./corpus-panel";
import { CorpusImport } from "./corpus-import";
import { BackLink } from "@/components/shared/back-link";

export const metadata = { title: "Corpus réglementaire" };
export const dynamic = "force-dynamic";

/**
 * CORPUS RÉGLEMENTAIRE — un seul geste, un seul état.
 *
 * Écran volontairement SIMPLE, réservé au SUPER ADMIN (le corpus est transverse : il alimente
 * les analyses de toutes les entités, il n'a pas de portée d'entité) :
 *   • on DÉPOSE des textes → ils sont découpés, indexés et **utilisés immédiatement par toutes
 *     les analyses** — pas d'étape d'activation, pas de purgatoire « téléchargé sans effet » ;
 *   • on VOIT la liste exacte de ce que l'analyse cite aujourd'hui ;
 *   • le catalogue officiel en ligne (ANPP, ICH, EMA…) reste disponible en second rideau.
 *
 * L'accès des autres rôles s'arrête ici (écran ET actions) ; les analyses, elles, s'appuient
 * sur le corpus pour tout le monde.
 */
export default async function CorpusPage() {
  const user = await requireModule("REGULATORY");
  const settings = await getAppSettings();
  if (!canSeeRegEnrollment(user, settings)) notFound();
  // RÉSERVÉ À L'ADMINISTRATEUR : décider de ce qui fait foi est un acte d'administration.
  if (user.role !== "SUPER_ADMIN") notFound();

  const sources = await prisma.regulatorySource.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true, code: true, title: true, authority: true, jurisdiction: true, sourceUrl: true,
      versions: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { id: true, version: true, status: true, createdAt: true, _count: { select: { sections: true } } },
      },
    },
  });

  const byCode = new Map(sources.map((s) => [s.code, s]));
  const watchCodes = new Set(ANPP_WATCH_PAGES.map((p) => p.code));
  const active = sources.filter((s) => s.versions[0]?.status === "ACTIVE" && !watchCodes.has(s.code));
  const missing = CATALOG.filter((c) => c.ingestible && !byCode.has(c.code));
  const licensed = CATALOG.filter((c) => !c.ingestible);

  return (
    <div className="space-y-5">
      <BackLink href="/regulatory/enregistrement/analyse">
        <ArrowLeft className="h-4 w-4" /> Analyse CTD
      </BackLink>
      <PageHeader
        title="Corpus réglementaire"
        description="Déposez vos textes de référence : dès l'import, ils sont lus, indexés et cités par TOUTES les analyses. Rien d'autre à faire."
      />

      {/* LE geste de l'écran : déposer. Tout le reste en découle. */}
      <CorpusImport />

      {/* Ce que l'analyse utilise, aujourd'hui, exactement. */}
      <section className="surface space-y-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold">Textes utilisés par l&apos;analyse ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Aucun texte pour le moment. Déposez vos documents ci-dessus : ils seront utilisés dès l&apos;import.
            Sans corpus, les analyses s&apos;appuient sur les règles codées du moteur, sans citation de source externe.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((s) => <SourceRow key={s.id} source={s} />)}
          </ul>
        )}
      </section>

      {/* Second rideau : le catalogue officiel en ligne — utile, jamais bloquant. */}
      <details className="surface p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-primary" /> Textes officiels en ligne (catalogue ANPP / ICH / EMA…)
          {missing.length > 0 && <Badge tone="info" dot={false}>{missing.length} à ingérer</Badge>}
        </summary>
        <div className="mt-3 space-y-4">
          <CorpusPanel
            firstWave={FIRST_WAVE.map((s) => ({ code: s.code, title: s.title, authority: s.authority }))}
            missing={missing.map((s) => ({ code: s.code, title: s.title, authority: s.authority }))}
            watchPages={ANPP_WATCH_PAGES}
          />
          {missing.length > 0 && (
            <ul className="divide-y divide-border">
              {missing.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Badge tone="neutral" dot={false}>{c.authority}</Badge>
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline">{c.title}</a>
                  {c.priority === 1 && <Badge tone="info" dot={false}>1ʳᵉ vague</Badge>}
                  {!c.binding && <Badge tone="warning" dot={false}>non opposable</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {/* La limite juridique, en une ligne — importante, pas envahissante. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Les sources <strong>sous licence</strong> ({licensed.length} — Pharmacopée Européenne de l&apos;EDQM, ouvrages
          sous droits) sont citées, jamais téléchargées ni stockées. Les textes marqués « non opposables » (projets en
          révision) éclairent une analyse sans fonder de constat bloquant.
        </span>
      </p>
    </div>
  );
}

type SourceWithVersion = {
  id: string; code: string; title: string; authority: string; jurisdiction: string; sourceUrl: string | null;
  versions: { id: string; version: string; status: string; createdAt: Date; _count: { sections: number } }[];
};

function SourceRow({ source: s }: { source: SourceWithVersion }) {
  const v = s.versions[0];
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <Badge tone="neutral" dot={false}>{s.authority}</Badge>
      {s.sourceUrl
        ? <a href={s.sourceUrl} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline">{s.title}</a>
        : <span className="min-w-0 flex-1 truncate">{s.title}</span>}
      {v && (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          v. {v.version} · {v._count.sections} section(s) · {formatDate(v.createdAt)}
        </span>
      )}
    </li>
  );
}
