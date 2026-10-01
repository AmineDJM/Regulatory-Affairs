/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ SE RÈGLE LA LIAISON AU SITE (§118.160) — une adresse et son nom, écrits UNE fois.
 *
 * La connexion au site public (la clé que l'ERP fabrique, la vérification, le rapprochement à la
 * demande, le blocage, ce que le site dit de lui-même, la mise en service) ne vit plus dans le
 * module « Site web », que tiennent aussi la Direction, la Direction Marketing et les RH : elle vit
 * dans la console d'administration, et seul le Super Admin l'ouvre.
 *
 * Quatre sortes de lecteurs doivent nommer cet endroit : l'écran de publication (qui y renvoie),
 * les alertes (dont le lien y mène), les refus des actions (qui disent où aller) et les motifs de
 * blocage (qui disent quoi y faire). Quatre rédactions de la même adresse finiraient par en donner
 * deux (§118.5) — et un lien vers l'ancien écran enverrait le Super Admin chercher une clé là où
 * elle n'est plus. Module PUR, sans le moindre import : les écrans du navigateur en ont besoin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const ECRAN_LIAISON = {
  href: "/admin/site-web",
  // Le nom est celui de l'ONGLET que la personne verra dans la console (`ADMIN_TABS`) : un chemin
  // qu'on ne retrouve pas mot pour mot à l'écran fait chercher un endroit qui n'existe pas. Un banc
  // compare les deux (liaison-portes.test.ts).
  nom: "Administration › Site web (connexion)",
} as const;

/** Le refus d'un geste de liaison demandé par quelqu'un d'autre que le Super Admin — il dit où aller. */
export const REFUS_LIAISON =
  `La connexion au site se gère depuis ${ECRAN_LIAISON.nom}, par un Super Admin : c'est la clé qui donne le droit de publier sur le site public.`;
