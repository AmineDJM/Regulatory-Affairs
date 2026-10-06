import { describe, it, expect } from "vitest";
import {
  nombreDeParties, tailleAttendue, partiesValides, ouvrirEnvoi, planDeReprise, finaliserEnvoi,
  TAILLE_PARTIE, type ClientS3Direct,
} from "./televersement-direct";
import { parseListParts, type PartieRecue } from "./object-storage";

/**
 * ENVOI DIRECT AU BUCKET — découpage, reprise, finalisation, sur un client S3 SIMULÉ (aucun réseau).
 *
 * Chaque propriété a son cas qui la ferait tomber :
 *   • la reprise ne signe QUE les parties manquantes — sinon une coupure à 90 % renvoie tout ;
 *   • une partie tronquée repart — sinon un fichier incomplet est déclaré reçu ;
 *   • la finalisation recolle avec les empreintes DU BUCKET, dans l'ordre des numéros ;
 *   • un envoi incomplet est nommé et reste reprenable ; une taille finale fausse est refusée.
 */

const MO = 1024 * 1024;

/** Bucket simulé : garde les parties reçues, recolle, mesure. */
function bucket(opts: { recues?: PartieRecue[]; tailleFinale?: number | null; dejaRecolle?: boolean } = {}) {
  const etat = {
    recues: [...(opts.recues ?? [])],
    signees: [] as number[],
    recolle: null as string[] | null,
    abandonne: false,
  };
  const client: ClientS3Direct = {
    ouvrir: async () => "UP-1",
    parties: async () => {
      if (opts.dejaRecolle) throw new Error("Lecture des parties reçues échouée (404 NoSuchUpload).");
      return etat.recues;
    },
    signerPartie: (_c, _u, n) => { etat.signees.push(n); return `https://bucket/partie-${n}`; },
    recoller: async (_c, _u, etags) => { etat.recolle = etags; },
    abandonner: async () => { etat.abandonne = true; },
    taille: async () => (opts.tailleFinale === undefined ? null : opts.tailleFinale),
  };
  return { client, etat };
}

describe("découpage", () => {
  it("compte les parties et la taille de la dernière", () => {
    expect(nombreDeParties(100 * MO, 32 * MO)).toBe(4);
    expect(tailleAttendue(1, 100 * MO, 32 * MO)).toBe(32 * MO);
    expect(tailleAttendue(4, 100 * MO, 32 * MO)).toBe(4 * MO);
    expect(nombreDeParties(1, 32 * MO)).toBe(1);
  });

  it("une partie absente, hors plage ou TRONQUÉE n'est pas valide", () => {
    const total = 70 * MO, p = 32 * MO;
    const v = partiesValides([
      { numero: 1, etag: '"a"', taille: p },
      { numero: 2, etag: '"b"', taille: p - 1 }, // tronquée : elle repart
      { numero: 3, etag: '"c"', taille: 6 * MO },
      { numero: 9, etag: '"z"', taille: p }, // hors plage
    ], total, p);
    expect([...v.keys()].sort()).toEqual([1, 3]);
  });
});

describe("ouverture et reprise", () => {
  it("un envoi neuf signe TOUTES les parties", async () => {
    const { client, etat } = bucket();
    const { uploadId, plan } = await ouvrirEnvoi("k", 3 * TAILLE_PARTIE + 10, "application/zip", client);
    expect(uploadId).toBe("UP-1");
    expect(plan.nbParties).toBe(4);
    expect(plan.recues).toEqual([]);
    expect(etat.signees).toEqual([1, 2, 3, 4]);
  });

  it("refuse un fichier vide", async () => {
    await expect(ouvrirEnvoi("k", 0, "x", bucket().client)).rejects.toThrow(/vide/);
  });

  it("la REPRISE ne signe que les parties MANQUANTES (le bucket fait foi, pas le navigateur)", async () => {
    const p = 32 * MO, total = 5 * p;
    const { client, etat } = bucket({ recues: [1, 2, 4].map((n) => ({ numero: n, etag: `"e${n}"`, taille: p })) });
    const plan = await planDeReprise("k", "UP-1", total, p, client);
    expect(plan.recues).toEqual([1, 2, 4]);
    expect(Object.keys(plan.urls).map(Number)).toEqual([3, 5]);
    expect(etat.signees).toEqual([3, 5]);
  });
});

describe("finalisation", () => {
  const p = 32 * MO, total = 3 * p - 5;
  const toutes = (): PartieRecue[] => [
    { numero: 3, etag: '"c"', taille: p - 5 }, // dans le désordre : l'ordre des numéros fait foi
    { numero: 1, etag: '"a"', taille: p },
    { numero: 2, etag: '"b"', taille: p },
  ];

  it("recolle avec les empreintes LUES AU BUCKET, dans l'ordre, puis vérifie la taille", async () => {
    const { client, etat } = bucket({ recues: toutes(), tailleFinale: total });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client);
    expect(r).toEqual({ ok: true, taille: total });
    expect(etat.recolle).toEqual(['"a"', '"b"', '"c"']);
  });

  it("un envoi INCOMPLET nomme les parties manquantes et reste reprenable — rien n'est recollé", async () => {
    const { client, etat } = bucket({ recues: toutes().filter((x) => x.numero !== 2), tailleFinale: total });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reprendre).toBe(true);
    expect(r.manquantes).toEqual([2]);
    expect(etat.recolle).toBeNull();
  });

  it("une taille finale fausse est REFUSÉE (jamais un fichier tronqué déclaré reçu)", async () => {
    const { client } = bucket({ recues: toutes(), tailleFinale: total - 1 });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reprendre).toBe(false); expect(r.erreur).toMatch(/Taille reçue incohérente/); }
  });

  it("REJOUABLE : déjà recollé (NoSuchUpload), on vérifie l'objet lui-même", async () => {
    const { client, etat } = bucket({ dejaRecolle: true, tailleFinale: total });
    expect(await finaliserEnvoi("k", "UP-1", total, p, client)).toEqual({ ok: true, taille: total });
    expect(etat.recolle).toBeNull();
  });

  // ── STOCKAGES « COMPATIBLES S3 » ATYPIQUES (Direction, 06/10 : « 5 partie(s) sur 5 manquent ou sont tronquées ») ──

  it("une partie listée SANS sa taille (taille non dite) est acceptée ; la taille de l'objet final tranche", async () => {
    const { client, etat } = bucket({ recues: toutes().map((x) => ({ ...x, taille: 0 })), tailleFinale: total });
    expect(await finaliserEnvoi("k", "UP-1", total, p, client)).toEqual({ ok: true, taille: total });
    expect(etat.recolle).toEqual(['"a"', '"b"', '"c"']);
  });

  it("un stockage qui ne LISTE PAS ses parties : les empreintes reçues par le navigateur prennent le relais", async () => {
    const { client, etat } = bucket({ recues: [], tailleFinale: total });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client, { 1: '"a"', 2: '"b"', 3: '"c"' });
    expect(r).toEqual({ ok: true, taille: total });
    expect(etat.recolle).toEqual(['"a"', '"b"', '"c"']);
  });

  it("sans liste ni empreinte, l'envoi reste incomplet et REPRENABLE (rien n'est recollé)", async () => {
    const { client, etat } = bucket({ recues: [], tailleFinale: null });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client, { 1: '"a"' });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reprendre).toBe(true); expect(r.manquantes).toEqual([2, 3]); }
    expect(etat.recolle).toBeNull();
  });

  it("une partie listée avec une taille DITE et FAUSSE repart, même si le navigateur a son empreinte", async () => {
    const recues = toutes().map((x) => (x.numero === 2 ? { ...x, taille: p - 1 } : x));
    const { client } = bucket({ recues, tailleFinale: total });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client, { 2: '"b"' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.manquantes).toEqual([2]);
  });

  it("objet absent après recollage : refus net", async () => {
    const { client } = bucket({ recues: toutes(), tailleFinale: null });
    const r = await finaliserEnvoi("k", "UP-1", total, p, client);
    expect(r.ok).toBe(false);
  });
});

describe("lecture de ListParts", () => {
  it("lit numéro, ETag et taille, et la page suivante", () => {
    const xml = `<ListPartsResult><IsTruncated>true</IsTruncated><NextPartNumberMarker>2</NextPartNumberMarker>
      <Part><PartNumber>1</PartNumber><ETag>&quot;abc&quot;</ETag><Size>5242880</Size></Part>
      <Part><PartNumber>2</PartNumber><ETag>"def"</ETag><Size>12</Size></Part></ListPartsResult>`;
    expect(parseListParts(xml)).toEqual({
      parties: [{ numero: 1, etag: '"abc"', taille: 5242880 }, { numero: 2, etag: '"def"', taille: 12 }],
      suite: "2",
    });
  });
});
