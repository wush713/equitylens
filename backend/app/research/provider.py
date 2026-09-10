from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path
from typing import Any


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "moutai_2025_annual.json"


def supports_question(question: str) -> bool:
    normalized = question.replace(" ", "").lower()
    has_company = "茅台" in normalized or "600519" in normalized
    has_intent = any(word in normalized for word in ("经营", "风险", "年报", "财务", "基本面"))
    unsupported = re.search(r"中报|半年|季度|2026|2023|实时|今日|今天|股价|目标价|买入|卖出|仓位|对比|比较|比亚迪|宁德|银行", normalized)
    codes = re.findall(r"(?<!\d)\d{6}(?!\d)", normalized)
    return has_company and has_intent and not unsupported and all(code == "600519" for code in codes)


def load_moutai_report() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"), parse_float=Decimal)
