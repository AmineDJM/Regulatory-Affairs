import { describe, expect, it } from "vitest";

import { decideRollout } from "@/lib/assistant/context/rollout";
import { routeQuery } from "@/lib/assistant/context/router";
import { fitToolBudget, TOOL_DOMAINS_ALL } from "@/lib/assistant/context/tool-shortlist";
import { resolveTools } from "@/lib/assistant/context/tool-resolver";
import { routeVoiceUtterance } from "@/lib/assistant/voice/fast-path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTE DE L'ANNUAIRE — « dès que je dis annuaire il me sort l'annuaire sans rien comprendre »
 *
 * Rapporté par le dirigeant, MESURÉ sur dix phrases ordinaires qui contiennent le mot : SEPT
 * partaient en route rapide et rendaient le registre entier. Le raccourci n'envoie AUCUN schéma
 * d'outil au modèle et ne lui donne que la sortie à reformuler : se tromper de porte lui RETIRE
 * tout moyen de faire autrement, en silence.
 *
 * CE QUE CE BANC TIENT, ET DANS LES DEUX SENS — c'est la moitié qui compte. Un banc qui ne
 * vérifie que les refus laisserait passer une garde trop large, et un refus à tort est plus
 * coûteux que le défaut qu'on corrige (§118.27) : le registre cesserait de répondre à qui le
 * demande vraiment. Chaque cas négatif a donc son jumeau positif.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la porte de l'annuaire s'arme sur la DEMANDE, pas sur le mot", () => {
  /**
   * MENTIONNER LE REGISTRE N'EST PAS LE DEMANDER.
   *
   * Le sabotage qui fait tomber ce cas : remettre « annuaire » dans `CONTACT_ONLY` ou dans
   * `LIST_WORD`, ou rendre `demandeLeRegistre` vrai sur la seule présence du mot.
   */
  it.each([
    "c'est quoi l'annuaire ?",
    "l'annuaire est pas à jour, qui s'en occupe ?",
    "je trouve pas Amel dans l'annuaire, tu peux vérifier son email ?",
    "est-ce que l'annuaire est relié aux fiches RH ?",
    "l'annuaire me sert à quoi au quotidien ?",
    "combien de personnes dans l'annuaire ?",
  ])("« %s » ne prend AUCUN raccourci", (phrase) => {
    const r = routeVoiceUtterance(phrase, {});
    expect(r.kind).toBe("DELEGATE");
    expect(r.tool).toBeNull();
    expect(r.fast).toBe(false);
  });

  /**
   * … ET LE DEMANDER RESTE RAPIDE. Un mot de demande, ou une phrase qui ne dit rien d'autre.
   * Le sabotage qui fait tomber ce cas : exiger un mot de demande SANS accepter l'énoncé nu,
   * ce qui perdrait « annuaire » dicté seul — la forme la plus courante à l'oral.
   */
  it.each([
    "donne-moi l'annuaire",
    "montre-moi l'annuaire",
    "sors l'annuaire stp",
    "annuaire",
    "l'annuaire",
  ])("« %s » rend le registre, en route rapide", (phrase) => {
    const r = routeVoiceUtterance(phrase, {});
    expect(r.kind).toBe("DIRECTORY_LIST");
    expect(r.tool).toBe("directory_list");
    expect(r.fast).toBe(true);
  });

  /**
   * UN OBJET DE L'ERP NOMMÉ FERME LES QUATRE ENTRÉES, et non plus la seule `WORKS_AT`.
   *
   * Les cinq premières sont les mesures d'avant la réparation : chacune interrogeait l'annuaire
   * sur une personne fabriquée à partir du reste de la phrase (« pdf courrier », « dossier
   * anpp », « commande pch »). La liste qui les refuse EXISTAIT — elle gardait la boîte mail et
   * la file de décisions, pas le registre.
   *
   * Le sabotage qui fait tomber ce cas : retirer `!objetNomme` de la condition d'entrée, ou le
   * rendre au sous-ensemble documentaire d'origine (« facture », « commande », « demande »,
   * « entrepôt » repasseraient).
   */
  it.each([
    ["peux-tu joindre le PDF au courrier ?", "joindre veut aussi dire ATTACHER"],
    ["il faut joindre la facture à la demande", "une pièce jointe, pas une personne"],
    ["le numéro du dossier ANPP c'est quoi ?", "une référence de dossier"],
    ["quel est le numéro de la facture de Kwality ?", "un numéro de facture"],
    ["l'adresse de livraison de la commande PCH ?", "une adresse de livraison"],
    ["les coordonnées GPS de l'entrepôt de Rouiba ?", "un lieu de stock"],
    ["qui travaille sur le dossier ANPP ?", "le responsable d'un dossier, pas un service"],
  ])("« %s » rend la main au modèle — %s", (phrase) => {
    const r = routeVoiceUtterance(phrase, {});
    expect(r.kind).toBe("DELEGATE");
    expect(r.tool).toBeNull();
  });

  /**
   * UN LIEU OU UNE UNITÉ D'ORGANISATION N'EST PAS UN NOM DE PERSONNE.
   *
   * « c'est quoi l'adresse du siège social ? » interrogeait l'annuaire sur « siege social ».
   * Une fois ces mots filtrés il ne reste RIEN, et la phrase retombe sur la règle que ce
   * fichier portait déjà : « un mot de coordonnées sans cible identifiable ne prend PAS de
   * raccourci ». Le sabotage : retirer « siege » / « social » de `NOT_A_NAME`.
   */
  it("« c'est quoi l'adresse du siège social ? » ne cherche pas une personne", () => {
    expect(routeVoiceUtterance("c'est quoi l'adresse du siège social ?", {}).kind).toBe("DELEGATE");
    // … et la coordonnée d'une vraie personne reste un raccourci.
    const ok = routeVoiceUtterance("l'adresse de Raihana ?", {});
    expect(ok.kind).toBe("DIRECTORY_LOOKUP");
    expect(ok.args.name).toBe("raihana");
  });

  /**
   * LES DEUX LECTURES DU MÊME VOCABULAIRE, ET LEUR DIFFÉRENCE.
   *
   * « salarié » et « employé » sont des objets CONCURRENTS pour la boîte mail — « des mails des
   * salariés » n'est pas l'état de MA boîte — et le SUJET MÊME de l'annuaire. Brancher la liste
   * entière sur le registre aurait refusé son cas canonique. Les deux assertions ci-dessous sont
   * les deux moitiés de cette décision : sans la première, la garde est trop large ; sans la
   * seconde, elle est trop étroite.
   */
  it("les personnes sont le SUJET de l'annuaire et un CONCURRENT de la boîte", () => {
    const registre = routeVoiceUtterance("la liste des salariés avec leurs mails", {});
    expect(registre.kind).toBe("DIRECTORY_LIST");
    expect(registre.fast).toBe(true);

    const boite = routeVoiceUtterance("des mails des salariés ?", {});
    expect(boite.kind).toBe("DELEGATE");
  });

  /**
   * LE REGISTRE NOMMÉ FERME AUSSI LA BOÎTE MAIL.
   *
   * Ce fichier l'avait prédit : « placée après, cette demande ouvrirait la messagerie du PDG au
   * lieu de l'annuaire ». Tant que « annuaire » vivait parmi les mots de coordonnées, la porte
   * de l'annuaire servait de barrière ; elle ne la sert plus. Le sabotage : retirer
   * `!REGISTRE.test(text)` de la porte 4 — la phrase ci-dessous ouvre alors la boîte.
   */
  it("« je trouve pas Amel dans l'annuaire … son email ? » n'ouvre pas la boîte du dirigeant", () => {
    const r = routeVoiceUtterance("je trouve pas Amel dans l'annuaire, tu peux vérifier son email ?", {});
    expect(r.kind).toBe("DELEGATE");
    // … et la boîte répond toujours quand c'est bien d'elle qu'on parle.
    expect(routeVoiceUtterance("des mails aujourd'hui ?", {}).kind).toBe("GMAIL_INBOX");
    expect(routeVoiceUtterance("Deepak a répondu ?", {}).kind).toBe("GMAIL_FROM");
  });

  /**
   * QUATRE ALTERNATIVES ÉTAIENT MORTES — `optimis\\w*` dans une regex littérale vaut « optimis »
   * suivi d'un ANTISLASH. Mesuré : elles ne s'accrochaient à rien. Écrites en tableau de
   * chaînes, elles s'arment. Le sabotage : redoubler l'antislash dans `OBJETS_ERP` — les deux
   * phrases ci-dessous repartent vers la boîte mail et la file de décisions.
   */
  it("un objet nommé par un mot de méthode ferme aussi les portes", () => {
    expect(routeVoiceUtterance("on a reçu l'ordonnancement de l'atelier ?", {}).kind).toBe("DELEGATE");
    expect(routeVoiceUtterance("j'ai reçu l'optimisation des tournées ?", {}).kind).toBe("DELEGATE");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RENDRE LA MAIN N'EST PAS REFUSER — et c'est la seule chose qui rend ce lot acceptable.
 *
 * Fermer un raccourci ne vaut que si le modèle garde de quoi répondre. Le DOMAINE, lui, s'arme
 * toujours sur le mot (`router.ts`, table `DIRECTORY`) et c'est juste : le domaine OUVRE des
 * schémas, le raccourci FERME les options. Une erreur du premier coûte quelques jetons ; une
 * erreur du second coûte la réponse.
 *
 * Le parc d'outils vient de la table CANONIQUE et non d'une liste écrite ici : recopiée, elle
 * serait fausse au premier outil ajouté, en silence (§118.73).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("une phrase sur l'annuaire garde ses outils d'annuaire", () => {
  const PARC = Object.keys(TOOL_DOMAINS_ALL).map((name) => ({ name }));

  it.each([
    "c'est quoi l'annuaire ?",
    "l'annuaire est pas à jour, qui s'en occupe ?",
    "je trouve pas Amel dans l'annuaire, tu peux vérifier son email ?",
    "est-ce que l'annuaire est relié aux fiches RH ?",
    "l'annuaire me sert à quoi au quotidien ?",
    "combien de personnes dans l'annuaire ?",
  ])("« %s » expose directory_list ET directory_lookup", (phrase) => {
    const route = routeQuery(phrase, {});
    const resolved = resolveTools(PARC, phrase, route, {});
    const noms = fitToolBudget(resolved.tools, route, undefined, []).map((t) => t.name);
    expect(noms).toContain("directory_list");
    expect(noms).toContain("directory_lookup");
  });

  it("et le tour ne part pas sur le chemin rapide d'une lecture canonique", () => {
    const d = decideRollout("c'est quoi l'annuaire ?", { userId: "u_test", canaryPercent: 0, disabled: false });
    expect(d.mode).not.toBe("FAST_READ");
    expect(d.route.tool).toBeNull();
  });
});
