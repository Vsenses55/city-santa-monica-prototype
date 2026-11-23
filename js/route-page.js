/* Route page: everything comes from data/route-<n>.json (Big Blue Bus GTFS).
   route.html?r=8 shows Route 8; no parameter shows Route 1. */
(function () {
  "use strict";
  if (document.documentElement.classList.contains("is-device")) return; // desktop: the page runs inside the phone frame instead
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
  const winOf = (m) => Math.min(5, Math.floor((m >= 1440 ? m - 1440 : m) / 240));

  let route, st, map, layers = {};
  const defaults = () => {
    const now = D.laParts();
    return { dir: 0, date: D.today(), win: Math.min(5, Math.floor(now.minutes / 240)), open: null, trip: null, dest: null, showAll: false };
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
    $(".sheet-dir").hidden = route.directions.length < 2;
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

  /* Dropdown filters: picking an option applies it right away; Escape or a tap outside closes */
  function wireListFilter(name, apply) {
    const f = $(`[data-filter="${name}"]`), trigger = $(".pill", f), pop = $(".popover", f);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pop.hidden) { B.closePop(false); return; }
      B.showPop(pop, trigger);
      ($('[aria-selected="true"]', pop) || $(".option", pop)).focus();
    });
    pop.addEventListener("click", (e) => {
      const o = e.target.closest(".option");
      if (!o) return;
      $$(".option", pop).forEach((x) => x.setAttribute("aria-selected", String(x === o)));
      B.closePop(true);
      apply(+o.dataset.v);
    });
    pop.addEventListener("keydown", (e) => {
      const opts = $$(".option", pop), i = opts.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i > -1) { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      if (e.key === "ArrowUp" && i > -1) { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
    });
  }

  /* Date picker (native calendar composition) */
  const dp = { view: null, pick: null };
  function renderDatePicker() {
    const pop = $("#pop-day"), grid = $(".dp-grid", pop);
    $(".dp-month .t-heading", pop).textContent = D.toDate(dp.view).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const first = D.toDate(dp.view);
    const start = new Date(first); start.setDate(1 - first.getDay());
    // Standard month grid: only the weeks this month touches (4 to 6 rows)
    const daysInMonth = new Date(dp.view.y, dp.view.m, 0).getDate();
    const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
    const todayKey = D.ymd(D.today());
    let html = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<span class="dow" aria-hidden="true">${d}</span>`).join("");
    for (let i = 0; i < cells; i++) {
      const dt = new Date(start); dt.setDate(start.getDate() + i);
      const c = D.fromDate(dt);
      const outside = c.m !== dp.view.m;
      const past = D.ymd(c) < todayKey; // past days can't be picked
      const runs = D.activeServices(route, c).size > 0;
      html += `<button type="button" class="dp-day${outside ? " is-outside" : ""}${past ? " is-past" : ""}${runs ? "" : " no-service"}"${past ? " disabled" : ""} data-ymd="${D.ymd(c)}" aria-pressed="${D.sameDay(c, dp.pick)}" aria-label="${esc(longDay(c))}${runs ? "" : ", no service"}">${c.d}</button>`;
    }
    grid.innerHTML = html;
    // No browsing back before the current month
    const t = D.today();
    $('.dp-nav[data-step="-1"]', pop).disabled = dp.view.y < t.y || (dp.view.y === t.y && dp.view.m <= t.m);
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
      // Picking a day applies it right away
      st.date = dp.pick; st.trip = null; st.leftNote = null; B.closePop(true); update();
    });
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
    // Default selection: the next departure if viewing today, otherwise the first in range.
    // With a destination chosen, prefer buses that actually reach it.
    if (!st.trip || !deps.some((d) => d.trip === st.trip)) {
      const now = D.laParts().minutes;
      const reaches = (d) => st.dest == null || (d.trip.t[st.dest] != null && d.trip.t[st.dest] >= d.m);
      const pool = deps.filter(reaches).length ? deps.filter(reaches) : deps;
      const next = isToday() ? pool.find((d) => d.m >= now) : null;
      st.trip = (next || pool[0]).trip;
    }
    // A destination this bus doesn't reach is dropped
    if (st.dest != null && st.trip.t[st.dest] == null) st.dest = null;
    const chips = deps.map((d) => `<button class="time" type="button" aria-pressed="${d.trip === st.trip}" data-m="${d.m}">${D.fmt(d.m)}</button>`).join("");
    // Where the selected bus goes after this stop
    const stops = dir().stops, t = st.trip.t;
    const after = [];
    for (let k = i + 1; k < stops.length; k++) if (t[k] != null) after.push(k);
    if (st.dest != null && after.indexOf(st.dest) >= PREVIEW_STOPS) st.showAll = true; // keep the destination in view
    const shown = st.showAll ? after : after.slice(0, PREVIEW_STOPS);
    const rows = shown.map((k) => {
      const s = stops[k], isDest = k === st.dest;
      const xfer = s.transfers.length ? `<ul class="transfers" aria-label="Transfer routes">${s.transfers.map((r) =>
        `<li><a class="badge" href="${D.routeHref(r)}" aria-label="Transfer to ${r.startsWith("R") ? "Rapid " + r.slice(1) : "Route " + r}">${esc(r.replace(/^R/, ""))}</a></li>`).join("")}</ul>` : "";
      // Tapping a next stop makes it the destination (tap again to clear)
      return `<li class="stop${isDest ? " is-dest" : ""}"><button class="stop-head stop-pick" type="button" data-k="${k}" aria-pressed="${isDest}" aria-label="${esc(s.name)}, arrives ${D.fmt(t[k])}. ${isDest ? "Your destination. Tap to clear" : "Set as destination"}"><span class="name t-body">${esc(s.name)}: #${esc(s.code)}</span><span class="time time-static">${D.fmt(t[k])}</span></button>${xfer}</li>`;
    }).join("");
    const more = after.length > PREVIEW_STOPS
      ? `<button class="link-btn stops-more" type="button">${st.showAll ? "Show fewer stops" : `Show all ${after.length} stops on this trip`}</button>` : "";
    const headsign = st.trip.h ? ` <span class="trip-note">This trip ends at ${esc(st.trip.h)}.</span>` : "";
    panel.innerHTML = `
      <div class="departures" role="group" aria-label="Departures from ${esc(stops[i].name)}"><div class="row">${chips}</div></div>
      ${after.length ? `<p class="after-label">Next stops for the ${D.fmt(st.trip.t[i])} bus${headsign}${st.dest == null ? ` <span class="pick-hint">Tap your stop to see when you'd arrive.</span>` : ""}</p>
      <ol class="stops" aria-label="Arrival times">${rows}</ol>${more}` : `<p class="empty-msg">This is the last stop for this trip.</p>`}`;
    renderTrip();
  }

  function openStop(i, scroll) {
    const prev = st.open;
    st.open = (prev === i) ? null : i;
    st.picked = st.open != null; // the rider opened this stop
    st.trip = null; st.showAll = false; st.dest = null; st.leftNote = null;
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
    renderTrip();
    if (st.open != null && document.body.classList.contains("map-open")) { $(".map-sheet").classList.add("is-half"); focusStop(); }
    if (scroll && st.open != null) $(`#acc-b${st.open}`).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  acc.addEventListener("click", (e) => {
    const btn = e.target.closest(".acc-btn");
    if (btn) { openStop(+btn.closest(".acc").dataset.i); return; }
    const chip = e.target.closest("button.time");
    if (chip) {
      const i = st.open, m = +chip.dataset.m;
      const d = departuresAt(i).find((x) => x.m === m);
      if (d) { st.trip = d.trip; st.leftNote = null; renderPanel(i); $(`#acc-p${i} button.time[aria-pressed="true"]`).focus(); }
      return;
    }
    if (e.target.closest(".stops-more")) { st.showAll = !st.showAll; renderPanel(st.open); return; }
    const pick = e.target.closest(".stop-pick");
    if (pick) {
      const k = +pick.dataset.k;
      st.dest = st.dest === k ? null : k; st.leftNote = null; st.cardMin = false; clearTimeout(minT);
      renderPanel(st.open);
      if (st.dest != null) fitTrip();
      const again = $(`#acc-p${st.open} .stop-pick[data-k="${k}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  });

  /* ---------- trip card: from → to, departs, arrives ---------- */
  const card = $("#trip-card");
  // Roll forward: once the chosen bus has left, move the whole page (time chip,
  // Trips filter, day if needed) to the next bus that serves both stops
  function rollIfLeft() {
    if (!route || st.open == null || st.dest == null || !st.trip || !isToday()) return false;
    const now = D.laParts().minutes, dep = st.trip.t[st.open];
    if (dep == null || dep >= now) return false;
    const n = D.nextTrip(route, st.dir, st.open, st.dest, st.date, now);
    if (!n) return false;
    st.leftNote = n.dayOffset === 0
      ? `The ${D.fmt(dep)} bus has left. Here's the next one.`
      : `No more buses between these stops today. Showing the first one ${n.dayOffset === 1 ? "tomorrow" : D.toDate(n.date).toLocaleDateString("en-US", { weekday: "long" })}.`;
    st.trip = n.trip; st.date = n.date; st.win = winOf(n.dep);
    return true;
  }
  function tripInfo() {
    if (!route || st.open == null || st.dest == null || !st.trip) return null;
    const stops = dir().stops, i = st.open, k = st.dest, trip = st.trip;
    let count = 0;
    for (let j = i + 1; j <= k; j++) if (trip.t[j] != null) count++;
    const dayNote = isToday() ? "" : D.sameDay(st.date, D.addDays(D.today(), 1)) ? "Tomorrow"
      : D.toDate(st.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return { from: stops[i], to: stops[k], dep: trip.t[i], arr: trip.t[k], left: st.leftNote, dayNote, count, trip };
  }
  function renderTrip() {
    if (!card) return;
    if (rollIfLeft()) { update(); return; } // update() re-renders the panel, which calls back here
    const t = tripInfo();
    card.hidden = !t;
    document.body.classList.toggle("has-trip", !!t);
    drawSegment();
    syncPeek();
    if (!t) return;
    const saved = D.trips.has(savedShape(t));
    card.classList.toggle("is-min", !!st.cardMin);
    document.body.classList.toggle("trip-collapsed", !!st.cardMin);
    const closeBtn = `<button class="trip-close" type="button" aria-label="Clear destination"><img src="assets/icons/close.svg" width="14" height="14" alt=""></button>`;
    // Collapsed: a slim pill with the times; tap it to see the whole trip
    if (st.cardMin) {
      card.innerHTML = `
        <span class="badge" aria-hidden="true">${esc(route.badge)}</span>
        <button class="trip-expand" type="button" aria-expanded="false" aria-label="Show your trip: ${esc(D.shortStop(t.from.name))} to ${esc(D.shortStop(t.to.name))}, ${t.dayNote ? t.dayNote + " " : ""}${D.fmt(t.dep)} to ${D.fmt(t.arr)}">
          <span class="pill-times">${t.dayNote ? `${esc(t.dayNote)} ` : ""}${D.fmt(t.dep)}<span class="arrow" aria-hidden="true">→</span>${D.fmt(t.arr)}</span>
          <span class="pill-to">to ${esc(D.shortStop(t.to.name))}</span>
          <img class="chev" src="assets/icons/chev-left.svg" width="8" height="13" alt="">
        </button>
        ${closeBtn}`;
      syncPeek();
      return;
    }
    const times = `<p class="trip-times"><strong>${t.dayNote ? `${t.dayNote} ` : ""}${D.fmt(t.dep)}</strong><span class="arrow" aria-hidden="true">→</span><strong>${D.fmt(t.arr)}</strong>
         <span class="trip-meta">${t.count} stop${t.count === 1 ? "" : "s"} · ${t.arr - t.dep} min · scheduled</span></p>`;
    card.innerHTML = `
      <span class="badge" aria-hidden="true">${esc(route.badge)}</span>
      <div class="trip-body">
        <p class="trip-stops"><span class="lbl">From</span><span class="nm">${esc(D.shortStop(t.from.name))}</span></p>
        <p class="trip-stops"><span class="lbl">To</span><span class="nm">${esc(D.shortStop(t.to.name))}</span></p>
        ${t.left ? `<p class="trip-left">${esc(t.left)}</p>` : ""}
        ${times}
      </div>
      <div class="trip-actions">
        <div class="trip-top">
          <button class="trip-min" type="button" aria-label="Minimize trip"><img class="chev" src="assets/icons/chev-left.svg" width="8" height="13" alt=""></button>
          ${closeBtn}
        </div>
        <button class="trip-save" type="button" aria-pressed="${saved}">${saved ? "Saved" : "Save"}</button>
      </div>`;
    syncPeek();
  }
  // What gets stored for "My Trips": ids (stable across data rebuilds) plus labels for the home page
  let minT;
  const savedShape = (t) => ({ r: route.short, d: st.dir, from: t.from.id, to: t.to.id,
    badge: route.badge, label: route.label, fromName: t.from.name, toName: t.to.name, headsign: dir().headsign });
  if (card) {
    card.addEventListener("click", (e) => {
      const t = tripInfo();
      if (!t) return;
      if (e.target.closest(".trip-close")) { st.dest = null; st.cardMin = false; renderPanel(st.open); return; }
      // Pill tapped: show the whole card again
      if (st.cardMin) { st.cardMin = false; renderTrip(); const m = $(".trip-min", card); if (m) m.focus(); return; }
      if (e.target.closest(".trip-min")) { st.cardMin = true; renderTrip(); const x = $(".trip-expand", card); if (x) x.focus(); return; }
      if (e.target.closest(".trip-save")) {
        const shape = savedShape(t);
        if (D.trips.has(shape)) { D.trips.remove(shape); B.toast && B.toast("Removed from My Trips."); renderTrip(); return; }
        if (!D.trips.add(shape)) { B.toast && B.toast("This browser won't let the site save trips."); return; }
        B.toast && B.toast("Saved. Find it under My Trips on the home page.");
        renderTrip();
        // Saved: after a moment, shrink to the pill to give the page back
        clearTimeout(minT);
        minT = setTimeout(() => { if (st.dest != null) { st.cardMin = true; renderTrip(); } }, 900);
        return;
      }
      // Anywhere else on the card: bring the trip back into view
      if (document.body.classList.contains("map-open")) { $(".map-sheet").classList.add("is-half"); setTimeout(fit, 320); }
      const b = $(`#acc-b${st.open}`);
      if (b) b.scrollIntoView({ behavior: "smooth", block: "start" });
      fitTrip();
    });
    // Keep the card current: when the chosen bus leaves, it rolls to the next one
    setInterval(() => { if (!card.hidden) renderTrip(); }, 30000);
  }

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
    const wrap = $("#route-map");
    initFullMap(wrap, touch);
    $$("[data-zoom]", wrap).forEach((b) => b.addEventListener("click", () => (+b.dataset.zoom > 0 ? map.zoomIn() : map.zoomOut())));
    window.addEventListener("resize", () => map.invalidateSize());
    // Shadow (and, on mobile, the route tag) once the map is pinned to the top
    let tick = false;
    // Desktop pins the filter bar above the map: measure it so the map pins just below
    const main = $(".route-main"), filters = $(".filters"), wide = matchMedia("(min-width: 721px)");
    let pin = 0;
    const measure = () => { pin = wide.matches ? filters.offsetHeight + 12 : 0; main.style.setProperty("--pin", pin + "px"); };
    measure();
    addEventListener("resize", measure);
    const stuck = () => { tick = false; wrap.classList.toggle("is-stuck", !wrap.classList.contains("is-full") && wrap.getBoundingClientRect().top <= pin + 0.5 && scrollY > 0); };
    addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(stuck); } }, { passive: true });
    addEventListener("resize", stuck);
  }
  function fit() {
    if (!map || !layers.path) return;
    const sheet = $(".map-sheet");
    const full = $("#route-map").classList.contains("is-full");
    map.fitBounds(layers.path.getBounds(), full
      ? { paddingTopLeft: [28, 72], paddingBottomRight: [28, sheet.offsetHeight - sheetOffset(sheet) + 28] }
      : { padding: [28, 28] });
  }
  // Full-screen map: move the open stop into the visible area above the sheet
  function focusStop() {
    if (!map || st.open == null) return;
    const s = dir().stops[st.open], sheet = $(".map-sheet"), size = map.getSize();
    const visible = size.y - (sheet.offsetHeight - sheetOffset(sheet));
    const p = map.latLngToContainerPoint([s.lat, s.lon]);
    map.panBy([p.x - size.x / 2, p.y - visible / 2], { animate: true, duration: 0.35 });
  }
  // How far the sheet is pushed down (0 = half height, larger = peeking)
  function sheetOffset(sheet) { return sheet.classList.contains("is-half") ? 0 : sheet.offsetHeight - peekHeight(sheet); }
  function peekHeight(sheet) {
    const c = $(".trip-card", sheet);
    return $(".sheet-handle", sheet).offsetHeight + $(".sheet-head", sheet).offsetHeight + (c && !c.hidden ? c.offsetHeight + 12 : 0) + 8;
  }
  function syncPeek() {
    const sheet = $(".map-sheet");
    if (sheet && document.body.classList.contains("map-open")) sheet.style.setProperty("--peek", peekHeight(sheet) + "px");
  }

  /* ---------- Phones: full-screen map with the stops in a bottom sheet ---------- */
  function initFullMap(wrap, touch) {
    const exp = $(".map-expand", wrap), sheet = $(".map-sheet", wrap), body = $(".sheet-body", sheet);
    const note = $("#schedule-note");
    const home = document.createComment("schedule list home");
    const cardHome = document.createComment("trip card home");
    let full = false;

    function setFull(on, fromHistory) {
      if (on === full) return;
      full = on;
      if (on) { note.before(home); body.append(note, acc); if (card) { card.before(cardHome); $(".sheet-head", sheet).after(card); } }
      else { home.after(note, acc); home.remove(); if (card) { cardHome.after(card); cardHome.remove(); } }
      wrap.classList.toggle("is-full", on);
      document.body.classList.toggle("map-open", on);
      exp.setAttribute("aria-pressed", String(on));
      exp.setAttribute("aria-label", on ? "Minimize map" : "Expand map");
      $("img", exp).src = on ? "assets/icons/map-minimize.svg" : "assets/icons/map-expand.svg";
      // Full screen: one finger pans the map (nothing scrolls underneath)
      if (on) map.dragging.enable(); else if (touch) map.dragging.disable();
      sheet.classList.toggle("is-half", on && st.open != null);
      sheet.style.setProperty("--peek", peekHeight(sheet) + "px");
      // The phone's back gesture closes the full map instead of leaving the page
      if (on) history.pushState({ bbbMap: true }, "");
      else if (!fromHistory && history.state && history.state.bbbMap) history.back();
      setTimeout(() => {
        map.invalidateSize(); fit();
        if (on && st.open != null) { $(`#acc-b${st.open}`).scrollIntoView({ block: "start" }); focusStop(); }
        if (!on && st.open != null) $(`#acc-b${st.open}`).scrollIntoView({ block: "start" });
      }, 60);
    }
    exp.addEventListener("click", () => setFull(!full));
    addEventListener("popstate", () => { if (full) setFull(false, true); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && full) setFull(false); });
    addEventListener("resize", () => { if (full && !matchMedia("(max-width: 720px)").matches) setFull(false); });
    $(".sheet-dir", sheet).addEventListener("click", () => setDir((st.dir + 1) % route.directions.length));

    // Drag the sheet between "peek" and "half"; a tap on the handle toggles
    const setHalf = (half) => { sheet.classList.toggle("is-half", half); setTimeout(fit, 320); };
    let drag = null;
    $$(".sheet-handle, .sheet-head", sheet).forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".sheet-dir")) return;
        drag = { y: e.clientY, py: e.clientY, pt: e.timeStamp, v: 0, base: sheetOffset(sheet), at: sheetOffset(sheet), moved: false };
        sheet.classList.add("is-dragging");
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dy = e.clientY - drag.y;
        if (Math.abs(dy) > 4) drag.moved = true;
        const max = sheet.offsetHeight - peekHeight(sheet);
        drag.at = Math.min(max, Math.max(0, drag.base + dy));
        const dt = e.timeStamp - drag.pt;
        if (dt > 0) drag.v = (e.clientY - drag.py) / dt;
        drag.py = e.clientY; drag.pt = e.timeStamp;
        sheet.style.transform = `translateY(${drag.at}px)`;
      });
      const end = () => {
        if (!drag) return;
        sheet.classList.remove("is-dragging");
        sheet.style.transform = "";
        const max = sheet.offsetHeight - peekHeight(sheet);
        if (!drag.moved) setHalf(!sheet.classList.contains("is-half"));
        else setHalf(drag.v < -0.3 ? true : drag.v > 0.3 ? false : drag.at < max / 2);
        drag = null;
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    });
    // Keyboard: Enter/Space on the handle toggles the sheet
    $(".sheet-handle", sheet).addEventListener("click", (e) => { if (e.detail === 0) setHalf(!sheet.classList.contains("is-half")); });
  }
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
    drawSegment();
  }
  // Zoomed out, full-size stop dots bunch into a chain that hides the line: scale them with zoom
  function sizeStops() {
    if (!map || !layers.stops) return;
    const z = map.getZoom();
    const r = z >= 15 ? 5 : z >= 14 ? 4 : z >= 13 ? 3 : 2;
    layers.stops.eachLayer((m) => m.setStyle({ radius: m.isEnd ? Math.max(r + 2, 5) : r, weight: z >= 13 ? 2 : 1.5 }));
  }
  // Highlight the stretch you'll ride, from the open stop to your destination
  function drawSegment() {
    if (!map || !layers.path) return;
    ["seg", "segCase", "dest"].forEach((k) => { if (layers[k]) map.removeLayer(layers[k]); layers[k] = null; });
    if (st.open == null || st.dest == null) return;
    const d = dir(), a = d.stops[st.open], b = d.stops[st.dest];
    const pts = d.path.length ? d.path : d.stops.map((s) => [s.lat, s.lon]);
    const near = (s, from) => {
      let best = Infinity, idx = from;
      for (let j = from; j < pts.length; j++) {
        const dd = (pts[j][0] - s.lat) ** 2 + (pts[j][1] - s.lon) ** 2;
        if (dd < best) { best = dd; idx = j; }
      }
      return idx;
    };
    const ia = near(a, 0), ib = near(b, ia);
    const seg = [[a.lat, a.lon], ...pts.slice(ia + 1, ib), [b.lat, b.lon]];
    layers.segCase = L.polyline(seg, { color: "#FFFFFF", weight: 11, opacity: 1, interactive: false }).addTo(map);
    layers.seg = L.polyline(seg, { color: "#009CA4", weight: 7, opacity: 1, interactive: false }).addTo(map);
    layers.dest = L.circleMarker([b.lat, b.lon], { radius: 8, color: "#009CA4", weight: 4, fillColor: "#FFFFFF", fillOpacity: 1, interactive: false }).addTo(map);
    if (layers.sel) layers.sel.bringToFront();
  }
  // Zoom the map to the trip (both stops in view)
  function fitTrip() {
    if (!map || st.open == null || st.dest == null) return;
    const s = dir().stops, a = s[st.open], b = s[st.dest];
    const full = $("#route-map").classList.contains("is-full"), sheet = $(".map-sheet");
    const bottom = full ? sheet.offsetHeight - sheetOffset(sheet) + 40 : 40;
    map.fitBounds(L.latLngBounds([[a.lat, a.lon], [b.lat, b.lon]]), { paddingTopLeft: [40, full ? 80 : 40], paddingBottomRight: [40, bottom], maxZoom: 16 });
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
    // Stops start collapsed. If the rider opened a stop, keep its counterpart
    // across the street open: the nearest stop in the other direction, if one
    // is within about 250 m. Otherwise the new direction starts collapsed too.
    const from = st.picked && st.open != null ? dir().stops[st.open] : null;
    st.dir = i; st.trip = null; st.showAll = false; st.dest = null; st.leftNote = null;
    st.open = counterpart(from);
    st.picked = st.open != null;
    update(true);
    if (document.body.classList.contains("map-open") && st.open != null) {
      $(`#acc-b${st.open}`).scrollIntoView({ block: "start" });
      focusStop();
    }
  }
  // Index of the stop in the current direction nearest to `from` (within ~250 m), else null
  function counterpart(from) {
    if (!from) return null;
    const k = Math.cos(from.lat * Math.PI / 180);
    let best = Infinity, idx = null;
    dir().stops.forEach((s, j) => {
      const dm = Math.hypot(s.lat - from.lat, (s.lon - from.lon) * k) * 111320;
      if (dm < best) { best = dm; idx = j; }
    });
    return best <= 250 ? idx : null;
  }

  // Opened from My Trips: route.html?r=8&d=0&from=<stop id>&to=<stop id>
  function restoreTrip() {
    const q = new URLSearchParams(location.search), d = +q.get("d"), from = q.get("from"), to = q.get("to");
    if (!from || !to || !route.directions[d]) return;
    st.dir = d;
    const stops = dir().stops, i = stops.findIndex((s) => s.id === from), k = stops.findIndex((s) => s.id === to);
    if (i < 0 || k <= i) { st.dir = 0; return; }
    const n = D.nextTrip(route, st.dir, i, k, D.today(), D.laParts().minutes);
    st.open = i; st.dest = k; st.picked = true; st.cardMin = true;
    if (n) { st.date = n.date; st.win = winOf(n.dep); st.trip = n.trip; }
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
    wireListFilter("trips", (v) => { st.win = v; st.trip = null; st.leftNote = null; update(); });
    wireDatePicker();
    $(".dir-toggle").addEventListener("click", () => setDir((st.dir + 1) % route.directions.length));
    $(".filter-clear").addEventListener("click", () => {
      // Keep the open stop (its counterpart, if Clear All switches direction)
      const from = st.open != null ? dir().stops[st.open] : null, sameDir = st.dir === 0;
      st = defaults();
      st.open = from ? (sameDir ? dir().stops.indexOf(dir().stops.find((s) => s === from)) : counterpart(from)) : null;
      if (st.open === -1) st.open = null;
      st.picked = st.open != null;
      update(true);
      B.toast && B.toast("Filters reset to today and the current time.");
    });
    $("#download-csv").addEventListener("click", downloadCSV);
    restoreTrip();
    initMap();
    update(true);
    if (st.dest != null) setTimeout(() => { fitTrip(); const b = $(`#acc-b${st.open}`); if (b) b.scrollIntoView({ block: "start" }); }, 200);
  }).catch(() => fail(`We couldn't find a schedule for “${esc(short)}”.`));
})();
