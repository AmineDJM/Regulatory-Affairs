import { describe, it, expect } from "vitest";
import { cleCacheApercu, lirePlage, passeParLeCache, serviePlages, PREFIXE_CACHE_APERCU, SEUIL_CACHE_APERCU } from "./zip-apercu-regles";

const entree = { chemin: "Module 3/3.2.P/rapport.PDF", taille: 488 * 1024 * 1024, tailleCompressee: 400 * 1024 * 1024, decalage: 1234, methode: 8, crc32: 0xdeadbeef };

describe("aperçu d'entrée d'archive — règles", () => {
  it("ne met en cache que les grosses entrées COMPRESSÉES d'une archive du bucket", () => {
    expect(passeParLeCache("blobs/ab/x", entree)).toBe(true);
    expect(passeParLeCache(null, entree)).toBe(false); // archive chiffrée en base : jamais de copie en clair
    expect(passeParLeCache("blobs/ab/x", { ...entree, methode: 0 })).toBe(false);
    expect(passeParLeCache("blobs/ab/x", { ...entree, taille: SEUIL_CACHE_APERCU })).toBe(false);
    expect(serviePlages("blobs/ab/x", { methode: 0 })).toBe(true);
    expect(serviePlages(null, { methode: 0 })).toBe(false);
    expect(serviePlages("blobs/ab/x", { methode: 8 })).toBe(false);
  });

  it("une clé stable, propre à l'archive ET à l'identité de l'entrée", () => {
    const k = cleCacheApercu("blobs/ab/x", entree);
    expect(k).toBe(cleCacheApercu("blobs/ab/x", { ...entree }));
    expect(k.startsWith(PREFIXE_CACHE_APERCU)).toBe(true);
    expect(k.endsWith(".pdf")).toBe(true);
    expect(k).not.toContain("Module"); // aucun nom de fichier en clair dans le bucket
    expect(cleCacheApercu("blobs/ab/y", entree)).not.toBe(k);
    expect(cleCacheApercu("blobs/ab/x", { ...entree, crc32: 1 })).not.toBe(k);
    expect(cleCacheApercu("blobs/ab/x", { ...entree, taille: entree.taille + 1 })).not.toBe(k);
    expect(cleCacheApercu("blobs/ab/x", { ...entree, chemin: "a/sans extension" })).toMatch(/\/[0-9a-f]{40}$/);
  });

  it("lit l'en-tête Range comme le navigateur l'envoie", () => {
    expect(lirePlage(null, 100)).toBeNull();
    expect(lirePlage("bytes=0-", 100)).toEqual({ debut: 0, fin: 99 });
    expect(lirePlage("bytes=10-19", 100)).toEqual({ debut: 10, fin: 19 });
    expect(lirePlage("bytes=90-500", 100)).toEqual({ debut: 90, fin: 99 }); // ramenée dans le fichier
    expect(lirePlage("bytes=-30", 100)).toEqual({ debut: 70, fin: 99 }); // suffixe
    expect(lirePlage("bytes=-300", 100)).toEqual({ debut: 0, fin: 99 });
    expect(lirePlage("bytes=100-", 100)).toBe("hors-limites");
    expect(lirePlage("bytes=-0", 100)).toBe("hors-limites");
    expect(lirePlage("bytes=0-1,5-6", 100)).toBeNull(); // plusieurs plages : on sert le tout
    expect(lirePlage("bytes=20-10", 100)).toBeNull();
    expect(lirePlage("items=0-1", 100)).toBeNull();
  });
});
