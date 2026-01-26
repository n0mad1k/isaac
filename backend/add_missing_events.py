#!/usr/bin/env python3
"""Add missing Time with God and Recovery events for specific days."""
import asyncio
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.tasks import Task, TaskType, TaskCategory, TaskRecurrence

DATABASE_URL = "sqlite+aiosqlite:///./data/levi.db"
engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DATES = {
    'wednesday': date(2026, 1, 28),
    'thursday': date(2026, 1, 29),
    'friday': date(2026, 1, 30),
    'saturday': date(2026, 1, 31),
}

EVENTS = [
    # Time with God for Wed, Thu, Fri, Sat
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['wednesday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['thursday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['friday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['saturday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    # Skill Work for Thursday
    {
        'title': 'Dane - Skill Work',
        'description': 'Rotate through: dry fire/tactics, medical, drone ops, land nav/survival, comms, study - keep all skills sharp. Choose based on what needs attention most.',
        'due_date': DATES['thursday'],
        'due_time': '06:00',
        'end_time': '07:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    # Recovery for Friday and Saturday
    {
        'title': 'Dane - Recovery',
        'description': 'Mobility work, stretching, foam roll - prevent injury, maintain performance',
        'due_date': DATES['friday'],
        'due_time': '06:50',
        'end_time': '07:00',
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
]

async def add_events():
    async with async_session() as db:
        added = 0
        for event_data in EVENTS:
            # Check if exact event exists (title + date + time)
            result = await db.execute(
                select(Task).where(
                    Task.title == event_data['title'],
                    Task.due_date == event_data['due_date'],
                    Task.due_time == event_data['due_time'],
                    Task.is_active == True
                )
            )
            if result.scalar_one_or_none():
                print(f"  SKIP: {event_data['title']} ({event_data['due_date'].strftime('%A')})")
                continue

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
            print(f"  ADD: {event_data['title']} ({event_data['due_date'].strftime('%A')} {event_data['due_time']})")
            added += 1

        await db.commit()
        print(f"\nAdded {added} missing events.")

if __name__ == '__main__':
    asyncio.run(add_events())
