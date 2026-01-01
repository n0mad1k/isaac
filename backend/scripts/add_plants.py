#!/usr/bin/env python3
"""
Bulk import plants for Zone 9b Florida homestead
Updated to use Tag system
"""

import asyncio
import sys
sys.path.insert(0, '/opt/levi/backend')

from sqlalchemy import select
from models.database import async_session
from models.plants import Plant, Tag, SunRequirement, GrowthRate


# Plant data: (name, tags, description, frost_sensitive, min_temp, latin_name)
PLANTS = [
    ("Katuk", ["Edible", "Perennial", "Tropical"], "Sweet leaf bush, edible leaves high in protein", True, 32, "Sauropus androgynus"),
    ("Meyer Lemon", ["Edible", "Citrus", "Fruit Tree"], "Sweeter, less acidic lemon variety", True, 28, "Citrus × meyeri"),
    ("Orange", ["Edible", "Citrus", "Fruit Tree"], "Sweet citrus fruit tree", True, 28, "Citrus sinensis"),
    ("Blueberry", ["Edible", "Berry", "Perennial"], "Antioxidant-rich berry bush", False, 20, "Vaccinium corymbosum"),
    ("Blackberry", ["Edible", "Berry", "Perennial"], "Thorny or thornless berry bramble", False, 10, "Rubus fruticosus"),
    ("Fig", ["Edible", "Fruit Tree", "Perennial"], "Mediterranean fruit tree, easy to grow", False, 15, "Ficus carica"),
    ("Peach", ["Edible", "Fruit Tree"], "Stone fruit requiring chill hours", False, 10, "Prunus persica"),
    ("Cassava", ["Edible", "Root Crop", "Tropical"], "Starchy root vegetable, drought tolerant", True, 32, "Manihot esculenta"),
    ("Turmeric", ["Edible", "Medicinal", "Tropical", "Root Crop"], "Anti-inflammatory rhizome, golden spice", True, 35, "Curcuma longa"),
    ("Taro", ["Edible", "Root Crop", "Tropical"], "Starchy corm, loves wet conditions", True, 35, "Colocasia esculenta"),
    ("Banana", ["Edible", "Tropical", "Fruit Tree"], "Fast-growing tropical fruit", True, 28, "Musa spp."),
    ("Seabreeze Bamboo", ["Bamboo", "Utility", "Perennial"], "Clumping bamboo, good for privacy screens", True, 25, "Bambusa malingensis"),
    ("Giant Timber Bamboo", ["Bamboo", "Utility", "Perennial"], "Large clumping bamboo for building material", True, 22, "Bambusa oldhamii"),
    ("Chaya", ["Edible", "Medicinal", "Tropical", "Perennial"], "Tree spinach, must be cooked before eating", True, 32, "Cnidoscolus aconitifolius"),
    ("American Beautyberry", ["Native", "Edible", "Perennial", "Pollinator"], "Purple berry clusters, wildlife food", False, 10, "Callicarpa americana"),
    ("Avocado", ["Edible", "Fruit Tree", "Tropical"], "Creamy fruit high in healthy fats", True, 28, "Persea americana"),
    ("Lemon Grass", ["Edible", "Medicinal", "Herb", "Tropical"], "Citrus-flavored grass for cooking and tea", True, 32, "Cymbopogon citratus"),
    ("Elderberry", ["Edible", "Medicinal", "Native", "Perennial", "Berry"], "Immune-boosting berries, flowers for tea", False, 0, "Sambucus nigra"),
    ("Muscadine Grape", ["Edible", "Native", "Vine", "Perennial"], "Native grape, heat and humidity tolerant", False, 5, "Vitis rotundifolia"),
    ("Aloe Vera", ["Medicinal", "Perennial", "Tropical"], "Healing gel for burns and skin care", True, 32, "Aloe barbadensis miller"),
    ("Cuban Oregano", ["Edible", "Medicinal", "Herb", "Tropical"], "Thick succulent leaves, strong oregano flavor", True, 32, "Plectranthus amboinicus"),
    ("Mango", ["Edible", "Fruit Tree", "Tropical"], "King of fruits, many varieties", True, 30, "Mangifera indica"),
    ("Pigeon Pea", ["Edible", "Nitrogen Fixer", "Perennial", "Tropical"], "Protein-rich legume, improves soil", True, 32, "Cajanus cajan"),
    ("Blue Butterfly Pea", ["Edible", "Medicinal", "Vine", "Pollinator", "Nitrogen Fixer"], "Blue flowers for tea, natural food coloring", True, 32, "Clitoria ternatea"),
    ("Cowpea (Puerto Rican Black)", ["Edible", "Nitrogen Fixer", "Annual"], "Black-eyed pea variety, heat tolerant", True, 32, "Vigna unguiculata"),
    ("Moringa", ["Edible", "Medicinal", "Tropical", "Perennial"], "Superfood tree, every part is usable", True, 32, "Moringa oleifera"),
    ("Dwarf Everbearing Mulberry", ["Edible", "Fruit Tree", "Perennial"], "Compact mulberry, continuous fruiting", False, 15, "Morus nigra"),
    ("Thai Mulberry", ["Edible", "Fruit Tree", "Tropical"], "Long sweet mulberries", True, 25, "Morus alba"),
    ("Pink Guava", ["Edible", "Fruit Tree", "Tropical"], "Pink-fleshed aromatic tropical fruit", True, 28, "Psidium guajava"),
    ("Yellow Guava", ["Edible", "Fruit Tree", "Tropical"], "Yellow-fleshed sweet tropical fruit", True, 28, "Psidium guajava"),
    ("Loquat", ["Edible", "Fruit Tree", "Perennial"], "Early spring fruit, evergreen tree", False, 12, "Eriobotrya japonica"),
    ("Lychee", ["Edible", "Fruit Tree", "Tropical"], "Sweet aromatic fruit, needs humidity", True, 28, "Litchi chinensis"),
    ("Ginger", ["Edible", "Medicinal", "Tropical", "Root Crop"], "Spicy rhizome for cooking and medicine", True, 32, "Zingiber officinale"),
    ("Pomelo", ["Edible", "Citrus", "Fruit Tree"], "Largest citrus fruit, mild sweet flavor", True, 28, "Citrus maxima"),
    ("Neem Tree", ["Medicinal", "Utility", "Tropical"], "Medicinal tree, natural pesticide", True, 32, "Azadirachta indica"),
    ("Dragon Fruit", ["Edible", "Tropical", "Perennial"], "Climbing cactus with vibrant fruit", True, 32, "Hylocereus undatus"),
    ("Jackfruit", ["Edible", "Fruit Tree", "Tropical"], "Largest tree fruit, meat substitute when young", True, 32, "Artocarpus heterophyllus"),
    ("Mysore Raspberry", ["Edible", "Berry", "Tropical", "Perennial"], "Heat-tolerant raspberry, spreads readily", True, 28, "Rubus niveus"),
    ("Canistel", ["Edible", "Fruit Tree", "Tropical"], "Egg fruit, sweet custard-like flesh", True, 30, "Pouteria campechiana"),
]


async def import_plants():
    async with async_session() as db:
        # First, get all tags
        result = await db.execute(select(Tag))
        tags_db = {t.name: t for t in result.scalars().all()}

        added = 0
        skipped = 0

        for name, tag_names, description, frost_sensitive, min_temp, latin_name in PLANTS:
            # Check if plant already exists
            result = await db.execute(
                select(Plant).where(Plant.name == name)
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  Skipped (exists): {name}")
                skipped += 1
                continue

            # Get tag objects
            plant_tags = []
            for tag_name in tag_names:
                if tag_name in tags_db:
                    plant_tags.append(tags_db[tag_name])
                else:
                    print(f"  Warning: Tag '{tag_name}' not found for {name}")

            # Create plant
            plant = Plant(
                name=name,
                latin_name=latin_name,
                description=description,
                frost_sensitive=frost_sensitive,
                min_temp=min_temp,
                sun_requirement=SunRequirement.FULL_SUN,
                growth_rate=GrowthRate.MODERATE,
                heat_tolerant=True,
                drought_tolerant=False,
            )
            plant.tags = plant_tags

            db.add(plant)
            print(f"  Added: {name} ({', '.join(tag_names)})")
            added += 1

        await db.commit()
        print(f"\nDone! Added {added} plants, skipped {skipped} existing.")


if __name__ == "__main__":
    print("Importing plants...\n")
    asyncio.run(import_plants())
