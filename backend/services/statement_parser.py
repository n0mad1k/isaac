"""
Statement Parser Service
Parses bank/credit card PDF statements and auto-categorizes transactions
"""

import hashlib
import logging
import re
from datetime import date, datetime
from typing import List, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.budget import BudgetCategoryRule, MatchType

logger = logging.getLogger(__name__)


def parse_chase_statement(pdf_bytes: bytes, statement_year: Optional[int] = None) -> List[Dict]:
    """
    Parse a Chase PDF statement (credit card or checking).
    Returns list of dicts: {date, description, amount, transaction_type}
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("pdfplumber not installed. Run: pip install pdfplumber")
        raise ValueError("PDF parsing library not available")

    import io
    pdf_file = io.BytesIO(pdf_bytes)
    transactions = []

    try:
        with pdfplumber.open(pdf_file) as pdf:
            full_text = ""
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"

            if not full_text.strip():
                raise ValueError("Could not extract text from PDF")

            # Detect statement type and year
            if statement_year is None:
                statement_year = _detect_statement_year(full_text)

            # Try Chase credit card format first
            cc_transactions = _parse_chase_credit_card(full_text, statement_year)
            if cc_transactions:
                transactions = cc_transactions
            else:
                # Try Chase checking format
                checking_transactions = _parse_chase_checking(full_text, statement_year)
                if checking_transactions:
                    transactions = checking_transactions

    except Exception as e:
        logger.error(f"Error parsing Chase PDF: {e}")
        raise ValueError(f"Could not parse statement PDF")

    # Generate dedup hashes
    for txn in transactions:
        txn["import_hash"] = _generate_hash(txn)

    return transactions


def _detect_statement_year(text: str) -> int:
    """Detect the year from statement header text"""
    # Look for patterns like "Statement Date: 01/15/2026" or "January 2026"
    year_patterns = [
        r'Statement\s+(?:Date|Period).*?(\d{4})',
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}.*?(\d{4})',
        r'\d{1,2}/\d{1,2}/(\d{4})',
        r'Opening/Closing Date\s+\d{2}/\d{2}/(\d{2})\s',
    ]
    for pattern in year_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            year_str = match.group(1)
            year = int(year_str)
            if year < 100:
                year += 2000
            if 2020 <= year <= 2030:
                return year

    return datetime.now().year


def _parse_chase_credit_card(text: str, year: int) -> List[Dict]:
    """
    Parse Chase credit card statement.
    Format typically: MM/DD  DESCRIPTION  AMOUNT
    """
    transactions = []
    lines = text.split('\n')

    # Chase CC transaction pattern: date (MM/DD), description, amount
    # Amount may have negative sign for credits/payments
    txn_pattern = re.compile(
        r'^(\d{2}/\d{2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})$'
    )

    # Also handle format with posting date: MM/DD MM/DD DESCRIPTION AMOUNT
    txn_pattern_dual_date = re.compile(
        r'^(\d{2}/\d{2})\s+\d{2}/\d{2}\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})$'
    )

    in_transaction_section = False

    for line in lines:
        line = line.strip()

        # Detect transaction sections
        if any(header in line.upper() for header in [
            'ACCOUNT ACTIVITY', 'TRANSACTION DETAIL', 'PURCHASES',
            'PAYMENTS AND OTHER CREDITS', 'PURCHASE', 'CHARGES'
        ]):
            in_transaction_section = True
            continue

        # Skip non-transaction sections
        if any(header in line.upper() for header in [
            'TOTALS', 'TOTAL FEES', 'INTEREST CHARGE',
            'ACCOUNT SUMMARY', 'PAYMENT INFORMATION'
        ]):
            in_transaction_section = False
            continue

        if not in_transaction_section:
            continue

        # Try dual-date pattern first (more specific)
        match = txn_pattern_dual_date.match(line)
        if not match:
            match = txn_pattern.match(line)

        if match:
            date_str = match.group(1)
            description = match.group(2).strip()
            amount_str = match.group(3).replace('$', '').replace(',', '')

            # Skip summary/total lines
            if any(skip in description.upper() for skip in [
                'TOTAL', 'BALANCE', 'MINIMUM', 'PAYMENT DUE', 'CREDIT LIMIT'
            ]):
                continue

            try:
                month, day = map(int, date_str.split('/'))
                txn_date = date(year, month, day)
            except (ValueError, TypeError):
                continue

            amount = float(amount_str)
            # Chase CC: positive = charge (expense), negative = payment/credit
            # Normalize: negative = expense, positive = income
            txn_type = "debit" if amount > 0 else "credit"
            amount = -abs(amount) if txn_type == "debit" else abs(amount)

            transactions.append({
                "date": txn_date.isoformat(),
                "description": description,
                "original_description": description,
                "amount": amount,
                "transaction_type": txn_type,
            })

    return transactions


def _parse_chase_checking(text: str, year: int) -> List[Dict]:
    """
    Parse Chase checking account statement.
    """
    transactions = []
    lines = text.split('\n')

    # Chase checking: MM/DD DESCRIPTION AMOUNT
    txn_pattern = re.compile(
        r'^(\d{2}/\d{2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})$'
    )

    in_transaction_section = False

    for line in lines:
        line = line.strip()

        if any(header in line.upper() for header in [
            'TRANSACTION DETAIL', 'CHECKING SUMMARY',
            'DEPOSITS AND ADDITIONS', 'ELECTRONIC WITHDRAWALS',
            'ATM & DEBIT CARD', 'CHECKS PAID', 'FEES'
        ]):
            in_transaction_section = True
            continue

        if any(header in line.upper() for header in [
            'DAILY ENDING BALANCE', 'SERVICE CHARGE SUMMARY',
            'ACCOUNT SUMMARY'
        ]):
            in_transaction_section = False
            continue

        if not in_transaction_section:
            continue

        match = txn_pattern.match(line)
        if match:
            date_str = match.group(1)
            description = match.group(2).strip()
            amount_str = match.group(3).replace('$', '').replace(',', '')

            if any(skip in description.upper() for skip in [
                'TOTAL', 'BALANCE', 'ENDING BALANCE'
            ]):
                continue

            try:
                month, day = map(int, date_str.split('/'))
                txn_date = date(year, month, day)
            except (ValueError, TypeError):
                continue

            amount = float(amount_str)
            # Negative = withdrawal, positive = deposit
            txn_type = "debit" if amount < 0 else "credit"

            transactions.append({
                "date": txn_date.isoformat(),
                "description": description,
                "original_description": description,
                "amount": amount,
                "transaction_type": txn_type,
            })

    return transactions


def _generate_hash(txn: Dict) -> str:
    """Generate SHA256 hash for deduplication"""
    raw = f"{txn['date']}|{txn['original_description']}|{txn['amount']}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def auto_categorize_transaction(
    description: str,
    db: AsyncSession
) -> Optional[int]:
    """
    Run auto-categorization rules against a transaction description.
    Returns category_id or None if no match.
    """
    result = await db.execute(
        select(BudgetCategoryRule)
        .where(BudgetCategoryRule.is_active == True)
        .order_by(BudgetCategoryRule.priority.desc())
    )
    rules = result.scalars().all()

    desc_upper = description.upper()

    for rule in rules:
        matched = False

        if rule.match_type == MatchType.CONTAINS:
            matched = rule.pattern.upper() in desc_upper
        elif rule.match_type == MatchType.STARTS_WITH:
            matched = desc_upper.startswith(rule.pattern.upper())
        elif rule.match_type == MatchType.REGEX:
            try:
                # Use re.search with a compiled pattern; limit description length to prevent ReDoS
                matched = bool(re.search(rule.pattern, description[:500], re.IGNORECASE))
            except (re.error, RecursionError):
                logger.warning(f"Invalid or pathological regex in rule {rule.id}")
                continue

        if matched:
            return rule.category_id

    return None


async def auto_categorize_transactions(
    transaction_ids: List[int],
    db: AsyncSession
) -> int:
    """
    Run auto-categorization on a list of uncategorized transactions.
    Returns count of categorized transactions.
    """
    from models.budget import BudgetTransaction

    result = await db.execute(
        select(BudgetTransaction)
        .where(
            BudgetTransaction.id.in_(transaction_ids),
            BudgetTransaction.category_id.is_(None)
        )
    )
    transactions = result.scalars().all()

    categorized = 0
    for txn in transactions:
        category_id = await auto_categorize_transaction(txn.description, db)
        if category_id:
            txn.category_id = category_id
            categorized += 1

    return categorized
