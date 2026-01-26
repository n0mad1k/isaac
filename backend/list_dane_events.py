#!/usr/bin/env python3
"""List Dane's training events."""

import asyncio
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.tasks import Task

DATABASE_URL = "sqlite+aiosqlite:///./data/levi.db"
engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def list_training():
    async with async_session() as db:
        result = await db.execute(
            select(Task).where(
                or_(
                    Task.title.like("Dane%"),
                    Task.title.like("Dad%"),
                    Task.title.like("Date%"),
                    Task.title.like("Family%"),
                    Task.title.like("Wife%")
                )
            )
        )
        tasks = result.scalars().all()
        day_order = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
        tasks_sorted = sorted(tasks, key=lambda t: (day_order.get(t.due_date.strftime("%A"), 7) if t.due_date else 7, t.due_time or ""))

        current_day = None
        for t in tasks_sorted:
            weekday = t.due_date.strftime("%A") if t.due_date else "No date"
            if weekday != current_day:
                print(f"\n=== {weekday.upper()} ===")
                current_day = weekday
            print(f"  {t.due_time}-{t.end_time}: {t.title}")

asyncio.run(list_training())
