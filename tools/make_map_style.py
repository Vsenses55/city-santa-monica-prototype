"""Builds assets/map-style.json: OpenFreeMap's "Positron" style recolored to
match the map in the Figma design (light gray land, blue water, white
streets, yellow main roads and freeways, sand beaches, green parks).

Run:  python3 tools/make_map_style.py
Map data © OpenStreetMap contributors, tiles by OpenFreeMap (no key needed).
"""
import json
import os
import urllib.request

SRC = "https://tiles.openfreemap.org/styles/positron"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "map-style.json")

# Colors sampled from the Figma map
LAND = "#EAEAEC"
WATER = "#9DD3FF"
PARK = "#D3EBCF"
SAND = "#FCEFC4"
BUILDING = "#E1E1E4"
STREET = "#FFFFFF"
MAJOR = "#FFF1C2"         # primary roads: Lincoln, Wilshire, Santa Monica Blvd…
MAJOR_EDGE = "#F0DA98"
MINOR_EDGE = "#DCDCE0"    # secondary/tertiary roads stay white with a gray edge
BIG = ["primary", "trunk"]
FREEWAY = "#FFE28A"       # I-10, I-405
FREEWAY_EDGE = "#F3CF62"
TEXT = "#5F6368"
PLACE = "#3C4043"

PAINT = {
    "background": {"background-color": LAND},
    "park": {"fill-color": PARK},
    "water": {"fill-color": WATER},
    "waterway": {"line-color": WATER},
    "landuse_residential": {"fill-color": LAND, "fill-opacity": 0},
    "landcover_wood": {"fill-color": PARK},
    "building": {"fill-color": BUILDING, "fill-outline-color": "#D6D6DA"},
    "highway_path": {"line-color": STREET},
    "highway_minor": {"line-color": STREET, "line-opacity": 1},
    "highway_major_casing": {"line-color": ["match", ["get", "class"], BIG, MAJOR_EDGE, MINOR_EDGE]},
    "highway_major_inner": {"line-color": ["match", ["get", "class"], BIG, MAJOR, STREET]},
    "highway_major_subtle": {"line-color": ["match", ["get", "class"], BIG, MAJOR_EDGE, "#F7F7F8"]},
    "highway_motorway_casing": {"line-color": FREEWAY_EDGE},
    "highway_motorway_inner": {"line-color": FREEWAY},
    "highway_motorway_subtle": {"line-color": FREEWAY},
    "highway_motorway_bridge_casing": {"line-color": FREEWAY_EDGE},
    "highway_motorway_bridge_inner": {"line-color": FREEWAY},
    "tunnel_motorway_casing": {"line-color": FREEWAY_EDGE},
    "tunnel_motorway_inner": {"line-color": "#FDE9A9"},
    "railway_transit": {"line-color": "#C9C9CE"},
    "railway": {"line-color": "#C9C9CE"},
}
TEXT_LAYERS = {
    "highway-name-path": TEXT, "highway-name-minor": TEXT, "highway-name-major": TEXT,
    "label_other": TEXT, "label_village": PLACE, "label_town": PLACE, "label_city": PLACE,
    "water_name_point_label": "#3A79B0", "water_name_line_label": "#3A79B0", "waterway_line_label": "#3A79B0",
}

# Positron has no beach layer; add one under the parks
SAND_LAYER = {
    "id": "landcover_sand", "type": "fill", "source": "openmaptiles", "source-layer": "landcover",
    "filter": ["==", ["get", "class"], "sand"], "paint": {"fill-color": SAND},
}


def main():
    req = urllib.request.Request(SRC, headers={"User-Agent": "bbb-prototype-style-builder"})
    with urllib.request.urlopen(req, timeout=30) as r:
        style = json.load(r)
    style["name"] = "Big Blue Bus (Figma)"
    style["sources"].pop("ne2_shaded", None)
    layers = []
    for layer in style["layers"]:
        if layer.get("source") == "ne2_shaded":
            continue
        lid = layer["id"]
        if lid in PAINT:
            layer.setdefault("paint", {}).update(PAINT[lid])
        if lid in TEXT_LAYERS:
            layer.setdefault("paint", {}).update({"text-color": TEXT_LAYERS[lid], "text-halo-color": "#FFFFFF"})
        if lid == "park":
            layers.append(SAND_LAYER)
        layers.append(layer)
    style["layers"] = layers
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(style, fh, indent=1)
    print("wrote", OUT, len(layers), "layers")


if __name__ == "__main__":
    main()
