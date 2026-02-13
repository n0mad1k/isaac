"""
Health Monitor Service
Monitors system health and sends alerts when issues are detected.
"""

import asyncio
import aiohttp
import psutil
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text
from loguru import logger

from config import settings


class HealthStatus:
    """Health check status constants"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    # Note: UNKNOWN has been removed - if status cannot be determined, use CRITICAL
    # For disabled/not-configured services, use HEALTHY with appropriate message


class HealthCheck:
    """Individual health check result"""
    def __init__(self, name: str, status: str, message: str, value: Optional[float] = None):
        self.name = name
        self.status = status
        self.message = message
        self.value = value
        self.checked_at = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
            "value": self.value,
            "checked_at": self.checked_at.isoformat()
        }


class HealthMonitor:
    """
    Health monitoring service that performs periodic health checks
    and sends alerts when issues are detected.
    """

    def __init__(self):
        self.last_alert_time: Dict[str, datetime] = {}
        self.alert_cooldown_minutes = 15  # Don't spam alerts
        self.consecutive_failures: Dict[str, int] = {}

    async def check_api_health(self) -> HealthCheck:
        """Check if the API is responding"""
        try:
            # Health monitoring runs on prod (port 8000)
            port = 8000
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"http://127.0.0.1:{port}/health"
                async with session.get(url) as response:
                    if response.status == 200:
                        return HealthCheck("api", HealthStatus.HEALTHY, f"API responding on port {port}")
                    else:
                        return HealthCheck("api", HealthStatus.WARNING, f"API returned status {response.status}")
        except asyncio.TimeoutError:
            return HealthCheck("api", HealthStatus.CRITICAL, "API request timed out")
        except Exception as e:
            logger.error(f"API health check failed: {e}")
            return HealthCheck("api", HealthStatus.CRITICAL, "API unreachable")

    async def check_database(self, db: AsyncSession) -> HealthCheck:
        """Check database connectivity"""
        try:
            start = datetime.utcnow()
            result = await db.execute(text("SELECT 1"))
            result.scalar()
            elapsed = (datetime.utcnow() - start).total_seconds() * 1000

            if elapsed > 1000:
                return HealthCheck("database", HealthStatus.WARNING, f"Database slow at {elapsed:.0f}ms — may need maintenance or disk is busy", elapsed)
            return HealthCheck("database", HealthStatus.HEALTHY, f"Database responding: {elapsed:.0f}ms", elapsed)
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return HealthCheck("database", HealthStatus.CRITICAL, "Database error")

    async def check_caldav(self, db: AsyncSession) -> HealthCheck:
        """Check CalDAV/Radicale status"""
        from services.calendar_sync import get_calendar_setting

        # Read settings from database
        enabled = await get_calendar_setting(db, "calendar_enabled")
        if enabled != "true":
            return HealthCheck("caldav", HealthStatus.HEALTHY, "CalDAV disabled")

        url = await get_calendar_setting(db, "calendar_url")
        username = await get_calendar_setting(db, "calendar_username")
        password = await get_calendar_setting(db, "calendar_password")

        if not url or not username or not password:
            return HealthCheck("caldav", HealthStatus.WARNING, "CalDAV enabled but not fully configured — set URL, username, and password in Settings")

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Try to reach radicale
                check_url = url.rstrip('/') + '/'
                auth = aiohttp.BasicAuth(username, password)
                async with session.options(check_url, auth=auth, ssl=False) as response:
                    if response.status in [200, 204, 207]:
                        return HealthCheck("caldav", HealthStatus.HEALTHY, "CalDAV server responding")
                    else:
                        return HealthCheck("caldav", HealthStatus.WARNING, f"CalDAV returned status {response.status}")
        except asyncio.TimeoutError:
            return HealthCheck("caldav", HealthStatus.WARNING, "CalDAV request timed out")
        except Exception as e:
            return HealthCheck("caldav", HealthStatus.WARNING, f"CalDAV error: {str(e)[:100]}")

    def check_calendar_sync_performance(self) -> HealthCheck:
        """Check if calendar sync is running properly.

        Checks:
        - Sync duration (slow sync = network/server issue)
        - Sync staleness (stale = scheduler may be stuck)
        - Sync statistics (high skip ratio = sync logic issue)
        """
        from services.scheduler import scheduler_service

        if not scheduler_service:
            return HealthCheck("calendar_sync", HealthStatus.CRITICAL, "Scheduler not initialized — app may need restart")

        # Check if sync has ever been attempted
        if not scheduler_service.last_calendar_sync_attempt:
            # First sync runs 30s after startup, so this is expected briefly after start
            return HealthCheck("calendar_sync", HealthStatus.WARNING, "Awaiting first sync — runs 30s after startup")

        # Check if last sync attempt failed
        if scheduler_service.last_calendar_sync_error:
            return HealthCheck("calendar_sync", HealthStatus.WARNING,
                f"Sync error: {scheduler_service.last_calendar_sync_error}")

        if not scheduler_service.last_calendar_sync_time:
            # Sync attempted but no successful completion yet
            return HealthCheck("calendar_sync", HealthStatus.WARNING, "Sync attempted but not completed")

        duration = scheduler_service.last_calendar_sync_duration
        last_sync = scheduler_service.last_calendar_sync_time
        minutes_ago = (datetime.utcnow() - last_sync).total_seconds() / 60 if last_sync else 0

        # Alert if sync takes more than 60 seconds (should be <10s normally)
        if duration > 90:
            return HealthCheck("calendar_sync", HealthStatus.CRITICAL,
                f"Calendar sync took {duration:.0f}s — network or CalDAV server may be overloaded", duration)
        elif duration > 60:
            return HealthCheck("calendar_sync", HealthStatus.WARNING,
                f"Calendar sync slow at {duration:.0f}s — check network or CalDAV server", duration)
        elif minutes_ago > 15:
            return HealthCheck("calendar_sync", HealthStatus.WARNING,
                f"Calendar sync stale ({minutes_ago:.0f}m ago) — scheduler may need restart", minutes_ago)

        # Get sync stats for summary (but don't warn on high skip ratios)
        # High skip ratios are EXPECTED because incremental sync skips unchanged tasks
        # (hash-based change detection means only modified tasks sync)
        stats = scheduler_service.last_calendar_sync_stats

        # Build summary with stats if available
        summary = f"Calendar sync OK: {duration:.1f}s, {minutes_ago:.0f}m ago"
        if stats and isinstance(stats, dict):
            synced = stats.get("synced", 0)
            linked = stats.get("linked", 0)
            deleted = stats.get("deleted", 0)
            skipped = stats.get("skipped", 0)
            summary += f" (synced:{synced} linked:{linked} deleted:{deleted} skipped:{skipped})"

        return HealthCheck("calendar_sync", HealthStatus.HEALTHY, summary, duration)

    def check_memory(self) -> HealthCheck:
        """Check system memory usage"""
        try:
            memory = psutil.virtual_memory()
            used_percent = memory.percent

            if used_percent > 90:
                return HealthCheck("memory", HealthStatus.CRITICAL, f"Memory critical at {used_percent:.1f}% — restart services or reboot to free memory", used_percent)
            elif used_percent > 80:
                return HealthCheck("memory", HealthStatus.WARNING, f"Memory at {used_percent:.1f}% — consider restarting services to free memory", used_percent)
            return HealthCheck("memory", HealthStatus.HEALTHY, f"Memory OK: {used_percent:.1f}%", used_percent)
        except Exception as e:
            return HealthCheck("memory", HealthStatus.UNKNOWN, f"Memory check failed: {str(e)[:100]}")

    def check_disk(self) -> HealthCheck:
        """Check disk space usage"""
        try:
            disk = psutil.disk_usage('/')
            used_percent = disk.percent

            if used_percent > 95:
                return HealthCheck("disk", HealthStatus.CRITICAL, f"Disk critical at {used_percent:.1f}% — clear old backups or logs immediately", used_percent)
            elif used_percent > 85:
                return HealthCheck("disk", HealthStatus.WARNING, f"Disk at {used_percent:.1f}% — clear old backups, logs, or unused files", used_percent)
            return HealthCheck("disk", HealthStatus.HEALTHY, f"Disk OK: {used_percent:.1f}%", used_percent)
        except Exception as e:
            return HealthCheck("disk", HealthStatus.UNKNOWN, f"Disk check failed: {str(e)[:100]}")

    def check_cpu(self) -> HealthCheck:
        """Check CPU load average"""
        try:
            load_avg = os.getloadavg()
            cpu_count = psutil.cpu_count() or 1
            load_percent = (load_avg[0] / cpu_count) * 100

            if load_percent > 200:
                return HealthCheck("cpu", HealthStatus.CRITICAL, f"CPU overloaded (load {load_avg[0]:.2f}/{cpu_count} cores) — heavy tasks are degrading performance", load_percent)
            elif load_percent > 100:
                return HealthCheck("cpu", HealthStatus.WARNING, f"CPU high (load {load_avg[0]:.2f}/{cpu_count} cores) — background tasks may slow the app", load_percent)
            return HealthCheck("cpu", HealthStatus.HEALTHY, f"CPU OK: load {load_avg[0]:.2f}/{cpu_count} cores", load_percent)
        except Exception as e:
            return HealthCheck("cpu", HealthStatus.UNKNOWN, f"CPU check failed: {str(e)[:100]}")

    async def run_all_checks(self, db: AsyncSession) -> List[HealthCheck]:
        """Run all health checks"""
        checks = []

        # Run async checks
        checks.append(await self.check_api_health())
        checks.append(await self.check_database(db))
        checks.append(await self.check_caldav(db))

        # Run sync checks
        checks.append(self.check_memory())
        checks.append(self.check_disk())
        checks.append(self.check_cpu())
        checks.append(self.check_calendar_sync_performance())

        return checks

    def get_overall_status(self, checks: List[HealthCheck]) -> str:
        """Determine overall health status from all checks"""
        statuses = [c.status for c in checks]
        if HealthStatus.CRITICAL in statuses:
            return HealthStatus.CRITICAL
        if HealthStatus.WARNING in statuses:
            return HealthStatus.WARNING
        # If all checks are healthy, return healthy
        if all(s == HealthStatus.HEALTHY for s in statuses):
            return HealthStatus.HEALTHY
        # If we can't determine status (shouldn't happen), treat as critical
        return HealthStatus.CRITICAL

    def should_send_alert(self, check_name: str, status: str) -> bool:
        """Determine if an alert should be sent based on cooldown and consecutive failures"""
        if status == HealthStatus.HEALTHY:
            # Reset failure count on healthy
            self.consecutive_failures[check_name] = 0
            return False

        # Increment failure count
        self.consecutive_failures[check_name] = self.consecutive_failures.get(check_name, 0) + 1

        # Only alert after 2 consecutive failures (avoid transient issues)
        if self.consecutive_failures[check_name] < 2:
            return False

        # Check cooldown
        last_alert = self.last_alert_time.get(check_name)
        if last_alert:
            cooldown = timedelta(minutes=self.alert_cooldown_minutes)
            if datetime.utcnow() - last_alert < cooldown:
                return False

        return True

    def record_alert_sent(self, check_name: str):
        """Record that an alert was sent"""
        self.last_alert_time[check_name] = datetime.utcnow()


async def log_health_check(db: AsyncSession, checks: List[HealthCheck], overall_status: str):
    """Log health check results to the database"""
    from models.settings import HealthLog

    log = HealthLog(
        overall_status=overall_status,
        api_status=next((c.status for c in checks if c.name == "api"), "critical"),
        api_message=next((c.message for c in checks if c.name == "api"), ""),
        database_status=next((c.status for c in checks if c.name == "database"), "critical"),
        database_message=next((c.message for c in checks if c.name == "database"), ""),
        database_latency_ms=next((c.value for c in checks if c.name == "database"), None),
        caldav_status=next((c.status for c in checks if c.name == "caldav"), "critical"),
        caldav_message=next((c.message for c in checks if c.name == "caldav"), ""),
        memory_status=next((c.status for c in checks if c.name == "memory"), "critical"),
        memory_message=next((c.message for c in checks if c.name == "memory"), ""),
        memory_percent=next((c.value for c in checks if c.name == "memory"), None),
        disk_status=next((c.status for c in checks if c.name == "disk"), "critical"),
        disk_message=next((c.message for c in checks if c.name == "disk"), ""),
        disk_percent=next((c.value for c in checks if c.name == "disk"), None),
        cpu_status=next((c.status for c in checks if c.name == "cpu"), "critical"),
        cpu_message=next((c.message for c in checks if c.name == "cpu"), ""),
        cpu_load=next((c.value for c in checks if c.name == "cpu"), None),
        calendar_sync_status=next((c.status for c in checks if c.name == "calendar_sync"), "critical"),
        calendar_sync_message=next((c.message for c in checks if c.name == "calendar_sync"), ""),
        calendar_sync_value=next((c.value for c in checks if c.name == "calendar_sync"), None),
    )

    db.add(log)
    await db.commit()

    # Cleanup old logs (keep last 7 days)
    cutoff = datetime.utcnow() - timedelta(days=7)
    await db.execute(delete(HealthLog).where(HealthLog.checked_at < cutoff))
    await db.commit()

    return log


async def send_health_alert(db: AsyncSession, checks: List[HealthCheck], overall_status: str):
    """Send email alert for health issues"""
    from services.email import EmailService

    # Build alert message
    issues = [c for c in checks if c.status in [HealthStatus.WARNING, HealthStatus.CRITICAL]]
    if not issues:
        return

    subject = f"[{settings.app_name}] Health Alert: {overall_status.upper()}"

    body_lines = [
        f"Health check detected issues at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "Issues detected:",
    ]

    for check in issues:
        severity = "CRITICAL" if check.status == HealthStatus.CRITICAL else "WARNING"
        body_lines.append(f"  [{severity}] {check.name}: {check.message}")

    body_lines.extend([
        "",
        "All checks:",
    ])

    for check in checks:
        status_icon = "✓" if check.status == HealthStatus.HEALTHY else "✗" if check.status == HealthStatus.CRITICAL else "!"
        body_lines.append(f"  {status_icon} {check.name}: {check.message}")

    body = "\n".join(body_lines)

    try:
        email_service = await EmailService.get_configured_service(db)
        await email_service.send_email(
            subject=subject,
            body=body,
            subject_prefix="[HEALTH]"
        )
        logger.info(f"Health alert email sent: {overall_status}")
    except Exception as e:
        logger.error(f"Failed to send health alert email: {e}")


# Global instance
health_monitor = HealthMonitor()
