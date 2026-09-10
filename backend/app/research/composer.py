from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.research.calculator import to_yi


def _pct(value: Decimal) -> str:
    direction = "增长" if value >= 0 else "下降"
    return f"{direction}{abs(value):.2f}%"


def compose_answer(report: dict[str, Any], changes: dict[str, Decimal]) -> dict[str, Any]:
    metrics = report["metrics"]
    evidence_id = report["evidence_id"]
    # These narrative templates require the following explicit premises.
    if not (changes['net_profit_parent'] < changes['revenue'] < 0
            and changes['operating_cash_flow'] < changes['net_profit_parent']
            and changes['net_assets_parent'] > 0 and changes['weighted_roe'] < 0):
        raise ValueError("当前样本不满足这组分析模板的前提，需要重新研究")
    if not any(note.get('topic') == 'operating_cash_flow' and
               '成员单位存款减少' in note.get('text', '') and
               '同业存款增加' in note.get('text', '') for note in report.get('notes', [])):
        raise ValueError("缺少现金流变化原因的原文说明")
    claims = [
        {
            "kind": "calculation",
            "proposition": f"2025年营业收入为{to_yi(metrics['revenue']['current'])}亿元，较2024年的{to_yi(metrics['revenue']['previous'])}亿元{_pct(changes['revenue'])}。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
        {
            "kind": "calculation",
            "proposition": f"2025年归母净利润为{to_yi(metrics['net_profit_parent']['current'])}亿元，较2024年的{to_yi(metrics['net_profit_parent']['previous'])}亿元{_pct(changes['net_profit_parent'])}。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
        {
            "kind": "inference",
            "proposition": "营业收入与归母净利润同时下降，说明2025年度经营增长承压；净利润降幅大于收入降幅，盈利表现弱于收入表现。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
        {
            "kind": "calculation",
            "proposition": f"2025年经营活动现金流量净额为{to_yi(metrics['operating_cash_flow']['current'])}亿元，同比下降{abs(changes['operating_cash_flow']):.2f}%，降幅明显高于归母净利润。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
        {
            "kind": "inference",
            "proposition": "现金流下降需要持续跟踪，但年报将主要原因指向财务公司吸收集团成员单位存款减少及不可随时支取的同业存款增加，因此不能仅凭该指标断言主营销售回款同步恶化。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
        {
            "kind": "calculation",
            "proposition": f"归属于上市公司股东的净资产同比增长{changes['net_assets_parent']:.2f}%，但加权平均净资产收益率由{metrics['weighted_roe']['previous']:.2f}%降至{metrics['weighted_roe']['current']:.2f}%，减少{abs(changes['weighted_roe']):.2f}个百分点。",
            "status": "supported",
            "evidence_ids": [evidence_id],
        },
    ]
    return {
        "headline": "收入和利润小幅回落，现金流与资本回报变化更值得跟踪",
        "summary": "按最近两期完整可比年度观察，贵州茅台2025年收入与归母净利润均低于2024年。经营现金流降幅较大，但公司披露的原因涉及财务公司资金活动，分析时应与主营经营现金回款分开判断。股东净资产继续增长，加权平均净资产收益率有所下降。",
        "period_label": "2025年度 vs 2024年度",
        "limitation": "当前结果来自固定年报样本，只覆盖两期年度核心指标，尚未纳入2026年中报、产品价格、渠道库存、公告事件或估值数据。",
        "claims": claims,
    }
