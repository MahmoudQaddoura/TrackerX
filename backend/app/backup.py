from __future__ import annotations

"""Command-line entry point for portable TrackerX data backups."""

import argparse
import json
from pathlib import Path

from app.services.data_backup import create_data_backup, verify_data_backup


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Back up the TrackerX SQLite database and uploaded documents together."
    )
    parser.add_argument("--output-dir", type=Path, help="Backup destination directory.")
    parser.add_argument("--reason", default="manual", help="Short label stored in the manifest.")
    parser.add_argument("--keep", type=int, help="Number of newest TrackerX backups to retain.")
    parser.add_argument("--verify", type=Path, help="Verify an existing backup instead of creating one.")
    args = parser.parse_args()

    if args.verify:
        result = verify_data_backup(args.verify)
        result.pop("manifest", None)
    else:
        result = create_data_backup(
            output_dir=args.output_dir,
            reason=args.reason,
            keep=args.keep,
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
