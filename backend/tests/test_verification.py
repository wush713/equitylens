from copy import deepcopy
from decimal import Decimal

import pytest

from app.research.provider import load_moutai_report
from app.research.verifier import verify_report, verify_claims
from app.research.composer import compose_answer
from app.runtime import runner


def test_calculations_match_disclosed_values():
    report = load_moutai_report()
    result = verify_report(report)
    assert result == {"revenue": Decimal("-1.21"), "net_profit_parent": Decimal("-4.53"),
                      "operating_cash_flow": Decimal("-33.46"), "net_assets_parent": Decimal("4.95"),
                      "weighted_roe": Decimal("-3.49")}
    claims = compose_answer(report, result)["claims"]
    verify_claims(claims, report, result)
    broken = deepcopy(claims)
    broken[0]["evidence_ids"] = ["invented"]
    with pytest.raises(ValueError):
        verify_claims(broken, report, result)
    broken = deepcopy(claims)
    broken[0]["proposition"] += " 股价必涨。"
    with pytest.raises(ValueError):
        verify_claims(broken, report, result)


@pytest.mark.parametrize("fault", ["unit", "missing", "nan", "zero", "wrong_value", "period", "future", "source"])
def test_bad_evidence_blocks_publication(client, submit, monkeypatch, fault):
    report = load_moutai_report()
    if fault == "unit": report["metrics"]["revenue"]["unit"] = "万元"
    elif fault == "missing": del report["metrics"]["revenue"]
    elif fault == "nan": report["metrics"]["revenue"]["current"] = Decimal("NaN")
    elif fault == "zero": report["metrics"]["revenue"]["previous"] = Decimal("0")
    elif fault == "wrong_value": report["metrics"]["revenue"]["current"] = Decimal("1")
    elif fault == "period": report["periods"]["current"] = "2025上半年"
    elif fault == "future": report["source"]["published_at"] = "2099-01-01"
    elif fault == "source": report["source"]["url"] = ""
    monkeypatch.setattr(runner, "load_moutai_report", lambda: report)
    _, rid = submit()
    runner.process_run(rid)
    result = client.get(f"/api/runs/{rid}").json()
    assert result["status"] == "failed"
    assert result["answer"] is None


def test_narrative_requires_supported_premises():
    report = load_moutai_report()
    changes = verify_report(report)
    changes["revenue"] = Decimal("1")
    with pytest.raises(ValueError):
        compose_answer(report, changes)
