# Big Blue Bus — 2-page responsive prototype

Static HTML/CSS/JS built from the City of Santa Monica Figma file
(Big Blue Bus page: Home Desktop/Mobile, Routes Desktop/Mobile) and the
docs in `guidelines/`.

```
index.html      Home: route search, service alerts, routes, trip planner
route.html      Route 1: map, filters, stop schedule, service alerts
css/tokens.css  Semantic tokens from guidelines/tokens.md + @font-face
css/site.css    Components and responsive layout
js/site.js      Interactions (no dependencies)
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
