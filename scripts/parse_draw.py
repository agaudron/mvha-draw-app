#!/usr/bin/env python3
"""
Parse the Manning Valley Hockey Association 2026 draw from layout-preserved text
extracted via `pdftotext -layout` into a structured JSON file.
"""

import re
import json
import subprocess
from pathlib import Path

PDF_PATH = Path(__file__).parent / "hockey2026.pdf"
OUTPUT_PATH = Path(__file__).parent / "../public/matches.json"

# Run pdftotext -layout to get the structured text
result = subprocess.run(
    ["pdftotext", "-layout", str(PDF_PATH), "-"],
    capture_output=True, text=True
)
raw_text = result.stdout

# ------------------------------------------------------------------------------
# Known teams for fuzzy matching / disambiguation
# ------------------------------------------------------------------------------
KNOWN_TEAMS = [
    "Sharks", "Tigers", "Chatham", "Taree West", "Wingham",
    "Great Lakes Strikers", "Gloucester", "Cougars",
    "Tacking Point Thunder"
]

KNOWN_GRADES = {
    "B-Grade M": {"label": "B-Grade", "gender": "Men"},
    "C-Grade M": {"label": "C-Grade", "gender": "Men"},
    "MNCHL M":   {"label": "MNCHL",   "gender": "Men"},
    "Div 1 W":   {"label": "Div 1",   "gender": "Women"},
    "Div 2 W":   {"label": "Div 2",   "gender": "Women"},
    "Div 3 W":   {"label": "Div 3",   "gender": "Women"},
    "Div 3 M":   {"label": "Div 3",   "gender": "Women"},
    "MNCHL W":   {"label": "MNCHL",   "gender": "Women"},
    "NSW":       {"label": "NSW",      "gender": "Mixed"},
}

# Regex to match a main draw row. The layout-preserved text keeps columns aligned.
# Pattern: day  grade  date  time  field  teamA  V  teamB
# Pattern: day  grade  date  time  field  teamA  V  teamB
ROW_RE = re.compile(
    r'^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'
    r'\s+(B-Grade\s+M|C-Grade\s+M|MNCHL\s+M|MNCHL\s+W|Div\s+1\s+W|Div\s+2\s+W|Div\s+3\s+W|Div\s+3\s+M|NSW)?'
    r'\s+((?:March|April|May|June|July|August|September|October)\s+\d+(?:st|nd|rd|th))'
    r'\s+(\d+\.\d+(?:am|pm)?)'
    r'\s+(ATF|TLF|Field 3|Port|TLF_EAST)?'
    r'\s+(.*?)\s+V\s+(.*?)$'
)

BYE_RE = re.compile(
    r'^\s*(B-Grade\s+M|C-Grade\s+M|MNCHL\s+M|MNCHL\s+W|Div\s+1\s+W|Div\s+2\s+W|Div\s+3\s+W|Div\s+3\s+M|NSW)'
    r'\s+((?:March|April|May|June|July|August|September|October)\s+\d+(?:st|nd|rd|th))\s+BYE\s*(.*?)$'
)

matches = []
byes = []

for line in raw_text.splitlines():
    # Skip page headers / notes
    if "Manning Valley" in line or "Please note" in line or not line.strip():
        continue
    if "Midweek" in line or "MIDWEEK" in line or "Under 14" in line or "State Champ" in line:
        continue

    m = ROW_RE.match(line)
    if m:
        day, grade_raw, date_raw, time_raw, field_raw, team_a, team_b = m.groups()
        grade_raw = re.sub(r'\s+', ' ', (grade_raw or "").strip())
        
        if grade_raw == "Div 3 M":
            grade_raw = "Div 3 W"
            
        team_a = team_a.strip()
        team_b = team_b.strip()
        field = (field_raw or "").strip()
        # Normalize time — add pm if absent
        time_str = time_raw.strip()
        if not time_str.endswith(("am", "pm")):
            time_str += "pm"

        # Strip umpire info appended after team_b (heuristic: umpire cols are far right)
        # Just take first "word groups" that look like a team name
        def clean_team(t):
            t = t.strip()
            # Remove trailing umpire names — they appear after two or more spaces
            t = re.split(r'\s{3,}', t)[0].strip()
            return t if t else None

        match_obj = {
            "day": day.strip(),
            "grade": grade_raw if grade_raw else None,
            "gender": KNOWN_GRADES.get(grade_raw, {}).get("gender"),
            "gradeLabel": KNOWN_GRADES.get(grade_raw, {}).get("label", grade_raw),
            "date": date_raw.strip(),
            "time": time_str,
            "field": field if field else None,
            "teamA": clean_team(team_a),
            "teamB": clean_team(team_b),
            "isBye": False,
        }
        # Only include rows where at least one team name is present
        if match_obj["teamA"] == "TBA" or match_obj["teamB"] == "TBA":
            continue
            
        if match_obj["teamA"] or match_obj["teamB"]:
            matches.append(match_obj)
        continue

    b = BYE_RE.match(line)
    if b:
        grade_raw, date_raw, bye_team = b.groups()
        grade_raw = re.sub(r'\s+', ' ', (grade_raw or "").strip())
        
        if grade_raw == "Div 3 M":
            grade_raw = "Div 3 W"
            
        team_name = bye_team.strip() if bye_team and bye_team.strip() else "TBA"
        
        if team_name == "TBA":
            continue
            
        byes.append({
            "grade": grade_raw.strip(),
            "gradeLabel": KNOWN_GRADES.get(grade_raw.strip(), {}).get("label", grade_raw.strip()),
            "gender": KNOWN_GRADES.get(grade_raw.strip(), {}).get("gender"),
            "date": date_raw.strip(),
            "team": team_name,
            "isBye": True,
        })

# Merge byes into matches list as synthetic "bye" entries
for bye in byes:
    matches.append({
        "day": None,
        "grade": bye["grade"],
        "gender": bye["gender"],
        "gradeLabel": bye["gradeLabel"],
        "date": bye["date"],
        "time": None,
        "field": None,
        "teamA": bye["team"],
        "teamB": "BYE",
        "isBye": True,
    })

# Sort chronologically: map month names to numbers
MONTHS = {"March": 3, "April": 4, "May": 5, "June": 6, "July": 7}

def date_sort_key(m):
    date_str = m.get("date") or ""
    parts = date_str.split()
    if len(parts) >= 2:
        month = MONTHS.get(parts[0], 9)
        day_num = int(re.sub(r'\D', '', parts[1]))
        return (month, day_num)
    return (9, 99)

matches.sort(key=date_sort_key)

output = {
    "competition": "Manning Valley Hockey Association 2026 Senior Competition",
    "matches": matches,
    "teams": sorted(KNOWN_TEAMS),
    "grades": [
        {"key": k, "label": v["label"], "gender": v["gender"]}
        for k, v in KNOWN_GRADES.items()
    ],
}

with open(OUTPUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"✅ Wrote {len(matches)} entries (incl. {len(byes)} byes) to {OUTPUT_PATH}")
