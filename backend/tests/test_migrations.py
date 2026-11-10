"""Migration-chain smoke tests.

Guards the Alembic revision graph without touching a database: a broken
down_revision reference, an accidental second head, or a rewired revision
would otherwise pass CI silently (migrations only run at deploy time).
"""

from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parents[1]
HEAVY_HEAD = "011_hevy_integration"


def _script() -> ScriptDirectory:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    return ScriptDirectory.from_config(config)


def test_every_down_revision_resolves() -> None:
    script = _script()
    known = {rev.revision for rev in script.walk_revisions()}

    for rev in script.walk_revisions():
        down = rev.down_revision
        if down is None:
            continue
        # Merge points encode multiple parents as a tuple.
        parents = down if isinstance(down, tuple) else (down,)
        for parent in parents:
            assert parent in known, (
                f"revision {rev.revision!r} points at unknown down_revision {parent!r}"
            )


def test_chain_is_linear_from_base_to_single_head() -> None:
    script = _script()
    heads = script.get_heads()
    assert heads == [HEAVY_HEAD], f"expected single head {HEAVY_HEAD!r}, got {heads!r}"
    assert script.get_base() == "001_initial_schema"

    chain = []
    current = script.get_revision(heads[0])
    while current is not None:
        chain.append(current.revision)
        down = current.down_revision
        assert not isinstance(down, tuple), (
            f"merge point detected at {current.revision!r}: {down!r}"
        )
        current = script.get_revision(down) if down is not None else None

    all_revisions = {rev.revision for rev in script.walk_revisions()}
    assert chain[0] == HEAVY_HEAD
    assert chain[-1] == "001_initial_schema"
    assert len(chain) == len(all_revisions), (
        f"chain visits {len(chain)} revisions but script directory has {len(all_revisions)}"
    )
    assert set(chain) == all_revisions


def test_hevy_migration_builds_on_garmin_metric_snapshots() -> None:
    script = _script()
    rev = script.get_revision(HEAVY_HEAD)
    assert rev is not None
    assert rev.down_revision == "010_garmin_metric_snapshots"
