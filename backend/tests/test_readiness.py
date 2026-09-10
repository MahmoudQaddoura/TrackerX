from __future__ import annotations

import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db import Base
from app.models import User
from app.services.readiness import (
    REQUIRED_TABLES,
    ReadinessError,
    check_database_readiness,
    validate_existing_production_database,
)


class ReadinessTests(unittest.TestCase):
    def test_readiness_manifest_covers_every_model_table(self) -> None:
        self.assertEqual(REQUIRED_TABLES, frozenset(Base.metadata.tables))

    def test_complete_database_with_user_is_ready(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            db.add(
                User(
                    email="owner@readiness.test",
                    hashed_password="x",
                    full_name="Owner",
                    role="admin",
                    access_level="write",
                    is_enabled=1,
                )
            )
            db.commit()
            result = check_database_readiness(db, require_users=True)
        self.assertEqual(
            result,
            {"database": "ok", "schema": "ok", "integrity": "ok"},
        )
        engine.dispose()

    def test_database_without_users_is_not_production_ready(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        with Session(engine) as db, self.assertRaises(ReadinessError) as error:
            check_database_readiness(db, require_users=True)
        self.assertIn("no user accounts", str(error.exception))
        engine.dispose()

    def test_incomplete_schema_is_not_ready(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        with Session(engine) as db, self.assertRaises(ReadinessError) as error:
            check_database_readiness(db, require_users=False)
        self.assertIn("missing tables", str(error.exception))
        engine.dispose()

    def test_production_refuses_an_empty_database_before_migration(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        with self.assertRaises(ReadinessError) as error:
            validate_existing_production_database(engine, production=True)
        self.assertIn("restore a verified backup", str(error.exception))
        engine.dispose()

    def test_development_allows_initial_database_creation(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        validate_existing_production_database(engine, production=False)
        engine.dispose()
