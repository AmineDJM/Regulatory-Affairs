"""SQLAlchemy models for AMD Internal OS (SQLite).

Mirrors the Prisma schema of the Next.js app. Enums are stored as plain
strings; their French labels and colours live in ``amd/labels.py``.
"""
from __future__ import annotations

import datetime as dt
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def cuid() -> str:
    return uuid4().hex


def now() -> dt.datetime:
    return dt.datetime.utcnow()


class Base(DeclarativeBase):
    pass


# Many-to-many: regulatory product <-> assigned users (row-level access).
regulatory_assignment = Table(
    "regulatory_assignment",
    Base.metadata,
    Column("product_id", ForeignKey("regulatory_products.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String, unique=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    users: Mapped[list["User"]] = relationship(back_populates="department")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="VIEWER")
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_color: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    last_login_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    department: Mapped["Department"] = relationship(back_populates="users")
    assigned_regulatory: Mapped[list["RegulatoryProduct"]] = relationship(
        secondary=regulatory_assignment, back_populates="assigned_users"
    )


class RegulatoryProduct(Base):
    __tablename__ = "regulatory_products"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    reference: Mapped[str] = mapped_column(String, unique=True)
    dci: Mapped[str] = mapped_column(String)
    brand_name: Mapped[str | None] = mapped_column(String, nullable=True)
    dosage: Mapped[str | None] = mapped_column(String, nullable=True)
    pharmaceutical_form: Mapped[str | None] = mapped_column(String, nullable=True)
    therapeutic_class: Mapped[str | None] = mapped_column(String, nullable=True)
    partner_lab: Mapped[str | None] = mapped_column(String, nullable=True)
    country_of_origin: Mapped[str | None] = mapped_column(String, nullable=True)
    product_type: Mapped[str] = mapped_column(String, default="IMPORTED")
    status: Mapped[str] = mapped_column(String, default="PRE_SUBMISSION")
    priority: Mapped[str] = mapped_column(String, default="MEDIUM")
    target_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsible_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assistant_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now, onupdate=now)

    responsible: Mapped["User"] = relationship(foreign_keys=[responsible_id])
    assistant: Mapped["User"] = relationship(foreign_keys=[assistant_id])
    assigned_users: Mapped[list["User"]] = relationship(
        secondary=regulatory_assignment, back_populates="assigned_regulatory"
    )
    steps: Mapped[list["RegulatoryStep"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="RegulatoryStep.order"
    )


class RegulatoryStep(Base):
    __tablename__ = "regulatory_steps"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    product_id: Mapped[str] = mapped_column(ForeignKey("regulatory_products.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)
    order: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    planned_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    actual_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    responsible: Mapped[str | None] = mapped_column(String, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_docs: Mapped[str | None] = mapped_column(String, nullable=True)

    product: Mapped["RegulatoryProduct"] = relationship(back_populates="steps")


class SponsoringRequest(Base):
    __tablename__ = "sponsoring_requests"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    reference: Mapped[str] = mapped_column(String, unique=True)
    request_date: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
    requester_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    institution: Mapped[str] = mapped_column(String)
    doctor: Mapped[str | None] = mapped_column(String, nullable=True)
    specialty: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default="Sponsoring")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount_requested: Mapped[float | None] = mapped_column(Float, nullable=True)
    amount_proposed: Mapped[float | None] = mapped_column(Float, nullable=True)
    amount_granted: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="RECEIVED")
    strategic_importance: Mapped[str] = mapped_column(String, default="MEDIUM")
    product: Mapped[str | None] = mapped_column(String, nullable=True)
    expected_roi: Mapped[str | None] = mapped_column(String, nullable=True)
    final_decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    validated_by: Mapped[str | None] = mapped_column(String, nullable=True)
    validation_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])


class BudgetLine(Base):
    __tablename__ = "budget_lines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    department: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    initial_budget: Mapped[float] = mapped_column(Float, default=0)
    consumed_budget: Mapped[float] = mapped_column(Float, default=0)
    future_committed: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String, default="ON_TRACK")
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class CongressInternational(Base):
    __tablename__ = "congress_international"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    start_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    specialty: Mapped[str | None] = mapped_column(String, nullable=True)
    participants: Mapped[str | None] = mapped_column(String, nullable=True)
    invited_doctors: Mapped[str | None] = mapped_column(String, nullable=True)
    products: Mapped[str | None] = mapped_column(String, nullable=True)
    planned_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="CONSIDERED")
    post_event_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class CongressNational(Base):
    __tablename__ = "congress_national"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    host_institution: Mapped[str | None] = mapped_column(String, nullable=True)
    date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    specialty: Mapped[str | None] = mapped_column(String, nullable=True)
    promoted_products: Mapped[str | None] = mapped_column(String, nullable=True)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_booth: Mapped[bool] = mapped_column(Boolean, default=False)
    has_symposium: Mapped[bool] = mapped_column(Boolean, default=False)
    present_delegates: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="CONSIDERED")
    final_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class Sale(Base):
    __tablename__ = "sales"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    date: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
    product: Mapped[str] = mapped_column(String)
    dci: Mapped[str | None] = mapped_column(String, nullable=True)
    dosage: Mapped[str | None] = mapped_column(String, nullable=True)
    pharmaceutical_form: Mapped[str | None] = mapped_column(String, nullable=True)
    client: Mapped[str] = mapped_column(String)
    institution: Mapped[str | None] = mapped_column(String, nullable=True)
    is_pch: Mapped[bool] = mapped_column(Boolean, default=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    revenue: Mapped[float] = mapped_column(Float, default=0)
    estimated_margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    purchase_order: Mapped[str | None] = mapped_column(String, nullable=True)
    invoice: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_status: Mapped[str] = mapped_column(String, default="UNPAID")
    delivery_status: Mapped[str] = mapped_column(String, default="PENDING")
    sales_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    sales_user: Mapped["User"] = relationship(foreign_keys=[sales_user_id])


class LogisticsOrder(Base):
    __tablename__ = "logistics_orders"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    reference: Mapped[str] = mapped_column(String, unique=True)
    product: Mapped[str] = mapped_column(String)
    dci: Mapped[str | None] = mapped_column(String, nullable=True)
    dosage: Mapped[str | None] = mapped_column(String, nullable=True)
    supplier: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity_ordered: Mapped[int] = mapped_column(Integer, default=0)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    quantity_delivered: Mapped[int] = mapped_column(Integer, default=0)
    order_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    estimated_departure: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    actual_departure: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    estimated_arrival: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    actual_arrival: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    customs_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    pch_delivery_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ORDERED")
    carrier: Mapped[str | None] = mapped_column(String, nullable=True)
    incoterm: Mapped[str | None] = mapped_column(String, nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String, nullable=True)
    bl_awb_number: Mapped[str | None] = mapped_column(String, nullable=True)
    order_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String, default="EUR")
    exchange_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class MedicalDoctor(Base):
    __tablename__ = "medical_doctors"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String)
    specialty: Mapped[str | None] = mapped_column(String, nullable=True)
    institution: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    influence_level: Mapped[str] = mapped_column(String, default="MEDIUM")
    prescription_potential: Mapped[str] = mapped_column(String, default="MEDIUM")
    target_products: Mapped[str | None] = mapped_column(String, nullable=True)
    last_visit: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    next_visit: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    delegate_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    delegate: Mapped["User"] = relationship(foreign_keys=[delegate_id])


class MedicalVisit(Base):
    __tablename__ = "medical_visits"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    date: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
    doctor_id: Mapped[str | None] = mapped_column(ForeignKey("medical_doctors.id"), nullable=True)
    delegate_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    objective: Mapped[str | None] = mapped_column(String, nullable=True)
    presented_products: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PLANNED")
    report: Mapped[str | None] = mapped_column(Text, nullable=True)
    doctor_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    doctor: Mapped["MedicalDoctor"] = relationship(foreign_keys=[doctor_id])
    delegate: Mapped["User"] = relationship(foreign_keys=[delegate_id])


class MedicalDelegatePlan(Base):
    __tablename__ = "medical_delegate_plans"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    delegate_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    week_start: Mapped[dt.datetime] = mapped_column(DateTime, default=now)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    visits_target: Mapped[int] = mapped_column(Integer, default=0)
    key_doctors_target: Mapped[int] = mapped_column(Integer, default=0)
    product_target: Mapped[str | None] = mapped_column(String, nullable=True)
    achieved_visits: Mapped[int] = mapped_column(Integer, default=0)
    manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    delegate: Mapped["User"] = relationship(foreign_keys=[delegate_id])


class BusinessDevelopmentOpportunity(Base):
    __tablename__ = "bd_opportunities"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String)
    dci: Mapped[str | None] = mapped_column(String, nullable=True)
    therapeutic_class: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default="GENERIC")
    target_market: Mapped[str | None] = mapped_column(String, nullable=True)
    estimated_market_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    competitors: Mapped[str | None] = mapped_column(String, nullable=True)
    potential_supplier: Mapped[str | None] = mapped_column(String, nullable=True)
    supplier_country: Mapped[str | None] = mapped_column(String, nullable=True)
    supplier_contact: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="IDEA")
    priority: Mapped[str] = mapped_column(String, default="MEDIUM")
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_action: Mapped[str | None] = mapped_column(String, nullable=True)
    next_action_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, default="OTHER")
    entity_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String)
    file_key: Mapped[str | None] = mapped_column(String, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    confidentiality: Mapped[str] = mapped_column(String, default="INTERNAL")
    uploaded_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    uploaded_by: Mapped["User"] = relationship(foreign_keys=[uploaded_by_id])


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    entity_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    author: Mapped["User"] = relationship(foreign_keys=[author_id])


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String, default="GENERIC")
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String)
    module: Mapped[str] = mapped_column(String)
    entity_type: Mapped[str | None] = mapped_column(String, nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    field: Mapped[str | None] = mapped_column(String, nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=now)

    actor: Mapped["User"] = relationship(foreign_keys=[actor_id])
