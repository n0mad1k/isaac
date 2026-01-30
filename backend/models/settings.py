"""
Application Settings Model
Stores runtime-configurable settings in the database
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from datetime import datetime

from .database import Base


class AppSetting(Base):
    """Key-value store for application settings"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AppSetting {self.key}={self.value}>"


class HealthLog(Base):
    """Health check logs for monitoring system health"""
    __tablename__ = "health_logs"

    id = Column(Integer, primary_key=True, index=True)
    checked_at = Column(DateTime, default=datetime.utcnow, index=True)
    overall_status = Column(String(20), nullable=False)  # healthy, warning, critical, unknown

    # API health
    api_status = Column(String(20), default="unknown")
    api_message = Column(String(200), nullable=True)

    # Database health
    database_status = Column(String(20), default="unknown")
    database_message = Column(String(200), nullable=True)
    database_latency_ms = Column(Float, nullable=True)

    # CalDAV health
    caldav_status = Column(String(20), default="unknown")
    caldav_message = Column(String(200), nullable=True)

    # System resources
    memory_status = Column(String(20), default="unknown")
    memory_message = Column(String(200), nullable=True)
    memory_percent = Column(Float, nullable=True)

    disk_status = Column(String(20), default="unknown")
    disk_message = Column(String(200), nullable=True)
    disk_percent = Column(Float, nullable=True)

    cpu_status = Column(String(20), default="unknown")
    cpu_message = Column(String(200), nullable=True)
    cpu_load = Column(Float, nullable=True)

    def __repr__(self):
        return f"<HealthLog {self.checked_at} status={self.overall_status}>"

    def to_dict(self):
        return {
            "id": self.id,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
            "overall_status": self.overall_status,
            "api": {"status": self.api_status, "message": self.api_message},
            "database": {
                "status": self.database_status,
                "message": self.database_message,
                "latency_ms": self.database_latency_ms
            },
            "caldav": {"status": self.caldav_status, "message": self.caldav_message},
            "memory": {"status": self.memory_status, "message": self.memory_message, "percent": self.memory_percent},
            "disk": {"status": self.disk_status, "message": self.disk_message, "percent": self.disk_percent},
            "cpu": {"status": self.cpu_status, "message": self.cpu_message, "load": self.cpu_load}
        }
