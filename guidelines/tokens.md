# Big Blue Bus — Tokens

Updated: 2026-10-12.
Read with design.md, components.md, and styles.md.
All numeric dimensions are CSS pixels.

## Semantic colors

Use the semantic role, not merely a matching hex.
These correspond to the existing Figma Colors variables.

| Token | Value |
| --- | --- |
| Surface/Background | #FFFFFF |
| Surface/Default | #FFFFFF |
| Surface/Subtle | #F8F8F8 |
| Surface/Muted | #F3F3F3 |
| Surface/Disabled | #F1F2F3 |
| Surface/Control | #F0F0F0 |
| Interactive/Primary | #005EB8 |
| Interactive/Primary Hover | #337EC6 |
| Interactive/Accent | #009CA4 |
| Interactive/Inactive | #D6D6D6 |
| Interactive/Idle | #F8F8F8 |
| Interactive/Hover Neutral | #F2F2F2 |
| Interactive/Form Focused | #CCDFF1 |
| Type/Heading | #333333 |
| Type/Primary | #000000 |
| Type/Strong | #2D2D2D |
| Type/Body | #707070 |
| Type/Secondary | #7D7D7D |
| Type/Placeholder | #979797 |
| Type/On Color | #FFFFFF |
| Type/Link | #005EB8 |
| Border/Default | #D6D6D6 |
| Border/Subtle | #D8D8D8 |
| Border/Divider | #D0CECE |
| Border/Control | #D3D3D3 |
| Border/Interactive | #005EB8 |
| Border/Strong | #C3C3C3 |
| Border/High Contrast | #707070 |
| Border/Faint | #F0F0F0 |
| Icon/Default | #333333 |
| Icon/Primary | #000000 |
| Icon/Muted | #7D7D7D |
| Icon/Disabled | #C3C3C3 |
| Icon/On Color | #FFFFFF |
| Brand/Primary | #005EB8 |
| Brand/Secondary | #337EC6 |
| Brand/Accent | #009CA4 |
| Brand/Logo Ink | #302E2C |
| Brand/Logo Ink Secondary | #363433 |
| Brand/Logo Aqua | #2AD2C9 |
| Brand/Logo Gold | #FFB81C |
| Brand/Logo Orange | #FE5000 |
| Status/Alert | #FE5000 |
| Status/Danger | #D11242 |
| Data/Route Indicator | #009CA4 |
| Overlay/Scrim | #000000 at 30% opacity |

Native component hover/pressed recipes take precedence over
a token's name. Do not assume every Button hover uses
Interactive/Primary Hover as a fill.

## Spacing

Collection: BBB / Geometry.
Mode: Default.

Tokens:
space/0, space/2, space/4, space/6, space/8, space/12,
space/16, space/20, space/24, space/32, space/40,
space/48, space/64, space/80.

The number after the slash is the value.
These alias existing primitive units.

Typical recipes:
- Label-to-field gap: 12.
- Alert gap: 16.
- Card padding: 24.
- Section separation: 32.

## Radius and controls

| Token | Value |
| --- | --- |
| radius/none | 0 |
| radius/time | 6 |
| radius/badge | 12 |
| radius/field | 15 |
| radius/card | 16 |
| radius/overlay | 24 |
| radius/pill | 999 |
| control/min-touch-target | 44 |
| control/action-height | 44 |
| control/field-height | 50 |
| control/filter-height | 48 |
| border/default-width | 1 |

radius/pill is a normalized addition, not every original
control's literal radius.

min-touch-target is a recommended hit area, not every
visible control's size.

## Typography

Collection: BBB / Typography.
Modes: Desktop and Mobile.
Family: Urbanist (Figma variable font/family).
Weights: Medium 500, Bold 700.

Each role has /size and /line-height tokens.

| Role | Weight | Desktop size/line | Mobile size/line |
| --- | --- | --- | --- |
| display | Bold | 48/48 | 48/48 |
| title | Bold | 40/48 | 40/48 |
| page | Bold | 33/40 | 28/40 |
| section | Bold | 28/32 | 23/32 |
| subsection | Bold | 23/32 | 23/32 |
| heading | Bold | 19/20 | 19/20 |
| strong | Bold | 19/24 | 16/24 |
| body | Medium | 16/26 | 16/24 |
| small | Medium | 14/20 | 14/20 |
| label | Bold | 13/20 | 13/20 |
| caption | Medium | 11/16 | 11/16 |

## Layout

Collection: BBB / Layout.
Modes: Desktop and Mobile.

| Token | Desktop | Mobile |
| --- | --- | --- |
| home/gutter | 80 | 20 |
| routes/gutter | 36.5 | 16 |
| home/content-max | 1280 | 353 |
| routes/content-max | 1367 | 361 |
| reference/viewport | 1440 | 393 |

These are reference metrics, not production breakpoints
or fixed mobile widths.

In Figma:
- Set BBB / Typography and BBB / Layout modes explicitly.
- Set the original Type mode too for legacy native instances.
- Some legacy Type aliases are unresolved.
- Use BBB / Typography for new authored text.
