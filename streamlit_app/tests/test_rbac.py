"""RBAC permission matrix + row-level scoping (pure logic)."""
from amd.rbac import (
    accessible_modules, can, can_validate, has_global_view,
    scope_business_development, scope_medical_doctors, scope_regulatory, scope_sales,
)
from sqlalchemy.sql.elements import False_


def test_super_admin_can_everything():
    assert can("SUPER_ADMIN", "REGULATORY", "DELETE")
    assert can("SUPER_ADMIN", "ADMIN", "CREATE")


def test_head_of_regulatory_scope():
    assert can("HEAD_OF_REGULATORY", "REGULATORY", "VALIDATE")
    assert not can("HEAD_OF_REGULATORY", "SALES", "VIEW")


def test_regulatory_assistant_is_contributor_only():
    assert can("REGULATORY_ASSISTANT", "REGULATORY", "UPDATE")
    assert not can("REGULATORY_ASSISTANT", "REGULATORY", "DELETE")
    assert not can("REGULATORY_ASSISTANT", "REGULATORY", "VALIDATE")


def test_viewer_cannot_create():
    assert not can("VIEWER", "REGULATORY", "CREATE")
    assert can("VIEWER", "DASHBOARD", "VIEW")


def test_navigation_hides_unauthorised_modules():
    sales = accessible_modules("SALES_USER")
    assert "SALES" in sales and "DASHBOARD" in sales
    assert "ADMIN" not in sales and "REGULATORY" not in sales
    assert len(accessible_modules("SUPER_ADMIN")) == 13


def test_regulatory_scoping():
    assert scope_regulatory({"id": "u1", "role": "HEAD_OF_REGULATORY"}) is None
    assert has_global_view("DIRECTION")
    # assistant gets a real OR condition, sales user gets match-nothing
    assert scope_regulatory({"id": "a1", "role": "REGULATORY_ASSISTANT"}) is not None
    assert isinstance(scope_regulatory({"id": "s1", "role": "SALES_USER"}), False_)


def test_sales_and_medical_scoping():
    assert scope_sales({"id": "h", "role": "HEAD_OF_SALES"}) is None
    assert scope_sales({"id": "s", "role": "SALES_USER"}) is not None
    assert scope_medical_doctors({"id": "m", "role": "MEDICAL_PROMOTION_MANAGER"}) is None
    assert scope_medical_doctors({"id": "d", "role": "MEDICAL_DELEGATE"}) is not None
    assert isinstance(scope_business_development({"id": "x", "role": "VIEWER"}), False_)


def test_validation_rights():
    assert can_validate("DIRECTION", "SPONSORING")
    assert not can_validate("SALES_USER", "SPONSORING")
