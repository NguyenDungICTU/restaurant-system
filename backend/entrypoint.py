"""Container startup: migrate the database, seed development data, then run API."""

import os
import subprocess
import sys
import time


def run_migrations() -> None:
    retries = int(os.getenv("DB_MIGRATION_RETRIES", "12"))
    delay = float(os.getenv("DB_MIGRATION_RETRY_DELAY", "2"))

    for attempt in range(1, retries + 1):
        print(f"Running database migrations (attempt {attempt}/{retries})...", flush=True)
        result = subprocess.run(["alembic", "upgrade", "head"], check=False)
        if result.returncode == 0:
            print("Database migrations completed.", flush=True)
            return

        if attempt == retries:
            raise SystemExit(result.returncode or 1)

        time.sleep(delay)


def main() -> None:
    run_migrations()

    if os.getenv("SEED_DEMO_ACCOUNT", "true").lower() in {"1", "true", "yes", "on"}:
        print("Seeding development demo account...", flush=True)
        result = subprocess.run([sys.executable, "-m", "app.seed_demo"], check=False)
        if result.returncode != 0:
            raise SystemExit(result.returncode)
    else:
        print("Demo account seeding is disabled.", flush=True)

    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
