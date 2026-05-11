import re
import subprocess
from pathlib import Path

def parse_revsport_pdf(pdf_path):
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True)
    lines = result.stdout.splitlines()
    
    matches = []
    
    col_bounds = []
    
    in_table = False
    current_match = None
    
    for line in lines:
        if "Division" in line and "Day" in line and "Time" in line and "Team 1" in line:
            # Found header
            col_bounds = [
                line.find("Division"),
                line.find("Day"),
                line.find("Time"),
                line.find("Subvenue"),
                line.find("Team 1"),
                line.find("Team 2"),
                line.find("Umpires")
            ]
            # Replace -1 with len(line) for missing columns
            if col_bounds[6] == -1: col_bounds[6] = len(line)
            col_bounds.append(999) # End of line
            in_table = True
            continue
            
        if not in_table:
            continue
            
        # If line is completely empty, it might mean end of a match block
        if not line.strip():
            if current_match:
                matches.append(current_match)
                current_match = None
            continue
            
        # Ignore page footers
        if "Page " in line and "Accessed at" in line:
            if current_match:
                matches.append(current_match)
                current_match = None
            in_table = False
            continue
        if "Round " in line and "Week starting" in line:
            if current_match:
                matches.append(current_match)
                current_match = None
            in_table = False
            continue
        if "Taree Hockey Centre" in line or "Hockey Centre" in line:
            continue
            
        # Extract columns based on bounds
        cols = []
        for i in range(len(col_bounds) - 1):
            start = col_bounds[i]
            end = col_bounds[i+1]
            if start == -1 or start >= len(line):
                cols.append("")
            else:
                cols.append(line[start:end].strip())
                
        # If Day is present, it's the start of a new match block
        # e.g., "Sat 21 Mar 2026"
        day_str = cols[1]
        time_str = cols[2]
        if day_str and re.match(r'[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{4}', day_str):
            if current_match:
                matches.append(current_match)
            current_match = {
                "division": [cols[0]] if cols[0] else [],
                "day_raw": day_str,
                "time_raw": time_str,
                "subvenue": [cols[3]] if cols[3] else [],
                "team1": [cols[4]] if cols[4] else [],
                "team2": [cols[5]] if cols[5] else [],
                "umpires": [cols[6]] if cols[6] else [],
            }
        elif current_match:
            # Continuation lines
            if cols[0]: current_match["division"].append(cols[0])
            if cols[3]: current_match["subvenue"].append(cols[3])
            if cols[4]: current_match["team1"].append(cols[4])
            if cols[5]: current_match["team2"].append(cols[5])
            if cols[6]: current_match["umpires"].append(cols[6])
            
    if current_match:
        matches.append(current_match)
        
    # Clean up fields
    final_matches = []
    for m in matches:
        div = " ".join(m["division"])
        subv = " ".join(m["subvenue"])
        t1 = " ".join(m["team1"])
        t2 = " ".join(m["team2"])
        umps = " ".join(m["umpires"])
        final_matches.append({
            "div": div,
            "day_raw": m["day_raw"],
            "time": m["time_raw"],
            "subvenue": subv,
            "team1": t1,
            "team2": t2,
            "umpires": umps
        })
    return final_matches

print(parse_revsport_pdf("/home/agaudron/git-ext/mvha-draw-app/scripts/juniors/under-10-new.pdf")[:5])
