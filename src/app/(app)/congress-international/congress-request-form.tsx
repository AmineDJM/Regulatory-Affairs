"use client";

import * as React from "react";
import { useAutoOpen } from "@/components/shared/use-auto-open";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, X, Search, Check } from "lucide-react";
import { createCongressRequest } from "@/lib/actions/congress-request-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { wilayaOptions } from "@/lib/geo/algeria";
import { NATIONAL_EVENT_TYPE, ROLE_LABELS } from "@/lib/labels";
import { MultiSelectField } from "@/components/shared/create-record-button";
import { businessUnitField, champProduits, specialtyField } from "@/lib/ad-pro/create-fields";
import type { ProductRow, SpecialtyRow } from "@/lib/ad-pro/pickers";

const WILAYA_OPTIONS = wilayaOptions();

export interface DoctorOpt { id: string; name: string; specialty: string; city: string }
export interface UserOpt { id: string; name: string; role: string }


export interface CongressFormProps {
  national?: boolean;
  doctors: DoctorOpt[];
  users: UserOpt[];
  /**
   * LES RÉFÉRENTIELS — produits promouvables, spécialités, gammes. Facultatifs dans le TYPE et
   * non dans l'écran : les trois points de montage les passent tous, et un défaut vide fait
   * retomber chaque champ sur son repli plutôt que d'échouer au rendu.
   */
  products?: ProductRow[];
  specialties?: SpecialtyRow[];
  specialtiesHeritees?: string[];
  businessUnits?: { id: string; name: string }[];
  businessUnitDeduite?: { id: string; name: string; raison: string } | null;
}

interface CongressRequestFormProps extends CongressFormProps {
  /** Demande envoyée — l'appelant referme le panneau qui porte ce formulaire. */
  onDone: () => void;
  /** Bouton secondaire : fermer ici, revenir au choix de la nature depuis Ad & Pro. */
  onCancel: () => void;
  cancelLabel?: string;
}

/**
 * LE FORMULAIRE SEUL, sans son bouton ni son panneau.
 *
 * Il se monte à deux endroits : l'écran de la nature (via `CongressRequestButton`) et le panneau
 * commun d'Ad & Pro, où la nature vient d'être choisie — on y ouvrirait sinon un panneau
 * par-dessus le panneau.
 */
export function CongressRequestForm({
  national, doctors, users, onDone, onCancel, cancelLabel = "Annuler",
  products = [], specialties = [], specialtiesHeritees = [], businessUnits = [], businessUnitDeduite = null,
}: CongressRequestFormProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [specialty, setSpecialty] = React.useState("");
  const [pickedDoctors, setPickedDoctors] = React.useState<Set<string>>(new Set());
  const [pickedUsers, setPickedUsers] = React.useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = React.useState("");

  /*
   * LA SPÉCIALITÉ EST UN SEUL FAIT — le formulaire en portait DEUX.
   *
   * Il y avait un menu « Choisir une spécialité » SANS `name` (un simple filtre de la liste des
   * médecins) et, trois lignes plus haut, un champ texte libre « Spécialité (thème) » nommé
   * `specialty`. La personne choisissait donc « Cardiologie » pour voir ses praticiens, puis
   * devait la RETAPER pour que la demande la porte — et deux orthographes entraient en base pour
   * la même spécialité, ce que le référentiel existe précisément pour éviter.
   *
   * La liste vient de la fonction canonique (`specialtyField` → `specialtyOptions`) : référentiel
   * `MedicalSpecialty` fusionné aux libellés HÉRITÉS des fiches non rattachées. Une liste
   * construite ici à partir des seuls médecins chargés serait une seconde vérité, plus pauvre
   * (§118.5). Référentiel ET fiches vides : le champ redevient une saisie libre, et le filtre
   * disparaît avec la liste — filtrer sur une liste vide ne montrerait aucun médecin.
   */
  const champSpecialite = React.useMemo(
    () => specialtyField(specialties, specialtiesHeritees)[0],
    [specialties, specialtiesHeritees],
  );
  const optionsSpecialite = React.useMemo(
    () => (champSpecialite.type === "select" ? champSpecialite.options : []),
    [champSpecialite],
  );
  const champProduit = React.useMemo(() => champProduits({ products, obligatoire: false }), [products]);
  const champGamme = React.useMemo(
    () => businessUnitField(businessUnits, businessUnitDeduite)[0] ?? null,
    [businessUnits, businessUnitDeduite],
  );
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

  const submit = async () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("type", national ? "NATIONAL" : "INTL");
    pickedDoctors.forEach((id) => fd.append("invitedDoctorIds", id));
    pickedUsers.forEach((id) => fd.append("participantIds", id));
    if (!String(fd.get("name") ?? "").trim()) { setErr("Le nom de l'événement est obligatoire."); return; }
    setSaving(true); setErr(null);
    const r = await createCongressRequest(undefined, fd);
    setSaving(false);
    if (r.ok) { onDone(); router.refresh(); if (r.id) router.push(`${national ? "/congress-national" : "/congress-international"}/${r.id}`); }
    else setErr(r.error ?? "Erreur.");
  };

  return (
    <form ref={formRef} action={submit} className="space-y-5">
        {/* Infos générales */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* LA GAMME QUI PORTE LA DEMANDE — le champ MANQUAIT sur ce formulaire, alors que
              l'action le lisait déjà : les deux prises en charge sortaient donc sans gamme, et
              leur dépense n'était rattachable à aucune équipe (§118.108, §118.140). La décision
              (options, obligation, gamme déduite du demandeur, disparition quand aucune gamme
              n'existe) vient du module partagé — seul le rendu est local. */}
          {champGamme && champGamme.type === "select" && (
            <Field full label={champGamme.label} required={champGamme.required}>
              <Select name={champGamme.name} required={champGamme.required} defaultValue={typeof champGamme.defaultValue === "string" ? champGamme.defaultValue : ""}>
                {!champGamme.defaultValue && <option value="">{champGamme.placeholder ?? "— Choisir —"}</option>}
                {champGamme.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {champGamme.hint && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{champGamme.hint}</p>}
            </Field>
          )}
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
          {/* UN SEUL CHAMP DE SPÉCIALITÉ, et c'est lui qui filtre les médecins plus bas : le
              formulaire en portait deux (un menu de filtre sans nom, un texte libre nommé),
              donc on choisissait puis on RETAPAIT. */}
          <Field label="Spécialité (thème)">
            {optionsSpecialite.length > 0 ? (
              <Select name="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                <option value="">— Choisir la spécialité —</option>
                {optionsSpecialite.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : (
              <Input name="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex. Infectiologie" />
            )}
          </Field>
          {national ? (
            <>
              <Field label="Pays"><Input name="country" placeholder="Algérie" /></Field>
              {/* LA VILLE SE CHOISIT, elle ne se tape plus : on lisait « Alger », « alger »,
                  « ALGER », « Algiers » dans la même colonne — remplie, mais inexploitable. */}
              <Field label="Ville (wilaya)">
                <Select name="city" defaultValue="">
                  <option value="">— Choisir la wilaya —</option>
                  {WILAYA_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Select>
              </Field>
              <Field label="Institution hôte"><Input name="hostInstitution" placeholder="Hôpital / association" /></Field>
              <Field label="Date"><Input name="date" type="date" /></Field>
            </>
          ) : (
            <>
              <Field label="Pays"><Input name="country" /></Field>
              {/* LA VILLE SE CHOISIT, elle ne se tape plus : on lisait « Alger », « alger »,
                  « ALGER », « Algiers » dans la même colonne — remplie, mais inexploitable. */}
              <Field label="Ville (wilaya)">
                <Select name="city" defaultValue="">
                  <option value="">— Choisir la wilaya —</option>
                  {WILAYA_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Select>
              </Field>
              <Field label="Date début"><Input name="startDate" type="date" /></Field>
              <Field label="Date fin"><Input name="endDate" type="date" /></Field>
            </>
          )}
          <Field label="Budget estimé (DZD)"><Input name="estimatedBudget" type="number" step="any" placeholder="Estimation du demandeur" /></Field>
          {/* LE OU LES PRODUITS CONCERNÉS — le champ demandé par la Direction, et la colonne
              existait des deux côtés sans que rien ne l'écrive (§118.14). Le champ vient du
              module partagé : seuls les dossiers réglementaires au traitement TERMINÉ sont
              proposés, parce que promouvoir un dossier en cours est une faute réglementaire. */}
          {champProduit.type === "multiselect" ? (
            <Field full label={champProduit.label}>
              <MultiSelectField field={champProduit} />
            </Field>
          ) : champProduit.type === "text" ? (
            <Field full label={champProduit.label}>
              <Input name={champProduit.name} placeholder="Nom du produit" />
              {champProduit.hint && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{champProduit.hint}</p>}
            </Field>
          ) : null}
        </div>

        {/* Médecins invités : spécialité → liste */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>Médecins invités</Label>
          <p className="text-xs text-muted-foreground">
            La liste suit la <strong>spécialité</strong> choisie plus haut. Facultatif : les personnes
            prises en charge s&apos;ajoutent ensuite sur la fiche.
          </p>
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
          <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Envoyer la demande</Button>
        </div>
      </form>
  );
}

/**
 * Le bouton de l'écran Prises en charge : déclencheur et panneau autour du formulaire.
 *
 * Le formulaire se remonte à chaque ouverture — les médecins cochés et l'erreur affichée
 * la fois précédente ne reviennent donc pas accueillir la demande suivante.
 */
export function CongressRequestButton(props: CongressFormProps) {
  const [open, setOpen] = React.useState(false);
  // Lien direct `?new=1` vers ce formulaire — voir `useAutoOpen`.
  useAutoOpen("new", () => setOpen(true));
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle demande</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={props.national ? "Nouvelle prise en charge \u2014 nationale" : "Nouvelle prise en charge \u2014 internationale"}
        description={"Renseignez l\u2019\u00e9v\u00e9nement, puis ajoutez les personnes \u00e0 prendre en charge sur la fiche."}
        width="lg"
      >
        <CongressRequestForm {...props} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function Field({ label, full, required, children }: { label: string; full?: boolean; required?: boolean; children: React.ReactNode }) {
  return (
    // `sm:col-span-2` ET NON `col-span-2` : la grille passe à UNE colonne sous le point de
    // rupture (le garde-fou responsive l'exige), et un `col-span-2` non préfixé y déborderait
    // donc de sa grille — un défilement latéral sur mobile, exactement ce que la règle ferme.
    <div className={full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
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
