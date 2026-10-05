import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * LES POINTS D'APPEL DE LA CTD INITIALE (§118.213, §118.49, §118.14).
 *
 * Les règles sont éprouvées par `ctd-initiale.test.ts` et `ctd-initiale-flow.test.ts`. Ce fichier tient ce
 * qu'ils ne peuvent pas tenir : que chaque pièce est APPELÉE, à l'endroit exact où elle doit l'être — un
 * test qui vérifie le corps d'une fonction sans vérifier son appelant ne prouve rien. Un bloc parfait que
 * l'écran ne monte pas, une marque que le téléverseur n'envoie pas, un résultat de création qui s'exécute
 * deux fois : aucun banc de logique ne le voit, et c'est exactement ce qui rend la CTD invisible ou
 * mal adressée pour une personne qui utilise l'ERP normalement.
 *
 * Les commentaires sont retirés AVANT de lire : ces fichiers CITENT, pour s'expliquer, les formes mêmes
 * qu'on cherche (§118.79d).
 */

const code = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

describe("l'écran : le bloc est monté sur l'étape 1, nourri de la CTD et d'elle seule", () => {
  const process_ = code("src/app/(app)/regulatory/[id]/anpp-process.tsx");
  const page = code("src/app/(app)/regulatory/[id]/page.tsx");

  it("le bloc « CTD initiale » est rendu sous l'étape dont la clé est celle de l'étape 1 — lue, jamais recopiée", () => {
    expect(process_).toMatch(/s\.key === CTD_INITIALE_ETAPE && \(\s*<div[^>]*>\s*<CtdInitiale/);
    expect(process_).not.toMatch(/s\.key === "ctd"/);
  });

  it("le bloc reçoit les droits de la porte du serveur, et le dépôt en cours", () => {
    expect(process_).toMatch(/canUpload=\{ctd\.canUpload\}/);
    expect(process_).toMatch(/canManage=\{ctd\.canManage\}/);
    expect(process_).toMatch(/depotEnCours=\{ctd\.depotEnCours\}/);
  });

  it("la page lit les droits par la MÊME fonction que les actions, et filtre la CTD par LE FAIT", () => {
    expect(page).toMatch(/droitsSurLaCtd\(user, product\.id\)/);
    expect(page).toMatch(/documents\.filter\(estCtdInitiale\)/);
    expect(page).toMatch(/canUpload: droitsCtd\.deposer/);
    expect(page).toMatch(/canManage: droitsCtd\.gerer/);
  });

  it("la CTD n'est PAS répétée parmi les « pièces de l'étape » (le même fichier deux fois à l'écran)", () => {
    expect(page).toMatch(/if \(d\.stepKey && !estCtdInitiale\(d\)\)/);
  });

  it("le dépôt « CTD complet » n'est plus proposé par le tiroir générique de l'étape — la CTD se dépose depuis son bloc", () => {
    expect(process_).toMatch(/\.filter\(\(c\) => c !== CTD_INITIALE_CATEGORIE\)/);
  });

  it("le bloc pose la MARQUE sur chacun de ses dépôts (ajout, remplacement, premier dépôt) et cible l'étape 1 en « CTD complet »", () => {
    const bloc = code("src/app/(app)/regulatory/[id]/ctd-initiale.tsx");
    const depots = bloc.match(/<DocumentUpload[\s\S]*?\/>/g) ?? [];
    expect(depots).toHaveLength(3);
    for (const d of depots) {
      expect(d, d).toMatch(/\bctd\b/);
      expect(d, d).toMatch(/stepKey=\{CTD_INITIALE_ETAPE\}/);
      expect(d, d).toMatch(/categories=\{\[CTD_INITIALE_CATEGORIE\]\}/);
    }
  });

  it("remplacer et supprimer ne sont offerts qu'à qui GÈRE la CTD (`canManage`) ; ajouter, à qui peut déposer (`canUpload`)", () => {
    const bloc = code("src/app/(app)/regulatory/[id]/ctd-initiale.tsx");
    expect(bloc).toMatch(/\{canUpload && \(\s*<Button[\s\S]*?<FolderPlus/);
    expect(bloc).toMatch(/\{canManage && \(\s*<>\s*<Button[\s\S]*?<Replace[\s\S]*?<Trash2/);
    expect(bloc).toMatch(/panneau === "remplacement" && canManage/);
    expect(bloc).toMatch(/panneau === "suppression" && canManage/);
    expect(bloc).toMatch(/panneau === "ajout" && canUpload/);
  });

  it("le REMPLACEMENT passe par l'action AVANT l'envoi, derrière une double confirmation ; l'AJOUT transmet le dossier choisi", () => {
    const bloc = code("src/app/(app)/regulatory/[id]/ctd-initiale.tsx");
    expect(bloc).toMatch(/confirmationEnvoi="remplacer la CTD[^"]*"\s+avantEnvoi=\{async \(\) => \{ const ok = await lancer\(remplacerCtdInitiale\)/);
    expect(bloc).toMatch(/dossierBase=\{dossierBase\}/);
    expect(bloc).toMatch(/<BoutonDecisif[\s\S]*?lancer\(supprimerCtdInitiale\)/);
    expect(bloc).toMatch(/lancer\(renommerDossierCtd,/);
  });
});

describe("la création : la CTD choisie dans le formulaire part vers LE dossier créé, une seule fois, sans passer par l'action serveur", () => {
  const form = code("src/app/(app)/regulatory/new-product.tsx");
  const picker = code("src/app/(app)/regulatory/ctd-creation.tsx");

  it("le formulaire monte le sélecteur, et confie la sélection au gestionnaire d'envois avec l'identifiant du dossier créé", () => {
    expect(form).toMatch(/<CtdALaCreation entrees=\{ctd\} onChange=\{setCtd\} \/>/);
    expect(form).toMatch(/enqueue\(construireEnvoi\(\{\s*cible: \{ entityType: CTD_INITIALE_ENTITE, entityId: state\.id, category: CTD_INITIALE_CATEGORIE, confidentiality: "INTERNAL", stepKey: CTD_INITIALE_ETAPE, ctd: true \}/);
    expect(form).toMatch(/router\.push\(`\/regulatory\/\$\{state\.id\}\$\{aEnvoyer\.length > 0 \? "\?ctd=envoi" : ""\}`\)/);
  });

  it("un résultat d'action ne se traite qu'UNE fois : une CTD choisie plus tard ne part jamais vers le dossier d'avant", () => {
    expect(form).toMatch(/if \(traite\.current === state\) return;\s*traite\.current = state;/);
  });

  it("les champs fichier du sélecteur n'ont AUCUN `name` : ils ne partent jamais avec le formulaire (les gigaoctets n'entrent pas dans l'action serveur)", () => {
    const inputs = picker.match(/<input[\s\S]*?\/?>/g) ?? [];
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const i of inputs) expect(i, i).not.toMatch(/\bname=/);
  });
});

describe("le téléverseur : la marque et le dossier de destination voyagent jusqu'au serveur", () => {
  it("la construction d'envoi pose `ctd=1` sur le chemin ordinaire et joint le dossier de destination au dossier d'origine", () => {
    const envoi = code("src/components/documents/envoi-document.ts");
    expect(envoi).toMatch(/if \(cible\.ctd\) fd\.set\("ctd", "1"\)/);
    expect(envoi).toMatch(/dossierDeDestination\(args\.dossierBase, dossierDuChemin\(e\.path\)\)/);
    // Le chemin DIRECT envoie la cible telle quelle (la marque comprise) : `...cible`.
    expect(envoi).toMatch(/\.\.\.cible, folder: dossierDe\(f\)/);
  });

  it("le téléverseur des documents passe par la construction partagée, avec la marque et la destination", () => {
    const up = code("src/components/documents/document-upload.tsx");
    expect(up).toMatch(/enqueue\(construireEnvoi\(\{/);
    expect(up).toMatch(/cible: \{ entityType, entityId, category: cat, confidentiality: conf, stepKey, ctd \}/);
    expect(up).toMatch(/limites,\s*dossierBase,/);
    expect(up).toMatch(/if \(avantEnvoi && !\(await avantEnvoi\(\)\)\) return;/);
  });
});

describe("le serveur : chaque porte d'écriture d'un document juge la marque, et la restauration est branchée", () => {
  it("la route ordinaire lit la marque et la passe à l'écriture ; la route directe, à l'ouverture", () => {
    expect(code("src/app/api/documents/upload/route.ts")).toMatch(/const ctd = String\(form\.get\("ctd"\) \?\? ""\) === "1";/);
    expect(code("src/app/api/documents/upload/route.ts")).toMatch(/mirrorToDrive: false, ctd \}/);
    expect(code("src/app/api/documents/upload/direct/route.ts")).toMatch(/ctd: b\.ctd === true/);
  });

  it("l'entonnoir : l'écriture ordinaire, l'écriture directe ET l'ouverture d'un envoi direct jugent le dépôt", () => {
    const docs = code("src/lib/documents.ts");
    expect(docs.match(/refusDepotCtd\(/g)).toHaveLength(2);
    expect(code("src/lib/documents-depot-direct.ts")).toMatch(/refusDepotCtd\(\{ entityType: c\.entityType, stepKey: c\.stepKey, category: c\.category \}, c\.ctd === true\)/);
    expect(code("src/lib/documents-depot-direct.ts")).toMatch(/ctd: cible\.ctd === true/);
  });

  it("les trois actions passent par le prédicat de la porte du dépôt", () => {
    const actions = code("src/lib/actions/regulatory-ctd-actions.ts");
    expect(actions.match(/peutGererLaCtd\(user, productId\)/g)).toHaveLength(3);
    expect(actions.match(/export async function /g)).toHaveLength(3);
  });

  it("la restauration de la corbeille connaît le type CTD, AVANT de refuser les types inconnus", () => {
    const a = code("src/lib/actions/admin-delete-actions.ts");
    const iCtd = a.indexOf("rec.kind === KIND_CORBEILLE_CTD");
    const iInconnu = a.indexOf('"Type inconnu."');
    expect(iCtd).toBeGreaterThan(0);
    expect(iCtd).toBeLessThan(iInconnu);
    expect(a).toMatch(/restaurerLaCtdDeLaCorbeille\(rec, user\.id\)/);
  });

  it("le retrait ne détruit AUCUN fichier : seule la destruction réelle de l'entrée de corbeille les efface", () => {
    const m = code("src/lib/regulatory/ctd-initiale-corbeille.ts");
    expect(m).not.toMatch(/deleteFileByKey|storedFile\.delete|fileBlob\.delete/);
    expect(m).toMatch(/retire\.count !== docs\.length/);
  });
});
