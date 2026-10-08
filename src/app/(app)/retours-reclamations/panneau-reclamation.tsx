"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { changerStatutReclamation, qualifierReclamation } from "@/lib/actions/reclamation-actions";
import { statutsSuivants, type StatutReclamation } from "@/lib/reclamations/regles";

/** LE PANNEAU LATÉRAL D'UNE RÉCLAMATION — la fiche, l'instruction, les pièces et l'échange ; il se referme sur la liste. */
export function PanneauReclamation({ titre, description, retour, children }: {
  titre: string;
  description?: string;
  retour: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Sheet open onClose={() => router.push(retour)} title={titre} description={description} width="lg">
      {children}
    </Sheet>
  );
}

const LIBELLE_GESTE: Record<StatutReclamation, string> = {
  EN_ANALYSE: "Prendre en analyse",
  CLOTUREE: "Clôturer",
  OUVERTE: "Rouvrir",
};

/** L'INSTRUCTION — le statut (clôturer exige la conclusion), le responsable, le cas de pharmacovigilance lié. */
export function InstructionReclamation({ id, status, ownerId, pvCaseId, personnes, casPv }: {
  id: string;
  status: StatutReclamation;
  ownerId: string | null;
  pvCaseId: string | null;
  personnes: { id: string; name: string }[];
  casPv: { id: string; label: string }[] | null;
}) {
  const { enCours, rafraichir } = useRafraichir();
  const [vers, setVers] = React.useState<StatutReclamation | null>(null);
  const [conclusion, setConclusion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function statut(cible: StatutReclamation) {
    if (cible === "CLOTUREE" && vers !== "CLOTUREE") { setVers("CLOTUREE"); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("reclamationId", id);
    fd.set("status", cible);
    if (cible === "CLOTUREE") fd.set("conclusion", conclusion);
    const r = await changerStatutReclamation(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Échec."); return; }
    setVers(null); setConclusion("");
    rafraichir();
  }

  async function qualifier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    fd.set("reclamationId", id);
    const r = await qualifierReclamation(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Échec."); return; }
    rafraichir();
  }

  const occupe = busy || enCours;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {statutsSuivants(status).map((s) => (
          <Button key={s} type="button" size="sm" variant={s === "CLOTUREE" ? "primary" : "outline"} disabled={occupe} onClick={() => statut(s)}>
            {busy && vers === s ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{LIBELLE_GESTE[s]}
          </Button>
        ))}
      </div>
      {vers === "CLOTUREE" && (
        <div className="space-y-2">
          <Label htmlFor="rec-conclusion">Conclusion</Label>
          <Textarea id="rec-conclusion" value={conclusion} onChange={(e) => setConclusion(e.target.value)} className="min-h-[80px]" />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={occupe || !conclusion.trim()} onClick={() => statut("CLOTUREE")}>Confirmer la clôture</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setVers(null)}>Annuler</Button>
          </div>
        </div>
      )}
      <form onSubmit={qualifier} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="rec-owner">Responsable</Label>
          <Select id="rec-owner" name="ownerId" defaultValue={ownerId ?? ""}>
            <option value="">— Personne —</option>
            {personnes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {casPv ? (
          <div className="min-w-0 space-y-1">
            <Label htmlFor="rec-pv">Cas de pharmacovigilance</Label>
            <Select id="rec-pv" name="pvCaseId" defaultValue={pvCaseId ?? ""}>
              <option value="">— Aucun —</option>
              {casPv.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
        ) : (
          <input type="hidden" name="pvCaseId" value={pvCaseId ?? ""} />
        )}
        <Button type="submit" size="sm" variant="outline" disabled={occupe}>Enregistrer</Button>
      </form>
      {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
