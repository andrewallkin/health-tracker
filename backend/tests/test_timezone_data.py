from __future__ import annotations

import subprocess
import sys


def test_zoneinfo_fallback_resolves_backward_alias_timezones() -> None:
    # python:3.11-slim ships /usr/share/zoneinfo without backward-compat
    # aliases (e.g. Asia/Saigon), but browsers send those aliases. With OS
    # tzdata unavailable, zoneinfo must resolve them via the bundled
    # tzdata package.
    script = (
        "import zoneinfo; zoneinfo.reset_tzpath(to=()); "
        "zoneinfo.ZoneInfo('Asia/Saigon'); print('ok')"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
