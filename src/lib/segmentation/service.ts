import { createHash } from "crypto";
import * as XLSX from "xlsx";
import type { DoctorTitle, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { indexerEtablissements, cleDEtablissement } from "@/lib/annuaires/rattachement";
import { indexerSpecialites } from "@/lib/annuaires/specialites";
import { composeDoctorName } from "@/lib/medical/directory-grid";
import { titleFrom } from "@/lib/medical/directory-sheet";
import { ADVENTUM_COMPANY_ID } from "@/lib/company-defaut";
import { lireClasseur, proposerRegles, type Feuilles, type LectureClasseur, type PropositionRegles } from "./lecture-classeur";
import { rapprocher, typeDEtablissement, type Rapprochement } from "./rapprochement";
import { lireRegles, STATUTS, type Regles, type Statut } from "./regles";
import { segmenterPraticien, type FaitsPraticien, type ResultatPraticien } from "./moteur";

/**
 * SEGMENTATION STUDIO â€” le cÃ´tÃ© BASE : charger une stratÃ©gie et ses faits, prÃ©parer puis appliquer
 * l'import d'un classeur. Les dÃ©cisions vivent dans les modules purs (`regles`, `moteur`,
 * `lecture-classeur`, `rapprochement`) ; ici, on lit et on Ã©crit, dans une transaction.
 */

export interface ProduitClasse { productId: string; rang: number; nom: string; dci: string }

export interface StrategieChargee {
  id: string;
  nom: string;
  statut: string;
  businessUnit: { id: string; name: string };
  produits: ProduitClasse[];
  regle: { id: string; version: number; contenu: unknown; regles: Regles | null; erreurs: string[]; publieeLe: Date; note: string | null } | null;
}

export async function chargerStrategie(id: string): Promise<StrategieChargee | null> {
  const s = await prisma.segmentationStrategie.findUnique({
    where: { id },
    select: {
      id: true, nom: true, statut: true, businessUnit: { select: { id: true, name: true } },
      produits: { where: { jusqua: null }, orderBy: { rang: "asc" }, select: { productId: true, rang: true, product: { select: { canonicalName: true, dci: true } } } },
      regles: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, contenu: true, publieeLe: true, note: true } },
    },
  });
  if (!s) return null;
  const r = s.regles[0];
  const lu = r ? lireRegles(r.contenu) : null;
  return {
    id: s.id, nom: s.nom, statut: s.statut, businessUnit: s.businessUnit,
    produits: s.produits.map((p) => ({ productId: p.productId, rang: p.rang, nom: p.product.canonicalName, dci: p.product.dci })),
    regle: r ? { ...r, regles: lu?.ok ? lu.regles : null, erreurs: lu && !lu.ok ? lu.erreurs : [] } : null,
  };
}

const num = (d: Prisma.Decimal | null): number | null => (d === null ? null : Number(d));
const estStatut = (s: string | null): s is Statut => !!s && (STATUTS as readonly string[]).includes(s);

export interface LignePanel {
  ficheId: string;
  doctorId: string;
  nom: string;
  grade: string;
  etablissement: string | null;
  specialite: string | null;
  statut: Statut | null;
  zone: string | null;
  derniereObservation: Date | null;
  resultat: ResultatPraticien | null;
}

/**
 * Les FAITS de la stratÃ©gie, praticien par praticien, dans la portÃ©e donnÃ©e (`portee` : la clause
 * de l'annuaire qui borne ce que la personne voit â€” le KAM, son panel).
 */
export async function chargerFaits(strategieId: string, portee: Prisma.MedicalDoctorWhereInput = {}): Promise<{ faits: FaitsPraticien[]; lignes: Omit<LignePanel, "resultat">[] }> {
  const fiches = await prisma.segmentationFiche.findMany({
    where: { strategieId, retireeLe: null, doctor: { archivedAt: null, ...portee } },
    select: {
      id: true, statut: true, zone: true,
      doctor: {
        select: {
          id: true, name: true, title: true,
          institutionRef: { select: { name: true } }, institution: true,
          specialtyRef: { select: { name: true } }, specialty: true,
          segmentationObservations: {
            where: { OR: [{ strategieId }, { strategieId: null }] },
            select: { productId: true, potentiel: true, prescriptionsSur10: true, observeLe: true },
            orderBy: { observeLe: "desc" }, take: 20,
          },
          segmentationDerogations: {
            where: { strategieId, leveeLe: null },
            select: { nature: true, productId: true, valeur: true, motif: true, expireLe: true },
          },
        },
      },
    },
    orderBy: { doctor: { name: "asc" } },
  });
  const faits: FaitsPraticien[] = [];
  const lignes: Omit<LignePanel, "resultat">[] = [];
  for (const f of fiches) {
    const d = f.doctor;
    faits.push({
      doctorId: d.id, statut: estStatut(f.statut) ? f.statut : null, zone: f.zone,
      observations: d.segmentationObservations.map((o) => ({ productId: o.productId, potentiel: num(o.potentiel), prescriptionsSur10: num(o.prescriptionsSur10), observeLe: o.observeLe })),
      derogations: d.segmentationDerogations.filter((x) => x.nature === "CIBLAGE" || x.nature === "SEGMENT").map((x) => ({ nature: x.nature as "CIBLAGE" | "SEGMENT", productId: x.productId, valeur: x.valeur, motif: x.motif, expireLe: x.expireLe })),
    });
    lignes.push({
      ficheId: f.id, doctorId: d.id, nom: d.name, grade: d.title,
      etablissement: d.institutionRef?.name ?? d.institution ?? null,
      specialite: d.specialtyRef?.name ?? d.specialty ?? null,
      statut: estStatut(f.statut) ? f.statut : null, zone: f.zone,
      derniereObservation: d.segmentationObservations[0]?.observeLe ?? null,
    });
  }
  return { faits, lignes };
}

/** Le panel calculÃ© : chaque ligne avec son rÃ©sultat (null si la stratÃ©gie n'a pas encore de rÃ¨gles valides). */
export async function chargerPanel(strategie: StrategieChargee, portee: Prisma.MedicalDoctorWhereInput = {}): Promise<LignePanel[]> {
  const { faits, lignes } = await chargerFaits(strategie.id, portee);
  const regles = strategie.regle?.regles ?? null;
  const maintenant = new Date();
  return lignes.map((l, i) => ({ ...l, resultat: regles ? segmenterPraticien(faits[i], regles, maintenant) : null }));
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ IMPORT D'UN CLASSEUR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function lireFeuilles(buffer: Buffer): Feuilles {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const out: Feuilles = {};
  for (const n of wb.SheetNames) out[n] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null, blankrows: true, raw: true });
  return out;
}

export interface ApercuImport {
  ok: true;
  empreinte: string;
  dejaImporte: boolean;
  feuille: string;
  colonnes: { texte: string; champ: string | null }[];
  lignes: number;
  existants: number;
  nouveaux: number;
  ambigus: { ligne: number; nom: string; candidats: number }[];
  doublons: { ligne: number; nom: string; ligneOrigine: number }[];
  conflits: string[];
  etablissementsACreer: string[];
  etablissementsAmbigus: string[];
  specialitesACreer: string[];
  observations: number;
  nonCiblesDuFichier: number;
  produitMentionne: string | null;
  produitConcorde: boolean;
  /** La proposition de rÃ¨gles (si la stratÃ©gie n'a pas encore de version publiÃ©e). */
  regles: PropositionRegles | null;
  anomalies: string[];
}

interface Prepare {
  apercu: ApercuImport;
  lecture: LectureClasseur;
  rappro: Map<number, Rapprochement>;
  etabDe: (nom: string | null) => { id: string | null; creer: string | null };
  specDe: (nom: string | null) => { id: string | null; creer: string | null };
  connus: Map<string, { institutionId: string | null; specialtyId: string | null; title: string; lastName: string | null; firstName: string | null; region: string | null }>;
}

async function preparer(strategie: StrategieChargee, buffer: Buffer): Promise<Prepare | { ok: false; error: string }> {
  const feuilles = lireFeuilles(buffer);
  const lecture = lireClasseur(feuilles);
  if (!lecture) return { ok: false, error: "Aucune feuille de ce classeur n'a la forme d'une segmentation (colonnes Nom, PrÃ©nom, Ã‰tablissement, Statutâ€¦)." };
  if (lecture.lignes.length === 0) return { ok: false, error: `La feuille Â« ${lecture_nom(lecture)} Â» n'a aucune ligne de praticien.` };
  const empreinte = createHash("sha256").update(buffer).digest("hex");
  const deja = await prisma.segmentationImport.findUnique({ where: { strategieId_empreinte: { strategieId: strategie.id, empreinte } }, select: { id: true } });

  const etabs = await prisma.medicalInstitution.findMany({ select: { id: true, name: true, isActive: true, wilaya: true } });
  const trouverEtab = indexerEtablissements(etabs);
  const etablissementsACreer = new Set<string>();
  const etablissementsAmbigus = new Set<string>();
  const etabDe = (nom: string | null) => {
    if (!nom) return { id: null, creer: null };
    const r = trouverEtab(nom);
    if (r.statut === "trouve") return { id: r.etablissement.id, creer: null };
    if (r.statut === "inconnu") { etablissementsACreer.add(nom); return { id: null, creer: nom }; }
    etablissementsAmbigus.add(nom);
    return { id: null, creer: null };
  };
  const specs = await prisma.medicalSpecialty.findMany({ select: { id: true, name: true } });
  const trouverSpec = indexerSpecialites(specs);
  const specialitesACreer = new Map<string, string>();
  const specDe = (nom: string | null) => {
    if (!nom) return { id: null, creer: null };
    const r = trouverSpec(nom);
    if (r.statut === "trouve") return { id: r.specialite.id, creer: null };
    const cle = cleDEtablissement(nom);
    if (!specialitesACreer.has(cle)) specialitesACreer.set(cle, nom);
    return { id: null, creer: specialitesACreer.get(cle)! };
  };

  const docs = await prisma.medicalDoctor.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, lastName: true, firstName: true, institutionId: true, specialtyId: true, title: true, region: true },
  });
  const connus = new Map(docs.map((d) => [d.id, { institutionId: d.institutionId, specialtyId: d.specialtyId, title: d.title, lastName: d.lastName, firstName: d.firstName, region: d.region }]));
  for (const l of lecture.lignes) { etabDe(l.etablissement); specDe(l.specialite); }
  const rappro = rapprocher(lecture.lignes, docs, (nom) => etabDe(nom).id);

  const conflits: string[] = [];
  let existants = 0, nouveaux = 0, observations = 0, nonCibles = 0;
  const ambigus: ApercuImport["ambigus"] = [];
  const doublons: ApercuImport["doublons"] = [];
  for (const l of lecture.lignes) {
    const r = rappro.get(l.ligne)!;
    const nom = [l.nom, l.prenom].filter(Boolean).join(" ");
    if (r.statut === "ambigu") { ambigus.push({ ligne: l.ligne, nom, candidats: r.candidats.length }); continue; }
    if (r.statut === "doublon") { doublons.push({ ligne: l.ligne, nom, ligneOrigine: r.ligneOrigine }); continue; }
    if (r.statut === "existant") {
      existants++;
      const c = connus.get(r.doctorId)!;
      const e = etabDe(l.etablissement).id;
      if (e && c.institutionId && c.institutionId !== e) conflits.push(`Ligne ${l.ligne} (${nom}) : l'annuaire le rattache Ã  un autre Ã©tablissement que Â« ${l.etablissement} Â» â€” l'annuaire est gardÃ©.`);
      const s = specDe(l.specialite).id;
      if (s && c.specialtyId && c.specialtyId !== s) conflits.push(`Ligne ${l.ligne} (${nom}) : spÃ©cialitÃ© diffÃ©rente de Â« ${l.specialite} Â» dans l'annuaire â€” l'annuaire est gardÃ©.`);
    } else nouveaux++;
    if (l.potentiel !== null || l.sur10 !== null) observations++;
    if (l.segmentFichier === "NA") nonCibles++;
  }
  // MÃªme nom dans deux Ã©tablissements du fichier : deux fiches, mais Ã  vÃ©rifier.
  const parNom = new Map<string, string[]>();
  for (const l of lecture.lignes) { const k = [l.nom, l.prenom].filter(Boolean).join(" ").toLowerCase(); parNom.set(k, [...(parNom.get(k) ?? []), `${l.etablissement ?? "?"} (ligne ${l.ligne})`]); }
  for (const [k, v] of parNom) if (v.length > 1 && new Set(v.map((x) => x.replace(/ \(ligne \d+\)$/, ""))).size > 1) conflits.push(`Â« ${k} Â» apparaÃ®t dans plusieurs Ã©tablissements : ${v.join(", ")} â€” vÃ©rifiez qu'il s'agit bien de personnes distinctes.`);

  const p1 = strategie.produits[0];
  const mention = lecture.produitMentionne;
  const produitConcorde = !mention || !p1 || cleDEtablissement(p1.dci).includes(mention.split(" ")[0]) || cleDEtablissement(p1.nom).includes(mention.split(" ")[0]);
  const regles = !strategie.regle && p1 ? proposerRegles(lecture, feuilles, p1.productId) : null;

  return {
    lecture, rappro, etabDe, specDe, connus,
    apercu: {
      ok: true, empreinte, dejaImporte: !!deja, feuille: lecture.feuille,
      colonnes: lecture.entete.filter((c) => c.texte).map((c) => ({ texte: c.texte, champ: c.champ })),
      lignes: lecture.lignes.length, existants, nouveaux, ambigus, doublons, conflits,
      etablissementsACreer: [...etablissementsACreer], etablissementsAmbigus: [...etablissementsAmbigus],
      specialitesACreer: [...specialitesACreer.values()], observations, nonCiblesDuFichier: nonCibles,
      produitMentionne: mention, produitConcorde, regles, anomalies: lecture.anomalies,
    },
  };
}

const lecture_nom = (l: LectureClasseur) => l.feuille;

export async function apercuImport(strategieId: string, buffer: Buffer): Promise<ApercuImport | { ok: false; error: string }> {
  const s = await chargerStrategie(strategieId);
  if (!s) return { ok: false, error: "StratÃ©gie introuvable." };
  if (s.produits.length === 0) return { ok: false, error: "Classez d'abord au moins un produit dans la stratÃ©gie." };
  const p = await preparer(s, buffer);
  return "apercu" in p ? p.apercu : p;
}

export interface BilanImport { ok: true; importId: string; crees: number; misAJour: number; observations: number; etablissementsCrees: number; specialitesCreees: number; reglePubliee: number | null }

/**
 * APPLIQUE l'import, en UNE transaction : rÃ©fÃ©rentiels manquants, praticiens (crÃ©ation, ou complÃ©ment des
 * champs VIDES d'une fiche existante â€” jamais d'Ã©crasement), fiches de la stratÃ©gie, observations
 * historisÃ©es, dÃ©cisions Â« non ciblÃ© Â» du fichier, et â€” si la stratÃ©gie n'a pas encore de rÃ¨gles â€” la
 * version 1 telle que la personne l'a relue.
 */
export async function appliquerImport(
  auteurId: string, strategieId: string, buffer: Buffer, nomFichier: string,
  opts: { reglesContenu?: unknown },
): Promise<BilanImport | { ok: false; error: string }> {
  const s = await chargerStrategie(strategieId);
  if (!s) return { ok: false, error: "StratÃ©gie introuvable." };
  const p1 = s.produits[0];
  if (!p1) return { ok: false, error: "Classez d'abord au moins un produit dans la stratÃ©gie." };
  const prep = await preparer(s, buffer);
  if (!("apercu" in prep)) return prep;
  const { apercu, lecture, rappro, connus } = prep;
  if (apercu.dejaImporte) return { ok: false, error: "Ce fichier a dÃ©jÃ  Ã©tÃ© importÃ© dans cette stratÃ©gie â€” rien n'a Ã©tÃ© ajoutÃ© une seconde fois." };
  let reglesV1: Regles | null = null;
  if (!s.regle) {
    const lu = lireRegles(opts.reglesContenu ?? apercu.regles?.contenu);
    if (!lu.ok) return { ok: false, error: `RÃ¨gles Ã  complÃ©ter avant l'import : ${lu.erreurs.join(" ")}` };
    reglesV1 = lu.regles;
  }

  return prisma.$transaction(async (tx) => {
    const imp = await tx.segmentationImport.create({
      data: { strategieId, nomFichier, empreinte: apercu.empreinte, taille: buffer.length, feuille: apercu.feuille, rapport: apercu as unknown as Prisma.InputJsonValue, auteurId },
      select: { id: true },
    });
    // RÃ©fÃ©rentiels manquants.
    const etabCree = new Map<string, string>();
    for (const nom of apercu.etablissementsACreer) {
      const zone = lecture.lignes.find((l) => l.etablissement === nom)?.zone ?? null;
      const e = await tx.medicalInstitution.create({ data: { name: nom, type: typeDEtablissement(nom), region: zone, createdById: auteurId, notes: `CrÃ©Ã© par l'import de segmentation Â« ${nomFichier} Â».` }, select: { id: true } });
      etabCree.set(cleDEtablissement(nom), e.id);
    }
    const specCree = new Map<string, string>();
    for (const nom of apercu.specialitesACreer) {
      const e = await tx.medicalSpecialty.upsert({ where: { name: nom }, update: {}, create: { name: nom, createdById: auteurId }, select: { id: true } });
      specCree.set(cleDEtablissement(nom), e.id);
    }
    const etabId = (nom: string | null) => (nom ? prep.etabDe(nom).id ?? etabCree.get(cleDEtablissement(nom)) ?? null : null);
    const specId = (nom: string | null) => (nom ? prep.specDe(nom).id ?? specCree.get(cleDEtablissement(nom)) ?? null : null);

    let crees = 0, misAJour = 0, observations = 0;
    for (const l of lecture.lignes) {
      const r = rappro.get(l.ligne)!;
      if (r.statut === "ambigu" || r.statut === "doublon") continue;
      const institutionId = etabId(l.etablissement);
      const specialtyId = specId(l.specialite);
      const title = titleFrom(l.grade);
      let doctorId: string;
      if (r.statut === "existant") {
        doctorId = r.doctorId;
        const c = connus.get(doctorId)!;
        const data: Prisma.MedicalDoctorUncheckedUpdateInput = {};
        if (!c.institutionId && institutionId) { data.institutionId = institutionId; data.institution = l.etablissement; }
        if (!c.specialtyId && specialtyId) { data.specialtyId = specialtyId; data.specialty = l.specialite; }
        if (c.title === "AUTRE" && title !== "AUTRE") data.title = title as DoctorTitle;
        if (!c.lastName && !c.firstName) { data.lastName = l.nom; data.firstName = l.prenom; }
        if (!c.region && l.zone) data.region = l.zone;
        if (Object.keys(data).length) { await tx.medicalDoctor.update({ where: { id: doctorId }, data: { ...data, updatedById: auteurId } }); misAJour++; }
      } else {
        const d = await tx.medicalDoctor.create({
          data: {
            name: composeDoctorName(l.prenom, l.nom), lastName: l.nom, firstName: l.prenom,
            title: title as DoctorTitle, sector: "HOSPITAL",
            institutionId, institution: l.etablissement, specialtyId, specialty: l.specialite,
            region: l.zone, companyId: ADVENTUM_COMPANY_ID, createdById: auteurId,
          },
          select: { id: true },
        });
        doctorId = d.id;
        crees++;
      }
      await tx.segmentationFiche.upsert({
        where: { strategieId_doctorId: { strategieId, doctorId } },
        update: { statut: l.statut, zone: l.zone, source: "IMPORT", importId: imp.id, ligneSource: l.ligne, retireeLe: null, updatedById: auteurId },
        create: { strategieId, doctorId, statut: l.statut, zone: l.zone, source: "IMPORT", importId: imp.id, ligneSource: l.ligne, createdById: auteurId },
      });
      if (l.potentiel !== null || l.sur10 !== null) {
        await tx.hcpObservation.create({
          data: {
            doctorId, strategieId, productId: p1.productId, potentiel: l.potentiel, prescriptionsSur10: l.sur10,
            metrique: lecture.metrique, source: "IMPORT", importId: imp.id, ligneSource: l.ligne, auteurId,
            commentaire: `Import Â« ${nomFichier} Â», ligne ${l.ligne}.`,
          },
        });
        observations++;
      }
      // Â« NA Â» du fichier = non applicable : une DÃ‰CISION de ciblage, tracÃ©e comme telle (et levable).
      if (l.segmentFichier === "NA") {
        await tx.segmentationDerogation.create({
          data: { strategieId, doctorId, nature: "CIBLAGE", valeur: "NON_CIBLE", motif: "ClassÃ© NA (non applicable) dans le fichier importÃ©.", source: "IMPORT", importId: imp.id, auteurId },
        });
      }
    }
    let reglePubliee: number | null = null;
    if (reglesV1) {
      await tx.segmentationRegle.create({ data: { strategieId, version: 1, contenu: reglesV1 as unknown as Prisma.InputJsonValue, note: `Version proposÃ©e par l'import Â« ${nomFichier} Â» et relue avant publication.`, publieeParId: auteurId } });
      reglePubliee = 1;
    }
    return { ok: true as const, importId: imp.id, crees, misAJour, observations, etablissementsCrees: etabCree.size, specialitesCreees: specCree.size, reglePubliee };
  }, { timeout: 120_000, maxWait: 20_000 });
}
