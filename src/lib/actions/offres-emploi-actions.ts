"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { lignes, refusOffre, type OffreSaisie } from "@/lib/site-web/contrat";
import { posteOuvert, retirerDuSite, synchroniserOffre, type ResultatSynchro } from "@/lib/site-web/contenus";
import { peutPublierOffres } from "@/lib/site-web/acces";
import { recruitmentScope } from "@/lib/recruitment/access";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES OFFRES D'EMPLOI DU SITE PUBLIC (§118.158) — rédigées et publiées par les RH.
 *
 * Une offre découle le plus souvent d'une demande de recrutement : elle en reprend l'intitulé,
 * le département, le contrat, les missions et les compétences — JAMAIS la rémunération ni la
 * justification, qui restent sur la demande interne. Elle n'est publique que tant que le poste
 * est ouvert : préparée avant, elle part en ligne quand les RH ouvrent le poste ; pourvue ou
 * close, elle repasse en brouillon d'elle-même (`synchroniserOffreDeLaDemande`).
 *
 * Aucun de ces gestes n'est offert à Adam : publier une offre sur le site public engage l'entreprise
 * auprès de candidats, c'est un clic des RH. La décision (EXCLUDED, `action-registry.ts`) est lue par
 * le chemin générique avant de proposer comme avant d'exécuter (`refusDuCheminGenerique`, §118.158).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const AUDIT_MODULE = "Recrutement";
// L'audit porte l'IDENTIFIANT du contenu sans type d'entité, comme la fiche de coaching (§118.157) :
// un `EntityType` de plus ouvrirait la porte polymorphe des pièces jointes, commentaires et tâches
// (`canAccessEntity`) à un objet qui n'en porte aucune — une décision de permission que rien ne demande.
const REFUS = "Les offres d'emploi du site se publient par les RH (droit « Ressources humaines » en écriture) et la direction.";
const INTENTIONS = ["brouillon", "publier", "enregistrer", "retirer"] as const;
type Intention = (typeof INTENTIONS)[number];

function revalider(id?: string, demandeId?: string | null) {
  revalidatePath("/site-web");
  revalidatePath("/site-web/offres");
  if (id) revalidatePath(`/site-web/offres/${id}`);
  if (demandeId) revalidatePath(`/recrutement/${demandeId}`);
}

function phraseOffre(intention: Intention, s: ResultatSynchro, ouvert: boolean): string {
  if (s.etat === "BROUILLON") return "Brouillon enregistré — rien n'est envoyé au site tant que l'offre n'est pas publiée.";
  if (s.etat === "INCHANGE") return `Enregistré. ${s.message}`;
  if (intention === "publier") {
    return ouvert
      ? "Publication demandée : l'offre part vers le site. Son état passe à « En ligne » dès que le site confirme."
      : "Enregistrée pour publication — le poste n'est pas ouvert : elle reste invisible sur le site et passera en ligne quand les RH ouvriront le poste.";
  }
  if (intention === "retirer") return "Retrait demandé : le site repasse l'offre en brouillon, invisible des candidats.";
  return "Enregistrée : la mise à jour part vers le site.";
}

/** CRÉE OU MODIFIE UNE OFFRE, et la met en file si elle doit être sur le site. */
export async function enregistrerOffre(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutPublierOffres(user)) return { ok: false, error: REFUS };

  const id = fdStr(formData, "id");
  const intentionBrute = fdStr(formData, "intention") ?? "enregistrer";
  if (!(INTENTIONS as readonly string[]).includes(intentionBrute)) return { ok: false, error: `Geste inconnu : « ${intentionBrute} ».` };
  const intention = intentionBrute as Intention;
  const recruitmentRequestId = fdStr(formData, "recruitmentRequestId");

  const title = fdStr(formData, "title") ?? "";
  if (!title) return { ok: false, error: "L'intitulé du poste est obligatoire : c'est lui qui forme l'adresse de la page (/carrieres/…)." };

  const avant = id
    ? await prisma.jobPosting.findUnique({ where: { id }, select: { id: true, published: true, recruitmentRequestId: true } })
    : null;
  if (id && !avant) return { ok: false, error: "Offre introuvable." };

  // Le rattachement à un recrutement se fait À LA CRÉATION, et une demande ne porte qu'une offre.
  const demandeId = avant ? avant.recruitmentRequestId : recruitmentRequestId;
  let etape: string | null = null;
  if (!avant && recruitmentRequestId) {
    // RATTACHER, c'est lire la demande : sous la porte du recrutement, comme la page qui prépare
    // l'offre (`recruitmentScope`, composée en `AND`). Hors portée, elle est « introuvable ».
    const demande = await prisma.recruitmentRequest.findFirst({
      where: { AND: [{ id: recruitmentRequestId }, recruitmentScope(user)] },
      select: { stage: true, jobPosting: { select: { id: true } } },
    });
    if (!demande) return { ok: false, error: "Demande de recrutement introuvable." };
    if (demande.jobPosting) return { ok: false, error: "Cette demande a déjà son offre : modifiez-la plutôt que d'en créer une seconde.", id: demande.jobPosting.id };
    etape = demande.stage;
  } else if (demandeId) {
    // Pas de portée ICI, et c'est voulu : l'offre est DÉJÀ rattachée, cette lecture ne dit que si le
    // poste est ouvert, pour la phrase. Et la bornée rendrait `null` hors portée, donc « poste
    // ouvert » : la phrase annoncerait en ligne une offre que la synchronisation — qui lit l'étape
    // sans acteur — laisse en brouillon.
    etape = (await prisma.recruitmentRequest.findUnique({ where: { id: demandeId }, select: { stage: true } }))?.stage ?? null;
  }
  const ouvert = posteOuvert(demandeId ? etape : null);

  const published = intention === "publier" ? true : intention === "enregistrer" ? (avant?.published ?? false) : false;
  const saisie: OffreSaisie = {
    title,
    department: fdStr(formData, "department"),
    location: fdStr(formData, "location"),
    type: fdStr(formData, "contractLabel"),
    experience: fdStr(formData, "experience"),
    summary: fdStr(formData, "summary"),
    mission: lignes(fdStr(formData, "mission")),
    profile: lignes(fdStr(formData, "profile")),
    offer: lignes(fdStr(formData, "offer")),
    published,
  };
  const dejaEnvoye = avant ? (await prisma.sitePublication.count({ where: { kind: "JOB", externalId: avant.id } })) > 0 : false;
  // Jugée AVANT d'écrire : une offre acceptée ici et refusée par le site ferait croire à une
  // publication qui n'aura pas lieu.
  if (published || dejaEnvoye) {
    const refus = refusOffre(saisie);
    if (refus.length) return { ok: false, error: refus.join("\n") };
  }

  const data = {
    title: saisie.title, department: saisie.department, location: saisie.location, contractLabel: saisie.type,
    experience: saisie.experience, summary: saisie.summary, mission: [...saisie.mission], profile: [...saisie.profile],
    offer: [...saisie.offer], published, updatedById: user.id,
  };
  const offre = avant
    ? await prisma.jobPosting.update({ where: { id: avant.id }, data, select: { id: true } })
    : await prisma.jobPosting.create({ data: { ...data, recruitmentRequestId: recruitmentRequestId ?? null, createdById: user.id }, select: { id: true } });

  await recordAudit({
    actorId: user.id, action: avant ? "UPDATE" : "CREATE", module: AUDIT_MODULE, entityId: offre.id,
    summary: `${intention === "publier" ? "Publication" : intention === "retirer" ? "Retrait du site" : avant ? "Modification" : "Création"} de l'offre « ${title} »`,
  });

  const synchro = await synchroniserOffre(offre.id, user.id);
  revalider(offre.id, demandeId);
  if (synchro.etat === "REFUSE") return { ok: false, id: offre.id, error: synchro.message };
  return { ok: true, id: offre.id, message: phraseOffre(intention, synchro, ouvert) };
}

/**
 * SUPPRIME UNE OFFRE — et la retire du site si elle y était. Le contrat recommande plutôt de la
 * RETIRER (brouillon côté site) ; l'écran le propose d'abord.
 */
export async function supprimerOffre(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutPublierOffres(user)) return { ok: false, error: REFUS };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Offre manquante." };
  const o = await prisma.jobPosting.findUnique({ where: { id }, select: { id: true, title: true, recruitmentRequestId: true } });
  if (!o) return { ok: false, error: "Offre introuvable." };

  const retrait = await retirerDuSite("JOB", o.id, o.title, user.id);
  await prisma.jobPosting.delete({ where: { id: o.id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: AUDIT_MODULE, entityId: o.id, summary: `Suppression de l'offre « ${o.title} »` });
  revalider(undefined, o.recruitmentRequestId);
  return { ok: true, message: retrait.enFile ? "Offre supprimée. Sa page est retirée du site." : "Offre supprimée (elle n'était pas sur le site)." };
}
