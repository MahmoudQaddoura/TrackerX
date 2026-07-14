"""Convert the Task Tracker sheet from the prototype Excel file to CSV."""

import csv
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

PROTOTYPE_DIR = Path(__file__).resolve().parent.parent
XLSX_PATH = PROTOTYPE_DIR / "PSUT AI Knowledge base Phase 2 Project Plan_Updated_Final.xlsx"
CSV_PATH = PROTOTYPE_DIR / "data" / "sample_project.csv"

COLUMNS = [
    "#",
    "Task",
    "Description",
    "Est. Acc Days",
    "Assignee",
    "Internal Delays",
    "Client Delays",
]

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def _col_to_idx(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n


def _col_row(ref: str) -> tuple[str, int]:
    col = "".join(c for c in ref if c.isalpha())
    row = int("".join(c for c in ref if c.isdigit()))
    return col, row


def _read_shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall(".//m:si", NS):
        texts = [t.text or "" for t in si.findall(".//m:t", NS)]
        strings.append("".join(texts))
    return strings


def _read_sheet_rows(z: zipfile.ZipFile, shared: list[str]) -> list[list[str]]:
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    parsed: dict[int, dict[int, str]] = {}

    for row_el in root.findall(".//m:sheetData/m:row", NS):
        rnum = int(row_el.get("r"))
        parsed[rnum] = {}
        for cell in row_el.findall("m:c", NS):
            ref = cell.get("r")
            _, _ = _col_row(ref)
            col_idx = _col_to_idx(_col_row(ref)[0])
            v_el = cell.find("m:v", NS)
            if v_el is None:
                val = ""
            elif cell.get("t") == "s":
                val = shared[int(v_el.text)]
            else:
                val = v_el.text or ""
            parsed[rnum][col_idx] = val

    rows = []
    for rnum in sorted(parsed.keys()):
        cells = [str(parsed[rnum].get(i, "")).strip() for i in range(1, 6)]
        if not any(cells):
            continue
        if cells[0] == "#" and cells[1] == "Task":
            continue
        cells.extend(["", ""])
        rows.append(cells)
    return rows


def convert() -> None:
    with zipfile.ZipFile(XLSX_PATH) as z:
        shared = _read_shared_strings(z)
        data_rows = _read_sheet_rows(z, shared)

    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(COLUMNS)
        writer.writerows(data_rows)

    print(f"Wrote {len(data_rows)} rows to {CSV_PATH}")


if __name__ == "__main__":
    convert()
