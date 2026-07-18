from __future__ import annotations

from backend.config import Settings


def test_garmin_fetch_concurrency_defaults_to_3(monkeypatch):
    monkeypatch.delenv("GARMIN_FETCH_CONCURRENCY", raising=False)
    assert Settings().garmin_fetch_concurrency == 3


def test_garmin_fetch_concurrency_reads_env(monkeypatch):
    monkeypatch.setenv("GARMIN_FETCH_CONCURRENCY", "5")
    assert Settings().garmin_fetch_concurrency == 5


def test_garmin_fetch_concurrency_invalid_falls_back_to_3(monkeypatch):
    monkeypatch.setenv("GARMIN_FETCH_CONCURRENCY", "0")
    assert Settings().garmin_fetch_concurrency == 3
    monkeypatch.setenv("GARMIN_FETCH_CONCURRENCY", "nope")
    assert Settings().garmin_fetch_concurrency == 3
