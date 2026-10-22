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
})();
