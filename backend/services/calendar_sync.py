"""
Calendar Sync Service
Bi-directional sync between Levi tasks and CalDAV calendars (Proton, etc.)
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

from models.tasks import Task, TaskCategory, TaskType
from models.settings import AppSetting


# Default settings
DEFAULT_CALENDAR_SETTINGS = {
    "calendar_enabled": "false",
    "calendar_url": "http://127.0.0.1:5232",
    "calendar_username": "",
    "calendar_password": "",
    "calendar_name": "Mealey Family Farm",
    "calendar_sync_interval": "30",  # minutes
}


async def get_calendar_setting(db: AsyncSession, key: str) -> str:
    """Get a calendar setting from the database"""
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value is not None:
        return setting.value
    return DEFAULT_CALENDAR_SETTINGS.get(key, "")


class CalendarSyncService:
    """Service for syncing tasks with CalDAV calendars"""

    def __init__(
        self,
        url: str,
        username: str,
        password: str,
        calendar_name: str = "Mealey Family Farm",
    ):
        self.url = url
        self.username = username
        self.password = password
        self.calendar_name = calendar_name
        self._client: Optional[caldav.DAVClient] = None
        self._calendar: Optional[caldav.Calendar] = None

    def connect(self) -> bool:
        """Connect to the CalDAV server"""
        try:
            self._client = caldav.DAVClient(
                url=self.url,
                username=self.username,
                password=self.password,
            )
            principal = self._client.principal()
            logger.info(f"Connected to CalDAV server: {self.url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to CalDAV server: {e}")
            return False

    def get_or_create_calendar(self) -> Optional[caldav.Calendar]:
        """Get the Levi calendar, or create it if it doesn't exist"""
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
        """Convert a Levi task to iCalendar format (VEVENT for events, VTODO for todos)"""
        cal = icalendar.Calendar()
        cal.add('prodid', '-//Levi Farm Assistant//mealey.family//')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')  # Required for iOS compatibility

        # Determine if this is a VTODO or VEVENT
        # Events have task_type=EVENT, Todos have task_type=TODO (or no type)
        is_event = task.task_type == TaskType.EVENT if task.task_type else False

        # Use existing calendar_uid if set, otherwise create new levi-task UID
        uid = task.calendar_uid if task.calendar_uid else f"levi-task-{task.id}@mealey.family"
        now_utc = datetime.now(pytz.UTC)
        eastern = pytz.timezone('America/New_York')

        if is_event:
            # Create VEVENT for calendar events
            component = icalendar.Event()
            component.add('uid', uid)
            component.add('summary', task.title)

            if task.description:
                component.add('description', task.description)
            if task.location:
                component.add('location', task.location)

            # Date and Time handling
            if task.due_date:
                if task.due_time:
                    try:
                        hour, minute = map(int, task.due_time.split(':')[:2])
                        start_dt = eastern.localize(datetime(
                            task.due_date.year, task.due_date.month, task.due_date.day,
                            hour, minute
                        ))
                        component.add('dtstart', start_dt)

                        if task.end_time:
                            end_hour, end_minute = map(int, task.end_time.split(':')[:2])
                            end_dt = eastern.localize(datetime(
                                task.due_date.year, task.due_date.month, task.due_date.day,
                                end_hour, end_minute
                            ))
                            if end_dt <= start_dt:
                                end_dt = end_dt + timedelta(days=1)
                        else:
                            end_dt = start_dt + timedelta(hours=1)
                        component.add('dtend', end_dt)
                    except (ValueError, AttributeError):
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
            component.add('summary', task.title)

            if task.description:
                component.add('description', task.description)
            if task.location:
                component.add('location', task.location)

            # Due date/time for todos (optional)
            if task.due_date:
                if task.due_time:
                    try:
                        hour, minute = map(int, task.due_time.split(':')[:2])
                        due_dt = eastern.localize(datetime(
                            task.due_date.year, task.due_date.month, task.due_date.day,
                            hour, minute
                        ))
                        component.add('due', due_dt)
                    except (ValueError, AttributeError):
                        component.add('due', task.due_date)
                else:
                    component.add('due', task.due_date)

        # Common fields for both types
        if task.category:
            component.add('categories', [task.category.value])

        if task.priority:
            ical_priority = min(max(task.priority, 1), 9)
            component.add('priority', ical_priority)

        if task.is_completed:
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
        component.add('x-levi-task-id', str(task.id))

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

        # Title
        summary = component.get('summary')
        if summary:
            task_dict['title'] = str(summary)

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

        # Check if this is a Levi task
        levi_task_id = component.get('x-levi-task-id')
        if levi_task_id:
            task_dict['levi_task_id'] = int(str(levi_task_id))

        return task_dict

    async def sync_task_to_calendar(self, task: Task, db: AsyncSession = None) -> bool:
        """Sync a single task to the calendar"""
        calendar = self.get_or_create_calendar()
        if not calendar:
            return False

        try:
            ical_data = self.task_to_ical(task)
            # Use existing calendar_uid if set, otherwise create new levi-task UID
            uid = task.calendar_uid if task.calendar_uid else f"levi-task-{task.id}@mealey.family"
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
                        except Exception:
                            pass
                        if found:
                            break
                except Exception as e:
                    logger.warning(f"Error searching for existing todo: {e}")

                if not found:
                    # Create new todo
                    calendar.save_todo(ical_data)
                    logger.debug(f"Created calendar todo for task {task.id}")

            # Save the calendar_uid back to the task if we have a db session
            if db and not task.calendar_uid:
                task.calendar_uid = uid
                await db.commit()

            return True

        except Exception as e:
            logger.error(f"Failed to sync task {task.id} to calendar: {e}")
            return False

    async def sync_all_tasks_to_calendar(self, db: AsyncSession, calendar_uids: set = None) -> int:
        """Sync all active tasks to the calendar.

        Args:
            db: Database session
            calendar_uids: Set of UIDs currently in the calendar (for deletion detection)
        """
        from sqlalchemy import or_
        result = await db.execute(
            select(Task)
            .where(Task.is_active == True)
            .where(Task.is_completed == False)
            .where(
                or_(
                    Task.due_date >= date.today() - timedelta(days=7),  # Include recent dated tasks
                    Task.due_date.is_(None),  # Include undated todos
                )
            )
        )
        tasks = result.scalars().all()

        synced = 0
        deleted_by_phone = 0

        for task in tasks:
            # Skip tasks that were imported from phone (have a non-levi UID)
            # They already exist in the calendar, don't push duplicates
            if task.calendar_uid and not task.calendar_uid.startswith('levi-task-'):
                logger.debug(f"Skipping imported task '{task.title}' - already in calendar")
                continue

            # Check if this task was deleted on the phone
            # If task has a levi-task UID and it's not in the calendar, it was deleted on phone
            if calendar_uids is not None and task.calendar_uid:
                if task.calendar_uid.startswith('levi-task-') and task.calendar_uid not in calendar_uids:
                    # Task was deleted on phone - mark as inactive in webapp
                    task.is_active = False
                    deleted_by_phone += 1
                    logger.info(f"Task '{task.title}' was deleted on phone, marking inactive")
                    continue

            if await self.sync_task_to_calendar(task, db):
                synced += 1

        if deleted_by_phone > 0:
            await db.commit()

        logger.info(f"Synced {synced}/{len(tasks)} tasks to calendar, {deleted_by_phone} deleted by phone")
        return synced

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
        """Sync calendar events to Levi tasks (bi-directional with deletion detection)"""
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

            # For Levi-originated tasks, sync completion status back from calendar
            if calendar_uid.startswith('levi-task-') or event_dict.get('levi_task_id'):
                # Check if this task was completed on the phone
                if event_dict.get('is_completed'):
                    result = await db.execute(
                        select(Task).where(Task.calendar_uid == calendar_uid)
                    )
                    existing_task = result.scalar_one_or_none()
                    if existing_task and not existing_task.is_completed:
                        existing_task.is_completed = True
                        existing_task.completed_at = datetime.now(pytz.UTC)
                        updated += 1
                        logger.info(f"Task '{existing_task.title}' completed on phone")
                        # Delete the completed task from calendar so it doesn't re-sync
                        await self.delete_task_from_calendar(existing_task.id, calendar_uid)
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
                if event_dict.get('is_completed') is not None and existing_task.is_completed != event_dict['is_completed']:
                    existing_task.is_completed = event_dict['is_completed']
                    changed = True
                if changed:
                    updated += 1
            else:
                # Create new task from calendar event
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
                    is_active=True,
                )
                db.add(new_task)
                created += 1

        # Detect deletions: tasks with calendar_uid that no longer exist in calendar
        # Only check tasks that were imported from calendar (have calendar_uid but no levi-task UID pattern)
        result = await db.execute(
            select(Task)
            .where(Task.calendar_uid.isnot(None))
            .where(Task.is_active == True)
        )
        tasks_with_uid = result.scalars().all()

        for task in tasks_with_uid:
            # Skip tasks that originated from Levi (they have levi-task-X pattern)
            if task.calendar_uid and task.calendar_uid.startswith('levi-task-'):
                continue
            # If this task's calendar_uid is no longer in calendar, mark as deleted
            if task.calendar_uid and task.calendar_uid not in calendar_uids:
                task.is_active = False
                deleted += 1
                logger.info(f"Marked task '{task.title}' as deleted (removed from calendar)")

        await db.commit()
        logger.info(f"Calendar sync: {created} created, {updated} updated, {deleted} deleted")
        return {"created": created, "updated": updated, "deleted": deleted}

    async def delete_task_from_calendar(self, task_id: int, calendar_uid: str = None, task_type: TaskType = None) -> bool:
        """Delete a task's calendar event or todo.

        Args:
            task_id: The task ID (used to build levi-task UID if calendar_uid not provided)
            calendar_uid: The actual calendar UID (for iPhone-originated items)
            task_type: Optional task type hint
        """
        calendar = self.get_or_create_calendar()
        if not calendar:
            return False

        # Use provided calendar_uid, or build from task_id
        uid = calendar_uid if calendar_uid else f"levi-task-{task_id}@mealey.family"
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
                # Search through todos to find the one with matching UID
                todos = calendar.todos(include_completed=True)
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
                    except Exception:
                        pass
                    if deleted:
                        break
            except Exception as e:
                logger.warning(f"Could not delete as todo: {e}")

        if not deleted:
            logger.debug(f"Task {task_id} not found in calendar (may already be deleted)")

        return True  # Return True even if not found - task may have never been synced


async def get_calendar_service(db: AsyncSession) -> Optional[CalendarSyncService]:
    """Get a configured calendar sync service from settings"""
    enabled = await get_calendar_setting(db, "calendar_enabled")
    if enabled != "true":
        return None

    url = await get_calendar_setting(db, "calendar_url")
    username = await get_calendar_setting(db, "calendar_username")
    password = await get_calendar_setting(db, "calendar_password")
    calendar_name = await get_calendar_setting(db, "calendar_name")

    if not all([url, username, password]):
        logger.warning("Calendar sync enabled but not fully configured")
        return None

    return CalendarSyncService(
        url=url,
        username=username,
        password=password,
        calendar_name=calendar_name or "Mealey Family Farm",
    )
