import { catalogueDe, estTypeConnu, normaliserType } from "./catalogue";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INGESTION UNIVERSELLE (mandat 5 §37), la part PURE : identifier → normaliser → décider.
 *
 *   Event → identify → normalize → authorize → associate → trigger
 *
 * Ce module fait les étapes qui ne touchent rien : reconnaître la source et le fait, ramener la
 * charge d'un fournisseur (DocuSign Connect, SAP, HubSpot, PCH, IQVIA, e-signature, générique) à
 * UNE forme canonique — type du catalogue, émetteur, références « TYPE:id » sûres, mentions libres
 * à résoudre, charge nettoyée de tout secret et bornée —, puis DÉCIDER de l'association : sûre
 * (rattachée), douteuse (à vérifier, jamais rattachée en silence), absente. L'autorisation (la
 * signature du webhook), la déduplication, la résolution d'entités et l'inscription au registre
 * vivent dans le pont (`platform/in-process/events/ingestion.ts`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const SOURCES = ["docusign", "sap", "hubspot", "pch", "iqvia", "signature", "generic"] as const;
export type Source = (typeof SOURCES)[number];
export const estSource = (s: string): s is Source => (SOURCES as readonly string[]).includes(s);

export interface FaitNormalise {
  source: Source;
  /** L'identifiant du fournisseur (exactly-once) — `null` quand il n'en donne pas : le pont en dérive un du corps. */
  externalId: string | null;
  type: string;
  sourceDomain: string;
  occurredAt: Date | null;
  emetteur: { email: string | null; nom: string | null; systeme: string };
  /** Les références SÛRES, en « TYPE:id » — données par le fournisseur ou nos champs personnalisés. */
  refs: string[];
  /** Les mentions LIBRES (un numéro de commande, un nom, un objet) — à résoudre, jamais rattachées telles quelles. */
  mentions: string[];
  payload: Record<string, unknown>;
  /** Vrai quand la charge parle de rémunération, de santé ou d'un litige : rien n'en sort de l'ERP. */
  confidentiel: boolean;
}

export type Normalisation = { ok: true; fait: FaitNormalise } | { ok: false; rejet: string };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null);
const date = (v: unknown): Date | null => { const t = str(v); if (!t) return null; const ms = Date.parse(t); return Number.isFinite(ms) ? new Date(ms) : null; };

const SECRET_RE = /(token|secret|password|passwd|authorization|api[_-]?key|signature|cookie|credential|private)/i;
const CONFIDENTIEL_RE = /(salaire|rémunération|remuneration|paie|payroll|maladie|médical|medical|santé|sante|litige|disciplin|licenciement|sanction)/i;
const TAILLE_TEXTE = 2_000;
const TAILLE_CHARGE = 20_000;

/** NETTOIE une charge : aucun secret, textes bornés, profondeur bornée, taille bornée. */
export function nettoyer(v: unknown, prof = 0): unknown {
  if (prof > 4) return "[profondeur]";
  if (typeof v === "string") return v.length > TAILLE_TEXTE ? `${v.slice(0, TAILLE_TEXTE)}…` : v;
  if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => nettoyer(x, prof + 1));
  if (isObj(v)) {
    const out: Json = {};
    for (const [k, x] of Object.entries(v)) {
      if (SECRET_RE.test(k)) continue;
      out[k] = nettoyer(x, prof + 1);
      if (JSON.stringify(out).length > TAILLE_CHARGE) { out.__tronque = true; break; }
    }
    return out;
  }
  return null;
}

const REF_RE = /^[A-Z][A-Z0-9_]{2,40}:[A-Za-z0-9_-]{3,64}$/;
/** Une référence « TYPE:id » telle que le registre les écrit — une chaîne libre n'en est pas une. */
export const estRef = (v: unknown): v is string => typeof v === "string" && REF_RE.test(v.trim());
const refsDe = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).filter(estRef).map((r) => r.trim());
const mentionsDe = (...vals: unknown[]): string[] => [...new Set(vals.map(str).filter((s): s is string => Boolean(s)).map((s) => s.slice(0, 120)))];

const confidentielDe = (...textes: (string | null | undefined)[]): boolean => textes.some((t) => t && CONFIDENTIEL_RE.test(t));

function fait(source: Source, type: string, base: Partial<FaitNormalise> & { payload: Json }): FaitNormalise {
  const canon = normaliserType(type);
  const cat = catalogueDe(canon);
  return {
    source,
    externalId: base.externalId ?? null,
    type: canon,
    sourceDomain: base.sourceDomain ?? cat?.sourceDomain ?? "external",
    occurredAt: base.occurredAt ?? null,
    emetteur: base.emetteur ?? { email: null, nom: null, systeme: source },
    refs: base.refs ?? [],
    mentions: base.mentions ?? [],
    payload: nettoyer({ ...base.payload, typeCatalogue: cat ? cat.type : null }) as Json,
    confidentiel: base.confidentiel ?? false,
  };
}

// ─────────────────────────────── LES SOURCES ───────────────────────────────

const DOCUSIGN_TYPES: Record<string, string> = {
  "envelope-sent": "SIGNATURE_SENT", "envelope-delivered": "SIGNATURE_SENT",
  "recipient-completed": "SIGNATURE_STEP", "recipient-signed": "SIGNATURE_STEP",
  "envelope-completed": "SIGNATURE_COMPLETED",
  "envelope-declined": "SIGNATURE_DECLINED", "envelope-voided": "SIGNATURE_DECLINED", "recipient-declined": "SIGNATURE_DECLINED",
};

function docusign(c: Json): Normalisation {
  const event = str(c.event)?.toLowerCase();
  const data = isObj(c.data) ? c.data : c;
  const envelopeId = str(data.envelopeId) ?? str((isObj(data.envelopeSummary) ? data.envelopeSummary : {}).envelopeId);
  if (!event || !envelopeId) return { ok: false, rejet: "DocuSign : `event` et `data.envelopeId` sont attendus" };
  const type = DOCUSIGN_TYPES[event];
  if (!type) return { ok: false, rejet: `DocuSign : événement « ${event} » non suivi` };
  const resume = isObj(data.envelopeSummary) ? data.envelopeSummary : {};
  const signers = (isObj(resume.recipients) && Array.isArray(resume.recipients.signers) ? resume.recipients.signers : []).filter(isObj);
  const champs = isObj(resume.customFields) && Array.isArray(resume.customFields.textCustomFields) ? resume.customFields.textCustomFields.filter(isObj) : [];
  const refs = champs.flatMap((f) => (/^(erp|entity|entite|ref)/i.test(str(f.name) ?? "") ? refsDe(f.value) : []));
  const premier = signers[0] ?? {};
  const sujet = str(resume.emailSubject);
  return {
    ok: true,
    fait: fait("docusign", type, {
      externalId: `${envelopeId}:${event}`,
      occurredAt: date(resume.completedDateTime) ?? date(resume.sentDateTime) ?? date(c.generatedDateTime),
      emetteur: { email: str(premier.email), nom: str(premier.name), systeme: "docusign" },
      refs,
      mentions: mentionsDe(sujet, ...signers.map((s) => s.name)),
      payload: { envelopeId, status: str(resume.status) ?? event, subject: sujet, signers: signers.map((s) => ({ nom: str(s.name), email: str(s.email), status: str(s.status) })), from: str(premier.email), fromName: str(premier.name) },
      confidentiel: confidentielDe(sujet),
    }),
  };
}

const SAP_TYPES: Record<string, string> = {
  "purchaseorder.created": "PURCHASE_ORDER_CREATED", "purchaseorder.changed": "PURCHASE_ORDER_CHANGED",
  "invoice.received": "INVOICE_RECEIVED", "supplierinvoice.created": "INVOICE_RECEIVED",
  "payment.issued": "PAYMENT_ISSUED", "payment.received": "PAYMENT_RECEIVED",
  "delivery.updated": "SUPPLIER_DELIVERY_UPDATED", "goodsreceipt.posted": "SUPPLIER_DELIVERY_UPDATED",
};

function sap(c: Json): Normalisation {
  const event = (str(c.event) ?? str(c.eventType) ?? "").toLowerCase().replace(/[\s_-]/g, "");
  const type = SAP_TYPES[event.replace(/\./g, ".")] ?? SAP_TYPES[event.replace(/^(\w+)(created|changed|received|issued|updated|posted)$/, "$1.$2")];
  if (!type) return { ok: false, rejet: `SAP : événement « ${str(c.event) ?? str(c.eventType) ?? "?"} » non suivi` };
  const numero = str(c.PurchaseOrder) ?? str(c.purchaseOrder) ?? str(c.Invoice) ?? str(c.documentNumber);
  const fournisseur = str(c.Supplier) ?? str(c.supplier) ?? str(c.SupplierName);
  return {
    ok: true,
    fait: fait("sap", type, {
      externalId: str(c.eventId) ?? (numero ? `${numero}:${event}` : null),
      occurredAt: date(c.timestamp) ?? date(c.occurredAt),
      emetteur: { email: null, nom: fournisseur, systeme: "sap" },
      refs: refsDe(c.erpRef ?? c.entity),
      mentions: mentionsDe(numero, fournisseur),
      payload: { numero, fournisseur, champs: isObj(c.changedFields) ? c.changedFields : isObj(c.ChangedFields) ? c.ChangedFields : null, montant: c.amount ?? c.Amount ?? null, devise: str(c.currency) ?? str(c.Currency), statut: str(c.status) ?? str(c.Status) },
    }),
  };
}

const HUBSPOT_TYPES: Record<string, string> = {
  "deal.creation": "CRM_DEAL_UPDATED", "deal.propertychange": "CRM_DEAL_UPDATED", "deal.deletion": "CRM_DEAL_UPDATED",
  "contact.creation": "CRM_CONTACT_UPDATED", "contact.propertychange": "CRM_CONTACT_UPDATED",
  "company.creation": "CRM_CONTACT_UPDATED", "company.propertychange": "CRM_CONTACT_UPDATED",
};

function hubspot(c: Json): Normalisation {
  const sub = (str(c.subscriptionType) ?? "").toLowerCase();
  const type = HUBSPOT_TYPES[sub];
  if (!type) return { ok: false, rejet: `HubSpot : abonnement « ${sub || "?"} » non suivi` };
  const objectId = str(c.objectId);
  return {
    ok: true,
    fait: fait("hubspot", type, {
      externalId: str(c.eventId) ?? (objectId ? `${objectId}:${sub}:${str(c.occurredAt) ?? ""}` : null),
      occurredAt: typeof c.occurredAt === "number" ? new Date(c.occurredAt) : date(c.occurredAt),
      emetteur: { email: null, nom: null, systeme: "hubspot" },
      refs: refsDe(c.erpRef),
      mentions: mentionsDe(c.dealName, c.companyName, c.email),
      payload: { objectId, propriete: str(c.propertyName), valeur: c.propertyValue ?? null, abonnement: sub, portail: c.portalId ?? null },
    }),
  };
}

const PCH_TYPES: Record<string, string> = { "tender.published": "TENDER_OPENED", "tender.opened": "TENDER_OPENED", "tender.awarded": "TENDER_AWARDED", "tender.closed": "TENDER_STATUS_CHANGED", "tender.updated": "TENDER_STATUS_CHANGED", "tender.cancelled": "TENDER_STATUS_CHANGED" };

function pch(c: Json): Normalisation {
  const event = (str(c.event) ?? "").toLowerCase();
  const type = PCH_TYPES[event];
  if (!type) return { ok: false, rejet: `PCH : événement « ${event || "?"} » non suivi` };
  const t = isObj(c.tender) ? c.tender : c;
  const reference = str(t.reference) ?? str(t.ref);
  return {
    ok: true,
    fait: fait("pch", type, {
      externalId: str(c.eventId) ?? (reference ? `${reference}:${event}` : null),
      occurredAt: date(c.timestamp) ?? date(t.publishedAt),
      emetteur: { email: null, nom: "PCH", systeme: "pch" },
      refs: refsDe(c.erpRef),
      mentions: mentionsDe(reference, t.title, c.awardedTo),
      payload: { reference, titre: str(t.title), echeance: str(t.deadline), lots: Array.isArray(t.lots) ? t.lots.length : null, attribueA: str(c.awardedTo), statut: event.split(".")[1] ?? null },
    }),
  };
}

function iqvia(c: Json): Normalisation {
  const periode = str(c.period) ?? str(c.periode);
  if (!periode) return { ok: false, rejet: "IQVIA : `period` est attendu" };
  const molecules = Array.isArray(c.molecules) ? c.molecules.map(str).filter((s): s is string => Boolean(s)) : [];
  return {
    ok: true,
    fait: fait("iqvia", "MARKET_DATA_UPDATED", {
      externalId: str(c.eventId) ?? `${str(c.dataset) ?? "market"}:${periode}`,
      occurredAt: date(c.publishedAt),
      emetteur: { email: null, nom: "IQVIA", systeme: "iqvia" },
      mentions: molecules.slice(0, 20),
      payload: { dataset: str(c.dataset), periode, molecules: molecules.length, pays: str(c.country) },
    }),
  };
}

const SIGNATURE_TYPES: Record<string, string> = { sent: "SIGNATURE_SENT", viewed: "SIGNATURE_SENT", signed: "SIGNATURE_STEP", completed: "SIGNATURE_COMPLETED", declined: "SIGNATURE_DECLINED", cancelled: "SIGNATURE_DECLINED", expired: "SIGNATURE_DECLINED" };

function signature(c: Json): Normalisation {
  const event = (str(c.event) ?? str(c.status) ?? "").toLowerCase();
  const type = SIGNATURE_TYPES[event];
  const documentId = str(c.documentId) ?? str(c.id);
  if (!type || !documentId) return { ok: false, rejet: "e-signature : `event` (sent|signed|completed|declined) et `documentId` sont attendus" };
  const signer = isObj(c.signer) ? c.signer : {};
  return {
    ok: true,
    fait: fait("signature", type, {
      externalId: `${documentId}:${event}`,
      occurredAt: date(c.occurredAt) ?? date(c.timestamp),
      emetteur: { email: str(signer.email), nom: str(signer.name), systeme: str(c.provider) ?? "signature" },
      refs: refsDe(c.erpRef ?? c.reference),
      mentions: mentionsDe(c.title, c.reference, signer.name),
      payload: { documentId, titre: str(c.title), reference: str(c.reference), from: str(signer.email), fromName: str(signer.name) },
      confidentiel: confidentielDe(str(c.title)),
    }),
  };
}

function generic(c: Json): Normalisation {
  const typeBrut = str(c.type) ?? str(c.event);
  if (!typeBrut) return { ok: false, rejet: "générique : `type` est attendu" };
  const connu = estTypeConnu(typeBrut);
  const type = connu ? normaliserType(typeBrut) : "WEBHOOK_RECEIVED";
  const from = isObj(c.from) ? c.from : {};
  const entite = isObj(c.entity) && str(c.entity.type) && str(c.entity.id) ? [`${normaliserType(String(c.entity.type))}:${str(c.entity.id)}`] : refsDe(c.entity);
  const charge = isObj(c.payload) ? c.payload : {};
  return {
    ok: true,
    fait: fait("generic", type, {
      externalId: str(c.externalId) ?? str(c.id),
      sourceDomain: str(c.sourceDomain) ?? undefined,
      occurredAt: date(c.occurredAt),
      emetteur: { email: str(from.email), nom: str(from.name) ?? str(from.nom), systeme: str(c.systeme) ?? str(c.system) ?? "generic" },
      refs: [...entite, ...refsDe(c.refs)],
      mentions: mentionsDe(...(Array.isArray(c.mentions) ? c.mentions : [])),
      payload: { ...charge, ...(connu ? {} : { typeBrut }), from: str(from.email), fromName: str(from.name) ?? str(from.nom) },
      confidentiel: c.confidentiel === true || confidentielDe(JSON.stringify(charge).slice(0, 4000)),
    }),
  };
}

/** NORMALISE un lot : une charge, un ou plusieurs faits (HubSpot livre des tableaux). */
export function normaliserLot(source: string, corps: unknown): Normalisation[] {
  if (!estSource(source)) return [{ ok: false, rejet: `source inconnue « ${source} » — sources : ${SOURCES.join(", ")}` }];
  const items = Array.isArray(corps) ? corps : [corps];
  if (items.length === 0) return [{ ok: false, rejet: "charge vide" }];
  return items.slice(0, 100).map((c) => {
    if (!isObj(c)) return { ok: false, rejet: "un fait est un objet JSON" } as Normalisation;
    switch (source) {
      case "docusign": return docusign(c);
      case "sap": return sap(c);
      case "hubspot": return hubspot(c);
      case "pch": return pch(c);
      case "iqvia": return iqvia(c);
      case "signature": return signature(c);
      case "generic": return generic(c);
    }
  });
}

// ─────────────────────────────── LA DÉCISION D'ASSOCIATION ───────────────────────────────

export type DecisionAssociation = "SURE" | "A_VERIFIER" | "SANS_ASSOCIATION";
export const SEUIL_SUR = 0.85;
export const SEUIL_DOUTE = 0.5;

export interface CandidatAssociation { mention: string; ref: string; libelle: string; confiance: number }

/**
 * DÉCIDER : des références sûres rattachent ; une résolution de mention rattache au-dessus de 0,85,
 * s'inscrit « à vérifier » entre 0,5 et 0,85 (jamais rattachée en silence), et s'oublie en dessous.
 * Un fait sans rien à associer est SÛR : il n'y a pas de doute, il n'y a rien à rattacher.
 */
export function decider(refs: readonly string[], candidats: readonly CandidatAssociation[]): { decision: DecisionAssociation; confiance: number; refs: string[]; aVerifier: CandidatAssociation[] } {
  const sures = [...new Set(refs)];
  const parConfiance = [...candidats].sort((a, b) => b.confiance - a.confiance);
  const forts = parConfiance.filter((c) => c.confiance >= SEUIL_SUR);
  const douteux = parConfiance.filter((c) => c.confiance >= SEUIL_DOUTE && c.confiance < SEUIL_SUR);
  if (sures.length || forts.length) {
    return { decision: "SURE", confiance: sures.length ? 1 : forts[0]?.confiance ?? 1, refs: [...new Set([...sures, ...forts.map((c) => c.ref)])], aVerifier: douteux };
  }
  if (douteux.length) return { decision: "A_VERIFIER", confiance: douteux[0]?.confiance ?? SEUIL_DOUTE, refs: [], aVerifier: douteux };
  return { decision: candidats.length ? "SANS_ASSOCIATION" : "SURE", confiance: candidats.length ? (parConfiance[0]?.confiance ?? 0) : 1, refs: [], aVerifier: [] };
}
