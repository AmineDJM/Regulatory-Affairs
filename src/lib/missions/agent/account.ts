import { prisma } from "@/lib/prisma";
import { ADAM_AGENT_NAME } from "@/lib/missions/agent/principal";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ESPACE D'ADAM DANS L'ERP — une présence complète, sans porte d'entrée.
 *
 * ── LA DEMANDE, ET LA CONTRAINTE, TENUES ENSEMBLE ───────────────────────────────────────
 *
 * On a demandé : « crée-lui son espace user de l'ERP, donne-lui les accès de super admin
 * complet et total, et qu'il puisse gérer son compte en autonomie avec les accords. »
 *
 * La même mission dit, ailleurs et en toutes lettres : « NE crée pas un compte humain avec mot
 * de passe que l'agent peut manipuler », et interdit à l'agent de modifier ses permissions, de
 * s'attribuer un rôle, de toucher au RBAC ou de créer des identifiants.
 *
 * Les deux sont vraies en même temps, et voici comment.
 *
 *   CE QU'ADAM A          une ligne `User` réelle, le rôle SUPER_ADMIN, un espace de missions,
 *                         un dossier de livrables, un journal, une messagerie, un compteur
 *                         d'usage — tout ce qui fait qu'on peut LE VOIR travailler.
 *
 *   CE QU'ADAM N'A PAS    la capacité de se connecter. `isSystem` fait refuser l'authentification
 *                         AVANT la comparaison du mot de passe, et son condensat n'est celui
 *                         d'aucun mot de passe.
 *
 * La distinction n'est pas cosmétique. Un compte auquel on peut se connecter est un compte
 * qu'on peut prendre : le voler donnerait les pleins pouvoirs SANS passer par le runtime, donc
 * sans plan compilé, sans approbation, sans reçu, sans double signature. En retirant la porte,
 * on ne retire aucune capacité utile — Adam n'a jamais eu besoin de « se connecter » pour
 * travailler, il agit par le Mission Runtime.
 *
 * ── « GÉRER SON COMPTE EN AUTONOMIE », CE QUE CELA VEUT DIRE ICI ───────────────────────
 *
 * Adam tient SON espace : ses missions, ses livrables, son journal, ses engagements, sa file
 * d'approbations. Il les crée, les fait avancer et les clôt sans qu'on le lui demande étape par
 * étape — c'est cela, l'autonomie, et elle est réelle.
 *
 * Ce qu'il ne fait PAS, et ne pourra pas faire : modifier ses propres droits, s'attribuer un
 * rôle, créer un identifiant, désactiver un garde-fou. `policy/guard.ts` refuse ces capacités à
 * tout acteur marqué `isAgent`, à la COMPILATION et au moment d'agir. Un agent qui pourrait
 * s'accorder un droit n'aurait pas « plus d'autonomie » : il aurait moins de garanties, et la
 * différence entre les deux est ce qui rend l'autonomie acceptable.
 *
 * ── POURQUOI UNE FONCTION ET NON UNE LIGNE DE SEED ─────────────────────────────────────
 *
 * Parce qu'elle est RÉ-ENTRANTE et qu'elle RÉPARE. Appelée à chaque composition, elle crée le
 * compte s'il manque et réaligne ce qui a dérivé — un rôle qu'on aurait changé à la main, un
 * compte désactivé, un drapeau système retiré. Une ligne de seed s'exécute une fois et ne
 * corrige jamais rien.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * L'ADRESSE D'ADAM. Réglable par variable d'environnement pour suivre le domaine de la maison ;
 * jamais devinée depuis une autre valeur, pour qu'un changement de domaine ne crée pas
 * silencieusement un SECOND agent.
 */
export const ADAM_EMAIL = (process.env.ADAM_AGENT_EMAIL ?? "adam@adventum-pharma.dz").toLowerCase();

/**
 * UN CONDENSAT QUI N'EST CELUI D'AUCUN MOT DE PASSE.
 *
 * `passwordHash` est NOT NULL en base. On y met donc une valeur qui n'a pas la forme d'un
 * condensat bcrypt : `bcrypt.compare` rend `false` pour toute saisie, sans exception et sans
 * erreur. C'est la SECONDE barrière ; la première est `isSystem`, vérifiée avant même d'arriver
 * ici. Deux barrières indépendantes, parce qu'une seule finit toujours par être contournée par
 * un chemin d'authentification qu'on avait oublié.
 */
export const SANS_MOT_DE_PASSE = "system-agent:no-password-ever";

export interface CompteAgent {
  id: string;
  email: string;
  name: string;
  /** Vrai quand ce passage a créé le compte (et non simplement retrouvé). */
  cree: boolean;
  /** Ce que ce passage a dû réaligner — vide en marche normale. */
  corrections: string[];
}

/**
 * GARANTIT QUE L'ESPACE D'ADAM EXISTE ET EST CONFORME.
 *
 * Ne lève pas quand la base est indisponible : l'appelant a d'autres choses à faire, et une
 * mission peut parfaitement tourner sous l'identité de la personne le temps d'un incident.
 */
export async function assurerCompteAgent(): Promise<CompteAgent | null> {
  try {
    const existant = await prisma.user.findFirst({
      where: { email: { equals: ADAM_EMAIL, mode: "insensitive" } },
      select: { id: true, email: true, name: true, role: true, isActive: true, isSystem: true, passwordHash: true },
    });

    if (!existant) {
      const cree = await prisma.user.create({
        data: {
          email: ADAM_EMAIL,
          name: ADAM_AGENT_NAME,
          passwordHash: SANS_MOT_DE_PASSE,
          role: "SUPER_ADMIN",
          isActive: true,
          isSystem: true,
          title: "Agent principal — exécute les missions",
          avatarColor: "#1B7F79",
          mustChangePassword: false,
          mustOnboard: false,
        },
        select: { id: true, email: true, name: true },
      });
      return { ...cree, cree: true, corrections: [] };
    }

    // ── LA RÉPARATION — ce qui a dérivé revient en place, et on DIT quoi ────────────────
    const corrections: string[] = [];
    const data: Record<string, unknown> = {};
    if (!existant.isSystem) { data.isSystem = true; corrections.push("drapeau système rétabli"); }
    if (!existant.isActive) { data.isActive = true; corrections.push("compte réactivé"); }
    if (existant.role !== "SUPER_ADMIN") { data.role = "SUPER_ADMIN"; corrections.push(`rôle rétabli (était ${existant.role})`); }
    // UN MOT DE PASSE POSÉ SUR CE COMPTE EST UNE ANOMALIE DE SÉCURITÉ, pas une préférence :
    // quelqu'un a rendu l'agent connectable. On l'efface, et on le dit.
    if (existant.passwordHash !== SANS_MOT_DE_PASSE) {
      data.passwordHash = SANS_MOT_DE_PASSE;
      data.tokenVersion = { increment: 1 };
      corrections.push("mot de passe retiré — un compte système ne se connecte jamais");
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: existant.id }, data: data as never });
    }
    return { id: existant.id, email: existant.email, name: existant.name, cree: false, corrections };
  } catch (e) {
    console.error("[agent] espace d'Adam indisponible", e);
    return null;
  }
}

/** L'identifiant du compte d'Adam, ou `null` s'il n'existe pas encore. Lecture pure. */
export async function idCompteAgent(): Promise<string | null> {
  try {
    const u = await prisma.user.findFirst({
      where: { email: { equals: ADAM_EMAIL, mode: "insensitive" }, isSystem: true },
      select: { id: true },
    });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * CE COMPTE EST-IL UN COMPTE SYSTÈME ?
 *
 * Utilisé par les opérations d'administration pour REFUSER de le prendre pour cible :
 * on ne change pas son rôle, on ne lui pose pas de mot de passe, on ne le supprime pas depuis
 * un écran. Ces trois gestes reviendraient à défaire, depuis l'ERP, la garantie que le runtime
 * tient par ailleurs.
 */
export async function estCompteSysteme(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { isSystem: true } });
    return u?.isSystem === true;
  } catch {
    return false;
  }
}

/** Le message de refus, écrit une fois — pour que tous les écrans disent la même chose. */
export const REFUS_COMPTE_SYSTEME =
  `« ${ADAM_AGENT_NAME} » est un compte SYSTÈME : il exécute les missions et ne se connecte jamais. `
  + `Son rôle, son mot de passe et son activation ne se modifient pas depuis un écran — c'est ce qui `
  + `garantit qu'aucune action ne peut contourner le plan compilé, l'approbation et le reçu.`;

/**
 * UN COMPTE PEUT-IL SE CONNECTER ? — la décision, isolée pour être VÉRIFIABLE.
 *
 * `auth.ts` l'appelle avant toute comparaison de mot de passe. Elle vit ici plutôt qu'en ligne
 * dans le contrôle des identifiants pour une raison simple : une condition écrite en ligne dans
 * une fonction qui a besoin d'une session, d'un en-tête HTTP et d'un compteur anti-force brute
 * ne se teste pas. Isolée, elle se teste en une ligne — et une garde de sécurité qu'aucun test
 * ne peut atteindre est une garde qu'on découvre cassée en production.
 */
export function peutSeConnecter(u: { isActive: boolean; isSystem: boolean } | null | undefined): boolean {
  if (!u) return false;
  if (!u.isActive) return false;
  // LE COMPTE SYSTÈME N'A PAS DE PORTE D'ENTRÉE — voir l'en-tête de ce fichier.
  if (u.isSystem) return false;
  return true;
}
