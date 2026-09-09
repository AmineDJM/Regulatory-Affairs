/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DÉSIGNER UNE PERSONNE — module PUR, au socle, sans aucun import.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * La conversation ET le moteur de missions ont tous deux besoin de lire « qui », et ils n'ont
 * pas le droit de se parler (§118.13, frontière L2). La lecture vit donc au socle, comme
 * `mutations/empreinte.ts`.
 *
 * ── LE DÉFAUT, MESURÉ LIVE (chaîne regulatory, mission cmtsdqc17…) ──────────────────────
 *
 *   STEP_FAILED — « Destinataire «  » introuvable ou ambigu ».
 *
 * Le destinataire n'était pas introuvable : c'était l'objet rendu par `resolve_person`,
 *
 *   { nom: "Amel Haddad", adresse: "amel.haddad@adventum-bench.dz", source: "compte ERP", … }
 *
 * déployé tel quel par l'éventail sur l'entrée `recipientName`. Le lecteur attendait une
 * CHAÎNE ; il a reçu un objet, `asStr` a rendu `""`, et l'erreur a annoncé introuvable ce qui
 * était parfaitement identifié — nom ET adresse. Un « je ne peux pas » artificiel (§63), de la
 * même famille que « Nom <adresse> » refusé alors que l'adresse était là (§118.21). Deux
 * personnes n'ont jamais reçu leur demande, la chaîne est morte, la mission a fini BLOCKED.
 *
 * ── CE QUE CE MODULE FAIT, ET CE QU'IL REFUSE DE FAIRE ─────────────────────────────────
 *
 * Il rend une DÉSIGNATION textuelle — la forme que tous les clients de courrier emploient et
 * que `resolvePerson` sait déjà lire. Il ne résout rien, ne touche à aucune base : il traduit.
 *
 * Il rend `null` sur tout ce qu'il ne lit pas à coup sûr (§104.5 : un décodeur ne devine
 * jamais). Un `null` n'ouvre aucune porte — il laisse le refus habituel se produire, avec
 * désormais le vrai contenu reçu dans le message.
 *
 * UNE désignation vaut pour UNE personne. Une liste d'un seul élément désigne cette
 * personne-là, sans ambiguïté. Une liste de plusieurs n'en désigne AUCUNE : la collapser
 * silencieusement choisirait un destinataire à la place d'un humain, et c'est exactement la
 * cardinalité fausse que le compilateur existe pour refuser (§118.3).
 */

/** Les clés qui portent un NOM. `title`, `role`, `detail` en sont exclus : ce sont des fonctions. */
const CLES_NOM = ["nom", "name", "nomComplet", "fullName", "displayName", "recipientName", "libelle"] as const;

/** Les clés qui portent une ADRESSE. */
const CLES_ADRESSE = ["adresse", "email", "mail", "adresseEmail", "emailAddress", "address"] as const;

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const estAdresse = (s: string): boolean => /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(s);

function premier(o: Record<string, unknown>, cles: readonly string[]): string {
  for (const c of cles) {
    const v = texte(o[c]);
    if (v) return v;
  }
  return "";
}

/** Ce qu'une désignation porte, une fois séparé. Toujours les deux clés (§118.20). */
export interface PersonneLue {
  /** Le nom tel qu'il est écrit, ou `null`. */
  nom: string | null;
  /** L'adresse, seulement si c'en est une, ou `null`. */
  adresse: string | null;
}

/**
 * SÉPARE une désignation en nom et adresse. `null` quand rien de sûr ne s'y lit : liste vide,
 * liste de plusieurs, objet sans nom ni adresse, nombre, booléen, `undefined`.
 *
 * Lit aussi la forme à chevrons — `« Yacine Benali <yacine@x.dz> »` — parce que c'est celle que
 * tout modèle écrit et celle que ce module lui-même produit : ce qui sort d'ici doit pouvoir y
 * rentrer.
 */
export function lirePersonne(valeur: unknown): PersonneLue | null {
  if (typeof valeur === "string") {
    const brut = valeur.trim();
    if (!brut) return null;
    const chevrons = brut.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
    if (chevrons) {
      const nom = chevrons[1].trim();
      return { nom: nom || null, adresse: chevrons[2].toLowerCase() };
    }
    return estAdresse(brut) ? { nom: null, adresse: brut.toLowerCase() } : { nom: brut, adresse: null };
  }

  if (Array.isArray(valeur)) {
    // Un seul élément désigne sans ambiguïté ; zéro ou plusieurs ne désignent personne.
    return valeur.length === 1 ? lirePersonne(valeur[0]) : null;
  }

  if (!valeur || typeof valeur !== "object") return null;
  const o = valeur as Record<string, unknown>;

  const nom = premier(o, CLES_NOM);
  const adresse = premier(o, CLES_ADRESSE);
  // Un objet peut lui aussi porter la forme à chevrons dans son champ « nom ».
  if (nom && !adresse) return lirePersonne(nom);
  if (!nom && !adresse) return null;
  return { nom: nom || null, adresse: estAdresse(adresse) ? adresse.toLowerCase() : null };
}

/**
 * Traduit ce qu'un plan, un modèle ou un éventail a mis dans une entrée « qui » en une
 * désignation lisible — `« Nom <adresse> »`, un nom seul, ou une adresse seule.
 *
 * `null` dans les mêmes cas que `lirePersonne`.
 */
export function designationDePersonne(valeur: unknown): string | null {
  const lu = lirePersonne(valeur);
  if (!lu) return null;
  if (lu.nom && lu.adresse) return `${lu.nom} <${lu.adresse}>`;
  return lu.nom ?? lu.adresse;
}

/**
 * Ce qu'on AFFICHE dans un refus. Le message disait « Destinataire «  » » quand l'entrée était
 * un objet : illisible pour la personne qui lit le journal, et trompeur — il laissait croire
 * que rien n'avait été fourni. On montre donc ce qui est réellement arrivé, borné.
 */
export function direCeQuiEstArrive(valeur: unknown, max = 160): string {
  if (valeur === undefined) return "(rien)";
  let brut: string;
  if (typeof valeur === "string") {
    brut = valeur.trim();
  } else {
    try {
      brut = JSON.stringify(valeur) ?? String(valeur);
    } catch {
      brut = String(valeur);
    }
  }
  // La borne vaut pour TOUTES les formes : un corps de message de neuf mille caractères collé
  // dans un champ « destinataire » remplirait sinon le journal et la carte d'approbation.
  return brut.length <= max ? brut : `${brut.slice(0, max - 1)}…`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * UN COLLECTIF N'EST PAS UNE PERSONNE — et le refus doit le dire à QUI le lit (§118.68).
 *
 * ── LE DÉFAUT, MESURÉ LIVE — DEUX MISSIONS, TROIS FOIS ─────────────────────────────────
 *
 * Le planificateur écrit `recipientName: "Équipe Regulatory"`. `send_message` refuse, à juste
 * titre. Mais son refus dit « précisez le bon collègue » — une phrase écrite pour une PERSONNE
 * devant un écran. Dans une mission, le lecteur est le PLANIFICATEUR, et il l'a suivie à la
 * lettre : le sous-plan suivant posait une question au DIRIGEANT (« Indiquez le nom complet du
 * coordinateur Regulatory »). La mission s'est arrêtée là, en attente d'une réponse que
 * personne n'avait à donner — alors que l'ANNUAIRE, lui, connaît ces personnes.
 *
 * C'est la règle 12 du planificateur (« le dirigeant n'est PAS la première source ») défaite
 * par un message d'erreur. Un refus qui nomme le remède du mauvais destinataire enseigne le
 * mauvais geste (§118.30).
 *
 * ── CE QUE CETTE LECTURE FAIT, ET CE QU'ELLE NE FAIT PAS ───────────────────────────────
 *
 * Elle reconnaît un NOM DE GROUPE à un fait du TEXTE : un nom commun collectif en tête de la
 * désignation. Le vocabulaire est FERMÉ et court, comme celui des totaux (§118.59) : l'ouvrir
 * ferait prendre « Direction Benali » — un patronyme — pour un service.
 *
 * Elle ne résout RIEN et ne devine RIEN. « Amel Haddad » n'est pas un collectif ; « Regulatory »
 * seul non plus (c'est peut-être un identifiant de compte, et refuser à tort est pire que le
 * défaut qu'on corrige, §118.27). Il faut le MOT du collectif, en tête, suivi de quelque chose.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
const MOTS_COLLECTIFS = [
  "equipe", "team", "service", "departement", "direction", "pole", "cellule",
  "groupe", "comite", "commission", "bureau", "unite", "staff",
] as const;

/** Sans accents, sans ponctuation de tête, en minuscules — la seule normalisation utile ici. */
const sansAccent = (v: string): string =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * CETTE DÉSIGNATION NOMME-T-ELLE UN GROUPE PLUTÔT QU'UNE PERSONNE ?
 *
 * Rend le mot collectif reconnu, ou `null`. `null` ne ferme aucune porte : le refus habituel
 * se produit, simplement sans le conseil spécifique.
 */
export function collectifDesigne(valeur: unknown): string | null {
  const texte = typeof valeur === "string" ? valeur : designationDePersonne(valeur);
  if (!texte) return null;
  // Un article ou une préposition de tête ne change pas la nature du nom : « l'équipe Regulatory ».
  const nu = sansAccent(texte).replace(/^(?:a |au |aux |le |la |les |l['’]|du |de la |de |des )+/u, "").trim();
  const mots = nu.split(/[^a-z0-9]+/u).filter(Boolean);
  const tete = mots[0] ?? "";
  if (!(MOTS_COLLECTIFS as readonly string[]).includes(tete)) return null;
  // « Équipe » TOUT SEUL ne désigne rien du tout — ni personne, ni groupe nommé. On se tait :
  // le refus générique est déjà juste, et ajouter un conseil sur un vide serait du bruit.
  if (mots.length < 2) return null;
  return tete;
}

/**
 * LE REMÈDE, DIT AU PLANIFICATEUR — pas à une personne devant un écran.
 *
 * Une seule phrase, et elle doit contenir les deux gestes : LIRE l'annuaire, puis DÉPLOYER en
 * éventail. Sans le second, le plan corrigé écrirait un seul envoi à N personnes, c'est-à-dire
 * la cardinalité fausse de §118.3.
 */
export const CONSEIL_COLLECTIF =
  "Un service n'est pas un destinataire : une étape d'envoi vise UNE personne. Liste d'abord les "
  + "personnes de cette équipe (search_people / directory_list / resolve_person), puis déploie "
  + "l'envoi en ÉVENTAIL sur la liste obtenue. Ne demande pas ce nom au demandeur : l'annuaire "
  + "le connaît, et une mission qui commence par une question au dirigeant est une mission mal "
  + "enquêtée.";
