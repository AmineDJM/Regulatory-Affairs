"use client";

import * as React from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { formaterTaille, profilReduction, type EstimationTelechargement } from "@/lib/compression/politique";

/**
 * LE BOUTON DE TÉLÉCHARGEMENT — un seul, partagé par tous les écrans qui téléchargent un fichier
 * ou une archive (§118.214).
 *
 * Il NE CHANGE RIEN à ce que la personne faisait : le bouton principal est le même lien qu'avant
 * et télécharge l'ORIGINAL en un clic. À côté, un petit chevron ouvre le choix — « qualité
 * maximale » (l'original, octet pour octet) ou « taille réduite » — MAIS seulement quand une
 * version réduite existe : au premier clic sur le chevron, le serveur MESURE (`?qualite=estimer`) et
 * le menu ne montre que ce qui est réellement plus petit, avec ses vraies tailles. Sinon il dit
 * « déjà optimisé » et le chevron disparaît : on ne propose pas un choix qui ne change rien.
 *
 * Import : uniquement le module PUR de politique (aucun module serveur dans le navigateur).
 */

const avecParam = (href: string, cle: string, valeur: string): string => {
  const [sansAncre, ancre = ""] = href.split("#");
  const [chemin, requete = ""] = sansAncre.split("?");
  const p = new URLSearchParams(requete);
  p.set(cle, valeur);
  return `${chemin}?${p.toString()}${ancre ? `#${ancre}` : ""}`;
};

/** Les entrées du menu téléchargent : `dl=1` — sans lui le serveur afficherait le fichier au lieu de l'enregistrer. */
const pourTelecharger = (href: string, qualite: "max" | "reduite") => avecParam(avecParam(href, "dl", "1"), "qualite", qualite);

type Etat =
  | { phase: "repos" }
  | { phase: "mesure" }
  | { phase: "pret"; e: EstimationTelechargement }
  | { phase: "erreur" };

export function BoutonTelecharger({
  href, nom, mime, taille, archive, sansChoix, className, classeRacine, classeChevron, children, title, ariaLabel, onClick,
}: {
  /** Adresse de base (peut porter `?dl=1`) : sans `qualite`, c'est l'original. */
  href: string;
  /** Nom du fichier : le profil statique décide, sans rien lire, s'il y a une chance de réduction. */
  nom: string;
  mime?: string | null;
  taille?: number | null;
  /** Dossier ou sélection (archive ZIP) : le serveur dira ce qu'une compression changerait. */
  archive?: boolean;
  /**
   * La route qui sert ce fichier ne passe pas par la porte unique du téléchargement (elle ignore
   * `?qualite=`) : le bouton reste un simple lien vers l'original, sans chevron.
   */
  sansChoix?: boolean;
  /** Apparence du bouton principal — celle de l'écran d'origine. */
  className?: string;
  /** Gabarit de l'enveloppe (ex. `w-full` dans un menu). */
  classeRacine?: string;
  classeChevron?: string;
  children?: React.ReactNode;
  title?: string;
  ariaLabel?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [etat, setEtat] = React.useState<Etat>({ phase: "repos" });
  const [optimise, setOptimise] = React.useState(false);
  const racine = React.useRef<HTMLSpanElement>(null);
  const bascule = React.useRef<HTMLButtonElement>(null);

  const possible = !sansChoix && (archive || profilReduction(nom, mime, taille).nature !== null);

  // Un changement de fichier remet le choix à zéro.
  React.useEffect(() => { setEtat({ phase: "repos" }); setOptimise(false); setOuvert(false); }, [href]);

  React.useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent | TouchEvent) => { if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false); };
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") { setOuvert(false); bascule.current?.focus(); } };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("touchstart", dehors);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("mousedown", dehors); document.removeEventListener("touchstart", dehors); document.removeEventListener("keydown", touche); };
  }, [ouvert]);

  async function ouvrir() {
    const demain = !ouvert;
    setOuvert(demain);
    if (!demain || etat.phase === "pret" || etat.phase === "mesure") return;
    setEtat({ phase: "mesure" });
    try {
      const res = await fetch(avecParam(href, "qualite", "estimer"), { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const e = (await res.json()) as EstimationTelechargement;
      setEtat({ phase: "pret", e });
      if (!e.reduite) setOptimise(true);
    } catch {
      // Une mesure qui échoue ne retire RIEN : l'original reste à un clic, le menu le dit.
      setEtat({ phase: "erreur" });
    }
  }

  const principal = (
    <a
      href={href}
      className={className}
      title={optimise ? "Déjà optimisé" : title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children ?? <><Download className="h-4 w-4" /> Télécharger</>}
    </a>
  );
  if (!possible || optimise) {
    return optimise && etat.phase === "pret" && ouvert
      ? <span ref={racine} className={`relative inline-flex ${classeRacine ?? ""}`}>{principal}<Panneau etat={etat} href={href} /></span>
      : principal;
  }

  return (
    <span ref={racine} className={`relative inline-flex items-stretch ${classeRacine ?? ""}`}>
      {principal}
      <button
        ref={bascule}
        type="button"
        onClick={ouvrir}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Choisir la qualité du téléchargement"
        title="Qualité maximale ou taille réduite"
        className={classeChevron ?? "ml-0.5 inline-flex min-h-9 min-w-9 items-center sm:min-h-[28px] sm:min-w-[24px] justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ouvert ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {ouvert && <Panneau etat={etat} href={href} />}
    </span>
  );
}

function Panneau({ etat, href }: { etat: Etat; href: string }) {
  const ligne = "flex min-h-[44px] w-full flex-col justify-center rounded-md px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none";
  return (
    <div
      role="menu"
      aria-label="Qualité du téléchargement"
      className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-1 text-foreground shadow-lg"
    >
      {etat.phase === "mesure" && (
        <div className="flex min-h-[44px] items-center gap-2 px-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Calcul des tailles…
        </div>
      )}
      {etat.phase === "erreur" && (
        <a role="menuitem" href={pourTelecharger(href, "max")} className={ligne}>
          <span className="font-medium">Qualité maximale (original)</span>
          <span className="text-xs text-muted-foreground">La taille réduite n&apos;a pas pu être calculée.</span>
        </a>
      )}
      {etat.phase === "pret" && (
        <>
          <a role="menuitem" href={pourTelecharger(href, "max")} className={ligne}>
            <span className="font-medium">Qualité maximale (original)</span>
            <span className="text-xs text-muted-foreground">{etat.e.max.taille > 0 ? `${formaterTaille(etat.e.max.taille)} — ` : ""}exactement le fichier déposé</span>
          </a>
          {etat.e.reduite ? (
            <a role="menuitem" href={pourTelecharger(href, "reduite")} className={ligne}>
              <span className="font-medium">Taille réduite (compressé)</span>
              <span className="text-xs text-muted-foreground">
                {etat.e.reduite.taille !== null ? `${formaterTaille(etat.e.reduite.taille)}${etat.e.reduite.gain !== null ? ` (−${Math.round(etat.e.reduite.gain * 100)} %)` : ""} — ` : "taille non estimée — "}
                {etat.e.reduite.methode}
              </span>
            </a>
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              Déjà optimisé{etat.e.raison ? ` — ${etat.e.raison.replace(/^Déjà optimisé\s*[:.—-]?\s*/i, "")}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
