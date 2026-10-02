"use client";

import * as React from "react";
import Link from "next/link";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import {
  Plus, Trash2, Loader2, CheckCircle2, XCircle, Receipt, Link2, AlertTriangle, ExternalLink, Send, FileText,
  ThumbsUp, ThumbsDown, RotateCcw, History, Pencil, MoreHorizontal, Circle, X, Wallet, Split, ChevronDown, ChevronRight,
} from "lucide-react";
import type { AdProItemKind, AdProItemStatus, AdProItemBudgetKind, AdProItemOrderStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ItemAskPanel } from "./item-ask-panel";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  breakdown, canEmitOrder, canRemoveItem, budgetKindLocked, plannedGaps,
  ITEM_KINDS, ITEM_KIND_LABELS, ITEM_STATUS_LABELS, ITEM_BUDGET_KIND_LABELS, ITEM_ORDER_STAGE_LABELS, LIBELLE_BC_SOUS_LE_SEUIL,
  type AdProParent,
} from "@/lib/ad-pro-items";
import {
  addAdProItem, updateAdProItem, deleteAdProItem, repartirPoste,
  emitItemExpenseOrder, linkPromoMaterial,
  submitAdProItem, decideAdProItem, setAdProItemBudget,
  demanderPieceSecretariat, requestAdProItemOrder, approveAdProItemOrder,
} from "@/lib/actions/ad-pro-item-actions";
import {
  NATURES_PIECE_SECRETARIAT, PIECE_SECRETARIAT, peutDemanderPiece, type NaturePieceSecretariat,
} from "@/lib/ad-pro/pieces-secretariat";
import {
  etapesDuPoste, prochainPas, grouperParRepartition, faitsDuPoste, VERSEMENT_SANS_BC,
  type CleGeste, type Etape, type RegardPoste,
} from "@/lib/ad-pro/poste-etapes";
import { NATURES_REPARTITION } from "@/lib/ad-pro/repartition";
import { porteDesVoyageurs } from "@/lib/ad-pro/voyageurs";
import { DocumentUpload } from "@/components/documents/document-upload";
import { AD_PRO_DOC_CATEGORIES } from "@/lib/ad-pro/doc-categories";
import { faitDeStock, NATURE_MATERIEL_STOCK } from "@/lib/promo/reservations";
import { BlocMaterielStock, type LigneStockVue, type ContexteMaterielStock } from "./materiel-stock";
import { BlocVoyageurs, type VoyageurVue } from "./voyageurs-bloc";

export type { LigneStockVue, ContexteMaterielStock, ArticleMagasinVue } from "./materiel-stock";
export type { VoyageurVue } from "./voyageurs-bloc";

/** Un poste « Matériel du stock » n'engage pas d'argent : il ne montre ni montant, ni budget, ni BC. */
const estPosteStock = (it: { kind: AdProItemKind }) => it.kind === NATURE_MATERIEL_STOCK;
/** Un poste qui liste les articles du stock se compose tant qu'il n'est ni soumis ni accordé. */
const POSTE_STOCK_EDITABLE: readonly AdProItemStatus[] = ["DRAFT", "REVISION", "REJECTED"];

export interface ItemRow {
  id: string;
  kind: AdProItemKind;
  label: string;
  notes: string | null;
  supplier: string | null;
  amountEstimated: number | null;
  amountGranted: number | null;
  addedAfterDecision: boolean;
  promoMaterialId: string | null;
  promoMaterial: { reference: string; title: string; status: string } | null;
  expenseOrderId: string | null;
  expenseOrder: { reference: string; status: string } | null;
  /** Cycle de validation propre au poste. */
  status: AdProItemStatus;
  budgetKind: AdProItemBudgetKind;
  decisionNote: string | null;
  decidedAt: string | null;
  /** Budget (catégorie d'enveloppe) qui portera la dépense, choisi après accord. */
  budgetCategoryId: string | null;
  budgetCategoryLabel: string | null;
  /** Les demandes de pièce ouvertes au secrétariat pour ce poste (devis, facture). */
  demandes: { id: string; reference: string; nature: NaturePieceSecretariat; status: string }[];
  /** Combien de pièces jointes le poste porte — le détail se déplie à la demande. */
  documentCount: number;
  /** Émission du bon de commande : demande → visa du centre (au-dessus du seuil) → Finances. */
  orderStage: AdProItemOrderStage;
  /** Vrai quand le BC est passé aux Finances SOUS le seuil, sans visa d'aucun centre (§118.149). */
  orderSansCentre?: boolean;
  /** Le message du DEMANDEUR : contenu du bon de commande, références, fournisseur. */
  orderNote: string | null;
  /** La note de la Direction sur son visa ou son refus — elle n'écrase plus la précédente. */
  orderDecisionNote: string | null;
  /** Historique des allers-retours avec la Direction (le plus récent en tête). */
  decisions: { decision: AdProItemStatus; note: string | null; amount: number | null; at: string; by: string | null }[];
  /** Le matériel du magasin listé par un poste « Matériel du stock » (§118.167) — vide sinon. */
  lignesStock: LigneStockVue[];
  /** Les postes nés d'une même répartition d'un sponsoring indirect (§118.175). */
  repartitionId: string | null;
  /** Le sujet de réservation d'une billetterie, s'il a été ouvert. */
  reservation: { id: string; reference: string } | null;
  /** Les voyageurs d'un poste « billetterie » — vide sinon. */
  voyageurs: VoyageurVue[];
  /** Les noms que la demande porte déjà — proposés à la saisie d'un voyageur, jamais imposés. */
  nomsSuggeres: string[];
}

interface Props {
  parent: AdProParent;
  parentId: string;
  items: ItemRow[];
  /** Enveloppe accordée par la Direction (DZD), ou null si elle n'a pas encore tranché. */
  amountGranted: number | null;
  decided: boolean;
  /**
   * Un poste ajouté MAINTENANT l'est-il après la décision sur l'ARGENT (§118.151) ? Par défaut,
   * `decided`. Un sponsoring dont la TENUE est pré-validée est décidé sans avoir d'enveloppe :
   * y ajouter des postes est l'étape même de la procédure, pas un dépassement à signaler.
   */
  tardif?: boolean;
  /**
   * La demande est CLÔTURÉE : postes, montants, décisions et budgets sont arrêtés (§118.151).
   * Ce qui EXÉCUTE ce qui a été validé reste offert — pièces, bon de commande, émission — sans
   * quoi la clôture laisserait en plan un poste accordé dont le BC n'était pas encore parti.
   */
  fige?: boolean;
  canEdit: boolean;
  /** Affecter les montants et engager la dépense : Direction uniquement. */
  canAllocate: boolean;
  /**
   * Siège au CENTRE DE VALIDATION AD & PRO — seul à viser un bon de commande (§118.148). Distinct
   * de `canAllocate` : répartir l'enveloppe entre les postes reste un geste de la Direction ; le
   * visa d'un BC ne l'est plus. Calculé au serveur, jamais deviné ici.
   */
  canViserBC?: boolean;
  promoOptions: { id: string; reference: string; title: string; status: string }[];
  /** Congrès : ce qui est ANNONCÉ (stand, symposium) et qu'il faudrait chiffrer. */
  plan?: { hasBooth?: boolean | null; hasSymposium?: boolean | null };
  /** (Sous-)catégories budgétaires proposées pour imputer un poste accordé. */
  budgetOptions?: { id: string; label: string }[];
  /** Les Finances émettent le bon de commande visé par la Direction. */
  canIssueOrder?: boolean;
  /**
   * Le magasin où un poste « Matériel du stock » pioche, et qui confirme après l'événement
   * (§118.167). Obligatoire : une page qui l'oublierait laisserait ses postes de stock sans
   * article à lister ni confirmation possible, en silence.
   */
  materiel: ContexteMaterielStock;
}

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText: string) => Promise<void>;

/**
 * DE QUOI EST FAIT LE MONTANT — les postes d'une opération Ad & Pro (§118.175).
 *
 * « Ici c'est trop complexe : plus simple, plus séparé, plus lisible, moins de boutons et de CTA
 * partout » (Direction, 01/10). Un poste affichait jusqu'à neuf commandes à la fois, dont
 * plusieurs désactivées avec leur raison collée à côté ; on lisait tout pour trouver la seule
 * chose qu'on pouvait faire. Chaque poste est maintenant une CARTE :
 *
 *   1. ce qu'il est (nature, libellé, statut) et ce qu'il coûte, sur deux lignes ;
 *   2. une FRISE — chiffré → Direction → budget → bon de commande → paiement ;
 *   3. UN bouton, le prochain geste de la personne qui regarde — ou, s'il n'est pas le sien, une
 *      phrase qui dit ce qu'on attend et de qui (`prochainPas`, une règle pure et testée) ;
 *   4. le reste dans un menu « ⋯ » et un volet « Pièces et demandes » replié : rien ne disparaît,
 *      rien ne crie.
 *
 * Les quatre principes d'avant tiennent toujours : chaque poste se valide À PART ; le dépassement
 * se voit ; le matériel promotionnel n'est pas recopié ici ; ce qui est annoncé doit être chiffré.
 * Et un sponsoring indirect se RÉPARTIT par nature : ses postes s'affichent ensemble, sous leur
 * total.
 */
/** Où vit chaque opération porteuse de postes — une seule table, jamais recopiée. */
const PARENT_PATH: Record<AdProParent, string> = {
  SPONSORING: "/sponsoring",
  CONGRESS_NATIONAL: "/congress-national",
  CONGRESS_INTERNATIONAL: "/congress-international",
  EVENT: "/events",
};

export function AdProItemsPanel({
  parent, parentId, items, amountGranted, decided, tardif = decided, fige = false, canEdit: canEditBrut, canAllocate: canAllocateBrut, promoOptions, plan,
  budgetOptions = [], canIssueOrder = false, canViserBC = false, materiel,
}: Props) {
  // CLÔTURÉE : on ne décrit, ne chiffre, ne décide et ne réimpute plus — l'action le refuserait
  // (`refusSiClos`), et un bouton qu'une action refuse n'est pas un bouton. Les gestes
  // d'EXÉCUTION (pièces, BC, émission) gardent leurs droits d'origine, passés à part.
  const canEdit = canEditBrut && !fige;
  // LE RAFRAÎCHISSEMENT SUIVI (§118.172) : entre la fin d'une action et l'arrivée des nouvelles
  // données, la carte montrerait l'état d'AVANT avec ses gestes déjà cliquables — « Modifier le
  // poste » ou un voyageur s'ouvriraient sur un instantané périmé, et l'enregistrer réécrirait
  // l'ancien état par-dessus le nouveau. Les gestes restent fermés jusqu'à ce que l'écran soit à jour.
  const { enCours: rafraichissement, rafraichir } = useRafraichir();
  const [busyAction, setBusy] = React.useState<string | null>(null);
  const busy = busyAction ?? (rafraichissement ? RAFRAICHISSEMENT : null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const lock = React.useRef(false);

  // Le chemin de l'opération porteuse : la demande de pièce y renvoie, pour que celui qui a
  // demandé retrouve son dossier depuis le fil.
  const parentLink = `${PARENT_PATH[parent]}/${parentId}`;

  const b = breakdown(items, amountGranted);
  const gaps = plannedGaps(items, plan ?? {});
  const groupes = grouperParRepartition(items);

  const run: Run = async (key, fn, okText) => {
    if (lock.current || rafraichissement) return;
    lock.current = true;
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      // La phrase de l'ACTION l'emporte quand elle en rend une : elle seule sait, par exemple,
      // qu'un BC sous le seuil est parti aux Finances sans passer par le centre (§118.149).
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? okText) : (r.error ?? "Échec.") });
      if (r.ok) rafraichir();
    } finally {
      setBusy(null);
      lock.current = false;
    }
  };

  const carte = (it: ItemRow) => (
    <PosteCarte
      key={it.id}
      item={it}
      regard={{
        canEdit: canEditBrut, canAllocate: canAllocateBrut, canViserBC,
        // L'ÉMISSION : les Finances, ou la Direction (`emitItemExpenseOrder` accepte les deux).
        canEmettre: canIssueOrder || canAllocateBrut,
        fige, operationDecidee: decided,
      }}
      budgetOptions={budgetOptions}
      promoOptions={promoOptions}
      materiel={materiel}
      busy={busy}
      run={run}
      parentLink={parentLink}
    />
  );

  return (
    <div className="space-y-4">
      {/* ── La ventilation, avant la liste : c'est la question qu'on se pose en arrivant. ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label="Enveloppe accordée"
          value={b.envelopeDzd != null ? formatCurrency(b.envelopeDzd) : "—"}
          // DÉCIDÉE SANS ENVELOPPE : une tenue pré-validée (§118.151) n'a pas « rien de tranché »,
          // elle a un montant qui se fixera à la validation finale — le dire évite de lire un oubli.
          hint={b.envelopeDzd == null ? (decided && !tardif ? "fixée à la validation finale" : "Direction non tranchée") : undefined}
        />
        <Figure label="Estimé par le demandeur" value={formatCurrency(b.estimatedDzd)} hint={`${b.itemCount} poste(s)`} />
        <Figure
          label="Affecté aux postes"
          value={formatCurrency(b.allocatedDzd)}
          hint={b.additionalDzd > 0 ? `+ ${formatCurrency(b.additionalDzd)} en budget supplémentaire` : undefined}
        />
        {b.overrunDzd > 0 ? (
          <Figure label="Dépassement" value={formatCurrency(b.overrunDzd)} tone="danger" hint="au-delà de l'enveloppe" />
        ) : (
          <Figure
            label="Reste à affecter"
            value={b.envelopeDzd != null ? formatCurrency(b.unallocatedDzd) : "—"}
            tone={b.balanced ? "success" : undefined}
            hint={b.balanced ? "ventilation complète" : undefined}
          />
        )}
      </div>

      {fige && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>
            Demande <strong className="text-foreground">clôturée</strong> : les postes, leurs montants et leurs budgets sont arrêtés.
            Les bons de commande et factures des postes accordés suivent leur cours ; pour corriger un poste, rouvrez la demande.
          </span>
        </p>
      )}

      {/* Une RALLONGE assumée n'est pas un dépassement subi : deux lignes distinctes, deux décisions. */}
      {(b.additionalDzd > 0 || b.pendingDzd > 0) && (
        <p className="rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
          {b.additionalDzd > 0 && (
            <>Postes demandés <strong className="text-foreground">en plus</strong> de l&apos;enveloppe : <strong className="tabular-nums text-foreground">{formatCurrency(b.additionalDzd)}</strong>. </>
          )}
          {b.pendingDzd > 0 && (
            <>En attente de décision de la Direction : <strong className="tabular-nums text-foreground">{formatCurrency(b.pendingDzd)}</strong>.</>
          )}
        </p>
      )}

      {b.overrunDzd > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            La ventilation dépasse l&apos;enveloppe accordée de <strong>{formatCurrency(b.overrunDzd)}</strong>.
            {b.hasLateAdditions
              ? " Des postes ont été ajoutés après la décision — c'est autorisé, mais la Direction doit le savoir avant le règlement."
              : " Réduisez un poste ou faites relever l'enveloppe."}
          </span>
        </p>
      )}

      {/* Annoncé mais pas chiffré : le budget est incomplet, et personne ne le voyait. */}
      {gaps.any && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {gaps.boothUnbudgeted && <>Un <strong>stand</strong> est annoncé sur cet événement mais aucun poste ne le chiffre. </>}
            {gaps.symposiumUnbudgeted && <>Un <strong>symposium</strong> est annoncé mais aucun poste ne le chiffre. </>}
            S&apos;il est offert par l&apos;organisateur, ignorez ce rappel — sinon le budget est incomplet.
          </span>
        </p>
      )}

      {/* ── Les postes ── */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucun poste. Détaillez ce que couvre cette opération — appui, stand, imprimerie, billetterie, prestation —
          pour savoir de quoi est fait le montant et à qui va l&apos;argent.
        </p>
      ) : (
        <ul className="space-y-3">
          {groupes.map((g) => g.repartitionId ? (
            <li key={g.cle} className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
              <p className="flex flex-wrap items-center gap-2 px-1 text-sm">
                <Split className="h-4 w-4 text-primary" />
                <strong>Sponsoring indirect</strong>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(g.items.reduce((s, it) => s + (it.amountGranted ?? it.amountEstimated ?? 0), 0))}
                </span>
                <span className="text-muted-foreground">· {g.items.length} nature{g.items.length > 1 ? "s" : ""}</span>
              </p>
              <ul className="space-y-2">{g.items.map(carte)}</ul>
            </li>
          ) : carte(g.items[0]!))}
        </ul>
      )}

      {msg && (
        <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {msg.text}
        </p>
      )}

      {/* ── Ajouter ── */}
      {canEdit && (
        adding ? (
          <AddItemForm
            parent={parent}
            parentId={parentId}
            decided={tardif}
            busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={(fd) => void run("add", async () => {
              const r = await addAdProItem(undefined, fd);
              if (r.ok) setAdding(false);
              return r;
            }, "Poste ajouté.")}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter un poste
          </Button>
        )
      )}
    </div>
  );
}

/** L'état « l'écran se met à jour » — tous les gestes de toutes les cartes attendent. */
const RAFRAICHISSEMENT = "rafraichissement";

// ─────────────────────────────── La carte d'un poste ───────────────────────────────

type Panneau = CleGeste | "MODIFIER" | "HISTORIQUE";

/** Ce qu'un geste OUVRE (un petit formulaire) — les autres partent au clic. */
const GESTES_A_FORMULAIRE: readonly CleGeste[] = ["REPARTIR", "CHIFFRER", "DECIDER", "MONTANT", "BUDGET", "DEMANDER_BC", "VISER_BC"];

function PosteCarte({ item, regard, budgetOptions, promoOptions, materiel, busy, run, parentLink }: {
  item: ItemRow;
  regard: RegardPoste;
  budgetOptions: { id: string; label: string }[];
  promoOptions: { id: string; reference: string; title: string; status: string }[];
  materiel: ContexteMaterielStock;
  busy: string | null;
  run: Run;
  parentLink: string;
}) {
  const [panneau, setPanneau] = React.useState<Panneau | null>(null);
  const [menu, setMenu] = React.useState(false);
  const [pieces, setPieces] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Le menu se ferme au clic ailleurs : un menu qui reste ouvert recouvre la carte d'en dessous.
  React.useEffect(() => {
    if (!menu) return;
    const fermer = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [menu]);

  const stock = estPosteStock(item);
  const editer = regard.canEdit && !regard.fige;
  const arbitrer = regard.canAllocate && !regard.fige;
  const faits = faitsDuPoste(item);
  const pas = prochainPas(faits, regard);
  const etapes = etapesDuPoste(faits);

  const fdOf = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("id", item.id);
    for (const [k, v] of Object.entries(extra)) if (v) fd.set(k, v);
    return fd;
  };
  const fermer = () => setPanneau(null);

  /** Le geste principal — un formulaire qui s'ouvre, ou une action qui part. */
  const agir = (cle: CleGeste) => {
    if (GESTES_A_FORMULAIRE.includes(cle)) {
      setPanneau(panneau === cle ? null : (cle === "CHIFFRER" ? "MODIFIER" : cle));
      return;
    }
    if (cle === "SOUMETTRE") void run(`submit:${item.id}`, () => submitAdProItem(undefined, fdOf()), "Poste soumis à la Direction.");
    if (cle === "EMETTRE_BC") void run(`emit:${item.id}`, () => emitItemExpenseOrder(undefined, fdOf()), "Bon de commande émis (ordre de dépense créé).");
    if (cle === "EMETTRE_DIRECT") void run(`emit:${item.id}`, () => emitItemExpenseOrder(undefined, fdOf()), "Ordre de dépense émis.");
  };

  // ── LE MENU « ⋯ » — ce qui ne crie pas, mais reste là. Chaque entrée n'apparaît que si
  //    l'action l'acceptera : un geste offert puis refusé est une fausse promesse (§118.83).
  const emitSansBC = canEmitOrder(item, regard.operationDecidee);
  const removable = canRemoveItem(
    { expenseOrderId: item.expenseOrderId, expenseOrderStatus: item.expenseOrder?.status ?? null },
    { canAllocate: arbitrer },
  );
  const entrees: { cle: string; libelle: string; icone: React.ReactNode; faire: () => void; danger?: boolean }[] = [];
  if (editer) entrees.push({ cle: "modifier", libelle: "Modifier le poste", icone: <Pencil className="h-3.5 w-3.5" />, faire: () => setPanneau("MODIFIER") });
  if (arbitrer && !stock && !item.expenseOrderId && pas.geste?.cle !== "MONTANT") {
    entrees.push({ cle: "montant", libelle: "Affecter un montant", icone: <Wallet className="h-3.5 w-3.5" />, faire: () => setPanneau("MONTANT") });
  }
  if (arbitrer && !stock && item.status === "APPROVED" && item.orderStage !== "ISSUED" && item.budgetCategoryId && pas.geste?.cle !== "BUDGET") {
    entrees.push({ cle: "budget", libelle: "Changer le budget", icone: <Wallet className="h-3.5 w-3.5" />, faire: () => setPanneau("BUDGET") });
  }
  // ÉMETTRE SANS BON DE COMMANDE : une aide versée sur convention, un poste d'avant le circuit —
  // `emitItemExpenseOrder` l'accepte de la Direction sur un poste accordé sans BC. Ce n'est pas le
  // chemin ordinaire (le BC l'est) : il vit dans le menu, pas en bouton principal.
  if (regard.canAllocate && !stock && emitSansBC.ok && item.orderStage === "NONE" && !VERSEMENT_SANS_BC.includes(item.kind)) {
    entrees.push({
      cle: "emettre", libelle: "Émettre l'ordre de dépense sans BC", icone: <Receipt className="h-3.5 w-3.5" />,
      faire: () => {
        if (!window.confirm("Émettre l'ordre de dépense de ce poste SANS bon de commande ? Le paiement passera par le centre de paiement.")) return;
        void run(`emit:${item.id}`, () => emitItemExpenseOrder(undefined, fdOf()), "Ordre de dépense émis.");
      },
    });
  }
  if (item.decisions.length > 0) {
    entrees.push({ cle: "historique", libelle: `Historique (${item.decisions.length})`, icone: <History className="h-3.5 w-3.5" />, faire: () => setPanneau("HISTORIQUE") });
  }
  // RETIRER — libre tant qu'aucun ordre n'est parti aux Finances ; réservé à la Direction ensuite,
  // avec annulation de l'ordre (et jamais si déjà réglé). Un poste dont le matériel est dehors, ou
  // a été remis, ne se retire pas : l'action le refuserait (`faitDeStock`).
  if (editer && removable.ok && !item.lignesStock.some((l) => faitDeStock(l) != null)) {
    entrees.push({
      cle: "retirer", libelle: "Retirer le poste", icone: <Trash2 className="h-3.5 w-3.5" />, danger: true,
      faire: () => {
        const question = item.expenseOrderId
          ? `Retirer ce poste annulera l'ordre de dépense ${item.expenseOrder?.reference ?? ""} transmis aux Finances. Continuer ?`
          : `Retirer le poste « ${item.label} » ?`;
        if (!window.confirm(question)) return;
        void run(`del:${item.id}`, () => deleteAdProItem(undefined, fdOf()), "Poste retiré.");
      },
    });
  }

  const enCours = busy !== null && (busy === RAFRAICHISSEMENT || busy.endsWith(`:${item.id}`));
  const nbPieces = item.documentCount + item.demandes.length;

  return (
    <li className="space-y-2.5 rounded-xl border border-border bg-card p-3">
      {/* 1. CE QU'IL EST */}
      <div className="flex flex-wrap items-start gap-2">
        {/* La nature en pastille — sauf quand le libellé la REDIT mot pour mot (une nature répartie
            sans précision) : deux fois le même mot sur une ligne, c'est du bruit qu'on apprend à sauter. */}
        {item.label.trim().toLocaleLowerCase("fr") !== ITEM_KIND_LABELS[item.kind].toLocaleLowerCase("fr") && (
          <Badge tone={item.kind === "PROMO_MATERIAL" ? "purple" : "neutral"} dot={false}>{ITEM_KIND_LABELS[item.kind]}</Badge>
        )}
        <span className="min-w-0 flex-1 font-medium">{item.label}</span>
        <Badge tone={ITEM_STATUS_LABELS[item.status].tone} dot={false}>{ITEM_STATUS_LABELS[item.status].label}</Badge>
        {item.budgetKind === "ADDITIONAL" && <Badge tone="warning" dot={false}>budget supplémentaire</Badge>}
        {item.addedAfterDecision && <Badge tone="warning" dot={false}>ajouté après décision</Badge>}
        {entrees.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} disabled={busy === RAFRAICHISSEMENT}
              aria-label={`Autres actions — ${item.label}`}
              className="rounded-lg border border-border p-1 text-muted-foreground hover:bg-secondary"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg">
                {entrees.map((e) => (
                  <button
                    key={e.cle} type="button" role="menuitem"
                    onClick={() => { setMenu(false); e.faire(); }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary ${e.danger ? "text-destructive" : ""}`}
                  >
                    {e.icone} {e.libelle}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. CE QU'IL COÛTE — une ligne. */}
      {!stock && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Estimé : <span className="tabular-nums text-foreground">{item.amountEstimated != null ? formatCurrency(item.amountEstimated) : "—"}</span></span>
          <span>Accordé : <span className="tabular-nums font-medium text-foreground">{item.amountGranted != null ? formatCurrency(item.amountGranted) : "—"}</span></span>
          {item.supplier && <span>Payé à <strong className="text-foreground">{item.supplier}</strong></span>}
          {item.budgetCategoryLabel && <span>Budget : <strong className="text-foreground">{item.budgetCategoryLabel}</strong></span>}
          {item.expenseOrder && <span className="inline-flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> {item.expenseOrder.reference} · {item.expenseOrder.status}</span>}
        </p>
      )}
      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}

      {/* 3. OÙ IL EN EST — la frise. */}
      {etapes.length > 0 && <Frise etapes={etapes} />}

      {/* LE MATÉRIEL DU STOCK a son propre bloc : lister, puis confirmer après l'événement. */}
      {stock && (
        <BlocMaterielStock
          itemId={item.id}
          lignes={item.lignesStock}
          magasin={materiel.magasin}
          editable={editer && POSTE_STOCK_EDITABLE.includes(item.status)}
          peutConfirmer={materiel.peutConfirmer}
          busy={busy}
          run={run}
        />
      )}

      {/* Le matériel promotionnel : on RENVOIE vers son circuit, on ne le recopie pas. */}
      {item.kind === "PROMO_MATERIAL" && (
        <div className="rounded-lg border border-border px-2.5 py-2 text-xs">
          {item.promoMaterial ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/promo-material/${item.promoMaterialId}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {item.promoMaterial.reference} <ExternalLink className="h-3 w-3" />
              </Link>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.promoMaterial.title}</span>
              <Badge tone="info" dot={false}>{item.promoMaterial.status}</Badge>
            </div>
          ) : editer ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  void run(`link:${item.id}`, () => linkPromoMaterial(undefined, fdOf({ promoMaterialId: e.target.value })), "Matériel rattaché.");
                }}
                aria-label="Rattacher un matériel promotionnel existant"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
              >
                <option value="">Rattacher un matériel promotionnel existant…</option>
                {promoOptions.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.title}</option>)}
              </select>
              <Link href="/promo-material" className="whitespace-nowrap text-primary hover:underline">ou en créer un</Link>
            </div>
          ) : (
            <span className="text-muted-foreground">Aucun matériel rattaché.</span>
          )}
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            Le matériel suit <strong>son propre circuit</strong> (visa publicitaire, conformité, agence, BAT) : cette opération en montre l&apos;avancement.
          </p>
        </div>
      )}

      {/* La parole de la Direction quand elle renvoie le poste. */}
      {item.decisionNote && (item.status === "REVISION" || item.status === "REJECTED") && (
        <p className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
          <strong>Direction :</strong> {item.decisionNote}
        </p>
      )}

      {/* 4. LE PROCHAIN GESTE — un bouton, ou une phrase qui dit qui on attend. */}
      {(pas.geste || pas.attente) && (
        <div className="flex flex-wrap items-center gap-2">
          {pas.geste ? (
            <Button size="sm" onClick={() => agir(pas.geste!.cle)} disabled={enCours}>
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconeGeste cle={pas.geste.cle} />}
              {pas.geste.libelle}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{pas.attente}</p>
          )}
        </div>
      )}

      {/* Les petits formulaires qu'un geste ouvre — un seul à la fois. */}
      {panneau === "MODIFIER" && editer && (
        <EditItemForm
          item={item}
          busy={busy === `edit:${item.id}`}
          onCancel={fermer}
          onSave={(fd) => {
            fd.set("id", item.id);
            void run(`edit:${item.id}`, () => updateAdProItem(undefined, fd), "Poste modifié.").then(fermer);
          }}
        />
      )}
      {panneau === "REPARTIR" && editer && (
        <FormulaireRepartition
          origine={item.amountEstimated}
          busy={busy === `rep:${item.id}`}
          onCancel={fermer}
          onSubmit={(fd) => {
            fd.set("id", item.id);
            void run(`rep:${item.id}`, () => repartirPoste(undefined, fd), "Poste réparti.").then(fermer);
          }}
        />
      )}
      {panneau === "DECIDER" && arbitrer && item.status === "PENDING" && (
        <BoiteDecision item={item} busy={busy} run={run} fdOf={fdOf} onCancel={fermer} />
      )}
      {panneau === "MONTANT" && arbitrer && !item.expenseOrderId && (
        <AllocateField itemId={item.id} current={item.amountGranted} busy={busy === `alloc:${item.id}`} onSave={(v) => {
          void run(`alloc:${item.id}`, () => updateAdProItem(undefined, fdOf({ amountGranted: v })), "Montant affecté.").then(fermer);
        }} />
      )}
      {panneau === "BUDGET" && arbitrer && item.status === "APPROVED" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={item.budgetCategoryId ?? ""}
            onChange={(e) => void run(`budget:${item.id}`, () => setAdProItemBudget(undefined, fdOf({ budgetCategoryId: e.target.value })), "Budget choisi.").then(fermer)}
            aria-label="Budget imputé à ce poste"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
          >
            <option value="">Choisir le budget (enveloppe › catégorie)…</option>
            {budgetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {busy === `budget:${item.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      )}
      {panneau === "DEMANDER_BC" && regard.canEdit && item.status === "APPROVED" && (
        <DemandeBC busy={busy === `po:${item.id}`} onCancel={fermer} onSend={(message) =>
          void run(`po:${item.id}`, () => requestAdProItemOrder(undefined, fdOf({ note: message })), "Émission du bon de commande demandée.").then(fermer)
        } />
      )}
      {panneau === "VISER_BC" && regard.canViserBC && item.orderStage === "REQUESTED" && (
        <VisaBC busy={busy === `poa:${item.id}`} onCancel={fermer} onDecide={(decision, note) =>
          void run(`poa:${item.id}`, () => approveAdProItemOrder(undefined, fdOf({ decision, note })),
            decision === "APPROVE" ? "Bon de commande validé — transmis aux Finances." : "Bon de commande refusé.").then(fermer)
        } />
      )}
      {panneau === "HISTORIQUE" && item.decisions.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-secondary/40 p-2 text-[0.6875rem]">
          {item.decisions.map((d, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="font-medium text-foreground">{ITEM_STATUS_LABELS[d.decision].label}</span>
              {d.amount != null && <span className="tabular-nums">{formatCurrency(d.amount)}</span>}
              <span>{formatDate(d.at)}</span>
              {d.by && <span>· {d.by}</span>}
              {d.note && <span className="w-full italic">« {d.note} »</span>}
            </li>
          ))}
          <li><button type="button" onClick={fermer} className="text-muted-foreground hover:text-foreground">Masquer</button></li>
        </ul>
      )}

      {/* LES DEUX PAROLES DU BON DE COMMANDE, côte à côte. Elles vivaient dans le même champ, donc
          chaque visa effaçait le message du demandeur — et rien ne les affichait, ce qui rendait la
          perte indétectable (§118.45). */}
      {item.status === "APPROVED" && item.orderNote && (
        <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs text-foreground">
          <strong>Demande d&apos;émission :</strong> {item.orderNote}
        </p>
      )}
      {item.status === "APPROVED" && item.orderDecisionNote && (
        <p className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
          {item.orderSansCentre
            ? <><strong>{LIBELLE_BC_SOUS_LE_SEUIL} :</strong> {item.orderDecisionNote}</>
            : <><strong>Centre de validation ({ITEM_ORDER_STAGE_LABELS[item.orderStage].label}) :</strong> {item.orderDecisionNote}</>}
        </p>
      )}

      {/* LA BILLETTERIE : qui voyage, quand — et la réservation à l'assistante de direction. */}
      {porteDesVoyageurs(item.kind) && (
        <BlocVoyageurs
          itemId={item.id}
          voyageurs={item.voyageurs}
          nomsSuggeres={item.nomsSuggeres}
          reservation={item.reservation}
          // Les voyageurs sont une précision d'EXÉCUTION : ils se tiennent à jour même sur une
          // demande clôturée, comme le bon de commande.
          peutEditer={regard.canEdit}
          peutReserver={item.status !== "REJECTED"}
          busy={busy}
          run={run}
        />
      )}

      {/* 5. PIÈCES ET DEMANDES — repliées : on les ouvre quand on en a besoin. */}
      <div className="border-t border-border/70 pt-2">
        <button
          type="button" onClick={() => setPieces((v) => !v)} aria-expanded={pieces}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {pieces ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Pièces et demandes{nbPieces > 0 ? ` (${nbPieces})` : ""}
        </button>
        {pieces && (
          <PiecesEtDemandes item={item} peutDemander={regard.canEdit} busy={busy} run={run} parentLink={parentLink} fdOf={fdOf} />
        )}
      </div>
    </li>
  );
}

function IconeGeste({ cle }: { cle: CleGeste }) {
  switch (cle) {
    case "REPARTIR": return <Split className="h-4 w-4" />;
    case "CHIFFRER": return <Pencil className="h-4 w-4" />;
    case "DECIDER": return <ThumbsUp className="h-4 w-4" />;
    case "MONTANT": case "BUDGET": return <Wallet className="h-4 w-4" />;
    case "VISER_BC": return <ThumbsUp className="h-4 w-4" />;
    case "EMETTRE_BC": case "EMETTRE_DIRECT": return <Receipt className="h-4 w-4" />;
    default: return <Send className="h-4 w-4" />;
  }
}

/** La frise : ce qui est fait, ce qui se passe, ce qui vient — et un refus, là où il a eu lieu. */
function Frise({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[0.6875rem]" aria-label="Étapes du poste">
      {etapes.map((e, i) => {
        const ton = e.etat === "FAIT" ? "text-success" : e.etat === "EN_COURS" ? "font-semibold text-primary" : e.etat === "REFUSE" ? "text-destructive" : "text-muted-foreground";
        const icone = e.etat === "FAIT" ? <CheckCircle2 className="h-3 w-3" />
          : e.etat === "REFUSE" ? <X className="h-3 w-3" />
          : <Circle className={`h-3 w-3 ${e.etat === "EN_COURS" ? "fill-current" : ""}`} />;
        const etat = e.etat === "FAIT" ? "fait" : e.etat === "EN_COURS" ? "en cours" : e.etat === "REFUSE" ? "refusé" : "à venir";
        return (
          <li key={e.cle} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-border">—</span>}
            <span className={`inline-flex items-center gap-1 ${ton}`} aria-label={`${e.libelle} : ${etat}`}>{icone} {e.libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** La Direction tranche : accorder / revoir / refuser — autant de fois qu'il le faut. */
function BoiteDecision({ item, busy, run, fdOf, onCancel }: {
  item: ItemRow; busy: string | null; run: Run; fdOf: (extra?: Record<string, string>) => FormData; onCancel: () => void;
}) {
  const [note, setNote] = React.useState("");
  const stock = estPosteStock(item);
  const occupe = busy === `dec:${item.id}`;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Motif / consigne (obligatoire pour un refus ou une révision)"
        aria-label="Motif de la décision sur le poste"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm" disabled={occupe}
          title={stock ? "Accorder réserve le matériel au magasin : il en sort, et personne ne peut plus le doter ailleurs." : undefined}
          onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "APPROVED", note })), stock ? "Poste accordé — le matériel est réservé au magasin." : "Poste accordé.")}
        >
          <ThumbsUp className="h-4 w-4" /> {stock ? "Accorder et réserver" : "Accorder"}
        </Button>
        <Button
          size="sm" variant="outline" disabled={occupe || !note.trim()}
          title={!note.trim() ? "Indiquez ce qu'il faut revoir" : undefined}
          onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "REVISION", note })), stock ? "Liste à revoir — le demandeur est prévenu." : "Budget à revoir — le demandeur est prévenu.")}
        >
          <RotateCcw className="h-4 w-4" /> {stock ? "Revoir la liste" : "Revoir le budget"}
        </Button>
        <Button
          size="sm" variant="outline" className="text-destructive" disabled={occupe || !note.trim()}
          title={!note.trim() ? "Indiquez le motif du refus" : undefined}
          onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "REJECTED", note })), "Poste refusé.")}
        >
          <ThumbsDown className="h-4 w-4" /> Refuser
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

/**
 * LE MESSAGE QUI PART AVEC LA DEMANDE D'ÉMISSION — « on écrit un message avec les différents
 * contenus, les références ». C'est ce que l'assistante de direction lit pour ÉTABLIR le bon de
 * commande : sans lui, elle doit rappeler le demandeur.
 */
function DemandeBC({ busy, onSend, onCancel }: { busy: boolean; onSend: (message: string) => void; onCancel: () => void }) {
  const [message, setMessage] = React.useState("");
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background p-2 text-xs">
      <textarea
        value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
        placeholder="Contenu du bon de commande, références, coordonnées du fournisseur — ce que l'assistante doit y porter."
        aria-label="Message de la demande d'émission du bon de commande"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onSend(message)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer la demande
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

/** Le centre de validation Ad & Pro vise le bon de commande — un refus porte son motif. */
function VisaBC({ busy, onDecide, onCancel }: { busy: boolean; onDecide: (decision: "APPROVE" | "REFUSE", note: string) => void; onCancel: () => void }) {
  const [note, setNote] = React.useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
      <Button size="sm" disabled={busy} onClick={() => onDecide("APPROVE", note)}>
        <ThumbsUp className="h-4 w-4" /> Valider le BC
      </Button>
      <Button
        size="sm" variant="outline" className="text-destructive" disabled={busy || !note.trim()}
        title={note.trim() ? undefined : "Indiquez le motif du refus dans le champ ci-dessous."}
        onClick={() => onDecide("REFUSE", note)}
      >
        <ThumbsDown className="h-4 w-4" /> Refuser
      </Button>
      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Motif (obligatoire pour refuser)"
        aria-label="Motif de la décision sur le bon de commande"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
      />
      <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
    </div>
  );
}

/**
 * PIÈCES ET DEMANDES D'UN POSTE — repliées par défaut.
 *
 * Le devis et la facture sont la MÊME démarche (une demande au bureau du secrétariat, avec son
 * message) : deux boutons écrits à la main auraient divergé sur ce message, qui est précisément ce
 * que le circuit doit transporter. Les pièces jointes vivent SUR le poste et pas sur l'opération :
 * la facture du traiteur et celle de l'agence sont deux pièces de deux postes.
 */
function PiecesEtDemandes({ item, peutDemander, busy, run, parentLink, fdOf }: {
  item: ItemRow; peutDemander: boolean; busy: string | null; run: Run; parentLink: string; fdOf: (extra?: Record<string, string>) => FormData;
}) {
  const [redige, setRedige] = React.useState<NaturePieceSecretariat | null>(null);
  const [message, setMessage] = React.useState("");
  const naturesOuvertes = item.demandes.filter((d) => d.status !== "DONE" && d.status !== "CANCELLED").map((d) => d.nature);
  return (
    <div className="mt-2 space-y-2 text-xs">
      {item.demandes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {item.demandes.map((d) => (
            <Link
              key={d.id} href={`/demandes/${d.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-0.5 font-medium text-primary hover:bg-secondary"
            >
              {PIECE_SECRETARIAT[d.nature].libelle} {d.reference} <ExternalLink className="h-3 w-3" />
            </Link>
          ))}
          <span className="text-muted-foreground">— joignez-y les pièces reçues.</span>
        </div>
      )}
      {/* Le matériel du stock ne s'achète pas : ni devis ni facture (§118.167). */}
      {peutDemander && !estPosteStock(item) && (
        <div className="flex flex-wrap items-center gap-2">
          {NATURES_PIECE_SECRETARIAT.map((nature) => {
            const garde = peutDemanderPiece(nature, { ouvertes: naturesOuvertes, bcDemande: item.orderStage !== "NONE" });
            // Une demande que l'enchaînement refuse n'est pas offerte : la raison se lit sur
            // l'étape (la facture vient après le BC), pas sous un bouton grisé.
            if (!garde.ok) return null;
            return (
              <button
                key={nature} type="button"
                onClick={() => { setRedige(redige === nature ? null : nature); setMessage(""); }}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 font-medium hover:bg-secondary"
              >
                <FileText className="h-3.5 w-3.5" /> {PIECE_SECRETARIAT[nature].bouton}
              </button>
            );
          })}
        </div>
      )}
      {/* Le message part AVEC la demande : le demander après coup obligerait l'assistante à
          revenir vers le demandeur pour savoir ce qu'elle doit établir. */}
      {peutDemander && redige && (
        <div className="space-y-1.5 rounded-lg border border-border bg-background p-2">
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder={PIECE_SECRETARIAT[redige].aide}
            aria-label={`Message de la demande de ${PIECE_SECRETARIAT[redige].libelle.toLowerCase()}`}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" disabled={busy === `piece:${item.id}`}
              onClick={() => void run(
                `piece:${item.id}`,
                () => demanderPieceSecretariat(undefined, fdOf({ nature: redige, note: message })),
                `Demande de ${PIECE_SECRETARIAT[redige].libelle.toLowerCase()} ouverte au secrétariat.`,
              ).then(() => { setRedige(null); setMessage(""); })}
            >
              {busy === `piece:${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer au secrétariat
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setRedige(null); setMessage(""); }}>Annuler</Button>
          </div>
        </div>
      )}
      {/* LES PIÈCES DU POSTE — « on peut mettre une PJ ou plusieurs à chaque poste ». */}
      <div className="rounded-lg border border-border bg-background p-2">
        <p className="mb-1 text-[0.6875rem] text-muted-foreground">Pièces du poste{item.documentCount > 0 ? ` (${item.documentCount})` : ""}</p>
        <DocumentUpload entityType="AD_PRO_ITEM" entityId={item.id} categories={[...AD_PRO_DOC_CATEGORIES]} compact />
      </div>
      {/* Réclamer à quelqu'un une pièce ou une validation : le devis passe par le secrétariat ;
          tout le reste — une attestation, un contrat signé — est chez quelqu'un d'autre. */}
      {peutDemander && (
        <ItemAskPanel
          entityType="AD_PRO_ITEM"
          entityId={item.id}
          link={parentLink}
          subject={`${ITEM_KIND_LABELS[item.kind]} : ${item.label}`}
        />
      )}
    </div>
  );
}

/** Saisie du montant affecté, validée à la sortie du champ — pas de bouton par ligne. */
function AllocateField({ itemId, current, busy, onSave }: { itemId: string; current: number | null; busy: boolean; onSave: (v: string) => void }) {
  const [value, setValue] = React.useState(current != null ? String(current) : "");
  React.useEffect(() => { setValue(current != null ? String(current) : ""); }, [current]);

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      Montant accordé :
      <input
        type="number" min="0" step="1000" value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value !== (current != null ? String(current) : "")) onSave(value); }}
        aria-label={`Montant affecté au poste ${itemId}`}
        className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-primary/60"
      />
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      <span className="text-xs">DZD</span>
    </label>
  );
}

// ─────────────────────────────── Répartir un sponsoring indirect ───────────────────────────────

interface LigneSaisie { kind: string; montant: string; precision: string; payeA: string }
const ligneVide = (): LigneSaisie => ({ kind: "", montant: "", precision: "", payeA: "" });

/**
 * LES NATURES D'UN SPONSORING INDIRECT — une ligne par nature, le total sous les yeux (§118.175).
 * Le formulaire envoie un JSON (`repartition`) : des clés `ligne-3-montant` rendraient l'action
 * illisible à la dérivation des contrats (§118.73).
 */
function EditeurRepartition({ origine }: { origine?: number | null }) {
  const [lignes, setLignes] = React.useState<LigneSaisie[]>([ligneVide(), ligneVide()]);
  const total = lignes.reduce((s, l) => {
    const n = Number(l.montant.replace(/\s/g, "").replace(",", "."));
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const maj = (i: number, champ: keyof LigneSaisie, v: string) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: v } : l)));
  const champ = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60";
  return (
    <div className="space-y-2">
      <input type="hidden" name="repartition" value={JSON.stringify(lignes)} />
      <p className="text-xs text-muted-foreground">
        Donnez la ou les natures et leur montant — par exemple <strong>imprimerie 400 000</strong> et <strong>hôtellerie 600 000</strong>.
        Chaque nature devient un poste, qui se valide, se commande et se paie à part.
      </p>
      {lignes.map((l, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto]">
          <select value={l.kind} onChange={(e) => maj(i, "kind", e.target.value)} aria-label={`Prise en charge ${i + 1}`} className={champ}>
            <option value="">— Prise en charge —</option>
            {NATURES_REPARTITION.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </select>
          <input value={l.montant} onChange={(e) => maj(i, "montant", e.target.value)} inputMode="decimal" placeholder="Montant DZD" aria-label={`Montant ${i + 1}`} className={`${champ} tabular-nums`} />
          <input value={l.precision} onChange={(e) => maj(i, "precision", e.target.value)} placeholder="Précision (facultatif)" aria-label={`Précision ${i + 1}`} className={champ} />
          <input value={l.payeA} onChange={(e) => maj(i, "payeA", e.target.value)} placeholder="Fournisseur (facultatif)" aria-label={`Fournisseur ${i + 1}`} className={champ} />
          <button
            type="button" disabled={lignes.length <= 1}
            onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
            aria-label={`Retirer la ligne ${i + 1}`}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={() => setLignes((ls) => [...ls, ligneVide()])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter une nature
        </button>
        <span className="ml-auto text-muted-foreground">
          Total : <strong className="tabular-nums text-foreground">{formatCurrency(total)}</strong>
          {origine != null && Math.round(origine) !== Math.round(total) && total > 0 && (
            <> — le poste portait <span className="tabular-nums">{formatCurrency(origine)}</span></>
          )}
        </span>
      </div>
    </div>
  );
}

function FormulaireRepartition({ origine, busy, onSubmit, onCancel }: {
  origine: number | null; busy: boolean; onSubmit: (fd: FormData) => void; onCancel: () => void;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <EditeurRepartition origine={origine} />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />} Répartir
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

// ─────────────────────────────── Ajouter / modifier ───────────────────────────────

function AddItemForm({ parent, parentId, decided, busy, onCancel, onSubmit }: {
  parent: AdProParent; parentId: string; decided: boolean; busy: boolean; onCancel: () => void; onSubmit: (fd: FormData) => void;
}) {
  // « MATÉRIEL DU STOCK » n'a ni fournisseur, ni montant, ni nature de budget (§118.167) : ces
  // champs disparaissent quand on la choisit — les envoyer quand même ferait refuser l'ajout.
  // « SPONSORING INDIRECT » se donne en NATURES (§118.175) : le montant unique cède la place à la
  // répartition, qui crée un poste par nature.
  const [nature, setNature] = React.useState<AdProItemKind>("STAND");
  const stock = nature === NATURE_MATERIEL_STOCK;
  const indirect = nature === "INDIRECT_SUPPORT";
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-2 rounded-xl border border-border p-3"
    >
      <input type="hidden" name="parent" value={parent} />
      <input type="hidden" name="parentId" value={parentId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Nature
          <select
            name="kind" value={nature} onChange={(e) => setNature(e.target.value as AdProItemKind)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60"
          >
            {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="text-xs">
          Libellé
          <input
            name="label" required
            placeholder={stock ? "Matériel du stand — congrès SAHO" : indirect ? "Sponsoring indirect — congrès SAHO" : "Stand 12 m² — hall B"}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60"
          />
        </label>
        {!stock && !indirect && (
          <>
            <label className="text-xs">
              Payé à
              <input name="supplier" placeholder="Organisateur, agence, association…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
            </label>
            <label className="text-xs">
              Montant estimé (DZD)
              <input name="amountEstimated" type="number" min="0" step="1000" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:border-primary/60" />
            </label>
          </>
        )}
      </div>

      {indirect && <EditeurRepartition />}

      {stock && (
        <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          Vous listerez ensuite les articles du magasin et leurs quantités. Rien n&apos;en sort avant l&apos;accord du poste ;
          après l&apos;événement, vous direz ce qui a été remis, et le reste reviendra au magasin.
        </p>
      )}

      {/* LA question à poser au moment de l'ajout : cet argent est-il déjà accordé, ou en plus ? */}
      {!stock && (
        <fieldset className="rounded-lg border border-border p-2.5">
          <legend className="px-1 text-xs text-muted-foreground">Ce poste est-il déjà couvert par le budget accordé ?</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="INCLUDED" defaultChecked /> Inclus dans le budget accordé
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="ADDITIONAL" /> Budget supplémentaire (rallonge)
            </label>
          </div>
        </fieldset>
      )}
      <label className="block text-xs">
        Précisions
        <input name="notes" placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
      </label>

      {decided && !stock && (
        <p className="flex items-start gap-1.5 text-[0.6875rem] text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          L&apos;opération est déjà tranchée : ce poste sera marqué « ajouté après décision ». S&apos;il
          est <strong>inclus</strong> dans le budget accordé, il fera apparaître un dépassement tant
          qu&apos;il n&apos;est pas compensé ; s&apos;il s&apos;agit d&apos;une <strong>rallonge</strong>, il sera compté à part.
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

/**
 * MODIFIER UN POSTE — ce qui le DÉCRIT, pas ce qui l'engage.
 *
 * Ces champs ne portent aucun engagement financier — seul le montant AFFECTÉ a été transmis aux
 * Finances, et lui seul se verrouille avec l'ordre de dépense. La nature de budget (inclus /
 * rallonge) reste modifiable tant que la Direction n'a pas tranché : après, c'est sur quoi elle
 * s'est prononcée.
 */
function EditItemForm({ item, busy, onCancel, onSave }: {
  item: ItemRow; busy: boolean; onCancel: () => void; onSave: (fd: FormData) => void;
}) {
  const budgetLocked = budgetKindLocked(item);
  const champ = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60";
  // UN POSTE « MATÉRIEL DU STOCK » ne se décrit que par son libellé et ses précisions : ni montant,
  // ni fournisseur, ni nature de budget — et sa nature ne change plus hors d'un brouillon vierge
  // (`refusChangementNature`). Son matériel se compose dans son propre bloc.
  if (estPosteStock(item)) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <label className="block text-xs">Libellé<input name="label" required defaultValue={item.label} className={champ} /></label>
        <label className="block text-xs">Précisions<input name="notes" defaultValue={item.notes ?? ""} placeholder="Facultatif" className={champ} /></label>
        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer</Button>
          <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Nature
          <select name="kind" defaultValue={item.kind} className={champ}>
            {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="text-xs">Libellé<input name="label" required defaultValue={item.label} className={champ} /></label>
        <label className="text-xs">Payé à<input name="supplier" defaultValue={item.supplier ?? ""} placeholder="Organisateur, agence, association…" className={champ} /></label>
        <label className="text-xs">
          Montant estimé (DZD)
          <input name="amountEstimated" type="number" min="0" step="1000" defaultValue={item.amountEstimated ?? ""} className={`${champ} tabular-nums`} />
        </label>
      </div>
      <label className="block text-xs">Précisions<input name="notes" defaultValue={item.notes ?? ""} placeholder="Facultatif" className={champ} /></label>

      {budgetLocked ? (
        <p className="text-[0.6875rem] text-muted-foreground">
          La Direction a tranché : la nature du budget ({ITEM_BUDGET_KIND_LABELS[item.budgetKind]}) ne change plus —
          c&apos;est sur elle qu&apos;elle s&apos;est prononcée.
        </p>
      ) : (
        <fieldset className="rounded-lg border border-border p-2.5">
          <legend className="px-1 text-xs text-muted-foreground">Ce poste est-il couvert par le budget accordé ?</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="INCLUDED" defaultChecked={item.budgetKind === "INCLUDED"} /> Inclus dans le budget accordé
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="ADDITIONAL" defaultChecked={item.budgetKind === "ADDITIONAL"} /> Budget supplémentaire (rallonge)
            </label>
          </div>
        </fieldset>
      )}

      {item.expenseOrderId && (
        <p className="flex items-start gap-1.5 text-[0.6875rem] text-muted-foreground">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" />
          Un ordre de dépense a été émis : le <strong>montant affecté</strong> ne change plus. Le reste se corrige librement.
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer</Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
