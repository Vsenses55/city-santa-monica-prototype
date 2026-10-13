# Big Blue Bus — 2-page responsive prototype

Live site: https://vsenses55.github.io/city-santa-monica-prototype/

Static HTML/CSS/JS built from the City of Santa Monica Figma file
(Big Blue Bus page: Home Desktop/Mobile, Routes Desktop/Mobile) and the
docs in `guidelines/`.

```
index.html      Home: route search, service alerts, routes, trip planner
route.html      Route 1: map, filters, stop schedule, service alerts
css/tokens.css  Semantic tokens from guidelines/tokens.md + @font-face
css/site.css    Components and responsive layout
js/site.js      Shared interactions + Home (search, carousel, planner)
js/data.js      Schedule-data helpers (service days, times, recently visited)
js/home.js      Home route list from data/routes.json
js/route-page.js  Route page: filters, stops, departures, map, CSV download
js/live-alerts.js  Live Service Alerts from Big Blue Bus's GTFS-realtime feed
data/           Schedule data per route, built by tools/build_data.py
tools/          build_data.py: BBB GTFS -> data/*.json (Python, no dependencies)
vendor/leaflet  Leaflet 1.9.4 map library (BSD-2), self-hosted
fonts/          Urbanist Medium/Bold (woff2 + ttf fallback, SIL OFL)
assets/img      Logo, hero illustration, map artwork, route line (from Figma)
assets/icons    UI icons (from Figma)
```

## Run locally

Browsers block web fonts on `file://`, so serve the folder:

```
cd city-santa-monica-prototype
python3 -m http.server 8000      # then open http://localhost:8000
```

(VS Code's Live Server works too.)

## Publish with GitHub Pages

1. In GitHub Desktop: File → Add Local Repository → this folder → create the repo.
2. Commit and Publish.
3. On github.com: Settings → Pages → Deploy from branch → `main` / root.

The site uses Urbanist (free, SIL Open Font License), so it can be published
as is. The original Santa Monica Sharp files are still in `fonts/` for
reference, but `.gitignore` keeps them out of the repository.

## Live data

**Routes, stops and schedules** come from Big Blue Bus's published GTFS feed
(`https://gtfs.bigbluebus.com/current.zip`). `tools/build_data.py` turns it into
one small JSON file per route in `data/`. Every route has a page:
`route.html?r=8`, `route.html?r=R12`, and so on.

To refresh by hand: `python3 tools/build_data.py`, then commit `data/`.
The GitHub Action in `.github/workflows/update-schedules.yml` does this every
Monday and republishes the site when the schedule changes.

**Service alerts** load live in the browser from
`https://gtfs.bigbluebus.com/alerts.bin` (GTFS-realtime, decoded without libraries).
If the feed can't be reached, Home keeps the sample alerts from the design.

**Map**: Leaflet with OpenStreetMap tiles, shown in grayscale to match the design.

All Big Blue Bus data is free to use under the City of Santa Monica terms of use.
Times are scheduled times, not real-time predictions.

## Layout

- Content stops at 1440px; above that it is centered with a 1px Border/Default frame.
- Breakpoints (chosen where content stops fitting, not from the reference widths):
  - 1180px: Trip Planner moves below Routes
  - 1100px: Route page Service Alerts move below the schedule
  - 900px: footer stacks
  - 720px: mobile mode (mobile type tokens, mobile headers, stacked filters)

## Prototype-only behavior

All transit content is static reference data from the design, not live.
These show a short notice instead of doing anything: Language, Download,
footer and social links, Get Directions (after validation), email sign-up
(after validation). Every route links to the Route 1 page.
