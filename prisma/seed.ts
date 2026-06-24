/* eslint-disable no-console */
import {
  PrismaClient,
  type RegulatoryStepType,
  type StepStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";
const hash = bcrypt.hashSync(PASSWORD, 10);

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const STEP_ORDER: RegulatoryStepType[] = [
  "PRE_SUBMISSION", "CTD_PREPARATION", "DOSSIER_REVIEW", "DOSSIER_SUBMISSION",
  "BV1_PAYMENT", "BV1_RECEIPT", "BV2_PAYMENT", "BV2_RECEIPT", "BV3_PAYMENT",
  "BV3_RECEIPT", "QUERY_RESPONSE", "COMPLEMENTS_REQUESTED", "COMPLEMENTS_SUBMITTED",
  "COMMISSION_REVIEW", "REGISTRATION_DECISION", "AMM_RECEIVED", "DOSSIER_CLOSED",
];

function buildSteps(progress: number) {
  // progress = number of completed steps; next one is IN_PROGRESS.
  return STEP_ORDER.map((type, idx) => {
    let status: StepStatus = "NOT_STARTED";
    let actualDate: Date | null = null;
    let plannedDate: Date | null = daysFromNow((idx - progress) * 14);
    if (idx < progress) {
      status = "DONE";
      actualDate = daysAgo((progress - idx) * 12);
      plannedDate = daysAgo((progress - idx) * 12 + 3);
    } else if (idx === progress) {
      status = "IN_PROGRESS";
      plannedDate = daysFromNow(10);
    }
    return { type, order: idx + 1, status, actualDate, plannedDate };
  });
}

async function main() {
  console.log("🌱 Reset…");
  // Delete in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.regulatoryStep.deleteMany();
  await prisma.regulatoryProduct.deleteMany();
  await prisma.sponsoringRequest.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.congressInternational.deleteMany();
  await prisma.congressNational.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.logisticsOrder.deleteMany();
  await prisma.medicalVisit.deleteMany();
  await prisma.medicalDelegatePlan.deleteMany();
  await prisma.medicalDoctor.deleteMany();
  await prisma.businessDevelopmentOpportunity.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  console.log("🏢 Departments…");
  const departments = await Promise.all(
    [
      ["Affaires Réglementaires", "REG"],
      ["Ventes & Commercial", "SALES"],
      ["Logistique", "LOG"],
      ["Promotion Médicale", "PROMO"],
      ["Business Development", "BD"],
      ["Finance", "FIN"],
      ["Direction Générale", "DG"],
    ].map(([name, code]) => prisma.department.create({ data: { name, code } })),
  );
  const dept = (code: string) => departments.find((d) => d.code === code)!.id;

  console.log("👤 Users…");
  const colors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5"];
  const mkUser = (
    email: string, name: string, role: any, title: string, departmentId?: string, region?: string,
  ) =>
    prisma.user.create({
      data: { email, name, passwordHash: hash, role, title, departmentId, region,
        avatarColor: pick(colors), lastLoginAt: daysAgo(rand(0, 5)) },
    });

  const superadmin = await mkUser("superadmin@adventum.dz", "Yacine Belkacem", "SUPER_ADMIN", "Administrateur Système", dept("DG"));
  const direction = await mkUser("direction@adventum.dz", "Karim Bouzid", "DIRECTION", "Directeur Général", dept("DG"));
  const headReg = await mkUser("regulatory@adventum.dz", "Nadia Benali", "HEAD_OF_REGULATORY", "Responsable Réglementaire", dept("REG"));
  const assistant1 = await mkUser("assistante1@adventum.dz", "Sara Lounis", "REGULATORY_ASSISTANT", "Assistante Réglementaire", dept("REG"));
  const assistant2 = await mkUser("assistante2@adventum.dz", "Imene Hadj", "REGULATORY_ASSISTANT", "Assistante Réglementaire", dept("REG"));
  const headSales = await mkUser("sales@adventum.dz", "Riad Cherif", "HEAD_OF_SALES", "Responsable des Ventes", dept("SALES"));
  const sales1 = await mkUser("commercial1@adventum.dz", "Walid Mansouri", "SALES_USER", "Délégué Commercial", dept("SALES"), "Centre");
  const logistics = await mkUser("logistique@adventum.dz", "Fatima Zerrouki", "LOGISTICS_MANAGER", "Responsable Logistique", dept("LOG"));
  const promoMgr = await mkUser("promo@adventum.dz", "Sofiane Khelifi", "MEDICAL_PROMOTION_MANAGER", "Manager Promotion Médicale", dept("PROMO"));
  const delegate1 = await mkUser("delegue1@adventum.dz", "Mohamed Saidi", "MEDICAL_DELEGATE", "Délégué Médical", dept("PROMO"), "Alger");
  const delegate2 = await mkUser("delegue2@adventum.dz", "Lina Brahimi", "MEDICAL_DELEGATE", "Déléguée Médicale", dept("PROMO"), "Oran");
  const bdMgr = await mkUser("bd@adventum.dz", "Yasmine Tahar", "BUSINESS_DEVELOPMENT_MANAGER", "Manager Business Development", dept("BD"));
  const finance = await mkUser("finance@adventum.dz", "Omar Belhadj", "FINANCE_BUDGET_MANAGER", "Responsable Finance", dept("FIN"));
  await mkUser("viewer@adventum.dz", "Invité Lecteur", "VIEWER", "Consultation", dept("DG"));

  console.log("💊 Regulatory…");
  const regSpecs = [
    { dci: "Atorvastatine", brand: "Adventor", dosage: "20 mg", form: "Comprimé pelliculé", cls: "Hypolipémiant", type: "GENERIC", country: "Inde", status: "AWAITING_BV_PAYMENT", priority: "HIGH", progress: 5, assistant: assistant1 },
    { dci: "Ramipril", brand: "Cardiprox", dosage: "5 mg", form: "Comprimé", cls: "Antihypertenseur (IEC)", type: "GENERIC", country: "Jordanie", status: "SUBMITTED", priority: "MEDIUM", progress: 4, assistant: assistant1 },
    { dci: "Insuline Glargine", brand: "Glarvent", dosage: "100 UI/ml", form: "Solution injectable", cls: "Antidiabétique", type: "BIOSIMILAR", country: "Allemagne", status: "RESPONDING_TO_QUERIES", priority: "CRITICAL", progress: 10, assistant: assistant2 },
    { dci: "Amoxicilline/Ac. clavulanique", brand: "Amoxivent", dosage: "1 g", form: "Comprimé", cls: "Antibiotique", type: "GENERIC", country: "Espagne", status: "PRE_SUBMISSION", priority: "MEDIUM", progress: 1, assistant: assistant2 },
    { dci: "Trastuzumab", brand: "Hercept-A", dosage: "150 mg", form: "Poudre pour solution", cls: "Anticancéreux", type: "BIOSIMILAR", country: "Suisse", status: "BLOCKED", priority: "CRITICAL", progress: 3, assistant: null },
    { dci: "Métformine", brand: "Glucovent", dosage: "850 mg", form: "Comprimé", cls: "Antidiabétique", type: "GENERIC", country: "Inde", status: "DECISION_OBTAINED", priority: "LOW", progress: 15, assistant: null },
  ];

  const regProducts = [];
  let regIdx = 1;
  for (const s of regSpecs) {
    const reference = `REG-${now.getFullYear()}-${String(regIdx++).padStart(3, "0")}`;
    const assignIds = [headReg.id, ...(s.assistant ? [s.assistant.id] : [])];
    const p = await prisma.regulatoryProduct.create({
      data: {
        reference, dci: s.dci, brandName: s.brand, dosage: s.dosage, pharmaceuticalForm: s.form,
        therapeuticClass: s.cls, partnerLab: pick(["Pharma Lab", "Bio Generics", "MedSource", "GlobalPharma"]),
        countryOfOrigin: s.country, productType: s.type as any, status: s.status as any, priority: s.priority as any,
        targetDate: daysFromNow(rand(-30, 240)), responsibleId: headReg.id, assistantId: s.assistant?.id ?? null,
        createdById: headReg.id, updatedById: headReg.id,
        assignedUsers: { connect: assignIds.map((id) => ({ id })) },
        steps: { create: buildSteps(s.progress) },
        comments: "Dossier suivi en priorité selon planning ANPP.",
      },
    });
    regProducts.push(p);
  }

  // Documents (metadata) for the first product.
  const docCats = ["CTD_FULL", "MODULE_1", "GMP_CERTIFICATE", "CPP", "BV_RECEIPT"];
  for (const cat of docCats) {
    await prisma.document.create({
      data: {
        name: `${regProducts[0].dci}_${cat}.pdf`, category: cat as any,
        entityType: "REGULATORY_PRODUCT", entityId: regProducts[0].id,
        mimeType: "application/pdf", sizeBytes: rand(120000, 4500000), confidentiality: "RESTRICTED",
        uploadedById: assistant1.id,
      },
    });
  }
  await prisma.comment.create({
    data: { entityType: "REGULATORY_PRODUCT", entityId: regProducts[0].id, authorId: headReg.id,
      body: "Merci de vérifier la conformité du Module 3 avant dépôt du 2ème BV." },
  });

  console.log("🤝 Sponsoring…");
  const sponsoringSpecs = [
    { inst: "Société Algérienne de Cardiologie", doctor: "Pr. Hamidi", spec: "Cardiologie", city: "Alger", type: "Congrès national", req: 250000, status: "AWAITING_DIRECTION", imp: "HIGH" },
    { inst: "Association des Diabétologues", doctor: "Dr. Saadi", spec: "Endocrinologie", city: "Oran", type: "Formation", req: 80000, granted: 80000, status: "PAID", imp: "MEDIUM" },
    { inst: "CHU Mustapha", doctor: "Pr. Larbi", spec: "Oncologie", city: "Alger", type: "Symposium", req: 400000, status: "IN_ANALYSIS", imp: "CRITICAL" },
    { inst: "Clinique El Azhar", doctor: "Dr. Benamar", spec: "Pédiatrie", city: "Constantine", type: "Matériel", req: 60000, granted: 45000, status: "ACCEPTED", imp: "LOW" },
    { inst: "Société de Néphrologie", doctor: "Pr. Cherqui", spec: "Néphrologie", city: "Annaba", type: "Congrès", req: 150000, status: "REFUSED", imp: "MEDIUM" },
    { inst: "Ordre des Médecins", doctor: null, spec: "Général", city: "Alger", type: "Sponsoring institutionnel", req: 120000, status: "RECEIVED", imp: "HIGH" },
  ];
  let spoIdx = 1;
  for (const s of sponsoringSpecs) {
    await prisma.sponsoringRequest.create({
      data: {
        reference: `SPO-${now.getFullYear()}-${String(spoIdx++).padStart(3, "0")}`,
        requestDate: daysAgo(rand(2, 90)), institution: s.inst, doctor: s.doctor, specialty: s.spec, city: s.city,
        type: s.type, description: `Demande de ${s.type.toLowerCase()} pour ${s.inst}.`,
        amountRequested: s.req, amountGranted: (s as any).granted ?? null,
        status: s.status as any, strategicImportance: s.imp as any, requesterId: headSales.id,
        product: pick(["Adventor", "Cardiprox", "Glarvent"]),
        validatedBy: ["PAID", "ACCEPTED", "REFUSED"].includes(s.status) ? direction.name : null,
        validationDate: ["PAID", "ACCEPTED", "REFUSED"].includes(s.status) ? daysAgo(rand(1, 30)) : null,
        createdById: headSales.id,
      },
    });
  }

  console.log("💰 Budgets…");
  const budgetCats = [
    { dep: "REGULATORY", init: 5000000, cons: 3200000 },
    { dep: "SPONSORING", init: 3000000, cons: 2850000 },
    { dep: "CONGRESS_INTERNATIONAL", init: 4000000, cons: 1500000 },
    { dep: "CONGRESS_NATIONAL", init: 2000000, cons: 900000 },
    { dep: "MEDICAL_PROMOTION", init: 6000000, cons: 4100000 },
    { dep: "LOGISTICS", init: 8000000, cons: 8600000 },
    { dep: "BUSINESS_DEVELOPMENT", init: 1500000, cons: 400000 },
    { dep: "MARKETING", init: 2500000, cons: 1900000 },
  ];
  for (const b of budgetCats) {
    const status = b.cons > b.init ? "OVER_BUDGET" : b.cons / b.init > 0.8 ? "AT_RISK" : "ON_TRACK";
    await prisma.budgetLine.create({
      data: { year: now.getFullYear(), department: b.dep as any, label: `Budget annuel ${b.dep}`,
        initialBudget: b.init, consumedBudget: b.cons, futureCommitted: rand(100000, 500000),
        status: status as any, ownerId: finance.id, createdById: finance.id },
    });
  }

  console.log("🌍 Congresses…");
  const intlCongresses = [
    { name: "ESC Congress 2026", country: "Espagne", city: "Barcelone", spec: "Cardiologie", budget: 1800000, status: "VALIDATED", start: 60 },
    { name: "EASD Annual Meeting", country: "Allemagne", city: "Berlin", spec: "Diabétologie", budget: 1200000, status: "CONSIDERED", start: 120 },
    { name: "ESMO 2026", country: "France", city: "Paris", spec: "Oncologie", budget: 2200000, status: "COMPLETED", start: -45 },
  ];
  for (const c of intlCongresses) {
    await prisma.congressInternational.create({
      data: { name: c.name, country: c.country, city: c.city, specialty: c.spec, plannedBudget: c.budget,
        status: c.status as any, startDate: daysFromNow(c.start), endDate: daysFromNow(c.start + 3),
        participants: "3 cadres Adventum", invitedDoctors: "5 médecins KOL", products: "Adventor, Glarvent", createdById: direction.id },
    });
  }
  const natEvents = [
    { name: "Journées de Cardiologie d'Alger", city: "Alger", host: "CHU Mustapha", spec: "Cardiologie", budget: 350000, booth: true, sympo: true, status: "ORGANIZED", date: 25 },
    { name: "Séminaire Diabète Oran", city: "Oran", host: "Société de Diabétologie", spec: "Endocrinologie", budget: 180000, booth: true, sympo: false, status: "VALIDATED", date: 40 },
    { name: "Forum Oncologie Constantine", city: "Constantine", host: "CHU Constantine", spec: "Oncologie", budget: 220000, booth: false, sympo: true, status: "COMPLETED", date: -20 },
    { name: "Rencontres Pédiatriques", city: "Annaba", host: "Clinique El Azhar", spec: "Pédiatrie", budget: 95000, booth: true, sympo: false, status: "CONSIDERED", date: 70 },
  ];
  for (const e of natEvents) {
    await prisma.congressNational.create({
      data: { name: e.name, city: e.city, hostInstitution: e.host, specialty: e.spec, budget: e.budget,
        hasBooth: e.booth, hasSymposium: e.sympo, status: e.status as any, date: daysFromNow(e.date),
        promotedProducts: "Cardiprox, Adventor", presentDelegates: "2 délégués", createdById: promoMgr.id },
    });
  }

  console.log("📈 Sales…");
  const products = [
    { name: "Adventor 20mg", dci: "Atorvastatine", price: 340 },
    { name: "Cardiprox 5mg", dci: "Ramipril", price: 180 },
    { name: "Glarvent 100UI", dci: "Insuline Glargine", price: 1250 },
    { name: "Glucovent 850mg", dci: "Métformine", price: 95 },
    { name: "Amoxivent 1g", dci: "Amoxicilline", price: 220 },
  ];
  const clients = ["PCH Alger", "PCH Oran", "Pharmacie El Hayat", "Grossiste MedDis", "Clinique El Azhar", "CHU Mustapha"];
  const salesData = [];
  for (let i = 0; i < 160; i++) {
    const p = pick(products);
    const qty = rand(50, 2000);
    const client = pick(clients);
    const isPch = client.startsWith("PCH");
    salesData.push({
      date: daysAgo(rand(0, 240)), product: p.name, dci: p.dci, client, isPch,
      institution: isPch ? "Pharmacie Centrale des Hôpitaux" : null,
      quantity: qty, unitPrice: p.price, revenue: qty * p.price,
      estimatedMargin: qty * p.price * 0.22,
      paymentStatus: pick(["PAID", "PAID", "UNPAID", "PARTIAL", "OVERDUE"]) as any,
      deliveryStatus: pick(["DELIVERED", "DELIVERED", "IN_TRANSIT", "PENDING"]) as any,
      salesUserId: pick([sales1.id, headSales.id]), createdById: headSales.id,
    });
  }
  await prisma.sale.createMany({ data: salesData });

  console.log("🚚 Logistics…");
  const logSpecs = [
    { product: "Adventor 20mg (vrac)", supplier: "Pharma Lab", country: "Inde", status: "CUSTOMS", eta: 4, dep: -40 },
    { product: "Glarvent 100UI", supplier: "BioPharm GmbH", country: "Allemagne", status: "SHIPPED", eta: 12, dep: -10 },
    { product: "Cardiprox 5mg", supplier: "MedSource", country: "Jordanie", status: "DELIVERED", eta: -15, dep: -60 },
    { product: "Glucovent 850mg", supplier: "Global Generics", country: "Inde", status: "ARRIVED_TERMINAL", eta: 2, dep: -35 },
    { product: "Amoxivent 1g", supplier: "EspañaPharma", country: "Espagne", status: "PRODUCTION", eta: 45, dep: 20 },
    { product: "Trastuzumab 150mg", supplier: "SwissBio", country: "Suisse", status: "BLOCKED", eta: -5, dep: -50 },
    { product: "Insuline (lot 2)", supplier: "BioPharm GmbH", country: "Allemagne", status: "ORDERED", eta: 60, dep: 30 },
    { product: "Métformine API", supplier: "ChemIndia", country: "Inde", status: "DELIVERED", eta: -30, dep: -75 },
  ];
  let logIdx = 1;
  for (const l of logSpecs) {
    await prisma.logisticsOrder.create({
      data: {
        reference: `CMD-${now.getFullYear()}-${String(logIdx++).padStart(3, "0")}`,
        product: l.product, supplier: l.supplier, country: l.country, status: l.status as any,
        quantityOrdered: rand(5000, 50000), quantityReceived: l.status === "DELIVERED" ? rand(5000, 50000) : 0,
        orderDate: daysAgo(Math.abs(l.dep) + 10), estimatedDeparture: daysFromNow(l.dep),
        actualDeparture: l.dep < 0 ? daysFromNow(l.dep) : null,
        estimatedArrival: daysFromNow(l.eta), actualArrival: l.status === "DELIVERED" ? daysFromNow(l.eta) : null,
        carrier: pick(["Maersk", "DHL", "MSC", "Air France Cargo"]), incoterm: pick(["CIF", "FOB", "DDP"]),
        orderValue: rand(50000, 800000), currency: "EUR", exchangeRate: 145.5,
        ownerId: logistics.id, createdById: logistics.id,
      },
    });
  }

  console.log("🩺 Medical…");
  const doctorSpecs = [
    { name: "Dr. Amine Belkacem", spec: "Cardiologie", city: "Alger", region: "Alger", inf: "KEY_OPINION_LEADER", del: delegate1 },
    { name: "Dr. Sami Rebai", spec: "Cardiologie", city: "Blida", region: "Alger", inf: "HIGH", del: delegate1 },
    { name: "Dr. Nour Hamdi", spec: "Endocrinologie", city: "Alger", region: "Alger", inf: "MEDIUM", del: delegate1 },
    { name: "Dr. Karim Aziz", spec: "Diabétologie", city: "Tipaza", region: "Alger", inf: "HIGH", del: delegate1 },
    { name: "Dr. Leila Mansour", spec: "Pédiatrie", city: "Alger", region: "Alger", inf: "MEDIUM", del: delegate1 },
    { name: "Dr. Fares Oualid", spec: "Oncologie", city: "Oran", region: "Oran", inf: "KEY_OPINION_LEADER", del: delegate2 },
    { name: "Dr. Yacine Brahim", spec: "Cardiologie", city: "Oran", region: "Oran", inf: "HIGH", del: delegate2 },
    { name: "Dr. Salima Toumi", spec: "Endocrinologie", city: "Mostaganem", region: "Oran", inf: "MEDIUM", del: delegate2 },
    { name: "Dr. Riad Sahli", spec: "Néphrologie", city: "Oran", region: "Oran", inf: "LOW", del: delegate2 },
    { name: "Dr. Hana Djellal", spec: "Pédiatrie", city: "Tlemcen", region: "Oran", inf: "MEDIUM", del: delegate2 },
  ];
  const doctors = [];
  for (const d of doctorSpecs) {
    const doc = await prisma.medicalDoctor.create({
      data: { name: d.name, specialty: d.spec, institution: pick(["CHU", "Clinique privée", "Cabinet"]),
        city: d.city, region: d.region, phone: `0${rand(5, 7)}${rand(10000000, 99999999)}`,
        email: `${d.name.split(" ")[1].toLowerCase()}@med.dz`, influenceLevel: d.inf as any,
        prescriptionPotential: pick(["HIGH", "MEDIUM", "CRITICAL"]) as any, targetProducts: "Adventor, Cardiprox",
        lastVisit: daysAgo(rand(5, 40)), nextVisit: daysFromNow(rand(3, 30)), delegateId: d.del.id, createdById: d.del.id },
    });
    doctors.push({ doc, del: d.del });
  }
  for (let i = 0; i < 36; i++) {
    const { doc, del } = pick(doctors);
    const status = pick(["PLANNED", "COMPLETED", "COMPLETED", "CANCELLED", "POSTPONED"]);
    await prisma.medicalVisit.create({
      data: { date: status === "PLANNED" ? daysFromNow(rand(1, 30)) : daysAgo(rand(1, 60)),
        doctorId: doc.id, delegateId: del.id, region: doc.region, objective: pick(["Présentation produit", "Suivi prescription", "Relance", "Invitation congrès"]),
        presentedProducts: pick(["Adventor", "Cardiprox", "Glarvent"]), status: status as any,
        report: status === "COMPLETED" ? "Bon accueil, intérêt confirmé pour le produit." : null,
        createdById: del.id },
    });
  }
  for (const del of [delegate1, delegate2]) {
    await prisma.medicalDelegatePlan.create({
      data: { delegateId: del.id, weekStart: daysFromNow(1), region: del.region ?? "", visitsTarget: 20,
        keyDoctorsTarget: 5, achievedVisits: rand(8, 18), productTarget: "Adventor", createdById: promoMgr.id },
    });
  }

  console.log("🚀 Business Development…");
  const bdSpecs = [
    { name: "Sacubitril/Valsartan générique", dci: "Sacubitril/Valsartan", type: "GENERIC", market: "Insuffisance cardiaque", status: "NEGOTIATION", prio: "CRITICAL", score: 88 },
    { name: "Adalimumab biosimilaire", dci: "Adalimumab", type: "BIOSIMILAR", market: "Rhumatologie", status: "OFFER_RECEIVED", prio: "HIGH", score: 82 },
    { name: "Licence anticoagulant", dci: "Apixaban", type: "LICENSE", market: "Cardiologie", status: "CONTACTED", prio: "HIGH", score: 75 },
    { name: "Distribution vaccins", dci: "Multi", type: "DISTRIBUTION", market: "Vaccins", status: "RESEARCH", prio: "MEDIUM", score: 60 },
    { name: "Façonnage sirops pédiatriques", dci: "Paracétamol", type: "TOLL_MANUFACTURING", market: "Pédiatrie", status: "IDEA", prio: "LOW", score: 45 },
    { name: "Oncologique princeps", dci: "Pembrolizumab", type: "ORIGINATOR", market: "Oncologie", status: "NDA", prio: "CRITICAL", score: 90 },
    { name: "Antidiabétique SGLT2", dci: "Empagliflozine", type: "GENERIC", market: "Diabète", status: "VALIDATED", prio: "HIGH", score: 85 },
    { name: "Antibiotique injectable", dci: "Ceftriaxone", type: "GENERIC", market: "Hôpital", status: "ABANDONED", prio: "LOW", score: 30 },
  ];
  for (const b of bdSpecs) {
    await prisma.businessDevelopmentOpportunity.create({
      data: { name: b.name, dci: b.dci, type: b.type as any, targetMarket: b.market, status: b.status as any,
        priority: b.prio as any, score: b.score, estimatedMarketSize: rand(50, 500) * 1000000,
        estimatedPrice: rand(100, 3000), potentialSupplier: pick(["IndPharma", "BioSimilars Inc", "EuroMed", "AsiaGen"]),
        supplierCountry: pick(["Inde", "Corée", "Suisse", "Chine"]), supplierContact: "contact@supplier.com",
        nextAction: pick(["Relancer fournisseur", "Signer NDA", "Analyser offre", "Étude de marché"]),
        nextActionDate: daysFromNow(rand(2, 20)), ownerId: bdMgr.id, createdById: bdMgr.id,
        competitors: "2-3 acteurs locaux" },
    });
  }

  console.log("🔔 Notifications & audit…");
  await prisma.notification.createMany({
    data: [
      { userId: assistant1.id, type: "ASSIGNMENT", title: "Nouveau dossier assigné", body: "REG-2026-001 — Atorvastatine", link: "/regulatory" },
      { userId: assistant1.id, type: "DEADLINE_NEAR", title: "Échéance proche", body: "Paiement 1er BV sous 10 jours", link: "/regulatory" },
      { userId: direction.id, type: "SPONSORING_VALIDATION", title: "Sponsoring à valider", body: "Société Algérienne de Cardiologie — 250 000 DZD", link: "/sponsoring" },
      { userId: direction.id, type: "BUDGET_EXCEEDED", title: "Budget dépassé", body: "Budget Logistique dépassé de 7,5%", link: "/budgets" },
      { userId: logistics.id, type: "PCH_DELAY", title: "Commande PCH en retard", body: "Trastuzumab bloqué au dédouanement", link: "/logistics" },
      { userId: headReg.id, type: "REGULATORY_BLOCKED", title: "Dossier bloqué", body: "Trastuzumab — Hercept-A", link: "/regulatory" },
      { userId: delegate1.id, type: "MEDICAL_TOUR", title: "Tournée prévue", body: "5 visites planifiées cette semaine", link: "/medical" },
      { userId: bdMgr.id, type: "BD_NEXT_ACTION", title: "Action BD à réaliser", body: "Relancer le fournisseur — Apixaban", link: "/business-development" },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: headReg.id, action: "CREATE", module: "Regulatory", summary: "Création du dossier REG-2026-001", entityType: "REGULATORY_PRODUCT" },
      { actorId: direction.id, action: "VALIDATE", module: "Sponsoring", summary: "Validation sponsoring Association des Diabétologues", entityType: "SPONSORING" },
      { actorId: logistics.id, action: "UPDATE", module: "Logistique PCH", field: "status", oldValue: "SHIPPED", newValue: "CUSTOMS", summary: "Mise à jour statut commande", entityType: "LOGISTICS" },
      { actorId: finance.id, action: "CREATE", module: "Budgets", summary: "Création ligne budgétaire Logistique", entityType: "BUDGET" },
      { actorId: sales1.id, action: "IMPORT", module: "Ventes", summary: "Import de 40 ventes via CSV" },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    regulatory: await prisma.regulatoryProduct.count(),
    steps: await prisma.regulatoryStep.count(),
    sponsoring: await prisma.sponsoringRequest.count(),
    sales: await prisma.sale.count(),
    logistics: await prisma.logisticsOrder.count(),
    doctors: await prisma.medicalDoctor.count(),
    visits: await prisma.medicalVisit.count(),
    bd: await prisma.businessDevelopmentOpportunity.count(),
  };
  console.log("✅ Seed terminé:", counts);
  console.log(`\n🔑 Connexion: tous les comptes utilisent le mot de passe « ${PASSWORD} »`);
  console.log("   direction@adventum.dz · regulatory@adventum.dz · assistante1@adventum.dz · logistique@adventum.dz …\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
