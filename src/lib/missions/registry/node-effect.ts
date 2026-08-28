/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EFFET D'UN NŒUD QUI N'APPELLE AUCUNE CAPACITÉ — la table, et elle est UNIQUE.
 *
 * ── LE FAUX VERT QUI A RENDU CE FICHIER NÉCESSAIRE ──────────────────────────────────────
 *
 * Le plafond de lecture d'une mission se lisait sur les CAPACITÉS. Un nœud `ARTIFACT` n'en
 * porte pas — et il fabrique un fichier XLSX qu'il dépose dans le Drive de production. Sur un
 * run réel, le diagnostic a donc affiché `READ_ONLY_EXECUTION PASS` pendant que deux missions
 * écrivaient de vrais classeurs, retrouvés ensuite par le run SUIVANT, qui en concluait que la
 * molécule « inexistante » existait.
 *
 * Le trou avait EXACTEMENT une forme, et on la reconnaît partout : `if (!capability) continue`.
 *
 * ── POURQUOI UNE TABLE PARTAGÉE, ET PAS DEUX COPIES ─────────────────────────────────────
 *
 * Le compilateur calculait l'effet des nœuds sans capacité dans une cascade de `else if`, et le
 * diagnostic en tenait une seconde, écrite à la main, avec le commentaire « la même table que le
 * compilateur, et c'est voulu ». Deux tables identiques le jour où on les écrit sont deux tables
 * différentes le jour où quelqu'un ajoute un type de nœud — et c'est TOUJOURS celle qui garde
 * qui reste en arrière. On en garde une, exhaustive par le type, et le compilateur comme le
 * diagnostic la consultent.
 *
 * ── EXHAUSTIVE PAR CONSTRUCTION ─────────────────────────────────────────────────────────
 *
 * `Record<NodeType, Effect>` : ajouter un type de nœud sans lui donner d'effet ne compile pas.
 * C'est la garantie que réclame §5 du lot — « ne laisse aucune porte `if (!capability)` ».
 *
 * ── CE QUE CHAQUE VALEUR SIGNIFIE, ET POURQUOI ──────────────────────────────────────────
 *
 * La question n'est jamais « ce nœud est-il compliqué ? » mais « QU'EST-CE QUI SORT ? ».
 *
 *   CAPABILITY   l'effet vient du REGISTRE de la capacité, pas d'ici. La valeur `READ` posée
 *                dans la table est le plancher qui s'applique quand — et seulement quand — le
 *                nœud est déclaré CAPABILITY sans capacité nommée : une étape vide ne produit
 *                rien. Le compilateur, lui, refuse cette forme.
 *   WORKER       appelle un modèle et rend une structure. Rien ne sort vers l'ERP : ANALYZE.
 *   ARTIFACT     FABRIQUE UN FICHIER et le dépose. C'est un effet, et c'est PREPARE.
 *   APPROVAL     une porte : elle attend, elle ne produit pas. READ.
 *   QA           compte des reçus déjà écrits. READ.
 *   JOIN         ne fait littéralement rien. READ.
 *   WAIT_EVENT   dort jusqu'à un événement. READ.
 *   WAIT_INPUT   dort jusqu'à un humain. READ.
 *
 * `READ` plutôt qu'un niveau « NONE » : le barème n'a pas de degré zéro, et en inventer un
 * obligerait à réordonner `EFFECT_RANK` — donc à toucher la comparaison sur laquelle repose
 * chaque garde. `READ` est déjà le plancher, et « ne produit rien » est un cas particulier de
 * « ne produit rien d'observable ailleurs ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { NodeType } from "@/lib/missions/planner/contract";
import type { Effect } from "@/lib/missions/registry/capability-meta";

/**
 * L'EFFET STRUCTUREL DE CHAQUE TYPE DE NŒUD.
 *
 * Pour un nœud CAPABILITY, c'est le registre qui tranche — cette entrée n'est que le plancher
 * d'une étape sans capacité nommée.
 */
export const EFFET_NOEUD: Record<NodeType, Effect> = {
  CAPABILITY: "READ",
  WORKER: "ANALYZE",
  ARTIFACT: "PREPARE",
  APPROVAL: "READ",
  QA: "READ",
  JOIN: "READ",
  WAIT_EVENT: "READ",
  WAIT_INPUT: "READ",
};

/**
 * L'EFFET D'UN NŒUD, quel qu'il soit — la seule fonction que les appelants ont besoin d'appeler.
 *
 * `effetCapacite` est fourni par l'appelant parce que la façon de l'obtenir diffère : le
 * compilateur consulte le CATALOGUE de l'acteur (qui connaît les droits), le diagnostic consulte
 * le registre brut. Ce qui ne diffère pas, c'est la règle — et c'est elle qui vit ici.
 *
 * Un type de nœud inconnu (une ligne insérée en base à la main, un plan d'une version
 * antérieure) rend le défaut le plus PRUDENT du barème plutôt que `READ` : ne pas savoir ce
 * qu'une étape produit n'est pas une raison de la croire inoffensive.
 */
export function effetDuNoeud(nodeType: string, effetCapacite?: Effect | null): Effect {
  if (effetCapacite) return effetCapacite;
  const connu = Object.prototype.hasOwnProperty.call(EFFET_NOEUD, nodeType);
  return connu ? EFFET_NOEUD[nodeType as NodeType] : "EXTERNAL_COMMUNICATION";
}
