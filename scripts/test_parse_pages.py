import re
import subprocess
import json

def parse_pdf(pdf_path):
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True)
    pages = result.stdout.split('\x0c') # Form feed separates pages
    
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
                # Pad boundaries backwards by 2 spaces to catch spillovers like 'lor'
                # But don't overlap previous column
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
            if "Page " in line and "Accessed at" in line:
                break
            if not line.strip():
                if current_block:
                    blocks.append(current_block)
                    current_block = []
            else:
                current_block.append(line)
        if current_block:
            blocks.append(current_block)
            
        for block in blocks:
            cols = { "div": [], "day": [], "time": [], "subvenue": [], "team1": [], "team2": [], "ump": [] }
            keys = ["div", "day", "time", "subvenue", "team1", "team2", "ump"]
            
            for line in block:
                for i in range(7):
                    start = col_bounds[i]
                    end = col_bounds[i+1]
                    if start < len(line):
                        text = line[start:end].strip()
                        if text:
                            cols[keys[i]].append(text)
                            
            day_raw = " ".join(cols["day"])
            if re.search(r'\d{1,2} [A-Za-z]{3} \d{4}', day_raw):
                matches.append({
                    "div": " ".join(cols["div"]),
                    "day_raw": day_raw,
                    "time": " ".join(cols["time"]),
                    "subvenue": " ".join(cols["subvenue"]),
                    "team1": " ".join(cols["team1"]),
                    "team2": " ".join(cols["team2"]),
                    "ump": " ".join(cols["ump"])
                })
                
    return matches

print(json.dumps(parse_pdf("/home/agaudron/git-ext/mvha-draw-app/scripts/juniors/under-10-new.pdf")[:5], indent=2))
