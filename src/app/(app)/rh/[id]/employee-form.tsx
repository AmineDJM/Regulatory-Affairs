"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Wand2, Sparkles } from "lucide-react";
import { updateEmployee, analyzeEmployeeContract } from "@/lib/actions/hr-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { CONTRACT_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export interface EmployeeFormValues {
  id: string;
  fullName: string;
  position: string;
  department: string;
  departmentId: string;
  contractType: string;
  baseSalary: string;
  retSS9: string;
  retSS35: string;
  tfp: string;
  retIrg: string;
  expenseRefund: string;
  netToPay: string;
  grossSalary: string;
  leaveBalanceDays: string;
  hireDate: string;
  contractStart: string;
  contractEnd: string;
  trialStart: string;
  trialEnd: string;
  trialRenewable: boolean;
  trialRenewed: boolean;
  trialRenewalStart: string;
  trialRenewalEnd: string;
  birthDate: string;
  email: string;
  phone: string;
  iban: string;
  nationalId: string;
  cnasNumber: string;
  address: string;
  companyId: string;
  managerId: string;
  userId: string;
  isActive: boolean;
}

interface Props {
  employee: EmployeeFormValues;
  managerOptions: Option[];
  departmentOptions: Option[];
  userOptions: Option[];
  companyOptions: Option[];
  aiConfigured: boolean;
}

function TextInput({ name, label, type = "text", defaultValue, full, required }: { name: string; label: string; type?: string; defaultValue?: string; full?: boolean; required?: boolean }) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label htmlFor={name}>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} step={type === "number" ? "any" : undefined} />
    </div>
  );
}

function SelectInput({ name, label, defaultValue, options, placeholder }: { name: string; label: string; defaultValue?: string; options: Option[]; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={defaultValue}>
        <option value="">{placeholder ?? "—"}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}

export function EmployeeForm({ employee, managerOptions, departmentOptions, userOptions, companyOptions, aiConfigured }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Pré-remplissage IA depuis un contrat : les valeurs extraites priment sur les valeurs
  // actuelles ; le RH relit et corrige avant d'enregistrer. Re-montage des champs par `key`.
  const [prefill, setPrefill] = React.useState<Record<string, string>>({});
  const [prefillVersion, setPrefillVersion] = React.useState(0);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeMsg, setAnalyzeMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const contractOptions = Object.entries(CONTRACT_TYPE).map(([value, label]) => ({ value, label }));
  const v = { ...employee, ...prefill } as unknown as Record<string, string>;

  async function runAnalyze() {
    const f = fileRef.current?.files?.[0];
    if (!f) { setAnalyzeMsg({ ok: false, text: "Choisissez d'abord le contrat (PDF ou image)." }); return; }
    setAnalyzing(true); setAnalyzeMsg(null);
    const fd = new FormData(); fd.set("file", f);
    const r = await analyzeEmployeeContract(fd);
    setAnalyzing(false);
    if (!r.ok) { setAnalyzeMsg({ ok: false, text: r.error ?? "Analyse impossible." }); return; }
    setPrefill((p) => ({ ...p, ...(r.values ?? {}) }));
    setPrefillVersion((n) => n + 1);
    setAnalyzeMsg({ ok: true, text: `${Object.keys(r.values ?? {}).length} champ(s) mis à jour — vérifiez et enregistrez.` });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Wand2 className="h-4 w-4" /> Compléter depuis un contrat de travail (IA)</p>
        <p className="text-xs text-muted-foreground">Téléversez le contrat (PDF ou image) : l&apos;OCR Mistral + l&apos;IA extraient et pré-remplissent les champs. Tout reste modifiable avant enregistrement.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff" disabled={!aiConfigured || analyzing}
            className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium" />
          <Button type="button" size="sm" onClick={runAnalyze} disabled={!aiConfigured || analyzing} title={aiConfigured ? undefined : "IA non configurée (ANTHROPIC_API_KEY)"}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analyser le contrat
          </Button>
        </div>
        {!aiConfigured && <p className="text-xs text-amber-700">IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render).</p>}
        {analyzeMsg && <p className={cn("text-xs", analyzeMsg.ok ? "text-success" : "text-destructive")}>{analyzeMsg.text}</p>}
      </div>

      <form
        action={async (fd) => {
          setSaving(true);
          await updateEmployee(fd);
          setSaving(false);
          setSaved(true);
          router.refresh();
          setTimeout(() => setSaved(false), 1500);
        }}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={employee.id} />
        <div key={prefillVersion} className="grid grid-cols-2 gap-3">
          <TextInput name="fullName" label="Nom complet" defaultValue={v.fullName} full required />
          <TextInput name="position" label="Poste" defaultValue={v.position} />
          <SelectInput name="departmentId" label="Département" defaultValue={v.departmentId} options={departmentOptions} placeholder="— Non affecté —" />
          <SelectInput name="companyId" label="Entité" defaultValue={v.companyId} options={companyOptions} placeholder="— Entité —" />
          <SelectInput name="contractType" label="Type de contrat" defaultValue={v.contractType} options={contractOptions} />
          <TextInput name="leaveBalanceDays" label="Solde congés (jours)" type="number" defaultValue={v.leaveBalanceDays} />

          {/* Rémunération (bulletin). Côté salarié : brut, Ret SS 35 % et TFP restent invisibles. */}
          <p className="col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rémunération (bulletin de paie)</p>
          <TextInput name="baseSalary" label="Salaire de base (DZD)" type="number" defaultValue={v.baseSalary} />
          <TextInput name="grossSalary" label="Salaire brut (confidentiel)" type="number" defaultValue={v.grossSalary} />
          <TextInput name="retSS9" label="Ret. SS 9 %" type="number" defaultValue={v.retSS9} />
          <TextInput name="retSS35" label="Ret. SS 35 % (confidentiel)" type="number" defaultValue={v.retSS35} />
          <TextInput name="tfp" label="TFP — taxe formation prof. (confidentiel)" type="number" defaultValue={v.tfp} />
          <TextInput name="retIrg" label="Ret. IRG" type="number" defaultValue={v.retIrg} />
          <TextInput name="expenseRefund" label="Remb. frais" type="number" defaultValue={v.expenseRefund} />
          <TextInput name="netToPay" label="Net à payer" type="number" defaultValue={v.netToPay} />
          <TextInput name="hireDate" label="Date d'embauche" type="date" defaultValue={v.hireDate} />
          <TextInput name="contractStart" label="Début de contrat" type="date" defaultValue={v.contractStart} />
          <TextInput name="contractEnd" label="Fin de contrat" type="date" defaultValue={v.contractEnd} />
          <TextInput name="trialStart" label="Période d'essai — début" type="date" defaultValue={v.trialStart} />
          <TextInput name="trialEnd" label="Période d'essai — fin" type="date" defaultValue={v.trialEnd} />
          <label className="flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" name="trialRenewable" defaultChecked={employee.trialRenewable} className="h-4 w-4 rounded border-border accent-primary" />
            Période d'essai renouvelable
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" name="trialRenewed" defaultChecked={employee.trialRenewed} className="h-4 w-4 rounded border-border accent-primary" />
            Renouvelée (2ᵉ période)
          </label>
          <TextInput name="trialRenewalStart" label="2ᵉ période — début" type="date" defaultValue={v.trialRenewalStart} />
          <TextInput name="trialRenewalEnd" label="2ᵉ période — fin" type="date" defaultValue={v.trialRenewalEnd} />
          <TextInput name="birthDate" label="Date de naissance" type="date" defaultValue={v.birthDate} />
          <TextInput name="email" label="Email" defaultValue={v.email} />
          <TextInput name="phone" label="Téléphone" defaultValue={v.phone} />
          <TextInput name="iban" label="RIB / IBAN" defaultValue={v.iban} />
          <TextInput name="nationalId" label="NIN" defaultValue={v.nationalId} />
          <TextInput name="cnasNumber" label="N° CNAS" defaultValue={v.cnasNumber} />
          <TextInput name="address" label="Adresse" defaultValue={v.address} full />
          <SelectInput name="managerId" label="Manager (N+1)" defaultValue={v.managerId} options={managerOptions} />
          <SelectInput name="userId" label="Compte applicatif lié" defaultValue={v.userId} options={userOptions} placeholder="Aucun" />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={employee.isActive} className="h-4 w-4 rounded border-input" />
            Employé actif
          </label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
            {saved ? "Enregistré" : "Enregistrer les modifications"}
          </Button>
        </div>
      </form>
    </div>
  );
}
