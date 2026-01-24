import re


def clean(text):
    if not text:
        return ""
    # Remove extra whitespace and special characters
    return re.sub(r"\s+", " ", str(text)).strip()


# Removed normalize_date - use backend.core.date_utils.normalize_date


def has_value(val):
    if val is None:
        return False
    if isinstance(val, str) and not val.strip():
        return False
    return True


def to_int(val, default=0):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def find_value(data, keys, default=None):
    if not data or not keys:
        return default
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return default
