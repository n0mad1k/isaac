"""
CalDAV Sync Service
Synchronizes Isaac tasks with CalDAV calendars (Proton, iCloud, Google, etc.)
"""

import caldav
from datetime import datetime, timedelta
from typing import Optional, List
from loguru import logger
import uuid

from config import settings


class CalDAVService:
    """Service for syncing tasks with CalDAV calendars"""

    def __init__(self):
        self.client: Optional[caldav.DAVClient] = None
        self.calendar: Optional[caldav.Calendar] = None
        self._initialized = False

    def is_configured(self) -> bool:
        """Check if CalDAV is configured"""
        return bool(
            settings.caldav_url
            and settings.caldav_username
            and settings.caldav_password
        )

    async def connect(self) -> bool:
        """Connect to CalDAV server"""
        if not self.is_configured():
            logger.warning("CalDAV not configured")
            return False

        try:
            self.client = caldav.DAVClient(
                url=settings.caldav_url,
                username=settings.caldav_username,
                password=settings.caldav_password,
            )
            principal = self.client.principal()
            calendars = principal.calendars()

            # Find or create the Isaac calendar
            for cal in calendars:
                if cal.name == settings.caldav_calendar_name:
                    self.calendar = cal
                    break

            if not self.calendar:
                # Create the calendar if it doesn't exist
                try:
                    self.calendar = principal.make_calendar(
                        name=settings.caldav_calendar_name
                    )
                    logger.info(f"Created CalDAV calendar: {settings.caldav_calendar_name}")
                except Exception as e:
                    # Some servers don't support calendar creation
                    logger.warning(f"Could not create calendar, using first available: {e}")
                    if calendars:
                        self.calendar = calendars[0]
                    else:
                        logger.error("No calendars available")
                        return False

            self._initialized = True
            logger.info(f"Connected to CalDAV server, using calendar: {self.calendar.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to CalDAV server: {e}")
            return False

    def _task_to_vtodo(self, task) -> str:
        """Convert a Isaac task to VTODO format"""
        uid = f"isaac-task-{task.id}@{settings.app_name.lower()}"

        # Priority mapping (Isaac: 1=high, 2=medium, 3=low -> RFC 5545: 1=high, 5=medium, 9=low)
        priority_map = {1: 1, 2: 5, 3: 9}
        priority = priority_map.get(task.priority, 5)

        # Status mapping
        status = "COMPLETED" if task.is_completed else "NEEDS-ACTION"

        # Build VTODO
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            f"PRODID:-//Isaac Farm Assistant//EN",
            "BEGIN:VTODO",
            f"UID:{uid}",
            f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
            f"SUMMARY:{task.title}",
            f"PRIORITY:{priority}",
            f"STATUS:{status}",
        ]

        if task.description:
            # Escape special characters in description
            desc = task.description.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,")
            lines.append(f"DESCRIPTION:{desc}")

        if task.due_date:
            due_str = task.due_date.strftime("%Y%m%d")
            if task.due_time:
                try:
                    time_parts = task.due_time.split(":")
                    due_str += f"T{time_parts[0]:0>2}{time_parts[1]:0>2}00"
                except:
                    pass
            lines.append(f"DUE:{due_str}")

        if task.is_completed and task.completed_at:
            lines.append(f"COMPLETED:{task.completed_at.strftime('%Y%m%dT%H%M%SZ')}")

        # Add category
        category_names = {
            "plant_care": "Plant Care",
            "animal_care": "Animal Care",
            "home_maintenance": "Home Maintenance",
            "garden": "Garden",
            "equipment": "Equipment",
            "seasonal": "Seasonal",
            "custom": "Custom",
        }
        cat_name = category_names.get(task.category.value if hasattr(task.category, 'value') else task.category, "Tasks")
        lines.append(f"CATEGORIES:{cat_name}")

        # Add VALARMs for reminder_alerts
        if task.reminder_alerts and task.due_date:
            for minutes in task.reminder_alerts:
                lines.append("BEGIN:VALARM")
                lines.append("ACTION:DISPLAY")
                lines.append(f"DESCRIPTION:Reminder: {task.title}")
                # Convert minutes to ISO 8601 duration
                if minutes == 0:
                    lines.append("TRIGGER:PT0S")
                elif minutes >= 1440 and minutes % 1440 == 0:
                    days = minutes // 1440
                    lines.append(f"TRIGGER:-P{days}D")
                elif minutes >= 60 and minutes % 60 == 0:
                    hours = minutes // 60
                    lines.append(f"TRIGGER:-PT{hours}H")
                else:
                    lines.append(f"TRIGGER:-PT{minutes}M")
                lines.append("END:VALARM")

        lines.extend([
            "END:VTODO",
            "END:VCALENDAR",
        ])

        return "\r\n".join(lines)

    async def sync_task(self, task) -> bool:
        """Sync a single task to CalDAV"""
        if not self._initialized:
            if not await self.connect():
                return False

        try:
            vtodo = self._task_to_vtodo(task)
            uid = f"isaac-task-{task.id}@{settings.app_name.lower()}"

            # Try to find existing event
            try:
                existing = self.calendar.todo_by_uid(uid)
                if existing:
                    existing.data = vtodo
                    existing.save()
                    logger.debug(f"Updated CalDAV task: {task.title}")
                    return True
            except caldav.error.NotFoundError:
                pass

            # Create new task
            self.calendar.save_todo(vtodo)
            logger.debug(f"Created CalDAV task: {task.title}")
            return True

        except Exception as e:
            logger.error(f"Failed to sync task to CalDAV: {e}")
            return False

    async def delete_task(self, task_id: int) -> bool:
        """Delete a task from CalDAV"""
        if not self._initialized:
            if not await self.connect():
                return False

        try:
            uid = f"isaac-task-{task_id}@{settings.app_name.lower()}"
            existing = self.calendar.todo_by_uid(uid)
            if existing:
                existing.delete()
                logger.debug(f"Deleted CalDAV task: {task_id}")
            return True
        except caldav.error.NotFoundError:
            return True  # Already doesn't exist
        except Exception as e:
            logger.error(f"Failed to delete CalDAV task: {e}")
            return False

    async def sync_all_tasks(self, tasks: List) -> dict:
        """Sync all tasks to CalDAV"""
        if not self._initialized:
            if not await self.connect():
                return {"success": False, "message": "Could not connect to CalDAV"}

        synced = 0
        failed = 0

        for task in tasks:
            if await self.sync_task(task):
                synced += 1
            else:
                failed += 1

        logger.info(f"CalDAV sync complete: {synced} synced, {failed} failed")
        return {
            "success": True,
            "synced": synced,
            "failed": failed,
        }

    async def get_remote_tasks(self) -> List[dict]:
        """Get all tasks from CalDAV (for bidirectional sync in future)"""
        if not self._initialized:
            if not await self.connect():
                return []

        try:
            todos = self.calendar.todos()
            tasks = []
            for todo in todos:
                # Parse the VTODO
                try:
                    vobj = todo.vobject_instance.vtodo
                    tasks.append({
                        "uid": str(vobj.uid.value) if hasattr(vobj, 'uid') else None,
                        "summary": str(vobj.summary.value) if hasattr(vobj, 'summary') else None,
                        "description": str(vobj.description.value) if hasattr(vobj, 'description') else None,
                        "due": vobj.due.value if hasattr(vobj, 'due') else None,
                        "status": str(vobj.status.value) if hasattr(vobj, 'status') else None,
                    })
                except Exception as e:
                    logger.warning(f"Could not parse CalDAV todo: {e}")
            return tasks
        except Exception as e:
            logger.error(f"Failed to get CalDAV tasks: {e}")
            return []


# Global instance
caldav_service = CalDAVService()
