"use client";

import * as React from "react";
import Link from "next/link";
import { agirSurCarte } from "@/platform/in-process/inbox/actions";
import { delaiHumain, GENRES, LIBELLE_GENRE, LIBELLE_URGENCE, type CarteInbox, type GenreCarte, type OptionCarte } from "@/lib/assistant/inbox/model";

/**
 * LA BOÎTE DE DÉCISION, À L'ÉCRAN.
 *
 * Une colonne de cartes, du plus urgent au moins urgent, et des filtres par genre. Chaque carte
 * tient dans l'écran d'un téléphone : le sujet, deux lignes de contexte, la raison, une rangée
 * de faits (échéance, urgence, impact, source) et les boutons — pleine largeur sur mobile.
 *
 * Un clic exécute le geste canonique par l'action serveur, et la carte affiche son ISSUE
 * (« Décision enregistrée », ou le refus du serveur, mot pour mot). Une option qui exige un
 * motif ouvre une saisie AVANT d'exécuter : refuser sans dire pourquoi n'est pas un geste.
 *
 * LA CARTE TRANCHÉE RESTE À L'ÉCRAN, avec son issue. L'action canonique du module revalide ses
 * écrans, et Next.js renvoie alors la page recomposée dans la réponse même de l'action : la
 * file ne contient plus la carte, et sans précaution elle DISPARAÎT sous le doigt, avant que
 * « ✓ Décision enregistrée » ait pu s'afficher — c'est exactement ce que la suite Playwright a
 * mesuré. On garde donc une copie de chaque carte sur laquelle on a agi, réinsérée à sa place
 * tant que la personne n'a pas rechargé : l'écran dit ce qui vient d'être fait, la file reste la
 * vérité au prochain chargement.
 */

type Etat = { etape: "en_cours" | "fait" | "erreur"; message: string };

interface Props { cartes: CarteInbox[]; compte: Record<GenreCarte, number>; ms: number }

const TON: Record<OptionCarte["ton"], string> = { primaire: "chief-btn chief-btn-primaire", danger: "chief-btn chief-btn-danger", neutre: "chief-btn chief-btn-neutre" };

function dateCourte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Algiers" }).format(d);
}

export function InboxView({ cartes, compte, ms }: Props) {
  const [filtre, setFiltre] = React.useState<GenreCarte | "TOUS">("TOUS");
  const [etats, setEtats] = React.useState<Record<string, Etat>>({});
  const [saisieOuverte, setSaisieOuverte] = React.useState<Record<string, string | null>>({});
  const [saisies, setSaisies] = React.useState<Record<string, string>>({});
  /** Les cartes sur lesquelles on a agi, avec leur rang d'origine — pour les garder affichées si la file recomposée ne les porte plus. */
  const [agies, setAgies] = React.useState<Record<string, { carte: CarteInbox; rang: number }>>({});
  const [, startTransition] = React.useTransition();
  const now = React.useMemo(() => new Date(), []);

  const liste = React.useMemo(() => {
    const presentes = new Set(cartes.map((c) => c.id));
    const base = [...cartes];
    const disparues = Object.values(agies)
      .filter((a) => !presentes.has(a.carte.id) && etats[a.carte.id])
      .sort((a, b) => a.rang - b.rang);
    for (const d of disparues) base.splice(Math.min(d.rang, base.length), 0, d.carte);
    return base;
  }, [cartes, agies, etats]);

  const visibles = filtre === "TOUS" ? liste : liste.filter((c) => c.genre === filtre);
  const total = cartes.length;

  const executer = (carte: CarteInbox, option: OptionCarte) => {
    const g = option.geste;
    if (g.kind === "ouvrir") { window.location.assign(g.href); return; }
    if (g.kind === "adam") { window.location.assign(`/chief-of-staff?q=${encodeURIComponent(g.phrase)}`); return; }
    const texte = saisies[carte.id] ?? "";
    if (option.saisie?.obligatoire && !texte.trim()) {
      setSaisieOuverte((s) => ({ ...s, [carte.id]: option.id }));
      return;
    }
    setAgies((a) => (a[carte.id] ? a : { ...a, [carte.id]: { carte, rang: Math.max(0, liste.findIndex((x) => x.id === carte.id)) } }));
    setEtats((e) => ({ ...e, [carte.id]: { etape: "en_cours", message: "" } }));
    startTransition(async () => {
      try {
        const r = await agirSurCarte(g, texte);
        setEtats((e) => ({ ...e, [carte.id]: { etape: r.ok ? "fait" : "erreur", message: r.message } }));
      } catch (err) {
        setEtats((e) => ({ ...e, [carte.id]: { etape: "erreur", message: err instanceof Error ? err.message : "Échec." } }));
      }
    });
  };

  return (
    <div className="chief-inbox" data-testid="inbox">
      <div className="chief-inbox-filtres" role="tablist" aria-label="Filtrer par genre">
        <button type="button" role="tab" aria-selected={filtre === "TOUS"} className="chief-chip" data-testid="inbox-filter-TOUS" onClick={() => setFiltre("TOUS")}>
          Tout <span className="chief-chip-n">{total}</span>
        </button>
        {GENRES.filter((g) => compte[g] > 0).map((g) => (
          <button key={g} type="button" role="tab" aria-selected={filtre === g} className="chief-chip" data-testid={`inbox-filter-${g}`} onClick={() => setFiltre(g)}>
            {LIBELLE_GENRE[g]} <span className="chief-chip-n">{compte[g]}</span>
          </button>
        ))}
        <span className="chief-meta chief-inbox-timing" data-testid="inbox-timing" data-ms={ms}>chargée en {ms} ms</span>
      </div>

      {visibles.length === 0 && (
        <p className="chief-body chief-inbox-vide" data-testid="inbox-empty">
          {total === 0 ? "Rien n'attend votre décision. La boîte se remplit d'elle-même dès qu'une validation, un paiement, un accord de mission ou un engagement en retard vous revient." : "Rien dans ce filtre."}
        </p>
      )}

      <ol className="chief-inbox-liste">
        {visibles.map((c) => {
          const etat = etats[c.id];
          const fini = etat?.etape === "fait";
          const ouverte = saisieOuverte[c.id] ?? null;
          const delai = delaiHumain(c.echeance, now);
          return (
            <li key={c.id} className="chief-card chief-inbox-carte" data-testid="inbox-card" data-genre={c.genre} data-urgence={c.urgence} data-carte={c.id} data-etat={etats[c.id]?.etape ?? "repos"}>
              <div className="chief-inbox-entete">
                <span className="chief-badge" data-genre={c.genre}>{LIBELLE_GENRE[c.genre]}</span>
                <span className="chief-badge chief-badge-urgence" data-urgence={c.urgence}>{LIBELLE_URGENCE[c.urgence]}</span>
                {delai && <span className="chief-meta">{delai}{dateCourte(c.echeance) ? ` · ${dateCourte(c.echeance)}` : ""}</span>}
              </div>
              <h2 className="chief-inbox-sujet">{c.sujet}</h2>
              {c.contexte && <p className="chief-inbox-contexte">{c.contexte}</p>}
              <p className="chief-meta chief-inbox-raison">{c.raison}</p>
              <dl className="chief-inbox-faits">
                {c.impact && (<><dt>Impact</dt><dd>{c.impact}</dd></>)}
                <dt>Source</dt><dd><Link href={c.source.href} className="chief-inbox-lien" data-testid="inbox-source">{c.source.libelle}</Link></dd>
              </dl>
              {c.recommandation && (
                <p className="chief-inbox-reco" data-testid="inbox-reco">
                  <strong>Recommandation :</strong> {c.options.find((o) => o.id === c.recommandation?.optionId)?.libelle ?? c.recommandation.optionId} — {c.recommandation.pourquoi}
                </p>
              )}

              {fini ? (
                <p className="chief-inbox-issue" data-etat="fait" data-testid="inbox-fait">✓ {etat.message}</p>
              ) : (
                <>
                  {ouverte && (
                    <div className="chief-inbox-saisie">
                      <label className="chief-meta" htmlFor={`saisie-${c.id}`}>{c.options.find((o) => o.id === ouverte)?.saisie?.libelle ?? "Précision"}</label>
                      <textarea
                        id={`saisie-${c.id}`}
                        data-testid="inbox-saisie"
                        className="chief-inbox-textarea"
                        rows={3}
                        value={saisies[c.id] ?? ""}
                        onChange={(e) => setSaisies((s) => ({ ...s, [c.id]: e.target.value }))}
                      />
                      <div className="chief-inbox-actions">
                        <button
                          type="button"
                          className="chief-btn chief-btn-primaire"
                          data-testid="inbox-confirmer"
                          disabled={!(saisies[c.id] ?? "").trim() || etat?.etape === "en_cours"}
                          onClick={() => { const o = c.options.find((x) => x.id === ouverte); if (o) { setSaisieOuverte((s) => ({ ...s, [c.id]: null })); executer(c, o); } }}
                        >
                          Confirmer
                        </button>
                        <button type="button" className="chief-btn chief-btn-neutre" onClick={() => setSaisieOuverte((s) => ({ ...s, [c.id]: null }))}>Annuler</button>
                      </div>
                    </div>
                  )}
                  {!ouverte && (
                    <div className="chief-inbox-actions">
                      {c.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`${TON[o.ton]}${c.recommandation?.optionId === o.id ? " chief-btn-reco" : ""}`}
                          data-testid={`inbox-option-${o.id}`}
                          title={o.effet}
                          disabled={etat?.etape === "en_cours"}
                          onClick={() => executer(c, o)}
                        >
                          {o.libelle}
                        </button>
                      ))}
                      {etat?.etape === "en_cours" && <span className="chief-meta">En cours…</span>}
                    </div>
                  )}
                  {etat?.etape === "erreur" && <p className="chief-inbox-issue" data-etat="erreur" data-testid="inbox-erreur">{etat.message}</p>}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
