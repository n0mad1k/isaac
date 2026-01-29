#!/usr/bin/env python3
"""
Plant Data Enrichment Script
Enriches plant data in the production database using PictureThis import service.
Only fills in empty/NULL fields - never overwrites existing data.
"""

import sqlite3
import asyncio
import sys
import os
import re
import html

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.plant_import import plant_import_service


# Map of plant ID -> PictureThis latin name override (for plants with non-standard names)
LATIN_NAME_OVERRIDES = {
    11: "Musa acuminata",          # Banana (Musa spp. -> specific species)
    12: "Bambusa malingensis",     # Seabreeze Bamboo
    13: "Bambusa oldhamii",        # Giant Timber Bamboo
    20: "Aloe vera",               # Aloe Vera (barbadensis miller -> vera)
    30: "Psidium guajava",         # Yellow Guava (same species as Pink)
    38: "Rubus niveus",            # Mysore Raspberry
    55: "Colocasia gigantea",      # Giant Elephant Ear (has HTML entities)
    56: "Alocasia macrorrhizos",   # Elephant Ear Portora
    62: "Plumeria rubra",          # Frangipani (has HTML entities)
    64: "Agave americana",         # Variegated American Aloe
}

# Plants to skip (already at 80%+ or have special cases)
SKIP_IDS = {
    16,  # Avocado - 100%
    46,  # Monstera - 100%
    53,  # Rubber Tree - 100%
    64,  # Variegated Aloe - 100%
    65,  # Scarlet-star - 93%
    66,  # Golden pothos - 100%
    67,  # Purple heart - 100%
    45,  # Duplicate Mother-in-Law's Tongue
}

# Fields to enrich (must match column names in plants table)
ENRICHABLE_FIELDS = [
    "description", "grow_zones", "sun_requirement", "moisture_preference",
    "soil_requirements", "uses", "cultivation_details", "known_hazards",
    "size_full_grown", "min_temp", "propagation_methods", "frost_sensitive",
    "drought_tolerant", "produces_months", "prune_months", "growth_rate",
    "references",
]


def clean_latin_name(name):
    """Clean latin name for PictureThis search."""
    if not name:
        return None
    # Decode HTML entities
    name = html.unescape(name)
    # Remove variety/cultivar markers
    name = re.sub(r"['\u2018\u2019].*?['\u2018\u2019]", "", name)
    # Remove "spp." and "var." suffixes
    name = re.sub(r"\s+(spp\.|var\.|subsp\.).*", "", name)
    # Remove × hybrid markers
    name = name.replace("×", "").replace("x ", "")
    # Clean up extra whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name


async def enrich_plant(plant_id, name, latin_name, db_path):
    """Enrich a single plant from PictureThis."""
    # Clean latin name
    search_name = LATIN_NAME_OVERRIDES.get(plant_id) or clean_latin_name(latin_name)
    if not search_name:
        print(f"  SKIP: No latin name for {name} (id={plant_id})")
        return 0

    # Convert latin name to PictureThis URL slug
    slug = search_name.replace(" ", "_")
    url = f"https://www.picturethisai.com/wiki/{slug}.html"

    try:
        data = await plant_import_service.import_from_url(url)
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg or "Not Found" in error_msg:
            # Try searching by name
            try:
                import httpx
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        "https://cms-fullsearch-service.picturethisai.com/api/v1/cmsfullsearch/cms_full_search",
                        params={"searchText": search_name, "languageCode": "0", "countryCode": "Other"},
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Accept": "application/json",
                            "Referer": "https://www.picturethisai.com/",
                        },
                    )
                    response.raise_for_status()
                    results = response.json().get("response", {}).get("indexModels", [])
                    if results:
                        first = results[0]
                        alt_slug = first["latinName"].replace(" ", "_").replace("'", "")
                        alt_url = f"https://www.picturethisai.com/wiki/{alt_slug}.html"
                        print(f"  Trying alternate: {first['latinName']}")
                        data = await plant_import_service.import_from_url(alt_url)
                    else:
                        print(f"  SKIP: No PictureThis results for {search_name}")
                        return 0
            except Exception as e2:
                print(f"  SKIP: Search failed for {search_name}: {e2}")
                return 0
        else:
            print(f"  ERROR: {e}")
            return 0

    if not data:
        print(f"  SKIP: No data returned for {name}")
        return 0

    # Connect to DB and update only empty fields
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Get current values
    cols = ", ".join(ENRICHABLE_FIELDS)
    c.execute(f"SELECT {cols} FROM plants WHERE id = ?", (plant_id,))
    current = c.fetchone()
    if not current:
        conn.close()
        return 0

    updates = {}
    for i, field in enumerate(ENRICHABLE_FIELDS):
        current_val = current[i]
        new_val = data.get(field)

        # Only fill empty fields
        if new_val is not None and (current_val is None or current_val == ""):
            # Handle enum fields that need string conversion
            if field in ("sun_requirement", "moisture_preference", "growth_rate"):
                updates[field] = str(new_val) if new_val else None
            elif field in ("frost_sensitive", "drought_tolerant"):
                updates[field] = 1 if new_val else 0
            elif field == "min_temp":
                try:
                    updates[field] = float(new_val)
                except (ValueError, TypeError):
                    pass
            else:
                updates[field] = str(new_val) if new_val is not None else None

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [plant_id]
        c.execute(f"UPDATE plants SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return len(updates)
    else:
        conn.close()
        return 0


async def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "/opt/levi/backend/data/levi.db"
    print(f"Database: {db_path}")
    print()

    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""SELECT id, name, latin_name FROM plants
                 WHERE is_active = 1 ORDER BY id""")
    plants = c.fetchall()
    conn.close()

    total_updated = 0
    total_fields = 0
    skipped = []

    for plant_id, name, latin_name in plants:
        if plant_id in SKIP_IDS:
            continue

        print(f"[{plant_id}] {name} ({latin_name or 'no latin name'})...")
        try:
            fields_updated = await enrich_plant(plant_id, name, latin_name, db_path)
            if fields_updated > 0:
                print(f"  Updated {fields_updated} fields")
                total_updated += 1
                total_fields += fields_updated
            else:
                skipped.append(f"{name} (id={plant_id})")
        except Exception as e:
            print(f"  ERROR: {e}")
            skipped.append(f"{name} (id={plant_id}) - {e}")

        # Small delay to avoid rate limiting
        await asyncio.sleep(1)

    print()
    print(f"=== RESULTS ===")
    print(f"Plants updated: {total_updated}")
    print(f"Total fields filled: {total_fields}")
    print(f"Skipped: {len(skipped)}")
    if skipped:
        print(f"Skipped plants:")
        for s in skipped:
            print(f"  - {s}")


if __name__ == "__main__":
    asyncio.run(main())
