import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap, BookOpen, MailWarning, Gavel, Sparkles } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canSeeRegEnrollment } from "@/lib/org-chart-access";
import { getAppSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { TrainingPanel } from "./training-panel";

export const metadata = { title: "Entraînement IA — Regulatory" };
export const dynamic = "force-dynamic";

/**
 * ENTRAÎNEMENT DE L'IA — l'école de l'analyseur, réservée au SUPER ADMIN.
 *
 * L'analyseur apprend par QUATRE canaux, tous visibles ici :
 *   1. le CORPUS (les textes qui font foi) — écran Corpus ;
 *   2. les RÉSERVES ANPP historiques (ce que l'agence nous a reproché) — bibliothèque ;
 *   3. les RÈGLES DÉRIVÉES (reproches récurrents devenus règles, validées par un humain) ;
 *   4. les ÉTUDES DE CAS (ce module) : les dossiers de produits PASSÉS avec leur issue réelle
 *      et la leçon retenue — injectés dans chaque analyse comme précédents.
 *
 * Rien ici ne « ré-entraîne » le modèle au sens technique : la connaissance vit DANS NOTRE BASE,
 * citée mot à mot, retirable à tout instant — c'est ce qui la rend fiable et auditable.
 */
export default async function TrainingPage() {
  const user = await requireModule("REGULATORY");
  const settings = await getAppSettings();
  if (!canSeeRegEnrollment(user, settings)) notFound();
  if (user.role !== "SUPER_ADMIN") notFound();

  const [corpusActive, reserves, rulesValidated, rulesProposed, cases, caseDocs, embedded] = await Promise.all([
    prisma.regulatorySourceVersion.count({ where: { status: "ACTIVE", source: { code: { not: { endsWith: "-INDEX" } } } } }),
    prisma.anppReserve.count(),
    prisma.anppDerivedRule.count({ where: { status: "VALIDATED" } }),
    prisma.anppDerivedRule.count({ where: { status: "PROPOSED" } }),
    prisma.regulatoryCaseStudy.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, productName: true, outcome: true, lesson: true, createdAt: true,
        documents: { select: { id: true, filename: true, ctdSection: true, sections: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.regulatoryCaseDoc.count(),
    prisma.regulatoryCaseDoc.count({ where: { embedding: { not: undefined } } }),
  ]);

  return (
    <div className="space-y-5">
      <BackLink href="/regulatory/enregistrement/analyse">
        <ArrowLeft className="h-4 w-4" /> Analyse CTD
      </BackLink>
      <PageHeader
        title="Entraînement de l'IA"
        description="L'école de l'analyseur : déposez les dossiers de vos produits passés, dites l'issue réelle à l'ANPP et la leçon retenue — chaque analyse suivante s'en servira comme précédents."
      />

      {/* Le niveau d'expertise, en chiffres — ce que l'IA sait AUJOURD'HUI. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExpertiseStat icon={<BookOpen className="h-4 w-4 text-primary" />} label="Textes réglementaires actifs" value={corpusActive} hint="corpus cité dans chaque analyse" href="/regulatory/enregistrement/corpus" />
        <ExpertiseStat icon={<MailWarning className="h-4 w-4 text-primary" />} label="Réserves ANPP apprises" value={reserves} hint="précédents de l'agence" href="/regulatory/enregistrement/reserves" />
        <ExpertiseStat icon={<Gavel className="h-4 w-4 text-primary" />} label="Règles dérivées validées" value={rulesValidated} hint={rulesProposed > 0 ? `${rulesProposed} proposée(s) à valider` : "issues des reproches récurrents"} href="/admin/regulatory-corpus" />
        <ExpertiseStat icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Études de cas" value={cases.length} hint={`${caseDocs} pièce(s)${caseDocs > 0 ? ` · ${embedded}/${caseDocs} vectorisée(s)` : ""}`} />
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Chaque étude de cas est injectée dans les analyses (voies immédiate ET différée) comme{" "}
          <strong>précédent</strong> : « voilà ce que l&apos;ANPP a réellement accepté ou reproché sur nos produits ».
          Les issues <strong>avec réserves ou rejet</strong> sont les plus instructives — c&apos;est là que l&apos;agence a parlé.
          Un précédent ne devient <strong>jamais</strong> une règle opposable : seuls les textes du{" "}
          <Link href="/regulatory/enregistrement/corpus" className="underline">corpus</Link> fondent un <code>ruleRef</code>.
        </span>
      </p>

      <TrainingPanel
        cases={cases.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          documents: c.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
        }))}
      />
    </div>
  );
}

function ExpertiseStat({ icon, label, value, hint, href }: { icon: React.ReactNode; label: string; value: number; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
