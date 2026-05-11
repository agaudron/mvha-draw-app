#!/usr/bin/env python3
"""
Parse all Manning Valley Hockey Association 2026 Junior draw PDFs from the
scripts/juniors/ directory into a single structured juniors.json file.
"""

import re
import json
import subprocess
from pathlib import Path

JUNIORS_DIR = Path(__file__).parent / "juniors"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "juniors.json"

KNOWN_DIVISIONS = {
    "Juniors Division 1": {"key": "Div 1",  "label": "Division 1", "gender": "Mixed", "ageGroup": "Junior"},
    "Juniors Division 2": {"key": "Div 2",  "label": "Division 2", "gender": "Mixed", "ageGroup": "Junior"},
    "Juniors HIN2H U12’s": {"key": "U12s",   "label": "Under 12s",  "gender": "Mixed", "ageGroup": "Under 12s"},
    "Juniors HIN2H U10’s": {"key": "U10s",   "label": "Under 10s",  "gender": "Mixed", "ageGroup": "Under 10s"},
    "Juniors HIN2H U8’s":  {"key": "U8s",    "label": "Under 8s",   "gender": "Mixed", "ageGroup": "Under 8s"},
}

# Old fallbacks
KNOWN_DIVISIONS.update({
    "1":    {"key": "Div 1",  "label": "Division 1", "gender": "Mixed", "ageGroup": "Junior"},
    "2":    {"key": "Div 2",  "label": "Division 2", "gender": "Mixed", "ageGroup": "Junior"},
    "U 12": {"key": "U12s",   "label": "Under 12s",  "gender": "Mixed", "ageGroup": "Under 12s"},
    "U12":  {"key": "U12s",   "label": "Under 12s",  "gender": "Mixed", "ageGroup": "Under 12s"},
    "U 10": {"key": "U10s",   "label": "Under 10s",  "gender": "Mixed", "ageGroup": "Under 10s"},
    "U10":  {"key": "U10s",   "label": "Under 10s",  "gender": "Mixed", "ageGroup": "Under 10s"},
    "U8":   {"key": "U8s",    "label": "Under 8s",   "gender": "Mixed", "ageGroup": "Under 8s"},
    "U 8":  {"key": "U8s",    "label": "Under 8s",   "gender": "Mixed", "ageGroup": "Under 8s"},
})

KEY_TO_INFO = {v["key"]: v for v in KNOWN_DIVISIONS.values()}

MONTH_ABBR = {
    "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April",
    "May": "May",     "Jun": "June",     "Jul": "July",  "Aug": "August",
    "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December",
}
MONTH_NUM = {abbr: i+1 for i, abbr in enumerate(MONTH_ABBR)}

def ordinal(n):
    if 11 <= n % 100 <= 13: return f"{n}th"
    return f"{n}{['th','st','nd','rd','th','th','th','th','th','th'][n % 10]}"

def parse_date(raw):
    m = re.search(r'([A-Za-z]{3})\s+(\d{1,2})\s+([A-Za-z]{3})\s+\d{4}', raw)
    if not m:
        return None, None, (99, 99)
    day_name = m.group(1)
    day_num = int(m.group(2))
    mon_abbr = m.group(3).capitalize()
    
    full_day_name = {
        "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday",
        "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday"
    }.get(day_name, day_name)
    
    month_name = MONTH_ABBR.get(mon_abbr, mon_abbr)
    return full_day_name, f"{month_name} {ordinal(day_num)}", (MONTH_NUM.get(mon_abbr, 9), day_num)

TEAM_FIXES = {
    r"Gl\s*ouces\s*ter": "Gloucester",
    r"Tacking\s+Point\s+Thunder": "Tacking Point Thunder",
    r"Great\s+Lakes\s+Strikers": "Great Lakes Strikers",
    r"Taree\s+West": "Taree West",
}

def normalise_team(raw):
    if not raw: return None
    t = raw.strip()
    for pattern, replacement in TEAM_FIXES.items():
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)
    return t if t else None

FIELD_NAME_MAP = {'T3': 'Field 3'}
def normalise_field(raw):
    if not raw: return None
    return FIELD_NAME_MAP.get(raw.strip(), raw.strip())

def parse_pdf(pdf_path):
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True)
    pages = result.stdout.split('\x0c')
    
    matches = []
    
    for page in pages:
        lines = page.splitlines()
        header_idx = -1
        col_bounds = []
        for i, line in enumerate(lines):
            if "Division" in line and "Day" in line and "Team 1" in line:
                header_idx = i
                col_bounds = [
                    line.find("Division"),
                    line.find("Day"),
                    line.find("Time"),
                    line.find("Subvenue"),
                    line.find("Team 1"),
                    line.find("Team 2"),
                    line.find("Umpires")
                ]
                if col_bounds[6] == -1: col_bounds[6] = len(line)
                padded_bounds = [col_bounds[0]]
                for j in range(1, len(col_bounds)):
                    boundary = col_bounds[j] - 2
                    if boundary <= padded_bounds[-1]:
                        boundary = col_bounds[j]
                    padded_bounds.append(boundary)
                padded_bounds.append(999)
                col_bounds = padded_bounds
                break
                
        if header_idx == -1:
            continue
            
        blocks = []
        current_block = []
        for line in lines[header_idx+1:]:
            if "Page " in line and "Accessed at" in line: break
            if "Round " in line and "Week starting" in line:
                if current_block: blocks.append(current_block); current_block = []
                continue
            if not line.strip():
                if current_block: blocks.append(current_block); current_block = []
            else:
                current_block.append(line)
        if current_block: blocks.append(current_block)
            
        for block in blocks:
            cols = { "div": [], "day": [], "time": [], "subvenue": [], "team1": [], "team2": [], "ump": [] }
            keys = ["div", "day", "time", "subvenue", "team1", "team2", "ump"]
            
            for line in block:
                for i in range(7):
                    start = col_bounds[i]
                    end = col_bounds[i+1]
                    if start < len(line):
                        text = line[start:end].strip()
                        if text: cols[keys[i]].append(text)
                            
            day_raw = " ".join(cols["day"])
            day_name, date_str, sort_key = parse_date(day_raw)
            if date_str:
                div_raw = " ".join(cols["div"])
                div_info = KNOWN_DIVISIONS.get(div_raw, {})
                team_a = normalise_team(" ".join(cols["team1"]))
                team_b = normalise_team(" ".join(cols["team2"]))
                
                is_bye = False
                if team_b and team_b.upper() in ("BYE", "MVHA"):
                    is_bye = True
                
                # Time needs PM addition if missing, e.g. '10:20' -> '10:20AM' / '11:25' -> '11:25AM'
                time_raw = " ".join(cols["time"]).strip()
                if time_raw and not time_raw.lower().endswith(("am", "pm")):
                    h = int(time_raw.split(":")[0])
                    time_raw += "AM" if h >= 8 and h < 12 else "PM"
                
                matches.append({
                    "day": day_name,
                    "grade": div_info.get("key", div_raw),
                    "gradeLabel": div_info.get("label", div_raw),
                    "ageGroup": div_info.get("ageGroup", "Junior"),
                    "gender": div_info.get("gender", "Mixed"),
                    "date": date_str,
                    "_sort": sort_key,
                    "time": time_raw if not is_bye else None,
                    "field": normalise_field(" ".join(cols["subvenue"])) if not is_bye else None,
                    "teamA": team_a,
                    "teamB": "BYE" if is_bye else team_b,
                    "isBye": is_bye,
                })
                
    return matches

def main():
    all_matches = []
    pdf_files = sorted(JUNIORS_DIR.glob("*-new.pdf"))
    if not pdf_files:
        print(f"⚠  No new PDFs found in {JUNIORS_DIR}")
        return
        
    for pdf_path in pdf_files:
        print(f"📄 Parsing {pdf_path.name}...")
        matches = parse_pdf(pdf_path)
        all_matches.extend(matches)
        
    all_matches.sort(key=lambda x: (x["_sort"], x.get("time") or ""))
    for m in all_matches:
        del m["_sort"]
        
    seen_grades = {}
    for m in all_matches:
        k = m["grade"]
        if k and k not in seen_grades:
            seen_grades[k] = {
                "key": k,
                "label": m["gradeLabel"],
                "gender": m["gender"],
                "ageGroup": m["ageGroup"],
            }
            
    GRADE_ORDER = ["Div 1", "Div 2", "U12s", "U10s", "U8s"]
    grades = sorted(seen_grades.values(), key=lambda g: GRADE_ORDER.index(g["key"]) if g["key"] in GRADE_ORDER else 99)
    
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

if __name__ == "__main__":
    main()
