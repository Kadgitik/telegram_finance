"""Project-wide constants."""

from bot.services.mcc import CATEGORIES, INCOME_CATEGORIES

# Monobank stores money as integer kopecks; divide by this to get UAH.
KOPECKS_PER_UAH = 100.0

__all__ = ["CATEGORIES", "INCOME_CATEGORIES", "KOPECKS_PER_UAH"]
