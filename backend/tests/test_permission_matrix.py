import pytest
from fastapi import HTTPException
from app.routers.permissions import ACCESS, MODULES, ROLES
from app.dependencies.roles import require_roles

EXPECTED_DENIED = {
    "QUAN_LY": set(),
    "PHUC_VU": {"menu_price", "revenue", "employees", "billing", "audit"},
    "BEP": {"menu_price", "revenue", "employees", "tables_bookings", "billing", "audit"},
    "THU_NGAN": {"menu_price", "revenue", "employees", "tables_bookings", "orders", "audit"},
}
SENSITIVE = {"menu_price", "revenue", "employees", "audit"}

@pytest.mark.parametrize("role", [r["key"] for r in ROLES])
@pytest.mark.parametrize("module", sorted(SENSITIVE))
def test_sensitive_role_module_denials_are_explicit(role, module):
    assert (module not in ACCESS[role]) == (module in EXPECTED_DENIED[role])

@pytest.mark.parametrize("role", ["PHUC_VU", "BEP", "THU_NGAN"])
def test_non_manager_is_denied_permission_matrix(role):
    dependency = require_roles("QUAN_LY")
    class User:
        vai_tro = role
    with pytest.raises(HTTPException) as exc:
        dependency(current_user=User())
    assert exc.value.status_code == 403

def test_matrix_covers_every_role_and_module():
    assert len(ROLES) == 4
    assert len(MODULES) >= 6
    assert len(ACCESS) == len(ROLES)
