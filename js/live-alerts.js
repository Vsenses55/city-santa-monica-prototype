/* Live service alerts from Big Blue Bus (GTFS-realtime).
   Feed: https://gtfs.bigbluebus.com/alerts.bin (HTTPS, CORS-enabled, protobuf).
   Data is free to use under the City of Santa Monica terms of use.

   If the feed can't be reached, the static reference cards already in the
   page stay in place and a note says so. Nothing here claims data is live
   unless it actually came from the feed. */
(function () {
  "use strict";
  if (document.documentElement.classList.contains("is-device")) return; // desktop: the page runs inside the phone frame instead
  const FEED = "https://gtfs.bigbluebus.com/alerts.bin";
  const BBB_ALERTS = "https://www.bigbluebus.com/servicealerts";
  const TIMEOUT_MS = 8000;
  // Route page: route.html?r=8 ; Home has no route
  const ROUTE_PAGE_ID = new URLSearchParams(location.search).get("r") || (document.getElementById("service-alerts") ? "1" : null);

  /* ---------- Minimal protobuf reader (only what GTFS-rt alerts need) ---------- */
  function reader(buf) {
    let pos = 0;
    const varint = () => {
      let result = 0, mul = 1, b;
      do { b = buf[pos++]; result += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80);
      return result;
    };
    return {
      done: () => pos >= buf.length,
      field() { const key = varint(); return { num: Math.floor(key / 8), type: key & 7 }; },
      varint,
      bytes() { const len = varint(); const out = buf.subarray(pos, pos + len); pos += len; return out; },
      skip(type) {
        if (type === 0) varint();
        else if (type === 1) pos += 8;
        else if (type === 2) pos += varint();
        else if (type === 5) pos += 4;
        else throw new Error("Unsupported wire type " + type);
      },
    };
  }
  const utf8 = new TextDecoder();
  // Generic: read a message into { fieldNumber: [values] } using a schema of
  // { num: "string" | "varint" | subSchema }
  function decode(buf, schema) {
    const r = reader(buf), out = {};
    while (!r.done()) {
      const { num, type } = r.field();
      const kind = schema[num];
      if (!kind) { r.skip(type); continue; }
      let val;
      if (kind === "varint") val = r.varint();
      else if (kind === "string") val = utf8.decode(r.bytes());
      else val = decode(r.bytes(), kind);
      (out[num] = out[num] || []).push(val);
    }
    return out;
  }
  // gtfs-realtime.proto field numbers
  const Translated = { 1: { 1: "string", 2: "string" } };              // translation { text, language }
  const Alert = {
    1: { 1: "varint", 2: "varint" },                                   // active_period { start, end }
    5: { 1: "string", 2: "string", 3: "varint", 5: "string" },         // informed_entity { agency, route, type, stop }
    6: "varint", 7: "varint",                                          // cause, effect
    8: Translated, 10: Translated, 11: Translated,                     // url, header_text, description_text
  };
  const Feed = {
    1: { 1: "string", 3: "varint" },                                   // header { version, timestamp }
    2: { 1: "string", 5: Alert },                                      // entity { id, alert }
  };
  const text = (t) => {
    if (!t || !t[0] || !t[0][1]) return "";
    const tr = t[0][1].find((x) => !x[2] || /^en/i.test(x[2][0])) || t[0][1][0];
    return (tr[1] && tr[1][0]) || "";
  };

  function parse(buf) {
    const feed = decode(buf, Feed);
    const ts = feed[1] && feed[1][0][3] ? feed[1][0][3][0] : 0;
    const now = Date.now() / 1000;
    const alerts = (feed[2] || []).filter((e) => e[5]).map((e) => {
      const a = e[5][0];
      const periods = (a[1] || []).map((p) => ({ start: p[1] ? p[1][0] : 0, end: p[2] ? p[2][0] : 0 }));
      const routes = [...new Set((a[5] || []).map((ie) => ie[2] && ie[2][0]).filter(Boolean))];
      let url = text(a[8]).trim();
      if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
      return {
        id: e[1] ? e[1][0] : "",
        header: text(a[10]).trim(),
        description: text(a[11]).replace(/ /g, " ").trim(),
        url: url || BBB_ALERTS,
        routes,
        start: periods.reduce((m, p) => (p.start && (!m || p.start < m) ? p.start : m), 0),
        active: !periods.length || periods.some((p) => (!p.start || p.start <= now) && (!p.end || p.end >= now)),
      };
    }).filter((a) => a.active && a.header);
    alerts.sort((x, y) => y.start - x.start); // newest first
    return { updated: ts ? new Date(ts * 1000) : new Date(), alerts };
  }

  // BBB's server sometimes returns a cached copy without its CORS header, which
  // the browser rejects. A unique query string always gets a fresh copy (12/12 in
  // testing vs about 4 in 6 without), and one retry covers the rest.
  async function fetchOnce() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${FEED}?t=${Date.now()}`, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return parse(new Uint8Array(await res.arrayBuffer()));
    } finally { clearTimeout(t); }
  }
  const fetchAlerts = () => fetchOnce().catch(() => new Promise((r) => setTimeout(r, 600)).then(fetchOnce));

  /* ---------- Rendering ---------- */
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const timeFmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateFmt = (s) => new Date(s * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  // "Route 8: Detour in Downtown Santa Monica" -> ["Route 8:", "Detour in Downtown Santa Monica"]
  function splitHeader(h, routes) {
    const i = h.indexOf(":");
    if (i > 0 && i < 40) return [h.slice(0, i + 1), h.slice(i + 1).trim()];
    return [routes.length ? "" : "All Routes:", h];
  }
  function setStatus(el, state, msg) {
    if (!el) return;
    el.dataset.state = state;
    el.textContent = msg;
  }
  const routeLabel = (r) => (/^R/i.test(r) ? "Rapid " + r.slice(1) : "Route " + r);

  /* Home: replace the carousel cards */
  function renderHome(data) {
    const track = document.querySelector("[data-carousel] .carousel-track");
    if (!track) return;
    const status = document.getElementById("alerts-status");
    if (!data.alerts.length) {
      track.innerHTML = `<li><div class="alert-card is-empty"><span class="labels"><span class="t-heading">All clear</span><span class="t-small">No service alerts right now.</span></span></div></li>`;
    } else {
      track.innerHTML = data.alerts.map((a) => {
        const [label, desc] = splitHeader(a.header, a.routes);
        // Open this site's page for the (first) affected route; system-wide notices aren't links
        const route = a.routes[0];
        const inner = `<img class="alert-icon" src="assets/icons/alert.svg" width="25" height="25" alt="Alert"><span class="labels">${label ? `<span class="t-heading">${esc(label)}</span>` : ""}<span class="t-small">${esc(desc)}</span></span>`;
        return route
          ? `<li><a class="alert-card" href="route.html?r=${encodeURIComponent(route)}#service-alerts">${inner}</a></li>`
          : `<li><div class="alert-card">${inner}</div></li>`;
      }).join("");
    }
    track.scrollLeft = 0;
    setStatus(status, "live", `Live from Big Blue Bus · Updated ${timeFmt(data.updated)}`);
    window.dispatchEvent(new Event("resize")); // rebuild carousel dots
  }

  /* Route page: this route's alerts in the side panel + count in the alert bar */
  function renderRoute(data) {
    const body = document.querySelector("#service-alerts .alerts-body");
    if (!body) return;
    const mine = data.alerts.filter((a) => a.routes.includes(ROUTE_PAGE_ID));
    const status = document.getElementById("route-alerts-status");
    const count = document.querySelector(".alert-bar .t-body");
    if (count) count.textContent = `Service Alerts (${mine.length})`;
    if (!mine.length) {
      body.innerHTML = `<article class="notice is-empty"><h3 class="t-strong">No service alerts for ${routeLabel(ROUTE_PAGE_ID)} right now.</h3></article>`;
    } else {
      body.innerHTML = mine.map((a) => `
        <article class="notice">
          <p class="t-strong">${a.start ? `<time datetime="${new Date(a.start * 1000).toISOString().slice(0, 10)}">${dateFmt(a.start)}</time>` : "Ongoing"}</p>
          <h3 class="t-subsection">${esc(a.header)}</h3>
          <div class="msg t-body">${a.description.split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        </article>`).join("");
    }
    setStatus(status, "live", `Live from Big Blue Bus · Updated ${timeFmt(data.updated)}`);
  }

  function fail() {
    setStatus(document.getElementById("alerts-status"), "fallback", "Showing sample alerts. The live feed couldn't be reached.");
    setStatus(document.getElementById("route-alerts-status"), "fallback", "The live feed couldn't be reached.");
    const body = document.querySelector("#service-alerts .alerts-body");
    if (body && !body.children.length) body.innerHTML = `<article class="notice is-empty"><h3 class="t-strong">Live alerts couldn't be loaded right now.</h3></article>`;
  }

  const hasHome = document.querySelector("[data-carousel]");
  const hasRoute = document.getElementById("service-alerts");
  if (!hasHome && !hasRoute) return;
  setStatus(document.getElementById("alerts-status"), "loading", "Checking for live alerts…");
  setStatus(document.getElementById("route-alerts-status"), "loading", "Checking for live alerts…");
  fetchAlerts()
    .then((data) => { if (hasHome) renderHome(data); if (hasRoute) renderRoute(data); })
    .catch(fail);
})();
