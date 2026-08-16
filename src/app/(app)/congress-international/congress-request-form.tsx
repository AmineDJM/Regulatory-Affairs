"use client";

import * as React from "react";
import { useAutoOpen } from "@/components/shared/use-auto-open";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, X, Search, Check } from "lucide-react";
import { createCongressRequest } from "@/lib/actions/congress-request-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { NATIONAL_EVENT_TYPE, ROLE_LABELS } from "@/lib/labels";

export interface DoctorOpt { id: string; name: string; specialty: string; city: string }
export interface UserOpt { id: string; name: string; role: string }

const PM_ROLES = ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"];

export function CongressRequestButton({ national, doctors, users, canDesignatePM, canChooseAnalysis }: { national?: boolean; doctors: DoctorOpt[]; users: UserOpt[]; canDesignatePM?: boolean; canChooseAnalysis?: boolean }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  // Arrivée depuis « Nouvelle demande » d'Ad & Pro : le formulaire s'ouvre de lui-même.
  useAutoOpen("new", () => setOpen(true));
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [specialty, setSpecialty] = React.useState("");
  const [pickedDoctors, setPickedDoctors] = React.useState<Set<string>>(new Set());
  const [pickedUsers, setPickedUsers] = React.useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = React.useState("");
  const [productManagerId, setProductManagerId] = React.useState("");
  // La Direction choisit son circuit : trancher tout de suite, ou demander un avis produit.
  const [viaProductManager, setViaProductManager] = React.useState(false);

  // National Sales créant lui-même : il désigne le chef de produit (l'analyse lui est
  // confiée) et n'a pas à approuver préliminairement sa propre demande.
  const pmCandidates = React.useMemo(() => users.filter((u) => PM_ROLES.includes(u.role)), [users]);
  const showPmPicker = Boolean(canDesignatePM) && pmCandidates.length > 0;

  const specialties = React.useMemo(() => [...new Set(doctors.map((d) => d.specialty))].sort(), [doctors]);
  const doctorsInSpecialty = React.useMemo(() => doctors.filter((d) => d.specialty === specialty), [doctors, specialty]);
  const doctorById = React.useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const filteredUsers = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
  }, [users, userQuery]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  };

  const reset = () => { setSpecialty(""); setPickedDoctors(new Set()); setPickedUsers(new Set()); setUserQuery(""); setProductManagerId(""); setErr(null); };

  const submit = async () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("type", national ? "NATIONAL" : "INTL");
    pickedDoctors.forEach((id) => fd.append("invitedDoctorIds", id));
    pickedUsers.forEach((id) => fd.append("participantIds", id));
    if (showPmPicker) fd.set("productManagerId", productManagerId);
    if (canChooseAnalysis) fd.set("viaProductManager", viaProductManager ? "1" : "0");
    if (!String(fd.get("name") ?? "").trim()) { setErr("Le nom de l'événement est obligatoire."); return; }
    // La désignation n'est obligatoire que si l'analyse est réellement demandée : la Direction
    // qui tranche directement n'a personne à désigner.
    const analysisWanted = canChooseAnalysis ? viaProductManager : showPmPicker;
    if (analysisWanted && !productManagerId) { setErr("Désignez le chef de produit qui analysera la demande."); return; }
    setSaving(true); setErr(null);
    const r = await createCongressRequest(undefined, fd);
    setSaving(false);
    if (r.ok) { setOpen(false); reset(); router.refresh(); if (r.id) router.push(`${national ? "/congress-national" : "/congress-international"}/${r.id}`); }
    else setErr(r.error ?? "Erreur.");
  };

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle demande</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={national ? "Nouvelle prise en charge — nationale" : "Nouvelle prise en charge — internationale"} description="Renseignez l\u2019événement, puis ajoutez les personnes à prendre en charge sur la fiche." width="lg">
        <form ref={formRef} action={submit} className="space-y-5">
          {/* Infos générales */}
          <div className="grid grid-cols-2 gap-3">
            <Field full label="Nom de l'événement" required><Input name="name" required placeholder="Ex. ECCMID 2026" /></Field>
            <Field full label="Demande(s) du médecin">
              <input name="files" type="file" multiple
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm" />
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">Courrier, invitation, programme… Plusieurs fichiers possibles.</p>
            </Field>
            <Field label="Type d'événement">
              <Select name="eventType" defaultValue="CONGRESS">
                {Object.entries(NATIONAL_EVENT_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Spécialité (thème)"><Input name="specialty" placeholder="Ex. Infectiologie" /></Field>
            {national ? (
              <>
                <Field label="Pays"><Input name="country" placeholder="Algérie" /></Field>
                <Field label="Ville"><Input name="city" /></Field>
                <Field label="Institution hôte"><Input name="hostInstitution" placeholder="Hôpital / association" /></Field>
                <Field label="Date"><Input name="date" type="date" /></Field>
              </>
            ) : (
              <>
                <Field label="Pays"><Input name="country" /></Field>
                <Field label="Ville"><Input name="city" /></Field>
                <Field label="Date début"><Input name="startDate" type="date" /></Field>
                <Field label="Date fin"><Input name="endDate" type="date" /></Field>
              </>
            )}
            <Field label="Budget estimé (DZD)"><Input name="estimatedBudget" type="number" step="any" placeholder="Estimation du demandeur" /></Field>
          </div>

          {/* National Sales : désignation directe du chef de produit (pas d'auto-approbation
              préliminaire). Direction : le passage par l'analyse est un CHOIX. */}
          {showPmPicker && (
            <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              {canChooseAnalysis && (
                <div className="space-y-1.5 pb-1.5">
                  <Label>Circuit</Label>
                  <Select value={viaProductManager ? "1" : "0"} onChange={(e) => setViaProductManager(e.target.value === "1")}>
                    <option value="0">Décider maintenant (aucune analyse préalable)</option>
                    <option value="1">Demander d&apos;abord l&apos;avis d&apos;un chef de produit</option>
                  </Select>
                </div>
              )}
              {canChooseAnalysis && !viaProductManager ? null : (
              <>
              <Label>Chef de produit (analyse) <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Désignez le chef de produit qui analysera la demande — l&apos;étape préliminaire est franchie automatiquement.</p>
              <Select value={productManagerId} onChange={(e) => setProductManagerId(e.target.value)}>
                <option value="">— Sélectionner le chef de produit —</option>
                {pmCandidates.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role] ?? u.role}</option>)}
              </Select>
              </>
              )}
            </div>
          )}

          {/* Médecins invités : spécialité → liste */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Médecins invités</Label>
            <p className="text-xs text-muted-foreground">Choisissez une spécialité (issue de la Promotion médicale), puis sélectionnez les médecins.</p>
            <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">— Choisir une spécialité —</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            {specialty && (
              <div className="max-h-44 space-y-1 overflow-auto rounded-md bg-muted/30 p-2">
                {doctorsInSpecialty.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">Aucun médecin pour cette spécialité.</p>
                ) : doctorsInSpecialty.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                    <input type="checkbox" checked={pickedDoctors.has(d.id)} onChange={() => toggle(pickedDoctors, d.id, setPickedDoctors)} className="h-4 w-4 rounded border-input" />
                    <span>{d.name}</span>{d.city && <span className="text-xs text-muted-foreground">· {d.city}</span>}
                  </label>
                ))}
              </div>
            )}
            {pickedDoctors.size > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[...pickedDoctors].map((id) => (
                  <Chip key={id} label={doctorById.get(id)?.name ?? id} onRemove={() => toggle(pickedDoctors, id, setPickedDoctors)} />
                ))}
              </div>
            )}
          </div>

          {/* Participants Adventum */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Participants Adventum</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Rechercher un collaborateur…" className="pl-8" />
            </div>
            <div className="max-h-40 space-y-1 overflow-auto rounded-md bg-muted/30 p-2">
              {filteredUsers.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                  <input type="checkbox" checked={pickedUsers.has(u.id)} onChange={() => toggle(pickedUsers, u.id, setPickedUsers)} className="h-4 w-4 rounded border-input" />
                  <span>{u.name}</span><span className="text-xs text-muted-foreground">· {ROLE_LABELS[u.role] ?? u.role}</span>
                </label>
              ))}
            </div>
            {pickedUsers.size > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[...pickedUsers].map((id) => (
                  <Chip key={id} label={userById.get(id)?.name ?? id} onRemove={() => toggle(pickedUsers, id, setPickedUsers)} />
                ))}
              </div>
            )}
          </div>

          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Envoyer la demande</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

function Field({ label, full, required, children }: { label: string; full?: boolean; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full hover:bg-primary/20"><X className="h-3 w-3" /></button>
    </span>
  );
}
