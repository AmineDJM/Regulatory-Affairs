"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { createRegulatoryProduct, type ActionResult } from "@/lib/actions/regulatory-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField, TextAreaField, SelectField, optionsFromMap } from "@/components/shared/form-fields";
import { DciAssociationField } from "./dci-field";
import { MANUFACTURING_STATUS, REGULATORY_CATEGORY, PRODUCT_CHANNEL, PRIORITY, REGULATORY_STATUS, ROLE_LABELS, PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export function NewProductButton({ users, suppliers, companies }: { users: UserOption[]; suppliers: { id: string; name: string }[]; companies: { id: string; name: string; shortName: string | null }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(
    createRegulatoryProduct,
    undefined,
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setSubmitting(false);
      router.refresh();
      if (state.id) router.push(`/regulatory/${state.id}`);
    } else if (state?.error) {
      setSubmitting(false);
    }
  }, [state, router]);

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.name} — ${ROLE_LABELS[u.role] ?? u.role}`,
  }));

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nouveau dossier
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau dossier réglementaire"
        description="Le workflow en 17 étapes est créé automatiquement."
        width="lg"
      >
        <form
          action={(fd) => {
            setSubmitting(true);
            formAction(fd);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Catégorie" name="category" options={optionsFromMap(REGULATORY_CATEGORY)} defaultValue="MEDICINE" />
            <SelectField label="Canal (Ville / Hôpital)" name="channel" options={optionsFromMap(PRODUCT_CHANNEL)} defaultValue="BOTH" />
            <SelectField label="Entité" name="companyId" options={companies.map((c) => ({ value: c.id, label: c.shortName || c.name }))} placeholder="— Entité —" />
            <DciAssociationField />
            <TextField label="Nom commercial envisagé" name="brandName" placeholder="Ex. Adventor" className="col-span-2" />
            <TextField label="Dosage" name="dosage" placeholder="20" />
            <SelectField label="Unité" name="dosageUnit" options={optionsFromMap(DOSAGE_UNIT)} placeholder="—" />
            <SelectField label="Forme pharmaceutique" name="pharmaceuticalForm" options={optionsFromMap(PHARMA_FORM)} placeholder="—" />
            <TextField label="Classe thérapeutique" name="therapeuticClass" placeholder="Hypolipémiant" />
            <SelectField label="Fournisseur" name="supplierId" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="— Aucun —" />
            <TextField label="Laboratoire partenaire (optionnel)" name="partnerLab" placeholder="Ex. Pharma Lab" />
            <TextField label="Pays d'origine" name="countryOfOrigin" placeholder="Inde" />
            <SelectField label="Statut de fabrication" name="manufacturingStatus" options={optionsFromMap(MANUFACTURING_STATUS)} defaultValue="IMPORTATION" />
            <SelectField label="Priorité" name="priority" options={optionsFromMap(PRIORITY)} defaultValue="MEDIUM" />
            <SelectField label="Statut initial" name="status" options={optionsFromMap(REGULATORY_STATUS)} defaultValue="PRE_SUBMISSION" />
            <SelectField label="Responsable" name="responsibleId" options={userOptions} placeholder="—" />
            <SelectField label="Assistante assignée" name="assistantId" options={userOptions} placeholder="—" />
            <TextField label="Date cible d'enregistrement" name="targetDate" type="date" className="col-span-2" />
            <TextField label="Détenteur de DE" name="deHolder" placeholder="Titulaire de la décision d'enregistrement" className="col-span-2" />
          </div>
          <TextAreaField label="Commentaires" name="comments" placeholder="Notes internes…" />

          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le dossier
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
