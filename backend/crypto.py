from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings


class EncryptionError(Exception):
    pass


def _fernet() -> Fernet:
    key = get_settings().encryption_key.strip()
    if not key:
        raise EncryptionError(
            "SETTINGS_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
        return Fernet(derived)


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionError("Failed to decrypt stored API key") from exc


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "••••••••"
    return f"{api_key[:3]}…{api_key[-4:]}"
