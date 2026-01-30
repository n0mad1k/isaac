#!/usr/bin/env python3
"""
One-time migration script to:
1. Add Chase Trust account
2. Add Ambulance and Upper Endo payment plans
3. Set account_id on all existing categories
Run against dev or prod database directly.
Usage: python3 scripts/migrate_budget_accounts.py <db_path>
Example: python3 scripts/migrate_budget_accounts.py /opt/isaac/backend/data/levi.db
"""
import sqlite3
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 migrate_budget_accounts.py <db_path>")
        sys.exit(1)

    db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Step 1: Get existing accounts
    cur.execute("SELECT id, name FROM budget_accounts ORDER BY id")
    accounts = {row['name']: row['id'] for row in cur.fetchall()}
    print(f"Existing accounts: {accounts}")

    # Step 2: Add Chase Trust account if not exists
    if 'Chase Trust' not in accounts:
        now = __import__('datetime').datetime.now().isoformat()
        cur.execute(
            "INSERT INTO budget_accounts (name, account_type, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
            ('Chase Trust', 'CHECKING', 1, 10, now)
        )
        accounts['Chase Trust'] = cur.lastrowid
        print(f"Added Chase Trust account (id={accounts['Chase Trust']})")
    else:
        print("Chase Trust account already exists")

    # Build account lookup
    money_market_id = None
    checking_id = None
    dane_id = None
    kelly_id = None
    house_id = None
    chase_id = accounts.get('Chase Trust')

    for name, aid in accounts.items():
        nl = name.lower()
        if 'money market' in nl:
            money_market_id = aid
        elif 'main checking' in nl or ('checking' in nl and 'chase' not in nl and 'dane' not in nl and 'kelly' not in nl):
            checking_id = aid
        elif 'dane' in nl:
            dane_id = aid
        elif 'kelly' in nl:
            kelly_id = aid
        elif 'house' in nl or 'travel' in nl:
            house_id = aid

    print(f"Account IDs: MM={money_market_id}, Check={checking_id}, Dane={dane_id}, Kelly={kelly_id}, House={house_id}, Chase={chase_id}")

    # Step 3: Add Ambulance and Upper Endo if not exists
    cur.execute("SELECT id, name FROM budget_categories WHERE name IN ('Ambulance', 'Upper Endo')")
    existing = {row['name']: row['id'] for row in cur.fetchall()}

    now = __import__('datetime').datetime.now().isoformat()

    if 'Ambulance' not in existing:
        cur.execute(
            """INSERT INTO budget_categories
            (name, category_type, budget_amount, monthly_budget, is_active, bill_day, account_id, sort_order, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ('Ambulance', 'FIXED', 0, 59.83, 1, 7, money_market_id, 0, '#6B7280', now)
        )
        print("Added Ambulance payment plan ($59.83, 7th)")
    else:
        print("Ambulance already exists")

    if 'Upper Endo' not in existing:
        cur.execute(
            """INSERT INTO budget_categories
            (name, category_type, budget_amount, monthly_budget, is_active, bill_day, account_id, sort_order, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ('Upper Endo', 'FIXED', 0, 133.68, 1, 23, money_market_id, 0, '#6B7280', now)
        )
        print("Added Upper Endo payment plan ($133.68, 23rd)")
    else:
        print("Upper Endo already exists")

    # Step 4: Set account_id on all existing categories based on name mapping
    # Money Market bills
    mm_bills = [
        'Electric', 'Motorcycle Ins', 'Dog Food', 'Horse Feed', 'Groceries', 'Gas',
        'Savings', 'Mortgage', 'ChatGPT', 'AC Payment', 'Motorcycle', 'Mitsubishi',
        'Upper Endo', 'Ambulance', 'Dane Spending', 'Kelly Spending'
    ]
    # Main Checking bills
    ck_bills = [
        'Main Spending', 'Maid', 'Chase Acct', 'Car Insurance', 'Greeting Island',
        'Lulu Lemon', 'Starlink', 'Lawn Mowing', 'T-Mobile', 'Spotify'
    ]
    # Dane's Spending bills
    dane_bills = [
        'Claude.AI', 'Klarna', 'Cloaked', 'Greyman', 'Protonmail', 'US Mobile', 'BK'
    ]
    # Kelly's Spending bills
    kelly_bills = ['Massage']
    # House/Travel Fund transfers
    house_transfers = ['House/Travel Fund', 'House/Travel']

    def set_account(names, account_id, label):
        if not account_id:
            print(f"  SKIP {label}: no account_id found")
            return
        for name in names:
            cur.execute(
                "UPDATE budget_categories SET account_id = ? WHERE name = ? AND (account_id IS NULL OR account_id != ?)",
                (account_id, name, account_id)
            )
            if cur.rowcount > 0:
                print(f"  Set {name} -> {label} (id={account_id})")

    print("\nSetting account_id on categories:")
    set_account(mm_bills, money_market_id, 'Money Market')
    set_account(ck_bills, checking_id, 'Main Checking')
    set_account(dane_bills, dane_id, "Dane's Spending")
    set_account(kelly_bills, kelly_id, "Kelly's Spending")
    set_account(house_transfers, house_id, 'House/Travel Fund')

    # Also set account_id on transfer categories for distributions
    # Move to Checking -> destination is checking
    cur.execute(
        "UPDATE budget_categories SET account_id = ? WHERE category_type = 'transfer' AND LOWER(name) LIKE '%checking%' AND (account_id IS NULL OR account_id != ?)",
        (checking_id, checking_id)
    )
    if cur.rowcount > 0:
        print(f"  Set Checking transfer -> Main Checking (id={checking_id})")

    # Move to Dane -> destination is Dane's account
    cur.execute(
        "UPDATE budget_categories SET account_id = ? WHERE category_type = 'transfer' AND LOWER(name) LIKE '%dane%' AND (account_id IS NULL OR account_id != ?)",
        (dane_id, dane_id)
    )
    if cur.rowcount > 0:
        print(f"  Set Dane transfer -> Dane's Spending (id={dane_id})")

    # Move to Kelly -> destination is Kelly's account
    cur.execute(
        "UPDATE budget_categories SET account_id = ? WHERE category_type = 'transfer' AND LOWER(name) LIKE '%kelly%' AND (account_id IS NULL OR account_id != ?)",
        (kelly_id, kelly_id)
    )
    if cur.rowcount > 0:
        print(f"  Set Kelly transfer -> Kelly's Spending (id={kelly_id})")

    # House/Travel transfer
    cur.execute(
        "UPDATE budget_categories SET account_id = ? WHERE category_type = 'transfer' AND (LOWER(name) LIKE '%house%' OR LOWER(name) LIKE '%travel%') AND (account_id IS NULL OR account_id != ?)",
        (house_id, house_id)
    )
    if cur.rowcount > 0:
        print(f"  Set House/Travel transfer -> House/Travel Fund (id={house_id})")

    conn.commit()
    print("\nMigration complete!")

    # Verify
    cur.execute("SELECT name, category_type, account_id, monthly_budget, bill_day FROM budget_categories WHERE is_active = 1 ORDER BY name")
    print("\nAll active categories:")
    for row in cur.fetchall():
        acct = row['account_id'] or 'NULL'
        print(f"  {row['name']:25s} type={row['category_type']:10s} acct={acct} monthly={row['monthly_budget']} day={row['bill_day']}")

    conn.close()

if __name__ == '__main__':
    main()
