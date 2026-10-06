"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Landmark, Check } from "lucide-react";
import { setGeneralMeansDepartment } from "@/lib/actions/general-means-service-actions";

/**
 * « C'EST ICI QUE SE TIENNENT LES MOYENS GÉNÉRAUX » — le geste du Super Admin, et de lui seul.
 *
 * Le bouton n'apparaît que sur un département qui n'est PAS déjà le service : sur celui qui
 * l'est, on affiche l'état, sans bouton. Un bouton qui ne change rien invite à cliquer pour
 * vérifier — et l'on ne sait jamais si l'on vient de déplacer la caisse de toute l'entreprise.
 */
export function ServiceSwitch({ departmentId, departmentName, current }: {
  departmentId: string;
  departmentName: string;
  current: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  if (current === departmentId) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
        <Check className="h-4 w-4" /> Service des moyens généraux de la société
      </span>
    );
  }
  return (
    <button type="button" disabled={busy}
      title={`Tout le monde ouvrira la caisse de « ${departmentName} » en arrivant sur les moyens généraux.`}
      onClick={async () => {
        if (!window.confirm(
          `Faire de « ${departmentName} » LE service des moyens généraux ?\n\nC'est cette caisse que toute la société ouvrira désormais.`,
        )) return;
        setBusy(true);
        const fd = new FormData(); fd.set("departmentId", departmentId);
        const r = await setGeneralMeansDepartment(fd);
        setBusy(false);
        if (r.ok) router.refresh(); else window.alert(r.error ?? "Échec.");
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      En faire le service des moyens généraux
    </button>
  );
}

/**
 * CHANGER DE SERVICE — désigner un AUTRE département, sans aller voir ses moyens généraux.
 *
 * Le sélecteur de départements est retiré de l'écran (décision du 01/10 : « enlève les autres
 * départements, laisse que l'Administration »). Mais c'est en ouvrant les moyens généraux d'un
 * autre département que le Super Admin pouvait l'en faire le service : sans ce geste-ci, le
 * réglage n'aurait plus eu AUCUN écrivain une fois posé (§118.131), et une plateforme sans service
 * — ou dont le service a été supprimé — laissait le Super Admin devant « aucun département
 * rattaché », sans issue. Ce contrôle DÉSIGNE, il ne fait rien voir : la liste ne mène à aucune
 * caisse, elle dit laquelle toute la société ouvrira.
 */
export function ChangerDeService({ departements, actuel, ouvertParDefaut = false }: {
  departements: { id: string; libelle: string }[];
  actuel: string | null;
  ouvertParDefaut?: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = React.useState(ouvertParDefaut);
  const [choix, setChoix] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const candidats = departements.filter((d) => d.id !== actuel);

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary">
        <Landmark className="h-4 w-4" /> Changer de service…
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        const cible = departements.find((d) => d.id === choix);
        if (!cible) return;
        if (!window.confirm(`Faire de « ${cible.libelle} » LE service des moyens généraux ?\n\nC'est cette caisse que toute la société ouvrira désormais.`)) return;
        setBusy(true);
        setErr(null);
        const fd = new FormData(); fd.set("departmentId", cible.id);
        const r = await setGeneralMeansDepartment(fd);
        setBusy(false);
        if (r.ok) { setOuvert(false); setChoix(""); router.refresh(); } else setErr(r.error ?? "Échec.");
      }}
    >
      <label htmlFor="mg-service" className="sr-only">Département qui tient les moyens généraux</label>
      <select id="mg-service" value={choix} onChange={(e) => setChoix(e.target.value)} disabled={busy}
        className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-base sm:h-9 sm:w-64 sm:text-sm">
        <option value="">— Département qui tient la caisse —</option>
        {candidats.map((d) => <option key={d.id} value={d.id}>{d.libelle}</option>)}
      </select>
      <button type="submit" disabled={!choix || busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Désigner
      </button>
      {actuel !== null && (
        <button type="button" disabled={busy} onClick={() => { setOuvert(false); setChoix(""); setErr(null); }}
          className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary">
          Annuler
        </button>
      )}
      {err && <p role="alert" className="w-full text-sm text-destructive">{err}</p>}
    </form>
  );
}
