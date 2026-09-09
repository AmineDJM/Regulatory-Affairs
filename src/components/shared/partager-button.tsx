"use client";

import * as React from "react";
import { Share2, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { partagerParMessagerie, listerDestinatairesPartage } from "@/lib/actions/partage-actions";
import { libelleDuType } from "@/lib/partage";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea, Label, Input } from "@/components/ui/input";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PARTAGER PAR LA MESSAGERIE — le MÊME panneau dans Legal, Courriers, Ad&Pro, Regulatory, Drive.
 *
 * Il ne connaît aucun module : on lui donne ce qu'on partage (un type + un identifiant, et/ou
 * des nœuds du Drive) et il s'occupe du reste. C'est ce qui garantit qu'ajouter le partage à un
 * sixième écran ne demande pas d'écrire une sixième fois la vérification des droits — elle vit
 * une seule fois, côté serveur, dans `partagerParMessagerie`.
 *
 * Il n'importe que `@/lib/partage`, module PUR : la frontière client/serveur de ce dépôt casse
 * les déploiements quand un composant `"use client"` tire Prisma par un import ordinaire.
 *
 * ── DEUX PIÈCES, ET IL EN FALLAIT DEUX ──────────────────────────────────────────────────
 *
 * `PartagerSheet` est le panneau seul, PILOTÉ de l'extérieur (`open` / `onClose`) ; `Partager
 * Button` y ajoute le bouton qui l'ouvre. Le menu « … » du Drive est un PORTAIL démonté à la
 * fermeture : un panneau rendu par une de ses entrées disparaîtrait dans le même clic — le
 * dépôt le sait déjà (« Déclarer dans Legal » et « Classer en courrier » sont pilotés depuis
 * la ligne, pas depuis le menu). Un composant qui ne sait qu'être son propre déclencheur ne
 * peut donc pas entrer dans un menu, et le Drive est précisément l'écran où le partage se fait
 * depuis un menu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface PersonnePartage { id: string; name: string; role?: string | null }

export interface CiblePartage {
  refType?: EntityType;
  refId?: string;
  /** Le nom LISIBLE de l'objet — celui que le destinataire verra dans son fil. */
  refLabel?: string;
  /** Les pièces du Drive jointes au partage. Le serveur les confronte aux droits réels. */
  driveNodeIds?: readonly string[];
  /** L'adresse de l'objet dans l'ERP, pour que le destinataire y aille en un clic. */
  href?: string;
  /**
   * Les personnes proposées. OMIS, l'annuaire interne est chargé À L'OUVERTURE du panneau.
   *
   * C'est ce qui rend le partage posable sur une LIGNE de tableau sans faire descendre
   * l'annuaire dans chaque page, chaque table et chaque ligne — pour une liste que personne
   * n'ouvre dans la très grande majorité des visites. Un écran qui connaît une liste PLUS
   * PERTINENTE (les responsables d'un événement) la fournit et rien n'est chargé.
   */
  people?: readonly PersonnePartage[];
}

/** Ce qu'on annonce dans le panneau : le nom de l'objet, sinon sa nature. */
function nommer({ refLabel, driveNodeIds, refType }: CiblePartage): string {
  if (refLabel) return refLabel;
  if (driveNodeIds && driveNodeIds.length > 0) return `${driveNodeIds.length} élément(s) du Drive`;
  return libelleDuType(refType);
}

/**
 * LE PANNEAU SEUL — ouvert et fermé par l'appelant.
 *
 * Il ne se monte pas tant qu'il n'est pas ouvert : posé sur les lignes d'un tableau de deux
 * cents dossiers, deux cents formulaires cachés coûteraient un écran lent pour une liste que
 * personne n'ouvre.
 */
export function PartagerSheet({ open, onClose, ...cible }: CiblePartage & { open: boolean; onClose: () => void }) {
  const { refType, refId, refLabel, driveNodeIds, href, people } = cible;
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [choisis, setChoisis] = React.useState<string[]>([]);
  const [filtre, setFiltre] = React.useState("");
  const [annuaire, setAnnuaire] = React.useState<readonly PersonnePartage[] | null>(people ?? null);
  const [chargement, setChargement] = React.useState(false);

  // L'annuaire se charge à la PREMIÈRE ouverture, et une seule fois par panneau monté.
  React.useEffect(() => {
    if (!open || people || annuaire !== null || chargement) return;
    let vivant = true;
    setChargement(true);
    void listerDestinatairesPartage().then((r) => {
      if (!vivant) return;
      setChargement(false);
      if (r.ok) setAnnuaire(r.people);
      else { setAnnuaire([]); setErr(r.error ?? "L'annuaire n'a pas pu être chargé."); }
    });
    return () => { vivant = false; };
  }, [open, people, annuaire, chargement]);

  const gens: readonly PersonnePartage[] = people ?? annuaire ?? [];
  const quoi = nommer(cible);

  const visibles = React.useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return gens;
    return gens.filter((p) => p.name.toLowerCase().includes(q) || (p.role ?? "").toLowerCase().includes(q));
  }, [gens, filtre]);

  const bascule = (id: string) =>
    setChoisis((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Partager par messagerie"
      description={`« ${quoi} » sera envoyé dans la messagerie interne. Les pièces du Drive deviennent lisibles pour les destinataires.`}
      width="md"
    >
      <form
        action={async (fd) => {
          setBusy(true); setErr(null);
          fd.set("destinataires", JSON.stringify(choisis));
          if (refType) fd.set("refType", refType);
          if (refId) fd.set("refId", refId);
          if (refLabel) fd.set("refLabel", refLabel);
          if (href) fd.set("href", href);
          if (driveNodeIds && driveNodeIds.length > 0) fd.set("driveRefs", JSON.stringify([...driveNodeIds]));
          const r = await partagerParMessagerie(fd);
          setBusy(false);
          if (r.ok) {
            onClose(); setChoisis([]);
            // On EMMÈNE la personne dans le fil : « c'est parti » sans pouvoir le vérifier
            // est une parole à croire, et aucun écran de ce produit n'a le droit de le demander.
            if (r.conversationId) router.push(`/messages?c=${r.conversationId}`);
            else router.refresh();
          } else setErr(r.error ?? "Le partage n'a pas pu être envoyé.");
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label>Destinataires {choisis.length > 0 && <span className="text-muted-foreground">({choisis.length})</span>}</Label>
          <Input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer par nom ou fonction…"
          />
          <div className="max-h-56 overflow-y-auto rounded-md border border-input">
            {chargement && (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l&apos;annuaire…
              </p>
            )}
            {!chargement && visibles.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {gens.length === 0 ? "Aucune personne à qui partager." : "Aucune personne ne correspond."}
              </p>
            )}
            {visibles.map((p) => {
              const on = choisis.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => bascule(p.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    on ? "bg-primary/10 text-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    {p.role && <span className="block truncate text-xs text-muted-foreground">{p.role}</span>}
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Message (optionnel)</Label>
          <Textarea name="note" rows={3} placeholder="Pourquoi vous le partagez, ce que vous attendez…" />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy || choisis.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Partager
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export function PartagerButton({
  label, iconOnly = false, variant = "outline", size = "sm", ...cible
}: CiblePartage & {
  label?: string;
  /**
   * LIGNE DE TABLEAU : l'icône seule, avec son nom accessible.
   *
   * Une colonne de plus portant « Partager » sur dix lignes pousse le tableau hors de l'écran ;
   * un bouton sans nom accessible n'existe pas pour un lecteur d'écran. Les deux à la fois, donc.
   */
  iconOnly?: boolean;
  variant?: "outline" | "ghost" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = React.useState(false);
  const quoi = nommer(cible);

  return (
    // ─────────────────────────────────────────────────────────────────────────────────────
    // LA BULLE S'ARRÊTE ICI, ET C'EST STRUCTUREL.
    //
    // Ce bouton est posé sur des LIGNES CLIQUABLES (Regulatory ouvre la fiche au clic sur la
    // ligne) et le panneau `Sheet` n'est PAS monté dans un portail : il vit dans le DOM sous la
    // ligne. Sans cette barrière, cocher un destinataire ou taper une note ferait naviguer vers
    // la fiche, panneau ouvert — c'est-à-dire un partage perdu au moment de le composer.
    //
    // La barrière vit dans le COMPOSANT, pas chez ses appelants : la poser à chaque appel
    // marcherait cinq fois et serait oubliée la sixième, et l'oubli ne se voit qu'en cliquant.
    // `display: contents` ne crée aucune boîte — la mise en page des appelants ne bouge pas,
    // et les événements remontent quand même par l'arbre DOM.
    // ─────────────────────────────────────────────────────────────────────────────────────
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? `Partager « ${quoi} »` : undefined}
        title={iconOnly ? `Partager « ${quoi} »` : undefined}
      >
        <Share2 className={iconOnly ? "h-3.5 w-3.5" : "h-4 w-4"} /> {iconOnly ? null : (label ?? "Partager")}
      </Button>
      {open && <PartagerSheet open={open} onClose={() => setOpen(false)} {...cible} />}
    </span>
  );
}
