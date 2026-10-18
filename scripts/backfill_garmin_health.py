#!/usr/bin/env python3
"""Backfill garmin_daily_health with the new Garmin metrics.

One-off CLI (no API endpoint): a synchronous 90-day run at ~13 Garmin calls
per day plus throttling takes minutes, which would blow past an HTTP timeout.
Resumable: days already fetched with the new blocks are skipped.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import Garmin

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.api.health_service import _write_day, today_in_timezone  # noqa: E402
from backend.crypto import encrypt_api_key  # noqa: E402
from backend.database import SessionLocal  # noqa: E402
from backend.db_models import AppSettingsRow, GarminDailyHealthRow, UserRow  # noqa: E402
from backend.garmin_auth import login_and_dump_tokens  # noqa: E402
from backend.garmin_client import (  # noqa: E402
    GarminAuthFailure,
    fetch_and_normalize_day,
    garmin_from_tokens,
)

TZ_NAME = "Africa/Johannesburg"
MAX_SPAN_DAYS = 90
TOKENS_PATH = Path("~/.garminconnect/garmin_tokens.json").expanduser()


def date_range(from_key: str, to_key: str) -> list[str]:
    start = date.fromisoformat(from_key)
    end = date.fromisoformat(to_key)
    if start > end:
        raise SystemExit(f"from ({from_key}) is after to ({to_key})")
    end = min(end, start + timedelta(days=MAX_SPAN_DAYS - 1))
    return [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]


def should_skip(row_info: dict | None) -> bool:
    if row_info is None:
        return False
    return bool(row_info.get("is_complete")) and "trainingStatus" in (row_info.get("payload") or {})


def _load_tokens() -> str:
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    if email and password:
        tokens_json = login_and_dump_tokens(email, password)
        TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKENS_PATH.write_text(tokens_json, encoding="utf-8")
        os.chmod(TOKENS_PATH, 0o600)
        return tokens_json
    if TOKENS_PATH.is_file():
        return TOKENS_PATH.read_text(encoding="utf-8")
    raise SystemExit(
        "Garmin credentials not found: set GARMIN_EMAIL and GARMIN_PASSWORD, "
        f"or provide {TOKENS_PATH}"
    )


def _user_id(db) -> str:
    rows = (
        db.query(UserRow.id)
        .join(AppSettingsRow, AppSettingsRow.user_id == UserRow.id)
        .filter(AppSettingsRow.garmin_email.isnot(None), AppSettingsRow.garmin_email != "")
        .all()
    )
    if not rows:
        raise SystemExit("No Garmin-connected user found; connect Garmin in Settings first")
    if len(rows) > 1:
        raise SystemExit(f"Expected exactly one Garmin-connected user, found {len(rows)}")
    return rows[0][0]


def fetch_and_normalize_day_compat(api: Garmin, date_str: str) -> tuple[Garmin, dict]:
    try:
        return api, fetch_and_normalize_day(api, date_str)
    except GarminAuthFailure:
        api = garmin_from_tokens(_load_tokens())
        return api, fetch_and_normalize_day(api, date_str)


def _maybe_persist_tokens(db, tokens_json: str) -> None:
    settings_row = db.query(AppSettingsRow).filter_by(user_id=_user_id(db)).one_or_none()
    if settings_row is None:
        return
    encrypted = encrypt_api_key(tokens_json)
    if settings_row.garmin_tokens_encrypted != encrypted:
        settings_row.garmin_tokens_encrypted = encrypted
        db.commit()


def main() -> None:
    load_dotenv(REPO_ROOT / ".env")
    parser = argparse.ArgumentParser(description="Backfill garmin_daily_health with new metrics")
    parser.add_argument("--days", type=int, default=84, help="how many days back (default 84)")
    parser.add_argument("--from", dest="from_key", help="override start date YYYY-MM-DD")
    parser.add_argument("--to", dest="to_key", help="override end date YYYY-MM-DD")
    parser.add_argument("--throttle", type=float, default=1.5, help="seconds between day fetches")
    args = parser.parse_args()

    if bool(args.from_key) != bool(args.to_key):
        raise SystemExit("--from and --to must be given together (or omit both)")

    today = today_in_timezone(TZ_NAME)
    if args.from_key and args.to_key:
        dates = date_range(args.from_key, args.to_key)
    else:
        dates = date_range((date.today() - timedelta(days=args.days - 1)).isoformat(), today)
    dates = [d for d in dates if d <= today]

    tokens_json = _load_tokens()
    api = garmin_from_tokens(tokens_json)
    db = SessionLocal()
    fetched = skipped = failed = 0
    errors: list[str] = []
    try:
        for date_str in dates:
            row = db.query(GarminDailyHealthRow).filter_by(
                user_id=_user_id(db), date=date_str).one_or_none()
            if should_skip({"is_complete": row.is_complete if row else False,
                            "payload": row.payload if row else None}):
                skipped += 1
                continue
            time.sleep(args.throttle)
            try:
                api, payload = fetch_and_normalize_day_compat(api, date_str)
                _write_day(db, _user_id(db), date_str, payload, today, row)
                refreshed = api.client.dumps()
                _maybe_persist_tokens(db, refreshed)
                fetched += 1
                print(f"fetched {date_str}")
            except Exception as exc:  # noqa: BLE001 — one bad day must not stop the run
                failed += 1
                errors.append(f"{date_str}: {exc}")
                print(f"FAILED {date_str}: {exc}", file=sys.stderr)
    finally:
        db.close()
    print(f"done: fetched={fetched} skipped={skipped} failed={failed}")
    for error in errors:
        print(error, file=sys.stderr)
    sys.exit(0 if fetched > 0 or failed == 0 else 1)


if __name__ == "__main__":
    main()
