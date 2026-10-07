import { cn } from "@/lib/utils";
import { InfoBulle } from "@/components/ui/info-bulle";
import type { Capacite, GrilleFrequence } from "@/lib/segmentation/regles";
import { LETTRES_MATRICE, chargeDe, contactsDe, deuxDecimales, totalMatrice, type Matrice } from "@/lib/segmentation/charge";
import { LettreBadge } from "./lettre-badge";

/**
 * LA SYNTHÈSE — générée seule, par SECTEUR DE LA BU (Direction, 07/10 : plus d'Est / Ouest / Centre figés) : la matrice
 * H → NA × In / Out du classeur, puis la charge de visites face à la capacité des KAM du secteur.
 */

export interface CarteSecteur {
  id: string;
  nom: string;
  kams: string[];
  matrice: Matrice;
  grille: GrilleFrequence;
  /** Le secteur a son propre seuil d'affinité (exception de la règle). */
  seuilPropre: boolean;
  sansSecteur?: boolean;
}

export interface Tuiles {
  cibles: number;
  secteurs: number;
  kams: number;
  hautPotentiel: number;
  na: number;
  contacts: number;
  possibles: number;
}

const BARRE: Record<string, string> = { ok: "bg-success", attention: "bg-warning", depasse: "bg-destructive" };

export function SyntheseVue({ tuiles, cartes, capacite, grillePubliee }: { tuiles: Tuiles; cartes: CarteSecteur[]; capacite: Capacite; grillePubliee: boolean }) {
  const pctHaut = tuiles.cibles ? Math.round((tuiles.hautPotentiel / tuiles.cibles) * 100) : 0;
  const cycle = capacite.contactsParJour * capacite.joursParCycle;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tuile titre="Praticiens ciblés" valeur={tuiles.cibles} pied={`${tuiles.secteurs} secteur${tuiles.secteurs > 1 ? "s" : ""} · ${tuiles.kams} KAM`} />
        <Tuile titre="Haut potentiel (H, A, B)" valeur={tuiles.hautPotentiel} pied={`${pctHaut} % du panel`} />
        <Tuile titre="Sans réponse (NA)" valeur={tuiles.na} pied="à questionner en visite" alerte={tuiles.na > 0} />
        <Tuile titre="Contacts nécessaires / cycle" valeur={tuiles.contacts} pied={`sur ${tuiles.possibles} possibles (${tuiles.kams} × ${cycle})`} />
      </div>
      {!grillePubliee && (
        <p className="text-xs text-muted-foreground">Fréquences et capacité proposées, pas encore publiées (onglet Règles).</p>
      )}
      {cartes.length === 0 ? (
        <p className="surface rounded-xl p-5 text-sm text-muted-foreground">Aucun secteur dans cette BU : ils se créent dans Force de vente › Business Units.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cartes.map((c) => <Carte key={c.id} carte={c} capacite={capacite} />)}
        </div>
      )}
    </div>
  );
}

function Tuile({ titre, valeur, pied, alerte }: { titre: string; valeur: number; pied: string; alerte?: boolean }) {
  return (
    <div className="surface flex flex-col gap-0.5 rounded-xl px-3.5 py-3">
      <span className="text-xs text-muted-foreground">{titre}</span>
      <strong className={cn("text-[22px] font-semibold tabular-nums", alerte && "text-warning")}>{valeur}</strong>
      <span className="text-xs text-muted-foreground">{pied}</span>
    </div>
  );
}

function Carte({ carte, capacite }: { carte: CarteSecteur; capacite: Capacite }) {
  const t = totalMatrice(carte.matrice);
  const { lignes, total } = contactsDe(carte.matrice, carte.grille);
  const nbKam = carte.kams.length;
  const charge = chargeDe(total, capacite, nbKam);
  const vide = (n: number) => (n ? n : <span className="text-muted-foreground">—</span>);
  return (
    <section className="surface min-w-0 rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
          {carte.nom}
          <small className="block text-xs font-normal text-muted-foreground">{carte.sansSecteur ? "rattachés à aucun secteur" : carte.kams.join(", ") || "aucun KAM affecté"}</small>
        </h2>
        {carte.seuilPropre && <span className="whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">seuil réduit</span>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Potentiel</th>
              <th className="px-3 py-2 text-center font-medium">In</th>
              <th className="px-3 py-2 text-center font-medium">Out</th>
              <th className="px-3 py-2 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {LETTRES_MATRICE.map((k) => (
              <tr key={k} className="border-t border-border">
                <td className="px-3 py-1.5"><LettreBadge lettre={k} /></td>
                <td className="px-3 py-1.5 text-center tabular-nums">{vide(carte.matrice[k].IN)}</td>
                <td className="px-3 py-1.5 text-center tabular-nums">{vide(carte.matrice[k].OUT)}</td>
                <td className="px-3 py-1.5 text-center tabular-nums">{carte.matrice[k].IN + carte.matrice[k].OUT}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-center tabular-nums">{t.IN}</td>
              <td className="px-3 py-2 text-center tabular-nums">{t.OUT}</td>
              <td className="px-3 py-2 text-center tabular-nums">{t.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Contacts / cycle</span>
          <b className="tabular-nums">{total} sur {charge.capacite}</b>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Charge ${Number.isFinite(charge.taux) ? `${charge.taux} %` : "sans capacité"}`}>
          <i className={cn("block h-full rounded-full", BARRE[charge.ton])} style={{ width: `${Math.min(Number.isFinite(charge.taux) ? charge.taux : 100, 100)}%` }} />
        </div>
        <div className="flex justify-between gap-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            Soit par jour
            {nbKam > 1 && <InfoBulle label="Par KAM" align="left">Par KAM : les contacts du secteur ÷ {capacite.joursParCycle} jours ÷ {nbKam} KAM.</InfoBulle>}
          </span>
          <b className="tabular-nums">{deuxDecimales(charge.parJour)} / {capacite.contactsParJour}</b>
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Détail du calcul</summary>
          <table className="mt-1.5 w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium" />
                <th className="px-2 py-1.5 text-center font-medium">Nombre</th>
                <th className="px-2 py-1.5 text-center font-medium">Fréq.</th>
                <th className="px-2 py-1.5 text-center font-medium">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle} className="border-t border-border">
                  <td className="whitespace-nowrap px-2 py-1.5">{l.libelle}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{l.nombre}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{String(l.frequence).replace(".", ",")}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{String(l.contacts).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
