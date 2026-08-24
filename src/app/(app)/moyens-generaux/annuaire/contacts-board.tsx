"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2, Loader2, Phone, Mail, Globe, MapPin, Copy, Check } from "lucide-react";
import {
  createCompanyContact, updateCompanyContact, deleteCompanyContact,
} from "@/lib/actions/company-contact-actions";
import { CONTACT_KIND_SUGGESTIONS, groupContactsByKind, matchesContact } from "@/lib/contacts/kinds";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface ContactRow {
  id: string;
  name: string;
  kind: string | null;
  contactName: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  rc: string | null;
  nif: string | null;
  rib: string | null;
  notes: string | null;
  isActive: boolean;
  companyId: string | null;
  companyLabel: string | null;
}

/**
 * L'ANNUAIRE DE L'ENTREPRISE — l'imprimeur qu'on cherche quand la personne qui le connaît est absente.
 *
 * Regroupé PAR MÉTIER, parce que c'est ainsi qu'on cherche : on ne se souvient pas de la raison
 * sociale du traiteur, on sait qu'on veut un traiteur. La recherche, elle, accepte les trois
 * entrées réelles — le métier, le nom, ou les quatre chiffres qu'on lit sur une facture.
 *
 * Les numéros se COPIENT d'un clic : les recopier à la main dans un message est exactement le
 * geste où l'on inverse deux chiffres.
 */
export function ContactsBoard({
  contacts, companies, canCreate, canEdit, canDelete,
}: {
  contacts: ContactRow[];
  companies: { id: string; label: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<ContactRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => contacts.filter((c) => (showInactive || c.isActive) && matchesContact(c, query)),
    [contacts, query, showInactive],
  );
  const groups = React.useMemo(() => groupContactsByKind(visible), [visible]);
  const inactiveCount = contacts.filter((c) => !c.isActive).length;

  const remove = async (c: ContactRow) => {
    if (!window.confirm(`Retirer « ${c.name} » de l'annuaire ?\n\nPour simplement le mettre de côté, décochez « actif » à la modification.`)) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", c.id);
    const r = await deleteCompanyContact(fd);
    setBusy(false);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    else router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Imprimeur, agence de voyage, un nom, un numéro…" className="pl-8"
          />
        </div>
        {inactiveCount > 0 && (
          <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Afficher les inactifs ({inactiveCount})
          </label>
        )}
        {canCreate && (
          <Button size="sm" onClick={() => { setErr(null); setAdding(true); }}>
            <Plus className="h-4 w-4" /> Nouveau contact
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="BookUser"
          title={query ? "Aucun contact ne correspond" : "L'annuaire est vide"}
          description={
            query
              ? "Essayez le métier (« imprimeur »), la raison sociale, ou un fragment de numéro."
              : "Agence de voyage, livreur, imprimeur, agence marketing, hôtel… — les numéros qu'on cherche le jour où la personne qui les connaît est absente."
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="surface space-y-2 p-3 sm:p-4">
            <h2 className="text-sm font-semibold">
              {g.label} <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((c) => (
                <li key={c.id} className={cn("group rounded-lg border border-border p-2.5", !c.isActive && "opacity-60")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.name}
                        {!c.isActive && <span className="ml-1.5 text-[0.6875rem] font-normal text-muted-foreground">(inactif)</span>}
                      </p>
                      {c.contactName && <p className="truncate text-xs text-muted-foreground">{c.contactName}</p>}
                    </div>
                    <span className="hidden shrink-0 items-center gap-0.5 group-hover:inline-flex">
                      {canEdit && (
                        <button type="button" title="Modifier" onClick={() => { setErr(null); setEditing(c); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" title="Retirer" disabled={busy} onClick={() => void remove(c)} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-0.5 text-xs">
                    {c.phone && <CopyLine icon={Phone} value={c.phone} href={`tel:${c.phone.replace(/\s/g, "")}`} />}
                    {c.phoneAlt && <CopyLine icon={Phone} value={c.phoneAlt} href={`tel:${c.phoneAlt.replace(/\s/g, "")}`} />}
                    {c.email && <CopyLine icon={Mail} value={c.email} href={`mailto:${c.email}`} />}
                    {c.website && <CopyLine icon={Globe} value={c.website} href={c.website.startsWith("http") ? c.website : `https://${c.website}`} external />}
                    {(c.city || c.wilaya) && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{[c.city, c.wilaya].filter(Boolean).join(", ")}</span>
                      </p>
                    )}
                    {c.companyLabel && <p className="text-[0.6875rem] text-muted-foreground">· {c.companyLabel}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {adding && (
        <ContactSheet
          title="Nouveau contact" companies={companies} defaults={{}} busy={busy} err={err}
          onClose={() => setAdding(false)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            const r = await createCompanyContact(undefined, fd);
            setBusy(false);
            if (r.ok) { setAdding(false); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}

      {editing && (
        <ContactSheet
          title={editing.name} companies={companies} defaults={editing} busy={busy} err={err} showActive
          onClose={() => setEditing(null)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            fd.set("id", editing.id);
            const r = await updateCompanyContact(fd);
            setBusy(false);
            if (r.ok) { setEditing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}
    </div>
  );
}

/** Une coordonnée cliquable ET copiable — appeler depuis un mobile, coller depuis un poste. */
function CopyLine({ icon: I, value, href, external }: { icon: React.ElementType; value: string; href: string; external?: boolean }) {
  const [done, setDone] = React.useState(false);
  return (
    <p className="flex items-center gap-1.5">
      <I className="h-3 w-3 shrink-0 text-muted-foreground" />
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="min-w-0 flex-1 truncate text-primary hover:underline"
      >
        {value}
      </a>
      <button
        type="button" title="Copier"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          } catch { /* presse-papier refusé : le lien reste cliquable */ }
        }}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        {done ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </p>
  );
}

function ContactSheet({
  title, companies, defaults, busy, err, showActive, onClose, onSubmit,
}: {
  title: string;
  companies: { id: string; label: string }[];
  defaults: Partial<ContactRow>;
  busy: boolean;
  err: string | null;
  showActive?: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  return (
    <Sheet open onClose={() => !busy && onClose()} width="lg" title={title} description="Seul le nom est obligatoire — un contact s'ajoute vite et se complète ensuite.">
      <form action={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="name" label="Nom / raison sociale" defaultValue={defaults.name} required />
          {/* La nature est LIBRE, avec des suggestions : la réalité invente des métiers plus vite
              qu'une liste fermée ne les prévoit (« sérigraphie », « standiste », « douanes »). */}
          <div className="space-y-1.5">
            <Label htmlFor="cc-kind">Nature</Label>
            <Input id="cc-kind" name="kind" list="contact-kinds" defaultValue={defaults.kind ?? ""} placeholder="Imprimeur, agence de voyage…" />
            <datalist id="contact-kinds">
              {CONTACT_KIND_SUGGESTIONS.map((k) => <option key={k} value={k} />)}
            </datalist>
          </div>
          <Field name="contactName" label="Personne à demander" defaultValue={defaults.contactName} />
          <Field name="phone" label="Téléphone" defaultValue={defaults.phone} />
          <Field name="phoneAlt" label="Autre téléphone" defaultValue={defaults.phoneAlt} />
          <Field name="email" label="E-mail" defaultValue={defaults.email} />
          <Field name="website" label="Site web" defaultValue={defaults.website} />
          <Field name="city" label="Ville" defaultValue={defaults.city} />
          <Field name="wilaya" label="Wilaya" defaultValue={defaults.wilaya} />
        </div>
        <Field name="address" label="Adresse" defaultValue={defaults.address} />

        {/* LES IDENTIFIANTS : ce qu'on redemande au fournisseur au moment de monter le dossier de
            paiement — et qu'on finit par chercher sur une vieille facture. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="rc" label="RC" defaultValue={defaults.rc} />
          <Field name="nif" label="NIF" defaultValue={defaults.nif} />
          <Field name="rib" label="RIB" defaultValue={defaults.rib} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cc-company">Entité</Label>
          <Select id="cc-company" name="companyId" defaultValue={defaults.companyId ?? ""}>
            <option value="">Commun au groupe</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cc-notes">Notes</Label>
          <Textarea id="cc-notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} />
        </div>

        {showActive && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" value="1" defaultChecked={defaults.isActive ?? true} />
            Contact actif — décochez pour le mettre de côté sans le supprimer
          </label>
        )}

        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}

function Field({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`cc-${name}`}>{label}</Label>
      <Input id={`cc-${name}`} name={name} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}
