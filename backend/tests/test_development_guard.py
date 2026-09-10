from __future__ import annotations

import unittest
from unittest.mock import patch

from app.config import settings
from app.services.development_guard import require_non_production


class DevelopmentGuardTests(unittest.TestCase):
    def test_destructive_seed_is_rejected_in_production(self) -> None:
        with patch.object(settings, "environment", "production"):
            with self.assertRaisesRegex(RuntimeError, "Refusing to run"):
                require_non_production("sample data")

    def test_guard_allows_test_environment(self) -> None:
        with patch.object(settings, "environment", "test"):
            require_non_production("sample data")


if __name__ == "__main__":
    unittest.main()
