"""
Calendar Sync Service
Bi-directional sync between Isaac tasks and CalDAV calendars (Proton, etc.)
"""

import caldav
from caldav.elements import dav, cdav
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import icalendar
import uuid
import pytz
import hashlib


def compute_task_sync_hash(task) -> str:
    """Compute a hash of task fields relevant to calendar sync.

    If this hash matches the stored hash, no sync is needed.
    Includes: title, due_date, due_time, end_date, end_time, location,
              description, is_completed, is_active, task_type,
              recurrence, recurrence_interval, recurrence_days_of_week, exception_dates
    """
    # Build a string of all sync-relevant fields
    parts = [
        str(task.title or ''),
        str(task.due_date or ''),
        str(task.due_time or ''),
        str(task.end_date or ''),
        str(task.end_time or ''),
        str(task.location or ''),
        str(task.description or '')[:500],  # Limit description length
        str(task.is_completed),
        str(task.is_active),
        str(task.task_type.value if task.task_type else ''),
        str(task.recurrence.value if task.recurrence else ''),
        str(task.recurrence_interval or ''),
        str(task.recurrence_days_of_week or ''),
        str(task.exception_dates or ''),
    ]
    content = '|'.join(parts)
    return hashlib.sha256(content.encode()).hexdigest()[:32]

from models.tasks import Task, TaskCategory, TaskType, TaskRecurrence
from models.settings import AppSetting


def sanitize_ical_text(text: str) -> str:
    """Sanitize text for safe iCalendar property values.

    Prevents iCal property injection by:
    1. Removing/escaping control characters
    2. Escaping backslashes, semicolons, commas, newlines
    3. Limiting length to prevent DoS
    """
    if not text:
        return ""

    # Limit length to prevent DoS
    text = text[:4096]

    # Remove null bytes and other control characters (except newline, tab)
    text = ''.join(c for c in text if c >= ' ' or c in '\n\t')

    # The icalendar library should handle RFC 5545 escaping, but we add extra safety:
    # Remove any raw CRLF sequences that could inject new properties
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Remove any lines that look like iCal property injection attempts
    # (lines starting with valid iCal property names followed by : or ;)
    import re
    lines = text.split('\n')
    safe_lines = []
    ical_property_pattern = re.compile(r'^[A-Z][A-Z0-9-]*[;:]', re.IGNORECASE)
    for line in lines:
        # If line looks like an iCal property, prefix with space to neutralize
        if ical_property_pattern.match(line.strip()):
            line = ' ' + line
        safe_lines.append(line)

    return '\n'.join(safe_lines)


# Default settings
DEFAULT_CALENDAR_SETTINGS = {
    "calendar_enabled": "false",
    "calendar_url": "http://127.0.0.1:5232",
    "calendar_username": "",
    "calendar_password": "",
    "calendar_name": "My Farm",
    "calendar_sync_interval": "30",  # minutes
}


async def get_calendar_setting(db: AsyncSession, key: str) -> str:
    """Get a calendar setting from the database. Decrypts sensitive values."""
    from services.encryption import should_encrypt, decrypt_value

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        # Decrypt sensitive settings
        if should_encrypt(key):
            return decrypt_value(setting.value)
        return setting.value
    return DEFAULT_CALENDAR_SETTINGS.get(key, "")


class CalendarSyncService:
    """Service for syncing tasks with CalDAV calendars"""

    def __init__(
        self,
        url: str,
        username: str,
        password: str,
        calendar_name: str = "My Farm",
        timezone: str = "America/New_York",
    ):
        self.url = url
        self.username = username
        self.password = password
        self.calendar_name = calendar_name
        self.timezone = timezone
        self._client: Optional[caldav.DAVClient] = None
        self._calendar: Optional[caldav.Calendar] = None

    def connect(self) -> bool:
        """Connect to the CalDAV server"""
        try:
            self._client = caldav.DAVClient(
                url=self.url,
                username=self.username,
                password=self.password,
                timeout=10,  # 10 second timeout to prevent hanging
            )
            principal = self._client.principal()
            logger.info(f"Connected to CalDAV server: {self.url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to CalDAV server: {e}")
            return False

    def get_or_create_calendar(self) -> Optional[caldav.Calendar]:
        """Get the Isaac calendar, or create it if it doesn't exist"""
        if self._calendar:
            return self._calendar

        if not self._client:
            if not self.connect():
                return None

        try:
            principal = self._client.principal()
            calendars = principal.calendars()

            # Look for existing calendar
            for cal in calendars:
                if cal.name == self.calendar_name:
                    self._calendar = cal
                    logger.info(f"Found existing calendar: {self.calendar_name}")
                    return self._calendar

            # Create new calendar
            self._calendar = principal.make_calendar(name=self.calendar_name)
            logger.info(f"Created new calendar: {self.calendar_name}")
            return self._calendar

        except Exception as e:
            logger.error(f"Failed to get/create calendar: {e}")
            return None

    def task_to_ical(self, task: Task) -> str:
        """Convert a Isaac task to iCalendar format (VEVENT for events, VTODO for todos)"""
        cal = icalendar.Calendar()
        cal.add('prodid', '-//Isaac Farm Assistant//example.com//')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')  # Required for iOS compatibility

        # Determine if this is a VTODO or VEVENT
        # Events have task_type=EVENT, Todos have task_type=TODO (or no type)
        is_event = task.task_type == TaskType.EVENT if task.task_type else False

        # Use existing calendar_uid if set, otherwise create new isaac-task UID
        uid = task.calendar_uid if task.calendar_uid else f"isaac-task-{task.id}@example.com"
        now_utc = datetime.now(pytz.UTC)
        local_tz = pytz.timezone(self.timezone)

        if is_event:
            # Create VEVENT for calendar events
            component = icalendar.Event()
            component.add('uid', uid)
            component.add('summary', sanitize_ical_text(task.title))

            if task.description:
                component.add('description', sanitize_ical_text(task.description))
            if task.location:
                component.add('location', sanitize_ical_text(task.location))

            # Date and Time handling
            if task.due_date:
                if task.due_time:
                    try:
                        hour, minute = map(int, task.due_time.split(':')[:2])
                        start_dt = local_tz.localize(datetime(
                            task.due_date.year, task.due_date.month, task.due_date.day,
                            hour, minute
                        ))
                        component.add('dtstart', start_dt)

                        if task.end_time:
                            end_hour, end_minute = map(int, task.end_time.split(':')[:2])
                            end_dt = local_tz.localize(datetime(
                                task.due_date.year, task.due_date.month, task.due_date.day,
                                end_hour, end_minute
                            ))
                            if end_dt <= start_dt:
                                end_dt = end_dt + timedelta(days=1)
                        else:
                            end_dt = start_dt + timedelta(hours=1)
                        component.add('dtend', end_dt)
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Failed to parse event time for task {task.id}, falling back to all-day: {e}")
                        component.add('dtstart', task.due_date)
                        component.add('dtend', task.due_date + timedelta(days=1))
                else:
                    # All-day event
                    component.add('dtstart', task.due_date)
                    component.add('dtend', task.due_date + timedelta(days=1))
            else:
                # Events must have a date, default to today
                today = date.today()
                component.add('dtstart', today)
                component.add('dtend', today + timedelta(days=1))

            # Event-specific fields
            component.add('transp', 'OPAQUE')

        else:
            # Create VTODO for reminders/todos
            component = icalendar.Todo()
            component.add('uid', uid)
            component.add('summary', sanitize_ical_text(task.title))

            if task.description:
                component.add('description', sanitize_ical_text(task.description))
            if task.location:
                component.add('location', sanitize_ical_text(task.location))

            # Due date/time for todos (optional)
            if task.due_date:
                if task.due_time:
                    try:
                        hour, minute = map(int, task.due_time.split(':')[:2])
                        due_dt = local_tz.localize(datetime(
                            task.due_date.year, task.due_date.month, task.due_date.day,
                            hour, minute
                        ))
                        component.add('due', due_dt)
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Failed to parse todo time for task {task.id}, falling back to date-only: {e}")
                        component.add('due', task.due_date)
                else:
                    component.add('due', task.due_date)

        # Add RRULE for recurring tasks so they appear on all dates in the calendar
        if task.recurrence and task.recurrence != TaskRecurrence.ONCE:
            rrule_params = {}
            if task.recurrence == TaskRecurrence.DAILY:
                rrule_params = {'FREQ': 'DAILY'}
            elif task.recurrence == TaskRecurrence.WEEKLY:
                rrule_params = {'FREQ': 'WEEKLY'}
            elif task.recurrence == TaskRecurrence.BIWEEKLY:
                rrule_params = {'FREQ': 'WEEKLY', 'INTERVAL': 2}
            elif task.recurrence == TaskRecurrence.MONTHLY:
                rrule_params = {'FREQ': 'MONTHLY'}
            elif task.recurrence == TaskRecurrence.QUARTERLY:
                rrule_params = {'FREQ': 'MONTHLY', 'INTERVAL': 3}
            elif task.recurrence == TaskRecurrence.BIANNUALLY:
                rrule_params = {'FREQ': 'MONTHLY', 'INTERVAL': 6}
            elif task.recurrence == TaskRecurrence.ANNUALLY:
                rrule_params = {'FREQ': 'YEARLY'}
            elif task.recurrence == TaskRecurrence.CUSTOM and task.recurrence_interval:
                rrule_params = {'FREQ': 'DAILY', 'INTERVAL': task.recurrence_interval}
            elif task.recurrence == TaskRecurrence.CUSTOM_WEEKLY and task.recurrence_days_of_week:
                day_map = {0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'}
                days = [day_map[d] for d in task.recurrence_days_of_week if d in day_map]
                if days:
                    rrule_params = {'FREQ': 'WEEKLY', 'BYDAY': days}

            if rrule_params:
                component.add('rrule', rrule_params)

            # Add EXDATE for exception dates (skipped occurrences)
            if task.exception_dates:
                for exc_str in task.exception_dates.split(','):
                    exc_str = exc_str.strip()
                    if exc_str:
                        try:
                            exc_date = date.fromisoformat(exc_str)
                            if task.due_time:
                                hour, minute = map(int, task.due_time.split(':')[:2])
                                exc_dt = local_tz.localize(datetime(
                                    exc_date.year, exc_date.month, exc_date.day,
                                    hour, minute
                                ))
                                component.add('exdate', [exc_dt])
                            else:
                                component.add('exdate', [exc_date])
                        except (ValueError, AttributeError):
                            pass

        # Common fields for both types
        if task.category:
            component.add('categories', [task.category.value])

        if task.priority:
            ical_priority = min(max(task.priority, 1), 9)
            component.add('priority', ical_priority)

        # For recurring events, completion means "this occurrence done" not "cancel series"
        # Keep recurring events as CONFIRMED so RRULE generates visible future occurrences
        is_recurring = task.recurrence and task.recurrence != TaskRecurrence.ONCE
        if task.is_completed:
            if is_recurring and is_event:
                # Recurring event: keep CONFIRMED so future occurrences still appear
                component.add('status', 'CONFIRMED')
            else:
                # Non-recurring: use COMPLETED/CANCELLED as usual
                component.add('status', 'COMPLETED' if not is_event else 'CANCELLED')
            if task.completed_at and not is_event:
                component.add('completed', task.completed_at)
        else:
            # VEVENTs use CONFIRMED, VTODOs use NEEDS-ACTION
            component.add('status', 'CONFIRMED' if is_event else 'NEEDS-ACTION')

        component.add('sequence', 0)
        component.add('created', now_utc)
        component.add('dtstamp', now_utc)
        component.add('last-modified', now_utc)
        component.add('x-isaac-task-id', str(task.id))

        # Add VALARM for push notifications on iOS
        # Only add alarms if task.reminder_alerts is explicitly set
        if task.due_date and not task.is_completed and task.reminder_alerts:
            for alert_minutes in task.reminder_alerts:
                alarm = icalendar.Alarm()
                alarm.add('action', 'DISPLAY')
                alarm.add('description', f'Reminder: {sanitize_ical_text(task.title)}')
                # Negative trigger means before the event
                alarm.add('trigger', timedelta(minutes=-alert_minutes))
                component.add_component(alarm)

        cal.add_component(component)
        return cal.to_ical().decode('utf-8')

    def task_to_vevent(self, task: Task) -> str:
        """Alias for task_to_ical for backwards compatibility"""
        return self.task_to_ical(task)

    def vevent_to_task_dict(self, component, component_type: str = None) -> Dict[str, Any]:
        """Convert an iCalendar VEVENT or VTODO to a task dictionary"""
        task_dict = {}

        # Determine task type based on component type
        if component_type == "VTODO" or component.name == "VTODO":
            task_dict['task_type'] = TaskType.TODO
        else:
            task_dict['task_type'] = TaskType.EVENT

        # Title - strip whitespace to handle sanitization artifacts
        summary = component.get('summary')
        if summary:
            task_dict['title'] = str(summary).strip()

        # Description
        description = component.get('description')
        if description:
            task_dict['description'] = str(description)

        # Location
        location = component.get('location')
        if location:
            task_dict['location'] = str(location)

        # Due date - check DUE first (for VTODOs), then DTSTART
        due = component.get('due') or component.get('dtstart')
        if due:
            dt = due.dt
            if isinstance(dt, datetime):
                # Convert to configured timezone before extracting date/time
                # This prevents off-by-one day errors when UTC time is next day
                local_tz = pytz.timezone(self.timezone)
                if dt.tzinfo is not None:
                    dt = dt.astimezone(local_tz)
                else:
                    # Assume UTC if no timezone
                    dt = pytz.UTC.localize(dt).astimezone(local_tz)
                task_dict['due_date'] = dt.date()
                # Extract start time from datetime
                task_dict['due_time'] = dt.strftime('%H:%M')
            elif isinstance(dt, date):
                task_dict['due_date'] = dt

        # End time (from DTEND for VEVENTs)
        dtend = component.get('dtend')
        if dtend:
            dt = dtend.dt
            if isinstance(dt, datetime):
                # Convert to configured timezone before extracting time
                local_tz = pytz.timezone(self.timezone)
                if dt.tzinfo is not None:
                    dt = dt.astimezone(local_tz)
                else:
                    dt = pytz.UTC.localize(dt).astimezone(local_tz)
                task_dict['end_time'] = dt.strftime('%H:%M')

        # Category
        categories = component.get('categories')
        if categories:
            cat_values = categories.cats if hasattr(categories, 'cats') else [str(categories)]
            for cat in cat_values:
                cat_str = str(cat).lower()
                # Try to match to TaskCategory
                for tc in TaskCategory:
                    if tc.value.lower() == cat_str:
                        task_dict['category'] = tc
                        break

        # Priority
        priority = component.get('priority')
        if priority:
            task_dict['priority'] = int(priority)

        # Status
        status = component.get('status')
        if status:
            task_dict['is_completed'] = str(status).upper() == 'COMPLETED'

        # UID for tracking
        uid = component.get('uid')
        if uid:
            task_dict['calendar_uid'] = str(uid)

        # Check if this is a Isaac task
        levi_task_id = component.get('x-isaac-task-id')
        if levi_task_id:
            task_dict['levi_task_id'] = int(str(levi_task_id))

        # Parse RRULE for recurring events
        rrule = component.get('rrule')
        if rrule:
            try:
                freq = rrule.get('FREQ', [None])[0]
                interval = rrule.get('INTERVAL', [1])[0]
                if freq:
                    freq_upper = str(freq).upper()
                    if freq_upper == 'DAILY':
                        task_dict['recurrence'] = TaskRecurrence.DAILY
                    elif freq_upper == 'WEEKLY':
                        if interval and int(interval) == 2:
                            task_dict['recurrence'] = TaskRecurrence.BIWEEKLY
                        else:
                            task_dict['recurrence'] = TaskRecurrence.WEEKLY
                    elif freq_upper == 'MONTHLY':
                        task_dict['recurrence'] = TaskRecurrence.MONTHLY
                    elif freq_upper == 'YEARLY':
                        task_dict['recurrence'] = TaskRecurrence.ANNUALLY
                    if interval and int(interval) > 1 and freq_upper not in ('WEEKLY',):
                        task_dict['recurrence_interval'] = int(interval)
                    logger.debug(f"Parsed RRULE: FREQ={freq}, INTERVAL={interval} -> {task_dict.get('recurrence')}")
            except Exception as e:
                logger.warning(f"Failed to parse RRULE: {e}")

        # Extract last-modified for timestamp comparison
        last_modified = component.get('last-modified')
        if last_modified:
            lm_dt = last_modified.dt
            if isinstance(lm_dt, datetime):
                if lm_dt.tzinfo is None:
                    lm_dt = pytz.UTC.localize(lm_dt)
                task_dict['last_modified'] = lm_dt
            elif isinstance(lm_dt, date):
                task_dict['last_modified'] = datetime.combine(lm_dt, datetime.min.time(), tzinfo=pytz.UTC)

        return task_dict

    async def sync_task_to_calendar(self, task: Task, db: AsyncSession = None, existing_events: Dict[str, str] = None) -> bool:
        """Sync a single task to the calendar.

        Args:
            task: The task to sync
            db: Database session for updating calendar_uid
            existing_events: Optional dict of {title|date: uid} for duplicate detection
        """
        # Skip worker-assigned tasks - they don't go to calendar
        if task.assigned_to_worker_id:
            logger.debug(f"Skipping calendar sync for worker-assigned task {task.id}")
            return True

        calendar = self.get_or_create_calendar()
        if not calendar:
            return False

        try:
            # Check for existing event with same title+date BEFORE creating new one
            # This prevents duplicating events that were created on phone
            if not task.calendar_uid and existing_events is not None:
                task_key = f"{task.title.strip().lower()}|{task.due_date}"
                if task_key in existing_events:
                    # Link to existing event instead of creating duplicate
                    task.calendar_uid = existing_events[task_key]
                    if db:
                        await db.commit()
                    logger.info(f"Linked task '{task.title}' to existing calendar event")
                    return True

            ical_data = self.task_to_ical(task)
            # Use existing calendar_uid if set, otherwise create new isaac-task UID
            uid = task.calendar_uid if task.calendar_uid else f"isaac-task-{task.id}@example.com"
            is_event = task.task_type == TaskType.EVENT if task.task_type else False

            if is_event:
                # Handle VEVENT
                try:
                    existing = calendar.event_by_uid(uid)
                    existing.data = ical_data
                    existing.save()
                    logger.debug(f"Updated calendar event for task {task.id}")
                except caldav.error.NotFoundError:
                    calendar.save_event(ical_data)
                    logger.debug(f"Created calendar event for task {task.id}")
            else:
                # Handle VTODO (reminder)
                # First, try to find existing todo and check its status
                found = False
                try:
                    todos = calendar.todos(include_completed=True)
                    for todo in todos:
                        try:
                            cal = icalendar.Calendar.from_ical(todo.data)
                            for component in cal.walk():
                                if component.name == "VTODO":
                                    todo_uid = str(component.get('uid', ''))
                                    if todo_uid == uid:
                                        # Check if calendar has it marked as completed
                                        cal_status = str(component.get('status', '')).upper()
                                        if cal_status == 'COMPLETED' and not task.is_completed:
                                            # Calendar says completed but our DB says not - don't overwrite
                                            # This means it was completed on phone
                                            logger.debug(f"Skipping update for task {task.id} - completed in calendar")
                                            found = True
                                            break
                                        # Otherwise update it
                                        todo.data = ical_data
                                        todo.save()
                                        logger.debug(f"Updated calendar todo for task {task.id}")
                                        found = True
                                        break
                        except Exception as e:
                            logger.warning(f"Failed to parse existing todo while syncing task {task.id}: {e}")
                        if found:
                            break
                except Exception as e:
                    logger.warning(f"Error searching for existing todo: {e}")

                if not found:
                    # Create new todo
                    calendar.save_todo(ical_data)
                    logger.debug(f"Created calendar todo for task {task.id}")

            # Save the calendar_uid and sync timestamp back to the task
            if db:
                if not task.calendar_uid:
                    task.calendar_uid = uid
                task.calendar_synced_at = datetime.utcnow()
                await db.commit()

            return True

        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to calendar: {e}")
            return False

    async def sync_all_tasks_to_calendar(self, db: AsyncSession, calendar_uids: set = None, force_full: bool = False) -> dict:
        """Sync tasks to the calendar (incremental by default).

        Args:
            db: Database session
            calendar_uids: Set of UIDs currently in the calendar (for deletion detection)
            force_full: If True, sync all tasks regardless of sync status

        Returns:
            dict with counts: synced, deleted, skipped, deleted_by_phone, linked
        """
        from sqlalchemy import or_, and_

        now = datetime.utcnow()
        sync_type = "full" if force_full else "incremental"
        logger.info(f"Starting {sync_type} calendar sync (tasks -> calendar)")
        synced = 0
        deleted = 0
        skipped = 0
        deleted_by_phone = 0
        linked = 0

        # Build dict of existing calendar events for duplicate detection
        # Maps "title|date" -> uid (for events not created by Isaac)
        existing_events: Dict[str, str] = {}
        try:
            calendar_events = await self.get_calendar_events()
            for event in calendar_events:
                uid = event.get('calendar_uid', '')
                # Only track non-Isaac events (to prevent linking to our own events)
                if uid and not uid.startswith('isaac-task-') and not uid.startswith('levi-task-'):
                    title = event.get('title', '').strip().lower()
                    due_date = event.get('due_date')
                    if title and due_date:
                        key = f"{title}|{due_date}"
                        existing_events[key] = uid
            logger.debug(f"Found {len(existing_events)} existing calendar events for duplicate detection")
        except Exception as e:
            logger.warning(f"Could not fetch existing events for duplicate detection: {e}")

        # PART 1: Sync active tasks that need syncing
        # Include:
        # - Incomplete tasks (normal sync)
        # - Completed RECURRING tasks (RRULE shows future occurrences on calendar)
        base_query = (
            select(Task)
            .where(Task.is_active == True)
            .where(
                or_(
                    Task.is_completed == False,
                    # Recurring tasks sync even when completed - RRULE generates future dates
                    and_(
                        Task.is_completed == True,
                        Task.recurrence.isnot(None),
                        Task.recurrence != TaskRecurrence.ONCE,
                    )
                )
            )
            .where(
                or_(
                    Task.due_date >= date.today() - timedelta(days=7),
                    Task.due_date.is_(None),
                    # Recurring tasks sync regardless of due_date - RRULE generates future occurrences
                    and_(
                        Task.recurrence.isnot(None),
                        Task.recurrence != TaskRecurrence.ONCE,
                    )
                )
            )
        )

        # For incremental sync, the hash-based check below handles skipping unchanged tasks.
        # We load all active tasks so that hash algorithm changes (e.g. adding RRULE fields)
        # are detected even without a task update. This is cheap (~50 tasks) vs CalDAV writes.
        # force_full just controls whether we bypass the hash check too.

        result = await db.execute(base_query)
        tasks = result.scalars().all()

        for task in tasks:
            is_app_uid = (
                task.calendar_uid and
                (task.calendar_uid.startswith('isaac-task-') or task.calendar_uid.startswith('levi-task-'))
            )

            # Check if this task was deleted on the phone
            # Only consider "deleted on phone" if the task was previously synced successfully.
            # Tasks that haven't been synced yet (calendar_synced_at is None) should not be
            # deactivated - they just haven't been pushed to the calendar server yet.
            # Only check app-created UIDs for deletion detection (not phone-linked tasks).
            if calendar_uids is not None and task.calendar_uid:
                if is_app_uid and task.calendar_uid not in calendar_uids:
                    if task.calendar_synced_at is not None:
                        task.is_active = False
                        # Clear sync metadata so re-activation won't trigger false deletion detection
                        task.calendar_synced_at = None
                        task.calendar_uid = None
                        deleted_by_phone += 1
                        logger.info(f"Task '{task.title}' was deleted on phone, marking inactive")
                        continue
                    else:
                        logger.debug(f"Task '{task.title}' not in calendar but never synced - will push instead of deactivating")

            # Hash-based change detection - skip if content unchanged (unless force_full)
            current_hash = compute_task_sync_hash(task)
            if not force_full and task.calendar_content_hash == current_hash and task.calendar_uid:
                skipped += 1
                continue

            result = await self.sync_task_to_calendar(task, db, existing_events)
            if result:
                task.calendar_synced_at = now
                task.calendar_content_hash = current_hash  # Store hash after successful sync
                # Check if task was linked to existing event (has non-isaac UID now)
                if task.calendar_uid and not task.calendar_uid.startswith('isaac-task-') and not task.calendar_uid.startswith('levi-task-'):
                    linked += 1
                else:
                    synced += 1

        # PART 2: Delete completed/inactive tasks from calendar
        # Find tasks that were synced to calendar but are now completed or inactive
        # EXCEPTION: Recurring tasks should NOT be deleted when completed - RRULE shows future dates
        # Only get tasks where the hash might have changed (not already processed)
        delete_query = (
            select(Task)
            .where(Task.calendar_uid.isnot(None))  # Has been synced to calendar
            .where(
                or_(
                    # Inactive tasks always get deleted
                    Task.is_active == False,
                    # Completed non-recurring tasks get deleted
                    and_(
                        Task.is_completed == True,
                        or_(
                            Task.recurrence.is_(None),
                            Task.recurrence == TaskRecurrence.ONCE,
                        )
                    )
                )
            )
        )

        result = await db.execute(delete_query)
        tasks_to_delete = result.scalars().all()

        # Pre-fetch todos once for bulk deletion (avoids N+1 network calls)
        cached_todos = None
        tasks_needing_deletion = []

        # Filter to only tasks where hash changed (not already processed as deleted)
        for task in tasks_to_delete:
            current_hash = compute_task_sync_hash(task)
            if task.calendar_content_hash != current_hash:
                tasks_needing_deletion.append((task, current_hash))

        if tasks_needing_deletion:
            try:
                calendar = self.get_or_create_calendar()
                if calendar:
                    cached_todos = calendar.todos(include_completed=True)
                    logger.debug(f"Cached {len(cached_todos)} todos for bulk deletion of {len(tasks_needing_deletion)} tasks")
            except Exception as e:
                logger.warning(f"Could not pre-fetch todos for deletion: {e}")

        for task, current_hash in tasks_needing_deletion:
            # Only delete app-originated tasks (isaac-task-X or levi-task-X)
            is_app_uid = (
                task.calendar_uid and
                (task.calendar_uid.startswith('isaac-task-') or task.calendar_uid.startswith('levi-task-'))
            )
            if is_app_uid:
                if await self.delete_task_from_calendar(task.id, task.calendar_uid, cached_todos=cached_todos):
                    # Update hash - task won't be processed again unless it changes
                    task.calendar_content_hash = current_hash
                    # Clear calendar_synced_at so that if this task is later reactivated
                    # (e.g., by generate_recurring_tasks), it won't be detected as
                    # "deleted on phone" — it was deleted by the app, not the phone.
                    task.calendar_synced_at = None
                    deleted += 1
                    logger.debug(f"Deleted completed/inactive task '{task.title}' from calendar")

        # Commit all changes
        await db.commit()

        logger.info(f"Calendar {sync_type} sync complete: {synced} synced, {linked} linked, {deleted} deleted, {skipped} skipped, {deleted_by_phone} deleted by phone")
        return {"synced": synced, "linked": linked, "deleted": deleted, "skipped": skipped, "deleted_by_phone": deleted_by_phone}

    async def get_calendar_events(
        self,
        start_date: date = None,
        end_date: date = None,
    ) -> List[Dict[str, Any]]:
        """Get events and todos from the calendar"""
        calendar = self.get_or_create_calendar()
        if not calendar:
            return []

        if not start_date:
            start_date = date.today() - timedelta(days=7)
        if not end_date:
            end_date = date.today() + timedelta(days=90)

        result = []
        seen_uids = set()

        # Get VEVENTs via date_search
        try:
            events = calendar.date_search(
                start=datetime.combine(start_date, datetime.min.time()),
                end=datetime.combine(end_date, datetime.max.time()),
            )

            for event in events:
                try:
                    cal = icalendar.Calendar.from_ical(event.data)
                    for component in cal.walk():
                        if component.name == "VEVENT":
                            task_dict = self.vevent_to_task_dict(component)
                            if task_dict.get('title'):
                                uid = task_dict.get('calendar_uid')
                                # Skip expanded occurrences of recurring events
                                # CalDAV date_search expands RRULE events into individual
                                # occurrences with RECURRENCE-ID. We only want the base
                                # recurring event - Isaac handles recurrence natively.
                                recurrence_id = component.get('recurrence-id')
                                if recurrence_id:
                                    logger.debug(f"Skipping expanded occurrence of recurring event {uid}")
                                    continue

                                if uid and uid not in seen_uids:
                                    seen_uids.add(uid)
                                    result.append(task_dict)
                except Exception as e:
                    logger.warning(f"Failed to parse calendar event: {e}")

        except Exception as e:
            logger.error(f"Failed to get calendar events: {e}")

        # Get VTODOs (reminders) separately - caldav date_search may not return them
        try:
            todos = calendar.todos(include_completed=True)

            for todo in todos:
                try:
                    cal = icalendar.Calendar.from_ical(todo.data)
                    for component in cal.walk():
                        if component.name == "VTODO":
                            task_dict = self.vevent_to_task_dict(component)
                            if task_dict.get('title'):
                                uid = task_dict.get('calendar_uid')
                                if uid and uid not in seen_uids:
                                    seen_uids.add(uid)
                                    result.append(task_dict)
                except Exception as e:
                    logger.warning(f"Failed to parse calendar todo: {e}")

        except Exception as e:
            logger.warning(f"Failed to get calendar todos: {e}")

        return result

    async def sync_calendar_to_tasks(self, db: AsyncSession) -> dict:
        """Sync calendar events to Isaac tasks (bi-directional with deletion detection)"""
        logger.info("Starting calendar sync (calendar -> tasks)")
        events = await self.get_calendar_events()

        # Build set of UIDs currently in calendar
        calendar_uids = set()
        for event_dict in events:
            uid = event_dict.get('calendar_uid')
            if uid:
                calendar_uids.add(uid)

        created = 0
        updated = 0
        deleted = 0

        for event_dict in events:
            calendar_uid = event_dict.get('calendar_uid')
            if not calendar_uid:
                continue

            # For Isaac/Levi-originated tasks, sync all editable fields from calendar
            # Full bi-directional sync - phone edits sync back to app
            # Check for both isaac-task- and levi-task- prefixes (legacy UIDs use levi-task-)
            is_app_originated = (
                calendar_uid.startswith('isaac-task-') or
                calendar_uid.startswith('levi-task-') or
                event_dict.get('levi_task_id')
            )
            if is_app_originated:
                # Try to find task by calendar_uid first, then by task ID from X-ISAAC-TASK-ID
                result = await db.execute(
                    select(Task).where(Task.calendar_uid == calendar_uid)
                )
                existing_task = result.scalar_one_or_none()
                found_by_uid = existing_task is not None

                # If not found by UID but we have the task ID, look up by ID
                if not existing_task and event_dict.get('levi_task_id'):
                    result = await db.execute(
                        select(Task).where(Task.id == event_dict['levi_task_id'])
                    )
                    existing_task = result.scalar_one_or_none()
                    # Only link calendar_uid if task doesn't already have one
                    # If task has a different calendar_uid, skip this event to avoid overwriting wrong task
                    if existing_task:
                        if existing_task.calendar_uid and existing_task.calendar_uid != calendar_uid:
                            # Task already linked to a different calendar event - skip
                            logger.debug(f"Skipping event {calendar_uid} - task {existing_task.id} already linked to {existing_task.calendar_uid}")
                            continue
                        if not existing_task.calendar_uid:
                            # Check if this calendar_uid is already used by another task (prevent UNIQUE constraint error)
                            uid_check = await db.execute(
                                select(Task).where(Task.calendar_uid == calendar_uid)
                            )
                            if uid_check.scalar_one_or_none():
                                logger.warning(f"Calendar UID {calendar_uid} already assigned to another task, skipping link to task {existing_task.id}")
                                continue
                            existing_task.calendar_uid = calendar_uid
                            logger.info(f"Linked calendar UID {calendar_uid} to task {existing_task.id}")
                            found_by_uid = True  # Now it's linked, treat as found by UID

                if existing_task and found_by_uid:
                    changed = False
                    old_title = existing_task.title

                    # Compare timestamps to determine if phone has newer data
                    calendar_modified = event_dict.get('last_modified')
                    task_synced = existing_task.calendar_synced_at
                    task_updated = existing_task.updated_at

                    # Use the later of synced_at or updated_at as the task's "last known" time
                    if task_synced and task_updated:
                        task_last_known = max(task_synced, task_updated)
                    else:
                        task_last_known = task_synced or task_updated

                    # Make task_last_known timezone-aware if needed
                    if task_last_known and task_last_known.tzinfo is None:
                        task_last_known = pytz.UTC.localize(task_last_known)

                    # Only sync from phone if calendar was modified after our last sync/update
                    phone_is_newer = (
                        calendar_modified is not None and
                        (task_last_known is None or calendar_modified > task_last_known)
                    )

                    if phone_is_newer:
                        # Sync title from phone - strip both for comparison to avoid whitespace-only changes
                        phone_title = event_dict.get('title')
                        if phone_title and (existing_task.title or '').strip() != phone_title.strip():
                            existing_task.title = phone_title.strip()
                            changed = True
                            logger.info(f"Task title updated from phone: '{old_title}' -> '{phone_title}'")

                        # Sync due_date from phone
                        phone_date = event_dict.get('due_date')
                        if phone_date and existing_task.due_date != phone_date:
                            existing_task.due_date = phone_date
                            changed = True
                            logger.info(f"Task '{existing_task.title}' date updated from phone: {phone_date}")

                        # Sync due_time from phone
                        phone_time = event_dict.get('due_time')
                        if phone_time and existing_task.due_time != phone_time:
                            existing_task.due_time = phone_time
                            changed = True
                            logger.info(f"Task '{existing_task.title}' time updated from phone: {phone_time}")

                        # Sync end_time from phone
                        phone_end = event_dict.get('end_time')
                        if phone_end and existing_task.end_time != phone_end:
                            existing_task.end_time = phone_end
                            changed = True

                        # Sync location from phone
                        phone_location = event_dict.get('location')
                        if phone_location and existing_task.location != phone_location:
                            existing_task.location = phone_location
                            changed = True
                            logger.info(f"Task '{existing_task.title}' location updated from phone: {phone_location}")

                        # Sync description from phone
                        phone_description = event_dict.get('description')
                        if phone_description and existing_task.description != phone_description:
                            existing_task.description = phone_description
                            changed = True

                    # Check if this task was completed on the phone (always check, regardless of timestamp)
                    if event_dict.get('is_completed') and not existing_task.is_completed:
                        # Only mark as phone-completed if task was due today or earlier
                        local_tz = pytz.timezone(self.timezone)
                        today = datetime.now(local_tz).date()
                        task_due = existing_task.due_date

                        if task_due and task_due > today:
                            logger.warning(f"Ignoring phone completion for future task '{existing_task.title}' (due {task_due})")
                        else:
                            existing_task.is_completed = True
                            existing_task.completed_at = datetime.now(pytz.UTC)
                            changed = True
                            logger.info(f"Task '{existing_task.title}' completed on phone")
                            await self.delete_task_from_calendar(existing_task.id, calendar_uid)

                    if changed:
                        updated += 1
                # Skip importing as new task - app originated tasks already exist
                continue

            # Check if we already have this event as a task
            result = await db.execute(
                select(Task).where(Task.calendar_uid == calendar_uid)
            )
            existing_task = result.scalar_one_or_none()

            if existing_task:
                # Update existing task
                changed = False
                if event_dict.get('title') and existing_task.title != event_dict['title']:
                    existing_task.title = event_dict['title']
                    changed = True
                if event_dict.get('description') and existing_task.description != event_dict.get('description'):
                    existing_task.description = event_dict['description']
                    changed = True
                if event_dict.get('due_date') and existing_task.due_date != event_dict.get('due_date'):
                    existing_task.due_date = event_dict['due_date']
                    changed = True
                if event_dict.get('due_time') and existing_task.due_time != event_dict.get('due_time'):
                    existing_task.due_time = event_dict['due_time']
                    changed = True
                if event_dict.get('end_time') and existing_task.end_time != event_dict.get('end_time'):
                    existing_task.end_time = event_dict['end_time']
                    changed = True
                if event_dict.get('location') and existing_task.location != event_dict.get('location'):
                    existing_task.location = event_dict['location']
                    changed = True
                if event_dict.get('recurrence') and existing_task.recurrence != event_dict.get('recurrence'):
                    existing_task.recurrence = event_dict['recurrence']
                    changed = True
                if event_dict.get('recurrence_interval') and existing_task.recurrence_interval != event_dict.get('recurrence_interval'):
                    existing_task.recurrence_interval = event_dict['recurrence_interval']
                    changed = True
                # IMPORTANT: Only sync is_completed=True from calendar to task (phone completion)
                # Never reset is_completed to False based on calendar data - this prevents
                # calendar edits from accidentally resetting completion status
                if event_dict.get('is_completed') and not existing_task.is_completed:
                    existing_task.is_completed = True
                    existing_task.completed_at = datetime.now(pytz.UTC)
                    changed = True
                    logger.info(f"Task '{existing_task.title}' marked complete from calendar sync")
                if changed:
                    logger.info(f"Updated existing task '{existing_task.title}' from calendar (uid={calendar_uid})")
                    updated += 1
            else:
                # Create new task from calendar event
                logger.info(f"Creating new task from calendar event: '{event_dict.get('title', 'Calendar Event')}' (uid={calendar_uid})")
                new_task = Task(
                    title=event_dict.get('title', 'Calendar Event'),
                    description=event_dict.get('description'),
                    task_type=event_dict.get('task_type', TaskType.TODO),
                    due_date=event_dict.get('due_date'),
                    due_time=event_dict.get('due_time'),
                    end_time=event_dict.get('end_time'),
                    location=event_dict.get('location'),
                    category=event_dict.get('category', TaskCategory.OTHER),
                    priority=event_dict.get('priority', 3),
                    is_completed=event_dict.get('is_completed', False),
                    calendar_uid=calendar_uid,
                    recurrence=event_dict.get('recurrence', TaskRecurrence.ONCE),
                    recurrence_interval=event_dict.get('recurrence_interval'),
                    is_active=True,
                )
                db.add(new_task)
                created += 1

        # Detect deletions: tasks with calendar_uid that no longer exist in calendar
        # Only check tasks that were imported from calendar (have calendar_uid but no isaac-task UID pattern)
        result = await db.execute(
            select(Task)
            .where(Task.calendar_uid.isnot(None))
            .where(Task.is_active == True)
        )
        tasks_with_uid = result.scalars().all()

        for task in tasks_with_uid:
            # Skip tasks that originated from app (they have isaac-task-X or levi-task-X pattern)
            if task.calendar_uid and (
                task.calendar_uid.startswith('isaac-task-') or
                task.calendar_uid.startswith('levi-task-')
            ):
                continue
            # If this task's calendar_uid is no longer in calendar, mark as deleted
            if task.calendar_uid and task.calendar_uid not in calendar_uids:
                task.is_active = False
                deleted += 1
                logger.info(f"Marked task '{task.title}' as deleted (removed from calendar)")

        await db.commit()
        logger.info(f"Calendar sync: {created} created, {updated} updated, {deleted} deleted")
        return {"created": created, "updated": updated, "deleted": deleted}

    async def delete_task_from_calendar(self, task_id: int, calendar_uid: str = None, task_type: TaskType = None, cached_todos: list = None) -> bool:
        """Delete a task's calendar event or todo.

        Args:
            task_id: The task ID (used to build isaac-task UID if calendar_uid not provided)
            calendar_uid: The actual calendar UID (for iPhone-originated items)
            task_type: Optional task type hint
            cached_todos: Pre-fetched list of calendar todos (to avoid repeated network calls)
        """
        calendar = self.get_or_create_calendar()
        if not calendar:
            return False

        # Use provided calendar_uid, or build from task_id
        uid = calendar_uid if calendar_uid else f"isaac-task-{task_id}@example.com"
        deleted = False

        # Try to delete as VEVENT first
        try:
            event = calendar.event_by_uid(uid)
            event.delete()
            logger.debug(f"Deleted calendar event for task {task_id}")
            deleted = True
        except caldav.error.NotFoundError:
            pass
        except Exception as e:
            logger.warning(f"Could not delete as event: {e}")

        # If not found as event, try as VTODO
        if not deleted:
            try:
                # Use cached todos if provided, otherwise fetch (for single deletes)
                todos = cached_todos if cached_todos is not None else calendar.todos(include_completed=True)
                for todo in todos:
                    try:
                        cal = icalendar.Calendar.from_ical(todo.data)
                        for component in cal.walk():
                            if component.name == "VTODO":
                                todo_uid = str(component.get('uid', ''))
                                if todo_uid == uid:
                                    todo.delete()
                                    logger.debug(f"Deleted calendar todo for task {task_id}")
                                    deleted = True
                                    break
                    except Exception as e:
                        logger.warning(f"Failed to parse todo data while searching for deletion (task {task_id}): {e}")
                    if deleted:
                        break
            except Exception as e:
                logger.warning(f"Could not delete as todo: {e}")

        if not deleted:
            logger.debug(f"Task {task_id} not found in calendar (may already be deleted)")

        return True  # Return True even if not found - task may have never been synced


# Cache for calendar service singleton
_calendar_service_cache: Optional[CalendarSyncService] = None
_calendar_service_config_hash: Optional[str] = None
# Track bad config to avoid repeated warnings
_calendar_bad_config_logged: bool = False


async def get_calendar_service(db: AsyncSession) -> Optional[CalendarSyncService]:
    """Get a configured calendar sync service from settings (cached singleton)"""
    global _calendar_service_cache, _calendar_service_config_hash, _calendar_bad_config_logged

    enabled = await get_calendar_setting(db, "calendar_enabled")
    if enabled != "true":
        _calendar_service_cache = None
        _calendar_bad_config_logged = False
        return None

    url = await get_calendar_setting(db, "calendar_url")
    username = await get_calendar_setting(db, "calendar_username")
    password = await get_calendar_setting(db, "calendar_password")
    calendar_name = await get_calendar_setting(db, "calendar_name")

    if not all([url, username, password]):
        if not _calendar_bad_config_logged:
            _calendar_bad_config_logged = True
            logger.warning("Calendar sync enabled but not fully configured (missing url, username, or password). Re-enter calendar password in Settings if encryption key changed.")
        _calendar_service_cache = None
        return None

    # Config is good now, reset the bad config flag
    _calendar_bad_config_logged = False

    # Get timezone from app settings
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "timezone")
    )
    tz_setting = result.scalar_one_or_none()
    timezone = tz_setting.value if tz_setting and tz_setting.value else "America/New_York"

    # Check if we can reuse cached service (same config)
    config_hash = f"{url}|{username}|{password}|{calendar_name}|{timezone}"
    if _calendar_service_cache and _calendar_service_config_hash == config_hash:
        return _calendar_service_cache

    # Create new service and cache it
    logger.info(f"Creating new CalendarSyncService for {url} (calendar: {calendar_name}, tz: {timezone})")
    _calendar_service_cache = CalendarSyncService(
        url=url,
        username=username,
        password=password,
        calendar_name=calendar_name or "My Farm",
        timezone=timezone,
    )
    _calendar_service_config_hash = config_hash
    return _calendar_service_cache
