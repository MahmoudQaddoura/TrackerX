from __future__ import annotations

"""Run the backend suite with an isolated database selected before app imports."""

import os
from pathlib import Path
import sys
import tempfile
import unittest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="trackerx-tests-") as temp_name:
        database = Path(temp_name) / "test.db"
        os.environ["DATABASE_URL"] = f"sqlite:///{database.as_posix()}"
        os.environ["ENVIRONMENT"] = "test"
        os.environ["BACKUP_ON_STARTUP"] = "false"
        os.environ["DOCUMENT_STORAGE"] = "local"
        os.environ["DOCUMENTS_DIR"] = str(Path(temp_name) / "documents")
        os.environ["BACKUP_DIR"] = str(Path(temp_name) / "backups")
        suite = unittest.defaultTestLoader.discover(
            str(BACKEND_ROOT / "tests"),
            pattern="test_*.py",
        )
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        # Release SQLite file handles before TemporaryDirectory removes the
        # disposable database. This matters on Windows, where open files cannot
        # be unlinked and a passing suite would otherwise report a false failure.
        from app.db import engine

        engine.dispose()
        return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
