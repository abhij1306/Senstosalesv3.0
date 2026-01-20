def num_to_words(num):
    """
    Converts a number to Indian currency words format (e.g., "One Lakh Twenty Thousand").
    Supports up to Crores.
    """
    if num == 0:
        return "Zero"

    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = [
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ]
    tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ]

    def convert_less_than_thousand(n):
        if n == 0:
            return ""
        elif n < 10:
            return units[n]
        elif n < 20:
            return teens[n - 10]
        elif n < 100:
            return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")
        else:
            return units[n // 100] + " Hundred" + (" and " + convert_less_than_thousand(n % 100) if n % 100 != 0 else "")

    crore = num // 10000000
    lakh = (num % 10000000) // 100000
    thousand = (num % 100000) // 1000
    remainder = num % 1000

    parts = []
    if crore > 0:
        parts.append(convert_less_than_thousand(crore) + " Crore")
    if lakh > 0:
        parts.append(convert_less_than_thousand(lakh) + " Lakh")
    if thousand > 0:
        parts.append(convert_less_than_thousand(thousand) + " Thousand")
    if remainder > 0:
        parts.append(convert_less_than_thousand(remainder))

    return " ".join(parts).strip()


def amount_to_words(amount):
    """
    Converts a float amount to "Rupees X and Paise Y Only" format.
    """
    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))

    words = "Rupees " + num_to_words(rupees)
    if paise > 0:
        words += " and Paise " + num_to_words(paise)
    words += " Only"
    return words
