/* Route page: everything comes from data/route-<n>.json (Big Blue Bus GTFS).
   route.html?r=8 shows Route 8; no parameter shows Route 1. */
(function () {
  "use strict";
  const D = window.BBBData, B = window.BBB || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const short = new URLSearchParams(location.search).get("r") || "1";
  const acc = $("#stops-accordion");
  if (!D || !acc) return;

  /* Trip windows match the design's dropdown (4-hour blocks).
     Times past midnight (24:xx) count as the early-morning block of the same service day. */
  const WINDOWS = [[0, 240, "12am–4am"], [240, 480, "4am–8am"], [480, 720, "8am–12pm"],
                   [720, 960, "12pm–4pm"], [960, 1200, "4pm–8pm"], [1200, 1440, "8pm–12am"]];
  const inWindow = (m, w) => (m >= 1440 ? m - 1440 : m) >= WINDOWS[w][0] && (m >= 1440 ? m - 1440 : m) < WINDOWS[w][1];
  const PREVIEW_STOPS = 6;

  let route, st, map, layers = {};
  const defaults = () => {
    const now = D.laParts();
    return { dir: 0, date: D.today(), win: Math.min(5, Math.floor(now.minutes / 240)), open: 0, trip: null, showAll: false };
  };

  /* ---------- helpers ---------- */
  const dir = () => route.directions[st.dir];
  const isToday = () => D.sameDay(st.date, D.today());
  const dayLabel = (c) => isToday() && D.sameDay(c, st.date) ? "Today" :
    D.toDate(c).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const longDay = (c) => D.toDate(c).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  function tripsToday() {
    const svc = D.activeServices(route, st.date);
    return dir().trips.filter((t) => svc.has(t.s));
  }
  // Departures at one stop within the chosen window, sorted by time
  function departuresAt(stopIdx) {
    return tripsToday()
      .map((t) => ({ trip: t, m: t.t[stopIdx] }))
      .filter((x) => x.m != null && inWindow(x.m, st.win))
      .sort((a, b) => a.m - b.m);
  }

  /* ---------- header & filters ---------- */
  function bind(name, text) { $$(`[data-bind="${name}"]`).forEach((el) => { el.textContent = text; }); }
  function renderHeader() {
    bind("badge", route.badge);
    bind("label", route.label);
    bind("name", route.name);
    bind("label-schedule", `${route.label} Schedule`);
    bind("to", `To ${dir().headsign}`);
    bind("title", `${route.label}: ${route.name}`);
    bind("panel-title", `${route.label}:  ${route.name}`);
    document.title = `${route.label} Schedule — Big Blue Bus`;
    const tog = $(".dir-toggle");
    tog.hidden = route.directions.length < 2;
    $(".dir-lbl", tog).textContent = `To ${dir().headsign}`;
    tog.setAttribute("aria-label", `Direction: to ${dir().headsign}. Switch direction`);
    $('[data-filter="direction"] .lbl').textContent = `To ${dir().headsign}`;
    $('[data-filter="day"] .lbl').textContent = dayLabel(st.date);
    $('[data-filter="trips"] .lbl').textContent = `Trips (${WINDOWS[st.win][2]})`;
  }

  function fillOptions() {
    $("#pop-direction .option-list").innerHTML = route.directions.map((d, i) =>
      `<button class="option" type="button" role="option" data-v="${i}" aria-selected="${i === st.dir}">To ${esc(d.headsign)} (${d.stops.length} stops)</button>`).join("");
    $("#pop-trips .option-list").innerHTML = WINDOWS.map((w, i) =>
      `<button class="option" type="button" role="option" data-v="${i}" aria-selected="${i === st.win}">${w[2]}</button>`).join("");
  }

  /* Dropdown filters: pick an option, OK applies, Cancel / Escape closes */
  function wireListFilter(name, apply) {
    const f = $(`[data-filter="${name}"]`), trigger = $(".pill", f), pop = $(".popover", f);
    let pending = null;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pop.hidden) { B.closePop(false); return; }
      pending = null;
      B.showPop(pop, trigger);
      ($('[aria-selected="true"]', pop) || $(".option", pop)).focus();
    });
    pop.addEventListener("click", (e) => {
      const o = e.target.closest(".option");
      if (!o) return;
      $$(".option", pop).forEach((x) => x.setAttribute("aria-selected", String(x === o)));
      pending = +o.dataset.v;
    });
    pop.addEventListener("dblclick", (e) => { if (e.target.closest(".option")) $(".ok", pop).click(); });
    pop.addEventListener("keydown", (e) => {
      const opts = $$(".option", pop), i = opts.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i > -1) { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      if (e.key === "ArrowUp" && i > -1) { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
    });
    $(".ok", pop).addEventListener("click", () => { if (pending != null) apply(pending); B.closePop(true); });
    $(".cancel", pop).addEventListener("click", () => B.closePop(true));
  }

  /* Date picker (native calendar composition) */
  const dp = { view: null, pick: null };
  function renderDatePicker() {
    const pop = $("#pop-day"), grid = $(".dp-grid", pop);
    $(".dp-month .t-heading", pop).textContent = D.toDate(dp.view).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const first = D.toDate(dp.view);
    const start = new Date(first); start.setDate(1 - first.getDay());
    let html = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<span class="dow" aria-hidden="true">${d}</span>`).join("");
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start); dt.setDate(start.getDate() + i);
      const c = D.fromDate(dt);
      const outside = c.m !== dp.view.m;
      const runs = D.activeServices(route, c).size > 0;
      html += `<button type="button" class="dp-day${outside ? " is-outside" : ""}${runs ? "" : " no-service"}" data-ymd="${D.ymd(c)}" aria-pressed="${D.sameDay(c, dp.pick)}" aria-label="${esc(longDay(c))}${runs ? "" : ", no service"}">${c.d}</button>`;
    }
    grid.innerHTML = html;
  }
  function wireDatePicker() {
    const f = $('[data-filter="day"]'), trigger = $(".pill", f), pop = $("#pop-day");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pop.hidden) { B.closePop(false); return; }
      dp.pick = { ...st.date }; dp.view = { y: st.date.y, m: st.date.m, d: 1 };
      renderDatePicker();
      B.showPop(pop, trigger);
      ($('.dp-day[aria-pressed="true"]', pop) || $(".dp-day", pop)).focus();
    });
    $$(".dp-nav", pop).forEach((b) => b.addEventListener("click", () => {
      const d = D.toDate(dp.view); d.setMonth(d.getMonth() + +b.dataset.step);
      dp.view = { y: d.getFullYear(), m: d.getMonth() + 1, d: 1 };
      renderDatePicker();
    }));
    pop.addEventListener("click", (e) => {
      const b = e.target.closest(".dp-day");
      if (!b) return;
      const k = b.dataset.ymd;
      dp.pick = { y: +k.slice(0, 4), m: +k.slice(4, 6), d: +k.slice(6) };
      $$(".dp-day", pop).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    $(".ok", pop).addEventListener("click", () => { st.date = dp.pick; st.trip = null; B.closePop(true); update(); });
    $(".cancel", pop).addEventListener("click", () => B.closePop(true));
  }

  /* ---------- schedule ---------- */
  function scheduleNote() {
    const note = $("#schedule-note");
    if (!D.activeServices(route, st.date).size) {
      const svcs = Object.values(route.services).filter((v) => v.start);
      const first = svcs.map((v) => v.start).sort()[0], last = svcs.map((v) => v.end).sort().pop();
      const key = D.ymd(st.date), pretty = (k) => D.toDate({ y: +k.slice(0, 4), m: +k.slice(4, 6), d: +k.slice(6) })
        .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      note.textContent = (last && (key > last || key < first))
        ? `Big Blue Bus hasn't published schedules for ${longDay(st.date)}. Current schedules run ${pretty(first)} – ${pretty(last)}.`
        : `${route.label} doesn't run on ${longDay(st.date)}. Choose another day.`;
      note.dataset.tone = "warn";
      return;
    }
    note.textContent = `Scheduled times for ${isToday() ? "today, " : ""}${longDay(st.date)} · ${WINDOWS[st.win][2]}`;
    note.dataset.tone = "";
  }

  function renderStops() {
    const stops = dir().stops;
    acc.innerHTML = stops.map((s, i) => `
      <div class="acc${i === 0 ? " is-first" : ""}" data-i="${i}">
        <h3><button class="acc-btn" type="button" id="acc-b${i}" aria-expanded="${i === st.open}" aria-controls="acc-p${i}">
          <span class="acc-name">${esc(s.name)}<span class="acc-code">#${esc(s.code)}</span></span>
          <span class="ico"><img src="assets/icons/${i === st.open ? "acc-collapse" : "acc-expand"}.svg" width="14" height="14" alt=""></span>
        </button></h3>
        <div class="acc-panel" id="acc-p${i}" role="region" aria-labelledby="acc-b${i}"${i === st.open ? "" : " hidden"}></div>
      </div>`).join("");
    acc.removeAttribute("aria-busy");
    if (st.open != null) renderPanel(st.open);
  }

  function renderPanel(i) {
    const panel = $(`#acc-p${i}`);
    if (!panel) return;
    const deps = departuresAt(i);
    if (!deps.length) {
      const any = tripsToday().some((t) => t.t[i] != null);
      panel.innerHTML = `<p class="empty-msg">${!D.activeServices(route, st.date).size
        ? `No ${esc(route.label)} service on ${esc(longDay(st.date))}.`
        : any ? `No departures from this stop between ${WINDOWS[st.win][2]}. Try another time range.`
              : `Buses in this direction don't stop here on ${esc(longDay(st.date))}.`}</p>`;
      return;
    }
    // Default selection: the next departure if viewing today, otherwise the first in range
    if (!st.trip || !deps.some((d) => d.trip === st.trip)) {
      const now = D.laParts().minutes;
      const next = isToday() ? deps.find((d) => (d.m >= 1440 ? d.m - 1440 : d.m) >= now) : null;
      st.trip = (next || deps[0]).trip;
    }
    const chips = deps.map((d) => `<button class="time" type="button" aria-pressed="${d.trip === st.trip}" data-m="${d.m}">${D.fmt(d.m)}</button>`).join("");
    // Where the selected bus goes after this stop
    const stops = dir().stops, t = st.trip.t;
    const after = [];
    for (let k = i + 1; k < stops.length; k++) if (t[k] != null) after.push(k);
    const shown = st.showAll ? after : after.slice(0, PREVIEW_STOPS);
    const rows = shown.map((k) => {
      const s = stops[k];
      const xfer = s.transfers.length ? `<ul class="transfers" aria-label="Transfer routes">${s.transfers.map((r) =>
        `<li><a class="badge" href="${D.routeHref(r)}" aria-label="Transfer to ${r.startsWith("R") ? "Rapid " + r.slice(1) : "Route " + r}">${esc(r.replace(/^R/, ""))}</a></li>`).join("")}</ul>` : "";
      return `<li class="stop"><div class="stop-head"><p class="name t-body">${esc(s.name)}: #${esc(s.code)}</p><span class="time time-static">${D.fmt(t[k])}</span></div>${xfer}</li>`;
    }).join("");
    const more = after.length > PREVIEW_STOPS
      ? `<button class="link-btn stops-more" type="button">${st.showAll ? "Show fewer stops" : `Show all ${after.length} stops on this trip`}</button>` : "";
    const headsign = st.trip.h ? ` <span class="trip-note">This trip ends at ${esc(st.trip.h)}.</span>` : "";
    panel.innerHTML = `
      <div class="departures" role="group" aria-label="Departures from ${esc(stops[i].name)}"><div class="row">${chips}</div></div>
      ${after.length ? `<p class="after-label">Next stops for the ${D.fmt(st.trip.t[i])} bus${headsign}</p>
      <ol class="stops" aria-label="Arrival times">${rows}</ol>${more}` : `<p class="empty-msg">This is the last stop for this trip.</p>`}`;
  }

  function openStop(i, scroll) {
    const prev = st.open;
    st.open = (prev === i) ? null : i;
    st.picked = st.open != null; // the rider chose this stop (vs. the default first stop)
    st.trip = null; st.showAll = false;
    [prev, st.open].forEach((k) => {
      if (k == null) return;
      const btn = $(`#acc-b${k}`), panel = $(`#acc-p${k}`);
      if (!btn) return;
      const open = k === st.open;
      btn.setAttribute("aria-expanded", String(open));
      $(".ico img", btn).src = `assets/icons/${open ? "acc-collapse" : "acc-expand"}.svg`;
      panel.hidden = !open;
      if (open) renderPanel(k); else panel.innerHTML = "";
    });
    highlightStop();
    if (scroll && st.open != null) $(`#acc-b${st.open}`).scrollIntoView({ behavior: "smooth", block: "center" });
  }

  acc.addEventListener("click", (e) => {
    const btn = e.target.closest(".acc-btn");
    if (btn) { openStop(+btn.closest(".acc").dataset.i); return; }
    const chip = e.target.closest("button.time");
    if (chip) {
      const i = st.open, m = +chip.dataset.m;
      const d = departuresAt(i).find((x) => x.m === m);
      if (d) { st.trip = d.trip; renderPanel(i); $(`#acc-p${i} button.time[aria-pressed="true"]`).focus(); }
      return;
    }
    if (e.target.closest(".stops-more")) { st.showAll = !st.showAll; renderPanel(st.open); }
  });

  /* ---------- map (Leaflet + OpenStreetMap) ---------- */
  function initMap() {
    if (!window.L) { $("#map-leaflet").innerHTML = `<p class="map-msg">The map couldn't load.</p>`; return; }
    const touch = matchMedia("(pointer: coarse)").matches;
    map = L.map("map-leaflet", { zoomControl: false, scrollWheelZoom: false, dragging: !touch, tap: false,
      attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.75 });
    map.on("zoomend", sizeStops);
    // Basemap: OpenFreeMap vector tiles (no key) styled to match the Figma map
    // (assets/map-style.json, built by tools/make_map_style.py). Falls back to
    // standard OpenStreetMap tiles if the browser can't draw vector maps.
    const osm = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    let vector = false;
    try {
      const c = document.createElement("canvas");
      if (L.maplibreGL && window.maplibregl && (c.getContext("webgl2") || c.getContext("webgl"))) {
        L.maplibreGL({ style: "assets/map-style.json", interactive: false,
          attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> ' + osm }).addTo(map);
        vector = true;
      }
    } catch (e) { vector = false; }
    if (!vector) L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: osm }).addTo(map);
    map.attributionControl.setPrefix(false);
    const wrap = $("#route-map"), exp = $(".map-expand", wrap);
    exp.addEventListener("click", () => {
      const on = !wrap.classList.contains("is-expanded");
      wrap.classList.toggle("is-expanded", on);
      exp.setAttribute("aria-pressed", String(on));
      exp.setAttribute("aria-label", on ? "Minimize map" : "Expand map");
      $(".label", exp).textContent = on ? "Minimize" : "Expand";
      $(".ico img", exp).src = on ? "assets/icons/map-minimize.svg" : "assets/icons/map-expand.svg";
      setTimeout(() => { map.invalidateSize(); fit(); }, 220);
    });
    $$("[data-zoom]", wrap).forEach((b) => b.addEventListener("click", () => (+b.dataset.zoom > 0 ? map.zoomIn() : map.zoomOut())));
    window.addEventListener("resize", () => map.invalidateSize());
  }
  function fit() { if (map && layers.path) map.fitBounds(layers.path.getBounds(), { padding: [28, 28] }); }
  function drawMap() {
    if (!map) return;
    Object.values(layers).forEach((l) => l && map.removeLayer(l));
    const d = dir();
    const path = d.path.length ? d.path : d.stops.map((s) => [s.lat, s.lon]);
    layers.casing = L.polyline(path, { color: "#FFFFFF", weight: 9, opacity: 0.9, interactive: false }).addTo(map);
    layers.path = L.polyline(path, { color: "#005EB8", weight: 5, opacity: 1, interactive: false }).addTo(map);
    layers.stops = L.layerGroup(d.stops.map((s, i) => {
      const end = i === 0 || i === d.stops.length - 1;
      const m = L.circleMarker([s.lat, s.lon], {
        radius: end ? 6 : 4, color: "#005EB8", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1, className: "map-stop",
      });
      m.isEnd = end;
      m.bindTooltip(`${s.name} · #${s.code}`, { direction: "top", offset: [0, -6] });
      m.on("click", () => { if (st.open !== i) openStop(i, true); });
      return m;
    })).addTo(map);
    fit();
    sizeStops();
    highlightStop();
  }
  // Zoomed out, full-size stop dots bunch into a chain that hides the line: scale them with zoom
  function sizeStops() {
    if (!map || !layers.stops) return;
    const z = map.getZoom();
    const r = z >= 15 ? 5 : z >= 14 ? 4 : z >= 13 ? 3 : 2;
    layers.stops.eachLayer((m) => m.setStyle({ radius: m.isEnd ? Math.max(r + 2, 5) : r, weight: z >= 13 ? 2 : 1.5 }));
  }
  function highlightStop() {
    if (!map || !layers.stops) return;
    if (layers.sel) map.removeLayer(layers.sel);
    layers.sel = null;
    if (st.open == null) return;
    const s = dir().stops[st.open];
    layers.sel = L.circleMarker([s.lat, s.lon], { radius: 9, color: "#FFFFFF", weight: 3, fillColor: "#009CA4", fillOpacity: 1, interactive: false }).addTo(map);
  }

  /* ---------- CSV download of the current timetable ---------- */
  function downloadCSV() {
    const d = dir(), trips = tripsToday().filter((t) => t.t.some((m) => m != null && inWindow(m, st.win)))
      .sort((a, b) => (a.t.find((m) => m != null)) - (b.t.find((m) => m != null)));
    if (!trips.length) { B.toast && B.toast("No trips to download for this day and time range."); return; }
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Stop", "Stop #", ...trips.map((_, i) => `Trip ${i + 1}`)].map(q).join(",")];
    d.stops.forEach((s, i) => lines.push([s.name, s.code, ...trips.map((t) => (t.t[i] != null ? D.fmt(t.t[i]) : ""))].map(q).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bbb-${route.short}-to-${d.headsign.replace(/\W+/g, "-").toLowerCase()}-${D.ymd(st.date)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- update cycle ---------- */
  function update(full) {
    renderHeader();
    fillOptions();
    scheduleNote();
    if (full) { renderStops(); drawMap(); }
    else if (st.open != null) renderPanel(st.open);
  }
  function setDir(i) {
    if (i === st.dir) return;
    // Default: start at the new direction's first stop (the far end of the line).
    // If the rider picked a stop, keep its counterpart across the street: the
    // nearest stop in the other direction, if one is within about 250 m.
    const from = st.picked && st.open != null ? dir().stops[st.open] : null;
    st.dir = i; st.trip = null; st.showAll = false;
    let idx = -1;
    if (from) {
      const k = Math.cos(from.lat * Math.PI / 180);
      let best = Infinity;
      dir().stops.forEach((s, j) => {
        const dm = Math.hypot(s.lat - from.lat, (s.lon - from.lon) * k) * 111320;
        if (dm < best) { best = dm; idx = j; }
      });
      if (best > 250) idx = -1;
    }
    st.open = idx > -1 ? idx : 0;
    if (idx < 0) st.picked = false;
    update(true);
  }

  function fail(msg) {
    acc.removeAttribute("aria-busy");
    bind("label", "Route not found");
    acc.innerHTML = `<p class="empty-msg">${msg} <a href="index.html">See all routes</a>.</p>`;
  }

  D.route(short).then((r) => {
    route = r;
    st = defaults();
    D.recent.add(route.short);
    wireListFilter("direction", (v) => setDir(v));
    wireListFilter("trips", (v) => { st.win = v; st.trip = null; update(); });
    wireDatePicker();
    $(".dir-toggle").addEventListener("click", () => setDir((st.dir + 1) % route.directions.length));
    $(".filter-clear").addEventListener("click", () => {
      const keepOpen = st.open;
      st = defaults(); st.open = keepOpen ?? 0;
      update(true);
      B.toast && B.toast("Filters reset to today and the current time.");
    });
    $("#download-csv").addEventListener("click", downloadCSV);
    initMap();
    update(true);
  }).catch(() => fail(`We couldn't find a schedule for “${esc(short)}”.`));
})();
