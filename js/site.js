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
  window.BBB = Object.assign(window.BBB || {}, { toast, showPop, closePop, isOpen: (pop) => openPop && openPop.pop === pop });

  /* =================== HOME =================== */

  /* Route search with suggestions drawn from the routes list */
  const searchForm = $("#route-search");
  if (searchForm) {
    const input = $("#route-q"), list = $("#route-suggest");
    const routesNow = () => $$(".route-item").map((a) => ({
      num: a.dataset.route,
      badge: $(".badge", a).textContent.trim(),
      name: $(".t-strong", a).textContent.trim(),
      streets: $(".t-small", a).textContent.trim(),
      href: a.getAttribute("href"),
      el: a,
    }));
    let active = -1, matches = [];
    function render() {
      const raw = input.value.trim().toLowerCase();
      if (!raw) { closePop(false); input.setAttribute("aria-expanded", "false"); return; }
      // "16", "route 16", "rapid 12", "r12", "rapid", "wilshire" all work
      const num = raw.replace(/^(route|rapid)\s*#?\s*/, "");
      matches = routesNow().filter((r) => {
        const id = r.num.toLowerCase(), bare = id.replace(/^r/, "");
        if (num && (bare.startsWith(num) || id.startsWith(num))) return !/^rapid/.test(raw) || id.startsWith("r");
        return r.name.toLowerCase().includes(raw) || r.streets.toLowerCase().includes(raw);
      });
      active = -1;
      list.innerHTML = matches.length
        ? matches.map((r, i) => `<a class="option" role="option" id="sug-${i}" aria-selected="false" href="${r.href}"><span class="badge">${r.badge}</span><span>${r.name} · ${r.streets}</span></a>`).join("")
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
      const reach = step ? step * 3 : 900;    // one throw travels at most three cards
      const projected = left - Math.max(-reach, Math.min(reach, v * 220));
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

  /* Focus the alerts panel when arriving from an alert link */
  if (location.hash === "#service-alerts") {
    const t = $("#service-alerts");
    if (t) setTimeout(() => t.focus({ preventScroll: true }), 50);
  }
})();
