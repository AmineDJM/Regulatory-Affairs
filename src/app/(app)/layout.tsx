import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { NAVIGATION, moduleForPath, type NavItem } from "@/lib/labels";
import { canSeeRegEnrollment } from "@/lib/org-chart-access";
import { getAppSettings } from "@/lib/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileTabBar } from "@/components/layout/mobile-tabbar";
import { ActivityTracker } from "@/components/layout/activity-tracker";
import { FocusExit } from "@/components/layout/focus-mode";
import { ScreenGuard } from "@/components/layout/screen-guard";
import { CommandPalette } from "@/components/layout/command-palette";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { TestModeBanner } from "@/components/layout/test-mode-banner";
import { ChromeMetrics } from "@/components/layout/chrome-metrics";
import { PushRegister } from "@/components/layout/push-register";
import { NotificationChime } from "@/components/layout/notification-chime";
import { NotificationPopup } from "@/components/layout/notification-popup";
import { UploadProvider } from "@/components/layout/upload-manager";
import { BackgroundUploadProvider } from "@/components/layout/background-upload";
import { getTotalUnread } from "@/lib/queries/messaging";
import { getAdoptionBadge } from "@/lib/adoption";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { getMyCompanies, myCompanyScope } from "@/lib/company";
import { isTestUser, featureEnabled } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { APP_SCROLL_ID } from "@/lib/use-scroll-lock";
import { NavDepthTracker } from "@/components/shared/back-link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  // Onboarding guidé : lecture à chaud (BDD) plutôt que via le JWT — la fin du
  // parcours prend effet immédiatement, sans forcer une reconnexion.
  if (!user.impersonatedBy) {
    const flags = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mustOnboard: true },
    });
    if (flags?.mustOnboard) redirect("/onboarding");
  }
  const modules = accessibleModules(user);
  // Entrées fusionnées (`tabs`) : visibles si l'utilisateur a accès à au moins un
  // onglet ; le lien pointe vers le premier onglet autorisé, et `match` couvre les
  // chemins de tous les onglets pour le surlignage. Les entrées simples sont
  // filtrées par leur module, comme avant.
  // Un onglet porteur d'un `feature` n'existe que pour les comptes qui voient cette
  // nouveauté (stade TEST → testeurs, PROD → tout le monde) : on résout les drapeaux
  // une fois ici, puis on filtre comme n'importe quel droit.
  const tabFeatures = Array.from(new Set(NAVIGATION.flatMap((n) => (n.tabs ?? []).map((t) => t.feature).filter((f): f is string => !!f))));
  const featureOn = new Map<string, boolean>(
    await Promise.all(tabFeatures.map(async (f) => [f, await featureEnabled(f, user.id).catch(() => false)] as const)),
  );
  const tabVisible = (t: { module: string; feature?: string }) =>
    modules.includes(t.module as (typeof modules)[number]) && (!t.feature || featureOn.get(t.feature) === true);

  // Garde SUPPLÉMENTAIRE de l'analyse CTD : elle se débloque par réglage, rôle par rôle, et pas
  // seulement par le module Regulatory. Résolue ICI, côté serveur : une entrée interdite n'est
  // jamais envoyée au navigateur, donc jamais « cachée » par du CSS.
  const gateOpen: Record<string, boolean> = {
    regEnrollment: canSeeRegEnrollment(user, await getAppSettings()),
  };

  // Les SOUS-MODULES suivent la même règle que leur parent : chacun a son module et sa garde,
  // et une entrée interdite n'est jamais envoyée au navigateur. Un parent dont l'utilisateur
  // n'a pas le module disparaît AVEC ses enfants — mais un enfant interdit ne fait pas
  // disparaître le parent.
  const allowedChildren = (n: NavItem): NavItem[] =>
    (n.children ?? []).filter((c) => (!c.gate || gateOpen[c.gate]) && modules.includes(c.module));

  const navItems = NAVIGATION.reduce<NavItem[]>((acc, n) => {
    if (n.gate && !gateOpen[n.gate]) return acc;
    const kids = allowedChildren(n);
    if (!n.tabs) {
      if (modules.includes(n.module)) acc.push(kids.length ? { ...n, children: kids } : { ...n, children: undefined });
      return acc;
    }
    const accessible = n.tabs.filter(tabVisible);
    if (accessible.length > 0) {
      acc.push({ ...n, href: accessible[0].href, match: n.tabs.map((t) => t.href), children: kids.length ? kids : undefined });
    }
    return acc;
  }, []);
  const canMessage = userCan(user, "MESSAGING", "VIEW");
  const [unreadCount, messagingUnread, adoption, companies, unreadNotifs] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    canMessage ? getTotalUnread(user.id) : Promise.resolve(0),
    // Pastille « score d'adoption » de l'utilisateur courant (snapshot mis en cache).
    getAdoptionBadge(user.id, user.role).catch(() => null),
    // Entités du sélecteur : SEULEMENT celles auxquelles cette personne a droit. Proposer
    // toutes les sociétés du groupe reviendrait à laisser basculer vers les dossiers d'une
    // entité qui ne la regarde pas.
    getMyCompanies(user.id).catch(() => []),
    // Notifications non lues (leur lien) → badge par module dans le menu.
    prisma.notification.findMany({ where: { userId: user.id, isRead: false, link: { not: null } }, select: { link: true }, take: 500 }),
  ]);
  // Portée VALIDÉE contre les droits : le cookie est une demande, pas une autorisation.
  const companyScope = await myCompanyScope(user.id);
  // Mode test : la personne voit des nouveautés non encore validées en production.
  const testMode = await isTestUser(user.id).catch(() => false);
  // Compte les notifications non lues par MODULE (routées via leur lien) → badges de menu.
  const moduleBadges: Record<string, number> = {};
  for (const n of unreadNotifs) {
    const m = n.link ? moduleForPath(n.link) : null;
    if (m) moduleBadges[m] = (moduleBadges[m] ?? 0) + 1;
  }

  return (
    <UploadProvider>
    <BackgroundUploadProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      <ActivityTracker />
      {/* Bouton flottant « quitter le plein écran » — hors du chrome qu'on replie. */}
      <FocusExit />
      {/* Compte les navigations internes : c'est ce qui permet aux liens « Retour » de remonter
          la page précédente au lieu de renvoyer à la racine du module. */}
      <NavDepthTracker />
      <ScreenGuard />
      <CommandPalette navItems={navItems} />
      <Sidebar items={navItems} messagingUnread={messagingUnread} moduleBadges={moduleBadges} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Tout ce qui surmonte la zone de contenu est MESURÉ ensemble : les bandeaux passent à
            la ligne sur un écran étroit, et les écrans pleine hauteur doivent déduire la
            hauteur réelle, pas une estimation. */}
        <ChromeMetrics>
          {user.impersonatedBy && <ImpersonationBanner adminName={user.impersonatedBy.name} viewedName={user.name} />}
          {testMode && <TestModeBanner />}
          <Topbar navItems={navItems} user={user} unreadCount={unreadCount} canMessage={canMessage} messagingUnread={messagingUnread} adoption={adoption} companies={companies} companyScope={companyScope} />
        </ChromeMetrics>
        {/* `page-shell` porte les règles « pleine largeur sur téléphone » (globals.css) :
            les cartes de premier niveau y perdent leurs bordures latérales pour occuper
            tout l'écran, comme dans une application native.

            `id` : c'est CE conteneur qui défile (la coque est `overflow-hidden`). Les couches
            modales le verrouillent par cet identifiant — verrouiller le `body` ne ferait rien. */}
        {/* `overflow-x-hidden` — LA CAUSE DU « ça glisse trop ».
            `overflow-y: auto` seul ne suffit pas : en CSS, un axe en `auto` force l'autre à
            devenir défilant. Ce conteneur défilait donc AUSSI latéralement, et le moindre
            tableau trop large faisait partir toute la page de travers, en-tête compris — on
            « tirait l'écran vers la gauche » pour lire une colonne.
            En le bornant, le contenu large doit défiler DANS SON PROPRE conteneur
            (`overflow-x-auto`), ce que `src/lib/responsive-guard.test.ts` vérifie fichier par
            fichier. `overscroll-contain` complète le geste : le rebond en fin de liste ne
            remonte plus jusqu'à la page hôte, comme dans une application native. */}
        <main
          id={APP_SCROLL_ID}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom))] pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] pt-3 sm:pl-[calc(1rem+env(safe-area-inset-left))] sm:pr-[calc(1rem+env(safe-area-inset-right))] sm:pt-6 lg:px-8 lg:pb-8"
        >
          {/* La largeur du contenu est PLAFONNÉE par défaut : au-delà, une ligne de texte devient
              illisible parce que l'œil perd le début de la suivante. Mais un tableau de treize
              colonnes, lui, a besoin de toute la place — d'où la variable, qu'un écran dense
              peut relever pour lui seul. */}
          <div
            className="page-shell mx-auto space-y-4 sm:space-y-6"
            style={{ maxWidth: "var(--shell-max, 1400px)" }}
          >
            {children}
          </div>
        </main>
      </div>
      {/* Navigation MOBILE : barre d'onglets basse + grille complète des modules. */}
      <MobileTabBar items={navItems} messagingUnread={messagingUnread} moduleBadges={moduleBadges} />
      {/* Notifications push (PWA) : enregistre le service worker + (ré)abonne l'appareil. */}
      <PushRegister />
      {/* Sonnerie de rappel/notification (carillon) + notification bureau à l'arrivée. */}
      <NotificationChime initial={unreadCount} />
      {/* Notifications pop-up plein écran (grande fenêtre centrée) diffusées depuis l'Administration. */}
      <NotificationPopup />
    </div>
    </BackgroundUploadProvider>
    </UploadProvider>
  );
}
