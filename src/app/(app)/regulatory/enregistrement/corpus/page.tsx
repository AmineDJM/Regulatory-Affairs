import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Lock, Eye, ShieldCheck, AlertTriangle } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getAppSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { getCompanyScope } from "@/lib/company";
import { CATALOG, FIRST_WAVE, ANPP_WATCH_PAGES } from "@/lib/regulatory/intelligence/corpus/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CorpusPanel } from "./corpus-panel";
import { BackLink } from "@/components/shared/back-link";

export const metadata = { title: "Corpus réglementaire" };
export const dynamic = "force-dynamic";

/**
 * CORPUS RÉGLEMENTAIRE — sur quoi l'analyse s'appuie, et ce qui lui manque.
 *
 * L'écran répond à trois questions, dans cet ordre :
 *   1. **Quels textes font foi aujourd'hui ?** (versions ACTIVES) ;
 *   2. **Qu'avons-nous téléchargé sans l'avoir activé ?** (DRAFT — présent mais non opposable) ;
 *   3. **Qu'est-ce qui manque encore ?** (catalogue non ingéré).
 *
 * Deux distinctions sont matérialisées partout, parce qu'elles se paient cher si on les oublie :
 *   • **sous licence** : la Ph. Eur. de l'EDQM et les ouvrages sous droits sont *référencés*,
 *     jamais téléchargés — on cite la source, on ne la copie pas ;
 *   • **non opposable** : un projet (ICH M4Q(R2) en révision) peut éclairer une analyse, il ne
 *     peut pas fonder un constat bloquant.
 */
export default async function CorpusPage() {
  const user = await requireModule("REGULATORY");
  const settings = await getAppSettings();
  if (!settings.regEnrollmentEnabled) notFound();
  const canManage = regCan(user, "regulatory.corpus.manage") || user.role === "SUPER_ADMIN";
  if (!regCan(user, "regulatory.corpus.view") && !canManage) notFound();
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) notFound();

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
  const active = sources.filter((s) => s.versions[0]?.status === "ACTIVE");
  const drafts = sources.filter((s) => s.versions[0]?.status === "DRAFT" && !watchCodes.has(s.code));
  const missing = CATALOG.filter((c) => c.ingestible && !byCode.has(c.code));
  const licensed = CATALOG.filter((c) => !c.ingestible);
  const nonBinding = CATALOG.filter((c) => c.binding === false);

  return (
    <div className="space-y-5">
      <BackLink href="/regulatory/enregistrement/analyse">
        <ArrowLeft className="h-4 w-4" /> Analyse CTD
      </BackLink>
      <PageHeader
        title="Corpus réglementaire"
        description="Les textes sur lesquels l'analyse s'appuie. Un constat ne vaut que par la règle qu'il cite : ici on voit laquelle fait foi, laquelle attend d'être activée, et laquelle manque encore."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Textes opposables" value={String(active.length)} hint="versions actives" tone="success" />
        <Stat label="En attente d'activation" value={String(drafts.length)} hint="téléchargés, sans effet" tone={drafts.length > 0 ? "warning" : undefined} />
        <Stat label="Catalogue à ingérer" value={String(missing.length)} hint={`sur ${CATALOG.filter((c) => c.ingestible).length} ingérables`} />
        <Stat label="Référencés sans copie" value={String(licensed.length)} hint="sous licence" />
      </div>

      {/* La limite juridique, dite avant tout le reste. */}
      <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          Les sources <strong>sous licence</strong> (Pharmacopée Européenne de l&apos;EDQM, ouvrages sous droits) sont
          <strong> citées, jamais téléchargées ni stockées</strong>. Les textes <strong>non opposables</strong> (projets
          en révision) peuvent éclairer une analyse mais ne fondent aucun constat bloquant.
        </span>
      </p>

      {canManage ? (
        <CorpusPanel
          firstWave={FIRST_WAVE.map((s) => ({ code: s.code, title: s.title, authority: s.authority }))}
          missing={missing.map((s) => ({ code: s.code, title: s.title, authority: s.authority }))}
          watchPages={ANPP_WATCH_PAGES}
        />
      ) : (
        <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
          Vous consultez le corpus. L&apos;ingestion et la veille demandent l&apos;autorisation « corpus.manage ».
        </p>
      )}

      {/* Ce qui fait foi. */}
      <section className="surface space-y-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold">Textes opposables ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Aucun texte actif. Les analyses s&apos;appuient alors sur les règles codées du moteur, sans citation de source externe.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((s) => <SourceRow key={s.id} source={s} />)}
          </ul>
        )}
      </section>

      {/* Ce qui est là mais ne s'applique pas encore — la distinction que l'écran doit rendre évidente. */}
      {drafts.length > 0 && (
        <section className="surface space-y-2 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Téléchargés, en attente d&apos;activation ({drafts.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Ces textes sont en base mais <strong>sans effet sur les analyses</strong>. Une ligne directrice ne devient
            opposable qu&apos;après vérification et activation par le Regulatory.
          </p>
          <ul className="divide-y divide-border">
            {drafts.map((s) => <SourceRow key={s.id} source={s} />)}
          </ul>
        </section>
      )}

      {/* Ce qui manque — pour savoir ce sur quoi l'analyse ne peut pas encore s'appuyer. */}
      {missing.length > 0 && (
        <section className="surface space-y-2 p-4">
          <h2 className="text-sm font-semibold">Catalogue non encore ingéré ({missing.length})</h2>
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
        </section>
      )}

      {/* Référencés sans copie + non opposables : la transparence sur ce qu'on n'a pas. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Référencés, jamais copiés ({licensed.length})</h2>
          </div>
          <ul className="divide-y divide-border">
            {licensed.map((c) => (
              <li key={c.code} className="py-2 text-sm">
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{c.title}</a>
                {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Non opposables ({nonBinding.length})</h2>
          </div>
          <p className="text-xs text-muted-foreground">Utiles pour anticiper, insuffisants pour fonder un constat bloquant.</p>
          <ul className="divide-y divide-border">
            {nonBinding.map((c) => (
              <li key={c.code} className="py-2 text-sm">
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{c.title}</a>
                {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
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

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warning" | "success" }) {
  const cls = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${cls}`}>{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
