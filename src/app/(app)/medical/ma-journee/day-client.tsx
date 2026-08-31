"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MapPin, Search, Stethoscope, X } from "lucide-react";
import { logVisit } from "@/lib/actions/medical-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CarriedProduct, TourneeItem } from "@/lib/sfe-day";

/**
 * LA SAISIE D'UNE VISITE, EN TROIS GESTES — l'écran que le terrain ouvre debout.
 *
 * ── CE QUI A ÉTÉ RETIRÉ, ET POURQUOI ────────────────────────────────────────────────────────
 *
 * Pas de statut à choisir (on saisit ce qui a eu lieu), pas de région (elle est sur la fiche du
 * praticien), pas d'objectif (il se raconte dans la note), pas de sélecteur de délégué (c'est
 * celui qui saisit). Chaque champ retiré est un champ qu'on n'explique pas à quelqu'un qui n'est
 * « pas très digital » — et le premier écran qu'on n'explique pas est le premier qu'on utilise.
 *
 * Restent : QUI (pré-rempli depuis la tournée), QUOI (les produits de sa mallette, les P1 déjà
 * cochés), et un mot libre. La date par défaut est aujourd'hui, modifiable pour la saisie du
 * soir — un homme qui rentre à 19 h doit pouvoir rattraper sa journée sans mentir sur les dates.
 *
 * La note est un simple `textarea` : le micro du clavier du téléphone y dicte nativement, sans
 * qu'on ait à embarquer un enregistreur. C'est le chemin le plus court entre la parole et le
 * dossier — et il marche hors ligne, ce que notre transcription ne saurait pas faire.
 */

export interface DayPanelDoctor {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
}

export function DayClient({
  tournee, panel, produits,
}: {
  tournee: TourneeItem[];
  panel: DayPanelDoctor[];
  produits: CarriedProduct[];
}) {
  const router = useRouter();
  const [cible, setCible] = React.useState<{ id: string; name: string } | null>(null);
  const [autre, setAutre] = React.useState(false);

  const ouvrir = (id: string, name: string) => { setAutre(false); setCible({ id, name }); };

  return (
    <>
      {/* LA TOURNÉE — chaque ligne est un bouton : le geste principal de l'écran est de
          déclarer une visite faite, il ne doit jamais demander deux clics pour commencer. */}
      {tournee.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <Check className="mx-auto h-6 w-6 text-success" />
          <p className="mt-2 text-sm font-medium">Votre fréquence est à jour ce mois-ci</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aucun praticien n&apos;est en retard. Vous pouvez tout de même saisir une visite.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tournee.map((t) => (
            <li key={t.doctorId}>
              <button
                type="button"
                onClick={() => ouvrir(t.doctorId, t.name)}
                className="w-full rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[t.specialty, t.institution, t.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {/* LA RAISON, chiffrée : un ordre sans justification se subit. */}
                    <p className="mt-1 text-xs text-warning">{t.reason}</p>
                  </div>
                  <Badge tone={t.missing > 1 ? "danger" : "warning"} dot={false}>
                    {t.missing > 1 ? `${t.missing} visites` : "1 visite"}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" className="w-full" onClick={() => { setCible(null); setAutre(true); }}>
        <Stethoscope className="h-4 w-4" /> Saisir une visite chez quelqu&apos;un d&apos;autre
      </Button>

      {/* Choix libre dans le panel — le terrain improvise, et l'outil ne doit pas l'en empêcher. */}
      {autre && (
        <PickDoctor panel={panel} onPick={ouvrir} onClose={() => setAutre(false)} />
      )}

      {cible && (
        <CaptureSheet
          doctor={cible}
          produits={produits}
          onClose={() => setCible(null)}
          onDone={() => { setCible(null); router.refresh(); }}
        />
      )}
    </>
  );
}

/** Le panel, cherchable. Une liste de 200 noms sans recherche n'est pas une liste. */
function PickDoctor({
  panel, onPick, onClose,
}: { panel: DayPanelDoctor[]; onPick: (id: string, name: string) => void; onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const found = q.trim()
    ? panel.filter((d) => fold(`${d.name} ${d.institution ?? ""} ${d.city ?? ""}`).includes(fold(q.trim())))
    : panel;

  return (
    <Sheet open onClose={onClose} title="Quel praticien ?" description="Cherchez dans votre panel." width="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, établissement, ville…" className="pl-8" />
        </div>
        {found.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun praticien ne correspond.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {found.slice(0, 100).map((d) => (
              <li key={d.id}>
                <button
                  type="button" onClick={() => onPick(d.id, d.name)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[d.specialty, d.institution, d.city].filter(Boolean).join(" · ") || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/** Les trois gestes : le praticien (déjà choisi), les produits, un mot. */
function CaptureSheet({
  doctor, produits, onClose, onDone,
}: {
  doctor: { id: string; name: string };
  produits: CarriedProduct[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(produits.filter((p) => p.preselected).map((p) => p.productId)),
  );
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Sheet open onClose={onClose} title={`Visite — ${doctor.name}`} description="Ce qui vient d'avoir lieu. Trois champs, rien de plus." width="md">
      <form
        action={async (fd) => {
          setSaving(true); setErr(null);
          fd.set("doctorId", doctor.id);
          for (const id of checked) fd.append("productId", id);
          const r = await logVisit(undefined, fd);
          setSaving(false);
          if (r.ok) onDone(); else setErr(r.error ?? "Enregistrement impossible.");
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="visit-date">Date de la visite</Label>
          {/* Modifiable pour la saisie du soir ; le serveur refuse le futur. */}
          <Input id="visit-date" type="date" name="date" defaultValue={today} max={today} />
        </div>

        <div className="space-y-1.5">
          <Label>Produits présentés</Label>
          {produits.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun produit ne vous est affecté ce cycle — la visite s&apos;enregistre quand même.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {produits.map((p) => {
                const on = checked.has(p.productId);
                return (
                  <button
                    key={p.productId} type="button" onClick={() => toggle(p.productId)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-primary bg-primary/10 font-medium text-primary" : "border-input text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {on ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current" />}
                    {p.name}
                    <span className="text-[0.625rem] opacity-70">P{p.position}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visit-report">Ce qu&apos;il a dit</Label>
          <Textarea id="visit-report" name="report" rows={3} placeholder="Une phrase suffit — dictez-la avec le micro de votre clavier." />
          <p className="text-xs text-muted-foreground">Facultatif. Le micro de votre clavier fonctionne ici.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visit-follow">À faire ensuite</Label>
          <Input id="visit-follow" name="followUpActions" placeholder="Rappeler, apporter une étude, revoir en octobre…" />
        </div>

        {err && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}><X className="h-4 w-4" /> Annuler</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Visite faite
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
