"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateEmployee } from "@/lib/actions/hr-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { CONTRACT_TYPE } from "@/lib/labels";

type Option = { value: string; label: string };

export interface EmployeeFormValues {
  id: string;
  fullName: string;
  position: string;
  department: string;
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
  managerId: string;
  userId: string;
  isActive: boolean;
}

interface Props {
  employee: EmployeeFormValues;
  managerOptions: Option[];
  userOptions: Option[];
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

export function EmployeeForm({ employee, managerOptions, userOptions }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const contractOptions = Object.entries(CONTRACT_TYPE).map(([value, label]) => ({ value, label }));

  return (
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
      <div className="grid grid-cols-2 gap-3">
        <TextInput name="fullName" label="Nom complet" defaultValue={employee.fullName} full required />
        <TextInput name="position" label="Poste" defaultValue={employee.position} />
        <TextInput name="department" label="Département" defaultValue={employee.department} />
        <SelectInput name="contractType" label="Type de contrat" defaultValue={employee.contractType} options={contractOptions} />
        <TextInput name="leaveBalanceDays" label="Solde congés (jours)" type="number" defaultValue={employee.leaveBalanceDays} />

        {/* Rémunération (bulletin). Côté salarié : brut, Ret SS 35 % et TFP restent invisibles. */}
        <p className="col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rémunération (bulletin de paie)</p>
        <TextInput name="baseSalary" label="Salaire de base (DZD)" type="number" defaultValue={employee.baseSalary} />
        <TextInput name="grossSalary" label="Salaire brut (confidentiel)" type="number" defaultValue={employee.grossSalary} />
        <TextInput name="retSS9" label="Ret. SS 9 %" type="number" defaultValue={employee.retSS9} />
        <TextInput name="retSS35" label="Ret. SS 35 % (confidentiel)" type="number" defaultValue={employee.retSS35} />
        <TextInput name="tfp" label="TFP — taxe formation prof. (confidentiel)" type="number" defaultValue={employee.tfp} />
        <TextInput name="retIrg" label="Ret. IRG" type="number" defaultValue={employee.retIrg} />
        <TextInput name="expenseRefund" label="Remb. frais" type="number" defaultValue={employee.expenseRefund} />
        <TextInput name="netToPay" label="Net à payer" type="number" defaultValue={employee.netToPay} />
        <TextInput name="hireDate" label="Date d'embauche" type="date" defaultValue={employee.hireDate} />
        <TextInput name="contractStart" label="Début de contrat" type="date" defaultValue={employee.contractStart} />
        <TextInput name="contractEnd" label="Fin de contrat" type="date" defaultValue={employee.contractEnd} />
        <TextInput name="trialStart" label="Période d'essai — début" type="date" defaultValue={employee.trialStart} />
        <TextInput name="trialEnd" label="Période d'essai — fin" type="date" defaultValue={employee.trialEnd} />
        <label className="flex items-center gap-2 text-sm sm:col-span-1">
          <input type="checkbox" name="trialRenewable" defaultChecked={employee.trialRenewable} className="h-4 w-4 rounded border-border accent-primary" />
          Période d'essai renouvelable
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-1">
          <input type="checkbox" name="trialRenewed" defaultChecked={employee.trialRenewed} className="h-4 w-4 rounded border-border accent-primary" />
          Renouvelée (2ᵉ période)
        </label>
        <TextInput name="trialRenewalStart" label="2ᵉ période — début" type="date" defaultValue={employee.trialRenewalStart} />
        <TextInput name="trialRenewalEnd" label="2ᵉ période — fin" type="date" defaultValue={employee.trialRenewalEnd} />
        <TextInput name="birthDate" label="Date de naissance" type="date" defaultValue={employee.birthDate} />
        <TextInput name="email" label="Email" defaultValue={employee.email} />
        <TextInput name="phone" label="Téléphone" defaultValue={employee.phone} />
        <TextInput name="iban" label="RIB / IBAN" defaultValue={employee.iban} />
        <TextInput name="nationalId" label="NIN" defaultValue={employee.nationalId} />
        <TextInput name="cnasNumber" label="N° CNAS" defaultValue={employee.cnasNumber} />
        <TextInput name="address" label="Adresse" defaultValue={employee.address} full />
        <SelectInput name="managerId" label="Manager (N+1)" defaultValue={employee.managerId} options={managerOptions} />
        <SelectInput name="userId" label="Compte applicatif lié" defaultValue={employee.userId} options={userOptions} placeholder="Aucun" />
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
  );
}
