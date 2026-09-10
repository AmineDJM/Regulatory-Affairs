"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Clock, Loader2, Mic, Plus, Square } from "lucide-react";
import { rapporterVisite, ajouterVisiteImprevue } from "@/lib/actions/tour-visit-actions";
import { ETAT_VISITE_LABELS, VUES, VUE_LABELS, type EtatVisite, type VueTournee } from "@/lib/sfe/tournee";
import type { AvancementTournee } from "@/lib/sfe/tournee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface LigneVue {
  id: string;
  date: string;
  doctorName: string;
  institution: string | null;
  city: string | null;
  specialty: string | null;
  etat: EtatVisite;
  origine: string;
  objectif: string | null;
  rapport: string | null;
  produits: string[];
  messages: string[];
  heuresRestantes: number;
  vocal: boolean;
}

/**
 * L'EMPLOI DU TEMPS DU KAM — gris tant que le rapport n'est pas fait, vert après.
 *
 * ── TROIS COULEURS, PAS DEUX ────────────────────────────────────────────────────────────────
 *
 * La demande dit gris → vert. Mais la fenêtre de rapport se ferme 48 h après la visite : une
 * visite du 3 sans rapport le 10 n'est plus « en attente », elle est PERDUE. La laisser grise
 * ferait lire un retard rattrapable là où il n'y a plus rien à rattraper — d'où l'ambre, et le
 * compte des heures restantes tant qu'il en reste.
 *
 * ── LE MINIMUM DE CLICS ─────────────────────────────────────────────────────────────────────
 *
 * Un clic sur la ligne ouvre le rapport. Les produits de sa gamme sont là, cochables ; les
 * messages de la Direction Marketing aussi. Le premier produit arrive PRÉ-COCHÉ quand la gamme
 * n'en compte qu'un — décocher est plus rapide que chercher, et c'est ce qui fait rentrer les
 * rapports le soir même.
 *
 * ── LA DICTÉE ───────────────────────────────────────────────────────────────────────────────
 *
 * La reconnaissance vocale du navigateur remplit le champ ; si elle n'existe pas, le bouton le
 * DIT et le clavier reste. Annoncer une dictée qui ne marche pas est pire que ne pas l'offrir.
 */
export function EmploiDuTemps({
  vue, lignes, avancement, produits, produitsIncomplets, messages, sansBu, panel,
}: {
  vue: VueTournee;
  lignes: LigneVue[];
  avancement: AvancementTournee;
  produits: { productId: string; name: string }[];
  produitsIncomplets: string[];
  messages: { id: string; title: string; body: string | null; buName: string | null }[];
  sansBu: boolean;
  /** Le panel, pour la visite imprévue. */
  panel: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [ouverte, setOuverte] = React.useState<LigneVue | null>(null);
  const [imprevue, setImprevue] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const changerVue = (v: VueTournee) => {
    const q = new URLSearchParams(params?.toString() ?? "");
    q.set("vue", v);
    router.push(`/medical/ma-journee?${q.toString()}`);
  };

  const run = async (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) => {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return false; }
    router.refresh();
    return true;
  };

  const tonDe = (e: EtatVisite): "neutral" | "success" | "warning" | "info" =>
    e === "FAITE" ? "success" : e === "PERDUE" ? "warning" : e === "ANNULEE" || e === "REPORTEE" ? "info" : "neutral";

  const jourDe = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

  return (
    <div className="space-y-3">
      {/* ── LES QUATRE VUES ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => changerVue(v)}
            aria-current={v === vue ? "page" : undefined}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm",
              v === vue ? "bg-primary text-primary-foreground" : "border border-input hover:bg-secondary",
            )}
          >
            {VUE_LABELS[v]}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {/* LE DÉNOMINATEUR DE LA DIRECTION, sur le MOIS — « Aujourd'hui » ne dit rien d'un
              objectif mensuel, et afficher le taux du jour ferait lire 0 % chaque matin. */}
          Ce mois : <strong className="text-foreground tabular-nums">{avancement.visitees}/{avancement.planifiees}</strong> visitées
          {avancement.imprevues > 0 && <> · {avancement.imprevues} imprévue(s)</>}
          {avancement.perdues > 0 && <> · <span className="text-warning">{avancement.perdues} hors délai</span></>}
        </span>
      </div>

      {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      {/* ── L'EMPLOI DU TEMPS EN TABLEAU ────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Jour</th>
              <th className="px-3 py-2 font-medium">Praticien</th>
              <th className="px-3 py-2 font-medium">État</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Aucune visite sur « {VUE_LABELS[vue]} ». Les visites viennent de votre plan de tournée validé —
                  ou d&apos;une visite imprévue que vous ajoutez ci-dessous.
                </td>
              </tr>
            )}
            {lignes.map((l) => (
              <tr
                key={l.id}
                className={cn(
                  "border-t border-border",
                  // GRIS / VERT / AMBRE : la couleur EST l'information, la pastille la nomme.
                  l.etat === "FAITE" && "bg-success/5",
                  l.etat === "PERDUE" && "bg-warning/5",
                )}
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{jourDe(l.date)}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{l.doctorName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[l.specialty, l.institution, l.city].filter(Boolean).join(" · ") || "—"}
                  </span>
                  {l.origine === "DIRECTION" && (
                    <Badge tone="info" dot={false}>Demandée par la Direction{l.objectif ? ` — ${l.objectif}` : ""}</Badge>
                  )}
                  {l.origine === "UNPLANNED" && <Badge tone="neutral" dot={false}>Imprévue</Badge>}
                  {l.etat === "FAITE" && l.produits.length > 0 && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{l.produits.join(" · ")}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={tonDe(l.etat)}>{ETAT_VISITE_LABELS[l.etat]}</Badge>
                  {/* LES HEURES RESTANTES : c'est ce qui fait rentrer un rapport le soir même.
                      Un « à faire » sans délai se remet à demain, puis se perd. */}
                  {l.etat === "A_FAIRE" && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden /> {l.heuresRestantes} h restantes
                    </span>
                  )}
                  {l.vocal && <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Mic className="h-3 w-3" aria-hidden /> vocal</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.etat === "A_FAIRE" ? (
                    <Button size="sm" onClick={() => { setErr(null); setOuverte(l); }} disabled={busy}>
                      Rapport
                    </Button>
                  ) : l.etat === "PERDUE" ? (
                    <span className="text-xs text-warning">Délai dépassé</span>
                  ) : l.etat === "FAITE" ? (
                    <Check className="ml-auto h-4 w-4 text-success" aria-label="Rapport fait" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" onClick={() => { setErr(null); setImprevue(true); }} disabled={busy}>
        <Plus className="h-4 w-4" /> Ajouter une visite imprévue
      </Button>

      {/* ── LE RAPPORT TERRAIN ──────────────────────────────────────────────── */}
      <Sheet
        open={ouverte !== null}
        onClose={() => setOuverte(null)}
        title={ouverte ? `Rapport — ${ouverte.doctorName}` : ""}
        description={ouverte ? `Visite du ${new Date(ouverte.date).toLocaleDateString("fr-FR")} · ${ouverte.heuresRestantes} h restantes pour la rapporter.` : ""}
        width="md"
      >
        {ouverte && (
          <FormulaireRapport
            action={async (fd) => {
              fd.set("visitId", ouverte.id);
              if (await run(rapporterVisite, fd)) setOuverte(null);
            }}
            produits={produits}
            produitsIncomplets={produitsIncomplets}
            messages={messages}
            sansBu={sansBu}
            messageObligatoire
            busy={busy}
            err={err}
            onCancel={() => setOuverte(null)}
          />
        )}
      </Sheet>

      {/* ── LA VISITE IMPRÉVUE ──────────────────────────────────────────────── */}
      <Sheet
        open={imprevue}
        onClose={() => setImprevue(false)}
        title="Visite imprévue"
        description="Une rencontre que le plan ne prévoyait pas. Elle compte au nombre de visites, jamais au dénominateur du plan."
        width="md"
      >
        <FormulaireRapport
          action={async (fd) => { if (await run(ajouterVisiteImprevue, fd)) setImprevue(false); }}
          produits={produits}
          produitsIncomplets={produitsIncomplets}
          messages={messages}
          sansBu={sansBu}
          // LE MESSAGE EST FACULTATIF ICI — la demande le dit, et une rencontre de couloir n'a
          // pas d'ordre de mission.
          messageObligatoire={false}
          busy={busy}
          err={err}
          onCancel={() => setImprevue(false)}
          entete={
            <>
              <div>
                <Label htmlFor="imp-doctor">Praticien rencontré</Label>
                <Select id="imp-doctor" name="doctorId" required defaultValue="">
                  <option value="" disabled>— Choisir dans votre panel —</option>
                  {panel.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="imp-date">Jour de la rencontre</Label>
                <Input id="imp-date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Jamais dans le futur, et dans les 48 h : c&apos;est la même borne que pour une visite planifiée.
                </p>
              </div>
            </>
          }
        />
      </Sheet>
    </div>
  );
}

/**
 * LE FORMULAIRE DE RAPPORT — le même pour une visite planifiée et pour un imprévu.
 *
 * L'écrire deux fois ferait diverger les deux saisies au premier champ ajouté, et le KAM
 * apprendrait deux gestes pour une seule chose (§118.5).
 */
function FormulaireRapport({
  action, produits, produitsIncomplets, messages, sansBu, messageObligatoire, busy, err, onCancel, entete,
}: {
  action: (fd: FormData) => void | Promise<void>;
  produits: { productId: string; name: string }[];
  produitsIncomplets: string[];
  messages: { id: string; title: string; body: string | null; buName: string | null }[];
  sansBu: boolean;
  messageObligatoire: boolean;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
  entete?: React.ReactNode;
}) {
  const [texte, setTexte] = React.useState("");
  const [dictee, setDictee] = React.useState<"absente" | "prete" | "en-cours">("absente");
  const recRef = React.useRef<{ start: () => void; stop: () => void } | null>(null);

  React.useEffect(() => {
    // LA DICTÉE N'EST PAS PROMISE AVANT D'ÊTRE LÀ : annoncer un micro qui ne marche pas est pire
    // que ne pas l'offrir — la personne appuie, rien ne se passe, et elle cesse de faire
    // confiance à l'écran.
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor() as {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void; start: () => void; stop: () => void;
    };
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let ajout = "";
      for (let i = 0; i < e.results.length; i += 1) ajout += `${e.results[i]![0]!.transcript} `;
      setTexte(ajout.trim());
    };
    rec.onend = () => setDictee("prete");
    recRef.current = rec;
    setDictee("prete");
  }, []);

  const basculerDictee = () => {
    if (!recRef.current) return;
    if (dictee === "en-cours") { recRef.current.stop(); setDictee("prete"); }
    else { recRef.current.start(); setDictee("en-cours"); }
  };

  return (
    <form className="space-y-3" action={action}>
      {entete}

      {/* ── LES PRODUITS DE SA GAMME ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Produits discutés <span className="text-destructive">*</span>
        </p>
        {sansBu ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs">
            Aucune Business Unit ne vous est rattachée : la liste de vos produits est donc vide et le rapport sera
            refusé. Votre superviseur vous rattache à une gamme depuis Force de vente › Business Units.
          </p>
        ) : produits.length === 0 ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs">
            Aucun produit actif dans votre gamme.
            {produitsIncomplets.length > 0 && (
              <> {produitsIncomplets.length} produit(s) promu(s) ({produitsIncomplets.slice(0, 3).join(", ")}) n&apos;ont pas
              de produit canonique rattaché et ne peuvent donc pas figurer dans un rapport — à corriger dans
              Force de vente › Business Units.</>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {produits.map((p, i) => (
              <label key={p.productId} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2 py-1 text-sm">
                <input
                  type="checkbox" name="productId" value={p.productId}
                  // UN SEUL PRODUIT DANS LA GAMME : il arrive coché. Décocher est plus rapide que
                  // chercher, et c'est ce qui fait tenir « le minimum de clics ».
                  defaultChecked={produits.length === 1 && i === 0}
                  className="h-4 w-4 rounded border-input"
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
        {produits.length > 0 && produitsIncomplets.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {produitsIncomplets.length} produit(s) de votre gamme ne sont pas rattachés à un produit canonique et
            n&apos;apparaissent donc pas ici : {produitsIncomplets.slice(0, 3).join(", ")}.
          </p>
        )}
      </div>

      {/* ── LES MESSAGES DE LA DIRECTION MARKETING ───────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Messages portés {messageObligatoire && <span className="text-destructive">*</span>}
        </p>
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
            Aucun message pré-défini n&apos;est publié pour votre gamme.
            {messageObligatoire && " Le rapport sera refusé : demandez à la Direction Marketing d'en publier (Force de vente › Messages)."}
          </p>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {messages.map((m) => (
              <label key={m.id} className="flex items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-secondary">
                <input type="checkbox" name="messageId" value={m.id} className="mt-0.5 h-4 w-4 rounded border-input" />
                <span className="min-w-0">
                  <span className="font-medium">{m.title}</span>
                  {m.body && <span className="block text-xs text-muted-foreground">{m.body}</span>}
                  {m.buName && <span className="block text-xs text-muted-foreground">Gamme {m.buName}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── VOCAL OU ÉCRIT ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="rapport-texte">Compte rendu <span className="text-destructive">*</span></Label>
          {dictee === "absente" ? (
            <span className="text-xs text-muted-foreground">Dictée indisponible sur ce navigateur — le clavier reste.</span>
          ) : (
            <Button type="button" size="sm" variant={dictee === "en-cours" ? "destructive" : "outline"} onClick={basculerDictee}>
              {dictee === "en-cours" ? <><Square className="h-3.5 w-3.5" /> Arrêter</> : <><Mic className="h-3.5 w-3.5" /> Dicter</>}
            </Button>
          )}
        </div>
        <Textarea
          id="rapport-texte" name="report" rows={4} required
          value={texte} onChange={(e) => setTexte(e.target.value)}
          placeholder="Ce que le médecin a dit, ses objections, ce qu'il attend."
        />
        {/* LA TRANSCRIPTION VOYAGE À PART quand elle vient du micro : elle crée un rapport
            vocal (`FieldReport`) rattaché à la visite, avec sa propre relecture. */}
        {dictee !== "absente" && <input type="hidden" name="transcript" value={dictee === "prete" && texte ? texte : ""} />}
      </div>

      <div>
        <Label htmlFor="rapport-suite">Ce qu&apos;il reste à faire</Label>
        <Input id="rapport-suite" name="followUpActions" placeholder="Rappeler après le comité du 12, envoyer l'étude…" />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Annuler</Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer le rapport
        </Button>
      </div>
      {messageObligatoire && messages.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Produits et messages sont exigés : sans eux, ni l&apos;effort par produit ni l&apos;efficacité d&apos;un
          message ne se mesurent — c&apos;est précisément ce que la Direction demande de savoir.
        </p>
      )}
    </form>
  );
}
