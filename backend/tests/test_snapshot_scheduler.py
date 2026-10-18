from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from backend.api.snapshot_scheduler import needs_capture, seconds_until_next_capture

TZ = ZoneInfo("Africa/Johannesburg")

def test_seconds_until_next_capture_before_monday():
    now = datetime(2026, 10, 17, 8, 0, tzinfo=TZ)  # Saturday
    secs = seconds_until_next_capture(now)
    assert 0 < secs <= 7 * 24 * 3600

def test_seconds_until_next_capture_monday_after_0700_goes_to_next_week():
    now = datetime(2026, 10, 19, 8, 0, tzinfo=TZ)  # Monday after 07:00
    assert seconds_until_next_capture(now) > 6 * 24 * 3600

def test_needs_capture_monday_anchored():
    monday_after = datetime(2026, 10, 19, 7, 1, tzinfo=TZ)   # Monday 07:01
    monday_before = datetime(2026, 10, 19, 6, 0, tzinfo=TZ)  # Monday 06:00
    saturday = datetime(2026, 10, 17, 12, 0, tzinfo=TZ)
    # no snapshot at all -> capture
    assert needs_capture(None, monday_after) is True
    # snapshot taken last week (before this Monday 07:00) -> due now
    stale = datetime(2026, 10, 16, 12, 0, tzinfo=TZ)
    assert needs_capture(stale, monday_after) is True
    # snapshot taken after this week's Monday 07:00 -> not due
    fresh = monday_after + timedelta(minutes=10)
    assert needs_capture(fresh, monday_after) is False
    # Saturday: due time is still the previous Monday 07:00
    prev_monday = datetime(2026, 10, 12, 7, 0, tzinfo=TZ)
    assert needs_capture(datetime(2026, 10, 13, 0, 0, tzinfo=TZ), saturday) is False
    assert needs_capture(datetime(2026, 10, 11, 0, 0, tzinfo=TZ), saturday) is True
    # Monday 06:00 is before this week's anchor — a Friday snapshot is still fresh
    assert needs_capture(datetime(2026, 10, 16, 12, 0, tzinfo=TZ), monday_before) is False

def test_needs_capture_naive_fetched_at_does_not_raise():
    # stored fetched_at is naive UTC; comparing to aware now must work
    monday_after = datetime(2026, 10, 19, 7, 1, tzinfo=TZ)
    naive_utc = datetime(2026, 10, 16, 12, 0)  # naive, UTC
    assert needs_capture(naive_utc, monday_after) is True
    # 07:05 SAST == 05:05 UTC, after this week's 05:00 UTC anchor -> not due
    fresh_naive = datetime(2026, 10, 19, 5, 5)
    assert needs_capture(fresh_naive, monday_after) is False