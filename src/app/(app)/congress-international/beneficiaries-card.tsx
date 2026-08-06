"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { Plus, Trash2, Loader2, IdCard, Bell, Hospital, UserPlus, Search } from "lucide-react";
import { addCongressBeneficiary, removeCongressBeneficiary, requestBeneficiaryIds, listBeneficiaryRefs } from "@/lib/actions/congress-beneficiary-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MEDICAL_SECTOR } from "@/lib/labels";
import { DocumentUpload } from "@/components/documents/document-upload";

export interface Beneficiary { id: string; name: string; role?: string; doctorId?: string; institution?: string }

interface Refs {
  doctors: { id: string; name: string; institution: string | null; specialty: string | null }[];
  specialties: { id: string; name: string }[];
  institutions: { id: string; name: string; city: string | null }[];
}

type Mode = "directory" | "new" | "free";

export function BeneficiariesCard({
  entityType, entityId, beneficiaries, idDocCount, canManage,
}: {
  entityType: EntityType;
  entityId: string;
  beneficiaries: Beneficiary[];
  idDocCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const kind = entityType === "CONGRESS_INTERNATIONAL" ? "INTERNATIONAL" : "NATIONAL";
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("directory");
  const [refs, setRefs] = React.useState<Refs | null>(null);
  const [q, setQ] = React.useState("");
  const [doctorId, setDoctorId] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (canManage && !refs) listBeneficiaryRefs().then(setRefs).catch(() => setRefs({ doctors: [], specialties: [], institutions: [] }));
  }, [canManage, refs]);

  const hidden = () => { const fd = new FormData(); fd.set("kind", kind); fd.set("id", entityId); return fd; };

  async function submit(fd: FormData) {
    fd.set("kind", kind); fd.set("id", entityId);
    if (mode === "directory") { if (!doctorId) { window.alert("Sélectionnez un praticien."); return; } fd.set("doctorId", doctorId); }
    if (mode === "new") fd.set("createDoctor", "on");
    setBusy(true);
    const r = await addCongressBeneficiary(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Ajout impossible."); return; }
    formRef.current?.reset(); setQ(""); setDoctorId(""); setRefs(null); router.refresh();
  }
  async function remove(benefId: string) {
    const fd = hidden(); fd.set("benefId", benefId);
    await removeCongressBeneficiary(fd); router.refresh();
  }
  async function requestIds() {
    setBusy(true); await requestBeneficiaryIds(hidden()); setBusy(false); router.refresh();
  }

  const filteredDoctors = (refs?.doctors ?? []).filter((d) =>
    !q.trim() || `${d.name} ${d.institution ?? ""} ${d.specialty ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  ).slice(0, 50);

  const tab = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><IdCard className="h-4 w-4" /> Personnes prises en charge</CardTitle>
        <Badge tone="neutral" dot={false}>{beneficiaries.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {beneficiaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune personne enregistrée. Sélectionnez des praticiens (ou créez leur profil) puis demandez leurs pièces d'identité.</p>
        ) : (
          <ul className="space-y-1.5">
            {beneficiaries.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{b.name}</span>
                  {b.role && <span className="text-xs text-muted-foreground"> · {b.role}</span>}
                  {b.doctorId && <Badge tone="info" dot={false} className="ml-1.5 text-[0.625rem]">annuaire</Badge>}
                  {b.institution && <span className="block truncate text-[0.6875rem] text-muted-foreground"><Hospital className="mr-1 inline h-3 w-3" />{b.institution}</span>}
                </span>
                {canManage && <button onClick={() => remove(b.id)} title="Retirer" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {tab("directory", "Depuis l'annuaire")}
              {tab("new", "Nouveau médecin")}
              {tab("free", "Personne libre")}
            </div>

            {mode === "directory" && (
              <form ref={formRef} action={submit} className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un praticien…" className="pl-7 text-sm" />
                </div>
                <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="text-sm">
                  <option value="">{refs ? "— Sélectionner un praticien —" : "Chargement…"}</option>
                  {filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.institution ? ` · ${d.institution}` : ""}</option>)}
                </Select>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Input name="role" placeholder="Qualité (orateur, invité…)" className="text-sm" /></div>
                  <Button type="submit" size="sm" disabled={busy || !doctorId}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
                </div>
              </form>
            )}

            {mode === "new" && (
              <form ref={formRef} action={submit} className="grid grid-cols-2 gap-2">
                <Input name="name" required placeholder="Nom du médecin" className="col-span-2 text-sm" />
                <Select name="specialtyId" defaultValue="" className="text-sm"><option value="">— Spécialité —</option>{(refs?.specialties ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                <Select name="sector" defaultValue="LIBERAL" className="text-sm">{Object.entries(MEDICAL_SECTOR).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</Select>
                <Select name="institutionId" defaultValue="" className="col-span-2 text-sm"><option value="">— Établissement —</option>{(refs?.institutions ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}{i.city ? ` · ${i.city}` : ""}</option>)}</Select>
                <Input name="role" placeholder="Qualité" className="text-sm" />
                <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Créer & ajouter</Button>
              </form>
            )}

            {mode === "free" && (
              <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1"><Input name="name" required placeholder="Nom et prénom" className="text-sm" /></div>
                <div className="min-w-[100px] flex-1"><Input name="role" placeholder="Qualité" className="text-sm" /></div>
                <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
              </form>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Pièces d'identité reçues : <span className="font-medium text-foreground">{idDocCount}</span> / {beneficiaries.length || "—"}</p>
          {canManage && (
            <>
              <DocumentUpload entityType={entityType} entityId={entityId} categories={["ID_DOCUMENT", "OTHER"]} compact />
              <Button type="button" size="sm" variant="outline" onClick={requestIds} disabled={busy}><Bell className="h-4 w-4" /> Demander les pièces d'identité</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
