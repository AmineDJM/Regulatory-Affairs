import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { realtimeVoiceConfigured, canUseRealtimeVoice } from "@/lib/assistant/voice-realtime";
import { UploadProvider } from "@/components/layout/upload-manager";
import { CallProvider } from "@/components/layout/call-provider";
import "../chief.css";

/**
 * LE BUREAU D'ADAM — sa propre coque, délibérément vide.
 *
 * CE QUE CE FICHIER SUPPRIME, ET POURQUOI. `/chief-of-staff` vivait dans le layout de l'ERP :
 * il héritait donc du menu latéral, de la barre supérieure, de la barre d'onglets mobile, de la
 * palette de commandes, des bandeaux de mode test et d'impersonation, du sélecteur d'entité, du
 * compteur de messagerie non lus, du badge d'adoption. Neuf éléments de chrome autour d'une
 * conversation — et le résultat ressemblait à ce qu'il était : une page de chat posée dans un
 * ERP.
 *
 * Adam n'est pas un module. Entrer ici, c'est entrer dans SON bureau : ce qu'on y voit doit être
 * ce qu'on lui demande, et rien d'autre. Le groupe de routes `(chief)` ne change pas l'URL —
 * `/chief-of-staff` reste `/chief-of-staff` — il change seulement ce qui l'entoure.
 *
 * CE QUI RESTE, ET POURQUOI CHAQUE ÉLÉMENT EST LÀ :
 *
 *   • `requireUser` — la garde d'authentification. Le contrôle du MODULE reste sur la page :
 *     un layout ne doit pas décider des droits métier de ses enfants.
 *   • `CallProvider` — l'appel vocal. Il vit au niveau du layout, pas de la page : sans cela,
 *     une navigation interne démonterait la session WebRTC en pleine phrase.
 *   • `UploadProvider` — les pièces jointes déposées dans la conversation.
 *
 * Ce qui n'est PAS là est aussi un choix : pas d'`ActivityTracker`, pas de `SessionRecorder`,
 * pas de `NotificationPopup`. Une notification en plein écran par-dessus une conversation avec
 * son chef de cabinet est une interruption, pas un service.
 */
export default async function ChiefLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <UploadProvider>
      <CallProvider enabled={realtimeVoiceConfigured() && canUseRealtimeVoice(user)}>
        <div className="chief-root chief-shell">{children}</div>
      </CallProvider>
    </UploadProvider>
  );
}
