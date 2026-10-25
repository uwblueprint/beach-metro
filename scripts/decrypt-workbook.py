"""Turn the office workbook into one CSV per sheet, for the legacy importer.

    pnpm import:convert ~/Downloads/RouteLabelsFileBMN.xlsx

The workbook is Office-encrypted, which Node cannot open, so this step runs in
Python and the importer reads the CSVs it writes. Output goes to .data/sheets/,
which is gitignored. The file holds real names, home addresses and phone
numbers, so nothing it produces belongs anywhere near a commit.

Needs msoffcrypto-tool and openpyxl. The password is prompted for unless
BMN_WORKBOOK_PASSWORD is set.
"""

from __future__ import annotations

import csv
import getpass
import io
import os
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import msoffcrypto
    import openpyxl
except ImportError:
    sys.exit(
        "missing dependencies. Create a virtualenv and run\n"
        "  pip install msoffcrypto-tool openpyxl"
    )

OUT_DIR = Path(__file__).resolve().parent.parent / ".data" / "sheets"


def cell(value: object) -> str:
    """One cell as the importer wants to read it.

    Dates become ISO so the importer never has to guess a day-month order, and
    a float that is really an integer loses its trailing .0 so a paper count
    reads as 50 rather than 50.0.
    """
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def sheet_filename(name: str) -> str:
    """A sheet's file name, trimmed and flattened.

    One sheet is named with a trailing space, which reaches the importer as a
    different name than anyone would type.
    """
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in name.strip())
    return f"{safe}.csv"


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {Path(sys.argv[0]).name} <workbook.xlsx>", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).expanduser()
    if not source.is_file():
        print(f"error: {source} not found", file=sys.stderr)
        return 1

    password = os.environ.get("BMN_WORKBOOK_PASSWORD") or getpass.getpass("workbook password: ")

    decrypted = io.BytesIO()
    with source.open("rb") as handle:
        office = msoffcrypto.OfficeFile(handle)
        try:
            office.load_key(password=password)
            office.decrypt(decrypted)
        except Exception as err:
            print(f"error: could not decrypt {source.name} ({err})", file=sys.stderr)
            return 1

    workbook = openpyxl.load_workbook(decrypted, data_only=True, read_only=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.csv"):
        stale.unlink()

    for name in workbook.sheetnames:
        rows = list(workbook[name].iter_rows(values_only=True))
        # Trailing blank rows are an artifact of how the sheet was edited, not
        # data, and they would otherwise reach the importer as empty records.
        while rows and all(value is None for value in rows[-1]):
            rows.pop()
        path = OUT_DIR / sheet_filename(name)
        with path.open("w", newline="", encoding="utf-8") as out:
            writer = csv.writer(out)
            for row in rows:
                writer.writerow([cell(value) for value in row])
        # Permissions before content would be better, but the file has to exist
        # first; nothing else reads this directory in between.
        path.chmod(0o600)
        print(f"  {path.name}  {len(rows)} rows")

    print(f"\nwrote {len(workbook.sheetnames)} sheets to {OUT_DIR}")
    print("These hold real personal data. Delete them when the import is done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
