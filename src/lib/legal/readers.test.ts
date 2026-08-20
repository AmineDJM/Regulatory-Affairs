import { describe, it, expect } from "vitest";
import {
  isRestricted, canReadLegalDocument, legalReaderWhere, normalizeReaderIds, readersCaption,
} from "./readers";

const ME = "u-me";
const AUTHOR = "u-author";
const READER = "u-reader";

const ctx = (viewerId: string, isSuperAdmin = false) => ({ viewerId, isSuperAdmin });

describe("canReadLegalDocument — quatre portes, et quatre seulement", () => {
  const restricted = { createdById: AUTHOR, readerIds: [READER] };

  it("un lecteur désigné ouvre le document", () => {
    expect(canReadLegalDocument(ctx(READER), restricted)).toBe(true);
  });

  it("le déposant ne se ferme jamais son propre document", () => {
    expect(canReadLegalDocument(ctx(AUTHOR), restricted)).toBe(true);
  });

  it("le Super Admin arbitre — sinon un document sans lecteur vivant serait perdu", () => {
    expect(canReadLegalDocument(ctx(ME, true), restricted)).toBe(true);
  });

  it("quelqu'un d'autre ne le voit PAS, même avec le module Legal", () => {
    expect(canReadLegalDocument(ctx(ME), restricted)).toBe(false);
  });

  // Le seul défaut sûr pour l'historique : deviner des listes aurait fermé des pièces à ceux
  // qui s'en servent, sans que personne sache lesquelles.
  it("sans lecteur désigné, le document reste ouvert au module", () => {
    expect(canReadLegalDocument(ctx(ME), { createdById: AUTHOR, readerIds: [] })).toBe(true);
  });

  it("un document dont le déposant a été supprimé reste lisible de ses lecteurs", () => {
    expect(canReadLegalDocument(ctx(READER), { createdById: null, readerIds: [READER] })).toBe(true);
    expect(canReadLegalDocument(ctx(ME), { createdById: null, readerIds: [READER] })).toBe(false);
  });
});

describe("isRestricted", () => {
  it("un document est restreint dès qu'un lecteur est nommé", () => {
    expect(isRestricted({ createdById: AUTHOR, readerIds: [] })).toBe(false);
    expect(isRestricted({ createdById: AUTHOR, readerIds: [READER] })).toBe(true);
  });
});

describe("legalReaderWhere — la même règle, côté requête", () => {
  it("ne restreint rien pour le Super Admin", () => {
    expect(legalReaderWhere(ctx(ME, true))).toBeNull();
  });

  it("ouvre les trois portes : sans lecteur, déposé par moi, ou je suis nommé", () => {
    expect(legalReaderWhere(ctx(ME))).toEqual({
      OR: [
        { readers: { none: {} } },
        { createdById: ME },
        { readers: { some: { userId: ME } } },
      ],
    });
  });
});

describe("normalizeReaderIds", () => {
  it("écarte le déposant : il a déjà sa porte, l'inscrire prêterait à confusion", () => {
    expect(normalizeReaderIds([AUTHOR, READER], AUTHOR)).toEqual([READER]);
  });

  it("écarte doublons et valeurs vides, en gardant l'ordre", () => {
    expect(normalizeReaderIds([READER, " ", READER, ME, ""], AUTHOR)).toEqual([READER, ME]);
  });

  it("sans déposant connu, ne retire personne", () => {
    expect(normalizeReaderIds([AUTHOR, READER], null)).toEqual([AUTHOR, READER]);
  });
});

describe("readersCaption", () => {
  it("dit l'état en clair, au singulier comme au pluriel", () => {
    expect(readersCaption({ createdById: AUTHOR, readerIds: [] })).toBe("Visible de tout le module Legal");
    expect(readersCaption({ createdById: AUTHOR, readerIds: [READER] })).toContain("1 lecteur désigné");
    expect(readersCaption({ createdById: AUTHOR, readerIds: [READER, ME] })).toContain("2 lecteurs désignés");
  });
});
