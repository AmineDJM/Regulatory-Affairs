"use server";

import { requireUser } from "@/lib/session";
import { fdStr } from "@/lib/actions/types";
import { peutEcrireArticles, peutPublierOffres } from "@/lib/site-web/acces";
import { lignes } from "@/lib/site-web/contrat";
import type { ArticleRedige, OffreRedigee, ResultatRedaction } from "@/lib/site-web/redaction";
import { redigerArticle, redigerOffre } from "@/lib/redaction-site-ia";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « RÉDIGER AVEC L'IA » — les deux portes de l'écran (§118.160).
 *
 * Mêmes droits que l'écriture du contenu : rédiger un article demande le module « Site web » en
 * écriture, une offre la porte des RH. Rien n'est ENREGISTRÉ ici : les champs rédigés reviennent
 * au formulaire, la personne les relit et les corrige, puis c'est `enregistrerArticle` /
 * `enregistrerOffre` qui écrivent — avec leurs propres contrôles.
 *
 * Les entrées se lisent clé par clé, EN LITTÉRAL : une clé que cette lecture ne nomme pas n'atteint
 * jamais le modèle, quoi que l'écran — ou une requête forgée — ait envoyé. La demande de
 * recrutement n'est PAS lue : l'offre ne transmet que ce que son formulaire porte, donc ni la
 * rémunération ni la justification. (Un lecteur importé d'un autre fichier ferait sortir l'action
 * « illisible » de la fiche dérivée — §118.143 : la lecture vit dans l'action.)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const REFUS_ARTICLES = "Rédiger un article demande le module « Site web » en écriture — un Super Admin l'ouvre dans Administration › Accès.";
const REFUS_OFFRES = "Rédiger une offre d'emploi demande les droits des RH (« Ressources humaines » en écriture) ou la direction.";

export async function redigerArticleAvecIA(formData: FormData): Promise<ResultatRedaction<ArticleRedige>> {
  const user = await requireUser();
  if (!peutEcrireArticles(user)) return { ok: false, error: REFUS_ARTICLES };
  return redigerArticle(user.id, {
    consigne: fdStr(formData, "consigne") ?? "",
    titre: fdStr(formData, "title"),
    description: fdStr(formData, "description"),
    corps: fdStr(formData, "body"),
    categorie: fdStr(formData, "category"),
    categories: formData.getAll("categories").filter((x): x is string => typeof x === "string" && x.trim().length > 0),
  });
}

export async function redigerOffreAvecIA(formData: FormData): Promise<ResultatRedaction<OffreRedigee>> {
  const user = await requireUser();
  if (!peutPublierOffres(user)) return { ok: false, error: REFUS_OFFRES };
  return redigerOffre(user.id, {
    consigne: fdStr(formData, "consigne") ?? "",
    titre: fdStr(formData, "title"),
    departement: fdStr(formData, "department"),
    lieu: fdStr(formData, "location"),
    contrat: fdStr(formData, "contractLabel"),
    experience: fdStr(formData, "experience"),
    resume: fdStr(formData, "summary"),
    missions: lignes(fdStr(formData, "mission")),
    profil: lignes(fdStr(formData, "profile")),
    offre: lignes(fdStr(formData, "offer")),
  });
}
