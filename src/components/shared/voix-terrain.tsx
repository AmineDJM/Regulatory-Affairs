import { InfoBulle } from "@/components/ui/info-bulle";
import { CATEGORIE_VOIX_LABELS, type VoixTerrain } from "@/lib/voix-terrain/pur";

/**
 * « LA VOIX DU TERRAIN » — la même carte pour le Marketing cockpit (30 jours, la BU) et le Cockpit Opérations (7 jours,
 * toutes les BU) : par famille, une citation MOT POUR MOT d'un rapport, le nombre de rapports et de délégués. Composant
 * SERVEUR qui ne lit rien : il reçoit le regroupement (`voix-terrain-luna.ts`).
 */
export function CarteVoixTerrain({ titre, voix, max = 5 }: { titre: string; voix: VoixTerrain; max?: number }) {
  const sous = `${voix.jours} derniers jours · ${voix.parLuna ? "Luna" : "mots-clés"}`;
  return (
    <section className="surface min-w-0 overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          {titre}
          <InfoBulle label={`À propos : ${titre}`}>
            Les comptes rendus de visite (et rapports vocaux) des {voix.jours} derniers jours, rangés en objections, signaux
            d&apos;approvisionnement, opportunités, concurrence et pharmacovigilance{voix.parLuna ? " par Luna" : " par mots-clés (Luna indisponible ou coupée)"}.
            Chaque citation est copiée mot pour mot d&apos;un rapport. Recalculé une fois par jour.
          </InfoBulle>
        </h2>
        <span className="text-[13px] text-muted-foreground">{sous}</span>
      </header>
      {voix.rapports === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">Aucun compte rendu sur la période.</p>
      ) : voix.groupes.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">{voix.rapports} compte(s) rendu(s), aucun signal reconnu.</p>
      ) : (
        <ul>
          {voix.groupes.slice(0, max).map((g) => (
            <li key={g.categorie} className="border-b border-border px-4 py-2.5 last:border-0">
              {g.citation
                ? <q className="block text-sm italic [overflow-wrap:anywhere]">{g.citation.texte}{g.citation.coupe ? "…" : ""}</q>
                : <span className="block text-sm text-muted-foreground">—</span>}
              <small className="block text-xs text-muted-foreground">
                {CATEGORIE_VOIX_LABELS[g.categorie]} · {g.rapports} rapport{g.rapports > 1 ? "s" : ""}
                {g.delegues > 1 ? ` · ${g.delegues} délégués` : ""}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
