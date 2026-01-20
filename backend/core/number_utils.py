"""
Number utility functions for Sales Manager
"""



def to_int(value: str | int | float | None) -> int | None:
    """
    Convert value to integer, handling None and string inputs

    Args:
        value: Value to convert (can be str, int, float, or None)

    Returns:
        Integer value or None if conversion fails
    """
    if value is None:
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None

        # Remove common formatting characters
        value = value.replace(",", "").replace(" ", "")

        try:
            # Try converting to float first (handles decimals), then to int
            return int(float(value))
        except (ValueError, TypeError):
            return None

    return None


def to_float(value: str | int | float | None) -> float | None:
    """
    Convert value to float, handling None and string inputs

    Args:
        value: Value to convert (can be str, int, float, or None)

    Returns:
        Float value or None if conversion fails
    """
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None

        # Remove common formatting characters
        value = value.replace(",", "").replace(" ", "")

        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    return None


def safe_to_float(value: str | int | float | None, default: float = 0.0, label: str = "numeric") -> float:
    """
    Convert to float with a default value and warning on failure.
    """
    val = to_float(value)
    if val is None:
        if value is not None and str(value).strip() != "":
            import logging
            logging.getLogger(__name__).warning(f"⚠️ Corrupt {label} value: '{value}'. Defaulting to {default}")
        return default
    return val


def safe_to_int(value: str | int | float | None, default: int = 0, label: str = "numeric") -> int:
    """
    Convert to int with a default value and warning on failure.
    """
    val = to_int(value)
    if val is None:
        if value is not None and str(value).strip() != "":
            import logging
            logging.getLogger(__name__).warning(f"⚠️ Corrupt {label} value: '{value}'. Defaulting to {default}")
        return default
    return val


def to_qty(value: str | int | float | None) -> float | None:
    """
    Convert value to float rounded to 3 decimal places (Standard for GST quantities)
    """
    val = to_float(value)
    if val is None:
        return None
    return round(val, 3)


# ============================================================
# TOLERANCE-BASED COMPARISONS (Per BUSINESS_LOGIC_SPEC)
# ============================================================

TOLERANCE = 0.001  # Global tolerance for quantity comparisons


def qty_equal(a: float, b: float) -> bool:
    """
    Check if two quantities are equal within tolerance.
    Used to prevent floating-point comparison errors.
    """
    return abs(float(a or 0) - float(b or 0)) < TOLERANCE


def qty_gte(a: float, b: float) -> bool:
    """
    Check if quantity a >= b within tolerance.
    Returns True if a is greater than or equal to b (minus tolerance).
    """
    return float(a or 0) >= float(b or 0) - TOLERANCE


def qty_gt(a: float, b: float) -> bool:
    """
    Check if quantity a > b (plus tolerance).
    Returns True if a is strictly greater than b.
    """
    return float(a or 0) > float(b or 0) + TOLERANCE
