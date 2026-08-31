import { accessibleModules, userCan, seesLockedRegulatory, type SessionUser } from "@/lib/rbac";
import { NAVIGATION, type NavItem } from "@/lib/labels";
import { canSeeRegEnrollment } from "@/lib/org-chart-access";
import { getAppSettings } from "@/lib/settings";
import { visibleModules } from "@/lib/modules-visibility";
import { featureEnabled } from "@/lib/features";
import { loadReportingLine } from "@/lib/departments";
import { managesAnyone } from "@/lib/hr/reporting-line";
import { prisma } from "@/lib/prisma";

/**
 * CE QU'UNE PERSONNE A LE DROIT D'OUVRIR — la réponse, une fois, pour tous les écrans.
 *
 * POURQUOI CE FICHIER EXISTE. Ce calcul vivait EN ENTIER dans `app/(app)/layout.tsx`, où il
 * n'avait qu'un seul lecteur : la barre latérale. Le bureau d'Adam, lui, vit hors de cette
 * coque — il n'a ni menu ni barre d'onglets, c'est même sa raison d'être — et l'on ne pouvait
 * donc plus en sortir : aucune liste de destinations autorisées n'y était disponible.
 *
 * Recopier le filtre là-bas aurait produit deux vérités. La garde `pipeline` a déjà changé une
 * fois ; une copie l'aurait manquée, et Adam aurait proposé une porte qui ouvre sur un écran
 * vide — exactement ce que le layout se donne du mal à éviter.
 *
 * CE QUI EST FILTRÉ, ET DANS QUEL ORDRE :
 *   1. les modules ACCESSIBLES à la personne (RBAC) ;
 *   2. moins les modules MASQUÉS par l'administration (sauf pour le Super Admin, qui doit
 *      pouvoir vérifier ce qu'il vient d'éteindre) ;
 *   3. moins les entrées dont la GARDE supplémentaire est fermée (analyse CTD, pipeline, paie) ;
 *   4. pour une entrée à onglets, moins les onglets sans droit ou sans drapeau de nouveauté —
 *      et l'entrée disparaît s'il n'en reste aucun.
 *
 * Rien de tout cela n'est un contrôle d'accès : c'est de la VISIBILITÉ. Chaque page garde sa
 * propre garde (`requireModule`), et c'est elle qui fait foi. Ce qu'on évite ici, c'est de
 * proposer une porte fermée.
 */
/**
 * ENCADRE-T-IL QUELQU'UN ? — la même cascade que celle qui route les demandes.
 *
 * On ne demande pas « est-il chef d'un département » : la question serait plus simple et la
 * réponse fausse. Un manager explicite sans département encadre ; un chef de département dont
 * tous les subordonnés sont partis n'encadre plus. `managesAnyone` répond par la définition
 * même — « quelqu'un dont je suis le N+1 » — et donc exactement comme l'écran qu'elle ouvre.
 *
 * Le doute referme le verrou : une lecture qui échoue cache l'entrée plutôt que de casser le
 * menu entier.
 */
async function encadreQuelquun(user: SessionUser): Promise<boolean> {
  try {
    const me = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!me) return false;
    const { employees, departments } = await loadReportingLine();
    return managesAnyone(me.id, employees, departments);
  } catch {
    return false;
  }
}

export async function navigationFor(user: SessionUser): Promise<NavItem[]> {
  // LE DOUTE REFERME LE VERROU. Si les réglages sont illisibles, les gardes qui en dépendent
  // restent FERMÉES au lieu de faire échouer l'écran entier : on perd une entrée de menu, pas
  // l'application. `getAppSettings` est mis en cache par requête — l'appeler ici ne coûte rien
  // aux écrans qui l'ont déjà lu.
  const settings = await getAppSettings().catch(() => null);

  // MODULES MASQUÉS — retirés du menu pour tout le monde, sauf du Super Admin, qui doit pouvoir
  // vérifier ce qu'il vient d'éteindre et le rallumer. Le masquage n'est pas un droit : c'est un
  // état de service, réglé une fois pour toute la plateforme (Administration › Modules).
  const modules = visibleModules(accessibleModules(user), settings?.hiddenModules ?? [], {
    isSuperAdmin: user.role === "SUPER_ADMIN",
  });

  // Un onglet porteur d'un `feature` n'existe que pour les comptes qui voient cette nouveauté
  // (stade TEST → testeurs, PROD → tout le monde) : on résout les drapeaux une fois ici, puis on
  // filtre comme n'importe quel droit.
  const tabFeatures = Array.from(
    new Set(NAVIGATION.flatMap((n) => (n.tabs ?? []).map((t) => t.feature).filter((f): f is string => !!f))),
  );
  const featureOn = new Map<string, boolean>(
    await Promise.all(tabFeatures.map(async (f) => [f, await featureEnabled(f, user.id).catch(() => false)] as const)),
  );
  const tabVisible = (t: { module: string; feature?: string }) =>
    modules.includes(t.module as (typeof modules)[number]) && (!t.feature || featureOn.get(t.feature) === true);

  // Gardes SUPPLÉMENTAIRES au droit de module, résolues ICI, côté serveur : une entrée interdite
  // n'est jamais envoyée au navigateur, donc jamais « cachée » par du CSS.
  const gateOpen: Record<string, boolean> = {
    // L'analyse CTD se débloque par réglage, rôle par rôle, et pas seulement par le module.
    regEnrollment: settings ? canSeeRegEnrollment(user, settings) : false,
    // Le PIPELINE ne s'affiche qu'à qui voit des dossiers verrouillés. Une entrée de menu qui
    // ouvre une page vide n'est pas neutre : on la clique, on ne comprend pas, et on finit par
    // demander à l'administrateur ce qui ne marche pas.
    pipeline: seesLockedRegulatory(user),
    // La PAIE se lit avec le droit de TENIR les RH, pas seulement de les consulter : sa page
    // renvoie vers /rh sans ce droit. Même règle ici, pour que l'entrée n'existe pas plutôt que
    // de rebondir — un directeur des opérations n'a rien à faire dans la masse salariale.
    payroll: userCan(user, "RH", "UPDATE"),
    // « MON ÉQUIPE » n'apparaît qu'à qui encadre RÉELLEMENT quelqu'un. Le module est ouvert à
    // tous (encadrer est un fait d'organigramme, pas un rôle), mais l'entrée n'a de sens que
    // pour celui qui a des N-1 : sans eux, l'écran est vide, on le clique, on ne comprend pas,
    // et l'on finit par demander à l'administrateur ce qui ne marche pas.
    myTeam: await encadreQuelquun(user),
  };

  // Les SOUS-MODULES suivent la même règle que leur parent : chacun a son module et sa garde, et
  // une entrée interdite n'est jamais envoyée au navigateur. Un parent dont l'utilisateur n'a pas
  // le module disparaît AVEC ses enfants — mais un enfant interdit ne fait pas disparaître le
  // parent.
  const allowedChildren = (n: NavItem): NavItem[] =>
    (n.children ?? []).filter((c) => (!c.gate || gateOpen[c.gate]) && modules.includes(c.module));

  return NAVIGATION.reduce<NavItem[]>((acc, n) => {
    if (n.gate && !gateOpen[n.gate]) return acc;
    const kids = allowedChildren(n);
    if (!n.tabs) {
      if (modules.includes(n.module)) acc.push(kids.length ? { ...n, children: kids } : { ...n, children: undefined });
      return acc;
    }
    // Entrées fusionnées (`tabs`) : visibles si l'utilisateur a accès à au moins un onglet ; le
    // lien pointe vers le premier onglet autorisé, et `match` couvre les chemins de tous les
    // onglets pour le surlignage.
    const accessible = n.tabs.filter(tabVisible);
    if (accessible.length > 0) {
      acc.push({ ...n, href: accessible[0].href, match: n.tabs.map((t) => t.href), children: kids.length ? kids : undefined });
    }
    return acc;
  }, []);
}
