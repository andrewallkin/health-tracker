from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from backfill_garmin_health import date_range, should_skip

def test_date_range_inclusive():
    assert date_range("2026-09-01", "2026-09-03") == [
        "2026-09-01", "2026-09-02", "2026-09-03"]

def test_date_range_capped_at_90_days():
    start = (date.today() - timedelta(days=120)).isoformat()
    assert len(date_range(start, date.today().isoformat())) == 90

def test_should_skip_when_new_fields_present():
    assert should_skip({"is_complete": True, "payload": {"trainingStatus": {}}}) is True
    assert should_skip({"is_complete": True, "payload": {"steps": 1}}) is False
    assert should_skip({"is_complete": False, "payload": {"trainingStatus": {}}}) is False
    assert should_skip(None) is False
