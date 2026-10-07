"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfoBulle } from "@/components/ui/info-bulle";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { STATUTS, STATUT_LABELS, LETTRES_FORCABLES, affiniteAffichee, type Comparaison, type Lettre, type MethodeAffinite, type Statut } from "@/lib/segmentation/regles";
import { lettreProvisoire, enteteQ1, enteteQ2 } from "@/lib/segmentation/charge";
import {
  enregistrerPotentiel, changerStatut, forcerLettre, rendreLettreCalculee, changerSecteur, retirerDuPanel,
  ajouterAuPanel, chercherPraticiensHorsPanel, type PraticienTrouve,
} from "@/lib/actions/segmentation-actions";
import { LettreBadge } from "./lettre-badge";

/**
 * LES PRATICIENS — exactement les colonnes du classeur (Direction, 07/10) : Secteur, CDR, Spécialité, Nom, Prénom,
 * Grade, Statut, Q1, Q2, %, Potentiel. Q1, Q2 et le statut se modifient DANS la ligne ; la lettre se recalcule. Un
 * tableau reste un tableau au téléphone : il défile dans son cadre, le nom reste à gauche.
 */

export interface LignePraticien {
  doctorId: string;
  secteurId: string | null;
  secteurNom: string | null;
  secteurPose: boolean;
  etablissement: string | null;
  inOut: "IN" | "OUT" | null;
  specialite: string | null;
  nomFamille: string;
  prenom: string | null;
  grade: string;
  statut: Statut | null;
  q1: number | null;
  q2: number | null;
  /** null = aucune règle publiée. */
  lettre: Lettre | null;
  lettreCalculee: Lettre | null;
  forcee: { valeur: Lettre; motif: string } | null;
  pourquoi: string[];
}

/** Ce qu'il faut pour recalculer une lettre à l'écran, le temps que le serveur rende la sienne. */
export interface RegleEcran {
  hStatuts: Statut[];
  seuilPotentiel: number;
  seuilAffinite: number;
  comparaison: Comparaison;
  potentielNulNonCible: boolean;
  potentielNulNA: boolean;
  methode: MethodeAffinite;
  /** Seuil d'affinité propre à un secteur. */
  seuilParSecteur: Record<string, number>;
}

interface Droits { saisir: boolean; panel: boolean; valider: boolean; forcer: boolean }
type Local = { statut?: Statut | null; q1?: number | null; q2?: number | null };

const FILTRES_LETTRE: { v: string; l: string }[] = [
  { v: "H", l: "H" }, { v: "A", l: "A" }, { v: "B", l: "B" }, { v: "C", l: "C" }, { v: "D", l: "D" }, { v: "NA", l: "NA" }, { v: "NC", l: "Non ciblé" },
];

const champ = "rounded-lg border border-border bg-background px-2.5 py-2 text-sm sm:py-1.5";

export function PraticiensTable({ strategieId, produitNom, metrique, methode, lignes, secteurs, droits, regle }: {
  strategieId: string; produitNom: string | null; metrique: string | null; methode: MethodeAffinite; lignes: LignePraticien[];
  secteurs: { id: string; nom: string }[]; droits: Droits; regle: RegleEcran | null;
}) {
  const { enCours, rafraichir } = useRafraichir();
  const [q, setQ] = React.useState("");
  const [secteur, setSecteur] = React.useState("");
  const [potentiel, setPotentiel] = React.useState("");
  const [statut, setStatut] = React.useState("");
  const [local, setLocal] = React.useState<Record<string, Local>>({});
  const [ouverte, setOuverte] = React.useState<string | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [ajout, setAjout] = React.useState(false);

  // Les données du serveur arrivent : les valeurs provisoires n'ont plus lieu d'être.
  React.useEffect(() => { setLocal({}); }, [lignes]);

  const vue = (l: LignePraticien) => {
    const o = local[l.doctorId];
    const st = o && "statut" in o ? o.statut ?? null : l.statut;
    const q1 = o && "q1" in o ? o.q1 ?? null : l.q1;
    const q2 = o && "q2" in o ? o.q2 ?? null : l.q2;
    let lettre = l.lettre;
    if (o && regle && !l.forcee) {
      lettre = lettreProvisoire({
        statut: st, q1, q2, hStatuts: regle.hStatuts, seuilPotentiel: regle.seuilPotentiel, comparaison: regle.comparaison,
        seuilAffinite: (l.secteurId ? regle.seuilParSecteur[l.secteurId] : undefined) ?? regle.seuilAffinite, potentielNulNonCible: regle.potentielNulNonCible,
        methode: regle.methode, potentielNulNA: regle.potentielNulNA,
      });
    }
    return { statut: st, q1, q2, lettre };
  };

  const recherche = q.trim().toLowerCase();
  const visibles = lignes.filter((l) => {
    const v = vue(l);
    if (recherche && !`${l.nomFamille} ${l.prenom ?? ""} ${l.etablissement ?? ""} ${l.specialite ?? ""}`.toLowerCase().includes(recherche)) return false;
    if (secteur && (secteur === "__sans" ? l.secteurId !== null : l.secteurId !== secteur)) return false;
    if (potentiel && v.lettre !== potentiel) return false;
    if (statut && v.statut !== statut) return false;
    return true;
  });

  async function enregistrer(doctorId: string, maj: Local, appel: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setErreur(null);
    setLocal((x) => ({ ...x, [doctorId]: { ...x[doctorId], ...maj } }));
    const r = await appel();
    if (!r.ok) {
      setErreur(r.error);
      setLocal((x) => { const y = { ...x }; delete y[doctorId]; return y; });
      return;
    }
    rafraichir();
  }

  const nombre = (s: string): number | null | "faux" => {
    const t = s.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : "faux";
  };

  function saisirQ(l: LignePraticien, cle: "q1" | "q2", brut: string) {
    const n = nombre(brut);
    const avant = vue(l)[cle];
    if (n === avant) return;
    if (n === null) { setErreur("Une réponse se corrige, elle ne s'efface pas : saisissez une valeur."); return; }
    if (n === "faux" || (cle === "q2" && n > 10)) { setErreur(cle === "q2" ? "Q2 : une valeur entre 0 et 10." : "Q1 : un nombre positif."); return; }
    void enregistrer(l.doctorId, { [cle]: n }, () => enregistrerPotentiel({
      strategieId, doctorId: l.doctorId, productId: null,
      potentiel: cle === "q1" ? String(n) : "", sur10: cle === "q2" ? String(n) : "",
    }));
  }

  return (
    <div className="space-y-3">
      <section className="surface min-w-0 rounded-xl">
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, CDR, spécialité…" aria-label="Rechercher" className={cn(champ, "min-w-[200px] flex-1")} />
          <select value={secteur} onChange={(e) => setSecteur(e.target.value)} aria-label="Secteur" className={champ}>
            <option value="">Tous les secteurs</option>
            {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            {lignes.some((l) => !l.secteurId) && <option value="__sans">Sans secteur</option>}
          </select>
          <select value={potentiel} onChange={(e) => setPotentiel(e.target.value)} aria-label="Potentiel" className={champ}>
            <option value="">Tous les potentiels</option>
            {FILTRES_LETTRE.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Statut" className={champ}>
            <option value="">Tous les statuts</option>
            {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
          {droits.panel && <Button type="button" size="sm" variant="outline" onClick={() => setAjout((v) => !v)} aria-expanded={ajout}>Ajouter un praticien</Button>}
        </div>
        {ajout && droits.panel && <AjoutPanel strategieId={strategieId} onFait={() => { setAjout(false); rafraichir(); }} />}
        {erreur && <p className="border-b border-border px-4 py-2 text-sm text-destructive" role="alert">{erreur}</p>}
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground">
                <Th>Secteur</Th><Th>CDR</Th><Th>Spécialité</Th>
                <Th className="sticky left-0 z-[1] bg-card">Nom</Th>
                <Th>Prénom</Th><Th>Grade</Th><Th>Statut</Th>
                <Th className="min-w-[110px] whitespace-normal text-center leading-tight">{enteteQ1(metrique)}</Th>
                <Th className="min-w-[110px] whitespace-normal text-center leading-tight">{enteteQ2(produitNom)}</Th>
                <Th className="text-right">
                  <span className="inline-flex items-center gap-1">%<InfoBulle label="Affinité">{methode === "RATIO_FICHIER" ? "Q2 ÷ Q1, comme la formule du classeur." : "Q2 ÷ 10."}</InfoBulle></span>
                </Th>
                <Th className="text-center">Potentiel</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => {
                const v = vue(l);
                const ouvert = ouverte === l.doctorId;
                return (
                  <React.Fragment key={l.doctorId}>
                    <tr className="border-t border-border hover:bg-secondary/30">
                      <Td>{l.secteurNom ?? <span className="text-muted-foreground">—</span>}</Td>
                      <Td>
                        {l.etablissement ?? "—"}
                        <span className="ml-1 text-[11px] text-muted-foreground" title={l.inOut ? undefined : "Wilaya inconnue : comptée Out"}>{l.inOut === "IN" ? "In" : l.inOut === "OUT" ? "Out" : "Out ?"}</span>
                      </Td>
                      <Td>{l.specialite ?? "—"}</Td>
                      <Td className="sticky left-0 z-[1] bg-card">
                        <button type="button" onClick={() => setOuverte(ouvert ? null : l.doctorId)} aria-expanded={ouvert} className="font-medium hover:underline">{l.nomFamille}</button>
                      </Td>
                      <Td>{l.prenom ?? ""}</Td>
                      <Td>{l.grade}</Td>
                      <Td>
                        {droits.saisir ? (
                          <select
                            value={v.statut ?? ""} aria-label="Statut" disabled={enCours}
                            onChange={(e) => { const s = (e.target.value || null) as Statut | null; void enregistrer(l.doctorId, { statut: s }, () => changerStatut({ strategieId, doctorId: l.doctorId, statut: s })); }}
                            className="rounded-md border border-transparent bg-transparent px-1 py-1 text-xs hover:border-border"
                          >
                            <option value="">—</option>
                            {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                          </select>
                        ) : v.statut ? STATUT_LABELS[v.statut] : "—"}
                      </Td>
                      <Td className="text-center">
                        {droits.saisir ? <EntreeQ key={`q1-${l.q1}`} valeur={v.q1} label="Q1" onValider={(s) => saisirQ(l, "q1", s)} /> : v.q1 ?? "—"}
                      </Td>
                      <Td className="text-center">
                        {droits.saisir ? <EntreeQ key={`q2-${l.q2}`} valeur={v.q2} label="Q2" onValider={(s) => saisirQ(l, "q2", s)} /> : v.q2 ?? "—"}
                      </Td>
                      <Td className="text-right tabular-nums">{pourcent(affiniteAffichee(v.q1, v.q2, methode))}</Td>
                      <Td className="text-center">
                        {v.lettre ? (
                          <button type="button" onClick={() => setOuverte(ouvert ? null : l.doctorId)} className="inline-flex items-center" aria-label={`Potentiel ${v.lettre}`}>
                            <LettreBadge lettre={v.lettre} />
                            {l.forcee && <span className="ml-1 text-[11px] text-warning" title={`Calculé : ${l.lettreCalculee === "NC" ? "non ciblé" : l.lettreCalculee ?? "—"} — ${l.forcee.motif}`}>✎</span>}
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </Td>
                    </tr>
                    {ouvert && (
                      <tr className="bg-secondary/20">
                        <td colSpan={11} className="px-4 py-3">
                          <Detail strategieId={strategieId} ligne={l} secteurs={secteurs} droits={droits} occupe={enCours} onFait={(e) => { if (e) setErreur(e); else { setErreur(null); rafraichir(); } }} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-6 text-center text-sm text-muted-foreground">{lignes.length === 0 ? "Le panel est vide : importez le fichier ou ajoutez des praticiens." : "Aucun praticien ne correspond."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>{visibles.length} / {lignes.length}</span>
          <span>Q1, Q2 et Statut se modifient dans la ligne ; le potentiel se recalcule.</span>
          <span><span className="text-warning">✎</span> = forcé à la main (motif obligatoire, visible dans l&apos;historique)</span>
        </div>
      </section>
    </div>
  );
}

/** « 8,9 % » — une décimale ; « — » quand l'affinité ne se calcule pas. */
function pourcent(a: number | null): React.ReactNode {
  if (a === null) return <span className="text-muted-foreground">—</span>;
  return `${String(Math.round(a * 1000) / 10).replace(".", ",")} %`;
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn("whitespace-nowrap border-b border-border px-2.5 py-2 text-left font-medium", className)}>{children}</th>;
}
function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("whitespace-nowrap px-2.5 py-2 align-middle", className)}>{children}</td>;
}

/** Une réponse saisie dans la ligne : enregistrée en quittant le champ (ou à Entrée). */
function EntreeQ({ valeur, label, onValider }: { valeur: number | null; label: string; onValider: (s: string) => void }) {
  const [texte, setTexte] = React.useState(valeur === null ? "" : String(valeur).replace(".", ","));
  return (
    <input
      value={texte} inputMode="decimal" placeholder="?" aria-label={label}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => onValider(texte)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setTexte(valeur === null ? "" : String(valeur)); } }}
      className="w-[52px] rounded-md border border-transparent bg-muted px-1 py-1 text-center text-sm hover:border-border"
    />
  );
}

/** Le dépli d'une ligne : le pourquoi, et les gestes que la personne a. */
function Detail({ strategieId, ligne, secteurs, droits, occupe, onFait }: {
  strategieId: string; ligne: LignePraticien; secteurs: { id: string; nom: string }[]; droits: Droits; occupe: boolean; onFait: (erreur: string | null) => void;
}) {
  const [lettre, setLettre] = React.useState<string>(ligne.forcee?.valeur ?? "A");
  const [motif, setMotif] = React.useState("");
  const [envoi, setEnvoi] = React.useState(false);
  const agir = async (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setEnvoi(true);
    try { const r = await f(); onFait(r.ok ? null : r.error); } finally { setEnvoi(false); }
  };
  const bloque = envoi || occupe;
  return (
    <div className="grid grid-cols-1 gap-4 text-xs lg:grid-cols-2">
      <div className="space-y-1">
        <p className="font-semibold">
          <Link href={`/praticiens/${ligne.doctorId}`} className="hover:underline">{[ligne.prenom, ligne.nomFamille].filter(Boolean).join(" ")}</Link>
          {ligne.lettreCalculee && <span className="font-normal text-muted-foreground"> · calculé : {ligne.lettreCalculee === "NC" ? "non ciblé" : ligne.lettreCalculee}</span>}
        </p>
        {ligne.pourquoi.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{ligne.pourquoi.map((t, i) => <li key={i}>{t}</li>)}</ul>
        ) : <p className="text-muted-foreground">Règles non publiées : aucun calcul.</p>}
        {ligne.forcee && <p><span className="text-warning">✎</span> Forcé à {ligne.forcee.valeur === "NC" ? "non ciblé" : ligne.forcee.valeur} — {ligne.forcee.motif}</p>}
      </div>
      <div className="space-y-3">
        {droits.forcer && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void agir(() => forcerLettre({ strategieId, doctorId: ligne.doctorId, lettre, motif })); }}>
            <span className="font-semibold">Forcer le potentiel</span>
            <select value={lettre} onChange={(e) => setLettre(e.target.value)} aria-label="Lettre forcée" className={champ}>
              {LETTRES_FORCABLES.map((x) => <option key={x} value={x}>{x === "NC" ? "Non ciblé" : x}</option>)}
            </select>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (obligatoire)" aria-label="Motif" className={cn(champ, "min-w-[180px] flex-1")} />
            <Button type="submit" size="sm" disabled={bloque || motif.trim().length < 3}>Forcer</Button>
            {ligne.forcee && <Button type="button" size="sm" variant="ghost" disabled={bloque} onClick={() => void agir(() => rendreLettreCalculee({ strategieId, doctorId: ligne.doctorId }))}>Rendre le calcul</Button>}
          </form>
        )}
        {droits.valider && (
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Secteur</span>
            <select
              value={ligne.secteurPose ? ligne.secteurId ?? "" : ""} disabled={bloque} aria-label="Secteur de la fiche" className={champ}
              onChange={(e) => void agir(() => changerSecteur({ strategieId, doctorId: ligne.doctorId, secteurId: e.target.value || null }))}
            >
              <option value="">Selon l&apos;établissement{!ligne.secteurPose && ligne.secteurNom ? ` (${ligne.secteurNom})` : ""}</option>
              {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
            <InfoBulle label="Secteur" align="left">Par défaut, le secteur qui couvre son établissement (ou son service). Le choisir ici le range à la main.</InfoBulle>
          </label>
        )}
        {droits.panel && (
          <button type="button" disabled={bloque} className="py-2 text-muted-foreground underline sm:py-0" onClick={() => void agir(() => retirerDuPanel(strategieId, ligne.doctorId))}>Retirer du panel</button>
        )}
      </div>
    </div>
  );
}

/** Ajouter un praticien de l'annuaire au panel. */
function AjoutPanel({ strategieId, onFait }: { strategieId: string; onFait: () => void }) {
  const [q, setQ] = React.useState("");
  const [res, setRes] = React.useState<PraticienTrouve[]>([]);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [envoi, setEnvoi] = React.useState(false);
  React.useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    let actif = true;
    const t = setTimeout(async () => {
      const r = await chercherPraticiensHorsPanel({ strategieId, q });
      if (!actif) return;
      if (r.ok) { setRes(r.praticiens); setErreur(null); } else setErreur(r.error);
    }, 250);
    return () => { actif = false; clearTimeout(t); };
  }, [q, strategieId]);
  return (
    <div className="space-y-2 border-b border-border px-4 py-3 text-sm">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans l'annuaire (nom, établissement)…" aria-label="Chercher un praticien" className={cn(champ, "w-full sm:w-96")} autoFocus />
      {erreur && <p className="text-destructive">{erreur}</p>}
      {res.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 [overflow-wrap:anywhere]"><b className="font-medium">{p.nom}</b> <span className="text-muted-foreground">{[p.etablissement, p.specialite].filter(Boolean).join(" · ")}</span></span>
          <Button type="button" size="sm" variant="outline" disabled={envoi} onClick={async () => {
            setEnvoi(true);
            const r = await ajouterAuPanel(strategieId, [p.id], null);
            setEnvoi(false);
            if (r.ok) onFait(); else setErreur(r.error);
          }}>Ajouter</Button>
        </div>
      ))}
      {q.trim().length >= 2 && res.length === 0 && !erreur && <p className="text-muted-foreground">Aucun praticien hors panel ne correspond.</p>}
    </div>
  );
}
