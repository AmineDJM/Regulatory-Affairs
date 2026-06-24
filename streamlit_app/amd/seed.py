"""Demo data seed for AMD Internal OS (Streamlit / SQLite)."""
from __future__ import annotations

import datetime as dt
import random

import bcrypt

from .db import ENGINE, init_db, session_scope
from .labels import REGULATORY_STEP_ORDER
from .models import (
    AuditLog, Base, BudgetLine, BusinessDevelopmentOpportunity, Comment,
    CongressInternational, CongressNational, Department, Document, LogisticsOrder,
    MedicalDelegatePlan, MedicalDoctor, MedicalVisit, Notification,
    RegulatoryProduct, RegulatoryStep, Sale, SponsoringRequest, User,
)

PASSWORD = "password123"
_HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()

now = dt.datetime.utcnow()
def days_ago(n): return now - dt.timedelta(days=n)
def days_from_now(n): return now + dt.timedelta(days=n)
def pick(arr): return random.choice(arr)
def rng(a, b): return random.randint(a, b)

COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5"]


def build_steps(progress: int) -> list[RegulatoryStep]:
    steps = []
    for idx, type_ in enumerate(REGULATORY_STEP_ORDER):
        status, actual, planned = "NOT_STARTED", None, days_from_now((idx - progress) * 14)
        if idx < progress:
            status, actual, planned = "DONE", days_ago((progress - idx) * 12), days_ago((progress - idx) * 12 + 3)
        elif idx == progress:
            status, planned = "IN_PROGRESS", days_from_now(10)
        steps.append(RegulatoryStep(type=type_, order=idx + 1, status=status, actual_date=actual, planned_date=planned))
    return steps


def reset_schema() -> None:
    Base.metadata.drop_all(ENGINE)
    init_db()


def seed() -> dict:
    reset_schema()
    with session_scope() as s:
        # Departments
        depts = {}
        for name, code in [
            ("Affaires Réglementaires", "REG"), ("Ventes & Commercial", "SALES"),
            ("Logistique", "LOG"), ("Promotion Médicale", "PROMO"),
            ("Business Development", "BD"), ("Finance", "FIN"), ("Direction Générale", "DG"),
        ]:
            d = Department(name=name, code=code)
            s.add(d); s.flush(); depts[code] = d.id

        def mk(email, name, role, title, code, region=None):
            u = User(email=email, name=name, password_hash=_HASH, role=role, title=title,
                     department_id=depts[code], region=region, avatar_color=pick(COLORS),
                     last_login_at=days_ago(rng(0, 5)))
            s.add(u); s.flush(); return u

        superadmin = mk("superadmin@adventum.dz", "Yacine Belkacem", "SUPER_ADMIN", "Administrateur Système", "DG")
        direction = mk("direction@adventum.dz", "Karim Bouzid", "DIRECTION", "Directeur Général", "DG")
        head_reg = mk("regulatory@adventum.dz", "Nadia Benali", "HEAD_OF_REGULATORY", "Responsable Réglementaire", "REG")
        asst1 = mk("assistante1@adventum.dz", "Sara Lounis", "REGULATORY_ASSISTANT", "Assistante Réglementaire", "REG")
        asst2 = mk("assistante2@adventum.dz", "Imene Hadj", "REGULATORY_ASSISTANT", "Assistante Réglementaire", "REG")
        head_sales = mk("sales@adventum.dz", "Riad Cherif", "HEAD_OF_SALES", "Responsable des Ventes", "SALES")
        sales1 = mk("commercial1@adventum.dz", "Walid Mansouri", "SALES_USER", "Délégué Commercial", "SALES", "Centre")
        logistics = mk("logistique@adventum.dz", "Fatima Zerrouki", "LOGISTICS_MANAGER", "Responsable Logistique", "LOG")
        promo = mk("promo@adventum.dz", "Sofiane Khelifi", "MEDICAL_PROMOTION_MANAGER", "Manager Promotion Médicale", "PROMO")
        deleg1 = mk("delegue1@adventum.dz", "Mohamed Saidi", "MEDICAL_DELEGATE", "Délégué Médical", "PROMO", "Alger")
        deleg2 = mk("delegue2@adventum.dz", "Lina Brahimi", "MEDICAL_DELEGATE", "Déléguée Médicale", "PROMO", "Oran")
        bd_mgr = mk("bd@adventum.dz", "Yasmine Tahar", "BUSINESS_DEVELOPMENT_MANAGER", "Manager Business Development", "BD")
        finance = mk("finance@adventum.dz", "Omar Belhadj", "FINANCE_BUDGET_MANAGER", "Responsable Finance", "FIN")
        mk("viewer@adventum.dz", "Invité Lecteur", "VIEWER", "Consultation", "DG")

        # Regulatory
        reg_specs = [
            ("Atorvastatine", "Adventor", "20 mg", "Comprimé pelliculé", "Hypolipémiant", "GENERIC", "Inde", "AWAITING_BV_PAYMENT", "HIGH", 5, asst1),
            ("Ramipril", "Cardiprox", "5 mg", "Comprimé", "Antihypertenseur (IEC)", "GENERIC", "Jordanie", "SUBMITTED", "MEDIUM", 4, asst1),
            ("Insuline Glargine", "Glarvent", "100 UI/ml", "Solution injectable", "Antidiabétique", "BIOSIMILAR", "Allemagne", "RESPONDING_TO_QUERIES", "CRITICAL", 10, asst2),
            ("Amoxicilline/Ac. clavulanique", "Amoxivent", "1 g", "Comprimé", "Antibiotique", "GENERIC", "Espagne", "PRE_SUBMISSION", "MEDIUM", 1, asst2),
            ("Trastuzumab", "Hercept-A", "150 mg", "Poudre pour solution", "Anticancéreux", "BIOSIMILAR", "Suisse", "BLOCKED", "CRITICAL", 3, None),
            ("Métformine", "Glucovent", "850 mg", "Comprimé", "Antidiabétique", "GENERIC", "Inde", "DECISION_OBTAINED", "LOW", 15, None),
        ]
        reg_products = []
        for i, (dci, brand, dosage, form, cls, ptype, country, status, prio, prog, asst) in enumerate(reg_specs, 1):
            p = RegulatoryProduct(
                reference=f"REG-{now.year}-{i:03d}", dci=dci, brand_name=brand, dosage=dosage,
                pharmaceutical_form=form, therapeutic_class=cls,
                partner_lab=pick(["Pharma Lab", "Bio Generics", "MedSource", "GlobalPharma"]),
                country_of_origin=country, product_type=ptype, status=status, priority=prio,
                target_date=days_from_now(rng(-30, 240)), responsible_id=head_reg.id,
                assistant_id=asst.id if asst else None, created_by_id=head_reg.id,
                comments="Dossier suivi en priorité selon planning ANPP.",
            )
            p.assigned_users.append(head_reg)
            if asst:
                p.assigned_users.append(asst)
            p.steps = build_steps(prog)
            s.add(p); s.flush(); reg_products.append(p)

        for cat in ["CTD_FULL", "MODULE_1", "GMP_CERTIFICATE", "CPP", "BV_RECEIPT"]:
            s.add(Document(name=f"{reg_products[0].dci}_{cat}.pdf", category=cat,
                           entity_type="REGULATORY_PRODUCT", entity_id=reg_products[0].id,
                           mime_type="application/pdf", size_bytes=rng(120000, 4500000),
                           confidentiality="RESTRICTED", uploaded_by_id=asst1.id))
        s.add(Comment(entity_type="REGULATORY_PRODUCT", entity_id=reg_products[0].id, author_id=head_reg.id,
                      body="Merci de vérifier la conformité du Module 3 avant dépôt du 2ème BV."))

        # Sponsoring
        spo = [
            ("Société Algérienne de Cardiologie", "Pr. Hamidi", "Cardiologie", "Alger", "Congrès national", 250000, None, "AWAITING_DIRECTION", "HIGH"),
            ("Association des Diabétologues", "Dr. Saadi", "Endocrinologie", "Oran", "Formation", 80000, 80000, "PAID", "MEDIUM"),
            ("CHU Mustapha", "Pr. Larbi", "Oncologie", "Alger", "Symposium", 400000, None, "IN_ANALYSIS", "CRITICAL"),
            ("Clinique El Azhar", "Dr. Benamar", "Pédiatrie", "Constantine", "Matériel", 60000, 45000, "ACCEPTED", "LOW"),
            ("Société de Néphrologie", "Pr. Cherqui", "Néphrologie", "Annaba", "Congrès", 150000, None, "REFUSED", "MEDIUM"),
            ("Ordre des Médecins", None, "Général", "Alger", "Sponsoring institutionnel", 120000, None, "RECEIVED", "HIGH"),
        ]
        for i, (inst, doc, spec, city, type_, req, granted, status, imp) in enumerate(spo, 1):
            final = status in ("PAID", "ACCEPTED", "REFUSED")
            s.add(SponsoringRequest(
                reference=f"SPO-{now.year}-{i:03d}", request_date=days_ago(rng(2, 90)), institution=inst,
                doctor=doc, specialty=spec, city=city, type=type_, description=f"Demande de {type_.lower()} pour {inst}.",
                amount_requested=req, amount_granted=granted, status=status, strategic_importance=imp,
                requester_id=head_sales.id, product=pick(["Adventor", "Cardiprox", "Glarvent"]),
                validated_by=direction.name if final else None, validation_date=days_ago(rng(1, 30)) if final else None,
            ))

        # Budgets
        for dep, init, cons in [
            ("REGULATORY", 5000000, 3200000), ("SPONSORING", 3000000, 2850000),
            ("CONGRESS_INTERNATIONAL", 4000000, 1500000), ("CONGRESS_NATIONAL", 2000000, 900000),
            ("MEDICAL_PROMOTION", 6000000, 4100000), ("LOGISTICS", 8000000, 8600000),
            ("BUSINESS_DEVELOPMENT", 1500000, 400000), ("MARKETING", 2500000, 1900000),
        ]:
            status = "OVER_BUDGET" if cons > init else "AT_RISK" if cons / init > 0.8 else "ON_TRACK"
            s.add(BudgetLine(year=now.year, department=dep, label=f"Budget annuel {dep}", initial_budget=init,
                             consumed_budget=cons, future_committed=rng(100000, 500000), status=status, owner_id=finance.id))

        # Congresses
        for name, country, city, spec, budget, status, start in [
            ("ESC Congress 2026", "Espagne", "Barcelone", "Cardiologie", 1800000, "VALIDATED", 60),
            ("EASD Annual Meeting", "Allemagne", "Berlin", "Diabétologie", 1200000, "CONSIDERED", 120),
            ("ESMO 2026", "France", "Paris", "Oncologie", 2200000, "COMPLETED", -45),
        ]:
            s.add(CongressInternational(name=name, country=country, city=city, specialty=spec, planned_budget=budget,
                                        status=status, start_date=days_from_now(start), end_date=days_from_now(start + 3),
                                        participants="3 cadres Adventum", invited_doctors="5 médecins KOL", products="Adventor, Glarvent"))
        for name, city, host, spec, budget, booth, sympo, status, date in [
            ("Journées de Cardiologie d'Alger", "Alger", "CHU Mustapha", "Cardiologie", 350000, True, True, "ORGANIZED", 25),
            ("Séminaire Diabète Oran", "Oran", "Société de Diabétologie", "Endocrinologie", 180000, True, False, "VALIDATED", 40),
            ("Forum Oncologie Constantine", "Constantine", "CHU Constantine", "Oncologie", 220000, False, True, "COMPLETED", -20),
            ("Rencontres Pédiatriques", "Annaba", "Clinique El Azhar", "Pédiatrie", 95000, True, False, "CONSIDERED", 70),
        ]:
            s.add(CongressNational(name=name, city=city, host_institution=host, specialty=spec, budget=budget,
                                   has_booth=booth, has_symposium=sympo, status=status, date=days_from_now(date),
                                   promoted_products="Cardiprox, Adventor", present_delegates="2 délégués"))

        # Sales
        products = [("Adventor 20mg", "Atorvastatine", 340), ("Cardiprox 5mg", "Ramipril", 180),
                    ("Glarvent 100UI", "Insuline Glargine", 1250), ("Glucovent 850mg", "Métformine", 95),
                    ("Amoxivent 1g", "Amoxicilline", 220)]
        clients = ["PCH Alger", "PCH Oran", "Pharmacie El Hayat", "Grossiste MedDis", "Clinique El Azhar", "CHU Mustapha"]
        sales_rows = []
        for _ in range(160):
            name, dci, price = pick(products)
            qty = rng(50, 2000)
            client = pick(clients)
            is_pch = client.startswith("PCH")
            sales_rows.append(Sale(
                date=days_ago(rng(0, 240)), product=name, dci=dci, client=client, is_pch=is_pch,
                institution="Pharmacie Centrale des Hôpitaux" if is_pch else None, quantity=qty,
                unit_price=price, revenue=qty * price, estimated_margin=qty * price * 0.22,
                payment_status=pick(["PAID", "PAID", "UNPAID", "PARTIAL", "OVERDUE"]),
                delivery_status=pick(["DELIVERED", "DELIVERED", "IN_TRANSIT", "PENDING"]),
                sales_user_id=pick([sales1.id, head_sales.id])))
        s.add_all(sales_rows)

        # Logistics
        for i, (product, supplier, country, status, eta, dep) in enumerate([
            ("Adventor 20mg (vrac)", "Pharma Lab", "Inde", "CUSTOMS", 4, -40),
            ("Glarvent 100UI", "BioPharm GmbH", "Allemagne", "SHIPPED", 12, -10),
            ("Cardiprox 5mg", "MedSource", "Jordanie", "DELIVERED", -15, -60),
            ("Glucovent 850mg", "Global Generics", "Inde", "ARRIVED_TERMINAL", 2, -35),
            ("Amoxivent 1g", "EspañaPharma", "Espagne", "PRODUCTION", 45, 20),
            ("Trastuzumab 150mg", "SwissBio", "Suisse", "BLOCKED", -5, -50),
            ("Insuline (lot 2)", "BioPharm GmbH", "Allemagne", "ORDERED", 60, 30),
            ("Métformine API", "ChemIndia", "Inde", "DELIVERED", -30, -75),
        ], 1):
            s.add(LogisticsOrder(
                reference=f"CMD-{now.year}-{i:03d}", product=product, supplier=supplier, country=country, status=status,
                quantity_ordered=rng(5000, 50000), quantity_received=rng(5000, 50000) if status == "DELIVERED" else 0,
                order_date=days_ago(abs(dep) + 10), estimated_departure=days_from_now(dep),
                actual_departure=days_from_now(dep) if dep < 0 else None, estimated_arrival=days_from_now(eta),
                actual_arrival=days_from_now(eta) if status == "DELIVERED" else None,
                carrier=pick(["Maersk", "DHL", "MSC", "Air France Cargo"]), incoterm=pick(["CIF", "FOB", "DDP"]),
                order_value=rng(50000, 800000), currency="EUR", exchange_rate=145.5, owner_id=logistics.id))

        # Medical
        doctor_specs = [
            ("Dr. Amine Belkacem", "Cardiologie", "Alger", "Alger", "KEY_OPINION_LEADER", deleg1),
            ("Dr. Sami Rebai", "Cardiologie", "Blida", "Alger", "HIGH", deleg1),
            ("Dr. Nour Hamdi", "Endocrinologie", "Alger", "Alger", "MEDIUM", deleg1),
            ("Dr. Karim Aziz", "Diabétologie", "Tipaza", "Alger", "HIGH", deleg1),
            ("Dr. Leila Mansour", "Pédiatrie", "Alger", "Alger", "MEDIUM", deleg1),
            ("Dr. Fares Oualid", "Oncologie", "Oran", "Oran", "KEY_OPINION_LEADER", deleg2),
            ("Dr. Yacine Brahim", "Cardiologie", "Oran", "Oran", "HIGH", deleg2),
            ("Dr. Salima Toumi", "Endocrinologie", "Mostaganem", "Oran", "MEDIUM", deleg2),
            ("Dr. Riad Sahli", "Néphrologie", "Oran", "Oran", "LOW", deleg2),
            ("Dr. Hana Djellal", "Pédiatrie", "Tlemcen", "Oran", "MEDIUM", deleg2),
        ]
        doctors = []
        for name, spec, city, region, inf, deleg in doctor_specs:
            d = MedicalDoctor(name=name, specialty=spec, institution=pick(["CHU", "Clinique privée", "Cabinet"]),
                              city=city, region=region, phone=f"0{rng(5,7)}{rng(10000000,99999999)}",
                              email=f"{name.split()[1].lower()}@med.dz", influence_level=inf,
                              prescription_potential=pick(["HIGH", "MEDIUM", "CRITICAL"]),
                              target_products="Adventor, Cardiprox", last_visit=days_ago(rng(5, 40)),
                              next_visit=days_from_now(rng(3, 30)), delegate_id=deleg.id)
            s.add(d); s.flush(); doctors.append((d, deleg))
        for _ in range(36):
            d, deleg = pick(doctors)
            status = pick(["PLANNED", "COMPLETED", "COMPLETED", "CANCELLED", "POSTPONED"])
            s.add(MedicalVisit(date=days_from_now(rng(1, 30)) if status == "PLANNED" else days_ago(rng(1, 60)),
                               doctor_id=d.id, delegate_id=deleg.id, region=d.region,
                               objective=pick(["Présentation produit", "Suivi prescription", "Relance", "Invitation congrès"]),
                               presented_products=pick(["Adventor", "Cardiprox", "Glarvent"]), status=status,
                               report="Bon accueil, intérêt confirmé." if status == "COMPLETED" else None))
        for deleg in (deleg1, deleg2):
            s.add(MedicalDelegatePlan(delegate_id=deleg.id, week_start=days_from_now(1), region=deleg.region,
                                      visits_target=20, key_doctors_target=5, achieved_visits=rng(8, 18), product_target="Adventor"))

        # Business Development
        for name, dci, type_, market, status, prio, score in [
            ("Sacubitril/Valsartan générique", "Sacubitril/Valsartan", "GENERIC", "Insuffisance cardiaque", "NEGOTIATION", "CRITICAL", 88),
            ("Adalimumab biosimilaire", "Adalimumab", "BIOSIMILAR", "Rhumatologie", "OFFER_RECEIVED", "HIGH", 82),
            ("Licence anticoagulant", "Apixaban", "LICENSE", "Cardiologie", "CONTACTED", "HIGH", 75),
            ("Distribution vaccins", "Multi", "DISTRIBUTION", "Vaccins", "RESEARCH", "MEDIUM", 60),
            ("Façonnage sirops pédiatriques", "Paracétamol", "TOLL_MANUFACTURING", "Pédiatrie", "IDEA", "LOW", 45),
            ("Oncologique princeps", "Pembrolizumab", "ORIGINATOR", "Oncologie", "NDA", "CRITICAL", 90),
            ("Antidiabétique SGLT2", "Empagliflozine", "GENERIC", "Diabète", "VALIDATED", "HIGH", 85),
            ("Antibiotique injectable", "Ceftriaxone", "GENERIC", "Hôpital", "ABANDONED", "LOW", 30),
        ]:
            s.add(BusinessDevelopmentOpportunity(
                name=name, dci=dci, type=type_, target_market=market, status=status, priority=prio, score=score,
                estimated_market_size=rng(50, 500) * 1000000, estimated_price=rng(100, 3000),
                potential_supplier=pick(["IndPharma", "BioSimilars Inc", "EuroMed", "AsiaGen"]),
                supplier_country=pick(["Inde", "Corée", "Suisse", "Chine"]), supplier_contact="contact@supplier.com",
                next_action=pick(["Relancer fournisseur", "Signer NDA", "Analyser offre", "Étude de marché"]),
                next_action_date=days_from_now(rng(2, 20)), owner_id=bd_mgr.id, competitors="2-3 acteurs locaux"))

        # Notifications + audit
        for uid, type_, title, body, link in [
            (asst1.id, "ASSIGNMENT", "Nouveau dossier assigné", "REG-2026-001 — Atorvastatine", "Regulatory"),
            (asst1.id, "DEADLINE_NEAR", "Échéance proche", "Paiement 1er BV sous 10 jours", "Regulatory"),
            (direction.id, "SPONSORING_VALIDATION", "Sponsoring à valider", "Société Algérienne de Cardiologie — 250 000 DZD", "Sponsoring"),
            (direction.id, "BUDGET_EXCEEDED", "Budget dépassé", "Budget Logistique dépassé de 7,5%", "Budgets"),
            (logistics.id, "PCH_DELAY", "Commande PCH en retard", "Trastuzumab bloqué au dédouanement", "Logistique PCH"),
            (head_reg.id, "REGULATORY_BLOCKED", "Dossier bloqué", "Trastuzumab — Hercept-A", "Regulatory"),
            (deleg1.id, "MEDICAL_TOUR", "Tournée prévue", "5 visites planifiées cette semaine", "Promotion médicale"),
            (bd_mgr.id, "BD_NEXT_ACTION", "Action BD à réaliser", "Relancer le fournisseur — Apixaban", "Business Development"),
        ]:
            s.add(Notification(user_id=uid, type=type_, title=title, body=body, link=link))

        for actor, action, module, summary in [
            (head_reg.id, "CREATE", "Regulatory", "Création du dossier REG-2026-001"),
            (direction.id, "VALIDATE", "Sponsoring", "Validation sponsoring Association des Diabétologues"),
            (logistics.id, "UPDATE", "Logistique PCH", "Mise à jour statut commande"),
            (finance.id, "CREATE", "Budgets", "Création ligne budgétaire Logistique"),
            (sales1.id, "IMPORT", "Ventes", "Import de 40 ventes via CSV"),
        ]:
            s.add(AuditLog(actor_id=actor, action=action, module=module, summary=summary))

    with session_scope() as s:
        counts = {
            "users": s.query(User).count(), "regulatory": s.query(RegulatoryProduct).count(),
            "steps": s.query(RegulatoryStep).count(), "sponsoring": s.query(SponsoringRequest).count(),
            "sales": s.query(Sale).count(), "logistics": s.query(LogisticsOrder).count(),
            "doctors": s.query(MedicalDoctor).count(), "visits": s.query(MedicalVisit).count(),
            "bd": s.query(BusinessDevelopmentOpportunity).count(),
        }
    return counts


if __name__ == "__main__":
    print("🌱 Seeding…")
    result = seed()
    print("✅ Seed terminé:", result)
    print(f"🔑 Mot de passe pour tous les comptes: {PASSWORD}")
