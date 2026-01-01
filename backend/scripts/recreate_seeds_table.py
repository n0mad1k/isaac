"""
Recreate seeds table with new schema
"""
import asyncio
import sys
sys.path.insert(0, '/opt/levi/backend')

from sqlalchemy import text
from models.database import engine, init_db

async def recreate_seeds():
    async with engine.begin() as conn:
        await conn.execute(text('DROP TABLE IF EXISTS seeds'))
        print('Dropped old seeds table')

    await init_db()
    print('Recreated tables with new schema')

if __name__ == "__main__":
    asyncio.run(recreate_seeds())
