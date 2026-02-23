#!/usr/bin/env python3
"""
Enrich demo VM plants with data from PictureThis.
Searches each plant by name, fetches data, updates existing records.
"""
import asyncio
import sys
import os
import time
import uuid
import httpx

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.plant_import import plant_import_service
from models.plants import Plant, GrowthRate, SunRequirement, MoisturePreference
from models.database import async_session
from sqlalchemy import select

PLANT_PHOTO_DIR = "data/plant_photos"

SEARCH_URL = "https://cms-fullsearch-service.picturethisai.com/api/v1/cmsfullsearch/cms_full_search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://www.picturethisai.com/",
}


async def search_picturethis(client, name):
    """Search PictureThis for a plant name, return wiki URL and image URL."""
    try:
        response = await client.get(
            SEARCH_URL,
            params={"searchText": name, "languageCode": "0", "countryCode": "Other"},
            headers=HEADERS,
        )
        response.raise_for_status()
        data = response.json()
        index_models = data.get("response", {}).get("indexModels", [])
        if index_models:
            item = index_models[0]
            latin_name = item.get("latinName", "")
            slug = latin_name.replace(" ", "_").replace("'", "")
            return {
                "url": f"https://www.picturethisai.com/wiki/{slug}.html",
                "latin_name": latin_name,
                "common_name": (item.get("commonNames") or [latin_name])[0],
                "image_url": item.get("mainImageUrl", ""),
            }
    except Exception as e:
        print(f"    Search failed: {e}")
    return None


async def download_image(client, image_url, plant_id):
    """Download plant image and return local path."""
    try:
        response = await client.get(image_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("image/"):
            ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
            ext = ext_map.get(content_type.split(";")[0].strip(), "jpg")
            os.makedirs(PLANT_PHOTO_DIR, exist_ok=True)
            filename = f"{plant_id}_{uuid.uuid4().hex[:8]}.{ext}"
            filepath = os.path.join(PLANT_PHOTO_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(response.content)
            return filepath
    except Exception as e:
        print(f"    Image download failed: {e}")
    return None


def map_enums(data):
    """Map string values to SQLAlchemy enums."""
    growth_rate = GrowthRate.MODERATE
    if "growth_rate" in data:
        rate_map = {"slow": GrowthRate.SLOW, "moderate": GrowthRate.MODERATE,
                    "fast": GrowthRate.FAST, "very_fast": GrowthRate.VERY_FAST}
        growth_rate = rate_map.get(data["growth_rate"], GrowthRate.MODERATE)

    sun_requirement = SunRequirement.FULL_SUN
    if "sun_requirement" in data:
        sun_map = {"full_sun": SunRequirement.FULL_SUN, "partial_sun": SunRequirement.PARTIAL_SUN,
                   "partial_shade": SunRequirement.PARTIAL_SHADE, "full_shade": SunRequirement.FULL_SHADE}
        sun_requirement = sun_map.get(data["sun_requirement"], SunRequirement.FULL_SUN)

    moisture_preference = None
    if "moisture_preference" in data:
        moisture_map = {"dry": MoisturePreference.DRY, "dry_moist": MoisturePreference.DRY_MOIST,
                        "moist": MoisturePreference.MOIST, "moist_wet": MoisturePreference.MOIST_WET,
                        "wet": MoisturePreference.WET}
        moisture_preference = moisture_map.get(data["moisture_preference"])

    return growth_rate, sun_requirement, moisture_preference


async def enrich_plant(plant, data, image_path, wiki_url):
    """Update a plant record with imported data, only filling empty fields."""
    growth_rate, sun_requirement, moisture_preference = map_enums(data)

    # Map of data keys to plant attributes
    field_map = {
        "latin_name": "latin_name",
        "variety": "variety",
        "description": "description",
        "grow_zones": "grow_zones",
        "soil_requirements": "soil_requirements",
        "size_full_grown": "size_full_grown",
        "min_temp": "min_temp",
        "frost_sensitive": "frost_sensitive",
        "drought_tolerant": "drought_tolerant",
        "salt_tolerant": "salt_tolerant",
        "plant_spacing": "plant_spacing",
        "water_schedule": "water_schedule",
        "fertilize_schedule": "fertilize_schedule",
        "prune_frequency": "prune_frequency",
        "prune_months": "prune_months",
        "produces_months": "produces_months",
        "harvest_frequency": "harvest_frequency",
        "how_to_harvest": "how_to_harvest",
        "uses": "uses",
        "known_hazards": "known_hazards",
        "propagation_methods": "propagation_methods",
        "cultivation_details": "cultivation_details",
        "references": "references",
    }

    updated_fields = []
    for data_key, plant_attr in field_map.items():
        if data.get(data_key) and not getattr(plant, plant_attr, None):
            setattr(plant, plant_attr, data[data_key])
            updated_fields.append(plant_attr)

    # Always update enums if we got data
    if "sun_requirement" in data:
        plant.sun_requirement = sun_requirement
        updated_fields.append("sun_requirement")
    if "growth_rate" in data:
        plant.growth_rate = growth_rate
        updated_fields.append("growth_rate")
    if moisture_preference:
        plant.moisture_preference = moisture_preference
        updated_fields.append("moisture_preference")

    # Update photo if we downloaded one
    if image_path:
        # Remove old placeholder photo if it exists
        if plant.photo_path and os.path.exists(plant.photo_path):
            try:
                os.remove(plant.photo_path)
            except:
                pass
        plant.photo_path = image_path
        updated_fields.append("photo_path")

    # Add source to notes
    source_note = f"Source: {wiki_url}"
    if plant.notes:
        if "Source:" not in plant.notes:
            plant.notes = f"{plant.notes}\n{source_note}"
    else:
        plant.notes = source_note
    updated_fields.append("notes")

    return updated_fields


async def main():
    # Change to backend directory for proper path resolution
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')
    os.chdir(backend_dir)

    print("=" * 60)
    print("  Plant Data Enrichment from PictureThis")
    print("=" * 60)

    # Get all plants
    async with async_session() as db:
        result = await db.execute(select(Plant).order_by(Plant.id))
        plants = result.scalars().all()
        print(f"\nFound {len(plants)} plants to enrich\n")

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            success = 0
            failed = 0

            for plant in plants:
                print(f"[{plant.id:2d}/{len(plants)}] {plant.name}...")

                # Search PictureThis
                search_result = await search_picturethis(client, plant.name)
                if not search_result:
                    print(f"    SKIP - No search results")
                    failed += 1
                    await asyncio.sleep(1)
                    continue

                wiki_url = search_result["url"]
                print(f"    Found: {search_result['latin_name']} -> {wiki_url}")

                # Fetch detailed data
                try:
                    data = await plant_import_service.import_from_url(wiki_url)
                except Exception as e:
                    print(f"    SKIP - Import failed: {e}")
                    failed += 1
                    await asyncio.sleep(2)
                    continue

                # Download image
                image_url = data.get("image_url") or search_result.get("image_url")
                image_path = None
                if image_url:
                    image_path = await download_image(client, image_url, plant.id)
                    if image_path:
                        print(f"    Photo: {os.path.basename(image_path)}")

                # Update plant
                updated = await enrich_plant(plant, data, image_path, wiki_url)
                await db.commit()

                print(f"    Updated {len(updated)} fields: {', '.join(updated[:5])}{'...' if len(updated) > 5 else ''}")
                success += 1

                # Rate limit - be gentle
                await asyncio.sleep(2)

    print(f"\n{'=' * 60}")
    print(f"  Done! {success} enriched, {failed} failed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
