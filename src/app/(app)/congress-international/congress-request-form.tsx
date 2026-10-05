"use client";

import * as React from "react";
import { useAutoOpen } from "@/components/shared/use-auto-open";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, X, Search, Check, UserPlus } from "lucide-react";
import { createCongressRequest } from "@/lib/actions/congress-request-actions";
import { creerProfilProfessionnel } from "@/lib/actions/care-actions";
import { listBeneficiaryRefs } from "@/lib/actions/congress-beneficiary-actions";
import { filtrerAnnuaire, PLAFOND_MENU } from "@/components/care/filtrer-annuaire";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { wilayaOptions } from "@/lib/geo/algeria";
import { NATIONAL_EVENT_TYPE, ROLE_LABELS } from "@/lib/labels";
import { businessUnitField } from "@/lib/ad-pro/create-fields";
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
  businessUnits = [], businessUnitDeduite = null,
}: CongressRequestFormProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [pickedDoctors, setPickedDoctors] = React.useState<Set<string>>(new Set());
  const [pickedUsers, setPickedUsers] = React.useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = React.useState("");

  /*
   * NI SPÉCIALITÉ NI PRODUITS sur une prise en charge (décision de la Direction, 04/10/2026). La
   * spécialité filtrait la liste des médecins : la liste se CHERCHE désormais, par nom, spécialité ou
   * établissement, dans tout l'annuaire.
   */
  const [annuaire, setAnnuaire] = React.useState<DoctorOpt[]>(doctors);
  const [doctorQuery, setDoctorQuery] = React.useState("");
  const champGamme = React.useMemo(
    () => businessUnitField(businessUnits, businessUnitDeduite)[0] ?? null,
    [businessUnits, businessUnitDeduite],
  );
  const trouves = React.useMemo(
    () => filtrerAnnuaire(annuaire.map((d) => ({ ...d, institution: d.city })), doctorQuery),
    [annuaire, doctorQuery],
  );
  const doctorById = React.useMemo(() => new Map(annuaire.map((d) => [d.id, d])), [annuaire]);
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
    // Tout ce qui manque, en une fois — le serveur dit la même chose (`createCongressRequest`).
    const manque = [
      String(fd.get("name") ?? "").trim() ? null : "le nom de l'événement",
      String(fd.get(national ? "date" : "startDate") ?? "") ? null : "la date de début",
      String(fd.get("endDate") ?? "") ? null : "la date de fin",
    ].filter((x): x is string => x !== null);
    if (manque.length > 0) { setErr(`À renseigner : ${manque.join(", ")}.`); return; }
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
          {national ? (
            <>
              {/* LA VILLE SE CHOISIT, elle ne se tape plus : on lisait « Alger », « alger »,
                  « ALGER », « Algiers » dans la même colonne — remplie, mais inexploitable. Plus de
                  « Pays » sur une prise en charge NATIONALE (décision du 04/10/2026). */}
              <Field label="Ville (wilaya)">
                <Select name="city" defaultValue="">
                  <option value="">— Choisir la wilaya —</option>
                  {WILAYA_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Select>
              </Field>
              <Field label="Institution hôte"><Input name="hostInstitution" placeholder="Hôpital / association" /></Field>
              <Field label="Date de début" required><Input name="date" type="date" required /></Field>
              <Field label="Date de fin" required><Input name="endDate" type="date" required /></Field>
            </>
          ) : (
            <>
              <Field label="Pays"><Input name="country" /></Field>
              <Field label="Ville (wilaya)">
                <Select name="city" defaultValue="">
                  <option value="">— Choisir la wilaya —</option>
                  {WILAYA_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Select>
              </Field>
              <Field label="Date de début" required><Input name="startDate" type="date" required /></Field>
              <Field label="Date de fin" required><Input name="endDate" type="date" required /></Field>
            </>
          )}
          <Field label="Budget estimé (DZD)"><Input name="estimatedBudget" type="number" step="any" placeholder="Estimation du demandeur" /></Field>
        </div>

        {/* LES PROFESSIONNELS PROPOSÉS POUR LA PRISE EN CHARGE — un menu AVEC RECHERCHE dans
            l'annuaire, et la création d'un profil pour un médecin qui n'y figure pas. Ce sont des
            PROPOSITIONS : la Direction tranche personne par personne sur la fiche, où la MÊME liste
            se complète (personne libre comprise) et où leurs pièces se demandent et se suivent. */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>Professionnels proposés pour la prise en charge</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={doctorQuery} onChange={(e) => setDoctorQuery(e.target.value)} placeholder="Rechercher un praticien (nom, spécialité, ville)…" className="pl-8" aria-label="Rechercher un praticien" />
          </div>
          <div className="max-h-44 space-y-1 overflow-auto rounded-md bg-muted/30 p-2">
            {trouves.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Aucun praticien ne correspond — créez son profil ci-dessous.</p>
            ) : trouves.map((d) => (
              <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                <input type="checkbox" checked={pickedDoctors.has(d.id)} onChange={() => toggle(pickedDoctors, d.id, setPickedDoctors)} className="h-4 w-4 rounded border-input" />
                <span>{d.name}</span>{(d.specialty || d.city) && <span className="text-xs text-muted-foreground">· {[d.specialty, d.city].filter(Boolean).join(" · ")}</span>}
              </label>
            ))}
            {trouves.length >= PLAFOND_MENU && <p className="px-1 text-[0.6875rem] text-muted-foreground">Les {PLAFOND_MENU} premiers seulement — précisez la recherche.</p>}
          </div>
          {pickedDoctors.size > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[...pickedDoctors].map((id) => (
                <Chip key={id} label={doctorById.get(id)?.name ?? id} onRemove={() => toggle(pickedDoctors, id, setPickedDoctors)} />
              ))}
            </div>
          )}
          <NouveauProfil
            scope={national ? "NATIONAL" : "INTERNATIONAL"}
            onCree={(d) => {
              setAnnuaire((a) => [d, ...a]);
              setPickedDoctors((p) => new Set(p).add(d.id));
            }}
          />
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
        description={"Renseignez l\u2019\u00e9v\u00e9nement et les professionnels propos\u00e9s pour la prise en charge."}
        width="lg"
      >
        <CongressRequestForm {...props} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/**
 * CRÉER LE PROFIL D'UN MÉDECIN qui n'est pas encore à l'annuaire — il y entre tout de suite, et il
 * est coché parmi les professionnels proposés. Pas de `<form>` imbriqué : le formulaire parent
 * enverrait la demande à la place du profil.
 */
function NouveauProfil({ scope, onCree }: { scope: "NATIONAL" | "INTERNATIONAL"; onCree: (d: DoctorOpt) => void }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [nom, setNom] = React.useState("");
  const [specialite, setSpecialite] = React.useState("");
  const [etablissement, setEtablissement] = React.useState("");
  const [secteur, setSecteur] = React.useState("");
  const [refs, setRefs] = React.useState<{ specialties: { id: string; name: string }[]; institutions: { id: string; name: string; wilaya: string | null }[] } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!ouvert || refs) return;
    listBeneficiaryRefs().then((r) => setRefs({ specialties: r.specialties, institutions: r.institutions })).catch(() => setRefs({ specialties: [], institutions: [] }));
  }, [ouvert, refs]);

  if (!ouvert) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(true)}>
        <UserPlus className="h-4 w-4" /> Créer un profil de médecin
      </Button>
    );
  }
  const creer = async () => {
    if (!nom.trim()) { setErreur("Le nom du médecin est obligatoire."); return; }
    const fd = new FormData();
    fd.set("scope", scope);
    fd.set("doctorName", nom);
    if (specialite) fd.set("specialtyId", specialite);
    if (etablissement) fd.set("institutionId", etablissement);
    if (secteur) fd.set("sector", secteur);
    setBusy(true); setErreur(null);
    const r = await creerProfilProfessionnel(undefined, fd);
    setBusy(false);
    if (!r.ok || !r.id) { setErreur(r.error ?? "Le profil n'a pas pu être créé."); return; }
    onCree({
      id: r.id, name: r.message ?? nom.trim(),
      specialty: refs?.specialties.find((x) => x.id === specialite)?.name ?? "",
      city: refs?.institutions.find((x) => x.id === etablissement)?.name ?? "",
    });
    setNom(""); setSpecialite(""); setEtablissement(""); setSecteur(""); setOuvert(false);
  };
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-border p-2 sm:grid-cols-2">
      <div className="sm:col-span-2"><Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du médecin" aria-label="Nom du médecin" /></div>
      <Select value={specialite} onChange={(e) => setSpecialite(e.target.value)} aria-label="Spécialité du médecin">
        <option value="">— Spécialité —</option>
        {(refs?.specialties ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </Select>
      <Select value={secteur} onChange={(e) => setSecteur(e.target.value)} aria-label="Secteur du médecin">
        <option value="">— Secteur —</option>
        <option value="HOSPITAL">Hospitalier</option><option value="LIBERAL">Libéral</option><option value="BOTH">Les deux</option>
      </Select>
      <div className="sm:col-span-2">
        <Select value={etablissement} onChange={(e) => setEtablissement(e.target.value)} aria-label="Établissement du médecin">
          <option value="">— Établissement —</option>
          {(refs?.institutions ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.wilaya ? ` · ${x.wilaya}` : ""}</option>)}
        </Select>
      </div>
      {erreur && <p className="text-xs text-destructive sm:col-span-2">{erreur}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="button" size="sm" onClick={() => void creer()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Créer et proposer</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(false)}>Annuler</Button>
      </div>
    </div>
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
