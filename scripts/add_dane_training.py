#!/usr/bin/env python3
"""
Add Dane's weekly training schedule to the calendar.
Run this script from the backend directory:
    cd /opt/isaac/backend && source venv/bin/activate && python /opt/isaac/scripts/add_dane_training.py
"""

import sys
sys.path.insert(0, '/opt/isaac/backend')

from datetime import date
from sqlalchemy.orm import Session
from models.database import SessionLocal, engine
from models.tasks import Task, TaskType, TaskCategory, TaskRecurrence

# Calculate dates for this week (starting from today 2026-01-26 Monday)
# We need a date for each day of the week to set the recurrence anchor
DATES = {
    'monday': date(2026, 1, 26),
    'tuesday': date(2026, 1, 27),
    'wednesday': date(2026, 1, 28),
    'thursday': date(2026, 1, 29),
    'friday': date(2026, 1, 30),
    'saturday': date(2026, 1, 31),
    'sunday': date(2026, 2, 1),
}

# Training schedule events
EVENTS = [
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
    {
        'title': 'Date Night',
        'description': 'Invest in your marriage - protected time with your wife',
        'due_date': DATES['thursday'],
        'due_time': '18:00',
        'end_time': '19:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

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
        'due_time': '18:00',
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
        'title': 'Dane - Gear Maintenance',
        'description': 'Clean weapons, check kit, batteries, inventory consumables, vehicle check - equipment readiness',
        'due_date': DATES['saturday'],
        'due_time': '09:00',
        'end_time': '10:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== SUNDAY =====
    {
        'title': 'Dane - Time with God',
        'description': 'Bible reading, prayer, devotional - anchor your purpose and moral compass',
        'due_date': DATES['sunday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Dane - Planning & AAR',
        'description': 'Review the week\'s training, note gaps, plan next week, adjust goals - continuous improvement',
        'due_date': DATES['sunday'],
        'due_time': '06:00',
        'end_time': '06:30',
        'recurrence': TaskRecurrence.WEEKLY,
    },
    {
        'title': 'Family Time',
        'description': 'Church, rest, be present with family - they are the why behind the mission',
        'due_date': DATES['sunday'],
        'due_time': '08:00',
        'end_time': '20:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== MONDAY (REST DAY) =====
    {
        'title': 'Dane - Rest Day',
        'description': 'Lazy Monday - recharge, recover, be present with family. No structured training.',
        'due_date': DATES['monday'],
        'due_time': '05:30',
        'end_time': '06:00',
        'recurrence': TaskRecurrence.WEEKLY,
    },

    # ===== MONTHLY =====
    {
        'title': 'Dane - Long Training Day',
        'description': 'Extended skill block (2-4 hrs) - range day, land nav course, medical scenario, drone mission, or comms field exercise. Rotate focus monthly.',
        'due_date': DATES['saturday'],  # First Saturday
        'due_time': '08:00',
        'end_time': '12:00',
        'recurrence': TaskRecurrence.MONTHLY,
    },

    # ===== BIWEEKLY =====
    {
        'title': 'Wife Massage',
        'description': 'Wife has massage appointment - Dane has solo time',
        'due_date': DATES['tuesday'],
        'due_time': '20:00',
        'end_time': '21:00',
        'recurrence': TaskRecurrence.BIWEEKLY,
    },
]


def add_events():
    """Add all training events to the database."""
    db = SessionLocal()
    try:
        added = 0
        skipped = 0

        for event_data in EVENTS:
            # Check if event already exists (by title and due_time on same weekday)
            existing = db.query(Task).filter(
                Task.title == event_data['title'],
                Task.due_time == event_data['due_time'],
                Task.recurrence == event_data['recurrence'],
                Task.is_active == True
            ).first()

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
                notify_email=False,  # Don't spam email for training blocks
            )

            db.add(task)
            print(f"  ADD: {event_data['title']} ({event_data['due_date'].strftime('%A')} {event_data['due_time']}-{event_data['end_time']})")
            added += 1

        db.commit()
        print(f"\nDone! Added {added} events, skipped {skipped} duplicates.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    print("Adding Dane's training schedule to Isaac calendar...\n")
    add_events()
