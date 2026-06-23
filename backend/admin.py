"""
Administrative CLI for SECRET_KEY management.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import os
from pathlib import Path
import sqlite3

import click
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from services.encryption import ENCRYPTED_PREFIX, ENCRYPTED_SETTINGS
from services.secret_backend import BACKEND_FILE, DEFAULT_SECRET_KEY_FILE, FileSecretBackend, resolve_secret_key


def _build_fernet(secret_key: str) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"isaac-farm-assistant-v1",
        iterations=100_000,
    )
    key_bytes = kdf.derive(secret_key.encode())
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def _build_legacy_fernet(secret_key: str) -> Fernet:
    key_bytes = hashlib.sha256(secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def _encrypt_with_secret(secret_key: str, plaintext: str) -> str:
    return ENCRYPTED_PREFIX + _build_fernet(secret_key).encrypt(plaintext.encode()).decode()


def _decrypt_with_secret(secret_key: str, encrypted_value: str) -> str:
    encrypted_part = encrypted_value[len(ENCRYPTED_PREFIX):]
    try:
        return _build_fernet(secret_key).decrypt(encrypted_part.encode()).decode()
    except InvalidToken:
        return _build_legacy_fernet(secret_key).decrypt(encrypted_part.encode()).decode()


def _generate_secret_key() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


def _connect_db(db_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(str(db_path))


def _set_rotation_flag(conn: sqlite3.Connection, enabled: bool) -> None:
    conn.execute(
        """
        INSERT INTO app_settings (key, value)
        VALUES ('encryption_rotation_in_progress', ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """,
        ("true" if enabled else "false",),
    )


def _iter_encrypted_rows(conn: sqlite3.Connection) -> list[tuple[int, str, str]]:
    cursor = conn.execute(
        "SELECT id, key, value FROM app_settings WHERE value LIKE 'enc::%' ORDER BY id"
    )
    return [(row[0], row[1], row[2]) for row in cursor.fetchall()]


@click.group()
def cli() -> None:
    """Isaac admin CLI."""


@cli.command("init-secret-key")
@click.option("--path", "secret_path", type=click.Path(path_type=Path), default=DEFAULT_SECRET_KEY_FILE)
@click.option("--force", is_flag=True, help="Overwrite an existing key file.")
def init_secret_key(secret_path: Path, force: bool) -> None:
    """Generate and write a new secret key file."""
    backend = FileSecretBackend(secret_path)
    secret_key = _generate_secret_key()
    backend.write(secret_key, overwrite=force)
    click.echo(f"Initialized SECRET_KEY at {secret_path}")


@cli.command("rotate-key")
@click.option("--db-path", type=click.Path(path_type=Path), required=True)
@click.option("--path", "secret_path", type=click.Path(path_type=Path), default=DEFAULT_SECRET_KEY_FILE)
@click.option("--old-key", default=None, help="Current SECRET_KEY override.")
@click.option("--new-key", default=None, help="New SECRET_KEY override.")
@click.option("--dry-run", is_flag=True, help="Report what would change without writing.")
@click.option("--reset-encrypted", is_flag=True, help="Wipe encrypted settings instead of re-encrypting.")
def rotate_key(
    db_path: Path,
    secret_path: Path,
    old_key: str | None,
    new_key: str | None,
    dry_run: bool,
    reset_encrypted: bool,
) -> None:
    """Rotate SECRET_KEY and re-encrypt stored secrets."""
    backend = FileSecretBackend(secret_path)
    current_key = old_key or resolve_secret_key(BACKEND_FILE, file_backends=[backend])
    replacement_key = new_key or _generate_secret_key()

    conn = _connect_db(db_path)
    try:
        rows = _iter_encrypted_rows(conn)
        if dry_run:
            click.echo(f"Dry run: would process {len(rows)} encrypted settings")
            return

        _set_rotation_flag(conn, True)

        if reset_encrypted:
            typed = click.prompt("Type RESET ENCRYPTED SETTINGS to continue", default="", show_default=False)
            if typed != "RESET ENCRYPTED SETTINGS":
                raise click.ClickException("Confirmation text did not match")
            for row_id, key, _value in rows:
                if key in ENCRYPTED_SETTINGS:
                    conn.execute("UPDATE app_settings SET value = '' WHERE id = ?", (row_id,))
            backend.write(replacement_key, overwrite=True)
            _set_rotation_flag(conn, False)
            conn.commit()
            click.echo(f"Reset {len(rows)} encrypted settings")
            return

        for row_id, _key, encrypted_value in rows:
            plaintext = _decrypt_with_secret(current_key, encrypted_value)
            conn.execute(
                "UPDATE app_settings SET value = ? WHERE id = ?",
                (_encrypt_with_secret(replacement_key, plaintext), row_id),
            )

        backend.write(replacement_key, overwrite=True)
        _set_rotation_flag(conn, False)
        conn.commit()
        click.echo(f"Rotated {len(rows)} encrypted settings")
    finally:
        conn.close()


@cli.command("audit-encryption")
@click.option("--db-path", type=click.Path(path_type=Path), required=True)
@click.option("--path", "secret_path", type=click.Path(path_type=Path), default=DEFAULT_SECRET_KEY_FILE)
def audit_encryption(db_path: Path, secret_path: Path) -> None:
    """Audit encrypted settings using the active secret key."""
    backend = FileSecretBackend(secret_path)
    secret_key = resolve_secret_key(BACKEND_FILE, file_backends=[backend])
    conn = _connect_db(db_path)
    failures = []
    try:
        for _row_id, key, value in _iter_encrypted_rows(conn):
            try:
                _decrypt_with_secret(secret_key, value)
            except Exception:
                failures.append(key)
    finally:
        conn.close()

    if failures:
        raise click.ClickException(f"Unreadable encrypted settings: {', '.join(failures)}")
    click.echo("Encryption audit OK")


if __name__ == "__main__":
    cli()
