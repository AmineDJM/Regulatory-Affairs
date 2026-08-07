import { searchCorpus } from "./rag";
import { sectionByCode } from "../ctd/taxonomy";

/**
 * LES TEXTES OPPOSABLES QUI S'APPLIQUENT À UNE SECTION CTD.
 *
 * C'est le chaînon qui manquait. Le corpus était ingéré, versionné, activé — et **invisible pour
 * l'analyse principale**, qui ne s'appuyait que sur le socle codé en dur. Autrement dit : on
 * pouvait charger quarante lignes directrices sans que le moindre constat n'en tienne compte.
 *
 * La recherche part de la SECTION CTD plutôt que du texte du document, pour trois raisons :
 *   • c'est la section qui détermine quelles règles s'appliquent (3.2.P.8 → stabilité, 3.2.P.5 →
 *     méthodes analytiques), pas les mots qu'un rédacteur a employés ;
 *   • le résultat est le MÊME pour toutes les parts d'un document : une seule requête au lieu
 *     d'une par part, et surtout une empreinte de cache stable — sans quoi on repaierait
 *     l'analyse d'un document inchangé à chaque exécution ;
 *   • le texte d'une part contient des noms de produits et des chiffres qui polluent une
 *     recherche lexicale bien plus qu'ils ne l'orientent.
 *
 * Ne lève jamais : un corpus vide ou une base indisponible rend une liste vide, et l'analyse
 * continue sur le socle codé — dégradée, jamais interrompue.
 */
export interface CorpusExtract {
  label: string;
  snippet: string;
}

/** Mots-clés ajoutés à la requête selon la section — ce que la section VEUT dire. */
const SECTION_HINTS: { prefix: string; terms: string }[] = [
  { prefix: "3.2.S", terms: "substance active fabrication contrôle impuretés spécifications" },
  { prefix: "3.2.P.5", terms: "méthode analytique validation spécifications critères d'acceptation" },
  { prefix: "3.2.P.8", terms: "stabilité durée de conservation conditions de conservation zone climatique" },
  { prefix: "3.2.P", terms: "produit fini formulation procédé de fabrication contrôle" },
  { prefix: "2.3", terms: "résumé qualité" },
  { prefix: "2.5", terms: "aperçu clinique bénéfice risque" },
  { prefix: "2.7", terms: "résumé clinique efficacité sécurité" },
  { prefix: "4.2", terms: "études non cliniques toxicologie pharmacologie" },
  { prefix: "5.3", terms: "études cliniques bioéquivalence rapport d'étude" },
  { prefix: "1.3", terms: "étiquetage notice résumé des caractéristiques du produit" },
  { prefix: "1.2", terms: "dossier administratif formulaire de demande" },
];

function queryFor(ctdSection: string | null): string {
  const title = ctdSection ? sectionByCode(ctdSection)?.title ?? "" : "";
  const hint = ctdSection ? SECTION_HINTS.find((h) => ctdSection.startsWith(h.prefix))?.terms ?? "" : "";
  return [title, hint].filter(Boolean).join(" ").trim() || "dossier d'autorisation de mise sur le marché";
}

export async function corpusForSection(ctdSection: string | null, limit = 6): Promise<CorpusExtract[]> {
  try {
    const citations = await searchCorpus(queryFor(ctdSection), { limit });
    return citations.map((c) => ({
      // La référence est ce qui rend le constat opposable : autorité, texte, VERSION et article.
      label: `${c.authority} — ${c.title} (v. ${c.version})${c.heading ? `, ${c.heading}` : ""}${c.path ? ` [${c.path}]` : ""}`,
      snippet: c.snippet.replace(/\s+/g, " ").trim().slice(0, 700),
    }));
  } catch (e) {
    console.error("[corpus] recherche par section impossible (analyse poursuivie sans citations)", e);
    return [];
  }
}
