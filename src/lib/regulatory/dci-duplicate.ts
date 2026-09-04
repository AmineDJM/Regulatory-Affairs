/**
 * UNE DCI QUI EXISTE DÉJÀ — le dire AVANT, pas après.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Rien n'empêchait d'ouvrir un second dossier sur une molécule déjà suivie. Deux dossiers pour
 * un même produit, ce n'est pas un doublon de saisie : c'est deux historiques réglementaires
 * parallèles, deux séries d'étapes ANPP, deux interlocuteurs — et l'un des deux finit par vivre
 * sa vie sans que personne ne le sache.
 *
 * ── POURQUOI ON AVERTIT SANS INTERDIRE ──────────────────────────────────────────────────────
 *
 * Parce qu'une même DCI porte légitimement PLUSIEURS dossiers : un autre dosage, une autre
 * forme, un autre partenaire. Interdire ferait chercher un contournement — et l'on créerait le
 * second dossier sous une DCI mal orthographiée, ce qui est pire : il ne serait même plus
 * rapprochable du premier.
 *
 * On dit donc ce qui existe, on demande de VÉRIFIER, et l'on laisse passer celui qui a vérifié.
 *
 * ── ET CE QU'ON NE VOIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Un dossier au PIPELINE est verrouillé : il existe, et l'on n'a pas le droit de le voir. Dire
 * « cette DCI existe » sans rien montrer serait une énigme — on chercherait à l'écran un dossier
 * invisible et l'on conclurait à une panne. On dit donc combien sont hors de portée, et l'on
 * offre le geste qui débloque : demander l'accès.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/**
 * LA CLÉ DE COMPARAISON D'UNE DCI.
 *
 * Majuscules, espaces normalisés — et pour une ASSOCIATION, les molécules TRIÉES : « AMOXICILLINE
 * + ACIDE CLAVULANIQUE » et « ACIDE CLAVULANIQUE + AMOXICILLINE » sont la même association, et
 * les traiter comme deux DCI différentes laisserait passer exactement le doublon qu'on cherche.
 *
 * Les accents sont retirés : le référentiel est saisi à la main, et « PARACÉTAMOL » ne doit pas
 * échapper à « PARACETAMOL ».
 */
export function dciKey(dci: string): string {
  const nu = dci
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return nu
    .split("+")
    .map((m) => m.trim())
    .filter(Boolean)
    .sort()
    .join(" + ");
}

/** Deux DCI désignent-elles la même molécule (ou la même association) ? */
export function sameDci(a: string, b: string): boolean {
  return dciKey(a) === dciKey(b);
}

/** Un dossier existant, tel qu'on peut le montrer à celui qui saisit. */
export interface ExistingDossier {
  id: string;
  reference: string;
  brandName: string | null;
  dosage: string | null;
  pharmaceuticalForm: string | null;
}

export interface DciDuplicate {
  /** Les dossiers que cette personne PEUT ouvrir — on les nomme, elle ira vérifier. */
  visible: ExistingDossier[];
  /** Combien existent qu'elle ne peut PAS voir (pipeline verrouillé, autre entité). */
  hidden: number;
}

/** Y a-t-il quelque chose à signaler ? */
export function hasDuplicate(d: DciDuplicate): boolean {
  return d.visible.length > 0 || d.hidden > 0;
}

/**
 * FAUT-IL PROPOSER DE DEMANDER L'ACCÈS ?
 *
 * Seulement s'il existe un dossier hors de portée. Proposer le bouton quand tout est visible
 * ferait demander un accès qu'on a déjà — et le jour où il compte, on ne le cliquerait plus.
 */
export function needsAccessRequest(d: DciDuplicate): boolean {
  return d.hidden > 0;
}

/** Comment se nomme un dossier dans le message — assez pour le reconnaître, pas plus. */
export function dossierLabel(d: ExistingDossier): string {
  const details = [d.brandName, d.dosage, d.pharmaceuticalForm].filter(Boolean).join(" · ");
  return details ? `${d.reference} — ${details}` : d.reference;
}

/**
 * CE QU'ON ÉCRIT À CELUI QUI SAISIT.
 *
 * Trois choses, dans cet ordre : ce qui existe, ce qu'il doit vérifier, et ce qu'il peut faire
 * si le dossier lui est invisible. Un avertissement qui ne dit pas quoi faire ensuite se lit
 * comme un refus.
 */
export function duplicateNotice(dci: string, d: DciDuplicate): string | null {
  if (!hasDuplicate(d)) return null;
  const parts: string[] = [];
  const total = d.visible.length + d.hidden;
  parts.push(
    total > 1
      ? `${total} dossiers portent déjà la DCI « ${dci} ».`
      : `Un dossier porte déjà la DCI « ${dci} ».`,
  );
  if (d.visible.length > 0) {
    parts.push(`Déjà suivi${d.visible.length > 1 ? "s" : ""} : ${d.visible.map(dossierLabel).join(" ; ")}.`);
  }
  parts.push("Vérifiez d'abord qu'il s'agit bien d'un dosage, d'une forme ou d'un produit différent.");
  if (d.hidden > 0) {
    parts.push(
      d.hidden > 1
        ? `${d.hidden} de ces dossiers ne vous sont pas visibles (pipeline à l'étude, ou autre entité). Si vous ne les voyez pas sur votre écran, demandez l'accès.`
        : "Ce dossier ne vous est pas visible (pipeline à l'étude, ou autre entité). Si vous ne le voyez pas sur votre écran, demandez l'accès.",
    );
  }
  return parts.join(" ");
}
