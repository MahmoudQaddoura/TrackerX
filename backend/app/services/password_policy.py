from __future__ import annotations

"""One password policy shared by bootstrap, provisioning, resets, and users."""

import re


MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_BYTES = 72  # bcrypt's safe input boundary

_COMMON_PASSWORDS = {
    "admin123456!",
    "changeme123!",
    "password123!",
    "password1234",
    "qwerty123456!",
    "trackerx123!",
    "welcome12345!",
}


def password_policy_errors(password: str, identity_values: tuple[str, ...] = ()) -> list[str]:
    errors: list[str] = []
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"Use at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        errors.append(f"Use no more than {MAX_PASSWORD_BYTES} UTF-8 bytes.")

    classes = sum(
        bool(pattern.search(password))
        for pattern in (
            re.compile(r"[a-z]"),
            re.compile(r"[A-Z]"),
            re.compile(r"\d"),
            re.compile(r"[^A-Za-z0-9]"),
        )
    )
    if classes < 3:
        errors.append("Use at least three of: lowercase, uppercase, number, and symbol.")
    if password.casefold() in _COMMON_PASSWORDS:
        errors.append("Choose a password that is not commonly used.")
    if re.search(r"(.)\1{5,}", password):
        errors.append("Avoid long runs of the same character.")

    folded = password.casefold()
    for value in identity_values:
        tokens = re.findall(r"[a-z0-9]{4,}", value.casefold())
        if any(token in folded for token in tokens):
            errors.append("Do not include your name or email in the password.")
            break
    return errors


def validate_password(password: str, identity_values: tuple[str, ...] = ()) -> None:
    errors = password_policy_errors(password, identity_values)
    if errors:
        raise ValueError(" ".join(errors))
