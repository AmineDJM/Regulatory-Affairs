"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Star, Stethoscope, Tags, AlertCircle, Hospital, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  SEGMENT_LEVEL, MEDICAL_SECTOR, DOCTOR_TITLE, doctorDisplayName,
} from "@/lib/labels";
import { createDoctor, updateDoctor, createSpecialty, updateSpecialty, deleteSpecialty, deleteDoctor } from "@/lib/actions/medical-actions";
import type { SpecialtyGroupDTO, SpecialtyDTO, DoctorDTO } from "@/lib/queries/medical";

type Result = { ok: boolean; error?: string };

interface Props {
  groups: SpecialtyGroupDTO[];
  specialties: SpecialtyDTO[];
  delegates: { id: string; name: string }[];
  companies: { id: string; name: string; shortName: string | null }[];
  canCreate: boolean;
  canEdit: boolean;
  canManageSpecialties: boolean;
  canDelete: boolean;
  isManager: boolean;
}

const SECTOR_ORDER = ["HOSPITAL", "LIBERAL", "BOTH"] as const;
const SECTOR_ICON = { HOSPITAL: Hospital, LIBERAL: Building2, BOTH: Building2 };

function useSubmit() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const submit = async (fn: () => Promise<Result>, onOk: () => void) => {
    setSaving(true); setErr(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { onOk(); router.refresh(); } else setErr(r.error ?? "Erreur.");
  };
  return { saving, err, setErr, submit };
}

export function MedicalDirectory({ groups, specialties, delegates, companies, canCreate, canEdit, canManageSpecialties, canDelete, isManager }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [doctorSheet, setDoctorSheet] = React.useState<{ mode: "create" | "edit"; doctor?: DoctorDTO } | null>(null);
  const [specSheet, setSpecSheet] = React.useState(false);

  const isOpen = (key: string) => open[key] ?? true; // ouvert par défaut
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !isOpen(key) }));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Annuaire par spécialité</h2>
        <div className="flex gap-2">
          {canManageSpecialties && (
            <Button variant="outline" size="sm" onClick={() => setSpecSheet(true)}><Tags className="h-4 w-4" /> Spécialités</Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setDoctorSheet({ mode: "create" })}><Plus className="h-4 w-4" /> Nouveau médecin</Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 p-8 text-center">
          <Stethoscope className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun médecin. {canManageSpecialties && "Créez d'abord vos spécialités, puis ajoutez les médecins."}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const key = g.id ?? "none";
            const bySector = SECTOR_ORDER.map((s) => ({ sector: s, doctors: g.doctors.filter((d) => d.sector === s) })).filter((b) => b.doctors.length > 0);
            return (
              <div key={key} className="surface overflow-hidden">
                <button onClick={() => toggle(key)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40">
                  {isOpen(key) ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.color ?? "#64748b" }} />
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.count} médecin{g.count > 1 ? "s" : ""}</span>
                  {g.kol > 0 && <Badge tone="purple" dot={false} className="gap-1"><Star className="h-3 w-3" /> {g.kol} KOL</Badge>}
                </button>

                {isOpen(key) && (
                  <div className="border-t border-border">
                    {bySector.map(({ sector, doctors }) => {
                      const SectorIcon = SECTOR_ICON[sector];
                      return (
                        <div key={sector}>
                          <div className="flex items-center gap-2 bg-secondary/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            <SectorIcon className="h-3.5 w-3.5" /> {MEDICAL_SECTOR[sector].label}
                            <span className="text-muted-foreground/70">· {doctors.length}</span>
                          </div>
                          <ul className="divide-y divide-border">
                            {doctors.map((d) => (
                              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium">{doctorDisplayName(d)}</span>
                                    {d.title !== "AUTRE" && <span className="text-xs text-muted-foreground">{DOCTOR_TITLE[d.title]}</span>}
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {[d.institution, d.city, d.delegate && `Délégué : ${d.delegate}`].filter(Boolean).join(" · ") || "—"}
                                  </p>
                                </div>
                                <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
                                  <span className="inline-flex items-center gap-1" title="Influence"><span className="text-[10px] font-medium uppercase text-muted-foreground">Infl</span><StatusBadge map={SEGMENT_LEVEL} value={d.influence} dot={false} /></span>
                                  <span className="inline-flex items-center gap-1" title="Potentiel"><span className="text-[10px] font-medium uppercase text-muted-foreground">Pot</span><StatusBadge map={SEGMENT_LEVEL} value={d.potential} dot={false} /></span>
                                  <span className="inline-flex items-center gap-1" title="Affinité avec nous"><span className="text-[10px] font-medium uppercase text-muted-foreground">Affi</span><StatusBadge map={SEGMENT_LEVEL} value={d.affinity} dot={false} /></span>
                                </div>
                                {canEdit && (
                                  <button onClick={() => setDoctorSheet({ mode: "edit", doctor: d })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Modifier">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Supprimer « ${doctorDisplayName(d)} » de l'annuaire ? Ses visites seront supprimées.`)) return;
                                      const fd = new FormData(); fd.set("id", d.id);
                                      const r = await deleteDoctor(fd);
                                      if (!r.ok) window.alert(r.error);
                                      router.refresh();
                                    }}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Supprimer le médecin"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {doctorSheet && (
        <DoctorSheet
          mode={doctorSheet.mode}
          doctor={doctorSheet.doctor}
          specialties={specialties}
          delegates={delegates}
          companies={companies}
          isManager={isManager}
          onClose={() => setDoctorSheet(null)}
        />
      )}
      {specSheet && <SpecialtiesManager specialties={specialties} canDelete={canDelete} onClose={() => setSpecSheet(false)} />}
    </section>
  );
}

function W({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}><Label>{label}</Label>{children}</div>;
}

function DoctorSheet({
  mode, doctor, specialties, delegates, companies, isManager, onClose,
}: {
  mode: "create" | "edit";
  doctor?: DoctorDTO;
  specialties: SpecialtyDTO[];
  delegates: { id: string; name: string }[];
  companies: { id: string; name: string; shortName: string | null }[];
  isManager: boolean;
  onClose: () => void;
}) {
  const { saving, err, submit } = useSubmit();
  const d = doctor;

  const onSubmit = (fd: FormData) => {
    if (mode === "edit" && d) { fd.set("id", d.id); submit(() => updateDoctor(fd), onClose); }
    else submit(() => createDoctor(undefined, fd), onClose);
  };

  return (
    <Sheet open onClose={onClose} title={mode === "edit" ? "Modifier le médecin" : "Nouveau médecin"} width="lg">
      <form action={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <W full label="Nom complet"><Input name="name" defaultValue={d?.name} required placeholder="Ex. Mouffok" /></W>
          <W label="Titre / grade">
            <Select name="title" defaultValue={d?.title ?? "PRATICIEN_SPECIALISTE"}>
              {Object.entries(DOCTOR_TITLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </W>
          <W label="Spécialité">
            <Select name="specialtyId" defaultValue={d?.specialtyId ?? ""}>
              <option value="">— Sans spécialité —</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </W>
          <W label="Secteur">
            <Select name="sector" defaultValue={d?.sector ?? "LIBERAL"}>
              {Object.entries(MEDICAL_SECTOR).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
            </Select>
          </W>
          <W label="Entité">
            <Select name="companyId" defaultValue={d?.companyId ?? ""}>
              <option value="">— Entité —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
            </Select>
          </W>
          <W label="Hôpital / Clinique"><Input name="institution" defaultValue={d?.institution} /></W>
          <W label="Ville"><Input name="city" defaultValue={d?.city} /></W>
          <W label="Région"><Input name="region" defaultValue={d?.region} /></W>
          <W label="Influence (produit / spécialité)">
            <Select name="influence" defaultValue={d?.influence ?? "MEDIUM"}>
              {Object.entries(SEGMENT_LEVEL).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
            </Select>
          </W>
          <W label="Potentiel (produit / spécialité)">
            <Select name="potential" defaultValue={d?.potential ?? "MEDIUM"}>
              {Object.entries(SEGMENT_LEVEL).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
            </Select>
          </W>
          <W label="Affinité avec nous">
            <Select name="affinity" defaultValue={d?.affinity ?? "MEDIUM"}>
              {Object.entries(SEGMENT_LEVEL).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
            </Select>
          </W>
          <W label="Téléphone"><Input name="phone" defaultValue={d?.phone} /></W>
          <W label="Email"><Input name="email" type="email" defaultValue={d?.email} /></W>
          {isManager && (
            <W label="Délégué assigné">
              <Select name="delegateId" defaultValue={d?.delegateId ?? ""}>
                <option value="">—</option>
                {delegates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </W>
          )}
          <W full label="Produits ciblés"><Input name="targetProducts" defaultValue={d?.targetProducts} /></W>
          <W full label="Notes"><Textarea name="comments" defaultValue={d?.comments} rows={2} /></W>
        </div>
        {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}

function SpecialtiesManager({ specialties, canDelete, onClose }: { specialties: SpecialtyDTO[]; canDelete: boolean; onClose: () => void }) {
  const { saving, err, setErr, submit } = useSubmit();
  const [editing, setEditing] = React.useState<SpecialtyDTO | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#0ea5e9");

  const start = (s: SpecialtyDTO | null) => { setEditing(s); setName(s?.name ?? ""); setColor(s?.color ?? "#0ea5e9"); setErr(null); };

  const save = () => {
    const fd = new FormData();
    fd.set("name", name); fd.set("color", color);
    if (editing) { fd.set("id", editing.id); submit(() => updateSpecialty(fd), () => start(null)); }
    else submit(() => createSpecialty(fd), () => { setName(""); });
  };

  return (
    <Sheet open onClose={onClose} title="Spécialités médicales" description="La liste de référence : Cardiologie, Oncologie, etc." width="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">{editing ? "Modifier la spécialité" : "Nouvelle spécialité"}</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5"><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Cardiologie" /></div>
            <div className="space-y-1.5"><Label>Couleur</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-input" /></div>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? "Enregistrer" : "Ajouter"}</Button>
            {editing && <Button variant="outline" onClick={() => start(null)}>Annuler</Button>}
          </div>
          {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        </div>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {specialties.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Aucune spécialité.</li>}
          {specialties.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#64748b" }} />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.count} médecin{s.count > 1 ? "s" : ""}</span>
              <button onClick={() => start(s)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              {canDelete && (
                <button
                  onClick={() => { if (window.confirm(`Supprimer « ${s.name} » ? Les médecins rattachés passeront en « Sans spécialité ».`)) { const fd = new FormData(); fd.set("id", s.id); submit(() => deleteSpecialty(fd), () => undefined); } }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                ><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
