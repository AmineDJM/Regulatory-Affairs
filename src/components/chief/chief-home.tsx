"use client";

import { Mail, ListChecks, FileText, Search, CalendarPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * L'ÉTAT D'ACCUEIL — une salutation, une question, quatre aides. Puis il s'efface.
 *
 * LE PIÈGE QU'ON ÉVITE. La tentation, sur une page d'assistant vide, est de la remplir : des
 * tuiles de suggestions, des compteurs, un tableau de bord du jour. On obtient alors un
 * tableau de bord avec un champ de saisie en bas — c'est-à-dire l'inverse du produit voulu.
 *
 * Ce que le PDG doit voir en arrivant, c'est de la PLACE, et une invitation à parler. Les
 * actions rapides sont des amorces pour les jours où l'on ne sait pas par où commencer, pas la
 * fonction principale de l'écran : d'où leur discrétion (des pastilles, pas des cartes) et leur
 * nombre (quatre, cinq au plus — §11).
 *
 * ELLES DISPARAISSENT DÈS LE PREMIER MESSAGE. Une aide au démarrage qui reste affichée pendant
 * toute la conversation cesse d'être une aide et devient du bruit permanent.
 *
 * SUR TÉLÉPHONE, elles tiennent sur UNE rangée qu'on balaie horizontalement. Deux rangées de
 * tuiles, c'est un tableau de bord ; une rangée qui glisse, c'est une barre d'outils.
 */

export interface QuickAction {
  label: string;
  prompt: string;
  Icon: LucideIcon;
}

/**
 * Les quatre amorces. Choisies parce qu'elles couvrent ce que le PDG demande le plus souvent —
 * écrire, faire faire, comprendre, retrouver — et non parce qu'elles montrent les capacités
 * d'Adam. Une amorce sert l'utilisateur, elle ne fait pas la démonstration du produit.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Préparer un mail", prompt: "Prépare un mail à ", Icon: Mail },
  { label: "Créer une tâche", prompt: "Crée une tâche pour ", Icon: ListChecks },
  { label: "Obtenir un résumé", prompt: "Qu'est-ce que j'ai raté aujourd'hui ?", Icon: FileText },
  { label: "Rechercher", prompt: "Retrouve ", Icon: Search },
  { label: "Planifier un rendez-vous", prompt: "Planifie un rendez-vous avec ", Icon: CalendarPlus },
];

export interface ChiefHomeProps {
  userName: string;
  onPick: (prompt: string) => void;
  /** Ce qui attend une décision — affiché SEULEMENT s'il y a quelque chose (§51). */
  attention?: { count: number; label: string; prompt: string }[];
}

export function ChiefHome({ userName, onPick, attention = [] }: ChiefHomeProps) {
  const firstName = (userName ?? "").trim().split(/\s+/)[0] || "";
  const urgent = attention.filter((a) => a.count > 0);

  return (
    <div className="chief-enter mx-auto flex w-full flex-col justify-center px-5 py-10 sm:px-6 md:py-16" style={{ maxWidth: "var(--chief-conversation-max)" }}>
      <h1 className="chief-hero">
        Bonjour {firstName} <span aria-hidden>👋</span>
      </h1>
      <p className="chief-hero-sub mt-2">Que veux-tu que je fasse aujourd&apos;hui ?</p>

      {/* LES AMORCES. Une rangée qui glisse sur téléphone, qui se replie sur ordinateur. */}
      <div className="chief-quick-rail mt-7 md:mt-8" role="list" aria-label="Actions rapides">
        {QUICK_ACTIONS.map(({ label, prompt, Icon }) => (
          <button
            key={label}
            type="button"
            role="listitem"
            onClick={() => onPick(prompt)}
            className="chief-quick"
          >
            <Icon className="h-[15px] w-[15px] flex-shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* CE QUI ATTEND UNE DÉCISION — rien du tout quand il n'y a rien.
          Un cadre vide qui annonce « aucune décision urgente » occupe de la place pour dire
          qu'il n'a rien à dire ; on préfère le silence (§51). */}
      {urgent.length > 0 && (
        <div className="mt-10 md:mt-12">
          <p className="chief-section">Ce qui t&apos;attend</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {urgent.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => onPick(a.prompt)}
                className="chief-card chief-card-interactive flex items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className="grid h-7 min-w-[28px] place-items-center rounded-lg px-1.5 text-[13px] font-semibold tabular-nums"
                  style={{ backgroundColor: "hsl(var(--chief-accent-soft))", color: "hsl(var(--chief-accent))" }}
                >
                  {a.count}
                </span>
                <span className="chief-body flex-1 text-[14.5px]" style={{ color: "hsl(var(--chief-text))" }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
