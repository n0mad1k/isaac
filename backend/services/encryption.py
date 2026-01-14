"""
Encryption Service for Sensitive Settings
Uses Fernet symmetric encryption with a key derived from environment secret
"""

import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from typing import Optional


# Prefix to identify encrypted values in the database
ENCRYPTED_PREFIX = "enc::"


def _get_encryption_key() -> bytes:
    """
    Generate a Fernet key from the SECRET_KEY environment variable.
    If no SECRET_KEY exists, generate and save one.
    """
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
        secret_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        with open(env_file, "a") as f:
            f.write(f"\n# Auto-generated encryption key - DO NOT SHARE\nSECRET_KEY={secret_key}\n")
        os.environ["SECRET_KEY"] = secret_key

    # Derive a 32-byte key from the secret using SHA256
    key_bytes = hashlib.sha256(secret_key.encode()).digest()
    # Fernet requires base64-encoded 32-byte key
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

    key = _get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(plaintext.encode())
    return ENCRYPTED_PREFIX + encrypted.decode()


def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt an encrypted value.
    If the value is not encrypted (no prefix), returns it as-is.
    """
    if not encrypted_value:
        return encrypted_value

    # Not encrypted - return as-is (backwards compatibility)
    if not encrypted_value.startswith(ENCRYPTED_PREFIX):
        return encrypted_value

    try:
        key = _get_encryption_key()
        fernet = Fernet(key)
        encrypted_part = encrypted_value[len(ENCRYPTED_PREFIX):]
        decrypted = fernet.decrypt(encrypted_part.encode())
        return decrypted.decode()
    except InvalidToken:
        # If decryption fails (wrong key, corrupted), return empty
        # This prevents exposing partial data
        return ""
    except Exception:
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
]


def should_encrypt(key: str) -> bool:
    """Check if a setting key should be encrypted."""
    return key in ENCRYPTED_SETTINGS
