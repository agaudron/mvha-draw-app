#!/usr/bin/env python3
"""
Parse all Manning Valley Hockey Association 2026 Junior draw PDFs from the
scripts/juniors/ directory into a single structured juniors.json file.

Junior PDFs use a different layout to the senior draw:
  Round  Day       Division  Date         Time       Field    Team A    V   Team B   [Umpires...]

Date format: DD-Mon-YY  (e.g. 21-Mar-26)
"""

import re
import json
import subprocess
from pathlib import Path

JUNIORS_DIR = Path(__file__).parent / "juniors"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "juniors.json"

# ---------------------------------------------------------------------------
# Division / grade metadata
# ---------------------------------------------------------------------------
KNOWN_DIVISIONS = {
    "1":    {"key": "Div 1",  "label": "Division 1", "gender": "Mixed", "ageGroup": "Junior"},
    "2":    {"key": "Div 2",  "label": "Division 2", "gender": "Mixed", "ageGroup": "Junior"},
    "U 12": {"key": "U12s",   "label": "Under 12s",  "gender": "Mixed", "ageGroup": "Under 12s"},
    "U12":  {"key": "U12s",   "label": "Under 12s",  "gender": "Mixed", "ageGroup": "Under 12s"},
    "U 10": {"key": "U10s",   "label": "Under 10s",  "gender": "Mixed", "ageGroup": "Under 10s"},
    "U10":  {"key": "U10s",   "label": "Under 10s",  "gender": "Mixed", "ageGroup": "Under 10s"},
    "U8":   {"key": "U8s",    "label": "Under 8s",   "gender": "Mixed", "ageGroup": "Under 8s"},
    "U 8":  {"key": "U8s",    "label": "Under 8s",   "gender": "Mixed", "ageGroup": "Under 8s"},
}

# Reverse lookup: mapped key → info (for bye handler which only has the already-mapped key)
KEY_TO_INFO = {v["key"]: v for v in KNOWN_DIVISIONS.values()}

KNOWN_TEAMS = [
    "Sharks", "Tigers", "Chatham", "Taree West", "Wingham",
    "Great Lakes Strikers", "Gloucester", "Cougars",
    "Tacking Point Thunder", "MVHA",
]

# ---------------------------------------------------------------------------
# Date parsing  (DD-Mon-YY → "March 21st")
# ---------------------------------------------------------------------------
MONTH_ABBR = {
    "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April",
    "May": "May",     "Jun": "June",     "Jul": "July",  "Aug": "August",
    "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December",
}

MONTH_NUM = {abbr: i+1 for i, abbr in enumerate(MONTH_ABBR)}

def ordinal(n):
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    return f"{n}{['th','st','nd','rd','th','th','th','th','th','th'][n % 10]}"

def parse_date(raw):
    """Convert '21-Mar-26' → ('March 21st', (3, 21))"""
    m = re.match(r'(\d{1,2})-([A-Za-z]{3})-\d{2}', raw.strip())
    if not m:
        return None, (99, 99)
    day = int(m.group(1))
    mon_abbr = m.group(2).capitalize()
    month_name = MONTH_ABBR.get(mon_abbr, mon_abbr)
    return f"{month_name} {ordinal(day)}", (MONTH_NUM.get(mon_abbr, 9), day)

# ---------------------------------------------------------------------------
# Team name normalisation (fix common OCR artefacts)
# ---------------------------------------------------------------------------
TEAM_FIXES = {
    r"Gl\s*ouces\s*ter": "Gloucester",
    r"Tacking\s+Point\s+Thunder": "Tacking Point Thunder",
    r"Great\s+Lakes\s+Strikers": "Great Lakes Strikers",
    r"Taree\s+West": "Taree West",
}

def normalise_team(raw):
    if not raw:
        return None
    t = raw.strip()
    # Strip trailing umpire columns (3+ spaces signals end of meaningful text)
    t = re.split(r'\s{3,}', t)[0].strip()
    for pattern, replacement in TEAM_FIXES.items():
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)
    return t if t else None

FIELD_NAME_MAP = {'T3': 'Field 3'}

def normalise_field(raw):
    if not raw:
        return None
    return FIELD_NAME_MAP.get(raw.strip(), raw.strip())

# ---------------------------------------------------------------------------
# Row detection helpers
# ---------------------------------------------------------------------------
DAY_RE = re.compile(
    r'^\s*\d+\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(.*)',
    re.IGNORECASE
)
DATE_RE = re.compile(r'\d{1,2}-[A-Za-z]{3}-\d{2}')
TIME_RE = re.compile(r'\d+[:.]\d+\s*[APap][Mm]')

KNOWN_DIV_KEYS = set(KNOWN_DIVISIONS.keys())

def parse_row(line):
    """
    Try to parse a match row from a junior PDF line.
    Returns a dict or None.
    """
    dm = DAY_RE.match(line)
    if not dm:
        return None
    day = dm.group(1)
    rest = dm.group(2)

    # Split by 2+ spaces to get column-like tokens
    cols = [c.strip() for c in re.split(r'\s{2,}', rest) if c.strip()]

    # Need at least: div, date, time[+field], teamA, teamB
    if len(cols) < 4:
        return None

    # Find the date column
    date_idx = None
    for i, c in enumerate(cols):
        if DATE_RE.fullmatch(c.strip()):
            date_idx = i
            break
    if date_idx is None:
        return None

    # Division = everything up to the date col (usually just "1", "2", "U 12" etc)
    div_raw = ' '.join(cols[:date_idx]).strip()
    div_info = KNOWN_DIVISIONS.get(div_raw, {})

    # Time column (may include field in the same cell, e.g. "11:25AM T3")
    if date_idx + 1 >= len(cols):
        return None
    time_and_maybe_field = cols[date_idx + 1]
    tm = TIME_RE.search(time_and_maybe_field)
    if not tm:
        return None
    time_raw = tm.group().strip().upper().replace(' ', '')

    # Check if field is embedded in the same cell as time
    after_time = time_and_maybe_field[tm.end():].strip()
    FIELD_RE = re.compile(r'(ATF\s*\d*|TLF(?:_EAST)?|T3|Port)', re.IGNORECASE)
    embedded_field = FIELD_RE.match(after_time)

    if embedded_field:
        # Time and field merged: "11:25AM T3"
        field_raw = embedded_field.group().strip()
        team_cols = cols[date_idx + 2:]   # everything after the merged col
    else:
        # Separate field column
        if date_idx + 2 >= len(cols):
            return None
        field_raw = cols[date_idx + 2]
        team_cols = cols[date_idx + 3:]

    if not team_cols:
        return None

    # Extract teams — may be separated by 'v'/'V' token inside a column, or by columns
    full_team_str = '   '.join(team_cols)   # re-join with separator
    vsplit = re.split(r'\s+[Vv]\s+', full_team_str, maxsplit=1)
    if len(vsplit) == 2:
        team_a = normalise_team(vsplit[0])
        team_b = normalise_team(vsplit[1])
    else:
        # No explicit v — first col is teamA, second is teamB, rest are umpires
        team_a = normalise_team(team_cols[0]) if len(team_cols) > 0 else None
        team_b = normalise_team(team_cols[1]) if len(team_cols) > 1 else None

    if not team_a and not team_b:
        return None

    date_str, sort_key = parse_date(cols[date_idx])

    return {
        "day": day,
        "grade": div_info.get("key", div_raw),
        "gradeLabel": div_info.get("label", div_raw),
        "ageGroup": div_info.get("ageGroup", "Junior"),
        "gender": div_info.get("gender", "Mixed"),
        "date": date_str,
        "_sort": sort_key,
        "time": time_raw,
        "field": normalise_field(field_raw),
        "teamA": team_a,
        "teamB": team_b,
        "isBye": False,
    }


# Standalone bye row — opponent is either "BYE" or "MVHA" (dummy team = bye)
BYE_RE = re.compile(r'^\s+([\w][\w\s]*?)\s{4,}(?:BYE|MVHA)\s*$')

# ---------------------------------------------------------------------------
# Extract text from all junior PDFs and parse
# ---------------------------------------------------------------------------
all_matches = []
all_byes = []

pdf_files = sorted(JUNIORS_DIR.glob("*.pdf"))
if not pdf_files:
    print(f"⚠  No PDFs found in {JUNIORS_DIR}")
    exit(1)

current_division_key = None
current_date = None
current_day = None
current_sort = (99, 99)

for pdf_path in pdf_files:
    print(f"📄 Parsing {pdf_path.name}...")
    result = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        capture_output=True, text=True
    )
    raw_text = result.stdout
    current_division_key = None

    for line in raw_text.splitlines():
        stripped = line.strip()

        if not stripped:
            continue
        if any(kw in stripped for kw in [
            "Manning Valley", "Please note", "Round Day",
            "Easter", "Anzac", "State Champ", "No Hockey",
            "Umpire", "Junior", "Draw", "Division",
        ]):
            continue

        row = parse_row(line)
        if row:
            current_division_key = row["grade"]
            current_date = row["date"]
            current_day = row["day"]
            current_sort = row["_sort"]
            all_matches.append(row)
            continue

        # Try inline bye row
        b = BYE_RE.match(line)
        if b and current_division_key and current_date:
            bye_team = normalise_team(b.group(1))
            if bye_team and bye_team.upper() not in ("BYE", "MVHA"):
                div_info = KEY_TO_INFO.get(current_division_key, {})
                all_matches.append({
                    "day": current_day,
                    "grade": current_division_key,
                    "gradeLabel": div_info.get("label", current_division_key),
                    "ageGroup": div_info.get("ageGroup", "Junior"),
                    "gender": div_info.get("gender", "Mixed"),
                    "date": current_date,
                    "_sort": current_sort,
                    "time": None,
                    "field": None,
                    "teamA": bye_team,
                    "teamB": "BYE",
                    "isBye": True,
                })

# ---------------------------------------------------------------------------
# Sort matches chronologically then by time
# ---------------------------------------------------------------------------
all_matches.sort(key=lambda x: (x["_sort"], x.get("time") or ""))
for m in all_matches:
    del m["_sort"]

# ---------------------------------------------------------------------------
# Build grades list
# ---------------------------------------------------------------------------
seen_grades = {}
for m in all_matches:
    k = m["grade"]
    if k and k not in seen_grades:
        seen_grades[k] = {
            "key": m["grade"],
            "label": m["gradeLabel"],
            "gender": m["gender"],
            "ageGroup": m["ageGroup"],
        }

# Stable sort order
GRADE_ORDER = ["Div 1", "Div 2", "U12s", "U10s", "U8s"]
grades = sorted(seen_grades.values(), key=lambda g: GRADE_ORDER.index(g["key"]) if g["key"] in GRADE_ORDER else 99)

# ---------------------------------------------------------------------------
# Build teams list
# ---------------------------------------------------------------------------
all_team_names = set()
for m in all_matches:
    for t in [m.get("teamA"), m.get("teamB")]:
        if t and t.upper() not in ("BYE", "TBA", "MVHA"):
            all_team_names.add(t)

output = {
    "competition": "Manning Valley Hockey Association 2026 Junior Competition",
    "matches": all_matches,
    "teams": sorted(all_team_names),
    "grades": grades,
}

with open(OUTPUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Wrote {len(all_matches)} matches from {len(pdf_files)} PDF(s) to {OUTPUT_PATH}")
if all_byes:
    print(f"   (Plus {len(all_byes)} detected bye entries — embedded in PDF text, not as separate fixtures)")
