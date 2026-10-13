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

  window.BBBData = {
    routes: () => getJSON("data/routes.json"),
    route: (short) => getJSON(`data/route-${encodeURIComponent(short)}.json`),
    laParts, today, ymd, weekday, sameDay, fromDate, toDate, runs, activeServices, fmt, recent,
    routeHref: (short) => `route.html?r=${encodeURIComponent(short)}`,
  };
})();
