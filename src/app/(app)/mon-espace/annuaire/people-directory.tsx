"use client";

import * as React from "react";
import { Check, Mail, Phone, MessageCircle, Plus, X, ShieldCheck } from "lucide-react";
import {
  ensureDirectoryEntry, addDirectoryEndpoint, deactivateDirectoryEndpoint,
} from "@/lib/actions/directory-actions";

/**
 * L'ANNUAIRE DES PERSONNES — l'écran où l'assistante de direction enrichit ce qu'Adam saura.
 *
 * CE QUE CET ÉCRAN N'EST PAS. Ce n'est pas une seconde fiche salarié : le nom, le poste et le
 * département restent aux RH, et cet écran ne les modifie pas. Il ne porte QUE ce qu'aucune fiche
 * ne porte aujourd'hui — les adresses en plus, le WhatsApp, les alias par lesquels on désigne
 * réellement les gens (« Amine », « AD ») — et la PROVENANCE de chaque coordonnée.
 *
 * Pourquoi la provenance a sa place à l'écran : c'est elle qui décide, plus tard, sur quelle
 * boîte part un message signé du PDG. La montrer, c'est permettre de la corriger.
 */

export interface DirectoryPerson {
  key: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  userId: string | null;
  employeeId: string | null;
  entryId: string | null;
  aliases: string[];
  endpoints: {
    id: string;
    channel: "EMAIL" | "PHONE" | "WHATSAPP";
    value: string;
    label: string | null;
    confidence: string;
    isPrimary: boolean;
  }[];
  /** Les adresses connues des fiches ERP, hors annuaire — affichées, jamais dupliquées. */
  erpEmails: string[];
}

const CONFIDENCE_LABEL: Record<string, string> = {
  VERIFIED_INTERNAL: "vérifiée",
  VERIFIED_PROVIDER: "fiche ERP",
  OBSERVED_HISTORY: "vue en correspondance",
  INFERRED: "à confirmer",
};

const CHANNEL_ICON = {
  EMAIL: Mail,
  PHONE: Phone,
  WHATSAPP: MessageCircle,
} as const;

export function PeopleDirectory({ people, canEdit }: { people: DirectoryPerson[]; canEdit: boolean }) {
  const [query, setQuery] = React.useState("");
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.aliases.some((a) => a.includes(q))
      || p.endpoints.some((e) => e.value.includes(q))
      || p.erpEmails.some((e) => e.includes(q)));
  }, [people, query]);

  async function addEndpoint(person: DirectoryPerson, form: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData(form);
      // L'entrée d'annuaire n'existe pas forcément : on la crée à la volée, accrochée à la fiche
      // canonique de la personne — jamais comme un doublon flottant.
      let entryId = person.entryId;
      if (!entryId) {
        const seed = new FormData();
        if (person.userId) seed.set("userId", person.userId);
        if (person.employeeId) seed.set("employeeId", person.employeeId);
        seed.set("displayName", person.name);
        const created = await ensureDirectoryEntry(seed);
        if (!created.ok || !created.id) { alert(created.error ?? "Création impossible."); return; }
        entryId = created.id;
      }
      fd.set("entryId", entryId);
      const res = await addDirectoryEndpoint(fd);
      if (!res.ok) { alert(res.error ?? "Enregistrement impossible."); return; }
      form.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Personnes &amp; coordonnées</h2>
          <p className="text-xs text-muted-foreground">
            Ce que l&apos;assistant utilise pour joindre quelqu&apos;un. Le nom et le poste restent tenus par les RH.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un nom, un alias, une adresse…"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm sm:w-72"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {query ? `Personne ne correspond à « ${query} ».` : "Aucune personne dans le registre."}
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {visible.map((p) => {
            const open = openKey === p.key;
            const known = p.endpoints.filter((e) => e.channel === "EMAIL").length + p.erpEmails.length;
            return (
              <div key={p.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : p.key)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-secondary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.jobTitle, p.department, p.company].filter(Boolean).join(" · ") || "—"}
                    </span>
                    {p.aliases.length > 0 && (
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                        aussi appelé·e : {p.aliases.join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {known === 0 ? "aucune adresse" : `${known} adresse${known > 1 ? "s" : ""}`}
                  </span>
                </button>

                {open && (
                  <div className="space-y-3 border-t border-border bg-secondary/20 p-3">
                    <ul className="space-y-1.5">
                      {p.endpoints.map((e) => {
                        const Icon = CHANNEL_ICON[e.channel];
                        return (
                          <li key={e.id} className="flex items-center gap-2 text-sm">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{e.value}</span>
                            {e.label && <span className="text-xs text-muted-foreground">({e.label})</span>}
                            {e.isPrimary && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-success/15 px-1.5 py-0.5 text-[0.6875rem] text-success">
                                <Check className="h-3 w-3" /> principale
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                              {e.confidence === "VERIFIED_INTERNAL" && <ShieldCheck className="h-3 w-3" />}
                              {CONFIDENCE_LABEL[e.confidence] ?? e.confidence}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                aria-label={`Retirer ${e.value}`}
                                onClick={async () => {
                                  if (!confirm(`Retirer ${e.value} de l'annuaire ?`)) return;
                                  const fd = new FormData();
                                  fd.set("id", e.id);
                                  const r = await deactivateDirectoryEndpoint(fd);
                                  if (!r.ok) alert(r.error ?? "Retrait impossible.");
                                }}
                                className="ml-auto shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </li>
                        );
                      })}
                      {p.erpEmails.map((mail) => (
                        <li key={mail} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{mail}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[0.6875rem]">fiche ERP</span>
                        </li>
                      ))}
                      {p.endpoints.length === 0 && p.erpEmails.length === 0 && (
                        <li className="text-sm text-muted-foreground">Aucune coordonnée connue.</li>
                      )}
                    </ul>

                    {canEdit && (
                      <form
                        onSubmit={(ev) => { ev.preventDefault(); void addEndpoint(p, ev.currentTarget); }}
                        className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
                      >
                        <label className="text-xs">
                          <span className="mb-0.5 block text-muted-foreground">Canal</span>
                          <select name="channel" className="h-8 rounded-lg border border-border bg-background px-2 text-sm">
                            <option value="EMAIL">E-mail</option>
                            <option value="PHONE">Téléphone</option>
                            <option value="WHATSAPP">WhatsApp</option>
                          </select>
                        </label>
                        <label className="min-w-[12rem] flex-1 text-xs">
                          <span className="mb-0.5 block text-muted-foreground">Valeur</span>
                          <input name="value" required placeholder="prenom.nom@societe.dz" className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                        </label>
                        <label className="text-xs">
                          <span className="mb-0.5 block text-muted-foreground">Usage</span>
                          <input name="label" placeholder="Pharmagene, perso…" className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm" />
                        </label>
                        <label className="text-xs">
                          <span className="mb-0.5 block text-muted-foreground">Fiabilité</span>
                          <select name="confidence" className="h-8 rounded-lg border border-border bg-background px-2 text-sm">
                            <option value="VERIFIED_INTERNAL">Vérifiée</option>
                            <option value="OBSERVED_HISTORY">Vue quelque part</option>
                            <option value="INFERRED">À confirmer</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="checkbox" name="isPrimary" className="h-4 w-4 accent-success" />
                          Principale
                        </label>
                        <button
                          type="submit" disabled={busy}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Ajouter
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
