#!/usr/bin/env python3
"""
Add Dane's training schedule to PROD.
Skips events that likely already exist (Date Night, Wife Massage, etc.)
"""

import asyncio
from datetime import date
from sqlalchemy import select, or_
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

# ONLY Dane's training events - skip Date Night, Wife Massage, etc. as they exist
EVENTS = [
    # ===== MONDAY (REST DAY) =====
    {
        'title': 'Dane - Rest Day',
        'description': 'Lazy Monday - recharge, recover, be present with family. No structured training.',
        'due_date': DATES['monday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== TUESDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['tuesday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Skill Work',
        'description': 'Rotate through: dry fire/tactics, medical, drone ops, land nav/survival, comms, study - keep all skills sharp. Choose based on what needs attention most.',
        'due_date': DATES['tuesday'],
        'due_time': '06:00',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== WEDNESDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['wednesday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Fitness - Cardio',
        'description': 'Run, bike, row, swim - build engine for endurance and stress recovery',
        'due_date': DATES['wednesday'],
        'due_time': '06:00',
        'end_time': '06:50',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Recovery',
        'description': 'Mobility work, stretching, foam roll - prevent injury, maintain performance',
        'due_date': DATES['wednesday'],
        'due_time': '06:50',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dad + Son Time',
        'description': 'Wife rides horses - intentional quality time with your boy',
        'due_date': DATES['wednesday'],
        'due_time': '17:30',
        'end_time': '18:30',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== THURSDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['thursday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Skill Work',
        'description': 'Rotate through: dry fire/tactics, medical, drone ops, land nav/survival, comms, study - keep all skills sharp. Choose based on what needs attention most.',
        'due_date': DATES['thursday'],
        'due_time': '06:00',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    # NOTE: Date Night already exists in prod - not adding

    # ===== FRIDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['friday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Fitness - Ruck',
        'description': 'Weighted movement - build load-bearing capacity and mental toughness',
        'due_date': DATES['friday'],
        'due_time': '06:00',
        'end_time': '06:50',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Recovery',
        'description': 'Mobility work, stretching, foam roll - prevent injury, maintain performance',
        'due_date': DATES['friday'],
        'due_time': '06:50',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Family Date Night',
        'description': 'Protected family time - they are the mission',
        'due_date': DATES['friday'],
        'due_time': '17:00',
        'end_time': '21:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== SATURDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['saturday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Fitness - Strength',
        'description': 'Lift heavy - build functional strength for load bearing, combat, and resilience',
        'due_date': DATES['saturday'],
        'due_time': '06:00',
        'end_time': '06:50',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Recovery',
        'description': 'Mobility work, stretching, foam roll - prevent injury, maintain performance',
        'due_date': DATES['saturday'],
        'due_time': '06:50',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Family Time',
        'description': 'Weekend family time - be present, they are the mission',
        'due_date': DATES['saturday'],
        'due_time': '10:00',
        'end_time': '20:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== SUNDAY =====
    {
        'title': 'Dane - Gear Maintenance',
        'description': 'Clean weapons, check kit, batteries, inventory consumables, vehicle check - equipment readiness',
        'due_date': DATES['sunday'],
        'due_time': '05:30',
        'end_time': '06:30',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Planning & AAR',
        'description': 'Review the week\'s training, note gaps, plan next week, adjust goals - continuous improvement',
        'due_date': DATES['sunday'],
        'due_time': '06:30',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Church',
        'description': 'Worship, fellowship, spiritual growth with community',
        'due_date': DATES['sunday'],
        'due_time': '10:00',
        'end_time': '12:30',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Long Training Day',
        'description': 'Extended skill block (2-4 hrs) - range day, land nav course, medical scenario, drone mission, or comms field exercise. Rotate focus monthly. Before dark.',
        'due_date': DATES['sunday'],
        'due_time': '14:00',
        'end_time': '17:00',
        'recurrence': TaskRecurrence.MONTHLY,
    },
]


async def add_events():
    """Add training events to database, skipping existing ones."""
    async with async_session() as db:
        added = 0
        skipped = 0

        for event_data in EVENTS:
            # Check if event already exists (match title, weekday, and time)
            result = await db.execute(
                select(Task).where(
                    Task.title == event_data['title'],
                    Task.due_time == event_data['due_time'],
                    Task.is_active == True
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  SKIP: {event_data['title']} (already exists)")
                skipped += 1
                continue

            # Create new event
            task = Task(
                title=event_data['title'],
                description=event_data['description'],
                task_type=TaskType.EVENT,
                category=TaskCategory.CUSTOM,
                due_date=event_data['due_date'],
                due_time=event_data['due_time'],
                end_time=event_data['end_time'],
                recurrence=event_data['recurrence'],
                priority=2,
                is_active=True,
                is_completed=False,
                notify_email=False,
            )

            db.add(task)
            day_name = event_data['due_date'].strftime('%A')
            print(f"  ADD: {event_data['title']} ({day_name} {event_data['due_time']}-{event_data['end_time']})")
            added += 1

        await db.commit()
        print(f"\nDone! Added {added} events, skipped {skipped} duplicates.")


if __name__ == '__main__':
    print("Adding Dane's training schedule to database...\n")
    asyncio.run(add_events())
