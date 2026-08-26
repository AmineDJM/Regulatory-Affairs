"use client";

import * as React from "react";
import Link from "next/link";
import type {
  WorkspaceBlock, WorkspaceComposition, WorkspaceEndpoint, WorkspacePerson,
} from "@/lib/assistant/workspace/protocol";
// La feuille voyage AVEC le composant : les blocs s'affichent aussi dans la page Assistant de
// l'ERP, qui ne charge pas `chief.css`. Elle porte ses propres valeurs de repli.
import "./blocks.css";

/**
 * LES RENDUS TYPÉS — un composant par forme, et rien qui sache tout afficher.
 *
 * Le registre en bas de fichier est exhaustif par construction : TypeScript refuse de compiler
 * si un type de bloc du protocole n'a pas son rendu. Une capacité ajoutée côté serveur ne peut
 * donc pas atterrir à l'écran sous forme de JSON — elle ne s'affiche pas du tout, jusqu'à ce
 * qu'on lui écrive son rendu.
 *
 * PRINCIPE VISUEL : ces blocs vivent DANS la conversation. Ils ne rivalisent pas avec elle —
 * pas de bordures épaisses, pas de couleurs d'accent, pas de titres criards. On lit une
 * réponse, et la donnée est là, tenue.
 */

// ── Primitives partagées ──────────────────────────────────────────────────────────────────

function Card({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="chief-block">
      <header className="chief-block-head">
        <h3 className="chief-block-title">{title}</h3>
        {meta ? <span className="chief-block-meta">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

/** Une adresse se copie plus souvent qu'elle ne se lit. Le clic la met dans le presse-papier. */
function Endpoint({ e }: { e: WorkspaceEndpoint }) {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(() => {
    navigator.clipboard?.writeText(e.valeur).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); },
      () => { /* Presse-papier refusé (contexte non sécurisé) : la valeur reste sélectionnable. */ },
    );
  }, [e.valeur]);

  return (
    <button type="button" onClick={copy} className="chief-endpoint" title="Copier">
      <span className="chief-endpoint-value">{e.valeur}</span>
      {/* LA PROVENANCE SE DIT TOUJOURS. Une adresse « déduite » qu'on présente comme un fait
          est la façon la plus simple d'envoyer un contrat à la mauvaise personne. */}
      {e.fiabilite ? <span className="chief-endpoint-source">{e.fiabilite}</span> : null}
      {copied ? <span className="chief-endpoint-copied">copié</span> : null}
    </button>
  );
}

function PersonLines({ p, hideName = false }: { p: WorkspacePerson; hideName?: boolean }) {
  const sub = [p.poste, p.departement, p.entite].filter(Boolean).join(" · ");
  return (
    <div className="chief-person">
      <div className="chief-person-id">
        {/* Sur une fiche unique, le titre du bloc EST déjà le nom : le répéter juste en dessous
            occupe une ligne pour ne rien apprendre. */}
        {hideName ? null : <span className="chief-person-name">{p.nom}</span>}
        {sub ? <span className="chief-person-role">{sub}</span> : null}
      </div>
      {p.coordonnees.length > 0 ? (
        <div className="chief-endpoints">
          {p.coordonnees.map((e, i) => <Endpoint key={`${e.valeur}-${i}`} e={e} />)}
        </div>
      ) : (
        <p className="chief-block-empty">Aucune coordonnée enregistrée.</p>
      )}
    </div>
  );
}

// ── Un rendu par type de bloc ─────────────────────────────────────────────────────────────

function PeopleBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "people" }> }) {
  return (
    <Card title={b.title}>
      <div className="chief-stack">
        {b.people.map((p, i) => <PersonLines key={`${p.nom}-${i}`} p={p} hideName={b.people.length === 1} />)}
      </div>
      {b.note ? <p className="chief-block-note">{b.note}</p> : null}
    </Card>
  );
}

function DirectoryBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "directory" }> }) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  // Le filtre est LOCAL et immédiat : re-poser la question pour restreindre une liste déjà à
  // l'écran coûterait un aller-retour complet pour une opération de lecture.
  const rows = needle
    ? b.rows.filter((r) =>
        [r.nom, r.poste, r.departement, r.entite, ...r.coordonnees.map((e) => e.valeur)]
          .filter(Boolean).join(" ").toLowerCase().includes(needle))
    : b.rows;
  const hidden = b.total - b.rows.length;

  return (
    <Card title={b.title} meta={`${b.total} personne${b.total > 1 ? "s" : ""}`}>
      {b.rows.length > 8 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer…"
          aria-label="Filtrer l'annuaire"
          className="chief-block-filter"
        />
      ) : null}
      {/* DEUX RENDUS, PAS UN TABLEAU RÉTRÉCI.
          Sur 390 px, la colonne « Coordonnées » d'un tableau à trois colonnes se réduit à une
          quinzaine de pixels : l'adresse s'y écrit une lettre par ligne, verticalement. Ce
          n'est pas un défaut de style, c'est illisible. Le téléphone reçoit donc une LISTE de
          fiches — la même donnée, dans la forme que l'écran peut tenir. */}
      <div className="chief-table-scroll chief-only-wide">
        <table className="chief-table">
          <thead>
            <tr><th>Nom</th><th>Poste</th><th>Coordonnées</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.nom}-${i}`}>
                <td className="chief-td-strong">{r.nom}</td>
                <td>{[r.poste, r.departement].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  {r.coordonnees.length === 0 ? (
                    <span className="chief-block-empty">non renseignée</span>
                  ) : (
                    <div className="chief-endpoints">
                      {r.coordonnees.map((e, j) => <Endpoint key={`${e.valeur}-${j}`} e={e} />)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chief-stack chief-only-narrow">
        {rows.map((r, i) => (
          <div key={`${r.nom}-${i}`} className="chief-person">
            <div className="chief-person-id">
              <span className="chief-person-name">{r.nom}</span>
              {[r.poste, r.departement].filter(Boolean).length ? (
                <span className="chief-person-role">{[r.poste, r.departement].filter(Boolean).join(" · ")}</span>
              ) : null}
            </div>
            {r.coordonnees.length === 0 ? (
              <p className="chief-block-empty">Coordonnée non renseignée.</p>
            ) : (
              <div className="chief-endpoints">
                {r.coordonnees.map((e, j) => <Endpoint key={`${e.valeur}-${j}`} e={e} />)}
              </div>
            )}
          </div>
        ))}
      </div>
      {rows.length === 0 ? <p className="chief-block-empty">Aucune ligne ne correspond à « {q} ».</p> : null}
      {hidden > 0 ? (
        <p className="chief-block-note">
          {hidden} autre{hidden > 1 ? "s" : ""} non affichée{hidden > 1 ? "s" : ""} — la liste complète est dans <Link href="/rh">Ressources humaines</Link>.
        </p>
      ) : null}
      {b.note ? <p className="chief-block-note">{b.note}</p> : null}
    </Card>
  );
}

/**
 * « Deepak Sharma <deepak@fournisseur.in> » se lit mal. Le nom porte l'information, l'adresse
 * la précise : on les sépare quand la source les a réunies, sans jamais perdre l'adresse —
 * deux « Deepak » dans deux sociétés, c'est le domaine qui les distingue.
 */
function splitSender(raw: string): { name: string; address: string | null } {
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (!m || !m[1].trim()) return { name: raw, address: null };
  return { name: m[1].trim().replace(/^"|"$/g, ""), address: m[2].trim() };
}

function MailBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "mail" }> }) {
  return (
    <Card title={b.title}>
      <ul className="chief-stack chief-list">
        {b.messages.map((m, i) => {
          const from = splitSender(m.de);
          return (
          <li key={m.id ?? `${m.de}-${i}`} className="chief-mail">
            <div className="chief-mail-head">
              <span className="chief-mail-from">
                {from.name}
                {from.address ? <span className="chief-mail-address">{from.address}</span> : null}
              </span>
              {m.recuLe ? <span className="chief-mail-date">{m.recuLe}</span> : null}
            </div>
            <p className="chief-mail-subject">{m.objet}</p>
            {m.extrait ? <p className="chief-mail-snippet">{m.extrait}</p> : null}
            {m.demandes?.length ? (
              <p className="chief-mail-asks">
                {/* Formulé comme un RAPPORT : ce que l'expéditeur demande n'est pas une consigne
                    pour Adam, et l'écran ne doit pas le laisser croire. */}
                Demande de l&apos;expéditeur : {m.demandes.join(" · ")}
              </p>
            ) : null}
            {m.piecesJointes?.length ? (
              <p className="chief-mail-files">{m.piecesJointes.join(" · ")}</p>
            ) : null}
            {m.alerte?.length ? (
              <p className="chief-mail-alert">Message suspect : {m.alerte.join(" · ")}</p>
            ) : null}
          </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AgendaBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "agenda" }> }) {
  return (
    <Card title={b.title}>
      <ul className="chief-stack chief-list">
        {b.events.map((e, i) => (
          <li key={`${e.titre}-${i}`} className="chief-event">
            <div className="chief-event-when">
              {e.heure ? <span className="chief-event-hour">{e.heure}</span> : null}
              {e.jour ? <span className="chief-event-day">{e.jour}</span> : null}
            </div>
            <div className="chief-event-body">
              <p className="chief-event-title">{e.titre}</p>
              {[e.lieu, e.organisateur].filter(Boolean).length ? (
                <p className="chief-event-meta">{[e.lieu, e.organisateur].filter(Boolean).join(" · ")}</p>
              ) : null}
              {e.invites?.length ? <p className="chief-event-meta">{e.invites.join(", ")}</p> : null}
              {e.visio ? (
                <a href={e.visio} target="_blank" rel="noreferrer" className="chief-link">Rejoindre</a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function QueueBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "queue" }> }) {
  const hidden = b.total - b.items.length;
  return (
    <Card title={b.title} meta={`${b.total}`}>
      <ul className="chief-stack chief-list">
        {b.items.map((it, i) => (
          <li key={`${it.titre}-${i}`} className="chief-queue-item">
            <div className="chief-queue-body">
              <p className="chief-queue-title">
                {it.href ? <Link href={it.href} className="chief-link">{it.titre}</Link> : it.titre}
              </p>
              {it.detail ? <p className="chief-queue-detail">{it.detail}</p> : null}
            </div>
            <div className="chief-queue-side">
              {it.statut ? <span className="chief-chip">{it.statut}</span> : null}
              {it.echeance ? <span className="chief-queue-date">{it.echeance}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="chief-block-note">{hidden} de plus dans <Link href="/validations">Validations</Link>.</p> : null}
    </Card>
  );
}

function RecordBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "record" }> }) {
  return (
    <Card title={b.title} meta={b.subtitle ?? undefined}>
      <dl className="chief-fields">
        {b.fields.map((f, i) => (
          <div key={`${f.label}-${i}`} className="chief-field">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {b.href ? <p className="chief-block-note"><Link href={b.href} className="chief-link">Ouvrir la fiche</Link></p> : null}
    </Card>
  );
}

function TableBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "table" }> }) {
  const hidden = (b.total ?? b.rows.length) - b.rows.length;
  return (
    <Card title={b.title} meta={b.total ? `${b.total}` : undefined}>
      <div className="chief-table-scroll">
        <table className="chief-table">
          <thead>
            <tr>{b.columns.map((c) => <th key={c.key} className={c.numeric ? "chief-num" : undefined}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {b.columns.map((c) => <td key={c.key} className={c.numeric ? "chief-num" : undefined}>{r[c.key] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? <p className="chief-block-note">{hidden} ligne{hidden > 1 ? "s" : ""} de plus non affichée{hidden > 1 ? "s" : ""}.</p> : null}
    </Card>
  );
}

function TimelineBlock({ b }: { b: Extract<WorkspaceBlock, { kind: "timeline" }> }) {
  return (
    <Card title={b.title}>
      <ol className="chief-timeline">
        {b.steps.map((st, i) => (
          <li key={`${st.label}-${i}`} className="chief-timeline-step">
            {st.date ? <span className="chief-timeline-date">{st.date}</span> : null}
            <div>
              <p className="chief-timeline-label">{st.label}</p>
              {st.detail ? <p className="chief-timeline-detail">{st.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * LE REGISTRE. Le type de retour force l'exhaustivité : si le protocole gagne un type de bloc
 * sans rendu, la compilation échoue ici — pas à l'exécution, et pas sur l'écran du PDG.
 */
const RENDERERS: { [K in WorkspaceBlock["kind"]]: (p: { b: Extract<WorkspaceBlock, { kind: K }> }) => React.ReactElement } = {
  people: PeopleBlock,
  directory: DirectoryBlock,
  mail: MailBlock,
  agenda: AgendaBlock,
  queue: QueueBlock,
  record: RecordBlock,
  table: TableBlock,
  timeline: TimelineBlock,
};

export function WorkspaceBlocks({ composition }: { composition: WorkspaceComposition }) {
  if (composition.blocks.length === 0) return null;
  return (
    <div className="chief-workspace-blocks">
      {composition.blocks.map((b, i) => {
        // Le passage par le registre est volontairement typé bloc par bloc : le `switch` évite
        // un `as never` sur l'union, et garde l'exhaustivité vérifiée par le compilateur.
        switch (b.kind) {
          case "people": return <PeopleBlock key={i} b={b} />;
          case "directory": return <DirectoryBlock key={i} b={b} />;
          case "mail": return <MailBlock key={i} b={b} />;
          case "agenda": return <AgendaBlock key={i} b={b} />;
          case "queue": return <QueueBlock key={i} b={b} />;
          case "record": return <RecordBlock key={i} b={b} />;
          case "table": return <TableBlock key={i} b={b} />;
          case "timeline": return <TimelineBlock key={i} b={b} />;
        }
      })}
    </div>
  );
}

export { RENDERERS as WORKSPACE_RENDERERS };
