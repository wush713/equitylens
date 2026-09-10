from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from app.research.calculator import percentage_change


def verify_report(report: dict[str, Any]) -> dict[str, Decimal]:
    required = {"revenue", "net_profit_parent", "operating_cash_flow", "net_assets_parent", "weighted_roe"}
    if report.get("stock_code") != "600519.SH":
        raise ValueError("证券身份不匹配")
    if report.get("periods") != {"current": "2025年度", "previous": "2024年度"}:
        raise ValueError("样本期间必须为2025与2024完整年度，不允许混算半年或季度")
    source = report.get("source", {})
    if not source.get("url", "").startswith("https://www.moutaichina.com/mtgf/articleFileDir/"):
        raise ValueError("样本必须保留已核对的公司年报来源")
    if not source.get("locator") or not report.get("evidence_id"):
        raise ValueError("缺少证据位置")
    if date.fromisoformat(source["published_at"]) > date.today():
        raise ValueError("报告披露时间晚于研究时点")
    if required.difference(report.get("metrics", {})):
        raise ValueError("固定样本缺少必要指标")
    calculated: dict[str, Decimal] = {}
    for key in sorted(required):
        metric = report["metrics"][key]
        expected_unit = "百分比" if key == "weighted_roe" else "人民币元"
        if metric.get("unit") != expected_unit:
            raise ValueError(f"{key}单位不符，拒绝混算")
        change_key = "reported_change_percentage_points" if key == "weighted_roe" else "reported_change_pct"
        try:
            for field in ("current", "previous", change_key):
                value = Decimal(str(metric[field]))
                if not value.is_finite():
                    raise ValueError("非有限数值")
                metric[field] = value
        except (KeyError, InvalidOperation, ValueError) as exc:
            raise ValueError(f"{key}缺少有效原始数值") from exc
        if key == "weighted_roe":
            change = (metric["current"] - metric["previous"]).quantize(Decimal("0.01"))
        else:
            change = percentage_change(metric["current"], metric["previous"])
        if abs(change - metric[change_key]) > Decimal("0.02"):
            raise ValueError(f"{metric['label']}复算与年报披露不一致")
        calculated[key] = change
    return calculated


def verify_claims(claims: list[dict[str, Any]], report: dict[str, Any], changes: dict[str, Decimal]) -> None:
    # This is a bounded, deterministic template verifier, not semantic LLM review.
    from app.research.composer import compose_answer

    expected = compose_answer(report, changes)["claims"]
    if claims != expected:
        raise ValueError("结论、数值、条件或引用与已核对模板不符")
    for claim in claims:
        if claim["evidence_ids"] != [report["evidence_id"]]:
            raise ValueError("存在无效引用")
