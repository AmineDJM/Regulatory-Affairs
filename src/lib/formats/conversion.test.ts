import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avertissementConversion, conversion, conversionsDepuis, FORMATS_ECRIVABLES, type Format } from "./conversion";
import { extensionsEditables } from "@/lib/onlyoffice";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DEUX MÉCANISMES, UNE QUESTION — et celui qui disait NON était celui qu'Adam lisait.
 *
 * `conversion()` déclarait `docx→pdf` IMPOSSIBLE (« LibreOffice, absent — mesuré »), ce qui est
 * vrai des moteurs LOCAUX. Or `drive-actions.ts:convertNodeToPdf` le fait depuis toujours par
 * l'éditeur Office. Une personne se voyait donc répondre « indisponible sur ce serveur » par
 * Adam pendant qu'un bouton du Drive, à un clic, réussissait (§118.63 croisé avec §118.5).
 *
 * La réparation n'est pas une table corrigée : sans éditeur Office configuré, le refus est
 * JUSTE. C'est un fait de l'EXÉCUTION, que le module reçoit de son appelant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("CONVERSION — le refus dépend de ce que le serveur SAIT faire, pas d'une table figée", () => {
  it("SANS éditeur Office : docx→pdf reste IMPOSSIBLE, et le refus nomme les DEUX moteurs absents", () => {
    const c = conversion("docx", "pdf");
    expect(c.nature).toBe("IMPOSSIBLE");
    // LE REFUS NOMME CE QUI MANQUE, pas « impossible » tout court (§118.30).
    expect(c.ressourceManquante).toMatch(/LibreOffice/);
    expect(c.ressourceManquante, "le refus doit nommer l'éditeur Office, l'autre chemin possible")
      .toMatch(/éditeur Office n'est pas configuré/);
    expect(avertissementConversion(c)).toMatch(/indisponible sur ce serveur/);
  });

  it("AVEC éditeur Office : docx→pdf devient POSSIBLE — et la phrase dit par quel chemin", () => {
    // LE CAS QUI FAISAIT LE DÉFAUT : ce verdict était IMPOSSIBLE quoi qu'il arrive, donc Adam
    // refusait ce que le Drive réussissait.
    const c = conversion("docx", "pdf", { editeurOffice: true });
    expect(c.nature).toBe("DESTRUCTIF");
    expect(c.ressourceManquante).toBeUndefined();
    // UN PDF SE LIT, IL NE SE REMANIE PAS : la perte est dite, même quand la conversion marche.
    expect(c.perd.join(" ")).toMatch(/modifiabilité/);
    // ET LE CHEMIN EST NOMMÉ : le document part chez un service, pas dans un moteur d'ici.
    expect(c.parEditeurOffice).toBe(true);
    expect(avertissementConversion(c)).toMatch(/ÉDITEUR OFFICE/);
  });

  it("pptx→pdf suit la même règle, xlsx→pdf passe déjà et le DIT quand l'éditeur est là", () => {
    expect(conversion("pptx", "pdf").nature).toBe("IMPOSSIBLE");
    expect(conversion("pptx", "pdf", { editeurOffice: true }).nature).toBe("DESTRUCTIF");
    // `xlsx→pdf` n'a jamais été refusé : le chemin s'ANNONCE quand il change, sans quoi on
    // laisserait croire qu'un moteur local imprime le classeur.
    expect(conversion("xlsx", "pdf").parEditeurOffice).toBeUndefined();
    expect(conversion("xlsx", "pdf", { editeurOffice: true }).parEditeurOffice).toBe(true);
  });

  it("CE QUE L'ÉDITEUR NE LÈVE PAS reste refusé — il imprime, il ne reconstruit pas", () => {
    // La moitié qui compte : une capacité qui lève DEUX refus ne lève pas les six autres.
    // Déclarer `pdf→docx` possible parce qu'OnlyOffice existe promettrait une reconnaissance de
    // mise en page que personne n'a (§118.16 : on ne promet pas ce qu'on ne sait pas faire).
    for (const [de, vers] of [["pdf", "docx"], ["pdf", "xlsx"], ["xls", "xlsx"], ["doc", "docx"]] as const) {
      expect(conversion(de, vers, { editeurOffice: true }).nature, `${de}→${vers}`).toBe("IMPOSSIBLE");
    }
  });

  it("LA LISTE DES POSSIBLES suit le fait — pdf y entre depuis docx quand l'éditeur est là", () => {
    const sans = conversionsDepuis("docx").map((c) => c.vers);
    const avec = conversionsDepuis("docx", { editeurOffice: true }).map((c) => c.vers);
    expect(sans).not.toContain("pdf");
    expect(avec).toContain("pdf");
    // ET RIEN NE DISPARAÎT en chemin : une capacité AJOUTE, elle ne retire pas (§118.27).
    for (const v of sans) expect(avec, `« ${v} » a disparu de la liste`).toContain(v);
  });

  it("AUCUN COUPLE n'est déclaré IMPOSSIBLE alors qu'un moteur du dépôt le fait — la règle, sur tout le parc", () => {
    // CE QUE CE CAS GARDE : le défaut d'origine, généralisé. Le Drive convertit par l'éditeur
    // Office vers PDF depuis les formats qu'OnlyOffice édite ; aucun de ces couples ne doit
    // sortir IMPOSSIBLE quand l'éditeur est déclaré présent.
    const editables: Format[] = ["docx", "xlsx", "xlsm", "pptx"];
    const refuses = editables
      .filter((de) => conversion(de, "pdf", { editeurOffice: true }).nature === "IMPOSSIBLE")
      .map((de) => `${de}→pdf`);
    expect(refuses, "l'éditeur Office les convertit : les refuser serait un « je ne peux pas » artificiel").toEqual([]);

    // ET LE DRIVE PASSE BIEN PAR LÀ — sans quoi ce cas garderait une capacité imaginaire.
    const drive = readFileSync(join(process.cwd(), "src/lib/actions/drive-actions.ts"), "utf8");
    expect(drive, "convertNodeToPdf doit appeler l'éditeur Office").toContain("convertDocument(");
    expect(drive).toContain("convertConfigured()");
  });

  it("LE FAIT N'EST PAS SUPPOSÉ : sans lui, le module garde son refus", () => {
    // Une garde qui suppose une capacité PRÉSENTE promettrait ce que le serveur ne sait pas
    // faire ; l'inverse coûte un refus honnête, corrigible en passant le fait (§118.16).
    expect(conversion("docx", "pdf", {}).nature).toBe("IMPOSSIBLE");
    expect(conversion("docx", "pdf", { editeurOffice: false }).nature).toBe("IMPOSSIBLE");
  });

  it("les conversions ordinaires ne bougent pas — la capacité n'a pas déplacé le reste", () => {
    for (const de of ["xlsx", "csv", "json", "md", "html"] as const) {
      for (const vers of FORMATS_ECRIVABLES) {
        if (de === vers) continue;
        const a = conversion(de, vers);
        const b = conversion(de, vers, { editeurOffice: true });
        if (vers === "pdf") continue; // le seul couple que l'éditeur touche
        expect(b.nature, `${de}→${vers}`).toBe(a.nature);
        expect(b.perd, `${de}→${vers}`).toEqual(a.perd);
      }
    }
  });
});

describe("LE REFUS DU DRIVE — il nomme le geste et les formats admis", () => {
  const drive = readFileSync(join(process.cwd(), "src/lib/actions/drive-actions.ts"), "utf8");

  it("LA LISTE DES FORMATS CONVERTIBLES est DÉRIVÉE de la table de l'éditeur, pas écrite à la main", () => {
    const admis = extensionsEditables();
    // Ce sont les extensions qu'OnlyOffice ouvre : Word, tableur, présentation.
    for (const e of ["docx", "xlsx", "pptx", "csv", "txt", "odt"]) expect(admis, e).toContain(e);
    expect(admis, "un format que l'éditeur n'ouvre pas ne doit pas y figurer").not.toContain("pdf");
    expect(admis, "ni un format d'image").not.toContain("png");
    // LE CAS QUI FERAIT TOMBER : recopier la liste dans le message. Elle serait fausse au
    // premier format ajouté à `EXT_TYPE`, en silence (§118.73).
    expect(drive, "le refus doit APPELER la dérivation").toContain("extensionsEditables()");
  });

  it("LES DEUX REFUS NOMMENT LE REMÈDE — « indisponible » tout court fait deviner", () => {
    // (a) l'éditeur n'est pas configuré : la personne doit savoir QUI le configure, et ce
    // qu'elle peut faire en attendant (§118.30).
    expect(drive).toMatch(/ONLYOFFICE_\*/);
    expect(drive).toMatch(/enregistrez-le en PDF depuis votre poste/);
    // (b) le format n'est pas ouvrable : on dit LESQUELS le sont.
    expect(drive).toMatch(/Formats convertibles/);
    // ET L'ANCIENNE PHRASE MUETTE A DISPARU.
    expect(drive, "« ce type de fichier ne peut pas être converti » ne dit ni pourquoi ni quoi faire")
      .not.toContain("Ce type de fichier ne peut pas être converti.");
    expect(drive).not.toContain("Conversion PDF indisponible (éditeur Office non configuré).");
  });
});
