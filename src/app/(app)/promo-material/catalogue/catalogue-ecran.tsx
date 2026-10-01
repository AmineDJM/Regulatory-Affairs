"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { cn } from "@/lib/utils";
import { MATERIAL_TYPE, MATERIAL_TYPE_OPTIONS } from "@/lib/labels";
import { FAMILLES, FAMILLE_LABEL, type PromoFamille } from "@/lib/promo/catalogue";
import type { ActionResult } from "@/lib/actions/types";
import { archiverArticleCatalogue, creerArticleCatalogue, modifierArticleCatalogue } from "@/lib/actions/promo-catalogue-actions";

export interface ArticleCatalogueVue {
  id: string;
  reference: string;
  nom: string;
  famille: PromoFamille;
  materialType: string | null;
  unite: string;
  description: string | null;
  exigeProduit: boolean;
  actif: boolean;
  /** Combien d'articles de stock le citent — un article qui a servi s'archive, il ne se supprime pas. */
  articlesDeStock: number;
}

const AIDE_FAMILLE = "Consommable : une quantité qui baisse à chaque remise, lots datés possibles. Durable : se prête et revient, ne périme pas. Numérique : un lien et une période de validité, pas de quantité.";

function champs(a?: ArticleCatalogueVue): FieldDef[] {
  return [
    ...(a ? [{ type: "hidden", name: "id", value: a.id } as FieldDef] : []),
    { type: "text", name: "nom", label: "Nom de l'article", required: true, defaultValue: a?.nom, placeholder: "Fiche posologique, Banner roll-up 85×200, Stylo…", full: true },
    {
      type: "select", name: "famille", label: "Famille", required: true, defaultValue: a?.famille, placeholder: "Choisir la famille",
      options: FAMILLES.map((f) => ({ value: f, label: FAMILLE_LABEL[f] })),
      hint: a && a.articlesDeStock > 0 ? `${AIDE_FAMILLE} Déjà en service : il ne passe ni vers ni depuis « Numérique ».` : AIDE_FAMILLE,
    },
    { type: "select", name: "materialType", label: "Nature de support", defaultValue: a?.materialType ?? "", placeholder: "—", options: MATERIAL_TYPE_OPTIONS },
    { type: "text", name: "unite", label: "Unité", defaultValue: a?.unite ?? "pièce", placeholder: "pièce, carton de 50, ramette…" },
    {
      type: "checkbox", name: "exigeProduit", label: "Existe par produit", defaultChecked: a?.exigeProduit ?? false,
      hint: "Une fiche posologique, une aide de visite : le produit est exigé à l'entrée en stock. Un stylo, non.",
    },
    { type: "textarea", name: "description", label: "Description", defaultValue: a?.description ?? undefined },
  ];
}

/**
 * LE CATALOGUE — l'écran. Lecture pour qui a le module en lecture ; création, correction et
 * archivage pour qui l'a en écriture ; suppression par la corbeille du Super Admin, refusée AVANT
 * le clic sur un article qui a servi (le registre le dit, et nomme l'archivage).
 */
export function CatalogueEcran({ articles, droits }: { articles: ArticleCatalogueVue[]; droits: { creer: boolean; modifier: boolean; supprimer: boolean } }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [famille, setFamille] = React.useState("");
  const [archives, setArchives] = React.useState(false);
  const [edition, setEdition] = React.useState<{ article?: ArticleCatalogueVue } | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);
  const [occupe, setOccupe] = React.useState(false);

  const nArchives = articles.filter((a) => !a.actif).length;
  const recherche = q.trim().toLowerCase();
  const visibles = articles.filter((a) =>
    (archives || a.actif)
    && (!famille || a.famille === famille)
    && (!recherche || `${a.reference} ${a.nom} ${a.description ?? ""}`.toLowerCase().includes(recherche)));

  const archiver = async (a: ArticleCatalogueVue) => {
    setOccupe(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("actif", a.actif ? "false" : "true");
    try {
      const r = await archiverArticleCatalogue(fd);
      if (r.ok) { setMessage({ ok: true, texte: `${a.reference} ${a.actif ? "archivé — il ne se propose plus" : "réactivé"}.` }); router.refresh(); }
      else setMessage({ ok: false, texte: r.error ?? "L'action n'a pas abouti." });
    } catch {
      setMessage({ ok: false, texte: "L'action n'a pas abouti (connexion ou serveur). Rechargez la page avant de recommencer." });
    } finally {
      setOccupe(false);
    }
  };

  const action = async (_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> => {
    const r = edition?.article ? await modifierArticleCatalogue(fd) : await creerArticleCatalogue(fd);
    if (r.ok) setMessage({ ok: true, texte: r.message ?? "Article enregistré." });
    return r;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une référence, un nom…" className="pl-8" aria-label="Rechercher dans le catalogue" />
        </div>
        <Select value={famille} onChange={(e) => setFamille(e.target.value)} aria-label="Famille" className="sm:w-44">
          <option value="">Toutes les familles</option>
          {FAMILLES.map((f) => <option key={f} value={f}>{FAMILLE_LABEL[f]}</option>)}
        </Select>
        {nArchives > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Archivés ({nArchives})
          </label>
        )}
        {droits.creer && (
          <Button onClick={() => setEdition({})}><Plus className="h-4 w-4" /> Nouvel article</Button>
        )}
      </div>

      {!droits.creer && !droits.modifier && (
        <p className="text-xs text-muted-foreground">Vous consultez le catalogue en lecture. Un Super Admin l&apos;ouvre en écriture dans Administration › Accès.</p>
      )}

      {message && (
        <div role={message.ok ? "status" : "alert"} className={cn("flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm", message.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          <span className="flex items-start gap-2">
            {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {message.texte}
          </span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Fermer le message" className="shrink-0 rounded p-0.5 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {articles.length === 0 ? "Le catalogue est vide." + (droits.creer ? " Ajoutez le premier article." : "") : "Aucun article ne correspond."}
        </p>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Référence</th>
                <th className="px-3 py-2 font-medium">Article</th>
                <th className="px-3 py-2 font-medium">Famille</th>
                <th className="px-3 py-2 font-medium">Nature</th>
                <th className="px-3 py-2 font-medium">Unité</th>
                <th className="px-3 py-2 text-right font-medium">En stock</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((a) => (
                <tr key={a.id} className={cn("align-top", !a.actif && "opacity-60")}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{a.reference}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {a.nom}
                      {a.exigeProduit && <Badge className="ml-2 align-middle">Par produit</Badge>}
                      {!a.actif && <Badge className="ml-2 align-middle">Archivé</Badge>}
                    </p>
                    {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                  </td>
                  <td className="px-3 py-2"><Badge tone={a.famille === "DURABLE" ? "purple" : a.famille === "NUMERIQUE" ? "info" : "neutral"}>{FAMILLE_LABEL[a.famille]}</Badge></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.materialType ? MATERIAL_TYPE[a.materialType] ?? a.materialType : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.unite}</td>
                  <td className="px-3 py-2 text-right tabular-nums" title="Articles de stock (par produit et par société) qui citent cette référence">{a.articlesDeStock}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {droits.modifier && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEdition({ article: a })}>Modifier</Button>
                          <Button size="sm" variant="ghost" disabled={occupe} onClick={() => archiver(a)}>{a.actif ? "Archiver" : "Réactiver"}</Button>
                        </>
                      )}
                      <SuperAdminDeleteButton kind="PROMO_CATALOGUE" id={a.id} name={`${a.reference} — ${a.nom}`} enabled={droits.supprimer} compact stay />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edition && (
        <Sheet
          open onClose={() => setEdition(null)}
          title={edition.article ? `Modifier ${edition.article.reference}` : "Nouvel article du catalogue"}
          description={edition.article ? "La référence ne change pas : c'est elle que citent les stocks." : "La référence CAT-NNNN est attribuée à l'enregistrement et ne changera plus."}
        >
          <RecordForm
            fields={champs(edition.article)} action={action}
            onDone={() => setEdition(null)} onCancel={() => setEdition(null)}
            submitLabel={edition.article ? "Enregistrer" : "Ajouter au catalogue"}
          />
        </Sheet>
      )}
    </div>
  );
}
