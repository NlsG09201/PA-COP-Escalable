"""
Legacy bulk seed script (previously used PostgreSQL + Mongo).

The application no longer uses PostgreSQL. To seed demo data, use MongoDB
collections directly (e.g. via LocalBootstrap or custom pymongo scripts) or
reimplement this script using only MongoDB for organizations, patients, and
appointments.

This stub is kept so CI/docs that reference the old path fail fast with a
clear message instead of a broken psycopg2 connection.
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "This seed script is disabled: PostgreSQL was removed from the stack. "
        "Implement Mongo-only inserts or extend LocalBootstrap.",
        file=sys.stderr,
    )
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
