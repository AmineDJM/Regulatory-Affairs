"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { annonceArme, DELAI_CONFIRMATION_MS, gesteDuClic, libelleConfirmation } from "@/components/ui/bouton-decisif-regle";

/**
 * LE BOUTON DÉCISIF — une double confirmation, une seule mécanique pour tout l'ERP.
 *
 * Premier clic : le bouton devient « Confirmer : <action> ? » (avec un petit « Annuler »), rien n'est
 * soumis. Second clic dans les 5 s : la soumission du formulaire part (avec le `name`/`value` du bouton,
 * et la validation HTML `required` du formulaire), ou l'`onClick` d'origine s'exécute. Sans second clic,
 * Échap ou « Annuler » : retour à l'état initial. Aucune fenêtre modale du navigateur.
 *
 * Il s'emploie là où un `<Button>` tranchait : mêmes props (`variant`, `size`, `type`, `name`,
 * `value`, `formAction`, `disabled`…), plus `confirmation` pour nommer l'action quand le texte du
 * bouton ne le fait pas (une icône seule, un libellé ambigu). `brut` rend un `<button>` sans le style
 * de `Button`, pour les boutons maison qui portent leurs propres classes.
 *
 * La règle (quand armer, quand exécuter, quand signaler le formulaire) vit dans
 * `bouton-decisif-regle.ts`, pure : c'est elle que le banc éprouve.
 */
export interface BoutonDecisifProps extends ButtonProps {
  /** L'action à confirmer (« Approuver le poste »). Par défaut : le texte du bouton. */
  confirmation?: string;
  /** Rendre un `<button>` nu (classes de l'appelant seulement) au lieu d'un `Button`. */
  brut?: boolean;
  /** Délai du second clic, en millisecondes (5 s par défaut). */
  delaiMs?: number;
}

export const BoutonDecisif = React.forwardRef<HTMLButtonElement, BoutonDecisifProps>(function BoutonDecisif(
  { confirmation, brut = false, delaiMs = DELAI_CONFIRMATION_MS, onClick, onKeyDown, children, className, disabled, type = "submit", ...props },
  refExterne,
) {
  const [arme, setArme] = React.useState(false);
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const poserRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      if (typeof refExterne === "function") refExterne(el);
      else if (refExterne) refExterne.current = el;
    },
    [refExterne],
  );

  const libelle = libelleConfirmation(
    confirmation ?? (props["aria-label"] as string | undefined) ?? (typeof props.title === "string" && !childrenOntDuTexte(children) ? props.title : undefined),
    children,
  );

  // Le délai : sans second clic, le bouton redevient ce qu'il était.
  React.useEffect(() => {
    if (!arme) return;
    const t = window.setTimeout(() => setArme(false), delaiMs);
    return () => window.clearTimeout(t);
  }, [arme, delaiMs]);

  // Un bouton désactivé pendant qu'il est armé (une action en cours ailleurs) se désarme.
  React.useEffect(() => {
    if (disabled && arme) setArme(false);
  }, [disabled, arme]);

  const desarmer = React.useCallback((rendreLeFocus: boolean) => {
    setArme(false);
    if (rendreLeFocus) ref.current?.focus();
  }, []);

  function auClic(e: React.MouseEvent<HTMLButtonElement>) {
    const bouton = e.currentTarget;
    const formulaire = type === "submit" && !bouton.formNoValidate ? bouton.form : null;
    const formulaireInvalide = !!formulaire && !formulaire.noValidate && !formulaire.checkValidity();
    const geste = gesteDuClic({ arme, desactive: !!disabled, formulaireInvalide });
    if (geste === "executer") {
      setArme(false);
      onClick?.(e);
      return; // la soumission native (ou l'action du formulaire) part d'elle-même.
    }
    e.preventDefault();
    if (geste === "signalerFormulaire") {
      formulaire?.reportValidity();
      return;
    }
    if (geste === "armer") {
      setArme(true);
      bouton.focus();
    }
  }

  function auClavier(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (arme && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // Échap annule la confirmation, pas le panneau qui la contient.
      desarmer(true);
      return;
    }
    onKeyDown?.(e);
  }

  const classesArme = arme ? "w-auto h-auto min-h-8 whitespace-normal py-1.5 ring-2 ring-ring ring-offset-1" : undefined;
  const contenu = arme ? libelle : children;
  const communs = {
    ...props,
    ref: poserRef,
    type,
    disabled,
    onClick: auClic,
    onKeyDown: auClavier,
    "data-decisif": arme ? "arme" : "repos",
    "aria-describedby": arme ? undefined : props["aria-describedby"],
  } as const;

  // UNE ENVELOPPE, pas un fragment : sans elle, « Annuler » et la zone vivante deviendraient des
  // frères du bouton dans la grille ou la pile de l'appelant (une cellule de plus, une marge de
  // `space-y-*` de plus). Elle hérite de la largeur que l'appelant donnait au bouton.
  const pleine = /(^|\s)w-full(\s|$)/.test(className ?? "");
  const etire = /(^|\s)(flex-1|grow)(\s|$)/.test(className ?? "");
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 align-middle",
        pleine && "flex w-full",
        etire && "flex-1",
      )}
    >
      {brut ? (
        <button {...communs} className={cn(className, (pleine || etire) && "flex-1", classesArme)}>{contenu}</button>
      ) : (
        <Button {...communs} className={cn(className, (pleine || etire) && "flex-1", classesArme)}>{contenu}</Button>
      )}
      {arme && (
        <button
          type="button"
          onClick={() => desarmer(true)}
          className="inline-flex min-h-8 items-center rounded-[var(--radius)] px-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-ring"
        >
          Annuler
        </button>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {arme ? annonceArme(libelle, delaiMs) : ""}
      </span>
    </span>
  );
});
BoutonDecisif.displayName = "BoutonDecisif";

function childrenOntDuTexte(children: React.ReactNode): boolean {
  let trouve = false;
  React.Children.forEach(children, (c) => {
    if (typeof c === "string" && c.trim()) trouve = true;
    else if (typeof c === "number") trouve = true;
    else if (React.isValidElement(c) && childrenOntDuTexte((c.props as { children?: React.ReactNode }).children)) trouve = true;
  });
  return trouve;
}
