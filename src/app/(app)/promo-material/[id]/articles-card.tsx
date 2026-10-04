"use client";

import * as React from "react";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { enregistrerArticleDemandePromo, retirerArticleDemandePromo } from "@/lib/actions/promo-demande-actions";
import { demanderDevisPromo } from "@/lib/actions/promo-devis-actions";
import { Label, Textarea } from "@/components/ui/input";
import { ACTIONS, ACTION_AIDE, ACTION_LABEL } from "@/lib/promo-material/actions-fournisseur";
import { FAMILLE_LABEL } from "@/lib/promo/catalogue";
import { libellesPromusDeLArticle, type ArticleDemandeLu } from "@/lib/promo-material/achats";
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

/** La demande de devis AVANT son départ (§118.204) — son aperçu, ses précisions, et le geste qui l'envoie quand il le faut. */
export interface EnvoiDevis {
  /** Le texte exact que l'assistante recevra (`texteDemandeDeDevis`). */
  apercu: string;
  precisions: string | null;
  /** « Devis à demander » : l'envoi automatique n'a pas pu partir (ou dossier d'avant) — le demandeur l'envoie d'ici. */
  peutEnvoyer: boolean;
  /** La demande attend sa validation : la demande de devis partira d'elle-même ensuite. */
  attendValidation: boolean;
}

export function PromoArticlesCard({ id, articles, canEdit, options, avertissement, envoiDevis = null }: {
  id: string;
  articles: ArticleDemandeLu[];
  canEdit: boolean;
  /** Ce qu'un changement de la liste entraîne à l'étape du dossier (§118.190) — dit AVANT le clic. */
  avertissement?: string | null;
  /** Le catalogue actif et les produits — chargés seulement quand la personne peut composer. */
  options: { catalogue: OptionCatalogue[]; produits: { id: string; nom: string }[] } | null;
  envoiDevis?: EnvoiDevis | null;
}) {
  // LE RAFRAÎCHISSEMENT SUIVI (§118.172) : une fiche ouverte avant la fin rouvrirait l'état d'avant — les gestes attendent.
  const { enCours, rafraichir } = useRafraichir();
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
    if (r.ok) { setMsg(r.message ?? null); rafraichir(); } else setErr(r.error ?? "Action impossible.");
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
    const autre: Extract<FieldDef, { type: "text" | "number" | "date" | "datetime-local" }> = { type: "text", name: "autre", label: "Autre produit promu (saisie libre)", hint: "Un produit qui n'est dans aucune liste — écrit tel que l'assistante le cherchera." };
    if (a?.choixPromus?.autre) autre.defaultValue = a.choixPromus.autre;
    const champs: FieldDef[] = [{ type: "hidden", name: "promoMaterialId", value: id }];
    if (a) champs.push({ type: "hidden", name: "requestItemId", value: a.id });
    champs.push(
      catalogue,
      {
        type: "multiselect", name: "produitIds", label: "Produit(s) promu(s)",
        options: (options?.produits ?? []).map((p) => ({ value: p.id, label: p.nom })),
        defaultValue: a ? (a.choixPromus?.codes ?? a.produits.map((p) => p.id)) : [],
        hint: "La société en général, une gamme, ou les produits des Business Units. Obligatoire pour un article « par produit » (fiche posologique, aide de visite).",
        searchPlaceholder: "Rechercher un produit, une gamme…", emptyLabel: "Aucune gamme ni produit actif dans les Business Units.",
      },
      autre,
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

  // ENVOYER LA DEMANDE DE DEVIS — le repli (§118.204), avec les précisions saisies DANS cette rubrique.
  const envoyer = async (fd: FormData) => {
    setSaving(true); setErr(null); setMsg(null);
    fd.set("promoMaterialId", id);
    const r = await demanderDevisPromo(fd);
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); rafraichir(); } else setErr(r.error ?? "Envoi impossible.");
  };

  const action = async (_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> => {
    const r = await enregistrerArticleDemandePromo(fd);
    if (r.ok) { setMsg(r.message ?? null); setErr(null); rafraichir(); }
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
                  {libellesPromusDeLArticle(a).length > 0 && <span> — {libellesPromusDeLArticle(a).join(", ")}</span>}
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
                  <Button size="sm" variant="ghost" disabled={saving || enCours} onClick={() => setEdition(a)} aria-label={`Corriger ${a.nom}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={saving || enCours} onClick={() => retirer(a)} aria-label={`Retirer ${a.nom}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* LA DEMANDE DE DEVIS, AVANT SON DÉPART (§118.204) — dans la MÊME rubrique que les articles : ce que
          l'assistante recevra, mot pour mot. Elle part d'elle-même ; le bouton n'apparaît que si elle est restée. */}
      {envoiDevis && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">Aperçu de la demande de devis</p>
          <p className="text-xs text-muted-foreground">
            {envoiDevis.attendValidation
              ? "Elle partira d'elle-même à l'assistante de direction dès que la demande sera validée."
              : envoiDevis.peutEnvoyer
                ? "Elle n'est pas encore partie : relisez-la, ajoutez vos précisions, puis envoyez-la."
                : "Elle n'est pas encore partie : le demandeur l'envoie d'ici."}
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs">{envoiDevis.apercu}</pre>
          {envoiDevis.peutEnvoyer && (
            <form action={envoyer} className="space-y-2">
              <Label htmlFor="promo-precisions-devis">Précisions pour l&apos;assistante (facultatif)</Label>
              <Textarea id="promo-precisions-devis" name="note" defaultValue={envoiDevis.precisions ?? ""} className="min-h-[60px]" placeholder="Agences à consulter, délai souhaité…" />
              <Button type="submit" size="sm" disabled={saving || enCours}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer la demande de devis
              </Button>
            </form>
          )}
        </div>
      )}

      {err && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{err}</span></div>}
      {msg && <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div>}

      {canEdit && avertissement && <p className="text-xs text-muted-foreground">{avertissement}</p>}
      {canEdit && (
        <Button size="sm" variant="outline" disabled={saving || enCours} onClick={() => setEdition("nouveau")}><Plus className="h-4 w-4" /> Ajouter un article du catalogue</Button>
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
