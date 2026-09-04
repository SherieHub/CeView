"""A business with no recorded services must not have services invented for it.

The prior behaviour put "resort stay" into captions published under a real
operator's name.

Run with: pytest tests/unit/test_no_invented_services.py -v
"""
import pytest

from app.agents.creative_director_agent import node
from app.unavailable import DependencyUnavailable


def test_empty_services_is_a_424_not_an_invention():
    with pytest.raises(DependencyUnavailable) as excinfo:
        node.analyze_services({"core_services": [], "extra_additional_services": []})

    assert excinfo.value.status_code == 424
    assert excinfo.value.dependency == "business_profile"
    assert "core services" in excinfo.value.cause.lower()


def test_fallback_services_constant_no_longer_exists():
    assert not hasattr(node, "_FALLBACK_SERVICES")
