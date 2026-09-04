from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest

_shared_test_database = Path(tempfile.gettempdir()) / "trackerx_unit_tests.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_shared_test_database.as_posix()}")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from app.db import Base
from app.deps import get_authenticated_user
from app.models import User
from app.security import create_access_token, hash_password
from app.services.login_throttle import LoginThrottle
from app.services.password_policy import password_policy_errors, validate_password


def _request_with_cookie(name: str, value: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/me",
            "headers": [(b"cookie", f"{name}={value}".encode("ascii"))],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


class AuthenticationSecurityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_password_policy_rejects_common_identity_and_weak_passwords(self):
        self.assertTrue(password_policy_errors("password123!"))
        self.assertTrue(password_policy_errors("Mahmoud-Secure-2026!", ("Mahmoud",)))
        with self.assertRaises(ValueError):
            validate_password("onlylowercase")
        validate_password("Ridge!Cobalt47", ("person@example.com", "Person Name"))

    def test_login_throttle_limits_accounts_and_expires_the_window(self):
        now = [100.0]
        throttle = LoginThrottle(account_limit=2, address_limit=10, window_seconds=30, clock=lambda: now[0])
        throttle.record_failure("127.0.0.1", "person@example.com")
        throttle.record_failure("127.0.0.1", "person@example.com")
        self.assertGreater(throttle.retry_after("127.0.0.1", "person@example.com"), 0)
        now[0] += 31
        self.assertEqual(throttle.retry_after("127.0.0.1", "person@example.com"), 0)

    def test_auth_version_revokes_existing_cookie_token(self):
        with Session(self.engine) as db:
            user = User(
                email="person@example.com",
                hashed_password=hash_password("Ridge!Cobalt47"),
                full_name="Person Name",
                role="developer",
                access_level="read",
                auth_version=0,
            )
            db.add(user)
            db.commit()
            token = create_access_token(user.id, user.role, user.auth_version)
            request = _request_with_cookie("trackerx_session", token)
            self.assertEqual(get_authenticated_user(request, None, db).id, user.id)

            user.auth_version = 1
            db.commit()
            with self.assertRaises(HTTPException) as caught:
                get_authenticated_user(request, None, db)
            self.assertEqual(caught.exception.status_code, 401)

    def test_login_route_is_registered_once_with_the_login_handler(self):
        from app.routers.auth import router

        routes = [
            route
            for route in router.routes
            if getattr(route, "path", None) == "/auth/login"
            and "POST" in getattr(route, "methods", set())
        ]
        self.assertEqual(len(routes), 1)
        self.assertEqual(routes[0].endpoint.__name__, "login")


if __name__ == "__main__":
    unittest.main()
