"""
Database connection and session management
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, inspect
from pathlib import Path
import logging

from config import settings

logger = logging.getLogger(__name__)

# Ensure data directory exists
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

# Create async engine with timeout to prevent "database is locked" errors
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    connect_args={
        "timeout": 30,  # Wait up to 30 seconds for locks
        "check_same_thread": False,
    },
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


def _get_column_type_sql(column):
    """Convert SQLAlchemy column type to SQLite type string"""
    type_name = type(column.type).__name__.upper()
    type_map = {
        'INTEGER': 'INTEGER',
        'STRING': 'VARCHAR',
        'TEXT': 'TEXT',
        'BOOLEAN': 'BOOLEAN',
        'DATETIME': 'DATETIME',
        'FLOAT': 'FLOAT',
        'JSON': 'JSON',
        'ENUM': 'VARCHAR',
    }
    return type_map.get(type_name, 'TEXT')


def _migrate_tables(connection):
    """Add missing columns to existing tables (SQLite only)"""
    inspector = inspect(connection)

    for table in Base.metadata.tables.values():
        table_name = table.name

        # Check if table exists
        if not inspector.has_table(table_name):
            continue

        # Get existing columns
        existing_columns = {col['name'] for col in inspector.get_columns(table_name)}

        # Check each model column
        for column in table.columns:
            if column.name not in existing_columns:
                # Build ALTER TABLE statement
                col_type = _get_column_type_sql(column)

                # Handle default values
                default_clause = ""
                if column.default is not None:
                    if column.default.arg is not None:
                        if isinstance(column.default.arg, bool):
                            default_clause = f" DEFAULT {1 if column.default.arg else 0}"
                        elif isinstance(column.default.arg, (int, float)):
                            default_clause = f" DEFAULT {column.default.arg}"
                        elif isinstance(column.default.arg, str):
                            default_clause = f" DEFAULT '{column.default.arg}'"

                sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}{default_clause}"

                try:
                    connection.execute(text(sql))
                    logger.info(f"Added column {table_name}.{column.name}")
                except Exception as e:
                    logger.warning(f"Could not add column {table_name}.{column.name}: {e}")


async def _migrate_sensitive_settings():
    """Encrypt any existing plaintext sensitive settings"""
    from services.encryption import ENCRYPTED_SETTINGS, encrypt_value, is_encrypted

    async with async_session() as session:
        try:
            # Check if app_settings table exists
            result = await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'")
            )
            if not result.fetchone():
                return  # Table doesn't exist yet

            # Get all sensitive settings that need encryption
            for key in ENCRYPTED_SETTINGS:
                result = await session.execute(
                    text("SELECT id, value FROM app_settings WHERE key = :key"),
                    {"key": key}
                )
                row = result.fetchone()
                if row and row[1] and not is_encrypted(row[1]):
                    # Encrypt the plaintext value
                    encrypted = encrypt_value(row[1])
                    await session.execute(
                        text("UPDATE app_settings SET value = :value WHERE id = :id"),
                        {"value": encrypted, "id": row[0]}
                    )
                    logger.info(f"Encrypted setting: {key}")

            await session.commit()
        except Exception as e:
            logger.warning(f"Could not migrate sensitive settings: {e}")
            await session.rollback()


async def _migrate_session_tokens():
    """Hash any existing plaintext session tokens for security"""
    import hashlib

    async with async_session() as session:
        try:
            # Check if sessions table exists and has both columns
            result = await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
            )
            if not result.fetchone():
                return  # Table doesn't exist yet

            # Check if token_hash column exists
            result = await session.execute(
                text("PRAGMA table_info(sessions)")
            )
            columns = {row[1] for row in result.fetchall()}
            if 'token_hash' not in columns:
                return  # Column doesn't exist yet (will be added by migration)

            # Find sessions with plaintext token but no hash
            result = await session.execute(
                text("SELECT id, token FROM sessions WHERE token IS NOT NULL AND token != '' AND (token_hash IS NULL OR token_hash = '')")
            )
            rows = result.fetchall()

            if not rows:
                return  # No migration needed

            migrated = 0
            for row in rows:
                session_id, token = row
                # Hash the token using SHA-256
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                # Update: set hash, set token to placeholder (can't null due to old NOT NULL constraint)
                # The placeholder is not a valid token (starts with 'MIGRATED:')
                await session.execute(
                    text("UPDATE sessions SET token_hash = :hash, token = :placeholder WHERE id = :id"),
                    {"hash": token_hash, "placeholder": f"MIGRATED:{session_id}", "id": session_id}
                )
                migrated += 1

            await session.commit()
            if migrated > 0:
                logger.info(f"Migrated {migrated} session tokens to hashed format")

        except Exception as e:
            logger.warning(f"Could not migrate session tokens: {e}")
            await session.rollback()


async def _migrate_role_permissions():
    """Sync new permission categories from DEFAULT_PERMISSIONS to existing roles"""
    from models.users import DEFAULT_PERMISSIONS, Role
    import json

    async with async_session() as session:
        try:
            result = await session.execute(text("SELECT id, name, permissions FROM roles"))
            roles = result.fetchall()

            updated = 0
            for role_id, role_name, perms_json in roles:
                current_perms = json.loads(perms_json) if perms_json else {}
                default_perms = DEFAULT_PERMISSIONS.get(role_name, {})

                # Add any missing permission categories from defaults
                added_cats = []
                for category, category_perms in default_perms.items():
                    if category not in current_perms:
                        current_perms[category] = category_perms
                        added_cats.append(category)

                if added_cats:
                    await session.execute(
                        text("UPDATE roles SET permissions = :perms WHERE id = :id"),
                        {"perms": json.dumps(current_perms), "id": role_id}
                    )
                    updated += 1
                    logger.info(f"Added permission categories {added_cats} to role '{role_name}'")

            if updated > 0:
                await session.commit()
                logger.info(f"Updated {updated} roles with new permission categories")

        except Exception as e:
            logger.warning(f"Could not migrate role permissions: {e}")
            await session.rollback()


async def _normalize_case_data():
    """Normalize categorical string columns to lowercase for consistency"""
    normalize_targets = [
        ("plant_care_logs", "care_type"),
        ("plants", "growth_stage"),
        ("animal_care_logs", "care_type"),
        ("animals", "status"),
        ("home_maintenance", "category"),
        ("budget_categories", "owner"),
    ]
    async with async_session() as session:
        try:
            for table, column in normalize_targets:
                # Check if table exists
                result = await session.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table"),
                    {"table": table}
                )
                if not result.fetchone():
                    continue
                # Update non-lowercase values
                result = await session.execute(
                    text(f"UPDATE {table} SET {column} = LOWER(TRIM({column})) WHERE {column} IS NOT NULL AND {column} != LOWER(TRIM({column}))")
                )
                if result.rowcount > 0:
                    logger.info(f"Normalized {result.rowcount} rows in {table}.{column} to lowercase")
            await session.commit()
        except Exception as e:
            logger.warning(f"Could not normalize case data: {e}")
            await session.rollback()


async def init_db():
    """Initialize database tables and migrate schema"""
    async with engine.begin() as conn:
        # Create new tables
        await conn.run_sync(Base.metadata.create_all)
        # Add missing columns to existing tables
        await conn.run_sync(_migrate_tables)

    # Encrypt any existing plaintext sensitive settings
    await _migrate_sensitive_settings()

    # Hash any existing plaintext session tokens
    await _migrate_session_tokens()

    # Sync new permission categories to existing roles
    await _migrate_role_permissions()

    # Normalize case on categorical string columns
    await _normalize_case_data()


async def get_db() -> AsyncSession:
    """Dependency for getting database sessions"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
