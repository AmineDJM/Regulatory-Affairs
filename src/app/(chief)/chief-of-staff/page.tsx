import { requireModule } from "@/lib/session";
import { hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { realtimeVoiceConfigured, canUseRealtimeVoice } from "@/lib/assistant/voice-realtime";
import { featureEnabled, FEATURES } from "@/lib/features";
import { getActionCenter } from "@/lib/queries/action-center";
import { ensurePrimaryThread } from "@/lib/assistant-memory";
import { inProcessPlatform, principalOf } from "@/platform/in-process/adapter";
import { ChiefWorkspace } from "@/components/chief/chief-workspace";
import { BlockPreviewPlanche } from "@/components/chief/workspace/preview-planche";

export const dynamic = "force-dynamic";
export const metadata = { title: "Adam — Chief of Staff" };

/**
 * LE BUREAU D'ADAM.
 *
 * Ce n'est PAS un second assistant : c'est le même moteur — mémoire, actions confirmées, voix,
 * pièces jointes — servi à quelqu'un qui pilote l'entreprise. Le mode exécutif s'active PAR LE
 * RÔLE, côté serveur ; cette page n'accorde rien, elle ouvre une porte.
 *
 * CE QUI A CHANGÉ DANS CETTE VERSION, et pourquoi.
 *
 * L'ancienne page vivait dans la coque de l'ERP et empilait, AU-DESSUS de la conversation :
 * une ligne de titre avec une phrase de présentation, un bandeau « Aujourd'hui » de quatre
 * pastilles chiffrées, et le point du matin. Trois bandeaux avant d'atteindre le champ de
 * saisie — plus le menu latéral, la barre supérieure et la barre d'onglets du layout ERP.
 *
 * Tout cela disparaît, et rien ne se perd :
 *
 *   • la PHRASE DE PRÉSENTATION est supprimée. Elle décrivait le produit à quelqu'un qui
 *     l'utilise tous les jours.
 *   • les COMPTEURS D'AUJOURD'HUI descendent dans l'écran d'accueil, sous « ce qui t'attend »,
 *     et ne s'affichent QUE s'il y a quelque chose. Un compteur à zéro n'informe personne.
 *   • le POINT DU MATIN n'est plus versé d'office : c'est une réponse, et une réponse se
 *     demande. L'amorce « Obtenir un résumé » le déclenche en un geste.
 *
 * Le résultat : en arrivant, le PDG voit une salutation, une question, et de la place.
 */
export default async function ChiefOfStaffPage({
  searchParams,
}: {
  searchParams?: { q?: string; ref?: string; call?: string; apercu?: string };
}) {
  const user = await requireModule("CHIEF_OF_STAFF");

  // LA PLANCHE DE RENDU, le temps d'une revue visuelle — et jamais en production.
  //
  // Les blocs de l'espace de travail n'apparaissent qu'au bout d'un vrai tour de conversation,
  // donc d'un appel IA que la suite E2E s'interdit : sans planche, la revue exigée par la mission
  // ne porterait que sur l'écran d'accueil vide. `ADAM_BLOCK_PREVIEW` n'est posée que par la
  // configuration Playwright ; sans elle, ce paramètre ne fait rien du tout.
  //
  // Elle est branchée ICI, après la garde, plutôt que sur une route à elle : une page séparée
  // aurait dû refaire son propre contrôle de droits — donc importer l'ERP une fois de plus, ce
  // que le cliquet de frontière refuse. Adossée au bureau d'Adam, elle hérite de ses gardes.
  if (process.env.ADAM_BLOCK_PREVIEW === "1" && searchParams?.apercu === "blocs") {
    return <BlockPreviewPlanche />;
  }

  // LA PORTE DE SORTIE. `(chief)` retire toute la navigation de l'ERP — c'est ce qui fait d'Adam
  // un bureau et non un onglet — mais il n'en restait AUCUNE : on quittait Adam par le bouton
  // « précédent » du navigateur. La liste des destinations arrive par le CONTRAT de plateforme,
  // jamais par un import direct du menu : c'est l'ERP qui sait qui a le droit d'aller où.
  const [memoryEnabled, destinations] = await Promise.all([
    user.impersonatedBy ? Promise.resolve(false) : featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id),
    inProcessPlatform
      .query(principalOf(user), { kind: "navigation.destinations" })
      .then((r) => (r.kind === "navigation.destinations" ? r.destinations : []))
      .catch(() => []),
  ]);

  // LE FIL PRINCIPAL : une conversation CONTINUE par personne — elle s'ouvre d'office au lieu
  // de repartir de « chat n°47 ».
  const primaryThreadId = memoryEnabled ? await ensurePrimaryThread(user.id).catch(() => null) : null;

  // CE QUI ATTEND UNE DÉCISION. Quatre compteurs bon marché ; le détail vit dans les outils.
  // Chacun devient une PHRASE qu'Adam peut traiter, pas un lien vers un autre écran : on ne
  // sort pas du bureau d'Adam pour savoir ce qu'Adam sait déjà.
  const now = new Date();
  const [toDecide, centreAwaiting, commitmentsLate, decisionsToReview] = await Promise.all([
    getActionCenter(user).then((c) => c.items.length).catch(() => 0),
    prisma.expenseOrder.count({ where: { centralStatus: "AWAITING" } }).catch(() => 0),
    prisma.executiveCommitment.count({ where: { ownerId: user.id, status: "OPEN", dueAt: { lt: now } } }).catch(() => 0),
    prisma.executiveDecision.count({ where: { ownerId: user.id, status: { in: ["PROPOSED", "DECIDED"] }, reviewDate: { lte: now } } }).catch(() => 0),
  ]);

  const attention = [
    { count: toDecide, label: "décision(s) à prendre", prompt: "Sur quoi dois-je me concentrer ce matin ?" },
    { count: centreAwaiting, label: "paiement(s) au centre", prompt: "Quels paiements attendent au centre de paiement ?" },
    { count: commitmentsLate, label: "engagement(s) en retard", prompt: "Quels engagements sont en retard ?" },
    { count: decisionsToReview, label: "décision(s) à revoir", prompt: "Quelles décisions sont à revoir ?" },
  ];

  // ENTRÉE CONTEXTUELLE : « Demander à Adam » depuis une fiche arrive ici avec la question
  // (?q=…) ou la référence du dossier (?ref=…) — pré-remplie, jamais envoyée seule.
  const q = typeof searchParams?.q === "string" ? searchParams.q.slice(0, 500) : "";
  const ref = typeof searchParams?.ref === "string" ? searchParams.ref.slice(0, 120) : "";
  const realtimeVoice = realtimeVoiceConfigured() && canUseRealtimeVoice(user);
  const startCall = searchParams?.call === "1" && realtimeVoice;
  const initialPrompt = startCall
    ? null
    : q || (ref ? `Donne-moi toute l'histoire de ${ref} : statut, validateurs, blocages, prochaine étape.` : null);

  // L'ÉTAT DES DONNÉES, en un point et deux mots. Sans clé IA, Adam ne peut rien lire : le dire
  // franchement vaut mieux qu'un point vert qui ment.
  const configured = aiConfigured();
  const freshness = configured
    ? ({ label: "À jour", tone: "ok" } as const)
    : ({ label: "IA non configurée", tone: "off" } as const);

  return (
    <ChiefWorkspace
      userName={user.name}
      configured={configured}
      voiceConfigured={sttConfigured()}
      realtimeVoice={realtimeVoice}
      memoryEnabled={memoryEnabled}
      initialPrompt={initialPrompt}
      initialThreadId={primaryThreadId}
      initialCallRef={startCall ? ref || "" : null}
      settingsHref={hasGlobalView(user) ? "/chief-of-staff/reglages" : null}
      attention={attention}
      freshness={freshness}
      destinations={destinations}
    />
  );
}
