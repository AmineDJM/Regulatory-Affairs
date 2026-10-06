"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { cn } from "@/lib/utils";
import { FAMILLES, FAMILLE_AIDE, FAMILLE_LABEL, type PromoFamille } from "@/lib/promo/catalogue";
import type { ActionResult } from "@/lib/actions/types";
import { archiverArticleCatalogue, creerArticleCatalogue, modifierArticleCatalogue } from "@/lib/actions/promo-catalogue-actions";

export interface ArticleCatalogueVue {
  id: string;
  reference: string;
  nom: string;
  famille: PromoFamille;
  description: string | null;
  exigeProduit: boolean;
  actif: boolean;
  /** Combien d'articles de stock le citent — un article qui a servi s'archive, il ne se supprime pas. */
  articlesDeStock: number;
}

/** Les titres de section : la famille au pluriel, comme on la lit dans une liste. */
const TITRE_FAMILLE: Record<PromoFamille, string> = {
  CONSOMMABLE: "Consommables",
  DURABLE: "Durables",
  NUMERIQUE: "Numériques",
};

const AIDE_FAMILLE = "Consommable : une quantité qui baisse à chaque remise, lots datés possibles. Durable : se prête et revient, ne périme pas. Numérique : un lien et une période de validité, pas de quantité.";

/**
 * LE FORMULAIRE SIMPLE (§118.173) — le nom, la famille, et si l'article existe par produit. Rien
 * d'autre ne se saisit : la nature de support, l'unité et la description restent sur les articles
 * qui les portent (l'action ne réécrit que ce que le formulaire porte).
 *
 * La case « Existe par produit » porte son TÉMOIN (§118.172) : décochée, elle doit pouvoir dire
 * NON — sans témoin, décocher sur un article qui l'était ne changerait rien.
 */
function champs(a?: ArticleCatalogueVue, familleProposee?: PromoFamille): FieldDef[] {
  return [
    ...(a ? [{ type: "hidden", name: "id", value: a.id } as FieldDef] : []),
    { type: "text", name: "nom", label: "Nom du support", required: true, defaultValue: a?.nom, placeholder: "Fiche POSO, Banner, Stylos…", full: true },
    {
      type: "select", name: "famille", label: "Famille", required: true, defaultValue: a?.famille ?? familleProposee, placeholder: "Choisir la famille",
      options: FAMILLES.map((f) => ({ value: f, label: FAMILLE_LABEL[f] })),
      hint: a && a.articlesDeStock > 0 ? `${AIDE_FAMILLE} Déjà en service : il ne passe ni vers ni depuis « Numérique ».` : AIDE_FAMILLE,
    },
    {
      type: "checkbox", name: "exigeProduit", label: "Existe par produit", defaultChecked: a?.exigeProduit ?? false, temoin: true,
      hint: "Une fiche POSO, une aide de visite : le produit est exigé à l'entrée en stock. Des stylos, non.",
    },
  ];
}

/**
 * LE CATALOGUE — l'écran (§118.164, §118.173). Les supports, rangés dans leurs TROIS familles :
 * une section par famille, dans l'ordre où on les lit (ce qu'on remet, ce qu'on prête, ce qu'on
 * montre). Lecture pour qui a le module en lecture ; ajout, correction et archivage pour qui l'a en
 * écriture ; suppression par la corbeille du Super Admin, refusée AVANT le clic sur un article qui
 * a servi (le registre le dit, et nomme l'archivage).
 */
export function CatalogueEcran({ articles, droits }: { articles: ArticleCatalogueVue[]; droits: { creer: boolean; modifier: boolean; supprimer: boolean } }) {
  // Les gestes restent fermés tant que la liste rafraîchie n'est pas arrivée (§118.172) : sans
  // cela, rouvrir un article juste après l'avoir corrigé montrerait — et réenregistrerait — l'état
  // d'avant.
  const { rafraichir, enCours: rafraichit } = useRafraichir();
  const [q, setQ] = React.useState("");
  const [archives, setArchives] = React.useState(false);
  const [edition, setEdition] = React.useState<{ article?: ArticleCatalogueVue; famille?: PromoFamille } | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);
  const [enAction, setEnAction] = React.useState(false);
  const occupe = enAction || rafraichit;

  const nArchives = articles.filter((a) => !a.actif).length;
  const recherche = q.trim().toLowerCase();
  const visibles = articles.filter((a) =>
    (archives || a.actif)
    && (!recherche || `${a.reference} ${a.nom} ${a.description ?? ""}`.toLowerCase().includes(recherche)));

  const archiver = async (a: ArticleCatalogueVue) => {
    setEnAction(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("actif", a.actif ? "false" : "true");
    try {
      const r = await archiverArticleCatalogue(fd);
      if (r.ok) { setMessage({ ok: true, texte: `${a.reference} ${a.actif ? "archivé — il ne se propose plus" : "réactivé"}.` }); rafraichir(); }
      else setMessage({ ok: false, texte: r.error ?? "L'action n'a pas abouti." });
    } catch {
      setMessage({ ok: false, texte: "L'action n'a pas abouti (connexion ou serveur). Rechargez la page avant de recommencer." });
    } finally {
      setEnAction(false);
    }
  };

  const action = async (_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> => {
    const r = edition?.article ? await modifierArticleCatalogue(fd) : await creerArticleCatalogue(fd);
    if (r.ok) { setMessage({ ok: true, texte: r.message ?? "Support enregistré." }); rafraichir(); }
    return r;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une référence, un support…" className="pl-8" aria-label="Rechercher dans le catalogue" />
        </div>
        {nArchives > 0 && (
          <label className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground sm:min-h-0">
            <input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Archivés ({nArchives})
          </label>
        )}
        {droits.creer && (
          <Button onClick={() => setEdition({})} disabled={occupe}><Plus className="h-4 w-4" /> Nouveau support</Button>
        )}
      </div>

      {!droits.creer && !droits.modifier && (
        <p className="text-xs text-muted-foreground">Vous consultez le catalogue en lecture. Un Super Admin l&apos;ouvre en écriture dans Administration › Accès.</p>
      )}

      {message && (
        <div role={message.ok ? "status" : "alert"} className={cn("flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm", message.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          <span className="flex min-w-0 items-start gap-2 [overflow-wrap:anywhere]">
            {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {message.texte}
          </span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Fermer le message" className="-my-1 -mr-1.5 shrink-0 rounded p-2 hover:bg-black/5 sm:my-0 sm:mr-0 sm:p-0.5"><X className="h-4 w-4" /></button>
        </div>
      )}

      {articles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Le catalogue est vide.{droits.creer ? " Ajoutez le premier support." : ""}
        </p>
      ) : (
        FAMILLES.map((famille) => {
          const lignes = visibles.filter((a) => a.famille === famille);
          const total = articles.filter((a) => a.famille === famille && (archives || a.actif)).length;
          return (
            <section key={famille} aria-labelledby={`famille-${famille}`} className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 id={`famille-${famille}`} className="text-sm font-semibold text-foreground">
                    {TITRE_FAMILLE[famille]} <span className="font-normal text-muted-foreground">({total})</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">{FAMILLE_AIDE[famille]}</p>
                </div>
                {droits.creer && (
                  <Button size="sm" variant="ghost" disabled={occupe} onClick={() => setEdition({ famille })}>
                    <Plus className="h-4 w-4" /> Ajouter
                  </Button>
                )}
              </div>
              {lignes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                  {total === 0 ? "Aucun support dans cette famille." : "Aucun support de cette famille ne correspond."}
                </p>
              ) : (
                <div className="surface overflow-hidden">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Support</TableHead>
                        <TableHead className="text-right">En stock</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((a) => (
                        <TableRow key={a.id} className={cn("align-top", !a.actif && "opacity-60")}>
                          <TableCell className="whitespace-nowrap font-mono text-xs sm:py-2">{a.reference}</TableCell>
                          <TableCell data-sans-etiquette className="sm:py-2">
                            <div className="w-full min-w-0">
                              <p className="font-medium text-foreground">
                                {/* Le NOM dans son propre élément : collé aux pastilles, « Fiche POSO » ne
                                    se désignait plus seul — le banc navigateur l'a nommé. */}
                                <span>{a.nom}</span>
                                {a.exigeProduit && <Badge className="ml-2 align-middle">Par produit</Badge>}
                                {!a.actif && <Badge className="ml-2 align-middle">Archivé</Badge>}
                              </p>
                              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums sm:py-2" title="Articles de stock (par produit et par société) qui citent cette référence">{a.articlesDeStock}</TableCell>
                          <TableCell className="sm:py-2">
                            <div className="flex flex-wrap justify-end gap-1">
                              {droits.modifier && (
                                <>
                                  <Button size="sm" variant="ghost" disabled={occupe} onClick={() => setEdition({ article: a })}>Modifier</Button>
                                  <Button size="sm" variant="ghost" disabled={occupe} onClick={() => archiver(a)}>{a.actif ? "Archiver" : "Réactiver"}</Button>
                                </>
                              )}
                              <SuperAdminDeleteButton kind="PROMO_CATALOGUE" id={a.id} name={`${a.reference} — ${a.nom}`} enabled={droits.supprimer} compact stay />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          );
        })
      )}

      {edition && (
        <Sheet
          open onClose={() => setEdition(null)}
          title={edition.article ? `Modifier ${edition.article.reference}` : "Nouveau support du catalogue"}
          description={edition.article ? "La référence ne change pas : c'est elle que citent les stocks." : "La référence CAT-NNNN est attribuée à l'enregistrement et ne changera plus."}
        >
          <RecordForm
            fields={champs(edition.article, edition.famille)} action={action}
            onDone={() => setEdition(null)} onCancel={() => setEdition(null)}
            submitLabel={edition.article ? "Enregistrer" : "Ajouter au catalogue"}
          />
        </Sheet>
      )}
    </div>
  );
}
