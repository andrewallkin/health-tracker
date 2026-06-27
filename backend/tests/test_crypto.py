from __future__ import annotations

from cryptography.fernet import Fernet

import pytest

from backend.crypto import EncryptionError, decrypt_api_key, encrypt_api_key, mask_api_key


def test_mask_api_key_short_value() -> None:
    assert mask_api_key("short") == "••••••••"


def test_mask_api_key_long_value() -> None:
    masked = mask_api_key("sk-test-key-1234567890")
    assert masked.startswith("sk-")
    assert masked.endswith("7890")
    assert "…" in masked


def test_encrypt_decrypt_with_derived_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", "not-a-fernet-key-but-long-enough")
    from backend.config import get_settings

    get_settings.cache_clear()

    plaintext = "sk-derived-key-1234567890"
    ciphertext = encrypt_api_key(plaintext)
    assert decrypt_api_key(ciphertext) == plaintext

    get_settings.cache_clear()


def test_decrypt_invalid_ciphertext_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", key)
    from backend.config import get_settings

    get_settings.cache_clear()

    with pytest.raises(EncryptionError, match="Failed to decrypt"):
        decrypt_api_key("not-valid-ciphertext")

    get_settings.cache_clear()


def test_encrypt_without_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SETTINGS_ENCRYPTION_KEY", raising=False)
    from backend.config import get_settings

    get_settings.cache_clear()

    with pytest.raises(EncryptionError, match="SETTINGS_ENCRYPTION_KEY"):
        encrypt_api_key("sk-test")

    get_settings.cache_clear()
