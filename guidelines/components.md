# Big Blue Bus — Components

Updated: 2026-10-12.
Read with design.md, tokens.md, and styles.md.

The links identify existing Figma assets.
Variant names are case-sensitive.
Property 1 is an actual existing property name.

## Native catalog

| Component | Variants/content |
| --- | --- |
| <figma-node-link node-id="73:4">Button</figma-node-link> | State: Default, Hover, Pressed, Disabled; With Icon: True, False |
| <figma-node-link node-id="73:163">Text Fields</figma-node-link> | State: Default, Hover, Input, Error |
| <figma-node-link node-id="175:4072">Search Field</figma-node-link> | State: Default, Hover, Entry |
| <figma-node-link node-id="186:4101">Card_Alerts</figma-node-link> | State: Default, Hover; Labels#491:7; Description#491:10 |
| <figma-node-link node-id="186:4200">Route</figma-node-link> | Property 1: Default, Hover; Route#506:13; Streets#506:16 |
| <figma-node-link node-id="526:2000">Route Indicator</figma-node-link> | Property 1: Default, Hover; Number#526:20 |
| <figma-node-link node-id="608:875">Route title indicator</figma-node-link> | Route#608:3 |
| <figma-node-link node-id="480:688">Numeric Indicator</figma-node-link> | State: Date, Hover, Focused, Inactive; Number#480:0 |
| <figma-node-link node-id="625:2422">Time</figma-node-link> | State: Display, Highlight; Time#625:3 |
| <figma-node-link node-id="629:6198">Accordion Set</figma-node-link> | State: Collapsed, Expanded |
| <figma-node-link node-id="629:3863">Accordion Header</figma-node-link> | Destination#629:8 |
| <figma-node-link node-id="544:867">Dropdown</figma-node-link> | Slots: Items#544:0, Button#544:1 |
| <figma-node-link node-id="129:1661">Stop Time</figma-node-link> | Destination#625:0; slot Transfer Routes#625:2 |
| <figma-node-link node-id="625:2760">Upcoming Departures</figma-node-link> | Slot Containers#625:4 |
| <figma-node-link node-id="483:863">Date Picker</figma-node-link> | Reuse native calendar composition |
| <figma-node-link node-id="199:4455">Logo</figma-node-link> | Reuse original artwork |
| <figma-node-link node-id="261:2056">Map</figma-node-link> | State: Default, Expanded; reference artwork |
| <figma-node-link node-id="261:1931">Language</figma-node-link> | State: Default, Hover, Click |
| <figma-node-link node-id="199:4469">Subscription Field</figma-node-link> | State: Default, Hover, Entry |
| <figma-node-link node-id="102:462">Direction filter</figma-node-link> | State: Idle, Hover; boolean Icon#102:0 |
| <figma-node-link node-id="211:4926">Day filter</figma-node-link> | State: Idle, Hover; boolean Icon#102:0 |
| <figma-node-link node-id="211:5078">Trips filter</figma-node-link> | State: Idle, Hover; boolean Icon#102:0 |
| <figma-node-link node-id="104:444">Direction toggle</figma-node-link> | State: Idle, Click; Icons#107:0; Direction Label#608:4 |
| <figma-node-link node-id="107:475">Dropdown Item</figma-node-link> | State: Idle, Hover; Label#548:5 |
| <figma-node-link node-id="138:1515">Download control</figma-node-link> | State: Default, Hover |
| <figma-node-link node-id="625:1123">Expand/collapse icon</figma-node-link> | State: Expand, Collapse |

## Composition components

### <figma-node-link node-id="874:16594">BBB / Trip Planner</figma-node-link>

Two labeled Text Fields and a primary Get Directions action.

Properties:
- Heading#874:0
- From label#874:1
- To label#874:2

### <figma-node-link node-id="874:16595">BBB / Route Summary</figma-node-link>

Route badge, route name, and destination.

Properties:
- Route name#874:3
- Destination#874:4

### <figma-node-link node-id="874:16596">BBB / Service Alerts</figma-node-link>

Heading and two Card_Alerts instances.

Property:
- Heading#874:5

## Composition constraints

No new composition variant sets exist.

Service Alerts is a horizontal desktop recipe.
A mobile stack is a layout recommendation, not a Mobile variant.

Planner placeholders/action text and route numbers are nested
instance overrides, not newly exposed parent properties.

Set typography modes for both new and legacy text.

## Reuse rules

In Figma:
- Use native instances, text properties, and real slots.
- Do not detach, cover-and-redraw, or fork primitives.
- Do not edit original masters without permission.
- When a control lacks a text property, use a targeted
  instance override.

Outside Figma:
- Treat this as a component/state specification.
- It does not supply an implementation, fonts, images,
  or live transit data.

The Numeric Indicator Focused state means selected date,
not proven keyboard focus.
