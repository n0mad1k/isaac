#!/usr/bin/env python3
"""Take additional screenshots for features not yet covered."""

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
    except Exception:
        pass
    return False


def snap(page, filename):
    """Take a full-page screenshot and report."""
    path = os.path.join(OUTPUT_DIR, filename)
    page.screenshot(path=path, full_page=True)
    size = os.path.getsize(path)
    print(f"  -> {filename} ({size:,} bytes)")


def main():
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

        # Login
        print("Logging in...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.fill('input[type="text"]', USERNAME)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/", timeout=10000)
        page.wait_for_timeout(2000)
        print("Logged in.")

        # 1. AI Chat - try clicking all fixed-position buttons to find the FAM
        print("\n--- AI Chat ---")
        try:
            # Debug: log all buttons on page
            buttons = page.locator('button').all()
            print(f"  Found {len(buttons)} buttons total")
            for i, btn in enumerate(buttons[-10:]):  # last 10 buttons
                try:
                    txt = btn.inner_text().strip()[:30]
                    cls = btn.get_attribute('class') or ''
                    vis = btn.is_visible()
                    print(f"  btn[{i}]: text='{txt}' visible={vis} class='{cls[:60]}'")
                except:
                    pass

            # Try to find the FAM toggle - it's usually a button with a menu/plus icon
            # Look for the bottom-right floating button
            fab_selectors = [
                'button[class*="fixed"][class*="bottom"]',
                'button[class*="fixed"][class*="right"]',
                '.fixed button',
                'button:has(svg)',  # buttons with icons
            ]

            for sel in fab_selectors:
                fabs = page.locator(sel).all()
                for fab in fabs:
                    try:
                        if fab.is_visible():
                            box = fab.bounding_box()
                            # FAM is in bottom-right corner
                            if box and box['x'] > 1000 and box['y'] > 600:
                                print(f"  Found FAM at x={box['x']}, y={box['y']}")
                                fab.click()
                                page.wait_for_timeout(1000)

                                # Now look for Isaac AI
                                ai_btn = page.locator('text=Isaac AI').first
                                if ai_btn.is_visible(timeout=2000):
                                    ai_btn.click()
                                    page.wait_for_timeout(2000)
                                    snap(page, "ai-chat.png")
                                    # Close chat panel
                                    page.keyboard.press('Escape')
                                    page.wait_for_timeout(500)
                                else:
                                    # Maybe it's not called "Isaac AI", list visible text
                                    visible = page.locator('button:visible').all()
                                    for v in visible:
                                        t = v.inner_text().strip()
                                        if t and ('ai' in t.lower() or 'chat' in t.lower() or 'isaac' in t.lower()):
                                            print(f"  Found chat button: '{t}'")
                                            v.click()
                                            page.wait_for_timeout(2000)
                                            snap(page, "ai-chat.png")
                                            break
                                break
                    except:
                        continue

        except Exception as e:
            print(f"  Chat screenshot failed: {e}")

        # 2. Worker Tasks page
        print("\n--- Worker Tasks ---")
        page.goto(f"{BASE_URL}/worker-tasks", wait_until="networkidle")
        page.wait_for_timeout(2000)
        snap(page, "worker-tasks.png")

        # 3. Team member dossier - need to find actual member names
        print("\n--- Team Member Dossier ---")
        page.goto(f"{BASE_URL}/team", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Debug: print all buttons/tabs on the team page
        buttons = page.locator('button').all()
        skip_words = {"Overview", "Gear", "Supplies", "AAR", "Add", "Settings",
                      "Logout", "Save", "Cancel", "Delete", "Edit", "Close",
                      "Submit", "Create", "Update", "Back", "Next", "Previous", ""}
        member_tab = None
        for btn in buttons:
            try:
                txt = btn.inner_text().strip()
                if txt and txt not in skip_words and len(txt) < 25 and btn.is_visible():
                    box = btn.bounding_box()
                    # Member tabs should be in the top tab area (y < 200)
                    if box and box['y'] < 200:
                        print(f"  Potential member tab: '{txt}' at y={box['y']}")
                        if not member_tab and txt not in skip_words:
                            member_tab = btn
            except:
                continue

        if member_tab:
            name = member_tab.inner_text().strip()
            print(f"  Clicking member: {name}")
            member_tab.click()
            page.wait_for_timeout(2000)
            snap(page, "team-dossier.png")

            # Now look for dossier sub-tabs
            for tab_name, filename in [
                ("Fitness", "team-fitness.png"),
                ("Growth", "team-growth.png"),
                ("Training", "team-training.png"),
                ("Medical", "team-medical.png"),
                ("Mentoring", "team-mentoring.png"),
                ("Observations", "team-observations.png"),
                ("Tasks", "team-member-tasks.png"),
            ]:
                if click_tab(page, tab_name):
                    snap(page, filename)
                else:
                    print(f"  Tab '{tab_name}' not found")
        else:
            print("  No member tab found - listing visible buttons:")
            for btn in buttons[:20]:
                try:
                    txt = btn.inner_text().strip()
                    if txt and btn.is_visible():
                        box = btn.bounding_box()
                        print(f"    '{txt}' at ({box['x']:.0f},{box['y']:.0f})")
                except:
                    pass

        # 4. Settings sub-sections we're missing
        print("\n--- Settings Sections ---")
        page.goto(f"{BASE_URL}/settings", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # List all settings section buttons
        settings_buttons = page.locator('button').all()
        for btn in settings_buttons:
            try:
                txt = btn.inner_text().strip()
                if btn.is_visible():
                    if 'AI' in txt or 'Calendar' in txt or 'Team' in txt:
                        print(f"  Settings button: '{txt}'")
            except:
                pass

        # Try clicking AI Configuration
        for ai_label in ["AI Configuration", "AI Assistant", "AI"]:
            if click_tab(page, ai_label, timeout=2000):
                snap(page, "settings-ai.png")
                print(f"  Clicked '{ai_label}'")
                break

        # Calendar Sync
        for cal_label in ["Calendar Sync", "Calendar"]:
            if click_tab(page, cal_label, timeout=2000):
                snap(page, "settings-calendar.png")
                print(f"  Clicked '{cal_label}'")
                break

        # Team settings
        for team_label in ["Team", "Team Settings"]:
            if click_tab(page, team_label, timeout=2000):
                snap(page, "settings-team.png")
                print(f"  Clicked '{team_label}'")
                break

        browser.close()
        print("\nDone!")


if __name__ == "__main__":
    main()
