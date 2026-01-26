#!/usr/bin/env python3
"""
Update Dane's schedule:
1. Move Family Time from Sunday to Saturday
2. Move Gear Maintenance from Saturday to Sunday morning
3. Remove Time with God from Sunday (church covers faith)
4. Add Church on Sunday 10:00 AM - 12:30 PM
5. Move Long Training Day from Saturday to Sunday afternoon (2-5 PM)
"""

import asyncio
from datetime import date
from sqlalchemy import select, update, delete, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.tasks import Task, TaskType, TaskCategory, TaskRecurrence

DATABASE_URL = "sqlite+aiosqlite:///./data/levi.db"
engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Dates for each day of the week
DATES = {
    'monday': date(2026, 1, 26),
    'tuesday': date(2026, 1, 27),
    'wednesday': date(2026, 1, 28),
    'thursday': date(2026, 1, 29),
    'friday': date(2026, 1, 30),
    'saturday': date(2026, 1, 31),
    'sunday': date(2026, 2, 1),
}


async def update_schedule():
    async with async_session() as db:
        changes = []

        # 1. Move Family Time from Sunday to Saturday
        result = await db.execute(
            select(Task).where(
                Task.title == "Family Time",
                Task.due_date == DATES['sunday'],
                Task.is_active == True
            )
        )
        family_time = result.scalar_one_or_none()
        if family_time:
            family_time.due_date = DATES['saturday']
            family_time.due_time = '10:00'
            family_time.end_time = '20:00'
            family_time.description = 'Weekend family time - be present, they are the mission'
            changes.append("MOVED: Family Time -> Saturday 10:00 AM - 8:00 PM")
        else:
            changes.append("SKIP: Family Time not found on Sunday")

        # 2. Move Gear Maintenance from Saturday to Sunday morning
        result = await db.execute(
            select(Task).where(
                Task.title == "Dane - Gear Maintenance",
                Task.due_date == DATES['saturday'],
                Task.is_active == True
            )
        )
        gear_maint = result.scalar_one_or_none()
        if gear_maint:
            gear_maint.due_date = DATES['sunday']
            gear_maint.due_time = '05:30'
            gear_maint.end_time = '06:30'
            changes.append("MOVED: Gear Maintenance -> Sunday 5:30-6:30 AM")
        else:
            changes.append("SKIP: Gear Maintenance not found on Saturday")

        # 3. Remove Time with God from Sunday (church covers faith)
        result = await db.execute(
            select(Task).where(
                Task.title == "Dane - Time with God",
                Task.due_date == DATES['sunday'],
                Task.is_active == True
            )
        )
        sunday_twg = result.scalar_one_or_none()
        if sunday_twg:
            await db.delete(sunday_twg)
            changes.append("DELETED: Time with God on Sunday (church covers faith)")
        else:
            changes.append("SKIP: Time with God not found on Sunday")

        # 4. Add Church on Sunday 10:00 AM - 12:30 PM
        result = await db.execute(
            select(Task).where(
                Task.title == "Church",
                Task.due_date == DATES['sunday'],
                Task.is_active == True
            )
        )
        existing_church = result.scalar_one_or_none()
        if not existing_church:
            church = Task(
                title="Church",
                description="Worship, fellowship, spiritual growth with community",
                task_type=TaskType.EVENT,
                category=TaskCategory.CUSTOM,
                due_date=DATES['sunday'],
                due_time='10:00',
                end_time='12:30',
                recurrence=TaskRecurrence.WEEKLY,
                priority=2,
                is_active=True,
                is_completed=False,
                notify_email=False,
            )
            db.add(church)
            changes.append("ADDED: Church -> Sunday 10:00 AM - 12:30 PM")
        else:
            changes.append("SKIP: Church already exists on Sunday")

        # 5. Move Long Training Day from Saturday to Sunday afternoon
        result = await db.execute(
            select(Task).where(
                Task.title == "Dane - Long Training Day",
                Task.due_date == DATES['saturday'],
                Task.is_active == True
            )
        )
        long_training = result.scalar_one_or_none()
        if long_training:
            long_training.due_date = DATES['sunday']
            long_training.due_time = '14:00'
            long_training.end_time = '17:00'
            long_training.description = 'Extended skill block (2-4 hrs) - range day, land nav course, medical scenario, drone mission, or comms field exercise. Rotate focus monthly. Before dark.'
            changes.append("MOVED: Long Training Day -> Sunday 2:00-5:00 PM")
        else:
            changes.append("SKIP: Long Training Day not found on Saturday")

        # 6. Also remove Planning & AAR from Sunday since Gear Maint replaces the morning slot
        # Actually keep it - it's at 6:00-6:30 and Gear Maint is 5:30-6:30, so there's overlap
        # Let's move Planning & AAR to after Gear Maintenance
        result = await db.execute(
            select(Task).where(
                Task.title == "Dane - Planning & AAR",
                Task.due_date == DATES['sunday'],
                Task.is_active == True
            )
        )
        planning_aar = result.scalar_one_or_none()
        if planning_aar:
            planning_aar.due_time = '06:30'
            planning_aar.end_time = '07:00'
            changes.append("MOVED: Planning & AAR -> Sunday 6:30-7:00 AM (after Gear Maint)")
        else:
            changes.append("SKIP: Planning & AAR not found on Sunday")

        await db.commit()

        print("Schedule updates completed:\n")
        for change in changes:
            print(f"  {change}")


if __name__ == '__main__':
    print("Updating Dane's schedule...\n")
    asyncio.run(update_schedule())
