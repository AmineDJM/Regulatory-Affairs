"""End-to-end view rendering + row-level scoping via Streamlit AppTest."""
import pytest
from streamlit.testing.v1 import AppTest

from amd.db import session_scope
from amd.models import User

SCRIPT = '''
import streamlit as st
st.set_page_config(layout="wide")
from amd.db import session_scope
from amd.models import User
from views import NAV
with session_scope() as s:
    u = s.get(User, "{uid}")
    st.session_state["user"] = {{"id": u.id, "name": u.name, "email": u.email, "role": u.role}}
NAV["{module}"][3]()
'''


def _uid(role, email=None):
    with session_scope() as s:
        q = s.query(User).filter(User.role == role)
        if email:
            q = q.filter(User.email == email)
        return q.first().id


def _render(uid, module):
    at = AppTest.from_string(SCRIPT.format(uid=uid, module=module), default_timeout=90)
    at.run()
    return at


CASES = [
    ("DASHBOARD", "DIRECTION"), ("REGULATORY", "HEAD_OF_REGULATORY"),
    ("SPONSORING", "DIRECTION"), ("BUDGETS", "FINANCE_BUDGET_MANAGER"),
    ("SALES", "HEAD_OF_SALES"), ("LOGISTICS", "LOGISTICS_MANAGER"),
    ("MEDICAL", "MEDICAL_PROMOTION_MANAGER"), ("BUSINESS_DEVELOPMENT", "BUSINESS_DEVELOPMENT_MANAGER"),
    ("CONGRESS_INTERNATIONAL", "DIRECTION"), ("CONGRESS_NATIONAL", "MEDICAL_PROMOTION_MANAGER"),
    ("DOCUMENTS", "DIRECTION"), ("NOTIFICATIONS", "DIRECTION"), ("ADMIN", "SUPER_ADMIN"),
]


@pytest.mark.parametrize("module,role", CASES)
def test_view_renders_without_exception(module, role):
    at = _render(_uid(role), module)
    assert not at.exception, f"{module}/{role} raised: {at.exception}"


def test_login_screen_renders():
    at = AppTest.from_file("app.py", default_timeout=60)
    at.run()
    assert not at.exception
    assert any("connecter" in (b.label or "").lower() for b in at.button)


def test_regulatory_row_level_scoping():
    """Head sees all dossiers; an assistant sees only her assigned DCIs."""
    head = _render(_uid("HEAD_OF_REGULATORY"), "REGULATORY")
    asst = _render(_uid("REGULATORY_ASSISTANT", "assistante1@adventum.dz"), "REGULATORY")
    assert len(head.dataframe[0].value) == 6
    assert len(asst.dataframe[0].value) == 2
    assert len(asst.dataframe[0].value) < len(head.dataframe[0].value)
