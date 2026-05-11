import re

KNOWN_TEAMS = [
    "Sharks", "Tigers", "Chatham", "Taree West", "Wingham",
    "Great Lakes Strikers", "Gloucester", "Cougars",
    "Tacking Point Thunder"
]

team_b_strings = [
    "Tacking Point Thunder Janene Watts (Tigers D1-W)          Thomas Davy (TareeWest D2-W)",
    "Tacking Point ThunderBlake Chivas (Sharks D1-W)",
    "Wingham",
    "Tigers"
]

for team_b in team_b_strings:
    team_b_clean = None
    rest_of_b = ""
    for kt in sorted(KNOWN_TEAMS, key=len, reverse=True):
        if re.match(re.escape(kt), team_b.strip(), re.IGNORECASE):
            team_b_clean = kt
            # find actual length in original string
            m = re.match(re.escape(kt), team_b.strip(), re.IGNORECASE)
            rest_of_b = team_b.strip()[m.end():].strip()
            break
            
    if not team_b_clean:
        team_b_parts = re.split(r'\s{3,}', team_b.strip())
        team_b_clean = team_b_parts[0] if team_b_parts else None
        rest_of_b = team_b.strip()[len(team_b_clean):].strip() if team_b_clean else ""
        
    umpires_raw = [p.strip() for p in re.split(r'\s{3,}', rest_of_b) if p.strip() and p.strip() != '&']
    
    print(f"B: {team_b_clean} | UMPS: {umpires_raw}")
