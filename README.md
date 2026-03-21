# 🏑 Manning Valley Hockey Association — Match Draw

A React web application for browsing the 2026 MVHA match draw. Supports both senior and junior competitions with filtering, shareable URLs, and PDF export.

---

## Features

- Browse Senior and Junior match draws
- Filter by grade/division, team, gender, month, and field
- Shareable URLs — filters are reflected in the URL (`?mode=junior&grade=U12s&team=Sharks`)
- Export filtered matches to PDF
- Dark / Light mode toggle
- Responsive design

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3 (for data parsing scripts)

### Run

```bash
make dev
```

This will automatically install dependencies if `node_modules` is missing, then start the Vite dev server at [http://localhost:5173](http://localhost:5173).

Or manually:

```bash
npm install
npm run dev
```

---

## Data

Match data is stored as JSON in `public/`:

| File | Description |
|------|-------------|
| `public/matches.json` | Senior draw |
| `public/juniors.json` | Junior draw |

### Regenerating data from PDFs

**Seniors:**
```bash
python3 scripts/parse_draw.py
```

**Juniors:**
```bash
python3 scripts/parse_draw_juniors.py
```

Place the source PDFs in `scripts/` (seniors) or `scripts/juniors/` (juniors) before running.

---

## Project Structure

```
├── public/
│   ├── matches.json       # Senior draw data
│   ├── juniors.json       # Junior draw data
│   └── logos/             # Team logos
├── scripts/
│   ├── parse_draw.py      # Senior PDF parser
│   ├── parse_draw_juniors.py  # Junior PDF parser
│   └── juniors/           # Junior PDF source files
├── src/
│   ├── App.jsx            # Main app, header, layout, URL sync
│   ├── index.css          # Global styles
│   ├── links.json         # External links (Match Card PDF etc.)
│   ├── components/
│   │   ├── FilterBar.jsx  # Sidebar filters and mode toggle
│   │   └── MatchCard.jsx  # Individual match card
│   └── utils/
│       ├── dateUtils.js   # Date parsing helpers
│       └── exportPdf.js   # PDF export
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── Makefile
```

---

## Docker (Production)

Build and run with Docker:

```bash
make build   # Build the Docker image
make run     # Run the container on port 8080
make stop    # Stop and remove the container
```

Or with Docker Compose:

```bash
make up      # Start with docker-compose
make down    # Stop with docker-compose
```

---

## Makefile Reference

| Command | Description |
|---------|-------------|
| `make dev` | Install deps (if needed) and start dev server |
| `make install` | Run `npm install` |
| `make build` | Build Docker image |
| `make run` | Run Docker container on port 8080 |
| `make stop` | Stop and remove Docker container |
| `make up` | Start with docker-compose |
| `make down` | Stop with docker-compose |


## Teams Json File
The teams.json file is used to store the team Names, shortname, Logos and links to the team pages.

It also supports `alt_url` field, this is for including extra URLs such as sponsors that will display in the team card.

Example:

```json
{
  "full_team_name": "Chatham Wolves",
  "team_name": "Chatham",  // As shown on the draw
  "logo": "logos/taree.png",
  "alt_url": [
    {
      "name": "Sponsor 1",
      "url": "https://www.sponsor1.com.au"
    },
    {
      "name": "Sponsor 2",
      "url": "https://www.sponsor2.com.au"
    }
  ]
}
```