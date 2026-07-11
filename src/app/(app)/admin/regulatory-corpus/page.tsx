import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Library } from "lucide-react";
import { requireModule } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCorpusSources } from "@/lib/regulatory/intelligence/corpus/queries";
import { activeCorpusSize } from "@/lib/regulatory/intelligence/corpus/rag";
import { CorpusAdmin } from "./corpus-admin";

export const metadata = { title: "Corpus réglementaire — AMD Internal OS" };
export const dynamic = "force-dynamic";

const ANPP_LEGACY_CODE = "ANPP — Référentiel intégré (legacy)";

export default async function RegulatoryCorpusPage() {
  const admin = await requireModule("ADMIN", "UPDATE");
  if (admin.role !== "SUPER_ADMIN") redirect("/admin");

  const [sources, activeSections] = await Promise.all([listCorpusSources(), activeCorpusSize()]);
  const hasAnpp = sources.some((s) => s.code === ANPP_LEGACY_CODE);

  // Sérialisation légère pour le composant client (dates → chaînes).
  const serialized = sources.map((s) => ({
    id: s.id,
    authority: s.authority,
    jurisdiction: s.jurisdiction,
    code: s.code,
    title: s.title,
    versions: s.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      approvedAt: v.approvedAt ? v.approvedAt.toISOString() : null,
      _count: v._count,
    })),
  }));

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'administration
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Corpus réglementaire versionné</h1>
        <p className="text-sm text-muted-foreground">
          Sources réglementaires officielles (ANPP, EMA, ICH…) importées, versionnées, approuvées et activées.
          Seul le corpus <strong>ACTIF</strong> fait foi pour la recherche RAG et les contrôles. {activeSections} section·s indexée·s.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Library className="h-4 w-4" /> Sources & versions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Importez un texte réglementaire (découpé automatiquement en articles/sections), approuvez-le puis
            activez-le. L'activation d'une version retire automatiquement la version active précédente de la même source.
          </p>
        </CardHeader>
        <CardContent>
          <CorpusAdmin sources={serialized} hasAnpp={hasAnpp} />
        </CardContent>
      </Card>
    </div>
  );
}
