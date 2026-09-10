from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


TWO_PLACES = Decimal("0.01")


def percentage_change(current: Decimal, previous: Decimal) -> Decimal:
    if previous == 0:
        raise ValueError("上期数值为零，无法计算同比变化")
    return ((current - previous) / previous * Decimal("100")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def to_yi(value: Decimal) -> Decimal:
    return (value / Decimal("100000000")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
