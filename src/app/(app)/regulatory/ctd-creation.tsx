"use client";

import * as React from "react";
import { Archive, FileUp, FolderUp, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLimitesEnvoi } from "@/components/layout/use-limites-envoi";
import { envoiDocument, lireDepot, FICHIER_PARASITE, type EntreeDepot } from "@/components/documents/envoi-document";
import { CTD_INITIALE_CATEGORIE, CTD_INITIALE_ENTITE, CTD_INITIALE_ETAPE, CTD_INITIALE_LIBELLE } from "@/lib/regulatory/ctd-initiale";
import { cn } from "@/lib/utils";

type FichierAvecChemin = File & { webkitRelativePath?: string };

const humanSize = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} Go` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

/**
 * LA CTD INITIALE, À LA CRÉATION DU DOSSIER (§118.213).
 *
 * « Lors de la création d'un dossier, on doit pouvoir mettre un dossier ZIP complet (ou un dossier
 * entier) : il sera mis dans la première étape du process, nommé « CTD initiale ». »
 *
 * Le dossier n'existe qu'après sa création : ce composant ne ENVOIE RIEN. Il garde la sélection
 * (des fichiers, un .zip, ou un dossier entier avec son arborescence) et la rend au formulaire, qui —
 * une fois le dossier créé — la confie au gestionnaire d'envois global, vers l'étape 1. Ce choix a deux
 * conséquences voulues :
 *   • la création ne bloque jamais sur le téléversement (un .zip de plusieurs Go ne retient pas la
 *     fenêtre) : on arrive sur la fiche, l'envoi continue, sa progression est dans la pastille ;
 *   • les champs de ce composant n'ont PAS de `name` : ils ne partent jamais avec le formulaire, donc
 *     jamais dans l'action serveur (qui n'a pas à recevoir des gigaoctets).
 *
 * Le refus d'un fichier est dit ICI, avant la création, avec la phrase du serveur (type interdit,
 * trop lourd, vide) : on ne découvre pas après avoir créé le dossier que la CTD ne partira pas.
 */
export function CtdALaCreation({ entrees, onChange }: { entrees: EntreeDepot[]; onChange: (e: EntreeDepot[]) => void }) {
  const limites = useLimitesEnvoi();
  const filesRef = React.useRef<HTMLInputElement>(null);
  const dossierRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [refuses, setRefuses] = React.useState<{ path: string; raison: string }[]>([]);

  const refusDe = limites
    ? envoiDocument({ entityType: CTD_INITIALE_ENTITE, entityId: "", category: CTD_INITIALE_CATEGORIE, confidentiality: "INTERNAL", stepKey: CTD_INITIALE_ETAPE, ctd: true }, limites, () => null).refus
    : undefined;

  function ajouter(liste: EntreeDepot[]) {
    if (liste.length === 0) return;
    const gardes: EntreeDepot[] = [];
    const ko: { path: string; raison: string }[] = [];
    for (const e of liste) {
      if (FICHIER_PARASITE.test(e.file.name)) continue;
      const raison = e.file.size === 0 ? "Fichier vide (0 octet)." : refusDe ? refusDe(e.file) : null;
      if (raison) ko.push({ path: e.path, raison }); else gardes.push(e);
    }
    setRefuses(ko);
    onChange([...entrees, ...gardes]);
  }

  const total = entrees.reduce((s, e) => s + e.file.size, 0);
  const racines = new Set(entrees.map((e) => e.path.split("/")[0]));

  return (
    <fieldset className="space-y-2 rounded-lg border border-primary/40 bg-primary/[0.04] p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium"><Archive className="h-4 w-4 text-primary" /> {CTD_INITIALE_LIBELLE} <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></legend>
      <p className="text-xs text-muted-foreground">
        Un <strong>.zip complet</strong> ou un <strong>dossier entier</strong> (arborescence conservée). Elle sera déposée sur l&apos;étape 1 du processus (« Réception du CTD complet »)
        dès que le dossier est créé ; l&apos;envoi continue en arrière-plan, sans retenir la création. Vous pourrez la remplacer, la supprimer ou y ajouter des fichiers ensuite.
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void lireDepot(e.dataTransfer).then(ajouter); }}
        className={cn("rounded-xl border-2 border-dashed px-3 py-2.5 text-center transition-colors", dragOver ? "border-primary bg-accent/50" : "border-border bg-muted/30")}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <UploadCloud className="h-4 w-4 text-muted-foreground" />
          <Button type="button" size="sm" variant="outline" onClick={() => filesRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Choisir un .zip ou des fichiers
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => dossierRef.current?.click()}>
            <FolderUp className="h-4 w-4" /> Choisir un dossier
          </Button>
        </div>
        {/* AUCUN `name` : ces champs ne partent pas avec le formulaire (voir l'en-tête). */}
        <input ref={filesRef} type="file" multiple hidden data-testid="ctd-creation-fichiers" onChange={(e) => {
          ajouter(Array.from(e.target.files ?? []).map((file) => ({ file, path: (file as FichierAvecChemin).webkitRelativePath || file.name })));
          e.target.value = "";
        }} />
        <input ref={dossierRef} type="file" multiple hidden data-testid="ctd-creation-dossier" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => {
          ajouter(Array.from(e.target.files ?? []).map((file) => ({ file, path: (file as FichierAvecChemin).webkitRelativePath || file.name })));
          e.target.value = "";
        }} />
      </div>

      {entrees.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs" role="status">
          <span className="min-w-0">
            <strong>{entrees.length} fichier{entrees.length > 1 ? "s" : ""}</strong> · {humanSize(total)}
            {racines.size === 1 && entrees[0].path.includes("/") ? <> · dossier « {[...racines][0]} »</> : null}
            {entrees.length === 1 ? <> · <span className="break-all">{entrees[0].path}</span></> : null}
          </span>
          <button type="button" onClick={() => { onChange([]); setRefuses([]); }} className="inline-flex shrink-0 items-center gap-1 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label="Retirer la CTD choisie">
            <X className="h-3.5 w-3.5" /> Retirer
          </button>
        </div>
      )}

      {refuses.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-1.5" aria-live="polite">
          {refuses.slice(0, 5).map((r) => (
            <li key={r.path} className="flex items-start gap-2 px-2 py-1 text-xs text-destructive">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0"><strong className="break-all">{r.path}</strong> — non retenu : {r.raison}</span>
            </li>
          ))}
          {refuses.length > 5 && <li className="px-2 text-xs text-destructive">… et {refuses.length - 5} autre{refuses.length - 5 > 1 ? "s" : ""}.</li>}
        </ul>
      )}
    </fieldset>
  );
}
