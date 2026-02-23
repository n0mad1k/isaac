#!/usr/bin/env python3
"""Comprehensive screenshots of all Isaac app pages/tabs for GitHub wiki."""

import os
from playwright.sync_api import sync_playwright

BASE_URL = "https://192.168.1.68"
OUTPUT_DIR = "/home/n0mad1k/Tools/isaac.wiki/images"
USERNAME = "admin"
PASSWORD = "password"


def click_tab(page, text, timeout=1500):
    """Click a tab/button by visible text."""
    try:
        tab = page.locator(f"text='{text}'").first
        if tab.is_visible(timeout=2000):
            tab.click()
            page.wait_for_timeout(timeout)
            return True
    except Exception as e:
        print(f"  Warning: Could not click '{text}': {e}")
    return False


def snap(page, filename):
    """Take a full-page screenshot and report."""
    path = os.path.join(OUTPUT_DIR, filename)
    page.screenshot(path=path, full_page=True)
    size = os.path.getsize(path)
    print(f"  -> {filename} ({size:,} bytes)")


def nav(page, path, wait=2500):
    """Navigate to a page and wait for load."""
    page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    page.wait_for_timeout(wait)


def take_screenshots():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            ignore_https_errors=True,
        )
        page = context.new_page()

        # ── LOGIN PAGE ──
        print("\n=== Login ===")
        nav(page, "/login")
        snap(page, "login.png")

        # ── AUTHENTICATE ──
        print("\n=== Logging in... ===")
        page.fill('input[name="username"], input[type="text"]', USERNAME)
        page.fill('input[name="password"], input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)
        print("  Logged in.")

        # ── DASHBOARD ──
        print("\n=== Dashboard ===")
        nav(page, "/")
        snap(page, "dashboard.png")

        # ── TO DO ──
        print("\n=== To Do ===")
        nav(page, "/todo")
        snap(page, "todo-today.png")

        for tab_name, fname in [
            ("Upcoming", "todo-upcoming.png"),
            ("This Week", "todo-week.png"),
            ("This Month", "todo-month.png"),
            ("All", "todo-all.png"),
            ("Backlog", "todo-backlog.png"),
            ("Overdue", "todo-overdue.png"),
            ("Metrics", "todo-metrics.png"),
        ]:
            click_tab(page, tab_name)
            snap(page, fname)

        # ── CALENDAR ──
        print("\n=== Calendar ===")
        nav(page, "/calendar")
        snap(page, "calendar-week.png")

        click_tab(page, "Month")
        snap(page, "calendar-month.png")

        click_tab(page, "Day")
        snap(page, "calendar-day.png")

        # ── GARDEN ──
        print("\n=== Garden ===")
        nav(page, "/garden")
        snap(page, "garden-overview.png")

        for tab_name, fname in [
            ("Seeds", "garden-seeds.png"),
            ("Plants", "garden-plants.png"),
            ("Planner", "garden-planner.png"),
            ("Journal", "garden-journal.png"),
            ("Companions", "garden-companions.png"),
            ("Layout", "garden-layout.png"),
        ]:
            click_tab(page, tab_name)
            snap(page, fname)

        # ── ANIMALS ──
        print("\n=== Animals ===")
        nav(page, "/animals")
        snap(page, "animals-all.png")

        # Click Pets filter
        try:
            pets = page.locator("text=/Pets/").first
            if pets.is_visible(timeout=2000):
                pets.click()
                page.wait_for_timeout(1500)
                snap(page, "animals-pets.png")
        except Exception:
            pass

        # Click Livestock filter
        try:
            livestock = page.locator("text=/Livestock/").first
            if livestock.is_visible(timeout=2000):
                livestock.click()
                page.wait_for_timeout(1500)
                snap(page, "animals-livestock.png")
        except Exception:
            pass

        # ── TEAM ──
        print("\n=== Team ===")
        nav(page, "/team")
        snap(page, "team-overview.png")

        for tab_name, fname in [
            ("Gear", "team-gear.png"),
            ("Supply Requests", "team-supplies.png"),
            ("Weekly AAR", "team-aar.png"),
        ]:
            click_tab(page, tab_name)
            snap(page, fname)

        # ── BUDGET ──
        print("\n=== Budget ===")
        nav(page, "/budget")
        snap(page, "budget-overview.png")

        for tab_name, fname in [
            ("Transactions", "budget-transactions.png"),
            ("Monthly Budget", "budget-monthly.png"),
            ("Bills", "budget-bills.png"),
            ("Accounts", "budget-accounts.png"),
            ("Import", "budget-import.png"),
            ("Settings", "budget-settings.png"),
        ]:
            click_tab(page, tab_name)
            snap(page, fname)

        # ── FARM FINANCES ──
        print("\n=== Farm Finances ===")
        nav(page, "/farm-finances")
        snap(page, "finances-overview.png")

        click_tab(page, "Business")
        snap(page, "finances-business.png")

        click_tab(page, "Homestead")
        snap(page, "finances-homestead.png")

        # ── HOME MAINTENANCE ──
        print("\n=== Home Maintenance ===")
        nav(page, "/home-maintenance")
        snap(page, "home-maintenance.png")

        # ── VEHICLES ──
        print("\n=== Vehicles ===")
        nav(page, "/vehicles")
        snap(page, "vehicles.png")

        # ── EQUIPMENT ──
        print("\n=== Equipment ===")
        nav(page, "/equipment")
        snap(page, "equipment.png")

        # ── FARM AREAS ──
        print("\n=== Farm Areas ===")
        nav(page, "/farm-areas")
        snap(page, "farm-areas.png")

        # ── SETTINGS ──
        print("\n=== Settings ===")
        nav(page, "/settings")
        snap(page, "settings.png")

        # Expand and screenshot key settings sections
        settings_sections = [
            ("User Management", "settings-users.png"),
            ("Role Permissions", "settings-roles.png"),
            ("Location Settings", "settings-location.png"),
            ("Weather Integration", "settings-weather.png"),
            ("Email Server", "settings-email-server.png"),
            ("Email Notifications", "settings-email-notifications.png"),
            ("Alert Thresholds", "settings-alerts.png"),
            ("Calendar", "settings-calendar.png"),
            ("Display Settings", "settings-display.png"),
            ("Feature Toggles", "settings-features.png"),
            ("AI Configuration", "settings-ai.png"),
            ("Health Monitor", "settings-health.png"),
        ]

        for section_text, fname in settings_sections:
            try:
                header = page.locator(f"text='{section_text}'").first
                if header.is_visible(timeout=2000):
                    header.click()
                    page.wait_for_timeout(1000)
                    # Scroll section into view
                    header.scroll_into_view_if_needed()
                    page.wait_for_timeout(500)
                    snap(page, fname)
                    # Collapse it back
                    header.click()
                    page.wait_for_timeout(500)
            except Exception as e:
                print(f"  Warning: Could not expand '{section_text}': {e}")

        browser.close()

    # ── FINAL REPORT ──
    print("\n" + "=" * 60)
    print("SCREENSHOT SUMMARY")
    print("=" * 60)
    files = sorted(os.listdir(OUTPUT_DIR))
    total = 0
    for f in files:
        if f.endswith(".png"):
            size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
            status = "OK" if size > 10240 else "WARN (small)"
            print(f"  {f:45s} {size:>8,} bytes  {status}")
            total += 1
    print(f"\nTotal: {total} screenshots")


if __name__ == "__main__":
    take_screenshots()
