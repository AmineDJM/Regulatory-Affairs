"use client";

import * as React from "react";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { declarerReclamation } from "@/lib/actions/reclamation-actions";
import { TYPES_RECLAMATION, TYPE_RECLAMATION } from "@/lib/reclamations/regles";
import { CHEMIN_RECLAMATIONS, lienReclamation } from "@/lib/chemins/reclamations";
import { useRouter } from "next/navigation";

const cle = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * « NOUVELLE RÉCLAMATION » — le geste principal de l'écran. Pensé pour le téléphone (le KAM déclare en visite) : le type,
 * le produit (ses produits d'abord), le lot et la quantité, l'établissement et/ou le site PCH, ce qui s'est passé, et les
 * photos. Le responsable est prévenu.
 */
export function NouvelleReclamation({ produits, etablissements, sitesPch, ouvertAuDepart, aujourdhui }: {
  produits: { id: string; nom: string; bu: string | null; mien: boolean }[];
  etablissements: { id: string; nom: string; lieu: string | null }[];
  sitesPch: string[];
  ouvertAuDepart: boolean;
  aujourdhui: string;
}) {
  const router = useRouter();
  const { enCours, rafraichir } = useRafraichir();
  const [ouvert, setOuvert] = React.useState(ouvertAuDepart);
  const [qProduit, setQProduit] = React.useState("");
  const [qEtab, setQEtab] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const form = React.useRef<HTMLFormElement>(null);

  const produitsFiltres = React.useMemo(() => {
    const q = cle(qProduit.trim());
    return produits.filter((p) => !q || cle(p.nom).includes(q) || (p.bu && cle(p.bu).includes(q))).slice(0, 150);
  }, [produits, qProduit]);
  const etabsFiltres = React.useMemo(() => {
    const q = cle(qEtab.trim());
    return etablissements.filter((e) => !q || cle(e.nom).includes(q) || (e.lieu && cle(e.lieu).includes(q))).slice(0, 150);
  }, [etablissements, qEtab]);

  function fermer() {
    setOuvert(false);
    setErr(null);
    if (ouvertAuDepart) router.replace(CHEMIN_RECLAMATIONS);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await declarerReclamation(new FormData(e.currentTarget));
    setBusy(false);
    if (!r.ok || !r.id) { setErr(r.error ?? "La réclamation n'a pas pu être enregistrée."); return; }
    form.current?.reset();
    setOuvert(false);
    router.push(lienReclamation(r.id));
    rafraichir();
  }

  const champ = "space-y-1.5";
  return (
    <>
      <Button type="button" onClick={() => setOuvert(true)} disabled={enCours}>
        <Plus className="h-4 w-4" /> Nouvelle réclamation
      </Button>
      <Sheet open={ouvert} onClose={fermer} title="Nouvelle réclamation" width="lg">
        <form ref={form} onSubmit={envoyer} className="space-y-4">
          <div className={champ}>
            <Label htmlFor="rec-type">Type *</Label>
            <Select id="rec-type" name="type" required defaultValue="RECLAMATION_QUALITE">
              {TYPES_RECLAMATION.map((t) => <option key={t} value={t}>{TYPE_RECLAMATION[t].label}</option>)}
            </Select>
          </div>
          <div className={champ}>
            <Label htmlFor="rec-produit">Produit *</Label>
            <Input type="search" autoComplete="off" value={qProduit} onChange={(e) => setQProduit(e.target.value)} placeholder="Rechercher un produit…" aria-label="Rechercher un produit" />
            <Select id="rec-produit" name="promoProductId" required defaultValue="">
              <option value="">— Choisir le produit —</option>
              {produitsFiltres.map((p) => <option key={p.id} value={p.id}>{p.nom}{p.bu ? ` — ${p.bu}` : ""}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={champ}>
              <Label htmlFor="rec-lot">Lot</Label>
              <Input id="rec-lot" name="lot" autoComplete="off" />
            </div>
            <div className={champ}>
              <Label htmlFor="rec-qte">Quantité (boîtes)</Label>
              <Input id="rec-qte" name="quantity" inputMode="numeric" autoComplete="off" />
            </div>
          </div>
          <div className={champ}>
            <Label htmlFor="rec-etab">Établissement</Label>
            <Input type="search" autoComplete="off" value={qEtab} onChange={(e) => setQEtab(e.target.value)} placeholder="Rechercher dans l'annuaire…" aria-label="Rechercher un établissement" />
            <Select id="rec-etab" name="institutionId" defaultValue="">
              <option value="">— Aucun —</option>
              {etabsFiltres.map((x) => <option key={x.id} value={x.id}>{x.nom}{x.lieu ? ` — ${x.lieu}` : ""}</option>)}
            </Select>
          </div>
          <div className={champ}>
            <Label htmlFor="rec-pch">Site PCH (DR, annexe)</Label>
            <Input id="rec-pch" name="pchSite" list="rec-sites-pch" autoComplete="off" />
            <datalist id="rec-sites-pch">{sitesPch.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className={champ}>
            <Label htmlFor="rec-date">Date</Label>
            <Input id="rec-date" type="date" name="occurredOn" defaultValue={aujourdhui} max={aujourdhui} />
          </div>
          <div className={champ}>
            <Label htmlFor="rec-desc">Ce qui s&apos;est passé *</Label>
            <Textarea id="rec-desc" name="description" required minLength={5} className="min-h-[110px]" />
          </div>
          <div className={champ}>
            <Label htmlFor="rec-pieces" className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Photos, documents</Label>
            <input id="rec-pieces" name="files" type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium" />
          </div>
          {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full sm:h-10 sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Déclarer
          </Button>
        </form>
      </Sheet>
    </>
  );
}
