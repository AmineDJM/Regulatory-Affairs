/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉFINITION DU CORPUS — le contenu ET ce qu'on attend de lui.
 *
 * ── POURQUOI LES ATTENTES VIVENT ICI, À CÔTÉ DU CONTENU ─────────────────────────────────
 *
 * Un banc qui se contente de compter « 43 fichiers ingérés » ne mesure rien : il ne sait pas
 * si le texte extrait est le bon, si le bon document remonte, si le doublon a été vu. Chaque
 * pièce porte donc, écrite AVANT l'exécution, la vérité qu'elle doit produire — marqueurs de
 * texte, entités citées, barreau de l'échelle attendu, lien vers une autre pièce.
 *
 * Conséquence directe : le banc ne peut pas s'auto-satisfaire. Un résultat ne compte que s'il
 * correspond à quelque chose qui était écrit ici avant de le connaître.
 *
 * ── LES QUATRE CAS TORDUS, ET CE QU'ILS PIÈGENT ─────────────────────────────────────────
 *
 *   DOUBLON       — même contenu, autre nom. L'empreinte porte sur les OCTETS : renommer ne
 *                   doit rien relancer. Si le banc voit deux items, la déduplication ment.
 *   NOUVELLE      — même document, valeurs changées. L'inverse exact : ici il FAUT un second
 *   VERSION         item, et un lien vers le premier. Confondre les deux cas est l'erreur
 *                   classique — dédupliquer une révision fait disparaître la mise à jour.
 *   FAUTES DE NOM — « Adventum Parma », « Pembrolizmab », « A.N.P.P. ». C'est ainsi que les
 *                   vrais documents sont écrits. Une résolution qui n'accepte que l'orthographe
 *                   exacte ne résout rien sur le terrain.
 *   MULTILINGUE   — arabe et anglais. L'ANPP écrit en arabe, les dossiers cliniques en anglais.
 *                   Un pipeline franco-français ne tiendrait pas une semaine chez Adventum.
 *
 * ── CE QUE CE CORPUS NE MESURE PAS ──────────────────────────────────────────────────────
 *
 * La qualité de COMPRÉHENSION sur les vrais courriers d'Adventum. Le contenu est écrit ici :
 * il mesure la mécanique (extraire, dédupliquer, versionner, indexer, retrouver), pas la
 * pertinence sur le fonds réel. Le banc à clé — vrais documents, vision Luna — est un exercice
 * distinct, et l'audit doit dire lequel des deux il rapporte.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type CorpusFormat = "pdf" | "pdf-scan" | "photo" | "docx" | "pptx" | "xlsx" | "csv" | "eml" | "txt" | "json";

/** Le barreau de l'échelle qu'on attend AVANT de lancer quoi que ce soit. */
export type AttenduExtraction = "native" | "vision";

export interface CorpusPiece {
  id: string;
  /** Nom du fichier tel qu'il arrivera dans le Drive — l'extension compte pour les archives ZIP. */
  nom: string;
  /** Le dossier logique, pour que le corpus ressemble à un Drive et non à un tas. */
  dossier: string;
  format: CorpusFormat;
  /** Langue dominante — `fr` sauf mention ; sert à mesurer le multilingue séparément. */
  langue?: "fr" | "ar" | "en";
  /**
   * FIDÉLITÉ DU RENDU, pour les pièces qui passent par une image.
   *
   * `ordre-non-garanti` : le texte est bien dans l'image, mais l'ordre des mots ne l'est pas
   * (librsvg ne fait pas le bidi — voir `makePhoto`). La pièce compte pour la mécanique (pas de
   * couche texte → vision), et doit être ÉCARTÉE de toute note de qualité de vision : on
   * reprocherait au modèle de mal lire ce qu'on a mal écrit.
   */
  rendu?: "ordre-non-garanti";
  /** Ce que le contenu porte. Le constructeur s'en sert ; les attentes s'y réfèrent. */
  contenu: CorpusContenu;
  attendu: {
    extraction: AttenduExtraction;
    /** Fragments qui DOIVENT figurer dans le texte extrait. Vides pour une image : rien à extraire. */
    marqueurs: string[];
    /** Entités que le document cite en clair — la cible de la résolution. */
    entites: string[];
  };
  /** Rattachement à une autre pièce, pour les cas doublon / nouvelle version. */
  lien?: { type: "doublon" | "version"; de: string };
}

export type CorpusContenu =
  | { k: "pages"; pages: string[][] }
  | { k: "image"; lignes: string[] }
  | { k: "paras"; paras: { text: string; bold?: boolean }[] }
  | { k: "slides"; slides: { titre: string; puces: string[]; notes?: string }[] }
  | { k: "feuilles"; feuilles: { nom: string; lignes: (string | number)[][] }[] }
  | { k: "csv"; entete: string[]; lignes: (string | number)[][] }
  | { k: "mail"; de: string; a: string; objet: string; date: string; corps: string; piece?: { nom: string; contenu: string } }
  | { k: "brut"; texte: string };

const P = (id: string, nom: string, dossier: string, format: CorpusFormat, contenu: CorpusContenu,
  attendu: CorpusPiece["attendu"], extra: Partial<CorpusPiece> = {}): CorpusPiece =>
  ({ id, nom, dossier, format, contenu, attendu, ...extra });

// ── LE FONDS ────────────────────────────────────────────────────────────────────────────────
// Tout est marqué « ESSAI » et référencé en `ESS-…` : une capture d'écran de ce corpus ne doit
// jamais pouvoir passer pour un état réel de l'entreprise.

export const CORPUS: CorpusPiece[] = [
  // ── PDF avec couche texte (8) ────────────────────────────────────────────────────────────
  P("amm-001", "ESS-AMM-001-pembrolizumab.pdf", "Regulatory/Dossiers", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - ADVENTUM PHARMA", "Dossier AMM ESS-2026-001", "Produit : Pembrolizumab 100 mg/4 mL",
        "Forme : solution a diluer pour perfusion", "Laboratoire fabricant : Bioteknika Istanbul",
        "Autorite : ANPP - Agence nationale des produits pharmaceutiques",
        "Charge du dossier : Yacine Belkacem", "Date de depot : 14 janvier 2026", "Statut : en revue"],
      ["Module 3 - Qualite", "Substance active : pembrolizumab, anticorps monoclonal humanise",
        "Duree de stabilite retenue : 24 mois a 5 degres Celsius",
        "Trois lots pilotes : PB-2601, PB-2602, PB-2603",
        "Le lot PB-2602 presente une teneur de 98,4 pour cent a douze mois."],
      ["Module 5 - Clinique", "Etude pivot KEYNOTE-ESSAI, 412 patients randomises",
        "Survie sans progression : 10,3 mois contre 6,1 mois dans le bras comparateur",
        "Evenements indesirables de grade 3 ou plus : 24 pour cent",
        "Conclusion : rapport benefice-risque favorable dans l'indication demandee"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-001", "Pembrolizumab", "PB-2602", "24 mois", "Yacine Belkacem"],
    entites: ["Pembrolizumab", "ANPP", "Yacine Belkacem", "Bioteknika"],
  }),

  P("amm-002", "ESS-AMM-002-nivolumab.pdf", "Regulatory/Dossiers", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - ADVENTUM PHARMA", "Dossier AMM ESS-2026-002", "Produit : Nivolumab 40 mg/4 mL",
        "Autorite : ANPP", "Charge du dossier : Nadia Cherifi", "Date de depot : 3 fevrier 2026",
        "Niveau de process : importation sous conditionnement primaire"],
      ["Module 3 - Qualite", "Duree de stabilite retenue : 18 mois a 5 degres Celsius",
        "Lots pilotes : NV-2611, NV-2612", "Excipients : mannitol, acide citrique, polysorbate 80"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-002", "Nivolumab", "18 mois", "Nadia Cherifi"],
    entites: ["Nivolumab", "ANPP", "Nadia Cherifi"],
  }),

  P("courrier-anpp", "ESS-COURRIER-ANPP-2026-014.pdf", "Regulatory/Courriers", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - ANPP - Direction de l'enregistrement", "Reference : ESS-ANPP-2026-014",
        "Objet : reserves sur le dossier ESS-2026-001", "Destinataire : Adventum Pharma, Alger",
        "Date : 12 mars 2026",
        "L'agence formule trois reserves majeures et deux reserves mineures."],
      ["Reserve majeure 1 : les donnees de stabilite a 25 degres sont absentes du module 3.2.P.8.",
        "Reserve majeure 2 : le certificat de conformite de la substance active n'est pas signe.",
        "Reserve majeure 3 : la notice ne comporte pas la version en langue arabe.",
        "Reserve mineure 1 : incoherence de pagination au module 1.",
        "Reserve mineure 2 : le nom du fabricant differe entre le module 1 et le module 3.",
        "Delai de reponse : soixante jours a compter de la notification."],
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-ANPP-2026-014", "trois reserves majeures", "soixante jours", "3.2.P.8"],
    entites: ["ANPP", "Adventum Pharma"],
  }),

  P("pv-comite", "ESS-PV-comite-2026-03.pdf", "Direction/Comites", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - Proces-verbal du comite reglementaire", "Seance du 18 mars 2026, siege d'Alger",
        "Presents : Yacine Belkacem, Nadia Cherifi, Samir Hamidi, Leila Bouzid",
        "Absent excuse : Karim Meziane",
        "Point 1 : reponse aux reserves ESS-ANPP-2026-014, pilotage confie a Yacine Belkacem",
        "Point 2 : budget reglementaire 2026 arrete a 14 200 000 DZD",
        "Point 3 : recrutement d'un pharmacien assurance qualite, avis favorable",
        "Prochaine seance : 15 avril 2026"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["18 mars 2026", "14 200 000 DZD", "Karim Meziane", "15 avril 2026"],
    entites: ["Yacine Belkacem", "Nadia Cherifi", "Samir Hamidi", "Leila Bouzid", "Karim Meziane"],
  }),

  P("notice", "ESS-NOTICE-metformine.pdf", "Regulatory/Notices", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - Notice patient", "Metformine Adventum 850 mg, comprime pellicule",
        "Indication : diabete de type 2 chez l'adulte",
        "Posologie usuelle : un comprime deux fois par jour au cours des repas",
        "Contre-indication : insuffisance renale severe, clairance inferieure a 30 mL/min",
        "Conservation : a temperature ne depassant pas 30 degres Celsius"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["Metformine", "850 mg", "30 mL/min", "diabete de type 2"],
    entites: ["Metformine"],
  }),

  P("contrat", "ESS-CONTRAT-distribution-2026.pdf", "Legal/Contrats", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - Contrat de distribution", "Entre Adventum Pharma, Alger, et Sofradis Distribution, Oran",
        "Reference : ESS-CTR-2026-031", "Prise d'effet : 1er avril 2026",
        "Duree : trente-six mois, renouvelable par tacite reconduction",
        "Preavis de resiliation : quatre-vingt-dix jours",
        "Remise consentie : douze pour cent sur le tarif public",
        "Penalite de retard de livraison : 0,5 pour cent par jour, plafonnee a dix pour cent"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-CTR-2026-031", "trente-six mois", "quatre-vingt-dix jours", "Sofradis"],
    entites: ["Adventum Pharma", "Sofradis Distribution"],
  }),

  P("stabilite", "ESS-RAPPORT-stabilite-T1.pdf", "Regulatory/Qualite", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - Rapport de stabilite, premier trimestre 2026",
        "Lots suivis : PB-2601, PB-2602, PB-2603, NV-2611",
        "Conditions : 5 degres plus ou moins 3, et 25 degres a 60 pour cent d'humidite relative",
        "Aucune deviation constatee sur les lots PB-2601 et PB-2603",
        "Le lot NV-2611 montre une baisse de teneur de 1,8 pour cent a six mois, dans les specifications",
        "Redacteur : Samir Hamidi, assurance qualite"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["PB-2601", "NV-2611", "1,8 pour cent", "Samir Hamidi"],
    entites: ["Samir Hamidi"],
  }),

  P("bon-commande", "ESS-BC-2026-0087.pdf", "Legal/Bons de commande", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - Bon de commande ESS-BC-2026-0087", "Fournisseur : Medilab Equipements, Blida",
        "Date : 22 fevrier 2026", "Demandeur : Leila Bouzid, moyens generaux",
        "Article 1 : enceinte thermostatique 400 litres, quantite 1, 780 000 DZD",
        "Article 2 : sonde de temperature etalonnee, quantite 4, 24 000 DZD l'unite",
        "Total hors taxes : 876 000 DZD", "Delai de livraison annonce : six semaines"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-BC-2026-0087", "Medilab", "876 000 DZD", "Leila Bouzid"],
    entites: ["Medilab Equipements", "Leila Bouzid"],
  }),

  // ── PDF scannés — image seule, AUCUN texte à extraire (4) ────────────────────────────────
  P("scan-recepisse", "ESS-SCAN-recepisse-anpp.pdf", "Regulatory/Courriers", "pdf-scan", {
    k: "image",
    lignes: ["ESSAI - ANPP", "RECEPISSE DE DEPOT", "Dossier ESS-2026-001", "Depose le 14 janvier 2026",
      "Recu par le bureau d'ordre", "Cachet et signature"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("scan-facture", "ESS-SCAN-facture-2026-114.pdf", "Finances/Factures", "pdf-scan", {
    k: "image",
    lignes: ["ESSAI - FACTURE N 2026-114", "Medilab Equipements, Blida", "Client : Adventum Pharma",
      "Date : 28 fevrier 2026", "Montant hors taxes : 876 000 DZD", "TVA 19 pour cent : 166 440 DZD",
      "Total a payer : 1 042 440 DZD"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("scan-attestation", "ESS-SCAN-attestation-lot.pdf", "Regulatory/Qualite", "pdf-scan", {
    k: "image",
    lignes: ["ESSAI - ATTESTATION DE LIBERATION DE LOT", "Lot PB-2602", "Produit : Pembrolizumab 100 mg",
      "Quantite liberee : 1 200 flacons", "Pharmacien responsable : Samir Hamidi",
      "Date de liberation : 5 mars 2026"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("scan-ar", "ESS-SCAN-courrier-ar.pdf", "Regulatory/Courriers", "pdf-scan", {
    k: "image",
    lignes: ["ESSAI - ANPP", "مديرية التسجيل", "الموضوع : ملف ESS-2026-002",
      "التاريخ : 20 مارس 2026", "يرجى استكمال الوثائق المطلوبة"],
    // Un scan en arabe : c'est ce que l'ANPP envoie vraiment, et c'est le pire cas cumulé —
    // aucune couche texte ET une écriture que la plupart des chaînes OCR latines ratent.
  }, { extraction: "vision", marqueurs: [], entites: [] }, { langue: "ar", rendu: "ordre-non-garanti" }),

  // ── Photos (4) ───────────────────────────────────────────────────────────────────────────
  P("photo-courrier", "ESS-PHOTO-courrier-recu.jpg", "Regulatory/Courriers", "photo", {
    k: "image",
    lignes: ["ESSAI - Courrier recu", "Expediteur : ANPP, direction de l'enregistrement",
      "Reference : ESS-ANPP-2026-021", "Objet : convocation a une reunion technique",
      "Date proposee : 9 avril 2026, 10 heures"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("photo-etiquette", "ESS-PHOTO-etiquette-lot.jpg", "Regulatory/Qualite", "photo", {
    k: "image",
    lignes: ["ESSAI", "PEMBROLIZUMAB 100 mg / 4 mL", "Lot : PB-2603", "Peremption : 03/2028",
      "Conserver entre 2 et 8 degres", "Adventum Pharma - Alger"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("photo-tableau", "ESS-PHOTO-tableau-reunion.jpg", "Direction/Comites", "photo", {
    k: "image",
    lignes: ["ESSAI - Tableau de reunion", "Reponse ANPP : 12 mai au plus tard", "Stabilite 25 C : Samir",
      "Certificat signe : Nadia", "Notice arabe : prestataire externe", "Relecture : Yacine"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  P("photo-ticket", "ESS-PHOTO-ticket-caisse.jpg", "Moyens generaux/Caisse", "photo", {
    k: "image",
    lignes: ["ESSAI - Ticket de caisse", "Papeterie El Wiam, Alger centre", "Date : 4 mars 2026",
      "Ramettes A4 x 10 : 9 500 DZD", "Toner laser x 2 : 26 000 DZD", "Total : 35 500 DZD"],
  }, { extraction: "vision", marqueurs: [], entites: [] }),

  // ── DOCX (5) ─────────────────────────────────────────────────────────────────────────────
  P("doc-reponse", "ESS-DOC-reponse-reserves.docx", "Regulatory/Reponses", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - ADVENTUM PHARMA", bold: true },
      { text: "Reponse aux reserves ESS-ANPP-2026-014 - dossier ESS-2026-001" },
      { text: "Reserve majeure 1 : les donnees de stabilite a 25 degres sont jointes en annexe A, portant sur les lots PB-2601 a PB-2603 sur douze mois." },
      { text: "Reserve majeure 2 : le certificat de conformite signe par Bioteknika est joint en annexe B." },
      { text: "Reserve majeure 3 : la version arabe de la notice est jointe en annexe C, traduite par un prestataire agree." },
      { text: "Reserve mineure 1 : la pagination du module 1 a ete corrigee integralement." },
      { text: "Reserve mineure 2 : le nom du fabricant est desormais Bioteknika Ilac Sanayi dans les deux modules." },
      { text: "Signe : Yacine Belkacem, responsable des affaires reglementaires, le 5 mai 2026." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-ANPP-2026-014", "annexe A", "Bioteknika Ilac Sanayi", "5 mai 2026"],
    entites: ["Yacine Belkacem", "Bioteknika"],
  }),

  P("doc-procedure", "ESS-DOC-procedure-qualite.docx", "Qualite/Procedures", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Procedure PRO-QA-018 : liberation des lots", bold: true },
      { text: "Objet : definir les etapes de liberation d'un lot de produit fini avant mise sur le marche." },
      { text: "Etape 1 : verification du dossier de lot par l'assurance qualite, sous quarante-huit heures." },
      { text: "Etape 2 : controle analytique complet, teneur, purete, endotoxines." },
      { text: "Etape 3 : revue des deviations eventuelles et de leur cloture." },
      { text: "Etape 4 : decision de liberation signee par le pharmacien responsable." },
      { text: "Toute deviation critique bloque la liberation jusqu'a decision du comite qualite." },
      { text: "Version 4, applicable au 1er fevrier 2026. Redacteur : Samir Hamidi." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["PRO-QA-018", "quarante-huit heures", "endotoxines", "Version 4"],
    entites: ["Samir Hamidi"],
  }),

  P("doc-visite", "ESS-DOC-compte-rendu-visite.docx", "Qualite/Inspections", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Compte rendu de visite d'inspection", bold: true },
      { text: "Site visite : entrepot logistique de Rouiba, le 26 fevrier 2026." },
      { text: "Inspecteurs : deux agents de l'ANPP, accompagnes de Leila Bouzid." },
      { text: "Constat 1 : la chambre froide numero 2 n'a pas d'enregistreur de temperature redondant." },
      { text: "Constat 2 : le registre des sorties de lot n'est pas signe depuis le 11 janvier." },
      { text: "Constat 3 : la zone de quarantaine est correctement identifiee et separee." },
      { text: "Delai d'action corrective demande : trente jours." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["Rouiba", "chambre froide numero 2", "trente jours", "Leila Bouzid"],
    entites: ["ANPP", "Leila Bouzid"],
  }),

  P("doc-fiche-poste", "ESS-DOC-fiche-poste-pharmacien.docx", "RH/Recrutement", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Fiche de poste : pharmacien assurance qualite", bold: true },
      { text: "Rattachement : direction qualite, sous la responsabilite de Samir Hamidi." },
      { text: "Missions : liberation des lots, gestion des deviations, suivi des reclamations." },
      { text: "Diplome exige : doctorat en pharmacie, inscription a l'ordre." },
      { text: "Experience souhaitee : trois ans minimum en industrie pharmaceutique." },
      { text: "Fourchette salariale : 180 000 a 220 000 DZD brut mensuel." },
      { text: "Poste base a Alger, ouverture du recrutement le 1er avril 2026." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["pharmacien assurance qualite", "180 000 a 220 000 DZD", "doctorat en pharmacie"],
    entites: ["Samir Hamidi"],
  }),

  P("doc-note", "ESS-DOC-note-service.docx", "Direction/Notes", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Note de service NS-2026-07", bold: true },
      { text: "Objet : nouvelles regles d'archivage des dossiers reglementaires." },
      { text: "A compter du 1er mars 2026, tout dossier depose a l'ANPP est archive dans le Drive, espace Regulatory." },
      { text: "La conservation minimale est de dix ans apres la fin de commercialisation." },
      { text: "Les versions successives d'un meme dossier doivent etre conservees, jamais ecrasees." },
      { text: "Diffusion : ensemble du personnel des affaires reglementaires." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["NS-2026-07", "dix ans", "1er mars 2026"],
    entites: ["ANPP"],
  }),

  // ── PPTX (3) ─────────────────────────────────────────────────────────────────────────────
  P("ppt-plan", "ESS-PPT-plan-reglementaire-2026.pptx", "Direction/Presentations", "pptx", {
    k: "slides",
    slides: [
      { titre: "ESSAI - Plan reglementaire 2026", puces: ["Adventum Pharma", "Comite de direction du 18 mars 2026"] },
      { titre: "Portefeuille en cours", puces: ["ESS-2026-001 Pembrolizumab, en revue", "ESS-2026-002 Nivolumab, depose", "Quatre dossiers en preparation"], notes: "Insister sur le retard du dossier 002." },
      { titre: "Objectifs", puces: ["Six depots au premier semestre", "Delai moyen de reponse ANPP sous quarante jours", "Zero reserve majeure recurrente"], notes: "Objectif de quarante jours negocie avec la direction." },
      { titre: "Moyens", puces: ["Budget de 14 200 000 DZD", "Un recrutement pharmacien qualite", "Prestataire de traduction arabe"] },
    ],
  }, {
    extraction: "native",
    marqueurs: ["Plan reglementaire 2026", "ESS-2026-002", "quarante jours", "14 200 000 DZD"],
    entites: ["Adventum Pharma", "Pembrolizumab", "Nivolumab", "ANPP"],
  }),

  P("ppt-comite", "ESS-PPT-comite-direction-mars.pptx", "Direction/Presentations", "pptx", {
    k: "slides",
    slides: [
      { titre: "ESSAI - Comite de direction, mars 2026", puces: ["Seance du 18 mars", "Siege d'Alger"] },
      { titre: "Chiffres du trimestre", puces: ["Chiffre d'affaires : 312 000 000 DZD", "Marge brute : 27 pour cent", "Trois nouveaux marches hospitaliers"] },
      { titre: "Points d'alerte", puces: ["Reserves ANPP sur ESS-2026-001", "Rupture de stock sur la metformine 850 mg", "Retard fournisseur Medilab de six semaines"], notes: "La rupture metformine est le point le plus sensible." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["312 000 000 DZD", "27 pour cent", "Medilab"],
    entites: ["ANPP", "Medilab"],
  }),

  P("ppt-formation", "ESS-PPT-formation-bpf.pptx", "Qualite/Formations", "pptx", {
    k: "slides",
    slides: [
      { titre: "ESSAI - Formation bonnes pratiques de fabrication", puces: ["Session du 10 mars 2026", "Douze participants"] },
      { titre: "Les cinq exigences", puces: ["Locaux adaptes et separes", "Personnel forme et habilite", "Procedures ecrites et suivies", "Tracabilite complete", "Controle de chaque lot"] },
      { titre: "Evaluation", puces: ["Questionnaire de vingt questions", "Note minimale : quatorze sur vingt", "Recyclage tous les deux ans"], notes: "Deux participants sous la note minimale, a repasser." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["bonnes pratiques de fabrication", "quatorze sur vingt", "Douze participants"],
    entites: [],
  }),

  // ── XLSX (4) ─────────────────────────────────────────────────────────────────────────────
  P("xls-tarifs", "ESS-XLS-tarifs-2026.xlsx", "Ventes/Tarifs", "xlsx", {
    k: "feuilles",
    feuilles: [{
      nom: "Tarifs 2026",
      lignes: [
        ["Produit", "Dosage", "Presentation", "Prix public DZD", "Remise hopital"],
        ["Pembrolizumab", "100 mg/4 mL", "Flacon", 148000, "12%"],
        ["Nivolumab", "40 mg/4 mL", "Flacon", 96500, "12%"],
        ["Metformine Adventum", "850 mg", "Boite de 30", 420, "5%"],
        ["Amoxicilline Adventum", "1 g", "Boite de 12", 310, "5%"],
        ["Insuline glargine", "100 UI/mL", "Stylo", 2850, "8%"],
      ],
    }, {
      nom: "Conditions",
      lignes: [
        ["Segment", "Delai de paiement", "Franco de port"],
        ["Hopital public", "90 jours", "500 000 DZD"],
        ["Clinique privee", "45 jours", "250 000 DZD"],
        ["Grossiste", "30 jours", "150 000 DZD"],
      ],
    }],
  }, {
    extraction: "native",
    marqueurs: ["Pembrolizumab", "148000", "Insuline glargine", "Hopital public"],
    entites: ["Pembrolizumab", "Nivolumab", "Metformine"],
  }),

  P("xls-suivi", "ESS-XLS-suivi-dossiers.xlsx", "Regulatory/Suivi", "xlsx", {
    k: "feuilles",
    feuilles: [{
      nom: "Suivi",
      lignes: [
        ["Dossier", "Produit", "Charge", "Statut", "Depot", "Echeance"],
        ["ESS-2026-001", "Pembrolizumab", "Yacine Belkacem", "En revue", "14/01/2026", "12/05/2026"],
        ["ESS-2026-002", "Nivolumab", "Nadia Cherifi", "Depose", "03/02/2026", "03/08/2026"],
        ["ESS-2026-003", "Metformine 1000 mg", "Nadia Cherifi", "En preparation", "", "30/06/2026"],
        ["ESS-2026-004", "Amoxicilline 500 mg", "Yacine Belkacem", "En preparation", "", "31/07/2026"],
        ["ESS-2026-005", "Insuline glargine", "Karim Meziane", "Avis presoumission", "", "15/09/2026"],
      ],
    }],
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-005", "Karim Meziane", "Avis presoumission", "12/05/2026"],
    entites: ["Yacine Belkacem", "Nadia Cherifi", "Karim Meziane"],
  }),

  P("xls-budget", "ESS-XLS-budget-reglementaire.xlsx", "Finances/Budgets", "xlsx", {
    k: "feuilles",
    feuilles: [{
      nom: "Budget 2026",
      lignes: [
        ["Poste", "Dotation DZD", "Consomme DZD", "Reste DZD"],
        ["Redevances ANPP", 6200000, 2480000, 3720000],
        ["Traductions et notices", 1800000, 640000, 1160000],
        ["Analyses externes", 3400000, 1120000, 2280000],
        ["Deplacements et inspections", 1200000, 385000, 815000],
        ["Formations", 900000, 310000, 590000],
        ["Divers", 700000, 95000, 605000],
        ["Total", 14200000, 5030000, 9170000],
      ],
    }],
  }, {
    extraction: "native",
    marqueurs: ["Redevances ANPP", "14200000", "9170000"],
    entites: ["ANPP"],
  }),

  P("xls-stocks", "ESS-XLS-stocks-hopitaux.xlsx", "Ventes/Stocks", "xlsx", {
    k: "feuilles",
    feuilles: [{
      nom: "Etat des stocks",
      lignes: [
        ["Etablissement", "Wilaya", "Produit", "Quantite", "Jours de couverture"],
        ["CHU Mustapha Pacha", "Alger", "Pembrolizumab", 84, 21],
        ["CHU Beni Messous", "Alger", "Pembrolizumab", 36, 9],
        ["CHU Oran", "Oran", "Nivolumab", 120, 40],
        ["EPH Blida", "Blida", "Metformine Adventum", 0, 0],
        ["CHU Constantine", "Constantine", "Insuline glargine", 260, 33],
      ],
    }],
  }, {
    extraction: "native",
    marqueurs: ["CHU Beni Messous", "EPH Blida", "Constantine"],
    entites: ["Pembrolizumab", "Nivolumab"],
  }),

  // ── CSV (3) ──────────────────────────────────────────────────────────────────────────────
  P("csv-lots", "ESS-CSV-lots-liberes.csv", "Qualite/Lots", "csv", {
    k: "csv",
    entete: ["Lot", "Produit", "Quantite", "Date de liberation", "Pharmacien"],
    lignes: [
      ["PB-2601", "Pembrolizumab 100 mg", 1400, "12/02/2026", "Samir Hamidi"],
      ["PB-2602", "Pembrolizumab 100 mg", 1200, "05/03/2026", "Samir Hamidi"],
      ["PB-2603", "Pembrolizumab 100 mg", 1150, "19/03/2026", "Samir Hamidi"],
      ["NV-2611", "Nivolumab 40 mg", 900, "27/02/2026", "Samir Hamidi"],
      ["MT-2620", "Metformine 850 mg", 42000, "02/03/2026", "Samir Hamidi"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["PB-2603", "MT-2620", "42000"],
    entites: ["Samir Hamidi"],
  }),

  P("csv-praticiens", "ESS-CSV-praticiens-alger.csv", "Annuaire/Praticiens", "csv", {
    k: "csv",
    entete: ["Nom", "Specialite", "Etablissement", "Wilaya", "Potentiel"],
    lignes: [
      ["Dr Amine Saidi", "Oncologie medicale", "CHU Mustapha Pacha", "Alger", "Fort"],
      ["Dr Hakim Benyahia", "Oncologie medicale", "CHU Beni Messous", "Alger", "Moyen"],
      ["Dr Sabrina Lounis", "Endocrinologie", "EPH Bologhine", "Alger", "Fort"],
      ["Pr Rachid Talbi", "Pneumologie", "CHU Bab El Oued", "Alger", "Fort"],
      ["Dr Meriem Ouali", "Diabetologie", "Clinique Chahrazad", "Alger", "Faible"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["Dr Sabrina Lounis", "Pr Rachid Talbi", "Bologhine"],
    entites: [],
  }),

  P("csv-depenses", "ESS-CSV-depenses-T1.csv", "Finances/Depenses", "csv", {
    k: "csv",
    entete: ["Date", "Poste", "Beneficiaire", "Montant DZD", "Statut"],
    lignes: [
      ["08/01/2026", "Redevances ANPP", "ANPP", 1240000, "Paye"],
      ["22/02/2026", "Equipement laboratoire", "Medilab Equipements", 876000, "En attente"],
      ["04/03/2026", "Fournitures de bureau", "Papeterie El Wiam", 35500, "Paye"],
      ["10/03/2026", "Traduction notices", "Cabinet Errahma", 340000, "Paye"],
      ["18/03/2026", "Analyses externes", "Laboratoire Ibn Sina", 620000, "En attente"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["Papeterie El Wiam", "Cabinet Errahma", "620000"],
    entites: ["ANPP", "Medilab Equipements"],
  }),

  // ── Courriels (5) ────────────────────────────────────────────────────────────────────────
  P("mail-accuse", "ESS-MAIL-anpp-accuse.eml", "Courriers/Entrants", "eml", {
    k: "mail",
    de: "enregistrement@essai-anpp.dz", a: "reglementaire@essai-adventum.dz",
    objet: "ESSAI - Accuse de reception du dossier ESS-2026-002",
    date: "Tue, 3 Feb 2026 09:14:00 +0100",
    corps: "Madame, Monsieur,\n\nNous accusons reception du dossier ESS-2026-002 relatif au Nivolumab 40 mg,"
      + " depose le 3 fevrier 2026.\n\nLe delai d'instruction est de cent quatre-vingts jours a compter de cette date.\n"
      + "Toute demande complementaire vous sera notifiee par courrier officiel.\n\nLa direction de l'enregistrement.",
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-002", "cent quatre-vingts jours", "Nivolumab"],
    entites: ["ANPP", "Nivolumab"],
  }),

  P("mail-fournisseur", "ESS-MAIL-fournisseur-delai.eml", "Courriers/Entrants", "eml", {
    k: "mail",
    de: "ventes@essai-medilab.dz", a: "moyens.generaux@essai-adventum.dz",
    objet: "ESSAI - Report de livraison du bon de commande ESS-BC-2026-0087",
    date: "Mon, 16 Mar 2026 15:42:00 +0100",
    corps: "Bonjour Madame Bouzid,\n\nL'enceinte thermostatique 400 litres commandee le 22 fevrier accuse un retard"
      + " de six semaines, en raison d'un blocage douanier sur le compresseur.\n\nNouvelle date annoncee : 4 mai 2026.\n"
      + "Les quatre sondes etalonnees, elles, sont disponibles et peuvent etre livrees des cette semaine.\n\nCordialement.",
  }, {
    extraction: "native",
    marqueurs: ["ESS-BC-2026-0087", "six semaines", "4 mai 2026", "blocage douanier"],
    entites: ["Medilab", "Leila Bouzid"],
  }),

  P("mail-relance", "ESS-MAIL-interne-relance.eml", "Courriers/Internes", "eml", {
    k: "mail",
    de: "y.belkacem@essai-adventum.dz", a: "n.cherifi@essai-adventum.dz",
    objet: "ESSAI - Relance sur les annexes de la reponse ANPP",
    date: "Thu, 23 Apr 2026 08:05:00 +0100",
    corps: "Nadia,\n\nIl me manque encore le certificat de conformite signe par Bioteknika pour boucler l'annexe B.\n"
      + "La reponse doit partir le 5 mai au plus tard, donc il me le faut avant le 30 avril.\n\n"
      + "La version arabe de la notice est arrivee hier, elle est relue.\n\nYacine",
  }, {
    extraction: "native",
    marqueurs: ["annexe B", "30 avril", "Bioteknika"],
    entites: ["Yacine Belkacem", "Nadia Cherifi", "Bioteknika"],
  }),

  P("mail-piece", "ESS-MAIL-piece-jointe.eml", "Courriers/Entrants", "eml", {
    k: "mail",
    de: "labo@essai-ibnsina.dz", a: "qualite@essai-adventum.dz",
    objet: "ESSAI - Resultats d'analyse du lot NV-2611",
    date: "Wed, 11 Mar 2026 11:30:00 +0100",
    corps: "Bonjour,\n\nVeuillez trouver ci-joint le bulletin d'analyse du lot NV-2611.\n"
      + "Tous les parametres sont conformes aux specifications.\n\nLaboratoire Ibn Sina.",
    piece: {
      nom: "bulletin-NV-2611.txt",
      contenu: "ESSAI - Bulletin d'analyse\nLot NV-2611\nTeneur : 98,2 pour cent\nPurete : 99,6 pour cent\n"
        + "Endotoxines : inferieur a 0,5 UI par mL\nConclusion : conforme",
    },
  }, {
    extraction: "native",
    marqueurs: ["NV-2611", "98,2 pour cent", "Endotoxines"],
    entites: ["Nivolumab"],
  }),

  P("mail-en", "ESS-MAIL-clinical-en.eml", "Courriers/Entrants", "eml", {
    k: "mail",
    de: "regulatory@essai-bioteknika.com", a: "regulatory@essai-adventum.dz",
    objet: "ESSAI - Certificate of conformity for pembrolizumab batches",
    date: "Fri, 24 Apr 2026 17:20:00 +0200",
    corps: "Dear Mr Belkacem,\n\nPlease find below the confirmation regarding batches PB-2601 to PB-2603.\n"
      + "The signed certificate of conformity will be couriered on Monday 27 April.\n"
      + "Our manufacturing site is registered under the legal name Bioteknika Ilac Sanayi.\n\n"
      + "Best regards,\nRegulatory Affairs, Bioteknika Istanbul",
  }, {
    extraction: "native",
    marqueurs: ["certificate of conformity", "Bioteknika Ilac Sanayi", "PB-2601"],
    entites: ["Bioteknika", "Yacine Belkacem"],
  }, { langue: "en" }),

  // ── Texte brut et JSON (2) ───────────────────────────────────────────────────────────────
  P("txt-notes", "ESS-TXT-notes-terrain.txt", "Ventes/Notes", "txt", {
    k: "brut",
    texte: "ESSAI - Notes de tournee, semaine du 9 mars 2026\n\n"
      + "CHU Mustapha : le Dr Saidi confirme dix nouveaux patients sous pembrolizumab au premier trimestre.\n"
      + "Beni Messous : stock tendu, neuf jours de couverture seulement, a remonter a la logistique.\n"
      + "EPH Blida : rupture totale de metformine 850, le pharmacien parle d'un mois sans reappro.\n"
      + "Clinique Chahrazad : le Dr Ouali ne prescrit pas, potentiel faible confirme.\n"
      + "A faire : relancer la logistique sur Beni Messous avant vendredi.",
  }, {
    extraction: "native",
    marqueurs: ["neuf jours de couverture", "rupture totale de metformine", "Dr Saidi"],
    entites: ["Metformine"],
  }),

  P("json-export", "ESS-JSON-export-api.json", "Regulatory/Exports", "json", {
    k: "brut",
    texte: JSON.stringify({
      essai: true,
      export: "suivi-dossiers",
      genere_le: "2026-03-31",
      dossiers: [
        { reference: "ESS-2026-001", produit: "Pembrolizumab", statut: "en_revue", charge: "Yacine Belkacem", echeance: "2026-05-12" },
        { reference: "ESS-2026-002", produit: "Nivolumab", statut: "depose", charge: "Nadia Cherifi", echeance: "2026-08-03" },
        { reference: "ESS-2026-005", produit: "Insuline glargine", statut: "avis_presoumission", charge: "Karim Meziane", echeance: "2026-09-15" },
      ],
    }, null, 2),
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-001", "avis_presoumission", "2026-09-15"],
    entites: ["Yacine Belkacem", "Karim Meziane"],
  }),

  // ── LES CAS TORDUS ──────────────────────────────────────────────────────────────────────

  // DOUBLON — octet pour octet identique à `amm-001`, autre nom, autre dossier. L'empreinte
  // porte sur le CONTENU : ceci ne doit produire AUCUN second item de connaissance.
  P("doublon-amm-001", "copie de ESS-AMM-001 (1).pdf", "Drive/A trier", "pdf", {
    k: "pages", pages: [], // rempli par le constructeur depuis `amm-001` — le doublon doit être exact
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-001", "PB-2602"],
    entites: ["Pembrolizumab"],
  }, { lien: { type: "doublon", de: "amm-001" } }),

  // NOUVELLE VERSION — même dossier, valeurs changées. Le piège symétrique du doublon : ici il
  // FAUT un second item. Une déduplication trop large ferait disparaître la mise à jour.
  P("version-amm-001", "ESS-AMM-001-pembrolizumab-v2.pdf", "Regulatory/Dossiers", "pdf", {
    k: "pages",
    pages: [
      ["ESSAI - ADVENTUM PHARMA", "Dossier AMM ESS-2026-001 - version 2", "Produit : Pembrolizumab 100 mg/4 mL",
        "Forme : solution a diluer pour perfusion", "Laboratoire fabricant : Bioteknika Ilac Sanayi",
        "Autorite : ANPP - Agence nationale des produits pharmaceutiques",
        "Charge du dossier : Yacine Belkacem", "Date de depot : 14 janvier 2026",
        "Revision du 5 mai 2026 apres reserves", "Statut : reponse aux reserves deposee"],
      ["Module 3 - Qualite", "Substance active : pembrolizumab, anticorps monoclonal humanise",
        "Duree de stabilite retenue : 36 mois a 5 degres Celsius",
        "Trois lots pilotes : PB-2601, PB-2602, PB-2603",
        "Donnees ajoutees : stabilite a 25 degres sur douze mois, conforme"],
      ["Module 5 - Clinique", "Etude pivot KEYNOTE-ESSAI, 412 patients randomises",
        "Survie sans progression : 10,3 mois contre 6,1 mois dans le bras comparateur",
        "Evenements indesirables de grade 3 ou plus : 24 pour cent",
        "Conclusion : rapport benefice-risque favorable dans l'indication demandee"],
    ],
  }, {
    extraction: "native",
    marqueurs: ["version 2", "36 mois", "Bioteknika Ilac Sanayi", "Revision du 5 mai 2026"],
    entites: ["Pembrolizumab", "ANPP", "Yacine Belkacem", "Bioteknika"],
  }, { lien: { type: "version", de: "amm-001" } }),

  // FAUTES DE NOM — écrit comme les vrais documents le sont : société mal orthographiée,
  // molécule amputée d'une lettre, sigle ponctué, prénom collé. La résolution d'entités doit
  // retrouver les mêmes entités que `amm-001`, sinon elle ne sert à rien sur le terrain.
  P("fautes", "ESS-FAUTES-note-interne.docx", "Drive/A trier", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Note interne (saisie rapide, non relue)", bold: true },
      { text: "Objet : point sur le dossier du Pembrolizmab depose a l'A.N.P.P." },
      { text: "Adventum Parma a recu les reserves le 12 mars, reponse a preparer par Yacine BELKACEM." },
      { text: "Le fabricant Biotecknika doit renvoyer le certificat signe." },
      { text: "Nadia CHERIFI reprend le dossier Nivolumab pendant l'absence." },
      { text: "Voir aussi le lot PB2602 dont la teneur est a verifier." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["Pembrolizmab", "Adventum Parma", "Biotecknika"],
    // On attend les entités CANONIQUES, pas les fautes : c'est tout l'objet du test.
    entites: ["Pembrolizumab", "ANPP", "Adventum Pharma", "Yacine Belkacem", "Nadia Cherifi", "Bioteknika"],
  }),

  // MULTILINGUE — arabe avec couche texte (à distinguer du scan arabe, qui n'en a aucune).
  P("ar-courrier", "ESS-AR-courrier-anpp.docx", "Regulatory/Courriers", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - وكالة المنتجات الصيدلانية", bold: true },
      { text: "الموضوع : ملاحظات حول الملف ESS-2026-002" },
      { text: "المنتج : نيفولوماب 40 ملغ" },
      { text: "التاريخ : 20 مارس 2026" },
      { text: "يرجى تقديم الوثائق التكميلية في أجل ستين يوما." },
      { text: "المسؤول عن الملف : نادية شريفي" },
    ],
  }, {
    extraction: "native",
    marqueurs: ["ESS-2026-002", "نيفولوماب", "ستين يوما"],
    entites: ["ANPP"],
  }, { langue: "ar" }),

  // MULTILINGUE — anglais, le format des résumés cliniques reçus des fabricants.
  P("en-clinical", "ESS-EN-clinical-summary.docx", "Regulatory/Dossiers", "docx", {
    k: "paras",
    paras: [
      { text: "ESSAI - Clinical Overview Summary", bold: true },
      { text: "Product: Pembrolizumab 100 mg/4 mL concentrate for solution for infusion." },
      { text: "Marketing authorisation applicant: Adventum Pharma, Algiers." },
      { text: "Pivotal trial KEYNOTE-ESSAI enrolled 412 randomised patients across 34 sites." },
      { text: "Median progression-free survival was 10.3 months versus 6.1 months for the comparator arm." },
      { text: "Grade 3 or higher adverse events occurred in 24 percent of the treated population." },
      { text: "The benefit-risk balance is considered favourable for the requested indication." },
    ],
  }, {
    extraction: "native",
    marqueurs: ["Clinical Overview Summary", "progression-free survival", "412 randomised patients"],
    entites: ["Pembrolizumab", "Adventum Pharma"],
  }, { langue: "en" }),
];

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES QUESTIONS À RÉPONSE CONNUE — ce qui rend la mesure de recherche honnête.
 *
 * Chaque question a été écrite EN MÊME TEMPS que le document qui y répond, et jamais après
 * avoir vu ce que le moteur remonte. C'est la seule façon d'éviter le biais classique du banc
 * maison : formuler la question à partir de la réponse obtenue, et conclure que tout marche.
 *
 * `attendu` nomme le document qui DOIT remonter. `concurrents` nomme ceux qui parlent du même
 * sujet sans porter la réponse — un moteur qui remonte n'importe lequel d'entre eux a l'air de
 * comprendre le sujet tout en se trompant de document, et c'est exactement ce qu'il faut voir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface CorpusQuestion {
  q: string;
  /** L'id de la pièce qui porte la réponse. */
  attendu: string;
  /** Fragment de la bonne réponse — pour vérifier que le morceau remonté la contient vraiment. */
  reponse: string;
  /** Pièces proches du sujet mais qui ne portent PAS la réponse. */
  concurrents?: string[];
  langue?: "fr" | "ar" | "en";
}

export const QUESTIONS: CorpusQuestion[] = [
  { q: "quelle est la duree de stabilite du pembrolizumab dans la version revisee du dossier", attendu: "version-amm-001", reponse: "36 mois", concurrents: ["amm-001", "stabilite"] },
  { q: "combien de reserves majeures l'ANPP a-t-elle formulees sur le dossier ESS-2026-001", attendu: "courrier-anpp", reponse: "trois reserves majeures", concurrents: ["doc-reponse", "amm-001"] },
  { q: "quel est le delai de reponse accorde par l'ANPP", attendu: "courrier-anpp", reponse: "soixante jours", concurrents: ["mail-accuse"] },
  { q: "quel est le prix public du pembrolizumab", attendu: "xls-tarifs", reponse: "148000", concurrents: ["xls-stocks", "amm-001"] },
  { q: "quel etablissement est en rupture de metformine", attendu: "xls-stocks", reponse: "EPH Blida", concurrents: ["txt-notes", "ppt-comite"] },
  { q: "qui est charge du dossier insuline glargine", attendu: "xls-suivi", reponse: "Karim Meziane", concurrents: ["json-export", "pv-comite"] },
  { q: "quel est le montant total du budget reglementaire 2026", attendu: "xls-budget", reponse: "14200000", concurrents: ["pv-comite", "ppt-plan"] },
  { q: "quel est le preavis de resiliation du contrat de distribution", attendu: "contrat", reponse: "quatre-vingt-dix jours" },
  { q: "pourquoi la livraison de l'enceinte thermostatique est-elle retardee", attendu: "mail-fournisseur", reponse: "blocage douanier", concurrents: ["bon-commande", "ppt-comite"] },
  { q: "quelle est la note minimale a la formation bonnes pratiques de fabrication", attendu: "ppt-formation", reponse: "quatorze sur vingt" },
  { q: "quelle quantite du lot PB-2602 a ete liberee", attendu: "csv-lots", reponse: "1200", concurrents: ["scan-attestation", "stabilite"] },
  { q: "quelle est la fourchette salariale du poste de pharmacien assurance qualite", attendu: "doc-fiche-poste", reponse: "180 000 a 220 000 DZD" },
  { q: "combien de temps faut-il conserver un dossier reglementaire apres la fin de commercialisation", attendu: "doc-note", reponse: "dix ans" },
  { q: "quels constats l'inspection de l'entrepot de Rouiba a-t-elle releves", attendu: "doc-visite", reponse: "chambre froide numero 2" },
  { q: "quel est le delai d'instruction annonce pour le dossier ESS-2026-002", attendu: "mail-accuse", reponse: "cent quatre-vingts jours", concurrents: ["amm-002", "ar-courrier"] },
  { q: "quelle est la contre-indication renale de la metformine", attendu: "notice", reponse: "30 mL/min" },
  { q: "quelle est la teneur mesuree sur le lot NV-2611", attendu: "mail-piece", reponse: "98,2 pour cent", concurrents: ["stabilite", "csv-lots"] },
  { q: "quel specialiste exerce a l'EPH Bologhine", attendu: "csv-praticiens", reponse: "Sabrina Lounis" },
  { q: "quel est le montant de la depense de traduction des notices", attendu: "csv-depenses", reponse: "340000", concurrents: ["xls-budget"] },
  { q: "what was the median progression-free survival in the pivotal trial", attendu: "en-clinical", reponse: "10.3 months", concurrents: ["amm-001", "version-amm-001"], langue: "en" },
  { q: "sous quel nom legal le site de fabrication est-il enregistre", attendu: "mail-en", reponse: "Bioteknika Ilac Sanayi", concurrents: ["doc-reponse", "version-amm-001"] },
  { q: "quel est le chiffre d'affaires du trimestre", attendu: "ppt-comite", reponse: "312 000 000 DZD" },
  { q: "quelles sont les etapes de liberation d'un lot", attendu: "doc-procedure", reponse: "PRO-QA-018", concurrents: ["csv-lots", "scan-attestation"] },
  { q: "quel est le total hors taxes du bon de commande Medilab", attendu: "bon-commande", reponse: "876 000 DZD", concurrents: ["csv-depenses", "scan-facture"] },
  { q: "ما هو أجل تقديم الوثائق التكميلية", attendu: "ar-courrier", reponse: "ستين يوما", langue: "ar" },
];

/** Les identifiants, pour que le banc puisse vérifier qu'il n'a rien laissé de côté. */
export const CORPUS_IDS = CORPUS.map((p) => p.id);
