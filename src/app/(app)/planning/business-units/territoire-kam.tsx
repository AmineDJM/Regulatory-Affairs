"use client";

import * as React from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { enregistrerTerritoireKam } from "@/lib/actions/sales-planning-actions";
import { libelleCouverture, type LienCouverture } from "@/lib/annuaires/services";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import {
  ChoixEtablissements, choixDepuisLiens, etablissementsSansService, remplirFormulaire,
  type ChoixEtab, type EtabOpt,
} from "./choix-etablissements";

/**
 * LE TERRITOIRE D'UN KAM, SUR SA LIGNE (04/10/2026) — dans une BU hospitalière.
 *
 * « Dans le secteur de chaque KAM, on doit pouvoir sélectionner un ou des services d'un ou de
 * plusieurs établissements hospitaliers de l'annuaire. » Le résumé dit, ligne fermée, ce qu'il
 * couvre — « CHU Mustapha (Cardiologie) · EPH Kouba » — et le vide se NOMME : un KAM sans territoire
 * a un panel vide, et c'est sur cette ligne qu'on le corrige.
 *
 * Le panneau naît de la couverture enregistrée À L'OUVERTURE ; le bouton qui l'ouvre attend la fin
 * du rafraîchissement (`busy`) : rouvert sur l'état d'avant, il remontrerait l'ancienne sélection et
 * l'enregistrer la réécrirait (§118.172).
 */

/** Le territoire tel que l'écran le reçoit : ses établissements, et ce qu'il couvre de chacun. */
export interface TerritoireRow { id: string; name: string; repId: string; liens: LienCouverture[] }

type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
const btnCls = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60";

export function TerritoireKam({ buId, kam, territoire, etablissements, busy, run }: {
  buId: string;
  /** `region` : l'ancien « Secteur » saisi en texte — il ne couvre rien, et la ligne le DIT. */
  kam: { repId: string; name: string; region?: string | null };
  territoire: TerritoireRow | null;
  etablissements: EtabOpt[];
  busy: boolean;
  run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [choix, setChoix] = React.useState<ChoixEtab>(new Map());
  const parId = React.useMemo(() => new Map(etablissements.map((e) => [e.id, e])), [etablissements]);
  const nomEtab = (id: string) => parId.get(id)?.name ?? "(établissement retiré de l'annuaire)";
  const nomService = (id: string) => {
    for (const e of etablissements) { const x = e.services.find((sv) => sv.id === id); if (x) return x.name; }
    return null;
  };
  const liens = territoire?.liens ?? [];
  const sansService = etablissementsSansService(choix);

  const ouvrir = () => { setChoix(choixDepuisLiens(liens)); setOuvert(true); };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
      {liens.length === 0 ? (
        <>
          <Badge tone="warning" dot={false}>Sans territoire — panel vide</Badge>
          {/* LE « SECTEUR » TAPÉ EN TEXTE avant ce lot n'a jamais couvert un seul établissement : c'est
              la cause la plus probable d'un panel vide « alors qu'on lui a donné un secteur ». */}
          {kam.region?.trim() && (
            <span>Le secteur « {kam.region.trim()} » saisi en texte n&apos;est relié à aucun établissement : choisissez-les ici.</span>
          )}
        </>
      ) : (
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {/* CE QUE LE TERRITOIRE COUVRE, en clair : « CHU Mustapha (Cardiologie, Oncologie) ». */}
          {liens.slice(0, 6).map((l) => libelleCouverture(nomEtab(l.institutionId), l, nomService)).join(" · ")}
          {liens.length > 6 ? ` … +${liens.length - 6}` : ""}
        </span>
      )}
      <button
        type="button" onClick={ouvrir} disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60 sm:px-2 sm:py-1"
        aria-label={`Territoire de ${kam.name}`}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden /> Territoire
      </button>

      <Sheet
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={`Territoire de ${kam.name}`}
        description="Les établissements de l'annuaire que ce KAM couvre — tous leurs services, ou certains. C'est ce qui lui donne son panel de médecins et ouvre sa planification de tournée."
        width="lg"
      >
        <form
          className="space-y-3"
          action={async (fd) => {
            fd.set("businessUnitId", buId);
            fd.set("repId", kam.repId);
            // LA SÉLECTION PART DE L'ÉTAT, pas des cases à l'écran : un filtre qui masque des lignes
            // ne les retire pas du territoire.
            remplirFormulaire(fd, choix);
            if (await run(enregistrerTerritoireKam, fd)) setOuvert(false);
          }}
        >
          <ChoixEtablissements etablissements={etablissements} choix={choix} onChange={setChoix} />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              Annuler
            </button>
            <button type="submit" disabled={busy || sansService.length > 0} className={btnCls}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer le territoire
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
