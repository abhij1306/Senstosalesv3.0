from datetime import datetime


def get_financial_year(date_str: str = None) -> str:
    """
    Get financial year (Apr-Mar) for a given date.
    Returns format: "2024-25"
    """
    if date_str:
        try:
            # Try ISO format
            if "T" in date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            # Fallback to current date if parsing fails
            dt = datetime.now()
    else:
        dt = datetime.now()

    year = dt.year
    month = dt.month

    if month >= 4:
        # April or later: Current year and next year
        fy = f"{year}-{str(year + 1)[2:]}"
    else:
        # Jan-Mar: Previous year and current year
        fy = f"{year - 1}-{str(year)[2:]}"

    return fy
