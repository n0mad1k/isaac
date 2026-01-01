#!/usr/bin/env python3
"""
Add seed inventory to database - Zone 9b Florida
"""
import asyncio
import sys
sys.path.insert(0, '/opt/levi/backend')

from sqlalchemy import select
from models.database import async_session
from models.seeds import Seed, SeedCategory


# Seeds: (name, category, is_perennial, medicinal_use, culinary_use, description)
SEEDS = [
    # Medicinal Herbs
    ("Arnica", SeedCategory.MEDICINAL, True, True, False, "Topical herb for bruises and pain relief"),
    ("Licorice", SeedCategory.MEDICINAL, True, True, False, "Root used for digestive and respiratory support"),
    ("Burdock", SeedCategory.MEDICINAL, True, True, True, "Root vegetable and blood purifying herb"),
    ("English Lavender", SeedCategory.HERB, True, True, True, "Aromatic calming herb, culinary and medicinal"),
    ("Tall Mix Bachelor's Button", SeedCategory.FLOWER, False, False, False, "Cornflower mix, pollinator friendly"),
    ("Peppermint", SeedCategory.HERB, True, True, True, "Culinary and digestive mint"),
    ("Marshmallow", SeedCategory.MEDICINAL, True, True, False, "Root for soothing mucous membranes"),
    ("German Chamomile", SeedCategory.MEDICINAL, False, True, True, "Calming tea herb, sleep aid"),
    ("White Yarrow", SeedCategory.MEDICINAL, True, True, False, "Wound healing, fever reducing herb"),
    ("Thyme", SeedCategory.HERB, True, True, True, "Culinary herb with antimicrobial properties"),
    ("Anise Hyssop", SeedCategory.HERB, True, True, True, "Licorice-flavored herb, great for pollinators"),
    ("Calendula", SeedCategory.MEDICINAL, False, True, False, "Healing flower for skin care, anti-inflammatory"),
    ("Blue Skullcap", SeedCategory.MEDICINAL, True, True, False, "Nervine herb for anxiety and tension"),
    ("Catnip", SeedCategory.HERB, True, True, True, "Cat attractant, mild sedative tea"),
    ("Siberian Meadowsweet", SeedCategory.MEDICINAL, True, True, False, "Contains natural salicylates, pain relief"),
    ("St. John's Wort", SeedCategory.MEDICINAL, True, True, False, "Mood support and nerve health"),
    ("True Dandelion", SeedCategory.MEDICINAL, True, True, True, "Liver support, edible greens and roots"),
    ("Common Mullein", SeedCategory.MEDICINAL, True, True, False, "Respiratory support, ear oil"),
    ("Holy Basil", SeedCategory.MEDICINAL, True, True, True, "Tulsi, adaptogenic stress relief herb"),
    ("Angelica", SeedCategory.MEDICINAL, True, True, True, "Digestive herb, candied stems"),
    ("Stinging Nettle", SeedCategory.MEDICINAL, True, True, True, "Nutrient-rich, allergy support, edible greens"),
    ("Valerian", SeedCategory.MEDICINAL, True, True, False, "Sleep and relaxation root"),
    ("Rosemary", SeedCategory.HERB, True, True, True, "Culinary herb, memory and circulation support"),
    ("Echinacea Purple Coneflower", SeedCategory.MEDICINAL, True, True, False, "Immune system support"),
    ("Cayenne Long Red Thin Pepper", SeedCategory.VEGETABLE, False, True, True, "Hot pepper, circulation and pain relief"),
    ("Broadleaf Sage", SeedCategory.HERB, True, True, True, "Culinary sage, sore throat remedy"),
    ("Blue Vervain", SeedCategory.MEDICINAL, True, True, False, "Nervine herb for stress and tension"),
    ("Florence Fennel", SeedCategory.HERB, True, True, True, "Culinary bulb and seeds, digestive aid"),
    ("Ashwagandha", SeedCategory.MEDICINAL, True, True, False, "Adaptogenic root for stress and vitality"),
    ("Red Clover", SeedCategory.MEDICINAL, True, True, True, "Blood purifier, nitrogen fixer"),
    ("Milk Thistle", SeedCategory.MEDICINAL, False, True, False, "Liver support and detoxification"),
    ("Lemon Mint Bee Balm", SeedCategory.HERB, True, True, True, "Pollinator favorite, tea herb"),

    # Florida Natives/Adapted
    ("Florida Grove Pepper", SeedCategory.VEGETABLE, False, False, True, "Florida-adapted hot pepper"),
    ("Florida Velvet Bean", SeedCategory.VEGETABLE, False, True, True, "Florida native legume, dopamine precursor"),
    ("Florida Red Everglade Tomato", SeedCategory.VEGETABLE, False, False, True, "Heat-tolerant Florida heirloom tomato"),
    ("Candlestick Senna", SeedCategory.MEDICINAL, True, True, False, "Tropical medicinal, laxative"),
    ("Longevity Spinach", SeedCategory.VEGETABLE, True, True, True, "Perennial tropical green, nutrient dense"),
    ("Jack Bean", SeedCategory.VEGETABLE, False, False, True, "Tropical legume, nitrogen fixer"),
    ("Seminole Pumpkin", SeedCategory.VEGETABLE, False, False, True, "Florida native squash, stores well"),
    ("Giant Amaranth", SeedCategory.VEGETABLE, False, True, True, "Grain and greens, highly nutritious"),
    ("Moringa", SeedCategory.MEDICINAL, True, True, True, "Superfood tree, leaves and pods edible"),
    ("Speckled Southern Pea", SeedCategory.VEGETABLE, False, False, True, "Southern cowpea variety"),
    ("Blue Butterfly Pea", SeedCategory.FLOWER, True, True, True, "Edible blue flowers, natural food dye, tea"),
    ("Toothache Plant", SeedCategory.MEDICINAL, False, True, True, "Spilanthes, numbing herb for oral health"),
    ("Yellow Everglade Tomato", SeedCategory.VEGETABLE, False, False, True, "Heat-tolerant Florida yellow tomato"),
    ("Pigeon Pea", SeedCategory.VEGETABLE, True, False, True, "Tropical perennial legume, protein rich"),
    ("Caribbean Callaloo", SeedCategory.VEGETABLE, False, False, True, "Tropical amaranth greens"),
    ("Loofah Gourd", SeedCategory.VEGETABLE, False, False, True, "Edible young, sponge when mature"),
    ("Purple Passion Flower", SeedCategory.VINE, True, True, False, "Native vine, calming herb, beautiful flowers"),
    ("Feverfew", SeedCategory.MEDICINAL, True, True, False, "Headache and migraine relief"),
    ("Red Raspberry", SeedCategory.FRUIT, True, True, True, "Leaf tea for women's health, berries"),
    ("Lemon Balm", SeedCategory.HERB, True, True, True, "Calming herb, antiviral, delicious tea"),
    ("Stevia", SeedCategory.HERB, True, False, True, "Natural zero-calorie sweetener"),
    ("Fenugreek", SeedCategory.MEDICINAL, False, True, True, "Spice and medicinal seed"),
    ("Butterfly Weed", SeedCategory.NATIVE_FLORIDA, True, True, False, "Native milkweed for monarch butterflies"),
    ("Puerto Rican Black Cowpea", SeedCategory.VEGETABLE, False, False, True, "Tropical black-eyed pea variety"),
    ("Florida Market Eggplant", SeedCategory.VEGETABLE, False, False, True, "Florida-adapted eggplant"),
    ("Florida Broadleaf Mustard", SeedCategory.VEGETABLE, False, True, True, "Florida-adapted spicy greens"),
    ("Pápalo Herb", SeedCategory.HERB, False, False, True, "Mexican cilantro substitute, heat tolerant"),
    ("Beautyberry", SeedCategory.NATIVE_FLORIDA, True, True, True, "Native shrub, purple berries, insect repellent"),
    ("Deer Berry", SeedCategory.NATIVE_FLORIDA, True, False, True, "Native berry shrub"),
    ("Sand Blackberry", SeedCategory.NATIVE_FLORIDA, True, False, True, "Native Florida blackberry"),
    ("Serviceberry", SeedCategory.NATIVE_FLORIDA, True, False, True, "Native berry shrub"),
    ("Shiny Blueberry", SeedCategory.NATIVE_FLORIDA, True, False, True, "Native blueberry variety"),
    ("Sparkleberry", SeedCategory.NATIVE_FLORIDA, True, False, True, "Native berry shrub"),
    ("Florida Calamint", SeedCategory.NATIVE_FLORIDA, True, True, True, "Native Florida mint, pollinator"),
    ("Florida Mountain Mint", SeedCategory.NATIVE_FLORIDA, True, True, True, "Native pollinator plant"),
    ("Lyreleaf Sage", SeedCategory.NATIVE_FLORIDA, True, True, True, "Native Florida sage"),
    ("Florida Horse Mint", SeedCategory.NATIVE_FLORIDA, True, True, True, "Native aromatic herb"),
    ("Common Pumpkin", SeedCategory.VEGETABLE, False, False, True, "Standard pumpkin variety"),
]


async def add_seeds():
    async with async_session() as db:
        added = 0
        skipped = 0

        for name, category, is_perennial, medicinal_use, culinary_use, description in SEEDS:
            # Check if already exists
            result = await db.execute(
                select(Seed).where(Seed.name == name)
            )
            if result.scalar_one_or_none():
                print(f"  Skipped (exists): {name}")
                skipped += 1
                continue

            seed = Seed(
                name=name,
                category=category,
                is_perennial=is_perennial,
                medicinal_use=medicinal_use,
                culinary_use=culinary_use,
                description=description,
                heat_tolerant=True,  # Zone 9b
                is_active=True,
            )
            db.add(seed)
            print(f"  Added: {name}")
            added += 1

        await db.commit()
        print(f"\nDone! Added {added} seeds, skipped {skipped} existing.")


if __name__ == "__main__":
    print("Adding seeds to Levi database...\n")
    asyncio.run(add_seeds())
