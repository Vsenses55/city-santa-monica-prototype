/* Big Blue Bus prototype — interactions for index.html and route.html.
   Static reference content only: nothing here is live transit data. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Toast for prototype-only actions ---------- */
  const toastEl = $(".toast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 3200);
  }
  $$("[data-proto]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); toast(el.dataset.proto); })
  );

  /* ---------- Subscription field (footer) ---------- */
  $$(".subscribe").forEach((form) => {
    const input = $("input", form), err = $(".field-error", form), wrap = $(".sub-field", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = input.value.trim() && input.checkValidity();
      wrap.dataset.invalid = ok ? "false" : "true";
      input.setAttribute("aria-invalid", ok ? "false" : "true");
      err.textContent = ok ? "" : "Enter a valid email address, like name@example.com.";
      if (ok) { toast("Thanks! Sign-up isn't connected in this prototype, so nothing was sent."); input.value = ""; }
      else input.focus();
    });
  });

  /* ---------- Popover helper (dropdowns, date picker, suggestions) ---------- */
  let openPop = null;
  function closePop(restoreFocus) {
    if (!openPop) return;
    const { pop, trigger } = openPop;
    pop.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger) trigger.focus();
    openPop = null;
  }
  function showPop(pop, trigger) {
    if (openPop && openPop.pop !== pop) closePop(false);
    pop.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    openPop = { pop, trigger };
  }
  document.addEventListener("click", (e) => {
    if (!openPop) return;
    if (openPop.pop.contains(e.target) || (openPop.trigger && openPop.trigger.contains(e.target))) return;
    if (openPop.pop.id === "route-suggest" && e.target.closest(".search")) return;
    closePop(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openPop) closePop(true); });

  /* =================== HOME =================== */

  /* Route search with suggestions drawn from the routes list */
  const searchForm = $("#route-search");
  if (searchForm) {
    const input = $("#route-q"), list = $("#route-suggest");
    const routes = $$(".route-item").map((a) => ({
      num: a.dataset.route,
      name: $(".t-strong", a).textContent.trim(),
      streets: $(".t-small", a).textContent.trim(),
      href: a.getAttribute("href"),
      el: a,
    }));
    let active = -1, matches = [];
    function render() {
      const q = input.value.trim().toLowerCase().replace(/^(route|rapid)\s*#?/, "");
      if (!q) { closePop(false); input.setAttribute("aria-expanded", "false"); return; }
      matches = routes.filter((r) => r.num.startsWith(q) || r.name.toLowerCase().includes(q) || r.streets.toLowerCase().includes(q));
      active = -1;
      list.innerHTML = matches.length
        ? matches.map((r, i) => `<a class="option" role="option" id="sug-${i}" aria-selected="false" href="${r.href}"><span class="badge">${r.num}</span><span>${r.name} · ${r.streets}</span></a>`).join("")
        : `<p class="empty">No routes match “${input.value.trim()}”.</p>`;
      showPop(list, null);
      input.setAttribute("aria-expanded", "true");
    }
    function setActive(i) {
      const opts = $$(".option", list);
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, j) => o.setAttribute("aria-selected", j === active ? "true" : "false"));
      input.setAttribute("aria-activedescendant", opts[active].id);
      opts[active].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", render);
    input.addEventListener("focus", () => input.value.trim() && render());
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Escape") { input.setAttribute("aria-expanded", "false"); }
    });
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pick = active >= 0 ? matches[active] : matches[0];
      if (!input.value.trim()) { toast("Enter a route number, for example 16."); input.focus(); return; }
      if (!pick) { render(); return; }
      window.location.href = pick.href;
    });
  }

  /* Service alerts carousel */
  $$("[data-carousel]").forEach((car) => {
    const track = $(".carousel-track", car), dots = $(".dots", car);
    const prev = $('[data-dir="-1"]', car), next = $('[data-dir="1"]', car);
    function pages() { return Math.max(1, Math.ceil((track.scrollWidth - 1) / track.clientWidth)); }
    function current() {
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return 0;
      return Math.round((track.scrollLeft / max) * (pages() - 1));
    }
    function build() {
      const n = pages();
      dots.innerHTML = Array.from({ length: n }, (_, i) =>
        `<button class="dot" type="button" aria-label="Alerts page ${i + 1} of ${n}"><span></span></button>`).join("");
      $$(".dot", dots).forEach((d, i) => d.addEventListener("click", () => go(i)));
      update();
    }
    function go(i) {
      const max = track.scrollWidth - track.clientWidth;
      const n = pages();
      track.scrollTo({ left: n > 1 ? (max * i) / (n - 1) : 0, behavior: "smooth" });
    }
    function update() {
      const c = current();
      $$(".dot", dots).forEach((d, i) => d.setAttribute("aria-current", i === c ? "true" : "false"));
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    }
    prev.addEventListener("click", () => track.scrollBy({ left: -track.clientWidth * 0.9, behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: track.clientWidth * 0.9, behavior: "smooth" }));
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });

    /* Mouse drag to scroll. Touch and trackpads keep their native scrolling. */
    let drag = null, glide = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopGlide = () => {
      if (!glide) return;
      cancelAnimationFrame(glide); glide = 0;
      track.classList.remove("is-settling");
    };
    // Ease-out glide to a target; scroll snapping stays off until it lands
    function glideTo(target) {
      stopGlide();
      const from = track.scrollLeft, dist = target - from;
      if (reduceMotion.matches || Math.abs(dist) < 1) { track.scrollLeft = target; return; }
      const dur = Math.min(700, 320 + Math.abs(dist) * 0.45);   // longer throws take a bit longer
      const ease = (t) => 1 - Math.pow(1 - t, 3);                // easeOutCubic
      const t0 = performance.now();
      track.classList.add("is-settling");
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        track.scrollLeft = from + dist * ease(t);
        if (t < 1) glide = requestAnimationFrame(tick);
        else { glide = 0; track.classList.remove("is-settling"); }
      };
      glide = requestAnimationFrame(tick);
    }
    track.addEventListener("wheel", stopGlide, { passive: true });
    track.addEventListener("pointerdown", (e) => {
      stopGlide();
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false, id: e.pointerId, v: 0, lastX: e.clientX, lastT: performance.now() };
    });
    track.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;   // small moves stay clicks
      if (!drag.moved) {
        drag.moved = true;
        track.classList.add("is-dragging");
        track.setPointerCapture(e.pointerId);
      }
      track.scrollLeft = drag.left - dx;
      // Track release velocity (px/ms), smoothed so one jittery frame doesn't dominate
      const now = performance.now(), dt = now - drag.lastT;
      if (dt > 0) drag.v = 0.8 * ((e.clientX - drag.lastX) / dt) + 0.2 * drag.v;
      drag.lastX = e.clientX; drag.lastT = now;
    });
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const { moved: wasDrag, lastT } = drag;
      // A pause before letting go means no throw
      const v = performance.now() - lastT > 80 ? 0 : drag.v;
      drag = null;
      if (!wasDrag) return;
      // Momentum: project where the flick would carry the row, then land on a card edge
      const left = track.scrollLeft;
      const card = track.querySelector("li");
      const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 16) : 0;
      const max = track.scrollWidth - track.clientWidth;
      const projected = left - v * 220;
      let target = step ? Math.round(projected / step) * step : projected;
      target = Math.max(0, Math.min(max, target));
      track.classList.add("is-settling");     // keep snapping off through the hand-off
      track.classList.remove("is-dragging");
      track.scrollLeft = left;
      glideTo(target);
      // Swallow the click that follows a drag so a card link doesn't open
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      track.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => track.removeEventListener("click", swallow, { capture: true }), 80);
    };
    // Links and images are natively draggable; that would cancel the pointer drag
    track.addEventListener("dragstart", (e) => e.preventDefault());
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("resize", build);
    build();
  });

  /* Mobile: reveal all routes */
  const more = $(".routes-more");
  if (more) {
    const grid = $("#routes-grid");
    more.addEventListener("click", () => {
      const open = grid.classList.toggle("is-open");
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? "Show Fewer Routes" : "View All Routes";
    });
  }

  /* Trip planner: persistent labels + actionable errors */
  const planner = $("#planner-form");
  if (planner) {
    planner.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstBad = null;
      [["#trip-from", "Enter a starting point."], ["#trip-to", "Enter a destination."]].forEach(([sel, msg]) => {
        const f = $(sel, planner), err = $("#" + f.id + "-err");
        const bad = !f.value.trim();
        f.setAttribute("aria-invalid", bad ? "true" : "false");
        err.textContent = bad ? msg : "";
        if (bad && !firstBad) firstBad = f;
      });
      const status = $(".form-status", planner);
      if (firstBad) { status.textContent = ""; firstBad.focus(); return; }
      status.textContent = "Trip planning isn't connected in this prototype.";
    });
    $$(".input", planner).forEach((f) => f.addEventListener("input", () => {
      if (f.value.trim()) { f.setAttribute("aria-invalid", "false"); $("#" + f.id + "-err").textContent = ""; }
    }));
  }

  /* =================== ROUTE PAGE =================== */

  /* Filter dropdowns (Direction, Trips) */
  $$(".filter").forEach((filter) => {
    const trigger = $(".pill", filter), pop = $(".popover", filter), lbl = $(".lbl", trigger);
    const isDate = pop.classList.contains("datepicker");
    let pending = null;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pop.hidden) { closePop(false); return; }
      showPop(pop, trigger);
      if (isDate) datePicker.open(pop);
      const first = $('[aria-selected="true"], [aria-pressed="true"], .option, .dp-day', pop);
      if (first) first.focus();
    });

    if (!isDate) {
      const opts = $$(".option", pop);
      opts.forEach((o, i) => {
        o.addEventListener("click", () => {
          opts.forEach((x) => x.setAttribute("aria-selected", "false"));
          o.setAttribute("aria-selected", "true");
          pending = o.textContent.trim();
        });
        o.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
          if (e.key === "ArrowUp") { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
        });
      });
      $(".ok", pop).addEventListener("click", () => {
        const sel = $('[aria-selected="true"]', pop);
        if (sel) lbl.textContent = trigger.dataset.default.startsWith("Trips") ? `Trips (${sel.textContent.trim()})` : sel.textContent.trim();
        pending = null;
        closePop(true);
      });
    } else {
      $(".ok", pop).addEventListener("click", () => {
        const d = datePicker.selected;
        if (d) lbl.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
        closePop(true);
      });
    }
    $(".cancel", pop).addEventListener("click", () => closePop(true));
  });

  const clear = $(".filter-clear");
  if (clear) clear.addEventListener("click", () => {
    $$(".filter").forEach((f) => {
      const t = $(".pill", f);
      $(".lbl", t).textContent = t.dataset.default;
      $$(".option", f).forEach((o) => o.setAttribute("aria-selected", String(o.textContent.trim() === "12pm -4pm" && t.dataset.default.startsWith("Trips"))));
    });
    datePicker.selected = null;
    toast("Filters cleared.");
  });

  /* Date picker (reuses the native calendar composition) */
  const datePicker = {
    view: null, selected: null, pop: null,
    open(pop) {
      this.pop = pop;
      const base = this.selected || new Date();
      this.view = new Date(base.getFullYear(), base.getMonth(), 1);
      if (!pop.dataset.wired) {
        $$(".dp-nav", pop).forEach((b) => b.addEventListener("click", () => {
          this.view = new Date(this.view.getFullYear(), this.view.getMonth() + Number(b.dataset.step), 1);
          this.render();
        }));
        pop.dataset.wired = "1";
      }
      this.render();
    },
    render() {
      const pop = this.pop, grid = $(".dp-grid", pop);
      $(".dp-month .t-heading", pop).textContent = this.view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const dows = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const start = new Date(this.view); start.setDate(1 - this.view.getDay());
      const sel = this.selected;
      let html = dows.map((d) => `<span class="dow" aria-hidden="true">${d}</span>`).join("");
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const outside = d.getMonth() !== this.view.getMonth();
        const isSel = sel && d.toDateString() === sel.toDateString();
        html += `<button type="button" class="dp-day${outside ? " is-outside" : ""}" data-iso="${d.toISOString()}" aria-pressed="${isSel ? "true" : "false"}" aria-label="${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}">${d.getDate()}</button>`;
      }
      grid.innerHTML = html;
      $$(".dp-day", grid).forEach((b) => b.addEventListener("click", () => {
        this.selected = new Date(b.dataset.iso);
        $$(".dp-day", grid).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }));
    },
  };

  /* Direction toggle (Idle / Click) */
  const dir = $(".dir-toggle");
  if (dir) dir.addEventListener("click", () => {
    const on = dir.getAttribute("aria-pressed") !== "true";
    dir.setAttribute("aria-pressed", String(on));
    $(".dir-lbl", dir).textContent = on ? "Southbound" : "Northbound";
  });

  /* Map: Expand / Minimize + zoom */
  const map = $("#route-map");
  if (map) {
    const exp = $(".map-expand", map), base = $(".base", map);
    let zoom = 1;
    exp.addEventListener("click", () => {
      const on = !map.classList.contains("is-expanded");
      map.classList.toggle("is-expanded", on);
      exp.setAttribute("aria-pressed", String(on));
      base.src = on ? base.dataset.big : base.dataset.small;
      $(".label", exp).textContent = on ? "Minimize" : "Expand";
      $(".ico img", exp).src = on ? "assets/icons/map-minimize.svg" : "assets/icons/map-expand.svg";
      exp.setAttribute("aria-label", on ? "Minimize map" : "Expand map");
    });
    exp.setAttribute("aria-label", "Expand map");
    $$("[data-zoom]", map).forEach((b) => b.addEventListener("click", () => {
      zoom = Math.min(2, Math.max(1, zoom + Number(b.dataset.zoom) * 0.25));
      map.style.setProperty("--zoom", zoom);
      $('[data-zoom="1"]', map).disabled = zoom >= 2;
      $('[data-zoom="-1"]', map).disabled = zoom <= 1;
    }));
  }

  /* Accordion: each stop reuses the reference schedule composition */
  const firstPanel = $("#acc-p0");
  $$(".acc").forEach((acc, i) => {
    const btn = $(".acc-btn", acc);
    btn.addEventListener("click", () => {
      let panel = $(".acc-panel", acc);
      if (!panel && firstPanel) {
        panel = firstPanel.cloneNode(true);
        panel.id = "acc-p" + i;
        btn.id = "acc-b" + i;
        panel.setAttribute("aria-labelledby", btn.id);
        $$(".time[aria-pressed]", panel).forEach((t, j) => t.setAttribute("aria-pressed", String(j === 0)));
        wireTimes(panel);
        acc.appendChild(panel);
        panel.hidden = true;
        btn.setAttribute("aria-controls", panel.id);
      }
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      $(".ico img", btn).src = open ? "assets/icons/acc-collapse.svg" : "assets/icons/acc-expand.svg";
    });
  });

  /* Departure time chips: one selected per stop (Time: Display / Highlight) */
  function wireTimes(scope) {
    const chips = $$("button.time", scope);
    chips.forEach((c) => c.addEventListener("click", () => {
      chips.forEach((x) => x.setAttribute("aria-pressed", "false"));
      c.setAttribute("aria-pressed", "true");
    }));
  }
  if (firstPanel) wireTimes(firstPanel);

  /* Focus the alerts panel when arriving from an alert link */
  if (location.hash === "#service-alerts") {
    const t = $("#service-alerts");
    if (t) setTimeout(() => t.focus({ preventScroll: true }), 50);
  }
})();
