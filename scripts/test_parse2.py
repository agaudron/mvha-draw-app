import re
import subprocess

def parse_revsport_pdf(pdf_path):
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True)
    lines = result.stdout.splitlines()
    
    matches = []
    
    col_bounds = []
    in_table = False
    
    blocks = []
    current_block = []
    
    for line in lines:
        if "Division" in line and "Day" in line and "Time" in line and "Team 1" in line:
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
            col_bounds.append(999)
            in_table = True
            continue
            
        if not in_table:
            continue
            
        if "Page " in line and "Accessed at" in line:
            if current_block: blocks.append(current_block); current_block = []
            in_table = False
            continue
            
        if "Round " in line and "Week starting" in line:
            if current_block: blocks.append(current_block); current_block = []
            in_table = False
            continue
            
        if not line.strip():
            if current_block:
                blocks.append(current_block)
                current_block = []
            continue
            
        current_block.append(line)
        
    if current_block:
        blocks.append(current_block)
        
    for block in blocks:
        # Check if block is a match (has a day/date in the Date column)
        # We need to extract columns for all lines in the block
        cols = { "div": [], "day": [], "time": [], "subvenue": [], "team1": [], "team2": [], "ump": [] }
        keys = ["div", "day", "time", "subvenue", "team1", "team2", "ump"]
        
        for line in block:
            for i in range(7):
                start = col_bounds[i]
                end = col_bounds[i+1]
                if start != -1 and start < len(line):
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

print(parse_revsport_pdf("/home/agaudron/git-ext/mvha-draw-app/scripts/juniors/under-10-new.pdf")[:5])
