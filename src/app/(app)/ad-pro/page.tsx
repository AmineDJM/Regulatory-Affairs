import { requireModule } from "@/lib/session";
import { userCan, type Module } from "@/lib/rbac";
import { canChooseAnalysisAtCreation, canDesignateProductManagerAtCreation } from "@/lib/workflow/origin";
import { getAdProRequests, getAdProCreateData } from "@/lib/queries/ad-pro";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { countByState, creatableKinds } from "@/lib/ad-pro/unified";
import { AdProList } from "./ad-pro-list";
import { NewRequestPicker } from "./new-request-picker";

export const dynamic = "force-dynamic";

/**
 * AD & PRO — UNE SEULE DEMANDE, UNE SEULE LISTE.
 *
 * Sponsoring, prises en charge, événements, matériel promotionnel : pour celui qui demande, ce
 * sont cinq façons de poser la même question — « je veux engager une dépense de promotion ». Lui
 * faire choisir le bon écran AVANT de pouvoir formuler son besoin, c'est lui demander de connaître
 * notre découpage interne. Ici il décrit ce qu'il veut faire, et l'outil l'emmène au bon endroit.
 *
 * Les circuits, eux, restent distincts : un congrès international a des billets et des visas qu'un
 * sponsoring n'a pas. On unifie l'ENTRÉE et la LECTURE, pas le stockage — chaque nature garde son
 * écran, maître de ses champs propres et de son circuit de validation.
 *
 * L'entrée est unifiée JUSQU'AU BOUT : le formulaire de la nature choisie s'ouvre ici, dans le
 * panneau commun. Renvoyer vers l'écran du module rendait au demandeur, au dernier moment, le
 * découpage interne qu'on venait de lui épargner.
 */
export default async function AdProPage() {
  // La porte d'entrée du pôle : le Sponsoring suffit à l'ouvrir, la liste s'adapte ensuite aux
  // modules réellement accessibles.
  const user = await requireModule("SPONSORING");

  // Créer et consulter ne sont pas le même droit : le panneau ne propose que les natures qui
  // aboutiront, la liste des écrans détaillés suit les modules simplement accessibles.
  const kinds = creatableKinds((m) => userCan(user, m as Module, "CREATE"));
  const [rows, createData] = await Promise.all([
    getAdProRequests(user),
    getAdProCreateData(user.id, kinds.map((k) => k.kind)),
  ]);
  const counts = countByState(rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ad & Pro"
        description="Toutes les demandes de promotion, au même endroit : sponsoring, prises en charge, événements, matériel. Chaque demande garde son circuit — c'est l'entrée et la lecture qui sont communes."
      >
        <NewRequestPicker
          kinds={kinds}
          data={createData}
          canDesignatePM={canDesignateProductManagerAtCreation(user)}
          canChooseAnalysis={canChooseAnalysisAtCreation(user)}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="En attente de décision" value={counts.AWAITING} icon="Hourglass" tone={counts.AWAITING > 0 ? "warning" : "default"} />
        <KpiCard label="Validées" value={counts.APPROVED} icon="CheckCheck" tone="info" />
        <KpiCard label="Terminées" value={counts.DONE} icon="Check" tone="success" />
        <KpiCard label="Toutes demandes" value={rows.length} icon="Layers" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="PartyPopper"
          title="Aucune demande"
          description={kinds.length > 0
            ? "Commencez par « Nouvelle demande » : décrivez ce que vous voulez faire, le formulaire s'ouvre ici même."
            : "Aucune demande à afficher pour l'instant."}
        />
      ) : (
        <AdProList rows={rows} />
      )}
    </div>
  );
}
