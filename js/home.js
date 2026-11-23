/* Home: real route list and "Recently visited" from data/routes.json.
   The static list in index.html stays as a fallback if the data can't load. */
(function () {
  "use strict";
  if (document.documentElement.classList.contains("is-device")) return; // desktop: the page runs inside the phone frame instead
  const D = window.BBBData;
  const grid = document.getElementById("routes-grid");
  if (!D || !grid) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MOBILE_VISIBLE = 7; // the mobile frame shows seven routes before "View All Routes"

  function item(r, i) {
    const extra = i >= MOBILE_VISIBLE ? " is-extra" : "";
    return `<li><a class="route-item${extra}" href="${D.routeHref(r.short)}" data-route="${esc(r.short)}"><span class="badge badge-lg">${esc(r.badge)}</span><span class="labels"><span class="t-strong">${esc(r.label)}</span><span class="t-small">${esc(r.name)}</span></span></a></li>`;
  }

  D.routes().then(({ routes }) => {
    // Like the Figma frame: desktop rows read 1, 2, 3 left to right; mobile stacks
    // the columns, so its first seven are column one plus the top of column two.
    const cols = [0, 1, 2].map((c) => routes.filter((_, i) => i % 3 === c));
    let n = 0;
    grid.innerHTML = cols.map((col) => `<li class="colwrap"><ul class="col">${col.map((r) => item(r, n++)).join("")}</ul></li>`).join("");
    grid.style.setProperty("--rows", cols[0].length);

    // Recently visited: the last two route pages opened in this browser
    const recentWrap = document.querySelector(".recent");
    const list = D.recent.get().map((s) => routes.find((r) => r.short === s)).filter(Boolean);
    if (recentWrap) {
      if (!list.length) recentWrap.hidden = true;
      else {
        recentWrap.hidden = false;
        recentWrap.querySelector(".badges").innerHTML = list.map((r) =>
          `<li><a class="badge" href="${D.routeHref(r.short)}" aria-label="${esc(r.label)}">${esc(r.badge)}</a></li>`).join("");
      }
    }
  }).catch(() => { /* keep the static list from the design */ });

  /* My Trips: stop pairs saved on a route page, each showing its next scheduled bus */
  const tripsWrap = document.querySelector(".my-trips");
  function renderTrips() {
    if (!tripsWrap) return;
    const saved = D.trips.get();
    tripsWrap.hidden = !saved.length;
    if (!saved.length) return;
    const list = tripsWrap.querySelector(".trip-list");
    Promise.all(saved.map((t) => D.route(t.r).then((route) => {
      const d = route.directions[t.d];
      const i = d ? d.stops.findIndex((s) => s.id === t.from) : -1, k = d ? d.stops.findIndex((s) => s.id === t.to) : -1;
      if (i < 0 || k <= i) return { t, next: null, gone: true };
      return { t, next: D.nextTrip(route, t.d, i, k, D.today(), D.laParts().minutes) };
    }).catch(() => ({ t, next: null, gone: true })))).then((rows) => {
      list.innerHTML = rows.map(({ t, next, gone }, n) => {
        let when;
        if (gone) when = "This trip isn't in the current schedule.";
        else if (!next) when = "No buses between these stops this week.";
        else {
          const day = next.dayOffset === 0 ? "" : next.dayOffset === 1 ? "Tomorrow " :
            D.toDate(next.date).toLocaleDateString("en-US", { weekday: "long" }) + " ";
          when = `Next bus <strong>${day}${D.fmt(next.dep)}</strong> · arrives ${D.fmt(next.arr)}`;
        }
        return `<li class="saved-trip">
          <a href="${D.tripHref(t)}"><span class="badge badge-lg">${esc(t.badge)}</span>
            <span class="labels"><span class="t-strong">${esc(D.shortStop(t.fromName))} <span aria-hidden="true">→</span><span class="sr-only">to</span> ${esc(D.shortStop(t.toName))}</span>
            <span class="t-small">${when}</span></span></a>
          <button class="trip-remove" type="button" data-n="${n}" aria-label="Remove ${esc(t.label)} trip from My Trips"><img src="assets/icons/close.svg" width="12" height="12" alt=""></button>
        </li>`;
      }).join("");
    });
  }
  if (tripsWrap) {
    tripsWrap.addEventListener("click", (e) => {
      const b = e.target.closest(".trip-remove");
      if (!b) return;
      D.trips.remove(D.trips.get()[+b.dataset.n]);
      renderTrips();
    });
    renderTrips();
    setInterval(renderTrips, 60000); // keep "next bus" current
  }
})();
