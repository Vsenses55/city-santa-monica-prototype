#!/usr/bin/env python3
"""Build the site's schedule data from Big Blue Bus's published GTFS feed.

    python3 tools/build_data.py            # downloads the current feed
    python3 tools/build_data.py feed.zip   # or uses a local copy

Writes:
    data/routes.json         every route: number, label, streets, directions
    data/route-<num>.json    one file per route: stops, path, trips, service calendar

Source: https://gtfs.bigbluebus.com/current.zip (free to use under the
City of Santa Monica terms of use). Standard library only, so it runs on a
stock GitHub Actions runner.
"""
import csv, io, json, math, os, re, sys, urllib.request, zipfile
from collections import defaultdict

FEED_URL = "https://gtfs.bigbluebus.com/current.zip"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")


def load_feed(path=None):
    raw = open(path, "rb").read() if path else urllib.request.urlopen(FEED_URL, timeout=60).read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    read = lambda name: list(csv.DictReader(io.TextIOWrapper(z.open(name), "utf-8-sig")))
    names = set(z.namelist())
    return {n[:-4]: read(n) for n in [
        "routes.txt", "trips.txt", "stop_times.txt", "stops.txt", "shapes.txt",
        "calendar.txt", "calendar_dates.txt", "feed_info.txt", "transfers.txt"] if n in names}


# ---------- helpers ----------
def minutes(hms):
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 60 + m + (1 if s >= 30 else 0)


SMALL = {"and", "at", "of", "the", "to", "via"}
KEEP_UPPER = {"NB", "SB", "EB", "WB", "NS", "FS", "MB", "UCLA", "SMC", "LAX", "VA", "LA", "DTLA", "II", "III", "PCH", "USPS"}


def tidy(name):
    """'4TH NB & SANTA MONICA NS' -> '4th NB & Santa Monica NS'"""
    def word(w, first):
        bare = re.sub(r"[^A-Za-z]", "", w).upper()
        if bare in KEEP_UPPER:
            return w.upper()
        if not first and w.lower() in SMALL:
            return w.lower()
        if re.match(r"^\d", w):           # 4TH -> 4th, 26TH -> 26th
            return w.lower()
        return w[:1].upper() + w[1:].lower()
    parts = re.split(r"(\s+|/|-|\()", name.strip())
    out, first = [], True
    for p in parts:
        if p and not re.match(r"^(\s+|/|-|\()$", p):
            out.append(word(p, first)); first = False
        else:
            out.append(p)
    return "".join(out)


def label(short):
    return ("Rapid " + short[1:]) if short.upper().startswith("R") else ("Route " + short)


def badge(short):
    return short[1:] if short.upper().startswith("R") else short


def sort_key(short):
    n = re.sub(r"\D", "", short)
    return (int(n) if n else 999, short)


def simplify(points, tol=0.00004):
    """Douglas-Peucker on lat/lon; ~4 m tolerance keeps the path faithful but small."""
    if len(points) < 3:
        return points
    def dist(p, a, b):
        if a == b:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1])) / ((b[0]-a[0])**2 + (b[1]-a[1])**2)))
        return math.hypot(p[0] - (a[0] + t*(b[0]-a[0])), p[1] - (a[1] + t*(b[1]-a[1])))
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0, None
        for k in range(i + 1, j):
            d = dist(points[k], points[i], points[j])
            if d > best:
                best, idx = d, k
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(points, keep) if k]


def align(canonical, seq):
    """Map a trip's stop sequence onto the direction's canonical stop list.
    Walks forward so a stop visited twice (loops) lands on the right slot."""
    slots, pos = [], 0
    for sid in seq:
        try:
            pos = canonical.index(sid, pos)
        except ValueError:
            try:
                pos = canonical.index(sid)
            except ValueError:
                slots.append(None); continue
        slots.append(pos); pos += 1
    return slots


# ---------- build ----------
def build(feed):
    routes = {r["route_id"]: r for r in feed["routes"]}
    stops = {s["stop_id"]: s for s in feed["stops"]}
    trips = {t["trip_id"]: t for t in feed["trips"]}

    times = defaultdict(list)                        # trip_id -> [(seq, stop_id, minutes)]
    for st in feed["stop_times"]:
        t = st["departure_time"] or st["arrival_time"]
        if t:
            times[st["trip_id"]].append((int(st["stop_sequence"]), st["stop_id"], minutes(t)))
    for v in times.values():
        v.sort()

    shapes = defaultdict(list)
    for p in feed["shapes"]:
        shapes[p["shape_id"]].append((int(p["shape_pt_sequence"]), float(p["shape_pt_lat"]), float(p["shape_pt_lon"])))

    # Which routes serve each stop (plus stops linked in transfers.txt) -> transfer badges
    stop_routes = defaultdict(set)
    for tid, seq in times.items():
        short = routes[trips[tid]["route_id"]]["route_short_name"]
        for _, sid, _ in seq:
            stop_routes[sid].add(short)
    linked = defaultdict(set)
    for tr in feed.get("transfers", []):
        a, b = tr["from_stop_id"], tr["to_stop_id"]
        if a and b and a != b:
            linked[a].add(b); linked[b].add(a)

    # Service calendar (weekly pattern + date exceptions), shared by all routes
    services = {}
    for c in feed["calendar"]:
        services[c["service_id"]] = {
            "days": [int(c[d]) for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]],
            "start": c["start_date"], "end": c["end_date"], "add": [], "remove": []}
    for cd in feed["calendar_dates"]:
        s = services.setdefault(cd["service_id"], {"days": [0]*7, "start": "", "end": "", "add": [], "remove": []})
        s["add" if cd["exception_type"] == "1" else "remove"].append(cd["date"])

    by_route = defaultdict(list)
    for t in feed["trips"]:
        if t["trip_id"] in times:
            by_route[t["route_id"]].append(t)

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):                        # clear routes that no longer exist
        if f.startswith("route-") and f.endswith(".json"):
            os.remove(os.path.join(OUT, f))

    index = []
    for rid, rtrips in sorted(by_route.items(), key=lambda kv: sort_key(routes[kv[0]]["route_short_name"])):
        r = routes[rid]
        short = r["route_short_name"]
        directions = []
        for did in sorted({t["direction_id"] or "0" for t in rtrips}):
            dtrips = [t for t in rtrips if (t["direction_id"] or "0") == did]
            # Canonical stop list = the longest stop pattern in this direction
            patterns = {tuple(s for _, s, _ in times[t["trip_id"]]) for t in dtrips}
            canonical = list(max(patterns, key=len))
            for pat in sorted(patterns, key=len, reverse=True):   # append stops only short-turns use
                for s in pat:
                    if s not in canonical:
                        canonical.append(s)
            # Most common headsign names the direction
            hs = defaultdict(int)
            for t in dtrips:
                hs[t["trip_headsign"].strip()] += 1
            headsign = re.sub(r"^[^\w]+", "", max(hs, key=hs.get)).strip() if hs else ""
            # Most common shape draws the path
            sh = defaultdict(int)
            for t in dtrips:
                if t.get("shape_id"):
                    sh[t["shape_id"]] += 1
            path = []
            if sh:
                pts = sorted(shapes[max(sh, key=sh.get)])
                path = [[round(la, 5), round(lo, 5)] for la, lo in simplify([(la, lo) for _, la, lo in pts])]
            stop_list = []
            for sid in canonical:
                s = stops[sid]
                xfer = set(stop_routes[sid])
                for other in linked[sid]:
                    xfer |= stop_routes[other]
                xfer.discard(short)
                stop_list.append({
                    "id": sid, "code": s.get("stop_code", ""), "name": tidy(s["stop_name"]),
                    "lat": round(float(s["stop_lat"]), 5), "lon": round(float(s["stop_lon"]), 5),
                    "transfers": sorted(xfer, key=sort_key)})
            trip_rows = []
            for t in sorted(dtrips, key=lambda t: times[t["trip_id"]][0][2]):
                seq = times[t["trip_id"]]
                row = [None] * len(canonical)
                for slot, (_, _, m) in zip(align(canonical, [s for _, s, _ in seq]), seq):
                    if slot is not None and row[slot] is None:
                        row[slot] = m
                own = re.sub(r"^[^\w]+", "", t["trip_headsign"]).strip()
                trip_rows.append({"s": t["service_id"], "h": own if own != headsign else None, "t": row})
            for tr in trip_rows:
                if tr["h"] is None:
                    del tr["h"]
            directions.append({"id": did, "headsign": headsign, "stops": stop_list, "path": path, "trips": trip_rows})

        used = {tr["s"] for d in directions for tr in d["trips"]}
        detail = {
            "short": short, "badge": badge(short), "label": label(short), "name": r["route_long_name"],
            "color": "#" + (r.get("route_color") or "009CA4"),
            "directions": directions,
            "services": {k: v for k, v in services.items() if k in used},
        }
        with open(os.path.join(OUT, f"route-{short}.json"), "w") as fh:
            json.dump(detail, fh, separators=(",", ":"))
        index.append({
            "short": short, "badge": badge(short), "label": label(short), "name": r["route_long_name"],
            "directions": [{"id": d["id"], "headsign": d["headsign"], "stops": len(d["stops"])} for d in directions]})

    info = feed["feed_info"][0] if feed.get("feed_info") else {}
    with open(os.path.join(OUT, "routes.json"), "w") as fh:
        json.dump({"feed": {"version": info.get("feed_version", ""), "start": info.get("feed_start_date", ""),
                            "end": info.get("feed_end_date", ""), "source": FEED_URL},
                   "routes": index}, fh, separators=(",", ":"))
    return index


if __name__ == "__main__":
    idx = build(load_feed(sys.argv[1] if len(sys.argv) > 1 else None))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"Built {len(idx)} routes into data/ ({total/1024:.0f} KB)")
    for r in idx:
        print(f"  {r['label']:<9} {r['name']:<40} " + " | ".join(f"to {d['headsign']} ({d['stops']} stops)" for d in r["directions"]))
