"""
Encryption Service for Sensitive Settings
Uses Fernet symmetric encryption with a key derived from environment secret
"""

import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from typing import Optional
from loguru import logger


# Prefix to identify encrypted values in the database
ENCRYPTED_PREFIX = "enc::"

# Track which values have already warned about decryption failure (avoid log spam)
_decryption_warned: set = set()


def _get_secret_key() -> str:
    """Read or generate the SECRET_KEY from environment / .env file."""
    secret_key = os.environ.get("SECRET_KEY")

    if not secret_key:
        # Check .env file
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_file):
            with open(env_file, "r") as f:
                for line in f:
                    if line.startswith("SECRET_KEY="):
                        secret_key = line.split("=", 1)[1].strip().strip('"\'')
                        break

    if not secret_key:
        # Generate a new secret key and append to .env
        logger.warning("No SECRET_KEY found in environment or .env file - generating a new one")
        secret_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        with open(env_file, "a") as f:
            f.write(f"\n# Auto-generated encryption key - DO NOT SHARE\nSECRET_KEY={secret_key}\n")
        os.environ["SECRET_KEY"] = secret_key

    return secret_key


def _get_encryption_key() -> bytes:
    """
    Derive a Fernet key using PBKDF2-HMAC-SHA256 (100k iterations).
    Static salt is acceptable since the input secret is already high-entropy.
    """
    secret_key = _get_secret_key()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"isaac-farm-assistant-v1",
        iterations=100_000,
    )
    key_bytes = kdf.derive(secret_key.encode())
    return base64.urlsafe_b64encode(key_bytes)


def _get_legacy_key() -> bytes:
    """Legacy key derivation using SHA256 (for backwards compatibility)."""
    secret_key = _get_secret_key()
    key_bytes = hashlib.sha256(secret_key.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_value(plaintext: str) -> str:
    """
    Encrypt a plaintext value.
    Returns a string prefixed with 'enc::' to identify it as encrypted.
    """
    if not plaintext:
        return plaintext

    # Don't double-encrypt
    if plaintext.startswith(ENCRYPTED_PREFIX):
        return plaintext

    try:
        key = _get_encryption_key()
        fernet = Fernet(key)
        encrypted = fernet.encrypt(plaintext.encode())
        return ENCRYPTED_PREFIX + encrypted.decode()
    except Exception as e:
        logger.error(f"Failed to encrypt value: {type(e).__name__}")
        raise


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt an encrypted value.
    If the value is not encrypted (no prefix), returns it as-is.
    Tries PBKDF2 key first, falls back to legacy SHA256 key for migration.
    """
    if not encrypted_value:
        return encrypted_value

    # Not encrypted - return as-is (backwards compatibility)
    if not encrypted_value.startswith(ENCRYPTED_PREFIX):
        return encrypted_value

    encrypted_part = encrypted_value[len(ENCRYPTED_PREFIX):]

    # Try PBKDF2 key first (current)
    try:
        key = _get_encryption_key()
        fernet = Fernet(key)
        decrypted = fernet.decrypt(encrypted_part.encode())
        return decrypted.decode()
    except InvalidToken:
        pass
    except Exception as e:
        logger.error(f"Unexpected error during decryption: {type(e).__name__}")

    # Fall back to legacy SHA256 key
    try:
        legacy_key = _get_legacy_key()
        fernet = Fernet(legacy_key)
        decrypted = fernet.decrypt(encrypted_part.encode())
        logger.info("Decrypted value using legacy key - will re-encrypt on next write")
        return decrypted.decode()
    except InvalidToken:
        value_hash = encrypted_value[:20]
        if value_hash not in _decryption_warned:
            _decryption_warned.add(value_hash)
            logger.warning("Decryption failed for an encrypted setting - re-enter the value in Settings if the encryption key changed")
        return ""
    except Exception as e:
        logger.error(f"Unexpected error during legacy decryption: {type(e).__name__}")
        return ""


def is_encrypted(value: str) -> bool:
    """Check if a value is encrypted (has the prefix)."""
    return value.startswith(ENCRYPTED_PREFIX) if value else False


# List of setting keys that should be encrypted
ENCRYPTED_SETTINGS = [
    'calendar_password',
    'smtp_password',
    'awn_api_key',
    'awn_app_key',
    'cloudflare_api_token',
    'deepl_api_key',
    'anthropic_api_key',
    'openai_api_key',
]


def should_encrypt(key: str) -> bool:
    """Check if a setting key should be encrypted."""
    return key in ENCRYPTED_SETTINGS
