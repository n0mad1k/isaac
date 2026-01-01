"""
Migrate seeds from plants table to dedicated seeds table
"""
import asyncio
import sys
sys.path.insert(0, '/opt/levi/backend')

from sqlalchemy import select, delete
from models.database import async_session, init_db
from models.plants import Plant
from models.seeds import Seed, SeedCategory, SunRequirement, WaterRequirement

# Seed catalog with comprehensive data
SEEDS = [
    # Medicinal Herbs
    {"name": "Arnica", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Topical use for bruises and muscle pain"},
    {"name": "Licorice", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Root used for digestive and respiratory support"},
    {"name": "Burdock", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "medicinal_notes": "Root for detox and skin health"},
    {"name": "English Lavender", "category": SeedCategory.HERB, "medicinal_use": True, "ornamental_use": True, "attracts_pollinators": True, "medicinal_notes": "Calming, sleep support"},
    {"name": "Peppermint", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Digestive aid, headache relief"},
    {"name": "Marshmallow", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Root for soothing mucous membranes"},
    {"name": "German Chamomile", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Calming tea, digestive support"},
    {"name": "White Yarrow", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "attracts_pollinators": True, "medicinal_notes": "Wound healing, fever reduction"},
    {"name": "Thyme", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Antimicrobial, respiratory support"},
    {"name": "Anise Hyssop", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "attracts_pollinators": True, "medicinal_notes": "Licorice-flavored, cough remedy"},
    {"name": "Calendula", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "ornamental_use": True, "medicinal_notes": "Skin healing, anti-inflammatory"},
    {"name": "Blue Skullcap", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Nervine, anxiety and tension relief"},
    {"name": "Catnip", "category": SeedCategory.HERB, "medicinal_use": True, "is_perennial": True, "medicinal_notes": "Mild sedative, cat attractant"},
    {"name": "Siberian Meadowsweet", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Contains natural salicylates, pain relief"},
    {"name": "St. John's Wort", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "medicinal_notes": "Mood support, nerve pain"},
    {"name": "True Dandelion", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Liver support, digestive bitter"},
    {"name": "Common Mullein", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Respiratory support, ear oil"},
    {"name": "Holy Basil", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "medicinal_notes": "Tulsi - adaptogenic, stress relief"},
    {"name": "Angelica", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Digestive support, respiratory"},
    {"name": "Stinging Nettle", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Nutrient-rich, allergy support, joint health"},
    {"name": "Valerian", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "medicinal_notes": "Sleep aid, relaxation"},
    {"name": "Rosemary", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Memory, circulation, antioxidant"},
    {"name": "Echinacea Purple Coneflower", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "attracts_pollinators": True, "medicinal_notes": "Immune support"},
    {"name": "Broadleaf Sage", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Sore throat, memory"},
    {"name": "Blue Vervain", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "medicinal_notes": "Nervine, tension relief"},
    {"name": "Florence Fennel", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "medicinal_notes": "Digestive aid, bloating relief"},
    {"name": "Ashwagandha", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Adaptogenic root, stress and energy"},
    {"name": "Red Clover", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "attracts_pollinators": True, "medicinal_notes": "Blood purifier, hormone support"},
    {"name": "Milk Thistle", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "medicinal_notes": "Liver protection and support"},
    {"name": "Lemon Mint Bee Balm", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "attracts_pollinators": True, "is_perennial": True, "medicinal_notes": "Tea herb, digestive"},
    {"name": "Feverfew", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "is_perennial": True, "medicinal_notes": "Migraine prevention"},
    {"name": "Red Raspberry", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Leaf tea for women's health"},
    {"name": "Lemon Balm", "category": SeedCategory.HERB, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "medicinal_notes": "Calming, antiviral, cold sores"},
    {"name": "Stevia", "category": SeedCategory.HERB, "culinary_use": True, "notes": "Natural zero-calorie sweetener"},
    {"name": "Fenugreek", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "medicinal_notes": "Blood sugar support, lactation"},
    {"name": "Butterfly Weed", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "attracts_pollinators": True, "is_perennial": True, "notes": "Milkweed for monarch butterflies", "drought_tolerant": True},

    # Flowers
    {"name": "Tall Mix Bachelor's Button", "category": SeedCategory.FLOWER, "ornamental_use": True, "attracts_pollinators": True, "notes": "Cornflower mix, easy to grow"},

    # Florida Native & Adapted
    {"name": "Florida Grove Pepper", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Florida-adapted pepper variety"},
    {"name": "Florida Velvet Bean", "category": SeedCategory.VEGETABLE, "heat_tolerant": True, "notes": "Florida native legume, nitrogen fixer"},
    {"name": "Florida Red Everglade Tomato", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Cherry tomato, extremely heat tolerant"},
    {"name": "Yellow Everglade Tomato", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Yellow cherry, heat tolerant"},
    {"name": "Florida Market Eggplant", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Florida-adapted eggplant"},
    {"name": "Florida Broadleaf Mustard", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Florida-adapted mustard greens"},
    {"name": "Florida Calamint", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "medicinal_use": True, "attracts_pollinators": True, "is_perennial": True, "drought_tolerant": True, "notes": "Native Florida mint, bee favorite"},
    {"name": "Florida Mountain Mint", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "medicinal_use": True, "attracts_pollinators": True, "is_perennial": True, "drought_tolerant": True, "notes": "Native pollinator magnet"},
    {"name": "Florida Horse Mint", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "medicinal_use": True, "attracts_pollinators": True, "is_perennial": True, "drought_tolerant": True, "notes": "Native aromatic herb"},
    {"name": "Beautyberry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "is_perennial": True, "ornamental_use": True, "notes": "Native shrub with purple berries"},
    {"name": "Deer Berry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "culinary_use": True, "is_perennial": True, "notes": "Native berry shrub"},
    {"name": "Sand Blackberry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "culinary_use": True, "is_perennial": True, "drought_tolerant": True, "notes": "Native Florida blackberry"},
    {"name": "Serviceberry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "culinary_use": True, "is_perennial": True, "notes": "Native berry shrub, early bloomer"},
    {"name": "Shiny Blueberry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "culinary_use": True, "is_perennial": True, "notes": "Native Florida blueberry"},
    {"name": "Sparkleberry", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "culinary_use": True, "is_perennial": True, "notes": "Native berry, wildlife food"},
    {"name": "Lyreleaf Sage", "category": SeedCategory.NATIVE_FLORIDA, "is_native": True, "attracts_pollinators": True, "is_perennial": True, "drought_tolerant": True, "notes": "Native sage, blue flowers"},

    # Tropical/Caribbean
    {"name": "Candlestick Senna", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "ornamental_use": True, "heat_tolerant": True, "notes": "Tropical medicinal, yellow flowers"},
    {"name": "Longevity Spinach", "category": SeedCategory.VEGETABLE, "medicinal_use": True, "culinary_use": True, "is_perennial": True, "heat_tolerant": True, "notes": "Perennial tropical green, very nutritious"},
    {"name": "Jack Bean", "category": SeedCategory.VEGETABLE, "heat_tolerant": True, "notes": "Tropical legume, nitrogen fixer"},
    {"name": "Seminole Pumpkin", "category": SeedCategory.VEGETABLE, "culinary_use": True, "is_native": True, "heat_tolerant": True, "drought_tolerant": True, "notes": "Florida native squash, stores well"},
    {"name": "Giant Amaranth", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Grain and edible greens"},
    {"name": "Moringa", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "culinary_use": True, "heat_tolerant": True, "medicinal_notes": "Superfood tree, highly nutritious leaves"},
    {"name": "Speckled Southern Pea", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Southern cowpea variety"},
    {"name": "Blue Butterfly Pea", "category": SeedCategory.FLOWER, "medicinal_use": True, "culinary_use": True, "ornamental_use": True, "heat_tolerant": True, "notes": "Edible blue flower for tea"},
    {"name": "Toothache Plant", "category": SeedCategory.MEDICINAL, "medicinal_use": True, "heat_tolerant": True, "medicinal_notes": "Spilanthes - numbing for dental pain"},
    {"name": "Pigeon Pea", "category": SeedCategory.VEGETABLE, "culinary_use": True, "is_perennial": True, "heat_tolerant": True, "drought_tolerant": True, "notes": "Tropical perennial legume"},
    {"name": "Caribbean Callaloo", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Tropical amaranth greens"},
    {"name": "Loofah Gourd", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Edible young, sponge when mature"},
    {"name": "Purple Passion Flower", "category": SeedCategory.VINE, "medicinal_use": True, "is_native": True, "ornamental_use": True, "is_perennial": True, "attracts_pollinators": True, "medicinal_notes": "Native vine, calming nervine"},
    {"name": "Puerto Rican Black Cowpea", "category": SeedCategory.VEGETABLE, "culinary_use": True, "heat_tolerant": True, "notes": "Tropical black-eyed pea"},
    {"name": "Pápalo Herb", "category": SeedCategory.HERB, "culinary_use": True, "heat_tolerant": True, "notes": "Mexican cilantro substitute, heat loving"},

    # Peppers
    {"name": "Cayenne Long Red Thin Pepper", "category": SeedCategory.VEGETABLE, "culinary_use": True, "medicinal_use": True, "heat_tolerant": True, "medicinal_notes": "Circulation, pain relief"},

    # Common
    {"name": "Common Pumpkin", "category": SeedCategory.VEGETABLE, "culinary_use": True, "notes": "Standard pumpkin for pies and decoration"},
]


async def migrate_seeds():
    """Add seeds to new table and remove from plants table"""
    await init_db()

    async with async_session() as db:
        added = 0
        skipped = 0

        print("=" * 50)
        print("Adding seeds to Seeds catalog...")
        print("=" * 50)

        for seed_data in SEEDS:
            # Check if already exists in seeds table
            result = await db.execute(
                select(Seed).where(Seed.name == seed_data["name"])
            )
            if result.scalar_one_or_none():
                print(f"  Skipping (exists): {seed_data['name']}")
                skipped += 1
                continue

            seed = Seed(
                name=seed_data["name"],
                category=seed_data["category"],
                sun_requirement=seed_data.get("sun_requirement", SunRequirement.FULL_SUN),
                water_requirement=seed_data.get("water_requirement", WaterRequirement.MODERATE),
                is_perennial=seed_data.get("is_perennial", False),
                is_native=seed_data.get("is_native", False),
                attracts_pollinators=seed_data.get("attracts_pollinators", False),
                medicinal_use=seed_data.get("medicinal_use", False),
                culinary_use=seed_data.get("culinary_use", False),
                ornamental_use=seed_data.get("ornamental_use", False),
                heat_tolerant=seed_data.get("heat_tolerant", True),
                frost_sensitive=seed_data.get("frost_sensitive", True),
                drought_tolerant=seed_data.get("drought_tolerant", False),
                medicinal_notes=seed_data.get("medicinal_notes"),
                notes=seed_data.get("notes"),
                is_active=True,
            )
            db.add(seed)
            added += 1
            print(f"  Added: {seed_data['name']}")

        await db.commit()
        print(f"\nSeeds table: Added {added}, skipped {skipped} existing.")

        # Now remove seeds from plants table
        print("\n" + "=" * 50)
        print("Removing seeds from Plants table...")
        print("=" * 50)

        seed_names = [s["name"] for s in SEEDS]
        removed = 0

        for name in seed_names:
            result = await db.execute(
                select(Plant).where(Plant.name == name)
            )
            plant = result.scalar_one_or_none()
            if plant:
                await db.delete(plant)
                removed += 1
                print(f"  Removed from plants: {name}")

        await db.commit()
        print(f"\nPlants table: Removed {removed} seed entries.")

        print("\n" + "=" * 50)
        print("Migration complete!")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(migrate_seeds())
