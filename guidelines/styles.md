# Big Blue Bus — Styles and Agent Rules

Updated: 2026-10-12.
Read design.md, tokens.md, and components.md first.

## Shared text styles

Naming:
BBB / Type / <role> / <Desktop|Mobile>

Use the roles, weights, sizes, and line heights in tokens.md.

Selecting a style does not select a variable mode.
Set the matching mode explicitly.

Use Urbanist Medium (500) and Bold (700).
The family is the Figma `font/family` variable; weights are
`font/weight/500` and `font/weight/700`.
Urbanist is free under the SIL Open Font License and is
self-hosted with the site (fonts/Urbanist-*.woff2, .ttf fallback).

Urbanist replaces Santa Monica Sharp, which is licensed and
kept for reference only. The logo artwork keeps its original
lettering; do not re-set it in Urbanist.

Do not silently substitute a different font.

## Shared paint styles

Naming:
BBB / Color / <name>

| Style name | Semantic token |
| --- | --- |
| Action | Interactive/Primary |
| Route | Data/Route Indicator |
| Alert | Status/Alert |
| Danger | Status/Danger |
| Surface | Surface/Default |
| Subtle | Surface/Subtle |
| Strong | Type/Strong |
| Body | Type/Body |
| OnColor | Type/On Color |
| Border | Border/Default |
| Focus | Border/Interactive |

## Shared elevation style

Name:
BBB / Elevation / Overlay

Observed shadow:
- Offset: 0/0.
- Blur: 32.
- Spread: 0.
- Color: black at 10% opacity.

Reserve this for overlays.
Keep normal cards flat unless the native state differs.

## Accessibility and content

- Target WCAG AA: 4.5:1 normal text; 3:1 large text and
  essential UI boundaries.
- White on teal needs large bold numerals, approximately
  19px bold minimum, or a contrast-safe alternative.
- Do not use small regular white text on teal.
- Quiet borders may need stronger contrast when they are
  the only input boundary.
- Use persistent labels, actionable errors, warning text,
  and visible keyboard focus.
- Recommend 44×44px hit areas, including small time chips
  and disclosure icons.
- Provide semantic controls, keyboard access, selected states,
  and disclosure state.
- Test 200% zoom, narrow reflow, translated copy, and
  screen-reader announcements.
- Preserve complete stop names and warnings.
- Do not label reference times as live.

## Agent acceptance checklist

1. Preserve original screens, main components, authoritative
   content, and artwork.
2. Reuse actual components/states.
3. Apply semantic tokens and matching typography modes.
4. Keep widths fluid, text readable, and content wrapped
   and contained.
5. Check desktop, mobile, intermediate widths, focus, errors,
   contrast, and hit areas.
6. Do not invent production breakpoints, unsupported variants,
   or live-service claims.
7. Report missing assets/fonts or unsupported behavior instead
   of claiming completeness.

This handoff is a static design specification,
not an audited accessible application.

Markdown sharing does not require Figma publishing.
Figma access and asset delivery are separate.
