/* Shared schedule-data helpers. Data comes from data/*.json, built from
   Big Blue Bus's published GTFS by tools/build_data.py. */
(function () {
  "use strict";
  const cache = {};
  const getJSON = (url) => (cache[url] = cache[url] || fetch(url).then((r) => {
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }));

  /* Santa Monica local date/time, whatever the viewer's own time zone */
  const TZ = "America/Los_Angeles";
  function laParts(d = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, minutes: +p.hour * 60 + +p.minute };
  }
  // A plain calendar date (no time zone games): {y, m, d}
  const today = () => { const p = laParts(); return { y: p.y, m: p.m, d: p.d }; };
  const ymd = (c) => `${c.y}${String(c.m).padStart(2, "0")}${String(c.d).padStart(2, "0")}`;
  const weekday = (c) => (new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const sameDay = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;
  const fromDate = (dt) => ({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });
  const toDate = (c) => new Date(c.y, c.m - 1, c.d);

  /* Is a GTFS service running on this calendar date? */
  function runs(svc, c) {
    const key = ymd(c);
    if (svc.remove && svc.remove.includes(key)) return false;
    if (svc.add && svc.add.includes(key)) return true;
    if (!svc.start || key < svc.start || key > svc.end) return false;
    return svc.days[weekday(c)] === 1;
  }
  const activeServices = (route, c) => new Set(Object.keys(route.services).filter((id) => runs(route.services[id], c)));

  /* 754 -> "12:34 PM"; times past midnight (e.g. 25:10) wrap to the next morning */
  function fmt(min) {
    const m = ((min % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const ap = h < 12 ? "AM" : "PM";
    h = h % 12 || 12;
    return `${h}:${mm} ${ap}`;
  }

  /* Recently visited routes (this browser only) */
  const RECENT_KEY = "bbb-recent-routes";
  const recent = {
    get() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } },
    add(short) {
      try {
        const list = [short, ...recent.get().filter((s) => s !== short)].slice(0, 2);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      } catch (e) { /* storage unavailable: skip */ }
    },
  };

  /* Saved trips (this browser only). A trip is a stop pair on a route, not one
     departure, so it stays useful: it always offers the next bus. */
  const TRIPS_KEY = "bbb-saved-trips", MAX_TRIPS = 4;
  const tripKey = (t) => `${t.r}|${t.from}|${t.to}`;
  const trips = {
    get() { try { return JSON.parse(localStorage.getItem(TRIPS_KEY)) || []; } catch (e) { return []; } },
    has(t) { return trips.get().some((x) => tripKey(x) === tripKey(t)); },
    save(list) { try { localStorage.setItem(TRIPS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } },
    add(t) { return trips.save([t, ...trips.get().filter((x) => tripKey(x) !== tripKey(t))].slice(0, MAX_TRIPS)); },
    remove(t) { return trips.save(trips.get().filter((x) => tripKey(x) !== tripKey(t))); },
  };
  const tripHref = (t) => `route.html?r=${encodeURIComponent(t.r)}&d=${t.d}&from=${encodeURIComponent(t.from)}&to=${encodeURIComponent(t.to)}`;

  const addDays = (c, n) => fromDate(new Date(c.y, c.m - 1, c.d + n));
  /* The next bus that serves both stops (in that order): on `date` leaving at or
     after `after` minutes, else on the next service day (looks up to a week ahead).
     Returns { trip, dep, arr, date, dayOffset } or null. */
  function nextTrip(route, dirIdx, fromIdx, toIdx, date, after) {
    const d = route.directions[dirIdx];
    if (!d) return null;
    for (let k = 0; k < 8; k++) {
      const c = k ? addDays(date, k) : date, svc = activeServices(route, c), min = k ? -1 : after;
      let best = null;
      d.trips.forEach((t) => {
        if (!svc.has(t.s)) return;
        const a = t.t[fromIdx], b = t.t[toIdx];
        if (a == null || b == null || b < a || a < min) return;
        if (!best || a < best.dep) best = { trip: t, dep: a, arr: b };
      });
      if (best) return { ...best, date: c, dayOffset: k };
    }
    return null;
  }

  /* "Robertson Bl NB & Venice Bl NS (Culver City Station)" -> "Robertson Bl & Venice Bl" */
  const shortStop = (name) => name.replace(/\s*\([^)]*\)/g, "")
    .replace(/\b(NB|SB|EB|WB|NS|FS|MB)\b/gi, "")
    .replace(/\s+&\s+/g, " & ").replace(/\s{2,}/g, " ").replace(/\s+:/g, ":").trim();

  window.BBBData = {
    routes: () => getJSON("data/routes.json"),
    route: (short) => getJSON(`data/route-${encodeURIComponent(short)}.json`),
    laParts, today, ymd, weekday, sameDay, fromDate, toDate, addDays, runs, activeServices, fmt, recent,
    trips, tripKey, tripHref, nextTrip, shortStop,
    routeHref: (short) => `route.html?r=${encodeURIComponent(short)}`,
  };
})();
