"""Export the shared API snapshot without connecting to PostgreSQL."""

import json
from pathlib import Path

from app.main import app


def main():
    destination = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(app.openapi(), indent=2) + "\n")
    print(f"Exported {destination.name}")


if __name__ == "__main__":
    main()
