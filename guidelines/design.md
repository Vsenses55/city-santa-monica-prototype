# Big Blue Bus — Design

Updated: 2026-10-12.
Read with tokens.md, components.md, and styles.md.

## Reference and authority

Figma reference:
https://www.figma.com/design/V2e4v2Lo2A7q3yFtNvuCgU

Use the existing desktop/mobile Home and Routes screens as the
visual authority.

Preserve supplied route names, stop names, directions, service
messages, logos, and original artwork.

Reference alerts and departure times are not live data.
Do not modify original screens or main components without permission.

## Visual direction

- White canvas and quiet gray surfaces.
- Urbanist typography (Medium and Bold).
- Blue primary actions.
- Teal route identity.
- Orange warning indicators.
- Clear hierarchy and generous separation.
- Rounded cards, pill-like controls, and restrained borders.
- No unrelated gradients, decorative shadows, or new logo artwork.

## Composition

Home:
Illustration/search → alerts → routes → planner → footer.

Route page:
Route summary → map → filters → schedule → alerts → footer.

Schedule:
Stop heading → departures → stop-time rows and transfer badges.

Desktop:
Planner can sit beside routes; alerts can sit beside schedules.

Mobile:
Stack controls, expand primary actions, wrap times and long names.

Use auto-layout or fluid layout.
Use absolute positioning only for genuine overlays.

## Responsive rules

Reference widths are 1440px desktop and 393px mobile.
These are reference sizes, not production breakpoints.

Use the gutters in tokens.md.
Mobile content fills available width minus gutters.

Select breakpoints when content stops fitting.
Test intermediate widths.

Allow text and containers to grow.
Never clip warnings or shrink text merely to fit.

## Delivery rules

These Markdown documents can be sent to an agent without publishing.

They describe the design; they do not package fonts, images,
or a working application.

An agent needs Figma access or supplied screenshots/assets
to inspect exact artwork.

If a required font or asset is unavailable, request it rather
than silently replacing it.
