"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Landmark, ShieldCheck, Car, CheckCircle2, Trash2, Wallet, Ban, RotateCcw, Hourglass, FileClock, XCircle } from "lucide-react";
import {
  updateRequestStatus, createMission, startRequestProcessing,
  requestFinanceValidation, requestInternalValidation, finishRequest, deleteRequests,
  rouvrirDemande, annulerDemandeAuSecretariat,
} from "@/lib/actions/admin-request-actions";
import { refusDuStatutManuel } from "@/lib/secretariat/statut-manuel";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

type U = { id: string; name: string };

export function RequestActions({
  requestId, status, type, users, financeUsers, canManage,
  departments = [], defaultDepartmentId = null, fromAdPro = false, alreadyImputed = false, refusAnnulation = null,
}: {
  requestId: string;
  status: string;
  type: string;
  users: U[];
  financeUsers: U[];
  canManage: boolean;
  /** Départements dont on peut débiter les moyens généraux (nom seul — pas les montants). */
  departments?: { id: string; name: string }[];
  /** Le département du demandeur : c'est lui qui consomme, il est donc proposé d'emblée. */
  defaultDepartmentId?: string | null;
  /** Vient d'Ad & Pro : déjà porté par le budget de l'opération, on ne l'impute pas deux fois. */
  fromAdPro?: boolean;
  alreadyImputed?: boolean;
  /** Pourquoi l'annulation ne se fait PAS d'ici (la demande de BC d'un poste se retire depuis le poste) :
   *  le bouton n'est pas offert, et la raison se lit à sa place (§118.83). */
  refusAnnulation?: string | null;
}) {
  const router = useRouter();
  // Rafraîchir sans laisser rouvrir une fiche sur l'état d'avant (§118.172) : les gestes restent fermés
  // tant que les données d'après ne sont pas à l'écran.
  const { enCours, rafraichir } = useRafraichir();
  const [enVol, setBusy] = React.useState(false);
  const busy = enVol || enCours;
  const [err, setErr] = React.useState<string | null>(null);
  const [finance, setFinance] = React.useState(false);
  const [internal, setInternal] = React.useState(false);
  const [mission, setMission] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [finish, setFinish] = React.useState(false);
  const [bloquer, setBloquer] = React.useState(false);
  const [rouvrir, setRouvrir] = React.useState(false);
  const [annuler, setAnnuler] = React.useState(false);

  if (!canManage) return null;
  const isPurchase = type === "PURCHASE";
  // L'imputation est due pour un achat qui ne vient pas d'Ad & Pro et n'a pas déjà été imputé.
  const needsImputation = isPurchase && !fromAdPro && !alreadyImputed && departments.length > 0;
  // Le geste n'est offert que si l'action l'accepterait — la même règle des deux côtés. Le motif d'un
  // blocage se demande dans le volet : on le suppose donné pour savoir si le geste existe.
  const peut = (cible: string) => refusDuStatutManuel({ courant: status, cible, motif: "—" }) === null;

  async function run(fd: FormData, action: (f: FormData) => Promise<{ ok: boolean; error?: string }>, close?: () => void) {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (r.ok) { close?.(); rafraichir(); } else setErr(r.error ?? "Erreur.");
  }

  return (
    <div className="space-y-3">
      {/* Une demande terminée ou annulée ne se traite plus (§118.187) : les actions la refusent, l'écran
          ne les propose pas. Une demande terminée se ROUVRE, avec son motif ; une annulée, non (§118.191). */}
      {(status === "DONE" || status === "CANCELLED") && (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          {status === "CANCELLED"
            ? "Demande annulée : elle ne se traite plus, et ne se rouvre pas — ce qui en dépendait a été retiré avec elle."
            : "Demande terminée : elle ne se traite plus. Si elle doit reprendre, rouvrez-la — avec son motif."}
        </p>
      )}
      {/* Flux : commencer, demander validation, clôturer */}
      {status !== "DONE" && status !== "CANCELLED" && <div className="flex flex-wrap gap-2">
        {status === "NEW" && (
          <form action={(fd) => { fd.set("id", requestId); return run(fd, startRequestProcessing); }}>
            <Button type="submit" size="sm" disabled={busy}><Play className="h-4 w-4" /> Commencer le traitement</Button>
          </form>
        )}
        {isPurchase ? (
          <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setFinance(true); }}>
            <Landmark className="h-4 w-4" /> Demande de validation des Finances
          </Button>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setInternal(true); }}>
            <ShieldCheck className="h-4 w-4" /> Demander une validation
          </Button>
        )}
        <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setMission(true); }}><Car className="h-4 w-4" /> Mission chauffeur</Button>
        {/* Terminer un ACHAT sans dire qui le paie laissait le budget intact pendant que
            l'argent, lui, était sorti. On passe donc par l'imputation. */}
        {needsImputation ? (
          <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setFinish(true); }}>
            <CheckCircle2 className="h-4 w-4" /> Fin de la demande
          </Button>
        ) : (
          <form action={(fd) => { fd.set("id", requestId); return run(fd, finishRequest); }}>
            <BoutonDecisif variant="outline" size="sm" type="submit" disabled={busy}><CheckCircle2 className="h-4 w-4" /> Fin de la demande</BoutonDecisif>
          </form>
        )}
      </div>}

      {isPurchase && status !== "DONE" && status !== "CANCELLED" && (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Flux achat : commencez le traitement → uploadez le <strong>devis</strong> de l'agence (Documents) → demandez la
          validation des Finances → après accord, joignez la <strong>facture finale</strong> (Documents, ou Pièces liées → Facture,
          avec son PDF) puis cliquez « Fin de la demande ».
        </p>
      )}

      {/* PLUS DE MENU DE STATUT LIBRE (§118.191, audit R12) : il terminait sans les gardes de la fin,
          annulait sans retirer ce qui en dépendait, et ressuscitait une demande annulée. Restent des
          GESTES NOMMÉS — chacun offert quand l'action l'accepterait (`refusDuStatutManuel`). */}
      <div className="flex flex-wrap gap-2">
        {peut("AWAITING_EXTERNAL") && (
          <form action={(fd) => { fd.set("id", requestId); fd.set("status", "AWAITING_EXTERNAL"); return run(fd, updateRequestStatus); }}>
            <Button type="submit" size="sm" variant="outline" disabled={busy}><Hourglass className="h-4 w-4" /> En attente d&apos;un tiers</Button>
          </form>
        )}
        {peut("AWAITING_DOCUMENT") && (
          <form action={(fd) => { fd.set("id", requestId); fd.set("status", "AWAITING_DOCUMENT"); return run(fd, updateRequestStatus); }}>
            <Button type="submit" size="sm" variant="outline" disabled={busy}><FileClock className="h-4 w-4" /> En attente d&apos;un document</Button>
          </form>
        )}
        {peut("IN_PROGRESS") && (
          <form action={(fd) => { fd.set("id", requestId); fd.set("status", "IN_PROGRESS"); return run(fd, updateRequestStatus); }}>
            <Button type="submit" size="sm" variant="outline" disabled={busy}><Play className="h-4 w-4" /> Reprendre</Button>
          </form>
        )}
        {peut("BLOCKED") && (
          <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => { setErr(null); setBloquer(true); }}><Ban className="h-4 w-4" /> Bloquer…</Button>
        )}
        {status === "DONE" && (
          <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => { setErr(null); setRouvrir(true); }}><RotateCcw className="h-4 w-4" /> Rouvrir…</Button>
        )}
        {status !== "DONE" && status !== "CANCELLED" && refusAnnulation === null && (
          <Button size="sm" variant="outline" type="button" className="text-destructive" disabled={busy} onClick={() => { setErr(null); setAnnuler(true); }}><XCircle className="h-4 w-4" /> Annuler la demande…</Button>
        )}
      </div>
      {status !== "DONE" && status !== "CANCELLED" && refusAnnulation !== null && (
        <p className="text-xs text-muted-foreground">{refusAnnulation}</p>
      )}

      <button type="button" onClick={() => { setErr(null); setDel(true); }} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
        <Trash2 className="h-3.5 w-3.5" /> Supprimer la demande
      </button>

      {/* IMPUTATION AUX MOYENS GÉNÉRAUX — chaque département a les siens, et c'est celui qui a
          DEMANDÉ qui les consomme, pas le secrétariat qui exécute. */}
      <Sheet
        open={finish}
        onClose={() => setFinish(false)}
        title="Fin de la demande — imputer au budget"
        description="Choisissez le budget de moyens généraux à débiter : le vôtre, ou celui du département qui a demandé l'achat."
        width="md"
      >
        <form
          action={(fd) => {
            fd.set("id", requestId);
            return run(fd, finishRequest, () => setFinish(false));
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Budget de moyens généraux <span className="text-destructive">*</span></Label>
            <Select name="budgetDepartmentId" defaultValue={defaultDepartmentId ?? ""} required>
              <option value="">— Choisir le département à débiter —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground">
              Le montant sera <strong>déduit des moyens généraux</strong> de ce département, et la demande
              restera attachée à la dépense (traçabilité de bout en bout).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Montant réellement dépensé (DZD) <span className="text-destructive">*</span></Label>
            <Input name="budgetAmount" inputMode="decimal" placeholder="0" required className="text-right tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label>Précision (facultatif)</Label>
            <Input name="budgetNote" placeholder="Ex. fournisseur, n° de facture" />
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
            <span>La facture déjà versée à la demande sert de justificatif — inutile de la rescanner.</span>
          </p>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Terminer et imputer
          </Button>
        </form>
      </Sheet>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Validation Finances (flux achat) */}
      <Sheet open={finance} onClose={() => setFinance(false)} title="Demande de validation des Finances" width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, requestFinanceValidation, () => setFinance(false)); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">La demande arrive dans le bureau « Demandes de validations » des Finances. En cas de refus ou de modification demandée, vous pourrez renvoyer une nouvelle validation (va-et-vient).</p>
          <Field label="Validateur Finances">
            <Select name="validatorId" defaultValue={financeUsers[0]?.id ?? ""}>
              <option value="">— Toute l'équipe Finances</option>
              {financeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Montant estimé (DZD)"><Input name="amount" type="number" step="any" /></Field>
          <Field label="Commentaire (devis joint, détails…)"><Textarea name="comment" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFinance(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer aux Finances</Button></div>
        </form>
      </Sheet>

      {/* Validation interne (hors achat) */}
      <Sheet open={internal} onClose={() => setInternal(false)} title="Demander une validation" width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, requestInternalValidation, () => setInternal(false)); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">Choisissez qui doit valider (opérations, direction, autre). La demande arrive dans leur bureau « Demandes de validations ».</p>
          <Field label="Validateur"><Select name="validatorId" required defaultValue=""><option value="" disabled>Choisir…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="2ᵉ validateur (optionnel)"><Select name="validator2Id" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Commentaire"><Textarea name="comment" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setInternal(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer</Button></div>
        </form>
      </Sheet>

      {/* Mission chauffeur */}
      <Sheet open={mission} onClose={() => setMission(false)} title="Créer une mission chauffeur" width="md">
        <form action={(fd) => { fd.set("requestId", requestId); return run(fd, createMission, () => setMission(false)); }} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field full label="Titre"><Input name="title" required placeholder="Ex. Déposer dossier à la PCH" /></Field>
            <Field label="Chauffeur"><Select name="assignedToId" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
            <Field label="Échéance"><Input name="deadline" type="date" /></Field>
            <Field label="Lieu de départ"><Input name="startLocation" /></Field>
            <Field label="Destination"><Input name="destination" /></Field>
            <Field full label="Adresse"><Input name="address" /></Field>
            <Field label="Contact"><Input name="contactName" /></Field>
            <Field label="Téléphone"><Input name="contactPhone" /></Field>
            <Field full label="Instructions"><Textarea name="instructions" /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMission(false)}>Annuler</Button><Button type="submit" disabled={busy}>Créer la mission</Button></div>
        </form>
      </Sheet>

      {/* Suppression traçable */}

      <Sheet open={bloquer} onClose={() => setBloquer(false)} title="Bloquer la demande" description="Dites ce qui bloque : c'est ce que lira le demandeur." width="md">
        <form action={(fd) => { fd.set("id", requestId); fd.set("status", "BLOCKED"); return run(fd, updateRequestStatus, () => setBloquer(false)); }} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="rq-block">Ce qui bloque</Label><Textarea id="rq-block" name="blockedReason" rows={3} required /></div>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setBloquer(false)}>Fermer</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Bloquer</Button></div>
        </form>
      </Sheet>
      <Sheet open={rouvrir} onClose={() => setRouvrir(false)} title="Rouvrir la demande" description="La demande repart en cours ; le demandeur est prévenu, avec votre motif." width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, rouvrirDemande, () => setRouvrir(false)); }} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="rq-reopen">Pourquoi la rouvrir</Label><Textarea id="rq-reopen" name="motif" rows={3} required /></div>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRouvrir(false)}>Fermer</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Rouvrir</Button></div>
        </form>
      </Sheet>
      <Sheet open={annuler} onClose={() => setAnnuler(false)} title="Annuler la demande" description="La validation, l'approbation et le paiement en attente sont retirés avec elle ; le demandeur est prévenu." width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, annulerDemandeAuSecretariat, () => setAnnuler(false)); }} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="rq-cancel">Motif de l&apos;annulation</Label><Textarea id="rq-cancel" name="motif" rows={3} required /></div>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><BoutonDecisif type="button" variant="outline" onClick={() => setAnnuler(false)}>Fermer</BoutonDecisif><Button type="submit" variant="destructive" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Annuler la demande</Button></div>
        </form>
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)} title="Supprimer la demande" width="md">
        <form action={(fd) => { fd.set("ids", requestId); return run(fd, deleteRequests, () => { setDel(false); router.push("/demandes"); }); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">La suppression est <strong>tracée</strong> (qui, quand, pourquoi). La demande est archivée et masquée des listes, mais reste consultable en corbeille.</p>
          <Field label="Motif de suppression (obligatoire)"><Textarea name="reason" required placeholder="Ex. Doublon, demande annulée par le service…" /></Field>
          <div className="flex justify-end gap-2"><BoutonDecisif type="button" variant="outline" onClick={() => setDel(false)}>Annuler</BoutonDecisif><Button type="submit" variant="destructive" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Supprimer</Button></div>
        </form>
      </Sheet>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}><Label>{label}</Label>{children}</div>;
}
