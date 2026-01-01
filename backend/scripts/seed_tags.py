#!/usr/bin/env python3
"""
Seed default plant tags
"""

import asyncio
import sys
sys.path.insert(0, '/opt/levi/backend')

from sqlalchemy import select
from models.database import async_session
from models.plants import Tag

# Default tags with colors
TAGS = [
    ("Edible", "green"),
    ("Medicinal", "purple"),
    ("Native", "cyan"),
    ("Perennial", "emerald"),
    ("Annual", "amber"),
    ("Tropical", "orange"),
    ("Fruit Tree", "red"),
    ("Citrus", "yellow"),
    ("Berry", "pink"),
    ("Root Crop", "brown"),
    ("Herb", "lime"),
    ("Nitrogen Fixer", "teal"),
    ("Pollinator", "rose"),
    ("Ornamental", "fuchsia"),
    ("Utility", "gray"),
    ("Bamboo", "green"),
    ("Palm", "emerald"),
    ("Vine", "lime"),
]


async def seed_tags():
    async with async_session() as db:
        added = 0
        skipped = 0

        for name, color in TAGS:
            # Check if tag already exists
            result = await db.execute(
                select(Tag).where(Tag.name == name)
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  Skipped (exists): {name}")
                skipped += 1
                continue

            tag = Tag(name=name, color=color)
            db.add(tag)
            print(f"  Added: {name} ({color})")
            added += 1

        await db.commit()
        print(f"\nDone! Added {added} tags, skipped {skipped} existing.")


if __name__ == "__main__":
    print("Seeding plant tags...\n")
    asyncio.run(seed_tags())
