"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, AlertCircle } from "lucide-react";
import { updateRegulatoryProduct, type ActionResult } from "@/lib/actions/regulatory-actions";
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

export interface EditProductValues {
  id: string;
  molecules: string[];
  brandName: string | null;
  dosage: string | null;
  dosageUnit: string | null;
  pharmaceuticalForm: string | null;
  therapeuticClass: string | null;
  partnerLab: string | null;
  supplierId: string | null;
  countryOfOrigin: string | null;
  category: string;
  channel: string;
  manufacturingStatus: string;
  status: string;
  priority: string;
  responsibleId: string | null;
  assistantId: string | null;
  targetDate: string | null;
  comments: string | null;
  deHolder: string | null;
  manufacturingVariation: string | null;
  manufacturer: string | null;
  variationDate: string | null;
}

export function EditProductButton({ product, users, suppliers }: { product: EditProductValues; users: UserOption[]; suppliers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(
    updateRegulatoryProduct,
    undefined,
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setSubmitting(false);
      router.refresh();
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Modifier
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Modifier le dossier réglementaire"
        description="Met à jour les informations descriptives. Le workflow et les étapes sont conservés."
        width="lg"
      >
        <form
          action={(fd) => {
            setSubmitting(true);
            formAction(fd);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={product.id} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Catégorie" name="category" options={optionsFromMap(REGULATORY_CATEGORY)} defaultValue={product.category} />
            <SelectField label="Canal (Ville / Hôpital)" name="channel" options={optionsFromMap(PRODUCT_CHANNEL)} defaultValue={product.channel} />
            <DciAssociationField defaultMolecules={product.molecules} />
            <TextField label="Nom commercial" name="brandName" placeholder="Ex. Adventor" defaultValue={product.brandName ?? undefined} className="col-span-2" />
            <TextField label="Dosage" name="dosage" placeholder="20" defaultValue={product.dosage ?? undefined} />
            <SelectField label="Unité" name="dosageUnit" options={optionsFromMap(DOSAGE_UNIT)} placeholder="—" defaultValue={product.dosageUnit ?? ""} />
            <SelectField label="Forme pharmaceutique" name="pharmaceuticalForm" options={optionsFromMap(PHARMA_FORM)} placeholder="—" defaultValue={product.pharmaceuticalForm ?? ""} />
            <TextField label="Classe thérapeutique" name="therapeuticClass" placeholder="Hypolipémiant" defaultValue={product.therapeuticClass ?? undefined} />
            <SelectField label="Fournisseur" name="supplierId" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="— Aucun —" defaultValue={product.supplierId ?? ""} />
            <TextField label="Laboratoire partenaire (optionnel)" name="partnerLab" placeholder="Ex. Pharma Lab" defaultValue={product.partnerLab ?? undefined} />
            <TextField label="Pays d'origine" name="countryOfOrigin" placeholder="Inde" defaultValue={product.countryOfOrigin ?? undefined} />
            <SelectField label="Statut de fabrication" name="manufacturingStatus" options={optionsFromMap(MANUFACTURING_STATUS)} defaultValue={product.manufacturingStatus} />
            <SelectField label="Priorité" name="priority" options={optionsFromMap(PRIORITY)} defaultValue={product.priority} />
            <SelectField label="Statut" name="status" options={optionsFromMap(REGULATORY_STATUS)} defaultValue={product.status} />
            <SelectField label="Responsable" name="responsibleId" options={userOptions} placeholder="—" defaultValue={product.responsibleId ?? ""} />
            <SelectField label="Assistante assignée" name="assistantId" options={userOptions} placeholder="—" defaultValue={product.assistantId ?? ""} />
            <TextField label="Date cible d'enregistrement" name="targetDate" type="date" defaultValue={product.targetDate ?? undefined} className="col-span-2" />

            {/* Décision d'enregistrement (les variations de fabrication se gèrent sur la fiche). */}
            <TextField label="Détenteur de DE" name="deHolder" placeholder="Titulaire de la décision d'enregistrement" defaultValue={product.deHolder ?? undefined} className="col-span-2" />
            <TextField label="Fabricant" name="manufacturer" placeholder="Site de fabrication" defaultValue={product.manufacturer ?? undefined} className="col-span-2" />
          </div>
          <TextAreaField label="Commentaires" name="comments" placeholder="Notes internes…" defaultValue={product.comments ?? undefined} />

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
              Enregistrer
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
