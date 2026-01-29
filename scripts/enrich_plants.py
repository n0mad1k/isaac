#!/usr/bin/env python3
"""
Plant Data Enrichment Script
Enriches plant data in the production database using PictureThis import service.
Only fills in empty/NULL fields - never overwrites existing data.

Usage:
    python3 enrich_plants.py [db_path] [--dry-run] [--no-photos] [--plant-id=N]

    --dry-run    Show what would be updated without writing to DB
    --no-photos  Skip photo downloads
    --plant-id=N Only process a single plant by ID (for testing)
"""

import sqlite3
import asyncio
import sys
import os
import re
import html
import uuid
import shutil
from datetime import datetime

import httpx

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.plant_import import plant_import_service


# Map of plant ID -> PictureThis latin name override (for plants with non-standard names)
LATIN_NAME_OVERRIDES = {
    2: "Citrus limon",              # Meyer Lemon (Citrus × meyeri -> Citrus limon)
    3: "Citrus sinensis",           # Orange (search returns cultivar, use base species)
    5: "Rubus fruticosus",          # Blackberry (search returns cultivar)
    11: "Musa acuminata",           # Banana (Musa spp. -> specific species)
    12: "Bambusa textilis",         # Seabreeze Bamboo (malingensis not in PT, textilis similar)
    13: "Bambusa oldhamii",         # Giant Timber Bamboo
    20: "Aloe vera",                # Aloe Vera (barbadensis miller -> vera)
    21: "Coleus amboinicus",        # Cuban Oregano (Plectranthus -> Coleus)
    30: "Psidium guajava",          # Yellow Guava (same species as Pink)
    31: "Eriobotrya japonica",      # Loquat (direct URL works)
    34: "Citrus maxima",            # Pomelo (search returns nothing, try direct)
    38: "Rubus niveus",             # Mysore Raspberry
    54: "Strelitzia nicolai",       # White Bird of Paradise (alba -> nicolai)
    55: "Colocasia gigantea",       # Giant Elephant Ear (has HTML entities)
    56: "Alocasia macrorrhizos",    # Elephant Ear Portora
    62: "Plumeria rubra",           # Frangipani (has HTML entities)
    64: "Agave americana",          # Variegated American Aloe
}

# Plants to skip (already at 80%+ or have special cases)
SKIP_IDS = {
    45,  # Duplicate Mother-in-Law's Tongue
}

# Fields to enrich (must match column names in plants table)
ENRICHABLE_FIELDS = [
    "description", "grow_zones", "sun_requirement", "moisture_preference",
    "soil_requirements", "uses", "cultivation_details", "known_hazards",
    "size_full_grown", "min_temp", "propagation_methods", "frost_sensitive",
    "drought_tolerant", "produces_months", "prune_months", "growth_rate",
    "references",
    # New fields from #253
    "water_schedule", "fertilize_schedule", "prune_frequency",
    "harvest_frequency", "how_to_harvest",
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


def backup_database(db_path):
    """Create a timestamped backup of the database before making changes."""
    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"
    print(f"Creating backup: {backup_path}")
    shutil.copy2(db_path, backup_path)

    # Verify backup
    backup_size = os.path.getsize(backup_path)
    orig_size = os.path.getsize(db_path)
    if backup_size != orig_size:
        print(f"ERROR: Backup size mismatch! Original: {orig_size}, Backup: {backup_size}")
        sys.exit(1)

    print(f"Backup verified ({backup_size:,} bytes)")
    return backup_path


async def download_photo(image_url, plant_id, photo_dir):
    """Download a plant photo and return the saved filename."""
    if not image_url:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(image_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            })
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if "jpeg" in content_type or "jpg" in content_type:
                ext = "jpg"
            elif "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            elif "gif" in content_type:
                ext = "gif"
            else:
                # Try to get extension from URL
                url_path = image_url.split("?")[0]
                if url_path.endswith(".png"):
                    ext = "png"
                elif url_path.endswith(".webp"):
                    ext = "webp"
                else:
                    ext = "jpg"  # Default

            # Validate it's actually image data (check first bytes)
            content = response.content
            if len(content) < 100:
                print(f"    Photo too small ({len(content)} bytes), skipping")
                return None

            os.makedirs(photo_dir, exist_ok=True)
            filename = f"{plant_id}_{uuid.uuid4().hex[:8]}.{ext}"
            filepath = os.path.join(photo_dir, filename)

            with open(filepath, "wb") as f:
                f.write(content)

            print(f"    Photo saved: {filename} ({len(content):,} bytes)")
            return os.path.join("data", "plant_photos", filename)

    except Exception as e:
        print(f"    Photo download failed: {e}")
        return None


async def enrich_plant(plant_id, name, latin_name, db_path, dry_run=False, download_photos=True):
    """Enrich a single plant from PictureThis. Returns (fields_updated, photo_saved)."""
    # Clean latin name
    search_name = LATIN_NAME_OVERRIDES.get(plant_id) or clean_latin_name(latin_name)
    if not search_name:
        print(f"  SKIP: No latin name for {name} (id={plant_id})")
        return 0, False

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
                        return 0, False
            except Exception as e2:
                print(f"  SKIP: Search failed for {search_name}: {e2}")
                return 0, False
        else:
            print(f"  ERROR: {e}")
            return 0, False

    if not data:
        print(f"  SKIP: No data returned for {name}")
        return 0, False

    # Connect to DB and update only empty fields
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")  # Safe for concurrent access
    c = conn.cursor()

    # Get current values (quote column names to handle SQL reserved words like 'references')
    all_fields = ENRICHABLE_FIELDS + ["photo_path"]
    cols = ", ".join(f'"{f}"' for f in all_fields)
    c.execute(f"SELECT {cols} FROM plants WHERE id = ?", (plant_id,))
    current = c.fetchone()
    if not current:
        conn.close()
        return 0, False

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

    # Handle photo download separately
    photo_saved = False
    current_photo = current[len(ENRICHABLE_FIELDS)]  # photo_path is last in all_fields
    image_url = data.get("image_url")

    if download_photos and image_url and (current_photo is None or current_photo == ""):
        if dry_run:
            print(f"  [DRY RUN] Would download photo from: {image_url[:80]}...")
        else:
            # Determine photo directory relative to database location
            db_dir = os.path.dirname(db_path)
            photo_dir = os.path.join(db_dir, "plant_photos")
            photo_path = await download_photo(image_url, plant_id, photo_dir)
            if photo_path:
                updates["photo_path"] = photo_path
                photo_saved = True

    if updates:
        if dry_run:
            for k, v in updates.items():
                val_preview = str(v)[:60] if v else "None"
                print(f"  [DRY RUN] Would set {k} = {val_preview}")
            conn.close()
            return len(updates), photo_saved

        set_clause = ", ".join(f'"{k}" = ?' for k in updates.keys())
        values = list(updates.values()) + [plant_id]
        try:
            c.execute(f"UPDATE plants SET {set_clause} WHERE id = ?", values)
            conn.commit()
        except Exception as e:
            print(f"  DB ERROR for plant {plant_id}: {e}")
            conn.rollback()
            conn.close()
            return 0, False

        conn.close()
        return len(updates), photo_saved
    else:
        conn.close()
        return 0, False


async def main():
    # Parse arguments
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    no_photos = "--no-photos" in args
    single_plant_id = None
    db_path = None

    for arg in args:
        if arg.startswith("--plant-id="):
            single_plant_id = int(arg.split("=")[1])
        elif not arg.startswith("--"):
            db_path = arg

    if not db_path:
        db_path = "/opt/levi/backend/data/levi.db"

    print(f"Database: {db_path}")
    if dry_run:
        print("MODE: DRY RUN (no changes will be made)")
    if no_photos:
        print("MODE: Skipping photo downloads")
    if single_plant_id:
        print(f"MODE: Single plant ID={single_plant_id}")
    print()

    # Backup database (skip for dry run)
    if not dry_run:
        backup_path = backup_database(db_path)
        print()

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    if single_plant_id:
        c.execute("SELECT id, name, latin_name FROM plants WHERE id = ?", (single_plant_id,))
    else:
        c.execute("""SELECT id, name, latin_name FROM plants
                     WHERE is_active = 1 ORDER BY id""")

    plants = c.fetchall()
    conn.close()

    total_updated = 0
    total_fields = 0
    total_photos = 0
    skipped = []
    errors = []

    for plant_id, name, latin_name in plants:
        if plant_id in SKIP_IDS and not single_plant_id:
            continue

        print(f"[{plant_id}] {name} ({latin_name or 'no latin name'})...")
        try:
            fields_updated, photo_saved = await enrich_plant(
                plant_id, name, latin_name, db_path,
                dry_run=dry_run, download_photos=not no_photos
            )
            if fields_updated > 0:
                print(f"  Updated {fields_updated} fields" + (" (+ photo)" if photo_saved else ""))
                total_updated += 1
                total_fields += fields_updated
                if photo_saved:
                    total_photos += 1
            else:
                skipped.append(f"{name} (id={plant_id})")
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append(f"{name} (id={plant_id}) - {e}")

        # Small delay to avoid rate limiting
        await asyncio.sleep(1.5)

    print()
    print(f"=== RESULTS ===")
    if dry_run:
        print("(DRY RUN - no changes were made)")
    print(f"Plants updated: {total_updated}")
    print(f"Total fields filled: {total_fields}")
    print(f"Photos downloaded: {total_photos}")
    print(f"Skipped (no new data): {len(skipped)}")
    print(f"Errors: {len(errors)}")
    if errors:
        print(f"Error details:")
        for e in errors:
            print(f"  - {e}")
    if not dry_run:
        print(f"\nBackup at: {backup_path}")
        print("If anything looks wrong, restore with:")
        print(f"  cp {backup_path} {db_path}")


if __name__ == "__main__":
    asyncio.run(main())
