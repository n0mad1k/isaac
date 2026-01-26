#!/usr/bin/env python3
"""Fix Family Date Night to start at 5pm"""
import asyncio
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.tasks import Task

DATABASE_URL = "sqlite+aiosqlite:///./data/levi.db"
engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def fix_schedule():
    async with async_session() as db:
        # Fix Family Date Night to start at 5pm
        result = await db.execute(
            select(Task).where(
                Task.title == "Family Date Night",
                Task.is_active == True
            )
        )
        family_date = result.scalar_one_or_none()
        if family_date:
            family_date.due_time = '17:00'
            family_date.end_time = '21:00'
            print("FIXED: Family Date Night -> 5:00 PM - 9:00 PM")
        else:
            print("SKIP: Family Date Night not found")

        await db.commit()

if __name__ == '__main__':
    asyncio.run(fix_schedule())
