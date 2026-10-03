"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { enregistrerArticleDemandePromo, retirerArticleDemandePromo } from "@/lib/actions/promo-demande-actions";
import { ACTIONS, ACTION_AIDE, ACTION_LABEL } from "@/lib/promo-material/actions-fournisseur";
import { FAMILLE_LABEL } from "@/lib/promo/catalogue";
import type { ArticleDemandeLu } from "@/lib/promo-material/achats";
import type { OptionCatalogue } from "@/lib/queries/promo-achats";
import type { ActionResult } from "@/lib/actions/types";

/**
 * LES ARTICLES DEMANDÉS — la demande d'achat ou de location, piochée dans le catalogue (§118.165).
 *
 * « Par article : le ou les produits liés, et des commentaires — autant d'articles qu'on veut, sur
 * les trois familles, pour que l'assistante de direction sache clairement quels devis chercher. »
 *
 * L'écran ne décide d'aucun droit : `canEdit` est tranché au serveur (le demandeur ou la Direction,
 * tant que les devis ne sont pas demandés — la règle de l'action), et l'action la relit.
 */

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

export function PromoArticlesCard({ id, articles, canEdit, options, avertissement }: {
  id: string;
  articles: ArticleDemandeLu[];
  canEdit: boolean;
  /** Ce qu'un changement de la liste entraîne à l'étape du dossier (§118.190) — dit AVANT le clic. */
  avertissement?: string | null;
  /** Le catalogue actif et les produits — chargés seulement quand la personne peut composer. */
  options: { catalogue: OptionCatalogue[]; produits: { id: string; nom: string }[] } | null;
}) {
  const router = useRouter();
  const [edition, setEdition] = React.useState<ArticleDemandeLu | "nouveau" | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const retirer = async (a: ArticleDemandeLu) => {
    if (!confirm(`Retirer ${a.reference} ${a.nom} de la demande ?`)) return;
    setSaving(true); setErr(null); setMsg(null);
    const fd = new FormData();
    fd.set("promoMaterialId", id);
    fd.set("requestItemId", a.id);
    const r = await retirerArticleDemandePromo(fd);
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };

  // `exactOptionalPropertyTypes` : une clé facultative absente ne s'écrit pas `undefined` — on la
  // pose seulement quand elle a une valeur.
  const champs = (a: ArticleDemandeLu | null): FieldDef[] => {
    const catalogue: Extract<FieldDef, { type: "select" }> = {
      type: "select", name: "catalogueId", label: "Article du catalogue", required: true, placeholder: "Choisir l'article",
      options: (options?.catalogue ?? []).map((c) => ({
        value: c.id,
        label: `${c.reference} — ${c.nom} (${FAMILLE_LABEL[c.famille]}${c.exigeProduit ? ", par produit" : ""})`,
      })),
    };
    if (a) catalogue.defaultValue = a.catalogueId;
    if (options && options.catalogue.length === 0) catalogue.hint = "Le catalogue est vide : seul le Super Admin (ou qui il désigne) y ajoute des articles.";
    const quantite: Extract<FieldDef, { type: "text" | "number" | "date" | "datetime-local" }> = { type: "number", name: "quantite", label: "Quantité souhaitée", hint: "Vide pour un support numérique ou une conception seule." };
    if (a?.quantite != null) quantite.defaultValue = a.quantite;
    const commentaire: Extract<FieldDef, { type: "textarea" }> = { type: "textarea", name: "commentaire", label: "Commentaire", placeholder: "Format, recto-verso, finition, délai…" };
    if (a?.commentaire) commentaire.defaultValue = a.commentaire;
    const champs: FieldDef[] = [{ type: "hidden", name: "promoMaterialId", value: id }];
    if (a) champs.push({ type: "hidden", name: "requestItemId", value: a.id });
    champs.push(
      catalogue,
      {
        type: "multiselect", name: "produitIds", label: "Produit(s) promu(s)",
        options: (options?.produits ?? []).map((p) => ({ value: p.id, label: p.nom })),
        defaultValue: a ? a.produits.map((p) => p.id) : [],
        hint: "Obligatoire pour un article « par produit » (fiche posologique, aide de visite) ; vide pour un support générique.",
        searchPlaceholder: "Rechercher un produit…", emptyLabel: "Aucun produit actif dans le référentiel.",
      },
      {
        type: "multiselect", name: "actions", label: "Ce qu'on attend du fournisseur", required: true,
        options: ACTIONS.map((x) => ({ value: x, label: `${ACTION_LABEL[x]} — ${ACTION_AIDE[x]}` })),
        defaultValue: a ? [...a.actions] : [],
        hint: "Une ou plusieurs : une fiche se conçoit puis s'imprime — souvent deux fournisseurs.",
      },
      quantite,
      commentaire,
    );
    return champs;
  };

  const action = async (_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> => {
    const r = await enregistrerArticleDemandePromo(fd);
    if (r.ok) { setMsg(r.message ?? null); setErr(null); router.refresh(); }
    return r;
  };

  return (
    <div className="space-y-3">
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Aucun article pour l'instant. Piochez dans le catalogue ce que vous voulez faire faire : l'assistante saura exactement quels devis chercher."
            : "Aucun article demandé sur ce dossier."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {articles.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  <span className="text-muted-foreground">{a.reference}</span> {a.nom}
                  {a.produits.length > 0 && <span> — {a.produits.map((p) => p.nom).join(", ")}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="neutral">{FAMILLE_LABEL[a.famille]}</Badge>
                  {a.actions.map((x) => <Badge key={x} tone="info">{ACTION_LABEL[x]}</Badge>)}
                  {a.quantite != null && <span className="tabular-nums text-muted-foreground">{nombre(a.quantite)} {a.unite}</span>}
                </div>
                {a.commentaire && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.commentaire}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEdition(a)} aria-label={`Corriger ${a.nom}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => retirer(a)} aria-label={`Retirer ${a.nom}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {err && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{err}</span></div>}
      {msg && <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div>}

      {canEdit && avertissement && <p className="text-xs text-muted-foreground">{avertissement}</p>}
      {canEdit && (
        <Button size="sm" variant="outline" disabled={saving} onClick={() => setEdition("nouveau")}><Plus className="h-4 w-4" /> Ajouter un article du catalogue</Button>
      )}

      {canEdit && edition && (
        <Sheet
          open onClose={() => setEdition(null)} width="lg"
          title={edition === "nouveau" ? "Ajouter un article à la demande" : `Corriger — ${edition.reference} ${edition.nom}`}
          description="L'article du catalogue, ses produits, la quantité souhaitée et ce qu'on attend du fournisseur."
        >
          <RecordForm
            fields={champs(edition === "nouveau" ? null : edition)} action={action}
            onDone={() => setEdition(null)} onCancel={() => setEdition(null)}
            submitLabel={edition === "nouveau" ? "Ajouter" : "Enregistrer"}
          />
        </Sheet>
      )}
    </div>
  );
}
