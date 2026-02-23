#!/usr/bin/env python3
"""Take growth chart and health data screenshots."""

import os
from playwright.sync_api import sync_playwright

BASE_URL = "https://192.168.1.68"
OUTPUT_DIR = "/home/n0mad1k/Tools/isaac.wiki/images"
USERNAME = "admin"
PASSWORD = "password"


def snap(page, filename):
    path = os.path.join(OUTPUT_DIR, filename)
    page.screenshot(path=path, full_page=True)
    size = os.path.getsize(path)
    print(f"  -> {filename} ({size:,} bytes)")


def click_tab(page, text, timeout=1500):
    try:
        tab = page.locator(f"text='{text}'").first
        if tab.is_visible(timeout=2000):
            tab.click()
            page.wait_for_timeout(timeout)
            return True
    except Exception:
        pass
    return False


def main():
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

        # Login
        print("Logging in...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.fill('input[type="text"]', USERNAME)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/", timeout=10000)
        page.wait_for_timeout(2000)

        # Go to team page
        page.goto(f"{BASE_URL}/team", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Click Lily (the child member)
        print("Clicking Lily tab...")
        lily = page.locator("button:has-text('Lily')").first
        if lily.is_visible(timeout=3000):
            lily.click()
            page.wait_for_timeout(2000)

            # Click Growth tab
            if click_tab(page, "Growth", timeout=2000):
                page.wait_for_timeout(1000)
                snap(page, "team-growth.png")
                print("  Growth tab captured!")
            else:
                print("  Growth tab not found, listing tabs...")
                buttons = page.locator("button").all()
                for btn in buttons:
                    try:
                        t = btn.inner_text().strip()
                        if t and btn.is_visible():
                            print(f"    tab: '{t}'")
                    except:
                        pass
        else:
            print("  Lily tab not found")

        # Also get Health Data from an adult member
        print("\nGetting Health Data from Emma...")
        emma = page.locator("button:has-text('Emma')").first
        if emma.is_visible(timeout=3000):
            emma.click()
            page.wait_for_timeout(2000)
            if click_tab(page, "Health Data", timeout=2000):
                snap(page, "team-health.png")
                print("  Health Data captured!")

        browser.close()
        print("\nDone!")


if __name__ == "__main__":
    main()
